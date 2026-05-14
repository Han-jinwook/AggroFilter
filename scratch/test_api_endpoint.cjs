// Test the actual API endpoint with real DB data
const http = require('http');

async function testAPI() {
  const analysisId = '40c13bcf-0d72-4d51-9e3e-73da9cd6ed7d'; // Latest from DB
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/analysis/result/${analysisId}`,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const evalReason = json.analysisData?.evaluationReason;
          
          console.log('=== API Response Evaluation Reason (First 500 chars) ===');
          console.log(evalReason?.substring(0, 500));
          
          console.log('\n=== Format Verification ===');
          console.log('Has "1. 내용 정확성 검증 (90점):":', evalReason?.includes('1. 내용 정확성 검증 (90점):'));
          console.log('Has "2. 어그로성 평가 (35점":', evalReason?.includes('2. 어그로성 평가 (35점'));
          console.log('Has "3. 신뢰도 총평 (78점)":', evalReason?.includes('3. 신뢰도 총평 (78점)'));
          
          resolve();
        } catch (e) {
          console.error('Parse error:', e);
          console.log('Raw response:', data.substring(0, 500));
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(e);
    });

    req.end();
  });
}

// Wait a bit for server to be ready
setTimeout(() => {
  testAPI().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  }).catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  });
}, 2000);
