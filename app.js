const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const apiRoutes = require('./routes/api.routes');
const paymentRoutes = require('./routes/payment.routes');
const path = require('path');
const cartEnhancerMiddleware = require('./middleware/cart-enhancer');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const { getCacheStats, clearCache } = require('./middleware/cache');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Increase JSON size limit for large cart responses
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Create temporary directory if it doesn't exist
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Create ticket uploads directory if not exists
const ticketUploadsDir = path.join(__dirname, 'public/uploads/tickets');
if (!fs.existsSync(ticketUploadsDir)) {
  fs.mkdirSync(ticketUploadsDir, { recursive: true });
}

// Configure file uploads with error handling
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 8 * 1024 * 1024 // 8MB max file size
  },
  useTempFiles: true,
  tempFileDir: tmpDir,
  abortOnLimit: true,
  parseNested: true,
  safeFileNames: true,
  preserveExtension: true,
  debug: false
}));

// Debugging middleware to trace response format issues
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(obj) {
    // Only log for cart-related endpoints
    if (req.path.includes('cart')) {
      console.log(`DEBUG: Response for ${req.path} includes cart format:`, 
        obj && obj.cart ? `${obj.cart.length} items with product_variants: ${obj.cart.length > 0 ? !!obj.cart[0].product_variants : 'N/A'}` : 'No cart data');
    }
    return originalJson.call(this, obj);
  };
  next();
});

// Middleware for request logging
app.use((req, res, next) => {
  const { method, path, query, body } = req;
  console.log(`[${new Date().toISOString()}] ${method} ${path}`);
  
  // Log request body for debugging (except for file uploads which would be too verbose)
  if (body && Object.keys(body).length > 0 && req.headers['content-type'] !== 'multipart/form-data') {
    // Mask sensitive data
    const maskedBody = { ...body };
    if (maskedBody.password) maskedBody.password = '******';
    if (maskedBody.token) maskedBody.token = '******';
    if (maskedBody.clientSecret) maskedBody.clientSecret = '******';
    if (maskedBody.api_key) maskedBody.api_key = '******';
    
    console.log('Request Body:', JSON.stringify(maskedBody));
  }
  
  // Track API response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${method} ${path} - ${res.statusCode} (${duration}ms)`);
    
    // Log additional details for payment-related routes
    if (path.includes('/payment') || path.includes('/phonepe')) {
      console.log(`[PAYMENT] ${method} ${path} completed with status ${res.statusCode} in ${duration}ms`);
    }
  });
  
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/app/v1/api', cartEnhancerMiddleware, apiRoutes);
app.use('/api/payment', paymentRoutes);

// Cache statistics route (protected, admin only)
app.get('/admin/cache-stats', (req, res) => {
  res.json({
    stats: getCacheStats(),
    timestamp: new Date().toISOString()
  });
});

// Cache clear route (protected, admin only)
app.post('/admin/clear-cache', (req, res) => {
  const pattern = req.body.pattern || '';
  clearCache(pattern);
  res.json({
    message: `Cache cleared for pattern: "${pattern}" (empty pattern clears all)`,
    timestamp: new Date().toISOString()
  });
});

// Error handling for file upload errors
app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    console.error('File too large:', err);
    return res.status(413).json({
      error: true,
      message: 'File too large. Maximum size is 8MB.',
      data: []
    });
  }
  
  if (err && err.status === 400) {
    console.error('Bad request in file upload:', err);
    return res.status(400).json({
      error: true,
      message: 'Invalid file upload request',
      data: []
    });
  }
  
  if (err) {
    console.error('Error in file upload middleware:', err);
    return res.status(500).json({
      error: true,
      message: 'File upload failed',
      data: []
    });
  }
  
  next();
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the eShop API',
    version: '1.0.0',
    features: [
      'Response caching for better performance',
      'Cart management',
      'Order processing',
      'Payment integration',
      'User management'
    ]
  });
});

app.use(function(req, res, next) {
  if(req.path.match(/\/(cart|update_cart|delete_cart_item|get_cart|checkout|place_order|edit_order|upload_transaction)(\/.+)?$/g)) {
    debug = true;
  } else if (req.path.match(/\/(get_ticket_types|add_ticket|edit_ticket|send_message|get_tickets|get_messages)(\/.+)?$/g)) {
    debug = true;
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`=== E-COMMERCE API SERVER STARTED ===`);
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/app/v1/api`);
  console.log(`Caching enabled for key endpoints (get_settings, get_categories, get_products, get_sections)`);
  console.log(`Available cart endpoints:`);
  console.log(`- http://localhost:${PORT}/app/v1/api/get_user_cart (POST)`);
  console.log(`- http://localhost:${PORT}/app/v1/api/manage_cart (POST)`);
  console.log(`- http://localhost:${PORT}/app/v1/api/remove_from_cart (POST)`);
  console.log(`=== SERVER READY ===`);
});

module.exports = app; 