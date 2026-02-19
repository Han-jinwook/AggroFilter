import { NextResponse } from 'next/server';
import { getActiveLanguages } from '@/lib/ranking_v2_helpers';

export const runtime = 'nodejs';

/**
 * GET /api/ranking/locales
 * Returns list of active languages with channel counts
 * Used for language dropdown in ranking page
 */
export async function GET() {
  try {
    const languages = await getActiveLanguages();
    
    return NextResponse.json({
      languages,
      success: true,
    });
  } catch (error) {
    console.error('[Ranking Locales API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active languages', success: false },
      { status: 500 }
    );
  }
}
