(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;
  const PLAYER_SPEED = 300;

  const DIFFICULTIES = {
    easy: { label: '\u7b80\u5355', desc: '7 x 7 \u5c0f\u8ff7\u5bab', cols: 7, rows: 7, bg: 0x4de5bf, line: 0x2f9d7c, stroke: '#2f9d7c', openRate: 0.3 },
    medium: { label: '\u4e2d\u7b49', desc: '9 x 9 \u8ff7\u5bab', cols: 9, rows: 9, bg: 0xffc24d, line: 0xd18a20, stroke: '#d18a20', openRate: 0.12 },
    hard: { label: '\u56f0\u96be', desc: '11 x 11 \u5927\u8ff7\u5bab', cols: 11, rows: 11, bg: 0xff8fb3, line: 0xd9668f, stroke: '#d9668f', openRate: 0 },
  };
  const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

  function generateMaze(cols, rows, openRate) {
    const grid = [];
    for (let row = 0; row < rows; row += 1) {
      grid[row] = [];
      for (let col = 0; col < cols; col += 1) grid[row][col] = 1;
    }

    const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]];
    const stack = [[1, 1]];
    grid[1][1] = 0;
    while (stack.length) {
      const current = stack[stack.length - 1];
      const row = current[0];
      const col = current[1];
      const neighbors = [];
      for (let d = 0; d < dirs.length; d += 1) {
        const nextRow = row + dirs[d][0];
        const nextCol = col + dirs[d][1];
        if (nextRow > 0 && nextRow < rows - 1 && nextCol > 0 && nextCol < cols - 1 && grid[nextRow][nextCol] === 1) {
          neighbors.push([nextRow, nextCol, dirs[d][0], dirs[d][1]]);
        }
      }
      if (!neighbors.length) {
        stack.pop();
        continue;
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      const nextRow = pick[0];
      const nextCol = pick[1];
      const wallRow = row + pick[2] / 2;
      const wallCol = col + pick[3] / 2;
      grid[nextRow][nextCol] = 0;
      grid[wallRow][wallCol] = 0;
      stack.push([nextRow, nextCol]);
    }

    if (openRate > 0) {
      for (let row = 1; row < rows - 1; row += 1) {
        for (let col = 1; col < cols - 1; col += 1) {
          const horizontalWall = row % 2 === 1 && col % 2 === 0;
          const verticalWall = row % 2 === 0 && col % 2 === 1;
          if ((horizontalWall || verticalWall) && grid[row][col] === 1 && Math.random() < openRate) {
            grid[row][col] = 0;
          }
        }
      }
    }

    return grid;
  }

  const COLORS = {
    bg: 0xfff3d6,
    path: 0xfffaf0,
    wallA: 0xff8fb3,
    wallB: 0x8fb8ff,
    wallLineA: 0xd9668f,
    wallLineB: 0x5f8fd9,
    wallInnerA: 0xffd9e7,
    wallInnerB: 0xdfeaff,
    player: 0xffd84e,
    playerLine: 0xc78a12,
    goal: 0x4de5bf,
  };

  class MazeGameScene extends Phaser.Scene {
    constructor() { super('MazeGameScene'); }

    create() {
      this.state = 'menu';
      this.difficultyKey = 'easy';
      this.level = 0;
      this.activePointerId = null;
      this.target = null;
      this.overlayItems = [];
      this.menuItems = [];

      this.bgGraphics = this.add.graphics().setDepth(0);
      this.mazeGraphics = this.add.graphics().setDepth(1);
      this.playerGraphics = this.add.graphics().setDepth(2);
      this.overlayGraphics = this.add.graphics().setDepth(3);

      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
      this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
      this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
      this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));

      this.drawBackground();
      this.showMenu();
    }

    showMenu() {
      this.clearMenu();
      this.mazeGraphics.clear();
      this.playerGraphics.clear();
      this.overlayGraphics.clear();

      const title = this.add.text(WIDTH / 2, HEIGHT * 0.16, '\u65b9\u5757\u8d70\u8ff7\u5bab', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#a84e70',
        stroke: '#fff4e6',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(4);

      const subtitle = this.add.text(WIDTH / 2, HEIGHT * 0.16 + 50, '\u9009\u4e00\u4e2a\u96be\u5ea6\u5f00\u59cb\u5427\uff01', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b5d82',
      }).setOrigin(0.5).setDepth(4);

      this.menuItems.push(title, subtitle);
      DIFFICULTY_ORDER.forEach((key, index) => this.createMenuButton(key, index));
    }

    clearMenu() {
      this.menuItems.forEach((item) => item.destroy());
      this.menuItems = [];
    }

    createMenuButton(key, index) {
      const config = DIFFICULTIES[key];
      const buttonW = Math.min(300, WIDTH - 72);
      const buttonH = Math.min(72, HEIGHT * 0.11);
      const gap = Math.min(88, HEIGHT * 0.12);
      const startY = HEIGHT * 0.38;
      const x = WIDTH / 2;
      const y = startY + index * gap;

      const g = this.add.graphics().setDepth(4);
      g.fillStyle(0x2f1f3a, 0.08).fillRoundedRect(x - buttonW / 2 + 4, y - buttonH / 2 + 6, buttonW, buttonH, 22);
      g.fillStyle(config.bg, 1).fillRoundedRect(x - buttonW / 2, y - buttonH / 2, buttonW, buttonH, 22);
      g.lineStyle(3, config.line, 0.9).strokeRoundedRect(x - buttonW / 2, y - buttonH / 2, buttonW, buttonH, 22);

      const zone = this.add.zone(x, y, buttonW, buttonH).setInteractive({ useHandCursor: true }).setDepth(5);
      const label = this.add.text(x, y - 14, config.label, {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: Math.max(20, Math.min(28, buttonH * 0.42)) + 'px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: config.stroke,
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(6);

      const desc = this.add.text(x, y + 16, config.desc, {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: Math.max(12, Math.min(14, buttonH * 0.22)) + 'px',
        color: '#ffffff',
        stroke: config.stroke,
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(6);

      zone.on('pointerdown', (pointer) => this.startGame(key, pointer));
      this.menuItems.push(g, zone, label, desc);
    }

    startGame(key, pointer) {
      this.clearMenu();
      this.difficultyKey = key;
      this.level = 1;
      this.activePointerId = pointer ? pointer.id : null;
      this.target = null;
      this.state = 'playing';
      this.setupMaze();
      this.drawBackground();
      this.drawMaze();
      this.drawGoal();
      this.drawPlayer();
    }

    setupMaze() {
      const config = DIFFICULTIES[this.difficultyKey];
      this.cols = config.cols;
      this.rows = config.rows;

      const minSide = Math.min(WIDTH, HEIGHT);
      this.cell = Math.floor((minSide - 56) / this.cols);
      this.mazeSize = this.cell * this.cols;
      this.originX = (WIDTH - this.mazeSize) / 2;
      this.originY = (HEIGHT - this.mazeSize) / 2;
      this.playerSize = this.cell * 0.5;

      this.startCol = 1;
      this.startRow = 1;
      this.goalCol = this.cols - 2;
      this.goalRow = this.rows - 2;
      this.startX = this.cellCenterX(this.startCol);
      this.startY = this.cellCenterY(this.startRow);
      this.goalX = this.cellCenterX(this.goalCol);
      this.goalY = this.cellCenterY(this.goalRow);
      this.playerX = this.startX;
      this.playerY = this.startY;

      this.maze = generateMaze(this.cols, this.rows, config.openRate);

      this.walls = [];
      for (let row = 0; row < this.rows; row += 1) {
        for (let col = 0; col < this.cols; col += 1) {
          if (this.maze[row][col] === 1) {
            this.walls.push({
              x: this.originX + col * this.cell,
              y: this.originY + row * this.cell,
              w: this.cell,
              h: this.cell,
            });
          }
        }
      }
    }

    cellCenterX(col) { return this.originX + (col + 0.5) * this.cell; }
    cellCenterY(row) { return this.originY + (row + 0.5) * this.cell; }

    drawBackground() {
      const g = this.bgGraphics;
      g.clear();
      g.fillStyle(COLORS.bg, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xffd6e7, 0.7).fillCircle(WIDTH * 0.08, HEIGHT * 0.1, Math.min(WIDTH, HEIGHT) * 0.24);
      g.fillStyle(0xcfeaff, 0.8).fillCircle(WIDTH * 0.94, HEIGHT * 0.88, Math.min(WIDTH, HEIGHT) * 0.28);
      g.fillStyle(0xfff0b8, 0.65).fillCircle(WIDTH * 0.9, HEIGHT * 0.08, Math.min(WIDTH, HEIGHT) * 0.2);
    }

    drawMaze() {
      const g = this.mazeGraphics;
      g.clear();
      g.fillStyle(COLORS.path, 1).fillRoundedRect(this.originX, this.originY, this.mazeSize, this.mazeSize, 22);

      for (let row = 0; row < this.rows; row += 1) {
        for (let col = 0; col < this.cols; col += 1) {
          if (this.maze[row][col] !== 1) continue;
          const x = this.originX + col * this.cell;
          const y = this.originY + row * this.cell;
          const warm = (row + col) % 2 === 0;
          const color = warm ? COLORS.wallA : COLORS.wallB;
          const line = warm ? COLORS.wallLineA : COLORS.wallLineB;
          const inner = warm ? COLORS.wallInnerA : COLORS.wallInnerB;
          g.fillStyle(color, 1).fillRect(x, y, this.cell, this.cell);
          g.fillStyle(inner, 0.9).fillRoundedRect(x + 4, y + 4, this.cell - 8, this.cell - 8, Math.max(6, this.cell * 0.18));
          g.lineStyle(2, line, 0.85).strokeRoundedRect(x + 4, y + 4, this.cell - 8, this.cell - 8, Math.max(6, this.cell * 0.18));
        }
      }

      const sx = this.cellCenterX(this.startCol);
      const sy = this.cellCenterY(this.startRow);
      g.fillStyle(0xb8a4ff, 0.75).fillCircle(sx, sy, this.cell * 0.22);
      g.lineStyle(2, 0x8f7bd8, 0.8).strokeCircle(sx, sy, this.cell * 0.22);
    }

    drawGoal() {
      if (this.goalText) this.goalText.destroy();
      this.goalText = this.add.text(this.goalX, this.goalY, '★', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: Math.round(this.cell * 0.66) + 'px',
        color: '#ffffff',
        stroke: '#2f9d7c',
        strokeThickness: Math.max(3, Math.round(this.cell * 0.08)),
      }).setOrigin(0.5).setDepth(1);
    }

    drawPlayer() {
      const g = this.playerGraphics;
      g.clear();
      const half = this.playerSize / 2;
      const x = this.playerX;
      const y = this.playerY;
      const r = Math.max(6, this.playerSize * 0.26);

      g.fillStyle(0x4a2f18, 0.16).fillRoundedRect(x - half + 2, y - half + 4, this.playerSize, this.playerSize, r);
      g.fillStyle(COLORS.player, 1).fillRoundedRect(x - half, y - half, this.playerSize, this.playerSize, r);
      g.lineStyle(2, COLORS.playerLine, 0.95).strokeRoundedRect(x - half, y - half, this.playerSize, this.playerSize, r);

      const eyeY = y - this.playerSize * 0.08;
      const eyeDX = this.playerSize * 0.16;
      const eyeR = Math.max(2, this.playerSize * 0.075);
      g.fillStyle(0x3a2b12, 1).fillCircle(x - eyeDX, eyeY, eyeR);
      g.fillStyle(0x3a2b12, 1).fillCircle(x + eyeDX, eyeY, eyeR);
      g.lineStyle(2, 0x3a2b12, 1).lineBetween(x - this.playerSize * 0.12, y + this.playerSize * 0.14, x + this.playerSize * 0.12, y + this.playerSize * 0.14);
    }

    onPointerDown(pointer) {
      if (this.state !== 'playing') return;
      if (this.activePointerId !== null) return;
      this.activePointerId = pointer.id;
      this.target = { x: pointer.x, y: pointer.y };
    }

    onPointerMove(pointer) {
      if (this.activePointerId !== pointer.id) return;
      this.target = { x: pointer.x, y: pointer.y };
    }

    onPointerUp(pointer) {
      if (this.activePointerId !== pointer.id) return;
      this.activePointerId = null;
      this.target = null;
    }

    update(time, delta) {
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
      if (this.isOnGoal()) this.win();
    }

    tryMove(stepX, stepY) {
      const nextX = this.playerX + stepX;
      const nextY = this.playerY + stepY;
      if (this.collides(nextX, nextY)) return;
      this.playerX = nextX;
      this.playerY = nextY;
    }

    collides(centerX, centerY) {
      const half = this.playerSize / 2;
      const left = centerX - half;
      const right = centerX + half;
      const top = centerY - half;
      const bottom = centerY + half;
      if (left < this.originX || right > this.originX + this.mazeSize || top < this.originY || bottom > this.originY + this.mazeSize) return true;
      for (let i = 0; i < this.walls.length; i += 1) {
        const w = this.walls[i];
        if (left < w.x + w.w && right > w.x && top < w.y + w.h && bottom > w.y) return true;
      }
      return false;
    }

    isOnGoal() {
      return Math.abs(this.playerX - this.goalX) < this.cell * 0.34 && Math.abs(this.playerY - this.goalY) < this.cell * 0.34;
    }

    win() {
      if (this.state !== 'playing') return;
      this.state = 'won';
      this.activePointerId = null;
      this.target = null;

      const g = this.overlayGraphics;
      g.clear();
      g.fillStyle(0x2f1f3a, 0.3).fillRect(0, 0, WIDTH, HEIGHT);
      const panelW = Math.min(400, WIDTH - 40);
      const panelH = 250;
      g.fillStyle(0xffffff, 0.98).fillRoundedRect((WIDTH - panelW) / 2, (HEIGHT - panelH) / 2, panelW, panelH, 28);

      const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 70, '\u5230\u8fbe\u7ec8\u70b9\uff01', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ff8a48',
        stroke: '#fff4e6',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(4);

      const subtitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 16, '\u7b2c ' + this.level + ' \u5173\u901a\u8fc7\uff01\u771f\u68d2\uff01', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b5d82',
      }).setOrigin(0.5).setDepth(4);

      const difficultyText = this.add.text(WIDTH / 2, HEIGHT / 2 + 20, DIFFICULTIES[this.difficultyKey].label + ' \u8ff7\u5bab', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '16px',
        color: '#a48ab8',
      }).setOrigin(0.5).setDepth(4);

      const button = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 74, 220, 54, 0xff8a48, 1).setStrokeStyle(3, 0xffd8a8, 0.95).setInteractive({ useHandCursor: true }).setDepth(4);
      const buttonText = this.add.text(WIDTH / 2, HEIGHT / 2 + 74, '\u4e0b\u4e00\u5173', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#b85c2a',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(5);

      button.on('pointerdown', (pointer) => this.nextLevel(pointer));
      this.overlayItems.push(title, subtitle, difficultyText, button, buttonText);
    }

    nextLevel(pointer) {
      this.clearOverlay();
      this.level += 1;
      this.activePointerId = pointer ? pointer.id : null;
      this.target = null;
      this.state = 'playing';
      this.setupMaze();
      this.drawMaze();
      this.drawGoal();
      this.drawPlayer();
    }

    clearOverlay() {
      this.overlayGraphics.clear();
      this.overlayItems.forEach((item) => item.destroy());
      this.overlayItems = [];
    }
  }

  window.MazeGameScene = MazeGameScene;
})();
