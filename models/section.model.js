const db = require('../config/database');
const { getImageUrl, outputEscaping } = require('../helpers/functions');
const { getProducts, getProductPrice } = require('./product.model');

/**
 * Get sections for the mobile app
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Number of sections to return
 * @param {number} params.offset - Offset for pagination
 * @param {number} params.user_id - User ID (optional)
 * @param {number} params.section_id - Section ID (optional)
 * @param {string} params.city - City filter (optional)
 * @param {number} params.p_limit - Product limit per section
 * @param {number} params.p_offset - Product offset
 * @param {string} params.p_sort - Product sort field
 * @param {string} params.p_order - Product sort order
 * @returns {Promise<Object>} - Response object with sections data
 */
async function getSections(params = {}) {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Set default parameters
    const limit = parseInt(params.limit) || 25;
    const offset = parseInt(params.offset) || 0;
    const userId = params.user_id || 0;
    const pLimit = parseInt(params.p_limit) || 10;
    const pOffset = parseInt(params.p_offset) || 0;
    const pSort = params.p_sort || 'p.id';
    const pOrder = params.p_order || 'DESC';
    const city = params.city || '';
    
    // Build query conditions
    const whereConditions = [];
    const whereParams = [];
    
    // Add section_id filter if provided
    if (params.section_id) {
      whereConditions.push('s.id = ?');
      whereParams.push(params.section_id);
    }
    
    // Add city filter if provided
    if (city) {
      whereConditions.push('(s.city = ? OR s.city = "")');
      whereParams.push(city);
    }
    
    // Build WHERE clause
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get sections
    const query = `
      SELECT * 
      FROM sections s
      ${whereClause}
      ORDER BY s.row_order ASC
      LIMIT ? OFFSET ?
    `;
    
    const queryParams = [...whereParams, limit, offset];
    const [sections] = await connection.query(query, queryParams);
    
    if (!sections || sections.length === 0) {
      return {
        error: true,
        message: "No sections are available",
        data: []
      };
    }
    
    // Process each section
    const sectionData = [];
    let globalMinPrice = null;
    let globalMaxPrice = null;
    
    for (const section of sections) {
      let productIds = [];
      let categories = [];
      
      // Parse product IDs if present
      if (section.product_ids && section.product_ids.trim() !== '') {
        productIds = section.product_ids.split(',').map(id => id.trim()).filter(id => id !== '');
      }
      
      // Parse categories if present
      if (section.categories && section.categories.trim() !== '') {
        categories = section.categories.split(',').map(id => id.trim()).filter(id => id !== '');
      }
      
      // Create filter for product retrieval
      const filters = {
        show_only_active_products: 1
      };
      
      // Handle product_type
      if (params.top_rated_product && params.top_rated_product === '1') {
        filters.product_type = 'top_rated_product_including_all_products';
      } else if (section.product_type && section.product_type.trim() !== '') {
        filters.product_type = section.product_type;
      }
      
      // Get products for this section
      const productParams = {
        user_id: userId,
        limit: pLimit,
        offset: pOffset,
        sort: pSort,
        order: pOrder,
        city: city
      };
      
      // Add additional filters from request if present
      if (params.attribute_value_ids) {
        filters.attribute_value_ids = params.attribute_value_ids;
      }
      
      if (params.zipcode) {
        productParams.zipcode = params.zipcode;
      }
      
      if (params.min_price) {
        filters.min_price = params.min_price;
      }
      
      if (params.max_price) {
        filters.max_price = params.max_price;
      }
      
      if (params.discount) {
        filters.discount = params.discount;
      }
      
      // Get products - matching PHP's fetch_product parameter structure
      let products;
      if (productIds.length > 0) {
        // When product_ids exist, pass them directly as the third parameter (id)
        products = await getProducts({
          ...productParams,
          ...filters,
          id: productIds // This will be the array of product IDs
        });
      } else if (categories.length > 0) {
        // When only categories exist, pass them as the fourth parameter (category_id)
        products = await getProducts({
          ...productParams,
          ...filters,
          category_id: categories // This will be the array of category IDs
        });
      } else {
        // When neither product_ids nor categories exist
        products = await getProducts({
          ...productParams,
          ...filters
        });
      }
      
      // Format section data
      const formattedSection = {
        id: String(section.id),
        title: outputEscaping(section.title || ''),
        short_description: outputEscaping(section.short_description || ''),
        style: section.style || '',
        product_ids: section.product_ids || '',
        row_order: String(section.row_order || '0'),
        categories: section.categories || '',
        product_type: section.product_type || '',
        date_added: section.date_added || '',
        city: section.city || '0'
      };
      
      // Add product details
      if (products && !products.error && products.data && products.data.length > 0) {
        // Update global min and max prices if needed
        if (products.min_price && (globalMinPrice === null || parseFloat(products.min_price) < parseFloat(globalMinPrice))) {
          globalMinPrice = products.min_price;
        }
        
        if (products.max_price && (globalMaxPrice === null || parseFloat(products.max_price) > parseFloat(globalMaxPrice))) {
          globalMaxPrice = products.max_price;
        }
        
        formattedSection.total = String(products.total || '0');
        formattedSection.filters = products.filters || [];
        formattedSection.product_details = products.data;
        
        // Remove total from the first product detail as done in PHP
        if (formattedSection.product_details && formattedSection.product_details[0] && 'total' in formattedSection.product_details[0]) {
          delete formattedSection.product_details[0].total;
        }
      } else {
        formattedSection.total = "0";
        formattedSection.filters = [];
        formattedSection.product_details = [];
      }
      
      sectionData.push(formattedSection);
    }
    
    // If we didn't find any min/max prices from products, get them dynamically
    if (globalMinPrice === null) {
      try {
        // Get min price from database, based on category if provided
        const categoryParam = params.category_id || null;
        globalMinPrice = await getProductPrice('min', categoryParam);
      } catch (error) {
        console.error('Error getting min price:', error);
        globalMinPrice = '0';
      }
    }
    
    if (globalMaxPrice === null) {
      try {
        // Get max price from database, based on category if provided
        const categoryParam = params.category_id || null;
        globalMaxPrice = await getProductPrice('max', categoryParam);
      } catch (error) {
        console.error('Error getting max price:', error);
        globalMaxPrice = '0';
      }
    }
    
    // Return formatted response to match PHP exactly
    return {
      error: false,
      message: "Sections retrived successfully", // Match PHP typo
      min_price: String(parseInt(globalMinPrice) || 0),
      max_price: String(parseInt(globalMaxPrice) || 0),
      data: sectionData
    };
    
  } catch (error) {
    console.error('Error in getSections:', error);
    return {
      error: true,
      message: error.message || "Failed to retrieve sections",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  getSections
}; 