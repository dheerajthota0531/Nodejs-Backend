/**
 * Zipcode model
 * @module zipcode.model
 */
const db = require('../config/database');
const { outputEscaping, formatDataTypes } = require('../helpers/functions');

/**
 * Get zipcodes based on search criteria
 * @param {string} search - Search term for zipcode
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Object>} - List of zipcodes
 */
async function getZipcodes(search = '', limit = 25, offset = 0) {
  try {
    let countQuery = 'SELECT COUNT(id) as total FROM zipcodes';
    let dataQuery = 'SELECT * FROM zipcodes';
    let whereClause = '';
    const queryParams = [];
    
    // Add search condition if provided
    if (search && search.trim() !== '') {
      whereClause = ' WHERE zipcode LIKE ?';
      queryParams.push(`%${search}%`);
    }
    
    // Execute count query
    const [countResult] = await db.query(countQuery + whereClause, queryParams);
    const total = countResult[0].total || 0;
    
    // Add limit and offset to data query
    dataQuery += whereClause + ' LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    // Execute data query
    const [zipcodes] = await db.query(dataQuery, queryParams);
    
    // Format results
    const data = zipcodes.map(row => {
      return {
        id: String(row.id),
        zipcode: row.zipcode,
        date_created: row.date_created || ''
      };
    });
    
    return {
      error: data.length === 0,
      message: data.length === 0 ? 'Pincodes(s) does not exist' : 'Pincodes retrieved successfully',
      total: String(total),
      data: data
    };
  } catch (error) {
    console.error('Error in getZipcodes:', error);
    throw error;
  }
}

/**
 * Check if product is deliverable to a zipcode
 * @param {string} type - Type of check ('zipcode' or 'area')
 * @param {number} typeId - ID of zipcode or area
 * @param {number} productId - Product ID to check
 * @returns {Promise<boolean>} - Whether product is deliverable or not
 */
async function isProductDeliverable(type, typeId, productId) {
  try {
    let zipcodeId = 0;
    
    // Ensure parameters are properly formatted
    typeId = parseInt(typeId);
    productId = parseInt(productId);
    
    // If type is 'area', get zipcode_id from areas table
    if (type === 'zipcode') {
      zipcodeId = typeId;
    } else if (type === 'area') {
      const [areaResult] = await db.query(
        'SELECT zipcode_id FROM areas WHERE id = ?', 
        [typeId]
      );
      
      if (areaResult.length > 0) {
        zipcodeId = parseInt(areaResult[0].zipcode_id);
      } else {
        return false;
      }
    } else {
      return false;
    }
    
    if (!zipcodeId) {
      return false;
    }
    
    // Check product deliverability based on zipcode
    const [productResult] = await db.query(
      `SELECT id FROM products WHERE id = ? AND 
      (
        (deliverable_type = 2 AND FIND_IN_SET(?, deliverable_zipcodes)) 
        OR deliverable_type = 1
        OR (deliverable_type = 3 AND NOT FIND_IN_SET(?, deliverable_zipcodes))
      )`,
      [productId, zipcodeId, zipcodeId]
    );
    
    return productResult.length > 0;
  } catch (error) {
    console.error('Error in isProductDeliverable:', error);
    throw error;
  }
}

/**
 * Check if all products in cart are deliverable
 * @param {number} userId - User ID
 * @param {number} areaId - Area ID (optional)
 * @param {string} zipcode - Zipcode (optional)
 * @returns {Promise<Array|boolean>} - Array of products with deliverability status or false
 */
