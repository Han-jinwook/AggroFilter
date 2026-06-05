const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
});

const targetTables = [
  't_verification_codes',
  't_magic_links',
  'family_model_rates',
  't_categories',
  't_topics_master',
  't_cafe24_tokens',
  't_cafe24_webhook_events'
];

async function generateDDL(client, tableName) {
  // Get columns details
  const colRes = await client.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position;
  `, [tableName]);

  let ddl = `CREATE TABLE IF NOT EXISTS public.${tableName} (\n`;
  const colLines = [];

  for (const col of colRes.rows) {
    let typeStr = col.data_type;
    if (col.character_maximum_length) {
      typeStr += `(${col.character_maximum_length})`;
    }
    
    let line = `  ${col.column_name} ${typeStr}`;
    
    if (col.is_nullable === 'NO') {
      line += ' NOT NULL';
    }
    
    if (col.column_default) {
      line += ` DEFAULT ${col.column_default}`;
    }
    
    colLines.push(line);
  }

  // Get primary key
  const pkRes = await client.query(`
    SELECT a.attname
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary;
  `, [`public.${tableName}`]).catch(() => ({ rows: [] }));

  if (pkRes.rows.length > 0) {
    const pkCols = pkRes.rows.map(r => r.attname).join(', ');
    colLines.push(`  CONSTRAINT ${tableName}_pkey PRIMARY KEY (${pkCols})`);
  }

  ddl += colLines.join(',\n') + '\n);';
  return ddl;
}

async function generateInserts(client, tableName) {
  const dataRes = await client.query(`SELECT * FROM "${tableName}"`);
  if (dataRes.rows.length === 0) {
    return `-- No data to insert for ${tableName}`;
  }

  const columns = dataRes.fields.map(f => f.name);
  const insertStatements = [];

  for (const row of dataRes.rows) {
    const values = [];
    for (const col of columns) {
      const val = row[col];
      if (val === null || val === undefined) {
        values.push('NULL');
      } else if (typeof val === 'object') {
        values.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
      } else if (typeof val === 'string') {
        values.push(`'${val.replace(/'/g, "''")}'`);
      } else if (val instanceof Date) {
        values.push(`'${val.toISOString()}'`);
      } else {
        values.push(val);
      }
    }
    insertStatements.push(`INSERT INTO public.${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
  }

  return insertStatements.join('\n');
}

async function main() {
  const client = await pool.connect();
  try {
    console.log("Generating backup...");
    let sqlOutput = `-- =========================================================\n`;
    sqlOutput += `-- BACKUP OF OBSOLETE TABLES - GENERATED ON ${new Date().toISOString()}\n`;
    sqlOutput += `-- Target tables: ${targetTables.join(', ')}\n`;
    sqlOutput += `-- =========================================================\n\n`;

    for (const table of targetTables) {
      console.log(`Processing table: ${table}...`);
      sqlOutput += `-- ---------------------------------------------------------\n`;
      sqlOutput += `-- Table: public.${table}\n`;
      sqlOutput += `-- ---------------------------------------------------------\n\n`;
      
      // 1. DDL
      const ddl = await generateDDL(client, table);
      sqlOutput += ddl + "\n\n";

      // 2. Inserts
      const inserts = await generateInserts(client, table);
      sqlOutput += inserts + "\n\n";
    }

    const backupPath = path.resolve(__dirname, '../sql/backup_obsolete_tables_20260530.sql');
    fs.writeFileSync(backupPath, sqlOutput, 'utf8');
    console.log(`Backup file created successfully at: ${backupPath}`);

  } catch (err) {
    console.error("Error creating backup:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
