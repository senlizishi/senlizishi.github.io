/*
 * 弹珠进洞：竖屏弹珠机。按住右下角的大圆钮蓄力，松手把弹珠从右侧竖轨弹上去，
 * 弹珠冲进钉子阵里弹来弹去，最后落到底部 6 个洞里。
 * 每发之前点亮 3 个洞，落进亮洞 +2 颗弹珠（暗洞不给也不罚）。
 * 一轮固定 12 发，顶部 12 颗小灯泡表示剩余次数，全打完弹结算卡。
 * 美术走游乐厅霓虹风，全部 Phaser.Graphics 程序化绘制；音效 WebAudio 合成，不加载任何素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;                 // 只做竖屏，横屏时用 FIT 缩放居中
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const POCKET_COUNT = 6;            // 底部 6 个洞
  const LIT_COUNT = 3;               // 每发点亮其中 3 个
  const POCKET_BONUS = 2;            // 进亮洞加 2 颗弹珠
  const ROUND_SHOTS = 12;            // 一轮固定 12 发
  const START_MARBLES = 12;          // 起始弹珠数（同时也是计分基准）

  const CHARGE_TIME = 1.2;           // 蓄满所需时间（秒）
  const MIN_CHARGE = 0.06;           // 只点一下按最小力度发射
  const RAIL_DUR_MAX = 0.85;         // 竖轨动画耗时：力度最小
  const RAIL_DUR_MIN = 0.50;         // 竖轨动画耗时：力度最大
  const LAUNCH_VX_MIN = 60;          // 出口最小横向速度
  const LAUNCH_VX_MAX = 560;         // 出口最大横向速度（太大就会乱撞墙）
  const LAUNCH_VY = 30;              // 出口纵向初速

  const GRAVITY = 1500;              // px/s^2
  const MARBLE_R = 13;
  const PEG_R = 6;
  const PEG_REST = 0.55;             // 撞钉恢复系数
  const PEG_JITTER = 35;             // 撞钉随机切向扰动
  const WALL_REST = 0.6;
  const SPEED_CAP = 1400;            // 速度上限，防穿透
  const SUBSTEP = 1 / 180;           // 固定子步
  const STALL_SPEED = 25;            // 慢到这个速度以下
  const STALL_TIME = 0.5;            // 持续这么久就推一把
  const STALL_PUSH = 60;
  const FLIGHT_TIMEOUT = 12;         // 飞太久兜底判给正下方的洞
  const POCKET_CAPTURE_Y = 690;      // 中心越过这条线就算进洞
  const SETTLE_SEC = 0.25;           // 落洞后缩小淡出的时长
  const DIV_TOP_R = 8;               // 隔板顶端的小圆头
  const RAIL_WALL_X = 452;           // 右侧竖轨的左边壁：飞行段的实体墙，弹珠进不去
  const RAIL_WALL_TOP = 205;         // 这条实体墙从出口下方开始生效

  const CARD_LOCK_MS = 400;          // 结算卡弹出后的防误触时间
  const CARD_DELAY_SEC = 0.8;        // 第 12 颗落定后隔多久弹结算卡

  // ---------------------------------------------------------------- 配色（游乐厅霓虹）
  const RAINBOW = [0xFF6EC7, 0xFF9A3D, 0xFFD93D, 0x4BE08A, 0x2EE6FF, 0xA06BFF];
  const POCKET_COLORS = [0xFF6EC7, 0xFF9A3D, 0xFFD93D, 0x4BE08A, 0x2EE6FF, 0xA06BFF];

  const C = {
    hallTop: 0x1B1436,
    hallBottom: 0x0E0A22,
    hallGlow: 0x7A46E8,
    floorPools: [0x2EE6FF, 0xFF4FD8, 0xFFD93D],
    cabinetEdge: 0x0B0820,
    cabinetBody: 0x1E1740,
    cabinetInnerTop: 0x2A1E5C,
    cabinetInnerBottom: 0x14203F,
    pocketDim: 0x372E5E,
    pocketDimLine: 0x5A4C93,
    dividerTop: 0x6C5CA8,
    marbleBody: 0xFFEAF7,
    marbleCore: 0xFF8FD2,
    marbleRing: 0x2EE6FF,
    buttonTop: 0xFF5E7A,
    buttonDark: 0xC42C55,
    buttonBase: 0x2A1B3D,
    hudBg: 0x1A1338,
    hudLine: 0xFFD93D,
    hudText: '#FFE066',
    bulbOn: 0xFFD93D,
    bulbOff: 0x241C48,
    signPink: 0xFF4FD8,
  };

  // 弹珠(8) 压在钉子(3)/洞(5)之上；招牌(2)在钉子之下，弹珠飞过牌子时从前面走
  const DEPTH = {
    hall: 0, cabinet: 1, sign: 2, peg: 3, pocket: 4, pocketLit: 5,
    rail: 6, marble: 8, fx: 12, btn: 18, hud: 20, overlay: 40,
  };

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const field = { x0: 48, x1: 492, y0: 114, y1: 802 };
    const span = 404;                       // 洞区横向范围 48..452
    const pw = span / POCKET_COUNT;
    const pockets = [];
    const dividers = [];
    for (let i = 0; i < POCKET_COUNT; i++) {
      const x0 = 48 + pw * i;
      pockets.push({ i: i, x0: x0, x1: x0 + pw, cx: x0 + pw / 2, mouthY: 672, bottomY: 762 });
      dividers.push({ x: x0, y: 672 });
    }
    dividers.push({ x: 48 + pw * POCKET_COUNT, y: 672 });

    const pegs = [];
    for (let row = 0; row < 7; row++) {
      const y = 210 + row * 72;
      const even = row % 2 === 0;
      const base = even ? 77 : 106;
      const n = even ? 7 : 6;
      for (let k = 0; k < n; k++) {
        pegs.push({ x: base + 58 * k, y: y, row: row, color: RAINBOW[(row + k) % RAINBOW.length] });
      }
    }

    const bulbs = [];
    for (let i = 0; i < ROUND_SHOTS; i++) bulbs.push({ x: 118 + i * 24, y: 44 });

    return {
      field: field,
      pegs: pegs,
      pockets: pockets,
      dividers: dividers,
      sign: { x: 60, y: 126, w: 340, h: 62 },
      rail: { x: 472, y0: 740, y1: 196, exitX: 444, exitY: 172 },
      button: { x: 452, y: 890, r: 56, hit: 76 },
      hud: { x: WIDTH - 18, y: 22, w: 104, h: 46 },
      bulbs: bulbs,
      card: { x: (WIDTH - 430) / 2, y: (HEIGHT - 420) / 2 - 10, w: 430, h: 420 },
    };
  }

  // ---------------------------------------------------------------- 颜色 / 几何小工具
  function lerpColor(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16) |
           (Math.round(ag + (bg - ag) * t) << 8) |
           Math.round(ab + (bb - ab) * t);
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

  // 圆角矩形的轮廓点（顺时针，用于按段画彩虹描边）
  function roundRectPts(x, y, w, h, r, seg) {
    const n = seg || 8;
    const out = [];
    const corners = [
      { cx: x + w - r, cy: y + r, a0: -Math.PI / 2, a1: 0 },
      { cx: x + w - r, cy: y + h - r, a0: 0, a1: Math.PI / 2 },
      { cx: x + r, cy: y + h - r, a0: Math.PI / 2, a1: Math.PI },
      { cx: x + r, cy: y + r, a0: Math.PI, a1: Math.PI * 1.5 },
    ];
    for (let c = 0; c < 4; c++) {
      const cc = corners[c];
      for (let i = 0; i <= n; i++) {
        const a = cc.a0 + (cc.a1 - cc.a0) * (i / n);
        out.push({ x: cc.cx + Math.cos(a) * r, y: cc.cy + Math.sin(a) * r });
      }
    }
    return out;
  }
  // ---------------------------------------------------------------- 机厅背景
  function drawHallBackground(g) {
    const bands = 54;
    const bh = HEIGHT / bands;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      g.fillStyle(lerpColor(C.hallTop, C.hallBottom, t), 1);
      g.fillRect(0, Math.floor(bh * i) - 1, WIDTH, Math.ceil(bh) + 2);
    }
    // 机箱背后一团紫色氛围光
    for (let i = 6; i >= 1; i--) {
      g.fillStyle(C.hallGlow, 0.026 * i);
      g.fillCircle(WIDTH / 2, 430, 90 + i * 40);
    }
    // 散落的彩色小星点
    const stars = [[62, 300, 0xFF6EC7], [486, 250, 0x2EE6FF], [40, 626, 0xFFD93D],
      [504, 672, 0x4BE08A], [84, 122, 0xA06BFF], [472, 92, 0xFF9A3D]];
    for (let i = 0; i < stars.length; i++) {
      g.fillStyle(stars[i][2], 0.8);
      fillPts(g, starPoints(stars[i][0], stars[i][1], 7, 2.8, 5, i * 0.3));
    }
  }

  // 地面彩色光斑：以自己为原点画，外面套 tween 做呼吸
  function drawFloorPool(g, rx, ry, color) {
    g.fillStyle(color, 0.13);
    g.fillEllipse(0, 0, rx * 2, ry * 2);
    g.fillStyle(color, 0.12);
    g.fillEllipse(0, 0, rx * 1.25, ry * 1.25);
    g.fillStyle(color, 0.12);
    g.fillEllipse(0, 0, rx * 0.6, ry * 0.6);
  }

  // ---------------------------------------------------------------- 机箱
  function drawCabinet(g, L) {
    const f = L.field;
    // 外壳
    g.fillStyle(C.cabinetEdge, 1);
    g.fillRoundedRect(30, 96, 480, 724, 34);
    g.fillStyle(C.cabinetBody, 1);
    g.fillRoundedRect(36, 102, 468, 712, 30);
    // 台面：深紫 -> 深蓝渐变
    const bands = 44;
    const bh = (f.y1 - f.y0) / bands;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      g.fillStyle(lerpColor(C.cabinetInnerTop, C.cabinetInnerBottom, t), 1);
      g.fillRect(f.x0, Math.floor(f.y0 + bh * i) - 1, f.x1 - f.x0, Math.ceil(bh) + 2);
    }
    // 台面上的糖果色斜纹暗纹
    for (let i = 0; i < 10; i++) {
      g.fillStyle(RAINBOW[i % RAINBOW.length], 0.045);
      const x = f.x0 + 8 + i * 44;
      g.fillRect(x, f.y0, 16, f.y1 - f.y0);
    }
    // 台面暗角
    g.fillStyle(0x0A0718, 0.35);
    g.fillRect(f.x0, f.y0, f.x1 - f.x0, 10);
    g.fillRect(f.x0, f.y1 - 12, f.x1 - f.x0, 12);
    g.lineStyle(4, 0x0A0718, 0.7);
    g.strokeRoundedRect(f.x0, f.y0, f.x1 - f.x0, f.y1 - f.y0, 18);
  }

  // 彩虹霓虹边：外圈两道低透明发光 + 内圈 6 段彩虹描边
  function drawCabinetNeon(g) {
    const x = 30, y = 96, w = 480, h = 724, r = 34;
    g.lineStyle(12, 0xFF6EC7, 0.10);
    g.strokeRoundedRect(x - 7, y - 7, w + 14, h + 14, r + 7);
    g.lineStyle(6, 0x2EE6FF, 0.10);
    g.strokeRoundedRect(x - 14, y - 14, w + 28, h + 28, r + 11);
    const pts = roundRectPts(x, y, w, h, r);
    const per = pts.length;
    for (let i = 0; i < RAINBOW.length; i++) {
      const a0 = Math.floor(per * i / RAINBOW.length);
      const a1 = Math.floor(per * (i + 1) / RAINBOW.length);
      g.lineStyle(6, RAINBOW[i], 0.95);
      g.beginPath();
      g.moveTo(pts[a0].x, pts[a0].y);
      for (let k = a0 + 1; k <= a1; k++) {
        const p = pts[k % per];
        g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
  }

  // 霓虹招牌：深色内板 + 彩虹描边（文字与灯泡在场景里另加）
  function drawSign(g, L) {
    const s = L.sign;
    g.fillStyle(0x0E0A24, 0.96);
    g.fillRoundedRect(s.x, s.y, s.w, s.h, 18);
    g.fillStyle(C.signPink, 0.10);
    g.fillRoundedRect(s.x + 6, s.y + 6, s.w - 12, s.h - 12, 14);
    const pts = roundRectPts(s.x, s.y, s.w, s.h, 18);
    const per = pts.length;
    for (let i = 0; i < RAINBOW.length; i++) {
      const a0 = Math.floor(per * i / RAINBOW.length);
      const a1 = Math.floor(per * (i + 1) / RAINBOW.length);
      g.lineStyle(4, RAINBOW[i], 0.95);
      g.beginPath();
      g.moveTo(pts[a0].x, pts[a0].y);
      for (let k = a0 + 1; k <= a1; k++) {
        const p = pts[k % per];
        g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
  }

  // ---------------------------------------------------------------- 钉子 / 洞 / 竖轨
  function drawPeg(g, x, y, color) {
    g.fillStyle(color, 0.16);
    g.fillCircle(x, y, PEG_R + 7);
    g.fillStyle(0xFFFFFF, 0.95);
    g.fillCircle(x, y, PEG_R + 1.4);
    g.fillStyle(color, 1);
    g.fillCircle(x, y, PEG_R);
    g.fillStyle(0xFFFFFF, 0.85);
    g.fillCircle(x - 1.8, y - 2, 2.3);
  }

  // 6 个洞的底子（暗态）：灰紫色带 + 隔板圆头，永远可见
  function drawPocketBase(g, L) {
    for (let i = 0; i < L.pockets.length; i++) {
      const p = L.pockets[i];
      const w = p.x1 - p.x0;
      g.fillStyle(C.pocketDim, 1);
      g.fillRoundedRect(p.x0 + 5, p.mouthY, w - 10, p.bottomY - p.mouthY, 12);
      g.lineStyle(2, C.pocketDimLine, 0.85);
      g.strokeRoundedRect(p.x0 + 5, p.mouthY, w - 10, p.bottomY - p.mouthY, 12);
    }
    // 接珠盘
    g.fillStyle(0x120C2E, 1);
    g.fillRect(48, 762, 404, 40);
    g.fillStyle(0x2EE6FF, 0.18);
    g.fillRect(48, 762, 404, 4);
    // 隔板
    for (let i = 0; i < L.dividers.length; i++) {
      const d = L.dividers[i];
      g.fillStyle(0x0C0820, 1);
      g.fillRoundedRect(d.x - 4, d.y - 2, 8, L.pockets[0].bottomY - d.y + 8, 4);
      g.fillStyle(C.dividerTop, 1);
      g.fillCircle(d.x, d.y, DIV_TOP_R);
      g.fillStyle(0xBBA8F0, 1);
      g.fillCircle(d.x - 2, d.y - 2, 3);
    }
  }

  // 亮洞的高亮层（只有亮着的洞才画）
  function drawPocketLit(g, p, color) {
    const w = p.x1 - p.x0;
    g.fillStyle(color, 0.26);
    g.fillRoundedRect(p.x0 + 5, p.mouthY, w - 10, p.bottomY - p.mouthY, 12);
    g.lineStyle(3.5, color, 0.95);
    g.strokeRoundedRect(p.x0 + 5, p.mouthY, w - 10, p.bottomY - p.mouthY, 12);
    g.fillStyle(color, 0.34);
    g.fillCircle(p.cx, p.mouthY + 32, 30);
    g.fillStyle(0xFFFFFF, 0.22);
    g.fillCircle(p.cx, p.mouthY + 32, 17);
  }

  function drawRail(g, L) {
    const r = L.rail;
    const top = r.y1 - 10;
    g.fillStyle(0x140E30, 0.94);
    g.fillRoundedRect(r.x - 20, top, 40, r.y0 - top + 14, 20);
    // 顶部弯头指向出口
    g.fillStyle(0x140E30, 0.94);
    g.fillRoundedRect(r.x - 22, r.y1 - 14, 26, 32, 14);
    g.lineStyle(4, 0x2EE6FF, 0.5);
    g.strokeRoundedRect(r.x - 20, top, 40, r.y0 - top + 14, 20);
    // 发射口
    g.fillStyle(0xFF6EC7, 0.26);
    g.fillCircle(r.x, r.y0, 27);
    g.lineStyle(3, 0xFF6EC7, 0.85);
    g.strokeCircle(r.x, r.y0, 23);
    // 向上的小箭头，提示「弹珠从这里上去」
    g.fillStyle(0xFFFFFF, 0.5);
    fillPts(g, [{ x: r.x - 8, y: r.y0 + 8 }, { x: r.x + 8, y: r.y0 + 8 }, { x: r.x, y: r.y0 - 14 }]);
  }

  // ---------------------------------------------------------------- 蓄力按钮
  function drawButtonBase(g, b) {
    g.fillStyle(C.buttonBase, 1);
    g.fillCircle(b.x, b.y + 7, b.r + 12);
    g.fillStyle(C.buttonDark, 1);
    g.fillCircle(b.x, b.y, b.r);
    g.fillStyle(C.buttonTop, 1);
    g.fillCircle(b.x, b.y - 5, b.r - 5);
    g.fillStyle(0xFF9FB2, 0.55);
    g.fillCircle(b.x - 15, b.y - 21, 16);
    g.fillStyle(0xFFFFFF, 0.6);
    g.fillCircle(b.x - 17, b.y - 24, 8);
  }

  // 蓄力进度环：绿 -> 黄 -> 红
  function drawChargeRing(g, b, charge) {
    g.clear();
    g.lineStyle(9, 0x2A2445, 0.95);
    g.strokeCircle(b.x, b.y, b.r + 11);
    if (charge <= 0.001) return;
    const color = charge < 0.5 ? 0x4BE08A : (charge < 0.85 ? 0xFFD93D : 0xFF5E7A);
    const R = b.r + 11;
    const a0 = -Math.PI / 2;
    const a1 = a0 + Math.PI * 2 * charge;
    g.lineStyle(9, color, 1);
    g.beginPath();
    g.moveTo(b.x + Math.cos(a0) * R, b.y + Math.sin(a0) * R);
    const n = 34;
    for (let i = 1; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      g.lineTo(b.x + Math.cos(a) * R, b.y + Math.sin(a) * R);
    }
    g.strokePath();
  }
  // ---------------------------------------------------------------- 音效
  // 全部用 WebAudio 实时合成，不加载任何音频文件，也没有背景音乐。
  const Sound = (function () {
    let ctx = null;
    let master = null;
    let lastPeg = -1;

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

    function now() {
      const c = ensure();
      return c ? c.currentTime : 0;
    }

    return {
      resume: resume,
      // 蓄力：音高随力度上升
      charge: function (c) {
        tone(420 + 620 * (c || 0), 0.09, 0.035, 0, 'triangle');
      },
      launch: function () {
        tone(300, 0.10, 0.06, 0, 'square');
        tone(680, 0.22, 0.05, 0.03, 'sine');
      },
      // 撞钉：限流到每 60ms 最多响一次，钉子阵里不会炸耳
      peg: function () {
        const t = now();
        if (t - lastPeg < 0.06) return;
        lastPeg = t;
        tone(1100 + Math.random() * 260, 0.05, 0.028, 0, 'triangle');
      },
      wall: function () { tone(300, 0.05, 0.02, 0, 'sine'); },
      // 进亮洞：上扬三音
      win: function () {
        chime(659.25, 0.26, 0.06, 0);
        chime(880, 0.26, 0.055, 0.09);
        chime(1174.66, 0.42, 0.05, 0.18);
      },
      // 进暗洞：中性轻响，不吓人也不像失败
      miss: function () {
        tone(392, 0.12, 0.032, 0, 'sine');
        tone(294, 0.16, 0.028, 0.07, 'sine');
      },
      // 上膛
      reload: function () {
        tone(520, 0.07, 0.03, 0, 'triangle');
        tone(780, 0.09, 0.026, 0.05, 'triangle');
      },
      // 结算：温暖三音
      end: function () {
        chime(523.25, 0.32, 0.05, 0);
        chime(659.25, 0.32, 0.045, 0.11);
        chime(783.99, 0.50, 0.04, 0.22);
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class MarbleScene extends Phaser.Scene {
    constructor() { super('MarbleScene'); }

    create() {
      this.L = computeLayout();
      this.pockets = this.L.pockets;
      this.POCKETS = this.L.pockets;
      this.PEGS = this.L.pegs;
      this.CONST = {
        POCKET_COUNT: POCKET_COUNT, LIT_COUNT: LIT_COUNT, POCKET_BONUS: POCKET_BONUS,
        ROUND_SHOTS: ROUND_SHOTS, START_MARBLES: START_MARBLES,
        CHARGE_TIME: CHARGE_TIME, MIN_CHARGE: MIN_CHARGE,
        GRAVITY: GRAVITY, MARBLE_R: MARBLE_R, PEG_R: PEG_R, SPEED_CAP: SPEED_CAP,
        RAIL_DUR_MAX: RAIL_DUR_MAX, RAIL_DUR_MIN: RAIL_DUR_MIN,
        LAUNCH_VX_MIN: LAUNCH_VX_MIN, LAUNCH_VX_MAX: LAUNCH_VX_MAX,
        FLIGHT_TIMEOUT: FLIGHT_TIMEOUT, POCKET_CAPTURE_Y: POCKET_CAPTURE_Y,
        CARD_DELAY_SEC: CARD_DELAY_SEC, CARD_LOCK_MS: CARD_LOCK_MS,
      };

      // 状态
      this.phase = 'ready';          // ready / charging / flight / over
      this.charge = 0;
      this.chargeT = 0;
      this.chargeTickT = 0;
      this.marbles = START_MARBLES;
      this.launchesLeft = ROUND_SHOTS;
      this.shots = 0;
      this.wins = 0;
      this.lit = [];                 // 当前亮着的洞下标
      this.marble = null;            // { x, y, vx, vy, inRail, settling }
      this.railT = 0;
      this.railDur = RAIL_DUR_MAX;
      this.launchCharge = 0;
      this.flightT = 0;
      this.stallT = 0;
      this.settle = null;
      this.elapsed = 0;
      this.lastDt = 1 / 60;
      this.endT = 0;
      this.cardShown = false;
      this.cardShownAt = 0;
      this.cardG = null;
      this.cardItems = [];
      this.liveProps = [];
      this.spin = 0;
      this.pegPulse = [];
      this.signBulbs = [];

      Sound.resume();

      this.buildHall();
      this.buildFloorPools();
      this.buildCabinet();
      this.buildSign();
      this.buildPegs();
      this.buildPockets();
      this.buildRail();
      this.buildButton();
      this.buildHud();
      this.buildMarble();
      this.bindInput();

      this.loadMarble();
    }

    // -------------------------------------------------- 搭场景
    buildHall() {
      const g = this.add.graphics().setDepth(DEPTH.hall);
      drawHallBackground(g);
    }

    buildFloorPools() {
      const spots = [
        [128, 926, 96, 26, C.floorPools[0]],
        [270, 938, 78, 22, C.floorPools[1]],
        [412, 924, 92, 25, C.floorPools[2]],
      ];
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const g = this.add.graphics().setDepth(DEPTH.hall + 0.5);
        g.setPosition(s[0], s[1]);
        drawFloorPool(g, s[2], s[3], s[4]);
        this.tweens.add({
          targets: g, alpha: { from: 0.5, to: 1 }, scaleX: { from: 0.9, to: 1.12 }, scaleY: { from: 0.9, to: 1.12 },
          duration: 1700 + i * 280, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        });
      }
    }

    buildCabinet() {
      const g = this.add.graphics().setDepth(DEPTH.cabinet);
      drawCabinet(g, this.L);
      drawCabinetNeon(g);
    }

    buildSign() {
      const s = this.L.sign;
      const g = this.add.graphics().setDepth(DEPTH.sign);
      drawSign(g, this.L);
      const txt = this.add.text(s.x + s.w / 2, s.y + s.h / 2, '弹珠进洞', {
        fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: '#FFEAFF',
        stroke: '#FF1FB4', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.sign + 0.5);
      txt.setAlpha(1);
      // 招牌四周一圈依次闪烁的小灯泡
      for (let i = 0; i < 10; i++) {
        const top = i % 2 === 0;
        const bx = s.x + 16 + (s.w - 32) * (i / 9);
        const by = top ? s.y - 10 : s.y + s.h + 10;
        const b = this.add.graphics().setDepth(DEPTH.sign + 0.6);
        b.fillStyle(0xFFE066, 0.28);
        b.fillCircle(bx, by, 10);
        b.fillStyle(0xFFE066, 1);
        b.fillCircle(bx, by, 4.8);
        this.signBulbs.push({ g: b, phase: i * 0.62, x: bx, y: by });
      }
    }

    buildPegs() {
      this.pegG = this.add.graphics().setDepth(DEPTH.peg);
      for (let i = 0; i < this.L.pegs.length; i++) {
        const p = this.L.pegs[i];
        drawPeg(this.pegG, p.x, p.y, p.color);
      }
      this.pegPulseG = this.add.graphics().setDepth(DEPTH.peg + 0.5);
      this.pegPulse = [];
      for (let i = 0; i < this.L.pegs.length; i++) {
        const p = this.L.pegs[i];
        this.pegPulse.push({ x: p.x, y: p.y, color: p.color, t: 0 });
      }
    }

    buildPockets() {
      this.pocketBaseG = this.add.graphics().setDepth(DEPTH.pocket);
      drawPocketBase(this.pocketBaseG, this.L);
      this.pocketLitG = this.add.graphics().setDepth(DEPTH.pocketLit);
      this.pocketStars = [];
      this.pocketPlus = [];
      for (let i = 0; i < POCKET_COUNT; i++) {
        const p = this.L.pockets[i];
        const st = this.add.graphics().setDepth(DEPTH.pocketLit + 0.4);
        // 洞口一颗会跳的小星星 + 两颗小珠子，一眼看出「这里加 2 颗」
        st.fillStyle(0xFFE066, 0.35);
        st.fillCircle(0, 0, 19);
        st.fillStyle(0xFFFFFF, 0.97);
        fillPts(st, starPoints(0, 0, 15, 6.6, 5, 0));
        st.fillStyle(POCKET_COLORS[i], 1);
        fillPts(st, starPoints(0, 0, 10.5, 4.6, 5, 0));
        st.fillStyle(0xFFFFFF, 0.9);
        st.fillCircle(-3.4, -3.8, 2.6);
        st.setPosition(p.cx, p.mouthY + 28);
        this.pocketStars.push(st);
        const tx = this.add.text(p.cx, p.mouthY + 62, '+' + POCKET_BONUS, {
          fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#FFFFFF',
          stroke: '#2A2445', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(DEPTH.pocketLit + 0.5);
        this.pocketPlus.push(tx);
      }
    }

    buildRail() {
      const g = this.add.graphics().setDepth(DEPTH.rail);
      drawRail(g, this.L);
    }

    buildButton() {
      const b = this.L.button;
      const base = this.add.graphics().setDepth(DEPTH.btn);
      drawButtonBase(base, b);
      this.buttonBase = base;
      this.chargeRingG = this.add.graphics().setDepth(DEPTH.btn + 0.5);
      drawChargeRing(this.chargeRingG, b, 0);
      this.hintText = this.add.text(196, b.y, '按住大按钮蓄力，松手放珠', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#2A1B3D', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.btn + 0.5);
    }

    buildHud() {
      const h = this.L.hud;
      const g = this.add.graphics().setDepth(DEPTH.hud);
      this.hudG = g;
      g.fillStyle(C.hudBg, 0.82);
      g.fillRoundedRect(h.x - h.w, h.y, h.w, h.h, h.h / 2);
      g.lineStyle(3, C.hudLine, 0.9);
      g.strokeRoundedRect(h.x - h.w, h.y, h.w, h.h, h.h / 2);
      const cx = h.x - h.w + 26, cy = h.y + h.h / 2;
      g.fillStyle(C.marbleRing, 0.26);
      g.fillCircle(cx, cy, 17);
      g.lineStyle(2.5, C.marbleRing, 0.9);
      g.strokeCircle(cx, cy, 13);
      g.fillStyle(C.marbleBody, 1);
      g.fillCircle(cx, cy, 11.5);
      g.fillStyle(C.marbleCore, 1);
      g.fillCircle(cx, cy, 7);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillCircle(cx - 3.6, cy - 4, 3.4);
      this.marbleText = this.add.text(cx + 26, cy, String(this.marbles), {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: C.hudText,
        stroke: '#2A1B3D', strokeThickness: 4,
      }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);

      // 顶部 12 颗剩余次数小灯泡
      this.bulbs = [];
      for (let i = 0; i < this.L.bulbs.length; i++) {
        const b = this.L.bulbs[i];
        this.bulbs.push({ g: this.add.graphics().setDepth(DEPTH.hud), x: b.x, y: b.y });
      }
      this.paintHud();
    }

    buildMarble() {
      const g = this.add.graphics();
      g.fillStyle(C.marbleRing, 0.18);
      g.fillCircle(0, 0, 20);
      g.lineStyle(3.5, C.marbleRing, 0.95);
      g.strokeCircle(0, 0, MARBLE_R);
      g.fillStyle(C.marbleBody, 1);
      g.fillCircle(0, 0, MARBLE_R - 1.5);
      g.fillStyle(C.marbleCore, 1);
      g.fillCircle(0, 0, 8.5);
      g.fillStyle(0xFFFFFF, 0.95);
      g.fillCircle(-4.4, -4.8, 4.2);
      g.fillStyle(0xFFFFFF, 0.55);
      g.fillCircle(5, 5.5, 2);
      this.marbleCont = this.add.container(0, 0, [g]).setDepth(DEPTH.marble).setVisible(false);
    }
    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
      this.input.on('pointerup', () => this.onPointerUp());
      this.input.on('pointerupoutside', () => this.onPointerUp());
      if (this.input.keyboard) {
        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.input.keyboard.addKeys({ space: KC.SPACE });
        this.input.keyboard.on('keydown-SPACE', () => {
          if (this.phase === 'over') { this.tryRestart(); return; }
          if (this.phase === 'charging') this.releaseCharge();
          else if (this.phase === 'ready') this.launchWith(0.6);
        });
      }
    }

    hitButton(x, y) {
      const b = this.L.button;
      const dx = x - b.x, dy = y - b.y;
      return dx * dx + dy * dy <= b.hit * b.hit;
    }

    onPointerDown(pointer) {
      Sound.resume();
      if (this.phase === 'over') { this.tryRestart(); return; }
      if (this.phase !== 'ready') return;   // 蓄力中 / 飞行中不再接受
      if (!this.hitButton(pointer.x, pointer.y)) return;
      this.beginCharge();
    }

    onPointerUp() {
      if (this.phase !== 'charging') return false;
      return this.releaseCharge();
    }

    beginCharge() {
      if (this.phase !== 'ready') return false;
      this.phase = 'charging';
      this.chargeT = 0;
      this.chargeTickT = 0;
      this.charge = 0;
      this.paintCharge();
      return true;
    }

    releaseCharge() {
      if (this.phase !== 'charging') return false;
      return this.launchWith(this.charge);
    }

    tryRestart() {
      if (this.phase !== 'over') return false;
      if (this.time.now - this.cardShownAt < CARD_LOCK_MS) return false;
      this.restart();
      return true;
    }

    // -------------------------------------------------- 上膛 / 发射
    // 只在没有弹珠飞行时重摇亮洞：孩子先看清哪几个亮着，再决定蓄多大力。
    loadMarble() {
      const r = this.L.rail;
      this.phase = 'ready';
      this.charge = 0;
      this.chargeT = 0;
      this.railT = 0;
      this.flightT = 0;
      this.stallT = 0;
      this.launchCharge = 0;
      this.rerollLit();
      this.marble = { x: r.x, y: r.y0, vx: 0, vy: 0, inRail: true, settling: false };
      if (this.marbleCont) this.marbleCont.setVisible(true).setAlpha(1).setScale(1).setRotation(0);
      this.paintCharge();
      Sound.reload();
    }

    rerollLit() {
      const pool = [];
      for (let i = 0; i < POCKET_COUNT; i++) pool.push(i);
      const out = [];
      for (let k = 0; k < LIT_COUNT && pool.length; k++) {
        const j = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(j, 1)[0]);
      }
      out.sort(function (a, b) { return a - b; });
      this.lit = out;
      this.paintLit();
    }

    launchWith(charge) {
      if (!this.marble) return false;
      if (this.phase !== 'ready' && this.phase !== 'charging') return false;
      const c = Math.max(MIN_CHARGE, Math.min(1, charge || 0));
      this.launchCharge = c;
      this.charge = 0;
      this.chargeT = 0;
      this.railT = 0;
      this.flightT = 0;
      this.stallT = 0;
      this.railDur = RAIL_DUR_MAX - (RAIL_DUR_MAX - RAIL_DUR_MIN) * c;
      this.marble.inRail = true;
      this.marble.settling = false;
      this.phase = 'flight';
      this.launchesLeft -= 1;
      this.shots += 1;
      // 每发消耗一颗弹珠；不变量：弹珠数 = 12 - 已发射数 + 2 x 进亮洞次数（永不为负）
      this.marbles = Math.max(0, this.marbles - 1);
      this.paintHud();
      this.paintCharge();
      Sound.launch();
      return true;
    }

    // -------------------------------------------------- 每帧
    update(time, delta) {
      const dt = Math.min(delta, 60) / 1000;
      this.step(dt);
      this.render();
    }

    // 纯逻辑推进（不碰画面），测试里用 simulate() 反复调用它
    step(dt) {
      this.elapsed += dt;
      this.lastDt = dt;

      // 钉子被撞的余晖：逻辑层衰减，渲染层只负责画
      for (let i = 0; i < this.pegPulse.length; i++) {
        const p = this.pegPulse[i];
        if (p.t > 0) p.t = Math.max(0, p.t - dt);
      }

      if (this.settle) {
        this.settle.t += dt;
        if (this.settle.t >= this.settle.dur) this.finishSettle();
        return;
      }

      if (this.phase === 'charging') {
        this.chargeT += dt;
        const c = Math.min(1, this.chargeT / CHARGE_TIME);
        if (c !== this.charge) { this.charge = c; this.paintCharge(); }
        this.chargeTickT += dt;
        if (this.chargeTickT >= 0.15) { this.chargeTickT -= 0.15; Sound.charge(this.charge); }
        return;
      }

      if (this.phase === 'flight') {
        if (this.marble && this.marble.inRail) this.stepRail(dt);
        else if (this.marble) this.stepFlight(dt);
        return;
      }

      if (this.phase === 'over' && !this.cardShown) {
        this.endT += dt;
        if (this.endT >= CARD_DELAY_SEC) this.showCard();
      }
    }

    // 竖轨段：纯动画，0~0.68 竖直上行，0.68~1 拐向左侧出口
    stepRail(dt) {
      const m = this.marble;
      const r = this.L.rail;
      this.railT += dt / this.railDur;
      if (this.railT >= 1) {
        this.railT = 1;
        m.inRail = false;
        m.x = r.exitX;
        m.y = r.exitY;
        m.vx = -(LAUNCH_VX_MIN + (LAUNCH_VX_MAX - LAUNCH_VX_MIN) * this.launchCharge);
        m.vy = LAUNCH_VY;
        this.flightT = 0;
        this.stallT = 0;
        this.spawnPuff(m.x, m.y);
        return;
      }
      const t = this.railT;
      if (t < 0.68) {
        const u = t / 0.68;
        const e = 1 - (1 - u) * (1 - u);
        m.x = r.x;
        m.y = r.y0 + (r.y1 - r.y0) * e;
      } else {
        const u = (t - 0.68) / 0.32;
        const mm = 1 - u;
        const cx = r.x - 6, cy = r.y1 - 28;
        m.x = mm * mm * r.x + 2 * mm * u * cx + u * u * r.exitX;
        m.y = mm * mm * r.y1 + 2 * mm * u * cy + u * u * r.exitY;
      }
    }

    // 飞行段：固定子步推进，保证高速也不会穿钉穿墙
    stepFlight(dt) {
      this.flightT += dt;
      if (this.flightT > FLIGHT_TIMEOUT) {
        this.enterPocket(this.pocketForX(this.marble.x));
        return;
      }
      let remain = dt;
      while (remain > 1e-9) {
        const h = Math.min(SUBSTEP, remain);
        remain -= h;
        this.physicsStep(h);
        if (!this.marble || this.marble.settling || this.marble.inRail) break;
      }
    }

    physicsStep(h) {
      const m = this.marble;
      const px0 = m.x, py0 = m.y;

      m.vy += GRAVITY * h;
      const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (sp > SPEED_CAP) { const k = SPEED_CAP / sp; m.vx *= k; m.vy *= k; }
      m.x += m.vx * h;
      m.y += m.vy * h;

      // 钉子
      const pegs = this.L.pegs;
      for (let i = 0; i < pegs.length; i++) {
        const p = pegs[i];
        const dx = m.x - p.x, dy = m.y - p.y;
        const rr = MARBLE_R + PEG_R;
        if (dx * dx + dy * dy < rr * rr) {
          const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const nx = dx / d, ny = dy / d;
          m.x = p.x + nx * (rr + 0.2);
          m.y = p.y + ny * (rr + 0.2);
          const vn = m.vx * nx + m.vy * ny;
          if (vn < 0) {
            m.vx -= (1 + PEG_REST) * vn * nx;
            m.vy -= (1 + PEG_REST) * vn * ny;
          }
          const j = (Math.random() * 2 - 1) * PEG_JITTER;
          m.vx += -ny * j;
          m.vy += nx * j;
          this.pegPulse[i].t = 0.28;
          Sound.peg();
        }
      }

      // 洞与洞之间的隔板圆头（只在顶端附近判定，下面交给入洞判定）
      const divs = this.L.dividers;
      for (let i = 0; i < divs.length; i++) {
        const dv = divs[i];
        const dy = m.y - dv.y;
        if (dy > MARBLE_R) continue;
        const dx = m.x - dv.x;
        const rr = MARBLE_R + DIV_TOP_R;
        if (dx * dx + dy * dy < rr * rr) {
          const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
          const nx = dx / d, ny = dy / d;
          m.x = dv.x + nx * (rr + 0.2);
          m.y = dv.y + ny * (rr + 0.2);
          const vn = m.vx * nx + m.vy * ny;
          if (vn < 0) {
            m.vx -= (1 + WALL_REST) * vn * nx;
            m.vy -= (1 + WALL_REST) * vn * ny;
          }
        }
      }

      // 四壁
      const f = this.L.field;
      if (m.x < f.x0 + MARBLE_R) {
        m.x = f.x0 + MARBLE_R;
        if (m.vx < 0) { m.vx = -m.vx * WALL_REST; Sound.wall(); }
      }
      if (m.x > f.x1 - MARBLE_R) {
        m.x = f.x1 - MARBLE_R;
        if (m.vx > 0) { m.vx = -m.vx * WALL_REST; Sound.wall(); }
      }
      if (m.y < f.y0 + MARBLE_R) {
        m.y = f.y0 + MARBLE_R;
        if (m.vy < 0) { m.vy = -m.vy * WALL_REST; Sound.wall(); }
      }
      // 右侧竖轨是实体：飞行段不允许钻回轨道里
      if (m.y > RAIL_WALL_TOP && m.x > RAIL_WALL_X - MARBLE_R) {
        m.x = RAIL_WALL_X - MARBLE_R;
        if (m.vx > 0) { m.vx = -m.vx * WALL_REST; Sound.wall(); }
      }

      // 进洞：中心越过 690 就算落洞，按这一小步里穿线的位置取洞（避免斜着穿过隔板顶）
      if (m.y > POCKET_CAPTURE_Y) {
        let cx = m.x;
        if (py0 <= POCKET_CAPTURE_Y && m.y > py0) {
          const u = (POCKET_CAPTURE_Y - py0) / (m.y - py0);
          cx = px0 + (m.x - px0) * u;
        }
        this.enterPocket(this.pocketForX(cx));
        return;
      }

      // 卡死检测：慢吞吞超过 0.5 秒就横向推一把
      const sp2 = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (sp2 < STALL_SPEED) {
        this.stallT += h;
        if (this.stallT > STALL_TIME) {
          this.stallT = 0;
          m.vx += (Math.random() < 0.5 ? -1 : 1) * STALL_PUSH;
          m.vy += 20;
        }
      } else {
        this.stallT = 0;
      }
    }

    // 落点落在第几个洞：按中心线分格；贴着隔板（4px 内）时取最近的那一侧，
    // 而 floor 分格本身就是「取最近一侧」，所以这里直接用分格结果即可。
    pocketForX(x) {
      const pw = (this.L.pockets[1].x0 - this.L.pockets[0].x0);
      let idx = Math.floor((x - 48) / pw);
      if (!isFinite(idx)) idx = 0;
      return Math.max(0, Math.min(POCKET_COUNT - 1, idx));
    }

    // -------------------------------------------------- 落洞 / 结算
    enterPocket(idx) {
      const m = this.marble;
      if (!m) return;
      const p = this.L.pockets[idx];
      m.settling = true;
      m.fromX = m.x;
      m.fromY = m.y;
      m.tx = p.cx;
      m.ty = p.bottomY - 30;
      this.settle = { idx: idx, t: 0, dur: SETTLE_SEC };
    }

    finishSettle() {
      const idx = this.settle.idx;
      this.settle = null;
      this.marble = null;
      if (this.marbleCont) this.marbleCont.setVisible(false);
      this.resolvePocket(idx);
    }

    resolvePocket(idx) {
      const p = this.L.pockets[idx];
      const win = this.lit.indexOf(idx) >= 0;
      if (win) {
        this.wins += 1;
        this.marbles += POCKET_BONUS;
        Sound.win();
        this.spawnStars(p.cx, p.mouthY - 6, POCKET_COLORS[idx]);
        this.popText(p.cx, p.mouthY - 34, '+' + POCKET_BONUS, POCKET_COLORS[idx]);
        this.pocketFlash(idx);
      } else {
        Sound.miss();
        this.spawnDust(p.cx, p.mouthY - 4);
      }
      this.paintHud();
      this.nextShot();
    }

    nextShot() {
      if (this.launchesLeft <= 0) { this.endRound(); return; }
      this.loadMarble();
    }

    endRound() {
      this.phase = 'over';
      this.endT = 0;
      this.cardShown = false;
      Sound.end();
    }

    // -------------------------------------------------- HUD / 亮洞刷新
    paintHud() {
      if (this.marbleText) this.marbleText.setText(String(this.marbles));
      if (!this.bulbs) return;
      for (let i = 0; i < this.bulbs.length; i++) {
        const b = this.bulbs[i];
        const used = i >= this.launchesLeft;   // 从左往右还剩几颗亮着
        b.g.clear();
        if (used) {
          b.g.fillStyle(C.bulbOff, 1);
          b.g.fillCircle(b.x, b.y, 8);
          b.g.lineStyle(2, 0x453A78, 0.9);
          b.g.strokeCircle(b.x, b.y, 8);
        } else {
          b.g.fillStyle(C.bulbOn, 0.22);
          b.g.fillCircle(b.x, b.y, 12);
          b.g.fillStyle(C.bulbOn, 1);
          b.g.fillCircle(b.x, b.y, 8);
          b.g.fillStyle(0xFFF6CC, 1);
          b.g.fillCircle(b.x - 2.4, b.y - 2.6, 3);
        }
      }
    }

    paintLit() {
      if (!this.pocketLitG) return;
      const g = this.pocketLitG;
      g.clear();
      for (let i = 0; i < POCKET_COUNT; i++) {
        const on = this.lit.indexOf(i) >= 0;
        const p = this.L.pockets[i];
        if (this.pocketStars[i]) this.pocketStars[i].setVisible(on);
        if (this.pocketPlus[i]) this.pocketPlus[i].setVisible(on);
        if (on) drawPocketLit(g, p, POCKET_COLORS[i]);
      }
    }

    paintCharge() {
      if (!this.chargeRingG) return;
      drawChargeRing(this.chargeRingG, this.L.button, this.charge);
      if (this.buttonBase) {
        const k = 1 + 0.06 * this.charge;
        this.buttonBase.setScale(this.phase === 'flight' ? 0.96 : k);
        this.buttonBase.setAlpha(this.phase === 'flight' ? 0.55 : 1);
      }
    }

    // 落进亮洞时，那个洞的光晕噗的一下
    pocketFlash(idx) {
      const p = this.L.pockets[idx];
      const g = this.add.graphics().setDepth(DEPTH.fx);
      g.lineStyle(6, POCKET_COLORS[idx], 0.9);
      g.strokeCircle(p.cx, p.mouthY + 24, 22);
      this.trackObj(g);
      this.tweens.add({
        targets: g, scaleX: 2.1, scaleY: 2.1, alpha: 0, duration: 420, ease: 'Sine.Out',
        onComplete: () => { this.untrackObj(g); g.destroy(); },
      });
    }
    // -------------------------------------------------- 每帧绘制
    render() {
      // 弹珠
      const c = this.marbleCont;
      if (c) {
        const m = this.marble;
        if (!m) {
          c.setVisible(false);
        } else if (m.settling) {
          const u = this.settle ? Math.min(1, this.settle.t / this.settle.dur) : 1;
          c.setVisible(true);
          c.setPosition(m.fromX + (m.tx - m.fromX) * u, m.fromY + (m.ty - m.fromY) * u);
          c.setScale(1 - 0.5 * u);
          c.setAlpha(1 - 0.35 * u);
        } else {
          c.setVisible(true).setScale(1).setAlpha(1);
          c.setPosition(m.x, m.y);
          const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          this.spin += (0.06 + Math.min(0.4, sp / 2600)) * (this.lastDt * 60);
          c.setRotation(this.spin);
        }
      }

      // 钉子撞击脉冲
      if (this.pegPulseG) {
        const g = this.pegPulseG;
        g.clear();
        for (let i = 0; i < this.pegPulse.length; i++) {
          const p = this.pegPulse[i];
          if (p.t <= 0) continue;
          const u = p.t / 0.28;
          g.lineStyle(2.5 + 3.5 * u, p.color, 0.6 * u);
          g.strokeCircle(p.x, p.y, PEG_R + 6 + 16 * (1 - u));
        }
      }

      // 招牌灯泡：依次闪烁
      for (let i = 0; i < this.signBulbs.length; i++) {
        const b = this.signBulbs[i];
        const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.elapsed * 3.4 + b.phase));
        b.g.setAlpha(k);
      }

      // 亮洞洞口的小星星：上下轻跳 + 慢慢旋转
      for (let i = 0; i < this.pocketStars.length; i++) {
        const st = this.pocketStars[i];
        if (!st.visible) continue;
        const on = this.lit.indexOf(i) >= 0;
        if (!on) continue;
        const bob = Math.sin(this.elapsed * 4 + i * 0.9) * 3.5;
        st.setPosition(this.L.pockets[i].cx, this.L.pockets[i].mouthY + 28 + bob);
        st.setRotation(this.elapsed * 1.4);
      }
    }

    // -------------------------------------------------- 特效
    trackObj(o) { this.liveProps.push(o); return o; }

    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
    }

    // 进亮洞：撒一把星星
    spawnStars(x, y, color) {
      for (let i = 0; i < 8; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        if (i % 2 === 0) {
          g.fillStyle(0xFFE066, 1);
          fillPts(g, starPoints(0, 0, 9, 4, 5, 0));
        } else {
          g.fillStyle(color, 1);
          g.fillCircle(0, 0, 5);
        }
        const a = -Math.PI / 2 + (i - 3.5) * 0.52;
        g.setPosition(x, y).setScale(0.4).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 120, delay: i * 28 });
        this.tweens.add({
          targets: g, x: x + Math.cos(a) * 84, y: y + Math.sin(a) * 78 - 18,
          scale: 0.5, alpha: 0, duration: 520, delay: 120 + i * 28, ease: 'Quad.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    // 进暗洞：一小撮灰紫色尘埃，没有惩罚意味
    spawnDust(x, y) {
      for (let i = 0; i < 4; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        g.fillStyle(0x8E82BE, 0.9);
        g.fillCircle(0, 0, 3.6);
        const a = -Math.PI / 2 + (i - 1.5) * 0.55;
        g.setPosition(x, y).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 0.9, duration: 100, delay: i * 30 });
        this.tweens.add({
          targets: g, x: x + Math.cos(a) * 34, y: y + Math.sin(a) * 30 + 16,
          alpha: 0, duration: 420, delay: 100 + i * 30, ease: 'Quad.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    // 出口处的一小团白色气流
    spawnPuff(x, y) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      g.fillStyle(0xFFFFFF, 0.7);
      g.fillCircle(0, 0, 8);
      g.setPosition(x, y);
      this.trackObj(g);
      this.tweens.add({
        targets: g, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 260, ease: 'Sine.Out',
        onComplete: () => { this.untrackObj(g); g.destroy(); },
      });
    }

    popText(x, y, text, color) {
      const t = this.add.text(x, y, text, {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#' + ('000000' + color.toString(16)).slice(-6), strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.fx);
      this.trackObj(t);
      this.tweens.add({
        targets: t, y: y - 46, alpha: 0, scale: 1.3, duration: 720, ease: 'Quad.Out',
        onComplete: () => { this.untrackObj(t); t.destroy(); },
      });
    }

    // -------------------------------------------------- 结算卡
    showCard() {
      if (this.cardShown) return;
      this.cardShown = true;
      this.cardShownAt = this.time.now;

      const L = this.L.card;
      const g = this.add.graphics().setDepth(DEPTH.overlay);
      g.fillStyle(0x0B0820, 0.62);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xFFFFFF, 0.98);
      g.fillRoundedRect(L.x, L.y, L.w, L.h, 30);
      g.lineStyle(5, 0xFF6EC7, 1);
      g.strokeRoundedRect(L.x, L.y, L.w, L.h, 30);

      const items = [g];
      const mk = (ty, text, size, color, bold) => {
        const t = this.add.text(WIDTH / 2, ty, text, {
          fontFamily: FONT, fontSize: size + 'px', fontStyle: bold ? 'bold' : 'normal',
          color: color, align: 'center',
        }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);
        items.push(t);
        return t;
      };

      mk(L.y + 54, '本轮结束', 26, '#4A3A6B', true);
      mk(L.y + 118, '进亮洞 ' + this.wins + ' 次', 34, '#E2489B', true);

      // 弹珠图标 + 大数字
      const num = mk(L.y + 196, String(this.marbles), 46, '#E0A32A', true);
      const iconX = WIDTH / 2 - (num.width + 40) / 2 + 15;
      num.setX(iconX + 15 + 14 + num.width / 2);
      const ig = this.add.graphics().setDepth(DEPTH.overlay + 1);
      ig.lineStyle(3, C.marbleRing, 0.95);
      ig.strokeCircle(iconX, L.y + 196, 16);
      ig.fillStyle(C.marbleBody, 1);
      ig.fillCircle(iconX, L.y + 196, 14.5);
      ig.fillStyle(C.marbleCore, 1);
      ig.fillCircle(iconX, L.y + 196, 9);
      ig.fillStyle(0xFFFFFF, 0.9);
      ig.fillCircle(iconX - 5, L.y + 190, 4.4);
      items.push(ig);

      mk(L.y + 254, '攒了这么多弹珠', 18, '#6E5F8C');
      mk(L.y + 284, '一轮 ' + ROUND_SHOTS + ' 发，进亮洞加 ' + POCKET_BONUS + ' 颗', 15, '#A79BC4');

      const btnY = L.y + L.h - 84;
      const btn = this.add.rectangle(WIDTH / 2, btnY, 232, 62, 0xE2489B, 1)
        .setStrokeStyle(3, 0xFFC0E4, 0.95).setDepth(DEPTH.overlay + 1);
      const btnText = this.add.text(WIDTH / 2, btnY, '再玩一次', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.overlay + 2);
      items.push(btn, btnText);
      mk(L.y + L.h - 30, '点屏幕也可以', 15, '#A8BCC9');

      this.cardG = g;
      this.cardItems = items;
    }

    clearCard() {
      if (this.cardG) { this.cardG.destroy(); this.cardG = null; }
      if (this.cardItems) {
        for (let i = 0; i < this.cardItems.length; i++) {
          const it = this.cardItems[i];
          if (it && it.active) it.destroy();
        }
        this.cardItems = [];
      }
      this.cardShown = false;
    }

    restart() {
      this.clearCard();
      this.scene.restart();
    }

    // -------------------------------------------------- 测试用钩子（非公共 API）
    // 直接推进纯逻辑，不碰画面
    simulate(seconds, step) {
      const h = step || 1 / 60;
      let t = 0;
      while (t < seconds - 1e-9) {
        const dt = Math.min(h, seconds - t);
        this.step(dt);
        t += dt;
      }
      return this.phase;
    }

    forceCharge(c) {
      const v = Math.max(0, Math.min(1, c));
      if (this.phase === 'ready') { this.phase = 'charging'; this.chargeT = v * CHARGE_TIME; }
      this.charge = v;
      this.paintCharge();
      return v;
    }

    forceLit(list) {
      const arr = Array.isArray(list) ? list : [list];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i] | 0;
        if (v >= 0 && v < POCKET_COUNT && out.indexOf(v) < 0) out.push(v);
      }
      if (!out.length) out.push(0);
      out.sort(function (a, b) { return a - b; });
      this.lit = out;
      this.paintLit();
      return this.lit.slice();
    }

    // 强制投一颗弹珠进第 index 个洞（测试用，不消耗发数）
    dropInto(index) {
      const idx = Math.max(0, Math.min(POCKET_COUNT - 1, index | 0));
      if (this.settle) this.settle = null;
      const p = this.L.pockets[idx];
      if (!this.marble) {
        this.marble = { x: p.cx, y: p.mouthY - 6, vx: 0, vy: 0, inRail: false, settling: false };
      }
      this.marble.inRail = false;
      this.marble.settling = false;
      this.marble.x = p.cx;
      this.marble.y = p.mouthY - 6;
      this.enterPocket(idx);
      return idx;
    }

    forceLaunch(charge) {
      if (!this.marble || this.phase === 'over') return false;
      this.phase = 'ready';
      this.charge = 0;
      return this.launchWith(charge === undefined ? 0.6 : charge);
    }
  }

  window.MarbleScene = MarbleScene;
})();