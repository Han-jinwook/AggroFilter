import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getEmbedding } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute per batch

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get('offset') || '0');
  const limit = parseInt(searchParams.get('limit') || '10');
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
  }

  try {
    const client = await pool.connect();
    try {
      // Fetch batch of topics
      const res = await client.query(`
        SELECT id, name_ko 
        FROM t_topics_master 
        ORDER BY id ASC
        OFFSET $1 LIMIT $2
      `, [offset, limit]);
      
      const topics = res.rows;
      const results = [];
      let updatedCount = 0;

      for (const topic of topics) {
        // Generate NEW embedding
        // Add a small delay to avoid rate limits if necessary, though 10 per request should be fine
        const embedding = await getEmbedding(topic.name_ko, apiKey);
        
        if (embedding) {
            const vectorStr = `[${embedding.join(',')}]`;
            await client.query(`
                UPDATE t_topics_master 
                SET embedding = $1 
                WHERE id = $2
            `, [vectorStr, topic.id]);
            results.push({ id: topic.id, name: topic.name_ko, status: 'updated' });
            updatedCount++;
        } else {
            results.push({ id: topic.id, name: topic.name_ko, status: 'failed' });
        }
      }

      return NextResponse.json({
        processed: topics.length,
        updated: updatedCount,
        results
      });

    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
