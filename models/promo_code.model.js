/**
 * Promo code model
 * Direct port of PHP's Promo_code_model
 */
const db = require('../config/database');

/**
 * Get promo codes
 * Direct port of PHP's get_promo_codes function
 * @param {Number|String} limit - Result limit
 * @param {Number|String} offset - Result offset
 * @param {String} sort - Sort field
 * @param {String} order - Sort order
 * @param {String} search - Search term
 * @returns {Promise<Object>} - Promo codes data
 */
async function get_promo_codes(limit = 25, offset = 0, sort = 'id', order = 'DESC', search = '') {
  try {
    // Build query based on parameters
    let where_clause = '';
    const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    where_clause = `WHERE status = 1 AND (start_date <= '${currentDate}' AND end_date >= '${currentDate}')`;
    
    if (search && search.trim() !== '') {
      where_clause += ` AND (promo_code LIKE '%${search}%' OR message LIKE '%${search}%')`;
    }
    
    try {
      // Count total result
      const [countResult] = await db.query(`
        SELECT COUNT(id) as total FROM promo_codes ${where_clause}
      `);
      
      const total = countResult[0]?.total || 0;
      
      // Get promo codes
      let query = `
        SELECT * FROM promo_codes ${where_clause}
        ORDER BY ${sort} ${order}
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const [rows] = await db.query(query);
      
      // Return in same format as PHP
      return {
        total: total,
        data: rows || []
      };
    } catch (error) {
      // Handle case when promo_codes table doesn't exist
      if (error.code === 'ER_NO_SUCH_TABLE') {
        console.log('promo_codes table does not exist');
        return {
          total: 0,
          data: []
        };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in get_promo_codes:', error);
    return {
      total: 0,
      data: []
    };
  }
}

module.exports = {
  get_promo_codes
}; 