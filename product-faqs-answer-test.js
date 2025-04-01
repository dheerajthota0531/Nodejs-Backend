// Test script for answering product FAQs
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
 * Get the most recent FAQ for a product
 * @param {number} productId - Product ID
 * @returns {Promise<number|null>} - Most recent FAQ ID or null if not found
 */
async function getMostRecentFaqId(productId) {
  let connection;
  try {
    // Create a direct database connection
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database
    });
    
    // Get the most recent FAQ for this product
    const [rows] = await connection.execute(
      'SELECT id FROM product_faqs WHERE product_id = ? ORDER BY id DESC LIMIT 1',
      [productId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0].id;
  } catch (error) {
    console.error('Error getting recent FAQ ID:', error);
    return null;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Verify data types in response to match PHP
 * @param {object} response - API response
 */
function verifyDataTypes(response) {
  if (!response || response.error) {
    return;
  }
  
  if (response.data && response.data.length > 0) {
    console.log('\n=== Verifying Data Types ===');
    
    // Get the first FAQ to check
    const faq = response.data[0];
    
    // Check total field
    console.log('total:', typeof response.total, response.total);
    
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
      typeof response.total === 'string';
    
    console.log('\nAll numeric fields returned as strings:', allStrings ? 'Yes ✓' : 'No ✗');
    
    // Date format should be YYYY-MM-DD HH:MM:SS
    const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    const correctDateFormat = dateRegex.test(faq.date_added);
    console.log('Date format correct:', correctDateFormat ? 'Yes ✓' : 'No ✗');
  }
}

/**
 * Test getting product FAQs
 * @param {number} productId - Product ID to get FAQs for
 */
async function testGetProductFAQs(productId = 1) {
  console.log('\n=== Testing get_product_faqs API ===');
  try {
    const testData = {
      product_id: productId
    };
    
    console.log('Request data:', testData);
    const response = await makeRequest('get_product_faqs', testData);
    
    console.log('Response:');
    console.log('- Status:', response.error ? 'Error' : 'Success');
    console.log('- Message:', response.message);
    console.log('- Total FAQs:', response.total);
    
    // Verify data types match PHP format
    verifyDataTypes(response);
    
    if (response.data && response.data.length > 0) {
      console.log('\nFirst FAQ:');
      console.log('- ID:', response.data[0].id);
      console.log('- Product ID:', response.data[0].product_id);
      console.log('- User:', response.data[0].username);
      console.log('- Question:', response.data[0].question);
      console.log('- Answer:', response.data[0].answer);
      console.log('- Answered by:', response.data[0].answered_by_name);
    } else {
      console.log('No FAQs found for this product');
    }
    
    return response;
  } catch (error) {
    console.error('Error testing get_product_faqs:', error.message);
    return null;
  }
}

/**
 * Run the test to get a FAQ, add an answer, and verify it appears in results
 */
async function runTest() {
  // First, let's test with product ID 1
  const productId = 1;
  
  // Get the most recent FAQ ID for this product
  const faqId = await getMostRecentFaqId(productId);
  
  if (!faqId) {
    console.log('No FAQs found for product ID', productId);
    console.log('Please run product-faqs-test.js first to create a FAQ');
    return;
  }
  
  console.log(`Found FAQ ID ${faqId} for product ID ${productId}`);
  
  // Add an answer to this FAQ
  console.log('\n=== Adding answer to FAQ ===');
  const answer = "Yes, this product is fully waterproof and has an IP68 rating.";
  const answeredBy = 1; // Admin user ID
  
  const updated = await updateFaqWithAnswer(faqId, answer, answeredBy);
  
  if (updated) {
    console.log('Successfully added answer to FAQ');
  } else {
    console.log('Failed to add answer to FAQ');
    return;
  }
  
  // Now verify that the FAQ appears in the results
  await testGetProductFAQs(productId);
}

// Run the test
runTest(); 