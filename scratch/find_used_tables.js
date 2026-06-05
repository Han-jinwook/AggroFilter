const fs = require('fs');
const path = require('path');

const tables = [
  'bot_aggro_keywords',
  'bot_comment_logs',
  'bot_community_targets',
  'bot_keyword_videos',
  'family_model_rates',
  't_analyses',
  't_cafe24_tokens',
  't_cafe24_webhook_events',
  't_categories',
  't_channel_stats',
  't_channel_subscriptions',
  't_channels',
  't_comment_interactions',
  't_comments',
  't_credit_history',
  't_interactions',
  't_magic_links',
  't_notifications',
  't_payment_logs',
  't_rankings_cache',
  't_topics_master',
  't_unclaimed_payments',
  't_users',
  't_verification_codes',
  't_video_subscriptions',
  't_videos'
];

const foundTables = {};
tables.forEach(t => foundTables[t] = []);

function searchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  tables.forEach(table => {
    const regex = new RegExp(`\\b${table}\\b`, 'g');
    if (regex.test(content)) {
      foundTables[table].push(filePath);
    }
  });
}

function traverse(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git' && file !== 'scratch') {
        traverse(fullPath);
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        searchFile(fullPath);
      }
    }
  });
}

traverse(path.resolve(__dirname, '..'));

console.log("=== TABLE REFERENCES IN WHOLE PROJECT ===");
tables.forEach(table => {
  console.log(`\nTable: ${table} (Referenced in ${foundTables[table].length} files)`);
  if (foundTables[table].length > 0) {
    foundTables[table].slice(0, 10).forEach(file => {
      console.log(`  - ${path.relative(path.resolve(__dirname, '..'), file)}`);
    });
    if (foundTables[table].length > 10) {
      console.log(`  - ... and ${foundTables[table].length - 10} more files`);
    }
  }
});
