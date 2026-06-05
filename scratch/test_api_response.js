const fs = require('fs');
const path = require('path');

// Manually load .env variables
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) {
      process.env.DATABASE_URL = match[1].trim();
      break;
    }
  }
}

const { GET } = require('../app/api/analysis/result/[id]/route');

// We can mock the request and route params to test the API directly
const mockRequest = {
  url: 'http://localhost:3000/api/analysis/result/b7da6a39-d7ab-46f2-8f18-b4bc99e51dd4'
};

async function test() {
  try {
    const response = await GET(mockRequest, { params: { id: 'b7da6a39-d7ab-46f2-8f18-b4bc99e51dd4' } });
    const data = await response.json();
    console.log('API Response Data:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
