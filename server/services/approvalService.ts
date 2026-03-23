/**
 * Servicio centralizado de aprobación de cotizaciones.
 * Toda la lógica de flujo escalonado está aquí.
 */
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import type { User, Quotation } from "../../drizzle/schema";

export type ApprovalResult = {
  success: boolean;
  finalApproval: boolean;
  message?: string;
};

/**
 * Determina el approvalStep inicial según el margen y los umbrales.
 */
export function getInitialApprovalStep(
  grossMargin: number,
  redMax: number,
  yellowMax: number
): "none" | "coordinador_pending" | "gerente_pending" {
  if (grossMargin >= yellowMax) return "none";
  if (grossMargin >= redMax) return "coordinador_pending";
  return "gerente_pending";
}

/**
 * Determina el color del semáforo para una cotización.
 */
export function getTrafficLightColor(
  grossMargin: number,
  redMax: number,
  yellowMax: number
): "green" | "yellow" | "red" {
  if (grossMargin >= yellowMax) return "green";
  if (grossMargin >= redMax) return "yellow";
  return "red";
}

/**
 * Valida y ejecuta la aprobación de una cotización.
 * Maneja el flujo escalonado completo en una transacción.
 */
export async function approveQuotation(
  quotationId: number,
  user: User,
  comment?: string
): Promise<ApprovalResult> {
  const quotation = await db.getQuotationById(quotationId);
  if (!quotation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });
  }

  if (quotation.status !== "pendiente") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden aprobar cotizaciones pendientes" });
  }

  if (quotation.isActive !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cotización inactiva" });
  }

  const role = user.role;

  // Admin: aprueba todo directamente
  if (role === "admin") {
    await finalApprove(quotationId, user.id, "admin", comment, quotation.grossMargin);
    return { success: true, finalApproval: true };
  }

  // Gerente: puede aprobar en gerente_pending o none
  if (role === "gerente") {
    if (quotation.approvalStep === "gerente_pending" || quotation.approvalStep === "none") {
      await finalApprove(quotationId, user.id, "gerente", comment, quotation.grossMargin);
      return { success: true, finalApproval: true };
    }
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Esta cotización debe ser aprobada primero por la Coordinadora Comercial"
    });
  }

  // Coordinador: puede aprobar en coordinador_pending (paso intermedio) o none (verde directo)
  if (role === "coordinador") {
    if (quotation.approvalStep === "none") {
      await finalApprove(quotationId, user.id, "coordinador", comment, quotation.grossMargin);
      return { success: true, finalApproval: true };
    }

    if (quotation.approvalStep === "coordinador_pending") {
      // Paso intermedio: coordinador aprueba, pasa a gerente
      await db.updateQuotation(quotationId, { approvalStep: "gerente_pending" });
      await db.createApprovalRecord({
        quotationId,
        userId: user.id,
        action: "aprobada",
        step: "coordinador",
        comment,
      });
      await db.createAuditLog({
        userId: user.id,
        entity: "quotation",
        entityId: quotationId,
        action: "approve_step",
        details: JSON.stringify({ step: "coordinador", nextStep: "gerente_pending", grossMargin: quotation.grossMargin }),
      });
      return {
        success: true,
        finalApproval: false,
        message: "Aprobada por coordinadora. Pendiente aprobación del Gerente General."
      };
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No tiene permiso para aprobar esta cotización en este paso"
    });
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "Rol sin permisos de aprobación" });
}

/**
 * Rechaza una cotización.
 */
export async function rejectQuotation(
  quotationId: number,
  user: User,
  comment?: string
): Promise<{ success: boolean }> {
  const quotation = await db.getQuotationById(quotationId);
  if (!quotation) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  if (quotation.status !== "pendiente") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden rechazar cotizaciones pendientes" });
  }

  // Coordinador solo puede rechazar si es su turno
  if (user.role === "coordinador" && quotation.approvalStep === "gerente_pending") {
    throw new TRPCError({ code: "FORBIDDEN", message: "No puede rechazar en este paso" });
  }

  // Vendedor no puede rechazar
  if (user.role === "vendedor") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Los vendedores no pueden rechazar cotizaciones" });
  }

  await db.updateQuotation(quotationId, {
    status: "rechazada",
    approvalStep: "completed",
    approvedBy: user.id,
  });
  await db.createApprovalRecord({
    quotationId,
    userId: user.id,
    action: "rechazada",
    step: user.role,
    comment,
  });
  await db.createAuditLog({
    userId: user.id,
    entity: "quotation",
    entityId: quotationId,
    action: "reject",
    details: JSON.stringify({ step: user.role, grossMargin: quotation.grossMargin }),
  });

  return { success: true };
}

/**
 * Aprobación final: marca la cotización como aprobada.
 */
async function finalApprove(
  quotationId: number,
  userId: number,
  step: string,
  comment: string | undefined,
  grossMargin: number
) {
  await db.updateQuotation(quotationId, {
    status: "aprobada",
    approvalStep: "completed",
    approvedBy: userId,
  });
  await db.createApprovalRecord({
    quotationId,
    userId,
    action: "aprobada",
    step,
    comment,
  });
  await db.createAuditLog({
    userId,
    entity: "quotation",
    entityId: quotationId,
    action: "approve",
    details: JSON.stringify({ step, grossMargin }),
  });
}

/**
 * Verifica si un usuario puede aprobar una cotización específica.
 */
export function canUserApprove(user: User, quotation: Quotation): boolean {
  if (quotation.status !== "pendiente") return false;
  if (user.role === "admin") return true;
  if (user.role === "gerente") {
    return quotation.approvalStep === "gerente_pending" || quotation.approvalStep === "none";
  }
  if (user.role === "coordinador") {
    return quotation.approvalStep === "coordinador_pending" || quotation.approvalStep === "none";
  }
  return false;
}
