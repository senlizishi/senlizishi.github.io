/*
 * 声音花园：540x960 竖屏音乐玩具。
 * 四列是四拍，孩子自由种下六种声音花；小蜜蜂给出结构任务。
 * 全部画面由 Phaser.Graphics / Text 绘制，声音由 WebAudio 合成。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;

  const ROWS = 4;
  const COLS = 4;
  const BEATS = 4;
  const BPM = 96;
  const BEAT_SEC = 60 / BPM;
  const CLEAR_CONFIRM_SEC = 2;
  const TASK_DELAY_SEC = 1.6;
  const TASK_CHECK_SEC = 0.22;
  const MAX_BOARD_FLOWERS = ROWS * COLS;

  const FLOWERS = {
    red: { key: 'red', name: '红莓花', note: 'C4', freq: 261.63, pitch: 0, color: 0xF26170, deep: 0xC93F55, center: 0xFFE08A },
    orange: { key: 'orange', name: '橙铃花', note: 'E4', freq: 329.63, pitch: 1, color: 0xF49A45, deep: 0xC96F2C, center: 0xFFF0B0 },
    yellow: { key: 'yellow', name: '黄铃花', note: 'G4', freq: 392.00, pitch: 2, color: 0xF6D34B, deep: 0xCBA229, center: 0xE88934 },
    green: { key: 'green', name: '绿铃花', note: 'C5', freq: 523.25, pitch: 3, color: 0x73C96A, deep: 0x429C4F, center: 0xFFF6C4 },
    blue: { key: 'blue', name: '蓝铃花', note: 'E5', freq: 659.25, pitch: 4, color: 0x69B8EA, deep: 0x3A84C2, center: 0xFFF0AA },
    purple: { key: 'purple', name: '紫星花', note: 'G5', freq: 783.99, pitch: 5, color: 0xA987DF, deep: 0x7655B2, center: 0xFFE180 },
  };
  const FLOWER_KEYS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
  const INITIAL_CELLS = ['red', 'yellow', 'blue', null];

  const TASKS = [
    { id: 'everyBeat', title: '每一拍都有声音', hint: '四个节拍都种上花' },
    { id: 'sameNeighbor', title: '让两拍听起来一样', hint: '相邻两列种一样的花' },
    { id: 'fourKinds', title: '种出四种不同的花', hint: '颜色和形状都不一样' },
    { id: 'stairsUp', title: '做一段越走越高的旋律', hint: '连着三格，一阶比一阶高' },
    { id: 'softLoud', title: '一拍轻轻，一拍热闹', hint: '一列 1 朵，另一列至少 3 朵' },
    { id: 'highLow', title: '高低声音住在一起', hint: '同一列有低音也有高音' },
  ];
  const TASK_IDS = TASKS.map(function (t) { return t.id; });

  const C = {
    skyTop: 0x8BD9F4,
    skyMid: 0xD9F4F3,
    skyBottom: 0xFFF6D5,
    sun: 0xFFDE6F,
    sunPale: 0xFFF1A7,
    hill: 0x87D39A,
    hillDeep: 0x62B780,
    grass: 0x78C96F,
    grassDeep: 0x4C9E5D,
    grassLight: 0xBCEB9E,
    wood: 0xDBA65F,
    woodLight: 0xF6D28E,
    woodDark: 0x8A5635,
    soil: 0xAD7048,
    soilLight: 0xD39763,
    soilDark: 0x71452E,
    cream: 0xFFF9E8,
    creamDeep: 0xFFE6B2,
    ink: 0x49382E,
    inkSoft: 0x765F50,
    green: 0x4A9A55,
    greenDeep: 0x2E713C,
    gold: 0xF7C83E,
    goldDeep: 0xAD7617,
    coral: 0xF17A7B,
    coralDeep: 0xB9464F,
    blue: 0x5AA8DB,
    blueDeep: 0x3373A3,
    purple: 0x9A7CDA,
    leafPale: 0xD8F1B3,
    petalPale: 0xFFE6EC,
    white: 0xFFFFFF,
    shadow: 0x2D5235,
  };

  const DEPTH = {
    world: 0,
    board: 2,
    task: 4,
    bee: 5,
    palette: 7,
    controls: 8,
    fx: 12,
    text: 20,
    overlay: 40,
  };

  const L = computeLayout();

  function computeLayout() {
    const pad = 16;
    const cell = 96;
    const gap = 16;
    const board = { x: 38, y: 212, w: 464, h: 464, pad: pad, cell: cell, gap: gap };
    const cells = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        cells.push({
          index: row * COLS + col,
          row: row,
          col: col,
          x: board.x + pad + cell / 2 + col * (cell + gap),
          y: board.y + pad + cell / 2 + row * (cell + gap),
          size: cell,
        });
      }
    }
    const palette = { x: 34, y: 706, w: 472, h: 102 };
    const paletteItems = [];
    for (let i = 0; i < FLOWER_KEYS.length; i++) {
      paletteItems.push({
        key: FLOWER_KEYS[i],
        x: 68 + i * 80,
        y: 742,
        r: 31,
        hit: { x: 28 + i * 80, y: 708, w: 80, h: 96 },
      });
    }
    return {
      title: { x: WIDTH / 2, y: 48 },
      subtitle: { x: WIDTH / 2, y: 82 },
      task: { x: 46, y: 106, w: 448, h: 82 },
      taskSwap: { x: 438, y: 147, w: 82, h: 34 },
      board: board,
      cells: cells,
      beatY: 691,
      palette: palette,
      paletteItems: paletteItems,
      shovel: { x: 86, y: 850, w: 92, h: 50 },
      play: { x: 270, y: 850, w: 196, h: 58 },
      clear: { x: 454, y: 850, w: 94, h: 50 },
      hint: { x: WIDTH / 2, y: 910 },
      beeIdle: { x: 456, y: 196 },
    };
  }

  const SCENE_CONST = {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    ROWS: ROWS,
    COLS: COLS,
    BEATS: BEATS,
    BPM: BPM,
    BEAT_SEC: BEAT_SEC,
    FLOWER_KEYS: FLOWER_KEYS.slice(),
    INITIAL_CELLS: INITIAL_CELLS.slice(),
    TASK_IDS: TASK_IDS.slice(),
    CLEAR_CONFIRM_SEC: CLEAR_CONFIRM_SEC,
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function containsRect(r, x, y) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }
  function containsBox(r, x, y) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function shade(hex, factor) {
    const r = clamp(Math.round(((hex >> 16) & 255) * factor), 0, 255);
    const g = clamp(Math.round(((hex >> 8) & 255) * factor), 0, 255);
    const b = clamp(Math.round((hex & 255) * factor), 0, 255);
    return (r << 16) | (g << 8) | b;
  }
  function mixHex(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
  }
  function shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function drawPill(g, x, y, w, h, fill, stroke, lineWidth, alpha) {
    g.fillStyle(fill, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    if (stroke != null) {
      g.lineStyle(lineWidth || 2, stroke, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    }
  }

  function drawStar(g, x, y, r, color, points, alpha) {
    const n = points || 5;
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rr = i % 2 === 0 ? r : r * 0.44;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  function drawSparkle(g, x, y, r, color, alpha) {
    g.fillStyle(color, alpha == null ? 0.8 : alpha);
    g.fillTriangle(x, y - r, x + r * 0.3, y - r * 0.18, x + r, y);
    g.fillTriangle(x, y + r, x + r * 0.3, y + r * 0.18, x + r, y);
    g.fillTriangle(x, y - r, x - r * 0.3, y - r * 0.18, x - r, y);
    g.fillTriangle(x, y + r, x - r * 0.3, y + r * 0.18, x - r, y);
    g.fillCircle(x, y, r * 0.2);
  }

  function drawLeafSprig(g, x, y, scale, color, flip) {
    const dir = flip ? -1 : 1;
    g.lineStyle(2.2 * scale, color, 0.72);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + dir * 12 * scale, y - 7 * scale);
    g.lineTo(x + dir * 25 * scale, y - 5 * scale);
    g.strokePath();
    g.fillStyle(color, 0.8);
    g.fillEllipse(x + dir * 12 * scale, y - 10 * scale, 12 * scale, 6 * scale);
    g.fillEllipse(x + dir * 20 * scale, y - 9 * scale, 11 * scale, 5 * scale);
    g.fillStyle(shade(color, 1.2), 0.56);
    g.fillCircle(x + dir * 10 * scale, y - 11 * scale, 1.5 * scale);
  }

  function drawCloud(g, x, y, s) {
    g.fillStyle(C.white, 0.72);
    g.fillEllipse(x, y, 76 * s, 25 * s);
    g.fillCircle(x - 24 * s, y - 2 * s, 16 * s);
    g.fillCircle(x - 3 * s, y - 13 * s, 20 * s);
    g.fillCircle(x + 23 * s, y - 2 * s, 15 * s);
  }

  function drawLeaf(g, x, y, r, angle, color) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const px = x + ca * r * 0.55;
    const py = y + sa * r * 0.55;
    g.fillStyle(color, 0.96);
    g.fillCircle(px, py, r * 0.32);
    g.fillCircle(x + ca * r * 0.82, y + sa * r * 0.82, r * 0.22);
  }

  function drawFlower(g, x, y, r, key, opts) {
    const f = FLOWERS[key];
    if (!f) return;
    const o = opts || {};
    const alpha = o.alpha == null ? 1 : o.alpha;
    const scale = o.scale == null ? 1 : o.scale;
    const rr = r * scale;
    const sway = o.sway || 0;
    const hx = x + sway * rr;
    const stem = o.icon ? false : true;

    if (stem) {
      g.fillStyle(0x4B321F, 0.16 * alpha);
      g.fillEllipse(x + rr * 0.15, y + rr * 1.38, rr * 1.35, rr * 0.34);
      g.lineStyle(Math.max(2.5, rr * 0.16), 0x3F8347, alpha);
      g.beginPath();
      g.moveTo(x, y + rr * 0.4);
      g.lineTo(x + sway * rr * 0.42, y + rr * 0.9);
      g.lineTo(hx, y + rr * 1.33);
      g.strokePath();
      g.lineStyle(Math.max(1, rr * 0.052), C.leafPale, 0.44 * alpha);
      g.lineBetween(x + rr * 0.03, y + rr * 0.5, hx + rr * 0.025, y + rr * 1.17);
      drawLeaf(g, x + sway * rr * 0.18, y + rr * 1.01, rr * 0.64, -0.58, C.green);
      drawLeaf(g, x + sway * rr * 0.24, y + rr * 1.13, rr * 0.56, Math.PI + 0.42, shade(C.green, 1.12));
      g.fillStyle(0xFFFFFF, 0.28 * alpha);
      g.fillCircle(x + sway * rr * 0.17 - rr * 0.1, y + rr * 0.98, rr * 0.055);
    }

    g.fillStyle(f.color, 0.14 * alpha);
    g.fillCircle(hx, y, rr * 1.17);
    g.fillStyle(f.color, 0.08 * alpha);
    g.fillCircle(hx, y, rr * 1.4);

    if (key === 'red') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * TAU / 5;
        const px = hx + Math.cos(a) * rr * 0.44;
        const py = y + Math.sin(a) * rr * 0.44;
        g.fillStyle(f.deep, 0.72 * alpha);
        g.fillCircle(px, py, rr * 0.42);
        g.fillStyle(i % 2 === 0 ? f.color : shade(f.color, 1.09), alpha);
        g.fillCircle(px, py, rr * 0.36);
        g.fillStyle(0xFFFFFF, 0.2 * alpha);
        g.fillCircle(px - rr * 0.1, py - rr * 0.11, rr * 0.1);
      }
      g.fillStyle(f.center, alpha);
      g.fillCircle(hx, y, rr * 0.32);
      g.lineStyle(rr * 0.055, 0xFFFFFF, 0.38 * alpha);
      g.strokeCircle(hx, y, rr * 0.22);
      g.fillStyle(0xFFFFFF, 0.56 * alpha);
      g.fillCircle(hx - rr * 0.09, y - rr * 0.11, rr * 0.075);
    } else if (key === 'orange') {
      g.fillStyle(f.deep, 0.9 * alpha);
      g.beginPath();
      g.moveTo(hx - rr * 0.56, y - rr * 0.49);
      g.lineTo(hx + rr * 0.56, y - rr * 0.49);
      g.lineTo(hx + rr * 0.81, y + rr * 0.33);
      g.lineTo(hx, y + rr * 0.65);
      g.lineTo(hx - rr * 0.81, y + rr * 0.33);
      g.closePath();
      g.fillPath();
      g.fillStyle(f.color, alpha);
      g.beginPath();
      g.moveTo(hx - rr * 0.48, y - rr * 0.41);
      g.lineTo(hx + rr * 0.48, y - rr * 0.41);
      g.lineTo(hx + rr * 0.69, y + rr * 0.29);
      g.lineTo(hx, y + rr * 0.55);
      g.lineTo(hx - rr * 0.69, y + rr * 0.29);
      g.closePath();
      g.fillPath();
      g.fillStyle(shade(f.color, 1.15), alpha);
      g.fillCircle(hx - rr * 0.34, y - rr * 0.22, rr * 0.11);
      g.lineStyle(rr * 0.055, 0xFFFFFF, 0.26 * alpha);
      g.lineBetween(hx - rr * 0.3, y - rr * 0.31, hx - rr * 0.12, y + rr * 0.16);
      g.fillStyle(f.deep, 0.62 * alpha);
      g.fillEllipse(hx, y + rr * 0.48, rr * 0.54, rr * 0.16);
      g.fillStyle(f.center, alpha);
      g.fillCircle(hx, y - rr * 0.69, rr * 0.16);
      g.fillStyle(C.greenDeep, alpha);
      g.fillCircle(hx, y - rr * 0.48, rr * 0.09);
    } else if (key === 'yellow') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * TAU / 6;
        const tx = hx + Math.cos(a) * rr * 0.78;
        const ty = y + Math.sin(a) * rr * 0.78;
        g.fillStyle(f.deep, 0.68 * alpha);
        g.beginPath();
        g.moveTo(hx + Math.cos(a + 0.47) * rr * 0.27, y + Math.sin(a + 0.47) * rr * 0.27);
        g.lineTo(tx, ty);
        g.lineTo(hx + Math.cos(a - 0.47) * rr * 0.27, y + Math.sin(a - 0.47) * rr * 0.27);
        g.closePath();
        g.fillPath();
        g.fillStyle(i % 2 === 0 ? f.color : shade(f.color, 1.08), alpha);
        g.beginPath();
        g.moveTo(hx + Math.cos(a + 0.36) * rr * 0.24, y + Math.sin(a + 0.36) * rr * 0.24);
        g.lineTo(hx + Math.cos(a) * rr * 0.68, y + Math.sin(a) * rr * 0.68);
        g.lineTo(hx + Math.cos(a - 0.36) * rr * 0.24, y + Math.sin(a - 0.36) * rr * 0.24);
        g.closePath();
        g.fillPath();
      }
      g.fillStyle(f.center, alpha);
      g.fillCircle(hx, y, rr * 0.31);
      g.lineStyle(rr * 0.05, 0xFFFFFF, 0.44 * alpha);
      g.strokeCircle(hx, y, rr * 0.2);
      g.fillStyle(f.deep, 0.55 * alpha);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5;
        g.fillCircle(hx + Math.cos(a) * rr * 0.17, y + Math.sin(a) * rr * 0.17, rr * 0.035);
      }
    } else if (key === 'green') {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * TAU / 4;
        const px = hx + Math.cos(a) * rr * 0.42;
        const py = y + Math.sin(a) * rr * 0.42;
        g.fillStyle(f.deep, 0.68 * alpha);
        g.fillCircle(px, py, rr * 0.43);
        g.fillStyle(i % 2 === 0 ? f.color : shade(f.color, 1.12), alpha);
        g.fillCircle(px, py, rr * 0.37);
        g.fillStyle(0xFFFFFF, 0.24 * alpha);
        g.fillCircle(px - rr * 0.09, py - rr * 0.1, rr * 0.1);
        g.lineStyle(rr * 0.035, 0xFFFFFF, 0.24 * alpha);
        g.lineBetween(px - Math.cos(a) * rr * 0.24, py - Math.sin(a) * rr * 0.24, px + Math.cos(a) * rr * 0.2, py + Math.sin(a) * rr * 0.2);
      }
      g.fillStyle(f.center, alpha);
      g.fillCircle(hx, y, rr * 0.27);
      g.fillStyle(f.deep, 0.7 * alpha);
      g.fillCircle(hx, y, rr * 0.1);
    } else if (key === 'blue') {
      g.fillStyle(f.deep, 0.82 * alpha);
      g.fillCircle(hx - rr * 0.34, y - rr * 0.18, rr * 0.35);
      g.fillCircle(hx, y - rr * 0.36, rr * 0.39);
      g.fillCircle(hx + rr * 0.34, y - rr * 0.18, rr * 0.35);
      g.fillCircle(hx - rr * 0.3, y + rr * 0.25, rr * 0.31);
      g.fillCircle(hx + rr * 0.3, y + rr * 0.25, rr * 0.31);
      g.fillStyle(f.color, alpha);
      g.fillCircle(hx - rr * 0.33, y - rr * 0.19, rr * 0.3);
      g.fillCircle(hx, y - rr * 0.36, rr * 0.34);
      g.fillCircle(hx + rr * 0.33, y - rr * 0.19, rr * 0.3);
      g.fillStyle(shade(f.color, 0.94), alpha);
      g.fillCircle(hx - rr * 0.29, y + rr * 0.23, rr * 0.27);
      g.fillCircle(hx + rr * 0.29, y + rr * 0.23, rr * 0.27);
      g.fillStyle(0xFFFFFF, 0.24 * alpha);
      g.fillCircle(hx - rr * 0.06, y - rr * 0.48, rr * 0.11);
      g.fillCircle(hx - rr * 0.46, y - rr * 0.25, rr * 0.07);
      g.fillStyle(f.deep, 0.58 * alpha);
      g.fillEllipse(hx, y + rr * 0.4, rr * 0.62, rr * 0.17);
      g.fillStyle(f.center, alpha);
      g.fillCircle(hx, y, rr * 0.23);
      g.fillStyle(0xFFFFFF, 0.55 * alpha);
      g.fillCircle(hx - rr * 0.06, y - rr * 0.07, rr * 0.07);
    } else {
      drawStar(g, hx, y + rr * 0.03, rr * 1.01, f.deep, 6, 0.64 * alpha);
      drawStar(g, hx, y, rr * 0.91, f.color, 6, alpha);
      drawStar(g, hx, y, rr * 0.5, f.center, 6, alpha);
      g.fillStyle(f.deep, 0.42 * alpha);
      g.fillCircle(hx, y, rr * 0.16);
      g.fillStyle(0xFFFFFF, 0.58 * alpha);
      g.fillCircle(hx - rr * 0.05, y - rr * 0.07, rr * 0.065);
      drawSparkle(g, hx + rr * 0.76, y - rr * 0.54, rr * 0.13, 0xFFFFFF, 0.7 * alpha);
    }
  }

  function drawBee(g, x, y, size, wing, happy) {
    const s = size || 1;
    const flap = 0.62 + Math.abs(Math.sin(wing || 0)) * 0.38;
    g.fillStyle(0x315237, 0.14);
    g.fillEllipse(x + 1, y + 15 * s, 38 * s, 10 * s);
    g.fillStyle(0xE9FBFF, 0.78);
    g.fillEllipse(x - 11 * s, y - 11 * s, 19 * s, 12 * s * flap);
    g.fillEllipse(x + 9 * s, y - 12 * s, 18 * s, 11 * s * flap);
    g.fillStyle(0xBFEAFF, 0.4);
    g.fillEllipse(x - 14 * s, y - 12 * s, 10 * s, 6 * s * flap);
    g.fillEllipse(x + 6 * s, y - 13 * s, 9 * s, 5.5 * s * flap);
    g.lineStyle(1.5, 0x69837C, 0.55);
    g.strokeEllipse(x - 11 * s, y - 11 * s, 19 * s, 12 * s * flap);
    g.strokeEllipse(x + 9 * s, y - 12 * s, 18 * s, 11 * s * flap);

    g.fillStyle(0x5E4729, 1);
    g.fillEllipse(x, y, 36 * s, 26 * s);
    g.fillCircle(x - 17 * s, y - 2 * s, 10.8 * s);
    g.fillStyle(0xFFD447, 1);
    g.fillEllipse(x, y - 0.5 * s, 32 * s, 22 * s);
    g.fillStyle(0xFFFFFF, 0.26);
    g.fillEllipse(x + 2 * s, y - 8 * s, 18 * s, 5 * s);
    g.fillStyle(0x4B3826, 1);
    g.fillEllipse(x - 7 * s, y, 6 * s, 20 * s);
    g.fillEllipse(x + 6 * s, y - 0.5 * s, 5 * s, 18 * s);
    g.fillStyle(0x4B3826, 1);
    g.fillCircle(x - 17 * s, y - 2 * s, 10.8 * s);
    g.fillStyle(0xFFD447, 1);
    g.fillCircle(x - 17 * s, y - 2.4 * s, 9.1 * s);
    g.fillStyle(0xFFF0A0, 0.42);
    g.fillCircle(x - 19 * s, y - 6 * s, 4.2 * s);

    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(x - 20.2 * s, y - 5 * s, 3.5 * s);
    g.fillStyle(0x2F281F, 1);
    g.fillCircle(x - 21.1 * s, y - 5 * s, 1.9 * s);
    g.fillStyle(0xFFFFFF, 0.92);
    g.fillCircle(x - 21.7 * s, y - 5.8 * s, 0.75 * s);
    g.fillStyle(0xFFA4AA, 0.62);
    g.fillCircle(x - 23 * s, y + 1 * s, 2.1 * s);
    g.lineStyle(1.5 * s, 0x4B3B2A, 1);
    g.beginPath();
    g.moveTo(x - 21 * s, y + 4 * s);
    g.lineTo(x - 17 * s, y + 6 * s);
    g.lineTo(x - 13 * s, y + 4 * s);
    g.strokePath();

    g.lineStyle(2.1 * s, 0x4B3B2A, 0.9);
    g.beginPath();
    g.moveTo(x - 19 * s, y - 10 * s);
    g.lineTo(x - 24 * s, y - 19 * s);
    g.strokePath();
    g.beginPath();
    g.moveTo(x - 12 * s, y - 11 * s);
    g.lineTo(x - 9 * s, y - 20 * s);
    g.strokePath();
    g.fillStyle(0x4B3B2A, 0.94);
    g.fillCircle(x - 24 * s, y - 19 * s, 2 * s);
    g.fillCircle(x - 9 * s, y - 20 * s, 2 * s);

    g.fillStyle(0x5AB568, 0.95);
    g.fillCircle(x - 9 * s, y - 3 * s, 3 * s);
    g.fillTriangle(x - 9 * s, y - 2 * s, x - 13 * s, y + 4 * s, x - 6 * s, y + 4 * s);
    g.fillStyle(C.petalPale, 0.8);
    g.fillCircle(x + 14 * s, y + 7 * s, 2.1 * s);

    if (happy) {
      g.fillStyle(0xFF6D87, 1);
      g.fillCircle(x + 28 * s, y - 24 * s + Math.sin((wing || 0) * 1.6) * 2, 3 * s);
    }
  }

  function drawTaskIcon(g, id, cx, cy, s) {
    const scale = s / 24;
    if (id === 'everyBeat') {
      for (let i = 0; i < 4; i++) {
        const x = cx + (i - 1.5) * 9 * scale;
        g.fillStyle(i < 3 ? C.gold : C.green, 1);
        g.fillCircle(x, cy, 5.2 * scale);
        g.fillStyle(0xFFFFFF, 0.7);
        g.fillCircle(x - 1.5 * scale, cy - 1.6 * scale, 1.2 * scale);
      }
      g.lineStyle(2 * scale, C.greenDeep, 1);
      g.lineBetween(cx - 19 * scale, cy + 9 * scale, cx + 19 * scale, cy + 9 * scale);
    } else if (id === 'sameNeighbor') {
      drawFlower(g, cx - 12 * scale - 2 * scale, cy - 2 * scale, 11 * scale, 'orange', { icon: true });
      drawFlower(g, cx + 12 * scale + 2 * scale, cy - 2 * scale, 11 * scale, 'orange', { icon: true });
      g.lineStyle(2.5 * scale, C.ink, 0.85);
      g.lineBetween(cx - 3.5 * scale, cy - 2 * scale, cx + 3.5 * scale, cy - 2 * scale);
      g.lineBetween(cx - 3.5 * scale, cy + 2 * scale, cx + 3.5 * scale, cy + 2 * scale);
    } else if (id === 'fourKinds') {
      const colors = ['red', 'yellow', 'green', 'purple'];
      const pos = [[-11, -9], [11, -9], [-11, 11], [11, 11]];
      for (let i = 0; i < colors.length; i++) {
        drawFlower(g, cx + pos[i][0] * scale, cy + pos[i][1] * scale, 9 * scale, colors[i], { icon: true });
      }
    } else if (id === 'stairsUp') {
      g.fillStyle(C.green, 0.95);
      g.fillRoundedRect(cx - 21 * scale, cy + 8 * scale, 12 * scale, 8 * scale, 3 * scale);
      g.fillStyle(C.gold, 0.98);
      g.fillRoundedRect(cx - 8 * scale, cy - 1 * scale, 12 * scale, 17 * scale, 3 * scale);
      g.fillStyle(C.coral, 0.98);
      g.fillRoundedRect(cx + 5 * scale, cy - 10 * scale, 12 * scale, 26 * scale, 3 * scale);
      g.lineStyle(2 * scale, C.ink, 0.7);
      g.lineBetween(cx - 17 * scale, cy + 8 * scale, cx + 17 * scale, cy - 13 * scale);
      g.fillStyle(C.ink, 0.8);
      g.fillTriangle(cx + 14 * scale, cy - 14 * scale, cx + 20 * scale, cy - 13 * scale, cx + 18 * scale, cy - 7 * scale);
    } else if (id === 'softLoud') {
      drawFlower(g, cx - 15 * scale, cy + 2 * scale, 12 * scale, 'blue', { icon: true });
      drawFlower(g, cx + 7 * scale, cy - 8 * scale, 7 * scale, 'red', { icon: true });
      drawFlower(g, cx + 18 * scale, cy + 2 * scale, 7 * scale, 'red', { icon: true });
      drawFlower(g, cx + 11 * scale, cy + 12 * scale, 7 * scale, 'red', { icon: true });
    } else {
      drawFlower(g, cx, cy + 7 * scale, 11 * scale, 'orange', { icon: true });
      drawFlower(g, cx, cy - 12 * scale, 10 * scale, 'purple', { icon: true });
      g.lineStyle(1.8 * scale, C.ink, 0.7);
      g.lineBetween(cx + 16 * scale, cy - 14 * scale, cx + 16 * scale, cy - 3 * scale);
      g.fillStyle(C.greenDeep, 0.9);
      g.fillTriangle(cx + 16 * scale, cy - 16 * scale, cx + 12 * scale, cy - 8 * scale, cx + 20 * scale, cy - 8 * scale);
      g.fillStyle(C.coral, 0.9);
      g.fillTriangle(cx + 16 * scale, cy + 14 * scale, cx + 20 * scale, cy + 6 * scale, cx + 12 * scale, cy + 6 * scale);
    }
  }

  // ---------------------------------------------------------------- 任务判定
  function cellKey(cell) {
    if (typeof cell === 'string') return cell;
    return cell && cell.key ? cell.key : null;
  }

  function columnCells(cells, col) {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      const cell = cells[r * COLS + col];
      if (cell && cellKey(cell)) out.push(cell);
    }
    return out;
  }

  function columnInfo(cells, col) {
    const keys = [];
    const pitches = [];
    for (let r = 0; r < ROWS; r++) {
      const key = cellKey(cells[r * COLS + col]);
      if (key && FLOWERS[key]) {
        keys.push(key);
        const p = FLOWERS[key].pitch;
        if (pitches.indexOf(p) < 0) pitches.push(p);
      }
    }
    pitches.sort(function (a, b) { return a - b; });
    return { keys: keys, pitches: pitches, count: keys.length };
  }

  function sameNumberList(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function meetsTask(id, cells) {
    if (!Array.isArray(cells) || cells.length < ROWS * COLS) return false;
    if (id === 'everyBeat') {
      for (let c = 0; c < COLS; c++) if (columnInfo(cells, c).count === 0) return false;
      return true;
    }
    if (id === 'sameNeighbor') {
      for (let c = 0; c < COLS - 1; c++) {
        const a = columnInfo(cells, c);
        const b = columnInfo(cells, c + 1);
        if (a.count > 0 && b.count > 0 && sameNumberList(a.pitches, b.pitches)) return true;
      }
      return false;
    }
    if (id === 'fourKinds') {
      const kinds = {};
      let count = 0;
      for (let i = 0; i < cells.length; i++) {
        const key = cellKey(cells[i]);
        if (key && FLOWERS[key] && !kinds[key]) { kinds[key] = true; count++; }
      }
      return count >= 4;
    }
    if (id === 'stairsUp') {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 2; c++) {
          const p0 = FLOWERS[cellKey(cells[r * COLS + c])];
          const p1 = FLOWERS[cellKey(cells[r * COLS + c + 1])];
          const p2 = FLOWERS[cellKey(cells[r * COLS + c + 2])];
          if (p0 && p1 && p2 && p0.pitch < p1.pitch && p1.pitch < p2.pitch) return true;
        }
      }
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 2; r++) {
          const p0 = FLOWERS[cellKey(cells[r * COLS + c])];
          const p1 = FLOWERS[cellKey(cells[(r + 1) * COLS + c])];
          const p2 = FLOWERS[cellKey(cells[(r + 2) * COLS + c])];
          if (p0 && p1 && p2 && p0.pitch < p1.pitch && p1.pitch < p2.pitch) return true;
        }
      }
      return false;
    }
    if (id === 'softLoud') {
      let hasOne = false;
      let hasThree = false;
      for (let c = 0; c < COLS; c++) {
        const n = columnInfo(cells, c).count;
        if (n === 1) hasOne = true;
        if (n >= 3) hasThree = true;
      }
      return hasOne && hasThree;
    }
    if (id === 'highLow') {
      for (let c = 0; c < COLS; c++) {
        let low = false;
        let high = false;
        const col = columnCells(cells, c);
        for (let i = 0; i < col.length; i++) {
          const p = FLOWERS[cellKey(col[i])].pitch;
          if (p <= 2) low = true;
          if (p >= 3) high = true;
        }
        if (low && high) return true;
      }
      return false;
    }
    return false;
  }

  function taskById(id) {
    for (let i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return TASKS[i];
    return null;
  }

  // ---------------------------------------------------------------- 音效
  const GardenAudio = (function () {
    let ctx = null;
    let master = null;
    let muted = false;

    function ensure() {
      if (muted) return null;
      if (ctx) {
        if (ctx.state === 'suspended') {
          try { ctx.resume().catch(function () {}); } catch (e) {}
        }
        return ctx;
      }
      try {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) { muted = true; return null; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.62;
        master.connect(ctx.destination);
        return ctx;
      } catch (e) {
        muted = true;
        ctx = null;
        return null;
      }
    }

    function resume() { ensure(); }

    function tone(freq, opts) {
      const ac = ensure();
      if (!ac) return;
      const o = opts || {};
      const now = ac.currentTime + (o.delay || 0);
      const duration = o.duration || 0.35;
      const volume = Math.max(0.001, o.volume == null ? 0.09 : o.volume);
      try {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(Math.max(30, freq), now);
        if (o.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.endFreq), now + duration);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.025, duration * 0.22));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + duration + 0.03);
      } catch (e) {}
    }

    function flowerTone(key, volume, delay, duration) {
      const f = FLOWERS[key];
      if (!f) return;
      const high = f.pitch >= 3;
      tone(f.freq, {
        type: high ? 'sine' : 'triangle',
        volume: volume == null ? 0.1 : volume,
        duration: duration || (high ? 0.58 : 0.42),
        delay: delay || 0,
      });
      if (high) {
        tone(f.freq * 2.01, {
          type: 'sine',
          volume: (volume == null ? 0.1 : volume) * 0.24,
          duration: 0.34,
          delay: (delay || 0) + 0.008,
        });
      }
    }

    function playColumn(keys) {
      const ac = ensure();
      if (!ac || !keys || !keys.length) return;
      const each = 0.105 / Math.sqrt(keys.length);
      for (let i = 0; i < keys.length; i++) {
        flowerTone(keys[i], each, i * 0.012, keys[i] && FLOWERS[keys[i]].pitch >= 3 ? 0.64 : 0.48);
      }
      tone(142, { type: 'sine', volume: 0.025, duration: 0.07 });
    }

    function suspend() {
      if (ctx && ctx.state === 'running') {
        try { ctx.suspend().catch(function () {}); } catch (e) {}
      }
    }

    function destroy() {
      if (ctx) {
        try { ctx.close().catch(function () {}); } catch (e) {}
      }
      ctx = null;
      master = null;
    }

    return {
      resume: resume,
      suspend: suspend,
      destroy: destroy,
      playColumn: playColumn,
      pick: function () { tone(620, { type: 'sine', volume: 0.055, duration: 0.1, endFreq: 780 }); },
      plant: function (key) { flowerTone(key, 0.1, 0, 0.5); tone(230, { type: 'triangle', volume: 0.035, duration: 0.15 }); },
      uproot: function () { tone(300, { type: 'triangle', volume: 0.055, duration: 0.2, endFreq: 160 }); },
      note: function (key) { flowerTone(key, 0.06, 0, 0.36); },
      beat: function () { tone(132, { type: 'sine', volume: 0.026, duration: 0.07 }); },
      taskSwap: function () { tone(523, { type: 'sine', volume: 0.05, duration: 0.16 }); tone(659, { type: 'sine', volume: 0.045, duration: 0.2, delay: 0.12 }); },
      taskDone: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) tone(notes[i], { type: 'sine', volume: 0.075, duration: 0.62, delay: i * 0.13 });
        flowerTone('green', 0.07, 0.1, 0.75);
      },
      clear: function () { tone(440, { type: 'triangle', volume: 0.045, duration: 0.3, endFreq: 180 }); },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class SoundGardenScene extends Phaser.Scene {
    constructor() {
      super('SoundGardenScene');
      this.CONST = SCENE_CONST;
      this.cells = [];
      this.selected = null;
      this.loopPlaying = false;
      this.beat = 0;
      this.task = null;
      this.taskBusy = false;
      this.completedTasks = 0;
      this.liveProps = 0;
    }

    create() {
      this.CONST = SCENE_CONST;
      this.cells = L.cells.map(function (cell, i) {
        return {
          index: cell.index,
          row: cell.row,
          col: cell.col,
          x: cell.x,
          y: cell.y,
          size: cell.size,
          key: INITIAL_CELLS[i] || null,
        };
      });
      this.selected = null;
      this.loopPlaying = false;
      this.beat = 0;
      this.beatTimer = 0;
      this.clockSec = 0;
      this.currentBeatPulse = 0;
      this.task = null;
      this.taskBusy = false;
      this.taskBusyT = 0;
      this.completedTasks = 0;
      this.checkDelay = 0;
      this.clearArmedUntil = 0;
      this.toastText = '';
      this.toastUntil = 0;
      this.effects = [];
      this.liveProps = 0;
      this.beeX = L.beeIdle.x;
      this.beeY = L.beeIdle.y;
      this.beeWing = 0;
      this._taskDeck = shuffle(TASK_IDS);
      this._lastTaskId = null;
      this._shuttingDown = false;
      this.audio = GardenAudio;

      this.bg = this.add.graphics().setDepth(DEPTH.world);
      this.ambientG = this.add.graphics().setDepth(3);
      this.boardG = this.add.graphics().setDepth(DEPTH.board);
      this.taskG = this.add.graphics().setDepth(DEPTH.task);
      this.beeG = this.add.graphics().setDepth(DEPTH.bee);
      this.paletteG = this.add.graphics().setDepth(DEPTH.palette);
      this.controlsG = this.add.graphics().setDepth(DEPTH.controls);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);

      this.titleText = this.add.text(L.title.x, L.title.y, '声音花园', {
        fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#3E7D4D',
        stroke: '#F7FFF1', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.text);
      this.titleText.setShadow(0, 4, '#C5E7A7', 4, true, true);
      this.subtitleText = this.add.text(L.subtitle.x, L.subtitle.y, '种下会唱歌的花，和小蜜蜂一起编曲子', {
        fontFamily: FONT, fontSize: '14px', color: '#52715A',
      }).setOrigin(0.5).setDepth(DEPTH.text);

      this.taskLabelText = this.add.text(112, 113, '小蜜蜂任务单', {
        fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#A26A2A',
      }).setOrigin(0, 0).setDepth(DEPTH.text);
      this.taskText = this.add.text(112, 128, '', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#4E3C2F', wordWrap: { width: 305 },
      }).setOrigin(0, 0).setDepth(DEPTH.text);
      this.taskHint = this.add.text(112, 152, '', {
        fontFamily: FONT, fontSize: '12px', color: '#7D695C', wordWrap: { width: 305 },
      }).setOrigin(0, 0).setDepth(DEPTH.text);
      this.swapText = this.add.text(L.taskSwap.x, L.taskSwap.y, '换一个', {
        fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#6B4F3D',
      }).setOrigin(0.5).setDepth(DEPTH.text);

      this.beatTexts = [];
      for (let i = 0; i < BEATS; i++) {
        this.beatTexts.push(this.add.text(L.cells[i].x, L.beatY, (i + 1) + ' 拍', {
          fontFamily: FONT, fontSize: '11px', color: '#4E6B52',
        }).setOrigin(0.5).setDepth(DEPTH.text));
      }

      this.paletteTexts = [];
      for (let i = 0; i < L.paletteItems.length; i++) {
        const item = L.paletteItems[i];
        this.paletteTexts.push(this.add.text(item.x, 776, FLOWERS[item.key].name, {
          fontFamily: FONT, fontSize: '10px', color: '#56443A',
        }).setOrigin(0.5).setDepth(DEPTH.text));
      }

      this.playText = this.add.text(L.play.x, L.play.y, '听一听', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#5C5135', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH.text);
      this.playText.setShadow(0, 2, '#435B36', 2, true, true);
      this.shovelText = this.add.text(L.shovel.x + 16, L.shovel.y, '铲子', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#5A4436',
      }).setOrigin(0.5).setDepth(DEPTH.text);
      this.clearText = this.add.text(L.clear.x, L.clear.y, '收好', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#5A4436',
      }).setOrigin(0.5).setDepth(DEPTH.text);
      this.hintText = this.add.text(L.hint.x, L.hint.y, '先选一朵花，再点泥土格子', {
        fontFamily: FONT, fontSize: '13px', color: '#496A51',
      }).setOrigin(0.5).setDepth(DEPTH.text);

      drawWorld(this.bg);
      this.nextTask();
      this.input.on('pointerdown', this.onPointerDown, this);
      this._visibilityHandler = this.onVisibilityChange.bind(this);
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', this._visibilityHandler);
      }
      this.events.once('shutdown', this.onShutdown, this);
      this.render();
    }

    onShutdown() {
      this._shuttingDown = true;
      this.stopLoop();
      if (typeof document !== 'undefined' && document.removeEventListener) {
        document.removeEventListener('visibilitychange', this._visibilityHandler);
      }
      this.audio.destroy();
    }

    onVisibilityChange() {
      if (typeof document !== 'undefined' && document.hidden) {
        this.stopLoop();
        this.audio.suspend();
      }
    }

    cellAt(x, y) {
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        if (x >= c.x - c.size / 2 && x <= c.x + c.size / 2 && y >= c.y - c.size / 2 && y <= c.y + c.size / 2) {
          return c.index;
        }
      }
      return -1;
    }

    paletteAt(x, y) {
      for (let i = 0; i < L.paletteItems.length; i++) {
        if (containsBox(L.paletteItems[i].hit, x, y)) return L.paletteItems[i].key;
      }
      return null;
    }

    plantAt(index, key) {
      if (!Number.isInteger(index) || index < 0 || index >= this.cells.length) return 'rejected';
      if (!FLOWERS[key]) return 'rejected';
      const replaced = !!this.cells[index].key;
      this.cells[index].key = key;
      this.audio.plant(key);
      this.spawnGrow(this.cells[index].x, this.cells[index].y, key);
      this.showToast(replaced ? '换成了 ' + FLOWERS[key].name : '种下 ' + FLOWERS[key].name, 1.25);
      this.checkDelay = TASK_CHECK_SEC;
      this.render();
      return replaced ? 'replaced' : 'placed';
    }

    removeAt(index) {
      if (!Number.isInteger(index) || index < 0 || index >= this.cells.length) return false;
      if (!this.cells[index].key) return false;
      const key = this.cells[index].key;
      this.cells[index].key = null;
      this.audio.note(key);
      this.audio.uproot();
      this.spawnLeaves(this.cells[index].x, this.cells[index].y, FLOWERS[key].color);
      if (this.boardCount() === 0) this.stopLoop();
      this.checkDelay = TASK_CHECK_SEC;
      this.render();
      return true;
    }

    clearBoard() {
      for (let i = 0; i < this.cells.length; i++) this.cells[i].key = null;
      this.stopLoop();
      this.clearArmedUntil = 0;
      this.effects.length = 0;
      this.liveProps = 0;
      this.audio.clear();
      this.showToast('花圃收好啦，可以重新种', 1.8);
      this.checkDelay = TASK_CHECK_SEC;
      this.render();
    }

    boardCount() {
      let n = 0;
      for (let i = 0; i < this.cells.length; i++) if (this.cells[i].key) n++;
      return n;
    }

    columnKeys(col) {
      const out = [];
      for (let r = 0; r < ROWS; r++) {
        const key = this.cells[r * COLS + col].key;
        if (key) out.push(key);
      }
      return out;
    }

    startLoop() {
      if (this.boardCount() === 0) {
        this.showToast('先种一朵花吧', 1.6);
        return false;
      }
      if (this.loopPlaying) return true;
      this.audio.resume();
      this.loopPlaying = true;
      this.beat = 0;
      this.beatTimer = BEAT_SEC;
      this.triggerBeat(0);
      this.render();
      return true;
    }

    stopLoop() {
      this.loopPlaying = false;
      this.beat = 0;
      this.beatTimer = 0;
      this.currentBeatPulse = 0;
      this.render();
    }

    beatStep() {
      if (!this.loopPlaying) return this.beat;
      this.beat = (this.beat + 1) % BEATS;
      this.beatTimer += BEAT_SEC;
      this.triggerBeat(this.beat);
      return this.beat;
    }

    triggerBeat(beat) {
      const keys = this.columnKeys(beat);
      this.audio.playColumn(keys);
      this.currentBeatPulse = 1;
      for (let i = 0; i < keys.length; i++) {
        const row = this.cells.filter(function (c) { return c.col === beat && c.key; })[i];
        if (row) this.spawnNote(row.x, row.y - 18, keys[i]);
      }
      this.beeWing += 2.8;
      this.render();
    }

    checkTask() {
      if (!this.task || this.taskBusy) return false;
      if (!meetsTask(this.task.id, this.cells)) return false;
      this.taskBusy = true;
      this.taskBusyT = TASK_DELAY_SEC;
      this.completedTasks++;
      this.audio.taskDone();
      this.spawnTaskCelebration();
      this.render();
      return true;
    }

    nextTask() {
      this.taskBusy = false;
      this.taskBusyT = 0;
      this.checkDelay = 0;
      const previous = this.task ? this.task.id : this._lastTaskId;
      for (let tries = 0; tries < TASK_IDS.length * 4; tries++) {
        if (!this._taskDeck.length) this._taskDeck = shuffle(TASK_IDS);
        const id = this._taskDeck.shift();
        if (id === previous) {
          this._taskDeck.push(id);
          continue;
        }
        if (meetsTask(id, this.cells)) continue;
        this.task = taskById(id);
        this._lastTaskId = id;
        this.render();
        return this.task;
      }
      this.task = null;
      this.render();
      return null;
    }

    showToast(text, duration) {
      this.toastText = text;
      this.toastUntil = this.clockSec + (duration || 1.5);
      this.render();
    }

    onPointerDown(pointer) {
      if (this._shuttingDown) return;
      this.audio.resume();
      const x = Number(pointer && pointer.x);
      const y = Number(pointer && pointer.y);
      if (!isFinite(x) || !isFinite(y)) return;

      if (containsRect(L.taskSwap, x, y)) {
        if (this.taskBusy) return;
        this.audio.taskSwap();
        this.nextTask();
        return;
      }
      if (containsRect(L.play, x, y)) {
        this.audio.pick();
        if (this.loopPlaying) this.stopLoop(); else this.startLoop();
        return;
      }
      if (containsRect(L.shovel, x, y)) {
        this.audio.pick();
        this.selected = this.selected === 'shovel' ? null : 'shovel';
        this.showToast(this.selected === 'shovel' ? '铲子拿好了，点花就能拔掉' : '放下铲子', 1.5);
        this.render();
        return;
      }
      if (containsRect(L.clear, x, y)) {
        this.audio.pick();
        if (this.clearArmedUntil > this.clockSec) {
          this.clearBoard();
        } else {
          this.clearArmedUntil = this.clockSec + CLEAR_CONFIRM_SEC;
          this.showToast('再点一次就收好啦', CLEAR_CONFIRM_SEC);
        }
        this.render();
        return;
      }
      const paletteKey = this.paletteAt(x, y);
      if (paletteKey) {
        this.audio.pick();
        this.audio.note(paletteKey);
        this.selected = paletteKey;
        this.showToast('选好了 ' + FLOWERS[paletteKey].name, 1.2);
        this.render();
        return;
      }
      const index = this.cellAt(x, y);
      if (index >= 0) {
        if (this.selected === 'shovel') {
          this.removeAt(index);
        } else if (this.selected && FLOWERS[this.selected]) {
          this.plantAt(index, this.selected);
        } else {
          this.showToast('先在下面选一朵花吧', 1.5);
        }
      }
    }

    spawnGrow(x, y, key) {
      const color = FLOWERS[key].color;
      for (let i = 0; i < 6; i++) {
        this.effects.push({
          type: 'spark', x: x + rand(-18, 18), y: y + rand(-10, 12),
          vx: rand(-22, 22), vy: rand(-58, -24), age: 0, life: rand(0.4, 0.7),
          size: rand(2, 4), color: i % 2 ? color : 0xFFFFFF,
        });
      }
    }

    spawnLeaves(x, y, color) {
      for (let i = 0; i < 5; i++) {
        this.effects.push({
          type: 'leaf', x: x + rand(-12, 12), y: y + rand(-12, 10),
          vx: rand(-36, 36), vy: rand(-55, -15), age: 0, life: rand(0.5, 0.8),
          rot: rand(0, TAU), spin: rand(-4, 4), color: i % 2 ? C.green : color,
        });
      }
    }

    spawnNote(x, y, key) {
      const f = FLOWERS[key];
      this.effects.push({
        type: 'note', x: x + rand(-6, 6), y: y, vx: rand(-8, 8), vy: rand(-40, -28),
        age: 0, life: 0.86, color: f ? f.color : C.white, size: rand(9, 12),
      });
    }

    spawnTaskCelebration() {
      const colors = [0xF26170, 0xF49A45, 0xF6D34B, 0x73C96A, 0x69B8EA, 0xA987DF];
      for (let i = 0; i < 28; i++) {
        this.effects.push({
          type: 'petal',
          x: rand(66, 474), y: rand(100, 230),
          vx: rand(-34, 34), vy: rand(-10, 45),
          age: 0, life: rand(0.9, 1.6), rot: rand(0, TAU), spin: rand(-5, 5),
          color: colors[i % colors.length], size: rand(4, 8),
        });
      }
      for (let i = 0; i < 5; i++) {
        this.effects.push({
          type: 'heart', x: this.beeX + rand(-28, 28), y: this.beeY - 20 + rand(-12, 8),
          vx: rand(-15, 15), vy: rand(-35, -18), age: 0, life: rand(0.8, 1.2),
          color: i % 2 ? 0xFF7D9C : 0xF26170, size: rand(5, 8),
        });
      }
    }

    updateEffects(dt) {
      for (let i = this.effects.length - 1; i >= 0; i--) {
        const e = this.effects[i];
        e.age += dt;
        if (e.age >= e.life) { this.effects.splice(i, 1); continue; }
        e.x += (e.vx || 0) * dt;
        e.y += (e.vy || 0) * dt;
        if (e.type === 'petal' || e.type === 'leaf') {
          e.vy = (e.vy || 0) + 34 * dt;
          e.rot += (e.spin || 0) * dt;
        } else if (e.type === 'spark' || e.type === 'heart') {
          e.vy = (e.vy || 0) + 16 * dt;
        }
      }
      this.liveProps = this.effects.length;
    }

    step(dt) {
      const delta = Number(dt);
      if (!isFinite(delta) || delta <= 0) return;
      const d = Math.min(delta, 0.25);
      this.clockSec += d;
      this.currentBeatPulse = Math.max(0, this.currentBeatPulse - d * 2.7);
      this.beeWing += d * 9;

      if (this.loopPlaying) {
        this.beatTimer -= d;
        let guard = 0;
        while (this.beatTimer <= 0.00001 && guard < 8) {
          this.beatStep();
          guard++;
        }
      }

      if (this.checkDelay > 0) {
        this.checkDelay -= d;
        if (this.checkDelay <= 0) {
          this.checkDelay = 0;
          if (this.task) this.checkTask();
          else this.nextTask();
        }
      }

      if (this.taskBusy) {
        this.taskBusyT -= d;
        if (this.taskBusyT <= 0) this.nextTask();
      }

      if (this.clearArmedUntil > 0 && this.clockSec > this.clearArmedUntil) {
        this.clearArmedUntil = 0;
      }
      if (this.toastUntil > 0 && this.clockSec > this.toastUntil) {
        this.toastUntil = 0;
        this.toastText = '';
      }

      const target = this.loopPlaying ? L.cells[this.beat].x : L.beeIdle.x;
      const targetY = this.loopPlaying ? 196 : L.beeIdle.y + Math.sin(this.clockSec * 2.1) * 3;
      const follow = Math.min(1, d * 8.5);
      this.beeX += (target - this.beeX) * follow;
      this.beeY += (targetY - this.beeY) * follow;

      this.updateEffects(d);
    }

    simulate(seconds) {
      let left = Math.max(0, Number(seconds) || 0);
      while (left > 0.000001) {
        const dt = Math.min(1 / 60, left);
        this.step(dt);
        left -= dt;
      }
      this.render();
    }

    render() {
      if (!this.boardG || this._shuttingDown) return;
      this.renderAmbient();
      this.renderBoard();
      this.renderTask();
      this.renderPalette();
      this.renderControls();
      this.renderBee();
      this.renderEffects();
      this.updateTexts();
    }

    renderAmbient() {
      const g = this.ambientG;
      const t = this.clockSec;
      g.clear();

      g.lineStyle(2, 0xFFF1A1, 0.13);
      for (let i = 0; i < 12; i++) {
        const a = t * 0.035 + i * TAU / 12;
        g.lineBetween(474 + Math.cos(a) * 35, 54 + Math.sin(a) * 35, 474 + Math.cos(a) * 49, 54 + Math.sin(a) * 49);
      }

      for (let i = 0; i < 20; i++) {
        const x = 12 + ((i * 97 + t * (4 + (i % 4) * 2.1)) % 516);
        const y = 92 + ((i * 67 + Math.sin(t * 0.75 + i * 1.7) * 13) % 798);
        const shimmer = 0.08 + (Math.sin(t * 1.8 + i * 2.3) + 1) * 0.055;
        const color = i % 4 === 0 ? 0xFFF0A0 : (i % 4 === 1 ? 0xFFFFFF : (i % 4 === 2 ? 0xFFD6E4 : C.leafPale));
        if (i % 5 === 0) drawSparkle(g, x, y, 2.6 + (i % 3), color, shimmer + 0.12);
        else {
          g.fillStyle(color, shimmer);
          g.fillCircle(x, y, 1.5 + (i % 4) * 0.38);
        }
      }

      const bx1 = 61 + Math.sin(t * 0.55) * 23;
      const by1 = 176 + Math.sin(t * 1.25) * 8;
      drawButterfly(g, bx1, by1, 0.68, C.coral);
      const bx2 = 478 + Math.sin(t * 0.48 + 2.4) * 17;
      const by2 = 188 + Math.sin(t * 1.08 + 1.2) * 7;
      drawButterfly(g, bx2, by2, 0.54, 0xE7B52E);

      const notes = [
        { x: 22 + Math.sin(t * 0.7) * 4, y: 312 + Math.sin(t * 1.1) * 5, c: C.coral },
        { x: 516 + Math.sin(t * 0.8 + 1) * 4, y: 438 + Math.sin(t * 1.25) * 6, c: C.blue },
        { x: 25 + Math.sin(t * 0.75 + 2) * 3, y: 568 + Math.sin(t * 1.1) * 5, c: 0xE7B52E },
      ];
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        g.fillStyle(n.c, 0.28 + Math.sin(t * 2 + i) * 0.08);
        g.fillCircle(n.x, n.y, 4.2);
        g.lineStyle(2, n.c, 0.33);
        g.lineBetween(n.x + 3.4, n.y - 1, n.x + 3.4, n.y - 15);
        g.lineBetween(n.x + 3.4, n.y - 15, n.x + 10, n.y - 12);
      }

      if (this.loopPlaying) {
        const cx = L.cells[this.beat].x;
        for (let i = 0; i < 7; i++) {
          const yy = 649 - ((t * (48 + i * 3) + i * 39) % 170);
          const xx = cx + Math.sin(t * 2.2 + i * 1.4) * (12 + i * 1.8);
          g.fillStyle(i % 2 ? 0xFFF5AC : FLOWERS[this.columnKeys(this.beat)[0] || 'yellow'].color, 0.2 + (1 - (649 - yy) / 180) * 0.24);
          g.fillCircle(xx, yy, 1.7 + (i % 3));
        }
      }
    }

    renderBoard() {
      const g = this.boardG;
      const b = L.board;
      g.clear();

      g.fillStyle(0x1F3826, 0.22);
      g.fillRoundedRect(b.x + 7, b.y + 12, b.w, b.h, 35);
      g.fillStyle(C.woodDark, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 31);
      g.fillStyle(C.wood, 1);
      g.fillRoundedRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6, 28);
      g.lineStyle(2, 0xFFE5A5, 0.56);
      g.strokeRoundedRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16, 23);
      g.lineStyle(1.5, 0x71442C, 0.58);
      g.strokeRoundedRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6, 28);

      for (let i = 0; i < 13; i++) {
        const gy = b.y + 17 + (i * 37) % 425;
        g.lineStyle(1, i % 2 ? 0xFFDD99 : 0x875234, 0.17);
        g.beginPath();
        g.moveTo(b.x + 4, gy);
        g.lineTo(b.x + 18, gy - 2);
        g.lineTo(b.x + 30, gy + 1);
        g.strokePath();
        g.beginPath();
        g.moveTo(b.x + b.w - 4, gy + 3);
        g.lineTo(b.x + b.w - 18, gy + 1);
        g.lineTo(b.x + b.w - 30, gy + 4);
        g.strokePath();
      }

      g.fillStyle(0x234C33, 0.54);
      g.fillRoundedRect(b.x + 11, b.y + 17, b.w - 22, b.h - 27, 20);
      g.fillStyle(0x5D9D62, 1);
      g.fillRoundedRect(b.x + 14, b.y + 20, b.w - 28, b.h - 33, 18);
      g.fillStyle(0x8BD17A, 0.82);
      g.fillRoundedRect(b.x + 14, b.y + 20, b.w - 28, 112, 18);
      g.fillStyle(0x79BF6C, 0.72);
      g.fillRoundedRect(b.x + 14, b.y + 121, b.w - 28, 130, 15);
      g.fillStyle(0x68B15F, 0.62);
      g.fillRoundedRect(b.x + 14, b.y + 241, b.w - 28, b.h - 255, 15);
      g.fillStyle(0xC8EFA7, 0.18);
      g.fillRoundedRect(b.x + 18, b.y + 23, b.w - 36, 10, 5);

      // 四角小叶片和黄铜花钉。
      drawLeafSprig(g, b.x + 14, b.y + 15, 0.85, C.greenDeep, false);
      drawLeafSprig(g, b.x + b.w - 14, b.y + 15, 0.85, C.greenDeep, true);
      drawLeafSprig(g, b.x + 14, b.y + b.h - 13, 0.8, C.greenDeep, false);
      drawLeafSprig(g, b.x + b.w - 14, b.y + b.h - 13, 0.8, C.greenDeep, true);
      const screws = [[b.x + 18, b.y + 19], [b.x + b.w - 18, b.y + 19], [b.x + 18, b.y + b.h - 18], [b.x + b.w - 18, b.y + b.h - 18]];
      for (let i = 0; i < screws.length; i++) {
        g.fillStyle(0x6F452D, 0.9);
        g.fillCircle(screws[i][0], screws[i][1], 5.2);
        g.fillStyle(0xFFD77D, 1);
        g.fillCircle(screws[i][0] - 0.7, screws[i][1] - 1, 3.4);
        g.fillStyle(0xFFFFFF, 0.5);
        g.fillCircle(screws[i][0] - 1.8, screws[i][1] - 2.2, 1.1);
      }

      for (let c = 0; c < COLS; c++) {
        const active = this.loopPlaying && c === this.beat;
        const cx = L.cells[c].x;
        if (active) {
          const ax = cx - b.cell / 2 - 4;
          g.fillStyle(0xFFF6A8, 0.2 + this.currentBeatPulse * 0.14);
          g.fillRoundedRect(ax, b.y + 15, b.cell + 8, b.h - 30, 23);
          g.lineStyle(3, 0xFFE06D, 0.45 + this.currentBeatPulse * 0.35);
          g.strokeRoundedRect(ax, b.y + 15, b.cell + 8, b.h - 30, 23);
          g.fillStyle(0xFFF4AE, 0.7 + this.currentBeatPulse * 0.25);
          drawStar(g, cx, b.y + 9, 5 + this.currentBeatPulse * 2, 0xFFF5A8, 4, 0.9);
        }
      }

      for (let i = 0; i < this.cells.length; i++) {
        const cell = this.cells[i];
        const x = cell.x - cell.size / 2;
        const y = cell.y - cell.size / 2;
        const active = this.loopPlaying && cell.col === this.beat;
        const base = active ? 0xA96D43 : ((cell.row + cell.col) % 2 === 0 ? C.soil : 0xB77A4C);
        g.fillStyle(0x503222, 0.34);
        g.fillRoundedRect(x + 3, y + 7, cell.size, cell.size, 20);
        g.fillStyle(shade(base, 0.83), 1);
        g.fillRoundedRect(x, y, cell.size, cell.size, 20);
        g.fillStyle(base, 1);
        g.fillRoundedRect(x + 2, y + 2, cell.size - 4, cell.size - 4, 18);
        g.fillStyle(active ? 0xC78A58 : C.soilLight, 0.4);
        g.fillRoundedRect(x + 7, y + 7, cell.size - 14, cell.size - 21, 14);
        g.lineStyle(1.5, 0xF8D39A, 0.26);
        g.strokeRoundedRect(x + 4, y + 4, cell.size - 8, cell.size - 8, 17);
        g.fillStyle(0x6A422C, 0.26);
        for (let d = 0; d < 9; d++) {
          const dx = x + 15 + ((d * 29 + i * 17) % 65);
          const dy = y + 16 + ((d * 37 + i * 11) % 69);
          g.fillCircle(dx, dy, d % 3 === 0 ? 1.8 : 1.15);
        }
        g.fillStyle(0xF9DFB4, 0.18);
        g.fillEllipse(x + 26, y + 24, 18, 7);
        if (!cell.key) {
          g.fillStyle(0x6F462F, 0.2);
          g.fillEllipse(cell.x, cell.y + 26, 34, 9);
          g.fillStyle(0xE7BE87, 0.3);
          g.fillEllipse(cell.x, cell.y + 23, 30, 7);
          g.lineStyle(2, 0xEFCF9E, 0.35);
          g.strokeCircle(cell.x, cell.y - 2, 12);
          g.lineStyle(2, 0x7D5139, 0.28);
          g.lineBetween(cell.x - 5, cell.y + 1, cell.x + 5, cell.y + 1);
          g.lineBetween(cell.x, cell.y - 4, cell.x, cell.y + 6);
          g.fillStyle(0xFFF2C7, 0.38);
          g.fillCircle(cell.x - 24, cell.y - 25, 2);
          g.fillCircle(cell.x + 26, cell.y - 20, 1.4);
          if (i % 5 === 1) {
            g.lineStyle(1.8, 0x3F8347, 0.68);
            g.lineBetween(cell.x + 25, cell.y + 30, cell.x + 25, cell.y + 18);
            g.fillStyle(C.green, 0.74);
            g.fillEllipse(cell.x + 20, cell.y + 19, 10, 5);
            g.fillEllipse(cell.x + 30, cell.y + 15, 9, 4.5);
            g.fillStyle(C.leafPale, 0.72);
            g.fillCircle(cell.x + 25, cell.y + 30, 1.6);
          } else if (i % 7 === 3) {
            g.fillStyle(0xF17A7B, 0.92);
            g.fillEllipse(cell.x - 24, cell.y + 27, 11, 7);
            g.fillStyle(0x4B3826, 0.9);
            g.fillCircle(cell.x - 28, cell.y + 27, 2.2);
            g.fillCircle(cell.x - 25, cell.y + 24, 1.2);
            g.fillCircle(cell.x - 21, cell.y + 30, 1.2);
          } else if (i % 4 === 2) {
            g.fillStyle(0xF2C88F, 0.34);
            g.fillEllipse(cell.x + 26, cell.y + 30, 15, 7);
            g.fillStyle(0x7C5137, 0.34);
            g.fillEllipse(cell.x + 28, cell.y + 31, 8, 3.5);
          }
        }
      }

      for (let i = 0; i < this.cells.length; i++) {
        const cell = this.cells[i];
        if (!cell.key) continue;
        const active = this.loopPlaying && cell.col === this.beat;
        const bob = Math.sin(this.clockSec * (active ? 9.5 : 1.9) + i * 0.82) * (active ? 2.8 : 0.7);
        const sway = Math.sin(this.clockSec * (active ? 6 : 1.3) + i * 1.1) * (active ? 0.085 : 0.025);
        const scale = active ? 1.03 + this.currentBeatPulse * 0.11 : 1;
        drawFlower(g, cell.x, cell.y - 2 + bob, 25, cell.key, { scale: scale, sway: sway });
        if (active) {
          drawSparkle(g, cell.x + 34, cell.y - 30 + bob, 3.8, 0xFFF5B4, 0.38 + this.currentBeatPulse * 0.35);
        }
      }
    }

    renderTask() {
      const g = this.taskG;
      const t = L.task;
      g.clear();
      g.fillStyle(0x27472F, 0.15);
      g.fillRoundedRect(t.x + 4, t.y + 7, t.w, t.h, 23);
      g.fillStyle(0xCDA368, 1);
      g.fillRoundedRect(t.x, t.y, t.w, t.h, 22);
      g.fillStyle(C.cream, 0.99);
      g.fillRoundedRect(t.x + 2, t.y + 2, t.w - 4, t.h - 4, 20);
      g.lineStyle(this.taskBusy ? 4 : 2.5, this.taskBusy ? 0xFFC93D : 0xE1B869, 0.95);
      g.strokeRoundedRect(t.x + 1.5, t.y + 1.5, t.w - 3, t.h - 3, 20);
      g.lineStyle(1, 0xB98D52, 0.34);
      g.strokeRoundedRect(t.x + 7, t.y + 7, t.w - 14, t.h - 14, 16);

      for (let i = 0; i < 18; i++) {
        g.fillStyle(0xB48750, 0.22);
        g.fillCircle(t.x + 15 + i * 24, t.y + 10, 1.1);
        g.fillCircle(t.x + 25 + i * 24, t.y + t.h - 10, 1.1);
      }

      drawLeafSprig(g, t.x + 8, t.y + 8, 0.72, C.green, false);
      drawLeafSprig(g, t.x + t.w - 8, t.y + 8, 0.72, C.green, true);
      drawLeafSprig(g, t.x + 8, t.y + t.h - 7, 0.62, C.green, false);
      drawLeafSprig(g, t.x + t.w - 8, t.y + t.h - 7, 0.62, C.green, true);

      g.fillStyle(this.taskBusy ? 0xFFF0A3 : 0xF2DFB7, 1);
      g.fillCircle(79, 147, 29);
      g.lineStyle(2.4, this.taskBusy ? C.goldDeep : 0xD7AC64, 1);
      g.strokeCircle(79, 147, 29);
      g.lineStyle(1.2, 0xFFFFFF, 0.66);
      g.strokeCircle(79, 147, 24);
      g.fillStyle(this.taskBusy ? 0xFFD85A : 0xE9C57D, 0.36);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + this.clockSec * (this.taskBusy ? 0.3 : 0.08);
        g.fillCircle(79 + Math.cos(a) * 34, 147 + Math.sin(a) * 34, 1.6);
      }
      if (this.task) drawTaskIcon(g, this.task.id, 79, 147, 34);
      else drawFlower(g, 79, 147, 15, 'purple', { icon: true });

      drawPill(g, L.taskSwap.x, L.taskSwap.y, L.taskSwap.w, L.taskSwap.h, 0xF4E4C5, 0xD2A45D, 1.5, 1);
      g.fillStyle(0xFFFFFF, 0.42);
      g.fillRoundedRect(L.taskSwap.x - L.taskSwap.w / 2 + 8, L.taskSwap.y - L.taskSwap.h / 2 + 4, L.taskSwap.w - 16, 5, 2.5);
      g.lineStyle(1.8, C.greenDeep, 0.68);
      g.beginPath();
      g.arc(L.taskSwap.x - 24, L.taskSwap.y, 6, Math.PI * 0.2, Math.PI * 1.55);
      g.strokePath();
      g.fillStyle(C.greenDeep, 0.75);
      g.fillTriangle(L.taskSwap.x - 21, L.taskSwap.y - 7, L.taskSwap.x - 28, L.taskSwap.y - 6, L.taskSwap.x - 24, L.taskSwap.y + 1);

      if (this.taskBusy) {
        g.fillStyle(C.gold, 0.12 + Math.sin(this.clockSec * 9) * 0.06);
        g.fillRoundedRect(t.x - 4, t.y - 4, t.w + 8, t.h + 8, 26);
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8 + this.clockSec * 0.7;
          drawSparkle(g, 79 + Math.cos(a) * 42, 147 + Math.sin(a) * 37, 3.6, i % 2 ? C.gold : C.coral, 0.65);
        }
      }

      for (let i = 0; i < TASK_IDS.length; i++) {
        const x = 112 + i * 13;
        const done = i < Math.min(this.completedTasks, TASK_IDS.length);
        g.fillStyle(done ? C.goldDeep : 0xBCAF9B, done ? 0.82 : 0.46);
        g.fillCircle(x, 178, done ? 3.1 : 2.4);
        g.fillStyle(done ? 0xFFF2A6 : 0xE7DDCF, done ? 1 : 0.55);
        g.fillCircle(x - 0.7, 178, done ? 2.1 : 1.6);
        if (done) drawSparkle(g, x + 4, 174, 2.2, 0xFFFFFF, 0.6);
      }
    }

    renderPalette() {
      const g = this.paletteG;
      const p = L.palette;
      g.clear();
      g.fillStyle(0x27472F, 0.17);
      g.fillRoundedRect(p.x + 4, p.y + 7, p.w, p.h, 27);
      g.fillStyle(C.woodDark, 1);
      g.fillRoundedRect(p.x, p.y, p.w, p.h, 26);
      g.fillStyle(0xF9EDD2, 0.99);
      g.fillRoundedRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6, 23);
      g.lineStyle(2, 0xDFB875, 0.85);
      g.strokeRoundedRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8, 22);
      g.fillStyle(0xFFF9E8, 0.54);
      g.fillRoundedRect(p.x + 11, p.y + 9, p.w - 22, 8, 4);

      const awning = [C.petalPale, 0xFFF0B2, C.leafPale, 0xD7EDFF, 0xE8DDFD, 0xFFE1C6];
      for (let i = 0; i < 12; i++) {
        const x = p.x + 20 + i * 38;
        g.fillStyle(awning[i % awning.length], 0.9);
        g.fillCircle(x, p.y + 5, 10);
      }
      g.fillStyle(C.woodDark, 0.36);
      g.fillRoundedRect(p.x + 9, p.y + p.h - 13, p.w - 18, 5, 2.5);
      drawLeafSprig(g, p.x + 4, p.y + 20, 0.56, C.greenDeep, false);
      drawLeafSprig(g, p.x + p.w - 4, p.y + 20, 0.56, C.greenDeep, true);

      for (let i = 0; i < L.paletteItems.length; i++) {
        const item = L.paletteItems[i];
        const selected = this.selected === item.key;
        const pulse = 1 + Math.sin(this.clockSec * 5.4 + i) * 0.025;
        g.fillStyle(0x6A472F, 0.13);
        g.fillEllipse(item.x + 1, item.y + 20, 51, 13);
        g.fillStyle(selected ? FLOWERS[item.key].color : 0xFFFDF6, selected ? 0.2 : 0.75);
        g.fillCircle(item.x, item.y - 2, selected ? 31 * pulse : 27);
        g.lineStyle(selected ? 3 : 1.2, selected ? FLOWERS[item.key].deep : 0xDCC49B, selected ? 0.92 : 0.58);
        g.strokeCircle(item.x, item.y - 2, selected ? 31 * pulse : 27);
        if (selected) {
          g.fillStyle(0xFFFFFF, 0.58);
          g.fillCircle(item.x - 10, item.y - 15, 3.4);
          for (let s = 0; s < 3; s++) {
            const a = this.clockSec * 1.6 + s * TAU / 3;
            drawSparkle(g, item.x + Math.cos(a) * 34, item.y - 3 + Math.sin(a) * 30, 3.3, s === 1 ? C.gold : 0xFFFFFF, 0.68);
          }
        }
        drawFlower(g, item.x, item.y - 3, 20, item.key, { icon: true, scale: selected ? 1.09 : 1 });
        g.fillStyle(FLOWERS[item.key].color, 0.85);
        g.fillRoundedRect(item.x - 12, 786, 24, 3, 1.5);
      }
    }

    renderControls() {
      const g = this.controlsG;
      g.clear();
      const shovelSelected = this.selected === 'shovel';

      g.fillStyle(0x2D462F, 0.16);
      g.fillEllipse(L.shovel.x, L.shovel.y + 27, 96, 11);
      g.fillStyle(C.woodDark, 0.82);
      g.fillRoundedRect(L.shovel.x - L.shovel.w / 2, L.shovel.y - L.shovel.h / 2 + 2, L.shovel.w, L.shovel.h, L.shovel.h / 2);
      g.fillStyle(shovelSelected ? 0xFFE889 : C.cream, 1);
      g.fillRoundedRect(L.shovel.x - L.shovel.w / 2 + 2, L.shovel.y - L.shovel.h / 2, L.shovel.w - 4, L.shovel.h - 4, L.shovel.h / 2 - 2);
      g.lineStyle(shovelSelected ? 3 : 1.5, shovelSelected ? C.goldDeep : 0xD1A76C, 0.9);
      g.strokeRoundedRect(L.shovel.x - L.shovel.w / 2 + 2, L.shovel.y - L.shovel.h / 2, L.shovel.w - 4, L.shovel.h - 4, L.shovel.h / 2 - 2);
      g.fillStyle(0xFFFFFF, 0.37);
      g.fillRoundedRect(L.shovel.x - L.shovel.w / 2 + 11, L.shovel.y - L.shovel.h / 2 + 5, L.shovel.w - 22, 6, 3);
      this.drawShovelIcon(g, L.shovel.x - 22, L.shovel.y - 1, shovelSelected);

      const playFill = this.loopPlaying ? 0xF18472 : 0x54B566;
      const playTop = this.loopPlaying ? 0xFFAE8A : 0x7FD078;
      const playDeep = this.loopPlaying ? 0xB94C4C : 0x347B49;
      g.fillStyle(playDeep, 0.25 + this.currentBeatPulse * 0.13);
      g.fillCircle(L.play.x, L.play.y, 48 + this.currentBeatPulse * 10);
      g.fillStyle(0x243D2C, 0.22);
      g.fillRoundedRect(L.play.x - L.play.w / 2 + 2, L.play.y - L.play.h / 2 + 7, L.play.w, L.play.h, L.play.h / 2);
      g.fillStyle(playDeep, 1);
      g.fillRoundedRect(L.play.x - L.play.w / 2, L.play.y - L.play.h / 2, L.play.w, L.play.h, L.play.h / 2);
      g.fillStyle(playFill, 1);
      g.fillRoundedRect(L.play.x - L.play.w / 2 + 2, L.play.y - L.play.h / 2 + 1, L.play.w - 4, L.play.h - 7, L.play.h / 2 - 3);
      g.fillStyle(playTop, 0.94);
      g.fillRoundedRect(L.play.x - L.play.w / 2 + 7, L.play.y - L.play.h / 2 + 4, L.play.w - 14, 14, 7);
      g.fillStyle(0xFFFFFF, 0.32);
      g.fillRoundedRect(L.play.x - L.play.w / 2 + 15, L.play.y - L.play.h / 2 + 7, L.play.w - 30, 6, 3);
      g.lineStyle(2, 0xFFFFFF, 0.34);
      g.strokeRoundedRect(L.play.x - L.play.w / 2 + 2, L.play.y - L.play.h / 2 + 1, L.play.w - 4, L.play.h - 5, L.play.h / 2 - 2);
      g.fillStyle(0xFFFFFF, 0.78);
      drawStar(g, L.play.x - 106, L.play.y - 1, 5.5, 0xFFFFFF, 4, 0.55);
      drawStar(g, L.play.x + 105, L.play.y - 2, 4.5, 0xFFF0A7, 4, 0.55);

      if (this.loopPlaying) {
        g.fillStyle(0xFFFFFF, 0.95);
        g.fillRoundedRect(L.play.x - 89, L.play.y - 9, 7, 18, 2.5);
        g.fillRoundedRect(L.play.x - 79, L.play.y - 9, 7, 18, 2.5);
        g.lineStyle(2, 0xFFF0B0, 0.23 + this.currentBeatPulse * 0.24);
        g.strokeCircle(L.play.x, L.play.y, 35 + this.currentBeatPulse * 8);
      } else {
        g.fillStyle(0xFFFFFF, 0.97);
        g.fillTriangle(L.play.x - 91, L.play.y - 11, L.play.x - 91, L.play.y + 11, L.play.x - 75, L.play.y);
        g.fillStyle(0xFFF5BE, 0.8);
        g.fillCircle(L.play.x + 83, L.play.y - 12, 3);
        g.lineStyle(2, 0xFFF5BE, 0.72);
        g.lineBetween(L.play.x + 85, L.play.y - 10, L.play.x + 85, L.play.y - 24);
        g.lineBetween(L.play.x + 85, L.play.y - 24, L.play.x + 93, L.play.y - 21);
      }

      const armed = this.clearArmedUntil > this.clockSec;
      g.fillStyle(0x2D462F, 0.16);
      g.fillEllipse(L.clear.x, L.clear.y + 27, 98, 11);
      g.fillStyle(armed ? C.coralDeep : C.woodDark, 0.82);
      g.fillRoundedRect(L.clear.x - L.clear.w / 2, L.clear.y - L.clear.h / 2 + 2, L.clear.w, L.clear.h, L.clear.h / 2);
      g.fillStyle(armed ? 0xFFD6CA : C.cream, 1);
      g.fillRoundedRect(L.clear.x - L.clear.w / 2 + 2, L.clear.y - L.clear.h / 2, L.clear.w - 4, L.clear.h - 4, L.clear.h / 2 - 2);
      g.lineStyle(armed ? 3 : 1.5, armed ? C.coralDeep : 0xD1A76C, 0.9);
      g.strokeRoundedRect(L.clear.x - L.clear.w / 2 + 2, L.clear.y - L.clear.h / 2, L.clear.w - 4, L.clear.h - 4, L.clear.h / 2 - 2);
      g.fillStyle(0xFFFFFF, armed ? 0.34 : 0.37);
      g.fillRoundedRect(L.clear.x - L.clear.w / 2 + 11, L.clear.y - L.clear.h / 2 + 5, L.clear.w - 22, 6, 3);
      g.lineStyle(2.2, armed ? C.coralDeep : 0x9B6E4B, 0.9);
      g.strokeCircle(L.clear.x - 25, L.clear.y - 2, 8);
      g.lineBetween(L.clear.x - 32, L.clear.y - 2, L.clear.x - 18, L.clear.y - 2);
      g.lineBetween(L.clear.x - 29, L.clear.y - 10, L.clear.x - 21, L.clear.y - 10);
      g.lineBetween(L.clear.x - 29, L.clear.y + 6, L.clear.x - 21, L.clear.y + 6);
      if (armed) {
        g.lineStyle(2.5, C.coral, 0.62 + Math.sin(this.clockSec * 8) * 0.18);
        g.strokeRoundedRect(L.clear.x - L.clear.w / 2 - 3, L.clear.y - L.clear.h / 2 - 3, L.clear.w + 6, L.clear.h + 6, L.clear.h / 2 + 3);
      }

      const hintW = 370;
      g.fillStyle(0xFFF8E5, 0.54);
      g.fillRoundedRect(L.hint.x - hintW / 2, L.hint.y - 14, hintW, 28, 14);
      g.lineStyle(1.2, 0xFFF4D5, 0.56);
      g.strokeRoundedRect(L.hint.x - hintW / 2, L.hint.y - 14, hintW, 28, 14);
      g.fillStyle(C.petalPale, 0.9);
      g.fillCircle(L.hint.x - hintW / 2 + 8, L.hint.y, 2.5);
      g.fillStyle(C.leafPale, 0.9);
      g.fillCircle(L.hint.x + hintW / 2 - 8, L.hint.y, 2.5);
    }

    drawShovelIcon(g, x, y, active) {
      g.lineStyle(6, active ? 0xB7802E : 0xB68A58, 1);
      g.lineBetween(x - 5, y - 15, x + 7, y + 7);
      g.fillStyle(active ? C.gold : 0xD8C3A4, 1);
      g.fillRoundedRect(x + 4, y + 4, 12, 16, 5);
      g.lineStyle(1.5, 0x896A48, 0.8);
      g.strokeRoundedRect(x + 4, y + 4, 12, 16, 5);
      g.fillStyle(0x8B5C36, 1);
      g.fillRoundedRect(x - 11, y - 20, 12, 7, 3);
    }

    renderBee() {
      const g = this.beeG;
      g.clear();
      if (this.taskBusy) {
        g.fillStyle(C.gold, 0.15 + Math.sin(this.clockSec * 6) * 0.04);
        g.fillCircle(this.beeX, this.beeY, 37 + Math.sin(this.clockSec * 7) * 6);
        g.lineStyle(2, 0xFFF2A6, 0.44);
        g.strokeCircle(this.beeX, this.beeY, 27 + Math.sin(this.clockSec * 7) * 3);
        for (let i = 0; i < 5; i++) {
          const a = this.clockSec * 0.9 + i * TAU / 5;
          drawSparkle(g, this.beeX + Math.cos(a) * 42, this.beeY + Math.sin(a) * 33, 3.2, i % 2 ? C.coral : C.gold, 0.65);
        }
      }
      if (this.loopPlaying) {
        const tx = L.cells[this.beat].x;
        const midX = (this.beeX + tx) / 2;
        const midY = this.beeY - 18 + Math.sin(this.clockSec * 4) * 5;
        g.lineStyle(2.2, 0xFFFFFF, 0.34);
        g.beginPath();
        g.moveTo(this.beeX + 8, this.beeY + 3);
        g.lineTo(midX, midY);
        g.lineTo(tx, 199);
        g.strokePath();
        for (let i = 1; i <= 5; i++) {
          const t = i / 6;
          const x = (1 - t) * (1 - t) * (this.beeX + 8) + 2 * (1 - t) * t * midX + t * t * tx;
          const y = (1 - t) * (1 - t) * (this.beeY + 3) + 2 * (1 - t) * t * midY + t * t * 199;
          g.fillStyle(i % 2 ? 0xFFF2A0 : 0xFFFFFF, 0.52 - i * 0.045);
          g.fillCircle(x, y, 2.5 - i * 0.18);
        }
      }
      drawBee(g, this.beeX, this.beeY, 0.92, this.beeWing, this.taskBusy);
      if (this.taskBusy) {
        const hx = this.beeX + 30;
        const hy = this.beeY - 24 + Math.sin(this.clockSec * 5) * 3;
        g.fillStyle(0xFF7898, 1);
        g.fillCircle(hx - 4.4, hy, 4.4);
        g.fillCircle(hx + 4.4, hy, 4.4);
        g.fillTriangle(hx - 8.5, hy + 2, hx + 8.5, hy + 2, hx, hy + 11);
        g.fillStyle(0xFFFFFF, 0.75);
        g.fillCircle(hx - 5.2, hy - 1.5, 1.2);
      }
    }

    renderEffects() {
      const g = this.fxG;
      g.clear();
      for (let i = 0; i < this.effects.length; i++) {
        const e = this.effects[i];
        const p = clamp(e.age / e.life, 0, 1);
        const alpha = 1 - p;
        if (e.type === 'spark') {
          g.fillStyle(e.color, alpha * 0.9);
          g.fillCircle(e.x, e.y, e.size * (1 - p * 0.4));
        } else if (e.type === 'leaf') {
          g.fillStyle(e.color, alpha * 0.9);
          g.fillCircle(e.x, e.y, 4.5 * (1 - p * 0.5));
          g.fillCircle(e.x + Math.cos(e.rot) * 4, e.y + Math.sin(e.rot) * 4, 3.2);
        } else if (e.type === 'note') {
          g.fillStyle(e.color, alpha * 0.92);
          g.fillCircle(e.x, e.y, e.size * 0.45);
          g.lineStyle(2, e.color, alpha * 0.9);
          g.lineBetween(e.x + e.size * 0.38, e.y - e.size * 0.15, e.x + e.size * 0.38, e.y - e.size * 1.4);
          g.lineBetween(e.x + e.size * 0.38, e.y - e.size * 1.4, e.x + e.size * 0.9, e.y - e.size * 1.12);
        } else if (e.type === 'petal') {
          const wobble = Math.sin(e.rot) * e.size * 0.45;
          g.fillStyle(e.color, alpha * 0.94);
          g.fillEllipse(e.x + wobble, e.y, e.size * 1.6, e.size * 0.72);
        } else if (e.type === 'heart') {
          g.fillStyle(e.color, alpha * 0.9);
          g.fillCircle(e.x - e.size * 0.42, e.y, e.size * 0.48);
          g.fillCircle(e.x + e.size * 0.42, e.y, e.size * 0.48);
          g.fillTriangle(e.x - e.size, e.y + 2, e.x + e.size, e.y + 2, e.x, e.y + e.size * 1.4);
        }
      }
    }

    updateTexts() {
      if (this.taskBusy) {
        this.taskText.setText('做到啦，真好听！');
        this.taskHint.setText('小蜜蜂听到了，等一等再给你新任务');
      } else if (this.task) {
        this.taskText.setText(this.task.title);
        this.taskHint.setText(this.task.hint);
      } else {
        this.taskText.setText('花园已经很热闹啦');
        this.taskHint.setText('自由玩一会儿吧，改动花圃就会再出任务');
      }
      this.swapText.setText(this.task ? '换一个' : '再看看');
      this.playText.setText(this.loopPlaying ? '停一停' : '听一听');
      this.clearText.setText(this.clearArmedUntil > this.clockSec ? '再点一次' : '收好');
      this.hintText.setText(this.toastText || '选一朵花种进泥土，四个节拍会轮流唱歌');
      this.hintText.setColor(this.toastText ? '#B45056' : '#496A51');
      this.subtitleText.setText(this.loopPlaying ? '正在演奏 · 每一列就是一拍' : '种下会唱歌的花，和小蜜蜂一起编曲子');
      for (let i = 0; i < this.beatTexts.length; i++) {
        const active = this.loopPlaying && i === this.beat;
        this.beatTexts[i].setColor(active ? '#B46C22' : '#4E6B52');
        this.beatTexts[i].setScale(active ? 1.12 : 1);
      }
      for (let i = 0; i < this.paletteTexts.length; i++) {
        this.paletteTexts[i].setColor(this.selected === FLOWER_KEYS[i] ? '#764C31' : '#56443A');
      }
    }

    update(time, delta) {
      this.step((delta || 0) / 1000);
      this.render();
    }
  }

  // ---------------------------------------------------------------- 背景
  function drawWorld(g) {
    const bands = 60;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const color = t < 0.62
        ? mixHex(C.skyTop, C.skyMid, t / 0.62)
        : mixHex(C.skyMid, C.skyBottom, (t - 0.62) / 0.38);
      g.fillStyle(color, 1);
      g.fillRect(0, i * (HEIGHT / bands) - 1, WIDTH, HEIGHT / bands + 2);
    }

    g.fillStyle(0xFFE57D, 0.14);
    g.fillCircle(474, 54, 67);
    g.fillStyle(C.sunPale, 0.44);
    g.fillCircle(474, 54, 47);
    g.fillStyle(C.sun, 1);
    g.fillCircle(474, 54, 31);
    g.fillStyle(0xFFF7C8, 0.8);
    g.fillCircle(464, 44, 11);
    g.fillStyle(0xA96A22, 0.72);
    g.fillCircle(465, 55, 2.3);
    g.fillCircle(483, 55, 2.3);
    g.lineStyle(2, 0xA96A22, 0.65);
    g.beginPath();
    g.arc(474, 56, 9, 0.2, Math.PI - 0.2);
    g.strokePath();

    drawCloud(g, 94, 75, 0.9);
    drawCloud(g, 268, 39, 0.53);
    drawCloud(g, 351, 94, 0.67);
    drawCloud(g, 436, 132, 0.32);

    // 远处树冠和山丘。
    g.fillStyle(0x5EB37C, 0.34);
    for (let i = 0; i < 17; i++) {
      const x = -10 + i * 37;
      const h = 28 + (i % 4) * 8;
      g.fillTriangle(x - 22, 193, x + 20, 193, x - 2, 193 - h);
    }
    g.fillStyle(C.hill, 0.76);
    g.beginPath();
    g.moveTo(0, 147);
    g.lineTo(61, 109);
    g.lineTo(119, 143);
    g.lineTo(190, 102);
    g.lineTo(259, 145);
    g.lineTo(336, 110);
    g.lineTo(417, 146);
    g.lineTo(491, 106);
    g.lineTo(540, 136);
    g.lineTo(540, 256);
    g.lineTo(0, 256);
    g.closePath();
    g.fillPath();
    g.fillStyle(C.hillDeep, 0.34);
    g.beginPath();
    g.moveTo(0, 174);
    g.lineTo(82, 141);
    g.lineTo(164, 177);
    g.lineTo(252, 140);
    g.lineTo(344, 173);
    g.lineTo(430, 147);
    g.lineTo(540, 177);
    g.lineTo(540, 264);
    g.lineTo(0, 264);
    g.closePath();
    g.fillPath();

    // 标题两侧的枝叶、音符和小花。
    drawLeafSprig(g, 152, 65, 1.35, C.greenDeep, true);
    drawLeafSprig(g, 388, 65, 1.35, C.greenDeep, false);
    drawFlower(g, 121, 52, 9, 'red', { icon: true });
    drawFlower(g, 420, 51, 9, 'blue', { icon: true });
    drawFlower(g, 143, 78, 7, 'yellow', { icon: true, alpha: 0.92 });
    drawFlower(g, 399, 78, 7, 'purple', { icon: true, alpha: 0.92 });
    g.lineStyle(2.4, 0x4B8D52, 0.56);
    g.lineBetween(164, 32, 164, 19);
    g.lineBetween(164, 19, 174, 22);
    g.fillStyle(0x4B8D52, 0.72);
    g.fillCircle(161, 33, 3);
    g.lineBetween(373, 28, 373, 15);
    g.lineBetween(373, 15, 383, 18);
    g.fillCircle(370, 29, 3);

    // 草地。
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 645, WIDTH, 315);
    g.fillStyle(C.grassLight, 0.55);
    g.fillRect(0, 645, WIDTH, 18);
    g.fillStyle(0xAEE28F, 0.2);
    g.fillRect(0, 676, WIDTH, 38);
    g.fillStyle(C.grassDeep, 0.19);
    g.beginPath();
    g.moveTo(0, 726);
    g.lineTo(54, 704);
    g.lineTo(111, 725);
    g.lineTo(171, 702);
    g.lineTo(231, 725);
    g.lineTo(300, 705);
    g.lineTo(359, 725);
    g.lineTo(426, 702);
    g.lineTo(486, 726);
    g.lineTo(540, 709);
    g.lineTo(540, 960);
    g.lineTo(0, 960);
    g.closePath();
    g.fillPath();

    // 木栅栏。
    g.fillStyle(0x9E663E, 0.42);
    for (let x = 18; x < WIDTH; x += 58) {
      g.fillRoundedRect(x + 2, 187, 10, 45, 4);
      g.fillStyle(0xCFA164, 0.8);
      g.fillRoundedRect(x, 184, 10, 43, 4);
      g.fillStyle(0xE8C384, 0.86);
      g.fillTriangle(x, 184, x + 10, 184, x + 5, 174);
      g.fillStyle(0x9E663E, 0.42);
    }
    g.fillStyle(0xE7C084, 0.88);
    g.fillRect(8, 198, WIDTH - 16, 8);
    g.fillRect(8, 214, WIDTH - 16, 7);
    g.lineStyle(1, 0x8D5B37, 0.36);
    g.lineBetween(8, 202, WIDTH - 8, 202);
    g.lineBetween(8, 218, WIDTH - 8, 218);
    drawLeafSprig(g, 8, 194, 0.58, C.greenDeep, false);
    drawLeafSprig(g, WIDTH - 8, 194, 0.58, C.greenDeep, true);

    // 草地上的花丛。
    const meadow = [
      [28, 835, 18, 'red'], [512, 846, 19, 'purple'], [494, 916, 14, 'yellow'],
      [47, 914, 13, 'blue'], [23, 963, 10, 'orange'], [520, 954, 11, 'green'],
    ];
    for (let i = 0; i < meadow.length; i++) {
      drawFlower(g, meadow[i][0], meadow[i][1], meadow[i][2], meadow[i][3], { icon: false, alpha: 0.92 });
    }
    const tufts = [[13, 895], [58, 930], [102, 943], [131, 958], [384, 941], [423, 932], [469, 944], [527, 893]];
    for (let i = 0; i < tufts.length; i++) {
      const x = tufts[i][0], y = tufts[i][1];
      g.lineStyle(2.5, C.grassDeep, 0.62);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 7, y - 18);
      g.moveTo(x, y);
      g.lineTo(x + 1, y - 24);
      g.moveTo(x, y);
      g.lineTo(x + 8, y - 16);
      g.strokePath();
    }

    // 蘑菇与三叶草。
    g.fillStyle(0xFFF1D1, 1);
    g.fillRoundedRect(501, 919, 10, 19, 5);
    g.fillStyle(0xE97A78, 1);
    g.fillEllipse(506, 918, 30, 17);
    g.fillStyle(0xFFF3D6, 0.9);
    g.fillCircle(500, 915, 2.6);
    g.fillCircle(513, 918, 2.1);
    g.fillCircle(507, 911, 1.8);
    g.fillStyle(0x4C9D58, 0.36);
    for (let i = 0; i < 4; i++) {
      const x = 30 + i * 9;
      g.fillCircle(x, 945, 4.5);
    }
    g.fillStyle(C.leafPale, 0.7);
    g.fillCircle(368, 931, 2.3);
    g.fillCircle(372, 934, 2);
    g.fillCircle(365, 935, 2);

    // 背景中的细小光点。
    const dots = [[20, 286, 2.2], [516, 304, 2.8], [489, 197, 2], [42, 196, 2.4], [332, 961, 2.2], [141, 947, 2], [308, 915, 2.4], [452, 865, 1.6]];
    for (let i = 0; i < dots.length; i++) {
      g.fillStyle(i % 2 ? 0xFFFFFF : C.gold, 0.58);
      g.fillCircle(dots[i][0], dots[i][1], dots[i][2]);
    }
  }

  function drawButterfly(g, x, y, s, color) {
    g.fillStyle(color, 0.8);
    g.fillEllipse(x - 5 * s, y - 3 * s, 11 * s, 8 * s);
    g.fillEllipse(x + 5 * s, y - 3 * s, 11 * s, 8 * s);
    g.fillEllipse(x - 4 * s, y + 4 * s, 8 * s, 6 * s);
    g.fillEllipse(x + 4 * s, y + 4 * s, 8 * s, 6 * s);
    g.fillStyle(C.ink, 0.8);
    g.fillRoundedRect(x - 1.2 * s, y - 6 * s, 2.4 * s, 13 * s, 1.2 * s);
    g.lineStyle(1.2 * s, C.ink, 0.7);
    g.lineBetween(x, y - 6 * s, x - 4 * s, y - 10 * s);
    g.lineBetween(x, y - 6 * s, x + 4 * s, y - 10 * s);
  }

  window.SoundGardenScene = SoundGardenScene;
})();
