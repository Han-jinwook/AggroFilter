import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addUserIdColumn() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== f_user_id 컬럼 추가 시작 ===');
    
    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 't_analyses' AND column_name = 'f_user_id'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✓ f_user_id 컬럼이 이미 존재합니다.');
    } else {
      console.log('✗ f_user_id 컬럼이 없습니다. 추가 중...');
      
      const sql = fs.readFileSync('./sql/add_user_id_to_analyses.sql', 'utf8');
      await client.query(sql);
      
      console.log('✓ f_user_id 컬럼 추가 완료!');
    }

    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 't_analyses' AND column_name = 'f_user_id'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n=== 컬럼 정보 ===');
      console.log(verifyResult.rows[0]);
    }

  } catch (error) {
    console.error('에러:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addUserIdColumn();
