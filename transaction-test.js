// Test script for transactions API
const http = require('http');

function testTransactionsAPI() {
  const data = JSON.stringify({
    user_id: "196",
    transaction_type: "wallet"
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/app/v1/api/transactions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  console.log('Testing transactions API...');
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
        
        // Log the full response as JSON
        console.log('\nFull response:');
        console.log(JSON.stringify(response, null, 2).substring(0, 2000) + '...');
        
        // Check response structure
        console.log('\nResponse format:');
        console.log('- error:', response.error);
        console.log('- message:', response.message);
        console.log('- total:', response.total, `(type: ${typeof response.total})`);
        console.log('- balance:', response.balance, `(type: ${typeof response.balance})`);
        
        // Check user_data
        if (response.user_data && response.user_data.length > 0) {
          console.log('\nUser data format:');
          const user = response.user_data[0];
          Object.keys(user).forEach(key => {
            console.log(`- ${key}: ${user[key]} (type: ${typeof user[key]})`);
          });
        }
        
        // Check transaction data structure
        if (response.data && response.data.length > 0) {
          console.log('\nTransaction data format (first item):');
          const transaction = response.data[0];
          Object.keys(transaction).forEach(key => {
            console.log(`- ${key}: ${transaction[key] === null ? 'null' : transaction[key]} (type: ${typeof transaction[key]})`);
          });
          
          // Verify required fields for PHP compatibility
          const requiredFields = [
            'id', 'transaction_type', 'user_id', 'order_id', 'order_item_id', 
            'type', 'txn_id', 'payu_txn_id', 'amount', 'status', 
            'currency_code', 'payer_email', 'message', 
            'transaction_date', 'date_created', 'is_refund'
          ];
          
          console.log('\nChecking required fields:');
          const missingFields = requiredFields.filter(field => !Object.keys(transaction).includes(field));
          if (missingFields.length > 0) {
            console.log('❌ Missing fields:', missingFields.join(', '));
          } else {
            console.log('✅ All required fields are present');
          }
          
          // Check if the response matches PHP structure
          console.log('\nPHP compatibility check:');
          
          // Check order_id and order_item_id are null (not "0")
          if (transaction.order_id === null || transaction.order_item_id === null) {
            console.log('✅ order_id/order_item_id format matches PHP (null)');
          } else {
            console.log('❌ order_id/order_item_id format does not match PHP (should be null, not "0")');
          }
          
          // Check transaction_type is present
          if ('transaction_type' in transaction) {
            console.log('✅ transaction_type field is present');
          } else {
            console.log('❌ transaction_type field is missing');
          }
          
          // Check is_refund is present
          if ('is_refund' in transaction) {
            console.log('✅ is_refund field is present');
          } else {
            console.log('❌ is_refund field is missing');
          }
          
          // Check for balance field (should not be in individual transactions)
          if ('balance' in transaction) {
            console.log('❌ balance field should not be in individual transactions');
          } else {
            console.log('✅ balance field correctly not included in transaction data');
          }
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

testTransactionsAPI(); 