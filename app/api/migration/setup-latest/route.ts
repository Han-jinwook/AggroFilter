import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add column
    await client.query(`
      ALTER TABLE t_analyses 
      ADD COLUMN IF NOT EXISTS f_is_latest BOOLEAN DEFAULT FALSE
    `);

    // 2. Create Index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_analyses_is_latest 
      ON t_analyses(f_is_latest) 
      WHERE f_is_latest = true
    `);

    // 3. Update Data using CTE
    const updateResult = await client.query(`
      WITH LatestRecords AS (
        SELECT f_id, 
               ROW_NUMBER() OVER (PARTITION BY f_video_id ORDER BY f_created_at DESC) as rn
        FROM t_analyses
      )
      UPDATE t_analyses
      SET f_is_latest = (
        CASE 
          WHEN f_id IN (SELECT f_id FROM LatestRecords WHERE rn = 1) THEN TRUE
          ELSE FALSE
        END
      )
    `);

    await client.query('COMMIT');

    return NextResponse.json({ 
      success: true, 
      updatedRows: updateResult.rowCount 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
