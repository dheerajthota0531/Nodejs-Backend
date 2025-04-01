const pool = require('../config/database');
const { outputEscaping, getImageUrl } = require('../helpers/functions');
const config = require('../config/config');

/**
 * Get categories from the database
 * @param {number|null} id - Category ID (optional)
 * @param {number|string} limit - Limit for results (optional)
 * @param {number|string} offset - Offset for results (optional)
 * @param {string} sort - Sort field (optional)
 * @param {string} order - Sort order (optional)
 * @param {string} hasChildOrItem - Whether to include categories with children or items (optional)
 * @param {string} slug - Category slug (optional)
 * @param {number|string} ignoreStatus - Whether to ignore status (optional)
 * @param {string} city - Filter by city (optional)
 * @returns {Promise<Array>} - The categories
 */
async function getCategories(id = null, limit = '', offset = '', sort = 'row_order', order = 'ASC', hasChildOrItem = 'true', slug = '', ignoreStatus = '', city = '') {
  try {
    const connection = await pool.getConnection();
    
    let where;
    if (ignoreStatus == 1) {
      where = id ? { 'c1.id': id } : { 'c1.parent_id': 0 };
    } else {
      where = id ? { 'c1.id': id, 'c1.status': 1 } : { 'c1.parent_id': 0, 'c1.status': 1 };
    }
    
    // Build the SQL query - start with the SELECT and FROM parts
    let sql = 'SELECT c1.* FROM categories c1';
    const params = [];
    
    // Add JOIN clauses if hasChildOrItem is false
    if (hasChildOrItem === 'false') {
      sql += ` LEFT JOIN categories c2 ON c2.parent_id = c1.id`;
      sql += ` LEFT JOIN products p ON p.category_id = c1.id`;
    }
    
    // Now add the WHERE clause
    sql += ' WHERE ';
    const whereConditions = [];
    
    // Add where conditions
    for (const key in where) {
      whereConditions.push(`${key} = ?`);
      params.push(where[key]);
    }
    
    sql += whereConditions.join(' AND ');
    
    // Add slug condition if provided
    if (slug) {
      sql += ' AND c1.slug = ?';
      params.push(slug);
    }
    
    // Add city filter if provided (matching PHP implementation)
    if (city) {
      sql += ` AND FIND_IN_SET(?, c1.city) > 0`;
      params.push(city);
    }
    
    // Add additional WHERE conditions for hasChildOrItem = false
    if (hasChildOrItem === 'false') {
      // Use proper SQL syntax for the condition
      sql += ` AND (c1.id = p.category_id OR c2.parent_id = c1.id)`;
    }
    
    // Add GROUP BY if needed
    if (hasChildOrItem === 'false') {
      sql += ` GROUP BY c1.id`; // Add GROUP BY clause
    }
    
    // Add order by (BEFORE limit)
    if (sort && order) {
      // Ensure sort field is properly formatted with table prefix if needed
      const formattedSort = sort.includes('.') ? sort : `c1.${sort}`;
      sql += ` ORDER BY ${formattedSort} ${order}`;
      
      // Add secondary sort for stable ordering if not already sorting by id
      if (!formattedSort.includes('id')) {
        sql += `, c1.id ASC`;
      }
    }
    
    // Add limit and offset if provided (AFTER order by)
    // In MySQL, LIMIT takes offset and row_count as separate values
    if (limit || offset) {
      // Convert to numbers and use directly in the SQL query
      const numOffset = parseInt(offset) || 0;
      const numLimit = parseInt(limit) || 25;
      sql += ` LIMIT ${numOffset}, ${numLimit}`;
    }
    
    console.log('SQL Query:', sql);
    console.log('Params:', params);
    
    // Execute the query
    const [rows] = await connection.execute(sql, params);
    
    // Get the total count with the same approach as PHP (count_all_results)
    // This matches PHP's $this->db->count_all_results('categories c1');
    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM categories');
    const count = countResult[0].total;
    
    // Process the results
    const categories = [];
    let i = 0;
    
    // Get the base URL for images from config
    const baseUrl = config.baseUrl || process.env.BASE_URL || 'https://dev.uzvi.in/';
    const mediaPath = config.mediaPath || 'uploads/media/2024/';
    const defaultImage = config.defaultCategoryImage || 'vegetables.png';
    
    for (const category of rows) {
      const children = await getSubCategories(category.id, 0, connection, baseUrl, mediaPath, defaultImage);
      
      // Create a new object with string values for all numeric fields
      const stringifiedCategory = {};
      Object.keys(category).forEach(key => {
        if (typeof category[key] === 'number') {
          stringifiedCategory[key] = String(category[key]);
        } else {
          stringifiedCategory[key] = category[key];
        }
      });
      
      categories[i] = {
        ...stringifiedCategory,
        children,
        text: outputEscaping(category.name?.replace(/\\r\\n/g, '&#13;&#10;')),
        name: outputEscaping(category.name?.replace(/\\r\\n/g, '&#13;&#10;')),
        state: { opened: true },
        // Only add icon to top-level categories
        icon: "jstree-folder",
        level: 0,
        image: getImageUrl(category.image, 'thumb', 'sm'),
        banner: category.banner ? getImageUrl(category.banner) : baseUrl
      };
      
      i++;
    }
    
    // Add total to the first category if it exists
    if (categories.length > 0) {
      categories[0].total = count;
    }
    
    connection.release();
    
    // Convert to the same format as PHP
    return JSON.parse(JSON.stringify(categories));
  } catch (error) {
    console.error('Error in getCategories:', error);
    throw error;
  }
}

