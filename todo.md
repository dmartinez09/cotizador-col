# Point Colombia - Cotizador TODO (v3.0)

## FASE 1 — CIERRE FUNCIONAL

### Autenticación Real
- [x] Login local con email + contraseña (bcrypt/scrypt, sin deps nativas)
- [x] Rutas Express: POST /api/auth/login, POST /api/auth/change-password
- [x] JWT cookie compartida entre OAuth y auth local
- [x] Página Login.tsx con formulario email/password + OAuth alternativo
- [x] Redirect a /login cuando no autenticado
- [x] useAuth.ts actualizado para redirigir a /login
- [x] Admin puede crear usuarios con contraseña (users.create endpoint)
- [x] Admin puede resetear contraseñas (users.resetPassword endpoint)
- [x] Prevención de auto-eliminación de admin

### Permisos Endurecidos (Backend)
- [x] protectedProcedure, adminProcedure, gerenteOrAdminProcedure, coordinadorOrAboveProcedure
- [x] Vendedores solo ven sus propias cotizaciones
- [x] Vendedores no ven % de margen (solo color semáforo)
- [x] Soft delete: no eliminación física de registros

### Servicio Centralizado de Aprobación
- [x] server/services/approvalService.ts
- [x] getInitialApprovalStep() — determina paso según margen
- [x] getTrafficLightColor() — semáforo verde/amarillo/rojo
- [x] approveQuotation() — lógica escalonada completa
- [x] rejectQuotation() — validación de turno
- [x] canUserApprove() — verificación de permisos
- [x] routers.ts delegando a servicio centralizado (ya no inline)

### Generación de PDF Server-Side
- [x] server/services/pdfService.ts — PDF 1.4 minimal en pure JS
- [x] Genera PDF con detalle de cotización, productos, totales
- [x] POST /api/pdf/generate/:quotationId
- [x] GET /api/pdf/download/:key (fallback local)
- [x] GET /api/pdf/list/:quotationId

### Azure Blob Storage para PDFs
- [x] server/services/blobStorage.ts
- [x] Upload a Azure Blob Storage
- [x] Fallback a sistema de archivos local cuando no hay Azure
- [x] Metadata en MySQL (tabla pdfDocuments)

### Soft Delete
- [x] Campo isActive en users, products, clients, quotations
- [x] Todos los SELECTs filtran por isActive = 1
- [x] deleteProduct/Client/User/Quotation ahora hacen soft delete
- [x] Cotización soft-delete no elimina items

### Auditoría Completa
- [x] Login/logout, create/update/delete registrados
- [x] Aprobación/rechazo con detalle
- [x] PDF generación/descarga
- [x] Cambio de contraseña, cambio de rol

---

## FASE 2 — CALIDAD Y OPERACIONES

### Validaciones Backend
- [x] Zod schemas en todos los inputs de tRPC
- [x] Validación de fortaleza de contraseña (min 8 chars)
- [x] Validación de email único al crear usuario
- [x] Validación de redMax < yellowMax en márgenes
- [x] Validación de estado pendiente antes de aprobar/rechazar
- [x] Validación de turno (coordinador no puede aprobar en gerente_pending)

### Tests Mínimos
- [x] approval.test.ts — Tests unitarios completos:
  - [x] Semáforo verde/amarillo/rojo (getTrafficLightColor)
  - [x] Paso inicial de aprobación (getInitialApprovalStep)
  - [x] Permisos por rol (canUserApprove)
  - [x] Hash/verify de contraseñas
  - [x] Validación de fortaleza de contraseña
  - [x] Flujo completo margen → semáforo → aprobación
  - [x] Permisos de roles (vendedor, coordinador, gerente, admin)
- [x] auth.logout.test.ts — Actualizado con User type v3
- [x] quotations.test.ts — Actualizado con User type v3

### Seeds y Datos Base
- [x] server/seed.ts — Script de seed:
  - [x] Admin con contraseña hasheada
  - [x] 5 usuarios de ejemplo (gerente, coordinadora, 3 vendedores)
  - [x] Configuración de márgenes por defecto
  - [x] 10 productos de ejemplo
  - [x] 8 clientes de ejemplo
- [x] npm script: pnpm run db:seed

---

## FASE 3 — PREPARACIÓN AZURE

### Variables de Entorno
- [x] .env.example con todas las variables documentadas
- [x] process.env.PORT respetado en producción
- [x] Trust proxy configurado para Azure App Service

### Scripts de package.json
- [x] dev — desarrollo con tsx watch
- [x] build — vite build + esbuild
- [x] start — NODE_ENV=production node dist/index.js
- [x] test — vitest run
- [x] test:watch — vitest (modo watch)
- [x] db:push — drizzle-kit generate + migrate
- [x] db:migrate — drizzle-kit migrate
- [x] db:seed — tsx server/seed.ts

### Azure Blob Storage SDK
- [x] Integración con @azure/storage-blob via blobStorage.ts
- [x] Fallback local cuando no hay Azure credentials

### Health Check
- [x] GET /api/health → { status: "ok", timestamp }

### Documentación de Deploy
- [x] DEPLOY_AZURE.md — Guía paso a paso:
  - Resource Group, MySQL, Blob Storage, App Service
  - Variables de entorno
  - Build y deploy (ZIP + Git)
  - Migraciones y seed
  - Verificación y troubleshooting
  - Costos estimados
- [x] RELEASE_CHECKLIST.md — Checklist de producción:
  - Código, BD, seguridad
  - Configuración Azure
  - Verificación funcional por rol
  - Rollback

### Migraciones SQL
- [x] 0000_old_leopardon.sql — Schema inicial
- [x] 0001_violet_ravenous.sql — Productos, clientes, cotizaciones
- [x] 0002_approval_flow.sql — Aprobaciones, márgenes, auditoría
- [x] 0003_auth_softdelete_pdf.sql — Auth local, soft delete, PDFs, índices
- [x] database/schema_completo.sql — Script completo v3.0

---

## Estructura de Archivos Clave

```
server/
  _core/
    index.ts          — Entry point (Express + tRPC + PDF routes + auth routes)
    context.ts        — tRPC context con auth
    sdk.ts            — JWT/OAuth auth service
    cookies.ts        — Cookie options
    env.ts            — Environment variables
    oauth.ts          — OAuth callback route
  routes/
    authRoutes.ts     — POST /api/auth/login, /change-password
    pdfRoutes.ts      — POST /api/pdf/generate, GET /download, /list
  services/
    authService.ts    — Password hashing (scrypt), validation
    approvalService.ts — Centralized approval logic
    pdfService.ts     — PDF generation (pure JS)
    blobStorage.ts    — Azure Blob Storage + local fallback
  routers.ts          — tRPC router (all endpoints)
  db.ts               — Database queries (Drizzle ORM)
  seed.ts             — Seed script

client/src/
  pages/
    Login.tsx          — Login page (email/password + OAuth)
    Dashboard.tsx      — Home dashboard
    NuevaCotizacion.tsx — Create quotation
    MisCotizaciones.tsx — Quotation list + approval
    Configuracion.tsx  — Margin settings
    HistoricoClientes.tsx — Client history
    Auditoria.tsx      — Audit log
    Usuarios.tsx       — User management (create, roles, reset password)
    Productos.tsx      — Product CRUD
    Clientes.tsx       — Client CRUD

drizzle/
  schema.ts           — Drizzle ORM schema
  0000-0003           — Migration SQL files
```
