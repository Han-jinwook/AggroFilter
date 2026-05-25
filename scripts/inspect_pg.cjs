require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  // Find table names
  const { rows: tables } = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables:", tables.map(t => t.table_name));

  let tableName = 't_analyses';
  
  if (tableName) {
    const { rows: columns } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [tableName]);
    console.log(`Columns in ${tableName}:`, columns.map(c => c.column_name));

    const { rows: count } = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
    console.log(`Total rows in ${tableName}:`, count[0].count);

    // Let's see some sample user_ids
    const { rows: sample } = await pool.query(`
      SELECT f_user_id, count(*) as count 
      FROM ${tableName} 
      GROUP BY f_user_id 
      ORDER BY count DESC 
      LIMIT 10
    `);
    console.log(`Top 10 users by video count:`, sample);
  }

  // Also query to get sundream users to see if they have videos
  const users = [
    '6c526da8-2881-4e4e-bf4a-ce0960bd21c8', // 그냥늑대
    'bde13331-d532-4426-b6f2-4e98bff95082', // sundream7879
    '224964d0-5356-460c-9ffe-4373e4ec284a', // sundream7878
    'a4478ded-b522-4662-86ae-61f10c51cb98', // 멀린 (UNKNOWN)
    'd6c82d92-4987-4840-b8e9-c18e3995f963', // 멀린 (aggro_filter)
    'cbbc26c1-19dc-4382-a561-21690e82cef2', // merlinstark (NULL)
    'eaae563a-c805-4fab-a137-380779c020d6'  // chiuking369 (UNKNOWN)
  ];
  
  if (tableName) {
    const { rows: userVids } = await pool.query(`
      SELECT f_user_id, COUNT(*) as vids
      FROM ${tableName}
      WHERE f_user_id = ANY($1)
      GROUP BY f_user_id
    `, [users]);
    console.log("Video counts for target users:", userVids);
  }

  pool.end();
}

run().catch(err => {
  console.error(err);
  pool.end();
});
