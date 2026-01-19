import { NextResponse } from 'next/server';

/**
 * 하이브리드 카테고리 분류 엔진 (Track A/B)
 * 
 * v2.0 Decision:
 * 1. 유튜브 공식 카테고리(Native ID) 100% 신뢰가 원칙.
 * 2. 고위험군(Track A: 22-인물/블로그, 24-엔터)은 전수 키워드 검사 후 AI 재분류.
 * 3. 청정군(Track B: 20-게임, 15-동물 등)은 치명적 키워드 발견 시에만 개입.
 */

const HIGH_RISK_CATEGORIES = [22, 24]; // Track A
const CLEAN_CATEGORIES = [15, 20];      // Track B (예시)

// 재분류가 필요한 키워드 리스트
const CRITICAL_KEYWORDS = ['정치', '선거', '대통령', '코인', '비트코인', '속보', '충격', '폭로'];

interface TClassificationInput {
  f_official_category_id: number;
  f_title: string;
  f_description: string;
  f_tags: string[];
}

export async function POST(req: Request) {
  try {
    const body: TClassificationInput = await req.json();
    const { f_official_category_id, f_title, f_description, f_tags } = body;

    let f_final_category_id = f_official_category_id;
    let f_needs_ai_reclassification = false;

    const full_text = `${f_title} ${f_description} ${f_tags.join(' ')}`.toLowerCase();
    const has_critical_keyword = CRITICAL_KEYWORDS.some(kw => full_text.includes(kw));

    // Track A: 인물/블로그(22), 엔터(24) - 키워드 하나라도 있으면 AI 개입
    if (HIGH_RISK_CATEGORIES.includes(f_official_category_id)) {
      if (has_critical_keyword) {
        f_needs_ai_reclassification = true;
      }
    } 
    // Track B: 그 외 카테고리 - 치명적 키워드 발견 시에만 AI 개입
    else {
      if (has_critical_keyword) {
        f_needs_ai_reclassification = true;
      }
    }

    if (f_needs_ai_reclassification) {
      // AI 모델 호출 (재분류 로직)
      // f_final_category_id = await callAiClassifier(full_text);
      console.log(`[AI Logic] Reclassifying video: ${f_title}`);
    }

    return NextResponse.json({
      f_final_category_id,
      f_is_reclassified: f_needs_ai_reclassification,
      f_track: HIGH_RISK_CATEGORIES.includes(f_official_category_id) ? 'A' : 'B'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Classification failed' }, { status: 500 });
  }
}
