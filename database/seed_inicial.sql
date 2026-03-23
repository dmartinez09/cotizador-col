-- ============================================================
-- Point Colombia — Sistema de Cotizaciones
-- Seed Inicial: Datos Base para Arranque de Producción
-- ============================================================
-- Versión:      4.1
-- Requisito:    Ejecutar schema_completo.sql ANTES de este archivo.
-- ============================================================
--
-- IMPORTANTE — CONTRASEÑAS:
-- Este proyecto usa Node.js crypto scrypt para hashear contraseñas.
-- El formato es: salt_hex:hash_hex (64 bytes salt + 128 bytes hash).
-- NO es posible generar hashes scrypt válidos en SQL puro.
--
-- FLUJO CORRECTO:
--   1. Importar schema_completo.sql (estructura)
--   2. Importar seed_inicial.sql    (datos base con passwordHash = NULL)
--   3. Ejecutar el seed de Node.js para establecer contraseñas:
--
--      npx tsx server/seed.ts
--
--      Esto detectará los usuarios existentes y les asignará el hash correcto.
--      Contraseña por defecto para TODOS los usuarios: Point2026!
--      (configurable via ADMIN_PASSWORD para el admin)
--
-- ALTERNATIVA — Generar hash manualmente:
--   node -e "const {randomBytes,scryptSync}=require('crypto'); \
--     const s=randomBytes(32); \
--     const h=scryptSync('Point2026!',s,64,{N:16384,r:8,p:1}); \
--     console.log(s.toString('hex')+':'+h.toString('hex'))"
--
--   Luego: UPDATE users SET passwordHash='<hash_generado>'
--          WHERE email='admin@pointcolombia.com';
--
-- ============================================================

USE `cotizador_colombia`;

-- ============================================================
-- 1. USUARIO ADMINISTRADOR INICIAL
-- ============================================================
-- passwordHash = NULL → debe completarse con `npx tsx server/seed.ts`
-- o con el comando node mostrado arriba.
-- Contraseña: Point2026!
INSERT INTO `users`
  (`openId`, `name`, `email`, `passwordHash`, `loginMethod`, `role`, `isActive`)
VALUES
  ('local_admin@pointcolombia.com', 'Administrador Point Colombia', 'admin@pointcolombia.com', NULL, 'local', 'admin', 1)
ON DUPLICATE KEY UPDATE `role` = 'admin', `isActive` = 1;

-- ============================================================
-- 2. USUARIOS DE EJEMPLO (opcionales — eliminar en producción real)
-- ============================================================
-- Todos con passwordHash = NULL → se establece con seed.ts
-- Contraseña por defecto del seed.ts: Point2026!
INSERT INTO `users`
  (`openId`, `name`, `email`, `passwordHash`, `loginMethod`, `role`, `isActive`)
VALUES
  ('local_gerente@pointcolombia.com', 'Gerente General', 'gerente@pointcolombia.com', NULL, 'local', 'gerente', 1),
  ('local_coordinadora@pointcolombia.com', 'Coordinadora Comercial', 'coordinadora@pointcolombia.com', NULL, 'local', 'coordinador', 1),
  ('local_vendedor1@pointcolombia.com', 'Vendedor 1', 'vendedor1@pointcolombia.com', NULL, 'local', 'vendedor', 1),
  ('local_vendedor2@pointcolombia.com', 'Vendedor 2', 'vendedor2@pointcolombia.com', NULL, 'local', 'vendedor', 1),
  ('local_vendedor3@pointcolombia.com', 'Vendedor 3', 'vendedor3@pointcolombia.com', NULL, 'local', 'vendedor', 1)
ON DUPLICATE KEY UPDATE `isActive` = 1;

-- ============================================================
-- 3. CONFIGURACIÓN DE MÁRGENES (semáforo)
-- ============================================================
-- Rojo:     grossMargin < 1000  (< 10.00%)
-- Amarillo: 1000 <= grossMargin < 3200  (10.00% - 31.99%)
-- Verde:    grossMargin >= 3200  (>= 32.00%)
INSERT INTO `marginSettings` (`redMax`, `yellowMax`, `tolerance`)
VALUES (1000, 3200, 200);

