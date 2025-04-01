const db = require('../config/database');
const { formatDataTypes } = require('../helpers/functions');

/**
 * Get addresses for a user
 * @param {string} userId - User ID
 * @param {string} [id] - Optional address ID
 * @param {boolean} [fetchLatest] - Whether to fetch only the latest address
 * @param {boolean} [isDefault] - Whether to fetch only default address
 * @returns {Promise<Array>} - Array of addresses
 */
async function getAddress(userId, id = null, fetchLatest = false, isDefault = false) {
  try {
    let query = 'SELECT addr.* FROM addresses addr WHERE 1=1';
    const params = [];

    if (userId) {
      query += ' AND addr.user_id = ?';
      params.push(userId);
    }

    if (id) {
      query += ' AND addr.id = ?';
      params.push(id);
    }

    if (isDefault) {
      query += ' AND addr.is_default = 1';
    }

    query += ' GROUP BY addr.id ORDER BY addr.id DESC';

    if (fetchLatest) {
      query += ' LIMIT 1';
    }

    const [addresses] = await db.query(query, params);

    if (addresses && addresses.length > 0) {
      // Get area and city details for each address
      for (let i = 0; i < addresses.length; i++) {
        // Convert all null values to empty strings
        addresses[i] = Object.keys(addresses[i]).reduce((acc, key) => {
          acc[key] = addresses[i][key] === null ? "" : addresses[i][key];
          return acc;
        }, {});

        const areaId = (addresses[i].area_id && addresses[i].area_id != 0) ? addresses[i].area_id : "";
        
        if (areaId) {
          // Get area details including delivery charges
          const [areaResult] = await db.query(
            'SELECT minimum_free_delivery_order_amount, delivery_charges FROM areas WHERE id = ?',
            [areaId]
          );

          if (areaResult && areaResult.length > 0) {
            addresses[i].minimum_free_delivery_order_amount = (areaResult[0].minimum_free_delivery_order_amount != null) ? String(areaResult[0].minimum_free_delivery_order_amount) : "0";
            addresses[i].delivery_charges = (areaResult[0].delivery_charges != null) ? String(areaResult[0].delivery_charges) : "0";
          }

          // Get area name
          const [areaNameResult] = await db.query(
            'SELECT name FROM areas WHERE id = ?',
            [areaId]
          );

          if (areaNameResult && areaNameResult.length > 0) {
            addresses[i].area = areaNameResult[0].name || "";
          }
        }

        // Get city name if city_id exists
        if (addresses[i].city_id) {
          const [cityResult] = await db.query(
            'SELECT name FROM cities WHERE id = ?',
            [addresses[i].city_id]
          );

          if (cityResult && cityResult.length > 0) {
            addresses[i].city = cityResult[0].name || "";
          }
        }

        // Ensure pincode_name is set to pincode value
        addresses[i].pincode_name = addresses[i].pincode || "";
      }
    }

    return formatDataTypes(addresses);
  } catch (error) {
    console.error('Error in getAddress:', error);
    throw error;
  }
}

/**
 * Set or update an address
 * @param {Object} data - Address data
 * @returns {Promise<void>}
 */
async function setAddress(data) {
  try {
    const addressData = {};

    // Map fields from input data
    if (data.user_id) addressData.user_id = data.user_id;
    if (data.type) addressData.type = data.type;
    if (data.name) addressData.name = data.name;
    if (data.mobile) addressData.mobile = data.mobile;
    if (data.country_code) addressData.country_code = data.country_code;
    if (data.alternate_mobile) addressData.alternate_mobile = data.alternate_mobile;
    if (data.address) addressData.address = data.address;
    if (data.landmark) addressData.landmark = data.landmark;
    if (data.area_id) addressData.area_id = data.area_id;
    if (data.city_id) addressData.city_id = data.city_id;
    if (data.state) addressData.state = data.state;
    if (data.country) addressData.country = data.country;
    if (data.latitude) addressData.latitude = data.latitude;
    if (data.longitude) addressData.longitude = data.longitude;
    if (data.pincode) addressData.pincode = data.pincode;

    // Handle pincode validation and area/city mapping
    if (data.pincode_name) {
      const [zipResult] = await db.query(
        'SELECT id FROM zipcodes WHERE zipcode = ?',
        [data.pincode_name]
      );

      if (zipResult && zipResult.length > 0) {
        const zipId = zipResult[0].id;
        
        // Get area and city details
        const [areaResult] = await db.query(
          'SELECT id, city_id FROM areas WHERE zipcode_id = ?',
          [zipId]
        );

        if (areaResult && areaResult.length > 0) {
          addressData.area_id = areaResult[0].id;
          addressData.city_id = areaResult[0].city_id;
        }
      }
    }

    // Get city and area names
    if (addressData.city_id) {
      const [cityResult] = await db.query(
        'SELECT name FROM cities WHERE id = ?',
        [addressData.city_id]
      );

      if (cityResult && cityResult.length > 0) {
        addressData.city = cityResult[0].name;
      }
    }

    if (addressData.area_id) {
      const [areaResult] = await db.query(
        'SELECT name FROM areas WHERE id = ?',
        [addressData.area_id]
      );

      if (areaResult && areaResult.length > 0) {
        addressData.area = areaResult[0].name;
      }
    }

    // Handle default address setting
    if (data.is_default) {
      // Reset all addresses for this user to non-default
      await db.query(
        'UPDATE addresses SET is_default = 0 WHERE user_id = ?',
        [data.user_id]
      );
      addressData.is_default = 1;
    }

    if (data.id) {
      // Update existing address
      await db.query(
        'UPDATE addresses SET ? WHERE id = ?',
        [addressData, data.id]
      );
    } else {
      // Insert new address
      await db.query(
        'INSERT INTO addresses SET ?',
        [addressData]
      );
    }
  } catch (error) {
    console.error('Error in setAddress:', error);
    throw error;
  }
}

/**
 * Delete an address
 * @param {Object} data - Address data containing id
 * @returns {Promise<void>}
 */
async function deleteAddress(data) {
  try {
    if (!data.id) {
      throw new Error('Address ID is required');
    }

    await db.query(
      'DELETE FROM addresses WHERE id = ?',
      [data.id]
    );
  } catch (error) {
    console.error('Error in deleteAddress:', error);
    throw error;
  }
}

module.exports = {
  getAddress,
  setAddress,
  deleteAddress
}; 