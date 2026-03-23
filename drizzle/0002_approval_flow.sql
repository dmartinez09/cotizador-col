-- ============================================================
-- Migración 0002: Flujo de aprobación escalonado, márgenes, auditoría
-- ============================================================

-- 1. Agregar rol 'gerente' al enum de roles de usuarios
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('vendedor','coordinador','gerente','admin') NOT NULL DEFAULT 'vendedor';

-- 2. Agregar campo approvalStep a cotizaciones
ALTER TABLE `quotations` ADD COLUMN `approvalStep` ENUM('none','coordinador_pending','gerente_pending','completed') NOT NULL DEFAULT 'none' AFTER `status`;

-- 3. Actualizar cotizaciones existentes: las pendientes con margen amarillo quedan como coordinador_pending
-- Las pendientes con margen rojo quedan como gerente_pending
-- Las ya aprobadas/rechazadas quedan como completed
UPDATE `quotations` SET `approvalStep` = 'completed' WHERE `status` IN ('aprobada', 'rechazada');
UPDATE `quotations` SET `approvalStep` = 'coordinador_pending' WHERE `status` = 'pendiente' AND `grossMargin` >= 1000 AND `grossMargin` < 3200;
UPDATE `quotations` SET `approvalStep` = 'gerente_pending' WHERE `status` = 'pendiente' AND `grossMargin` < 1000;

-- 4. Crear tabla de configuración de márgenes
CREATE TABLE IF NOT EXISTS `marginSettings` (
  `id`         INT AUTO_INCREMENT NOT NULL,
  `redMax`     INT NOT NULL DEFAULT 1000,
  `yellowMax`  INT NOT NULL DEFAULT 3200,
  `tolerance`  INT NOT NULL DEFAULT 200,
  `updatedBy`  INT,
  `createdAt`  TIMESTAMP NOT NULL DEFAULT (NOW()),
  `updatedAt`  TIMESTAMP NOT NULL DEFAULT (NOW()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `marginSettings_id` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuración por defecto
INSERT INTO `marginSettings` (`redMax`, `yellowMax`, `tolerance`) VALUES (1000, 3200, 200);

-- 5. Crear tabla de historial de aprobaciones
CREATE TABLE IF NOT EXISTS `approvalHistory` (
  `id`           INT AUTO_INCREMENT NOT NULL,
  `quotationId`  INT NOT NULL,
  `userId`       INT NOT NULL,
  `action`       ENUM('aprobada','rechazada') NOT NULL,
  `step`         VARCHAR(50) NOT NULL,
  `comment`      TEXT,
  `createdAt`    TIMESTAMP NOT NULL DEFAULT (NOW()),
  CONSTRAINT `approvalHistory_id` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS `auditLog` (
  `id`        INT AUTO_INCREMENT NOT NULL,
  `userId`    INT NOT NULL,
  `entity`    VARCHAR(50) NOT NULL,
  `entityId`  INT,
  `action`    VARCHAR(50) NOT NULL,
  `details`   TEXT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT (NOW()),
  CONSTRAINT `auditLog_id` PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FIN DE MIGRACIÓN 0002
-- ============================================================
