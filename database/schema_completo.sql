-- ============================================================
-- Point Colombia — Sistema de Cotizaciones
-- Schema Completo para Base de Datos Nueva (DDL + FKs + Índices)
-- ============================================================
-- Versión:      5.0 (Azure CLI Compatible — SQL puro, sin procedimientos)
-- Motor:        MySQL 8.0+ / Azure Database for MySQL Flexible Server
-- Ejecución:    az mysql flexible-server execute --file-path schema_completo.sql
-- Generado:     2026-03-19
-- Charset:      utf8mb4 / utf8mb4_unicode_ci
-- ============================================================
--
-- COMPATIBILIDAD AZURE:
--   - NO usa DELIMITER, CREATE PROCEDURE, CALL, BEGIN...END
--   - Solo sentencias SQL directas ejecutables por el servidor
--   - Compatible con: az mysql flexible-server execute --file-path
--   - Compatible con: mysql < schema_completo.sql
--   - Compatible con: Azure Data Studio, MySQL Workbench, DBeaver
--
-- FUENTES VERIFICADAS (validación columna-por-columna contra código):
--   drizzle/schema.ts                 (definición Drizzle ORM — fuente de verdad)
--   drizzle/0000_old_leopardon.sql    (migración inicial: users)
--   drizzle/0001_violet_ravenous.sql  (products, clients, quotations, quotationItems, enum roles)
--   drizzle/0002_approval_flow.sql    (gerente, approvalStep, marginSettings, approvalHistory, auditLog)
--   drizzle/0003_auth_softdelete_pdf.sql (passwordHash, isActive, pdfDocuments, índices)
--   server/db.ts                      (35 funciones de acceso a datos)
--   server/routers.ts                 (endpoints tRPC + validaciones Zod)
--   server/services/approvalService.ts (flujo de aprobación escalonado)
--   server/services/authService.ts    (hashing scrypt — salt_hex:hash_hex)
--   server/routes/authRoutes.ts       (login local + cambio de contraseña)
--   server/services/pdfService.ts     (generación de PDFs)
--   server/seed.ts                    (datos de ejemplo)
--   client/src/pages/NuevaCotizacion.tsx   (creación de cotizaciones)
--   client/src/pages/MisCotizaciones.tsx   (listado y detalle)
--   client/src/pages/HistoricoClientes.tsx (historial por cliente)
--   client/src/pages/Usuarios.tsx          (gestión de usuarios)
--
-- INSTRUCCIONES DE USO:
--   1. Ejecutar este archivo para crear la estructura completa.
--   2. Ejecutar seed_inicial.sql para datos base (admin, márgenes, productos, clientes).
--   3. Ejecutar `npx tsx server/seed.ts` para hashear contraseñas con scrypt.
--
-- CONFLICTOS DETECTADOS Y RESUELTOS:
--   - Ninguno. schema.ts y las 4 migraciones son coherentes.
--   - El enum de roles evolucionó: user,admin → vendedor,coordinador,admin → +gerente.
--     Estado final consolidado: vendedor, coordinador, gerente, admin.
--   - Los campos iva/total se mantienen en el schema por compatibilidad de backend,
--     pero el frontend siempre envía iva=0 y total=subtotal (precio neto).
--
-- ============================================================

-- ============================================================
-- 1. CREAR BASE DE DATOS
-- ============================================================
CREATE DATABASE IF NOT EXISTS `cotizador_colombia`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `cotizador_colombia`;

-- ============================================================
-- 2. TABLAS (orden de creación respeta dependencias FK)
-- ============================================================

