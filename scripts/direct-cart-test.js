const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function testCart() {
  const results = [];
  const log = (message) => {
    console.log(message);
    results.push(message);
  };

  try {
    const USER_ID = 1;
    const PRODUCT_VARIANT_ID = 8;

    log('=========================================');
    log('DIRECT CART DATABASE TEST');
    log('=========================================');

    // Step 1: Clear cart
    log('\nStep 1: Clearing cart...');
    await db.query('DELETE FROM cart WHERE user_id = ?', [USER_ID]);
    log('Cart cleared');

    // Step 2: Add item to cart directly
    log('\nStep 2: Adding item to cart...');
    await db.query(
      'INSERT INTO cart (user_id, product_variant_id, qty, is_saved_for_later) VALUES (?, ?, ?, ?)',
      [USER_ID, PRODUCT_VARIANT_ID, 2, 0]
    );
    log('Item added to cart');

    // Step 3: Verify cart contents
    log('\nStep 3: Verifying cart contents...');
    const [cartItems] = await db.query(
      'SELECT * FROM cart WHERE user_id = ?',
      [USER_ID]
    );
    log('Cart items: ' + JSON.stringify(cartItems, null, 2));

    // Step 4: Query with joins to see what would be returned by getUserCart
    log('\nStep 4: Testing getUserCart query...');
    const [joinedItems] = await db.query(
      `SELECT c.*, p.name, p.image, p.short_description, p.minimum_order_quantity, 
             p.quantity_step_size, p.total_allowed_quantity, 
             p.availability as p_availability, pv.availability as pv_availability,
             p.is_prices_inclusive_tax, p.tax, 
             pv.price, pv.special_price, pv.images, pv.stock, pv.status as pv_status,
             p.status as p_status
      FROM cart c
      JOIN product_variants pv ON c.product_variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE c.user_id = ? 
        AND c.is_saved_for_later = 0
        AND c.qty > 0`,
      [USER_ID]
    );
    log('Joined cart items: ' + JSON.stringify(joinedItems, null, 2));

    // Step 5: Check product and variant status
    log('\nStep 5: Checking product variant details...');
    const [productVariant] = await db.query(
      `SELECT pv.*, p.status as product_status, p.availability 
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE pv.id = ?`,
      [PRODUCT_VARIANT_ID]
    );
    log('Product variant details: ' + JSON.stringify(productVariant, null, 2));

    // Save results to file
    fs.writeFileSync(
      path.join(__dirname, 'cart-test-results.txt'),
      results.join('\n')
    );
    console.log('\nResults saved to cart-test-results.txt');

  } catch (error) {
    console.error('Error in test:', error);
    fs.writeFileSync(
      path.join(__dirname, 'cart-test-error.txt'),
      error.toString()
    );
  }
}

testCart().catch(console.error); 