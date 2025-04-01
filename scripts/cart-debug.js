const db = require('../config/database');
const cartModel = require('../models/cart.model');

async function main() {
  const USER_ID = 1; // Test user ID
  const PRODUCT_VARIANT_ID = 8; // Using product_variant_id=8 which has stock=1000 and status=1

  try {
    // Step 1: Check if the product is valid
    console.log('Step 1: Checking product details...');
    const [productDetails] = await db.query(
      `SELECT pv.id, pv.product_id, pv.price, pv.special_price, pv.status, pv.stock, 
              p.name, p.status as product_status, p.availability
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = ?`,
      [PRODUCT_VARIANT_ID]
    );
    
    if (!productDetails || productDetails.length === 0) {
      console.log('Product not found!');
      return;
    }
    
    console.log('Product details:', JSON.stringify(productDetails[0], null, 2));
    
    // Step 2: Clear existing cart items for this user
    console.log('\nStep 2: Clearing existing cart items...');
    await db.query('DELETE FROM cart WHERE user_id = ?', [USER_ID]);
    console.log('Cart cleared');
    
    // Step 3: Add item to cart
    console.log('\nStep 3: Adding item to cart...');
    const addResult = await cartModel.addToCart(USER_ID, PRODUCT_VARIANT_ID, 2);
    console.log('Add to cart result:', addResult);
    
    // Step 4: Check cart table directly
    console.log('\nStep 4: Checking cart table directly...');
    const [cartItems] = await db.query(
      'SELECT * FROM cart WHERE user_id = ?',
      [USER_ID]
    );
    console.log('Cart items in database:', JSON.stringify(cartItems, null, 2));
    
    // Step 5: Retrieve cart using getUserCart
    console.log('\nStep 5: Retrieving cart using getUserCart...');
    const userCart = await cartModel.getUserCart(USER_ID);
    console.log('getUserCart result:', JSON.stringify(userCart, null, 2));
    
    // Step 6: Get cart count
    console.log('\nStep 6: Getting cart count...');
    const cartCount = await cartModel.getCartItemsCount(USER_ID);
    console.log('Cart count:', cartCount);
    
    // Step 7: Get cart total
    console.log('\nStep 7: Getting cart total...');
    const cartTotal = await cartModel.getCartTotal(USER_ID);
    console.log('Cart total:', JSON.stringify(cartTotal, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error); 