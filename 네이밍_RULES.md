# VIBE CODING NAMING RULES (v2.0)

> "이름만 봐도 그 녀석의 출신과 역할을 알 수 있어야 한다."

리얼픽(RealPick) 프로젝트의 코드 일관성과 유지보수성을 위한 절대 헌법입니다.

---

## 1. 폴더 및 파일 명명 (Structure)

### 1.1. 폴더 접두사 (Prefix)

폴더명 맨 앞에 붙여 해당 폴더의 성격을 정의합니다.

| 접두사 | 의미 | 설명 | 예시 |
|--------|------|------|------|
| `p-` | Page | 라우팅이 되는 페이지 폴더 | `src/app/p-home/`, `src/app/p-login/` |
| `c-` | Component | 재사용 가능한 UI 컴포넌트 | `src/components/c-button/`, `src/components/c-card/` |
| `a-` | API | 백엔드 API 라우트 | `src/app/api/a-users/`, `src/app/api/a-missions/` |
| `h-` | Hook | 커스텀 훅 모음 | `src/hooks/h-auth/`, `src/hooks/h-ui/` |
| `s-` | Store | 전역 상태 관리 (Zustand 등) | `src/stores/s-user/`, `src/stores/s-modal/` |
| `u-` | Util | 유틸리티 함수 모음 | `src/utils/u-date/`, `src/utils/u-format/` |
| `t-` | Type | 타입 정의 파일 모음 | `src/types/t-db/`, `src/types/t-api/` |

### 1.2. 파일 접미사 (Suffix)

파일명 맨 뒤(확장자 앞)에 붙여 해당 파일의 역할을 정의합니다. (일반 컴포넌트 .tsx 제외)

| 접미사 | 설명 | 예시 |
|--------|------|------|
| `.hook.ts` | 커스텀 훅 파일 | `useAuth.hook.ts` |
| `.store.ts` | 상태 관리 스토어 파일 | `user.store.ts` |
| `.util.ts` | 유틸리티 함수 파일 | `formatDate.util.ts` |
| `.types.ts` | 타입 정의 파일 | `user.types.ts` |
| `.api.ts` | API 호출 함수 파일 | `auth.api.ts` |

---

## 2. 데이터베이스 (DB Schema)

### 2.1. 테이블 (Table)

DB 예약어와의 충돌을 막고, 테이블임을 명시하기 위해 `t_` 접두사를 사용합니다.

- **규칙**: `t_` + snake_case (복수형 권장)
- **예시**: `t_users`, `t_missions`, `t_comments`, `t_holy_hall_of_fame`

### 2.2. 컬럼/필드 (Column/Field)

코드 내의 변수명과 DB 컬럼명을 명확히 구분하기 위해 `f_` 접두사를 사용합니다.
(가장 중요한 규칙: `user.email` vs `user.f_email` 혼동 방지)

- **규칙**: `f_` + snake_case
- **예시**:
  - `f_id` (PK)
  - `f_created_at`
  - `f_user_id` (FK)
  - `f_is_holy`

---

## 3. TypeScript 코드 (Coding Convention)

### 3.1. 타입/인터페이스 (Type/Interface)

클래스나 변수명과의 충돌을 방지하기 위해 PascalCase로 작성하되, 접두사 **T**를 붙입니다.

- **규칙**: `T` + PascalCase
- **예시**: `interface TUser`, `type TMissionResponse`, `type TAuthPayload`

### 3.2. 열거형 (Enum)

PascalCase로 작성하되, 접두사 **E**를 붙입니다.

- **규칙**: `E` + PascalCase
- **예시**: `enum EUserRole { ADMIN, USER }`, `enum EMissionStatus`

### 3.3. 변수 및 함수 (Variable & Function)

일반적인 자바스크립트 관례를 따릅니다.

- **변수/함수**: camelCase (예: `getUserInfo`, `isLoggedIn`)
- **상수 (Constant)**: UPPER_SNAKE_CASE (예: `MAX_RETRY_COUNT`, `DEFAULT_PAGE_SIZE`)
- **컴포넌트**: PascalCase (예: `LoginModal`, `MissionCard`)

---

## 4. 적용 예시 (Example Code)

```typescript
// src/types/t-user/user.types.ts
export interface TUser {
  f_id: string;           // DB 컬럼명 그대로 매핑
  f_email: string;
  f_nickname: string;
  f_tier: ETierLevel;
}

// src/utils/u-user/user.util.ts
import { TUser } from '@/types/t-user/user.types';

export const getUserDisplayName = (user: TUser): string => {
  return `${user.f_nickname} (LV.${user.f_tier})`;
};
```
