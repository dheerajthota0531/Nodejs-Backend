/**
 * Middleware to enhance cart responses with product_variants and product_details.
 * This ensures that frontend components have access to these fields.
 */
const cartEnhancerMiddleware = (req, res, next) => {
  // Store the original response json method
  const originalJson = res.json;
  
  // Override the json method
  res.json = function(obj) {
    // Only process for cart-related endpoints
    if (
      (req.path.includes('cart') || req.path.includes('get_user_cart')) && 
      obj && 
      typeof obj === 'object'
    ) {
      try {
        // Check if we have cart data to enhance
        if (obj.cart && Array.isArray(obj.cart) && obj.cart.length > 0) {
          // Log original structure
          console.log(`DEBUG: Enhancing cart response for ${req.path}`);
          console.log(`DEBUG: Original cart item has product_variants: ${obj.cart[0] && obj.cart[0].product_variants ? 'Yes' : 'No'}`);
          
          // Add product_variants and product_details to each cart item if missing
          obj.cart = obj.cart.map(item => {
            if (!item) return item; // Skip null or undefined items
            
            if (!item.product_variants) {
              item.product_variants = [{
                id: item.product_variant_id || '0',
                product_id: item.product_id || '0',
                price: item.price || '0',
                special_price: item.special_price || item.price || '0',
                stock: item.stock || '1000',
                availability: item.availability || '1',
                status: '1'
              }];
            }
            
            if (!item.product_details) {
              item.product_details = [{
                id: item.product_id || '0',
                name: item.name || '',
                image: item.image || '',
                short_description: item.short_description || '',
                minimum_order_quantity: item.minimum_order_quantity || '1',
                quantity_step_size: item.quantity_step_size || '1',
                total_allowed_quantity: item.total_allowed_quantity || '',
                variants: item.product_variants || []
              }];
            }
            
            return item;
          });
          
          // If data array is separate from cart array, enhance it too
          if (obj.data && Array.isArray(obj.data) && obj.data.length > 0) {
            obj.data = obj.data.map(item => {
              if (!item) return item; // Skip null or undefined items
              
              if (!item.product_variants) {
                item.product_variants = [{
                  id: item.product_variant_id || '0',
                  product_id: item.product_id || '0',
                  price: item.price || '0',
                  special_price: item.special_price || item.price || '0',
                  stock: item.stock || '1000',
                  availability: item.availability || '1',
                  status: '1'
                }];
              }
              
              if (!item.product_details) {
                item.product_details = [{
                  id: item.product_id || '0',
                  name: item.name || '',
                  image: item.image || '',
                  short_description: item.short_description || '',
                  minimum_order_quantity: item.minimum_order_quantity || '1',
                  quantity_step_size: item.quantity_step_size || '1',
                  total_allowed_quantity: item.total_allowed_quantity || '',
                  variants: item.product_variants || []
                }];
              }
              
              return item;
            });
          }
          
          // Log enhanced structure
          console.log(`DEBUG: Enhanced cart item has product_variants: ${obj.cart[0] && obj.cart[0].product_variants ? 'Yes' : 'No'}`);
        }
      } catch (error) {
        console.error("Error enhancing cart response:", error);
        // Don't fail if enhancement fails, just continue with original response
      }
    }
    
    // Call the original json method with our enhanced object
    return originalJson.call(this, obj);
  };
  
  // Continue to the next middleware
  next();
};

module.exports = cartEnhancerMiddleware; 