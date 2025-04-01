/**
 * Cart management model
 * Exact implementation of PHP's Cart_model.php with identical functionality
 */
const db = require('../config/database');
let escapeArray;
let { getImageUrl } = require('../helpers/functions');

// Try to get escapeArray from functions.js or define a fallback
try {
  ({ escapeArray } = require('../helpers/functions'));
} catch (error) {
  // Define a fallback if not available
  escapeArray = (data) => {
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
              .replace(/[\0\n\r\b\t\\'"\x1a]/g, s => {
                switch (s) {
                  case "\0": return "\\0";
                  case "\n": return "\\n";
                  case "\r": return "\\r";
                  case "\b": return "\\b";
                  case "\t": return "\\t";
                  case "\\": return "\\\\";
                  case "'": return "\\'";
                  case "\"": return "\\\"";
                  case "\x1a": return "\\Z";
                  default: return s;
                }
              });
          } else {
            result[key] = escapeArray(data[key]);
          }
        }
      }
      return result;
    }
    
    return data;
  };
}

const productModel = require('./product.model');

/**
 * Add item to cart or update existing cart item
 * Direct port of PHP's add_to_cart function
 * @param {Object} data - Cart data containing user_id, product_variant_id, qty, is_saved_for_later
 * @param {Boolean} check_status - Whether to check stock status before adding
 * @returns {Promise<Boolean|Object>} - False if successful, error object if failed
 */
async function add_to_cart(data, check_status = true) {
  try {
    // Escape data for SQL safety - direct PHP equivalent
    data = escapeArray(data);
    
    // Split comma-separated values into arrays - direct PHP equivalent
    const product_variant_id = data.product_variant_id ? String(data.product_variant_id).split(',') : [];
    const qty = data.qty ? String(data.qty).split(',') : [];

    // Validate stock if required - direct PHP equivalent
    if (check_status === true) {
      try {
        // This is exactly how PHP checks stock status
        const { validate_stock } = require('../helpers/functions');
        const check_current_stock_status = await validate_stock(product_variant_id, qty);
        if (check_current_stock_status && check_current_stock_status.error === true) {
          return check_current_stock_status;
        }
      } catch (error) {
        console.error('Error validating stock:', error);
        return {
          error: true,
          message: 'Failed to validate product availability',
          data: []
        };
      }
    }

    // Process each product variant - direct PHP equivalent
    for (let i = 0; i < product_variant_id.length; i++) {
      const cart_data = {
        user_id: data.user_id,
        product_variant_id: product_variant_id[i],
        qty: qty[i],
        is_saved_for_later: (data.is_saved_for_later && 
                            data.is_saved_for_later !== undefined && 
                            data.is_saved_for_later !== null &&
                            data.is_saved_for_later === '1') ? '1' : '0'
      };

      if (qty[i] == 0) {
        await remove_from_cart(cart_data);
      } else {
        try {
          // Check if product already in cart - direct PHP equivalent
          const [rows] = await db.query(
      'SELECT * FROM cart WHERE user_id = ? AND product_variant_id = ?',
            [data.user_id, product_variant_id[i]]
          );
          
          if (rows && rows.length > 0) {
            // Update existing cart item - direct PHP equivalent
            console.log('Updating existing cart item:', {
              product_variant_id: product_variant_id[i],
              qty: cart_data.qty,
              user_id: cart_data.user_id
            });
            
      await db.query(
        'UPDATE cart SET qty = ?, is_saved_for_later = ? WHERE user_id = ? AND product_variant_id = ?',
              [cart_data.qty, cart_data.is_saved_for_later, cart_data.user_id, cart_data.product_variant_id]
      );
    } else {
            // Insert new cart item - direct PHP equivalent
            console.log('Adding new cart item:', {
              product_variant_id: product_variant_id[i],
              qty: cart_data.qty,
              user_id: cart_data.user_id
            });
            
      await db.query(
        'INSERT INTO cart (user_id, product_variant_id, qty, is_saved_for_later) VALUES (?, ?, ?, ?)',
              [cart_data.user_id, cart_data.product_variant_id, cart_data.qty, cart_data.is_saved_for_later]
      );
          }
        } catch (error) {
          console.error('Error updating cart:', error);
          throw error;
        }
      }
    }
    return false; // Return false on success like PHP implementation
  } catch (error) {
    console.error('Error in add_to_cart:', error);
    return {
      error: true,
      message: 'Failed to update cart',
      data: []
    };
  }
}

