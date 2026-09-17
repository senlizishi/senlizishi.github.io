const fs = require('fs');
const lines = fs.readFileSync('js/maze-game.js', 'utf8').split(/\r?\n/);
function esc(s) { return s.replace(/[^\x20-\x7E]/g, c => '\\u' + c.codePointAt(0).toString(16).padStart(4, '0')); }
for (let i = 0; i < lines.length; i++) {
  const n = i + 1;
  if (n >= 615 && n <= 650) console.log(String(n).padStart(4, ' ') + ' ' + esc(lines[i]));
}
