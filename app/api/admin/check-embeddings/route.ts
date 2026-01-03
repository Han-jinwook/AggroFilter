import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Count total topics
      const countRes = await client.query('SELECT COUNT(*) FROM t_topics_master');
      
      // Count unique embeddings (casting to text to compare)
      const uniqueRes = await client.query('SELECT COUNT(DISTINCT embedding::text) FROM t_topics_master');
      
      // Get a sample of topics sharing the same embedding (if any)
      const duplicateRes = await client.query(`
        SELECT embedding::text as vec, COUNT(*), array_agg(name_ko) as topics
        FROM t_topics_master
        GROUP BY embedding::text
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
        LIMIT 5
      `);

      return NextResponse.json({
        totalTopics: countRes.rows[0].count,
        uniqueEmbeddings: uniqueRes.rows[0].count,
        duplicates: duplicateRes.rows
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
