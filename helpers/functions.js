const path = require('path');
const fs = require('fs');
const db = require('../config/database');
// Remove the circular dependency
// const settingsModel = require('../models/settings.model');

/**
 * Get settings by type (matches PHP get_settings function)
 * Direct port of PHP's get_settings from function_helper.php
 * @param {string} type - Type of settings (system_settings, shipping_method, etc.)
 * @param {boolean} is_json - Whether to parse the value as JSON
 * @returns {Promise<any>} - The settings value
 */
async function get_settings(type = 'system_settings', is_json = false) {
  try {
    // Get settings directly from the database instead of using the model
    const connection = await db.getConnection();
    
    // Get setting from the settings table
    const [result] = await connection.query(
      'SELECT * FROM settings WHERE variable = ?',
      [type]
    );
    connection.release();
    
    if (result && result.length > 0) {
      if (is_json) {
        // If it's a JSON, parse it
        try {
          const parsedValue = JSON.parse(result[0].value);
          
          // PHP returns all numeric values as strings, so we need to ensure
          // all numeric values in the object are converted to strings
          const convertNumericToString = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            
            // Handle array
            if (Array.isArray(obj)) {
              return obj.map(item => convertNumericToString(item));
            }
            
            Object.keys(obj).forEach(key => {
              if (typeof obj[key] === 'number') {
                // Convert numbers to strings to match PHP behavior
                obj[key] = String(obj[key]);
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                // Recursively process nested objects
                obj[key] = convertNumericToString(obj[key]);
              }
            });
            
            return obj;
          };
          
          // Convert all numeric values to strings
          return convertNumericToString(parsedValue);
        } catch (e) {
          console.error(`Error parsing JSON for ${type}:`, e);
          return {};
        }
      } else {
        // Return as string value (exact match to PHP's output_escaping)
        return result[0].value.replace(/\\(.)/g, '$1');
      }
    }
    
    return is_json ? {} : '';
  } catch (error) {
    console.error(`Error in get_settings(${type}):`, error);
    return is_json ? {} : '';
  }
}

/**
 * Format data types - converts values to appropriate types based on PHP standards
 * @param {*} data - The data to format
 * @param {Object} types - Type specifications
 * @returns {*} - The formatted data with correct types
 */
function formatDataTypes(data, types = {}) {
  // If no data or types provided, return as is
  if (!data) {
    return data;
  }

  // For arrays, process each item
  if (Array.isArray(data)) {
    return data.map(item => formatDataTypes(item, types));
  }
  
  // For objects, process each property
  if (typeof data === 'object' && data !== null) {
    const result = { ...data };
    
    // Handle specific type conversions
    for (const key in result) {
      if (types && types[key]) {
        // Apply specific type conversion based on types object
        switch (types[key].toLowerCase()) {
          case 'int':
          case 'integer':
            result[key] = result[key] === null || result[key] === '' ? 0 : parseInt(result[key], 10);
            break;
          case 'float':
          case 'double':
          case 'decimal':
            result[key] = result[key] === null || result[key] === '' ? 0.0 : parseFloat(result[key]);
            break;
          case 'string':
            result[key] = result[key] === null ? '' : String(result[key]);
            break;
          case 'bool':
          case 'boolean':
            result[key] = !!result[key];
            break;
          // Add more type conversions as needed
        }
      } else {
        // Default conversions for common fields
        if (key.endsWith('_id') || key === 'id' || key === 'count' || key === 'total') {
          // Convert ID fields to integers
          result[key] = result[key] === null || result[key] === '' ? 0 : parseInt(result[key], 10);
        } else if (key.includes('price') || key.includes('amount') || key.includes('balance')) {
          // Convert monetary values to strings with proper formatting
          result[key] = result[key] === null || result[key] === '' ? "0" : String(result[key]);
        } else if (key === 'status' || key.includes('is_')) {
          // Convert status/boolean flags to strings as in PHP
          result[key] = result[key] === null ? "0" : String(result[key]);
        }
      }
    }
    return result;
  }

  // Handle primitive types based on default assumptions
  if (typeof data === 'number') {
    return data;
  } else if (typeof data === 'string') {
    return data;
  } else if (typeof data === 'boolean') {
    return data ? '1' : '0'; // Convert boolean to string as PHP often does
  }

  return data;
}

/**
 * Output escaping for data retrieved from the database
 * This function ensures data is consistently formatted between PHP and Node.js
 * @param {Object|Array|string} data - The data to escape
 * @returns {Object|Array|string} - The escaped data
 */
function outputEscaping(data) {
  const excludeFields = ['images', 'other_images'];
  
  if (!data) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => outputEscaping(item));
  } else if (typeof data === 'object' && data !== null) {
    const result = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (!excludeFields.includes(key)) {
          // For numeric fields, convert to string to match PHP behavior
          if (typeof data[key] === 'number') {
            result[key] = String(data[key]);
          } else if (typeof data[key] === 'string') {
            // Handle string escape (similar to PHP's stripcslashes)
            result[key] = data[key].replace(/\\(.)/g, '$1');
          } else {
            result[key] = data[key];
          }
        } else {
          result[key] = data[key];
        }
      }
    }
    return result;
  } else if (typeof data === 'string') {
    // Handle string escape (similar to PHP's stripcslashes)
    return data.replace(/\\(.)/g, '$1');
  } else if (typeof data === 'number') {
    // Convert numeric values to strings to match PHP behavior
    return String(data);
  }
  
  return data;
}

/**
 * Get image URL (Legacy function for backward compatibility)
 * @param {string} imagePath - Image path
 * @param {string} type - Image type (thumb, default)
 * @param {string} size - Size (sm, md, lg)
 * @returns {string} - Image URL
 */
function getImageUrl(imagePath, type = '', size = '') {
  if (!imagePath) {
    return ''; // Return empty string for null/undefined paths
  }
  
  // Use formatImageUrl to ensure consistent CDN URL usage
  // This ensures getImageUrl and formatImageUrl behave consistently
  if (type === 'thumb') {
    return formatImageUrl(imagePath, size);
  }
  
  return formatImageUrl(imagePath);
}

/**
 * Get price range for products
 * @param {string} type - min or max
 * @param {number|null} categoryId - Category ID
 * @returns {Promise<number>} - Min or max price
 */
