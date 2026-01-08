const BASE_URL = 'http://127.0.0.1:3000/api/admin/regenerate-embeddings-v2';
const BATCH_SIZE = 20; // Process 20 topics at a time
const DELAY_MS = 1000; // 1 second delay between batches to respect rate limits

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runReembed() {
  console.log("🚀 Starting Embedding Regeneration Process...");
  
  let offset = 0;
  let totalProcessed = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      console.log(`Processing batch starting at offset ${offset}...`);
      const response = await fetch(`${BASE_URL}?offset=${offset}&limit=${BATCH_SIZE}`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.processed === 0) {
        hasMore = false;
        break;
      }

      console.log(`   ✅ Processed: ${data.processed}, Updated: ${data.updated}`);
      
      totalProcessed += data.processed;
      offset += BATCH_SIZE;

      if (data.processed < BATCH_SIZE) {
        hasMore = false; // Last batch
      } else {
        await sleep(DELAY_MS); // Rate limiting
      }

    } catch (error) {
      console.error("   ❌ Error processing batch:", error.message);
      // Wait a bit longer on error before retrying or moving on
      await sleep(5000);
      // For now, let's stop on error to avoid infinite loops if API is down
      break; 
    }
  }

  console.log(`✨ Regeneration Complete! Total Processed: ${totalProcessed}`);
}

runReembed();