-- ============================================================
-- 4. CATÁLOGO DE PRODUCTOS
-- ============================================================
-- Productos reales de industria química alimentaria.
-- Precios en COP (pesos colombianos), valores enteros.
INSERT INTO `products` (`description`, `category`, `presentation`, `cost`, `price`, `stock`) VALUES
('ACIDO CITRICO MONOHIDRATADO',          'ACIDULANTES',     '25 KG',  105000,  160000,  100),
('ACIDO LACTICO 80%',                    'ACIDULANTES',     '25 KG',  145000,  220000,  100),
('ACIDO SORBICO',                        'CONSERVANTES',    '25 KG',  380000,  560000,  100),
('ASCORBATO DE SODIO',                   'ANTIOXIDANTES',   '25 KG',  290000,  430000,  100),
('BENZOATO DE SODIO',                    'CONSERVANTES',    '25 KG',   95000,  145000,  100),
('BICARBONATO DE SODIO',                 'LEUDANTES',       '25 KG',   55000,   85000,  100),
('CARRAGENINA KAPPA',                    'HIDROCOLOIDES',   '25 KG',  850000, 1250000,   50),
('CARRAGENINA LAMBDA',                   'HIDROCOLOIDES',   '25 KG',  920000, 1380000,   50),
('CITRATO DE SODIO',                     'ACIDULANTES',     '25 KG',  185000,  275000,  100),
('COLORANTE AMARILLO #5 (TARTRAZINA)',   'COLORANTES',      '1 KG',    45000,   68000,  200),
('COLORANTE AMARILLO #6 (SUNSET)',       'COLORANTES',      '1 KG',    48000,   72000,  200),
('COLORANTE AZUL #1 (BRILLANTE)',        'COLORANTES',      '1 KG',    52000,   78000,  200),
('COLORANTE ROJO #40 (ALLURA)',          'COLORANTES',      '1 KG',    50000,   75000,  200),
('DEXTROSA ANHIDRA',                     'EDULCORANTES',    '25 KG',   78000,  118000,  100),
('ERITORBATO DE SODIO',                  'ANTIOXIDANTES',   '25 KG',  195000,  290000,  100),
('FOSFATO DICALCICO',                    'FOSFATOS',        '25 KG',  125000,  188000,  100),
('FOSFATO MONOBASICO DE SODIO',          'FOSFATOS',        '25 KG',  145000,  218000,  100),
('FOSFATO TRIBASICO DE SODIO',           'FOSFATOS',        '25 KG',  165000,  248000,  100),
('GOMA GUAR',                            'HIDROCOLOIDES',   '25 KG',  420000,  630000,   50),
('GOMA XANTANA',                         'HIDROCOLOIDES',   '1 KG',    38000,   57000,  200),
('LECITINA DE SOYA',                     'EMULSIFICANTES',  '25 KG',  185000,  278000,  100),
('MALTODEXTRINA DE MAIZ',                'CARBOHIDRATOS',   '25 KG',   72000,  108000,  100),
('METABISULFITO DE SODIO',               'CONSERVANTES',    '25 KG',   88000,  132000,  100),
('NITRATO DE SODIO',                     'CONSERVANTES',    '25 KG',  145000,  218000,  100),
('NITRITO DE SODIO',                     'CONSERVANTES',    '1 KG',    18000,   27000,  500),
('PECTINA CITRICA',                      'HIDROCOLOIDES',   '1 KG',    42000,   63000,  200),
('PIROFOSFATO DE SODIO',                 'FOSFATOS',        '25 KG',  195000,  293000,  100),
('POLIFOSFATO DE SODIO',                 'FOSFATOS',        '25 KG',  215000,  323000,  100),
('PROPIONATO DE CALCIO',                 'CONSERVANTES',    '25 KG',  185000,  278000,  100),
('PROPIONATO DE SODIO',                  'CONSERVANTES',    '25 KG',  175000,  263000,  100),
('SORBATO DE POTASIO',                   'CONSERVANTES',    '25 KG',  285000,  428000,  100),
('STEVIA (REBAUDIOSIDO A 97%)',          'EDULCORANTES',    '1 KG',   185000,  278000,  100),
('SUCRALOSA',                            'EDULCORANTES',    '1 KG',   195000,  293000,  100),
('SULFATO DE CALCIO',                    'REGULADORES',     '25 KG',   65000,   98000,  100),
('TRIPOLIFOSFATO DE SODIO',             'FOSFATOS',        '25 KG',  225000,  338000,  100),
('VITAMINA C (ACIDO ASCORBICO)',         'VITAMINAS',       '25 KG',  285000,  428000,  100),
('VITAMINA E (TOCOFEROL MIXTO)',         'VITAMINAS',       '1 KG',   125000,  188000,  100),
('YODO (YODATO DE POTASIO)',             'MINERALES',       '1 KG',   185000,  278000,  100),
('ZINC (SULFATO DE ZINC)',               'MINERALES',       '25 KG',   95000,  143000,  100),
('CARMIN DE COCHINILLA',                 'COLORANTES',      '1 KG',   285000,  428000,  100),
('CURCUMINA',                            'COLORANTES',      '1 KG',   185000,  278000,  100),
('BETA CAROTENO',                        'COLORANTES',      '1 KG',   225000,  338000,  100);

