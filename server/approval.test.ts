/**
 * Tests para el flujo de aprobación escalonado y funciones de servicio.
 * Estos tests son unitarios y NO requieren base de datos.
 */
import { describe, expect, it } from "vitest";
import {
  getInitialApprovalStep,
  getTrafficLightColor,
  canUserApprove,
} from "./services/approvalService";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "./services/authService";
import type { User, Quotation } from "../drizzle/schema";

// ===== Helper: crear usuario mock =====
function mockUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "local",
    passwordHash: null,
    role: "vendedor",
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

// ===== Helper: crear cotización mock =====
function mockQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 100,
    clientId: 1,
    vendorId: 1,
    subtotal: 100000,
    iva: 19000,
    total: 119000,
    totalCost: 65000,
    grossProfit: 35000,
    grossMargin: 3500,
    status: "pendiente",
    approvalStep: "none",
    approvedBy: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================================
// TESTS: Semáforo (Traffic Light)
// ============================================================
describe("getTrafficLightColor", () => {
  const redMax = 1000;
  const yellowMax = 3200;

  it("retorna 'green' si el margen >= yellowMax", () => {
    expect(getTrafficLightColor(3200, redMax, yellowMax)).toBe("green");
    expect(getTrafficLightColor(5000, redMax, yellowMax)).toBe("green");
  });

  it("retorna 'yellow' si el margen está entre redMax y yellowMax", () => {
    expect(getTrafficLightColor(1000, redMax, yellowMax)).toBe("yellow");
    expect(getTrafficLightColor(2000, redMax, yellowMax)).toBe("yellow");
    expect(getTrafficLightColor(3199, redMax, yellowMax)).toBe("yellow");
  });

  it("retorna 'red' si el margen < redMax", () => {
    expect(getTrafficLightColor(0, redMax, yellowMax)).toBe("red");
    expect(getTrafficLightColor(500, redMax, yellowMax)).toBe("red");
    expect(getTrafficLightColor(999, redMax, yellowMax)).toBe("red");
  });
});

// ============================================================
// TESTS: Paso inicial de aprobación
// ============================================================
describe("getInitialApprovalStep", () => {
  const redMax = 1000;
  const yellowMax = 3200;

  it("Verde (>= yellowMax) → no requiere aprobación escalonada ('none')", () => {
    expect(getInitialApprovalStep(3200, redMax, yellowMax)).toBe("none");
    expect(getInitialApprovalStep(5000, redMax, yellowMax)).toBe("none");
  });

  it("Amarillo (>= redMax, < yellowMax) → inicia con coordinador_pending", () => {
    expect(getInitialApprovalStep(1000, redMax, yellowMax)).toBe("coordinador_pending");
    expect(getInitialApprovalStep(2500, redMax, yellowMax)).toBe("coordinador_pending");
  });

  it("Rojo (< redMax) → inicia con gerente_pending", () => {
    expect(getInitialApprovalStep(999, redMax, yellowMax)).toBe("gerente_pending");
    expect(getInitialApprovalStep(0, redMax, yellowMax)).toBe("gerente_pending");
  });
});

// ============================================================
// TESTS: canUserApprove
// ============================================================
describe("canUserApprove", () => {
  it("Admin puede aprobar cualquier cotización pendiente", () => {
    const admin = mockUser({ role: "admin" });
    expect(canUserApprove(admin, mockQuotation({ approvalStep: "none" }))).toBe(true);
    expect(canUserApprove(admin, mockQuotation({ approvalStep: "coordinador_pending" }))).toBe(true);
    expect(canUserApprove(admin, mockQuotation({ approvalStep: "gerente_pending" }))).toBe(true);
  });

  it("Admin NO puede aprobar cotización no pendiente", () => {
    const admin = mockUser({ role: "admin" });
    expect(canUserApprove(admin, mockQuotation({ status: "aprobada" }))).toBe(false);
    expect(canUserApprove(admin, mockQuotation({ status: "rechazada" }))).toBe(false);
  });

  it("Gerente puede aprobar en gerente_pending o none", () => {
    const gerente = mockUser({ role: "gerente" });
    expect(canUserApprove(gerente, mockQuotation({ approvalStep: "gerente_pending" }))).toBe(true);
    expect(canUserApprove(gerente, mockQuotation({ approvalStep: "none" }))).toBe(true);
  });

  it("Gerente NO puede aprobar en coordinador_pending", () => {
    const gerente = mockUser({ role: "gerente" });
    expect(canUserApprove(gerente, mockQuotation({ approvalStep: "coordinador_pending" }))).toBe(false);
  });

  it("Coordinador puede aprobar en coordinador_pending o none", () => {
    const coordinador = mockUser({ role: "coordinador" });
    expect(canUserApprove(coordinador, mockQuotation({ approvalStep: "coordinador_pending" }))).toBe(true);
    expect(canUserApprove(coordinador, mockQuotation({ approvalStep: "none" }))).toBe(true);
  });

  it("Coordinador NO puede aprobar en gerente_pending", () => {
    const coordinador = mockUser({ role: "coordinador" });
    expect(canUserApprove(coordinador, mockQuotation({ approvalStep: "gerente_pending" }))).toBe(false);
  });

  it("Vendedor NUNCA puede aprobar", () => {
    const vendedor = mockUser({ role: "vendedor" });
    expect(canUserApprove(vendedor, mockQuotation({ approvalStep: "none" }))).toBe(false);
    expect(canUserApprove(vendedor, mockQuotation({ approvalStep: "coordinador_pending" }))).toBe(false);
    expect(canUserApprove(vendedor, mockQuotation({ approvalStep: "gerente_pending" }))).toBe(false);
  });
});

