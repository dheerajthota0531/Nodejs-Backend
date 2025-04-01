// Test script for product FAQs APIs
const http = require('http');

/**
 * Helper function to make POST requests to the API
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request data
 * @returns {Promise<object>} - API response
 */
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/app/v1/api/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonData.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (e) {
          reject(new Error(`Error parsing response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(jsonData);
    req.end();
  });
}

/**
 * Verify data types in response to match PHP
 * @param {object} response - API response
 */
function verifyDataTypes(response) {
  if (!response || response.error) {
    return;
  }
  
  if (response.data && response.data.length > 0) {
    console.log('\n=== Verifying Data Types ===');
    
    // Get the first FAQ to check
    const faq = response.data[0];
    
    // Check total field
    console.log('total:', typeof response.total, response.total);
    
    // Check all important fields
    console.log('id:', typeof faq.id, faq.id);
    console.log('product_id:', typeof faq.product_id, faq.product_id);
    console.log('user_id:', typeof faq.user_id, faq.user_id);
    console.log('votes:', typeof faq.votes, faq.votes);
    console.log('answered_by:', typeof faq.answered_by, faq.answered_by);
    console.log('question:', typeof faq.question, faq.question);
    console.log('answer:', typeof faq.answer, faq.answer);
    
    // PHP would have all numeric fields as strings
    const allStrings = 
      typeof faq.id === 'string' && 
      typeof faq.product_id === 'string' && 
      typeof faq.user_id === 'string' && 
      typeof faq.votes === 'string' &&
      typeof faq.answered_by === 'string' && 
      typeof response.total === 'string';
    
    console.log('\nAll numeric fields returned as strings:', allStrings ? 'Yes ✓' : 'No ✗');
    
    // Date format should be YYYY-MM-DD HH:MM:SS
    const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    const correctDateFormat = dateRegex.test(faq.date_added);
    console.log('Date format correct:', correctDateFormat ? 'Yes ✓' : 'No ✗');
  }
}

/**
 * Test adding a product FAQ
 */
async function testAddProductFAQ() {
  console.log('=== Testing add_product_faqs API ===');
  try {
    const testData = {
      product_id: 1, // Make sure this product exists
      user_id: 1,    // Make sure this user exists
      question: "Is this product waterproof?"
    };
    
    console.log('Request data:', testData);
    const response = await makeRequest('add_product_faqs', testData);
    
    console.log('Response:');
    console.log('- Status:', response.error ? 'Error' : 'Success');
    console.log('- Message:', response.message);
    console.log('- Data:', response.data);
    
    // Return the response for further testing
    return response;
  } catch (error) {
    console.error('Error testing add_product_faqs:', error.message);
    return null;
  }
}

/**
 * Test getting product FAQs
 * @param {number} productId - Product ID to get FAQs for
 */
async function testGetProductFAQs(productId = 1) {
  console.log('\n=== Testing get_product_faqs API ===');
  try {
    const testData = {
      product_id: productId
    };
    
    console.log('Request data:', testData);
    const response = await makeRequest('get_product_faqs', testData);
    
    console.log('Response:');
    console.log('- Status:', response.error ? 'Error' : 'Success');
    console.log('- Message:', response.message);
    console.log('- Total FAQs:', response.total);
    
    // Check data types to verify they match PHP
    verifyDataTypes(response);
    
    if (response.data && response.data.length > 0) {
      console.log('\nFirst FAQ:');
      console.log('- ID:', response.data[0].id);
      console.log('- Product ID:', response.data[0].product_id);
      console.log('- User:', response.data[0].username);
      console.log('- Question:', response.data[0].question);
      console.log('- Answer:', response.data[0].answer);
    } else {
      console.log('No FAQs found for this product');
    }
    
    return response;
  } catch (error) {
    console.error('Error testing get_product_faqs:', error.message);
    return null;
  }
}

/**
 * Test with various input types to verify data type handling
 */
async function testDataTypeHandling() {
  console.log('\n=== Testing Data Type Handling ===');
  
  // Test with product_id as string
  console.log('\n> Testing with product_id as string "1":');
  const testStringId = await makeRequest('get_product_faqs', { product_id: "1" });
  console.log('Response status:', testStringId.error ? 'Error' : 'Success');
  
  // Test with product_id as number
  console.log('\n> Testing with product_id as number 1:');
  const testNumberId = await makeRequest('get_product_faqs', { product_id: 1 });
  console.log('Response status:', testNumberId.error ? 'Error' : 'Success');
  
  // Test with weird inputs to check validation
  console.log('\n> Testing with invalid product_id "abc":');
  const testInvalidId = await makeRequest('get_product_faqs', { product_id: "abc" });
  console.log('Response error:', testInvalidId.error);
  console.log('Response message:', testInvalidId.message);
}

/**
 * Run all tests
 */
async function runTests() {
  // First, add a new FAQ
  const addResult = await testAddProductFAQ();
  
  // Then, get FAQs for the same product
  if (addResult && !addResult.error && addResult.data && addResult.data.length > 0) {
    const productId = addResult.data[0].product_id;
    await testGetProductFAQs(productId);
  } else {
    // If adding failed, just test getting FAQs for a default product
    await testGetProductFAQs();
  }
  
  // Test data type handling
  await testDataTypeHandling();
}

// Run the tests
runTests(); 