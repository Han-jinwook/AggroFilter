const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function linkRecords() {
  const client = await pool.connect();
  try {
    // 1. Check for anonymous records
    const checkRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM t_analyses 
      WHERE f_user_id IS NULL
    `);
    const count = checkRes.rows[0].count;

    console.log(`\n🔍 Found ${count} anonymous analysis records (f_user_id is NULL).`);

    if (parseInt(count) === 0) {
      console.log("Nothing to update.");
      process.exit(0);
    }

    // 2. Ask for email
    rl.question('\n📧 Enter the email address to assign these records to: ', async (email) => {
      if (!email || !email.includes('@')) {
        console.error("❌ Invalid email.");
        process.exit(1);
      }

      console.log(`\nAssigning ${count} records to user: ${email}...`);
      
      // 3. Update records
      const updateRes = await client.query(`
        UPDATE t_analyses 
        SET f_user_id = $1 
        WHERE f_user_id IS NULL
      `, [email]);

      console.log(`\n✅ Success! Updated ${updateRes.rowCount} records.`);
      console.log(`Now you can refresh 'My Page' to see these videos.`);
      
      client.release();
      await pool.end();
      rl.close();
    });

  } catch (err) {
    console.error('Error:', err);
    client.release();
    await pool.end();
    rl.close();
  }
}

linkRecords();
