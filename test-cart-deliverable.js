// Test script to verify check_cart_products_delivarable API
const http = require('http');

/**
 * Make a POST request to the check_cart_products_delivarable API
 * @param {Object} params - Parameters to send
 * @returns {Promise<Object>} The API response
 */
function checkCartDeliverable(params) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(params);
    console.log(`Sending request to check_cart_products_delivarable with params:`, params);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/app/v1/api/check_cart_products_delivarable',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonData.length
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`Status code: ${res.statusCode}`);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log('Received data:', data);
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          console.error(`Error parsing response: ${e.message}`);
          reject(new Error(`Error parsing response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Request error: ${error.message}`);
      reject(error);
    });
    
    req.write(jsonData);
    req.end();
  });
}

/**
 * Run the test with default parameters
 */
async function runTest() {
  try {
    console.log("=== Testing check_cart_products_delivarable API ===");
    
    // First, get user address ID for testing
    const userAddressResponse = await makeApiRequest({
      user_id: "196"
    }, '/app/v1/api/get_address');
    
    console.log('User address response:', JSON.stringify(userAddressResponse, null, 2));
    
    if (userAddressResponse.error || !userAddressResponse.data || userAddressResponse.data.length === 0) {
      console.error("Error: No address found for user 196. Please add an address first.");
      return;
    }
    
    const addressId = userAddressResponse.data[0].id;
    console.log(`Using address ID: ${addressId} for testing deliverability`);
    
    // Test the deliverability API
    const response = await checkCartDeliverable({
      user_id: "196",
      address_id: addressId
    });
    
    console.log("Response received:");
    console.log(JSON.stringify(response, null, 2));
    
    // Verify the response structure
    verifyResponse(response);
    
  } catch (error) {
    console.error("Error running test:", error);
  }
}

/**
 * Helper function to make API requests
 */
function makeApiRequest(params, path) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(params);
    console.log(`Sending request to ${path} with params:`, params);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonData.length
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`Status code for ${path}: ${res.statusCode}`);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          console.log(`Received data from ${path}:`, data.substring(0, 200) + '...');
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          console.error(`Error parsing response from ${path}: ${e.message}`);
          reject(new Error(`Error parsing response from ${path}: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Request error for ${path}: ${error.message}`);
      reject(error);
    });
    
    req.write(jsonData);
    req.end();
  });
}

/**
 * Verify the structure of the response
 * @param {Object} response - The API response
 */
function verifyResponse(response) {
  console.log("\n=== Response Verification ===");

  // Check basic response structure
  if (response.error === undefined) {
    console.error('❌ Missing "error" field in response');
  } else {
    console.log(`✅ Has error field: ${response.error}`);
  }
  
  if (response.message === undefined) {
    console.error('❌ Missing "message" field in response');
  } else {
    console.log(`✅ Has message: "${response.message}"`);
  }
  
  if (response.data === undefined) {
    console.error('❌ Missing "data" field in response');
  } else {
    console.log(`✅ Has data field with ${Array.isArray(response.data) ? response.data.length : 0} items`);
  }
  
  // Check data items structure if available
  if (Array.isArray(response.data) && response.data.length > 0) {
    const firstItem = response.data[0];
    console.log("\nFirst deliverable item structure:");
    
    // Expected fields in each deliverable item
    const expectedFields = [
      'product_id', 'variant_id', 'name', 
      'is_deliverable', 'delivery_by', 'message'
    ];
    
    for (const field of expectedFields) {
      if (firstItem[field] === undefined) {
        console.error(`❌ Missing "${field}" field in deliverable item`);
      } else {
        console.log(`✅ ${field}: ${firstItem[field]}`);
      }
    }
    
    // Count deliverable vs non-deliverable items
    const deliverableCount = response.data.filter(item => item.is_deliverable === true).length;
    const nonDeliverableCount = response.data.filter(item => item.is_deliverable === false).length;
    
    console.log(`\n${deliverableCount} items are deliverable, ${nonDeliverableCount} are not deliverable`);
  }
}

// Run the test
runTest(); 