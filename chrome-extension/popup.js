// 어그로필터 크롬 확장팩 - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection = document.getElementById('login-section');
  const loggedInSection = document.getElementById('logged-in-section');
  const displayEmail = document.getElementById('display-email');
  const emailInput = document.getElementById('email-input');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const loginMsg = document.getElementById('login-msg');

  // 저장된 사용자 정보 확인
  async function checkLogin() {
    const result = await chrome.storage.local.get(['userEmail', 'userNickname']);
    if (result.userEmail) {
      showLoggedIn(result.userEmail);
    } else {
      showLoginForm();
    }
  }

  function showLoggedIn(email) {
    loginSection.classList.add('hidden');
    loggedInSection.classList.remove('hidden');
    displayEmail.textContent = email;
  }

  function showLoginForm() {
    loginSection.classList.remove('hidden');
    loggedInSection.classList.add('hidden');
  }

  function showMessage(text, type) {
    loginMsg.textContent = text;
    loginMsg.className = `msg ${type}`;
  }

  // 로그인 (이메일 저장)
  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email || !email.includes('@')) {
      showMessage('올바른 이메일을 입력해주세요.', 'error');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '확인 중...';

    try {
      // 서버에서 사용자 존재 여부 확인
      const response = await fetch(
        `https://aggrofilter.com/api/user/profile?email=${encodeURIComponent(email)}`
      );

      if (response.ok) {
        const data = await response.json();
        const nickname = data?.user?.nickname || email.split('@')[0];

        await chrome.storage.local.set({
          userEmail: email,
          userNickname: nickname,
        });

        showLoggedIn(email);
      } else {
        showMessage('등록되지 않은 이메일입니다. 웹사이트에서 먼저 가입해주세요.', 'error');
      }
    } catch (error) {
      showMessage('서버 연결에 실패했습니다.', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = '로그인';
    }
  });

  // Enter 키로 로그인
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
  });

  // 로그아웃
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['userEmail', 'userNickname']);
    showLoginForm();
    emailInput.value = '';
    loginMsg.className = 'msg';
  });

  // 초기 로그인 상태 확인
  await checkLogin();
});
