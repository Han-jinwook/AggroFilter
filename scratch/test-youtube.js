const fs = require('fs');
const path = require('path');

// 간단한 .env 파서
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  console.error('.env 로드 실패:', e);
}

const apiKey = process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY;
console.log('API KEY:', apiKey ? apiKey.substring(0, 8) + '...' : '없음');

async function testVideo() {
  const videoId = 'JbeZm0copdk';
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('--- API 응답 ---');
    console.log(JSON.stringify(data.items?.[0]?.snippet, null, 2));
  } catch (err) {
    console.error('API 호출 실패:', err);
  }
}

testVideo();
