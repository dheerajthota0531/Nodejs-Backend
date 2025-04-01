const { 
  setProductRating, 
  deleteProductRating, 
  getProductRatings,
  getProductReviewImages
} = require('../models/rating.model');
const productModel = require('../models/product.model');

/**
 * Set a product rating
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function setProductRatingController(req, res) {
  try {
    console.log('Set product rating request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    // Extract form data from various sources
    let formData = {};
    
    // Handle multipart/form-data
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      console.log('Processing multipart form data');
      
      // Check if form fields came through in req.body
      if (req.body && Object.keys(req.body).length > 0) {
        formData = {...req.body};
      }
      
      // Handle file uploads for images
      if (req.files && req.files.length > 0) {
        console.log('Processing uploaded files:', req.files.length);
        
        // Get uploadable images - handles both 'images[]' and 'images' field names
        const imageFiles = req.files.filter(file => 
          file.fieldname === 'images[]' || file.fieldname === 'images'
        );
        
        if (imageFiles.length > 0) {
          console.log('Found image files:', imageFiles.length);
          
          // For compatibility with PHP, use the same upload path pattern
          const uploadPath = 'uploads/review_images/';
          formData.images = imageFiles.map((file, index) => 
            `${uploadPath}${Date.now()}_${index}_${file.originalname.replace(/\s+/g, '_')}`
          );
          
          console.log('Image paths created:', formData.images);
        }
      }
    } else {
      // For JSON or url-encoded content
      formData = req.body;
      
      // Check if images were provided in JSON format
      if (formData.images && typeof formData.images === 'string') {
        try {
          // Try to parse if it's a JSON string
          formData.images = JSON.parse(formData.images);
        } catch (e) {
          // Not a JSON string, might be a single image or comma-separated list
          if (formData.images.includes(',')) {
            formData.images = formData.images.split(',');
          } else {
            formData.images = [formData.images];
          }
        }
      }
    }
    
    // Check required fields
    const requiredFields = ['user_id', 'product_id', 'rating'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: true,
        message: `${missingFields.join(', ')} are required fields!`,
        data: []
      });
    }
    
    // Call model function
    const result = await setProductRating(formData);
    
    // Return response
    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in setProductRatingController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Failed to set product rating',
      data: []
    });
  }
}

/**
 * Delete a product rating
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function deleteProductRatingController(req, res) {
  try {
    console.log('Delete product rating request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    // Extract parameters from request
    const userId = req.body.user_id;
    const productId = req.body.product_id;
    
    // Check required fields
    if (!userId || !productId) {
      return res.status(400).json({
        error: true,
        message: 'User ID and Product ID are required',
        data: []
      });
    }
    
    // Call model function
    const result = await deleteProductRating(userId, productId);
    
    // Return response
    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in deleteProductRatingController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Failed to delete product rating',
      data: []
    });
  }
}

/**
 * Get product ratings
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getProductRatingController(req, res) {
  try {
    console.log('Get product rating request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    // Extract parameters from request
    const productId = req.body.product_id;
    const userId = req.body.user_id || null;
    const limit = req.body.limit || 25;
    const offset = req.body.offset || 0;
    const sort = req.body.sort || 'id';
    const order = req.body.order || 'DESC';
    const hasImages = req.body.has_images || 0;
    
    // Check required fields
    if (!productId) {
      return res.status(400).json({
        error: true,
        message: 'Product ID is required',
        data: []
      });
    }
    
    // Call model function
    const result = await getProductRatings(productId, userId, limit, offset, sort, order, hasImages);

    // Ensure all product data is returned as strings to match PHP
    if (result.data && Array.isArray(result.data.product_details)) {
      result.data.product_details = result.data.product_details.map(product => 
        productModel.ensureProductFieldsAreStrings(product)
      );
    }
    
    // Return response
    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in getProductRatingController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Failed to get product ratings',
      data: []
    });
  }
}

/**
 * Get product review images
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getProductReviewImagesController(req, res) {
  try {
    console.log('Get product review images request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    
    // Extract parameters from request
    const productId = req.body.product_id;
    const limit = req.body.limit || 10;
    const offset = req.body.offset || 0;
    
    // Check required fields
    if (!productId) {
      return res.status(400).json({
        error: true,
        message: 'Product ID is required',
        data: []
      });
    }
    
    // Call model function
    const result = await getProductReviewImages(productId, limit, offset);
    
    // Ensure all product data is returned as strings to match PHP
    if (result.data && Array.isArray(result.data)) {
      result.data = result.data.map(item => {
        if (item.product_details) {
          item.product_details = productModel.ensureProductFieldsAreStrings(item.product_details);
        }
        return item;
      });
    }
    
    // Return response
    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in getProductReviewImagesController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Failed to get product review images',
      data: []
    });
  }
}

module.exports = {
  setProductRatingController,
  deleteProductRatingController,
  getProductRatingController,
  getProductReviewImagesController
}; 