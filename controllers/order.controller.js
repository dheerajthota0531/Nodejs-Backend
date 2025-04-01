const {
  placeOrder,
  getOrders,
  updateOrderItemStatus,
  updateOrderStatus,
  getAllTimeSlots
} = require('../models/order.model');
const { addTransaction } = require('../models/transaction.model');
// const { validateToken } = require('../helpers/jwt'); // Temporarily commented out for development
const { validateToken } = require('../helpers/jwt');
const db = require('../config/database');
const { formatResponse } = require('../helpers/functions');
const { apply_place_order, check_offer_place_order } = require('../models/return_request.model');
const { initiatePayment } = require('../services/phonepe.service');

/**
 * Place a new order
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function placeOrderController(req, res) {
  try {
    console.log('Place order request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);

    // Authentication temporarily disabled for development
    /*
    const tokenValidation = await validateToken(req);
    if (!tokenValidation.valid) {
      return res.status(401).json({
        error: true,
        message: tokenValidation.message,
        data: []
      });
    }
    */

    // Validate required parameters
    const formData = { ...req.body };
    
    // Check for time slot parameter in query or body
    if (req.query.select_time_slot_id) {
      formData.select_time_slot_id = req.query.select_time_slot_id;
    } else if (req.body.select_time_slot_id) {
      formData.select_time_slot_id = req.body.select_time_slot_id;
    }
    
    // Handle delivery date/time from either query or body
    if (req.query.delivery_date) {
      formData.delivery_date = req.query.delivery_date;
    }
    
    if (req.query.delivery_time) {
      formData.delivery_time = req.query.delivery_time;
    }
    
    const requiredParams = ['user_id', 'mobile', 'product_variant_id', 'quantity', 'final_total', 'payment_method'];

    // Check if any required parameters are missing
    const missingParams = requiredParams.filter(param => !formData[param]);
    if (missingParams.length > 0) {
      console.log('Missing required parameters:', missingParams);
      return res.status(400).json({
        error: true,
        message: `${missingParams.join(', ')} is required`,
        data: []
      });
    }

    // Process form data - ensure all values have proper types
    formData.is_delivery_charge_returnable = formData.is_delivery_charge_returnable || 0;

    // Make sure product_variant_id and quantity are strings
    if (Array.isArray(formData.product_variant_id)) {
      formData.product_variant_id = formData.product_variant_id.join(',');
    }

    if (Array.isArray(formData.quantity)) {
      formData.quantity = formData.quantity.join(',');
    }

    // Ensure all numeric values are properly handled
    ['final_total', 'delivery_charge', 'wallet_balance', 'total', 'total_payable'].forEach(field => {
      if (formData[field] !== undefined) {
        formData[field] = parseFloat(formData[field]);
      }
    });

    console.log('Processed form data:', formData);

    // Validate offer parameters if provided
    if (formData.offer_id && formData.offer_id !== '') {
      // Ensure offer_type is valid
      if (!formData.offer_type || !['cashback', 'instant_discount'].includes(formData.offer_type)) {
        return res.status(400).json({
          error: true,
          message: "Invalid or missing offer_type. Must be 'cashback' or 'instant_discount'",
          data: []
        });
      }

      // Ensure offer_discount_amount is a valid number
      formData.offer_discount_amount = formData.offer_discount_amount
        ? parseFloat(formData.offer_discount_amount)
        : 0;

      if (isNaN(formData.offer_discount_amount)) {
        formData.offer_discount_amount = 0;
      }
    } else {
      // Set default values if offer is not provided
      formData.offer_id = '';
      formData.offer_type = '';
      formData.offer_discount_amount = 0;
    }

    // Check if payment method is PhonePe for direct payment flow
    if (formData.payment_method === 'PhonePe') {
      // Place order first to get order_id
      const result = await placeOrder(formData);
      console.log('Place order result with PhonePe:', result);
      
      if (!result.error && result.order_id) {
        // Return success with order details but mark that PhonePe payment is needed
        return res.status(200).json({
          error: false,
          message: "Order placed successfully. Payment required.",
          order_id: result.order_id,
          final_amount: result.final_amount,
          offer_discount_amount: formData.offer_discount_amount || 0,
          order_item_data: result.order_item_data,
          balance: result.balance,
          payment_method: 'PhonePe',
          payment_required: true
        });
      } else {
        return res.status(400).json(result);
      }
    }

    // Check if offer is provided
    if (formData.offer_id && formData.offer_id !== '') {
      try {
        // Check offer validity
        const checkOfferResult = await check_offer_place_order(
          formData.offer_id,
          formData.offer_type,
          formData.final_total,
          formData.user_id
        );

        if (checkOfferResult.error) {
          return res.status(400).json(checkOfferResult);
        }

        // Place order
        const result = await placeOrder(formData);
        console.log('Place order result with offer:', result);

        if (!result.error && result.order_id) {
          // Apply offer code
          const applyOfferResult = await apply_place_order(
            formData.offer_id,
            formData.offer_type,
            formData.final_total,
            formData.user_id,
            result.order_id,
            formData.offer_discount_amount
          );

          // Handle transaction for bank transfer
          if (formData.payment_method === 'bank_transfer') {
            const transactionData = {
              status: 'awaiting',
              txn_id: null,
              message: null,
              order_id: result.order_id,
              user_id: formData.user_id,
              type: formData.payment_method,
              amount: formData.final_total
            };

            await addTransaction(transactionData);
          }

          // If order is successful and payment was made, add transaction record
          if (formData.payment_method === 'Paypal' ||
            formData.payment_method === 'Razorpay' ||
            formData.payment_method === 'Stripe' ||
            formData.payment_method === 'Flutterwave' ||
            formData.payment_method === 'Paytm') {

            // Add transaction if not already added in placeOrder function
            if (formData.txn_id) {
              const transactionData = {
                transaction_type: 'transaction',
                user_id: formData.user_id,
                order_id: result.order_id,
                type: 'credit',
                txn_id: formData.txn_id,
                amount: formData.final_total,
                status: 'success',
                message: `Payment for order #${result.order_id}`
              };

              await addTransaction(transactionData);
            }
          }

          return res.status(200).json({
            error: result.error,
            message: result.message,
            order_id: result.order_id,
            final_amount: result.final_amount,
            offer_discount_amount: formData.offer_discount_amount || 0,
            order_item_data: result.order_item_data,
            balance: result.balance
          });
        } else {
          return res.status(400).json(result);
        }
      } catch (error) {
        console.error('Error processing offer:', error);
        return res.status(500).json(formatResponse(
          true,
          error.message || "Failed to process offer",
          []
        ));
      }
    } else {
      // No offer - regular order process
      const result = await placeOrder(formData);
      console.log('Place order result without offer:', result);

      // Handle transaction for bank transfer
      if (!result.error && result.order_id && formData.payment_method === 'bank_transfer') {
        const transactionData = {
          status: 'awaiting',
          txn_id: null,
          message: null,
          order_id: result.order_id,
          user_id: formData.user_id,
          type: formData.payment_method,
          amount: formData.final_total
        };

        await addTransaction(transactionData);
      }

      // If order is successful and payment was made, add transaction record
      if (!result.error && result.order_id &&
        (formData.payment_method === 'Paypal' ||
          formData.payment_method === 'Razorpay' ||
          formData.payment_method === 'Stripe' ||
          formData.payment_method === 'Flutterwave' ||
          formData.payment_method === 'Paytm')) {

        // Add transaction if not already added in placeOrder function
        if (formData.txn_id) {
          const transactionData = {
            transaction_type: 'transaction',
            user_id: formData.user_id,
            order_id: result.order_id,
            type: 'credit',
            txn_id: formData.txn_id,
            amount: formData.final_total,
            status: 'success',
            message: `Payment for order #${result.order_id}`
          };

          await addTransaction(transactionData);
        }
      }

      // Return response with proper structure matching PHP
      return res.status(result.error ? 400 : 200).json({
        error: result.error,
        message: result.message,
        order_id: result.order_id,
        final_amount: result.final_amount,
        offer_discount_amount: 0,
        order_item_data: result.order_item_data,
        balance: result.balance
      });
    }
  } catch (error) {
    console.error('Error in placeOrderController:', error);
    return res.status(500).json(formatResponse(
      true,
      error.message || "Failed to place order",
      []
    ));
  }
}

