const db = require('../config/database');
const { getImageUrl } = require('../helpers/functions');

/**
 * Set a product rating
 * @param {Object} data - Rating data
 * @returns {Promise<Object>} - Response object
 */
async function setProductRating(data) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Check if required fields are present
    const requiredFields = ['user_id', 'product_id', 'rating', 'comment'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return {
        error: true,
        message: `${missingFields.join(', ')} are required fields!`,
        data: []
      };
    }
    
    // Check if the user has purchased the product
    const [purchaseResult] = await connection.query(
      `SELECT COUNT(*) as count 
       FROM order_items oi 
       JOIN product_variants pv ON oi.product_variant_id = pv.id
       JOIN orders o ON oi.order_id = o.id
       WHERE pv.product_id = ? AND o.user_id = ? AND o.active_status = 'delivered'`,
      [data.product_id, data.user_id]
    );
    
    const hasPurchased = purchaseResult[0]?.count > 0;
    
    // Check if the table exists, and create it if it doesn't
    await connection.query(
      `CREATE TABLE IF NOT EXISTS product_rating (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        rating VARCHAR(10) NOT NULL,
        comment TEXT DEFAULT NULL,
        images TEXT DEFAULT NULL,
        data_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )`
    );
    
    // Check if the user has already rated this product
    const [ratingCheckResult] = await connection.query(
      `SELECT * FROM product_rating WHERE user_id = ? AND product_id = ?`,
      [data.user_id, data.product_id]
    );
    
    const ratingExists = ratingCheckResult.length > 0;
    
    // Prepare rating data
    const ratingData = {
      user_id: data.user_id,
      product_id: data.product_id,
      rating: data.rating,
      comment: data.comment || ''
    };
    
    // Process images if provided
    if (data.images && Array.isArray(data.images) && data.images.length > 0) {
      ratingData.images = JSON.stringify(data.images);
    }
    
    if (ratingExists) {
      // Update existing rating
      const updateId = ratingCheckResult[0].id;
      await connection.query(
        `UPDATE product_rating SET ? WHERE id = ?`,
        [ratingData, updateId]
      );
    } else {
      // Insert new rating
      await connection.query(
        `INSERT INTO product_rating SET ?`,
        [ratingData]
      );
    }
    
    // Update product rating in products table
    await updateProductRating(data.product_id, connection);
    
    await connection.commit();
    
    return {
      error: false,
      message: ratingExists ? 'Product rating updated successfully' : 'Product rating added successfully',
      data: {
        product_id: data.product_id,
        has_purchased: hasPurchased ? '1' : '0'
      }
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in setProductRating:', error);
    return {
      error: true,
      message: error.message || 'Failed to add/update product rating',
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Delete a product rating
 * @param {number} userId - User ID
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} - Response object
 */
async function deleteProductRating(userId, productId) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    
    // Check if the table exists
    const [tablesResult] = await connection.query(
      `SELECT COUNT(*) AS table_exists
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
       AND table_name = 'product_rating'`
    );
    
    const tableExists = tablesResult[0]?.table_exists > 0;
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      await connection.query(
        `CREATE TABLE IF NOT EXISTS product_rating (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          rating VARCHAR(10) NOT NULL,
          comment TEXT DEFAULT NULL,
          images TEXT DEFAULT NULL,
          data_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )`
      );
      
      // No rating to delete, but return success
      await connection.commit();
      return {
        error: false,
        message: 'No rating found to delete',
        data: []
      };
    }
    
    // Check if the rating exists
    const [ratingCheckResult] = await connection.query(
      `SELECT * FROM product_rating WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );
    
    if (ratingCheckResult.length === 0) {
      await connection.commit();
      return {
        error: false,
        message: 'No rating found to delete',
        data: []
      };
    }
    
    // Delete the rating
    await connection.query(
      `DELETE FROM product_rating WHERE user_id = ? AND product_id = ?`,
      [userId, productId]
    );
    
    // Update product rating in products table
    await updateProductRating(productId, connection);
    
    await connection.commit();
    
    return {
      error: false,
      message: 'Product rating deleted successfully',
      data: []
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in deleteProductRating:', error);
    return {
      error: true,
      message: error.message || 'Failed to delete product rating',
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get product ratings
 * @param {number} productId - Product ID
 * @param {number} userId - User ID (optional)
 * @param {number} limit - Limit for results (optional)
 * @param {number} offset - Offset for results (optional)
 * @param {string} sort - Sort field (optional)
 * @param {string} order - Sort order (optional)
 * @param {number} hasImages - Filter ratings with images (optional)
 * @returns {Promise<Object>} - Response object
 */
async function getProductRatings(productId, userId = null, limit = 25, offset = 0, sort = 'id', order = 'DESC', hasImages = 0) {
  let connection;
  try {
    connection = await db.getConnection();

    // Convert string parameters to numbers
    productId = Number(productId);
    limit = Number(limit);
    offset = Number(offset);
    hasImages = Number(hasImages);

    if (userId !== null) {
      userId = Number(userId);
    }

    // Check if the table exists
    const [tablesResult] = await connection.query(
      `SELECT COUNT(*) AS table_exists
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
       AND table_name = 'product_rating'`
    );

    const tableExists = tablesResult[0]?.table_exists > 0;

    if (!tableExists) {
      // Create the table if it doesn't exist
      await connection.query(
        `CREATE TABLE IF NOT EXISTS product_rating (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          rating VARCHAR(10) NOT NULL,
          comment TEXT DEFAULT NULL,
          images TEXT DEFAULT NULL,
          data_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )`
      );

      // Return empty result since the table was just created
      return {
        error: false,
        message: 'Rating retrieved successfully',
        no_of_rating: 0,
        total: "0",
        star_1: "0",
        star_2: "0",
        star_3: "0",
        star_4: "0",
        star_5: "0",
        total_images: "",
        product_rating: "0",
        data: []
      };
    }

    // Fetch user rating if userId is provided
    let userRating = null;
    if (userId) {
      const [userRatingResult] = await connection.query(
        `SELECT * FROM product_rating 
         WHERE user_id = ? AND product_id = ?`,
        [userId, productId]
      );

      if (userRatingResult.length > 0) {
        const rating = userRatingResult[0];
        
        // Parse images
        if (rating.images) {
          try {
            rating.images = parseImages(rating.images);
          } catch (e) {
            rating.images = [];
          }
        } else {
          rating.images = [];
        }
        
        // Format user rating
        userRating = {
          id: String(rating.id),
          user_id: String(rating.user_id),
          product_id: String(rating.product_id),
          rating: String(rating.rating),
          comment: rating.comment || '',
          images: rating.images,
          data_added: formatDateAdded(rating.data_added)
        };
      }
    }

    // Get product info to fetch product rating
    const [productResult] = await connection.query(
      `SELECT rating FROM products WHERE id = ?`,
      [productId]
    );

    // Query parameters for the main query
    const queryParams = [productId];
    
    // Base query with join
    let query = `
      SELECT pr.id, pr.user_id, pr.product_id, pr.rating, pr.comment, pr.images, pr.data_added, 
             u.username as user_name, u.image as user_profile 
      FROM product_rating pr
      LEFT JOIN users u ON u.id = pr.user_id
      WHERE pr.product_id = ?
    `;

    // Add user_id condition if provided
    if (userId) {
      query += ` AND pr.user_id = ?`;
      queryParams.push(userId);
    }

    // Add hasImages condition if specified
    if (hasImages === 1) {
      query += ` AND pr.images IS NOT NULL AND pr.images != ''`;
    }

    // Get total count before adding limit/offset
    const [totalResult] = await connection.query(
      `SELECT COUNT(*) as total FROM (${query}) as subquery`,
      queryParams
    );
    const total = totalResult[0]?.total || 0;

    // Count total images
    const [totalImagesResult] = await connection.query(
      `SELECT pr.images FROM product_rating pr WHERE pr.product_id = ? AND pr.images IS NOT NULL AND pr.images != ''`,
      [productId]
    );
    
    // Calculate total image count across all ratings
    let totalImageCount = 0;
    for (const row of totalImagesResult) {
      if (row.images) {
        try {
          const images = parseImages(row.images);
          totalImageCount += images.length;
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    // Add order by
    if (sort && order) {
      // Map sort field names from PHP to Node.js
      const sortFieldMap = {
        'id': 'pr.id',
        'user_id': 'pr.user_id',
        'product_id': 'pr.product_id',
        'rating': 'pr.rating',
        'data_added': 'pr.data_added'
      };
      
      const sortField = sortFieldMap[sort] || 'pr.id';
      query += ` ORDER BY ${sortField} ${order === 'ASC' ? 'ASC' : 'DESC'}`;
    }

    // Add limit and offset as numeric parameters
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);
    
    // Get all ratings with pagination
    const [ratingsResult] = await connection.query(query, queryParams);
    
    // Process ratings
    const ratings = [];
    for (const rating of ratingsResult) {
      // Format user image
      if (rating.user_profile) {
        rating.user_profile = getImageUrl(rating.user_profile);
      } else {
        rating.user_profile = "";
      }
      
      // Parse images JSON
      if (rating.images) {
        try {
          rating.images = parseImages(rating.images);
        } catch (e) {
          rating.images = [];
        }
      } else {
        rating.images = [];
      }
      
      // Create formatted rating object that matches PHP response structure
      const formattedRating = {
        id: String(rating.id),
        user_id: String(rating.user_id),
        product_id: String(rating.product_id),
        rating: String(rating.rating || "0"),
        images: rating.images,
        comment: rating.comment || "",
        data_added: formatDateAdded(rating.data_added),
        user_name: rating.user_name || "",
        user_profile: rating.user_profile || ""
      };
      
      ratings.push(formattedRating);
    }
    
    // Get product rating statistics
    const [statsResult] = await connection.query(
      `SELECT 
         COUNT(*) as total_ratings,
         IFNULL(AVG(rating), 0) as avg_rating,
         SUM(CASE WHEN CEILING(rating) = 1 THEN 1 ELSE 0 END) as star_1,
         SUM(CASE WHEN CEILING(rating) = 2 THEN 1 ELSE 0 END) as star_2,
         SUM(CASE WHEN CEILING(rating) = 3 THEN 1 ELSE 0 END) as star_3,
         SUM(CASE WHEN CEILING(rating) = 4 THEN 1 ELSE 0 END) as star_4,
         SUM(CASE WHEN CEILING(rating) = 5 THEN 1 ELSE 0 END) as star_5
       FROM product_rating
       WHERE product_id = ?`,
      [productId]
    );
    
    const stats = statsResult[0] || {};
    
    // Get the product's rating from products table
    const pr_rating = productResult[0]?.rating || 0;
    
    // Format response to match PHP format exactly
    return {
      error: false,
      message: "Rating retrieved successfully",
      no_of_rating: total,
      total: String(stats.total_ratings || "0"),
      star_1: String(stats.star_1 || "0"),
      star_2: String(stats.star_2 || "0"),
      star_3: String(stats.star_3 || "0"),
      star_4: String(stats.star_4 || "0"),
      star_5: String(stats.star_5 || "0"),
      total_images: String(totalImageCount || ""),
      product_rating: String(Math.round((pr_rating || 0) * 10) / 10 || "3"),
      data: ratings
    };
  } catch (error) {
    console.error('Error in getProductRatings:', error);
    return {
      error: true,
      message: error.message || 'Failed to get product ratings',
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get product review images
 * @param {number} productId - Product ID
 * @param {number} limit - Limit for results (optional)
 * @param {number} offset - Offset for results (optional)
 * @returns {Promise<Object>} - Response object
 */
async function getProductReviewImages(productId, limit = 10, offset = 0) {
  let connection;
  try {
    connection = await db.getConnection();
    
    // Convert string parameters to numbers
    productId = Number(productId);
    limit = Number(limit);
    offset = Number(offset);
    
    // Check if the table exists
    const [tablesResult] = await connection.query(
      `SELECT COUNT(*) AS table_exists
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
       AND table_name = 'product_rating'`
    );
    
    const tableExists = tablesResult[0]?.table_exists > 0;
    
    if (!tableExists) {
      // Create the table if it doesn't exist
      await connection.query(
        `CREATE TABLE IF NOT EXISTS product_rating (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          rating VARCHAR(10) NOT NULL,
          comment TEXT DEFAULT NULL,
          images TEXT DEFAULT NULL,
          data_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        )`
      );
      
      // Return empty result since the table was just created
      return {
        error: false,
        message: 'Product review images retrieved successfully',
        total: "0",
        data: []
      };
    }
    
    // Get ratings with images
    const [ratingsResult] = await connection.query(
      `SELECT pr.id, pr.user_id, pr.product_id, pr.rating, pr.images, pr.data_added, u.username, u.image as user_image
       FROM product_rating pr
       LEFT JOIN users u ON pr.user_id = u.id
       WHERE pr.product_id = ? AND pr.images IS NOT NULL AND pr.images != ''
       ORDER BY pr.data_added DESC`,
      [productId]
    );
    
    // Process all images
    const allImages = [];
    
    for (const rating of ratingsResult) {
      if (rating.images) {
        try {
          const images = parseImages(rating.images);
          
          for (const image of images) {
            allImages.push({
              id: String(rating.id),
              user_id: String(rating.user_id),
              product_id: String(rating.product_id),
              rating: String(rating.rating),
              username: rating.username || 'Unknown',
              user_image: rating.user_image ? getImageUrl(rating.user_image) : '',
              image: image, // Already processed by parseImages
              data_added: formatDateAdded(rating.data_added)
            });
          }
        } catch (e) {
          console.error('Error parsing images JSON:', e);
        }
      }
    }
    
    // Apply limit and offset
    const paginatedImages = allImages.slice(offset, offset + limit);
    
    return {
      error: false,
      message: 'Product review images retrieved successfully',
      total: String(allImages.length),
      data: paginatedImages
    };
  } catch (error) {
    console.error('Error in getProductReviewImages:', error);
    return {
      error: true,
      message: error.message || 'Failed to get product review images',
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Update product rating in products table
 * @param {number} productId - Product ID
 * @param {Object} connection - Database connection
 * @returns {Promise<void>}
 */
async function updateProductRating(productId, connection) {
  try {
    // Calculate average rating and count
    const [ratingResult] = await connection.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
       FROM product_rating
       WHERE product_id = ?`,
      [productId]
    );
    
    const avgRating = ratingResult[0]?.avg_rating || 0;
    const totalRatings = ratingResult[0]?.total_ratings || 0;
    
    // Update product
    await connection.query(
      `UPDATE products SET rating = ?, no_of_ratings = ? WHERE id = ?`,
      [avgRating, totalRatings, productId]
    );
  } catch (error) {
    console.error('Error in updateProductRating:', error);
    throw error;
  }
}