-- ============================================================
-- 5. CATÁLOGO DE CLIENTES
-- ============================================================
INSERT INTO `clients` (`name`, `zone`) VALUES
('ALIMENTOS LA ESPECIAL S.A.S',           'BOGOTA'),
('INDUSTRIAS ALIMENTICIAS NOEL',          'MEDELLIN'),
('PROCESADORA DE ALIMENTOS DEL CARIBE',   'BARRANQUILLA'),
('CARNES Y DERIVADOS DEL VALLE',          'CALI'),
('LACTEOS SAN MARTIN S.A.S',              'BOGOTA'),
('PANADERIA INDUSTRIAL EL TRIGO',         'MEDELLIN'),
('CONSERVAS Y MERMELADAS DEL PACIFICO',   'CALI'),
('DISTRIBUIDORA ALIMENTARIA DEL NORTE',   'BARRANQUILLA'),
('EMBUTIDOS Y CARNES FINAS LTDA',         'BOGOTA'),
('BEBIDAS Y REFRESCOS TROPICALES',        'CALI'),
('INDUSTRIA PANIFICADORA CENTRAL',        'BOGOTA'),
('ALIMENTOS FUNCIONALES S.A',             'MEDELLIN'),
('PROCESADORA CARNICA DEL EJE',           'MANIZALES'),
('LACTEOS Y DERIVADOS DEL ORIENTE',       'BUCARAMANGA'),
('CONFITERIA Y DULCES NACIONALES',        'BOGOTA'),
('SNACKS Y APERITIVOS COLOMBIANOS',       'MEDELLIN'),
('CONSERVAS ARTESANALES DEL SUR',         'PASTO'),
('INDUSTRIA HARINERA SANTANDEREANA',      'BUCARAMANGA'),
('ALIMENTOS PARA MASCOTAS PETFOOD',       'BOGOTA'),
('SUPLEMENTOS NUTRICIONALES ANDINOS',     'MEDELLIN');

-- ============================================================
-- FIN — seed_inicial.sql v4.1
-- Usuarios: 6 (1 admin + 5 ejemplo) — Contraseña: Point2026!
-- Productos: 42
-- Clientes: 20
-- Configuración de márgenes: 1 registro
-- ============================================================
--
-- PASO SIGUIENTE OBLIGATORIO:
--   npx tsx server/seed.ts
--
-- Esto hasheará las contraseñas con scrypt (Point2026! para todos)
-- y dejará el sistema listo para login local.
-- ============================================================
