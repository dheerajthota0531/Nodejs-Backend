/**
 * Address Controller
 * @module address.controller
 */
const { getAddress, setAddress, deleteAddress } = require('../models/address.model');
const { formatResponse, isExist, formatDataTypes } = require('../helpers/functions');

/**
 * Get addresses for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function getAddressController(req, res) {
  try {
    // Validate required parameters
    if (!req.body.user_id) {
      return res.json(formatResponse(true, 'User ID is required', []));
    }
    
    // Get addresses from model
    const addresses = await getAddress(req.body.user_id);
    
    // If addresses found, check if there's a default address
    if (addresses && addresses.length > 0) {
      // Check if any address is marked as default
      const isDefaultCounter = addresses.filter(addr => addr.is_default === '1').length;
      
      // If no default address is set, make the first one default
      if (isDefaultCounter === 0) {
        // Update the first address to be default in the database
        const db = require('../config/database');
        await db.query('UPDATE addresses SET is_default = 1 WHERE id = ?', [addresses[0].id]);
        
        // Fetch addresses again with the updated default
        const updatedAddresses = await getAddress(req.body.user_id);
        
        return res.json(formatResponse(false, 'Address Retrieved Successfully', updatedAddresses));
      }
      
      return res.json(formatResponse(false, 'Address Retrieved Successfully', addresses));
    } else {
      return res.json(formatResponse(true, 'No Details Found !', []));
    }
  } catch (error) {
    console.error('Error in getAddressController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

/**
 * Add a new address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function addAddressController(req, res) {
  try {
    // Validate required parameters
    if (!req.body.user_id) {
      return res.json(formatResponse(true, 'User ID is required', []));
    }
    
    // Validate pincode if provided
    if (req.body.pincode_name) {
      const isPincodeExists = await isExist({ zipcode: req.body.pincode_name }, 'zipcodes');
      
      if (!isPincodeExists) {
        return res.json(formatResponse(
          true, 
          'Sorry!! Not Delivering to this pincode. Please contact +91 8500820088', 
          []
        ));
      }
    }
    
    // Set address in database
    await setAddress(req.body);
    
    // Get the newly added address (with fetchLatest = true)
    const newAddress = await getAddress(req.body.user_id, null, true);
    
    return res.json(formatResponse(false, 'Address Added Successfully', newAddress));
  } catch (error) {
    console.error('Error in addAddressController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

/**
 * Update an existing address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function updateAddressController(req, res) {
  try {
    // Validate required parameters
    if (!req.body.id) {
      return res.json(formatResponse(true, 'Address ID is required', []));
    }
    
    // Validate pincode if provided
    if (req.body.pincode_name) {
      const isPincodeExists = await isExist({ zipcode: req.body.pincode_name }, 'zipcodes');
      
      if (!isPincodeExists) {
        return res.json(formatResponse(
          true, 
          'Sorry!! Not Delivering to this pincode. Please contact +91 8500820088', 
          []
        ));
      }
    }
    
    // Update address in database
    await setAddress(req.body);
    
    // Get the updated address
    const updatedAddress = await getAddress(null, req.body.id, true);
    
    return res.json(formatResponse(false, 'Address updated Successfully', updatedAddress));
  } catch (error) {
    console.error('Error in updateAddressController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

/**
 * Delete an address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
async function deleteAddressController(req, res) {
  try {
    // Validate required parameters
    if (!req.body.id) {
      return res.json(formatResponse(true, 'Address ID is required', []));
    }
    
    // Delete address from database
    await deleteAddress(req.body);
    
    return res.json(formatResponse(false, 'Address Deleted Successfully', []));
  } catch (error) {
    console.error('Error in deleteAddressController:', error);
    return res.status(500).json(formatResponse(true, 'Something went wrong. Please try again.', []));
  }
}

module.exports = {
  getAddressController,
  addAddressController,
  updateAddressController,
  deleteAddressController
}; 