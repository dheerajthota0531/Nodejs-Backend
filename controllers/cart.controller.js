const db = require('../config/database');
const cartModel = require('../models/cart.model');
const { validate } = require('../helpers/validation');
const { is_single_product_type, fetch_details, update_details, delete_details, get_settings, fetch_product } = require('../helpers/functions');

/**
 * Cart Controller
 * Direct port of PHP API.php cart functions
 */

/**
 * Get user cart
 * Direct implementation of PHP get_user_cart
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function get_user_cart(req, res) {
  try {
    /*
      Required:
      user_id:2
      
      Optional:
      delivery_pincode:370001 // optional when standard shipping is on
      only_delivery_charge:0 (default:0) // if 1 it's only return shiprocket delivery charge OR return all cart information
      address_id:2 // only when only_delivery_charge is 1
      is_saved_for_later: 1 { default:0 }
    */
    
    // Validation - direct PHP equivalent
    const validationRules = {
      user_id: 'required|numeric'
    };
    
    if (req.body.only_delivery_charge && req.body.only_delivery_charge == 1) {
      validationRules.address_id = 'required|numeric';
    } else {
      validationRules.delivery_pincode = 'numeric';
    }
    
    validationRules.is_saved_for_later = 'numeric';
    validationRules.only_delivery_charge = 'numeric';
    
    const validationResult = validate(req.body, validationRules);
    if (validationResult.error) {
      return res.json({
        error: true,
        message: validationResult.message,
        data: []
      });
    }
    
    // Get request parameters
    const settings = await get_settings('shipping_method', true);
    const only_delivery_charge = (req.body.only_delivery_charge) ? parseInt(req.body.only_delivery_charge) : 0;
    const is_saved_for_later = (req.body.is_saved_for_later && req.body.is_saved_for_later == 1) ? 
                              parseInt(req.body.is_saved_for_later) : 0;
    const address_id = (req.body.address_id) ? parseInt(req.body.address_id) : 0;
    
    // Get area information from address
    let area_id = [];
    let zipcode = '';
    
    if (address_id) {
      area_id = await fetch_details('addresses', { id: address_id }, ['area_id', 'area', 'pincode']);
      zipcode = area_id[0]?.pincode || '';
    }
    
    // Get cart data
    const cart_user_data = await cartModel.get_user_cart(req.body.user_id, is_saved_for_later);
    
    // Create cart data with delivery info - without checking deliverability
    const cart = [];
    const standard_shipping_cart = [];
    const local_shipping_cart = [];
    
    if (cart_user_data && cart_user_data.length > 0) {
      for (let i = 0; i < cart_user_data.length; i++) {
        cart[i] = {
          delivery_by: cart_user_data[i].shipping_method === 'pickup' ? 'pickup' : 'standard_shipping',
          is_deliverable: true // Default all to deliverable since we're removing the check
        };
        
        if (cart[i].delivery_by === "standard_shipping") {
          standard_shipping_cart.push(cart[i]);
        } else {
          local_shipping_cart.push(cart[i]);
        }
      }
    }
    
    // Get cart total
    const cart_total_response = await cartModel.get_cart_total(req.body.user_id, '', is_saved_for_later, address_id);
    
    // Process delivery details
    let delivery_pincode;
    if (only_delivery_charge == 1) {
      const address_detail = await fetch_details('addresses', { id: address_id }, 'pincode');
      delivery_pincode = address_detail[0]?.pincode || '';
    } else {
      delivery_pincode = (req.body.delivery_pincode) ? req.body.delivery_pincode : 0;
    }
    
    // Process cart items - validate product availability
    let tmp_cart_user_data = [...cart_user_data];
    let weight = 0;
    let parcels = [];
    let parcels_details = {};
    
    if (tmp_cart_user_data && tmp_cart_user_data.length > 0) {
      for (let i = 0; i < tmp_cart_user_data.length; i++) {
        if (!tmp_cart_user_data[i]) continue;
        
        const product_data = await fetch_details('product_variants', 
                                     { id: tmp_cart_user_data[i].product_variant_id },
                                     'product_id,availability');
        
        if (product_data && product_data[0]?.product_id) {
          const pro_details = await fetch_product(req.body.user_id, null, product_data[0].product_id);
          
          if (pro_details && pro_details.product && pro_details.product.length > 0) {
            // Add net_amount to product details
            pro_details.product[0].net_amount = tmp_cart_user_data[i].net_amount;
            
            // Check product availability
            if (pro_details.product[0].availability == 0 && pro_details.product[0].availability != null) {
              await update_details({ is_saved_for_later: '1' }, tmp_cart_user_data[i].id, 'cart');
              cart_user_data.splice(i, 1);
            }
            
            // Add product details
            if (pro_details.product && pro_details.product.length > 0) {
              cart_user_data[i].product_details = pro_details.product;
            } else {
              await delete_details({ id: cart_user_data[i].id }, 'cart');
              cart_user_data.splice(i, 1);
              continue;
            }
          } else {
            await delete_details({ id: cart_user_data[i].id }, 'cart');
            cart_user_data.splice(i, 1);
            continue;
          }
        } else {
          await delete_details({ id: cart_user_data[i].id }, 'cart');
          cart_user_data.splice(i, 1);
          continue;
        }
      }
      
      // Handle shipping parcels
      if (settings && settings.shiprocket_shipping_method == 1) {
        const { make_shipping_parcels, check_parcels_deliveriblity } = require('../helpers/shiprocket');
        parcels = await make_shipping_parcels(tmp_cart_user_data);
        parcels_details = await check_parcels_deliveriblity(parcels, delivery_pincode);
      }
    }
    
    // Return error if cart is empty
    if (cart_user_data.length === 0) {
      // Get empty cart total to have consistent response format
      const emptyCartResponse = await cartModel.get_cart_total(req.body.user_id);
      
      return res.json({
        error: true,
        message: 'Cart Is Empty !',
        total_quantity: emptyCartResponse.quantity,
        sub_total: emptyCartResponse.sub_total,
        delivery_charge: emptyCartResponse.delivery_charge || '0',
        tax_percentage: emptyCartResponse.tax_percentage,
        tax_amount: emptyCartResponse.tax_amount,
        overall_amount: emptyCartResponse.overall_amount,
        total_arr: emptyCartResponse.total_arr,
        variant_id: emptyCartResponse.variant_id,
        data: []
      });
    }
    
    // Process and return cart data
    if (only_delivery_charge == 0) {
      // Basic search params
      const search = (req.body.search && req.body.search.trim()) ? req.body.search.trim() : "";
      const limit = (req.body.limit && !isNaN(req.body.limit) && req.body.limit.trim()) ? 
                   parseInt(req.body.limit) : 25;
      const offset = (req.body.offset && !isNaN(req.body.offset) && req.body.offset.trim()) ? 
                    parseInt(req.body.offset) : 0;
      const order = (req.body.order && req.body.order.trim()) ? req.body.order : 'DESC';
      const sort = (req.body.sort && req.body.sort.trim()) ? req.body.sort : 'id';
      
      // Build response
      const response = {
        error: false,
        message: 'Data Retrieved From Cart !',
        total_quantity: cart_total_response.quantity,
        sub_total: cart_total_response.sub_total,
        delivery_charge: cart_total_response.delivery_charge || '0'
      };
      
      // Add delivery charge for local shipping
      if (local_shipping_cart && local_shipping_cart.length > 0) {
        try {
          const { get_delivery_charge } = require('../helpers/functions');
          const delivery_charge = await get_delivery_charge(req.body.address_id, cart_total_response.sub_total);
          response.delivery_charge = delivery_charge;
        } catch (error) {
          console.error('Error getting delivery charge:', error);
          response.delivery_charge = cart_total_response.delivery_charge || '0';
        }
      }
      
      // Add tax data
      response.tax_percentage = (cart_total_response.tax_percentage) ? cart_total_response.tax_percentage : "0";
      response.tax_amount = (cart_total_response.tax_amount) ? cart_total_response.tax_amount : "0";
      response.overall_amount = cart_total_response.overall_amount;
      response.total_arr = cart_total_response.total_arr;
      response.variant_id = cart_total_response.variant_id;
      
      // Add shiprocket data if enabled
      if (settings && settings.shiprocket_shipping_method == 1) {
        response.parcels_details = parcels_details;
      }
      
      // Add cart data and promo codes
      response.data = cart_user_data.filter(Boolean); // Remove any null/undefined items
      
      // Get promo codes
      try {
        const { get_promo_codes } = require('../models/promo_code.model');
        const promo_result = await get_promo_codes(limit, offset, sort, order, search);
        response.promo_codes = promo_result.data;
      } catch (error) {
        // If promo_code model doesn't exist, set empty promo codes
        console.log('Promo code model not found, setting empty promo codes');
        response.promo_codes = [];
      }
    
    return res.json(response);
    } else {
      // Only return delivery charge information
      let data = {};
      
      if (standard_shipping_cart && standard_shipping_cart.length > 0) {
        const delivery_pincode = await fetch_details('addresses', { id: req.body.address_id }, 'pincode');
        const { make_shipping_parcels, check_parcels_deliveriblity } = require('../helpers/shiprocket');
        const parcels = await make_shipping_parcels(tmp_cart_user_data);
        const parcels_details = await check_parcels_deliveriblity(parcels, delivery_pincode[0].pincode);
        
        data.delivery_charge_with_cod = parcels_details.delivery_charge_with_cod;
        data.delivery_charge_without_cod = parcels_details.delivery_charge_without_cod;
        data.estimated_delivery_days = parcels_details.estimated_delivery_days;
        data.estimate_date = parcels_details.estimate_date;
      }
      
      return res.json({
        error: false,
        message: 'Data Retrieved Successfully !',
        data: data
      });
    }
  } catch (error) {
    console.error('Error in get_user_cart:', error);
    return res.status(500).json({
      error: true,
      message: 'Internal Server Error',
      data: []
    });
  }
}

