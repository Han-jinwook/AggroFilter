/**
 * 패밀리 앱 통합 메타데이터 및 런칭 통제 설정
 * - 이 파일을 통해 모든 패밀리 앱의 정보를 중앙 제어합니다.
 * - 허브(MerlinFamilyOS)에서 이 파일을 수정하고 각 앱으로 배포(Sync)합니다.
 */

// 🚀 런칭 스위치: 개시 종이 울리기 전까지는 false로 유지
// (true로 변경 시, 모든 앱의 우측 상단에 'F' 스위처가 나타납니다)
export const IS_FAMILY_FEATURE_LIVE = false;

export interface TFamilyAppMeta {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  isLaunched: boolean;
}

// 📦 패밀리 앱 카탈로그
// (설명글은 가독성을 위해 가급적 2~3단어로 작성합니다)
export const FAMILY_APPS_CATALOG: TFamilyAppMeta[] = [
  {
    id: 'sundreamer',
    name: '썬드리머',
    url: 'https://sundreamer.app',
    icon: '☀️',
    description: '기적을 만드는 아침루틴',
    isLaunched: true, // 6월말 런칭
  },
  {
    id: 'whateat',
    name: '뭐먹지?',
    url: 'https://whateat.app',
    icon: '🍔',
    description: '결정장애 맛집 룰렛',
    isLaunched: false, // 7월 런칭 대기중
  },
  {
    id: 'aggrofilter',
    name: '어그로필터',
    url: 'https://aggrofilter.com',
    icon: '🕵️‍♂️',
    description: '유튜브 가짜뉴스 판독기',
    isLaunched: false, // 7월 런칭 대기중
  }
];
