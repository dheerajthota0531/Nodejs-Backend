// Integration test for product FAQs APIs
const http = require('http');
const mysql = require('mysql2/promise');

// Database config (hardcoded for testing)
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'eshop_db'
};

/**
 * Helper function to directly update a FAQ with an answer using SQL
 * (This is for testing - in a real application, you'd have an API endpoint for this)
 * @param {number} faqId - FAQ ID to update
 * @param {string} answer - Answer text
 * @param {number} answeredBy - User ID of answerer
 * @returns {Promise<boolean>} - True if update was successful
 */
async function updateFaqWithAnswer(faqId, answer, answeredBy) {
  let connection;
  try {
    // Create a direct database connection
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });
    
    // Update the FAQ with an answer
    const [result] = await connection.execute(
      'UPDATE product_faqs SET answer = ?, answered_by = ? WHERE id = ?',
      [answer, answeredBy, faqId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Helper function to make POST requests to the API
 * @param {string} endpoint - API endpoint
 * @param {object} data - Request data
 * @returns {Promise<object>} - API response
 */
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/app/v1/api/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonData.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          resolve(response);
        } catch (e) {
          reject(new Error(`Error parsing response: ${e.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(jsonData);
    req.end();
  });
}

/**
 * Verify data types in response to match PHP
 * @param {object} response - API response
 */
function verifyDataTypes(response) {
  if (!response || response.error) {
    return false;
  }
  
  if (response.data && response.data.length > 0) {
    console.log('\n=== Verifying Data Types ===');
    
    // Get the first FAQ to check
    const faq = response.data[0];
    
    // Check total field if it exists
    if (response.total !== undefined) {
      console.log('total:', typeof response.total, response.total);
    }
    
    // Check all important fields
    console.log('id:', typeof faq.id, faq.id);
    console.log('product_id:', typeof faq.product_id, faq.product_id);
    console.log('user_id:', typeof faq.user_id, faq.user_id);
    console.log('votes:', typeof faq.votes, faq.votes);
    console.log('answered_by:', typeof faq.answered_by, faq.answered_by);
    console.log('question:', typeof faq.question, faq.question);
    console.log('answer:', typeof faq.answer, faq.answer);
    
    // PHP would have all numeric fields as strings
    const allStrings = 
      typeof faq.id === 'string' && 
      typeof faq.product_id === 'string' && 
      typeof faq.user_id === 'string' && 
      typeof faq.votes === 'string' &&
      typeof faq.answered_by === 'string' && 
      (response.total === undefined || typeof response.total === 'string');
    
    console.log('\nAll numeric fields returned as strings:', allStrings ? 'Yes ✓' : 'No ✗');
    
    // Date format should be YYYY-MM-DD HH:MM:SS if present
    if (faq.date_added) {
      const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      const correctDateFormat = dateRegex.test(faq.date_added);
      console.log('Date format correct:', correctDateFormat ? 'Yes ✓' : 'No ✗');
    }
    
    return allStrings;
  }
  
  return false;
}

/**
 * Test adding a product FAQ
 */
async function addProductFAQ() {
  console.log('\n=== 1. Testing add_product_faqs API ===');
  try {
    // Test with both string and numeric IDs to verify type handling
    const testData = {
      product_id: "1", // String instead of number to test conversion
      user_id: 1,      // Number to test different input formats
      question: "Is this product waterproof?",
    };
    
    console.log('Request data:', testData);
    const response = await makeRequest('add_product_faqs', testData);
    
    console.log('Response:');
    console.log('- Status:', response.error ? 'Error' : 'Success');
    console.log('- Message:', response.message);
    
    // Verify data types in the response
    if (response.data && response.data.length > 0) {
      verifyDataTypes(response);
      return response.data[0].id;
    } else {
      console.log('No data returned or FAQ not added successfully');
      return null;
    }
  } catch (error) {
    console.error('Error testing add_product_faqs:', error.message);
    return null;
  }
}

/**
 * Answer a product FAQ
 * @param {number|string} faqId - FAQ ID to answer
 */
async function answerProductFAQ(faqId) {
  console.log(`\n=== 2. Adding answer to FAQ ID ${faqId} ===`);
  
  // Add an answer to this FAQ
  const answer = "Yes, this product is fully waterproof and has an IP68 rating.";
  const answeredBy = 1; // Admin user ID
  
  const updated = await updateFaqWithAnswer(faqId, answer, answeredBy);
  
  if (updated) {
    console.log('Successfully added answer to FAQ');
    return true;
  } else {
    console.log('Failed to add answer to FAQ');
    return false;
  }
}

/**
 * Get product FAQs for a specific product
 * @param {number|string} productId - Product ID to query
 */
async function getProductFAQs(productId) {
  console.log(`\n=== 3. Testing get_product_faqs API for product ${productId} ===`);
  try {
    // Test with string product_id to verify type handling
    const testData = {
      product_id: productId.toString() // Convert to string to test type handling
    };
    
    console.log('Request data:', testData);
    const response = await makeRequest('get_product_faqs', testData);
    
    console.log('Response:');
    console.log('- Status:', response.error ? 'Error' : 'Success');
    console.log('- Message:', response.message);
    console.log('- Total FAQs:', response.total);
    
    // Verify data types
    const typesValid = verifyDataTypes(response);
    console.log('\nData type validation:', typesValid ? 'Passed ✓' : 'Failed ✗');
    
    if (response.data && response.data.length > 0) {
      console.log('\nFirst FAQ:');
      console.log('- ID:', response.data[0].id);
      console.log('- Product ID:', response.data[0].product_id);
      console.log('- User:', response.data[0].username);
      console.log('- Question:', response.data[0].question);
      console.log('- Answer:', response.data[0].answer);
      console.log('- Answered by:', response.data[0].answered_by_name);
      
      return response;
    } else {
      console.log('No FAQs found for this product');
      return null;
    }
  } catch (error) {
    console.error('Error testing get_product_faqs:', error.message);
    return null;
  }
}

/**
 * Run the integration test workflow
 */
async function runIntegrationTest() {
  console.log('=== Starting Product FAQs Integration Test ===');
  console.log('This test will:');
  console.log('1. Add a new product FAQ');
  console.log('2. Add an answer to the FAQ');
  console.log('3. Retrieve the FAQ and verify data types match PHP');
  console.log('===============================================');
  
  // Step 1: Add a new FAQ
  const faqId = await addProductFAQ();
  
  if (!faqId) {
    console.log('Integration test failed: Could not add a new FAQ');
    return;
  }
  
  console.log(`Created FAQ with ID: ${faqId}`);
  
  // Step 2: Add an answer to the FAQ
  const answerSuccess = await answerProductFAQ(faqId);
  
  if (!answerSuccess) {
    console.log('Integration test failed: Could not add an answer to the FAQ');
    return;
  }
  
  // Step 3: Get the FAQ and verify data types
  const getResult = await getProductFAQs(1);
  
  if (!getResult || getResult.error) {
    console.log('Integration test failed: Could not retrieve FAQs');
    return;
  }
  
  console.log('\n=== Integration Test Complete ===');
  console.log('Result:', getResult.error ? 'Failed ✗' : 'Success ✓');
}

// Run the integration test
runIntegrationTest().catch(error => {
  console.error('Error running integration test:', error);
}); 