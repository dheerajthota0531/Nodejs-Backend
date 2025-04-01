const { getSections } = require('../models/section.model');
const db = require('../config/database');
const { formatResponse } = require('../helpers/functions');

/**
 * Controller function to get sections for the mobile app
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getSectionsController(req, res) {
  try {
    // Extract parameters from request, matching PHP parameter extraction
    const params = {
      limit: (req.body.limit && !isNaN(req.body.limit) && req.body.limit.trim() !== '') ? parseInt(req.body.limit) : 25,
      offset: (req.body.offset && !isNaN(req.body.offset) && req.body.offset.trim() !== '') ? parseInt(req.body.offset) : 0,
      user_id: (req.body.user_id && req.body.user_id.trim() !== '') ? req.body.user_id : 0,
      section_id: (req.body.section_id && req.body.section_id.trim() !== '' && req.body.section_id !== '0') ? req.body.section_id : null,
      attribute_value_ids: req.body.attribute_value_ids || null,
      top_rated_product: req.body.top_rated_product === '1' ? '1' : null,
      p_limit: (req.body.p_limit && req.body.p_limit.trim() !== '') ? parseInt(req.body.p_limit) : 10,
      p_offset: (req.body.p_offset && req.body.p_offset.trim() !== '') ? parseInt(req.body.p_offset) : 0,
      p_order: (req.body.p_order && req.body.p_order.trim() !== '') ? req.body.p_order : 'DESC',
      p_sort: (req.body.p_sort && req.body.p_sort.trim() !== '') ? req.body.p_sort : 'p.id',
      min_price: (req.body.min_price && req.body.min_price.trim() !== '') ? req.body.min_price : 0,
      max_price: (req.body.max_price && req.body.max_price.trim() !== '') ? req.body.max_price : 0,
      discount: req.body.discount || 0,
      zipcode: req.body.zipcode || null
    };
    
    // Validate and normalize sort parameter
    let validatedSort = params.p_sort;
    if (validatedSort === 'id') {
      validatedSort = 'p.id';
    } else if (validatedSort === 'price') {
      validatedSort = 'pv.price';
    } else if (validatedSort === 'date_added') {
      validatedSort = 'p.date_added';
    }
    
    // Validate and normalize order parameter
    let validatedOrder = (params.p_order && ['ASC', 'DESC'].includes(params.p_order.toUpperCase())) 
      ? params.p_order.toUpperCase() 
      : 'DESC';
    
    // Update params with validated values
    params.p_sort = validatedSort;
    params.p_order = validatedOrder;
    
    // Log sort and order values for debugging
    console.log(`Section Controller - Sort: ${validatedSort}, Order: ${validatedOrder}`);
    
    // Validate min and max price
    if (params.min_price && params.max_price) {
      const minPrice = parseFloat(params.min_price);
      const maxPrice = parseFloat(params.max_price);
      
      if (minPrice > maxPrice) {
        return res.status(400).json(formatResponse(
          true, 
          "Min price cannot be greater than max price", 
          []
        ));
      }
    }
    
    // Extract user data for city filtering
    let userCity = '';
    if (params.user_id) {
      try {
        const [userResult] = await db.query('SELECT city FROM users WHERE id = ?', [params.user_id]);
        if (userResult && userResult.length > 0 && userResult[0].city) {
          userCity = userResult[0].city;
        }
      } catch (error) {
        console.log('Error fetching user city:', error);
      }
    }
    
    // Add city to params
    params.city = req.body.city || userCity;
    
    // Validate zipcode if provided
    if (params.zipcode) {
      try {
        // Check if zipcode exists in the database
        const [zipcodeResult] = await db.query('SELECT id FROM zipcodes WHERE zipcode = ?', [params.zipcode]);
        
        if (!zipcodeResult || zipcodeResult.length === 0) {
          return res.status(400).json(formatResponse(
            true, 
            "Products Not Found!", 
            []
          ));
        }
        
        // Add zipcode_id to params for filtering
        params.zipcode_id = zipcodeResult[0].id;
      } catch (error) {
        console.error('Error validating zipcode:', error);
      }
    }
    
    // Call model function
    const result = await getSections(params);
    
    // Send response
    res.json(result);
  } catch (error) {
    console.error('Error in getSectionsController:', error);
    res.status(500).json(formatResponse(
      true,
      error.message || "An error occurred while fetching sections",
      []
    ));
  }
}

module.exports = {
  getSectionsController
}; 