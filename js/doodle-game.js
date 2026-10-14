/*
 * 会动的画 v2：竖屏（540x960）自由画画小玩具。
 * 小孩在纸上随便画一团（蜡笔 / 彩虹笔 / 对称笔 / 贴纸），点「变活啦！」那团东西本身
 * 就变成一只活的小家伙：自动长出眼睛、嘴巴、小手小脚，从画纸蹦到草地上。
 * 可以一次养好几只（上限 5），一队排着跟你手指走；能拖道具给它（皮球/苹果/小花/气球/帽子/小喇叭）、
 * 也能点动作按钮让全队一起跳/转圈/跳舞，还能随时换背景（草地/海边/夜晚）。
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
  const PAPER_CX = PAPER.x + PAPER.w / 2;   // 270：对称笔 / 贴纸的镜像轴
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
const EDGE_PAD = 18;               // 按每只自身宽度收边走范围，保证整只都留在画面里

  const MAX_CREATURES = 5;           // 草地上最多养几只
  const FOLLOW_GAP = 200;            // 排队时每只之间留的距离

  const TAP_MS = 260;                // 这么快松手才算「点」
  const TAP_SLOP = 16;               // 位移小于这个才算「点」
  const TAP_PAD = 20;                // 身体包围盒外扩这么多也算点到了
  const PROP_LIFT = 50;              // 拖道具时幻影抬多高（防止手指挡住）
  const PROP_TAP_SLOP = 12;          // 拖道具位移小于这个算「轻点」

  const MAX_STROKES = 24;            // 一张画最多这么多笔 / 贴纸
  const MAX_PTS_PER_STROKE = 300;    // 一笔最多这么多采样点

  const HOP_MS = 500;
  const HOP_H = 100;
  const SPIN_MS = 900;
  const DANCE_MS = 2400;

  const DAB_MIN_STEP = 2;            // 圆点盖章的最小间距
  const DAB_STEP_RATIO = 0.4;        // 间距 = 笔宽 * 这个

  const SCRATCH_MS = 45;             // 画线沙沙声的节流
  const ALIVE_HINT_MS = 6500;
  const THEME_FADE_MS = 150;

  const COLORS = [0xF4623A, 0xFFC93D, 0x5FC36B, 0x4FB3E8, 0xB57BE8, 0xFF7FB0];
  const DEFAULT_COLOR = 0;           // 默认第 1 支「橘红」
  const SIZES = [6, 13, 22];
  const DEFAULT_SIZE = 1;

  const STICKERS = ['star', 'heart', 'flower'];
  const STAMP_SIZES = [22, 34, 46];
  const STICKER_COLORS = [0xFFC93D, 0xFF7FB0, 0xB57BE8];

  const PROPS = [
    { key: 'ball', name: '皮球' },
    { key: 'apple', name: '苹果' },
    { key: 'flower', name: '小花' },
    { key: 'balloon', name: '气球' },
    { key: 'hat', name: '帽子' },
    { key: 'drum', name: '小喇叭' },
  ];
  const ACTIONS = [
    { key: 'hop', label: '跳一跳' },
    { key: 'spin', label: '转个圈' },
    { key: 'dance', label: '一起跳舞' },
  ];
  const REACT_DUR = { ball: 2.0, apple: 1.6, flower: 1.8, balloon: 3.0, hat: 2.4, drum: 2.4 };

  // 三套背景：地面线永远在 GROUND_Y，只换天色 / 中景 / 地面颜色和装饰
  const THEMES = [
    {
      key: 'grass', label: '草地',
      pal: {
        skyA: 0xBCE7FF, skyB: 0xEBF8FF,
        celestial: 0xFFD95E, celestialGlow: 0xFFF3BE, cloud: 0xFFFFFF,
        mid: 0x8FD36A, mid2: 0x7BC757,
        ground: 0x9FDD78, groundEdge: 0x7FC85A,
        decor: [0xFF8FB8, 0xFFC93D, 0xB98BE8, 0xFFF2F6],
        shadow: 0x33562A, hintStroke: '#4E8A2E', night: false,
      },
    },
    {
      key: 'beach', label: '海边',
      pal: {
        skyA: 0x9FE0FF, skyB: 0xEAFBFF,
        celestial: 0xFFE07A, celestialGlow: 0xFFF6CC, cloud: 0xFFFFFF,
        mid: 0x59C6E8, mid2: 0x8ADBF2,
        ground: 0xF6E3B0, groundEdge: 0xE2C98C,
        decor: [0xFF9E7A, 0xFFF1D6, 0xF5C7A9, 0xE8B6C9],
        shadow: 0xC9A96A, hintStroke: '#7A5A2E', night: false,
      },
    },
    {
      key: 'night', label: '夜晚',
      pal: {
        skyA: 0x2A3A6B, skyB: 0x4C6098,
        celestial: 0xFFF2C4, celestialGlow: 0xFFE6A0, cloud: 0x8C9CC6,
        mid: 0x2F4A46, mid2: 0x27403C,
        ground: 0x3E6A4C, groundEdge: 0x335A40,
        decor: [0xE8E4A0, 0xC9B7F0, 0xA8E0C0, 0xFFD9A0],
        shadow: 0x1B2C22, hintStroke: '#16324A', night: true,
      },
    },
  ];

  const C = {
    deskA: 0xF7E6CB, deskB: 0xEAD3AE,
    paper: 0xFFFDF8, paperDot: 0xEFE7D6, paperEdge: 0xE3D6BC,
    ink: 0x4A4640,
    life: 0xFF9E3D, lifeDark: 0xDE7A20,
    pill: 0xFFFFFF, pillLine: 0xC9BFA8,
    selRing: 0x5B6472,
    tray: 0xFFFFFF, trayLine: 0xCFC3A8,
    ghostRing: 0x4A4640,
    paperHint: '#B3AA96',
    btnTextDark: '#5C5A55',
  };

  const DEPTH = { sky: 0, decor: 1, shadow: 3, creature: 6, fx: 12, ui: 20 };

  // 固定的夜空星星 / 萤火虫（不随重绘乱跳）
  const STARS = (function () {
    const a = []; let seed = 20241013;
    const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 26; i++) a.push({ x: 24 + rnd() * 492, y: 30 + rnd() * 470, r: 1.2 + rnd() * 1.8 });
    return a;
  })();
  const FIREFLIES = (function () {
    const a = []; let seed = 987654321;
    const rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 9; i++) a.push({ x: 40 + rnd() * 470, y: GROUND_Y + 18 + rnd() * 130, r: 2.4 + rnd() * 2.2, ph: rnd() * 6.28 });
    return a;
  })();

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    // 调色板：6 支蜡笔 + 1 个彩虹笔
    const palN = COLORS.length + 1;
    const pd = 48, pgap = 12;
    const ptotal = palN * pd + (palN - 1) * pgap;
    const px0 = (WIDTH - ptotal) / 2;
    const colors = [];
    for (let i = 0; i < palN; i++) {
      colors.push({ i: i, rainbow: i === COLORS.length, cx: px0 + i * (pd + pgap) + pd / 2, cy: 690, r: pd / 2, hit: pd / 2 + 8 });
    }

    const sx = [96, 140, 184];
    const sizes = [];
    for (let i = 0; i < SIZES.length; i++) sizes.push({ i: i, cx: sx[i], cy: 752, hit: 24 });

    const stickers = [];
    const skx = [190, 250, 310];
    for (let i = 0; i < STICKERS.length; i++) stickers.push({ i: i, cx: skx[i], cy: 812, r: 26, hit: 30 });

    const props = [];
    (function () {
      const d = 64, gap = 12, n = PROPS.length;
      const total = n * d + (n - 1) * gap;
      const x0 = (WIDTH - total) / 2;
      for (let i = 0; i < n; i++) props.push({ i: i, key: PROPS[i].key, cx: x0 + i * (d + gap) + d / 2, cy: 900, r: d / 2, hit: d / 2 + 10 });
    })();

    const actions = [];
    (function () {
      const w = 128, h = 48, gap = 16, n = ACTIONS.length;
      const total = n * w + (n - 1) * gap;
      const x0 = (WIDTH - total) / 2;
      for (let i = 0; i < n; i++) actions.push({ i: i, key: ACTIONS[i].key, x: x0 + i * (w + gap), y: 806, w: w, h: h });
    })();

    const bgChips = [];
    (function () {
      const r = 22, gap = 12, x0 = 96;
      for (let i = 0; i < THEMES.length; i++) bgChips.push({ i: i, cx: x0 + i * (r * 2 + gap) + r, cy: 44, r: r, hit: r + 8 });
    })();

    return {
      paper: { x: PAPER.x, y: PAPER.y, w: PAPER.w, h: PAPER.h },
      colors: colors,
      sizes: sizes,
      stickers: stickers,
      sym: { x: 226, y: 730, w: 72, h: 44 },
      undo: { x: 312, y: 730, w: 82, h: 44 },
      clearAll: { x: 408, y: 730, w: 82, h: 44 },
      life: { x: 140, y: 856, w: 260, h: 72 },
      drawHint: { x: WIDTH / 2, y: 654 },
      again: { x: 382, y: 24, w: 140, h: 48 },
      actions: actions,
      props: props,
      bgChips: bgChips,
      aliveHint: { x: WIDTH / 2, y: 150 },
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

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = function (t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return (Math.round(f(h + 1 / 3) * 255) << 16) | (Math.round(f(h) * 255) << 8) | Math.round(f(h - 1 / 3) * 255);
  }
  function rainbowColorAt(len) { return hslToRgb((len * 0.9) % 360, 0.72, 0.58); }

  // 用几条横带拼出「渐变」：比 fillGradientStyle 稳，Canvas / WebGL 都一样
  function drawBands(g, y0, y1, cA, cB, n) {
    const h = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      g.fillStyle(mix(cA, cB, t), 1).fillRect(0, y0 + i * h, WIDTH, h + 1);
    }
  }

  function drawCloud(g, x, y, k, color) {
    g.fillStyle(color, 0.95);
    g.fillCircle(x, y, 26 * k);
    g.fillCircle(x + 26 * k, y + 6 * k, 20 * k);
    g.fillCircle(x - 26 * k, y + 8 * k, 18 * k);
    g.fillCircle(x + 8 * k, y + 12 * k, 22 * k);
    g.fillCircle(x - 10 * k, y + 14 * k, 20 * k);
  }

  // 五角星（用多边形描点，Canvas / WebGL 都稳）
  function starPoints(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.46;
      pts.push({ x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr });
    }
    return pts;
  }
  function fillPoly(g, pts) {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) g.moveTo(pts[i].x, pts[i].y); else g.lineTo(pts[i].x, pts[i].y);
    }
    g.closePath();
    g.fillPath();
  }
  function drawStar(g, x, y, r, color) { g.fillStyle(color, 1); fillPoly(g, starPoints(x, y, r)); }

  // 爱心：经典参数曲线采样成闭合多边形
  const HEART_PTS = (function () {
    const pts = [];
    for (let i = 0; i < 36; i++) {
      const t = i / 36 * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push({ x: x, y: -y });
    }
    let m = 0;
    for (let i = 0; i < pts.length; i++) m = Math.max(m, Math.abs(pts[i].x), Math.abs(pts[i].y));
    for (let i = 0; i < pts.length; i++) { pts[i].x /= m; pts[i].y /= m; }
    return pts;
  })();
  function drawHeart(g, x, y, size, color) {
    const pts = [];
    for (let i = 0; i < HEART_PTS.length; i++) pts.push({ x: x + HEART_PTS[i].x * size, y: y + HEART_PTS[i].y * size });
    g.fillStyle(color, 1);
    fillPoly(g, pts);
  }
  function drawBloom(g, x, y, size, color, core) {
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(color, 1).fillCircle(x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.55, size * 0.5);
    }
    g.fillStyle(core, 1).fillCircle(x, y, size * 0.42);
  }

  // 贴纸图章：星星 / 爱心 / 小花
  function drawStamp(g, kind, x, y, size, color) {
    if (kind === 'star') drawStar(g, x, y, size, color);
    else if (kind === 'heart') drawHeart(g, x, y, size, color);
    else drawBloom(g, x, y, size, color, lighten(color, 0.55));
  }

  function drawTuft(g, x, y, seed, color) {
    g.lineStyle(3, color, 1);
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + i * 7 + (seed % 2 ? 1 : -1) * 2, y - 16 - Math.abs(i) * 3);
      g.strokePath();
    }
  }
  function drawShell(g, x, y, k, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.arc(x, y, 12 * k, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.6, darken(color, 0.25), 0.8);
    for (let i = -2; i <= 2; i++) g.lineBetween(x, y, x + i * 5 * k, y - 11 * k);
  }
  function drawStarfish(g, x, y, k, color) {
    g.fillStyle(color, 1);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = (i % 2 === 0 ? 13 : 5.4) * k;
      pts.push({ x: x + Math.cos(ang) * rr, y: y + Math.sin(ang) * rr });
    }
    fillPoly(g, pts);
  }

  // 道具图标（底部道具栏 + 拖动幻影 + 反应特效都用它）
  function drawPropIcon(g, key, x, y, s) {
    s = s || 1;
    const R = 20 * s;
    if (key === 'ball') {
      g.fillStyle(0xE85A5A, 1).fillCircle(x, y, R);
      g.fillStyle(0xFFD1D1, 1).fillCircle(x - R * 0.34, y - R * 0.34, R * 0.26);
      g.lineStyle(2.5 * s, 0xB43A3A, 1);
      g.beginPath(); g.arc(x, y, R, Math.PI * 0.35, Math.PI * 1.05, false); g.strokePath();
    } else if (key === 'apple') {
      g.fillStyle(0xE8453A, 1).fillCircle(x - R * 0.3, y + R * 0.14, R * 0.7);
      g.fillStyle(0xE8453A, 1).fillCircle(x + R * 0.3, y + R * 0.14, R * 0.7);
      g.fillStyle(0xD23227, 1).fillRect(x - R * 0.15, y - R * 0.78, R * 0.3, R * 0.62);
      g.fillStyle(0x5FA84A, 1).fillEllipse(x + R * 0.52, y - R * 0.74, R * 0.72, R * 0.36);
      g.fillStyle(0xFFFFFF, 0.6).fillCircle(x - R * 0.42, y - R * 0.12, R * 0.16);
    } else if (key === 'flower') {
      drawBloom(g, x, y, R * 0.9, 0xFF8FB8, 0xFFD95E);
    } else if (key === 'balloon') {
      g.lineStyle(2 * s, 0x8A7A6A, 1).lineBetween(x, y + R * 0.62, x - R * 0.16, y + R * 1.12);
      g.fillStyle(0xFF6FB0, 1).fillEllipse(x, y - R * 0.24, R * 1.32, R * 1.58);
      g.fillStyle(0xD94E8C, 1).fillTriangle(x - R * 0.14, y + R * 0.46, x + R * 0.14, y + R * 0.46, x, y + R * 0.68);
      g.fillStyle(0xFFB6D6, 0.85).fillCircle(x - R * 0.3, y - R * 0.55, R * 0.2);
    } else if (key === 'hat') {
      g.fillStyle(0x6FB7E8, 1).fillTriangle(x - R * 0.72, y + R * 0.6, x + R * 0.72, y + R * 0.6, x, y - R * 0.9);
      g.fillStyle(0xFFC93D, 1).fillRect(x - R * 0.66, y + R * 0.28, R * 1.32, R * 0.28);
      g.fillStyle(0xFF7FB0, 1).fillCircle(x, y - R * 0.95, R * 0.24);
    } else if (key === 'drum') {
      // 小喇叭（金色号角）
      g.fillStyle(0xE8B23A, 1).fillTriangle(x + R * 0.98, y - R * 0.58, x + R * 0.98, y + R * 0.58, x + R * 0.12, y + R * 0.06);
      g.fillStyle(0xC8912A, 1).fillRect(x - R * 0.98, y - R * 0.14, R * 1.12, R * 0.28);
      g.fillStyle(0xE8B23A, 1).fillCircle(x - R * 0.98, y, R * 0.2);
      g.fillStyle(0xC8912A, 1).fillRect(x - R * 0.44, y - R * 0.42, R * 0.18, R * 0.3);
    }
  }

  // ---------------------------------------------------------------- 手脚 / 脸
  // 腿只「往外」摆（不再左右交叉成 X），脚踩在 baseY + footRest 上
  function drawLegs(g, a, swing, ph, tucked) {
    g.clear();
    const w = Math.max(3, a.hw * 0.16);
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? -a.legX : a.legX;
      const side = i === 0 ? -1 : 1;
      const amp = tucked ? 0.16 : (0.06 + Math.max(0, Math.sin(ph + (i === 0 ? 0 : Math.PI))) * swing);
      const ang = side * amp;
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
      const side = i === 0 ? -1 : 1;
      const ang = side * (0.05 + Math.max(0, Math.sin(ph + (1 - i) * Math.PI)) * swing * 0.7);
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
    // 腮红
    g.fillStyle(0xFF9FB4, 0.4);
    g.fillCircle(-a.hw * 0.62, ey + a.hh * 0.28, Math.max(4, a.hw * 0.12));
    g.fillCircle(a.hw * 0.62, ey + a.hh * 0.28, Math.max(4, a.hw * 0.12));
  }

  // ---------------------------------------------------------------- 音效
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

    function slide(f0, f1, dur, vol, type) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.08);
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
      // 选颜色 / 选粗细 / 换背景：一声轻脆
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
      hop: function () { slide(320, 880, 0.16, 0.09, 'triangle'); },
      // 小叫声：随机两声
      voice: function () {
        const base = 520 + Math.random() * 260;
        tone(base, 0.11, 0.05, 0.05, 'sine');
        tone(base * (1.18 + Math.random() * 0.24), 0.10, 0.04, 0.18, 'sine');
      },
      // 转圈：呼——
      whoosh: function () { noise(0.32, 0.05, 0, 1800, 480, 0.8); },
      // 跳舞：短短一小段旋律
      dance: function () {
        const notes = [523, 587, 659, 784, 659, 523];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.22, 0.05, i * 0.16, 'triangle');
      },
      // 新建一只小家伙：啵
      pop: function () { tone(420, 0.09, 0.05, 0, 'triangle'); tone(680, 0.1, 0.04, 0.05, 'triangle'); },
      // 皮球弹跳
      ball: function () { tone(520, 0.09, 0.055, 0, 'square'); tone(380, 0.11, 0.04, 0.14, 'square'); },
      // 吃东西：咬两口
      eat: function () { noise(0.06, 0.05, 0, 900, 620, 1.2); noise(0.06, 0.045, 0.22, 820, 560, 1.2); },
      // 闻花 / 爱心：柔和上滑
      heart: function () { tone(660, 0.14, 0.04, 0, 'sine'); tone(990, 0.18, 0.035, 0.09, 'sine'); },
      // 气球升空
      balloonUp: function () { slide(300, 720, 0.5, 0.045, 'sine'); },
      // 盖章 / 戴帽子
      stamp: function () { tone(280, 0.08, 0.05, 0, 'triangle'); noise(0.03, 0.03, 0, 1200, 0, 1.5); },
      // 彩虹笔落笔
      rainbow: function () { tone(880, 0.06, 0.022, 0, 'sine'); },
      // 撤销：短下滑
      undo: function () { tone(620, 0.09, 0.035, 0, 'sine'); tone(420, 0.11, 0.03, 0.06, 'sine'); },
      // 全擦：swish
      clear: function () { noise(0.24, 0.06, 0, 1500, 320, 0.9); },
      // 画纸上还空着 / 草地满了：柔和低音提示
      nudge: function () { tone(300, 0.16, 0.035, 0, 'sine'); tone(240, 0.18, 0.03, 0.09, 'sine'); },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class DoodleScene extends Phaser.Scene {
    constructor() {
      super('DoodleScene');
    }

    create() {
      this.CONST = CONST;
      this.L = computeLayout();

      this.phase = 'draw';
      this.colorIdx = DEFAULT_COLOR;
      this.sizeIdx = DEFAULT_SIZE;
      this.brushMode = 'crayon';       // crayon | rainbow | stamp
      this.symmetry = false;
      this.stickerIdx = 0;
      this.themeIdx = 0;
      this.themeKey = THEMES[0].key;
      this.themeShadow = THEMES[0].pal.shadow;

      this.strokes = [];               // 折线笔迹 + 贴纸图章
      this.activeStroke = null;
      this.drawQ = null;
      this.dabNext = 0;
      this.lastPt = null;
      this.lastScratchAt = -1e9;
      this.elapsed = 0;
      this.lastDt = 1 / 60;

      this.creatures = [];             // 草地上的一群小家伙
      this.press = null;
      this.dragProp = null;
      this.ptrX = WIDTH / 2;
      this.ptrY = 520;
      this.targetX = WIDTH / 2;
      this.facing = 1;
      this.hopCount = 0;
      this.introT = 0;
      this.groupAction = null;
      this.nudgeText = null;
      this.nudgeMsg = null;
      this.liveProps = [];
      this.activePointerId = null;

      Sound.resume();

      this.buildDrawLayer();
      this.buildWorldLayer();
      this.buildAliveUI();
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
      this.stickerG = this.add.graphics().setDepth(DEPTH.ui);
      this.lifeG = this.add.graphics().setDepth(DEPTH.ui);

      const txt = { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: C.btnTextDark };
      this.symText = this.add.text(L.sym.x + L.sym.w / 2, L.sym.y + L.sym.h / 2, '对称', txt)
        .setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.undoText = this.add.text(L.undo.x + L.undo.w / 2, L.undo.y + L.undo.h / 2, '撤销', txt)
        .setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.clearText = this.add.text(L.clearAll.x + L.clearAll.w / 2, L.clearAll.y + L.clearAll.h / 2, '全擦', txt)
        .setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.stickerLabel = this.add.text(L.stickers[0].cx - 58, L.stickers[0].cy, '贴纸', {
        fontFamily: FONT, fontSize: '16px', color: '#B3AA96',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.lifeText = this.add.text(L.life.x + L.life.w / 2 + 16, L.life.y + L.life.h / 2, '变活啦！', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.paintPalette();
      this.paintSizes();
      this.paintStickers();
      this.paintButtons();
    }

    paintPalette() {
      const g = this.palG;
      g.clear();
      for (let i = 0; i < this.L.colors.length; i++) {
        const c = this.L.colors[i];
        if (c.rainbow) {
          for (let k = 0; k < 6; k++) {
            const a0 = k * Math.PI / 3 - Math.PI / 2;
            g.fillStyle(COLORS[k], 1);
            g.beginPath();
            g.moveTo(c.cx, c.cy);
            g.arc(c.cx, c.cy, c.r, a0, a0 + Math.PI / 3, false);
            g.closePath();
            g.fillPath();
          }
        } else {
          g.fillStyle(COLORS[i], 1).fillCircle(c.cx, c.cy, c.r);
        }
        g.lineStyle(3, 0xFFFFFF, 0.9).strokeCircle(c.cx, c.cy, c.r);
        const on = c.rainbow ? this.brushMode === 'rainbow' : (this.brushMode === 'crayon' && i === this.colorIdx);
        if (on) g.lineStyle(4, C.selRing, 1).strokeCircle(c.cx, c.cy, c.r + 5);
      }
    }

    paintSizes() {
      const g = this.sizeG;
      g.clear();
      const col = this.brushMode === 'rainbow' ? 0x9AA7B8 : COLORS[this.colorIdx];
      for (let i = 0; i < this.L.sizes.length; i++) {
        const s = this.L.sizes[i];
        g.fillStyle(0xFFFFFF, 0.85).fillCircle(s.cx, s.cy, 23);
        g.fillStyle(col, 1).fillCircle(s.cx, s.cy, SIZES[i] / 2 + 2);
        if (i === this.sizeIdx) g.lineStyle(3, C.selRing, 1).strokeCircle(s.cx, s.cy, 25);
      }
    }

    paintStickers() {
      const g = this.stickerG;
      g.clear();
      for (let i = 0; i < this.L.stickers.length; i++) {
        const s = this.L.stickers[i];
        g.fillStyle(0xFFFFFF, 0.9).fillRoundedRect(s.cx - s.r, s.cy - s.r, s.r * 2, s.r * 2, 12);
        drawStamp(g, STICKERS[i], s.cx, s.cy, 15, STICKER_COLORS[i]);
        const on = this.brushMode === 'stamp' && i === this.stickerIdx;
        g.lineStyle(on ? 4 : 2, on ? C.selRing : C.pillLine, 1)
          .strokeRoundedRect(s.cx - s.r, s.cy - s.r, s.r * 2, s.r * 2, 12);
      }
    }

    paintButtons() {
      const g = this.btnG;
      const L = this.L;
      g.clear();
      // 对称开关
      g.fillStyle(this.symmetry ? 0xBFE3A6 : C.pill, 1).fillRoundedRect(L.sym.x, L.sym.y, L.sym.w, L.sym.h, 22);
      g.lineStyle(2, this.symmetry ? 0x7FB85E : C.pillLine, 1).strokeRoundedRect(L.sym.x, L.sym.y, L.sym.w, L.sym.h, 22);
      g.fillStyle(C.pill, 1).fillRoundedRect(L.undo.x, L.undo.y, L.undo.w, L.undo.h, 22);
      g.lineStyle(2, C.pillLine, 1).strokeRoundedRect(L.undo.x, L.undo.y, L.undo.w, L.undo.h, 22);
      g.fillStyle(C.pill, 1).fillRoundedRect(L.clearAll.x, L.clearAll.y, L.clearAll.w, L.clearAll.h, 22);
      g.lineStyle(2, C.pillLine, 1).strokeRoundedRect(L.clearAll.x, L.clearAll.y, L.clearAll.w, L.clearAll.h, 22);
      // 变活啦
      const b = L.life;
      g.fillStyle(C.lifeDark, 1).fillRoundedRect(b.x, b.y + 5, b.w, b.h, 36);
      g.fillStyle(C.life, 1).fillRoundedRect(b.x, b.y, b.w, b.h, 36);
      drawStar(g, b.x + 46, b.y + b.h / 2, 13, 0xFFFFFF);
      g.fillStyle(0xFFFFFF, 0.9).fillCircle(b.x + 64, b.y + b.h / 2 - 15, 3);
      g.fillStyle(0xFFFFFF, 0.9).fillCircle(b.x + 68, b.y + b.h / 2 + 14, 2.4);
      if (this.symText) this.symText.setColor(this.symmetry ? '#3E6B2A' : C.btnTextDark);
    }

    // -------------------------------------------------- 草地 / 天空
    buildWorldLayer() {
      this.worldG = this.add.graphics().setDepth(DEPTH.sky);
      this.shadowG = this.add.graphics().setDepth(DEPTH.shadow);
      this.creatureLayer = this.add.container(0, 0).setDepth(DEPTH.creature);
      this.fxLayer = this.add.container(0, 0).setDepth(DEPTH.fx);
      this.paintWorld();
    }

    paintWorld() {
      const g = this.worldG;
      const pal = THEMES[this.themeIdx].pal;
      const key = THEMES[this.themeIdx].key;
      g.clear();
      drawBands(g, 0, GROUND_Y + 40, pal.skyA, pal.skyB, 14);

      if (pal.night) {
        for (let i = 0; i < STARS.length; i++) {
          g.fillStyle(0xFFFFFF, 0.5 + (i % 3) * 0.2).fillCircle(STARS[i].x, STARS[i].y, STARS[i].r);
        }
        g.fillStyle(pal.celestialGlow, 0.35).fillCircle(452, 116, 58);
        g.fillStyle(pal.celestial, 1).fillCircle(452, 116, 36);
        g.fillStyle(pal.skyA, 1).fillCircle(436, 108, 30);
        drawCloud(g, 140, 150, 0.9, pal.cloud);
        drawCloud(g, 330, 100, 0.66, pal.cloud);
      } else {
        g.fillStyle(pal.celestialGlow, 0.45).fillCircle(452, 116, 62);
        g.fillStyle(pal.celestial, 1).fillCircle(452, 116, 40);
        drawCloud(g, 132, 152, 1, pal.cloud);
        drawCloud(g, 336, 96, 0.78, pal.cloud);
        drawCloud(g, 252, 216, 0.66, pal.cloud);
      }

      if (key === 'beach') {
        const seaY = 556;
        g.fillStyle(pal.mid, 1).fillRect(0, seaY, WIDTH, GROUND_Y - seaY);
        g.fillStyle(pal.mid2, 0.75).fillRect(0, seaY, WIDTH, 9);
        for (let i = 0; i < 5; i++) {
          g.fillStyle(0xFFFFFF, 0.45).fillEllipse(60 + i * 108, seaY + 46 + (i % 2) * 30, 60, 10);
        }
      } else {
        g.fillStyle(pal.mid2, 1);
        g.beginPath(); g.arc(136, GROUND_Y + 14, 220, Math.PI, Math.PI * 2, false); g.closePath(); g.fillPath();
        g.fillStyle(pal.mid, 1);
        g.beginPath(); g.arc(432, GROUND_Y + 24, 240, Math.PI, Math.PI * 2, false); g.closePath(); g.fillPath();
      }

      g.fillStyle(pal.ground, 1).fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
      g.fillStyle(pal.groundEdge, 1).fillRect(0, GROUND_Y, WIDTH, 6);

      if (key === 'grass') {
        const fx = [72, 152, 236, 320, 402, 476];
        for (let i = 0; i < fx.length; i++) {
          drawBloom(g, fx[i], GROUND_Y + 34 + (i % 2) * 16, 13 * (0.9 + (i % 3) * 0.12), pal.decor[i % pal.decor.length], Math.min(0xFFFFFF, pal.decor[(i + 1) % pal.decor.length]));
        }
        for (let i = 0; i < 7; i++) drawTuft(g, 40 + i * 76, HEIGHT - 26, i, pal.groundEdge);
      } else if (key === 'beach') {
        drawShell(g, 78, GROUND_Y + 44, 1, pal.decor[0]);
        drawStarfish(g, 168, GROUND_Y + 58, 1, pal.decor[1]);
        drawShell(g, 262, GROUND_Y + 40, 0.85, pal.decor[2]);
        g.fillStyle(pal.decor[3], 1).fillCircle(352, GROUND_Y + 54, 6);
        drawStarfish(g, 440, GROUND_Y + 46, 0.9, pal.decor[0]);
        drawShell(g, 496, GROUND_Y + 62, 0.95, pal.decor[2]);
      } else {
        for (let i = 0; i < FIREFLIES.length; i++) {
          const f = FIREFLIES[i];
          g.fillStyle(0xFFF3A8, 0.28).fillCircle(f.x, f.y, f.r * 2.4);
          g.fillStyle(0xFFF3A8, 0.95).fillCircle(f.x, f.y, f.r);
        }
        for (let i = 0; i < 7; i++) drawTuft(g, 40 + i * 76, HEIGHT - 26, i, pal.groundEdge);
      }
    }

    // -------------------------------------------------- 活着这一层的界面
    buildAliveUI() {
      const L = this.L;
      this.propG = this.add.graphics().setDepth(DEPTH.ui);
      this.actionG = this.add.graphics().setDepth(DEPTH.ui);
      this.bgChipG = this.add.graphics().setDepth(DEPTH.ui);
      this.againG = this.add.graphics().setDepth(DEPTH.ui);
      this.ghostG = this.add.graphics().setDepth(DEPTH.ui + 2);

      this.actionTexts = [];
      for (let i = 0; i < L.actions.length; i++) {
        const b = L.actions[i];
        this.actionTexts.push(this.add.text(b.x + b.w / 2, b.y + b.h / 2, ACTIONS[i].label, {
          fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: C.btnTextDark,
        }).setOrigin(0.5).setDepth(DEPTH.ui + 1));
      }

      const ab = L.again;
      this.againG.fillStyle(0xFFFFFF, 0.94).fillRoundedRect(ab.x, ab.y, ab.w, ab.h, 24);
      this.againG.lineStyle(2, C.pillLine, 1).strokeRoundedRect(ab.x, ab.y, ab.w, ab.h, 24);
      this.againText = this.add.text(ab.x + ab.w / 2, ab.y + ab.h / 2, '再画一只', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: C.btnTextDark,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.aliveHint = this.add.text(L.aliveHint.x, L.aliveHint.y, '拖个玩具给它，或点下面的按钮一起玩', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: THEMES[this.themeIdx].pal.hintStroke, strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.paintProps();
      this.paintBgChips();
      this.paintActionButtons();
    }

    paintProps() {
      const g = this.propG;
      const L = this.L;
      g.clear();
      g.fillStyle(0xFFFFFF, 0.5).fillRoundedRect(30, 862, WIDTH - 60, 78, 26);
      g.lineStyle(2, C.trayLine, 0.7).strokeRoundedRect(30, 862, WIDTH - 60, 78, 26);
      for (let i = 0; i < L.props.length; i++) {
        const s = L.props[i];
        if (this.dragProp && this.dragProp.slot === i) {
          g.lineStyle(2, C.trayLine, 0.9).strokeCircle(s.cx, s.cy, s.r - 2);
        } else {
          drawPropIcon(g, s.key, s.cx, s.cy, 1);
        }
      }
    }

    paintBgChips() {
      const g = this.bgChipG;
      g.clear();
      for (let i = 0; i < this.L.bgChips.length; i++) {
        const c = this.L.bgChips[i];
        const pal = THEMES[i].pal;
        g.fillStyle(pal.ground, 1).fillCircle(c.cx, c.cy, c.r);
        g.fillStyle(pal.celestial, 1).fillCircle(c.cx, c.cy - c.r * 0.34, c.r * 0.34);
        g.lineStyle(i === this.themeIdx ? 4 : 2, i === this.themeIdx ? C.selRing : 0xFFFFFF, 1).strokeCircle(c.cx, c.cy, c.r);
      }
    }

    paintActionButtons() {
      const g = this.actionG;
      g.clear();
      for (let i = 0; i < this.L.actions.length; i++) {
        const b = this.L.actions[i];
        g.fillStyle(0xFFFFFF, 0.9).fillRoundedRect(b.x, b.y, b.w, b.h, 24);
        g.lineStyle(2, C.pillLine, 1).strokeRoundedRect(b.x, b.y, b.w, b.h, 24);
      }
    }

    // -------------------------------------------------- 输入
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
      this.ptrX = x; this.ptrY = y;
      const L = this.L;

      if (this.phase === 'draw') {
        for (let i = 0; i < L.colors.length; i++) {
          if (inCircle(L.colors[i], x, y)) {
            if (L.colors[i].rainbow) this.pickRainbow(); else this.pickColor(i);
            return;
          }
        }
        for (let i = 0; i < L.sizes.length; i++) if (inCircle(L.sizes[i], x, y)) { this.pickSize(i); return; }
        for (let i = 0; i < L.stickers.length; i++) if (inCircle(L.stickers[i], x, y)) { this.pickSticker(i); return; }
        if (inRect(L.sym, x, y)) { this.toggleSymmetry(); return; }
        if (inRect(L.undo, x, y)) { this.undo(); return; }
        if (inRect(L.clearAll, x, y)) { this.clearAll(); return; }
        if (inRect(L.life, x, y)) { this.bringToLife(); return; }
        if (inRect(L.paper, x, y)) this.startStroke(x, y);
        return;
      }

      // 活着：先看有没有点到界面
      for (let i = 0; i < L.props.length; i++) if (inCircle(L.props[i], x, y)) { this.beginPropDrag(i, x, y); return; }
      for (let i = 0; i < L.actions.length; i++) if (inRect(L.actions[i], x, y)) { this.doAction(ACTIONS[i].key); return; }
      for (let i = 0; i < L.bgChips.length; i++) if (inCircle(L.bgChips[i], x, y)) { this.setTheme(i); return; }
      if (inRect(L.again, x, y)) { this.goDraw(); return; }

      const ci = this.hitCreatureIndex(x, y);
      this.press = { x: x, y: y, t: this.elapsed, moved: 0, ci: ci };
      const lb = this.walkBoundsFor(this.creatures[0]);
      this.targetX = clamp(x, lb.lo, lb.hi);
      this.updateLookAll(x, y);
    }

    onMove(p) {
      if (p.id !== this.activePointerId) return;
      const x = p.x, y = p.y;
      this.ptrX = x; this.ptrY = y;

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

      if (this.dragProp) {
        this.dragProp.x = x; this.dragProp.y = y;
        const d = Math.sqrt((x - this.dragProp.px0) * (x - this.dragProp.px0) + (y - this.dragProp.py0) * (y - this.dragProp.py0));
        if (d > this.dragProp.moved) this.dragProp.moved = d;
        return;
      }

      if (this.press) {
        const ddx = x - this.press.x, ddy = y - this.press.y;
        this.press.moved = Math.sqrt(ddx * ddx + ddy * ddy);
      }
      const lb = this.walkBoundsFor(this.creatures[0]);
      this.targetX = clamp(x, lb.lo, lb.hi);
      this.updateLookAll(x, y);
    }

    onUp(p) {
      if (this.activePointerId === null) return;
      if (p && p.id !== undefined && p.id !== this.activePointerId) return;
      if (this.phase === 'draw') {
        this.endStroke();
      } else if (this.dragProp) {
        const d = this.dragProp;
        const gx = d.x, gy = d.y - PROP_LIFT;
        if (d.moved < PROP_TAP_SLOP) {
          this.giveProp(0, d.key);
        } else {
          const ci = this.hitCreatureIndex(gx, gy);
          if (ci >= 0) this.giveProp(ci, d.key); else Sound.nudge();
        }
        this.dragProp = null;
        this.paintProps();
      } else if (this.press) {
        const pr = this.press;
        if (pr.ci >= 0 && (this.elapsed - pr.t) <= TAP_MS / 1000 && pr.moved < TAP_SLOP) this.hop(pr.ci);
      }
      this.press = null;
      this.activePointerId = null;
    }

    beginPropDrag(slot, x, y) {
      const s = this.L.props[slot];
      this.dragProp = { slot: slot, key: s.key, x: x, y: y, px0: x, py0: y, moved: 0 };
      this.press = null;
      this.paintProps();
      Sound.select();
    }

    // -------------------------------------------------- 每帧推进（纯逻辑）
    step(dt) {
      this.elapsed += dt;
      this.lastDt = dt;
      if (this.introT > 0) this.introT = Math.max(0, this.introT - dt);
      if (this.phase !== 'alive') return;
      const n = this.creatures.length;
      const range = this.walkRange();
      for (let i = 0; i < n; i++) {
        const cr = this.creatures[i];
        const a = cr.a;
        const own = this.walkBoundsFor(cr);
        if (a.fxT > 0) a.fxT = Math.max(0, a.fxT - dt);
        if (a.busyT > 0) a.busyT = Math.max(0, a.busyT - dt);
        if (a.hopT > 0) a.hopT = Math.max(0, a.hopT - dt);
        if (a.spinT > 0) a.spinT = Math.max(0, a.spinT - dt);
        if (a.danceT > 0) a.danceT = Math.max(0, a.danceT - dt);
        if (a.pendT > 0) {
          a.pendT -= dt;
          if (a.pendT <= 0) {
            a.pendT = 0;
            if (a.pendKind === 'hop') this.startHop(a);
            else if (a.pendKind === 'spin') { a.spinT = SPIN_MS / 1000; a.busyT = Math.max(a.busyT, SPIN_MS / 1000); Sound.whoosh(); }
            else if (a.pendKind === 'dance') { a.danceT = DANCE_MS / 1000; a.busyT = Math.max(a.busyT, DANCE_MS / 1000); }
            a.pendKind = null;
          }
        }

        if (this.introT <= 0 && a.busyT <= 0) {
          const tx = i === 0 ? clamp(this.targetX, own.lo, own.hi) : this.creatures[i - 1].cont.x;
          const dx = tx - cr.cont.x;
          const ad = Math.abs(dx);
          const room = (range.hi - range.lo) / Math.max(1, n - 1);
          const stop = i === 0 ? 0 : Math.min(FOLLOW_GAP, room);
          if (ad > stop + IDLE_SLOP) {
            const dist = Math.min(ad - stop, WALK_SPEED * dt);
            const dir = dx > 0 ? 1 : -1;
            cr.cont.x = cr.cont.x + dir * dist;
            if (dir !== a.facing) a.facing = dir;
            a.walking = true;
            a.walkPhase += dist * 0.06;
          } else {
            a.walking = false;
          }
        } else {
          a.walking = false;
        }
        // 超出走动范围就慢慢挪回画面里（宽的小家伙也不出画）
        if (cr.cont.x < own.lo - 0.5) {
          cr.cont.x = Math.min(own.lo, cr.cont.x + WALK_SPEED * dt);
          a.walking = true; a.walkPhase += WALK_SPEED * dt * 0.06;
        } else if (cr.cont.x > own.hi + 0.5) {
          cr.cont.x = Math.max(own.hi, cr.cont.x - WALK_SPEED * dt);
          a.walking = true; a.walkPhase += WALK_SPEED * dt * 0.06;
        }
        if (i === 0) this.facing = a.facing;

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
    }

    // -------------------------------------------------- 每帧绘制
    render() {
      if (this.phase !== 'alive') return;
      this.shadowG.clear();
      for (let i = 0; i < this.creatures.length; i++) this.renderCreature(this.creatures[i]);
      this.renderDrag();
    }

    renderCreature(cr) {
      const a = cr.a;
      const cont = cr.cont;
      const hopU = a.hopT > 0 ? 1 - a.hopT / (HOP_MS / 1000) : 0;
      const spinU = a.spinT > 0 ? 1 - a.spinT / (SPIN_MS / 1000) : 0;
      const danceU = a.danceT > 0 ? 1 - a.danceT / (DANCE_MS / 1000) : 0;

      if (this.introT <= 0) {
        let y = a.baseY;
        if (a.walking) y -= Math.abs(Math.sin(a.walkPhase)) * 4;
        if (a.hopT > 0) y -= Math.sin(Math.PI * hopU) * HOP_H;
        cont.y = y;
      }

      const sq = a.hopT > 0 ? 1 + 0.12 * Math.sin(Math.PI * hopU) : 1;
      cont.setScale(a.s, a.s * sq);

      let sx = a.facing;
      if (spinU > 0) sx = a.facing * Math.cos(spinU * Math.PI * 2);
      cr.flip.scaleX = sx;

      let rot = 0;
      if (a.fxKind === 'flower' && a.fxT > 0) rot = 0.09 * Math.sin((1 - a.fxT / a.fxDur) * Math.PI);
      cr.flip.setRotation(rot);
      cr.pop.x = danceU > 0 ? Math.sin(this.elapsed * 10) * 6 : 0;

      let mouthOpen = a.hopT > 0;
      if (a.fxKind === 'apple' && a.fxT > 0) {
        const u = 1 - a.fxT / a.fxDur;
        mouthOpen = Math.floor(u * 8) % 2 === 0;
      }

      const swing = a.walking ? 0.5 : 0.08;
      drawLegs(cr.legsG, a, swing, a.walkPhase, a.hopT > 0);
      drawArms(cr.armsG, a, swing, a.walkPhase);
      drawFace(cr.faceG, a, a.lookCurX, a.lookCurY, a.blinkLeft > 0, mouthOpen);

      const g = this.shadowG;
      const lift = a.hopT > 0 ? Math.sin(Math.PI * hopU) : 0;
      const k = 1 - (lift / HOP_H) * 0.45;
      g.fillStyle(this.themeShadow, 0.18 * k);
      g.fillEllipse(cont.x, GROUND_Y - 2, a.s * a.hw * 2.2 * k, 16 * k);

      this.renderFx(cr);
    }

    renderFx(cr) {
      const g = cr.fxG;
      g.clear();
      const a = cr.a;
      if (!(a.fxT > 0)) return;
      const u = 1 - a.fxT / a.fxDur;
      const cx = cr.cont.x;
      const topY = cr.cont.y - a.s * a.hh;
      const dir = a.facing >= 0 ? 1 : -1;

      if (a.fxKind === 'ball') {
        const bx = cx + dir * (a.s * a.hw + 34);
        const hop = Math.abs(Math.sin(u * Math.PI * 3)) * (1 - 0.35 * u);
        drawPropIcon(g, 'ball', bx, GROUND_Y - 16 - hop * 82, 0.7);
      } else if (a.fxKind === 'apple') {
        const shrink = Math.max(0, 1 - u);
        if (shrink > 0.02) drawPropIcon(g, 'apple', cx + dir * a.s * a.hw * 0.2, cr.cont.y - a.s * a.hh * 0.05, 0.45 + 0.35 * shrink);
      } else if (a.fxKind === 'flower') {
        drawPropIcon(g, 'flower', cx + dir * a.s * a.hw * 0.6, cr.cont.y - a.s * a.hh * 0.35, 0.7);
        for (let i = 0; i < 3; i++) {
          const hu = Math.max(0, Math.min(1, u * 1.2 - i * 0.18));
          if (hu <= 0) continue;
          drawHeart(g, cx + dir * (10 + i * 14), topY - 16 - hu * 60, 9, 0xFF7FB0);
        }
      } else if (a.fxKind === 'balloon') {
        const rise = Math.min(1, u * 1.4);
        const bx = cx + dir * a.s * a.hw * 0.9 + Math.sin(u * 8) * 8;
        const by = cr.cont.y - a.s * a.hh * 0.4 - rise * 150;
        g.lineStyle(2, 0x8A7A6A, 0.85).lineBetween(cx + dir * a.s * a.hw * 0.9, cr.cont.y - a.s * a.hh * 0.2, bx, by + 22);
        drawPropIcon(g, 'balloon', bx, by, 0.85);
      } else if (a.fxKind === 'hat') {
        const tip = Math.sin(u * Math.PI * 2) * 8;
        drawPropIcon(g, 'hat', cx + tip, topY - a.s * a.hh * 0.5, 0.95);
      } else if (a.fxKind === 'drum') {
        drawPropIcon(g, 'drum', cx + dir * a.s * a.hw * 0.75, cr.cont.y - a.s * a.hh * 0.5, 0.8);
        for (let i = 0; i < 4; i++) {
          const nu = Math.max(0, Math.min(1, u * 1.1 - i * 0.16));
          if (nu <= 0) continue;
          const nx = cx + dir * (34 + i * 12), ny = topY - 10 - nu * 70;
          g.fillStyle(0x4A4640, 0.85).fillCircle(nx, ny, 4.5);
          g.fillStyle(0x4A4640, 0.85).fillRect(nx + 3, ny, 3, 14);
        }
      }
    }

    renderDrag() {
      const g = this.ghostG;
      g.clear();
      if (!this.dragProp) return;
      const d = this.dragProp;
      const gx = d.x, gy = d.y - PROP_LIFT;
      const ci = this.hitCreatureIndex(gx, gy);
      if (ci >= 0) {
        const b = this.creatureBounds(ci);
        g.lineStyle(3, 0xFFFFFF, 0.8).strokeCircle((b.x0 + b.x1) / 2, b.y1 - 4, (b.x1 - b.x0) / 2 + 10);
      }
      drawPropIcon(g, d.key, gx, gy, 1.2);
      g.lineStyle(3, 0xFFFFFF, 0.9).strokeCircle(gx, gy, 30);
    }

    // -------------------------------------------------- 画线 / 贴纸
    startStroke(x, y) {
      if (this.strokes.length >= MAX_STROKES) { Sound.nudge(); return; }
      if (this.brushMode === 'stamp') { this.placeStamp(x, y); return; }
      const s = { mode: this.brushMode, color: COLORS[this.colorIdx], width: SIZES[this.sizeIdx], pts: [{ x: x, y: y }], mirror: this.symmetry };
      this.activeStroke = s;
      s.cum = 0;
      const c0 = s.mode === 'rainbow' ? rainbowColorAt(0) : s.color;
      dabPoint(this.inkG, s, x, y, c0, 0, 0);
      if (s.mode === 'rainbow') Sound.rainbow(); else Sound.scratch();
      this.drawQ = { x: x, y: y };
      this.dabNext = Math.max(DAB_MIN_STEP, s.width * DAB_STEP_RATIO);
      this.lastPt = { x: x, y: y };
      this.lastScratchAt = this.elapsed;
    }

    addPoint(x, y) {
      const s = this.activeStroke;
      if (!s || s.pts.length >= MAX_PTS_PER_STROKE) return;
      const p = { x: x, y: y };
      s.pts.push(p);
      const step = Math.max(DAB_MIN_STEP, s.width * DAB_STEP_RATIO);
      const r = dabSegment(this.inkG, s, this.drawQ, p, step, this.dabNext, s.cum, 0, 0);
      this.dabNext = r.next; s.cum = r.cum;
      this.drawQ = p;
    }

    endStroke() {
      if (!this.activeStroke) return;
      this.strokes.push(this.activeStroke);
      this.activeStroke = null;
      this.drawQ = null;
      this.lastPt = null;
    }

    placeStamp(x, y) {
      const s = { mode: 'stamp', kind: STICKERS[this.stickerIdx], cx: x, cy: y, size: STAMP_SIZES[this.sizeIdx], color: COLORS[this.colorIdx], mirror: this.symmetry };
      this.strokes.push(s);
      drawStamp(this.inkG, s.kind, x, y, s.size, s.color);
      if (s.mirror) drawStamp(this.inkG, s.kind, 2 * PAPER_CX - x, y, s.size, s.color);
      Sound.stamp();
    }

    stampPolyline(g, s, ox, oy) {
      const pts = s.pts;
      if (!pts.length) return;
      const step = Math.max(DAB_MIN_STEP, s.width * DAB_STEP_RATIO);
      const c0 = s.mode === 'rainbow' ? rainbowColorAt(0) : s.color;
      dabPoint(g, s, pts[0].x, pts[0].y, c0, ox, oy);
      let next = step, cum = 0, q = pts[0];
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k];
        const r = dabSegment(g, s, q, p, step, next, cum, ox, oy);
        next = r.next; cum = r.cum; q = p;
      }
    }

    stampBody(g, b) {
      for (let i = 0; i < this.strokes.length; i++) {
        const s = this.strokes[i];
        if (s.mode === 'stamp') {
          drawStamp(g, s.kind, s.cx - b.cx, s.cy - b.cy, s.size, s.color);
          if (s.mirror) drawStamp(g, s.kind, (2 * PAPER_CX - s.cx) - b.cx, s.cy - b.cy, s.size, s.color);
        } else {
          this.stampPolyline(g, s, b.cx, b.cy);
        }
      }
    }

    redrawInk() {
      this.inkG.clear();
      for (let i = 0; i < this.strokes.length; i++) {
        const s = this.strokes[i];
        if (s.mode === 'stamp') {
          drawStamp(this.inkG, s.kind, s.cx, s.cy, s.size, s.color);
          if (s.mirror) drawStamp(this.inkG, s.kind, 2 * PAPER_CX - s.cx, s.cy, s.size, s.color);
        } else {
          this.stampPolyline(this.inkG, s, 0, 0);
        }
      }
    }

    bounds() {
      if (!this.strokes.length) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
      const add = function (px, py) {
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        n++;
      };
      for (let i = 0; i < this.strokes.length; i++) {
        const s = this.strokes[i];
        if (s.mode === 'stamp') {
          add(s.cx - s.size, s.cy - s.size);
          add(s.cx + s.size, s.cy + s.size);
          if (s.mirror) {
            const mx = 2 * PAPER_CX - s.cx;
            add(mx - s.size, s.cy - s.size);
            add(mx + s.size, s.cy + s.size);
          }
        } else {
          for (let k = 0; k < s.pts.length; k++) {
            add(s.pts[k].x, s.pts[k].y);
            if (s.mirror) add(2 * PAPER_CX - s.pts[k].x, s.pts[k].y);
          }
        }
      }
      if (!n) return null;
      return { x0: x0, y0: y0, x1: x1, y1: y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }

    // 用哪支蜡笔用得最多，小家伙的四肢就跟着那个色系
    dominantColor() {
      const tally = {};
      let best = COLORS[this.colorIdx], bestN = 0;
      for (let i = 0; i < this.strokes.length; i++) {
        const s = this.strokes[i];
        if (s.mode === 'rainbow') continue;
        const w = s.mode === 'stamp' ? 30 : s.pts.length;
        tally[s.color] = (tally[s.color] || 0) + w;
      }
      for (const k in tally) if (tally[k] > bestN) { bestN = tally[k]; best = parseInt(k, 10); }
      return best;
    }

    // -------------------------------------------------- 工具条动作
    pickColor(i) {
      if (i < 0 || i >= COLORS.length) return;
      const changed = this.brushMode !== 'crayon' || i !== this.colorIdx;
      this.brushMode = 'crayon';
      this.colorIdx = i;
      this.paintPalette(); this.paintSizes(); this.paintStickers();
      if (changed) Sound.select();
    }

    pickRainbow() {
      const changed = this.brushMode !== 'rainbow';
      this.brushMode = 'rainbow';
      this.paintPalette(); this.paintSizes(); this.paintStickers();
      if (changed) Sound.select();
    }

    pickSticker(i) {
      if (i < 0 || i >= STICKERS.length) return;
      const changed = this.brushMode !== 'stamp' || i !== this.stickerIdx;
      this.brushMode = 'stamp';
      this.stickerIdx = i;
      this.paintPalette(); this.paintSizes(); this.paintStickers();
      if (changed) Sound.select();
    }

    toggleSymmetry() {
      this.symmetry = !this.symmetry;
      this.paintButtons();
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
      if (!b || Math.min(b.w, b.h) < MIN_DOODLE) { Sound.nudge(); this.showNudge('先在纸上画点什么吧～'); return; }
      if (this.creatures.length >= MAX_CREATURES) { Sound.nudge(); this.showNudge('草地满啦，先跟它们玩一会儿吧～'); return; }
      const cr = this.makeCreature(b);
      this.phase = 'alive';
      this.introT = 0.62;
      this.targetX = this.creatures[0].cont.x;
      this.press = null;
      this.activePointerId = null;
      this.activeStroke = null; this.drawQ = null; this.lastPt = null;
      this.dragProp = null;
      Sound.alive();
      this.sparkle(cr.cont.x, cr.a.baseY - cr.a.s * cr.a.hh, COLORS[this.colorIdx], 14);
      this.showPhase('alive', false);
      this.fadeAliveHint();
      this.updateLookAll(cr.cont.x, cr.cont.y);
    }

    makeCreature(b) {
      const s = clamp(Math.min(LIFE_H / b.h, LIFE_W_MAX / b.w), SCALE_MIN, SCALE_MAX);
      const hw = b.w / 2, hh = b.h / 2;
      const legLen = clamp(hh * 0.8, 16, 70);
      const legY = hh * 0.9;
      const baseY = GROUND_Y - s * (legY + legLen);
      const base = this.dominantColor();

      const bodyG = this.add.graphics();
      this.stampBody(bodyG, b);
      const armsG = this.add.graphics();
      const legsG = this.add.graphics();
      const faceG = this.add.graphics();
      const fxG = this.add.graphics();

      const flip = this.add.container(0, 0, [bodyG, armsG, legsG, faceG]);
      const pop = this.add.container(0, 0, [flip]);
      const startRange = this.boundsForHalf(hw * s);
      const spawnX = clamp(b.cx, startRange.lo, startRange.hi);
      const cont = this.add.container(spawnX, baseY, [pop]);
      cont.setDepth(DEPTH.creature);
      cont.setScale(s);
      this.creatureLayer.add(cont);
      this.fxLayer.add(fxG);

      const a = {
        hw: hw, hh: hh, s: s, baseY: baseY,
        ink: C.ink, skin: lighten(base, 0.5), skinDark: darken(base, 0.06),
        eyeR: clamp(Math.min(hw, hh) * 0.22, 8, 26),
        legX: hw * 0.42, legY: legY, legLen: legLen, footRest: legY + legLen,
        armX: hw * 0.95, armY: -hh * 0.05,
        armLen: clamp(hh * 0.55, 12, 46),
        walkPhase: 0, walking: false, facing: 1,
        blinkT: 2 + Math.random() * 2, blinkLeft: 0,
        lookX: 0, lookY: 0, lookCurX: 0, lookCurY: 0,
        hopT: 0, spinT: 0, danceT: 0, busyT: 0,
        fxT: 0, fxKind: null, fxDur: 1,
        pendT: 0, pendKind: null,
      };

      const cr = { cont: cont, flip: flip, pop: pop, bodyG: bodyG, armsG: armsG, legsG: legsG, faceG: faceG, fxG: fxG, a: a };
      this.creatures.push(cr);
      this.trackObj(cont);

      pop.y = -90; pop.setAlpha(0); pop.setScale(0.5);
      this.tweens.add({ targets: pop, y: 0, scale: 1, duration: 620, ease: 'Bounce.Out' });
      this.tweens.add({ targets: pop, alpha: 1, duration: 240 });
      Sound.pop();
      return cr;
    }

    // -------------------------------------------------- 再画一只 / 整片重来
    goDraw() {
      if (this.phase !== 'alive') return;
      this.strokes = [];
      this.inkG.clear();
      this.activeStroke = null; this.drawQ = null; this.lastPt = null;
      this.dragProp = null;
      this.press = null; this.activePointerId = null;
      this.clearReactions();
      this.phase = 'draw';
      this.paintProps();
      this.showPhase('draw', false);
    }

    resetAll() {
      for (let i = 0; i < this.creatures.length; i++) {
        this.untrackObj(this.creatures[i].cont);
        this.creatures[i].cont.destroy();
      }
      this.creatures = [];
      this.clearReactions();
      this.strokes = [];
      this.inkG.clear();
      this.shadowG.clear();
      this.activeStroke = null; this.drawQ = null; this.lastPt = null;
      this.press = null; this.activePointerId = null; this.dragProp = null;
      this.targetX = WIDTH / 2; this.facing = 1; this.hopCount = 0;
      this.introT = 0;
      while (this.liveProps.length) {
        const o = this.liveProps.pop();
        if (o && o.destroy) o.destroy();
      }
      this.phase = 'draw';
      this.paintProps();
      this.showPhase('draw', false);
    }

    clearReactions() {
      for (let i = 0; i < this.creatures.length; i++) {
        const cr = this.creatures[i];
        const a = cr.a;
        a.fxT = 0; a.fxKind = null; a.fxDur = 1;
        a.hopT = 0; a.spinT = 0; a.danceT = 0; a.busyT = 0;
        a.pendT = 0; a.pendKind = null;
        if (cr.fxG) cr.fxG.clear();
        if (cr.pop) cr.pop.x = 0;
      }
    }

    // -------------------------------------------------- 道具反应 / 全队动作
    startHop(a) {
      a.hopT = HOP_MS / 1000;
      a.busyT = Math.max(a.busyT, HOP_MS / 1000);
      this.hopCount += 1;
      Sound.hop();
    }

    hop(ci) {
      const cr = this.creatures[ci === undefined ? 0 : ci];
      if (!cr) return;
      const a = cr.a;
      if (a.hopT > 0) return;
      this.startHop(a);
      Sound.voice();
      this.sparkle(cr.cont.x, cr.cont.y - a.s * a.hh, COLORS[this.colorIdx], 7);
    }

    giveProp(ci, key) {
      const cr = this.creatures[ci];
      if (!cr) return false;
      let found = false;
      for (let i = 0; i < PROPS.length; i++) if (PROPS[i].key === key) found = true;
      if (!found) return false;
      this.startReaction(cr, key);
      return true;
    }

    startReaction(cr, key) {
      const a = cr.a;
      const dur = REACT_DUR[key] || 1.6;
      a.fxKind = key; a.fxDur = dur; a.fxT = dur;
      a.busyT = Math.max(a.busyT, dur);
      a.walking = false;
      if (key === 'ball') this.startHop(a);
      const snd = { ball: Sound.ball, apple: Sound.eat, flower: Sound.heart, balloon: Sound.balloonUp, hat: Sound.stamp, drum: Sound.dance }[key];
      if (snd) snd();
    }

    doAction(key) {
      if (this.phase !== 'alive' || !this.creatures.length) return;
      const n = this.creatures.length;
      for (let i = 0; i < n; i++) {
        const a = this.creatures[i].a;
        a.hopT = 0; a.spinT = 0; a.danceT = 0; a.pendT = 0; a.pendKind = null;
      }
      for (let i = 0; i < n; i++) {
        const a = this.creatures[i].a;
        if (key === 'hop') {
          if (i === 0) this.startHop(a);
          else { a.pendKind = 'hop'; a.pendT = i * 0.12; }
        } else if (key === 'spin') {
          if (i === 0) { a.spinT = SPIN_MS / 1000; a.busyT = Math.max(a.busyT, SPIN_MS / 1000); }
          else { a.pendKind = 'spin'; a.pendT = i * 0.10; }
        } else if (key === 'dance') {
          if (i === 0) { a.danceT = DANCE_MS / 1000; a.busyT = Math.max(a.busyT, DANCE_MS / 1000); }
          else { a.pendKind = 'dance'; a.pendT = i * 0.08; }
        }
      }
      this.groupAction = key;
      if (key === 'spin') Sound.whoosh();
      else if (key === 'dance') Sound.dance();
    }

    // -------------------------------------------------- 换背景
    setTheme(i) {
      if (i < 0 || i >= THEMES.length) return;
      if (i === this.themeIdx) return;
      this.themeIdx = i;
      this.themeKey = THEMES[i].key;
      this.themeShadow = THEMES[i].pal.shadow;
      Sound.select();
      this.paintBgChips();
      if (this.aliveHint) this.aliveHint.setStroke(THEMES[i].pal.hintStroke, 5);
      if (!this.worldG) { this.paintWorld(); return; }
      this.tweens.killTweensOf(this.worldG);
      this.tweens.add({
        targets: this.worldG, alpha: 0, duration: THEME_FADE_MS,
        onComplete: () => {
          this.paintWorld();
          this.tweens.add({ targets: this.worldG, alpha: 1, duration: THEME_FADE_MS });
        },
      });
    }

    // -------------------------------------------------- 命中与视线
    // 按半宽算出这只小家伙能站的范围，保证整只都留在画面里
    boundsForHalf(hwPx) {
      const half = hwPx + EDGE_PAD;
      return {
        lo: Math.max(WALK_X0, Math.min(half, WIDTH / 2 - 40)),
        hi: Math.min(WALK_X1, Math.max(WIDTH - half, WIDTH / 2 + 40)),
      };
    }

    // 某一只自己的走动范围
    walkBoundsFor(cr) {
      return this.boundsForHalf(cr ? cr.a.hw * cr.a.s : 0);
    }

    // 按草地上最宽的那只估算整体范围（排队间距用）
    walkRange(extraHalf) {
      let hwMax = extraHalf || 0;
      for (let i = 0; i < this.creatures.length; i++) {
        const a = this.creatures[i].a;
        if (a.hw * a.s > hwMax) hwMax = a.hw * a.s;
      }
      return this.boundsForHalf(hwMax);
    }

    creatureBounds(i) {
      const cr = this.creatures[i === undefined ? 0 : i];
      if (!cr) return null;
      const a = cr.a, s = cr.cont.scaleX;
      const hw = a.hw * s;
      return {
        x0: cr.cont.x - hw, x1: cr.cont.x + hw,
        y0: cr.cont.y - a.hh * s, y1: cr.cont.y + a.footRest * s,
      };
    }

    hitCreatureIndex(x, y) {
      for (let i = this.creatures.length - 1; i >= 0; i--) {
        const b = this.creatureBounds(i);
        if (x >= b.x0 - TAP_PAD && x <= b.x1 + TAP_PAD && y >= b.y0 - TAP_PAD && y <= b.y1 + TAP_PAD) return i;
      }
      return -1;
    }

    updateLookAll(x, y) {
      for (let i = 0; i < this.creatures.length; i++) {
        const cr = this.creatures[i], a = cr.a;
        a.lookX = clamp((x - cr.cont.x) / 200, -1, 1);
        a.lookY = clamp((y - (cr.cont.y - a.s * a.hh)) / 200, -1, 1);
      }
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

    showNudge(msg) {
      msg = msg || '先在纸上画点什么吧～';
      if (!this.nudgeText) {
        this.nudgeText = this.add.text(this.L.nudge.x, this.L.nudge.y, msg, {
          fontFamily: FONT, fontSize: '22px', color: '#8A8272',
          backgroundColor: '#FFFDF8', padding: { x: 18, y: 11 },
        }).setOrigin(0.5).setDepth(DEPTH.ui + 3);
        this.nudgeMsg = msg;
      } else if (this.nudgeMsg !== msg) {
        this.nudgeText.setText(msg);
        this.nudgeMsg = msg;
      }
      this.nudgeText.setAlpha(1);
      this.tweens.killTweensOf(this.nudgeText);
      this.tweens.add({ targets: this.nudgeText, alpha: 0, delay: 1300, duration: 500 });
    }

    // -------------------------------------------------- 阶段切换
    showPhase(phase, instant) {
      const drawObjs = [this.deskG, this.paperG, this.inkG, this.drawHint, this.palG, this.sizeG,
        this.btnG, this.stickerG, this.stickerLabel, this.lifeG, this.symText, this.undoText,
        this.clearText, this.lifeText];
      const playObjs = [this.worldG, this.shadowG, this.creatureLayer, this.fxLayer, this.propG,
        this.actionG, this.bgChipG, this.againG, this.againText, this.aliveHint, this.ghostG].concat(this.actionTexts);
      const d = phase === 'draw' ? 1 : 0;
      const p = phase === 'alive' ? 1 : 0;
      this.fadeGroup(drawObjs, d, instant ? 0 : 320);
      this.fadeGroup(playObjs, p, instant ? 0 : 320);
      this.aliveHint.setAlpha(0);
    }

    fadeGroup(objs, to, dur) {
      // 逐个对象单独补间：Phaser 3.90 里「一个补间带一大串 targets」有时不生效
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (!o) continue;
        if (dur <= 0) { o.setAlpha(to); continue; }
        this.tweens.add({ targets: o, alpha: to, duration: dur });
      }
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

    // -------------------------------------------------- 兼容 / 测试钩子（非公共 API）
    get creature() { return this.creatures.length ? this.creatures[0].cont : null; }
    get animal() { return this.creatures.length ? this.creatures[0].a : null; }

    forceTapOnCreature() { this.hop(0); }
    forceProp(key, ci) { return this.giveProp(ci === undefined ? 0 : ci, key); }

    update(time, delta) {
      const dt = Math.min(delta, 60) / 1000;
      this.step(dt);
      this.render();
    }
  }

  // 圆点盖章：折线笔迹就是沿路径盖一串圆点，天然圆头圆角
  function dabPoint(g, s, px, py, color, ox, oy) {
    const r = s.width / 2;
    g.fillStyle(color, 1);
    g.fillCircle(px - ox, py - oy, r);
    if (s.mirror) g.fillCircle(2 * PAPER_CX - px - ox, py - oy, r);
  }

  function dabSegment(g, s, q, p, step, next, cum, ox, oy) {
    const dx = p.x - q.x, dy = p.y - q.y;
    const seg = Math.sqrt(dx * dx + dy * dy);
    if (seg <= 1e-6) return { next: next, cum: cum };
    let t = next;
    while (t <= seg) {
      const u = t / seg;
      const x = q.x + dx * u, y = q.y + dy * u;
      const color = s.mode === 'rainbow' ? rainbowColorAt(cum + t) : s.color;
      dabPoint(g, s, x, y, color, ox, oy);
      t += step;
    }
    return { next: t - seg, cum: cum + seg };
  }

  const CONST = {
    WIDTH: WIDTH, HEIGHT: HEIGHT, PAPER: PAPER, GROUND_Y: GROUND_Y, PAPER_CX: PAPER_CX,
    COLORS: COLORS, SIZES: SIZES, STICKERS: STICKERS, STAMP_SIZES: STAMP_SIZES,
    MAX_STROKES: MAX_STROKES, MAX_PTS_PER_STROKE: MAX_PTS_PER_STROKE,
    WALK_SPEED: WALK_SPEED, TAP_MS: TAP_MS, TAP_SLOP: TAP_SLOP,
    LIFE_H: LIFE_H, LIFE_W_MAX: LIFE_W_MAX, SCALE_MIN: SCALE_MIN, SCALE_MAX: SCALE_MAX,
    MAX_CREATURES: MAX_CREATURES, FOLLOW_GAP: FOLLOW_GAP,
    PROPS: PROPS, ACTIONS: ACTIONS, THEMES: THEMES,
  };

  DoodleScene.CONST = CONST;

  window.DoodleScene = DoodleScene;
})();
