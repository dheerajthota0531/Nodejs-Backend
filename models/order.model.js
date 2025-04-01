const db = require('../config/database');
const { outputEscaping, getImageUrl } = require('../helpers/functions');
const { addTransaction } = require('./transaction.model');
const config = require('../config/config');

/**
 * Helper function to validate order status updates
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {string} table - Table name (orders/order_items)
 * @returns {Promise<Object>} - Validation result
 */
async function validateOrderStatus(orderId, status, table) {
  try {
    const allowedStatusValues = ['received', 'processed', 'shipped', 'delivered', 'cancelled', 'returned'];

    if (!allowedStatusValues.includes(status)) {
      return {
        error: true,
        message: "Invalid status value. Allowed values: " + allowedStatusValues.join(', '),
        data: []
      };
    }

    const tableName = (table === 'orders') ? 'orders' : 'order_items';
    const idField = (table === 'orders') ? 'id' : 'id';

    // Check if the order/item exists
    const [result] = await db.query(`SELECT * FROM ${tableName} WHERE ${idField} = ?`, [orderId]);

    if (result.length === 0) {
      return {
        error: true,
        message: `${table === 'orders' ? 'Order' : 'Order item'} not found`,
        data: []
      };
    }

    const currentStatus = result[0].active_status;

    // Don't allow status change if the order is already delivered/cancelled/returned
    if ((currentStatus === 'delivered' || currentStatus === 'cancelled' || currentStatus === 'returned') &&
      (status !== currentStatus)) {
      return {
        error: true,
        message: `Order can't be ${status} as it is already ${currentStatus}`,
        data: []
      };
    }

    // For return status, only delivered orders can be returned
    if (status === 'returned' && currentStatus !== 'delivered') {
      return {
        error: true,
        message: "Only delivered orders can be returned",
        data: []
      };
    }

    // Special checks for cancelling an order item
    if (table === 'order_items' && status === 'cancelled') {
      // Get the order for this item
      const orderItemId = orderId; // The passed in ID is the order item ID 
      const [orderItemResult] = await db.query(
        'SELECT order_id, sub_total FROM order_items WHERE id = ?', 
        [orderItemId]
      );
      
      if (orderItemResult.length === 0) {
        return {
          error: true,
          message: "Order item not found",
          data: []
        };
      }
      
      const parentOrderId = orderItemResult[0].order_id; // This is the parent order ID
      const currentItemPrice = parseFloat(orderItemResult[0].sub_total) || 0;
      
      // Get system settings for minimum order amount
      const [systemSettingsResult] = await db.query(
        'SELECT value FROM settings WHERE variable = ?',
        ['system_settings']
      );
      
      let minAmount = 0;
      if (systemSettingsResult.length > 0) {
        try {
          const systemSettings = JSON.parse(systemSettingsResult[0].value);
          minAmount = parseFloat(systemSettings.min_amount || 0);
        } catch (e) {
          console.error('Error parsing system settings:', e);
        }
      }
      
      // Get all order items and calculate the new total
      const [orderItemsResult] = await db.query(
        'SELECT id, sub_total, active_status FROM order_items WHERE order_id = ?',
        [parentOrderId]
      );
      
      let currentTotal = 0;
      for (const item of orderItemsResult) {
        // Only include items that are not cancelled or returned
        if (item.active_status !== 'cancelled' && item.active_status !== 'returned') {
          currentTotal += parseFloat(item.sub_total) || 0;
        }
      }
      
      // Subtract the current item's price
      const newTotal = currentTotal - currentItemPrice;
      
      // Check if the new total is below the minimum amount and if it's not the last item
      if (newTotal > 0 && newTotal < minAmount) {
        // Check if minimum order amount requirement is enforced
        const [orderResult] = await db.query('SELECT * FROM orders WHERE id = ?', [parentOrderId]);
        const paymentMethod = orderResult.length > 0 ? orderResult[0].payment_method : '';
        
        // Only enforce this for certain payment methods (e.g., COD)
        if (paymentMethod.toLowerCase() === 'cod') {
          return {
            error: true,
            message: `Cannot cancel this item as the remaining order total would fall below the minimum order amount of ${minAmount}`,
            data: []
          };
        }
      }
    }

    return {
      error: false,
      message: "Status can be updated",
      data: result[0]
    };
  } catch (error) {
    console.error('Error in validateOrderStatus:', error);
    return {
      error: true,
      message: error.message || "Error validating order status",
      data: []
    };
  }
}

/**
 * Get all available time slots
 * @param {Object} options - Optional parameters for filtering
 * @returns {Promise<Array>} - Array of time slots
 */
async function getAllTimeSlots(options = {}) {
  try {
    const { status, sort = 'from_time', order = 'ASC' } = options;
    
    // Build query similar to PHP's fetch_details function
    let query = 'SELECT * FROM `time_slots`';
    const params = [];
    
    // Add WHERE clause if status is specified
    if (status !== undefined) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    // Add ORDER BY clause if sort is specified
    if (sort) {
      query += ` ORDER BY ${sort} ${order}`;
    }
    
    const [results] = await db.query(query, params);
    
    // Convert numeric fields to strings to match PHP behavior
    const formattedResults = results.map(slot => {
      const formattedSlot = { ...slot };
      // Convert all numeric fields to strings
      Object.keys(formattedSlot).forEach(key => {
        if (typeof formattedSlot[key] === 'number') {
          formattedSlot[key] = String(formattedSlot[key]);
        }
      });
      return formattedSlot;
    });
    
    return formattedResults;
  } catch (error) {
    console.error('Error getting time slots:', error);
    return [];
  }
}

/**
 * Place a new order
 * @param {Object} data - Order data
 * @returns {Promise<Object>} - Response object
 */
