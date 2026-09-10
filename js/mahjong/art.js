/*
 * 麻将美术：用 Canvas2D 程序化烘焙“象牙牌面 + 立体厚度 + 投影”的贴图，
 * 以及带木框、绒布、牌墙的牌桌贴图。不依赖任何外部图片资源。
 */
(function (root) {
  'use strict';

  const RULES = root.MahjongRules;
  const TAU = Math.PI * 2;
  // 贴图按 2 倍分辨率烘焙，显示时缩放 0.5，手机上更锐利
  const TILE = {
    faceW: 104, faceH: 136, thickness: 14, margin: 14, radius: 13,
    texW: 132, texH: 178,
    faceX: 14, faceY: 14,
    bake: 2,
  };
  TILE.baseScale = 0.5;                 // 贴图 2x -> 显示 1x
  TILE.originY = (TILE.faceY + TILE.faceH / 2) / TILE.texH;   // 以“牌面中心”为锚点                 // 贴图 2x -> 显示 1x 的缩放
  TILE.faceDisplayW = TILE.faceW / TILE.bake;
  TILE.faceDisplayH = TILE.faceH / TILE.bake;

  const CJK = '"Kaiti SC","STKaiti","KaiTi","Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';
  const IVORY = '#fbf4e2';
  const INK = '#2c2a32';
  const RED = '#bc3324';
  const DEEP_RED = '#8e2318';
  const GREEN = '#15753f';
  const DEEP_GREEN = '#0f5430';
  const BLUE = '#1f4d9b';
  const DEEP_BLUE = '#153a77';

  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // 雕刻感文字：左上高光 + 右下阴影 + 主体色
  function engravedText(ctx, text, cx, cy, size, color) {
    ctx.save();
    ctx.font = '700 ' + size + 'px ' + CJK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(255,253,244,0.92)';
    ctx.fillText(text, cx - size * 0.026, cy - size * 0.036);
    ctx.fillStyle = 'rgba(72,54,28,0.32)';
    ctx.fillText(text, cx + size * 0.032, cy + size * 0.05);
    ctx.lineWidth = size * 0.05;
    ctx.strokeStyle = color;
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  // 牌身：投影 + 厚度侧面 + 正面
  function drawTileBody(ctx, seed) {
    const M = TILE.margin;
    const w = TILE.faceW;
    const h = TILE.faceH;
    const t = TILE.thickness;
    const rnd = makeRng(seed);

    ctx.save();
    ctx.shadowColor = 'rgba(9,7,3,0.46)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, M, M + 2, w, h + t - 2, TILE.radius + 1);
    ctx.fillStyle = '#b6a279';
    ctx.fill();
    ctx.restore();

    const side = ctx.createLinearGradient(0, M, 0, M + h + t);
    side.addColorStop(0, '#e6d9b8');
    side.addColorStop(0.7, '#d5c59e');
    side.addColorStop(1, '#ab9670');
    roundRect(ctx, M, M + 2, w, h + t - 2, TILE.radius + 1);
    ctx.fillStyle = side;
    ctx.fill();

    const face = ctx.createLinearGradient(M, M, M + w * 0.5, M + h);
    face.addColorStop(0, '#fffdf7');
    face.addColorStop(0.4, '#fbf5e4');
    face.addColorStop(1, '#ecdfc1');
    roundRect(ctx, M, M, w, h, TILE.radius);
    ctx.fillStyle = face;
    ctx.fill();

    // 正面下沿与侧面的接缝阴影，让“厚度”读得出来
    ctx.save();
    roundRect(ctx, M, M, w, h, TILE.radius);
    ctx.clip();
    const seam = ctx.createLinearGradient(0, M + h - 7, 0, M + h + 2);
    seam.addColorStop(0, 'rgba(120,98,58,0)');
    seam.addColorStop(1, 'rgba(86,66,34,0.5)');
    ctx.fillStyle = seam;
    ctx.fillRect(M, M + h - 7, w, 9);
    // 象牙纹路
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 90; i += 1) {
      const x = M + rnd() * w;
      const y = M + rnd() * h;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(180,158,116,0.35)';
      ctx.fillRect(x, y, 1.1, 1.1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 倒角高光
    roundRect(ctx, M + 1.1, M + 1.1, w - 2.2, h - 2.2, TILE.radius - 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    roundRect(ctx, M + 0.5, M + 0.5, w - 1, h - 1, TILE.radius);
    ctx.strokeStyle = 'rgba(150,128,88,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawFacePlate(ctx) {
    const px = TILE.faceX + 8;
    const py = TILE.faceY + 8;
    const pw = TILE.faceW - 16;
    const ph = TILE.faceH - 16;
    roundRect(ctx, px, py, pw, ph, 9);
    const g = ctx.createRadialGradient(px + pw * 0.42, py + ph * 0.34, pw * 0.08, px + pw * 0.5, py + ph * 0.55, pw * 1.05);
    g.addColorStop(0, '#fffef9');
    g.addColorStop(1, '#efe3c6');
    ctx.fillStyle = g;
    ctx.fill();
    roundRect(ctx, px - 1.6, py - 1.6, pw + 3.2, ph + 3.2, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    roundRect(ctx, px + 0.9, py + 0.9, pw - 1.8, ph - 1.8, 8);
    ctx.strokeStyle = 'rgba(158,136,94,0.28)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    return { x: px, y: py, w: pw, h: ph };
  }

  function drawCoin(ctx, x, y, r, color, deep) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, color);
    g.addColorStop(1, deep);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.strokeStyle = deep;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, TAU);
    ctx.fillStyle = '#fdf6e2';
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.12);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.14, 0, TAU);
    ctx.fillStyle = deep;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.42, y - r * 0.44, r * 0.2, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }

  function drawStick(ctx, x, y, w, h) {
    const r = w / 2;
    const cap = h * 0.24;
    const body = ctx.createLinearGradient(x - r, 0, x + r, 0);
    body.addColorStop(0, '#0e5c33');
    body.addColorStop(0.4, '#27a05c');
    body.addColorStop(0.6, '#1d8a4b');
    body.addColorStop(1, '#0d5730');
    roundRect(ctx, x - r, y - h / 2, w, h, r);
    ctx.fillStyle = body;
    ctx.fill();
    const capGrad = ctx.createLinearGradient(x - r, 0, x + r, 0);
    capGrad.addColorStop(0, DEEP_RED);
    capGrad.addColorStop(0.45, '#d4452f');
    capGrad.addColorStop(1, '#8f2015');
    roundRect(ctx, x - r, y - h / 2, w, cap, r);
    ctx.fillStyle = capGrad;
    ctx.fill();
    roundRect(ctx, x - r, y + h / 2 - cap, w, cap, r);
    ctx.fillStyle = capGrad;
    ctx.fill();
    roundRect(ctx, x - r, y - h / 2, w, h, r);
    ctx.strokeStyle = 'rgba(63,26,10,0.55)';
    ctx.lineWidth = Math.max(0.8, w * 0.1);
    ctx.stroke();
    roundRect(ctx, x - r * 0.34, y - h * 0.28, w * 0.24, h * 0.5, w * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x - w * 0.16, y - h * 0.05, w * 0.32, Math.max(1, h * 0.03));
  }

  const DOT_LAYOUT = {
    1: { size: 1, pts: [[0, 0]] },
    2: { size: 0.86, pts: [[0, -0.5], [0, 0.5]] },
    3: { size: 0.74, pts: [[-0.5, -0.5], [0, 0], [0.5, 0.5]] },
    4: { size: 0.72, pts: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] },
    5: { size: 0.66, pts: [[-0.52, -0.52], [0.52, -0.52], [0, 0], [-0.52, 0.52], [0.52, 0.52]] },
    6: { size: 0.6, pts: [[-0.48, -0.66], [0.48, -0.66], [-0.48, 0], [0.48, 0], [-0.48, 0.66], [0.48, 0.66]] },
    7: { size: 0.55, pts: [[-0.62, -0.66], [0, -0.66], [0.62, -0.66], [0, 0], [-0.62, 0.66], [0, 0.66], [0.62, 0.66]] },
    8: { size: 0.5, pts: [[-0.44, -0.72], [0.44, -0.72], [-0.44, -0.24], [0.44, -0.24], [-0.44, 0.24], [0.44, 0.24], [-0.44, 0.72], [0.44, 0.72]] },
    9: { size: 0.55, pts: [[-0.62, -0.62], [0, -0.62], [0.62, -0.62], [-0.62, 0], [0, 0], [0.62, 0], [-0.62, 0.62], [0, 0.62], [0.62, 0.62]] },
  };

  const STICK_LAYOUT = {
    2: { rows: [[2]], },
    3: { rows: [[3]] },
    4: { rows: [[2], [2]] },
    5: { rows: [[2], [1], [2]] },
    6: { rows: [[3], [3]] },
    7: { rows: [[1], [3], [3]] },
    8: { rows: [[4], [4]] },
    9: { rows: [[3], [3], [3]] },
  };

  function drawDots(ctx, plate, n) {
    const layout = DOT_LAYOUT[n];
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    const base = plate.w * 0.5 * layout.size * 0.5;
    const span = layout.size > 0.9 ? 0.42 : 0.46;
    for (let i = 0; i < layout.pts.length; i += 1) {
      const px = cx + layout.pts[i][0] * plate.w * span;
      const py = cy + layout.pts[i][1] * plate.h * span;
      const isCenter = layout.pts[i][0] === 0 && layout.pts[i][1] === 0;
      const useRed = (n === 1) || isCenter;
      drawCoin(ctx, px, py, Math.max(6, base), useRed ? '#d0452c' : BLUE, useRed ? DEEP_RED : DEEP_BLUE);
    }
    if (n === 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.72, 0, TAU);
      ctx.strokeStyle = 'rgba(21,117,63,0.85)';
      ctx.lineWidth = Math.max(2, base * 0.2);
      ctx.stroke();
    }
  }

  function drawSticks(ctx, plate, n) {
    const layout = STICK_LAYOUT[n];
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    const rowCount = layout.rows.length;
    const rowH = plate.h / rowCount;
    const stickH = rowH * 0.8;
    for (let r = 0; r < rowCount; r += 1) {
      const count = layout.rows[r][0];
      const stickW = Math.min(plate.w * 0.2, plate.w / (count * 1.5));
      const spread = plate.w * 0.84;
      const y = cy + (r - (rowCount - 1) / 2) * rowH;
      for (let i = 0; i < count; i += 1) {
        const x = cx + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
        drawStick(ctx, x, y, stickW, stickH);
      }
    }
  }

  // 一条：传统“幺鸡”，一只侧身站立的鸟
  function drawBird(ctx, plate) {
    const u = plate.w / 100;
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2 + 4 * u;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round';

    const feather = (x1, y1, x2, y2, w) => {
      ctx.beginPath();
      ctx.moveTo(x1 * u, y1 * u);
      ctx.quadraticCurveTo((x1 + x2) / 2 * u - 6 * u, (y1 + y2) / 2 * u, x2 * u, y2 * u);
      ctx.lineWidth = w * u;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1d8a4b';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x2 * u, y2 * u, w * u * 0.62, 0, TAU);
      ctx.fillStyle = '#c73f2c';
      ctx.fill();
    };
    feather(-16, 16, -44, 40, 7);
    feather(-14, 20, -30, 50, 7);
    feather(-10, 22, -14, 54, 6);

    const body = ctx.createLinearGradient(-26 * u, -20 * u, 22 * u, 30 * u);
    body.addColorStop(0, '#37b06a');
    body.addColorStop(0.55, '#1d8a4b');
    body.addColorStop(1, '#0f5c33');
    ctx.beginPath();
    ctx.ellipse(0, 6 * u, 21 * u, 27 * u, -0.16, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = 'rgba(9,52,30,0.75)';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-6 * u, 12 * u, 11 * u, 17 * u, -0.35, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-4 * u, 10 * u, 9 * u, 15 * u, -0.3, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();

    const headG = ctx.createRadialGradient(12 * u, -24 * u, 2 * u, 14 * u, -20 * u, 15 * u);
    headG.addColorStop(0, '#4cc47c');
    headG.addColorStop(1, '#17834a');
    ctx.beginPath();
    ctx.arc(14 * u, -20 * u, 13 * u, 0, TAU);
    ctx.fillStyle = headG;
    ctx.fill();
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = 'rgba(9,52,30,0.75)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(24 * u, -22 * u);
    ctx.lineTo(38 * u, -17 * u);
    ctx.lineTo(24 * u, -12 * u);
    ctx.closePath();
    ctx.fillStyle = '#e2a12c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,74,10,0.7)';
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(18 * u, -24 * u, 4 * u, 0, TAU);
    ctx.fillStyle = '#fdf8ea';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19 * u, -24 * u, 2.2 * u, 0, TAU);
    ctx.fillStyle = '#20160c';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8 * u, -32 * u);
    ctx.quadraticCurveTo(14 * u, -42 * u, 21 * u, -34 * u);
    ctx.lineWidth = 3.4 * u;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c73f2c';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-2 * u, 32 * u);
    ctx.lineTo(-1 * u, 44 * u);
    ctx.moveTo(8 * u, 32 * u);
    ctx.lineTo(9 * u, 44 * u);
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = '#e2a12c';
    ctx.stroke();
    ctx.restore();
  }

  function drawFace(ctx, code) {
    const plate = drawFacePlate(ctx);
    const rules = RULES;
    if (rules.isHonor(code)) {
      const idx = code - rules.HONOR_BASE;
      const cx = plate.x + plate.w / 2;
      const cy = plate.y + plate.h / 2;
      if (idx === 6) {                       // 白板：传统空框
        roundRect(ctx, plate.x + 12, plate.y + 14, plate.w - 24, plate.h - 28, 7);
        ctx.strokeStyle = 'rgba(31,77,155,0.9)';
        ctx.lineWidth = 4;
        ctx.stroke();
        roundRect(ctx, plate.x + 12, plate.y + 14, plate.w - 24, plate.h - 28, 7);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        return;
      }
      const text = idx === 4 ? '中' : (idx === 5 ? '發' : rules.HONOR_TEXT[idx]);
      const color = idx === 4 ? RED : (idx === 5 ? GREEN : '');
      engravedText(ctx, text, cx, cy, plate.w * 0.92, color || BLUE);
      if (idx === 4) {
        ctx.beginPath();
        ctx.arc(cx, cy, plate.w * 0.42, 0, TAU);
        ctx.strokeStyle = 'rgba(188,51,36,0.22)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      return;
    }
    const suit = Math.floor(code / 9);
    const rank = code % 9;
    if (suit === 0) {
      const cx = plate.x + plate.w / 2;
      engravedText(ctx, rules.NUMBER_TEXT[rank], cx, plate.y + plate.h * 0.27, plate.w * 0.5, INK);
      engravedText(ctx, '萬', cx, plate.y + plate.h * 0.73, plate.w * 0.56, RED);
      return;
    }
    if (suit === 1) { drawDots(ctx, plate, rank + 1); return; }
    if (rank === 0) { drawBird(ctx, plate); return; }
    drawSticks(ctx, plate, rank + 1);
  }

  function drawBack(ctx) {
    const M = TILE.margin;
    const rnd = makeRng(20240910);
    roundRect(ctx, M + 9, M + 10, TILE.faceW - 18, TILE.faceH - 20, 9);
    const g = ctx.createLinearGradient(0, M, 0, M + TILE.faceH);
    g.addColorStop(0, '#f4ead2');
    g.addColorStop(1, '#e2d3ae');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    roundRect(ctx, M + 9, M + 10, TILE.faceW - 18, TILE.faceH - 20, 9);
    ctx.clip();
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 70; i += 1) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(178,156,112,0.4)';
      ctx.fillRect(M + rnd() * TILE.faceW, M + rnd() * TILE.faceH, 1.1, 1.1);
    }
    ctx.restore();
    roundRect(ctx, M + 11, M + 12, TILE.faceW - 22, TILE.faceH - 24, 8);
    ctx.strokeStyle = 'rgba(150,126,84,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  function makeTileCanvas(code) {
    const canvas = document.createElement('canvas');
    canvas.width = TILE.texW * TILE.bake;
    canvas.height = TILE.texH * TILE.bake;
    const ctx = canvas.getContext('2d');
    ctx.scale(TILE.bake, TILE.bake);
    drawTileBody(ctx, 1000 + code);
    if (code >= 0) drawFace(ctx, code); else drawBack(ctx);
    return canvas;
  }
  function makeRoomCanvas() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size * 0.5, size * 0.36, size * 0.06, size * 0.5, size * 0.5, size * 0.78);
    g.addColorStop(0, '#4a3668');
    g.addColorStop(0.45, '#2a1d40');
    g.addColorStop(1, '#0d0916');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const rnd = makeRng(77);
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.01 + rnd() * 0.03) + ')';
      ctx.fillRect(rnd() * size, rnd() * size, 1.2, 1.2);
    }
    return canvas;
  }

  function makeTableCanvas(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rnd = makeRng(31415);
    const rim = size * 0.085;

    // 木质外框
    roundRect(ctx, 0, 0, size, size, size * 0.05);
    const wood = ctx.createLinearGradient(0, 0, size * 0.6, size);
    wood.addColorStop(0, '#7b4a25');
    wood.addColorStop(0.35, '#63391b');
    wood.addColorStop(0.72, '#8a5a2f');
    wood.addColorStop(1, '#4d2b13');
    ctx.fillStyle = wood;
    ctx.fill();

    ctx.save();
    roundRect(ctx, 0, 0, size, size, size * 0.05);
    ctx.clip();
    for (let i = 0; i < 420; i += 1) {
      const y = rnd() * size;
      const amp = 2 + rnd() * 7;
      const alpha = 0.03 + rnd() * 0.1;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      for (let x = 0; x <= size + 10; x += 32) {
        ctx.lineTo(x, y + Math.sin((x / size) * TAU * (1 + rnd() * 0.4) + i) * amp);
      }
      ctx.strokeStyle = rnd() > 0.45 ? 'rgba(38,20,8,' + alpha + ')' : 'rgba(230,190,140,' + alpha + ')';
      ctx.lineWidth = 0.6 + rnd() * 2.2;
      ctx.stroke();
    }
    // 外沿压暗
    const edge = ctx.createLinearGradient(0, 0, 0, size);
    edge.addColorStop(0, 'rgba(0,0,0,0.35)');
    edge.addColorStop(0.14, 'rgba(0,0,0,0)');
    edge.addColorStop(0.86, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    // 绒布
    const feltX = rim;
    const feltY = rim;
    const feltW = size - rim * 2;
    const feltH = size - rim * 2;
    const felt = ctx.createRadialGradient(size * 0.5, size * 0.46, feltW * 0.08, size * 0.5, size * 0.5, feltW * 0.78);
    felt.addColorStop(0, '#20734b');
    felt.addColorStop(0.55, '#186040');
    felt.addColorStop(1, '#0d3f29');
    roundRect(ctx, feltX, feltY, feltW, feltH, size * 0.03);
    ctx.fillStyle = felt;
    ctx.fill();

    ctx.save();
    roundRect(ctx, feltX, feltY, feltW, feltH, size * 0.03);
    ctx.clip();
    for (let i = 0; i < 26000; i += 1) {
      const x = feltX + rnd() * feltW;
      const y = feltY + rnd() * feltH;
      const a = rnd();
      ctx.fillStyle = a > 0.5 ? 'rgba(255,255,255,' + (0.015 + rnd() * 0.03) + ')' : 'rgba(0,0,0,' + (0.02 + rnd() * 0.05) + ')';
      ctx.fillRect(x, y, 1 + rnd() * 1.4, 1 + rnd() * 1.4);
    }
    // 绒布上的绒线走向
    for (let i = 0; i < 900; i += 1) {
      const x = feltX + rnd() * feltW;
      const y = feltY + rnd() * feltH;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.01 + rnd() * 0.022) + ')';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16);
      ctx.stroke();
    }
    // 内侧阴影
    const inner = ctx.createLinearGradient(0, feltY, 0, feltY + 46);
    inner.addColorStop(0, 'rgba(0,0,0,0.45)');
    inner.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = inner;
    ctx.fillRect(feltX, feltY, feltW, 46);
    const inner2 = ctx.createLinearGradient(feltX, 0, feltX + 46, 0);
    inner2.addColorStop(0, 'rgba(0,0,0,0.35)');
    inner2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = inner2;
    ctx.fillRect(feltX, feltY, 46, feltH);
    const inner3 = ctx.createLinearGradient(size, 0, size - 34, 0);
    inner3.addColorStop(0, 'rgba(0,0,0,0.32)');
    inner3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = inner3;
    ctx.fillRect(size - rim - 34, feltY, 34, feltH);
    const inner4 = ctx.createLinearGradient(0, size, 0, size - 34);
    inner4.addColorStop(0, 'rgba(0,0,0,0.3)');
    inner4.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = inner4;
    ctx.fillRect(feltX, size - rim - 34, feltW, 34);
    // 中央暗纹
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, feltW * 0.31, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, feltW * 0.36, 0, TAU);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 木框内沿的金线
    roundRect(ctx, feltX - 3, feltY - 3, feltW + 6, feltH + 6, size * 0.032);
    const gold = ctx.createLinearGradient(0, 0, size, size);
    gold.addColorStop(0, 'rgba(255,226,150,0.85)');
    gold.addColorStop(0.4, 'rgba(190,146,60,0.7)');
    gold.addColorStop(0.7, 'rgba(255,232,170,0.8)');
    gold.addColorStop(1, 'rgba(150,110,40,0.6)');
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    roundRect(ctx, feltX - 6.5, feltY - 6.5, feltW + 13, feltH + 13, size * 0.035);
    ctx.strokeStyle = 'rgba(30,16,6,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    roundRect(ctx, 1.5, 1.5, size - 3, size - 3, size * 0.05);
    ctx.strokeStyle = 'rgba(255,214,150,0.28)';
    ctx.lineWidth = 3;
    ctx.stroke();
    return canvas;
  }

  const Art = {
    TILE: TILE,
    build: function (scene) {
      if (scene.textures.exists('mj-face-0')) return;
      for (let code = 0; code < RULES.KIND; code += 1) {
        scene.textures.addCanvas('mj-face-' + code, makeTileCanvas(code));
      }
      scene.textures.addCanvas('mj-back', makeTileCanvas(-1));
      scene.textures.addCanvas('mj-table', makeTableCanvas(1024));
      scene.textures.addCanvas('mj-room', makeRoomCanvas());
    },
    faceKey: function (code) { return 'mj-face-' + code; },
    backKey: 'mj-back',
    // 以牌面中心为锚点摆放，布局计算更直观
    place: function (image, x, y, scale) {
      image.setOrigin(0.5, TILE.originY);
      image.setScale(scale === undefined ? TILE.baseScale : scale);
      image.setPosition(x, y);
      return image;
    },
    faceSize: function (scale) {
      const s = scale === undefined ? TILE.baseScale : scale;
      return { w: TILE.faceW * s, h: TILE.faceH * s };
    },
  };
  root.MahjongArt = Art;
})(typeof window !== 'undefined' ? window : this);