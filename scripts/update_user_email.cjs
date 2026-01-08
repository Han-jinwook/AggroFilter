const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function updateUserEmail() {
  const oldEmail = 'chiu369@naver.com';
  const newEmail = 'chiu3@naver.com';

  const client = await pool.connect();
  try {
    console.log(`Checking records for ${oldEmail}...`);
    
    // Check count first
    const checkRes = await client.query(`
      SELECT COUNT(*) as count 
      FROM t_analyses 
      WHERE f_user_id = $1
    `, [oldEmail]);
    
    const count = checkRes.rows[0].count;
    console.log(`Found ${count} records linked to ${oldEmail}.`);

    if (parseInt(count) > 0) {
        console.log(`Updating records to ${newEmail}...`);
        
        const updateRes = await client.query(`
            UPDATE t_analyses 
            SET f_user_id = $1 
            WHERE f_user_id = $2
        `, [newEmail, oldEmail]);

        console.log(`✅ Success! Updated ${updateRes.rowCount} records from ${oldEmail} to ${newEmail}.`);
    } else {
        console.log('No records found to update.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

updateUserEmail();
