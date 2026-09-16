(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;
  const COLS = 7;
  const ROWS = 7;
  const PLAYER_SPEED = 300;

  const MAZE = [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ];
  const START_COL = 1;
  const START_ROW = 1;
  const GOAL_COL = 5;
  const GOAL_ROW = 5;

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
      this.state = 'playing';
      this.activePointerId = null;
      this.target = null;
      this.overlayItems = [];

      const minSide = Math.min(WIDTH, HEIGHT);
      this.cell = Math.floor((minSide - 56) / COLS);
      this.mazeSize = this.cell * COLS;
      this.originX = (WIDTH - this.mazeSize) / 2;
      this.originY = (HEIGHT - this.mazeSize) / 2;
      this.playerSize = this.cell * 0.5;
      this.startX = this.cellCenterX(START_COL);
      this.startY = this.cellCenterY(START_ROW);
      this.goalX = this.cellCenterX(GOAL_COL);
      this.goalY = this.cellCenterY(GOAL_ROW);
      this.playerX = this.startX;
      this.playerY = this.startY;

      this.walls = [];
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (MAZE[row][col] === 1) {
            this.walls.push({
              x: this.originX + col * this.cell,
              y: this.originY + row * this.cell,
              w: this.cell,
              h: this.cell,
            });
          }
        }
      }

      this.bgGraphics = this.add.graphics().setDepth(0);
      this.mazeGraphics = this.add.graphics().setDepth(1);
      this.playerGraphics = this.add.graphics().setDepth(2);
      this.overlayGraphics = this.add.graphics().setDepth(3);

      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
      this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
      this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
      this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));

      this.drawBackground();
      this.drawMaze();
      this.drawGoal();
      this.drawPlayer();
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

      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          if (MAZE[row][col] !== 1) continue;
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

      const sx = this.cellCenterX(START_COL);
      const sy = this.cellCenterY(START_ROW);
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
      const panelH = 232;
      g.fillStyle(0xffffff, 0.98).fillRoundedRect((WIDTH - panelW) / 2, (HEIGHT - panelH) / 2, panelW, panelH, 28);

      const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 58, '到达终点！', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '38px', fontStyle: 'bold', color: '#ff8a48', stroke: '#fff4e6', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(4);
      const subtitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 6, '真棒，小方块走出迷宫啦！', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '18px', color: '#6b5d82',
      }).setOrigin(0.5).setDepth(4);
      const button = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 56, 200, 52, 0xff8a48, 1).setStrokeStyle(3, 0xffd8a8, 0.95).setInteractive({ useHandCursor: true }).setDepth(4);
      const buttonText = this.add.text(WIDTH / 2, HEIGHT / 2 + 56, '再玩一次', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#ffffff', stroke: '#b85c2a', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(5);
      button.on('pointerdown', (pointer) => this.resetGame(pointer));
      this.overlayItems.push(title, subtitle, button, buttonText);
    }

    resetGame(pointer) {
      this.clearOverlay();
      this.playerX = this.startX;
      this.playerY = this.startY;
      this.activePointerId = pointer ? pointer.id : null;
      this.target = null;
      this.state = 'playing';
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
