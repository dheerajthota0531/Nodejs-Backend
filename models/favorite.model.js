// const db = require('../config/database');
// const { outputEscaping, getImageUrl, getMinMaxPriceOfProduct, getVariantsValuesByPid } = require('../helpers/functions');

// /**
//  * Check if a product is in a user's favorites
//  * @param {number} userId - User ID
//  * @param {number} productId - Product ID
//  * @returns {Promise<boolean>} - True if product exists in favorites
//  */
// async function isExistInFavorites(userId, productId) {
//   try {
//     const query = `
//       SELECT COUNT(*) as count 
//       FROM favorites 
//       WHERE user_id = ? AND product_id = ?
//     `;
//     const [result] = await db.query(query, [userId, productId]);
//     return result[0].count > 0;
//   } catch (error) {
//     console.error('Error in isExistInFavorites:', error);
//     throw error;
//   }
// }

// /**
//  * Add a product to favorites
//  * @param {number} userId - User ID
//  * @param {number} productId - Product ID
//  * @returns {Promise<Object>} - Response object
//  */
// async function addToFavorites(userId, productId) {
//   let connection;
//   try {
//     connection = await db.getConnection();
//     await connection.beginTransaction();

//     // Check if already in favorites - using a direct query for efficiency
//     const checkQuery = `
//       SELECT COUNT(*) as count 
//       FROM favorites 
//       WHERE user_id = ? AND product_id = ?
//     `;
//     const [checkResult] = await connection.query(checkQuery, [userId, productId]);
    
//     if (checkResult[0].count > 0) {
//       await connection.rollback();
//       return {
//         error: true,
//         message: "Already added to favorite!",
//         data: []
//       };
//     }

//     // Check if product exists and is active
//     const productQuery = `
//       SELECT COUNT(*) as count 
//       FROM products 
//       WHERE id = ? AND status = 1
//     `;
//     const [productResult] = await connection.query(productQuery, [productId]);
    
//     if (productResult[0].count === 0) {
//       await connection.rollback();
//       return {
//         error: true,
//         message: "Product not found or inactive",
//         data: []
//       };
//     }

//     // Insert into favorites
//     const data = {
//       user_id: userId,
//       product_id: productId
//     };
    
//     await connection.query('INSERT INTO favorites SET ?', data);
//     await connection.commit();
    
//     return {
//       error: false,
//       message: "Added to favorite",
//       data: []
//     };
//   } catch (error) {
//     if (connection) {
//       await connection.rollback();
//     }
//     console.error('Error in addToFavorites:', error);
//     return {
//       error: true,
//       message: error.message || "Failed to add to favorites",
//       data: []
//     };
//   } finally {
//     if (connection) {
//       connection.release();
//     }
//   }
// }

// /**
//  * Remove a product from favorites
//  * @param {number} userId - User ID
//  * @param {number} productId - Optional product ID (if null, removes all favorites for user)
//  * @returns {Promise<Object>} - Response object
//  */
// async function removeFromFavorites(userId, productId = null) {
//   let connection;
//   try {
//     connection = await db.getConnection();
//     await connection.beginTransaction();

//     // If product_id is specified, check if it exists in favorites
//     if (productId) {
//       const checkQuery = `
//         SELECT COUNT(*) as count 
//         FROM favorites 
//         WHERE user_id = ? AND product_id = ?
//       `;
//       const [checkResult] = await connection.query(checkQuery, [userId, productId]);
      
//       if (checkResult[0].count === 0) {
//         await connection.rollback();
//         return {
//           error: true,
//           message: "Item not added as favorite!",
//           data: []
//         };
//       }
//     } else {
//       // Check if user has any favorites
//       const checkQuery = `
//         SELECT COUNT(*) as count 
//         FROM favorites 
//         WHERE user_id = ?
//       `;
//       const [checkResult] = await connection.query(checkQuery, [userId]);
      
