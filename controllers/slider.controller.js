const sliderModel = require('../models/slider.model');
const { validateToken } = require('../helpers/jwt');
const { formatResponse } = require('../helpers/functions');

/**
 * Get slider images
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with slider images
 */
async function getSliderImagesController(req, res) {
  try {
    // Get slider images from model
    const sliderImages = await sliderModel.getSliderImages();
    
    if (!sliderImages || sliderImages.length === 0) {
      return res.status(200).json({
        error: false,
        message: 'No slider images found',
        data: []
      });
    }
    
    return res.status(200).json({
      error: false,
      message: 'Slider images retrieved successfully',
      data: sliderImages
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: 'An error occurred while retrieving slider images',
      data: []
    });
  }
}

module.exports = {
  getSliderImagesController
}; 