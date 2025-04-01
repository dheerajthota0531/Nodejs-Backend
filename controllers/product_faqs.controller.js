const productFaqsModel = require('../models/product_faqs.model');
const userModel = require('../models/user.model');
const { validateRequired } = require('../helpers/functions');

/**
 * Add Product FAQs controller
 * Direct port of PHP's add_product_faqs function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function addProductFaqsController(req, res) {
  try {
    // Validate required fields
    const requiredFields = ['product_id', 'user_id', 'question'];
    const missingFields = validateRequired(req.body, requiredFields);
    
    if (missingFields.length > 0) {
      return res.json({
        error: true,
        message: `${missingFields.join(', ')} field(s) required.`,
        data: []
      });
    }
    
    // Extract data from request
    // In PHP, these are automatically handled as numeric types by filter_input
    const product_id = parseInt(req.body.product_id);
    const user_id = parseInt(req.body.user_id);
    const question = req.body.question;
    
    // Make sure numeric fields are valid
    if (isNaN(product_id) || isNaN(user_id)) {
      return res.json({
        error: true,
        message: "Product ID and User ID must be numeric values",
        data: []
      });
    }
    
    // Verify that user exists
    const user = await userModel.getUserById(user_id);
    if (!user) {
      return res.json({
        error: true,
        message: "User not found!",
        data: []
      });
    }
    
    // Prepare data for model
    const faqData = {
      product_id,
      user_id,
      question
    };
    
    // Add FAQ to database
    const insert_id = await productFaqsModel.add_product_faqs(faqData);
    
    if (!insert_id) {
      return res.json({
        error: true,
        message: "FAQS Not Added",
        data: []
      });
    }
    
    // Get the newly added FAQ
    const result = await productFaqsModel.get_product_faqs(insert_id, product_id, user_id);
    
    return res.json({
      error: false,
      message: "FAQS added Successfully",
      data: result.data
    });
  } catch (error) {
    console.error('Error in addProductFaqsController:', error);
    return res.json({
      error: true,
      message: "An error occurred while adding FAQ",
      data: []
    });
  }
}

/**
 * Get Product FAQs controller
 * Direct port of PHP's get_product_faqs function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function getProductFaqsController(req, res) {
  try {
    // Extract parameters with defaults - matching PHP's behavior with empty strings
    let id = '';
    let product_id = '';
    let user_id = '';
    
    // Handle id parameter (PHP accepts both string and numeric values)
    if (req.body.id !== undefined && req.body.id !== null && req.body.id.toString().trim() !== '') {
      // Check if it's numeric (PHP does this validation separately)
      if (!/^\d+$/.test(req.body.id.toString().trim())) {
        return res.json({
          error: true,
          message: "FAQs ID must be numeric",
          data: []
        });
      }
      id = req.body.id.toString().trim();
    }
    
    // Handle product_id parameter
    if (req.body.product_id !== undefined && req.body.product_id !== null && req.body.product_id.toString().trim() !== '') {
      // Check if it's numeric (PHP does this validation separately)
      if (!/^\d+$/.test(req.body.product_id.toString().trim())) {
        return res.json({
          error: true,
          message: "Product ID must be numeric",
          data: []
        });
      }
      product_id = req.body.product_id.toString().trim();
    }
    
    // Handle user_id parameter
    if (req.body.user_id !== undefined && req.body.user_id !== null && req.body.user_id.toString().trim() !== '') {
      // Check if it's numeric (PHP does this validation separately)
      if (!/^\d+$/.test(req.body.user_id.toString().trim())) {
        return res.json({
          error: true,
          message: "User ID must be numeric",
          data: []
        });
      }
      user_id = req.body.user_id.toString().trim();
    }
    
    // Other parameters
    const search = req.body.search && req.body.search.toString().trim() !== '' ? req.body.search.toString().trim() : '';
    
    // PHP uses numeric checks and defaults
    const limit = req.body.limit && !isNaN(parseInt(req.body.limit)) ? parseInt(req.body.limit) : 10;
    const offset = req.body.offset && !isNaN(parseInt(req.body.offset)) ? parseInt(req.body.offset) : 0;
    
    // String params - must be trimmed and defaulted like PHP
    const order = req.body.order && req.body.order.toString().trim() !== '' ? req.body.order.toString().trim() : 'DESC';
    const sort = req.body.sort && req.body.sort.toString().trim() !== '' ? req.body.sort.toString().trim() : 'id';
    
    // Get FAQs data
    const result = await productFaqsModel.get_product_faqs(
      id, product_id, user_id, 
      search, offset, limit, 
      sort, order
    );
    
    // Return result directly (already formatted by model)
    return res.json(result);
  } catch (error) {
    console.error('Error in getProductFaqsController:', error);
    return res.json({
      error: true,
      message: "An error occurred while fetching FAQs",
      data: [],
      total: '0' // Using string '0' to match PHP
    });
  }
}

module.exports = {
  addProductFaqsController,
  getProductFaqsController
}; 