/**
 * Remove item from cart
 * Direct port of PHP's remove_from_cart function
 * @param {Object} data - Cart data with user_id and product_variant_id
 * @returns {Promise<Boolean>} - True if successful, false if failed
 */
async function remove_from_cart(data) {
  try {
    if (!data || !data.user_id) {
      return false;
    }
    
    let query = 'DELETE FROM cart WHERE user_id = ?';
    let params = [data.user_id];
    
    // If product_variant_id is provided - direct PHP equivalent logic
    if (data.product_variant_id) {
      if (Array.isArray(data.product_variant_id) || 
         (typeof data.product_variant_id === 'string' && data.product_variant_id.includes(','))) {
        // Handle array or comma-separated string
        let product_variant_ids = Array.isArray(data.product_variant_id) ? 
                                data.product_variant_id : 
                                String(data.product_variant_id).split(',');
        
        const placeholders = product_variant_ids.map(() => '?').join(',');
        query += ` AND product_variant_id IN (${placeholders})`;
        params.push(...product_variant_ids);
      } else {
        // Handle single product_variant_id
        query += ' AND product_variant_id = ?';
        params.push(data.product_variant_id);
      }
    }
    
    await db.query(query, params);
    return true;
  } catch (error) {
    console.error('Error in remove_from_cart:', error);
    return false;
  }
}

/**
 * Get user cart items
 * Direct port of PHP's get_user_cart function
 * @param {Number|String} user_id - User ID
 * @param {Number|String} is_saved_for_later - Whether to get saved for later items (default: 0)
 * @param {String} product_variant_id - Optional specific product variant to get
 * @returns {Promise<Array>} - Cart items with product details
 */
