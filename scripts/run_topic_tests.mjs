const BASE_URL = 'http://localhost:3000/api/admin/test-topic-logic';

async function testTopic(scenario, topic) {
  console.log(`\n🧪 Testing Scenario: ${scenario}`);
  console.log(`   Input Topic: "${topic}"`);
  
  try {
    const response = await fetch(`${BASE_URL}?topic=${encodeURIComponent(topic)}`);
    const data = await response.json();
    
    if (response.ok) {
        console.log("   ✅ Result:", data);
    } else {
        console.log("   ❌ Error:", data);
    }
  } catch (error) {
    console.error("   ❌ Network Error:", error.message);
  }
}

async function runTests() {
  console.log("🚀 Starting Topic Logic Simulation Tests...");

  // 1. Existing Topic Test
  // "AI 교육" is known to exist from previous context
  await testTopic("Existing Topic (Should Match)", "AI 교육");

  // 2. Violation Test (3 words)
  // "AI 교육 자료" -> Should truncate to "AI 교육" -> Match "AI 교육"
  await testTopic("3-Word Violation (Should Truncate & Match)", "AI 교육 자료");

  // 3. New Topic Test
  // "양자 컴퓨터" (Quantum Computer) - likely new
  await testTopic("New Topic (Should Auto-Register)", "양자 컴퓨터");
  
  // 4. Re-test New Topic
  // "양자 컴퓨터" -> Should now match the one just registered
  await testTopic("Re-test New Topic (Should Match Now)", "양자 컴퓨터");
}

runTests();
