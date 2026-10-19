/*
 * 果园算一算：竖屏（540x960）的实物加减小玩具。
 * 每道题用两堆真实可数的果子表现加法（合起来）和减法（被小松鼠拿走），
 * 孩子可以把一堆果子拖进另一个盘子（也可以直接答题），再从三张大数字卡里点答案。
 * 一轮固定 10 题，难度从 5 以内平滑升到 10 以内：答错不降档、不扣星、不换题、不结束。
 * 无语音、无背景音乐；画面全部 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，不加载任何素材文件。
 *
 * 出题与判分统一走 makeQuestion(qi, cap, used) / answer(choiceIdx)，
 * 以后想换成「求部分」(3 + ? = 5) 或 20 以内，只改生成器，交互和画面都不用动。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const ROUND_SIZE = 10;          // 一轮 10 题
  const CAP_MIN = 5;              // 开局数字上限（5 以内）
  const CAP_MAX = 10;             // 最高数字上限（10 以内）
  const CAP_STEP = 2;             // 每答对 2 题，上限 +1
  const ANSWER_CARDS = 3;         // 三张数字卡
  const SUB_MAX = 3;              // 减法一次最多拿走 3 个

  const FRUIT_R = 20;             // 果子半径
  const FRUIT_DX = 42;            // 果子横向间距
  const FRUIT_DY = 46;            // 两排果子的行距
  const CARD_W = 140;             // 答案卡尺寸
  const CARD_H = 120;
  const CARD_Y = 716;

  const REVEAL_SEC = 0.9;         // 答对后停留多久再进下一题
  const END_DELAY_SEC = 0.8;      // 最后一题到结算卡
  const TAP_LOCK_SEC = 0.4;       // 结算卡防误触
  const WRONG_COUNT_DELAY = 0.4;  // 答错后多久开始点数
  const COUNT_STEP = 0.18;        // 点数间隔
  const COUNT_HOLD = 0.9;         // 数完停留
  const MERGE_SPEED = 3.2;        // 合并 / 回位动画速度（每秒进度）
  const TIP_HOLD_SEC = 6;         // 引导气泡停留
  const TIP_FADE_SEC = 0.6;
  const HINT_HOLD_SEC = 6;        // 底部提示停留
  const DRAG_SCALE = 0.9;         // 拖拽时整组缩小
  const DRAG_LIFT = 40;           // 拖拽时比手指高多少

  // ---------------------------------------------------------------- 配色
  const C = {
    skyTop: 0xBFE6FA, skyBottom: 0xEAF7FF,
    sun: 0xFFE08A, sunLight: 0xFFF3C4,
    hill1: 0xB7DE9A, hill2: 0x9FD187, hill3: 0x86C97F,
    tree1: 0x86C97F, tree2: 0x6FB86B, tree3: 0x9AD893, trunk: 0xA9856A,
    wood: 0xF3E3CE, woodLine: 0xE2CDAE, woodStreak: 0xEADABF, woodDark: 0xC9A87B,
    grass: 0xA8D98A, grassDark: 0x8CC673, grassLight: 0xC3E8A8, grassDeep: 0x76B45C,
    plateWood: 0xF0DCBA, plateWoodDark: 0xD2B287, plate: 0xFFFDF8, plateLine: 0xE6DAC6,
    apple: 0xF4787E, appleDark: 0xC75A66,
    pear: 0xCBE38A, pearDark: 0x9EBF5A,
    chestnut: 0xC08A5E, chestnutDark: 0x8C6138, chestnutLight: 0xE8C9A6,
    leaf: 0x8CC96B, leafDark: 0x66A64B, stem: 0x8C6138,
    squirrel: 0xE8B07C, squirrelDark: 0xC08A5E, squirrelLight: 0xFFE9D2,
    basket: 0xD9A868, basketDark: 0xA87C50, basketLight: 0xEFC98F,
    ink: 0x7A5238, eye: 0x4A3A2E,
    card: 0xFFFFFF, cardLine: 0xE6D8C6, cardShadow: 0x3A2A1E,
    cardText: '#5C4A38', cardTextOk: '#4F7A3C',
    ok: 0x7FB069, okDark: 0x5E8F4C,
    plus: 0xF09A3E, minus: 0xE1788A,
    star: 0xFFC94D, starDark: 0xE0A63A,
    hudBg: 0xFFF6E8, hudLine: 0xE0C6A6, hudText: '#6B4A32',
    tipBg: 0xFFF6E8, tipLine: 0xE0C6A6, tipText: '#6B4A32',
    hintText: '#FFF6E8', hintStroke: '#8C6138',
    cardDim: 0x3A2A1E, cardTitle: '#5C4A38', cardSub: '#8C7A66',
    cardBtn: 0x5BA8E8, cardBtnText: '#FFFFFF',
    signBoard: 0xC08A5E, signDark: 0x8C6138, signLight: 0xD9AA7C, signText: '#6B4A32',
  };

  // 场景深度：背景 0 -> 草地托盘/盘子 1 -> 果子 3 -> 松鼠 4 -> 算式 6
  // -> 答案卡 8 -> 拖拽幻影 12 -> 特效 14 -> HUD 20 -> 结算卡 40
  const DEPTH = {
    world: 0, tray: 1, fruit: 3, squirrel: 4, equation: 6, cards: 8,
    ghost: 12, fx: 14, hud: 20, card: 40,
  };

  // 果子按题号轮换：每道题只用一种，数起来不混
  const FRUIT_KINDS = ['apple', 'pear', 'chestnut'];

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const sign = { x: 46, y: 56, w: 364, h: 78, cx: 228, cy: 95 };
    const hud = { x: 430, y: 74, w: 88, h: 48, cx: 474, cy: 98 };
    const progress = { cx: WIDTH / 2, y: 166, gap: 28, r: 7 };
    const eq = { cx: WIDTH / 2, cy: 227, boxW: 96, boxH: 72, gap: 16 };
    const tray = { x: 24, y: 290, w: 492, h: 340, r: 26 };
    const add = {
      left: { x: 142, y: 462, r: 110 },
      right: { x: 398, y: 462, r: 110 },
      squirrel: { x: 84, y: 366, s: 0.8 },
      sign: { x: 270, y: 462 },
    };
    const sub = {
      plate: { x: 150, y: 462, r: 118 },
      basket: { x: 405, y: 500, r: 72 },
      squirrel: { x: 405, y: 428, s: 0.86 },
      sign: { x: 300, y: 462 },
    };
    const cards = [];
    for (let i = 0; i < ANSWER_CARDS; i++) {
      cards.push({ x: 110 + i * 160, y: CARD_Y, w: CARD_W, h: CARD_H });
    }
    return {
      sign: sign, hud: hud, progress: progress, eq: eq, tray: tray,
      add: add, sub: sub, cards: cards,
      table: { y0: 292, y1: HEIGHT },
      recount: { x: WIDTH / 2, y: 862, w: 190, h: 50 },
      hint: { x: WIDTH / 2, y: 812 },
      tip: { x: WIDTH / 2, y: 604, w: 280, h: 36 },
      cardRect: { w: 430, h: 380, x: (WIDTH - 430) / 2, y: (HEIGHT - 380) / 2 },
    };
  }

  // ---------------------------------------------------------------- 小工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t; }
  function blend(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
  }
  function fillPoly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }
  function strokePoly(g, pts, closed) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed) g.closePath();
    g.strokePath();
  }
  function fillEllipse(g, cx, cy, rx, ry) { g.fillEllipse(cx, cy, rx * 2, ry * 2); }
  function strokeEllipse(g, cx, cy, rx, ry) { g.strokeEllipse(cx, cy, rx * 2, ry * 2); }
  function line(g, x0, y0, x1, y1, w, color, alpha) {
    g.lineStyle(w, color, alpha === undefined ? 1 : alpha);
    strokePoly(g, [[x0, y0], [x1, y1]], false);
  }
  function starPts(cx, cy, rOut, rIn, points) {
    const pts = [];
    for (let i = 0; i < points * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / points;
      const r = i % 2 === 0 ? rOut : rIn;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return pts;
  }
  function heartPts(cx, cy, s) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([cx + (x / 18) * s, cy - (y / 18) * s]);
    }
    return pts;
  }
  function textW(t, fallback) {
    return (t && isFinite(t.width) && t.width > 0) ? t.width : fallback;
  }
  function inRect(x, y, r) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }
  function dist2(x0, y0, x1, y1) {
    const dx = x0 - x1, dy = y0 - y1;
    return dx * dx + dy * dy;
  }
  // 数量 -> 盘子里的位置：<=5 排一行，>5 排成 5+5 两行（十格阵的味道）
  function fruitPositions(n, cx, cy, dxOpt) {
    const dx = dxOpt || FRUIT_DX;
    if (n <= 0) return [];
    const rows = n <= 5 ? [n] : [5, n - 5];
    const out = [];
    for (let ri = 0; ri < rows.length; ri++) {
      const count = rows[ri];
      const rowY = cy + (rows.length === 1 ? 0 : (ri === 0 ? -FRUIT_DY / 2 : FRUIT_DY / 2));
      for (let i = 0; i < count; i++) {
        out.push({ x: cx + (i - (count - 1) / 2) * dx, y: rowY });
      }
    }
    return out;
  }
  function strokeDashedRect(g, x, y, w, h, color, width, dash, gap, alpha) {
    g.lineStyle(width, color, alpha === undefined ? 0.9 : alpha);
    for (let px = x; px < x + w; px += dash + gap) {
      const ww = Math.min(dash, x + w - px);
      strokePoly(g, [[px, y], [px + ww, y]], false);
      strokePoly(g, [[px, y + h], [px + ww, y + h]], false);
    }
    for (let py = y; py < y + h; py += dash + gap) {
      const hh = Math.min(dash, y + h - py);
      strokePoly(g, [[x, py], [x, py + hh]], false);
      strokePoly(g, [[x + w, py], [x + w, py + hh]], false);
    }
  }
  function dashedCircle(g, x, y, r, color, width, alpha) {
    g.lineStyle(width, color, alpha === undefined ? 0.9 : alpha);
    const n = 28;
    for (let i = 0; i < n; i += 2) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
      g.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
      g.strokePath();
    }
  }

  // ---------------------------------------------------------------- 画：果子
  function fruitPalette(kind) {
    if (kind === 'pear') return { main: C.pear, dark: C.pearDark, hi: 0xF0F4C8 };
    if (kind === 'chestnut') return { main: C.chestnut, dark: C.chestnutDark, hi: C.chestnutLight };
    return { main: C.apple, dark: C.appleDark, hi: 0xFFC1C4 };
  }

  function drawFruit(g, kind, x, y, r, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    const p = fruitPalette(kind);
    // 落影：让果子看起来是放在盘子里的
    g.fillStyle(0x6B4A32, 0.10 * a);
    fillEllipse(g, x + 2, y + r * 0.92, r * 0.82, r * 0.28);

    if (kind === 'pear') {
      g.fillStyle(p.dark, a);
      fillEllipse(g, x, y + r * 0.18, r * 0.82, r * 0.78);
      fillEllipse(g, x, y - r * 0.56, r * 0.54, r * 0.55);
      g.fillStyle(p.main, a);
      fillEllipse(g, x - r * 0.04, y + r * 0.12, r * 0.72, r * 0.68);
      fillEllipse(g, x - r * 0.03, y - r * 0.58, r * 0.45, r * 0.47);
      g.fillStyle(p.hi, 0.72 * a);
      fillEllipse(g, x - r * 0.25, y - r * 0.08, r * 0.20, r * 0.32);
      g.fillStyle(C.stem, a);
      line(g, x + r * 0.02, y - r * 0.96, x + r * 0.12, y - r * 1.34, Math.max(2, r * 0.14), C.stem, a);
      g.fillStyle(C.leaf, a);
      fillEllipse(g, x + r * 0.35, y - r * 1.17, r * 0.28, r * 0.13);
    } else if (kind === 'chestnut') {
      // 圆滚滚的栗子：下面浅、上面深，顶上一个小小的尖
      g.fillStyle(p.dark, a);
      fillPoly(g, [
        [x, y - r * 0.95], [x + r * 0.72, y - r * 0.28], [x + r * 0.78, y + r * 0.40],
        [x + r * 0.34, y + r * 0.86], [x - r * 0.34, y + r * 0.86], [x - r * 0.78, y + r * 0.40],
        [x - r * 0.72, y - r * 0.28],
      ]);
      g.fillStyle(p.main, a);
      fillPoly(g, [
        [x, y - r * 0.78], [x + r * 0.60, y - r * 0.20], [x + r * 0.64, y + r * 0.34],
        [x + r * 0.28, y + r * 0.70], [x - r * 0.28, y + r * 0.70], [x - r * 0.64, y + r * 0.34],
        [x - r * 0.60, y - r * 0.20],
      ]);
      g.fillStyle(p.hi, 0.62 * a);
      fillEllipse(g, x - r * 0.22, y - r * 0.12, r * 0.24, r * 0.34);
      g.fillStyle(C.chestnutLight, a);
      fillEllipse(g, x + r * 0.02, y + r * 0.52, r * 0.42, r * 0.20);
      g.fillStyle(C.stem, a);
      line(g, x, y - r * 0.80, x + r * 0.06, y - r * 1.18, Math.max(2, r * 0.12), C.stem, a);
    } else {
      // 苹果：两瓣圆叠在一起，带果梗和小叶子
      g.fillStyle(p.dark, a);
      fillEllipse(g, x - r * 0.30, y + r * 0.04, r * 0.62, r * 0.72);
      fillEllipse(g, x + r * 0.30, y + r * 0.04, r * 0.62, r * 0.72);
      g.fillStyle(p.main, a);
      fillEllipse(g, x - r * 0.28, y - r * 0.02, r * 0.55, r * 0.66);
      fillEllipse(g, x + r * 0.28, y - r * 0.02, r * 0.55, r * 0.66);
      g.fillStyle(p.hi, 0.75 * a);
      fillEllipse(g, x - r * 0.38, y - r * 0.28, r * 0.14, r * 0.24);
      g.fillStyle(C.stem, a);
      line(g, x, y - r * 0.64, x + r * 0.08, y - r * 1.12, Math.max(2, r * 0.13), C.stem, a);
      g.fillStyle(C.leaf, a);
      fillEllipse(g, x + r * 0.33, y - r * 0.96, r * 0.27, r * 0.13);
      g.lineStyle(Math.max(1, r * 0.05), C.leafDark, 0.8 * a);
      strokePoly(g, [[x + r * 0.13, y - r * 0.95], [x + r * 0.52, y - r * 0.92]], false);
    }
  }

  // ---------------------------------------------------------------- 画：小松鼠
  // (x, y) 是身体中心；mood = idle / happy；blink 为 true 时闭眼
  function drawSquirrel(g, x, y, s, mood, blink, clock) {
    const wag = Math.sin((clock || 0) * 4.2) * 4 * s;
    // 大尾巴：从身后卷起来
    g.fillStyle(C.squirrelDark, 1);
    fillEllipse(g, x - 43 * s + wag, y + 2 * s, 24 * s, 34 * s);
    fillEllipse(g, x - 56 * s + wag, y - 22 * s, 22 * s, 26 * s);
    fillEllipse(g, x - 48 * s + wag, y - 45 * s, 17 * s, 19 * s);
    g.fillStyle(C.squirrel, 1);
    fillEllipse(g, x - 42 * s + wag, y + 1 * s, 18 * s, 27 * s);
    fillEllipse(g, x - 54 * s + wag, y - 23 * s, 16 * s, 20 * s);
    fillEllipse(g, x - 47 * s + wag, y - 45 * s, 12 * s, 14 * s);
    g.fillStyle(C.squirrelLight, 0.85);
    fillEllipse(g, x - 58 * s + wag, y - 24 * s, 7 * s, 12 * s);

    // 后脚 / 身体 / 前脚
    g.fillStyle(C.squirrelDark, 1);
    fillEllipse(g, x - 18 * s, y + 54 * s, 13 * s, 8 * s);
    fillEllipse(g, x + 18 * s, y + 54 * s, 13 * s, 8 * s);
    g.fillStyle(C.squirrel, 1);
    fillEllipse(g, x, y + 20 * s, 30 * s, 38 * s);
    g.fillStyle(C.squirrelLight, 0.9);
    fillEllipse(g, x, y + 27 * s, 17 * s, 25 * s);
    g.fillStyle(C.squirrel, 1);
    fillEllipse(g, x - 27 * s, y + 8 * s, 8 * s, 17 * s);
    fillEllipse(g, x + 27 * s, y + 8 * s, 8 * s, 17 * s);

    // 耳朵
    g.fillStyle(C.squirrelDark, 1);
    fillCircle(g, x - 18 * s, y - 43 * s, 11 * s);
    fillCircle(g, x + 18 * s, y - 43 * s, 11 * s);
    g.fillStyle(C.squirrel, 1);
    fillCircle(g, x - 18 * s, y - 44 * s, 8 * s);
    fillCircle(g, x + 18 * s, y - 44 * s, 8 * s);
    g.fillStyle(C.squirrelLight, 1);
    fillCircle(g, x - 18 * s, y - 44 * s, 4.5 * s);
    fillCircle(g, x + 18 * s, y - 44 * s, 4.5 * s);

    // 头
    g.fillStyle(C.squirrel, 1);
    fillCircle(g, x, y - 28 * s, 27 * s);
    g.fillStyle(C.squirrelLight, 1);
    fillEllipse(g, x, y - 14 * s, 15 * s, 11 * s);
    g.fillStyle(C.eye, 1);
    fillCircle(g, x, y - 18 * s, 3.2 * s);
    if (blink) {
      g.lineStyle(2.2 * s, C.eye, 1);
      line(g, x - 12 * s, y - 30 * s, x - 5 * s, y - 30 * s, 2.2 * s, C.eye, 1);
      line(g, x + 5 * s, y - 30 * s, x + 12 * s, y - 30 * s, 2.2 * s, C.eye, 1);
    } else {
      g.fillStyle(C.eye, 1);
      fillCircle(g, x - 9 * s, y - 30 * s, 4.2 * s);
      fillCircle(g, x + 9 * s, y - 30 * s, 4.2 * s);
      g.fillStyle(0xFFFFFF, 0.9);
      fillCircle(g, x - 10.4 * s, y - 31.4 * s, 1.4 * s);
      fillCircle(g, x + 7.6 * s, y - 31.4 * s, 1.4 * s);
    }
    g.fillStyle(C.squirrelDark, 1);
    fillCircle(g, x, y - 20 * s, 2.6 * s);
    if (mood === 'happy') {
      g.lineStyle(2.4 * s, C.eye, 1);
      g.beginPath();
      g.arc(x, y - 18 * s, 6 * s, 0.15 * Math.PI, 0.85 * Math.PI, false);
      g.strokePath();
    } else {
      g.lineStyle(2 * s, C.eye, 0.9);
      g.beginPath();
      g.arc(x, y - 17 * s, 5 * s, 0.2 * Math.PI, 0.8 * Math.PI, false);
      g.strokePath();
    }

    // 抱着的小手
    g.fillStyle(C.squirrelDark, 0.8);
    fillEllipse(g, x - 30 * s, y + 6 * s, 7 * s, 9 * s);
    fillEllipse(g, x + 30 * s, y + 6 * s, 7 * s, 9 * s);
    if (mood === 'happy') {
      // 开心时冒出两颗小爱心
      g.fillStyle(0xFF9AA8, 0.95);
      fillPoly(g, heartPts(x + 38 * s, y - 54 * s, 7 * s));
      fillPoly(g, heartPts(x - 40 * s, y - 66 * s, 4.5 * s));
    }
  }

  // ---------------------------------------------------------------- 画：盘子 / 篮子 / 托盘
  function drawPlate(g, x, y, r) {
    g.fillStyle(0x6B4A32, 0.10);
    fillEllipse(g, x + 4, y + r * 0.82, r * 0.94, r * 0.22);
    g.fillStyle(C.plateWoodDark, 1);
    fillCircle(g, x, y, r);
    g.fillStyle(C.plateWood, 1);
    fillCircle(g, x, y - 2, r * 0.94);
    g.fillStyle(C.plate, 0.96);
    fillCircle(g, x, y - 2, r * 0.80);
    g.lineStyle(3, C.plateLine, 0.9);
    strokeCircle(g, x, y - 2, r * 0.80);
    g.fillStyle(0xFFFFFF, 0.55);
    g.beginPath();
    g.arc(x - r * 0.14, y - r * 0.15, r * 0.62, Math.PI * 1.06, Math.PI * 1.55, false);
    g.strokePath();
    g.lineStyle(3, 0xFFFFFF, 0.45);
    g.beginPath();
    g.arc(x, y - 2, r * 0.72, Math.PI * 1.06, Math.PI * 1.52, false);
    g.strokePath();
  }

  function drawBasket(g, x, y, r) {
    g.fillStyle(0x6B4A32, 0.10);
    fillEllipse(g, x + 3, y + r * 0.60, r * 1.02, r * 0.25);
    g.fillStyle(C.basketDark, 1);
    fillEllipse(g, x, y + r * 0.30, r * 1.05, r * 0.52);
    fillPoly(g, [
      [x - r * 0.90, y - r * 0.05], [x + r * 0.90, y - r * 0.05],
      [x + r * 0.60, y + r * 0.72], [x - r * 0.60, y + r * 0.72],
    ]);
    g.fillStyle(C.basket, 1);
    fillEllipse(g, x, y + r * 0.06, r * 0.98, r * 0.38);
    fillPoly(g, [
      [x - r * 0.82, y + r * 0.04], [x + r * 0.82, y + r * 0.04],
      [x + r * 0.56, y + r * 0.58], [x - r * 0.56, y + r * 0.58],
    ]);
    g.lineStyle(2, C.basketDark, 0.55);
    for (let i = -2; i <= 2; i++) {
      line(g, x + i * r * 0.28, y + r * 0.10, x + i * r * 0.22, y + r * 0.54, 2, C.basketDark, 0.45);
    }
    line(g, x - r * 0.88, y + r * 0.10, x + r * 0.88, y + r * 0.10, 3, C.basketLight, 0.9);
    // 提手
    g.lineStyle(5, C.basketDark, 0.9);
    g.beginPath();
    g.arc(x, y - r * 0.28, r * 0.55, Math.PI * 1.08, Math.PI * 1.92, false);
    g.strokePath();
    g.lineStyle(3, C.basketLight, 0.9);
    g.beginPath();
    g.arc(x, y - r * 0.28, r * 0.55, Math.PI * 1.08, Math.PI * 1.92, false);
    g.strokePath();
  }

  function drawTray(g, L) {
    const t = L.tray;
    g.fillStyle(0x6B4A32, 0.13);
    g.fillRoundedRect(t.x + 5, t.y + 8, t.w, t.h, t.r);
    g.fillStyle(C.woodDark, 1);
    g.fillRoundedRect(t.x, t.y, t.w, t.h, t.r);
    g.fillStyle(C.wood, 1);
    g.fillRoundedRect(t.x + 5, t.y + 4, t.w - 10, t.h - 10, t.r - 4);
    g.fillStyle(0xFFF8EC, 0.48);
    g.fillRoundedRect(t.x + 14, t.y + 12, t.w - 28, t.h - 28, t.r - 8);
    g.lineStyle(2, C.woodLine, 0.55);
    for (let i = 0; i < 6; i++) {
      const yy = t.y + 28 + i * 52;
      line(g, t.x + 18, yy, t.x + 30, yy + 18, 2, C.woodLine, 0.34);
    }
    strokePoly(g, [[t.x + 26, t.y + 14], [t.x + 26, t.y + t.h - 14]], false);
    g.lineStyle(2, 0xFFFFFF, 0.30);
    strokePoly(g, [[t.x + t.w - 26, t.y + 14], [t.x + t.w - 26, t.y + t.h - 14]], false);
  }

  // ---------------------------------------------------------------- 画：背景与招牌
  function drawSky(g, L) {
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      g.fillStyle(blend(C.skyTop, C.skyBottom, t), 1);
      g.fillRect(0, (i * 300) / bands, WIDTH, 300 / bands + 1);
    }
    g.fillStyle(C.sunLight, 0.55);
    fillCircle(g, 462, 88, 48);
    g.fillStyle(C.sun, 0.95);
    fillCircle(g, 462, 88, 34);
    g.fillStyle(0xFFFFFF, 0.35);
    fillCircle(g, 453, 80, 12);
    // 远山
    g.fillStyle(C.hill1, 1);
    fillPoly(g, [[-30, 292], [100, 210], [220, 292]]);
    fillPoly(g, [[180, 292], [310, 198], [450, 292]]);
    fillPoly(g, [[390, 292], [520, 222], [600, 292]]);
    g.fillStyle(C.hill2, 1);
    fillPoly(g, [[60, 300], [190, 238], [330, 300]]);
    fillPoly(g, [[300, 300], [430, 244], [580, 300]]);
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 286, WIDTH, 26);
  }

  function drawTree(g, x, y, s, tone) {
    g.fillStyle(C.trunk, 1);
    g.fillRect(x - 4 * s, y - 6 * s, 8 * s, 34 * s);
    g.fillStyle(tone, 1);
    fillCircle(g, x, y - 16 * s, 21 * s);
    fillCircle(g, x - 16 * s, y - 4 * s, 16 * s);
    fillCircle(g, x + 16 * s, y - 4 * s, 16 * s);
    fillCircle(g, x, y + 2 * s, 17 * s);
    g.fillStyle(0xFFFFFF, 0.18);
    fillCircle(g, x - 7 * s, y - 21 * s, 6 * s);
  }

  function drawOrchard(g, L) {
    drawSky(g, L);
    drawTree(g, 62, 282, 1.05, C.tree2);
    drawTree(g, 132, 292, 1.35, C.tree1);
    drawTree(g, 430, 288, 1.2, C.tree3);
    drawTree(g, 500, 278, 0.92, C.tree1);
    drawTree(g, 350, 298, 0.78, C.tree2);
    // 木栅栏
    g.lineStyle(3, C.woodDark, 0.8);
    for (let i = 0; i < 9; i++) {
      const x = 36 + i * 60;
      g.fillStyle(C.woodDark, 0.85);
      fillPoly(g, [[x, 286], [x + 7, 286], [x + 7, 276], [x, 280]]);
    }
    line(g, 20, 282, 520, 282, 3, C.woodDark, 0.8);
    line(g, 20, 276, 520, 276, 2, C.woodDark, 0.55);
    // 草地
    g.fillStyle(C.grassDark, 1);
    g.fillRect(0, 296, WIDTH, 18);
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 290, WIDTH, 8);
    // 几丛小草
    for (let i = 0; i < 14; i++) {
      const x = 24 + i * 39;
      const y = 294 + (i % 2) * 4;
      g.lineStyle(2, C.grassDeep, 0.55);
      line(g, x, y, x - 4, y - 7, 2, C.grassDeep, 0.55);
      line(g, x + 2, y, x + 4, y - 9, 2, C.grassDeep, 0.55);
    }
  }

  function drawSign(g, L) {
    const s = L.sign;
    g.fillStyle(0x6B4A32, 0.16);
    g.fillRoundedRect(s.x + 4, s.y + 7, s.w, s.h, 16);
    g.fillStyle(C.signDark, 1);
    g.fillRoundedRect(s.x, s.y, s.w, s.h, 16);
    g.fillStyle(C.signBoard, 1);
    g.fillRoundedRect(s.x + 4, s.y + 4, s.w - 8, s.h - 8, 13);
    g.fillStyle(C.signLight, 1);
    g.fillRoundedRect(s.x + 12, s.y + 10, s.w - 24, 9, 4);
    g.lineStyle(2, 0xFFFFFF, 0.18);
    line(g, s.x + 22, s.y + 52, s.x + s.w - 28, s.y + 52, 2, 0xFFFFFF, 0.18);
    line(g, s.x + 34, s.y + 60, s.x + s.w - 42, s.y + 60, 2, 0xFFFFFF, 0.12);
    // 招牌两侧的小果子装饰
    g.fillStyle(C.apple, 1);
    fillCircle(g, s.x + 22, s.y + 18, 6);
    fillCircle(g, s.x + s.w - 22, s.y + 18, 6);
    g.fillStyle(C.leaf, 1);
    fillEllipse(g, s.x + 27, s.y + 12, 5, 2.5);
    fillEllipse(g, s.x + s.w - 27, s.y + 12, 5, 2.5);
  }

  function drawHud(g, L) {
    const h = L.hud;
    g.fillStyle(0x6B4A32, 0.13);
    g.fillRoundedRect(h.x + 2, h.y + 4, h.w, h.h, h.h / 2);
    g.fillStyle(C.hudBg, 1);
    g.fillRoundedRect(h.x, h.y, h.w, h.h, h.h / 2);
    g.lineStyle(2.5, C.hudLine, 1);
    g.strokeRoundedRect(h.x, h.y, h.w, h.h, h.h / 2);
    g.fillStyle(C.star, 1);
    fillPoly(g, starPts(h.x + 24, h.cy, 12, 5.2, 5));
    g.fillStyle(C.starDark, 1);
    fillCircle(g, h.x + 24, h.cy, 3.2);
  }

  function drawProgress(g, L, qi, correct, over) {
    const p = L.progress;
    const total = ROUND_SIZE;
    const x0 = p.cx - ((total - 1) * p.gap) / 2;
    for (let i = 0; i < total; i++) {
      const x = x0 + i * p.gap;
      const done = over || i < qi;
      const now = !over && i === qi;
      if (done) {
        g.fillStyle(C.apple, 1);
        fillCircle(g, x, p.y, p.r);
        g.fillStyle(0xFFFFFF, 0.45);
        fillCircle(g, x - 2, p.y - 2, p.r * 0.35);
      } else {
        g.fillStyle(C.plate, 0.9);
        fillCircle(g, x, p.y, p.r);
        g.lineStyle(now ? 3 : 2, now ? C.plus : C.plateLine, 1);
        strokeCircle(g, x, p.y, p.r);
      }
    }
  }

  // ---------------------------------------------------------------- 画：答案卡 / 结算卡
  function drawAnswerCard(g, card, state, hover, hintPulse) {
    const x = card.x - card.w / 2, y = card.y - card.h / 2;
    const lift = hover ? -4 : 0;
    const breathe = hintPulse ? 1 + Math.sin(hintPulse * 5.5) * 0.025 : 1;
    const w = card.w * breathe, h = card.h * breathe;
    const xx = card.x - w / 2, yy = card.y - h / 2 + lift;
    g.fillStyle(0x6B4A32, 0.16);
    g.fillRoundedRect(xx + 4, yy + 7, w, h, 18);
    g.fillStyle(state === 'correct' ? 0xEDF8E8 : C.card, 1);
    g.fillRoundedRect(xx, yy, w, h, 18);
    const border = state === 'correct' ? C.ok : (state === 'wrong' ? C.minus : (hover ? C.plus : C.cardLine));
    g.lineStyle(state === 'idle' && !hover ? 2.5 : 4, border, 1);
    g.strokeRoundedRect(xx, yy, w, h, 18);
    g.fillStyle(state === 'correct' ? C.ok : (state === 'wrong' ? C.minus : C.woodLine), 0.16);
    g.fillRoundedRect(xx + 9, yy + 9, w - 18, 18, 9);
    if (state === 'correct') {
      g.fillStyle(C.ok, 1);
      fillCircle(g, xx + w - 18, yy + 18, 17);
      g.lineStyle(3.5, 0xFFFFFF, 1);
      strokePoly(g, [[xx + w - 27, yy + 18], [xx + w - 21, yy + 25], [xx + w - 9, yy + 10]], false);
      g.fillStyle(C.okDark, 0.18);
      fillCircle(g, card.x, card.y + 8, 44);
    }
    if (state === 'wrong') {
      g.lineStyle(4, C.minus, 0.9);
      line(g, xx + 22, yy + 22, xx + 38, yy + 38, 4, C.minus, 0.9);
      line(g, xx + 38, yy + 22, xx + 22, yy + 38, 4, C.minus, 0.9);
    }
  }

  function drawOverlayCard(g, L) {
    const r = L.cardRect;
    g.fillStyle(C.cardDim, 0.48);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0x6B4A32, 0.18);
    g.fillRoundedRect(r.x + 5, r.y + 8, r.w, r.h, 26);
    g.fillStyle(C.card, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 26);
    g.lineStyle(3, C.cardLine, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 26);
    g.fillStyle(C.wood, 0.55);
    g.fillRoundedRect(r.x + 14, r.y + 14, r.w - 28, 54, 18);
    // 星星
    g.fillStyle(C.star, 1);
    fillPoly(g, starPts(r.x + 185, r.y + 182, 26, 11, 5));
    // 按钮
    g.fillStyle(C.cardBtn, 1);
    g.fillRoundedRect(WIDTH / 2 - 112, r.y + 265, 224, 58, 29);
    g.fillStyle(0xFFFFFF, 0.18);
    g.fillRoundedRect(WIDTH / 2 - 102, r.y + 272, 204, 16, 8);
  }

  function drawEquationBox(g, L, state) {
    const e = L.eq;
    const x = e.cx + 90, y = e.cy;
    const w = e.boxW, h = e.boxH;
    g.fillStyle(0xFFFFFF, 0.86);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 16);
    g.lineStyle(3, state === 'correct' ? C.ok : C.woodDark, 0.9);
    if (state !== 'correct') {
      strokeDashedRect(g, x - w / 2, y - h / 2, w, h, C.woodDark, 3, 10, 7, 0.9);
    } else {
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 16);
      g.fillStyle(C.ok, 0.12);
      g.fillRoundedRect(x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 13);
    }
    return { x: x, y: y, w: w, h: h };
  }

  function drawRecount(g, L, hover) {
    const r = L.recount;
    g.fillStyle(0x6B4A32, 0.14);
    g.fillRoundedRect(r.x - r.w / 2 + 3, r.y - r.h / 2 + 5, r.w, r.h, r.h / 2);
    g.fillStyle(hover ? 0xFFFDF8 : C.hudBg, 1);
    g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
    g.lineStyle(2.5, hover ? C.plus : C.hudLine, 1);
    g.strokeRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
    g.fillStyle(C.plus, 0.18);
    fillCircle(g, r.x - r.w / 2 + 30, r.y, 15);
    g.lineStyle(2.4, C.plus, 1);
    g.beginPath();
    g.arc(r.x - r.w / 2 + 30, r.y, 7, Math.PI * 1.05, Math.PI * 1.95, false);
    g.strokePath();
  }

  function drawTipBubble(g, L, w, h, alpha) {
    const t = L.tip;
    g.fillStyle(C.tipBg, 0.97 * alpha);
    g.fillRoundedRect(t.x - w / 2, t.y - h / 2, w, h, h / 2);
    g.lineStyle(2.5, C.tipLine, alpha);
    g.strokeRoundedRect(t.x - w / 2, t.y - h / 2, w, h, h / 2);
    g.fillStyle(C.tipBg, 0.97 * alpha);
    fillPoly(g, [[t.x - 8, t.y + h / 2 - 1], [t.x + 8, t.y + h / 2 - 1], [t.x, t.y + h / 2 + 10]]);
  }
  // ---------------------------------------------------------------- 出题器
  // 第 1、2 题只出加法；从第 3 题起加减交替：
  // qi 0,1 add；2 sub；3 add；4 sub；5 add；6 sub；7 add；8 sub；9 add
  // 一轮正好 6 道加法 + 4 道减法。
  const OP_SEQUENCE = (function () {
    const out = [];
    for (let qi = 0; qi < ROUND_SIZE; qi++) {
      out.push(qi < 2 ? 'add' : (qi % 2 === 0 ? 'sub' : 'add'));
    }
    return out;
  })();

  function capFor(correct) {
    // ?????????? 10 ??????? 5,5,6,6,7,7,8,8,9,10?
    if (correct >= ROUND_SIZE - 1) return CAP_MAX;
    return Math.min(CAP_MAX, CAP_MIN + Math.floor(Math.max(0, correct) / CAP_STEP));
  }

  function shuffleArr(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function answerChoices(ans) {
    const pool = [];
    const near = [-1, 1, -2, 2, -3, 3];
    for (let i = 0; i < near.length; i++) {
      const v = clamp(ans + near[i], 0, 10);
      if (v !== ans && pool.indexOf(v) < 0) pool.push(v);
    }
    for (let v = 0; v <= 10 && pool.length < 6; v++) {
      if (v !== ans && pool.indexOf(v) < 0) pool.push(v);
    }
    shuffleArr(pool);
    const choices = [ans, pool[0], pool[1]];
    return shuffleArr(choices);
  }

  function questionKey(q) { return q.op + ':' + q.a + ':' + q.b; }

  function usedHas(used, key) {
    if (!used) return false;
    for (let i = 0; i < used.length; i++) {
      const u = used[i];
      if (typeof u === 'string') { if (u === key) return true; }
      else if (u && questionKey(u) === key) return true;
    }
    return false;
  }

  // 纯函数：给定题号、数字上限、已用题目，产出一道完整的题。
  // 题目一定合法；候选用完时按固定顺序回退（不抛异常、不卡住）。
  function buildQuestion(qi, cap, used) {
    const lim = clamp(cap || CAP_MIN, 3, CAP_MAX);
    const op = OP_SEQUENCE[((qi % ROUND_SIZE) + ROUND_SIZE) % ROUND_SIZE];
    const candidates = [];
    if (op === 'add') {
      for (let a = 1; a <= lim - 1; a++) {
        for (let b = 1; b <= lim - a; b++) {
          if (a + b >= 3) candidates.push({ op: 'add', a: a, b: b });
        }
      }
    } else {
      for (let a = 3; a <= lim; a++) {
        const top = Math.min(SUB_MAX, a - 1);
        for (let b = 1; b <= top; b++) {
          if (a - b >= 1) candidates.push({ op: 'sub', a: a, b: b });
        }
      }
    }
    if (candidates.length === 0) {
      // 兜底：即使调用方传来奇怪的上限，也一定给一道合法题
      candidates.push(op === 'add' ? { op: 'add', a: 1, b: 2 } : { op: 'sub', a: 3, b: 1 });
    }
    const fresh = candidates.filter(function (q) { return !usedHas(used, questionKey(q)); });
    const pick = fresh.length > 0
      ? fresh[Math.floor(Math.random() * fresh.length)]
      : candidates[0];
    const answer = pick.op === 'add' ? pick.a + pick.b : pick.a - pick.b;
    return {
      op: pick.op, a: pick.a, b: pick.b, answer: answer,
      choices: answerChoices(answer), cap: lim,
      key: questionKey(pick),
    };
  }
  // ---------------------------------------------------------------- 音效
  // 全部 WebAudio 合成：没有背景音乐、没有语音、没有音量按钮。
  const Sound = (function () {
    let ctx = null;
    let master = null;
    let on = true;

    function ensure() {
      if (!on) return null;
      if (ctx) return ctx;
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) { on = false; return null; }
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.30;
        master.connect(ctx.destination);
      } catch (e) { on = false; ctx = null; }
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

    function noise(dur, vol, when, f0, f1) {
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
      filt.Q.value = 1.1;
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
      pick: function () { tone(660, 0.07, 0.042, 0, 'triangle'); noise(0.04, 0.018, 0, 1200, 700); },
      place: function () { tone(520, 0.07, 0.04, 0, 'triangle'); noise(0.05, 0.025, 0, 900, 420); },
      drop: function () { noise(0.16, 0.04, 0, 1200, 420); tone(320, 0.08, 0.022, 0, 'sine'); },
      right: function () {
        const notes = [0, 4, 7];
        for (let i = 0; i < notes.length; i++) tone(523.25 * Math.pow(2, notes[i] / 12), 0.17, 0.05, i * 0.08, 'sine');
      },
      wrong: function () { tone(300, 0.16, 0.045, 0, 'sine'); tone(238, 0.20, 0.038, 0.12, 'sine'); },
      count: function (n, when) {
        const step = Math.max(0, (n || 1) - 1);
        const f = 520 * Math.pow(2, Math.min(12, step) / 12);
        tone(f, 0.09, 0.04, when || 0, 'triangle');
        noise(0.035, 0.015, when || 0, 1500, 800);
      },
      next: function () { tone(620, 0.07, 0.03, 0, 'sine'); tone(780, 0.08, 0.026, 0.06, 'sine'); },
      squeak: function () { tone(1120, 0.07, 0.03, 0, 'triangle'); tone(1420, 0.06, 0.022, 0.04, 'triangle'); },
      end: function () {
        const notes = [0, 4, 7, 11];
        for (let i = 0; i < notes.length; i++) {
          const f = 261.63 * Math.pow(2, notes[i] / 12);
          tone(f, 1.35, 0.06, i * 0.10, 'sine');
          tone(f * 2, 0.9, 0.018, i * 0.10, 'sine');
        }
      },
    };
  })();
  // ---------------------------------------------------------------- 场景
  class OrchardScene extends Phaser.Scene {
    constructor() {
      super('OrchardScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT, ROUND_SIZE: ROUND_SIZE,
        CAP_MIN: CAP_MIN, CAP_MAX: CAP_MAX, CAP_STEP: CAP_STEP,
        ANSWER_CARDS: ANSWER_CARDS, SUB_MAX: SUB_MAX,
        FRUIT_R: FRUIT_R, FRUIT_DX: FRUIT_DX, FRUIT_DY: FRUIT_DY,
        CARD_W: CARD_W, CARD_H: CARD_H, CARD_Y: CARD_Y,
        REVEAL_SEC: REVEAL_SEC, END_DELAY_SEC: END_DELAY_SEC, TAP_LOCK_SEC: TAP_LOCK_SEC,
        WRONG_COUNT_DELAY: WRONG_COUNT_DELAY, COUNT_STEP: COUNT_STEP, COUNT_HOLD: COUNT_HOLD,
        OP_SEQUENCE: OP_SEQUENCE.slice(),
        FRUIT_KINDS: FRUIT_KINDS.slice(),
        DRAG_SCALE: DRAG_SCALE, DRAG_LIFT: DRAG_LIFT,
        DEPTH: DEPTH,
      };
      this.PALETTE = C;
      this.FRUIT_KINDS = FRUIT_KINDS;
      this.capFor = capFor;

      this.phase = 'play';
      this.clock = 0;
      this.qi = 0;
      this.cap = capFor(0);
      this.stars = 0;
      this.correct = 0;
      this.firstTry = 0;
      this.wrongTries = 0;
      this.triesThis = 0;
      this.usedKeys = [];
      this.question = buildQuestion(0, this.cap, this.usedKeys);
      this.usedKeys.push(this.question.key);
      this.merged = false;
      this.busy = false;
      this.hintOn = false;
      this.revealT = 0;
      this.endT = -1;
      this.countT = -1;
      this.tapLockUntil = 0;
      this.liveProps = [];
      this.cardState = ['idle', 'idle', 'idle'];
      this.celebT = 0;
      this.correctIdx = -1;
      this.shakeIdx = -1;
      this.shakeT = 0;
      this.hoverCard = -1;
      this.hoverRecount = false;
      this.returnT = 0;
      this.returnGroup = [];
      this.returnKind = null;
      this.returnDX = 0;
      this.returnDY = 0;
      this.drag = null;
      this.dragId = -1;
      this.squirrelWag = 0;
      this.hudPop = 0;
      this.tipT = 0;
      this.tipMsg = '';
      this.hintT = 0;
      this.celebT = 0;
      this.shownAddTip = false;
      this.shownSubTip = false;

      // -------------------------------------------------- 静态背景
      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawOrchard(this.worldG, this.L);
      this.trayG = this.add.graphics().setDepth(DEPTH.tray);
      drawTray(this.trayG, this.L);
      this.signG = this.add.graphics().setDepth(DEPTH.tray);
      drawSign(this.signG, this.L);
      this.signText = this.add.text(this.L.sign.cx, this.L.sign.cy - 2, '果园算一算', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.signText,
        stroke: '#FFF6E8', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH.tray + 1);

      // -------------------------------------------------- 盘子 / 果子（每帧重画）
      this.plateG = this.add.graphics().setDepth(DEPTH.fruit);

      // -------------------------------------------------- 算式
      this.eqA = this.add.text(152, this.L.eq.cy, '', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#5C4A38',
      }).setOrigin(0.5).setDepth(DEPTH.equation);
      this.eqOp = this.add.text(208, this.L.eq.cy, '+', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#F09A3E',
      }).setOrigin(0.5).setDepth(DEPTH.equation);
      this.eqB = this.add.text(264, this.L.eq.cy, '', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#5C4A38',
      }).setOrigin(0.5).setDepth(DEPTH.equation);
      this.eqEq = this.add.text(312, this.L.eq.cy, '=', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#5C4A38',
      }).setOrigin(0.5).setDepth(DEPTH.equation);
      this.eqG = this.add.graphics().setDepth(DEPTH.equation);
      this.eqAns = this.add.text(this.L.eq.cx + 90, this.L.eq.cy, '?', {
        fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#5C4A38',
      }).setOrigin(0.5).setDepth(DEPTH.equation + 1);

      // -------------------------------------------------- 答案卡
      this.cardGs = [];
      this.cardTexts = [];
      for (let i = 0; i < ANSWER_CARDS; i++) {
        this.cardGs.push(this.add.graphics().setDepth(DEPTH.cards));
        this.cardTexts.push(this.add.text(this.L.cards[i].x, this.L.cards[i].y + 6, '', {
          fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#5C4A38',
        }).setOrigin(0.5).setDepth(DEPTH.cards + 1));
      }

      // -------------------------------------------------- 进度 / HUD / 提示
      this.progressG = this.add.graphics().setDepth(DEPTH.hud);
      this.hudG = this.add.graphics().setDepth(DEPTH.hud);
      drawHud(this.hudG, this.L);
      this.hudText = this.add.text(this.L.hud.x + 48, this.L.hud.cy, '0', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.hudText,
      }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);

      this.hintText = this.add.text(this.L.hint.x, this.L.hint.y, '数一数，点下面的数字卡', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: C.hintText,
        stroke: C.hintStroke, strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.hud);

      this.recountG = this.add.graphics().setDepth(DEPTH.cards);
      this.recountText = this.add.text(this.L.recount.x + 12, this.L.recount.y, '再数一遍', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: C.hudText,
      }).setOrigin(0.5).setDepth(DEPTH.cards + 1);

      this.tipG = this.add.graphics().setDepth(DEPTH.hud + 1);
      this.tipText = this.add.text(this.L.tip.x, this.L.tip.y, '', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: C.tipText,
      }).setOrigin(0.5).setDepth(DEPTH.hud + 2);
      this.tipG.setVisible(false);
      this.tipText.setVisible(false);

      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.ghostG = this.add.graphics().setDepth(DEPTH.ghost);
      this.ghostG.setVisible(false);

      // -------------------------------------------------- 结算卡
      this.overlayG = this.add.graphics().setDepth(DEPTH.card);
      drawOverlayCard(this.overlayG, this.L);
      const cr = this.L.cardRect;
      this.cardTitle = this.add.text(WIDTH / 2, cr.y + 58, '今天算完啦！', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.cardTitle,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardBig = this.add.text(WIDTH / 2 + 30, cr.y + 182, '0', {
        fontFamily: FONT, fontSize: '50px', fontStyle: 'bold', color: '#E8A33A',
      }).setOrigin(0.5, 0.5).setDepth(DEPTH.card + 1);
      this.cardSub = this.add.text(WIDTH / 2, cr.y + 232, '', {
        fontFamily: FONT, fontSize: '18px', color: C.cardSub,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardBtn = this.add.text(WIDTH / 2, cr.y + 294, '再玩一次', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.cardBtnText,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardTip = this.add.text(WIDTH / 2, cr.y + 350, '点屏幕也可以', {
        fontFamily: FONT, fontSize: '15px', color: C.cardSub,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardHint = this.add.text(WIDTH / 2 - 20, cr.y + 182, '', {
        fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: '#E8A33A',
      }).setOrigin(0, 0.5).setDepth(DEPTH.card + 1);
      this.cardHint.setVisible(false);
      this.setOverlayVisible(false);

      // -------------------------------------------------- 输入
      this.input.on('pointerdown', function (p) { this.onDown(p); }, this);
      this.input.on('pointermove', function (p) { this.onMove(p); }, this);
      this.input.on('pointerup', function (p) { this.onUp(p); }, this);
      this.input.on('pointerupoutside', function (p) { this.onUp(p); }, this);

      this.syncQuestion();
      this.maybeShowTip();
    }

    setOverlayVisible(v) {
      this.overlayG.setVisible(v);
      this.cardTitle.setVisible(v);
      this.cardBig.setVisible(v);
      this.cardSub.setVisible(v);
      this.cardBtn.setVisible(v);
      this.cardTip.setVisible(v);
      this.cardHint.setVisible(v);
    }

    makeQuestion(qi, cap, used) {
      return buildQuestion(qi, cap, used || []);
    }

    fruitKind() {
      return FRUIT_KINDS[((this.qi % FRUIT_KINDS.length) + FRUIT_KINDS.length) % FRUIT_KINDS.length];
    }

    // 当前题的分组：加法是左盘 a + 右盘 b；减法是大盘 a，其中最后 b 个是虚影，篮子里 b 个实心。
    groups() {
      const q = this.question;
      const kind = this.fruitKind();
      if (q.op === 'add') {
        const left = this.L.add.left, right = this.L.add.right;
        let leftPts = fruitPositions(q.a, left.x, left.y);
        let rightPts = fruitPositions(q.b, right.x, right.y);
        if (this.merged) {
          leftPts = fruitPositions(q.a + q.b, left.x, left.y);
          rightPts = [];
        }
        return {
          kind: kind, left: leftPts, right: rightPts, ghost: [], basket: [],
          count: this.merged ? leftPts.slice() : leftPts.concat(rightPts),
          countTotal: q.a + q.b,
          countCenter: { x: this.merged ? left.x : (left.x + right.x) / 2, y: left.y - 96 },
          dragGroup: this.merged ? [] : fruitPositions(q.b, right.x, right.y),
          dragSource: 'right',
          target: { x: left.x, y: left.y, r: left.r * 0.86, label: '合起来' },
        };
      }
      const plate = this.L.sub.plate, basket = this.L.sub.basket;
      const pts = fruitPositions(q.a, plate.x, plate.y);
      const solid = pts.slice(0, q.a - q.b);
      const ghost = this.merged ? [] : pts.slice(q.a - q.b);
      const basketPts = fruitPositions(q.b, basket.x, basket.y - 4, 38);
      return {
        kind: kind, left: solid, right: [], ghost: ghost, basket: basketPts,
        count: solid.slice(), countTotal: q.a - q.b,
        countCenter: { x: plate.x, y: plate.y - 102 },
        dragGroup: this.merged ? [] : ghost.slice(),
        dragSource: 'ghost',
        target: { x: basket.x, y: basket.y, r: basket.r * 0.96, label: '放进篮子' },
      };
    }

    syncQuestion() {
      const q = this.question;
      this.cap = q.cap;
      this.eqA.setText(String(q.a));
      this.eqB.setText(String(q.b));
      this.eqOp.setText(q.op === 'add' ? '+' : '−');
      this.eqOp.setStyle({ fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: q.op === 'add' ? '#F09A3E' : '#E1788A' });
      this.eqAns.setText(this.correctIdx >= 0 ? String(q.answer) : '?');
      this.eqAns.setStyle({ fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: this.correctIdx >= 0 ? '#4F7A3C' : '#5C4A38' });
      for (let i = 0; i < ANSWER_CARDS; i++) {
        this.cardTexts[i].setText(String(q.choices[i]));
      }
      this.cardTexts.forEach(function (t) { t.setVisible(true); });
      this.correctIdx = -1;
      this.shakeIdx = -1;
      this.shakeT = 0;
      this.hintOn = false;
      this.busy = false;
      this.merged = false;
      this.triesThis = 0;
      this.cardState = ['idle', 'idle', 'idle'];
      this.celebT = 0;
      this.returnT = 0;
      this.returnGroup = [];
      this.setOverlayVisible(false);
    }

    maybeShowTip() {
      if (this.qi === 0 && !this.shownAddTip) {
        this.shownAddTip = true;
        this.showTip('把它们推到一起');
      } else if (this.qi === 2 && !this.shownSubTip) {
        this.shownSubTip = true;
        this.showTip('小松鼠拿走了 ' + this.question.b + ' 个');
      }
    }

    showTip(msg, hold) {
      this.tipMsg = msg;
      this.tipT = hold === undefined ? TIP_HOLD_SEC : hold;
      if (this.tipText) this.tipText.setText(msg);
    }

    // -------------------------------------------------- 判分
    answer(choiceIdx) {
      if (this.phase !== 'play' || this.busy) return 'busy';
      if (choiceIdx === undefined || choiceIdx === null) return 'busy';
      const idx = Math.floor(choiceIdx);
      if (idx < 0 || idx >= ANSWER_CARDS) return 'busy';
      if (this.question.choices[idx] === this.question.answer) {
        if (this.triesThis === 0) this.firstTry += 1;
        this.stars += 1;
        this.correct += 1;
        this.correctIdx = idx;
        this.cardState[idx] = 'correct';
        this.cardState[(idx + 1) % 3] = 'idle';
        this.cardState[(idx + 2) % 3] = 'idle';
        this.hintOn = false;
        this.countT = -1;
        this.clearCountFx();
        if (!this.merged) this.mergeGroup();
        this.tipT = Math.min(this.tipT, 0.7);
        this.busy = true;
        this.eqAns.setText(String(this.question.answer));
        this.eqAns.setStyle({ fontFamily: FONT, fontSize: '54px', fontStyle: 'bold', color: '#4F7A3C' });
        this.hudPop = 0.45;
        this.celebT = 0.9;
        this.spawnSparkle(this.groups().countCenter.x, this.groups().countCenter.y + 58);
        Sound.right();
        if (this.qi >= ROUND_SIZE - 1) {
          this.endT = END_DELAY_SEC;
        } else {
          this.revealT = REVEAL_SEC;
        }
        return 'ok';
      }
      this.wrongTries += 1;
      this.triesThis += 1;
      this.shakeIdx = idx;
      this.shakeT = 0.3;
      this.cardState[idx] = 'wrong';
      if (this.triesThis >= 2) this.hintOn = true;
      this.countT = WRONG_COUNT_DELAY;
      Sound.wrong();
      return 'wrong';
    }

    // 把可以拖的那一组（加法右盘 / 减法虚影）合并进目标区。
    mergeGroup() {
      if (this.merged || this.phase !== 'play') return false;
      const g = this.groups();
      const from = g.dragGroup;
      if (!from || from.length === 0) return false;
      const q = this.question;
      let dest;
      if (q.op === 'add') {
        const all = fruitPositions(q.a + q.b, this.L.add.left.x, this.L.add.left.y);
        dest = all.slice(q.a);
      } else {
        dest = g.basket;
      }
      for (let i = 0; i < from.length; i++) {
        const d = dest[Math.min(i, dest.length - 1)];
        this.spawnFlyFruit(from[i].x, from[i].y, d ? d.x : g.target.x, d ? d.y : g.target.y, i * 0.045);
      }
      this.merged = true;
      Sound.place();
      this.showTip(q.op === 'add' ? '合起来啦！' : '小松鼠拿走啦', 1.1);
      return true;
    }

    // -------------------------------------------------- 点数
    clearCountFx() {
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const o = this.liveProps[i];
        if (o.kind !== 'badge' && o.kind !== 'total' && o.kind !== 'halo') continue;
        if (o.g && o.g.destroy) o.g.destroy();
        if (o.txt && o.txt.destroy) o.txt.destroy();
        this.liveProps.splice(i, 1);
      }
    }

    countAll() {
      if (this.phase !== 'play') return 0;
      this.clearCountFx();
      const g = this.groups();
      const pts = g.count;
      for (let i = 0; i < pts.length; i++) {
        this.spawnCountBadge(pts[i].x, pts[i].y - FRUIT_R - 8, i + 1, i * COUNT_STEP);
        this.spawnCountHalo(pts[i].x, pts[i].y, i * COUNT_STEP);
        Sound.count(i + 1, i * COUNT_STEP);
      }
      const totalDelay = Math.max(0.2, (pts.length - 1) * COUNT_STEP + 0.42);
      this.spawnTotalFlash(g.countCenter.x, g.countCenter.y, g.countTotal, totalDelay);
      return pts.length;
    }

    // -------------------------------------------------- 翻题 / 结算 / 重开
    nextQuestion() {
      if (this.phase !== 'play') return false;
      if (this.qi >= ROUND_SIZE - 1) {
        if (this.endT < 0) this.endT = END_DELAY_SEC;
        return false;
      }
      this.qi += 1;
      this.cap = capFor(this.correct);
      this.question = this.makeQuestion(this.qi, this.cap, this.usedKeys);
      this.usedKeys.push(this.question.key);
      this.syncQuestion();
      this.revealT = 0;
      this.countT = -1;
      this.clearCountFx();
      if (this.tipMsg === '合起来啦！' || this.tipMsg === '小松鼠拿走啦') this.tipT = 0;
      Sound.next();
      this.maybeShowTip();
      return true;
    }

    showCard() {
      this.phase = 'over';
      this.cardBig.setText(String(this.stars));
      this.cardHint.setText('');
      this.cardHint.setVisible(false);
      this.cardSub.setText(ROUND_SIZE + ' 道题 · 其中 ' + this.firstTry + ' 道一次就对');
      this.setOverlayVisible(true);
      this.tapLockUntil = this.clock + TAP_LOCK_SEC;
      Sound.end();
    }

    tryRestart() {
      if (this.phase !== 'over') return false;
      if (this.clock < this.tapLockUntil) return false;
      this.resetRound();
      return true;
    }

    resetRound() {
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const o = this.liveProps[i];
        if (o.g && o.g.destroy) o.g.destroy();
        if (o.txt && o.txt.destroy) o.txt.destroy();
      }
      this.liveProps = [];
      this.phase = 'play';
      this.clock = 0;
      this.qi = 0;
      this.cap = capFor(0);
      this.stars = 0;
      this.correct = 0;
      this.firstTry = 0;
      this.wrongTries = 0;
      this.triesThis = 0;
      this.usedKeys = [];
      this.question = buildQuestion(0, this.cap, this.usedKeys);
      this.usedKeys.push(this.question.key);
      this.merged = false;
      this.busy = false;
      this.hintOn = false;
      this.revealT = 0;
      this.endT = -1;
      this.countT = -1;
      this.tapLockUntil = 0;
      this.cardState = ['idle', 'idle', 'idle'];
      this.celebT = 0;
      this.correctIdx = -1;
      this.shakeIdx = -1;
      this.shakeT = 0;
      this.hoverCard = -1;
      this.hoverRecount = false;
      this.returnT = 0;
      this.returnGroup = [];
      this.returnKind = null;
      this.returnDX = 0;
      this.returnDY = 0;
      this.drag = null;
      this.dragId = -1;
      this.squirrelWag = 0;
      this.hudPop = 0;
      this.tipT = 0;
      this.tipMsg = '';
      this.hintT = 0;
      this.celebT = 0;
      this.shownAddTip = false;
      this.shownSubTip = false;
      this.hintText.setAlpha(1);
      this.ghostG.setVisible(false);
      this.setOverlayVisible(false);
      this.syncQuestion();
      this.maybeShowTip();
    }

    // -------------------------------------------------- 输入
    onDown(p) {
      if (!p) return;
      Sound.resume();
      if (this.phase === 'over') { this.tryRestart(); return; }
      if (this.busy || this.phase !== 'play') return;
      const x = p.x, y = p.y;

      // 「再数一遍」
      const rr = this.L.recount;
      if (Math.abs(x - rr.x) <= rr.w / 2 + 8 && Math.abs(y - rr.y) <= rr.h / 2 + 8) {
        this.countAll();
        return;
      }
      // 答案卡
      for (let i = 0; i < ANSWER_CARDS; i++) {
        const c = this.L.cards[i];
        if (Math.abs(x - c.x) <= c.w / 2 && Math.abs(y - c.y) <= c.h / 2) {
          this.answer(i);
          return;
        }
      }
      // 小松鼠：点它「吱」一声摇尾巴（不耽误答题）
      const sq = this.question.op === 'add' ? this.L.add.squirrel : this.L.sub.squirrel;
      if (Math.abs(x - sq.x) <= 52 * sq.s && Math.abs(y - sq.y) <= 64 * sq.s) {
        this.squirrelWag = 0.75;
        Sound.squeak();
        this.spawnHeart(sq.x + 22, sq.y - 54);
        return;
      }
      // 拖动：按住加法右盘 / 减法的虚影果
      if (!this.merged) {
        const g = this.groups();
        let hit = false;
        if (this.question.op === 'add') {
          const right = this.L.add.right;
          hit = dist2(x, y, right.x, right.y) <= right.r * right.r * 0.92;
        } else {
          for (let i = 0; i < g.dragGroup.length; i++) {
            if (dist2(x, y, g.dragGroup[i].x, g.dragGroup[i].y) <= 34 * 34) { hit = true; break; }
          }
        }
        if (hit) {
          this.returnT = 0;
          this.returnGroup = [];
          this.drag = {
            kind: this.question.op, group: g.dragGroup.slice(), from: g.dragSource,
            x: x, y: y, sx: x, sy: y, target: g.target,
          };
          this.dragId = p.id === undefined ? -1 : p.id;
          Sound.pick();
        }
      }
    }

    onMove(p) {
      if (!p) return;
      if (this.drag) {
        if (this.dragId >= 0 && p.id !== undefined && p.id !== this.dragId) return;
        this.drag.x = p.x;
        this.drag.y = p.y;
        return;
      }
      this.hoverCard = -1;
      for (let i = 0; i < ANSWER_CARDS; i++) {
        const c = this.L.cards[i];
        if (Math.abs(p.x - c.x) <= c.w / 2 && Math.abs(p.y - c.y) <= c.h / 2) this.hoverCard = i;
      }
      this.hoverRecount = Math.abs(p.x - this.L.recount.x) <= this.L.recount.w / 2 + 8
        && Math.abs(p.y - this.L.recount.y) <= this.L.recount.h / 2 + 8;
    }

    onUp(p) {
      if (!this.drag) return;
      if (this.dragId >= 0 && p && p.id !== undefined && p.id !== this.dragId) return;
      const d = this.drag;
      const x = p && p.x !== undefined ? p.x : d.x;
      const y = p && p.y !== undefined ? p.y : d.y;
      this.drag = null;
      this.dragId = -1;
      const t = d.target;
      if (dist2(x, y, t.x, t.y) <= t.r * t.r) {
        this.mergeGroup();
      } else {
        this.returnT = 0.26;
        this.returnGroup = d.group.slice();
        this.returnKind = d.kind;
        this.returnDX = x - d.sx;
        this.returnDY = y - d.sy - DRAG_LIFT;
        Sound.drop();
      }
    }

    // -------------------------------------------------- 特效
    trackObj(o) { this.liveProps.push(o); return o; }
    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
      return o;
    }

    spawnFlyFruit(x0, y0, x1, y1, delay) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      return this.trackObj({
        g: g, kind: 'fly', t: 0, delay: delay || 0, dur: 0.38,
        x0: x0, y0: y0, x1: x1, y1: y1, kindFruit: this.fruitKind(),
      });
    }

    spawnSparkle(x, y) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      const parts = [];
      const cols = [C.star, 0xFF9AA8, C.leaf, C.plus, C.star];
      for (let i = 0; i < 5; i++) {
        parts.push({
          dx: (i - 2) * 24 + (Math.random() - 0.5) * 8,
          dy: -22 - Math.random() * 20,
          s: 6 + Math.random() * 3,
          color: cols[i],
        });
      }
      return this.trackObj({ g: g, kind: 'sparkle', t: 0, dur: 0.8, x: x, y: y, parts: parts });
    }

    spawnHeart(x, y) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      return this.trackObj({ g: g, kind: 'heart', t: 0, dur: 0.75, x: x, y: y });
    }

    spawnCountHalo(x, y, delay) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      return this.trackObj({
        g: g, kind: 'halo', t: 0, delay: delay || 0, dur: 0.55, x: x, y: y,
      });
    }

    spawnCountBadge(x, y, num, delay) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      const txt = this.add.text(x, y, String(num), {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
      txt.setAlpha(0);
      return this.trackObj({
        g: g, txt: txt, kind: 'badge', t: 0, delay: delay || 0, dur: 0.62,
        x: x, y: y, num: num,
      });
    }

    spawnTotalFlash(x, y, total, delay) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      const txt = this.add.text(x, y, String(total), {
        fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#E8A33A',
        stroke: '#FFF6E8', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
      txt.setAlpha(0);
      return this.trackObj({
        g: g, txt: txt, kind: 'total', t: 0, delay: delay || 0, dur: 1.05,
        x: x, y: y, num: total,
      });
    }
    // -------------------------------------------------- 每帧推进
    step(dt) {
      this.clock += dt;
      this.capFor = capFor;
      if (this.hudPop > 0) this.hudPop = Math.max(0, this.hudPop - dt * 1.5);
      if (this.celebT > 0) this.celebT = Math.max(0, this.celebT - dt);
      if (this.returnT > 0) this.returnT = Math.max(0, this.returnT - dt);
      if (this.squirrelWag > 0) this.squirrelWag = Math.max(0, this.squirrelWag - dt);
      if (this.tipT > 0) this.tipT = Math.max(0, this.tipT - dt);
      if (this.shakeT > 0) {
        this.shakeT = Math.max(0, this.shakeT - dt);
        if (this.shakeT === 0 && this.shakeIdx >= 0) {
          this.cardState[this.shakeIdx] = 'idle';
          this.shakeIdx = -1;
        }
      }
      this.hintT += dt;
      if (this.hintT > HINT_HOLD_SEC) {
        this.hintText.setAlpha(Math.max(0, 1 - (this.hintT - HINT_HOLD_SEC) / TIP_FADE_SEC));
      }
      if (this.countT >= 0) {
        this.countT -= dt;
        if (this.countT <= 0) { this.countT = -1; this.countAll(); }
      }
      if (this.revealT > 0) {
        this.revealT -= dt;
        if (this.revealT <= 0) {
          this.revealT = 0;
          if (this.phase === 'play') this.nextQuestion();
        }
      }
      if (this.endT >= 0) {
        this.endT -= dt;
        if (this.endT <= 0) {
          this.endT = -1;
          if (this.phase === 'play') this.showCard();
        }
      }
      this.stepFx(dt);
    }

    finishFx(o) {
      this.untrackObj(o);
      if (o.g && o.g.destroy) o.g.destroy();
      if (o.txt && o.txt.destroy) o.txt.destroy();
      o.g = null;
      o.txt = null;
    }

    stepFx(dt) {
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const o = this.liveProps[i];
        o.t += dt;
        const tt = o.t - (o.delay || 0);
        if (tt < 0) {
          if (o.g) o.g.clear();
          if (o.txt) o.txt.setAlpha(0);
          continue;
        }
        const k = clamp(tt / o.dur, 0, 1);
        if (o.kind === 'fly') {
          const e = easeOut(k);
          const x = lerp(o.x0, o.x1, e);
          const y = lerp(o.y0, o.y1, e) - Math.sin(k * Math.PI) * 30;
          o.g.clear();
          o.g.setAlpha(1);
          drawFruit(o.g, o.kindFruit, x, y, FRUIT_R * DRAG_SCALE, 1);
        } else if (o.kind === 'halo') {
          const alpha = Math.sin(Math.PI * k);
          o.g.clear();
          o.g.setAlpha(1);
          o.g.lineStyle(3 + 3 * k, C.plus, alpha);
          strokeCircle(o.g, o.x, o.y, FRUIT_R + 4 + 7 * k);
          o.g.lineStyle(2, 0xFFFFFF, alpha * 0.7);
          strokeCircle(o.g, o.x, o.y, FRUIT_R + 1 + 4 * k);
        } else if (o.kind === 'sparkle') {
          o.g.clear();
          o.g.setAlpha(1 - k);
          for (let p = 0; p < o.parts.length; p++) {
            const pt = o.parts[p];
            const px = o.x + pt.dx * (0.55 + k * 0.8);
            const py = o.y + pt.dy * k - k * 26;
            o.g.fillStyle(pt.color, 1);
            fillPoly(o.g, starPts(px, py, pt.s, pt.s * 0.44, 5));
          }
        } else if (o.kind === 'heart') {
          o.g.clear();
          o.g.setAlpha(1 - k);
          o.g.fillStyle(0xFF9AA8, 1);
          fillPoly(o.g, heartPts(o.x, o.y - easeOut(k) * 52, 10 + 5 * k));
        } else if (o.kind === 'badge') {
          const sc = 1 + 0.28 * Math.sin(Math.PI * Math.min(1, k * 1.5));
          const alpha = k > 0.72 ? Math.max(0, 1 - (k - 0.72) / 0.28) : 1;
          const yy = o.y - easeOut(k) * 18;
          o.g.clear();
          o.g.setAlpha(1);
          if (alpha > 0.01) {
            o.g.fillStyle(C.plus, alpha);
            fillCircle(o.g, o.x, yy, 15 * sc);
            o.g.lineStyle(3, 0xFFFFFF, alpha * 0.85);
            strokeCircle(o.g, o.x, yy, 15 * sc);
          }
          o.txt.setPosition(o.x, yy);
          o.txt.setAlpha(alpha);
          o.txt.setScale(sc);
          o.txt.setVisible(alpha > 0.01);
        } else if (o.kind === 'total') {
          const alpha = k > 0.78 ? Math.max(0, 1 - (k - 0.78) / 0.22) : 1;
          const yy = o.y - easeOut(k) * 16;
          o.g.clear();
          o.g.setAlpha(1);
          if (alpha > 0.01) {
            o.g.fillStyle(C.tipBg, 0.97 * alpha);
            o.g.fillRoundedRect(o.x - 30, yy - 23, 60, 46, 23);
            o.g.lineStyle(3, C.tipLine, alpha);
            o.g.strokeRoundedRect(o.x - 30, yy - 23, 60, 46, 23);
          }
          o.txt.setPosition(o.x, yy);
          o.txt.setAlpha(alpha);
          o.txt.setVisible(alpha > 0.01);
        }
        if (k >= 1) this.finishFx(o);
      }
    }

    // -------------------------------------------------- 绘制
    drawOperator(g, op, x, y) {
      if (op === 'add') {
        g.fillStyle(C.plus, 0.14);
        fillCircle(g, x, y, 30);
        g.lineStyle(9, C.plus, 1);
        line(g, x - 20, y, x + 20, y, 9, C.plus, 1);
        line(g, x, y - 20, x, y + 20, 9, C.plus, 1);
      } else {
        g.fillStyle(C.minus, 0.14);
        fillCircle(g, x, y, 26);
        g.lineStyle(9, C.minus, 1);
        line(g, x - 18, y, x + 18, y, 9, C.minus, 1);
      }
    }

    render() {
      const q = this.question;
      const g = this.groups();
      const kind = g.kind;
      const dragging = !!this.drag;
      const returning = this.returnT > 0 && this.returnGroup.length > 0;
      const rk = returning ? 1 - this.returnT / 0.26 : 1;
      const rdx = lerp(this.returnDX, 0, easeOut(rk));
      const rdy = lerp(this.returnDY, 0, easeOut(rk));
      const blink = ((this.clock + 1.6) % 4.3) < 0.13;
      const mood = this.busy || this.correctIdx >= 0 ? 'happy' : 'idle';
      const celeb = this.celebT > 0 ? -Math.abs(Math.sin((0.9 - this.celebT) * Math.PI * 3)) * 6 : 0;
      const sqBob = Math.sin(this.clock * 2.1) * 2;
      const sqJump = this.busy ? -Math.abs(Math.sin(this.clock * 9)) * 10 : 0;

      // 进度
      this.progressG.clear();
      drawProgress(this.progressG, this.L, this.qi, this.correct, this.phase === 'over');

      // 果园托盘里的盘子 / 篮子 / 松鼠 / 果子
      this.plateG.clear();
      if (q.op === 'add') {
        const a = this.L.add;
        drawSquirrel(this.plateG, a.squirrel.x, a.squirrel.y + sqBob + sqJump, a.squirrel.s,
          this.squirrelWag > 0 ? 'happy' : mood, blink, this.clock + this.squirrelWag * 5);
        drawPlate(this.plateG, a.left.x, a.left.y, a.left.r);
        drawPlate(this.plateG, a.right.x, a.right.y, a.right.r);
        this.drawOperator(this.plateG, 'add', a.sign.x, a.sign.y);
        for (let i = 0; i < g.left.length; i++) {
          drawFruit(this.plateG, kind, g.left[i].x, g.left[i].y + celeb, FRUIT_R, 1);
        }
        if (!dragging) {
          const pts = returning ? this.returnGroup : g.right;
          for (let i = 0; i < pts.length; i++) {
            drawFruit(this.plateG, kind, pts[i].x + (returning ? rdx : 0), pts[i].y + celeb + (returning ? rdy : 0), FRUIT_R, 1);
          }
        }
      } else {
        const s = this.L.sub;
        drawSquirrel(this.plateG, s.squirrel.x, s.squirrel.y + sqBob + sqJump, s.squirrel.s,
          this.squirrelWag > 0 ? 'happy' : mood, blink, this.clock + this.squirrelWag * 5);
        drawPlate(this.plateG, s.plate.x, s.plate.y, s.plate.r);
        drawBasket(this.plateG, s.basket.x, s.basket.y, s.basket.r);
        this.drawOperator(this.plateG, 'sub', s.sign.x, s.sign.y);
        for (let i = 0; i < g.left.length; i++) {
          drawFruit(this.plateG, kind, g.left[i].x, g.left[i].y + celeb, FRUIT_R, 1);
        }
        if (!dragging) {
          const pts = returning ? this.returnGroup : g.ghost;
          for (let i = 0; i < pts.length; i++) {
            const alpha = returning ? lerp(0.95, 0.27, easeOut(rk)) : 0.27;
            const px = pts[i].x + (returning ? rdx : 0);
            const py = pts[i].y + celeb + (returning ? rdy : 0);
            drawFruit(this.plateG, kind, px, py, FRUIT_R, alpha);
            if (!returning) {
              this.plateG.lineStyle(2.5, C.minus, 0.55);
              strokeCircle(this.plateG, px, py, FRUIT_R + 4);
            }
          }
        }
        for (let i = 0; i < g.basket.length; i++) {
          drawFruit(this.plateG, kind, g.basket[i].x, g.basket[i].y + celeb, FRUIT_R * 0.86, 1);
        }
      }

      // 算式
      this.eqG.clear();
      drawEquationBox(this.eqG, this.L, this.correctIdx >= 0 ? 'correct' : 'idle');
      this.eqA.setText(String(q.a));
      this.eqB.setText(String(q.b));
      this.eqOp.setText(q.op === 'add' ? '+' : '−');
      this.eqOp.setStyle({ fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: q.op === 'add' ? '#F09A3E' : '#E1788A' });
      this.eqAns.setText(this.correctIdx >= 0 ? String(q.answer) : '?');
      this.eqAns.setStyle({
        fontFamily: FONT, fontSize: '54px', fontStyle: 'bold',
        color: this.correctIdx >= 0 ? '#4F7A3C' : '#5C4A38',
      });

      // 答案卡
      const correctChoice = q.choices.indexOf(q.answer);
      for (let i = 0; i < ANSWER_CARDS; i++) {
        const base = this.L.cards[i];
        let offX = 0;
        if (this.shakeIdx === i && this.shakeT > 0) offX = Math.sin(this.shakeT * 52) * 8;
        const pop = this.correctIdx === i && this.celebT > 0 ? 1 + Math.sin((0.9 - this.celebT) * Math.PI * 3) * 0.04 : 1;
        const card = { x: base.x + offX, y: base.y, w: base.w * pop, h: base.h * pop };
        const state = this.correctIdx === i ? 'correct'
          : (this.shakeIdx === i && this.shakeT > 0 ? 'wrong' : 'idle');
        const pulse = this.hintOn && i === correctChoice ? this.clock : 0;
        this.cardGs[i].clear();
        drawAnswerCard(this.cardGs[i], card, state, this.hoverCard === i, pulse);
        this.cardTexts[i].setPosition(card.x, card.y + 6);
        this.cardTexts[i].setStyle({
          fontFamily: FONT, fontSize: '54px', fontStyle: 'bold',
          color: state === 'correct' ? '#4F7A3C' : '#5C4A38',
        });
      }

      // 再数一遍
      this.recountG.clear();
      drawRecount(this.recountG, this.L, this.hoverRecount);

      // 拖拽：目标虚线 + 跟着手指的一整组果子
      if (this.drag) {
        const d = this.drag;
        const t = d.target;
        this.ghostG.setVisible(true);
        this.ghostG.clear();
        this.ghostG.fillStyle(C.plus, 0.06 + 0.04 * Math.sin(this.clock * 7));
        fillCircle(this.ghostG, t.x, t.y, t.r);
        dashedCircle(this.ghostG, t.x, t.y, t.r + 8, C.plus, 3.2, 0.75);
        dashedCircle(this.ghostG, t.x, t.y, t.r - 8, C.plus, 2, 0.35);
        const dx = d.x - d.sx;
        const dy = d.y - d.sy - DRAG_LIFT;
        for (let i = 0; i < d.group.length; i++) {
          drawFruit(this.ghostG, kind, d.group[i].x + dx, d.group[i].y + dy, FRUIT_R * DRAG_SCALE, 0.97);
        }
      } else if (this.ghostG.visible) {
        this.ghostG.setVisible(false);
        this.ghostG.clear();
      }

      // 顶部小提示
      if (this.tipT > 0) {
        const alpha = clamp(this.tipT / TIP_FADE_SEC, 0, 1);
        this.tipG.clear();
        const tw = clamp(textW(this.tipText.width, 150) + 46, 150, 360);
        drawTipBubble(this.tipG, this.L, tw, 38, alpha);
        this.tipG.setVisible(true);
        this.tipText.setVisible(true);
        this.tipText.setAlpha(alpha);
      } else if (this.tipG.visible) {
        this.tipG.setVisible(false);
        this.tipText.setVisible(false);
      }

      this.hudText.setText(String(this.stars));
      this.hudText.setScale(1 + this.hudPop * 0.45);
      this.hintText.setAlpha(this.hintT > HINT_HOLD_SEC
        ? Math.max(0, 1 - (this.hintT - HINT_HOLD_SEC) / TIP_FADE_SEC) : 1);
    }

    // -------------------------------------------------- 测试钩子 / 生命周期
    simulate(seconds, stepSec) {
      const h = stepSec || 1 / 60;
      const n = Math.max(0, Math.round(seconds / h));
      for (let i = 0; i < n; i++) { this.step(h); this.render(); }
      return n;
    }

    update(time, delta) {
      const dt = Math.min(0.05, (delta || 16.7) / 1000);
      this.step(dt);
      this.render();
    }
  }

  function fillCircle(g, x, y, r) { g.fillCircle(x, y, r); }
  function strokeCircle(g, x, y, r) { g.strokeCircle(x, y, r); }

  window.OrchardScene = OrchardScene;
})();
