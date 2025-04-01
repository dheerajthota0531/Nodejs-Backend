// Test script to verify popup_offer data structure in settings API response
const http = require('http');

/**
 * Make a GET request to the settings API
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
 * Check if a value is a valid string type
 * @param {*} value - The value to check
 * @returns {boolean} - True if the value is a string, false otherwise
 */
function isValidString(value) {
  return typeof value === 'string';
}

/**
 * Check popup_offer structure
 * @param {Object} popupOffer - The popup_offer object to check
 * @returns {Array} - Array of errors, empty if no errors
 */
function checkPopupOfferStructure(popupOffer) {
  const errors = [];
  
  // Check required fields exist
  const requiredFields = [
    'id', 'is_active', 'show_multiple_time', 'image', 'type', 
    'type_id', 'min_discount', 'max_discount', 'link', 'date_added', 'data'
  ];
  
  requiredFields.forEach(field => {
    if (popupOffer[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Check data types
  if (popupOffer.id !== undefined && !isValidString(popupOffer.id)) {
    errors.push('Field "id" should be a string');
  }
  
  if (popupOffer.is_active !== undefined && !isValidString(popupOffer.is_active)) {
    errors.push('Field "is_active" should be a string');
  }
  
  if (popupOffer.show_multiple_time !== undefined && !isValidString(popupOffer.show_multiple_time)) {
    errors.push('Field "show_multiple_time" should be a string');
  }
  
  if (popupOffer.image !== undefined && !isValidString(popupOffer.image)) {
    errors.push('Field "image" should be a string');
  }
  
  if (popupOffer.type !== undefined && !isValidString(popupOffer.type)) {
    errors.push('Field "type" should be a string');
  }
  
  if (popupOffer.type_id !== undefined && !isValidString(popupOffer.type_id)) {
    errors.push('Field "type_id" should be a string');
  }
  
  if (popupOffer.min_discount !== undefined && !isValidString(popupOffer.min_discount)) {
    errors.push('Field "min_discount" should be a string');
  }
  
  if (popupOffer.max_discount !== undefined && !isValidString(popupOffer.max_discount)) {
    errors.push('Field "max_discount" should be a string');
  }
  
  if (popupOffer.link !== undefined && !isValidString(popupOffer.link)) {
    errors.push('Field "link" should be a string');
  }
  
  if (popupOffer.date_added !== undefined && !isValidString(popupOffer.date_added)) {
    errors.push('Field "date_added" should be a string');
  }
  
  // Check date format: YYYY-MM-DD HH:MM:SS
  if (popupOffer.date_added) {
    const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (!dateRegex.test(popupOffer.date_added)) {
      errors.push('Field "date_added" should be in format "YYYY-MM-DD HH:MM:SS"');
    }
  }
  
  // Check data field is an array
  if (popupOffer.data !== undefined && !Array.isArray(popupOffer.data)) {
    errors.push('Field "data" should be an array');
  }
  
  return errors;
}

/**
 * Main test function
 */
async function runTest() {
  try {
    console.log('Testing settings API to verify popup_offer data structure...');
    const response = await getSettings();
    
    if (response.error) {
      console.error('API returned error:', response.message);
      return;
    }
    
    console.log('Settings API response received successfully');
    
    if (!response.data || !response.data.popup_offer) {
      console.warn('No popup_offer found in response');
      return;
    }
    
    console.log(`Found ${response.data.popup_offer.length} popup offer(s) in response`);
    
    // Check each popup offer
    let allValid = true;
    
    response.data.popup_offer.forEach((offer, index) => {
      console.log(`\nChecking popup_offer[${index}]:`);
      console.log('- ID:', offer.id);
      console.log('- Type:', offer.type);
      console.log('- Type ID:', offer.type_id);
      console.log('- Is Active:', offer.is_active);
      console.log('- Show Multiple Time:', offer.show_multiple_time);
      console.log('- Data array length:', offer.data ? offer.data.length : 'N/A');
      
      const errors = checkPopupOfferStructure(offer);
      
      if (errors.length === 0) {
        console.log('\n✅ Popup offer structure is valid and matches PHP format');
      } else {
        console.log('\n❌ Popup offer structure has the following issues:');
        errors.forEach(error => console.log(`   - ${error}`));
        allValid = false;
      }
      
      // Check data format if data exists
      if (offer.data && offer.data.length > 0) {
        console.log('\nData structure:');
        if (offer.type.toLowerCase() === 'categories') {
          const category = offer.data[0];
          console.log('Category data found:');
          console.log('- ID:', category.id);
          console.log('- Name:', category.name);
          console.log('- Parent ID:', category.parent_id);
          console.log('- Slug:', category.slug);
          console.log('- Image:', category.image ? 'Present' : 'Missing');
          console.log('- Status:', category.status);
        } else if (offer.type.toLowerCase() === 'products') {
          const product = offer.data[0];
          console.log('Product data found:');
          console.log('- ID:', product.id);
          console.log('- Name:', product.name);
          console.log('- Category ID:', product.category_id);
          console.log('- Image:', product.image ? 'Present' : 'Missing');
        }
      }
    });
    
    if (allValid) {
      console.log('\n✅ All popup offers are valid and match PHP format');
    } else {
      console.log('\n❌ Some popup offers have issues - see details above');
    }
    
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runTest(); 