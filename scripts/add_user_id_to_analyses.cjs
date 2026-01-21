const fs = require('fs');
const { Pool } = require('pg');

async function addUserIdColumn() {
  try {
    const envPath = 'd:/AggroFilter/.env';
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found at ' + envPath);
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlLine = envContent.split('\n').find(line => line.trim().startsWith('DATABASE_URL='));
    
    if (!dbUrlLine) {
      throw new Error('DATABASE_URL not found in .env');
    }

    const dbUrl = dbUrlLine.split('=')[1].trim().replace(/^["']|["']$/g, '');
    const pool = new Pool({ connectionString: dbUrl });
    
    console.log('\n=== t_analyses 스키마 확인 중... ===');
    
    // Check if f_user_id column exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 't_analyses' AND column_name = 'f_user_id'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✓ f_user_id 컬럼이 이미 존재합니다.');
    } else {
      console.log('✗ f_user_id 컬럼이 없습니다. 추가 중...');
      
      await pool.query(`
        ALTER TABLE t_analyses 
        ADD COLUMN f_user_id UUID REFERENCES t_users(f_id);
      `);
      
      console.log('✓ f_user_id 컬럼 추가 완료!');
      
      // Add index for performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON t_analyses(f_user_id);
      `);
      
      console.log('✓ 인덱스 생성 완료!');
    }

    // Show current schema
    console.log('\n=== t_analyses 현재 스키마 ===');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 't_analyses'
      ORDER BY ordinal_position
    `);
    
    schemaResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Show sample data count
    const countResult = await pool.query(`
      SELECT COUNT(*) as total FROM t_analyses
    `);
    console.log(`\n총 분석 데이터: ${countResult.rows[0].total}개`);

    await pool.end();
    console.log('\n✅ 작업 완료!');
    process.exit(0);
  } catch (err) {
    console.error('❌ 에러 발생:', err.message);
    process.exit(1);
  }
}

addUserIdColumn();
