const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    const r1 = await client.query(
      `SELECT f_user_id, COUNT(*) as cnt FROM t_channel_subscriptions GROUP BY f_user_id ORDER BY cnt DESC`
    );
    console.log('=== 채널구독 (유저별) ===');
    r1.rows.forEach(r => console.log(r.f_user_id?.substring(0, 35), '->', r.cnt, '채널'));

    const r2 = await client.query(
      `SELECT f_user_id, COUNT(*) as cnt FROM t_video_subscriptions GROUP BY f_user_id ORDER BY cnt DESC`
    );
    console.log('\n=== 영상구독 (유저별) ===');
    r2.rows.forEach(r => console.log(r.f_user_id?.substring(0, 35), '->', r.cnt, '영상'));

    const r3 = await client.query(
      `SELECT vs.f_user_id, vs.f_video_id, vs.f_channel_id, vs.f_subscribed_at
       FROM t_video_subscriptions vs
       ORDER BY vs.f_user_id, vs.f_subscribed_at DESC
       LIMIT 30`
    );
    console.log('\n=== 영상구독 샘플 (최근 30) ===');
    r3.rows.forEach(r =>
      console.log(
        (r.f_user_id || '').substring(0, 30).padEnd(32),
        '|', (r.f_video_id || '').padEnd(14),
        '|', r.f_subscribed_at
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
