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
    skyTop: 0xBFEAFF,
    skyBottom: 0xEFFBEA,
    sun: 0xFFE083,
    hill: 0x9DD8A1,
    hillDeep: 0x72BE86,
    grass: 0x86CF79,
    grassDeep: 0x5AA968,
    grassLight: 0xBDE9A8,
    wood: 0xE2B978,
    woodLight: 0xF5D7A0,
    woodDark: 0xA56C42,
    soil: 0xB67A4C,
    soilLight: 0xD09A65,
    soilDark: 0x815033,
    cream: 0xFFF9E9,
    creamDeep: 0xFFE9C4,
    ink: 0x4C3C32,
    inkSoft: 0x766257,
    green: 0x4C9A55,
    greenDeep: 0x34743F,
    gold: 0xF6C84E,
    goldDeep: 0xB9851F,
    coral: 0xF17A7B,
    coralDeep: 0xBA4D57,
    blue: 0x5AA8DB,
    blueDeep: 0x3677A7,
    purple: 0x9A7CDA,
    white: 0xFFFFFF,
    shadow: 0x365B39,
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
    const stem = o.icon ? false : true;
    if (stem) {
      g.lineStyle(Math.max(2, rr * 0.12), C.greenDeep, alpha);
      g.lineBetween(x, y + rr * 0.42, x, y + rr * 1.34);
      drawLeaf(g, x, y + rr * 1.02, rr * 0.62, -0.52, C.green);
      drawLeaf(g, x, y + rr * 1.13, rr * 0.56, Math.PI + 0.45, shade(C.green, 1.08));
    }
    g.fillStyle(f.deep, 0.16 * alpha);
    g.fillEllipse(x + rr * 0.12, y + rr * 0.16, rr * 1.9, rr * 0.72);

    if (key === 'red') {
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * TAU / 5;
        g.fillStyle(i % 2 === 0 ? f.color : shade(f.color, 1.08), alpha);
        g.fillCircle(x + Math.cos(a) * rr * 0.44, y + Math.sin(a) * rr * 0.44, rr * 0.38);
      }
      g.fillStyle(f.center, alpha);
      g.fillCircle(x, y, rr * 0.31);
      g.fillStyle(0xFFFFFF, 0.46 * alpha);
      g.fillCircle(x - rr * 0.08, y - rr * 0.11, rr * 0.08);
    } else if (key === 'orange') {
      g.fillStyle(f.color, alpha);
      g.beginPath();
      g.moveTo(x - rr * 0.5, y - rr * 0.44);
      g.lineTo(x + rr * 0.5, y - rr * 0.44);
      g.lineTo(x + rr * 0.75, y + rr * 0.35);
      g.lineTo(x, y + rr * 0.57);
      g.lineTo(x - rr * 0.75, y + rr * 0.35);
      g.closePath();
      g.fillPath();
      g.fillStyle(shade(f.color, 1.12), alpha);
      g.fillCircle(x - rr * 0.36, y - rr * 0.25, rr * 0.12);
      g.fillStyle(f.deep, 0.6 * alpha);
      g.fillEllipse(x, y + rr * 0.46, rr * 0.55, rr * 0.17);
      g.fillStyle(f.center, alpha);
      g.fillCircle(x, y - rr * 0.64, rr * 0.15);
      g.fillStyle(C.greenDeep, alpha);
      g.fillCircle(x, y - rr * 0.44, rr * 0.09);
    } else if (key === 'yellow') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * TAU / 6;
        const tx = x + Math.cos(a) * rr * 0.76;
        const ty = y + Math.sin(a) * rr * 0.76;
        const side = a + Math.PI / 2;
        g.fillStyle(i % 2 === 0 ? f.color : shade(f.color, 1.06), alpha);
        g.beginPath();
        g.moveTo(x + Math.cos(a + 0.42) * rr * 0.24, y + Math.sin(a + 0.42) * rr * 0.24);
        g.lineTo(tx, ty);
        g.lineTo(x + Math.cos(a - 0.42) * rr * 0.24, y + Math.sin(a - 0.42) * rr * 0.24);
        g.closePath();
        g.fillPath();
        g.fillStyle(0xFFFFFF, 0.14 * alpha);
        g.fillCircle(x + Math.cos(side) * rr * 0.12, y + Math.sin(side) * rr * 0.12, rr * 0.06);
      }
      g.fillStyle(f.center, alpha);
      g.fillCircle(x, y, rr * 0.29);
    } else if (key === 'green') {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * TAU / 4;
        const px = x + Math.cos(a) * rr * 0.42;
        const py = y + Math.sin(a) * rr * 0.42;
        g.fillStyle(i % 2 === 0 ? f.color : shade(f.color, 1.1), alpha);
        g.fillCircle(px, py, rr * 0.39);
        g.fillStyle(0xFFFFFF, 0.18 * alpha);
        g.fillCircle(px - rr * 0.08, py - rr * 0.1, rr * 0.1);
      }
      g.fillStyle(f.center, alpha);
      g.fillCircle(x, y, rr * 0.25);
    } else if (key === 'blue') {
      g.fillStyle(f.color, alpha);
      g.fillCircle(x - rr * 0.34, y - rr * 0.18, rr * 0.31);
      g.fillCircle(x, y - rr * 0.34, rr * 0.35);
      g.fillCircle(x + rr * 0.34, y - rr * 0.18, rr * 0.31);
      g.fillStyle(shade(f.color, 0.93), alpha);
      g.fillCircle(x - rr * 0.3, y + rr * 0.25, rr * 0.28);
      g.fillCircle(x + rr * 0.3, y + rr * 0.25, rr * 0.28);
      g.fillStyle(f.deep, 0.55 * alpha);
      g.fillEllipse(x, y + rr * 0.38, rr * 0.62, rr * 0.17);
      g.fillStyle(f.center, alpha);
      g.fillCircle(x, y, rr * 0.22);
    } else {
      drawStar(g, x, y, rr * 0.92, f.color, 6, alpha);
      drawStar(g, x, y, rr * 0.48, f.center, 6, alpha);
      g.fillStyle(f.deep, 0.38 * alpha);
      g.fillCircle(x, y, rr * 0.16);
      g.fillStyle(0xFFFFFF, 0.5 * alpha);
      g.fillCircle(x - rr * 0.04, y - rr * 0.06, rr * 0.06);
    }
  }

  function drawBee(g, x, y, size, wing, happy) {
    const s = size || 1;
    const flap = 0.65 + Math.abs(Math.sin(wing || 0)) * 0.35;
    g.fillStyle(0xFFFFFF, 0.56);
    g.fillEllipse(x - 11 * s, y - 10 * s, 18 * s, 11 * s * flap);
    g.fillEllipse(x + 9 * s, y - 11 * s, 17 * s, 10 * s * flap);
    g.lineStyle(1.5, 0x6B7866, 0.4);
    g.strokeEllipse(x - 11 * s, y - 10 * s, 18 * s, 11 * s * flap);
    g.strokeEllipse(x + 9 * s, y - 11 * s, 17 * s, 10 * s * flap);
    g.fillStyle(0xFFD84E, 1);
    g.fillEllipse(x, y, 34 * s, 24 * s);
    g.fillStyle(0x4B3B2A, 1);
    g.fillEllipse(x - 7 * s, y, 6 * s, 22 * s);
    g.fillEllipse(x + 6 * s, y, 5 * s, 20 * s);
    g.fillStyle(0x4B3B2A, 1);
    g.fillCircle(x - 17 * s, y - 2 * s, 10 * s);
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(x - 20 * s, y - 5 * s, 3.4 * s);
    g.fillStyle(0x2F281F, 1);
    g.fillCircle(x - 21 * s, y - 5 * s, 1.8 * s);
    g.fillStyle(0xFFFFFF, 0.68);
    g.fillCircle(x - 15 * s, y - 8 * s, 2.4 * s);
    g.lineStyle(1.5 * s, 0x4B3B2A, 1);
    g.beginPath();
    g.moveTo(x - 20 * s, y + 5 * s);
    g.lineTo(x - 16 * s, y + 7 * s);
    g.lineTo(x - 12 * s, y + 5 * s);
    g.strokePath();
    if (happy) {
      g.fillStyle(0xFF7D9C, 1);
      g.fillCircle(x - 25 * s, y + 2 * s, 2.4 * s);
      g.fillStyle(0xFFFFFF, 1);
      g.fillCircle(x - 7 * s, y - 16 * s, 2 * s);
    }
    g.lineStyle(2 * s, 0x4B3B2A, 0.8);
    g.lineBetween(x - 18 * s, y - 10 * s, x - 22 * s, y - 18 * s);
    g.lineBetween(x - 13 * s, y - 11 * s, x - 10 * s, y - 19 * s);
    g.fillStyle(0x4B3B2A, 0.9);
    g.fillCircle(x - 22 * s, y - 18 * s, 1.8 * s);
    g.fillCircle(x - 10 * s, y - 19 * s, 1.8 * s);
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
      this.subtitleText = this.add.text(L.subtitle.x, L.subtitle.y, '种下会唱歌的花，和小蜜蜂一起编曲子', {
        fontFamily: FONT, fontSize: '14px', color: '#52715A',
      }).setOrigin(0.5).setDepth(DEPTH.text);

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
      }).setOrigin(0.5).setDepth(DEPTH.text);
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
      this.renderBoard();
      this.renderTask();
      this.renderPalette();
      this.renderControls();
      this.renderBee();
      this.renderEffects();
      this.updateTexts();
    }

    renderBoard() {
      const g = this.boardG;
      const b = L.board;
      g.clear();

      g.fillStyle(C.shadow, 0.18);
      g.fillRoundedRect(b.x + 5, b.y + 9, b.w, b.h, 34);
      g.fillStyle(C.woodDark, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 30);
      g.fillStyle(C.wood, 1);
      g.fillRoundedRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6, 27);
      g.fillStyle(C.woodLight, 0.66);
      g.fillRoundedRect(b.x + 11, b.y + 11, b.w - 22, 8, 4);
      g.fillStyle(C.grassDeep, 0.36);
      g.fillRoundedRect(b.x + 11, b.y + 20, b.w - 22, b.h - 31, 19);

      for (let c = 0; c < COLS; c++) {
        const active = this.loopPlaying && c === this.beat;
        if (active) {
          const ax = L.cells[c].x - b.cell / 2 - 3;
          g.fillStyle(0xFFF7A8, 0.18 + this.currentBeatPulse * 0.14);
          g.fillRoundedRect(ax, b.y + 12, b.cell + 6, b.h - 24, 22);
          g.lineStyle(3, 0xFFE66D, 0.35 + this.currentBeatPulse * 0.4);
          g.strokeRoundedRect(ax, b.y + 12, b.cell + 6, b.h - 24, 22);
        }
      }

      for (let i = 0; i < this.cells.length; i++) {
        const cell = this.cells[i];
        const x = cell.x - cell.size / 2;
        const y = cell.y - cell.size / 2;
        const active = this.loopPlaying && cell.col === this.beat;
        g.fillStyle(C.soilDark, 0.38);
        g.fillRoundedRect(x + 2, y + 5, cell.size, cell.size, 19);
        g.fillStyle(active ? 0x8C5738 : C.soil, 1);
        g.fillRoundedRect(x, y, cell.size, cell.size, 19);
        g.fillStyle(active ? 0x9F6844 : C.soilLight, 0.42);
        g.fillRoundedRect(x + 7, y + 7, cell.size - 14, cell.size - 24, 13);
        g.fillStyle(C.soilDark, 0.28);
        for (let d = 0; d < 5; d++) {
          const dx = x + 19 + ((d * 19 + i * 13) % 58);
          const dy = y + 22 + ((d * 23 + i * 7) % 55);
          g.fillCircle(dx, dy, 1.7);
        }
        if (!cell.key) {
          g.lineStyle(2, 0xE9C79E, 0.28);
          g.strokeRoundedRect(x + 12, y + 12, cell.size - 24, cell.size - 24, 13);
          g.lineStyle(1.8, 0x7D5139, 0.22);
          g.lineBetween(cell.x - 8, cell.y + 28, cell.x, cell.y + 37);
          g.lineBetween(cell.x, cell.y + 37, cell.x + 8, cell.y + 28);
        }
      }

      for (let i = 0; i < this.cells.length; i++) {
        const cell = this.cells[i];
        if (!cell.key) continue;
        const active = this.loopPlaying && cell.col === this.beat;
        const bob = Math.sin(this.clockSec * (active ? 11 : 2.2) + i * 0.9) * (active ? 3.2 : 0.8);
        const scale = active ? 1 + this.currentBeatPulse * 0.09 : 1;
        drawFlower(g, cell.x, cell.y - 3 + bob, 25, cell.key, { scale: scale });
      }
    }

    renderTask() {
      const g = this.taskG;
      const t = L.task;
      g.clear();
      g.fillStyle(C.shadow, 0.13);
      g.fillRoundedRect(t.x + 3, t.y + 5, t.w, t.h, 22);
      g.fillStyle(C.cream, 0.98);
      g.fillRoundedRect(t.x, t.y, t.w, t.h, 22);
      g.lineStyle(this.taskBusy ? 4 : 2.5, this.taskBusy ? C.gold : 0xE4BE72, 0.92);
      g.strokeRoundedRect(t.x, t.y, t.w, t.h, 22);
      g.fillStyle(this.taskBusy ? 0xFFF2B8 : 0xF5E7C9, 1);
      g.fillCircle(79, 147, 28);
      g.lineStyle(2, 0xE2BC75, 0.9);
      g.strokeCircle(79, 147, 28);
      if (this.task) drawTaskIcon(g, this.task.id, 79, 147, 34);
      else drawFlower(g, 79, 147, 15, 'purple', { icon: true });

      drawPill(g, L.taskSwap.x, L.taskSwap.y, L.taskSwap.w, L.taskSwap.h, 0xF3E1BE, 0xD5AA66, 1.5, 1);
      g.fillStyle(C.greenDeep, 0.72);
      g.fillCircle(L.taskSwap.x - 25, L.taskSwap.y, 2.2);
      g.fillCircle(L.taskSwap.x - 18, L.taskSwap.y, 2.2);
      g.fillCircle(L.taskSwap.x - 11, L.taskSwap.y, 2.2);
      if (this.taskBusy) {
        g.fillStyle(C.gold, 0.18 + Math.sin(this.clockSec * 9) * 0.07);
        g.fillRoundedRect(t.x - 3, t.y - 3, t.w + 6, t.h + 6, 25);
      }
      for (let i = 0; i < TASK_IDS.length; i++) {
        const x = 112 + i * 11;
        const done = i < Math.min(this.completedTasks, TASK_IDS.length);
        g.fillStyle(done ? C.gold : 0xD9CDBA, done ? 1 : 0.7);
        g.fillCircle(x, 178, 2.5);
      }
    }

    renderPalette() {
      const g = this.paletteG;
      const p = L.palette;
      g.clear();
      g.fillStyle(C.shadow, 0.14);
      g.fillRoundedRect(p.x + 3, p.y + 6, p.w, p.h, 26);
      g.fillStyle(0xFCEFD7, 0.96);
      g.fillRoundedRect(p.x, p.y, p.w, p.h, 26);
      g.lineStyle(2, 0xE2BE83, 0.76);
      g.strokeRoundedRect(p.x, p.y, p.w, p.h, 26);
      g.fillStyle(C.green, 0.16);
      g.fillRoundedRect(p.x + 8, p.y + 7, p.w - 16, 10, 5);

      for (let i = 0; i < L.paletteItems.length; i++) {
        const item = L.paletteItems[i];
        const selected = this.selected === item.key;
        if (selected) {
          const pulse = 1 + Math.sin(this.clockSec * 6) * 0.035;
          g.fillStyle(FLOWERS[item.key].color, 0.2);
          g.fillCircle(item.x, item.y - 3, 32 * pulse);
          g.lineStyle(3, FLOWERS[item.key].deep, 0.9);
          g.strokeCircle(item.x, item.y - 3, 31 * pulse);
          g.fillStyle(C.white, 0.4);
          g.fillCircle(item.x - 9, item.y - 15, 3.5);
        } else {
          g.fillStyle(0xFFFFFF, 0.34);
          g.fillCircle(item.x, item.y - 2, 28);
        }
        drawFlower(g, item.x, item.y - 3, 20, item.key, { icon: true, scale: selected ? 1.08 : 1 });
      }
    }

    renderControls() {
      const g = this.controlsG;
      g.clear();
      const shovelSelected = this.selected === 'shovel';
      drawPill(g, L.shovel.x, L.shovel.y, L.shovel.w, L.shovel.h, shovelSelected ? 0xFFF0A8 : C.cream, shovelSelected ? C.goldDeep : 0xD4AC72, shovelSelected ? 3 : 2, 0.98);
      this.drawShovelIcon(g, L.shovel.x - 22, L.shovel.y - 1, shovelSelected);

      const playFill = this.loopPlaying ? 0xF09078 : 0x5CB86A;
      const playDeep = this.loopPlaying ? 0xC55B55 : 0x3F9252;
      g.fillStyle(playDeep, 0.44);
      g.fillRoundedRect(L.play.x - L.play.w / 2 + 2, L.play.y - L.play.h / 2 + 5, L.play.w, L.play.h, L.play.h / 2);
      g.fillStyle(playFill, 1);
      g.fillRoundedRect(L.play.x - L.play.w / 2, L.play.y - L.play.h / 2, L.play.w, L.play.h, L.play.h / 2);
      g.fillStyle(0xFFFFFF, 0.2);
      g.fillRoundedRect(L.play.x - L.play.w / 2 + 9, L.play.y - L.play.h / 2 + 7, L.play.w - 18, 10, 5);
      if (this.loopPlaying) {
        g.fillStyle(0xFFFFFF, 0.94);
        g.fillRoundedRect(L.play.x - 88, L.play.y - 8, 6, 16, 2);
        g.fillRoundedRect(L.play.x - 79, L.play.y - 8, 6, 16, 2);
        g.fillStyle(0xFFF3C9, 0.25 + this.currentBeatPulse * 0.2);
        g.fillCircle(L.play.x, L.play.y, 31 + this.currentBeatPulse * 7);
      } else {
        g.fillStyle(0xFFFFFF, 0.96);
        g.fillTriangle(L.play.x - 90, L.play.y - 10, L.play.x - 90, L.play.y + 10, L.play.x - 75, L.play.y);
      }

      const armed = this.clearArmedUntil > this.clockSec;
      drawPill(g, L.clear.x, L.clear.y, L.clear.w, L.clear.h, armed ? 0xFFD4CB : C.cream, armed ? C.coralDeep : 0xD4AC72, armed ? 3 : 2, 0.98);
      g.lineStyle(2, armed ? C.coralDeep : 0x9E775A, 0.9);
      g.strokeCircle(L.clear.x - 24, L.clear.y - 2, 8);
      g.lineBetween(L.clear.x - 30, L.clear.y - 2, L.clear.x - 18, L.clear.y - 2);
      g.lineBetween(L.clear.x - 27, L.clear.y - 10, L.clear.x - 21, L.clear.y - 10);
      g.lineBetween(L.clear.x - 27, L.clear.y + 6, L.clear.x - 21, L.clear.y + 6);
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
        g.fillStyle(C.gold, 0.16);
        g.fillCircle(this.beeX, this.beeY, 34 + Math.sin(this.clockSec * 7) * 5);
      }
      if (this.loopPlaying) {
        g.lineStyle(2, 0xFFFFFF, 0.45);
        for (let i = 0; i < 3; i++) {
          const tx = lerp(this.beeX, L.cells[this.beat].x, (i + 1) / 4);
          g.fillStyle(0xFFFFFF, 0.3 - i * 0.06);
          g.fillCircle(tx, this.beeY + Math.sin(this.clockSec * 5 + i) * 4, 3.2 - i * 0.4);
        }
      }
      drawBee(g, this.beeX, this.beeY, 0.88, this.beeWing, this.taskBusy);
      if (this.taskBusy) {
        g.fillStyle(0xFF8DA5, 1);
        const hx = this.beeX + 28;
        const hy = this.beeY - 22 + Math.sin(this.clockSec * 5) * 3;
        g.fillCircle(hx - 4, hy, 4);
        g.fillCircle(hx + 4, hy, 4);
        g.fillTriangle(hx - 8, hy + 2, hx + 8, hy + 2, hx, hy + 10);
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
    const bands = 48;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      g.fillStyle(mixHex(C.skyTop, C.skyBottom, t), 1);
      g.fillRect(0, i * (HEIGHT / bands) - 1, WIDTH, HEIGHT / bands + 2);
    }

    g.fillStyle(0xFFE8A0, 0.22);
    g.fillCircle(474, 54, 49);
    g.fillStyle(C.sun, 0.96);
    g.fillCircle(474, 54, 30);
    g.fillStyle(0xFFF5C4, 0.82);
    g.fillCircle(465, 45, 11);
    drawCloud(g, 93, 72, 0.86);
    drawCloud(g, 268, 40, 0.54);
    drawCloud(g, 354, 90, 0.64);

    g.fillStyle(C.hill, 0.72);
    g.beginPath();
    g.moveTo(0, 141);
    g.lineTo(61, 105);
    g.lineTo(118, 137);
    g.lineTo(189, 99);
    g.lineTo(258, 139);
    g.lineTo(336, 106);
    g.lineTo(416, 142);
    g.lineTo(490, 103);
    g.lineTo(540, 132);
    g.lineTo(540, 250);
    g.lineTo(0, 250);
    g.closePath();
    g.fillPath();
    g.fillStyle(C.hillDeep, 0.36);
    g.beginPath();
    g.moveTo(0, 171);
    g.lineTo(82, 139);
    g.lineTo(163, 174);
    g.lineTo(252, 138);
    g.lineTo(344, 170);
    g.lineTo(430, 145);
    g.lineTo(540, 174);
    g.lineTo(540, 260);
    g.lineTo(0, 260);
    g.closePath();
    g.fillPath();

    g.fillStyle(C.grass, 1);
    g.fillRect(0, 650, WIDTH, 310);
    g.fillStyle(C.grassLight, 0.55);
    g.fillRect(0, 650, WIDTH, 17);
    g.fillStyle(C.grassDeep, 0.24);
    g.beginPath();
    g.moveTo(0, 721);
    g.lineTo(54, 700);
    g.lineTo(111, 721);
    g.lineTo(171, 697);
    g.lineTo(231, 720);
    g.lineTo(300, 700);
    g.lineTo(359, 720);
    g.lineTo(426, 697);
    g.lineTo(486, 721);
    g.lineTo(540, 704);
    g.lineTo(540, 960);
    g.lineTo(0, 960);
    g.closePath();
    g.fillPath();

    // 木栅栏，藏在花圃后面，只露出一点。
    g.fillStyle(0xC99760, 0.7);
    for (let x = 18; x < WIDTH; x += 58) {
      g.fillRoundedRect(x, 184, 9, 40, 4);
      g.fillStyle(0xE0B77A, 0.7);
      g.fillTriangle(x, 184, x + 9, 184, x + 4, 174);
      g.fillStyle(0xC99760, 0.7);
    }
    g.fillStyle(0xE4BC7F, 0.76);
    g.fillRect(8, 198, WIDTH - 16, 8);
    g.fillRect(8, 214, WIDTH - 16, 7);

    // 花圃边缘和底部的花草。
    const tufts = [[20, 894], [49, 925], [95, 938], [388, 936], [445, 927], [501, 941], [524, 891]];
    for (let i = 0; i < tufts.length; i++) {
      const x = tufts[i][0], y = tufts[i][1];
      g.lineStyle(3, C.grassDeep, 0.8);
      g.lineBetween(x, y, x - 6, y - 17);
      g.lineBetween(x, y, x + 1, y - 23);
      g.lineBetween(x, y, x + 8, y - 15);
    }
    drawFlower(g, 28, 835, 18, 'red', { icon: false, alpha: 0.92 });
    drawFlower(g, 512, 846, 19, 'purple', { icon: false, alpha: 0.92 });
    drawFlower(g, 494, 916, 14, 'yellow', { icon: false, alpha: 0.86 });
    drawFlower(g, 47, 914, 13, 'blue', { icon: false, alpha: 0.86 });

    // 蘑菇。
    g.fillStyle(0xFFF1D1, 1);
    g.fillRoundedRect(501, 919, 10, 19, 5);
    g.fillStyle(0xE97A78, 1);
    g.fillEllipse(506, 918, 30, 17);
    g.fillStyle(0xFFF3D6, 0.9);
    g.fillCircle(500, 915, 2.6);
    g.fillCircle(513, 918, 2.1);
    g.fillCircle(507, 911, 1.8);

    // 两只小蝴蝶。
    drawButterfly(g, 78, 176, 0.82, 0xF17A7B);
    drawButterfly(g, 372, 170, 0.72, 0xF6D34B);

    // 背景里的细小花瓣与光点。
    const dots = [[20, 286, 2.2], [516, 304, 2.8], [489, 197, 2], [42, 196, 2.4], [332, 961, 2.2], [141, 947, 2], [308, 915, 2.4]];
    for (let i = 0; i < dots.length; i++) {
      g.fillStyle(i % 2 ? 0xFFFFFF : C.gold, 0.52);
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
