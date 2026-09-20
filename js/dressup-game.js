(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;

  const DOLL_W = 600;
  const DOLL_H = 900;
  const DOLL_FEET = 762;
  const DIR = 'assets/dressup/';

  const LAYOUT = IS_PORTRAIT
    ? {
      trayH: 150,
      trayPadX: 48,
      slotW: 100,
      slotH: 110,
      gap: 10,
      dollScale: 0.62,
      dollFeetY: 748,
      dropPad: 40,
      lift: 58,
      pickThreshold: 24,
      arrowR: 20,
    }
    : {
      trayH: 110,
      trayPadX: 44,
      slotW: 84,
      slotH: 92,
      gap: 8,
      dollScale: 0.45,
      dollFeetY: 384,
      dropPad: 36,
      lift: 46,
      pickThreshold: 22,
      arrowR: 17,
    };

  const TRAY_TOP = HEIGHT - LAYOUT.trayH;

  const SLOT_DEPTH = { bottom: 2, top: 3, shoes: 4, glasses: 7, hat: 8 };

  const ITEMS = [
    { key: 'hat-straw', slot: 'hat', label: '草帽', box: { x: 146, y: 104, w: 308, h: 100 } },
    { key: 'hat-bucket', slot: 'hat', label: '渔夫帽', box: { x: 172, y: 104, w: 256, h: 110 } },
    { key: 'hat-crown', slot: 'hat', label: '皇冠', box: { x: 218, y: 54, w: 164, h: 122 } },
    { key: 'hat-bow', slot: 'hat', label: '蝴蝶结', box: { x: 194, y: 94, w: 186, h: 80 } },
    { key: 'glasses-round', slot: 'glasses', label: '圆框墨镜', box: { x: 206, y: 180, w: 190, h: 80 } },
    { key: 'glasses-heart', slot: 'glasses', label: '爱心墨镜', box: { x: 206, y: 174, w: 190, h: 78 } },
    { key: 'top-tee', slot: 'top', label: 'T恤', box: { x: 184, y: 290, w: 232, h: 230 } },
    { key: 'top-stripe', slot: 'top', label: '条纹衫', box: { x: 184, y: 290, w: 232, h: 230 } },
    { key: 'top-swim', slot: 'top', label: '泳衣上衣', box: { x: 218, y: 292, w: 164, h: 138 } },
    { key: 'bottom-shorts', slot: 'bottom', label: '短裤', box: { x: 230, y: 460, w: 140, h: 106 } },
    { key: 'bottom-skirt', slot: 'bottom', label: '短裙', box: { x: 194, y: 454, w: 212, h: 144 } },
    { key: 'bottom-swim', slot: 'bottom', label: '泳裤', box: { x: 228, y: 468, w: 144, h: 104 } },
    { key: 'shoes-sneaker', slot: 'shoes', label: '运动鞋', box: { x: 222, y: 694, w: 158, h: 62 } },
    { key: 'shoes-sandal', slot: 'shoes', label: '凉鞋', box: { x: 228, y: 718, w: 148, h: 36 } },
  ];

  const SCENES_DATA = [
    { key: 'beach', name: '海边', emoji: '🏖️', playable: true, cardColor: 0x9fe4ff, accent: 0x2f9dd0 },
    { key: 'palace', name: '宫廷', emoji: '🏰', playable: false, cardColor: 0xe3d3f5, accent: 0x7a5bb0 },
    { key: 'forest', name: '森林', emoji: '🌲', playable: false, cardColor: 0xd2f0d6, accent: 0x3f9d6b },
  ];

  function textStyle(size, color, bold, lineSpacing) {
    const style = {
      fontFamily: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
      fontSize: size + 'px',
      color: color,
      align: 'center',
    };
    if (bold) style.fontStyle = 'bold';
    if (lineSpacing) style.lineSpacing = lineSpacing;
    return style;
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
      gain.gain.exponentialRampToValueAtTime(volume || 0.16, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.04);
    }

    return {
      enter: function () {
        tone(587.33, 587.33, 0.12, 'sine', 0.13, 0);
        tone(783.99, 783.99, 0.16, 'sine', 0.12, 0.10);
      },
      pick: function () {
        tone(520, 700, 0.07, 'triangle', 0.12, 0);
      },
      wear: function () {
        tone(659.25, 659.25, 0.10, 'sine', 0.16, 0);
        tone(880, 987.77, 0.14, 'sine', 0.13, 0.08);
      },
      swap: function () {
        tone(740, 740, 0.12, 'triangle', 0.14, 0);
      },
      remove: function () {
        tone(520, 330, 0.14, 'sine', 0.13, 0);
      },
      clearAll: function () {
        [700, 560, 440, 330].forEach(function (freq, index) {
          tone(freq, freq * 0.85, 0.12, 'triangle', 0.12, index * 0.07);
        });
      },
      denied: function () {
        tone(220, 150, 0.20, 'sawtooth', 0.08, 0);
      },
    };
  })();

  function drawCloud(g, x, y, r) {
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(x, y, r);
    g.fillCircle(x + r * 0.92, y + r * 0.18, r * 0.76);
    g.fillCircle(x - r * 0.95, y + r * 0.22, r * 0.68);
    g.fillRect(x - r * 1.5, y + r * 0.3, r * 3, r * 0.8);
  }

  function drawShell(g, x, y, r, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.arc(x, y, r, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xfff6df, 1).fillRect(x - r * 0.9, y, r * 1.8, r * 0.3);
  }

  function drawStarfish(g, x, y, r, color) {
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? r : r * 0.46;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push(new Phaser.Geom.Point(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
    }
    g.fillStyle(color, 1).fillPoints(points, true);
  }

  function drawBeachBall(g, x, y, r) {
    g.fillStyle(0xffffff, 1).fillCircle(x, y, r);
    const wedges = [
      { color: 0xff6b8a, from: -Math.PI / 2, to: -Math.PI / 6 },
      { color: 0x4fa8dc, from: -Math.PI / 6, to: Math.PI / 2 },
      { color: 0xffd84e, from: Math.PI / 2, to: (Math.PI * 7) / 6 },
    ];
    wedges.forEach(function (wedge) {
      g.fillStyle(wedge.color, 1);
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, r, wedge.from, wedge.to, false);
      g.closePath();
      g.fillPath();
    });
    g.fillStyle(0xffffff, 0.55).fillCircle(x - r * 0.3, y - r * 0.35, r * 0.22);
  }

  function drawPalm(g, baseX, baseY, h) {
    g.fillStyle(0xa8763f, 1);
    g.beginPath();
    g.moveTo(baseX - h * 0.055, baseY);
    g.lineTo(baseX - h * 0.022, baseY - h * 0.52);
    g.lineTo(baseX - h * 0.03, baseY - h);
    g.lineTo(baseX + h * 0.03, baseY - h);
    g.lineTo(baseX + h * 0.038, baseY - h * 0.52);
    g.lineTo(baseX + h * 0.055, baseY);
    g.closePath();
    g.fillPath();
    const topY = baseY - h;
    for (let i = 0; i < 5; i += 1) {
      const angle = Phaser.Math.DegToRad(-165 + i * 38);
      g.save();
      g.translateCanvas(baseX - h * 0.02, topY);
      g.rotateCanvas(angle);
      g.fillStyle(i % 2 === 0 ? 0x4fbf7a : 0x3fa768, 1);
      g.fillEllipse(h * 0.32, 0, h * 0.66, h * 0.22);
      g.restore();
    }
    g.fillStyle(0x8a5a2b, 1).fillCircle(baseX - h * 0.03, topY + h * 0.02, h * 0.045);
  }

  function drawBeach(g) {
    const short = Math.min(WIDTH, HEIGHT);
    const horizon = IS_PORTRAIT ? 300 : 216;
    const sandTop = IS_PORTRAIT ? 410 : 302;
    const sandH = HEIGHT - sandTop;

    g.fillStyle(0x9fe4ff, 1).fillRect(0, 0, WIDTH, horizon);
    g.fillStyle(0xd9f4ff, 1).fillRect(0, 0, WIDTH, horizon * 0.58);
    g.fillStyle(0xfff3c9, 1).fillRect(0, horizon * 0.74, WIDTH, horizon * 0.26);

    const sunX = WIDTH * 0.17;
    const sunY = horizon * 0.36;
    const sunR = short * 0.082;
    g.lineStyle(6, 0xffd75e, 0.7);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      g.lineBetween(
        sunX + Math.cos(angle) * sunR * 1.32,
        sunY + Math.sin(angle) * sunR * 1.32,
        sunX + Math.cos(angle) * sunR * 1.9,
        sunY + Math.sin(angle) * sunR * 1.9
      );
    }
    g.fillStyle(0xfff0a0, 1).fillCircle(sunX, sunY, sunR);
    g.fillStyle(0xffe066, 1).fillCircle(sunX, sunY, sunR * 0.82);

    drawCloud(g, WIDTH * 0.74, horizon * 0.26, short * 0.055);
    drawCloud(g, WIDTH * 0.44, horizon * 0.52, short * 0.042);

    g.fillStyle(0x63c8f0, 1).fillRect(0, horizon, WIDTH, sandTop - horizon);
    g.fillStyle(0x8adcf7, 1).fillRect(0, horizon, WIDTH, (sandTop - horizon) * 0.42);
    g.lineStyle(5, 0xffffff, 0.65);
    for (let i = 0; i < 4; i += 1) {
      const y = horizon + 16 + (i * (sandTop - horizon - 24)) / 4;
      const offset = i % 2 === 0 ? 0 : 30;
      for (let x = -28 + offset; x < WIDTH; x += 78) {
        g.beginPath();
        g.arc(x + 22, y, 22, Math.PI, Math.PI * 2, false);
        g.strokePath();
      }
    }

    g.fillStyle(0xf3d49c, 1).fillRect(0, sandTop, WIDTH, sandH);
    g.fillStyle(0xffe6bb, 1).fillRect(0, sandTop, WIDTH, sandH * 0.3);

    const dollCenterX = WIDTH / 2;
    drawPalm(g, Math.max(40, dollCenterX - short * 0.44), sandTop + sandH * 0.36, Math.min(sandH * 0.85, IS_PORTRAIT ? 190 : 150));
    drawBeachBall(g, Math.min(WIDTH - 52, dollCenterX + short * 0.42), sandTop + sandH * 0.3, short * 0.058);
    drawShell(g, WIDTH * 0.13, sandTop + sandH * 0.35, short * 0.032, 0xffb3d1);
    drawShell(g, WIDTH * 0.88, sandTop + sandH * 0.52, short * 0.028, 0xffe08a);
    drawStarfish(g, WIDTH * 0.2, sandTop + sandH * 0.68, short * 0.036, 0xff9f5f);
  }
  class DressupSceneSelectScene extends Phaser.Scene {
    constructor() {
      super('DressupSceneSelectScene');
    }

    preload() {
      const tip = this.add.text(WIDTH / 2, HEIGHT / 2, '加载中…', textStyle(IS_PORTRAIT ? 24 : 20, '#a0708c', true)).setOrigin(0.5);
      this.load.once('complete', function () {
        tip.destroy();
      });
      this.load.svg('doll-body', DIR + 'body.svg', { width: DOLL_W, height: DOLL_H });
      ITEMS.forEach((item) => {
        this.load.svg(item.key, DIR + item.key + '.svg', { width: DOLL_W, height: DOLL_H });
      });
    }

    create() {
      this.shaking = false;
      const short = Math.min(WIDTH, HEIGHT);
      const g = this.add.graphics();
      g.fillStyle(0xfff0f7, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xffd9ec, 0.7).fillCircle(WIDTH * 0.08, HEIGHT * 0.06, short * 0.28);
      g.fillStyle(0xd8efff, 0.75).fillCircle(WIDTH * 0.96, HEIGHT * 0.96, short * 0.32);
      g.fillStyle(0xfff6c9, 0.7).fillCircle(WIDTH * 0.92, HEIGHT * 0.05, short * 0.2);

      this.add.text(WIDTH / 2, IS_PORTRAIT ? 104 : 64, '换装小公主', textStyle(IS_PORTRAIT ? 40 : 32, '#d0498f', true)).setOrigin(0.5);
      this.add.text(WIDTH / 2, IS_PORTRAIT ? 150 : 104, '先挑一个场景吧', textStyle(IS_PORTRAIT ? 18 : 16, '#a0708c')).setOrigin(0.5);

      const cards = IS_PORTRAIT
        ? { w: 440, h: 180, xs: [WIDTH / 2, WIDTH / 2, WIDTH / 2], ys: [300, 512, 724] }
        : { w: 268, h: 326, xs: [172, 480, 788], ys: [330, 330, 330] };
      SCENES_DATA.forEach((data, index) => {
        this.buildCard(data, cards.xs[index], cards.ys[index], cards.w, cards.h);
      });
    }

    buildCard(data, cx, cy, w, h) {
      const card = this.add.container(cx, cy);
      const g = this.add.graphics();
      g.fillStyle(0xfffdfe, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
      g.fillStyle(data.cardColor, 1).fillRoundedRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 22);
      g.lineStyle(5, data.accent, 0.55).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
      card.add(g);

      const emoji = this.add.text(0, IS_PORTRAIT ? -h * 0.22 : -h * 0.21, data.emoji, {
        fontFamily: '"Segoe UI Emoji", "Microsoft YaHei", sans-serif',
        fontSize: (IS_PORTRAIT ? 62 : 58) + 'px',
      }).setOrigin(0.5);
      if (!data.playable) emoji.setAlpha(0.42);
      card.add(emoji);

      const nameY = IS_PORTRAIT ? h * 0.14 : h * 0.13;
      const name = this.add.text(0, nameY, data.name, textStyle(IS_PORTRAIT ? 28 : 24, data.playable ? '#5b4152' : '#8d8296', true)).setOrigin(0.5);
      card.add(name);

      const pillW = IS_PORTRAIT ? 112 : 96;
      const pillH = IS_PORTRAIT ? 34 : 30;
      const pillTop = nameY + (IS_PORTRAIT ? 30 : 26);
      const pillG = this.add.graphics();
      pillG.fillStyle(data.playable ? 0x4de5bf : 0xc9bfd0, 1).fillRoundedRect(-pillW / 2, pillTop, pillW, pillH, pillH / 2);
      card.add(pillG);
      card.add(this.add.text(0, pillTop + pillH / 2, data.playable ? '可以玩' : '敬请期待', textStyle(IS_PORTRAIT ? 17 : 15, data.playable ? '#0f6b52' : '#6e6478', true)).setOrigin(0.5));

      const hit = this.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.tapCard(data, card));
      card.add(hit);
    }

    tapCard(data, card) {
      if (!data.playable) {
        SoundFX.denied();
        if (this.shaking) return;
        this.shaking = true;
        const baseX = card.x;
        this.tweens.add({
          targets: card,
          x: baseX - 9,
          duration: 55,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.InOut',
          onComplete: () => {
            card.x = baseX;
            this.shaking = false;
          },
        });
        return;
      }
      SoundFX.pick();
      card.setScale(0.97);
      this.time.delayedCall(110, () => this.scene.start('DressupGameScene', { sceneKey: data.key }));
    }
  }

  class DressupGameScene extends Phaser.Scene {
    constructor() {
      super('DressupGameScene');
    }

    init(data) {
      this.sceneKey = (data && data.sceneKey) || 'beach';
      this.sceneInfo = SCENES_DATA.filter((item) => item.key === this.sceneKey)[0] || SCENES_DATA[0];
      this.equipped = {};
      this.thumbByKey = {};
      this.drag = null;
      this.trayOffset = 0;
      this.trayOffsetMax = 0;
    }

    create() {
      const scaleDoll = LAYOUT.dollScale;
      this.scaleDoll = scaleDoll;
      this.dollLeft = Math.round((WIDTH - DOLL_W * scaleDoll) / 2);
      this.dollTop = Math.round(LAYOUT.dollFeetY - DOLL_FEET * scaleDoll);
      this.dollRect = {
        x: this.dollLeft,
        y: this.dollTop,
        w: DOLL_W * scaleDoll,
        h: DOLL_H * scaleDoll,
      };

      this.buildBackground();
      this.buildDoll();
      this.buildTray();
      this.buildTopButtons();
      this.bindInput();
      SoundFX.enter();
    }

    buildBackground() {
      const g = this.add.graphics().setDepth(0);
      drawBeach(g);
      this.add.text(22, IS_PORTRAIT ? 68 : 60, this.sceneInfo.name + '换装', textStyle(IS_PORTRAIT ? 22 : 19, '#3f6b86', true)).setDepth(12).setOrigin(0, 0.5);
      this.add.text(22, IS_PORTRAIT ? 96 : 86, '把配件拖到小姐姐身上', textStyle(IS_PORTRAIT ? 14 : 13, '#5c7c92')).setDepth(12).setOrigin(0, 0.5);
    }

    buildDoll() {
      const centerX = this.dollLeft + (DOLL_W * this.scaleDoll) / 2;
      this.add.ellipse(centerX, LAYOUT.dollFeetY + 6, 180 * this.scaleDoll, 40 * this.scaleDoll, 0xd0a566, 0.38).setDepth(1);
      this.dollLayer = this.add.container(this.dollLeft, this.dollTop).setDepth(5).setScale(this.scaleDoll);
      this.dollLayer.add(this.add.image(0, 0, 'doll-body').setOrigin(0, 0));
      this.wornLayer = this.add.container(0, 0);
      this.dollLayer.add(this.wornLayer);
    }

    buildTray() {
      const g = this.add.graphics().setDepth(20);
      g.fillStyle(0xffe6f2, 0.96).fillRoundedRect(0, TRAY_TOP - 8, WIDTH, LAYOUT.trayH + 8, { tl: 28, tr: 28, bl: 0, br: 0 });
      g.lineStyle(5, 0xffc0dd, 1).strokeRoundedRect(-2, TRAY_TOP - 8, WIDTH + 4, LAYOUT.trayH + 10, { tl: 28, tr: 28, bl: 0, br: 0 });

      const panArea = this.add.rectangle(WIDTH / 2, TRAY_TOP + LAYOUT.trayH / 2, WIDTH, LAYOUT.trayH, 0xffffff, 0).setDepth(20.5);
      panArea.setInteractive();
      panArea.on('pointerdown', (pointer) => this.onGrab(null, pointer, false));

      this.trayContent = this.add.container(0, 0).setDepth(21);
      const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
      maskShape.fillStyle(0xffffff, 1).fillRect(0, TRAY_TOP, WIDTH, LAYOUT.trayH);
      this.trayContent.setMask(maskShape.createGeometryMask());

      const step = LAYOUT.slotW + LAYOUT.gap;
      const slotY = TRAY_TOP + (LAYOUT.trayH - LAYOUT.slotH) / 2;
      ITEMS.forEach((def, index) => {
        def.slotX = LAYOUT.trayPadX + index * step;
        def.slotCenterX = def.slotX + LAYOUT.slotW / 2;
        const plate = this.add.graphics();
        plate.fillStyle(0xffffff, 0.88).fillRoundedRect(def.slotX, slotY, LAYOUT.slotW, LAYOUT.slotH, 18);
        plate.lineStyle(3, 0xffc9e0, 1).strokeRoundedRect(def.slotX, slotY, LAYOUT.slotW, LAYOUT.slotH, 18);
        this.trayContent.add(plate);

        const fit = Math.min((LAYOUT.slotW - 16) / def.box.w, (LAYOUT.slotH - 22) / def.box.h);
        def.thumbScale = fit;
        def.thumbX = def.slotX + (LAYOUT.slotW - def.box.w * fit) / 2 - def.box.x * fit;
        def.thumbY = slotY + (LAYOUT.slotH - def.box.h * fit) / 2 - def.box.y * fit;
        const img = this.add.image(def.thumbX, def.thumbY, def.key).setOrigin(0, 0).setScale(fit);
        img.setCrop(def.box.x, def.box.y, def.box.w, def.box.h);
        img.setInteractive(new Phaser.Geom.Rectangle(def.box.x, def.box.y, def.box.w, def.box.h), Phaser.Geom.Rectangle.Contains);
        img.on('pointerdown', (pointer) => this.onGrab(def, pointer, false));
        this.trayContent.add(img);
        this.thumbByKey[def.key] = img;
      });

      const contentRight = LAYOUT.trayPadX + (ITEMS.length - 1) * step + LAYOUT.slotW;
      this.trayOffsetMax = Math.max(0, contentRight + LAYOUT.trayPadX - WIDTH);

      this.buildArrow(-1, LAYOUT.arrowR + 4);
      this.buildArrow(1, WIDTH - LAYOUT.arrowR - 4);
    }

    buildArrow(dir, cx) {
      const cy = TRAY_TOP + LAYOUT.trayH / 2;
      const r = LAYOUT.arrowR;
      const btn = this.add.container(cx, cy).setDepth(22);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, r);
      g.lineStyle(3, 0xffb8d6, 1).strokeCircle(0, 0, r);
      btn.add(g);
      btn.add(this.add.triangle(
        0, 0,
        dir < 0 ? r * 0.42 : -r * 0.42, -r * 0.46,
        dir < 0 ? -r * 0.36 : r * 0.36, 0,
        dir < 0 ? r * 0.42 : -r * 0.42, r * 0.46,
        0xff7fb8
      ));
      const hit = this.add.circle(0, 0, r, 0xffffff, 0);
      hit.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      btn.add(hit);

      const stepScroll = () => this.scrollBy((LAYOUT.slotW + LAYOUT.gap) * dir);
      let timer = null;
      const stop = () => {
        if (timer) {
          timer.remove();
          timer = null;
        }
      };
      hit.on('pointerdown', () => {
        stepScroll();
        stop();
        timer = this.time.addEvent({ delay: 320, loop: true, callback: stepScroll });
      });
      hit.on('pointerup', stop);
      hit.on('pointerout', stop);
      hit.on('pointerupoutside', stop);
    }

    buildTopButtons() {
      const r = IS_PORTRAIT ? 32 : 28;
      const margin = IS_PORTRAIT ? 48 : 42;
      this.buildRoundButton(WIDTH - margin, margin, r, 0xff8fb3, '#ffffff', '全部\n脱下', () => this.clearAll());
      this.buildRoundButton(WIDTH - margin, margin + r * 2 + 16, r * 0.84, 0xbfe6ff, '#2f6f9d', '换\n场景', () => this.scene.start('DressupSceneSelectScene'));
    }

    buildRoundButton(cx, cy, r, fillColor, textColor, label, onClick) {
      const btn = this.add.container(cx, cy).setDepth(22);
      const g = this.add.graphics();
      g.fillStyle(fillColor, 1).fillCircle(0, 0, r);
      g.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, r);
      btn.add(g);
      btn.add(this.add.text(0, 0, label, textStyle(Math.round(r * 0.46), textColor, true, 0)).setOrigin(0.5));
      const hit = this.add.circle(0, 0, r, 0xffffff, 0);
      hit.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      hit.on('pointerdown', () => onClick());
      btn.add(hit);
    }

    bindInput() {
      this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
      this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
      this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
    }

    onGrab(def, pointer, fromWorn) {
      if (this.drag) return;
      const worn = fromWorn && def ? this.equipped[def.slot] : null;
      if (fromWorn && !worn) return;
      this.drag = {
        def: def,
        pointerId: pointer.id,
        mode: 'decide',
        fromWorn: !!fromWorn,
        wornImage: worn ? worn.image : null,
        startX: pointer.x,
        startY: pointer.y,
        startTrayOffset: this.trayOffset,
        ghost: null,
      };
    }

    onPointerMove(pointer) {
      const d = this.drag;
      if (!d || pointer.id !== d.pointerId) return;
      const dx = pointer.x - d.startX;
      const dy = pointer.y - d.startY;
      if (d.mode === 'decide') {
        if (!d.def) {
          if (Math.abs(dx) > 3) d.mode = 'scroll';
        } else if (d.fromWorn) {
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) this.beginPickup(d, pointer);
        } else if (dy < -LAYOUT.pickThreshold) {
          this.beginPickup(d, pointer);
        } else if (dy < -8 && Math.abs(dy) > Math.abs(dx) * 0.5) {
          d.mode = 'decide';
        } else if (Math.abs(dx) > 6) {
          d.mode = 'scroll';
        }
      }
      if (d.mode === 'pickup') this.moveGhost(d, pointer);
      else if (d.mode === 'scroll') this.setTrayOffset(d.startTrayOffset - dx);
    }

    beginPickup(d, pointer) {
      d.mode = 'pickup';
      const scale = this.scaleDoll * 1.15;
      const box = d.def.box;
      const ghost = this.add.image(0, 0, d.def.key).setOrigin(0, 0).setScale(scale).setDepth(30);
      ghost.setCrop(Math.max(0, box.x - 8), Math.max(0, box.y - 8), box.w + 16, box.h + 16);
      d.ghost = { image: ghost, scale: scale };
      if (d.wornImage) d.wornImage.setVisible(false);
      else this.setThumbDim(d.def.key, true);
      SoundFX.pick();
      this.moveGhost(d, pointer);
    }

    moveGhost(d, pointer) {
      const g = d.ghost;
      if (!g) return;
      const box = d.def.box;
      g.image.x = pointer.x - (box.x + box.w / 2) * g.scale;
      g.image.y = pointer.y - LAYOUT.lift - (box.y + box.h / 2) * g.scale;
    }

    onPointerUp(pointer) {
      const d = this.drag;
      if (!d || pointer.id !== d.pointerId) return;
      this.drag = null;
      if (d.mode === 'scroll') {
        this.setTrayOffset(Math.round(this.trayOffset));
        return;
      }
      if (d.mode !== 'pickup') return;
      const overDoll = this.isOverDoll(pointer.x, pointer.y);
      const ghost = d.ghost;
      if (ghost) ghost.image.destroy();
      if (overDoll) {
        if (d.fromWorn) {
          d.wornImage.setVisible(true);
          this.popImage(d.wornImage);
          SoundFX.wear();
        } else {
          this.equip(d.def);
        }
      } else if (d.fromWorn) {
        this.destroyWorn(d.def.slot);
        SoundFX.remove();
      } else {
        this.flyBackToTray(d, ghost);
      }
    }

    isOverDoll(x, y) {
      const r = this.dollRect;
      const pad = LAYOUT.dropPad;
      const left = Math.max(0, r.x - pad);
      const right = Math.min(WIDTH, r.x + r.w + pad);
      const top = Math.max(0, r.y - pad);
      const bottom = Math.min(TRAY_TOP - 6, r.y + r.h + pad);
      return x >= left && x <= right && y >= top && y <= bottom;
    }

    equip(def) {
      const slot = def.slot;
      const prev = this.equipped[slot];
      if (prev && prev.key === def.key) {
        this.popImage(prev.image);
        SoundFX.wear();
        return;
      }
      let replaced = false;
      if (prev) {
        this.destroyWorn(slot);
        replaced = true;
      }
      const box = def.box;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const img = this.add.image(cx, cy, def.key).setOrigin(cx / DOLL_W, cy / DOLL_H);
      img.setDepth(SLOT_DEPTH[slot]);
      img.setScale(0.9).setAlpha(0.7);
      img.setInteractive(new Phaser.Geom.Rectangle(box.x, box.y, box.w, box.h), Phaser.Geom.Rectangle.Contains);
      img.on('pointerdown', (pointer) => this.onGrab(def, pointer, true));
      this.wornLayer.add(img);
      this.wornLayer.sort('depth');
      this.equipped[slot] = { key: def.key, def: def, image: img };
      this.tweens.add({ targets: img, scaleX: 1, scaleY: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
      this.setThumbDim(def.key, true);
      this.sparkle(cx, cy);
      SoundFX[replaced ? 'swap' : 'wear']();
    }

    destroyWorn(slot) {
      const cur = this.equipped[slot];
      if (!cur) return;
      delete this.equipped[slot];
      this.setThumbDim(cur.key, false);
      const img = cur.image;
      img.disableInteractive();
      this.tweens.add({
        targets: img,
        alpha: 0,
        scaleX: 0.78,
        scaleY: 0.78,
        duration: 190,
        ease: 'Sine.In',
        onComplete: () => img.destroy(),
      });
    }

    popImage(img) {
      this.tweens.add({ targets: img, scaleX: 1.08, scaleY: 1.08, duration: 110, yoyo: true, ease: 'Sine.InOut' });
    }

    setThumbDim(key, dim) {
      const thumb = this.thumbByKey[key];
      if (thumb) thumb.setAlpha(dim ? 0.32 : 1);
    }

    sparkle(dollX, dollY) {
      const cx = this.dollLeft + dollX * this.scaleDoll;
      const cy = this.dollTop + dollY * this.scaleDoll;
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
        const dist = 42 + Math.random() * 26;
        const star = this.add.circle(cx, cy, 5 + Math.random() * 3, i % 2 === 0 ? 0xfff08a : 0xffffff, 0.95).setDepth(31);
        this.tweens.add({
          targets: star,
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          alpha: 0,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 440,
          ease: 'Cubic.Out',
          onComplete: () => star.destroy(),
        });
      }
    }

    flyBackToTray(d, ghost) {
      const def = d.def;
      const fit = def.thumbScale;
      const box = def.box;
      const targetCenterX = def.slotCenterX - this.trayOffset;
      const targetCenterY = def.thumbY + (box.y + box.h / 2) * fit;
      const img = this.add.image(0, 0, def.key).setOrigin(0, 0).setDepth(31);
      img.setCrop(box.x, box.y, box.w, box.h);
      img.setScale(ghost ? ghost.scale : fit);
      img.setPosition(ghost ? ghost.image.x : targetCenterX, ghost ? ghost.image.y : targetCenterY);
      this.tweens.add({
        targets: img,
        scaleX: fit,
        scaleY: fit,
        x: targetCenterX - (box.x + box.w / 2) * fit,
        y: targetCenterY - (box.y + box.h / 2) * fit,
        duration: 260,
        ease: 'Cubic.In',
        onComplete: () => {
          img.destroy();
          this.setThumbDim(def.key, false);
        },
      });
      SoundFX.remove();
    }

    clearAll() {
      const slots = Object.keys(this.equipped);
      if (!slots.length) {
        SoundFX.denied();
        return;
      }
      SoundFX.clearAll();
      slots.forEach((slot, index) => {
        this.time.delayedCall(index * 70, () => this.destroyWorn(slot));
      });
    }

    scrollBy(delta) {
      this.setTrayOffset(this.trayOffset + delta);
    }

    setTrayOffset(value) {
      this.trayOffset = Phaser.Math.Clamp(value, 0, this.trayOffsetMax);
      this.trayContent.x = -this.trayOffset;
    }
  }

  window.DressupSceneSelectScene = DressupSceneSelectScene;
  window.DressupGameScene = DressupGameScene;
})();