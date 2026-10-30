/*
 * 森林大富翁：竖屏 540x960 的轻量掷骰子绕圈游戏。
 * 小蓝熊玩家对战小狐狸电脑，18 格外圈，先绕回彩旗终点者获胜。
 * 全部画面由 Phaser.Graphics 程序化绘制，声音由 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;

  const COLS = 6;
  const ROWS = 5;
  const TILE_COUNT = 18;
  const LAP_COUNT = 2;
  const FINISH_PROGRESS = TILE_COUNT * LAP_COUNT;
  const DIE_MIN = 1;
  const DIE_MAX = 6;
  const ROLL_SEC = 0.65;
  const STEP_SEC = 0.16;
  const AI_DELAY = 0.8;
  const EFFECT_SEC = 1.0;
  const PLAIN_SEC = 0.34;
  const CARD_LOCK_SEC = 0.55;

  const BOARD = { x: 24, y: 144, w: 492, h: 412, step: 80, originX: 70, originY: 190, tileSize: 70 };
  const PATH = (function () {
    const out = [];
    for (let col = 0; col < COLS; col++) out.push({ col: col, row: ROWS - 1 });
    for (let row = ROWS - 2; row >= 0; row--) out.push({ col: COLS - 1, row: row });
    for (let col = COLS - 2; col >= 0; col--) out.push({ col: col, row: 0 });
    for (let row = 1; row <= ROWS - 2; row++) out.push({ col: 0, row: row });
    return out.map(function (p, i) {
      return { index: i, col: p.col, row: p.row, x: BOARD.originX + BOARD.step * p.col, y: BOARD.originY + BOARD.step * p.row };
    });
  })();

  const SPECIALS = [
    { index: 2, kind: 'plus', delta: 1, label: '+1', sub: '前进 1 格' },
    { index: 5, kind: 'plus', delta: 2, label: '+2', sub: '前进 2 格' },
    { index: 8, kind: 'minus', delta: -1, label: '-1', sub: '后退 1 格' },
    { index: 10, kind: 'pause', delta: 0, label: '暂停', sub: '休息一回合' },
    { index: 12, kind: 'plus', delta: 2, label: '+2', sub: '前进 2 格' },
    { index: 15, kind: 'minus', delta: -2, label: '-2', sub: '后退 2 格' },
    { index: 16, kind: 'plus', delta: 1, label: '+1', sub: '前进 1 格' },
  ];

  const C = {
    skyTop: 0xD8F2F5,
    skyBottom: 0xFFF6D8,
    cream: 0xFFF8E8,
    creamDeep: 0xF4E1BD,
    paper: 0xFFFCF4,
    grass: 0x9FD98D,
    grassDeep: 0x69B66F,
    mint: 0xCBEBCB,
    forest: 0x3F795C,
    forestDeep: 0x275440,
    gold: 0xF1C453,
    goldDeep: 0xA96B22,
    tile: 0xFFF8E4,
    tileEdge: 0xDCBE82,
    ink: 0x4A3A2E,
    inkSoft: 0x765B43,
    plus: 0x4FB57A,
    plusSoft: 0xDDF3E1,
    minus: 0xE97979,
    minusSoft: 0xFFE2DF,
    pause: 0x9A7ADB,
    pauseSoft: 0xE9E0FA,
    player: 0x4F91E8,
    playerDeep: 0x2D5F9F,
    playerSoft: 0xD9E9FF,
    fox: 0xF18A3D,
    foxDeep: 0x9A4E21,
    foxSoft: 0xFFE5C9,
    white: 0xFFFFFF,
    shadow: 0x1F3B2E,
    coral: 0xFF7B88,
    leaf: 0x73B76B,
  };

  const DEPTH = {
    world: 0,
    board: 2,
    decorations: 3,
    tokens: 8,
    panel: 10,
    control: 12,
    ui: 20,
    effect: 24,
    fx: 26,
    overlay: 40,
    card: 41,
    cardText: 42,
  };

  const CONFETTI_COLORS = [0xFF6B86, 0xFFC43D, 0x69C9F0, 0x67C987, 0xA88CF0, 0xFF8CCB, 0xFFF4C7];


  function progressParts(progress) {
    const total = Math.max(0, Math.min(FINISH_PROGRESS, Math.round(Number(progress) || 0)));
    return {
      lap: Math.min(LAP_COUNT, Math.floor(total / TILE_COUNT) + 1),
      step: total >= FINISH_PROGRESS ? TILE_COUNT : total % TILE_COUNT,
    };
  }

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    return {
      title: { x: WIDTH / 2, y: 66 },
      subtitle: { x: WIDTH / 2, y: 105 },
      reset: { x: 454, y: 66, w: 116, h: 48 },
      board: BOARD,
      panel: { x: 118, y: 228, w: 304, h: 236 },
      turn: { x: WIDTH / 2, y: 252 },
      progress: { x: WIDTH / 2, y: 302 },
      dice: { x: WIDTH / 2, y: 373, size: 78 },
      effect: { x: WIDTH / 2, y: 438, w: 264, h: 48 },
      control: { x: 18, y: 574, w: 504, h: 366 },
      playerCard: { x: 142, y: 682, w: 210, h: 148 },
      aiCard: { x: 398, y: 682, w: 210, h: 148 },
      button: { x: WIDTH / 2, y: 820, w: 264, h: 76 },
      hint: { x: WIDTH / 2, y: 890 },
      hint2: { x: WIDTH / 2, y: 916 },
      result: { x: WIDTH / 2, y: 476, w: 430, h: 390 },
      resultButton: { x: WIDTH / 2, y: 577, w: 224, h: 58 },
    };
  }

  // ---------------------------------------------------------------- 几何与小工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function containsRect(r, x, y) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }
  function drawPill(g, x, y, w, h, fill, stroke, line) {
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    if (stroke != null) {
      g.lineStyle(line || 2, stroke, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    }
  }
  function drawStar(g, x, y, r, color, points, alpha) {
    const n = points || 5;
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rr = i % 2 === 0 ? r : r * 0.45;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }
  function drawLeaf(g, x, y, s, color, rot, alpha) {
    const a = rot || 0;
    const co = Math.cos(a), si = Math.sin(a);
    const p = function (lx, ly) { return [x + lx * co - ly * si, y + lx * si + ly * co]; };
    const a1 = p(0, -s * 0.62), a2 = p(s * 0.52, 0), a3 = p(0, s * 0.62), a4 = p(-s * 0.52, 0);
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    g.moveTo(a1[0], a1[1]);
    g.lineTo(a2[0], a2[1]);
    g.lineTo(a3[0], a3[1]);
    g.lineTo(a4[0], a4[1]);
    g.closePath();
    g.fillPath();
    const q1 = p(0, -s * 0.5), q2 = p(0, s * 0.5);
    g.lineStyle(1.3, 0xFFFFFF, 0.55 * (alpha == null ? 1 : alpha));
    g.lineBetween(q1[0], q1[1], q2[0], q2[1]);
  }

  // ---------------------------------------------------------------- 背景
  function drawWorld(g, clock) {
    const bands = 58;
    const skyEnd = 572;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const col = blendHex(C.skyTop, C.skyBottom, t);
      g.fillStyle(col, 1);
      g.fillRect(0, Math.floor((skyEnd / bands) * i), WIDTH, Math.ceil(skyEnd / bands) + 1);
    }

    // 远处的暖阳与云朵
    g.fillStyle(0xFFE7A3, 0.36);
    g.fillCircle(474, 74, 45);
    g.fillStyle(0xFFE39A, 0.92);
    g.fillCircle(474, 74, 29);
    g.fillStyle(0xFFF4C7, 0.9);
    g.fillCircle(466, 68, 12);
    cloud(g, 92, 150, 1.0);
    cloud(g, 350, 152, 0.76);
    cloud(g, 195, 205, 0.58);

    // 起伏的远山
    g.fillStyle(0xB9DDB1, 1);
    g.beginPath();
    g.moveTo(0, 505);
    g.lineTo(0, 430);
    g.lineTo(68, 365);
    g.lineTo(132, 430);
    g.lineTo(208, 352);
    g.lineTo(286, 438);
    g.lineTo(366, 374);
    g.lineTo(438, 432);
    g.lineTo(510, 366);
    g.lineTo(540, 402);
    g.lineTo(540, 515);
    g.lineTo(0, 515);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x9DCE99, 1);
    g.beginPath();
    g.moveTo(0, 548);
    g.lineTo(0, 480);
    g.lineTo(80, 444);
    g.lineTo(156, 493);
    g.lineTo(236, 451);
    g.lineTo(330, 502);
    g.lineTo(420, 449);
    g.lineTo(500, 493);
    g.lineTo(540, 472);
    g.lineTo(540, 560);
    g.lineTo(0, 560);
    g.closePath();
    g.fillPath();

    // 边缘树木：只露在棋盘两侧，不抢中间棋盘
    tree(g, 22, 468, 1.12, 0x4F9362, 0x346C4A);
    tree(g, 516, 476, 1.2, 0x5A9C68, 0x376E4A);
    tree(g, 68, 218, 0.74, 0x65A66C, 0x3F7A50);
    tree(g, 492, 208, 0.7, 0x5D9A67, 0x3D754D);

    // 草地
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 550, WIDTH, HEIGHT - 550);
    g.fillStyle(0xB9E4A2, 0.62);
    g.fillEllipse(138, 590, 320, 82);
    g.fillEllipse(440, 604, 280, 76);

    // 草地上的小花与叶点（避开底部控制区）
    const flowers = [
      [30, 570, 0xFF8BA5], [74, 546, 0xFFD65C], [493, 560, 0xA88CF0],
      [512, 592, 0xFF8BA5], [46, 596, 0xFFF1B8], [238, 558, 0xFFFFFF],
    ];
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      g.fillStyle(f[2], 0.9);
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5;
        g.fillCircle(f[0] + Math.cos(a) * 5, f[1] + Math.sin(a) * 5, 3.2);
      }
      g.fillStyle(C.gold, 1);
      g.fillCircle(f[0], f[1], 2.1);
    }

    // 彩旗绳
    g.lineStyle(2.2, 0x8D704D, 0.82);
    g.beginPath();
    g.moveTo(42, 130);
    g.lineTo(498, 130);
    g.strokePath();
    const flagCols = [0xFF7C96, 0xFFC947, 0x69C9A4, 0x6FB5EC, 0xA88CF0];
    for (let i = 0; i < 16; i++) {
      const x = 54 + i * 28.4;
      const y = 131 + Math.sin(i * 1.7) * 2;
      g.fillStyle(flagCols[i % flagCols.length], 0.96);
      g.fillTriangle(x - 9, y, x + 9, y, x, y + 18);
      g.lineStyle(1, 0xFFFFFF, 0.34);
      g.lineBetween(x - 7, y + 1.5, x + 7, y + 1.5);
    }

    // 微小的空中光点
    for (let i = 0; i < 9; i++) {
      const a = clock * 0.26 + i * 1.71;
      const x = 62 + ((i * 71 + 19) % 420) + Math.sin(a) * 4;
      const y = 142 + ((i * 53) % 330) + Math.cos(a * 1.3) * 5;
      g.fillStyle(0xFFFFFF, 0.34);
      g.fillCircle(x, y, 1.4 + (i % 3) * 0.55);
    }
  }

  function cloud(g, x, y, s) {
    g.fillStyle(0xFFFFFF, 0.52);
    g.fillEllipse(x, y, 88 * s, 30 * s);
    g.fillCircle(x - 27 * s, y - 2 * s, 18 * s);
    g.fillCircle(x - 5 * s, y - 14 * s, 23 * s);
    g.fillCircle(x + 24 * s, y - 3 * s, 17 * s);
  }

  function tree(g, x, y, s, leaf, dark) {
    g.fillStyle(0x7A5430, 1);
    g.fillRect(x - 5 * s, y - 10 * s, 10 * s, 54 * s);
    g.fillStyle(dark, 0.65);
    g.fillTriangle(x - 34 * s, y + 5 * s, x + 34 * s, y + 5 * s, x, y - 82 * s);
    g.fillStyle(leaf, 1);
    g.fillTriangle(x - 31 * s, y - 6 * s, x + 31 * s, y - 6 * s, x, y - 91 * s);
    g.fillStyle(dark, 0.86);
    g.fillTriangle(x - 26 * s, y - 31 * s, x + 26 * s, y - 31 * s, x, y - 108 * s);
  }

  function blendHex(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
  }

  // ---------------------------------------------------------------- 棋盘
  function specialAt(index) {
    for (let i = 0; i < SPECIALS.length; i++) if (SPECIALS[i].index === index) return SPECIALS[i];
    return null;
  }

  function drawBoard(g) {
    // 棋盘底层：柔和阴影 + 深绿木框
    g.fillStyle(C.shadow, 0.22);
    g.fillRoundedRect(BOARD.x + 4, BOARD.y + 8, BOARD.w, BOARD.h, 32);
    g.fillStyle(C.forestDeep, 1);
    g.fillRoundedRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 32);
    g.fillStyle(0x78B97A, 1);
    g.fillRoundedRect(BOARD.x + 8, BOARD.y + 8, BOARD.w - 16, BOARD.h - 16, 26);
    g.fillStyle(0xBFE3AB, 0.75);
    g.fillRoundedRect(BOARD.x + 13, BOARD.y + 13, BOARD.w - 26, BOARD.h - 26, 22);

    // 棋盘内的小草地纹理
    for (let i = 0; i < 34; i++) {
      const x = 36 + ((i * 97 + 41) % 468);
      const y = 165 + ((i * 61 + 17) % 370);
      g.fillStyle(i % 2 ? 0xFFFFFF : 0x5AA464, i % 2 ? 0.12 : 0.16);
      g.fillCircle(x, y, 1.5 + (i % 3) * 0.55);
    }

    // 连接各格的小脚印
    for (let i = 0; i < PATH.length; i++) {
      const a = PATH[i], b = PATH[(i + 1) % PATH.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len;
      for (let k = 0; k < 2; k++) {
        const t = 0.34 + k * 0.3;
        const x = a.x + dx * t - uy * (k ? 6 : -6);
        const y = a.y + dy * t + ux * (k ? 6 : -6);
        g.fillStyle(0x78B276, 0.4);
        g.fillEllipse(x, y, 5.5, 8.5);
      }
    }

    // 格子
    for (let i = 0; i < PATH.length; i++) {
      const p = PATH[i];
      const sp = specialAt(i);
      const isStart = i === 0;
      const isFinalStop = i === 17;
      let fill = C.tile;
      let edge = C.tileEdge;
      if (sp) {
        fill = sp.kind === 'plus' ? C.plusSoft : sp.kind === 'minus' ? C.minusSoft : C.pauseSoft;
        edge = sp.kind === 'plus' ? C.plus : sp.kind === 'minus' ? C.minus : C.pause;
      }
      if (isStart) { fill = 0xFFF0C9; edge = C.goldDeep; }

      g.fillStyle(C.shadow, 0.16);
      g.fillRoundedRect(p.x - 35 + 2, p.y - 35 + 4, 70, 70, 15);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(p.x - 35, p.y - 35, 70, 70, 15);
      g.lineStyle(sp ? 3 : 2.2, edge, 1);
      g.strokeRoundedRect(p.x - 35, p.y - 35, 70, 70, 15);

      if (isStart) {
        drawCheckeredFlag(g, p.x - 19, p.y - 21, 1.0, 0xFF6B86);
        drawCheckeredFlag(g, p.x + 20, p.y - 19, 0.82, 0x67B9EA);
        g.fillStyle(0xFFF9E6, 0.84);
        g.fillRoundedRect(p.x - 24, p.y + 12, 48, 18, 8);
      } else if (isFinalStop) {
        g.fillStyle(C.gold, 0.18);
        g.fillCircle(p.x, p.y, 23);
      }

      if (!sp && !isStart) {
        const kind = i % 3;
        if (kind === 0) {
          drawLeaf(g, p.x + 17, p.y - 18, 10, C.leaf, -0.55, 0.62);
        } else if (kind === 1) {
          drawStar(g, p.x + 18, p.y - 19, 6, C.gold, 5, 0.56);
        } else {
          g.fillStyle(0x8DC484, 0.52);
          g.fillCircle(p.x + 17, p.y - 17, 3.2);
        }
      }
    }

    // 起点到终点的箭头提示：右下角小脚印方向
    g.fillStyle(0xFFFFFF, 0.55);
    g.fillTriangle(464, 492, 477, 510, 451, 510);
  }

  function drawCheckeredFlag(g, x, y, s, color) {
    g.lineStyle(2.6 * s, 0x6B4A32, 1);
    g.lineBetween(x, y, x, y + 39 * s);
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 24 * s, y + 5 * s);
    g.lineTo(x + 20 * s, y + 15 * s);
    g.lineTo(x + 24 * s, y + 23 * s);
    g.lineTo(x, y + 22 * s);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xFFFFFF, 0.88);
    for (let i = 0; i < 2; i++) {
      g.fillRect(x + 6 * s + i * 10 * s, y + 7 * s, 4.5 * s, 4.5 * s);
      g.fillRect(x + 2 * s + i * 10 * s, y + 15 * s, 4.5 * s, 4.5 * s);
    }
  }

  function drawCenterPanel(g) {
    const r = { x: 118, y: 228, w: 304, h: 236 };
    g.fillStyle(C.shadow, 0.18);
    g.fillRoundedRect(r.x + 3, r.y + 6, r.w, r.h, 24);
    g.fillStyle(0xFFF8E8, 0.98);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 24);
    g.lineStyle(2.5, 0xDDBE83, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 24);
    g.lineStyle(1.4, 0xFFFFFF, 0.9);
    g.strokeRoundedRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 19);
    // 小角落装饰
    for (let i = 0; i < 4; i++) {
      const x = i < 2 ? r.x + 16 : r.x + r.w - 16;
      const y = i % 2 ? r.y + r.h - 16 : r.y + 16;
      g.fillStyle(C.gold, 0.34);
      g.fillCircle(x, y, 3);
    }
  }

  // ---------------------------------------------------------------- 角色
  function drawCharacter(g, actor, x, y, scale, active, clock) {
    const s = scale || 1;
    const player = actor === 'player';
    const bounce = active ? Math.sin((clock || 0) * 4.6) * 1.2 * s : 0;
    const baseY = y + bounce;

    if (active) {
      g.fillStyle(C.gold, 0.17);
      g.fillEllipse(x, baseY + 2 * s, 56 * s, 20 * s);
      for (let i = 0; i < 8; i++) {
        const a = (clock || 0) * 1.8 + i * TAU / 8;
        g.fillStyle(i % 2 ? C.gold : 0xFFFFFF, 0.9);
        g.fillCircle(x + Math.cos(a) * 25 * s, baseY + 2 * s + Math.sin(a) * 8 * s, 2.2 * s);
      }
    }

    g.fillStyle(C.shadow, 0.24);
    g.fillEllipse(x, baseY + 4 * s, 38 * s, 12 * s);

    if (player) {
      // 小蓝熊：脚、身体、手、圆耳朵
      g.fillStyle(C.playerDeep, 1);
      g.fillEllipse(x - 8 * s, baseY - 4 * s, 13 * s, 10 * s);
      g.fillEllipse(x + 8 * s, baseY - 4 * s, 13 * s, 10 * s);
      g.fillStyle(C.player, 1);
      g.fillEllipse(x, baseY - 23 * s, 34 * s, 42 * s);
      g.fillStyle(C.playerSoft, 0.75);
      g.fillEllipse(x, baseY - 23 * s, 20 * s, 26 * s);
      g.fillStyle(C.playerDeep, 1);
      g.fillCircle(x - 17 * s, baseY - 44 * s, 7.5 * s);
      g.fillCircle(x + 17 * s, baseY - 44 * s, 7.5 * s);
      g.fillStyle(0xD7B191, 1);
      g.fillCircle(x - 17 * s, baseY - 44 * s, 4 * s);
      g.fillCircle(x + 17 * s, baseY - 44 * s, 4 * s);
      g.fillStyle(C.player, 1);
      g.fillCircle(x, baseY - 42 * s, 19 * s);
      g.fillStyle(0xBFDDFA, 1);
      g.fillEllipse(x, baseY - 37 * s, 25 * s, 15 * s);
      g.fillStyle(0xD7B191, 1);
      g.fillEllipse(x, baseY - 36 * s, 14 * s, 10 * s);
      g.fillStyle(C.ink, 1);
      g.fillCircle(x - 6.5 * s, baseY - 45 * s, 2.4 * s);
      g.fillCircle(x + 6.5 * s, baseY - 45 * s, 2.4 * s);
      g.fillStyle(0x3D2C26, 1);
      g.fillEllipse(x, baseY - 37 * s, 6 * s, 4.4 * s);
      g.lineStyle(1.5 * s, 0x6F8E75, 1);
      g.lineBetween(x, baseY - 35 * s, x, baseY - 32 * s);
      g.lineBetween(x, baseY - 32 * s, x - 3 * s, baseY - 30 * s);
      g.lineBetween(x, baseY - 32 * s, x + 3 * s, baseY - 30 * s);
      g.fillStyle(0xF495A5, 0.5);
      g.fillCircle(x - 12 * s, baseY - 38 * s, 2.7 * s);
      g.fillCircle(x + 12 * s, baseY - 38 * s, 2.7 * s);
      // 小围巾
      g.fillStyle(0xF46D82, 1);
      g.fillRoundedRect(x - 13 * s, baseY - 27 * s, 26 * s, 6 * s, 3 * s);
      g.fillTriangle(x + 8 * s, baseY - 25 * s, x + 17 * s, baseY - 17 * s, x + 10 * s, baseY - 13 * s);
    } else {
      // 小狐狸：先尾巴，再身体和尖耳朵
      g.fillStyle(0xE9783A, 1);
      g.fillEllipse(x + 20 * s, baseY - 20 * s, 28 * s, 15 * s);
      g.fillStyle(0xFFF0D5, 1);
      g.fillCircle(x + 31 * s, baseY - 24 * s, 6 * s);
      g.fillStyle(C.foxDeep, 1);
      g.fillEllipse(x - 8 * s, baseY - 4 * s, 12 * s, 9 * s);
      g.fillEllipse(x + 8 * s, baseY - 4 * s, 12 * s, 9 * s);
      g.fillStyle(C.fox, 1);
      g.fillEllipse(x, baseY - 21 * s, 31 * s, 38 * s);
      g.fillStyle(0xFFE9C9, 1);
      g.fillEllipse(x + 1 * s, baseY - 23 * s, 18 * s, 26 * s);
      // 尖耳
      g.fillStyle(C.foxDeep, 1);
      g.fillTriangle(x - 19 * s, baseY - 49 * s, x - 5 * s, baseY - 62 * s, x - 3 * s, baseY - 43 * s);
      g.fillTriangle(x + 19 * s, baseY - 49 * s, x + 5 * s, baseY - 62 * s, x + 3 * s, baseY - 43 * s);
      g.fillStyle(C.fox, 1);
      g.fillTriangle(x - 15 * s, baseY - 48 * s, x - 6 * s, baseY - 57 * s, x - 4 * s, baseY - 44 * s);
      g.fillTriangle(x + 15 * s, baseY - 48 * s, x + 6 * s, baseY - 57 * s, x + 4 * s, baseY - 44 * s);
      g.fillStyle(C.fox, 1);
      g.fillCircle(x, baseY - 40 * s, 18 * s);
      g.fillStyle(0xFFE3BF, 1);
      g.fillEllipse(x, baseY - 34 * s, 24 * s, 15 * s);
      g.fillStyle(C.ink, 1);
      g.fillCircle(x - 6 * s, baseY - 43 * s, 2.3 * s);
      g.fillCircle(x + 6 * s, baseY - 43 * s, 2.3 * s);
      g.fillStyle(0x33231D, 1);
      g.fillEllipse(x, baseY - 35 * s, 5.5 * s, 4 * s);
      g.lineStyle(1.4 * s, 0x6F8E75, 1);
      g.lineBetween(x, baseY - 33 * s, x - 2.5 * s, baseY - 30 * s);
      g.lineBetween(x, baseY - 33 * s, x + 2.5 * s, baseY - 30 * s);
      // 小背心
      g.fillStyle(0x56A68D, 1);
      g.fillRoundedRect(x - 13 * s, baseY - 26 * s, 26 * s, 15 * s, 5 * s);
      g.fillStyle(0xFFFFFF, 0.55);
      g.fillCircle(x - 4 * s, baseY - 19 * s, 1.6 * s);
      g.fillCircle(x + 4 * s, baseY - 19 * s, 1.6 * s);
    }
  }

  function drawDice(g, value, size) {
    const v = clamp(Math.round(value || 1), 1, 6);
    const s = size || 78;
    g.fillStyle(C.shadow, 0.18);
    g.fillRoundedRect(-s / 2 + 4, -s / 2 + 6, s, s, 17);
    g.fillStyle(0xFFFDF7, 1);
    g.fillRoundedRect(-s / 2, -s / 2, s, s, 17);
    g.lineStyle(3.2, C.goldDeep, 1);
    g.strokeRoundedRect(-s / 2, -s / 2, s, s, 17);
    g.lineStyle(1.2, 0xFFFFFF, 0.9);
    g.strokeRoundedRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10, 13);
    const r = s * 0.082;
    const d = s * 0.235;
    const patterns = {
      1: [[0, 0]],
      2: [[-d, -d], [d, d]],
      3: [[-d, -d], [0, 0], [d, d]],
      4: [[-d, -d], [d, -d], [-d, d], [d, d]],
      5: [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]],
      6: [[-d, -d], [d, -d], [-d, 0], [d, 0], [-d, d], [d, d]],
    };
    const pts = patterns[v] || patterns[1];
    g.fillStyle(0x4D3A2C, 1);
    for (let i = 0; i < pts.length; i++) g.fillCircle(pts[i][0], pts[i][1], r);
  }

  // ---------------------------------------------------------------- 结算卡
  function drawResultCard(g) {
    g.clear();
    g.fillStyle(0x2A241D, 0.55);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    const r = { x: 55, y: 281, w: 430, h: 390 };
    g.fillStyle(C.shadow, 0.32);
    g.fillRoundedRect(r.x + 6, r.y + 10, r.w, r.h, 34);
    g.fillStyle(0xFFFDF6, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 34);
    g.lineStyle(4, C.gold, 1);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 34);
    g.lineStyle(1.5, 0xFFFFFF, 0.95);
    g.strokeRoundedRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16, 27);
    // 顶部小旗
    g.fillStyle(0xFFE8B1, 1);
    g.fillRoundedRect(WIDTH / 2 - 92, r.y - 18, 184, 40, 18);
    g.lineStyle(2, C.goldDeep, 1);
    g.strokeRoundedRect(WIDTH / 2 - 92, r.y - 18, 184, 40, 18);
    drawStar(g, WIDTH / 2 - 66, r.y + 2, 9, C.gold, 5, 1);
    drawStar(g, WIDTH / 2 + 66, r.y + 2, 9, C.gold, 5, 1);
    // 按钮
    const b = { x: WIDTH / 2, y: 577, w: 224, h: 58 };
    g.fillStyle(C.goldDeep, 0.3);
    g.fillRoundedRect(b.x - b.w / 2 + 2, b.y - b.h / 2 + 4, b.w, b.h, 29);
    g.fillStyle(0x5A9FCB, 1);
    g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 29);
    g.lineStyle(2.5, 0xFFFFFF, 0.65);
    g.strokeRoundedRect(b.x - b.w / 2 + 3, b.y - b.h / 2 + 3, b.w - 6, b.h - 6, 25);
  }
  function drawControlBase(g) {
    const p = { x: 18, y: 574, w: 504, h: 366 };
    g.fillStyle(C.shadow, 0.2);
    g.fillRoundedRect(p.x + 3, p.y + 7, p.w, p.h, 34);
    g.fillStyle(0xFFF6DF, 1);
    g.fillRoundedRect(p.x, p.y, p.w, p.h, 34);
    g.lineStyle(3, 0xE1C58C, 1);
    g.strokeRoundedRect(p.x, p.y, p.w, p.h, 34);
    g.fillStyle(0xF5E4BD, 1);
    g.fillRoundedRect(p.x + 10, p.y + 10, p.w - 20, 47, 22);
    g.lineStyle(1.5, 0xFFFFFF, 0.72);
    g.strokeRoundedRect(p.x + 15, p.y + 14, p.w - 30, 39, 18);
    // 野餐格子布纹
    for (let i = 0; i < 26; i++) {
      const x = p.x + 13 + i * 19.5;
      g.fillStyle(i % 2 ? 0xFF9CAE : 0xFFFFFF, 0.07);
      g.fillRect(x, p.y + 64, 10, 86);
    }
    for (let i = 0; i < 4; i++) {
      const x = p.x + 32 + i * 46;
      g.fillStyle(C.leaf, 0.18);
      g.fillCircle(x, p.y + 32, 2.1);
    }
    // 两边的小彩旗
    g.lineStyle(2, 0xA98251, 0.65);
    g.lineBetween(34, 586, 90, 586);
    g.fillStyle(0xFF7C96, 1);
    g.fillTriangle(42, 587, 54, 587, 48, 597);
    g.fillStyle(0xFFC947, 1);
    g.fillTriangle(62, 587, 74, 587, 68, 597);
    g.lineBetween(450, 586, 506, 586);
    g.fillStyle(0x69C9A4, 1);
    g.fillTriangle(458, 587, 470, 587, 464, 597);
    g.fillStyle(0x6FB5EC, 1);
    g.fillTriangle(478, 587, 490, 587, 484, 597);
    // 角色卡底
    drawCardBase(g, { x: 142, y: 682, w: 210, h: 148 }, C.playerSoft, C.player);
    drawCardBase(g, { x: 398, y: 682, w: 210, h: 148 }, C.foxSoft, C.fox);
    // 按钮底影和按钮底
    g.fillStyle(C.goldDeep, 0.24);
    g.fillRoundedRect(146, 788, 264, 76, 38);
    g.fillStyle(0x4D8FBE, 1);
    g.fillRoundedRect(138, 782, 264, 76, 38);
    g.lineStyle(3, 0xFFFFFF, 0.45);
    g.strokeRoundedRect(143, 787, 254, 66, 33);
  }

  function drawCardBase(g, r, tint, edge) {
    g.fillStyle(0xFFFFFF, 0.55);
    g.fillRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 5, r.w, r.h, 22);
    g.fillStyle(tint, 0.8);
    g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 22);
    g.lineStyle(2, edge, 0.64);
    g.strokeRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 22);
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
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.014);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }
    function sweep(from, to, dur, vol, type, delay) {
      const c = ensure();
      if (!c) return;
      try {
        const t0 = c.currentTime + (delay || 0);
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(from, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }
    function rattle(dur, vol, delay) {
      const c = ensure();
      if (!c) return;
      try {
        const t0 = c.currentTime + (delay || 0);
        const len = Math.max(1, Math.floor(c.sampleRate * dur));
        const buf = c.createBuffer(1, len, c.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource();
        src.buffer = buf;
        const filt = c.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 900;
        filt.Q.value = 0.8;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filt); filt.connect(g); g.connect(master);
        src.start(t0); src.stop(t0 + dur + 0.04);
      } catch (e) { /* ignore */ }
    }
    return {
      resume: resume,
      click: function () { tone(620, 0.07, 0.03, 0, 'triangle'); },
      roll: function () {
        rattle(0.12, 0.026, 0);
        rattle(0.09, 0.02, 0.19);
        rattle(0.07, 0.018, 0.37);
        sweep(260, 620, 0.32, 0.018, 'triangle', 0.02);
      },
      hop: function () { tone(460, 0.055, 0.025, 0, 'triangle'); tone(650, 0.05, 0.016, 0.025, 'sine'); },
      plus: function () { tone(523.25, 0.14, 0.038, 0, 'triangle'); tone(659.25, 0.16, 0.033, 0.09, 'triangle'); },
      minus: function () { tone(440, 0.13, 0.032, 0, 'sine'); tone(349.25, 0.17, 0.026, 0.08, 'sine'); },
      sleep: function () { tone(392, 0.26, 0.024, 0, 'sine'); tone(329.63, 0.31, 0.018, 0.18, 'sine'); },
      turn: function () { tone(587.33, 0.09, 0.017, 0, 'sine'); },
      win: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        for (let i = 0; i < notes.length; i++) {
          tone(notes[i], 0.64, 0.035, i * 0.075, 'triangle');
          tone(notes[i] * 2, 0.28, 0.009, i * 0.075, 'sine');
        }
      },
      softEnd: function () {
        tone(392, 0.32, 0.023, 0, 'sine');
        tone(329.63, 0.4, 0.02, 0.13, 'sine');
        tone(261.63, 0.5, 0.014, 0.27, 'sine');
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class MonopolyScene extends Phaser.Scene {
    constructor() {
      super('MonopolyScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT,
        COLS: COLS, ROWS: ROWS, TILE_COUNT: TILE_COUNT, LAP_COUNT: LAP_COUNT, FINISH_PROGRESS: FINISH_PROGRESS,
        DIE_MIN: DIE_MIN, DIE_MAX: DIE_MAX,
        SPECIALS: SPECIALS.map(function (s) { return Object.assign({}, s); }),
        PATH: PATH.map(function (p) { return { index: p.index, col: p.col, row: p.row, x: p.x, y: p.y }; }),
        STEP_SEC: STEP_SEC, ROLL_SEC: ROLL_SEC, AI_DELAY: AI_DELAY,
        EFFECT_SEC: EFFECT_SEC, CARD_LOCK_SEC: CARD_LOCK_SEC,
      };
      this.specials = this.CONST.SPECIALS;
      this.phase = 'idle';
      this.turn = 'player';
      this.dice = 1;
      this.positions = { player: 0, ai: 0 };
      this.skip = { player: 0, ai: 0 };
      this.winner = null;
      this.liveProps = [];
      this.clock = 0;
      this.rollT = 0;
      this.rollTarget = 1;
      this.rollTick = 0;
      this.move = null;
      this.effect = null;
      this.aiWait = 0;
      this.overT = 0;
      this.diceAngle = 0;

      // -------------------------------------------------- 静态画面
      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawWorld(this.worldG, 0);

      this.boardG = this.add.graphics().setDepth(DEPTH.board);
      drawBoard(this.boardG);

      this.centerPanelG = this.add.graphics().setDepth(DEPTH.panel);
      drawCenterPanel(this.centerPanelG);

      this.titleText = this.add.text(this.L.title.x, this.L.title.y, '森林大富翁', {
        fontFamily: FONT, fontSize: '33px', fontStyle: 'bold', color: '#3E684D',
        stroke: '#FFF7D6', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.subtitleText = this.add.text(this.L.subtitle.x, this.L.subtitle.y, '绕森林两圈 · 回到彩旗终点', {
        fontFamily: FONT, fontSize: '15px', color: '#77715C',
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.resetG = this.add.graphics().setDepth(DEPTH.ui);
      drawPill(this.resetG, this.L.reset.x, this.L.reset.y, this.L.reset.w, this.L.reset.h, 0xFFF6DE, C.goldDeep, 2.5);
      this.resetText = this.add.text(this.L.reset.x, this.L.reset.y, '重新开始', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#76512B',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.buildSpecialLabels();

      // -------------------------------------------------- 动态层
      this.tokensG = this.add.graphics().setDepth(DEPTH.tokens);
      this.diceG = this.add.graphics().setDepth(DEPTH.panel + 2).setPosition(this.L.dice.x, this.L.dice.y);
      this.uiG = this.add.graphics().setDepth(DEPTH.ui + 1);
      this.effectG = this.add.graphics().setDepth(DEPTH.effect);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.controlBgG = this.add.graphics().setDepth(DEPTH.control);
      drawControlBase(this.controlBgG);
      this.controlG = this.add.graphics().setDepth(DEPTH.control + 1);

      this.turnText = this.add.text(this.L.turn.x, this.L.turn.y, '轮到小蓝熊', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#4A3A2E',
      }).setOrigin(0.5).setDepth(DEPTH.panel + 5);

      this.progressText = this.add.text(this.L.progress.x, this.L.progress.y, '小蓝熊 第1圈 0/18   ·   小狐狸 第1圈 0/18', {
        fontFamily: FONT, fontSize: '12.5px', color: '#816C54',
      }).setOrigin(0.5).setDepth(DEPTH.panel + 5);

      this.effectText = this.add.text(this.L.effect.x, this.L.effect.y, '', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#5A3E2B',
      }).setOrigin(0.5).setDepth(DEPTH.effect + 1);

      this.playerNameText = this.add.text(this.L.playerCard.x, 627, '小蓝熊（你）', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#2F5D92',
      }).setOrigin(0.5).setDepth(DEPTH.control + 2);
      this.aiNameText = this.add.text(this.L.aiCard.x, 627, '小狐狸', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#8A4B24',
      }).setOrigin(0.5).setDepth(DEPTH.control + 2);
      this.playerProgressText = this.add.text(this.L.playerCard.x, 744, '第 0 格', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#4D6E93',
      }).setOrigin(0.5).setDepth(DEPTH.control + 2);
      this.aiProgressText = this.add.text(this.L.aiCard.x, 744, '第 0 格', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#8B6548',
      }).setOrigin(0.5).setDepth(DEPTH.control + 2);

      this.rollText = this.add.text(this.L.button.x, this.L.button.y, '摇骰子', {
        fontFamily: FONT, fontSize: '27px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#3C7599', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.control + 3);

      this.hintText = this.add.text(this.L.hint.x, this.L.hint.y, '轮流摇骰子，先绕森林两圈回彩旗就赢啦', {
        fontFamily: FONT, fontSize: '14px', color: '#876A4D',
      }).setOrigin(0.5).setDepth(DEPTH.control + 2);
      this.hint2Text = this.add.text(this.L.hint2.x, this.L.hint2.y, '踩到 +1、-1 或暂停格，会有小惊喜', {
        fontFamily: FONT, fontSize: '12px', color: '#9B846B',
      }).setOrigin(0.5).setDepth(DEPTH.control + 2);

      // 起点小字
      const start = PATH[0];
      this.add.text(start.x, start.y + 22, '起点', {
        fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#8B5E2A',
      }).setOrigin(0.5).setDepth(DEPTH.decorations);

      // -------------------------------------------------- 结算卡
      this.resultG = this.add.graphics().setDepth(DEPTH.card);
      this.resultAvatarG = this.add.graphics().setDepth(DEPTH.cardText - 1);
      this.resultTitle = this.add.text(WIDTH / 2, 327, '', {
        fontFamily: FONT, fontSize: '29px', fontStyle: 'bold', color: '#4D3928',
      }).setOrigin(0.5).setDepth(DEPTH.cardText);
      this.resultSub = this.add.text(WIDTH / 2, 506, '', {
        fontFamily: FONT, fontSize: '17px', color: '#725B45',
      }).setOrigin(0.5).setDepth(DEPTH.cardText);
      this.resultButtonText = this.add.text(this.L.resultButton.x, this.L.resultButton.y, '再来一局', {
        fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.cardText);
      this.resultTip = this.add.text(WIDTH / 2, 632, '点屏幕也可以再来一局', {
        fontFamily: FONT, fontSize: '13px', color: '#9A8268',
      }).setOrigin(0.5).setDepth(DEPTH.cardText);
      this.setResultVisible(false);

      // -------------------------------------------------- 输入
      this.input.on('pointerdown', function (p) { this.onPointerDown(p); }, this);

      this.resetGame(true);
    }

    buildSpecialLabels() {
      this.specialTexts = [];
      for (let i = 0; i < SPECIALS.length; i++) {
        const sp = SPECIALS[i];
        const p = PATH[sp.index];
        if (sp.kind === 'pause') {
          const t1 = this.add.text(p.x, p.y - 7, '暂停', {
            fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#5F448F',
          }).setOrigin(0.5).setDepth(DEPTH.decorations + 1);
          const t2 = this.add.text(p.x, p.y + 17, '一回合', {
            fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#7658A9',
          }).setOrigin(0.5).setDepth(DEPTH.decorations + 1);
          this.specialTexts.push(t1, t2);
        } else {
          const col = sp.kind === 'plus' ? '#2F7F55' : '#A44949';
          const arrow = sp.kind === 'plus' ? '↑ ' : '↓ ';
          const t1 = this.add.text(p.x, p.y - 10, arrow + sp.label, {
            fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: col,
          }).setOrigin(0.5).setDepth(DEPTH.decorations + 1);
          const t2 = this.add.text(p.x, p.y + 16, sp.sub, {
            fontFamily: FONT, fontSize: '9.5px', fontStyle: 'bold', color: col,
          }).setOrigin(0.5).setDepth(DEPTH.decorations + 1);
          this.specialTexts.push(t1, t2);
        }
      }
    }

    // -------------------------------------------------- 测试钩子（非公共 API）
    tileCenter(index) {
      const n = Number(index);
      const i = ((Math.round(isFinite(n) ? n : 0) % TILE_COUNT) + TILE_COUNT) % TILE_COUNT;
      return { x: PATH[i].x, y: PATH[i].y, index: i };
    }

    progressCenter(progress) {
      const p = clamp(progress, 0, FINISH_PROGRESS);
      return this.tileCenter(p);
    }
    // -------------------------------------------------- 输入与重置
    onPointerDown(p) {
      Sound.resume();
      if (this.phase === 'over') {
        if (this.overT >= CARD_LOCK_SEC) this.resetGame();
        return;
      }
      if (containsRect(this.L.reset, p.x, p.y)) {
        this.resetGame();
        return;
      }
      if (this.phase === 'idle' && this.turn === 'player' && containsRect(this.L.button, p.x, p.y)) {
        this.rollDice();
      }
    }

    resetGame(quiet) {
      this.phase = 'idle';
      this.turn = 'player';
      this.dice = 1;
      this.positions = { player: 0, ai: 0 };
      this.skip = { player: 0, ai: 0 };
      this.winner = null;
      this.liveProps.length = 0;
      this.rollT = 0;
      this.rollTarget = 1;
      this.rollTick = 0;
      this.move = null;
      this.effect = null;
      this.aiWait = 0;
      this.overT = 0;
      this.diceAngle = 0;
      if (this.fxG) this.fxG.clear();
      if (this.resultAvatarG) this.resultAvatarG.clear();
      this.setResultVisible(false);
      this.beginTurn('player', true);
      if (!quiet) Sound.click();
      this.render();
    }

    // -------------------------------------------------- 回合与移动
    beginTurn(actor, silent) {
      if (this.winner || this.phase === 'over') return;
      this.turn = actor === 'ai' ? 'ai' : 'player';
      this.phase = 'idle';
      this.move = null;
      this.effect = null;
      this.aiWait = 0;
      this.diceAngle = 0;

      if (this.skip[this.turn] > 0) {
        this.skip[this.turn] -= 1;
        const who = this.turn === 'player' ? '小蓝熊' : '小狐狸';
        this.phase = 'effect';
        this.effect = {
          kind: 'pause', actor: this.turn, text: who + '休息一下，这回合跳过',
          t: 0, dur: 0.95, action: 'finish',
        };
        Sound.sleep();
        return;
      }

      if (this.turn === 'ai') this.aiWait = AI_DELAY;
      if (!silent) Sound.turn();
    }

    rollDice(forcedValue) {
      if (this.winner || this.phase !== 'idle') return null;
      let value;
      if (forcedValue != null && isFinite(Number(forcedValue))) {
        value = clamp(Math.round(Number(forcedValue)), DIE_MIN, DIE_MAX);
      } else {
        value = DIE_MIN + Math.floor(Math.random() * (DIE_MAX - DIE_MIN + 1));
      }
      this.phase = 'rolling';
      this.rollT = 0;
      this.rollTarget = value;
      this.rollTick = 0;
      this.effect = null;
      this.aiWait = 0;
      Sound.roll();
      return value;
    }

    startMove(actor, target, mode) {
      if (this.winner) return false;
      if (actor !== 'player' && actor !== 'ai') return false;
      const from = this.positions[actor];
      const to = clamp(Math.round(target), 0, FINISH_PROGRESS);
      if (to === from) {
        this.phase = 'effect';
        this.effect = {
          kind: 'plus', actor: actor,
          text: actor === 'player' ? '已经在起点啦' : '小狐狸停了一下',
          t: 0, dur: PLAIN_SEC, action: 'finish',
        };
        return false;
      }
      const hops = [];
      if (to > from) {
        for (let p = from + 1; p <= to; p++) hops.push(p);
      } else {
        for (let p = from - 1; p >= to; p--) hops.push(p);
      }
      this.phase = 'moving';
      this.effect = null;
      this.move = {
        actor: actor,
        fromProgress: from,
        toProgress: hops[0],
        hops: hops,
        i: 0,
        t: 0,
        mode: mode || 'main',
        startProgress: from,
      };
      return true;
    }

    stepMove(dt) {
      const m = this.move;
      if (!m) return;
      m.t += dt / STEP_SEC;
      if (m.t < 1) return;
      this.positions[m.actor] = m.hops[m.i];
      Sound.hop();
      m.i += 1;
      if (m.i < m.hops.length) {
        m.fromProgress = this.positions[m.actor];
        m.toProgress = m.hops[m.i];
        m.t = 0;
        return;
      }
      this.move = null;
      this.onMoveDone(m);
    }

    onMoveDone(m) {
      const actor = m.actor;
      if (this.positions[actor] >= FINISH_PROGRESS) {
        this.endGame(actor);
        return;
      }
      const crossedLap = m.startProgress < TILE_COUNT && this.positions[actor] >= TILE_COUNT;
      if (m.mode === 'main') {
        this.applyLanding(actor, this.positions[actor], crossedLap);
        return;
      }
      this.phase = 'effect';
      this.effect = {
        kind: 'plain', actor: actor,
        text: crossedLap ? (actor === 'player' ? '小蓝熊冲过起点，进入第2圈！' : '小狐狸冲过起点，进入第2圈！') : '',
        t: 0, dur: crossedLap ? 0.68 : PLAIN_SEC, action: 'finish',
      };
    }

    applyLanding(actor, tileIndex, crossedLap) {
      if (this.winner) return 'over';
      if (actor !== 'player' && actor !== 'ai') return 'invalid';
      const index = Math.round(Number(tileIndex));
      if (!isFinite(index) || index >= FINISH_PROGRESS) {
        this.endGame(actor);
        return 'win';
      }
      const at = ((index % TILE_COUNT) + TILE_COUNT) % TILE_COUNT;
      const sp = specialAt(at);
      const who = actor === 'player' ? '小蓝熊' : '小狐狸';
      this.phase = 'effect';
      if (!sp) {
        this.effect = {
          kind: 'plain', actor: actor,
          text: crossedLap ? who + '冲过起点，进入第2圈！' : '走到第 ' + at + ' 格啦',
          t: 0, dur: crossedLap ? 0.68 : PLAIN_SEC, action: 'finish',
        };
        return 'plain';
      }
      if (sp.kind === 'pause') {
        this.skip[actor] = 1;
        this.effect = {
          kind: 'pause', actor: actor, text: who + '踩到暂停，下一回合休息',
          t: 0, dur: 0.95, action: 'finish',
        };
        Sound.sleep();
        return 'pause';
      }
      this.effect = {
        kind: sp.kind,
        actor: actor,
        delta: sp.delta,
        text: who + '踩到 ' + sp.label + '，' + (sp.delta > 0 ? '向前跳！' : '往后退一格'),
        t: 0,
        dur: 0.7,
        action: 'special',
      };
      if (sp.kind === 'plus') Sound.plus(); else Sound.minus();
      return sp.kind;
    }

    effectDone() {
      const e = this.effect;
      if (!e) return;
      this.effect = null;
      if (e.action === 'special') {
        this.startMove(e.actor, this.positions[e.actor] + e.delta, 'special');
        return;
      }
      this.finishTurn();
    }

    finishTurn() {
      if (this.winner || this.phase === 'over') return;
      const next = this.turn === 'player' ? 'ai' : 'player';
      this.beginTurn(next, false);
    }

    endGame(actor) {
      if (this.winner) return;
      this.winner = actor === 'player' ? 'player' : 'ai';
      this.phase = 'over';
      this.overT = 0;
      this.move = null;
      this.effect = null;
      this.aiWait = 0;
      this.diceAngle = 0;
      this.layoutResult(this.winner);
      this.setResultVisible(true);
      if (this.winner === 'player') {
        this.spawnConfetti(84);
        Sound.win();
      } else {
        this.spawnLeaves(28);
        Sound.softEnd();
      }
    }

    layoutResult(actor) {
      const player = actor === 'player';
      this.resultTitle.setText(player ? '小蓝熊赢啦！' : '小狐狸先到啦！');
      this.resultTitle.setColor(player ? '#4D3928' : '#5A4A3B');
      this.resultSub.setText(player ? '绕森林两圈，回到了彩旗终点！' : '这次差一点点，再来一次吧～');
      this.resultAvatarG.clear();
      drawCharacter(this.resultAvatarG, player ? 'player' : 'ai', WIDTH / 2, 456, 1.48, false, 0);
      if (player) {
        drawCrown(this.resultAvatarG, WIDTH / 2, 353, 1.0);
      } else {
        drawLeaf(this.resultAvatarG, 196, 397, 18, 0x7DBB6C, -0.55, 0.95);
        drawLeaf(this.resultAvatarG, 344, 390, 15, 0xA9CF79, 0.7, 0.9);
        drawLeaf(this.resultAvatarG, 210, 438, 12, 0xF0C453, -1.1, 0.8);
      }
      drawResultCard(this.resultG);
    }

    setResultVisible(v) {
      if (this.resultG) this.resultG.setVisible(v);
      if (this.resultAvatarG) this.resultAvatarG.setVisible(v);
      if (this.resultTitle) this.resultTitle.setVisible(v);
      if (this.resultSub) this.resultSub.setVisible(v);
      if (this.resultButtonText) this.resultButtonText.setVisible(v);
      if (this.resultTip) this.resultTip.setVisible(v);
    }

    // -------------------------------------------------- 特效
    spawnConfetti(count) {
      const colors = CONFETTI_COLORS;
      const n = count || 60;
      for (let i = 0; i < n; i++) {
        const fromTop = i % 4 === 0;
        this.liveProps.push({
          kind: 'confetti',
          x: 30 + Math.random() * (WIDTH - 60),
          y: fromTop ? -20 - Math.random() * 120 : 290 + Math.random() * 120,
          vx: (Math.random() * 2 - 1) * 155,
          vy: fromTop ? 25 + Math.random() * 75 : -150 + Math.random() * 180,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 8,
          size: 5 + Math.random() * 7,
          sway: Math.random() * TAU,
          color: colors[i % colors.length],
          life: 2.2 + Math.random() * 1.4,
          maxLife: 3.6,
          gravity: 280,
        });
      }
    }

    spawnLeaves(count) {
      const n = count || 20;
      for (let i = 0; i < n; i++) {
        this.liveProps.push({
          kind: 'leaf',
          x: 90 + Math.random() * 360,
          y: 300 + Math.random() * 130,
          vx: (Math.random() * 2 - 1) * 45,
          vy: -42 + Math.random() * 50,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 2.2,
          size: 8 + Math.random() * 8,
          sway: Math.random() * TAU,
          color: i % 3 === 0 ? 0xF0C453 : i % 3 === 1 ? 0x7DBB6C : 0xA9CF79,
          life: 2.8 + Math.random() * 1.6,
          maxLife: 4.4,
          gravity: 110,
        });
      }
    }

    updateFx(dt) {
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const p = this.liveProps[i];
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.sway += dt * (p.kind === 'leaf' ? 2.1 : 4.2);
        p.x += (p.vx + Math.sin(p.sway) * (p.kind === 'leaf' ? 25 : 9)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.life <= 0 || p.y > HEIGHT + 50) this.liveProps.splice(i, 1);
      }
    }

    renderFx() {
      this.fxG.clear();
      for (let i = 0; i < this.liveProps.length; i++) {
        const p = this.liveProps[i];
        const a = clamp(p.life / Math.min(0.6, p.maxLife), 0, 1);
        if (p.kind === 'leaf') {
          drawLeaf(this.fxG, p.x, p.y, p.size, p.color, p.rot, a);
        } else {
          const co = Math.cos(p.rot), si = Math.sin(p.rot);
          const h = p.size / 2;
          this.fxG.fillStyle(p.color, a);
          this.fxG.beginPath();
          this.fxG.moveTo(p.x + co * -h - si * -h * 0.5, p.y + si * -h + co * -h * 0.5);
          this.fxG.lineTo(p.x + co * h - si * -h * 0.5, p.y + si * h + co * -h * 0.5);
          this.fxG.lineTo(p.x + co * h - si * h * 0.5, p.y + si * h + co * h * 0.5);
          this.fxG.lineTo(p.x + co * -h - si * h * 0.5, p.y + si * -h + co * h * 0.5);
          this.fxG.closePath();
          this.fxG.fillPath();
        }
      }
    }

    // -------------------------------------------------- 每帧推进
    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.1);
      this.clock += dt;
      this.updateFx(dt);

      if (this.phase === 'over') {
        this.overT += dt;
        return;
      }

      if (this.phase === 'rolling') {
        this.rollT += dt;
        this.rollTick += dt;
        if (this.rollTick >= 0.065) {
          this.rollTick = 0;
          this.dice = DIE_MIN + Math.floor(Math.random() * (DIE_MAX - DIE_MIN + 1));
          this.diceAngle = (Math.random() * 2 - 1) * 0.16;
        }
        if (this.rollT >= ROLL_SEC) {
          this.dice = this.rollTarget;
          this.diceAngle = 0;
          this.startMove(this.turn, Math.min(FINISH_PROGRESS, this.positions[this.turn] + this.rollTarget), 'main');
        }
        return;
      }

      if (this.phase === 'moving') {
        this.stepMove(dt);
        return;
      }

      if (this.phase === 'effect') {
        if (!this.effect) {
          this.phase = 'idle';
          return;
        }
        this.effect.t += dt;
        if (this.effect.t >= this.effect.dur) this.effectDone();
        return;
      }

      if (this.phase === 'idle' && this.turn === 'ai') {
        this.aiWait -= dt;
        if (this.aiWait <= 0) {
          this.aiWait = 0;
          this.rollDice();
        }
      }
    }

    simulate(seconds) {
      let left = Math.max(0, Number(seconds) || 0);
      while (left > 0.000001) {
        const dt = Math.min(1 / 60, left);
        this.step(dt);
        this.render();
        left -= dt;
      }
    }

    // -------------------------------------------------- 绘制
    render() {
      this.renderTokens();
      this.renderDice();
      this.renderUI();
      this.renderEffect();
      this.renderControls();
      this.renderFx();
      this.setResultVisible(this.phase === 'over');
    }

    visualPoint(actor) {
      const m = this.move;
      if (m && m.actor === actor) {
        const a = this.progressCenter(m.fromProgress);
        const b = this.progressCenter(m.toProgress);
        const t = clamp(m.t, 0, 1);
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * 19,
          progress: lerp(m.fromProgress, m.toProgress, t),
        };
      }
      const p = this.progressCenter(this.positions[actor]);
      return { x: p.x, y: p.y, progress: this.positions[actor] };
    }

    renderTokens() {
      const g = this.tokensG;
      g.clear();
      const sameTile = this.positions.player % TILE_COUNT === this.positions.ai % TILE_COUNT && !this.winner;
      const pvp = this.visualPoint('player');
      const avp = this.visualPoint('ai');
      const activeActor = this.phase === 'over' ? null : this.turn;
      if (sameTile) {
        pvp.x -= 19;
        avp.x += 19;
      } else if (!this.move) {
        if (specialAt(this.positions.player % TILE_COUNT)) pvp.x -= 14;
        if (specialAt(this.positions.ai % TILE_COUNT)) avp.x -= 14;
      }
      drawCharacter(g, 'player', pvp.x, pvp.y + 26, 0.55, activeActor === 'player', this.clock);
      drawCharacter(g, 'ai', avp.x, avp.y + 26, 0.55, activeActor === 'ai', this.clock);
    }

    renderDice() {
      this.diceG.clear();
      this.diceG.setPosition(this.L.dice.x, this.L.dice.y);
      const angle = this.phase === 'rolling' ? Math.sin(this.clock * 32) * 0.14 : 0;
      this.diceG.setRotation(angle);
      drawDice(this.diceG, this.dice, this.L.dice.size, 0);
    }

    renderUI() {
      const g = this.uiG;
      g.clear();
      const isPlayer = this.turn === 'player';
      const fill = isPlayer ? C.playerSoft : C.foxSoft;
      const edge = isPlayer ? C.player : C.fox;
      drawPill(g, this.L.turn.x, this.L.turn.y, 230, 38, fill, edge, 2);
      g.fillStyle(edge, 0.24);
      g.fillCircle(this.L.turn.x - 88, this.L.turn.y, 9);
      g.fillStyle(edge, 1);
      g.fillCircle(this.L.turn.x - 88, this.L.turn.y, 5.5);
      if (this.phase === 'over') {
        this.turnText.setText('这一局结束啦');
      } else if (this.turn === 'ai') {
        this.turnText.setText(this.phase === 'rolling' ? '小狐狸摇骰子…' : this.phase === 'moving' ? '小狐狸在走…' : '轮到小狐狸啦');
      } else {
        this.turnText.setText(this.phase === 'rolling' ? '小蓝熊摇骰子…' : this.phase === 'moving' ? '小蓝熊在走…' : '轮到小蓝熊啦');
      }
      const pp = progressParts(this.positions.player);
      const ap = progressParts(this.positions.ai);
      this.progressText.setText(
        '小蓝熊 第' + pp.lap + '圈 ' + pp.step + '/18   ·   小狐狸 第' + ap.lap + '圈 ' + ap.step + '/18'
      );
    }

    renderEffect() {
      const g = this.effectG;
      g.clear();
      const e = this.effect;
      if (this.phase !== 'effect' || !e || !e.text) {
        this.effectText.setVisible(false);
        return;
      }
      const fill = e.kind === 'plus' ? 0xE0F5E2 : e.kind === 'minus' ? 0xFFE4E0 : e.kind === 'pause' ? 0xEDE5FB : 0xFFF8E8;
      const edge = e.kind === 'plus' ? C.plus : e.kind === 'minus' ? C.minus : e.kind === 'pause' ? C.pause : 0xDDBE83;
      const pulse = 1 + Math.sin(this.clock * 8) * 0.012;
      g.fillStyle(fill, 0.98);
      g.fillRoundedRect(this.L.effect.x - 136 * pulse, this.L.effect.y - 23, 272 * pulse, 46, 23);
      g.lineStyle(2, edge, 0.9);
      g.strokeRoundedRect(this.L.effect.x - 136 * pulse, this.L.effect.y - 23, 272 * pulse, 46, 23);
      this.effectText.setText(e.text);
      this.effectText.setColor(e.kind === 'plus' ? '#2F7F55' : e.kind === 'minus' ? '#A44949' : e.kind === 'pause' ? '#5F448F' : '#5A3E2B');
      this.effectText.setVisible(true);
    }

    renderControls() {
      const g = this.controlG;
      g.clear();
      const activePlayer = this.turn === 'player' && this.phase !== 'over';
      const activeAI = this.turn === 'ai' && this.phase !== 'over';
      const pc = this.L.playerCard;
      const ac = this.L.aiCard;
      if (activePlayer) {
        g.fillStyle(C.gold, 0.17);
        g.fillRoundedRect(pc.x - pc.w / 2 - 5, pc.y - pc.h / 2 - 5, pc.w + 10, pc.h + 10, 26);
        g.lineStyle(3, C.gold, 0.95);
        g.strokeRoundedRect(pc.x - pc.w / 2 - 3, pc.y - pc.h / 2 - 3, pc.w + 6, pc.h + 6, 25);
      }
      if (activeAI) {
        g.fillStyle(C.gold, 0.17);
        g.fillRoundedRect(ac.x - ac.w / 2 - 5, ac.y - ac.h / 2 - 5, ac.w + 10, ac.h + 10, 26);
        g.lineStyle(3, C.gold, 0.95);
        g.strokeRoundedRect(ac.x - ac.w / 2 - 3, ac.y - ac.h / 2 - 3, ac.w + 6, ac.h + 6, 25);
      }
      drawCharacter(g, 'player', pc.x, 724, 1.05, activePlayer, this.clock);
      drawCharacter(g, 'ai', ac.x, 724, 1.05, activeAI, this.clock);

      this.playerNameText.setText('小蓝熊（你）');
      this.aiNameText.setText('小狐狸');
      const pp = progressParts(this.positions.player);
      const ap = progressParts(this.positions.ai);
      this.playerProgressText.setText(this.positions.player >= FINISH_PROGRESS ? '两圈完成啦！' : '第' + pp.lap + '圈 · ' + pp.step + '/18');
      this.aiProgressText.setText(this.positions.ai >= FINISH_PROGRESS ? '两圈完成啦！' : '第' + ap.lap + '圈 · ' + ap.step + '/18');
      if (this.skip.player > 0 && this.turn === 'player') this.playerProgressText.setText('下一回合休息');
      if (this.skip.ai > 0 && this.turn === 'ai') this.aiProgressText.setText('下一回合休息');

      const canRoll = this.phase === 'idle' && this.turn === 'player' && !this.winner;
      const b = this.L.button;
      g.fillStyle(C.goldDeep, canRoll ? 0.28 : 0.12);
      g.fillRoundedRect(b.x - b.w / 2 + 3, b.y - b.h / 2 + 5, b.w, b.h, 38);
      let buttonFill = canRoll ? 0x56A6D6 : 0xC5B9A7;
      if (!canRoll && this.phase !== 'over') buttonFill = this.turn === 'ai' ? 0xD4BDA8 : 0xBDB5AA;
      g.fillStyle(buttonFill, 1);
      g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 38);
      g.lineStyle(3, 0xFFFFFF, canRoll ? 0.63 : 0.35);
      g.strokeRoundedRect(b.x - b.w / 2 + 4, b.y - b.h / 2 + 4, b.w - 8, b.h - 8, 34);
      if (canRoll) {
        const pr = 1 + Math.sin(this.clock * 5) * 0.018;
        g.lineStyle(2.5, 0xFFFFFF, 0.18 + Math.sin(this.clock * 5) * 0.07);
        g.strokeRoundedRect(b.x - (b.w * pr) / 2 - 5, b.y - (b.h * pr) / 2 - 5, b.w * pr + 10, b.h * pr + 10, 42);
      }
      let label = '摇骰子';
      if (this.phase === 'rolling') label = '骰子转呀转…';
      else if (this.phase === 'moving') label = '走呀走…';
      else if (this.phase === 'effect') label = '看看发生什么…';
      else if (this.turn === 'ai') label = '小狐狸正在想…';
      else if (this.phase === 'over') label = '再来一局';
      this.rollText.setText(label);
      this.rollText.setColor(canRoll ? '#FFFFFF' : '#FFFDF5');
      this.rollText.setStroke(canRoll ? '#3C7599' : '#8F806E', 3);
    }

    update(time, delta) {
      this.step((delta || 0) / 1000);
      this.render();
    }
  }

  function drawCrown(g, x, y, s) {
    g.fillStyle(0xD79A24, 1);
    g.beginPath();
    g.moveTo(x - 18 * s, y + 8 * s);
    g.lineTo(x - 21 * s, y - 12 * s);
    g.lineTo(x - 7 * s, y - 2 * s);
    g.lineTo(x, y - 20 * s);
    g.lineTo(x + 7 * s, y - 2 * s);
    g.lineTo(x + 21 * s, y - 12 * s);
    g.lineTo(x + 18 * s, y + 8 * s);
    g.closePath();
    g.fillPath();
    g.fillStyle(C.gold, 1);
    g.fillRoundedRect(x - 18 * s, y + 4 * s, 36 * s, 7 * s, 3 * s);
    g.fillStyle(0xFFF4BF, 0.85);
    g.fillCircle(x, y - 1 * s, 2.2 * s);
    g.fillCircle(x - 11 * s, y + 2 * s, 1.8 * s);
    g.fillCircle(x + 11 * s, y + 2 * s, 1.8 * s);
  }

  window.MonopolyScene = MonopolyScene;
})();
