// Test the normalizeEvaluationReasonScores function logic

function normalizeEvaluationReasonScores(
  text,
  scores
) {
  if (!text) return text ?? null;
  const accuracy = Number(scores.accuracy);
  const clickbait = Number(scores.clickbait);
  const trust = Number(scores.trust);

  let out = text;

  const clickbaitTierLabel = (() => {
    if (!Number.isFinite(clickbait)) return null;
    if (clickbait <= 20) return '일치/마케팅/훅';
    if (clickbait <= 40) return '과장(오해/시간적 피해/낚임 수준)';
    if (clickbait <= 60) return '왜곡(혼란/짜증)';
    return '허위/조작(실질 손실 가능)';
  })();

  if (Number.isFinite(accuracy)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(내용\s*정확성\s*검증\s*)\(\s*\d+\s*점\s*\)/g,
      `$1(${Math.round(accuracy)}점)`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(1\.\s*내용\s*정확성\s*검증)(:)/,
        `$1 (${Math.round(accuracy)}점)$2`
      );
    } else {
      out = replaced;
    }
  }

  if (Number.isFinite(clickbait)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(어그로성\s*평가\s*)\(\s*\d+\s*점\s*\)/g,
      `$1(${Math.round(clickbait)}점${clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(2\.\s*어그로성\s*평가)(:)/,
        `$1 (${Math.round(clickbait)}점${clickbaitTierLabel ? ` / ${clickbaitTierLabel}` : ''})$2`
      );
    } else {
      out = replaced;
    }

    if (clickbaitTierLabel && !/2\.\s*어그로성\s*평가[\s\S]*?<br\s*\/>\s*이\s*점수는/g.test(out)) {
      out = out.replace(
        /(2\.\s*어그로성\s*평가[^<]*<br\s*\/>)/,
        `$1이 점수는 '${clickbaitTierLabel}' 구간입니다. `
      );
    }
  }

  if (Number.isFinite(trust)) {
    // Try to replace existing score first
    const replaced = out.replace(
      /(신뢰도\s*총평\s*)\(\s*\d+\s*점/g,
      `$1(${Math.round(trust)}점`
    );
    
    // If no replacement happened, insert the score
    if (replaced === out) {
      out = out.replace(
        /(3\.\s*신뢰도\s*총평)(:)/,
        `$1 (${Math.round(trust)}점)$2`
      );
    } else {
      out = replaced;
    }
  }

  return out;
}

// Test with actual DB data format (without scores)
const testText = `1. 내용 정확성 검증: 이 영상은 AI 메모리 시장, D램 및 낸드 가격 전망...<br /><br />2. 어그로성 평가:<br />이 점수는 '과장(오해/시간적 피해/낚임 수준)' 구간입니다. 제목...<br /><br />3. 신뢰도 총평: 전반적으로...`;

const scores = {
  accuracy: 90,
  clickbait: 35,
  trust: 78
};

console.log('=== BEFORE ===');
console.log(testText.substring(0, 300));
console.log('\n=== AFTER ===');
const result = normalizeEvaluationReasonScores(testText, scores);
console.log(result.substring(0, 400));

console.log('\n=== VERIFICATION ===');
console.log('Has "1. 내용 정확성 검증 (90점):":', result.includes('1. 내용 정확성 검증 (90점):'));
console.log('Has "2. 어그로성 평가 (35점":', result.includes('2. 어그로성 평가 (35점'));
console.log('Has "3. 신뢰도 총평 (78점)":', result.includes('3. 신뢰도 총평 (78점)'));
