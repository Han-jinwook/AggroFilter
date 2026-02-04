import { Pool } from 'pg';

let pool: Pool;

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var __db_pool: Pool | undefined;
}

if (process.env.NODE_ENV === 'production') {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  let hostname = '';
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    hostname = '';
  }

  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  pool = new Pool({
    connectionString,
    ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
  });
} else {
  if (!global.__db_pool) {
    global.__db_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  pool = global.__db_pool;
}

export { pool };
