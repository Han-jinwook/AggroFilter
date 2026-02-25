const express = require('express');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
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
let botStatus = { running: false, lastRun: null, lastResult: null };
function setBotStatus(s) { Object.assign(botStatus, s); }
function getBotStatus() { return botStatus; }

// ────────────── API ──────────────

// GET /api/status — 봇 상태 + 옵션
app.get('/api/status', (req, res) => {
  res.json({ status: botStatus, options: runtimeOptions });
});

// POST /api/options — 옵션 저장
app.post('/api/options', (req, res) => {
  const { trackNTotal, trackMPerCategory, dedupDays, analysisDelayMs } = req.body;
  if (trackNTotal) runtimeOptions.trackNTotal = parseInt(trackNTotal, 10);
  if (trackMPerCategory) runtimeOptions.trackMPerCategory = parseInt(trackMPerCategory, 10);
  if (dedupDays) runtimeOptions.dedupDays = parseInt(dedupDays, 10);
  if (analysisDelayMs) runtimeOptions.analysisDelayMs = parseInt(analysisDelayMs, 10);
  saveOptions(runtimeOptions);
  res.json({ ok: true, options: runtimeOptions });
});

// POST /api/run — 수동 즉시 실행
app.post('/api/run', async (req, res) => {
  if (botStatus.running) {
    return res.json({ ok: false, message: '이미 실행 중입니다.' });
  }
  res.json({ ok: true, message: '실행 시작' });
  // 비동기로 job 실행
  const { runJob } = require('../job');
  setBotStatus({ running: true });
  try {
    const result = await runJob(runtimeOptions);
    setBotStatus({ running: false, lastRun: new Date().toISOString(), lastResult: result });
  } catch (e) {
    setBotStatus({ running: false, lastRun: new Date().toISOString(), lastResult: { error: e.message } });
  }
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
          a.f_video_title,
          a.f_channel_name,
          a.f_reliability_score,
          a.f_clickbait_score,
          a.f_created_at,
          a.f_language
        FROM t_analyses a
        WHERE a.f_user_id = 'bot'
        ORDER BY a.f_created_at DESC
        LIMIT 100
      `);
      res.json({ items: result.rows });
    } finally {
      client.release();
    }
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
