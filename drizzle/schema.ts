import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

// ===== USERS =====
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // Removido el .notNull() para permitir usuarios locales
  name: text("name"),
  username: varchar("username", { length: 255 }).unique().notNull(), // Cambiado de 'email' a 'username'
  passwordHash: varchar("passwordHash", { length: 255 }), // bcrypt/scrypt hash
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["vendedor", "coordinador", "gerente", "admin"]).default("vendedor").notNull(),
  isActive: int("isActive").default(1).notNull(), // soft delete: 1=active, 0=deleted
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
  id: int("id").autoincrement().primaryKey
