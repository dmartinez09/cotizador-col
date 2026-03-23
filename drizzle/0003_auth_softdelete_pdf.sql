-- ============================================================
-- Migración 0003: Auth local, soft delete, documentos PDF
-- ============================================================

-- 1. Agregar campo passwordHash a users (para auth local)
ALTER TABLE `users` ADD COLUMN `passwordHash` VARCHAR(255) NULL AFTER `email`;

-- 2. Agregar campo isActive (soft delete) a users
ALTER TABLE `users` ADD COLUMN `isActive` INT NOT NULL DEFAULT 1 AFTER `role`;

-- 3. Agregar campo isActive (soft delete) a products
ALTER TABLE `products` ADD COLUMN `isActive` INT NOT NULL DEFAULT 1 AFTER `stock`;

-- 4. Agregar campo isActive (soft delete) a clients
ALTER TABLE `clients` ADD COLUMN `isActive` INT NOT NULL DEFAULT 1 AFTER `zone`;

-- 5. Agregar campo isActive (soft delete) a quotations
ALTER TABLE `quotations` ADD COLUMN `isActive` INT NOT NULL DEFAULT 1 AFTER `approvedBy`;

-- 6. Marcar todos los registros existentes como activos
UPDATE `users` SET `isActive` = 1 WHERE `isActive` IS NULL OR `isActive` != 1;
UPDATE `products` SET `isActive` = 1 WHERE `isActive` IS NULL OR `isActive` != 1;
UPDATE `clients` SET `isActive` = 1 WHERE `isActive` IS NULL OR `isActive` != 1;
UPDATE `quotations` SET `isActive` = 1 WHERE `isActive` IS NULL OR `isActive` != 1;

-- 7. Crear tabla de documentos PDF
CREATE TABLE IF NOT EXISTS `pdfDocuments` (
  `id`           INT AUTO_INCREMENT NOT NULL,
  `quotationId`  INT NOT NULL,
  `generatedBy`  INT NOT NULL,
  `fileName`     VARCHAR(255) NOT NULL,
  `blobUrl`      TEXT,
  `blobKey`      VARCHAR(500),
  `fileSize`     INT,
  `version`      INT NOT NULL DEFAULT 1,
  `createdAt`    TIMESTAMP NOT NULL DEFAULT (NOW()),
  CONSTRAINT `pdfDocuments_id` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Índices para rendimiento
CREATE INDEX `idx_users_email` ON `users` (`email`);
CREATE INDEX `idx_users_isActive` ON `users` (`isActive`);
CREATE INDEX `idx_products_isActive` ON `products` (`isActive`);
CREATE INDEX `idx_clients_isActive` ON `clients` (`isActive`);
CREATE INDEX `idx_quotations_isActive` ON `quotations` (`isActive`);
CREATE INDEX `idx_quotations_vendorId` ON `quotations` (`vendorId`);
CREATE INDEX `idx_quotations_clientId` ON `quotations` (`clientId`);
CREATE INDEX `idx_quotations_status` ON `quotations` (`status`);
CREATE INDEX `idx_pdfDocuments_quotationId` ON `pdfDocuments` (`quotationId`);
CREATE INDEX `idx_approvalHistory_quotationId` ON `approvalHistory` (`quotationId`);
CREATE INDEX `idx_auditLog_entity` ON `auditLog` (`entity`, `entityId`);
CREATE INDEX `idx_auditLog_userId` ON `auditLog` (`userId`);

-- ============================================================
-- FIN DE MIGRACIÓN 0003
-- ============================================================
