const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  pool,
  getCommunityTargets,
  upsertCommunityTarget,
  deleteCommunityTarget,
  getCommentLogs,
} = require('../db');
const config = require('../config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 런타임 옵션 저장소 (메모리 + 파일)
const OPTS_FILE = path.join(__dirname, '../../data/options.json');

function loadOptions() {
  try {
    if (fs.existsSync(OPTS_FILE)) {
      return JSON.parse(fs.readFileSync(OPTS_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    trackNTotal: config.trackNTotal,
    trackMPerCategory: config.trackMPerCategory,
    dedupDays: config.dedupDays,
    analysisDelayMs: config.analysisDelayMs,
    postLimit: 10,
    keywordsGlobal: '',
    communityCount: 10,
  };
}

function saveOptions(opts) {
  const dir = path.dirname(OPTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OPTS_FILE, JSON.stringify(opts, null, 2), 'utf8');
}

// 전역 옵션 (job.js에서 참조)
let runtimeOptions = loadOptions();
function getRuntimeOptions() { return runtimeOptions; }

// 봇 실행 상태
let botStatus = { running: false, lastRun: null, lastResult: null, progress: null, autoMode: false };
function setBotStatus(s) { Object.assign(botStatus, s); }
function getBotStatus() { return botStatus; }

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

// POST /api/options — 옵션 저장
app.post('/api/options', (req, res) => {
  const { trackNTotal, trackMPerCategory, dedupDays, analysisDelayMs, postLimit, keywordsGlobal, communityCount } = req.body;
  if (trackNTotal) runtimeOptions.trackNTotal = parseInt(trackNTotal, 10);
  if (trackMPerCategory) runtimeOptions.trackMPerCategory = parseInt(trackMPerCategory, 10);
  if (dedupDays) runtimeOptions.dedupDays = parseInt(dedupDays, 10);
  if (analysisDelayMs) runtimeOptions.analysisDelayMs = parseInt(analysisDelayMs, 10);
  if (postLimit !== undefined) runtimeOptions.postLimit = parseInt(postLimit, 10);
  if (keywordsGlobal !== undefined) runtimeOptions.keywordsGlobal = keywordsGlobal;
  if (communityCount !== undefined) runtimeOptions.communityCount = parseInt(communityCount, 10);
  saveOptions(runtimeOptions);
  res.json({ ok: true, options: runtimeOptions });
});

// 공통: job 실행 후 botStatus 업데이트
function _runJobAsync(jobFn, label, progressMsg) {
  setBotStatus({ running: true, runningLabel: label, progress: progressMsg, lastResult: null });
  setImmediate(async () => {
    try {
      const result = await jobFn(runtimeOptions);
      const summary = `✅ [${label}] 분석 ${result.success ?? 0}개 완료 / 실패 ${result.fail ?? 0}개 / 자막없음 ${result.skipped ?? 0}개 제외`;
      setBotStatus({
        running: false,
        runningLabel: null,
        lastRun: new Date().toISOString(),
        lastResult: { ...result, summary },
        progress: null,
      });
    } catch (e) {
      setBotStatus({
        running: false,
        runningLabel: null,
        lastRun: new Date().toISOString(),
        lastResult: { error: e.message, summary: '❌ ' + e.message },
        progress: null,
      });
    }
  });
}

// POST /api/run — 자동 스케줄과 동일 (Type1+2 전체)
app.post('/api/run', (req, res) => {
  if (botStatus.running) {
    return res.json({ ok: false, message: '이미 실행 중입니다.' });
  }
  res.json({ ok: true, message: 'Type1+2 실행 시작' });
  const { runJob } = require('../job');
  _runJobAsync(runJob, 'Type1+2', 'Type1+2 수집 중...');
});

// POST /api/run-type1 — Type1 전용 수동 실행
app.post('/api/run-type1', (req, res) => {
  if (botStatus.running) {
    return res.json({ ok: false, message: '이미 실행 중입니다.' });
  }
  res.json({ ok: true, message: 'Type1 실행 시작' });
  const { runJobType1 } = require('../job');
  _runJobAsync(runJobType1, 'Type1', 'Type1 수집 중...');
});

// POST /api/run-type2 — Type2 전용 수동 실행
app.post('/api/run-type2', (req, res) => {
  if (botStatus.running) {
    return res.json({ ok: false, message: '이미 실행 중입니다.' });
  }
  res.json({ ok: true, message: 'Type2 실행 시작' });
  const { runJobType2 } = require('../job');
  _runJobAsync(runJobType2, 'Type2', 'Type2 카테고리 수집 중...');
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
          a.f_created_at
        FROM t_analyses a
        LEFT JOIN t_channels c ON a.f_channel_id = c.f_channel_id
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

module.exports = { startDashboard, getRuntimeOptions, setBotStatus, getBotStatus };
