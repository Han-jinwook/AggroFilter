import { Pool } from 'pg';

let pool: Pool;

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var __db_pool: Pool | undefined;
}

if (process.env.NODE_ENV === 'production') {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  if (!global.__db_pool) {
    global.__db_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  pool = global.__db_pool;
}

export const db = pool;
