-- ============================================================
-- Point Colombia — Sistema de Cotizaciones
-- Verificación Post-Instalación
-- ============================================================
-- Versión:      1.0
-- Requisito:    Ejecutar DESPUÉS de schema_completo.sql + seed_inicial.sql + seed.ts
-- ============================================================
--
-- Este script ejecuta consultas de verificación y muestra resultados
-- con etiquetas claras. Si todo está correcto verás:
--   ✓ 9 tablas
--   ✓ 11 foreign keys
--   ✓ 1 usuario admin activo con passwordHash
--   ✓ 4 roles distintos asignados
--   ✓ 6 usuarios totales
--   ✓ 42 productos
--   ✓ 20 clientes
--   ✓ 1 configuración de márgenes (1000/3200/200)
--   ✓ 21 índices personalizados
--
-- ============================================================

USE `cotizador_colombia`;

-- ============================================================
-- 1. EXISTENCIA DE TABLAS (esperado: 9)
-- ============================================================
SELECT '== 1. TABLAS ==' AS verificacion;

SELECT
  COUNT(*) AS tablas_encontradas,
  CASE WHEN COUNT(*) = 9 THEN 'OK' ELSE 'ERROR — se esperaban 9 tablas' END AS estado
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'cotizador_colombia'
  AND TABLE_TYPE = 'BASE TABLE';

SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'cotizador_colombia'
  AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- ============================================================
-- 2. FOREIGN KEYS (esperado: 11)
-- ============================================================
SELECT '== 2. FOREIGN KEYS ==' AS verificacion;

SELECT
  COUNT(*) AS fks_encontradas,
  CASE WHEN COUNT(*) = 11 THEN 'OK' ELSE 'ERROR — se esperaban 11 FKs' END AS estado
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'cotizador_colombia'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

SELECT
  CONSTRAINT_NAME,
  TABLE_NAME,
  REFERENCED_TABLE_NAME
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'cotizador_colombia'
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

-- ============================================================
-- 3. ÍNDICES PERSONALIZADOS (esperado: 21 con prefijo idx_)
-- ============================================================
SELECT '== 3. INDICES ==' AS verificacion;

SELECT
  COUNT(DISTINCT INDEX_NAME) AS indices_custom,
  CASE WHEN COUNT(DISTINCT INDEX_NAME) >= 21 THEN 'OK' ELSE 'ADVERTENCIA — se esperaban >= 21 índices idx_' END AS estado
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'cotizador_colombia'
  AND INDEX_NAME LIKE 'idx_%';

-- ============================================================
-- 4. USUARIO ADMIN (esperado: 1 activo con rol admin)
-- ============================================================
SELECT '== 4. USUARIO ADMIN ==' AS verificacion;

SELECT
  id,
  name,
  email,
  role,
  isActive,
  loginMethod,
  CASE
    WHEN passwordHash IS NOT NULL THEN 'HASH PRESENTE'
    ELSE 'SIN HASH — ejecutar: npx tsx server/seed.ts'
  END AS password_status,
  lastSignedIn
FROM `users`
WHERE email = 'admin@pointcolombia.com';

-- ============================================================
-- 5. ROLES ASIGNADOS (esperado: 4 distintos)
-- ============================================================
SELECT '== 5. ROLES ==' AS verificacion;

SELECT
  role,
  COUNT(*) AS usuarios_con_rol,
  SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS activos
FROM `users`
GROUP BY role
ORDER BY FIELD(role, 'admin', 'gerente', 'coordinador', 'vendedor');

SELECT
  COUNT(DISTINCT role) AS roles_distintos,
  CASE WHEN COUNT(DISTINCT role) = 4 THEN 'OK' ELSE 'ADVERTENCIA — se esperaban 4 roles' END AS estado
FROM `users`;

-- ============================================================
-- 6. CONTEO DE USUARIOS (esperado: >= 6)
-- ============================================================
SELECT '== 6. USUARIOS ==' AS verificacion;

