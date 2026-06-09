require('dotenv').config({ path: 'd:/AggroFilter/.env' });

async function run() {
  const url = 'https://www.youtube.com/watch?v=JbeZm0copdk';
  const body = {
    url: url,
    userId: 'trial_test_user_123', // 비회원 선체험 trial_ 임시 UID
    forceRecheck: true,
  };

  console.log(`Sending API request to localhost:3000/api/analysis/request for URL: ${url}`);
  const startTime = Date.now();

  try {
    const res = await fetch('http://localhost:3000/api/analysis/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Response received in ${duration}s (Status: ${res.status}):`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('API call failed:', err);
  }
}

run();
