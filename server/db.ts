import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  products, clients, quotations, quotationItems,
  marginSettings, approvalHistory, auditLog, pdfDocuments,
  InsertProduct, InsertClient, InsertQuotation, InsertQuotationItem,
  InsertMarginSettings, InsertApprovalHistory, InsertAuditLog, InsertPdfDocument,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Helper: get raw drizzle instance for transactions
export async function getDbRaw() {
  return getDb();
}

// ===== USERS =====
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.openId, openId), eq(users.isActive, 1))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, 1))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(and(eq(users.id, id), eq(users.isActive, 1))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(eq(users.isActive, 1));
}

export async function updateUserRole(id: number, role: "vendedor" | "coordinador" | "gerente" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function softDeleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ isActive: 0 }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  return softDeleteUser(id);
}

export async function updateUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// ===== PRODUCTS =====
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(products).where(eq(products.isActive, 1));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(and(eq(products.id, id), eq(products.isActive, 1))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(products).values(product);
}

export async function updateProduct(id: number, product: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(product).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set({ isActive: 0 }).where(eq(products.id, id));
}

export async function bulkInsertProducts(productList: InsertProduct[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (productList.length === 0) return;
  await db.insert(products).values(productList);
}

// ===== CLIENTS =====
export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(clients).where(eq(clients.isActive, 1));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.isActive, 1))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(clients).values(client);
}

export async function updateClient(id: number, client: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set(client).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(clients).set({ isActive: 0 }).where(eq(clients.id, id));
}

export async function bulkInsertClients(clientList: InsertClient[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (clientList.length === 0) return;
  await db.insert(clients).values(clientList);
}

// ===== QUOTATIONS =====
export async function getAllQuotations() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quotations).where(eq(quotations.isActive, 1)).orderBy(desc(quotations.createdAt));
}

export async function getQuotationsByVendor(vendorId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quotations)
    .where(and(eq(quotations.vendorId, vendorId), eq(quotations.isActive, 1)))
    .orderBy(desc(quotations.createdAt));
}

export async function getQuotationsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quotations)
    .where(and(eq(quotations.clientId, clientId), eq(quotations.isActive, 1)))
    .orderBy(desc(quotations.createdAt));
}

export async function getQuotationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(quotations).where(and(eq(quotations.id, id), eq(quotations.isActive, 1))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createQuotation(quotation: InsertQuotation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(quotations).values(quotation);
}

export async function updateQuotation(id: number, quotation: Partial<InsertQuotation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quotations).set(quotation).where(eq(quotations.id, id));
}

export async function softDeleteQuotation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(quotations).set({ isActive: 0 }).where(eq(quotations.id, id));
}

export async function deleteQuotation(id: number) {
  return softDeleteQuotation(id);
}

// ===== QUOTATION ITEMS =====
export async function getQuotationItems(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(quotationItems).where(eq(quotationItems.quotationId, quotationId));
}

export async function createQuotationItem(item: InsertQuotationItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(quotationItems).values(item);
}

export async function bulkInsertQuotationItems(items: InsertQuotationItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (items.length === 0) return;
  await db.insert(quotationItems).values(items);
}

export async function deleteQuotationItems(quotationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));
}

// ===== MARGIN SETTINGS =====
export async function getMarginSettings() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(marginSettings).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertMarginSettings(settings: { redMax: number; yellowMax: number; tolerance: number; updatedBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getMarginSettings();
  if (existing) {
    await db.update(marginSettings).set(settings).where(eq(marginSettings.id, existing.id));
  } else {
    await db.insert(marginSettings).values(settings);
  }
}

// ===== APPROVAL HISTORY =====
export async function getApprovalHistory(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(approvalHistory)
    .where(eq(approvalHistory.quotationId, quotationId))
    .orderBy(desc(approvalHistory.createdAt));
}

export async function createApprovalRecord(record: InsertApprovalHistory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(approvalHistory).values(record);
}

// ===== AUDIT LOG =====
export async function getAuditLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

export async function getAuditLogsByEntity(entity: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLog)
    .where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))
    .orderBy(desc(auditLog.createdAt));
}

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLog).values(log);
  } catch (error) {
    console.error("[Audit] Failed to create audit log:", error);
  }
}

// ===== PDF DOCUMENTS =====
export async function createPdfDocument(doc: InsertPdfDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pdfDocuments).values(doc);
  return result;
}

export async function getPdfDocumentsByQuotation(quotationId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(pdfDocuments)
    .where(eq(pdfDocuments.quotationId, quotationId))
    .orderBy(desc(pdfDocuments.createdAt));
}

export async function getPdfDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pdfDocuments).where(eq(pdfDocuments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
