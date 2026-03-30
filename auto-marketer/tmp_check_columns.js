const { pool } = require('./src/db');

(async () => {
  const q = "SELECT column_name FROM information_schema.columns WHERE table_name = 't_analyses' ORDER BY ordinal_position";
  const r = await pool.query(q);
  console.log(r.rows.map((x) => x.column_name).join('\n'));
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
