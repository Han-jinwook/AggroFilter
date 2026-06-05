async function testAnalysis() {
  const url = 'https://www.youtube.com/watch?v=Vt-tvpLHjF8';
  const userId = '14789296-ecb3-46ca-94b2-b46bba06df8d'; // sundream7878@gmail.com
  const requestUrl = 'http://localhost:3000/api/analysis/request';

  console.log(`🚀 Sending analysis request for ${url} (User: ${userId})`);

  try {
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        userId,
        forceRecheck: true,
      })
    });

    console.log(`📡 Response Status: ${res.status}`);
    const data = await res.json();
    console.log('📡 Response Data:', JSON.stringify(data, null, 2));

  } catch (err) {
    console.error('API Call Failed:', err.message);
  }
}

testAnalysis();
