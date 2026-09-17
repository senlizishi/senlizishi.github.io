const fs = require('fs');
const path = 'js/maze-game.js';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(original, replacement) {
  if (s.split(original).length - 1 !== 1) {
    throw new Error('Expected exactly one occurrence, got ' + (s.split(original).length - 1) + ' for snippet: ' + original.slice(0, 80).replace(/\n/g, '\\n'));
  }
  s = s.replace(original, replacement);
}

// 1. turtle speed constant
replaceOnce(
  '  const PLAYER_SPEED = 300;\n',
  '  const PLAYER_SPEED = 300;\n  const TURTLE_SPEED = 55;\n'
);

// 2. turtle graphics + state in create
replaceOnce(
  '      this.chestOpened = false;\n\n      this.bgGraphics = this.add.graphics().setDepth(0);\n',
  '      this.chestOpened = false;\n      this.turtle = null;\n\n      this.bgGraphics = this.add.graphics().setDepth(0);\n'
);
replaceOnce(
  '      this.goalChestGraphics = this.add.graphics().setDepth(1);\n',
  '      this.goalChestGraphics = this.add.graphics().setDepth(1);\n      this.turtleGraphics = this.add.graphics().setDepth(1);\n'
);

// 3. clear turtle when showing menu
replaceOnce(
  '      this.mazeGraphics.clear();\n      this.playerGraphics.clear();\n      this.overlayGraphics.clear();\n',
  '      this.mazeGraphics.clear();\n      this.playerGraphics.clear();\n      this.overlayGraphics.clear();\n      if (this.turtleGraphics) this.turtleGraphics.clear();\n      this.turtle = null;\n'
);

// 4. draw turtle after starting a game
replaceOnce(
  '      this.updateStarHud();\n      this.drawPlayer();\n    }\n\n    setupMaze() {\n',
  '      this.updateStarHud();\n      this.drawPlayer();\n      this.drawTurtle();\n    }\n\n    setupMaze() {\n'
);

// 5. spawn turtle in setupMaze after stars
const oldSetupEnd = `      this.starCells = pathCells.slice(0, Math.min(3, pathCells.length)).map((cell) => {
        return {
          row: cell.row,
          col: cell.col,
          collected: false,
          x: this.cellCenterX(cell.col),
          y: this.cellCenterY(cell.row),
        };
      });
    }

    cellCenterX(col) { return this.originX + (col + 0.5) * this.cell; }`;
const newSetupEnd = `      this.starCells = pathCells.slice(0, Math.min(3, pathCells.length)).map((cell) => {
        return {
          row: cell.row,
          col: cell.col,
          collected: false,
          x: this.cellCenterX(cell.col),
          y: this.cellCenterY(cell.row),
        };
      });

      const starKeys = {};
      this.starCells.forEach((star) => { starKeys[star.row + ',' + star.col] = true; });
      const turtleCandidates = pathCells.filter((cell) => {
        if (starKeys[cell.row + ',' + cell.col]) return false;
        return Math.abs(cell.row - this.startRow) + Math.abs(cell.col - this.startCol) >= 5;
      });
      const turtleCell = turtleCandidates.length
        ? turtleCandidates[Math.floor(Math.random() * turtleCandidates.length)]
        : pathCells[pathCells.length - 1];
      this.turtle = {
        row: turtleCell.row,
        col: turtleCell.col,
        x: this.cellCenterX(turtleCell.col),
        y: this.cellCenterY(turtleCell.row),
        prevRow: -1,
        prevCol: -1,
        targetRow: turtleCell.row,
        targetCol: turtleCell.col,
      };
      this.pickNextTurtleCell();
    }

    cellCenterX(col) { return this.originX + (col + 0.5) * this.cell; }`;
replaceOnce(oldSetupEnd, newSetupEnd);

