/**
 * Script to verify that all cart routes are correctly defined and responding
 * Run with: node scripts/verify-cart-routes.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Constants
const API_BASE = 'http://localhost:3000/app/v1/api';
const USER_ID = 1;
const VARIANT_ID = 8; // Using variant_id=8 which has stock=1000 and status=1

// Helper function to log responses
const logResponse = (endpoint, response) => {
  console.log(`[${endpoint}] Status: ${response.status}`);
  console.log(`[${endpoint}] Response:`, JSON.stringify(response.data, null, 2));
  return response.data;
};

// Test each cart endpoint
async function testCartRoutes() {
  try {
    const results = {};
    
    // Test get_user_cart endpoint (should be empty initially)
    console.log('\nTesting get_user_cart endpoint...');
    const getUserCartResponse = await axios.post(`${API_BASE}/get_user_cart`, {
      user_id: USER_ID
    });
    results.get_user_cart = logResponse('get_user_cart', getUserCartResponse);
    
    // Test get_cart endpoint (should be empty initially)
    console.log('\nTesting get_cart endpoint...');
    const getCartResponse = await axios.post(`${API_BASE}/get_cart`, {
      user_id: USER_ID
    });
    results.get_cart = logResponse('get_cart', getCartResponse);
    
    // Test manage_cart endpoint (add item to cart)
    console.log('\nTesting manage_cart endpoint (adding item)...');
    const manageCartResponse = await axios.post(`${API_BASE}/manage_cart`, {
      user_id: USER_ID,
      product_variant_id: VARIANT_ID,
      qty: 2
    });
    results.manage_cart = logResponse('manage_cart', manageCartResponse);
    
    // Test get_user_cart again (should now have items)
    console.log('\nTesting get_user_cart endpoint after adding item...');
    const getUserCartAgainResponse = await axios.post(`${API_BASE}/get_user_cart`, {
      user_id: USER_ID
    });
    results.get_user_cart_after_add = logResponse('get_user_cart (after add)', getUserCartAgainResponse);
    
    // Test remove_from_cart endpoint
    console.log('\nTesting remove_from_cart endpoint...');
    const removeFromCartResponse = await axios.post(`${API_BASE}/remove_from_cart`, {
      user_id: USER_ID,
      product_variant_id: VARIANT_ID
    });
    results.remove_from_cart = logResponse('remove_from_cart', removeFromCartResponse);
    
    // Test get_user_cart again (should be empty after removal)
    console.log('\nTesting get_user_cart endpoint after removal...');
    const getUserCartFinalResponse = await axios.post(`${API_BASE}/get_user_cart`, {
      user_id: USER_ID
    });
    results.get_user_cart_after_remove = logResponse('get_user_cart (after remove)', getUserCartFinalResponse);
    
    // Save results to file
    const resultsFile = path.join(__dirname, 'cart-routes-verification.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`\nResults saved to ${resultsFile}`);
    
    return results;
  } catch (error) {
    console.error('Error testing cart routes:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the tests
testCartRoutes().catch(console.error); 