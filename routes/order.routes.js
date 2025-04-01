const { getOrdersController, getOrderController, placeOrderController, 
  updateOrderItemStatusController, updateOrderStatusController, 
  addTransactionController, invoiceController } = require('../controllers/order.controller');

router.post('/add_transaction', authenticated, addTransactionController);
router.get('/invoice/:order_id', invoiceController); 