// Test script to verify time_slot_config structure in settings API response with type=payment_method
const http = require('http');

/**
 * Make a POST request to the settings API with specific parameters
 * @param {Object} params - Parameters to send
 * @returns {Promise<Object>} The API response
 */
function getSettings(params) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(params);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/app/v1/api/get_settings',
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
 * Check time_slot_config structure
 * @param {Object} timeSlotConfig - The time_slot_config object to check
 * @returns {Object} - Result of the check
 */
function checkTimeSlotConfigStructure(timeSlotConfig) {
  const result = {
    isValid: true,
    errors: []
  };
  
  // For payment_method type, time_slot_config should be an object, not an array
  if (Array.isArray(timeSlotConfig)) {
    result.isValid = false;
    result.errors.push('time_slot_config should be an object, not an array');
    return result;
  }
  
  // Check required fields
  const requiredFields = [
    'time_slot_config',
    'is_time_slots_enabled',
    'delivery_starts_from',
    'allowed_days'
  ];
  
  requiredFields.forEach(field => {
    if (timeSlotConfig[field] === undefined) {
      result.isValid = false;
      result.errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Check that all values are strings
  Object.keys(timeSlotConfig).forEach(key => {
    if (typeof timeSlotConfig[key] !== 'string') {
      result.isValid = false;
      result.errors.push(`Field "${key}" should be a string, got ${typeof timeSlotConfig[key]}`);
    }
  });
  
  // Check that starting_date is not present
  if (timeSlotConfig.starting_date !== undefined) {
    result.isValid = false;
    result.errors.push('Field "starting_date" should not be present in PHP response format');
  }
  
  return result;
}

/**
 * Run test with default parameters
 */
async function testWithPaymentMethodType() {
  try {
    console.log('Testing settings API with type=payment_method...');
    const params = {
      type: 'payment_method',
      user_id: '196'
    };
    
    console.log('Request parameters:', params);
    const response = await getSettings(params);
    
    if (response.error) {
      console.error('API returned error:', response.message);
      return;
    }
    
    console.log('Settings API response received successfully');
    
    if (!response.data || !response.data.time_slot_config) {
      console.warn('No time_slot_config found in response');
      return;
    }
    
    console.log('time_slot_config found in response:');
    console.log(JSON.stringify(response.data.time_slot_config, null, 2));
    
    // Check structure
    const checkResult = checkTimeSlotConfigStructure(response.data.time_slot_config);
    
    if (checkResult.isValid) {
      console.log('\n✅ time_slot_config structure is valid and matches PHP format for payment_method type');
      
      // Show details of the config
      const config = response.data.time_slot_config;
      console.log('\ntime_slot_config details:');
      Object.keys(config).forEach(key => {
        console.log(`- ${key}: ${config[key]} (${typeof config[key]})`);
      });
    } else {
      console.log('\n❌ time_slot_config structure has the following issues:');
      checkResult.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    // Check is_cod_allowed is present and is a number 1
    if (response.data.is_cod_allowed !== undefined) {
      console.log('\nChecking is_cod_allowed field:');
      console.log(`- Value: ${response.data.is_cod_allowed}`);
      console.log(`- Type: ${typeof response.data.is_cod_allowed}`);
      
      if (typeof response.data.is_cod_allowed === 'number' && response.data.is_cod_allowed === 1) {
        console.log('✅ is_cod_allowed is correctly a number 1');
      } else {
        console.log('❌ is_cod_allowed should be a number 1, got:', typeof response.data.is_cod_allowed, response.data.is_cod_allowed);
      }
    } else {
      console.log('❌ is_cod_allowed field is missing from the response');
    }
    
  } catch (error) {
    console.error('Error running test:', error);
  }
}

/**
 * Compare with all settings (default) type
 */
async function testWithDefaultType() {
  try {
    console.log('\nTesting settings API with default type (all)...');
    const params = {};
    
    console.log('Request parameters:', params);
    const response = await getSettings(params);
    
    if (response.error) {
      console.error('API returned error:', response.message);
      return;
    }
    
    console.log('Settings API response received successfully');
    
    if (!response.data || !response.data.time_slot_config) {
      console.warn('No time_slot_config found in response');
      return;
    }
    
    console.log('time_slot_config found in response:');
    console.log(JSON.stringify(response.data.time_slot_config, null, 2));
    
    // For default type, time_slot_config should be an array
    if (Array.isArray(response.data.time_slot_config)) {
      console.log('\n✅ time_slot_config is correctly an array for default type');
    } else {
      console.log('\n❌ time_slot_config should be an array for default type, but got:', typeof response.data.time_slot_config);
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

/**
 * Main test function
 */
async function runTest() {
  console.log('=== Testing time_slot_config structure with different parameters ===\n');
  
  // Test with payment_method type
  await testWithPaymentMethodType();
  
  // Test with default type
  await testWithDefaultType();
  
  console.log('\n=== Test complete ===');
}

// Run the test
runTest(); 