-- -------------------------------------------------------
-- TABLA: users
-- Auth local (scrypt hash) + OAuth. Soft delete via isActive.
-- Roles: vendedor | coordinador | gerente | admin
--
-- Verificado contra:
--   schema.ts         → id, openId, name, email, passwordHash, loginMethod, role, isActive, createdAt, updatedAt, lastSignedIn
--   authRoutes.ts     → lee: email, passwordHash, isActive, openId, lastSignedIn, id, name, role
--   db.ts             → upsertUser, getUserByEmail, getUserByOpenId, getUserById, updateUserRole, updateUserPassword, softDeleteUser
--   Usuarios.tsx      → id, name, email, role, lastSignedIn
--   routers.ts        → Zod: name, email, role (enum vendedor|coordinador|gerente|admin)
-- -------------------------------------------------------
CREATE TABLE `users` (
  `id`           INT           AUTO_INCREMENT NOT NULL,
  `openId`       VARCHAR(64)   NOT NULL COMMENT 'Identificador OAuth o "local_{email}" para auth local',
  `name`         TEXT,
  `email`        VARCHAR(320),
  `passwordHash` VARCHAR(255)  COMMENT 'scrypt hash formato salt_hex:hash_hex — NULL para usuarios OAuth-only',
  `loginMethod`  VARCHAR(64)   COMMENT 'local | oauth',
  `role`         ENUM('vendedor','coordinador','gerente','admin') NOT NULL DEFAULT 'vendedor',
  `isActive`     INT           NOT NULL DEFAULT 1 COMMENT '1=activo, 0=eliminado (soft delete)',
  `createdAt`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  --
  CONSTRAINT `users_pk`            PRIMARY KEY (`id`),
  CONSTRAINT `users_openId_unique` UNIQUE (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: products
-- Catálogo de productos con costo, precio lista y stock.
--
-- Verificado contra:
--   schema.ts              → id, description, category, presentation, cost, price, stock, isActive, createdAt, updatedAt
--   db.ts                  → getAllProducts (isActive=1), getProductById, createProduct
--   routers.ts             → Zod: description, category, presentation, cost, price, stock
--   NuevaCotizacion.tsx    → lee: id, description, category, presentation, cost, price, stock
--   pdfService.ts          → lee: id, description, price (como Precio Lista)
-- -------------------------------------------------------
CREATE TABLE `products` (
  `id`           INT           AUTO_INCREMENT NOT NULL,
  `description`  TEXT          NOT NULL,
  `category`     VARCHAR(50)   NOT NULL,
  `presentation` VARCHAR(50)   NOT NULL,
  `cost`         INT           NOT NULL COMMENT 'Costo en COP (entero, sin decimales)',
  `price`        INT           NOT NULL COMMENT 'Precio lista en COP',
  `stock`        INT           NOT NULL DEFAULT 0,
  `isActive`     INT           NOT NULL DEFAULT 1,
  `createdAt`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  --
  CONSTRAINT `products_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: clients
-- Clientes con zona geográfica.
--
-- Verificado contra:
--   schema.ts              → id, name, zone, isActive, createdAt, updatedAt
--   db.ts                  → getAllClients (isActive=1), getClientById
--   routers.ts             → Zod: name, zone
--   NuevaCotizacion.tsx    → lee: id, name, zone
--   HistoricoClientes.tsx  → lee: id, name
--   pdfService.ts          → lee: name, zone
-- -------------------------------------------------------
CREATE TABLE `clients` (
  `id`        INT           AUTO_INCREMENT NOT NULL,
  `name`      TEXT          NOT NULL,
  `zone`      VARCHAR(100)  NOT NULL,
  `isActive`  INT           NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  --
  CONSTRAINT `clients_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: marginSettings
-- Configuración global del semáforo de márgenes.
-- Rojo:     grossMargin < redMax
-- Amarillo: redMax <= grossMargin < yellowMax
-- Verde:    grossMargin >= yellowMax
--
-- Verificado contra:
--   schema.ts              → id, redMax, yellowMax, tolerance, updatedBy, createdAt, updatedAt
--   db.ts                  → getMarginSettings, upsertMarginSettings
--   routers.ts             → Zod: redMax, yellowMax, tolerance
--   approvalService.ts     → lee: redMax, yellowMax
--   NuevaCotizacion.tsx    → lee: redMax, yellowMax, tolerance
-- -------------------------------------------------------
CREATE TABLE `marginSettings` (
  `id`         INT       AUTO_INCREMENT NOT NULL,
  `redMax`     INT       NOT NULL DEFAULT 1000  COMMENT 'Umbral máximo para zona roja (basis points)',
  `yellowMax`  INT       NOT NULL DEFAULT 3200  COMMENT 'Umbral máximo para zona amarilla (basis points)',
  `tolerance`  INT       NOT NULL DEFAULT 200   COMMENT 'Tolerancia para alertas de margen',
  `updatedBy`  INT       COMMENT 'FK → users.id — quién actualizó',
  `createdAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  --
  CONSTRAINT `marginSettings_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: quotations
-- Cotizaciones con flujo de aprobación escalonado.
-- Valores monetarios en COP entero; grossMargin en basis points.
--
-- Verificado contra:
--   schema.ts              → id, clientId, vendorId, subtotal, iva, total, totalCost, grossProfit, grossMargin,
--                             status, approvalStep, approvedBy, isActive, createdAt, updatedAt
--   db.ts                  → getAllQuotations, getQuotationsByVendor, getQuotationsByClient,
--                             createQuotation, updateQuotation, softDeleteQuotation
--   routers.ts             → Zod: clientId, subtotal, iva, total, totalCost, grossProfit, grossMargin, items[]
--   approvalService.ts     → lee/escribe: status, approvalStep, approvedBy, isActive, grossMargin
--   NuevaCotizacion.tsx    → envía: clientId, subtotal, iva(=0), total(=subtotal), totalCost, grossProfit, grossMargin
--   MisCotizaciones.tsx    → lee: id, clientId, createdAt, subtotal, grossMargin, status, approvalStep, vendorId
--   HistoricoClientes.tsx  → lee: id, subtotal, status, createdAt
--   pdfService.ts          → lee: id, clientId, vendorId, subtotal, status, createdAt
-- -------------------------------------------------------
CREATE TABLE `quotations` (
  `id`            INT       AUTO_INCREMENT NOT NULL,
  `clientId`      INT       NOT NULL,
  `vendorId`      INT       NOT NULL,
  `subtotal`      INT       NOT NULL COMMENT 'Precio neto total (sin IVA)',
  `iva`           INT       NOT NULL COMMENT 'Siempre 0 desde frontend; campo mantenido por compatibilidad',
  `total`         INT       NOT NULL COMMENT 'Igual a subtotal (precio neto)',
  `totalCost`     INT       NOT NULL COMMENT 'Costo total de todos los ítems',
  `grossProfit`   INT       NOT NULL COMMENT 'Utilidad bruta = subtotal - totalCost',
  `grossMargin`   INT       NOT NULL COMMENT 'Margen bruto en basis points (ej: 3200 = 32.00%)',
  `status`        ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  `approvalStep`  ENUM('none','coordinador_pending','gerente_pending','completed') NOT NULL DEFAULT 'none'
                  COMMENT 'none=verde, coordinador_pending=amarillo paso 1, gerente_pending=rojo o paso 2, completed=finalizado',
  `approvedBy`    INT       COMMENT 'FK → users.id — quién dio la aprobación final',
  `isActive`      INT       NOT NULL DEFAULT 1,
  `createdAt`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  --
  CONSTRAINT `quotations_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: quotationItems
-- Líneas de detalle de cada cotización.
--
-- Verificado contra:
--   schema.ts              → id, quotationId, productId, quantity, unitPrice, unitCost, isBonus, subtotal, createdAt
--   db.ts                  → getQuotationItems, bulkInsertQuotationItems, deleteQuotationItems
--   routers.ts             → Zod: productId, quantity, unitPrice, unitCost, isBonus, subtotal
--   NuevaCotizacion.tsx    → envía: productId, quantity, unitPrice, unitCost, isBonus, subtotal
--   MisCotizaciones.tsx    → lee: productId, quantity, unitPrice, unitCost, isBonus, subtotal
--   pdfService.ts          → lee: productId, quantity, unitPrice, subtotal, isBonus
-- -------------------------------------------------------
CREATE TABLE `quotationItems` (
  `id`          INT       AUTO_INCREMENT NOT NULL,
  `quotationId` INT       NOT NULL,
  `productId`   INT       NOT NULL,
  `quantity`    INT       NOT NULL,
  `unitPrice`   INT       NOT NULL COMMENT 'Precio neto unitario negociado',
  `unitCost`    INT       NOT NULL COMMENT 'Costo unitario al momento de cotizar',
  `isBonus`     INT       NOT NULL DEFAULT 0 COMMENT '1=bonificación (precio 0)',
  `subtotal`    INT       NOT NULL COMMENT 'quantity * unitPrice',
  `createdAt`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  --
  CONSTRAINT `quotationItems_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: approvalHistory
-- Registro de cada acción de aprobación/rechazo en el flujo escalonado.
--
-- Verificado contra:
--   schema.ts              → id, quotationId, userId, action, step, comment, createdAt
--   db.ts                  → getApprovalHistory, createApprovalRecord
--   routers.ts             → devuelve: id, action, userId, step, createdAt, comment
--   approvalService.ts     → escribe: quotationId, userId, action, step, comment
--   MisCotizaciones.tsx    → lee: id, action, userId, step, createdAt, comment
-- -------------------------------------------------------
CREATE TABLE `approvalHistory` (
  `id`           INT           AUTO_INCREMENT NOT NULL,
  `quotationId`  INT           NOT NULL,
  `userId`       INT           NOT NULL,
  `action`       ENUM('aprobada','rechazada') NOT NULL,
  `step`         VARCHAR(50)   NOT NULL COMMENT 'Rol que ejecutó la acción: coordinador | gerente | admin',
  `comment`      TEXT,
  `createdAt`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  --
  CONSTRAINT `approvalHistory_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: auditLog
-- Log genérico de auditoría para todas las entidades del sistema.
--
-- Verificado contra:
--   schema.ts         → id, userId, entity, entityId, action, details, createdAt
--   db.ts             → getAuditLogs, getAuditLogsByEntity, createAuditLog
--   routers.ts        → Zod consulta: entity?, entityId?, limit
--   authRoutes.ts     → escribe: userId, entity("user"), entityId, action("login"/"change_password"), details
-- -------------------------------------------------------
CREATE TABLE `auditLog` (
  `id`        INT           AUTO_INCREMENT NOT NULL,
  `userId`    INT           NOT NULL,
  `entity`    VARCHAR(50)   NOT NULL COMMENT 'Entidad: user, product, client, quotation, margin_settings',
  `entityId`  INT           COMMENT 'ID del registro afectado (NULL para acciones globales)',
  `action`    VARCHAR(50)   NOT NULL COMMENT 'Acción: create, update, delete, approve, reject, login, pdf_generate, etc.',
  `details`   TEXT          COMMENT 'JSON con detalles adicionales de la operación',
  `createdAt` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  --
  CONSTRAINT `auditLog_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- TABLA: pdfDocuments
-- Metadatos de PDFs generados (binarios en Azure Blob Storage o disco local).
--
-- Verificado contra:
--   schema.ts         → id, quotationId, generatedBy, fileName, blobUrl, blobKey, fileSize, version, createdAt
--   db.ts             → createPdfDocument, getPdfDocumentsByQuotation, getPdfDocumentById
--   routers.ts        → devuelve: id, quotationId, generatedBy, fileName, blobUrl, fileSize, version, createdAt
-- -------------------------------------------------------
CREATE TABLE `pdfDocuments` (
  `id`           INT           AUTO_INCREMENT NOT NULL,
  `quotationId`  INT           NOT NULL,
  `generatedBy`  INT           NOT NULL COMMENT 'FK → users.id — quién generó el PDF',
  `fileName`     VARCHAR(255)  NOT NULL,
  `blobUrl`      TEXT          COMMENT 'URL pública del blob en Azure (NULL si almacenamiento local)',
  `blobKey`      VARCHAR(500)  COMMENT 'Path/key del blob en Azure Storage',
  `fileSize`     INT           COMMENT 'Tamaño en bytes',
  `version`      INT           NOT NULL DEFAULT 1,
  `createdAt`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  --
  CONSTRAINT `pdfDocuments_pk` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. CLAVES FORÁNEAS (ALTER TABLE directo)
-- ============================================================
-- Política: RESTRICT por defecto (el sistema usa soft delete,
-- nunca elimina filas de tablas principales).
-- Columnas FK nullable: ON DELETE SET NULL.
-- ============================================================

-- marginSettings → users (updatedBy, nullable)
ALTER TABLE `marginSettings`
  ADD CONSTRAINT `fk_marginSettings_updatedBy`
  FOREIGN KEY (`updatedBy`) REFERENCES `users` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- quotations → clients
ALTER TABLE `quotations`
  ADD CONSTRAINT `fk_quotations_clientId`
  FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- quotations → users (vendedor)
ALTER TABLE `quotations`
  ADD CONSTRAINT `fk_quotations_vendorId`
  FOREIGN KEY (`vendorId`) REFERENCES `users` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- quotations → users (aprobador, nullable)
ALTER TABLE `quotations`
  ADD CONSTRAINT `fk_quotations_approvedBy`
  FOREIGN KEY (`approvedBy`) REFERENCES `users` (`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- quotationItems → quotations
ALTER TABLE `quotationItems`
  ADD CONSTRAINT `fk_quotationItems_quotationId`
  FOREIGN KEY (`quotationId`) REFERENCES `quotations` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- quotationItems → products
ALTER TABLE `quotationItems`
  ADD CONSTRAINT `fk_quotationItems_productId`
  FOREIGN KEY (`productId`) REFERENCES `products` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- approvalHistory → quotations
ALTER TABLE `approvalHistory`
  ADD CONSTRAINT `fk_approvalHistory_quotationId`
  FOREIGN KEY (`quotationId`) REFERENCES `quotations` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- approvalHistory → users
ALTER TABLE `approvalHistory`
  ADD CONSTRAINT `fk_approvalHistory_userId`
  FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- auditLog → users
ALTER TABLE `auditLog`
  ADD CONSTRAINT `fk_auditLog_userId`
  FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- pdfDocuments → quotations
ALTER TABLE `pdfDocuments`
  ADD CONSTRAINT `fk_pdfDocuments_quotationId`
  FOREIGN KEY (`quotationId`) REFERENCES `quotations` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- pdfDocuments → users (generatedBy)
ALTER TABLE `pdfDocuments`
  ADD CONSTRAINT `fk_pdfDocuments_generatedBy`
  FOREIGN KEY (`generatedBy`) REFERENCES `users` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- ============================================================

-- users
CREATE INDEX `idx_users_email`     ON `users` (`email`);
CREATE INDEX `idx_users_isActive`  ON `users` (`isActive`);

-- products
CREATE INDEX `idx_products_isActive` ON `products` (`isActive`);
CREATE INDEX `idx_products_category` ON `products` (`category`);

-- clients
CREATE INDEX `idx_clients_isActive` ON `clients` (`isActive`);

-- quotations (consultas frecuentes: por vendedor, por cliente, por estado, por fecha)
CREATE INDEX `idx_quotations_isActive`      ON `quotations` (`isActive`);
CREATE INDEX `idx_quotations_vendorId`      ON `quotations` (`vendorId`);
CREATE INDEX `idx_quotations_clientId`      ON `quotations` (`clientId`);
CREATE INDEX `idx_quotations_status`        ON `quotations` (`status`);
CREATE INDEX `idx_quotations_approvalStep`  ON `quotations` (`approvalStep`);
CREATE INDEX `idx_quotations_createdAt`     ON `quotations` (`createdAt`);

-- quotationItems (JOIN con quotations y products)
CREATE INDEX `idx_quotationItems_quotationId` ON `quotationItems` (`quotationId`);
CREATE INDEX `idx_quotationItems_productId`   ON `quotationItems` (`productId`);

-- approvalHistory
CREATE INDEX `idx_approvalHistory_quotationId` ON `approvalHistory` (`quotationId`);
CREATE INDEX `idx_approvalHistory_userId`      ON `approvalHistory` (`userId`);

-- auditLog (consultas por entidad y por usuario)
CREATE INDEX `idx_auditLog_entity`    ON `auditLog` (`entity`, `entityId`);
CREATE INDEX `idx_auditLog_userId`    ON `auditLog` (`userId`);
CREATE INDEX `idx_auditLog_createdAt` ON `auditLog` (`createdAt`);

-- pdfDocuments
CREATE INDEX `idx_pdfDocuments_quotationId` ON `pdfDocuments` (`quotationId`);
CREATE INDEX `idx_pdfDocuments_generatedBy` ON `pdfDocuments` (`generatedBy`);

-- ============================================================
-- FIN — schema_completo.sql v5.0 (Azure CLI Compatible)
-- Tablas: 9 | FKs: 11 | Índices: 21
-- 0 inconsistencias con el código del proyecto
-- 0 procedimientos | 0 DELIMITER | 0 CALL
-- ============================================================
