# 멀린 허브 DB 스키마

> **출처**: 멀린 허브 앱(os.sundreamer.app)의 Supabase DB
> **최종 업데이트**: 2026-07-31

---

## 핵심 테이블

### `family_users` — 허브 통합 유저 (가장 중요)

| column_name            | data_type                | is_nullable |
| ---------------------- | ------------------------ | ----------- |
| id                     | uuid                     | NO          |
| email                  | text                     | NO          |
| nickname               | text                     | YES         |
| admin_memo             | text                     | YES         |
| created_at             | timestamp with time zone | YES         |
| region                 | text                     | YES         |
| first_app_id           | text                     | YES         |
| avatar_url             | text                     | YES         |
| updated_at             | timestamp with time zone | YES         |
| referral_code          | text                     | YES         |
| **invited_by_id**      | **uuid**                 | **YES**     |
| registered_apps        | ARRAY                    | YES         |
| notification_settings  | jsonb                    | YES         |
| app_join_dates         | jsonb                    | YES         |
| deleted_at             | timestamp with time zone | YES         |

> ⭐ **`invited_by_id`**: 나를 초대한 사람(방장)의 UUID. 가족 연결의 핵심.

---

### `family_apps` — 등록된 앱 (WhatEat 포함)

| column_name   | data_type                | is_nullable |
| ------------- | ------------------------ | ----------- |
| id            | uuid                     | NO          |
| client_id     | text                     | NO          |
| client_secret | text                     | NO          |
| app_name      | text                     | NO          |
| status        | text                     | YES         |
| created_at    | timestamp with time zone | YES         |
| is_paid       | boolean                  | NO          |

---

### `family_notifications` — 알림

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| user_id     | uuid                     | YES         |
| app_id      | text                     | NO          |
| title       | text                     | NO          |
| content     | text                     | NO          |
| is_read     | boolean                  | YES         |
| created_at  | timestamp with time zone | YES         |
| link        | text                     | YES         |

---

### `family_otp` — OTP 인증

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| email       | text                     | NO          |
| otp_code    | text                     | NO          |
| expires_at  | timestamp with time zone | NO          |
| is_used     | boolean                  | YES         |
| created_at  | timestamp with time zone | YES         |

---

## 지갑 & 결제 테이블

### `family_wallet_balances`

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| user_id     | uuid                     | NO          |
| balance     | bigint                   | NO          |
| updated_at  | timestamp with time zone | YES         |

### `family_wallet_logs`

| column_name  | data_type                | is_nullable |
| ------------ | ------------------------ | ----------- |
| id           | uuid                     | NO          |
| user_id      | uuid                     | NO          |
| app_id       | uuid                     | NO          |
| amount       | bigint                   | NO          |
| type         | text                     | NO          |
| request_id   | text                     | NO          |
| display_text | text                     | YES         |
| created_at   | timestamp with time zone | YES         |

### `family_wallet_transactions`

| column_name      | data_type                | is_nullable |
| ---------------- | ------------------------ | ----------- |
| id               | uuid                     | NO          |
| user_id          | uuid                     | YES         |
| app_id           | text                     | NO          |
| amount           | bigint                   | NO          |
| request_id       | text                     | NO          |
| transaction_type | text                     | NO          |
| display_text     | text                     | YES         |
| created_at       | timestamp with time zone | YES         |
| usage_metadata   | jsonb                    | YES         |

### `family_payments`

| column_name    | data_type                | is_nullable |
| -------------- | ------------------------ | ----------- |
| id             | uuid                     | NO          |
| user_id        | uuid                     | YES         |
| order_id       | text                     | NO          |
| amount         | bigint                   | NO          |
| coin_amount    | bigint                   | NO          |
| status         | text                     | YES         |
| pg_tid         | text                     | YES         |
| pg_result_code | text                     | YES         |
| pg_result_msg  | text                     | YES         |
| app_id         | text                     | YES         |
| created_at     | timestamp with time zone | YES         |
| updated_at     | timestamp with time zone | YES         |

### `family_coin_packages`

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| name        | text                     | NO          |
| price       | bigint                   | NO          |
| coin_amount | bigint                   | NO          |
| is_active   | boolean                  | YES         |
| created_at  | timestamp with time zone | YES         |

