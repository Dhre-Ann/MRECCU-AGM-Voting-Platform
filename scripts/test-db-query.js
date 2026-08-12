/**
 * Quick DB connectivity check + sample pull from a table.
 *
 * Usage:
 *   node scripts/test-db-query.js
 *   node scripts/test-db-query.js voters
 *   node scripts/test-db-query.js positions 5
 *
 * Args: [table=voters] [limit=10]
 */
const path = require('path');
const { Pool } = require('pg');

// Load DATABASE_URL from project-root .env (works even if cwd isn't the repo root)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add it to .env in the project root.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const ALLOWED_TABLES = new Set(['voters', 'positions', 'candidates']);

async function main() {
  const table = (process.argv[2] || 'voters').toLowerCase();
  const limit = Math.min(Math.max(parseInt(process.argv[3], 10) || 10, 1), 100);

  if (!ALLOWED_TABLES.has(table)) {
    console.error(`Unknown table "${table}". Allowed: ${[...ALLOWED_TABLES].join(', ')}`);
    process.exit(1);
  }

  console.log('Using DATABASE_URL from .env');

  const client = await pool.connect();
  try {
    const ping = await client.query('SELECT NOW() AS now, current_database() AS database');
    console.log('Connected OK');
    console.log(`  database: ${ping.rows[0].database}`);
    console.log(`  server time: ${ping.rows[0].now}`);

    const countResult = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    console.log(`\nTable "${table}": ${countResult.rows[0].count} row(s)`);

    const sample = await client.query(`SELECT * FROM ${table} ORDER BY id ASC LIMIT $1`, [limit]);
    if (sample.rows.length === 0) {
      console.log('(no rows)');
    } else {
      console.log(`\nFirst ${sample.rows.length} row(s):`);
      console.table(sample.rows);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('DB query failed:', err.message);
  process.exit(1);
});
