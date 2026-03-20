# Point Colombia — Sistema de Cotizaciones

Sistema web profesional de cotizaciones para Point Colombia, desarrollado con React 19, Tailwind CSS 4, tRPC 11, Express y MySQL.

---

## Tabla de Contenidos

1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Configuración del Entorno](#configuración-del-entorno)
4. [Instalación y Ejecución Local](#instalación-y-ejecución-local)
5. [Base de Datos](#base-de-datos)
6. [Roles y Permisos](#roles-y-permisos)
7. [Módulos de la Aplicación](#módulos-de-la-aplicación)
8. [Lógica de Bonificaciones y Semáforo](#lógica-de-bonificaciones-y-semáforo)
9. [Variables de Entorno](#variables-de-entorno)
10. [Comandos Disponibles](#comandos-disponibles)

---

## Requisitos del Sistema

| Herramienta | Versión mínima | Notas |
|---|---|---|
| Node.js | 22.x | Recomendado: 22.13.0 |
| pnpm | 10.x | Gestor de paquetes principal |
| MySQL | 8.0+ | O TiDB compatible |
| VS Code | 1.85+ | Con extensiones TypeScript y ESLint |

---

## Estructura del Proyecto

```
point_colombia_cotizador/
│
├── client/                         # Frontend React (SPA)
│   ├── public/                     # Assets estáticos
│   └── src/
│       ├── _core/                  # Hooks de autenticación (generados)
│       ├── components/
│       │   ├── ui/                 # Componentes shadcn/ui
│       │   ├── PointDashboardLayout.tsx   # Layout principal con sidebar
│       │   ├── DashboardLayout.tsx
│       │   └── ErrorBoundary.tsx
│       ├── contexts/
│       │   └── ThemeContext.tsx
│       ├── hooks/
│       ├── lib/
│       │   ├── trpc.ts             # Cliente tRPC
│       │   └── utils.ts
│       ├── pages/
│       │   ├── Dashboard.tsx       # Panel principal con métricas
│       │   ├── NuevaCotizacion.tsx # Módulo cotizador (core)
│       │   ├── MisCotizaciones.tsx # Historial y aprobaciones
│       │   ├── Productos.tsx       # CRUD productos (admin)
│       │   ├── Clientes.tsx        # CRUD clientes (admin)
│       │   └── Usuarios.tsx        # Gestión de usuarios (admin)
│       ├── App.tsx                 # Rutas y layout
│       ├── main.tsx                # Entry point
│       └── index.css               # Tema corporativo #067a5b
│
├── drizzle/                        # Migraciones de base de datos
│   ├── schema.ts                   # Definición de tablas
│   ├── 0000_old_leopardon.sql      # Migración inicial (users)
│   └── 0001_violet_ravenous.sql    # Migración principal (productos, clientes, cotizaciones)
│
├── server/
│   ├── _core/                      # Infraestructura del servidor (no modificar)
│   │   ├── index.ts                # Entry point Express
│   │   ├── context.ts              # Contexto tRPC
│   │   ├── trpc.ts                 # Configuración tRPC
│   │   ├── oauth.ts                # Autenticación OAuth
│   │   └── env.ts                  # Variables de entorno
│   ├── db.ts                       # Helpers de base de datos
│   ├── routers.ts                  # Procedimientos tRPC (API)
│   ├── storage.ts                  # Helpers S3
│   ├── auth.logout.test.ts         # Tests de autenticación
│   └── quotations.test.ts          # Tests de cotizaciones
│
├── shared/
│   ├── const.ts                    # Constantes compartidas
│   └── types.ts                    # Tipos compartidos
│
├── import-data.mjs                 # Script de importación de datos Excel
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── vitest.config.ts
```

---

## Configuración del Entorno

### 1. Clonar o descomprimir el proyecto

```bash
cd ~/proyectos
# Si descargaste el ZIP:
unzip point_colombia_cotizador.zip
cd point_colombia_cotizador
```

### 2. Crear el archivo `.env`

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# Base de datos MySQL (ajusta según tu configuración local)
DATABASE_URL=mysql://root:tu_password@localhost:3306/point_colombia

# Autenticación JWT
JWT_SECRET=tu_secreto_jwt_muy_seguro_aqui_cambiar_en_produccion

# OAuth (para autenticación con Manus — en local puedes usar valores de prueba)
VITE_APP_ID=local-dev-app
OAUTH_SERVER_URL=http://localhost:3000
VITE_OAUTH_PORTAL_URL=http://localhost:3000
OWNER_OPEN_ID=admin-local
OWNER_NAME=Administrador

# APIs internas (opcionales en desarrollo local)
BUILT_IN_FORGE_API_URL=http://localhost:3000
BUILT_IN_FORGE_API_KEY=local-key
VITE_FRONTEND_FORGE_API_KEY=local-key
VITE_FRONTEND_FORGE_API_URL=http://localhost:3000

# Analytics (opcional)
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

> **Nota:** En producción (Manus Cloud), estas variables se inyectan automáticamente. Para desarrollo local, necesitas configurar una base de datos MySQL y ajustar `DATABASE_URL`.

### 3. Crear la base de datos MySQL

```sql
CREATE DATABASE point_colombia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## Instalación y Ejecución Local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Ejecutar migraciones de base de datos
pnpm db:push

# 3. (Opcional) Importar datos iniciales desde Excel
npx tsx import-data.mjs

# 4. Iniciar el servidor de desarrollo
pnpm dev
```

La aplicación estará disponible en: **http://localhost:3000**

---

## Base de Datos

### Diagrama de Tablas

```
users                    products
─────────────────        ─────────────────────────
id (PK)                  id (PK)
openId (UNIQUE)          description
name                     category
email                    presentation
loginMethod              cost          ← Solo visible para admin
role (enum)              price
createdAt                stock
updatedAt                createdAt
lastSignedIn             updatedAt

clients                  quotations
─────────────────        ─────────────────────────
id (PK)                  id (PK)
name                     clientId (FK → clients)
zone                     vendorId (FK → users)
createdAt                subtotal
updatedAt                iva (19%)
                         total
                         totalCost     ← Solo visible para admin
                         grossProfit   ← Solo visible para admin
                         grossMargin   ← Solo visible para admin
                         status (enum)
                         approvedBy (FK → users)
                         createdAt
                         updatedAt

quotationItems
─────────────────────────
id (PK)
quotationId (FK → quotations)
productId (FK → products)
quantity
unitPrice
unitCost              ← Solo visible para admin
isBonus (0/1)
subtotal
createdAt
```

### Script SQL Completo

El script completo de creación de tablas se encuentra en:
- `drizzle/0000_old_leopardon.sql` — Tabla de usuarios
- `drizzle/0001_violet_ravenous.sql` — Tablas de productos, clientes, cotizaciones e items

Para aplicar manualmente en MySQL:

```bash
mysql -u root -p point_colombia < drizzle/0000_old_leopardon.sql
mysql -u root -p point_colombia < drizzle/0001_violet_ravenous.sql
```

---

## Roles y Permisos

| Funcionalidad | Vendedor | Coordinador | Admin |
|---|:---:|:---:|:---:|
| Nueva Cotización | ✅ | ✅ | ✅ |
| Ver sus cotizaciones | ✅ | ✅ | ✅ |
| Ver todas las cotizaciones | ❌ | ✅ | ✅ |
| Ver costos y márgenes | ❌ | ❌ | ✅ |
| Aprobar cotizaciones (margen ≥32%) | ❌ | ✅ | ✅ |
| Aprobar cotizaciones (margen <32%) | ❌ | ❌ | ✅ |
| CRUD Productos | ❌ | ❌ | ✅ |
| CRUD Clientes | ❌ | ❌ | ✅ |
| Gestión de Usuarios | ❌ | ❌ | ✅ |

### Flujo de Aprobación

```
Cotización creada (pendiente)
         │
         ▼
  ¿Margen ≥ 32%?
    /           \
  SÍ             NO
   │              │
   ▼              ▼
Coordinador    Solo César
puede aprobar  (Admin) puede
               aprobar
```

---

## Módulos de la Aplicación

### Dashboard (`/`)
Panel principal con métricas en tiempo real: cotizaciones pendientes, aprobadas, total de productos y clientes. Accesos rápidos a los módulos principales.

### Nueva Cotización (`/nueva-cotizacion`)
Módulo central de la aplicación. Permite:
- Seleccionar cliente filtrado por zona
- Buscar y agregar productos al carrito
- Configurar cantidades
- Marcar productos como bonificación (precio $0)
- Ver semáforo de rentabilidad en tiempo real
- Calcular subtotal, IVA (19%) y total automáticamente
- Guardar la cotización

### Mis Cotizaciones (`/mis-cotizaciones`)
Historial de cotizaciones con estados (pendiente, aprobada, rechazada). Permite ver el detalle completo, aprobar/rechazar (según rol) y exportar a PDF.

### Productos (`/productos`) — Solo Admin
CRUD completo de productos con campos: descripción, categoría, presentación, costo, precio y stock.

### Clientes (`/clientes`) — Solo Admin
CRUD completo de clientes con nombre y zona geográfica.

### Usuarios (`/usuarios`) — Solo Admin
Gestión de roles de usuarios registrados. Los usuarios se crean automáticamente al iniciar sesión por primera vez con rol "Vendedor".

---

## Lógica de Bonificaciones y Semáforo

### Sistema de Semáforo de Rentabilidad

El cotizador calcula el margen bruto en tiempo real y muestra un indicador visual:

| Margen Bruto | Color | Estado | Aprobador |
|---|:---:|---|---|
| < 10% | 🔴 Rojo | Crítico | Solo César (Admin) |
| 10% — 31.9% | 🟡 Amarillo | Aceptable | Solo César (Admin) |
| ≥ 32% | 🟢 Verde | Óptimo | Coordinador o Admin |

### Cálculo de Márgenes

```
Subtotal = Σ (cantidad × precio_unitario)  [excluyendo bonificaciones]
IVA = Subtotal × 0.19
Total = Subtotal + IVA

Costo Total = Σ (cantidad × costo_unitario)  [incluyendo bonificaciones]
Utilidad Bruta = Subtotal - Costo Total
Margen Bruto = (Utilidad Bruta / Subtotal) × 100
```

### Bonificaciones

Una bonificación es un producto agregado a la cotización con `precio = $0` e `isBonus = 1`. El costo del producto bonificado **sí se incluye** en el costo total para el cálculo correcto del margen, pero **no suma** al subtotal de venta.

---

## Variables de Entorno

| Variable | Descripción | Requerida |
|---|---|:---:|
| `DATABASE_URL` | Cadena de conexión MySQL | ✅ |
| `JWT_SECRET` | Secreto para firmar sesiones | ✅ |
| `VITE_APP_ID` | ID de la aplicación OAuth | ✅ |
| `OAUTH_SERVER_URL` | URL del servidor OAuth | ✅ |
| `VITE_OAUTH_PORTAL_URL` | URL del portal de login | ✅ |
| `OWNER_OPEN_ID` | OpenID del propietario (admin automático) | ✅ |
| `OWNER_NAME` | Nombre del propietario | ✅ |
| `BUILT_IN_FORGE_API_KEY` | API Key interna (server-side) | Opcional |
| `VITE_FRONTEND_FORGE_API_KEY` | API Key interna (frontend) | Opcional |

---

## Comandos Disponibles

```bash
# Desarrollo
pnpm dev              # Inicia servidor de desarrollo (puerto 3000)

# Base de datos
pnpm db:push          # Genera y aplica migraciones (drizzle-kit)

# Tests
pnpm test             # Ejecuta todos los tests con Vitest

# Build de producción
pnpm build            # Compila frontend + backend

# Producción
pnpm start            # Inicia servidor en modo producción

# Calidad de código
pnpm check            # Verificación TypeScript sin errores
pnpm format           # Formatea código con Prettier
```

---

## Extensiones Recomendadas para VS Code

Instala las siguientes extensiones para una mejor experiencia de desarrollo:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "drizzle-team.drizzle-vscode",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

---

## Arquitectura Técnica

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (React 19)                    │
│  Vite + Tailwind CSS 4 + shadcn/ui + tRPC Client        │
│  wouter (routing) + TanStack Query (cache)              │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / tRPC (JSON-RPC)
┌────────────────────────▼────────────────────────────────┐
│                   SERVIDOR (Express 4)                   │
│  tRPC Router + Manus OAuth + Drizzle ORM                │
│  Procedimientos: products, clients, quotations, users   │
└────────────────────────┬────────────────────────────────┘
                         │ MySQL2 Driver
┌────────────────────────▼────────────────────────────────┐
│                BASE DE DATOS (MySQL 8)                   │
│  users | products | clients | quotations | items        │
└─────────────────────────────────────────────────────────┘
```

---

*Desarrollado para Point Colombia — Sistema de Cotizaciones v1.0*
