/**
 * 섹션2: 에펨코리아 게시글 스캔 + 댓글 큐 적재
 * - 대시보드에 등록된 bot_community_targets 순회
 * - 키워드 검색으로 최근 24시간 내 게시글 수집
 * - Gemini로 댓글 생성 → bot_comment_logs에 queue 상태로 저장
 */
const { chromium } = require('playwright');
const config = require('./config');
const { getCommunityTargets, insertCommentLog } = require('./db');
const { generateCommunityComment } = require('./comment-generator');

const FMKOREA_BASE = 'https://www.fmkorea.com';

/**
 * 에펨코리아 특정 게시판 URL에서 키워드로 최근 24h 이내 게시글 검색
 * @param {object} browser - Playwright browser context
 * @param {string} boardUrl - 게시판 URL (예: https://www.fmkorea.com/index.php?mid=humor)
 * @param {string[]} keywords - 검색 키워드 배열
 * @returns {Array<{title, url, postedAt}>}
 */
async function scanBoard(browser, boardUrl, keywords) {
  const posts = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24시간 전

  for (const keyword of keywords) {
    try {
      const page = await browser.newPage();
      const searchUrl = `${FMKOREA_BASE}/index.php?act=IS&is_keyword=${encodeURIComponent(keyword)}&mid=search&where=document&x=0&y=0`;
      console.log(`[FM-Scanner] 검색: "${keyword}" → ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);

      // 게시글 목록 파싱
      const items = await page.evaluate((cutoffMs, base) => {
        const results = [];
        const rows = document.querySelectorAll('.bd_lst .title a, li.li_best a.hx, .list_item .title a');
        rows.forEach(a => {
          const href = a.href || '';
          const title = (a.textContent || '').trim();
          if (!href || !title) return;

          // 날짜 추출 시도 (부모 row에서)
          const row = a.closest('tr, li');
          const dateEl = row ? row.querySelector('.date, .time, time') : null;
          const dateText = dateEl ? dateEl.textContent.trim() : '';

          // 절대 URL 생성
          const fullUrl = href.startsWith('http') ? href : base + href;

          results.push({ title, url: fullUrl, dateText });
        });
        return results;
      }, cutoff, FMKOREA_BASE);

      // 날짜 필터링 (오늘/어제 게시글만)
      const now = new Date();
      const todayStr = now.toLocaleDateString('ko-KR');
      const filtered = items.filter(item => {
        if (!item.dateText) return true; // 날짜 파싱 실패시 일단 포함
        // "HH:MM" 형식이면 오늘 게시글
        if (/^\d{2}:\d{2}$/.test(item.dateText)) return true;
        // "어제", "2025.02.25" 형식 처리
        if (item.dateText.includes('어제')) return true;
        if (item.dateText.includes(todayStr.substring(0, 6))) return true;
        return false;
      });

      for (const p of filtered.slice(0, 5)) {
        if (!posts.find(x => x.url === p.url)) {
          posts.push(p);
        }
      }

      await page.close();
    } catch (e) {
      console.warn(`[FM-Scanner] 키워드 "${keyword}" 검색 실패: ${e.message}`);
    }
  }

  return posts;
}

/**
 * 게시글 본문 크롤링
 */
async function fetchPostBody(browser, postUrl) {
  const page = await browser.newPage();
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    const body = await page.evaluate(() => {
      const el = document.querySelector('.xe_content, .rd_body, #viewContent');
      return el ? el.innerText.trim() : '';
    });
    return body.substring(0, 800);
  } catch {
    return '';
  } finally {
    await page.close();
  }
}

/**
 * 에펨코리아 스캔 전체 실행 (대시보드 bot_community_targets 기반)
 * - 스캔 후 댓글 텍스트 생성하여 bot_comment_logs에 queue 상태로 저장
 */
async function runFmkoreaScan() {
  const targets = await getCommunityTargets(true); // 활성 타겟만
  if (targets.length === 0) {
    console.log('[FM-Scanner] 활성 커뮤니티 타겟 없음. 스캔 스킵.');
    return { scanned: 0, queued: 0 };
  }

  if (!config.chromeUserDataDir) {
    throw new Error('CHROME_USER_DATA_DIR이 .env에 설정되지 않았습니다.');
  }

  const browser = await chromium.launchPersistentContext(config.chromeUserDataDir, {
    headless: true,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  let scanned = 0;
  let queued = 0;

  try {
    for (const target of targets) {
      console.log(`[FM-Scanner] 타겟 순회: ${target.url} | 키워드: ${(target.keywords || []).join(', ')}`);
      const posts = await scanBoard(browser, target.url, target.keywords || []);
      scanned += posts.length;

      for (const post of posts) {
        try {
          const body = await fetchPostBody(browser, post.url);
          const text = await generateCommunityComment({ title: post.title, body, url: post.url });
          await insertCommentLog({
            target_type: 'community',
            target_id: post.url,
            target_url: post.url,
            video_id: null,
            grade: null,
            generated_text: text,
          });
          queued++;
          console.log(`[FM-Scanner] 큐 적재 완료: "${post.title.substring(0, 30)}..."`);
        } catch (e) {
          console.warn(`[FM-Scanner] 댓글 생성 실패 (${post.url}): ${e.message}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`[FM-Scanner] 완료 — 스캔: ${scanned}개, 큐 적재: ${queued}개`);
  return { scanned, queued };
}

module.exports = { runFmkoreaScan };
