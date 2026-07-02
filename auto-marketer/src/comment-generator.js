/**
 * 섹션2: 댓글 텍스트 생성기
 * - 유튜브 영상 분석 결과 기반: 점수별 고정 템플릿 (Gemini 불필요)
 * - 에펨코리아 게시글 기반: Gemini로 문맥 맞춤 댓글 생성
 */
const axios = require('axios');
const config = require('./config');

// 점수 기반 등급 산정
function getGrade(trustScore) {
  if (trustScore <= 30) return 'F';
  if (trustScore <= 50) return 'C';
  if (trustScore <= 75) return 'B';
  if (trustScore <= 90) return 'A';
  return 'S';
}

// 유튜브 영상용 템플릿 댓글 (고정 텍스트, Gemini 불필요 → 비용 0)
const YT_TEMPLATES = {
  F: (link) =>
    `🚨 [어그로필터 팩트체크] 주의!\n이 영상의 팩트 신뢰도가 매우 낮습니다. AI가 제목과 실제 내용의 불일치를 감지했어요.\n자세한 분석 결과 → ${link}`,
  C: (link) =>
    `⚠️ [어그로필터 팩트체크]\n이 영상, 자극적인 과장이 일부 포함되어 있습니다. 鵜呑みにする前に 확인해 보세요.\n상세 분석 → ${link}`,
  B: (link) =>
    `📊 [어그로필터 팩트체크]\n대체로 신뢰할 수 있는 영상이지만 일부 표현에 과장이 있습니다.\n분석 결과 보기 → ${link}`,
  A: (link) =>
    `✅ [어그로필터 팩트체크]\n신뢰도가 높은 영상입니다. AI 분석 결과를 확인해 보세요.\n분석 보기 → ${link}`,
  S: (link) =>
    `💎 [어그로필터 팩트체크]\n이 영상은 썸네일과 내용이 완벽하게 일치하는 고신뢰 콘텐츠입니다.\n전체 분석 결과 → ${link}`,
};

/**
 * 유튜브 영상 분석 결과 기반 댓글 생성 (템플릿, 비용 0)
 * @param {object} video - { videoId, trustScore }
 * @returns {{ grade, text }}
 */
function generateYoutubeComment(video) {
  const grade = getGrade(video.trustScore);
  const link = config.resultUrlBase + video.videoId;
  const text = YT_TEMPLATES[grade](link);
  return { grade, text };
}

/**
 * 에펨코리아 게시글 기반 댓글 생성 (Gemini)
 * @param {object} post - { title, body, url }
 * @returns {string} 생성된 댓글 텍스트
 */
async function generateCommunityComment(post) {
  if (!config.geminiApiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = `당신은 "어그로필터(aggrofilter.sundreamer.app)" 서비스를 홍보하는 마케터입니다.
어그로필터는 유튜브 영상의 신뢰도/어그로 지수를 AI로 분석해주는 팩트체크 서비스입니다.

아래 커뮤니티 게시글을 읽고, 본문 내용에 자연스럽게 공감하면서 어그로필터 앱 사용을 추천하는 댓글을 작성하세요.

[규칙]
- 영업 티가 나지 않게, 자연스럽게 공감하는 말투로 시작하세요
- 본문 맥락과 연결하여 유튜브 어그로/가짜뉴스 문제를 언급하세요
- 마지막에 어그로필터 링크를 자연스럽게 추천하세요: https://aggrofilter.sundreamer.app
- 총 길이: 3~5문장
- 이모지 1~2개 사용
- 한국어로 작성

[게시글 제목]: ${post.title}
[게시글 본문 요약]: ${(post.body || '').substring(0, 500)}

댓글:`;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.geminiApiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 300 },
    },
    { timeout: 30000 }
  );

  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
  return text.trim();
}

module.exports = { generateYoutubeComment, generateCommunityComment, getGrade };


