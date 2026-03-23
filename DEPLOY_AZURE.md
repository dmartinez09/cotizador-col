# Despliegue en Azure App Service — Point Colombia Cotizador

## Arquitectura

```
Azure App Service (Linux, Node 20)
  ├── Express Server (API + tRPC + Static files)
  ├── MySQL (Azure Database for MySQL Flexible Server)
  └── Azure Blob Storage (PDFs)
```

## Pre-requisitos

1. Azure CLI instalado (`az --version`)
2. Suscripción Azure activa
3. Node.js 20+ local para build
4. Git

---

## Paso 1: Crear Recursos en Azure

### 1.1 Resource Group
```bash
az group create --name rg-point-colombia --location eastus2
```

### 1.2 Azure Database for MySQL Flexible Server
```bash
az mysql flexible-server create \
  --resource-group rg-point-colombia \
  --name point-colombia-db \
  --admin-user adminpoint \
  --admin-password '<CONTRASEÑA_SEGURA>' \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 8.0 \
  --location eastus2

# Permitir acceso desde Azure Services
az mysql flexible-server firewall-rule create \
  --resource-group rg-point-colombia \
  --name point-colombia-db \
  --rule-name AllowAzure \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

### 1.3 Crear Base de Datos
```bash
az mysql flexible-server db create \
  --resource-group rg-point-colombia \
  --server-name point-colombia-db \
  --database-name point_colombia
```

### 1.4 Azure Blob Storage
```bash
az storage account create \
  --name pointcolombiapdfs \
  --resource-group rg-point-colombia \
  --location eastus2 \
  --sku Standard_LRS

az storage container create \
  --name pdfs \
  --account-name pointcolombiapdfs
```

### 1.5 Azure App Service
```bash
# Plan
az appservice plan create \
  --name plan-point-colombia \
  --resource-group rg-point-colombia \
  --sku B1 \
  --is-linux

# App
az webapp create \
  --resource-group rg-point-colombia \
  --plan plan-point-colombia \
  --name point-colombia-cotizador \
  --runtime "NODE:20-lts"
```

---

## Paso 2: Configurar Variables de Entorno

```bash
# Connection string MySQL
DB_HOST=$(az mysql flexible-server show --resource-group rg-point-colombia --name point-colombia-db --query "fullyQualifiedDomainName" -o tsv)

# Connection string Blob Storage
BLOB_CONN=$(az storage account show-connection-string --name pointcolombiapdfs --resource-group rg-point-colombia --query connectionString -o tsv)

az webapp config appsettings set \
  --resource-group rg-point-colombia \
  --name point-colombia-cotizador \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="mysql://adminpoint:<CONTRASEÑA>@${DB_HOST}:3306/point_colombia?ssl=true" \
    JWT_SECRET="<SECRETO_JWT_LARGO_Y_SEGURO>" \
    AZURE_STORAGE_CONNECTION_STRING="${BLOB_CONN}" \
    AZURE_BLOB_CONTAINER="cotizador-pdfs" \
    ADMIN_EMAIL="admin@pointcolombia.com" \
    ADMIN_PASSWORD="<CONTRASEÑA_ADMIN>"
```

### Variables Requeridas

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno | `production` |
| `PORT` | Puerto (lo asigna Azure) | `8080` |
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:3306/db?ssl=true` |
| `JWT_SECRET` | Secreto JWT (32+ chars) | `abc123...` |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage | `DefaultEndpoints...` |
| `AZURE_BLOB_CONTAINER` | Contenedor de PDFs | `cotizador-pdfs` |

### Variables Opcionales (OAuth)

| Variable | Descripcion |
|----------|-------------|
| `VITE_APP_ID` | App ID de OAuth Portal |
| `OAUTH_SERVER_URL` | URL del servidor OAuth |
| `VITE_OAUTH_PORTAL_URL` | URL del portal OAuth |
| `OWNER_OPEN_ID` | OpenID del owner/admin |

---

## Paso 3: Build y Deploy

