/**
 * Rutas Express para generación y descarga de PDFs.
 * Usa Express (no tRPC) porque tRPC no maneja bien respuestas binarias.
 *
 * Seguridad:
 *   - Todas las rutas requieren autenticación JWT.
 *   - Vendedores solo acceden a PDFs de SUS cotizaciones.
 *   - Coordinadores, gerentes y admins acceden a todas.
 *   - Solo se generan PDFs de cotizaciones aprobadas.
 *   - Las URLs devueltas son SAS temporales (Azure) o locales (dev).
 *   - Nunca se asume acceso público al blob.
 *
 * Rutas:
 *   POST /api/pdf/generate/:quotationId   → Genera y sube PDF
 *   GET  /api/pdf/url/:pdfId              → SAS URL por ID (preferida por frontend)
 *   GET  /api/pdf/download/*              → Descarga directa por blobKey
 *   GET  /api/pdf/list/:quotationId       → Lista PDFs de una cotización
 */
import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { generateQuotationPdf } from "../services/pdfService";
import {
  uploadPdf,
  getDownloadUrl,
  readLocalPdf,
  isAzureConfigured,
} from "../services/blobStorage";

// ── Helpers de autorización ────────────────────────────────

type AuthUser = {
  id: number;
  role: string;
  [key: string]: any;
};

/**
 * Verifica que el usuario tenga permiso para acceder a una cotización.
 * - vendedor:     solo sus propias cotizaciones (vendorId === user.id)
 * - coordinador:  todas
 * - gerente:      todas
 * - admin:        todas
 */
function canAccessQuotation(
  user: AuthUser,
  quotation: { vendorId: number }
): boolean {
  if (user.role === "vendedor") {
    return quotation.vendorId === user.id;
  }
  return true;
}

/**
 * Autentica la request. Retorna el usuario o envía 401 y retorna null.
 */
async function authenticate(
  req: Request,
  res: Response
): Promise<AuthUser | null> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return null;
    }
    return user as AuthUser;
  } catch {
    res.status(401).json({ error: "No autenticado" });
    return null;
  }
}

/**
 * Valida un parámetro numérico positivo. Retorna el número o envía 400 y retorna null.
 */
function parsePositiveInt(
  value: string,
  res: Response,
  label: string
): number | null {
  const num = parseInt(value);
  if (isNaN(num) || num <= 0) {
    res.status(400).json({ error: `${label} inválido` });
    return null;
  }
  return num;
}

// ── Registro de rutas ──────────────────────────────────────

