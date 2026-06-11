const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

// Log unexpected errors on idle clients to prevent silent crashes
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

module.exports = pool;
