/**
 * Script to find all console.log statements in the codebase
 * Run with: node scripts/clean-logs.js
 */

const fs = require('fs');
const path = require('path');
const util = require('util');
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

// Directories to exclude from scanning
const EXCLUDED_DIRS = ['node_modules', 'public', 'scripts', 'tests'];

// Pattern to match console statements
const CONSOLE_PATTERN = /console\.(log|error|warn|info|debug)/g;

// Files to exclude from cleaning (keep logs)
const EXCLUDED_FILES = ['tests/cart.test.js'];

// Function to check if path should be excluded
function isExcluded(filePath) {
  return EXCLUDED_DIRS.some(dir => filePath.includes(dir)) ||
         EXCLUDED_FILES.some(file => filePath.endsWith(file));
}

// Function to scan directories recursively
async function scanDirectory(dir) {
  const results = [];
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (isExcluded(fullPath)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      results.push(...await scanDirectory(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  
  return results;
}

// Function to check file for console statements
async function findConsoleStatements(filePath) {
  const content = await readFile(filePath, 'utf8');
  const matches = content.match(CONSOLE_PATTERN);
  
  if (matches && matches.length > 0) {
    return {
      file: filePath,
      count: matches.length,
      content
    };
  }
  
  return null;
}

// Function to clean console statements from a file
async function cleanConsoleStatements(file) {
  const { file: filePath, content } = file;
  
  // Replace all lines containing console statements with empty lines
  const cleanedContent = content.replace(/^.*console\.(log|error|warn|info|debug).*$\n?/gm, '');
  
  // Write cleaned content back to file
  await writeFile(filePath, cleanedContent, 'utf8');
  
  return filePath;
}

// Main function
async function main() {
  try {
    // Check if run directory is nodejs
    const currentDir = process.cwd();
    const baseDir = path.basename(currentDir);
    
    // Determine the root directory
    const rootDir = baseDir === 'nodejs' ? currentDir : path.join(currentDir, 'nodejs');
    
    // Check if directory exists
    try {
      await stat(rootDir);
    } catch (error) {
      console.error(`Directory not found: ${rootDir}`);
      console.log('Please run this script from the root of the Node.js project');
      process.exit(1);
    }
    
    console.log(`Scanning ${rootDir} for console statements...`);
    
    // Get all JS files
    const files = await scanDirectory(rootDir);
    console.log(`Found ${files.length} JavaScript files`);
    
    // Check each file for console statements
    const results = await Promise.all(files.map(findConsoleStatements));
    const filesWithConsole = results.filter(Boolean);
    
    if (filesWithConsole.length === 0) {
      console.log('No console statements found in the codebase!');
      return;
    }
    
    console.log(`Found ${filesWithConsole.length} files with console statements:`);
    
    // Display files with console statements
    filesWithConsole.forEach(file => {
      console.log(`- ${file.file}: ${file.count} console statements`);
    });
    
    // Ask to clean up
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Do you want to clean up these console statements? (y/n) ', async (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        // Clean up console statements
        const cleanedFiles = await Promise.all(filesWithConsole.map(cleanConsoleStatements));
        console.log(`Cleaned ${cleanedFiles.length} files`);
      } else {
        console.log('No files were modified');
      }
      
      readline.close();
    });
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 