export function registerPdfRoutes(app: Express) {
  // ─────────────────────────────────────────────────────────
  // POST /api/pdf/generate/:quotationId
  // Genera un PDF y lo sube a Azure Blob (prod) o disco (dev).
  //
  // Validaciones:
  //   1. Autenticación
  //   2. quotationId numérico > 0
  //   3. Cotización existe y está activa
  //   4. Cotización está aprobada (status = 'aprobada')
  //   5. Permisos por rol
  //
  // Respuesta: { success, pdf: { fileName, downloadUrl, version, size } }
  // ─────────────────────────────────────────────────────────
  app.post(
    "/api/pdf/generate/:quotationId",
    async (req: Request, res: Response) => {
      try {
        const user = await authenticate(req, res);
        if (!user) return;

        const quotationId = parsePositiveInt(
          req.params.quotationId,
          res,
          "ID de cotización"
        );
        if (!quotationId) return;

        // Verificar existencia (getQuotationById ya filtra isActive=1)
        const quotation = await db.getQuotationById(quotationId);
        if (!quotation) {
          res.status(404).json({ error: "Cotización no encontrada" });
          return;
        }

        // Solo cotizaciones aprobadas
        if (quotation.status !== "aprobada") {
          res.status(400).json({
            error: "Solo se pueden generar PDFs de cotizaciones aprobadas",
          });
          return;
        }

        // Permisos por rol
        if (!canAccessQuotation(user, quotation)) {
          res
            .status(403)
            .json({ error: "Sin permisos para esta cotización" });
          return;
        }

        // Generar PDF
        const { buffer, fileName } = await generateQuotationPdf(
          quotationId,
          user.id
        );

        // Subir a blob storage
        const blobKey = `quotations/${quotationId}/${fileName}`;
        const blobResult = await uploadPdf(blobKey, buffer);

        // Calcular versión
        const existingPdfs =
          await db.getPdfDocumentsByQuotation(quotationId);
        const version = existingPdfs.length + 1;

        // Registrar metadata en MySQL
        await db.createPdfDocument({
          quotationId,
          generatedBy: user.id,
          fileName,
          blobUrl: blobResult.url,
          blobKey: blobResult.key,
          fileSize: blobResult.size,
          version,
        });

        // Auditoría
        await db.createAuditLog({
          userId: user.id,
          entity: "quotation",
          entityId: quotationId,
          action: "pdf_generate",
          details: JSON.stringify({
            fileName,
            version,
            size: blobResult.size,
          }),
        });

        res.json({
          success: true,
          pdf: {
            fileName,
            downloadUrl: blobResult.url,
            version,
            size: blobResult.size,
          },
        });
      } catch (error) {
        console.error("[PDF] Generation failed:", error);
        res.status(500).json({ error: "Error generando PDF" });
      }
    }
  );

  // ─────────────────────────────────────────────────────────
  // GET /api/pdf/url/:pdfId
  // Genera una SAS URL temporal para un PDF por su ID en pdfDocuments.
  //
  // Esta es la ruta PREFERIDA para el frontend:
  //   - Busca el registro en MySQL → valida cotización → valida permisos
  //   - Retorna SAS URL fresca (Azure) o URL local (dev)
  //   - Más segura que /download/* porque usa el ID de BD, no el blobKey
  //
  // Respuesta: { downloadUrl, fileName, fileSize, version }
  // ─────────────────────────────────────────────────────────
  app.get(
    "/api/pdf/url/:pdfId",
    async (req: Request, res: Response) => {
      try {
        const user = await authenticate(req, res);
        if (!user) return;

        const pdfId = parsePositiveInt(req.params.pdfId, res, "ID de PDF");
        if (!pdfId) return;

        const pdfDoc = await db.getPdfDocumentById(pdfId);
        if (!pdfDoc) {
          res.status(404).json({ error: "PDF no encontrado" });
          return;
        }

        // Verificar permisos sobre la cotización asociada
        const quotation = await db.getQuotationById(pdfDoc.quotationId);
        if (!quotation) {
          res
            .status(404)
            .json({ error: "Cotización asociada no encontrada" });
          return;
        }

        if (!canAccessQuotation(user, quotation)) {
          res.status(403).json({ error: "Sin permisos para este PDF" });
          return;
        }

        // Generar URL fresca (SAS temporal en Azure, local en dev)
        const blobKey = pdfDoc.blobKey || pdfDoc.fileName;
        const downloadUrl = await getDownloadUrl(blobKey);

        res.json({
          downloadUrl,
          fileName: pdfDoc.fileName,
          fileSize: pdfDoc.fileSize,
          version: pdfDoc.version,
        });
      } catch (error) {
        console.error("[PDF] URL generation failed:", error);
        res.status(500).json({ error: "Error generando URL de descarga" });
      }
    }
  );

  // ─────────────────────────────────────────────────────────
  // GET /api/pdf/download/*
  // Descarga un PDF por su blobKey.
  //
  // Flujo:
  //   Azure  → redirige 302 a SAS URL temporal
  //   Local  → sirve el archivo desde disco (solo desarrollo)
  //
  // Seguridad:
  //   - Requiere autenticación
  //   - DEBE encontrar un registro en pdfDocuments que coincida con el key
  //   - Verifica permisos sobre la cotización asociada
  //   - Si no se puede vincular el key a un pdfDocument, deniega acceso
  // ─────────────────────────────────────────────────────────
  app.get(
    "/api/pdf/download/*",
    async (req: Request, res: Response) => {
      try {
        const user = await authenticate(req, res);
        if (!user) return;

        // Extraer el key completo del wildcard (todo después de /download/)
        const key = req.params[0];
        if (!key) {
          res.status(400).json({ error: "Key de PDF requerido" });
          return;
        }

        // Buscar el registro en MySQL para verificar autorización
        const pdfDoc = await findPdfDocumentByKey(key);
        if (!pdfDoc) {
          // No se puede vincular este key a ningún PDF registrado → denegar
          res.status(404).json({ error: "PDF no encontrado" });
          return;
        }

        // Verificar permisos sobre la cotización asociada
        const quotation = await db.getQuotationById(pdfDoc.quotationId);
        if (!quotation) {
          res.status(404).json({ error: "Cotización asociada no encontrada" });
          return;
        }

        if (!canAccessQuotation(user, quotation)) {
          res.status(403).json({ error: "Sin permisos para este PDF" });
          return;
        }

        // Azure → redirigir a SAS URL temporal
        if (isAzureConfigured()) {
          const sasUrl = await getDownloadUrl(key);
          res.redirect(302, sasUrl);
          return;
        }

        // Fallback local (solo desarrollo)
        const buffer = readLocalPdf(key);
        if (!buffer) {
          res.status(404).json({ error: "PDF no encontrado en disco" });
          return;
        }

        const fileName = key.split("/").pop() || "documento.pdf";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );
        res.send(buffer);
      } catch (error) {
        console.error("[PDF] Download failed:", error);
        res.status(500).json({ error: "Error descargando PDF" });
      }
    }
  );

  // ─────────────────────────────────────────────────────────
  // GET /api/pdf/list/:quotationId
  // Lista todos los PDFs generados para una cotización.
  //
  // Validaciones:
  //   1. Autenticación
  //   2. quotationId válido
  //   3. Cotización existe
  //   4. Permisos por rol
  //
  // Respuesta: [{ id, quotationId, generatedBy, fileName, downloadUrl,
  //               fileSize, version, createdAt }]
  // ─────────────────────────────────────────────────────────
  app.get(
    "/api/pdf/list/:quotationId",
    async (req: Request, res: Response) => {
      try {
        const user = await authenticate(req, res);
        if (!user) return;

        const quotationId = parsePositiveInt(
          req.params.quotationId,
          res,
          "ID de cotización"
        );
        if (!quotationId) return;

        // Verificar existencia
        const quotation = await db.getQuotationById(quotationId);
        if (!quotation) {
          res.status(404).json({ error: "Cotización no encontrada" });
          return;
        }

        // Permisos por rol
        if (!canAccessQuotation(user, quotation)) {
          res
            .status(403)
            .json({ error: "Sin permisos para esta cotización" });
          return;
        }

        // Obtener PDFs con URLs de descarga frescas
        const pdfs = await db.getPdfDocumentsByQuotation(quotationId);

        const pdfsWithUrls = await Promise.all(
          pdfs.map(async (pdf) => {
            const blobKey = pdf.blobKey || pdf.fileName;
            let downloadUrl: string;
            try {
              downloadUrl = await getDownloadUrl(blobKey);
            } catch {
              // SAS falló → devolver cadena vacía (frontend usará /api/pdf/url/:id)
              downloadUrl = "";
            }

            return {
              id: pdf.id,
              quotationId: pdf.quotationId,
              generatedBy: pdf.generatedBy,
              fileName: pdf.fileName,
              downloadUrl,
              fileSize: pdf.fileSize,
              version: pdf.version,
              createdAt: pdf.createdAt,
            };
          })
        );

        res.json(pdfsWithUrls);
      } catch (error) {
        console.error("[PDF] List failed:", error);
        res.status(500).json({ error: "Error listando PDFs" });
      }
    }
  );
}

// ── Helpers internos ───────────────────────────────────────

/**
 * Busca un pdfDocument en MySQL por su blobKey.
 * Usado por /download/* para vincular un key arbitrario a un registro
 * y verificar autorización sobre la cotización.
 *
 * Estrategia de búsqueda:
 *   1. Extrae quotationId del path (formato: quotations/{id}/{fileName})
 *   2. Busca todos los PDFs de esa cotización
 *   3. Compara por blobKey exacto o por fileName parcial
 *
 * Retorna null si no puede vincular → la ruta debe denegar acceso.
 */
async function findPdfDocumentByKey(
  key: string
): Promise<{ quotationId: number; blobKey: string | null } | null> {
  // Formato esperado: quotations/{quotationId}/{fileName}
  const match = key.match(/^quotations\/(\d+)\//);
  if (!match) return null;

  const quotationId = parseInt(match[1]);
  if (isNaN(quotationId)) return null;

  const pdfs = await db.getPdfDocumentsByQuotation(quotationId);
  const found = pdfs.find(
    (p) => p.blobKey === key || key.endsWith(p.fileName)
  );

  return found
    ? { quotationId: found.quotationId, blobKey: found.blobKey }
    : null;
}
