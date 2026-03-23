/**
 * Servicio de autenticación local con contraseñas hasheadas.
 * Usa Node.js crypto (scrypt) para no depender de paquetes nativos.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Hashea una contraseña con scrypt + salt aleatorio.
 * Formato: salt_hex:hash_hex
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verifica una contraseña contra un hash almacenado.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [saltHex, hashHex] = storedHash.split(":");
    if (!saltHex || !hashHex) return false;

    const salt = Buffer.from(saltHex, "hex");
    const storedKey = Buffer.from(hashHex, "hex");
    const derivedKey = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);

    return timingSafeEqual(storedKey, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Valida la fortaleza de una contraseña.
 */
export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: "La contraseña debe tener al menos 8 caracteres" };
  }
  if (password.length > 128) {
    return { valid: false, message: "La contraseña no puede tener más de 128 caracteres" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "La contraseña debe tener al menos una letra mayúscula" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "La contraseña debe tener al menos una letra minúscula" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "La contraseña debe tener al menos un número" };
  }
  return { valid: true };
}
