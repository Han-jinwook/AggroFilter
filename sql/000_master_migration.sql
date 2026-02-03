-- AggroFilter Master Migration Script (v2 - Clean Install)
-- Run this single file to completely reset and set up the database schema.
-- WARNING: This will delete existing data in the affected tables.

-- Part 0: Drop existing objects in reverse order of dependency

DROP TABLE IF EXISTS public.t_marketing_materials CASCADE;
DROP TABLE IF EXISTS public.t_unclaimed_payments CASCADE;
DROP TABLE IF EXISTS public.t_videos CASCADE;
DROP TABLE IF EXISTS public.t_channels CASCADE;

DROP TYPE IF EXISTS public.marketing_material_type;
DROP TYPE IF EXISTS public.content_format_type;
DROP TYPE IF EXISTS public.material_status_type;

-- Part 1: Utility Functions

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.f_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_set_timestamp() IS 'Trigger to automatically update f_updated_at timestamp on row update.';

-- Part 2: Core Tables

CREATE TABLE public.t_channels (
    f_channel_id VARCHAR(255) PRIMARY KEY,
    f_title VARCHAR(255) NOT NULL,
    f_thumbnail_url TEXT,
    f_official_category_id INT,
    f_custom_category_id INT,
    f_trust_score INT DEFAULT 0,
    f_trust_grade VARCHAR(10),
    f_video_count INT DEFAULT 0,
    f_subscriber_count BIGINT DEFAULT 0,
    f_last_analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    f_created_at TIMESTAMPTZ DEFAULT NOW(),
    f_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.t_videos (
    f_video_id VARCHAR(255) PRIMARY KEY,
    f_channel_id VARCHAR(255) REFERENCES public.t_channels(f_channel_id) ON DELETE CASCADE,
    f_title TEXT NOT NULL,
    f_description TEXT,
    f_published_at TIMESTAMPTZ,
    f_thumbnail_url TEXT,
    f_official_category_id INT,
    f_custom_category_id INT,
    f_view_count BIGINT DEFAULT 0,
    f_like_count BIGINT DEFAULT 0,
    f_created_at TIMESTAMPTZ DEFAULT NOW(),
    f_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Part 3: Auto Marketer Tables

CREATE TYPE public.marketing_material_type AS ENUM ('VIDEO_ANALYSIS');
CREATE TYPE public.content_format_type AS ENUM ('BLOG', 'SHORTS');
CREATE TYPE public.material_status_type AS ENUM ('DRAFT', 'GENERATED', 'PUBLISHED');

CREATE TABLE public.t_marketing_materials (
    f_id BIGSERIAL PRIMARY KEY,
    f_source_video_id VARCHAR(255) REFERENCES public.t_videos(f_video_id) ON DELETE SET NULL,
    f_type marketing_material_type NOT NULL,
    f_content_format content_format_type,
    f_generated_text TEXT,
    f_status material_status_type NOT NULL DEFAULT 'DRAFT',
    f_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    f_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Part 4: Unclaimed Payments Table

CREATE TABLE public.t_unclaimed_payments (
    f_id BIGSERIAL PRIMARY KEY,
    f_cafe24_order_id VARCHAR(255) UNIQUE NOT NULL,
    f_buyer_email VARCHAR(255) NOT NULL,
    f_product_id VARCHAR(255) NOT NULL,
    f_product_name TEXT,
    f_amount_paid DECIMAL(10, 2),
    f_payment_data JSONB,
    f_status VARCHAR(50) DEFAULT 'PENDING',
    f_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    f_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Part 5: Apply Triggers

CREATE TRIGGER set_timestamp_channels
BEFORE UPDATE ON public.t_channels
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_videos
BEFORE UPDATE ON public.t_videos
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_marketing_materials
BEFORE UPDATE ON public.t_marketing_materials
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

CREATE TRIGGER set_timestamp_unclaimed
BEFORE UPDATE ON public.t_unclaimed_payments
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- End of script
