const fs = require('fs');
const { Pool } = require('pg');

async function checkUserIdData() {
  try {
    const envPath = 'd:/AggroFilter/.env';
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
    const dbUrl = dbUrlLine.split('=')[1].trim().replace(/^["']|["']$/g, '');
    const pool = new Pool({ connectionString: dbUrl });
    
    console.log('\n=== t_analyses 데이터 확인 ===');
    
    const result = await pool.query(`
      SELECT 
        f_id,
        f_title,
        f_user_id,
        f_created_at
      FROM t_analyses 
      ORDER BY f_created_at DESC
    `);
    
    console.log(`총 ${result.rows.length}개 분석 데이터:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.f_title.substring(0, 50)}...`);
      console.log(`    ID: ${row.f_id}`);
      console.log(`    User ID: ${row.f_user_id || 'NULL'}`);
      console.log(`    Created: ${row.f_created_at}`);
      console.log('');
    });

    const nullCount = result.rows.filter(r => !r.f_user_id).length;
    console.log(`\n📊 통계:`);
    console.log(`  - f_user_id가 NULL인 데이터: ${nullCount}개`);
    console.log(`  - f_user_id가 있는 데이터: ${result.rows.length - nullCount}개`);

    console.log('\n=== t_users 테이블 확인 ===');
    const usersResult = await pool.query(`
      SELECT f_id, f_email, f_nickname FROM t_users
    `);
    
    console.log(`총 ${usersResult.rows.length}개 유저:\n`);
    usersResult.rows.forEach((row, idx) => {
      console.log(`[${idx + 1}] ${row.f_email}`);
      console.log(`    ID: ${row.f_id}`);
      console.log(`    Nickname: ${row.f_nickname}`);
      console.log('');
    });

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ 에러:', err.message);
    process.exit(1);
  }
}

checkUserIdData();
