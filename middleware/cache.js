const NodeCache = require('node-cache');

// Create a new cache instance with default TTL of 5 minutes and check period of 10 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Middleware to cache API responses
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} - Express middleware function
 */
function cacheMiddleware(ttl = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'POST') {
      return next();
    }

    // Generate a cache key based on the endpoint and request body
    const key = `${req.originalUrl}:${JSON.stringify(req.body)}`;

    // Check if response exists in cache
    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      console.log(`Cache hit for ${req.originalUrl}`);
      return res.json(cachedResponse);
    }

    // If not in cache, intercept the response
    const originalJson = res.json;
    res.json = function(body) {
      // Save the response to cache
      cache.set(key, body, ttl);
      console.log(`Cached response for ${req.originalUrl} (TTL: ${ttl}s)`);
      originalJson.call(this, body);
    };

    next();
  };
}

/**
 * Clear a specific cache key or pattern
 * @param {string} pattern - Pattern to match cache keys
 */
function clearCache(pattern) {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  
  if (matchingKeys.length > 0) {
    matchingKeys.forEach(key => cache.del(key));
    console.log(`Cleared ${matchingKeys.length} cache entries matching "${pattern}"`);
  }
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
function getCacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize
  };
}

module.exports = {
  cacheMiddleware,
  clearCache,
  getCacheStats
}; 