async function placeOrder(data) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Validate required parameters
    if (!data.user_id || !data.product_variant_id || !data.quantity || !data.payment_method) {
      await connection.rollback();
      return {
        error: true,
        message: "Missing required parameters",
        data: []
      };
    }
    
    // Convert numeric values to strings for consistency with PHP
    const userId = String(data.user_id);
    const productVariantIds = data.product_variant_id.split(',').map(id => String(id));
    const quantities = data.quantity.split(',').map(qty => String(qty));
    
    // Get current date for time slot handling
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Process time slot if provided
    let timeSlot = '';
    let fromTime = '';
    let toTime = '';
    
    if (data.select_time_slot_id && data.select_time_slot_id !== '') {
      // Fetch time slot data
      const [slotData] = await connection.query(
        'SELECT * FROM time_slots WHERE id = ?',
        [data.select_time_slot_id]
      );
      
      if (slotData.length > 0) {
        // Format the time similar to PHP implementation
        fromTime = `${today} ${slotData[0].from_time}`;
        toTime = `${today} ${slotData[0].to_time}`;
        
        // Create Date objects for time manipulation
        const fromTimeDate = new Date(fromTime);
        const toTimeDate = new Date(toTime);
        
        // Add offset (4 hours and 30 minutes) like in PHP implementation
        fromTimeDate.setHours(fromTimeDate.getHours() + 4);
        fromTimeDate.setMinutes(fromTimeDate.getMinutes() + 30);
        
        toTimeDate.setHours(toTimeDate.getHours() + 4);
        toTimeDate.setMinutes(toTimeDate.getMinutes() + 30);
        
        // Format to ISO string for database
        fromTime = fromTimeDate.toISOString().replace('T', ' ').split('.')[0];
        toTime = toTimeDate.toISOString().replace('T', ' ').split('.')[0];
        
        // Store the time slot title for use in the order
        timeSlot = slotData[0].title;
      }
    } else if (data.delivery_time) {
      // If delivery_time is provided directly, use it
      timeSlot = data.delivery_time;
    }

    // Check stock availability
    for (let i = 0; i < productVariantIds.length; i++) {
      const [stockResult] = await connection.query(
        'SELECT stock, availability FROM product_variants WHERE id = ?',
        [productVariantIds[i]]
      );

      if (stockResult.length === 0) {
        await connection.rollback();
        return {
          error: true,
          message: `Product variant with ID ${productVariantIds[i]} not found`,
          data: []
        };
      }

      if (stockResult[0].availability === 0 || parseInt(stockResult[0].stock) < parseInt(quantities[i])) {
        await connection.rollback();
        return {
          error: true,
          message: `Product out of stock or insufficient quantity for product variant ID ${productVariantIds[i]}`,
          data: []
        };
      }
    }

    // Get product variant details
    let productVariants = [];
    let productTypes = [];
    let downloadAllowed = [];

    for (const id of productVariantIds) {
      const [variantResult] = await connection.query(
        'SELECT pv.*, p.type, p.download_allowed, p.name as product_name, p.is_prices_inclusive_tax, p.tax as tax_id FROM product_variants pv ' +
        'LEFT JOIN products p ON pv.product_id = p.id ' +
        'WHERE pv.id = ?',
        [id]
      );

      if (variantResult.length > 0) {
        productVariants.push(variantResult[0]);
        productTypes.push(variantResult[0].type);
        downloadAllowed.push(variantResult[0].download_allowed);
      }
    }

    // Check for digital products requiring email
    if (productTypes.includes('digital_product') && downloadAllowed.includes(0) && !data.email) {
      await connection.rollback();
      return {
        error: true,
        message: "Email is required for digital products",
        data: []
      };
    }

    // Get system settings
    const [settingsResult] = await connection.query('SELECT * FROM settings WHERE variable = "system_settings"');
    const systemSettings = settingsResult.length > 0 ? JSON.parse(settingsResult[0].value) : {};

    // Generate OTP for delivery verification - matching PHP implementation
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    
    // Handle local pickup
    const pickup = systemSettings.local_pickup || 0;
    const localPickup = data.local_pickup || 0;

    if (pickup === 0 && localPickup === 1) {
      await connection.rollback();
      return {
        error: true,
        message: "You cannot select Local pickup because this is disabled",
        data: []
      };
    }

    // Handle delivery charge
    let deliveryCharge = 0;
    if (!(pickup === 1 && localPickup === 1)) {
      deliveryCharge = data.delivery_charge || 0;
    }

    // Calculate total and tax
    let grossTotal = 0;
    let cartData = [];
    let taxAmount = 0;
    let productVariantData = [];

    for (let i = 0; i < productVariants.length; i++) {
      // Check if product is in flash sale
      // For simplicity, we'll skip the flash sale check for now
      const price = productVariants[i].special_price > 0 ?
        productVariants[i].special_price :
        productVariants[i].price;

      // Get tax information
      const [taxResult] = await connection.query(
        'SELECT t.percentage, t.title FROM taxes t WHERE t.id = ?',
        [productVariants[i].tax_id]
      );

      const taxPercentage = taxResult.length > 0 ? taxResult[0].percentage : 0;
      let itemTaxAmount = 0;
      let finalPrice = price;

      // Calculate tax if product is not inclusive of tax
      if ((productVariants[i].is_prices_inclusive_tax === 0) && taxPercentage > 0) {
        itemTaxAmount = parseFloat((price * (taxPercentage / 100)).toFixed(2));
        finalPrice = parseFloat(price) + itemTaxAmount;
      } else if (taxPercentage > 0) {
        // If price is inclusive, we still need to calculate the tax amount
        itemTaxAmount = parseFloat(((price * taxPercentage) / (100 + taxPercentage)).toFixed(2));
      }

      const subtotal = finalPrice * quantities[i];
      taxAmount += itemTaxAmount * quantities[i];
      grossTotal += subtotal;

      // Get variant info
      const [variantInfo] = await connection.query(
        'SELECT GROUP_CONCAT(av.value) as variant_values ' +
        'FROM product_variants pv ' +
        'LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0 ' +
        'WHERE pv.id = ?',
        [productVariants[i].id]
      );

      const variantName = variantInfo.length > 0 ? variantInfo[0].variant_values || "" : "";

      // Add to cart data for reference
      cartData.push({
        name: productVariants[i].product_name || `Product ${productVariants[i].product_id}`,
        variant_name: variantName,
        tax_amount: itemTaxAmount * quantities[i],
        qty: parseInt(quantities[i]),
        sub_total: subtotal
      });

      // Store product variant data for order items and response
      productVariantData.push({
        user_id: data.user_id,
        product_name: productVariants[i].product_name || `Product ${productVariants[i].product_id}`,
        variant_name: variantName,
        product_variant_id: productVariants[i].id,
        quantity: quantities[i],
        price: finalPrice,
        tax_percent: taxPercentage,
        tax_amount: itemTaxAmount * quantities[i],
        sub_total: subtotal,
        image: productVariants[i].image || '',
        product_id: productVariants[i].product_id
      });
    }

    // Round amounts
    grossTotal = parseFloat(grossTotal.toFixed(2));
    let finalTotal = grossTotal + parseFloat(deliveryCharge);

    // Handle promo code
    let promoCodeDiscount = 0;
    if (data.promo_code) {
      // In a real implementation, you would validate the promo code here
      // For now, we'll assume no promo code
      promoCodeDiscount = 0;
    }

    // Get offer discount amount (if any)
    const offerDiscountAmount = parseFloat(data.offer_discount_amount || 0);

    // Calculate total discount (promo + offer)
    const totalDiscount = parseFloat(data.discount || 0) + offerDiscountAmount;

    finalTotal = finalTotal - promoCodeDiscount - offerDiscountAmount;
    finalTotal = parseFloat(finalTotal.toFixed(2));

    // Handle wallet balance
    let walletUsed = false;
    let walletBalance = 0;

    if (data.is_wallet_used === '1') {
      const walletAmount = parseFloat(data.wallet_balance_used);
      if (walletAmount > finalTotal) {
        await connection.rollback();
        return {
          error: true,
          message: "Wallet Balance should not exceed the total amount",
          data: []
        };
      }

      // Get current wallet balance
      const [userResult] = await connection.query(
        'SELECT balance FROM users WHERE id = ?',
        [data.user_id]
      );

      if (userResult.length === 0) {
        await connection.rollback();
        return {
          error: true,
          message: "User not found",
          data: []
        };
      }

      const currentBalance = parseFloat(userResult[0].balance) || 0;
      if (currentBalance < walletAmount) {
        await connection.rollback();
        return {
          error: true,
          message: "Insufficient wallet balance",
          data: []
        };
      }

      // Update wallet balance
      const walletResult = await updateWalletBalance('debit', data.user_id, walletAmount, "Used against Order Placement", null, connection);
      
      if (!walletResult.error) {
        walletBalance = walletAmount;
        finalTotal -= walletBalance;
        walletUsed = true;
      } else {
        await connection.rollback();
        return {
          error: true,
          message: walletResult.message || "Failed to update wallet balance",
          data: []
        };
      }
    }

    // Set initial order status
    const status = data.active_status || 'received';
    const currentDate = formatDate(new Date());
    const statusArray = JSON.stringify([[status, currentDate]]);

    // Prepare order data
    const orderData = {
      user_id: data.user_id,
      mobile: data.mobile,
      total: grossTotal,
      promo_discount: promoCodeDiscount,
      total_payable: finalTotal,
      delivery_charge: deliveryCharge,
      is_delivery_charge_returnable: data.is_delivery_charge_returnable || 0,
      wallet_balance: walletUsed ? walletBalance : 0,
      final_total: finalTotal + walletBalance, // For display purposes
      discount: totalDiscount, // Store total discount including offer discount here
      payment_method: data.payment_method,
      status: statusArray,
      active_status: status,
      is_local_pickup: localPickup,
      promo_code: data.promo_code || '',
      email: data.email || '',
      city: data.city_id ? parseInt(data.city_id) : 0,
      notes: data.order_note || '',
      offer_type_details: data.offer_type_details || '',
      offer_discount: parseFloat(data.offer_discount_amount || 0)
    };
    
    // Add time slot information if provided
    if (timeSlot) {
      orderData.delivery_time = timeSlot;
    }
    
    // Handle delivery date/time if provided directly
    if (data.delivery_date) {
      // Format delivery_date to YYYY-MM-DD for database
      const deliveryDate = new Date(data.delivery_date);
      const year = deliveryDate.getFullYear();
      const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
      const day = String(deliveryDate.getDate()).padStart(2, '0');
      orderData.delivery_date = `${year}-${month}-${day}`;
    }
    
    // Set OTP based on delivery boy OTP setting
    if (systemSettings.is_delivery_boy_otp_setting_on === '1') {
      orderData.otp = otp;
    } else {
      orderData.otp = 0;
    }

    // Add address information if provided
    if (data.address_id) {
      orderData.address_id = data.address_id;

      // Get address details
      const [addressResult] = await connection.query(
        'SELECT * FROM addresses WHERE id = ?',
        [data.address_id]
      );

      if (addressResult.length > 0) {
        const address = addressResult[0];

        orderData.latitude = address.latitude || '';
        orderData.longitude = address.longitude || '';

        // Construct full address
        let fullAddress = '';
        fullAddress += address.address ? `${address.address}, ` : '';
        fullAddress += address.landmark ? `${address.landmark}, ` : '';
        fullAddress += address.area ? `${address.area}, ` : '';
        fullAddress += address.city ? `${address.city}, ` : '';
        fullAddress += address.state ? `${address.state}, ` : '';
        fullAddress += address.country ? `${address.country}, ` : '';
        fullAddress += address.pincode ? address.pincode : '';

        orderData.address = fullAddress;
        orderData.mobile = address.mobile || data.mobile;
      }
    } else {
      orderData.address = "";
    }

    // Insert order
    const [orderResult] = await connection.query('INSERT INTO orders SET ?', orderData);
    const orderId = orderResult.insertId;

    // Insert order items
    for (let i = 0; i < productVariants.length; i++) {
      const variant = productVariants[i];
      const quantity = quantities[i];

      const orderItemData = {
        user_id: data.user_id,
        order_id: orderId,
        product_variant_id: variant.id,
        quantity: quantity,
        price: productVariantData[i].price,
        discounted_price: variant.special_price,
        tax_percent: productVariantData[i].tax_percent || 0,
        tax_amount: productVariantData[i].tax_amount || 0,
        sub_total: productVariantData[i].sub_total,
        status: JSON.stringify([[status, currentDate]]),
        active_status: status
      };

      const [orderItemResult] = await connection.query('INSERT INTO order_items SET ?', orderItemData);
      const orderItemId = orderItemResult.insertId;

      // Add order item ID to product variant data for response
      productVariantData[i].order_item_id = orderItemId;

      // Add hash link for digital products
      if (variant.download_allowed && variant.download_link) {
        const hashLink = `${variant.download_link}-${orderItemId}`;
        await connection.query(
          'UPDATE order_items SET hash_link = ? WHERE id = ?',
          [hashLink, orderItemId]
        );

        // Add hash link to product variant data for response
        productVariantData[i].hash_link = hashLink;
      }

      // Update product stock
      await connection.query(
        'UPDATE product_variants SET stock = stock - ? WHERE id = ?',
        [quantity, variant.id]
      );
    }

    // If payment method is not COD or bank transfer, add transaction
    if (data.payment_method !== 'COD' && data.payment_method !== 'bank_transfer') {
      const transactionData = {
        transaction_type: 'transaction',
        user_id: data.user_id,
        order_id: orderId,
        type: 'credit',
        txn_id: data.txn_id || '',
        amount: finalTotal + walletBalance,
        status: 'success',
        message: `Payment for order #${orderId}`
      };

      await addTransaction(transactionData);
    }

    // Get user's updated balance
    const [userBalanceResult] = await connection.query(
      'SELECT balance FROM users WHERE id = ?',
      [data.user_id]
    );

    const userBalance = userBalanceResult.length > 0 ? userBalanceResult[0].balance : 0;

    await connection.commit();

    // Format response to match PHP structure
    return {
      error: false,
      message: "Order placed successfully",
      order_id: String(orderId),
      final_amount: String(finalTotal),
      offer_discount_amount: String(data.offer_discount_amount || 0),
      order_item_data: formatResponse(productVariantData),
      otp: orderData.otp ? String(orderData.otp) : '0',
      otp_msg: orderData.otp ? 'Here is your OTP. Please, give it to delivery boy only while getting your order.' : '',
      balance: [{ balance: String(userBalance) }],
      data: {
        order_id: String(orderId),
        final_amount: String(finalTotal),
        offer_discount_amount: String(data.offer_discount_amount || 0),
        order_item_data: formatResponse(productVariantData),
        otp: orderData.otp ? String(orderData.otp) : '0',
        otp_msg: orderData.otp ? 'Here is your OTP. Please, give it to delivery boy only while getting your order.' : '',
        balance: String(userBalance)
      }
    };

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in placeOrder:', error);
    return {
      error: true,
      message: error.message || "Failed to place order",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Helper function to format response data
function formatResponse(data) {
  if (typeof data === 'number') {
    return String(data);
  } else if (Array.isArray(data)) {
    return data.map(item => formatResponse(item));
  } else if (data !== null && typeof data === 'object') {
    const result = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = formatResponse(data[key]);
      }
    }
    return result;
  }
  return data;
}