// 6. insert turtle logic helpers after cellCenterY
const oldCenter = `    cellCenterX(col) { return this.originX + (col + 0.5) * this.cell; }
    cellCenterY(row) { return this.originY + (row + 0.5) * this.cell; }

    drawBackground() {`;
const turtleHelpers = `    cellCenterX(col) { return this.originX + (col + 0.5) * this.cell; }
    cellCenterY(row) { return this.originY + (row + 0.5) * this.cell; }

    isPathCell(row, col) {
      return row > 0 && row < this.rows - 1 && col > 0 && col < this.cols - 1 && this.maze[row][col] === 0;
    }

    isTurtlePathCell(row, col) {
      if (!this.isPathCell(row, col)) return false;
      if (row === this.startRow && col === this.startCol) return false;
      if (row === this.goalRow && col === this.goalCol) return false;
      return true;
    }

    pickNextTurtleCell() {
      if (!this.turtle) return;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const candidates = [];
      for (let d = 0; d < dirs.length; d += 1) {
        const nextRow = this.turtle.row + dirs[d][0];
        const nextCol = this.turtle.col + dirs[d][1];
        if (!this.isTurtlePathCell(nextRow, nextCol)) continue;
        if (nextRow === this.turtle.prevRow && nextCol === this.turtle.prevCol && candidates.length > 0) continue;
        candidates.push({ row: nextRow, col: nextCol });
      }
      if (!candidates.length && this.isTurtlePathCell(this.turtle.prevRow, this.turtle.prevCol)) {
        candidates.push({ row: this.turtle.prevRow, col: this.turtle.prevCol });
      }
      if (!candidates.length) return;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      this.turtle.prevRow = this.turtle.row;
      this.turtle.prevCol = this.turtle.col;
      this.turtle.targetRow = pick.row;
      this.turtle.targetCol = pick.col;
    }

    updateTurtle(dt) {
      if (!this.turtle) return;
      const targetX = this.cellCenterX(this.turtle.targetCol);
      const targetY = this.cellCenterY(this.turtle.targetRow);
      const dx = targetX - this.turtle.x;
      const dy = targetY - this.turtle.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.5) {
        this.turtle.x = targetX;
        this.turtle.y = targetY;
        this.turtle.row = this.turtle.targetRow;
        this.turtle.col = this.turtle.targetCol;
        this.pickNextTurtleCell();
        return;
      }
      const step = Math.min(TURTLE_SPEED * dt, dist);
      this.turtle.x += (dx / dist) * step;
      this.turtle.y += (dy / dist) * step;
    }

    drawBackground() {`;
replaceOnce(oldCenter, turtleHelpers);

// 7. insert turtle drawing and collision methods before onPointerDown
const oldPointer = `    }

    onPointerDown(pointer) {`;
