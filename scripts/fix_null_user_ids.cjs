#!/usr/bin/env node
/**
 * t_analyses 테이블의 f_user_id가 NULL인 레코드를 
 * 특정 사용자 이메일로 일괄 업데이트하는 스크립트
 * 
 * 실행: node scripts/fix_null_user_ids.cjs
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const DEFAULT_USER_EMAIL = 'chiu3@naver.com';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    console.log('🔍 f_user_id가 NULL인 레코드 확인 중...');
    
    const countRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM t_analyses 
      WHERE f_user_id IS NULL
    `);
    
    const nullCount = parseInt(countRes.rows[0].count);
    console.log(`📊 NULL 레코드 수: ${nullCount}개`);

    if (nullCount === 0) {
      console.log('✅ 업데이트할 레코드가 없습니다.');
      return;
    }

    // 사용자 확인
    const userRes = await client.query(
      'SELECT f_id, f_email FROM t_users WHERE f_email = $1',
      [DEFAULT_USER_EMAIL]
    );

    if (userRes.rows.length === 0) {
      console.error(`❌ 사용자를 찾을 수 없습니다: ${DEFAULT_USER_EMAIL}`);
      console.log('먼저 해당 이메일로 로그인하여 사용자를 생성해주세요.');
      return;
    }

    console.log(`👤 사용자 확인: ${userRes.rows[0].f_email}`);
    console.log(`\n⚠️  ${nullCount}개의 레코드를 "${DEFAULT_USER_EMAIL}"로 업데이트합니다.`);
    console.log('계속하려면 Ctrl+C를 눌러 취소하거나, 5초 후 자동 실행됩니다...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🔄 업데이트 시작...');
    
    const updateRes = await client.query(`
      UPDATE t_analyses 
      SET f_user_id = $1 
      WHERE f_user_id IS NULL
      RETURNING f_id
    `, [DEFAULT_USER_EMAIL]);

    console.log(`✅ 업데이트 완료: ${updateRes.rowCount}개 레코드`);

    // 결과 확인
    const verifyRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM t_analyses 
      WHERE f_user_id IS NULL
    `);
    
    console.log(`\n📊 남은 NULL 레코드: ${verifyRes.rows[0].count}개`);

  } catch (error) {
    console.error('❌ 오류 발생:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