async function getPrice(type = "max", categoryId = null) {
  let whereClause = "";

  if (categoryId) {
    if (Array.isArray(categoryId)) {
      // Handle array of category IDs
      whereClause = ` AND (p.category_id IN (${categoryId.join(',')}) OR c.parent_id IN (${categoryId.join(',')}))`;
    } else {
      // Handle single category ID
      whereClause = ` AND p.category_id = ${categoryId}`;
    }
  }

  const query = `
    SELECT IF(pv.special_price > 0, pv.special_price, pv.price) as pr_price
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN product_variants pv ON p.id = pv.product_id
    LEFT JOIN product_attributes pa ON pa.product_id = p.id
    WHERE p.status = '1' AND pv.status = 1 AND (c.status = '1' OR c.status = '0') ${whereClause}
  `;

  try {
    const [result] = await db.query(query);

    if (result && result.length > 0) {
      const prices = result.map(item => parseFloat(item.pr_price));
      return type === "min" ? Math.min(...prices) : Math.max(...prices);
    }

    return 0;
  } catch (error) {
    console.error('Error in getPrice:', error);
    return 0;
  }
}

/**
 * Get min/max price of product variants
 * @param {number|string} productId - Product ID
 * @returns {Promise<Object>} - Min/max price data
 */
async function getMinMaxPriceOfProduct(productId = '') {
  try {
    const query = `
      SELECT p.is_prices_inclusive_tax, pv.price, pv.special_price, tax.percentage as tax_percentage
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_id
      LEFT JOIN taxes tax ON tax.id = p.tax
      ${productId ? `WHERE p.id = ${productId}` : ''}
    `;

    const [response] = await db.query(query);

    // Initialize with empty strings for all fields
    const data = {
      min_price: "0",
      max_price: "0",
      special_price: "0",
      max_special_price: "0",
      discount_in_percentage: "0"
    };

    if (response && response.length > 0) {
      const percentage = (response[0].tax_percentage && parseInt(response[0].tax_percentage) > 0)
        ? response[0].tax_percentage
        : '0';

      let priceTaxAmount = 0;
      let specialPriceTaxAmount = 0;

      if ((response[0].is_prices_inclusive_tax == 0 || !response[0].is_prices_inclusive_tax) && percentage > 0) {
        priceTaxAmount = response[0].price * (percentage / 100);
        specialPriceTaxAmount = response[0].special_price * (percentage / 100);
      }

      // Get all prices and special prices
      const prices = response.map(item => parseFloat(item.price || 0) + priceTaxAmount);
      const specialPrices = response
        .filter(item => item.special_price && parseFloat(item.special_price) > 0)
        .map(item => parseFloat(item.special_price || 0) + specialPriceTaxAmount);

      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
      const specialPrice = specialPrices.length > 0 ? Math.min(...specialPrices) : 0;
      const maxSpecialPrice = specialPrices.length > 0 ? Math.max(...specialPrices) : 0;
      const discountInPercentage = findDiscountInPercentage(specialPrice, minPrice);

      // Convert all values to strings, never null
      data.min_price = String(minPrice || "0");
      data.max_price = String(maxPrice || "0");
      data.special_price = String(specialPrice || "0");
      data.max_special_price = String(maxSpecialPrice || "0");
      data.discount_in_percentage = String(discountInPercentage || "0");
    }

    return data;
  } catch (error) {
    console.error('Error in getMinMaxPriceOfProduct:', error);
    return {
      min_price: "0",
      max_price: "0",
      special_price: "0",
      max_special_price: "0",
      discount_in_percentage: "0"
    };
  }
}

/**
 * Calculate discount percentage
 * @param {number} specialPrice - Special price
 * @param {number} price - Regular price
 * @returns {number} - Discount percentage
 */
function findDiscountInPercentage(specialPrice, price) {
  const diffAmount = price - specialPrice;
  if (diffAmount !== 0 && price > 0) {
    return parseInt((diffAmount * 100) / price);
  }
  return 0;
}

/**
 * Process swatche values based on their types
 * @param {string} swatcheTypes - Comma-separated swatche types
 * @param {string} swatcheValues - Comma-separated swatche values
 * @returns {string} - Processed swatche values as comma-separated string
 */
function processSwatcheValues(swatcheTypes, swatcheValues) {
  if (!swatcheTypes || !swatcheValues) {
    return swatcheValues;
  }

  const types = swatcheTypes.split(',');
  const values = swatcheValues.split(',');
  const processedValues = [];

  for (let i = 0; i < types.length; i++) {
    if (types[i] === '2') {
      // Image type - get image URL with thumb format
      processedValues[i] = formatImageUrl(values[i], 'thumb');
    } else if (types[i] === '0') {
      // Default type - PHP always returns a color for type 0
      processedValues[i] = "#000000";
    } else if (types[i] === '1') {
      // Color type - keep as is
      processedValues[i] = values[i];
    } else {
      // For any other type, keep the original value
      processedValues[i] = values[i] || '0';
    }
  }

  return processedValues.join(',');
}

/**
 * Get attribute values by product ID
 * @param {number} id - Product ID
 * @returns {Promise<Array>} - Attribute values
 */
async function getAttributeValuesByPid(id) {
  try {
    const query = `
      SELECT 
        GROUP_CONCAT(av.id ORDER BY av.id ASC) as ids,
        GROUP_CONCAT(' ', av.value ORDER BY av.id ASC) as attr_values,
        a.name as attr_name,
        a.name,
        GROUP_CONCAT(av.swatche_type ORDER BY av.id ASC) as swatche_type,
        GROUP_CONCAT(av.swatche_value ORDER BY av.id ASC) as swatche_value
      FROM product_attributes pa
      INNER JOIN attribute_values av ON FIND_IN_SET(av.id, pa.attribute_value_ids) > 0
      INNER JOIN attributes a ON a.id = av.attribute_id
      WHERE pa.product_id = ${id}
      GROUP BY a.name
    `;

    const [attributeValues] = await db.query(query);

    if (attributeValues && attributeValues.length > 0) {
      for (let i = 0; i < attributeValues.length; i++) {
        // Process swatche values using the helper function
        if (attributeValues[i].swatche_type && attributeValues[i].swatche_value) {
          attributeValues[i].swatche_value = processSwatcheValues(
            attributeValues[i].swatche_type,
            attributeValues[i].swatche_value
          );
        }

        attributeValues[i] = outputEscaping(attributeValues[i]);
      }
    }

    return attributeValues || [];
  } catch (error) {
    console.error('Error in getAttributeValuesByPid:', error);
    return [];
  }
}

