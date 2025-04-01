// Test script for image URL formatting functions
const { formatImageUrl, getImageUrl } = require('./helpers/functions');

// Test different image paths
const testPaths = [
  'media/2023/Banana_flower.png',
  'uploads/media/2023/Banana_flower.png',
  'https://dev.uzvi.in/uploads/media/2023/Banana_flower.png',
  'https://admin.uzvi.in/uploads/media/2023/Banana_flower.png',
  null,
  ''
];

console.log('TESTING IMAGE URL FUNCTIONS\n');

testPaths.forEach(path => {
  console.log(`Original path: "${path}"`);
  console.log(`getImageUrl: "${getImageUrl(path)}"`);
  console.log(`formatImageUrl: "${formatImageUrl(path)}"`);
  console.log('---');
});

// Test with different sizes
const imagePath = 'media/2023/Banana_flower.png';
console.log('\nTESTING SIZE PARAMETERS\n');

console.log(`Image path: "${imagePath}"`);
console.log(`getImageUrl (default): "${getImageUrl(imagePath)}"`);
console.log(`getImageUrl (thumb, sm): "${getImageUrl(imagePath, 'thumb', 'sm')}"`);
console.log(`getImageUrl (thumb, md): "${getImageUrl(imagePath, 'thumb', 'md')}"`);
console.log(`formatImageUrl (default): "${formatImageUrl(imagePath)}"`);
console.log(`formatImageUrl (sm): "${formatImageUrl(imagePath, 'sm')}"`);
console.log(`formatImageUrl (md): "${formatImageUrl(imagePath, 'md')}"`); 