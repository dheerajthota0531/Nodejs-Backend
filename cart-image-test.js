// Test script for cart image URLs
const http = require('http');

function testCartImages() {
  // First, we need a user ID that has items in their cart
  const data = JSON.stringify({
    user_id: "196" // Using the same user ID from the transaction test
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/app/v1/api/get_user_cart',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('Testing cart image URLs...');
  console.log(`Sending request to: ${options.hostname}:${options.port}${options.path}`);
  
  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(responseData);
        
        console.log('\nAPI Response:');
        console.log('- error:', response.error);
        console.log('- message:', response.message);
        
        // Check if we got any cart items
        if (response.data && response.data.length > 0) {
          console.log(`\nFound ${response.data.length} cart items`);
          
          // Check the first item's image URLs
          const item = response.data[0];
          console.log('\nFirst cart item:');
          console.log('- Product:', item.name);
          console.log('- Quantity:', item.qty);
          
          // Check image URLs
          console.log('\nImage URLs:');
          console.log('- Main image:', item.image);
          console.log('- Small image:', item.image_sm);
          console.log('- Medium image:', item.image_md);
          
          // Verify CDN URL is being used
          const cdnUrl = 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/';
          
          console.log('\nVerifying CDN URLs:');
          if (item.image && item.image.startsWith(cdnUrl)) {
            console.log('✅ Main image is using the CDN URL');
          } else {
            console.log('❌ Main image is NOT using the CDN URL');
          }
          
          if (item.image_sm && item.image_sm.startsWith(cdnUrl)) {
            console.log('✅ Small image is using the CDN URL');
          } else {
            console.log('❌ Small image is NOT using the CDN URL');
          }
          
          if (item.image_md && item.image_md.startsWith(cdnUrl)) {
            console.log('✅ Medium image is using the CDN URL');
          } else {
            console.log('❌ Medium image is NOT using the CDN URL');
          }
        } else {
          console.log('No cart items found for this user');
        }
      } catch (e) {
        console.error('Error parsing response:', e);
        console.log('Raw response (first 200 chars):', responseData.substring(0, 200));
      }
    });
  });
  
  req.on('error', (e) => {
    console.error('Request error:', e.message);
  });
  
  req.write(data);
  req.end();
}

testCartImages(); 