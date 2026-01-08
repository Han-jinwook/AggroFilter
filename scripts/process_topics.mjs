import fs from 'fs';
import path from 'path';

const rawFilePath = path.join(process.cwd(), 'data/raw_topics.txt');
const outputFilePath = path.join(process.cwd(), 'data/topics.json');

try {
  const rawContent = fs.readFileSync(rawFilePath, 'utf-8');
  const lines = rawContent.split('\n');
  
  const uniqueTopics = new Set();

  lines.forEach(line => {
    let cleanLine = line.trim();
    
    // Skip empty lines
    if (!cleanLine) return;
    
    // Skip category headers like [게임], [영화·드라마]
    if (cleanLine.startsWith('[') && cleanLine.endsWith(']')) return;
    
    // Skip lines starting with special chars like ※, •, -
    if (cleanLine.startsWith('※') || cleanLine.startsWith('•') || cleanLine.startsWith('-')) return;

    // Remove Bullet points if any remain (though the check above covers most)
    cleanLine = cleanLine.replace(/^[•\-\s]+/, '');

    // Add to set for deduplication
    if (cleanLine) {
        uniqueTopics.add(cleanLine);
    }
  });

  const sortedTopics = Array.from(uniqueTopics).sort();
  
  fs.writeFileSync(outputFilePath, JSON.stringify(sortedTopics, null, 2));
  
  console.log(`Processed ${sortedTopics.length} unique topics.`);
  console.log(`Saved to ${outputFilePath}`);

} catch (error) {
  console.error('Error processing topics:', error);
}
