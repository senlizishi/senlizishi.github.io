/*
 * 彩虹蛋糕屋：竖屏（540x960）的蛋糕自由装饰小玩具。
 * 中间是一只白色奶油蛋糕，底部 12 种彩色配料可以无限拖到蛋糕上；
 * 点「完成啦」会插上点燃的蜡烛、挂起彩带并撒彩纸，之后仍能继续装饰。
 * 无分数、无计时、无失败、无存档，刷新即重置；完成后点「再做一块」重新开始。
 * 画面全部 Phaser.Graphics / Text 程序化绘制，音效 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;

  const TOPPINGS = [
    { key: 'strawberry', name: '草莓' },
    { key: 'blueberry', name: '蓝莓' },
    { key: 'cherry', name: '樱桃' },
    { key: 'orange', name: '橙片' },
    { key: 'kiwi', name: '猕猴桃' },
    { key: 'chocolate', name: '巧克力' },
    { key: 'macaron', name: '马卡龙' },
    { key: 'cream', name: '奶油花' },
    { key: 'star', name: '星星糖' },
    { key: 'heart', name: '爱心糖' },
    { key: 'flower', name: '花朵糖' },
    { key: 'sprinkles', name: '彩虹糖珠' },
  ];

  const CAKE = {
    x: WIDTH / 2,
    topY: 362, topRx: 188, topRy: 58,
    bodyTop: 362, bodyBottom: 644,
    topHalfW: 188, bottomHalfW: 201,
    standTop: 650, standBottom: 708,
  };

  const TRAY = {
    x: 18, y: 748, w: 504, h: 200,
    colX: [67, 149, 231, 313, 395, 477],
    rowY: [790, 888],
    cellW: 78, cellH: 76,
    iconY: -10, labelY: 25,
  };

  const CANDLE = { x: CAKE.x, y: CAKE.topY + 5, w: 26, h: 112 };
  const DEPTH = {
    world: 0, cake: 2, ribbon: 3, toppings: 4, candle: 7,
    ghost: 12, fx: 14, ui: 20, banner: 24, card: 40,
  };

  const C = {
    berry: 0x7E345F,
    berryDeep: 0x592044,
    coral: 0xFF6B86,
    pink: 0xFF9FC5,
    pinkSoft: 0xFFD3E1,
    cream: 0xFFF8EA,
    creamDeep: 0xF8E7CE,
    golden: 0xF8C95B,
    goldenDeep: 0xD99B2B,
    mint: 0x8FE3C4,
    sky: 0x8FD8F2,
    lavender: 0xBFA6EE,
    white: 0xFFFFFF,
    chocolate: 0x8B5438,
    green: 0x66B96A,
    red: 0xF45B6A,
  };

  const CONFETTI = [0xFF5E86, 0xFFB03A, 0xFFE248, 0x72DC96, 0x54C8F0, 0xA984FF, 0xFF7FD0, 0xFFFFFF];

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    return {
      title: { x: 194, y: 70 },
      subtitle: { x: 194, y: 103 },
      finish: { x: 440, y: 76, w: 140, h: 54 },
      undo: { x: 150, y: 728, w: 108, h: 34 },
      clear: { x: 390, y: 728, w: 108, h: 34 },
      trayHint: { x: 270, y: 744 },
      cake: CAKE,
      tray: TRAY,
      candle: CANDLE,
    };
  }

  // ---------------------------------------------------------------- 几何与绘制工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function blend(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(lerp(ar, br, t)) << 16)
      | (Math.round(lerp(ag, bg, t)) << 8)
      | Math.round(lerp(ab, bb, t));
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
  function drawHeart(g, x, y, s, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.fillCircle(x - s * 0.27, y - s * 0.16, s * 0.38);
    g.fillCircle(x + s * 0.27, y - s * 0.16, s * 0.38);
    g.fillTriangle(x - s * 0.62, y - s * 0.04, x + s * 0.62, y - s * 0.04, x, y + s * 0.72);
  }
  function drawFlower(g, x, y, s, petal, center) {
    g.fillStyle(petal, 1);
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6;
      g.fillCircle(x + Math.cos(a) * s * 0.46, y + Math.sin(a) * s * 0.46, s * 0.34);
    }
    g.fillStyle(center, 1);
    g.fillCircle(x, y, s * 0.31);
  }
  function drawPill(g, r, fill, stroke, shadow) {
    if (shadow != null) {
      g.fillStyle(shadow, 0.28);
      g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2 + 4, r.w, r.h, r.h / 2);
    }
    g.fillStyle(fill, 1);
    g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
    if (stroke != null) {
      g.lineStyle(2, stroke, 0.9);
      g.strokeRoundedRect(r.x - r.w / 2 + 1, r.y - r.h / 2 + 1, r.w - 2, r.h - 2, r.h / 2 - 1);
    }
  }

  // ---------------------------------------------------------------- 12 种配料
  function drawTopping(g, key, x, y, s, rot) {
    const r = s || 24;
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(rot || 0);

    if (key === 'strawberry') {
      g.fillStyle(0xB92F4B, 0.25);
      g.fillEllipse(0, r * 0.72, r * 1.3, r * 0.3);
      g.fillStyle(0xF44F67, 1);
      g.fillCircle(0, r * 0.12, r * 0.68);
      g.fillTriangle(-r * 0.65, -r * 0.18, r * 0.65, -r * 0.18, 0, r * 0.92);
      g.fillStyle(0xFF8798, 0.7);
      g.fillCircle(-r * 0.17, -r * 0.16, r * 0.18);
      g.fillStyle(0x5EAE64, 1);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.32;
        g.fillTriangle(0, -r * 0.42, Math.cos(a) * r * 0.66, -r * 0.35 + Math.sin(a) * r * 0.18, Math.cos(a + 0.16) * r * 0.55, -r * 0.55 + Math.sin(a + 0.16) * r * 0.13);
      }
      g.fillStyle(0xFFF1C9, 0.95);
      for (let i = 0; i < 6; i++) {
        const xx = (i % 3 - 1) * r * 0.27;
        const yy = r * 0.18 + Math.floor(i / 3) * r * 0.28;
        g.fillCircle(xx, yy, r * 0.045);
      }
    } else if (key === 'blueberry') {
      const pts = [[-r * 0.42, r * 0.15], [r * 0.36, r * 0.22], [0, -r * 0.35]];
      for (let i = 0; i < pts.length; i++) {
        const xx = pts[i][0], yy = pts[i][1];
        g.fillStyle(0x4658B8, 1).fillCircle(xx, yy, r * 0.42);
        g.fillStyle(0x8498F0, 0.65).fillCircle(xx - r * 0.13, yy - r * 0.14, r * 0.13);
        drawStar(g, xx, yy - r * 0.2, r * 0.14, 0x293573, 1, 5);
      }
    } else if (key === 'cherry') {
      g.lineStyle(r * 0.09, 0x568D45, 1);
      g.beginPath(); g.moveTo(-r * 0.34, r * 0.1); g.lineTo(-r * 0.1, -r * 0.72); g.lineTo(r * 0.08, -r * 0.86); g.strokePath();
      g.beginPath(); g.moveTo(r * 0.34, r * 0.12); g.lineTo(r * 0.15, -r * 0.66); g.lineTo(r * 0.08, -r * 0.86); g.strokePath();
      g.fillStyle(0x65B65D, 1).fillEllipse(r * 0.2, -r * 0.67, r * 0.7, r * 0.28);
      g.fillStyle(0xD92945, 1); g.fillCircle(-r * 0.37, r * 0.31, r * 0.46); g.fillCircle(r * 0.37, r * 0.34, r * 0.46);
      g.fillStyle(0xFF8091, 0.85); g.fillCircle(-r * 0.49, r * 0.18, r * 0.12); g.fillCircle(r * 0.25, r * 0.21, r * 0.12);
    } else if (key === 'orange') {
      g.fillStyle(0xF28A2C, 1).fillCircle(0, 0, r * 0.86);
      g.fillStyle(0xFFF0C7, 1).fillCircle(0, 0, r * 0.73);
      g.fillStyle(0xFFB13B, 1);
      for (let i = 0; i < 8; i++) {
        const a0 = i * TAU / 8 + 0.035;
        const a1 = (i + 1) * TAU / 8 - 0.035;
        fillPoly(g, [[0, 0], [Math.cos(a0) * r * 0.65, Math.sin(a0) * r * 0.65], [Math.cos(a1) * r * 0.65, Math.sin(a1) * r * 0.65]]);
      }
      g.fillStyle(0xFFE2A0, 1).fillCircle(0, 0, r * 0.09);
    } else if (key === 'kiwi') {
      g.fillStyle(0x8A613C, 1).fillCircle(0, 0, r * 0.86);
      g.fillStyle(0x9FCF64, 1).fillCircle(0, 0, r * 0.76);
      g.fillStyle(0xD9EF9B, 1).fillCircle(0, 0, r * 0.26);
      g.fillStyle(0x4A3A28, 1);
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12;
        g.fillEllipse(Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48, r * 0.06, r * 0.12);
      }
      g.fillStyle(0xFFFFFF, 0.75).fillCircle(-r * 0.18, -r * 0.22, r * 0.05);
    } else if (key === 'chocolate') {
      g.fillStyle(0x6E3F2A, 1).fillRoundedRect(-r * 0.73, -r * 0.58, r * 1.46, r * 1.22, r * 0.2);
      g.fillStyle(0xA96642, 1).fillRoundedRect(-r * 0.66, -r * 0.52, r * 1.32, r * 1.08, r * 0.15);
      g.lineStyle(r * 0.05, 0x75402B, 0.8);
      g.lineBetween(-r * 0.22, -r * 0.5, -r * 0.22, r * 0.5);
      g.lineBetween(r * 0.22, -r * 0.5, r * 0.22, r * 0.5);
      g.lineBetween(-r * 0.62, 0, r * 0.62, 0);
      g.fillStyle(0xD59162, 0.65).fillRoundedRect(-r * 0.6, -r * 0.46, r * 0.25, r * 0.2, r * 0.06);
    } else if (key === 'macaron') {
      g.fillStyle(0xE26388, 0.22).fillEllipse(0, r * 0.62, r * 1.4, r * 0.25);
      g.fillStyle(0xFF9DC3, 1).fillEllipse(0, -r * 0.28, r * 1.42, r * 0.55);
      g.fillStyle(0xFFF2C6, 1).fillRoundedRect(-r * 0.62, -r * 0.08, r * 1.24, r * 0.24, r * 0.1);
      g.fillStyle(0xFF9DC3, 1).fillEllipse(0, r * 0.22, r * 1.42, r * 0.55);
      g.fillStyle(0xFFFFFF, 0.44).fillEllipse(-r * 0.25, -r * 0.38, r * 0.4, r * 0.12);
    } else if (key === 'cream') {
      g.fillStyle(0xEBCFEA, 0.25).fillEllipse(0, r * 0.64, r * 1.3, r * 0.28);
      g.fillStyle(0xFFF8F1, 1);
      g.fillCircle(0, r * 0.23, r * 0.58);
      g.fillCircle(-r * 0.12, -r * 0.08, r * 0.48);
      g.fillCircle(r * 0.08, -r * 0.34, r * 0.34);
      g.fillCircle(0, -r * 0.53, r * 0.2);
      g.fillStyle(0xFFD2E2, 1).fillCircle(0, -r * 0.55, r * 0.09);
      g.fillStyle(0xFFFFFF, 0.8).fillCircle(-r * 0.13, r * 0.1, r * 0.09);
    } else if (key === 'star') {
      g.fillStyle(0xE8AF32, 0.24).fillCircle(0, r * 0.4, r * 0.66);
      drawStar(g, 0, 0, r * 0.86, 0xFFD84A, 1, 5);
      g.fillStyle(0xFFF3A3, 0.9).fillCircle(-r * 0.2, -r * 0.2, r * 0.11);
    } else if (key === 'heart') {
      g.fillStyle(0xD63E85, 0.22).fillEllipse(0, r * 0.55, r * 1.2, r * 0.25);
      drawHeart(g, 0, -r * 0.08, r * 0.9, 0xFF6AAA, 1);
      g.fillStyle(0xFFD0E6, 0.75).fillCircle(-r * 0.26, -r * 0.25, r * 0.12);
    } else if (key === 'flower') {
      g.fillStyle(0x6BA96C, 0.22).fillCircle(0, r * 0.5, r * 0.52);
      drawFlower(g, 0, 0, r * 1.15, 0xFFD85B, 0xFF7B95);
    } else {
      g.fillStyle(0xD7C9F5, 0.25).fillCircle(0, r * 0.35, r * 0.75);
      const cols = [0xFF5E86, 0xFFB03A, 0xFFE248, 0x72DC96, 0x54C8F0, 0xA984FF];
      for (let i = 0; i < 13; i++) {
        const a = pseudo(i + 4) * TAU;
        const rr = r * (0.18 + pseudo(i + 19) * 0.58);
        const xx = Math.cos(a) * rr, yy = Math.sin(a) * rr * 0.75;
        g.save(); g.translateCanvas(xx, yy); g.rotateCanvas(a + i * 0.7);
        g.fillStyle(cols[i % cols.length], 1);
        g.fillRoundedRect(-r * 0.06, -r * 0.17, r * 0.12, r * 0.34, r * 0.06);
        g.restore();
      }
    }
    g.restore();
  }

  // ---------------------------------------------------------------- 背景与蛋糕
  function drawBackground(g) {
    const bands = 20;
    const h = 748 / bands;
    for (let i = 0; i < bands; i++) {
      g.fillStyle(blend(0xFFF4E6, 0xFFD9E8, i / (bands - 1)), 1);
      g.fillRect(0, i * h, WIDTH, h + 1);
    }

    g.fillStyle(0xFFFDF8, 0.34).fillCircle(426, 214, 112);
    g.fillStyle(0xFFC9DF, 0.26).fillCircle(76, 286, 74);
    g.fillStyle(0xFFF0A8, 0.24).fillCircle(270, 470, 190);

    g.lineStyle(2, 0xC7899B, 0.34);
    g.beginPath(); g.moveTo(18, 132); g.lineTo(522, 126); g.strokePath();
    const flagCols = [0xFF6B86, 0xFFBD45, 0x70D6A1, 0x64C8EE, 0xB494F2, 0xFF8BC7];
    for (let i = 0; i < 12; i++) {
      const x = 38 + i * 42;
      const y = 130 - (x / WIDTH) * 5;
      const col = flagCols[i % flagCols.length];
      g.fillStyle(0xB97488, 0.14).fillTriangle(x - 13, y + 3, x + 13, y + 3, x, y + 30);
      g.fillStyle(col, 0.92).fillTriangle(x - 12, y, x + 12, y, x, y + 27);
    }

    for (let i = 0; i < 54; i++) {
      const x = 16 + pseudo(i + 2) * (WIDTH - 32);
      const y = 154 + pseudo(i + 73) * 560;
      if (Math.abs(x - CAKE.x) < 214 && y > 292 && y < 735) continue;
      const col = CONFETTI[i % CONFETTI.length];
      if (i % 4 === 0) drawStar(g, x, y, 3 + pseudo(i + 8) * 3, col, 0.54, 4);
      else {
        g.save(); g.translateCanvas(x, y); g.rotateCanvas(pseudo(i + 11) * Math.PI);
        g.fillStyle(col, 0.44).fillRoundedRect(-2.5, -4.5, 5, 9, 2);
        g.restore();
      }
    }

    g.fillStyle(0xF5D7B4, 1).fillRect(0, 736, WIDTH, 224);
    g.fillStyle(0xFFF7EB, 0.5).fillRect(0, 736, WIDTH, 8);
    for (let i = 0; i < 18; i++) {
      g.fillStyle(0xD4A577, 0.14).fillCircle(12 + i * 34, 750 + (i % 3) * 2, 2.2);
    }
  }

  function drawCake(g) {
    const c = CAKE;

    // 蛋糕台
    g.fillStyle(0xA86C83, 0.18).fillEllipse(c.x, c.standBottom + 10, 428, 30);
    g.fillStyle(0xE0A636, 1).fillEllipse(c.x, c.standBottom, 420, 42);
    g.fillStyle(0xFFDE77, 1).fillEllipse(c.x, c.standBottom - 5, 404, 32);
    g.fillStyle(0xC98B25, 1).fillRoundedRect(c.x - 42, c.standTop + 18, 84, c.standBottom - c.standTop - 24, 20);
    g.fillStyle(0xF3C75B, 1).fillRoundedRect(c.x - 31, c.standTop + 20, 62, c.standBottom - c.standTop - 28, 16);
    g.fillStyle(0xFFE895, 0.55).fillRoundedRect(c.x - 20, c.standTop + 26, 12, 42, 6);
    g.fillStyle(0xE4A83A, 1).fillEllipse(c.x, c.standTop + 6, 402, 46);
    g.fillStyle(0xFFE496, 1).fillEllipse(c.x, c.standTop, 394, 36);

    // 蛋糕主体
    g.fillStyle(0xDABFC5, 0.22).fillEllipse(c.x, c.bodyBottom + 9, 370, 26);
    fillPoly(g, [
      [c.x - c.topHalfW, c.bodyTop],
      [c.x + c.topHalfW, c.bodyTop],
      [c.x + c.bottomHalfW, c.bodyBottom - 24],
      [c.x + c.bottomHalfW - 12, c.bodyBottom],
      [c.x - c.bottomHalfW + 12, c.bodyBottom],
      [c.x - c.bottomHalfW, c.bodyBottom - 24],
    ]);
    g.fillStyle(C.cream, 1);
    fillPoly(g, [
      [c.x - c.topHalfW, c.bodyTop],
      [c.x + c.topHalfW, c.bodyTop],
      [c.x + c.bottomHalfW, c.bodyBottom - 24],
      [c.x + c.bottomHalfW - 12, c.bodyBottom],
      [c.x - c.bottomHalfW + 12, c.bodyBottom],
      [c.x - c.bottomHalfW, c.bodyBottom - 24],
    ]);
    g.fillStyle(0xF4DFD0, 0.7).fillRoundedRect(c.x - c.topHalfW + 8, c.bodyTop + 20, 28, 242, 14);
    g.fillStyle(0xFFFFFF, 0.7).fillRoundedRect(c.x + c.topHalfW - 32, c.bodyTop + 24, 22, 226, 11);

    // 顶部奶油与粉色淋面
    g.fillStyle(0xEAD5D8, 0.4).fillEllipse(c.x, c.topY + 7, c.topRx * 2, c.topRy * 2 + 8);
    g.fillStyle(0xFFFFFF, 1).fillEllipse(c.x, c.topY, c.topRx * 2, c.topRy * 2);
    g.fillStyle(0xFFF8F0, 1).fillEllipse(c.x, c.topY - 4, c.topRx * 2 - 16, c.topRy * 2 - 14);
    g.fillStyle(0xFFB9D1, 1).fillEllipse(c.x, c.topY - 8, c.topRx * 2 - 36, c.topRy * 2 - 28);
    g.fillStyle(0xFFD0E0, 0.95).fillEllipse(c.x - 38, c.topY - 16, 112, 40);

    // 淋面滴落
    const dripXs = [-158, -122, -84, -44, 4, 46, 88, 126, 160];
    for (let i = 0; i < dripXs.length; i++) {
      const dx = dripXs[i];
      const top = c.topY + 25 + (i % 2) * 4;
      const len = 22 + (i % 3) * 13;
      g.fillStyle(0xFFAECB, 1);
      g.fillRoundedRect(c.x + dx - 10, top, 20, len, 9);
      g.fillCircle(c.x + dx, top + len, 10);
    }

    // 底部奶油花边
    for (let i = 0; i < 9; i++) {
      const x = c.x - c.bottomHalfW + 28 + i * 44;
      g.fillStyle(0xF7E7D9, 1).fillCircle(x, c.bodyBottom - 10, 20);
      g.fillStyle(0xFFFFFF, 0.9).fillCircle(x - 4, c.bodyBottom - 14, 9);
    }
    g.fillStyle(0xEECFC6, 0.7).fillRoundedRect(c.x - c.bottomHalfW + 4, c.bodyBottom - 22, c.bottomHalfW * 2 - 8, 5, 3);
  }

  function drawRibbons(g) {
    const c = CAKE;
    const swaps = [
      { color: 0x69D6F2, sign: -1, y: 614 },
      { color: 0xFF80B8, sign: 1, y: 620 },
    ];
    for (let k = 0; k < swaps.length; k++) {
      const q = swaps[k];
      const x0 = c.x + q.sign * 172;
      const x1 = c.x + q.sign * 244;
      g.lineStyle(14, q.color, 0.96);
      g.beginPath();
      g.moveTo(x0, q.y);
      g.lineTo(x1, q.y - 18);
      g.lineTo(x1 + q.sign * 4, q.y + 12);
      g.lineTo(x0, q.y + 14);
      g.strokePath();
      g.lineStyle(5, 0xFFFFFF, 0.48);
      g.lineBetween(x0 + q.sign * 5, q.y + 3, x1, q.y - 10);
      // 尾端分叉，像真正垂下来的彩带
      g.lineStyle(10, q.color, 0.96);
      g.beginPath(); g.moveTo(x1 - q.sign * 2, q.y - 5); g.lineTo(x1 + q.sign * 18, q.y - 28); g.strokePath();
      g.beginPath(); g.moveTo(x1 - q.sign * 2, q.y + 5); g.lineTo(x1 + q.sign * 12, q.y + 28); g.strokePath();
      g.fillStyle(q.color, 0.96);
      g.fillCircle(x1 + q.sign * 18, q.y - 28, 5);
      g.fillCircle(x1 + q.sign * 12, q.y + 28, 5);
    }

    g.fillStyle(0xF05A94, 1);
    g.fillEllipse(c.x - 27, 658, 66, 42);
    g.fillEllipse(c.x + 27, 658, 66, 42);
    g.fillStyle(0xFF9CC4, 1).fillCircle(c.x, 658, 20);
    g.fillStyle(0xE04480, 1).fillCircle(c.x, 658, 11);
    g.fillStyle(0xF05A94, 1);
    g.fillTriangle(c.x - 4, 670, c.x - 28, 704, c.x - 10, 706);
    g.fillTriangle(c.x + 4, 670, c.x + 28, 704, c.x + 10, 706);
    g.fillStyle(0xFFFFFF, 0.55).fillCircle(c.x - 38, 648, 6);
    g.fillStyle(0xFFFFFF, 0.55).fillCircle(c.x + 38, 648, 6);
  }

  function drawCandleBody(g) {
    g.fillStyle(0xC64E8F, 0.18).fillEllipse(0, 4, 44, 12);
    g.fillStyle(0xFFF9E9, 1).fillRoundedRect(-CANDLE.w / 2, -CANDLE.h, CANDLE.w, CANDLE.h, 10);
    g.fillStyle(0xFF80B8, 1);
    for (let i = 0; i < 4; i++) g.fillRect(-CANDLE.w / 2 + 2, -CANDLE.h + 17 + i * 24, CANDLE.w - 4, 7);
    g.fillStyle(0xFFFFFF, 0.7).fillRoundedRect(-CANDLE.w / 2 + 3, -CANDLE.h + 3, 6, CANDLE.h - 8, 3);
    g.lineStyle(2, 0xB54B7F, 0.55);
    g.strokeRoundedRect(-CANDLE.w / 2, -CANDLE.h, CANDLE.w, CANDLE.h, 10);
    g.lineStyle(3, 0x4B342C, 1).lineBetween(0, -CANDLE.h, 0, -CANDLE.h - 8);
  }

  function drawCandleFlame(g) {
    g.fillStyle(0xFFB52E, 0.22).fillCircle(0, 0, 23);
    g.fillStyle(0xFF9F2D, 1);
    fillPoly(g, [[0, -24], [12, -4], [8, 10], [-8, 10], [-12, -4]]);
    g.fillStyle(0xFFE45D, 1);
    fillPoly(g, [[0, -13], [7, -1], [5, 8], [-5, 8], [-7, -1]]);
    g.fillStyle(0xFFFFFF, 0.88).fillCircle(0, 2, 3);
  }

  function drawDecorations(g, list) {
    const sorted = list.slice().sort((a, b) => (a.y - b.y) || (a.id - b.id));
    for (let i = 0; i < sorted.length; i++) {
      const d = sorted[i];
      if (d.key === 'sprinkles') drawTopping(g, d.key, d.x, d.y, 23, d.rot);
      else drawTopping(g, d.key, d.x, d.y, 22, d.rot);
    }
  }

  function drawTray(g) {
    g.fillStyle(0xDDA7B6, 0.24).fillRoundedRect(TRAY.x, TRAY.y + 5, TRAY.w, TRAY.h, 30);
    g.fillStyle(0xFFF8EE, 1).fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 30);
    g.lineStyle(3, 0xF0C7D1, 0.85).strokeRoundedRect(TRAY.x + 1, TRAY.y + 1, TRAY.w - 2, TRAY.h - 2, 29);
    g.fillStyle(0xFFDDE6, 0.48).fillRoundedRect(TRAY.x + 10, TRAY.y + 10, TRAY.w - 20, TRAY.h - 20, 23);
    for (let i = 0; i < 22; i++) {
      const x = TRAY.x + 26 + pseudo(i + 3) * (TRAY.w - 52);
      const y = TRAY.y + 22 + pseudo(i + 31) * (TRAY.h - 44);
      g.fillStyle(CONFETTI[i % CONFETTI.length], 0.18).fillCircle(x, y, 2 + pseudo(i + 8) * 2);
    }
    for (let i = 0; i < TOPPINGS.length; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const x = TRAY.colX[col], y = TRAY.rowY[row];
      g.fillStyle(0xFFFFFF, 0.55).fillCircle(x, y - 8, 31);
      g.fillStyle(CONFETTI[(i + 2) % CONFETTI.length], 0.12).fillCircle(x, y - 8, 27);
    }
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
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.014);
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
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.016);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(master);
        o.start(t0); o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }
    return {
      resume: resume,
      pick: function () { tone(620, 0.07, 0.035, 0, 'triangle'); },
      drop: function () { tone(390, 0.08, 0.04, 0, 'sine'); tone(560, 0.08, 0.022, 0.04, 'sine'); },
      undo: function () { sweep(470, 300, 0.13, 0.032, 'triangle'); },
      clear: function () { sweep(280, 760, 0.26, 0.026, 'sine'); },
      candle: function () {
        tone(392, 0.5, 0.045, 0, 'sine');
        tone(523.25, 0.6, 0.045, 0.1, 'sine');
        tone(659.25, 0.7, 0.04, 0.2, 'sine');
      },
      celebrate: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        for (let i = 0; i < notes.length; i++) {
          tone(notes[i], 0.75, 0.036, i * 0.065, 'triangle');
          tone(notes[i] * 2, 0.35, 0.01, i * 0.065, 'sine');
        }
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class CakeScene extends Phaser.Scene {
    constructor() {
      super('CakeScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT,
        TOPPINGS: TOPPINGS.map(function (t) { return { key: t.key, name: t.name }; }),
        CAKE: Object.assign({}, CAKE), TRAY: Object.assign({}, TRAY, {
          colX: TRAY.colX.slice(), rowY: TRAY.rowY.slice(),
        }),
        CANDLE: Object.assign({}, CANDLE), DEPTH: Object.assign({}, DEPTH),
      };
      this.PALETTE = C;
      this.phase = 'decorate';
      this.finished = false;
      this.decorations = [];
      this.drag = null;
      this.flyBack = null;
      this.activePointerId = null;
      this.liveProps = [];
      this.clock = 0;
      this.nextDecoId = 1;
      this.celebrateShown = false;
      this.candle = null;
      this.ribbonG = null;
      this.banner = null;

      Sound.resume();

      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawBackground(this.worldG);

      this.cakeGlowG = this.add.graphics().setDepth(DEPTH.cake - 0.1).setVisible(false);
      this.cakeGlowG.fillStyle(0xFFF1A6, 0.28).fillEllipse(CAKE.x, CAKE.topY + 54, 430, 360);
      this.cakeGlowG.lineStyle(5, 0xFFFFFF, 0.65).strokeEllipse(CAKE.x, CAKE.topY + 52, 430, 366);

      this.ribbonG = this.add.graphics().setDepth(DEPTH.ribbon).setVisible(false);
      drawRibbons(this.ribbonG);

      this.cakeG = this.add.graphics().setDepth(DEPTH.cake);
      drawCake(this.cakeG);

      this.decoG = this.add.graphics().setDepth(DEPTH.toppings);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.ghostG = this.add.graphics().setDepth(DEPTH.ghost);

      this.buildCandle();
      this.buildUi();
      this.buildTray();

      this.input.on('pointerdown', this.onPointerDown, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointerupoutside', this.onPointerUp, this);
    }

    buildCandle() {
      this.candle = this.add.container(CANDLE.x, CANDLE.y).setDepth(DEPTH.candle).setVisible(false);
      this.candleBodyG = this.add.graphics();
      drawCandleBody(this.candleBodyG);
      this.flameHolder = this.add.container(0, -CANDLE.h - 13);
      this.flameG = this.add.graphics();
      drawCandleFlame(this.flameG);
      this.flameHolder.add(this.flameG);
      this.candle.add([this.candleBodyG, this.flameHolder]);
    }

    buildUi() {
      const L = this.L;
      this.titleText = this.add.text(L.title.x, L.title.y, '彩虹蛋糕屋', {
        fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#7E345F',
        stroke: '#FFF7EF', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.subText = this.add.text(L.subtitle.x, L.subtitle.y, '把配料拖到蛋糕上', {
        fontFamily: FONT, fontSize: '15px', color: '#A05276',
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.finishG = this.add.graphics().setDepth(DEPTH.ui);
      this.finishText = this.add.text(L.finish.x, L.finish.y + 1, '完成啦', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#C1385D', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.drawFinishButton();

      this.ctrlG = this.add.graphics().setDepth(DEPTH.ui);
      drawPill(this.ctrlG, L.undo, 0xFFF7EF, 0xE5A6B9, 0xB65D7B);
      drawPill(this.ctrlG, L.clear, 0xFFF7EF, 0xE5A6B9, 0xB65D7B);
      this.undoText = this.add.text(L.undo.x, L.undo.y, '撤销', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#8A4966',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.clearText = this.add.text(L.clear.x, L.clear.y, '清空', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#8A4966',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.banner = this.add.container(WIDTH / 2, 190).setDepth(DEPTH.banner).setVisible(false);
      const bg = this.add.graphics();
      bg.fillStyle(0xFFFFFF, 0.97).fillRoundedRect(-124, -34, 248, 68, 34);
      bg.lineStyle(4, 0xFF7EB1, 1).strokeRoundedRect(-123, -33, 246, 66, 33);
      drawStar(bg, -90, 0, 14, 0xFFC847, 1, 5);
      drawStar(bg, 90, 0, 14, 0xFFC847, 1, 5);
      const txt = this.add.text(0, 0, '做好啦！', {
        fontFamily: FONT, fontSize: '27px', fontStyle: 'bold', color: '#D14379',
      }).setOrigin(0.5);
      this.banner.add([bg, txt]);
    }

    drawFinishButton() {
      const g = this.finishG;
      const r = this.L.finish;
      g.clear();
      g.fillStyle(0xC33F67, 0.24).fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2 + 6, r.w, r.h, r.h / 2);
      g.fillStyle(0xFF5E86, 1).fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
      g.fillStyle(0xFFA0B7, 0.82).fillRoundedRect(r.x - r.w / 2 + 5, r.y - r.h / 2 + 5, r.w - 10, 21, 11);
      g.lineStyle(3, 0xD53D69, 0.72).strokeRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 2, r.w - 4, r.h - 4, r.h / 2 - 2);
      drawStar(g, r.x - 48, r.y, 9, 0xFFF1A0, 0.95, 5);
    }

    buildTray() {
      this.trayG = this.add.graphics().setDepth(DEPTH.ui - 2);
      drawTray(this.trayG);
      this.toppingG = this.add.graphics().setDepth(DEPTH.ui - 1);
      this.toppingLabels = [];
      for (let i = 0; i < TOPPINGS.length; i++) {
        const cell = this.cellOf(i);
        drawTopping(this.toppingG, TOPPINGS[i].key, cell.x, cell.y + TRAY.iconY, 25, 0);
        const label = this.add.text(cell.x, cell.y + TRAY.labelY, TOPPINGS[i].name, {
          fontFamily: FONT, fontSize: '12px', color: '#8A4966',
        }).setOrigin(0.5).setDepth(DEPTH.ui);
        this.toppingLabels.push(label);
      }
      this.trayHint = this.add.text(this.L.trayHint.x, this.L.trayHint.y, '拖到蛋糕上试试', {
        fontFamily: FONT, fontSize: '12px', color: '#A76E83',
      }).setOrigin(0.5).setDepth(DEPTH.ui);
    }

    cellOf(index) {
      const col = index % 6;
      const row = Math.floor(index / 6);
      return { x: TRAY.colX[col], y: TRAY.rowY[row] };
    }

    // -------------------------------------------------- 落点与装饰
    toppingAt(x, y) {
      for (let i = 0; i < TOPPINGS.length; i++) {
        const cell = this.cellOf(i);
        if (Math.abs(x - cell.x) <= TRAY.cellW / 2 && Math.abs(y - cell.y) <= TRAY.cellH / 2) return TOPPINGS[i].key;
      }
      return null;
    }

    cakeContains(x, y) {
      if (!isFinite(x) || !isFinite(y)) return false;
      const c = CAKE;
      const ex = (x - c.x) / c.topRx;
      const ey = (y - c.topY) / c.topRy;
      if (y >= c.topY - c.topRy && y <= c.topY + c.topRy && ex * ex + ey * ey <= 1) return true;
      if (y >= c.bodyTop && y <= c.bodyBottom) {
        const t = clamp((y - c.bodyTop) / (c.bodyBottom - c.bodyTop), 0, 1);
        const half = lerp(c.topHalfW, c.bottomHalfW, t);
        return Math.abs(x - c.x) <= half;
      }
      return false;
    }

    addTopping(key, x, y) {
      let def = null;
      for (let i = 0; i < TOPPINGS.length; i++) if (TOPPINGS[i].key === key) def = TOPPINGS[i];
      if (!def || !this.cakeContains(x, y)) return false;
      const rot = (pseudo(this.nextDecoId + 3) * 2 - 1) * 0.32;
      this.decorations.push({ id: this.nextDecoId++, key: key, x: x, y: y, rot: rot });
      this.redrawDecorations();
      this.trayHint.setText('真漂亮，再来一点！');
      return true;
    }

    redrawDecorations() {
      this.decoG.clear();
      drawDecorations(this.decoG, this.decorations);
    }

    removeLast() {
      if (!this.decorations.length) return false;
      this.decorations.pop();
      this.redrawDecorations();
      Sound.undo();
      return true;
    }

    clearAll() {
      const had = this.decorations.length > 0;
      this.decorations.length = 0;
      this.redrawDecorations();
      if (had) Sound.clear();
      return had;
    }

    // -------------------------------------------------- 完成 / 重置
    finishCake() {
      if (this.finished) return false;
      this.finished = true;
      this.phase = 'finished';
      this.finishText.setText('再做一块');
      this.ribbonG.setVisible(true);
      this.candle.setVisible(true);
      this.candle.setAlpha(0);
      this.candle.y = CAKE.topY - 130;
      this.candle.setScale(0.82);
      this.tweens.add({
        targets: this.candle, y: CANDLE.y, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 620, ease: 'Back.Out',
      });
      this.flameHolder.setScale(0.2);
      this.tweens.add({
        targets: this.flameHolder, scaleX: 1, scaleY: 1,
        duration: 320, delay: 470, ease: 'Back.Out',
      });

      this.banner.setVisible(true).setAlpha(0).setScale(0.55);
      this.tweens.add({
        targets: this.banner, alpha: 1, scaleX: 1, scaleY: 1,
        duration: 340, delay: 280, ease: 'Back.Out',
      });

      this.spawnConfetti(88);
      this.celebrateShown = true;
      Sound.candle();
      Sound.celebrate();
      return true;
    }

    resetCake() {
      this.tweens.killTweensOf(this.candle);
      this.tweens.killTweensOf(this.flameHolder);
      this.tweens.killTweensOf(this.banner);
      this.phase = 'decorate';
      this.finished = false;
      this.decorations.length = 0;
      this.redrawDecorations();
      this.drag = null;
      this.flyBack = null;
      this.activePointerId = null;
      this.ghostG.clear();
      this.cakeGlowG.setVisible(false);

      this.ribbonG.setVisible(false);
      this.candle.setVisible(false);
      this.candle.y = CANDLE.y;
      this.candle.setAlpha(1).setScale(1);
      this.flameHolder.setScale(1);
      this.banner.setVisible(false).setAlpha(0).setScale(1);
      this.finishText.setText('完成啦');
      this.trayHint.setText('拖到蛋糕上试试');

      this.liveProps.length = 0;
      this.fxG.clear();
      this.celebrateShown = false;
      return true;
    }

    // -------------------------------------------------- 彩纸
    spawnConfetti(count) {
      const n = Math.max(80, count || 88);
      for (let i = 0; i < n; i++) {
        const fromTop = i % 5 === 0;
        this.liveProps.push({
          x: fromTop ? 20 + Math.random() * (WIDTH - 40) : CAKE.x + (Math.random() * 2 - 1) * 150,
          y: fromTop ? -30 - Math.random() * 160 : 205 + Math.random() * 110,
          vx: (Math.random() * 2 - 1) * 190,
          vy: -160 + Math.random() * 210,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 9,
          size: 5 + Math.random() * 8,
          color: CONFETTI[i % CONFETTI.length],
          life: 2.1 + Math.random() * 1.8,
          maxLife: 3.9,
        });
      }
    }

    updateConfetti(dt) {
      this.fxG.clear();
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const p = this.liveProps[i];
        p.life -= dt;
        p.vy += 420 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.life <= 0 || p.y > HEIGHT + 50) {
          this.liveProps.splice(i, 1);
          continue;
        }
        const a = clamp(p.life / 0.7, 0, 1);
        const co = Math.cos(p.rot), si = Math.sin(p.rot), h = p.size / 2;
        this.fxG.fillStyle(p.color, a);
        fillPoly(this.fxG, [
          [p.x + co * -h - si * -h, p.y + si * -h + co * -h],
          [p.x + co * h - si * -h, p.y + si * h + co * -h],
          [p.x + co * h - si * h, p.y + si * h + co * h],
          [p.x + co * -h - si * h, p.y + si * -h + co * h],
        ]);
      }
    }

    // -------------------------------------------------- 拖动
    onPointerDown(pointer) {
      if (this.activePointerId != null) return false;
      Sound.resume();
      const x = pointer.x, y = pointer.y;
      if (containsRect(this.L.finish, x, y)) {
        if (this.finished) this.resetCake(); else this.finishCake();
        return true;
      }
      if (containsRect(this.L.undo, x, y)) { this.removeLast(); return true; }
      if (containsRect(this.L.clear, x, y)) { this.clearAll(); return true; }
      const key = this.toppingAt(x, y);
      if (!key) return false;
      this.activePointerId = pointer.id == null ? 1 : pointer.id;
      this.drag = { key: key, x: x, y: y };
      Sound.pick();
      this.renderDrag();
      return true;
    }

    onPointerMove(pointer) {
      if (!this.drag || this.activePointerId !== (pointer.id == null ? 1 : pointer.id)) return;
      this.drag.x = pointer.x;
      this.drag.y = pointer.y;
      this.renderDrag();
    }

    onPointerUp(pointer) {
      if (this.activePointerId !== (pointer.id == null ? 1 : pointer.id)) return;
      if (this.drag) {
        const d = this.drag;
        const x = pointer.x == null ? d.x : pointer.x;
        const y = pointer.y == null ? d.y : pointer.y;
        this.drag = null;
        this.activePointerId = null;
        this.cakeGlowG.setVisible(false);
        if (this.cakeContains(x, y)) {
          this.addTopping(d.key, x, y);
          this.ghostG.clear();
          Sound.drop();
        } else {
          this.flyBack = { key: d.key, x: d.x, y: d.y, t: 0, dur: 0.24 };
          Sound.drop();
        }
      } else {
        this.activePointerId = null;
      }
    }

    renderDrag() {
      this.ghostG.clear();
      if (this.drag) {
        const x = this.drag.x, y = this.drag.y;
        const good = this.cakeContains(x, y);
        this.cakeGlowG.setVisible(good);
        drawTopping(this.ghostG, this.drag.key, x, y - 10, 25 * 1.12, -0.1);
        this.ghostG.lineStyle(3, good ? 0xFFFFFF : 0xFFC5D4, good ? 0.95 : 0.65).strokeCircle(x, y - 10, 33);
      } else if (this.flyBack) {
        const f = this.flyBack;
        const t = clamp(f.t / f.dur, 0, 1);
        const idx = TOPPINGS.findIndex(function (d) { return d.key === f.key; });
        const cell = this.cellOf(idx < 0 ? 0 : idx);
        drawTopping(this.ghostG, f.key, lerp(f.x, cell.x, t), lerp(f.y, cell.y + TRAY.iconY, t) - 10, 25, 0);
      }
    }

    // -------------------------------------------------- 动画
    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.1);
      this.clock += dt;

      if (this.flyBack) {
        this.flyBack.t += dt;
        if (this.flyBack.t >= this.flyBack.dur) this.flyBack = null;
        this.renderDrag();
      }

      if (this.finished) {
        const sway = Math.sin(this.clock * 7.2) * 0.1;
        this.flameHolder.rotation = sway;
        this.flameHolder.setScale(1 + Math.sin(this.clock * 9.5) * 0.055, 1 + Math.cos(this.clock * 8.1) * 0.045);
        this.flameG.alpha = 0.86 + Math.sin(this.clock * 12.7) * 0.12;
      }
      this.updateConfetti(dt);
      if (this.drag) this.cakeGlowG.setAlpha(0.7 + Math.sin(this.clock * 8) * 0.2);
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

  function containsRect(r, x, y) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }

  window.CakeScene = CakeScene;
})();
