# Scripts

This directory contains utility scripts for the e-commerce Node.js API project.

## Available Scripts

### `clean-logs.js`

This script scans the codebase for console log statements and helps clean them up for production deployment.

**Usage:**

```
npm run clean-logs
```

The script will:

1. Scan all JavaScript files in the project (excluding test files and node_modules)
2. Identify files containing console.log, console.error, and other console statements
3. Prompt to remove these statements from the codebase
4. Clean up the files if confirmed

### `verify-cart-routes.js`

This script tests all cart-related API endpoints to verify they are working correctly.

**Usage:**

```
npm run verify-cart
```

The script will:

1. Check if the server is running
2. Test each cart endpoint:
   - `get_user_cart`
   - `get_cart`
   - `manage_cart` (add item)
   - `remove_from_cart`
3. Display a summary of successful and failed tests
4. Save detailed results to a JSON file

**Notes:**

- The server must be running before executing this script
- You may need to update the USER_ID and product_variant_id values in the script to match your database

## Adding New Scripts

When adding new utility scripts to this directory:

1. Create your script file with a descriptive name
2. Add appropriate documentation at the top of the file
3. Update package.json with a script entry
4. Update this README.md with details about the script
