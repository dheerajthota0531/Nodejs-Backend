// Import the cart model
const cartModel = require('../models/cart.model');

// Test function
async function testCartStructure() {
  try {
    console.log('Testing cart structure...');
    
    // Get cart items for user ID 1
    const userId = 1;
    console.log(`Getting cart for user ID: ${userId}`);
    
    // Get cart items
    const cartItems = await cartModel.getUserCart(userId, 0);
    console.log(`Cart items retrieved: ${cartItems.length}`);
    
    // Log the first item structure
    if (cartItems.length > 0) {
      const firstItem = cartItems[0];
      console.log('First cart item structure:');
      console.log(JSON.stringify(firstItem, null, 2));
      
      // Check for product_variants and product_details
      if (firstItem.product_variants) {
        console.log('Product variants are present!');
        console.log(`Number of product variants: ${firstItem.product_variants.length}`);
      } else {
        console.log('Product variants are missing!');
      }
      
      if (firstItem.product_details) {
        console.log('Product details are present!');
        console.log(`Number of product details: ${firstItem.product_details.length}`);
      } else {
        console.log('Product details are missing!');
      }
    } else {
      console.log('No cart items found.');
    }
    
    console.log('Test completed.');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testCartStructure().then(() => {
  console.log('Test script execution completed.');
  process.exit(0);
}).catch(err => {
  console.error('Test script failed:', err);
  process.exit(1);
}); 