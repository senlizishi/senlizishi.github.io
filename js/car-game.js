/*
 * 小车躲一躲：竖屏俯视三车道城市公路，点屏幕左/右半边换道躲开障碍。
 * 撞到只是晃一下 + 短暂无敌，速度、金币、进度都不变，游戏永远不结束。
 * 路上捡金币计数，速度从慢缓缓升到上限后保持；无关卡、无结算、无终点。
 * 美术全部 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，不加载任何素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  // 只做竖屏 540x960，横屏时用 FIT 缩放居中显示同一版画面。
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const ROAD_L = 60;                 // 沥青左边
  const ROAD_R = 480;                // 沥青右边
  const LANE_W = 140;                // 车道宽
  const LANE_COUNT = 3;
  const LANE_X = [ROAD_L + LANE_W * 0.5, ROAD_L + LANE_W * 1.5, ROAD_L + LANE_W * 2.5]; // 130 / 270 / 410

  const CAR_Y = 712;                 // 小车固定的纵向位置
  const SPAWN_Y = -70;               // 障碍/金币从这条线上方进场
  const DESPAWN_Y = 1040;            // 超过这条线就回收
  const CAR_HW = 30;                 // 小车判定半宽（比车身窄，偏宽容）
  const CAR_HH = 42;
  const OBS_HW = 34;                 // 障碍判定半宽
  const OBS_HH = 34;
  const COIN_R = 46;                 // 金币拾取半径（很宽松）

  const SPEED_MIN = 190;             // px/s
  const SPEED_MAX = 360;
  const RAMP_SEC = 90;               // 多少秒升到最快，之后恒定
  const GAP_MAX = 520;               // 最慢时的障碍间距（行驶距离）
  const GAP_MIN = 320;               // 最快时的障碍间距（必须 > SAFE_WINDOW）
  const SAFE_WINDOW = 220;           // 同屏判定窗口：任意 220px 内最多只堵 1 条车道
  const INVINCIBLE_SEC = 1.2;        // 撞车后的无敌时间

  const DASH_PERIOD = 120;           // 车道虚线周期
  const DASH_LEN = 58;
  const PATCH_PERIOD = 340;          // 沥青斑块周期
  const SIDE_SPAN = 1180;            // 街边物件循环一次的距离
  const SIDE_PER_SIDE = 4;           // 每侧 4 个物件

  const C = {
    grass: 0x9FD98A,
    grassDark: 0x86C672,
    sidewalk: 0xDCE3E8,
    sidewalkLine: 0xC3CDD5,
    curb: 0xB6C2CB,
    asphalt: 0x6E7A87,
    dash: 0xF4F8FA,
    building: [0xF2C9A0, 0xE7B7C9, 0xC9D8E8, 0xF0DFA8, 0xD6C9E8],
    hudText: '#4A6070',
    hudLine: 0xBFD8E8,
  };

  const CAR = {
    body: 0x4FB8EE,
    bodyDark: 0x2E93C9,
    bodyLight: 0x8FDCFA,
    glass: 0xCFEEFF,
    glassDark: 0xA9D8EF,
    wheel: 0x39414B,
    light: 0xFFF3B0,
    tail: 0xFF6B6B,
    eye: 0x3A4A56,
    face: 0xFF7FA0,
  };

  const DEPTH = { road: 0, side: 2, dash: 3, coin: 5, obstacle: 7, car: 9, fx: 12, hud: 20 };

  // 障碍：5 种造型，迎面来车 3 个配色。每种 = 一条配置 + 一个绘制函数。
  const OBSTACLES = [
    { key: 'cone', color: 0xFF8A3D, draw: drawCone },
    { key: 'barrier', color: 0xE8523F, draw: drawBarrier },
    { key: 'puddle', color: 0x7FB6D9, draw: drawPuddle, splash: true },
    { key: 'bin', color: 0x7FA07A, draw: drawBin },
    { key: 'car-orange', color: 0xF0A03C, draw: drawOncomingCar },
    { key: 'car-mint', color: 0x5FD0B0, draw: drawOncomingCar },
    { key: 'car-violet', color: 0xB08CE8, draw: drawOncomingCar },
  ];

  // 街边装饰：画在「本地 x=0 是马路外侧、x=60 是马路边缘」的坐标系里，右侧整体镜像。
  const SIDE_TYPES = [
    { key: 'building', draw: drawBuilding },
    { key: 'tree', draw: drawTree },
    { key: 'lamp', draw: drawLamp },
    { key: 'hydrant', draw: drawHydrant },
  ];

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    return {
      car: { y: CAR_Y, hw: CAR_HW, hh: CAR_HH },
      hud: { x: WIDTH - 18, y: 18, w: 126, h: 50 },
      dashX: [(LANE_X[0] + LANE_X[1]) / 2, (LANE_X[1] + LANE_X[2]) / 2],
    };
  }

  // ---------------------------------------------------------------- 颜色 / 几何工具
  function lighten(color, f) {
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    return (Math.round(r + (255 - r) * f) << 16) |
           (Math.round(g + (255 - g) * f) << 8) |
           Math.round(b + (255 - b) * f);
  }

  function darken(color, f) {
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    const k = 1 - f;
    return (Math.round(r * k) << 16) | (Math.round(g * k) << 8) | Math.round(b * k);
  }

  function ellipsePoints(cx, cy, rx, ry, angle, segments) {
    const n = segments || Math.max(14, Math.min(40, Math.round(Math.max(rx, ry) / 2.4)));
    const cos = Math.cos(angle || 0);
    const sin = Math.sin(angle || 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const px = Math.cos(t) * rx;
      const py = Math.sin(t) * ry;
      out.push({ x: cx + px * cos - py * sin, y: cy + px * sin + py * cos });
    }
    return out;
  }

  function arcPts(cx, cy, r, a0, a1, steps) {
    const n = steps || 14;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }

  function starPoints(cx, cy, outer, inner, tips, rotation) {
    const out = [];
    const total = tips * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / total) * Math.PI * 2 - Math.PI / 2 + (rotation || 0);
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }

  function fillPts(g, pts) {
    if (!pts || pts.length < 3) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
  }

  function strokePts(g, pts, close) {
    if (!pts || pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    if (close) g.closePath();
    g.strokePath();
  }

  function fillRoundEllipse(g, cx, cy, rx, ry, angle, color, alpha) {
    g.fillStyle(color, alpha === undefined ? 1 : alpha);
    fillPts(g, ellipsePoints(cx, cy, rx, ry, angle));
  }  // ---------------------------------------------------------------- 静态路面
  function drawRoadStatic(g) {
    // 草地
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(C.grassDark, 0.5);
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137) % 528);
      const y = ((i * 251) % 940);
      g.fillCircle(x < 270 ? (x % 34) + 2 : WIDTH - 2 - (x % 34), y, 3.2);
    }
    // 人行道
    g.fillStyle(C.sidewalk, 1);
    g.fillRect(38, 0, 22, HEIGHT);
    g.fillRect(WIDTH - 60, 0, 22, HEIGHT);
    g.fillStyle(C.sidewalkLine, 1);
    g.fillRect(38, 0, 3, HEIGHT);
    g.fillRect(WIDTH - 41, 0, 3, HEIGHT);
    g.fillStyle(C.curb, 1);
    g.fillRect(ROAD_L - 4, 0, 4, HEIGHT);
    g.fillRect(ROAD_R, 0, 4, HEIGHT);
    // 沥青
    g.fillStyle(C.asphalt, 1);
    g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, HEIGHT);
  }

  // ---------------------------------------------------------------- 街边装饰
  // 本地坐标：x=0 是马路外侧，x=60 是马路边缘；右侧整体 scaleX=-1 镜像。
  function drawBuilding(g, seed) {
    const pal = C.building;
    const c = pal[seed % pal.length];
    const w = 34 + (seed % 3) * 4;
    const h = 84 + (seed % 4) * 14;
    g.fillStyle(darken(c, 0.2), 1);
    g.fillRoundedRect(0, -h / 2 - 6, w + 8, h + 12, 9);
    g.fillStyle(c, 1);
    g.fillRoundedRect(3, -h / 2 - 3, w, h + 6, 8);
    g.fillStyle(lighten(c, 0.34), 1);
    g.fillRoundedRect(8, -h / 2 + 4, w - 14, 20, 5);
    g.fillStyle(darken(c, 0.26), 1);
    g.fillCircle(w - 9, h / 2 - 16, 6.5);
    g.fillRect(9, h / 2 - 22, 9, 9);
  }

  function drawTree(g, seed) {
    const r = 19 + (seed % 3) * 3;
    g.fillStyle(0x6FA85C, 0.35);
    fillRoundEllipse(g, 20, r * 0.72, r * 1.02, r * 0.68, 0, 0x3E6B33, 0.22);
    fillRoundEllipse(g, 20, 0, r, r, 0, 0x5FA84E);
    fillRoundEllipse(g, 20, -2, r * 0.82, r * 0.82, 0, 0x75C162);
    fillRoundEllipse(g, 14, -7, r * 0.32, r * 0.28, 0, 0x9BD98A, 0.9);
  }

  function drawLamp(g, seed) {
    g.fillStyle(0x8C97A1, 1);
    g.fillRoundedRect(48, -34, 7, 60, 3);
    g.fillStyle(0x6E7A84, 1);
    g.fillRoundedRect(42, 20, 19, 7, 3);
    g.fillStyle(0xFFE9A8, 1);
    g.fillCircle(51.5, -38, 9);
    g.fillStyle(0xFFF7D8, 0.5);
    g.fillCircle(51.5, -38, 15);
  }

  function drawHydrant(g, seed) {
    g.fillStyle(0xC9453C, 1);
    g.fillRoundedRect(38, -12, 18, 26, 7);
    g.fillStyle(0xE4655C, 1);
    g.fillRoundedRect(40, -10, 14, 22, 6);
    g.fillStyle(0xC9453C, 1);
    g.fillRoundedRect(36, -18, 22, 8, 4);
    g.fillStyle(0xE4655C, 1);
    g.fillCircle(47, -19, 5);
    g.fillStyle(0xA8352E, 1);
    g.fillRoundedRect(33, 6, 6, 8, 3);
    g.fillRoundedRect(55, 6, 6, 8, 3);
  }

  // ---------------------------------------------------------------- 障碍
  function drawCone(g) {
    fillRoundEllipse(g, 0, 32, 40, 12, 0, 0x2E3B47, 0.16);
    g.fillStyle(0xE06A20, 1);
    g.fillRoundedRect(-38, 22, 76, 15, 6);
    fillPts(g, [{ x: -27, y: 24 }, { x: 27, y: 24 }, { x: 12, y: -30 }, { x: -12, y: -30 }]);
    g.fillStyle(0xFF8A3D, 1);
    fillPts(g, [{ x: -24, y: 20 }, { x: 24, y: 20 }, { x: 10, y: -26 }, { x: -10, y: -26 }]);
    g.fillStyle(0xFFF3E0, 1);
    fillPts(g, [{ x: -20, y: 8 }, { x: 20, y: 8 }, { x: 16, y: -4 }, { x: -16, y: -4 }]);
    fillPts(g, [{ x: -15, y: -13 }, { x: 15, y: -13 }, { x: 12, y: -22 }, { x: -12, y: -22 }]);
  }

  function drawBarrier(g) {
    fillRoundEllipse(g, 0, 30, 42, 11, 0, 0x2E3B47, 0.16);
    g.fillStyle(0x8A8F98, 1);
    g.fillRoundedRect(-34, 4, 11, 26, 5);
    g.fillRoundedRect(23, 4, 11, 26, 5);
    g.fillStyle(0xF4F8FA, 1);
    g.fillRoundedRect(-42, -24, 84, 30, 9);
    g.fillStyle(0xE8523F, 1);
    for (let i = 0; i < 4; i++) {
      const x = -38 + i * 20;
      fillPts(g, [{ x: x, y: 5 }, { x: x + 10, y: 5 }, { x: x + 20, y: -23 }, { x: x + 10, y: -23 }]);
    }
    g.lineStyle(3, 0xC9D2DA, 1);
    g.strokeRoundedRect(-42, -24, 84, 30, 9);
  }

  function drawPuddle(g) {
    fillRoundEllipse(g, 0, 8, 46, 31, 0, 0x4E7391, 0.95);
    fillRoundEllipse(g, 0, 6, 41, 26, 0, 0x7FB6D9, 0.95);
    fillRoundEllipse(g, -11, -3, 14, 9, -0.3, 0xDCF1FF, 0.85);
    fillRoundEllipse(g, 13, 11, 9, 6, 0.2, 0xDCF1FF, 0.6);
    g.fillStyle(0xEAF7FF, 0.9);
    g.fillCircle(-31, -20, 4);
    g.fillCircle(31, -15, 3);
  }

  function drawBin(g) {
    fillRoundEllipse(g, 0, 32, 30, 10, 0, 0x2E3B47, 0.16);
    g.fillStyle(0x5F7A5A, 1);
    g.fillRoundedRect(-24, -18, 48, 50, 8);
    g.fillStyle(0x7FA07A, 1);
    g.fillRoundedRect(-21, -16, 42, 46, 7);
    g.fillStyle(0x5F7A5A, 1);
    g.fillRoundedRect(-28, -28, 56, 14, 7);
    g.fillStyle(0x8FB68A, 1);
    g.fillRoundedRect(-24, -26, 48, 9, 5);
    g.fillStyle(0x4E6349, 1);
    g.fillRoundedRect(-7, -34, 14, 8, 4);
    g.lineStyle(2.5, 0x4E6349, 0.75);
    strokePts(g, [{ x: -11, y: -2 }, { x: 11, y: -2 }], false);
    strokePts(g, [{ x: -11, y: 8 }, { x: 11, y: 8 }], false);
  }

  function drawOncomingCar(g, def) {
    const body = def.color;
    const dark = darken(body, 0.22);
    const light = lighten(body, 0.32);
    fillRoundEllipse(g, 0, 10, 36, 48, 0, 0x2E3B47, 0.16);
    g.fillStyle(0x39414B, 1);
    g.fillRoundedRect(-38, -34, 11, 22, 4);
    g.fillRoundedRect(27, -34, 11, 22, 4);
    g.fillRoundedRect(-38, 14, 11, 22, 4);
    g.fillRoundedRect(27, 14, 11, 22, 4);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-33, -50, 66, 100, 20);
    g.fillStyle(body, 1);
    g.fillRoundedRect(-30, -48, 60, 96, 18);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(-21, 12, 42, 26, 10);
    g.fillStyle(light, 1);
    g.fillRoundedRect(-24, -42, 48, 26, 9);
    g.fillStyle(0xFFF3B0, 1);
    g.fillRoundedRect(-26, 38, 14, 9, 4);
    g.fillRoundedRect(12, 38, 14, 9, 4);
    g.fillStyle(0xE8523F, 1);
    g.fillRoundedRect(-26, -49, 12, 7, 3);
    g.fillRoundedRect(14, -49, 12, 7, 3);
  }

  // ---------------------------------------------------------------- 金币
  function drawCoin(g) {
    g.fillStyle(0xC98F1E, 1);
    g.fillCircle(0, 0, 21);
    g.fillStyle(0xFFD75E, 1);
    g.fillCircle(0, -1.5, 19);
    g.fillStyle(0xFFE9A8, 1);
    g.fillCircle(-6, -7, 6);
    g.lineStyle(2.5, 0xE0A82E, 0.9);
    g.strokeCircle(0, 0, 12);
    g.fillStyle(0xFFF6D0, 0.95);
    fillPts(g, starPoints(0, 0, 7.5, 3.2, 5, 0));
  }

  // ---------------------------------------------------------------- 小车
  function drawCar(g) {
    // 影子
    fillRoundEllipse(g, 0, 6, 46, 66, 0, 0x2E3B47, 0.18);
    // 轮胎
    g.fillStyle(CAR.wheel, 1);
    g.fillRoundedRect(-44, -42, 13, 26, 5);
    g.fillRoundedRect(31, -42, 13, 26, 5);
    g.fillRoundedRect(-44, 18, 13, 26, 5);
    g.fillRoundedRect(31, 18, 13, 26, 5);
    // 车身
    g.fillStyle(CAR.bodyDark, 1);
    g.fillRoundedRect(-39, -61, 78, 122, 24);
    g.fillStyle(CAR.body, 1);
    g.fillRoundedRect(-36, -58, 72, 116, 22);
    g.fillStyle(CAR.bodyLight, 1);
    g.fillRoundedRect(-30, -54, 24, 30, 12);
    // 挡风玻璃
    g.fillStyle(CAR.glassDark, 1);
    g.fillRoundedRect(-25, -36, 50, 30, 12);
    g.fillStyle(CAR.glass, 1);
    g.fillRoundedRect(-22, -33, 44, 24, 10);
    // 车顶
    g.fillStyle(CAR.bodyLight, 1);
    g.fillRoundedRect(-28, -3, 56, 30, 12);
    // 后窗
    g.fillStyle(CAR.glassDark, 1);
    g.fillRoundedRect(-22, 30, 44, 17, 8);
    // 大灯 / 尾灯
    g.fillStyle(CAR.light, 1);
    g.fillRoundedRect(-32, -63, 17, 10, 5);
    g.fillRoundedRect(15, -63, 17, 10, 5);
    g.fillStyle(CAR.tail, 1);
    g.fillRoundedRect(-31, 54, 15, 8, 4);
    g.fillRoundedRect(16, 54, 15, 8, 4);
    // 表情
    g.fillStyle(CAR.eye, 1);
    g.fillCircle(-13, -22, 4.4);
    g.fillCircle(13, -22, 4.4);
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(-14.4, -23.4, 1.7);
    g.fillCircle(11.6, -23.4, 1.7);
    g.lineStyle(2.8, CAR.face, 0.95);
    strokePts(g, arcPts(0, -50, 8, Math.PI * 0.16, Math.PI * 0.84, 10), false);
  }  // ---------------------------------------------------------------- 音效
  // 全部用 WebAudio 实时合成，不加载任何音频文件，也没有背景音乐。
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
        master.gain.value = 0.3;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
      }
      return ctx;
    }

    function resume() {
      const c = ensure();
      if (c && c.state === 'suspended') {
        try { c.resume(); } catch (e) { /* 忽略 */ }
      }
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

    function chime(freq, dur, vol, when) {
      tone(freq, dur, vol, when, 'sine');
      tone(freq * 2, dur * 0.7, vol * 0.28, when, 'sine');
      tone(freq * 3.01, dur * 0.45, vol * 0.1, when, 'sine');
    }

    return {
      resume: resume,
      pick: function () {
        tone(880, 0.09, 0.05, 0, 'triangle');
        chime(1318.5, 0.22, 0.045, 0.02);
      },
      bonus: function () {
        chime(659.25, 0.32, 0.06, 0);
        chime(880, 0.32, 0.055, 0.09);
        chime(1046.5, 0.45, 0.05, 0.18);
      },
      crash: function () {
        tone(220, 0.07, 0.06, 0, 'square');
        tone(120, 0.2, 0.065, 0.04, 'sine');
        tone(88, 0.26, 0.05, 0.1, 'sine');
      },
      bump: function () { tone(260, 0.12, 0.04, 0, 'sine'); },
      whoosh: function () {
        tone(520, 0.09, 0.03, 0, 'sine');
        tone(680, 0.09, 0.026, 0.05, 'sine');
      },
    };
  })();  // ---------------------------------------------------------------- 场景
  class CarScene extends Phaser.Scene {
    constructor() { super('CarScene'); }

    create() {
      this.L = computeLayout();
      this.LANES = LANE_X;
      this.OBSTACLE_TYPES = OBSTACLES;

      this.lane = 1;
      this.carX = LANE_X[1];
      this.carRenderX = LANE_X[1];
      this.carXTarget = LANE_X[1];
      this.coins = 0;
      this.crashes = 0;
      this.speed = SPEED_MIN;
      this.elapsed = 0;
      this.travel = 0;
      this.nextSpawnAt = 320;
      this.invincible = 0;
      this.jolt = { t: 0, amp: 0, dir: 1 };
      this.obstacles = [];
      this.pickups = [];
      this.liveProps = [];

      Sound.resume();

      this.buildRoad();
      this.buildSide();
      this.buildCar();
      this.buildHud();
      this.bindInput();
    }

    // -------------------------------------------------- 每帧
    update(time, delta) {
      const dt = Math.min(delta, 60) / 1000;
      this.elapsed += dt;
      this.speed = Math.min(SPEED_MAX, SPEED_MIN + (SPEED_MAX - SPEED_MIN) * Math.min(1, this.elapsed / RAMP_SEC));
      if (this.invincible > 0) this.invincible = Math.max(0, this.invincible - dt);

      const move = this.speed * dt;
      this.travel += move;

      while (this.travel >= this.nextSpawnAt) {
        this.spawnEvent();
        this.nextSpawnAt += this.gapPx();
      }

      // 小车：手写缓动，避免和抖动 tween 抢同一个属性
      this.carRenderX += (this.carXTarget - this.carRenderX) * Math.min(1, dt * 13);
      let ox = 0;
      if (this.jolt.t > 0) {
        this.jolt.t = Math.max(0, this.jolt.t - dt);
        ox = Math.sin(this.jolt.t * 55) * this.jolt.amp * this.jolt.dir;
      }
      this.carRoot.setX(this.carRenderX + ox);
      this.carRoot.setRotation(Phaser.Math.Clamp((this.carXTarget - this.carRenderX) * 0.0016, -0.13, 0.13));
      this.carRoot.setAlpha(this.invincible > 0 ? (Math.sin(this.elapsed * 24) > 0 ? 1 : 0.38) : 1);

      this.drawScrolling();
      this.moveSideProps(move);
      this.moveObjects(move);
    }

    // -------------------------------------------------- 路面
    buildRoad() {
      drawRoadStatic(this.add.graphics().setDepth(DEPTH.road));
      this.patches = [];
      for (let i = 0; i < 3; i++) {
        this.patches.push({
          x: 96 + i * 132,
          w: 46 + (i % 2) * 24,
          h: 90 + (i % 3) * 40,
          phase: (i * 113) % PATCH_PERIOD,
        });
      }
      this.scrollG = this.add.graphics().setDepth(DEPTH.dash);
    }

    // 虚线 + 沥青斑块：按行驶距离取模滚动，永远填满整屏
    drawScrolling() {
      const g = this.scrollG;
      g.clear();
      const pOff = this.travel % PATCH_PERIOD;
      g.fillStyle(0x000000, 0.05);
      for (let i = 0; i < this.patches.length; i++) {
        const p = this.patches[i];
        const base = ((p.phase + pOff) % PATCH_PERIOD) - PATCH_PERIOD;
        for (let k = 0; k < 4; k++) g.fillRoundedRect(p.x, base + k * PATCH_PERIOD, p.w, p.h, 10);
      }
      const dOff = this.travel % DASH_PERIOD;
      g.fillStyle(C.dash, 0.92);
      for (let c = 0; c < this.L.dashX.length; c++) {
        const x = this.L.dashX[c];
        for (let k = 0; k < 10; k++) {
          g.fillRoundedRect(x - 3.5, dOff + (k - 1) * DASH_PERIOD, 7, DASH_LEN, 3.5);
        }
      }
    }

    // -------------------------------------------------- 街边装饰
    buildSide() {
      this.sideProps = [];
      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        for (let i = 0; i < SIDE_PER_SIDE; i++) {
          const type = SIDE_TYPES[Math.floor(Math.random() * SIDE_TYPES.length)];
          const seed = Math.floor(Math.random() * 97);
          const g = this.add.graphics();
          type.draw(g, seed);
          const cont = this.add.container(side < 0 ? 0 : WIDTH, 0, [g]).setDepth(DEPTH.side);
          if (side > 0) cont.setScale(-1, 1);
          const y = DESPAWN_Y - SIDE_SPAN + i * (SIDE_SPAN / SIDE_PER_SIDE);
          cont.setY(y);
          this.sideProps.push({ side: side, y: y, type: type, seed: seed, cont: cont, g: g });
        }
      }
    }

    moveSideProps(move) {
      for (let i = 0; i < this.sideProps.length; i++) {
        const p = this.sideProps[i];
        p.y += move;
        if (p.y > DESPAWN_Y) {
          p.y -= SIDE_SPAN;
          p.type = SIDE_TYPES[Math.floor(Math.random() * SIDE_TYPES.length)];
          p.seed = Math.floor(Math.random() * 97);
          p.g.clear();
          p.type.draw(p.g, p.seed);
        }
        p.cont.setY(p.y);
      }
    }

    // -------------------------------------------------- 小车
    buildCar() {
      this.carRoot = this.add.container(this.carRenderX, CAR_Y).setDepth(DEPTH.car);
      this.carG = this.add.graphics();
      drawCar(this.carG);
      this.carRoot.add(this.carG);
    }

    // -------------------------------------------------- 顶部金币计数
    buildHud() {
      const h = this.L.hud;
      const g = this.add.graphics().setDepth(DEPTH.hud);
      const cx = h.x - h.w + 30;
      const cy = h.y + h.h / 2;
      g.fillStyle(0xFFFFFF, 0.85);
      g.fillRoundedRect(h.x - h.w, h.y, h.w, h.h, h.h / 2);
      g.lineStyle(3, C.hudLine, 0.9);
      g.strokeRoundedRect(h.x - h.w, h.y, h.w, h.h, h.h / 2);
      g.fillStyle(0xC98F1E, 1);
      g.fillCircle(cx, cy, 15);
      g.fillStyle(0xFFD75E, 1);
      g.fillCircle(cx, cy - 1.5, 13.5);
      g.fillStyle(0xFFE9A8, 1);
      g.fillCircle(cx - 5, cy - 6, 4.2);
      this.coinText = this.add.text(cx + 26, cy, '0', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: C.hudText,
      }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);
    }

    paintHud() {
      if (this.coinText) this.coinText.setText(String(this.coins));
    }

    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointerdown', (pointer) => this.onTap(pointer));
      if (this.input.keyboard) {
        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.input.keyboard.addKeys({ left: KC.LEFT, right: KC.RIGHT, a: KC.A, d: KC.D });
        this.input.keyboard.on('keydown-LEFT', () => this.moveLane(-1));
        this.input.keyboard.on('keydown-A', () => this.moveLane(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.moveLane(1));
        this.input.keyboard.on('keydown-D', () => this.moveLane(1));
      }
    }

    onTap(pointer) {
      Sound.resume();
      this.moveLane(pointer.x < WIDTH / 2 ? -1 : 1);
    }

    moveLane(dir) {
      const next = this.lane + dir;
      if (next < 0 || next >= LANE_COUNT) {
        this.bumpEdge(dir);
        return false;
      }
      this.lane = next;
      this.carXTarget = LANE_X[next];
      this.carX = this.carXTarget;
      Sound.whoosh();
      return true;
    }

    // 已经在最边上还往外点：轻轻顶一下，不越界
    bumpEdge(dir) {
      Sound.bump();
      this.jolt = { t: 0.2, amp: 6, dir: dir };
    }

    // -------------------------------------------------- 障碍 / 金币
    gapPx() {
      const t = Phaser.Math.Clamp((this.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0, 1);
      return GAP_MAX - (GAP_MAX - GAP_MIN) * t;
    }

    spawnEvent() {
      if (Math.random() < 0.7) {
        this.spawnObstacle(Math.floor(Math.random() * LANE_COUNT));
        return;
      }
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const n = Math.random() < 0.45 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const y = SPAWN_Y - i * 66;
        if (!this.laneBlockedNear(lane, y)) this.spawnCoin(lane, y);
      }
    }

    laneBlockedNear(lane, y) {
      for (let i = 0; i < this.obstacles.length; i++) {
        const o = this.obstacles[i];
        if (o.lane === lane && Math.abs(o.y - y) < 120) return true;
      }
      return false;
    }

    spawnObstacle(lane, typeKey, y) {
      const laneIdx = Phaser.Math.Clamp(lane === undefined ? Math.floor(Math.random() * LANE_COUNT) : lane, 0, LANE_COUNT - 1);
      let def = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
      if (typeKey) {
        const found = OBSTACLES.filter(function (o) { return o.key === typeKey; })[0];
        if (found) def = found;
      }
      const g = this.add.graphics().setDepth(DEPTH.obstacle);
      def.draw(g, def);
      const sy = y === undefined ? SPAWN_Y : y;
      g.setPosition(LANE_X[laneIdx], sy);
      const o = { def: def, lane: laneIdx, x: LANE_X[laneIdx], y: sy, g: g };
      this.obstacles.push(o);
      return o;
    }

    spawnCoin(lane, y) {
      const laneIdx = Phaser.Math.Clamp(lane === undefined ? 0 : lane, 0, LANE_COUNT - 1);
      const sy = y === undefined ? SPAWN_Y : y;
      const art = this.add.graphics();
      drawCoin(art);
      const cont = this.add.container(LANE_X[laneIdx], sy, [art]).setDepth(DEPTH.coin);
      const c = { lane: laneIdx, y: sy, cont: cont, phase: Math.random() * 6.283 };
      this.pickups.push(c);
      return c;
    }

    // 测试用：直接在指定车道、指定位置放一枚金币
    forceCoin(lane, y) {
      return this.spawnCoin(lane === undefined ? this.lane : lane, y === undefined ? CAR_Y - 8 : y);
    }

    overlap(box, o) {
      return box.x1 > o.x - OBS_HW && box.x0 < o.x + OBS_HW &&
             box.y1 > o.y - OBS_HH && box.y0 < o.y + OBS_HH;
    }

    moveObjects(move) {
      const box = {
        x0: this.carRenderX - CAR_HW, x1: this.carRenderX + CAR_HW,
        y0: CAR_Y - CAR_HH, y1: CAR_Y + CAR_HH,
      };
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const o = this.obstacles[i];
        o.y += move;
        o.g.setY(o.y);
        if (o.y > DESPAWN_Y) {
          o.g.destroy();
          this.obstacles.splice(i, 1);
          continue;
        }
        if (this.invincible <= 0 && this.overlap(box, o)) this.crash(o);
      }
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const c = this.pickups[i];
        c.y += move;
        c.cont.setY(c.y + Math.sin(this.elapsed * 4 + c.phase) * 5);
        c.cont.setScale(0.55 + 0.45 * Math.abs(Math.cos(this.elapsed * 3.2 + c.phase)), 1);
        if (c.y > DESPAWN_Y) {
          c.cont.destroy();
          this.pickups.splice(i, 1);
          continue;
        }
        if (Math.abs(c.cont.x - this.carRenderX) < COIN_R && Math.abs(c.y - CAR_Y) < COIN_R) this.collect(c, i);
      }
    }

    // -------------------------------------------------- 撞到 / 捡到
    crash(o) {
      this.crashes += 1;
      this.invincible = INVINCIBLE_SEC;
      Sound.crash();
      this.jolt = { t: 0.42, amp: 9, dir: 1 };
      this.spawnSparks(o.x, CAR_Y - 34, o.def.color);
      const idx = this.obstacles.indexOf(o);
      if (idx >= 0) this.obstacles.splice(idx, 1);
      const y0 = o.y;
      this.tweens.add({
        targets: o.g, y: y0 + 280, alpha: 0, scaleX: 0.45, scaleY: 0.45,
        duration: 460, ease: 'Quad.Out',
        onComplete: () => o.g.destroy(),
      });
    }

    collect(c, i) {
      this.pickups.splice(i, 1);
      this.coins += 1;
      Sound.pick();
      this.spawnCoinBurst(c.cont.x, c.cont.y);
      this.paintHud();
      if (this.coins % 10 === 0) {
        Sound.bonus();
        this.spawnBonusRing(this.carRenderX, CAR_Y - 60);
      }
      this.tweens.add({
        targets: c.cont, alpha: 0, scaleX: 1.7, scaleY: 1.7,
        duration: 220, ease: 'Sine.Out',
        onComplete: () => c.cont.destroy(),
      });
    }

    // -------------------------------------------------- 特效
    trackObj(o) { this.liveProps.push(o); return o; }

    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
    }

    spawnSparks(x, y, color) {
      for (let i = 0; i < 7; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        if (i % 2 === 0) {
          g.fillStyle(0xFFE07A, 1);
          fillPts(g, starPoints(0, 0, 10, 4.5, 5, 0));
        } else {
          g.fillStyle(color, 1);
          g.fillCircle(0, 0, 5);
        }
        const a = -Math.PI / 2 + (i - 3) * 0.55;
        g.setPosition(x + Math.cos(a) * 18, y + Math.sin(a) * 18).setScale(0.4).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 120, delay: i * 30 });
        this.tweens.add({
          targets: g, x: x + Math.cos(a) * 92, y: y + Math.sin(a) * 92 + 40,
          scale: 0.5, alpha: 0, duration: 520, delay: 120 + i * 30, ease: 'Quad.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    spawnCoinBurst(x, y) {
      for (let i = 0; i < 5; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        g.fillStyle(0xFFD75E, 1);
        g.fillCircle(0, 0, 4.5);
        g.fillStyle(0xFFF6D0, 1);
        g.fillCircle(-1.3, -1.3, 1.8);
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        g.setPosition(x, y).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, duration: 90, delay: i * 25 });
        this.tweens.add({
          targets: g, x: x + Math.cos(a) * 46, y: y + Math.sin(a) * 40 - 24,
          alpha: 0, scale: 0.5, duration: 460, delay: 90 + i * 25, ease: 'Quad.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    spawnBonusRing(x, y) {
      for (let i = 0; i < 12; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        g.fillStyle(i % 2 ? 0xFFD75E : 0xFFF3C4, 1);
        g.fillCircle(0, 0, 6 - (i % 3));
        const a = (i / 12) * Math.PI * 2;
        g.setPosition(x, y).setScale(0.4).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 160, delay: i * 22 });
        this.tweens.add({
          targets: g, x: x + Math.cos(a) * 78, y: y + Math.sin(a) * 78,
          alpha: 0, duration: 620, delay: 180 + i * 22, ease: 'Sine.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }
  }

  window.CarScene = CarScene;
})();