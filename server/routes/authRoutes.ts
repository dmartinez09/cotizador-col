/**
 * Rutas Express para autenticación local (login con usuario + contraseña).
 * Convive con el flujo OAuth existente — ambos generan la misma cookie JWT.
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import * as db from "../db";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../services/authService";

export function registerLocalAuthRoutes(app: Express) {
  /**
   * POST /api/auth/login
   * Body: { username: string, password: string }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: "Usuario y contraseña son requeridos" });
        return;
      }

      const user = await db.getUserByUsername(username.toLowerCase().trim());
      if (!user) {
        res.status(401).json({ error: "Credenciales inválidas" });
        return;
      }

      if (!user.passwordHash) {
        res.status(401).json({ error: "Este usuario usa autenticación OAuth. Use el botón de login externo." });
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

      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

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
          username: user.username,
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
   * Body: { currentPassword: string, newPassword: string }
   * Requiere sesión activa.
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
