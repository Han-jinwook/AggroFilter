const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  pool,
  getCommunityTargets,
  upsertCommunityTarget,
  deleteCommunityTarget,
  getCommentLogs,
  getAggroKeywordGroups,
  upsertAggroKeywordGroup,
  deleteAggroKeywordGroup,
} = require('../db');
const config = require('../config');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ────────────── 옵션 저장/로드 헬퍼 ──────────────
const DATA_DIR = path.join(__dirname, '../../data');

function loadJsonFile(filePath, defaults) {
  try {
    if (fs.existsSync(filePath)) return { ...defaults, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (e) {}
  return { ...defaults };
}

function saveJsonFile(filePath, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ────────────── 모듈1 (YouTube 수집) ──────────────
const M1_OPTS_FILE = path.join(DATA_DIR, 'module1_options.json');
const M1_DEFAULTS = {
  trackNTotal: config.trackNTotal,
  trackMPerCategory: config.trackMPerCategory,
  dedupDays: config.dedupDays,
  categoryCooldowns: {}, // { "10": 30, "20": 20 } 형태
};
let module1Options = loadJsonFile(M1_OPTS_FILE, M1_DEFAULTS);
let module1Status = { running: false, lastRun: null, lastResult: null, progress: null, autoMode: false };
function setModule1Status(s) { Object.assign(module1Status, s); }

// ────────────── 모듈2 (커뮤니티 타겟) ──────────────
const M2_OPTS_FILE = path.join(DATA_DIR, 'module2_options.json');
const M2_DEFAULTS = {
  postLimit: 10,
  keywordsGlobal: '',
  communityCount: 10,
};
let module2Options = loadJsonFile(M2_OPTS_FILE, M2_DEFAULTS);
let module2Status = { running: false, lastRun: null, lastResult: null, progress: null, autoMode: false };
function setModule2Status(s) { Object.assign(module2Status, s); }

// ────────────── 섹션2 (키워드 사냥) ──────────────
const S2_OPTS_FILE = path.join(DATA_DIR, 'section2_options.json');
const S2_DEFAULTS = {
  keywordSearchCount: 30,
  prefilterCutline: 31,
  dailyAnalysisLimit: 30,
  publishedAfterDays: 1, // 최근 N일 이내 (1=24시간, 2=48시간)
};
function toValidInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.floor(n);
  if (v < min || v > max) return fallback;
  return v;
}

function normalizeSection2Options(raw = {}) {
  return {
    keywordSearchCount: toValidInt(raw.keywordSearchCount, S2_DEFAULTS.keywordSearchCount, { min: 1, max: 50 }),
    prefilterCutline: toValidInt(raw.prefilterCutline, S2_DEFAULTS.prefilterCutline, { min: 0, max: 100 }),
    dailyAnalysisLimit: toValidInt(raw.dailyAnalysisLimit, S2_DEFAULTS.dailyAnalysisLimit, { min: 1, max: 100 }),
    publishedAfterDays: toValidInt(raw.publishedAfterDays, S2_DEFAULTS.publishedAfterDays, { min: 1, max: 30 }),
  };
}

let section2Options = normalizeSection2Options(loadJsonFile(S2_OPTS_FILE, S2_DEFAULTS));
let section2Status = { 
  running: false, 
  lastRun: null, 
  lastResult: null, 
  progress: null, 
  autoMode: false,
  // 실시간 진행 정보
  currentStep: null,           // '수집중', 'Ollama 분석중', 'LLM 분석중'
  currentKeyword: null,        // 현재 처리 중인 키워드
  collectedCount: 0,           // 수집된 영상 수
  transcriptCount: 0,          // 자막 수집 완료 수
  preScoreCount: 0,            // Ollama 사전 스코어링 완료 수
  passedCutoff: 0,             // 컷라인 통과 수
  analyzingCount: 0,           // 유료 분석 중/완료 수
  totalToAnalyze: 0            // 유료 분석 대상 총 수
};
function setSection2Status(s) { Object.assign(section2Status, s); }

// 하위호환: 기존 코드가 참조하는 runtimeOptions/botStatus
let runtimeOptions = module1Options;
function getRuntimeOptions() { return module1Options; }
let botStatus = module1Status;
function setBotStatus(s) { setModule1Status(s); }
function getBotStatus() { return module1Status; }

// ────────────── API ──────────────

// GET /api/status — 봇 상태 + 옵션
app.get('/api/status', (req, res) => {
  res.json({ status: botStatus, options: runtimeOptions });
});

// POST /api/automode — 오토모드 토글
app.post('/api/automode', (req, res) => {
  const { enabled } = req.body;
  botStatus.autoMode = !!enabled;
  res.json({ ok: true, autoMode: botStatus.autoMode });
});

// POST /api/options — (하위호환) 모듈1 옵션 저장
app.post('/api/options', (req, res) => {
  const { trackNTotal, trackMPerCategory, dedupDays, analysisDelayMs } = req.body;
  if (trackNTotal) module1Options.trackNTotal = parseInt(trackNTotal, 10);
  if (trackMPerCategory) module1Options.trackMPerCategory = parseInt(trackMPerCategory, 10);
  if (dedupDays) module1Options.dedupDays = parseInt(dedupDays, 10);
  if (analysisDelayMs) module1Options.analysisDelayMs = parseInt(analysisDelayMs, 10);
  saveJsonFile(M1_OPTS_FILE, module1Options);
  res.json({ ok: true, options: module1Options });
});

// ────────────── 모듈1 전용 API ──────────────

// GET /api/module1/status
app.get('/api/module1/status', (req, res) => {
  res.json({ status: module1Status, options: module1Options });
});

// POST /api/module1/automode
app.post('/api/module1/automode', (req, res) => {
  const { enabled } = req.body;
  module1Status.autoMode = !!enabled;
  res.json({ ok: true, autoMode: module1Status.autoMode });
});

// POST /api/module1/options
app.post('/api/module1/options', (req, res) => {
  const { trackNTotal, trackMPerCategory, dedupDays, categoryCooldowns } = req.body;
  if (trackNTotal !== undefined) module1Options.trackNTotal = parseInt(trackNTotal, 10);
  if (trackMPerCategory !== undefined) module1Options.trackMPerCategory = parseInt(trackMPerCategory, 10);
  if (dedupDays !== undefined) module1Options.dedupDays = parseInt(dedupDays, 10);
  if (categoryCooldowns !== undefined) {
    // { "10": 30, "20": 20 } 형태로 저장, 값은 정수로 변환
    const parsed = {};
    for (const [catId, days] of Object.entries(categoryCooldowns)) {
      const d = parseInt(days, 10);
      if (!isNaN(d) && d > 0) parsed[catId] = d;
    }
    module1Options.categoryCooldowns = parsed;
  }
  saveJsonFile(M1_OPTS_FILE, module1Options);
  res.json({ ok: true, options: module1Options });
});

// POST /api/module1/run
app.post('/api/module1/run', (req, res) => {
  if (module1Status.running) return res.json({ ok: false, message: '이미 실행 중입니다.' });
  res.json({ ok: true, message: '모듈1 수집 시작' });
  const { runJobType1 } = require('../job');
  _runJobAsync(runJobType1, '모듈1', 'YouTube 트렌드 수집 중...', module1Options, setModule1Status);
});

// ────────────── 모듈2 전용 API ──────────────

// GET /api/module2/status
app.get('/api/module2/status', (req, res) => {
  res.json({ status: module2Status, options: module2Options });
});

// POST /api/module2/automode
app.post('/api/module2/automode', (req, res) => {
  const { enabled } = req.body;
  module2Status.autoMode = !!enabled;
  res.json({ ok: true, autoMode: module2Status.autoMode });
});

// POST /api/module2/options
app.post('/api/module2/options', (req, res) => {
  const { postLimit, keywordsGlobal, communityCount } = req.body;
  if (postLimit !== undefined) module2Options.postLimit = parseInt(postLimit, 10);
  if (keywordsGlobal !== undefined) module2Options.keywordsGlobal = keywordsGlobal;
  if (communityCount !== undefined) module2Options.communityCount = parseInt(communityCount, 10);
  saveJsonFile(M2_OPTS_FILE, module2Options);
  res.json({ ok: true, options: module2Options });
});

// POST /api/module2/run
app.post('/api/module2/run', (req, res) => {
  if (module2Status.running) return res.json({ ok: false, message: '이미 실행 중입니다.' });
  res.json({ ok: true, message: '모듈2 커뮤니티 수집 시작' });
  // TODO: 커뮤니티 수집 job 연결 예정
  _runJobAsync(() => Promise.resolve({ success: 0, fail: 0, skipped: 0 }), '모듈2', '커뮤니티 수집 중...', module2Options, setModule2Status);
});

// ────────────── 섹션2 전용 API ──────────────

// GET /api/section2/status
app.get('/api/section2/status', (req, res) => {
  res.json({ status: section2Status, options: section2Options });
});

// POST /api/section2/automode
app.post('/api/section2/automode', (req, res) => {
  const { enabled } = req.body;
  section2Status.autoMode = !!enabled;
  res.json({ ok: true, autoMode: section2Status.autoMode });
});

// POST /api/section2/options
app.post('/api/section2/options', (req, res) => {
  const { keywordSearchCount, prefilterCutline, dailyAnalysisLimit, publishedAfterDays } = req.body;
  if (keywordSearchCount !== undefined) {
    section2Options.keywordSearchCount = toValidInt(keywordSearchCount, section2Options.keywordSearchCount, { min: 1, max: 50 });
  }
  if (prefilterCutline !== undefined) {
    section2Options.prefilterCutline = toValidInt(prefilterCutline, section2Options.prefilterCutline, { min: 0, max: 100 });
  }
  if (dailyAnalysisLimit !== undefined) {
    section2Options.dailyAnalysisLimit = toValidInt(dailyAnalysisLimit, section2Options.dailyAnalysisLimit, { min: 1, max: 100 });
  }
  if (publishedAfterDays !== undefined) {
    section2Options.publishedAfterDays = toValidInt(publishedAfterDays, section2Options.publishedAfterDays, { min: 1, max: 30 });
  }

  section2Options = normalizeSection2Options(section2Options);
  saveJsonFile(S2_OPTS_FILE, section2Options);
  res.json({ ok: true, options: section2Options });
});

// POST /api/section2/run
app.post('/api/section2/run', (req, res) => {
  if (section2Status.running) return res.json({ ok: false, message: '이미 실행 중입니다.' });
  res.json({ ok: true, message: '섹션2 키워드 사냥 시작' });
  const { runJobSection2 } = require('../job');
  
  // statusCallback으로 실시간 진행 상황 업데이트
  const statusCallback = (updates) => {
    setSection2Status(updates);
  };
  
  _runJobAsync(
    (opts) => runJobSection2(opts, statusCallback), 
    '섹션2', 
    '키워드 검색 → 사전 스코어링 → 유료 분석 중...', 
    section2Options, 
    setSection2Status
  );
});

// POST /api/section2/abort - 섹션2 작업 중단
app.post('/api/section2/abort', (req, res) => {
  const { abortSection2 } = require('../job');
  abortSection2();
  console.log('[Dashboard] 섹션2 작업 중단 요청됨');
  res.json({ ok: true, message: '작업 중단 요청됨' });
});

// GET /api/section2/results — 섹션2 수집 결과 조회
app.get('/api/section2/results', async (req, res) => {
  try {
    const { getKeywordVideos } = require('../db');
    const videos = await getKeywordVideos(200);
    res.json({ results: videos });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 공통: job 실행 후 상태 업데이트 (opts, statusSetter 파라미터로 모듈별 독립 실행)
function _runJobAsync(jobFn, label, progressMsg, opts, statusSetter) {
  const _opts = opts || module1Options;
  const _set = statusSetter || setModule1Status;
  _set({ running: true, runningLabel: label, progress: progressMsg, lastResult: null });
  setImmediate(async () => {
    try {
      const result = await jobFn(_opts);
      const summary = `✅ [${label}] 분석 ${result.success ?? 0}개 완료 / 실패 ${result.fail ?? 0}개 / 자막없음 ${result.skipped ?? 0}개 제외`;
      _set({
        running: false,
        runningLabel: null,
        lastRun: new Date().toISOString(),
        lastResult: { ...result, summary },
        progress: null,
        currentStep: null,
        currentKeyword: null,
        collectedCount: 0,
        transcriptCount: 0,
        preScoreCount: 0,
        passedCutoff: 0,
        analyzingCount: 0,
        totalToAnalyze: 0,
      });
    } catch (e) {
      _set({
        running: false,
        runningLabel: null,
        lastRun: new Date().toISOString(),
        lastResult: { error: e.message, summary: '❌ ' + e.message },
        progress: null,
        currentStep: null,
        currentKeyword: null,
        collectedCount: 0,
        transcriptCount: 0,
        preScoreCount: 0,
        passedCutoff: 0,
        analyzingCount: 0,
        totalToAnalyze: 0,
      });
    }
  });
}

// POST /api/run — (하위호환) 모듈1 수동 실행
app.post('/api/run', (req, res) => {
  if (module1Status.running) return res.json({ ok: false, message: '이미 실행 중입니다.' });
  res.json({ ok: true, message: '모듈1 수집 시작' });
  const { runJob } = require('../job');
  _runJobAsync(runJob, '모듈1', 'YouTube 수집 중...', module1Options, setModule1Status);
});

// GET /api/collected — 봇이 수집/분석한 영상 목록 (최신 100개)
app.get('/api/collected', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT
          a.f_id,
          a.f_video_id,
          a.f_title                                        AS f_video_title,
          COALESCE(NULLIF(c.f_title, ''), a.f_channel_id) AS f_channel_name,
          a.f_channel_id,
          a.f_reliability_score,
          a.f_accuracy_score,
          a.f_clickbait_score,
          a.f_grounding_used,
          a.f_grounding_queries,
          a.f_is_recheck,
          a.f_language,
          a.f_official_category_id                        AS f_category,
          a.f_view_count,
          v.f_published_at,
          a.f_created_at
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
        LEFT JOIN t_videos v ON a.f_video_id = v.f_video_id
        WHERE a.f_user_id = 'bot'
        ORDER BY a.f_created_at DESC
        LIMIT 200
      `);
      res.json({ items: result.rows });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/collected — 분석 레코드 다중 삭제 (ids: string[])
app.delete('/api/collected', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids 필수' });
    const client = await pool.connect();
    try {
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const result = await client.query(
        `DELETE FROM t_analyses WHERE f_id IN (${placeholders}) AND f_user_id = 'bot'`,
        ids
      );
      res.json({ ok: true, deleted: result.rowCount });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ────────────── 키워드 그룹 API ──────────────

// GET /api/keyword-groups
app.get('/api/keyword-groups', async (req, res) => {
  try {
    const groups = await getAggroKeywordGroups(false); // 비활성 포함 전체
    res.json({ groups });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/keyword-groups — 추가
app.post('/api/keyword-groups', async (req, res) => {
  try {
    const { group_name, keywords, is_active } = req.body;
    if (!group_name || !keywords) return res.status(400).json({ error: 'group_name과 keywords 필수' });
    const kwArr = Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim()).filter(Boolean);
    const row = await upsertAggroKeywordGroup({ group_name, keywords: kwArr, is_active: is_active ?? true });
    res.json({ ok: true, group: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/keyword-groups/:id — 수정 (활성화/비활성화)
app.patch('/api/keyword-groups/:id', async (req, res) => {
  try {
    const { is_active, group_name, keywords } = req.body;
    const id = parseInt(req.params.id, 10);
    
    // 기존 데이터 조회
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT * FROM bot_aggro_keywords WHERE id=$1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: '그룹을 찾을 수 없습니다' });
      
      const current = existing.rows[0];
      const kwArr = keywords 
        ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k => k.trim()).filter(Boolean))
        : current.keywords;
      
      const row = await upsertAggroKeywordGroup({
        id,
        group_name: group_name || current.group_name,
        keywords: kwArr,
        is_active: is_active !== undefined ? is_active : current.is_active
      });
      res.json({ ok: true, group: row });
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/keyword-groups/:id
app.delete('/api/keyword-groups/:id', async (req, res) => {
  try {
    await deleteAggroKeywordGroup(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ────────────── 커뮤니티 타겟 API ──────────────

// GET /api/community-targets
app.get('/api/community-targets', async (req, res) => {
  try {
    const rows = await getCommunityTargets(false); // 비활성 포함 전체
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/community-targets — 추가 또는 수정
app.post('/api/community-targets', async (req, res) => {
  try {
    const { id, url, keywords, is_active, note, community_type, community_name, nickname, login_id, login_pw, post_limit, keywords_global } = req.body;
    if (!id && !url) return res.status(400).json({ error: 'url 필수' });
    const kwArr = Array.isArray(keywords)
      ? keywords
      : (keywords || '').split(',').map((k) => k.trim()).filter(Boolean);
    const kwGlobalArr = Array.isArray(keywords_global)
      ? keywords_global
      : (keywords_global || '').split(',').map((k) => k.trim()).filter(Boolean);
    const row = await upsertCommunityTarget({
      id, url, keywords: kwArr, is_active, note,
      community_type, community_name, nickname, login_id, login_pw,
      post_limit, keywords_global: kwGlobalArr.length ? kwGlobalArr : null
    });
    res.json({ ok: true, item: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/community-targets/:id
app.delete('/api/community-targets/:id', async (req, res) => {
  try {
    await deleteCommunityTarget(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ────────────── 댓글 로그 API ──────────────

// GET /api/comment-logs
app.get('/api/comment-logs', async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await getCommentLogs({ limit: 200, status: status || null });
    res.json({ items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET / — 대시보드 HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startDashboard() {
  const port = config.dashboardPort;
  app.listen(port, () => {
    console.log(`[Dashboard] 대시보드 실행 중: http://localhost:${port}`);
  });
}

module.exports = { startDashboard, getRuntimeOptions, setBotStatus, getBotStatus, getModule1Status: () => module1Status };
