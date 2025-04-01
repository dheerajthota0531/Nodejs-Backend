// Test script to verify time_slot_config structure in settings API response
const http = require('http');

/**
 * Make a POST request to the settings API
 * @returns {Promise<Object>} The API response
 */
function getSettings() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/app/v1/api/get_settings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0
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
    
    req.end();
  });
}

/**
 * Check time_slot_config structure
 * @param {Array} timeSlotConfig - The time_slot_config array to check
 * @returns {Object} - Result of the check
 */
function checkTimeSlotConfigStructure(timeSlotConfig) {
  const result = {
    isValid: true,
    errors: []
  };
  
  // Check if it's an array
  if (!Array.isArray(timeSlotConfig)) {
    result.isValid = false;
    result.errors.push('time_slot_config should be an array');
    return result;
  }
  
  // Check if it has exactly one element
  if (timeSlotConfig.length !== 1) {
    result.isValid = false;
    result.errors.push(`time_slot_config should have exactly one element, found ${timeSlotConfig.length}`);
    return result;
  }
  
  const config = timeSlotConfig[0];
  
  // Check required fields
  const requiredFields = [
    'time_slot_config',
    'is_time_slots_enabled',
    'delivery_starts_from',
    'allowed_days'
  ];
  
  requiredFields.forEach(field => {
    if (config[field] === undefined) {
      result.isValid = false;
      result.errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Check that all values are strings
  Object.keys(config).forEach(key => {
    if (typeof config[key] !== 'string') {
      result.isValid = false;
      result.errors.push(`Field "${key}" should be a string, got ${typeof config[key]}`);
    }
  });
  
  // Check that starting_date is not present
  if (config.starting_date !== undefined) {
    result.isValid = false;
    result.errors.push('Field "starting_date" should not be present in PHP response format');
  }
  
  return result;
}

/**
 * Main test function
 */
async function runTest() {
  try {
    console.log('Testing settings API to verify time_slot_config structure...');
    const response = await getSettings();
    
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
      console.log('\n✅ time_slot_config structure is valid and matches PHP format');
      
      // Show details of the config
      const config = response.data.time_slot_config[0];
      console.log('\ntime_slot_config details:');
      Object.keys(config).forEach(key => {
        console.log(`- ${key}: ${config[key]} (${typeof config[key]})`);
      });
    } else {
      console.log('\n❌ time_slot_config structure has the following issues:');
      checkResult.errors.forEach(error => console.log(`   - ${error}`));
    }
    
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runTest(); 