//       if (checkResult[0].count === 0) {
//         await connection.rollback();
//         return {
//           error: true,
//           message: "No favorites found for this user",
//           data: []
//         };
//       }
//     }

//     // Prepare deletion query
//     let query = 'DELETE FROM favorites WHERE user_id = ?';
//     let params = [userId];
    
//     if (productId) {
//       query += ' AND product_id = ?';
//       params.push(productId);
//     }
    
//     // Execute deletion
//     const [deleteResult] = await connection.query(query, params);
    
//     // Check if anything was actually deleted
//     if (deleteResult.affectedRows === 0) {
//       await connection.rollback();
//       return {
//         error: true,
//         message: "No favorites were removed",
//         data: []
//       };
//     }
    
//     await connection.commit();
    
//     return {
//       error: false,
//       message: "Removed from favorite",
//       data: []
//     };
//   } catch (error) {
//     if (connection) {
//       await connection.rollback();
//     }
//     console.error('Error in removeFromFavorites:', error);
//     return {
//       error: true,
//       message: error.message || "Failed to remove from favorites",
//       data: []
//     };
//   } finally {
//     if (connection) {
//       connection.release();
//     }
//   }
// }

// /**
//  * Get user favorites
//  * @param {number|string} userId - User ID
//  * @param {number} limit - Limit of records
//  * @param {number} offset - Offset for pagination
//  * @returns {Promise<Object>} - Response object
//  */
// async function getFavorites(userId, limit = 25, offset = 0) {
//   let connection;
//   try {
//     connection = await db.getConnection();
    
//     // First check if the user has any favorites
//     const checkQuery = `SELECT COUNT(*) as count FROM favorites WHERE user_id = ?`;
//     const [checkResult] = await connection.query(checkQuery, [userId]);
    
//     if (!checkResult || checkResult[0].count === 0) {
//       return {
//         error: true,
//         message: "No Favourite(s) Product Are Added",
//         total: 0,
//         data: []
//       };
//     }
    
//     // Get total count
//     const countQuery = `
//       SELECT COUNT(*) as total
//       FROM favorites f
//       JOIN products p ON p.id = f.product_id
//       WHERE f.user_id = ?
//     `;
    
//     const [countResult] = await connection.query(countQuery, [userId]);
//     const total = countResult[0].total || 0;
    
//     if (total === 0) {
//       return {
//         error: true,
//         message: "No Favourite(s) Product Are Added",
//         total: 0,
//         data: []
//       };
//     }
    
//     // Simplified query to get favorite products
//     const query = `
//       SELECT p.*
//       FROM favorites f
//       JOIN products p ON p.id = f.product_id
//       WHERE f.user_id = ?
//       ORDER BY f.id DESC
//       LIMIT ? OFFSET ?
//     `;
    
//     const [products] = await connection.query(query, [userId, parseInt(limit), parseInt(offset)]);
    
//     if (!products || products.length === 0) {
//       return {
//         error: true,
//         message: "No Favourite(s) Product Are Added",
//         total: 0,
//         data: []
//       };
//     }
    
//     // Process products data
//     const processedProducts = [];
    
//     for (const product of products) {
//       // Get variant data
//       let variants = [];
//       try {
//         const variantQuery = `
//           SELECT pv.*, GROUP_CONCAT(DISTINCT av.value) as variant_values,
//                 GROUP_CONCAT(DISTINCT a.name) as attr_names
//           FROM product_variants pv
//           LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
//           LEFT JOIN attributes a ON av.attribute_id = a.id
//           WHERE pv.product_id = ? AND pv.status = 1
//           GROUP BY pv.id
//         `;
        
//         const [variantResults] = await connection.query(variantQuery, [product.id]);
        