SELECT
  COUNT(*) AS total_usuarios,
  SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS activos,
  SUM(CASE WHEN passwordHash IS NOT NULL THEN 1 ELSE 0 END) AS con_password,
  SUM(CASE WHEN passwordHash IS NULL THEN 1 ELSE 0 END) AS sin_password,
  CASE
    WHEN COUNT(*) >= 6 AND SUM(CASE WHEN passwordHash IS NOT NULL THEN 1 ELSE 0 END) >= 6
    THEN 'OK'
    WHEN COUNT(*) >= 6 AND SUM(CASE WHEN passwordHash IS NULL THEN 1 ELSE 0 END) > 0
    THEN 'PARCIAL — ejecutar: npx tsx server/seed.ts para hashear contraseñas'
    WHEN COUNT(*) < 6
    THEN 'ERROR — se esperaban >= 6 usuarios'
    ELSE 'REVISAR'
  END AS estado
FROM `users`;

-- ============================================================
-- 7. PRODUCTOS (esperado: >= 42)
-- ============================================================
SELECT '== 7. PRODUCTOS ==' AS verificacion;

SELECT
  COUNT(*) AS total_productos,
  SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS activos,
  COUNT(DISTINCT category) AS categorias,
  CASE WHEN COUNT(*) >= 42 THEN 'OK' ELSE 'ERROR — se esperaban >= 42 productos' END AS estado
FROM `products`;

-- ============================================================
-- 8. CLIENTES (esperado: >= 20)
-- ============================================================
SELECT '== 8. CLIENTES ==' AS verificacion;

SELECT
  COUNT(*) AS total_clientes,
  SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS activos,
  COUNT(DISTINCT zone) AS zonas,
  CASE WHEN COUNT(*) >= 20 THEN 'OK' ELSE 'ERROR — se esperaban >= 20 clientes' END AS estado
FROM `clients`;

-- ============================================================
-- 9. CONFIGURACIÓN DE MÁRGENES (esperado: 1 registro)
-- ============================================================
SELECT '== 9. MARGENES ==' AS verificacion;

SELECT
  id,
  redMax,
  yellowMax,
  tolerance,
  CASE
    WHEN redMax = 1000 AND yellowMax = 3200 AND tolerance = 200
    THEN 'OK — valores por defecto correctos'
    ELSE 'ADVERTENCIA — valores modificados respecto al seed'
  END AS estado
FROM `marginSettings`
LIMIT 1;

SELECT
  COUNT(*) AS registros_margenes,
  CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'ERROR — se esperaba >= 1 registro' END AS estado
FROM `marginSettings`;

-- ============================================================
-- 10. RESUMEN GENERAL
-- ============================================================
SELECT '== 10. RESUMEN GENERAL ==' AS verificacion;

SELECT
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = 'cotizador_colombia' AND TABLE_TYPE = 'BASE TABLE') AS tablas,
  (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE CONSTRAINT_SCHEMA = 'cotizador_colombia' AND CONSTRAINT_TYPE = 'FOREIGN KEY') AS foreign_keys,
  (SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = 'cotizador_colombia' AND INDEX_NAME LIKE 'idx_%') AS indices_custom,
  (SELECT COUNT(*) FROM `users`) AS usuarios,
  (SELECT COUNT(*) FROM `products`) AS productos,
  (SELECT COUNT(*) FROM `clients`) AS clientes,
  (SELECT COUNT(*) FROM `marginSettings`) AS config_margenes,
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = 'cotizador_colombia' AND TABLE_TYPE = 'BASE TABLE') = 9
     AND (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = 'cotizador_colombia' AND CONSTRAINT_TYPE = 'FOREIGN KEY') = 11
     AND (SELECT COUNT(*) FROM `users`) >= 6
     AND (SELECT COUNT(*) FROM `products`) >= 42
     AND (SELECT COUNT(*) FROM `clients`) >= 20
     AND (SELECT COUNT(*) FROM `marginSettings`) >= 1
    THEN 'INSTALACION CORRECTA'
    ELSE 'HAY PROBLEMAS — revisar secciones anteriores'
  END AS veredicto_final;

-- ============================================================
-- FIN — verify_post_install.sql v1.0
-- ============================================================