const turtleDraw = `    }

    drawTurtle() {
      const g = this.turtleGraphics;
      g.clear();
      if (!this.turtle) return;
      const x = this.turtle.x;
      const y = this.turtle.y;
      const s = this.cell * 0.58;
      const half = s / 2;

      g.fillStyle(0x2f6b43, 0.16).fillEllipse(x + 2, y + 3, s * 1.02, s * 0.86);
      g.fillStyle(0x57b56f, 1).fillEllipse(x, y - s * 0.04, s, s * 0.76);
      g.lineStyle(2, 0x2f7a47, 0.9).strokeEllipse(x, y - s * 0.04, s, s * 0.76);
      g.fillStyle(0x8fd977, 0.9).fillEllipse(x, y - s * 0.08, s * 0.62, s * 0.44);
      g.fillStyle(0x2f7a47, 1).fillCircle(x, y - s * 0.05, s * 0.06);

      g.fillStyle(0x8fd977, 1).fillCircle(x + s * 0.52, y - s * 0.06, s * 0.17);
      g.fillStyle(0x2f4a1e, 1).fillCircle(x + s * 0.59, y - s * 0.17, s * 0.045);
      g.fillStyle(0xffffff, 1).fillCircle(x + s * 0.61, y - s * 0.18, s * 0.016);

      g.fillStyle(0x6fbf73, 1).fillEllipse(x - s * 0.40, y + s * 0.20, s * 0.18, s * 0.11);
      g.fillStyle(0x6fbf73, 1).fillEllipse(x + s * 0.40, y + s * 0.20, s * 0.18, s * 0.11);
      g.fillStyle(0x6fbf73, 1).fillEllipse(x - s * 0.28, y - s * 0.42, s * 0.16, s * 0.10);
      g.fillStyle(0x6fbf73, 1).fillEllipse(x + s * 0.28, y - s * 0.42, s * 0.16, s * 0.10);
      g.fillStyle(0x8fd977, 1).fillEllipse(x - s * 0.52, y - s * 0.02, s * 0.20, s * 0.09);
    }

    turtleTouchesPlayer() {
      if (!this.turtle || this.state !== 'playing') return false;
      const dx = this.playerX - this.turtle.x;
      const dy = this.playerY - this.turtle.y;
      const radius = (this.playerSize + this.cell * 0.58) / 2;
      return dx * dx + dy * dy < radius * radius;
    }

    hitByTurtle() {
      this.playerX = this.startX;
      this.playerY = this.startY;
      this.activePointerId = null;
      this.target = null;
      this.drawPlayer();
      const text = this.add.text(this.startX, this.startY - this.cell * 0.7, '\\u54ce\\u5440\\uff0c\\u88ab\\u5c0f\\u4e4c\\u9f9f\\u78b0\\u5230\\u5566', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: Math.max(14, Math.round(this.cell * 0.42)) + 'px',
        fontStyle: 'bold',
        color: '#a84e70',
        stroke: '#fff4e6',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(4);
      this.tweens.add({
        targets: text,
        y: text.y - this.cell * 0.35,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        onComplete: () => text.destroy(),
      });
    }

    onPointerDown(pointer) {`;
replaceOnce(oldPointer, turtleDraw);

// 8. replace update to move turtle even when the player is not dragging
const oldUpdate = `    update(time, delta) {
      if (this.state !== 'playing' || !this.target) return;
      const dt = Math.min(delta, 50) / 1000;
      const dx = this.target.x - this.playerX;
      const dy = this.target.y - this.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5) return;

      const speed = Math.min(PLAYER_SPEED, dist / dt);
      const moveX = (dx / dist) * speed * dt;
      const moveY = (dy / dist) * speed * dt;
      this.tryMove(moveX, 0);
      this.tryMove(0, moveY);

      this.drawPlayer();
      this.checkCollectibles();
      if (this.isOnGoal()) this.win();
    }`;
const newUpdate = `    update(time, delta) {
      if (this.state !== 'playing') return;
      const dt = Math.min(delta, 50) / 1000;

      this.updateTurtle(dt);
      this.drawTurtle();
      if (this.turtleTouchesPlayer()) {
        this.hitByTurtle();
        return;
      }

      if (!this.target) return;
      const dx = this.target.x - this.playerX;
      const dy = this.target.y - this.playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.5) return;

      const speed = Math.min(PLAYER_SPEED, dist / dt);
      const moveX = (dx / dist) * speed * dt;
      const moveY = (dy / dist) * speed * dt;
      this.tryMove(moveX, 0);
      this.tryMove(0, moveY);

      this.drawPlayer();
      this.checkCollectibles();
      if (this.isOnGoal()) this.win();
    }`;
replaceOnce(oldUpdate, newUpdate);

// 9. draw turtle on next level
replaceOnce(
  '      this.updateStarHud();\n      this.drawPlayer();\n    }\n\n    clearOverlay() {\n',
  '      this.updateStarHud();\n      this.drawPlayer();\n      this.drawTurtle();\n    }\n\n    clearOverlay() {\n'
);

fs.writeFileSync(path, s, 'utf8');
console.log('turtle patch applied');
