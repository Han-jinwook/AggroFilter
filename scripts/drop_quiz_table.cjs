require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: "postgresql://postgres.iwzwiimyxfduuwulpugu:pVw0WjwsG3ZgZpM1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function dropQuizTable() {
  console.log("Dropping t_prediction_quiz table...");
  try {
    await pgPool.query(`DROP TABLE IF EXISTS t_prediction_quiz;`);
    console.log("Table t_prediction_quiz successfully dropped.");
  } catch (err) {
    console.error("Error dropping table:", err.message);
  }
  pgPool.end();
}

dropQuizTable().catch(err => {
  console.error("Unexpected error:", err);
  pgPool.end();
});
