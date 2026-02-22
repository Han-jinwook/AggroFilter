const axios = require('axios');
require('dotenv').config();

/**
 * Cafe24 Webhook Simulator
 * 
 * 이 스크립트는 Cafe24에서 결제가 완료되었을 때 날아오는 Webhook을 시뮬레이션합니다.
 * 실제 DB에 크레딧이 충전되는지 테스트할 때 사용하세요.
 */

const TARGET_URL = 'http://localhost:3000/api/cafe24/webhook';
const WEBHOOK_SECRET = process.env.CAFE24_WEBHOOK_SECRET || 'test_secret';

async function simulateWebhook() {
  const orderId = `TEST-${Date.now()}`;
  const buyerEmail = process.argv[2] || 'test@example.com';
  
  console.log(`🚀 Simulating Webhook for: ${buyerEmail}`);
  console.log(`📦 Order ID: ${orderId}`);

  // Cafe24 Webhook Payload 구조 (단순화)
  const payload = {
    event_id: `evt_${Date.now()}`,
    event_type: 'order.paid',
    order_id: orderId,
    // 실제 webhook은 body에 많은 정보가 있지만, 우리 API는 order_id로 다시 조회하거나 
    // 전달된 데이터를 신뢰합니다.
  };

  try {
    const response = await axios.post(`${TARGET_URL}?secret=${WEBHOOK_SECRET}`, payload);
    console.log('✅ Response:', response.status, response.data);
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.data || error.message);
    console.log('\n💡 Tip: 서버가 실행 중인지(npm run dev), .env에 CAFE24_WEBHOOK_SECRET이 설정되어 있는지 확인하세요.');
  }
}

if (!process.argv[2]) {
  console.log('Usage: node scripts/simulate_webhook.cjs <user_email>');
  process.exit(1);
}

simulateWebhook();