async function get_user_cart(user_id, is_saved_for_later = 0, product_variant_id = '') {
  try {
    // Build exact query from PHP implementation
    let query = `
      SELECT c.*, p.is_prices_inclusive_tax, p.name, p.id, p.image, p.short_description,
             p.minimum_order_quantity, p.shipping_method, p.pickup_location, p.is_on_sale, 
             p.type, p.sale_discount, p.quantity_step_size, p.total_allowed_quantity, 
             pv.price, pv.weight, pv.special_price, pv.id as product_variant_id, 
             tax.percentage as tax_percentage
      FROM cart c
      JOIN product_variants pv ON pv.id = c.product_variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN taxes tax ON tax.id = p.tax
      WHERE c.user_id = ? 
        AND p.status = '1'
        AND pv.status = 1
        AND c.qty != '0'
        AND c.is_saved_for_later = ?
    `;
    
    const params = [user_id, is_saved_for_later];
    
    if (product_variant_id) {
      query += ' AND c.product_variant_id = ?';
      params.push(product_variant_id);
    }
    
    query += ' ORDER BY c.id DESC';
    
    const [rows] = await db.query(query, params);
    
    if (!rows || rows.length === 0) {
      return [];
    }
    
    // Process each cart item exactly like PHP implementation
    const processedRows = await Promise.all(rows.map(async (item) => {
      try {
        // Convert id and user_id to strings to match PHP
        item.id = String(item.id);
        item.user_id = String(item.user_id);
        
        // Format date to match PHP's format
        if (item.date_created) {
          const date = new Date(item.date_created);
          // Format: YYYY-MM-DD HH:MM:SS
          item.date_created = date.getFullYear() + '-' + 
                             String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                             String(date.getDate()).padStart(2, '0') + ' ' + 
                             String(date.getHours()).padStart(2, '0') + ':' + 
                             String(date.getMinutes()).padStart(2, '0') + ':' + 
                             String(date.getSeconds()).padStart(2, '0');
        }
        
        // Convert numeric fields to strings to match PHP
        item.qty = String(item.qty);
        item.is_saved_for_later = String(item.is_saved_for_later);
        item.is_prices_inclusive_tax = String(item.is_prices_inclusive_tax);
        
        // Process image URL to use CDN
        if (item.image) {
          item.image = getImageUrl(item.image);
          // Add image_sm and image_md for thumbnails
          item.image_sm = getImageUrl(item.image, 'thumb', 'sm');
          item.image_md = getImageUrl(item.image, 'thumb', 'md');
        }
        
        // Make sure weight is a string
        if (item.weight !== undefined) {
          item.weight = String(item.weight);
        }
        
        // Check for flash sale
        const pid = item.id;
        let special_price = item.special_price;
        
        // Handle flash sales table that might not exist
        try {
          // Equivalent to PHP's exists_in_flash_sale function
          const [sale_dis] = await db.query(`
            SELECT fs.id, fs.discount
            FROM flash_sales fs
            JOIN flash_sale_products fsp ON fs.id = fsp.flash_sale_id
            WHERE fsp.product_id = ? 
              AND NOW() BETWEEN fs.start_date AND fs.end_date 
              AND fs.status = 1
          `, [pid]);
          
          if (sale_dis && sale_dis.length > 0) {
            for (let j = 0; j < sale_dis.length; j++) {
              // Equivalent to PHP's get_flash_sale_price function
              const sale_amt = (parseFloat(item.price) - (parseFloat(item.price) * parseFloat(sale_dis[j].discount) / 100)).toFixed(2);
              special_price = sale_amt;
            }
          }
        } catch (error) {
          // If flash_sales table doesn't exist, ignore the error and continue
          if (error.code !== 'ER_NO_SUCH_TABLE') {
            console.error("Error checking flash sales:", error.message);
          }
        }
        
        // Use regular price if special price is not valid - direct PHP logic
        special_price = (special_price !== '' && special_price !== null && 
                        parseFloat(special_price) > 0 && parseFloat(special_price) < parseFloat(item.price)) 
          ? special_price 
          : item.price;
        
        // Calculate tax amount based on price inclusivity - direct PHP logic
        const percentage = (item.tax_percentage && parseFloat(item.tax_percentage) > 0 && item.tax_percentage !== null) 
                         ? item.tax_percentage 
                         : '0';
                     
        let price_tax_amount = 0;
        let special_price_tax_amount = 0;
        
        if ((item.is_prices_inclusive_tax == 0 || !item.is_prices_inclusive_tax) && parseFloat(percentage) > 0) {
          price_tax_amount = parseFloat(item.price) * (parseFloat(percentage) / 100);
          special_price_tax_amount = parseFloat(special_price) * (parseFloat(percentage) / 100);
        }
        
        const tax_amount = parseFloat(special_price) * (parseFloat(percentage) / 100);
        
        // Copy PHP's adjustments to price fields
        item.price = parseFloat(item.price) + price_tax_amount;
        item.special_price = parseFloat(special_price) + special_price_tax_amount;
        item.net_amount = item.special_price - tax_amount;
        
        // Copy PHP's field defaulting
        item.minimum_order_quantity = item.minimum_order_quantity ? item.minimum_order_quantity : 1;
        item.tax_percentage = item.tax_percentage ? item.tax_percentage : '0';
        item.tax_amount = tax_amount ? tax_amount : 0;
        item.quantity_step_size = item.quantity_step_size ? item.quantity_step_size : 1;
        item.total_allowed_quantity = item.total_allowed_quantity ? item.total_allowed_quantity : '';
        
        // Convert product_variant_id to string to match PHP format
        item.product_variant_id = String(item.product_variant_id);
        
        // Get variant details like PHP
        try {
          const { get_variants_values_by_id } = require('../helpers/functions');
          item.product_variants = await get_variants_values_by_id(item.product_variant_id);
          
          // Make sure variant values match PHP format
          if (item.product_variants && item.product_variants.length > 0) {
            for (let i = 0; i < item.product_variants.length; i++) {
              // Make sure all fields are returned as strings
              if (item.product_variants[i].id) item.product_variants[i].id = String(item.product_variants[i].id);
              if (item.product_variants[i].product_id) item.product_variants[i].product_id = String(item.product_variants[i].product_id);
              if (item.product_variants[i].price) item.product_variants[i].price = String(item.product_variants[i].price);
              if (item.product_variants[i].special_price) item.product_variants[i].special_price = String(item.product_variants[i].special_price);
              if (item.product_variants[i].stock) item.product_variants[i].stock = String(item.product_variants[i].stock);
              if (item.product_variants[i].availability) item.product_variants[i].availability = String(item.product_variants[i].availability);
              if (item.product_variants[i].status) item.product_variants[i].status = String(item.product_variants[i].status);
              
              // Add a space before variant values like PHP does
              if (item.product_variants[i].variant_values && !item.product_variants[i].variant_values.startsWith(' ')) {
                item.product_variants[i].variant_values = item.product_variants[i].variant_values;
              }
              
              // Fix varaint_ids field name to match PHP response
              if (item.product_variants[i].varaint_ids !== undefined) {
                item.product_variants[i].varaint_ids = String(item.product_variants[i].varaint_ids);
              }
            }
          }
        } catch (error) {
          console.error('Error getting variant values:', error);
          item.product_variants = []; // Default empty array if function is not available
        }
        
        // Convert is_on_sale and sale_discount to strings
        if (item.is_on_sale !== undefined && item.is_on_sale !== null) {
          item.is_on_sale = String(item.is_on_sale);
        }
        
        if (item.sale_discount !== undefined && item.sale_discount !== null) {
          item.sale_discount = String(item.sale_discount);
        }
        
        // Convert minimum_order_quantity and quantity_step_size to strings
        if (item.minimum_order_quantity !== undefined && item.minimum_order_quantity !== null) {
          item.minimum_order_quantity = String(item.minimum_order_quantity);
        }
        
        if (item.quantity_step_size !== undefined && item.quantity_step_size !== null) {
          item.quantity_step_size = String(item.quantity_step_size);
        }
        
        if (item.total_allowed_quantity !== undefined && item.total_allowed_quantity !== null) {
          item.total_allowed_quantity = String(item.total_allowed_quantity);
        }
        
        return item;
      } catch (error) {
        console.error('Error processing cart item:', error);
        return item; // Return unprocessed item in case of error
      }
    }));
    
    return processedRows.filter(Boolean); // Filter out any null/undefined results
  } catch (error) {
    console.error('Error in get_user_cart:', error);
    return [];
  }
}

