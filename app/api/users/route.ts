import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { rows: users } = await db.query('SELECT * FROM "User"');
    return Response.json({ users });
  } catch (error) {
    console.error('Database Error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
