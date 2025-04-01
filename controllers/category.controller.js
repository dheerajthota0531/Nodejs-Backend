const { getCategories } = require('../models/category.model');
const { formatResponse } = require('../helpers/functions');

/**
 * Get categories
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function getCategoriesController(req, res) {
  try {
    console.log('Request body:', req.body);
    
    // Extract parameters from request body (similar to PHP $_POST)
    const {
      id,
      limit = 25,
      offset = 0,
      sort = 'row_order',
      order = 'ASC',
      has_child_or_item = 'true',
      slug = '',
      ignore_status = '',
      city = ''
    } = req.body;
    
    // Validate and normalize sort parameter
    let validatedSort = sort || 'row_order';
    if (validatedSort === 'id') {
      validatedSort = 'c1.id';
    } else if (validatedSort === 'name') {
      validatedSort = 'c1.name';
    } else if (validatedSort === 'row_order') {
      validatedSort = 'c1.row_order';
    }
    
    // Validate and normalize order parameter
    let validatedOrder = (order && ['ASC', 'DESC'].includes(order.toUpperCase())) 
      ? order.toUpperCase() 
      : 'ASC';
    
    // Log sort and order values for debugging
    console.log(`Category Controller - Sort: ${validatedSort}, Order: ${validatedOrder}`);
    
    // Extract city from user data if available
    let userCity = city;
    if (req.user && req.user.city) {
      userCity = userCity || req.user.city;
    }
    
    // Get categories from the model
    const categories = await getCategories(
      id || null,
      limit,
      offset,
      validatedSort,
      validatedOrder,
      has_child_or_item,
      slug,
      ignore_status,
      userCity
    );
    
    // Get popular categories (sorted by clicks)
    let popularSort = 'c1.clicks';
    let popularOrder = 'DESC';
    
    console.log(`Popular Categories - Sort: ${popularSort}, Order: ${popularOrder}`);
    
    const popularCategories = await getCategories(
      null,
      "",
      "",
      popularSort,
      popularOrder,
      'false',
      "",
      "",
      userCity
    );
    
    // Format the response exactly like the PHP API
    // Match the exact order of fields in the PHP response
    const response = {
      message: categories.length === 0 ? 'Category does not exist' : 'Category retrieved successfully',
      error: categories.length === 0,
      total: categories.length > 0 && categories[0].total ? parseInt(categories[0].total) : 0,
      data: categories || [],
      popular_categories: popularCategories || []
    };
    
    // Add offset if it was provided
    if (offset) {
      response.offset = offset.toString(); // Convert to string to match PHP
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error in getCategoriesController:', error);
    
    // Provide more detailed error message
    const errorMessage = error.sqlMessage || error.message || 'Internal server error';
    
    res.status(500).json(formatResponse(true, errorMessage, []));
  }
}

module.exports = {
  getCategoriesController
};