const jwt = require('jsonwebtoken');
const db = require('../config/database');

// JWT leeway in seconds (same as PHP)
const JWT_LEEWAY = 60;

/**
 * Get bearer token from request
 * @param {Object} req - Express request object
 * @returns {string|null} - Bearer token or null
 */
function getBearerToken(req) {
  // Get Authorization header
  const authHeader = req.headers.authorization;
  
  // Check if Authorization header exists and has Bearer format
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }
  
  return null;
}

/**
 * Validate JWT token from request headers
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Validation result
 */
async function validateToken(req) {
  try {
    // Get token from Authorization header
    const token = getBearerToken(req);
    
    // If no token is found, return invalid result
    if (!token) {
      return {
        valid: false,
        message: 'Unauthorized access not allowed'
      };
    }
    
    // Get active API keys from database
    const [apiKeys] = await db.query('SELECT * FROM client_api_keys WHERE status = 1');
    
    if (!apiKeys || apiKeys.length === 0) {
      return {
        valid: false,
        message: 'No Client(s) Data Found!'
      };
    }
    
    // Set leeway for token expiration
    jwt.verify.leeway = JWT_LEEWAY;
    
    let error = true;
    let message = '';
    
    // Try each API key until one works
    for (const row of apiKeys) {
      try {
        const payload = jwt.verify(token, row.secret, { algorithms: ['HS256'] });
        
        // Check if issued by the right issuer
        if (payload.iss && payload.iss === 'eshop') {
          error = false;
          break;
        } else {
          error = true;
          message = 'Invalid Hash';
          break;
        }
      } catch (e) {
        message = e.message;
      }
    }
    
    if (error) {
      return {
        valid: false,
        message: message || 'Invalid token'
      };
    }
    
    return {
      valid: true,
      message: 'Token is valid'
    };
  } catch (error) {
    console.error('Error validating token:', error);
    return {
      valid: false,
      message: error.message || 'Invalid token'
    };
  }
}

/**
 * Generate JWT token
 * @param {Object} payload - Payload to encode in token
 * @param {string} secret - Secret key
 * @param {string} expiresIn - Token expiration time
 * @returns {string} - JWT token
 */
function generateToken(payload, secret, expiresIn = '24h') {
  // Set issuer to match PHP's implementation
  payload.iss = 'eshop';
  
  return jwt.sign(payload, secret, { expiresIn });
}

module.exports = {
  validateToken,
  generateToken,
  getBearerToken
}; 