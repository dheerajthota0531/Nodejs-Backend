const productModel = require('../models/product.model');
const { formatResponse } = require('../helpers/functions');

/**
 * Get products with filters
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>} - Promise representing the completion of the request
 */
async function getProducts(req, res) {
  try {
    // Extract parameters from request body with appropriate defaults and validation
    const {
      id: rawId,
      product_ids: rawProductIds,
      product_variant_ids,
      search,
      category_id: rawCategoryId,
      user_id: rawUserId,
      tags,
      attribute_value_ids,
      sort = 'p.row_order',
      limit = 25,
      offset = 0,
      order = 'ASC',
      is_similar_products,
      top_rated_product,
      min_price,
      max_price,
      discount,
      min_discount,
      max_discount,
      brand_id,
      product_type,
      city,
      zipcode_id,
      show_only_stock_product,
      flag,
    } = req.body;

    // Process parameters correctly
    const id = rawId && rawId !== '0' ? rawId : null;
    const product_ids = rawProductIds && rawProductIds !== '0' ? rawProductIds : null;
    const category_id = rawCategoryId && rawCategoryId !== '0' ? rawCategoryId : null;
    const user_id = rawUserId && rawUserId !== '0' ? rawUserId : null;

    // Log parameter processing
    console.log(`Processing parameters - id: ${id}, product_ids: ${product_ids}, category_id: ${category_id}`);

    // Validate sort and order parameters
    let validatedSort = sort || 'p.row_order';

    // Handle special cases for sort fields
    if (validatedSort === 'id') {
      validatedSort = 'p.id';
    } else if (validatedSort === 'price') {
      validatedSort = 'pv.price';
    } else if (validatedSort === 'date_added') {
      validatedSort = 'p.date_added';
    } else if (validatedSort === 'name') {
      validatedSort = 'p.name';
    } else if (validatedSort === 'row_order') {
      validatedSort = 'p.row_order';
    } else if (validatedSort === 'rating') {
      validatedSort = 'p.rating';
    } else if (validatedSort === 'sales') {
      // Special case for sales sorting - the logic is handled in the model
      validatedSort = 'p.sales';
    } else if (validatedSort === 'discount') {
      // Sort by discount percentage
      validatedSort = 'discount_percentage';
    }

    // Validate order parameter (must be ASC or DESC)
    let validatedOrder = (order && ['ASC', 'DESC'].includes(order.toUpperCase()))
      ? order.toUpperCase()
      : 'ASC';

    // Log the sort and order parameters for debugging
    console.log(`Product Controller - Sort parameter: ${validatedSort}, Order parameter: ${validatedOrder}`);

    // Log attribute filters for debugging
    if (attribute_value_ids) {
      console.log('Product Controller - Received attribute_value_ids:', attribute_value_ids);
      console.log('Type of attribute_value_ids:', typeof attribute_value_ids);
    }

    // Create filters object similar to PHP implementation
    const filters = {
      search: search || '',
      tags: tags || '',
      discount: discount || 0,
      min_discount: min_discount || 0,
      max_discount: max_discount || 0,
      attribute_value_ids: attribute_value_ids || null,
      is_similar_products: is_similar_products || null,
      brand_id: brand_id || 0,
      product_type: top_rated_product === 1 ? 'top_rated_product_including_all_products' : product_type || null,
      min_price: min_price || 0,
      max_price: max_price || 0,
      city: city || null,
      zipcode_id: zipcode_id || null,
      show_only_stock_product: show_only_stock_product || null,
      flag: flag || null,
    };

    // Process product_variant_ids if provided
    if (product_variant_ids) {
      filters.product_variant_ids = product_variant_ids.toString().split(',');
    }

    // Get products from model with all parameters
    const result = await productModel.getProducts({
      id,
      category_id,
      user_id,
      product_ids,
      ...filters,
      limit,
      offset,
      sort: validatedSort,
      order: validatedOrder,
    });

    // Log min/max prices for debugging
    console.log(`Products response: min_price=${result.min_price}, max_price=${result.max_price}`);

    // Send response directly
    res.json(result);
  } catch (error) {
    console.error('Error in getProducts controller:', error);
    res.status(500).json(formatResponse(
      true,
      error.message || 'Failed to retrieve products',
      [],
      {}
    ));
  }
}

module.exports = {
  getProducts
}; 