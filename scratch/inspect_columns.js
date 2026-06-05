const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
});

const remainingTables = [
  'bot_aggro_keywords',
  'bot_comment_logs',
  'bot_community_targets',
  'bot_keyword_videos',
  't_analyses',
  't_channel_stats',
  't_channel_subscriptions',
  't_channels',
  't_comment_interactions',
  't_comments',
  't_credit_history',
  't_interactions',
  't_notifications',
  't_payment_logs',
  't_rankings_cache',
  't_unclaimed_payments',
  't_users',
  't_video_subscriptions',
  't_videos'
];

// System/standard columns that we know are always used or standard
const systemColumns = new Set([
  'id', 'f_id', 'created_at', 'f_created_at', 'updated_at', 'f_updated_at',
  'video_id', 'f_video_id', 'channel_id', 'f_channel_id', 'user_id', 'f_user_id'
]);

// Read all code files once to search quickly in memory
console.log("Reading codebase files...");
const codeFiles = [];
function readCodeFiles(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git' && file !== 'scratch') {
        readCodeFiles(fullPath);
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          codeFiles.push({
            path: path.relative(path.resolve(__dirname, '..'), fullPath),
            content
          });
        } catch (e) {
          // ignore
        }
      }
    }
  });
}
readCodeFiles(path.resolve(__dirname, '..'));
console.log(`Loaded ${codeFiles.length} code files into memory.\n`);

function countReferencesInCode(columnName) {
  if (systemColumns.has(columnName)) {
    return 999; // System columns are assumed always used
  }
  let count = 0;
  const regex = new RegExp(`\\b${columnName}\\b`, 'g');
  codeFiles.forEach(file => {
    if (regex.test(file.content)) {
      count++;
    }
  });
  return count;
}

async function main() {
  const client = await pool.connect();
  try {
    const report = [];

    for (const table of remainingTables) {
      console.log(`Inspecting table: ${table}...`);
      
      // Get table row count
      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
      const totalRows = parseInt(countRes.rows[0].cnt, 10);

      // Get columns
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [table]);

      const columns = colsRes.rows;
      const columnStatuses = [];

      for (const col of columns) {
        const colName = col.column_name;
        
        // 1. Check references in code
        const codeRefCount = countReferencesInCode(colName);

        // 2. Check non-null count in DB
        let nonNullCount = 0;
        if (totalRows > 0) {
          try {
            const nonNullRes = await client.query(`
              SELECT COUNT(*) as cnt FROM "${table}" WHERE "${colName}" IS NOT NULL
            `);
            nonNullCount = parseInt(nonNullRes.rows[0].cnt, 10);
          } catch (err) {
            console.error(`Error querying non-null for ${table}.${colName}:`, err.message);
          }
        }

        // Determine status
        let status = 'USED';
        if (codeRefCount === 0 && nonNullCount === 0) {
          status = 'OBSOLETE_EMPTY'; // Neither referenced in code nor contains data
        } else if (codeRefCount === 0 && nonNullCount > 0) {
          status = 'OBSOLETE_WITH_DATA'; // Has data in DB, but not referenced in code (orphan data)
        } else if (codeRefCount > 0 && nonNullCount === 0 && totalRows > 0) {
          status = 'REFERENCED_BUT_EMPTY'; // Referenced in code, but all values are NULL in DB
        }

        columnStatuses.push({
          name: colName,
          type: col.data_type,
          nullable: col.is_nullable,
          default: col.column_default,
          codeRefCount,
          nonNullCount,
          status
        });
      }

      report.push({
        table,
        totalRows,
        columns: columnStatuses
      });
    }

    // Output formatted report
    console.log("\n=== COLUMN INSPECTION REPORT ===\n");
    for (const t of report) {
      console.log(`### Table: ${t.table} (Total Rows: ${t.totalRows})`);
      
      const obsoleteColumns = t.columns.filter(c => c.status !== 'USED');
      if (obsoleteColumns.length === 0) {
        console.log("  ✅ All columns appear to be actively used.");
      } else {
        console.log("| Column Name | Type | Code Refs | Non-Null Rows | Status | Recommendation |");
        console.log("| :--- | :--- | :--- | :--- | :--- | :--- |");
        obsoleteColumns.forEach(c => {
          let rec = 'Keep (Used)';
          if (c.status === 'OBSOLETE_EMPTY') {
            rec = '❌ Drop (No code ref, no data)';
          } else if (c.status === 'OBSOLETE_WITH_DATA') {
            rec = '⚠️ Drop / Migrate (Has data, but no code ref)';
          } else if (c.status === 'REFERENCED_BUT_EMPTY') {
            rec = '🔍 Review (Referenced in code but no database values)';
          }
          console.log(`| ${c.name} | ${c.type} | ${c.codeRefCount} | ${c.nonNullCount}/${t.totalRows} | ${c.status} | ${rec} |`);
        });
      }
      console.log("\n");
    }

  } catch (err) {
    console.error("Error inspecting columns:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
