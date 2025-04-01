const { addTransaction, getTransactions, editTransaction, getUserBalance } = require('../models/transaction.model');
// const { validateToken } = require('../helpers/jwt'); // Temporarily commented out
const { formatResponse } = require('../helpers/functions');
const { verifyPaymentTransaction } = require('../helpers/payment_helper');
const customerModel = require('../models/customer.model');

/**
 * Controller to get transactions
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Response object with transactions data
 */
async function getTransactionsController(req, res) {
  try {
    console.log('Get transactions request received');
    console.log('Body:', req.body);
    
    // Extract parameters from request
    const params = req.body;
    
    // Extract and validate user_id
    const userId = String(params.user_id);
    if (!userId) {
      return res.status(400).json({
        error: true,
        message: "User ID is required",
        data: []
      });
    }
    
    // Extract optional parameters with defaults
    const id = params.id ? String(params.id) : '';
    const transactionType = String(params.transaction_type || 'transaction');
    const type = String(params.type || '');
    const search = String(params.search || '');
    const limit = parseInt(params.limit) || 25;
    const offset = parseInt(params.offset) || 0;
    const sort = String(params.sort || 'id');
    const order = String(params.order || 'DESC');
    
    // Call model function to get transactions
    const result = await getTransactions(
      id,
      userId,
      transactionType,
      type,
      search,
      offset,
      limit,
      sort,
      order
    );
    
    // Get user balance and details
    const balance = await getUserBalance(userId);
    const userDetails = await customerModel.fetchUsers(userId);
    const user = userDetails[0] || {};
    
    // Format response to match PHP structure
    return res.json({
      error: result.error,
      message: "Transactions Retrieved Successfully",
      total: String(result.total),
      balance: String(balance),
      user_data: [{
        id: String(user.id || ''),
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
        cart_total_items: String(user.cart_total_items || '0')
      }],
      data: result.data
    });
  } catch (error) {
    console.error('Error in getTransactionsController:', error);
    return res.status(500).json(formatResponse(
      true,
      error.message || "Failed to get transactions",
      []
    ));
  }
}

/**
 * Controller to add a new transaction
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Response object indicating success/failure
 */
async function addTransactionController(req, res) {
  try {
    const transactionType = String(req.body.transaction_type);
    
    if (transactionType === 'wallet' && req.body.type === 'credit') {
      // Additional validation for wallet credit
      if (!req.body.payment_method) {
        return res.status(400).json({
          error: true,
          message: "Payment method is required for wallet credit",
          data: []
        });
      }
      
      const paymentMethod = String(req.body.payment_method).toLowerCase();
      const txnId = String(req.body.txn_id);
      const userId = String(req.body.user_id);
      
      // Get user details
      const user = await customerModel.fetchUsers(userId);
      if (!user || user.length === 0) {
        return res.status(400).json({
          error: true,
          message: "User not found!",
          data: []
        });
      }
      
      const oldBalance = parseFloat(user[0].balance);
      const skipVerifyTransaction = req.body.skip_verify_transaction === 'true' || req.body.skip_verify_transaction === true;
      
      // Check if transaction already exists
      const connection = await require('../config/database').getConnection();
      const [existingTransaction] = await connection.query(
        'SELECT * FROM transactions WHERE txn_id = ?',
        [txnId]
      );
      connection.release();
      
      if (existingTransaction.length === 0 || 
          (existingTransaction[0].status && existingTransaction[0].status.toLowerCase() !== 'success')) {
        
        if (skipVerifyTransaction === false) {
          // Verify payment transaction
          const payment = await verifyPaymentTransaction(txnId, paymentMethod);
          
          if (payment.error === false) {
            // Update user balance
            const updateResult = await customerModel.updateBalance(payment.amount, userId, 'add');
            
            if (updateResult.error) {
              return res.json({
                error: true,
                message: updateResult.message || "Wallet could not be recharged due to database operation failure",
                amount: String(payment.amount),
                old_balance: String(oldBalance),
                new_balance: String(oldBalance),
                data: payment.data
              });
            }
            
            const newBalance = oldBalance + parseFloat(payment.amount);
            
            // Modify request body for transaction logging
            req.body.message = `${paymentMethod} - Wallet credited on successful payment confirmation.`;
            req.body.amount = String(payment.amount);
            req.body.transaction_type = 'wallet';
            
            // Call model function to add transaction
            const result = await addTransaction(req.body);
            
            // Get updated user details
            const updatedUser = await customerModel.fetchUsers(userId);
            const userData = updatedUser[0] || {};
            
            return res.json({
              error: false,
              message: 'Wallet Transaction Added Successfully',
              amount: String(payment.amount),
              old_balance: String(oldBalance),
              new_balance: String(newBalance),
              user_data: [{
                id: String(userData.id || ''),
                username: String(userData.username || ''),
                email: String(userData.email || ''),
                mobile: String(userData.mobile || ''),
                balance: String(userData.balance || '0'),
                dob: String(userData.dob || ''),
                referral_code: String(userData.referral_code || ''),
                friends_code: String(userData.friends_code || ''),
                cities: String(userData.cities || ''),
                area: String(userData.area || ''),
                street: String(userData.street || ''),
                pincode: String(userData.pincode || ''),
                cart_total_items: String(userData.cart_total_items || '0')
              }],
              data: payment.data || []
            });
          } else {
            return res.json({
              error: true,
              message: payment.message || "Payment verification failed",
              data: []
            });
          }
        }
      }
    }
    
    // For regular transaction or skipped verification
    const result = await addTransaction(req.body);
    
    return res.json(result);
  } catch (error) {
    console.error('Error in addTransactionController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Failed to add transaction',
      data: []
    });
  }
}

/**
 * Controller to edit a transaction
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<Object>} - Response object indicating success/failure
 */
async function editTransactionController(req, res) {
  try {
    console.log('Edit transaction request received');
    console.log('Body:', req.body);
    
    // Validate required fields
    const requiredFields = ['id', 'status', 'txn_id'];
    for (const field of requiredFields) {
      if (req.body[field] === undefined) {
        return res.status(400).json({
          error: true,
          message: `${field} is required`,
          data: []
        });
      }
    }
    
    // Ensure message field is present and convert values to strings
    req.body.message = String(req.body.message || "");
    req.body.id = String(req.body.id);
    req.body.status = String(req.body.status);
    req.body.txn_id = String(req.body.txn_id);
    
    // Call model function to edit transaction
    const result = await editTransaction(req.body);
    
    return res.json({
      error: result.error,
      message: result.error ? result.message : "Transaction Updated Successfully",
      data: result.data.map(item => ({
        ...item,
        id: String(item.id),
        amount: String(item.amount),
        balance: String(item.balance || '0')
      }))
    });
  } catch (error) {
    console.error('Error in editTransactionController:', error);
    return res.status(500).json(formatResponse(
      true,
      error.message || "Failed to edit transaction",
      []
    ));
  }
}

module.exports = {
  getTransactionsController,
  addTransactionController,
  editTransactionController
}; 