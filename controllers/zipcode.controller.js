/**
 * Zipcode Controller
 * @module zipcode.controller
 */
const { 
  getZipcodes, 
  isProductDeliverable
} = require('../models/zipcode.model');
const { formatResponse, isExist, fetchDetails, formatDataTypes } = require('../helpers/functions');
const { validate } = require('../helpers/validation');
const { check_cart_products_deliverable } = require('../helpers/zipcode');
const { fetch_details } = require('../helpers/functions');

/**
 * Get zipcodes controller
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function getZipcodesController(req, res) {
  try {
    // Get parameters from request
    const limit = (req.body.limit && !isNaN(req.body.limit) && req.body.limit > 0) 
      ? parseInt(req.body.limit) 
      : 25;
    const offset = (req.body.offset && !isNaN(req.body.offset) && req.body.offset >= 0) 
      ? parseInt(req.body.offset) 
      : 0;
    const search = req.body.search || '';
    
    // Get zipcodes from model
    const zipcodesData = await getZipcodes(search, limit, offset);
    
    // Format data types for consistency with PHP
    zipcodesData.data = formatDataTypes(zipcodesData.data);
    zipcodesData.total = String(zipcodesData.total || "0"); // Ensure total is a string like in PHP
    
    // Send response
    return res.json(zipcodesData);
  } catch (error) {
    console.error('Error in getZipcodesController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

/**
 * Check if product is deliverable to a zipcode
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function isProductDeliverableController(req, res) {
  try {
    // Validate required parameters
    if (!req.body.product_id) {
      return res.json(formatResponse(true, 'Product ID is required'));
    }
    
    if (!req.body.zipcode) {
      return res.json(formatResponse(true, 'Zipcode is required'));
    }
    
    const productId = parseInt(req.body.product_id);
    const zipcode = req.body.zipcode;
    
    // Check if zipcode exists in database
    const isPincodeExists = await isExist({ zipcode }, 'zipcodes');
    
    if (!isPincodeExists) {
      return res.json(formatResponse(true, `Cannot deliver to "${zipcode}".`));
    }
    
    // Get zipcode ID
    const zipcodeData = await fetchDetails('zipcodes', { zipcode }, 'id');
    
    if (!zipcodeData || zipcodeData.length === 0) {
      return res.json(formatResponse(true, `Cannot deliver to "${zipcode}".`));
    }
    
    const zipcodeId = parseInt(zipcodeData[0].id);
    
    // Check if product is deliverable
    const isDeliverable = await isProductDeliverable('zipcode', zipcodeId, productId);
    
    if (isDeliverable) {
      // Store valid zipcode in session (similar to PHP)
      if (req.session) {
        req.session.valid_zipcode = zipcode;
      }
      
      return res.json(formatResponse(false, `Product is deliverable on ${zipcode}.`));
    } else {
      return res.json(formatResponse(true, `Product is not deliverable on ${zipcode}.`));
    }
  } catch (error) {
    console.error('Error in isProductDeliverableController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.'));
  }
}

/**
 * Check if all cart products are deliverable to a given address
 * Direct implementation of PHP check_cart_products_delivarable function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function check_cart_product_deliverable(req, res) {
  try {
    /*
      Required:
      address_id:10 
      user_id:12
    */
    
    // Validation - direct PHP equivalent
    const validationRules = {
      address_id: 'required|numeric',
      user_id: 'required'
    };
    
    const validationResult = validate(req.body, validationRules);
    if (validationResult.error) {
      return res.json({
        error: true,
        message: validationResult.message,
        data: []
      });
    }
    
    // Get address details
    const address_id = req.body.address_id;
    const area_id = await fetch_details('addresses', { id: address_id }, ['area_id', 'area', 'pincode']);
    
    if (!area_id || area_id.length === 0) {
      return res.json({
        error: true,
        message: "Address not available.",
        data: []
      });
    }
    
    const zipcode = area_id[0].pincode;
    
    // Check deliverability
    const product_deliverable = await check_cart_products_deliverable(req.body.user_id, area_id[0].area_id, zipcode);
    
    if (product_deliverable && product_deliverable.length > 0) {
      // Filter non-deliverable products
      const product_not_deliverable = product_deliverable.filter(product => 
        product.is_deliverable === false && product.product_id !== null
      );
      
      // Filter valid products (excluding those with null product_id)
      const valid_products = product_deliverable.filter(product => 
        product.product_id !== null
      );
      
      if (product_not_deliverable && product_not_deliverable.length > 0) {
        return res.json({
          error: true,
          message: "Some of the item(s) are not deliverable on selected address. Try changing address or modify your cart items.",
          data: valid_products
        });
      } else {
        return res.json({
          error: false,
          message: "Product(s) are deliverable.",
          data: valid_products
        });
      }
    } else {
      return res.json({
        error: false,
        message: "Product(s) are deliverable",
        data: []
      });
    }
  } catch (error) {
    console.error('Error in check_cart_product_deliverable:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Internal Server Error',
      data: []
    });
  }
}

module.exports = {
  getZipcodesController,
  isProductDeliverableController,
  check_cart_product_deliverable
}; 