const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../components/c-app-header/index.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Bell 아이콘 import 제거 (다른 아이콘과 함께 있는 곳에서 Bell 제거)
content = content.replace(
  'Bell, FileText, TrendingUp',
  'FileText, TrendingUp'
);

// 2. HubNotificationDropdown import 제거
content = content.replace(
  'HubProfileWidget, HubNotificationDropdown',
  'HubProfileWidget'
);

// 3. unreadCount 구조 분해 할당 제거
content = content.replace(
  'isLoading, unreadCount',
  'isLoading'
);

// 4. isDropdownOpen state 제거
content = content.replace(
  'const [isDropdownOpen, setIsDropdownOpen] = useState(false)',
  ''
);

// 5. 알림 종 UI 버튼 영역 (172~215 라인 근처) 제거
// isLoggedIn ? ( 알림종 ) : ( 알림종 ) 구조를 찾아 제거
const bellBlockRegex = /\{\/\* 알림 종[^*]*?\*\/\}[\s\S]*?\{\/\* 코인 잔액/;
content = content.replace(bellBlockRegex, '{/* 코인 잔액');

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully updated AppHeader index.tsx in AggroFilter!');
