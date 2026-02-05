const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'aggrofilter',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function checkChannel() {
  const client = await pool.connect();
  try {
    // 채널 ID 확인
    const channelId = 'UCF4Wxdo3inmxP-Y59wXDsFw';
    
    console.log(`\n=== Checking Channel: ${channelId} ===\n`);
    
    // 1. 채널 존재 확인
    const channelResult = await client.query(
      'SELECT f_channel_id, f_title, f_subscriber_count FROM t_channels WHERE f_channel_id = $1',
      [channelId]
    );
    
    if (channelResult.rows.length === 0) {
      console.log('❌ Channel NOT found in t_channels');
      
      // 모든 채널 목록 확인
      const allChannels = await client.query('SELECT f_channel_id, f_title FROM t_channels LIMIT 10');
      console.log('\n📋 Available channels:');
      allChannels.rows.forEach(ch => {
        console.log(`  - ${ch.f_channel_id}: ${ch.f_title}`);
      });
    } else {
      console.log('✅ Channel found:', channelResult.rows[0]);
      
      // 2. 분석 데이터 확인
      const analysisResult = await client.query(
        'SELECT COUNT(*) as count FROM t_analyses WHERE f_channel_id = $1',
        [channelId]
      );
      console.log(`\n📊 Analysis count: ${analysisResult.rows[0].count}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkChannel();