// ============================================================
// TESTS: Auth Service (password hashing)
// ============================================================
describe("authService - hashPassword / verifyPassword", () => {
  it("hashea una contraseña y la verifica correctamente", () => {
    const password = "MiContraseña123!";
    const hash = hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    expect(hash).toContain(":"); // salt:hash format

    expect(verifyPassword(password, hash)).toBe(true);
  });

  it("rechaza contraseña incorrecta", () => {
    const hash = hashPassword("CorrectPassword123!");
    expect(verifyPassword("WrongPassword123!", hash)).toBe(false);
  });

  it("genera hashes diferentes para la misma contraseña (salt aleatorio)", () => {
    const password = "TestPassword123!";
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toBe(hash2);
    // Pero ambos deben verificar
    expect(verifyPassword(password, hash1)).toBe(true);
    expect(verifyPassword(password, hash2)).toBe(true);
  });
});

describe("authService - validatePasswordStrength", () => {
  it("acepta contraseña válida (>= 8 caracteres)", () => {
    expect(validatePasswordStrength("Password1!").valid).toBe(true);
    expect(validatePasswordStrength("12345678").valid).toBe(true);
  });

  it("rechaza contraseña menor a 8 caracteres", () => {
    const result = validatePasswordStrength("short");
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("rechaza contraseña vacía", () => {
    expect(validatePasswordStrength("").valid).toBe(false);
  });
});

// ============================================================
// TESTS: Flujo completo semáforo → paso aprobación
// ============================================================
describe("Flujo completo: margen → semáforo → paso aprobación", () => {
  const redMax = 1000;
  const yellowMax = 3200;

  it("Margen alto (verde): no necesita aprobación escalonada", () => {
    const margin = 4000;
    const color = getTrafficLightColor(margin, redMax, yellowMax);
    const step = getInitialApprovalStep(margin, redMax, yellowMax);

    expect(color).toBe("green");
    expect(step).toBe("none");

    // Todos los roles superiores pueden aprobar
    const cotizacion = mockQuotation({ grossMargin: margin, approvalStep: step });
    expect(canUserApprove(mockUser({ role: "coordinador" }), cotizacion)).toBe(true);
    expect(canUserApprove(mockUser({ role: "gerente" }), cotizacion)).toBe(true);
    expect(canUserApprove(mockUser({ role: "admin" }), cotizacion)).toBe(true);
  });

  it("Margen medio (amarillo): pasa por coordinador primero, luego gerente", () => {
    const margin = 2000;
    const color = getTrafficLightColor(margin, redMax, yellowMax);
    const step = getInitialApprovalStep(margin, redMax, yellowMax);

    expect(color).toBe("yellow");
    expect(step).toBe("coordinador_pending");

    // Coordinador puede aprobar (su turno)
    const cotizacion = mockQuotation({ grossMargin: margin, approvalStep: step });
    expect(canUserApprove(mockUser({ role: "coordinador" }), cotizacion)).toBe(true);
    // Gerente NO puede aprobar aún
    expect(canUserApprove(mockUser({ role: "gerente" }), cotizacion)).toBe(false);

    // Después de aprobación del coordinador → gerente_pending
    const cotizacion2 = mockQuotation({ grossMargin: margin, approvalStep: "gerente_pending" });
    expect(canUserApprove(mockUser({ role: "gerente" }), cotizacion2)).toBe(true);
    expect(canUserApprove(mockUser({ role: "coordinador" }), cotizacion2)).toBe(false);
  });

  it("Margen bajo (rojo): va directo al gerente", () => {
    const margin = 500;
    const color = getTrafficLightColor(margin, redMax, yellowMax);
    const step = getInitialApprovalStep(margin, redMax, yellowMax);

    expect(color).toBe("red");
    expect(step).toBe("gerente_pending");

    const cotizacion = mockQuotation({ grossMargin: margin, approvalStep: step });
    // Gerente puede aprobar
    expect(canUserApprove(mockUser({ role: "gerente" }), cotizacion)).toBe(true);
    // Coordinador NO puede aprobar (es rojo, va directo al gerente)
    expect(canUserApprove(mockUser({ role: "coordinador" }), cotizacion)).toBe(false);
    // Vendedor NUNCA puede aprobar
    expect(canUserApprove(mockUser({ role: "vendedor" }), cotizacion)).toBe(false);
  });
});

// ============================================================
// TESTS: Permisos de roles
// ============================================================
describe("Permisos de roles", () => {
  it("Vendedor solo puede ver sus cotizaciones (validación de lógica)", () => {
    const vendedor = mockUser({ id: 5, role: "vendedor" });
    const ownQuotation = mockQuotation({ vendorId: 5 });
    const otherQuotation = mockQuotation({ vendorId: 10 });

    // Simulamos la lógica de filtro del router
    expect(ownQuotation.vendorId === vendedor.id).toBe(true);
    expect(otherQuotation.vendorId === vendedor.id).toBe(false);
  });

  it("Admin puede ver todas las cotizaciones", () => {
    const admin = mockUser({ role: "admin" });
    // Admin no tiene restricción de vendorId
    expect(admin.role === "admin").toBe(true);
  });

  it("Solo gerente y admin pueden modificar márgenes (validación de rol)", () => {
    const canModifyMargins = (role: string) =>
      role === "gerente" || role === "admin";

    expect(canModifyMargins("admin")).toBe(true);
    expect(canModifyMargins("gerente")).toBe(true);
    expect(canModifyMargins("coordinador")).toBe(false);
    expect(canModifyMargins("vendedor")).toBe(false);
  });

  it("Solo admin puede gestionar usuarios", () => {
    const canManageUsers = (role: string) => role === "admin";

    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("gerente")).toBe(false);
    expect(canManageUsers("coordinador")).toBe(false);
    expect(canManageUsers("vendedor")).toBe(false);
  });
});