---

## 기타 테이블

### `family_transfer_codes` — 계정 이전 코드

| column_name   | data_type                | is_nullable |
| ------------- | ------------------------ | ----------- |
| id            | uuid                     | NO          |
| user_id       | uuid                     | NO          |
| transfer_code | text                     | NO          |
| expires_at    | timestamp with time zone | NO          |
| is_used       | boolean                  | YES         |
| created_at    | timestamp with time zone | YES         |

### `family_user_registrations` — 앱별 유저 등록 기록

| column_name        | data_type                | is_nullable |
| ------------------ | ------------------------ | ----------- |
| id                 | uuid                     | NO          |
| user_id            | uuid                     | YES         |
| app_id             | text                     | NO          |
| last_registered_at | timestamp with time zone | YES         |

### `family_app_scopes` — 앱 권한 범위

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| app_id      | uuid                     | YES         |
| scope       | text                     | NO          |
| description | text                     | YES         |
| created_at  | timestamp with time zone | YES         |

### `family_model_rates` — AI 모델 코인 요율

| column_name     | data_type                | is_nullable |
| --------------- | ------------------------ | ----------- |
| model_name      | text                     | NO          |
| tokens_per_coin | numeric                  | NO          |
| description     | text                     | YES         |
| created_at      | timestamp with time zone | YES         |

### `family_aggro_video_pricing` — 영상 코인 가격

| column_name       | data_type                | is_nullable |
| ----------------- | ------------------------ | ----------- |
| video_id          | text                     | NO          |
| raw_token_cost    | numeric                  | NO          |
| margin_multiplier | integer                  | NO          |
| fixed_coin_price  | bigint                   | NO          |
| created_at        | timestamp with time zone | YES         |

### `hub_config` — 허브 전역 설정

| column_name | data_type | is_nullable |
| ----------- | --------- | ----------- |
| id          | text      | NO          |
| data        | jsonb     | NO          |

---

## 가족 연결 구조 (WhatEat 활용 방법)

```
family_users.invited_by_id  →  내를 초대한 방장의 user_id
```

- 내가 방장인지 확인: `family_users.invited_by_id IS NULL`
- 방장 찾기: `family_users.invited_by_id = 방장_user_id`
- 방장의 멤버 목록: `family_users WHERE invited_by_id = 내_user_id`

### WhatEat 허브 API 엔드포인트 (os.sundreamer.app)

| 엔드포인트               | 설명                         |
| ------------------------ | ---------------------------- |
| GET `/api/auth/referrals` | 내 초대 실적 목록 (허브 DB)  |
| GET `/api/auth/profile`   | 내 프로필 (`invited_by_id` 포함) |

---

## 📱 WhatEat 로컬 서비스 테이블 스키마

### `comments` — 맛톡 및 가족 예약 댓글

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| meal_id     | uuid                     | YES         |
| user_id     | uuid                     | YES         |
| content     | text                     | NO          |
| created_at  | timestamp with time zone | YES         |
| updated_at  | timestamp with time zone | YES         |
| is_deleted  | boolean                  | YES         |

---

### `comment_replies` — 댓글 답글(대댓글)

| column_name      | data_type                | is_nullable |
| ---------------- | ------------------------ | ----------- |
| id               | uuid                     | NO          |
| comment_id       | uuid                     | YES         |
| user_id          | uuid                     | YES         |
| content          | text                     | NO          |
| created_at       | timestamp with time zone | YES         |
| updated_at       | timestamp with time zone | YES         |
| is_deleted       | boolean                  | YES         |
| reply_to_user_id | uuid                     | YES         |

---

### `meal_likes` — 맛톡 및 가족 예약 좋아요

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| meal_id     | uuid                     | YES         |
| user_id     | uuid                     | YES         |
| created_at  | timestamp with time zone | YES         |

---

### `meal_images` — 솔로 식사 및 맛톡 이미지 기록

