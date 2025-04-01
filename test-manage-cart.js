// Test script to verify manage_cart response structure
const http = require('http');

/**
 * Make a POST request to the manage_cart API
 * @param {Object} params - Parameters to send
 * @returns {Promise<Object>} The API response
 */
function manageCart(params) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(params);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/app/v1/api/manage_cart',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonData.length
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
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
 * Verify the structure of the cart response
 * @param {Object} response - The API response
 */
function verifyResponse(response) {
  console.log("=== Response verification ===");

  // Check top-level properties
  const expectedProperties = [
    'error', 'message', 'total_quantity', 'sub_total', 'tax_percentage',
    'tax_amount', 'overall_amount', 'total_arr', 'variant_id', 'cart', 'data'
  ];
  
  const missingProperties = expectedProperties.filter(prop => 
    response[prop] === undefined
  );
  
  if (missingProperties.length > 0) {
    console.error('❌ Missing properties:', missingProperties.join(', '));
  } else {
    console.log('✅ All required top-level properties present');
  }
  
  // Check data structure
  if (response.data) {
    if (typeof response.data === 'object' && !Array.isArray(response.data)) {
      console.log('✅ data field is an object as expected in PHP response');
      
      // Check specific data properties
      const expectedDataProps = [
        'total_quantity', 'sub_total', 'total_items', 'tax_percentage',
        'tax_amount', 'cart_count', 'max_items_cart', 'overall_amount'
      ];
      
      const missingDataProps = expectedDataProps.filter(prop => 
        response.data[prop] === undefined
      );
      
      if (missingDataProps.length > 0) {
        console.error('❌ Missing data properties:', missingDataProps.join(', '));
      } else {
        console.log('✅ All required data properties present');
      }
    } else {
      console.error('❌ data field should be an object, not an array or other type');
    }
  } else {
    console.error('❌ data field is missing');
  }
  
  // Check cart array
  if (response.cart && Array.isArray(response.cart)) {
    console.log('✅ cart field is an array as expected');
    
    if (response.cart.length > 0) {
      // Check the first cart item
      const firstItem = response.cart[0];
      console.log(`Found ${response.cart.length} items in cart`);
      
      // Check product_variants
      if (firstItem.product_variants && Array.isArray(firstItem.product_variants)) {
        console.log('✅ product_variants is an array as expected');
        
        if (firstItem.product_variants.length > 0) {
          const variant = firstItem.product_variants[0];
          const variantProps = ['id', 'product_id', 'attribute_value_ids', 'attribute_set', 
                               'price', 'special_price', 'sku', 'stock', 'variant_values', 'attr_name'];
          
          const missingVariantProps = variantProps.filter(prop => 
            variant[prop] === undefined
          );
          
          if (missingVariantProps.length > 0) {
            console.error('❌ Missing variant properties:', missingVariantProps.join(', '));
          } else {
            console.log('✅ All required variant properties present');
          }
        } else {
          console.error('❌ product_variants array is empty');
        }
      } else {
        console.error('❌ product_variants is missing or not an array');
      }
      
      // Check product_details
      if (firstItem.product_details && Array.isArray(firstItem.product_details)) {
        console.log('✅ product_details is an array as expected');
        
        if (firstItem.product_details.length > 0) {
          const product = firstItem.product_details[0];
          const productProps = ['id', 'name', 'category_id', 'short_description', 
                              'minimum_order_quantity', 'quantity_step_size', 'total_allowed_quantity'];
          
          const missingProductProps = productProps.filter(prop => 
            product[prop] === undefined
          );
          
          if (missingProductProps.length > 0) {
            console.error('❌ Missing product properties:', missingProductProps.join(', '));
          } else {
            console.log('✅ All required product properties present');
          }
        } else {
          console.error('❌ product_details array is empty');
        }
      } else {
        console.error('❌ product_details is missing or not an array');
      }
    } else {
      console.log('ℹ️ cart array is empty');
    }
  } else {
    console.error('❌ cart field is missing or not an array');
  }
  
  // Check data types
  console.log("\n=== Data Type Verification ===");
  console.log(`total_quantity: ${response.total_quantity} (${typeof response.total_quantity})`);
  console.log(`sub_total: ${response.sub_total} (${typeof response.sub_total})`);
  console.log(`overall_amount: ${response.overall_amount} (${typeof response.overall_amount})`);
  console.log(`total_arr: ${response.total_arr} (${typeof response.total_arr})`);
  
  // In PHP, total_arr is a number while other numeric values are strings
  if (typeof response.total_arr === 'number') {
    console.log('✅ total_arr is a number as expected in PHP response');
  } else {
    console.error('❌ total_arr should be a number');
  }
  
  if (typeof response.total_quantity === 'string' && 
      typeof response.sub_total === 'string' && 
      typeof response.overall_amount === 'string') {
    console.log('✅ Numeric values (except total_arr) are strings as expected in PHP response');
  } else {
    console.error('❌ Some numeric values should be strings to match PHP response');
  }
}

/**
 * Run the test with specific parameters
 */
async function runTest() {
  try {
    console.log("=== Testing manage_cart API ===");
    console.log("Parameters: user_id=196, product_variant_id=579, qty=1");
    
    const response = await manageCart({
      user_id: "196",
      product_variant_id: "579",
      qty: "1"
    });
    
    console.log("Response received:");
    console.log(JSON.stringify(response, null, 2).substring(0, 300) + "...");
    
    // Verify the response structure
    verifyResponse(response);
    
  } catch (error) {
    console.error("Error running test:", error);
  }
}

// Run the test
runTest(); 