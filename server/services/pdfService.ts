/**
 * Generación de PDF server-side para cotizaciones.
 * Usa PDFKit (puro JS, sin dependencias nativas).
 * Genera buffers de PDF que luego van a Azure Blob Storage.
 */
import * as db from "../db";

// Tipo para el resultado de generación
export type PdfGenerationResult = {
  buffer: Buffer;
  fileName: string;
};

/**
 * Genera un PDF de cotización.
 * Retorna un buffer con el contenido del PDF y el nombre del archivo.
 */
export async function generateQuotationPdf(
  quotationId: number,
  userId: number
): Promise<PdfGenerationResult> {
  const quotation = await db.getQuotationById(quotationId);
  if (!quotation) throw new Error("Cotización no encontrada");

  const items = await db.getQuotationItems(quotationId);
  const client = await db.getClientById(quotation.clientId);
  const vendor = await db.getUserById(quotation.vendorId);
  const products = await db.getAllProducts();

  const productMap = new Map(products.map(p => [p.id, p]));

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(val);
  };

  const dateStr = new Date(quotation.createdAt).toLocaleDateString("es-CO", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Construir contenido del PDF como texto plano formateado en HTML-like
  // Usamos una representación que luego se puede renderizar con cualquier librería
  const lines: string[] = [];

  lines.push("POINT COLOMBIA");
  lines.push("COTIZACIÓN COMERCIAL");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Cotización #: ${quotation.id}`);
  lines.push(`Fecha: ${dateStr}`);
  lines.push(`Estado: ${quotation.status.toUpperCase()}`);
  lines.push("");
  lines.push("--- DATOS DEL CLIENTE ---");
  lines.push(`Cliente: ${client?.name || "N/A"}`);
  lines.push(`Zona: ${client?.zone || "N/A"}`);
  lines.push("");
  lines.push(`Vendedor: ${vendor?.name || "N/A"}`);
  lines.push("");
  lines.push("--- PRODUCTOS ---");
  lines.push("-".repeat(80));
  lines.push(
    padRight("Producto", 30) +
    padRight("Cant.", 8) +
    padRight("Precio Lista", 15) +
    padRight("Precio Neto", 15) +
    padRight("Subtotal", 15)
  );
  lines.push("-".repeat(80));

  for (const item of items) {
    const product = productMap.get(item.productId);
    const desc = (product?.description || "N/A").substring(0, 28);
    const bonusTag = item.isBonus === 1 ? " [BONIF.]" : "";
    const precioLista = product?.price ?? item.unitPrice;
    lines.push(
      padRight(desc + bonusTag, 30) +
      padRight(String(item.quantity), 8) +
      padRight(formatCOP(precioLista), 15) +
      padRight(formatCOP(item.unitPrice), 15) +
      padRight(formatCOP(item.subtotal), 15)
    );
  }

  lines.push("-".repeat(80));
  lines.push("");
  lines.push(`${"".padStart(50)}PRECIO NETO: ${formatCOP(quotation.subtotal)}`);
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("Documento generado por el Sistema de Cotizaciones Point Colombia");
  lines.push(`Generado: ${new Date().toLocaleString("es-CO")}`);

  const textContent = lines.join("\n");

  // Generar un PDF simple usando texto plano en un buffer
  // Formato: PDF 1.4 mínimo válido
  const pdfBuffer = generateMinimalPdf(textContent);

  const fileName = `cotizacion_${quotation.id}_${Date.now()}.pdf`;

  // Registrar en auditoría
  await db.createAuditLog({
    userId,
    entity: "quotation",
    entityId: quotationId,
    action: "pdf_generate",
    details: JSON.stringify({ fileName }),
  });

  return { buffer: pdfBuffer, fileName };
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
}

/**
 * Genera un PDF 1.4 válido con contenido de texto plano.
 * Esto es un generador de PDF minimalista sin dependencias externas.
 */
function generateMinimalPdf(text: string): Buffer {
  const lines = text.split("\n");
  const pageHeight = 842; // A4 height in points
  const pageWidth = 595;  // A4 width in points
  const margin = 50;
  const lineHeight = 14;
  const maxLinesPerPage = Math.floor((pageHeight - 2 * margin) / lineHeight);

  // Split text into pages
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerPage) {
    pages.push(lines.slice(i, i + maxLinesPerPage));
  }

  if (pages.length === 0) pages.push([""]);

  // Build PDF objects
  let objNum = 0;
  const objects: string[] = [];

  const addObj = (content: string): number => {
    objNum++;
    objects.push(`${objNum} 0 obj\n${content}\nendobj`);
    return objNum;
  };

  // Object 1: Catalog
  const catalogId = addObj("<< /Type /Catalog /Pages 2 0 R >>");

  // Object 2: Pages (placeholder - will be updated)
  const pagesObjIndex = objects.length;
  const pagesId = addObj("PLACEHOLDER");

  // Object 3: Font
  const fontId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

  // Create page objects
  const pageObjIds: number[] = [];
  const contentObjIds: number[] = [];

  for (const page of pages) {
    // Content stream
    let stream = `BT\n/F1 9 Tf\n`;
    let y = pageHeight - margin;
    for (const line of page) {
      // Escape special PDF chars
      const escaped = line
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/[^\x20-\x7E]/g, "?"); // Replace non-ASCII with ?
      stream += `${margin} ${y} Td\n(${escaped}) Tj\n-${margin} -${lineHeight} Td\n`;
      y -= lineHeight;
    }
    stream += "ET";

    const streamBytes = Buffer.from(stream, "latin1");
    const contentId = addObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
    contentObjIds.push(contentId);

    // Page object
    const pageId = addObj(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    );
    pageObjIds.push(pageId);
  }

  // Update Pages object
  const kidsStr = pageObjIds.map(id => `${id} 0 R`).join(" ");
  objects[pagesObjIndex] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageObjIds.length} >>\nendobj`;

  // Build PDF file
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += obj + "\n\n";
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objNum + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objNum + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
