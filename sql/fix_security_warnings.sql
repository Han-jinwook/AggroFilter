-- AggroFilter Security Warning Fix
-- 작성일: 2026-02-22 21:48

-- 1. trigger_set_timestamp 함수의 search_path 보안 강화
-- 'Function Search Path Mutable' 경고 해결
ALTER FUNCTION public.trigger_set_timestamp() SET search_path = public;

-- 2. RLS Policy Always True (t_analyses) 관련
-- 이 경고는 서비스 특성상 분석 결과를 전체 공개하기 위해 의도적으로 설정한 
-- 'Allow public read' 정책에 의한 것으로, 보안상 결함이 아닌 의도된 서비스 기획입니다.

-- 3. RLS Policy Always True (t_credit_history) 관련 경고 해결
-- t_credit_history에 설정되어 있던 'Service role can insert credit history' (WITH CHECK (true)) 정책은
-- 외부 API(PostgREST)를 통해 무단 인서트를 허용할 위험이 있어 제거(DROP)했습니다.
-- pg 풀러를 통해 직접 DB에 세션을 맺는 백엔드 서버(Node.js)는 Owner 권한을 가지므로 정책이 없어도
-- 정상적으로 결제/크레딧 내역 인서트가 작동하며, 외부 Anon Key 직접 조작은 완벽히 차단됩니다.
-- DDL: DROP POLICY IF EXISTS "Service role can insert credit history" ON public.t_credit_history;
