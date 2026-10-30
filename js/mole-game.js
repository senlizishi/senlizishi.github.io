/*
 * 草地打地鼠：540x960 竖屏，60 秒随机探头小游戏。
 * 点地鼠 +1 分，误点小白兔 -1 分；无素材、无存档、无背景音乐。
 * 全部画面由 Phaser.Graphics / Text 程序化绘制，声音由 WebAudio 合成。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;

  const GAME_SEC = 60;
  const HOLE_COLS = 3;
  const HOLE_ROWS = 3;
  const HOLE_COUNT = HOLE_COLS * HOLE_ROWS;
  const MOLE_SCORE = 1;
  const RABBIT_SCORE = -1;
  const RISE_SEC = 0.13;
  const SINK_SEC = 0.12;
  const HIT_SEC = 0.16;
  const RESULT_LOCK_SEC = 0.4;
  const RESULT_DELAY_SEC = 0.52;
  const RABBIT_CHANCE_MIN = 0.15;
  const RABBIT_CHANCE_MAX = 0.24;
  const MAX_ACTIVE = [2, 3, 4];
  const HOLE_COOLDOWN = 0.45;

  const C = {
    skyTop: 0xCDEFFF,
    skyBottom: 0xF5FFF1,
    sun: 0xFFE18A,
    cloud: 0xFFFFFF,
    hill: 0x9DD69B,
    hillDark: 0x79BE83,
    grass: 0x91D47E,
    grassDeep: 0x5FA867,
    grassLight: 0xB6E79E,
    fence: 0xCB9861,
    fenceDark: 0x8B5A32,
    cream: 0xFFF8E7,
    creamDeep: 0xF1DDB8,
    soil: 0xB77A4C,
    soilDark: 0x6D422B,
    hole: 0x3B241C,
    holeDeep: 0x24130F,
    mole: 0x9A6845,
    moleLight: 0xC1916A,
    moleDark: 0x6E452E,
    rabbit: 0xFFFDF8,
    rabbitShade: 0xE9E2DA,
    rabbitPink: 0xFFAEC2,
    ink: 0x4F3428,
    gold: 0xFFC94E,
    goldDeep: 0xA96914,
    coral: 0xF27A78,
    coralDeep: 0xAC4947,
    blue: 0x529BDD,
    blueDeep: 0x2D679B,
    lavender: 0xA786DB,
    green: 0x4E9B58,
    white: 0xFFFFFF,
    shadow: 0x234026,
  };

  const L = computeLayout();

  const DEPTH = {
    world: 0,
    field: 1,
    holeBack: 2,
    critter: 3,
    holeFront: 4,
    fx: 12,
    ui: 20,
    ready: 40,
    result: 42,
  };

  function computeLayout() {
    const colX = [108, 270, 432];
    const rowY = [340, 518, 696];
    const holes = [];
    for (let r = 0; r < HOLE_ROWS; r++) {
      for (let c = 0; c < HOLE_COLS; c++) {
        holes.push({
          i: r * HOLE_COLS + c,
          col: c,
          row: r,
          x: colX[c],
          y: rowY[r],
        });
      }
    }
    return {
      title: { x: WIDTH / 2, y: 61 },
      subtitle: { x: WIDTH / 2, y: 99 },
      timer: { x: 128, y: 153, w: 162, h: 52 },
      score: { x: 412, y: 153, w: 162, h: 52 },
      field: { x: 24, y: 208, w: 492, h: 566 },
      holes: holes,
      hint: { x: WIDTH / 2, y: 837 },
      ready: { x: WIDTH / 2, y: 474, w: 414, h: 476 },
      readyButton: { x: WIDTH / 2, y: 642, w: 262, h: 64 },
      result: { x: WIDTH / 2, y: 473, w: 430, h: 444 },
      resultButton: { x: WIDTH / 2, y: 612, w: 224, h: 60 },
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function containsRect(r, x, y) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function drawPill(g, x, y, w, h, fill, stroke, line) {
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    if (stroke != null) {
      g.lineStyle(line || 2, stroke, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    }
  }

  function drawStar(g, x, y, r, color, alpha, points) {
    const n = points || 5;
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  function drawCloud(g, x, y, s) {
    g.fillStyle(C.cloud, 0.72);
    g.fillEllipse(x, y, 74 * s, 25 * s);
    g.fillCircle(x - 23 * s, y - 2 * s, 16 * s);
    g.fillCircle(x - 3 * s, y - 13 * s, 20 * s);
    g.fillCircle(x + 22 * s, y - 2 * s, 15 * s);
  }

  // ---------------------------------------------------------------- 背景
  function drawWorld(g) {
    const bands = 36;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const ar = (C.skyTop >> 16) & 255, ag = (C.skyTop >> 8) & 255, ab = C.skyTop & 255;
      const br = (C.skyBottom >> 16) & 255, bg = (C.skyBottom >> 8) & 255, bb = C.skyBottom & 255;
      const col = (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
      g.fillStyle(col, 1);
      g.fillRect(0, i * 8, WIDTH, 10);
    }
    g.fillStyle(0xFFE7A0, 0.35);
    g.fillCircle(474, 56, 46);
    g.fillStyle(C.sun, 0.95);
    g.fillCircle(474, 56, 30);
    g.fillStyle(0xFFF5C5, 0.8);
    g.fillCircle(465, 48, 11);
    drawCloud(g, 92, 72, 1.0);
    drawCloud(g, 344, 116, 0.72);
    drawCloud(g, 198, 32, 0.5);

    // 远处起伏的草地
    g.fillStyle(C.hill, 1);
    g.beginPath();
    g.moveTo(0, 258);
    g.lineTo(0, 206);
    g.lineTo(80, 168);
    g.lineTo(150, 218);
    g.lineTo(252, 155);
    g.lineTo(344, 215);
    g.lineTo(448, 165);
    g.lineTo(540, 215);
    g.lineTo(540, 300);
    g.lineTo(0, 300);
    g.closePath();
    g.fillPath();
    g.fillStyle(C.grassLight, 1);
    g.fillRect(0, 235, WIDTH, HEIGHT - 235);

    // 木栅栏
    g.fillStyle(C.fenceDark, 0.22);
    g.fillRoundedRect(20, 236, 500, 10, 5);
    for (let i = 0; i < 9; i++) {
      const x = 26 + i * 61;
      g.fillStyle(C.fence, 1);
      g.fillRoundedRect(x, 198, 17, 102, 7);
      g.fillStyle(0xE8B97D, 0.64);
      g.fillRoundedRect(x + 4, 202, 7, 91, 4);
      g.fillStyle(C.fenceDark, 0.25);
      g.fillRoundedRect(x + 12, 201, 3, 94, 2);
      g.fillStyle(C.fenceDark, 0.72);
      g.fillTriangle(x + 1, 199, x + 16, 199, x + 8.5, 185);
    }
    g.fillStyle(C.fenceDark, 0.68);
    g.fillRoundedRect(20, 225, 500, 12, 6);
    g.fillStyle(0xE8B97D, 0.85);
    g.fillRoundedRect(23, 227, 494, 4, 2);

    // 草地纹理与小花
    for (let i = 0; i < 46; i++) {
      const x = 14 + ((i * 97 + 39) % 512);
      const y = 270 + ((i * 67 + 11) % 660);
      g.fillStyle(i % 2 ? 0xFFFFFF : C.grassDeep, i % 2 ? 0.2 : 0.18);
      g.fillEllipse(x, y, 6, 14);
    }
    const flowers = [
      [38, 304, 0xFF8FA8], [504, 312, 0xFFD35C], [46, 776, 0xFFFFFF],
      [500, 790, 0xA98BE2], [73, 912, 0xFF8FA8], [476, 928, 0xFFD35C],
      [205, 892, 0xFFFFFF], [350, 910, 0xFF9FC5],
    ];
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5;
        g.fillStyle(f[2], 0.88);
        g.fillCircle(f[0] + Math.cos(a) * 6, f[1] + Math.sin(a) * 6, 4);
      }
      g.fillStyle(C.gold, 1);
      g.fillCircle(f[0], f[1], 2.6);
    }

    // 前景草叶
    for (let i = 0; i < 16; i++) {
      const x = 12 + i * 35;
      g.fillStyle(i % 3 === 0 ? 0x75BB69 : 0x67A95E, 0.66);
      g.fillTriangle(x, 960, x + 7, 920 - (i % 4) * 5, x + 13, 960);
    }
  }

  function drawField(g) {
    const f = L.field;
    g.fillStyle(C.shadow, 0.17);
    g.fillRoundedRect(f.x + 3, f.y + 8, f.w, f.h, 34);
    g.fillStyle(0x86CB78, 1);
    g.fillRoundedRect(f.x, f.y, f.w, f.h, 34);
    g.lineStyle(3, 0x5BA466, 0.9);
    g.strokeRoundedRect(f.x, f.y, f.w, f.h, 34);
    g.fillStyle(0xA5DF8C, 1);
    g.fillRoundedRect(f.x + 9, f.y + 9, f.w - 18, f.h - 18, 27);
    for (let i = 0; i < 18; i++) {
      const x = f.x + 26 + ((i * 83 + 21) % (f.w - 52));
      const y = f.y + 30 + ((i * 59 + 7) % (f.h - 60));
      g.fillStyle(i % 2 ? 0xFFFFFF : 0x5AA665, i % 2 ? 0.12 : 0.13);
      g.fillEllipse(x, y, 7, 16);
    }
  }

  function drawHoleBack(g, hole) {
    const x = hole.x, y = hole.y;
    g.fillStyle(0x5B9B61, 0.55);
    g.fillEllipse(x, y + 13, 170, 56);
    g.fillStyle(0xC79360, 1);
    g.fillEllipse(x, y + 5, 162, 53);
    g.fillStyle(C.soil, 1);
    g.fillEllipse(x, y, 150, 45);
    g.fillStyle(C.soilDark, 0.8);
    g.fillEllipse(x, y + 2, 134, 34);
    g.fillStyle(C.hole, 1);
    g.fillEllipse(x, y + 2, 126, 30);
    g.fillStyle(C.holeDeep, 1);
    g.fillEllipse(x, y + 4, 112, 21);
    // 小土粒
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI * 0.9 + i * 0.2;
      g.fillStyle(i % 2 ? 0x9C633D : 0xD7A26E, 0.8);
      g.fillCircle(x + Math.cos(a) * 78, y + 2 + Math.sin(a) * 22, 2 + (i % 3));
    }
  }

  function drawHoleFront(g, hole) {
    const x = hole.x, y = hole.y;
    g.fillStyle(C.holeDeep, 1);
    g.fillEllipse(x, y + 2, 126, 30);
    g.lineStyle(5, C.soil, 1);
    g.strokeEllipse(x, y + 2, 138, 37);
    g.lineStyle(2.2, 0xE7B37B, 0.75);
    g.strokeEllipse(x, y - 1, 149, 43);
    g.fillStyle(0x5FA867, 0.8);
    g.fillEllipse(x, y + 20, 156, 12);
  }

  // ---------------------------------------------------------------- 角色
  function drawMole(g, cx, cy, s) {
    const x = cx || 0, y = cy || 0, k = s || 1;
    // 阴影
    g.fillStyle(0x244226, 0.2);
    g.fillEllipse(x, y + 2 * k, 60 * k, 14 * k);
    // 脚和手
    g.fillStyle(C.moleDark, 1);
    g.fillEllipse(x - 21 * k, y - 4 * k, 19 * k, 12 * k);
    g.fillEllipse(x + 21 * k, y - 4 * k, 19 * k, 12 * k);
    g.fillStyle(C.mole, 1);
    g.fillEllipse(x, y - 31 * k, 58 * k, 66 * k);
    g.fillStyle(C.moleLight, 1);
    g.fillEllipse(x, y - 27 * k, 32 * k, 43 * k);
    // 耳朵
    g.fillStyle(C.moleDark, 1);
    g.fillCircle(x - 23 * k, y - 78 * k, 9 * k);
    g.fillCircle(x + 23 * k, y - 78 * k, 9 * k);
    g.fillStyle(0xE0A98D, 1);
    g.fillCircle(x - 23 * k, y - 78 * k, 4.5 * k);
    g.fillCircle(x + 23 * k, y - 78 * k, 4.5 * k);
    // 头
    g.fillStyle(C.mole, 1);
    g.fillCircle(x, y - 67 * k, 30 * k);
    g.fillStyle(C.moleLight, 1);
    g.fillEllipse(x, y - 57 * k, 31 * k, 24 * k);
    // 眼睛和鼻子
    g.fillStyle(C.ink, 1);
    g.fillCircle(x - 10 * k, y - 72 * k, 3.2 * k);
    g.fillCircle(x + 10 * k, y - 72 * k, 3.2 * k);
    g.fillStyle(0xFFFFFF, 0.9);
    g.fillCircle(x - 9 * k, y - 73 * k, 1.1 * k);
    g.fillCircle(x + 11 * k, y - 73 * k, 1.1 * k);
    g.fillStyle(0xF08B94, 1);
    g.fillEllipse(x, y - 60 * k, 8 * k, 5.5 * k);
    g.lineStyle(1.6 * k, C.moleDark, 1);
    g.lineBetween(x, y - 57 * k, x, y - 53 * k);
    g.lineBetween(x, y - 53 * k, x - 4 * k, y - 50 * k);
    g.lineBetween(x, y - 53 * k, x + 4 * k, y - 50 * k);
    // 小爪子
    g.fillStyle(C.moleDark, 0.95);
    g.fillEllipse(x - 24 * k, y - 20 * k, 15 * k, 10 * k);
    g.fillEllipse(x + 24 * k, y - 20 * k, 15 * k, 10 * k);
    g.fillStyle(0xE0A98D, 1);
    g.fillCircle(x - 26 * k, y - 21 * k, 2.4 * k);
    g.fillCircle(x + 26 * k, y - 21 * k, 2.4 * k);
    // 头顶小毛
    g.lineStyle(2 * k, C.moleDark, 1);
    g.lineBetween(x - 2 * k, y - 96 * k, x - 7 * k, y - 103 * k);
    g.lineBetween(x + 2 * k, y - 96 * k, x + 6 * k, y - 102 * k);
  }

  function drawRabbit(g, cx, cy, s) {
    const x = cx || 0, y = cy || 0, k = s || 1;
    g.fillStyle(0x244226, 0.18);
    g.fillEllipse(x, y + 2 * k, 50 * k, 13 * k);
    // 长耳朵先画，放在头后面
    g.fillStyle(C.rabbitShade, 1);
    g.fillEllipse(x - 13 * k, y - 103 * k, 19 * k, 60 * k);
    g.fillEllipse(x + 13 * k, y - 103 * k, 19 * k, 60 * k);
    g.fillStyle(C.rabbit, 1);
    g.fillEllipse(x - 13 * k, y - 104 * k, 15 * k, 56 * k);
    g.fillEllipse(x + 13 * k, y - 104 * k, 15 * k, 56 * k);
    g.fillStyle(C.rabbitPink, 1);
    g.fillEllipse(x - 13 * k, y - 104 * k, 7 * k, 42 * k);
    g.fillEllipse(x + 13 * k, y - 104 * k, 7 * k, 42 * k);
    // 脚、身体
    g.fillStyle(C.rabbitShade, 1);
    g.fillEllipse(x - 16 * k, y - 4 * k, 20 * k, 12 * k);
    g.fillEllipse(x + 16 * k, y - 4 * k, 20 * k, 12 * k);
    g.fillStyle(C.rabbit, 1);
    g.fillEllipse(x, y - 30 * k, 47 * k, 60 * k);
    g.fillStyle(0xF8F0E8, 1);
    g.fillEllipse(x, y - 27 * k, 27 * k, 39 * k);
    // 头
    g.fillStyle(C.rabbit, 1);
    g.fillCircle(x, y - 69 * k, 28 * k);
    // 眼睛、鼻子
    g.fillStyle(C.ink, 1);
    g.fillCircle(x - 9 * k, y - 73 * k, 3 * k);
    g.fillCircle(x + 9 * k, y - 73 * k, 3 * k);
    g.fillStyle(0xFFFFFF, 0.95);
    g.fillCircle(x - 8 * k, y - 74 * k, 1 * k);
    g.fillCircle(x + 10 * k, y - 74 * k, 1 * k);
    g.fillStyle(C.rabbitPink, 1);
    g.fillEllipse(x, y - 63 * k, 7 * k, 5 * k);
    g.lineStyle(1.5 * k, 0x9F7A6B, 1);
    g.lineBetween(x, y - 60 * k, x, y - 56 * k);
    g.lineBetween(x, y - 56 * k, x - 4 * k, y - 53 * k);
    g.lineBetween(x, y - 56 * k, x + 4 * k, y - 53 * k);
    // 腮红
    g.fillStyle(0xFFB4C6, 0.55);
    g.fillCircle(x - 20 * k, y - 64 * k, 4 * k);
    g.fillCircle(x + 20 * k, y - 64 * k, 4 * k);
    // 小围巾
    g.fillStyle(0x6EC6B0, 1);
    g.fillRoundedRect(x - 18 * k, y - 47 * k, 36 * k, 7 * k, 3 * k);
    g.fillTriangle(x + 11 * k, y - 43 * k, x + 21 * k, y - 31 * k, x + 12 * k, y - 29 * k);
    g.fillStyle(0xFFFFFF, 0.55);
    g.fillCircle(x - 8 * k, y - 35 * k, 2 * k);
    g.fillCircle(x + 8 * k, y - 35 * k, 2 * k);
  }

  // ---------------------------------------------------------------- 开始与结算卡
  function drawReadyCard(g) {
    const r = L.ready;
    g.fillStyle(0x203929, 0.46);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(C.shadow, 0.28);
    g.fillRoundedRect(r.x - r.w / 2 + 5, r.y - r.h / 2 + 9, r.w, r.h, 36);
    g.fillStyle(0xFFF9EA, 1);
    g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 36);
    g.lineStyle(4, C.green, 1);
    g.strokeRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 36);
    g.lineStyle(1.5, 0xFFFFFF, 0.95);
    g.strokeRoundedRect(r.x - r.w / 2 + 8, r.y - r.h / 2 + 8, r.w - 16, r.h - 16, 28);
    // 顶部小旗帜
    g.fillStyle(C.gold, 0.9);
    g.fillRoundedRect(r.x - 112, r.y - r.h / 2 - 18, 224, 40, 20);
    g.lineStyle(2, C.goldDeep, 0.9);
    g.strokeRoundedRect(r.x - 112, r.y - r.h / 2 - 18, 224, 40, 20);
    drawStar(g, r.x - 82, r.y - r.h / 2 + 2, 8, C.goldDeep, 1);
    drawStar(g, r.x + 82, r.y - r.h / 2 + 2, 8, C.goldDeep, 1);

    // 两种目标的小展示框
    drawLegendBox(g, 158, 463, 148, C.gold);
    drawLegendBox(g, 382, 463, 148, C.blue);
    drawMole(g, 158, 505, 0.78);
    drawRabbit(g, 382, 520, 0.72);
    g.fillStyle(0xFFFFFF, 0.94);
    g.fillRoundedRect(111, 414, 94, 36, 18);
    g.lineStyle(2, C.goldDeep, 0.8);
    g.strokeRoundedRect(111, 414, 94, 36, 18);
    g.fillStyle(0xFFFFFF, 0.94);
    g.fillRoundedRect(335, 414, 94, 36, 18);
    g.lineStyle(2, C.blue, 0.8);
    g.strokeRoundedRect(335, 414, 94, 36, 18);

    // 开始按钮
    const b = L.readyButton;
    g.fillStyle(C.goldDeep, 0.24);
    g.fillRoundedRect(b.x - b.w / 2 + 3, b.y - b.h / 2 + 5, b.w, b.h, 33);
    g.fillStyle(0x5AAE6B, 1);
    g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 33);
    g.lineStyle(3, 0xFFFFFF, 0.55);
    g.strokeRoundedRect(b.x - b.w / 2 + 4, b.y - b.h / 2 + 4, b.w - 8, b.h - 8, 29);
  }

  function drawLegendBox(g, x, y, size, edge) {
    g.fillStyle(0xFFFFFF, 0.68);
    g.fillRoundedRect(x - size / 2, y - size / 2, size, size, 22);
    g.lineStyle(2.5, edge, 0.7);
    g.strokeRoundedRect(x - size / 2, y - size / 2, size, size, 22);
    g.fillStyle(C.grassLight, 0.72);
    g.fillEllipse(x, y + 42, 124, 22);
    g.fillStyle(C.hole, 1);
    g.fillEllipse(x, y + 41, 82, 15);
  }

  function drawResultCard(g) {
    const r = L.result;
    g.clear();
    g.fillStyle(0x203929, 0.5);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(C.shadow, 0.3);
    g.fillRoundedRect(r.x - r.w / 2 + 5, r.y - r.h / 2 + 9, r.w, r.h, 36);
    g.fillStyle(0xFFFDF5, 1);
    g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 36);
    g.lineStyle(4, C.gold, 1);
    g.strokeRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 36);
    g.lineStyle(1.5, 0xFFFFFF, 0.95);
    g.strokeRoundedRect(r.x - r.w / 2 + 8, r.y - r.h / 2 + 8, r.w - 16, r.h - 16, 28);
    g.fillStyle(0xFFF0C0, 1);
    g.fillRoundedRect(r.x - 104, r.y - r.h / 2 - 18, 208, 40, 20);
    g.lineStyle(2, C.goldDeep, 0.95);
    g.strokeRoundedRect(r.x - 104, r.y - r.h / 2 - 18, 208, 40, 20);
    drawStar(g, r.x - 76, r.y - r.h / 2 + 2, 8, C.goldDeep, 1);
    drawStar(g, r.x + 76, r.y - r.h / 2 + 2, 8, C.goldDeep, 1);

    const b = L.resultButton;
    g.fillStyle(C.goldDeep, 0.22);
    g.fillRoundedRect(b.x - b.w / 2 + 3, b.y - b.h / 2 + 5, b.w, b.h, 30);
    g.fillStyle(0x5AAE6B, 1);
    g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 30);
    g.lineStyle(2.5, 0xFFFFFF, 0.58);
    g.strokeRoundedRect(b.x - b.w / 2 + 4, b.y - b.h / 2 + 4, b.w - 8, b.h - 8, 26);
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
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(master);
        o.start(t0);
        o.stop(t0 + dur + 0.06);
      } catch (e) { /* ignore */ }
    }
    return {
      resume: resume,
      click: function () { tone(650, 0.06, 0.026, 0, 'triangle'); },
      start: function () {
        tone(392, 0.12, 0.028, 0, 'triangle');
        tone(523.25, 0.14, 0.027, 0.08, 'triangle');
        tone(659.25, 0.2, 0.023, 0.16, 'sine');
      },
      pop: function () { tone(260, 0.06, 0.017, 0, 'sine'); tone(480, 0.07, 0.013, 0.02, 'triangle'); },
      hitMole: function () {
        tone(620, 0.07, 0.038, 0, 'triangle');
        tone(880, 0.12, 0.032, 0.055, 'sine');
        tone(1174.66, 0.1, 0.016, 0.11, 'sine');
      },
      hitRabbit: function () {
        tone(440, 0.1, 0.025, 0, 'sine');
        tone(330, 0.15, 0.02, 0.075, 'sine');
      },
      whiff: function () { tone(210, 0.045, 0.008, 0, 'sine'); },
      tick: function () { tone(760, 0.04, 0.014, 0, 'triangle'); },
      end: function () {
        tone(523.25, 0.3, 0.025, 0, 'sine');
        tone(659.25, 0.35, 0.022, 0.1, 'sine');
        tone(783.99, 0.4, 0.018, 0.2, 'sine');
        tone(1046.5, 0.48, 0.014, 0.3, 'triangle');
      },
    };
  })();
  // ---------------------------------------------------------------- 场景
  class MoleScene extends Phaser.Scene {
    constructor() {
      super('MoleScene');
    }

    create() {
      this.L = L;
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT, GAME_SEC: GAME_SEC,
        HOLE_COLS: HOLE_COLS, HOLE_ROWS: HOLE_ROWS, HOLE_COUNT: HOLE_COUNT,
        MOLE_SCORE: MOLE_SCORE, RABBIT_SCORE: RABBIT_SCORE,
        MAX_ACTIVE: MAX_ACTIVE.slice(),
        RISE_SEC: RISE_SEC, SINK_SEC: SINK_SEC, HIT_SEC: HIT_SEC,
        RABBIT_CHANCE_MIN: RABBIT_CHANCE_MIN, RABBIT_CHANCE_MAX: RABBIT_CHANCE_MAX,
        RESULT_LOCK_SEC: RESULT_LOCK_SEC, RESULT_DELAY_SEC: RESULT_DELAY_SEC,
        HOLE_COOLDOWN: HOLE_COOLDOWN,
      };

      this.phase = 'ready';
      this.timeLeft = GAME_SEC;
      this.elapsed = 0;
      this.score = 0;
      this.molesHit = 0;
      this.rabbitsHit = 0;
      this.holes = [];
      this.spawnTimer = 0.38;
      this.firstSpawn = true;
      this.activeCount = 0;
      this.overT = 0;
      this.resultShown = false;
      this.lastTickSecond = GAME_SEC;
      this.clock = 0;
      this.scorePulse = 0;
      this.liveProps = [];

      // -------------------------------------------------- 静态世界
      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawWorld(this.worldG);
      this.fieldG = this.add.graphics().setDepth(DEPTH.field);
      drawField(this.fieldG);

      this.holeBackG = this.add.graphics().setDepth(DEPTH.holeBack);
      this.holeFrontG = this.add.graphics().setDepth(DEPTH.holeFront);
      for (let i = 0; i < L.holes.length; i++) {
        drawHoleBack(this.holeBackG, L.holes[i]);
      }
      for (let i = 0; i < L.holes.length; i++) {
        drawHoleFront(this.holeFrontG, L.holes[i]);
      }

      this.critterGs = [];
      this.holes = L.holes.map(function (p, i) {
        const g = this.add.graphics().setDepth(DEPTH.critter).setVisible(false);
        this.critterGs.push(g);
        return {
          i: i, x: p.x, y: p.y, col: p.col, row: p.row,
          type: null, state: 'hidden', t: 0, stay: 0,
          riseDur: RISE_SEC, sinkDur: SINK_SEC,
          recent: 0, hiddenY: p.y + 92, upY: p.y + 2,
        };
      }, this);

      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.uiG = this.add.graphics().setDepth(DEPTH.ui);

      this.titleText = this.add.text(L.title.x, L.title.y, '草地打地鼠', {
        fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#406B3F',
        stroke: '#F7FFE8', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.subtitleText = this.add.text(L.subtitle.x, L.subtitle.y, '地鼠 +1 · 小白兔 -1', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#5F7452',
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.hintG = this.add.graphics().setDepth(DEPTH.ui);
      drawPill(this.hintG, L.hint.x, L.hint.y, 302, 38, 0xFFF8E5, C.goldDeep, 2);
      this.hintText = this.add.text(L.hint.x, L.hint.y, '点地鼠 +1 · 小白兔不能点', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#82612F',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.timerText = this.add.text(113, L.timer.y, '60', {
        fontFamily: FONT, fontSize: '29px', fontStyle: 'bold', color: '#4F3A29',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.timerUnit = this.add.text(151, L.timer.y + 2, '秒', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#7D6651',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.scoreLabel = this.add.text(367, L.score.y, '分数', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#7D6651',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.scoreText = this.add.text(438, L.score.y, '0', {
        fontFamily: FONT, fontSize: '31px', fontStyle: 'bold', color: '#3F6F45',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      // -------------------------------------------------- 开始卡
      this.readyG = this.add.graphics().setDepth(DEPTH.ready);
      drawReadyCard(this.readyG);
      this.readyTitle = this.add.text(L.ready.x, 318, '准备好了吗？', {
        fontFamily: FONT, fontSize: '29px', fontStyle: 'bold', color: '#3F5C33',
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);
      this.readySub = this.add.text(L.ready.x, 362, '60 秒 · 看准再点', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#806447',
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);
      this.readyPlus = this.add.text(158, 432, '+1', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#BE7E12',
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);
      this.readyMinus = this.add.text(382, 432, '-1', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#3D78A9',
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);
      this.readyRule = this.add.text(L.ready.x, 588, '地鼠可以点；小白兔是干扰，点到会扣 1 分', {
        fontFamily: FONT, fontSize: '14px', color: '#78634D',
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);
      this.readyButtonText = this.add.text(L.readyButton.x, L.readyButton.y, '开始打地鼠', {
        fontFamily: FONT, fontSize: '25px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#3E7D4A', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);
      this.readyTip = this.add.text(L.ready.x, 694, '点屏幕也可以开始', {
        fontFamily: FONT, fontSize: '13px', color: '#9A846C',
      }).setOrigin(0.5).setDepth(DEPTH.ready + 1);

      // -------------------------------------------------- 结算卡
      this.resultG = this.add.graphics().setDepth(DEPTH.result);
      this.resultTitle = this.add.text(L.result.x, 316, '时间到！', {
        fontFamily: FONT, fontSize: '29px', fontStyle: 'bold', color: '#4D3928',
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.resultScore = this.add.text(L.result.x, 388, '0', {
        fontFamily: FONT, fontSize: '70px', fontStyle: 'bold', color: '#4E9B58',
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.resultCounts = this.add.text(L.result.x, 455, '地鼠 0 只 · 兔子 0 只', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#725B45',
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.resultEquation = this.add.text(L.result.x, 498, '0 - 0 = 0', {
        fontFamily: FONT, fontSize: '16px', color: '#8A735C',
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.resultMessage = this.add.text(L.result.x, 539, '', {
        fontFamily: FONT, fontSize: '15px', color: '#8A735C',
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.resultButtonText = this.add.text(L.resultButton.x, L.resultButton.y, '再玩一次', {
        fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#3E7D4A', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.resultTip = this.add.text(L.result.x, 665, '点屏幕也可以再来一局', {
        fontFamily: FONT, fontSize: '13px', color: '#9A846C',
      }).setOrigin(0.5).setDepth(DEPTH.result + 1);
      this.setResultVisible(false);

      this.input.on('pointerdown', function (p) { this.onPointerDown(p); }, this);

      this.resetRoundState();
      this.phase = 'ready';
      this.setReadyVisible(true);
      this.render();
    }

    setReadyVisible(v) {
      const all = [this.readyG, this.readyTitle, this.readySub, this.readyPlus, this.readyMinus,
        this.readyRule, this.readyButtonText, this.readyTip];
      for (let i = 0; i < all.length; i++) all[i].setVisible(v);
    }

    setResultVisible(v) {
      const all = [this.resultG, this.resultTitle, this.resultScore, this.resultCounts,
        this.resultEquation, this.resultMessage, this.resultButtonText, this.resultTip];
      for (let i = 0; i < all.length; i++) all[i].setVisible(v);
    }

    resetRoundState() {
      this.timeLeft = GAME_SEC;
      this.elapsed = 0;
      this.score = 0;
      this.molesHit = 0;
      this.rabbitsHit = 0;
      this.spawnTimer = 0.38;
      this.firstSpawn = true;
      this.activeCount = 0;
      this.overT = 0;
      this.resultShown = false;
      this.lastTickSecond = GAME_SEC;
      this.scorePulse = 0;
      this.clearLiveProps();
      for (let i = 0; i < this.holes.length; i++) {
        const h = this.holes[i];
        h.type = null;
        h.state = 'hidden';
        h.t = 0;
        h.stay = 0;
        h.recent = 0;
        if (this.critterGs[i]) {
          this.critterGs[i].clear();
          this.critterGs[i].setVisible(false);
          this.critterGs[i].setScale(1, 1);
          this.critterGs[i].setAlpha(1);
        }
      }
      if (this.fxG) this.fxG.clear();
      this.setResultVisible(false);
    }

    clearLiveProps() {
      for (let i = 0; i < this.liveProps.length; i++) {
        const p = this.liveProps[i];
        if (p && p.textObj && p.textObj.destroy) p.textObj.destroy();
      }
      this.liveProps.length = 0;
    }

    // -------------------------------------------------- 开始 / 重开
    startGame() {
      Sound.resume();
      this.resetRoundState();
      this.phase = 'playing';
      this.setReadyVisible(false);
      this.setResultVisible(false);
      this.spawnTimer = 0.4;
      this.firstSpawn = true;
      Sound.start();
      this.render();
    }

    tryRestart() {
      if (this.phase !== 'over') return false;
      if (!this.resultShown || this.overT < RESULT_LOCK_SEC) return false;
      this.startGame();
      return true;
    }

    onPointerDown(p) {
      Sound.resume();
      if (this.phase === 'ready') {
        this.startGame();
        return;
      }
      if (this.phase === 'over') {
        this.tryRestart();
        return;
      }
      if (this.phase !== 'playing') return;
      const idx = this.holeAt(p.x, p.y);
      if (idx >= 0) this.hitHole(idx);
    }

    holeAt(x, y) {
      for (let i = 0; i < this.holes.length; i++) {
        const h = this.holes[i];
        if (Math.abs(x - h.x) <= 80 && y >= h.y - 140 && y <= h.y + 53) return i;
      }
      return -1;
    }

    // -------------------------------------------------- 难度与生成
    difficulty() {
      const u = clamp(this.elapsed / GAME_SEC, 0, 1);
      const maxActive = this.elapsed < 20 ? MAX_ACTIVE[0] : this.elapsed < 40 ? MAX_ACTIVE[1] : MAX_ACTIVE[2];
      const gapBase = lerp(0.95, 0.45, u);
      const lifeBase = lerp(1.45, 0.85, u);
      const rabbitChance = this.elapsed < 4 ? 0 : lerp(RABBIT_CHANCE_MIN, RABBIT_CHANCE_MAX, clamp((this.elapsed - 4) / (GAME_SEC - 4), 0, 1));
      return {
        maxActive: maxActive,
        gapMin: gapBase - 0.12,
        gapMax: gapBase + 0.12,
        lifeMin: lifeBase - 0.2,
        lifeMax: lifeBase + 0.2,
        rabbitChance: rabbitChance,
        burstChance: lerp(0.15, 0.45, u),
      };
    }

    activeRabbits() {
      let n = 0;
      for (let i = 0; i < this.holes.length; i++) {
        const h = this.holes[i];
        if (h.type === 'rabbit' && (h.state === 'rising' || h.state === 'up')) n++;
      }
      return n;
    }

    countActive() {
      let n = 0;
      for (let i = 0; i < this.holes.length; i++) {
        const h = this.holes[i];
        if (h.state === 'rising' || h.state === 'up') n++;
      }
      return n;
    }

    spawnOne(type, holeIndex) {
      if (this.phase !== 'playing') return null;
      const diff = this.difficulty();
      if (this.countActive() >= diff.maxActive) return null;

      let idx = -1;
      if (holeIndex != null && isFinite(Number(holeIndex))) {
        idx = Math.round(Number(holeIndex));
        if (idx < 0 || idx >= HOLE_COUNT) return null;
        if (this.holes[idx].state !== 'hidden' || this.holes[idx].recent > 0) return null;
      } else {
        const avail = [];
        for (let i = 0; i < this.holes.length; i++) {
          if (this.holes[i].state === 'hidden' && this.holes[i].recent <= 0) avail.push(i);
        }
        if (!avail.length) return null;
        idx = avail[Math.floor(Math.random() * avail.length)];
      }

      let kind = type;
      if (kind !== 'mole' && kind !== 'rabbit') {
        kind = (this.elapsed >= 4 && this.activeRabbits() < 1 && Math.random() < diff.rabbitChance) ? 'rabbit' : 'mole';
      }
      if (kind === 'rabbit' && this.activeRabbits() >= 1) return null;

      const h = this.holes[idx];
      h.type = kind;
      h.state = 'rising';
      h.t = 0;
      h.stay = rand(diff.lifeMin, diff.lifeMax);
      h.riseDur = RISE_SEC;
      h.sinkDur = SINK_SEC;
      h.recent = 0;
      const g = this.critterGs[idx];
      g.clear();
      if (kind === 'rabbit') drawRabbit(g, 0, 0, 1); else drawMole(g, 0, 0, 1);
      g.setPosition(h.x, h.hiddenY);
      g.setVisible(true);
      g.setAlpha(1);
      g.setScale(1, 1);
      Sound.pop();
      this.activeCount = this.countActive();
      return h;
    }

    spawnWave() {
      const d = this.difficulty();
      const free = Math.max(0, d.maxActive - this.countActive());
      if (free <= 0) return [];
      let want = 1;
      if (free > 1 && Math.random() < d.burstChance) want = 2;
      want = Math.min(want, free);
      const spawned = [];
      for (let i = 0; i < want; i++) {
        const h = this.spawnOne();
        if (h) spawned.push(h);
      }
      this.activeCount = this.countActive();
      return spawned;
    }
    // -------------------------------------------------- 命中与目标生命周期
    hitHole(index) {
      if (this.phase !== 'playing') return 'idle';
      const i = Math.round(Number(index));
      if (!isFinite(i) || i < 0 || i >= this.holes.length) return 'miss';
      const h = this.holes[i];
      if (h.state !== 'rising' && h.state !== 'up') {
        Sound.whiff();
        return 'miss';
      }
      h.state = 'hit';
      h.t = 0;
      if (h.type === 'rabbit') {
        this.rabbitsHit += 1;
        this.score = this.molesHit - this.rabbitsHit;
        this.spawnHitFx(h);
        Sound.hitRabbit();
      } else {
        this.molesHit += 1;
        this.score = this.molesHit - this.rabbitsHit;
        this.spawnHitFx(h);
        Sound.hitMole();
      }
      const g = this.critterGs[i];
      g.setScale(1.08, 0.82);
      this.scorePulse = 0.28;
      this.activeCount = this.countActive();
      return h.type;
    }

    updateHoles(dt) {
      for (let i = 0; i < this.holes.length; i++) {
        const h = this.holes[i];
        h.recent = Math.max(0, h.recent - dt);
        const g = this.critterGs[i];
        if (h.state === 'hidden') {
          if (g.visible) g.setVisible(false);
          continue;
        }
        if (h.state === 'rising') {
          h.t += dt;
          const p = clamp(h.t / h.riseDur, 0, 1);
          g.setPosition(h.x, lerp(h.hiddenY, h.upY, easeOut(p)));
          if (p >= 1) {
            h.state = 'up';
            h.t = 0;
            g.setPosition(h.x, h.upY);
          }
        } else if (h.state === 'up') {
          h.t += dt;
          g.setPosition(h.x, h.upY + Math.sin(this.clock * 5 + i * 1.7) * 1.8);
          if (h.t >= h.stay) {
            h.state = 'sinking';
            h.t = 0;
            h.sinkDur = SINK_SEC;
          }
        } else if (h.state === 'hit') {
          h.t += dt;
          g.setPosition(h.x, h.upY + 5);
          if (h.t >= HIT_SEC) {
            h.state = 'sinking';
            h.t = 0;
            h.sinkDur = 0.1;
          }
        } else if (h.state === 'sinking') {
          h.t += dt;
          const p = clamp(h.t / h.sinkDur, 0, 1);
          g.setPosition(h.x, lerp(h.upY, h.hiddenY, p));
          g.setAlpha(1 - p * 0.3);
          if (p >= 1) {
            h.state = 'hidden';
            h.t = 0;
            h.type = null;
            h.recent = HOLE_COOLDOWN;
            g.setVisible(false);
            g.setAlpha(1);
            g.setScale(1, 1);
          }
        }
      }
      this.activeCount = this.countActive();
    }

    spawnHitFx(h) {
      const isRabbit = h.type === 'rabbit';
      const textColor = isRabbit ? '#3D78A9' : '#C98512';
      const label = this.add.text(h.x, h.y - 73, isRabbit ? '-1' : '+1', {
        fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: textColor,
        stroke: '#FFFFFF', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.fx + 1);
      this.liveProps.push({ kind: 'label', x: h.x, y: h.y - 73, textObj: label, life: 0.7, maxLife: 0.7 });
      const n = isRabbit ? 7 : 9;
      const cols = isRabbit ? [0x9FD8FF, 0xFFFFFF, 0x7FB9EC] : [C.gold, 0xFFF2A8, 0xFFFFFF];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.05;
        const sp = rand(70, 150);
        this.liveProps.push({
          kind: i % 3 === 0 ? 'dot' : 'star',
          x: h.x, y: h.y - 56,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 25,
          rot: Math.random() * TAU,
          vr: rand(-6, 6),
          size: rand(4, 8),
          color: cols[i % cols.length],
          life: rand(0.42, 0.72),
          maxLife: 0.72,
          gravity: 260,
        });
      }
    }

    updateLiveProps(dt) {
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const p = this.liveProps[i];
        p.life -= dt;
        if (p.kind === 'label') {
          p.y -= 34 * dt;
          if (p.textObj) {
            p.textObj.y = p.y;
            p.textObj.setAlpha(clamp(p.life / 0.32, 0, 1));
          }
        } else {
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        }
        if (p.life <= 0) {
          if (p.textObj && p.textObj.destroy) p.textObj.destroy();
          this.liveProps.splice(i, 1);
        }
      }
    }

    endGame() {
      if (this.phase === 'over') return;
      this.phase = 'over';
      this.timeLeft = 0;
      this.spawnTimer = 9999;
      this.overT = 0;
      this.resultShown = false;
      this.setResultVisible(false);
      for (let i = 0; i < this.holes.length; i++) {
        const h = this.holes[i];
        if (h.state === 'rising' || h.state === 'up' || h.state === 'hit') {
          h.state = 'sinking';
          h.t = 0;
          h.sinkDur = 0.16;
        }
      }
      this.activeCount = 0;
      Sound.end();
    }

    layoutResult() {
      const score = this.score;
      const color = score > 0 ? '#4E9B58' : score < 0 ? '#D06663' : '#B88325';
      this.resultScore.setText(score > 0 ? '+' + score : String(score));
      this.resultScore.setColor(color);
      this.resultCounts.setText('地鼠 ' + this.molesHit + ' 只 · 兔子 ' + this.rabbitsHit + ' 只');
      this.resultEquation.setText(this.molesHit + ' - ' + this.rabbitsHit + ' = ' + score);
      let msg = '再来一局试试看！';
      if (score >= 20) msg = '眼疾手快，太厉害啦！';
      else if (score >= 10) msg = '打得真不错！';
      else if (score < 0) msg = '小白兔有点多，下次看准一点～';
      this.resultMessage.setText(msg);
      this.resultG.clear();
      drawResultCard(this.resultG);
      this.setResultVisible(true);
    }

    // -------------------------------------------------- 每帧
    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.1);
      this.clock += dt;
      if (this.scorePulse > 0) this.scorePulse = Math.max(0, this.scorePulse - dt);
      this.updateLiveProps(dt);

      if (this.phase === 'ready') return;

      if (this.phase === 'over') {
        this.updateHoles(dt);
        this.overT += dt;
        if (!this.resultShown && this.overT >= RESULT_DELAY_SEC) {
          this.resultShown = true;
          this.layoutResult();
        }
        return;
      }

      if (this.phase === 'playing') {
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        this.elapsed += dt;
        const sec = Math.ceil(this.timeLeft);
        if (sec < this.lastTickSecond) {
          this.lastTickSecond = sec;
          if (sec > 0 && sec <= 10) Sound.tick();
        }
        if (this.timeLeft <= 0) {
          this.endGame();
          return;
        }
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          const d = this.difficulty();
          if (this.firstSpawn) {
            this.spawnOne('mole');
            this.firstSpawn = false;
          } else {
            this.spawnWave();
          }
          this.spawnTimer = rand(d.gapMin, d.gapMax);
        }
        this.updateHoles(dt);
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
      this.renderUI();
      this.renderFx();
    }

    renderUI() {
      const g = this.uiG;
      g.clear();
      const urgent = this.phase === 'playing' && this.timeLeft <= 10;
      const timerFill = urgent ? 0xFFE0DA : 0xFFF9EA;
      const timerEdge = urgent ? C.coral : C.goldDeep;
      drawPill(g, L.timer.x, L.timer.y, L.timer.w, L.timer.h, timerFill, timerEdge, 2.5);
      drawPill(g, L.score.x, L.score.y, L.score.w, L.score.h, 0xFFF9EA, C.goldDeep, 2.5);
      // 小时钟
      g.fillStyle(urgent ? C.coral : 0x7FAC79, 1);
      g.fillCircle(76, L.timer.y, 13);
      g.fillStyle(0xFFFFFF, 1);
      g.fillCircle(76, L.timer.y, 9);
      g.lineStyle(2, urgent ? C.coralDeep : 0x5D8659, 1);
      g.lineBetween(76, L.timer.y, 76, L.timer.y - 5);
      g.lineBetween(76, L.timer.y, 81, L.timer.y + 2);
      // 小星星
      drawStar(g, 346, L.score.y, 10, C.gold, 1, 5);
      drawStar(g, 346, L.score.y, 4.2, 0xFFFFFF, 0.85, 5);
      if (urgent) {
        const a = 0.34 + Math.sin(this.clock * 8) * 0.18;
        g.lineStyle(3, C.coral, a);
        g.strokeRoundedRect(L.timer.x - L.timer.w / 2 - 4, L.timer.y - L.timer.h / 2 - 4, L.timer.w + 8, L.timer.h + 8, 30);
      }
      this.timerText.setText(String(Math.ceil(this.timeLeft)));
      this.timerText.setColor(urgent ? '#B34C49' : '#4F3A29');
      this.scoreText.setText(this.score > 0 ? '+' + this.score : String(this.score));
      this.scoreText.setColor(this.score > 0 ? '#3F7A46' : this.score < 0 ? '#C45C59' : '#4F3A29');
      const pulse = 1 + Math.sin((0.28 - this.scorePulse) * 28) * (this.scorePulse > 0 ? 0.13 : 0);
      this.scoreText.setScale(pulse);
    }

    renderFx() {
      this.fxG.clear();
      for (let i = 0; i < this.liveProps.length; i++) {
        const p = this.liveProps[i];
        if (p.kind === 'label') continue;
        const a = clamp(p.life / 0.3, 0, 1);
        if (p.kind === 'dot') {
          this.fxG.fillStyle(p.color, a * 0.9);
          this.fxG.fillCircle(p.x, p.y, p.size * 0.55);
        } else {
          drawStar(this.fxG, p.x, p.y, p.size, p.color, a, 4);
        }
      }
    }

    update(time, delta) {
      this.step((delta || 0) / 1000);
      this.render();
    }
  }

  window.MoleScene = MoleScene;
})();
