const db = require('../config/database');
const { outputEscaping } = require('../helpers/functions');

/**
 * Add a new product FAQs entry
 * Direct port of PHP's add_product_faqs function
 * @param {Object} data - Data containing product_id, user_id, question
 * @returns {Promise<Number|Boolean>} - Insert ID if successful, false if failed
 */
async function add_product_faqs(data) {
  try {
    // Prepare the data for insertion
    const faq_data = {
      product_id: data.product_id,
      user_id: data.user_id,
      question: data.question,
      answer: data.answer || '', // Default to empty string
      answered_by: data.answered_by || 0, // Default to 0
      votes: data.votes || 0, // Default to 0
      date_added: new Date() // Current timestamp
    };

    // Insert the data into the database
    const [result] = await db.query(
      'INSERT INTO product_faqs SET ?',
      [faq_data]
    );

    return result.insertId || false;
  } catch (error) {
    console.error('Error in add_product_faqs:', error);
    return false;
  }
}

/**
 * Get product FAQs with optional filters
 * Direct port of PHP's get_product_faqs function
 * @param {Number|String} id - FAQ ID
 * @param {Number|String} product_id - Product ID
 * @param {Number|String} user_id - User ID
 * @param {String} search - Search keyword
 * @param {Number|String} offset - Offset for pagination
 * @param {Number|String} limit - Limit for pagination
 * @param {String} sort - Sort field
 * @param {String} order - Sort order (ASC/DESC)
 * @returns {Promise<Object>} - FAQs data with pagination info
 */
async function get_product_faqs(id = '', product_id = '', user_id = '', search = '', offset = '0', limit = '10', sort = 'id', order = 'DESC') {
  try {
    const whereConditions = [];
    const params = [];

    // Add search conditions if search term provided
    if (search) {
      whereConditions.push(`(
        pf.id LIKE ? OR 
        pf.product_id LIKE ? OR 
        pf.user_id LIKE ? OR 
        pf.question LIKE ? OR 
        pf.answer LIKE ?
      )`);
      
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
    }

    // Add specific filters if provided
    if (id) {
      whereConditions.push('pf.id = ?');
      params.push(id);
    }
    
    if (product_id) {
      whereConditions.push('pf.product_id = ?');
      params.push(product_id);
    }
    
    if (user_id) {
      whereConditions.push('pf.user_id = ?');
      params.push(user_id);
    }

    // Add condition to only fetch FAQs with answers - matching PHP implementation
    whereConditions.push("pf.answer != ''");

    // Build the where clause
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : 
      "WHERE pf.answer != ''";

    // Count total FAQs
    const countQuery = `
      SELECT COUNT(pf.id) as total 
      FROM product_faqs pf
      JOIN users u ON u.id = pf.user_id
      ${whereClause}
    `;
    
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0].total || 0;

    // Get FAQs data with pagination
    const dataQuery = `
      SELECT pf.*, u.username
      FROM product_faqs pf
      JOIN users u ON u.id = pf.user_id
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const [faqResults] = await db.query(dataQuery, dataParams);

    // Prepare the response
    const response = {
      error: faqResults.length === 0,
      message: faqResults.length === 0 ? 'FAQs does not exist' : 'FAQs retrieved successfully',
      total: faqResults.length === 0 ? 0 : total.toString(), // Convert to string to match PHP
      data: []
    };

    if (faqResults.length > 0) {
      // Process each FAQ entry
      for (const row of faqResults) {
        // Apply output escaping (this is a PHP porting function)
        const escapedRow = outputEscaping(row);
        
        // Add answered_by username if available
        let answered_by_name = '';
        if (escapedRow.answered_by && escapedRow.answered_by !== '0') {
          try {
            const [answerUser] = await db.query(
              'SELECT username FROM users WHERE id = ?',
              [escapedRow.answered_by]
            );
            
            if (answerUser && answerUser.length > 0) {
              answered_by_name = answerUser[0].username;
            }
          } catch (error) {
            console.error('Error fetching answerer name:', error);
          }
        }

        // Create formatted row with proper type conversions to match PHP
        const formattedRow = {
          id: escapedRow.id.toString(), // Convert to string to match PHP
          product_id: escapedRow.product_id.toString(), // Convert to string to match PHP
          user_id: escapedRow.user_id.toString(), // Convert to string to match PHP
          username: escapedRow.username || '',
          question: escapedRow.question || '',
          answer: escapedRow.answer !== '' ? escapedRow.answer : '',
          votes: escapedRow.votes.toString(), // Convert to string to match PHP
          answered_by: escapedRow.answered_by ? escapedRow.answered_by.toString() : '', // Convert to string to match PHP
          answered_by_name: answered_by_name,
          date_added: escapedRow.date_added ? new Date(escapedRow.date_added).toISOString().slice(0, 19).replace('T', ' ') : '' // Format date to match PHP
        };
        
        response.data.push(formattedRow);
      }
    }

    return response;
  } catch (error) {
    console.error('Error in get_product_faqs:', error);
    return {
      error: true,
      message: 'Failed to get FAQs due to a server error',
      total: '0', // String '0' to match PHP
      data: []
    };
  }
}

module.exports = {
  add_product_faqs,
  get_product_faqs
}; 