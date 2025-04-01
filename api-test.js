const http = require('http');

// Function to make a POST request to test the API
function testGetSettingsAPI() {
  // API request data
  const data = JSON.stringify({
    type: 'all',
    user_id: 1
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
    }
  };
  
  console.log('Sending request to:', options.hostname + ':' + options.port + options.path);
  console.log('Request data:', data);
  
  // Create the request
  const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    
    let responseData = '';
    
    // Collect response data
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    // Process complete response
    res.on('end', () => {
      console.log('Response received');
      if (responseData) {
        try {
          // Parse JSON response
          const jsonResponse = JSON.parse(responseData);
          
          // Log basic response structure
          console.log('Response structure:');
          console.log('- error:', jsonResponse.error);
          console.log('- message:', jsonResponse.message);
          
          if (jsonResponse.error) {
            console.log('Error in response:', jsonResponse.message);
          } else {
            console.log('Success! Data fields:', Object.keys(jsonResponse.data).join(', '));
            
            // Check if system_settings exists and has wallet_balance_amount
            if (jsonResponse.data && 
                jsonResponse.data.system_settings && 
                jsonResponse.data.system_settings.length > 0) {
              const settings = jsonResponse.data.system_settings[0];
              console.log('- system_settings present with wallet_balance_amount:', 
                          settings.wallet_balance_amount);
            }
          }
        } catch (error) {
          console.error('Error parsing response:', error);
          console.log('Raw response (first 200 chars):', responseData.substring(0, 200));
        }
      } else {
        console.log('Empty response received');
      }
    });
  });
  
  // Handle request errors
  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });
  
  // Send the request
  req.write(data);
  req.end();
}

// Run the test
console.log('Testing get_settings API...');
testGetSettingsAPI(); 