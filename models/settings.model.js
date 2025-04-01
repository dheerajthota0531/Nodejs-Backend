const db = require('../config/database');
const helpers = require('../helpers/functions');
const config = require('../config/config');

/**
 * Get settings by type
 * @param {string} type - Type of settings
 * @param {boolean} isJson - Whether the value is stored as JSON
 * @returns {Promise<any>} - Settings data
 */
async function getSettings(type = 'system_settings', isJson = false) {
  try {
    const connection = await db.getConnection();
    
    // Get setting from the settings table
    const [result] = await connection.query(
      'SELECT * FROM settings WHERE variable = ?',
      [type]
    );
    connection.release();
    
    if (result && result.length > 0) {
      if (isJson) {
        // If it's a JSON, parse it
        try {
          const parsedValue = JSON.parse(result[0].value);
          
          // PHP returns all numeric values as strings, so we need to ensure
          // all numeric values in the object are converted to strings
          const convertNumericToString = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            
            // Handle array
            if (Array.isArray(obj)) {
              return obj.map(item => convertNumericToString(item));
            }
            
            Object.keys(obj).forEach(key => {
              if (typeof obj[key] === 'number') {
                // Convert numbers to strings to match PHP behavior
                obj[key] = String(obj[key]);
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                // Recursively process nested objects
                obj[key] = convertNumericToString(obj[key]);
              }
            });
            
            return obj;
          };
          
          // Convert all numeric values to strings
          return convertNumericToString(parsedValue);
        } catch (e) {
          console.error(`Error parsing JSON for ${type}:`, e);
          return {};
        }
      } else {
        // Return as string value (exact match to PHP's output_escaping)
        return result[0].value.replace(/\\(.)/g, '$1');
      }
    }
    
    return isJson ? {} : '';
  } catch (error) {
    console.error(`Error in getSettings (${type}):`, error);
    return isJson ? {} : '';
  }
}

/**
 * Get all settings for API response
 * @param {string} type - Type of settings request (all or payment_method)
 * @param {Object} options - Additional options like user_id
 * @returns {Promise<Object>} - Settings data formatted for API response
 */
