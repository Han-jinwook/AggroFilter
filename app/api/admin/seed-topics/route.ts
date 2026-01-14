import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import topics from '@/data/topics.json';
import { getEmbedding, translateText } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "API Key not configured" }, { status: 500 });
    }

    const client = await pool.connect();
    let successCount = 0;
    let failCount = 0;
    
    // Process in chunks to avoid timeouts
    const BATCH_SIZE = 10;
    
    // Simple query param to paginate: ?offset=0, ?limit=50
    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    const targetTopics = topics.slice(offset, offset + limit);

    try {
      for (const topic of targetTopics) {
        // Check if exists
        const exists = await client.query('SELECT id FROM t_topics_master WHERE name_ko = $1', [topic]);
        if (exists.rows.length > 0) {
          console.log(`Skipping ${topic} (already exists)`);
          continue;
        }

        // Translate to English for semantic consistency
        const englishTitle = await translateText(topic, apiKey);

        // Generate embedding using the English title
        const embedding = await getEmbedding(topic, apiKey, englishTitle);
        if (!embedding) {
            failCount++;
            continue;
        }

        // Insert
        // Note: pgvector format is strictly "[1.1,2.2,3.3]" string
        const embeddingString = `[${embedding.join(',')}]`;
        
        await client.query(
          'INSERT INTO t_topics_master (name_ko, embedding) VALUES ($1, $2)',
          [topic, embeddingString]
        );
        successCount++;
        console.log(`Inserted: ${topic} (En: ${englishTitle})`);
        
        // Rate limit mitigation
        await new Promise(resolve => setTimeout(resolve, 200)); 
      }
      
      return NextResponse.json({ 
        message: 'Seeding batch completed', 
        processed: targetTopics.length,
        success: successCount,
        failed: failCount,
        nextOffset: offset + limit < topics.length ? offset + limit : null
      });

    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Seeding Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
