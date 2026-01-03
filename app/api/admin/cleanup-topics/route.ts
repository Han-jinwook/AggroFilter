import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // Delete topics that do not contain a space (single word topics)
      const res = await client.query(`
        DELETE FROM t_topics_master 
        WHERE name_ko NOT LIKE '% %'
      `);
      
      return NextResponse.json({ 
        message: 'Cleanup successful', 
        deletedCount: res.rowCount 
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
