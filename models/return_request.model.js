const db = require('../config/database');
const { formatResponse } = require('../helpers/functions');

/**
 * Check offer validity for order placement
 * @param {number} id - Offer ID
 * @param {string} type - Offer type (cashback or instant_discount)
 * @param {number} amt - Order amount
 * @param {number} user_id - User ID
 * @returns {Promise<Object>} - Response with offer validity
 */
async function check_offer_place_order(id, type, amt, user_id) {
  try {
    if (!id || !user_id || !type || !amt) {
      const message = !user_id ? 'User Id blank' :
                     !id ? 'Offer Id blank' :
                     !type ? 'Offer Type blank' :
                     'Amount is blank';
      
      return {
        error: true,
        message: message
      };
    }
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let query, queryParams;
    
    if (type === 'cashback') {
      query = `
        SELECT cashback_name as offer_name, amount, cashback_percent, max_cashback, 
               end_date as expiry_date, start_date, repeat_usage, no_of_repeat_usage
        FROM cashback
        WHERE id = ?
        AND status = 1
        AND start_date <= ?
        AND end_date >= ?
      `;
      queryParams = [id, today, today];
    } else if (type === 'instant_discount') {
      query = `
        SELECT offer_name, amount, discount_amount as discount, max_discount_amount,
               end_date as expiry_date, start_date, repeat_usage, no_of_repeat_usage
        FROM instant_discount
        WHERE id = ?
        AND status = 1
        AND start_date <= ?
        AND end_date >= ?
      `;
      queryParams = [id, today, today];
    } else {
      return {
        error: true,
        message: 'Invalid offer type'
      };
    }
    
    const [result] = await db.query(query, queryParams);
    
    if (result.length === 0) {
      return {
        error: true,
        message: 'Service not available'
      };
    }
    
    // Check amount criteria
    const offerAmount = parseFloat(result[0].amount);
    const orderAmount = parseFloat(amt);
    
    if (offerAmount < orderAmount) {
      return {
        error: false,
        message: 'Offer is applicable'
      };
    } else {
      return {
        error: true,
        message: `Invalid amount ${type}`
      };
    }
  } catch (error) {
    console.error('Error in check_offer_place_order:', error);
    return {
      error: true,
      message: error.message || 'Failed to check offer'
    };
  }
}

/**
 * Apply offer to placed order
 * @param {number} id - Offer ID
 * @param {string} type - Offer type (cashback or instant_discount)
 * @param {number} amt - Order amount
 * @param {number} user_id - User ID
 * @param {number} order_id - Order ID
 * @param {number} discount - Discount amount
 * @returns {Promise<Object>} - Response with offer application result
 */
