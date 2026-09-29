(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  // 只做竖屏：横屏时由 FIT 缩放居中显示同一版竖屏画面
  const WIDTH = 540;
  const HEIGHT = 960;
  const STORE_KEY = 'kitty-flower-v1';

  const C = {
    wall: 0xFDF6EC,
    wallTop: 0xF6E7D6,
    window: 0xD8EDF8,
    windowFrame: 0xBBD9EA,
    cloud: 0xFFFFFF,
    desk: 0xE9D2AE,
    deskTop: 0xF4E4C9,
    deskShade: 0xD9BC92,
    vase: 0xBFDDE9,
    vaseDark: 0x8FB9D3,
    vaseLight: 0xE8F5FB,
    leaf: 0x8FC46A,
    leafDark: 0x6A9E49,
    sun: 0xFFE9C2,
  };

  const CAT = {
    body: 0xF4C68C,
    dark: 0xDDA05A,
    pale: 0xFCE3C2,
    blush: 0xF2A69E,
    line: 0x8A5A2B,
  };

  // 花材：形状 × 配色，全部程序化绘制，不加载任何外部素材
  const FLOWERS = [
    { kind: 'daisy', petal: 0xF7A8C4, center: 0xFFE7A3, n: 8 },
    { kind: 'daisy', petal: 0xFDF6E8, center: 0xFFD75E, n: 9 },
    { kind: 'tulip', petal: 0xF0885E, center: 0xF7C39D },
    { kind: 'tulip', petal: 0xB49CF0, center: 0xD8C8FB },
    { kind: 'rose', petal: 0xE87BA8, center: 0xC4577F },
    { kind: 'pom', petal: 0x92C9EA, center: 0xC6E3F4 },
  ];

  // 插花槽位：从正中间往两边铺开，奇偶交错做出前后层次
  const SLOT_ORDER = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  const SLOT_COUNT = SLOT_ORDER.length;

  // 五声音阶，第 n 朵花取第 n 个音，插满刚好是一段上行旋律
  const NOTES = [261.63, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

  const DEPTH = { backdrop: 0, cat: 8, stem: 12, vase: 20, head: 30, petalFall: 46, drag: 60, tray: 70, ui: 80 };

  function computeLayout() {
    const trayH = 176;
    const deskY = 640;
    const vaseH = 210;
    return {
      trayH: trayH,
      trayTop: HEIGHT - trayH,
      deskY: deskY,
      vase: { cx: 296, baseY: deskY, h: vaseH, lipW: 62, lipY: deskY - vaseH },
      cat: { x: 96, y: deskY + 6, scale: 0.95, walkMin: 72, walkMax: 300, sniffX: 178 },
      flowerH: 175,
      flowerR: 32,
      slotSpread: 64,
      lift: 54,
      traySlotW: Math.min(WIDTH / FLOWERS.length, 104),
    };
  }

  function slotAt(i, L) {
    const k = SLOT_ORDER[i];
    const t = k / 4;
    const alt = Math.abs(k) % 2 === 1 ? (k < 0 ? 1 : -1) : 0;
    return {
      k: k,
      x: L.vase.cx + t * L.slotSpread,
      y: L.vase.lipY - L.flowerH * (1 - 0.38 * t * t + 0.12 * alt),
      lean: t * 0.42,
      scale: 1 - 0.12 * Math.abs(t),
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
  function rotPts(pts, ang, ox, oy) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      out[i] = { x: ox + p.x * c - p.y * s, y: oy + p.x * s + p.y * c };
    }
    return out;
  }

  // 花瓣：从根部 (0,0) 向上长到 (0,-len) 的饱满叶片形
  function petalPoints(len, wid, steps) {
    const s = steps || 12;
    const pts = [];
    for (let i = 0; i <= s; i++) {
      const t = i / s, mt = 1 - t;
      pts.push({ x: 2 * mt * t * wid, y: -(2 * mt * t * 0.36 + t * t) * len });
    }
    for (let i = s - 1; i >= 0; i--) {
      const t = i / s, mt = 1 - t;
      pts.push({ x: -2 * mt * t * wid, y: -(2 * mt * t * 0.36 + t * t) * len });
    }
    return pts;
  }

  function arcPts(cx, cy, r, a0, a1, steps) {
    const n = steps || 12;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }

  function cubicPts(p0, c1, c2, p3, steps) {
    const n = steps || 18;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      out.push({
        x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
        y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
      });
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

  // ---------------------------------------------------------------- 花的绘制
  function drawFlowerHead(g, def, R) {
    const petal = def.petal;
    const edge = darken(petal, 0.24);

    if (def.kind === 'daisy') {
      const n = def.n || 8;
      const shape = petalPoints(R * 1.04, R * 0.42, 10);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.22;
        const pts = rotPts(shape, a, 0, 0);
        g.fillStyle(i % 2 ? petal : lighten(petal, 0.14), 1);
        fillPts(g, pts);
        g.lineStyle(1.6, edge, 0.5);
        strokePts(g, pts, true);
      }
      g.fillStyle(def.center, 1);
      g.fillCircle(0, 0, R * 0.42);
      g.lineStyle(1.8, darken(def.center, 0.28), 0.6);
      g.strokeCircle(0, 0, R * 0.42);
      return;
    }

    if (def.kind === 'tulip') {
      const shape = petalPoints(R * 1.14, R * 0.74, 12);
      const order = [-0.44, 0.44, 0];
      for (let i = 0; i < order.length; i++) {
        const pts = rotPts(shape, order[i], 0, 0);
        g.fillStyle(i === 2 ? lighten(petal, 0.18) : petal, 1);
        fillPts(g, pts);
        g.lineStyle(1.8, edge, 0.45);
        strokePts(g, pts, true);
      }
      return;
    }

    if (def.kind === 'rose') {
      const rings = [
        [1.0, 10, R * 0.30, petal],
        [0.74, 8, R * 0.26, lighten(petal, 0.16)],
        [0.46, 6, R * 0.22, lighten(petal, 0.32)],
      ];
      for (let ri = 0; ri < rings.length; ri++) {
        const rf = rings[ri][0], n = rings[ri][1], rr = rings[ri][2], col = rings[ri][3];
        g.fillStyle(col, 1);
        g.lineStyle(1.4, edge, 0.35);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + ri * 0.62;
          const x = Math.cos(a) * R * rf * 0.62;
          const y = Math.sin(a) * R * rf * 0.62;
          g.fillCircle(x, y, rr);
          g.strokeCircle(x, y, rr);
        }
      }
      g.fillStyle(def.center, 1);
      g.fillCircle(0, 0, R * 0.26);
      return;
    }

    // pom：一团小球
    const n = 17;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const rad = Math.sqrt((i + 0.5) / n) * R * 0.86;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      const rr = R * 0.32 * (1 - 0.35 * (rad / (R * 0.86)));
      g.fillStyle(i % 3 === 0 ? lighten(petal, 0.2) : petal, 1);
      g.fillCircle(x, y, rr);
      g.lineStyle(1.3, edge, 0.35);
      g.strokeCircle(x, y, rr);
    }
    g.fillStyle(def.center, 1);
    g.fillCircle(0, 0, R * 0.24);
  }

  function stemCurve(x0, y0, x1, y1, lean) {
    const dy = y1 - y0;
    const bend = -lean * Math.abs(dy) * 0.18;
    return cubicPts(
      { x: x0, y: y0 },
      { x: x0 + bend * 0.4, y: y0 + dy * 0.42 },
      { x: x1 - bend * 0.6, y: y1 - dy * 0.3 },
      { x: x1, y: y1 },
      16
    );
  }

  function drawStem(g, pts, withLeaves) {
    if (!pts || pts.length < 2) return;
    g.lineStyle(6, C.leafDark, 1);
    strokePts(g, pts, false);
    g.lineStyle(3.4, C.leaf, 1);
    strokePts(g, pts, false);
    if (!withLeaves) return;

    const leaf = petalPoints(24, 11, 8);
    const a1 = pts[Math.floor(pts.length * 0.5)];
    const a2 = pts[Math.floor(pts.length * 0.72)];
    if (a1) {
      const ptsL = rotPts(leaf, Math.PI * 0.76, a1.x, a1.y);
      g.fillStyle(C.leaf, 1);
      fillPts(g, ptsL);
      g.lineStyle(1.4, C.leafDark, 0.7);
      strokePts(g, ptsL, true);
    }
    if (a2) {
      const ptsR = rotPts(leaf, Math.PI * 0.24, a2.x, a2.y);
      g.fillStyle(lighten(C.leaf, 0.1), 1);
      fillPts(g, ptsR);
      g.lineStyle(1.4, C.leafDark, 0.7);
      strokePts(g, ptsR, true);
    }
  }

  // ---------------------------------------------------------------- 花瓶
  function drawVase(g, L) {
    const v = L.vase;
    const cx = v.cx, baseY = v.baseY, h = v.h, lip = v.lipW;
    const belly = lip * 1.62;

    g.fillStyle(0x000000, 0.09);
    g.fillEllipse(cx, baseY + 8, belly * 2.1, 32);

    const profile = [
      [belly * 0.52, 0],
      [belly * 0.80, -h * 0.09],
      [belly * 0.99, -h * 0.28],
      [belly, -h * 0.50],
      [belly * 0.86, -h * 0.70],
      [lip * 1.04, -h * 0.88],
      [lip * 0.86, -h],
    ];
    const half = profile.map(function (p) { return new Phaser.Math.Vector2(cx + p[0], baseY + p[1]); });
    const smooth = new Phaser.Curves.Spline(half).getPoints(44);
    const body = smooth.concat(smooth.slice().reverse().map(function (p) {
      return { x: cx - (p.x - cx), y: p.y };
    }));

    g.fillStyle(C.vase, 1);
    fillPts(g, body);
    g.lineStyle(3, C.vaseDark, 1);
    strokePts(g, body, true);

    // 瓶口内壁
    g.fillStyle(C.vaseDark, 1);
    g.fillEllipse(cx, v.lipY + 2, lip * 1.74, lip * 0.5);
    g.fillStyle(darken(C.vaseDark, 0.22), 1);
    g.fillEllipse(cx, v.lipY + 3, lip * 1.52, lip * 0.38);

    // 瓶底暗部
    g.fillStyle(darken(C.vase, 0.10), 0.45);
    g.fillEllipse(cx, baseY - h * 0.07, belly * 0.88, h * 0.15);

    // 高光
    g.lineStyle(5, C.vaseLight, 0.85);
    strokePts(g, [
      { x: cx - belly * 0.52, y: baseY - h * 0.2 },
      { x: cx - belly * 0.62, y: baseY - h * 0.45 },
      { x: cx - belly * 0.48, y: baseY - h * 0.68 },
      { x: cx - lip * 0.5, y: baseY - h * 0.85 },
    ], false);
  }

  // ---------------------------------------------------------------- 猫
  function catShadow(g, w) {
    g.fillStyle(0x000000, 0.09);
    g.fillEllipse(0, -5, w, 24);
  }

  function catBodySleep(g) {
    catShadow(g, 168);
    const tail = cubicPts({ x: -62, y: -22 }, { x: -106, y: -16 }, { x: -104, y: 6 }, { x: -62, y: 4 }, 16);
    g.lineStyle(15, CAT.dark, 1);
    strokePts(g, tail, false);
    g.lineStyle(11, CAT.body, 1);
    strokePts(g, tail, false);

    // 蜷成一大团
    g.fillStyle(CAT.body, 1);
    g.fillEllipse(0, -40, 158, 88);
    g.lineStyle(3, CAT.dark, 0.5);
    g.strokeEllipse(0, -40, 158, 88);

    // 身上的卷纹
    g.lineStyle(5, CAT.dark, 0.26);
    strokePts(g, arcPts(-56, -30, 36, Math.PI * 0.9, Math.PI * 1.95, 12), false);
    strokePts(g, arcPts(-8, -24, 44, Math.PI * 0.85, Math.PI * 2.0, 12), false);

    // 压在身前的小爪
    g.fillStyle(CAT.pale, 1);
    g.lineStyle(2.5, CAT.dark, 0.4);
    g.fillEllipse(48, -14, 46, 24);
    g.strokeEllipse(48, -14, 46, 24);
  }

  function catHeadSleep(g) {
    // 头搁在身体卷上，闭眼打盹
    catFace(g, 30, -86, 40, 'closed');
  }

  // 圆润小耳朵：短短的贴在头顶，粉色内耳
  function drawCatEars(g, cx, cy, r) {
    const l = [
      { x: cx - r * 0.70, y: cy - r * 0.50 },
      { x: cx - r * 0.50, y: cy - r * 1.24 },
      { x: cx - r * 0.04, y: cy - r * 0.80 },
    ];
    const rr = [
      { x: cx + r * 0.04, y: cy - r * 0.80 },
      { x: cx + r * 0.50, y: cy - r * 1.24 },
      { x: cx + r * 0.70, y: cy - r * 0.50 },
    ];
    g.fillStyle(CAT.body, 1);
    fillPts(g, l);
    fillPts(g, rr);
    g.lineStyle(3, CAT.dark, 0.5);
    strokePts(g, l, true);
    strokePts(g, rr, true);
    g.fillStyle(CAT.blush, 0.55);
    fillPts(g, [
      { x: cx - r * 0.46, y: cy - r * 0.66 },
      { x: cx - r * 0.38, y: cy - r * 1.00 },
      { x: cx - r * 0.14, y: cy - r * 0.74 },
    ]);
    fillPts(g, [
      { x: cx + r * 0.14, y: cy - r * 0.74 },
      { x: cx + r * 0.38, y: cy - r * 1.00 },
      { x: cx + r * 0.46, y: cy - r * 0.66 },
    ]);
  }

  // 小鼻子 + ω 嘴 + 又短又淡的胡须
  function drawCatNose(g, cx, cy, r) {
    const s = r / 35;
    g.fillStyle(CAT.blush, 1);
    fillPts(g, [
      { x: cx - 4.5 * s, y: cy - 2 * s },
      { x: cx + 4.5 * s, y: cy - 2 * s },
      { x: cx, y: cy + 4 * s },
    ]);
    g.lineStyle(2.6, CAT.line, 0.8);
    strokePts(g, arcPts(cx - 4 * s, cy + 5 * s, 4.4 * s, Math.PI * 0.05, Math.PI * 0.8, 8), false);
    strokePts(g, arcPts(cx + 4 * s, cy + 5 * s, 4.4 * s, Math.PI * 0.2, Math.PI * 0.95, 8), false);
    g.lineStyle(2, CAT.dark, 0.38);
    strokePts(g, [{ x: cx - 20 * s, y: cy + 3 * s }, { x: cx - 33 * s, y: cy - 1 * s }], false);
    strokePts(g, [{ x: cx - 20 * s, y: cy + 8 * s }, { x: cx - 32 * s, y: cy + 12 * s }], false);
    strokePts(g, [{ x: cx + 20 * s, y: cy + 3 * s }, { x: cx + 33 * s, y: cy - 1 * s }], false);
    strokePts(g, [{ x: cx + 20 * s, y: cy + 8 * s }, { x: cx + 32 * s, y: cy + 12 * s }], false);
  }

  // 大圆眼 + 高光
  function drawCatEyesOpen(g, cx, cy, spread, rr, look) {
    const dx = spread / 2;
    g.fillStyle(CAT.line, 1);
    g.fillCircle(cx - dx, cy, rr);
    g.fillCircle(cx + dx, cy, rr);
    g.fillStyle(0xFFFFFF, 0.95);
    g.fillCircle(cx - dx + (look ? rr * 0.3 : -rr * 0.3), cy - rr * 0.35, rr * 0.38);
    g.fillCircle(cx + dx + (look ? rr * 0.3 : -rr * 0.3), cy - rr * 0.35, rr * 0.38);
  }

  // 娃娃脸：宽圆脸 + 大眼睛/眯眯眼 + 腮红，四个姿态共用
  function catFace(g, cx, cy, r, expr) {
    drawCatEars(g, cx, cy, r);
    g.fillStyle(CAT.body, 1);
    g.fillEllipse(cx, cy, r * 2.16, r * 2.02);
    g.lineStyle(3, CAT.dark, 0.5);
    g.strokeEllipse(cx, cy, r * 2.16, r * 2.02);
    g.lineStyle(4, CAT.dark, 0.26);
    strokePts(g, arcPts(cx, cy - r * 0.52, r * 0.30, Math.PI * 1.15, Math.PI * 1.85, 8), false);
    g.fillStyle(CAT.blush, 0.5);
    g.fillEllipse(cx - r * 0.64, cy + r * 0.30, r * 0.52, r * 0.34);
    g.fillEllipse(cx + r * 0.64, cy + r * 0.30, r * 0.52, r * 0.34);
    if (expr === 'closed') {
      g.lineStyle(4, CAT.line, 1);
      strokePts(g, arcPts(cx - r * 0.36, cy - r * 0.06, r * 0.20, Math.PI * 0.12, Math.PI * 0.88, 10), false);
      strokePts(g, arcPts(cx + r * 0.36, cy - r * 0.06, r * 0.20, Math.PI * 0.12, Math.PI * 0.88, 10), false);
    } else {
      drawCatEyesOpen(g, cx, cy - r * 0.10, r * 0.72, r * 0.16, true);
    }
    drawCatNose(g, cx, cy + r * 0.30, r);
  }

  function catBodySit(g) {
    catShadow(g, 118);
    const tail = cubicPts({ x: -40, y: -36 }, { x: -88, y: -48 }, { x: -94, y: -4 }, { x: -58, y: -2 }, 16);
    g.lineStyle(14, CAT.dark, 1);
    strokePts(g, tail, false);
    g.lineStyle(10, CAT.body, 1);
    strokePts(g, tail, false);

    // 小小的梨形身子
    g.fillStyle(CAT.body, 1);
    g.fillEllipse(0, -42, 88, 92);
    g.lineStyle(3, CAT.dark, 0.5);
    g.strokeEllipse(0, -42, 88, 92);
    g.fillStyle(lighten(CAT.body, 0.12), 1);
    g.fillEllipse(0, -30, 52, 62);

    // 两只前爪
    g.fillStyle(CAT.pale, 1);
    g.lineStyle(2.5, CAT.dark, 0.4);
    g.fillEllipse(-20, -8, 26, 16);
    g.strokeEllipse(-20, -8, 26, 16);
    g.fillEllipse(20, -8, 26, 16);
    g.strokeEllipse(20, -8, 26, 16);
  }

  function catHeadSit(g) {
    // 大头压在身子上，娃娃比例
    catFace(g, 0, -118, 44, 'open');
  }

  function catBodyWalk(g) {
    catShadow(g, 150);
    const tail = cubicPts({ x: -50, y: -50 }, { x: -92, y: -80 }, { x: -106, y: -44 }, { x: -80, y: -28 }, 16);
    g.lineStyle(13, CAT.dark, 1);
    strokePts(g, tail, false);
    g.lineStyle(9, CAT.body, 1);
    strokePts(g, tail, false);

    // 圆背
    g.fillStyle(CAT.body, 1);
    g.fillEllipse(-8, -58, 118, 74);
    g.lineStyle(3, CAT.dark, 0.5);
    g.strokeEllipse(-8, -58, 118, 74);
    g.lineStyle(5, CAT.dark, 0.26);
    strokePts(g, arcPts(-30, -56, 30, Math.PI * 1.05, Math.PI * 1.95, 10), false);

    // 四条小短腿
    g.fillStyle(CAT.body, 1);
    g.lineStyle(2.5, CAT.dark, 0.4);
    [-52, -26, 18, 42].forEach(function (x) {
      g.fillRoundedRect(x, -30, 17, 32, 8);
      g.strokeRoundedRect(x, -30, 17, 32, 8);
    });
    g.fillStyle(CAT.pale, 1);
    [-52, -26, 18, 42].forEach(function (x) {
      g.fillEllipse(x + 8.5, -1, 15, 8);
    });
  }

  function catHeadWalk(g) {
    catFace(g, 42, -102, 38, 'open');
  }

  function catBodySniff(g) {
    catShadow(g, 132);
    const tail = cubicPts({ x: -44, y: -54 }, { x: -86, y: -90 }, { x: -98, y: -54 }, { x: -72, y: -40 }, 16);
    g.lineStyle(13, CAT.dark, 1);
    strokePts(g, tail, false);
    g.lineStyle(9, CAT.body, 1);
    strokePts(g, tail, false);

    g.fillStyle(CAT.body, 1);
    g.fillEllipse(-8, -50, 106, 60);
    g.lineStyle(3, CAT.dark, 0.5);
    g.strokeEllipse(-8, -50, 106, 60);

    g.fillStyle(CAT.body, 1);
    g.lineStyle(2.5, CAT.dark, 0.4);
    [-46, -24, 6, 28].forEach(function (x) {
      g.fillRoundedRect(x, -26, 15, 28, 7);
      g.strokeRoundedRect(x, -26, 15, 28, 7);
    });
  }

  function catHeadSniff(g) {
    // 低头凑近瓶口
    catFace(g, 54, -76, 36, 'open');
  }

  const CAT_POSE = {
    sleep: { body: catBodySleep, head: catHeadSleep },
    sit: { body: catBodySit, head: catHeadSit },
    walk: { body: catBodyWalk, head: catHeadWalk },
    sniff: { body: catBodySniff, head: catHeadSniff },
  };

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
      if (c && c.state === 'suspended') {
        try { c.resume(); } catch (e) { /* ignore */ }
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
      tone(freq * 2, dur * 0.72, vol * 0.3, when, 'sine');
      tone(freq * 3.01, dur * 0.5, vol * 0.11, when, 'sine');
    }

    return {
      resume: resume,
      plant: function (i) {
        const f = NOTES[i % NOTES.length];
        chime(f, 1.15, 0.15, 0);
        chime(f * 1.5, 0.75, 0.05, 0.05);
      },
      pick: function () { tone(720, 0.11, 0.06, 0, 'triangle'); },
      drop: function () { tone(320, 0.16, 0.05, 0, 'sine'); },
      full: function () {
        [0, 2, 4, 7, 9, 12].forEach(function (semi, i) {
          chime(523.25 * Math.pow(2, semi / 12), 1.5, 0.11, i * 0.085);
        });
      },
      clear: function () {
        for (let i = 0; i < 6; i++) tone(900 - i * 95, 0.2, 0.045, i * 0.045, 'sine');
      },
      meow: function () {
        const c = ensure();
        if (!c) return;
        const t0 = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        const filt = c.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.exponentialRampToValueAtTime(780, t0 + 0.13);
        osc.frequency.exponentialRampToValueAtTime(360, t0 + 0.44);
        filt.type = 'lowpass';
        filt.frequency.value = 1500;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.07);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);
        osc.connect(filt);
        filt.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + 0.58);
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class FlowerScene extends Phaser.Scene {
    constructor() {
      super('FlowerScene');
    }

    create() {
      this.L = computeLayout();
      this.planted = [];
      this.drag = null;
      this.catPose = 'sleep';
      this.catTimer = null;
      this.catRoot = null;
      this.celebrated = false;

      Sound.resume();

      this.buildBackdrop();

      this.catRoot = this.add.container(this.L.cat.x, this.L.cat.y).setDepth(DEPTH.cat);
      this.catInner = this.add.container(0, 0);
      this.catBody = this.add.graphics();
      this.catHead = this.add.graphics();
      this.catInner.add([this.catBody, this.catHead]);
      this.catRoot.add(this.catInner);
      this.catRoot.setScale(this.L.cat.scale);
      this.paintCat('sleep', 1);

      this.buildVase();
      this.buildTray();
      this.buildClearButton();
      this.bindInput();
      this.restore();

      this.tweens.add({
        targets: this.catInner,
        scaleY: { from: 1, to: 1.035 },
        scaleX: { from: 1, to: 1.012 },
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });

      this.scheduleCat(2200 + Math.random() * 1800);
    }

    // -------------------------------------------------- 背景
    buildBackdrop() {
      const L = this.L;
      const g = this.add.graphics().setDepth(DEPTH.backdrop);
      g.fillStyle(C.wall, 1);
      g.fillRect(0, 0, WIDTH, HEIGHT);

      g.fillStyle(C.wallTop, 0.55);
      g.fillEllipse(WIDTH * 0.5, -HEIGHT * 0.12, WIDTH * 1.6, HEIGHT * 0.5);

      // 窗
      const wx = 58, wy = 96, ww = 142, wh = 128;
      g.fillStyle(C.windowFrame, 1);
      g.fillRoundedRect(wx - 8, wy - 8, ww + 16, wh + 16, 14);
      g.fillStyle(C.window, 1);
      g.fillRoundedRect(wx, wy, ww, wh, 8);
      g.fillStyle(C.cloud, 0.85);
      g.fillEllipse(wx + ww * 0.34, wy + wh * 0.42, ww * 0.44, wh * 0.32);
      g.fillEllipse(wx + ww * 0.58, wy + wh * 0.36, ww * 0.34, wh * 0.26);
      g.fillStyle(C.windowFrame, 1);
      g.fillRect(wx + ww * 0.5 - 3, wy, 6, wh);
      g.fillRect(wx, wy + wh * 0.5 - 3, ww, 6);
      g.lineStyle(4, C.windowFrame, 1);
      g.strokeRoundedRect(wx, wy, ww, wh, 8);

      // 桌面
      g.fillStyle(C.desk, 1);
      g.fillRect(0, L.deskY, WIDTH, HEIGHT - L.deskY);
      g.fillStyle(C.deskTop, 1);
      g.fillRect(0, L.deskY - 7, WIDTH, 10);
      g.fillStyle(C.deskShade, 0.35);
      g.fillRect(0, L.deskY - 7, WIDTH, 3);

      // 暖光
      g.fillStyle(C.sun, 0.22);
      g.fillCircle(WIDTH * 0.88, HEIGHT * 0.08, 130);
      g.fillStyle(C.sun, 0.18);
      g.fillCircle(WIDTH * 0.88, HEIGHT * 0.08, 88);
    }

    buildVase() {
      const g = this.add.graphics().setDepth(DEPTH.vase);
      drawVase(g, this.L);
    }

    // -------------------------------------------------- 道具栏
    buildTray() {
      const L = this.L;
      const layer = this.add.container(0, 0).setDepth(DEPTH.tray);

      const board = this.add.graphics();
      board.fillStyle(0xFFFFFF, 0.78);
      board.fillRoundedRect(6, L.trayTop + 10, WIDTH - 12, L.trayH - 20, 28);
      board.lineStyle(2.5, 0xEBD8BC, 1);
      board.strokeRoundedRect(6, L.trayTop + 10, WIDTH - 12, L.trayH - 20, 28);
      layer.add(board);

      const n = FLOWERS.length;
      const slotW = L.traySlotW;
      const totalW = slotW * n;
      const startX = (WIDTH - totalW) / 2;
      const cy = L.trayTop + L.trayH / 2 + 4;
      const r = Math.min(slotW * 0.30, L.trayH * 0.26);

      this.trayItems = [];

      for (let i = 0; i < n; i++) {
        const def = FLOWERS[i];
        const cx = startX + slotW * (i + 0.5);

        const stem = this.add.graphics();
        const pts = [];
        for (let t = 0; t <= 1.001; t += 0.1) {
          pts.push({ x: cx + Math.sin(t * 1.3) * 4, y: cy + r * 0.75 + t * r * 1.05 });
        }
        stem.lineStyle(4.5, C.leafDark, 1);
        strokePts(stem, pts, false);
        stem.lineStyle(2.4, C.leaf, 1);
        strokePts(stem, pts, false);
        layer.add(stem);

        const head = this.add.graphics({ x: cx, y: cy });
        drawFlowerHead(head, def, r);
        layer.add(head);

        const hit = this.add.rectangle(cx, cy, slotW - 6, L.trayH - 30, 0xffffff, 0);
        hit.setInteractive({ useHandCursor: true });
        layer.add(hit);

        const item = { def: def, head: head, stem: stem, hit: hit, cx: cx, cy: cy, r: r };
        this.trayItems.push(item);

        hit.on('pointerdown', this.onTrayDown.bind(this, item));
      }

      this.trayLayer = layer;
    }

    // -------------------------------------------------- 清空按钮
    buildClearButton() {
      const L = this.L;
      const r = 30;
      const cx = WIDTH - r - 22;
      const cy = L.trayTop - r - 16;

      const g = this.add.graphics().setDepth(DEPTH.ui);
      g.fillStyle(0xFFFFFF, 0.88);
      g.fillCircle(cx, cy, r);
      g.lineStyle(2.5, 0xE5C9A8, 1);
      g.strokeCircle(cx, cy, r);

      const icon = this.add.graphics().setDepth(DEPTH.ui + 0.1);
      icon.lineStyle(4, 0xD89A6A, 1);
      strokePts(icon, arcPts(cx, cy + 1, r * 0.42, Math.PI * 0.92, Math.PI * 2.32, 18), false);
      const tipX = cx + r * 0.42 * Math.cos(Math.PI * 0.92);
      const tipY = cy + 1 + r * 0.42 * Math.sin(Math.PI * 0.92);
      icon.fillStyle(0xD89A6A, 1);
      fillPts(icon, [
        { x: tipX - r * 0.16, y: tipY - r * 0.05 },
        { x: tipX + r * 0.17, y: tipY - r * 0.16 },
        { x: tipX + r * 0.03, y: tipY + r * 0.19 },
      ]);

      const hit = this.add.circle(cx, cy, r + 6, 0xffffff, 0)
        .setDepth(DEPTH.ui + 1)
        .setInteractive(new Phaser.Geom.Circle(r + 6, r + 6, r + 6), Phaser.Geom.Circle.Contains);
      hit.on('pointerdown', () => this.clearAll());

      this.clearBtn = { g: g, icon: icon, hit: hit, cx: cx, cy: cy, r: r, hitRadius: r + 6 };
    }

    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointermove', (p) => this.onMove(p));
      this.input.on('pointerup', (p) => this.onUp(p));
      this.input.on('pointerupoutside', (p) => this.onUp(p));
    }

    onTrayDown(item, pointer) {
      Sound.resume();
      if (this.drag) return;

      this.tweens.add({
        targets: item.head,
        scaleX: { from: 1, to: 1.14 },
        scaleY: { from: 1, to: 1.14 },
        duration: 110,
        yoyo: true,
        ease: 'Sine.InOut',
      });

      if (this.planted.length >= SLOT_COUNT) {
        this.tweens.add({
          targets: item.head,
          x: { from: item.cx - 5, to: item.cx + 5 },
          duration: 60,
          yoyo: true,
          repeat: 3,
          onComplete: () => item.head.setX(item.cx),
        });
        Sound.drop();
        return;
      }

      const f = this.makeDragFlower(item.def, pointer.x, pointer.y - this.L.lift);
      this.drag = { def: item.def, item: item, flower: f, id: pointer.id };
      Sound.pick();
    }

    makeDragFlower(def, x, y) {
      const L = this.L;
      const R = L.flowerR;
      const cont = this.add.container(x, y).setDepth(DEPTH.drag);
      const stem = this.add.graphics();
      const head = this.add.graphics({ x: 0, y: -R * 0.4 });
      cont.add([stem, head]);
      drawFlowerHead(head, def, R);
      const pts = stemCurve(0, R * 0.7, 0, R * 4.1, 0);
      drawStem(stem, pts, true);
      cont.setScale(1.08);
      return { cont: cont, stem: stem, head: head, def: def, R: R };
    }

    onMove(pointer) {
      const d = this.drag;
      if (!d || pointer.id !== d.id) return;
      d.flower.cont.setPosition(pointer.x, pointer.y - this.L.lift);
    }

    onUp(pointer) {
      const d = this.drag;
      if (!d || pointer.id !== d.id) return;
      this.drag = null;

      const f = d.flower;
      if (this.overVase(pointer.x, pointer.y)) {
        this.plantAt(f.cont.x, f.cont.y, d.def, true);
        f.cont.destroy();
      } else {
        this.tweens.add({
          targets: f.cont,
          x: d.item.cx,
          y: d.item.cy - 20,
          scale: 0.4,
          alpha: 0,
          duration: 240,
          ease: 'Sine.In',
          onComplete: () => f.cont.destroy(),
        });
        Sound.drop();
      }
    }

    // 落点判定：对 4-5 岁要放得很宽
    overVase(x, y) {
      const v = this.L.vase;
      const halfW = v.lipW * 2.6;
      const top = v.lipY - this.L.flowerH - 60;
      const bottom = v.lipY + this.L.flowerH * 0.6;
      return x > v.cx - halfW && x < v.cx + halfW && y > top && y < bottom;
    }

    // -------------------------------------------------- 插花
    plantAt(fromX, fromY, def, animate) {
      const L = this.L;
      const idx = this.planted.length;
      if (idx >= SLOT_COUNT) return;

      const slot = slotAt(idx, L);
      const R = L.flowerR * slot.scale * Phaser.Math.FloatBetween(0.94, 1.06);
      const bx = L.vase.cx + slot.k * (L.vase.lipW * 0.06);
      const by = L.vase.baseY - L.vase.h * 0.30;

      const stem = this.add.graphics();
      const head = this.add.graphics();
      const rec = {
        def: def, slot: slot, head: head, stem: stem, R: R,
        bx: bx, by: by, x: slot.x, y: slot.y, lean: slot.lean,
      };

      const paintHead = (px, py, lean) => {
        head.clear();
        head.setPosition(px, py);
        head.setRotation(lean);
        drawFlowerHead(head, def, R);
      };
      const paintStem = (px, py, lean) => {
        stem.clear();
        drawStem(stem, stemCurve(bx, by, px, py, lean), true);
      };

      if (!animate) {
        paintHead(slot.x, slot.y, slot.lean);
        paintStem(slot.x, slot.y, slot.lean);
        stem.setDepth(DEPTH.stem + idx * 0.1);
        head.setDepth(DEPTH.head + idx * 0.1);
        this.planted.push(rec);
        this.afterPlant();
        return;
      }

      stem.setDepth(DEPTH.stem + idx * 0.1);
      head.setDepth(DEPTH.head + idx * 0.1);
      this.planted.push(rec);
      paintStem(fromX, fromY, 0);
      paintHead(fromX, fromY, 0);

      const obj = { t: 0 };
      this.tweens.add({
        targets: obj,
        t: 1,
        duration: 430,
        ease: 'Back.Out',
        onUpdate: () => {
          const px = Phaser.Math.Linear(fromX, slot.x, obj.t);
          const py = Phaser.Math.Linear(fromY, slot.y, obj.t);
          const lean = slot.lean * obj.t;
          paintStem(px, py, lean);
          paintHead(px, py, lean);
        },
        onComplete: () => {
          paintStem(slot.x, slot.y, slot.lean);
          paintHead(slot.x, slot.y, slot.lean);
          this.afterPlant();
        },
      });
    }

    afterPlant() {
      Sound.plant(this.planted.length - 1);
      if (this.planted.length >= SLOT_COUNT) this.celebrateFull();
      this.save();
    }

    celebrateFull() {
      if (this.celebrated) return;
      this.celebrated = true;

      this.planted.forEach((p, i) => {
        this.tweens.add({
          targets: p.head,
          rotation: { from: p.slot.lean, to: p.slot.lean + 0.075 },
          duration: 190,
          yoyo: true,
          repeat: 3,
          delay: i * 55,
          ease: 'Sine.InOut',
          onComplete: () => p.head.setRotation(p.slot.lean),
        });
      });

      this.time.delayedCall(420, () => {
        Sound.full();
        this.petalsFall();
      });
      this.time.delayedCall(700, () => this.forceSniff());
      this.time.delayedCall(2600, () => {
        this.tweens.add({
          targets: this.planted.map((p) => p.head),
          scaleX: { from: 1, to: 1.06 },
          scaleY: { from: 1, to: 1.06 },
          duration: 260,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.InOut',
        });
      });
    }

    petalsFall() {
      const L = this.L;
      if (!this.planted.length) return;
      for (let i = 0; i < 12; i++) {
        const src = this.planted[Math.floor(Math.random() * this.planted.length)];
        const g = this.add.graphics().setDepth(DEPTH.petalFall);
        g.fillStyle(src.def.petal, 0.95);
        fillPts(g, petalPoints(L.flowerR * 0.62, L.flowerR * 0.26, 8));
        g.setPosition(src.slot.x + Phaser.Math.Between(-26, 26), src.slot.y + Phaser.Math.Between(-10, 14));
        this.tweens.add({
          targets: g,
          x: g.x + Phaser.Math.Between(-70, 70),
          y: g.y + Phaser.Math.Between(120, 300),
          rotation: Phaser.Math.FloatBetween(-3.2, 3.2),
          alpha: 0,
          duration: 1700 + Math.random() * 1300,
          delay: i * 95,
          ease: 'Sine.In',
          onComplete: () => g.destroy(),
        });
      }
    }

    clearAll() {
      if (!this.planted.length) return;
      Sound.resume();
      const list = this.planted;
      this.planted = [];
      this.celebrated = false;
      list.forEach((p, i) => {
        this.tweens.add({
          targets: p.stem,
          alpha: 0,
          duration: 320,
          delay: i * 38,
          onComplete: () => p.stem.destroy(),
        });
        this.tweens.add({
          targets: p.head,
          alpha: 0,
          scaleX: 0.45,
          scaleY: 0.45,
          duration: 320,
          delay: i * 38,
          onComplete: () => p.head.destroy(),
        });
      });
      Sound.clear();
      this.save();
    }

    // -------------------------------------------------- 猫
    paintCat(pose, dir) {
      const p = CAT_POSE[pose] || CAT_POSE.sleep;
      this.catBody.clear();
      this.catHead.clear();
      p.body(this.catBody);
      p.head(this.catHead);
      this.catPose = pose;
      if (dir) {
        this.catRoot.setScale(dir * this.L.cat.scale, this.L.cat.scale);
      }
    }

    scheduleCat(delay) {
      if (this.catTimer) this.catTimer.remove();
      this.catTimer = this.time.delayedCall(delay, () => this.catTick());
    }

    catTick() {
      this.catTimer = null;
      const r = Math.random();
      if (r < 0.30) return this.doCat('sleep');
      if (r < 0.52) return this.doCat('sit');
      if (r < 0.86) return this.doWalk();
      return this.doSniff();
    }

    doCat(pose) {
      const dir = this.catRoot.scaleX < 0 ? -1 : 1;
      this.paintCat(pose, dir);
      if (pose === 'sleep' && Math.random() < 0.4) {
        this.time.delayedCall(420, () => Sound.meow());
      }
      const d = pose === 'sleep'
        ? 5200 + Math.random() * 5200
        : 2600 + Math.random() * 2200;
      this.scheduleCat(d);
    }

    doWalk() {
      const c = this.L.cat;
      const cur = this.catRoot.x;
      const dir = Math.random() < 0.5 ? -1 : 1;
      let tx = cur + dir * (90 + Math.random() * 170);
      tx = Phaser.Math.Clamp(tx, c.walkMin, c.walkMax);
      if (Math.abs(tx - cur) < 50) {
        tx = Phaser.Math.Clamp(cur - dir * 150, c.walkMin, c.walkMax);
      }
      this.paintCat('walk', tx > cur ? 1 : -1);
      const dur = Math.abs(tx - cur) * 24 + 260;
      this.tweens.add({
        targets: this.catRoot,
        x: tx,
        duration: dur,
        ease: 'Sine.InOut',
        onComplete: () => {
          if (Math.random() < 0.45) this.doCat('sit');
          else this.doCat('sleep');
        },
      });
    }

    doSniff() {
      const c = this.L.cat;
      const cur = this.catRoot.x;
      const targetX = c.sniffX;
      this.paintCat('walk', targetX > cur ? 1 : -1);
      const dur = Math.abs(targetX - cur) * 22 + 200;
      this.tweens.add({
        targets: this.catRoot,
        x: targetX,
        duration: dur,
        ease: 'Sine.InOut',
        onComplete: () => {
          this.paintCat('sniff', 1);
          if (Math.random() < 0.65) Sound.meow();
          this.tweens.add({
            targets: this.catInner,
            y: { from: 0, to: -7 },
            duration: 760,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.InOut',
          });
          this.scheduleCat(2800 + Math.random() * 1600);
        },
      });
    }

    forceSniff() {
      if (this.catTimer) {
        this.catTimer.remove();
        this.catTimer = null;
      }
      this.tweens.killTweensOf(this.catRoot);
      this.doSniff();
    }

    // -------------------------------------------------- 存档
    save() {
      try {
        const data = this.planted.map(function (p) {
          return { d: FLOWERS.indexOf(p.def), r: Math.round(p.R * 1000) / 1000 };
        });
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (e) { /* 存不了就算了 */ }
    }

    restore() {
      let raw = null;
      try { raw = localStorage.getItem(STORE_KEY); } catch (e) { return; }
      if (!raw) return;
      let list = null;
      try { list = JSON.parse(raw); } catch (e) { return; }
      if (!Array.isArray(list)) return;

      const L = this.L;
      list.slice(0, SLOT_COUNT).forEach((item, idx) => {
        const def = FLOWERS[Number(item.d)];
        if (!def) return;
        const slot = slotAt(idx, L);
        const stored = Number(item.r);
        const R = (stored > L.flowerR * 0.5 && stored < L.flowerR * 1.5)
          ? stored
          : L.flowerR * slot.scale;
        const bx = L.vase.cx + slot.k * (L.vase.lipW * 0.06);
        const by = L.vase.baseY - L.vase.h * 0.30;

        const stem = this.add.graphics().setDepth(DEPTH.stem + idx * 0.1);
        const head = this.add.graphics().setDepth(DEPTH.head + idx * 0.1);
        drawStem(stem, stemCurve(bx, by, slot.x, slot.y, slot.lean), true);
        head.setPosition(slot.x, slot.y);
        head.setRotation(slot.lean);
        drawFlowerHead(head, def, R);

        this.planted.push({
          def: def, slot: slot, head: head, stem: stem, R: R,
          bx: bx, by: by, x: slot.x, y: slot.y, lean: slot.lean,
        });
      });

      if (this.planted.length >= SLOT_COUNT) this.celebrated = true;
    }
  }

  window.FlowerScene = FlowerScene;
})();
