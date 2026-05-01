/**
 * backfill_today_speed.cjs
 * 오늘(5/1 KST) 분석 레코드의 f_summary(subtitleSummary)와
 * f_fact_spoiler(thumbnail_spoiler)를 새 프롬프트로 재생성해 DB에 덮어씀.
 */
const { Pool } = require('pg');
const path = require('path');
const OpenAI = require('openai').default;

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── 타임스탬프 포맷 ──────────────────────────────────────
function formatSecondsToTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function chunkTranscriptItems(items) {
  const maxChunkSeconds = 120;
  const chunks = [];
  let currentText = '';
  let currentStart = items[0]?.start || 0;
  for (const item of items) {
    currentText += item.text + ' ';
    if (item.start + item.duration - currentStart > maxChunkSeconds) {
      chunks.push({ text: currentText.trim(), start: currentStart });
      currentText = '';
      currentStart = item.start;
    }
  }
  if (currentText) chunks.push({ text: currentText.trim(), start: currentStart });
  return chunks;
}

function coalesceChunks(chunks, maxChunks) {
  if (chunks.length <= maxChunks) return chunks.map(c => ({ text: c.text, startTime: formatSecondsToTimestamp(c.start) }));
  const factor = Math.ceil(chunks.length / maxChunks);
  const result = [];
  for (let i = 0; i < chunks.length; i += factor) {
    const slice = chunks.slice(i, i + factor);
    result.push({ text: slice.map(s => s.text).join(' '), startTime: formatSecondsToTimestamp(slice[0].start) });
  }
  return result;
}

// ── Few-shot 예시 ────────────────────────────────────────
const fewShotExample = `[가상의 낚시 영상 분석 예시]
🚨경고: 아래 예시의 타임스탬프(03:12 등)와 목차 형식을 절대 그대로 베끼지 마라! 반드시 '실제 자막'의 진짜 시간과 흐름에 맞춰 새롭게 작성하라.
{
  "subtitleSummary": "00:00 - 은퇴 후 상가 투자 실패 사례: 노후 자금 함정 경고\\n03:12 - 고정 수익의 함정과 투자 위험성 분석\\n08:45 - 신도시 상가 분양: 최악의 투자 1위로 명확히 지목\\n11:30 - SCHD ETF·국채: 안전한 대안 2가지 실명 공개",
  "thumbnail_spoiler": [
    {
      "topic": "최악의 투자 1위: 신도시 상가 분양",
      "text": "[출처: 유튜버의 개인 주장] 노후에 고정 수익을 노리고 접근하기 쉬운 투자법의 위험성을 경고함. 영상에서 꼽은 최악의 투자는 '신도시 상가 분양'으로, 높은 공실률 때문에 절대 피해야 한다고 명확히 지목함.",
      "ts": "08:45"
    },
    {
      "topic": "안전한 대안 2가지: SCHD ETF·국채",
      "text": "[출처: 유튜버의 개인 주장] 상가 투자 대신 노후 자금을 지킬 수 있는 안전한 대안으로 '미국 배당 성장 ETF(SCHD)'와 '국채 매입'을 구체적인 정답으로 제시함.",
      "ts": "11:30"
    }
  ]
}`;

