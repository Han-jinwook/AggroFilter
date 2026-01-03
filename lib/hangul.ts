/**
 * Simple deterministic Hangul to Romanization converter.
 * Follows a simplified Revised Romanization of Korean rule.
 * Goal is to produce distinct Roman strings for distinct Hangul strings.
 */

const CHO = [
  'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', 'ng', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'
];

const JUNG = [
  'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'
];

const JONG = [
  '', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'
];

export function romanize(text: string): string {
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);

    // Check if it's a Hangul Syllable (AC00 - D7A3)
    if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
      const code = charCode - 0xAC00;
      const jong = code % 28;
      const jung = ((code - jong) / 28) % 21;
      const cho = Math.floor((code - jong) / 28 / 21);

      result += CHO[cho] + JUNG[jung] + JONG[jong];
    } else {
      // Keep non-Hangul characters as is (or map distinct symbols if needed)
      // For embedding distinctness, keeping English/Numbers/Spaces is fine.
      result += text[i];
    }
  }

  return result;
}
