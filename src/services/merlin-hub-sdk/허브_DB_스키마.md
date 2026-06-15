---
Title: 허브 DB 스키마
Version: v1.2
Last Updated: 2026-06-03
---

# 🗄️ Merlin Family Hub DB Schema

| table_name                 | column_name           | data_type                | is_nullable |
| -------------------------- | --------------------- | ------------------------ | ----------- |
| family_aggro_video_pricing | video_id              | text                     | NO          |
| family_aggro_video_pricing | raw_token_cost        | numeric                  | NO          |
| family_aggro_video_pricing | margin_multiplier     | integer                  | NO          |
| family_aggro_video_pricing | fixed_coin_price      | bigint                   | NO          |
| family_aggro_video_pricing | created_at            | timestamp with time zone | YES         |
| family_app_scopes          | id                    | uuid                     | NO          |
| family_app_scopes          | app_id                | uuid                     | YES         |
| family_app_scopes          | scope                 | text                     | NO          |
| family_app_scopes          | description           | text                     | YES         |
| family_app_scopes          | created_at            | timestamp with time zone | YES         |
| family_apps                | id                    | uuid                     | NO          |
| family_apps                | client_id             | text                     | NO          |
| family_apps                | client_secret         | text                     | NO          |
| family_apps                | app_name              | text                     | NO          |
| family_apps                | status                | text                     | YES         |
| family_apps                | created_at            | timestamp with time zone | YES         |
| family_apps                | is_paid               | boolean                  | NO          |
| family_coin_packages       | id                    | uuid                     | NO          |
| family_coin_packages       | name                  | text                     | NO          |
| family_coin_packages       | price                 | bigint                   | NO          |
| family_coin_packages       | coin_amount           | bigint                   | NO          |
| family_coin_packages       | is_active             | boolean                  | YES         |
| family_coin_packages       | created_at            | timestamp with time zone | YES         |
| family_model_rates         | model_name            | text                     | NO          |
| family_model_rates         | tokens_per_coin       | numeric                  | NO          |
| family_model_rates         | description           | text                     | YES         |
| family_model_rates         | created_at            | timestamp with time zone | YES         |
| family_notifications       | id                    | uuid                     | NO          |
| family_notifications       | user_id               | uuid                     | YES         |
| family_notifications       | app_id                | text                     | NO          |
| family_notifications       | title                 | text                     | NO          |
| family_notifications       | content               | text                     | NO          |
| family_notifications       | is_read               | boolean                  | YES         |
| family_notifications       | created_at            | timestamp with time zone | YES         |
| family_notifications       | link                  | text                     | YES         |
| family_otp                 | id                    | uuid                     | NO          |
| family_otp                 | email                 | text                     | NO          |
| family_otp                 | otp_code              | text                     | NO          |
| family_otp                 | expires_at            | timestamp with time zone | NO          |
| family_otp                 | is_used               | boolean                  | YES         |
| family_otp                 | created_at            | timestamp with time zone | YES         |
| family_payments            | id                    | uuid                     | NO          |
| family_payments            | user_id               | uuid                     | YES         |
| family_payments            | order_id              | text                     | NO          |
| family_payments            | amount                | bigint                   | NO          |
| family_payments            | coin_amount           | bigint                   | NO          |
| family_payments            | status                | text                     | YES         |
| family_payments            | pg_tid                | text                     | YES         |
| family_payments            | pg_result_code        | text                     | YES         |
| family_payments            | pg_result_msg         | text                     | YES         |
| family_payments            | app_id                | text                     | YES         |
| family_payments            | created_at            | timestamp with time zone | YES         |
| family_payments            | updated_at            | timestamp with time zone | YES         |
| family_transfer_codes      | id                    | uuid                     | NO          |
| family_transfer_codes      | user_id               | uuid                     | NO          |
| family_transfer_codes      | transfer_code         | text                     | NO          |
| family_transfer_codes      | expires_at            | timestamp with time zone | NO          |
| family_transfer_codes      | is_used               | boolean                  | YES         |
| family_transfer_codes      | created_at            | timestamp with time zone | YES         |
| family_user_registrations  | id                    | uuid                     | NO          |
| family_user_registrations  | user_id               | uuid                     | YES         |
| family_user_registrations  | app_id                | text                     | NO          |
| family_user_registrations  | last_registered_at    | timestamp with time zone | YES         |
| family_users               | id                    | uuid                     | NO          |
| family_users               | email                 | text                     | NO          |
| family_users               | nickname              | text                     | YES         |
| family_users               | admin_memo            | text                     | YES         |
| family_users               | created_at            | timestamp with time zone | YES         |
| family_users               | region                | text                     | YES         |
| family_users               | first_app_id          | text                     | YES         |
| family_users               | avatar_url            | text                     | YES         |
| family_users               | updated_at            | timestamp with time zone | YES         |
| family_users               | referral_code         | text                     | YES         |
| family_users               | invited_by_id         | uuid                     | YES         |
| family_users               | registered_apps       | ARRAY                    | YES         |
| family_users               | notification_settings | jsonb                    | YES         |
| family_users               | app_join_dates        | jsonb                    | YES         |
| family_users               | deleted_at            | timestamp with time zone | YES         |
| family_wallet_balances     | user_id               | uuid                     | NO          |
| family_wallet_balances     | balance               | bigint                   | NO          |
| family_wallet_balances     | updated_at            | timestamp with time zone | YES         |
| family_wallet_logs         | id                    | uuid                     | NO          |
| family_wallet_logs         | user_id               | uuid                     | NO          |
| family_wallet_logs         | app_id                | uuid                     | NO          |
| family_wallet_logs         | amount                | bigint                   | NO          |
| family_wallet_logs         | type                  | text                     | NO          |
| family_wallet_logs         | request_id            | text                     | NO          |
| family_wallet_logs         | display_text          | text                     | YES         |
| family_wallet_logs         | created_at            | timestamp with time zone | YES         |
| family_wallet_transactions | id                    | uuid                     | NO          |
| family_wallet_transactions | user_id               | uuid                     | YES         |
| family_wallet_transactions | app_id                | text                     | NO          |
| family_wallet_transactions | amount                | bigint                   | NO          |
| family_wallet_transactions | request_id            | text                     | NO          |
| family_wallet_transactions | transaction_type      | text                     | NO          |
| family_wallet_transactions | display_text          | text                     | YES         |
| family_wallet_transactions | created_at            | timestamp with time zone | YES         |
| family_wallet_transactions | usage_metadata        | jsonb                    | YES         |
