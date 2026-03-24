import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../dist/public");

export function serveStatic(app: express.Express) {
  if (!fs.existsSync(clientDistPath)) {
    throw new Error(`No se encontró la carpeta estática: ${clientDistPath}`);
  }

  app.use(express.static(clientDistPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}
