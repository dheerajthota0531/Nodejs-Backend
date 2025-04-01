const favoriteModel = require('../models/favorite.model');
// Removing the validateToken import since we won't use it
// const { validateToken } = require('../helpers/jwt');

/**
 * Add a product to favorites
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function addToFavoritesController(req, res) {
  try {
    // Removing token validation for testing purposes
    // const tokenValidation = await validateToken(req);
    // if (!tokenValidation.valid) {
    //   return res.status(401).json({
    //     error: true,
    //     message: tokenValidation.message,
    //     data: []
    //   });
    // }

    // Validate required parameters
    const { user_id, product_id } = req.body;
    if (!user_id || !product_id) {
      return res.status(400).json({
        error: true,
        message: "User ID and Product ID are required",
        data: []
      });
    }

    // Add to favorites
    const result = await favoriteModel.addToFavorites(user_id, product_id);
    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in addToFavoritesController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || "Failed to add to favorites",
      data: []
    });
  }
}

/**
 * Remove a product from favorites
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function removeFromFavoritesController(req, res) {
  try {
    // Note: PHP doesn't validate token for this endpoint
    
    // Validate required parameters
    const { user_id, product_id } = req.body;
    if (!user_id) {
      return res.status(400).json({
        error: true,
        message: "User ID is required",
        data: []
      });
    }

    // Remove from favorites
    const result = await favoriteModel.removeFromFavorites(user_id, product_id || null);
    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in removeFromFavoritesController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || "Failed to remove from favorites",
      data: []
    });
  }
}

/**
 * Controller to get favorites
 * @param {Object} req - Request object
 * @param {Object} res - Response object 
 * @returns {Promise<Object>} - JSON response
 */
async function getFavoritesController(req, res) {
  try {
    // Extract parameters (support both query and body parameters)
    const userId = req.body.user_id || req.query.user_id;
    const limit = req.body.limit || req.query.limit || 25;
    const offset = req.body.offset || req.query.offset || 0;
    
    // Check required parameters
    if (!userId) {
      return res.json({
        error: true,
        message: "User ID is required",
        total: 0,
        data: []
      });
    }
    
    // Get favorites data
    const result = await favoriteModel.getFavorites(userId, limit, offset);
    
    // Return response
    return res.json(result);
    
  } catch (error) {
    console.error("Error in getFavoritesController:", error);
    return res.json({
      error: true,
      message: error.message || "Failed to get favorites",
      total: 0,
      data: []
    });
  }
}

module.exports = {
  addToFavoritesController,
  removeFromFavoritesController,
  getFavoritesController
}; 