/**
 * Format date added for ratings
 * @param {string|Date} dateAdded - Date added
 * @returns {string} - Formatted date
 */
function formatDateAdded(dateAdded) {
  if (!dateAdded) return '';
  
  try {
    // Handle if already a string in correct format
    if (typeof dateAdded === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateAdded)) {
      return dateAdded;
    }
    
    const date = new Date(dateAdded);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format: YYYY-MM-DD HH:MM:SS (PHP MySQL format)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
}

/**
 * Parse images from various formats to array of URLs
 * @param {string|Array} images - Images data from database
 * @returns {Array} - Array of image URLs
 */
function parseImages(images) {
  if (!images) return [];
  
  try {
    // If already an array, process directly
    if (Array.isArray(images)) {
      return images.map(image => getImageUrl(image));
    }
    
    // If JSON string, parse it
    if (typeof images === 'string') {
      // Check if the string is already JSON formatted
      if (images.startsWith('[') || images.startsWith('{')) {
        return JSON.parse(images).map(image => getImageUrl(image));
      }
      
      // Might be a single image path
      return [getImageUrl(images)];
    }
    
    return [];
  } catch (e) {
    console.error('Error parsing images:', e);
    return [];
  }
}

/**
 * Count total images in ratings
 * @param {Array} ratings - Ratings
 * @returns {number} - Total images
 */
function countTotalImages(ratings) {
  // This should be the total count of images across all ratings for this product,
  // not just the ones in the current page - matching PHP implementation
  let count = 0;
  
  for (const rating of ratings) {
    if (rating.images && Array.isArray(rating.images)) {
      count += rating.images.length;
    }
  }
  
  return count;
}

module.exports = {
  setProductRating,
  deleteProductRating,
  getProductRatings,
  getProductReviewImages
}; 