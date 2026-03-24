if (process.env.NODE_ENV !== "production") {
  await import("dotenv/config");
}

import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "../routes/authRoutes";
import { registerPdfRoutes } from "../routes/pdfRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./serveStatic";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Trust proxy (Azure App Service reverse proxy)
  app.set("trust proxy", 1);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Local auth routes (login with password)
  registerLocalAuthRoutes(app);

  // PDF download routes (binary responses, not tRPC)
  registerPdfRoutes(app);

  // Health check for Azure
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
  const { setupVite } = await import("./vite");
  await setupVite(app, server);
} else {
  serveStatic(app);
}

  // Azure App Service sets PORT env variable
  const preferredPort = parseInt(process.env.PORT || process.env.WEBSITES_PORT || "8080");
const port = process.env.NODE_ENV === "production"
  ? preferredPort
  : await findAvailablePort(preferredPort);

if (port !== preferredPort && process.env.NODE_ENV !== "production") {
  console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
}

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
}

startServer().catch(console.error);
