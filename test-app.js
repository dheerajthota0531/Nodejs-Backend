const http = require('http');

function testGetSettings() {
  const data = JSON.stringify({
    type: 'all',
    user_id: 1
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/app/v1/api/get_settings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('Sending request to:', options.hostname + ':' + options.port + options.path);
  
  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('Response received');
      
      try {
        const jsonResponse = JSON.parse(responseData);
        
        console.log('\nResponse structure:');
        console.log('- error:', jsonResponse.error);
        console.log('- message:', jsonResponse.message);
        console.log('- data fields:', Object.keys(jsonResponse.data || {}).join(', '));

        // Check for image URLs in the response
        console.log('\nChecking image URLs:');
        
        // Check logo URL
        if (jsonResponse.data && jsonResponse.data.logo && jsonResponse.data.logo.length > 0) {
          console.log('- Logo URL:', jsonResponse.data.logo[0].value);
          console.log('- Logo URL uses CDN:', jsonResponse.data.logo[0].value.includes('uzvisimages.blr1.cdn.digitaloceanspaces.com'));
        } else {
          console.log('- No logo found in response');
        }
        
        // Check popup offer image URL if exists
        if (jsonResponse.data && jsonResponse.data.popup_offer && jsonResponse.data.popup_offer.length > 0) {
          console.log('- Popup offer image URL:', jsonResponse.data.popup_offer[0].image);
          console.log('- Popup offer URL uses CDN:', jsonResponse.data.popup_offer[0].image.includes('uzvisimages.blr1.cdn.digitaloceanspaces.com'));
        } else {
          console.log('- No popup offer found in response');
        }
        
        if (jsonResponse.error) {
          console.error('ERROR:', jsonResponse.message);
        } else {
          console.log('\nSUCCESS!');
          
          // Check for system_settings
          if (jsonResponse.data && jsonResponse.data.system_settings && 
              jsonResponse.data.system_settings.length > 0) {
            const settings = jsonResponse.data.system_settings[0];
            console.log('✓ system_settings found!');
            
            // Check for wallet_balance_amount
            if (settings.wallet_balance_amount) {
              console.log('✓ wallet_balance_amount:', settings.wallet_balance_amount);
              console.log('✓ wallet_balance_amount type:', typeof settings.wallet_balance_amount);
            } else {
              console.error('✗ wallet_balance_amount not found in system_settings');
            }
            
            // Check a few other key fields
            if (settings.currency) {
              console.log('✓ currency:', settings.currency);
            }
            
            if (settings.welcome_wallet_balance_on) {
              console.log('✓ welcome_wallet_balance_on:', settings.welcome_wallet_balance_on);
            }
          } else {
            console.error('✗ system_settings not found in response');
          }
          
          // Check time_slot_config
          if (jsonResponse.data && jsonResponse.data.time_slot_config && 
              jsonResponse.data.time_slot_config.length > 0) {
            const tsc = jsonResponse.data.time_slot_config[0];
            console.log('✓ time_slot_config found!');
            console.log('  - delivery_starts_from:', tsc.delivery_starts_from);
            console.log('  - delivery_starts_from type:', typeof tsc.delivery_starts_from);
            console.log('  - starting_date:', tsc.starting_date);
          } else {
            console.error('✗ time_slot_config not found in response');
          }
        }
      } catch (e) {
        console.error('Error parsing response:', e.message);
        console.log('Raw response:', responseData);
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('Request error:', e.message);
  });
  
  req.write(data);
  req.end();
}

console.log('Testing get_settings API...');
testGetSettings(); 