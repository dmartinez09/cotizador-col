/**
 * Rutas Express para autenticación local.
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const.js";
import { getSessionCookieOptions } from "../_core/cookies.js";
import { sdk } from "../_core/sdk.js";
import * as db from "../db.js";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../services/authService.js";

export function registerLocalAuthRoutes(app: Express) {
  /**
   * POST /api/auth/login
   * Body: { username: string, password: string }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      // 1. Recibimos "username" desde el frontend (Login.tsx)
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: "Usuario y contraseña son requeridos" });
        return;
      }

      // 2. Buscamos al usuario. Como hicimos el truco maestro,
      // el nombre de usuario está guardado físicamente en la columna email.
      // (Nota: asegúrate de que db.getUserByEmail exista en tus archivos de BD)
      const user = await db.getUserByEmail(username.toLowerCase().trim());
      
      if (!user) {
        res.status(401).json({ error: "Credenciales inválidas" });
        return;
      }

      // 3. Verificar contraseña
      if (!user.passwordHash) {
        res.status(401).json({ error: "Este usuario usa autenticación OAuth." });
        return;
      }

      const valid = verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Credenciales inválidas" });
        return;
      }

      if (user.isActive !== 1) {
        res.status(403).json({ error: "Usuario desactivado" });
        return;
      }

      // 4. Actualizar último login
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // 5. Crear token de sesión JWT
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // 6. Auditoría
      await db.createAuditLog({
        userId: user.id,
        entity: "user",
        entityId: user.id,
        action: "login",
        details: JSON.stringify({ method: "local", username }),
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.email, // Devolvemos la columna email como "username"
          role: user.role,
        },
      });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Error interno de autenticación" });
    }
  });

  /**
   * POST /api/auth/change-password
   */
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "No autenticado" });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Contraseña actual y nueva son requeridas" });
        return;
      }

      if (user.passwordHash) {
        const valid = verifyPassword(currentPassword, user.passwordHash);
        if (!valid) {
          res.status(401).json({ error: "Contraseña actual incorrecta" });
          return;
        }
      }

      const validation = validatePasswordStrength(newPassword);
      if (!validation.valid) {
        res.status(400).json({ error: validation.message });
        return;
      }

      const hash = hashPassword(newPassword);
      await db.updateUserPassword(user.id, hash);

      await db.createAuditLog({
        userId: user.id,
        entity: "user",
        entityId: user.id,
        action: "change_password",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Change password failed:", error);
      res.status(500).json({ error: "Error interno" });
    }
  });
}
