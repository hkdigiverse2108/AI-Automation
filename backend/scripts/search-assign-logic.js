const fs = require('fs');
const path = require('path');

const dirToSearch = path.join(__dirname, '..');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchDir(fullPath);
      }
    } else if (file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (
          line.includes('assignedAgent') || 
          line.includes('assigned_agent_id') || 
          line.includes("'human'") || 
          line.includes('"human"')
        ) {
          console.log(`${path.relative(dirToSearch, fullPath)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log('Searching for human/assignment references in backend...');
searchDir(dirToSearch);
