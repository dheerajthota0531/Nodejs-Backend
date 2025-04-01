const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// Get products route
router.post('/get_products', productController.getProducts);

module.exports = router; 