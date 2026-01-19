
require('dotenv').config();

async function testAnalysis() {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Astley
  console.log('Testing analysis for:', url);

  try {
    const response = await fetch('http://localhost:3000/api/analysis/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, userId: 'test@example.com' }),
    });

    const status = response.status;
    const data = await response.json();

    console.log('Status:', status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during fetch:', error.message);
  }
}

testAnalysis();
