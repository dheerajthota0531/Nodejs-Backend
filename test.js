// Simple Node.js script to test the API
const http = require('http');

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
  console.log('STATUS:', res.statusCode);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const jsonResponse = JSON.parse(responseData);
      
      console.log('\nAPI Response Success:', !jsonResponse.error);
      console.log('Message:', jsonResponse.message);

      // Check for logo URL
      if (jsonResponse.data && jsonResponse.data.logo && jsonResponse.data.logo.length > 0) {
        console.log('\nLogo URL:', jsonResponse.data.logo[0].value);
        console.log('Uses CDN?', jsonResponse.data.logo[0].value.includes('uzvisimages.blr1.cdn.digitaloceanspaces.com'));
      }
      
      // Check for popup offer
      if (jsonResponse.data && jsonResponse.data.popup_offer && jsonResponse.data.popup_offer.length > 0) {
        console.log('\nPopup Offer Image:', jsonResponse.data.popup_offer[0].image);
        console.log('Uses CDN?', jsonResponse.data.popup_offer[0].image.includes('uzvisimages.blr1.cdn.digitaloceanspaces.com'));
      }
      
      // Check wallet balance
      if (jsonResponse.data && jsonResponse.data.system_settings && jsonResponse.data.system_settings.length > 0) {
        const settings = jsonResponse.data.system_settings[0];
        console.log('\nWallet Balance Amount:', settings.wallet_balance_amount);
        console.log('Type:', typeof settings.wallet_balance_amount);
      }
      
      // Check time slot config
      if (jsonResponse.data && jsonResponse.data.time_slot_config && jsonResponse.data.time_slot_config.length > 0) {
        const tsc = jsonResponse.data.time_slot_config[0];
        console.log('\nDelivery Starts From:', tsc.delivery_starts_from);
        console.log('Type:', typeof tsc.delivery_starts_from);
        console.log('Starting Date:', tsc.starting_date);
      }
      
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response (first 1000 chars):', responseData.substring(0, 1000));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(data);
req.end(); 