/**
 * Get attribute values by ID
 * @param {string|Array} id - Attribute value IDs
 * @returns {Promise<Array>} - Attribute values
 */
async function getAttributeValuesById(id) {
  try {
    const query = `
      SELECT 
        GROUP_CONCAT(av.value ORDER BY av.id ASC) as attribute_values,
        GROUP_CONCAT(av.id ORDER BY av.id ASC) as attribute_values_id,
        a.name,
        GROUP_CONCAT(av.swatche_type ORDER BY av.id ASC) as swatche_type,
        GROUP_CONCAT(av.swatche_value ORDER BY av.id ASC) as swatche_value
      FROM attribute_values av
      INNER JOIN attributes a ON av.attribute_id = a.id
      WHERE av.id IN (${Array.isArray(id) ? id.join(',') : id})
      GROUP BY a.name
    `;

    const [attributeValues] = await db.query(query);

    if (attributeValues && attributeValues.length > 0) {
      for (let i = 0; i < attributeValues.length; i++) {
        // Process swatche values using the helper function
        if (attributeValues[i].swatche_type && attributeValues[i].swatche_value) {
          attributeValues[i].swatche_value = processSwatcheValues(
            attributeValues[i].swatche_type,
            attributeValues[i].swatche_value
          );
        }
        
        attributeValues[i] = outputEscaping(attributeValues[i]);
      }
    }

    return attributeValues || [];
  } catch (error) {
    console.error('Error in getAttributeValuesById:', error);
    return [];
  }
}

/**
 * Get all variant values for a product
 * @param {number|string} id - Product ID
 * @param {Array} status - Status filter array
 * @returns {Promise<Array>} - Array of variant values
 */
async function getVariantsValuesByPid(id, status = [1]) {
  try {
    const query = `
      SELECT 
        pv.*,
        pv.product_id,
        GROUP_CONCAT(av.id ORDER BY av.id ASC) as variant_ids,
        GROUP_CONCAT(' ', a.name ORDER BY av.id ASC) as attr_name,
        GROUP_CONCAT(av.value ORDER BY av.id ASC) as variant_values,
        pv.price as price,
        GROUP_CONCAT(av.swatche_type ORDER BY av.id ASC) as swatche_type,
        GROUP_CONCAT(av.swatche_value ORDER BY av.id ASC) as swatche_value
      FROM product_variants pv
      LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
      LEFT JOIN attributes a ON a.id = av.attribute_id
      WHERE pv.product_id = ${id} AND pv.status IN (${status.join(',')})
      GROUP BY pv.id
      ORDER BY pv.id
    `;

    const [variantValues] = await db.query(query);
    const formattedVariants = [];

    if (variantValues && variantValues.length > 0) {
      for (let i = 0; i < variantValues.length; i++) {
        // Create a new object for each variant with properly formatted fields
        const formattedVariant = {
          // Basic fields as strings
          id: String(variantValues[i].id || ""),
          product_id: String(variantValues[i].product_id || ""),
          attribute_value_ids: variantValues[i].attribute_value_ids || "",
          attribute_set: variantValues[i].attribute_set || "",
          price: String(variantValues[i].price || "0"),
          special_price: String(variantValues[i].special_price || "0"),
          sku: variantValues[i].sku || "",
          stock: String(variantValues[i].stock || "0"),
          weight: String(variantValues[i].weight || "0"),
          height: String(variantValues[i].height || "0"),
          breadth: String(variantValues[i].breadth || "0"),
          length: String(variantValues[i].length || "0"),
          availability: String(variantValues[i].availability || "0"),
          status: String(variantValues[i].status || "0"),
          date_added: variantValues[i].date_added ? 
            new Date(variantValues[i].date_added)
              .toISOString()
              .replace('T', ' ')
              .slice(0, 19) : "",
          variant_ids: variantValues[i].variant_ids || "",
          attr_name: variantValues[i].attr_name || "",
          variant_values: variantValues[i].variant_values || "",
          swatche_type: String(variantValues[i].swatche_type || "0"),
          swatche_value: variantValues[i].swatche_type && variantValues[i].swatche_value ? 
            processSwatcheValues(variantValues[i].swatche_type, variantValues[i].swatche_value) : 
            "#000000",
          
          // Array fields - always initialize as empty arrays
          images: [],
          images_md: [],
          images_sm: [],
          variant_relative_path: [],
          
          // Additional fields
          sale_discount_price: "",
          sale_final_price: "",
          cart_count: "0",
          is_purchased: 0
        };
        
        // Handle images parsing
        if (variantValues[i].images) {
          try {
            if (typeof variantValues[i].images === 'string') {
              const parsedImages = JSON.parse(variantValues[i].images);
              formattedVariant.images = Array.isArray(parsedImages) ? parsedImages : [];
            } else if (Array.isArray(variantValues[i].images)) {
              formattedVariant.images = variantValues[i].images;
            }
          } catch (e) {
            // Keep as empty array if parsing fails
          }
        }
        
        formattedVariants.push(formattedVariant);
      }
    }

    return formattedVariants;
  } catch (error) {
    console.error('Error in getVariantsValuesByPid:', error);
    return [];
  }
}

/**
 * Format response similar to the PHP API
 * @param {boolean|Object} error - Error flag or complete response object
 * @param {string} message - Response message
 * @param {Array|Object} data - Response data
 * @param {Object} additionalParams - Additional response parameters
 * @returns {Object} - The formatted response
 */
function formatResponse(error, message = '', data = [], additionalParams = {}) {
  // If the first parameter is an object with the expected structure, use it directly
  if (typeof error === 'object' && error !== null && !Array.isArray(error)) {
    return error;
  }

  // Default structure, matching PHP format
  const response = {
    error: error || false,
    message: message || '',
    data: data || []
  };

  // Add additional parameters if provided
  if (additionalParams) {
    Object.keys(additionalParams).forEach(key => {
      response[key] = additionalParams[key];
    });
  }

  return response;
}

/**
 * Format image URL
 * @param {string} imagePath - Image path
 * @param {string} size - Size (thumb, small, medium)
 * @returns {string} - Formatted URL
 */
