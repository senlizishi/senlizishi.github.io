/*
 * 会动的画：竖屏（540x960）自由画画小玩具。小孩在纸上随便画一团，
 * 点「变活啦！」那团东西本身就会变成一只活的小家伙：自动长出眼睛、嘴巴、小手小脚，
 * 从画纸蹦到草地上，跟着手指走、眨眼睛、摆腿；点它一下它会蹦起来吭一声。
 * 完全自由：没有分数、没有时间、没有对错、没有失败、没有存档，刷新即重置。
 * 画面全部 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，不加载任何素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const PAPER = { x: 40, y: 86, w: 460, h: 546 };
  const GROUND_Y = 770;              // 草地地面线（小家伙的脚踩在这条线上）
  const LIFE_H = 240;                // 变活后小家伙的目标高度
  const LIFE_W_MAX = 300;
  const SCALE_MIN = 0.35;
  const SCALE_MAX = 3;
  const MIN_DOODLE = 24;             // 包围盒短边小于这个就当「还没画东西」

  const WALK_SPEED = 150;            // 跟手指走的最高速度 px/s
  const IDLE_SLOP = 6;
  const WALK_X0 = 40;
  const WALK_X1 = 500;

  const TAP_MS = 260;                // 这么快松手才算「点」
  const TAP_SLOP = 16;               // 位移小于这个才算「点」
  const TAP_PAD = 20;                // 身体包围盒外扩这么多也算点到了

  const MAX_STROKES = 24;            // 一张画最多这么多笔
  const MAX_PTS_PER_STROKE = 300;    // 一笔最多这么多采样点

  const HOP_MS = 500;
  const HOP_H = 100;

  const DAB_MIN_STEP = 2;            // 圆点盖章的最小间距
  const DAB_STEP_RATIO = 0.4;        // 间距 = 笔宽 * 这个

  const SCRATCH_MS = 45;             // 画线沙沙声的节流
  const ALIVE_HINT_MS = 6000;

  const COLORS = [0xF4623A, 0xFFC93D, 0x5FC36B, 0x4FB3E8, 0xB57BE8, 0xFF7FB0];
  const DEFAULT_COLOR = 0;           // 默认第 1 支「橘红」
  const SIZES = [6, 13, 22];
  const DEFAULT_SIZE = 1;

  const C = {
    deskA: 0xF7E6CB, deskB: 0xEAD3AE,
    paper: 0xFFFDF8, paperDot: 0xEFE7D6, paperEdge: 0xE3D6BC,
    skyA: 0xBCE7FF, skyB: 0xEBF8FF,
    sun: 0xFFD95E, sunGlow: 0xFFF3BE,
    hill: 0x8FD36A, hill2: 0x7BC757,
    grass: 0x9FDD78, grassDark: 0x7FC85A,
    flowers: [0xFF8FB8, 0xFFC93D, 0xB98BE8, 0xFFF2F6],
    ink: 0x4A4640,
    shadow: 0x33562A,
    life: 0xFF9E3D, lifeDark: 0xDE7A20,
    pill: 0xFFFFFF, pillLine: 0xC9BFA8,
    selRing: 0x5B6472,
    paperHint: '#B3AA96',
    btnTextDark: '#5C5A55',
  };

  const DEPTH = { sky: 0, decor: 1, shadow: 3, creature: 6, fx: 12, ui: 20 };

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const colors = [];
    const d = 56, gap = 16;
    const total = COLORS.length * d + (COLORS.length - 1) * gap;
    const x0 = (WIDTH - total) / 2;
    for (let i = 0; i < COLORS.length; i++) {
      const x = x0 + i * (d + gap);
      colors.push({ i: i, cx: x + d / 2, cy: 690, r: d / 2, hit: d / 2 + 6 });
    }
    const sx = [104, 164, 224];
    const sizes = [];
    for (let i = 0; i < SIZES.length; i++) sizes.push({ i: i, cx: sx[i], cy: 768, hit: 26 });
    return {
      paper: { x: PAPER.x, y: PAPER.y, w: PAPER.w, h: PAPER.h },
      colors: colors,
      sizes: sizes,
      undo: { x: 306, y: 744, w: 92, h: 48 },
      clearAll: { x: 406, y: 744, w: 92, h: 48 },
      life: { x: 140, y: 841, w: 260, h: 78 },
      again: { x: 382, y: 24, w: 140, h: 48 },
      drawHint: { x: WIDTH / 2, y: 649 },
      aliveHint: { x: WIDTH / 2, y: 906 },
      nudge: { x: WIDTH / 2, y: 352 },
    };
  }

  // ---------------------------------------------------------------- 几何小工具
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function inCircle(c, x, y) { const dx = x - c.cx, dy = y - c.cy; return dx * dx + dy * dy <= c.hit * c.hit; }
  function rgb(h) { return { r: (h >> 16) & 255, g: (h >> 8) & 255, b: h & 255 }; }
  function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return (Math.round(x.r + (y.r - x.r) * t) << 16) |
      (Math.round(x.g + (y.g - x.g) * t) << 8) |
      Math.round(x.b + (y.b - x.b) * t);
  }
  function lighten(h, t) { return mix(h, 0xFFFFFF, t); }
  function darken(h, t) { return mix(h, 0x2B2622, t); }

  // 用几条横带拼出「渐变」：比 fillGradientStyle 稳，Canvas / WebGL 都一样
  function drawBands(g, y0, y1, cA, cB, n) {
    const h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      g.fillStyle(mix(cA, cB, t), 1);
      g.fillRect(0, y0 + i * h, WIDTH, h + 1);
    }
  }

  function drawCloud(g, x, y, k) {
    g.fillStyle(0xFFFFFF, 0.95);
    g.fillCircle(x, y, 26 * k);
    g.fillCircle(x + 26 * k, y + 6 * k, 20 * k);
    g.fillCircle(x - 26 * k, y + 8 * k, 18 * k);
    g.fillCircle(x + 8 * k, y + 12 * k, 22 * k);
    g.fillCircle(x - 10 * k, y + 14 * k, 20 * k);
  }

  function drawStar(g, x, y, r, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.46;
      const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  function drawFlower(g, x, y, color, k) {
    g.lineStyle(3 * k, 0x63A845, 1).lineBetween(x, y, x, y + 26 * k);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + i * Math.PI * 2 / 5;
      g.fillStyle(color, 1).fillCircle(x + Math.cos(ang) * 7 * k, y + Math.sin(ang) * 7 * k, 6 * k);
    }
    g.fillStyle(0xFFD95E, 1).fillCircle(x, y, 4.5 * k);
  }

  function drawTuft(g, x, y, seed) {
    g.lineStyle(3, 0x6FBE4C, 1);
    for (let i = -1; i <= 1; i++) {
      g.lineBetween(x + i * 2, y, x + i * 8, y - 12 - ((seed + i + 4) % 2) * 5);
    }
  }
  // ---------------------------------------------------------------- 画小家伙的手脚和脸
  // 全部画在「以包围盒中心为原点」的局部坐标里，跟着小家伙一起缩放
  function drawLegs(g, a, swing, ph, tucked) {
    g.clear();
    const w = Math.max(3, a.hw * 0.16);
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? -a.legX : a.legX;
      const ang = tucked ? (i === 0 ? -0.55 : 0.55)
        : (i === 0 ? -1 : 1) * (0.06 + Math.max(0, Math.sin(ph + i * Math.PI)) * swing);
      const fx = x + Math.sin(ang) * a.legLen;
      const fy = a.legY + Math.cos(ang) * a.legLen;
      g.lineStyle(w + 3, a.ink, 1).lineBetween(x, a.legY, fx, fy);
      g.lineStyle(w, a.skin, 1).lineBetween(x, a.legY, fx, fy);
      g.fillStyle(a.ink, 1).fillCircle(fx, fy, w * 0.72 + 1.5);
      g.fillStyle(a.skin, 1).fillCircle(fx, fy, w * 0.72);
    }
  }

  function drawArms(g, a, swing, ph) {
    g.clear();
    const w = Math.max(3, a.hw * 0.14);
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? -a.armX : a.armX;
      const ang = (i === 0 ? -1 : 1) * (0.05 + Math.max(0, Math.sin(ph + (1 - i) * Math.PI)) * swing * 0.7);
      const fx = x + Math.sin(ang) * a.armLen;
      const fy = a.armY + Math.cos(ang) * a.armLen;
      g.lineStyle(w + 3, a.ink, 1).lineBetween(x, a.armY, fx, fy);
      g.lineStyle(w, a.skin, 1).lineBetween(x, a.armY, fx, fy);
      g.fillStyle(a.ink, 1).fillCircle(fx, fy, w * 0.7 + 1.5);
      g.fillStyle(a.skin, 1).fillCircle(fx, fy, w * 0.7);
    }
  }

  function drawFace(g, a, lookX, lookY, blink, mouthOpen) {
    g.clear();
    const er = a.eyeR;
    const ex = a.hw * 0.34, ey = -a.hh * 0.32;
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? -ex : ex;
      if (blink) {
        g.lineStyle(Math.max(2, er * 0.24), a.ink, 1);
        g.beginPath();
        g.arc(x, ey, er * 0.8, Math.PI * 0.14, Math.PI * 0.86, false);
        g.strokePath();
        continue;
      }
      g.fillStyle(0xFFFFFF, 1).fillCircle(x, ey, er);
      g.lineStyle(Math.max(1.5, er * 0.14), a.ink, 1).strokeCircle(x, ey, er);
      const px = x + lookX * er * 0.4;
      const py = ey + lookY * er * 0.4;
      g.fillStyle(a.ink, 1).fillCircle(px, py, er * 0.5);
      g.fillStyle(0xFFFFFF, 0.95).fillCircle(px - er * 0.16, py - er * 0.18, er * 0.18);
    }
    const my = a.hh * 0.08;
    if (mouthOpen) {
      g.fillStyle(a.ink, 1).fillEllipse(0, my + a.hh * 0.1, Math.max(6, a.hw * 0.26), Math.max(5, a.hh * 0.2));
    } else {
      g.lineStyle(Math.max(2, er * 0.22), a.ink, 1);
      g.beginPath();
      g.arc(0, my - a.hh * 0.08, Math.max(8, a.hw * 0.22), Math.PI * 0.2, Math.PI * 0.8, false);
      g.strokePath();
    }
  }

  // ---------------------------------------------------------------- 音效
  // 全部 WebAudio 合成：画线是一声极短的沙沙，变活是一串上行魔法音
  const Sound = (function () {
    let ctx = null;
    let master = null;

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.30;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
      }
      return ctx;
    }

    function resume() {
      const c = ensure();
      if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* ignore */ } }
    }

    function tone(freq, dur, vol, when, type) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + (when || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.08);
    }

    function noise(dur, vol, when, f0, f1, q) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + (when || 0);
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = q || 1.1;
      filt.frequency.setValueAtTime(f0, t0);
      if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.35));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    }

    return {
      resume: resume,
      // 画线：一声很轻的纸笔沙沙（音高随机一点，免得听腻）
      scratch: function () { noise(0.04, 0.05, 0, 1700 * (0.9 + Math.random() * 0.2), 0, 1.7); },
      // 选颜色 / 选粗细：一声轻脆
      select: function () { tone(520, 0.09, 0.045, 0, 'sine'); tone(780, 0.06, 0.02, 0, 'sine'); },
      // 变活：上行魔法音
      alive: function () {
        [0, 4, 7, 12, 16].forEach(function (semi, i) {
          const f = 392 * Math.pow(2, semi / 12);
          tone(f, 0.5, 0.06, i * 0.07, 'triangle');
          tone(f * 2, 0.3, 0.018, i * 0.07, 'sine');
        });
      },
      // 蹦一下
      hop: function () {
        const c = ensure();
        if (!c) return;
        const t0 = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, t0);
        osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.16);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        osc.connect(g); g.connect(master);
        osc.start(t0); osc.stop(t0 + 0.32);
      },
      // 小叫声：随机两声
      voice: function () {
        const base = 520 + Math.random() * 260;
        tone(base, 0.11, 0.05, 0.05, 'sine');
        tone(base * (1.18 + Math.random() * 0.24), 0.10, 0.04, 0.18, 'sine');
      },
      // 撤销：短下滑
      undo: function () { tone(620, 0.09, 0.035, 0, 'sine'); tone(420, 0.11, 0.03, 0.06, 'sine'); },
      // 全擦：swish
      clear: function () { noise(0.24, 0.06, 0, 1500, 320, 0.9); },
      // 画纸上还空着：柔和低音提示
      nudge: function () { tone(300, 0.16, 0.035, 0, 'sine'); tone(240, 0.18, 0.03, 0.09, 'sine'); },
    };
  })();
  // ---------------------------------------------------------------- 场景
  class DoodleScene extends Phaser.Scene {
    constructor() {
      super('DoodleScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT, PAPER: this.L.paper, GROUND_Y: GROUND_Y,
        COLORS: COLORS.slice(), SIZES: SIZES.slice(),
        MAX_STROKES: MAX_STROKES, MAX_PTS_PER_STROKE: MAX_PTS_PER_STROKE,
        WALK_SPEED: WALK_SPEED, IDLE_SLOP: IDLE_SLOP, WALK_X0: WALK_X0, WALK_X1: WALK_X1,
        TAP_MS: TAP_MS, TAP_SLOP: TAP_SLOP, TAP_PAD: TAP_PAD,
        LIFE_H: LIFE_H, LIFE_W_MAX: LIFE_W_MAX, SCALE_MIN: SCALE_MIN, SCALE_MAX: SCALE_MAX,
        MIN_DOODLE: MIN_DOODLE, HOP_MS: HOP_MS, HOP_H: HOP_H,
      };

      this.phase = 'draw';
      this.strokes = [];
      this.colorIdx = DEFAULT_COLOR;
      this.sizeIdx = DEFAULT_SIZE;
      this.activePointerId = null;
      this.activeStroke = null;
      this.drawQ = null;
      this.dabNext = 0;
      this.lastPt = null;
      this.lastScratchAt = -1e9;
      this.elapsed = 0;
      this.lastDt = 1 / 60;
      this.creature = null;
      this.pop = null;
      this.flip = null;
      this.animal = null;
      this.press = null;
      this.targetX = WIDTH / 2;
      this.facing = 1;
      this.hopCount = 0;
      this.introT = 0;
      this.nudgeText = null;
      this.liveProps = [];

      Sound.resume();

      this.buildDrawLayer();
      this.buildPlayLayer();
      this.bindInput();
      this.showPhase('draw', true);
    }

    // -------------------------------------------------- 画纸 + 工具条
    buildDrawLayer() {
      const L = this.L;
      this.deskG = this.add.graphics().setDepth(DEPTH.sky);
      drawBands(this.deskG, 0, HEIGHT, C.deskA, C.deskB, 12);

      this.paperG = this.add.graphics().setDepth(DEPTH.decor);
      this.paperG.fillStyle(C.paper, 1).fillRoundedRect(L.paper.x, L.paper.y, L.paper.w, L.paper.h, 22);
      this.paperG.lineStyle(3, C.paperEdge, 1).strokeRoundedRect(L.paper.x, L.paper.y, L.paper.w, L.paper.h, 22);
      this.paperG.fillStyle(C.paperDot, 1);
      for (let y = L.paper.y + 30; y < L.paper.y + L.paper.h - 12; y += 34) {
        for (let x = L.paper.x + 30; x < L.paper.x + L.paper.w - 12; x += 34) {
          this.paperG.fillCircle(x, y, 1.6);
        }
      }

      this.inkG = this.add.graphics().setDepth(DEPTH.decor + 0.5);

      this.drawHint = this.add.text(L.drawHint.x, L.drawHint.y, '用手指在纸上画点什么', {
        fontFamily: FONT, fontSize: '18px', color: C.paperHint,
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.palG = this.add.graphics().setDepth(DEPTH.ui);
      this.sizeG = this.add.graphics().setDepth(DEPTH.ui);
      this.btnG = this.add.graphics().setDepth(DEPTH.ui);

      const txt = { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: C.btnTextDark };
      this.undoText = this.add.text(L.undo.x + L.undo.w / 2, L.undo.y + L.undo.h / 2, '撤销', txt)
        .setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.clearText = this.add.text(L.clearAll.x + L.clearAll.w / 2, L.clearAll.y + L.clearAll.h / 2, '全擦', txt)
        .setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.lifeText = this.add.text(L.life.x + L.life.w / 2 + 18, L.life.y + L.life.h / 2, '变活啦！', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.paintPalette();
      this.paintSizes();
      this.paintButtons();
    }

    paintPalette() {
      const g = this.palG;
      g.clear();
      for (let i = 0; i < this.L.colors.length; i++) {
        const c = this.L.colors[i];
        g.fillStyle(COLORS[i], 1).fillCircle(c.cx, c.cy, c.r);
        g.lineStyle(3, 0xFFFFFF, 0.9).strokeCircle(c.cx, c.cy, c.r);
        if (i === this.colorIdx) g.lineStyle(4, C.selRing, 1).strokeCircle(c.cx, c.cy, c.r + 5);
      }
    }

    paintSizes() {
      const g = this.sizeG;
      g.clear();
      for (let i = 0; i < this.L.sizes.length; i++) {
        const s = this.L.sizes[i];
        g.fillStyle(0xFFFFFF, 0.85).fillCircle(s.cx, s.cy, 23);
        g.fillStyle(COLORS[this.colorIdx], 1).fillCircle(s.cx, s.cy, SIZES[i] / 2 + 2);
        if (i === this.sizeIdx) g.lineStyle(3, C.selRing, 1).strokeCircle(s.cx, s.cy, 25);
      }
    }

    paintButtons() {
      const g = this.btnG;
      const L = this.L;
      g.clear();
      g.fillStyle(C.pill, 1).fillRoundedRect(L.undo.x, L.undo.y, L.undo.w, L.undo.h, 24);
      g.lineStyle(2, C.pillLine, 1).strokeRoundedRect(L.undo.x, L.undo.y, L.undo.w, L.undo.h, 24);
      g.fillStyle(C.pill, 1).fillRoundedRect(L.clearAll.x, L.clearAll.y, L.clearAll.w, L.clearAll.h, 24);
      g.lineStyle(2, C.pillLine, 1).strokeRoundedRect(L.clearAll.x, L.clearAll.y, L.clearAll.w, L.clearAll.h, 24);
      const b = L.life;
      g.fillStyle(C.lifeDark, 1).fillRoundedRect(b.x, b.y + 5, b.w, b.h, 39);
      g.fillStyle(C.life, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 39);
      drawStar(g, b.x + 48, b.y + b.h / 2, 14, 0xFFFFFF);
      g.fillStyle(0xFFFFFF, 0.9).fillCircle(b.x + 66, b.y + b.h / 2 - 16, 3);
      g.fillStyle(0xFFFFFF, 0.9).fillCircle(b.x + 70, b.y + b.h / 2 + 15, 2.4);
    }

    // -------------------------------------------------- 草地
    buildPlayLayer() {
      const g = this.add.graphics().setDepth(DEPTH.sky);
      drawBands(g, 0, GROUND_Y + 40, C.skyA, C.skyB, 12);
      g.fillStyle(C.sunGlow, 0.45).fillCircle(452, 116, 62);
      g.fillStyle(C.sun, 1).fillCircle(452, 116, 40);
      drawCloud(g, 132, 152, 1);
      drawCloud(g, 336, 96, 0.78);
      drawCloud(g, 252, 216, 0.66);
      g.fillStyle(C.hill2, 1);
      g.beginPath(); g.arc(136, GROUND_Y + 14, 220, Math.PI, Math.PI * 2, false); g.closePath(); g.fillPath();
      g.fillStyle(C.hill, 1);
      g.beginPath(); g.arc(432, GROUND_Y + 24, 240, Math.PI, Math.PI * 2, false); g.closePath(); g.fillPath();
      g.fillStyle(C.grass, 1).fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
      g.fillStyle(C.grassDark, 1).fillRect(0, GROUND_Y, WIDTH, 6);
      const fx = [72, 152, 236, 320, 402, 476];
      for (let i = 0; i < fx.length; i++) {
        drawFlower(g, fx[i], GROUND_Y + 34 + (i % 2) * 16, C.flowers[i % C.flowers.length], 0.9 + (i % 3) * 0.12);
      }
      for (let i = 0; i < 7; i++) drawTuft(g, 40 + i * 76, HEIGHT - 26, i);
      this.gardenG = g;

      this.shadowG = this.add.graphics().setDepth(DEPTH.shadow);

      this.againG = this.add.graphics().setDepth(DEPTH.ui);
      const b = this.L.again;
      this.againG.fillStyle(0xFFFFFF, 0.94).fillRoundedRect(b.x, b.y, b.w, b.h, 24);
      this.againG.lineStyle(2, C.pillLine, 1).strokeRoundedRect(b.x, b.y, b.w, b.h, 24);
      this.againText = this.add.text(b.x + b.w / 2, b.y + b.h / 2, '再画一只', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: C.btnTextDark,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.aliveHint = this.add.text(this.L.aliveHint.x, this.L.aliveHint.y, '拖一拖带它走，点它一下它会跳', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#4E8A2E', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
    }

    // -------------------------------------------------- 输入
    // 只有一种操作：拿手指画 / 拿手指带它走。飞出去的东西一概没有。
    bindInput() {
      this.input.on('pointerdown', (p) => this.onDown(p));
      this.input.on('pointermove', (p) => this.onMove(p));
      this.input.on('pointerup', (p) => this.onUp(p));
      this.input.on('pointerupoutside', (p) => this.onUp(p));
    }

    onDown(p) {
      Sound.resume();
      if (this.activePointerId !== null) return;
      this.activePointerId = p.id;
      const x = p.x, y = p.y;

      if (this.phase === 'draw') {
        for (let i = 0; i < this.L.colors.length; i++) if (inCircle(this.L.colors[i], x, y)) { this.pickColor(i); return; }
        for (let i = 0; i < this.L.sizes.length; i++) if (inCircle(this.L.sizes[i], x, y)) { this.pickSize(i); return; }
        if (inRect(this.L.undo, x, y)) { this.undo(); return; }
        if (inRect(this.L.clearAll, x, y)) { this.clearAll(); return; }
        if (inRect(this.L.life, x, y)) { this.bringToLife(); return; }
        if (inRect(this.L.paper, x, y)) this.startStroke(x, y);
        return;
      }

      if (inRect(this.L.again, x, y)) { this.resetToDraw(); return; }
      this.press = { x: x, y: y, t: this.elapsed, moved: 0, inside: this.hitCreature(x, y) };
      this.targetX = clamp(x, WALK_X0, WALK_X1);
      this.updateLook(x, y);
    }

    onMove(p) {
      if (p.id !== this.activePointerId) return;
      const x = p.x, y = p.y;

      if (this.phase === 'draw') {
        if (!this.activeStroke || !this.lastPt) return;
        const lp = this.lastPt;
        const dx = x - lp.x, dy = y - lp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.min(8, Math.round(dist / 6)));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          this.addPoint(lp.x + dx * t, lp.y + dy * t);
        }
        this.lastPt = { x: x, y: y };
        if (this.elapsed - this.lastScratchAt > SCRATCH_MS / 1000) {
          Sound.scratch();
          this.lastScratchAt = this.elapsed;
        }
        return;
      }

      if (this.press) {
        const ddx = x - this.press.x, ddy = y - this.press.y;
        this.press.moved = Math.sqrt(ddx * ddx + ddy * ddy);
      }
      this.targetX = clamp(x, WALK_X0, WALK_X1);
      this.updateLook(x, y);
    }

    onUp(p) {
      if (this.activePointerId === null) return;
      if (p && p.id !== undefined && p.id !== this.activePointerId) return;
      if (this.phase === 'draw') {
        this.endStroke();
      } else if (this.press) {
        const pr = this.press;
        if (pr.inside && (this.elapsed - pr.t) <= TAP_MS / 1000 && pr.moved < TAP_SLOP) this.hop();
      }
      this.press = null;
      this.activePointerId = null;
    }
    // -------------------------------------------------- 每帧推进（纯逻辑）
    step(dt) {
      this.elapsed += dt;
      this.lastDt = dt;
      if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);
      if (this.phase !== 'alive' || !this.creature) return;
      const a = this.animal;

      if (this.introT <= 0) {
        const dx = this.targetX - this.creature.x;
        if (Math.abs(dx) > IDLE_SLOP) {
          const dir = dx > 0 ? 1 : -1;
          const len = Math.min(Math.abs(dx), WALK_SPEED * dt);
          this.creature.x += dir * len;
          if (dir !== this.facing) this.facing = dir;
          a.walking = true;
          a.walkPhase += len * 0.06;
        } else {
          a.walking = false;
        }
      }

      if (a.hopT > 0) a.hopT = Math.max(0, a.hopT - dt);
      if (a.blinkLeft > 0) {
        a.blinkLeft = Math.max(0, a.blinkLeft - dt);
      } else {
        a.blinkT -= dt;
        if (a.blinkT <= 0) { a.blinkLeft = 0.14; a.blinkT = 2.5 + Math.random() * 2.5; }
      }
      const k = Math.min(1, dt * 8);
      a.lookCurX += (a.lookX - a.lookCurX) * k;
      a.lookCurY += (a.lookY - a.lookCurY) * k;
    }

    // -------------------------------------------------- 每帧绘制
    render() {
      if (this.phase === 'alive' && this.creature) this.renderCreature();
    }

    renderCreature() {
      const a = this.animal;
      const cont = this.creature;
      const dur = HOP_MS / 1000;
      const hopU = a.hopT > 0 ? 1 - a.hopT / dur : 0;

      if (this.introT <= 0) {
        let y = a.baseY;
        if (a.walking) y -= Math.abs(Math.sin(a.walkPhase)) * 4;
        if (a.hopT > 0) y -= Math.sin(Math.PI * hopU) * HOP_H;
        cont.y = y;
      }

      const sq = a.hopT > 0 ? 1 + 0.12 * Math.sin(Math.PI * hopU) : 1;
      cont.setScale(a.s, a.s * sq);
      this.flip.scaleX = this.facing;

      const swing = a.walking ? 0.5 : 0.08;
      drawLegs(this.legsG, a, swing, a.walkPhase, a.hopT > 0);
      drawArms(this.armsG, a, swing, a.walkPhase);
      drawFace(this.faceG, a, a.lookCurX, a.lookCurY, a.blinkLeft > 0, a.hopT > 0);

      const g = this.shadowG;
      g.clear();
      const lift = a.hopT > 0 ? Math.sin(Math.PI * hopU) : 0;
      const k = 1 - (lift / HOP_H) * 0.45;
      g.fillStyle(C.shadow, 0.18 * k);
      g.fillEllipse(cont.x, GROUND_Y - 2, a.s * a.hw * 2.2 * k, 16 * k);
    }

    // -------------------------------------------------- 画线
    startStroke(x, y) {
      if (this.strokes.length >= MAX_STROKES) return;
      const s = { color: COLORS[this.colorIdx], width: SIZES[this.sizeIdx], pts: [{ x: x, y: y }] };
      this.activeStroke = s;
      this.inkG.fillStyle(s.color, 1).fillCircle(x, y, s.width / 2);
      this.drawQ = { x: x, y: y };
      this.dabNext = Math.max(DAB_MIN_STEP, s.width * DAB_STEP_RATIO);
      this.lastPt = { x: x, y: y };
      this.lastScratchAt = this.elapsed;
      Sound.scratch();
    }

    addPoint(x, y) {
      const s = this.activeStroke;
      if (!s || s.pts.length >= MAX_PTS_PER_STROKE) return;
      const p = { x: x, y: y };
      s.pts.push(p);
      const r = s.width / 2;
      const step = Math.max(DAB_MIN_STEP, s.width * DAB_STEP_RATIO);
      this.dabNext = this.dabSegment(this.inkG, this.drawQ, p, r, step, this.dabNext);
      this.drawQ = p;
    }

    endStroke() {
      if (!this.activeStroke) return;
      this.strokes.push(this.activeStroke);
      this.activeStroke = null;
      this.drawQ = null;
      this.lastPt = null;
    }

    // 在两个采样点之间补圆点，返回「距离下一个圆点还差多少」
    dabSegment(g, q, p, r, step, next) {
      const dx = p.x - q.x, dy = p.y - q.y;
      const seg = Math.sqrt(dx * dx + dy * dy);
      if (seg <= 1e-6) return next;
      let t = next;
      while (t <= seg) {
        const u = t / seg;
        g.fillCircle(q.x + dx * u, q.y + dy * u, r);
        t += step;
      }
      return t - seg;
    }

    stampStrokes(g, strokes, ox, oy) {
      for (let i = 0; i < strokes.length; i++) {
        const s = strokes[i];
        if (!s.pts.length) continue;
        g.fillStyle(s.color, 1);
        const r = s.width / 2;
        const step = Math.max(DAB_MIN_STEP, s.width * DAB_STEP_RATIO);
        const p0 = { x: s.pts[0].x - ox, y: s.pts[0].y - oy };
        g.fillCircle(p0.x, p0.y, r);
        let q = p0, next = step;
        for (let k = 1; k < s.pts.length; k++) {
          const p = { x: s.pts[k].x - ox, y: s.pts[k].y - oy };
          next = this.dabSegment(g, q, p, r, step, next);
          q = p;
        }
      }
    }

    redrawInk() {
      this.inkG.clear();
      this.stampStrokes(this.inkG, this.strokes, 0, 0);
    }

    bounds() {
      if (!this.strokes.length) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
      for (let i = 0; i < this.strokes.length; i++) {
        const pts = this.strokes[i].pts;
        for (let k = 0; k < pts.length; k++) {
          const p = pts[k];
          if (p.x < x0) x0 = p.x;
          if (p.x > x1) x1 = p.x;
          if (p.y < y0) y0 = p.y;
          if (p.y > y1) y1 = p.y;
          n++;
        }
      }
      if (!n) return null;
      return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }

    // 用哪支蜡笔用得最多，小家伙的四肢就跟着那个色系
    dominantColor() {
      const tally = {};
      let best = COLORS[this.colorIdx], bestN = -1;
      for (let i = 0; i < this.strokes.length; i++) {
        const s = this.strokes[i];
        tally[s.color] = (tally[s.color] || 0) + s.pts.length;
      }
      for (const k in tally) {
        if (tally[k] > bestN) { bestN = tally[k]; best = parseInt(k, 10); }
      }
      return best;
    }

    // -------------------------------------------------- 工具条动作
    pickColor(i) {
      if (i < 0 || i >= COLORS.length) return;
      if (i === this.colorIdx) return;
      this.colorIdx = i;
      this.paintPalette();
      this.paintSizes();
      Sound.select();
    }

    pickSize(i) {
      if (i < 0 || i >= SIZES.length) return;
      if (i === this.sizeIdx) return;
      this.sizeIdx = i;
      this.paintSizes();
      Sound.select();
    }

    undo() {
      if (!this.strokes.length) { Sound.nudge(); return; }
      this.strokes.pop();
      this.redrawInk();
      Sound.undo();
    }

    clearAll() {
      if (!this.strokes.length) { Sound.nudge(); return; }
      this.strokes = [];
      this.inkG.clear();
      Sound.clear();
    }

    // -------------------------------------------------- 变活
    bringToLife() {
      if (this.phase !== 'draw') return;
      const b = this.bounds();
      if (!b || Math.min(b.w, b.h) < MIN_DOODLE) { Sound.nudge(); this.showNudge(); return; }
      this.makeCreature(b);
      this.phase = 'alive';
      this.introT = 0.62;
      this.targetX = this.creature.x;
      this.press = null;
      this.activePointerId = null;
      this.activeStroke = null;
      this.drawQ = null;
      this.lastPt = null;
      Sound.alive();
      this.sparkle(this.creature.x, this.animal.baseY - this.animal.s * b.h / 2, COLORS[this.colorIdx], 14);
      this.showPhase('alive', false);
      this.fadeAliveHint();
      this.pop.y = -90;
      this.pop.setAlpha(0);
      this.pop.setScale(0.5);
      this.tweens.add({ targets: this.pop, y: 0, scale: 1, duration: 620, ease: 'Bounce.Out' });
      this.tweens.add({ targets: this.pop, alpha: 1, duration: 240 });
    }

    makeCreature(b) {
      const s = clamp(Math.min(LIFE_H / b.h, LIFE_W_MAX / b.w), SCALE_MIN, SCALE_MAX);
      const hw = b.w / 2, hh = b.h / 2;
      const legLen = clamp(hh * 0.8, 16, 70);
      const legY = hh * 0.9;
      const baseY = GROUND_Y - s * (legY + legLen);
      const base = this.dominantColor();

      const bodyG = this.add.graphics();
      this.stampStrokes(bodyG, this.strokes, b.cx, b.cy);
      const armsG = this.add.graphics();
      const legsG = this.add.graphics();
      const faceG = this.add.graphics();

      this.flip = this.add.container(0, 0, [bodyG, armsG, legsG, faceG]);
      this.pop = this.add.container(0, 0, [this.flip]);
      this.creature = this.add.container(270, baseY, [this.pop]);
      this.creature.setDepth(DEPTH.creature);
      this.creature.setScale(s);
      this.bodyG = bodyG;
      this.armsG = armsG;
      this.legsG = legsG;
      this.faceG = faceG;

      this.animal = {
        hw: hw, hh: hh, s: s, baseY: baseY,
        ink: C.ink, skin: lighten(base, 0.5), skinDark: darken(base, 0.06),
        eyeR: clamp(Math.min(hw, hh) * 0.22, 8, 26),
        legX: hw * 0.42, legY: legY, legLen: legLen, footRest: legY + legLen,
        armX: hw * 0.95, armY: -hh * 0.05,
        armLen: clamp(hh * 0.55, 12, 46),
        walkPhase: 0, walking: false,
        blinkT: 2 + Math.random() * 2, blinkLeft: 0,
        lookX: 0, lookY: 0, lookCurX: 0, lookCurY: 0,
        hopT: 0,
      };
      this.trackObj(this.creature);
      return this.creature;
    }

    hop() {
      const a = this.animal;
      if (!a || a.hopT > 0) return;
      a.hopT = HOP_MS / 1000;
      this.hopCount += 1;
      Sound.hop();
      Sound.voice();
      this.sparkle(this.creature.x, a.baseY - a.s * a.hh - 6, COLORS[this.colorIdx], 7);
    }

    resetToDraw() {
      if (this.creature) {
        this.untrackObj(this.creature);
        this.creature.destroy();
      }
      this.creature = null;
      this.pop = null;
      this.flip = null;
      this.animal = null;
      this.bodyG = this.armsG = this.legsG = this.faceG = null;
      this.shadowG.clear();
      this.strokes = [];
      this.inkG.clear();
      this.activeStroke = null;
      this.drawQ = null;
      this.lastPt = null;
      this.press = null;
      this.activePointerId = null;
      this.targetX = WIDTH / 2;
      this.facing = 1;
      this.hopCount = 0;
      this.introT = 0;
      this.phase = 'draw';
      this.showPhase('draw', false);
    }

    // -------------------------------------------------- 命中与视线
    creatureBounds() {
      const a = this.animal;
      if (!a || !this.creature) return null;
      const s = this.creature.scaleX;
      const hw = a.hw * s;
      return {
        x0: this.creature.x - hw, x1: this.creature.x + hw,
        y0: this.creature.y - a.hh * s, y1: this.creature.y + a.footRest * s,
      };
    }

    hitCreature(x, y) {
      const b = this.creatureBounds();
      if (!b) return false;
      return x >= b.x0 - TAP_PAD && x <= b.x1 + TAP_PAD && y >= b.y0 - TAP_PAD && y <= b.y1 + TAP_PAD;
    }

    updateLook(x, y) {
      const a = this.animal;
      if (!a) return;
      a.lookX = clamp((x - this.creature.x) / 200, -1, 1);
      a.lookY = clamp((y - (a.baseY - a.s * a.hh)) / 200, -1, 1);
    }

    // -------------------------------------------------- 小特效
    sparkle(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        const r = 3 + Math.random() * 4;
        g.fillStyle(0xFFFFFF, 1).fillCircle(0, 0, r);
        g.fillStyle(color, 1).fillCircle(0, 0, r * 0.55);
        g.setPosition(x, y);
        this.trackObj(g);
        const ang = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 70;
        this.tweens.add({
          targets: g,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist - 20,
          alpha: 0, scale: 0.4,
          duration: 480 + Math.random() * 380,
          ease: 'Quad.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    showNudge() {
      if (!this.nudgeText) {
        this.nudgeText = this.add.text(this.L.nudge.x, this.L.nudge.y, '先在纸上画点什么吧～', {
          fontFamily: FONT, fontSize: '22px', color: '#8A8272',
          backgroundColor: '#FFFDF8', padding: { x: 18, y: 11 },
        }).setOrigin(0.5).setDepth(DEPTH.ui + 3);
      }
      this.nudgeText.setAlpha(1);
      this.tweens.killTweensOf(this.nudgeText);
      this.tweens.add({ targets: this.nudgeText, alpha: 0, delay: 1300, duration: 500 });
    }

    // -------------------------------------------------- 阶段切换
    showPhase(phase, instant) {
      const drawObjs = [this.deskG, this.paperG, this.inkG, this.drawHint, this.palG,
        this.sizeG, this.btnG, this.undoText, this.clearText, this.lifeText];
      const playObjs = [this.gardenG, this.shadowG, this.againG, this.againText];
      const d = phase === 'draw' ? 1 : 0;
      const p = phase === 'alive' ? 1 : 0;
      this.fadeGroup(drawObjs, d, instant ? 0 : 320);
      this.fadeGroup(playObjs, p, instant ? 0 : 320);
      this.aliveHint.setAlpha(0);
    }

    fadeGroup(objs, to, dur) {
      if (dur <= 0) {
        for (let i = 0; i < objs.length; i++) objs[i].setAlpha(to);
        return;
      }
      this.tweens.add({ targets: objs, alpha: to, duration: dur });
    }

    fadeAliveHint() {
      this.aliveHint.setAlpha(0);
      this.tweens.killTweensOf(this.aliveHint);
      this.aliveHint.setAlpha(1);
      this.tweens.add({ targets: this.aliveHint, alpha: 0, delay: ALIVE_HINT_MS, duration: 700 });
    }

    // -------------------------------------------------- 特效清理台账（测试也看这个）
    trackObj(o) { this.liveProps.push(o); return o; }

    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
      return o;
    }

    // -------------------------------------------------- 测试钩子（非公共 API）
    forceTapOnCreature() { this.hop(); }

    update(time, delta) {
      const dt = Math.min(delta, 60) / 1000;
      this.step(dt);
      this.render();
    }
  }

  window.DoodleScene = DoodleScene;
})();