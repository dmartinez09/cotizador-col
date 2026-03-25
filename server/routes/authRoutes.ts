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
      // CAMBIO: Recibimos 'username' en lugar de 'email'
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: "Usuario y contraseña son requeridos" });
        return;
      }

      // CAMBIO: Buscar usuario por username
      const user = await db.getUserByUsername(username.toLowerCase().trim());
      if (!user) {
        res.status(401).json({ error: "Credenciales inválidas" });
        return;
      }

      // Verificar contraseña
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

      // Actualizar último login
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Crear token de sesión JWT (misma mecánica que OAuth)
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
