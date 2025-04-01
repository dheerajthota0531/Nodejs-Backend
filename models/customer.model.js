/**
 * Customer model for user-related operations
 */
const db = require('../config/database');

/**
 * Fetch user details by ID
 * @param {string|number} userId - User ID
 * @returns {Promise<Array>} - User details
 */
async function fetchUsers(userId) {
  let connection;
  try {
    connection = await db.getConnection();
    
    const query = `
      SELECT u.*, 
             COALESCE((SELECT COUNT(*) FROM cart WHERE user_id = u.id), 0) as cart_total_items
      FROM users u 
      WHERE u.id = ?
    `;
    
    const [users] = await connection.query(query, [String(userId)]);
    
    if (!users || users.length === 0) {
      return [];
    }
    
    // Format response to match PHP
    const formattedUsers = users.map(user => ({
      id: String(user.id),
      username: String(user.username || ''),
      email: String(user.email || ''),
      mobile: String(user.mobile || ''),
      balance: String(user.balance || '0'),
      dob: String(user.dob || ''),
      referral_code: String(user.referral_code || ''),
      friends_code: String(user.friends_code || ''),
      cities: String(user.cities || ''),
      area: String(user.area || ''),
      street: String(user.street || ''),
      pincode: String(user.pincode || ''),
      cart_total_items: String(user.cart_total_items || '0'),
      active: String(user.active || '0'),
      created_on: String(user.created_on || ''),
      fcm_id: String(user.fcm_id || ''),
      country_code: String(user.country_code || '91')
    }));
    
    return formattedUsers;
  } catch (error) {
    console.error('Error in fetchUsers:', error);
    return [];
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Update user wallet balance
 * @param {number|string} amount - Amount to add/subtract
 * @param {number|string} userId - User ID
 * @param {string} operation - Operation to perform (add/subtract)
 * @returns {Promise<Object>} - Response object
 */
async function updateBalance(amount, userId, operation = 'add') {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Convert inputs to proper types
    const userIdStr = String(userId);
    const amountNum = parseFloat(amount);
    
    // Get current balance
    const [userResult] = await connection.query(
      'SELECT balance FROM users WHERE id = ?',
      [userIdStr]
    );
    
    if (!userResult || userResult.length === 0) {
      await connection.rollback();
      return {
        error: true,
        message: "User not found",
        data: []
      };
    }
    
    const currentBalance = parseFloat(userResult[0].balance) || 0;
    
    // Validate amount
    if (isNaN(amountNum) || amountNum <= 0) {
      await connection.rollback();
      return {
        error: true,
        message: "Invalid amount",
        data: []
      };
    }
    
    // Calculate new balance
    let newBalance;
    if (operation.toLowerCase() === 'add') {
      newBalance = currentBalance + amountNum;
    } else {
      // For subtract operations, validate sufficient balance
      if (currentBalance < amountNum) {
        await connection.rollback();
        return {
          error: true,
          message: "Insufficient balance",
          data: []
        };
      }
      newBalance = currentBalance - amountNum;
    }
    
    // Update balance using direct SQL update
    await connection.query(
      'UPDATE users SET balance = ? WHERE id = ?',
      [newBalance, userIdStr]
    );
    
    await connection.commit();
    
    return {
      error: false,
      message: "Balance updated successfully",
      data: {
        old_balance: String(currentBalance),
        new_balance: String(newBalance)
      }
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in updateBalance:', error);
    return {
      error: true,
      message: error.message || "Failed to update balance",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  fetchUsers,
  updateBalance
}; 