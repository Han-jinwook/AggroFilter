async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/analysis/result/b7da6a39-d7ab-46f2-8f18-b4bc99e51dd4?lite=1');
    const data = await res.json();
    console.log("=== API Response Lite Mode (Partial) ===");
    console.log("Channel Stats:", JSON.stringify(data.analysisData.channelStats, null, 2));
    console.log("Scores:", JSON.stringify(data.analysisData.scores, null, 2));
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

test();
