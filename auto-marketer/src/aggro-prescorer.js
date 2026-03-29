/**
 * 섹션2: 오픈소스 AI 사전 스코어링 모듈
 * Ollama + Qwen 2.5 7B 로컬 추론으로 어그로성 점수(0~100)를 매긴다.
 * 비용: 0원 (로컬 추론)
 */
const axios = require('axios');
const config = require('./config');

const OLLAMA_GENERATE_URL = () => `${config.ollamaUrl}/api/generate`;

const SYSTEM_PROMPT = `너는 유튜브 영상 제목만 보고 "이 영상이 LLM 팩트체크 분석을 할 가치가 있는가"를 판단하는 사전 필터다.
판단 기준: 제목 문구 자체가 사실을 과장·단정·공포 유도·오해 유발하는 표현을 쓰는가.

반드시 아래 JSON 형식으로만 응답하라. 다른 텍스트는 절대 포함하지 마라.
{"clickbait_score": 0~100 정수, "reason": "한국어 한 줄"}

규칙:
- 5점 단위 정수(0, 5, 10 ... 100)로만 답하라.
- 사실 보도/정보 전달 형식 제목 → 10~30
- 자극적 표현이 있으나 단정/공포 약함 → 35~55
- 허위 단정·공포 유도·확정 표현 명확 → 60~85
- reason은 반드시 한국어로 작성하라.

--- 예시 ---
제목: 불법 화물차 단속현장
{"clickbait_score": 15, "reason": "사실 보도 형식, 단정·공포 표현 없음"}

제목: 정부의 '교회 해산법' 추진... 분노 폭발한 기독교계
{"clickbait_score": 20, "reason": "뉴스 보도 형식, '분노'는 취재 대상 반응 묘사이며 허위 단정 아님"}

제목: 아이폰 iOS26.4 정식 신기능 및 핵심 변화점 총정리
{"clickbait_score": 10, "reason": "신제품 리뷰·소개 형식, 사실 기반 정보 전달"}

제목: 변호사가 갤럭시만 쓰는 이유 10가지
{"clickbait_score": 20, "reason": "정보 전달형 리스트, '이유 N가지' 패턴은 단정·공포 없는 정보 콘텐츠"}

제목: 게임을 좋아할수록 PC방 데이터가 위험한 이유
{"clickbait_score": 20, "reason": "정보·교육형, 위험성 설명 콘텐츠 패턴, 허위 단정 없음"}

제목: 요즘 소형발전기 마저 사라지게한(?) 슈퍼플럭스 파워뱅크?
{"clickbait_score": 15, "reason": "제품 리뷰 형식, '?' 사용으로 단정 없음"}

제목: 지코바 먹을 줄 아는 사람의 지코바 물밥 먹는 법 공개
{"clickbait_score": 15, "reason": "음식·라이프스타일 정보 영상, 과장 표현 없음"}

제목: 미국이 이란을 박살 낸 소름 돋는 진짜 이유
{"clickbait_score": 30, "reason": "설명·분석형 제목, 자극적 표현 있으나 사실 기반 해설 콘텐츠 패턴"}

제목: 결정사 현실 남편상에 여자들이 분노하는 이유
{"clickbait_score": 35, "reason": "감정 유발 훅이나 허위 단정 약함"}

제목: 이수연이 할머니께 선물한 새 집 최초 공개! 충격적인 월수입 수준!
{"clickbait_score": 60, "reason": "느낌표 반복·최초 공개·충격적 등 과장 표현 다수"}

제목: 전재산 걸고 상한가 종목 예언합니다
{"clickbait_score": 75, "reason": "강한 단정 표현, 공포/탐욕 유도"}

제목: 매불쇼 충격 폭로! 의원들 실체
{"clickbait_score": 65, "reason": "과장 단정 표현 반복, 내용 불명확"}
--- 예시 끝 ---`;

