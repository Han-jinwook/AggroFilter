const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function audit() {
  try {
    const tables = [
      't_users', 't_analyses', 't_notifications', 't_channel_subscriptions', 
      't_prediction_quiz', 't_comments', 't_interactions', 't_comment_interactions'
    ];
    
    console.log('--- DATABASE COLUMN TYPE AUDIT ---');
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = 'f_user_id' OR (table_name = '${table}' AND column_name = 'f_id')
      `);
      console.log(`\nTable: ${table}`);
      console.table(res.rows);
    }

    console.log('\n--- RLS STATUS AUDIT ---');
    const rlsRes = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ANY($1)
    `, [tables]);
    console.table(rlsRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

audit();
