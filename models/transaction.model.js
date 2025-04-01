const db = require('../config/database');
const { outputEscaping } = require('../helpers/functions');

/**
 * Add a new transaction
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} - Response object
 */
async function addTransaction(data) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Extract and validate transaction data
    const transactionType = (!data.transaction_type || data.transaction_type === '') 
      ? 'transaction' 
      : data.transaction_type;
    
    const transData = {
      transaction_type: transactionType,
      user_id: data.user_id,
      order_id: data.order_id || null,
      order_item_id: data.order_item_id || null,
      type: String(data.type).toLowerCase(),
      txn_id: data.txn_id || '',
      payu_txn_id: data.payu_txn_id || null,
      currency_code: data.currency_code || null,
      payer_email: data.payer_email || null,
      transaction_date: (data.transaction_date && data.transaction_date !== '') 
        ? new Date(data.transaction_date) 
        : new Date(),
      amount: data.amount,
      status: data.status,
      message: data.message || '',
      is_refund: data.is_refund || '0'
    };
    
    // Insert into transactions table
    const insertColumns = [
      'transaction_type', 'user_id', 'order_id', 'order_item_id', 'type', 
      'txn_id', 'payu_txn_id', 'amount', 'status', 'currency_code', 
      'payer_email', 'message', 'transaction_date', 'is_refund'
    ];

    // Get column names and values for query
    const columns = insertColumns.filter(col => transData[col] !== undefined);
    const values = columns.map(col => transData[col]);
    const placeholders = columns.map(() => '?').join(', ');

    // Construct query
    const insertQuery = `
      INSERT INTO transactions (${columns.join(', ')}) 
      VALUES (${placeholders})
    `;

    // Execute query
    await connection.query(insertQuery, values);
    await connection.commit();
    
    return {
      error: false,
      message: "Transaction added successfully",
      data: transData
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in addTransaction:', error);
    return {
      error: true,
      message: error.message || "Failed to add transaction",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get transactions based on filters
 * @param {string} id - Transaction ID (optional)
 * @param {string} userId - User ID (optional)
 * @param {string} transactionType - Transaction type (transaction/wallet)
 * @param {string} type - Payment type (COD/stripe/razorpay/etc for transaction, credit/debit for wallet)
 * @param {string} search - Search term
 * @param {number} offset - Offset for pagination
 * @param {number} limit - Limit of records to return
 * @param {string} sort - Column to sort by
 * @param {string} order - Sort order (ASC/DESC)
 * @returns {Promise<Object>} - Response object with transactions
 */
async function getTransactions(
  id = '', 
  userId = '', 
  transactionType = 'transaction', 
  type = '', 
  search = '', 
  offset = 0, 
  limit = 25, 
  sort = 'id', 
  order = 'DESC'
) {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Build where conditions
    const whereConditions = [];
    const queryParams = [];
    
    if (userId) {
      whereConditions.push('user_id = ?');
      queryParams.push(userId);
    }
    
    if (id) {
      whereConditions.push('id = ?');
      queryParams.push(id);
    }
    
    if (transactionType) {
      whereConditions.push('transaction_type = ?');
      queryParams.push(transactionType);
    }
    
    if (type) {
      whereConditions.push('type = ?');
      queryParams.push(type);
    }
    
    // Build search conditions if search term provided
    if (search && search !== '') {
      const multipleWhere = [
        'id LIKE ?',
        'transaction_type LIKE ?',
        'type LIKE ?',
        'order_id LIKE ?',
        'txn_id LIKE ?',
        'amount LIKE ?',
        'status LIKE ?',
        'message LIKE ?',
        'transaction_date LIKE ?',
        'date_created LIKE ?'
      ];
      
      whereConditions.push(`(${multipleWhere.join(' OR ')})`);
      const searchTerm = `%${search}%`;
      for (let i = 0; i < multipleWhere.length; i++) {
        queryParams.push(searchTerm);
      }
    }
    
    // Create WHERE clause
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Count total transactions matching criteria
    const countQuery = `SELECT COUNT(id) as total FROM transactions ${whereClause}`;
    const [countResult] = await connection.query(countQuery, queryParams);
    const total = countResult[0].total;
    
    // Validate sort column to prevent SQL injection
    let validSort = 'id';
    if (['id', 'user_id', 'order_id', 'amount', 'status', 'transaction_date', 'date_created'].includes(sort)) {
      validSort = sort;
    }
    
    // Validate order
    const validOrder = order === 'ASC' ? 'ASC' : 'DESC';
    
    // Get transactions with pagination and sorting
    const query = `
      SELECT * FROM transactions 
      ${whereClause} 
      ORDER BY ${validSort} ${validOrder} 
      LIMIT ? OFFSET ?
    `;
    
    // Add limit and offset params
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [transactions] = await connection.query(query, queryParams);
    
    // Process transaction data to match PHP response format
    const data = transactions.map(transaction => {
      return {
        id: transaction.id.toString(),
        transaction_type: transaction.transaction_type || 'wallet',
        user_id: transaction.user_id.toString(),
        order_id: transaction.order_id && transaction.order_id !== 0 ? transaction.order_id.toString() : null,
        order_item_id: transaction.order_item_id && transaction.order_item_id !== 0 ? transaction.order_item_id.toString() : null,
        type: transaction.type || '',
        txn_id: transaction.txn_id || null,
        payu_txn_id: transaction.payu_txn_id || '',
        amount: transaction.amount.toString(),
        status: transaction.status || null,
        currency_code: transaction.currency_code || '',
        payer_email: transaction.payer_email || '',
        message: transaction.message || '',
        transaction_date: transaction.transaction_date ? 
          transaction.transaction_date.toISOString().slice(0, 19).replace('T', ' ') : '',
        date_created: transaction.date_created ? 
          transaction.date_created.toISOString().slice(0, 19).replace('T', ' ') : '',
        is_refund: transaction.is_refund ? transaction.is_refund.toString() : '0'
      };
    });
    
    return {
      error: false,
      message: "Transactions retrieved successfully",
      total: total,
      data: data
    };
  } catch (error) {
    console.error('Error in getTransactions:', error);
    return {
      error: true,
      message: error.message || "Failed to retrieve transactions",
      total: 0,
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Edit transaction details
 * @param {Object} data - Transaction data to update
 * @returns {Promise<Object>} - Response object
 */
async function editTransaction(data) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const transData = {
      id: data.id,
      status: data.status,
      txn_id: data.txn_id,
      message: data.message || ''
    };

    // Update transaction
    await connection.query(
      'UPDATE transactions SET status = ?, txn_id = ?, message = ? WHERE id = ?',
      [transData.status, transData.txn_id, transData.message, transData.id]
    );
    
    await connection.commit();
    
    return {
      error: false,
      message: "Transaction updated successfully",
      data: transData
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in editTransaction:', error);
    return {
      error: true,
      message: error.message || "Failed to update transaction",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get user's wallet balance
 * @param {string} userId - User ID
 * @returns {Promise<string>} - User's wallet balance as a string
 */
async function getUserBalance(userId) {
  let connection;
  try {
    connection = await db.getConnection();
    
    const query = 'SELECT balance FROM users WHERE id = ?';
    const [result] = await connection.query(query, [userId]);
    
    if (result && result.length > 0) {
      return result[0].balance.toString();
    }
    
    return "0";
  } catch (error) {
    console.error('Error in getUserBalance:', error);
    return "0";
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get pending transactions for a specific order
 * @param {number|string} orderId - Order ID
 * @param {number|string} userId - Optional user ID for additional filtering
 * @returns {Promise<Array>} - Array of pending transactions
 */
async function getPendingTransactions(orderId, userId = null) {
  try {
    let query = `
      SELECT * 
      FROM transactions 
      WHERE order_id = ? AND status = 'pending'
    `;
    
    const params = [orderId];
    
    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    
    const [rows] = await db.query(query, params);
    return rows;
  } catch (error) {
    console.error('Error in getPendingTransactions:', error);
    return [];
  }
}

/**
 * Update transaction status
 * @param {Object} data - Transaction data to update (must include id or txn_id + order_id)
 * @returns {Promise<Object>} - Result of update operation
 */
async function updateTransactionStatus(data) {
  try {
    let query, params;
    
    // Check if we have transaction ID
    if (data.id) {
      query = `
        UPDATE transactions 
        SET status = ?, message = ?
        WHERE id = ?
      `;
      params = [data.status, data.message, data.id];
    } 
    // Or use txn_id + order_id
    else if (data.txn_id && data.order_id) {
      query = `
        UPDATE transactions 
        SET status = ?, message = ?
        WHERE txn_id = ? AND order_id = ?
      `;
      params = [data.status, data.message, data.txn_id, data.order_id];
    } 
    else {
      throw new Error('Transaction ID or txn_id + order_id required');
    }
    
    // Add updated timestamp
    query = query.replace('status = ?', 'status = ?, updated_at = NOW()');
    
    const [result] = await db.query(query, params);
    
    if (result.affectedRows > 0) {
      return {
        error: false,
        message: 'Transaction status updated successfully',
        data: { affected_rows: result.affectedRows }
      };
    } else {
      return {
        error: true,
        message: 'No transaction found with provided details',
        data: []
      };
    }
  } catch (error) {
    console.error('Error in updateTransactionStatus:', error);
    return {
      error: true,
      message: error.message || 'Failed to update transaction status',
      data: []
    };
  }
}

module.exports = {
  addTransaction,
  getTransactions,
  editTransaction,
  getUserBalance,
  getPendingTransactions,
  updateTransactionStatus
}; 