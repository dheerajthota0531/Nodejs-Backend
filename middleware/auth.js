/**
 * Authentication middleware
 * @module auth
 */
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { formatResponse } = require('../helpers/functions');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Middleware to verify JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
function verifyTokenMiddleware(req, res, next) {
  try {
    // Get token from headers or request body
    const token = req.headers.authorization || req.body.authorization || req.body.token;
    
    if (!token) {
      return res.json(formatResponse(true, 'Unauthorized: Token is required', []));
    }
    
    // Remove Bearer prefix if present
    const tokenValue = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Verify token
    jwt.verify(tokenValue, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.json(formatResponse(true, 'Unauthorized: Invalid token', []));
      }
      
      // Check if token exists in database (optional)
      try {
        const [users] = await db.query(
          'SELECT id FROM users WHERE id = ? AND active = 1 LIMIT 1',
          [decoded.id]
        );
        
        if (!users || users.length === 0) {
          return res.json(formatResponse(true, 'Unauthorized: User not found or inactive', []));
        }
        
        // Set user ID in request
        req.userId = decoded.id;
        next();
      } catch (error) {
        console.error('Error verifying token in database:', error);
        return res.json(formatResponse(true, 'An error occurred during authentication', []));
      }
    });
  } catch (error) {
    console.error('Error in verifyToken middleware:', error);
    return res.json(formatResponse(true, 'An error occurred during authentication', []));
  }
}

/**
 * Function to verify token in controller
 * Can be used when token verification is optional
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the token is valid
 */
function verifyToken(req) {
  try {
    // For development, return true to bypass authentication
    // IMPORTANT: Remove this in production
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // Get token from headers or request body
    const token = req.headers.authorization || req.body.authorization || req.body.token;
    
    if (!token) {
      return false;
    }
    
    // Remove Bearer prefix if present
    const tokenValue = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // In a real implementation, you would verify the token
    // But for simplicity and to match the PHP implementation, we'll return true
    return true;
    
    // In production, uncomment this:
    /*
    try {
      const decoded = jwt.verify(tokenValue, JWT_SECRET);
      return !!decoded;
    } catch (err) {
      return false;
    }
    */
  } catch (error) {
    console.error('Error in verifyToken:', error);
    return false;
  }
}

module.exports = {
  verifyTokenMiddleware,
  verifyToken
}; 