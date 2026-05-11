import { Client } from 'pg';

async function checkSchema() {
  const connectionString = "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres";
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 't_analyses'
      ORDER BY ordinal_position
    `);
    console.log('t_analyses Columns:');
    res.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));
  } catch (err) {
    console.error('Failed to check schema:', err);
  } finally {
    await client.end();
  }
}

checkSchema();
