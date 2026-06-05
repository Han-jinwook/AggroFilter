const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const keywords = [/toss/i, /cafe24/i, /kcp/i, /payment/i, /credit/i];

const findings = {
  obsoleteFolders: [],
  obsoleteFiles: [],
  codeReferences: []
};

// 1. Scan directory structure for files/directories containing keywords
function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const relativePath = path.relative(rootDir, fullPath);
    const stat = fs.statSync(fullPath);

    if (relativePath.startsWith('node_modules') || 
        relativePath.startsWith('.next') || 
        relativePath.startsWith('.git') || 
        relativePath.startsWith('scratch') ||
        relativePath.startsWith('src/services/merlin-hub-sdk')) {
      return;
    }

    const matchesKeyword = keywords.some(kw => kw.test(file));

    if (stat.isDirectory()) {
      if (matchesKeyword) {
        findings.obsoleteFolders.push({ path: relativePath, desc: 'Folder matching payment keyword' });
      }
      scanDirectory(fullPath);
    } else {
      if (matchesKeyword && /\.(ts|tsx|js|jsx|json)$/.test(file)) {
        findings.obsoleteFiles.push({ path: relativePath, desc: 'File matching payment keyword' });
      } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        // Scan file content for references
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          keywords.forEach(kw => {
            if (kw.test(line)) {
              findings.codeReferences.push({
                file: relativePath,
                line: index + 1,
                text: line.trim().substring(0, 100),
                keyword: kw.toString()
              });
            }
          });
        });
      }
    }
  });
}

scanDirectory(rootDir);

console.log("=== SCAN RESULTS ===");
console.log(JSON.stringify(findings, null, 2));
