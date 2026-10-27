/*
 * 颜色魔法屋：竖屏（540x960）的真实颜料调色小玩具。
 * 红、黄、蓝三瓶魔法颜料负责调出颜色，白瓶负责调浅、黑瓶负责压深；
 * 每次倒下一滴，锅里的颜色缓慢变化。还可以接一个不扣分、不计时、随时退出的精灵颜色任务。
 * 画面全部 Phaser.Graphics / Text 程序化绘制，音效 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;

  const PRIMARY_KEYS = ['red', 'yellow', 'blue'];
  const ADJUST_KEYS = ['white', 'black'];
  const PIGMENT_KEYS = PRIMARY_KEYS.concat(ADJUST_KEYS);
  const BOTTLE_SCALE = 0.82;
  const BOTTLE_LABEL_Y = 910;
  const PURE_COLORS = {
    red: 0xE84F61,
    yellow: 0xF4C63D,
    blue: 0x5278DF,
    white: 0xFFF4DC,
    black: 0x353B55,
  };
  // 红黄蓝是颜料三原色。二色先在三角形的边上混出橙 / 绿 / 紫，
  // 三色再向中心的棕褐色收拢，保证任意比例都能得到直觉上的颜料色。
  const MIX_ANCHORS = {
    red: 0xE84F61,
    yellow: 0xF4C63D,
    blue: 0x5278DF,
    orange: 0xF39B43,
    green: 0x61BE72,
    purple: 0x9258B6,
    brown: 0x846346,
  };
  const BASE_NAMES = {
    red: '红色', yellow: '黄色', blue: '蓝色', orange: '橙色',
    green: '绿色', purple: '紫色', brown: '棕色',
  };
  const TINT_NAMES = {
    red: '樱花粉', yellow: '奶油黄', blue: '天蓝色', orange: '杏橙色',
    green: '薄荷绿', purple: '丁香紫', brown: '奶茶色',
  };
  const SHADE_NAMES = {
    red: '酒红色', yellow: '橄榄黄', blue: '深海蓝', orange: '焦糖橙',
    green: '墨绿色', purple: '墨紫色', brown: '深咖色',
  };
  const EMPTY_COLOR = 0x3C3B55;
  const MIX_SEC = 0.6;
  const POUR_FALL_SEC = 0.42;
  const TASK_TOLERANCE = 52;
  const TASK_CHECK_SEC = 0.55;
  const TASK_TARGETS = [
    { key: 'orange', name: '橙色', recipe: { red: 1, yellow: 1 }, hints: ['red', 'yellow'] },
    { key: 'green', name: '绿色', recipe: { yellow: 1, blue: 1 }, hints: ['yellow', 'blue'] },
    { key: 'purple', name: '紫色', recipe: { red: 1, blue: 1 }, hints: ['red', 'blue'] },
    { key: 'brown', name: '棕色', recipe: { red: 1, yellow: 1, blue: 1 }, hints: ['red', 'yellow', 'blue'] },
    { key: 'pink', name: '粉色', recipe: { red: 1, white: 1 }, hints: ['red', 'white'] },
    { key: 'skyblue', name: '天蓝色', recipe: { blue: 1, white: 1 }, hints: ['blue', 'white'] },
    { key: 'mint', name: '薄荷绿', recipe: { yellow: 1, blue: 1, white: 1 }, hints: ['yellow', 'blue', 'white'] },
    { key: 'lilac', name: '丁香紫', recipe: { red: 1, blue: 1, white: 1 }, hints: ['red', 'blue', 'white'] },
    { key: 'navy', name: '深海蓝', recipe: { blue: 2, black: 1 }, hints: ['blue', 'black'] },
    { key: 'caramel', name: '焦糖橙', recipe: { red: 1, yellow: 1, black: 1 }, hints: ['red', 'yellow', 'black'] },
  ];
  const TASK_BUTTON = { x: 338, y: 68, w: 92, h: 42 };
  const TASK_PANEL = { x: 24, y: 118, w: 492, h: 112 };
  const TASK_SWATCH = { x: 402, y: 159, w: 74, h: 62 };
  const TASK_EXIT = { x: 482, y: 132, w: 52, h: 28 };
  const TASK_NEXT = { x: 402, y: 209, w: 92, h: 28 };

  const BOTTLES = [
    { key: 'red', name: '红', x: 68, y: 806, rx: 44, ry: 76 },
    { key: 'yellow', name: '黄', x: 170, y: 806, rx: 44, ry: 76 },
    { key: 'blue', name: '蓝', x: 270, y: 806, rx: 44, ry: 76 },
    { key: 'white', name: '白', x: 370, y: 806, rx: 44, ry: 76 },
    { key: 'black', name: '黑', x: 472, y: 806, rx: 44, ry: 76 },
  ];
  const POT = { x: 270, y: 404, rx: 168, ry: 58, hitRx: 196, hitRy: 112, bodyBottom: 606 };
  const SHELF = { x: 12, y: 690, w: 516, h: 258 };

  const DEPTH = {
    room: 0, window: 1, shelf: 2, pot: 4, liquid: 5,
    bottles: 8, ghost: 14, drop: 15, fx: 16, ui: 20, banner: 24,
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
      taskButton: Object.assign({}, TASK_BUTTON),
      taskPanel: Object.assign({}, TASK_PANEL),
      taskSwatch: Object.assign({}, TASK_SWATCH),
      taskExit: Object.assign({}, TASK_EXIT),
      taskNext: Object.assign({}, TASK_NEXT),
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
  function rgbToHsl(hex) {
    const rgb = hexToRgb(hex);
    const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l: l };
    const d = max - min;
    const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s: sat, l: l };
  }
  function hslToHex(h, sat, light) {
    h = ((h % 360) + 360) % 360 / 360;
    sat = clamp(Number(sat) || 0, 0, 1);
    light = clamp(Number(light) || 0, 0, 1);
    if (sat === 0) {
      const v = Math.round(light * 255);
      return (v << 16) | (v << 8) | v;
    }
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    function channel(t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return rgbToHex(channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255);
  }
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
  function partAmount(parts, key) {
    const n = Number(parts && parts[key]);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function makeEmptyParts() {
    const out = {};
    for (let i = 0; i < PIGMENT_KEYS.length; i++) out[PIGMENT_KEYS[i]] = 0;
    return out;
  }

  function totalParts(parts) {
    let total = 0;
    for (let i = 0; i < PIGMENT_KEYS.length; i++) total += partAmount(parts, PIGMENT_KEYS[i]);
    return total;
  }

  function activeParts(parts) {
    let total = 0;
    for (let i = 0; i < PIGMENT_KEYS.length; i++) {
      if (partAmount(parts, PIGMENT_KEYS[i]) > 0) total += 1;
    }
    return total;
  }

  function recipeAdded(parts, recipe) {
    if (!recipe) return false;
    const keys = Object.keys(recipe);
    if (!keys.length) return false;
    for (let i = 0; i < keys.length; i++) {
      if (partAmount(parts, keys[i]) <= 0) return false;
    }
    return true;
  }

  function colorDistance(a, b) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return Math.sqrt((ar - br) * (ar - br) + (ag - bg) * (ag - bg) + (ab - bb) * (ab - bb));
  }

  function pairMix(aKey, bKey, anchorKey, aWeight, bWeight) {
    const balanceA = aWeight / (aWeight + bWeight);
    if (balanceA <= 0.5) {
      return blend(PURE_COLORS[bKey], MIX_ANCHORS[anchorKey], balanceA * 2);
    }
    return blend(MIX_ANCHORS[anchorKey], PURE_COLORS[aKey], (balanceA - 0.5) * 2);
  }

  function baseCategory(parts) {
    const red = partAmount(parts, 'red') > 0;
    const yellow = partAmount(parts, 'yellow') > 0;
    const blue = partAmount(parts, 'blue') > 0;
    const count = (red ? 1 : 0) + (yellow ? 1 : 0) + (blue ? 1 : 0);
    if (!count) return null;
    if (count === 1) return red ? 'red' : yellow ? 'yellow' : 'blue';
    if (count === 3) return 'brown';
    if (red && yellow) return 'orange';
    if (yellow && blue) return 'green';
    return 'purple';
  }

  // 红黄蓝决定色相；白色按比例提亮并稍微降低饱和度，黑色按比例压深。
  // 两种调节都有上限，所以怎么倒都不会变成纯白或纯黑，颜色始终看得见。
  function mixBaseTarget(parts) {
    const active = [];
    for (let i = 0; i < PRIMARY_KEYS.length; i++) {
      const key = PRIMARY_KEYS[i];
      const value = partAmount(parts, key);
      if (value > 0) active.push({ key: key, value: value });
    }
    if (!active.length) return null;
    if (active.length === 1) return PURE_COLORS[active[0].key];

    const total = active.reduce(function (sum, item) { return sum + item.value; }, 0);
    if (active.length === 2) {
      const a = active[0], b = active[1];
      if (a.key === 'red' && b.key === 'yellow') return pairMix('red', 'yellow', 'orange', a.value, b.value);
      if (a.key === 'yellow' && b.key === 'blue') return pairMix('yellow', 'blue', 'green', a.value, b.value);
      return pairMix('red', 'blue', 'purple', a.value, b.value);
    }

    let minWeight = 1;
    const weights = active.map(function (item) { return item.value / total; });
    for (let i = 0; i < weights.length; i++) minWeight = Math.min(minWeight, weights[i]);
    if (minWeight >= 0.3332) return MIX_ANCHORS.brown;

    const remaining = weights.map(function (w) { return Math.max(0, w - minWeight); });
    const remainingSum = remaining.reduce(function (sum, w) { return sum + w; }, 0);
    let edge;
    if (remainingSum <= 0.000001) {
      edge = MIX_ANCHORS.brown;
    } else {
      const pair = [];
      for (let i = 0; i < active.length; i++) {
        if (remaining[i] > 0.000001) pair.push({ key: active[i].key, value: remaining[i] });
      }
      if (pair.length === 1) {
        edge = PURE_COLORS[pair[0].key];
      } else if (pair[0].key === 'red' && pair[1].key === 'yellow') {
        edge = pairMix('red', 'yellow', 'orange', pair[0].value, pair[1].value);
      } else if (pair[0].key === 'yellow' && pair[1].key === 'blue') {
        edge = pairMix('yellow', 'blue', 'green', pair[0].value, pair[1].value);
      } else {
        edge = pairMix('red', 'blue', 'purple', pair[0].value, pair[1].value);
      }
    }
    const edgeAmount = clamp(1 - minWeight * 3, 0, 1);
    return blend(MIX_ANCHORS.brown, edge, edgeAmount);
  }

  function mixTarget(parts) {
    const base = mixBaseTarget(parts);
    const white = partAmount(parts, 'white');
    const black = partAmount(parts, 'black');
    if (!base) {
      if (white <= 0 && black <= 0) return EMPTY_COLOR;
      if (white > 0 && black <= 0) return 0xFFF6E6;
      if (black > 0 && white <= 0) return 0x24283B;
      return blend(0x24283B, 0xFFF6E6, white / (white + black));
    }
    if (white <= 0 && black <= 0) return base;

    const baseTotal = partAmount(parts, 'red') + partAmount(parts, 'yellow') + partAmount(parts, 'blue');
    const total = baseTotal + white + black;
    const whiteShare = white / total;
    const blackShare = black / total;
    const hsl = rgbToHsl(base);
    const lightEffect = 0.68 * Math.sqrt(whiteShare);
    const darkEffect = 0.48 * Math.sqrt(blackShare);
    let lightness = hsl.l + (0.94 - hsl.l) * lightEffect - (hsl.l - 0.12) * darkEffect;
    let saturation = hsl.s * (1 - 0.50 * whiteShare - 0.22 * blackShare);
    lightness = clamp(lightness, 0.16, 0.93);
    saturation = clamp(saturation, 0.04, 0.92);
    return hslToHex(hsl.h, saturation, lightness);
  }

  function colorName(hex, parts) {
    const white = partAmount(parts, 'white');
    const black = partAmount(parts, 'black');
    const baseKey = baseCategory(parts);
    if (!baseKey) {
      if (white <= 0 && black <= 0) return '空空的魔法锅';
      if (white > 0 && black <= 0) return '奶油白';
      if (black > 0 && white <= 0) return '墨水黑';
      return '雾灰色';
    }
    if (white <= 0 && black <= 0) return BASE_NAMES[baseKey];

    const hsl = rgbToHsl(hex);
    if (white > 0 && black > 0) {
      if (hsl.s < 0.22) return '雾灰色';
      if (baseKey === 'brown') return hsl.l > 0.58 ? '奶茶灰' : '咖啡灰';
      return '灰调' + BASE_NAMES[baseKey];
    }
    if (white > 0) {
      if (baseKey === 'brown') return TINT_NAMES.brown;
      return hsl.l >= 0.63 ? TINT_NAMES[baseKey] : BASE_NAMES[baseKey];
    }
    if (black > 0) return hsl.l <= 0.52 ? SHADE_NAMES[baseKey] : BASE_NAMES[baseKey];
    return BASE_NAMES[baseKey];
  }

  function drawDroplet(g, x, y, r, color, alpha) {
    const a = alpha == null ? 1 : alpha;
    g.fillStyle(darken(color, 0.22), 0.28 * a).fillEllipse(x + 1, y + r * 0.55, r * 1.65, r * 1.05);
    g.fillStyle(color, a).fillTriangle(x - r * 0.72, y - r * 0.12, x + r * 0.72, y - r * 0.12, x, y - r * 2.05);
    g.fillStyle(color, a).fillCircle(x, y, r);
    g.fillStyle(lighten(color, 0.55), 0.58 * a).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.28);
    g.fillStyle(0xFFFFFF, 0.52 * a).fillCircle(x - r * 0.12, y - r * 1.35, r * 0.17);
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
    } else if (key === 'yellow') {
      g.fillStyle(0xBCB5F0, 0.18).fillRoundedRect(-36, -38, 72, 103, 20);
      g.fillStyle(0xEDE9FF, 0.27).fillRoundedRect(-13, -71, 26, 43, 8);
      g.fillStyle(color, 1).fillRoundedRect(-28, -23, 56, 80, 15);
      g.fillStyle(darken(color, 0.2), 1).fillEllipse(0, 52, 46, 12);
      g.fillStyle(lighten(color, 0.24), 0.62).fillRoundedRect(-18, -12, 9, 50, 4);
      g.lineStyle(3, 0xF4EFFF, 0.62).strokeRoundedRect(-36, -38, 72, 103, 20);
    } else if (key === 'blue') {
      g.fillStyle(0xBCB5F0, 0.18);
      fillPoly(g, [[-45, 64], [45, 64], [0, -43]]);
      g.fillStyle(0xEDE9FF, 0.27).fillRoundedRect(-13, -72, 26, 42, 8);
      g.fillStyle(color, 1);
      fillPoly(g, [[-32, 50], [32, 50], [0, -29]]);
      g.fillStyle(darken(color, 0.18), 1).fillEllipse(0, 52, 50, 12);
      g.fillStyle(lighten(color, 0.22), 0.64).fillEllipse(-8, 18, 12, 28);
      g.lineStyle(3, 0xF4EFFF, 0.62);
      strokePoly(g, [[-45, 64], [45, 64], [0, -43]], true);
    } else if (key === 'white') {
      g.fillStyle(0xD8E7FF, 0.24).fillRoundedRect(-31, -40, 62, 106, 18);
      g.fillStyle(0xEDE9FF, 0.34).fillRoundedRect(-13, -73, 26, 43, 8);
      g.fillStyle(color, 1).fillRoundedRect(-25, -24, 50, 83, 14);
      g.fillStyle(0xE9DCC8, 1).fillEllipse(0, 54, 44, 12);
      g.fillStyle(0xFFFFFF, 0.9).fillRoundedRect(-17, -14, 9, 57, 4);
      g.fillStyle(0xBFD8F5, 0.72).fillCircle(12, -1, 3.2);
      g.fillStyle(0xBFD8F5, 0.5).fillCircle(9, 16, 2.1);
      g.lineStyle(3, 0xD9CCFF, 0.78).strokeRoundedRect(-31, -40, 62, 106, 18);
    } else {
      g.fillStyle(0xB8A7E2, 0.18).fillCircle(0, 14, 45);
      g.fillStyle(0xD9D0FF, 0.24).fillRoundedRect(-13, -72, 26, 43, 8);
      g.fillStyle(color, 1).fillCircle(0, 17, 34);
      g.fillStyle(0x242A40, 1).fillEllipse(0, 37, 56, 18);
      g.fillStyle(0x818DB6, 0.72).fillEllipse(-11, 1, 20, 13);
      g.fillStyle(C.gold, 0.82).fillCircle(12, 8, 2.7);
      g.lineStyle(3, 0xE3D8FF, 0.7).strokeCircle(0, 14, 45);
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

  function drawTaskElf(g, x, y, scale) {
    const s = scale || 1;
    g.save();
    g.translateCanvas(x, y);
    g.scaleCanvas(s, s);

    g.fillStyle(0xFFE59A, 0.11).fillCircle(0, -12, 49);
    g.fillStyle(0x9FE8D1, 0.27).fillEllipse(-28, 2, 28, 45);
    g.fillStyle(0x9FE8D1, 0.27).fillEllipse(28, 2, 28, 45);
    g.lineStyle(2, 0xBFF7E3, 0.4);
    g.strokeEllipse(-28, 2, 28, 45);
    g.strokeEllipse(28, 2, 28, 45);

    g.fillStyle(0x2F5F50, 1).fillEllipse(-10, 36, 17, 8);
    g.fillStyle(0x2F5F50, 1).fillEllipse(10, 36, 17, 8);
    g.fillStyle(0x3C7D67, 1).fillRoundedRect(-18, -12, 36, 46, 16);
    g.fillStyle(0x72C9A8, 1).fillEllipse(0, 7, 28, 28);
    g.fillStyle(0xFFD9A9, 1).fillCircle(-19, 2, 7);
    g.fillStyle(0xFFD9A9, 1).fillCircle(19, 2, 7);

    g.fillStyle(0xFFD9A9, 1).fillTriangle(-21, -36, -35, -47, -19, -51);
    g.fillStyle(0xFFD9A9, 1).fillTriangle(21, -36, 35, -47, 19, -51);
    g.fillStyle(0xFFD9A9, 1).fillCircle(0, -33, 23);
    g.fillStyle(0xF3B97E, 0.65).fillEllipse(0, -20, 20, 10);

    g.fillStyle(0x68B895, 1).fillTriangle(-24, -48, 24, -48, 0, -77);
    g.fillStyle(0x8ED9B5, 1).fillRoundedRect(-27, -51, 54, 9, 4);
    g.fillStyle(C.gold, 1).fillCircle(0, -75, 4);

    g.fillStyle(0x39263F, 1).fillCircle(-8, -34, 2.7);
    g.fillStyle(0x39263F, 1).fillCircle(8, -34, 2.7);
    g.fillStyle(0xFFFFFF, 0.8).fillCircle(-7, -35, 0.9);
    g.fillStyle(0xFFFFFF, 0.8).fillCircle(9, -35, 0.9);
    g.fillStyle(0xF39BA9, 0.42).fillCircle(-14, -26, 3.5);
    g.fillStyle(0xF39BA9, 0.42).fillCircle(14, -26, 3.5);
    g.lineStyle(2, 0x7A4D43, 0.9);
    g.beginPath();
    g.arc(0, -24, 6, Math.PI * 0.18, Math.PI * 0.82, false);
    g.strokePath();

    g.lineStyle(3, 0xCFA23B, 1).lineBetween(23, -5, 38, -28);
    drawStar(g, 40, -31, 7, C.gold, 1, 5);
    g.fillStyle(0xFFFFFF, 0.75).fillCircle(-11, -47, 2.2);
    g.fillStyle(0xFFE59A, 0.65).fillCircle(29, -58, 2.4);
    g.restore();
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
        const base = key === 'red' ? 392 : key === 'yellow' ? 494 : key === 'blue' ? 587 : key === 'white' ? 659 : 294;
        tone(base, 0.16, 0.035, 0, 'sine');
        tone(base * 1.26, 0.22, 0.024, 0.06, 'triangle');
      },
      mix: function () {
        tone(523.25, 0.32, 0.022, 0, 'sine');
        tone(659.25, 0.35, 0.019, 0.04, 'sine');
        tone(783.99, 0.38, 0.016, 0.08, 'sine');
      },
      drip: function () { tone(880, 0.045, 0.016, 0, 'sine'); tone(620, 0.09, 0.012, 0.045, 'triangle'); },
      taskStart: function () { tone(659.25, 0.14, 0.024, 0, 'triangle'); tone(880, 0.2, 0.018, 0.08, 'sine'); },
      taskWin: function () {
        tone(523.25, 0.28, 0.024, 0, 'sine');
        tone(659.25, 0.3, 0.021, 0.06, 'sine');
        tone(783.99, 0.34, 0.018, 0.12, 'sine');
        tone(1046.5, 0.38, 0.014, 0.18, 'triangle');
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
        ADJUST_KEYS: ADJUST_KEYS.slice(),
        PIGMENT_KEYS: PIGMENT_KEYS.slice(),
        MIX_ANCHORS: Object.assign({}, MIX_ANCHORS),
        PURE_COLORS: Object.assign({}, PURE_COLORS),
        BASE_NAMES: Object.assign({}, BASE_NAMES),
        TINT_NAMES: Object.assign({}, TINT_NAMES),
        SHADE_NAMES: Object.assign({}, SHADE_NAMES),
        POT: Object.assign({}, POT),
        BOTTLES: BOTTLES.map(function (b) { return Object.assign({}, b); }),
        BOTTLE_SCALE: BOTTLE_SCALE,
        BOTTLE_LABEL_Y: BOTTLE_LABEL_Y,
        RESET: Object.assign({}, this.L.reset),
        EMPTY_COLOR: EMPTY_COLOR,
        MIX_SEC: MIX_SEC,
        POUR_FALL_SEC: POUR_FALL_SEC,
        TASK_TARGETS: TASK_TARGETS.map(function (t) {
          return Object.assign({}, t, { recipe: Object.assign({}, t.recipe), hints: t.hints.slice() });
        }),
        TASK_TOLERANCE: TASK_TOLERANCE,
        TASK_CHECK_SEC: TASK_CHECK_SEC,
        DEPTH: Object.assign({}, DEPTH),
      };
      this.parts = makeEmptyParts();
      this.potColor = EMPTY_COLOR;
      this.targetColor = EMPTY_COLOR;
      this.potRgb = hexToRgb(EMPTY_COLOR);
      this.drag = null;
      this.flyBack = null;
      this.pendingPour = null;
      this.activePointerId = null;
      this.liveProps = [];
      this.clock = 0;
      this.potDirty = true;
      this.bottleConts = [];
      this.lastHover = false;
      this.task = null;
      this.taskCheckIn = 0;

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
      this.dropG = this.add.graphics().setDepth(DEPTH.drop);

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
      this.subText = this.add.text(L.subtitle.x, L.subtitle.y, '红黄蓝调色 · 白调浅 · 黑调深', {
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
      this.hintText = this.add.text(L.hint.x, L.hint.y, '白色调浅一点，黑色调深一点 · 一次倒一滴', {
        fontFamily: FONT, fontSize: '13px', color: '#AE9ED6',
      }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.buildTaskUi();
    }

    buildTaskUi() {
      const L = this.L;
      this.taskButtonG = this.add.graphics().setDepth(DEPTH.ui);
      this.drawTaskButton();
      this.taskButtonText = this.add.text(L.taskButton.x + 6, L.taskButton.y + 1, '小任务', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#3A2142',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.taskPanelG = this.add.graphics().setDepth(DEPTH.ui + 2).setVisible(false);
      this.taskElfG = this.add.graphics().setDepth(DEPTH.ui + 3).setVisible(false);
      drawTaskElf(this.taskElfG, 68, 180, 0.75);
      this.taskTitleText = this.add.text(112, 141, '', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFF3D2',
        stroke: '#24133F', strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(DEPTH.ui + 4).setVisible(false);
      this.taskSubText = this.add.text(112, 168, '', {
        fontFamily: FONT, fontSize: '13px', color: '#CBBFF0',
      }).setOrigin(0, 0.5).setDepth(DEPTH.ui + 4).setVisible(false);
      this.taskHintText = this.add.text(112, 200, '', {
        fontFamily: FONT, fontSize: '12px', color: '#F3D98C',
      }).setOrigin(0, 0.5).setDepth(DEPTH.ui + 4).setVisible(false);
      this.taskExitText = this.add.text(L.taskExit.x, L.taskExit.y, '退出', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#EADFFF',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 4).setVisible(false);
      this.taskNextText = this.add.text(L.taskNext.x, L.taskNext.y + 1, '再来一个', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#3A2142',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 4).setVisible(false);
      this.updateTaskUi();
    }

    drawTaskButton() {
      const b = this.L.taskButton;
      const g = this.taskButtonG;
      g.clear();
      g.fillStyle(0x09041A, 0.42).fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2 + 4, b.w, b.h, b.h / 2);
      g.fillStyle(C.gold, 1).fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h / 2);
      g.fillStyle(0xFFF0A6, 0.56).fillRoundedRect(b.x - b.w / 2 + 6, b.y - b.h / 2 + 5, b.w - 12, 13, 7);
      g.lineStyle(2, 0xFFF3BE, 0.55).strokeRoundedRect(b.x - b.w / 2 + 1, b.y - b.h / 2 + 1, b.w - 2, b.h - 2, b.h / 2 - 1);
      drawStar(g, b.x - b.w / 2 + 16, b.y, 7, 0x6E431F, 0.9, 5);
    }

    drawTaskPanel() {
      const g = this.taskPanelG;
      const L = this.L;
      const task = this.task;
      g.clear();
      if (!task) {
        g.setVisible(false);
        return;
      }
      g.setVisible(true);
      const p = L.taskPanel;
      const sw = L.taskSwatch;
      const ex = L.taskExit;
      const nx = L.taskNext;

      g.fillStyle(0x07030F, 0.52).fillRoundedRect(p.x + 1, p.y + 6, p.w, p.h, 24);
      g.fillStyle(0x211641, 0.94).fillRoundedRect(p.x, p.y, p.w, p.h, 24);
      g.lineStyle(2, 0xC49A47, 0.72).strokeRoundedRect(p.x, p.y, p.w, p.h, 24);
      g.lineStyle(1, 0xFFF1C6, 0.18).strokeRoundedRect(p.x + 5, p.y + 5, p.w - 10, p.h - 10, 19);

      g.fillStyle(0x07030F, 0.36).fillRoundedRect(sw.x - sw.w / 2 + 2, sw.y - sw.h / 2 + 5, sw.w, sw.h, 13);
      g.fillStyle(0xFFF9EC, 1).fillRoundedRect(sw.x - sw.w / 2, sw.y - sw.h / 2, sw.w, sw.h, 13);
      g.fillStyle(task.color, 1).fillRoundedRect(sw.x - sw.w / 2 + 6, sw.y - sw.h / 2 + 6, sw.w - 12, sw.h - 12, 9);
      g.fillStyle(0xFFFFFF, 0.3).fillRoundedRect(sw.x - sw.w / 2 + 11, sw.y - sw.h / 2 + 9, sw.w - 22, 9, 5);
      g.lineStyle(2, 0xD8B562, 0.7).strokeRoundedRect(sw.x - sw.w / 2 + 1, sw.y - sw.h / 2 + 1, sw.w - 2, sw.h - 2, 12);

      g.fillStyle(0x0B0620, 0.68).fillRoundedRect(ex.x - ex.w / 2, ex.y - ex.h / 2, ex.w, ex.h, 14);
      g.lineStyle(1.5, 0xBFA7E6, 0.42).strokeRoundedRect(ex.x - ex.w / 2, ex.y - ex.h / 2, ex.w, ex.h, 14);

      if (task.success) {
        g.fillStyle(C.gold, 1).fillRoundedRect(nx.x - nx.w / 2, nx.y - nx.h / 2, nx.w, nx.h, 14);
        g.fillStyle(0xFFF0A6, 0.58).fillRoundedRect(nx.x - nx.w / 2 + 5, nx.y - nx.h / 2 + 4, nx.w - 10, 8, 4);
        g.fillStyle(0x55BE83, 1).fillCircle(sw.x + sw.w / 2 - 2, sw.y - sw.h / 2 + 2, 14);
        g.lineStyle(3.5, 0xFFFFFF, 1);
        g.beginPath();
        g.moveTo(sw.x + sw.w / 2 - 9, sw.y - sw.h / 2 + 2);
        g.lineTo(sw.x + sw.w / 2 - 3, sw.y - sw.h / 2 + 8);
        g.lineTo(sw.x + sw.w / 2 + 7, sw.y - sw.h / 2 - 5);
        g.strokePath();
        drawStar(g, sw.x - sw.w / 2 - 7, sw.y - 22, 5, C.gold, 0.9, 5);
        drawStar(g, sw.x + sw.w / 2 + 7, sw.y + 17, 4, 0xFFF2B7, 0.85, 5);
      } else if (task.hintLevel > 0) {
        const shown = task.hintLevel >= 2 ? task.hints.length : 1;
        for (let i = 0; i < shown; i++) {
          const key = task.hints[i];
          const x = 168 + i * 24;
          const y = 200;
          g.fillStyle(PURE_COLORS[key], 1).fillCircle(x, y, 9);
          g.lineStyle(2, key === 'white' ? 0x6E5A8D : 0xFFF4D9, 0.7).strokeCircle(x, y, 9);
          if (key !== 'black') g.fillStyle(0xFFFFFF, 0.55).fillCircle(x - 2.5, y - 2.5, 2.2);
        }
      }
    }

    updateTaskUi() {
      if (!this.taskButtonG) return;
      const hasTask = !!this.task;
      this.taskButtonG.setVisible(!hasTask);
      this.taskButtonText.setVisible(!hasTask);
      this.taskPanelG.setVisible(hasTask);
      this.taskElfG.setVisible(hasTask);
      this.taskTitleText.setVisible(hasTask);
      this.taskSubText.setVisible(hasTask);
      this.taskExitText.setVisible(hasTask);
      const success = hasTask && this.task.success;
      this.taskNextText.setVisible(success);
      this.taskHintText.setVisible(false);
      if (!hasTask) {
        this.drawTaskPanel();
        return;
      }

      this.taskTitleText.setText(success ? '调出来啦，太棒了！' : '小精灵想要' + this.task.name);
      this.taskTitleText.setColor(success ? '#FFE7A3' : '#FFF3D2');
      this.taskSubText.setText(success ? '小精灵开心地转圈' : '把锅里的颜色调成一样');
      if (!success) {
        if (this.task.hintLevel > 0) {
          this.taskHintText.setText('小提示').setColor('#F3D98C').setVisible(true);
        } else {
          this.taskHintText.setText('慢慢试，不着急').setColor('#AE9ED6').setVisible(true);
        }
      }
      this.drawTaskPanel();
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
        drawBottleShape(body, b.key, 0, 0, BOTTLE_SCALE, 0);
        const label = this.add.text(b.x, BOTTLE_LABEL_Y, b.name, {
          fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#F6EBD3',
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
      if (PIGMENT_KEYS.indexOf(key) < 0) return false;
      this.pendingPour = null;
      if (this.dropG) this.dropG.clear();
      this.parts[key] = partAmount(this.parts, key) + 1;
      this.targetColor = mixTarget(this.parts);
      this.nameText.setText(colorName(this.targetColor, this.parts));
      this.spawnPourFx(key);
      Sound.pour(key);
      Sound.mix();
      if (this.task && !this.task.success) this.taskCheckIn = TASK_CHECK_SEC;
      return true;
    }

    startTask(key) {
      let target = null;
      if (key) {
        for (let i = 0; i < TASK_TARGETS.length; i++) {
          if (TASK_TARGETS[i].key === key) { target = TASK_TARGETS[i]; break; }
        }
      } else {
        target = TASK_TARGETS[Math.floor(Math.random() * TASK_TARGETS.length)];
      }
      if (!target) return false;

      this.task = null;
      this.resetPot();
      this.task = {
        key: target.key,
        name: target.name,
        color: mixTarget(target.recipe),
        recipe: Object.assign({}, target.recipe),
        hints: target.hints.slice(),
        required: Object.keys(target.recipe).length,
        tries: 0,
        noProgress: 0,
        best: 999,
        lastDistance: 999,
        hintLevel: 0,
        success: false,
      };
      this.taskCheckIn = 0;
      this.updateTaskUi();
      Sound.taskStart();
      return true;
    }

    nextTask() {
      const current = this.task && this.task.key;
      const pool = TASK_TARGETS.filter(function (t) { return t.key !== current; });
      const target = pool[Math.floor(Math.random() * pool.length)] || TASK_TARGETS[0];
      return this.startTask(target.key);
    }

    exitTask() {
      this.task = null;
      this.taskCheckIn = 0;
      this.updateTaskUi();
      return true;
    }

    resetTaskProgress() {
      if (!this.task) return;
      this.task.tries = 0;
      this.task.noProgress = 0;
      this.task.best = 999;
      this.task.lastDistance = 999;
      this.task.hintLevel = 0;
      this.task.success = false;
      this.taskCheckIn = 0;
      this.updateTaskUi();
    }

    evaluateTask() {
      if (!this.task || this.task.success) return false;
      this.taskCheckIn = 0;
      const distance = colorDistance(this.targetColor, this.task.color);
      this.task.lastDistance = distance;
      this.task.tries += 1;

      if (recipeAdded(this.parts, this.task.recipe) && distance <= TASK_TOLERANCE) {
        this.task.success = true;
        this.task.hintLevel = 0;
        this.taskCheckIn = 0;
        this.updateTaskUi();
        this.spawnTaskSuccessFx();
        Sound.taskWin();
        return true;
      }

      if (distance < this.task.best - 2) {
        this.task.best = distance;
        this.task.noProgress = 0;
      } else {
        this.task.best = Math.min(this.task.best, distance);
        this.task.noProgress += 1;
      }

      let hintLevel = 0;
      if (this.task.tries >= 3 && this.task.noProgress >= 2) hintLevel = 1;
      if (this.task.tries >= 6 && this.task.noProgress >= 3) hintLevel = 2;
      if (hintLevel > this.task.hintLevel) this.task.hintLevel = hintLevel;
      this.updateTaskUi();
      return false;
    }

    spawnTaskSuccessFx() {
      if (!this.task) return;
      const base = this.task.color;
      for (let i = 0; i < 16; i++) {
        this.liveProps.push({
          kind: 'star',
          x: POT.x + (Math.random() * 2 - 1) * 135,
          y: POT.y - 36 - Math.random() * 62,
          vx: (Math.random() * 2 - 1) * 50,
          vy: -48 - Math.random() * 55,
          r: 3 + Math.random() * 4,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 5,
          life: 0.9 + Math.random() * 0.8,
          maxLife: 1.7,
          color: i % 3 === 0 ? 0xFFF0B0 : base,
        });
      }
    }

    beginPour(key) {
      if (PIGMENT_KEYS.indexOf(key) < 0) return false;
      if (this.pendingPour) this.settlePendingPour();
      this.ghostG.clear();
      this.pendingPour = {
        key: key,
        color: PURE_COLORS[key],
        t: 0,
        dur: POUR_FALL_SEC,
        fromY: POT.y - 142,
        toY: POT.y + 7,
        drops: [
          { startX: POT.x + 10, endX: POT.x + 3, dy: 0, delay: 0, r: 9.2 },
          { startX: POT.x - 25, endX: POT.x - 10, dy: -26, delay: 0.065, r: 5.2 },
          { startX: POT.x + 27, endX: POT.x + 13, dy: -49, delay: 0.115, r: 4.3 },
        ],
      };
      this.nameText.setText('滴答…');
      Sound.drip();
      this.drawPourDrops();
      return true;
    }

    settlePendingPour() {
      if (!this.pendingPour) return false;
      const key = this.pendingPour.key;
      this.pendingPour = null;
      if (this.dropG) this.dropG.clear();
      return this.addColor(key);
    }

    drawPourDrops() {
      if (!this.dropG) return;
      this.dropG.clear();
      const pour = this.pendingPour;
      if (!pour) return;
      for (let i = 0; i < pour.drops.length; i++) {
        const drop = pour.drops[i];
        if (pour.t < drop.delay) continue;
        const fallDur = pour.dur - drop.delay;
        const q = clamp((pour.t - drop.delay) / fallDur, 0, 1);
        const fall = q * q;
        const x = lerp(drop.startX, drop.endX, q);
        const y = lerp(pour.fromY + drop.dy, pour.toY, fall);
        const alpha = q > 0.9 ? clamp((1 - q) / 0.1, 0, 1) : 1;
        drawDroplet(this.dropG, x, y, drop.r * (1 - q * 0.12), pour.color, alpha);
      }
    }

    resetPot() {
      const had = totalParts(this.parts) > 0 || !!this.drag || !!this.pendingPour;
      if (this.activePointerId != null) this.restoreBottle(this.drag && this.drag.key);
      this.parts = makeEmptyParts();
      this.targetColor = EMPTY_COLOR;
      this.drag = null;
      this.flyBack = null;
      this.pendingPour = null;
      this.activePointerId = null;
      this.ghostG.clear();
      if (this.dropG) this.dropG.clear();
      this.potGlowG.setVisible(false);
      this.nameText.setText('空空的魔法锅');
      this.liveProps.length = 0;
      this.fxG.clear();
      if (had) Sound.reset();
      if (this.task) this.resetTaskProgress();
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

      // 只有混入颜料后，液面才浮出对应颜色的细丝；白黑也会留下自己的痕迹。
      const total = totalParts(this.parts);
      const active = [];
      for (let i = 0; i < PIGMENT_KEYS.length; i++) {
        if (partAmount(this.parts, PIGMENT_KEYS[i]) > 0) active.push(PIGMENT_KEYS[i]);
      }
      if (total > 0) {
        for (let i = 0; i < active.length; i++) {
          const key = active[i];
          const n = partAmount(this.parts, key);
          const x = POT.x + (i - (active.length - 1) / 2) * 58;
          const lineColor = key === 'white' ? 0xFFFDF5 : key === 'black' ? 0x6D7394 : PURE_COLORS[key];
          g.lineStyle(3, lineColor, 0.24 + 0.3 * (n / total));
          g.beginPath();
          g.arc(x, POT.y + 2, 30 + (i % 3) * 5, Math.PI * 0.15, Math.PI * 0.9, false);
          g.strokePath();
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
      if (this.task && containsRect(this.L.taskExit, x, y)) {
        this.exitTask();
        return true;
      }
      if (this.task && this.task.success && containsRect(this.L.taskNext, x, y)) {
        this.nextTask();
        return true;
      }
      if (!this.task && containsRect(this.L.taskButton, x, y)) {
        this.startTask();
        return true;
      }
      if (containsRect(this.L.reset, x, y)) {
        this.resetPot();
        return true;
      }
      const key = this.bottleAt(x, y);
      if (!key) return false;
      if (this.pendingPour) this.settlePendingPour();
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
        this.beginPour(d.key);
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
        drawBottleShape(this.ghostG, d.key, d.x, d.y - 48, BOTTLE_SCALE * 1.13, over ? 0.92 : -0.12);
      } else if (this.flyBack) {
        const f = this.flyBack;
        const t = clamp(f.t / f.dur, 0, 1);
        const x = lerp(f.x, f.ox, t);
        const y = lerp(f.y - 48, f.oy, t);
        drawBottleShape(this.ghostG, f.key, x, y, BOTTLE_SCALE * 1.06, lerp(0.3, 0, t));
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

      if (this.pendingPour) {
        this.pendingPour.t += dt;
        if (this.pendingPour.t >= this.pendingPour.dur) this.settlePendingPour();
        else this.drawPourDrops();
      }

      if (this.task && !this.task.success && this.taskCheckIn > 0) {
        this.taskCheckIn -= dt;
        if (this.taskCheckIn <= 0) this.evaluateTask();
      }

      if (this.taskElfG) {
        const bob = this.task ? (this.task.success ? 5.5 : 2.4) : 0;
        this.taskElfG.y = Math.sin(this.clock * (this.task && this.task.success ? 6 : 2.8)) * bob;
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
