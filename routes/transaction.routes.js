const express = require('express');
const router = express.Router();
const { 
  getTransactionsController,
  addTransactionController,
  editTransactionController
} = require('../controllers/transaction.controller');

// Transaction routes
router.post('/transactions', getTransactionsController);
router.post('/add_transaction', addTransactionController);
router.post('/edit_transaction', editTransactionController);

module.exports = router; 