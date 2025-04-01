const db = require('../config/database');

async function main() {
  console.log('Connected to database');
  
  try {
    // Check product_variants table
    console.log('Checking product_variants table...');
    const [variants] = await db.query(
      `SELECT id, product_id, price, special_price, status, stock FROM product_variants LIMIT 10`
    );
    console.log('Product variants:', JSON.stringify(variants, null, 2));

    // Check products table
    console.log('\nChecking products table...');
    const [products] = await db.query(
      `SELECT id, name, status, availability FROM products LIMIT 10`
    );
    console.log('Products:', JSON.stringify(products, null, 2));

    // Check if specific product variant exists (the one we're trying to add to cart)
    console.log('\nChecking specific product variant (id=1)...');
    const [specificVariant] = await db.query(
      `SELECT pv.id, pv.product_id, pv.price, pv.special_price, pv.status, pv.stock, 
              p.name, p.status as product_status, p.availability
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = 1`
    );
    console.log('Specific variant:', JSON.stringify(specificVariant, null, 2));

    // Check cart table contents
    console.log('\nChecking cart table contents...');
    const [cartItems] = await db.query(
      `SELECT * FROM cart`
    );
    console.log('Cart items:', JSON.stringify(cartItems, null, 2));

  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 