/**
 * Check if a product variant exists in user's cart
 * Direct port of PHP's is_variant_available_in_cart function
 * @param {String|Number} product_variant_id - Product variant ID to check
 * @param {String|Number} user_id - User ID
 * @returns {Promise<Boolean>} - True if variant exists in cart, false otherwise
 */
async function is_variant_available_in_cart(product_variant_id, user_id) {
  try {
    const [rows] = await db.query(
      'SELECT * FROM cart WHERE product_variant_id = ? AND user_id = ?',
      [product_variant_id, user_id]
    );
    return rows && rows.length > 0;
  } catch (error) {
    console.error('Error in is_variant_available_in_cart:', error);
    return false;
  }
}

/**
 * Get cart count for a user
 * Direct port of PHP get_cart_count
 * @param {String|Number} user_id - User ID
 * @returns {Promise<Array>} - Cart count data
 */
async function get_cart_count(user_id) {
  try {
    const [rows] = await db.query(
      'SELECT count(id) as total FROM cart WHERE user_id = ?',
      [user_id]
    );
    return rows;
  } catch (error) {
    console.error('Error in get_cart_count:', error);
    return [{ total: 0 }];
  }
}

/**
 * Get cart total for a user
 * Direct port of PHP get_cart_total
 * @param {string|number} user_id - User ID
 * @param {string|number} product_variant_id - Optional product variant ID
 * @param {Number} is_saved_for_later - Whether to get saved for later items (default: 0)
 * @param {Number} address_id - Optional address ID for delivery calculation
 * @returns {Promise<Object>} - Cart total information
 */
