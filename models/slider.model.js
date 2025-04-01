const db = require('../config/database');
const { getImageUrl } = require('../helpers/functions');
const { getCategoryById } = require('./category.model');
const { getProductById } = require('./product.model');

/**
 * Get slider images
 * @returns {Promise<Array>} - Slider images
 */
async function getSliderImages(cityId = null) {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Build query based on city filter if provided
    let query = 'SELECT * FROM sliders';
    const params = [];
    
    if (cityId) {
      query += ' WHERE city = ?';
      params.push(cityId);
    }
    
    // Add ordering to match PHP's behavior
    query += ' ORDER BY row_order ASC';
    
    const [sliders] = await connection.query(query, params);
    
    // Process each slider to add additional data
    const processedSliders = [];
    for (const slider of sliders) {
      // Format the image URL
      slider.image = getImageUrl(slider.image);
      slider.link = slider.link || '';
      
      // Handle different slider types
      if (slider.type && slider.type.toLowerCase() === 'categories' && slider.type_id) {
        // Get category data
        const category = await getCategoryById(slider.type_id);
        slider.data = category || [];
      } else if (slider.type && slider.type.toLowerCase() === 'products' && slider.type_id) {
        // Get product data
        const product = await getProductById(slider.type_id);
        slider.data = product || [];
      } else {
        slider.data = [];
      }
      
      processedSliders.push(slider);
    }
    
    return processedSliders;
  } catch (error) {
    console.error('Error getting slider images:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  getSliderImages
}; 