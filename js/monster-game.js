(function () {
  'use strict';

  const WIDTH = 960;
  const HEIGHT = 540;
  const COLS = 15;
  const ROWS = 11;
  const TILE = 48;
  const MAP_W = COLS * TILE;
  const MAP_H = ROWS * TILE;
  const ORIGIN_X = (WIDTH - MAP_W) / 2;
  const ORIGIN_Y = (HEIGHT - MAP_H) / 2;

  const PLAYER_BASE_SPEED = 130;
  const MONSTER_SPEED = 70;
  const PLAYER_RADIUS = 12;
  const MONSTER_RADIUS = 13;
  const BOMB_FUSE = 2400;
  const EXPLOSION_DURATION = 520;
  const ITEM_DROP_RATE = 0.4;
  const MAX_BOMBS = 3;
  const MAX_RADIUS = 3;
  const MAX_SPEED_STACKS = 3;

  const ITEM_COLORS = { speed: 0x4de5bf, bomb: 0xff8a48, range: 0x8fb8ff };

  const SoundFX = (function () {
    let ctx = null;

    function getCtx() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!ctx) ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, endFreq, duration, type, volume, delay) {
      const audio = getCtx();
      if (!audio) return;
      const startAt = audio.currentTime + (delay || 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(1, freq), startAt);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), startAt + duration);
      }
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume || 0.2, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.04);
    }

    return {
      place: function () {
        tone(300, 220, 0.1, 'square', 0.1, 0);
      },
      explosion: function () {
        tone(180, 55, 0.28, 'sawtooth', 0.16, 0);
        tone(90, 45, 0.32, 'sine', 0.18, 0.03);
      },
      item: function () {
        tone(523.25, 523.25, 0.09, 'sine', 0.15, 0);
        tone(783.99, 783.99, 0.12, 'sine', 0.15, 0.07);
      },
      win: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, index) {
          tone(freq, freq, 0.14, 'triangle', 0.16, index * 0.1);
        });
      },
      lose: function () {
        tone(320, 180, 0.24, 'sine', 0.13, 0);
        tone(180, 120, 0.28, 'sine', 0.11, 0.12);
      },
    };
  })();

  function cellKey(row, col) { return row + ',' + col; }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

  class MonsterGameScene extends Phaser.Scene {
    constructor() {
      super('MonsterGameScene');
    }

    create() {
      this.state = 'playing';
      this.overlayItems = [];
      this.explosions = [];
      this.explosionKeys = new Set();
      this.bombs = [];
      this.items = [];
      this.monsters = [];
      this.speedStacks = 0;
      this.bombMax = 1;
      this.blastRadius = 1;

      this.floorGraphics = this.add.graphics().setDepth(0);
      this.mapGraphics = this.add.graphics().setDepth(1);
      this.entityGraphics = this.add.graphics().setDepth(2);
      this.overlayGraphics = this.add.graphics().setDepth(10);

      this.hudText = this.add.text(16, 10, '', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fff4e6',
        stroke: '#6b4b3e',
        strokeThickness: 3,
      }).setOrigin(0, 0).setDepth(20);

      this.inputState = { up: false, down: false, left: false, right: false };
      this.lastAxis = 'y';
      this.setupKeyboard();
      this.setupTouchControls();
      this.resetGame();
    }

    resetGame() {
      this.state = 'playing';
      this.grid = this.buildGrid();
      this.bombs = [];
      this.explosions = [];
      this.explosionKeys = new Set();
      this.items = [];
      this.monsters = [];
      this.speedStacks = 0;
      this.bombMax = 1;
      this.blastRadius = 1;

      this.player = {
        row: ROWS - 2,
        col: 1,
        x: this.cellCenterX(1),
        y: this.cellCenterY(ROWS - 2),
      };

      this.monsters.push(this.makeMonster(ROWS - 2, COLS - 2));
      this.monsters.push(this.makeMonster(1, COLS - 2));
      this.monsters.forEach((monster) => this.chooseMonsterDirection(monster));

      this.drawFloor();
      this.drawMap();
      this.drawEntities();
      this.updateHud();
      this.clearOverlay();
    }

    makeMonster(row, col) {
      return {
        row: row,
        col: col,
        x: this.cellCenterX(col),
        y: this.cellCenterY(row),
        targetRow: row,
        targetCol: col,
        dirX: 0,
        dirY: 0,
        alive: true,
      };
    }

    buildGrid() {
      const grid = [];
      for (let row = 0; row < ROWS; row += 1) {
        grid[row] = [];
        for (let col = 0; col < COLS; col += 1) {
          if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) {
            grid[row][col] = 1;
          } else if (row % 2 === 0 && col % 2 === 0) {
            grid[row][col] = 1;
          } else if (row % 2 === 1 && col % 2 === 1 && !this.isSpawnCell(row, col)) {
            grid[row][col] = 2;
          } else {
            grid[row][col] = 0;
          }
        }
      }
      return grid;
    }

    isSpawnCell(row, col) {
      return (row === 1 && col === 1) ||
        (row === 1 && col === COLS - 2) ||
        (row === ROWS - 2 && col === 1) ||
        (row === ROWS - 2 && col === COLS - 2);
    }

    cellCenterX(col) { return ORIGIN_X + (col + 0.5) * TILE; }
    cellCenterY(row) { return ORIGIN_Y + (row + 0.5) * TILE; }

    setupKeyboard() {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyState = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        bomb: Phaser.Input.Keyboard.KeyCodes.SPACE,
      });
    }

    setupTouchControls() {
      const cx = 90;
      const cy = 400;
      const gap = 42;
      this.addDpadButton(cx, cy - gap, '\u25b2', 'up', 'y');
      this.addDpadButton(cx, cy + gap, '\u25bc', 'down', 'y');
      this.addDpadButton(cx - gap, cy, '\u25c0', 'left', 'x');
      this.addDpadButton(cx + gap, cy, '\u25b6', 'right', 'x');

      const bombButton = this.add.circle(WIDTH - 90, cy, 46, 0xffffff, 0.1);
      bombButton.setStrokeStyle(2, 0xffffff, 0.55);
      bombButton.setInteractive({ useHandCursor: true }).setDepth(20);
      this.add.text(WIDTH - 90, cy, '\u25cf', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#6b4b3e',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(21);
      bombButton.on('pointerdown', () => this.placeBomb());
    }

    addDpadButton(x, y, label, key, axis) {
      const button = this.add.circle(x, y, 24, 0xffffff, 0.1);
      button.setStrokeStyle(2, 0xffffff, 0.5);
      button.setInteractive({ useHandCursor: true }).setDepth(20);
      this.add.text(x, y, label, {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#6b4b3e',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(21);
      button.on('pointerdown', () => {
        this.inputState[key] = true;
        this.lastAxis = axis;
      });
      button.on('pointerup', () => { this.inputState[key] = false; });
      button.on('pointerout', () => { this.inputState[key] = false; });
      button.on('pointerupoutside', () => { this.inputState[key] = false; });
    }

    handleKeyboard() {
      const c = this.cursors;
      const k = this.keyState;
      const up = c.up.isDown || k.up.isDown;
      const down = c.down.isDown || k.down.isDown;
      const left = c.left.isDown || k.left.isDown;
      const right = c.right.isDown || k.right.isDown;
      this.inputState.up = up;
      this.inputState.down = down;
      this.inputState.left = left;
      this.inputState.right = right;

      if (Phaser.Input.Keyboard.JustDown(c.up) || Phaser.Input.Keyboard.JustDown(k.up)) this.lastAxis = 'y';
      if (Phaser.Input.Keyboard.JustDown(c.down) || Phaser.Input.Keyboard.JustDown(k.down)) this.lastAxis = 'y';
      if (Phaser.Input.Keyboard.JustDown(c.left) || Phaser.Input.Keyboard.JustDown(k.left)) this.lastAxis = 'x';
      if (Phaser.Input.Keyboard.JustDown(c.right) || Phaser.Input.Keyboard.JustDown(k.right)) this.lastAxis = 'x';
      if (Phaser.Input.Keyboard.JustDown(k.bomb)) this.placeBomb();
    }

    getMoveVector() {
      const x = (this.inputState.left ? -1 : 0) + (this.inputState.right ? 1 : 0);
      const y = (this.inputState.up ? -1 : 0) + (this.inputState.down ? 1 : 0);
      if (x && y) {
        return this.lastAxis === 'x' ? { x: x, y: 0 } : { x: 0, y: y };
      }
      return { x: x, y: y };
    }

    playerSpeed() { return PLAYER_BASE_SPEED * (1 + this.speedStacks * 0.2); }

    update(time, delta) {
      if (this.state !== 'playing') return;
      const dt = Math.min(delta, 50) / 1000;
      this.handleKeyboard();
      this.updatePlayer(dt);
      this.updateMonsters(dt);
      this.updateBombs(dt);
      this.updateExplosions(dt);
      this.win();
      this.checkPlayerHazards();
      this.drawEntities();
    }

    updatePlayer(dt) {
      const move = this.getMoveVector();
      if (move.x || move.y) {
        const speed = this.playerSpeed();
        this.tryMovePlayer(move.x * speed * dt, move.y * speed * dt);
      }
      this.pickupItems();
    }

    tryMovePlayer(dx, dy) {
      const currentRow = this.playerCellRow();
      const currentCol = this.playerCellCol();
      if (dx) {
        const nextX = this.player.x + dx;
        if (!this.entityCollides(nextX, this.player.y, PLAYER_RADIUS, currentRow, currentCol)) this.player.x = nextX;
      }
      if (dy) {
        const nextY = this.player.y + dy;
        if (!this.entityCollides(this.player.x, nextY, PLAYER_RADIUS, currentRow, currentCol)) this.player.y = nextY;
      }
    }

    entityCollides(x, y, radius, ignoreBombRow, ignoreBombCol) {
      const left = x - radius;
      const right = x + radius;
      const top = y - radius;
      const bottom = y + radius;
      if (left < ORIGIN_X || right > ORIGIN_X + MAP_W || top < ORIGIN_Y || bottom > ORIGIN_Y + MAP_H) return true;

      const minCol = Math.max(0, Math.floor((left - ORIGIN_X) / TILE));
      const maxCol = Math.min(COLS - 1, Math.floor((right - ORIGIN_X) / TILE));
      const minRow = Math.max(0, Math.floor((top - ORIGIN_Y) / TILE));
      const maxRow = Math.min(ROWS - 1, Math.floor((bottom - ORIGIN_Y) / TILE));
      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          if (this.grid[row][col] !== 0) return true;
        }
      }

      for (let i = 0; i < this.bombs.length; i += 1) {
        const bomb = this.bombs[i];
        if (bomb.row === ignoreBombRow && bomb.col === ignoreBombCol) continue;
        const bx = this.cellCenterX(bomb.col);
        const by = this.cellCenterY(bomb.row);
        if (right > bx - TILE / 2 && left < bx + TILE / 2 && bottom > by - TILE / 2 && top < by + TILE / 2) return true;
      }
      return false;
    }

    isWalkableTile(row, col) {
      return row >= 0 && row < ROWS && col >= 0 && col < COLS && this.grid[row][col] === 0;
    }

    bombAt(row, col) {
      return this.bombs.some((bomb) => bomb.row === row && bomb.col === col);
    }

    pickupItems() {
      for (let i = this.items.length - 1; i >= 0; i -= 1) {
        const item = this.items[i];
        const dx = this.player.x - item.x;
        const dy = this.player.y - item.y;
        const reach = TILE * 0.42;
        if (dx * dx + dy * dy < reach * reach) {
          this.applyItem(item.type);
          this.items.splice(i, 1);
        }
      }
    }

    applyItem(type) {
      if (type === 'speed' && this.speedStacks < MAX_SPEED_STACKS) this.speedStacks += 1;
      if (type === 'bomb' && this.bombMax < MAX_BOMBS) this.bombMax += 1;
      if (type === 'range' && this.blastRadius < MAX_RADIUS) this.blastRadius += 1;
      SoundFX.item();
      this.updateHud();
    }

    dropItem(row, col) {
      if (Math.random() > ITEM_DROP_RATE) return;
      const type = this.weightedItemType();
      if (!type) return;
      this.items.push({
        row: row,
        col: col,
        x: this.cellCenterX(col),
        y: this.cellCenterY(row),
        type: type,
      });
    }

    weightedItemType() {
      const available = [];
      if (this.speedStacks < MAX_SPEED_STACKS) available.push({ type: 'speed', weight: 40 });
      if (this.bombMax < MAX_BOMBS) available.push({ type: 'bomb', weight: 30 });
      if (this.blastRadius < MAX_RADIUS) available.push({ type: 'range', weight: 30 });
      if (!available.length) return null;
      let total = 0;
      available.forEach((item) => { total += item.weight; });
      let roll = Math.random() * total;
      for (let i = 0; i < available.length; i += 1) {
        roll -= available[i].weight;
        if (roll <= 0) return available[i].type;
      }
      return available[available.length - 1].type;
    }

    updateMonsters(dt) {
      this.monsters.forEach((monster) => {
        if (!monster.alive) return;
        if (!monster.dirX && !monster.dirY) this.chooseMonsterDirection(monster);
        const targetX = this.cellCenterX(monster.targetCol);
        const targetY = this.cellCenterY(monster.targetRow);
        const dx = targetX - monster.x;
        const dy = targetY - monster.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = MONSTER_SPEED * dt;
        if (dist < 2) {
          monster.x = targetX;
          monster.y = targetY;
          monster.row = monster.targetRow;
          monster.col = monster.targetCol;
          this.chooseMonsterDirection(monster);
          return;
        }

        const stepX = dx ? Math.sign(dx) * Math.min(step, Math.abs(dx)) : 0;
        const stepY = dy ? Math.sign(dy) * Math.min(step, Math.abs(dy)) : 0;
        if (stepX && !this.entityCollides(monster.x + stepX, monster.y, MONSTER_RADIUS)) {
          monster.x += stepX;
        } else if (stepX) {
          monster.x = this.cellCenterX(monster.col);
          this.chooseMonsterDirection(monster);
        }
        if (stepY && !this.entityCollides(monster.x, monster.y + stepY, MONSTER_RADIUS)) {
          monster.y += stepY;
        } else if (stepY) {
          monster.y = this.cellCenterY(monster.row);
          this.chooseMonsterDirection(monster);
        }
      });
    }

    chooseMonsterDirection(monster) {
      const dirs = shuffleArray([[-1, 0], [1, 0], [0, -1], [0, 1]]);
      for (let i = 0; i < dirs.length; i += 1) {
        const row = monster.row + dirs[i][0];
        const col = monster.col + dirs[i][1];
        if (this.isWalkableTile(row, col) && !this.bombAt(row, col)) {
          monster.dirX = dirs[i][0];
          monster.dirY = dirs[i][1];
          monster.targetRow = row;
          monster.targetCol = col;
          return;
        }
      }
      monster.dirX = 0;
      monster.dirY = 0;
      monster.targetRow = monster.row;
      monster.targetCol = monster.col;
    }

    placeBomb() {
      if (this.state !== 'playing') return;
      const row = this.playerCellRow();
      const col = this.playerCellCol();
      if (!this.isWalkableTile(row, col)) return;
      if (this.bombs.length >= this.bombMax) return;
      if (this.bombAt(row, col)) return;
      this.bombs.push({
        row: row,
        col: col,
        x: this.cellCenterX(col),
        y: this.cellCenterY(row),
        timer: BOMB_FUSE,
        detonated: false,
      });
      SoundFX.place();
    }

    updateBombs(dt) {
      const expired = [];
      this.bombs.forEach((bomb) => {
        bomb.timer -= dt * 1000;
        if (bomb.timer <= 0 && !bomb.detonated) expired.push(bomb);
      });
      expired.forEach((bomb) => this.detonateBomb(bomb));
    }

    detonateBomb(bomb) {
      if (bomb.detonated) return;
      bomb.detonated = true;
      this.bombs = this.bombs.filter((item) => item !== bomb);
      const cells = this.computeBlastCells(bomb.row, bomb.col, this.blastRadius);
      cells.forEach((cell) => this.applyBlastCell(cell));
      SoundFX.explosion();
    }

    computeBlastCells(row, col, radius) {
      const cells = [{ row: row, col: col }];
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      dirs.forEach((dir) => {
        for (let i = 1; i <= radius; i += 1) {
          const nextRow = row + dir[0] * i;
          const nextCol = col + dir[1] * i;
          if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) break;
          cells.push({ row: nextRow, col: nextCol });
          if (this.grid[nextRow][nextCol] === 1) break;
          if (this.grid[nextRow][nextCol] === 2) break;
        }
      });
      return cells;
    }

    applyBlastCell(cell) {
      if (cell.row < 0 || cell.row >= ROWS || cell.col < 0 || cell.col >= COLS) return;
      this.addExplosion(cell.row, cell.col);

      if (this.grid[cell.row][cell.col] === 2) {
        this.grid[cell.row][cell.col] = 0;
        this.dropItem(cell.row, cell.col);
        this.drawMap();
      }

      const monster = this.monsters.find((item) => item.alive && item.row === cell.row && item.col === cell.col);
      if (monster) monster.alive = false;

      const chainBomb = this.bombs.find((item) => !item.detonated && item.row === cell.row && item.col === cell.col);
      if (chainBomb) this.detonateBomb(chainBomb);
    }

    addExplosion(row, col) {
      const key = cellKey(row, col);
      if (this.explosionKeys.has(key)) return;
      this.explosionKeys.add(key);
      this.explosions.push({ row: row, col: col, timer: EXPLOSION_DURATION });
    }

    updateExplosions(dt) {
      for (let i = this.explosions.length - 1; i >= 0; i -= 1) {
        const explosion = this.explosions[i];
        explosion.timer -= dt * 1000;
        if (explosion.timer <= 0) {
          this.explosionKeys.delete(cellKey(explosion.row, explosion.col));
          this.explosions.splice(i, 1);
        }
      }
    }

    playerCellRow() {
      return Math.max(0, Math.min(ROWS - 1, Math.round((this.player.y - ORIGIN_Y) / TILE - 0.5)));
    }

    playerCellCol() {
      return Math.max(0, Math.min(COLS - 1, Math.round((this.player.x - ORIGIN_X) / TILE - 0.5)));
    }

    checkPlayerHazards() {
      if (this.state !== 'playing') return;
      const playerRow = this.playerCellRow();
      const playerCol = this.playerCellCol();
      const hitByExplosion = this.explosions.some((explosion) => explosion.row === playerRow && explosion.col === playerCol);
      if (hitByExplosion) {
        this.lose();
        return;
      }

      const touchRadius = PLAYER_RADIUS + MONSTER_RADIUS;
      const hitByMonster = this.monsters.some((monster) => {
        if (!monster.alive) return false;
        const dx = this.player.x - monster.x;
        const dy = this.player.y - monster.y;
        return dx * dx + dy * dy < touchRadius * touchRadius;
      });
      if (hitByMonster) this.lose();
    }

    lose() {
      if (this.state !== 'playing') return;
      this.state = 'lost';
      SoundFX.lose();
      this.showOverlay('\u88ab\u5c0f\u602a\u517d\u6293\u4f4f\u5566', '\u518d\u8bd5\u4e00\u6b21\u5427\uff01');
    }

    win() {
      if (this.state !== 'playing') return;
      const alive = this.monsters.some((monster) => monster.alive);
      if (alive) return;
      this.state = 'won';
      SoundFX.win();
      this.showOverlay('\u8fc7\u5173\u5566\uff01', '\u4e24\u53ea\u5c0f\u602a\u517d\u90fd\u88ab\u70b8\u98de\u5566\uff01');
    }

    showOverlay(title, subtitle) {
      this.clearOverlay();
      const g = this.overlayGraphics;
      g.clear();
      g.fillStyle(0x160e2a, 0.55).fillRect(0, 0, WIDTH, HEIGHT);
      const panelW = Math.min(430, WIDTH - 80);
      const panelH = 240;
      g.fillStyle(0xffffff, 0.98).fillRoundedRect((WIDTH - panelW) / 2, (HEIGHT - panelH) / 2, panelW, panelH, 26);

      const titleText = this.add.text(WIDTH / 2, HEIGHT / 2 - 58, title, {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ff8a48',
        stroke: '#fff4e6',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(11);

      const subtitleText = this.add.text(WIDTH / 2, HEIGHT / 2 - 8, subtitle, {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '19px',
        color: '#6b5d82',
      }).setOrigin(0.5).setDepth(11);

      const button = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 68, 220, 54, 0xff8a48, 1).setStrokeStyle(3, 0xffd8a8, 0.95).setInteractive({ useHandCursor: true }).setDepth(11);
      const buttonText = this.add.text(WIDTH / 2, HEIGHT / 2 + 68, '\u91cd\u65b0\u5f00\u59cb', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#b85c2a',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(12);

      button.on('pointerdown', () => this.resetGame());
      this.overlayItems.push(titleText, subtitleText, button, buttonText);
    }

    clearOverlay() {
      if (this.overlayGraphics) this.overlayGraphics.clear();
      this.overlayItems.forEach((item) => item.destroy());
      this.overlayItems = [];
    }

    updateHud() {
      if (!this.hudText) return;
      const speed = (1 + this.speedStacks * 0.2).toFixed(1);
      this.hudText.setText('\u70b8\u5f39 ' + this.bombMax + '  |  \u8303\u56f4 ' + this.blastRadius + '  |  \u901f\u5ea6 ' + speed);
    }

    drawFloor() {
      const g = this.floorGraphics;
      g.clear();
      g.fillStyle(0x2a1f3f, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0x3b2c5b, 1).fillRect(ORIGIN_X, ORIGIN_Y, MAP_W, MAP_H);
      g.lineStyle(1, 0x5b4a8a, 0.16);
      for (let row = 0; row <= ROWS; row += 1) {
        g.lineBetween(ORIGIN_X, ORIGIN_Y + row * TILE, ORIGIN_X + MAP_W, ORIGIN_Y + row * TILE);
      }
      for (let col = 0; col <= COLS; col += 1) {
        g.lineBetween(ORIGIN_X + col * TILE, ORIGIN_Y, ORIGIN_X + col * TILE, ORIGIN_Y + MAP_H);
      }
    }

    drawMap() {
      const g = this.mapGraphics;
      g.clear();
      for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
          const value = this.grid[row][col];
          if (value === 0) continue;
          const x = ORIGIN_X + col * TILE;
          const y = ORIGIN_Y + row * TILE;
          if (value === 1) {
            g.fillStyle(0x8f7bff, 1).fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 8);
            g.fillStyle(0xb9a6ff, 0.9).fillRoundedRect(x + 7, y + 7, TILE - 14, TILE - 14, 5);
          } else {
            g.fillStyle(0xd98a4a, 1).fillRoundedRect(x + 3, y + 3, TILE - 6, TILE - 6, 7);
            g.fillStyle(0xffb066, 1).fillRoundedRect(x + 7, y + 7, TILE - 14, TILE - 14, 5);
            g.lineStyle(2, 0xffd9a8, 0.8).strokeRoundedRect(x + 7, y + 7, TILE - 14, TILE - 14, 5);
          }
        }
      }
    }

    drawEntities() {
      const g = this.entityGraphics;
      g.clear();
      this.bombs.forEach((bomb) => this.drawBomb(g, bomb));
      this.items.forEach((item) => this.drawItem(g, item));
      this.monsters.forEach((monster) => { if (monster.alive) this.drawMonster(g, monster); });
      this.explosions.forEach((explosion) => this.drawExplosion(g, explosion));
      if (this.state !== 'lost') this.drawPlayer(g);
    }

    drawPlayer(g) {
      const x = this.player.x;
      const y = this.player.y;
      const s = TILE * 0.62;
      const half = s / 2;
      g.fillStyle(0x000000, 0.16).fillRoundedRect(x - half + 2, y - half + 4, s, s, 9);
      g.fillStyle(0xffd84e, 1).fillRoundedRect(x - half, y - half, s, s, 9);
      g.lineStyle(2, 0xc78a12, 0.95).strokeRoundedRect(x - half, y - half, s, s, 9);
      g.fillStyle(0x3a2b12, 1).fillCircle(x - s * 0.16, y - s * 0.08, s * 0.075);
      g.fillStyle(0x3a2b12, 1).fillCircle(x + s * 0.16, y - s * 0.08, s * 0.075);
      g.lineStyle(2, 0x3a2b12, 1).lineBetween(x - s * 0.12, y + s * 0.14, x + s * 0.12, y + s * 0.14);
    }

    drawMonster(g, monster) {
      const x = monster.x;
      const y = monster.y;
      const s = TILE * 0.66;
      const bodyR = s * 0.36;
      g.fillStyle(0x000000, 0.16).fillCircle(x + 2, y + 3, bodyR);
      g.fillStyle(0x8f4fd8, 1).fillCircle(x, y, bodyR);
      g.fillStyle(0x5b36a8, 1).fillTriangle(x - s * 0.20, y - s * 0.18, x - s * 0.10, y - s * 0.44, x + 0, y - s * 0.20);
      g.fillStyle(0x5b36a8, 1).fillTriangle(x + 0, y - s * 0.20, x + s * 0.10, y - s * 0.44, x + s * 0.20, y - s * 0.18);
      g.fillStyle(0xffffff, 1).fillCircle(x - s * 0.12, y - s * 0.06, s * 0.075);
      g.fillStyle(0xffffff, 1).fillCircle(x + s * 0.12, y - s * 0.06, s * 0.075);
      g.fillStyle(0x2b1d4f, 1).fillCircle(x - s * 0.12, y - s * 0.06, s * 0.035);
      g.fillStyle(0x2b1d4f, 1).fillCircle(x + s * 0.12, y - s * 0.06, s * 0.035);
      g.lineStyle(2, 0x2b1d4f, 1).lineBetween(x - s * 0.10, y + s * 0.14, x + s * 0.10, y + s * 0.14);
    }

    drawBomb(g, bomb) {
      const x = bomb.x;
      const y = bomb.y;
      const r = TILE * 0.28;
      g.fillStyle(0x000000, 0.2).fillCircle(x + 2, y + 3, r);
      g.fillStyle(0x2b2b2b, 1).fillCircle(x, y, r);
      g.fillStyle(0x666666, 0.9).fillCircle(x - r * 0.28, y - r * 0.24, r * 0.16);
      g.lineStyle(2, 0x8a5a2b, 1).lineBetween(x, y - r * 0.7, x, y - r * 1.15);
      g.fillStyle(0xffd84e, 1).fillCircle(x, y - r * 1.25, r * 0.2);
    }

    drawExplosion(g, explosion) {
      const t = 1 - explosion.timer / EXPLOSION_DURATION;
      const x = this.cellCenterX(explosion.col);
      const y = this.cellCenterY(explosion.row);
      const r = TILE * 0.16 + t * TILE * 0.38;
      g.fillStyle(0xff6b35, 0.9).fillCircle(x, y, r);
      g.fillStyle(0xffd84e, 0.95).fillCircle(x, y, r * 0.68);
      g.fillStyle(0xffffff, 0.9).fillCircle(x, y, r * 0.34);
    }

    drawItem(g, item) {
      const x = item.x;
      const y = item.y;
      const r = TILE * 0.30;
      g.fillStyle(0x000000, 0.18).fillCircle(x + 2, y + 3, r);
      g.fillStyle(ITEM_COLORS[item.type], 1).fillCircle(x, y, r);
      g.lineStyle(2, 0xffffff, 0.9).strokeCircle(x, y, r);
      if (item.type === 'bomb') {
        g.fillStyle(0x2b2b2b, 1).fillCircle(x, y, r * 0.34);
      } else if (item.type === 'speed') {
        g.fillStyle(0xffffff, 1).fillTriangle(x - r * 0.22, y - r * 0.55, x + r * 0.08, y - r * 0.18, x - r * 0.08, y - r * 0.18);
        g.fillStyle(0xffffff, 1).fillTriangle(x - r * 0.05, y + r * 0.18, x + r * 0.08, y + r * 0.55, x + r * 0.30, y + r * 0.10);
      } else {
        g.lineStyle(3, 0xffffff, 1).lineBetween(x - r * 0.55, y, x + r * 0.55, y);
        g.lineStyle(3, 0xffffff, 1).lineBetween(x, y - r * 0.55, x, y + r * 0.55);
      }
    }
  }

  window.MonsterGameScene = MonsterGameScene;
})();
