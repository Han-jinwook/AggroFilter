import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== t_analyses 테이블 스키마 확인 ===');
    const schemaResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 't_analyses'
      ORDER BY ordinal_position
    `);
    
    console.log('컬럼 목록:');
    schemaResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    console.log('\n=== 샘플 데이터 확인 ===');
    const dataResult = await client.query(`
      SELECT * FROM t_analyses LIMIT 1
    `);
    
    if (dataResult.rows.length > 0) {
      console.log('첫 번째 레코드의 컬럼들:');
      console.log(Object.keys(dataResult.rows[0]));
    }

  } catch (error) {
    console.error('에러:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
