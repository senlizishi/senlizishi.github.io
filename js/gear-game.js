/*
 * 齿轮工坊：540x960 竖屏自由沙盒。
 * 拖动三档齿轮到木钉板上咬合，点摇柄即可观察方向交替、速度变化与机关联动。
 * 全部画面由 Phaser.Graphics 绘制，音效由 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const TAU = Math.PI * 2;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TITLE_FONT = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "Microsoft YaHei", serif';
  const PLAY = { x: 32, y: 124, w: 476, h: 504 };
  const BOARD = { x: 20, y: 112, w: 500, h: 530 };
  const TRAY = { x: 20, y: 748, w: 500, h: 188 };
  const RUN_BUTTON = { x: 184, y: 704, w: 236, h: 52 };
  const CLEAR_BUTTON = { x: 432, y: 704, w: 100, h: 52 };
  const PEG_STEP = 28;
  const PEG_COLS = 18;
  const PEG_ROWS = 19;
  const MESH_TOLERANCE = 10;
  const DRIVE_SPEED = 2.0;
  const MAX_GEARS = 24;
  const CLEAR_CONFIRM_SEC = 2;
  const BELL_INTERVAL = 1.5;
  const CRANK_COL = 1;
  const CRANK_ROW = 16;

  const DEPTH = {
    world: 0,
    board: 1,
    pegs: 2,
    gadgets: 4,
    shadows: 5,
    gears: 7,
    arrows: 9,
    status: 10,
    ghost: 12,
    fx: 14,
    ui: 20,
    toast: 24,
  };

  const C = {
    night: 0x24140D,
    nightSoft: 0x382116,
    woodDark: 0x4B2B19,
    wood: 0x9A6032,
    woodLight: 0xC88B4D,
    board: 0xB97842,
    boardLight: 0xD59A59,
    cream: 0xFFF2D3,
    creamSoft: 0xE9D2A7,
    ink: 0x3A2416,
    inkSoft: 0x76543A,
    brass: 0xE1B65A,
    brassLight: 0xF6D98F,
    brassDeep: 0x9C6B26,
    coral: 0xE86E5D,
    coralLight: 0xF5A18C,
    teal: 0x4FA89A,
    tealLight: 0x8CD6C6,
    gold: 0xE0A64A,
    goldLight: 0xF4D27B,
    white: 0xFFFFFF,
    shadow: 0x160B06,
    red: 0xD94A3D,
    blue: 0x6FB7D9,
    leaf: 0x77B36B,
  };

  const GEAR_TYPES = {
    small: { key: 'small', name: '小齿轮', r: 28, teeth: 10, color: C.coral, light: C.coralLight },
    medium: { key: 'medium', name: '中齿轮', r: 56, teeth: 20, color: C.gold, light: C.goldLight },
    large: { key: 'large', name: '大齿轮', r: 84, teeth: 30, color: C.teal, light: C.tealLight },
  };
  const MOVABLE_KEYS = ['small', 'medium', 'large'];
  const CRANK_DEF = { r: 28, teeth: 10, color: C.brass, light: C.brassLight };
  const SOCKET_DEF = { r: 21, teeth: 8, color: C.creamSoft, light: C.cream };

  const GADGET_DEFS = [
    { key: 'windmill', name: '风车', col: 3, row: 2 },
    { key: 'bell', name: '铃铛', col: 14, row: 2 },
    { key: 'lamp', name: '灯泡', col: 14, row: 14 },
  ];

  function computeLayout() {
    const trayItems = [
      { key: 'small', x: 128, y: 824, hit: 46 },
      { key: 'medium', x: 270, y: 824, hit: 52 },
      { key: 'large', x: 412, y: 824, hit: 58 },
    ];
    return {
      title: { x: WIDTH / 2, y: 39 },
      subtitle: { x: WIDTH / 2, y: 72 },
      board: BOARD,
      play: PLAY,
      tray: TRAY,
      trayItems: trayItems,
      run: RUN_BUTTON,
      clear: CLEAR_BUTTON,
      hint: { x: WIDTH / 2, y: 664 },
      trayTitle: { x: 46, y: 768 },
      labelsY: 900,
    };
  }

  const L = computeLayout();

  function pegPoint(col, row) {
    return { x: PLAY.x + col * PEG_STEP, y: PLAY.y + row * PEG_STEP };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function containsCentered(r, x, y) {
    return !!r && x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }
  function containsBox(r, x, y) {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  function shade(hex, factor) {
    const r = clamp(Math.round(((hex >> 16) & 255) * factor), 0, 255);
    const g = clamp(Math.round(((hex >> 8) & 255) * factor), 0, 255);
    const b = clamp(Math.round((hex & 255) * factor), 0, 255);
    return (r << 16) | (g << 8) | b;
  }
  function lighten(hex, amount) {
    const r = Math.round(((hex >> 16) & 255) + (255 - ((hex >> 16) & 255)) * amount);
    const g = Math.round(((hex >> 8) & 255) + (255 - ((hex >> 8) & 255)) * amount);
    const b = Math.round((hex & 255) + (255 - (hex & 255)) * amount);
    return (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255);
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function randomSeed(i) {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function drawPill(g, x, y, w, h, fill, stroke, alpha, lineAlpha) {
    g.fillStyle(fill, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    if (stroke != null) {
      g.lineStyle(2, stroke, lineAlpha == null ? 1 : lineAlpha);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    }
  }

  function drawRounded(g, x, y, w, h, r, fill, stroke, alpha, lineAlpha, lw) {
    g.fillStyle(fill, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke != null) {
      g.lineStyle(lw || 2, stroke, lineAlpha == null ? 1 : lineAlpha);
      g.strokeRoundedRect(x, y, w, h, r);
    }
  }

  function meshPair(a, b) {
    const d = dist(a.x, a.y, b.x, b.y);
    return Math.abs(d - (a.r + b.r)) <= MESH_TOLERANCE;
  }

  function computeDriveGraph(gears, crankId) {
    const byId = new Map();
    const links = [];
    for (let i = 0; i < gears.length; i++) byId.set(gears[i].id, gears[i]);
    for (let i = 0; i < gears.length; i++) {
      for (let j = i + 1; j < gears.length; j++) {
        if (meshPair(gears[i], gears[j])) {
          links.push({ a: gears[i].id, b: gears[j].id });
        }
      }
    }

    const states = new Map();
    const root = byId.get(crankId);
    if (!root) return { jammed: false, links: links, states: states };
    states.set(root.id, { gear: root, speed: DRIVE_SPEED, direction: 1, powered: true });
    const queue = [root.id];
    let jammed = false;

    while (queue.length) {
      const currentId = queue.shift();
      const current = states.get(currentId);
      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        let nextId = null;
        if (link.a === currentId) nextId = link.b;
        else if (link.b === currentId) nextId = link.a;
        if (nextId == null) continue;
        const nextGear = byId.get(nextId);
        if (!nextGear) continue;
        const expected = {
          gear: nextGear,
          direction: -current.direction,
          speed: current.speed * current.gear.teeth / nextGear.teeth,
          powered: true,
        };
        const known = states.get(nextId);
        if (!known) {
          states.set(nextId, expected);
          queue.push(nextId);
        } else {
          if (known.direction !== expected.direction || Math.abs(known.speed - expected.speed) > 0.04) {
            jammed = true;
          }
        }
      }
    }
    return { jammed: jammed, links: links, states: states };
  }

  function drawGearShape(g, r, teeth, color, lightColor, opts) {
    const o = opts || {};
    const alpha = o.alpha == null ? 1 : o.alpha;
    const outer = r + Math.max(5, r * 0.09);
    const root = r - Math.max(3, r * 0.06);
    const step = TAU / teeth;
    g.fillStyle(shade(color, 0.58), alpha);
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a = i * step / 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? outer : root;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
    g.lineStyle(2, shade(color, 0.38), alpha);
    g.strokePath();

    g.fillStyle(color, alpha);
    g.fillCircle(0, 0, r * 0.83);
    g.fillStyle(lightColor, alpha * 0.78);
    g.fillCircle(0, -r * 0.07, r * 0.68);
    g.lineStyle(Math.max(2, r * 0.06), shade(color, 0.56), alpha * 0.88);
    g.strokeCircle(0, 0, r * 0.56);

    const spokes = r >= 70 ? 6 : (r >= 40 ? 5 : 4);
    g.lineStyle(Math.max(2, r * 0.07), shade(color, 0.55), alpha * 0.8);
    for (let i = 0; i < spokes; i++) {
      const a = i * TAU / spokes - Math.PI / 2;
      g.lineBetween(Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18,
        Math.cos(a) * r * 0.53, Math.sin(a) * r * 0.53);
    }

    g.fillStyle(shade(color, 0.5), alpha);
    g.fillCircle(0, 0, Math.max(5, r * 0.19));
    g.fillStyle(C.cream, alpha);
    g.fillCircle(0, 0, Math.max(3, r * 0.1));
    g.fillStyle(shade(color, 0.38), alpha);
    g.fillCircle(0, 0, Math.max(1.7, r * 0.055));
    g.lineStyle(1.5, C.white, alpha * 0.35);
    g.beginPath();
    g.arc(0, 0, r * 0.72, -2.5, -1.4, false);
    g.strokePath();
  }

  function drawCrankArm(g, r) {
    g.lineStyle(7, C.brassDeep, 1);
    g.lineBetween(0, 0, r + 16, 0);
    g.lineStyle(4, C.brassLight, 1);
    g.lineBetween(0, 0, r + 16, 0);
    g.fillStyle(C.creamSoft, 1);
    g.fillCircle(r + 18, 0, 7);
    g.lineStyle(2, C.brassDeep, 1);
    g.strokeCircle(r + 18, 0, 7);
  }

  function drawBackground(g) {
    g.fillGradientStyle(C.night, C.nightSoft, 0x3B2417, 0x2A170F, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // 墙面木板与远处工具剪影
    for (let i = 0; i < 12; i++) {
      const y = i * 82;
      g.fillStyle(i % 2 ? 0x5A3520 : 0x4C2C1A, 0.18);
      g.fillRect(0, y, WIDTH, 3);
    }
    g.fillStyle(0x1A0D08, 0.2);
    g.fillRect(0, 0, 44, HEIGHT);
    g.fillRect(WIDTH - 44, 0, 44, HEIGHT);
    g.lineStyle(2, C.gold, 0.08);
    g.strokeCircle(86, 752, 54);
    g.strokeCircle(458, 102, 44);
    g.fillStyle(0xC98B4D, 0.08);
    g.fillCircle(270, 446, 312);

    // 顶部悬挂的小灯与光晕
    g.lineStyle(2, 0x160B06, 0.5);
    g.lineBetween(90, 0, 90, 28);
    g.lineBetween(450, 0, 450, 20);
    g.fillStyle(C.brass, 0.9);
    g.fillCircle(90, 36, 8);
    g.fillStyle(0xFFD881, 0.12);
    g.fillCircle(90, 36, 27);
  }

  function drawBoard(g) {
    g.fillStyle(C.shadow, 0.55);
    g.fillRoundedRect(BOARD.x + 7, BOARD.y + 10, BOARD.w, BOARD.h, 22);
    g.lineStyle(4, C.brassDeep, 0.8);
    g.fillStyle(C.woodDark, 1);
    g.fillRoundedRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 22);
    g.lineStyle(2, C.brass, 0.7);
    g.strokeRoundedRect(BOARD.x + 3, BOARD.y + 3, BOARD.w - 6, BOARD.h - 6, 19);

    g.fillStyle(C.board, 1);
    g.fillRoundedRect(PLAY.x - 8, PLAY.y - 8, PLAY.w + 16, PLAY.h + 16, 14);
    g.lineStyle(2, C.boardLight, 0.48);
    g.strokeRoundedRect(PLAY.x - 7, PLAY.y - 7, PLAY.w + 14, PLAY.h + 14, 13);

    for (let i = 0; i < 19; i++) {
      const y = PLAY.y + i * 12 + 4;
      g.fillStyle(0x7A4727, 0.12);
      g.fillRect(PLAY.x, y, PLAY.w, 1);
    }

    for (let row = 0; row < PEG_ROWS; row++) {
      for (let col = 0; col < PEG_COLS; col++) {
        const p = pegPoint(col, row);
        g.fillStyle(0x5D361F, 0.48);
        g.fillCircle(p.x + 0.8, p.y + 1, 2.5);
        g.fillStyle(0xF1CF8C, 0.28);
        g.fillCircle(p.x - 0.5, p.y - 0.5, 1.15);
      }
    }

    const corners = [
      [BOARD.x + 18, BOARD.y + 18],
      [BOARD.x + BOARD.w - 18, BOARD.y + 18],
      [BOARD.x + 18, BOARD.y + BOARD.h - 18],
      [BOARD.x + BOARD.w - 18, BOARD.y + BOARD.h - 18],
    ];
    for (let i = 0; i < corners.length; i++) {
      g.fillStyle(C.brassDeep, 0.92);
      g.fillCircle(corners[i][0], corners[i][1], 6);
      g.fillStyle(C.brassLight, 0.9);
      g.fillCircle(corners[i][0] - 1.2, corners[i][1] - 1.4, 2.3);
    }
  }

  function drawTray(g) {
    g.fillStyle(C.shadow, 0.5);
    g.fillRoundedRect(TRAY.x + 6, TRAY.y + 8, TRAY.w, TRAY.h, 20);
    drawRounded(g, TRAY.x, TRAY.y, TRAY.w, TRAY.h, 20, 0x402416, C.brassDeep, 1, 0.7, 2);
    g.lineStyle(1, C.brass, 0.25);
    g.strokeRoundedRect(TRAY.x + 5, TRAY.y + 5, TRAY.w - 10, TRAY.h - 10, 16);

    for (let i = 0; i < L.trayItems.length; i++) {
      const item = L.trayItems[i];
      g.fillStyle(0x2C170D, 0.35);
      g.fillCircle(item.x, item.y + 4, item.hit - 2);
      g.fillStyle(C.board, 0.62);
      g.fillCircle(item.x, item.y, item.hit - 5);
      g.lineStyle(1.5, C.brass, 0.24);
      g.strokeCircle(item.x, item.y, item.hit - 5);
    }
  }

  function drawWindmillBase(g, x, y) {
    g.fillStyle(0x6A4025, 1);
    g.fillTriangle(x - 18, y + 34, x + 18, y + 34, x, y - 22);
    g.fillStyle(0xD6B36D, 1);
    g.fillTriangle(x - 13, y + 30, x + 13, y + 30, x, y - 14);
    g.lineStyle(2, 0x80542F, 0.75);
    g.strokeTriangle(x - 18, y + 34, x + 18, y + 34, x, y - 22);
    g.fillStyle(0x8B5A31, 1);
    g.fillRect(x - 3, y - 18, 6, 32);
  }

  function drawWindmillRotor(g) {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = -sa, ny = ca;
      const px = ca * 21;
      const py = sa * 21;
      g.fillStyle(i % 2 ? C.cream : C.creamSoft, 1);
      g.beginPath();
      g.moveTo(nx * 4, ny * 4);
      g.lineTo(px + nx * 9, py + ny * 9);
      g.lineTo(px - nx * 9, py - ny * 9);
      g.lineTo(-nx * 4, -ny * 4);
      g.closePath();
      g.fillPath();
      g.lineStyle(1.5, 0x9C7443, 0.8);
      g.strokePath();
    }
    g.fillStyle(C.brassDeep, 1);
    g.fillCircle(0, 0, 6);
    g.fillStyle(C.brassLight, 1);
    g.fillCircle(0, 0, 2.5);
  }

  function drawBellBody(g) {
    g.fillStyle(C.brassDeep, 1);
    g.fillTriangle(-18, 16, 18, 16, 0, -8);
    g.fillStyle(C.brass, 1);
    g.fillRoundedRect(-17, 10, 34, 10, 5);
    g.fillStyle(C.brassLight, 0.9);
    g.fillTriangle(-11, 11, 8, 11, 0, -5);
    g.fillStyle(C.brassDeep, 1);
    g.fillCircle(0, -12, 6);
    g.lineStyle(2, 0xA6782C, 0.9);
    g.strokeCircle(0, -12, 6);
    g.fillStyle(C.brassDeep, 1);
    g.fillCircle(0, 23, 5);
  }

  function drawLampBase(g, x, y) {
    g.fillStyle(0x6B4327, 1);
    g.fillRoundedRect(x - 18, y + 42, 36, 8, 4);
    g.fillRect(x - 3, y + 14, 6, 30);
    g.fillStyle(C.brassDeep, 1);
    g.fillRoundedRect(x - 17, y + 8, 34, 9, 5);
    g.fillStyle(C.creamSoft, 0.9);
    g.fillCircle(x, y, 15);
    g.lineStyle(2, C.brassDeep, 0.85);
    g.strokeCircle(x, y, 16);
    g.fillStyle(0xFFF6CC, 0.16);
    g.fillCircle(x, y, 35);
  }

  const SCENE_CONST = {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    PEG_STEP: PEG_STEP,
    PEG_COLS: PEG_COLS,
    PEG_ROWS: PEG_ROWS,
    GEAR_TYPES: {
      small: Object.assign({}, GEAR_TYPES.small),
      medium: Object.assign({}, GEAR_TYPES.medium),
      large: Object.assign({}, GEAR_TYPES.large),
    },
    MESH_TOLERANCE: MESH_TOLERANCE,
    DRIVE_SPEED: DRIVE_SPEED,
    MAX_GEARS: MAX_GEARS,
    CLEAR_CONFIRM_SEC: CLEAR_CONFIRM_SEC,
    BELL_INTERVAL: BELL_INTERVAL,
    GADGETS: GADGET_DEFS.map(function (g) { return Object.assign({}, g); }),
    LAYOUT: {
      PLAY: Object.assign({}, PLAY), BOARD: Object.assign({}, BOARD),
      TRAY: Object.assign({}, TRAY), RUN_BUTTON: Object.assign({}, RUN_BUTTON),
      CLEAR_BUTTON: Object.assign({}, CLEAR_BUTTON),
    },
  };

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
        master.gain.value = 0.26;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
      }
      return ctx;
    }

    function resume() {
      const c = ensure();
      if (c && c.state === 'suspended') {
        try { c.resume(); } catch (e) { /* ignore */ }
      }
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
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.06);
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
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.016);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }

    return {
      resume: resume,
      pick: function () { tone(560, 0.06, 0.032, 0, 'triangle'); },
      place: function () {
        tone(330, 0.09, 0.038, 0, 'triangle');
        tone(440, 0.1, 0.026, 0.035, 'sine');
      },
      meshed: function () {
        tone(740, 0.08, 0.03, 0, 'triangle');
        tone(988, 0.11, 0.024, 0.055, 'sine');
      },
      start: function () {
        sweep(150, 260, 0.28, 0.032, 'triangle');
        tone(196, 0.2, 0.022, 0.06, 'sine');
      },
      stop: function () { sweep(300, 150, 0.22, 0.026, 'sine'); },
      bell: function () {
        tone(1318.5, 0.28, 0.03, 0, 'sine');
        tone(1760, 0.2, 0.018, 0.035, 'sine');
      },
      remove: function () { sweep(430, 230, 0.14, 0.03, 'triangle'); },
      clear: function () { sweep(270, 640, 0.25, 0.026, 'sine'); },
      jammed: function () {
        tone(196, 0.22, 0.03, 0, 'sine');
        tone(164.8, 0.28, 0.024, 0.08, 'sine');
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class GearScene extends Phaser.Scene {
    constructor() {
      super('GearScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = SCENE_CONST;
      this.PALETTE = C;
      this.runState = 'idle';
      this.gears = [];
      this.gadgets = [];
      this.connections = [];
      this.driveGraph = { jammed: false, links: [], states: new Map() };
      this.driveStates = this.driveGraph.states;
      this.jammed = false;
      this.clearArmedUntil = 0;
      this.liveProps = [];
      this.clock = 0;
      this.nextGearId = 1;
      this.drag = null;
      this.activePointerId = null;
      this.toastUntil = 0;
      this.rings = [];
      this.airParticles = [];
      this.windSpawn = 0;
      this.ghostType = null;
      this.created = false;
      this.gearViews = new Map();

      this.createFixedPieces();
      this.buildStaticScene();
      this.buildGadgets();
      this.buildUi();
      this.buildTrayIcons();
      this.buildGhost();
      this.rebuildGearViews();

      this.created = true;
      this.addGear('medium', 4, 15, { silent: true });
      this.addGear('small', 7, 15, { silent: true });
      this.rebuildDriveGraph();
      this.updateGearViewStyles();
      this.drawStatus();
      this.drawRunButton();
      this.drawClearButton();

      this.input.on('pointerdown', this.onPointerDown, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointerupoutside', this.onPointerUp, this);
      Sound.resume();
    }

    createFixedPieces() {
      const cp = pegPoint(CRANK_COL, CRANK_ROW);
      this.crank = {
        id: 'crank', type: 'crank', col: CRANK_COL, row: CRANK_ROW,
        x: cp.x, y: cp.y, r: CRANK_DEF.r, teeth: CRANK_DEF.teeth,
        color: CRANK_DEF.color, light: CRANK_DEF.light, angle: -2.05, fixed: true,
      };
      this.gadgets = GADGET_DEFS.map(function (def) {
        const p = pegPoint(def.col, def.row);
        const socketCol = def.key === 'windmill' ? def.col + 2 : def.col - 2;
        const sp = pegPoint(socketCol, def.row);
        const socket = {
          id: 'socket:' + def.key, type: 'socket', x: sp.x, y: sp.y,
          col: socketCol, row: def.row, r: SOCKET_DEF.r, teeth: SOCKET_DEF.teeth,
          color: SOCKET_DEF.color, light: SOCKET_DEF.light, angle: 0, fixed: true,
        };
        return {
          key: def.key, name: def.name, col: def.col, row: def.row, x: p.x, y: p.y,
          socketCol: socketCol, socketRow: def.row, socket: socket,
          connected: false, active: false, rotorAngle: 0,
          bellTimer: 0, prevActive: false,
        };
      }, this);
      this.gadgetMap = new Map();
      for (let i = 0; i < this.gadgets.length; i++) this.gadgetMap.set(this.gadgets[i].key, this.gadgets[i]);
    }

    buildStaticScene() {
      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawBackground(this.worldG);
      this.boardG = this.add.graphics().setDepth(DEPTH.board);
      drawBoard(this.boardG);
      this.gadgetG = this.add.graphics().setDepth(DEPTH.gadgets);
      this.linkG = this.add.graphics().setDepth(DEPTH.arrows);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.trayG = this.add.graphics().setDepth(DEPTH.ui - 3);
      drawTray(this.trayG);
    }

    buildGadgets() {
      const self = this;
      for (let i = 0; i < this.gadgets.length; i++) {
        const g = this.gadgets[i];
        const s = g.socket;
        self.gadgetG.fillStyle(C.shadow, 0.3);
        self.gadgetG.fillCircle(s.x + 2, s.y + 3, 20);
        self.gadgetG.fillStyle(C.brassDeep, 0.88);
        self.gadgetG.fillCircle(s.x, s.y, 20);
        self.gadgetG.lineStyle(1.5, C.brassLight, 0.65);
        self.gadgetG.strokeCircle(s.x, s.y, 20);

        if (g.key === 'windmill') {
          self.gadgetG.lineStyle(5, C.brassDeep, 0.9);
          self.gadgetG.lineBetween(g.x + 20, g.y, s.x - 18, s.y);
          self.gadgetG.lineStyle(2, C.brass, 0.95);
          self.gadgetG.lineBetween(g.x + 20, g.y, s.x - 18, s.y);
          drawWindmillBase(self.gadgetG, g.x, g.y + 8);
          self.windmillRotor = self.add.container(g.x, g.y - 20).setDepth(DEPTH.gadgets + 1);
          const rotorG = self.add.graphics();
          drawWindmillRotor(rotorG);
          self.windmillRotor.add(rotorG);
        } else if (g.key === 'bell') {
          self.gadgetG.lineStyle(5, C.brassDeep, 0.9);
          self.gadgetG.lineBetween(g.x - 20, g.y, s.x + 18, s.y);
          self.gadgetG.lineStyle(2, C.brass, 0.95);
          self.gadgetG.lineBetween(g.x - 20, g.y, s.x + 18, s.y);
          self.gadgetG.fillStyle(C.brassDeep, 0.95);
          self.gadgetG.fillRect(g.x - 36, g.y - 54, 72, 8);
          self.bellPivot = self.add.container(g.x, g.y - 44).setDepth(DEPTH.gadgets + 1);
          const chainG = self.add.graphics();
          chainG.fillStyle(C.brassDeep, 1);
          chainG.fillCircle(0, 0, 5);
          chainG.lineStyle(2, C.brass, 0.9);
          chainG.lineBetween(0, 2, 0, 27);
          const bellHolder = self.add.container(0, 44);
          const bellG = self.add.graphics();
          drawBellBody(bellG);
          bellHolder.add(bellG);
          self.bellPivot.add([chainG, bellHolder]);
        } else if (g.key === 'lamp') {
          self.gadgetG.lineStyle(5, C.brassDeep, 0.9);
          self.gadgetG.lineBetween(g.x - 20, g.y, s.x + 18, s.y);
          self.gadgetG.lineStyle(2, C.brass, 0.95);
          self.gadgetG.lineBetween(g.x - 20, g.y, s.x + 18, s.y);
          self.lampGlow = self.add.graphics().setDepth(DEPTH.gadgets - 1).setAlpha(0.05);
          self.lampGlow.fillStyle(0xFFE7A3, 0.08).fillCircle(g.x, g.y, 64);
          self.lampGlow.fillStyle(0xFFEFB8, 0.13).fillCircle(g.x, g.y, 44);
          self.lampGlow.fillStyle(0xFFF8D8, 0.2).fillCircle(g.x, g.y, 25);
          drawLampBase(self.gadgetG, g.x, g.y);
        }

        const labelY = g.key === 'lamp' ? g.y + 74 : g.y + 62;
        self.add.text(g.x, labelY, g.name, {
          fontFamily: FONT, fontSize: '12px', color: '#FFE9BB',
          stroke: '#3A2416', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(DEPTH.status);
      }
    }

    buildUi() {
      const L = this.L;
      this.titleText = this.add.text(L.title.x, L.title.y, '齿轮工坊', {
        fontFamily: TITLE_FONT, fontSize: '38px', fontStyle: 'bold', color: '#FFF2D3',
        stroke: '#3A2416', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.subText = this.add.text(L.subtitle.x, L.subtitle.y, '拖齿轮去咬合 · 点摇柄转起来', {
        fontFamily: FONT, fontSize: '13px', color: '#E7C98F',
        stroke: '#2A170F', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.statusText = this.add.text(L.hint.x, L.hint.y, '', {
        fontFamily: FONT, fontSize: '13px', color: '#FFE9BB',
        stroke: '#2A170F', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.runBtnG = this.add.graphics().setDepth(DEPTH.ui);
      this.runLabel = this.add.text(L.run.x, L.run.y + 1, '转起来', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#3A2416', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.clearBtnG = this.add.graphics().setDepth(DEPTH.ui);
      this.clearLabel = this.add.text(L.clear.x, L.clear.y + 1, '清空', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#FFE9D2',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.toastContainer = this.add.container(WIDTH / 2, 616).setDepth(DEPTH.toast).setVisible(false);
      this.toastBg = this.add.graphics();
      this.toastText = this.add.text(0, 0, '', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#FFF2D3',
      }).setOrigin(0.5);
      this.toastContainer.add([this.toastBg, this.toastText]);
    }

    buildTrayIcons() {
      const self = this;
      for (let i = 0; i < L.trayItems.length; i++) {
        const item = L.trayItems[i];
        const def = GEAR_TYPES[item.key];
        const iconR = Math.min(def.r * 0.74, item.hit - 12);
        const holder = self.add.container(item.x, item.y).setDepth(DEPTH.ui - 1);
        const shadow = self.add.graphics();
        shadow.fillStyle(C.shadow, 0.3).fillCircle(2, 4, iconR + 3);
        const g = self.add.graphics();
        drawGearShape(g, iconR, def.teeth, def.color, def.light, { alpha: 1 });
        holder.add([shadow, g]);
        holder.rotation = i % 2 ? 0.12 : -0.08;
        self.add.text(item.x, L.labelsY, def.name, {
          fontFamily: FONT, fontSize: '12px', color: '#F3D9A5',
        }).setOrigin(0.5).setDepth(DEPTH.ui);
      }
      this.add.text(L.trayTitle.x, L.trayTitle.y, '齿轮箱', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#E9C98F',
        stroke: '#2A170F', strokeThickness: 2,
      }).setOrigin(0, 0.5).setDepth(DEPTH.ui);
    }

    buildGhost() {
      this.ghostContainer = this.add.container(0, 0).setDepth(DEPTH.ghost).setVisible(false);
      this.ghostGearG = this.add.graphics();
      this.ghostRingG = this.add.graphics();
      this.ghostContainer.add([this.ghostGearG, this.ghostRingG]);
    }

    // -------------------------------------------------- 查询与放置
    allGears() {
      const all = [this.crank];
      for (let i = 0; i < this.gears.length; i++) all.push(this.gears[i]);
      for (let i = 0; i < this.gadgets.length; i++) all.push(this.gadgets[i].socket);
      return all;
    }

    pegAt(x, y) {
      if (!isFinite(x) || !isFinite(y)) return null;
      const col = Math.round((x - PLAY.x) / PEG_STEP);
      const row = Math.round((y - PLAY.y) / PEG_STEP);
      if (col < 0 || col >= PEG_COLS || row < 0 || row >= PEG_ROWS) return null;
      const p = pegPoint(col, row);
      if (Math.abs(x - p.x) > PEG_STEP * 0.75 || Math.abs(y - p.y) > PEG_STEP * 0.75) return null;
      return { col: col, row: row, x: p.x, y: p.y };
    }

    trayItemAt(x, y) {
      for (let i = 0; i < L.trayItems.length; i++) {
        const item = L.trayItems[i];
        if (dist(x, y, item.x, item.y) <= item.hit) return item.key;
      }
      return null;
    }

    gearAt(x, y) {
      for (let i = this.gears.length - 1; i >= 0; i--) {
        const g = this.gears[i];
        if (dist(x, y, g.x, g.y) <= g.r * 0.94) return g;
      }
      return null;
    }

    crankAt(x, y) {
      return dist(x, y, this.crank.x, this.crank.y) <= this.crank.r + 12;
    }

    evaluatePlacement(type, col, row, ignoreId) {
      const def = GEAR_TYPES[type];
      const result = { ok: false, overlap: false, mesh: false, meshes: [], x: 0, y: 0, reason: 'bad' };
      if (!def) return result;
      if (!Number.isInteger(col) || !Number.isInteger(row)) return result;
      if (col < 0 || col >= PEG_COLS || row < 0 || row >= PEG_ROWS) return result;
      const p = pegPoint(col, row);
      result.x = p.x;
      result.y = p.y;
      if (p.x - def.r < PLAY.x || p.x + def.r > PLAY.x + PLAY.w ||
          p.y - def.r < PLAY.y || p.y + def.r > PLAY.y + PLAY.h) {
        result.reason = 'bounds';
        return result;
      }
      const all = this.allGears();
      for (let i = 0; i < all.length; i++) {
        const other = all[i];
        if (ignoreId != null && other.id === ignoreId) continue;
        const d = dist(p.x, p.y, other.x, other.y);
        const sum = def.r + other.r;
        if (d < sum - MESH_TOLERANCE) {
          result.overlap = true;
        } else if (Math.abs(d - sum) <= MESH_TOLERANCE) {
          result.meshes.push(other);
        }
      }
      for (let i = 0; i < this.gadgets.length; i++) {
        const gadget = this.gadgets[i];
        const bodyR = gadget.key === 'windmill' ? 32 : (gadget.key === 'bell' ? 27 : 29);
        if (dist(p.x, p.y, gadget.x, gadget.y) < def.r + bodyR - 4) {
          result.overlap = true;
        }
      }
      result.mesh = result.meshes.length > 0;
      result.ok = !result.overlap;
      result.reason = result.overlap ? 'overlap' : 'ok';
      return result;
    }

    canPlace(type, col, row, ignoreId) {
      return this.evaluatePlacement(type, col, row, ignoreId).ok;
    }

    addGear(type, col, row, opts) {
      const options = opts || {};
      const def = GEAR_TYPES[type];
      if (!def) return 'rejected';
      if (this.gears.length >= MAX_GEARS) {
        if (!options.silent) {
          this.showToast('齿轮太多啦，先拿掉几只吧');
          Sound.remove();
        }
        return 'limit';
      }
      if (!this.canPlace(type, col, row, null)) {
        if (!options.silent) {
          this.showToast('这里放不下，换个孔位试试');
          Sound.remove();
        }
        return 'rejected';
      }
      const p = pegPoint(col, row);
      const idNum = this.nextGearId++;
      const gear = {
        id: 'g' + idNum, type: type, col: col, row: row, x: p.x, y: p.y,
        r: def.r, teeth: def.teeth, color: def.color, light: def.light,
        angle: (idNum * 0.47) % TAU, fixed: false,
      };
      this.gears.push(gear);
      this.rebuildGearViews();
      const graph = this.rebuildDriveGraph();
      const touches = graph.links.some(function (l) { return l.a === gear.id || l.b === gear.id; });
      if (!options.silent) {
        if (!this.jammed) {
          if (touches) Sound.meshed(); else Sound.place();
        }
        this.spawnRing(gear.x, gear.y, touches ? C.brassLight : C.cream, gear.r + 4, gear.r + 20);
      }
      this.drawStatus();
      return 'placed';
    }

    moveGear(id, col, row) {
      let gear = null;
      for (let i = 0; i < this.gears.length; i++) if (this.gears[i].id === id) gear = this.gears[i];
      if (!gear) return false;
      if (!this.canPlace(gear.type, col, row, id)) return false;
      const p = pegPoint(col, row);
      gear.col = col;
      gear.row = row;
      gear.x = p.x;
      gear.y = p.y;
      this.rebuildGearViews();
      this.rebuildDriveGraph();
      if (!this.jammed) Sound.place();
      this.spawnRing(gear.x, gear.y, C.cream, gear.r + 4, gear.r + 16);
      this.drawStatus();
      return true;
    }

    removeGear(id) {
      let index = -1;
      for (let i = 0; i < this.gears.length; i++) if (this.gears[i].id === id) index = i;
      if (index < 0) return false;
      const gear = this.gears[index];
      this.gears.splice(index, 1);
      this.rebuildGearViews();
      this.rebuildDriveGraph();
      this.spawnRing(gear.x, gear.y, C.creamSoft, gear.r, gear.r + 14);
      Sound.remove();
      this.drawStatus();
      return true;
    }

    clearAll() {
      const count = this.gears.length;
      this.gears.length = 0;
      this.drag = null;
      this.activePointerId = null;
      if (this.ghostContainer) this.ghostContainer.setVisible(false);
      this.clearArmedUntil = 0;
      this.runState = 'idle';
      this.rings.length = 0;
      this.airParticles.length = 0;
      this.clearLiveProps();
      for (let i = 0; i < this.gadgets.length; i++) {
        const g = this.gadgets[i];
        g.bellTimer = 0;
        g.prevActive = false;
      }
      this.rebuildGearViews();
      this.rebuildDriveGraph();
      this.updateGadgetPower();
      if (this.fxG) this.fxG.clear();
      this.drawRunButton();
      this.drawClearButton();
      this.drawStatus();
      if (count > 0) {
        Sound.clear();
        this.showToast('都收回齿轮箱啦');
      }
      return count;
    }

    toggleRun() {
      Sound.resume();
      this.rebuildDriveGraph();
      if (this.jammed) {
        this.runState = 'jammed';
        Sound.jammed();
        this.showToast('齿轮打架啦，拿掉一只试试');
        this.updateGadgetPower();
        this.drawRunButton();
        this.drawStatus();
        return false;
      }
      if (this.runState === 'running') {
        this.runState = 'idle';
        Sound.stop();
      } else {
        this.runState = 'running';
        for (let i = 0; i < this.gadgets.length; i++) {
          this.gadgets[i].bellTimer = 1.2;
          this.gadgets[i].prevActive = false;
        }
        Sound.start();
        this.spawnRing(this.crank.x, this.crank.y, C.brassLight, 30, 54);
      }
      this.updateGadgetPower();
      this.drawRunButton();
      this.drawClearButton();
      this.drawStatus();
      return this.runState === 'running';
    }

    rebuildDriveGraph() {
      const graph = computeDriveGraph(this.allGears(), this.crank.id);
      const wasJammed = this.jammed;
      this.driveGraph = graph;
      this.driveStates = graph.states;
      this.connections = graph.links;
      this.jammed = graph.jammed;
      if (this.jammed) {
        if (!wasJammed && this.created) Sound.jammed();
        this.runState = 'jammed';
      } else if (this.runState === 'jammed') {
        this.runState = 'idle';
      }
      this.updateGadgetPower();
      if (this.created) {
        this.updateGearViewStyles();
        this.drawRunButton();
        this.drawStatus();
      }
      return graph;
    }

    updateGadgetPower() {
      const states = this.driveGraph && this.driveGraph.states;
      for (let i = 0; i < this.gadgets.length; i++) {
        const g = this.gadgets[i];
        g.connected = !!(states && states.has(g.socket.id));
        g.active = g.connected && this.runState === 'running';
      }
    }

    // -------------------------------------------------- 齿轮与界面绘制
    clearGearViews() {
      if (!this.gearViews) {
        this.gearViews = new Map();
        return;
      }
      this.gearViews.forEach(function (view) {
        if (view.container) view.container.destroy(true);
      });
      this.gearViews = new Map();
    }

    rebuildGearViews() {
      if (!this.add) return;
      this.clearGearViews();
      this.makeGearView(this.crank, true);
      for (let i = 0; i < this.gadgets.length; i++) this.makeGearView(this.gadgets[i].socket, false);
      const sorted = this.gears.slice().sort(function (a, b) { return b.r - a.r; });
      for (let i = 0; i < sorted.length; i++) this.makeGearView(sorted[i], false);
      this.updateGearViewStyles();
      this.syncGearRotations();
    }

    makeGearView(gear, isCrank) {
      const container = this.add.container(gear.x, gear.y).setDepth(DEPTH.gears);
      const shadow = this.add.graphics();
      shadow.fillStyle(C.shadow, 0.3);
      shadow.fillCircle(3, 5, gear.r + 2);
      const body = this.add.graphics();
      drawGearShape(body, gear.r, gear.teeth, gear.color, gear.light, { alpha: 1 });
      container.add([shadow, body]);
      if (isCrank) {
        const arm = this.add.graphics();
        drawCrankArm(arm, gear.r);
        container.add(arm);
      }
      const ring = this.add.graphics();
      ring.lineStyle(3.5, C.red, 0.95);
      ring.strokeCircle(0, 0, gear.r + 8);
      ring.setVisible(false);
      container.add(ring);
      container.rotation = gear.angle || 0;
      this.gearViews.set(gear.id, { container: container, ring: ring, gear: gear });
    }

    updateGearViewStyles() {
      if (!this.gearViews) return;
      const states = this.driveGraph && this.driveGraph.states;
      const draggingId = this.drag && this.drag.kind === 'move' ? this.drag.gearId : null;
      this.gearViews.forEach(function (view) {
        const powered = !!(states && states.has(view.gear.id));
        const jam = !!this.jammed && powered;
        view.ring.setVisible(jam);
        if (view.gear.id === draggingId) {
          view.container.setAlpha(0.2);
        } else {
          view.container.setAlpha(powered ? 1 : 0.88);
        }
      }, this);
    }

    syncGearRotations() {
      if (!this.gearViews) return;
      this.gearViews.forEach(function (view) {
        view.container.rotation = view.gear.angle || 0;
      });
    }

    drawRunButton() {
      if (!this.runBtnG) return;
      const r = this.L.run;
      const g = this.runBtnG;
      g.clear();
      const running = this.runState === 'running';
      const jammed = this.runState === 'jammed';
      const base = jammed ? 0x9A4537 : (running ? 0xD96A50 : 0x4F8C73);
      const edge = jammed ? 0x6C2A22 : (running ? 0x9A3D2D : 0x315E4A);
      const hi = jammed ? 0xD88470 : (running ? 0xF4A08A : 0x83C3A2);
      g.fillStyle(C.shadow, 0.4).fillRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 5, r.w, r.h, r.h / 2);
      g.fillStyle(base, 1).fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
      g.fillStyle(hi, 0.6).fillRoundedRect(r.x - r.w / 2 + 6, r.y - r.h / 2 + 5, r.w - 12, r.h * 0.38, r.h * 0.2);
      g.lineStyle(2.5, edge, 0.9).strokeRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 2, r.w - 4, r.h - 4, r.h / 2 - 2);
      const ix = r.x - r.w / 2 + 29;
      if (running) {
        g.fillStyle(0xFFFFFF, 0.95);
        g.fillRoundedRect(ix - 6, r.y - 9, 5, 18, 2);
        g.fillRoundedRect(ix + 3, r.y - 9, 5, 18, 2);
      } else if (jammed) {
        g.lineStyle(3, 0xFFD9CC, 0.92);
        g.lineBetween(ix - 7, r.y - 7, ix + 7, r.y + 7);
        g.lineBetween(ix + 7, r.y - 7, ix - 7, r.y + 7);
      } else {
        g.fillStyle(0xFFFFFF, 0.95);
        g.fillTriangle(ix - 5, r.y - 9, ix - 5, r.y + 9, ix + 9, r.y);
      }
      this.runLabel.setText(jammed ? '卡住了' : (running ? '停一停' : '转起来'));
    }

    drawClearButton() {
      if (!this.clearBtnG) return;
      const r = this.L.clear;
      const armed = this.clearArmedUntil > this.clock;
      const g = this.clearBtnG;
      g.clear();
      g.fillStyle(C.shadow, 0.38).fillRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 5, r.w, r.h, r.h / 2);
      g.fillStyle(armed ? 0xB84C3D : 0x553220, 1).fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
      g.fillStyle(armed ? 0xE28C74 : 0x7B4B2C, 0.55).fillRoundedRect(r.x - r.w / 2 + 5, r.y - r.h / 2 + 5, r.w - 10, r.h * 0.36, r.h * 0.18);
      g.lineStyle(2, armed ? C.coralLight : C.brassDeep, 0.85).strokeRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 2, r.w - 4, r.h - 4, r.h / 2 - 2);
      this.clearLabel.setText(armed ? '再点一次' : '清空');
      this.clearLabel.setColor(armed ? '#FFF6E4' : '#F0D4A4');
    }

    drawStatus() {
      if (!this.statusText) return;
      if (this.runState === 'jammed') {
        this.statusText.setText('齿轮打架啦，拿掉一只试试');
        this.statusText.setColor('#FFB0A6');
      } else if (this.runState === 'running') {
        let gadgetOn = false;
        for (let i = 0; i < this.gadgets.length; i++) if (this.gadgets[i].active) gadgetOn = true;
        this.statusText.setText(gadgetOn ? '齿轮转起来啦，机关也在动！' : '齿轮转起来啦，试试接通小机关');
        this.statusText.setColor('#BDEBCF');
      } else {
        this.statusText.setText('拖齿轮到钉板上，靠近就会咬合');
        this.statusText.setColor('#FFE9BB');
      }
    }

    showToast(text, duration) {
      if (!this.toastContainer) return;
      const d = duration == null ? 1.8 : duration;
      this.toastText.setText(text);
      this.toastBg.clear();
      const w = Math.max(238, Math.min(420, String(text).length * 15 + 54));
      drawRounded(this.toastBg, -w / 2, -21, w, 42, 21, 0x2B180F, C.brass, 0.96, 0.55, 1.5);
      this.toastContainer.setVisible(true).setAlpha(1);
      this.toastUntil = this.clock + d;
    }

    spawnRing(x, y, color, r0, r1) {
      this.rings.push({
        x: x, y: y, color: color, t: 0, dur: 0.55,
        r0: r0 == null ? 18 : r0, r1: r1 == null ? 44 : r1,
      });
      if (this.rings.length > 24) this.rings.shift();
    }

    spawnWindParticles() {
      const wm = this.gadgetMap && this.gadgetMap.get('windmill');
      if (!wm) return;
      for (let i = 0; i < 2; i++) {
        this.airParticles.push({
          x: wm.x + 14 + Math.random() * 12,
          y: wm.y - 26 + Math.random() * 42,
          vx: 34 + Math.random() * 34,
          vy: -10 + Math.random() * 20,
          life: 0,
          max: 0.8 + Math.random() * 0.55,
          size: 1.6 + Math.random() * 2.4,
        });
      }
      if (this.airParticles.length > 60) this.airParticles.splice(0, this.airParticles.length - 60);
    }

    updateGadgetEffects(dt) {
      if (!this.gadgetMap) return;
      const states = this.driveGraph && this.driveGraph.states;

      const wm = this.gadgetMap.get('windmill');
      if (wm && this.windmillRotor) {
        const st = states && states.get(wm.socket.id);
        if (wm.active && st) {
          wm.rotorAngle += st.direction * Math.max(0.35, st.speed) * 3.2 * dt;
          this.windSpawn -= dt;
          if (this.windSpawn <= 0) {
            this.spawnWindParticles();
            this.windSpawn = 0.11 + Math.random() * 0.1;
          }
        }
        this.windmillRotor.rotation = wm.rotorAngle;
      }

      const bell = this.gadgetMap.get('bell');
      if (bell && this.bellPivot) {
        if (bell.active) {
          bell.bellTimer += dt;
          if (bell.bellTimer >= BELL_INTERVAL) {
            bell.bellTimer = 0;
            Sound.bell();
            this.spawnRing(bell.x, bell.y - 2, C.brassLight, 18, 40);
          }
          if (!bell.prevActive) bell.bellTimer = 1.15;
        }
        bell.prevActive = bell.active;
        const target = bell.active ? Math.sin(this.clock * 8.6) * 0.24 : 0;
        this.bellPivot.rotation = lerp(this.bellPivot.rotation, target, clamp(dt * 5.5, 0, 1));
      }

      const lamp = this.gadgetMap.get('lamp');
      if (lamp && this.lampGlow) {
        const target = lamp.active ? 0.5 + Math.sin(this.clock * 4.2) * 0.12 : 0.05;
        this.lampGlow.setAlpha(lerp(this.lampGlow.alpha, target, clamp(dt * 4, 0, 1)));
      }
    }

    renderFx(dt) {
      if (!this.fxG) return;
      const g = this.fxG;
      g.clear();
      const states = this.driveGraph && this.driveGraph.states;
      const byId = new Map();
      const all = this.allGears();
      for (let i = 0; i < all.length; i++) byId.set(all[i].id, all[i]);

      if (this.runState === 'running' && this.connections) {
        for (let i = 0; i < this.connections.length; i++) {
          const link = this.connections[i];
          const a = byId.get(link.a);
          const b = byId.get(link.b);
          if (!a || !b || !states || !states.has(a.id) || !states.has(b.id)) continue;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const a1 = 0.18 + Math.sin(this.clock * 11 + i) * 0.08;
          g.lineStyle(1.2, C.brassLight, a1 * 0.75);
          g.lineBetween(a.x, a.y, b.x, b.y);
          g.fillStyle(C.brassLight, a1 + 0.22);
          g.fillCircle(mx, my, 2.6 + Math.sin(this.clock * 8 + i) * 0.8);
        }
      }

      for (let i = 0; i < this.rings.length; i++) {
        const r = this.rings[i];
        r.t += dt;
        const t = clamp(r.t / r.dur, 0, 1);
        const radius = lerp(r.r0, r.r1, easeOutCubic(t));
        g.lineStyle(2.5, r.color, (1 - t) * 0.75);
        g.strokeCircle(r.x, r.y, radius);
      }
      if (this.rings.length) this.rings = this.rings.filter(function (r) { return r.t < r.dur; });

      for (let i = 0; i < this.airParticles.length; i++) {
        const p = this.airParticles[i];
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const t = clamp(p.life / p.max, 0, 1);
        g.lineStyle(p.size, 0xFFF6DC, (1 - t) * 0.3);
        g.lineBetween(p.x, p.y, p.x - 7, p.y + 1.5);
      }
      this.airParticles = this.airParticles.filter(function (p) { return p.life < p.max; });

      if (this.runState === 'idle' || this.runState === 'jammed') {
        const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3.4);
        g.lineStyle(2, this.runState === 'jammed' ? C.red : C.brassLight, 0.2 + pulse * 0.3);
        g.strokeCircle(this.crank.x, this.crank.y, this.crank.r + 7 + pulse * 4);
      }
    }

    trackObj(obj) {
      if (obj) this.liveProps.push(obj);
      return obj;
    }

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

    // -------------------------------------------------- 拖拽
    onPointerDown(pointer) {
      if (this.activePointerId != null) return false;
      Sound.resume();
      const x = pointer.x;
      const y = pointer.y;
      if (!isFinite(x) || !isFinite(y)) return false;

      if (containsCentered(this.L.clear, x, y)) {
        if (!this.gears.length) {
          this.showToast('先放几只齿轮吧');
          return true;
        }
        if (this.clearArmedUntil > this.clock) {
          this.clearArmedUntil = 0;
          this.clearAll();
        } else {
          this.clearArmedUntil = this.clock + CLEAR_CONFIRM_SEC;
          this.drawClearButton();
          this.showToast('再点一次，就把齿轮都收好');
        }
        return true;
      }

      if (containsCentered(this.L.run, x, y) || this.crankAt(x, y)) {
        this.toggleRun();
        return true;
      }

      const placed = this.gearAt(x, y);
      if (placed) {
        this.activePointerId = pointer.id == null ? 1 : pointer.id;
        this.drag = {
          kind: 'move', key: placed.type, type: placed.type, gearId: placed.id,
          x: x, y: y, angle: placed.angle,
        };
        this.ghostType = null;
        Sound.pick();
        this.updateGearViewStyles();
        this.renderDrag();
        return true;
      }

      const key = this.trayItemAt(x, y);
      if (key) {
        this.activePointerId = pointer.id == null ? 1 : pointer.id;
        this.drag = {
          kind: 'new', key: key, type: key, gearId: null,
          x: x, y: y, angle: 0.18,
        };
        this.ghostType = null;
        Sound.pick();
        this.renderDrag();
        return true;
      }
      return false;
    }

    onPointerMove(pointer) {
      if (!this.drag) return;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (this.activePointerId !== pid) return;
      if (!isFinite(pointer.x) || !isFinite(pointer.y)) return;
      this.drag.x = pointer.x;
      this.drag.y = pointer.y;
      this.renderDrag();
    }

    onPointerUp(pointer) {
      const pid = pointer.id == null ? 1 : pointer.id;
      if (this.activePointerId !== pid) return;
      const drag = this.drag;
      const x = pointer.x == null ? (drag ? drag.x : 0) : pointer.x;
      const y = pointer.y == null ? (drag ? drag.y : 0) : pointer.y;
      this.drag = null;
      this.activePointerId = null;
      if (this.ghostContainer) this.ghostContainer.setVisible(false);
      this.ghostType = null;

      if (drag) {
        const peg = this.pegAt(x, y);
        if (drag.kind === 'new') {
          if (peg) this.addGear(drag.type, peg.col, peg.row);
        } else {
          const overBoard = x >= BOARD.x && x <= BOARD.x + BOARD.w && y >= BOARD.y && y <= BOARD.y + BOARD.h;
          if (!overBoard || y >= TRAY.y) {
            this.removeGear(drag.gearId);
          } else if (peg) {
            if (!this.moveGear(drag.gearId, peg.col, peg.row)) {
              Sound.remove();
              this.showToast('这里放不下，换个位置吧');
            }
          }
        }
      }
      this.updateGearViewStyles();
      this.drawStatus();
    }

    renderDrag() {
      if (!this.ghostContainer) return;
      if (!this.drag) {
        this.ghostContainer.setVisible(false);
        return;
      }
      const d = this.drag;
      const def = GEAR_TYPES[d.type];
      if (!def) {
        this.ghostContainer.setVisible(false);
        return;
      }
      const peg = this.pegAt(d.x, d.y);
      const evaluation = peg ? this.evaluatePlacement(d.type, peg.col, peg.row, d.gearId) : null;
      const gx = peg ? peg.x : d.x;
      const gy = peg ? peg.y : d.y;
      this.ghostContainer.setPosition(gx, gy).setVisible(true);

      if (this.ghostType !== d.type) {
        this.ghostGearG.clear();
        drawGearShape(this.ghostGearG, def.r, def.teeth, def.color, def.light, { alpha: 0.68 });
        this.ghostType = d.type;
      }
      this.ghostGearG.rotation = d.angle || 0;

      let ringColor = C.cream;
      let hint = '';
      let hintColor = '#FFE9BB';
      if (!peg) {
        ringColor = C.creamSoft;
        this.ghostContainer.setAlpha(0.5);
      } else if (evaluation && evaluation.overlap) {
        ringColor = C.red;
        hint = '放不下';
        hintColor = '#FFB0A6';
        this.ghostContainer.setAlpha(0.62);
      } else if (evaluation && evaluation.mesh) {
        ringColor = C.leaf;
        hint = '咬合';
        hintColor = '#C7EFB7';
        this.ghostContainer.setAlpha(0.95);
      } else {
        ringColor = C.cream;
        this.ghostContainer.setAlpha(0.82);
      }

      this.ghostRingG.clear();
      this.ghostRingG.fillStyle(ringColor, 0.08);
      this.ghostRingG.fillCircle(0, 0, def.r + 9);
      this.ghostRingG.lineStyle(3, ringColor, 0.95);
      this.ghostRingG.strokeCircle(0, 0, def.r + 9);
      if (evaluation && evaluation.mesh && !evaluation.overlap) {
        const other = evaluation.meshes[0];
        this.ghostRingG.lineStyle(2, C.leaf, 0.52);
        this.ghostRingG.lineBetween(0, 0, other.x - gx, other.y - gy);
      }
      if (evaluation && evaluation.overlap) {
        this.ghostRingG.lineStyle(3, C.red, 0.9);
        this.ghostRingG.lineBetween(8, -def.r - 22, 22, -def.r - 8);
        this.ghostRingG.lineBetween(22, -def.r - 22, 8, -def.r - 8);
      }

      if (!this.ghostHintText) {
        this.ghostHintText = this.add.text(0, 0, '', {
          fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#FFF2D3',
          stroke: '#2A170F', strokeThickness: 3,
        }).setOrigin(0.5);
        this.ghostContainer.add(this.ghostHintText);
      }
      this.ghostHintText.setText(hint);
      this.ghostHintText.setColor(hintColor);
      this.ghostHintText.setPosition(0, -def.r - 28);
    }

    // -------------------------------------------------- 主循环
    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      if (!this.gears) return;
      dt = Math.min(dt, 0.1);
      this.clock += dt;

      if (this.clearArmedUntil > 0 && this.clock >= this.clearArmedUntil) {
        this.clearArmedUntil = 0;
        this.drawClearButton();
      }

      if (this.runState === 'running') {
        const states = this.driveGraph && this.driveGraph.states;
        this.crank.angle = normalizeAngle(this.crank.angle + DRIVE_SPEED * dt);
        if (states) {
          for (let i = 0; i < this.gears.length; i++) {
            const gear = this.gears[i];
            const st = states.get(gear.id);
            if (st) gear.angle = normalizeAngle(gear.angle + st.direction * st.speed * dt);
          }
          for (let i = 0; i < this.gadgets.length; i++) {
            const socket = this.gadgets[i].socket;
            const st = states.get(socket.id);
            if (st) socket.angle = normalizeAngle(socket.angle + st.direction * st.speed * dt);
          }
        }
      }

      this.syncGearRotations();
      this.updateGadgetEffects(dt);
      this.renderFx(dt);

      if (this.toastContainer && this.toastContainer.visible) {
        const left = this.toastUntil - this.clock;
        if (left <= 0) {
          this.toastContainer.setVisible(false);
          this.toastUntil = 0;
        } else {
          this.toastContainer.setAlpha(Math.min(1, left / 0.32));
        }
      }
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

  function normalizeAngle(a) {
    if (!isFinite(a)) return 0;
    a = a % TAU;
    if (a > Math.PI) a -= TAU;
    if (a < -Math.PI) a += TAU;
    return a;
  }

  window.GearScene = GearScene;
  window.GearRules = {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    PEG_STEP: PEG_STEP,
    PEG_COLS: PEG_COLS,
    PEG_ROWS: PEG_ROWS,
    MESH_TOLERANCE: MESH_TOLERANCE,
    DRIVE_SPEED: DRIVE_SPEED,
    MAX_GEARS: MAX_GEARS,
    CLEAR_CONFIRM_SEC: CLEAR_CONFIRM_SEC,
    GEAR_TYPES: GEAR_TYPES,
    GADGETS: GADGET_DEFS,
    PLAY: PLAY,
    pegPoint: pegPoint,
    meshPair: meshPair,
    computeDriveGraph: computeDriveGraph,
  };
})();
