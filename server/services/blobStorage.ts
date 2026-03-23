/**
 * Azure Blob Storage — Integración lista para producción.
 *
 * Variables de entorno:
 *   AZURE_STORAGE_CONNECTION_STRING  — Connection string (AccountName + AccountKey)
 *   AZURE_BLOB_CONTAINER             — Nombre del contenedor (primario)
 *   AZURE_STORAGE_CONTAINER          — Nombre del contenedor (fallback secundario)
 *
 * Comportamiento por entorno:
 *   NODE_ENV=production  → Azure Blob OBLIGATORIO. Lanza error si no está configurado.
 *   NODE_ENV=development → Fallback a almacenamiento local en ./uploads/pdfs/
 *
 * Seguridad:
 *   - El contenedor se crea SIN acceso público (privado por defecto).
 *   - Las descargas usan SAS URLs temporales con expiración de 1 hora.
 *   - Las SAS URLs requieren connection string con AccountName + AccountKey.
 *
 * Dependencia: @azure/storage-blob (pnpm add @azure/storage-blob)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { Buffer } from "node:buffer";

// ── Tipos ──────────────────────────────────────────────────

export type BlobUploadResult = {
  key: string;
  url: string;
  size: number;
};

// ── Constantes ─────────────────────────────────────────────

const SAS_EXPIRY_HOURS = 1;
const DEFAULT_CONTAINER = "cotizador-pdfs";

// ── Cache singleton (lazy init) ────────────────────────────

let _blobServiceClient: any = null;
let _containerClient: any = null;

// ── Helpers de configuración ───────────────────────────────

function getAzureConfig() {
  return {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || "",
    containerName:
      process.env.AZURE_BLOB_CONTAINER ||
      process.env.AZURE_STORAGE_CONTAINER ||
      DEFAULT_CONTAINER,
  };
}

export function isAzureConfigured(): boolean {
  return !!process.env.AZURE_STORAGE_CONNECTION_STRING;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Extrae un valor (AccountName, AccountKey, etc.) del connection string de Azure.
 * Formato: "DefaultEndpointsProtocol=https;AccountName=xxx;AccountKey=yyy;EndpointSuffix=..."
 */
function extractFromConnectionString(
  connectionString: string,
  key: string
): string | null {
  const regex = new RegExp(`${key}=([^;]+)`);
  const match = connectionString.match(regex);
  return match ? match[1] : null;
}

// ── Azure Container Client (lazy singleton) ────────────────

/**
 * Obtiene o inicializa el container client de Azure.
 *
 * Producción sin config → lanza Error (nunca fallback local).
 * Desarrollo sin config → retorna null (fallback local).
 */
async function getContainerClient() {
  if (_containerClient) return _containerClient;

  const config = getAzureConfig();

  if (!config.connectionString) {
    if (isProduction()) {
      throw new Error(
        "[BlobStorage] AZURE_STORAGE_CONNECTION_STRING es obligatorio en producción. " +
          "Configure la variable en Azure App Service → Configuración → Application settings."
      );
    }
    console.warn(
      "[BlobStorage] Azure no configurado — usando almacenamiento local (solo desarrollo)."
    );
    return null;
  }

  try {
    const { BlobServiceClient } = await import("@azure/storage-blob");

    _blobServiceClient = BlobServiceClient.fromConnectionString(
      config.connectionString
    );
    _containerClient = _blobServiceClient.getContainerClient(
      config.containerName
    );

    // Crear contenedor SIN acceso público (privado por defecto).
    // createIfNotExists() sin parámetros = access level "private".
    await _containerClient.createIfNotExists();

    console.log(
      `[BlobStorage] Conectado a Azure container: ${config.containerName}`
    );
    return _containerClient;
  } catch (error) {
    // Reset cache para que reintente en la siguiente llamada
    _blobServiceClient = null;
    _containerClient = null;

    if (isProduction()) {
      throw new Error(
        `[BlobStorage] Error conectando a Azure Blob Storage: ${error}`
      );
    }
    console.warn(
      "[BlobStorage] Azure no disponible — usando almacenamiento local:",
      error
    );
    return null;
  }
}

// ── SAS URL Generation ─────────────────────────────────────

/**
 * Genera una URL SAS temporal con permisos de solo lectura.
 * Requiere AccountName + AccountKey en el connection string.
 * Expiración: SAS_EXPIRY_HOURS (1 hora por defecto).
 */
