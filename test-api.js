const http = require('http');

// Function to make a POST request to test the API
function testGetSettingsAPI() {
  // API request data
  const data = JSON.stringify({
    type: 'all',
    user_id: 1
  });
  
  console.log('Connecting to server with:', {
    hostname: 'localhost',
    port: 3000,
    path: '/get_settings',
    method: 'POST',
    dataLength: data.length
  });
  
  // Request options
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/get_settings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    },
    timeout: 5000 // 5 second timeout
  };
  
  // Create the request
  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log('Response Headers:', JSON.stringify(res.headers, null, 2));
    
    let responseData = '';
    
    // Collect response data
    res.on('data', (chunk) => {
      console.log(`Received chunk of ${chunk.length} bytes`);
      responseData += chunk;
    });
    
    // Process complete response
    res.on('end', () => {
      console.log(`Total response size: ${responseData.length} bytes`);
      try {
        // Check if response is empty
        if (!responseData.trim()) {
          console.error('Empty response received');
          return;
        }
        
        // Try to determine if it's HTML or JSON
        if (responseData.trim().startsWith('<!DOCTYPE') || responseData.trim().startsWith('<html')) {
          console.error('Received HTML instead of JSON. Server might be running but route is incorrect:');
          console.log(responseData.substring(0, 200) + '...');
          return;
        }
        
        // Parse JSON response
        const jsonResponse = JSON.parse(responseData);
        
        // Log basic response structure
        console.log('Response structure:');
        console.log('- error:', jsonResponse.error);
        console.log('- message:', jsonResponse.message);
        
        // Check if system_settings exists and has wallet_balance_amount
        if (jsonResponse.system_settings) {
          console.log('- wallet_balance_amount:', jsonResponse.system_settings.wallet_balance_amount);
          console.log('- wallet_balance_amount type:', typeof jsonResponse.system_settings.wallet_balance_amount);
        }
        
        // Check time_slot_config structure
        if (jsonResponse.time_slot_config && jsonResponse.time_slot_config.length > 0) {
          console.log('- time_slot_config is array:', Array.isArray(jsonResponse.time_slot_config));
          console.log('- time_slot_config[0] structure:', Object.keys(jsonResponse.time_slot_config[0]).join(', '));
          
          if (jsonResponse.time_slot_config[0].delivery_starts_from) {
            console.log('- delivery_starts_from type:', typeof jsonResponse.time_slot_config[0].delivery_starts_from);
          }
          
          if (jsonResponse.time_slot_config[0].starting_date) {
            console.log('- starting_date:', jsonResponse.time_slot_config[0].starting_date);
          }
        }
      } catch (error) {
        console.error('Error parsing response:', error);
        console.log('Raw response first 200 chars:', responseData.substring(0, 200));
        if (responseData.length > 200) {
          console.log('...(truncated)');
        }
      }
    });
  });
  
  // Handle request errors
  req.on('error', (error) => {
    console.error('Request error:', error.message);
    console.error('Error details:', error);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('Connection refused. Make sure the server is running on port 3000.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('Connection timed out. Server might be running but not responding.');
    }
  });
  
  // Handle timeout
  req.on('timeout', () => {
    console.error('Request timed out after 5 seconds');
    req.destroy();
  });
  
  // Send the request
  console.log('Sending request with data:', data);
  req.write(data);
  req.end();
  console.log('Request sent, waiting for response...');
}

// Run the test
console.log('Testing get_settings API endpoint...');
console.log('Note: Make sure the server is running on port 3000');
testGetSettingsAPI(); 