//         if (variantResults && variantResults.length > 0) {
//           // Format variants
//           variants = variantResults.map(v => ({
//             id: String(v.id || ""),  // This is the product_variant_id
//             product_id: String(v.product_id || ""),
//             attribute_value_ids: v.attribute_value_ids || "",
//             attribute_set: v.attribute_set || "",
//             price: v.price ? String(v.price) : "0",
//             special_price: v.special_price ? String(v.special_price) : "0",
//             sku: v.sku || "",
//             stock: v.stock ? String(v.stock) : "0",
//             weight: v.weight ? String(v.weight) : "0",
//             height: v.height ? String(v.height) : "0",
//             breadth: v.breadth ? String(v.breadth) : "0",
//             length: v.length ? String(v.length) : "0",
//             images: v.images ? (typeof v.images === 'string' ? JSON.parse(v.images) : v.images) : [],
//             availability: v.availability ? String(v.availability) : "1",
//             status: v.status ? String(v.status) : "1",
//             attr_name: v.attr_names || "Unit",
//             variant_values: v.variant_values || "1 Pc",
//             cart_count: "0"
//           }));
//         }
//       } catch (err) {
//         console.error('Error fetching variants:', err);
//         // Default variant if error
//         variants = [{
//           id: "0",
//           product_id: String(product.id || ""),
//           price: "0",
//           special_price: "0",
//           stock: "0"
//         }];
//       }
      
//       // Get min/max prices
//       let minMaxPrice = null;
//       try {
//         minMaxPrice = await getMinMaxPriceOfProduct(product.id);
//       } catch (err) {
//         console.error('Error getting min/max price:', err);
//         minMaxPrice = {
//           min_price: product.price || "0",
//           max_price: product.price || "0",
//           special_price: "0",
//           max_special_price: "0",
//           discount_in_percentage: "0"
//         };
//       }
      
//       // Get other images
//       let otherImages = [];
//       if (product.other_images) {
//         try {
//           const images = typeof product.other_images === 'string' ? 
//             JSON.parse(product.other_images) : product.other_images;
          
//           otherImages = Array.isArray(images) ? images.map(img => ({
//             image: img,
//             image_url: getImageUrl(img)
//           })) : [];
//         } catch (err) {
//           console.error('Error parsing other images:', err);
//         }
//       }
      
//       // Get default product_variant_id (pick first available variant)
//       const defaultVariant = variants.length > 0 ? variants[0] : null;
//       const product_variant_id = defaultVariant ? defaultVariant.id : "";
        
//       // Create formatted product
//       const formattedProduct = {
//         id: String(product.id || ""),
//         user_id: String(userId || ""),
//         name: outputEscaping(product.name || ""),
//         slug: product.slug || "",
//         category_id: String(product.category_id || "0"),
//         sub_category_id: String(product.sub_category_id || "0"),
//         short_description: outputEscaping(product.short_description || ""),
//         price: product.price ? String(product.price) : "0",
//         weight: product.weight ? String(product.weight) : "0",
//         type: product.type || "",
//         image: getImageUrl(product.image || ""),
//         image_md: getImageUrl(product.image || "", 'thumb', 'md'),
//         image_sm: getImageUrl(product.image || "", 'thumb', 'sm'),
//         stock: product.stock ? String(product.stock) : "0",
//         availability: product.availability ? String(product.availability) : "0",
//         status: "1", // Force status to be 1
//         date_added: product.date_added ? new Date(product.date_added).toISOString().replace('T', ' ').slice(0, 19) : "",
//         product_variant_id: product_variant_id, // Add explicit product_variant_id
//         default_variant: product_variant_id, // Clear indication of default variant to use
//         variants: variants || [],
//         min_max_price: {
//           min_price: String(minMaxPrice?.min_price || "0"),
//           max_price: String(minMaxPrice?.max_price || "0"),
//           special_price: String(minMaxPrice?.special_price || "0"),
//           max_special_price: String(minMaxPrice?.max_special_price || "0"),
//           discount_in_percentage: String(minMaxPrice?.discount_in_percentage || "0")
//         },
//         is_favorite: "1", // Since we're fetching from favorites, this is always 1
//         relative_path: product.image ? product.image : "",
//         other_images: otherImages || [],
//         total_allowed_quantity: product.total_allowed_quantity ? String(product.total_allowed_quantity) : "",
//         minimum_order_quantity: product.minimum_order_quantity ? String(product.minimum_order_quantity) : "1",
//         quantity_step_size: product.quantity_step_size ? String(product.quantity_step_size) : "1",
//         cod_allowed: product.cod_allowed ? String(product.cod_allowed) : "1"
//       };
      
