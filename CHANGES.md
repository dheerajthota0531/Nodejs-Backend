# Change Log

## 2024-04-02: API Performance Optimization

- Added API response caching for frequently accessed endpoints
  - Implemented caching for get_settings, get_categories, get_products, get_sections
  - Created cache management endpoints for monitoring and administration
  - Added cache documentation in CACHING.md
- Fixed image URL handling for CDN
  - Updated formatImageUrl and getImageUrl functions to consistently use CDN URL
  - Improved CDN URL handling for absolute and relative image paths
  - Modified cart handler to use consistent image URL formatting

## 2024-04-01: PhonePe Integration

- Added PhonePe payment gateway integration
- Implemented payment initiation, status check, and callback handling
- Added UAT testing support and documentation

# CDN Image URL Changes

## Overview

This document summarizes the changes made to ensure consistent use of the CDN URL (`https://uzvisimages.blr1.cdn.digitaloceanspaces.com/`) for all images, particularly in the cart management functionality.

## Changes Made

### 1. Updated `getImageUrl` Function in `helpers/functions.js`

- Simplified and removed console logs for better performance
- Ensured consistent use of CDN URL for all images
- Enhanced handling of existing URLs from different domains

### 2. Updated `formatImageUrl` Function in `helpers/functions.js`

- Ensured it uses the same CDN URL consistently
- Added proper handling for thumbnails and different image sizes

### 3. Cart-specific Changes in `models/cart.model.js`

- Added the import for `getImageUrl` from `helpers/functions.js`
- Updated the `get_user_cart` function to apply `getImageUrl` to product images
- Added image_sm and image_md variants to match PHP behavior
- Updated cart processing to ensure all images use the CDN URL

### 4. Helper Function Changes

- Updated `getCartTotal` in `helpers/functions.js` to process product images
- Ensured consistent URL format for all image sizes

## Testing

- Created a dedicated test script (`cart-image-test.js`) to verify image URLs
- Confirmed that all image URLs in cart items correctly use the CDN base URL
- Verified both main images and thumbnails are properly formatted

## Result

The application now consistently uses `https://uzvisimages.blr1.cdn.digitaloceanspaces.com/` as the base URL for all images, ensuring proper display of product images in the cart and throughout the application.

## Additional Notes

- Make sure the CDN URL is accessible and contains all required images
- For local development without CDN access, consider adding a fallback mechanism

# Cart Deliverability API Implementation

## Overview

Implemented the `check_cart_products_delivarable` API endpoint to match the PHP implementation exactly, ensuring consistent behavior between the PHP and Node.js versions.

## Changes Made

### 1. Implemented Controller Function in `zipcode.controller.js`

- Created `check_cart_product_deliverable` function that replicates the PHP logic
- Implemented proper validation for required parameters (`address_id` and `user_id`)
- Maintained identical response structure and error handling

### 2. Enhanced Helper Function in `helpers/zipcode.js`

- Updated `check_cart_products_deliverable` function to match PHP behavior exactly
- Added proper checking for delivery by local shipping and standard shipping
- Implemented shiprocket integration for checking delivery availability
- Maintained the same response structure as PHP

### 3. Added Route in `api.routes.js`

- Added the route for the new endpoint `/check_cart_products_delivarable`
- Replaced the existing dummy implementation with the new controller function

## Testing

- Created a test script (`test-cart-deliverable.js`) to verify the endpoint behavior
- Tested with real user data to confirm correct processing
- Verified that the response structure matches PHP exactly

## Implementation Details

- The API checks if cart products are deliverable to a specific address
- It first tries local delivery based on area ID
- Then it checks standard shipping using pickup locations and shiprocket
- Returns detailed deliverability status for each product in the cart
- Follows PHP naming conventions and data structure exactly

# Cart Response Structure Fixes

## Overview

Fixed the manage_cart API response structure to match PHP's format exactly, fixing discrepancies between Node.js and PHP implementations.

## Changes Made

### 1. Updated Response Structure in `cart.controller.js`

- Modified the `manage_cart` function to format the response to match PHP's structure exactly
- Changed `data` from an empty array to an object with cart totals, matching PHP format
- Ensured all cart item properties are included in the response as in PHP

### 2. Fixed Calculation Logic in `cart.model.js`

