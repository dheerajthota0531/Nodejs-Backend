const { getImageUrl, formatImageUrl } = require('./helpers/functions');
const config = require('./config/config');

// Test various image paths and how they're handled
console.log('=== Testing Image URL Generation ===');

// Test cases for getImageUrl
const imagePaths = [
  'media/2024/product.jpg',                           // Relative path without uploads/
  'uploads/media/2024/product.jpg',                   // Relative path with uploads/
  'http://example.com/image.jpg',                     // External URL
  'https://dev.uzvi.in/uploads/media/2024/image.jpg', // Old domain URL
  null,                                               // Null value
  ''                                                  // Empty string
];

console.log('\n=== getImageUrl tests ===');
imagePaths.forEach(path => {
  console.log(`\nInput: "${path}"`);
  try {
    const url = getImageUrl(path);
    console.log(`Output: "${url}"`);
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
});

// Test formatImageUrl with different sizes
console.log('\n=== formatImageUrl tests ===');
const testPath = 'media/2024/product.jpg';
const sizes = ['', 'thumb', 'sm', 'md'];

sizes.forEach(size => {
  console.log(`\nInput: "${testPath}", size: "${size}"`);
  try {
    const url = formatImageUrl(testPath, size);
    console.log(`Output: "${url}"`);
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
});

// Test configuration values
console.log('\n=== Configuration values ===');
console.log(`baseUrl: ${config.baseUrl}`);
console.log(`imageBaseUrl: ${config.imageBaseUrl}`);
console.log(`DEFAULT_IMAGE: ${config.DEFAULT_IMAGE}`);
console.log(`noImageUrl: ${config.noImageUrl}`);

console.log('\n=== Full Default Image URL ===');
console.log(`${config.imageBaseUrl}${config.DEFAULT_IMAGE}`);

console.log('\n=== Test Complete ==='); 