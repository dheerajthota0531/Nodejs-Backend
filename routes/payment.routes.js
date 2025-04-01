/**
 * Payment Routes
 * Handles all payment-related routes including PhonePe integration
 */
const express = require('express');
const router = express.Router();
const {
  initializePhonePePayment,
  checkPhonePePaymentStatus,
  handlePhonePeCallback,
  handlePaymentResponse
} = require('../controllers/payment.controller');

// Transaction middleware to log payment requests
const paymentLogger = (req, res, next) => {
  const startTime = Date.now();
  
  console.log(`[PAYMENT] ${req.method} ${req.path} - Request received`, {
    body: req.body,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  });
  
  // Capture response data
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    console.log(`[PAYMENT] ${req.method} ${req.path} - Response sent (${responseTime}ms)`, {
      status: res.statusCode,
      error: data.error,
      message: data.message
    });
    
    return originalJson.call(this, data);
  };
  
  next();
};

// PhonePe payment routes with logging middleware
router.post('/phonepe/initiate', paymentLogger, initializePhonePePayment);
router.post('/phonepe/status', paymentLogger, checkPhonePePaymentStatus);
router.post('/phonepe-callback', paymentLogger, handlePhonePeCallback);
router.get('/response', paymentLogger, handlePaymentResponse);

module.exports = router; 