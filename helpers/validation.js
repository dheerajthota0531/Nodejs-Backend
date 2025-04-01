/**
 * Validation helper
 * Mimics CodeIgniter's form validation functionality from PHP
 */

/**
 * Validate data against rules
 * @param {Object} data - Data to validate
 * @param {Object} rules - Validation rules
 * @returns {Object} - Validation result
 */
function validate(data, rules) {
  const errors = [];
  
  Object.keys(rules).forEach(field => {
    const ruleString = rules[field];
    const rulesList = ruleString.split('|');
    
    // Apply each rule to the field
    rulesList.forEach(rule => {
      if (rule === 'required') {
        if (!data[field] && data[field] !== 0) {
          errors.push(`The ${field} field is required.`);
        }
      }
      
      if (rule === 'numeric') {
        if (data[field] && isNaN(data[field])) {
          errors.push(`The ${field} field must be numeric.`);
        }
      }
      
      if (rule === 'valid_email') {
        if (data[field]) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(data[field])) {
            errors.push(`The ${field} field must contain a valid email address.`);
          }
        }
      }
      
      // Add more validation rules as needed
    });
  });
  
  if (errors.length > 0) {
    return {
      error: true,
      message: errors.join(' '),
      errors: errors
    };
  }
  
  return {
    error: false,
    message: 'Validation passed'
  };
}

/**
 * Sanitize input data
 * @param {any} data - Data to sanitize
 * @returns {any} - Sanitized data
 */
function sanitize(data) {
  if (typeof data === 'string') {
    // Basic XSS protection
    return data
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  } else if (typeof data === 'object' && data !== null) {
    // If it's an object, recursively sanitize all properties
    if (Array.isArray(data)) {
      return data.map(item => sanitize(item));
    } else {
      const result = {};
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          result[key] = sanitize(data[key]);
        }
      }
      return result;
    }
  }
  
  // Return primitive values as is
  return data;
}

module.exports = {
  validate,
  sanitize
}; 