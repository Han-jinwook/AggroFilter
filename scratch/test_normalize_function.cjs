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
    const tVal = Math.round(trust);
    const emoji = tVal >= 70 ? '🟢' : tVal >= 40 ? '🟡' : '🔴';
    const colorLabel = tVal >= 70 ? 'Green' : tVal >= 40 ? 'Yellow' : 'Red';

    // Try to replace existing score first (with or without emoji and label)
    const replaced = out.replace(
      /(신뢰도\s*총평\s*)\(\s*\d+\s*점\s*(?:\/\s*[^)]+)?\)/g,
      `$1(${tVal}점 / ${emoji}${colorLabel})`
    );
    
    // If no replacement happened, try simpler format (XX점) without parenthesis closure
    if (replaced === out) {
      const replacedSimple = out.replace(
        /(신뢰도\s*총평\s*)\(\s*\d+\s*점\s*\)/g,
        `$1(${tVal}점 / ${emoji}${colorLabel})`
      );
      if (replacedSimple === out) {
        // If still no replacement happened, insert the score
        out = out.replace(
          /(3\.\s*신뢰도\s*총평)(:)/,
          `$1 (${tVal}점 / ${emoji}${colorLabel})$2`
        );
      } else {
        out = replacedSimple;
      }
    } else {
      out = replaced;
    }
  }

  return out;
}

// Test with wrong emoji/grade format
const testText1 = `1. 내용 정확성 검증: ...<br /><br />2. 어그로성 평가:<br /><br />3. 신뢰도 총평 (38점 / 🟡Yellow): 전반적으로...`;
const testText2 = `1. 내용 정확성 검증: ...<br /><br />2. 어그로성 평가:<br /><br />3. 신뢰도 총평 (38점 / 🟡 Yellow): 전반적으로...`;
const testText3 = `1. 내용 정확성 검증: ...<br /><br />2. 어그로성 평가:<br /><br />3. 신뢰도 총평: 전반적으로...`;

const scores = {
  accuracy: 90,
  clickbait: 35,
  trust: 38
};

console.log('=== testText1 (38점 / 🟡Yellow -> 38점 / 🔴Red) ===');
const result1 = normalizeEvaluationReasonScores(testText1, scores);
console.log(result1);
console.log('Valid:', result1.includes('3. 신뢰도 총평 (38점 / 🔴Red):'));

console.log('\n=== testText2 (38점 / 🟡 Yellow -> 38점 / 🔴Red) ===');
const result2 = normalizeEvaluationReasonScores(testText2, scores);
console.log(result2);
console.log('Valid:', result2.includes('3. 신뢰도 총평 (38점 / 🔴Red):'));

console.log('\n=== testText3 (Insert score) ===');
const result3 = normalizeEvaluationReasonScores(testText3, scores);
console.log(result3);
console.log('Valid:', result3.includes('3. 신뢰도 총평 (38점 / 🔴Red):'));

console.log('\n=== testText1 with trust=78 (38점 / 🟡Yellow -> 78점 / 🟢Green) ===');
const result4 = normalizeEvaluationReasonScores(testText1, { ...scores, trust: 78 });
console.log(result4);
console.log('Valid:', result4.includes('3. 신뢰도 총평 (78점 / 🟢Green):'));

