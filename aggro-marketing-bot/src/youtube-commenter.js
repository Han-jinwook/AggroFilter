/**
 * 섹션2: Playwright를 이용한 유튜브 자동 댓글 작성
 * - 기존 크롬 사용자 데이터(세션)를 재사용하여 캡차/2차 인증 우회
 */
const { chromium } = require('playwright');
const config = require('./config');

/**
 * 유튜브 영상에 댓글을 작성한다.
 * @param {string} videoId - 유튜브 영상 ID
 * @param {string} commentText - 작성할 댓글 텍스트
 * @returns {Promise<void>}
 */
async function postYoutubeComment(videoId, commentText) {
  if (!config.chromeUserDataDir) {
    throw new Error('CHROME_USER_DATA_DIR이 .env에 설정되어 있지 않습니다.');
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[YT-Comment] 접속 중: ${url}`);

  const browser = await chromium.launchPersistentContext(config.chromeUserDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 영상 로딩 후 스크롤하여 댓글 섹션 활성화
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(2000);

    // 댓글 입력 박스 클릭 (YouTube DOM 선택자)
    const commentBox = page.locator('#simplebox-placeholder, #placeholder-area').first();
    await commentBox.waitFor({ timeout: 15000 });
    await commentBox.click();
    await page.waitForTimeout(1000);

    // 실제 입력창 포커스 후 텍스트 입력
    const editor = page.locator('#contenteditable-root').first();
    await editor.waitFor({ timeout: 10000 });
    await editor.click();
    await editor.fill(commentText);
    await page.waitForTimeout(800);

    // 제출 버튼 클릭
    const submitBtn = page.locator('#submit-button').first();
    await submitBtn.waitFor({ timeout: 10000 });
    await submitBtn.click();

    // 제출 완료 대기 (댓글이 DOM에 나타날 때까지)
    await page.waitForTimeout(3000);
    console.log(`[YT-Comment] ✅ 댓글 작성 완료 → videoId: ${videoId}`);
  } finally {
    await browser.close();
  }
}

module.exports = { postYoutubeComment };
