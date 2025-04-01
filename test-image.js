// Simple test for image URL generation
const path = require('path');
const config = require('./config/config');
const helpers = require('./helpers/functions');

console.log("=== Testing Image URL Generation ===");

// Test basic paths
const testImage = "media/2024/product.jpg";
console.log("Basic image path:", testImage);
console.log("With uploads prefix:", path.join('uploads', testImage));
console.log("Full URL:", config.imageBaseUrl + path.join('uploads', testImage));

// Test getImageUrl function
try {
  console.log("\nTesting getImageUrl function:");
  console.log("Result:", helpers.getImageUrl(testImage));
} catch (error) {
  console.error("Error in getImageUrl:", error.message);
}

// Test formatImageUrl function
try {
  console.log("\nTesting formatImageUrl function:");
  console.log("Result:", helpers.formatImageUrl(testImage));
} catch (error) {
  console.error("Error in formatImageUrl:", error.message);
}

// Test config values
console.log("\nConfig values:");
console.log("baseUrl:", config.baseUrl);
console.log("imageBaseUrl:", config.imageBaseUrl);
console.log("DEFAULT_IMAGE:", config.DEFAULT_IMAGE);
console.log("logoImage:", config.logoImage);
console.log("noImageUrl:", config.noImageUrl); 