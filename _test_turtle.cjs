const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/maze-game.js', 'utf8');
class Scene {}
const sandbox = { window: { innerWidth: 540, innerHeight: 960 }, Phaser: { Scene }, console, Math };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'maze-game.js' });
const MazeGameScene = sandbox.window.MazeGameScene;
if (!MazeGameScene) throw new Error('MazeGameScene not exported');

function makeScene(difficultyKey, level) {
  const scene = Object.create(MazeGameScene.prototype);
  scene.difficultyKey = difficultyKey;
  scene.level = level;
  return scene;
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures += 1; console.error('FAIL: ' + msg); }
  else console.log('PASS: ' + msg);
}

const easy = makeScene('easy', 1);
easy.setupMaze();
assert(!!easy.turtle, 'easy spawns turtle');
const t = easy.turtle;
assert(easy.maze[t.row][t.col] === 0, 'easy turtle starts on a path cell');
assert(!(t.row === easy.startRow && t.col === easy.startCol), 'easy turtle not on start');
assert(!(t.row === easy.goalRow && t.col === easy.goalCol), 'easy turtle not on goal');
assert(!easy.starCells.some(s => s.row === t.row && s.col === t.col), 'easy turtle not on star');
assert(easy.isPathCell(t.targetRow, t.targetCol), 'easy turtle target is a path cell');
assert(!(t.targetRow === easy.startRow && t.targetCol === easy.startCol), 'easy turtle target not start');
assert(!(t.targetRow === easy.goalRow && t.targetCol === easy.goalCol), 'easy turtle target not goal');
assert(Math.abs(t.targetRow - t.row) + Math.abs(t.targetCol - t.col) === 1, 'easy turtle target is adjacent');

const startX = t.x, startY = t.y;
for (let i = 0; i < 400; i += 1) easy.updateTurtle(1 / 60);
assert(Number.isFinite(t.x) && Number.isFinite(t.y), 'easy turtle stays finite after moving');
assert(t.x >= easy.originX - 1 && t.x <= easy.originX + easy.mazeWidth + 1, 'easy turtle stays inside maze width');
assert(t.y >= easy.originY - 1 && t.y <= easy.originY + easy.mazeHeight + 1, 'easy turtle stays inside maze height');
assert(!(t.x === startX && t.y === startY && t.row === t.targetRow && t.col === t.targetCol), 'easy turtle changed/advanced toward patrol');

for (let i = 0; i < 100; i += 1) easy.pickNextTurtleCell();
assert(!(t.targetRow === easy.startRow && t.targetCol === easy.startCol), 'repeated turtle target avoids start');
assert(!(t.targetRow === easy.goalRow && t.targetCol === easy.goalCol), 'repeated turtle target avoids goal');
assert(easy.isPathCell(t.targetRow, t.targetCol), 'repeated turtle target stays on path');

easy.playerX = t.x; easy.playerY = t.y; easy.state = 'playing';
assert(easy.turtleTouchesPlayer(), 'collision detects overlap');
easy.playerX = easy.startX; easy.playerY = easy.startY;
assert(!easy.turtleTouchesPlayer(), 'collision false when far apart');

const hard = makeScene('hard', 2);
hard.setupMaze();
assert(!!hard.turtle, 'hard spawns turtle');
assert(hard.maze[hard.turtle.row][hard.turtle.col] === 0, 'hard turtle on path');
assert(!(hard.turtle.row === hard.startRow && hard.turtle.col === hard.startCol), 'hard turtle not on start');
assert(!(hard.turtle.row === hard.goalRow && hard.turtle.col === hard.goalCol), 'hard turtle not on goal');
assert(hard.isPathCell(hard.turtle.targetRow, hard.turtle.targetCol), 'hard turtle target on path');

if (failures) { console.error(failures + ' assertion(s) failed'); process.exit(1); }
console.log('ALL TURTLE LOGIC CHECKS PASSED');
