/**
 * Language Detection Utility for Global Ranking v3.1
 * 3-Step Fallback Strategy: API → Transcript → User/AI
 * Uses English standard language names (korean, english, etc.)
 */

/**
 * Detect language from text content (Step 2: Transcript-based)
 * Simple pattern matching for CJK languages
 * Returns English standard language names
 */
export function detectLanguageFromText(text: string): string {
  if (!text || text.length < 5) return 'english';
  
  // Korean detection (Hangul)
  if (/[\uAC00-\uD7AF]/.test(text)) {
    return 'korean';
  }
  
  // Japanese detection (Hiragana, Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) {
    return 'japanese';
  }
  
  // Chinese detection (CJK Unified Ideographs)
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return 'chinese';
  }
  
  // Default to English
  return 'english';
}

/**
 * Get language display name for UI (Capitalized)
 * Just capitalize first letter - no translation needed
 */
export function getLanguageDisplayName(lang: string): string {
  return lang.charAt(0).toUpperCase() + lang.slice(1);
}

/**
 * Get language icon for UI
 * No country flags - just generic icons
 */
export function getLanguageIcon(lang: string): string {
  return '�';
}

/**
 * Parse browser language string (e.g., 'ko-KR' → 'korean')
 */
export function parseBrowserLanguage(navigatorLang: string): string {
  if (!navigatorLang) return 'korean';
  
  const code = navigatorLang.split('-')[0].toLowerCase();
  
  const map: Record<string, string> = {
    ko: 'korean',
    en: 'english',
    ja: 'japanese',
    zh: 'chinese',
    es: 'spanish',
    fr: 'french',
    de: 'german',
    ru: 'russian',
    pt: 'portuguese',
    it: 'italian',
  };
  
  return map[code] || 'english';
}
