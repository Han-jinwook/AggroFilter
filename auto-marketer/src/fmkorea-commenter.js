/**
 * 섹션2: Playwright를 이용한 에펨코리아 자동 댓글 작성
 * - 기존 크롬 사용자 데이터(세션)를 재사용하여 로그인 우회
 */
const { chromium } = require('playwright');
const config = require('./config');

/**
 * 에펨코리아 게시글에 댓글을 작성한다.
 * @param {string} postUrl - 게시글 URL
 * @param {string} commentText - 작성할 댓글 텍스트
 */
async function postFmkoreaComment(postUrl, commentText) {
  if (!config.chromeUserDataDir) {
    throw new Error('CHROME_USER_DATA_DIR이 .env에 설정되어 있지 않습니다.');
  }

  console.log(`[FM-Comment] 접속 중: ${postUrl}`);

  const browser = await chromium.launchPersistentContext(config.chromeUserDataDir, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();

  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 댓글 입력창 스크롤 후 클릭
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);

    // 에펨코리아 댓글 입력 영역 선택자
    const commentArea = page.locator('textarea.comment_input, #comment_content, .input_comment textarea').first();
    await commentArea.waitFor({ timeout: 15000 });
    await commentArea.click();
    await commentArea.fill(commentText);
    await page.waitForTimeout(800);

    // 댓글 제출 버튼
    const submitBtn = page.locator('button.btn_comment_submit, input[type=submit][value*=등록], button:has-text("등록")').first();
    await submitBtn.waitFor({ timeout: 10000 });
    await submitBtn.click();

    // 제출 후 확인 대기
    await page.waitForTimeout(3000);
    console.log(`[FM-Comment] ✅ 댓글 작성 완료 → ${postUrl}`);
  } finally {
    await browser.close();
  }
}

module.exports = { postFmkoreaComment };