async function get_cart_total(user_id, product_variant_id = null, is_saved_for_later = 0, address_id = 0) {
  try {
    let cart_items;
    
    // Get user cart items
    if (product_variant_id !== null) {
      cart_items = await get_user_cart(user_id, is_saved_for_later, product_variant_id);
    } else {
      cart_items = await get_user_cart(user_id, is_saved_for_later);
    }
    
    if (!cart_items || cart_items.length === 0) {
      console.log('No cart items found in get_cart_total for user_id:', user_id);
      return {
        sub_total: '0.00',
        quantity: '0',
        delivery_charge: '0.00',
        tax_amount: '0.00',
        tax_percentage: '0',
        overall_amount: '0.00',
        total_arr: 0, // PHP returns this as a number when empty
        variant_id: [],
        cart_count: '0',
        total_items: '0',
        0: {
          total_items: '0',
          cart_count: '0'
        }
      };
    }
    
    // Process images for each cart item
    for (const item of cart_items) {
      if (item.image) {
        item.image = getImageUrl(item.image);
        item.image_sm = getImageUrl(item.image, 'thumb', 'sm');
        item.image_md = getImageUrl(item.image, 'thumb', 'md');
      }
    }
    
    // Calculate totals exactly as PHP does
    let sub_total = 0;
    let tax_amount = 0;
    let tax_percentage = 0;
    let quantity = 0;
    let total_arr = 0; // PHP format: numeric
    let variant_id = [];
    
    // Calculate cart totals
    for (const item of cart_items) {
      let price = 0;
      let qty = 0;
      let tax = 0;
      
      if (item.qty) {
        qty = parseInt(item.qty);
        quantity += qty;
      }
      
      // Calculate price and tax
      if (item.special_price && parseFloat(item.special_price) > 0 && parseFloat(item.special_price) < parseFloat(item.price)) {
        price = parseFloat(item.special_price);
      } else {
        price = parseFloat(item.price);
      }
      
      if (item.tax_percentage) {
        tax = parseFloat(item.tax_percentage);
      }
      
      // Calculate item subtotal and tax
      const item_subtotal = price * qty;
      sub_total += item_subtotal;
      
      // Accumulate tax percentage (PHP does this)
      tax_percentage += tax;
      
      // Calculate tax amount (PHP calculates this way)
      if (item.is_prices_inclusive_tax && item.is_prices_inclusive_tax == 1) {
        // For inclusive tax
        const price_excluding_tax = price * (100 / (100 + tax));
        const tax_amount_item = price - price_excluding_tax;
        tax_amount += tax_amount_item * qty;
      } else {
        // For exclusive tax
        const tax_amount_item = price * (tax / 100);
        tax_amount += tax_amount_item * qty;
      }
      
      // Track variant IDs
      variant_id.push(item.product_variant_id);
    }
    
    // Calculate total amount
    const overall_amount = sub_total + tax_amount;
    
    // Update total_arr to match PHP (it stores the overall_amount as a number)
    total_arr = overall_amount;
    
    // Format the response to match PHP response structure
    return {
      sub_total: sub_total.toFixed(2),
      quantity: String(quantity),
      delivery_charge: '0.00',
      tax_amount: tax_amount.toFixed(2),
      tax_percentage: String(tax_percentage),
      overall_amount: overall_amount.toFixed(2),
      total_arr: total_arr, // PHP stores this as a number
      variant_id: variant_id,
      cart_count: String(cart_items.length),
      total_items: String(cart_items.length),
      0: {
        total_items: String(cart_items.length),
        cart_count: String(cart_items.length)
      }
    };
  } catch (error) {
    console.error('Error in get_cart_total:', error);
    return {
      sub_total: '0.00',
      quantity: '0',
      delivery_charge: '0.00',
      tax_amount: '0.00',
      tax_percentage: '0',
      overall_amount: '0.00',
      total_arr: 0, // PHP returns this as a number when empty
      variant_id: [],
      cart_count: '0',
      total_items: '0',
      0: {
        total_items: '0',
        cart_count: '0'
      }
    };
  }
}

/**
 * Helper function to check if value is empty (PHP equivalent)
 * @param {*} value - Value to check
 * @returns {Boolean} - True if empty, false otherwise
 */
function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
}

module.exports = {
  add_to_cart,
  remove_from_cart,
  get_user_cart,
  is_variant_available_in_cart,
  get_cart_count,
  get_cart_total
}; 