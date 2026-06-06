# 🏛️ Merlin Family UI Standard: Header Specification & Layout Guidelines
Version: v1.0
Last Updated: 2026-06-06

본 문서는 Merlin Family 서비스군(어그로필터, 금고지기, 썬드리머 등)의 상단 메뉴 헤더 UI 컴포넌트의 표준 레이아웃, 크기 규격 및 정렬 방식에 대한 규정이다. 

---

## 1. 헤더 기본 레이아웃 규격 (Layout Specifications)

모든 Merlin Family 웹 서비스의 헤더는 데스크톱 및 모바일 뷰 모두에서 일관된 높이와 반응형 최대 가로폭 규격을 가져야 한다.

### 1) 높이 (Height) 규정
* **기본 높이**: **`h-20` (80px)**
  * 헤더 전체 컨테이너의 고정 높이는 `80px`로 통일한다.
  * 내부 정렬은 수직 중앙 정렬 (`items-center`)을 사용한다.
  * 하단 테두리는 `border-b border-slate-200`을 사용하여 페이지 본문과 구분한다.
  * 배경은 `bg-white/80 backdrop-blur-xl`과 `sticky top-0 z-50`을 사용하여 스크롤 시 부드럽게 상단에 고정되도록 처리한다.

### 2) 가로폭 (Width) 및 패딩 (Padding) 규정
* **최대 가로폭**: **`max-w-[var(--app-max-width)]` (800px)**
  * 헤더 내부 콘텐츠 영역의 가로폭은 서비스 본문과 일치하도록 `max-w-[var(--app-max-width)]` (800px)로 제한한다.
* **좌우 패딩**: **`px-4`**
  * 모바일 및 데스크톱 영역 전반에 걸쳐 좌우 패딩 `16px (px-4)`를 적용하여 좌우 한계선에 부드러운 여백을 제공한다.

---

## 2. 헤더 내부 정렬 규정 (Alignment Rules)

헤더 내부의 요소들은 **3단 분할 레이아웃(3-Column Layout)**을 기반으로 좌측과 우측을 고정(shrink-0) 배치한 후, 그 사이의 메뉴 영역을 정확히 가로축 중앙에 정렬한다.

```
+-----------------------------------------------------------------------------------+
|  [로고 & 브랜드]                    [중앙 네비게이션]               [우측 위젯 영역]  |
|   (Left Fixed)                     (Centered Flex-1)                (Right Fixed) |
+-----------------------------------------------------------------------------------+
```

### 1) 좌측: 브랜드 로고 및 서브타이틀 영역
* 메인 로고 이미지와 서비스 대분류 명칭을 `shrink-0`으로 감싸 좌측에 단단히 고정시킨다.

### 2) 중앙: 네비게이션 메뉴 (Navigation Items)
* **`flex-1 flex items-center justify-center gap-6 sm:gap-10`**을 부여한다.
* 이를 통해 좌측 로고와 우측 자산/프로필 위젯 사이의 잔여 영역(Flex-1) 전체를 활용해, 핵심 메뉴 항목들(My Page, 분석 Plaza 등)이 정확히 브라우저 중앙에 배치되도록 정렬한다.

### 3) 우측: 유저 상태 및 트랜잭션 영역 (Widget Area)
* 코인 잔액 위젯과 Merlin HubAvatar 표준 프로필 위젯을 `shrink-0 gap-3 sm:gap-4 flex items-center justify-end min-w-[120px]` 구조로 묶어 우측 끝에 고정시킨다.

---

## 3. 어그로필터 (`AggroFilter`) 반영 상세

* **반영 파일**: [AppHeader Component](file:///d:/AggroFilter/components/c-app-header/index.tsx)
* **반영 내용**:
  * 기존 `max-w-[var(--app-max-width)]` (800px)에서 **`max-w-[1200px]`**로 가로폭 규격을 확장하여 양측 밸런스를 개선.
  * 내부 padding을 `px-6 md:px-8`로 확장하고, 로고 영역과 우측 메뉴들 사이의 간격 수직 중앙 정렬을 완벽하게 맞춤.
  * 각 MenuItem 버튼 및 지갑/프로필 컴포넌트의 `align-items`와 높이를 정렬하여 균형 잡힌 심미적 UI 구성.
