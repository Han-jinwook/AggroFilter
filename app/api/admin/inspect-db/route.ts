import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // 1. Get Table Schema for t_topics_master
      const schemaRes = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 't_topics_master'
        ORDER BY ordinal_position;
      `);

      // 2. Get Sample Data (Top 5)
      const dataRes = await client.query(`
        SELECT id, name_ko, substring(embedding::text, 1, 30) || '...' as embedding_preview 
        FROM t_topics_master 
        ORDER BY id ASC
        LIMIT 5;
      `);

      // 3. Get Total Count
      const countRes = await client.query(`SELECT COUNT(*) FROM t_topics_master`);

      return NextResponse.json({
        schema: schemaRes.rows,
        totalCount: countRes.rows[0].count,
        sampleData: dataRes.rows
      });

    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
