-- =========================================================
-- BACKUP OF OBSOLETE TABLES - GENERATED ON 2026-05-29T15:04:55.307Z
-- Target tables: t_verification_codes, t_magic_links, family_model_rates, t_categories, t_topics_master, t_cafe24_tokens, t_cafe24_webhook_events
-- =========================================================

-- ---------------------------------------------------------
-- Table: public.t_verification_codes
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.t_verification_codes (
  f_id uuid NOT NULL DEFAULT gen_random_uuid(),
  f_email text NOT NULL,
  f_code character varying(6) NOT NULL,
  f_expires_at timestamp with time zone NOT NULL,
  f_created_at timestamp with time zone DEFAULT now(),
  f_verified boolean DEFAULT false,
  CONSTRAINT t_verification_codes_pkey PRIMARY KEY (f_id)
);

INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('5ffdd293-dc16-4e73-bd52-387d8e29dc7c', 'chiu369@naver.com', '639899', '"2026-01-30T11:42:22.573Z"'::jsonb, '"2026-01-30T11:37:23.578Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('34220f40-ef43-4877-b86c-4341a7044d36', 'chansung3738@naver.com', '527115', '"2026-03-10T00:36:58.489Z"'::jsonb, '"2026-03-10T00:31:59.829Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('2657ac1e-54d7-44b8-b2a7-180c0c59c949', 'cs2mj2@nate.com', '692700', '"2026-03-10T00:37:11.312Z"'::jsonb, '"2026-03-10T00:32:12.617Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('37a852c0-e139-4033-b92b-79985bbf1fe6', 'alexandre_abbott95@yatdew.com', '802319', '"2026-03-15T17:16:02.209Z"'::jsonb, '"2026-03-15T17:11:02.469Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('7ea9f5d8-f51c-4163-94fb-a346bcdd5a98', 'keithbarrows88@aol.com', '528529', '"2026-03-15T17:16:24.522Z"'::jsonb, '"2026-03-15T17:11:24.780Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('e1fd7ce3-d799-4ac3-a33d-5209ec80511b', 'hugolehmann92@outlook.com', '524621', '"2026-03-15T17:16:46.463Z"'::jsonb, '"2026-03-15T17:11:46.730Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('4a3c90cc-cba2-47d0-821a-f39cf3ec1337', 'bseong213@gmail.com', '685351', '"2026-04-07T11:55:08.398Z"'::jsonb, '"2026-04-07T11:50:09.788Z"'::jsonb, false);
INSERT INTO public.t_verification_codes (f_id, f_email, f_code, f_expires_at, f_created_at, f_verified) VALUES ('c7868d21-4be9-4d40-8cc3-48efa3825c2d', 'chiu3@naver.com', '677051', '"2026-04-12T10:29:27.937Z"'::jsonb, '"2026-04-12T10:24:29.628Z"'::jsonb, true);

-- ---------------------------------------------------------
-- Table: public.t_magic_links
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.t_magic_links (
  f_id bigint NOT NULL DEFAULT nextval('t_magic_links_f_id_seq'::regclass),
  f_email text NOT NULL,
  f_token text NOT NULL,
  f_expires_at timestamp with time zone NOT NULL,
  f_used boolean DEFAULT false,
  f_created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT t_magic_links_pkey PRIMARY KEY (f_id)
);

INSERT INTO public.t_magic_links (f_id, f_email, f_token, f_expires_at, f_used, f_created_at) VALUES ('1', 'chiu3@naver.com', '4b73eb23-ee32-465f-ab22-c439d6efd9f5', '"2026-02-24T14:07:01.556Z"'::jsonb, true, '"2026-02-24T13:52:03.160Z"'::jsonb);

-- ---------------------------------------------------------
-- Table: public.family_model_rates
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_model_rates (
  model_name text NOT NULL,
  tokens_per_coin numeric NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT family_model_rates_pkey PRIMARY KEY (model_name)
);

INSERT INTO public.family_model_rates (model_name, tokens_per_coin, description, created_at) VALUES ('gpt-4o-mini', '10000', 'GPT-4o-mini 1C당 10,000 토큰', '"2026-05-28T14:20:28.890Z"'::jsonb);
INSERT INTO public.family_model_rates (model_name, tokens_per_coin, description, created_at) VALUES ('gemini-2.5-flash', '10000', 'Gemini 2.5 Flash 1C당 10,000 토큰', '"2026-05-28T14:20:28.906Z"'::jsonb);
INSERT INTO public.family_model_rates (model_name, tokens_per_coin, description, created_at) VALUES ('google-search', '0.2', 'Google Search 1C당 0.2회 (즉, 1회당 5C)', '"2026-05-28T14:20:28.917Z"'::jsonb);

-- ---------------------------------------------------------
-- Table: public.t_categories
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.t_categories (
  f_id integer NOT NULL,
  f_name_ko character varying(50) NOT NULL,
  f_name_en character varying(50) NOT NULL,
  f_is_garbage boolean DEFAULT false,
  f_created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT t_categories_pkey PRIMARY KEY (f_id)
);

INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (25, '뉴스/정치', 'News & Politics', false, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (26, '노하우/스타일', 'Howto & Style', false, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (27, '교육', 'Education', false, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (28, '과학/기술', 'Science & Technology', false, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (1, '영화/애니메이션', 'Film & Animation', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (2, '자동차/교통', 'Autos & Vehicles', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (10, '음악', 'Music', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (15, '애완동물/동물', 'Pets & Animals', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (17, '스포츠', 'Sports', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (19, '여행/이벤트', 'Travel & Events', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (20, '게임', 'Gaming', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (22, '인물/블로그', 'People & Blogs', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (23, '코미디', 'Comedy', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (24, '엔터테인먼트', 'Entertainment', true, '"2026-01-18T04:02:46.944Z"'::jsonb);
INSERT INTO public.t_categories (f_id, f_name_ko, f_name_en, f_is_garbage, f_created_at) VALUES (29, '비영리/사회운동', 'Nonprofits & Activism', true, '"2026-01-18T04:02:46.944Z"'::jsonb);

-- ---------------------------------------------------------
-- Table: public.t_topics_master
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.t_topics_master (
  id bigint NOT NULL,
  name_ko text NOT NULL,
  embedding vector,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT t_topics_master_pkey PRIMARY KEY (id)
);

-- No data to insert for t_topics_master

-- ---------------------------------------------------------
-- Table: public.t_cafe24_tokens
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.t_cafe24_tokens (
  f_mall_id text NOT NULL,
  f_access_token text NOT NULL,
  f_refresh_token text,
  f_expires_at timestamp without time zone,
  f_updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT t_cafe24_tokens_pkey PRIMARY KEY (f_mall_id)
);

INSERT INTO public.t_cafe24_tokens (f_mall_id, f_access_token, f_refresh_token, f_expires_at, f_updated_at) VALUES ('nwjddus96', 'ZaUCQn3TEhkhJAdeeEBIdO', 'um6576J0OJfUPfueEaPlfx', NULL, '"2026-03-09T03:16:34.242Z"'::jsonb);
INSERT INTO public.t_cafe24_tokens (f_mall_id, f_access_token, f_refresh_token, f_expires_at, f_updated_at) VALUES ('chansung2226', 'emUpEBWIQCFSlSEYhARUIH', 'aRlnp0oyKlFleMlGVW1sIG', NULL, '"2026-03-09T15:31:17.902Z"'::jsonb);

-- ---------------------------------------------------------
-- Table: public.t_cafe24_webhook_events
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.t_cafe24_webhook_events (
  f_id text NOT NULL,
  f_event_type text,
  f_order_id text,
  f_created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT t_cafe24_webhook_events_pkey PRIMARY KEY (f_id)
);

-- No data to insert for t_cafe24_webhook_events