function sampleTranscriptForPrompt(transcript) {
  const text = String(transcript || '').trim();
  if (!text) return '';
  const MAX = 8000;
  if (text.length <= MAX) return text;

  // 본진 analyzer.trimTranscript와 동일한 4분할 샘플링
  // 앞 40% / 중간1 20% / 중간2 20% / 끝 20%
  const s1 = Math.floor(MAX * 0.4);
  const s2 = Math.floor(MAX * 0.2);
  const s3 = Math.floor(MAX * 0.2);
  const s4 = MAX - s1 - s2 - s3;
  const len = text.length;

  const start = text.substring(0, s1);
  const mid1 = text.substring(Math.floor(len * 0.33), Math.floor(len * 0.33) + s2);
  const mid2 = text.substring(Math.floor(len * 0.66), Math.floor(len * 0.66) + s3);
  const end = text.substring(len - s4);

  return `${start}\n...(중략)...\n${mid1}\n...(중략)...\n${mid2}\n...(중략)...\n${end}`;
}

function buildPrompt(title) {
  return `제목: ${title}\nJSON으로만 반환하라:`;
}

function toScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, Math.round(n)));
  return Math.round(clamped / 5) * 5;
}

function extractJsonCandidate(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const block = text.match(/\{[\s\S]*\}/);
  if (block?.[0]) return block[0].trim();

  return null;
}

function sanitizeJsonText(input) {
  return String(input || '')
    .replace(/[\u0000-\u001F]/g, ' ')
    .replace(/,(\s*[}\]])/g, '$1')
    .trim();
}

function parseAggroJson(raw) {
  const candidate = extractJsonCandidate(raw);
  if (!candidate) return null;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    // 모델 응답에 제어문자/트레일링 콤마가 섞인 경우 보정 재시도
    const sanitized = sanitizeJsonText(candidate);
    return JSON.parse(sanitized);
  }
}

function calibrateScore(parsed) {
  // 신규 스키마 우선: clickbait_score
  const preferred =
    toScore(parsed.clickbait_score) ??
    toScore(parsed.clickbait) ??
    toScore(parsed.score);
  if (preferred !== null) return preferred;

  // 구스키마 하위호환
  return (
    toScore(parsed.bait) ??
    toScore(parsed.title_bait) ??
    toScore(parsed.misleading) ??
    toScore(parsed.fear) ??
    0
  );
}

/**
 * 단일 영상의 어그로성 사전 스코어링
 * @param {string} title - 영상 제목
 * @param {string} transcript - 자막 텍스트 (앞부분)
 * @returns {Promise<{score: number, reason: string}>}
 */
async function scoreAggro(title, transcript) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await axios.post(OLLAMA_GENERATE_URL(), {
        model: config.ollamaModel,
        prompt: buildPrompt(title),
        system: SYSTEM_PROMPT,
        stream: false,
        options: {
          temperature: 0.15,
          top_p: 0.8,
          num_predict: 120,
          seed: 42,
        },
      }, {
        timeout: attempt === 1 ? 60000 : 90000,
      });

      const raw = (res.data?.response || '').trim();
      const parsed = parseAggroJson(raw);
      if (!parsed) {
        throw new Error('JSON 파싱 실패');
      }

      const score = calibrateScore(parsed);

      const reason = String(parsed.reason || '').substring(0, 200);
      return { score, reason };
    } catch (err) {
      const msg = err?.message || 'unknown';
      const isLast = attempt >= maxAttempts;
      if (!isLast) {
        console.warn(`[PreScorer] 재시도 ${attempt}/${maxAttempts - 1}: ${msg}`);
        continue;
      }

      console.error(`[PreScorer] Ollama 호출 실패:`, msg);
      // fallback 점수는 컷라인보다 낮게 둬서 장애가 곧바로 통과로 이어지지 않도록 함
      return { score: 45, reason: `Ollama 일시장애 fallback: ${String(msg).substring(0, 120)}` };
    }
  }
}

/**
 * 배치 스코어링 — 영상 배열에 대해 순차적으로 어그로 점수 매기기
 * @param {Array<{title: string, transcript?: string, videoId: string}>} videos
 * @param {Function} progressCallback - 진행 상황 콜백 (현재 완료 개수)
 * @returns {Promise<Array<{videoId, title, score, reason}>>}
 */
async function batchScoreAggro(videos, progressCallback = null) {
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
    
    // 진행 상황 콜백
    if (progressCallback) {
      progressCallback(i + 1);
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
