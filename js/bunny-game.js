(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  // 只做竖屏 540x960，横屏时用 FIT 缩放居中显示同一版画面。
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const C = {
    wall: 0xFBE7D6,
    wallLine: 0xF6DCC6,
    wallDark: 0xEFCDB4,
    floor: 0xE8C8A2,
    floorLine: 0xD9B387,
    window: 0xCBEAFB,
    windowDeep: 0xA9D8F2,
    frame: 0xFFFFFF,
    frameEdge: 0xE2B79E,
    cloud: 0xFFFFFF,
    sun: 0xFFE6A4,
    rug: 0xFFDCE6,
    rugEdge: 0xF6BCCE,
    tray: 0xFFF7EE,
    trayEdge: 0xF0D3BB,
  };

  const BUNNY = {
    fur: 0xFFF2F6,
    furShade: 0xF2D5E1,
    furDeep: 0xE6BFCE,
    ear: 0xFFC6DA,
    earShade: 0xF3AFC8,
    blush: 0xFF9DBB,
    bow: 0xFF7FB0,
    bowDark: 0xE2588C,
    eye: 0x5B3A48,
    white: 0xFFFFFF,
  };

  const DEPTH = {
    room: 0,
    rug: 2,
    bunny: 10,
    bubble: 20,
    fx: 24,
    trayPanel: 30,
    trayCell: 31,
    trayItem: 33,
    trayHit: 34,
    ghost: 40,
  };

  const TRAY_SCALE = 0.86;

  // 需求：饿 / 渴 / 脏 / 困 / 想玩
  const NEEDS = [
    { key: 'eat', label: '饿了', color: 0xFFA94D, icon: 'carrot' },
    { key: 'drink', label: '渴了', color: 0x4FC3F7, icon: 'drop' },
    { key: 'wash', label: '脏了', color: 0x7FC7E8, icon: 'bubbles' },
    { key: 'sleep', label: '困了', color: 0x9B8CE8, icon: 'moon' },
    { key: 'play', label: '想玩', color: 0x7BC96F, icon: 'ball' },
  ];

  // 底栏 10 件物品：两行五列固定网格，全部可见，不需要滚动。
  const ITEMS = [
    { key: 'carrot', need: 'eat', name: '胡萝卜', draw: drawCarrot },
    { key: 'apple', need: 'eat', name: '苹果', draw: drawApple },
    { key: 'bottle', need: 'drink', name: '奶瓶', draw: drawBottle },
    { key: 'juice', need: 'drink', name: '果汁', draw: drawJuice },
    { key: 'soap', need: 'wash', name: '香皂', draw: drawSoap },
    { key: 'towel', need: 'wash', name: '毛巾', draw: drawTowel },
    { key: 'pillow', need: 'sleep', name: '枕头', draw: drawPillow },
    { key: 'blanket', need: 'sleep', name: '小被子', draw: drawBlanket },
    { key: 'ball', need: 'play', name: '皮球', draw: drawBall },
    { key: 'book', need: 'play', name: '故事书', draw: drawBook },
  ];

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const cols = 5;
    const rows = 2;
    const cellW = 92;
    const cellH = 80;
    const gapX = 12;
    const gapY = 12;
    const trayH = 216;
    const trayTop = HEIGHT - trayH;
    const gridW = cols * cellW + (cols - 1) * gapX;
    const gridH = rows * cellH + (rows - 1) * gapY;
    return {
      floorY: 620,
      trayTop: trayTop,
      trayH: trayH,
      grid: {
        cols: cols, rows: rows, cellW: cellW, cellH: cellH, gapX: gapX, gapY: gapY,
        startX: (WIDTH - gridW) / 2,
        startY: trayTop + (trayH - gridH) / 2,
      },
      bunny: { x: WIDTH / 2, y: 712, scale: 1.06 },
      bubble: { x: WIDTH / 2, y: 344, w: 206, h: 126 },
      lift: 52,
    };
  }

  function cellCenter(i, L) {
    const g = L.grid;
    const col = i % g.cols;
    const row = Math.floor(i / g.cols);
    return {
      x: g.startX + col * (g.cellW + g.gapX) + g.cellW / 2,
      y: g.startY + row * (g.cellH + g.gapY) + g.cellH / 2,
    };
  }

  // ---------------------------------------------------------------- 颜色工具
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

  // ---------------------------------------------------------------- 几何工具
  function rotAbout(x, y, ox, oy, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const dx = x - ox, dy = y - oy;
    return { x: ox + dx * c - dy * s, y: oy + dx * s + dy * c };
  }

  function rotPts(pts, ox, oy, ang) {
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) out[i] = rotAbout(pts[i].x, pts[i].y, ox, oy, ang);
    return out;
  }

  function ellipsePoints(cx, cy, rx, ry, angle, segments) {
    const n = segments || Math.max(14, Math.min(40, Math.round(Math.max(rx, ry) / 2.6)));
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

  function arcPtsE(cx, cy, rx, ry, a0, a1, steps) {
    const n = steps || 16;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
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
  }

  function pie(g, cx, cy, r, a0, a1, color) {
    const pts = [{ x: cx, y: cy }];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    g.fillStyle(color, 1);
    fillPts(g, pts);
  }  // ---------------------------------------------------------------- 物品绘制
  // 全部画在以 (0,0) 为中心的设计坐标里（约 76x76），放到栏里时用容器 scale 缩小。
  function drawCarrot(g) {
    fillRoundEllipse(g, -13, -28, 7, 15, -0.5, 0x63BB57);
    fillRoundEllipse(g, 0, -34, 7, 17, 0, 0x7CCB6A);
    fillRoundEllipse(g, 13, -28, 7, 15, 0.5, 0x63BB57);
    g.fillStyle(0xFF8A3D, 1);
    fillPts(g, [
      { x: -15, y: -16 }, { x: 15, y: -16 }, { x: 11, y: 8 },
      { x: 5, y: 24 }, { x: 0, y: 34 }, { x: -5, y: 24 }, { x: -11, y: 8 },
    ]);
    fillRoundEllipse(g, -5, -6, 4, 9, 0.16, 0xFFB273);
    g.lineStyle(2, 0xE06A20, 0.7);
    strokePts(g, [{ x: -9, y: -4 }, { x: 9, y: -7 }], false);
    strokePts(g, [{ x: -8, y: 5 }, { x: 8, y: 2 }], false);
    strokePts(g, [{ x: -6, y: 14 }, { x: 6, y: 11 }], false);
  }

  function drawApple(g) {
    g.lineStyle(5, 0x8B5A2B, 1);
    strokePts(g, [{ x: 0, y: -18 }, { x: 3, y: -32 }], false);
    fillRoundEllipse(g, 14, -30, 12, 6, -0.5, 0x6BBF59);
    fillRoundEllipse(g, -10, 2, 20, 20, 0, 0xE8523F);
    fillRoundEllipse(g, 10, 2, 20, 20, 0, 0xE8523F);
    fillRoundEllipse(g, 0, 8, 21, 19, 0, 0xE8523F);
    fillRoundEllipse(g, 0, -8, 12, 8, 0, 0xD9432F);
    fillRoundEllipse(g, -11, -7, 6, 9, 0.4, 0xFF9E8B, 0.85);
    g.fillStyle(0xFFFFFF, 0.75);
    g.fillCircle(-13, -9, 3.4);
  }

  function drawBottle(g) {
    fillRoundEllipse(g, 0, -33, 7, 9, 0, 0xFFD9A8);
    g.fillStyle(0x9FD0EE, 1);
    g.fillRoundedRect(-12, -27, 24, 9, 4);
    g.fillStyle(0xEAF6FF, 1);
    g.fillRoundedRect(-17, -19, 34, 54, 11);
    g.fillStyle(0xFFF4E0, 1);
    g.fillRoundedRect(-13, 4, 26, 28, 9);
    g.lineStyle(2.4, 0xBFD9EA, 1);
    strokePts(g, [{ x: -8, y: -10 }, { x: 4, y: -10 }], false);
    strokePts(g, [{ x: -8, y: -2 }, { x: 4, y: -2 }], false);
    g.lineStyle(2.6, 0xA9CCE2, 1);
    g.strokeRoundedRect(-17, -19, 34, 54, 11);
    g.fillStyle(0xFFFFFF, 0.7);
    fillRoundEllipse(g, -9, 12, 3.5, 11, 0.08, 0xFFFFFF, 0.7);
  }

  function drawJuice(g) {
    const cup = [{ x: -15, y: -20 }, { x: 15, y: -20 }, { x: 11, y: 34 }, { x: -11, y: 34 }];
    g.lineStyle(6, 0xFF6F91, 1);
    strokePts(g, [{ x: -6, y: 18 }, { x: 15, y: -30 }], false);
    g.fillStyle(0xEAF7FF, 0.5);
    fillPts(g, cup);
    g.fillStyle(0xFFA63D, 1);
    fillPts(g, [
      { x: -12, y: -4 }, { x: 12, y: -4 }, { x: 10, y: 32 }, { x: -10, y: 32 },
    ]);
    g.fillStyle(0xEAF7FF, 0.55);
    fillPts(g, cup);
    g.lineStyle(2.6, 0x8FC4DF, 1);
    strokePts(g, cup, true);
    g.fillStyle(0xFFFFFF, 0.9);
    g.fillRoundedRect(-17, -25, 34, 8, 4);
    fillRoundEllipse(g, -7, 12, 3, 11, 0.1, 0xFFFFFF, 0.5);
    g.fillStyle(0xFFD08A, 1);
    g.fillCircle(4, 6, 2.6);
    g.fillCircle(0, 16, 2.2);
  }

  function drawSoap(g) {
    g.fillStyle(0xFFC7E0, 1);
    g.fillRoundedRect(-26, -15, 52, 31, 13);
    g.fillStyle(0xFFE6F2, 1);
    g.fillRoundedRect(-20, -10, 40, 13, 7);
    g.lineStyle(2.6, 0xE58FB6, 1);
    g.strokeRoundedRect(-26, -15, 52, 31, 13);
    g.fillStyle(0xE8F7FF, 0.95);
    g.fillCircle(23, -22, 8);
    g.fillCircle(9, -27, 5.5);
    g.lineStyle(2, 0x9FD8F0, 0.95);
    g.strokeCircle(23, -22, 8);
    g.strokeCircle(9, -27, 5.5);
    g.fillStyle(0xFFFFFF, 0.9);
    g.fillCircle(20.5, -24.5, 2.4);
  }

  function drawTowel(g) {
    g.fillStyle(0xBFE9FF, 1);
    g.fillRoundedRect(-25, -21, 50, 43, 9);
    g.fillStyle(0xE9F8FF, 1);
    g.fillRoundedRect(-25, -21, 50, 14, 9);
    g.lineStyle(3, 0xFFFFFF, 0.95);
    strokePts(g, [{ x: -18, y: -2 }, { x: 18, y: -2 }], false);
    strokePts(g, [{ x: -18, y: 8 }, { x: 18, y: 8 }], false);
    g.lineStyle(2.6, 0x8FCBEA, 1);
    g.strokeRoundedRect(-25, -21, 50, 43, 9);
    g.fillStyle(0x7FC0E4, 1);
    g.fillCircle(0, -14, 3.6);
  }

  function drawPillow(g) {
    g.fillStyle(0xFFF6FB, 1);
    g.fillRoundedRect(-29, -19, 58, 38, 15);
    g.lineStyle(3, 0xF0BBD4, 1);
    g.strokeRoundedRect(-29, -19, 58, 38, 15);
    g.lineStyle(2, 0xF7D3E4, 1);
    g.strokeRoundedRect(-22, -12, 44, 24, 10);
    fillRoundEllipse(g, 0, 0, 11, 6.5, 0, 0xF7D3E4);
    fillRoundEllipse(g, -6, -1, 6, 5, 0, 0xFBE6F0);
    fillRoundEllipse(g, 6, -1, 6, 5, 0, 0xFBE6F0);
  }

  function drawBlanket(g) {
    g.fillStyle(0xCDE7FF, 1);
    g.fillRoundedRect(-28, -23, 56, 46, 10);
    g.lineStyle(2, 0xFFFFFF, 0.9);
    for (let i = -1; i <= 1; i++) {
      strokePts(g, [{ x: i * 14, y: -23 }, { x: i * 14, y: 23 }], false);
    }
    strokePts(g, [{ x: -28, y: 0 }, { x: 28, y: 0 }], false);
    g.fillStyle(0xEAF4FF, 1);
    g.fillRoundedRect(-28, -23, 56, 13, 10);
    g.lineStyle(2.6, 0x9CC7E8, 1);
    g.strokeRoundedRect(-28, -23, 56, 46, 10);
  }

  function drawBall(g) {
    pie(g, 0, 0, 27, -Math.PI / 2, Math.PI / 6, 0xFF6F6F);
    pie(g, 0, 0, 27, Math.PI / 6, Math.PI * 5 / 6, 0xFFD75E);
    pie(g, 0, 0, 27, Math.PI * 5 / 6, Math.PI * 1.5, 0x62B7E8);
    g.lineStyle(3, 0x6D8FA3, 0.45);
    g.strokeCircle(0, 0, 27);
    fillRoundEllipse(g, -10, -12, 8, 6, -0.6, 0xFFFFFF, 0.62);
  }

  function drawBook(g) {
    g.fillStyle(0xF6E7C8, 1);
    g.fillRoundedRect(-22, -25, 44, 50, 6);
    g.lineStyle(2, 0xE0CBA4, 1);
    strokePts(g, [{ x: 16, y: -22 }, { x: 16, y: 22 }], false);
    g.fillStyle(0xFF8FA8, 1);
    g.fillRoundedRect(-30, -27, 46, 54, 8);
    g.fillStyle(0xFFC2D2, 1);
    g.fillRoundedRect(-25, -21, 34, 42, 6);
    g.lineStyle(2.6, 0xD95F7F, 1);
    g.strokeRoundedRect(-30, -27, 46, 54, 8);
    g.fillStyle(0xE8778F, 1);
    g.fillRoundedRect(-30, -27, 11, 54, 6);
    g.fillStyle(0xFFFFFF, 0.95);
    fillPts(g, starPoints(-10, -4, 9, 4.2, 5, 0));
  }  // ---------------------------------------------------------------- 需求图标
  function drawDropIcon(g) {
    g.fillStyle(0x7FD3F5, 1);
    fillPts(g, [{ x: 0, y: -34 }, { x: 16, y: 2 }, { x: -16, y: 2 }]);
    g.fillCircle(0, 6, 22);
    g.lineStyle(3, 0x4FB4DE, 1);
    g.strokeCircle(0, 6, 22);
    fillRoundEllipse(g, -7, 2, 6, 9, 0.3, 0xFFFFFF, 0.6);
  }

  function drawBubblesIcon(g) {
    const list = [[-15, 8, 17], [11, -8, 21], [23, 17, 11]];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      g.fillStyle(0xD8F2FE, 0.95);
      g.fillCircle(b[0], b[1], b[2]);
      g.lineStyle(3, 0x8FD4F2, 0.95);
      g.strokeCircle(b[0], b[1], b[2]);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillCircle(b[0] - b[2] * 0.34, b[1] - b[2] * 0.34, b[2] * 0.24);
    }
  }

  function drawMoonIcon(g) {
    const outer = arcPtsE(0, 0, 27, 27, -Math.PI / 2, Math.PI / 2, 20);
    const inner = arcPtsE(-9, 0, 24, 24, Math.PI / 2, -Math.PI / 2, 20);
    g.fillStyle(0xFFD75E, 1);
    fillPts(g, outer.concat(inner));
    g.fillStyle(0xFFE9A8, 0.9);
    g.fillCircle(6, -9, 3.4);
    g.fillStyle(0xFFF2C4, 0.95);
    fillPts(g, starPoints(24, -22, 7, 3.2, 5, 0.3));
    fillPts(g, starPoints(15, 22, 5, 2.3, 5, 0.6));
  }

  function drawNeedIcon(g, icon, scale) {
    if (icon === 'drop') drawDropIcon(g);
    else if (icon === 'bubbles') drawBubblesIcon(g);
    else if (icon === 'moon') drawMoonIcon(g);
    else if (icon === 'ball') drawBall(g);
    else drawCarrot(g);
  }

  // ---------------------------------------------------------------- 小兔子
  // 原点在脚底，身体向上长；所有姿态共用同一套部件，靠参数换姿势。
  const POSES = {
    idle: { headRot: 0, headDy: 0, eye: 'open', mouth: 'omega', armL: { x: -56, y: -72 }, armR: { x: 56, y: -72 }, earDroop: 0, cheek: 0, blush: 0.9 },
    eat: { headRot: -0.09, headDy: 9, eye: 'happy', mouth: 'open', armL: { x: -52, y: -70 }, armR: { x: 30, y: -140 }, earDroop: 0.1, cheek: 9, blush: 1 },
    drink: { headRot: 0.07, headDy: -5, eye: 'happy', mouth: 'open', armL: { x: -52, y: -70 }, armR: { x: 26, y: -156 }, earDroop: 0.03, cheek: 0, blush: 1 },
    wash: { headRot: 0, headDy: 2, eye: 'happy', mouth: 'smile', armL: { x: -34, y: -140 }, armR: { x: 34, y: -140 }, earDroop: 0.14, cheek: 4, blush: 1 },
    sleep: { headRot: -0.2, headDy: 13, eye: 'closed', mouth: 'flat', armL: { x: -50, y: -62 }, armR: { x: 50, y: -62 }, earDroop: 0.55, cheek: 0, blush: 0.7 },
    play: { headRot: 0, headDy: -6, eye: 'happy', mouth: 'smile', armL: { x: -64, y: -124 }, armR: { x: 64, y: -124 }, earDroop: -0.16, cheek: 0, blush: 1 },
    tilt: { headRot: -0.27, headDy: 2, eye: 'open', mouth: 'flat', armL: { x: -54, y: -70 }, armR: { x: 58, y: -80 }, earDroop: 0.4, cheek: 0, blush: 1 },
  };

  function drawBow(g, cx, cy, ang, s) {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const put = function (dx, dy) { return { x: cx + dx * c - dy * sn, y: cy + dx * sn + dy * c }; };
    const L = put(-17 * s, 0);
    const R = put(17 * s, 0);
    fillRoundEllipse(g, L.x, L.y, 15 * s, 11 * s, ang - 0.45, BUNNY.bow);
    fillRoundEllipse(g, R.x, R.y, 15 * s, 11 * s, ang + 0.45, BUNNY.bow);
    fillRoundEllipse(g, cx, cy, 9.5 * s, 9.5 * s, 0, BUNNY.bowDark);
    fillRoundEllipse(g, cx, cy - s, 6.6 * s, 6.6 * s, 0, BUNNY.bow);
  }

  function drawArm(g, aim, side) {
    const sx = side * 44;
    const sy = -104;
    const mx = (sx + aim.x) / 2;
    const my = (sy + aim.y) / 2;
    g.lineStyle(27, BUNNY.furShade, 1);
    strokePts(g, [{ x: sx, y: sy }, { x: mx, y: my }], false);
    g.lineStyle(23, BUNNY.fur, 1);
    strokePts(g, [{ x: sx, y: sy }, { x: mx, y: my }], false);
    const ang = Math.atan2(aim.y - sy, aim.x - sx);
    fillRoundEllipse(g, aim.x, aim.y, 15, 14, ang, BUNNY.furShade);
    fillRoundEllipse(g, aim.x, aim.y, 13, 12, ang, BUNNY.fur);
  }

  function drawEye(g, cx, cy, mode, side) {
    if (mode === 'happy') {
      g.lineStyle(4.4, BUNNY.eye, 1);
      strokePts(g, arcPtsE(cx, cy + 4, 10, 8, Math.PI, Math.PI * 2, 14), false);
      return;
    }
    if (mode === 'closed') {
      g.lineStyle(4, BUNNY.eye, 1);
      strokePts(g, arcPtsE(cx, cy + 2, 10, 7, Math.PI * 1.04, Math.PI * 1.96, 14), false);
      return;
    }
    const r = mode === 'wide' ? 11 : 9.6;
    g.fillStyle(BUNNY.eye, 1);
    g.fillCircle(cx, cy, r);
    g.fillStyle(BUNNY.white, 1);
    g.fillCircle(cx - side * 3.2, cy - 3.6, r * 0.4);
    g.fillCircle(cx + side * 2.8, cy + 3.4, r * 0.18);
  }

  function drawHead(g, P, blink) {
    const rot = P.headRot || 0;
    const dy = P.headDy || 0;
    const RP = function (x, y) { return rotAbout(x, y + dy, 0, -140, rot); };
    const RPp = function (pts) { return rotPts(pts, 0, -140 - dy, rot); };
    const earA = rot + (P.earDroop || 0);

    const ears = [{ x: -27, y: -230, ry: 44, a: -0.24 }, { x: 22, y: -238, ry: 46, a: 0.15 }];
    for (let i = 0; i < ears.length; i++) {
      const e = ears[i];
      const p = RP(e.x, e.y);
      const a = e.a + earA;
      fillRoundEllipse(g, p.x, p.y, 16, e.ry, a, BUNNY.furShade);
      fillRoundEllipse(g, p.x, p.y - 1, 13.5, e.ry - 3, a, BUNNY.fur);
      fillRoundEllipse(g, p.x, p.y - 2, 6.6, e.ry - 13, a, BUNNY.ear);
    }

    const hc = RP(0, -170);
    fillRoundEllipse(g, hc.x, hc.y + 2.4, 59, 58, rot, BUNNY.furShade);
    fillRoundEllipse(g, hc.x, hc.y, 57, 56, rot, BUNNY.fur);
    fillRoundEllipse(g, hc.x, hc.y + 17, 41, 30, rot, 0xFFFBFD);

    const eyeMode = blink ? 'closed' : (P.eye || 'open');
    const eL = RP(-23, -180);
    const eR = RP(23, -180);
    drawEye(g, eL.x, eL.y, eyeMode, 1);
    drawEye(g, eR.x, eR.y, eyeMode, -1);

    const blushA = (P.blush === undefined ? 0.85 : P.blush) * 0.62;
    const bL = RP(-43, -162);
    const bR = RP(43, -162);
    fillRoundEllipse(g, bL.x, bL.y, 14, 9.5, rot, BUNNY.blush, blushA);
    fillRoundEllipse(g, bR.x, bR.y, 14, 9.5, rot, BUNNY.blush, blushA);

    if (P.cheek) {
      const cL = RP(-30, -154);
      const cR = RP(30, -154);
      fillRoundEllipse(g, cL.x, cL.y, 12 + P.cheek * 0.36, 11 + P.cheek * 0.34, rot, 0xFFFDFE, 0.92);
      fillRoundEllipse(g, cR.x, cR.y, 12 + P.cheek * 0.36, 11 + P.cheek * 0.34, rot, 0xFFFDFE, 0.92);
    }

    const nz = [RP(-7.5, -165), RP(7.5, -165), RP(0, -155)];
    g.fillStyle(BUNNY.blush, 1);
    fillPts(g, nz);

    if (P.mouth === 'open') {
      fillRoundEllipse(g, RP(0, -147).x, RP(0, -147).y, 11, 12.5, rot, 0xDC6B8C);
      const tp = RP(0, -141);
      fillRoundEllipse(g, tp.x, tp.y, 7, 5.5, rot, 0xFF9DBB);
    } else if (P.mouth === 'smile') {
      g.lineStyle(4, BUNNY.eye, 0.9);
      strokePts(g, RPp(arcPtsE(0, -152, 16, 12, Math.PI * 0.12, Math.PI * 0.88, 16)), false);
    } else if (P.mouth === 'flat') {
      g.lineStyle(3.6, BUNNY.eye, 0.85);
      strokePts(g, RPp([{ x: -8, y: -148 }, { x: 8, y: -148 }]), false);
    } else {
      g.lineStyle(3.6, BUNNY.eye, 0.9);
      strokePts(g, RPp(arcPtsE(-9, -148, 9, 8, 0, Math.PI, 12)), false);
      strokePts(g, RPp(arcPtsE(9, -148, 9, 8, 0, Math.PI, 12)), false);
    }

    const bp = RP(-32, -214);
    drawBow(g, bp.x, bp.y, rot + (P.earDroop || 0) * 0.7, 1);
  }

  function drawBunny(g, P, blink) {
    g.clear();
    fillRoundEllipse(g, 0, 0, 80, 13, 0, 0x9A7A63, 0.16);

    fillRoundEllipse(g, -62, -48, 15, 15, 0, BUNNY.furShade);
    fillRoundEllipse(g, -64, -50, 12, 12, 0, 0xFFFBFD);

    fillRoundEllipse(g, -34, -8, 25, 13, 0, BUNNY.furShade);
    fillRoundEllipse(g, 34, -8, 25, 13, 0, BUNNY.furShade);
    fillRoundEllipse(g, -34, -10, 23, 12, 0, 0xFFFBFD);
    fillRoundEllipse(g, 34, -10, 23, 12, 0, 0xFFFBFD);

    fillRoundEllipse(g, 0, -74, 63, 77, 0, BUNNY.furShade);
    fillRoundEllipse(g, 0, -76, 59, 74, 0, BUNNY.fur);
    fillRoundEllipse(g, 0, -64, 38, 46, 0, 0xFFFBFD, 0.75);

    drawArm(g, P.armL, -1);
    drawArm(g, P.armR, 1);
    drawHead(g, P, blink);
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
      pick: function () { tone(680, 0.1, 0.05, 0, 'triangle'); },
      drop: function () { tone(300, 0.15, 0.045, 0, 'sine'); },
      eat: function () {
        tone(190, 0.07, 0.055, 0, 'triangle');
        tone(150, 0.07, 0.05, 0.16, 'triangle');
        tone(175, 0.07, 0.045, 0.34, 'triangle');
      },
      gulp: function () {
        tone(380, 0.12, 0.05, 0, 'sine');
        tone(250, 0.16, 0.05, 0.12, 'sine');
        tone(200, 0.14, 0.035, 0.3, 'sine');
      },
      bubble: function () {
        tone(520, 0.09, 0.04, 0, 'sine');
        tone(700, 0.09, 0.038, 0.1, 'sine');
        tone(920, 0.11, 0.032, 0.21, 'sine');
      },
      yawn: function () {
        tone(340, 0.5, 0.04, 0, 'sine');
        tone(230, 0.62, 0.032, 0.12, 'sine');
        tone(180, 0.5, 0.022, 0.42, 'sine');
      },
      boing: function () {
        tone(180, 0.08, 0.06, 0, 'triangle');
        tone(540, 0.2, 0.045, 0.07, 'sine');
        tone(420, 0.16, 0.03, 0.22, 'sine');
      },
      happy: function () {
        chime(523.25, 0.5, 0.08, 0);
        chime(659.25, 0.5, 0.075, 0.1);
        chime(783.99, 0.62, 0.07, 0.2);
      },
      star: function () { chime(1046.5, 0.55, 0.06, 0); },
      denied: function () {
        tone(165, 0.2, 0.055, 0, 'sine');
        tone(124, 0.26, 0.045, 0.13, 'sine');
      },
    };
  })();  // ---------------------------------------------------------------- 场景
  class BunnyScene extends Phaser.Scene {
    constructor() { super('BunnyScene'); }

    create() {
      this.L = computeLayout();
      this.pose = 'idle';
      this.blink = false;
      this.elapsed = 0;
      this.busy = false;
      this.ghost = null;
      this.dragItem = null;
      this.dragId = -1;
      this.moved = 0;
      this.liveProps = [];
      this.needHistory = [];
      this.consecutive = 0;
      this.need = null;
      this.NEEDS = NEEDS;

      Sound.resume();

      this.buildRoom();
      this.buildBunny();
      this.buildTray();
      this.buildBubble();
      this.bindInput();
      this.startIdle();

      this.setNeed(Phaser.Utils.Array.GetRandom(NEEDS));
    }

    update(time, delta) {
      this.elapsed += delta / 1000;
      if (this.bubbleRoot) {
        this.bubbleRoot.y = this.L.bubble.y + Math.sin(this.elapsed * 1.9) * 7;
      }
    }

    // -------------------------------------------------- 房间
    buildRoom() {
      const L = this.L;
      const g = this.add.graphics().setDepth(DEPTH.room);

      g.fillStyle(C.wall, 1);
      g.fillRect(0, 0, WIDTH, L.floorY);
      for (let x = 0; x < WIDTH; x += 54) {
        g.fillStyle(C.wallLine, 0.6);
        g.fillRect(x, 0, 27, L.floorY);
      }
      g.fillStyle(C.wallDark, 1);
      g.fillRect(0, L.floorY - 30, WIDTH, 30);
      g.fillStyle(0xE2BBA0, 1);
      g.fillRect(0, L.floorY - 34, WIDTH, 5);

      g.fillStyle(C.floor, 1);
      g.fillRect(0, L.floorY, WIDTH, L.trayTop - L.floorY + 14);
      for (let y = L.floorY + 22; y < L.trayTop + 14; y += 28) {
        g.fillStyle(C.floorLine, 0.4);
        g.fillRect(0, y, WIDTH, 3);
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle(C.floorLine, 0.26);
        g.fillRect(i * 46 - 20, L.floorY, 3, L.trayTop - L.floorY + 14);
      }

      this.drawWindow(g, 70, 92);
      this.drawPicture(g, 396, 118);

      fillRoundEllipse(g, 270, 706, 208, 48, 0, C.rugEdge);
      fillRoundEllipse(g, 270, 703, 196, 42, 0, C.rug);
      g.lineStyle(3, 0xFFFFFF, 0.7);
      strokePts(g, arcPtsE(270, 703, 166, 33, 0, Math.PI * 2, 40), false);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillStyle(0xFFFFFF, 0.8);
        g.fillCircle(270 + Math.cos(a) * 130, 703 + Math.sin(a) * 26, 4.5);
      }

      this.add.text(WIDTH / 2, 46, '点一下，或者拖给小兔子', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#C08AA0',
      }).setOrigin(0.5).setDepth(DEPTH.room + 1);
    }

    drawWindow(g, x, y) {
      const w = 168;
      const h = 178;
      g.fillStyle(C.frameEdge, 1);
      g.fillRoundedRect(x - 9, y - 9, w + 18, h + 18, 14);
      g.fillStyle(C.windowDeep, 1);
      g.fillRoundedRect(x, y, w, h, 8);
      for (let i = 0; i < 8; i++) {
        g.fillStyle(lighten(C.window, 0.5 - i * 0.055), 1);
        g.fillRect(x + 3, y + 3 + (h - 6) * (i / 8), w - 6, (h - 6) / 8 + 1.5);
      }
      g.fillStyle(C.sun, 0.95);
      g.fillCircle(x + w - 40, y + 42, 20);
      g.fillStyle(C.cloud, 0.95);
      g.fillCircle(x + 46, y + 58, 18);
      g.fillCircle(x + 66, y + 50, 23);
      g.fillCircle(x + 92, y + 58, 16);
      g.fillRect(x + 42, y + 56, 58, 16);
      g.lineStyle(9, C.frame, 1);
      strokePts(g, [{ x: x + w / 2, y: y }, { x: x + w / 2, y: y + h }], false);
      strokePts(g, [{ x: x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }], false);
      g.fillStyle(0xFFFFFF, 0.2);
      fillPts(g, [
        { x: x + 8, y: y + h - 8 }, { x: x + 60, y: y + 8 },
        { x: x + 94, y: y + 8 }, { x: x + 42, y: y + h - 8 },
      ]);
      g.lineStyle(6, C.frame, 1);
      g.strokeRoundedRect(x - 9, y - 9, w + 18, h + 18, 14);
      g.fillStyle(0xF8E6D4, 1);
      g.fillRoundedRect(x - 22, y + h + 4, w + 44, 16, 8);
    }

    drawPicture(g, x, y) {
      const w = 104;
      const h = 88;
      g.fillStyle(C.frameEdge, 1);
      g.fillRoundedRect(x - 7, y - 7, w + 14, h + 14, 11);
      g.fillStyle(0xFFFDF8, 1);
      g.fillRoundedRect(x, y, w, h, 7);
      const cx = x + w / 2;
      const cy = y + h / 2 - 4;
      g.fillStyle(0xFF9DBB, 1);
      g.fillCircle(cx - 12, cy - 6, 15);
      g.fillCircle(cx + 12, cy - 6, 15);
      fillPts(g, [{ x: cx - 26, y: cy - 2 }, { x: cx + 26, y: cy - 2 }, { x: cx, y: cy + 34 }]);
      g.fillStyle(0xFFD3E1, 0.9);
      g.fillCircle(cx - 15, cy - 11, 5.5);
      g.lineStyle(5, C.frameEdge, 1);
      g.strokeRoundedRect(x - 7, y - 7, w + 14, h + 14, 11);
    }

    // -------------------------------------------------- 小兔子
    buildBunny() {
      const b = this.L.bunny;
      this.bunnyRoot = this.add.container(b.x, b.y).setDepth(DEPTH.bunny);
      this.bunnyRoot.setScale(b.scale);
      this.bunnyG = this.add.graphics();
      this.bunnyRoot.add(this.bunnyG);
      this.paintBunny();
    }

    paintBunny() {
      drawBunny(this.bunnyG, POSES[this.pose] || POSES.idle, this.blink);
    }

    setPose(pose) {
      this.pose = pose;
      this.paintBunny();
    }

    startIdle() {
      const b = this.L.bunny;
      this.tweens.add({
        targets: this.bunnyRoot,
        scaleX: { from: b.scale, to: b.scale * 1.014 },
        scaleY: { from: b.scale, to: b.scale * 1.028 },
        duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
      this.time.addEvent({ delay: 3400, loop: true, callback: () => this.blinkOnce() });
      this.time.addEvent({ delay: 5400, loop: true, callback: () => this.earTwitch() });
    }

    blinkOnce() {
      if (this.blink) return;
      this.blink = true;
      this.paintBunny();
      this.time.delayedCall(140, () => {
        this.blink = false;
        this.paintBunny();
      });
    }

    earTwitch() {
      if (this.busy || this.pose !== 'idle') return;
      const twitch = Object.assign({}, POSES.idle, { earDroop: 0.14, headRot: -0.04 });
      drawBunny(this.bunnyG, twitch, this.blink);
      this.time.delayedCall(220, () => {
        if (this.pose === 'idle' && !this.busy) drawBunny(this.bunnyG, POSES.idle, this.blink);
      });
    }

    // -------------------------------------------------- 底栏
    buildTray() {
      const L = this.L;
      const g = L.grid;
      const panel = this.add.graphics().setDepth(DEPTH.trayPanel);
      panel.fillStyle(0xE9C6A4, 1);
      panel.fillRoundedRect(-24, L.trayTop - 12, WIDTH + 48, L.trayH + 40, 30);
      panel.fillStyle(C.tray, 1);
      panel.fillRoundedRect(-24, L.trayTop, WIDTH + 48, L.trayH + 40, 30);
      panel.fillStyle(C.trayEdge, 1);
      panel.fillRoundedRect(18, L.trayTop + 10, WIDTH - 36, 5, 3);

      this.trayItems = [];
      for (let i = 0; i < ITEMS.length; i++) {
        const def = ITEMS[i];
        const p = cellCenter(i, L);
        const need = NEEDS.filter(function (n) { return n.key === def.need; })[0];

        const cell = this.add.graphics().setDepth(DEPTH.trayCell);
        cell.fillStyle(need.color, 0.15);
        cell.fillRoundedRect(p.x - g.cellW / 2 + 3, p.y - g.cellH / 2 + 3, g.cellW - 6, g.cellH - 6, 16);
        cell.lineStyle(2, need.color, 0.3);
        cell.strokeRoundedRect(p.x - g.cellW / 2 + 3, p.y - g.cellH / 2 + 3, g.cellW - 6, g.cellH - 6, 16);

        const cont = this.add.container(p.x, p.y).setDepth(DEPTH.trayItem).setScale(TRAY_SCALE);
        const art = this.add.graphics();
        def.draw(art);
        cont.add(art);

        const hit = this.add.rectangle(p.x, p.y, g.cellW - 4, g.cellH - 4, 0xffffff, 0)
          .setDepth(DEPTH.trayHit)
          .setInteractive({ useHandCursor: true });

        const item = { def: def, need: def.need, key: def.key, cx: p.x, cy: p.y, cont: cont, art: art, hit: hit };
        hit.on('pointerdown', (pointer) => this.onItemDown(item, pointer));
        this.trayItems.push(item);
      }
    }

    // -------------------------------------------------- 气泡
    buildBubble() {
      const bb = this.L.bubble;
      this.bubbleRoot = this.add.container(bb.x, bb.y).setDepth(DEPTH.bubble);
      this.bubbleG = this.add.graphics();
      this.bubbleIconG = this.add.graphics();
      this.bubbleIcon = this.add.container(-56, -2, [this.bubbleIconG]);
      this.bubbleText = this.add.text(28, 0, '', {
        fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#A5587A',
      }).setOrigin(0.5);
      this.bubbleRoot.add([this.bubbleG, this.bubbleIcon, this.bubbleText]);
    }

    paintBubble(need) {
      const bb = this.L.bubble;
      const g = this.bubbleG;
      g.clear();
      const x = -bb.w / 2;
      const y = -bb.h / 2;
      g.fillStyle(0xD9A98F, 0.2);
      g.fillRoundedRect(x + 3, y + 6, bb.w, bb.h, 30);
      g.fillStyle(0xFFFFFF, 0.98);
      g.fillRoundedRect(x, y, bb.w, bb.h, 30);
      fillPts(g, [{ x: -18, y: bb.h / 2 - 6 }, { x: 16, y: bb.h / 2 - 6 }, { x: 2, y: bb.h / 2 + 24 }]);
      g.lineStyle(4, 0xF3CBD9, 1);
      g.strokeRoundedRect(x, y, bb.w, bb.h, 30);
      g.fillStyle(need.color, 1);
      g.fillCircle(x + 24, y + 24, 9);
      g.fillStyle(0xFFFFFF, 0.75);
      g.fillCircle(x + 21, y + 21, 3.2);
      this.bubbleIconG.clear();
      drawNeedIcon(this.bubbleIconG, need.icon, 1);
      this.bubbleIcon.setScale(0.62);
      this.bubbleText.setText(need.label);
    }

    showBubble() {
      this.bubbleRoot.setScale(0.55).setAlpha(0);
      this.tweens.add({
        targets: this.bubbleRoot, scale: 1, alpha: 1,
        duration: 320, ease: 'Back.Out',
      });
    }

    hideBubble() {
      this.tweens.add({
        targets: this.bubbleRoot, scale: 0.4, alpha: 0,
        duration: 220, ease: 'Sine.In',
      });
    }

    setNeed(need) {
      this.need = need;
      this.needHistory.push(need.key);
      this.paintBubble(need);
      this.showBubble();
    }

    nextNeed() {
      const self = this.need;
      const pool = NEEDS.filter(function (n) { return !self || n.key !== self.key; });
      this.setNeed(Phaser.Utils.Array.GetRandom(pool));
    }

    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointermove', (p) => this.onMove(p));
      this.input.on('pointerup', (p) => this.onUp(p));
      this.input.on('pointerupoutside', (p) => this.onUp(p));
    }

    onItemDown(item, pointer) {
      Sound.resume();
      if (this.busy || this.ghost) return;
      const L = this.L;
      this.dragItem = item;
      this.dragId = pointer.id;
      this.moved = 0;
      this.downX = pointer.x;
      this.downY = pointer.y;

      const cont = this.add.container(pointer.x, pointer.y - L.lift).setDepth(DEPTH.ghost);
      const art = this.add.graphics();
      item.def.draw(art);
      cont.add(art);
      cont.setScale(TRAY_SCALE * 1.18);
      this.ghost = { cont: cont, item: item };
      item.cont.setAlpha(0.24);
      Sound.pick();
    }

    onMove(pointer) {
      if (!this.ghost || pointer.id !== this.dragId) return;
      this.ghost.cont.setPosition(pointer.x, pointer.y - this.L.lift);
      const d = Math.sqrt(Math.pow(pointer.x - this.downX, 2) + Math.pow(pointer.y - this.downY, 2));
      if (d > this.moved) this.moved = d;
    }

    onUp(pointer) {
      const gh = this.ghost;
      if (!gh || pointer.id !== this.dragId) return;
      this.ghost = null;
      this.dragId = -1;
      this.dragItem = null;
      const isTap = this.moved < 12;
      if (isTap || this.overBunny(pointer.x, pointer.y)) this.flyToBunny(gh);
      else this.flyBack(gh);
    }

    overBunny(x, y) {
      const b = this.L.bunny;
      const hw = 84 * b.scale + 40;
      const top = b.y - 290 * b.scale - 24;
      const bottom = b.y + 26;
      return x > b.x - hw && x < b.x + hw && y > top && y < bottom;
    }

    trackObj(o) { this.liveProps.push(o); return o; }

    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
    }

    flyToBunny(gh) {
      const bx = this.L.bunny.x;
      const by = this.L.bunny.y;
      const item = gh.item;
      const right = item.need === this.need.key;
      this.trackObj(gh.cont);
      this.tweens.add({
        targets: gh.cont,
        x: bx + 16, y: by - 152,
        duration: 250, ease: 'Sine.In',
        onComplete: () => {
          if (right) {
            item.cont.setAlpha(1);
            this.tweens.add({
              targets: gh.cont, alpha: 0, scale: TRAY_SCALE * 0.2,
              duration: 220,
              onComplete: () => {
                this.untrackObj(gh.cont);
                gh.cont.destroy();
              },
            });
            this.satisfy(this.need);
          } else {
            this.deny();
            this.tweens.add({
              targets: gh.cont,
              x: item.cx, y: item.cy, scale: TRAY_SCALE,
              delay: 240, duration: 300, ease: 'Sine.InOut',
              onComplete: () => {
                item.cont.setAlpha(1);
                this.untrackObj(gh.cont);
                gh.cont.destroy();
              },
            });
          }
        },
      });
    }

    flyBack(gh) {
      Sound.drop();
      this.trackObj(gh.cont);
      this.tweens.add({
        targets: gh.cont,
        x: gh.item.cx, y: gh.item.cy, scale: TRAY_SCALE,
        duration: 230, ease: 'Sine.In',
        onComplete: () => {
          gh.item.cont.setAlpha(1);
          this.untrackObj(gh.cont);
          gh.cont.destroy();
        },
      });
    }

    // -------------------------------------------------- 反应
    satisfy(need) {
      this.busy = true;
      this.hideBubble();
      this.consecutive += 1;
      const pose = need.key;
      this.setPose(POSES[pose] ? pose : 'idle');
      let dur = 1900;
      if (need.key === 'eat') { Sound.eat(); this.spawnCrumbs(); dur = 1900; }
      else if (need.key === 'drink') { Sound.gulp(); dur = 1700; }
      else if (need.key === 'wash') { Sound.bubble(); this.spawnBubbles(); dur = 1900; }
      else if (need.key === 'sleep') { Sound.yawn(); this.spawnZzz(); dur = 2100; }
      else { Sound.boing(); this.hop(); dur = 1900; }
      Sound.star();
      this.spawnHearts(need.color);
      this.time.delayedCall(dur, () => {
        this.setPose('idle');
        this.busy = false;
        if (Math.random() < 0.5) Sound.happy();
        this.nextNeed();
      });
    }

    deny() {
      this.busy = true;
      Sound.denied();
      this.setPose('tilt');
      const b = this.L.bunny;
      this.tweens.add({
        targets: this.bunnyRoot,
        x: { from: b.x - 6, to: b.x + 6 },
        duration: 55, yoyo: true, repeat: 3, ease: 'Sine.InOut',
        onComplete: () => this.bunnyRoot.setX(b.x),
      });
      this.time.delayedCall(950, () => {
        if (this.pose === 'tilt') this.setPose('idle');
        this.busy = false;
      });
    }

    hop() {
      const b = this.L.bunny;
      this.tweens.add({
        targets: this.bunnyRoot,
        y: b.y - 46,
        duration: 230, yoyo: true, repeat: 1, ease: 'Sine.Out',
        onComplete: () => this.bunnyRoot.setY(b.y),
      });
    }

    // -------------------------------------------------- 小特效
    spawnHearts(color) {
      const b = this.L.bunny;
      for (let i = 0; i < 7; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        if (i % 2 === 0) {
          const c = i % 4 === 0 ? 0xFF8FB4 : color;
          fillRoundEllipse(g, -5, -3, 6, 6, 0, c);
          fillRoundEllipse(g, 5, -3, 6, 6, 0, c);
          g.fillStyle(c, 1);
          fillPts(g, [{ x: -10.5, y: 0 }, { x: 10.5, y: 0 }, { x: 0, y: 13 }]);
        } else {
          g.fillStyle(0xFFE07A, 1);
          fillPts(g, starPoints(0, 0, 11, 5, 5, 0));
        }
        const ang = -Math.PI / 2 + (i - 3) * 0.44;
        const x0 = b.x + Math.cos(ang) * 46;
        const y0 = b.y - 196 + Math.sin(ang) * 26;
        g.setPosition(x0, y0).setScale(0.3).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 200, delay: i * 60 });
        this.tweens.add({
          targets: g,
          x: x0 + Math.cos(ang) * (70 + (i % 3) * 16),
          y: y0 - 84 - (i % 4) * 12,
          scale: 0.6, alpha: 0,
          duration: 820, delay: 220 + i * 60, ease: 'Sine.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    spawnCrumbs() {
      const b = this.L.bunny;
      for (let i = 0; i < 6; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        g.fillStyle(i % 2 ? 0xFFB273 : 0xFF8A3D, 1);
        g.fillCircle(0, 0, 3.4 + (i % 3));
        const x0 = b.x + 10 + (i - 2.5) * 7;
        const y0 = b.y - 152;
        g.setPosition(x0, y0).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, duration: 120, delay: i * 90 });
        this.tweens.add({
          targets: g, y: y0 + 50, x: x0 + (i % 3 - 1) * 16,
          alpha: 0, duration: 620, delay: 200 + i * 90, ease: 'Quad.In',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    spawnBubbles() {
      const b = this.L.bunny;
      for (let i = 0; i < 8; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        const r = 6 + (i % 4) * 3;
        g.fillStyle(0xD8F2FE, 0.9);
        g.fillCircle(0, 0, r);
        g.lineStyle(2.4, 0x8FD4F2, 0.95);
        g.strokeCircle(0, 0, r);
        g.fillStyle(0xFFFFFF, 0.9);
        g.fillCircle(-r * 0.35, -r * 0.35, r * 0.26);
        const x0 = b.x + (i - 3.5) * 26;
        const y0 = b.y - 60 - (i % 3) * 40;
        g.setPosition(x0, y0).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, duration: 180, delay: i * 80 });
        this.tweens.add({
          targets: g, y: y0 - 130 - (i % 3) * 24, x: x0 + (i % 3 - 1) * 20,
          alpha: 0, scale: 1.3, duration: 1200, delay: 160 + i * 80, ease: 'Sine.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    spawnZzz() {
      const b = this.L.bunny;
      for (let i = 0; i < 3; i++) {
        const t = this.add.text(b.x + 78 + i * 15, b.y - 196 - i * 26, 'Z', {
          fontFamily: FONT, fontSize: (24 + i * 11) + 'px', fontStyle: 'bold', color: '#9B8CE8',
        }).setOrigin(0.5).setDepth(DEPTH.fx).setAlpha(0);
        this.trackObj(t);
        const y0 = t.y;
        this.tweens.add({ targets: t, alpha: 0.95, duration: 220, delay: i * 220 });
        this.tweens.add({
          targets: t, y: y0 - 62, x: t.x + 26, alpha: 0,
          duration: 1100, delay: 260 + i * 220, ease: 'Sine.Out',
          onComplete: () => { this.untrackObj(t); t.destroy(); },
        });
      }
    }
  }

  window.BunnyScene = BunnyScene;
})();