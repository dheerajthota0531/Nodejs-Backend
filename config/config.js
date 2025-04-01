/**
 * Global configuration settings
 */
const config = {
  // Base URL for the application
  baseUrl: 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/',
  
  // CDN URL for images - ensure this is used throughout the application
  imageBaseUrl: 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/',
  
  // Media paths
  mediaPath: 'uploads/media/2024/',
  userPath: 'uploads/user/',
  
  // Default images
  DEFAULT_IMAGE: 'uploads/media/2022/default_image.png',
  defaultCategoryImage: 'uploads/media/2024/vegetables.png',
  defaultProductImage: 'uploads/media/2024/default_product.png',
  noImageUrl: 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/uploads/media/2022/uzvis.png',
  logoImage: 'uploads/media/2022/uzvis.png',
  
  // Image sizes
  imageSizes: {
    sm: 'thumb-sm',
    md: 'thumb-md',
    lg: 'thumb',
  },
  
  // File size limits
  maxImageSize: 2 * 1024 * 1024,  // 2MB
  
  // Other constants
  defaultLimit: 25,
  defaultOffset: 0
};

module.exports = config; 