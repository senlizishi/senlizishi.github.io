(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;
  const PLAYER_SPEED = 300;

  const DIFFICULTIES = {
    easy: { label: '\u7b80\u5355', desc: '11 x 11 \u8ff7\u5bab', cols: 11, rows: 11, bg: 0x4de5bf, line: 0x2f9d7c, stroke: '#2f9d7c', openRate: 0 },
    hard: { label: '\u56f0\u96be', desc: '\u6ee1\u5c4f\u5927\u8ff7\u5bab', cols: 0, rows: 0, fullscreen: true, bg: 0xff8fb3, line: 0xd9668f, stroke: '#d9668f', openRate: 0 },
  };
  const DIFFICULTY_ORDER = ['easy', 'hard'];

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

  function generatePrimMaze(cols, rows) {
    const grid = [];
    for (let row = 0; row < rows; row += 1) {
      grid[row] = [];
      for (let col = 0; col < cols; col += 1) grid[row][col] = 1;
    }

    const dirs = [[-2, 0], [2, 0], [0, -2], [0, 2]];
    const startRow = 1;
    const startCol = 1;
    grid[startRow][startCol] = 0;
    const frontier = [];

    const addFrontiers = (roomRow, roomCol) => {
      for (let d = 0; d < dirs.length; d += 1) {
        const nextRow = roomRow + dirs[d][0];
        const nextCol = roomCol + dirs[d][1];
        if (nextRow > 0 && nextRow < rows - 1 && nextCol > 0 && nextCol < cols - 1 && grid[nextRow][nextCol] === 1) {
          grid[nextRow][nextCol] = 2;
          frontier.push([nextRow, nextCol, roomRow, roomCol]);
        }
      }
    };

    addFrontiers(startRow, startCol);

    while (frontier.length) {
      const index = Math.floor(Math.random() * frontier.length);
      const cell = frontier.splice(index, 1)[0];
      const nextRow = cell[0];
      const nextCol = cell[1];
      const fromRow = cell[2];
      const fromCol = cell[3];
      const wallRow = (nextRow + fromRow) / 2;
      const wallCol = (nextCol + fromCol) / 2;
      grid[nextRow][nextCol] = 0;
      grid[wallRow][wallCol] = 0;
      addFrontiers(nextRow, nextCol);
    }

    for (let row = 1; row < rows - 1; row += 1) {
      for (let col = 1; col < cols - 1; col += 1) {
        if (grid[row][col] === 2) grid[row][col] = 1;
      }
    }

    return grid;
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  const THEMES = [
    {
      bg: 0xfff3d6, path: 0xfffaf0,
      wallA: 0xff8fb3, wallB: 0x8fb8ff, wallLineA: 0xd9668f, wallLineB: 0x5f8fd9,
      wallInnerA: 0xffd9e7, wallInnerB: 0xdfeaff,
      player: 0xffd84e, playerLine: 0xc78a12,
      start: 0xb8a4ff, startLine: 0x8f7bd8, goalStroke: '#2f9d7c',
      accentA: 0xffd6e7, accentB: 0xcfeaff, accentC: 0xfff0b8,
    },
    {
      bg: 0xffe8c2, path: 0xfff4d6,
      wallA: 0xf2a65a, wallB: 0xe58e4a, wallLineA: 0xb96a2f, wallLineB: 0x9f5524,
      wallInnerA: 0xffd9a3, wallInnerB: 0xf7c17c,
      player: 0x7fdcff, playerLine: 0x2f80a6,
      start: 0xffb26b, startLine: 0xd97c2e, goalStroke: '#1f7a4d',
      accentA: 0xffd59e, accentB: 0xffc27a, accentC: 0xffe9b0,
    },
    {
      bg: 0xc8f0ff, path: 0xfff7dd,
      wallA: 0x2f9bd6, wallB: 0x57c8d6, wallLineA: 0x1d6fa8, wallLineB: 0x2a8f9f,
      wallInnerA: 0xbdeaff, wallInnerB: 0xc8f5f2,
      player: 0xffd84e, playerLine: 0xd18a20,
      start: 0x8bd9ff, startLine: 0x3f8fc0, goalStroke: '#d9577f',
      accentA: 0xa8e6ff, accentB: 0xb7f0ff, accentC: 0xd6fff4,
    },
    {
      bg: 0x171233, path: 0x241b45,
      wallA: 0x8f7bff, wallB: 0x5f7dff, wallLineA: 0x6f5bd8, wallLineB: 0x435ec7,
      wallInnerA: 0xcfc5ff, wallInnerB: 0xc8d6ff,
      player: 0x66e7ff, playerLine: 0x2f8fa6,
      start: 0xffd84e, startLine: 0xc78a12, goalStroke: '#1f9d7c',
      accentA: 0x6f5bd8, accentB: 0x3b8fd9, accentC: 0xb36bff,
    },
    {
      bg: 0xd9f2c9, path: 0xf7f3d8,
      wallA: 0x6fbf73, wallB: 0x4fa36b, wallLineA: 0x3e7d4f, wallLineB: 0x2f6b43,
      wallInnerA: 0xd3f2c4, wallInnerB: 0xc5e8b5,
      player: 0xffb84d, playerLine: 0xc77920,
      start: 0xa9d977, startLine: 0x5f9b4a, goalStroke: '#c24478',
      accentA: 0xbff0a8, accentB: 0x8fd9a0, accentC: 0xffe7a8,
    },
    {
      bg: 0xffd9c9, path: 0xfff2df,
      wallA: 0xff8a70, wallB: 0xffb35c, wallLineA: 0xd95f4e, wallLineB: 0xc97f33,
      wallInnerA: 0xffcbb8, wallInnerB: 0xffdfad,
      player: 0x8fd9ff, playerLine: 0x4f8fb8,
      start: 0xffe36b, startLine: 0xc78a20, goalStroke: '#5847d1',
      accentA: 0xffc2ad, accentB: 0xffe1b8, accentC: 0xffb3d1,
    },
  ];

  class MazeGameScene extends Phaser.Scene {
    constructor() { super('MazeGameScene'); }

    create() {
      this.state = 'menu';
      this.theme = THEMES[0];
      this.difficultyKey = 'easy';
      this.level = 0;
      this.activePointerId = null;
      this.target = null;
      this.overlayItems = [];
      this.menuItems = [];
      this.starTexts = [];
      this.starCells = [];
      this.collectedStars = 0;
      this.chestOpened = false;

      this.bgGraphics = this.add.graphics().setDepth(0);
      this.mazeGraphics = this.add.graphics().setDepth(1);
      this.playerGraphics = this.add.graphics().setDepth(2);
      this.overlayGraphics = this.add.graphics().setDepth(3);
      this.goalChestGraphics = this.add.graphics().setDepth(1);
      this.starHudBg = this.add.rectangle(WIDTH / 2, 34, 132, 32, 0xffffff, 0.85).setStrokeStyle(2, 0xffb1c9, 0.8).setDepth(2);
      this.starHudText = this.add.text(WIDTH / 2, 34, '', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#a84e70',
        stroke: '#fff4e6',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(3);
      this.starHudBg.setVisible(false);
      this.starHudText.setVisible(false);

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
      const gap = Math.min(96, HEIGHT * 0.14);
      const startY = HEIGHT / 2 - ((DIFFICULTY_ORDER.length - 1) * gap) / 2;
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
      this.drawStars();
      this.drawGoalChest();
      this.updateStarHud();
      this.drawPlayer();
    }

    setupMaze() {
      const config = DIFFICULTIES[this.difficultyKey];
      this.theme = THEMES[(this.level - 1) % THEMES.length];
      const minSide = Math.min(WIDTH, HEIGHT);
      if (config.fullscreen) {
        this.cell = 35;
        this.cols = Math.floor(WIDTH / this.cell);
        this.rows = Math.floor(HEIGHT / this.cell);
        if (this.cols % 2 === 0) this.cols -= 1;
        if (this.rows % 2 === 0) this.rows -= 1;
      } else {
        this.cols = config.cols;
        this.rows = config.rows;
        this.cell = Math.floor((minSide - 56) / this.cols);
      }
      this.mazeWidth = this.cell * this.cols;
      this.mazeHeight = this.cell * this.rows;
      this.originX = (WIDTH - this.mazeWidth) / 2;
      this.originY = (HEIGHT - this.mazeHeight) / 2;
      this.playerSize = this.cell * 0.5;

      const cornerCols = [1, this.cols - 2];
      const cornerRows = [1, this.rows - 2];
      if (config.fullscreen) {
        const startCorner = 1 + Math.floor(Math.random() * 3);
        this.startCol = cornerCols[startCorner % 2];
        this.startRow = cornerRows[Math.floor(startCorner / 2)];
        this.goalCol = cornerCols[1 - (startCorner % 2)];
        this.goalRow = cornerRows[1 - Math.floor(startCorner / 2)];
      } else {
        this.startCol = cornerCols[0];
        this.startRow = cornerRows[0];
        this.goalCol = cornerCols[1];
        this.goalRow = cornerRows[1];
      }
      this.startX = this.cellCenterX(this.startCol);
      this.startY = this.cellCenterY(this.startRow);
      this.goalX = this.cellCenterX(this.goalCol);
      this.goalY = this.cellCenterY(this.goalRow);
      this.playerX = this.startX;
      this.playerY = this.startY;

      this.maze = config.fullscreen ? generatePrimMaze(this.cols, this.rows) : generateMaze(this.cols, this.rows, config.openRate);

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

      this.chestOpened = false;
      this.collectedStars = 0;
      const pathCells = [];
      for (let row = 1; row < this.rows - 1; row += 1) {
        for (let col = 1; col < this.cols - 1; col += 1) {
          if (this.maze[row][col] !== 0) continue;
          if (row === this.startRow && col === this.startCol) continue;
          if (row === this.goalRow && col === this.goalCol) continue;
          pathCells.push({ row: row, col: col });
        }
      }
      shuffleArray(pathCells);
      this.starCells = pathCells.slice(0, Math.min(3, pathCells.length)).map((cell) => {
        return {
          row: cell.row,
          col: cell.col,
          collected: false,
          x: this.cellCenterX(cell.col),
          y: this.cellCenterY(cell.row),
        };
      });
    }

    cellCenterX(col) { return this.originX + (col + 0.5) * this.cell; }
    cellCenterY(row) { return this.originY + (row + 0.5) * this.cell; }

    drawBackground() {
      const g = this.bgGraphics;
      g.clear();
      g.fillStyle(this.theme.bg, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(this.theme.accentA, 0.7).fillCircle(WIDTH * 0.08, HEIGHT * 0.1, Math.min(WIDTH, HEIGHT) * 0.24);
      g.fillStyle(this.theme.accentB, 0.8).fillCircle(WIDTH * 0.94, HEIGHT * 0.88, Math.min(WIDTH, HEIGHT) * 0.28);
      g.fillStyle(this.theme.accentC, 0.65).fillCircle(WIDTH * 0.9, HEIGHT * 0.08, Math.min(WIDTH, HEIGHT) * 0.2);
    }

    drawMaze() {
      const g = this.mazeGraphics;
      g.clear();
      g.fillStyle(this.theme.path, 1).fillRoundedRect(this.originX, this.originY, this.mazeWidth, this.mazeHeight, 22);

      for (let row = 0; row < this.rows; row += 1) {
        for (let col = 0; col < this.cols; col += 1) {
          if (this.maze[row][col] !== 1) continue;
          const x = this.originX + col * this.cell;
          const y = this.originY + row * this.cell;
          const warm = (row + col) % 2 === 0;
          const color = warm ? this.theme.wallA : this.theme.wallB;
          const line = warm ? this.theme.wallLineA : this.theme.wallLineB;
          const inner = warm ? this.theme.wallInnerA : this.theme.wallInnerB;
          g.fillStyle(color, 1).fillRect(x, y, this.cell, this.cell);
          g.fillStyle(inner, 0.9).fillRoundedRect(x + 4, y + 4, this.cell - 8, this.cell - 8, Math.max(6, this.cell * 0.18));
          g.lineStyle(2, line, 0.85).strokeRoundedRect(x + 4, y + 4, this.cell - 8, this.cell - 8, Math.max(6, this.cell * 0.18));
        }
      }

      const sx = this.cellCenterX(this.startCol);
      const sy = this.cellCenterY(this.startRow);
      g.fillStyle(this.theme.start, 0.75).fillCircle(sx, sy, this.cell * 0.22);
      g.lineStyle(2, this.theme.startLine, 0.8).strokeCircle(sx, sy, this.cell * 0.22);
    }

    drawStars() {
      if (this.starTexts) this.starTexts.forEach((item) => item.destroy());
      this.starTexts = [];
      this.starCells.forEach((star) => {
        if (star.collected) return;
        const text = this.add.text(star.x, star.y, '★', {
          fontFamily: 'Microsoft YaHei, sans-serif',
          fontSize: Math.round(this.cell * 0.55) + 'px',
          color: '#ffd84e',
          stroke: '#c78a12',
          strokeThickness: Math.max(3, Math.round(this.cell * 0.08)),
        }).setOrigin(0.5).setDepth(1);
        star.text = text;
        this.starTexts.push(text);
      });
    }

    drawGoalChest() {
      const g = this.goalChestGraphics;
      g.clear();
      const x = this.goalX;
      const y = this.goalY;
      const s = this.cell * 0.62;
      const half = s / 2;

      if (!this.chestOpened) {
        g.fillStyle(0x8a5428, 1).fillRoundedRect(x - half, y - s * 0.02, s, s * 0.62, Math.max(6, s * 0.12));
        g.fillStyle(0xb97a3d, 1).fillRoundedRect(x - half, y - s * 0.22, s, s * 0.34, Math.max(6, s * 0.12));
        g.fillStyle(0xffd84e, 1).fillRect(x - 2, y - s * 0.22, s * 0.12, s * 0.34);
        g.fillStyle(0xffe36b, 1).fillCircle(x, y + s * 0.10, s * 0.08);
      } else {
        g.fillStyle(0x8a5428, 1).fillRoundedRect(x - half, y - s * 0.02, s, s * 0.58, Math.max(6, s * 0.12));
        g.fillStyle(0xb97a3d, 1).fillRoundedRect(x - half, y - s * 0.48, s, s * 0.28, Math.max(6, s * 0.12));
        g.fillStyle(0xffe36b, 1).fillRoundedRect(x - s * 0.24, y - s * 0.42, s * 0.48, s * 0.18, 4);
      }
    }

    updateStarHud() {
      if (!this.starHudText || !this.starHudBg) return;
      this.starHudText.setText('★ ' + this.collectedStars + ' / ' + this.starCells.length);
      this.starHudBg.setVisible(true);
      this.starHudText.setVisible(true);
    }

    checkCollectibles() {
      if (!this.starCells) return;
      let changed = false;
      this.starCells.forEach((star) => {
        if (star.collected) return;
        const dx = this.playerX - star.x;
        const dy = this.playerY - star.y;
        if (Math.sqrt(dx * dx + dy * dy) >= this.cell * 0.42) return;
        star.collected = true;
        this.collectedStars += 1;
        changed = true;
        const spark = this.add.text(star.x, star.y, '★', {
          fontFamily: 'Microsoft YaHei, sans-serif',
          fontSize: Math.round(this.cell * 0.6) + 'px',
          color: '#ffd84e',
          stroke: '#c78a12',
          strokeThickness: 3,
        }).setOrigin(0.5).setDepth(2);
        this.tweens.add({
          targets: spark,
          y: star.y - this.cell * 0.45,
          alpha: 0,
          scale: 1.5,
          duration: 360,
          ease: 'Cubic.easeOut',
          onComplete: () => spark.destroy(),
        });
      });
      if (changed) {
        this.drawStars();
        this.updateStarHud();
      }
    }

    spawnWinBurst() {
      const colors = ['#ffd84e', '#4de5bf', '#ff8fb3', '#8fb8ff'];
      for (let i = 0; i < 12; i += 1) {
        const star = this.add.text(this.goalX, this.goalY, '★', {
          fontFamily: 'Microsoft YaHei, sans-serif',
          fontSize: Math.round(this.cell * 0.5) + 'px',
          color: colors[i % colors.length],
          stroke: '#2f1f3a',
          strokeThickness: 2,
        }).setOrigin(0.5).setDepth(3);
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
        const dist = this.cell * (0.8 + Math.random() * 0.8);
        this.tweens.add({
          targets: star,
          x: this.goalX + Math.cos(angle) * dist,
          y: this.goalY + Math.sin(angle) * dist,
          alpha: 0,
          scale: 0.5,
          duration: 550 + Math.random() * 250,
          ease: 'Cubic.easeOut',
          onComplete: () => star.destroy(),
        });
      }
    }

    drawPlayer() {
      const g = this.playerGraphics;
      g.clear();
      const half = this.playerSize / 2;
      const x = this.playerX;
      const y = this.playerY;
      const r = Math.max(6, this.playerSize * 0.26);

      g.fillStyle(0x4a2f18, 0.16).fillRoundedRect(x - half + 2, y - half + 4, this.playerSize, this.playerSize, r);
      g.fillStyle(this.theme.player, 1).fillRoundedRect(x - half, y - half, this.playerSize, this.playerSize, r);
      g.lineStyle(2, this.theme.playerLine, 0.95).strokeRoundedRect(x - half, y - half, this.playerSize, this.playerSize, r);

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
      this.checkCollectibles();
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
      if (left < this.originX || right > this.originX + this.mazeWidth || top < this.originY || bottom > this.originY + this.mazeHeight) return true;
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

      this.chestOpened = true;
      this.drawGoalChest();
      this.spawnWinBurst();
      this.time.delayedCall(550, () => this.showWinOverlay());
    }

    showWinOverlay() {
      const g = this.overlayGraphics;
      g.clear();
      g.fillStyle(0x2f1f3a, 0.3).fillRect(0, 0, WIDTH, HEIGHT);
      const panelW = Math.min(400, WIDTH - 40);
      const panelH = 250;
      g.fillStyle(0xffffff, 0.98).fillRoundedRect((WIDTH - panelW) / 2, (HEIGHT - panelH) / 2, panelW, panelH, 28);

      const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 70, '到达终点！', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ff8a48',
        stroke: '#fff4e6',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(4);

      const subtitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 16, '第 ' + this.level + ' 关通过！真棒！', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b5d82',
      }).setOrigin(0.5).setDepth(4);

      const difficultyText = this.add.text(WIDTH / 2, HEIGHT / 2 + 20, DIFFICULTIES[this.difficultyKey].label + ' 迷宫', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '16px',
        color: '#a48ab8',
      }).setOrigin(0.5).setDepth(4);

      const button = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 74, 220, 54, 0xff8a48, 1).setStrokeStyle(3, 0xffd8a8, 0.95).setInteractive({ useHandCursor: true }).setDepth(4);
      const buttonText = this.add.text(WIDTH / 2, HEIGHT / 2 + 74, '下一关', {
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
      this.drawBackground();
      this.drawMaze();
      this.drawStars();
      this.drawGoalChest();
      this.updateStarHud();
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
