/**
 * Zipcode helper functions
 * Direct port of PHP's zipcode-related functions
 */
const db = require('../config/database');

/**
 * Check if cart products are deliverable to a given address
 * Direct port of PHP's check_cart_products_delivarable function
 * @param {string|number} user_id - User ID
 * @param {string|number} area_id - Area ID
 * @param {string} zipcode - Zipcode 
 * @returns {Promise<Array>} - Deliverability status for each product
 */
async function check_cart_products_deliverable(user_id, area_id = 0, zipcode = "") {
  try {
    let products = [];
    const { get_cart_total } = require('./functions');
    const cart = await get_cart_total(user_id);
    const settings = await require('./functions').get_settings('shipping_method', true);
    
    if (!cart || !cart[0]) {
      return products;
    }
    
    const cartModel = require('../models/cart.model');
    const cartItems = await cartModel.get_user_cart(user_id, 0);
    
    if (!cartItems || cartItems.length === 0) {
      return products;
    }
    
    let product_weight = 0;
    
    for (let i = 0; i < cartItems.length; i++) {
      // Initialize object with default values
      let tmpRow = {
        is_deliverable: false,
        delivery_by: "",
        product_id: cartItems[i].product_id,
        variant_id: cartItems[i].product_variant_id,
        name: cartItems[i].name || "",
        message: "Not deliverable to selected address"
      };
      
      // Check local delivery first
      if (area_id && area_id > 0) {
        const is_product_deliverable = require('./functions').is_product_deliverable;
        tmpRow.is_deliverable = await is_product_deliverable('area', area_id, cartItems[i].product_id);
        tmpRow.delivery_by = (tmpRow.is_deliverable) ? "local" : "";
      }
      
      // Check standard shipping if not deliverable locally
      if (settings && settings.shiprocket_shipping_method == 1) {
        if (!tmpRow.is_deliverable && cartItems[i].pickup_location) {
          try {
            // Get pickup pincode
            const [pickup_location] = await db.query(
              'SELECT pin_code FROM pickup_locations WHERE pickup_location = ?',
              [cartItems[i].pickup_location]
            );
            
            if (pickup_location && pickup_location.length > 0) {
              const pickup_pincode = pickup_location[0].pin_code;
              
              // Calculate product weight
              product_weight += parseFloat(cartItems[i].weight || 0) * parseInt(cartItems[i].qty || 0);
              
              if (zipcode) {
                // Check weight limit
                if (product_weight > 15) {
                  tmpRow.is_deliverable = false;
                  tmpRow.message = "You cannot ship weight more than 15 KG";
                } else {
                  // Check shiprocket availability
                  try {
                    const shiprocket = require('../libraries/shiprocket');
                    const availibility_data = {
                      pickup_postcode: pickup_pincode,
                      delivery_postcode: zipcode,
                      cod: 0,
                      weight: product_weight
                    };
                    
                    const check_deliveribility = await shiprocket.check_serviceability(availibility_data);
                    
                    if (check_deliveribility && check_deliveribility.status_code === 422) {
                      tmpRow.is_deliverable = false;
                      tmpRow.message = "Invalid zipcode supplied!";
                    } else if (
                      check_deliveribility && 
                      check_deliveribility.status === 200 && 
                      check_deliveribility.data && 
                      check_deliveribility.data.available_courier_companies && 
                      check_deliveribility.data.available_courier_companies.length > 0
                    ) {
                      tmpRow.is_deliverable = true;
                      tmpRow.delivery_by = "standard_shipping";
                      const estimate_date = check_deliveribility.data.available_courier_companies[0].etd;
                      // Store valid zipcode in session equivalent
                      global.valid_zipcode = zipcode;
                      tmpRow.message = `Product is deliverable by ${estimate_date}`;
                    } else {
                      tmpRow.is_deliverable = false;
                      tmpRow.message = check_deliveribility.message || "Unable to deliver to this location";
                    }
                  } catch (error) {
                    console.error('Error checking shiprocket serviceability:', error);
                    tmpRow.is_deliverable = false;
                    tmpRow.message = "Error checking delivery availability";
                  }
                }
              } else {
                tmpRow.is_deliverable = false;
                tmpRow.message = "Please select zipcode to check the deliverability of item.";
              }
            }
          } catch (error) {
            console.error('Error fetching pickup location:', error);
          }
        }
      }
      
      // If product is deliverable, update message
      if (tmpRow.is_deliverable) {
        tmpRow.message = "Deliverable to selected address";
      }
      
      products.push(tmpRow);
    }
    
    return products;
  } catch (error) {
    console.error('Error in check_cart_products_deliverable:', error);
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

module.exports = {
  check_cart_products_deliverable,
  is_product_deliverable
}; 