/**
 * Get subcategories for a category
 * @param {number} id - Parent category ID
 * @param {number} level - Current level
 * @param {object} connection - Database connection
 * @param {string} baseUrl - Base URL for images
 * @param {string} mediaPath - Media path for images
 * @param {string} defaultImage - Default image if not found
 * @returns {Promise<Array>} - The subcategories
 */
async function getSubCategories(id, level, connection, baseUrl, mediaPath, defaultImage) {
  try {
    level = level + 1;
    
    // Build the SQL query
    const sql = 'SELECT c1.* FROM categories c1 WHERE c1.parent_id = ? AND c1.status = 1';
    
    // Execute the query
    const [rows] = await connection.execute(sql, [id]);
    
    // Process the results
    const categories = [];
    let i = 0;
    
    for (const category of rows) {
      // Create a new object with string values for all numeric fields
      const stringifiedCategory = {};
      Object.keys(category).forEach(key => {
        if (typeof category[key] === 'number') {
          stringifiedCategory[key] = String(category[key]);
        } else {
          stringifiedCategory[key] = category[key];
        }
      });
      
      const children = await getSubCategories(category.id, level, connection, baseUrl, mediaPath, defaultImage);
      
      categories[i] = {
        ...stringifiedCategory,
        children,
        text: outputEscaping(category.name?.replace(/\\r\\n/g, '&#13;&#10;')),
        name: outputEscaping(category.name?.replace(/\\r\\n/g, '&#13;&#10;')),
        state: { opened: true },
        level,
        image: getImageUrl(category.image, 'thumb', 'md'),
        banner: category.banner ? getImageUrl(category.banner) : baseUrl
      };
      
      i++;
    }
    
    return categories;
  } catch (error) {
    console.error('Error in getSubCategories:', error);
    throw error;
  }
}

/**
 * Get a category by ID
 * @param {number} categoryId - Category ID
 * @returns {Promise<Object>} - Category object
 */
async function getCategoryById(categoryId) {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Get category details
    const [categoryResult] = await connection.query(
      'SELECT * FROM categories WHERE id = ?',
      [categoryId]
    );
    
    if (categoryResult.length === 0) {
      return null;
    }
    
    const category = categoryResult[0];
    
    // Format image URLs
    category.image = getImageUrl(category.image, 'thumb', 'sm');
    category.banner = getImageUrl(category.banner, 'thumb', 'sm');
    
    return category;
  } catch (error) {
    console.error('Error getting category by ID:', error);
    return null;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  getCategories,
  getCategoryById
};