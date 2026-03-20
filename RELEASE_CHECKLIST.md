# Release Checklist — Point Colombia Cotizador

## Pre-Release

### Codigo
- [ ] Todas las ramas mergeadas a `main`
- [ ] `pnpm run check` (TypeScript) sin errores
- [ ] `pnpm run test` (Vitest) todos los tests pasan
- [ ] `pnpm run build` exitoso sin errores
- [ ] Sin `console.log` de debug en produccion (solo `console.error` para errores reales)
- [ ] Sin credenciales hardcodeadas en el codigo
- [ ] `.env.example` actualizado con todas las variables necesarias

### Base de Datos
- [ ] Migraciones SQL revisadas:
  - [ ] `0000_old_leopardon.sql` — Schema inicial de usuarios
  - [ ] `0001_violet_ravenous.sql` — Productos, clientes, cotizaciones
  - [ ] `0002_approval_flow.sql` — Aprobaciones, margenes, auditoria
  - [ ] `0003_auth_softdelete_pdf.sql` — Auth local, soft delete, PDFs
- [ ] Backup de base de datos existente (si aplica)
- [ ] Migraciones ejecutadas en orden correcto
- [ ] Seed ejecutado (`pnpm run db:seed`)
- [ ] Verificar que el admin puede hacer login

### Seguridad
- [ ] `JWT_SECRET` es unico y largo (32+ caracteres)
- [ ] Contraseña del admin cambiada del default
- [ ] Contraseñas de usuarios de ejemplo cambiadas
- [ ] `DATABASE_URL` usa SSL (`?ssl=true`)
- [ ] Azure Blob Storage con acceso privado (no publico)
- [ ] Variables sensibles NO estan en el repositorio

---

## Configuracion Azure

### App Service
- [ ] Plan: B1 o superior
- [ ] Runtime: Node.js 20 LTS
- [ ] Region: Cercana a usuarios (ej: eastus2)
- [ ] Startup command: `node dist/index.js`
- [ ] HTTPS Only: Habilitado
- [ ] TLS 1.2 minimo

### Variables de Entorno Configuradas
- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` (con SSL)
- [ ] `JWT_SECRET`
- [ ] `AZURE_STORAGE_CONNECTION_STRING` (si usa Blob Storage)
- [ ] `AZURE_BLOB_CONTAINER`

### MySQL Flexible Server
- [ ] Firewall: Allow Azure Services
- [ ] SKU: B1ms o superior
- [ ] Backups automaticos configurados
- [ ] SSL habilitado

### Blob Storage
- [ ] Container `pdfs` creado
- [ ] Acceso: Private (no public)
- [ ] Retention policy configurada (opcional)

---

## Deploy

- [ ] `pnpm install` exitoso
- [ ] `pnpm run build` exitoso
- [ ] ZIP o Git deploy completado
- [ ] App arrancada sin errores en logs

---

## Post-Deploy

### Verificacion Funcional
- [ ] Health check: `GET /api/health` retorna 200
- [ ] Login con admin funciona
- [ ] Dashboard carga correctamente
- [ ] Crear cotizacion funciona
- [ ] Semaforo muestra colores correctos (verde, amarillo, rojo)
- [ ] Aprobacion escalonada funciona:
  - [ ] Verde: coordinador aprueba directamente
  - [ ] Amarillo: coordinador aprueba → gerente aprueba
  - [ ] Rojo: gerente aprueba directamente
- [ ] Rechazo funciona correctamente
- [ ] Generacion de PDF funciona
- [ ] Descarga de PDF funciona
- [ ] Historial de clientes muestra datos
- [ ] Auditoria registra acciones
- [ ] Configuracion de margenes funciona (gerente/admin)
- [ ] Creacion de usuarios funciona (admin)
- [ ] Soft delete funciona (usuarios, productos, clientes, cotizaciones)

### Roles y Permisos
- [ ] Vendedor:
  - [ ] Solo ve sus cotizaciones
  - [ ] No ve margenes numericos (solo semaforo)
  - [ ] No puede aprobar/rechazar
  - [ ] Puede crear cotizaciones
- [ ] Coordinadora Comercial:
  - [ ] Ve todas las cotizaciones
  - [ ] Puede aprobar amarillas (su turno) y verdes
  - [ ] No puede aprobar rojas
- [ ] Gerente General:
  - [ ] Ve todas las cotizaciones con margenes
  - [ ] Puede aprobar rojas y amarillas (segundo paso)
  - [ ] Puede configurar margenes
- [ ] Admin:
  - [ ] Acceso total
  - [ ] Gestion de usuarios
  - [ ] Auditoria

### Monitoreo
- [ ] Logs de App Service accesibles
- [ ] Alertas configuradas (opcional)
- [ ] Diagnostico de App Service habilitado

---

## Rollback

En caso de problemas:

1. **App Service**: Usar slots de deployment o revertir ZIP
   ```bash
   az webapp deployment source config-zip --src previous-deploy.zip ...
   ```

2. **Base de Datos**: Restaurar desde backup
   ```bash
   az mysql flexible-server restore --source-server point-colombia-db ...
   ```

3. **Variables**: Revertir configuracion anterior
   ```bash
   az webapp config appsettings set --settings ...
   ```

---

## Contacto

- Desarrollador: [Nombre del equipo]
- Azure Admin: [Nombre]
- Base de datos: [Nombre]
