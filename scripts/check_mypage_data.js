
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkData() {
  const client = await pool.connect();
  try {
    console.log('--- Checking t_channels table ---');
    const channels = await client.query('SELECT f_id, f_name FROM t_channels LIMIT 10');
    console.table(channels.rows);

    const testChannelId = 'UCF4Wxdo3inmxP-Y59wXDsFw';
    console.log(`\n--- Checking specific channel: ${testChannelId} ---`);
    const channelCheck = await client.query('SELECT * FROM t_channels WHERE f_id = $1', [testChannelId]);
    console.log('Channel found:', channelCheck.rows.length > 0 ? 'YES' : 'NO');
    if (channelCheck.rows.length > 0) {
      console.table(channelCheck.rows);
    }

    console.log('\n--- Checking t_analyses for this channel ---');
    const analysisCheck = await client.query('SELECT COUNT(*) as count FROM t_analyses WHERE f_channel_id = $1', [testChannelId]);
    console.log('Analysis count:', analysisCheck.rows[0].count);

  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
