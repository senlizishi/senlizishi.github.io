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
  // 圈圈牌 / 条子牌 / 字牌配色，取自参考素材：青竹绿、砖红、藏青
  const DOT_GREEN = '#4b7d55';
  const DOT_GREEN_DEEP = '#2b5236';
  const DOT_RED = '#b2544a';
  const DOT_RED_DEEP = '#82352c';
  const DOT_NAVY = '#3d4a6c';
  const DOT_NAVY_DEEP = '#262f47';
  const DOT_PAIRS = [[DOT_GREEN, DOT_GREEN_DEEP], [DOT_RED, DOT_RED_DEEP], [DOT_NAVY, DOT_NAVY_DEEP]];
  const STICK_GREEN = '#2f7a4a';
  const STICK_GREEN_DEEP = '#17482a';
  const STICK_RED = '#ac4038';
  const STICK_RED_DEEP = '#6f241d';
  const WIND_NAVY = '#2c3a63';

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

  // 雕刻感文字：刀口左上受光 + 凹槽暗影 + 彩色主体，像刻进象牙里
  function engravedText(ctx, text, cx, cy, size, color) {
    ctx.save();
    ctx.font = '700 ' + size + 'px ' + CJK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // 刀口左上受光面
    ctx.fillStyle = 'rgba(255,255,252,0.95)';
    ctx.fillText(text, cx - size * 0.03, cy - size * 0.042);
    // 凹槽里沉下去的暗影
    ctx.fillStyle = 'rgba(58,40,16,0.42)';
    ctx.fillText(text, cx + size * 0.036, cy + size * 0.055);
    // 笔画外沿压一圈深色，把字从底面托起来
    ctx.lineWidth = size * 0.1;
    ctx.strokeStyle = 'rgba(56,38,14,0.24)';
    ctx.strokeText(text, cx + size * 0.016, cy + size * 0.024);
    ctx.lineWidth = size * 0.062;
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

    // 接触阴影：范围大一点、深一点，牌才不会“飘”在桌面上
    ctx.save();
    ctx.shadowColor = 'rgba(8,6,3,0.42)';
    ctx.shadowBlur = 11;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 7;
    roundRect(ctx, M, M + 2, w, h + t - 2, TILE.radius + 1);
    ctx.fillStyle = '#9d8a63';
    ctx.fill();
    ctx.restore();

    // 厚度侧面：上沿受光、下沿吃暗
    const side = ctx.createLinearGradient(0, M, 0, M + h + t);
    side.addColorStop(0, '#fbf5e4');
    side.addColorStop(0.62, '#f0e6cd');
    side.addColorStop(0.88, '#dccdac');
    side.addColorStop(1, '#b7a37c');
    roundRect(ctx, M, M + 2, w, h + t - 2, TILE.radius + 1);
    ctx.fillStyle = side;
    ctx.fill();

    // 正面：象牙底色，左上受光更亮
    const face = ctx.createLinearGradient(M, M, M + w * 0.62, M + h);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(0.32, '#fefaf0');
    face.addColorStop(0.72, '#f8efdb');
    face.addColorStop(1, '#eee2c6');
    roundRect(ctx, M, M, w, h, TILE.radius);
    ctx.fillStyle = face;
    ctx.fill();

    // 正面下沿与侧面的接缝阴影，让“厚度”读得出来
    ctx.save();
    roundRect(ctx, M, M, w, h, TILE.radius);
    ctx.clip();
    const seam = ctx.createLinearGradient(0, M + h - 9, 0, M + h + 2);
    seam.addColorStop(0, 'rgba(120,98,58,0)');
    seam.addColorStop(0.6, 'rgba(96,74,38,0.32)');
    seam.addColorStop(1, 'rgba(70,52,24,0.6)');
    ctx.fillStyle = seam;
    ctx.fillRect(M, M + h - 9, w, 11);
    // 对角反光：象牙的柔和光泽
    const sheen = ctx.createLinearGradient(M, M, M + w * 0.92, M + h * 0.82);
    sheen.addColorStop(0, 'rgba(255,255,255,0.26)');
    sheen.addColorStop(0.42, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(M, M, w, h);
    // 象牙纹路
    ctx.globalAlpha = 0.42;
    for (let i = 0; i < 26; i += 1) {
      const x = M + rnd() * w;
      const y = M + rnd() * h;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.34)' : 'rgba(178,155,112,0.2)';
      ctx.fillRect(x, y, 1.1, 1.1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 倒角：外圈浅、内圈亮，棱角更圆润
    roundRect(ctx, M + 0.6, M + 0.6, w - 1.2, h - 1.2, TILE.radius);
    ctx.strokeStyle = 'rgba(146,122,82,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    roundRect(ctx, M + 1.7, M + 1.7, w - 3.4, h - 3.4, TILE.radius - 1.3);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.7;
    ctx.stroke();
  }

  function drawFacePlate(ctx) {
    const px = TILE.faceX + 8;
    const py = TILE.faceY + 8;
    const pw = TILE.faceW - 16;
    const ph = TILE.faceH - 16;
    roundRect(ctx, px, py, pw, ph, 9);
    const g = ctx.createRadialGradient(px + pw * 0.4, py + ph * 0.3, pw * 0.06, px + pw * 0.5, py + ph * 0.58, pw * 1.1);
    g.addColorStop(0, '#fffefa');
    g.addColorStop(0.62, '#faf3e0');
    g.addColorStop(1, '#ece0c0');
    ctx.fillStyle = g;
    ctx.fill();

    // 内凹：上沿压暗、下沿提亮，牌面像嵌进去的一块
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 9);
    ctx.clip();
    const grooveTop = ctx.createLinearGradient(0, py, 0, py + ph * 0.26);
    grooveTop.addColorStop(0, 'rgba(118,94,52,0.26)');
    grooveTop.addColorStop(1, 'rgba(118,94,52,0)');
    ctx.fillStyle = grooveTop;
    ctx.fillRect(px, py, pw, ph * 0.26);
    const grooveBottom = ctx.createLinearGradient(0, py + ph, 0, py + ph * 0.74);
    grooveBottom.addColorStop(0, 'rgba(255,255,255,0.5)');
    grooveBottom.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grooveBottom;
    ctx.fillRect(px, py + ph * 0.74, pw, ph * 0.26);
    ctx.restore();

    // 外沿亮边 + 内沿暗线
    roundRect(ctx, px - 1.6, py - 1.6, pw + 3.2, ph + 3.2, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    roundRect(ctx, px + 0.4, py + 0.4, pw - 0.8, ph - 0.8, 9);
    ctx.strokeStyle = 'rgba(150,126,82,0.34)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    roundRect(ctx, px + 1.7, py + 1.7, pw - 3.4, ph - 3.4, 8);
    ctx.strokeStyle = 'rgba(158,136,94,0.2)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    return { x: px, y: py, w: pw, h: ph };
  }

  // 圈圈牌：彩色外环 + 内圈小环 + 中心点，做成素材里那种空心“圈”而不是实心球
  function drawCoin(ctx, x, y, r, color, deep) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, TAU);
    ctx.lineWidth = r * 0.44;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.94, 0, TAU);
    ctx.lineWidth = Math.max(0.6, r * 0.1);
    ctx.strokeStyle = deep;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TAU);
    ctx.lineWidth = Math.max(0.5, r * 0.08);
    ctx.strokeStyle = 'rgba(120,98,58,0.26)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.29, 0, TAU);
    ctx.lineWidth = Math.max(0.8, r * 0.15);
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.12, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  // 条子（竹）：细长青竹，两头圆、两道竹节、中间一道浅芯；红色那一根用砖红
  function drawStick(ctx, x, y, w, h, red) {
    const r = Math.min(w / 2, h * 0.16);
    const main = red ? STICK_RED : STICK_GREEN;
    const deep = red ? STICK_RED_DEEP : STICK_GREEN_DEEP;
    const light = red ? '#d4786c' : '#78b489';
    const body = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    body.addColorStop(0, deep);
    body.addColorStop(0.3, main);
    body.addColorStop(0.5, light);
    body.addColorStop(0.7, main);
    body.addColorStop(1, deep);
    roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = deep;
    ctx.lineWidth = Math.max(0.7, w * 0.14);
    ctx.lineCap = 'round';
    for (let k = 1; k <= 2; k += 1) {
      const ny = y - h / 2 + (h * k) / 3;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.32, ny);
      ctx.lineTo(x + w * 0.32, ny);
      ctx.stroke();
    }
    roundRect(ctx, x - w * 0.15, y - h * 0.33, w * 0.3, h * 0.66, w * 0.15);
    ctx.fillStyle = red ? 'rgba(255,226,214,0.4)' : 'rgba(232,255,238,0.48)';
    ctx.fill();
    roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
    ctx.lineWidth = Math.max(0.8, w * 0.13);
    ctx.strokeStyle = deep;
    ctx.stroke();
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

  // 每行几根竹节；1 表示这一根是砖红色（素材里只有中间/顶部那几根是红的）
  const STICK_LAYOUT = {
    2: { rows: [[0, 0]] },
    3: { rows: [[0], [0, 0]] },
    4: { rows: [[0, 0], [0, 0]] },
    5: { rows: [[0, 0], [1], [0, 0]] },
    6: { rows: [[0, 1, 0], [0, 1, 0]] },
    7: { rows: [[1], [0, 0, 0], [0, 0, 0]] },
    8: { rows: [[0, 0, 0, 0], [0, 0, 0, 0]] },
    9: { rows: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] },
  };

  // 每张牌的圈圈配色，和素材一致：绿 / 砖红 / 藏青 三色搭
  const DOT_PLAN = {
    2: [0, 0],
    3: [2, 1, 2],
    4: [2, 2, 2, 2],
    5: [0, 0, 1, 0, 0],
    6: [2, 2, 1, 1, 2, 2],
    7: [0, 0, 0, 1, 2, 2, 2],
    8: [2, 2, 1, 1, 2, 2, 1, 1],
    9: [2, 2, 2, 1, 1, 1, 2, 2, 2],
  };

  // 一筒：外圈青绿花瓣环 + 内圈砖红花心，像素材里的“大花心”
  function drawRosette(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, TAU);
    ctx.lineWidth = r * 0.3;
    ctx.strokeStyle = DOT_GREEN;
    ctx.stroke();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * TAU;
      const px = cx + Math.cos(a) * r * 0.78;
      const py = cy + Math.sin(a) * r * 0.78;
      ctx.beginPath();
      ctx.arc(px, py, r * 0.17, 0, TAU);
      ctx.fillStyle = DOT_GREEN_DEEP;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, r * 0.1, 0, TAU);
      ctx.fillStyle = DOT_GREEN;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.95, 0, TAU);
    ctx.lineWidth = Math.max(0.7, r * 0.07);
    ctx.strokeStyle = DOT_GREEN_DEEP;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, TAU);
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = DOT_RED;
    ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + Math.PI / 8;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32, r * 0.09, 0, TAU);
      ctx.fillStyle = DOT_RED;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, TAU);
    ctx.fillStyle = DOT_RED;
    ctx.fill();
    ctx.restore();
  }

  function drawDots(ctx, plate, n) {
    const layout = DOT_LAYOUT[n];
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    const base = plate.w * 0.5 * layout.size * 0.5;
    const span = layout.size > 0.9 ? 0.42 : 0.46;
    if (n === 1) { drawRosette(ctx, cx, cy, base * 1.2); return; }
    const plan = DOT_PLAN[n] || [];
    for (let i = 0; i < layout.pts.length; i += 1) {
      const px = cx + layout.pts[i][0] * plate.w * span;
      const py = cy + layout.pts[i][1] * plate.h * span;
      const pair = DOT_PAIRS[plan[i] === undefined ? 2 : plan[i]];
      drawCoin(ctx, px, py, Math.max(6, base), pair[0], pair[1]);
    }
  }
  function drawSticks(ctx, plate, n) {
    const layout = STICK_LAYOUT[n];
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    const rowCount = layout.rows.length;
    const rowH = plate.h / rowCount;
    const stickH = rowH * 0.76;
    for (let r = 0; r < rowCount; r += 1) {
      const row = layout.rows[r];
      const stickW = Math.min(plate.w * 0.15, plate.w / (row.length * 1.75));
      const spread = plate.w * 0.72;
      const y = cy + (r - (rowCount - 1) / 2) * rowH;
      for (let i = 0; i < row.length; i += 1) {
        const x = cx + (row.length === 1 ? 0 : (i / (row.length - 1) - 0.5) * spread);
        drawStick(ctx, x, y, stickW, stickH, row[i] === 1);
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
        const fx = plate.x + 11;
        const fy = plate.y + 13;
        const fw = plate.w - 22;
        const fh = plate.h - 26;
        roundRect(ctx, fx, fy, fw, fh, 7);
        ctx.fillStyle = 'rgba(31,77,155,0.06)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(44,58,99,0.8)';
        ctx.stroke();
        roundRect(ctx, fx + 1.6, fy + 1.6, fw - 3.2, fh - 3.2, 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        roundRect(ctx, fx - 2.4, fy - 2.4, fw + 4.8, fh + 4.8, 8);
        ctx.strokeStyle = 'rgba(44,58,99,0.22)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        return;
      }
      const text = idx === 4 ? '中' : (idx === 5 ? '發' : rules.HONOR_TEXT[idx]);
      const color = idx === 4 ? RED : (idx === 5 ? GREEN : WIND_NAVY);
      // 字牌底纹：一圈极淡的光晕，单字不会显得空
      const halo = ctx.createRadialGradient(cx, cy, plate.w * 0.06, cx, cy, plate.w * 0.58);
      halo.addColorStop(0, idx === 4 ? 'rgba(188,51,36,0.11)' : (idx === 5 ? 'rgba(21,117,63,0.11)' : 'rgba(44,58,99,0.09)'));
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, plate.w * 0.58, 0, TAU);
      ctx.fillStyle = halo;
      ctx.fill();
      engravedText(ctx, text, cx, cy, plate.w * 0.9, color);
      if (idx === 4) {
        ctx.beginPath();
        ctx.arc(cx, cy, plate.w * 0.43, 0, TAU);
        ctx.strokeStyle = 'rgba(188,51,36,0.24)';
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
    const bx = M + 9;
    const by = M + 10;
    const bw = TILE.faceW - 18;
    const bh = TILE.faceH - 20;

    // 内嵌的牌背面板
    roundRect(ctx, bx, by, bw, bh, 9);
    const g = ctx.createLinearGradient(bx, by, bx + bw * 0.3, by + bh);
    g.addColorStop(0, '#f7eed9');
    g.addColorStop(0.5, '#efe3c6');
    g.addColorStop(1, '#ddcda6');
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    roundRect(ctx, bx, by, bw, bh, 9);
    ctx.clip();

    // 极淡的斜纹编织感
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = 'rgba(186,164,120,0.3)';
    ctx.lineWidth = 1;
    for (let d = -bh; d < bw; d += 13) {
      ctx.beginPath();
      ctx.moveTo(bx + d, by);
      ctx.lineTo(bx + d + bh, by + bh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + d + bh, by);
      ctx.lineTo(bx + d, by + bh);
      ctx.stroke();
    }
    // 象牙颗粒
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 80; i += 1) {
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(178,156,112,0.4)';
      ctx.fillRect(bx + rnd() * bw, by + rnd() * bh, 1.1, 1.1);
    }
    ctx.globalAlpha = 1;

    // 面板内凹：上沿暗、下沿亮
    const inTop = ctx.createLinearGradient(0, by, 0, by + bh * 0.3);
    inTop.addColorStop(0, 'rgba(122,100,58,0.28)');
    inTop.addColorStop(1, 'rgba(122,100,58,0)');
    ctx.fillStyle = inTop;
    ctx.fillRect(bx, by, bw, bh * 0.3);
    const inBot = ctx.createLinearGradient(0, by + bh, 0, by + bh * 0.72);
    inBot.addColorStop(0, 'rgba(255,255,255,0.5)');
    inBot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = inBot;
    ctx.fillRect(bx, by + bh * 0.72, bw, bh * 0.28);
    ctx.restore();

    // 中央小菱形金印
    const ccx = bx + bw / 2;
    const ccy = by + bh / 2;
    const rr = Math.min(bw, bh) * 0.15;
    ctx.beginPath();
    ctx.moveTo(ccx, ccy - rr);
    ctx.lineTo(ccx + rr, ccy);
    ctx.lineTo(ccx, ccy + rr);
    ctx.lineTo(ccx - rr, ccy);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(166,126,52,0.45)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ccx, ccy - rr * 0.45);
    ctx.lineTo(ccx + rr * 0.45, ccy);
    ctx.lineTo(ccx, ccy + rr * 0.45);
    ctx.lineTo(ccx - rr * 0.45, ccy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(190,146,60,0.38)';
    ctx.fill();

    // 边框：外深内亮，像一圈抛光过的棱
    roundRect(ctx, bx + 2, by + 2, bw - 4, bh - 4, 8);
    ctx.strokeStyle = 'rgba(150,126,84,0.34)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    roundRect(ctx, bx + 3.6, by + 3.6, bw - 7.2, bh - 7.2, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
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
  // 背景按实际画布尺寸烘焙，避免拉伸导致噪点变成椭圆
  function makeRoomCanvas(w, h) {
    const width = Math.max(64, Math.round(w || 480));
    const height = Math.max(64, Math.round(h || 480));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const rnd = makeRng(77);

    // 底色：深紫暗室
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, '#150e24');
    base.addColorStop(0.42, '#241838');
    base.addColorStop(1, '#0b0714');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    // 顶灯：桌面后上方晕开的一片暖光
    const pool = ctx.createRadialGradient(width * 0.5, height * 0.42, width * 0.04, width * 0.5, height * 0.44, Math.max(width, height) * 0.62);
    pool.addColorStop(0, 'rgba(122,98,170,0.55)');
    pool.addColorStop(0.4, 'rgba(84,62,126,0.3)');
    pool.addColorStop(1, 'rgba(20,12,34,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(0, 0, width, height);

    // 四周压暗，视线收拢到牌桌
    const vig = ctx.createRadialGradient(width * 0.5, height * 0.46, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.62, 'rgba(0,0,0,0.28)');
    vig.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // 顶部/底部再压一层，给 HUD、状态条和手牌让出干净的暗背景
    const top = ctx.createLinearGradient(0, 0, 0, height * 0.17);
    top.addColorStop(0, 'rgba(5,3,10,0.6)');
    top.addColorStop(1, 'rgba(5,3,10,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, height * 0.17);
    const bottom = ctx.createLinearGradient(0, height, 0, height * 0.78);
    bottom.addColorStop(0, 'rgba(5,3,10,0.66)');
    bottom.addColorStop(1, 'rgba(5,3,10,0)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height * 0.78, width, height * 0.22);

    // 浮尘
    const dust = Math.round((width * height) / 900);
    for (let i = 0; i < dust; i += 1) {
      ctx.fillStyle = 'rgba(255,246,220,' + (0.012 + rnd() * 0.035) + ')';
      const r = 0.6 + rnd() * 1.2;
      ctx.fillRect(rnd() * width, rnd() * height, r, r);
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
    // 木节：几处同心年轮，外框更像真木料
    for (let k = 0; k < 5; k += 1) {
      const kx = rnd() * size;
      const ky = rnd() * size;
      const rings = 3 + Math.floor(rnd() * 3);
      for (let n = rings; n >= 1; n -= 1) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, n * (3 + rnd() * 2.4), n * (1.8 + rnd() * 1.6), rnd() * TAU, 0, TAU);
        ctx.strokeStyle = 'rgba(40,22,8,' + (0.05 + n * 0.02).toFixed(3) + ')';
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
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
    felt.addColorStop(0, '#24804f');
    felt.addColorStop(0.55, '#1b6b45');
    felt.addColorStop(1, '#10492f');
    roundRect(ctx, feltX, feltY, feltW, feltH, size * 0.03);
    ctx.fillStyle = felt;
    ctx.fill();

    // 桌面柔光：中心稍亮，视线落在牌桌上
    const glow = ctx.createRadialGradient(size * 0.5, size * 0.42, feltW * 0.02, size * 0.5, size * 0.46, feltW * 0.62);
    glow.addColorStop(0, 'rgba(152,236,182,0.14)');
    glow.addColorStop(1, 'rgba(152,236,182,0)');
    roundRect(ctx, feltX, feltY, feltW, feltH, size * 0.03);
    ctx.fillStyle = glow;
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

    // 木框内沿的金线：深色凹槽 + 金线 + 内侧高光，做出金属倒角
    roundRect(ctx, feltX - 8, feltY - 8, feltW + 16, feltH + 16, size * 0.036);
    ctx.strokeStyle = 'rgba(28,14,5,0.55)';
    ctx.lineWidth = 4.5;
    ctx.stroke();
    roundRect(ctx, feltX - 4.5, feltY - 4.5, feltW + 9, feltH + 9, size * 0.034);
    const ivoryLine = ctx.createLinearGradient(0, 0, size, size);
    ivoryLine.addColorStop(0, 'rgba(255,252,238,0.88)');
    ivoryLine.addColorStop(0.3, 'rgba(228,216,188,0.72)');
    ivoryLine.addColorStop(0.62, 'rgba(196,183,152,0.62)');
    ivoryLine.addColorStop(1, 'rgba(243,235,212,0.78)');
    ctx.strokeStyle = ivoryLine;
    ctx.lineWidth = 3.6;
    ctx.stroke();
    roundRect(ctx, feltX - 2.6, feltY - 2.6, feltW + 5.2, feltH + 5.2, size * 0.031);
    ctx.strokeStyle = 'rgba(255,246,214,0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    roundRect(ctx, 1.5, 1.5, size - 3, size - 3, size * 0.05);
    ctx.strokeStyle = 'rgba(255,214,150,0.28)';
    ctx.lineWidth = 3;
    ctx.stroke();
    return canvas;
  }

  const Art = {
    TILE: TILE,
    build: function (scene, roomW, roomH) {
      if (scene.textures.exists('mj-face-0')) return;
      for (let code = 0; code < RULES.KIND; code += 1) {
        scene.textures.addCanvas('mj-face-' + code, makeTileCanvas(code));
      }
      scene.textures.addCanvas('mj-back', makeTileCanvas(-1));
      scene.textures.addCanvas('mj-table', makeTableCanvas(1024));
      scene.textures.addCanvas('mj-room', makeRoomCanvas(roomW, roomH));
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