const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function checkTables() {
  const results = [];
  const log = (message) => {
    console.log(message);
    results.push(message);
  };

  try {
    // Check products table structure
    log('Checking products table structure...');
    const [productsColumns] = await db.query('SHOW COLUMNS FROM products');
    log('Products table columns:');
    productsColumns.forEach(col => {
      log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Check product_variants table structure
    log('\nChecking product_variants table structure...');
    const [variantColumns] = await db.query('SHOW COLUMNS FROM product_variants');
    log('Product_variants table columns:');
    variantColumns.forEach(col => {
      log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Check cart table structure
    log('\nChecking cart table structure...');
    const [cartColumns] = await db.query('SHOW COLUMNS FROM cart');
    log('Cart table columns:');
    cartColumns.forEach(col => {
      log(`- ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Save results to file
    fs.writeFileSync(
      path.join(__dirname, 'table-structure.txt'),
      results.join('\n')
    );
    console.log('\nResults saved to table-structure.txt');

  } catch (error) {
    console.error('Error:', error);
    fs.writeFileSync(
      path.join(__dirname, 'table-structure-error.txt'),
      error.toString()
    );
  }
}

checkTables().catch(console.error); 