async function checkCartProductsDeliverable(userId, areaId = 0, zipcode = '') {
  try {
    // Ensure parameters are properly formatted
    userId = parseInt(userId);
    areaId = parseInt(areaId);
    
    // Get cart items for user
    const cartModel = require('../models/cart.model');
    const cartItems = await cartModel.get_user_cart(userId, 0);
    
    if (!cartItems || cartItems.length === 0) {
      return false;
    }
    
    // Get shipping settings
    const [shippingSettings] = await db.query(
      "SELECT value FROM settings WHERE variable = 'shipping_method'"
    );
    
    const settings = {
      shiprocket_shipping_method: shippingSettings.length > 0 && 
        JSON.parse(shippingSettings[0].value).shiprocket_shipping_method === '1' ? 1 : 0
    };
    
    const products = [];
    let productWeight = 0;
    
    // Check each product's deliverability
    for (const cartItem of cartItems) {
      const productItem = {
        product_id: cartItem.id,
        variant_id: cartItem.product_variant_id,
        name: cartItem.name
      };
      
      // Check local delivery first
      if (areaId && areaId > 0) {
        productItem.is_deliverable = await isProductDeliverable('area', areaId, cartItem.product_id);
        productItem.delivery_by = productItem.is_deliverable ? 'local' : '';
      } else {
        productItem.is_deliverable = false;
        productItem.delivery_by = '';
      }
      
      // Check standard shipping if local delivery not available
      if (settings.shiprocket_shipping_method === 1 && 
          !productItem.is_deliverable && 
          cartItem.pickup_location && 
          zipcode) {
        
        // Calculate total weight
        const itemWeight = parseFloat(cartItem.weight || 0);
        productWeight += (itemWeight * parseInt(cartItem.qty));
        
        if (productWeight > 15) {
          productItem.is_deliverable = false;
          productItem.message = "You cannot ship weight more than 15 KG";
        } else {
          // Get pickup location pincode
          const [pickupLocation] = await db.query(
            'SELECT pin_code FROM pickup_locations WHERE pickup_location = ?',
            [cartItem.pickup_location]
          );
          
          if (pickupLocation.length > 0) {
            // Check standard shipping availability using Shiprocket
            try {
              // Assuming we have a shiprocket service utility
              // In a real implementation, you would need to implement this service
              const availabilityData = {
                pickup_postcode: pickupLocation[0].pin_code,
                delivery_postcode: zipcode,
                cod: 0,
                weight: productWeight
              };
              
              // For now, we'll simulate the response
              // In a real implementation, you'd call the Shiprocket API here
              const isAvailable = await checkShiprocketAvailability(availabilityData);
              
              if (isAvailable.status === 'success') {
                productItem.is_deliverable = true;
                productItem.delivery_by = 'standard_shipping';
                productItem.message = 'Product is deliverable by ' + isAvailable.estimateDate;
              } else {
                productItem.is_deliverable = false;
                productItem.message = isAvailable.message;
              }
            } catch (error) {
              productItem.is_deliverable = false;
              productItem.message = 'Error checking shipping availability';
            }
          } else {
            productItem.is_deliverable = false;
            productItem.message = 'Invalid pickup location';
          }
        }
      } else if (!productItem.is_deliverable && !zipcode && !areaId) {
        productItem.is_deliverable = false;
        productItem.message = 'Please select zipcode to check the deliverability of item.';
      }
      
      // Convert boolean to string/number for PHP compatibility
      productItem.is_deliverable = productItem.is_deliverable ? true : false;
      
      products.push(productItem);
    }
    
    return products;
  } catch (error) {
    console.error('Error in checkCartProductsDeliverable:', error);
    throw error;
  }
}

/**
 * Simulate Shiprocket availability check
 * In a real implementation, this would call the Shiprocket API
 * @param {Object} data - Availability check data
 * @returns {Promise<Object>} - Availability result
 */
async function checkShiprocketAvailability(data) {
  // This is a mock implementation
  // In a real scenario, this would call the Shiprocket API
  
  // Simulate pincode validation
  if (!data.delivery_postcode || !/^\d{6}$/.test(data.delivery_postcode)) {
    return {
      status: 'error',
      message: 'Invalid zipcode supplied!'
    };
  }
  
  // Simulate weight validation
  if (data.weight > 15) {
    return {
      status: 'error',
      message: 'Weight exceeds maximum limit of 15 KG'
    };
  }
  
  // Simulate successful response (70% chance)
  if (Math.random() > 0.3) {
    // Calculate a delivery date 3-5 days from now
    const today = new Date();
    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + Math.floor(Math.random() * 3) + 3);
    
    return {
      status: 'success',
      estimateDate: deliveryDate.toISOString().split('T')[0],
      message: 'Shipping available'
    };
  } else {
    return {
      status: 'error',
      message: 'Shipping not available to this pincode'
    };
  }
}

module.exports = {
  getZipcodes,
  isProductDeliverable
}; 