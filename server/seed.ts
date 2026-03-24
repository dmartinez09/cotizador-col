/**
 * Seed script: Crea datos iniciales en la base de datos.
 * - Usuarios de sistema (admin, gerente, coordinador, vendedores) con contraseña unificada
 * - Configuración de márgenes por defecto
 * - Productos de ejemplo
 * - Clientes de ejemplo
 *
 * Uso: npx tsx server/seed.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import {
  users,
  products,
  clients,
  marginSettings,
} from "../shared/schema"; // Asegúrate de que la ruta apunte a tu schema actualizado
import { hashPassword } from "./services/authService";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL no está configurada");
    process.exit(1);
  }

  console.log("Conectando a la base de datos...");
  const db = drizzle(databaseUrl);

  const defaultPassword = "Point2026";
  const hashedPassword = hashPassword(defaultPassword);

  // ===== 1. USUARIOS DEL SISTEMA =====
  console.log("\n--- Creando usuarios del sistema ---");
  const systemUsers = [
    { username: "admin", name: "Administrador del Sistema", role: "admin" as const },
    { username: "gerente", name: "Gerencia Point", role: "gerente" as const },
    { username: "coordinadora", name: "Coordinación Comercial", role: "coordinador" as const },
    { username: "vendedor1", name: "Vendedor 1", role: "vendedor" as const },
    { username: "vendedor2", name: "Vendedor 2", role: "vendedor" as const },
    { username: "vendedor3", name: "Vendedor 3", role: "vendedor" as const },
  ];

  for (const u of systemUsers) {
    const existing = await db.select().from(users).where(eq(users.username, u.username)).limit(1);
    
    if (existing.length > 0) {
      console.log(`  Usuario [${u.username}] ya existe, actualizando contraseña y rol...`);
      await db
        .update(users)
        .set({
          passwordHash: hashedPassword,
          role: u.role,
          isActive: 1,
          name: u.name,
        })
        .where(eq(users.username, u.username));
    } else {
      await db.insert(users).values({
        openId: `local_${u.username}`,
        name: u.name,
        username: u.username,
        passwordHash: hashedPassword,
        role: u.role,
        loginMethod: "local",
        isActive: 1,
      });
      console.log(`  ✅ Creado: ${u.username} [Rol: ${u.role}]`);
    }
  }

  // ===== 2. CONFIGURACIÓN DE MÁRGENES =====
  console.log("\n--- Configuración de márgenes ---");
  const existingMargins = await db.select().from(marginSettings).limit(1);
  if (existingMargins.length > 0) {
    console.log("  Configuración de márgenes ya existe, omitiendo.");
  } else {
    await db.insert(marginSettings).values({
      redMax: 1000,
      yellowMax: 3200,
      tolerance: 200,
    });
    console.log("  ✅ Márgenes por defecto creados.");
  }

  // ===== 3. PRODUCTOS DE EJEMPLO =====
  console.log("\n--- Productos de ejemplo ---");
  const existingProducts = await db.select().from(products).limit(1);
  if (existingProducts.length > 0) {
    console.log("  Ya existen productos, omitiendo.");
  } else {
    const sampleProducts = [
      { description: "Aceite Vegetal 900ml", category: "Aceites", presentation: "Botella 900ml", cost: 5500, price: 8200, stock: 500 },
      { description: "Aceite Vegetal 3L", category: "Aceites", presentation: "Garrafa 3L", cost: 15000, price: 22500, stock: 300 },
      { description: "Aceite de Oliva Extra Virgen 500ml", category: "Aceites Premium", presentation: "Botella 500ml", cost: 18000, price: 28000, stock: 200 },
      { description: "Margarina 500g", category: "Margarinas", presentation: "Tarrina 500g", cost: 3200, price: 5800, stock: 400 },
      { description: "Margarina 1kg", category: "Margarinas", presentation: "Tarrina 1kg", cost: 5800, price: 9500, stock: 350 },
      { description: "Manteca Vegetal 1kg", category: "Mantecas", presentation: "Bloque 1kg", cost: 4500, price: 7200, stock: 250 },
      { description: "Mayonesa 400g", category: "Salsas", presentation: "Frasco 400g", cost: 4200, price: 7000, stock: 600 },
      { description: "Mayonesa 1kg", category: "Salsas", presentation: "Frasco 1kg", cost: 8500, price: 13500, stock: 300 },
      { description: "Salsa de Tomate 400g", category: "Salsas", presentation: "Frasco 400g", cost: 2800, price: 4500, stock: 800 },
      { description: "Vinagre Blanco 500ml", category: "Vinagres", presentation: "Botella 500ml", cost: 1800, price: 3200, stock: 500 },
    ];

    await db.insert(products).values(sampleProducts);
    console.log(`  ✅ Creados ${sampleProducts.length} productos de ejemplo.`);
  }

  // ===== 4. CLIENTES DE EJEMPLO =====
  console.log("\n--- Clientes de ejemplo ---");
  const existingClients = await db.select().from(clients).limit(1);
  if (existingClients.length > 0) {
    console.log("  Ya existen clientes, omitiendo.");
  } else {
    const sampleClients = [
      { name: "Supermercados La Rebaja", zone: "Bogotá" },
      { name: "Distribuidora El Éxito", zone: "Medellín" },
      { name: "Tiendas Juan Valdez", zone: "Cali" },
      { name: "Almacenes La 14", zone: "Valle del Cauca" },
      { name: "Mercados Colsubsidio", zone: "Bogotá" },
      { name: "Super Inter", zone: "Eje Cafetero" },
      { name: "Distribuciones del Caribe", zone: "Barranquilla" },
      { name: "Macro Tienda", zone: "Bucaramanga" },
    ];

    await db.insert(clients).values(sampleClients);
    console.log(`  ✅ Creados ${sampleClients.length} clientes de ejemplo.`);
  }

  console.log("\n========================================");
  console.log("Seed completado exitosamente!");
  console.log("========================================\n");
  console.log("Credenciales de Acceso:");
  console.log("  Usuarios: admin, gerente, coordinadora, vendedor1, vendedor2, vendedor3");
  console.log(`  Contraseña universal: ${defaultPassword}`);
  console.log("========================================\n");

  process.exit(0);
}

seed().catch((error) => {
  console.error("Error en seed:", error);
  process.exit(1);
});
