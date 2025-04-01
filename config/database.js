const mysql = require('mysql2/promise');

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',           // Remote host
  user: process.env.DB_USER || 'root',                // Remote username
  password: process.env.DB_PASSWORD || 'root',        // Remote password
  database: process.env.DB_NAME || 'uzvis_prod',  // Remote database name
  port: process.env.DB_PORT || 3306,                  // Remote port (default: 3306)
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // Connection retry settings
  connectTimeout: 10000, // 10 seconds
  
  // SSL/TLS settings if needed
  ssl: process.env.DB_SSL === 'true' ? {
    // SSL configuration
    rejectUnauthorized: false // Set to true in production with proper certificates
  } : false
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection was closed.');
  }
  if (err.code === 'ER_CON_COUNT_ERROR') {
    console.error('Database has too many connections.');
  }
  if (err.code === 'ECONNREFUSED') {
    console.error('Database connection was refused.');
  }
});

module.exports = pool; 