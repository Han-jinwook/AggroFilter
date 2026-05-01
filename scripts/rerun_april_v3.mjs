import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function analyze(channelName, title, transcript, userLanguage, thumbnailUrl) {
  const prompt = `
    ## 1. 역할
    너는 유튜브 생태계 분석가다. 시청자가 실제로 "속았다"고 느끼는지 여부를 핵심 기준으로 점수를 매겨라.

    ## 2. 분석 지침 (Critical Instructions)
    3. **타임스탬프 요약 가이드 (상세 요약 모드)**:
        - **자막 전수 분석**: 처음부터 끝까지 빠짐없이 분석하여 핵심 정보를 누락하지 마라.
        - **타임라인 정밀도**: 챕터 시작 시점은 문맥상의 실제 시점을 정확히 기록하라.
        - **성의 있는 상세 요약**: 단순히 한 줄 소제목으로 끝내지 마라. 각 챕터마다 [소제목]을 먼저 적고, 줄바꿈 후 해당 구간의 핵심 내용을 **2~3문장(3~4줄)** 정도로 상세히 요약하라.
        - **팩트 위주 요약**: 유튜버가 무엇을 근거로 어떤 결론을 내렸는지 논리 구조가 보이게 작성하라.
        - **요약 밀도**: 영상 10분당 약 2~3개의 챕터 분할을 유지하라.
        - **형식**: 'MM:SS - [소제목]\\n상세 요약 내용 1...\\n상세 요약 내용 2...'

    ## 3. ⚠️ 썸네일 스포일러 (Thumbnail Spoiler) — 황금비율 규칙 (V2)
    오직 **제목과 썸네일 이미지가 던진 '궁금증(떡밥)'**을 1~3개 추출하고, 해당 떡밥에 대해 영상에서 언급된 모든 내용을 종합하여 결론을 공개하라.

    ### 작성 규칙 (엄격)
    - **출처 표기 필수**: 반드시 구체적인 출처 유형으로 문장을 시작하라. (예: [출처: 유튜버의 개인 주장])
    - **금지 사항**: '[출처: ...]' 처럼 점으로 표기하는 행위는 절대 금지한다.
    - **구조**: 각 떡밥당 3~4문장 (도입부 2문장 + 최종 결론 1~2문장).

    ## 4. 출력 형식 (JSON Only)
    반드시 아래 JSON 형식으로만 응답하라. 모든 텍스트는 ${userLanguage === 'korean' ? '한국어' : 'English'}로 작성하라.

    {
      "subtitleSummary": "0:00 - [챕터 제목]\\n이 구간에서 유튜버는 무엇에 대해 이야기합니다. 구체적으로 A라는 근거를 들어 B라는 결론을 도출합니다.\\n\\n0:45 - [다음 챕터]\\n본문 요약 내용...",
      "thumbnail_spoiler": [
        { 
          "topic": "떡밥 키워드", 
          "text": "[출처: 구체적유형 명시] 유튜버의 배경 설명과 최종 결론을 포함한 종합 요약", 
          "ts": "MM:SS" 
        }
      ]
    }

    [분석 대상 데이터]
    채널명: ${channelName}
    제목: ${title}
    자막 데이터:
    ${transcript.substring(0, 8000)}
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.1,
    top_p: 0.9,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a precise JSON-only assistant. Provide detailed 3-4 line summaries for each chapter.' },
      { role: 'user', content: prompt }
    ]
  });

  const parsed = JSON.parse(response.choices[0].message.content || '{}');
  return parsed;
}

async function main() {
  // 4월 한 달간 분석된 모든 영상 조회
  const res = await pool.query(`
    SELECT a.f_id, a.f_title, a.f_transcript, a.f_thumbnail_url, a.f_language, c.f_title as channel_name
    FROM t_analyses a
    LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
    WHERE a.f_created_at >= '2026-04-01' AND a.f_created_at < '2026-05-01'
    ORDER BY a.f_created_at DESC
  `);

  console.log(`🚀 4월Batch 재분석 시작: 총 ${res.rows.length}개 영상`);

  for (const [index, row] of res.rows.entries()) {
    try {
      console.log(`[${index + 1}/${res.rows.length}] 분석 중: ${row.f_title}`);
      const result = await analyze(
        row.channel_name || '알 수 없음',
        row.f_title,
        row.f_transcript,
        row.f_language === 'en' ? 'english' : 'korean',
        row.f_thumbnail_url || ''
      );

      if (result.subtitleSummary && result.thumbnail_spoiler) {
        await pool.query(
          "UPDATE t_analyses SET f_summary = $1, f_fact_spoiler = $2 WHERE f_id = $3",
          [result.subtitleSummary, JSON.stringify(result.thumbnail_spoiler), row.f_id]
        );
        console.log(`   ✅ 업데이트 완료 (ID: ${row.f_id})`);
      }
    } catch (err) {
      console.error(`   ❌ 실패 (ID: ${row.f_id}):`, err.message);
    }
  }

  console.log('🏁 4월Batch 일괄 재분석 작업이 완료되었습니다.');
  await pool.end();
}

main();