function formatImageUrl(imagePath, size = '') {
  // Import config to get CDN URL
  const config = require('../config/config');
  
  // Base URL for the CDN - get from config
  const baseUrl = config.imageBaseUrl;
  
  if (!imagePath) {
    return config.noImageUrl; // Default image from config
  }
  
  // Check if the URL is already absolute
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // If it already uses the CDN URL, return as is
    if (imagePath.startsWith(baseUrl)) {
      return imagePath;
    }
    
    // If it uses the old domains, replace them with the CDN URL
    if (imagePath.includes('dev.uzvi.in')) {
      return imagePath.replace('https://dev.uzvi.in/', baseUrl);
    }
    if (imagePath.includes('admin.uzvi.in')) {
      return imagePath.replace('https://admin.uzvi.in/', baseUrl);
    }
    
    // For other absolute URLs not using the CDN, convert them to use the CDN
    // Extract the path after the domain
    try {
      const url = new URL(imagePath);
      const pathName = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
      return `${baseUrl}${pathName}`;
    } catch (e) {
      // If URL parsing fails, return the original URL
      return imagePath;
    }
  }
  
  // Ensure path has uploads prefix if needed
  let fullPath = imagePath;
  if (!imagePath.startsWith('uploads/')) {
    fullPath = `uploads/${imagePath}`;
  }
  
  // Handle size-specific paths using config for consistency
  if (size === 'thumb' || size === 'sm') {
    // Get the filename from path
    const filename = imagePath.split('/').pop();
    return `${baseUrl}${config.mediaPath}${config.imageSizes.sm}/${filename}`;
  } else if (size === 'md') {
    const filename = imagePath.split('/').pop();
    return `${baseUrl}${config.mediaPath}${config.imageSizes.md}/${filename}`;
  }
  
  // Return full URL
  return `${baseUrl}${fullPath}`;
}

/**
 * Check if a record exists in a given table based on conditions
 * @param {Object} conditions - Where conditions as key-value pairs
 * @param {string} table - Table name to check
 * @returns {Promise<boolean>} - True if record exists, false otherwise
 */
async function isExist(conditions, table) {
  try {
    if (!conditions || Object.keys(conditions).length === 0 || !table) {
      return false;
    }
    
    const db = require('../config/database');
    
    // Build WHERE clause
    const whereConditions = [];
    const values = [];
    
    for (const key in conditions) {
      whereConditions.push(`${key} = ?`);
      values.push(conditions[key]);
    }
    
    // Execute query
    const query = `SELECT COUNT(*) as count FROM ${table} WHERE ${whereConditions.join(' AND ')}`;
    const [result] = await db.query(query, values);
    
    return result[0].count > 0;
  } catch (error) {
    console.error('Error in isExist:', error);
    return false;
  }
}

/**
 * Fetch details from a table
 * Direct port of PHP's fetch_details function
 * @param {string} table - Table name
 * @param {Object} where - Where conditions
 * @param {string|Array} fields - Fields to select
 * @param {number|string} limit - Limit
 * @param {number|string} offset - Offset
 * @param {string} sort - Sort field
 * @param {string} order - Sort order
 * @param {string} whereInKey - Field for WHERE IN
 * @param {Array|string} whereInValue - Values for WHERE IN
 * @returns {Promise<Array>} - Result array
 */