### Opcion A: Deploy con ZIP (recomendado)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Build
pnpm run build

# 3. Crear ZIP del build
cd dist && zip -r ../deploy.zip . && cd ..

# O usando la estructura completa:
zip -r deploy.zip dist/ node_modules/ package.json drizzle/

# 4. Deploy
az webapp deployment source config-zip \
  --resource-group rg-point-colombia \
  --name point-colombia-cotizador \
  --src deploy.zip
```

### Opcion B: Deploy con Git

```bash
# Configurar deployment source
az webapp deployment source config-local-git \
  --resource-group rg-point-colombia \
  --name point-colombia-cotizador

# Obtener URL de deploy
DEPLOY_URL=$(az webapp deployment list-publishing-profiles \
  --resource-group rg-point-colombia \
  --name point-colombia-cotizador \
  --query "[?publishMethod=='MSDeploy'].publishUrl" -o tsv)

# Agregar remote y push
git remote add azure https://<user>@point-colombia-cotizador.scm.azurewebsites.net/point-colombia-cotizador.git
git push azure main
```

---

## Paso 4: Ejecutar Migraciones

```bash
# Conectar por SSH al App Service
az webapp ssh --resource-group rg-point-colombia --name point-colombia-cotizador

# Dentro del SSH:
# Ejecutar migraciones SQL manualmente o con drizzle
node_modules/.bin/drizzle-kit migrate

# O ejecutar las SQL directamente contra MySQL:
mysql -h $DB_HOST -u adminpoint -p point_colombia < drizzle/0000_old_leopardon.sql
mysql -h $DB_HOST -u adminpoint -p point_colombia < drizzle/0001_violet_ravenous.sql
mysql -h $DB_HOST -u adminpoint -p point_colombia < drizzle/0002_approval_flow.sql
mysql -h $DB_HOST -u adminpoint -p point_colombia < drizzle/0003_auth_softdelete_pdf.sql
```

---

## Paso 5: Ejecutar Seed

```bash
# Desde SSH o localmente apuntando a la DB de Azure
pnpm run db:seed
```

---

## Paso 6: Configurar Startup

Azure App Service busca `npm start` por defecto. Como nuestro script `start` ejecuta
`NODE_ENV=production node dist/index.js`, configurar:

```bash
az webapp config set \
  --resource-group rg-point-colombia \
  --name point-colombia-cotizador \
  --startup-file "node dist/index.js"
```

---

## Paso 7: Verificar

```bash
# Health check
curl https://point-colombia-cotizador.azurewebsites.net/api/health

# Ver logs
az webapp log tail \
  --resource-group rg-point-colombia \
  --name point-colombia-cotizador
```

---

## Troubleshooting

### La app no arranca
```bash
# Ver logs de deploy
az webapp log download --resource-group rg-point-colombia --name point-colombia-cotizador

# Verificar variables de entorno
az webapp config appsettings list --resource-group rg-point-colombia --name point-colombia-cotizador
```

### Error de conexion MySQL
- Verificar que el firewall de MySQL permita Azure Services
- Verificar que `?ssl=true` este en la connection string
- Verificar usuario y contraseña

### PDFs no se suben
- Verificar `AZURE_STORAGE_CONNECTION_STRING` (debe contener AccountName y AccountKey)
- Verificar `AZURE_BLOB_CONTAINER` (nombre del contenedor)
- Verificar que el container exista en Azure Storage
- En producción Azure Blob es obligatorio; en desarrollo se usa `./uploads/pdfs/` como fallback

### Timeout en operaciones
- Escalar el plan de App Service si hay timeouts
- MySQL Flexible Server: B1ms puede ser lento con consultas complejas

---

## Costos Estimados (USD/mes)

| Recurso | SKU | Costo Estimado |
|---------|-----|----------------|
| App Service | B1 | ~$13 |
| MySQL Flexible | B1ms | ~$12 |
| Blob Storage | Standard LRS | ~$1-5 |
| **Total** | | **~$26-30** |
