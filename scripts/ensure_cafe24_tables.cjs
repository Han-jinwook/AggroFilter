const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Ensuring all Cafe24 related tables exist...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS t_cafe24_tokens (
        f_mall_id TEXT PRIMARY KEY,
        f_access_token TEXT NOT NULL,
        f_refresh_token TEXT,
        f_expires_at TIMESTAMP,
        f_updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS t_cafe24_webhook_events (
        f_id TEXT PRIMARY KEY,
        f_event_type TEXT,
        f_order_id TEXT,
        f_created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS t_unclaimed_payments (
        f_id BIGSERIAL PRIMARY KEY,
        f_cafe24_order_id VARCHAR(255) UNIQUE NOT NULL,
        f_buyer_email VARCHAR(255) NOT NULL,
        f_product_id VARCHAR(255),
        f_product_name TEXT,
        f_amount_paid NUMERIC,
        f_payment_data JSONB,
        f_status TEXT DEFAULT 'PENDING',
        f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        f_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS t_payment_logs (
        f_id BIGSERIAL PRIMARY KEY,
        f_cafe24_order_id VARCHAR(255) UNIQUE NOT NULL,
        f_user_id TEXT,
        f_buyer_email VARCHAR(255),
        f_amount_paid NUMERIC,
        f_credits_added INTEGER,
        f_payment_data JSONB,
        f_status TEXT DEFAULT 'COMPLETED',
        f_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    console.log('✅ All Cafe24 tables ensured.');
  } catch (e) {
    console.error('❌ Error ensuring tables:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
