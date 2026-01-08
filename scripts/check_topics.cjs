const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Use DATABASE_URL as per project standard
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is not defined in environment variables");
    process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log("🚀 Checking for Macro Topics in DB...");
    
    const targetTopics = [
        '국제 정세', '세계 경제', '경제 분석', '자영업', '창업', 
        '시사 이슈', '정치', '외교', '사회 문제', '생활 경제'
    ];

    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT name_ko FROM t_topics_master 
            WHERE name_ko = ANY($1)
        `, [targetTopics]);

        const found = res.rows.map(r => r.name_ko);
        const missing = targetTopics.filter(t => !found.includes(t));

        console.log("\n✅ Found Topics:");
        found.forEach(t => console.log(`   - ${t}`));

        console.log("\n❌ Missing Topics (Need Seeding):");
        missing.forEach(t => console.log(`   - ${t}`));

    } finally {
        client.release();
    }
}

main().catch(console.error).finally(() => pool.end());
