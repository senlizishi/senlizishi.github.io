/*
 * 颜色魔法屋：竖屏（540x960）的真实颜料调色小玩具。
 * 红、绿、蓝三瓶魔法颜料可以反复拖进锅里，锅里的颜色按减法混色缓慢变化；
 * 没有目标色、分数、计时和失败，只有右上角的「重置」。
 * 画面全部 Phaser.Graphics / Text 程序化绘制，音效 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;

  const PRIMARY_KEYS = ['red', 'green', 'blue'];
  const PURE_COLORS = {
    red: 0xE84F61,
    green: 0x49BD6B,
    blue: 0x5278DF,
  };
  // 颜料透射率：红颜料主要反射红、吸收绿蓝，其余同理。
  // 混色时对三个通道做加权几何平均，得到比发光 RGB 更接近颜料的暗一些的结果。
  const PIGMENTS = {
    red: [1.0, 0.16, 0.16],
    green: [0.16, 1.0, 0.16],
    blue: [0.16, 0.16, 1.0],
  };
  const EMPTY_COLOR = 0x3C3B55;
  const MIX_SEC = 0.6;
  const MIX_LIFT = 0.04;
  const MIX_GAMMA = 0.72;

  const BOTTLES = [
    { key: 'red', name: '红', x: 105, y: 798, rx: 55, ry: 78 },
    { key: 'green', name: '绿', x: 270, y: 798, rx: 55, ry: 78 },
    { key: 'blue', name: '蓝', x: 435, y: 798, rx: 55, ry: 78 },
  ];
  const POT = { x: 270, y: 404, rx: 168, ry: 58, hitRx: 196, hitRy: 112, bodyBottom: 606 };
  const SHELF = { x: 12, y: 690, w: 516, h: 258 };

  const DEPTH = {
    room: 0, window: 1, shelf: 2, pot: 4, liquid: 5,
    bottles: 8, ghost: 14, fx: 16, ui: 20, banner: 24,
  };

  const C = {
    night: 0x171033, nightDeep: 0x0C0822, indigo: 0x2D2163,
    purple: 0x5740A0, gold: 0xF7CF68, goldDeep: 0xB77A1E,
    cream: 0xFFF4D9, creamSoft: 0xFFE5B0, ink: 0x24143C,
    wood: 0x6C3F52, woodDeep: 0x42283B, stone: 0x2E2853,
    glass: 0xDCD9FF, cork: 0xA36B45, white: 0xFFFFFF,
  };

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    return {
      title: { x: 190, y: 66 },
      subtitle: { x: 190, y: 100 },
      reset: { x: 454, y: 68, w: 108, h: 44 },
      pot: POT,
      name: { x: WIDTH / 2, y: 656 },
      hint: { x: WIDTH / 2, y: 934 },
      bottles: BOTTLES.map(function (b) { return Object.assign({}, b); }),
    };
  }

  // ---------------------------------------------------------------- 小工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function blend(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(lerp(ar, br, t)) << 16)
      | (Math.round(lerp(ag, bg, t)) << 8)
      | Math.round(lerp(ab, bb, t));
  }
  function hexToRgb(hex) {
    return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
  }
  function rgbToHex(r, g, b) {
    return (clamp(Math.round(r), 0, 255) << 16)
      | (clamp(Math.round(g), 0, 255) << 8)
      | clamp(Math.round(b), 0, 255);
  }
  function lighten(hex, t) { return blend(hex, 0xFFFFFF, t); }
  function darken(hex, t) { return blend(hex, 0x000000, t); }
  function pseudo(i) {
    const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    return v - Math.floor(v);
  }
  function fillPoly(g, pts) {
    if (!pts || !pts.length) return;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }
  function strokePoly(g, pts, closed) {
    if (!pts || !pts.length) return;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed) g.closePath();
    g.strokePath();
  }
  function drawStar(g, x, y, r, color, alpha, points) {
    const n = points || 5;
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rr = i % 2 === 0 ? r : r * 0.44;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    g.fillStyle(color, alpha == null ? 1 : alpha);
    fillPoly(g, pts);
  }
  function containsRect(r, x, y) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }

  // ---------------------------------------------------------------- 混色
  function mixTarget(parts) {
    const counts = PRIMARY_KEYS.map(function (key) {
      const v = Number(parts && parts[key]);
      return isFinite(v) && v > 0 ? v : 0;
    });
    const total = counts.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) return EMPTY_COLOR;

    const active = [];
    for (let i = 0; i < counts.length; i++) if (counts[i] > 0) active.push(i);
    if (active.length === 1) return PURE_COLORS[PRIMARY_KEYS[active[0]]];

    const logs = [0, 0, 0];
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] <= 0) continue;
      const w = counts[i] / total;
      const p = PIGMENTS[PRIMARY_KEYS[i]];
      for (let c = 0; c < 3; c++) logs[c] += w * Math.log(p[c]);
    }
    const out = logs.map(function (v) {
      return clamp(255 * (MIX_LIFT + (1 - MIX_LIFT) * Math.pow(Math.exp(v), MIX_GAMMA)), 0, 255);
    });
    return rgbToHex(out[0], out[1], out[2]);
  }

  function rgbToHsl(hex) {
    const c = hexToRgb(hex);
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0, s = 0;
    if (d > 0.0001) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: s, l: l };
  }

  function colorName(hex, parts) {
    let total = 0, active = 0;
    if (parts) {
      for (let i = 0; i < PRIMARY_KEYS.length; i++) {
        if (Number(parts[PRIMARY_KEYS[i]]) > 0) { total += Number(parts[PRIMARY_KEYS[i]]); active += 1; }
      }
    }
    if (total <= 0) return '空空的魔法锅';
    if (active === 1) {
      if (parts.red > 0) return '红魔法';
      if (parts.green > 0) return '绿魔法';
      return '蓝魔法';
    }
    const hsl = rgbToHsl(hex);
    if (hsl.s < 0.12) return '泥浆灰';
    const h = hsl.h;
    if (h < 15 || h >= 345) return '暖红色';
    if (h < 45) return '橙褐色';
    if (h < 75) return '橄榄黄';
    if (h < 160) return '草绿色';
    if (h < 200) return '湖水青';
    if (h < 255) return '靛蓝色';
    if (h < 290) return '蓝紫色';
    if (h < 345) return '葡萄紫';
    return '奇妙的颜色';
  }

  // ---------------------------------------------------------------- 房间背景
  function drawRoom(g) {
    const bands = 28;
    const bh = 700 / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(blend(C.nightDeep, 0x38276B, i / (bands - 1)), 1);
      g.fillRect(0, i * bh, WIDTH, bh + 1);
    }

    // 石墙纹理
    g.lineStyle(2, 0x7862B0, 0.09);
    for (let row = 0; row < 10; row++) {
      const y = 130 + row * 52;
      g.lineBetween(0, y, WIDTH, y);
      const off = row % 2 ? 34 : 0;
      for (let x = -20 + off; x < WIDTH + 50; x += 72) {
        g.lineBetween(x, y, x - 15, y + 52);
      }
    }

    // 月亮窗
    const wx = 82, wy = 245, ww = 142, wh = 214;
    g.fillStyle(0x08051B, 0.42).fillRoundedRect(wx - 13, wy - 12, ww + 26, wh + 30, 32);
    g.fillStyle(0x2B3071, 1).fillRoundedRect(wx, wy, ww, wh, 27);
    g.fillStyle(0x1B2055, 1).fillCircle(wx + ww / 2, wy + 74, 67);
    g.fillStyle(0xFFF1C0, 1).fillCircle(wx + 102, wy + 64, 27);
    g.fillStyle(0x303672, 1).fillCircle(wx + 89, wy + 53, 24);
    for (let i = 0; i < 11; i++) {
      const x = wx + 18 + pseudo(i + 2) * (ww - 36);
      const y = wy + 25 + pseudo(i + 23) * (wh - 50);
      drawStar(g, x, y, 2 + pseudo(i + 7) * 2, 0xFFF4C2, 0.75, 4);
    }
    g.lineStyle(9, C.woodDeep, 1).strokeRoundedRect(wx, wy, ww, wh, 27);
    g.lineStyle(3, C.gold, 0.38).strokeRoundedRect(wx + 5, wy + 5, ww - 10, wh - 10, 22);
    g.lineStyle(5, C.wood, 1);
    g.lineBetween(wx + ww / 2, wy + 8, wx + ww / 2, wy + wh - 8);
    g.lineBetween(wx + 8, wy + 112, wx + ww - 8, wy + 112);

    // 漂浮糖粒与星光
    for (let i = 0; i < 46; i++) {
      const x = 18 + pseudo(i + 33) * (WIDTH - 36);
      const y = 128 + pseudo(i + 84) * 510;
      if (Math.abs(x - POT.x) < 205 && y > 250 && y < 660) continue;
      const col = [0xFF6D88, 0x67D99A, 0x6B9EFF, 0xF8D36C][i % 4];
      if (i % 3 === 0) drawStar(g, x, y, 2.5 + pseudo(i + 8) * 2.5, col, 0.55, 4);
      else g.fillStyle(col, 0.3).fillCircle(x, y, 1.5 + pseudo(i + 5) * 2);
    }

    // 底部木架与地面
    g.fillStyle(0x0B071D, 0.42).fillRect(0, 650, WIDTH, 310);
    g.fillStyle(0x2E1B31, 1).fillRoundedRect(SHELF.x, SHELF.y, SHELF.w, SHELF.h, 26);
    g.fillStyle(C.woodDeep, 1).fillRoundedRect(SHELF.x, SHELF.y, SHELF.w, SHELF.h - 12, 24);
    g.fillStyle(C.wood, 1).fillRoundedRect(SHELF.x + 6, SHELF.y + 6, SHELF.w - 12, 72, 22);
    g.fillStyle(0x9B6170, 0.65).fillRoundedRect(SHELF.x + 12, SHELF.y + 9, SHELF.w - 24, 8, 4);
    g.fillStyle(0x3B2237, 1).fillRect(SHELF.x + 18, SHELF.y + 74, SHELF.w - 36, SHELF.h - 90);
    g.lineStyle(2, 0x9C6D79, 0.16);
    for (let i = 0; i < 22; i++) {
      const y = SHELF.y + 96 + i * 7;
      g.lineBetween(SHELF.x + 30, y, SHELF.x + SHELF.w - 30, y + (i % 2 ? 2 : -1));
    }
    g.fillStyle(0x604054, 0.7).fillRoundedRect(SHELF.x + 52, 906, SHELF.w - 104, 9, 5);
    g.fillStyle(0x2B1729, 0.75).fillRoundedRect(SHELF.x + 83, 915, 18, 62, 7);
    g.fillStyle(0x2B1729, 0.75).fillRoundedRect(SHELF.x + SHELF.w - 101, 915, 18, 62, 7);
  }

  // ---------------------------------------------------------------- 瓶子
  function drawBottleShape(g, key, x, y, scale, rot) {
    const s = scale || 1;
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(rot || 0);
    g.scaleCanvas(s, s);

    const color = PURE_COLORS[key];
    // 玻璃和液体
    if (key === 'red') {
      g.fillStyle(0xBCB5F0, 0.18).fillCircle(0, 14, 45);
      g.fillStyle(0xEDE9FF, 0.27).fillRoundedRect(-13, -62, 26, 44, 8);
      g.fillStyle(color, 1).fillCircle(0, 17, 34);
      g.fillStyle(darken(color, 0.18), 1).fillEllipse(0, 36, 56, 19);
      g.fillStyle(lighten(color, 0.22), 0.65).fillEllipse(-11, 2, 21, 14);
      g.lineStyle(3, 0xF4EFFF, 0.62).strokeCircle(0, 14, 45);
    } else if (key === 'green') {
      g.fillStyle(0xBCB5F0, 0.18).fillRoundedRect(-36, -38, 72, 103, 20);
      g.fillStyle(0xEDE9FF, 0.27).fillRoundedRect(-13, -71, 26, 43, 8);
      g.fillStyle(color, 1).fillRoundedRect(-28, -23, 56, 80, 15);
      g.fillStyle(darken(color, 0.2), 1).fillEllipse(0, 52, 46, 12);
      g.fillStyle(lighten(color, 0.24), 0.62).fillRoundedRect(-18, -12, 9, 50, 4);
      g.lineStyle(3, 0xF4EFFF, 0.62).strokeRoundedRect(-36, -38, 72, 103, 20);
    } else {
      g.fillStyle(0xBCB5F0, 0.18);
      fillPoly(g, [[-45, 64], [45, 64], [0, -43]]);
      g.fillStyle(0xEDE9FF, 0.27).fillRoundedRect(-13, -72, 26, 42, 8);
      g.fillStyle(color, 1);
      fillPoly(g, [[-32, 50], [32, 50], [0, -29]]);
      g.fillStyle(darken(color, 0.18), 1).fillEllipse(0, 52, 50, 12);
      g.fillStyle(lighten(color, 0.22), 0.64).fillEllipse(-8, 18, 12, 28);
      g.lineStyle(3, 0xF4EFFF, 0.62);
      strokePoly(g, [[-45, 64], [45, 64], [0, -43]], true);
    }

    // 瓶口、软木塞和高光
    g.fillStyle(0xE8E2FA, 0.72).fillRoundedRect(-17, -81, 34, 15, 6);
    g.fillStyle(C.cork, 1).fillRoundedRect(-13, -96, 26, 22, 7);
    g.fillStyle(0xD79A6A, 0.72).fillRoundedRect(-9, -93, 8, 5, 2);
    g.fillStyle(0xFFFFFF, 0.66).fillCircle(-8, -48, 4);
    g.restore();
  }

  // ---------------------------------------------------------------- 锅
  function drawCauldronBase(g) {
    const p = POT;
    g.fillStyle(0x07030F, 0.46).fillEllipse(p.x, 620, 390, 55);
    g.fillStyle(0x5A4A68, 0.5).fillEllipse(p.x, 618, 330, 34);

    // 三条小脚
    g.fillStyle(0x241B35, 1);
    g.fillTriangle(p.x - 96, 554, p.x - 64, 554, p.x - 84, 615);
    g.fillTriangle(p.x + 64, 554, p.x + 96, 554, p.x + 84, 615);
    g.fillTriangle(p.x - 16, 560, p.x + 16, 560, p.x, 622);

    // 锅身
    g.fillStyle(0x1C1531, 1).fillEllipse(p.x, 489, 340, 245);
    g.fillStyle(0x2A2048, 1).fillEllipse(p.x, 477, 324, 225);
    g.fillStyle(0x3D3163, 0.75).fillEllipse(p.x - 55, 444, 142, 118);
    g.fillStyle(0x120D25, 0.82).fillEllipse(p.x + 82, 520, 82, 100);

    // 把手
    g.lineStyle(14, 0x131022, 1);
    g.beginPath(); g.arc(p.x - 166, 459, 35, -Math.PI * 0.45, Math.PI * 0.45, false); g.strokePath();
    g.beginPath(); g.arc(p.x + 166, 459, 35, Math.PI * 0.55, Math.PI * 1.45, false); g.strokePath();
    g.lineStyle(6, C.goldDeep, 0.85);
    g.beginPath(); g.arc(p.x - 166, 459, 35, -Math.PI * 0.45, Math.PI * 0.45, false); g.strokePath();
    g.beginPath(); g.arc(p.x + 166, 459, 35, Math.PI * 0.55, Math.PI * 1.45, false); g.strokePath();

    // 金色锅沿
    g.fillStyle(0x7E4B16, 0.7).fillEllipse(p.x, p.y + 9, 374, 108);
    g.fillStyle(C.goldDeep, 1).fillEllipse(p.x, p.y, 370, 104);
    g.fillStyle(C.gold, 1).fillEllipse(p.x, p.y - 5, 356, 90);
    g.fillStyle(0xFFE8A2, 0.82).fillEllipse(p.x, p.y - 9, 330, 70);
    g.fillStyle(0xF2D7AF, 1).fillEllipse(p.x, p.y - 1, 310, 66);
    g.fillStyle(0xE0C9AE, 1).fillEllipse(p.x, p.y + 2, 292, 53);
    g.fillStyle(0xFFFFFF, 0.48).fillEllipse(p.x - 48, p.y - 15, 92, 16);
    g.lineStyle(3, 0x6C3F0E, 0.55).strokeEllipse(p.x, p.y, 368, 102);
  }

  // ---------------------------------------------------------------- 音效
  const Sound = (function () {
    let ctx = null;
    let master = null;
    function ensure() {
      if (ctx) return ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.3;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
      return ctx;
    }
    function resume() {
      const c = ensure();
      if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* ignore */ } }
    }
    function tone(freq, dur, vol, delay, type) {
      const c = ensure();
      if (!c) return;
      try {
        const t0 = c.currentTime + (delay || 0);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }
    function sweep(from, to, dur, vol, type) {
      const c = ensure();
      if (!c) return;
      try {
        const t0 = c.currentTime;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(from, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }
    return {
      resume: resume,
      pick: function () { tone(720, 0.06, 0.028, 0, 'triangle'); },
      pour: function (key) {
        const base = key === 'red' ? 392 : key === 'green' ? 494 : 587;
        tone(base, 0.16, 0.035, 0, 'sine');
        tone(base * 1.26, 0.22, 0.024, 0.06, 'triangle');
      },
      mix: function () {
        tone(523.25, 0.32, 0.022, 0, 'sine');
        tone(659.25, 0.35, 0.019, 0.04, 'sine');
        tone(783.99, 0.38, 0.016, 0.08, 'sine');
      },
      reset: function () { sweep(520, 130, 0.42, 0.034, 'triangle'); },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class ColorScene extends Phaser.Scene {
    constructor() {
      super('ColorScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH,
        HEIGHT: HEIGHT,
        PRIMARY_KEYS: PRIMARY_KEYS.slice(),
        PIGMENTS: {
          red: PIGMENTS.red.slice(), green: PIGMENTS.green.slice(), blue: PIGMENTS.blue.slice(),
        },
        PURE_COLORS: Object.assign({}, PURE_COLORS),
        POT: Object.assign({}, POT),
        BOTTLES: BOTTLES.map(function (b) { return Object.assign({}, b); }),
        RESET: Object.assign({}, this.L.reset),
        EMPTY_COLOR: EMPTY_COLOR,
        MIX_SEC: MIX_SEC,
        DEPTH: Object.assign({}, DEPTH),
      };
      this.parts = { red: 0, green: 0, blue: 0 };
      this.potColor = EMPTY_COLOR;
      this.targetColor = EMPTY_COLOR;
      this.potRgb = hexToRgb(EMPTY_COLOR);
      this.drag = null;
      this.flyBack = null;
      this.activePointerId = null;
      this.liveProps = [];
      this.clock = 0;
      this.potDirty = true;
      this.bottleConts = [];
      this.lastHover = false;

      Sound.resume();

      this.roomG = this.add.graphics().setDepth(DEPTH.room);
      drawRoom(this.roomG);

      this.potGlowG = this.add.graphics().setDepth(DEPTH.pot - 0.2).setVisible(false);
      this.potGlowG.fillStyle(0xF8D36C, 0.17).fillEllipse(POT.x, POT.y, 430, 190);
      this.potGlowG.lineStyle(6, 0xFFE59A, 0.68).strokeEllipse(POT.x, POT.y, 376, 118);

      this.potG = this.add.graphics().setDepth(DEPTH.pot);
      drawCauldronBase(this.potG);
      this.liquidG = this.add.graphics().setDepth(DEPTH.liquid);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.ghostG = this.add.graphics().setDepth(DEPTH.ghost);

      this.buildUi();
      this.buildBottles();
      this.redrawLiquid();

      this.input.on('pointerdown', this.onPointerDown, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointerupoutside', this.onPointerUp, this);
    }

    buildUi() {
      const L = this.L;
      this.titleText = this.add.text(L.title.x, L.title.y, '颜色魔法屋', {
        fontFamily: FONT, fontSize: '35px', fontStyle: 'bold', color: '#FFF3D2',
        stroke: '#2A174D', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.subText = this.add.text(L.subtitle.x, L.subtitle.y, '拖一瓶倒进锅里，看看会变成什么颜色', {
        fontFamily: FONT, fontSize: '14px', color: '#CBBFF0',
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.resetG = this.add.graphics().setDepth(DEPTH.ui);
      this.drawResetButton();
      this.resetText = this.add.text(L.reset.x, L.reset.y + 1, '重置', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#FFF8E8',
        stroke: '#883047', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.nameG = this.add.graphics().setDepth(DEPTH.ui - 0.5);
      this.nameG.fillStyle(0x100A28, 0.56).fillRoundedRect(L.name.x - 125, L.name.y - 24, 250, 48, 24);
      this.nameG.lineStyle(2, 0x9D82D9, 0.38).strokeRoundedRect(L.name.x - 124, L.name.y - 23, 248, 46, 23);
      this.nameText = this.add.text(L.name.x, L.name.y, '空空的魔法锅', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFF2CA',
      }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.hintText = this.add.text(L.hint.x, L.hint.y, '每次拖一瓶，松手就倒进去一份', {
        fontFamily: FONT, fontSize: '13px', color: '#AE9ED6',
      }).setOrigin(0.5).setDepth(DEPTH.ui);
    }

    drawResetButton() {
      const r = this.L.reset;
      const g = this.resetG;
      g.clear();
      g.fillStyle(0x09041A, 0.45).fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2 + 5, r.w, r.h, r.h / 2);
      g.fillStyle(0xE75367, 1).fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
      g.fillStyle(0xFF9B91, 0.65).fillRoundedRect(r.x - r.w / 2 + 5, r.y - r.h / 2 + 5, r.w - 10, 16, 8);
      g.lineStyle(2, 0xFFC5A8, 0.5).strokeRoundedRect(r.x - r.w / 2 + 1, r.y - r.h / 2 + 1, r.w - 2, r.h - 2, r.h / 2 - 1);
    }

    buildBottles() {
      for (let i = 0; i < BOTTLES.length; i++) {
        const b = BOTTLES[i];
        const glow = this.add.graphics();
        glow.fillStyle(PURE_COLORS[b.key], 0.17).fillCircle(0, 18, 61);
        glow.fillStyle(PURE_COLORS[b.key], 0.08).fillCircle(0, 18, 77);
        const body = this.add.graphics();
        drawBottleShape(body, b.key, 0, 0, 1, 0);
        const label = this.add.text(b.x, 906, b.name, {
          fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#F6EBD3',
          stroke: '#251532', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(DEPTH.ui);
        const cont = this.add.container(b.x, b.y).setDepth(DEPTH.bottles);
        cont.add([glow, body]);
        this.bottleConts.push({ key: b.key, cont: cont, label: label });
      }
    }

    // -------------------------------------------------- 命中
    bottleAt(x, y) {
      for (let i = 0; i < BOTTLES.length; i++) {
        const b = BOTTLES[i];
        const dx = (x - b.x) / b.rx;
        const dy = (y - b.y) / b.ry;
        if (dx * dx + dy * dy <= 1) return b.key;
      }
      return null;
    }

    potContains(x, y) {
      if (!isFinite(x) || !isFinite(y)) return false;
      const dx = (x - POT.x) / POT.hitRx;
      const dy = (y - (POT.y + 10)) / POT.hitRy;
      return dx * dx + dy * dy <= 1;
    }

    // -------------------------------------------------- 调色
    mixTarget(parts) { return mixTarget(parts || this.parts); }

    colorName(hex, parts) { return colorName(hex, parts || this.parts); }

    addColor(key) {
      if (PRIMARY_KEYS.indexOf(key) < 0) return false;
      this.parts[key] += 1;
      this.targetColor = mixTarget(this.parts);
      this.nameText.setText(colorName(this.targetColor, this.parts));
      this.spawnPourFx(key);
      Sound.pour(key);
      Sound.mix();
      return true;
    }

    resetPot() {
      const had = this.parts.red + this.parts.green + this.parts.blue > 0 || !!this.drag;
      if (this.activePointerId != null) this.restoreBottle(this.drag && this.drag.key);
      this.parts = { red: 0, green: 0, blue: 0 };
      this.targetColor = EMPTY_COLOR;
      this.drag = null;
      this.flyBack = null;
      this.activePointerId = null;
      this.ghostG.clear();
      this.potGlowG.setVisible(false);
      this.nameText.setText('空空的魔法锅');
      this.liveProps.length = 0;
      this.fxG.clear();
      if (had) Sound.reset();
      return true;
    }

    restoreBottle(key) {
      for (let i = 0; i < this.bottleConts.length; i++) {
        if (this.bottleConts[i].key === key) this.bottleConts[i].cont.setAlpha(1);
      }
    }

    dimBottle(key) {
      for (let i = 0; i < this.bottleConts.length; i++) {
        if (this.bottleConts[i].key === key) this.bottleConts[i].cont.setAlpha(0.28);
      }
    }

    // -------------------------------------------------- 绘制液体与特效
    redrawLiquid() {
      const g = this.liquidG;
      const col = this.potColor;
      g.clear();
      g.fillStyle(darken(col, 0.35), 1).fillEllipse(POT.x, POT.y + 22, 272, 38);
      g.fillStyle(col, 1).fillEllipse(POT.x, POT.y + 5, 284, 54);
      g.fillStyle(lighten(col, 0.16), 0.54).fillEllipse(POT.x - 35, POT.y - 8, 118, 15);
      g.fillStyle(lighten(col, 0.42), 0.38).fillEllipse(POT.x + 52, POT.y + 6, 54, 9);
      g.lineStyle(2, lighten(col, 0.5), 0.42).strokeEllipse(POT.x, POT.y + 4, 278, 50);

      // 只有混入颜色后，液面才浮出三种颜料的细丝。
      const total = this.parts.red + this.parts.green + this.parts.blue;
      if (total > 0) {
        let offset = 0;
        for (let i = 0; i < PRIMARY_KEYS.length; i++) {
          const key = PRIMARY_KEYS[i];
          const n = this.parts[key];
          if (!n) continue;
          const x = POT.x - 74 + offset * 74;
          g.lineStyle(3, PURE_COLORS[key], 0.25 + 0.26 * (n / total));
          g.beginPath();
          g.arc(x, POT.y + 2, 36 + i * 6, Math.PI * 0.15, Math.PI * 0.9, false);
          g.strokePath();
          offset += 1;
        }
      }
    }

    spawnPourFx(key) {
      const base = PURE_COLORS[key];
      for (let i = 0; i < 11; i++) {
        const a = Math.random() * TAU;
        const rr = Math.random() * 90;
        this.liveProps.push({
          kind: 'bubble',
          x: POT.x + Math.cos(a) * rr,
          y: POT.y + 4 + Math.sin(a) * rr * 0.22,
          vx: (Math.random() * 2 - 1) * 24,
          vy: 34 + Math.random() * 58,
          r: 3 + Math.random() * 7,
          life: 0.7 + Math.random() * 0.9,
          maxLife: 1.6,
          color: blend(base, 0xFFFFFF, 0.28 + Math.random() * 0.25),
        });
      }
      for (let i = 0; i < 7; i++) {
        this.liveProps.push({
          kind: 'star',
          x: POT.x + (Math.random() * 2 - 1) * 120,
          y: POT.y - 15 - Math.random() * 45,
          vx: (Math.random() * 2 - 1) * 45,
          vy: -45 - Math.random() * 60,
          r: 3 + Math.random() * 4,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 5,
          life: 0.8 + Math.random() * 0.7,
          maxLife: 1.5,
          color: i % 3 === 0 ? 0xFFF0B0 : base,
        });
      }
      this.liveProps.push({
        kind: 'ripple',
        x: POT.x,
        y: POT.y + 5,
        r: 25,
        life: 0.8,
        maxLife: 0.8,
        color: blend(base, 0xFFFFFF, 0.35),
      });
    }

    updateFx(dt) {
      if (!this.fxG) return;
      this.fxG.clear();
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const p = this.liveProps[i];
        p.life -= dt;
        if (p.life <= 0) { this.liveProps.splice(i, 1); continue; }
        const fade = clamp(p.life / Math.min(0.45, p.maxLife), 0, 1);
        if (p.kind === 'bubble') {
          p.x += p.vx * dt;
          p.y -= p.vy * dt;
          this.fxG.lineStyle(2.4, p.color, 0.55 * fade).strokeCircle(p.x, p.y, p.r);
          this.fxG.fillStyle(0xFFFFFF, 0.28 * fade).fillCircle(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.25);
        } else if (p.kind === 'star') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          drawStar(this.fxG, p.x, p.y, p.r, p.color, 0.9 * fade, 4);
        } else {
          p.r += 150 * dt;
          this.fxG.lineStyle(3, p.color, 0.7 * fade).strokeEllipse(p.x, p.y, p.r * 2, p.r * 0.45);
        }
      }
    }

    // -------------------------------------------------- 拖动
    onPointerDown(pointer) {
      if (this.activePointerId != null) return false;
      Sound.resume();
      const x = pointer.x, y = pointer.y;
      if (containsRect(this.L.reset, x, y)) {
        this.resetPot();
        return true;
      }
      const key = this.bottleAt(x, y);
      if (!key) return false;
      this.activePointerId = pointer.id == null ? 1 : pointer.id;
      this.drag = { key: key, x: x, y: y, ox: 0, oy: 0 };
      for (let i = 0; i < BOTTLES.length; i++) {
        if (BOTTLES[i].key === key) { this.drag.ox = BOTTLES[i].x; this.drag.oy = BOTTLES[i].y; }
      }
      this.dimBottle(key);
      this.nameText.setText('倒一点点吧');
      Sound.pick();
      this.renderGhost();
      return true;
    }

    onPointerMove(pointer) {
      if (!this.drag || this.activePointerId !== (pointer.id == null ? 1 : pointer.id)) return;
      this.drag.x = pointer.x;
      this.drag.y = pointer.y;
      this.renderGhost();
    }

    onPointerUp(pointer) {
      if (this.activePointerId !== (pointer.id == null ? 1 : pointer.id)) return;
      if (!this.drag) {
        this.activePointerId = null;
        return;
      }
      const d = this.drag;
      const x = pointer.x == null ? d.x : pointer.x;
      const y = pointer.y == null ? d.y : pointer.y;
      this.drag = null;
      this.activePointerId = null;
      this.potGlowG.setVisible(false);
      this.restoreBottle(d.key);
      if (this.potContains(x, y)) {
        this.addColor(d.key);
        this.ghostG.clear();
      } else {
        this.flyBack = { key: d.key, x: d.x, y: d.y, ox: d.ox, oy: d.oy, t: 0, dur: 0.24 };
        this.nameText.setText(colorName(this.targetColor, this.parts));
      }
    }

    renderGhost() {
      this.ghostG.clear();
      if (this.drag) {
        const d = this.drag;
        const over = this.potContains(d.x, d.y);
        this.potGlowG.setVisible(over);
        this.lastHover = over;
        if (over) {
          const fromX = d.x + 26;
          const fromY = d.y - 84;
          this.ghostG.lineStyle(5, PURE_COLORS[d.key], 0.7);
          this.ghostG.beginPath();
          this.ghostG.moveTo(fromX, fromY);
          this.ghostG.lineTo(POT.x, POT.y - 4);
          this.ghostG.strokePath();
          this.ghostG.lineStyle(2, 0xFFFFFF, 0.34).lineBetween(fromX, fromY + 2, POT.x - 8, POT.y - 3);
        }
        drawBottleShape(this.ghostG, d.key, d.x, d.y - 48, 1.06, over ? 0.92 : -0.12);
      } else if (this.flyBack) {
        const f = this.flyBack;
        const t = clamp(f.t / f.dur, 0, 1);
        const x = lerp(f.x, f.ox, t);
        const y = lerp(f.y - 48, f.oy, t);
        drawBottleShape(this.ghostG, f.key, x, y, 1.02, lerp(0.3, 0, t));
      }
    }

    // -------------------------------------------------- 每帧
    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.1);
      this.clock += dt;

      if (this.flyBack) {
        this.flyBack.t += dt;
        if (this.flyBack.t >= this.flyBack.dur) this.flyBack = null;
        this.renderGhost();
      }

      const target = hexToRgb(this.targetColor);
      const rate = 7 / MIX_SEC;
      const a = 1 - Math.exp(-rate * dt);
      const dr = target.r - this.potRgb.r;
      const dg = target.g - this.potRgb.g;
      const db = target.b - this.potRgb.b;
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 1.0) {
        this.potRgb.r += dr * a;
        this.potRgb.g += dg * a;
        this.potRgb.b += db * a;
        this.potColor = rgbToHex(this.potRgb.r, this.potRgb.g, this.potRgb.b);
        this.redrawLiquid();
      } else if (this.potColor !== this.targetColor) {
        this.potColor = this.targetColor;
        this.potRgb = { r: target.r, g: target.g, b: target.b };
        this.redrawLiquid();
      }

      if (this.potGlowG.visible) {
        this.potGlowG.setAlpha(0.72 + Math.sin(this.clock * 8) * 0.18);
      }
      this.updateFx(dt);
    }

    simulate(seconds) {
      let left = Math.max(0, Number(seconds) || 0);
      while (left > 0.000001) {
        const dt = Math.min(1 / 60, left);
        this.step(dt);
        left -= dt;
      }
    }

    update(time, delta) {
      this.step((delta || 0) / 1000);
    }
  }

  window.ColorScene = ColorScene;
})();