/**
 * Remove item from cart
 * Direct implementation of PHP remove_from_cart
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function remove_from_cart(req, res) {
  try {
    /*
        Required:
        user_id:2           
        product_variant_id:23    
    */
    
    // Validation - direct PHP equivalent
    const validationRules = {
      user_id: 'required|numeric',
      product_variant_id: 'required'
    };
    
    const validationResult = validate(req.body, validationRules);
    if (validationResult.error) {
      return res.json({
        error: true,
        message: validationResult.message,
        data: []
      });
    }
    
    // Get settings
    const settings = await get_settings('system_settings', true);
    
    // Remove from cart
    await cartModel.remove_from_cart(req.body);
    
    // Get updated cart data
    const cart_total_response = await cartModel.get_cart_total(req.body.user_id);
    
    // Build response
    const response = {
      error: false,
      message: 'Removed From Cart !',
      data: {}
    };
    
    if (cart_total_response) {
      response.data = {
        total_quantity: cart_total_response.quantity,
        sub_total: cart_total_response.sub_total,
        total_items: cart_total_response.total_items,
        max_items_cart: settings.max_items_cart
      };
    } else {
      response.data = [];
    }
    
    return res.json(response);
  } catch (error) {
    console.error('Error in remove_from_cart:', error);
    return res.status(500).json({
      error: true,
      message: 'Internal Server Error',
      data: []
    });
  }
}

