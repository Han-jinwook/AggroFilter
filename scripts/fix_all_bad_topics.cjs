const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 수정 매핑 정의 (Old -> New)
const TOPIC_MAPPING = {
  // 2차 정밀 수정 (잔여 3어절 및 부적절 표현)
  "짐 싸는 팁": "짐 싸기",
  "인공지능 발전 과정": "인공지능 발전",
  "딥러닝 컴퓨터 비전": "컴퓨터 비전",
  "딥러닝 자연어 처리": "자연어 처리",
  "AI 활용 사례": "AI 활용",
  "AI 산업별 적용": "AI 적용",
  "AI 미래 전망": "AI 전망",
  "AI 발전 가능성": "AI 발전"
};

// 파일 경로
const RAW_TOPICS_PATH = path.join(__dirname, '../data/raw_topics.txt');
const JSON_TOPICS_PATH = path.join(__dirname, '../data/topics.json');

async function fixFiles() {
  console.log('=== 1. File Update Started ===');
  
  // 1. raw_topics.txt 수정
  let rawContent = fs.readFileSync(RAW_TOPICS_PATH, 'utf8');
  let rawChanged = false;
  
  for (const [oldTopic, newTopic] of Object.entries(TOPIC_MAPPING)) {
    if (rawContent.includes(oldTopic)) {
      // Regex 수정: 앞뒤 공백 허용, 줄바꿈 문자 처리 고려
      // \s*를 앞뒤에 붙여서 유연하게 매칭
      const regex = new RegExp(`^\\s*${oldTopic}\\s*$`, 'gm');
      if (regex.test(rawContent)) {
          rawContent = rawContent.replace(regex, `${newTopic}`);
          console.log(`[File:RAW] ${oldTopic} -> ${newTopic}`);
          rawChanged = true;
      }
    }
  }
  
  if (rawChanged) {
    fs.writeFileSync(RAW_TOPICS_PATH, rawContent, 'utf8');
    console.log('✅ data/raw_topics.txt updated.');
  } else {
    console.log('No changes needed for raw_topics.txt.');
  }

  // 2. topics.json 수정
  let jsonContent = JSON.parse(fs.readFileSync(JSON_TOPICS_PATH, 'utf8'));
  let jsonChanged = false;
  const newJsonList = [];
  const seenTopics = new Set();

  for (let topic of jsonContent) {
    if (TOPIC_MAPPING[topic]) {
      console.log(`[File:JSON] ${topic} -> ${TOPIC_MAPPING[topic]}`);
      topic = TOPIC_MAPPING[topic];
      jsonChanged = true;
    }
    
    // 중복 제거 (매핑 결과가 기존에 있는 단어일 수도 있음)
    if (!seenTopics.has(topic)) {
      newJsonList.push(topic);
      seenTopics.add(topic);
    }
  }

  // 정렬 (가나다순)
  newJsonList.sort((a, b) => a.localeCompare(b, 'ko'));

  if (jsonChanged) {
    fs.writeFileSync(JSON_TOPICS_PATH, JSON.stringify(newJsonList, null, 2), 'utf8');
    console.log('✅ data/topics.json updated & sorted.');
  } else {
    console.log('No changes needed for topics.json.');
  }
}

async function fixDB() {
  console.log('\n=== 2. DB Update Started ===');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const [oldTopic, newTopic] of Object.entries(TOPIC_MAPPING)) {
      // 1. t_topics_master 처리
      // 새 토픽이 이미 존재하는지 확인
      const newTopicRes = await client.query('SELECT id FROM t_topics_master WHERE name_ko = $1', [newTopic]);
      const oldTopicRes = await client.query('SELECT id FROM t_topics_master WHERE name_ko = $1', [oldTopic]);

      if (oldTopicRes.rows.length > 0) {
        if (newTopicRes.rows.length > 0) {
           // 둘 다 존재함 -> Old 삭제 (New로 병합)
           console.log(`[DB:Master] Merging '${oldTopic}' into existing '${newTopic}'... (Deleting Old)`);
           await client.query('DELETE FROM t_topics_master WHERE name_ko = $1', [oldTopic]);
        } else {
           // Old만 존재 -> 이름 변경
           console.log(`[DB:Master] Renaming '${oldTopic}' -> '${newTopic}'`);
           await client.query('UPDATE t_topics_master SET name_ko = $1 WHERE name_ko = $2', [newTopic, oldTopic]);
        }
      }

      // 2. t_analyses 업데이트
      const analysisUpdate = await client.query('UPDATE t_analyses SET f_topic = $1 WHERE f_topic = $2', [newTopic, oldTopic]);
      if (analysisUpdate.rowCount > 0) {
        console.log(`[DB:Analysis] Updated ${analysisUpdate.rowCount} rows from '${oldTopic}' to '${newTopic}'`);
      }

      // 3. t_channel_stats 정리 (중복 키 문제 방지 위해 삭제 후 재집계)
      // 해당 토픽과 관련된 통계 삭제
      await client.query('DELETE FROM t_channel_stats WHERE f_topic IN ($1, $2)', [oldTopic, newTopic]);
      
      // 재집계 (변경된 newTopic에 대해)
      const statsRes = await client.query(`
        INSERT INTO t_channel_stats (
          f_channel_id, f_topic, f_video_count, 
          f_avg_accuracy, f_avg_clickbait, f_avg_reliability, 
          f_last_updated
        )
        SELECT 
          f_channel_id, 
          $1::text, 
          COUNT(*)::integer, 
          ROUND(AVG(f_accuracy_score), 2), 
          ROUND(AVG(f_clickbait_score), 2), 
          ROUND(AVG(f_reliability_score), 2),
          NOW()
        FROM t_analyses
        WHERE f_topic = $1 AND f_channel_id IS NOT NULL AND f_reliability_score IS NOT NULL
        GROUP BY f_channel_id
        ON CONFLICT (f_channel_id, f_topic) DO NOTHING
      `, [newTopic]);
      
      if (statsRes.rowCount > 0) {
          console.log(`[DB:Stats] Regenerated stats for '${newTopic}' (${statsRes.rowCount} channels)`);
      }
    }

    await client.query('COMMIT');
    console.log('✅ DB Update Completed Successfully.');
    
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ DB Update Failed:', e);
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await fixFiles();
    await fixDB();
  } catch (e) {
    console.error('Fatal Error:', e);
  } finally {
    pool.end();
  }
}

main();