/**
 * Get orders for a user
 * @param {number|string} userId - User ID
 * @param {Array} activeStatus - Status to filter by
 * @param {number} limit - Limit of records
 * @param {number} offset - Offset for pagination
 * @param {string} sort - Sort field
 * @param {string} order - Sort order (ASC/DESC)
 * @param {boolean} downloadInvoice - Whether to include invoice HTML
 * @param {string|null} startDate - Start date for filtering
 * @param {string|null} endDate - End date for filtering
 * @param {string} search - Search term
 * @returns {Promise<Object>} - Orders data
 */
async function getOrders(
  userId,
  activeStatus = [],
  limit = 25,
  offset = 0,
  sort = 'o.id',
  order = 'DESC',
  downloadInvoice = true,
  startDate = null,
  endDate = null,
  search = ''
) {
  let connection;
  try {
    connection = await db.getConnection();

    // Count orders by status
    const statusCounts = {};
    const statusTypes = ['awaiting', 'received', 'processed', 'shipped', 'delivered', 'cancelled', 'returned'];

    for (const status of statusTypes) {
      const [countResult] = await connection.query(
        'SELECT COUNT(id) as total FROM orders WHERE user_id = ? AND active_status = ?',
        [userId, status]
      );
      statusCounts[status] = countResult[0]?.total || "0";
    }

    // Build query for orders
    let orderQuery = `
      SELECT o.*, 
        COALESCE(u.username, '') as username, 
        COALESCE(u.country_code, '') as country_code,
        COALESCE(u.email, '') as email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.user_id = ?
    `;

    const queryParams = [userId];

    // Add active status filter if provided
    if (activeStatus && activeStatus.length > 0) {
      orderQuery += ' AND o.active_status IN (?)';
      queryParams.push(activeStatus);
    }

    // Add date range filter if provided
    if (startDate && endDate) {
      orderQuery += ' AND DATE(o.date_added) BETWEEN ? AND ?';
      queryParams.push(startDate, endDate);
    }

    // Add search term filter if provided
    if (search) {
      orderQuery += ' AND (o.id LIKE ? OR o.mobile LIKE ? OR u.username LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Add order and limit
    orderQuery += ` ORDER BY ${sort} ${order} LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Get orders
    const [orders] = await connection.query(orderQuery, queryParams);

    // Count total orders (for pagination)
    let countQuery = `
      SELECT COUNT(o.id) as total 
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.user_id = ?
    `;

    const countParams = [userId];

    // Add active status filter if provided
    if (activeStatus && activeStatus.length > 0) {
      countQuery += ' AND o.active_status IN (?)';
      countParams.push(activeStatus);
    }

    // Add date range filter if provided
    if (startDate && endDate) {
      countQuery += ' AND DATE(o.date_added) BETWEEN ? AND ?';
      countParams.push(startDate, endDate);
    }

    // Add search term filter if provided
    if (search) {
      countQuery += ' AND (o.id LIKE ? OR o.mobile LIKE ? OR u.username LIKE ?)';
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm, searchTerm);
    }

    const [totalResult] = await connection.query(countQuery, countParams);
    const total = totalResult[0]?.total || 0;

    // Format orders
    const formattedOrders = [];

    for (const order of orders) {
      // Get first product image and name for preview
      const [firstItemResult] = await connection.query(
        `SELECT oi.product_name as name, p.download_allowed, oi.product_variant_id
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
         LEFT JOIN products p ON pv.product_id = p.id
         WHERE oi.order_id = ?
         LIMIT 1`,
        [order.id]
      );

      const firstItem = firstItemResult[0] || {};

      // Format order status
      let orderStatus = [];
      try {
        orderStatus = Array.isArray(JSON.parse(order.status || '[]')) ? JSON.parse(order.status) : [];
        // Format dates in status entries with proper error handling
        orderStatus = orderStatus.map(status => {
          try {
            // Check if the date is in a valid format
            const dateValue = status[1];
            let formattedDate;

            // Handle different date formats that might be in the database
            if (typeof dateValue === 'string') {
              if (dateValue.includes('-')) {
                // Already in PHP-like format (dd-mm-yyyy hh:mm:ss)
                formattedDate = dateValue;
              } else {
                // Try to parse as ISO string or timestamp
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                  formattedDate = formatDate(date);
                } else {
                  formattedDate = dateValue; // Keep original if can't parse
                }
              }
            } else {
              formattedDate = String(dateValue); // Convert non-string values
            }

            return [status[0], formattedDate];
          } catch (err) {
            console.error('Error formatting individual status date:', err);
            return [status[0], String(status[1])]; // Return original value as string
          }
        });
      } catch (error) {
        console.error('Error parsing order status:', error);
        // Return empty array instead of leaving undefined
        orderStatus = [];
      }

      // Get order items
      const [orderItems] = await connection.query(
        `SELECT oi.*, p.id as product_id, p.is_returnable, p.is_cancelable, p.cancelable_till, 
         p.image, p.name, p.download_allowed, p.download_link, 
         0 as product_rating,
         p.type, pv.price as main_price, pv.special_price, pv.images as other_images
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
         LEFT JOIN products p ON pv.product_id = p.id
         WHERE oi.order_id = ?
         GROUP BY oi.id
         ORDER BY oi.id`,
        [order.id]
      );

      // Get product variant attribute values
      const formattedItems = [];

      for (const item of orderItems) {
        // Get attribute values for the variant
        const [variantAttributesResult] = await connection.query(
          `SELECT 
             GROUP_CONCAT(av.id ORDER BY av.id ASC) as varaint_ids,
             GROUP_CONCAT(av.value ORDER BY av.id ASC) as variant_values,
             GROUP_CONCAT(' ', a.name ORDER BY av.id ASC) as attr_name
           FROM product_variants pv
           LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
           LEFT JOIN attributes a ON a.id = av.attribute_id
           WHERE pv.id = ?
           GROUP BY pv.id`,
          [item.product_variant_id]
        );

        const variantAttributes = variantAttributesResult[0] || {};

        // Get product short description
        const [productDetails] = await connection.query(
          `SELECT short_description FROM products WHERE id = ?`,
          [item.product_id]
        );

        // Format item status
        let itemStatus = [];
        try {
          itemStatus = Array.isArray(JSON.parse(item.status || '[]')) ? JSON.parse(item.status) : [];
          // Format dates in status entries with proper error handling
          itemStatus = itemStatus.map(status => {
            try {
              // Check if the date is in a valid format
              const dateValue = status[1];
              let formattedDate;

              // Handle different date formats that might be in the database
              if (typeof dateValue === 'string') {
                if (dateValue.includes('-')) {
                  // Already in PHP-like format (dd-mm-yyyy hh:mm:ss)
                  formattedDate = dateValue;
                } else {
                  // Try to parse as ISO string or timestamp
                  const date = new Date(dateValue);
                  if (!isNaN(date.getTime())) {
                    formattedDate = formatDate(date);
                  } else {
                    formattedDate = dateValue; // Keep original if can't parse
                  }
                }
              } else {
                formattedDate = String(dateValue); // Convert non-string values
              }

              return [status[0], formattedDate];
            } catch (err) {
              console.error('Error formatting individual status date:', err);
              return [status[0], String(status[1])]; // Return original value as string
            }
          });
        } catch (error) {
          console.error('Error parsing item status:', error);
          // Return empty array instead of leaving undefined
          itemStatus = [];
        }

        // Check if item is returned or cancelled
        const isAlreadyReturned = itemStatus.some(status => status[0] === 'returned') ? "1" : "0";
        const isAlreadyCancelled = itemStatus.some(status => status[0] === 'cancelled') ? "1" : "0";

        // Get return request status
        let returnRequestSubmitted = "";

        try {
          // Check if return_requests table exists
          const [tableExists] = await connection.query(
            `SELECT COUNT(*) AS table_exists
             FROM information_schema.tables
             WHERE table_schema = DATABASE()
             AND table_name = 'return_requests'`
          );

          if (tableExists.length > 0 && tableExists[0].table_exists > 0) {
            // Table exists, get the return request status
            const [returnRequestResult] = await connection.query(
              `SELECT status FROM return_requests WHERE order_item_id = ? LIMIT 1`,
              [item.id]
            );

            returnRequestSubmitted = returnRequestResult.length > 0 ? returnRequestResult[0].status : "";
          }
        } catch (error) {
          console.error('Error checking return_requests table:', error);
        }

        // Calculate net amount (subtracting tax for display)
        const netAmount = parseFloat(item.sub_total) - parseFloat(item.tax_amount);

        // Format image URLs
        const baseUrl = "https://uzvisimages.blr1.cdn.digitaloceanspaces.com/";
        const imageUrl = item.image ? (item.image.startsWith('http') ? item.image : `${baseUrl}${item.image}`) : '';
        const imageSm = item.image ? (item.image.startsWith('http') ? item.image : `${baseUrl}uploads/media/2024/thumb-sm/${item.image.split('/').pop()}`) : '';
        const imageMd = item.image ? (item.image.startsWith('http') ? item.image : `${baseUrl}uploads/media/2024/thumb-md/${item.image.split('/').pop()}`) : '';

        // Format user rating data
        let userRating = "0";
        let userRatingComment = "";
        let userRatingImages = [];

        try {
          // Try to get ratings if the table exists
          const [userRatingResult] = await connection.query(
            `SELECT COUNT(*) AS table_exists
             FROM information_schema.tables
             WHERE table_schema = DATABASE()
             AND table_name = 'product_rating'`
          );

          if (userRatingResult.length > 0 && userRatingResult[0].table_exists > 0) {
            // Table exists, get the ratings
            const [ratingsResult] = await connection.query(
              `SELECT comment, images, rating FROM product_rating
               WHERE product_id = ? AND user_id = ?`,
              [item.product_id, userId]
            );

            if (ratingsResult.length > 0) {
              userRating = ratingsResult[0].rating;
              userRatingComment = ratingsResult[0].comment || "";
              userRatingImages = ratingsResult[0].images
                ? JSON.parse(ratingsResult[0].images || '[]')
                : [];
            }
          }
        } catch (error) {
          console.error('Error checking product_rating table:', error);
        }

        // Format item for response
        formattedItems.push({
          id: String(item.id),
          user_id: String(item.user_id),
          order_id: String(item.order_id),
          product_name: item.product_name || "",
          variant_name: item.variant_name || "",
          product_variant_id: String(item.product_variant_id),
          quantity: String(item.quantity),
          price: String(item.price),
          discounted_price: String(item.discounted_price || ""),
          tax_percent: String(item.tax_percent),
          tax_amount: String(item.tax_amount),
          discount: String(item.discount || "0"),
          sub_total: String(item.sub_total),
          deliver_by: item.deliver_by || "",
          updated_by: String(item.updated_by || "0"),
          status: itemStatus,
          active_status: item.active_status,
          hash_link: item.hash_link || "NULL",
          is_sent: item.is_sent || "0",
          is_download: item.is_download || "0",
          date_added: formatDate(item.date_added),
          product_id: String(item.product_id),
          is_cancelable: String(item.is_cancelable || "1"),
          cancelable_till: item.cancelable_till || "shipped",
          is_returnable: String(item.is_returnable || "1"),
          is_already_returned: isAlreadyReturned,
          is_already_cancelled: isAlreadyCancelled,
          return_request_submitted: returnRequestSubmitted,
          image: imageUrl,
          name: item.name,
          download_allowed: String(item.download_allowed || "0"),
          download_link: item.download_link || "",
          product_rating: String(userRating),
          type: item.type || "variable_product",
          special_price: String(item.special_price || item.price),
          main_price: String(item.main_price || item.price),
          user_rating: String(userRating),
          user_rating_images: userRatingImages,
          user_rating_comment: userRatingComment,
          order_counter: String(parseInt(Math.random() * 5) + 1), // Replace with calculated values
          order_cancel_counter: "0",
          order_return_counter: "0",
          net_amount: String(netAmount),
          varaint_ids: variantAttributes.varaint_ids || '',
          variant_values: variantAttributes.variant_values || '',
          attr_name: variantAttributes.attr_name ? variantAttributes.attr_name.trim() : '',
          image_sm: imageSm,
          image_md: imageMd,
          email: order.email || user.email || " "
        });
      }

      // Get user details
      const [userDetails] = await connection.query(
        `SELECT username, email, mobile FROM users WHERE id = ?`,
        [order.user_id]
      );

      const user = userDetails[0] || {};

      // Check if order is returned or cancelled
      const isAlreadyReturned = orderStatus.some(status => status[0] === 'returned') ? "1" : "0";
      const isAlreadyCancelled = orderStatus.some(status => status[0] === 'cancelled') ? "1" : "0";

      // Calculate tax totals
      let totalTaxPercent = "0";
      let totalTaxAmount = "0";

      if (orderItems.length > 0) {
        const taxPercentages = orderItems.map(item => parseFloat(item.tax_percent || 0));
        const taxAmounts = orderItems.map(item => parseFloat(item.tax_amount || 0));

        totalTaxPercent = Math.max(...taxPercentages).toString();
        totalTaxAmount = taxAmounts.reduce((sum, amount) => sum + amount, 0).toString();
      }

      // Generate invoice URL if needed
      let invoiceHtml = "";
      if (downloadInvoice) {
        try {
          // Generate invoice HTML content
          const [orderDetails] = await connection.query(
            `SELECT o.*, u.username, u.email, u.mobile
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             WHERE o.id = ?`,
            [order.id]
          );

          // Get order items for invoice
          const [invoiceItems] = await connection.query(
            `SELECT oi.*, p.name as product_name, pv.price as main_price,
             p.type, p.is_prices_inclusive_tax, p.tax as tax_id, t.percentage as tax_percentage, t.title as tax_name
             FROM order_items oi
             LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
             LEFT JOIN products p ON pv.product_id = p.id
             LEFT JOIN taxes t ON p.tax = t.id
             WHERE oi.order_id = ?`,
            [order.id]
          );

          // Get system settings for invoice
          const [settingsResult] = await connection.query(
            `SELECT value FROM settings WHERE variable = 'system_settings'`
          );

          const systemSettings = settingsResult.length > 0 ?
            JSON.parse(settingsResult[0].value) : {};

          // Generate full invoice HTML
          invoiceHtml = generateInvoiceHtml(orderDetails[0], invoiceItems, {}, systemSettings);
        } catch (error) {
          console.error('Error generating invoice HTML:', error);
          // Fallback to URL if HTML generation fails
          invoiceHtml = `https://dev.uzvi.in/downloads/invoice-${order.id}`;
        }
      }

      // Format recipient contact
      const recipientContact = order.mobile || user.mobile || "";

      // Format dates properly
      const formattedDateAdded = formatDate(order.date_added);
      const formattedDeliveryDate = order.delivery_date ? 
        formatDate(order.delivery_date).split(' ')[0] : ""; // Only use the date part

      // Format offer details
      let offerType = "";
      let offerName = "";

      if (order.offer_type_details) {
        try {
          // Try to parse PHP serialized data
          // This is simplified - in reality, you'd need a PHP unserialize function
          const offerDetails = parsePHPSerialization(order.offer_type_details);
          offerType = offerDetails.type || "";
          offerName = offerDetails.offer_name || offerDetails.cashback_name || "";
        } catch (e) {
          console.error('Error parsing offer details:', e);
        }
      }

      // Format full order for response
      formattedOrders.push({
        id: String(order.id),
        user_id: String(order.user_id),
        delivery_boy_id: order.delivery_boy_id || "",
        address_id: order.address_id || "",
        mobile: order.mobile || "",
        total: String(order.total || "0"),
        delivery_charge: String(order.delivery_charge || "0"),
        is_delivery_charge_returnable: order.is_delivery_charge_returnable || "",
        wallet_balance: String(order.wallet_balance || "0"),
        final_total: String(order.final_total || "0"),
        total_payable: String(order.total_payable || "0"),
        discount: String(order.discount || "0"),
        promo_code: order.promo_code || "",
        promo_discount: String(order.promo_discount || "0"),
        offer_discount: String(order.offer_discount || "0.00"),
        offer_type: offerType,
        offer_name: offerName,
        payment_method: order.payment_method || "",
        notes: order.notes || "",
        is_local_pickup: order.is_local_pickup || "0",
        is_pos_order: order.is_pos_order || "0",
        address: order.address || "",
        latitude: order.latitude || "",
        longitude: order.longitude || "",
        delivery_time: order.delivery_time ? order.delivery_time.split(' ')[0] : "", // Only use slot without time
        delivery_date: formattedDeliveryDate,
        date_added: formattedDateAdded,
        status: orderStatus,
        active_status: order.active_status || "",
        pickup_location: order.pickup_location || "",
        pickup_time: order.pickup_time || "",
        username: user.username || "",
        country_code: order.country_code || "91",
        email: user.email || " ",
        name: firstItem.name || "",
        download_allowed: firstItem.download_allowed || "0",
        user_name: user.username || "",
        recipient_contact: recipientContact,
        courier_agency: order.courier_agency || "",
        tracking_id: order.tracking_id || "",
        url: order.url || "",
        order_attachments: order.attachments ? JSON.parse(order.attachments || '[]') : [],
        attachments: order.attachments ? JSON.parse(order.attachments || '[]') : [],
        seller_notes: order.seller_notes || "",
        is_returnable: "1", // Default to yes, update with actual data if available
        is_cancelable: "1", // Default to yes, update with actual data if available
        is_already_returned: isAlreadyReturned,
        is_already_cancelled: isAlreadyCancelled,
        return_request_submitted: "",
        already_print_once: order.already_print_once || "0",
        is_printed: order.is_printed || null,
        total_tax_percent: String(totalTaxPercent),
        total_tax_amount: String(totalTaxAmount),
        otp: String(parseInt(order.otp || 0)),
        city: order.city || "0",
        order_items: formattedItems,
        order_note: order.notes || "",
        invoice_html: invoiceHtml,
        offer_type_details: order.offer_type_details || ""
      });
    }

    return {   
      error: false,
      message: "Orders retrieved successfully",
      total: total.toString(),
      data: formattedOrders,
      awaiting: statusCounts.awaiting || "0",
      received: statusCounts.received || "0",
      processed: statusCounts.processed || "0",
      shipped: statusCounts.shipped || "0",
      delivered: statusCounts.delivered || "0",
      cancelled: statusCounts.cancelled || "0",
      returned: statusCounts.returned || "0"
    };
  } catch (error) {
    console.error('Error getting orders:', error);
    // Still return a properly structured response even in case of error
    return {
      error: true,
      message: error.message || 'Failed to get orders',
      total: "0",
      data: [], // Always return an array, even if empty
      awaiting: "0",
      received: "0",
      processed: "0",
      shipped: "0",
      delivered: "0",
      cancelled: "0",
      returned: "0"
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Helper function to parse PHP serialized data (improved version)
 * @param {string} phpStr - PHP serialized string
 * @returns {Object} - Parsed object
 */
function parsePHPSerialization(phpStr) {
  if (!phpStr || typeof phpStr !== 'string') {
    return {};
  }

  try {
    // Try to parse as JSON first (in case we stored it as JSON)
    return JSON.parse(phpStr);
  } catch (e) {
    // If it's not JSON, try to parse PHP serialization format
    try {
      // This is a simplified parser for PHP serialized data
      const result = {};

      // Extract a:2:{s:4:"type";s:8:"cashback";s:13:"cashback_name";s:15:"10% Off Coupon";}
      if (phpStr.includes(':"type";') && (phpStr.includes(':"offer_name";') || phpStr.includes(':"cashback_name";'))) {
        // Extract type
        const typeMatch = phpStr.match(/:"type";s:\d+:"([^"]*)"/);
        if (typeMatch && typeMatch[1]) {
          result.type = typeMatch[1];
        }

        // Extract offer name
        const offerNameMatch = phpStr.match(/:"offer_name";s:\d+:"([^"]*)"/);
        if (offerNameMatch && offerNameMatch[1]) {
          result.offer_name = offerNameMatch[1];
        }

        // Extract cashback name
        const cashbackNameMatch = phpStr.match(/:"cashback_name";s:\d+:"([^"]*)"/);
        if (cashbackNameMatch && cashbackNameMatch[1]) {
          result.cashback_name = cashbackNameMatch[1];
        }
      }

      return result;
    } catch (e) {
      console.error('Error parsing PHP serialization:', e);
      return {};
    }
  }
}

