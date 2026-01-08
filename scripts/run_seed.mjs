// import fetch from 'node-fetch'; // Node 18+ has native fetch

const BASE_URL = 'http://localhost:3000/api/admin/seed-topics';
const BATCH_SIZE = 50;

async function runSeed() {
  let offset = 0;
  let hasMore = true;

  console.log('🌱 Starting Topic Seeding Process...');

  while (hasMore) {
    try {
      console.log(`Processing batch starting at offset ${offset}...`);
      
      const response = await fetch(`${BASE_URL}?offset=${offset}&limit=${BATCH_SIZE}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log(`✅ Success: ${data.success} inserted, ${data.failed} failed. (Processed: ${data.processed})`);

      if (data.nextOffset) {
        offset = data.nextOffset;
      } else {
        hasMore = false;
        console.log('✨ All topics processed!');
      }

    } catch (error) {
      console.error('❌ Error during seeding:', error.message);
      console.log('Retrying in 5 seconds...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

runSeed();
