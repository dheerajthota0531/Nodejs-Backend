const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/app/v1/api';
const USER_ID = 1;
const VARIANT_ID = 8; // Using variant with stock=1000 and status=1

// Get the command line argument
const args = process.argv.slice(2);
const action = args[0] || 'help';

// Helper function to print response
function printResponse(response) {
  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(response.data, null, 2));
}

/**
 * Make API request to cart endpoints
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request data
 * @returns {Promise<object>} - API response
 */
async function makeApiRequest(endpoint, data) {
  try {
    const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
      user_id: USER_ID,
      ...data
    });
    return response;
  } catch (error) {
    if (error.response) {
      return error.response;
    }
    throw error;
  }
}

// Test functions
async function getCart() {
  console.log('Getting cart contents...');
  try {
    const response = await makeApiRequest('get_user_cart', {});
    console.log(`Status: ${response.status}`);
    
    // Check if cart data exists
    if (response.data && response.data.cart && response.data.cart.length > 0) {
      const firstItem = response.data.cart[0];
      
      // Log the details we care about
      console.log(`Response includes cart array with ${response.data.cart.length} items`);
      console.log(`First cart item has product_id: ${firstItem.product_id}`);
      
      // Check for product_variants and product_details
      if (firstItem.product_variants) {
        console.log(`First cart item has product_variants array with ${firstItem.product_variants.length} items`);
      } else {
        console.log(`First cart item is missing product_variants array`);
      }
      
      if (firstItem.product_details) {
        console.log(`First cart item has product_details array with ${firstItem.product_details.length} items`);
      } else {
        console.log(`First cart item is missing product_details array`);
      }
    } else {
      console.log('Cart is empty or missing');
    }
    
    // Print the full response for reference
    console.log(`Full Response: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error) {
    console.error('Error getting cart:', error.message);
  }
}

async function addToCart() {
  console.log('Adding item to cart...');
  try {
    const response = await makeApiRequest('manage_cart', {
      product_variant_id: VARIANT_ID,
      qty: 2
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error) {
    console.error('Error adding to cart:', error.message);
  }
}

async function removeFromCart() {
  console.log('Removing item from cart...');
  try {
    const response = await makeApiRequest('manage_cart', {
      product_variant_id: VARIANT_ID,
      qty: 0
    });
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
  } catch (error) {
    console.error('Error removing from cart:', error.message);
  }
}

function showHelp() {
  console.log('Available commands:');
  console.log('  node simple-cart-test.js get    - Get cart contents');
  console.log('  node simple-cart-test.js add    - Add item to cart');
  console.log('  node simple-cart-test.js remove - Remove item from cart');
}

// Execute the requested action
(async () => {
  switch (action) {
    case 'get':
      await getCart();
      break;
    case 'add':
      await addToCart();
      break;
    case 'remove':
      await removeFromCart();
      break;
    default:
      showHelp();
  }
})(); 