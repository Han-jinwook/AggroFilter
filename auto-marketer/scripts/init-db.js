/**
 * bot_ 전용 테이블 초기화 스크립트
 * 실행: node scripts/init-db.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('[init-db] bot_ 테이블 생성 시작...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_community_targets (
        id          SERIAL PRIMARY KEY,
        url         TEXT NOT NULL,
        keywords    TEXT[] NOT NULL DEFAULT '{}',
        is_active   BOOLEAN NOT NULL DEFAULT true,
        note        TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[init-db] ✅ bot_community_targets 생성 완료');

    await client.query(`
      CREATE TABLE IF NOT EXISTS bot_comment_logs (
        id              SERIAL PRIMARY KEY,
        target_type     TEXT NOT NULL CHECK (target_type IN ('youtube', 'community')),
        target_id       TEXT NOT NULL,
        target_url      TEXT,
        video_id        TEXT,
        grade           TEXT,
        generated_text  TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'queue' CHECK (status IN ('queue', 'done', 'error', 'skipped')),
        error_message   TEXT,
        posted_at       TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[init-db] ✅ bot_comment_logs 생성 완료');

    // 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bot_comment_logs_status ON bot_comment_logs (status);
      CREATE INDEX IF NOT EXISTS idx_bot_comment_logs_created ON bot_comment_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bot_community_targets_active ON bot_community_targets (is_active);
    `);
    console.log('[init-db] ✅ 인덱스 생성 완료');

    console.log('\n[init-db] 모든 테이블 초기화 완료!');
  } catch (e) {
    console.error('[init-db] 오류:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