/**
 * Controller function to retrieve orders for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - Response object with orders
 */
async function getOrdersController(req, res) {
  try {
    console.log('Get orders request received');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);

    // Extract user ID from body, auth token, or query
    const userId = req.body.user_id || req.userId || req.query.user_id;

    // Parse booleans and integers from various sources
    const parseValue = (val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      if (!isNaN(val) && !isNaN(parseInt(val))) return parseInt(val);
      return val;
    };

    // Extract optional params with defaults, checking both body and query
    const getParam = (name, defaultValue) => {
      const bodyVal = req.body[name];
      const queryVal = req.query[name];
      const value = bodyVal !== undefined ? bodyVal : (queryVal !== undefined ? queryVal : defaultValue);
      return parseValue(value);
    };

    if (!userId) {
      return res.status(400).json({
        error: true,
        message: "User ID is required",
        total: "0",
        data: [],
        awaiting: "0",
        received: "0",
        processed: "0",
        shipped: "0",
        delivered: "0",
        cancelled: "0",
        returned: "0"
      });
    }

    // Extract optional params with defaults
    const limit = getParam('limit', 25);
    const offset = getParam('offset', 0);
    const orderBy = getParam('order', 'DESC');
    const sort = getParam('sort', 'o.id');
    const search = getParam('search', '');
    const startDate = getParam('start_date', null);
    const endDate = getParam('end_date', null);
    const downloadInvoice = getParam('download_invoice', true);

    console.log('Parsed parameters:', {
      userId,
      limit,
      offset,
      orderBy,
      sort,
      search,
      startDate,
      endDate,
      downloadInvoice
    });

    // Parse active status from either array or comma-separated string
    let activeStatus = [];
    const rawActiveStatus = req.body.active_status || req.query.active_status;

    if (rawActiveStatus) {
      if (Array.isArray(rawActiveStatus)) {
        activeStatus = rawActiveStatus;
      } else if (typeof rawActiveStatus === 'string') {
        activeStatus = rawActiveStatus.split(',').map(status => status.trim());
      }
    }

    console.log('Active status:', activeStatus);

    // Get orders
    const result = await getOrders(
      userId,
      activeStatus,
      limit,
      offset,
      sort,
      orderBy,
      downloadInvoice,
      startDate,
      endDate,
      search
    );

    // Ensure the result has the expected structure even if something goes wrong
    const response = {
      error: result.error || false,
      message: result.message || "Orders retrieved successfully",
      total: result.total || "0",
      data: result.data || [], // Ensure this is always an array
      awaiting: result.awaiting || "0",
      received: result.received || "0",
      processed: result.processed || "0",
      shipped: result.shipped || "0",
      delivered: result.delivered || "0",
      cancelled: result.cancelled || "0",
      returned: result.returned || "0"
    };

    console.log('Sending orders response with total:', response.total);

    // Return the exact format to match PHP implementation
    return res.json(response);
  } catch (error) {
    console.error('Error in getOrdersController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || 'Failed to get orders',
      total: "0",
      data: [], // Always include empty array
      awaiting: "0",
      received: "0",
      processed: "0",
      shipped: "0",
      delivered: "0",
      cancelled: "0",
      returned: "0"
    });
  }
}

