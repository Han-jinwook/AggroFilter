/**
 * 썸네일 스포일러 백필 스크립트
 * 
 * 기존 분석 데이터(t_analyses)에서 f_fact_spoiler가 없거나 구형식(string)인 레코드를 찾아
 * Gemini로 스포일러 배열을 생성하여 업데이트합니다.
 * 
 * 사용법:
 *   node scripts/backfill-spoiler.cjs                    # 전체 대상 (기본 limit 100)
 *   node scripts/backfill-spoiler.cjs --limit 50         # 50건만
 *   node scripts/backfill-spoiler.cjs --offset 100       # 100번째부터
 *   node scripts/backfill-spoiler.cjs --dry-run           # 대상 목록만 확인 (API 호출 안 함)
 *   node scripts/backfill-spoiler.cjs --delay 8000        # 호출 간격 8초 (기본 5초)
 */

const { Pool } = require('pg');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// ── .env 로드 ──
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
}

// ── CLI 인자 파싱 ──
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultVal;
  if (typeof defaultVal === 'boolean') return true;
  return args[idx + 1] ? parseInt(args[idx + 1], 10) : defaultVal;
}

const LIMIT = getArg('limit', 100);
const OFFSET = getArg('offset', 0);
const DRY_RUN = getArg('dry-run', false);
const DELAY_MS = getArg('delay', 5000);

// ── DB 연결 ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Gemini 초기화 ──
const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ GOOGLE_API_KEY가 설정되지 않았습니다.');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });

// ── 스포일러 전용 경량 프롬프트 ──
function buildSpoilerPrompt(title, transcript) {
  const isKoreanTitle = /[가-힣]/.test(title);
  
  return `너는 유튜브 영상의 "썸네일 스포일러" 전문 분석기이다.
아래 영상의 제목과 자막을 보고, 제목/썸네일이 시청자에게 던진 떡밥(궁금증)을 소주제별로 분해하고,
각 소주제에 대한 영상 속 팩트를 자막에서 핀셋 추출하라.

## 규칙
1. 제목에서 시청자가 궁금해할 소주제(키워드/문장)를 1~4개로 분리 (절대 4개 초과 금지)
2. 각 소주제에 대해 자막에서 정확한 팩트(대답) 부분을 인용 (장황한 요약 금지, 원문에 가깝게)
3. 각 항목 text 맨 앞에 [출처: ...] 태그 필수
   - [출처: 유튜버의 개인 주장] / [출처: 공식 언론 보도 인용] / [출처: 전문가 인터뷰 인용] / [출처: 확인 불가]
4. 낚시여서 팩트가 없으면: "[출처: 확인 불가] 정확히 일치하는 팩트 언급은 없으나, ~라는 언급이 가장 유사함"
5. ts는 자막의 타임스탬프 "MM:SS" 형식. 없으면 null
6. 시간순(ts 오름차순) 정렬
${isKoreanTitle ? '7. 제목이 한국어인데 화자가 외국어로 발화한 경우, 원문 뒤에 (한국어 번역) 괄호 추가' : ''}

## 입력
제목: ${title}

자막:
${transcript.substring(0, 30000)}

## 출력 (JSON Only, 다른 텍스트 금지)
{
  "thumbnail_spoiler": [
    { "topic": "소주제 키워드", "text": "[출처: ...] 팩트 인용", "ts": "MM:SS" }
  ]
}`;
}

