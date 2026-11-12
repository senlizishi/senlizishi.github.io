/*
 * 森林平衡木：540x960 竖屏低龄向平衡小游戏。
 * 固定 8 个轻任务：把一边预先摆好的果实，用红果/橡果/蘑菇/菠萝在另一边配平。
 * 全画面 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，不加载素材文件。
 * 无计时、无分数、无失败；任务完成后可以进入自由玩。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const TAU = Math.PI * 2;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TITLE_FONT = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "Microsoft YaHei", serif';

  const ROUND_SIZE = 8;
  const TASK_TOTALS = [2, 3, 4, 5, 6, 7, 8, 9];
  const TASK_PATTERNS = [
    [1, 1],
    [2, 1],
    [2, 2],
    [3, 2],
    [4, 2],
    [4, 3],
    [4, 3, 1],
    [4, 3, 2],
  ];
  const MAX_PAN_ITEMS = 12;
  const BALANCE_HOLD = 0.6;
  const NEXT_DELAY = 0.9;
  const HINT_DELAY = 7;
  const HINT_SHOW_SEC = 4;
  const TAP_LOCK = 0.5;
  const DRAG_SCALE = 1.12;
  const DRAG_LIFT = 42;
  const POINTER_NONE = 0;

  const DEPTH = {
    world: 0,
    tray: 1,
    trayItems: 2,
    beam: 3,
    pans: 4,
    panItems: 5,
    squirrel: 6,
    fx: 14,
    tip: 19,
    ui: 20,
    drag: 22,
    overlay: 40,
    card: 41,
  };

  const C = {
    skyTop: 0xBFE9FF,
    skyBottom: 0xEAF9FF,
    hill: 0x9ED184,
    hillDark: 0x7FB969,
    grass: 0xA8D98A,
    grassLight: 0xC7E9A8,
    grassDark: 0x83B96A,
    tree: 0x72B966,
    treeDark: 0x4F9553,
    treeLight: 0x9ED78B,
    trunk: 0x9A6A43,
    trunkDark: 0x6E472E,
    soil: 0x8C5D3F,
    wood: 0xC98A4F,
    woodLight: 0xE8C18A,
    woodDark: 0x8A5A32,
    woodDeep: 0x653D24,
    rope: 0x8A6240,
    pan: 0xD9A363,
    panLight: 0xF3D6A6,
    panDark: 0x98653A,
    cream: 0xFFF8EA,
    ink: 0x4E5D3D,
    inkSoft: 0x73845F,
    gold: 0xE7B84C,
    goldLight: 0xFFF1B8,
    leaf: 0x78B95D,
    leafDark: 0x4E8C46,
    berry: 0xE85B6A,
    berryDark: 0xB83B50,
    berryLight: 0xFF9BAA,
    acorn: 0xB9763F,
    acornDark: 0x7E4A29,
    acornLight: 0xE2B37B,
    acornCap: 0x70452A,
    mushroom: 0xE88773,
    mushroomDark: 0xB4534A,
    mushroomLight: 0xFFC0A8,
    mushroomStem: 0xFFF1D4,
    pineapple: 0xF3C44F,
    pineappleDark: 0xB9852A,
    pineappleLight: 0xFFE68A,
    pineappleLeaf: 0x67A84A,
    squirrel: 0xE8A45A,
    squirrelDark: 0xC47B3C,
    squirrelLight: 0xFFF1D8,
    squirrelBlush: 0xF2A69E,
    scarf: 0x4CA6D8,
    white: 0xFFFFFF,
    shadow: 0x2F4A2B,
    greenButton: 0x5DA566,
    greenDark: 0x3F7C4D,
    coral: 0xE1788A,
    cloud: 0xFFFFFF,
  };

  const ITEM_DEFS = [
    { key: 'berry', name: '红果', weight: 1, color: C.berry, dark: C.berryDark, light: C.berryLight },
    { key: 'acorn', name: '橡果', weight: 2, color: C.acorn, dark: C.acornDark, light: C.acornLight },
    { key: 'mushroom', name: '蘑菇', weight: 3, color: C.mushroom, dark: C.mushroomDark, light: C.mushroomLight },
    { key: 'pineapple', name: '菠萝', weight: 4, color: C.pineapple, dark: C.pineappleDark, light: C.pineappleLight },
  ];
  const ITEM_BY_KEY = {};
  const ITEM_BY_WEIGHT = {};
  for (let i = 0; i < ITEM_DEFS.length; i++) {
    ITEM_BY_KEY[ITEM_DEFS[i].key] = ITEM_DEFS[i];
    ITEM_BY_WEIGHT[ITEM_DEFS[i].weight] = ITEM_DEFS[i];
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pseudo(n) { return (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1; }
  function abs(n) { return n < 0 ? -n : n; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function pointInRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }

  function drawRounded(g, x, y, w, h, r, fill, stroke, fillAlpha, strokeAlpha, lineWidth) {
    g.fillStyle(fill, fillAlpha == null ? 1 : fillAlpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke != null) {
      g.lineStyle(lineWidth == null ? 2 : lineWidth, stroke, strokeAlpha == null ? 1 : strokeAlpha);
      g.strokeRoundedRect(x, y, w, h, r);
    }
  }

  function drawPill(g, x, y, w, h, fill, stroke, fillAlpha, strokeAlpha, lineWidth) {
    drawRounded(g, x - w / 2, y - h / 2, w, h, h / 2, fill, stroke, fillAlpha, strokeAlpha, lineWidth);
  }

  function drawStar(g, x, y, r, color, alpha) {
    const a = alpha == null ? 1 : alpha;
    g.fillStyle(color, a);
    g.fillTriangle(x, y - r, x + r * 0.78, y, x, y + r);
    g.fillTriangle(x, y - r, x - r * 0.78, y, x, y + r);
  }

  function drawDotRow(g, x, y, count, color, alpha, dotR, gap) {
    const n = Math.max(0, Math.floor(count));
    if (!n) return;
    const r = dotR == null ? 2.2 : dotR;
    const d = gap == null ? 7 : gap;
    for (let i = 0; i < n; i++) {
      g.fillStyle(color, alpha == null ? 1 : alpha);
      g.fillCircle(x + (i - (n - 1) / 2) * d, y, r);
    }
  }

  function computeLayout() {
    return {
      title: { x: 270, y: 54 },
      subtitle: { x: 270, y: 100 },
      progress: { x: 474, y: 86, w: 88, h: 48 },
      taskPill: { x: 270, y: 160, w: 252, h: 40 },
      beam: { pivotX: 270, pivotY: 500, half: 180, panDrop: 54, maxTilt: 0.2 },
      tray: {
        left: 24, top: 748, right: 516, bottom: 940,
        slots: [90, 210, 330, 450], itemY: 812, tagY: 854, nameY: 888,
      },
      squirrel: { x: 474, y: 704 },
      freeRestart: { x: 468, y: 136, w: 96, h: 28 },
      card: { x: 270, y: 480, w: 430, h: 380 },
    };
  }
  const L = computeLayout();

  function drawWorld(g) {
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyBottom, C.skyBottom, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // 远处山坡和树冠
    g.fillStyle(0x9BCE86, 1);
    g.fillEllipse(86, 294, 300, 160);
    g.fillEllipse(458, 286, 340, 170);
    g.fillStyle(0x83BD72, 1);
    g.fillEllipse(270, 312, 360, 140);

    const trees = [
      [22, 270, 0.85], [112, 255, 1.0], [198, 280, 0.75], [322, 262, 0.92],
      [406, 288, 0.78], [514, 258, 1.05],
    ];
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      g.fillStyle(C.trunkDark, 0.85);
      g.fillRect(t[0] - 4, 260, 8, 92);
      g.fillStyle(C.treeDark, 0.95);
      g.fillCircle(t[0], 244, 42 * t[2]);
      g.fillStyle(C.tree, 1);
      g.fillCircle(t[0] - 17, 236, 30 * t[2]);
      g.fillCircle(t[0] + 18, 240, 34 * t[2]);
      g.fillStyle(C.treeLight, 0.64);
      g.fillCircle(t[0] - 8, 226, 17 * t[2]);
    }

    // 云朵和太阳
    const clouds = [[78, 108, 0.85], [388, 76, 0.72], [232, 188, 0.58]];
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      g.fillStyle(C.cloud, 0.68 * c[2]);
      g.fillEllipse(c[0], c[1], 78, 24);
      g.fillEllipse(c[0] - 24, c[1] - 8, 50, 28);
      g.fillEllipse(c[0] + 25, c[1] - 3, 56, 30);
    }
    g.fillStyle(0xFFF3B8, 0.16);
    g.fillCircle(474, 164, 64);
    g.fillStyle(0xFFF0A8, 0.26);
    g.fillCircle(474, 164, 45);
    g.fillStyle(0xFFE57A, 1);
    g.fillCircle(474, 164, 27);
    g.fillStyle(0xFFF7C9, 0.82);
    g.fillCircle(465, 155, 9);

    // 草地
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 330, WIDTH, 430);
    g.fillStyle(C.grassLight, 0.6);
    g.fillEllipse(88, 408, 190, 36);
    g.fillEllipse(456, 436, 220, 42);
    g.fillStyle(C.grassDark, 0.34);
    for (let i = 0; i < 80; i++) {
      const x = (pseudo(i + 3) + 1) * 0.5 * WIDTH;
      const y = 360 + (pseudo(i + 91) + 1) * 0.5 * 330;
      g.lineStyle(1.1, i % 3 ? C.grassDark : C.grassLight, 0.28);
      g.lineBetween(x, y, x + 3, y - 7);
      g.lineBetween(x + 4, y, x + 7, y - 5);
    }

    // 几朵背景小花
    const deco = [[42, 390, 0xFFDCE8], [506, 410, 0xFFF0C7], [58, 630, 0xC7A4F0], [486, 670, 0xFFE06A]];
    for (let i = 0; i < deco.length; i++) {
      g.lineStyle(2, C.leafDark, 0.55);
      g.lineBetween(deco[i][0], deco[i][1], deco[i][0] + 1, deco[i][1] + 18);
      g.fillStyle(deco[i][2], 0.86);
      g.fillCircle(deco[i][0] - 5, deco[i][1] - 3, 4);
      g.fillCircle(deco[i][0] + 5, deco[i][1] - 3, 4);
      g.fillCircle(deco[i][0], deco[i][1] - 8, 4);
      g.fillStyle(C.gold, 0.9);
      g.fillCircle(deco[i][0], deco[i][1] - 3, 3);
    }

    // 木台
    g.fillStyle(0x6A442D, 0.22);
    g.fillEllipse(270, 920, 530, 74);
    g.fillStyle(C.woodDark, 1);
    g.fillRoundedRect(12, 726, 516, 220, 24);
    g.fillStyle(C.wood, 1);
    g.fillRoundedRect(18, 720, 504, 214, 22);
    g.fillStyle(C.woodLight, 0.42);
    g.fillRoundedRect(22, 726, 496, 16, 8);
    g.lineStyle(1.4, C.woodDeep, 0.22);
    for (let i = 0; i < 5; i++) {
      const y = 800 + i * 27;
      g.lineBetween(38, y, 502, y + Math.sin(i * 1.2) * 3);
    }
    g.fillStyle(0x5D3A22, 0.14);
    for (let i = 0; i < 7; i++) {
      g.fillEllipse(72 + i * 66, 840 + (i % 2) * 34, 28, 8);
    }

    // 树桩和小草
    g.fillStyle(C.trunkDark, 0.9);
    g.fillEllipse(474, 732, 76, 26);
    g.fillStyle(C.trunk, 1);
    g.fillRoundedRect(452, 706, 44, 28, 8);
    g.fillStyle(C.woodLight, 0.5);
    g.fillEllipse(474, 708, 42, 10);
    g.lineStyle(1.2, C.woodDeep, 0.5);
    g.strokeEllipse(474, 708, 42, 10);
  }

  function drawTrayBase(g) {
    const t = L.tray;
    g.fillStyle(0x4B2F1D, 0.22);
    g.fillRoundedRect(t.left + 4, t.top + 8, t.right - t.left, t.bottom - t.top, 24);
    drawRounded(g, t.left, t.top, t.right - t.left, t.bottom - t.top, 24, 0xE4C18B, 0xA97645, 0.98, 0.9, 2.4);
    g.fillStyle(0xFFF0C7, 0.42);
    g.fillRoundedRect(t.left + 8, t.top + 8, t.right - t.left - 16, 11, 6);
    for (let i = 0; i < 4; i++) {
      const x = t.slots[i];
      g.fillStyle(0x6F4A2D, 0.14);
      g.fillEllipse(x, t.itemY + 28, 88, 18);
      g.fillStyle(0xFFF6DC, 0.35);
      g.fillCircle(x, t.itemY, 38);
    }
  }

  function drawFruit(g, key, x, y, scale, alpha) {
    const s = scale == null ? 1 : scale;
    const a = alpha == null ? 1 : alpha;
    if (key === 'berry') {
      g.fillStyle(C.shadow, 0.16 * a);
      g.fillEllipse(x + 2 * s, y + 16 * s, 28 * s, 8 * s);
      g.fillStyle(C.berry, a);
      g.fillCircle(x, y, 15 * s);
      g.fillStyle(C.berryLight, 0.64 * a);
      g.fillCircle(x - 5 * s, y - 6 * s, 5 * s);
      g.fillStyle(C.berryDark, 0.88 * a);
      g.fillCircle(x + 5 * s, y + 3 * s, 2 * s);
      g.fillStyle(C.leaf, a);
      g.fillEllipse(x + 8 * s, y - 15 * s, 13 * s, 6 * s);
      g.fillStyle(C.leafDark, 0.72 * a);
      g.lineBetween(x + 2 * s, y - 14 * s, x + 6 * s, y - 6 * s);
    } else if (key === 'acorn') {
      g.fillStyle(C.shadow, 0.16 * a);
      g.fillEllipse(x + 2 * s, y + 18 * s, 29 * s, 8 * s);
      g.fillStyle(C.acorn, a);
      g.fillEllipse(x, y + 4 * s, 26 * s, 31 * s);
      g.fillStyle(C.acornLight, 0.7 * a);
      g.fillEllipse(x - 5 * s, y + 1 * s, 9 * s, 13 * s);
      g.fillStyle(C.acornCap, a);
      g.fillEllipse(x, y - 10 * s, 30 * s, 14 * s);
      g.fillStyle(C.woodLight, 0.65 * a);
      g.fillEllipse(x - 6 * s, y - 12 * s, 8 * s, 4 * s);
      g.lineStyle(2 * s, C.woodDeep, 0.84 * a);
      g.lineBetween(x, y - 16 * s, x + 2 * s, y - 23 * s);
    } else if (key === 'mushroom') {
      g.fillStyle(C.shadow, 0.16 * a);
      g.fillEllipse(x + 2 * s, y + 19 * s, 31 * s, 8 * s);
      g.fillStyle(C.mushroomStem, a);
      g.fillRoundedRect(x - 6 * s, y, 12 * s, 22 * s, 5 * s);
      g.fillStyle(C.mushroom, a);
      g.fillEllipse(x, y - 2 * s, 38 * s, 24 * s);
      g.fillStyle(C.mushroomLight, 0.7 * a);
      g.fillEllipse(x - 7 * s, y - 7 * s, 10 * s, 5 * s);
      g.fillStyle(C.mushroomDark, 0.62 * a);
      g.fillCircle(x + 8 * s, y - 3 * s, 3.4 * s);
      g.fillCircle(x - 8 * s, y + 2 * s, 2.2 * s);
    } else if (key === 'pineapple') {
      g.fillStyle(C.shadow, 0.16 * a);
      g.fillEllipse(x + 2 * s, y + 20 * s, 33 * s, 9 * s);
      g.fillStyle(C.pineappleLeaf, a);
      for (let i = 0; i < 4; i++) {
        g.fillTriangle(x + (i - 1.5) * 5 * s, y - 12 * s, x + (i - 1.5) * 7 * s, y - 32 * s, x + (i - 1.5) * 2 * s, y - 16 * s);
      }
      g.fillStyle(C.pineapple, a);
      g.fillEllipse(x, y + 4 * s, 28 * s, 34 * s);
      g.fillStyle(C.pineappleLight, 0.65 * a);
      g.fillEllipse(x - 6 * s, y - 3 * s, 9 * s, 15 * s);
      g.lineStyle(1.2 * s, C.pineappleDark, 0.65 * a);
      g.lineBetween(x - 8 * s, y - 5 * s, x + 8 * s, y + 11 * s);
      g.lineBetween(x + 8 * s, y - 5 * s, x - 8 * s, y + 11 * s);
    }
  }

  function drawWeightTag(g, weight, x, y, scale, alpha) {
    const s = scale == null ? 1 : scale;
    const a = alpha == null ? 1 : alpha;
    const w = Math.max(24, 10 + weight * 8) * s;
    const h = 14 * s;
    drawPill(g, x, y, w, h, C.cream, C.woodDark, 0.94 * a, 0.52 * a, 1.1 * s);
    g.fillStyle(C.gold, a);
    drawDotRow(g, x, y, weight, C.gold, a, 2.1 * s, 6.5 * s);
  }

  function drawTotalTag(g, weight, x, y, fixed, alpha) {
    if (!weight) return;
    const a = alpha == null ? 1 : alpha;
    const dots = Math.min(12, weight);
    const w = Math.max(46, 16 + dots * 8);
    drawPill(g, x, y, w, 22, fixed ? 0xFFF0C0 : C.cream, fixed ? C.gold : C.woodDark, 0.96 * a, fixed ? 0.9 : 0.52, 1.4);
    drawDotRow(g, x, y, dots, C.gold, a, 2.3, 7);
    if (weight > 12) {
      g.fillStyle(C.ink, 0.9 * a);
      g.fillCircle(x + w / 2 - 4, y - 6, 1.3);
      g.fillCircle(x + w / 2, y - 6, 1.3);
    }
  }

  function panItemLayout(panX, panY, count) {
    const out = [];
    const rows = Math.max(1, Math.ceil(count / 4));
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const rowCount = Math.min(4, count - row * 4);
      out.push({
        x: panX + (col - (rowCount - 1) / 2) * 27,
        y: panY - 29 - (rows - 1 - row) * 24,
      });
    }
    return out;
  }

  function drawDashedEllipse(g, x, y, rx, ry, color, alpha, clock, segments) {
    const n = segments || 16;
    const step = TAU / n;
    for (let i = 0; i < n; i += 2) {
      const a1 = clock * 0.35 + i * step;
      const a2 = a1 + step * 0.56;
      g.lineStyle(2.2, color, alpha);
      g.lineBetween(x + Math.cos(a1) * rx, y + Math.sin(a1) * ry, x + Math.cos(a2) * rx, y + Math.sin(a2) * ry);
    }
  }

  function drawSquirrel(g, x, y, clock, cheer) {
    const bob = cheer ? -Math.abs(Math.sin(clock * 6.3)) * 8 : Math.sin(clock * 2.1) * 1.5;
    const sway = Math.sin(clock * (cheer ? 9 : 3.3)) * (cheer ? 0.28 : 0.16);
    g.fillStyle(C.shadow, 0.18);
    g.fillEllipse(x, y + 34, 58, 14);

    // 大尾巴
    g.fillStyle(C.squirrelDark, 1);
    g.fillEllipse(x - 29, y - 18 + Math.sin(clock * 2.6) * 3, 46, 62);
    g.fillStyle(C.squirrel, 1);
    g.fillEllipse(x - 34, y - 22 + Math.sin(clock * 2.6) * 3, 34, 50);
    g.fillStyle(C.squirrelLight, 0.55);
    g.fillEllipse(x - 39, y - 30 + Math.sin(clock * 2.6) * 3, 14, 23);

    // 身体、肚子和项圈
    g.fillStyle(C.squirrelDark, 1);
    g.fillEllipse(x, y + 8 + bob, 43, 49);
    g.fillStyle(C.squirrel, 1);
    g.fillEllipse(x, y + 5 + bob, 39, 45);
    g.fillStyle(C.squirrelLight, 1);
    g.fillEllipse(x, y + 12 + bob, 21, 30);
    g.fillStyle(C.scarf, 1);
    g.fillRoundedRect(x - 20, y - 8 + bob, 40, 8, 4);
    g.fillStyle(0xFFD75E, 1);
    g.fillCircle(x + 11, y - 3 + bob, 2.5);

    // 头和耳朵
    g.fillStyle(C.squirrelDark, 1);
    g.fillCircle(x, y - 24 + bob, 24);
    g.fillStyle(C.squirrel, 1);
    g.fillCircle(x, y - 25 + bob, 22);
    g.fillStyle(C.squirrel, 1);
    g.fillTriangle(x - 20, y - 39 + bob, x - 9, y - 57 + bob, x - 2, y - 39 + bob);
    g.fillTriangle(x + 20, y - 39 + bob, x + 9, y - 57 + bob, x + 2, y - 39 + bob);
    g.fillStyle(C.squirrelLight, 0.85);
    g.fillTriangle(x - 16, y - 41 + bob, x - 10, y - 51 + bob, x - 6, y - 41 + bob);
    g.fillTriangle(x + 16, y - 41 + bob, x + 10, y - 51 + bob, x + 6, y - 41 + bob);

    // 脸
    g.fillStyle(C.squirrelLight, 1);
    g.fillEllipse(x, y - 17 + bob, 23, 15);
    g.fillStyle(0x3D2D26, 1);
    g.fillCircle(x - 8, y - 28 + bob, 2.2);
    g.fillCircle(x + 8, y - 28 + bob, 2.2);
    g.fillStyle(C.squirrelBlush, 0.7);
    g.fillCircle(x - 14, y - 19 + bob, 3);
    g.fillCircle(x + 14, y - 19 + bob, 3);
    g.fillStyle(0x3D2D26, 1);
    g.fillEllipse(x, y - 19 + bob, 5, 4);
    g.lineStyle(1.3, 0x70452A, 0.65);
    g.lineBetween(x - 2, y - 15 + bob, x - 7, y - 12 + bob);
    g.lineBetween(x + 2, y - 15 + bob, x + 7, y - 12 + bob);

    // 手和脚
    g.fillStyle(C.squirrelDark, 1);
    if (cheer) {
      g.fillEllipse(x - 24, y - 8 + bob, 9, 14);
      g.fillEllipse(x + 24, y - 8 + bob, 9, 14);
    } else {
      g.fillEllipse(x - 19, y + 15 + bob, 10, 13);
      g.fillEllipse(x + 19, y + 15 + bob, 10, 13);
    }
    g.fillStyle(C.squirrel, 1);
    g.fillEllipse(x - 12, y + 31 + bob, 13, 5);
    g.fillEllipse(x + 12, y + 31 + bob, 13, 5);
    g.fillStyle(C.squirrelDark, 1);
    g.fillCircle(x - 17, y + 31 + bob, 2.2);
    g.fillCircle(x + 17, y + 31 + bob, 2.2);

    // 摇尾巴的小叶子
    drawStar(g, x - 42 + sway * 14, y - 34, 3.2, C.leaf, 0.7);
  }

  const Sound = (function () {
    let ctx = null;
    let master = null;

    function ensure() {
      if (ctx) {
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        return ctx;
      }
      if (typeof window === 'undefined') return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.18;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
      }
      return ctx;
    }

    function tone(freq, dur, vol, delay, type) {
      const c = ensure();
      if (!c || !master) return;
      try {
        const t = c.currentTime + (delay || 0);
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol == null ? 0.03 : vol), t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + (dur || 0.2) + 0.03);
      } catch (e) { /* ignore audio errors */ }
    }

    function sweep(from, to, dur, vol, type) {
      const c = ensure();
      if (!c || !master) return;
      try {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(to, t + (dur || 0.2));
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.03), t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + (dur || 0.2) + 0.03);
      } catch (e) { /* ignore audio errors */ }
    }

    return {
      resume: function () { ensure(); },
      pick: function () { tone(660, 0.08, 0.018, 0, 'sine'); tone(880, 0.06, 0.01, 0.03, 'sine'); },
      place: function () { tone(320, 0.09, 0.032, 0, 'triangle'); tone(480, 0.08, 0.018, 0.025, 'sine'); },
      remove: function () { sweep(420, 220, 0.12, 0.018, 'sine'); },
      creak: function () { tone(150, 0.12, 0.012, 0, 'triangle'); },
      balance: function () {
        tone(523.25, 0.24, 0.028, 0, 'triangle');
        tone(659.25, 0.26, 0.028, 0.08, 'triangle');
        tone(783.99, 0.34, 0.03, 0.16, 'sine');
      },
      nudge: function () { tone(210, 0.1, 0.014, 0, 'sine'); tone(180, 0.1, 0.01, 0.05, 'sine'); },
      next: function () { tone(523.25, 0.18, 0.022, 0, 'sine'); tone(659.25, 0.2, 0.02, 0.07, 'sine'); },
      end: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.65, 0.03, i * 0.08, 'sine');
      },
      squeak: function () { sweep(500, 720, 0.1, 0.016, 'triangle'); tone(680, 0.08, 0.012, 0.09, 'sine'); },
    };
  })();
  // ---------------------------------------------------------------- 场景
  class BalanceScene extends Phaser.Scene {
    constructor() { super('BalanceScene'); }

    create() {
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT, ROUND_SIZE: ROUND_SIZE,
        TASK_TOTALS: TASK_TOTALS.slice(),
        TASK_PATTERNS: TASK_PATTERNS.map(function (p) { return p.slice(); }),
        ITEM_KEYS: ITEM_DEFS.map(function (d) { return d.key; }),
        ITEM_WEIGHTS: ITEM_DEFS.reduce(function (out, d) { out[d.key] = d.weight; return out; }, {}),
        MAX_PAN_ITEMS: MAX_PAN_ITEMS,
        BEAM: { pivotX: L.beam.pivotX, pivotY: L.beam.pivotY, half: L.beam.half, panDrop: L.beam.panDrop, maxTilt: L.beam.maxTilt },
        TRAY: { left: L.tray.left, top: L.tray.top, right: L.tray.right, bottom: L.tray.bottom, slots: L.tray.slots.slice() },
        BALANCE_HOLD: BALANCE_HOLD, NEXT_DELAY: NEXT_DELAY, HINT_DELAY: HINT_DELAY,
        TAP_LOCK: TAP_LOCK, DRAG_SCALE: DRAG_SCALE, DEPTH: Object.assign({}, DEPTH),
      };
      this.PALETTE = C;
      this.L = L;
      this.renderReady = false;
      this.clock = 0;
      this.phase = 'play';
      this.freePlay = false;
      this.completed = 0;
      this.taskIndex = 0;
      this.tasks = [];
      this.task = null;
      this.leftItems = [];
      this.rightItems = [];
      this.leftWeight = 0;
      this.rightWeight = 0;
      this.tilt = 0;
      this.tiltTarget = 0;
      this.balanced = false;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = 0;
      this.hintTimer = 0;
      this.hintVisible = false;
      this.hintValue = '';
      this.handHint = true;
      this.handHintT = 0;
      this.noticeTimer = 0;
      this.noticeValue = '';
      this.drag = null;
      this.pointerId = null;
      this.nextItemId = 1;
      this.fxParticles = [];
      this.liveProps = [];
      this.creakCooldown = 0;
      this.suppressBalance = false;
      this.cardShown = false;

      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawWorld(this.worldG);
      this.trayG = this.add.graphics().setDepth(DEPTH.tray);
      drawTrayBase(this.trayG);
      this.trayItemG = this.add.graphics().setDepth(DEPTH.trayItems);
      this.sceneG = this.add.graphics().setDepth(DEPTH.beam);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.hudG = this.add.graphics().setDepth(DEPTH.ui);
      this.overlayG = this.add.graphics().setDepth(DEPTH.overlay);
      this.dragG = this.add.graphics().setDepth(DEPTH.drag);

      this.buildUi();
      this.makeTasks();
      this.buildTask(0);
      this.renderReady = true;
      this.render();
      this.input.on('pointerdown', this.onPointerDown, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointerupoutside', this.onPointerUp, this);
      this.events.once('shutdown', this.onShutdown.bind(this));
      Sound.resume();
    }

    makeTasks(randomFn) {
      const rng = typeof randomFn === 'function' ? randomFn : Math.random;
      if (typeof rng !== 'function') { /* keep the public shape forgiving */ }
      this.tasks = TASK_TOTALS.map(function (total, i) {
        return {
          index: i,
          total: total,
          fixedSide: i % 2 === 0 ? 'left' : 'right',
          fixedWeights: TASK_PATTERNS[i].slice(),
        };
      });
      return this.tasks;
    }

    buildTask(index) {
      const i = clamp(Number(index) || 0, 0, ROUND_SIZE - 1);
      this.taskIndex = i;
      this.task = this.tasks[i] || null;
      this.freePlay = false;
      this.phase = 'play';
      this.balanced = false;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = 0;
      this.hintTimer = 0;
      this.hintVisible = false;
      this.hintValue = '';
      this.handHint = i === 0;
      this.handHintT = 0;
      this.noticeTimer = 0;
      this.noticeValue = '';
      this.drag = null;
      this.pointerId = null;
      this.leftItems = [];
      this.rightItems = [];
      this.tilt = 0;
      this.tiltTarget = 0;
      this.fxParticles.length = 0;
      this.clearLiveProps();
      this.cardShown = false;
      if (this.task) {
        const fixedItems = this.task.fixedWeights.map(function (weight, n) {
          return { id: 'fixed-' + i + '-' + n, key: ITEM_BY_WEIGHT[weight].key, weight: weight, fixed: true };
        });
        if (this.task.fixedSide === 'left') this.leftItems = fixedItems;
        else this.rightItems = fixedItems;
      }
      this.recalcWeights();
      this.updateHud();
      return this.task;
    }

    itemWeight(key) {
      if (key && typeof key === 'object') key = key.key;
      return ITEM_BY_KEY[key] ? ITEM_BY_KEY[key].weight : 0;
    }

    totalWeight(items) {
      let total = 0;
      const list = items || [];
      for (let i = 0; i < list.length; i++) total += this.itemWeight(list[i]);
      return total;
    }

    recalcWeights() {
      this.leftWeight = this.totalWeight(this.leftItems);
      this.rightWeight = this.totalWeight(this.rightItems);
      return this.leftWeight + this.rightWeight;
    }

    sideItems(side) {
      return side === 'left' ? this.leftItems : side === 'right' ? this.rightItems : null;
    }

    isFixedSide(side) {
      return !this.freePlay && this.phase === 'play' && this.task && side === this.task.fixedSide;
    }

    addItem(side, key) {
      if (this.busy || this.phase === 'over') return 'locked';
      const items = this.sideItems(side);
      const def = ITEM_BY_KEY[key && typeof key === 'object' ? key.key : key];
      if (!items || !def) return 'invalid';
      if (this.isFixedSide(side)) return 'locked';
      if (items.length >= MAX_PAN_ITEMS) {
        Sound.nudge();
        this.showNotice('这一边放满啦，先拿掉一颗吧', 2.2);
        return 'full';
      }
      items.push({ id: 'item-' + this.nextItemId++, key: def.key, weight: def.weight, fixed: false });
      this.recalcWeights();
      this.balanced = false;
      this.hintTimer = 0;
      this.hintVisible = false;
      this.handHint = false;
      this.handHintT = 0;
      Sound.place();
      Sound.creak();
      if (!this.suppressBalance) this.checkBalance();
      this.updateHud();
      return 'added';
    }

    removeItem(side, index) {
      if (this.busy || this.phase === 'over') return false;
      const items = this.sideItems(side);
      const i = Number(index);
      if (!items || !Number.isInteger(i) || i < 0 || i >= items.length) return false;
      if (this.isFixedSide(side) || items[i].fixed) { Sound.nudge(); return false; }
      items.splice(i, 1);
      this.recalcWeights();
      this.balanced = false;
      this.hintTimer = 0;
      this.hintVisible = false;
      Sound.remove();
      if (!this.suppressBalance) this.checkBalance();
      this.updateHud();
      return true;
    }

    checkBalance() {
      this.recalcWeights();
      const equal = this.leftWeight > 0 && this.leftWeight === this.rightWeight;
      if (!equal) {
        if (this.phase === 'free') this.balanced = false;
        return false;
      }
      if (this.balanced) return true;
      this.balanced = true;
      this.hintVisible = false;
      this.hintTimer = 0;
      const positions = this.getPanCenters();
      this.spawnStars((positions.left.x + positions.right.x) / 2, Math.min(positions.left.y, positions.right.y) - 26, 20);
      if (this.phase === 'free') { Sound.balance(); this.updateHud(); return true; }
      this.completed = Math.max(this.completed, this.taskIndex + 1);
      this.busy = true;
      this.busyTimer = 0;
      this.tapLockUntil = this.clock + BALANCE_HOLD;
      Sound.balance();
      Sound.next();
      this.updateHud();
      return true;
    }

    nextTask(index) {
      const next = index == null ? this.taskIndex + 1 : Number(index);
      if (!Number.isFinite(next) || next >= ROUND_SIZE) { this.finishRound(); return false; }
      this.buildTask(next);
      return true;
    }

    finishRound() {
      this.phase = 'over';
      this.freePlay = false;
      this.busy = false;
      this.balanced = true;
      this.completed = ROUND_SIZE;
      this.tapLockUntil = this.clock + TAP_LOCK;
      this.cardShown = true;
      this.hintVisible = false;
      this.drag = null;
      this.pointerId = null;
      this.spawnConfetti(64);
      Sound.end();
      this.updateHud();
    }

    startFreePlay() {
      this.phase = 'free';
      this.freePlay = true;
      this.busy = false;
      this.balanced = false;
      this.busyTimer = 0;
      this.completed = ROUND_SIZE;
      this.task = null;
      this.leftItems = [];
      this.rightItems = [];
      this.leftWeight = 0;
      this.rightWeight = 0;
      this.tilt = 0;
      this.tiltTarget = 0;
      this.hintTimer = 0;
      this.hintVisible = false;
      this.handHint = false;
      this.noticeTimer = 0;
      this.drag = null;
      this.pointerId = null;
      this.fxParticles.length = 0;
      this.clearLiveProps();
      this.cardShown = false;
      this.updateHud();
      return true;
    }

    tryRestart() {
      this.clock = 0;
      this.phase = 'play';
      this.freePlay = false;
      this.completed = 0;
      this.taskIndex = 0;
      this.leftItems = [];
      this.rightItems = [];
      this.leftWeight = 0;
      this.rightWeight = 0;
      this.tilt = 0;
      this.tiltTarget = 0;
      this.balanced = false;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = 0;
      this.hintTimer = 0;
      this.hintVisible = false;
      this.hintValue = '';
      this.handHint = true;
      this.handHintT = 0;
      this.noticeTimer = 0;
      this.noticeValue = '';
      this.drag = null;
      this.pointerId = null;
      this.nextItemId = 1;
      this.fxParticles.length = 0;
      this.cardShown = false;
      this.clearLiveProps();
      this.makeTasks();
      this.buildTask(0);
      Sound.resume();
      return true;
    }

    getPanCenters() {
      const beam = L.beam;
      const cos = Math.cos(this.tilt);
      const sin = Math.sin(this.tilt);
      return {
        left: { x: beam.pivotX - beam.half * cos, y: beam.pivotY - beam.half * sin + beam.panDrop },
        right: { x: beam.pivotX + beam.half * cos, y: beam.pivotY + beam.half * sin + beam.panDrop },
      };
    }

    panAt(x, y) {
      const p = this.getPanCenters();
      function inside(c) {
        const dx = x - c.x;
        const dy = y - (c.y - 6);
        return (dx * dx) / (112 * 112) + (dy * dy) / (82 * 82) <= 1;
      }
      if (inside(p.left)) return 'left';
      if (inside(p.right)) return 'right';
      return null;
    }

    trayAt(x, y) {
      const t = L.tray;
      if (!pointInRect(x, y, t.left, t.top, t.right - t.left, t.bottom - t.top)) return -1;
      for (let i = 0; i < t.slots.length; i++) {
        if (Math.abs(x - t.slots[i]) <= 58) return i;
      }
      return -1;
    }

    itemIndexAt(side, x, y) {
      const items = this.sideItems(side);
      if (!items || !items.length) return -1;
      const p = this.getPanCenters()[side];
      const layout = panItemLayout(p.x, p.y - 4, items.length);
      for (let i = items.length - 1; i >= 0; i--) {
        if (dist(x, y, layout[i].x, layout[i].y) <= 24) return i;
      }
      return -1;
    }

    onPointerDown(pointer) {
      Sound.resume();
      const x = pointer.x;
      const y = pointer.y;
      if (this.phase === 'over') {
        if (this.clock < this.tapLockUntil) return false;
        if (this.inCardFree(x, y)) return this.startFreePlay();
        if (this.inCardAgain(x, y)) return this.tryRestart();
        return false;
      }
      if (this.freePlay && this.pointInFreeButton(x, y)) return this.tryRestart();
      if (this.busy || this.drag) return false;
      if (dist(x, y, L.squirrel.x - 8, L.squirrel.y - 30) < 54) { Sound.squeak(); return false; }
      const pid = pointer.id == null ? 1 : pointer.id;
      const slot = this.trayAt(x, y);
      if (slot >= 0) { this.beginDrag(pid, x, y, { source: 'tray', key: ITEM_DEFS[slot].key }); return true; }
      const side = this.panAt(x, y);
      if (side) {
        const index = this.itemIndexAt(side, x, y);
        if (index >= 0) {
          const item = this.sideItems(side)[index];
          if (item.fixed || this.isFixedSide(side)) {
            Sound.nudge();
            this.showNotice('这一边已经固定啦，试试另一边', 2.1);
            return false;
          }
          this.beginDrag(pid, x, y, { source: 'pan', side: side, index: index, key: item.key, id: item.id });
          return true;
        }
        if (this.isFixedSide(side)) {
          Sound.nudge();
          this.showNotice('这一边已经固定啦，试试另一边', 2.1);
        }
      }
      return false;
    }

    beginDrag(pointerId, x, y, data) {
      this.pointerId = pointerId;
      this.drag = Object.assign({ pointerId: pointerId, x: x, y: y, startX: x, startY: y }, data);
      this.hintVisible = false;
      Sound.pick();
      this.render();
      return this.drag;
    }

    onPointerMove(pointer) {
      if (!this.drag) return false;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (pid !== this.pointerId) return false;
      this.drag.x = pointer.x;
      this.drag.y = pointer.y;
      return true;
    }

    onPointerUp(pointer) {
      if (!this.drag) return false;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (pid !== this.pointerId) return false;
      const drag = this.drag;
      this.drag = null;
      this.pointerId = null;
      const x = pointer.x;
      const y = pointer.y;
      const slot = this.trayAt(x, y);
      const pan = this.panAt(x, y);
      if (slot >= 0) {
        if (drag.source === 'pan') { this.removeItem(drag.side, drag.index); this.showNotice('放回材料盘啦', 1.2); }
        this.render();
        return true;
      }
      if (pan) {
        if (this.isFixedSide(pan)) {
          Sound.nudge();
          this.showNotice('这一边固定住啦，换另一边试试', 2.1);
          this.render();
          return false;
        }
        if (drag.source === 'tray') {
          const result = this.addItem(pan, drag.key);
          if (result === 'added') this.spawnStars(this.getPanCenters()[pan].x, this.getPanCenters()[pan].y - 60, 5, false);
        } else if (drag.source === 'pan') {
          if (pan === drag.side) { this.render(); return true; }
          const moving = this.sideItems(drag.side)[drag.index];
          if (moving && !this.busy) {
            this.suppressBalance = true;
            const removed = this.removeItem(drag.side, drag.index);
            let result = 'invalid';
            if (removed) result = this.addItem(pan, moving.key);
            this.suppressBalance = false;
            if (removed && result !== 'added') {
              this.sideItems(drag.side).splice(drag.index, 0, moving);
              this.recalcWeights();
            } else if (removed) {
              this.checkBalance();
              this.spawnStars(this.getPanCenters()[pan].x, this.getPanCenters()[pan].y - 60, 5, false);
            }
            this.updateHud();
          }
        }
        this.render();
        return true;
      }
      this.render();
      return false;
    }

    showNotice(text, seconds) {
      this.noticeValue = text;
      this.noticeTimer = seconds == null ? 2 : seconds;
    }

    hintDifference() { return this.leftWeight - this.rightWeight; }

    spawnStars(x, y, count, burst) {
      const n = count || 12;
      const colors = [C.gold, C.goldLight, 0xFFDCE8, 0xC7A4F0, 0xFFF8EA, 0x87D8FF];
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * TAU + Math.random() * 0.5;
        const speed = burst === false ? 32 + Math.random() * 42 : 58 + Math.random() * 92;
        this.fxParticles.push({
          x: x, y: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 36,
          gravity: 72, life: 0.7 + Math.random() * 0.7, maxLife: 1.4,
          color: colors[i % colors.length], size: 2.8 + Math.random() * 3.8,
          shape: i % 3 === 0 ? 'star' : 'circle',
        });
      }
    }

    spawnConfetti(count) {
      const colors = [C.gold, C.berry, C.mushroom, C.pineapple, C.leaf, 0x8FB8F6, 0xBFA7F0, C.cream];
      const n = count || 48;
      for (let i = 0; i < n; i++) {
        this.fxParticles.push({
          x: 35 + Math.random() * (WIDTH - 70), y: -20 - Math.random() * 220,
          vx: (Math.random() - 0.5) * 46, vy: 70 + Math.random() * 84, gravity: 28,
          life: 2.2 + Math.random() * 1.7, maxLife: 3.9, color: colors[i % colors.length],
          size: 3 + Math.random() * 4, shape: i % 4 === 0 ? 'star' : i % 3 === 0 ? 'circle' : 'rect',
          rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 5,
        });
      }
    }

    updateFx(dt) {
      for (let i = this.fxParticles.length - 1; i >= 0; i--) {
        const p = this.fxParticles[i];
        p.life -= dt;
        if (p.life <= 0) { this.fxParticles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rot != null) p.rot += p.vr * dt;
        if (p.x < -20 || p.x > WIDTH + 20 || p.y > HEIGHT + 30) this.fxParticles.splice(i, 1);
      }
    }

    step(dt) {
      const delta = Math.max(0, Math.min(0.05, Number(dt) || 0));
      this.clock += delta;
      this.creakCooldown = Math.max(0, this.creakCooldown - delta);
      if (this.noticeTimer > 0) this.noticeTimer = Math.max(0, this.noticeTimer - delta);
      if (this.handHint) {
        this.handHintT += delta;
        if (this.handHintT > 8) this.handHint = false;
      }
      if (this.phase === 'play' && !this.balanced && !this.busy) {
        this.hintTimer += delta;
        if (this.hintTimer >= HINT_DELAY) {
          this.hintVisible = true;
          const diff = Math.abs(this.hintDifference());
          this.hintValue = diff > 0 ? '还差 ' + diff + ' 点，看看箭头指的盘子' : '把两边放得一样重';
        }
      }
      this.recalcWeights();
      const target = clamp((this.rightWeight - this.leftWeight) * 0.05, -L.beam.maxTilt, L.beam.maxTilt);
      this.tiltTarget = target;
      const k = 1 - Math.exp(-delta * 6.5);
      this.tilt = lerp(this.tilt, this.tiltTarget, k);
      if (Math.abs(this.tiltTarget - this.tilt) > 0.008 && this.creakCooldown <= 0 && !this.balanced) {
        Sound.creak();
        this.creakCooldown = 0.9;
      }
      this.updateFx(delta);
      if (this.busy && this.phase === 'play') {
        this.busyTimer += delta;
        if (this.busyTimer >= NEXT_DELAY) {
          this.busy = false;
          if (this.taskIndex >= ROUND_SIZE - 1) this.finishRound();
          else this.nextTask(this.taskIndex + 1);
        }
      }
      this.updateHud();
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

    update(time, delta) {
      this.step((delta || 0) / 1000);
      this.render();
    }

    buildUi() {
      const titleStyle = { fontFamily: TITLE_FONT, fontSize: '34px', fontStyle: 'bold', color: '#4E5D3D' };
      this.titleText = this.add.text(L.title.x, L.title.y, '森林平衡木', titleStyle).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.subtitleText = this.add.text(L.subtitle.x, L.subtitle.y, '拖果实，让两边一样重', {
        fontFamily: FONT, fontSize: '18px', color: '#6C7E5B',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.progressText = this.add.text(L.progress.x, L.progress.y - 2, '0 / 8', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#6A4B24',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.taskText = this.add.text(L.taskPill.x, L.taskPill.y, '', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#5D4A2E',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.hintText = this.add.text(270, 226, '', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#6A4B24',
        wordWrap: { width: 400 }, align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH.tip + 1);
      this.noticeText = this.add.text(270, 682, '', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#6A4B24',
        wordWrap: { width: 380 }, align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH.tip + 1);
      this.handText = this.add.text(0, 0, '把果实放这边', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#5C7C54',
      }).setOrigin(0.5).setDepth(DEPTH.tip + 1);
      this.fixedTagText = this.add.text(0, 0, '固定', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#8A5A20',
      }).setOrigin(0.5).setDepth(DEPTH.tip + 1);
      this.opTagText = this.add.text(0, 0, '放这里', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#4C7A4D',
      }).setOrigin(0.5).setDepth(DEPTH.tip + 1);
      this.freeButtonText = this.add.text(L.freeRestart.x, L.freeRestart.y, '重新挑战', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#FFF8EA',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.trayNameTexts = [];
      for (let i = 0; i < ITEM_DEFS.length; i++) {
        this.trayNameTexts.push(this.add.text(L.tray.slots[i], L.tray.nameY, ITEM_DEFS[i].name, {
          fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#5A432B',
        }).setOrigin(0.5).setDepth(DEPTH.trayItems + 1));
      }
      const cardC = L.card;
      this.cardTitleText = this.add.text(cardC.x, cardC.y - 128, '森林平衡啦！', {
        fontFamily: TITLE_FONT, fontSize: '31px', fontStyle: 'bold', color: '#4E5D3D',
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardStarsText = this.add.text(cardC.x, cardC.y - 66, '', {
        fontFamily: FONT, fontSize: '34px', color: '#E7B84C',
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardSubText = this.add.text(cardC.x, cardC.y - 14, '8 个平衡任务完成', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#6A4B24',
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardNoteText = this.add.text(cardC.x, cardC.y + 26, '两边一样重，森林就笑啦', {
        fontFamily: FONT, fontSize: '15px', color: '#7A8B67',
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardFreeText = this.add.text(cardC.x - 82, cardC.y + 104, '自由玩', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardAgainText = this.add.text(cardC.x + 82, cardC.y + 104, '再玩一次', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
    }

    updateHud() {
      if (!this.progressText) return;
      const isOver = this.phase === 'over';
      this.progressText.setText(this.freePlay ? '自由' : (this.completed + ' / ' + ROUND_SIZE));
      if (this.freePlay) this.taskText.setText('自由玩 · 两边都可以放果实');
      else if (isOver) this.taskText.setText('8 个任务完成啦');
      else if (this.task) this.taskText.setText('第 ' + (this.taskIndex + 1) + ' 关 · ' + (this.task.fixedSide === 'left' ? '左边' : '右边') + '已放好');
      const showHint = !this.freePlay && !isOver && this.hintVisible && !this.balanced;
      this.hintText.setVisible(showHint);
      if (showHint) this.hintText.setText(this.hintValue || '看看哪边轻一点');
      this.noticeText.setVisible(this.noticeTimer > 0 && !isOver);
      if (this.noticeTimer > 0) this.noticeText.setText(this.noticeValue);
      this.freeButtonText.setVisible(this.freePlay);
      this.handText.setVisible(this.handHint && !this.freePlay && !isOver);
      this.fixedTagText.setVisible(!this.freePlay && !isOver && !!this.task);
      this.opTagText.setVisible(!this.freePlay && !isOver);
      const cardVisible = isOver;
      this.cardTitleText.setVisible(cardVisible);
      this.cardStarsText.setVisible(cardVisible);
      this.cardSubText.setVisible(cardVisible);
      this.cardNoteText.setVisible(cardVisible);
      this.cardFreeText.setVisible(cardVisible);
      this.cardAgainText.setVisible(cardVisible);
      if (cardVisible) this.cardStarsText.setText('★ ★ ★ ★ ★ ★ ★ ★');
    }

    render() {
      if (!this.renderReady) return;
      const g = this.sceneG;
      g.clear();
      this.drawBeamAndPans(g);
      this.drawTrayItems();
      this.drawHud();
      this.drawFx();
      this.drawDragGhost();
      this.drawOverlay();
      this.updateHud();
    }

    drawBeamAndPans(g) {
      const beam = L.beam;
      const p = this.getPanCenters();
      const cos = Math.cos(this.tilt);
      const sin = Math.sin(this.tilt);
      const nx = -sin;
      const ny = cos;
      const halfT = 11;
      const pivot = { x: beam.pivotX, y: beam.pivotY };
      const corners = [
        { x: pivot.x - beam.half * cos - nx * halfT, y: pivot.y - beam.half * sin - ny * halfT },
        { x: pivot.x + beam.half * cos - nx * halfT, y: pivot.y + beam.half * sin - ny * halfT },
        { x: pivot.x + beam.half * cos + nx * halfT, y: pivot.y + beam.half * sin + ny * halfT },
        { x: pivot.x - beam.half * cos + nx * halfT, y: pivot.y - beam.half * sin + ny * halfT },
      ];
      g.fillStyle(C.shadow, 0.18);
      g.fillEllipse(270, 646, 118, 20);
      g.fillStyle(C.woodDark, 1);
      g.fillTriangle(236, 640, 304, 640, 270, 502);
      g.fillStyle(C.wood, 1);
      g.fillTriangle(247, 632, 293, 632, 270, 520);
      g.fillStyle(C.woodLight, 0.46);
      g.fillTriangle(258, 610, 270, 530, 279, 610);
      g.fillStyle(C.woodDark, 1);
      g.fillRoundedRect(220, 636, 100, 14, 7);
      g.fillStyle(C.woodLight, 0.5);
      g.fillRoundedRect(228, 638, 84, 5, 3);
      g.fillStyle(C.shadow, 0.2);
      g.fillPoints(corners.map(function (q) { return { x: q.x + 3, y: q.y + 7 }; }), true);
      g.fillStyle(C.woodDark, 1);
      g.fillPoints(corners, true);
      g.fillStyle(C.wood, 1);
      const inner = [
        { x: corners[0].x + 2, y: corners[0].y + 2 }, { x: corners[1].x - 2, y: corners[1].y + 2 },
        { x: corners[2].x - 2, y: corners[2].y - 2 }, { x: corners[3].x + 2, y: corners[3].y - 2 },
      ];
      g.fillPoints(inner, true);
      g.lineStyle(2, C.woodDeep, 0.55);
      g.strokePoints(corners, true);
      g.lineStyle(1.2, C.woodLight, 0.36);
      g.lineBetween(pivot.x - beam.half * cos, pivot.y - beam.half * sin, pivot.x + beam.half * cos, pivot.y + beam.half * sin);
      g.fillStyle(C.gold, 1);
      g.fillCircle(pivot.x, pivot.y, 8);
      g.fillStyle(C.goldLight, 0.9);
      g.fillCircle(pivot.x - 2, pivot.y - 2, 3);
      this.drawPan(g, 'left', p.left, cos, sin);
      this.drawPan(g, 'right', p.right, cos, sin);
      drawSquirrel(g, L.squirrel.x, L.squirrel.y + Math.sin(this.clock * 1.7) * 1.4, this.clock, this.balanced && !this.busy);
      if (!this.freePlay && this.task) {
        const side = this.task.fixedSide;
        const fixed = p[side];
        const other = side === 'left' ? 'right' : 'left';
        this.fixedTagText.setPosition(fixed.x + 62, fixed.y - 27);
        this.opTagText.setPosition(p[other].x, p[other].y + 48);
        if (this.handHint) {
          this.handText.setPosition(p[other].x, p[other].y - 94);
          drawHand(g, p[other].x + Math.sin(this.clock * 2.7) * 4, p[other].y - 66 + Math.sin(this.clock * 3.7) * 5);
        }
      }
    }

    drawPan(g, side, p, cos, sin) {
      const fixed = this.isFixedSide(side);
      const items = side === 'left' ? this.leftItems : this.rightItems;
      const weight = side === 'left' ? this.leftWeight : this.rightWeight;
      const dir = side === 'left' ? -1 : 1;
      const ropeTop = {
        x: L.beam.pivotX + dir * L.beam.half * cos,
        y: L.beam.pivotY + dir * L.beam.half * sin,
      };
      g.lineStyle(3, C.rope, 0.9);
      g.lineBetween(ropeTop.x - 28, ropeTop.y + 8, p.x - 46, p.y - 7);
      g.lineBetween(ropeTop.x + 27, ropeTop.y + 8, p.x + 46, p.y - 7);
      g.lineStyle(1.2, C.woodLight, 0.45);
      g.lineBetween(ropeTop.x - 27, ropeTop.y + 10, p.x - 45, p.y - 5);
      g.fillStyle(C.shadow, 0.16);
      g.fillEllipse(p.x + 3, p.y + 21, 154, 26);
      g.fillStyle(C.panDark, 1);
      g.fillEllipse(p.x, p.y + 15, 148, 26);
      g.fillRoundedRect(p.x - 70, p.y + 3, 140, 18, 9);
      g.fillStyle(C.pan, 1);
      g.fillEllipse(p.x, p.y, 146, 32);
      g.fillStyle(C.panLight, 0.86);
      g.fillEllipse(p.x, p.y - 3, 121, 21);
      g.fillStyle(0x8A5A32, 0.2);
      g.fillEllipse(p.x, p.y + 2, 108, 16);
      g.lineStyle(2.2, C.panDark, 0.95);
      g.strokeEllipse(p.x, p.y, 146, 32);
      if (fixed) {
        g.lineStyle(3.2, C.gold, 0.92);
        g.strokeEllipse(p.x, p.y - 1, 152, 37);
        drawStar(g, p.x + 62, p.y - 27, 6, C.gold, 0.95);
      } else {
        drawDashedEllipse(g, p.x, p.y + 1, 82, 27, 0x5DA566, 0.72, this.clock, 18);
      }
      const layout = panItemLayout(p.x, p.y - 4, items.length);
      for (let i = 0; i < items.length; i++) {
        if (this.drag && this.drag.source === 'pan' && this.drag.side === side && this.drag.index === i) continue;
        const item = items[i];
        drawFruit(g, item.key, layout[i].x, layout[i].y, 0.9, 1);
        drawDotRow(g, layout[i].x, layout[i].y + 20, item.weight, C.goldLight, 0.92, 1.45, 4.1);
      }
      drawTotalTag(g, weight, p.x, p.y - 112, fixed, 1);
    }

    drawTrayItems() {
      const g = this.trayItemG;
      g.clear();
      for (let i = 0; i < ITEM_DEFS.length; i++) {
        const x = L.tray.slots[i];
        drawFruit(g, ITEM_DEFS[i].key, x, L.tray.itemY, 1.18, 1);
        drawWeightTag(g, ITEM_DEFS[i].weight, x, L.tray.tagY, 1, 1);
        if (this.trayNameTexts[i]) this.trayNameTexts[i].setPosition(x, L.tray.nameY);
      }
    }

    drawHud() {
      const g = this.hudG;
      g.clear();
      const pr = L.progress;
      g.fillStyle(0x4B2F1D, 0.16);
      g.fillRoundedRect(pr.x - pr.w / 2 + 2, pr.y - pr.h / 2 + 4, pr.w, pr.h, 17);
      drawRounded(g, pr.x - pr.w / 2, pr.y - pr.h / 2, pr.w, pr.h, 17, C.cream, C.wood, 0.97, 0.9, 2.3);
      g.fillStyle(this.freePlay ? 0x5DA566 : C.gold, 1);
      g.fillCircle(pr.x - 29, pr.y - 2, 6);
      g.fillStyle(C.goldLight, 0.9);
      g.fillCircle(pr.x - 31, pr.y - 4, 2);
      const tp = L.taskPill;
      drawPill(g, tp.x, tp.y, tp.w, tp.h, 0xFFF8EA, 0xC8A775, 0.97, 0.8, 1.6);
      const fr = L.freeRestart;
      if (this.freePlay) drawRounded(g, fr.x - fr.w / 2, fr.y - fr.h / 2, fr.w, fr.h, 14, C.greenButton, C.greenDark, 1, 1, 2);
      if (this.noticeTimer > 0 && this.phase !== 'over') {
        drawPill(g, 270, 682, Math.min(430, 148 + this.noticeValue.length * 8), 38, C.cream, C.wood, 0.97, 0.7, 1.7);
      }
      const hint = this.hintVisible && !this.freePlay && this.phase === 'play' && !this.balanced;
      if (hint) {
        drawPill(g, 270, 226, 340, 42, 0xFFF8EA, 0xE1B65A, 0.98, 0.95, 2);
        const diff = this.hintDifference();
        const targetSide = diff > 0 ? 'right' : 'left';
        const p = this.getPanCenters()[targetSide];
        const dir = targetSide === 'left' ? -1 : 1;
        g.fillStyle(0x5DA566, 0.95);
        g.fillTriangle(p.x + dir * 95, p.y - 66, p.x + dir * 107, p.y - 47, p.x + dir * 81, p.y - 47);
        drawDotRow(g, p.x, p.y - 84, Math.min(6, Math.abs(diff)), C.gold, 0.95, 2.4, 8);
      }
      if (this.handHint && !this.freePlay && this.phase === 'play' && this.task) {
        const side = this.task.fixedSide === 'left' ? 'right' : 'left';
        const p = this.getPanCenters()[side];
        drawPill(g, p.x, p.y + 48, 84, 25, 0xFFF8EA, 0x9CBF87, 0.94, 0.75, 1.4);
      }
    }

    drawFx() {
      const g = this.fxG;
      g.clear();
      for (let i = 0; i < this.fxParticles.length; i++) {
        const p = this.fxParticles[i];
        const a = clamp(p.life / Math.max(0.001, p.maxLife), 0, 1);
        if (p.shape === 'star') drawStar(g, p.x, p.y, p.size, p.color, a);
        else if (p.shape === 'circle') { g.fillStyle(p.color, a); g.fillCircle(p.x, p.y, p.size * 0.75); }
        else {
          const rot = p.rot || 0;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const w = p.size;
          const h = p.size * 1.8;
          const pts = [
            { x: p.x + (-w * c - -h * s), y: p.y + (-w * s + -h * c) },
            { x: p.x + (w * c - -h * s), y: p.y + (w * s + -h * c) },
            { x: p.x + (w * c - h * s), y: p.y + (w * s + h * c) },
            { x: p.x + (-w * c - h * s), y: p.y + (-w * s + h * c) },
          ];
          g.fillStyle(p.color, a);
          g.fillPoints(pts, true);
        }
      }
    }

    drawDragGhost() {
      const g = this.dragG;
      g.clear();
      if (!this.drag) return;
      const x = this.drag.x;
      const y = this.drag.y - 34;
      g.fillStyle(C.shadow, 0.18);
      g.fillEllipse(x, y + 22, 54, 14);
      drawFruit(g, this.drag.key, x, y, DRAG_SCALE, 1);
      drawWeightTag(g, this.itemWeight(this.drag.key), x, y + 35, 0.92, 1);
    }

    drawOverlay() {
      const g = this.overlayG;
      g.clear();
      if (this.phase !== 'over') return;
      g.fillStyle(0x24351F, 0.42);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      const c = L.card;
      g.fillStyle(0x5A3B21, 0.2);
      g.fillRoundedRect(c.x - c.w / 2 + 3, c.y - c.h / 2 + 7, c.w, c.h, 26);
      drawRounded(g, c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 26, C.cream, 0xE3C58B, 1, 1, 3);
      g.fillStyle(0xFFF0C7, 0.42);
      g.fillRoundedRect(c.x - c.w / 2 + 14, c.y - c.h / 2 + 14, c.w - 28, 12, 6);
      const y = c.y + 104;
      drawRounded(g, c.x - 156, y - 25, 148, 50, 18, C.greenButton, C.greenDark, 1, 1, 2);
      drawRounded(g, c.x + 8, y - 25, 148, 50, 18, C.coral, 0xB65567, 1, 1, 2);
    }

    inCardFree(x, y) {
      const c = L.card;
      return pointInRect(x, y, c.x - 156, c.y + 79, 148, 50);
    }

    inCardAgain(x, y) {
      const c = L.card;
      return pointInRect(x, y, c.x + 8, c.y + 79, 148, 50);
    }

    pointInFreeButton(x, y) {
      const r = L.freeRestart;
      return pointInRect(x, y, r.x - r.w / 2, r.y - r.h / 2, r.w, r.h);
    }

    trackObj(obj) { if (obj) this.liveProps.push(obj); return obj; }
    untrackObj(obj) {
      const i = this.liveProps.indexOf(obj);
      if (i >= 0) this.liveProps.splice(i, 1);
      if (obj && typeof obj.destroy === 'function') obj.destroy();
    }
    clearLiveProps() {
      while (this.liveProps.length) {
        const obj = this.liveProps.pop();
        if (obj && typeof obj.destroy === 'function') obj.destroy();
      }
    }

    onShutdown() {
      this.clearLiveProps();
      this.fxParticles.length = 0;
      if (this.input && this.input.off) {
        this.input.off('pointerdown', this.onPointerDown, this);
        this.input.off('pointermove', this.onPointerMove, this);
        this.input.off('pointerup', this.onPointerUp, this);
        this.input.off('pointerupoutside', this.onPointerUp, this);
      }
    }
  }

  function drawHand(g, x, y) {
    g.fillStyle(0xFFF1D4, 1);
    g.fillEllipse(x, y + 5, 23, 18);
    g.fillStyle(0xF7D8A9, 1);
    for (let i = 0; i < 4; i++) g.fillRoundedRect(x - 12 + i * 7, y - 15 - (i === 0 ? 3 : 0), 6, 21, 3);
    g.fillRoundedRect(x - 16, y - 3, 10, 13, 5);
    g.lineStyle(1.2, 0xC58D54, 0.65);
    g.strokeEllipse(x, y + 5, 23, 18);
  }

  window.BalanceScene = BalanceScene;
})();
