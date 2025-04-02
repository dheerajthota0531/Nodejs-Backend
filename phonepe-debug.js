/**
 * PhonePe Debug Helper
 * Tests PhonePe integration using UAT credentials
 */
require('dotenv').config();
const { initiatePayment, isPhonePeAvailable } = require('./services/phonepe.service');

async function debugPhonePe() {
  try {
    console.log('PhonePe Debug Helper');
    console.log('====================');
    console.log('Environment:', process.env.PHONEPE_ENVIRONMENT);
    console.log('Merchant ID:', process.env.PHONEPE_MERCHANT_ID);
    console.log('Client ID:', process.env.PHONEPE_CLIENT_ID);
    console.log('Client Version:', process.env.PHONEPE_CLIENT_VERSION);
    
    // Test PhonePe availability
    console.log('\nTesting PhonePe availability...');
    const available = await isPhonePeAvailable();
    console.log('PhonePe available:', available);
    
    if (available) {
      // Test payment initiation with dummy data
      console.log('\nTesting payment initiation...');
      const paymentData = {
        userId: 'test-user-123',
        orderId: 'test-order-' + Date.now(),
        amount: 1.00, // Minimum amount for testing
        platform: 'web'
      };
      
      console.log('Payment data:', paymentData);
      
      try {
        const response = await initiatePayment(paymentData);
        console.log('\nPayment initiation response:');
        console.log('Success:', response.success);
        console.log('Order ID:', response.orderId);
        console.log('Merchant Order ID:', response.merchantOrderId);
        console.log('Redirect URL:', response.redirectUrl);
        console.log('\nOpen this URL in your browser to test the payment flow:');
        console.log(response.redirectUrl);
      } catch (error) {
        console.error('\nPayment initiation failed:');
        console.error(error);
      }
    } else {
      console.log('\nSkipping payment test as PhonePe is not available');
    }
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

// Run the debug function
console.log('Starting PhonePe debug...');
debugPhonePe()
  .then(() => console.log('\nDebug completed'))
  .catch(error => console.error('\nDebug failed:', error)); 