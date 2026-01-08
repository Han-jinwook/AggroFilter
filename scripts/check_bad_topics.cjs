const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../data/raw_topics.txt');
const content = fs.readFileSync(filePath, 'utf8');
const topics = content.split('\n').map(t => t.trim()).filter(t => t && !t.startsWith('[')); // 섹션 헤더 제외

const suspiciousPatterns = [
    { pattern: /과의\s/, name: "'과의' (조사)" },
    { pattern: /와의\s/, name: "'와의' (조사)" },
    { pattern: /의\s/, name: "'의' (조사)" },
    { pattern: /\s과\s/, name: "'과' (중간 조사)" },
    { pattern: /\s와\s/, name: "'와' (중간 조사)" },
    { pattern: /하기$/, name: "'하기' (동사형)" },
    { pattern: /하는$/, name: "'하는' (관형사형)" },
    { pattern: /할$/, name: "'할' (관형사형)" },
    { pattern: /된$/, name: "'된' (피동형)" },
    { pattern: /스러운$/, name: "'스러운' (형용사형)" },
    { pattern: /로운$/, name: "'로운' (형용사형)" },
    { pattern: /있는$/, name: "'있는' (형용사형)" },
    { pattern: /없는$/, name: "'없는' (형용사형)" },
];

const found = [];

topics.forEach(topic => {
    for (const p of suspiciousPatterns) {
        if (p.pattern.test(topic)) {
            found.push({ topic, reason: p.name });
            break; // 중복 발견 방지
        }
    }
});

console.log("=== 의심되는 주제어 목록 ===");
if (found.length === 0) {
    console.log("발견된 의심 주제어가 없습니다.");
} else {
    found.forEach(item => {
        console.log(`- ${item.topic} (${item.reason})`);
    });
}