//       processedProducts.push(formattedProduct);
//     }
    
//     return {
//       error: false,
//       message: "Data Retrieved Successfully",
//       total: total,
//       data: processedProducts
//     };
//   } catch (error) {
//     console.error('Error in getFavorites:', error);
//     return {
//       error: true,
//       message: error.message || "Failed to get favorites",
//       total: 0,
//       data: []
//     };
//   } finally {
//     if (connection) {
//       connection.release();
//     }
//   }
// }

// module.exports = {
//   isExistInFavorites,
//   addToFavorites,
//   removeFromFavorites,
//   getFavorites
// }; 


const db = require('../config/database');
const { outputEscaping, getImageUrl, getMinMaxPriceOfProduct, getVariantsValuesByPid } = require('../helpers/functions');

/**
 * Check if a product is in a user's favorites
 * @param {number} userId - User ID
 * @param {number} productId - Product ID
 * @returns {Promise<boolean>} - True if product exists in favorites
 */
async function isExistInFavorites(userId, productId) {
  try {
    const query = `
      SELECT COUNT(*) as count 
      FROM favorites 
      WHERE user_id = ? AND product_id = ?
    `;
    const [result] = await db.query(query, [userId, productId]);
    return result[0].count > 0;
  } catch (error) {
    console.error('Error in isExistInFavorites:', error);
    throw error;
  }
}

/**
 * Add a product to favorites
 * @param {number} userId - User ID
 * @param {number} productId - Product ID
 * @returns {Promise<Object>} - Response object
 */
async function addToFavorites(userId, productId) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if already in favorites - using a direct query for efficiency
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM favorites 
      WHERE user_id = ? AND product_id = ?
    `;
    const [checkResult] = await connection.query(checkQuery, [userId, productId]);
    
    if (checkResult[0].count > 0) {
      await connection.rollback();
      return {
        error: true,
        message: "Already added to favorite!",
        data: []
      };
    }

    // Check if product exists and is active
    const productQuery = `
      SELECT COUNT(*) as count 
      FROM products 
      WHERE id = ? AND status = 1
    `;
    const [productResult] = await connection.query(productQuery, [productId]);
    
    if (productResult[0].count === 0) {
      await connection.rollback();
      return {
        error: true,
        message: "Product not found or inactive",
        data: []
      };
    }

    // Insert into favorites
    const data = {
      user_id: userId,
      product_id: productId
    };
    
    await connection.query('INSERT INTO favorites SET ?', data);
    await connection.commit();
    
    return {
      error: false,
      message: "Added to favorite",
      data: []
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in addToFavorites:', error);
    return {
      error: true,
      message: error.message || "Failed to add to favorites",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Remove a product from favorites
 * @param {number} userId - User ID
 * @param {number} productId - Optional product ID (if null, removes all favorites for user)
 * @returns {Promise<Object>} - Response object
 */
async function removeFromFavorites(userId, productId = null) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // If product_id is specified, check if it exists in favorites
    if (productId) {
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM favorites 
        WHERE user_id = ? AND product_id = ?
      `;
      const [checkResult] = await connection.query(checkQuery, [userId, productId]);
      
      if (checkResult[0].count === 0) {
        await connection.rollback();
        return {
          error: true,
          message: "Item not added as favorite!",
          data: []
        };
      }
    } else {
      // Check if user has any favorites
      const checkQuery = `
        SELECT COUNT(*) as count 
        FROM favorites 
        WHERE user_id = ?
      `;
      const [checkResult] = await connection.query(checkQuery, [userId]);
      
      if (checkResult[0].count === 0) {
        await connection.rollback();
        return {
          error: true,
          message: "No favorites found for this user",
          data: []
        };
      }
    }

    // Prepare deletion query
    let query = 'DELETE FROM favorites WHERE user_id = ?';
    let params = [userId];
    
    if (productId) {
      query += ' AND product_id = ?';
      params.push(productId);
    }
    
    // Execute deletion
    const [deleteResult] = await connection.query(query, params);
    
    // Check if anything was actually deleted
    if (deleteResult.affectedRows === 0) {
      await connection.rollback();
      return {
        error: true,
        message: "No favorites were removed",
        data: []
      };
    }
    
    await connection.commit();
    
    return {
      error: false,
      message: "Removed from favorite",
      data: []
    };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Error in removeFromFavorites:', error);
    return {
      error: true,
      message: error.message || "Failed to remove from favorites",
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get user favorites
 * @param {number|string} userId - User ID
 * @param {number} limit - Limit of records
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} - Response object
 */
