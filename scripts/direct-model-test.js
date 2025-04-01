// Import required modules
const cartModel = require('../models/cart.model');

// Main function
async function testCartModel() {
  try {
    console.log('Starting direct cart model test...');
    
    // Get cart for user ID 1
    const userId = 1;
    const cartItems = await cartModel.getUserCart(userId, 0);
    
    console.log(`Retrieved ${cartItems.length} cart items for user ${userId}`);
    
    if (cartItems.length > 0) {
      // Check first item
      const firstItem = cartItems[0];
      console.log('Cart item structure:');
      console.log(JSON.stringify({
        id: firstItem.id,
        user_id: firstItem.user_id,
        product_id: firstItem.product_id,
        product_variant_id: firstItem.product_variant_id,
        has_product_variants: !!firstItem.product_variants,
        product_variants_length: firstItem.product_variants ? firstItem.product_variants.length : 0,
        has_product_details: !!firstItem.product_details,
        product_details_length: firstItem.product_details ? firstItem.product_details.length : 0
      }, null, 2));
      
      // Output variants if they exist
      if (firstItem.product_variants && firstItem.product_variants.length > 0) {
        console.log('First product variant:');
        console.log(JSON.stringify(firstItem.product_variants[0], null, 2));
      }
      
      // Output details if they exist
      if (firstItem.product_details && firstItem.product_details.length > 0) {
        console.log('First product detail:');
        console.log(JSON.stringify(firstItem.product_details[0], null, 2));
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
testCartModel()
  .then(() => {
    console.log('Direct model test completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Direct model test failed:', error);
    process.exit(1);
  }); 