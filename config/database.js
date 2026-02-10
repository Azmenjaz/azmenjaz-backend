const { Pool } = require('pg');
require('dotenv').config();

const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl.replace('postgresql://', 'postgres://');

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error details:', err.message);
  } else {
    console.log('✅ Database connected successfully to:', pool.options.host || 'remote host');
    release();
  }
});

module.exports = pool;
