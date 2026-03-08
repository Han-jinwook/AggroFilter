/**
 * 섹션2: 오픈소스 AI 사전 스코어링 모듈
 * Ollama + Qwen 2.5 7B 로컬 추론으로 어그로성 점수(0~100)를 매긴다.
 * 비용: 0원 (로컬 추론)
 */
const axios = require('axios');
const config = require('./config');

const OLLAMA_GENERATE_URL = () => `${config.ollamaUrl}/api/generate`;

const SYSTEM_PROMPT = `너는 유튜브 영상의 어그로성을 판별하는 전문가다.
어그로성이란: 과장, 낚시, 선정성, 공포 조장, 자극적 표현, 가짜뉴스 가능성을 포함한다.
반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 절대 포함하지 마라.
{"score": 0~100 정수, "reason": "한국어 한 줄 사유"}`;

function buildPrompt(title, transcript) {
  const trimmed = (transcript || '').substring(0, 500);
  return `[제목] ${title}\n[자막 앞부분] ${trimmed}\n\n위 영상의 어그로성 점수를 JSON으로 매겨라.`;
}

/**
 * 단일 영상의 어그로성 사전 스코어링
 * @param {string} title - 영상 제목
 * @param {string} transcript - 자막 텍스트 (앞부분)
 * @returns {Promise<{score: number, reason: string}>}
 */
async function scoreAggro(title, transcript) {
  try {
    const res = await axios.post(OLLAMA_GENERATE_URL(), {
      model: config.ollamaModel,
      prompt: buildPrompt(title, transcript),
      system: SYSTEM_PROMPT,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 150,
      },
    }, {
      timeout: 60000,
    });

    const raw = (res.data?.response || '').trim();

    // JSON 추출 (모델이 마크다운 코드블록으로 감쌀 수 있음)
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn(`[PreScorer] JSON 파싱 실패: ${raw.substring(0, 100)}`);
      return { score: -1, reason: 'JSON 파싱 실패' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const reason = String(parsed.reason || '').substring(0, 200);

    return { score, reason };
  } catch (err) {
    console.error(`[PreScorer] Ollama 호출 실패:`, err.message);
    return { score: -1, reason: `Ollama 에러: ${err.message}` };
  }
}

/**
 * 배치 스코어링 — 영상 배열에 대해 순차적으로 어그로 점수 매기기
 * @param {Array<{title: string, transcript?: string, videoId: string}>} videos
 * @returns {Promise<Array<{videoId, title, score, reason}>>}
 */
async function batchScoreAggro(videos) {
  console.log(`\n[PreScorer] 배치 스코어링 시작: ${videos.length}개 영상`);
  const results = [];

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const transcript = v.transcript || '';
    console.log(`  [PreScorer] (${i + 1}/${videos.length}) ${v.title.substring(0, 40)}...`);

    const { score, reason } = await scoreAggro(v.title, transcript);
    results.push({
      videoId: v.videoId,
      title: v.title,
      score,
      reason,
    });

    if (score >= 0) {
      console.log(`    → 점수: ${score}/100 | ${reason}`);
    } else {
      console.log(`    → 스코어링 실패: ${reason}`);
    }
  }

  const valid = results.filter(r => r.score >= 0);
  const avg = valid.length > 0 ? Math.round(valid.reduce((s, r) => s + r.score, 0) / valid.length) : 0;
  console.log(`[PreScorer] 배치 완료: ${valid.length}/${videos.length}건 성공, 평균 점수: ${avg}`);

  return results;
}

/**
 * Ollama 서버 연결 확인
 */
async function checkOllamaConnection() {
  try {
    const res = await axios.get(`${config.ollamaUrl}/api/tags`, { timeout: 5000 });
    const models = (res.data?.models || []).map(m => m.name);
    const hasModel = models.some(m => m.startsWith(config.ollamaModel.split(':')[0]));
    return {
      connected: true,
      models,
      hasRequiredModel: hasModel,
      requiredModel: config.ollamaModel,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      requiredModel: config.ollamaModel,
    };
  }
}

module.exports = { scoreAggro, batchScoreAggro, checkOllamaConnection };
