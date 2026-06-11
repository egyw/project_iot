require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function setupDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[DB Setup] DATABASE_URL is not set in .env');
    return;
  }

  // Parse the database URL to get connection details
  const parsedUrl = new URL(dbUrl);
  const targetDbName = parsedUrl.pathname.replace('/', '');
  
  // Connect to the default 'postgres' database first to create our target database
  const defaultUrl = dbUrl.replace(`/${targetDbName}`, '/postgres');
  const initPool = new Pool({ connectionString: defaultUrl });

  try {
    console.log(`[DB Setup] Checking if database "${targetDbName}" exists...`);
    const initClient = await initPool.connect();
    const res = await initClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDbName]);
    
    if (res.rowCount === 0) {
      console.log(`[DB Setup] Database "${targetDbName}" not found. Creating it...`);
      await initClient.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`[DB Setup] Database "${targetDbName}" created successfully.`);
    } else {
      console.log(`[DB Setup] Database "${targetDbName}" already exists.`);
    }
    initClient.release();
  } catch (error) {
    console.error('[DB Setup] Error checking/creating database:', error.message);
    return;
  } finally {
    await initPool.end();
  }

  // Now connect to the target database to run schema and seed
  const pool = new Pool({ connectionString: dbUrl });
  try {
    console.log(`[DB Setup] Connecting to database "${targetDbName}"...`);
    const client = await pool.connect();

    console.log('[DB Setup] Reading schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

    console.log('[DB Setup] Executing schema.sql...');
    await client.query(schemaSql);
    console.log('[DB Setup] Schema execution successful.');

    console.log('[DB Setup] Reading seed.sql...');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');

    console.log('[DB Setup] Executing seed.sql...');
    await client.query(seedSql);
    console.log('[DB Setup] Seed execution successful.');

    client.release();
    console.log('[DB Setup] Database setup completed successfully!');
  } catch (error) {
    console.error('[DB Setup] Error during database setup:', error.message);
  } finally {
    await pool.end();
  }
}

setupDatabase();