/**
 * Add/Update cart
 * Direct implementation of PHP manage_cart
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function manage_cart(req, res) {
  try {
    /*
        Required:
        user_id:2
        product_variant_id:23
        qty:2 // pass 0 to remove qty
        
        Optional:
        is_saved_for_later: 1 { default:0 }
    */
    
    console.log('Manage cart request:', req.body);
    
    // Validation - direct PHP equivalent
    const validationRules = {
      user_id: 'required|numeric',
      product_variant_id: 'required',
      qty: 'required|numeric'
    };
    
    const validationResult = validate(req.body, validationRules);
    if (validationResult.error) {
      return res.json({
        error: true,
        message: validationResult.message,
        data: []
      });
    }
    
    // Extract request data
    const product_variant_id = req.body.product_variant_id;
    const user_id = req.body.user_id;
    const qty = req.body.qty;
    const saved_for_later = (req.body.is_saved_for_later && req.body.is_saved_for_later !== "") ? 
                           req.body.is_saved_for_later : 0;
    
    // Check for digital or physical product in cart
    if (!await is_single_product_type(product_variant_id, user_id)) {
      return res.json({
        error: true,
        message: 'You can only add either digital product or physical product to cart',
        data: []
      });
    }
    
    // Get settings
    const shipping_settings = await get_settings('shipping_method', true);
    const settings = await get_settings('system_settings', true);
    
    // Check cart status - only need to check stock if not removing or saving for later
    const check_status = (qty == 0 || saved_for_later == 1) ? false : true;
    
    console.log('Cart validation settings:', {
      check_status,
      qty,
      saved_for_later
    });
    
    // Check for cart limit
    const { get_cart_count, is_variant_available_in_cart } = require('../models/cart.model');
    const cart_count = await get_cart_count(user_id);
    const is_variant_in_cart = await is_variant_available_in_cart(product_variant_id, user_id);
    
    if (!is_variant_in_cart && cart_count && cart_count[0].total >= settings.max_items_cart) {
      return res.json({
        error: true,
        message: 'Maximum ' + settings.max_items_cart + ' Item(s) Can Be Added Only!',
        data: []
      });
    }
    
    // Add to cart
    const result = await cartModel.add_to_cart(req.body, check_status);
    
    if (result && result.error) {
      // When validation fails, PHP also returns current cart data 
      // Get user's cart data to include in the response
      const userCartData = await cartModel.get_user_cart(user_id, saved_for_later);
      
      // Get updated cart totals even though update failed
      const cartTotalInfo = await cartModel.get_cart_total(user_id);
      
      // Format response to match PHP's format
      return res.json({
        error: true,
        message: result.message || 'Failed to update cart',
        total_quantity: cartTotalInfo.quantity, 
        sub_total: cartTotalInfo.sub_total,
        tax_percentage: cartTotalInfo.tax_percentage,
        tax_amount: cartTotalInfo.tax_amount,
        total_arr: cartTotalInfo.total_arr,
        variant_id: cartTotalInfo.variant_id,
        overall_amount: cartTotalInfo.overall_amount,
        cart: userCartData || [],
        data: []
      });
    }
    
    // Get updated cart data
    const cart_total_response = await cartModel.get_cart_total(user_id);
    const cart_user_data = await cartModel.get_user_cart(user_id, saved_for_later);
    
    // Process cart data to check product availability
    let tmp_cart_user_data = [...cart_user_data];
    let weight = 0;
    
    if (tmp_cart_user_data && tmp_cart_user_data.length > 0) {
      for (let i = 0; i < tmp_cart_user_data.length; i++) {
        if (!tmp_cart_user_data[i]) continue;
        
        weight += (parseFloat(tmp_cart_user_data[i].weight || 0) * parseInt(tmp_cart_user_data[i].qty || 0));
        
        const product_data = await fetch_details('product_variants', 
                                     { id: tmp_cart_user_data[i].product_variant_id },
                                     'product_id,availability');
        
        if (product_data && product_data[0]?.product_id) {
          const pro_details = await fetch_product(user_id, null, product_data[0].product_id);
          
          if (pro_details && pro_details.product && pro_details.product.length > 0) {
            // Check product availability
            if (pro_details.product[0].availability == 0 && pro_details.product[0].availability != null) {
              await update_details({ is_saved_for_later: '1' }, cart_user_data[i].id, 'cart');
              cart_user_data.splice(i, 1);
            }
            
            // Add product details
            if (pro_details.product && pro_details.product.length > 0) {
              cart_user_data[i].product_details = pro_details.product;
            } else {
              await delete_details({ id: cart_user_data[i].id }, 'cart');
              cart_user_data.splice(i, 1);
              continue;
            }
          } else {
            await delete_details({ id: cart_user_data[i].id }, 'cart');
            cart_user_data.splice(i, 1);
            continue;
          }
        } else {
          await delete_details({ id: cart_user_data[i].id }, 'cart');
          cart_user_data.splice(i, 1);
          continue;
        }
      }
    }
    
    // Build response
    // Structure to match PHP response format exactly
    const response = {
      error: false,
      message: 'Cart Updated !',
      total_quantity: cart_total_response.quantity,
      sub_total: cart_total_response.sub_total,
      tax_percentage: cart_total_response.tax_percentage, 
      tax_amount: cart_total_response.tax_amount,
      overall_amount: cart_total_response.overall_amount,
      total_arr: cart_total_response.total_arr,
      variant_id: cart_total_response.variant_id,
      cart: cart_user_data || [],
      data: {
        total_quantity: cart_total_response.quantity,
        sub_total: cart_total_response.sub_total,
        total_items: String(cart_user_data.length),
        tax_percentage: cart_total_response.tax_percentage,
        tax_amount: cart_total_response.tax_amount,
        cart_count: String(cart_user_data.length),
        max_items_cart: settings.max_items_cart,
        overall_amount: cart_total_response.overall_amount
      }
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error in manage_cart:', error);
    return res.status(500).json({
      error: true,
      message: 'Internal Server Error',
      data: []
    });
  }
}

module.exports = {
  get_user_cart,
  remove_from_cart,
  manage_cart
}; 