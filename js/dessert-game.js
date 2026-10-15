/*
 * 森林甜品站（V1）：竖屏 540×960 的甜品摊位小玩具。
 * 顶部是甜品店的木招牌，中间是森林里来买甜点的动物客人，底部是玩家面前的木台面。
 * 客人头顶的气泡里画出想吃的甜品，把台面上那一份拖到他身上松手就完成了：给对了客人开心
 * 吃完走人、下一位补位；给错了客人轻轻摇头、甜品飞回格子，不扣星、不结束、可无限重试。
 * 一轮固定 12 位客人（同时最多 3 位），服务满 12 位弹结算卡「今天收摊啦」。
 * 没有倒计时、没有进度条、没有存档、没有背景音乐；画面全部 Phaser.Graphics 程序化绘制，
 * 音效 WebAudio 合成，不加载任何素材文件。
 *
 * 取餐统一走 acquire()、递餐统一走 serveTo()：V1 里 acquire() 直接把货架上的成品交到手上，
 * V2 换成「点格子进制作台 → 一步步做出成品 → 再拖给客人」时，拖拽 / 判定 / 计分 / HUD /
 * 结算卡都不用改；客人的 want 与甜品的绘制都已经带 flavor（口味色）这一维，V1 恒为 0。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const ROUND_SIZE = 12;          // 一轮服务 12 位客人
  const SLOT_COUNT = 3;           // 同时最多 3 位客人在等
  const DESSERT_COUNT = 6;        // 6 样甜品 = 货架 6 格
  const SHELF_COLS = 3;
  const SHELF_ROWS = 2;

  const ARRIVE_SEC = 0.5;         // 客人走进站位
  const SETTLE_SEC = 0.3;         // 站定后停一下再冒气泡
  const BUBBLE_POP_SEC = 0.25;    // 气泡弹出
  const HAPPY_SEC = 0.7;          // 吃到甜品开心跳
  const SAD_SEC = 0.4;            // 给错了摇头
  const LEAVE_SEC = 0.5;          // 满意地走出画面
  const SERVE_FLY_SEC = 0.3;      // 甜品飞到客人手上
  const GHOST_BACK_SEC = 0.25;    // 没送出去，飞回格子
  const CARD_DELAY_SEC = 0.8;     // 最后一位服务完到结算卡
  const TAP_LOCK_SEC = 0.4;       // 结算卡出现后的防误触
  const HINT_HOLD_SEC = 6;        // 底部提示停留多久才淡出
  const HINT_FADE_SEC = 0.6;

  const DRAG_LIFT = 40;           // 拖拽幻影比手指高多少
  const DRAG_R = 44;              // 幻影里甜品的绘制半径（和托盘里的同大，再乘 1.15）
  const PICK_HALF_W = 70;         // 客人接受区半宽（站位间距 152，两块不会重叠）
  const PICK_BOTTOM_PAD = 30;     // 接受区下沿越过脚底多少

  // 马卡龙粉彩
  const C = {
    skyTop: 0xCDEBFA, skyBottom: 0xEAF7FF,
    tree1: 0x86C97F, tree2: 0x6FB86B, tree3: 0x9AD893, trunk: 0xA9856A,
    grass: 0xA8D98A, grassDark: 0x8CC673, path: 0xF2E6CB,
    signBoard: 0xC08A5E, signDark: 0x8C6138, signLight: 0xD9AA7C, signText: '#6B4A32',
    counter: 0xB98A5E, counterLight: 0xD8B18A, counterDark: 0xA5744A,
    table: 0xF3E3CE, tableLine: 0xE2CDAE, tableStreak: 0xEADABF,
    tray: 0xFFF3E0, trayLine: 0xE3C9A8,
    bubble: 0xFFFFFF, bubbleLine: 0xE0C6A6, bubbleHi: 0xFFB3C7,
    hudBg: 0xFFF6E8, hudLine: 0xE0C6A6,
    pink: 0xFFB3C7, cream: 0xFFE3A3, mint: 0xA8E6CF, sky: 0xA9D7F2, lilac: 0xCDBBF0,
    ivory: 0xFFF6E8, berry: 0xF4787E, cocoa: 0xB98A5E, dough: 0xE8C08A, caramel: 0xC98A4B,
    leaf: 0x6FA05A, cup: 0xF6CDA0, cupLine: 0xE0B183,
    ink: 0x7A5238, eye: 0x4A3A2E, star: 0xFFC94D,
    cardBg: 0xFFFFFF, cardLine: 0xE6D8C6, cardBtn: 0x5BA8E8, cardDim: 0x3A2A1E,
    hudText: '#6B4A32', trayText: '#9C866B', hintText: '#8C7A66',
    cardTitle: '#5C4A38', cardSub: '#8C7A66', cardBtnText: '#FFFFFF',
  };

  // 场景深度：天空/森林/草地(0) -> 招牌(1) -> 客人(3) -> 气泡(4) -> 柜台与台面(6)
  // -> 托盘格(7) -> 拖拽幻影(12) -> 特效(14) -> HUD(20) -> 结算遮罩(40)
  const DEPTH = {
    world: 0, sign: 1, customer: 3, bubble: 4, counter: 6, tray: 7,
    ghost: 12, fx: 14, hud: 20, card: 40,
  };

  // 6 样甜品：colors 是口味配色，V1 只用第 0 个（也就是每样的招牌色）
  const DESSERTS = [
    { key: 'icecream', name: '冰淇淋筒', colors: [0xFFB3C7, 0xFFE3A3, 0xA8E6CF] },
    { key: 'cupcake', name: '纸杯蛋糕', colors: [0xA9D7F2, 0xFFB3C7, 0xCDBBF0] },
    { key: 'donut', name: '甜甜圈', colors: [0xFFB3C7, 0xA8E6CF, 0xFFE3A3] },
    { key: 'lollipop', name: '棒棒糖', colors: [0xCDBBF0, 0xFFB3C7, 0xA9D7F2] },
    { key: 'pudding', name: '布丁', colors: [0xFFE3A3, 0xA8E6CF, 0xFFB3C7] },
    { key: 'cake', name: '草莓蛋糕', colors: [0xFFB3C7, 0xCDBBF0, 0xA9D7F2] },
  ];

  // 6 种小动物，每种 3 套配色
  const ANIMALS = [
    { key: 'bunny', name: '兔子', tints: [0xFFF1E4, 0xF2E6FF, 0xFFE4EE], h: 162 },
    { key: 'bear', name: '小熊', tints: [0xD8A87C, 0xB9A3E0, 0xF0A9A0], h: 152 },
    { key: 'cat', name: '小猫', tints: [0xF7D9A8, 0xBFD9F2, 0xF3B7C8], h: 150 },
    { key: 'dog', name: '小狗', tints: [0xEBC79A, 0xC7B7A2, 0xF2C1A8], h: 152 },
    { key: 'pig', name: '小猪', tints: [0xFFC5D2, 0xF6D8B0, 0xD9C7F0], h: 150 },
    { key: 'fox', name: '小狐狸', tints: [0xF2A468, 0xE8B07C, 0xD98C5A], h: 152 },
  ];

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const slotXs = [118, 270, 422];      // 三个站位与三列托盘对齐
    const groundY = 552;                 // 客人脚底的草地线
    const grassY0 = 470, grassY1 = 566;
    const treeY0 = 330, treeY1 = grassY0;
    const sign = { x: 46, y: 56, w: 364, h: 78, cx: 228, cy: 95 };
    const hud = { x: 430, y: 74, w: 88, h: 48, cx: 474, cy: 98 };
    const bubble = { w: 118, h: 96, cy: 250, tail: 40, r: 32 };
    const counter = { y0: grassY1, y1: 614 };
    const table = { y0: 614, y1: 960 };
    const cellW = 138, cellH = 132;
    const rowCy = [700, 848];
    const shelf = [];
    for (let row = 0; row < SHELF_ROWS; row++) {
      for (let col = 0; col < SHELF_COLS; col++) {
        const i = row * SHELF_COLS + col;
        const cx = slotXs[col], cy = rowCy[row];
        shelf.push({
          i: i, row: row, col: col, cx: cx, cy: cy, w: cellW, h: cellH,
          x: cx - cellW / 2, y: cy - cellH / 2,
          r: 44, nameY: cy + 52, name: DESSERTS[i].name, key: DESSERTS[i].key,
        });
      }
    }
    return {
      slotXs: slotXs, groundY: groundY,
      grassY0: grassY0, grassY1: grassY1, treeY0: treeY0, treeY1: treeY1,
      sign: sign, hud: hud, bubble: bubble, counter: counter, table: table, shelf: shelf,
      counterY: counter.y0, tableY0: table.y0,
      hint: { x: WIDTH / 2, y: 936 },
      bubbleTop: bubble.cy - bubble.h / 2 - 12,
      bubbleBottom: bubble.cy + bubble.h / 2,
    };
  }

  // ---------------------------------------------------------------- 小工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeIn(t) { return t * t; }
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function darken(color, k) {
    const r = Math.round(((color >> 16) & 0xff) * (1 - k));
    const g = Math.round(((color >> 8) & 0xff) * (1 - k));
    const b = Math.round((color & 0xff) * (1 - k));
    return (r << 16) | (g << 8) | b;
  }
  function lighten(color, k) {
    const r = Math.round(((color >> 16) & 0xff) + (255 - ((color >> 16) & 0xff)) * k);
    const g = Math.round(((color >> 8) & 0xff) + (255 - ((color >> 8) & 0xff)) * k);
    const b = Math.round((color & 0xff) + (255 - (color & 0xff)) * k);
    return (r << 16) | (g << 8) | b;
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

  // 12 位客人的动物顺序：6 种各 2 次、相邻不重样
  // 做法：两轮「6 种各一次」的洗牌拼起来，再把接缝上撞到的那一只和后面一只换个位子，一定成立
  function shuffledAnimals() {
    const a = ANIMALS.map(function (_, i) { return i; });
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function buildPlan() {
    const first = shuffledAnimals();
    const second = shuffledAnimals();
    if (first[first.length - 1] === second[0]) {
      const t = second[0]; second[0] = second[1]; second[1] = t;
    }
    const order = first.concat(second);
    return order.map(function (k) {
      return { animalIndex: k, tintIndex: Math.floor(Math.random() * 3) };
    });
  }
  // 新客人想吃什么：尽量不和当前在场的客人重样
  function pickWantAvoiding(used) {
    const pool = [];
    for (let i = 0; i < DESSERTS.length; i++) {
      if (used.indexOf(DESSERTS[i].key) < 0) pool.push(DESSERTS[i].key);
    }
    const list = pool.length ? pool : DESSERTS.map(function (d) { return d.key; });
    return list[Math.floor(Math.random() * list.length)];
  }

  // ---------------------------------------------------------------- 甜品绘制
  // 都以 (cx, cy) 为中心、r 为基准半径；flavor 挑口味色（V1 恒为 0，也就是每样自己的招牌色）
  const DRAW_DESSERT = {
    // 冰淇淋筒：蛋筒 + 两个球 + 小樱桃
    icecream: function (g, cx, cy, r, flavor) {
      const main = DESSERTS[0].colors[flavor];
      const lw = Math.max(1.4, r * 0.05);
      g.fillStyle(C.dough, 1);
      fillPoly(g, [[cx - r * 0.44, cy - r * 0.02], [cx + r * 0.44, cy - r * 0.02], [cx, cy + r * 0.98]]);
      g.lineStyle(lw, C.ink, 0.85);
      strokePoly(g, [[cx - r * 0.44, cy - r * 0.02], [cx + r * 0.44, cy - r * 0.02], [cx, cy + r * 0.98]], true);
      g.lineStyle(Math.max(1, r * 0.04), 0xC08A5E, 0.7);
      strokePoly(g, [[cx - r * 0.26, cy + r * 0.06], [cx + r * 0.02, cy + r * 0.6]], false);
      strokePoly(g, [[cx + r * 0.24, cy + r * 0.06], [cx - r * 0.05, cy + r * 0.66]], false);
      g.fillStyle(main, 1);
      g.fillCircle(cx, cy - r * 0.16, r * 0.46);
      g.lineStyle(lw, C.ink, 0.8);
      g.strokeCircle(cx, cy - r * 0.16, r * 0.46);
      g.fillStyle(C.ivory, 1);
      g.fillCircle(cx, cy - r * 0.55, r * 0.32);
      g.strokeCircle(cx, cy - r * 0.55, r * 0.32);
      g.fillStyle(C.berry, 1);
      g.fillCircle(cx, cy - r * 0.92, r * 0.11);
      line(g, cx, cy - r * 1.0, cx + r * 0.08, cy - r * 1.14, Math.max(1, r * 0.045), C.leaf, 0.9);
    },
    // 纸杯蛋糕：纸杯 + 三团奶油 + 樱桃
    cupcake: function (g, cx, cy, r, flavor) {
      const main = DESSERTS[1].colors[flavor];
      const lw = Math.max(1.4, r * 0.05);
      g.fillStyle(C.cup, 1);
      fillPoly(g, [[cx - r * 0.56, cy + r * 0.05], [cx + r * 0.56, cy + r * 0.05], [cx + r * 0.4, cy + r * 0.95], [cx - r * 0.4, cy + r * 0.95]]);
      g.lineStyle(lw, C.ink, 0.8);
      strokePoly(g, [[cx - r * 0.56, cy + r * 0.05], [cx + r * 0.56, cy + r * 0.05], [cx + r * 0.4, cy + r * 0.95], [cx - r * 0.4, cy + r * 0.95]], true);
      g.lineStyle(Math.max(1, r * 0.035), C.cupLine, 0.85);
      for (let i = -2; i <= 2; i++) {
        strokePoly(g, [[cx + i * r * 0.2, cy + r * 0.14], [cx + i * r * 0.15, cy + r * 0.88]], false);
      }
      g.fillStyle(lighten(C.cup, 0.4), 1);
      g.fillRect(cx - r * 0.6, cy + r * 0.0, r * 1.2, r * 0.17);
      g.lineStyle(lw * 0.8, C.ink, 0.6);
      strokePoly(g, [[cx - r * 0.6, cy], [cx + r * 0.6, cy]], false);
      strokePoly(g, [[cx - r * 0.6, cy + r * 0.17], [cx + r * 0.6, cy + r * 0.17]], false);
      // 奶油：一坨带三个小波浪的圆顶
      const frost = [];
      const FN = 24;
      for (let i = 0; i <= FN; i++) {
        const a = Math.PI - (i / FN) * Math.PI;
        const bump = 1 + 0.16 * Math.cos((i / FN) * Math.PI * 3);
        const rr = r * 0.58 * bump;
        frost.push([cx + Math.cos(a) * rr, cy + r * 0.02 - Math.sin(a) * rr * 1.08]);
      }
      g.fillStyle(main, 1);
      fillPoly(g, frost);
      g.lineStyle(lw, C.ink, 0.7);
      strokePoly(g, frost, false);
      strokePoly(g, [[frost[0][0], frost[0][1]], [frost[FN][0], frost[FN][1]]], false);
      g.fillStyle(C.berry, 1);
      g.fillCircle(cx, cy - r * 0.84, r * 0.12);
    },
    // 甜甜圈：面圈环 + 糖霜环 + 彩针
    donut: function (g, cx, cy, r, flavor) {
      const main = DESSERTS[2].colors[flavor];
      const ringR = r * 0.56, doughW = r * 0.44;
      g.lineStyle(doughW, C.dough, 1);
      g.strokeCircle(cx, cy, ringR);
      g.lineStyle(Math.max(1.2, r * 0.035), C.ink, 0.6);
      g.strokeCircle(cx, cy, ringR + doughW / 2);
      g.strokeCircle(cx, cy, ringR - doughW / 2);
      g.lineStyle(doughW * 0.7, main, 1);
      g.strokeCircle(cx, cy, ringR);
      g.fillStyle(main, 1);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * (Math.PI / 3) + 0.3;
        g.fillCircle(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, doughW * 0.42);
      }
      const sp = [[-0.42, -0.42, 0.5], [0.06, -0.62, 0.9], [0.5, -0.22, 0.3], [0.44, 0.42, 1.1], [-0.06, 0.6, 0.7], [-0.56, 0.18, 1.3]];
      const cols = [C.berry, C.mint, C.cream, C.lilac, C.sky, C.ivory];
      for (let i = 0; i < sp.length; i++) {
        const x = cx + sp[i][0] * r, y = cy + sp[i][1] * r, a = sp[i][2] * 2;
        line(g, x - Math.cos(a) * r * 0.1, y - Math.sin(a) * r * 0.1,
          x + Math.cos(a) * r * 0.1, y + Math.sin(a) * r * 0.1,
          Math.max(1.6, r * 0.07), cols[i], 0.95);
      }
    },
    // 棒棒糖：棍 + 糖盘 + 白螺旋
    lollipop: function (g, cx, cy, r, flavor) {
      const main = DESSERTS[3].colors[flavor];
      const lw = Math.max(1.4, r * 0.05);
      const dcx = cx, dcy = cy - r * 0.3, dr = r * 0.62;
      g.fillStyle(0xF0E0C0, 1);
      g.fillRoundedRect(cx - r * 0.085, dcy, r * 0.17, r * 1.15, r * 0.08);
      g.lineStyle(lw, C.ink, 0.75);
      g.strokeRoundedRect(cx - r * 0.085, dcy, r * 0.17, r * 1.15, r * 0.08);
      g.fillStyle(main, 1);
      g.fillCircle(dcx, dcy, dr);
      g.lineStyle(lw, C.ink, 0.8);
      g.strokeCircle(dcx, dcy, dr);
      g.lineStyle(Math.max(1.6, r * 0.09), C.ivory, 0.95);
      g.strokeCircle(dcx - r * 0.06, dcy, dr * 0.66);
      g.strokeCircle(dcx - r * 0.02, dcy, dr * 0.38);
      g.fillStyle(C.ivory, 1);
      g.fillCircle(dcx + r * 0.02, dcy, dr * 0.12);
      g.fillStyle(0xFFFFFF, 0.5);
      g.fillCircle(dcx - dr * 0.42, dcy - dr * 0.46, dr * 0.16);
    },
    // 布丁：小盘子 + 梯形布丁 + 焦糖顶 + 小奶油
    pudding: function (g, cx, cy, r, flavor) {
      const main = DESSERTS[4].colors[flavor];
      const lw = Math.max(1.4, r * 0.05);
      g.fillStyle(C.ivory, 1);
      fillEllipse(g, cx, cy + r * 0.8, r * 0.82, r * 0.16);
      g.lineStyle(lw, C.ink, 0.7);
      strokeEllipse(g, cx, cy + r * 0.8, r * 0.82, r * 0.16);
      g.fillStyle(main, 1);
      fillPoly(g, [[cx - r * 0.54, cy - r * 0.22], [cx + r * 0.54, cy - r * 0.22], [cx + r * 0.4, cy + r * 0.78], [cx - r * 0.4, cy + r * 0.78]]);
      g.lineStyle(lw, C.ink, 0.8);
      strokePoly(g, [[cx - r * 0.54, cy - r * 0.22], [cx + r * 0.54, cy - r * 0.22], [cx + r * 0.4, cy + r * 0.78], [cx - r * 0.4, cy + r * 0.78]], true);
      g.fillStyle(C.caramel, 1);
      fillEllipse(g, cx, cy - r * 0.24, r * 0.56, r * 0.18);
      g.lineStyle(lw * 0.8, C.ink, 0.5);
      strokeEllipse(g, cx, cy - r * 0.24, r * 0.56, r * 0.18);
      g.fillStyle(C.caramel, 1);
      g.fillCircle(cx - r * 0.46, cy + r * 0.24, r * 0.075);
      g.fillCircle(cx + r * 0.42, cy + r * 0.34, r * 0.062);
      g.fillStyle(C.ivory, 1);
      g.fillCircle(cx, cy - r * 0.48, r * 0.2);
      g.fillStyle(C.berry, 1);
      g.fillCircle(cx, cy - r * 0.7, r * 0.11);
    },
    // 草莓蛋糕：一小块蛋糕 + 果酱夹层 + 奶油花 + 草莓
    cake: function (g, cx, cy, r, flavor) {
      const main = DESSERTS[5].colors[flavor];
      const lw = Math.max(1.4, r * 0.05);
      g.fillStyle(C.ivory, 1);
      fillEllipse(g, cx, cy + r * 0.86, r * 0.86, r * 0.15);
      g.lineStyle(lw, C.ink, 0.55);
      strokeEllipse(g, cx, cy + r * 0.86, r * 0.86, r * 0.15);
      g.fillStyle(0xFFF1DC, 1);
      g.fillRoundedRect(cx - r * 0.62, cy - r * 0.24, r * 1.24, r * 1.0, r * 0.12);
      g.lineStyle(lw, C.ink, 0.8);
      g.strokeRoundedRect(cx - r * 0.62, cy - r * 0.24, r * 1.24, r * 1.0, r * 0.12);
      g.fillStyle(C.berry, 0.9);
      g.fillRect(cx - r * 0.62, cy + r * 0.14, r * 1.24, r * 0.12);
      g.fillRect(cx - r * 0.62, cy + r * 0.5, r * 1.24, r * 0.12);
      const sw = [[-0.32, -0.36, 0.21], [0, -0.46, 0.24], [0.32, -0.36, 0.21]];
      for (let i = 0; i < sw.length; i++) {
        g.fillStyle(main, 1);
        g.fillCircle(cx + r * sw[i][0], cy + r * sw[i][1], r * sw[i][2]);
        g.lineStyle(lw * 0.9, C.ink, 0.55);
        g.strokeCircle(cx + r * sw[i][0], cy + r * sw[i][1], r * sw[i][2]);
      }
      g.fillStyle(C.berry, 1);
      g.fillCircle(cx, cy - r * 0.72, r * 0.16);
      fillPoly(g, [[cx - r * 0.17, cy - r * 0.7], [cx + r * 0.17, cy - r * 0.7], [cx, cy - r * 0.36]]);
      g.fillStyle(C.leaf, 1);
      fillPoly(g, [[cx - r * 0.12, cy - r * 0.86], [cx + r * 0.12, cy - r * 0.86], [cx, cy - r * 0.7]]);
    },
  };

  function drawDessert(g, key, cx, cy, r, flavor) {
    const fn = DRAW_DESSERT[key];
    if (!fn) return;
    fn(g, cx, cy, r, flavor || 0);
  }

  // ---------------------------------------------------------------- 小动物客人
  // 局部坐标：脚底在 (0, 0)，身体往上长；mood = wait / happy / sad
  function drawEars(g, kind, tint, dark, headR, headCy, lw) {
    const sides = [-1, 1];
    for (let i = 0; i < sides.length; i++) {
      const s = sides[i];
      if (kind === 'bunny') {
        g.fillStyle(tint, 1);
        fillEllipse(g, s * headR * 0.42, headCy - headR * 1.2, headR * 0.28, headR * 0.84);
        g.lineStyle(lw, C.ink, 0.7);
        strokeEllipse(g, s * headR * 0.42, headCy - headR * 1.2, headR * 0.28, headR * 0.84);
        g.fillStyle(0xFFC7D6, 1);
        fillEllipse(g, s * headR * 0.42, headCy - headR * 1.18, headR * 0.14, headR * 0.58);
      } else if (kind === 'bear') {
        g.fillStyle(dark, 1);
        g.fillCircle(s * headR * 0.78, headCy - headR * 0.72, headR * 0.34);
        g.lineStyle(lw * 0.9, C.ink, 0.55);
        g.strokeCircle(s * headR * 0.78, headCy - headR * 0.72, headR * 0.34);
        g.fillStyle(lighten(tint, 0.32), 1);
        g.fillCircle(s * headR * 0.78, headCy - headR * 0.72, headR * 0.17);
      } else if (kind === 'cat') {
        g.fillStyle(tint, 1);
        fillPoly(g, [[s * headR * 0.2, headCy - headR * 0.7], [s * headR * 0.92, headCy - headR * 0.6], [s * headR * 0.88, headCy - headR * 1.28]]);
        g.lineStyle(lw * 0.9, C.ink, 0.65);
        strokePoly(g, [[s * headR * 0.2, headCy - headR * 0.7], [s * headR * 0.92, headCy - headR * 0.6], [s * headR * 0.88, headCy - headR * 1.28]], true);
        g.fillStyle(0xFFC7D6, 1);
        fillPoly(g, [[s * headR * 0.42, headCy - headR * 0.74], [s * headR * 0.78, headCy - headR * 0.7], [s * headR * 0.76, headCy - headR * 1.1]]);
      } else if (kind === 'dog') {
        g.fillStyle(dark, 1);
        fillEllipse(g, s * headR * 0.94, headCy - headR * 0.08, headR * 0.3, headR * 0.56);
        g.lineStyle(lw * 0.9, C.ink, 0.55);
        strokeEllipse(g, s * headR * 0.94, headCy - headR * 0.08, headR * 0.3, headR * 0.56);
      } else if (kind === 'pig') {
        g.fillStyle(dark, 1);
        fillPoly(g, [[s * headR * 0.28, headCy - headR * 0.72], [s * headR * 0.86, headCy - headR * 0.58], [s * headR * 0.72, headCy - headR * 1.08]]);
        g.lineStyle(lw * 0.9, C.ink, 0.55);
        strokePoly(g, [[s * headR * 0.28, headCy - headR * 0.72], [s * headR * 0.86, headCy - headR * 0.58], [s * headR * 0.72, headCy - headR * 1.08]], true);
      } else if (kind === 'fox') {
        g.fillStyle(tint, 1);
        fillPoly(g, [[s * headR * 0.22, headCy - headR * 0.66], [s * headR * 0.96, headCy - headR * 0.56], [s * headR * 0.94, headCy - headR * 1.36]]);
        g.lineStyle(lw * 0.9, C.ink, 0.65);
        strokePoly(g, [[s * headR * 0.22, headCy - headR * 0.66], [s * headR * 0.96, headCy - headR * 0.56], [s * headR * 0.94, headCy - headR * 1.36]], true);
        g.fillStyle(0x6B4A32, 1);
        fillPoly(g, [[s * headR * 0.74, headCy - headR * 0.96], [s * headR * 0.96, headCy - headR * 0.56], [s * headR * 0.94, headCy - headR * 1.36]]);
      }
    }
  }

  function drawSnout(g, kind, headR, headCy, mood, lw) {
    const eye = C.eye;
    if (kind === 'pig') {
      g.fillStyle(0xFF9BB0, 1);
      fillEllipse(g, 0, headCy + headR * 0.3, headR * 0.34, headR * 0.24);
      g.lineStyle(lw * 0.8, C.ink, 0.5);
      strokeEllipse(g, 0, headCy + headR * 0.3, headR * 0.34, headR * 0.24);
      g.fillStyle(0x8C5B63, 1);
      g.fillCircle(-headR * 0.13, headCy + headR * 0.3, headR * 0.05);
      g.fillCircle(headR * 0.13, headCy + headR * 0.3, headR * 0.05);
    } else if (kind === 'dog' || kind === 'bear') {
      g.fillStyle(lighten(0xFFF1E4, 0.15), 1);
      fillEllipse(g, 0, headCy + headR * 0.3, headR * 0.3, headR * 0.22);
      g.fillStyle(eye, 1);
      fillEllipse(g, 0, headCy + headR * 0.2, headR * 0.13, headR * 0.09);
    } else {
      g.fillStyle(eye, 1);
      fillPoly(g, [[0, headCy + headR * 0.18], [headR * 0.13, headCy + headR * 0.36], [-headR * 0.13, headCy + headR * 0.36]]);
    }
    const my = headCy + headR * 0.44;
    g.lineStyle(Math.max(1.4, headR * 0.1), eye, 0.9);
    if (mood === 'happy') {
      strokePoly(g, [[-headR * 0.22, my + headR * 0.04], [-headR * 0.11, my + headR * 0.2], [0, my + headR * 0.24],
        [headR * 0.11, my + headR * 0.2], [headR * 0.22, my + headR * 0.04]], false);
    } else if (mood === 'sad') {
      strokePoly(g, [[-headR * 0.12, my + headR * 0.2], [0, my + headR * 0.04], [headR * 0.12, my + headR * 0.2]], false);
    } else {
      strokePoly(g, [[-headR * 0.15, my - headR * 0.02], [0, my + headR * 0.16], [headR * 0.15, my - headR * 0.02]], false);
    }
  }

  function drawAnimal(g, kind, tint, h, mood) {
    const headR = h * 0.25;
    const headCy = -h * 0.7;
    const bodyR = h * 0.28;
    const bodyCy = -h * 0.3;
    const dark = darken(tint, 0.16);
    const lw = Math.max(1.6, h * 0.018);

    g.fillStyle(0x3A2A1E, 0.13);
    fillEllipse(g, 0, h * 0.05, h * 0.34, h * 0.07);

    if (kind === 'fox') {
      g.fillStyle(tint, 1);
      fillEllipse(g, bodyR * 1.05, bodyCy + h * 0.02, bodyR * 0.5, bodyR * 0.72);
      g.lineStyle(lw * 0.9, C.ink, 0.6);
      strokeEllipse(g, bodyR * 1.05, bodyCy + h * 0.02, bodyR * 0.5, bodyR * 0.72);
      g.fillStyle(C.ivory, 1);
      fillEllipse(g, bodyR * 1.16, bodyCy + h * 0.06, bodyR * 0.28, bodyR * 0.4);
    }

    drawEars(g, kind, tint, dark, headR, headCy, lw);

    g.fillStyle(dark, 1);
    fillEllipse(g, -h * 0.13, -h * 0.015, h * 0.115, h * 0.055);
    fillEllipse(g, h * 0.13, -h * 0.015, h * 0.115, h * 0.055);

    g.fillStyle(tint, 1);
    fillEllipse(g, 0, bodyCy, bodyR * 1.02, bodyR);
    g.lineStyle(lw, C.ink, 0.7);
    strokeEllipse(g, 0, bodyCy, bodyR * 1.02, bodyR);

    g.fillStyle(lighten(tint, 0.34), 1);
    fillEllipse(g, 0, bodyCy + h * 0.035, bodyR * 0.6, bodyR * 0.66);

    g.fillStyle(tint, 1);
    fillEllipse(g, -bodyR * 1.0, bodyCy - h * 0.02, h * 0.075, h * 0.115);
    fillEllipse(g, bodyR * 1.0, bodyCy - h * 0.02, h * 0.075, h * 0.115);
    g.lineStyle(lw * 0.8, C.ink, 0.5);
    strokeEllipse(g, -bodyR * 1.0, bodyCy - h * 0.02, h * 0.075, h * 0.115);
    strokeEllipse(g, bodyR * 1.0, bodyCy - h * 0.02, h * 0.075, h * 0.115);

    g.fillStyle(tint, 1);
    g.fillCircle(0, headCy, headR);
    g.lineStyle(lw, C.ink, 0.7);
    g.strokeCircle(0, headCy, headR);

    const ex = headR * 0.38, ey = headCy - headR * 0.06, er = headR * 0.135;
    if (mood === 'happy') {
      g.lineStyle(Math.max(1.6, headR * 0.13), C.eye, 1);
      strokePoly(g, [[-ex - er, ey + er * 0.7], [-ex, ey - er * 0.8], [-ex + er, ey + er * 0.7]], false);
      strokePoly(g, [[ex - er, ey + er * 0.7], [ex, ey - er * 0.8], [ex + er, ey + er * 0.7]], false);
    } else {
      g.fillStyle(C.eye, 1);
      g.fillCircle(-ex, ey, er);
      g.fillCircle(ex, ey, er);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillCircle(-ex + er * 0.35, ey - er * 0.4, er * 0.36);
      g.fillCircle(ex + er * 0.35, ey - er * 0.4, er * 0.36);
    }

    drawSnout(g, kind, headR, headCy, mood, lw);

    g.fillStyle(0xFF9BB0, 0.32);
    g.fillCircle(-headR * 0.76, headCy + headR * 0.32, headR * 0.16);
    g.fillCircle(headR * 0.76, headCy + headR * 0.32, headR * 0.16);
  }

  // ---------------------------------------------------------------- 场景静态绘制
  function blend(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
  }

  function drawSky(g, L) {
    const bands = 14;
    const bottom = L.grassY0 + 12;
    const bandH = bottom / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(blend(C.skyTop, C.skyBottom, i / (bands - 1)), 1);
      g.fillRect(0, i * bandH, WIDTH, bandH + 1);
    }
    // 太阳旁边两朵懒云
    const clouds = [[86, 168, 1.0], [396, 120, 0.8]];
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      g.fillStyle(0xFFFFFF, 0.85);
      fillEllipse(g, c[0], c[1], 46 * c[2], 20 * c[2]);
      fillEllipse(g, c[0] - 26 * c[2], c[1] + 6 * c[2], 26 * c[2], 14 * c[2]);
      fillEllipse(g, c[0] + 28 * c[2], c[1] + 4 * c[2], 30 * c[2], 15 * c[2]);
    }
  }

  function drawTrees(g, L) {
    const y1 = L.treeY1;
    const trees = [
      { x: 60, h: 148, c: C.tree2 }, { x: 168, h: 194, c: C.tree1 },
      { x: 302, h: 166, c: C.tree3 }, { x: 406, h: 206, c: C.tree1 },
      { x: 498, h: 146, c: C.tree2 },
    ];
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const tipY = y1 - t.h, halfW = t.h * 0.34;
      g.fillStyle(C.trunk, 1);
      g.fillRect(t.x - t.h * 0.035, y1 - t.h * 0.22, t.h * 0.07, t.h * 0.24);
      g.fillStyle(t.c, 1);
      fillPoly(g, [[t.x, tipY], [t.x + halfW, y1 - t.h * 0.2], [t.x - halfW, y1 - t.h * 0.2]]);
      g.fillStyle(lighten(t.c, 0.2), 1);
      fillPoly(g, [[t.x, tipY], [t.x + halfW * 0.46, y1 - t.h * 0.56], [t.x - halfW * 0.12, y1 - t.h * 0.42]]);
    }
    g.fillStyle(C.tree3, 1);
    const bushes = [[34, y1 - 4, 46], [146, y1 + 2, 40], [266, y1 - 2, 44], [386, y1 + 2, 42], [514, y1 - 4, 46]];
    for (let i = 0; i < bushes.length; i++) {
      const b = bushes[i];
      fillEllipse(g, b[0], b[1], b[2], b[2] * 0.55);
    }
  }

  function drawGrass(g, L) {
    g.fillStyle(C.grass, 1);
    g.fillRect(0, L.grassY0, WIDTH, L.grassY1 - L.grassY0);
    g.fillStyle(C.grassDark, 0.3);
    g.fillRect(0, L.grassY0, WIDTH, 16);
    g.fillStyle(C.path, 0.8);
    fillPoly(g, [[238, L.grassY0 + 4], [302, L.grassY0 + 4], [356, L.grassY1], [184, L.grassY1]]);
    const tufts = [[40, 506], [92, 540], [176, 516], [352, 524], [430, 544], [500, 512]];
    g.lineStyle(3, C.grassDark, 0.85);
    for (let i = 0; i < tufts.length; i++) {
      const t = tufts[i];
      strokePoly(g, [[t[0], t[1]], [t[0] - 8, t[1] - 14]], false);
      strokePoly(g, [[t[0], t[1]], [t[0] + 8, t[1] - 16]], false);
    }
    const flowers = [[64, 524, C.pink], [150, 546, C.cream], [332, 540, C.mint], [472, 528, C.lilac]];
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      g.fillStyle(f[2], 1);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        g.fillCircle(f[0] + Math.cos(a) * 5.2, f[1] + Math.sin(a) * 5.2, 3.6);
      }
      g.fillStyle(C.star, 1);
      g.fillCircle(f[0], f[1], 2.8);
    }
  }

  // 招牌（文字另外用 text 画）：木牌 + 两根吊绳 + 一串彩灯的铁丝
  function drawSign(g, L) {
    const s = L.sign;
    g.lineStyle(3.5, 0x8C6138, 0.9);
    strokePoly(g, [[s.x + 18, 0], [s.x + 26, s.y + 6]], false);
    strokePoly(g, [[s.x + s.w - 18, 0], [s.x + s.w - 26, s.y + 6]], false);
    g.fillStyle(0x000000, 0.1);
    g.fillRoundedRect(s.x + 3, s.y + 6, s.w, s.h, 16);
    g.fillStyle(C.signBoard, 1);
    g.fillRoundedRect(s.x, s.y, s.w, s.h, 16);
    g.lineStyle(4, C.signDark, 1);
    g.strokeRoundedRect(s.x, s.y, s.w, s.h, 16);
    g.fillStyle(C.signLight, 0.55);
    g.fillRoundedRect(s.x + 9, s.y + 9, s.w - 18, s.h - 18, 11);
    g.fillStyle(C.signDark, 0.35);
    g.fillCircle(s.x + 22, s.y + 16, 2.6);
    g.fillCircle(s.x + s.w - 22, s.y + s.h - 16, 2.6);
    // 彩灯的铁丝
    g.lineStyle(2, 0x8C6138, 0.7);
    strokePoly(g, [[s.x + 16, s.y + s.h + 10], [s.x + s.w - 16, s.y + s.h + 10]], false);
  }

  function drawCounter(g, L) {
    const n = L.counter, t = L.table;
    g.fillStyle(0x8C6138, 0.25);
    g.fillRect(0, n.y0 - 4, WIDTH, 4);
    g.fillStyle(C.counter, 1);
    g.fillRect(0, n.y0, WIDTH, n.y1 - n.y0);
    g.fillStyle(C.counterLight, 0.9);
    g.fillRect(0, n.y0, WIDTH, 10);
    g.lineStyle(2, C.counterDark, 0.4);
    for (let x = 30; x < WIDTH; x += 60) strokePoly(g, [[x, n.y0 + 14], [x, n.y1 - 8]], false);
    g.fillStyle(C.counterDark, 0.45);
    g.fillRect(0, n.y1 - 6, WIDTH, 6);
    g.fillStyle(C.table, 1);
    g.fillRect(0, t.y0, WIDTH, t.y1 - t.y0);
    g.fillStyle(0xFFFBF2, 0.9);
    g.fillRect(0, t.y0, WIDTH, 9);
    g.lineStyle(2, C.tableLine, 0.8);
    strokePoly(g, [[0, t.y0 + 9], [WIDTH, t.y0 + 9]], false);
    g.fillStyle(C.tableStreak, 0.5);
    for (let i = 0; i < 8; i++) g.fillRect(18 + i * 64, t.y0 + 34 + (i % 3) * 30, 46, 6);
  }

  // 一个托盘格：托盘 + 甜品（名字用小字 text 另外画）
  function drawTray(g, cell) {
    g.fillStyle(0x000000, 0.06);
    g.fillRoundedRect(cell.x + 2, cell.y + 5, cell.w, cell.h, 16);
    g.fillStyle(C.tray, 0.96);
    g.fillRoundedRect(cell.x, cell.y, cell.w, cell.h, 16);
    g.lineStyle(2.5, C.trayLine, 1);
    g.strokeRoundedRect(cell.x, cell.y, cell.w, cell.h, 16);
    g.fillStyle(0xFFFFFF, 0.45);
    g.fillRoundedRect(cell.x + 8, cell.y + 8, cell.w - 16, 12, 6);
    drawDessert(g, cell.key, cell.cx, cell.cy - 12, cell.r, 0);
  }

  function drawHud(g, L) {
    const h = L.hud;
    g.fillStyle(C.hudBg, 0.95);
    g.fillRoundedRect(h.x, h.y, h.w, h.h, h.h / 2);
    g.lineStyle(2.5, C.hudLine, 1);
    g.strokeRoundedRect(h.x, h.y, h.w, h.h, h.h / 2);
    const pts = starPts(h.x + 25, h.cy, 15, 6.6, 5);
    g.fillStyle(C.star, 1);
    fillPoly(g, pts);
    g.lineStyle(2, 0xE0A63A, 0.9);
    strokePoly(g, pts, true);
  }

  function drawBubble(g, L, hover) {
    const b = L.bubble;
    const hw = b.w / 2, hh = b.h / 2;
    g.fillStyle(0x3A2A1E, 0.1);
    g.fillRoundedRect(-hw + 2, -hh + 5, b.w, b.h, 20);
    g.fillStyle(C.bubble, 0.96);
    g.fillRoundedRect(-hw, -hh, b.w, b.h, 20);
    fillPoly(g, [[-hw * 0.34, hh - 4], [hw * 0.34, hh - 4], [-hw * 0.06, hh + b.tail - 4]]);
    g.lineStyle(hover ? 3.5 : 2.5, hover ? C.bubbleHi : C.bubbleLine, 1);
    g.strokeRoundedRect(-hw, -hh, b.w, b.h, 20);
    strokePoly(g, [[-hw * 0.34, hh - 6], [hw * 0.34, hh - 6], [-hw * 0.06, hh + b.tail - 6]], false);
    if (hover) {
      g.lineStyle(3, C.bubbleHi, 0.35);
      g.strokeRoundedRect(-hw - 5, -hh - 5, b.w + 10, b.h + 10, 24);
    }
  }

  // 结算卡（文字另外用 text 画）
  function drawCard(g) {
    g.fillStyle(C.cardDim, 0.45);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    const cw = 430, ch = 380, cx = (WIDTH - cw) / 2, cy = (HEIGHT - ch) / 2;
    g.fillStyle(0x000000, 0.16);
    g.fillRoundedRect(cx + 4, cy + 9, cw, ch, 28);
    g.fillStyle(C.cardBg, 1);
    g.fillRoundedRect(cx, cy, cw, ch, 28);
    g.lineStyle(3, C.cardLine, 1);
    g.strokeRoundedRect(cx, cy, cw, ch, 28);
    g.fillStyle(C.star, 1);
    fillPoly(g, starPts(WIDTH / 2 - 92, cy + 196, 33, 14, 5));
    g.fillStyle(C.cardBtn, 1);
    g.fillRoundedRect(WIDTH / 2 - 110, cy + 262, 220, 62, 31);
    g.lineStyle(3, 0x3F86C4, 1);
    g.strokeRoundedRect(WIDTH / 2 - 110, cy + 262, 220, 62, 31);
  }

  function cardRect() {
    const cw = 430, ch = 380;
    return { x: (WIDTH - cw) / 2, y: (HEIGHT - ch) / 2, w: cw, h: ch, cy: (HEIGHT - ch) / 2 };
  }

  // ---------------------------------------------------------------- 音效
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
        master.gain.value = 0.3;
        master.connect(ctx.destination);
      } catch (e) { on = false; ctx = null; }
      return ctx;
    }

    function resume() {
      const c = ensure();
      if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* ignore */ } }
    }

    // 正弦/三角短音
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

    // 白噪声 + 带通：放东西、走路、吃东西的沙沙/噗噗声
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
      // 拿起一份甜品：轻脆的一声「嗒」
      pick: function () { tone(680, 0.07, 0.045, 0, 'triangle'); tone(1020, 0.05, 0.018, 0.03, 'sine'); },
      // 放下 / 飞回：柔和的噗
      drop: function () { noise(0.16, 0.05, 0, 1200, 420, 0.9); },
      // 递对了：C-E-G 上行三音
      right: function () {
        const notes = [0, 4, 7];
        for (let i = 0; i < notes.length; i++) tone(392 * Math.pow(2, notes[i] / 12), 0.18, 0.05, i * 0.08, 'sine');
      },
      // 客人开心吃：两声上扬 + 一点点咀嚼
      yum: function () {
        tone(560, 0.09, 0.045, 0.02, 'triangle');
        tone(780, 0.1, 0.04, 0.12, 'triangle');
        noise(0.05, 0.03, 0.22, 900, 520, 1.3);
      },
      // 给错了：温柔的低音两下，不是刺耳的错音
      wrong: function () { tone(300, 0.16, 0.05, 0, 'sine'); tone(238, 0.2, 0.042, 0.12, 'sine'); },
      // 客人进场：很轻的一声
      arrive: function () { tone(494, 0.09, 0.03, 0, 'triangle'); noise(0.04, 0.018, 0, 1500, 0, 1.4); },
      // 收摊：温暖的四音和弦
      end: function () {
        const notes = [0, 4, 7, 11];
        for (let i = 0; i < notes.length; i++) {
          const f = 261.63 * Math.pow(2, notes[i] / 12);
          tone(f, 1.4, 0.065, i * 0.11, 'sine');
          tone(f * 2, 0.9, 0.02, i * 0.11, 'sine');
        }
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class DessertScene extends Phaser.Scene {
    constructor() {
      super('DessertScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT, ROUND_SIZE: ROUND_SIZE, SLOT_COUNT: SLOT_COUNT,
        DESSERT_COUNT: DESSERT_COUNT, SHELF_COLS: SHELF_COLS, SHELF_ROWS: SHELF_ROWS,
        ARRIVE_SEC: ARRIVE_SEC, SETTLE_SEC: SETTLE_SEC, HAPPY_SEC: HAPPY_SEC, SAD_SEC: SAD_SEC,
        LEAVE_SEC: LEAVE_SEC, SERVE_FLY_SEC: SERVE_FLY_SEC, GHOST_BACK_SEC: GHOST_BACK_SEC,
        CARD_DELAY_SEC: CARD_DELAY_SEC, TAP_LOCK_SEC: TAP_LOCK_SEC,
        DRAG_LIFT: DRAG_LIFT, DRAG_R: DRAG_R, PICK_HALF_W: PICK_HALF_W, PICK_BOTTOM_PAD: PICK_BOTTOM_PAD,
        DESSERT_KEYS: DESSERTS.map(function (d) { return d.key; }),
        ANIMAL_KEYS: ANIMALS.map(function (a) { return a.key; }),
      };
      this.DESSERTS = DESSERTS;
      this.ANIMALS = ANIMALS;
      this.PALETTE = C;

      this.phase = 'play';
      this.clock = 0;
      this.stars = 0;
      this.served = 0;
      this.spawnIndex = 0;
      this.plan = buildPlan();
      this.customers = [null, null, null];
      this.lastWant = ['', '', ''];
      this.shelf = this.L.shelf.map(function (c) {
        return { i: c.i, key: c.key, name: c.name, flavor: 0, cx: c.cx, cy: c.cy, w: c.w, h: c.h, x: c.x, y: c.y };
      });
      this.drag = null;
      this.dragId = -1;
      this.hoverSlot = -1;
      this.liveProps = [];
      this.bulbT = 0;
      this.hintT = 0;
      this.endT = -1;
      this.tapLockUntil = 0;
      this.hudPop = 0;
      this.pointerHeld = false;

      // -------------------------------------------------- 静态画面
      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawSky(this.worldG, this.L);
      drawTrees(this.worldG, this.L);
      drawGrass(this.worldG, this.L);

      this.signG = this.add.graphics().setDepth(DEPTH.sign);
      drawSign(this.signG, this.L);
      this.signText = this.add.text(this.L.sign.cx, this.L.sign.cy, '森林甜品站', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.signText,
        stroke: '#FFF6E8', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH.sign + 1);

      // 招牌下面那串彩灯：每颗一个小 graphics，alpha 在 render 里慢慢闪
      this.bulbs = [];
      const sg = this.L.sign;
      const bulbCols = [C.cream, C.pink, C.mint, C.sky, C.lilac, C.cream];
      for (let i = 0; i < 6; i++) {
        const bg = this.add.graphics().setDepth(DEPTH.sign + 1);
        const bx = sg.x + 24 + (i * (sg.w - 48)) / 5;
        const by = sg.y + sg.h + 22;
        bg.fillStyle(bulbCols[i], 0.22);
        bg.fillCircle(bx, by, 10);
        bg.fillStyle(bulbCols[i], 1);
        bg.fillCircle(bx, by, 5.5);
        bg.fillStyle(0xFFFFFF, 0.7);
        bg.fillCircle(bx - 1.6, by - 1.6, 2);
        this.bulbs.push(bg);
      }

      this.counterG = this.add.graphics().setDepth(DEPTH.counter);
      drawCounter(this.counterG, this.L);

      this.trayGs = [];
      for (let i = 0; i < this.L.shelf.length; i++) {
        const cell = this.L.shelf[i];
        const g = this.add.graphics().setDepth(DEPTH.tray);
        drawTray(g, cell);
        this.trayGs.push(g);
        this.add.text(cell.cx, cell.nameY, cell.name, {
          fontFamily: FONT, fontSize: '12px', color: C.trayText,
        }).setOrigin(0.5).setDepth(DEPTH.tray + 1);
      }

      this.hintText = this.add.text(this.L.hint.x, this.L.hint.y, '把甜品拖给客人', {
        fontFamily: FONT, fontSize: '15px', color: C.hintText,
      }).setOrigin(0.5).setDepth(DEPTH.hud);

      this.hudG = this.add.graphics().setDepth(DEPTH.hud);
      drawHud(this.hudG, this.L);
      this.hudText = this.add.text(this.L.hud.x + 48, this.L.hud.cy, '0', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.hudText,
      }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);

      this.ghostG = this.add.graphics().setDepth(DEPTH.ghost);
      this.ghostG.setVisible(false);
      this.ghostKey = null;

      // -------------------------------------------------- 结算卡
      this.cardG = this.add.graphics().setDepth(DEPTH.card);
      drawCard(this.cardG);
      const cr = cardRect();
      this.cardTitle = this.add.text(WIDTH / 2, cr.y + 62, '今天收摊啦！', {
        fontFamily: FONT, fontSize: '27px', fontStyle: 'bold', color: C.cardTitle,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardBig = this.add.text(WIDTH / 2 + 8, cr.y + 196, '0', {
        fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: '#E8A33A',
      }).setOrigin(0, 0.5).setDepth(DEPTH.card + 1);
      this.cardSub = this.add.text(WIDTH / 2, cr.y + 240, '', {
        fontFamily: FONT, fontSize: '18px', color: C.cardSub,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardBtnText = this.add.text(WIDTH / 2, cr.y + 293, '再玩一次', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.cardBtnText,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.cardTip = this.add.text(WIDTH / 2, cr.y + 350, '点屏幕也可以', {
        fontFamily: FONT, fontSize: '15px', color: C.cardSub,
      }).setOrigin(0.5).setDepth(DEPTH.card + 1);
      this.setCardVisible(false);

      // -------------------------------------------------- 输入
      this.input.on('pointerdown', function (p) { this.onDown(p); }, this);
      this.input.on('pointermove', function (p) { this.onMove(p); }, this);
      this.input.on('pointerup', function (p) { this.onUp(p); }, this);
      this.input.on('pointerupoutside', function (p) { this.onUp(p); }, this);

      // -------------------------------------------------- 开局：三位客人一起进场
      for (let i = 0; i < SLOT_COUNT; i++) this.spawnCustomer(i, i % 2 === 0 ? -1 : 1);
    }

    setCardVisible(v) {
      this.cardG.setVisible(v);
      this.cardTitle.setVisible(v);
      this.cardBig.setVisible(v);
      this.cardSub.setVisible(v);
      this.cardBtnText.setVisible(v);
      this.cardTip.setVisible(v);
    }

    // -------------------------------------------------- 客人
    spawnCustomer(slot, side) {
      if (this.spawnIndex >= ROUND_SIZE) return null;
      const spec = this.plan[this.spawnIndex];
      const animal = ANIMALS[spec.animalIndex];
      const used = [this.lastWant[slot]];
      for (let i = 0; i < SLOT_COUNT; i++) {
        if (this.customers[i]) used.push(this.customers[i].want.key);
      }
      const key = pickWantAvoiding(used);
      this.lastWant[slot] = key;
      const slotX = this.L.slotXs[slot];
      const c = {
        slot: slot, animal: animal.key, tint: animal.tints[spec.tintIndex], h: animal.h,
        want: { key: key, flavor: 0 },
        state: 'in', t: 0,
        x: slotX + side * 360, ax: slotX + side * 360, bx: slotX,
        sideOut: -side,
        bob: Math.random() * Math.PI * 2,
        bubbleScale: 0, bubbleDrawn: null,
        cont: this.add.container(slotX + side * 360, this.L.groundY).setDepth(DEPTH.customer),
        bodyG: this.add.graphics(),
        bubbleG: this.add.graphics().setDepth(DEPTH.bubble),
      };
      c.cont.add(c.bodyG);
      this.customers[slot] = c;
      this.spawnIndex += 1;
      return c;
    }

    clearCustomer(c) {
      if (this.customers[c.slot] === c) this.customers[c.slot] = null;
      if (c.cont && c.cont.destroy) c.cont.destroy();
      if (c.bodyG && c.bodyG.destroy) c.bodyG.destroy();
      if (c.bubbleG && c.bubbleG.destroy) c.bubbleG.destroy();
    }

    removeCustomer(c) {
      const slot = c.slot;
      const side = c.sideOut;
      this.clearCustomer(c);
      if (this.phase === 'play' && this.served < ROUND_SIZE && this.spawnIndex < ROUND_SIZE) {
        this.spawnCustomer(slot, -side);
      }
    }

    stepCustomer(c, dt) {
      c.t += dt;
      if (c.state === 'in') {
        const k = Math.min(1, c.t / ARRIVE_SEC);
        c.x = lerp(c.ax, c.bx, easeOut(k));
        if (k >= 1) { c.state = 'settle'; c.t = 0; }
      } else if (c.state === 'settle') {
        if (c.t >= SETTLE_SEC) { c.state = 'wait'; c.t = 0; Sound.arrive(); }
      } else if (c.state === 'wait') {
        c.bob += dt;
        if (c.bubbleScale < 1) c.bubbleScale = Math.min(1, c.bubbleScale + dt / BUBBLE_POP_SEC);
      } else if (c.state === 'happy') {
        c.bob += dt;
        if (c.bubbleScale < 1) c.bubbleScale = 1;
        if (c.t >= HAPPY_SEC) {
          c.state = 'out'; c.t = 0;
          c.ax = c.x; c.bx = c.x + c.sideOut * 400;
        }
      } else if (c.state === 'sad') {
        if (c.t >= SAD_SEC) { c.state = 'wait'; c.t = 0; }
      } else if (c.state === 'out') {
        const k = Math.min(1, c.t / LEAVE_SEC);
        c.x = lerp(c.ax, c.bx, easeIn(k));
        if (k >= 1) this.removeCustomer(c);
      }
    }

    wantOf(slot) {
      const c = this.customers[slot];
      return c ? { key: c.want.key, flavor: c.want.flavor } : null;
    }

    // 接受区：气泡到脚底之间、半个身位宽（相邻站位间距 152，两块不会重叠）
    slotAt(x, y) {
      const top = this.L.bubbleTop;
      const bottom = this.L.groundY + PICK_BOTTOM_PAD;
      for (let s = 0; s < SLOT_COUNT; s++) {
        const c = this.customers[s];
        if (!c || c.state !== 'wait') continue;
        if (Math.abs(x - this.L.slotXs[s]) <= PICK_HALF_W && y >= top && y <= bottom) return s;
      }
      return -1;
    }

    shelfAt(x, y) {
      for (let i = 0; i < this.L.shelf.length; i++) {
        const c = this.L.shelf[i];
        if (x >= c.x - 6 && x <= c.x + c.w + 6 && y >= c.y - 6 && y <= c.y + c.h + 6) return i;
      }
      return -1;
    }

    // -------------------------------------------------- 递甜品
    // 返回 'ok' 递对了 / 'wrong' 递错了 / 'busy' 这会儿不能递
    serveTo(slot, key, flavor) {
      if (this.phase !== 'play') return 'busy';
      const c = this.customers[slot];
      if (!c || c.state !== 'wait') return 'busy';
      if (c.want.key !== key) {
        c.state = 'sad'; c.t = 0;
        Sound.wrong();
        return 'wrong';
      }
      c.state = 'happy'; c.t = 0;
      this.stars += 1;
      this.served += 1;
      this.hudPop = 0.35;
      Sound.right();
      Sound.yum();
      this.spawnSparkle(this.L.slotXs[slot], this.L.groundY - c.h * 0.5);
      if (this.served >= ROUND_SIZE) this.endT = CARD_DELAY_SEC;
      return 'ok';
    }

    // V1：直接把货架上的成品交到手上
    // V2：这里换成「点格子 → 进制作台做出来 → 再交到手上」，后面的递送/判定全都不用改
    acquire(shelfIdx) {
      const item = this.shelf[shelfIdx];
      if (!item) return null;
      return { key: item.key, flavor: item.flavor, from: shelfIdx };
    }

    // -------------------------------------------------- 拖拽
    onDown(p) {
      Sound.resume();
      if (this.phase === 'over') { this.tryRestart(); return; }
      if (this.drag) return;
      const i = this.shelfAt(p.x, p.y);
      if (i < 0) return;
      const item = this.acquire(i);
      if (!item) return;
      this.drag = { key: item.key, flavor: item.flavor, from: i, x: p.x, y: p.y };
      this.dragId = p.id === undefined ? -1 : p.id;
      this.trayGs[i].setAlpha(0.25);
      this.hoverSlot = this.slotAt(p.x, p.y);
      Sound.pick();
    }

    onMove(p) {
      if (!this.drag) return;
      if (this.dragId >= 0 && p && p.id !== undefined && p.id !== this.dragId) return;
      this.drag.x = p.x;
      this.drag.y = p.y;
      this.hoverSlot = this.slotAt(p.x, p.y);
    }

    onUp(p) {
      if (!this.drag) return;
      if (this.dragId >= 0 && p && p.id !== undefined && p.id !== this.dragId) return;
      const d = this.drag;
      this.drag = null;
      this.dragId = -1;
      const slot = this.slotAt(d.x, d.y);
      const res = slot >= 0 ? this.serveTo(slot, d.key, d.flavor) : 'miss';
      this.trayGs[d.from].setAlpha(1);
      this.hoverSlot = -1;
      if (res === 'ok') {
        this.flyTo(slot, d.key, d.flavor, d.x, d.y);
      } else {
        this.flyBack(d.from, d.key, d.flavor, d.x, d.y);
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

    flyTo(slot, key, flavor, x0, y0) {
      const c = this.customers[slot];
      const g = this.add.graphics().setDepth(DEPTH.fx);
      this.trackObj({
        g: g, kind: 'fly', t: 0, dur: SERVE_FLY_SEC, key: key, flavor: flavor, r: 40,
        x0: x0, y0: y0,
        x1: this.L.slotXs[slot], y1: this.L.groundY - (c ? c.h * 0.42 : 60),
      });
    }

    flyBack(from, key, flavor, x0, y0) {
      const cell = this.L.shelf[from] || this.L.shelf[0];
      const g = this.add.graphics().setDepth(DEPTH.fx);
      this.trackObj({
        g: g, kind: 'fly', t: 0, dur: GHOST_BACK_SEC, key: key, flavor: flavor, r: 40,
        x0: x0, y0: y0, x1: cell.cx, y1: cell.cy - 12,
      });
    }

    spawnSparkle(x, y) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      const parts = [];
      for (let i = 0; i < 5; i++) {
        parts.push({
          dx: (i - 2) * 24 + (Math.random() - 0.5) * 10,
          dy: -20 - Math.random() * 18,
          s: 7 + Math.random() * 4,
          heart: i % 2 === 0,
        });
      }
      this.trackObj({ g: g, kind: 'sparkle', t: 0, dur: 0.85, x: x, y: y, parts: parts });
    }

    stepFx(dt) {
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const o = this.liveProps[i];
        o.t += dt;
        const k = clamp(o.t / o.dur, 0, 1);
        o.g.clear();
        if (o.kind === 'fly') {
          const x = lerp(o.x0, o.x1, easeOut(k));
          const y = lerp(o.y0, o.y1, easeOut(k)) - Math.sin(k * Math.PI) * 18;
          o.g.setAlpha(k > 0.85 ? Math.max(0, 1 - (k - 0.85) / 0.15) : 1);
          drawDessert(o.g, o.key, x, y, o.r, o.flavor);
        } else if (o.kind === 'sparkle') {
          o.g.setAlpha(1 - k);
          for (let p = 0; p < o.parts.length; p++) {
            const pt = o.parts[p];
            const px = o.x + pt.dx * (0.5 + k);
            const py = o.y + pt.dy * k - k * 28;
            o.g.fillStyle(pt.heart ? C.pink : C.star, 1);
            fillPoly(o.g, pt.heart ? heartPts(px, py, pt.s) : starPts(px, py, pt.s, pt.s * 0.44, 5));
          }
        }
        if (k >= 1) {
          this.untrackObj(o);
          if (o.g && o.g.destroy) o.g.destroy();
        }
      }
    }

    // -------------------------------------------------- 每帧推进
    step(dt) {
      this.clock += dt;
      this.bulbT += dt;
      if (this.hudPop > 0) this.hudPop = Math.max(0, this.hudPop - dt * 1.4);
      // 结算卡出来以后在场剩下的客人也要把路走完（只是不再补位）
      for (let s = 0; s < SLOT_COUNT; s++) {
        const c = this.customers[s];
        if (c) this.stepCustomer(c, dt);
      }
      this.stepFx(dt);
      this.hintT += dt;
      if (this.hintT > HINT_HOLD_SEC) {
        this.hintText.setAlpha(Math.max(0, 1 - (this.hintT - HINT_HOLD_SEC) / HINT_FADE_SEC));
      }
      if (this.endT >= 0) {
        this.endT -= dt;
        if (this.endT <= 0) { this.endT = -1; this.showCard(); }
      }
    }

    render() {
      for (let s = 0; s < SLOT_COUNT; s++) {
        const c = this.customers[s];
        if (!c) continue;
        const hover = this.hoverSlot === s;
        const bob = c.state === 'in' ? 0 : Math.sin(c.bob * 2.6) * 2.5;
        let jump = 0;
        if (c.state === 'happy') jump = -Math.abs(Math.sin((c.t / HAPPY_SEC) * Math.PI * 3)) * 16;
        const lean = hover ? (this.L.slotXs[s] < WIDTH / 2 ? 6 : (this.L.slotXs[s] > WIDTH / 2 ? -6 : 0)) : 0;
        c.cont.setPosition(c.x + lean, this.L.groundY + bob + jump);
        c.cont.setScale(hover ? 1.05 : 1);
        c.cont.setRotation(c.state === 'sad' ? Math.sin(c.t * 34) * 0.09 : 0);
        c.bodyG.clear();
        drawAnimal(c.bodyG, c.animal, c.tint, c.h,
          c.state === 'happy' ? 'happy' : (c.state === 'sad' ? 'sad' : 'wait'));
        if (c.state === 'in' || c.state === 'settle') {
          c.bubbleG.setVisible(false);
        } else {
          c.bubbleG.setVisible(true);
          const k = clamp(c.bubbleScale, 0, 1);
          const sc = k < 1 ? easeOutBack(k) : 1;
          c.bubbleG.setPosition(c.x, this.L.bubble.cy + bob * 0.6).setScale(Math.max(0.05, sc));
          c.bubbleG.setAlpha(c.state === 'out' ? Math.max(0, 1 - c.t / LEAVE_SEC) : 1);
          const stamp = c.want.key + (hover ? '1' : '0');
          if (c.bubbleDrawn !== stamp) {
            c.bubbleG.clear();
            drawBubble(c.bubbleG, this.L, hover);
            drawDessert(c.bubbleG, c.want.key, 0, -8, this.L.bubble.r, c.want.flavor);
            c.bubbleDrawn = stamp;
          }
        }
      }

      if (this.drag) {
        this.ghostG.setVisible(true);
        this.ghostG.setScale(1.15);
        this.ghostG.setPosition(this.drag.x, this.drag.y - DRAG_LIFT);
        const stamp = this.drag.key + ':' + this.drag.flavor;
        if (this.ghostKey !== stamp) {
          this.ghostG.clear();
          drawDessert(this.ghostG, this.drag.key, 0, 0, DRAG_R, this.drag.flavor);
          this.ghostKey = stamp;
        }
      } else if (this.ghostG.visible) {
        this.ghostG.setVisible(false);
        this.ghostKey = null;
      }

      for (let i = 0; i < this.bulbs.length; i++) {
        this.bulbs[i].setAlpha(0.42 + 0.58 * (0.5 + 0.5 * Math.sin(this.bulbT * 2.2 + i * 0.95)));
      }
      this.hudText.setText(String(this.stars));
      this.hudText.setScale(1 + this.hudPop * 0.5);
    }

    // -------------------------------------------------- 一轮结束 / 重开
    showCard() {
      this.phase = 'over';
      this.cardBig.setText(String(this.stars));
      this.cardSub.setText('服务了 ' + ROUND_SIZE + ' 位客人');
      this.setCardVisible(true);
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
      for (let s = 0; s < SLOT_COUNT; s++) {
        const c = this.customers[s];
        if (c) this.clearCustomer(c);
      }
      this.customers = [null, null, null];
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const o = this.liveProps[i];
        if (o.g && o.g.destroy) o.g.destroy();
      }
      this.liveProps = [];
      this.drag = null;
      this.dragId = -1;
      this.hoverSlot = -1;
      this.ghostG.setVisible(false);
      this.ghostKey = null;
      for (let i = 0; i < this.trayGs.length; i++) this.trayGs[i].setAlpha(1);
      this.stars = 0;
      this.served = 0;
      this.spawnIndex = 0;
      this.lastWant = ['', '', ''];
      this.plan = buildPlan();
      this.clock = 0;
      this.endT = -1;
      this.hudPop = 0;
      this.hintT = 0;
      this.hintText.setAlpha(1);
      this.phase = 'play';
      this.setCardVisible(false);
      for (let i = 0; i < SLOT_COUNT; i++) this.spawnCustomer(i, i % 2 === 0 ? -1 : 1);
    }

    // -------------------------------------------------- 测试钩子（非公共 API）
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

  window.DessertScene = DessertScene;
})();
