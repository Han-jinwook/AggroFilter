-- Auto Marketer System: Table for marketing materials

-- Enum for material type
CREATE TYPE marketing_material_type AS ENUM (
    'AGGRO_TOP',
    'CLEAN_TOP',
    'TRENDING_DOWN',
    'UNEXPECTED_S_GRADE'
);

-- Enum for content format
CREATE TYPE content_format_type AS ENUM (
    'BLOG',
    'SHORTS',
    'INSTA'
);

-- Enum for material status
CREATE TYPE material_status_type AS ENUM (
    'DRAFT', -- Material mined, but content not yet crafted
    'GENERATED', -- Content crafted by AI, pending review
    'PUBLISHED'  -- Reviewed and published by admin
);

-- Main table to store mined materials and crafted content
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

-- Add comments for clarity
COMMENT ON TABLE public.t_marketing_materials IS '마케팅 자동화 시스템에서 발굴된 소재와 생성된 콘텐츠를 저장하는 테이블';
COMMENT ON COLUMN public.t_marketing_materials.f_id IS '고유 식별자 (PK)';
COMMENT ON COLUMN public.t_marketing_materials.f_source_video_id IS '원본 분석 영상 ID (FK, t_videos)';
COMMENT ON COLUMN public.t_marketing_materials.f_type IS '발굴된 소재의 유형 (예: 어그로 상위, 청정 채널 등)';
COMMENT ON COLUMN public.t_marketing_materials.f_content_format IS '생성된 콘텐츠의 포맷 (블로그, 쇼츠, 인스타)';
COMMENT ON COLUMN public.t_marketing_materials.f_generated_text IS 'AI가 생성한 원고 내용 (Text 또는 JSON)';
COMMENT ON COLUMN public.t_marketing_materials.f_status IS '콘텐츠 상태 (초안, 생성됨, 발행됨)';
COMMENT ON COLUMN public.t_marketing_materials.f_created_at IS '생성일';
COMMENT ON COLUMN public.t_marketing_materials.f_updated_at IS '수정일';

-- Trigger to update f_updated_at timestamp on row update
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.f_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.t_marketing_materials
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS
ALTER TABLE public.t_marketing_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only authenticated users (admins) can access.
CREATE POLICY "Allow admin full access" ON public.t_marketing_materials
    FOR ALL
    USING (auth.role() = 'service_role' OR auth.uid() IN (SELECT f_user_id FROM t_user_profiles WHERE f_role = 'ADMIN'))
    WITH CHECK (auth.role() = 'service_role' OR auth.uid() IN (SELECT f_user_id FROM t_user_profiles WHERE f_role = 'ADMIN'));

