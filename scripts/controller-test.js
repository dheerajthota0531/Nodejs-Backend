// Import required modules
const cartController = require('../controllers/cart.controller');

// Mock Express request and response objects
function mockReqRes() {
  const req = {
    body: {
      user_id: 1,
      is_saved_for_later: 0
    }
  };
  
  const res = {
    status: function(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json: function(data) {
      this.data = data;
      this.end();
      return this;
    },
    end: function() {
      console.log(`Response status: ${this.statusCode}`);
      console.log('Response data preview:');
      
      // Check if cart data exists
      if (this.data && this.data.cart && this.data.cart.length > 0) {
        const firstItem = this.data.cart[0];
        console.log(`Cart includes ${this.data.cart.length} items`);
        console.log(`First cart item has product_id: ${firstItem.product_id}`);
        
        // Check product_variants
        if (firstItem.product_variants) {
          console.log(`First cart item has product_variants with ${firstItem.product_variants.length} entries`);
          console.log('First variant: ', JSON.stringify(firstItem.product_variants[0], null, 2));
        } else {
          console.log('First cart item is missing product_variants');
        }
        
        // Check product_details
        if (firstItem.product_details) {
          console.log(`First cart item has product_details with ${firstItem.product_details.length} entries`);
          console.log('First detail: ', JSON.stringify(firstItem.product_details[0], null, 2));
        } else {
          console.log('First cart item is missing product_details');
        }
      } else {
        console.log('Cart is empty or missing');
      }
      
      // Print the full cart item
      if (this.data && this.data.cart && this.data.cart.length > 0) {
        console.log('Full cart item:');
        console.log(JSON.stringify(this.data.cart[0], null, 2));
      }
    }
  };
  
  return { req, res };
}

// Test the getCartController
async function testGetCartController() {
  try {
    console.log('Testing getCartController...');
    const { req, res } = mockReqRes();
    
    // Call the controller
    await cartController.getCartController(req, res);
    
    console.log('Test completed.');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testGetCartController()
  .then(() => {
    console.log('Controller test completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Controller test failed:', error);
    process.exit(1);
  }); 