async function generateSasUrl(blobKey: string): Promise<string> {
  const {
    BlobSASPermissions,
    generateBlobSASQueryParameters,
    StorageSharedKeyCredential,
  } = await import("@azure/storage-blob");

  const config = getAzureConfig();

  const accountName = extractFromConnectionString(
    config.connectionString,
    "AccountName"
  );
  const accountKey = extractFromConnectionString(
    config.connectionString,
    "AccountKey"
  );

  if (!accountName || !accountKey) {
    throw new Error(
      "[BlobStorage] Connection string debe contener AccountName y AccountKey para generar SAS URLs. " +
        "Verifique que usa una connection string de Access Key, no un SAS token."
    );
  }

  const credential = new StorageSharedKeyCredential(accountName, accountKey);

  const startsOn = new Date();
  const expiresOn = new Date(
    startsOn.getTime() + SAS_EXPIRY_HOURS * 60 * 60 * 1000
  );

  const sasQueryParams = generateBlobSASQueryParameters(
    {
      containerName: config.containerName,
      blobName: blobKey,
      permissions: BlobSASPermissions.parse("r"), // Solo lectura
      startsOn,
      expiresOn,
    },
    credential
  );

  // Construir URL completa: https://<account>.blob.core.windows.net/<container>/<key>?<sas>
  const blobBaseUrl = `https://${accountName}.blob.core.windows.net/${config.containerName}/${blobKey}`;
  return `${blobBaseUrl}?${sasQueryParams.toString()}`;
}

// ── Funciones públicas ─────────────────────────────────────

/**
 * Sube un PDF a Azure Blob Storage.
 *
 * - En producción: Azure obligatorio, lanza error si no está configurado.
 * - En desarrollo: fallback a disco local si Azure no está disponible.
 *
 * @param key       Path/key del blob (ej: "quotations/123/COT-123-20260319.pdf")
 * @param buffer    Contenido del PDF
 * @param contentType  MIME type (default: "application/pdf")
 */
export async function uploadPdf(
  key: string,
  buffer: Buffer,
  contentType: string = "application/pdf"
): Promise<BlobUploadResult> {
  const container = await getContainerClient();

  if (container) {
    const blockBlobClient = container.getBlockBlobClient(key);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    // Generar SAS URL temporal para uso inmediato por el frontend
    const sasUrl = await generateSasUrl(key);

    return {
      key,
      url: sasUrl,
      size: buffer.length,
    };
  }

  // Solo llega aquí en desarrollo (en producción getContainerClient() ya lanzó error)
  return uploadLocalFallback(key, buffer);
}

/**
 * Genera una URL de descarga para un PDF existente.
 *
 * - Azure:  SAS URL temporal (1 hora de expiración).
 * - Local:  URL del endpoint Express (/api/pdf/download/:key).
 */
export async function getDownloadUrl(key: string): Promise<string> {
  if (isAzureConfigured()) {
    return generateSasUrl(key);
  }

  // Fallback local (solo desarrollo)
  return `/api/pdf/download/${encodeURIComponent(key)}`;
}

// ── Fallback local (solo desarrollo) ───────────────────────

/**
 * Guarda un PDF en el sistema de archivos local.
 * Solo se usa en desarrollo cuando Azure no está configurado.
 */
function uploadLocalFallback(key: string, buffer: Buffer): BlobUploadResult {
  const uploadsDir = join(process.cwd(), "uploads", "pdfs");

  // Sanitizar key para filesystem, pero preservar estructura de directorios
  const safeKey = key.replace(/[^a-zA-Z0-9._\-\/]/g, "_");
  const filePath = join(uploadsDir, safeKey);

  // Crear directorios necesarios (ej: uploads/pdfs/quotations/123/)
  const fileDir = dirname(filePath);
  if (!existsSync(fileDir)) {
    mkdirSync(fileDir, { recursive: true });
  }

  writeFileSync(filePath, buffer);

  return {
    key: safeKey,
    url: `/api/pdf/download/${encodeURIComponent(safeKey)}`,
    size: buffer.length,
  };
}

/**
 * Lee un PDF del almacenamiento local.
 * Solo para el endpoint de descarga en desarrollo.
 */
export function readLocalPdf(key: string): Buffer | null {
  const safeKey = key.replace(/[^a-zA-Z0-9._\-\/]/g, "_");
  const filePath = join(process.cwd(), "uploads", "pdfs", safeKey);
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}
