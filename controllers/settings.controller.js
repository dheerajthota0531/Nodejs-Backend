const settingsModel = require('../models/settings.model');
const userModel = require('../models/user.model');
const { validate } = require('../helpers/validation');

/**
 * Get system settings
 * Direct port of PHP's get_settings API endpoint
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} - Response with settings
 */
async function getSettingsController(req, res) {
  try {
    /*
     * Parameters:
     * type: payment_method / all (default)
     * user_id: 12 (optional)
     */
    
    // Validation - direct PHP equivalent
    const validationRules = {
      user_id: 'numeric'
    };
    
    const validationResult = validate(req.body, validationRules);
    if (validationResult.error) {
      return res.json({
        error: true,
        message: validationResult.message,
        data: []
      });
    }
    
    // Extract parameters from request (matching PHP logic exactly)
    let type = req.body.type || 'all';
    type = (type === 'payment_method') ? 'payment_method' : 'all';
    
    // Get user_id if provided
    let user_id = null;
    if (req.body.user_id) {
      user_id = parseInt(req.body.user_id);
    }
    
    // Get settings based on type and user_id
    const response = await settingsModel.getAllSettings(type, { user_id });
    
    // The model now returns the complete response object with error, message, and data
    // Just return it directly to match PHP's format exactly
    return res.json(response);
    
  } catch (error) {
    console.error('Error in getSettingsController:', error);
    return res.status(500).json({
      error: true,
      message: 'Internal Server Error',
      data: []
    });
  }
}

module.exports = {
  getSettingsController
}; 