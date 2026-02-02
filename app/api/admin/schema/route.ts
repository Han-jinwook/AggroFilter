import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const configured = (process.env.ADMIN_SCHEMA_TOKEN || '').trim();
  if (!configured) return false;
  const provided = (request.headers.get('x-admin-token') || '').trim();
  return provided && provided === configured;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const tablesRes = await client.query(
      `
        SELECT
          t.table_schema,
          t.table_name,
          t.table_type
        FROM information_schema.tables t
        WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY t.table_schema, t.table_name
      `,
    );

    const columnsRes = await client.query(
      `
        SELECT
          c.table_schema,
          c.table_name,
          c.column_name,
          c.ordinal_position,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default
        FROM information_schema.columns c
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `,
    );

    const constraintsRes = await client.query(
      `
        SELECT
          tc.table_schema,
          tc.table_name,
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_schema AS foreign_table_schema,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
          AND tc.table_name = kcu.table_name
        LEFT JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
      `,
    );

    const indexesRes = await client.query(
      `
        SELECT
          ns.nspname AS table_schema,
          tab.relname AS table_name,
          idx.relname AS index_name,
          am.amname AS access_method,
          i.indisunique AS is_unique,
          i.indisprimary AS is_primary,
          pg_get_indexdef(i.indexrelid) AS index_def
        FROM pg_index i
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_class tab ON tab.oid = i.indrelid
        JOIN pg_namespace ns ON ns.oid = tab.relnamespace
        JOIN pg_am am ON am.oid = idx.relam
        WHERE ns.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY ns.nspname, tab.relname, idx.relname
      `,
    );

    return NextResponse.json({
      tables: tablesRes.rows,
      columns: columnsRes.rows,
      constraints: constraintsRes.rows,
      indexes: indexesRes.rows,
    });
  } finally {
    client.release();
  }
}
