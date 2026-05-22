import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  // 1. DB에서 kHAdm27c97Q 조회
  const client = await pool.connect();
  const res = await client.query("SELECT * FROM t_analyses WHERE f_video_id = 'kHAdm27c97Q' ORDER BY f_created_at DESC LIMIT 1");
  const video = res.rows[0];
  client.release();
  await pool.end();

  if (!video) {
    console.error("Video not found");
    return;
  }

  // 2. prompt 구성 (systemPrompt + finalPrompt)
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' });
  const uploadDateStr = video.f_published_at
    ? new Date(video.f_published_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
    : null;

  // 단순화한 프롬프트 대신 실제 gemini.ts의 systemPrompt와 유사하게 구성
  const systemPrompt = `
    # 어그로필터 분석 AI용 프롬프트 (유튜브 생태계 분석가 모드)
    - **현재 날짜**: ${today}
    - **영상 업로드일**: ${uploadDateStr || '알 수 없음'}
    - **너의 학습 데이터 종료 시점**: 2024년 10월
    - **⚠️ 절대 규칙**: 2024년 11월 이후의 정보는 너의 학습 데이터가 아닌 **Google Search 결과만을 신뢰**하라.
    
    ## 검색 도구 활용 가이드 (Google Search) — ⚠️ 최우선 규칙
    - **필수 검색 대상**: 인물의 현재 직책/직위, 최신 기술/제품, 2024년 11월 이후 사건·정책·논란
    - **검색 결과 절대 우선**: 검색 결과와 너의 학습 데이터(2024년 10월)가 충돌하면 **무조건 검색 결과를 따르라**.
    
    ### ⚠️ 필수 검색 트리거 (MANDATORY SEARCH — 위반 시 분석 무효)
    아래 키워드가 제목 또는 자막에 포함되면 **반드시** Google Search를 실행한 후 사실 판단하라:
    - 선거, 경선, 투표, 대선, 총선, 보궐, 지방선거, 당선, 낙선, 출마, 사퇴, 탄핵, 임명, 해임, 국회, 여당, 야당, 민주당, 국민의힘, 대통령, 지사, 시장, 의원, 이재명, 이재용, 윤석열
  `;

  const finalPrompt = `
    ${systemPrompt}
    
    ⚠️ [MANDATORY GOOGLE SEARCH REQUIRED]
    이 영상은 2024년 11월 1일 이후 최신 영상이거나 팩트체크가 매우 중요합니다. 반드시 Google Search 도구를 활용해 최근 관련 사실을 확인하여 정확성 점수를 매기세요.

    [분석 대상 데이터]
    채널명: 알 수 없음
    제목: ${video.f_title}
    자막 내용:
    ${video.f_transcript?.substring(0, 4000)}
  `;

  console.log("Sending request to Gemini 2.5-flash with Google Search tool...");
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: finalPrompt,
    config: {
      temperature: 0.2,
      topP: 0.85,
      tools: [{ googleSearch: {} }],
    }
  });

  const candidate = response.candidates?.[0];
  console.log("--- Candidate 0 Response ---");
  console.log(candidate?.content?.parts?.[0]?.text);
  console.log("\n--- Grounding Metadata ---");
  console.log(JSON.stringify(candidate?.groundingMetadata, null, 2));
}

run().catch(console.error);
