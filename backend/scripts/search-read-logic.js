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
        if (line.includes('isRead') || line.includes('unreadCount')) {
          console.log(`${path.relative(dirToSearch, fullPath)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

console.log('Searching for isRead/unreadCount in backend...');
searchDir(dirToSearch);
