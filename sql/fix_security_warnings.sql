-- AggroFilter Security Warning Fix
-- 작성일: 2026-02-22 21:48

-- 1. trigger_set_timestamp 함수의 search_path 보안 강화
-- 'Function Search Path Mutable' 경고 해결
ALTER FUNCTION public.trigger_set_timestamp() SET search_path = public;

-- 2. RLS Policy Always True (t_analyses) 관련
-- 이 경고는 서비스 특성상 분석 결과를 전체 공개하기 위해 의도적으로 설정한 
-- 'Allow public read' 정책에 의한 것으로, 보안상 결함이 아닌 의도된 서비스 기획입니다.