async function getAllSettings(type = 'all', options = {}) {
  const { user_id } = options;
  let connection;
  
  try {
    connection = await db.getConnection();
    
    // Initialize an ordered response object with PHP field order
    const responseFields = [
      'logo', 'privacy_policy', 'terms_conditions', 'fcm_server_key',
      'contact_us', 'about_us', 'currency', 'time_slot_config',
      'user_data', 'system_settings', 'shipping_method', 'shipping_policy',
      'return_policy', 'tags', 'popup_offer'
    ];
    
    // Initialize response with empty arrays for each field
    const responseData = {};
    responseFields.forEach(field => {
      responseData[field] = [];
    });
    
    // Get all required settings from the database
    const [settingsRows] = await connection.query(
      'SELECT * FROM settings'
    );
    
    // Build a map of all settings for easy access
    const settingsMap = {};
    settingsRows.forEach(row => {
      settingsMap[row.variable] = row.value;
    });
    
    // Define settings and whether they are JSON (matching PHP implementation)
    const settingsConfig = {
      logo: 0,
      privacy_policy: 0,
      terms_conditions: 0,
      fcm_server_key: 0,
      contact_us: 0,
      payment_method: 1,
      about_us: 0,
      currency: 0,
      time_slot_config: 1,
      user_data: 0,
      system_settings: 1,
      shipping_method: 1,
      shipping_policy: 0,
      return_policy: 0,
    };
    
    // Handle payment_method type request
    if (type === 'payment_method') {
      // Get payment method settings
      responseData.payment_method = await getSettings('payment_method', true);
      
      // Get time slot configuration - Following exact PHP logic
      const timeSlotConfig = await getSettings('time_slot_config', true);
      if (timeSlotConfig && Object.keys(timeSlotConfig).length > 0) {
        // Fix delivery_starts_from to match PHP behavior
        // PHP returns the original value, not decremented
        timeSlotConfig.delivery_starts_from = timeSlotConfig.delivery_starts_from 
          ? String(timeSlotConfig.delivery_starts_from) 
          : "0";
          
        // Ensure all values are strings
        Object.keys(timeSlotConfig).forEach(key => {
          if (typeof timeSlotConfig[key] === 'number') {
            timeSlotConfig[key] = String(timeSlotConfig[key]);
          }
        });

        // Add starting_date if not present
        if (!timeSlotConfig.starting_date) {
          timeSlotConfig.starting_date = new Date().toISOString().split('T')[0];
        }
        
        // For payment_method type, time_slot_config should be a direct object, not in an array
        responseData.time_slot_config = timeSlotConfig;
      }
      
      // Get time slots
      try {
      const [timeSlots] = await connection.query(
        'SELECT * FROM time_slots WHERE status = 1 ORDER BY from_time ASC'
      );
      
      // Format time slots to match PHP response (string values)
      let formattedTimeSlots = [];
      if (timeSlots && timeSlots.length > 0) {
        formattedTimeSlots = timeSlots.map(slot => {
          // Convert all number fields to strings to match PHP behavior
          Object.keys(slot).forEach(key => {
            if (typeof slot[key] === 'number') {
              slot[key] = String(slot[key]);
            }
          });
          return slot;
        });
      }
        responseData.time_slots = formattedTimeSlots;
      } catch (error) {
        console.error('Error getting time slots:', error);
        responseData.time_slots = [];
      }
      
      // Set default is_cod_allowed as a number to match PHP
      responseData.is_cod_allowed = 1;
      
      // Add check for user_id to determine if COD is allowed
      if (user_id) {
        try {
          // First check if the is_cod_allowed column exists in the products table
          let codCheckQuery = `
            SELECT 
              COUNT(*) as cart_count, 
              IFNULL(SUM(c.qty), 0) as cart_count_total,
              IFNULL(COUNT(DISTINCT p.id), 0) as product_count
            FROM cart c 
            JOIN product_variants pv ON c.product_variant_id = pv.id 
            JOIN products p ON pv.product_id = p.id 
            WHERE c.user_id = ?
          `;
          
          // Check if is_cod_allowed column exists
          try {
            const [columnsResult] = await connection.query(
              `SHOW COLUMNS FROM products LIKE 'is_cod_allowed'`
            );
            
            // If column exists, include it in the query
            if (columnsResult && columnsResult.length > 0) {
              codCheckQuery = `
                SELECT 
                  COUNT(*) as cart_count, 
                  IFNULL(SUM(c.qty), 0) as cart_count_total, 
             IFNULL(SUM(p.is_cod_allowed), 0) as cod_allowed_count, 
                  IFNULL(COUNT(DISTINCT p.id), 0) as product_count
             FROM cart c 
             JOIN product_variants pv ON c.product_variant_id = pv.id 
             JOIN products p ON pv.product_id = p.id 
                WHERE c.user_id = ?
              `;
            }
          } catch (error) {
            console.error('Error checking if is_cod_allowed column exists:', error);
            // Continue with the default query
          }
          
          // Execute the appropriate query
          const [cartResults] = await connection.query(codCheckQuery, [user_id]);
          
          if (cartResults && cartResults.length > 0) {
            // If the is_cod_allowed field exists and all products allow COD, then COD is allowed
            if (cartResults[0].product_count > 0 && 
                cartResults[0].cod_allowed_count && 
                parseInt(cartResults[0].cod_allowed_count) === parseInt(cartResults[0].product_count)) {
              responseData.is_cod_allowed = 1;
            } else if (cartResults[0].product_count > 0 && cartResults[0].cod_allowed_count) {
              responseData.is_cod_allowed = 0;
            }
          }
        } catch (error) {
          console.error('Error checking COD status:', error);
        }
      }
      
      // Create the final response matching PHP format
      const response = {
        error: false,
        message: "Settings retrieved successfully",
        data: responseData
      };
      
      return response;
    } else if (type === 'all') {
      // Process each field in order
      for (const field of responseFields) {
        if (field === 'tags' || field === 'popup_offer') {
          // These are handled separately later
          continue;
        }
        
        if (field === 'logo') {
          responseData.logo = [await getLogo()];
        } else if (field === 'user_data') {
          if (user_id) {
            const [userData] = await connection.query(
              `SELECT u.*, IFNULL(
                 (SELECT COUNT(*) FROM cart WHERE user_id = u.id), 0
               ) as cart_total_items
               FROM users u WHERE u.id = ?`,
              [user_id]
            );
            
            if (userData && userData.length > 0) {
              // Get user's address if available
              try {
              const [addressData] = await connection.query(
                `SELECT a.*, z.zipcode 
                 FROM addresses a 
                 LEFT JOIN areas ar ON a.area_id = ar.id
                 LEFT JOIN zipcodes z ON ar.zipcode_id = z.id
                 WHERE a.user_id = ? AND a.is_default = 1 LIMIT 1`,
                [user_id]
              );
              
              const user = userData[0];
              
              // Format user data as expected by client
              user.dob = user.dob || '';
              user.referral_code = user.referral_code || '';
              user.friends_code = user.friends_code || '';
              
              // Convert all numeric values to strings to match PHP
              Object.keys(user).forEach(key => {
                if (typeof user[key] === 'number') {
                  user[key] = String(user[key]);
                }
              });
              
              // Add address data if available
              if (addressData && addressData.length > 0) {
                user.cities = addressData[0].city || '';
                user.street = addressData[0].address || '';
                user.area = addressData[0].area || '';
                user.pincode = addressData[0].zipcode || '';
              } else {
                user.cities = '';
                user.street = '';
                user.area = '';
                user.pincode = '';
              }
              
                responseData.user_data = [user];
              } catch (error) {
                console.error('Error getting user address:', error);
                
                // Still return user data without the address details
                const user = userData[0];
                
                // Format user data as expected by client
                user.dob = user.dob || '';
                user.referral_code = user.referral_code || '';
                user.friends_code = user.friends_code || '';
                user.cities = '';
                user.street = '';
                user.area = '';
                user.pincode = '';
                
                // Convert all numeric values to strings
                Object.keys(user).forEach(key => {
                  if (typeof user[key] === 'number') {
                    user[key] = String(user[key]);
                  }
                });
                
                responseData.user_data = [user];
              }
            }
          }
        } else if (field === 'time_slot_config') {
          // Get time slot config - Implementing exact PHP behavior
          const timeSlotConfig = await getSettings('time_slot_config', true);
          
          if (timeSlotConfig && Object.keys(timeSlotConfig).length > 0) {
            // Fix delivery_starts_from to match PHP behavior
            // PHP returns the original value, not decremented
            timeSlotConfig.delivery_starts_from = timeSlotConfig.delivery_starts_from 
              ? String(timeSlotConfig.delivery_starts_from) 
              : "0";
            
            // Ensure all values are strings
            Object.keys(timeSlotConfig).forEach(key => {
              if (typeof timeSlotConfig[key] === 'number') {
                timeSlotConfig[key] = String(timeSlotConfig[key]);
              }
            });

            // Add starting_date if not present
            if (!timeSlotConfig.starting_date) {
              timeSlotConfig.starting_date = new Date().toISOString().split('T')[0];
            }
            
            // PHP wraps time_slot_config in an array
            responseData.time_slot_config = [timeSlotConfig];
          }
          
          // Get time slots
          try {
            const [timeSlots] = await connection.query(
              'SELECT * FROM time_slots WHERE status = 1 ORDER BY from_time ASC'
            );
            
            // Format time slots to match PHP
            let formattedTimeSlots = [];
            if (timeSlots && timeSlots.length > 0) {
              formattedTimeSlots = timeSlots.map(slot => {
                // Convert all number fields to strings to match PHP
                Object.keys(slot).forEach(key => {
                  if (typeof slot[key] === 'number') {
                    slot[key] = String(slot[key]);
                  }
                });
                return slot;
              });
            }
            responseData.time_slots = formattedTimeSlots;
          } catch (error) {
            console.error('Error getting time slots:', error);
            responseData.time_slots = [];
          }
        } else if (field === 'system_settings') {
          // Get system settings (handled specially in PHP)
          const systemSettings = await getSettings('system_settings', true);
          
          // PHP returns system_settings as an array with one object
          if (systemSettings) {
            // Process wallet balance amount if user_id is provided
            if (user_id) {
              // Handle welcome wallet balance (exactly as PHP does)
              if (systemSettings.welcome_wallet_balance_on === "1" && 
                  systemSettings.wallet_balance_amount && 
                  systemSettings.wallet_balance_amount !== '') {
                
                // Add it to the response - exact match to PHP
                systemSettings.wallet_balance_amount = String(systemSettings.wallet_balance_amount);
              } else {
                systemSettings.wallet_balance_amount = "0";
              }
            }
            
            // Convert all boolean values to their string representation
            // PHP sometimes has inconsistent boolean/string representation
            Object.keys(systemSettings).forEach(key => {
              if (typeof systemSettings[key] === 'boolean') {
                systemSettings[key] = systemSettings[key] ? true : false;
              }
            });
            
            // Wrap in array like PHP does
            responseData.system_settings = [systemSettings];
          }
        } else {
          // Handle other regular settings
          const isJson = settingsConfig[field] === 1;
          const value = await getSettings(field, isJson);
          
          if (value) {
            responseData[field] = isJson ? value : [value];
          }
        }
      }
      
      // Handle tags (PHP does this specially)
      try {
        // Check if tags table exists before querying it
        const [tables] = await connection.query(
          `SHOW TABLES LIKE 'tags'`
        );
        
        if (tables && tables.length > 0) {
          const [tags] = await connection.query(
            'SELECT t.* FROM tags t WHERE t.status = 1 ORDER BY t.id DESC'
          );
          
          const formattedTags = tags.map(tag => {
            // Convert all numeric values to strings
            Object.keys(tag).forEach(key => {
              if (typeof tag[key] === 'number') {
                tag[key] = String(tag[key]);
              }
            });
            return tag;
          });
          
          responseData.tags = formattedTags;
        } else {
          // If tags table doesn't exist, use alternative approach
          // Get tags from products table
        const [products] = await connection.query(
          `SELECT tags FROM products WHERE tags IS NOT NULL AND tags <> '' LIMIT 30`
        );
        
          let uniqueTags = [];
        if (products && products.length > 0) {
            // Extract tags from products
          for (const product of products) {
            if (product.tags) {
              try {
                  // If tags is stored as JSON
                  const productTags = JSON.parse(product.tags);
                  uniqueTags = [...new Set([...uniqueTags, ...productTags])];
              } catch (e) {
                // If not valid JSON, split by commas
                  const tagArray = product.tags.split(',').map(tag => tag.trim());
                  uniqueTags = [...new Set([...uniqueTags, ...tagArray])];
                }
              }
            }
          }
          
          // In PHP response, tags are just strings without property names
          responseData.tags = uniqueTags.map(tag => tag);
        }
      } catch (error) {
        console.error('Error getting tags:', error);
        responseData.tags = [];
      }
      
      // Get popup offer if it exists
      try {
        // Check if popup_offers table exists
        const [tables] = await connection.query(
          `SHOW TABLES LIKE 'popup_offers'`
        );
        
        if (tables && tables.length > 0) {
          const [popupOffers] = await connection.query(
            'SELECT * FROM popup_offers WHERE status = 1 ORDER BY id DESC LIMIT 1'
          );
          
          if (popupOffers && popupOffers.length > 0) {
            let offer = popupOffers[0];
            let offerData = [];
            
            // Get related category/product data based on offer type
            if (offer.type && offer.type_id) {
              if (offer.type.toLowerCase() === 'categories') {
                // Get category data
                try {
                  const [categoryData] = await connection.query(
                    `SELECT * FROM categories WHERE id = ?`,
                    [offer.type_id]
                  );
                  
                  if (categoryData && categoryData.length > 0) {
                    // Format category data to match PHP response
                    const formattedCategory = {
                      id: categoryData[0].id.toString(),
                      name: categoryData[0].name,
                      parent_id: categoryData[0].parent_id.toString(),
                      slug: categoryData[0].slug,
                      image: helpers.getImageUrl(categoryData[0].image),
                      banner: categoryData[0].banner ? helpers.getImageUrl(categoryData[0].banner) : "",
                      row_order: categoryData[0].row_order.toString(),
                      status: categoryData[0].status.toString(),
                      clicks: (categoryData[0].clicks || "0").toString(),
                      city: (categoryData[0].city || "").toString(),
                      children: [],
                      text: categoryData[0].name,
                      state: {
                        opened: true
                      },
                      icon: "jstree-folder",
                      level: 0,
                      total: "0"
                    };
                    
                    // Add clicks count if found in table
                    try {
                      const [clicksData] = await connection.query(
                        `SELECT COUNT(*) as total FROM products WHERE category_id = ?`,
                        [offer.type_id]
                      );
                      
                      if (clicksData && clicksData.length > 0) {
                        formattedCategory.total = clicksData[0].total.toString();
                      }
                    } catch (err) {
                      console.error("Error counting category products:", err);
                    }
                    
                    offerData = [formattedCategory];
                  }
                } catch (err) {
                  console.error("Error getting category data for popup offer:", err);
                }
              } else if (offer.type.toLowerCase() === 'products') {
                // Get product data
                try {
                  const [productData] = await connection.query(
                    `SELECT p.* FROM products p WHERE p.id = ?`,
                    [offer.type_id]
                  );
                  
                  if (productData && productData.length > 0) {
                    // Format the product data similar to PHP's fetch_product function
                    // For simplicity, we'll just include the basic product details
                    const formattedProduct = {};
                    
                    // Convert all fields to strings and format
                    Object.keys(productData[0]).forEach(key => {
                      if (key === 'image' || key === 'other_images') {
                        // Handle images specially
                        formattedProduct[key] = helpers.getImageUrl(productData[0][key]);
                      } else {
                        // Convert everything else to string
                        formattedProduct[key] = productData[0][key] !== null ? String(productData[0][key]) : "";
                      }
                    });
                    
                    offerData = [formattedProduct];
                  }
                } catch (err) {
                  console.error("Error getting product data for popup offer:", err);
                }
              }
            }
            
            // Format the popup offer to match PHP response
            const systemSettings = await getSettings('system_settings', true);
            
            const popupOffer = {
              id: offer.id.toString(),
              is_active: (systemSettings && systemSettings.is_offer_popup_on === "1") ? "1" : "0",
              show_multiple_time: (systemSettings && systemSettings.offer_popup_method === "refresh") ? "1" : "0",
              image: helpers.getImageUrl(offer.image),
              type: offer.type,
              type_id: offer.type_id.toString(),
              min_discount: (offer.min_discount !== null) ? String(offer.min_discount) : "0",
              max_discount: (offer.max_discount !== null) ? String(offer.max_discount) : "0",
              link: offer.link || "",
              date_added: offer.date_added ? new Date(offer.date_added).toISOString().slice(0, 19).replace('T', ' ') : "",
              data: offerData
            };
            
            responseData.popup_offer = [popupOffer];
          } else {
            // No active popup offers
            responseData.popup_offer = [];
          }
        } else {
          // Table doesn't exist
          responseData.popup_offer = [];
        }
      } catch (error) {
        console.error('Error getting popup offers:', error);
        responseData.popup_offer = [];
      }
      
      // Create the final response matching PHP format
      const response = {
        error: false,
        message: "Settings retrieved successfully",
        data: responseData
      };
      
      return response;
    }
    
    // Return empty response for unknown type
    return {
      error: false,
      message: "Settings retrieved successfully",
      data: {}
    };
  } catch (error) {
    console.error(`Error in getAllSettings:`, error);
    return {
      error: true,
      message: "Error retrieving settings",
      data: {}
    };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * Get logo settings (matches PHP implementation)
 * @returns {Promise<Object>} - Logo data
 */
async function getLogo() {
  try {
    console.log('getLogo: Starting to retrieve logo from database');
    const connection = await db.getConnection();
    console.log('getLogo: Database connection established');
    
    const [result] = await connection.query(
      'SELECT * FROM settings WHERE variable = ?',
      ['logo']
    );
    console.log('getLogo: Query completed, result:', JSON.stringify(result));
    connection.release();
    
    if (result && result.length > 0) {
      console.log('getLogo: Logo found in database:', result[0].value);
      try {
        const imageUrl = helpers.getImageUrl(result[0].value);
        console.log('getLogo: Generated image URL:', imageUrl);
        
        return {
          is_null: "0",
          value: imageUrl
        };
      } catch (error) {
        console.error('getLogo: Error in getImageUrl:', error);
        // Fallback to a direct URL without using getImageUrl
        const baseUrl = 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/';
        let fullPath = result[0].value;
        if (!fullPath.startsWith('uploads/')) {
          fullPath = `uploads/${fullPath}`;
    }
    
    return { 
          is_null: "0",
          value: `${baseUrl}${fullPath}`
        };
      }
    } else {
      console.log('getLogo: No logo found in database, using default');
      const defaultImg = config.DEFAULT_IMAGE || 'uploads/media/2022/default_image.png';
      console.log('getLogo: Default image path:', defaultImg);
      
      try {
        const imageUrl = helpers.getImageUrl(defaultImg);
        console.log('getLogo: Generated default image URL:', imageUrl);
        
        return {
          is_null: "1",
          value: imageUrl
        };
      } catch (error) {
        console.error('getLogo: Error in getImageUrl for default:', error);
        // Fallback to a direct URL without using getImageUrl
        const baseUrl = 'https://uzvisimages.blr1.cdn.digitaloceanspaces.com/';
        return {
          is_null: "1",
          value: `${baseUrl}${defaultImg}`
        };
      }
    }
  } catch (error) {
    console.error('getLogo: Database error:', error);
    // Return a fallback for errors
    const defaultImg = config.DEFAULT_IMAGE || 'uploads/media/2022/default_image.png';
    return {
      is_null: "1",
      value: `https://uzvisimages.blr1.cdn.digitaloceanspaces.com/${defaultImg}`
    };
  }
}

/**
 * Get popup offers data
 * @param {Object} connection - Database connection
 * @returns {Promise<Object|null>} - Popup offer data or null if not found
 */
async function getPopupOffers(connection) {
  try {
    // First, check if the table exists
    console.log("Checking for popup_offers table...");
    const [tableCheck] = await connection.query(
      `SHOW TABLES LIKE 'popup_offers'`
    );
    
    console.log("popup_offers table check result:", JSON.stringify(tableCheck));
    
    if (tableCheck && tableCheck.length > 0) {
      console.log("popup_offers table exists, checking columns...");
      
      // Get column info to ensure we're querying the right schema
      const [columnsInfo] = await connection.query(
        `SHOW COLUMNS FROM popup_offers`
      );
      
      const columns = columnsInfo.map(col => col.Field);
      console.log("popup_offers columns:", JSON.stringify(columns));
      
      // Query active popup offers
      console.log("Executing popup_offers query: SELECT * FROM popup_offers WHERE status = 1 ORDER BY id DESC LIMIT 1");
      const [offerResults] = await connection.query(
        `SELECT * FROM popup_offers WHERE status = 1 ORDER BY id DESC LIMIT 1`
      );
      
      console.log("Popup offer query result length:", offerResults.length);
      
      if (offerResults && offerResults.length > 0) {
        const offer = offerResults[0];
        console.log("Popup offer raw result:", JSON.stringify(offerResults));
        console.log("Found popup offer with id:", offer.id);
        console.log("Full offer data:", JSON.stringify(offer));
        
        // Initialize offer data
        let offerData = [];
        
        // Get related data based on offer type
        if (offer.type && offer.type_id) {
          if (offer.type.toLowerCase() === 'categories') {
            console.log("This is a category type offer, checking for categories table...");
            
            // Check if categories table exists
            const [catTableCheck] = await connection.query(
              `SHOW TABLES LIKE 'categories'`
            );
            
            console.log("categories table exists:", catTableCheck.length > 0);
            
            if (catTableCheck && catTableCheck.length > 0) {
              const [categoryData] = await connection.query(
                `SELECT * FROM categories WHERE id = ?`,
                [offer.type_id]
              );
              
              if (categoryData && categoryData.length > 0) {
                offerData = categoryData;
              }
            }
          } else if (offer.type.toLowerCase() === 'products') {
            console.log("This is a product type offer, checking for products table...");
            
            // Check if products table exists
            const [prodTableCheck] = await connection.query(
              `SHOW TABLES LIKE 'products'`
            );
            
            console.log("products table exists:", prodTableCheck.length > 0);
            
            if (prodTableCheck && prodTableCheck.length > 0) {
              // Get product details
              const [productData] = await connection.query(
                `SELECT p.*, 
                  (SELECT COUNT(*) FROM order_items oi JOIN product_variants pv ON oi.product_variant_id = pv.id WHERE pv.product_id = p.id) as sales,
                  (SELECT SUM(pv.stock) FROM product_variants pv WHERE pv.product_id = p.id) as stock
                FROM products p WHERE p.id = ?`,
                [offer.type_id]
              );
              
              console.log("Fetching product with id:", offer.type_id);
              console.log("Product query result length:", productData.length);
              
              if (productData && productData.length > 0) {
                console.log("Found product:", productData[0].name);
                
                // Get product attributes
                try {
                  const [productAttributes] = await connection.query(
                    `SELECT pa.id, pa.attribute_set, pa.attribute, pa.attribute_values 
                     FROM product_attributes pa WHERE pa.product_id = ?`,
                    [offer.type_id]
                  );
                  
                  productData[0].attributes = productAttributes || [];
                } catch (error) {
                  console.error("Error getting product attributes:", error.message);
                  productData[0].attributes = [];
                }
                
                // Get product variants
                const [variantData] = await connection.query(
                  `SELECT pv.* FROM product_variants pv WHERE pv.product_id = ?`,
                  [offer.type_id]
                );
                
                productData[0].variants = variantData || [];
                
                // Format image URLs
                if (productData[0].image) {
                  productData[0].image = helpers.getImageUrl(productData[0].image);
                }
                
                // Also handle other_images if available
                if (productData[0].other_images) {
                  try {
                    let otherImages = [];
                    if (typeof productData[0].other_images === 'string') {
                      otherImages = JSON.parse(productData[0].other_images);
                    } else if (Array.isArray(productData[0].other_images)) {
                      otherImages = productData[0].other_images;
                    }
                    
                    // Process each image URL
                    if (Array.isArray(otherImages)) {
                      otherImages = otherImages.map(img => helpers.getImageUrl(img));
                      productData[0].other_images = otherImages;
                    }
                  } catch (e) {
                    console.error("Error processing product other_images:", e.message);
                  }
                }
                
                offerData = productData;
              }
            }
          } else if (offer.type.toLowerCase() === 'brand') {
            console.log("This is a brand type offer, checking for brands table...");
            
            // Check if brands table exists
            const [brandTableCheck] = await connection.query(
              `SHOW TABLES LIKE 'brands'`
            );
            
            console.log("brands table exists:", brandTableCheck.length > 0);
            
            if (brandTableCheck && brandTableCheck.length > 0) {
              const [brandData] = await connection.query(
                `SELECT id, name FROM brands WHERE id = ?`,
                [offer.type_id]
              );
              
              if (brandData && brandData.length > 0) {
                offerData = brandData;
              }
            }
          }
        }
        
        // Get system settings to check if offer popup is enabled
        const systemSettings = await getSettings('system_settings', true);
        
        // Create popup offer object matching PHP structure
        const popupOffer = {
          id: offer.id.toString(),
          is_active: (systemSettings && systemSettings.is_offer_popup_on === '1') ? '1' : '0',
          show_multiple_time: (systemSettings && systemSettings.offer_popup_method === 'refresh') ? '1' : '0',
          image: offer.image.startsWith('http') ? offer.image : `https://uzvisimages.blr1.cdn.digitaloceanspaces.com/${offer.image}`,
          type: offer.type,
          type_id: offer.type_id.toString(),
          min_discount: offer.min_discount.toString(),
          max_discount: offer.max_discount.toString(),
          link: offer.link || '',
          date_added: new Date(offer.date_added).toISOString().replace('T', ' ').substring(0, 19),
          data: offerData
        };
        
        console.log("Final popup_offer in response:", JSON.stringify([popupOffer]));
        return popupOffer;
      }
    } else {
      console.log("popup_offers table does not exist");
    }
    
    return null;
  } catch (error) {
    console.error('Error processing popup offers:', error);
    return null;
  }
}

module.exports = {
  getSettings,
  getAllSettings,
  getLogo,
  getPopupOffers
}; 