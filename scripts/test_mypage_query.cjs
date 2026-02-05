const fs = require('fs');
const { Pool } = require('pg');

async function testMyPageQuery() {
  try {
    const envPath = 'd:/AggroFilter/.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
    const dbUrl = dbUrlLine.split('=')[1].trim().replace(/^["']|["']$/g, '');
    const pool = new Pool({ connectionString: dbUrl });
    
    const testEmail = 'chiu3@naver.com';
    
    console.log(`\n=== 마이페이지 쿼리 테스트 (email: ${testEmail}) ===\n`);
    
    const refinedQuery = `
      WITH RankStats AS (
          SELECT 
              f_channel_id as f_channel_id, 
              f_official_category_id,
              RANK() OVER (PARTITION BY f_official_category_id ORDER BY f_trust_score DESC) as channel_rank,
              COUNT(*) OVER (PARTITION BY f_official_category_id) as total_channels
          FROM t_channels
      )
      SELECT DISTINCT ON (a.f_id)
        a.f_id as id,
        a.f_title as title,
        a.f_reliability_score as score,
        a.f_created_at as created_at,
        c.f_title as channel_name,
        c.f_thumbnail_url as channel_icon,
        COALESCE(rs.channel_rank, 0) as rank,
        COALESCE(rs.total_channels, 0) as total_rank,
        cat.f_name_ko as topic
      FROM t_analyses a
      LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
      LEFT JOIN t_categories cat ON a.f_official_category_id = cat.f_id
      LEFT JOIN RankStats rs ON a.f_channel_id = rs.f_channel_id AND a.f_official_category_id = rs.f_official_category_id
      WHERE a.f_user_id = $1
      ORDER BY a.f_id, a.f_created_at DESC
    `;

    const result = await pool.query(refinedQuery, [testEmail]);
    
    console.log(`✅ 쿼리 성공! ${result.rows.length}개 결과:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.title}`);
      console.log(`    Channel: ${row.channel_name || '알 수 없음'}`);
      console.log(`    Score: ${row.score}`);
      console.log(`    Topic: ${row.topic || '미분류'}`);
      console.log(`    Rank: ${row.rank}/${row.total_rank}`);
      console.log(`    Created: ${row.created_at}`);
      console.log('');
    });

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ 쿼리 실패:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testMyPageQuery();