// ── Gemini 호출 (재시도 포함) ──
async function callGemini(prompt, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
        config: { thinkingConfig: { thinkingBudget: 0 } },
      });
      return result.text;
    } catch (err) {
      const isTransient = err.status === 429 || err.status === 503 || err.message?.includes('timeout');
      if (isTransient && i < retries - 1) {
        const delay = DELAY_MS * Math.pow(2, i);
        console.warn(`  ⚠️ 재시도 ${i + 1}/${retries} (${delay}ms 대기)... ${err.message}`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
}

// ── JSON 파싱 ──
function parseSpoilerResponse(text) {
  if (!text) return null;
  let jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
  const first = jsonStr.indexOf('{');
  const last = jsonStr.lastIndexOf('}');
  if (first !== -1 && last !== -1) jsonStr = jsonStr.substring(first, last + 1);

  const parsed = JSON.parse(jsonStr);
  const spoiler = parsed.thumbnail_spoiler;
  
  if (!Array.isArray(spoiler) || spoiler.length === 0) return null;
  
  // 유효성 검증 + 최대 4개 제한
  return spoiler
    .filter(item => item && typeof item.text === 'string' && item.text.length > 0)
    .slice(0, 4);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 메인 실행 ──
async function main() {
  const client = await pool.connect();
  
  try {
    // 1. 대상 조회: f_fact_spoiler가 NULL이거나 구형식(배열이 아닌 string)인 레코드
    //    + f_is_valid = true (분석 완료된 것만)
    //    + f_transcript가 있는 것만
    const countRes = await client.query(`
      SELECT COUNT(*) as cnt FROM t_analyses
      WHERE f_is_valid = true
        AND f_transcript IS NOT NULL AND LENGTH(f_transcript) > 100
        AND (f_fact_spoiler IS NULL OR (f_fact_spoiler IS NOT NULL AND f_fact_spoiler NOT LIKE '[{%'))
    `);
    const totalCount = parseInt(countRes.rows[0].cnt, 10);
    
    console.log(`\n📊 백필 대상: ${totalCount}건`);
    console.log(`   설정: LIMIT=${LIMIT}, OFFSET=${OFFSET}, DELAY=${DELAY_MS}ms`);
    console.log(`   모드: ${DRY_RUN ? '🔍 DRY-RUN (확인만)' : '🚀 실행'}\n`);

    const targetRes = await client.query(`
      SELECT f_id, f_title, f_transcript, f_language, f_fact_spoiler
      FROM t_analyses
      WHERE f_is_valid = true
        AND f_transcript IS NOT NULL AND LENGTH(f_transcript) > 100
        AND (f_fact_spoiler IS NULL OR (f_fact_spoiler IS NOT NULL AND f_fact_spoiler NOT LIKE '[{%'))
      ORDER BY f_created_at DESC
      LIMIT $1 OFFSET $2
    `, [LIMIT, OFFSET]);

    const targets = targetRes.rows;
    console.log(`📋 이번 배치: ${targets.length}건\n`);

    if (DRY_RUN) {
      targets.forEach((row, i) => {
        const spoilerStatus = row.f_fact_spoiler ? '구형식(string)' : 'NULL';
        console.log(`  ${i + 1}. [${row.f_id}] ${(row.f_title || '').substring(0, 50)}... (${spoilerStatus})`);
      });
      console.log(`\n✅ dry-run 완료. 실제 실행하려면 --dry-run 플래그를 제거하세요.`);
      return;
    }

    // 2. 순차 처리
    let success = 0, fail = 0, skip = 0;

    for (let i = 0; i < targets.length; i++) {
      const row = targets[i];
      const title = row.f_title || '';
      const transcript = row.f_transcript || '';
      const shortTitle = title.substring(0, 60);

      process.stdout.write(`[${i + 1}/${targets.length}] ${shortTitle}... `);

      if (!title || transcript.length < 100) {
        console.log('⏭️ SKIP (자막 부족)');
        skip++;
        continue;
      }

      try {
        const prompt = buildSpoilerPrompt(title, transcript);
        const responseText = await callGemini(prompt);
        const spoilerArr = parseSpoilerResponse(responseText);

        if (!spoilerArr || spoilerArr.length === 0) {
          console.log('⏭️ SKIP (파싱 실패 또는 빈 결과)');
          skip++;
          continue;
        }

        // DB 업데이트
        await client.query(
          `UPDATE t_analyses SET f_fact_spoiler = $1 WHERE f_id = $2`,
          [JSON.stringify(spoilerArr), row.f_id]
        );

        console.log(`✅ ${spoilerArr.length}개 소주제`);
        success++;

      } catch (err) {
        console.log(`❌ ERROR: ${err.message}`);
        fail++;
      }

      // Rate limiting
      if (i < targets.length - 1) {
        await sleep(DELAY_MS);
      }
    }

    // 3. 결과 리포트
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📊 결과: ✅ 성공 ${success} / ❌ 실패 ${fail} / ⏭️ 스킵 ${skip}`);
    console.log(`   남은 대상: ${Math.max(0, totalCount - OFFSET - targets.length)}건`);
    if (totalCount > OFFSET + LIMIT) {
      console.log(`   다음 실행: node scripts/backfill-spoiler.cjs --offset ${OFFSET + LIMIT} --limit ${LIMIT}`);
    }
    console.log(`${'─'.repeat(50)}\n`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('💥 치명적 오류:', err);
  process.exit(1);
});
