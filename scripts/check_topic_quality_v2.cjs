const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/raw_topics.txt');
const content = fs.readFileSync(filePath, 'utf8');
const topics = content.split('\n')
    .map(t => t.trim())
    .filter(t => t && !t.startsWith('[')); // 섹션 헤더 제외

const suspiciousPatterns = [
    { pattern: /과\s|와\s/, name: "'과/와' (접속 조사)" },
    { pattern: /의\s/, name: "'의' (관형격 조사)" },
    { pattern: /는\s|은\s|을\s|를\s|이\s|가\s/, name: "주격/목적격/보조사 포함" },
    { pattern: /하다$|하기$|하는$|할$|된$|될$|함$/, name: "용언 활용형 (동사/형용사)" },
    { pattern: /\s.*\s/, name: "3어절 이상 (공백 2개 이상)" },
    { pattern: /법$/, name: "'~법' (문장형 가능성, 예: 부자 되는 법)" },
];

const found = [];
const seen = new Set();

topics.forEach(topic => {
    if (seen.has(topic)) return;
    
    // 1. 패턴 검사
    for (const p of suspiciousPatterns) {
        if (p.pattern.test(topic)) {
            // 예외 처리: '법'으로 끝나지만 2단어 명사형인 경우는 패스 (예: 선거법 개정 - 이건 2단어라 괜찮음. 하지만 '부자 되는 법'은 '되는' 때문에 걸림)
            // 여기서는 일단 다 수집하고 눈으로 거르는 게 낫다.
            found.push({ topic, reason: p.name });
            seen.add(topic);
            break;
        }
    }
});

console.log("=== 정밀 진단 결과 ===");
if (found.length === 0) {
    console.log("발견된 의심 주제어가 없습니다.");
} else {
    found.forEach(item => {
        console.log(`[${item.reason}] ${item.topic}`);
    });
}