| column_name    | data_type                | is_nullable |
| -------------- | ------------------------ | ----------- |
| id             | uuid                     | NO          |
| meal_id        | uuid                     | YES         |
| image_url      | text                     | NO          |
| uploaded_by    | uuid                     | YES         |
| match_score    | integer                  | YES         |
| status         | text                     | YES         |
| created_at     | timestamp with time zone | YES         |
| explanation    | text                     | YES         |
| source         | text                     | YES         |
| title          | text                     | YES         |
| rating         | integer                  | YES         |
| meal_type      | text                     | YES         |
| link_url       | text                     | YES         |
| link_thumbnail | text                     | YES         |
| place_name     | text                     | YES         |
| place_address  | text                     | YES         |
| description    | text                     | YES         |

---

### `meal_image_reports` — 식사 이미지 신고

| column_name       | data_type                | is_nullable |
| ----------------- | ------------------------ | ----------- |
| id                | uuid                     | NO          |
| image_id          | uuid                     | YES         |
| reporter_id       | uuid                     | NO          |
| school_code       | text                     | NO          |
| meal_date         | date                     | NO          |
| meal_type         | text                     | NO          |
| image_url         | text                     | NO          |
| uploader_nickname | text                     | YES         |
| report_reason     | text                     | YES         |
| status            | text                     | YES         |
| admin_notes       | text                     | YES         |
| created_at        | timestamp with time zone | YES         |
| reviewed_at       | timestamp with time zone | YES         |
| reviewed_by       | uuid                     | YES         |

---

### `meal_menus` — 학교 급식 메뉴

| column_name     | data_type                | is_nullable |
| --------------- | ------------------------ | ----------- |
| id              | uuid                     | NO          |
| school_code     | text                     | NO          |
| meal_date       | text                     | NO          |
| meal_type       | text                     | NO          |
| menu_items      | jsonb                    | YES         |
| kcal            | text                     | YES         |
| origin_info     | text                     | YES         |
| ntr_info        | text                     | YES         |
| created_at      | timestamp with time zone | YES         |
| updated_at      | timestamp with time zone | YES         |
| is_empty_result | boolean                  | YES         |
| office_code     | character varying        | YES         |
| is_temporary    | boolean                  | YES         |

---

### `meal_menu_items` — 학교 급식 세부 반찬 항목

| column_name | data_type                | is_nullable |
| ----------- | ------------------------ | ----------- |
| id          | uuid                     | NO          |
| meal_id     | uuid                     | NO          |
| item_name   | text                     | NO          |
| item_order  | integer                  | NO          |
| created_at  | timestamp with time zone | YES         |
| updated_at  | timestamp with time zone | YES         |

---

### `meal_quizzes` — 학교 급식 AI 퀴즈

| column_name    | data_type                | is_nullable |
| -------------- | ------------------------ | ----------- |
| id             | uuid                     | NO          |
| school_code    | text                     | NO          |
| grade          | integer                  | NO          |
| meal_date      | date                     | NO          |
| meal_id        | uuid                     | YES         |
| question       | text                     | NO          |
| options        | jsonb                    | NO          |
| correct_answer | integer                  | NO          |
| created_at     | timestamp with time zone | YES         |
| explanation    | text                     | YES         |
| report_status  | character varying        | YES         |

---

### `meal_rating_stats` — 식사 별점 통계

| column_name  | data_type         | is_nullable |
| ------------ | ----------------- | ----------- |
| meal_id      | uuid              | NO          |
| school_code  | text              | YES         |
| avg_rating   | numeric           | YES         |
| rating_count | integer           | YES         |
| grade1_avg   | numeric           | YES         |
| grade1_count | integer           | YES         |
| grade2_avg   | numeric           | YES         |
| grade2_count | integer           | YES         |
| grade3_avg   | numeric           | YES         |
| grade3_count | integer           | YES         |
| grade4_avg   | numeric           | YES         |
| grade4_count | integer           | YES         |

---

### `interest_schools` — 관심 학교 목록

| column_name | data_type                   | is_nullable |
| ----------- | --------------------------- | ----------- |
| id          | uuid                        | NO          |
| user_id     | uuid                        | NO          |
| school_code | character varying           | NO          |
| school_name | character varying           | NO          |
| created_at  | timestamp without time zone | YES         |
| updated_at  | timestamp without time zone | YES         |
| office_code | character varying           | YES         |
| region      | text                        | YES         |
| school_type | text                        | YES         |
