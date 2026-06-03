require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
const DATA_FILE = path.join(__dirname, 'data', 'households.json');

async function runMigration() {
  console.log('--- Starting Supabase PostgreSQL Data Migration ---');

  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL or SUPABASE_DATABASE_URL environment variable is not defined.');
    console.error('Please create a .env file with DATABASE_URL=your_connection_string or set it in your environment.');
    process.exit(1);
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.log(`No local database file found at ${DATA_FILE}. Nothing to migrate.`);
    process.exit(0);
  }

  let localRecords = [];
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    localRecords = JSON.parse(data);
  } catch (err) {
    console.error('ERROR reading local households.json file:', err);
    process.exit(1);
  }

  if (!Array.isArray(localRecords) || localRecords.length === 0) {
    console.log('Local households.json is empty. No records to migrate.');
    process.exit(0);
  }

  console.log(`Found ${localRecords.length} local records to migrate.`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client;
  try {
    console.log('Connecting to Supabase PostgreSQL...');
    client = await pool.connect();
    console.log('Connected successfully!');

    console.log('Beginning transaction & setting up table...');
    await client.query('BEGIN');

    // Create table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Migrating records (using upsert)...');
    let upsertedCount = 0;
    
    for (const record of localRecords) {
      await client.query(
        'INSERT INTO households (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
        [record.id, JSON.stringify(record)]
      );
      upsertedCount++;
    }

    await client.query('COMMIT');
    console.log(`\nMigration complete! Successfully migrated ${upsertedCount} records to Supabase.`);
    
  } catch (err) {
    console.error('Migration failed. Rolling back transaction.');
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Failed to rollback transaction:', rollbackErr);
      }
    }
    console.error(err);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('Database connection pool closed.');
    console.log('--- Migration Finished ---');
  }
}

runMigration();
