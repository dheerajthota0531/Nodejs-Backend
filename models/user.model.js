/**
 * User model
 * @module user.model
 */
const db = require('../config/database');
const config = require('../config/config');
const { outputEscaping } = require('../helpers/functions');

/**
 * Get user by ID
 * @param {number} userId - User ID
 * @returns {Object|null} - User data or null if not found
 */
async function getUserById(userId) {
  try {
    const connection = await db.getConnection();
    
    // Check which columns exist in the users table
    const [columnsResult] = await connection.query(
      "SHOW COLUMNS FROM users"
    );
    
    // Build column list based on existing columns
    const columns = columnsResult.map(col => col.Field);
    
    // Important fields to include if they exist
    const essentialFields = ['id', 'username', 'email', 'mobile', 'balance', 'referral_code', 'friends_code', 'cities', 'area', 'street', 'pincode', 'dob'];
    
    // Filter out columns that don't exist in the table
    const validColumns = essentialFields.filter(field => columns.includes(field));
    
    // Add date field - could be created_at or date_created depending on schema
    let dateField = '';
    if (columns.includes('date_created')) {
      dateField = 'date_created';
    } else if (columns.includes('created_at')) {
      dateField = 'created_at';
    }
    
    if (dateField) {
      validColumns.push(dateField);
    }
    
    // Build query with verified columns
    const sql = `SELECT ${validColumns.join(', ')} FROM users WHERE id = ?`;
    
    const [rows] = await connection.query(sql, [userId]);
    
    if (rows.length === 0) {
      connection.release();
      return null;
    }
    
    // Format user data to match PHP response
    const userData = {
      id: String(rows[0].id || ''),
      username: rows[0].username || '',
      email: rows[0].email || '',
      mobile: rows[0].mobile || '',
      balance: String(rows[0].balance || '0'),
      dob: rows[0].dob || '',
      referral_code: rows[0].referral_code || '',
      friends_code: rows[0].friends_code || '',
      cities: rows[0].cities || '',
      area: rows[0].area || '',
      street: rows[0].street || '',
      pincode: rows[0].pincode || '',
    };
    
    // Process date field if it exists
    if (dateField && rows[0][dateField]) {
      userData.date_created = rows[0][dateField];
    }
    
    // Check if we need user profile image
    const [profileImgResult] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'profile'"
    );
    
    if (profileImgResult.length > 0 && rows[0].profile) {
      // Format profile image URL with base URL
      const baseUrl = config.baseUrl || 'http://localhost:3000';
      const imgPath = rows[0].profile;
      userData.image = imgPath.startsWith('http') ? 
        imgPath : 
        `${baseUrl}/${imgPath.startsWith('/') ? imgPath.substring(1) : imgPath}`;
    }
    
    // Get cart_total_items count for this user
    let cartCount = "0"; // Default
    try {
      // Check if cart table exists
      const [tablesResult] = await connection.query(
        "SHOW TABLES LIKE 'cart'"
      );
      
      if (tablesResult.length > 0) {
        // Get cart count for this user
        const [cartResult] = await connection.query(
          'SELECT COUNT(*) as cart_count FROM cart WHERE user_id = ?',
          [userId]
        );
        
        if (cartResult && cartResult.length > 0) {
          cartCount = String(cartResult[0].cart_count || "0");
        }
      }
    } catch (error) {
      console.error('Error getting cart data:', error);
      // Continue with default cart count
    }
    
    // Add cart_total_items to user data
    userData.cart_total_items = cartCount;
    
    connection.release();
    return userData;
  } catch (error) {
    console.error('Error in getUserById:', error);
    throw error;
  }
}

module.exports = {
  getUserById
}; 