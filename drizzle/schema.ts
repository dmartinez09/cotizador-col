import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// ===== USERS =====
// CORRECCIÓN: Volvemos a usar 'email' en lugar de 'username' para que 
// coincida exactamente con las columnas que existen en la BD de Azure.
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique().notNull(), // ¡Aquí está la pieza clave!
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["vendedor", "coordinador", "gerente", "admin"]).default("vendedor").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ===== PRODUCTS =====
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  description: text("description").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  presentation: varchar("presentation", { length: 50 }).notNull(),
  cost: int("cost").notNull(),
  price: int("price").notNull(),
  stock: int("stock").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ===== CLIENTS =====
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: text("name").notNull(),
  zone: varchar("zone", { length: 100 }).notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ===== QUOTATIONS =====
export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  vendorId: int("vendorId").notNull(),
  subtotal: int("subtotal").notNull(),
  iva: int("iva").notNull(),
  total: int("total").notNull(),
  totalCost: int("totalCost").notNull(),
  grossProfit: int("grossProfit").notNull(),
  grossMargin: int("grossMargin").notNull(),
  status: mysqlEnum("status", ["pendiente", "aprobada", "rechazada"]).default("pendiente").notNull(),
  approvalStep: mysqlEnum("approvalStep", ["none", "coordinador_pending", "gerente_pending", "completed"]).default("none").notNull(),
  approvedBy: int("approvedBy"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

// ===== QUOTATION ITEMS =====
export const quotationItems = mysqlTable("quotationItems", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  productId: int("productId").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(),
  unitCost: int("unitCost").notNull(),
  isBonus: int("isBonus").default(0).notNull(),
  subtotal: int("subtotal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;

// ===== MARGIN SETTINGS =====
export const marginSettings = mysqlTable("marginSettings", {
  id: int("id").autoincrement().primaryKey(),
  redMax: int("redMax").notNull().default(1000),
  yellowMax: int("yellowMax").notNull().default(3200),
  tolerance: int("tolerance").notNull().default(200),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MarginSettings = typeof marginSettings.$inferSelect;
export type InsertMarginSettings = typeof marginSettings.$inferInsert;

// ===== APPROVAL HISTORY =====
export const approvalHistory = mysqlTable("approvalHistory", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  userId: int("userId").notNull(),
  action: mysqlEnum("action", ["aprobada", "rechazada"]).notNull(),
  step: varchar("step", { length: 50 }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalHistory = typeof approvalHistory.$inferSelect;
export type InsertApprovalHistory = typeof approvalHistory.$inferInsert;

// ===== AUDIT LOG =====
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  entity: varchar("entity", { length: 50 }).notNull(),
  entityId: int("entityId"),
  action: varchar("action", { length: 50 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

// ===== PDF DOCUMENTS =====
export const pdfDocuments = mysqlTable("pdfDocuments", {
  id: int("id").autoincrement().primaryKey(),
  quotationId: int("quotationId").notNull(),
  generatedBy: int("generatedBy").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  blobUrl: text("blobUrl"),
  blobKey: varchar("blobKey", { length: 500 }),
  fileSize: int("fileSize"),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PdfDocument = typeof pdfDocuments.$inferSelect;
export type InsertPdfDocument = typeof pdfDocuments.$inferInsert;
