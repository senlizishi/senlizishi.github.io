/*
 * 广东麻将玩法场景：一人（下方）对三家电脑。
 * 规则：不能吃，只能碰 / 杠 / 胡；自摸或胡别人打出的牌。
 * 打完一局自动开下一局，不记分、不统计。
 */
(function () {
  'use strict';

  const RULES = window.MahjongRules;
  const ART = window.MahjongArt;
  const SFX = window.MahjongAudio;
  const TILE = ART.TILE;

  // 画布尺寸由 mahjong.html 按屏幕比例算好放进 window.MahjongView，
  // 下面的值只是兜底，真正的尺寸在 create() 里落地。
  let IS_PORTRAIT = window.innerHeight >= window.innerWidth;
  let WIDTH = IS_PORTRAIT ? 540 : 960;
  let HEIGHT = IS_PORTRAIT ? 960 : 540;
  let HUD_INSET = 78;                                    // 左上角返回按钮让出的宽度
  let SAFE = { top: 0, right: 0, bottom: 0, left: 0 };    // 刘海 / 圆角安全区（画布坐标）
  const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const TAU = Math.PI * 2;

  const SEAT_NAME = ['你', '下家', '对家', '上家'];
  const WIND_NAME = ['东', '南', '西', '北'];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function roundRectPath(g, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + radius, y);
    g.lineTo(x + w - radius, y);
    g.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - radius);
    g.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
    g.lineTo(x + radius, y + h);
    g.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
    g.lineTo(x, y + radius);
    g.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
    g.closePath();
  }

  // 以 (x, y) 为中心的圆角面板：内部按中心点作画，整体缩放时不会跑偏
  function addPanel(scene, x, y, w, h, color, alpha, radius) {
    const r = radius || 14;
    const g = scene.add.graphics({ x: x, y: y });
    g.fillStyle(0x0d0716, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, r);
    g.fillStyle(color, alpha === undefined ? 0.92 : alpha).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    return g;
  }

  // 立体感按钮：投影 + 厚度底座 + 圆角亮面 + 金色描边
  function addButton(scene, x, y, w, h, label, onClick, options) {
    const opts = options || {};
    const container = scene.add.container(x, y).setDepth(opts.depth || 60);
    const radius = Math.min(opts.radius === undefined ? 12 : opts.radius, h / 2);
    const color = opts.color === undefined ? 0x7b53ad : opts.color;
    const base = opts.base === undefined ? 0x5c3a86 : opts.base;
    const lift = 3;                     // 立面厚度
    const face = scene.add.graphics();
    // 贴地投影
    face.fillStyle(0x070410, 0.42).fillRoundedRect(-w / 2 + 1, -h / 2 + lift + 3, w, h - lift, radius);
    // 底座（比面低一点，形成厚度）
    face.fillStyle(base, 1).fillRoundedRect(-w / 2, -h / 2 + lift, w, h - lift, radius);
    // 按钮面
    face.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h - lift, radius);
    // 顶面反光
    face.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, (h - lift) * 0.44, Math.max(3, radius - 3));
    // 金色描边
    face.lineStyle(1.4, 0xffd89a, 0.4).strokeRoundedRect(-w / 2 + 0.7, -h / 2 + 0.7, w - 1.4, h - lift - 1.4, radius);
    const text = scene.add.text(0, -lift / 2, label, {
      fontFamily: FONT,
      fontSize: (opts.fontSize || 19) + 'px',
      fontStyle: 'bold',
      color: opts.textColor || '#fff6e6',
    }).setOrigin(0.5);
    if (text.setShadow) text.setShadow(0, 1, 'rgba(0,0,0,0.45)', 2, false, true);
    const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      scene.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: 60, yoyo: true });
      onClick();
    });
    container.add([face, hit, text]);
    container.buttonText = text;
    container.buttonFace = face;
    return container;
  }

  function text(scene, x, y, content, size, color, options) {
    const opts = options || {};
    return scene.add.text(x, y, content, {
      fontFamily: FONT,
      fontSize: size + 'px',
      fontStyle: opts.bold ? 'bold' : 'normal',
      color: color,
      align: opts.align || 'left',
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
      stroke: opts.stroke,
      strokeThickness: opts.strokeThickness || 0,
    }).setOrigin(opts.originX === undefined ? 0 : opts.originX, opts.originY === undefined ? 0 : opts.originY);
  }

  function hashRand(seed) {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  // 自适应布局：画布比例等于屏幕比例，所以按画布尺寸算出的坐标天然适配任何机型。
  // 所有尺寸都从 WIDTH / HEIGHT / SAFE / HUD_INSET 推出来，不写死像素，
  // 这样竖屏、横屏、平板、桌面窗口都不会出现压边或留黑边。
  function computeLayout() {
    const safe = SAFE;
    const cols = 6;
    const inset = Math.max(safe.left, HUD_INSET);   // 左上角要躲开返回按钮

    if (IS_PORTRAIT) {
      const hud = {
        titleX: inset,
        titleY: safe.top + 26,
        subY: safe.top + 60,
        pillY: safe.top + 24,
        pillRight: WIDTH - safe.right - 10,
        pillW: 68,
        pillH: 30,
      };

      // 底部区块自下而上排：提示 -> 手牌 -> 状态 -> 操作按钮
      const handScale = 0.55;
      const halfH = TILE.faceH * handScale / 2;
      const hintY = HEIGHT - safe.bottom - 26;
      const handY = hintY - 22 - halfH;
      const statusY = handY - 72;
      const actionsY = handY - 124;

      const side = clamp(Math.round(WIDTH * 0.034), 12, 26);
      // 牌桌上沿要让开标题 + 牌墙/局数那一行，否则牌匾会压到桌面上
      const chipRowBottom = hud.pillY + hud.pillH + 72;
      const tableTop = Math.max(hud.pillY + hud.pillH + 22, chipRowBottom);
      const tableBottom = actionsY - 26 - 16;
      const room = Math.max(180, tableBottom - tableTop);
      const table = {
        cx: WIDTH / 2,
        cy: tableTop + room / 2,
        size: Math.max(200, Math.min(WIDTH - side * 2, room)),
      };

      const rim = table.size * 0.085;
      const felt = {
        x: table.cx - table.size / 2 + rim,
        y: table.cy - table.size / 2 + rim,
        w: table.size - rim * 2,
        h: table.size - rim * 2,
      };
      const band = 34;                              // 对手手牌靠边的一条
      const inner = { x: felt.x + band, y: felt.y + band, w: felt.w - band * 2, h: felt.h - band * 2 };
      const upDeadDrop = 40;                        // 对家弃牌区下移，给副露角落让位
      const meldBand = 44;
      const region = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - meldBand };

      // 弃牌槽按剩下的空间取大小：牌尽量大，槽位留缝，看着不挤
      const dead = {
        w: clamp(Math.floor(region.w / cols), 22, 34),
        h: clamp(Math.floor(region.h / 5), 26, 44),
      };
      const deadScale = clamp((dead.h - 6) / TILE.faceH, 0.15, 0.27);
      const gapX = (region.w - cols * dead.w) / 2;
      const left = region.x + gapX;
      const centerY = region.y + region.h / 2;
      const sideTop = centerY - ((cols - 1) * dead.w) / 2;

      // 对手整条手牌要放得进内圈：牌桌越小画得越小，牌多时自动收紧间距
      const innerMin = Math.min(inner.w, inner.h);
      const oppScale = Math.round(clamp((innerMin - 8) / 1185.6, 0.15, 0.26) * 100) / 100;
      const oppPitch = clamp(Math.floor((innerMin - TILE.faceW * oppScale - 6) / 13), 8, 26);

      return {
        table: table,
        felt: felt,
        inner: inner,
        region: region,
        hud: hud,
        hand: { y: handY, scale: handScale, maxPitch: 44, avail: WIDTH - side * 2, left: side },
        meldBand: meldBand,
        playerMeld: {
          y: region.y + region.h + meldBand / 2 + 12,
          scale: 0.26,
          right: felt.x + felt.w - 10,
          maxWidth: Math.round(felt.w * 0.66),
        },
        oppScale: oppScale,
        oppPitch: oppPitch,
        deadScale: deadScale,
        corner: {
          1: { x: inner.x + inner.w, y: inner.y + 18, align: 'right' },
          2: { x: inner.x, y: inner.y + 18, align: 'left' },
          3: { x: inner.x, y: inner.y + inner.h - 18, align: 'left', growUp: true },
        },
        oppMeld: {
          1: { scale: 0.18, maxWidth: 168 },
          2: { scale: 0.18, maxWidth: 168 },
          3: { scale: 0.18, maxWidth: 160 },
        },
        seats: {
          0: { originX: table.cx - (cols - 1) * dead.w / 2, originY: region.y + region.h - dead.h / 2, stepX: dead.w, stepY: -dead.h, rotation: 0 },
          2: { originX: left + (cols - 1) * dead.w, originY: region.y + dead.h / 2 + upDeadDrop, stepX: -dead.w, stepY: dead.h, rotation: Math.PI },
          3: { originX: region.x + (dead.h + 4) / 2, originY: sideTop, stepX: dead.h + 4, stepY: dead.w, rotation: Math.PI / 2 },
          1: { originX: region.x + region.w - (dead.h + 4) / 2, originY: sideTop, stepX: -(dead.h + 4), stepY: dead.w, rotation: -Math.PI / 2 },
        },
        cols: cols,
        opp: {
          2: { from: 'x', y: inner.y - band / 2, pitch: oppPitch, center: table.cx },
          3: { from: 'y', x: inner.x - band / 2, pitch: oppPitch, center: table.cy },
          1: { from: 'y', x: inner.x + inner.w + band / 2, pitch: oppPitch, center: table.cy },
        },
        actions: { mode: 'row', x: WIDTH / 2, y: actionsY, w: 94, h: 52, gap: 12 },
        status: { x: WIDTH / 2, y: statusY },
        hint: { x: WIDTH / 2, y: hintY },
        wallChip: { x: inset + 82, y: safe.top + 94 },
        roundChip: { x: WIDTH - safe.right - 168, y: safe.top + 94 },
      };
    }

    // ---------------- 横屏 ----------------
    // 横屏高度基本被牌桌吃满，顶部留不出横带，所以标题写在牌桌正上方，
    // 音量/重开、牌墙、局数、操作按钮全部收进右侧操作栏。
    const rightCol = clamp(Math.round(WIDTH * 0.2), 158, 224);
    const controlsX = WIDTH - safe.right - Math.round(rightCol * 0.5);
    const controlsLeft = WIDTH - safe.right - rightCol;

    const hudBand = Math.round(clamp(WIDTH * 0.055, 46, 58));
    const pillH = 30;
    const hud = {
      titleX: 0,                                   // 下面按牌桌中线补
      titleY: safe.top + hudBand * 0.40,
      subY: safe.top + hudBand * 0.80,
      pillY: safe.top + 20,
      pillRight: WIDTH - safe.right - 10,
      pillW: 68,
      pillH: pillH,
    };

    const handScale = 0.54;
    const halfH = TILE.faceH * handScale / 2;
    const handY = HEIGHT - safe.bottom - 16 - halfH;
    const bodyW = WIDTH - safe.left - safe.right;
    const handAvail = Math.min(bodyW - 200, 760);
    const handLeft = safe.left + (bodyW - handAvail) / 2;

    const vmargin = clamp(Math.round(HEIGHT * 0.024), 8, 16);
    const tableTop = safe.top + hudBand;
    const tableBottom = HEIGHT - safe.bottom - vmargin;
    const band = Math.max(180, tableBottom - tableTop);
    // 牌桌可用横向区间：左沿躲开返回按钮，右沿让开操作栏
    const leftEdge = inset;
    const rightEdge = controlsLeft - 6;
    const span = Math.max(180, rightEdge - leftEdge);
    const size = Math.max(180, Math.min(span, band));
    const cx = leftEdge + Math.max(0, span - size) / 2 + size / 2;
    const table = { cx: cx, cy: tableTop + band / 2, size: size };
    hud.titleX = cx;

    const rim = size * 0.085;
    const felt = {
      x: cx - size / 2 + rim,
      y: table.cy - size / 2 + rim,
      w: size - rim * 2,
      h: size - rim * 2,
    };
    const band2 = 30;
    const inner = { x: felt.x + band2, y: felt.y + band2, w: felt.w - band2 * 2, h: felt.h - band2 * 2 };
    const upDeadDrop = 30;
    const meldBand = 0;
    const region = { x: inner.x, y: inner.y, w: inner.w, h: inner.h };

    const dead = {
      w: clamp(Math.floor(region.w / cols), 22, 34),
      h: clamp(Math.floor(region.h / 5), 26, 44),
    };
    const deadScale = clamp((dead.h - 6) / TILE.faceH, 0.15, 0.27);
    const gapX = (region.w - cols * dead.w) / 2;
    const left = region.x + gapX;
    const centerY = region.y + region.h / 2;
    const sideTop = centerY - ((cols - 1) * dead.w) / 2;

    const innerMin = Math.min(inner.w, inner.h);
    const oppScale = Math.round(clamp((innerMin - 8) / 1185.6, 0.15, 0.26) * 100) / 100;
    const oppPitch = clamp(Math.floor((innerMin - TILE.faceW * oppScale - 6) / 13), 8, 26);

    return {
      table: table,
      felt: felt,
      inner: inner,
      region: region,
      hud: hud,
      hand: { y: handY, scale: handScale, maxPitch: 44, avail: handAvail, left: handLeft },
      meldBand: meldBand,
      // 自己的副露靠在操作栏左边、手牌上方
      playerMeld: {
        y: handY - halfH - 26,
        scale: 0.22,
        right: rightEdge,
        maxWidth: Math.max(150, Math.round((controlsLeft - safe.left) * 0.34)),
      },
      oppScale: oppScale,
      oppPitch: oppPitch,
      deadScale: deadScale,
      corner: {
        1: { x: inner.x + inner.w, y: inner.y + 18, align: 'right' },
        2: { x: inner.x, y: inner.y + 18, align: 'left' },
        3: { x: inner.x, y: inner.y + inner.h - 18, align: 'left', growUp: true },
      },
      oppMeld: {
        1: { scale: 0.17, maxWidth: 200 },
        2: { scale: 0.17, maxWidth: 180 },
        3: { scale: 0.17, maxWidth: 120 },
      },
      seats: {
        0: { originX: table.cx - (cols - 1) * dead.w / 2, originY: region.y + region.h - dead.h / 2, stepX: dead.w, stepY: -dead.h, rotation: 0 },
        2: { originX: left + (cols - 1) * dead.w, originY: region.y + dead.h / 2 + upDeadDrop, stepX: -dead.w, stepY: dead.h, rotation: Math.PI },
        3: { originX: region.x + (dead.h + 4) / 2, originY: sideTop, stepX: dead.h + 4, stepY: dead.w, rotation: Math.PI / 2 },
        1: { originX: region.x + region.w - (dead.h + 4) / 2, originY: sideTop, stepX: -(dead.h + 4), stepY: dead.w, rotation: -Math.PI / 2 },
      },
      cols: cols,
      opp: {
        2: { from: 'x', y: inner.y - band2 / 2, pitch: oppPitch, center: table.cx },
        3: { from: 'y', x: inner.x - band2 / 2, pitch: oppPitch, center: table.cy },
        1: { from: 'y', x: inner.x + inner.w + band2 / 2, pitch: oppPitch, center: table.cy },
      },
      actions: { mode: 'col', x: controlsX, y: safe.top + 146, w: 104, h: 52, gap: 12 },
      status: { x: controlsX, y: HEIGHT * 0.7, wrap: rightCol - 14 },
      hint: { x: controlsX, y: HEIGHT * 0.78, wrap: rightCol - 14 },
      wallChip: { x: controlsX - 16, y: safe.top + 72 },
      roundChip: { x: controlsX, y: safe.top + 104 },
    };
  }

  class MahjongScene extends Phaser.Scene {
    constructor() { super('MahjongScene'); }

    create() {
      const view = window.MahjongView;
      WIDTH = Math.round(view && view.w ? view.w : this.scale.width);
      HEIGHT = Math.round(view && view.h ? view.h : this.scale.height);
      IS_PORTRAIT = HEIGHT >= WIDTH;
      SAFE = (view && view.safe) || { top: 0, right: 0, bottom: 0, left: 0 };
      HUD_INSET = (view && view.hudInset) || 78;
      ART.build(this, WIDTH, HEIGHT);
      this.L = computeLayout();
      this.random = Math.random;
      this.timers = [];
      this.tileSprites = [];
      this.marks = [];
      this.oppMeldSprites = [];
      this.uiObjects = [];
      this.lastDiscardSeat = -1;
      this.actionButtons = [];
      this.bannerObjects = [];
      this.selected = -1;
      this.hintText = '';
      this.actions = [];
      this.pendingClaim = null;
      this.revealAll = false;
      this.state = 'idle';
      this.handIndex = 0;
      this.turn = 0;

      this.drawBackdrop();
      this.add.image(this.L.table.cx, this.L.table.cy, 'mj-table')
        .setDisplaySize(this.L.table.size, this.L.table.size).setDepth(2);
      this.drawTableDecor();
      this.tileLayer = this.add.container(0, 0).setDepth(10);
      this.uiLayer = this.add.container(0, 0).setDepth(40);
      this.buildHud();
      this.bindInput();
      this.startHand();
    }

    drawBackdrop() {
      // 背景贴图按画布尺寸烘焙，顶部/底部的渐隐在贴图里，不会出现硬边
      this.add.image(WIDTH / 2, HEIGHT / 2, 'mj-room').setDisplaySize(WIDTH, HEIGHT).setDepth(0);
    }

    drawTableDecor() {
      const g = this.add.graphics().setDepth(3);
      const t = this.L.table;
      const x = t.cx - t.size / 2;
      const y = t.cy - t.size / 2;
      g.lineStyle(2, 0xffe6b0, 0.16).strokeRoundedRect(x + 3, y + 3, t.size - 6, t.size - 6, t.size * 0.045);
      g.lineStyle(1, 0xffcf85, 0.12).strokeRoundedRect(x + t.size * 0.028, y + t.size * 0.028, t.size * 0.944, t.size * 0.944, t.size * 0.042);
    }

    buildHud() {
      const hud = this.L.hud;
      // 竖屏标题贴左上角，横屏没有左侧余量，标题居中压在手牌上方的横带上
      const hudOriginX = IS_PORTRAIT ? 0 : 0.5;
      this.uiLayer.add(text(this, hud.titleX, hud.titleY, '广东麻将', IS_PORTRAIT ? 26 : 24, '#f7e6c4', {
        bold: true, originX: hudOriginX, stroke: '#2a1408', strokeThickness: 4,
      }));
      this.uiLayer.add(text(this, hud.titleX, hud.subY, '不吃 · 只能碰杠 · 自摸或胡别人', IS_PORTRAIT ? 12 : 11, '#c8b494', {
        originX: hudOriginX,
      }));
      const btnW = hud.pillW;
      const btnH = hud.pillH;
      const gap = 8;
      const mkPill = (label, index, onClick) => {
        const x = hud.pillRight - btnW / 2 - index * (btnW + gap);
        return addButton(this, x, hud.pillY + btnH / 2, btnW, btnH, label, onClick, {
          color: 0x4a3568, base: 0x2c1f42, fontSize: 13, depth: 70, textColor: '#f0e2ff',
        });
      };
      this.soundPill = mkPill('音量', 0, () => this.toggleSound());
      this.uiLayer.add(this.soundPill);
      this.uiLayer.add(mkPill('重开', 1, () => { this.startHand(); }));

      this.wallText = text(this, this.L.wallChip.x + (IS_PORTRAIT ? 16 : 0), this.L.wallChip.y, '', IS_PORTRAIT ? 15 : 14, '#f3e3bf', {
        bold: true, originX: IS_PORTRAIT ? 0 : 0.5, originY: 0.5, stroke: '#1b1024', strokeThickness: 3,
      });
      this.roundText = text(this, this.L.roundChip.x, this.L.roundChip.y, '', 11, '#c9b696', { originX: 0.5, originY: 0.5 });
      // 局数/风向那行小字垫一块牌匾，细字也看得清
      this.roundBadge = this.add.graphics();
      this.uiLayer.addAt(this.roundBadge, 0);
      this.uiLayer.add(this.wallText);
      this.uiLayer.add(this.roundText);

      this.statusText = text(this, this.L.status.x, this.L.status.y, '', IS_PORTRAIT ? 17 : 14, '#f6e8cc', {
        bold: true, originX: 0.5, originY: 0.5, wrap: this.L.status.wrap, stroke: '#1b1024', strokeThickness: 4,
      });
      this.uiLayer.add(this.statusText);
      this.hintLabel = text(this, this.L.hint.x, this.L.hint.y, '', IS_PORTRAIT ? 15 : 12, '#ffd9a0', {
        originX: 0.5, originY: 0.5, wrap: this.L.hint.wrap, stroke: '#1b1024', strokeThickness: 3,
      });
      this.uiLayer.add(this.hintLabel);
      this.drawRoundBadge();
    }

    // 牌匾按文字实际宽度绘制，换局后文字变长也不会溢出
    drawRoundBadge() {
      if (!this.roundBadge || !this.roundText) return;
      const w = Math.max(112, this.roundText.width + 22);
      const h = 21;
      // 文字变长时把牌匾夹在屏幕内，别贴到边上
      const x = clamp(this.L.roundChip.x, w / 2 + 8 + SAFE.left, WIDTH - w / 2 - 8 - SAFE.right);
      const y = this.L.roundChip.y;
      this.roundText.setPosition(x, y);
      this.roundBadge.clear();
      this.roundBadge.fillStyle(0x140c24, 0.4).fillRoundedRect(x - w / 2, y - h / 2, w, h, 11);
      this.roundBadge.lineStyle(1, 0xffd89a, 0.14).strokeRoundedRect(x - w / 2 + 0.5, y - h / 2 + 0.5, w - 1, h - 1, 11);
    }

    toggleSound() {
      const enabled = SFX.toggle();
      this.soundPill.buttonText.setText(enabled ? '音量' : '静音');
      if (enabled) SFX.pass();
    }

    bindInput() {
      this.input.on('pointerdown', (pointer) => {
        SFX.start();
        this.handleTap(pointer.x, pointer.y);
      });
    }

    // ---------------- 一局流程 ----------------
    later(delay, fn) {
      const timer = this.time.delayedCall(delay, () => {
        const at = this.timers.indexOf(timer);
        if (at >= 0) this.timers.splice(at, 1);
        fn();
      });
      this.timers.push(timer);
      return timer;
    }

    clearTimers() {
      this.timers.forEach((timer) => timer.remove());
      this.timers = [];
    }

    startHand() {
      this.clearTimers();
      this.handIndex += 1;
      this.state = 'playing';
      this.revealAll = false;
      this.selected = -1;
      this.pendingClaim = null;
      this.actions = [];
      this.hintText = '';
      this.result = null;
      this.drawnThisTurn = false;
      this.lastDiscardSeat = -1;
      this.bannerObjects.forEach((item) => item.destroy());
      this.bannerObjects = [];

      this.wall = RULES.createWall(this.random);
      this.seats = [0, 1, 2, 3].map((seat) => ({
        seat: seat, hand: [], melds: [], discards: [], drawnIndex: -1,
      }));
      const dealer = (this.handIndex - 1) % 4;
      this.dealer = dealer;
      for (let round = 0; round < 3; round += 1) {
        for (let step = 0; step < 4; step += 1) {
          const seat = (dealer + step) % 4;
          for (let k = 0; k < 4; k += 1) this.seats[seat].hand.push(this.wall.pop());
        }
      }
      for (let step = 0; step < 4; step += 1) {
        const seat = (dealer + step) % 4;
        this.seats[seat].hand.push(this.wall.pop());
      }
      this.sortHand(0);
      this.turn = dealer;
      SFX.deal();
      this.renderAll();
      this.later(520, () => this.beginTurn());
    }

    sortHand(seat) {
      const hand = this.seats[seat].hand;
      hand.sort((a, b) => a - b);
      return hand;
    }

    beginTurn() {
      if (this.state !== 'playing') return;
      const seat = this.turn;
      if (!this.wall.length) return this.finishHand({ type: 'liuju' });
      this.drawTile(seat);
      this.renderAll();
      if (seat === 0) {
        SFX.turn();
        this.playerPhase(true);
      } else {
        this.later(IS_PORTRAIT ? 520 : 440, () => this.botPhase(seat, true));
      }
    }

    drawTile(seat) {
      const tile = this.wall.pop();
      const state = this.seats[seat];
      state.hand.push(tile);
      if (seat === 0) {
        this.sortHand(0);
        let drawn = -1;
        for (let i = 0; i < state.hand.length; i += 1) if (state.hand[i] === tile) drawn = i;
        state.drawnIndex = drawn;
        this.drawnThisTurn = true;
        SFX.draw();
      } else {
        state.drawnIndex = -1;
      }
      return tile;
    }

    // ---------------- 玩家操作 ----------------
    playerPhase(canWin) {
      if (this.state !== 'playing' || this.turn !== 0) return;
      const state = this.seats[0];
      const counts = RULES.countsOf(state.hand);
      const melds = state.melds.length;
      const list = [];
      if (canWin && this.drawnThisTurn && RULES.isWinning(counts, melds)) list.push({ id: 'tsumo', label: '自摸' });
      RULES.concealedKongs(counts).forEach((tile) => list.push({ id: 'ankong', label: '暗杠', tile: tile }));
      RULES.addedKongs(counts, state.melds).forEach((tile) => list.push({ id: 'addkong', label: '补杠', tile: tile }));
      this.actions = list;
      this.hintText = '';
      this.renderAll();
    }

    handleTap(x, y) {
      if (this.state !== 'playing') return;
      if (this.pendingClaim) return;
      if (this.turn !== 0) return;
      const state = this.seats[0];
      const count = state.hand.length;
      if (!count) return;
      const metrics = this.handMetrics();
      const half = TILE.faceH * this.L.hand.scale / 2;
      const top = this.L.hand.y - half - 24;
      const bottom = this.L.hand.y + half + 14;
      const leftEdge = metrics.startX - TILE.faceW * this.L.hand.scale / 2 - 10;
      const rightEdge = metrics.startX + metrics.pitch * (count - 1) + TILE.faceW * this.L.hand.scale / 2 + 10;
      if (y < top || y > bottom || x < leftEdge || x > rightEdge) {
        if (this.selected >= 0) { this.selected = -1; this.renderAll(); }
        return;
      }
      const index = clamp(Math.round((x - metrics.startX) / Math.max(1, metrics.pitch)), 0, count - 1);
      if (this.selected === index) this.playerDiscard(index);
      else { this.selected = index; this.renderAll(); }
    }

    handMetrics() {
      const count = this.seats[0].hand.length;
      const scale = this.L.hand.scale;
      const w = TILE.faceW * scale;
      const avail = this.L.hand.avail;
      const pitch = count > 1 ? Math.min(this.L.hand.maxPitch, (avail - w) / (count - 1)) : 0;
      const total = w + pitch * Math.max(0, count - 1);
      const startX = this.L.hand.left + (avail - total) / 2 + w / 2;
      return { w: w, pitch: pitch, startX: startX, total: total, count: count };
    }

    playerDiscard(index) {
      if (this.state !== 'playing' || this.turn !== 0 || this.pendingClaim) return;
      const state = this.seats[0];
      if (index < 0 || index >= state.hand.length) return;
      const tile = state.hand.splice(index, 1)[0];
      state.drawnIndex = -1;
      state.discards.push(tile);
      this.lastDiscardSeat = 0;
      this.selected = -1;
      this.actions = [];
      this.drawnThisTurn = false;
      SFX.discard();
      this.renderAll();
      this.afterDiscard(0, tile);
    }

    playerKong(tile, kind) {
      const state = this.seats[0];
      if (kind === 'ankong') {
        for (let i = 0; i < 4; i += 1) state.hand.splice(state.hand.indexOf(tile), 1);
        state.melds.push({ type: 'kong', tile: tile, from: 0, concealed: true });
      } else {
        state.hand.splice(state.hand.indexOf(tile), 1);
        const meld = state.melds.find((item) => item.type === 'pong' && item.tile === tile);
        if (meld) meld.type = 'kong';
      }
      this.actions = [];
      this.selected = -1;
      SFX.kong();
      this.showBanner('杠', 0, '#ffc24d');
      this.sortHand(0);
      if (!this.wall.length) return this.finishHand({ type: 'liuju' });
      this.drawTile(0);
      state.drawnIndex = -1;
      this.renderAll();
      this.later(380, () => this.playerPhase(true));
    }

    resolveClaim(id) {
      const claim = this.pendingClaim;
      if (!claim) return;
      this.pendingClaim = null;
      this.actions = [];
      if (id === 'pass') {
        SFX.pass();
        this.renderAll();
        this.advanceTurn(claim.from);
        return;
      }
      if (id === 'hu') {
        return this.finishHand({ type: 'win', winner: 0, tile: claim.tile, from: claim.from, tsumo: false });
      }
      this.executeMeld(0, id, claim.tile, claim.from);
    }

    // ---------------- 电脑回合 ----------------
    botPhase(seat, canWin) {
      if (this.state !== 'playing') return;
      const state = this.seats[seat];
      const counts = RULES.countsOf(state.hand);
      const melds = state.melds.length;
      if (canWin && RULES.isWinning(counts, melds)) {
        return this.finishHand({ type: 'win', winner: seat, tsumo: true, tile: state.hand[state.hand.length - 1] });
      }
      const an = RULES.concealedKongs(counts);
      const add = RULES.addedKongs(counts, state.melds);
      if (an.length && this.random() < 0.85) return this.botKong(seat, an[0], 'ankong');
      if (add.length && this.random() < 0.9) return this.botKong(seat, add[0], 'addkong');
      const pick = RULES.chooseDiscard(counts.slice(), melds, this.random);
      if (pick < 0) return this.advanceTurn(seat);
      state.hand.splice(state.hand.indexOf(pick), 1);
      state.discards.push(pick);
      this.lastDiscardSeat = seat;
      state.drawnIndex = -1;
      SFX.discard();
      this.renderAll();
      this.later(IS_PORTRAIT ? 240 : 200, () => this.afterDiscard(seat, pick));
    }

    botKong(seat, tile, kind) {
      const state = this.seats[seat];
      if (kind === 'ankong') {
        for (let i = 0; i < 4; i += 1) state.hand.splice(state.hand.indexOf(tile), 1);
        state.melds.push({ type: 'kong', tile: tile, from: seat, concealed: true });
      } else {
        state.hand.splice(state.hand.indexOf(tile), 1);
        const meld = state.melds.find((item) => item.type === 'pong' && item.tile === tile);
        if (meld) meld.type = 'kong';
      }
      SFX.kong();
      this.showBanner('杠', seat, '#ffc24d');
      this.renderAll();
      this.later(480, () => {
        if (this.state !== 'playing') return;
        if (!this.wall.length) return this.finishHand({ type: 'liuju' });
        this.drawTile(seat);
        this.renderAll();
        this.later(420, () => this.botPhase(seat, true));
      });
    }

    // ---------------- 出牌后的响应 ----------------
    afterDiscard(from, tile) {
      if (this.state !== 'playing') return;
      const winners = [];
      let meldSeat = -1;
      let meldType = null;
      for (let offset = 1; offset <= 3; offset += 1) {
        const seat = (from + offset) % 4;
        const state = this.seats[seat];
        const counts = RULES.countsOf(state.hand);
        const melds = state.melds.length;
        const probe = counts.slice();
        probe[tile] += 1;
        if (RULES.isWinning(probe, melds)) winners.push(seat);
        if (meldSeat < 0) {
          if (counts[tile] >= 3 && RULES.shouldKong(counts.slice(), melds, tile, this.random)) {
            meldSeat = seat; meldType = 'kong';
          } else if (counts[tile] >= 2 && RULES.shouldPong(counts.slice(), melds, tile, this.random)) {
            meldSeat = seat; meldType = 'pong';
          }
        }
      }

      if (winners.length) {
        const winner = winners[0];
        if (winner === 0) {
          this.pendingClaim = { kind: 'win', tile: tile, from: from, options: [{ id: 'hu', label: '胡' }, { id: 'pass', label: '过' }] };
          this.renderAll();
          return;
        }
        return this.finishHand({ type: 'win', winner: winner, tile: tile, from: from, tsumo: false });
      }

      if (meldSeat === 0) {
        const counts = RULES.countsOf(this.seats[0].hand);
        const options = [];
        if (counts[tile] >= 3) options.push({ id: 'kong', label: '杠' });
        if (counts[tile] >= 2) options.push({ id: 'pong', label: '碰' });
        if (options.length) {
          this.pendingClaim = { kind: 'meld', tile: tile, from: from, options: options.concat([{ id: 'pass', label: '过' }]) };
          this.renderAll();
          return;
        }
      }

      if (meldSeat > 0) return this.executeMeld(meldSeat, meldType, tile, from);

      if (from === 0) this.updateTenpaiHint();
      this.advanceTurn(from);
    }

    updateTenpaiHint() {
      const state = this.seats[0];
      const counts = RULES.countsOf(state.hand);
      const melds = state.melds.length;
      if (RULES.shanten(counts, melds) === 0) {
        const waits = RULES.waitingTiles(counts, melds);
        this.hintText = waits.length ? '听 ' + waits.map((code) => RULES.tileName(code)).join(' ') : '';
      } else {
        this.hintText = '';
      }
    }

    executeMeld(seat, type, tile, from) {
      const state = this.seats[seat];
      const need = type === 'kong' ? 3 : 2;
      for (let i = 0; i < need; i += 1) {
        const at = state.hand.indexOf(tile);
        if (at >= 0) state.hand.splice(at, 1);
      }
      state.melds.push({ type: type, tile: tile, from: from });
      this.removeDiscard(from, tile);
      this.lastDiscardSeat = -1;
      SFX[type === 'kong' ? 'kong' : 'pong']();
      this.showBanner(type === 'kong' ? '杠' : '碰', seat, type === 'kong' ? '#ffc24d' : '#a8dcff');
      this.turn = seat;
      this.updateTenpaiHint();
      if (seat === 0) this.sortHand(0);
      this.renderAll();
      if (type === 'kong') {
        this.later(460, () => {
          if (this.state !== 'playing') return;
          if (!this.wall.length) return this.finishHand({ type: 'liuju' });
          this.drawTile(seat);
          this.renderAll();
          this.later(400, () => this.afterMeldTurn(seat, true));
        });
      } else {
        this.later(IS_PORTRAIT ? 520 : 460, () => this.afterMeldTurn(seat, false));
      }
    }

    afterMeldTurn(seat, canWin) {
      if (this.state !== 'playing') return;
      if (seat === 0) this.playerPhase(canWin);
      else this.botPhase(seat, canWin);
    }

    removeDiscard(seat, tile) {
      const list = this.seats[seat].discards;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i] === tile) { list.splice(i, 1); return; }
      }
    }

    advanceTurn(from) {
      if (this.state !== 'playing') return;
      this.turn = (from + 1) % 4;
      this.renderAll();
      this.later(IS_PORTRAIT ? 280 : 240, () => this.beginTurn());
    }

    // ---------------- 结算 ----------------
    finishHand(result) {
      if (this.state !== 'playing') return;
      this.state = 'over';
      if (result.type === 'win' && !result.tsumo) {
        // 胡别人打出的牌：把这张牌并入赢家手牌，并从弃牌堆移除，保证亮牌完整、牌数守恒。
        this.removeDiscard(result.from, result.tile);
        const winner = this.seats[result.winner];
        winner.hand.push(result.tile);
        winner.drawnIndex = -1;
        this.sortHand(result.winner);
      }
      this.result = result;
      this.revealAll = true;
      this.actions = [];
      this.pendingClaim = null;
      this.selected = -1;
      this.hintText = '';
      if (result.type === 'win') SFX.win(); else SFX.lose();
      this.renderAll();
      const isWin = result.type === 'win';
      const title = isWin ? (result.tsumo ? '自摸' : '胡牌') : '流局';
      let detail = '牌墙摸完了，马上开下一局';
      if (isWin) {
        const winnerName = SEAT_NAME[result.winner];
        if (result.tsumo) detail = winnerName + '自摸 · ' + RULES.tileName(result.tile);
        else detail = winnerName + '胡了' + SEAT_NAME[result.from] + '打出的 ' + RULES.tileName(result.tile);
        if (result.winner === 0) detail = result.tsumo ? '你自摸胡了！' : '你胡了 ' + SEAT_NAME[result.from] + ' 打出的 ' + RULES.tileName(result.tile) + '！';
      }
      this.showResultPanel(title, detail, result);
      this.later(6500, () => { if (this.state === 'over') this.startHand(); });
    }

    showResultPanel(title, detail, result) {
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      const w = IS_PORTRAIT ? 340 : 420;
      const h = IS_PORTRAIT ? 210 : 180;
      const shade = this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x08040f, 0.5).setDepth(90).setInteractive();
      shade.setAlpha(0);

      const panel = addPanel(this, cx, cy, w, h, 0x2b1d40, 0.985, 20).setDepth(92);
      // 顶部反光 + 双层金线 + 标题下的分隔线
      panel.fillStyle(0xffffff, 0.05).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.42, 16);
      panel.lineStyle(2.4, 0xd9a441, 0.72).strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 17);
      panel.lineStyle(1, 0xffe6b0, 0.26).strokeRoundedRect(-w / 2 + 8.5, -h / 2 + 8.5, w - 17, h - 17, 13);
      panel.lineStyle(1, 0xffd98a, 0.32).lineBetween(-w * 0.3, -h / 2 + 58, w * 0.3, -h / 2 + 58);

      const titleText = text(this, cx, cy - h / 2 + 34, title, IS_PORTRAIT ? 30 : 28, '#ffd98a', {
        bold: true, originX: 0.5, originY: 0.5, stroke: '#3a1c07', strokeThickness: 4,
      }).setDepth(94);
      const detailText = text(this, cx, cy - 6, detail, IS_PORTRAIT ? 14 : 13, '#f0e2c8', {
        originX: 0.5, originY: 0.5, align: 'center', wrap: w - 44,
      }).setDepth(94);
      const button = addButton(this, cx, cy + h / 2 - 40, 150, 44, '下一局', () => this.startHand(), {
        color: 0xd08a3c, base: 0x7d4d1c, fontSize: 17, depth: 96, textColor: '#fff6e4',
      });
      shade.on('pointerdown', () => this.startHand());

      // 弹出：面板从略小放大到原尺寸
      panel.setScale(0.88);
      button.setScale(0.88);
      titleText.setAlpha(0);
      detailText.setAlpha(0);
      this.tweens.add({ targets: shade, alpha: 0.5, duration: 200 });
      this.tweens.add({ targets: [panel, button], scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [titleText, detailText], alpha: 1, duration: 260, delay: 90 });
      this.bannerObjects.push(shade, panel, titleText, detailText, button);
    }

    showBanner(label, seat, tint) {
      const position = this.bannerPosition(seat);
      const item = text(this, position.x, position.y, label, IS_PORTRAIT ? 40 : 34, tint || '#ffd479', {
        bold: true, originX: 0.5, originY: 0.5, stroke: '#3f1c0a', strokeThickness: 7,
      }).setDepth(80);
      item.setScale(0.5);
      this.bannerObjects.push(item);
      this.tweens.add({ targets: item, scale: 1.05, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: item, alpha: 0, y: position.y - 30, delay: 560, duration: 420, onComplete: () => item.destroy() });
    }

    bannerPosition(seat) {
      const table = this.L.table;
      if (seat === 0) return { x: table.cx, y: this.L.hand.y - 74 };
      if (seat === 1) return { x: this.L.inner.x + this.L.inner.w - 62, y: table.cy - 70 };
      if (seat === 2) return { x: table.cx, y: this.L.inner.y + 76 };
      return { x: this.L.inner.x + 62, y: table.cy - 70 };
    }

    // ---------------- 渲染 ----------------
    clearTiles() {
      this.tileSprites.forEach((sprite) => sprite.destroy());
      this.tileSprites = [];
      this.marks.forEach((mark) => mark.destroy());
      this.marks = [];
      this.oppMeldSprites.forEach((sprite) => sprite.destroy());
      this.oppMeldSprites = [];
    }

    makeTile(code, x, y, scale, rotation, layer) {
      return this.makeTileKey(code < 0 ? ART.backKey : ART.faceKey(code), x, y, scale, rotation, layer);
    }

    makeTileKey(key, x, y, scale, rotation, layer) {
      // 注意：Phaser 的 Container 没有 create()，牌必须由工厂创建后再 add 进去。
      const target = layer || this.tileLayer;
      const sprite = this.add.image(0, 0, key);
      if (target && typeof target.add === 'function') target.add(sprite);
      ART.place(sprite, x, y, scale);
      if (rotation) sprite.setRotation(rotation);
      this.tileSprites.push(sprite);
      return sprite;
    }

    discardSlot(seat, index) {
      const layout = this.L.seats[seat];
      const row = Math.floor(index / this.L.cols);
      const col = index % this.L.cols;
      return {
        x: layout.originX + layout.stepX * (seat === 0 || seat === 2 ? col : row),
        y: layout.originY + layout.stepY * (seat === 0 || seat === 2 ? row : col),
        rotation: layout.rotation,
      };
    }

    renderAll() {
      if (!this.tileSprites) return;
      this.clearTiles();
      this.renderOpponents();
      this.renderMelds();
      this.renderDiscards();
      this.renderPlayerHand();
      this.renderActions();
      this.renderStatus();
      this.renderWallChip();
    }
    renderOpponents() {
      const scale = this.L.oppScale;
      for (const seat of [1, 2, 3]) {
        const state = this.seats[seat];
        const layout = this.L.opp[seat];
        const count = state.hand.length;
        const pitch = layout.pitch;
        const total = pitch * (count - 1);
        const rotation = seat === 1 ? -Math.PI / 2 : (seat === 2 ? Math.PI : Math.PI / 2);
        for (let i = 0; i < count; i += 1) {
          const offset = i * pitch - total / 2;
          const x = layout.from === 'x' ? layout.center + offset : layout.x;
          const y = layout.from === 'x' ? layout.y : layout.center + offset;
          const key = this.revealAll ? ART.faceKey(state.hand[i]) : ART.backKey;
          this.makeTileKey(key, x, y, scale, rotation);
        }
      }
    }

    // 副露按行排布，超出宽度自动折行
    drawMeldRow(melds, anchorX, anchorY, scale, align, maxWidth, growUp) {
      const step = TILE.faceW * scale + 1;
      const gap = 7;
      const rows = [];
      let row = [];
      let rowWidth = 0;
      melds.forEach((meld) => {
        const width = (meld.type === 'kong' ? 4 : 3) * step;
        if (row.length && rowWidth + width > maxWidth) {
          rows.push({ melds: row, width: rowWidth });
          row = []; rowWidth = 0;
        }
        row.push(meld);
        rowWidth += width + gap;
      });
      if (row.length) rows.push({ melds: row, width: rowWidth });
      rows.forEach((entry, rowIndex) => {
        const rowStep = TILE.faceH * scale + 8;
        const y = growUp ? anchorY - (rows.length - 1 - rowIndex) * rowStep : anchorY + rowIndex * rowStep;
        let x = align === 'right' ? anchorX - entry.width + gap : anchorX;
        entry.melds.forEach((meld) => {
          const count = meld.type === 'kong' ? 4 : 3;
          for (let i = 0; i < count; i += 1) {
            const concealed = meld.concealed && (i === 1 || i === 2);
            const key = concealed ? ART.backKey : ART.faceKey(meld.tile);
            this.makeTileKey(key, x + i * step + step / 2, y, scale, 0);
          }
          x += count * step + gap;
        });
      });
    }

    renderMelds() {
      const playerMelds = this.seats[0].melds;
      if (playerMelds.length) {
        const cfg = this.L.playerMeld;
        // 副露多时往上叠，别顶到手牌或掉出牌桌
        this.drawMeldRow(playerMelds, cfg.right, cfg.y, cfg.scale, 'right', cfg.maxWidth || 400, true);
      }
      for (const seat of [1, 2, 3]) {
        const melds = this.seats[seat].melds;
        if (!melds.length) continue;
        const anchor = this.L.corner[seat];
        const cfg = this.L.oppMeld[seat];
        this.drawMeldRow(melds, anchor.x, anchor.y, cfg.scale, anchor.align, cfg.maxWidth, anchor.growUp);
      }
    }

    renderDiscards() {
      for (let seat = 0; seat < 4; seat += 1) {
        const list = this.seats[seat].discards;
        const base = this.L.deadScale;
        const scale = list.length > 24 ? base * Math.sqrt(24 / list.length) : base;
        for (let i = 0; i < list.length; i += 1) {
          const slot = this.discardSlot(seat, i);
          const jitter = (hashRand(seat * 131 + i * 17) - 0.5) * 0.12;
          const dx = (hashRand(seat * 977 + i * 7.3) - 0.5) * 2.6;
          const dy = (hashRand(seat * 313 + i * 3.1) - 0.5) * 2.6;
          const isLast = seat === this.lastDiscardSeat && i === list.length - 1;
          if (isLast) {
            const glow = this.add.graphics().setDepth(6);
            glow.fillStyle(0xffd479, 0.34).fillRoundedRect(
              slot.x - TILE.faceW * scale / 2 - 4, slot.y - TILE.faceH * scale / 2 - 4,
              TILE.faceW * scale + 8, TILE.faceH * scale + 8, 7
            );
            this.marks.push(glow);
          }
          this.makeTile(list[i], slot.x + dx, slot.y + dy, scale, slot.rotation + jitter);
        }
      }
    }

    renderPlayerHand() {
      const state = this.seats[0];
      const metrics = this.handMetrics();
      const scale = this.L.hand.scale;
      const half = TILE.faceH * scale / 2;
      for (let i = 0; i < state.hand.length; i += 1) {
        const lifted = i === this.selected;
        const x = metrics.startX + i * metrics.pitch;
        const y = this.L.hand.y - (lifted ? 18 : 0);
        if (lifted) {
          // 选中的牌下面托一层金光，抬起来更明显
          const glow = this.add.graphics().setDepth(6);
          glow.fillStyle(0xffd479, 0.26).fillRoundedRect(x - TILE.faceW * scale / 2 - 3, y - half - 3, TILE.faceW * scale + 6, TILE.faceH * scale + 6, 7);
          this.marks.push(glow);
        }
        this.makeTile(state.hand[i], x, y, scale, 0);
        if (this.drawnThisTurn && i === state.drawnIndex) {
          const dot = this.add.graphics().setDepth(6);
          dot.fillStyle(0xffd479, 0.9).fillCircle(x, y - half - 9, 3.6);
          this.marks.push(dot);
        }
      }
    }

    renderActions() {
      this.actionButtons.forEach((button) => button.destroy());
      this.actionButtons = [];
      const options = this.pendingClaim ? this.pendingClaim.options : this.actions;
      if (!options.length) return;
      const layout = this.L.actions;
      const total = options.length * layout.w + (options.length - 1) * layout.gap;
      options.forEach((option, index) => {
        const style = this.actionStyle(option.id);
        const x = layout.mode === 'row'
          ? layout.x - total / 2 + layout.w / 2 + index * (layout.w + layout.gap)
          : layout.x;
        const y = layout.mode === 'row'
          ? layout.y
          : layout.y + index * (layout.h + layout.gap) + layout.h / 2;
        const button = addButton(this, x, y, layout.w, layout.h, option.label, () => this.onAction(option), {
          color: style.color, base: style.base, textColor: style.textColor,
          fontSize: option.label.length > 1 ? 15 : 19, depth: 62,
        });
        this.actionButtons.push(button);
      });
    }

    actionStyle(id) {
      if (id === 'hu' || id === 'tsumo') return { color: 0xe0a13a, base: 0x8a5a12, textColor: '#fff8e6' };
      if (id === 'kong') return { color: 0x8a5ec4, base: 0x53317e, textColor: '#f6ecff' };
      if (id === 'pong') return { color: 0x3f8cc9, base: 0x235579, textColor: '#eef8ff' };
      return { color: 0x5a4a68, base: 0x33283e, textColor: '#e2d6ee' };
    }

    onAction(option) {
      if (this.pendingClaim) return this.resolveClaim(option.id);
      const hand = this.seats[0].hand;
      if (option.id === 'tsumo') {
        return this.finishHand({ type: 'win', winner: 0, tsumo: true, tile: hand[hand.length - 1] });
      }
      if (option.id === 'ankong') return this.playerKong(option.tile, 'ankong');
      if (option.id === 'addkong') return this.playerKong(option.tile, 'addkong');
    }

    renderStatus() {
      let status = '';
      if (this.state === 'playing') {
        if (this.pendingClaim) status = this.pendingClaim.kind === 'win' ? '这张牌可以胡' : '可以碰 / 杠这张牌';
        else if (this.turn === 0) status = '轮到你出牌 · 点两次打出';
        else status = SEAT_NAME[this.turn] + ' 出牌中…';
      } else if (this.result) {
        status = '';
      }
      this.statusText.setText(status);
      this.hintLabel.setText(this.hintText || '');
    }

    renderWallChip() {
      const chip = this.L.wallChip;
      this.wallText.setText('牌墙 ' + this.wall.length);
      const windOfSeat = WIND_NAME[((0 - this.dealer) + 4) % 4];
      const windNow = WIND_NAME[((this.turn - this.dealer) + 4) % 4];
      this.roundText.setText('第 ' + this.handIndex + ' 局 · 你坐' + windOfSeat + ' · 轮到' + windNow);
      this.drawRoundBadge();
      this.makeTile(-1, chip.x - 68, chip.y, 0.2, Math.PI / 2);
      this.makeTile(-1, chip.x - 40, chip.y, 0.2, Math.PI / 2);
    }
  }

  window.MahjongScene = MahjongScene;
})();