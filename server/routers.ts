import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { hashPassword, validatePasswordStrength } from "./services/authService";
import {
  getInitialApprovalStep,
  approveQuotation,
  rejectQuotation,
} from "./services/approvalService";

// ===== MIDDLEWARES DE ROL =====
const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Solo administradores pueden realizar esta acción" });
  }
  return next({ ctx });
});

const gerenteOrAdminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "gerente" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado" });
  }
  return next({ ctx });
});

const coordinadorOrAboveProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "coordinador" && ctx.user.role !== "gerente" && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acceso denegado" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ===== PRODUCTOS =====
  products: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllProducts();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getProductById(input.id);
      }),

    create: adminProcedure
      .input(z.object({
        description: z.string(),
        category: z.string(),
        presentation: z.string(),
        cost: z.number(),
        price: z.number(),
        stock: z.number().default(0),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createProduct(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "product",
          action: "create",
          details: JSON.stringify(input),
        });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        category: z.string().optional(),
        presentation: z.string().optional(),
        cost: z.number().optional(),
        price: z.number().optional(),
        stock: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "product",
          entityId: id,
          action: "update",
          details: JSON.stringify(data),
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteProduct(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "product",
          entityId: input.id,
          action: "delete",
        });
        return { success: true };
      }),

    bulkImport: adminProcedure
      .input(z.array(z.object({
        description: z.string(),
        category: z.string(),
        presentation: z.string(),
        cost: z.number(),
        price: z.number(),
        stock: z.number().default(0),
      })))
      .mutation(async ({ input, ctx }) => {
        await db.bulkInsertProducts(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "product",
          action: "bulk_import",
          details: JSON.stringify({ count: input.length }),
        });
        return { success: true, count: input.length };
      }),
  }),

  // ===== CLIENTES =====
  clients: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllClients();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getClientById(input.id);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string(),
        zone: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createClient(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "client",
          action: "create",
          details: JSON.stringify(input),
        });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        zone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateClient(id, data);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "client",
          entityId: id,
          action: "update",
          details: JSON.stringify(data),
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteClient(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "client",
          entityId: input.id,
          action: "delete",
        });
        return { success: true };
      }),

    bulkImport: adminProcedure
      .input(z.array(z.object({
        name: z.string(),
        zone: z.string(),
      })))
      .mutation(async ({ input, ctx }) => {
        await db.bulkInsertClients(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "client",
          action: "bulk_import",
          details: JSON.stringify({ count: input.length }),
        });
        return { success: true, count: input.length };
      }),
  }),

  // ===== COTIZACIONES =====
  quotations: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "vendedor") {
        return await db.getQuotationsByVendor(ctx.user.id);
      }
      return await db.getAllQuotations();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const quotation = await db.getQuotationById(input.id);
        if (!quotation) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        if (ctx.user.role === "vendedor" && quotation.vendorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return quotation;
      }),

    getItems: protectedProcedure
      .input(z.object({ quotationId: z.number() }))
      .query(async ({ input }) => {
        return await db.getQuotationItems(input.quotationId);
      }),

    byClient: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input, ctx }) => {
        const all = await db.getQuotationsByClient(input.clientId);
        if (ctx.user.role === "vendedor") {
          return all.filter(q => q.vendorId === ctx.user.id);
        }
        return all;
      }),

    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        subtotal: z.number(),
        iva: z.number(),
        total: z.number(),
        totalCost: z.number(),
        grossProfit: z.number(),
        grossMargin: z.number(),
        items: z.array(z.object({
          productId: z.number(),
          quantity: z.number(),
          unitPrice: z.number(),
          unitCost: z.number(),
          isBonus: z.number(),
          subtotal: z.number(),
        })),
      }))
      .mutation(async ({ input, ctx }) => {
        const { items, ...quotationData } = input;
        const settings = await db.getMarginSettings();
        const redMax = settings?.redMax ?? 1000;
        const yellowMax = settings?.yellowMax ?? 3200;
        const approvalStep = getInitialApprovalStep(quotationData.grossMargin, redMax, yellowMax);

        const result = await db.createQuotation({
          ...quotationData,
          vendorId: ctx.user.id,
          approvalStep,
        });

        const quotationId = Number((result as any).insertId);
        const itemsWithQuotationId = items.map(item => ({
          ...item,
          quotationId,
        }));

        await db.bulkInsertQuotationItems(itemsWithQuotationId);

        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "quotation",
          entityId: quotationId,
          action: "create",
          details: JSON.stringify({ clientId: quotationData.clientId, total: quotationData.total, grossMargin: quotationData.grossMargin, approvalStep }),
        });

        return { success: true, quotationId };
      }),

    approve: coordinadorOrAboveProcedure
      .input(z.object({ id: z.number(), comment: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return await approveQuotation(input.id, ctx.user, input.comment);
      }),

    reject: coordinadorOrAboveProcedure
      .input(z.object({ id: z.number(), comment: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        return await rejectQuotation(input.id, ctx.user, input.comment);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const quotation = await db.getQuotationById(input.id);
        if (!quotation) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        if (ctx.user.role !== "admin" && quotation.vendorId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (quotation.status !== "pendiente" && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Solo se pueden eliminar cotizaciones pendientes" });
        }
        await db.softDeleteQuotation(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "quotation",
          entityId: input.id,
          action: "delete",
        });
        return { success: true };
      }),

    approvalHistory: protectedProcedure
      .input(z.object({ quotationId: z.number() }))
      .query(async ({ input }) => {
        return await db.getApprovalHistory(input.quotationId);
      }),

    logPdfAction: protectedProcedure
      .input(z.object({ quotationId: z.number(), action: z.enum(["print", "download"]) }))
      .mutation(async ({ input, ctx }) => {
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "quotation",
          entityId: input.quotationId,
          action: `pdf_${input.action}`,
        });
        return { success: true };
      }),
  }),

  // ===== USUARIOS (CORREGIDO PARA USERNAME) =====
  users: router({
    list: adminProcedure.query(async () => {
      return await db.getAllUsers();
    }),

    listBasic: protectedProcedure.query(async () => {
      const allUsers = await db.getAllUsers();
      return allUsers.map(u => ({ id: u.id, name: u.name, role: u.role }));
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
        username: z.string().min(3, "Usuario inválido"), 
        password: z.string().min(4, "Contraseña muy corta"), 
        role: z.enum(["vendedor", "coordinador", "gerente", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const existing = await db.getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Ya existe un usuario con ese nombre de usuario" });
        }

        const passwordHash = hashPassword(input.password);
        const openId = `local_${input.username}`;

        await db.upsertUser({
          openId,
          name: input.name,
          username: input.username,
          passwordHash,
          role: input.role,
          loginMethod: "local",
        });

        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "user",
          action: "create",
          details: JSON.stringify({ name: input.name, username: input.username, role: input.role }),
        });

        return { success: true };
      }),

    updateRole: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(["vendedor", "coordinador", "gerente", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUserRole(input.id, input.role);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "user",
          entityId: input.id,
          action: "update_role",
          details: JSON.stringify({ newRole: input.role }),
        });
        return { success: true };
      }),

    resetPassword: adminProcedure
      .input(z.object({
        id: z.number(),
        newPassword: z.string().min(4),
      }))
      .mutation(async ({ input, ctx }) => {
        const passwordHash = hashPassword(input.newPassword);
        await db.updateUserPassword(input.id, passwordHash);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "user",
          entityId: input.id,
          action: "reset_password",
        });
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No puede eliminarse a sí mismo" });
        }
        await db.deleteUser(input.id);
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "user",
          entityId: input.id,
          action: "delete",
        });
        return { success: true };
      }),
  }),

  // ===== CONFIGURACIÓN DE MÁRGENES =====
  marginSettings: router({
    get: protectedProcedure.query(async () => {
      const settings = await db.getMarginSettings();
      return settings || { id: 0, redMax: 1000, yellowMax: 3200, tolerance: 200, updatedBy: null, createdAt: new Date(), updatedAt: new Date() };
    }),

    update: gerenteOrAdminProcedure
      .input(z.object({
        redMax: z.number().min(0).max(10000),
        yellowMax: z.number().min(0).max(10000),
        tolerance: z.number().min(0).max(5000),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.redMax >= input.yellowMax) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "El umbral rojo debe ser menor que el amarillo" });
        }
        await db.upsertMarginSettings({
          ...input,
          updatedBy: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          entity: "margin_settings",
          action: "update",
          details: JSON.stringify(input),
        });
        return { success: true };
      }),
  }),

  pdfDocuments: router({
    listByQuotation: protectedProcedure
      .input(z.object({ quotationId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role === "vendedor") {
          const quotation = await db.getQuotationById(input.quotationId);
          if (!quotation || quotation.vendorId !== ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN" });
          }
        }
        return await db.getPdfDocumentsByQuotation(input.quotationId);
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getPdfDocumentById(input.id);
      }),
  }),

  audit: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return await db.getAuditLogs(input?.limit ?? 100);
      }),

    byEntity: adminProcedure
      .input(z.object({ entity: z.string(), entityId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAuditLogsByEntity(input.entity, input.entityId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
