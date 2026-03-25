import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: express.Express) {
  // En producción, este archivo corre desde "dist/index.js".
  // Por lo tanto, __dirname es "dist", y la carpeta pública está justo adentro.
  const clientDistPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(clientDistPath)) {
    throw new Error(`No se encontró la carpeta estática: ${clientDistPath}`);
  }

  app.use(express.static(clientDistPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}