async function apply_place_order(id, type, amt, user_id, order_id, discount) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let offerData = {};
    
    if (type === 'cashback') {
      const [result] = await connection.query(
        `SELECT cashback_name as offer_name, amount, cashback_percent, max_cashback, 
                end_date as expiry_date, start_date, repeat_usage, no_of_repeat_usage
         FROM cashback
         WHERE id = ?
         AND status = 1
         AND start_date <= ?
         AND end_date >= ?`,
        [id, today, today]
      );
      
      if (result.length === 0) {
        await connection.rollback();
        return {
          error: true,
          message: 'Cashback offer not available'
        };
      }
      
      // Check number of times used
      const [repeatUsageData] = await connection.query(
        `SELECT repeat_usage, no_of_repeat_usage FROM cashback WHERE id = ?`,
        [id]
      );
      
      const repeatUsage = repeatUsageData[0].repeat_usage;
      const maxRepeatUsage = repeatUsageData[0].no_of_repeat_usage;
      
      // Check if user has used this offer today
      const [apiOfferData] = await connection.query(
        `SELECT no_of_times_used, offer_type, current_date 
         FROM api_apply_offer 
         WHERE user_id = ? 
         AND current_date = ? 
         AND offer_type = ? 
         AND offer_type_id = ?`,
        [user_id, today, type, id]
      );
      
      if (apiOfferData.length > 0) {
        // Update usage count if allowed
        if (repeatUsage == 1) {
          const timesUsed = parseInt(apiOfferData[0].no_of_times_used) + 1;
          
          if (maxRepeatUsage >= timesUsed) {
            await connection.query(
              `UPDATE api_apply_offer 
              SET no_of_times_used = ? 
              WHERE user_id = ? 
              AND offer_type = ? 
              AND offer_type_id = ? 
              AND current_date = ?`,
              [timesUsed, user_id, type, id, today]
            );
          }
        }
      } else {
        // Insert new usage record
        await connection.query(
          `INSERT INTO api_apply_offer 
          (user_id, no_of_times_used, offer_type_id, offer_type, current_date) 
          VALUES (?, ?, ?, ?, ?)`,
          [user_id, 1, id, type, today]
        );
      }
      
      // Create serialized data matching PHP
      const cashbackData = {
        id: id,
        type: type,
        user_id: user_id,
        cashback_name: result[0].offer_name,
        amount: result[0].amount,
        cashback_percent: result[0].cashback_percent,
        max_cashback: result[0].max_cashback,
        start_date: result[0].start_date,
        end_date: result[0].expiry_date,
        repeat_usage: result[0].repeat_usage,
        no_of_repeat_usage: result[0].no_of_repeat_usage,
        offer_discount_amount: discount
      };
      
      // Create an exact PHP-like serialized format that matches PHP's serialize()
      const entries = Object.entries(cashbackData);
      let phpSerializedData = `a:${entries.length}:{`;
      
      entries.forEach(([key, value]) => {
        const keyType = 's'; // String type for key
        const keyLength = key.length;
        let valueType, valueContent;
        
        // Handle different types like PHP does
        if (typeof value === 'string') {
          valueType = 's';
          valueContent = `${value.length}:"${value}"`;
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            valueType = 'i';
            valueContent = `${value}`;
          } else {
            valueType = 'd';
            valueContent = `${value}`;
          }
        } else if (typeof value === 'boolean') {
          valueType = 'b';
          valueContent = `${value ? 1 : 0}`;
        } else if (value === null) {
          valueType = 'N';
          valueContent = '';
        } else {
          // Default to string for other types
          valueType = 's';
          const strValue = String(value);
          valueContent = `${strValue.length}:"${strValue}"`;
        }
        
        phpSerializedData += `${keyType}:${keyLength}:"${key}";${valueType}:${valueContent};`;
      });
      
      phpSerializedData += '}';
      
      // Update order with offer details
      await connection.query(
        `UPDATE orders SET offer_type_details = ? WHERE id = ?`,
        [phpSerializedData, order_id]
      );
      
      // Get order details
      const [orderData] = await connection.query(
        `SELECT final_total, wallet_balance FROM orders WHERE user_id = ? AND id = ?`,
        [user_id, order_id]
      );
      
      if (orderData.length === 0) {
        await connection.rollback();
        return {
          error: true,
          message: 'Order not found'
        };
      }
      
      const totalAmt = parseFloat(orderData[0].final_total || 0);
      const walletBalance = parseFloat(orderData[0].wallet_balance || 0);
      const finalTotal = totalAmt - walletBalance;
      
      // Update order with discount
      await connection.query(
        `UPDATE orders SET final_total = ?, offer_discount = ? WHERE user_id = ? AND id = ?`,
        [finalTotal, discount, user_id, order_id]
      );
      
    } else if (type === 'instant_discount') {
      // Implementation for instant_discount
      const [result] = await connection.query(
        `SELECT offer_name, amount, discount_amount as discount, max_discount_amount,
                start_date, end_date, repeat_usage, no_of_repeat_usage
         FROM instant_discount
         WHERE id = ?
         AND status = 1
         AND start_date <= ?
         AND end_date >= ?`,
        [id, today, today]
      );
      
      if (result.length === 0) {
        await connection.rollback();
        return {
          error: true,
          message: 'Instant discount offer not available'
        };
      }
      
      // Check number of times used
      const [repeatUsageData] = await connection.query(
        `SELECT repeat_usage, no_of_repeat_usage FROM instant_discount WHERE id = ?`,
        [id]
      );
      
      const repeatUsage = repeatUsageData[0].repeat_usage;
      const maxRepeatUsage = repeatUsageData[0].no_of_repeat_usage;
      
      // Check if user has used this offer today
      const [apiOfferData] = await connection.query(
        `SELECT no_of_times_used, offer_type, current_date 
         FROM api_apply_offer 
         WHERE user_id = ? 
         AND current_date = ? 
         AND offer_type = ? 
         AND offer_type_id = ?`,
        [user_id, today, type, id]
      );
      
      if (apiOfferData.length > 0) {
        // Update usage count if allowed
        if (repeatUsage == 1) {
          const timesUsed = parseInt(apiOfferData[0].no_of_times_used) + 1;
          
          if (maxRepeatUsage >= timesUsed) {
            await connection.query(
              `UPDATE api_apply_offer 
              SET no_of_times_used = ? 
              WHERE user_id = ? 
              AND offer_type = ? 
              AND offer_type_id = ? 
              AND current_date = ?`,
              [timesUsed, user_id, type, id, today]
            );
          }
        }
      } else {
        // Insert new usage record
        await connection.query(
          `INSERT INTO api_apply_offer 
          (user_id, no_of_times_used, offer_type_id, offer_type, current_date) 
          VALUES (?, ?, ?, ?, ?)`,
          [user_id, 1, id, type, today]
        );
      }
      
      // Create serialized data matching PHP
      const discountData = {
        id: id,
        type: type,
        user_id: user_id,
        offer_name: result[0].offer_name,
        amount: result[0].amount,
        discount: result[0].discount,
        max_discount_amount: result[0].max_discount_amount,
        start_date: result[0].start_date,
        end_date: result[0].end_date,
        repeat_usage: result[0].repeat_usage,
        no_of_repeat_usage: result[0].no_of_repeat_usage,
        offer_discount_amount: discount
      };
      
      // Create an exact PHP-like serialized format that matches PHP's serialize()
      const entries = Object.entries(discountData);
      let phpSerializedData = `a:${entries.length}:{`;
      
      entries.forEach(([key, value]) => {
        const keyType = 's'; // String type for key
        const keyLength = key.length;
        let valueType, valueContent;
        
        // Handle different types like PHP does
        if (typeof value === 'string') {
          valueType = 's';
          valueContent = `${value.length}:"${value}"`;
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            valueType = 'i';
            valueContent = `${value}`;
          } else {
            valueType = 'd';
            valueContent = `${value}`;
          }
        } else if (typeof value === 'boolean') {
          valueType = 'b';
          valueContent = `${value ? 1 : 0}`;
        } else if (value === null) {
          valueType = 'N';
          valueContent = '';
        } else {
          // Default to string for other types
          valueType = 's';
          const strValue = String(value);
          valueContent = `${strValue.length}:"${strValue}"`;
        }
        
        phpSerializedData += `${keyType}:${keyLength}:"${key}";${valueType}:${valueContent};`;
      });
      
      phpSerializedData += '}';
      
      // Update order with offer details
      await connection.query(
        `UPDATE orders SET offer_type_details = ? WHERE id = ?`,
        [phpSerializedData, order_id]
      );
      
      // Get order details
      const [orderData] = await connection.query(
        `SELECT final_total, wallet_balance FROM orders WHERE user_id = ? AND id = ?`,
        [user_id, order_id]
      );
      
      if (orderData.length === 0) {
        await connection.rollback();
        return {
          error: true,
          message: 'Order not found'
        };
      }
      
      const totalAmt = parseFloat(orderData[0].final_total || 0);
      const walletBalance = parseFloat(orderData[0].wallet_balance || 0);
      const finalTotal = totalAmt - walletBalance;
      
      // Update order with discount
      await connection.query(
        `UPDATE orders SET final_total = ?, offer_discount = ? WHERE user_id = ? AND id = ?`,
        [finalTotal, discount, user_id, order_id]
      );
    }
    
    await connection.commit();
    return {
      error: false,
      message: 'Offer applied successfully'
    };
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in apply_place_order:', error);
    return {
      error: true,
      message: error.message || 'Failed to apply offer'
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  check_offer_place_order,
  apply_place_order
}; 