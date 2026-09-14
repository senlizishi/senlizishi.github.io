(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;

  const BOARD_COLS = 32;
  const BOARD_ROWS = 32;
  const BOARD_GAP = 1;
  const BOARD_CELL = IS_PORTRAIT ? 14 : 10;
  const SLOT_COUNT = 5;
  const COL_COUNT = 5;
  const ROW_COUNT = 3;
  const TILE_SIZE = IS_PORTRAIT ? 64 : 56;
  const TILE_GAP = IS_PORTRAIT ? 12 : 10;
  const ROW_GAP = IS_PORTRAIT ? 10 : 8;
  const DISPATCH_INTERVAL = 260;
  const WORKER_SPEED = 240;
  const MAX_NUM = 5;
  const COLOR_COUNT = 10;

  const PALETTE = [
    { base: 0x58a5df, dark: 0x3578a8, light: 0xa7d3f2 },
    { base: 0x82b8db, dark: 0x4f87ad, light: 0xc2e0f2 },
    { base: 0x5a90b9, dark: 0x37627f, light: 0xa7c8df },
    { base: 0xad9c6f, dark: 0x776841, light: 0xd4c9a8 },
    { base: 0xe3b168, dark: 0xa97734, light: 0xf2d4a5 },
    { base: 0x669347, dark: 0x42622c, light: 0xa9c98f },
    { base: 0xb5c934, dark: 0x77871c, light: 0xd7e582 },
    { base: 0x4d3930, dark: 0x2c201a, light: 0x8c766b },
    { base: 0xe37724, dark: 0xa24d12, light: 0xf2b16f },
    { base: 0xf9f6ed, dark: 0xb9b09e, light: 0xffffff },
  ];
  window.AntsPalette = PALETTE.map((palette) => palette.base);

  const DEFAULT_PATTERN = (function () {
    const raw = [
      '99999999999999999999999999',
      '91199999111111111111911119',
      '10199999900000000019991009',
      '10000000220000000211999009',
      '10000002570000002520000009',
      '10000002352577752350000009',
      '10000002737844888752000009',
      '10000057775444888877500009',
      '10000258878888888888500009',
      '10011027788773587347200009',
      '10199100788839883447200009',
      '10111100788844887777720009',
      '10000000788888854444432009',
      '10000002777888743743332009',
      '10000118877788343544332009',
      '10001948888858444444450009',
      '12223448888844944444322229',
      '35555344444444999935555559',
      '46655359994444999993555559',
      '46663337739999999999356559',
      '15539445773999449999355559',
      '35533334333999333399355559',
      '35573339999999335399946659',
      '35555449399999335553394469',
      '15555339399999933555355559',
      '93333339199999999333943339',
      '99999434999999999999999999',
      '99449333499999999999999999',
      '99433333339999999999999993',
      '99333333339999999999999994',
    ];
    const padRow = '9'.repeat(BOARD_COLS);
    const topPad = Math.floor((BOARD_ROWS - raw.length) / 2);
    const bottomPad = BOARD_ROWS - raw.length - topPad;
    const cells = [];
    for (let i = 0; i < topPad; i += 1) cells.push(padRow.split('').map(Number));
    for (const row of raw) {
      const sidePad = Math.floor((BOARD_COLS - row.length) / 2);
      const padded = '9'.repeat(sidePad) + row + '9'.repeat(BOARD_COLS - row.length - sidePad);
      cells.push(padded.split('').map(Number));
    }
    for (let i = 0; i < bottomPad; i += 1) cells.push(padRow.split('').map(Number));
    return cells;
  }());

  function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
  function choose(landscape, portrait) { return IS_PORTRAIT ? portrait : landscape; }
  const AntsAudio = {
    context: null,
    master: null,
    sfxGain: null,
    sfxMuted: false,
    sfxVolume: 0.55,

    start() {
      try {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return false;
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.sfxGain = this.context.createGain();
          this.master.gain.value = 0.9;
          this.sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxVolume;
          this.sfxGain.connect(this.master);
          this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume();
        return true;
      } catch (_) {
        return false;
      }
    },

    toggleMute() {
      this.start();
      this.sfxMuted = !this.sfxMuted;
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.context.currentTime, 0.03);
      return !this.sfxMuted;
    },

    tone(frequency, duration, wave, gain, when) {
      if (!this.context || !this.sfxGain || this.sfxMuted) return;
      const now = when || this.context.currentTime;
      const osc = this.context.createOscillator();
      const amp = this.context.createGain();
      osc.type = wave || 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp); amp.connect(this.sfxGain);
      osc.start(now); osc.stop(now + duration + 0.03);
    },

    select() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      this.tone(660, 0.09, 'sine', 0.16, this.context.currentTime);
      this.tone(880, 0.07, 'triangle', 0.08, this.context.currentTime + 0.03);
    },

    dispatch() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      this.tone(340, 0.06, 'square', 0.055, this.context.currentTime);
    },

    remove() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      this.tone(520, 0.08, 'triangle', 0.11, this.context.currentTime);
      this.tone(760, 0.06, 'sine', 0.06, this.context.currentTime + 0.02);
    },

    warning() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      this.tone(150, 0.11, 'square', 0.07, this.context.currentTime);
    },

    win() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      const when = this.context.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => this.tone(freq, 0.32, 'triangle', 0.12, when + index * 0.09));
    },

    lose() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      const when = this.context.currentTime;
      [330, 262, 196].forEach((freq, index) => this.tone(freq, 0.3, 'sine', 0.1, when + index * 0.11));
    },
  };
  window.AntsAudio = AntsAudio;

  const boardWidth = BOARD_COLS * BOARD_CELL + (BOARD_COLS - 1) * BOARD_GAP;
  const boardHeight = BOARD_ROWS * BOARD_CELL + (BOARD_ROWS - 1) * BOARD_GAP;
  const slotsWidth = SLOT_COUNT * TILE_SIZE + (SLOT_COUNT - 1) * TILE_GAP;
  const queueHeight = ROW_COUNT * TILE_SIZE + (ROW_COUNT - 1) * ROW_GAP;

  const L = IS_PORTRAIT
    ? {
        boardX: (WIDTH - boardWidth) / 2,
        boardY: 84,
        slotsX: (WIDTH - slotsWidth) / 2,
        slotsY: 84 + boardHeight + 34,
        queueX: (WIDTH - slotsWidth) / 2,
        queueY: 84 + boardHeight + 34 + TILE_SIZE + 26,
      }
    : (function () {
        const boardX = 42;
        const boardY = (HEIGHT - boardHeight) / 2;
        const controlsLeft = boardX + boardWidth + 34;
        const controlsWidth = WIDTH - controlsLeft - 26;
        const slotsX = controlsLeft + (controlsWidth - slotsWidth) / 2;
        const slotsY = 140;
        return {
          boardX: boardX,
          boardY: boardY,
          slotsX: slotsX,
          slotsY: slotsY,
          queueX: slotsX,
          queueY: slotsY + TILE_SIZE + 20,
        };
      })();

  function isExposedInGrid(grid, x, y) {
    if (x === 0 || x === BOARD_COLS - 1 || y === 0 || y === BOARD_ROWS - 1) return true;
    return grid[y][x - 1] === null || grid[y][x + 1] === null || grid[y - 1][x] === null || grid[y + 1][x] === null;
  }

  function buildRemovalOrder(board) {
    const grid = board.map((row) => row.map((cell) => (cell ? cell.color : null)));
    const order = [];
    let remaining = 0;
    for (let y = 0; y < BOARD_ROWS; y += 1) for (let x = 0; x < BOARD_COLS; x += 1) if (grid[y][x] !== null) remaining += 1;
    while (remaining > 0) {
      const exposed = [];
      for (let y = 0; y < BOARD_ROWS; y += 1) {
        for (let x = 0; x < BOARD_COLS; x += 1) {
          if (grid[y][x] !== null && isExposedInGrid(grid, x, y)) exposed.push({ x: x, y: y });
        }
      }
      if (!exposed.length) break;
      const target = exposed[randomInt(0, exposed.length - 1)];
      order.push(grid[target.y][target.x]);
      grid[target.y][target.x] = null;
      remaining -= 1;
    }
    return order;
  }

  function buildCards(order) {
    const cards = [];
    let index = 0;
    while (index < order.length) {
      const color = order[index];
      let count = 0;
      while (index < order.length && order[index] === color && count < MAX_NUM) {
        count += 1;
        index += 1;
      }
      cards.push({ color: color, count: count });
    }
    return cards;
  }

  class AntsGameScene extends Phaser.Scene {
    constructor() { super('AntsGameScene'); }

    create() {
      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));

      this.backgroundGraphics = this.add.graphics().setDepth(0);
      this.boardGraphics = this.add.graphics().setDepth(1);
      this.slotGraphics = this.add.graphics().setDepth(2);
      this.tileGraphics = this.add.graphics().setDepth(3);
      this.workerGraphics = this.add.graphics().setDepth(5);
      this.overlayGraphics = this.add.graphics().setDepth(10);

      const numberFontSize = choose('22px', '26px');
      const numberStyle = {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: numberFontSize,
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#3d2a3a',
        strokeThickness: 5,
      };
      this.queueTexts = [];
      for (let i = 0; i < COL_COUNT * ROW_COUNT; i += 1) {
        this.queueTexts.push(this.add.text(0, 0, '', numberStyle).setOrigin(0.5).setDepth(4).setVisible(false));
      }
      this.slotTexts = [];
      for (let i = 0; i < SLOT_COUNT; i += 1) {
        this.slotTexts.push(this.add.text(0, 0, '', numberStyle).setOrigin(0.5).setDepth(4).setVisible(false));
      }

      this.add.text(20, 20, '蚂蚁搬砖', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('24px', '26px'), fontStyle: 'bold', color: '#ffe9f6' }).setDepth(7);
      this.add.text(L.boardX, L.boardY - 24, '目标图案', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('15px', '16px'), fontStyle: 'bold', color: '#d9c9f5' }).setDepth(7);
      this.add.text(L.slotsX, L.slotsY - 24, '槽位', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('15px', '16px'), fontStyle: 'bold', color: '#d9c9f5' }).setDepth(7);
      this.add.text(L.queueX, L.queueY - 24, '选择第一行数字块', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('15px', '16px'), fontStyle: 'bold', color: '#d9c9f5' }).setDepth(7);

      this.drawBackground();
      this.overlayItems = [];
      this.newGame();
    }

    drawBackground() {
      const g = this.backgroundGraphics;
      g.clear();
      g.fillStyle(0x12101f, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0x2a2145, 0.55).fillCircle(40, 60, 130);
      g.fillStyle(0x1d3550, 0.5).fillCircle(WIDTH - 40, HEIGHT - 40, 150);
      g.fillStyle(0x241b3d, 0.45).fillCircle(WIDTH - 30, 30, 110);
    }

    newGame() {
      this.state = 'playing';
      this.nextId = 1;
      this.workers = [];
      this.effects = [];

      this.board = [];
      const patternData = window.AntsPatternData || { cells: DEFAULT_PATTERN };
      let total = 0;
      for (let y = 0; y < BOARD_ROWS; y += 1) {
        const row = [];
        for (let x = 0; x < BOARD_COLS; x += 1) {
          const color = patternData ? patternData.cells[y][x] : randomInt(0, COLOR_COUNT - 1);
          row.push({ color: color, reserved: false });
          total += 1;
        }
        this.board.push(row);
      }

      this.remainingTotal = total;
      this.cards = buildCards(buildRemovalOrder(this.board));
      this.deckIndex = 0;

      this.queue = [];
      for (let col = 0; col < COL_COUNT; col += 1) this.queue.push([null, null, null]);
      for (let row = 0; row < ROW_COUNT; row += 1) {
        for (let col = 0; col < COL_COUNT; col += 1) this.queue[col][row] = this.nextCard();
      }

      this.slots = [];
      for (let i = 0; i < SLOT_COUNT; i += 1) this.slots.push({ tile: null, remaining: 0, timer: 0 });

      this.drawAll();
    }

    nextCard() {
      if (this.deckIndex >= this.cards.length) return null;
      const card = this.cards[this.deckIndex];
      this.deckIndex += 1;
      return card;
    }

    resetGame() {
      this.clearOverlay();
      this.overlayGraphics.clear();
      this.newGame();
    }

    clearOverlay() {
      this.overlayItems.forEach((item) => item.destroy());
      this.overlayItems = [];
    }

    drawAll() {
      this.drawBoard();
      this.drawSlots();
      this.drawQueue();
      this.drawWorkers();
    }

    drawBoard() {
      const g = this.boardGraphics;
      const panelPad = 10;
      g.clear();
      g.fillStyle(0x1b1830, 0.96).fillRoundedRect(L.boardX - panelPad, L.boardY - panelPad, boardWidth + panelPad * 2, boardHeight + panelPad * 2, 16);
      for (let y = 0; y < BOARD_ROWS; y += 1) {
        for (let x = 0; x < BOARD_COLS; x += 1) {
          const cell = this.board[y][x];
          if (!cell) continue;
          const px = L.boardX + x * (BOARD_CELL + BOARD_GAP);
          const py = L.boardY + y * (BOARD_CELL + BOARD_GAP);
          const palette = PALETTE[cell.color];
          const alpha = cell.reserved ? 0.55 : 1;
          g.fillStyle(palette.base, alpha).fillRoundedRect(px, py, BOARD_CELL, BOARD_CELL, 4);
          g.lineStyle(1, palette.dark, 0.9 * alpha).strokeRoundedRect(px, py, BOARD_CELL, BOARD_CELL, 4);
        }
      }
    }

    drawSlots() {
      const g = this.slotGraphics;
      g.clear();
      for (let i = 0; i < SLOT_COUNT; i += 1) {
        const x = L.slotsX + i * (TILE_SIZE + TILE_GAP);
        const y = L.slotsY;
        g.fillStyle(0x241f3f, 1).fillRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 12);
        g.lineStyle(2, 0x6a5f9e, 1).strokeRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 12);

        const slot = this.slots[i];
        const text = this.slotTexts[i];
        if (!slot.tile) {
          text.setVisible(false);
          continue;
        }
        const palette = PALETTE[slot.tile.color];
        g.fillStyle(palette.base, 1).fillRoundedRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 9);
        g.lineStyle(1, palette.light, 0.9).strokeRoundedRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8, 9);
        text.setText(String(slot.remaining)).setPosition(x + TILE_SIZE / 2, y + TILE_SIZE / 2).setVisible(true);
      }
    }

    isTilePlayable(tile) { return !!tile && this.hasExposedTarget(tile.color); }

    drawQueue() {
      const g = this.tileGraphics;
      g.clear();
      for (let col = 0; col < COL_COUNT; col += 1) {
        for (let row = 0; row < ROW_COUNT; row += 1) {
          const tile = this.queue[col][row];
          const index = row * COL_COUNT + col;
          const text = this.queueTexts[index];
          const x = L.queueX + col * (TILE_SIZE + TILE_GAP);
          const y = L.queueY + row * (TILE_SIZE + ROW_GAP);
          if (!tile) {
            text.setVisible(false);
            continue;
          }

          const playable = row === 0 ? this.isTilePlayable(tile) : true;
          if (playable) {
            const palette = PALETTE[tile.color];
            g.fillStyle(palette.base, 1).fillRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 14);
            g.lineStyle(2, palette.light, 0.9).strokeRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 14);
            if (row === 0) g.lineStyle(2, 0xffffff, 0.95).strokeRoundedRect(x - 2, y - 2, TILE_SIZE + 4, TILE_SIZE + 4, 16);
          } else {
            g.fillStyle(0x565064, 0.9).fillRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 14);
            g.lineStyle(2, 0x8c8798, 0.7).strokeRoundedRect(x, y, TILE_SIZE, TILE_SIZE, 14);
          }
          text.setText(String(tile.count)).setPosition(x + TILE_SIZE / 2, y + TILE_SIZE / 2).setVisible(true);
          text.setColor(playable ? '#ffffff' : '#c7c2d0');
        }
      }
    }

    drawWorkers() {
      const g = this.workerGraphics;
      g.clear();
      for (const worker of this.workers) {
        const palette = PALETTE[worker.color];
        const radius = TILE_SIZE * 0.16;
        let angle = worker.angle || 0;
        if (worker.phase !== 'pickup') {
          const currentWaypoint = worker.waypoints[Math.min(worker.waypointIndex, worker.waypoints.length - 1)];
          if (currentWaypoint) angle = Math.atan2(currentWaypoint.y - worker.y, currentWaypoint.x - worker.x);
          worker.angle = angle;
        }
        const headX = worker.x + Math.cos(angle) * radius * 0.55;
        const headY = worker.y + Math.sin(angle) * radius * 0.55;
        g.fillStyle(0x0a0812, 0.35).fillEllipse(worker.x + 2, worker.y + 3, radius * 1.4, radius * 0.8);
        if (worker.carrying || worker.phase === 'pickup') {
          const blockSize = radius * 1.35;
          const lift = worker.phase === 'pickup' ? 0.5 + worker.blockLift * 0.95 : 1.75;
          const blockY = worker.y - radius * lift;
          g.fillStyle(palette.dark, 0.95).fillRoundedRect(worker.x - blockSize / 2 + 2, blockY + 2, blockSize, blockSize, 2);
          g.fillStyle(palette.base, 1).fillRoundedRect(worker.x - blockSize / 2, blockY, blockSize, blockSize, 2);
          g.lineStyle(1, palette.light, 0.9).strokeRoundedRect(worker.x - blockSize / 2, blockY, blockSize, blockSize, 2);
        }
        g.fillStyle(palette.base, 1).fillCircle(worker.x, worker.y, radius * 0.85);
        g.fillStyle(palette.light, 1).fillCircle(headX, headY, radius * 0.6);
        g.fillStyle(0x1d1a2b, 1).fillCircle(headX - radius * 0.14, headY - radius * 0.12, radius * 0.14);
        g.fillStyle(0x1d1a2b, 1).fillCircle(headX + radius * 0.14, headY - radius * 0.12, radius * 0.14);
        g.lineStyle(2, 0x1d1a2b, 0.85).lineBetween(worker.x - radius * 0.4, worker.y + radius * 0.5, worker.x - radius * 0.75, worker.y + radius * 1.05);
        g.lineStyle(2, 0x1d1a2b, 0.85).lineBetween(worker.x + radius * 0.4, worker.y + radius * 0.5, worker.x + radius * 0.75, worker.y + radius * 1.05);
      }

      for (const effect of this.effects) {
        const progress = effect.age / effect.ttl;
        const radius = 5 + progress * 14;
        g.fillStyle(effect.color, Math.max(0, 1 - progress)).fillCircle(effect.x, effect.y, radius);
        g.lineStyle(2, 0xffffff, Math.max(0, 0.7 - progress * 0.7)).strokeCircle(effect.x, effect.y, radius);
      }
    }

    onPointerDown(pointer) {
      if (this.state !== 'playing') return;
      const localX = pointer.x - L.queueX;
      const localY = pointer.y - L.queueY;
      const col = Math.floor(localX / (TILE_SIZE + TILE_GAP));
      const row = Math.floor(localY / (TILE_SIZE + ROW_GAP));
      if (col < 0 || col >= COL_COUNT || row < 0 || row >= ROW_COUNT) return;
      const cellLeft = col * (TILE_SIZE + TILE_GAP);
      const cellTop = row * (TILE_SIZE + ROW_GAP);
      if (localX < cellLeft || localX > cellLeft + TILE_SIZE || localY < cellTop || localY > cellTop + TILE_SIZE) return;
      if (row !== 0) return;

      const tile = this.queue[col][0];
      if (!tile) return;
      if (!this.isTilePlayable(tile)) {
        AntsAudio.warning();
        return;
      }

      const slotIndex = this.slots.findIndex((slot) => !slot.tile);
      if (slotIndex < 0) {
        AntsAudio.warning();
        return;
      }

      const slot = this.slots[slotIndex];
      slot.tile = tile;
      slot.remaining = tile.count;
      slot.timer = 0;

      this.queue[col][0] = this.queue[col][1];
      this.queue[col][1] = this.queue[col][2];
      this.queue[col][2] = this.nextCard();

      AntsAudio.select();
      this.drawQueue();
      this.drawSlots();
      this.checkEnd();
    }

    hasPlayableTopTile() {
      return this.queue.some((column) => column[0] && this.hasExposedTarget(column[0].color));
    }

    isExposed(x, y) {
      if (x === 0 || x === BOARD_COLS - 1 || y === 0 || y === BOARD_ROWS - 1) return true;
      return this.board[y][x - 1] === null || this.board[y][x + 1] === null || this.board[y - 1][x] === null || this.board[y + 1][x] === null;
    }

    hasExposedTarget(color) {
      for (let y = 0; y < BOARD_ROWS; y += 1) {
        for (let x = 0; x < BOARD_COLS; x += 1) {
          const cell = this.board[y][x];
          if (cell && !cell.reserved && cell.color === color && this.isExposed(x, y)) return true;
        }
      }
      return false;
    }

    findExposedTarget(color) {
      const candidates = [];
      for (let y = 0; y < BOARD_ROWS; y += 1) {
        for (let x = 0; x < BOARD_COLS; x += 1) {
          const cell = this.board[y][x];
          if (cell && !cell.reserved && cell.color === color && this.isExposed(x, y)) candidates.push({ x: x, y: y });
        }
      }
      if (!candidates.length) return null;
      return candidates[randomInt(0, candidates.length - 1)];
    }

    reserveTarget(color) {
      const target = this.findExposedTarget(color);
      if (!target) return null;
      this.board[target.y][target.x].reserved = true;
      return target;
    }

    update(time, delta) {
      if (this.state !== 'playing') return;
      this.dispatchSlots(delta);
      this.updateWorkers(delta);
      this.updateEffects(delta);
      this.drawWorkers();
    }

    dispatchSlots(delta) {
      let slotsDirty = false;
      let queueDirty = false;
      let boardDirty = false;
      for (let i = 0; i < this.slots.length; i += 1) {
        const slot = this.slots[i];
        if (!slot.tile) continue;
        slot.timer -= delta;
        if (slot.timer > 0) continue;

        const target = this.reserveTarget(slot.tile.color);
        if (target) {
          slot.remaining -= 1;
          slot.timer = DISPATCH_INTERVAL;
          this.spawnWorker(i, target);
          AntsAudio.dispatch();
          queueDirty = true;
          slotsDirty = true;
          boardDirty = true;
          if (slot.remaining <= 0) {
            slot.tile = null;
            slot.remaining = 0;
            slot.timer = 0;
          }
        } else {
          slot.tile = null;
          slot.remaining = 0;
          slot.timer = 0;
          slotsDirty = true;
        }
      }
      if (boardDirty) this.drawBoard();
      if (queueDirty) this.drawQueue();
      if (slotsDirty) this.drawSlots();
      this.checkEnd();
    }

    spawnWorker(slotIndex, target) {
      const startX = L.slotsX + slotIndex * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      const startY = L.slotsY + TILE_SIZE / 2;
      const targetX = L.boardX + target.x * (BOARD_CELL + BOARD_GAP) + BOARD_CELL / 2;
      const targetY = L.boardY + target.y * (BOARD_CELL + BOARD_GAP) + BOARD_CELL / 2;
      const outPath = [
        { x: startX, y: startY },
        { x: targetX, y: startY },
        { x: targetX, y: targetY },
      ];
      this.workers.push({
        color: this.slots[slotIndex].tile ? this.slots[slotIndex].tile.color : 0,
        x: startX,
        y: startY,
        startX: startX,
        startY: startY,
        targetX: targetX,
        targetY: targetY,
        target: target,
        waypoints: outPath,
        waypointIndex: 1,
        phase: 'travelOut',
        carrying: false,
        pickupTimer: 0,
        blockLift: 0,
        angle: 0,
        dead: false,
      });
    }

    updateWorkers(delta) {
      for (const worker of this.workers) {
        if (worker.phase === 'pickup') {
          worker.pickupTimer -= delta;
          worker.blockLift = Math.max(0, Math.min(1, 1 - worker.pickupTimer / 120));
          if (worker.pickupTimer <= 0) {
            worker.carrying = true;
            worker.phase = 'travelBack';
            worker.waypoints = [
              { x: worker.targetX, y: worker.targetY },
              { x: worker.targetX, y: worker.startY },
              { x: worker.startX, y: worker.startY },
            ];
            worker.waypointIndex = 1;
          }
          continue;
        }

        const waypoint = worker.waypoints[worker.waypointIndex];
        if (!waypoint) {
          worker.dead = true;
          continue;
        }
        const speed = worker.carrying ? WORKER_SPEED * 0.85 : WORKER_SPEED;
        const step = speed * (delta / 1000);
        const dx = waypoint.x - worker.x;
        const dy = waypoint.y - worker.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= step || distance < 4) {
          worker.x = waypoint.x;
          worker.y = waypoint.y;
          worker.waypointIndex += 1;
          if (worker.waypointIndex >= worker.waypoints.length) {
            if (!worker.carrying) this.onWorkerReachTarget(worker);
            else this.onWorkerReturn(worker);
          }
          continue;
        }
        worker.x += dx / distance * step;
        worker.y += dy / distance * step;
        worker.angle = Math.atan2(dy, dx);
      }
      this.workers = this.workers.filter((worker) => !worker.dead);
      this.checkEnd();
    }

    onWorkerReachTarget(worker) {
      const cell = this.board[worker.target.y][worker.target.x];
      if (cell && cell.reserved) {
        this.board[worker.target.y][worker.target.x] = null;
        this.remainingTotal -= 1;
        AntsAudio.remove();
        this.drawBoard();
      }
      worker.phase = 'pickup';
      worker.pickupTimer = 120;
      worker.blockLift = 0;
      this.checkEnd();
    }

    onWorkerReturn(worker) {
      worker.dead = true;
      this.effects.push({ x: worker.startX, y: worker.startY, color: PALETTE[worker.color].base, age: 0, ttl: 190 });
    }

    updateEffects(delta) {
      for (const effect of this.effects) effect.age += delta;
      this.effects = this.effects.filter((effect) => effect.age < effect.ttl);
    }

    checkEnd() {
      if (this.state !== 'playing') return;
      if (this.remainingTotal <= 0 && this.workers.length === 0) {
        this.finish(true);
        return;
      }
      const hasWorkers = this.workers.length > 0;
      const hasDispatchable = this.slots.some((slot) => slot.tile && slot.remaining > 0 && this.hasExposedTarget(slot.tile.color));
      const hasEmptySlot = this.slots.some((slot) => !slot.tile);
      const hasPlayerMove = hasEmptySlot && this.hasPlayableTopTile();
      if (!hasWorkers && !hasDispatchable && !hasPlayerMove) this.finish(false);
    }

    finish(win) {
      if (this.state !== 'playing') return;
      this.state = win ? 'won' : 'lost';
      this.workers = [];
      this.effects = [];
      if (win) AntsAudio.win();
      else AntsAudio.lose();
      this.drawWorkers();
      this.showResult(win);
    }

    showResult(win) {
      this.clearOverlay();
      this.overlayGraphics.clear();
      this.overlayGraphics.fillStyle(0x05040c, 0.62).fillRect(0, 0, WIDTH, HEIGHT);
      const centerX = WIDTH / 2;
      const centerY = HEIGHT / 2;
      const title = this.add.text(centerX, centerY - 46, win ? '搬空啦！' : '卡住了', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('42px', '46px'), fontStyle: 'bold', color: '#fff4d9', stroke: '#6a3b62', strokeThickness: 8 }).setOrigin(0.5).setDepth(11);
      const subtitle = this.add.text(centerX, centerY + 8, win ? '整幅图案已经被小蚂蚁们清空了' : '没有可以继续搬的方块了', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('18px', '20px'), color: '#d9c9f5', align: 'center' }).setOrigin(0.5).setDepth(11);
      const button = this.add.rectangle(centerX, centerY + 78, 220, 56, 0xff8a48, 1).setStrokeStyle(3, 0xffd8a8, 0.95).setInteractive({ useHandCursor: true }).setDepth(11);
      const buttonText = this.add.text(centerX, centerY + 78, '再来一局', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#4c2c1c' }).setOrigin(0.5).setDepth(12);
      button.on('pointerdown', () => { AntsAudio.select(); this.resetGame(); });
      this.overlayItems.push(title, subtitle, button, buttonText);
    }
  }

  window.AntsGameScene = AntsGameScene;
})();
