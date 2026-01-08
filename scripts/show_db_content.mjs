const BASE_URL = 'http://localhost:3000/api/admin/inspect-db';

async function showDb() {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    const data = await response.json();
    
    console.log("✅ Database Inspection Result:");
    console.log("=========================================");
    
    console.log(`\n📊 Table: t_topics_master (Total Records: ${data.totalCount})`);
    
    console.log("\n📐 Schema:");
    console.table(data.schema);
    
    console.log("\n📝 Sample Data (First 5):");
    console.table(data.sampleData);
    
  } catch (error) {
    console.error("❌ Error fetching DB info:", error.message);
  }
}

showDb();
