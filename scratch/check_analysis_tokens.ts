import 'dotenv/config';
import { pool } from '../lib/db';

async function main() {
  const userId = '7c81142c-df36-49d4-9b9f-86d297fce55b'; // sundream7878@gmail.com
  console.log(`🔍 [DB] Querying analyses for user: ${userId}`);

  const query = `
    SELECT f_id, f_video_id, f_title, f_tokens_speed, f_tokens_full, f_grounding_count, f_created_at
    FROM t_analyses
    WHERE f_user_id = $1
    ORDER BY f_created_at DESC
    LIMIT 10
  `;

  try {
    const { rows } = await pool.query(query, [userId]);
    console.log(`\n=== Recent Analyses for User ===`);
    rows.forEach((row: any) => {
      console.log(`Date: ${row.f_created_at}`);
      console.log(`Title: "${row.f_title}" (ID: ${row.f_video_id})`);
      console.log(`Tokens: Speed=${row.f_tokens_speed}, Full=${row.f_tokens_full}, SearchCount=${row.f_grounding_count}`);
      
      // 토큰 합산 및 코스트 계산
      const speed = Number(row.f_tokens_speed || 0);
      const full = Number(row.f_tokens_full || 0);
      const search = Number(row.f_grounding_count || 0);
      const searchTokens = search * 50000;
      const totalRawTokens = speed + full + searchTokens;
      const rawCost = Math.max(1, totalRawTokens / 10);
      
      // 원래 청구되었어야 할 코인 계산
      // AggroFilter의 마진 배수는 3배이고 token_to_coin_rate는 1000입니다.
      const rawCostInCoins = rawCost / 1000;
      const fixedCoinPrice = Math.ceil(rawCostInCoins * 3);
      const finalPrice = Math.max(10, fixedCoinPrice);
      
      console.log(`Calculated Total Tokens: ${totalRawTokens} | RawCost: ${rawCost.toFixed(2)}`);
      console.log(`👉 Correct Price should be: ${finalPrice}C (min 10C)`);
      console.log('---------------------------------------------');
    });
  } catch (err: any) {
    console.error('❌ Query failed:', err.message);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
