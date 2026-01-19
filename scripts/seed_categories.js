
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedCategories() {
  const client = await pool.connect();
  try {
    console.log('--- Starting t_categories Seeding ---');
    await client.query('BEGIN');

    // 1. t_categories 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS t_categories (
        f_id INT PRIMARY KEY,
        f_name_ko VARCHAR(50) NOT NULL,
        f_name_en VARCHAR(50) NOT NULL,
        f_is_garbage BOOLEAN DEFAULT FALSE,
        f_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. 공식 카테고리 데이터 준비
    const categories = [
      [1, '영화/애니메이션', 'Film & Animation', false],
      [2, '자동차/교통', 'Autos & Vehicles', false],
      [10, '음악', 'Music', false],
      [15, '애완동물/동물', 'Pets & Animals', false],
      [17, '스포츠', 'Sports', false],
      [19, '여행/이벤트', 'Travel & Events', false],
      [20, '게임', 'Gaming', false],
      [22, '인물/블로그', 'People & Blogs', true],
      [23, '코미디', 'Comedy', false],
      [24, '엔터테인먼트', 'Entertainment', true],
      [25, '뉴스/정치', 'News & Politics', false],
      [26, '노하우/스타일', 'Howto & Style', false],
      [27, '교육', 'Education', false],
      [28, '과학/기술', 'Science & Technology', false],
      [29, '비영리/사회운동', 'Nonprofits & Activism', false]
    ];

    // 3. 데이터 삽입 (UPSERT)
    for (const cat of categories) {
      await client.query(`
        INSERT INTO t_categories (f_id, f_name_ko, f_name_en, f_is_garbage)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (f_id) DO UPDATE SET
          f_name_ko = EXCLUDED.f_name_ko,
          f_name_en = EXCLUDED.f_name_en,
          f_is_garbage = EXCLUDED.f_is_garbage
      `, cat);
      console.log(`Seeded: ${cat[1]} (ID: ${cat[0]}, Garbage: ${cat[3]})`);
    }

    await client.query('COMMIT');
    console.log('--- Seeding Successful ---');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('--- Seeding Failed ---', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCategories();
