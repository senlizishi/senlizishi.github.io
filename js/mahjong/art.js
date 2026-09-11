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
  // 一张牌实际占位的尺寸（含描边留白、厚度与投影）。排版必须按这个算，
  // 只按牌面宽度排会让相邻两张的贴图互相压住，看起来就是牌叠在一起。
  TILE.footW = TILE.faceW + TILE.margin * 2;
  TILE.footH = TILE.faceH + TILE.thickness + TILE.margin * 2;

  const CJK = '"Kaiti SC","STKaiti","KaiTi","Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';
  const IVORY = '#fbf4e2';
  const INK = '#242220';
  const RED = '#9c3225';
  const DEEP_RED = '#722015';
  const GREEN = '#1d6b3a';
  const DEEP_GREEN = '#0f5430';
  const BLUE = '#33517d';
  const DEEP_BLUE = '#1e3358';
  // 筒子 / 条子 / 字牌配色，全部按参考素材取色：竹绿、砖红、藏青
  const DOT_GREEN = '#2f6b4a';
  const DOT_GREEN_DEEP = '#1b4630';
  const DOT_RED = '#a03a26';
  const DOT_RED_DEEP = '#6d2114';
  const DOT_NAVY = '#33517d';
  const DOT_NAVY_DEEP = '#1e3358';
  // 一筒那枚团花铜镜的墨色（素材里偏墨蓝）
  const DOT_BLACK = '#3b4149';
  const DOT_BLACK_DEEP = '#20242a';
  // 筒子钱面上的白点 / 白留白
  const DOT_FLOWER = '#f8f4e9';
  const DOT_PAIRS = [[DOT_GREEN, DOT_GREEN_DEEP], [DOT_RED, DOT_RED_DEEP], [DOT_NAVY, DOT_NAVY_DEEP], [DOT_BLACK, DOT_BLACK_DEEP]];
  const STICK_GREEN = '#3f7049';
  const STICK_GREEN_DEEP = '#24472e';
  const STICK_RED = '#a8392a';
  const STICK_RED_DEEP = '#6c1c12';
  const STICK_GREEN_CORE = '#93b183';
  const STICK_RED_CORE = '#dda08d';
  const WIND_NAVY = '#242220';

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
    ctx.fillStyle = '#9a9888';
    ctx.fill();
    ctx.restore();

    // 厚度侧面：上沿受光、下沿吃暗
    const side = ctx.createLinearGradient(0, M, 0, M + h + t);
    side.addColorStop(0, '#fbfaf3');
    side.addColorStop(0.62, '#efede1');
    side.addColorStop(0.88, '#dad7c7');
    side.addColorStop(1, '#b4b1a1');
    roundRect(ctx, M, M + 2, w, h + t - 2, TILE.radius + 1);
    ctx.fillStyle = side;
    ctx.fill();

    // 正面：象牙底色，左上受光更亮
    const face = ctx.createLinearGradient(M, M, M + w * 0.62, M + h);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(0.32, '#fdfcf7');
    face.addColorStop(0.72, '#f4f3ea');
    face.addColorStop(1, '#e7e5d8');
    roundRect(ctx, M, M, w, h, TILE.radius);
    ctx.fillStyle = face;
    ctx.fill();

    // 正面下沿与侧面的接缝阴影，让“厚度”读得出来
    ctx.save();
    roundRect(ctx, M, M, w, h, TILE.radius);
    ctx.clip();
    const seam = ctx.createLinearGradient(0, M + h - 9, 0, M + h + 2);
    seam.addColorStop(0, 'rgba(110,106,84,0)');
    seam.addColorStop(0.6, 'rgba(96,92,70,0.3)');
    seam.addColorStop(1, 'rgba(72,68,48,0.58)');
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
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.34)' : 'rgba(170,166,140,0.2)';
      ctx.fillRect(x, y, 1.1, 1.1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 倒角：外圈浅、内圈亮，棱角更圆润
    roundRect(ctx, M + 0.6, M + 0.6, w - 1.2, h - 1.2, TILE.radius);
    ctx.strokeStyle = 'rgba(150,146,124,0.4)';
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
    g.addColorStop(0, '#fcfbf5');
    g.addColorStop(0.6, '#f2f1e7');
    g.addColorStop(1, '#e6e4d6');
    ctx.fillStyle = g;
    ctx.fill();

    // 内凹：上沿压暗、下沿提亮，牌面像嵌进去的一块
    ctx.save();
    roundRect(ctx, px, py, pw, ph, 9);
    ctx.clip();
    const grooveTop = ctx.createLinearGradient(0, py, 0, py + ph * 0.26);
    grooveTop.addColorStop(0, 'rgba(104,100,80,0.15)');
    grooveTop.addColorStop(1, 'rgba(104,100,80,0)');
    ctx.fillStyle = grooveTop;
    ctx.fillRect(px, py, pw, ph * 0.26);
    const grooveBottom = ctx.createLinearGradient(0, py + ph, 0, py + ph * 0.74);
    grooveBottom.addColorStop(0, 'rgba(255,255,255,0.55)');
    grooveBottom.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grooveBottom;
    ctx.fillRect(px, py + ph * 0.74, pw, ph * 0.26);
    ctx.restore();

    // 外沿亮边 + 内沿暗线
    roundRect(ctx, px - 1.6, py - 1.6, pw + 3.2, ph + 3.2, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    roundRect(ctx, px + 0.4, py + 0.4, pw - 0.8, ph - 0.8, 9);
    ctx.strokeStyle = 'rgba(142,136,112,0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    roundRect(ctx, px + 1.7, py + 1.7, pw - 3.4, ph - 3.4, 8);
    ctx.strokeStyle = 'rgba(142,136,112,0.17)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    return { x: px, y: py, w: pw, h: ph };
  }

  // 筒子：素材同款「圆钱」—— 厚彩色外环 + 一圈白留白 + 细线环 + 彩色钱面，
  // 钱面上一圈白点、正中一簇白点。外环颜色随牌张变，左上留高光，钱看着是立体的。
  function drawCoin(ctx, x, y, r, color, deep) {
    ctx.save();
    // 钱底的接触阴影，钱才像嵌在牌面上
    ctx.beginPath();
    ctx.arc(x, y + r * 0.07, r * 1.0, 0, TAU);
    ctx.fillStyle = 'rgba(58,50,34,0.17)';
    ctx.fill();
    // 厚彩色外环（外沿压深一圈）
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = deep;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.035, y - r * 0.045, r * 0.955, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.08, y - r * 0.09, r * 0.9, 0, TAU);
    const ringHit = ctx.createLinearGradient(x - r, y - r, x + r * 0.45, y + r * 0.7);
    ringHit.addColorStop(0, 'rgba(255,255,255,0.26)');
    ringHit.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    ringHit.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = ringHit;
    ctx.fill();
    // 白留白 + 细线环
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, TAU);
    ctx.fillStyle = DOT_FLOWER;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.655, 0, TAU);
    ctx.lineWidth = Math.max(0.6, r * 0.075);
    ctx.strokeStyle = deep;
    ctx.stroke();
    // 钱面
    ctx.beginPath();
    ctx.arc(x - r * 0.02, y - r * 0.025, r * 0.63, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    // 钱面上一圈白点
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU + Math.PI / 8;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.345, y + Math.sin(a) * r * 0.345, r * 0.072, 0, TAU);
      ctx.fillStyle = DOT_FLOWER;
      ctx.fill();
    }
    // 正中一簇白点
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.142, y + Math.sin(a) * r * 0.142, r * 0.058, 0, TAU);
      ctx.fillStyle = DOT_FLOWER;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, r * 0.055, 0, TAU);
    ctx.fillStyle = DOT_FLOWER;
    ctx.fill();
    ctx.restore();
  }
  // 竹节：深色外形 + 上下两道凸起的竹箍 + 被箍切成三段的浅色竹芯，和素材里那套竹子一致
  function drawStick(ctx, x, y, w, h, red) {
    const deep = red ? STICK_RED_DEEP : STICK_GREEN_DEEP;
    const core = red ? STICK_RED_CORE : STICK_GREEN_CORE;
    const x0 = x - w / 2;
    const y0 = y - h / 2;
    const capR = Math.min(w / 2, h * 0.17);
    const lw = Math.min(w * 0.26, h * 0.11);
    roundRect(ctx, x0, y0, w, h, capR);
    ctx.fillStyle = deep;
    ctx.fill();
    // 长的竹节两道箍、短的只留一道，和素材一样
    const knotCount = h > w * 2.6 ? 2 : 1;
    const knot = Math.max(1.2, h * 0.062);
    const knotY = (k) => (knotCount === 1 ? y0 + h / 2 : y0 + (h * k) / 3);
    for (let k = 1; k <= knotCount; k += 1) {
      roundRect(ctx, x0 - w * 0.055, knotY(k) - knot / 2, w * 1.11, knot, knot / 2);
      ctx.fillStyle = deep;
      ctx.fill();
    }
    // 竹芯：被竹箍切成几段浅色
    const cx0 = x0 + lw;
    const cw = w - lw * 2;
    const gap = knot * 1.05;
    const edges = [y0 + lw];
    for (let k = 1; k <= knotCount; k += 1) {
      edges.push(knotY(k) - gap / 2);
      edges.push(knotY(k) + gap / 2);
    }
    edges.push(y0 + h - lw);
    const shine = ctx.createLinearGradient(cx0, 0, cx0 + cw, 0);
    shine.addColorStop(0, 'rgba(0,0,0,0.16)');
    shine.addColorStop(0.3, 'rgba(255,255,255,0.34)');
    shine.addColorStop(0.62, 'rgba(255,255,255,0.06)');
    shine.addColorStop(1, 'rgba(0,0,0,0.18)');
    for (let i = 0; i < edges.length; i += 2) {
      const sy = edges[i];
      const sh = edges[i + 1] - edges[i];
      if (sh <= 0.6) continue;
      roundRect(ctx, cx0, sy, cw, sh, Math.min(cw * 0.45, sh * 0.42));
      ctx.fillStyle = core;
      ctx.fill();
      ctx.fillStyle = shine;
      ctx.fill();
    }
  }
  const DOT_LAYOUT = {
    1: { size: 1, pts: [[0, 0]] },
    2: { size: 0.86, pts: [[0, -0.5], [0, 0.5]] },
    3: { size: 0.74, pts: [[-0.5, -0.5], [0, 0], [0.5, 0.5]] },
    4: { size: 0.72, pts: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] },
    5: { size: 0.66, pts: [[-0.52, -0.52], [0.52, -0.52], [0, 0], [-0.52, 0.52], [0.52, 0.52]] },
    6: { size: 0.6, pts: [[-0.48, -0.66], [0.48, -0.66], [-0.48, 0], [0.48, 0], [-0.48, 0.66], [0.48, 0.66]] },
    7: { size: 0.55, pts: [[-0.646, -0.685], [-0.022, -0.457], [0.602, -0.228], [-0.4, 0.096], [0.402, 0.096], [-0.4, 0.513], [0.402, 0.513]] },
    8: { size: 0.5, pts: [[-0.44, -0.72], [0.44, -0.72], [-0.44, -0.24], [0.44, -0.24], [-0.44, 0.24], [0.44, 0.24], [-0.44, 0.72], [0.44, 0.72]] },
    9: { size: 0.55, pts: [[-0.62, -0.62], [0, -0.62], [0.62, -0.62], [-0.62, 0], [0, 0], [0.62, 0], [-0.62, 0.62], [0, 0.62], [0.62, 0.62]] },
  };

  // 每根竹子：[横向位置, 纵向中心, 高度, 是否砖红]，都是占牌面宽/高的比例，逐根对齐素材
  const STICK_PLAN = {
    2: [[0.5, 0.25, 0.375, 0], [0.5, 0.6875, 0.375, 0]],
    3: [[0.5, 0.25, 0.375, 0], [0.26, 0.68, 0.345, 0], [0.74, 0.68, 0.345, 0]],
    4: [[0.22, 0.25, 0.375, 0], [0.78, 0.25, 0.375, 0], [0.22, 0.6875, 0.375, 0], [0.78, 0.6875, 0.375, 0]],
    5: [[0.22, 0.176, 0.225, 0], [0.75, 0.176, 0.225, 0], [0.5, 0.47, 0.375, 1],
        [0.22, 0.766, 0.225, 0], [0.75, 0.766, 0.225, 0]],
    6: [[0.19, 0.25, 0.375, 0], [0.48, 0.25, 0.375, 0], [0.77, 0.25, 0.375, 0],
        [0.19, 0.6875, 0.375, 0], [0.48, 0.6875, 0.375, 0], [0.77, 0.6875, 0.375, 0]],
    7: [[0.52, 0.3125, 0.5625, 1],
        [0.22, 0.453, 0.28, 0], [0.74, 0.453, 0.28, 0],
        [0.22, 0.734, 0.28, 0], [0.52, 0.734, 0.28, 0], [0.74, 0.734, 0.28, 0]],
    9: [[0.22, 0.156, 0.25, 0], [0.5, 0.3125, 0.5625, 1], [0.78, 0.156, 0.25, 0],
        [0.22, 0.453, 0.25, 0], [0.78, 0.453, 0.25, 0],
        [0.22, 0.75, 0.25, 0], [0.5, 0.75, 0.25, 0], [0.78, 0.75, 0.25, 0]],
  };
  const STICK_W = 0.14;             // 竹子粗细（占牌面宽的比例）

  // 每张牌的圈圈配色，和素材一致：竹绿 / 砖红 / 藏青（0 绿 1 红 2 藏青）
  const DOT_PLAN = {
    2: [0, 0],
    3: [2, 1, 2],
    4: [2, 2, 2, 2],
    5: [2, 2, 1, 2, 2],
    6: [2, 2, 1, 1, 1, 1],
    7: [2, 2, 2, 1, 1, 1, 1],
    8: [2, 2, 2, 2, 2, 2, 2, 2],
    9: [2, 2, 2, 1, 1, 1, 2, 2, 2],
  };

  // 一筒：素材里的团花铜镜 —— 厚墨环 + 白留白 + 细线环，里面是四角回纹与中心十字
  function drawRosette(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.07, r * 1.0, 0, TAU);
    ctx.fillStyle = 'rgba(58,50,34,0.19)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = DOT_BLACK_DEEP;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.035, cy - r * 0.045, r * 0.955, 0, TAU);
    ctx.fillStyle = DOT_BLACK;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - r * 0.08, cy - r * 0.09, r * 0.9, 0, TAU);
    const ringHit = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.45, cy + r * 0.7);
    ringHit.addColorStop(0, 'rgba(255,255,255,0.20)');
    ringHit.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    ringHit.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = ringHit;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.74, 0, TAU);
    ctx.fillStyle = DOT_FLOWER;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.685, 0, TAU);
    ctx.lineWidth = Math.max(0.6, r * 0.075);
    ctx.strokeStyle = DOT_BLACK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.65, 0, TAU);
    ctx.fillStyle = '#f3efe3';
    ctx.fill();
    ctx.strokeStyle = DOT_BLACK;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = r * 0.115;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy);
    ctx.lineTo(cx + r * 0.45, cy);
    ctx.moveTo(cx, cy - r * 0.62);
    ctx.lineTo(cx, cy + r * 0.62);
    ctx.stroke();
    ctx.lineWidth = r * 0.1;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sy = -1; sy <= 1; sy += 2) {
        const ox = cx + sx * r * 0.315;
        const oy = cy + sy * r * 0.325;
        const a = r * 0.175;
        ctx.beginPath();
        ctx.moveTo(ox - sx * a, oy - sy * a);
        ctx.lineTo(ox + sx * a, oy - sy * a);
        ctx.lineTo(ox + sx * a, oy + sy * a);
        ctx.stroke();
      }
    }
    roundRect(ctx, cx - r * 0.13, cy - r * 0.13, r * 0.26, r * 0.26, 1);
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    ctx.restore();
  }
  function drawDots(ctx, plate, n) {
    const layout = DOT_LAYOUT[n];
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    const base = plate.w * 0.5 * layout.size * 0.5;
    const span = layout.size > 0.9 ? 0.42 : 0.46;
    if (n === 1) { drawRosette(ctx, cx, cy, base); return; }
    const plan = DOT_PLAN[n] || [];
    for (let i = 0; i < layout.pts.length; i += 1) {
      const px = cx + layout.pts[i][0] * plate.w * span;
      const py = cy + layout.pts[i][1] * plate.h * span;
      const pair = DOT_PAIRS[plan[i] === undefined ? 2 : plan[i]];
      drawCoin(ctx, px, py, Math.max(6, base), pair[0], pair[1]);
    }
  }
  function drawSticks(ctx, plate, n) {
    const plan = STICK_PLAN[n];
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    // 素材里的坐标是按牌面量的，这里换算到牌面板上（两者同心）
    const kx = TILE.faceW / plate.w;
    const ky = TILE.faceH / plate.h;
    const W = plate.w * kx;
    const H = plate.h * ky;
    for (let i = 0; i < plan.length; i += 1) {
      const it = plan[i];
      drawStick(ctx, cx + (it[0] - 0.5) * W, cy + (it[1] - 0.5) * H, W * STICK_W, H * it[2], it[3] === 1);
    }
  }
  // 八条：素材里的「八」字花梁 —— 四根立竹 + 上「人」下「八」两道斜梁，中线上两道朱红短竹。
  // 八条：素材里的「八」字花梁 —— 四根立竹 + 上「人」下「八」两道斜梁，中线上两道朱红短竹。
  function drawSou8(ctx, plate) {
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2;
    const W = plate.w * (TILE.faceW / plate.w);
    const H = plate.h * (TILE.faceH / plate.h);
    const X = (v) => cx + (v - 0.5) * W;
    const Y = (v) => cy + (v - 0.5) * H;
    const colL = 0.2;
    const colR = 0.8;
    const stickW = W * STICK_W;
    const beamW = W * 0.095;
    // 斜梁：把一根竹子转到两点之间，长度就是这个距离
    const beam = (x1, y1, x2, y2) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      ctx.save();
      ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
      ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
      drawStick(ctx, 0, 0, beamW, Math.sqrt(dx * dx + dy * dy), false);
      ctx.restore();
    };
    // 斜梁先画，四根立竹后画压在上面，竹身才不会被梁头打断
    beam(X(colL), Y(0.355), X(0.5), Y(0.17));
    beam(X(0.5), Y(0.17), X(colR), Y(0.355));
    beam(X(colL), Y(0.575), X(0.5), Y(0.735));
    beam(X(0.5), Y(0.735), X(colR), Y(0.575));
    drawStick(ctx, X(colL), Y(0.2), stickW, H * 0.35, false);
    drawStick(ctx, X(colR), Y(0.2), stickW, H * 0.35, false);
    drawStick(ctx, X(colL), Y(0.72), stickW, H * 0.38, false);
    drawStick(ctx, X(colR), Y(0.72), stickW, H * 0.38, false);
    // 中线上两道朱红短竹
    drawStick(ctx, X(0.5), Y(0.095), stickW, H * 0.125, true);
    drawStick(ctx, X(0.5), Y(0.45), stickW, H * 0.29, true);
  }

  // 一条：传统“幺鸡”，一只侧身飞起来的鸟，配色对齐素材那张翠鸟
  function drawBird(ctx, plate) {
    const u = plate.w / 100;
    const cx = plate.x + plate.w / 2;
    const cy = plate.y + plate.h / 2 + 4 * u;
    const OUTLINE = 'rgba(42,56,36,0.82)';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.lineJoin = 'round';

    const feather = (x1, y1, x2, y2, w) => {
      ctx.beginPath();
      ctx.moveTo(x1 * u, y1 * u);
      ctx.quadraticCurveTo((x1 + x2) / 2 * u - 6 * u, (y1 + y2) / 2 * u, x2 * u, y2 * u);
      ctx.lineWidth = w * u;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5f8455';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x2 * u, y2 * u, w * u * 0.62, 0, TAU);
      ctx.fillStyle = '#a8392a';
      ctx.fill();
    };
    feather(-16, 16, -44, 40, 7);
    feather(-14, 20, -30, 50, 7);
    feather(-10, 22, -14, 54, 6);

    const body = ctx.createLinearGradient(-26 * u, -20 * u, 22 * u, 30 * u);
    body.addColorStop(0, '#a8c19c');
    body.addColorStop(0.5, '#6f9560');
    body.addColorStop(1, '#41603b');
    ctx.beginPath();
    ctx.ellipse(0, 6 * u, 21 * u, 27 * u, -0.16, 0, TAU);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    // 翅下那块象牙白
    ctx.beginPath();
    ctx.ellipse(-6 * u, 12 * u, 11 * u, 17 * u, -0.35, 0, TAU);
    ctx.fillStyle = 'rgba(246,242,228,0.78)';
    ctx.fill();

    // 高高举起的翅膀：外缘砖红、内里象牙、羽根青绿
    ctx.beginPath();
    ctx.moveTo(2 * u, -4 * u);
    ctx.quadraticCurveTo(14 * u, -48 * u, 33 * u, -47 * u);
    ctx.quadraticCurveTo(31 * u, -16 * u, 12 * u, 9 * u);
    ctx.closePath();
    const wing = ctx.createLinearGradient(2 * u, -46 * u, 24 * u, 4 * u);
    wing.addColorStop(0, '#a8392a');
    wing.addColorStop(0.4, '#e8ded0');
    wing.addColorStop(0.72, '#8aa87c');
    wing.addColorStop(1, '#4e7448');
    ctx.fillStyle = wing;
    ctx.fill();
    ctx.lineWidth = 1.5 * u;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    const headG = ctx.createRadialGradient(12 * u, -24 * u, 2 * u, 14 * u, -20 * u, 15 * u);
    headG.addColorStop(0, '#b0c9a2');
    headG.addColorStop(1, '#5e8455');
    ctx.beginPath();
    ctx.arc(14 * u, -20 * u, 13 * u, 0, TAU);
    ctx.fillStyle = headG;
    ctx.fill();
    ctx.lineWidth = 1.6 * u;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(24 * u, -22 * u);
    ctx.lineTo(38 * u, -16 * u);
    ctx.lineTo(24 * u, -11 * u);
    ctx.closePath();
    ctx.fillStyle = '#7d9b68';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.1 * u;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(18 * u, -24 * u, 4 * u, 0, TAU);
    ctx.fillStyle = '#fbf7ea';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19 * u, -24 * u, 2.2 * u, 0, TAU);
    ctx.fillStyle = '#8e2a20';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8 * u, -32 * u);
    ctx.quadraticCurveTo(14 * u, -42 * u, 21 * u, -34 * u);
    ctx.lineWidth = 3.4 * u;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#a8392a';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-2 * u, 32 * u);
    ctx.lineTo(-1 * u, 44 * u);
    ctx.moveTo(8 * u, 32 * u);
    ctx.lineTo(9 * u, 44 * u);
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = '#8a4a34';
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
      if (idx === 6) {                       // 白板：素材里的双线画框
        const fx = plate.x + 9;
        const fy = plate.y + 11;
        const fw = plate.w - 18;
        const fh = plate.h - 22;
        const ix = fx + 4.8;
        const iy = fy + 4.8;
        const iw = fw - 9.6;
        const ih = fh - 9.6;
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = 'rgba(47,74,116,0.92)';
        roundRect(ctx, fx, fy, fw, fh, 6);
        ctx.lineWidth = 3.2;
        ctx.stroke();
        roundRect(ctx, ix, iy, iw, ih, 2);
        ctx.lineWidth = 2.1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx + 1.6, fy + 1.6);
        ctx.lineTo(ix, iy);
        ctx.moveTo(fx + fw - 1.6, fy + 1.6);
        ctx.lineTo(ix + iw, iy);
        ctx.moveTo(fx + 1.6, fy + fh - 1.6);
        ctx.lineTo(ix, iy + ih);
        ctx.moveTo(fx + fw - 1.6, fy + fh - 1.6);
        ctx.lineTo(ix + iw, iy + ih);
        ctx.stroke();
        return;
      }
      const winds = ['東', '南', '西', '北'];
      const text = idx === 4 ? '中' : (idx === 5 ? '發' : winds[idx]);
      const color = idx === 4 ? RED : (idx === 5 ? GREEN : WIND_NAVY);
      engravedText(ctx, text, cx, cy, plate.w * 0.84, color);
      return;
    }
    const suit = Math.floor(code / 9);
    const rank = code % 9;
    if (suit === 0) {
      const cx = plate.x + plate.w / 2;
      engravedText(ctx, rules.NUMBER_TEXT[rank], cx, plate.y + plate.h * 0.29, plate.w * 0.58, INK);
      engravedText(ctx, '萬', cx, plate.y + plate.h * 0.725, plate.w * 0.54, RED);
      return;
    }
    if (suit === 1) { drawDots(ctx, plate, rank + 1); return; }
    if (rank === 0) { drawBird(ctx, plate); return; }
    if (rank === 7) { drawSou8(ctx, plate); return; }
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
    // 贴图是 2 倍烘焙的（texW * bake），所以显示缩放必须再乘 TILE.baseScale，
    // 这样 faceSize(scale) = faceW * scale 才是屏幕上真实的牌面尺寸；
    // 漏掉 baseScale 会把每张牌画成两倍大，相邻的牌就会互相压住（手牌看起来是叠在一起的）。
    place: function (image, x, y, scale) {
      image.setOrigin(0.5, TILE.originY);
      image.setScale((scale === undefined ? 1 : scale) * TILE.baseScale);
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