/**
 * Helper function to format date in SQL style format (YYYY-MM-DD HH:MM:SS)
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date) return '';

  try {
    if (typeof date === 'string' && date.includes('-') && date.includes(':')) {
      // Check if already in the desired format (YYYY-MM-DD HH:MM:SS)
      const parts = date.split(' ');
      if (parts.length === 2 && parts[0].split('-').length === 3 && parts[1].split(':').length === 3) {
        // Check if first part is in YYYY-MM-DD format
        const dateParts = parts[0].split('-');
        if (dateParts[0].length === 4) {
          return date; // Already in SQL format
        }
      }
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date); // Return original string if invalid

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error in formatDate:', error);
    return String(date); // Return original string if there's an error
  }
}

/**
 * Update an order item's status
 * @param {string} orderItemId - Order Item ID
 * @param {string} status - New status
 * @returns {Promise<Object>} - Response object
 */
async function updateOrderItemStatus(orderItemId, status) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Validate the status update
    const validation = await validateOrderStatus(orderItemId, status, 'order_items');
    if (validation.error) {
      await connection.rollback();
      return validation;
    }

    const orderItem = validation.data;

    // Get current status array
    let statusArray = [];
    try {
      statusArray = Array.isArray(JSON.parse(orderItem.status || '[]')) ? JSON.parse(orderItem.status) : [];
    } catch (e) {
      console.error('Error parsing status JSON in updateOrderItemStatus:', e);
      statusArray = [];
    }

    // Format the date in a consistent way
    const currentDate = formatDate(new Date());

    // Add new status
    statusArray.push([status, currentDate]);

    // Update order item
    await connection.query(
      'UPDATE order_items SET status = ?, active_status = ? WHERE id = ?',
      [JSON.stringify(statusArray), status, orderItemId]
    );

    // Handle cancelled items - update stock
    if (status === 'cancelled') {
      const [variantResult] = await connection.query(
        'SELECT product_variant_id, quantity FROM order_items WHERE id = ?',
        [orderItemId]
      );

      if (variantResult.length > 0) {
        await connection.query(
          'UPDATE product_variants SET stock = stock + ? WHERE id = ?',
          [variantResult[0].quantity, variantResult[0].product_variant_id]
        );
      }
      
      // Process refund for cancelled item
      await processRefund(orderItemId, status, connection);
    }

    await connection.commit();

    return {
      error: false,
      message: "Status updated successfully",
      data: []
    };

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in updateOrderItemStatus:', error);
    return {
      error: true,
      message: error.message || "Failed to update order item status",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Process refund for an order item or order
 * @param {string} id - Order item ID or Order ID
 * @param {string} status - Order status
 * @param {Object} connection - Database connection
 * @param {string} type - Type of refund (order_items or orders)
 * @returns {Promise<Object>} - Response object
 */
async function processRefund(id, status, connection, type = 'order_items') {
  try {
    const possibleStatus = ['cancelled', 'returned'];
    if (!possibleStatus.includes(status)) {
      return {
        error: true,
        message: 'Refund cannot be processed. Invalid status',
        data: []
      };
    }

    // Get system settings for currency and delivery options
    const [systemSettingsResult] = await connection.query(
      'SELECT value FROM settings WHERE variable = ?',
      ['system_settings']
    );
    
    let systemSettings = {};
    if (systemSettingsResult.length > 0) {
      try {
        systemSettings = JSON.parse(systemSettingsResult[0].value);
      } catch (e) {
        console.error('Error parsing system settings:', e);
      }
    }
    
    const currency = systemSettings.currency || '₹';
    // Get the minimum order amount from system settings
    const minAmount = parseFloat(systemSettings.min_amount || 0);

    if (type === 'order_items') {
      // Get order ID from order item
      const [orderItemResult] = await connection.query(
        'SELECT order_id, sub_total FROM order_items WHERE id = ?',
        [id]
      );
      
      if (orderItemResult.length === 0) {
        return {
          error: true,
          message: 'Order item not found',
          data: []
        };
      }
      
      const orderId = orderItemResult[0].order_id;
      const currentPrice = parseFloat(orderItemResult[0].sub_total) || 0;
      
      // Get order details
      const [orderResult] = await connection.query(
        `SELECT o.*, u.id as user_id 
         FROM orders o 
         LEFT JOIN users u ON o.user_id = u.id 
         WHERE o.id = ?`,
        [orderId]
      );
      
      if (orderResult.length === 0) {
        return {
          error: true,
          message: 'Order not found',
          data: []
        };
      }
      
      const order = orderResult[0];
      const userId = order.user_id;
      const paymentMethod = order.payment_method;
      const total = parseFloat(order.total) || 0;
      const isDeliveryChargeReturnable = order.is_delivery_charge_returnable === '1';
      const deliveryCharge = parseFloat(order.delivery_charge) || 0;
      const promoCode = order.promo_code;
      const promoDiscount = parseFloat(order.promo_discount) || 0;
      const finalTotal = parseFloat(order.final_total) || 0;
      const walletBalance = parseFloat(order.wallet_balance) || 0;
      const totalPayable = parseFloat(order.total_payable) || 0;
      
      // Get order items count and cancelled/returned items count
      const [orderItemsCountResult] = await connection.query(
        `SELECT 
           COUNT(*) as total_items,
           SUM(CASE WHEN active_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_items,
           SUM(CASE WHEN active_status = 'returned' THEN 1 ELSE 0 END) as returned_items
         FROM order_items 
         WHERE order_id = ?`,
        [orderId]
      );
      
      const orderItemsCount = orderItemsCountResult[0].total_items;
      const cancelledItemsCount = orderItemsCountResult[0].cancelled_items;
      const returnedItemsCount = orderItemsCountResult[0].returned_items;
      const lastItem = (cancelledItemsCount + returnedItemsCount + 1) >= orderItemsCount ? 1 : 0;
      
      // Calculate new totals
      const newTotal = total - currentPrice;
      
      // Recalculate delivery charge 
      // Check if the new total is below minimum order amount and adjust delivery charge
      let newDeliveryCharge = (newTotal > 0) ? deliveryCharge : 0;
      
      // If the new total is below the minimum amount, update delivery charge
      if (newTotal < minAmount) {
        // Check if delivery charge was previously free but now should be charged
        if (deliveryCharge === 0) {
          // If this is the address-specific case
          if (order.address_id) {
            const [addressResult] = await connection.query(
              'SELECT area_id FROM addresses WHERE id = ?',
              [order.address_id]
            );
            
            if (addressResult.length > 0 && addressResult[0].area_id) {
              const [areaResult] = await connection.query(
                'SELECT delivery_charges FROM areas WHERE id = ?',
                [addressResult[0].area_id]
              );
              
              if (areaResult.length > 0) {
                newDeliveryCharge = parseFloat(areaResult[0].delivery_charges || 0);
              } else {
                newDeliveryCharge = parseFloat(systemSettings.delivery_charge || 0);
              }
            } else {
              newDeliveryCharge = parseFloat(systemSettings.delivery_charge || 0);
            }
          } else {
            newDeliveryCharge = parseFloat(systemSettings.delivery_charge || 0);
          }
        }
      }
      
      // Recalculate promo discount
      let newPromoDiscount = 0;
      if (promoCode && newTotal > 0) {
        try {
          // Get promo code details
          const [promoCodeResult] = await connection.query(
            'SELECT discount, discount_type, minimum_order_amount, max_discount_amount FROM promo_codes WHERE promo_code = ?',
            [promoCode]
          );
          
          if (promoCodeResult.length > 0) {
            const minOrderAmt = parseFloat(promoCodeResult[0].minimum_order_amount || 0);
            
            // Check if new total meets minimum order amount requirement
            if (newTotal >= minOrderAmt) {
              if (promoCodeResult[0].discount_type === 'percentage') {
                newPromoDiscount = (newTotal * parseFloat(promoCodeResult[0].discount || 0)) / 100;
                const maxDiscount = parseFloat(promoCodeResult[0].max_discount_amount || 0);
                if (maxDiscount > 0 && newPromoDiscount > maxDiscount) {
                  newPromoDiscount = maxDiscount;
                }
              } else {
                newPromoDiscount = parseFloat(promoCodeResult[0].discount || 0);
              }
            }
          }
        } catch (e) {
          console.error('Error recalculating promo discount:', e);
        }
      }
      
      // Calculate new final total
      const newFinalTotal = newTotal + newDeliveryCharge - newPromoDiscount;
      
      // Calculate returnable amount and new wallet balance
      let returnableAmount = 0;
      let newWalletBalance = walletBalance;
      
      if (paymentMethod.toLowerCase() === 'cod' || paymentMethod === 'Bank Transfer') {
        // For COD or Bank Transfer (payment not yet done)
        returnableAmount = (walletBalance <= currentPrice) ? walletBalance : (walletBalance > 0 ? currentPrice : 0);
        returnableAmount = (promoDiscount !== newPromoDiscount && lastItem === 0) ? 
          returnableAmount - promoDiscount + newPromoDiscount : returnableAmount;
        returnableAmount = Math.max(0, returnableAmount);
        
        newWalletBalance = (returnableAmount > 0) ? 
          (walletBalance <= currentPrice ? 0 : Math.max(0, walletBalance - currentPrice)) : walletBalance;
      } else {
        // For other payment methods (payment already done)
        returnableAmount = currentPrice;
        returnableAmount = (promoDiscount !== newPromoDiscount) ? 
          returnableAmount - promoDiscount + newPromoDiscount : returnableAmount;
        returnableAmount = (lastItem === 1 && isDeliveryChargeReturnable) ? 
          returnableAmount + deliveryCharge : returnableAmount;
        returnableAmount = Math.max(0, returnableAmount);
        
        newWalletBalance = (lastItem === 1) ? 0 : Math.max(0, walletBalance - returnableAmount);
      }
      
      // Calculate new total payable
      let newTotalPayable = 0;
      if (paymentMethod.toLowerCase() === 'cod' || paymentMethod === 'Bank Transfer') {
        newTotalPayable = newFinalTotal - newWalletBalance;
      }
      
      if (newTotal === 0) {
        newWalletBalance = newDeliveryCharge = newFinalTotal = newTotalPayable = 0;
      }
      
      // Add refund amount to user's wallet if applicable
      if (returnableAmount > 0) {
        // Get user's FCM token for notification
        const [userResult] = await connection.query(
          'SELECT fcm_id FROM users WHERE id = ?',
          [userId]
        );
        
        if (userResult.length > 0 && userResult[0].fcm_id) {
          // Send notification code would go here
          console.log(`Would send notification to user ${userId} for refund of ${returnableAmount}`);
        }
        
        // Update wallet balance
        if (paymentMethod === 'Razorpay' || paymentMethod === 'Paystack' || paymentMethod === 'Flutterwave') {
          await updateWalletBalance('refund', userId, returnableAmount, 
            `Amount Refund for Order Item ID: ${id}`, id, connection);
        } else {
          await updateWalletBalance('credit', userId, returnableAmount, 
            `Refund Amount Credited for Order Item ID: ${id}`, id, connection);
        }
      }
      
      // Update order with new totals
      await connection.query(
        `UPDATE orders SET 
           total = ?,
           final_total = ?,
           total_payable = ?,
           promo_discount = ?,
           delivery_charge = ?,
           wallet_balance = ?
         WHERE id = ?`,
        [
          newTotal,
          newFinalTotal,
          newTotalPayable,
          newPromoDiscount > 0 ? newPromoDiscount : 0,
          newDeliveryCharge,
          newWalletBalance,
          orderId
        ]
      );
      
      return {
        error: false,
        message: 'Refund processed successfully',
        data: []
      };
    } else if (type === 'orders') {
      // Process refund for entire order
      const [orderResult] = await connection.query(
        `SELECT o.*, u.id as user_id, u.fcm_id 
         FROM orders o 
         LEFT JOIN users u ON o.user_id = u.id 
         WHERE o.id = ?`,
        [id]
      );
      
      if (orderResult.length === 0) {
        return {
          error: true,
          message: 'Order not found',
          data: []
        };
      }
      
      const order = orderResult[0];
      const userId = order.user_id;
      const paymentMethod = (order.payment_method || '').toLowerCase();
      const isDeliveryChargeReturnable = order.is_delivery_charge_returnable === '1';
      const walletBalance = parseFloat(order.wallet_balance) || 0;
      
      // Check if wallet refund is applicable
      let walletRefund = true;
      
      // Check if this is a bank transfer that hasn't been accepted
      let isTransferAccepted = false;
      if (paymentMethod === 'bank transfer') {
        const [bankReceiptResult] = await connection.query(
          'SELECT status FROM order_bank_transfer WHERE order_id = ?',
          [id]
        );
        
        if (bankReceiptResult.length > 0) {
          for (const receipt of bankReceiptResult) {
            if (receipt.status === 2) { // Assuming 2 means accepted
              isTransferAccepted = true;
              break;
            }
          }
        }
      }
      
      // Don't refund for bank transfers that haven't been accepted and have no wallet balance
      if (walletBalance === 0 && status === 'cancelled' && paymentMethod === 'bank transfer' && !isTransferAccepted) {
        walletRefund = false;
      }
      
      if (walletRefund) {
        let returnableAmount = 0;
        
        if (paymentMethod !== 'cod') {
          // For non-COD orders, refund the total amount and delivery charge if applicable
          returnableAmount = isDeliveryChargeReturnable 
            ? parseFloat(order.total) + parseFloat(order.delivery_charge || 0)
            : parseFloat(order.total);
          
          // Adjust for bank transfers that haven't been accepted
          if (paymentMethod === 'bank transfer' && !isTransferAccepted) {
            returnableAmount = returnableAmount - parseFloat(order.total_payable || 0);
          }
          
          // Send notification if user has FCM token
          if (order.fcm_id) {
            // In real implementation, would send FCM notification here
            console.log(`Would send notification to user ${userId} for refund of ${returnableAmount}`);
          }
          
          // Update wallet balance
          if (returnableAmount > 0) {
            await updateWalletBalance('credit', userId, returnableAmount, 
              `Wallet Amount Credited for Order ID: ${id}`, null, connection);
          }
        } else if (walletBalance > 0) {
          // For COD orders, only refund the wallet balance that was used
          returnableAmount = walletBalance;
          
          // Send notification if user has FCM token
          if (order.fcm_id) {
            // In real implementation, would send FCM notification here
            console.log(`Would send notification to user ${userId} for refund of ${returnableAmount}`);
          }
          
          // Update wallet balance
          if (returnableAmount > 0) {
            await updateWalletBalance('credit', userId, returnableAmount, 
              `Wallet Amount Credited for Order ID: ${id}`, null, connection);
            
            // Update order's wallet balance
            await connection.query(
              'UPDATE orders SET wallet_balance = 0 WHERE id = ?',
              [id]
            );
          }
        }
      }
    }
    
    return {
      error: true,
      message: 'Invalid refund type',
      data: []
    };
    
  } catch (error) {
    console.error('Error in processRefund:', error);
    return {
      error: true,
      message: error.message || 'Failed to process refund',
      data: []
    };
  }
}

/**
 * Update wallet balance
 * @param {string} operation - Operation type (credit, debit, refund)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to update
 * @param {string} message - Message for transaction
 * @param {string} orderItemId - Order item ID
 * @param {Object} connection - Database connection
 * @returns {Promise<Object>} - Response object
 */
async function updateWalletBalance(operation, userId, amount, message, orderItemId, connection) {
  try {
    // Get current balance
    const [userResult] = await connection.query(
      'SELECT balance FROM users WHERE id = ?',
      [userId]
    );
    
    if (userResult.length === 0) {
      return {
        error: true,
        message: 'User not found',
        data: []
      };
    }
    
    let balance = parseFloat(userResult[0].balance) || 0;
    
    // Validate amount
    if (amount === 0) {
      return {
        error: true,
        message: "Amount can't be Zero!",
        data: []
      };
    }
    
    // Validate balance for debit operations
    if (operation === 'debit' && amount > balance) {
      return {
        error: true,
        message: "Debited amount can't exceeds the user balance!",
        data: []
      };
    }
    
    // Validate balance is >= 0
    if (balance < 0) {
      return {
        error: true,
        message: balance !== 0 ? 
          `User's Wallet balance less than ${balance} can be used only` : 
          "Doesn't have sufficient wallet balance to proceed further.",
        data: []
      };
    }
    
    let newBalance = balance;
    
    // Update balance based on operation
    if (operation === 'credit' || operation === 'refund') {
      newBalance = balance + amount;
    } else if (operation === 'debit') {
      newBalance = balance - amount;
    }
    
    // Update user balance using direct SQL update
    await connection.query(
      'UPDATE users SET balance = ? WHERE id = ?',
      [newBalance, userId]
    );
    
    // Add transaction record
    const type = operation === 'refund' ? 'refund' : (operation === 'credit' ? 'credit' : 'debit');
    
    await connection.query(
      `INSERT INTO transactions (transaction_type, user_id, type, amount, message, status, transaction_date, order_item_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      ['wallet', userId, type, amount, message || (operation === 'debit' ? 'Balance Debited' : 'Balance Credited'), 'success', orderItemId]
    );
    
    return {
      error: false,
      message: "Balance Update Successfully",
      data: []
    };
    
  } catch (error) {
    console.error('Error in updateWalletBalance:', error);
    return {
      error: true,
      message: error.message || 'Failed to update wallet balance',
      data: []
    };
  }
}

/**
 * Update an order's status
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @returns {Promise<Object>} - Response object
 */
async function updateOrderStatus(orderId, status) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Validate the status update
    const validation = await validateOrderStatus(orderId, status, 'orders');
    if (validation.error) {
      await connection.rollback();
      return validation;
    }

    const order = validation.data;

    // Get current status array
    let statusArray = [];
    try {
      statusArray = Array.isArray(JSON.parse(order.status || '[]')) ? JSON.parse(order.status) : [];
    } catch (e) {
      console.error('Error parsing status JSON in updateOrderStatus:', e);
      statusArray = [];
    }

    // Format the date in a consistent way
    const currentDate = formatDate(new Date());

    // Add new status
    statusArray.push([status, currentDate]);

    // Update order
    await connection.query(
      'UPDATE orders SET status = ?, active_status = ? WHERE id = ?',
      [JSON.stringify(statusArray), status, orderId]
    );

    // Update all order items with the same status
    await connection.query(
      'UPDATE order_items SET active_status = ? WHERE order_id = ?',
      [status, orderId]
    );

    // For each item, update the status array
    const [orderItems] = await connection.query(
      'SELECT id, status FROM order_items WHERE order_id = ?',
      [orderId]
    );

    for (const item of orderItems) {
      let itemStatusArray = [];
      try {
        itemStatusArray = Array.isArray(JSON.parse(item.status || '[]')) ? JSON.parse(item.status) : [];
      } catch (e) {
        console.error('Error parsing item status JSON:', e);
        itemStatusArray = [];
      }

      // Add new status to item
      itemStatusArray.push([status, currentDate]);

      // Update item status
      await connection.query(
        'UPDATE order_items SET status = ? WHERE id = ?',
        [JSON.stringify(itemStatusArray), item.id]
      );
    }

    // Handle cancelled orders - update stock for all items
    if (status === 'cancelled' || status === 'returned') {
      // 1. Update stock for all items
      const [itemsResult] = await connection.query(
        'SELECT product_variant_id, quantity FROM order_items WHERE order_id = ?',
        [orderId]
      );

      for (const item of itemsResult) {
        await connection.query(
          'UPDATE product_variants SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_variant_id]
        );
      }
      
      // 2. Process refund for the whole order
      await processRefund(orderId, status, connection, 'orders');
    }

    await connection.commit();

    // Get the updated order with user information
    const [updatedOrderResult] = await connection.query(
      `SELECT o.*, u.username, u.email, u.mobile 
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [orderId]
    );

    const updatedOrder = updatedOrderResult.length > 0 ? updatedOrderResult[0] : {};

    // Format status for response
    if (updatedOrder.status) {
      try {
        updatedOrder.status = JSON.parse(updatedOrder.status);
      } catch (e) {
        updatedOrder.status = [];
      }
    }

    // Get updated order items with product information
    const [updatedItems] = await connection.query(
      `SELECT oi.*, pv.product_id, p.name as product_name
       FROM order_items oi
       LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
       LEFT JOIN products p ON pv.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // Format item status for response
    const formattedItems = updatedItems.map(item => {
      const formattedItem = { ...item };
      if (formattedItem.status) {
        try {
          formattedItem.status = JSON.parse(formattedItem.status);
        } catch (e) {
          formattedItem.status = [];
        }
      }
      return formattedItem;
    });

    return {
      error: false,
      message: "Order status updated successfully",
      data: {
        order: updatedOrder,
        order_items: formattedItems
      }
    };

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in updateOrderStatus:', error);
    return {
      error: true,
      message: error.message || "Failed to update order status",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Generate invoice HTML content
 * @param {Object} order - Order data
 * @param {Array} items - Order items
 * @param {Object} address - Address data
 * @param {Object} settings - System settings
 * @returns {string} - HTML content
 */
function generateInvoiceHtml(order, items, address, settings) {
  if (!order || !items) return "";

  try {
    // Format date
    const formattedDate = order.date_added ? formatDate(order.date_added) : '';

    // Calculate order amounts
    const taxAmount = items.reduce((sum, item) => sum + parseFloat(item.tax_amount || 0), 0);
    const subTotal = items.reduce((sum, item) => sum + parseFloat(item.sub_total || 0), 0);

    // Build HTML header
    let html = `<!DOCTYPE html>
<html>
<!-- Icons. Uncomment required icon fonts -->
<link rel="stylesheet" href="https://dev.uzvi.in/assets/admin/vendor/fonts/boxicons.css" />

<link rel="stylesheet" href="https://dev.uzvi.in/assets/admin/vendor/css/core.css" class="template-customizer-core-css" />
<link rel="stylesheet" href="https://dev.uzvi.in/assets/admin/vendor/css/theme-default.css" class="template-customizer-theme-css" />


<link rel="stylesheet" href="https://dev.uzvi.in/assets/admin/css/demo.css" />

<!-- Vendors CSS -->
<link rel="stylesheet" href="https://dev.uzvi.in/assets/admin/vendor/libs/perfect-scrollbar/perfect-scrollbar.css" />


<link rel="stylesheet" href="https://dev.uzvi.in/assets/admin/vendor/css/pages/page-auth.css" />
<!-- Old admin template -->

<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Invoice Management |${settings.app_name || 'Uzvis,Vijayawada-520010'}</title>
    <!-- Tell the browser to be responsive to screen width -->
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="https://dev.uzvi.in/uploads/media/2022/uzvis.png" type="image/gif" sizes="16x16">
    <!-- Bootstrap Switch -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/bootstrap-switch.min.css">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/all.min.css">
    <!-- Ionicons -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/ionicons.min.css">
    <!-- Tempusdominus Bbootstrap 4 -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/tempusdominus-bootstrap-4.min.css">
    <!-- iCheck -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/icheck-bootstrap.min.css">
    <!-- Dropzone -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/dropzone.css">
    <!-- JQVMap -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/jqvmap.min.css">
    <!-- Ekko Lightbox -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/ekko-lightbox/ekko-lightbox.css">
    <!-- Theme style
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/dist/css/adminlte.min.css"> -->
    <!-- overlayScrollbars -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/OverlayScrollbars.min.css">
    <!-- Daterange picker -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/daterangepicker.css">
    <!-- tinymce -->
    <script src="https://dev.uzvi.in/assets/admin_old/js/tinymce.min.js"></script>
    <!-- Toastr -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/iziToast.min.css">
    <!-- Select2 -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/select2.min.css">
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/select2-bootstrap4.min.css">
    <!-- Sweet Alert -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/sweetalert2.min.css">
    <!-- Chartist -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/chartist.css">
    <!-- JS tree -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/style.min.css">
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/star-rating.min.css">
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/theme.css">

    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/fonts.css">
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/bootstrap-table.min.css">
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/jquery.fancybox.min.css" />
    <!-- Custom CSS -->
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/custom/custom.css">
    <!-- jQuery -->
    <script src="https://dev.uzvi.in/assets/admin_old/js/jquery.min.js"></script>
    <!-- Star rating js -->
    <script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/star-rating.js"></script>
    <script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/theme.min.js"></script>
    <link rel="stylesheet" href="https://dev.uzvi.in/assets/admin_old/css/tagify.min.css">
    <script type="text/javascript">
        base_url = "https://dev.uzvi.in/";
        csrfName = "ekart_security_token";
        csrfHash = "e0484492e13bc343a812ea1d273c2cd9";
        form_name = '#view/api-order-invoice_form';
    </script>

</head>
<body class="hold-transition sidebar-mini layout-fixed ">
    <div class=" wrapper ">
        <section class="content">
    <div class="container-fluid">
        <div class="row">
            <div class="col-md-12">
                <div class="card card-info " id="section-to-print">
                    <div class="row m-3">
                        <div class="col-md-12 d-flex justify-content-between">
                            <h2 class="text-left">
                                <img src="https://dev.uzvi.in/uploads/media/2022/uzvis.png" class="d-block " style="max-width:250px;max-height:100px;">
                            </h2>
                            <h2 class="text-right">
                                Mo. ${settings.support_number || '9120042009'}
                            </h2>
                            
                        </div>
                        <!-- /.col -->
                    </div>
                    <!-- info row -->
                    <div class="row m-3 d-flex justify-content-between">
                        <div class="col-sm-4 invoice-col">From <address>
                                <strong>${settings.app_name || 'Uzvis,Vijayawada-520010'}</strong><br>
                                Email: ${settings.support_email || 'support@uzvis.com'}<br>
                                Customer Care : ${settings.support_number || '9120042009'}<br>
                                ${settings.tax_name ? `<b>${settings.tax_name}</b> : ${settings.tax_number}<br>` : ''}
                            </address>
                        </div>
                        <!-- /.col -->
                        <div class="col-sm-4 invoice-col">To <address>
                                <strong>${order.username || ''}</strong><br>
                                ${order.address || ''}<br>
                                <strong>${order.mobile || ''}</strong><br>
                                <strong>${order.email || ''}</strong><br>
                            </address>
                        </div>
                        <!-- /.col -->
                        <div class="col-sm-2 invoice-col">
                            <br> <b>Retail Invoice</b>
                            <br> <b>No : </b>#${order.id}
                            <br> <b>Date: </b>${formattedDate}
                            <br>
                        </div>
                    </div>
                    <!-- /.row -->
                    <!-- Table row -->
                    <div class="row m-3">
                        <div class="col-xs-12 table-responsive">
                            <table class="table borderless text-center text-sm">
                                <thead class="">
                                    <tr>
                                        <th>Sr No.</th>
                                        <th>Product Code</th>
                                        <th>Name</th>
                                        <th>Price</th>
                                        <th>Tax (%)</th>
                                        <th>Qty</th>
                                        <th class="d-none">Tax Amount (₹)</th>
                                        <th>SubTotal (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>`;

    // Add items to invoice
    let totalQty = 0;
    items.forEach((item, index) => {
      totalQty += parseInt(item.quantity || 0);
      const taxPercentage = item.tax_percentage || 0;
      const taxName = taxPercentage > 0 ? `${taxPercentage}(${taxPercentage}%)` : "0(0%)";
      const price = parseFloat(item.price || 0).toLocaleString('en-IN');
      const taxAmount = parseFloat(item.tax_amount || 0).toLocaleString('en-IN');
      const subTotal = parseFloat(item.sub_total || 0).toLocaleString('en-IN');

      html += `
                                        <tr>
                                            <td>${index + 1}<br>
                                            </td>
                                            <td>
                                                ${item.product_variant_id}<br>
                                            </td>
                                            <td class="w-25">
                                                ${item.product_name || item.name || ''}<br>
                                            </td>
                                            <td>
                                                ₹ ${price}<br>
                                            </td>
                                            <td>${taxName}<br></td>
                                            <br>
                                            <td>
                                                ${item.quantity}<br>
                                            </td>
                                            <td class="d-none">
                                                ${taxAmount > 0 ? '₹ ' + taxAmount : '0'}<br>
                                            </td>
                                            <td>
                                                ₹ ${subTotal}<br>
                                            </td>
                                        </tr>`;
    });

    // Add totals
    const totalAmount = parseFloat(order.final_total || 0).toLocaleString('en-IN');
    html += `
                                </tbody>
                                <tbody>
                                    <tr>
                                        <th></th>
                                        <th></th>
                                        <th></th>
                                        <th></th>
                                        <th>Total</th>
                                        <th>
                                            ${totalQty}<br>
                                        </th>
                                        <th>
                                            ₹ ${totalAmount}<br>
                                        </th>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <!-- /.col -->
                    </div>
                    <!-- /.row -->
                    <div class="row m-2 text-right">
                        <!-- accepted payments column -->
                        <div class="col-md-9 offset-md-2">
                            <!--<p class="lead">Payment Date: </p>-->
                            <div class="table-responsive">
                                <table class="table table-borderless">
                                    <tbody>
                                        <tr>
                                            <th></th>
                                        </tr>
                                        <tr>
                                            <th>Total Order Price</th>
                                            <td>+
                                                ₹ ${parseFloat(order.total || 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>Delivery Charge</th>
                                            <td>+
                                                ₹ ${parseFloat(order.delivery_charge || 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                        <tr class="d-none">
                                            <th>Tax - (${taxAmount > 0 ? items[0].tax_percentage : '0'}%)</th>
                                            <td>+
                                                ${taxAmount}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>Wallet Used</th>
                                            <td>-
                                                ₹ ${parseFloat(order.wallet_balance || 0).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                        <tr class="d-none">
                                            <th>Total Payable</th>
                                            <td>
                                                ₹ ${(parseFloat(order.total || 0) + parseFloat(order.delivery_charge || 0) + parseFloat(taxAmount)).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                        <tr>
                                            <th>Final Total</th>
                                            <td>
                                                ₹ ${order.final_total || '0'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <!-- /.col -->
                    </div>
                </div>
                <!--/.card-->
            </div>
            <!--/.col-md-12-->
        </div>
        <!-- /.row -->
    </div>
    <!-- /.container-fluid -->
    </section>    </div>
    <!-- Helpers -->
<!-- C:\\xampp\\htdocs\\eshop-sneat\\assets\\admin\\vendor\\js -->
<script src="https://dev.uzvi.in/assets/admin/vendor/js/helpers.js"></script>
<script src="https://dev.uzvi.in/assets/admin/js/config.js"></script>

<script src="https://dev.uzvi.in/assets/admin/vendor/libs/popper/popper.js"></script>

<script src="https://dev.uzvi.in/assets/admin/vendor/libs/perfect-scrollbar/perfect-scrollbar.js"></script>
<script src="https://dev.uzvi.in/assets/admin/vendor/js/menu.js"></script>
<script src="https://dev.uzvi.in/assets/admin/js/main.js"></script>
<script async defer src="https://buttons.github.io/buttons.js"></script>



<!-- Old admin template JS -->
<script src="https://dev.uzvi.in/assets/admin_old/js/bootstrap.bundle.min.js"></script>
<!-- jQuery UI 1.11.4 -->
<script src="https://dev.uzvi.in/assets/admin_old/jquery-ui/jquery-ui.min.js"></script>
<!-- Resolve conflict in jQuery UI tooltip with Bootstrap tooltip -->
<script>
    $.widget.bridge('uibutton', $.ui.button)
</script>
<!-- Ekko Lightbox -->
<script src=https://dev.uzvi.in/assets/admin_old/ekko-lightbox/ekko-lightbox.min.js></script>

<!-- google translate library -->
<script type="text/javascript" src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"></script>

<!-- ChartJS -->
<script src="https://dev.uzvi.in/assets/admin_old/chart.js/Chart.min.js"></script>
<!-- Sparkline -->
<script src="https://dev.uzvi.in/assets/admin_old/js/sparkline.js"></script>
<!-- JQVMap -->
<script src="https://dev.uzvi.in/assets/admin_old/js/jquery.vmap.min.js"></script>
<script src="https://dev.uzvi.in/assets/admin_old/js/jquery.vmap.usa.js"></script>
<!-- jQuery Knob Chart -->
<script src="https://dev.uzvi.in/assets/admin_old/js/jquery.knob.min.js"></script>
<!-- daterangepicker -->
<script src="https://dev.uzvi.in/assets/admin_old/js/moment.min.js"></script>
<script src="https://dev.uzvi.in/assets/admin_old/js/daterangepicker.js"></script>
<!-- Tempusdominus Bootstrap 4 -->
<script src="https://dev.uzvi.in/assets/admin_old/js/tempusdominus-bootstrap-4.min.js"></script>
<!-- Toastr -->
<script src="https://dev.uzvi.in/assets/admin_old/js/iziToast.min.js"></script>
<!-- Select -->
<script src="https://dev.uzvi.in/assets/admin_old/js/select2.full.min.js"></script>
<!-- overlayScrollbars -->
<script src="https://dev.uzvi.in/assets/admin_old/js/jquery.overlayScrollbars.min.js"></script>
<!-- AdminLTE App -->
<script src="https://dev.uzvi.in/assets/admin_old/dist/js/adminlte.js"></script>
<!-- Bootstrap Switch -->
<script src="https://dev.uzvi.in/assets/admin_old/js/bootstrap-switch.min.js"></script>
<!-- Bootstrap Table -->
<script src="https://dev.uzvi.in/assets/admin_old/js/bootstrap-table.min.js"></script>
<script src="https://dev.uzvi.in/assets/admin_old/js/tableExport.js"></script>
<script src="https://dev.uzvi.in/assets/admin_old/js//bootstrap-table-export.min.js"></script>
<!-- Jquery Fancybox -->
<script src="https://dev.uzvi.in/assets/admin_old/js/jquery.fancybox.min.js"></script>
<!-- Sweeta Alert 2 -->
<script src="https://dev.uzvi.in/assets/admin_old/js/sweetalert2.min.js"></script>
<!-- Block UI -->
<script src="https://dev.uzvi.in/assets/admin_old/js/jquery.blockUI.js"></script>
<!-- JS tree -->
<script src="https://dev.uzvi.in/assets/admin_old/js/jstree.min.js"></script>
<!-- Chartist -->
<script src="https://dev.uzvi.in/assets/admin_old/js/chartist.js"></script>
<!-- Tool Tip -->
<script src="https://dev.uzvi.in/assets/admin_old/js/tooltip.js"></script>
<!-- Loader Js -->
<script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/loader.js"></script>
<!-- Dropzone -->
<script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/dropzone.js"></script>

<script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/tagify.min.js"></script>
<script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/jquery.validate.min.js"></script>

<!-- Sortable.JS -->
<script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/sortable.js"></script>
<!-- Sortable.min.js -->
<script type="text/javascript" src="https://dev.uzvi.in/assets/admin_old/js/jquery-sortable.js"></script>

<!-- Custom -->
<script src="https://dev.uzvi.in/assets/admin_old/custom/custom.js"></script>
<!-- POS js -->
<script src="https://dev.uzvi.in/assets/admin_old/custom/pos.js"></script>
<!-- Demo -->
<script src="https://dev.uzvi.in/assets/admin_old/dist/js/demo.js"></script>


</body>

</html>`;

    return html;
  } catch (error) {
    console.error('Error generating invoice HTML:', error);
    return "";
  }
}

module.exports = {
  placeOrder,
  getOrders,
  updateOrderItemStatus,
  updateOrderStatus,
  generateInvoiceHtml,
  getAllTimeSlots,
  validateOrderStatus,
  processRefund,
  updateWalletBalance
}; 