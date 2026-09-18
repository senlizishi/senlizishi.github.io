(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;

  const COLORS = {
    bg: 0xfff3d6,
    path: 0xfffaf0,
    wallA: 0xff8fb3,
    wallB: 0x8fb8ff,
    wallLineA: 0xd9668f,
    wallLineB: 0x5f8fd9,
    player: 0xffd84e,
    playerLine: 0xc78a12,
    goal: 0x4de5bf,
  };

  const EMOJI_POOL = [
    '🐶',
    '🐱',
    '🐰',
    '🐼',
    '🐨',
    '🦊',
    '🐸',
    '🐵',
    '🐷',
    '🦁',
    '🐯',
    '🐮',
    '🐹',
    '🐻',
    '🐙',
    '🦄',
    '🐳',
    '🦋',
    '🐞',
    '🐢',
    '🐧',
    '🦉',
    '🐿️',
    '🦔',
  ];

  const BADGE_COLORS = [
    0xffb3ba,
    0xffdfba,
    0xffffba,
    0xbaffc9,
    0xbae1ff,
    0xd0bfff,
    0xf5b8ff,
    0xffc9de,
    0xb8ffe9,
    0xffe0b2,
    0xb2f7ef,
    0xfdcae1,
  ];

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
    return array;
  }

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
      flip: function () {
        tone(430, 660, 0.09, 'triangle', 0.16, 0);
      },
      match: function () {
        tone(523.25, 523.25, 0.12, 'sine', 0.18, 0);
        tone(783.99, 783.99, 0.16, 'sine', 0.18, 0.09);
      },
      mismatch: function () {
        tone(340, 250, 0.14, 'sine', 0.12, 0);
        tone(250, 200, 0.16, 'sine', 0.10, 0.10);
      },
      win: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, index) {
          tone(freq, freq, 0.14, 'triangle', 0.16, index * 0.10);
        });
      },
    };
  })();

  class MemoryGameScene extends Phaser.Scene {
    constructor() {
      super('MemoryGameScene');
    }

    create() {
      this.state = 'playing';
      this.level = 1;
      this.busy = false;
      this.flipped = [];
      this.cards = [];
      this.overlayItems = [];

      this.bgGraphics = this.add.graphics().setDepth(0);
      this.overlayGraphics = this.add.graphics().setDepth(10);
      this.levelText = this.add.text(WIDTH / 2, WIDTH < HEIGHT ? 76 : 42, '', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: WIDTH < HEIGHT ? '28px' : '22px',
        fontStyle: 'bold',
        color: '#a84e70',
        stroke: '#fff4e6',
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(3);

      this.drawBackground();
      this.startLevel();
    }

    startLevel() {
      this.busy = false;
      this.flipped = [];
      this.matchedCount = 0;
      this.clearCards();

      const cardCount = 4 + (this.level - 1) * 2;
      const pairCount = cardCount / 2;
      this.layout = this.getLayout(cardCount);
      this.cards = this.makeCardDefs(pairCount).map((def, index) => this.createCard(def, index));
      this.updateLevelText();
    }

    clearCards() {
      if (!this.cards) return;
      this.cards.forEach((card) => {
        if (card.root && card.root.active) card.root.destroy();
        if (card.zone && card.zone.active) card.zone.destroy();
      });
      this.cards = [];
    }

    makeCardDefs(pairCount) {
      const pool = shuffle(EMOJI_POOL.slice());
      const defs = [];
      for (let i = 0; i < pairCount; i += 1) {
        const emoji = pool[i % pool.length];
        let badgeColor = null;
        if (i >= pool.length) {
          const cycle = Math.floor(i / pool.length) - 1;
          badgeColor = BADGE_COLORS[cycle % BADGE_COLORS.length];
        }
        defs.push({ pairId: i, emoji: emoji, badgeColor: badgeColor });
      }

      const cards = [];
      defs.forEach((def) => {
        cards.push({ pairId: def.pairId, emoji: def.emoji, badgeColor: def.badgeColor });
        cards.push({ pairId: def.pairId, emoji: def.emoji, badgeColor: def.badgeColor });
      });
      return shuffle(cards);
    }

    getLayout(cardCount) {
      const target = Math.sqrt(cardCount * (WIDTH / HEIGHT));
      let cols = 1;
      let rows = cardCount;
      let bestSize = -Infinity;
      let bestEmpty = Infinity;
      const minCols = Math.max(1, Math.floor(target) - 2);
      const maxCols = Math.ceil(target) + 2;

      for (let c = minCols; c <= maxCols; c += 1) {
        const r = Math.ceil(cardCount / c);
        const size = Math.min(WIDTH / c, HEIGHT / r);
        const empty = c * r - cardCount;
        if (size > bestSize + 0.5 || (Math.abs(size - bestSize) < 0.5 && empty < bestEmpty)) {
          bestSize = size;
          bestEmpty = empty;
          cols = c;
          rows = r;
        }
      }

      const headerHeight = WIDTH < HEIGHT ? 132 : 84;
      const sidePad = 18;
      const bottomPad = 26;
      const availableW = WIDTH - sidePad * 2;
      const availableH = HEIGHT - headerHeight - bottomPad;
      let gap = 10;
      let cardSize = 0;

      for (let pass = 0; pass < 2; pass += 1) {
        cardSize = Math.floor(Math.min(
          (availableW - gap * (cols - 1)) / cols,
          (availableH - gap * (rows - 1)) / rows,
        ));
        gap = Math.max(5, Math.min(14, Math.round(cardSize * 0.14)));
      }

      cardSize = Math.max(24, cardSize);
      gap = Math.max(5, Math.min(14, Math.round(cardSize * 0.14)));
      const gridW = cols * cardSize + (cols - 1) * gap;
      const gridH = rows * cardSize + (rows - 1) * gap;

      return {
        cols: cols,
        rows: rows,
        cardSize: cardSize,
        gap: gap,
        originX: (WIDTH - gridW) / 2,
        originY: headerHeight + Math.max(0, (availableH - gridH) / 2),
        gridW: gridW,
        gridH: gridH,
      };
    }

    createCard(def, index) {
      const layout = this.layout;
      const col = index % layout.cols;
      const row = Math.floor(index / layout.cols);
      const x = layout.originX + col * (layout.cardSize + layout.gap) + layout.cardSize / 2;
      const y = layout.originY + row * (layout.cardSize + layout.gap) + layout.cardSize / 2;
      const size = layout.cardSize;
      const radius = Math.max(8, size * 0.16);

      const root = this.add.container(x, y).setDepth(1);

      const back = this.add.graphics();
      back.fillStyle(COLORS.wallB, 1).fillRoundedRect(-size / 2, -size / 2, size, size, radius);
      back.fillStyle(0xdfeaff, 0.95).fillRoundedRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, Math.max(6, radius - 2));
      back.lineStyle(2, COLORS.wallLineB, 0.9).strokeRoundedRect(-size / 2 + 4, -size / 2 + 4, size - 8, size - 8, Math.max(6, radius - 2));
      back.fillStyle(0xffffff, 0.5).fillCircle(-size * 0.18, -size * 0.12, Math.max(4, size * 0.12));
      back.fillStyle(0xffffff, 0.35).fillCircle(size * 0.16, size * 0.14, Math.max(3, size * 0.08));

      const face = this.add.container(0, 0);
      const faceBg = this.add.graphics();
      faceBg.fillStyle(0xffffff, 1).fillRoundedRect(-size / 2, -size / 2, size, size, radius);
      faceBg.lineStyle(2, def.badgeColor !== null ? def.badgeColor : COLORS.wallA, 0.9).strokeRoundedRect(-size / 2, -size / 2, size, size, radius);
      if (def.badgeColor !== null) {
        faceBg.fillStyle(def.badgeColor, 0.28).fillRoundedRect(-size * 0.30, -size * 0.30, size * 0.60, size * 0.60, size * 0.14);
      }
      const emojiText = this.add.text(0, 0, def.emoji, {
        fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif',
        fontSize: Math.max(18, Math.min(72, size * 0.46)) + 'px',
      }).setOrigin(0.5);
      face.add([faceBg, emojiText]);
      face.setVisible(false);

      root.add([back, face]);

      const zone = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: true }).setDepth(2);
      const card = {
        pairId: def.pairId,
        state: 'faceDown',
        root: root,
        back: back,
        face: face,
        zone: zone,
      };
      zone.on('pointerdown', () => this.onCardTap(card));
      return card;
    }

    drawBackground() {
      const g = this.bgGraphics;
      g.clear();
      g.fillStyle(COLORS.bg, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xffd6e7, 0.7).fillCircle(WIDTH * 0.08, HEIGHT * 0.1, Math.min(WIDTH, HEIGHT) * 0.24);
      g.fillStyle(0xcfeaff, 0.8).fillCircle(WIDTH * 0.94, HEIGHT * 0.88, Math.min(WIDTH, HEIGHT) * 0.28);
      g.fillStyle(0xfff0b8, 0.65).fillCircle(WIDTH * 0.9, HEIGHT * 0.08, Math.min(WIDTH, HEIGHT) * 0.2);
    }

    updateLevelText() {
      this.levelText.setText('第 ' + this.level + ' 关');
    }

    onCardTap(card) {
      if (this.state !== 'playing' || this.busy || card.state !== 'faceDown') return;
      this.busy = true;
      this.flipped.push(card);
      SoundFX.flip();

      this.flipCard(card, true).then(() => {
        if (this.flipped.length < 2) {
          this.busy = false;
          return;
        }

        const first = this.flipped.shift();
        const second = this.flipped.shift();
        if (first.pairId === second.pairId) {
          SoundFX.match();
          this.matchedCount += 2;
          Promise.all([this.removeCard(first), this.removeCard(second)]).then(() => {
            this.busy = false;
            if (this.matchedCount >= this.cards.length) this.win();
          });
        } else {
          SoundFX.mismatch();
          this.delay(650).then(() => {
            return Promise.all([this.flipCard(first, false), this.flipCard(second, false)]);
          }).then(() => {
            this.busy = false;
          });
        }
      });
    }

    flipCard(card, faceUp) {
      return new Promise((resolve) => {
        this.tweens.add({
          targets: card.root,
          scaleX: 0,
          duration: 120,
          ease: 'Sine.InOut',
          onComplete: () => {
            card.state = faceUp ? 'faceUp' : 'faceDown';
            card.back.setVisible(!faceUp);
            card.face.setVisible(faceUp);
            this.tweens.add({
              targets: card.root,
              scaleX: 1,
              duration: 120,
              ease: 'Sine.InOut',
              onComplete: resolve,
            });
          },
        });
      });
    }

    removeCard(card) {
      card.state = 'matched';
      card.zone.disableInteractive();
      return new Promise((resolve) => {
        this.tweens.add({
          targets: card.root,
          alpha: 0,
          scaleX: 0.55,
          scaleY: 0.55,
          duration: 250,
          ease: 'Back.In',
          onComplete: () => {
            if (card.root && card.root.active) card.root.destroy();
            if (card.zone && card.zone.active) card.zone.destroy();
            resolve();
          },
        });
      });
    }

    delay(ms) {
      return new Promise((resolve) => {
        this.time.delayedCall(ms, resolve);
      });
    }

    win() {
      if (this.state !== 'playing') return;
      this.state = 'won';
      SoundFX.win();

      const g = this.overlayGraphics;
      g.clear();
      g.fillStyle(0x2f1f3a, 0.3).fillRect(0, 0, WIDTH, HEIGHT);
      const panelW = Math.min(400, WIDTH - 40);
      const panelH = 250;
      g.fillStyle(0xffffff, 0.98).fillRoundedRect((WIDTH - panelW) / 2, (HEIGHT - panelH) / 2, panelW, panelH, 28);

      const title = this.add.text(WIDTH / 2, HEIGHT / 2 - 74, '过关啦！', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '36px',
        fontStyle: 'bold',
        color: '#ff8a48',
        stroke: '#fff4e6',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(11);

      const subtitle = this.add.text(WIDTH / 2, HEIGHT / 2 - 20, '第 ' + this.level + ' 关完成', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '20px',
        color: '#6b5d82',
      }).setOrigin(0.5).setDepth(11);

      const detail = this.add.text(WIDTH / 2, HEIGHT / 2 + 18, this.cards.length + ' 张卡片全部配对', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '16px',
        color: '#a48ab8',
      }).setOrigin(0.5).setDepth(11);

      const button = this.add.rectangle(WIDTH / 2, HEIGHT / 2 + 74, 220, 54, 0xff8a48, 1).setStrokeStyle(3, 0xffd8a8, 0.95).setInteractive({ useHandCursor: true }).setDepth(11);
      const buttonText = this.add.text(WIDTH / 2, HEIGHT / 2 + 74, '下一关', {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#b85c2a',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(12);

      button.on('pointerdown', () => this.nextLevel());
      this.overlayItems.push(title, subtitle, detail, button, buttonText);
    }

    nextLevel() {
      this.clearOverlay();
      this.level += 1;
      this.state = 'playing';
      this.startLevel();
    }

    clearOverlay() {
      this.overlayGraphics.clear();
      this.overlayItems.forEach((item) => item.destroy());
      this.overlayItems = [];
    }
  }

  window.MemoryGameScene = MemoryGameScene;
})();
