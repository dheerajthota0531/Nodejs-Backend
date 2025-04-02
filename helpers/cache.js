/**
 * API Caching Module
 * Provides caching functionality for API endpoints to improve performance
 */
const NodeCache = require('node-cache');

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone objects when getting/setting (for better performance)
});

/**
 * Generate a cache key based on endpoint and request body
 * This handles different parameter combinations correctly
 * 
 * @param {string} endpoint - API endpoint name (e.g. 'get_settings', 'get_categories')
 * @param {Object} params - Request parameters
 * @returns {string} - Unique cache key
 */
function generateCacheKey(endpoint, params = {}) {
  // Create a copy of params to avoid modifying the original
  const normalizedParams = { ...params };
  
  // Special handling for specific endpoints
  if (endpoint === 'get_settings') {
    // get_settings has 3 key variations:
    // 1. get_settings with no parameters
    // 2. get_settings with type parameter
    // 3. get_settings with type and user_id parameters
    
    // Extract only relevant params for get_settings
    const type = normalizedParams.type || 'all';
    const user_id = normalizedParams.user_id || '';
    
    // Form key with only the relevant parameters
    return `${endpoint}|type:${type}|user_id:${user_id}`;
  }
  
  if (endpoint === 'get_categories') {
    // Extract only relevant params for categories
    const keyParams = {};
    
    // Include only parameters that affect the results
    const relevantParams = [
      'id', 'slug', 'limit', 'offset', 'sort', 'order', 
      'has_child_or_item', 'ignore_status', 'city'
    ];
    
    relevantParams.forEach(param => {
      if (normalizedParams[param] !== undefined && 
          normalizedParams[param] !== null && 
          normalizedParams[param] !== '') {
        keyParams[param] = normalizedParams[param];
      }
    });
    
    // Sort keys and create a key string
    return endpoint + '|' + Object.keys(keyParams)
      .sort()
      .map(key => `${key}:${keyParams[key]}`)
      .join('|');
  }
  
  if (endpoint === 'get_products') {
    // Extract only relevant params for products
    const keyParams = {};
    
    // Include only parameters that affect the results
    const relevantParams = [
      'id', 'product_ids', 'category_id', 'user_id', 'search', 
      'tags', 'attribute_value_ids', 'sort', 'limit', 'offset', 
      'order', 'top_rated_product', 'min_price', 'max_price', 
      'discount', 'product_type', 'city', 'zipcode_id'
    ];
    
    relevantParams.forEach(param => {
      if (normalizedParams[param] !== undefined && 
          normalizedParams[param] !== null && 
          normalizedParams[param] !== '') {
        keyParams[param] = normalizedParams[param];
      }
    });
    
    // Sort keys and create a key string
    return endpoint + '|' + Object.keys(keyParams)
      .sort()
      .map(key => `${key}:${keyParams[key]}`)
      .join('|');
  }
  
  if (endpoint === 'get_sections') {
    // Extract only relevant params for sections
    const keyParams = {};
    
    // Include only parameters that affect the results
    const relevantParams = [
      'section_id', 'user_id', 'limit', 'offset', 'p_limit', 
      'p_offset', 'p_sort', 'p_order', 'top_rated_product', 
      'city', 'zipcode'
    ];
    
    relevantParams.forEach(param => {
      if (normalizedParams[param] !== undefined && 
          normalizedParams[param] !== null && 
          normalizedParams[param] !== '') {
        keyParams[param] = normalizedParams[param];
      }
    });
    
    // Sort keys and create a key string
    return endpoint + '|' + Object.keys(keyParams)
      .sort()
      .map(key => `${key}:${keyParams[key]}`)
      .join('|');
  }
  
  // Default behavior for other endpoints
  const sortedKeys = Object.keys(normalizedParams).sort();
  
  // Build a key string with endpoint and sorted parameters
  let keyParts = [endpoint];
  
  sortedKeys.forEach(key => {
    // Only include non-empty parameters
    if (normalizedParams[key] !== undefined && 
        normalizedParams[key] !== null && 
        normalizedParams[key] !== '') {
      keyParts.push(`${key}:${normalizedParams[key]}`);
    }
  });
  
  return keyParts.join('|');
}

/**
 * Cache middleware for Express routes
 * 
 * @param {string} endpoint - API endpoint name
 * @param {number} duration - Cache TTL in seconds (default: 300 seconds/5 minutes)
 * @returns {function} - Express middleware
 */
function cacheMiddleware(endpoint, duration = 300) {
  return (req, res, next) => {
    // Skip caching for requests with no-cache header
    if (req.headers['cache-control'] === 'no-cache') {
      return next();
    }
    
    // Generate cache key from endpoint and request body
    const cacheKey = generateCacheKey(endpoint, req.body);
    
    // Try to get response from cache
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`Cache HIT for ${endpoint}`);
      return res.json(cachedResponse);
    }
    
    console.log(`Cache MISS for ${endpoint}`);
    
    // Store original json method
    const originalJson = res.json;
    
    // Override json method to cache the response before sending
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(cacheKey, data, duration);
        console.log(`Cached ${endpoint} for ${duration}s with key: ${cacheKey}`);
      }
      
      // Call the original method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Manually cache a value
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {boolean} - Success status
 */
function setValue(key, value, ttl = 300) {
  return cache.set(key, value, ttl);
}

/**
 * Get a value from cache
 * 
 * @param {string} key - Cache key
 * @returns {any} - Cached value or undefined if not found
 */
function getValue(key) {
  return cache.get(key);
}

/**
 * Delete a value from cache
 * 
 * @param {string} key - Cache key
 * @returns {number} - Number of deleted entries
 */
function deleteValue(key) {
  return cache.del(key);
}

/**
 * Clear all cache
 * 
 * @returns {void}
 */
function clearCache() {
  return cache.flushAll();
}

/**
 * Get cache statistics
 * 
 * @returns {Object} - Cache statistics
 */
function getStats() {
  return cache.getStats();
}

/**
 * Clear cache for a specific endpoint
 * 
 * @param {string} endpoint - Endpoint name
 * @returns {number} - Number of deleted keys
 */
function clearEndpointCache(endpoint) {
  const keys = cache.keys();
  let deletedCount = 0;
  
  keys.forEach(key => {
    if (key.startsWith(endpoint + '|')) {
      cache.del(key);
      deletedCount++;
    }
  });
  
  return deletedCount;
}

module.exports = {
  cache,
  cacheMiddleware,
  setValue,
  getValue,
  deleteValue,
  clearCache,
  getStats,
  clearEndpointCache,
  generateCacheKey
}; 