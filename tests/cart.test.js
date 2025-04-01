/**
 * Test script for cart API endpoints
 * 
 * To run this test:
 * 1. Make sure the server is running
 * 2. Install axios if not already installed: npm install axios
 * 3. Run: node tests/cart.test.js
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/app/v1/api';
const USER_ID = '1'; // Replace with a valid user ID from your database

// Test adding an item to cart
async function testAddToCart() {
  try {
    console.log('Testing add to cart...');
    const response = await axios.post(`${API_URL}/manage_cart`, {
      user_id: USER_ID,
      product_variant_id: '1', // Replace with a valid product variant ID
      qty: '1'
    });
    
    console.log('Add to cart response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error adding to cart:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Test getting cart contents with get_cart
async function testGetCart() {
  try {
    console.log('Testing get_cart...');
    const response = await axios.post(`${API_URL}/get_cart`, {
      user_id: USER_ID
    });
    
    console.log('Get cart response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error getting cart:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Test getting cart contents with get_user_cart
async function testGetUserCart() {
  try {
    console.log('Testing get_user_cart...');
    const response = await axios.post(`${API_URL}/get_user_cart`, {
      user_id: USER_ID
    });
    
    console.log('Get user cart response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error getting user cart:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Test removing item from cart
async function testRemoveFromCart(productVariantId) {
  try {
    console.log('Testing remove from cart...');
    const response = await axios.post(`${API_URL}/remove_from_cart`, {
      user_id: USER_ID,
      product_variant_id: productVariantId || '1' // Use provided ID or default to '1'
    });
    
    console.log('Remove from cart response:');
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error removing from cart:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Run tests sequentially
async function runTests() {
  console.log('=== STARTING CART API TESTS ===');
  
  // Test 1: Add to cart
  const addResult = await testAddToCart();
  
  // Test 2: Get cart with get_cart
  const getResult = await testGetCart();
  
  // Test 3: Get cart with get_user_cart
  const getUserCartResult = await testGetUserCart();
  
  // Get product variant ID from the cart to remove it
  let productVariantId = '1';
  if (getResult && getResult.data && getResult.data.length > 0) {
    productVariantId = getResult.data[0].product_variant_id;
  }
  
  // Test 4: Remove from cart
  await testRemoveFromCart(productVariantId);
  
  console.log('=== CART API TESTS COMPLETED ===');
}

// Run the tests
runTests().catch(err => {
  console.error('Test execution failed:', err);
}); 