// ── OpenAI Speed 분석 ────────────────────────────────────
async function runSpeedAnalysis(channelName, title, transcriptItems, transcriptText) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const chunks = transcriptItems && transcriptItems.length > 0
    ? coalesceChunks(chunkTranscriptItems(transcriptItems), 50)
    : [];
  const quickSummary = chunks.length > 0
    ? chunks.map(c => `[${c.startTime}] ${c.text}`).join('\n')
    : (transcriptText || '').substring(0, 10000);

  const prompt = `
## 1. Role
너는 시청자의 시간을 아껴주는 무자비한 '유튜브 스포일러 머신'이다.
영상의 서론이나 잡담은 무시하고, 제목과 썸네일에서 던진 '미끼(궁금증)'에 대한 '정확한 명사형 정답(종목명, 인물명, 장소 등)'을 핀셋처럼 추출하라.

## 2. Analysis Instructions
- 팩트 추출: '어떤 종목', '특정 인물'처럼 모호하게 얼버무리지 마라. 영상에 등장한 [실제 종목명/인물명/구체적 행동]을 반드시 명시하라.
- 요약의 기준: 기계적인 시간 단위 분할을 금지한다. 영상의 '논리적 흐름(도입 → 문제 제기 → 해결책 → 결론)'이 바뀔 때마다 타임스탬프를 분할하라.

## 3. Thumbnail Spoiler Rules
- 제목과 썸네일이 유도한 핵심 궁금증을 'topic'으로 잡는다 — 반드시 실제 결론 키워드(종목명, 인물명, 사건명)로 작성하라.
- 'text' 필드에는 해당 결론이 나오게 된 배경을 짧게 요약하고, 마지막에 반드시 [진짜 정답]을 돌직구로 밝혀라.
- 각 항목 text 필드 맨 앞에 반드시 [출처: ...] 태그를 명시하라.

## 4. 🌟 OUTPUT FORMAT & EXAMPLE (CRITICAL) 🌟
반드시 아래의 JSON 구조와 완벽하게 동일한 형식, 어조, 디테일 수준으로 작성하라.
절대 이 JSON 구조를 벗어나거나 불필요한 설명 텍스트를 덧붙이지 마라.

${fewShotExample}

[실제 분석 대상 데이터]
채널명: ${channelName}
제목: ${title}
자막 내용:
${quickSummary}
`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    top_p: 0.9,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: "You are a YouTube spoiler machine that outputs only valid JSON. Follow the user's instructions and example format exactly." },
      { role: 'user', content: prompt },
    ],
  });

  const rawText = response.choices[0].message.content || '';
  return JSON.parse(rawText);
}

// ── 메인 ─────────────────────────────────────────────────
async function main() {
  const db = await pool.connect();
  try {
    // 5/1 KST = UTC 4/30 15:00 ~ 5/1 15:00
    const res = await db.query(`
      SELECT a.f_id, a.f_title, a.f_created_at,
             c.f_title AS channel_name,
             a.f_transcript
      FROM t_analyses a
      LEFT JOIN t_channels c ON c.f_channel_id = a.f_channel_id
      WHERE a.f_created_at >= '2026-04-30 15:00:00+00'
        AND a.f_created_at <  '2026-05-01 15:00:00+00'
      ORDER BY a.f_created_at DESC
      LIMIT 4
    `);

    if (res.rows.length === 0) {
      console.log('⚠️  오늘(5/1 KST) 분석 없음 — 최근 4개로 대체합니다.');
      const fallback = await db.query(`
        SELECT a.f_id, a.f_title, a.f_created_at,
               c.f_title AS channel_name,
               a.f_transcript
        FROM t_analyses a
        LEFT JOIN t_channels c ON c.f_channel_id = a.f_channel_id
        ORDER BY a.f_created_at DESC
        LIMIT 4
      `);
      res.rows.push(...fallback.rows);
    }

    console.log(`\n✅ 백필 대상 ${res.rows.length}개\n${'='.repeat(60)}`);

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const num = i + 1;
      console.log(`\n[${num}/${res.rows.length}] ${row.f_title}`);
      console.log(`  채널: ${row.channel_name || '알 수 없음'}  |  시각: ${new Date(row.f_created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);

      try {
        const result = await runSpeedAnalysis(
          row.channel_name || '알 수 없음',
          row.f_title || '(제목 없음)',
          [],
          row.f_transcript || ''
        );

        const newSummary = result.subtitleSummary || '';
        const newSpoiler = Array.isArray(result.thumbnail_spoiler) ? result.thumbnail_spoiler : [];

        // ── DB 덮어쓰기 ──────────────────────────────────
        await db.query(`
          UPDATE t_analyses
          SET f_summary      = $2,
              f_fact_spoiler = $3,
              f_last_action_at = NOW()
          WHERE f_id = $1
        `, [
          row.f_id,
          newSummary,
          JSON.stringify(newSpoiler)
        ]);

        console.log('  ✅ DB 업데이트 완료');
        console.log('  ── subtitleSummary ──');
        newSummary.split('\n').forEach(line => console.log('  ' + line));

        console.log('  ── thumbnail_spoiler ──');
        newSpoiler.forEach((sp, idx) => {
          console.log(`  [${idx + 1}] topic : ${sp.topic}`);
          console.log(`       ts    : ${sp.ts}`);
          console.log(`       text  : ${sp.text}`);
        });
        console.log('\n' + '-'.repeat(60));

      } catch (err) {
        console.error(`  ❌ 실패: ${err.message}`);
      }
    }

    console.log('\n🎉 백필 완료. 페이지 새로고침하면 반영됩니다.');
  } finally {
    db.release();
    pool.end();
  }
}

main();
