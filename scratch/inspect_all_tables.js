const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
});

async function main() {
  try {
    // 1. Get all tables in the public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`Found ${tables.length} tables in 'public' schema.\n`);

    console.log("| Table Name | Row Count |");
    console.log("| :--- | :--- |");

    const tableInfos = [];

    for (const table of tables) {
      // Count rows
      let rowCount = 0;
      try {
        const countRes = await pool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
        rowCount = parseInt(countRes.rows[0].cnt, 10);
      } catch (err) {
        console.error(`Error counting rows for ${table}:`, err.message);
      }

      console.log(`| ${table} | ${rowCount} |`);

      // Get columns
      const columnsRes = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      tableInfos.push({
        name: table,
        rowCount,
        columns: columnsRes.rows.map(c => c.column_name)
      });
    }

    console.log("\n=== DETAILED TABLES AND COLUMNS ===");
    for (const info of tableInfos) {
      console.log(`\nTable: ${info.name} (Rows: ${info.rowCount})`);
      console.log(`Columns: ${info.columns.join(', ')}`);
    }

  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await pool.end();
  }
}

main();