async function getFavorites(userId, limit = 25, offset = 0) {
  let connection;
  try {
    connection = await db.getConnection();
    
    // First check if the user has any favorites
    const checkQuery = `SELECT COUNT(*) as count FROM favorites WHERE user_id = ?`;
    const [checkResult] = await connection.query(checkQuery, [userId]);
    
    if (!checkResult || checkResult[0].count === 0) {
      return {
        error: true,
        message: "No Favourite(s) Product Are Added",
        total: 0,
        data: []
      };
    }
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE f.user_id = ?
    `;
    
    const [countResult] = await connection.query(countQuery, [userId]);
    const total = countResult[0].total || 0;
    
    if (total === 0) {
      return {
        error: true,
        message: "No Favourite(s) Product Are Added",
        total: 0,
        data: []
      };
    }
    
    // Simplified query to get favorite products
    const query = `
      SELECT p.*
      FROM favorites f
      JOIN products p ON p.id = f.product_id
      WHERE f.user_id = ?
      ORDER BY f.id DESC
      LIMIT ? OFFSET ?
    `;
    
    const [products] = await connection.query(query, [userId, parseInt(limit), parseInt(offset)]);
    
    if (!products || products.length === 0) {
      return {
        error: true,
        message: "No Favourite(s) Product Are Added",
        total: 0,
        data: []
      };
    }
    
    // Process products data
    const processedProducts = [];
    
    for (const product of products) {
      // Get variant data
      let variants = [];
      try {
        const variantQuery = `
          SELECT pv.*, GROUP_CONCAT(DISTINCT av.value) as variant_values,
                GROUP_CONCAT(DISTINCT a.name) as attr_names
          FROM product_variants pv
          LEFT JOIN attribute_values av ON FIND_IN_SET(av.id, pv.attribute_value_ids) > 0
          LEFT JOIN attributes a ON av.attribute_id = a.id
          WHERE pv.product_id = ? AND pv.status = 1
          GROUP BY pv.id
        `;
        
        const [variantResults] = await connection.query(variantQuery, [product.id]);
        
        if (variantResults && variantResults.length > 0) {
          // Format variants
          variants = variantResults.map(v => ({
            id: String(v.id || ""),  // This is the product_variant_id
            product_id: String(v.product_id || ""),
            attribute_value_ids: v.attribute_value_ids || "",
            attribute_set: v.attribute_set || "",
            price: v.price ? String(v.price) : "0",
            special_price: v.special_price ? String(v.special_price) : "0",
            sku: v.sku || "",
            stock: v.stock ? String(v.stock) : "0",
            weight: v.weight ? String(v.weight) : "0",
            height: v.height ? String(v.height) : "0",
            breadth: v.breadth ? String(v.breadth) : "0",
            length: v.length ? String(v.length) : "0",
            images: v.images ? (typeof v.images === 'string' ? JSON.parse(v.images) : v.images) : [],
            availability: v.availability ? String(v.availability) : "1",
            status: v.status ? String(v.status) : "1",
            attr_name: v.attr_names || "Unit",
            variant_values: v.variant_values || "1 Pc",
            cart_count: "0"
          }));
        }
      } catch (err) {
        console.error('Error fetching variants:', err);
        // Default variant if error
        variants = [{
          id: "0",
          product_id: String(product.id || ""),
          price: "0",
          special_price: "0",
          stock: "0"
        }];
      }
      
      // Get min/max prices
      let minMaxPrice = null;
      try {
        minMaxPrice = await getMinMaxPriceOfProduct(product.id);
      } catch (err) {
        console.error('Error getting min/max price:', err);
        minMaxPrice = {
          min_price: product.price || "0",
          max_price: product.price || "0",
          special_price: "0",
          max_special_price: "0",
          discount_in_percentage: "0"
        };
      }
      
      // Get other images
      let otherImages = [];
      if (product.other_images) {
        try {
          const images = typeof product.other_images === 'string' ? 
            JSON.parse(product.other_images) : product.other_images;
          
          otherImages = Array.isArray(images) ? images.map(img => ({
            image: img,
            image_url: getImageUrl(img)
          })) : [];
        } catch (err) {
          console.error('Error parsing other images:', err);
        }
      }
      
      // Get default product_variant_id (pick first available variant)
      const defaultVariant = variants.length > 0 ? variants[0] : null;
      const product_variant_id = defaultVariant ? defaultVariant.id : "";
        
      // Create formatted product
      const formattedProduct = {
        id: String(product.id || ""),
        user_id: String(userId || ""),
        name: outputEscaping(product.name || ""),
        slug: product.slug || "",
        category_id: String(product.category_id || "0"),
        sub_category_id: String(product.sub_category_id || "0"),
        short_description: outputEscaping(product.short_description || ""),
        price: product.price ? String(product.price) : "0",
        weight: product.weight ? String(product.weight) : "0",
        type: product.type || "",
        image: getImageUrl(product.image || ""),
        image_md: getImageUrl(product.image || "", 'thumb', 'md'),
        image_sm: getImageUrl(product.image || "", 'thumb', 'sm'),
        stock: product.stock ? String(product.stock) : "0",
        availability: product.availability ? String(product.availability) : "0",
        status: "1", // Force status to be 1
        date_added: product.date_added ? new Date(product.date_added).toISOString().replace('T', ' ').slice(0, 19) : "",
        product_variant_id: product_variant_id, // Add explicit product_variant_id
        default_variant: product_variant_id, // Clear indication of default variant to use
        variants: variants || [],
        min_max_price: {
          min_price: String(minMaxPrice?.min_price || "0"),
          max_price: String(minMaxPrice?.max_price || "0"),
          special_price: String(minMaxPrice?.special_price || "0"),
          max_special_price: String(minMaxPrice?.max_special_price || "0"),
          discount_in_percentage: String(minMaxPrice?.discount_in_percentage || "0")
        },
        is_favorite: "1", // Since we're fetching from favorites, this is always 1
        relative_path: product.image ? product.image : "",
        other_images: otherImages || [],
        total_allowed_quantity: product.total_allowed_quantity ? String(product.total_allowed_quantity) : "",
        minimum_order_quantity: product.minimum_order_quantity ? String(product.minimum_order_quantity) : "1",
        quantity_step_size: product.quantity_step_size ? String(product.quantity_step_size) : "1",
        cod_allowed: product.cod_allowed ? String(product.cod_allowed) : "1"
      };
      
      processedProducts.push(formattedProduct);
    }
    
    return {
      error: false,
      message: "Data Retrieved Successfully",
      total: total,
      data: processedProducts
    };
  } catch (error) {
    console.error('Error in getFavorites:', error);
    return {
      error: true,
      message: error.message || "Failed to get favorites",
      total: 0,
      data: []
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  isExistInFavorites,
  addToFavorites,
  removeFromFavorites,
  getFavorites
};  