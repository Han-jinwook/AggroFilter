const BASE_URL = 'http://localhost:3000/api/admin/search-topics?q=AI';

async function showSearchResults() {
  try {
    const response = await fetch(BASE_URL);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    const data = await response.json();
    
    console.log(`\n🔎 Search Results for 'AI' (Total: ${data.count})`);
    console.log("=========================================");
    console.table(data.results);
    
  } catch (error) {
    console.error("❌ Error fetching search results:", error.message);
  }
}

showSearchResults();
