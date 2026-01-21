import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'aggrofilter',
  user: 'postgres',
  password: 'postgres',
});

async function testMyPageData() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== 1. t_analyses 테이블 데이터 확인 ===');
    const analysesResult = await client.query(`
      SELECT 
        f_id, 
        f_video_id, 
        f_title, 
        f_channel_id,
        f_reliability_score,
        f_official_category_id,
        f_user_id,
        f_created_at
      FROM t_analyses 
      ORDER BY f_created_at DESC 
      LIMIT 10
    `);
    
    console.log(`총 분석 데이터: ${analysesResult.rows.length}개`);
    analysesResult.rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}]`);
      console.log(`  - ID: ${row.f_id}`);
      console.log(`  - Video ID: ${row.f_video_id}`);
      console.log(`  - Title: ${row.f_title}`);
      console.log(`  - Channel ID: ${row.f_channel_id}`);
      console.log(`  - Score: ${row.f_reliability_score}`);
      console.log(`  - Category: ${row.f_official_category_id}`);
      console.log(`  - User ID: ${row.f_user_id}`);
      console.log(`  - Created: ${row.f_created_at}`);
    });

    console.log('\n=== 2. t_channels 테이블 확인 ===');
    const channelsResult = await client.query(`
      SELECT f_id, f_name, f_profile_image_url, f_trust_score
      FROM t_channels 
      LIMIT 5
    `);
    
    console.log(`총 채널 데이터: ${channelsResult.rows.length}개`);
    channelsResult.rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}]`);
      console.log(`  - ID: ${row.f_id}`);
      console.log(`  - Name: ${row.f_name}`);
      console.log(`  - Image: ${row.f_profile_image_url}`);
      console.log(`  - Score: ${row.f_trust_score}`);
    });

    console.log('\n=== 3. t_categories 테이블 확인 ===');
    const categoriesResult = await client.query(`
      SELECT f_id, f_name_ko
      FROM t_categories 
      LIMIT 10
    `);
    
    console.log(`총 카테고리 데이터: ${categoriesResult.rows.length}개`);
    categoriesResult.rows.forEach((row) => {
      console.log(`  - ID ${row.f_id}: ${row.f_name_ko}`);
    });

    console.log('\n=== 4. 실제 API 쿼리 테스트 ===');
    
    // 최근 5개 video_id 가져오기
    const recentVideos = await client.query(`
      SELECT f_video_id FROM t_analyses ORDER BY f_created_at DESC LIMIT 5
    `);
    
    const videoIds = recentVideos.rows.map(r => r.f_video_id);
    console.log(`테스트할 Video IDs: ${videoIds.join(', ')}`);

    // 실제 API 쿼리 실행
    const refinedQuery = `
      WITH RankStats AS (
          SELECT 
              f_id as f_channel_id, 
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
        c.f_name as channel_name,
        c.f_profile_image_url as channel_icon,
        COALESCE(rs.channel_rank, 0) as rank,
        COALESCE(rs.total_channels, 0) as total_rank,
        cat.f_name_ko as topic
      FROM t_analyses a
      LEFT JOIN t_channels c ON a.f_channel_id = c.f_id
      LEFT JOIN t_categories cat ON a.f_official_category_id = cat.f_id
      LEFT JOIN RankStats rs ON a.f_channel_id = rs.f_channel_id AND a.f_official_category_id = rs.f_official_category_id
      LEFT JOIN t_users u ON a.f_user_id = u.f_id
      WHERE a.f_video_id = ANY($1::text[])
      ORDER BY a.f_id, a.f_created_at DESC
    `;

    const apiResult = await client.query(refinedQuery, [videoIds]);
    
    console.log(`\nAPI 쿼리 결과: ${apiResult.rows.length}개`);
    apiResult.rows.forEach((row, idx) => {
      console.log(`\n[${idx + 1}]`);
      console.log(`  - ID: ${row.id}`);
      console.log(`  - Title: ${row.title}`);
      console.log(`  - Channel: ${row.channel_name}`);
      console.log(`  - Score: ${row.score}`);
      console.log(`  - Topic: ${row.topic}`);
      console.log(`  - Rank: ${row.rank}/${row.total_rank}`);
    });

    console.log('\n=== 5. t_users 테이블 확인 ===');
    const usersResult = await client.query(`
      SELECT f_id, f_email FROM t_users LIMIT 5
    `);
    
    console.log(`총 유저 데이터: ${usersResult.rows.length}개`);
    usersResult.rows.forEach((row) => {
      console.log(`  - ID: ${row.f_id}, Email: ${row.f_email}`);
    });

  } catch (error) {
    console.error('에러 발생:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testMyPageData();