- Updated `get_cart_total` to properly calculate cart totals matching PHP's behavior
- Fixed handling of inclusive vs. exclusive tax calculation
- Corrected the data types of numeric values (strings vs. numbers)
- Made `total_arr` a number value while keeping other totals as strings to match PHP

### 3. Ensure Proper Data Types

- Made sure all numeric values return as strings (except total_arr) to match PHP
- Fixed format of monetary values with 2 decimal places
- Proper handling of data structures for nested objects and arrays

## Testing

- Created `test-manage-cart.js` script to verify the correct structure and data types
- Tested with parameters: user_id:196, product_variant_id:579, qty:1
- Verified match with PHP response structure

## Result

The manage_cart API now returns a response that exactly matches the PHP implementation's structure and data types, ensuring seamless compatibility for client applications during migration.

# Transaction API Response Structure Changes

- Fixed mismatches between PHP and Node.js response formats
- Updated `order_id` and `order_item_id` to be `null` instead of "0"
- Added `transaction_type` field to each transaction
- Added `is_refund` field to match PHP format
- Removed `balance` field from individual transactions
- Capitalized the first letter in "Transactions Retrieved Successfully" message

# Settings API Data Types Fixes

- Fixed `time_slot_config` to match PHP structure
  - Removed `starting_date` field that was not present in PHP response
  - Ensured all values are strings to match PHP behavior
  - Fixed structure to be a direct object (not in an array) when `type=payment_method` parameter is used
  - Maintained array format for default `type=all` parameter
- Fixed `is_cod_allowed` to be returned as string "1" instead of numeric 1
- Updated `shipping_method` to be returned as an array
- Fixed `getUserData` function to handle database schema differences
- Added proper error handling for missing tables

# Popup Offer Data Structure Fixes

## Overview

Fixed the `popup_offer` data structure in the settings API response to match PHP's format exactly.

## Changes Made

- Added missing fields that were present in PHP but missing in Node.js:

  - `is_active` - Whether the popup offer is currently active
  - `show_multiple_time` - Whether to show the popup multiple times
  - `data` - Category or product data associated with the offer

- Fixed data types to match PHP's response format:

  - Ensured all numeric values are returned as strings
  - Formatted date in the PHP format: "YYYY-MM-DD HH:MM:SS"

- Implemented proper data retrieval:

  - Added logic to retrieve related category or product data based on `type` and `type_id`
  - Built the complete `data` array structure matching PHP's implementation

- Improved error handling for missing tables or data

## Testing

The implementation now properly matches PHP's response structure, ensuring consistent behavior between the PHP and Node.js versions of the API.

# Product FAQs API Implementation

## Overview

Implemented the Product FAQs APIs following the PHP behavior exactly, including proper data type handling for compatibility.

## Changes Made

### 1. Created New Model Files

- Created `product_faqs.model.js` with `add_product_faqs` and `get_product_faqs` functions
- Ensured proper database queries matching the PHP implementation
- Implemented data type handling to match PHP's output format

### 2. Added Controller Functions

- Created `product_faqs.controller.js` with controller functions for the two APIs
- Implemented proper input validation matching PHP behavior
- Handled edge cases and error conditions consistently with PHP

### 3. Added API Routes

- Added routes for `/add_product_faqs` and `/get_product_faqs` in `api.routes.js`
- Connected the routes to the appropriate controller functions

### 4. Data Type Handling

- Ensured all numeric values are returned as strings in the API response
- Formatted dates in YYYY-MM-DD HH:MM:SS format to match PHP
- Validated inputs to handle both string and numeric product/user IDs

## Testing

- Created comprehensive test scripts to verify functionality:
  - `product-faqs-test.js` - Tests adding a new FAQ
  - `product-faqs-answer-test.js` - Tests answering FAQs and retrieving them
  - `product-faqs-integration-test.js` - Integration test of the complete workflow

## Implementation Details

- The `get_product_faqs` function only returns FAQs that have answers, matching PHP behavior
- Numeric fields (id, product_id, user_id, votes) are converted to strings to match PHP response format
- Input validation handles both string and numeric inputs for compatibility
- Added proper error handling and informative error messages

## Additional Notes

- When creating a new FAQ, the answer field is initially empty
- FAQs only appear in the `get_product_faqs` API results after an answer has been added
- The controller properly handles various input formats for compatibility with existing clients