/**
 * Update order item status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function updateOrderItemStatusController(req, res) {
  try {
    console.log('Update order item status request received');
    console.log('Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw Body:', req.body);
    console.log('Files:', req.files);
    console.log('Params:', req.params);
    console.log('Query:', req.query);

    // Extract form data differently based on content type
    let formData = {};

    // Handle mulitpart/form-data
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      console.log('Processing multipart form data');

      // If using multer, req.body might be empty, but req.files should contain the files
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.fieldname === 'order_item_id' || file.fieldname === 'order_id') {
            formData[file.fieldname] = file.buffer.toString('utf8');
          } else if (file.fieldname === 'status') {
            formData.status = file.buffer.toString('utf8');
          }
        });
      }

      // Check if form fields came through in req.body
      if (Object.keys(req.body).length > 0) {
        formData = { ...formData, ...req.body };
      }
    } else {
      // For JSON or url-encoded content
      formData = req.body;
    }

    // Extract parameters from various sources 
    let orderItemId = formData.order_item_id || formData.order_id || req.params.order_item_id || req.query.order_item_id;
    let status = formData.status || req.params.status || req.query.status;

    // Handle possible different parameter naming
    if (!orderItemId && formData.orderItemId) orderItemId = formData.orderItemId;
    if (!orderItemId && formData.id) orderItemId = formData.id;

    // Convert any non-string values to strings
    if (orderItemId) orderItemId = String(orderItemId);
    if (status) status = String(status);

    console.log('Using orderItemId:', orderItemId);
    console.log('Using status:', status);

    // Validate token for secured endpoints
    const tokenValidation = await validateToken(req);
    if (!tokenValidation.valid) {
      return res.status(401).json({
        error: true,
        message: tokenValidation.message,
        data: []
      });
    }

    // Validate required parameters
    if (!orderItemId || !status) {
      return res.status(400).json({
        error: true,
        message: "Order item ID and status are required",
        data: []
      });
    }

    // Update order item status
    const result = await updateOrderItemStatus(orderItemId, status);
    console.log('Order item status update result:', result);

    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in updateOrderItemStatusController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || "Failed to update order item status",
      data: []
    });
  }
}

/**
 * Update order status
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function updateOrderStatusController(req, res) {
  try {
    console.log('Update order status request received');
    console.log('Headers:', req.headers);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw Body:', req.body);
    console.log('Files:', req.files);
    console.log('Params:', req.params);
    console.log('Query:', req.query);

    // Extract form data differently based on content type
    let formData = {};

    // Handle mulitpart/form-data
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      console.log('Processing multipart form data');

      // If using multer, req.body might be empty, but req.files should contain the files
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.fieldname === 'order_id') {
            formData.order_id = file.buffer.toString('utf8');
          } else if (file.fieldname === 'status') {
            formData.status = file.buffer.toString('utf8');
          }
        });
      }

      // Check if form fields came through in req.body
      if (Object.keys(req.body).length > 0) {
        formData = { ...formData, ...req.body };
      }
    } else {
      // For JSON or url-encoded content
      formData = req.body;
    }

    // Extract parameters from various sources
    let orderId = formData.order_id || req.params.order_id || req.query.order_id;
    let status = formData.status || req.params.status || req.query.status;

    // Handle possible different parameter naming
    if (!orderId && formData.orderId) orderId = formData.orderId;
    if (!orderId && formData.id) orderId = formData.id;

    // Convert any non-string values to strings
    if (orderId) orderId = String(orderId);
    if (status) status = String(status);

    console.log('Using orderId:', orderId);
    console.log('Using status:', status);

    // Validate required parameters
    if (!orderId || !status) {
      return res.status(400).json({
        error: true,
        message: "Order ID and status are required",
        data: []
      });
    }

    // Update order status
    const result = await updateOrderStatus(orderId, status);
    console.log('Order status update result:', result);

    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in updateOrderStatusController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || "Failed to update order status",
      data: []
    });
  }
}

/**
 * Add a transaction
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function addTransactionController(req, res) {
  try {
    // Validate required parameters
    const requiredParams = ['user_id', 'order_id', 'type', 'txn_id', 'amount', 'status'];
    for (const param of requiredParams) {
      if (!req.body[param]) {
        return res.status(400).json({
          error: true,
          message: `${param} is required`,
          data: []
        });
      }
    }

    // Add transaction
    const result = await addTransaction(req.body);

    return res.status(result.error ? 400 : 200).json(result);
  } catch (error) {
    console.error('Error in addTransactionController:', error);
    return res.status(500).json({
      error: true,
      message: error.message || "Failed to add transaction",
      data: []
    });
  }
}

/**
 * Generate and return order invoice HTML
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @returns {Promise<Object>} - Invoice HTML content
 */
