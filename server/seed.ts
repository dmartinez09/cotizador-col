/**
 * Seed script: Crea datos iniciales en la base de datos.
 * - Usuario admin con contraseña
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
} from "../drizzle/schema";
import { hashPassword } from "./services/authService";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL no está configurada");
    process.exit(1);
  }

  console.log("Conectando a la base de datos...");
  const db = drizzle(databaseUrl);

  // ===== 1. ADMIN USER =====
  console.log("\n--- Creando usuario admin ---");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@pointcolombia.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Point2026!";
  const adminName = process.env.ADMIN_NAME || "Administrador";

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log(`  Usuario admin ya existe (${adminEmail}), actualizando...`);
    await db
      .update(users)
      .set({
        passwordHash: hashPassword(adminPassword),
        role: "admin",
        isActive: 1,
        name: adminName,
      })
      .where(eq(users.email, adminEmail));
  } else {
    console.log(`  Creando usuario admin: ${adminEmail}`);
    await db.insert(users).values({
      openId: `local_${adminEmail}`,
      name: adminName,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: "admin",
      loginMethod: "local",
      isActive: 1,
    });
  }
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`);

  // ===== 2. USUARIOS DE EJEMPLO =====
  console.log("\n--- Creando usuarios de ejemplo ---");
  const sampleUsers = [
    { name: "Gerente General", email: "gerente@pointcolombia.com", role: "gerente" as const },
    { name: "Coordinadora Comercial", email: "coordinadora@pointcolombia.com", role: "coordinador" as const },
    { name: "Vendedor 1", email: "vendedor1@pointcolombia.com", role: "vendedor" as const },
    { name: "Vendedor 2", email: "vendedor2@pointcolombia.com", role: "vendedor" as const },
    { name: "Vendedor 3", email: "vendedor3@pointcolombia.com", role: "vendedor" as const },
  ];

  for (const u of sampleUsers) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing.length > 0) {
      console.log(`  Usuario ${u.email} ya existe, omitiendo.`);
    } else {
      const defaultPassword = "Point2026!";
      await db.insert(users).values({
        openId: `local_${u.email}`,
        name: u.name,
        email: u.email,
        passwordHash: hashPassword(defaultPassword),
        role: u.role,
        loginMethod: "local",
        isActive: 1,
      });
      console.log(`  Creado: ${u.name} (${u.email}) [${u.role}] — pass: ${defaultPassword}`);
    }
  }

  // ===== 3. CONFIGURACIÓN DE MÁRGENES =====
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
    console.log("  Márgenes por defecto: rojo < 1000, amarillo 1000-3200, verde >= 3200");
  }

  // ===== 4. PRODUCTOS DE EJEMPLO =====
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
    console.log(`  Creados ${sampleProducts.length} productos de ejemplo.`);
  }

  // ===== 5. CLIENTES DE EJEMPLO =====
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
    console.log(`  Creados ${sampleClients.length} clientes de ejemplo.`);
  }

  console.log("\n========================================");
  console.log("Seed completado exitosamente!");
  console.log("========================================\n");
  console.log("Credenciales:");
  console.log(`  Admin: ${adminEmail} / ${adminPassword}`);
  console.log("  Demás usuarios: [email]@pointcolombia.com / Point2026!");
  console.log("");

  process.exit(0);
}

seed().catch((error) => {
  console.error("Error en seed:", error);
  process.exit(1);
});
