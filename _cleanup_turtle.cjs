const fs = require('fs');
const path = 'js/maze-game.js';
let s = fs.readFileSync(path, 'utf8');
const oldLine = '      const s = this.cell * 0.58;\n      const half = s / 2;\n';
const newLine = '      const s = this.cell * 0.58;\n';
if (s.split(oldLine).length - 1 !== 1) {
  console.error('unexpected match count', s.split(oldLine).length - 1);
  process.exit(1);
}
s = s.replace(oldLine, newLine);
fs.writeFileSync(path, s, 'utf8');
console.log('removed unused half');