async function invoiceController(req, res) {
  try {
    const orderId = req.params.order_id;

    if (!orderId) {
      return res.status(400).send('Order ID is required');
    }

    // Get order details
    const connection = await db.getConnection();

    try {
      // Get order data
      const [orderResult] = await connection.query(
        `SELECT o.*, u.username, u.email, u.mobile
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         WHERE o.id = ?`,
        [orderId]
      );

      if (orderResult.length === 0) {
        return res.status(404).send('Order not found');
      }

      const order = orderResult[0];

      // Get order items
      const [orderItems] = await connection.query(
        `SELECT oi.*, p.name as product_name, pv.price as main_price,
         p.type, p.is_prices_inclusive_tax, p.tax as tax_id, t.percentage as tax_percentage, t.title as tax_name
         FROM order_items oi
         LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
         LEFT JOIN products p ON pv.product_id = p.id
         LEFT JOIN taxes t ON p.tax = t.id
         WHERE oi.order_id = ?`,
        [orderId]
      );

      // Get address details if applicable
      let address = {};
      if (order.address_id) {
        const [addressResult] = await connection.query(
          `SELECT * FROM addresses WHERE id = ?`,
          [order.address_id]
        );

        if (addressResult.length > 0) {
          address = addressResult[0];
        }
      }

      // Get system settings
      const [settingsResult] = await connection.query(
        `SELECT value FROM settings WHERE variable = 'system_settings'`
      );

      const systemSettings = settingsResult.length > 0 ?
        JSON.parse(settingsResult[0].value) : {};

      // Generate invoice HTML
      const htmlContent = generateInvoiceHtml(order, orderItems, address, systemSettings);

      // Return HTML content
      res.setHeader('Content-Type', 'text/html');
      return res.send(htmlContent);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error generating invoice:', error);
    return res.status(500).send('Error generating invoice');
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
  // Format date
  const formattedDate = new Date(order.date_added).toISOString().slice(0, 10);

  // Calculate order amounts
  const taxAmount = items.reduce((sum, item) => sum + parseFloat(item.tax_amount || 0), 0);
  const subTotal = items.reduce((sum, item) => sum + parseFloat(item.sub_total || 0), 0);

  // Generate HTML
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Invoice #${order.id}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://uzvisimages.blr1.cdn.digitaloceanspaces.com/assets/admin_old/css/all.min.css">
  <link rel="stylesheet" href="https://uzvisimages.blr1.cdn.digitaloceanspaces.com/assets/admin_old/css/bootstrap.min.css">
  <style>
    body { font-family: Arial, sans-serif; }
    .invoice-title { margin-top: 20px; }
    .table-borderless td, .table-borderless th { border: 0; }
    .invoice-info { margin-bottom: 20px; }
    .invoice-col { margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container-fluid">
    <div class="row">
      <div class="col-md-12">
        <div class="card" id="section-to-print">
          <div class="row m-3">
            <div class="col-md-12 d-flex justify-content-between">
              <h2 class="text-left">
                <img src="${settings.logo || 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/uploads/media/2022/uzvis.png'}" class="d-block" style="max-width:250px;max-height:100px;">
              </h2>
              <h2 class="text-right">
                Mo. ${settings.support_number || '9120042009'}
              </h2>
            </div>
          </div>
          
          <div class="row m-3 d-flex justify-content-between">
            <div class="col-sm-4 invoice-col">From <address>
              <strong>${settings.app_name || 'Uzvis,Vijayawada-520010'}</strong><br>
              Email: ${settings.support_email || 'support@uzvis.com'}<br>
              Customer Care: ${settings.support_number || '9120042009'}<br>
              ${settings.tax_name ? `<b>${settings.tax_name}</b> : ${settings.tax_number}<br>` : ''}
            </address>
            </div>
            
            <div class="col-sm-4 invoice-col">To <address>
              <strong>${order.username || ''}</strong><br>
              ${order.address || ''}<br>
              <strong>${order.mobile || ''}</strong><br>
              <strong>${order.email || ''}</strong><br>
            </address>
            </div>
            
            <div class="col-sm-2 invoice-col">
              <br> <b>Retail Invoice</b>
              <br> <b>No : </b>#${order.id}
              <br> <b>Date: </b>${formattedDate}
              <br>
            </div>
          </div>
          
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
                <tbody>
                  ${items.map((item, index) => `
                    <tr>
                      <td>${index + 1}<br></td>
                      <td>${item.product_variant_id}<br></td>
                      <td class="w-25">${item.product_name}<br></td>
                      <td>₹ ${parseFloat(item.price).toLocaleString('en-IN')}<br></td>
                      <td>${item.tax_percentage}(${item.tax_percentage}%)<br></td>
                      <td>${item.quantity}<br></td>
                      <td class="d-none">₹ ${parseFloat(item.tax_amount).toLocaleString('en-IN')}<br></td>
                      <td>₹ ${parseFloat(item.sub_total).toLocaleString('en-IN')}<br></td>
                    </tr>
                  `).join('')}
                </tbody>
                <tbody>
                  <tr>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th>Total</th>
                    <th>${items.reduce((sum, item) => sum + parseInt(item.quantity), 0)}<br></th>
                    <th>₹ ${parseFloat(order.final_total).toLocaleString('en-IN')}<br></th>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="row m-2 text-right">
            <div class="col-md-9 offset-md-2">
              <div class="table-responsive">
                <table class="table table-borderless">
                  <tbody>
                    <tr><th></th></tr>
                    <tr>
                      <th>Total Order Price</th>
                      <td>+ ₹ ${parseFloat(order.total).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <th>Delivery Charge</th>
                      <td>+ ₹ ${parseFloat(order.delivery_charge).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr class="d-none">
                      <th>Tax - (${taxAmount > 0 ? items[0].tax_percentage : '0'}%)</th>
                      <td>+ ${taxAmount}</td>
                    </tr>
                    <tr>
                      <th>Wallet Used</th>
                      <td>- ₹ ${parseFloat(order.wallet_balance).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr class="d-none">
                      <th>Total Payable</th>
                      <td>₹ ${(parseFloat(order.total) + parseFloat(order.delivery_charge) + taxAmount).toLocaleString('en-IN')}</td>
                    </tr>
                    <tr>
                      <th>Final Total</th>
                      <td>₹ ${parseFloat(order.final_total).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Get all available time slots
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
async function getAllTimeSlotsController(req, res) {
  try {
    // Get active time slots only (status = 1) and sort by from_time ASC
    // This matches PHP's fetch_details('time_slots', ['status' => '1'], '*', '', '', 'from_time', 'ASC')
    const timeSlots = await getAllTimeSlots({ status: 1 });
    
    // Match PHP's response format
    return res.status(200).json({
      error: false,
      message: "Time slots retrieved successfully",
      data: timeSlots
    });
  } catch (error) {
    console.error('Error getting time slots:', error);
    return res.status(500).json(formatResponse(
      true,
      error.message || "Failed to get time slots",
      []
    ));
  }
}

module.exports = {
  placeOrderController,
  getOrdersController,
  updateOrderItemStatusController,
  updateOrderStatusController,
  addTransactionController,
  invoiceController,
  getAllTimeSlotsController
};