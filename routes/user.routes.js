const cartController = require('../controllers/cart.controller');

// Cart Routes
router.post('/manage_cart', cartController.manageCartController);
router.post('/remove_from_cart', cartController.removeFromCartController);
router.post('/get_user_cart', cartController.getUserCartController); 