async function fetch_details(table, where = null, fields = '*', limit = '', offset = '', sort = '', order = '', whereInKey = '', whereInValue = '') {
  try {
    const connection = await db.getConnection();
    
    // Build fields list
    let field_query = '*';
    if (fields && fields !== '*') {
      if (Array.isArray(fields)) {
        field_query = fields.join(', ');
      } else {
        field_query = fields;
      }
    }
    
    // Build WHERE clause
    let where_query = '';
    let query_params = [];
    
    if (where) {
      const conditions = [];
      for (const [key, value] of Object.entries(where)) {
        conditions.push(`${key} = ?`);
        query_params.push(value);
      }
      
      if (conditions.length > 0) {
        where_query = `WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    // Add WHERE IN if provided
    if (whereInKey && whereInValue) {
      let in_values = whereInValue;
      if (!Array.isArray(in_values)) {
        in_values = in_values.toString().split(',');
      }
      
      if (in_values.length > 0) {
        const placeholders = in_values.map(() => '?').join(',');
        
        where_query += where_query ? ` AND ${whereInKey} IN (${placeholders})` : `WHERE ${whereInKey} IN (${placeholders})`;
        query_params.push(...in_values);
      }
    }
    
    // Add ORDER BY if provided
    let order_query = '';
    if (sort && order) {
      order_query = `ORDER BY ${sort} ${order}`;
    }
    
    // Add LIMIT and OFFSET if provided
    let limit_query = '';
    if (limit) {
      limit_query = `LIMIT ${limit}`;
      
      if (offset) {
        limit_query += ` OFFSET ${offset}`;
      }
    }
    
    // Build and execute final query
    const query = `SELECT ${field_query} FROM ${table} ${where_query} ${order_query} ${limit_query}`;
    
    const [results] = await connection.query(query, query_params);
    connection.release();
    
    return results;
  } catch (error) {
    console.error('Error in fetch_details:', error);
    return [];
  }
}

/**
 * Get cart items for user with product details
 * @param {number} userId - User ID to get cart for
 * @returns {Promise<Array>} - Cart items with product details
 */
async function getCartTotal(userId) {
  try {
    if (!userId) {
      return [];
    }
    
    const db = require('../config/database');
    
    // Query to get cart items with product details
    const query = `
      SELECT c.*, p.name, p.image, p.is_prices_inclusive_tax, p.tax, pv.price, pv.special_price,
      (SELECT GROUP_CONCAT(DISTINCT(pa.value)) FROM product_attributes pa WHERE pa.product_id = p.id AND pa.attribute_id = 10) as weight,
      tax.percentage as tax_percentage
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_variants pv ON c.product_variant_id = pv.id
      LEFT JOIN taxes tax ON tax.id = p.tax
      WHERE c.user_id = ?
      ORDER BY c.id ASC
    `;
    
    // Execute query
    const [cartItems] = await db.query(query, [userId]);
    
    if (!cartItems || cartItems.length === 0) {
      return [];
    }
    
    // Count items in cart
    cartItems[0].cart_count = cartItems.length;
    
    // Calculate cart totals
    let total = 0;
    let tax_amount = 0;
    let tax_percentage = 0;
    let sub_total = 0;
    let overall_amount = 0;
    
    // Process each cart item
    for (let i = 0; i < cartItems.length; i++) {
      // Process product image with CDN URL - use formatImageUrl for consistency
      if (cartItems[i].image) {
        cartItems[i].image = formatImageUrl(cartItems[i].image);
        cartItems[i].image_sm = formatImageUrl(cartItems[i].image, 'sm');
        cartItems[i].image_md = formatImageUrl(cartItems[i].image, 'md');
      }
      
      const price = parseFloat(cartItems[i].special_price > 0 ? cartItems[i].special_price : cartItems[i].price);
      const qty = parseInt(cartItems[i].qty);
      
      // Calculate tax
      tax_percentage = cartItems[i].tax_percentage ? parseFloat(cartItems[i].tax_percentage) : 0;
      
      if (cartItems[i].is_prices_inclusive_tax === 0 && tax_percentage > 0) {
        const price_tax_amount = price * (tax_percentage / 100);
        tax_amount += price_tax_amount * qty;
        cartItems[i].item_tax_amount = price_tax_amount;
        cartItems[i].price = price + price_tax_amount;
        cartItems[i].tax_percentage = tax_percentage;
      } else {
        cartItems[i].item_tax_amount = 0;
        cartItems[i].price = price;
        cartItems[i].tax_percentage = 0;
      }
      
      cartItems[i].sub_total = cartItems[i].price * qty;
      sub_total += cartItems[i].sub_total;
    }
    
    // Set overall totals
    total = sub_total;
    overall_amount = total;
    
    // Add totals to first item (to be accessed later)
    cartItems[0].sub_total = sub_total;
    cartItems[0].tax_amount = tax_amount;
    cartItems[0].total = total;
    cartItems[0].overall_amount = overall_amount;
    
    return cartItems;
  } catch (error) {
    console.error('Error in getCartTotal:', error);
    return [];
  }
}

/**
 * Validate required fields in a request
 * @param {Object} requestData - Request data (body, query or params)
 * @param {Array} requiredFields - Array of field names that are required
 * @returns {Array} - Array of missing field names
 */
function validateRequired(requestData, requiredFields) {
  if (!requestData || !requiredFields || !Array.isArray(requiredFields)) {
    return [];
  }
  
  const missingFields = [];
  
  for (const field of requiredFields) {
    if (requestData[field] === undefined || requestData[field] === null || requestData[field] === '') {
      missingFields.push(field);
    }
  }
  
  return missingFields;
}

/**
 * Check if the cart has only a single product type (physical or digital)
 * Direct port of PHP's is_single_product_type function
 * @param {string|number} product_variant_id - Product variant ID to check
 * @param {string|number} user_id - User ID
 * @returns {Promise<boolean>} - True if cart has single type, false if mixed
 */
async function is_single_product_type(product_variant_id, user_id) {
  try {
    console.log('Checking product type for:', { product_variant_id, user_id });
    
    // Get product type for the current product
    const [productTypeResult] = await db.query(
      `SELECT p.type FROM product_variants pv 
       JOIN products p ON pv.product_id = p.id 
       WHERE pv.id = ?`,
      [product_variant_id]
    );
    
    if (!productTypeResult || productTypeResult.length === 0) {
      console.log('Product variant not found, defaulting to true');
      return true; // Default to true if product not found
    }
    
    const currentProductType = productTypeResult[0].type;
    const isDigital = currentProductType === 'digital_product';
    
    console.log('Current product type:', { 
      currentProductType, 
      isDigital 
    });
    
    // Check cart items for any products of different type
    const [cartResults] = await db.query(
      `SELECT p.type FROM cart c 
       JOIN product_variants pv ON c.product_variant_id = pv.id 
       JOIN products p ON pv.product_id = p.id 
       WHERE c.user_id = ? AND c.product_variant_id != ? AND c.is_saved_for_later = 0`,
      [user_id, product_variant_id]
    );
    
    // If no other items, return true
    if (!cartResults || cartResults.length === 0) {
      console.log('No other items in cart, returning true');
      return true;
    }
    
    console.log('Cart items types:', cartResults.map(item => item.type));
    
    // Check if any items have a different type
    for (const item of cartResults) {
      const isItemDigital = item.type === 'digital_product';
      
      // If types don't match, return false
      if (isDigital !== isItemDigital) {
        console.log('Mixed product types found, returning false');
        return false;
      }
    }
    
    console.log('All product types match, returning true');
    return true;
  } catch (error) {
    console.error('Error in is_single_product_type:', error);
    return true; // Default to true on error to allow cart operations
  }
}

/**
 * Update details in a table
 * Direct port of PHP's update_details function
 * @param {Object} data - Data to update (key-value pairs)
 * @param {number|string} id - ID of row to update
 * @param {string} table - Table name
 * @param {string} idField - ID field name (default: 'id') 
 * @returns {Promise<Boolean>} - True if successful, false if failed
 */
async function update_details(data, id, table, idField = 'id') {
  try {
    if (!data || !id || !table) {
      return false;
    }
    
    const connection = await db.getConnection();
    
    // Build SET clause from data
    const setValues = [];
    const params = [];
    
    for (const [key, value] of Object.entries(data)) {
      setValues.push(`${key} = ?`);
      params.push(value);
    }
    
    // Add ID to parameters
    params.push(id);
    
    // Build and execute query
    const query = `UPDATE ${table} SET ${setValues.join(', ')} WHERE ${idField} = ?`;
    
    const [result] = await connection.query(query, params);
    connection.release();
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in update_details:', error);
    return false;
  }
}

/**
 * Delete details from a table
 * Direct port of PHP's delete_details function
 * @param {Object} where - Where conditions (key-value pairs)
 * @param {string} table - Table name
 * @returns {Promise<Boolean>} - True if successful, false if failed
 */
async function delete_details(where, table) {
  try {
    if (!where || !table) {
      return false;
    }
    
    const connection = await db.getConnection();
    
    // Build WHERE clause
    const conditions = [];
    const params = [];
    
    for (const [key, value] of Object.entries(where)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
    
    // Build and execute query
    const query = `DELETE FROM ${table} WHERE ${conditions.join(' AND ')}`;
    
    const [result] = await connection.query(query, params);
    connection.release();
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error in delete_details:', error);
    return false;
  }
}

/**
 * Fetch product details
 * Direct port of PHP's fetch_product function (simplified version)
 * @param {string|number} user_id - User ID
 * @param {Object} filter - Filter options
 * @param {string|number} id - Product ID
 * @returns {Promise<Object>} - Product details
 */
async function fetch_product(user_id = null, filter = null, id = null) {
  try {
    if (!id) {
      return { product: [] };
    }

    const connection = await db.getConnection();
    
    // Build base query - simplified version of the PHP implementation
    let query = `
      SELECT p.*, p.type, p.stock_type, p.is_prices_inclusive_tax,
             c.name as category_name, tax.percentage as tax_percentage, tax.id as tax_id,
             (SELECT COUNT(id) FROM products WHERE category_id = c.id) as total
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN taxes tax ON tax.id = p.tax
      WHERE p.id = ? AND p.status = 1
    `;
    
    const [products] = await connection.query(query, [id]);
    connection.release();
    
    if (!products || products.length === 0) {
      return { product: [] };
    }
    
    // Process product to format it like PHP
    const result = { product: [] };
    
    for (let product of products) {
      // Convert string fields that should be arrays
      if (product.other_images && typeof product.other_images === 'string') {
        try {
          product.other_images = JSON.parse(product.other_images);
        } catch (e) {
          product.other_images = [];
        }
      }
      
      if (product.tags && typeof product.tags === 'string') {
        try {
          product.tags = JSON.parse(product.tags);
        } catch (e) {
          // If it's a comma-separated string, split it
          if (product.tags.includes(',')) {
            product.tags = product.tags.split(',').map(tag => tag.trim());
          } else {
            product.tags = [product.tags];
          }
        }
      }
      
      // Convert all numeric fields to strings to match PHP
      Object.keys(product).forEach(key => {
        // Skip arrays
        if (Array.isArray(product[key])) return;
        
        if (typeof product[key] === 'number') {
          product[key] = String(product[key]);
        }
      });
      
      // Get product attributes, variants and other details
      product.attributes = await get_product_attributes(id);
      product.variants = await get_product_variants(id);
      product.min_max_price = await get_min_max_price(id);
      
      // Add product to result
      result.product.push(product);
    }
    
    return result;
  } catch (error) {
    console.error('Error in fetch_product:', error);
    return { product: [] };
  }
}

/**
 * Get variant attribute values by variant ID
 * Direct port of PHP's get_variants_values_by_id function
 * @param {string|number} variantId - Product variant ID
 * @returns {Promise<Array>} - Variant attributes
 */
async function get_variants_values_by_id(variantId) {
  try {
    const connection = await db.getConnection();
    
    // Query to get variant attributes
    const query = `
      SELECT pv.*, GROUP_CONCAT(DISTINCT av.value) as variant_values,
             GROUP_CONCAT(DISTINCT a.name) as attr_name
      FROM product_variants pv
      LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
      LEFT JOIN attributes a ON av.attribute_id = a.id
      WHERE pv.id = ?
      GROUP BY pv.id
    `;
    
    const [result] = await connection.query(query, [variantId]);
    connection.release();
    
    if (!result || result.length === 0) {
      return [];
    }
    
    // Format result to match PHP's output
    const variants = result.map(item => {
      // Convert all numeric fields to strings to match PHP format
      Object.keys(item).forEach(key => {
        if (typeof item[key] === 'number') {
          item[key] = String(item[key]);
        }
      });
      
      // Convert images to an empty array if it's a JSON string
      if (item.images && typeof item.images === 'string') {
        try {
          item.images = JSON.parse(item.images);
        } catch (e) {
          item.images = "[]";
        }
      }
      
      return item;
    });
    
    return variants;
  } catch (error) {
    console.error('Error in get_variants_values_by_id:', error);
    return [];
  }
}

/**
 * Check if a product is deliverable to a location
 * Direct port of PHP's is_product_delivarable function
 * @param {string} type - Type of delivery check ('zipcode', 'area')
 * @param {string|number} type_id - Zipcode or area ID
 * @param {string|number} product_id - Product ID
 * @returns {Promise<boolean>} - True if product is deliverable
 */
async function is_product_deliverable(type, type_id, product_id) {
  try {
    const [productResult] = await db.query(
      'SELECT deliverable_type, deliverable_zipcodes FROM products WHERE id = ?',
      [product_id]
    );
    
    if (!productResult || productResult.length === 0) {
      return false;
    }
    
    const deliverableType = productResult[0].deliverable_type;
    
    // Type 1: Deliverable to all locations
    if (deliverableType === '1') {
      return true;
    }
    
    // Type 2: Deliverable to specific locations
    if (deliverableType === '2') {
      const deliverableZipcodes = productResult[0].deliverable_zipcodes;
      
      if (!deliverableZipcodes) {
        return false;
      }
      
      // Check by zipcode or area
      if (type === 'zipcode') {
        return deliverableZipcodes.split(',').includes(type_id.toString());
      } else if (type === 'area') {
        // Get zipcode for area
        const [areaResult] = await db.query(
          'SELECT zipcode_id FROM areas WHERE id = ?',
          [type_id]
        );
        
        if (!areaResult || areaResult.length === 0) {
          return false;
        }
        
        const zipcodeId = areaResult[0].zipcode_id;
        return deliverableZipcodes.split(',').includes(zipcodeId.toString());
      }
    }
    
    // Type 3: Not deliverable to specific locations
    if (deliverableType === '3') {
      const deliverableZipcodes = productResult[0].deliverable_zipcodes;
      
      if (!deliverableZipcodes) {
        return true;
      }
      
      // Check by zipcode or area
      if (type === 'zipcode') {
        return !deliverableZipcodes.split(',').includes(type_id.toString());
      } else if (type === 'area') {
        // Get zipcode for area
        const [areaResult] = await db.query(
          'SELECT zipcode_id FROM areas WHERE id = ?',
          [type_id]
        );
        
        if (!areaResult || areaResult.length === 0) {
          return true;
        }
        
        const zipcodeId = areaResult[0].zipcode_id;
        return !deliverableZipcodes.split(',').includes(zipcodeId.toString());
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in is_product_deliverable:', error);
    return false;
  }
}

/**
 * Get delivery charge based on address and total amount
 * Direct port of PHP's get_delivery_charge function
 * @param {string|number} address_id - Address ID
 * @param {string|number} total - Cart total amount
 * @returns {Promise<string>} - Delivery charge
 */
async function get_delivery_charge(address_id, total) {
  try {
    if (!address_id) {
      return "0";
    }
    
    // Get system settings
    const system_settings = await get_settings('system_settings', true);
    
    // Get minimum free delivery order amount
    const min_amount = system_settings?.minimum_cart_amt || "0";
    
    // If total exceeds minimum amount, delivery is free
    if (parseFloat(total) >= parseFloat(min_amount)) {
      return "0";
    }
    
    // Get address details
    const [address] = await db.query(
      'SELECT a.*, c.name as city_name FROM addresses a LEFT JOIN cities c ON a.city_id = c.id WHERE a.id = ?',
      [address_id]
    );
    
    if (!address || address.length === 0) {
      return system_settings?.delivery_charge || "0";
    }
    
    // Check for city specific delivery charge
    if (address[0].city_id) {
      const [city] = await db.query(
        'SELECT delivery_charge FROM cities WHERE id = ?',
        [address[0].city_id]
      );
      
      if (city && city.length > 0 && city[0].delivery_charge !== null) {
        return city[0].delivery_charge.toString();
      }
    }
    
    // Return default delivery charge from settings
    return system_settings?.delivery_charge || "0";
  } catch (error) {
    console.error('Error in get_delivery_charge:', error);
    return "0";
  }
}

/**
 * Escape array values for SQL safety
 * Direct port of PHP's escape_array function
 * @param {Object|Array} data - Data to escape
 * @returns {Object|Array} - Escaped data
 */
function escapeArray(data) {
  if (!data) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => escapeArray(item));
  }
  
  if (typeof data === 'object') {
    const result = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (typeof data[key] === 'string') {
          // Escape string values
          result[key] = data[key]
            .replace(/[\0\n\r\b\t\\'"\x1a]/g, (s) => {
              switch (s) {
                case "\0": return "\\0";
                case "\n": return "\\n";
                case "\r": return "\\r";
                case "\b": return "\\b";
                case "\t": return "\\t";
                case "\x1a": return "\\Z";
                case "'": return "\\'";
                case '"': return '\\"';
                case '\\': return '\\\\';
                default: return s;
              }
            });
        } else if (typeof data[key] === 'object' && data[key] !== null) {
          result[key] = escapeArray(data[key]);
        } else {
          result[key] = data[key];
        }
      }
    }
    return result;
  }
  
  if (typeof data === 'string') {
    // Escape string values
    return data.replace(/[\0\n\r\b\t\\'"\x1a]/g, (s) => {
      switch (s) {
        case "\0": return "\\0";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\b": return "\\b";
        case "\t": return "\\t";
        case "\x1a": return "\\Z";
        case "'": return "\\'";
        case '"': return '\\"';
        case '\\': return '\\\\';
        default: return s;
      }
    });
  }
  
  return data;
}

/**
 * Get product attributes
 * Helper function to get attributes for a product
 * @param {string|number} product_id - Product ID
 * @returns {Promise<Array>} - Product attributes
 */
async function get_product_attributes(product_id) {
  try {
    const connection = await db.getConnection();
    
    // Get product attributes
    const query = `
      SELECT a.id, a.name, GROUP_CONCAT(DISTINCT av.id) as ids,
             GROUP_CONCAT(DISTINCT av.value) as value,
             GROUP_CONCAT(DISTINCT av.swatche_type) as swatche_type,
             GROUP_CONCAT(DISTINCT av.swatche_value) as swatche_value
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_id
      JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
      JOIN attributes a ON a.id = av.attribute_id
      WHERE p.id = ?
      GROUP BY a.id
    `;
    
    const [attributes] = await connection.query(query, [product_id]);
    connection.release();
    
    if (!attributes || attributes.length === 0) {
      return [];
    }
    
    // Format attributes to match PHP
    return attributes.map(attr => {
      // Add space before value like PHP does
      let value = attr.value;
      if (value && !value.startsWith(' ')) {
        value = ' ' + value;
      }
      
      return {
        ids: attr.ids || '',
        value: value || '',
        attr_name: attr.name || '',
        name: attr.name || '',
        swatche_type: attr.swatche_type || '0',
        swatche_value: attr.swatche_value || '0'
      };
    });
  } catch (error) {
    console.error('Error in get_product_attributes:', error);
    return [];
  }
}

/**
 * Get product variants
 * Helper function to get variants for a product
 * @param {string|number} product_id - Product ID
 * @returns {Promise<Array>} - Product variants
 */
async function get_product_variants(product_id) {
  try {
    const connection = await db.getConnection();
    
    // Get product variants
    const query = `
      SELECT pv.*, GROUP_CONCAT(DISTINCT av.value) as variant_values,
             GROUP_CONCAT(DISTINCT a.name) as attr_name
      FROM product_variants pv
      LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
      LEFT JOIN attributes a ON a.id = av.attribute_id
      WHERE pv.product_id = ? AND pv.status = 1
      GROUP BY pv.id
    `;
    
    const [variants] = await connection.query(query, [product_id]);
    connection.release();
    
    if (!variants || variants.length === 0) {
      return [];
    }
    
    // Format variants to match PHP
    return variants.map(variant => {
      // Add space before attr_name and variant_values like PHP does
      let attr_name = variant.attr_name;
      if (attr_name && !attr_name.startsWith(' ')) {
        attr_name = ' ' + attr_name;
      }
      
      let variant_values = variant.variant_values;
      if (variant_values && !variant_values.startsWith(' ')) {
        variant_values = ' ' + variant_values;
      }
      
      // Parse images
      let images = [];
      if (variant.images) {
        try {
          images = JSON.parse(variant.images);
        } catch (e) {
          images = [];
        }
      }
      
      return {
        id: String(variant.id || ''),
        product_id: String(variant.product_id || ''),
        attribute_value_ids: variant.attribute_value_ids || '',
        attribute_set: variant.attribute_set || '',
        price: String(variant.price || ''),
        special_price: variant.special_price ? String(variant.special_price) : '',
        sku: variant.sku || '',
        stock: String(variant.stock || '0'),
        weight: String(variant.weight || '0'),
        height: String(variant.height || '0'),
        breadth: String(variant.breadth || '0'),
        length: String(variant.length || '0'),
        images: images,
        availability: String(variant.availability || '1'),
        status: String(variant.status || '1'),
        date_added: variant.date_added || '',
        variant_ids: variant.attribute_value_ids || '', // PHP uses variant_ids instead of varaint_ids
        attr_name: attr_name,
        variant_values: variant_values,
        swatche_type: '0',
        swatche_value: '#000000',
        images_md: [],
        images_sm: [],
        variant_relative_path: [],
        sale_discount_price: '',
        sale_final_price: '',
        cart_count: '0',
        is_purchased: 1
      };
    });
  } catch (error) {
    console.error('Error in get_product_variants:', error);
    return [];
  }
}

/**
 * Get min max price for a product
 * Helper function to calculate min and max prices for a product
 * @param {string|number} product_id - Product ID
 * @returns {Promise<Object>} - Min max price information
 */
async function get_min_max_price(product_id) {
  try {
    const connection = await db.getConnection();
    
    // Get product variants price info
    const query = `
      SELECT price, special_price
      FROM product_variants
      WHERE product_id = ? AND status = 1
    `;
    
    const [variants] = await connection.query(query, [product_id]);
    connection.release();
    
    if (!variants || variants.length === 0) {
      return {
        min_price: 0,
        max_price: 0,
        special_price: 0,
        max_special_price: 0,
        discount_in_percentage: 0
      };
    }
    
    // Calculate min and max prices
    const prices = variants.map(v => parseFloat(v.price));
    const specialPrices = variants
      .filter(v => v.special_price && parseFloat(v.special_price) > 0)
      .map(v => parseFloat(v.special_price));
    
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const minSpecialPrice = specialPrices.length > 0 ? Math.min(...specialPrices) : 0;
    const maxSpecialPrice = specialPrices.length > 0 ? Math.max(...specialPrices) : 0;
    
    // Calculate discount percentage
    let discountPercentage = 0;
    if (minPrice > 0 && minSpecialPrice > 0) {
      discountPercentage = Math.round(((minPrice - minSpecialPrice) / minPrice) * 100);
    }
    
    return {
      min_price: minPrice,
      max_price: maxPrice,
      special_price: minSpecialPrice,
      max_special_price: maxSpecialPrice,
      discount_in_percentage: discountPercentage
    };
  } catch (error) {
    console.error('Error in get_min_max_price:', error);
    return {
      min_price: 0,
      max_price: 0,
      special_price: 0,
      max_special_price: 0,
      discount_in_percentage: 0
    };
  }
}

/**
 * Validate product stock before adding to cart
 * Direct port of PHP's validate_stock function
 * @param {Array|string} product_variant_id - Product variant IDs
 * @param {Array|string} qty - Quantities for each variant
 * @returns {Promise<Object|boolean>} - Error object if validation fails, false if successful
 */
async function validate_stock(product_variant_id, qty) {
  try {
    console.log('Validating stock for:', { product_variant_id, qty });
    
    // Convert to arrays if single values
    const variant_ids = Array.isArray(product_variant_id) ? product_variant_id : [product_variant_id];
    const quantities = Array.isArray(qty) ? qty : [qty];
    
    for (let i = 0; i < variant_ids.length; i++) {
      // Get variant details
      const [variant] = await db.query(`
        SELECT pv.*, p.name, p.total_allowed_quantity, p.id as product_id
        FROM product_variants pv 
        JOIN products p ON p.id = pv.product_id 
        WHERE pv.id = ?`,
        [variant_ids[i]]
      );
      
      if (!variant || variant.length === 0) {
        console.log('Product variant not found:', variant_ids[i]);
        return {
          error: true,
          message: 'Product variant not found',
          data: []
        };
      }
      
      const productVariant = variant[0];
      console.log('Product variant details:', { 
        name: productVariant.name,
        stock: productVariant.stock,
        availability: productVariant.availability,
        total_allowed_quantity: productVariant.total_allowed_quantity
      });
      
      // Check variant availability
      if (productVariant.availability !== '1' && productVariant.availability !== 1) {
        console.log('Product not available:', productVariant.name);
        return {
          error: true,
          message: productVariant.name + ' is not available for purchase!',
          data: []
        };
      }
      
      // Check total allowed quantity per order - this is the key part that matches PHP behavior
      if (productVariant.total_allowed_quantity && 
          productVariant.total_allowed_quantity !== '' && 
          parseInt(productVariant.total_allowed_quantity) > 0) {
        
        // Get current quantity in cart for this product
        const [cartItems] = await db.query(`
          SELECT SUM(qty) as current_qty 
          FROM cart 
          WHERE product_variant_id = ? AND is_saved_for_later = 0`,
          [variant_ids[i]]
        );
        
        const newQty = parseInt(quantities[i]);
        
        // In PHP's implementation, when managing cart they directly compare the new qty
        // to the total_allowed_quantity without adding to current_qty
        console.log('Quantity validation:', {
          newQty,
          totalAllowed: parseInt(productVariant.total_allowed_quantity)
        });
        
        if (newQty > parseInt(productVariant.total_allowed_quantity)) {
          console.log('Maximum allowed quantity exceeded');
          return {
            error: true,
            message: 'Maximum allowed quantity for ' + productVariant.name + ' is ' + productVariant.total_allowed_quantity + '!',
            data: []
          };
        }
      }
      
      // Check stock availability - exact match to PHP behavior
      if (parseInt(quantities[i]) > parseInt(productVariant.stock)) {
        console.log('Not enough stock');
        return {
          error: true,
          message: 'Only ' + productVariant.stock + ' item(s) available for ' + productVariant.name,
          data: []
        };
      }
    }
    
    console.log('Stock validation passed');
    return false; // No errors - PHP returns false on success
  } catch (error) {
    console.error('Error in validate_stock:', error);
    return {
      error: true,
      message: 'Failed to validate stock',
      data: []
    };
  }
}

module.exports = {
  get_settings,
  formatDataTypes,
  outputEscaping,
  getImageUrl,
  getPrice,
  getMinMaxPriceOfProduct,
  findDiscountInPercentage,
  processSwatcheValues,
  getAttributeValuesByPid,
  getAttributeValuesById,
  getVariantsValuesByPid,
  formatResponse,
  formatImageUrl,
  isExist,
  fetch_details,
  getCartTotal,
  validateRequired,
  is_single_product_type,
  update_details,
  delete_details,
  fetch_product,
  get_variants_values_by_id,
  is_product_deliverable,
  get_delivery_charge,
  escapeArray,
  get_product_attributes,
  get_product_variants,
  get_min_max_price,
  validate_stock
};