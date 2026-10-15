/*
 * 森林甜品站（V2）：竖屏 540×960 的甜品摊位小玩具。
 * 顶部是甜品店的木招牌，中间是森林里来买甜点的动物客人，底部是玩家面前的木台面。
 * 客人头顶的气泡里画出想吃的（雪糕 / 热狗 / 薯条），玩家把摊在桌上的材料按顺序拖到
 * 雪糕机 / 组装盘 / 薯条盒上做好，成品落到桌子下方的出餐垫，再从出餐垫拖给客人。
 * 给对了客人开心吃完走人、下一位补位；给错了客人轻轻摇头、成品飞回出餐垫，不扣星、不结束。
 * 一轮固定 8 位客人（同时最多 3 位），服务满 8 位弹结算卡「今天收摊啦」。
 * 没有倒计时、没有进度条、没有存档、没有背景音乐；画面全部 Phaser.Graphics 程序化绘制，
 * 音效 WebAudio 合成，不加载任何素材文件。
 *
 * 制作统一走 placeMaterial(matKey, stationKey)、递餐统一走 serveTo(slot, dishKey)：
 * 以后想再加一道菜，只要往 DISHES 里补一条、在 RECIPES 里写好步骤、再加一个 drawDish 分支，
 * 拖拽 / 判定 / 计分 / HUD / 结算卡都不用改。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const ROUND_SIZE = 8;           // 一轮服务 8 位客人
  const SLOT_COUNT = 3;           // 同时最多 3 位客人在等
  const DISH_COUNT = 3;           // 3 样菜：雪糕 / 热狗 / 薯条
  const MATERIAL_COUNT = 5;       // 桌上摊着 5 样材料
  const STATION_COUNT = 3;        // 3 个工位：雪糕机 / 组装盘 / 薯条盒
  const MAT_SLOTS = 3;            // 出餐垫最多放 3 份成品

  const ARRIVE_SEC = 0.5;         // 客人走进站位
  const SETTLE_SEC = 0.3;         // 站定后停一下再冒气泡
  const BUBBLE_POP_SEC = 0.25;    // 气泡弹出
  const HAPPY_SEC = 0.7;          // 吃到东西开心跳
  const SAD_SEC = 0.4;            // 给错了摇头
  const LEAVE_SEC = 0.5;          // 满意地走出画面
  const SERVE_FLY_SEC = 0.3;      // 成品飞到客人手上
  const MAKE_SEC = 0.5;           // 最后一步做完 -> 成品飞到出餐垫
  const GHOST_BACK_SEC = 0.25;    // 没送出去，飞回出餐垫
  const PLACE_FLY_SEC = 0.16;     // 材料从手指飞到工位
  const CARD_DELAY_SEC = 0.8;     // 最后一位服务完到结算卡
  const TAP_LOCK_SEC = 0.4;       // 结算卡出现后的防误触
  const HINT_HOLD_SEC = 6;        // 台面提示停留多久才淡出
  const HINT_FADE_SEC = 0.6;
  const TIP_HOLD_SEC = 1.9;       // 「先把手上的送出去吧～」气泡

  const DRAG_LIFT = 40;           // 拖拽幻影比手指高多少
  const DRAG_R = 34;              // 幻影里的绘制半径（再乘 1.15）
  const MAT_R = 34;               // 桌上的材料绘制半径
  const MAT_HIT = 44;             // 材料的抓取半径（相邻 92，两块不重叠）
  const STATION_R = 44;           // 工位绘制半径
  const STATION_HIT = 58;         // 工位的命中半径（相邻 140，两块不重叠）
  const SERVE_R = 42;             // 出餐垫上成品的抓取半径（相邻 95）
  const PICK_HALF_W = 70;         // 客人接受区半宽（站位间距 152，两块不会重叠）
  const PICK_BOTTOM_PAD = 30;     // 接受区下沿越过脚底多少
  const GHOST_ALPHA = 0.13;       // 盘上「下一步」提示的幽灵轮廓

  // 马卡龙粉彩 + 桌面木头/食材色
  const C = {
    skyTop: 0xCDEBFA, skyBottom: 0xEAF7FF,
    tree1: 0x86C97F, tree2: 0x6FB86B, tree3: 0x9AD893, trunk: 0xA9856A,
    grass: 0xA8D98A, grassDark: 0x8CC673, path: 0xF2E6CB,
    signBoard: 0xC08A5E, signDark: 0x8C6138, signLight: 0xD9AA7C, signText: '#6B4A32',
    counter: 0xB98A5E, counterLight: 0xD8B18A, counterDark: 0xA5744A,
    table: 0xF3E3CE, tableLine: 0xE2CDAE, tableStreak: 0xEADABF,
    wood: 0xC79A6A, woodDark: 0xA87C50, woodLight: 0xE6CBA6,
    matBoard: 0xF0DCBA, matBoardDark: 0xD2B287, matRing: 0xC9A87B,
    bubble: 0xFFFFFF, bubbleLine: 0xE0C6A6, bubbleHi: 0xFFB3C7,
    hudBg: 0xFFF6E8, hudLine: 0xE0C6A6,
    pink: 0xFFB3C7, cream: 0xFFE3A3, mint: 0xA8E6CF, sky: 0xA9D7F2, lilac: 0xCDBBF0,
    ivory: 0xFFF6E8, berry: 0xF4787E, cocoa: 0xB98A5E,
    cone: 0xE0A85E, coneDark: 0xB87F35,
    bunTop: 0xE8B86A, bunDark: 0xC08F44,
    sausage: 0xE2726A, sausageDark: 0xB54F49,
    lettuce: 0x8CC96B, lettuceDark: 0x66A64B,
    fry: 0xF7C846, fryDark: 0xD8A21F,
    fryBox: 0xF0554F, fryBoxDark: 0xC03A36,
    steel: 0xE9EEF2, steelDark: 0xB9C4CC,
    plateW: 0xFFFDF6, plateLine: 0xE0D6C4,
    ghostFill: 0xFFF6E8, ghostLine: 0xC9A87B,
    ink: 0x7A5238, eye: 0x4A3A2E, star: 0xFFC94D,
    cardBg: 0xFFFFFF, cardLine: 0xE6D8C6, cardBtn: 0x5BA8E8, cardDim: 0x3A2A1E,
    hudText: '#6B4A32', nameText: '#A68D70', hintText: '#FFF6E8', hintStroke: '#8C6138',
    cardTitle: '#5C4A38', cardSub: '#8C7A66', cardBtnText: '#FFFFFF',
  };

  // 场景深度：天空/森林/草地(0) -> 招牌(1) -> 客人(3) -> 气泡(4) -> 柜台(6) -> 桌面(7)
  // -> 出餐垫上的成品(8) -> 拖拽幻影(12) -> 特效(14) -> HUD(20) -> 结算遮罩(40)
  const DEPTH = {
    world: 0, sign: 1, customer: 3, bubble: 4, counter: 6, table: 7, dish: 8,
    ghost: 12, fx: 14, hud: 20, card: 40,
  };

  // 3 样菜：客人点的、气泡里画的、出餐垫上放的，都是这三样
  const DISHES = [
    { key: 'icecream', name: '雪糕' },
    { key: 'hotdog', name: '热狗' },
    { key: 'fries', name: '薯条' },
  ];

  // 5 样材料：摊在桌上，取之不尽
  const MATERIALS = [
    { key: 'cone', name: '甜筒' },
    { key: 'bun', name: '面包' },
    { key: 'sausage', name: '香肠' },
    { key: 'lettuce', name: '生菜' },
    { key: 'fries', name: '薯条' },
  ];

  // 3 个工位：把材料拖到这儿
  const STATIONS = [
    { key: 'machine', name: '雪糕机' },
    { key: 'plate', name: '盘子' },
    { key: 'box', name: '薯条盒' },
  ];

  // 每道菜按顺序要放的步骤：雪糕 1 步、薯条 1 步、热狗 3 步
  const RECIPES = {
    icecream: [{ mat: 'cone', station: 'machine' }],
    fries: [{ mat: 'fries', station: 'box' }],
    hotdog: [
      { mat: 'bun', station: 'plate' },
      { mat: 'sausage', station: 'plate' },
      { mat: 'lettuce', station: 'plate' },
    ],
  };

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
    const slotXs = [118, 270, 422];      // 三个站位
    const groundY = 552;                 // 客人脚底的草地线
    const grassY0 = 470, grassY1 = 566;
    const treeY0 = 330, treeY1 = grassY0;
    const sign = { x: 46, y: 56, w: 364, h: 78, cx: 228, cy: 95 };
    const hud = { x: 430, y: 74, w: 88, h: 48, cx: 474, cy: 98 };
    const bubble = { w: 118, h: 96, cy: 250, tail: 40, r: 32 };
    const counter = { y0: grassY1, y1: 610 };   // 柜台前沿木板
    const table = { y0: 610, y1: 960 };         // 台面

    // 材料排：桌上靠后一横排，5 样摊开（左右对称，步长 92）
    const matXs = [86, 178, 270, 362, 454];
    const matY = 676;
    const materials = MATERIALS.map(function (m, i) {
      return { i: i, key: m.key, name: m.name, cx: matXs[i], cy: matY, r: MAT_R, nameY: matY + 46 };
    });

    // 工位排：材料下方一横排 3 个（步长 140）
    const stationXs = [130, 270, 410];
    const stationY = 800;
    const stations = STATIONS.map(function (s, i) {
      return { i: i, key: s.key, name: s.name, cx: stationXs[i], cy: stationY, r: STATION_R, nameY: stationY + 60 };
    });

    // 出餐垫：桌子最底下一块木垫，三个位置
    const matPad = { x: 120, y: 872, w: 300, h: 76, cx: 270, cy: 910 };
    const matSlots = [
      { x: 175, y: 910 }, { x: 270, y: 910 }, { x: 365, y: 910 },
    ];

    return {
      slotXs: slotXs, groundY: groundY,
      grassY0: grassY0, grassY1: grassY1, treeY0: treeY0, treeY1: treeY1,
      sign: sign, hud: hud, bubble: bubble, counter: counter, table: table,
      materials: materials, stations: stations, matPad: matPad, matSlots: matSlots,
      counterY: counter.y0, tableY0: table.y0,
      hint: { x: WIDTH / 2, y: 588 },
      tip: { x: WIDTH / 2, y: 622, w: 268, h: 34 },
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
  function shuffledIdx(n) {
    const a = [];
    for (let i = 0; i < n; i++) a.push(i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function materialByKey(key) {
    for (let i = 0; i < MATERIALS.length; i++) if (MATERIALS[i].key === key) return MATERIALS[i];
    return null;
  }
  function dishByKey(key) {
    for (let i = 0; i < DISHES.length; i++) if (DISHES[i].key === key) return DISHES[i];
    return null;
  }

  // 一轮 8 位客人的排列：菜品「三样轮着来」（同一时间在场的三位客人永远不点重样），
  // 动物「相邻不重样」。
  function buildPlan() {
    const cycle = shuffledIdx(DISH_COUNT).map(function (i) { return DISHES[i].key; });
    let animals = null;
    for (let attempt = 0; attempt < 240 && !animals; attempt++) {
      const shuffled = shuffledIdx(ROUND_SIZE).map(function (i) { return i % ANIMALS.length; });
      let good = true;
      for (let i = 1; i < shuffled.length; i++) {
        if (shuffled[i] === shuffled[i - 1]) { good = false; break; }
      }
      if (good) animals = shuffled;
    }
    if (!animals) {
      animals = [];
      for (let i = 0; i < ROUND_SIZE; i++) animals.push(i % ANIMALS.length);
    }
    const plan = [];
    for (let i = 0; i < ROUND_SIZE; i++) {
      plan.push({
        animalIndex: animals[i],
        tintIndex: Math.floor(Math.random() * 3),
        wantKey: cycle[i % DISH_COUNT],
      });
    }
    return plan;
  }
  // ---------------------------------------------------------------- 成品绘制
  // 三样做好的东西：都以 (cx, cy) 为中心、r 为基准半径（≈30~40）
  const DRAW_DISH = {
    // 雪糕：蛋筒 + 两个球 + 小尖顶 + 樱桃
    icecream: function (g, cx, cy, r) {
      const lw = Math.max(1.5, r * 0.06);
      g.fillStyle(C.cone, 1);
      fillPoly(g, [[cx - r * 0.42, cy - r * 0.06], [cx + r * 0.42, cy - r * 0.06], [cx, cy + r * 0.94]]);
      g.lineStyle(lw, C.ink, 0.85);
      strokePoly(g, [[cx - r * 0.42, cy - r * 0.06], [cx + r * 0.42, cy - r * 0.06], [cx, cy + r * 0.94]], true);
      g.lineStyle(lw * 0.8, C.coneDark, 0.8);
      strokePoly(g, [[cx - r * 0.22, cy + r * 0.14], [cx + r * 0.08, cy + r * 0.46]], false);
      strokePoly(g, [[cx - r * 0.02, cy + r * 0.06], [cx + r * 0.26, cy + r * 0.4]], false);
      g.fillStyle(C.pink, 1);
      fillEllipse(g, cx - r * 0.2, cy - r * 0.28, r * 0.44, r * 0.38);
      g.fillStyle(C.cream, 1);
      fillEllipse(g, cx + r * 0.24, cy - r * 0.24, r * 0.4, r * 0.35);
      g.lineStyle(lw, C.ink, 0.8);
      strokeEllipse(g, cx - r * 0.2, cy - r * 0.28, r * 0.44, r * 0.38);
      strokeEllipse(g, cx + r * 0.24, cy - r * 0.24, r * 0.4, r * 0.35);
      g.fillStyle(C.mint, 1);
      fillPoly(g, [[cx - r * 0.17, cy - r * 0.56], [cx + r * 0.17, cy - r * 0.56], [cx, cy - r * 0.98]]);
      g.lineStyle(lw * 0.85, C.ink, 0.8);
      strokePoly(g, [[cx - r * 0.17, cy - r * 0.56], [cx + r * 0.17, cy - r * 0.56], [cx, cy - r * 0.98]], true);
      g.fillStyle(C.berry, 1);
      g.fillCircle(cx, cy - r * 1.08, r * 0.14);
      g.lineStyle(lw * 0.8, C.ink, 0.8);
      g.strokeCircle(cx, cy - r * 1.08, r * 0.14);
      g.fillStyle(0xFFFFFF, 0.5);
      g.fillCircle(cx - r * 0.32, cy - r * 0.38, r * 0.11);
    },

    // 热狗：面包夹香肠 + 生菜 + 一点酱
    hotdog: function (g, cx, cy, r) {
      const lw = Math.max(1.5, r * 0.06);
      g.fillStyle(C.bunTop, 1);
      fillEllipse(g, cx, cy + r * 0.18, r * 0.9, r * 0.4);
      g.lineStyle(lw, C.ink, 0.85);
      strokeEllipse(g, cx, cy + r * 0.18, r * 0.9, r * 0.4);
      g.fillStyle(C.lettuce, 1);
      for (let i = -2; i <= 2; i++) g.fillCircle(cx + i * r * 0.28, cy - r * 0.02, r * 0.16);
      g.lineStyle(lw * 0.8, C.lettuceDark, 0.7);
      for (let i = -2; i <= 2; i++) g.strokeCircle(cx + i * r * 0.28, cy - r * 0.02, r * 0.16);
      g.fillStyle(C.sausage, 1);
      fillEllipse(g, cx, cy - r * 0.14, r * 0.78, r * 0.22);
      g.lineStyle(lw, C.sausageDark, 0.9);
      strokeEllipse(g, cx, cy - r * 0.14, r * 0.78, r * 0.22);
      g.fillStyle(C.bunTop, 1);
      fillEllipse(g, cx - r * 0.44, cy - r * 0.34, r * 0.4, r * 0.26);
      fillEllipse(g, cx + r * 0.44, cy - r * 0.34, r * 0.4, r * 0.26);
      g.lineStyle(lw, C.ink, 0.85);
      strokeEllipse(g, cx - r * 0.44, cy - r * 0.34, r * 0.4, r * 0.26);
      strokeEllipse(g, cx + r * 0.44, cy - r * 0.34, r * 0.4, r * 0.26);
      g.lineStyle(Math.max(2, r * 0.1), C.berry, 1);
      strokePoly(g, [[cx - r * 0.5, cy - r * 0.42], [cx - r * 0.18, cy - r * 0.5], [cx + r * 0.16, cy - r * 0.36], [cx + r * 0.5, cy - r * 0.46]], false);
    },

    // 薯条：红盒子里插着一把薯条
    fries: function (g, cx, cy, r) {
      const lw = Math.max(1.5, r * 0.06);
      const bars = [[-0.42, -0.98], [-0.2, -1.08], [0.02, -0.96], [0.24, -1.04], [0.44, -0.86]];
      for (let i = 0; i < bars.length; i++) {
        const bx = cx + bars[i][0] * r, by = cy + bars[i][1] * r;
        g.fillStyle(C.fry, 1);
        g.fillRoundedRect(bx - r * 0.11, by, r * 0.22, r * 0.56, r * 0.08);
        g.lineStyle(lw * 0.8, C.fryDark, 0.85);
        g.strokeRoundedRect(bx - r * 0.11, by, r * 0.22, r * 0.56, r * 0.08);
      }
      g.fillStyle(C.fryBox, 1);
      fillPoly(g, [[cx - r * 0.56, cy - r * 0.22], [cx + r * 0.56, cy - r * 0.22], [cx + r * 0.4, cy + r * 0.86], [cx - r * 0.4, cy + r * 0.86]]);
      g.lineStyle(lw, C.ink, 0.85);
      strokePoly(g, [[cx - r * 0.56, cy - r * 0.22], [cx + r * 0.56, cy - r * 0.22], [cx + r * 0.4, cy + r * 0.86], [cx - r * 0.4, cy + r * 0.86]], true);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillRoundedRect(cx - r * 0.56, cy - r * 0.34, r * 1.12, r * 0.16, r * 0.06);
      g.fillStyle(0xFFFFFF, 0.35);
      fillPoly(g, [[cx - r * 0.4, cy + r * 0.1], [cx - r * 0.24, cy + r * 0.1], [cx - r * 0.2, cy + r * 0.78], [cx - r * 0.36, cy + r * 0.78]]);
    },
  };

  function drawDish(g, key, cx, cy, r) {
    const fn = DRAW_DISH[key];
    if (fn) fn(g, cx, cy, r);
  }

  // ---------------------------------------------------------------- 材料绘制
  // 摊在桌上的生料：都没有画框，只有自己的形状 + 一小片落影
  const DRAW_MATERIAL = {
    // 一小叠甜筒
    cone: function (g, cx, cy, r) {
      g.fillStyle(0x3A2A1E, 0.14);
      fillEllipse(g, cx, cy + r * 0.84, r * 0.82, r * 0.2);
      g.fillStyle(C.coneDark, 1);
      fillPoly(g, [[cx - r * 0.7, cy - r * 0.14], [cx - r * 0.08, cy - r * 0.26], [cx - r * 0.38, cy + r * 0.78]]);
      g.lineStyle(2.6, C.ink, 0.7);
      strokePoly(g, [[cx - r * 0.7, cy - r * 0.14], [cx - r * 0.08, cy - r * 0.26], [cx - r * 0.38, cy + r * 0.78]], true);
      g.fillStyle(C.cone, 1);
      fillPoly(g, [[cx - r * 0.28, cy - r * 0.42], [cx + r * 0.68, cy - r * 0.1], [cx + r * 0.18, cy + r * 0.84]]);
      g.lineStyle(2.8, C.ink, 0.8);
      strokePoly(g, [[cx - r * 0.28, cy - r * 0.42], [cx + r * 0.68, cy - r * 0.1], [cx + r * 0.18, cy + r * 0.84]], true);
      g.lineStyle(2, C.coneDark, 0.85);
      strokePoly(g, [[cx - r * 0.02, cy - r * 0.2], [cx + r * 0.34, cy + r * 0.2]], false);
      strokePoly(g, [[cx + r * 0.16, cy - r * 0.28], [cx + r * 0.5, cy + r * 0.08]], false);
    },

    // 一个面包胚
    bun: function (g, cx, cy, r) {
      g.fillStyle(0x3A2A1E, 0.14);
      fillEllipse(g, cx, cy + r * 0.54, r * 0.84, r * 0.2);
      g.fillStyle(C.bunTop, 1);
      fillEllipse(g, cx, cy + r * 0.08, r * 0.86, r * 0.52);
      g.lineStyle(2.8, C.ink, 0.8);
      strokeEllipse(g, cx, cy + r * 0.08, r * 0.86, r * 0.52);
      g.lineStyle(3, C.bunDark, 0.85);
      strokePoly(g, [[cx - r * 0.52, cy + r * 0.02], [cx - r * 0.16, cy - r * 0.16], [cx + r * 0.2, cy - r * 0.02], [cx + r * 0.52, cy - r * 0.12]], false);
      g.fillStyle(0xFFF6E8, 0.95);
      g.fillCircle(cx - r * 0.3, cy - r * 0.22, r * 0.07);
      g.fillCircle(cx + r * 0.06, cy - r * 0.3, r * 0.07);
      g.fillCircle(cx + r * 0.36, cy - r * 0.16, r * 0.07);
    },

    // 两根香肠
    sausage: function (g, cx, cy, r) {
      g.fillStyle(0x3A2A1E, 0.14);
      fillEllipse(g, cx, cy + r * 0.54, r * 0.8, r * 0.2);
      g.fillStyle(C.sausageDark, 1);
      fillEllipse(g, cx + r * 0.24, cy - r * 0.32, r * 0.62, r * 0.2);
      g.lineStyle(2.6, C.ink, 0.8);
      strokeEllipse(g, cx + r * 0.24, cy - r * 0.32, r * 0.62, r * 0.2);
      g.fillStyle(C.sausage, 1);
      fillEllipse(g, cx - r * 0.1, cy + r * 0.12, r * 0.74, r * 0.24);
      g.lineStyle(2.8, C.ink, 0.8);
      strokeEllipse(g, cx - r * 0.1, cy + r * 0.12, r * 0.74, r * 0.24);
      g.lineStyle(2.2, C.sausageDark, 0.8);
      strokePoly(g, [[cx - r * 0.44, cy + r * 0.0], [cx - r * 0.28, cy + r * 0.24]], false);
      strokePoly(g, [[cx + r * 0.06, cy - r * 0.02], [cx + r * 0.22, cy + r * 0.22]], false);
      g.fillStyle(0xFFFFFF, 0.4);
      fillEllipse(g, cx - r * 0.35, cy + r * 0.02, r * 0.24, r * 0.06);
    },

    // 一丛生菜
    lettuce: function (g, cx, cy, r) {
      g.fillStyle(0x3A2A1E, 0.14);
      fillEllipse(g, cx, cy + r * 0.56, r * 0.8, r * 0.2);
      const leaves = [[-0.34, 0.14, 1.0], [0.34, 0.16, 1.05], [0, -0.16, 1.12]];
      for (let i = 0; i < leaves.length; i++) {
        const L2 = leaves[i];
        const lx = cx + L2[0] * r, ly = cy + L2[1] * r;
        const rx = r * 0.46 * L2[2], ry = r * 0.34 * L2[2];
        g.fillStyle(i === 1 ? C.lettuceDark : C.lettuce, 1);
        fillEllipse(g, lx, ly, rx, ry);
        g.lineStyle(2.6, C.ink, 0.78);
        strokeEllipse(g, lx, ly, rx, ry);
        g.fillStyle(C.lettuceDark, 0.35);
        fillEllipse(g, lx - rx * 0.3, ly + ry * 0.25, rx * 0.36, ry * 0.32);
      }
    },

    // 一堆散着的薯条
    fries: function (g, cx, cy, r) {
      g.fillStyle(0x3A2A1E, 0.14);
      fillEllipse(g, cx, cy + r * 0.72, r * 0.84, r * 0.2);
      const bars = [[-0.6, -0.08], [-0.34, -0.3], [-0.04, -0.44], [0.26, -0.34], [0.52, -0.12], [-0.22, 0.08], [0.16, 0.04]];
      for (let i = 0; i < bars.length; i++) {
        const bx = cx + bars[i][0] * r, by = cy + bars[i][1] * r;
        g.fillStyle(i % 2 === 0 ? C.fry : lighten(C.fry, 0.16), 1);
        g.fillRoundedRect(bx - r * 0.1, by, r * 0.2, r * 0.74, r * 0.07);
        g.lineStyle(2, C.fryDark, 0.8);
        g.strokeRoundedRect(bx - r * 0.1, by, r * 0.2, r * 0.74, r * 0.07);
      }
    },
  };

  function drawMaterial(g, key, cx, cy, r) {
    const fn = DRAW_MATERIAL[key];
    if (fn) fn(g, cx, cy, r);
  }
  // ---------------------------------------------------------------- 工位绘制
  // 「下一步要放什么」的淡色幽灵轮廓：不靠文字，孩子看形状就知道
  function drawGhostOutline(g, matKey, cx, cy, r) {
    g.fillStyle(C.ink, GHOST_ALPHA);
    g.lineStyle(2.5, C.ink, 0.6);
    if (matKey === 'bun') {
      fillEllipse(g, cx, cy - r * 0.06, r * 0.72, r * 0.34);
      strokeEllipse(g, cx, cy - r * 0.06, r * 0.72, r * 0.34);
    } else if (matKey === 'sausage') {
      fillEllipse(g, cx, cy - r * 0.3, r * 0.66, r * 0.2);
      strokeEllipse(g, cx, cy - r * 0.3, r * 0.66, r * 0.2);
    } else if (matKey === 'lettuce') {
      for (let i = -1; i <= 1; i++) {
        g.fillCircle(cx + i * r * 0.26, cy - r * 0.44, r * 0.16);
        g.strokeCircle(cx + i * r * 0.26, cy - r * 0.44, r * 0.16);
      }
    } else {
      g.fillCircle(cx, cy, r * 0.34);
      g.strokeCircle(cx, cy, r * 0.34);
    }
  }

  // 一个工位：key = machine 雪糕机 / plate 组装盘 / box 薯条盒
  function drawStation(g, key, cx, cy, r, placed, highlight, ghostMat) {
    if (highlight) {
      g.fillStyle(C.star, 0.16);
      g.fillCircle(cx, cy + r * 0.1, r * 1.5);
      g.lineStyle(3.5, C.star, 0.6);
      g.strokeCircle(cx, cy + r * 0.1, r * 1.42);
    }
    g.fillStyle(0x3A2A1E, 0.14);
    fillEllipse(g, cx, cy + r * 0.82, r * 0.94, r * 0.22);

    if (key === 'machine') {
      // 机身
      g.fillStyle(C.steel, 1);
      g.fillRoundedRect(cx - r * 0.88, cy - r * 0.5, r * 1.76, r * 1.34, r * 0.22);
      g.lineStyle(3, C.ink, 0.8);
      g.strokeRoundedRect(cx - r * 0.88, cy - r * 0.5, r * 1.76, r * 1.34, r * 0.22);
      // 顶部料斗
      g.fillStyle(C.pink, 1);
      fillPoly(g, [[cx - r * 0.62, cy - r * 0.5], [cx + r * 0.62, cy - r * 0.5], [cx + r * 0.46, cy - r * 0.96], [cx - r * 0.46, cy - r * 0.96]]);
      g.lineStyle(3, C.ink, 0.8);
      strokePoly(g, [[cx - r * 0.62, cy - r * 0.5], [cx + r * 0.62, cy - r * 0.5], [cx + r * 0.46, cy - r * 0.96], [cx - r * 0.46, cy - r * 0.96]], true);
      g.fillStyle(0xFFFFFF, 0.4);
      fillPoly(g, [[cx - r * 0.5, cy - r * 0.56], [cx - r * 0.2, cy - r * 0.56], [cx - r * 0.3, cy - r * 0.88], [cx - r * 0.44, cy - r * 0.88]]);
      // 出料口
      g.fillStyle(C.steelDark, 1);
      g.fillRoundedRect(cx - r * 0.28, cy + r * 0.14, r * 0.56, r * 0.26, r * 0.09);
      g.lineStyle(2.4, C.ink, 0.7);
      g.strokeRoundedRect(cx - r * 0.28, cy + r * 0.14, r * 0.56, r * 0.26, r * 0.09);
      // 压杆
      g.fillStyle(C.berry, 1);
      g.fillRoundedRect(cx + r * 0.5, cy - r * 0.26, r * 0.18, r * 0.68, r * 0.09);
      g.lineStyle(2.4, C.ink, 0.75);
      g.strokeRoundedRect(cx + r * 0.5, cy - r * 0.26, r * 0.18, r * 0.68, r * 0.09);
      // 已经放了甜筒：在出料口下面顶着一个甜筒
      if (placed.indexOf('cone') >= 0) drawDish(g, 'icecream', cx, cy + r * 0.9, r * 0.5);
    } else if (key === 'plate') {
      // 盘子
      g.fillStyle(C.plateW, 1);
      fillEllipse(g, cx, cy + r * 0.2, r * 1.08, r * 0.42);
      g.lineStyle(3, C.plateLine, 1);
      strokeEllipse(g, cx, cy + r * 0.2, r * 1.08, r * 0.42);
      g.fillStyle(0xFFFFFF, 0.7);
      fillEllipse(g, cx, cy + r * 0.14, r * 0.86, r * 0.3);
      const hasBun = placed.indexOf('bun') >= 0;
      const hasSausage = placed.indexOf('sausage') >= 0;
      const hasLettuce = placed.indexOf('lettuce') >= 0;
      if (hasBun && hasSausage && hasLettuce) {
        drawDish(g, 'hotdog', cx, cy - r * 0.12, r * 0.62);
      } else {
        if (hasBun) {
          g.fillStyle(C.bunTop, 1);
          fillEllipse(g, cx, cy - r * 0.06, r * 0.72, r * 0.34);
          g.lineStyle(2.8, C.ink, 0.8);
          strokeEllipse(g, cx, cy - r * 0.06, r * 0.72, r * 0.34);
          g.lineStyle(2.6, C.bunDark, 0.8);
          strokePoly(g, [[cx - r * 0.44, cy - r * 0.1], [cx - r * 0.12, cy - r * 0.24], [cx + r * 0.2, cy - r * 0.12]], false);
        }
        if (hasSausage) {
          g.fillStyle(C.sausage, 1);
          fillEllipse(g, cx, cy - r * 0.3, r * 0.66, r * 0.2);
          g.lineStyle(2.8, C.ink, 0.85);
          strokeEllipse(g, cx, cy - r * 0.3, r * 0.66, r * 0.2);
          g.lineStyle(2.2, C.sausageDark, 0.85);
          strokePoly(g, [[cx - r * 0.36, cy - r * 0.36], [cx - r * 0.2, cy - r * 0.22]], false);
          strokePoly(g, [[cx + r * 0.06, cy - r * 0.38], [cx + r * 0.22, cy - r * 0.24]], false);
        }
        if (hasLettuce) {
          g.fillStyle(C.lettuce, 1);
          for (let i = -1; i <= 1; i++) g.fillCircle(cx + i * r * 0.26, cy - r * 0.44, r * 0.16);
          g.lineStyle(2.2, C.lettuceDark, 0.7);
          for (let i = -1; i <= 1; i++) g.strokeCircle(cx + i * r * 0.26, cy - r * 0.44, r * 0.16);
        }
      }
    } else {
      // 薯条盒（空着等薯条）
      g.fillStyle(C.fryBox, 1);
      fillPoly(g, [[cx - r * 0.62, cy - r * 0.34], [cx + r * 0.62, cy - r * 0.34], [cx + r * 0.44, cy + r * 0.78], [cx - r * 0.44, cy + r * 0.78]]);
      g.lineStyle(3, C.ink, 0.82);
      strokePoly(g, [[cx - r * 0.62, cy - r * 0.34], [cx + r * 0.62, cy - r * 0.34], [cx + r * 0.44, cy + r * 0.78], [cx - r * 0.44, cy + r * 0.78]], true);
      g.fillStyle(0xFFFFFF, 0.85);
      g.fillRoundedRect(cx - r * 0.62, cy - r * 0.44, r * 1.24, r * 0.16, r * 0.06);
      g.fillStyle(C.fryBoxDark, 0.5);
      fillEllipse(g, cx, cy - r * 0.32, r * 0.54, r * 0.12);
      g.fillStyle(0xFFFFFF, 0.3);
      fillPoly(g, [[cx - r * 0.44, cy + r * 0.0], [cx - r * 0.26, cy + r * 0.0], [cx - r * 0.22, cy + r * 0.66], [cx - r * 0.4, cy + r * 0.66]]);
    }

    if (ghostMat) drawGhostOutline(g, ghostMat, cx, cy, r);
  }
  // ---------------------------------------------------------------- 小动物客人
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
  }  function drawSign(g, L) {
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
  // 柜台前沿（客人站在它后面）
  function drawCounter(g, L) {
    const n = L.counter;
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
  }

  // 台面：木桌面 + 撒落的面粉 + 最下面那块出餐垫（都不给材料画框）
  function drawTable(g, L) {
    const t = L.table;
    g.fillStyle(C.table, 1);
    g.fillRect(0, t.y0, WIDTH, t.y1 - t.y0);
    g.fillStyle(0xFFFBF2, 0.9);
    g.fillRect(0, t.y0, WIDTH, 9);
    g.lineStyle(2, C.tableLine, 0.8);
    strokePoly(g, [[0, t.y0 + 9], [WIDTH, t.y0 + 9]], false);
    g.fillStyle(C.tableStreak, 0.45);
    for (let i = 0; i < 9; i++) g.fillRect(14 + i * 60, t.y0 + 26 + (i % 3) * 30, 40, 5);
    g.fillStyle(0xFFFFFF, 0.45);
    const flour = [[52, 634], [140, 700], [238, 640], [332, 706], [438, 648], [86, 766], [408, 772], [196, 748], [30, 700], [500, 740]];
    for (let i = 0; i < flour.length; i++) g.fillCircle(flour[i][0], flour[i][1], 2.2);

    const p = L.matPad;
    g.fillStyle(0x8C6138, 0.18);
    g.fillRoundedRect(p.x + 3, p.y + 6, p.w, p.h, 18);
    g.fillStyle(C.matBoard, 1);
    g.fillRoundedRect(p.x, p.y, p.w, p.h, 18);
    g.lineStyle(3, C.matBoardDark, 1);
    g.strokeRoundedRect(p.x, p.y, p.w, p.h, 18);
    g.lineStyle(2, C.matRing, 0.6);
    g.strokeRoundedRect(p.x + 7, p.y + 7, p.w - 14, p.h - 14, 13);
    for (let i = 0; i < L.matSlots.length; i++) {
      g.lineStyle(2.4, C.matRing, 0.5);
      g.strokeCircle(L.matSlots[i].x, L.matSlots[i].y, 34);
    }
  }  function drawHud(g, L) {
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
  }  const Sound = (function () {
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
      // 材料放到位：一声轻「哒」
      place: function () { tone(520, 0.06, 0.04, 0, 'triangle'); noise(0.05, 0.03, 0, 900, 420, 1.2); },
      // 雪糕机嗡嗡 + 出球
      machine: function () {
        tone(150, 0.4, 0.03, 0, 'sawtooth');
        tone(228, 0.3, 0.02, 0.06, 'sawtooth');
        noise(0.2, 0.03, 0.24, 700, 1800, 1.6);
      },
      // 做好了：C-E-G 上行三音
      done: function (when) {
        const notes = [0, 4, 7];
        for (let i = 0; i < notes.length; i++) {
          tone(523.25 * Math.pow(2, notes[i] / 12), 0.16, 0.05, (when || 0) + i * 0.07, 'sine');
        }
      },
      // 提醒（出餐垫满了）：很轻的低音两下
      nudge: function () { tone(330, 0.14, 0.035, 0, 'sine'); tone(262, 0.18, 0.03, 0.1, 'sine'); },
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
        DISH_COUNT: DISH_COUNT, MATERIAL_COUNT: MATERIAL_COUNT, STATION_COUNT: STATION_COUNT,
        MAT_SLOTS: MAT_SLOTS,
        ARRIVE_SEC: ARRIVE_SEC, SETTLE_SEC: SETTLE_SEC, HAPPY_SEC: HAPPY_SEC, SAD_SEC: SAD_SEC,
        LEAVE_SEC: LEAVE_SEC, SERVE_FLY_SEC: SERVE_FLY_SEC, MAKE_SEC: MAKE_SEC,
        GHOST_BACK_SEC: GHOST_BACK_SEC, PLACE_FLY_SEC: PLACE_FLY_SEC,
        CARD_DELAY_SEC: CARD_DELAY_SEC, TAP_LOCK_SEC: TAP_LOCK_SEC,
        DRAG_LIFT: DRAG_LIFT, DRAG_R: DRAG_R, MAT_R: MAT_R, STATION_R: STATION_R,
        PICK_HALF_W: PICK_HALF_W, PICK_BOTTOM_PAD: PICK_BOTTOM_PAD,
        DISH_KEYS: DISHES.map(function (d) { return d.key; }),
        MATERIAL_KEYS: MATERIALS.map(function (m) { return m.key; }),
        STATION_KEYS: STATIONS.map(function (s) { return s.key; }),
        ANIMAL_KEYS: ANIMALS.map(function (a) { return a.key; }),
        RECIPES: RECIPES,
      };
      this.DISHES = DISHES;
      this.MATERIALS = MATERIALS;
      this.STATIONS = STATIONS;
      this.RECIPES = RECIPES;
      this.ANIMALS = ANIMALS;
      this.PALETTE = C;

      this.phase = 'play';
      this.clock = 0;
      this.stars = 0;
      this.served = 0;
      this.spawnIndex = 0;
      this.plan = buildPlan();
      this.customers = [null, null, null];
      this.materials = this.L.materials.map(function (m) {
        return { i: m.i, key: m.key, name: m.name, cx: m.cx, cy: m.cy, r: m.r, nameY: m.nameY };
      });
      this.stations = this.L.stations.map(function (s) {
        return {
          i: s.i, key: s.key, name: s.name, cx: s.cx, cy: s.cy, r: s.r, nameY: s.nameY,
          placed: [], assembling: null, stepIdx: 0, pulse: 0,
        };
      });
      this.staged = [];            // 出餐垫上的成品：{ key, slot, ready, fx }
      this.drag = null;
      this.dragId = -1;
      this.hoverSlot = -1;
      this.hoverStation = -1;
      this.tipT = 0;
      this.liveProps = [];
      this.bulbT = 0;
      this.hintT = 0;
      this.endT = -1;
      this.tapLockUntil = 0;
      this.hudPop = 0;

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

      this.tableG = this.add.graphics().setDepth(DEPTH.table);
      drawTable(this.tableG, this.L);

      // 摊在桌上的 5 样材料：画一次就不动了，只有拖动时把那一份调淡
      this.materialGs = [];
      for (let i = 0; i < this.materials.length; i++) {
        const m = this.materials[i];
        const g = this.add.graphics().setDepth(DEPTH.table + 1);
        drawMaterial(g, m.key, m.cx, m.cy, m.r);
        this.materialGs.push(g);
        this.add.text(m.cx, m.nameY, m.name, {
          fontFamily: FONT, fontSize: '13px', color: C.nameText,
        }).setOrigin(0.5).setDepth(DEPTH.table + 1);
      }

      // 3 个工位：每帧重画（半成品、高亮、下一步的幽灵轮廓都会变）
      this.stationGs = [];
      for (let i = 0; i < this.stations.length; i++) {
        const st = this.stations[i];
        const g = this.add.graphics().setDepth(DEPTH.table + 2);
        this.stationGs.push(g);
        this.add.text(st.cx, st.nameY, st.name, {
          fontFamily: FONT, fontSize: '13px', color: C.nameText,
        }).setOrigin(0.5).setDepth(DEPTH.table + 2);
      }

      this.stagedG = this.add.graphics().setDepth(DEPTH.dish);

      this.hintText = this.add.text(this.L.hint.x, this.L.hint.y, '把材料拖到该去的地方，做好再拖给客人', {
        fontFamily: FONT, fontSize: '15px', color: C.hintText,
        stroke: C.hintStroke, strokeThickness: 3.5,
      }).setOrigin(0.5).setDepth(DEPTH.hud);

      // 「先把手上的送出去吧～」的小气泡
      this.tipG = this.add.graphics().setDepth(DEPTH.hud + 1);
      this.tipText = this.add.text(this.L.tip.x, this.L.tip.y, '', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: C.hudText,
      }).setOrigin(0.5).setDepth(DEPTH.hud + 2);
      this.tipG.setVisible(false);
      this.tipText.setVisible(false);

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
      const slotX = this.L.slotXs[slot];
      const c = {
        slot: slot, animal: animal.key, tint: animal.tints[spec.tintIndex], h: animal.h,
        want: { key: spec.wantKey },
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
      return c ? { key: c.want.key } : null;
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

    // 桌上的材料：圆形命中（相邻步长 92，抓取半径 42，不会抢）
    matAt(x, y) {
      for (let i = 0; i < this.materials.length; i++) {
        const m = this.materials[i];
        const dx = x - m.cx, dy = y - m.cy;
        if (dx * dx + dy * dy <= MAT_HIT * MAT_HIT) return i;
      }
      return -1;
    }

    stationAt(x, y) {
      for (let i = 0; i < this.stations.length; i++) {
        const st = this.stations[i];
        const dx = x - st.cx, dy = y - st.cy;
        if (dx * dx + dy * dy <= STATION_HIT * STATION_HIT) return i;
      }
      return -1;
    }

    // 出餐垫上已经落定的成品
    trayAt(x, y) {
      for (let i = 0; i < this.staged.length; i++) {
        const e = this.staged[i];
        if (!e.ready) continue;
        const p = this.L.matSlots[e.slot];
        const dx = x - p.x, dy = y - p.y;
        if (dx * dx + dy * dy <= SERVE_R * SERVE_R) return i;
      }
      return -1;
    }

    // 某个工位这会儿会不会收下这份材料（用来做拖动时的高亮）
    acceptStation(matKey) {
      for (let i = 0; i < this.stations.length; i++) {
        const st = this.stations[i];
        if (st.assembling) {
          const recipe = RECIPES[st.assembling];
          const step = recipe[st.stepIdx];
          if (step && step.station === st.key && step.mat === matKey) return i;
          continue;
        }
        const cand = DISHES.filter(function (d) {
          const s0 = RECIPES[d.key][0];
          return s0.station === st.key && s0.mat === matKey;
        })[0];
        if (cand) return i;
      }
      return -1;
    }

    freeMatSlot() {
      for (let i = 0; i < MAT_SLOTS; i++) {
        let used = false;
        for (let k = 0; k < this.staged.length; k++) if (this.staged[k].slot === i) used = true;
        if (!used) return i;
      }
      return 0;
    }

    // -------------------------------------------------- 做菜
    // 把一份材料放到某个工位上。
    // 返回 'placed' 放上去了 / 'completed' 这一步做完了、成品出餐 /
    //      'rejected' 位置或顺序不对（材料不消耗）/ 'blocked' 出餐垫满了
    placeMaterial(matKey, stationKey) {
      if (this.phase !== 'play') return 'rejected';
      let st = null;
      for (let i = 0; i < this.stations.length; i++) if (this.stations[i].key === stationKey) st = this.stations[i];
      if (!st || !materialByKey(matKey)) return 'rejected';

      let dishKey = st.assembling;
      if (!dishKey) {
        const cand = DISHES.filter(function (d) {
          const s0 = RECIPES[d.key][0];
          return s0.station === stationKey && s0.mat === matKey;
        })[0];
        if (!cand) return 'rejected';
        dishKey = cand.key;
      }
      const recipe = RECIPES[dishKey];
      const step = recipe[st.stepIdx];
      if (!step || step.station !== stationKey || step.mat !== matKey) return 'rejected';

      const last = st.stepIdx === recipe.length - 1;
      if (last && this.staged.length >= MAT_SLOTS) { Sound.nudge(); return 'blocked'; }

      st.assembling = dishKey;
      st.placed.push(matKey);
      st.stepIdx += 1;
      st.pulse = 0.3;
      Sound.place();
      if (!last) return 'placed';

      // 最后一步：工位腾空，成品从工位飞向出餐垫
      const slot = this.freeMatSlot();
      const entry = { key: dishKey, slot: slot, ready: false, fx: null };
      this.staged.push(entry);
      if (dishKey === 'icecream') Sound.machine();
      Sound.done(0.18);
      // 出餐动效的起点：雪糕机从机身右侧「推」出来，盘子上、薯条盒里就地出来
      const mkX = st.key === 'machine' ? st.cx + st.r * 0.85 : st.cx;
      const mkY = st.key === 'machine' ? st.cy + st.r * 0.3 : (st.key === 'box' ? st.cy + st.r * 0.2 : st.cy - st.r * 0.1);
      entry.fx = this.spawnMakeFx(dishKey, mkX, mkY, this.L.matSlots[slot].x, this.L.matSlots[slot].y, entry);
      st.placed = [];
      st.assembling = null;
      st.stepIdx = 0;
      st.pulse = 0.5;
      return 'completed';
    }

    // -------------------------------------------------- 递餐
    // 返回 'ok' 递对了 / 'wrong' 递错了 / 'busy' 这会儿不能递
    serveTo(slot, dishKey, stagedIdx) {
      if (this.phase !== 'play') return 'busy';
      const c = this.customers[slot];
      if (!c || c.state !== 'wait') return 'busy';
      if (c.want.key !== dishKey) {
        c.state = 'sad'; c.t = 0;
        Sound.wrong();
        return 'wrong';
      }
      let idx = -1;
      if (stagedIdx !== undefined && stagedIdx !== null && this.staged[stagedIdx]) idx = stagedIdx;
      else {
        for (let i = 0; i < this.staged.length; i++) {
          if (this.staged[i].key === dishKey) { idx = i; break; }
        }
      }
      if (idx >= 0) this.removeStaged(idx);
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

    removeStaged(idx) {
      const e = this.staged[idx];
      if (!e) return;
      if (e.fx && !e.fx.done) {
        const i = this.liveProps.indexOf(e.fx);
        if (i >= 0) this.liveProps.splice(i, 1);
        if (e.fx.g && e.fx.g.destroy) e.fx.g.destroy();
        e.fx.done = true;
      }
      this.staged.splice(idx, 1);
    }

    showTip(msg) {
      if (!this.tipText) return;
      this.tipText.setText(msg);
      this.tipT = TIP_HOLD_SEC;
    }
    // -------------------------------------------------- 拖拽
    onDown(p) {
      Sound.resume();
      if (this.phase === 'over') { this.tryRestart(); return; }
      if (this.drag) return;
      const mi = this.matAt(p.x, p.y);
      if (mi >= 0) {
        const m = this.materials[mi];
        this.drag = { kind: 'mat', key: m.key, from: mi, x: p.x, y: p.y };
        this.materialGs[mi].setAlpha(0.4);
      } else {
        const ti = this.trayAt(p.x, p.y);
        if (ti < 0) return;
        const s = this.staged[ti];
        this.drag = { kind: 'dish', key: s.key, from: ti, x: p.x, y: p.y };
      }
      this.dragId = p.id === undefined ? -1 : p.id;
      this.hoverSlot = this.slotAt(p.x, p.y);
      this.hoverStation = this.drag.kind === 'mat' ? this.acceptStation(this.drag.key) : -1;
      Sound.pick();
    }

    onMove(p) {
      if (!this.drag) return;
      if (this.dragId >= 0 && p && p.id !== undefined && p.id !== this.dragId) return;
      this.drag.x = p.x;
      this.drag.y = p.y;
      this.hoverSlot = this.drag.kind === 'dish' ? this.slotAt(p.x, p.y) : -1;
      this.hoverStation = this.drag.kind === 'mat' ? this.stationAt(p.x, p.y) : -1;
    }

    onUp(p) {
      if (!this.drag) return;
      if (this.dragId >= 0 && p && p.id !== undefined && p.id !== this.dragId) return;
      const d = this.drag;
      this.drag = null;
      this.dragId = -1;
      this.hoverSlot = -1;
      this.hoverStation = -1;

      if (d.kind === 'mat') {
        if (d.from >= 0 && this.materialGs[d.from]) this.materialGs[d.from].setAlpha(1);
        const si = this.stationAt(d.x, d.y);
        const res = si >= 0 ? this.placeMaterial(d.key, this.stations[si].key) : 'rejected';
        if (res === 'placed' || res === 'completed') {
          const st = this.stations[si];
          this.spawnMatFly(d.key, d.x, d.y - DRAG_LIFT, st.cx, st.cy - st.r * 0.3);
        } else {
          const home = this.materials[d.from];
          this.spawnMatFly(d.key, d.x, d.y - DRAG_LIFT, home.cx, home.cy, true);
          Sound.drop();
          if (res === 'blocked') this.showTip('先把手上的送出去吧～');
          // 顺序或位置不对时也不批评，只是轻轻说一句该放哪儿
        }
        return;
      }

      const slot = this.slotAt(d.x, d.y);
      const res = slot >= 0 ? this.serveTo(slot, d.key, d.from) : 'miss';
      if (res === 'ok') this.flyTo(slot, d.key, d.x, d.y);
      else {
        this.flyBack(d.from, d.key, d.x, d.y);
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

    flyTo(slot, key, x0, y0) {
      const c = this.customers[slot];
      const g = this.add.graphics().setDepth(DEPTH.fx);
      this.trackObj({
        g: g, kind: 'fly', t: 0, dur: SERVE_FLY_SEC, key: key, r: 30,
        x0: x0, y0: y0 - DRAG_LIFT,
        x1: this.L.slotXs[slot], y1: this.L.groundY - (c ? c.h * 0.42 : 60),
      });
    }

    flyBack(stagedIdx, key, x0, y0) {
      const e = this.staged[stagedIdx];
      const p = e ? this.L.matSlots[e.slot] : this.L.matSlots[1];
      const g = this.add.graphics().setDepth(DEPTH.fx);
      this.trackObj({
        g: g, kind: 'fly', t: 0, dur: GHOST_BACK_SEC, key: key, r: 30,
        x0: x0, y0: y0 - DRAG_LIFT, x1: p.x, y1: p.y,
      });
    }

    spawnMatFly(key, x0, y0, x1, y1) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      return this.trackObj({
        g: g, kind: 'mat', t: 0, dur: PLACE_FLY_SEC, key: key, r: DRAG_R,
        x0: x0, y0: y0, x1: x1, y1: y1,
      });
    }

    // 工位出餐：先在工位上「长」出来，再飞到出餐垫上落定
    spawnMakeFx(dishKey, x0, y0, x1, y1, entry) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      return this.trackObj({
        g: g, kind: 'make', t: 0, dur: MAKE_SEC, key: dishKey, r: 32,
        x0: x0, y0: y0, x1: x1, y1: y1, entry: entry, done: false,
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
          drawDish(o.g, o.key, x, y, o.r);
        } else if (o.kind === 'mat') {
          const x = lerp(o.x0, o.x1, easeOut(k));
          const y = lerp(o.y0, o.y1, easeOut(k)) - Math.sin(k * Math.PI) * 14;
          o.g.setAlpha(k > 0.88 ? Math.max(0, 1 - (k - 0.88) / 0.12) : 1);
          drawMaterial(o.g, o.key, x, y, o.r);
        } else if (o.kind === 'make') {
          let x, y, r;
          if (k < 0.4) {
            const kk = k / 0.4;
            x = o.x0;
            y = o.y0 - 8 * kk;
            r = o.r * lerp(0.5, 1.05, easeOut(kk));
          } else {
            const kk = (k - 0.4) / 0.6;
            x = lerp(o.x0, o.x1, easeOut(kk));
            y = lerp(o.y0 - 8, o.y1, easeOut(kk)) - Math.sin(kk * Math.PI) * 26;
            r = lerp(o.r * 1.05, o.r, easeOut(kk));
          }
          drawDish(o.g, o.key, x, y, r);
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
          if (o.kind === 'make' && o.entry) o.entry.ready = true;
          o.done = true;
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
      if (this.tipT > 0) this.tipT = Math.max(0, this.tipT - dt);
      for (let i = 0; i < this.stations.length; i++) {
        const st = this.stations[i];
        if (st.pulse > 0) st.pulse = Math.max(0, st.pulse - dt * 2.2);
      }
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
            drawDish(c.bubbleG, c.want.key, 0, -8, this.L.bubble.r);
            c.bubbleDrawn = stamp;
          }
        }
      }

      // 3 个工位：半成品 / 高亮 / 下一步的幽灵轮廓
      for (let i = 0; i < this.stations.length; i++) {
        const st = this.stations[i];
        let ghostMat = null;
        if (st.assembling) {
          const recipe = RECIPES[st.assembling];
          const step = recipe[st.stepIdx];
          if (step && step.station === st.key) ghostMat = step.mat;
        }
        if (this.drag && this.drag.kind === 'mat' && this.hoverStation === i) ghostMat = this.drag.key;
        const g = this.stationGs[i];
        g.clear();
        drawStation(g, st.key, st.cx, st.cy - st.pulse * 4, st.r, st.placed,
          this.hoverStation === i, ghostMat);
      }

      // 出餐垫上已经落定的成品
      this.stagedG.clear();
      for (let i = 0; i < this.staged.length; i++) {
        const e = this.staged[i];
        if (!e.ready) continue;
        // 正被拖走的那一份先别画，免得和幻影重影
        if (this.drag && this.drag.kind === 'dish' && this.drag.from === i) continue;
        const p = this.L.matSlots[e.slot];
        drawDish(this.stagedG, e.key, p.x, p.y, 30);
      }

      // 拖拽幻影
      if (this.drag) {
        this.ghostG.setVisible(true);
        this.ghostG.setScale(1.15);
        this.ghostG.setPosition(this.drag.x, this.drag.y - DRAG_LIFT);
        const stamp = this.drag.kind + ':' + this.drag.key;
        if (this.ghostKey !== stamp) {
          this.ghostG.clear();
          if (this.drag.kind === 'mat') drawMaterial(this.ghostG, this.drag.key, 0, 0, DRAG_R);
          else drawDish(this.ghostG, this.drag.key, 0, 0, DRAG_R);
          this.ghostKey = stamp;
        }
      } else if (this.ghostG.visible) {
        this.ghostG.setVisible(false);
        this.ghostKey = null;
      }

      // 「先把手上的送出去吧～」
      if (this.tipT > 0) {
        const t = this.L.tip;
        const a = clamp(this.tipT / 0.3, 0, 1);
        this.tipG.clear();
        this.tipG.fillStyle(0xFFF6E8, 0.97 * a);
        this.tipG.fillRoundedRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, t.h / 2);
        this.tipG.lineStyle(2.5, C.bubbleLine, a);
        this.tipG.strokeRoundedRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, t.h / 2);
        this.tipG.setVisible(true);
        this.tipText.setVisible(true);
        this.tipText.setAlpha(a);
      } else if (this.tipG.visible) {
        this.tipG.setVisible(false);
        this.tipText.setVisible(false);
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
      this.staged = [];
      this.drag = null;
      this.dragId = -1;
      this.hoverSlot = -1;
      this.hoverStation = -1;
      this.ghostG.setVisible(false);
      this.ghostKey = null;
      for (let i = 0; i < this.materialGs.length; i++) this.materialGs[i].setAlpha(1);
      for (let i = 0; i < this.stations.length; i++) {
        const st = this.stations[i];
        st.placed = [];
        st.assembling = null;
        st.stepIdx = 0;
        st.pulse = 0;
      }
      this.stagedG.clear();
      this.tipT = 0;
      this.tipG.setVisible(false);
      this.tipText.setVisible(false);
      this.stars = 0;
      this.served = 0;
      this.spawnIndex = 0;
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