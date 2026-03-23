import { readFile } from 'fs/promises';
import { drizzle } from 'drizzle-orm/mysql2';
import { products, clients } from './drizzle/schema.ts';
import * as XLSX from 'xlsx';

const db = drizzle(process.env.DATABASE_URL);

async function importData() {
  try {
    // Leer archivo Excel
    const buffer = await readFile('/home/ubuntu/upload/basedatospreciosycostoscolombia.xlsx');
    const workbook = XLSX.read(buffer);
    
    // Importar productos
    const productSheet = workbook.Sheets['PRODUCTOS, PRECIOS,COSTOS'];
    const productData = XLSX.utils.sheet_to_json(productSheet);
    
    const productsToInsert = productData.map(row => ({
      description: row['Descripción'],
      category: row['Categoria'],
      presentation: String(row['Pres']),
      cost: Math.round(row['Costo KL']),
      price: Math.round(row['Precio RC']),
      stock: 100, // Stock inicial por defecto
    }));
    
    console.log(`Importando ${productsToInsert.length} productos...`);
    await db.insert(products).values(productsToInsert);
    console.log('✓ Productos importados');
    
    // Importar clientes
    const clientSheet = workbook.Sheets['CLIENTES'];
    const clientData = XLSX.utils.sheet_to_json(clientSheet);
    
    const clientsToInsert = clientData.map(row => ({
      name: row['CLIENTES'],
      zone: row['ZONAS'],
    }));
    
    console.log(`Importando ${clientsToInsert.length} clientes...`);
    await db.insert(clients).values(clientsToInsert);
    console.log('✓ Clientes importados');
    
    console.log('\n✅ Importación completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    process.exit(1);
  }
}

importData();
