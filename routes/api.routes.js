const express = require('express');
const router = express.Router();
const { getCategoriesController } = require('../controllers/category.controller');
const { getProducts } = require('../controllers/product.controller');
const { getSliderImagesController } = require('../controllers/slider.controller');
const { 
  addToFavoritesController, 
  removeFromFavoritesController, 
  getFavoritesController 
} = require('../controllers/favorite.controller');
const {
  placeOrderController,
  getOrdersController,
  updateOrderItemStatusController,
  updateOrderStatusController,
  invoiceController,
  getAllTimeSlotsController
} = require('../controllers/order.controller');
const { getSectionsController } = require('../controllers/section.controller');
const { 
  setProductRatingController, 
  deleteProductRatingController, 
  getProductRatingController,
  getProductReviewImagesController
} = require('../controllers/rating.controller');
const { getSettingsController } = require('../controllers/settings.controller');
const {
  manage_cart,
  remove_from_cart,
  get_user_cart
} = require('../controllers/cart.controller');
const {
  getTransactionsController,
  addTransactionController,
  editTransactionController
} = require('../controllers/transaction.controller');
const {
  getZipcodesController,
  isProductDeliverableController,
  check_cart_product_deliverable
} = require('../controllers/zipcode.controller');
const {
  getAddressController,
  addAddressController,
  updateAddressController,
  deleteAddressController
} = require('../controllers/address.controller');
const {
  getTicketTypesController,
  addTicketController,
  editTicketController,
  sendMessageController,
  getTicketsController,
  getMessagesController
} = require('../controllers/ticket.controller');
const {
  loginController,
  registerController
} = require('../controllers/auth.controller');
const {
  addProductFaqsController,
  getProductFaqsController
} = require('../controllers/product_faqs.controller');

// Import payment controller functions
const {
  initializePhonePePayment,
  checkPhonePePaymentStatus
} = require('../controllers/payment.controller');

// Auth routes
router.post('/login', loginController);
router.post('/register', registerController);

// Define routes
router.post('/get_categories', getCategoriesController);
router.post('/get_products', getProducts);
router.post('/get_sections', getSectionsController);
router.post('/get_slider_images', getSliderImagesController);
router.post('/get_settings', getSettingsController);

// Zipcode routes
router.post('/get_zipcodes', getZipcodesController);
router.post('/is_product_delivarable', isProductDeliverableController);
router.post('/check_cart_products_delivarable', check_cart_product_deliverable);

// Address routes
router.post('/get_address', getAddressController);
router.post('/add_address', addAddressController);
router.post('/update_address', updateAddressController);
router.post('/delete_address', deleteAddressController);

// Favorites routes
router.post('/add_to_favorites', addToFavoritesController);
router.post('/remove_from_favorites', removeFromFavoritesController);
router.post('/get_favorites', getFavoritesController);

// Cart management routes
router.post('/manage_cart', manage_cart);
router.post('/remove_from_cart', remove_from_cart);
router.post('/get_cart', get_user_cart);
router.post('/get_user_cart', get_user_cart);

// Order management routes
router.post('/place_order', placeOrderController);
router.post('/get_orders', getOrdersController);
router.post('/update_order_item_status', updateOrderItemStatusController);
router.post('/update_order_status', updateOrderStatusController);
router.get('/update_order_status/:order_id/:status', updateOrderStatusController);
router.get('/invoice/:order_id', invoiceController);
router.post('/get_time_slots', getAllTimeSlotsController);

// Transaction routes
router.post('/transactions', getTransactionsController);
router.post('/add_transaction', addTransactionController);
router.post('/edit_transaction', editTransactionController);

// Ratings routes
router.post('/set_product_rating', setProductRatingController);
router.post('/delete_product_rating', deleteProductRatingController);
router.post('/get_product_rating', getProductRatingController);
router.post('/get_product_review_images', getProductReviewImagesController);

// Product FAQs routes
router.post('/add_product_faqs', addProductFaqsController);
router.post('/get_product_faqs', getProductFaqsController);

// Ticket routes
router.post('/get_ticket_types', getTicketTypesController);
router.post('/add_ticket', addTicketController);
router.post('/edit_ticket', editTicketController);
router.post('/send_message', sendMessageController);
router.post('/get_tickets', getTicketsController);
router.post('/get_messages', getMessagesController);

// PhonePe payment routes
router.post('/phonepe/initiate', (req, res, next) => {
  console.log('[API] PhonePe payment initiation request:', {
    userId: req.body.user_id,
    orderId: req.body.order_id,
    amount: req.body.amount
  });
  next();
}, initializePhonePePayment);

router.post('/phonepe/status', (req, res, next) => {
  console.log('[API] PhonePe payment status check request:', {
    merchantOrderId: req.body.merchant_order_id
  });
  next();
}, checkPhonePePaymentStatus);

module.exports = router; 