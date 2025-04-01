const settingsModel = require('./models/settings.model');

async function test() {
  console.log('Testing get_settings implementation...');
  
  // Test 1: Get system settings
  console.log('\n-- Test 1: System Settings --');
  const systemSettings = await settingsModel.getSettings('system_settings', true);
  console.log('System settings data types:', 
    Object.keys(systemSettings).map(key => `${key}: ${typeof systemSettings[key]}`).join('\n')
  );
  
  // Test 2: Time slot config
  console.log('\n-- Test 2: Time Slot Config --');
  const timeSlotConfig = await settingsModel.getSettings('time_slot_config', true);
  console.log('Time slot config:', JSON.stringify(timeSlotConfig, null, 2));
  
  // Test 3: Test getAllSettings with user_id
  console.log('\n-- Test 3: getAllSettings with user_id --');
  const allSettings = await settingsModel.getAllSettings('all', { user_id: 1 });
  if (allSettings.system_settings) {
    console.log('Wallet balance amount:', allSettings.system_settings.wallet_balance_amount);
    console.log('Wallet balance type:', typeof allSettings.system_settings.wallet_balance_amount);
  }
  
  // Test 4: Test time_slot_config response structure
  console.log('\n-- Test 4: time_slot_config structure --');
  console.log('time_slot_config is array:', Array.isArray(allSettings.time_slot_config));
  if (Array.isArray(allSettings.time_slot_config) && allSettings.time_slot_config.length > 0) {
    const tsc = allSettings.time_slot_config[0];
    console.log('delivery_starts_from type:', typeof tsc.delivery_starts_from);
    console.log('starting_date:', tsc.starting_date);
  }
  
  // Test 5: Test payment_method getAllSettings
  console.log('\n-- Test 5: Payment Method --');
  const paymentSettings = await settingsModel.getAllSettings('payment_method', { user_id: 1 });
  console.log('Payment settings structure:', Object.keys(paymentSettings).join(', '));
  console.log('is_cod_allowed type:', typeof paymentSettings.is_cod_allowed);
  
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
}); 