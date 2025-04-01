/**
 * Authentication Controller
 * @module auth.controller
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { formatResponse } = require('../helpers/functions');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Controller to handle user login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - Response object with user data and token
 */
async function loginController(req, res) {
  try {
    console.log('Login request received');
    console.log('Request body:', req.body);
    
    // Validate required fields
    if (!req.body.mobile || !req.body.password) {
      return res.json(formatResponse(true, 'Mobile and password are required', []));
    }
    
    const mobile = req.body.mobile;
    const password = req.body.password;
    const fcmId = req.body.fcm_id || '';
    
    let connection;
    try {
      connection = await db.getConnection();
      
      // Check if user exists - match the exact query from PHP
      const [users] = await connection.query(
        'SELECT *, mobile, email, id, password, active, created_on as last_login FROM users WHERE mobile = ? ORDER BY id DESC LIMIT 1',
        [mobile]
      );
      
      console.log('User query result:', users);
      
      if (!users || users.length === 0) {
        return res.json(formatResponse(true, 'User does not exist!', []));
      }
      
      const user = users[0];
      
      // Verify password with bcrypt
      let passwordValid = false;
      
      // Check if the password is a bcrypt hash (starts with $2y$ or $2a$)
      if (user.password.startsWith('$2y$') || user.password.startsWith('$2a$')) {
        // PHP bcrypt hashes start with $2y$, Node.js uses $2a$
        // Replace $2y$ with $2a$ for compatibility with bcrypt in Node.js
        const fixedHash = user.password.replace(/^\$2y\$/, '$2a$');
        
        try {
          passwordValid = await bcrypt.compare(password, fixedHash);
        } catch (error) {
          console.error('Error comparing passwords:', error);
          passwordValid = false;
        }
      } else {
        // Fallback to direct comparison for non-hashed passwords
        passwordValid = (password === user.password);
      }
      
      if (!passwordValid) {
        return res.json(formatResponse(true, 'Invalid login credentials', []));
      }
      
      // Check if user is active
      if (user.active !== 1 && user.active !== '1') {
        return res.json(formatResponse(true, 'Account is inactive. Please contact administrator.', []));
      }
      
      // Update FCM ID if provided
      if (fcmId) {
        await connection.query(
          'UPDATE users SET fcm_id = ? WHERE id = ?',
          [fcmId, user.id]
        );
      }
      
      // Update last login time with current UNIX timestamp
      const currentTimestamp = Math.floor(Date.now() / 1000);
      await connection.query(
        'UPDATE users SET last_login = ? WHERE id = ?',
        [currentTimestamp, user.id]
      );
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, mobile: user.mobile },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Format response data to match PHP output format
      const userData = {
        id: String(user.id),
        username: String(user.username || ''),
        email: String(user.email || ''),
        mobile: String(user.mobile || ''),
        balance: String(user.balance || '0'),
        active: String(user.active || '0'),
        created_on: String(user.created_on || ''),
        last_login: String(currentTimestamp),
        fcm_id: String(fcmId || user.fcm_id || ''),
        country_code: String(user.country_code || '91'),
        token: token
      };
      
      return res.json(formatResponse(false, 'Login successful', [userData]));
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error) {
    console.error('Error in loginController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

/**
 * Controller to handle registration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - Response object indicating success/failure
 */
async function registerController(req, res) {
  try {
    // Validate required fields
    const requiredFields = ['name', 'email', 'mobile', 'password'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!req.body[field]) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      return res.json(formatResponse(true, `${missingFields.join(', ')} are required`, []));
    }
    
    const name = req.body.name;
    const email = req.body.email;
    const mobile = req.body.mobile;
    const password = req.body.password;
    const countryCode = req.body.country_code || '91';
    const fcmId = req.body.fcm_id || '';
    const dob = req.body.dob || '';
    const city = req.body.city || '';
    const area = req.body.area || '';
    const street = req.body.street || '';
    const pincode = req.body.pincode || '';
    const friendsCode = req.body.friends_code || '';
    const latitude = req.body.latitude || '';
    const longitude = req.body.longitude || '';
    
    let connection;
    try {
      connection = await db.getConnection();
      
      // Check if user already exists with the given email
      const [emailUsers] = await connection.query(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      
      if (emailUsers && emailUsers.length > 0) {
        return res.json(formatResponse(true, 'The email is already registered. Please login', []));
      }
      
      // Check if user already exists with the given mobile
      const [mobileUsers] = await connection.query(
        'SELECT id FROM users WHERE mobile = ?',
        [mobile]
      );
      
      if (mobileUsers && mobileUsers.length > 0) {
        return res.json(formatResponse(true, 'The mobile number is already registered. Please login', []));
      }
      
      // Generate hashed password using bcrypt to match PHP's format
      const saltRounds = 10;
      // PHP uses $2y$ prefix, but Node.js uses $2a$
      // The hash will automatically be compatible
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Generate referral code
      const referralCode = generateReferralCode(name);
      
      // Prepare user data
      const userData = {
        username: name,
        email: email,
        mobile: mobile,
        password: hashedPassword,
        country_code: countryCode,
        fcm_id: fcmId,
        dob: dob,
        city: city,
        area: area,
        street: street,
        pincode: pincode,
        referral_code: referralCode,
        friends_code: friendsCode,
        latitude: latitude,
        longitude: longitude,
        active: 1,
        created_on: Math.floor(Date.now() / 1000) // Unix timestamp like PHP
      };
      
      // Insert user into database
      const [result] = await connection.query(
        'INSERT INTO users SET ?',
        [userData]
      );
      
      if (!result || !result.insertId) {
        return res.json(formatResponse(true, 'Registration failed. Please try again.', []));
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: result.insertId, mobile: mobile },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Format response data
      const newUserData = {
        id: String(result.insertId),
        username: String(name),
        email: String(email),
        mobile: String(mobile),
        balance: '0',
        active: '1',
        created_on: String(Math.floor(Date.now() / 1000)),
        fcm_id: String(fcmId),
        country_code: String(countryCode),
        token: token
      };
      
      return res.json(formatResponse(false, 'Registration successful', [newUserData]));
    } finally {
      if (connection) {
        connection.release();
      }
    }
  } catch (error) {
    console.error('Error in registerController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

/**
 * Generate a referral code based on the user's name
 * @param {string} name - User's name
 * @returns {string} - Referral code
 */
function generateReferralCode(name) {
  const namePrefix = name.substr(0, 3).toUpperCase();
  const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${namePrefix}${randomDigits}`;
}

module.exports = {
  loginController,
  registerController
}; 