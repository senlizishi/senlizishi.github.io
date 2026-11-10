/*
 * 小狗浇花：540x960 竖屏低龄向浇花小游戏。
 * 按住拖动水管，让 8 朵花从种子、幼芽、花骨朵到盛开；开花时揭晓普通或稀有花，无计时、无分数、无失败。
 * 全部画面由 Phaser.Graphics 程序化绘制，音效由 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const TAU = Math.PI * 2;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TITLE_FONT = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "Microsoft YaHei", serif';
  const FLOWER_COUNT = 8;
  const WATER_TO_SPROUT = 0.28;
  const WATER_TO_BUD = 0.62;
  const WATER_TO_BLOOM = 1.0;
  const RARE_CHANCE = 0.1;
  const REVEAL_CHIP_SEC = 1.5;
  const RARE_BANNER_SEC = 1.4;
  const RARE_BURST_SEC = 0.9;
  const WATER_MAX = 1.2;
  const WATER_RATE = 0.62;
  const SPRAY_RADIUS = 52;
  const ROUND_DELAY = 0.8;
  const TAP_LOCK = 0.5;
  const DOG_Y = 770;
  const DOG_MIN_X = 92;
  const DOG_MAX_X = 448;
  const GARDEN = { left: 10, right: 530, top: 190, bottom: 700 };

  const DEPTH = {
    world: 0,
    flowers: 6,
    hose: 7,
    dog: 9,
    water: 11,
    fx: 14,
    reveal: 18,
    ui: 20,
    overlay: 40,
    card: 41,
  };

  const C = {
    skyTop: 0xBFE9FF,
    skyBottom: 0xEAF9FF,
    grass: 0xA8D98A,
    grassDark: 0x83B96A,
    grassLight: 0xC7E9A8,
    soilDry: 0xBE8B5E,
    soilWet: 0x8A5838,
    soilDark: 0x6A4029,
    seed: 0x8E5C3A,
    seedLight: 0xD3A16C,
    leaf: 0x75B95F,
    leafDark: 0x4E8C46,
    stem: 0x5E9B50,
    fence: 0xFFF9EC,
    fenceShade: 0xE2D1B5,
    path: 0xE8D5B5,
    pathLight: 0xFFF0D3,
    dog: 0xE8A45A,
    dogDark: 0xC47B3C,
    dogPale: 0xFFF1D8,
    dogBlush: 0xF2A69E,
    collar: 0x4CA6D8,
    water: 0x87D8FF,
    waterLight: 0xE2FAFF,
    wood: 0xC98A4F,
    woodDark: 0x83502D,
    cream: 0xFFF8EA,
    ink: 0x435B3D,
    inkSoft: 0x708263,
    greenButton: 0x5DA566,
    greenDark: 0x3F7C4D,
    red: 0xDB7A72,
    white: 0xFFFFFF,
    gold: 0xE7B84C,
    goldLight: 0xFFF1B8,
    rarePink: 0xF3A7D4,
    rareBlue: 0x8FB8F6,
    rarePurple: 0xBFA7F0,
  };

  const FLOWER_SPECIES = [
    { key: 'daisy', name: '雏菊', rarity: 'common', petals: [0xFFF6F8, 0xFFDCE8, 0xFFF0C7], center: 0xFFD44E, count: 8, radius: 21, petalR: 12 },
    { key: 'tulip', name: '郁金香', rarity: 'common', petals: [0xFF8FA3, 0xF7A8C4, 0xC7A4F0], center: 0xFFD9A6, count: 3, radius: 17, petalR: 16 },
    { key: 'sunflower', name: '向日葵', rarity: 'common', petals: [0xFFC93C, 0xFFB13C, 0xFFE06A], center: 0x8A4F2A, count: 12, radius: 23, petalR: 9 },
    { key: 'bluebell', name: '蓝铃花', rarity: 'common', petals: [0x8FB8F6, 0xA8D7FF, 0xB9A7F0], center: 0xFFF3A8, count: 5, radius: 19, petalR: 13 },
    { key: 'rose', name: '玫瑰', rarity: 'common', petals: [0xEF7FA8, 0xE86E83, 0xF3A1C0], center: 0xB84A6B, count: 5, radius: 17, petalR: 15 },
    { key: 'hydrangea', name: '绣球花', rarity: 'common', petals: [0x78A8EC, 0x9C8EE8, 0xB8D8FF], center: 0xFFF2B0, count: 9, radius: 18, petalR: 8 },
    { key: 'lotus', name: '荷花', rarity: 'common', petals: [0xFFA8C1, 0xFFC5D6, 0xFFE0B8], center: 0xFFD65E, count: 8, radius: 22, petalR: 11 },
    { key: 'rainbow', name: '彩虹花', rarity: 'rare', petals: [0xFF7088, 0xFFB84D, 0xFFE45C, 0x73D68E, 0x63BCEE, 0xA48BEA], center: 0xFFE27A, count: 10, radius: 24, petalR: 11, rainbow: true },
    { key: 'moonflower', name: '月光花', rarity: 'rare', petals: [0xEAF7FF, 0xC7E6FF, 0xB5D2FF], center: 0xFFF4B3, count: 8, radius: 27, petalR: 10.5, moon: true },
    { key: 'crystal', name: '水晶花', rarity: 'rare', petals: [0xBFF4FF, 0xD9C8FF, 0xA9E7D8], center: 0xFFFFFF, count: 8, radius: 27, petalR: 12, crystal: true },
  ];

  const RARITY_TIERS = {
    common: { key: 'common', label: '普通', color: 0x5D7B50, badge: 0xEAF4DE, star: 0x9CC77E, stars: 1 },
    rare: { key: 'rare', label: '稀有', color: 0x8A4E93, badge: 0xFFE2F4, star: 0xF3A7D4, stars: 2 },
  };

  const SPECIES_BY_RARITY = { common: [], rare: [] };
  for (let i = 0; i < FLOWER_SPECIES.length; i++) {
    SPECIES_BY_RARITY[FLOWER_SPECIES[i].rarity].push(FLOWER_SPECIES[i]);
  }

  function shuffleWith(list, rng) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function emptyRevealFx() {
    return { flash: 0, banner: 0, burst: 0, rarity: null, speciesName: '', jump: 0, x: 0, y: 0, colors: [] };
  }

  function flowerHeadPoint(f) {
    const stage = clamp(f.stage || 0, 0, 3);
    const growth = [0, 0.34, 0.62, 1][stage];
    return { x: f.x, y: lerp(f.baseY - 6, f.y, growth) };
  }

  function computeLayout() {
    const cols = [95, 215, 335, 455];
    const rowY = [390, 570];
    const baseY = [470, 650];
    const spots = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        spots.push({ x: cols[c], y: rowY[r], baseY: baseY[r] });
      }
    }
    return {
      title: { x: 270, y: 48 },
      subtitle: { x: 270, y: 82 },
      progress: { x: 462, y: 68, w: 108, h: 48 },
      garden: GARDEN,
      cols: cols,
      rowY: rowY,
      baseY: baseY,
      flowerSpots: spots,
      dog: { x: 270, y: DOG_Y, minX: DOG_MIN_X, maxX: DOG_MAX_X },
      hint: { x: 270, y: 895, w: 390, h: 38 },
      rareBanner: { x: 270, y: 250, w: 340, h: 92 },
      card: { x: 270, y: 480, w: 430, h: 380 },
    };
  }

  const L = computeLayout();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function blend(a, b, t) {
    t = clamp(t, 0, 1);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(lerp(ar, br, t)) << 16)
      | (Math.round(lerp(ag, bg, t)) << 8)
      | Math.round(lerp(ab, bb, t));
  }

  function lighten(hex, amount) {
    return blend(hex, 0xFFFFFF, amount);
  }

  function darken(hex, amount) {
    return blend(hex, 0x000000, amount);
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pseudo(i) {
    const v = Math.sin(i * 127.1 + 31.7) * 43758.5453;
    return v - Math.floor(v);
  }

  function drawRounded(g, x, y, w, h, r, fill, stroke, alpha, lineAlpha, lw) {
    g.fillStyle(fill, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke != null) {
      g.lineStyle(lw || 2, stroke, lineAlpha == null ? 1 : lineAlpha);
      g.strokeRoundedRect(x, y, w, h, r);
    }
  }

  function drawPill(g, x, y, w, h, fill, stroke, alpha, lineAlpha) {
    drawRounded(g, x - w / 2, y - h / 2, w, h, h / 2, fill, stroke, alpha, lineAlpha, 2);
  }

  function drawStar(g, x, y, r, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.fillTriangle(x, y - r, x + r * 0.75, y, x, y + r);
    g.fillTriangle(x, y - r, x - r * 0.75, y, x, y + r);
  }

  function drawWorld(g) {
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyBottom, C.skyBottom, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 230, WIDTH, HEIGHT - 230);

    // 远处树丛和草坡
    g.fillStyle(0x96C979, 1);
    g.fillEllipse(70, 246, 220, 92);
    g.fillEllipse(430, 240, 260, 104);
    g.fillStyle(0x83B96A, 0.75);
    g.fillEllipse(270, 260, 360, 74);

    // 云朵
    const clouds = [[82, 142, 0.9], [386, 120, 0.72], [210, 188, 0.58]];
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      g.fillStyle(0xFFFFFF, 0.72 * c[2]);
      g.fillEllipse(c[0], c[1], 76, 24);
      g.fillEllipse(c[0] - 24, c[1] - 8, 48, 28);
      g.fillEllipse(c[0] + 24, c[1] - 4, 54, 30);
    }

    // 太阳
    g.fillStyle(0xFFF4BE, 0.16);
    g.fillCircle(468, 178, 68);
    g.fillStyle(0xFFF0A8, 0.25);
    g.fillCircle(468, 178, 48);
    g.fillStyle(0xFFE883, 1);
    g.fillCircle(468, 178, 30);
    g.fillStyle(0xFFF7C9, 0.7);
    g.fillCircle(459, 169, 11);

    // 栅栏
    g.fillStyle(0xFFFFFF, 0.28);
    g.fillRect(15, 272, 510, 8);
    for (let x = 24; x < 520; x += 38) {
      g.fillStyle(C.fence, 1);
      g.fillTriangle(x, 226, x + 12, 214, x + 24, 226);
      g.fillRect(x + 3, 226, 18, 70);
      g.fillStyle(C.fenceShade, 0.5);
      g.fillRect(x + 3, 282, 18, 5);
    }
    g.fillStyle(C.fence, 1);
    g.fillRect(15, 245, 510, 9);
    g.fillRect(15, 278, 510, 9);
    g.fillStyle(C.fenceShade, 0.7);
    g.fillRect(15, 251, 510, 3);
    g.fillRect(15, 284, 510, 3);

    // 草地纹理与碎石
    for (let i = 0; i < 90; i++) {
      const x = pseudo(i + 1) * WIDTH;
      const y = 300 + pseudo(i + 91) * 580;
      g.lineStyle(1.2, i % 3 ? C.grassDark : C.grassLight, 0.28);
      g.lineBetween(x, y, x + 3, y - 7);
      g.lineBetween(x + 4, y, x + 7, y - 5);
    }

    // 两条花圃的柔和底色
    g.fillStyle(0x7EA466, 0.24);
    g.fillRoundedRect(24, 432, 492, 76, 38);
    g.fillRoundedRect(24, 612, 492, 76, 38);

    // 石头小路
    g.fillStyle(C.path, 0.78);
    g.fillEllipse(270, 780, 520, 190);
    g.fillStyle(C.pathLight, 0.55);
    g.fillEllipse(270, 748, 460, 100);
    for (let i = 0; i < 12; i++) {
      const x = 80 + i * 36;
      const y = 770 + Math.sin(i * 1.7) * 22;
      g.fillStyle(i % 2 ? 0xD7C09B : 0xE6D3B1, 0.8);
      g.fillEllipse(x, y, 31, 13);
      g.fillStyle(0xFFFFFF, 0.18);
      g.fillEllipse(x - 4, y - 3, 18, 4);
    }

    // 左下角卷起来的水管
    g.lineStyle(7, 0x2F7D50, 0.95);
    g.strokeCircle(72, 850, 26);
    g.strokeCircle(72, 850, 18);
    g.strokeCircle(72, 850, 10);
    g.fillStyle(0xB9783E, 1);
    g.fillRoundedRect(42, 832, 18, 12, 4);
    g.fillStyle(0xE1B65A, 1);
    g.fillCircle(43, 838, 5);

    // 几朵背景小花与蝴蝶，增加花园层次
    const deco = [[54, 340, 0xFFDCE8], [486, 354, 0xFFF0C7], [38, 540, 0xC7A4F0], [510, 646, 0xFFE06A]];
    for (let i = 0; i < deco.length; i++) {
      g.fillStyle(C.stem, 0.55);
      g.lineStyle(2, C.stem, 0.55);
      g.lineBetween(deco[i][0], deco[i][1], deco[i][0] + 1, deco[i][1] + 18);
      g.fillStyle(deco[i][2], 0.8);
      g.fillCircle(deco[i][0] - 5, deco[i][1] - 3, 4);
      g.fillCircle(deco[i][0] + 5, deco[i][1] - 3, 4);
      g.fillCircle(deco[i][0], deco[i][1] - 8, 4);
      g.fillStyle(0xFFD44E, 0.9);
      g.fillCircle(deco[i][0], deco[i][1] - 3, 3);
    }
  }

  function drawStemAndLeaves(g, f, headX, headY, lean, stage) {
    const stemTopY = headY + (stage === 1 ? 8 : 12);
    const stemMidY = lerp(f.baseY - 6, stemTopY, 0.5);
    const width = stage === 1 ? 3.5 : 5;
    g.lineStyle(width, C.stem, 1);
    g.beginPath();
    g.moveTo(f.x, f.baseY - 3);
    g.lineTo(f.x - lean * 0.04, stemMidY);
    g.lineTo(headX, stemTopY);
    g.strokePath();
    g.lineStyle(stage === 1 ? 1.4 : 2, lighten(C.stem, 0.25), 0.72);
    g.lineBetween(f.x + 1, f.baseY - 5, headX + 1, stemTopY);

    if (stage === 1) {
      g.fillStyle(C.leaf, 1);
      g.fillEllipse(f.x - 11, stemMidY + 1, 23, 12);
      g.fillEllipse(f.x + 12, stemMidY + 7, 22, 11);
      g.fillStyle(C.leafDark, 0.9);
      g.strokeEllipse(f.x - 11, stemMidY + 1, 23, 12);
      g.strokeEllipse(f.x + 12, stemMidY + 7, 22, 11);
      g.fillStyle(C.leaf, 1);
      g.fillEllipse(headX - 7, headY + 2, 14, 21);
      g.fillEllipse(headX + 7, headY + 3, 14, 21);
      g.fillStyle(C.leafDark, 0.92);
      g.fillEllipse(headX, headY, 7, 15);
      g.fillStyle(lighten(C.leaf, 0.18), 0.9);
      g.fillCircle(headX, headY + 3, 2.4);
      return;
    }

    g.fillStyle(C.leaf, 0.95);
    g.fillEllipse(f.x - 16, stemMidY, 27, 11);
    g.fillStyle(C.leafDark, 0.58);
    g.fillEllipse(f.x - 23, stemMidY + 1, 10, 4);
    g.fillStyle(C.leaf, 0.95);
    g.fillEllipse(f.x + 17, stemMidY + 11, 25, 10);
    g.fillStyle(C.leafDark, 0.58);
    g.fillEllipse(f.x + 24, stemMidY + 12, 9, 3.5);
    g.fillStyle(0x4E8C46, 0.42);
    g.fillTriangle(f.x - 2, stemMidY + 2, f.x + 11, stemMidY + 2, f.x + 4, stemMidY + 15);
  }

  function drawRarityAura(g, f, x, y, clock) {
    if (!f.revealed || f.rarity !== 'rare') return;
    const colors = f.species.petals;
    const pulse = 0.55 + Math.sin(clock * 2.6 + f.phase) * 0.14;
    g.fillStyle(0xFFF4D2, 0.16);
    g.fillCircle(x, y, 54);
    g.fillStyle(0xFFFFFF, 0.08);
    g.fillCircle(x, y, 44);
    for (let i = 0; i < 12; i++) {
      const a = clock * 0.55 + i * TAU / 12;
      const inner = 27 + Math.sin(clock * 3 + i) * 2;
      const outer = 49 + Math.sin(clock * 2.4 + i * 1.3) * 4;
      g.lineStyle(i % 3 === 0 ? 3.4 : 1.8, colors[i % colors.length], (i % 3 === 0 ? 0.36 : 0.22) * pulse + 0.08);
      g.lineBetween(x + Math.cos(a) * inner, y + Math.sin(a) * inner * 0.9, x + Math.cos(a) * outer, y + Math.sin(a) * outer * 0.9);
    }
    g.lineStyle(2, C.gold, 0.45 + Math.sin(clock * 2.2) * 0.1);
    g.strokeCircle(x, y, 41 + Math.sin(clock * 1.9 + f.phase) * 2.5);
    g.lineStyle(1.2, C.rarePink, 0.4);
    g.strokeCircle(x, y, 47 + Math.sin(clock * 1.4 + f.phase) * 2);
    for (let i = 0; i < 5; i++) {
      const a = -clock * 0.75 + i * TAU / 5;
      drawStar(g, x + Math.cos(a) * 47, y + Math.sin(a) * 42, 3.4 + Math.sin(clock * 4 + i) * 0.8, colors[(i + 1) % colors.length], 0.82);
    }
  }

  function drawFlower(g, f, clock, index) {
    const wet = clamp(f.water / WATER_TO_BLOOM, 0, 1);
    const soil = blend(C.soilDry, C.soilWet, wet);
    const stage = clamp(f.stage || 0, 0, 3);
    const wobble = f.wobble > 0 ? Math.sin(clock * 22 + f.phase) * 8 * f.wobble : 0;
    const growth = [0, 0.34, 0.62, 1][stage];
    const lean = Math.sin(clock * 1.5 + f.phase) * 1.7 + wobble * growth;
    const headX = f.x + lean;
    const headY = lerp(f.baseY - 6, f.y, growth);

    if (f.puddle > 0) {
      g.fillStyle(0x6FC9EA, 0.22 * clamp(f.puddle, 0, 1));
      g.fillEllipse(f.x, f.baseY + 4, 92, 29);
      g.lineStyle(1.2, 0xE5FAFF, 0.45 * clamp(f.puddle, 0, 1));
      g.strokeEllipse(f.x, f.baseY + 4, 62, 17);
    }

    g.fillStyle(0x4E6F3D, 0.18);
    g.fillEllipse(f.x + 3, f.baseY + 6, 86, 26);
    g.fillStyle(soil, 1);
    g.fillEllipse(f.x, f.baseY, 78, 23);
    g.fillStyle(lighten(soil, 0.2), 0.72);
    g.fillEllipse(f.x - 5, f.baseY - 4, 58, 10);
    g.fillStyle(darken(soil, 0.18), 0.55);
    g.fillCircle(f.x - 20, f.baseY + 4, 2.2);
    g.fillCircle(f.x + 17, f.baseY - 2, 1.8);
    g.fillCircle(f.x + 26, f.baseY + 7, 1.5);

    if (stage === 0) {
      g.lineStyle(1.1, darken(soil, 0.2), 0.55);
      g.lineBetween(f.x - 25, f.baseY - 1, f.x - 12, f.baseY + 2);
      g.lineBetween(f.x + 15, f.baseY + 1, f.x + 26, f.baseY - 2);
      g.fillStyle(0x4E6F3D, 0.18);
      g.fillEllipse(f.x + 1, f.baseY - 7, 25, 11);
      g.fillStyle(C.seed, 1);
      g.fillEllipse(f.x - 2, f.baseY - 6, 18, 11);
      g.fillStyle(C.seedLight, 0.9);
      g.fillEllipse(f.x - 5, f.baseY - 8, 9, 4);
      g.lineStyle(1.2, darken(C.seed, 0.25), 0.72);
      g.lineBetween(f.x + 1, f.baseY - 11, f.x + 5, f.baseY - 4);
      if (stage === 0 && f.sparkle > 0) {
        drawStar(g, f.x - 18, f.baseY - 12, 3.2, C.waterLight, clamp(f.sparkle, 0, 1));
      }
      return;
    }

    drawRarityAura(g, f, headX, headY, clock);
    drawStemAndLeaves(g, f, headX, headY, lean, stage);

    if (stage === 1) {
      g.fillStyle(lighten(C.leaf, 0.12), 0.75);
      g.fillCircle(headX, headY + 4, 3.2);
    } else if (stage === 2) {
      const budColor = 0x74A95B;
      g.fillStyle(budColor, 1);
      g.fillEllipse(headX - 3, headY + 2, 18, 28);
      g.fillStyle(lighten(budColor, 0.2), 0.95);
      g.fillEllipse(headX + 5, headY - 1, 14, 25);
      g.lineStyle(1.4, darken(budColor, 0.2), 0.75);
      g.strokeEllipse(headX - 3, headY + 2, 18, 28);
      g.fillStyle(C.leafDark, 0.98);
      g.fillTriangle(headX - 11, headY + 17, headX + 11, headY + 17, headX, headY + 5);
      g.fillTriangle(headX - 9, headY + 4, headX + 9, headY + 4, headX, headY + 16);
      g.lineStyle(1.2, lighten(C.leaf, 0.3), 0.65);
      g.lineBetween(headX - 4, headY - 7, headX + 2, headY - 16);
    } else {
      drawBloom(g, headX, headY, f, f.species, f.petalColor, clock);
    }

    if (f.sparkle > 0) {
      const a = clamp(f.sparkle, 0, 1);
      const boost = f.rarity === 'rare' ? 1.55 : 1;
      drawStar(g, headX - 35, headY - 18, (5 + a * 3) * boost, 0xFFF6C9, a);
      drawStar(g, headX + 36, headY - 26, (4 + a * 2) * boost, 0xFFFFFF, a * 0.9);
      drawStar(g, headX + 25, headY + 28, (3 + a * 2) * boost, 0xFFE7A3, a * 0.8);
    }
  }

  function drawBloom(g, x, y, f, species, petal, clock) {
    if (species.key === 'tulip') {
      g.fillStyle(petal, 1);
      g.fillEllipse(x - 15, y - 2, 23, 31);
      g.fillEllipse(x + 15, y - 2, 23, 31);
      g.fillEllipse(x, y - 13, 25, 29);
      g.fillStyle(lighten(petal, 0.28), 0.9);
      g.fillEllipse(x - 3, y - 17, 12, 15);
      g.fillStyle(species.center, 0.92);
      g.fillCircle(x, y + 1, 6);
      return;
    }
    if (species.key === 'rose') {
      g.fillStyle(petal, 1);
      g.fillCircle(x, y, 31);
      g.fillStyle(lighten(petal, 0.18), 1);
      g.fillCircle(x - 4, y - 4, 23);
      g.fillStyle(darken(petal, 0.16), 0.82);
      g.strokeCircle(x - 2, y - 2, 16);
      g.strokeCircle(x + 3, y + 3, 10);
      g.fillStyle(species.center, 0.48);
      g.fillCircle(x + 2, y + 2, 7);
      return;
    }
    if (species.key === 'hydrangea') {
      const florets = [[0,-12],[-10,-5],[10,-5],[-7,7],[7,7],[0,1],[-15,7],[15,7],[0,-22]];
      for (let i = 0; i < florets.length; i++) {
        const fx = x + florets[i][0];
        const fy = y + florets[i][1];
        const col = species.petals[i % species.petals.length];
        g.fillStyle(col, 1);
        g.fillCircle(fx - 3, fy, 4.3);
        g.fillCircle(fx + 3, fy, 4.3);
        g.fillCircle(fx, fy - 4, 4.3);
        g.fillCircle(fx, fy + 4, 4.3);
        g.fillStyle(lighten(col, 0.38), 0.9);
        g.fillCircle(fx, fy, 2.2);
      }
      return;
    }
    if (species.key === 'lotus') {
      for (let layer = 0; layer < 2; layer++) {
        const petals = 8;
        const radius = layer === 0 ? 27 : 17;
        for (let i = 0; i < petals; i++) {
          const a = i * TAU / petals + layer * 0.2;
          const tipX = x + Math.cos(a) * radius;
          const tipY = y + Math.sin(a) * radius * 0.8;
          const nx = -Math.sin(a) * (layer ? 5 : 7);
          const ny = Math.cos(a) * (layer ? 5 : 7);
          g.fillStyle(layer ? lighten(petal, 0.2) : (i % 2 ? lighten(petal, 0.08) : petal), 1);
          g.fillTriangle(x + nx, y + ny, x - nx, y - ny, tipX, tipY);
        }
      }
      g.fillStyle(species.center, 1);
      g.fillCircle(x, y, 8);
      g.fillStyle(0xFFF5C8, 0.8);
      g.fillCircle(x - 2, y - 2, 3);
      return;
    }
    if (species.key === 'rainbow') {
      const rot = clock * 0.5;
      g.fillStyle(0xFFF7D8, 0.16);
      g.fillCircle(x, y, 42);
      for (let i = 0; i < 12; i++) {
        const a = rot + i * TAU / 12;
        const nx = -Math.sin(a) * 7.4;
        const ny = Math.cos(a) * 7.4;
        const tipX = x + Math.cos(a) * (species.radius + 9);
        const tipY = y + Math.sin(a) * (species.radius + 9) * 0.92;
        const color = species.petals[i % species.petals.length];
        g.fillStyle(color, 1);
        g.fillTriangle(x + nx, y + ny, x - nx, y - ny, tipX, tipY);
        g.fillStyle(lighten(color, 0.38), 0.9);
        g.fillCircle(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 3.1);
      }
      g.fillStyle(0xFFF7CF, 1);
      g.fillCircle(x, y, 13);
      g.fillStyle(0xFFD95E, 0.92);
      g.fillCircle(x, y, 8);
      drawStar(g, x, y, 7, 0xFFFFFF, 0.95);
      for (let i = 0; i < 3; i++) {
        const a = -clock * 0.8 + i * TAU / 3;
        drawStar(g, x + Math.cos(a) * 45, y + Math.sin(a) * 38, 3.6, 0xFFFFFF, 0.78);
      }
      return;
    }
    if (species.key === 'moonflower') {
      const rot = -clock * 0.24;
      g.fillStyle(0xBFE8FF, 0.22);
      g.fillCircle(x, y, 45);
      for (let i = 0; i < 6; i++) {
        const a = rot + i * TAU / 6;
        const baseX = x + Math.cos(a) * 17;
        const baseY = y + Math.sin(a) * 16;
        const nx = -Math.sin(a) * 8.5;
        const ny = Math.cos(a) * 8.5;
        const tipX = x + Math.cos(a) * 35;
        const tipY = y + Math.sin(a) * 33;
        g.fillStyle(i % 2 ? lighten(petal, 0.2) : petal, 0.97);
        g.fillTriangle(baseX + nx, baseY + ny, baseX - nx, baseY - ny, tipX, tipY);
        g.fillStyle(0xFFFFFF, 0.55);
        g.fillCircle(x + Math.cos(a) * 23, y + Math.sin(a) * 22, 3.2);
        drawStar(g, tipX, tipY, 2.8, 0xFFFFFF, 0.75);
      }
      g.fillStyle(0xFFF2A8, 1);
      g.fillCircle(x, y, 16);
      g.fillStyle(0x93C7EE, 1);
      g.fillCircle(x + 7.5, y - 4, 13);
      g.lineStyle(1.6, 0xFFE58A, 0.95);
      g.strokeCircle(x, y, 16.5);
      g.fillStyle(0xC7E6FF, 0.9);
      g.fillCircle(x - 3.5, y + 6, 2.4);
      drawStar(g, x - 28, y - 20, 3.6, 0xFFFFFF, 0.9);
      drawStar(g, x + 28, y + 18, 2.8, 0xC7E6FF, 0.86);
      return;
    }
    if (species.key === 'crystal') {
      const rot = clock * 0.3;
      g.fillStyle(0xD9F7FF, 0.2);
      g.fillCircle(x, y, 44);
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < species.count; i++) {
          const a = rot + i * TAU / species.count + layer * Math.PI / species.count;
          const len = layer ? species.radius * 0.56 : species.radius + 7;
          const nx = -Math.sin(a) * (layer ? 5 : 8);
          const ny = Math.cos(a) * (layer ? 5 : 8);
          const midX = x + Math.cos(a) * len * 0.55;
          const midY = y + Math.sin(a) * len * 0.55;
          const tipX = x + Math.cos(a) * len;
          const tipY = y + Math.sin(a) * len;
          const color = species.petals[(i + layer) % species.petals.length];
          g.fillStyle(layer ? lighten(color, 0.34) : color, layer ? 0.9 : 0.96);
          g.fillTriangle(x, y, midX + nx, midY + ny, tipX, tipY);
          g.fillTriangle(x, y, midX - nx, midY - ny, tipX, tipY);
          if (!layer) {
            g.lineStyle(1, 0xFFFFFF, 0.64);
            g.lineBetween(midX, midY, tipX, tipY);
          }
        }
      }
      g.fillStyle(0xFFFFFF, 0.96);
      g.fillCircle(x, y, 11);
      g.fillStyle(0x9FEBFF, 0.92);
      g.fillCircle(x, y, 5.5);
      drawStar(g, x, y, 6, 0xFFFFFF, 0.95);
      for (let i = 0; i < 4; i++) {
        const a = clock * 0.9 + i * TAU / 4;
        drawStar(g, x + Math.cos(a) * 42, y + Math.sin(a) * 36, 3.2, species.petals[i % species.petals.length], 0.85);
      }
      return;
    }
    const count = species.count;
    const start = species.key === 'bluebell' ? -Math.PI * 0.85 : 0;
    for (let i = 0; i < count; i++) {
      const a = start + i * TAU / count;
      const px = x + Math.cos(a) * species.radius;
      const py = y + Math.sin(a) * species.radius;
      g.fillStyle(i % 2 ? lighten(petal, 0.12) : petal, 1);
      g.fillCircle(px, py, species.petalR);
    }
    if (species.key === 'sunflower' || species.key === 'daisy') {
      for (let i = 0; i < count; i++) {
        const a = start + (i + 0.5) * TAU / count;
        const px = x + Math.cos(a) * species.radius * 0.64;
        const py = y + Math.sin(a) * species.radius * 0.64;
        g.fillStyle(lighten(petal, 0.26), 0.72);
        g.fillCircle(px, py, species.petalR * 0.52);
      }
    }
    g.fillStyle(species.center, 1);
    g.fillCircle(x, y, species.key === 'sunflower' ? 12 : 10);
    g.fillStyle(lighten(species.center, 0.26), 0.8);
    g.fillCircle(x - 3, y - 3, 4);
    if (species.key === 'sunflower') {
      g.fillStyle(0x5C351F, 0.52);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        g.fillCircle(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 1.3);
      }
    }
  }

  function drawHose(g, dog, facing, clock) {
    g.fillStyle(0x4F7A3C, 0.2);
    g.fillEllipse(dog.x, dog.y + 57, 112, 22);

    const startX = 82;
    const startY = 846;
    const endX = dog.x - facing * 23;
    const endY = dog.y + 19;
    const ctrlX = (startX + endX) / 2 + Math.sin(clock * 0.7) * 14;
    const ctrlY = 920;
    g.lineStyle(9, 0x2A6F48, 0.82);
    let prevX = startX, prevY = startY;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const mt = 1 - t;
      const x = mt * mt * startX + 2 * mt * t * ctrlX + t * t * endX;
      const y = mt * mt * startY + 2 * mt * t * ctrlY + t * t * endY;
      g.lineBetween(prevX, prevY, x, y);
      prevX = x;
      prevY = y;
    }
    g.lineStyle(4.5, 0x49A66A, 0.94);
    prevX = startX; prevY = startY;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const mt = 1 - t;
      const x = mt * mt * startX + 2 * mt * t * ctrlX + t * t * endX;
      const y = mt * mt * startY + 2 * mt * t * ctrlY + t * t * endY;
      g.lineBetween(prevX, prevY, x, y);
      prevX = x;
      prevY = y;
    }
  }

  function drawDogLocal(g, dog, clock, spraying, moving, celebrating) {
    const wagSpeed = celebrating ? 13 : (spraying ? 10 : 4);
    const wag = Math.sin(clock * wagSpeed + 0.7) * (celebrating ? 0.72 : 0.42);
    const bob = celebrating ? -Math.abs(Math.sin(clock * 5.5)) * 24 : Math.sin(clock * (spraying ? 8 : 3.2)) * 1.5;
    const step = moving ? Math.sin(clock * 13) * 5 : 0;

    // 尾巴
    g.lineStyle(17, C.dogDark, 1);
    g.lineBetween(-36, 5, -54, -10 + wag * 16);
    g.lineStyle(12, C.dog, 1);
    g.lineBetween(-36, 5, -54, -10 + wag * 16);
    g.fillStyle(C.dogPale, 1);
    g.fillCircle(-55, -10 + wag * 16, 6);

    // 后腿与前腿
    g.fillStyle(C.dogDark, 1);
    g.fillRoundedRect(-31, 27 + step, 17, 34, 8);
    g.fillRoundedRect(18, 28 - step, 17, 33, 8);
    g.fillStyle(C.dog, 1);
    g.fillRoundedRect(-12, 30 - step, 17, 33, 8);
    g.fillRoundedRect(33, 27 + step, 16, 34, 8);
    g.fillStyle(C.dogPale, 1);
    g.fillRoundedRect(-32, 53 + step, 19, 10, 5);
    g.fillRoundedRect(-13, 55 - step, 19, 10, 5);
    g.fillRoundedRect(17, 55 - step, 19, 10, 5);
    g.fillRoundedRect(32, 53 + step, 18, 10, 5);

    // 身体
    g.fillStyle(C.dog, 1);
    g.fillEllipse(0, 18 + bob * 0.2, 90, 55);
    g.fillStyle(C.dogPale, 1);
    g.fillEllipse(11, 28 + bob * 0.2, 53, 28);
    g.fillStyle(C.dogDark, 0.28);
    g.fillEllipse(-21, 35 + bob * 0.2, 30, 12);

    // 项圈
    g.fillStyle(C.collar, 1);
    g.fillRoundedRect(18, 2 + bob * 0.2, 13, 24, 6);
    g.fillStyle(0xFFD75E, 1);
    g.fillCircle(24, 22 + bob * 0.2, 4.2);

    // 头
    g.fillStyle(C.dogDark, 1);
    g.fillTriangle(18, -45 + bob, 7, -78 + bob, 34, -58 + bob);
    g.fillTriangle(49, -48 + bob, 65, -76 + bob, 67, -43 + bob);
    g.fillStyle(C.dog, 1);
    g.fillTriangle(21, -47 + bob, 13, -72 + bob, 33, -58 + bob);
    g.fillTriangle(49, -49 + bob, 61, -70 + bob, 62, -46 + bob);
    g.fillStyle(C.dogBlush, 0.9);
    g.fillTriangle(23, -50 + bob, 18, -66 + bob, 29, -58 + bob);
    g.fillTriangle(51, -51 + bob, 58, -64 + bob, 58, -49 + bob);
    g.fillStyle(C.dog, 1);
    g.fillCircle(39, -21 + bob, 29);
    g.fillStyle(lighten(C.dog, 0.2), 0.9);
    g.fillCircle(39, -24 + bob, 24);

    // 白嘴套与腮红
    g.fillStyle(C.dogPale, 1);
    g.fillEllipse(53, -10 + bob, 30, 22);
    g.fillStyle(C.dogBlush, 0.48);
    g.fillEllipse(47, -7 + bob, 9, 5);

    // 眼睛：偶尔眨眼
    const blink = Math.sin(clock * 1.15 + 0.9) > 0.965;
    g.fillStyle(0x3D2D26, 1);
    if (blink) {
      g.lineStyle(2.4, 0x3D2D26, 1);
      g.lineBetween(29, -26 + bob, 36, -26 + bob);
      g.lineBetween(47, -27 + bob, 54, -27 + bob);
    } else {
      g.fillCircle(32, -26 + bob, 3.2);
      g.fillCircle(50, -27 + bob, 3.2);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillCircle(33, -27 + bob, 1.2);
      g.fillCircle(51, -28 + bob, 1.2);
    }

    // 鼻子与嘴
    g.fillStyle(0x3D2D26, 1);
    g.fillEllipse(63, -10 + bob, 8, 6);
    if (spraying || celebrating) {
      g.fillStyle(0x5A302B, 1);
      g.fillEllipse(57, 1 + bob, 10, 7);
      g.fillStyle(0xF28F9D, 1);
      g.fillEllipse(58, 6 + bob, 8, 6);
      g.lineStyle(2, 0xFFFFFF, 0.8);
      g.lineBetween(54, -3 + bob, 50, -1 + bob);
    } else {
      g.lineStyle(2.2, 0x5A302B, 0.85);
      g.lineBetween(56, -2 + bob, 60, 2 + bob);
      g.lineBetween(60, 2 + bob, 64, -1 + bob);
    }

    // 水管喷嘴
    g.lineStyle(7, 0x2A6F48, 1);
    g.lineBetween(61, -4 + bob, 78, -23 + bob);
    g.lineStyle(4, 0x49A66A, 1);
    g.lineBetween(61, -4 + bob, 78, -23 + bob);
    g.fillStyle(0xE1B65A, 1);
    g.fillCircle(79, -24 + bob, 5);
    g.fillStyle(0x8C5A32, 1);
    g.fillCircle(79, -24 + bob, 2);
  }

  // ---------------------------------------------------------------- 音效
  const Sound = (function () {
    let ctx = null;
    let master = null;
    let waterSrc = null;
    let waterGain = null;

    function ensure() {
      if (ctx) return ctx;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.28;
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

    function waterOn() {
      const c = ensure();
      if (!c || waterSrc) return;
      try {
        const size = Math.floor(c.sampleRate * 1.4);
        const buffer = c.createBuffer(1, size, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * 0.32;
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1700;
        filter.Q.value = 0.7;
        const gain = c.createGain();
        gain.gain.setValueAtTime(0.0001, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.018, c.currentTime + 0.15);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start();
        waterSrc = src;
        waterGain = gain;
      } catch (e) {
        waterSrc = null;
        waterGain = null;
      }
    }

    function waterOff() {
      if (!waterSrc || !ctx) return;
      const src = waterSrc;
      const gain = waterGain;
      waterSrc = null;
      waterGain = null;
      try {
        const t = ctx.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        src.stop(t + 0.24);
      } catch (e) { /* ignore */ }
    }

    return {
      resume: resume,
      waterOn: waterOn,
      waterOff: waterOff,
      droplet: function () { tone(780 + Math.random() * 420, 0.05, 0.012, 0, 'sine'); },
      sprout: function () {
        tone(392, 0.08, 0.018, 0, 'sine');
        tone(523.25, 0.12, 0.022, 0.05, 'sine');
      },
      bud: function () {
        tone(523.25, 0.12, 0.026, 0, 'sine');
        tone(659.25, 0.14, 0.022, 0.06, 'sine');
      },
      bloom: function (index, rarity) {
        if (rarity === 'rare') {
          const rareNotes = [659.25, 783.99, 987.77, 1174.66, 1567.98];
          for (let i = 0; i < rareNotes.length; i++) {
            tone(rareNotes[i], 0.55, 0.028, i * 0.055, i % 2 ? 'sine' : 'triangle');
          }
          tone(2637, 0.4, 0.01, 0.16, 'sine');
          return;
        }
        const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5];
        const n = notes[clamp((index || 1) - 1, 0, notes.length - 1)];
        tone(n, 0.22, 0.03, 0, 'triangle');
        tone(n * 1.5, 0.2, 0.014, 0.05, 'sine');
      },
      bark: function () {
        sweep(300, 190, 0.12, 0.024, 'triangle');
        tone(210, 0.1, 0.018, 0.13, 'triangle');
      },
      end: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.7, 0.03, i * 0.07, 'sine');
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class DogWaterScene extends Phaser.Scene {
    constructor() {
      super('DogWaterScene');
    }

    create() {
      this.CONST = {
        WIDTH: WIDTH,
        HEIGHT: HEIGHT,
        FLOWER_COUNT: FLOWER_COUNT,
        WATER_TO_SPROUT: WATER_TO_SPROUT,
        WATER_TO_BUD: WATER_TO_BUD,
        WATER_TO_BLOOM: WATER_TO_BLOOM,
        RARE_CHANCE: RARE_CHANCE,
        RARE_BURST_SEC: RARE_BURST_SEC,
        RARITY_TIERS: Object.assign({}, RARITY_TIERS),
        WATER_MAX: WATER_MAX,
        WATER_RATE: WATER_RATE,
        SPRAY_RADIUS: SPRAY_RADIUS,
        ROUND_DELAY: ROUND_DELAY,
        TAP_LOCK: TAP_LOCK,
        FLOWER_SPECIES: FLOWER_SPECIES.map(function (s) {
          return Object.assign({}, s, { petals: s.petals.slice() });
        }),
        DEPTH: Object.assign({}, DEPTH),
      };
      this.PALETTE = C;
      this.L = L;
      this.renderReady = false;
      this.clock = 0;
      this.phase = 'play';
      this.bloomedCount = 0;
      this.completeTimer = 0;
      this.tapLockUntil = 0;
      this.sprayTick = 0;
      this.liveProps = [];
      this.droplets = [];
      this.confetti = [];
      this.revealLabels = [];
      this.rarityCounts = { common: 0, rare: 0 };
      this.revealFx = emptyRevealFx();
      this.spray = { active: false, pointerId: null, x: 270, y: 390 };
      this.dog = { x: 270, y: DOG_Y, targetX: 270, facing: 1, pose: 'idle' };
      this.flowers = [];
      this.initRound();

      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawWorld(this.worldG);

      this.hoseG = this.add.graphics().setDepth(DEPTH.hose);
      this.flowerG = this.add.graphics().setDepth(DEPTH.flowers);
      this.waterG = this.add.graphics().setDepth(DEPTH.water);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.revealG = this.add.graphics().setDepth(DEPTH.reveal);
      this.bannerRoot = this.add.container(L.rareBanner.x, L.rareBanner.y).setDepth(DEPTH.reveal + 1).setVisible(false);
      this.hudG = this.add.graphics().setDepth(DEPTH.ui);

      this.dogG = this.add.graphics();
      this.dogRoot = this.add.container(this.dog.x, this.dog.y).setDepth(DEPTH.dog);
      this.dogRoot.add(this.dogG);

      this.buildUi();
      this.buildCard();
      this.buildRevealBanner();

      this.renderReady = true;
      this.render();
      this.input.on('pointerdown', this.onPointerDown, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointerupoutside', this.onPointerUp, this);

      this._onVisibility = this.handleVisibility.bind(this);
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', this._onVisibility);
      }
      this.events.once('shutdown', this.onShutdown.bind(this));
      Sound.resume();
    }

    initRound() {
      this.phase = 'play';
      this.bloomedCount = 0;
      this.completeTimer = 0;
      this.tapLockUntil = 0;
      this.spray = { active: false, pointerId: null, x: 270, y: 390 };
      this.dog.x = 270;
      this.dog.y = DOG_Y;
      this.dog.targetX = 270;
      this.dog.facing = 1;
      this.dog.pose = 'idle';
      this.droplets.length = 0;
      this.confetti.length = 0;
      this.revealLabels.length = 0;
      this.rarityCounts = { common: 0, rare: 0 };
      this.revealFx = emptyRevealFx();
      this.sprayTick = 0;
      this.clearLiveProps();
      this.clearRevealFx();
      this.makeFlowers();
      this.updateHud();
      this.hideCard();
    }

    makeFlowers(randomFn) {
      const rng = typeof randomFn === 'function' ? randomFn : Math.random;
      const commonPool = shuffleWith(SPECIES_BY_RARITY.common, rng);
      const rarePool = shuffleWith(SPECIES_BY_RARITY.rare, rng);
      let commonIndex = 0;
      let rareIndex = 0;
      const chosen = [];
      for (let i = 0; i < FLOWER_COUNT; i++) {
        if (rng() < RARE_CHANCE) {
          chosen.push(rarePool[rareIndex % rarePool.length]);
          rareIndex++;
        } else {
          chosen.push(commonPool[commonIndex % commonPool.length]);
          commonIndex++;
        }
      }
      const ordered = shuffleWith(chosen, rng);
      this.flowers = L.flowerSpots.map(function (spot, i) {
        const species = ordered[i];
        const petalIndex = Math.floor(rng() * species.petals.length) % species.petals.length;
        const petalColor = species.petals[petalIndex];
        return {
          id: i,
          species: species,
          rarity: species.rarity,
          petalColor: petalColor,
          x: spot.x,
          y: spot.y,
          baseY: spot.baseY,
          water: 0,
          stage: 0,
          bloomed: false,
          revealed: false,
          revealT: 0,
          wobble: 0,
          puddle: 0,
          sparkle: 0,
          phase: i * 0.83 + rng() * 0.35,
        };
      });
      this.bloomedCount = 0;
      this.rarityCounts = { common: 0, rare: 0 };
      this.updateHud();
    }

    buildUi() {
      const g = this.hudG;
      const p = L.progress;
      g.fillStyle(0x6A4029, 0.2);
      g.fillRoundedRect(p.x - p.w / 2 + 2, p.y - p.h / 2 + 4, p.w, p.h, 16);
      drawRounded(g, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 16, C.cream, C.wood, 0.96, 0.9, 2.5);
      g.fillStyle(0xFFDCE8, 1);
      g.fillCircle(p.x - 31, p.y - 2, 7);
      g.fillCircle(p.x - 39, p.y + 4, 5);
      g.fillCircle(p.x - 23, p.y + 4, 5);
      g.fillStyle(0xFFD44E, 1);
      g.fillCircle(p.x - 31, p.y + 2, 4);

      drawPill(g, L.hint.x, L.hint.y, L.hint.w, L.hint.h, 0xFFF8EA, 0xD8B47C, 0.96, 0.9);

      this.titleText = this.add.text(L.title.x, L.title.y, '小狗浇花', {
        fontFamily: TITLE_FONT, fontSize: '38px', fontStyle: 'bold', color: '#4E6B45',
        stroke: '#FFF8EA', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.titleText.setShadow(0, 3, '#B6D79E', 3, true, true);

      this.subtitleText = this.add.text(L.subtitle.x, L.subtitle.y, '按住拖动水管，看看种子会开出什么花', {
        fontFamily: FONT, fontSize: '13px', color: '#58784F',
        stroke: '#F8FFEF', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.progressText = this.add.text(p.x + 8, p.y, '0 / 8', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#4E6B45',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.hintText = this.add.text(L.hint.x, L.hint.y, '浇水等它长大开花', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#5F724F',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
    }

    buildCard() {
      const card = L.card;
      this.overlayG = this.add.graphics().setDepth(DEPTH.overlay).setVisible(false);
      this.overlayG.fillStyle(0x2F4A2B, 0.46);
      this.overlayG.fillRect(0, 0, WIDTH, HEIGHT);

      this.cardRoot = this.add.container(card.x, card.y).setDepth(DEPTH.card).setVisible(false);
      const g = this.add.graphics();
      g.fillStyle(0x35552F, 0.28);
      g.fillRoundedRect(-card.w / 2 + 4, -card.h / 2 + 8, card.w, card.h, 28);
      drawRounded(g, -card.w / 2, -card.h / 2, card.w, card.h, 28, C.cream, 0xD8B47C, 1, 1, 4);
      g.fillStyle(0xFFF1D8, 0.72);
      g.fillRoundedRect(-card.w / 2 + 10, -card.h / 2 + 10, card.w - 20, 44, 20);

      // 狗狗爪印
      g.fillStyle(0xE8A45A, 0.98);
      g.fillCircle(0, -77, 21);
      g.fillCircle(-25, -96, 9);
      g.fillCircle(-9, -106, 9);
      g.fillCircle(11, -106, 9);
      g.fillCircle(27, -95, 9);
      g.fillStyle(0xFFF1D8, 0.86);
      g.fillCircle(-4, -80, 7);

      drawRounded(g, -105, 83, 210, 54, 27, C.greenButton, C.greenDark, 1, 0.9, 2.5);
      g.fillStyle(0x92CE8A, 0.58);
      g.fillRoundedRect(-99, 87, 198, 18, 9);

      this.cardTitle = this.add.text(0, -145, '花园喝饱啦！', {
        fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#4E6B45',
      }).setOrigin(0.5);
      const number = this.add.text(0, -28, '8', {
        fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#5DA566',
        stroke: '#FFF8EA', strokeThickness: 4,
      }).setOrigin(0.5);
      const small = this.add.text(0, 38, '8 朵花都开啦', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#6A7656',
      }).setOrigin(0.5);
      this.cardSummary = this.add.text(0, 67, '普通 0 · 稀有 0', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#8A765C',
      }).setOrigin(0.5);
      const button = this.add.text(0, 110, '再玩一次', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5);
      const tap = this.add.text(0, 157, '点屏幕也可以', {
        fontFamily: FONT, fontSize: '12px', color: '#91A07E',
      }).setOrigin(0.5);
      this.cardRoot.add([g, this.cardTitle, number, small, this.cardSummary, button, tap]);
    }

    buildRevealBanner() {
      const b = L.rareBanner;
      const g = this.add.graphics();
      g.fillStyle(0x5E3A66, 0.22);
      g.fillRoundedRect(-b.w / 2 + 4, -b.h / 2 + 7, b.w, b.h, 25);
      drawRounded(g, -b.w / 2, -b.h / 2, b.w, b.h, 25, C.cream, C.gold, 1, 1, 3);
      g.fillStyle(0xFFF1B8, 0.62);
      g.fillRoundedRect(-b.w / 2 + 9, -b.h / 2 + 9, b.w - 18, 25, 13);
      const colors = [C.rarePink, C.gold, C.rareBlue, C.leaf, C.rarePurple];
      for (let i = 0; i < colors.length; i++) {
        drawStar(g, -b.w / 2 + 18 + i * 14, b.h / 2 - 16, 3.1, colors[i], 0.9);
      }
      this.bannerTitle = this.add.text(0, -14, '稀有绽放！', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#7A3E86',
        stroke: '#FFF8EA', strokeThickness: 4,
      }).setOrigin(0.5);
      this.bannerName = this.add.text(0, 23, '', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#9A6B18',
      }).setOrigin(0.5);
      this.bannerRoot.add([g, this.bannerTitle, this.bannerName]);
      this.bannerRoot.setVisible(false).setAlpha(0);
    }

    clearRevealFx() {
      this.revealFx = emptyRevealFx();
      if (this.revealG) {
        this.revealG.clear();
        this.revealG.setVisible(false);
      }
      if (this.bannerRoot) {
        this.bannerRoot.setVisible(false).setAlpha(0).setScale(1);
      }
      if (this.revealLabels) this.revealLabels.length = 0;
    }

    updateHud() {
      if (this.progressText) this.progressText.setText(this.bloomedCount + ' / ' + FLOWER_COUNT);
    }

    hideCard() {
      if (this.overlayG) this.overlayG.setVisible(false);
      if (this.cardRoot) {
        if (this.tweens && this.tweens.killTweensOf) this.tweens.killTweensOf(this.cardRoot);
        this.cardRoot.setVisible(false).setAlpha(1).setScale(1);
      }
    }

    showCard() {
      if (!this.overlayG || !this.cardRoot) return;
      this.overlayG.setVisible(true);
      if (this.cardTitle) {
        this.cardTitle.setText(this.rarityCounts.rare > 0 ? '抽到稀有花啦！' : '花园喝饱啦！');
      }
      if (this.cardSummary) {
        this.cardSummary.setText('普通 ' + this.rarityCounts.common + ' · 稀有 ' + this.rarityCounts.rare);
      }
      this.cardRoot.setVisible(true).setAlpha(0).setScale(0.88);
      if (this.tweens && this.tweens.add) {
        this.tweens.add({
          targets: this.cardRoot,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 320,
          ease: 'Back.Out',
        });
      } else {
        this.cardRoot.setAlpha(1).setScale(1);
      }
      this.tapLockUntil = this.clock + TAP_LOCK;
    }

    // -------------------------------------------------- 查询与浇水
    flowerAt(x, y) {
      if (!isFinite(x) || !isFinite(y)) return null;
      for (let i = 0; i < this.flowers.length; i++) {
        const f = this.flowers[i];
        const hp = flowerHeadPoint(f);
        if (dist(x, y, hp.x, hp.y) <= SPRAY_RADIUS + 6) return f;
      }
      return null;
    }

    startSpray(x, y, pointerId) {
      if (this.phase !== 'play' || this.spray.active) return false;
      if (!isFinite(x) || !isFinite(y)) return false;
      if (x < GARDEN.left || x > GARDEN.right || y < GARDEN.top || y > GARDEN.bottom) return false;
      this.spray.active = true;
      this.spray.pointerId = pointerId == null ? 1 : pointerId;
      this.moveSpray(x, y);
      this.dog.pose = 'spray';
      this.sprayTick = 0;
      Sound.resume();
      Sound.waterOn();
      return true;
    }

    moveSpray(x, y) {
      if (!this.spray.active) return false;
      if (!isFinite(x) || !isFinite(y)) return false;
      this.spray.x = clamp(x, GARDEN.left, GARDEN.right);
      this.spray.y = clamp(y, GARDEN.top, GARDEN.bottom);
      this.updateDogTarget();
      return true;
    }

    stopSpray() {
      const was = this.spray.active;
      this.spray.active = false;
      this.spray.pointerId = null;
      this.dog.pose = this.phase === 'over' ? 'celebrate' : 'idle';
      if (was) Sound.waterOff();
      return was;
    }

    updateDogTarget() {
      const desiredFacing = this.spray.x >= this.dog.x ? 1 : -1;
      this.dog.facing = desiredFacing;
      this.dog.targetX = clamp(this.spray.x - desiredFacing * 52, L.dog.minX, L.dog.maxX);
    }

    waterAt(x, y, dt) {
      if (!isFinite(x) || !isFinite(y) || !isFinite(dt) || dt <= 0) return 0;
      let count = 0;
      for (let i = 0; i < this.flowers.length; i++) {
        const f = this.flowers[i];
        const hp = flowerHeadPoint(f);
        if (dist(x, y, hp.x, hp.y) <= SPRAY_RADIUS) {
          this.waterFlower(i, dt);
          count++;
        }
      }
      return count;
    }

    waterFlower(index, dt) {
      if (this.phase !== 'play') return null;
      const f = this.flowers[index];
      if (!f || !isFinite(dt) || dt <= 0) return null;
      f.water = Math.min(WATER_MAX, f.water + WATER_RATE * dt);
      const next = f.water >= WATER_TO_BLOOM ? 3 : (f.water >= WATER_TO_BUD ? 2 : (f.water >= WATER_TO_SPROUT ? 1 : 0));
      if (next > f.stage) {
        const hp = flowerHeadPoint(f);
        f.stage = next;
        f.wobble = 0.55;
        f.sparkle = 0.65;
        this.spawnDroplets(hp.x, hp.y, next === 3 ? 7 : 5, C.waterLight, 34);
        if (next === 1) Sound.sprout();
        else if (next === 2) Sound.bud();
      }
      if (f.stage === 3 && !f.bloomed) {
        const hp = flowerHeadPoint(f);
        f.bloomed = true;
        f.sparkle = 1.2;
        this.bloomedCount++;
        this.spawnDroplets(hp.x, hp.y, 10, 0xFFF3B4, 58);
        this.revealFlower(index);
        this.updateHud();
        this.checkComplete();
      } else if (f.bloomed) {
        f.wobble = Math.max(f.wobble, 0.36);
        f.puddle = Math.max(f.puddle, 0.9);
      }
      return f.stage;
    }

    revealFlower(index) {
      const f = this.flowers[index];
      if (!f || f.revealed) return false;
      const hp = flowerHeadPoint(f);
      const tier = RARITY_TIERS[f.rarity] || RARITY_TIERS.common;
      f.revealed = true;
      f.revealT = REVEAL_CHIP_SEC;
      f.sparkle = Math.max(f.sparkle, 1.25);
      this.rarityCounts[f.rarity] = (this.rarityCounts[f.rarity] || 0) + 1;
      Sound.bloom(this.bloomedCount, f.rarity);
      this.spawnRarityBurst(f, hp.x, hp.y);
      this.showRevealLabel(f, hp.x, hp.y, tier);
      if (f.rarity === 'rare') {
        this.revealFx.flash = 0.5;
        this.revealFx.banner = RARE_BANNER_SEC;
        this.revealFx.burst = RARE_BURST_SEC;
        this.revealFx.rarity = 'rare';
        this.revealFx.speciesName = f.species.name;
        this.revealFx.jump = 1.0;
        this.revealFx.x = hp.x;
        this.revealFx.y = hp.y;
        this.revealFx.colors = f.species.petals.slice();
        if (this.bannerTitle) this.bannerTitle.setText('稀有绽放！');
        if (this.bannerName) this.bannerName.setText(f.species.name + ' 出现了');
        this.spawnConfetti(26);
        Sound.bark();
      }
      return true;
    }

    spawnRarityBurst(f, x, y) {
      if (f.rarity === 'rare') {
        const colors = f.species.petals.concat([C.gold, C.rarePink, 0xFFFFFF]);
        for (let i = 0; i < colors.length; i++) this.spawnDroplets(x, y, 6, colors[i], 86);
        this.spawnDroplets(x, y, 10, C.goldLight, 70);
      } else {
        this.spawnDroplets(x, y, 4, 0xFFF8D8, 34);
      }
    }

    showRevealLabel(f, x, y, tier) {
      const isRare = f.rarity === 'rare';
      const color = isRare ? '#7A3E86' : '#557A4D';
      const label = this.add.text(x, y - 54, tier.label + '花 · ' + f.species.name, {
        fontFamily: FONT,
        fontSize: isRare ? '15px' : '12px',
        fontStyle: 'bold',
        color: color,
        stroke: '#FFF8EA',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH.fx + 2);
      this.trackObj(label);
      this.revealLabels.push({ obj: label, life: REVEAL_CHIP_SEC, total: REVEAL_CHIP_SEC, baseY: y - 54 });
    }

    checkComplete() {
      if (this.phase === 'play' && this.bloomedCount >= FLOWER_COUNT && this.completeTimer <= 0) {
        this.completeTimer = ROUND_DELAY;
        this.stopSpray();
        this.dog.pose = 'celebrate';
        this.spawnConfetti(72);
        Sound.bark();
        Sound.end();
        return true;
      }
      return false;
    }

    spawnDroplets(x, y, count, color, spread) {
      for (let i = 0; i < count; i++) {
        this.droplets.push({
          x: x + (Math.random() - 0.5) * 18,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * (spread || 34),
          vy: -18 - Math.random() * (spread || 34) * 1.2,
          gravity: 190,
          life: 0,
          max: 0.35 + Math.random() * 0.28,
          size: 1.4 + Math.random() * 2.1,
          color: color == null ? C.water : color,
        });
      }
      if (this.droplets.length > 140) this.droplets.splice(0, this.droplets.length - 140);
    }

    spawnConfetti(count) {
      const colors = [0xFF8FA3, 0xFFC93C, 0x8FB8F6, 0xA8D7FF, 0xF3A1C0, 0xFFF0C7, 0x75B95F];
      for (let i = 0; i < count; i++) {
        this.confetti.push({
          x: 60 + Math.random() * 420,
          y: 110 + Math.random() * 170,
          vx: (Math.random() - 0.5) * 54,
          vy: -12 - Math.random() * 65,
          gravity: 130,
          life: 0,
          max: 2.2 + Math.random() * 1.5,
          size: 4 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          spin: Math.random() * TAU,
          spinV: (Math.random() - 0.5) * 5,
        });
      }
      if (this.confetti.length > 140) this.confetti.splice(0, this.confetti.length - 140);
    }

    tryRestart() {
      if (this.phase !== 'over') return false;
      this.initRound();
      if (this.renderReady) this.render();
      Sound.resume();
      return true;
    }

    // -------------------------------------------------- 主循环
    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.1);
      this.clock += dt;
      this.stepReveal(dt);

      if (this.phase === 'play' && this.spray.active) {
        this.updateDogTarget();
        const k = clamp(dt * 6.5, 0, 1);
        this.dog.x += (this.dog.targetX - this.dog.x) * k;
        this.dog.pose = 'spray';
        this.waterAt(this.spray.x, this.spray.y, dt);
        this.sprayTick -= dt;
        if (this.sprayTick <= 0) {
          this.spawnDroplets(this.spray.x, this.spray.y, 1, C.waterLight, 24);
          Sound.droplet();
          this.sprayTick = 0.12 + Math.random() * 0.08;
        }
      } else if (this.completeTimer > 0 || this.phase === 'over') {
        this.dog.pose = 'celebrate';
      } else {
        this.dog.pose = 'idle';
      }

      if (this.completeTimer > 0) {
        this.completeTimer -= dt;
        if (this.completeTimer <= 0 && this.phase === 'play') {
          this.completeTimer = 0;
          this.phase = 'over';
          this.dog.pose = 'celebrate';
          this.showCard();
        }
      }

      for (let i = 0; i < this.flowers.length; i++) {
        const f = this.flowers[i];
        f.wobble = Math.max(0, f.wobble - dt * 2.2);
        f.puddle = Math.max(0, f.puddle - dt * 0.42);
        f.sparkle = Math.max(0, f.sparkle - dt * 1.35);
        f.revealT = Math.max(0, (f.revealT || 0) - dt);
      }
      this.updateParticles(dt);
      if (this.renderReady) this.render();
    }

    stepReveal(dt) {
      if (!this.revealFx) return;
      if (this.revealFx.flash > 0) this.revealFx.flash = Math.max(0, this.revealFx.flash - dt);
      if (this.revealFx.burst > 0) this.revealFx.burst = Math.max(0, this.revealFx.burst - dt);
      if (this.revealFx.banner > 0) this.revealFx.banner = Math.max(0, this.revealFx.banner - dt);
      if (this.revealFx.jump > 0) this.revealFx.jump = Math.max(0, this.revealFx.jump - dt);
      const labels = this.revealLabels || [];
      for (let i = labels.length - 1; i >= 0; i--) {
        const item = labels[i];
        item.life -= dt;
        const age = item.total - item.life;
        const fadeIn = clamp(age / 0.14, 0, 1);
        const fadeOut = clamp(item.life / 0.36, 0, 1);
        const alpha = Math.min(fadeIn, fadeOut);
        if (item.obj) {
          item.obj.setY(item.baseY - age * 14);
          item.obj.setAlpha(alpha);
        }
        if (item.life <= 0) {
          labels.splice(i, 1);
          if (item.obj) this.untrackObj(item.obj);
        }
      }
    }

    updateParticles(dt) {
      for (let i = 0; i < this.droplets.length; i++) {
        const p = this.droplets[i];
        p.life += dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      this.droplets = this.droplets.filter(function (p) { return p.life < p.max; });

      for (let i = 0; i < this.confetti.length; i++) {
        const p = this.confetti[i];
        p.life += dt;
        p.vy += p.gravity * dt;
        p.x += (p.vx + Math.sin(p.spin) * 9) * dt;
        p.y += p.vy * dt;
        p.spin += p.spinV * dt;
      }
      this.confetti = this.confetti.filter(function (p) { return p.life < p.max && p.y < HEIGHT + 40; });
    }

    dogJumpOffset() {
      if (this.completeTimer > 0 || this.phase === 'over') {
        return -Math.abs(Math.sin(this.clock * 5.5)) * 24;
      }
      if (this.revealFx && this.revealFx.jump > 0) {
        return -Math.abs(Math.sin(this.clock * 9)) * 15;
      }
      return 0;
    }

    nozzlePoint() {
      const jump = this.dogJumpOffset();
      return { x: this.dog.x + this.dog.facing * 82, y: this.dog.y - 24 + jump };
    }

    render() {
      if (!this.renderReady) return;
      this.flowerG.clear();
      for (let i = 0; i < this.flowers.length; i++) drawFlower(this.flowerG, this.flowers[i], this.clock, i);

      this.hoseG.clear();
      drawHose(this.hoseG, this.dog, this.dog.facing, this.clock);

      const jump = this.dogJumpOffset();
      this.dogRoot.setPosition(this.dog.x, this.dog.y + jump);
      this.dogRoot.setScale(this.dog.facing, 1);
      this.dogG.clear();
      const spraying = this.spray.active && this.phase === 'play';
      const moving = Math.abs(this.dog.targetX - this.dog.x) > 2;
      const celebrating = this.completeTimer > 0 || this.phase === 'over' || (this.revealFx && this.revealFx.jump > 0);
      drawDogLocal(this.dogG, this.dog, this.clock, spraying, moving, celebrating);

      this.waterG.clear();
      if (spraying) this.drawWaterStream(this.waterG);

      this.fxG.clear();
      for (let i = 0; i < this.droplets.length; i++) {
        const p = this.droplets[i];
        const a = 1 - p.life / p.max;
        this.fxG.fillStyle(p.color, a * 0.9);
        this.fxG.fillCircle(p.x, p.y, p.size);
      }
      for (let i = 0; i < this.confetti.length; i++) {
        const p = this.confetti[i];
        const a = clamp(1 - p.life / p.max, 0, 1);
        if (i % 4 === 0) {
          drawStar(this.fxG, p.x, p.y, p.size, p.color, a);
        } else {
          this.fxG.fillStyle(p.color, a);
          this.fxG.fillEllipse(p.x, p.y, p.size * 1.8, p.size);
        }
      }
      this.renderReveal();
    }

    renderReveal() {
      if (!this.revealG) return;
      this.revealG.clear();
      const fx = this.revealFx || emptyRevealFx();
      const flash = fx.flash || 0;
      const burst = fx.burst || 0;
      const fxX = fx.x || 270;
      const fxY = fx.y || 390;
      const colors = fx.colors && fx.colors.length ? fx.colors : [C.gold, C.rarePink, C.rareBlue];
      if (flash > 0) {
        const a = clamp(flash / 0.5, 0, 1);
        this.revealG.setVisible(true);
        this.revealG.fillStyle(0xFFF4B0, 0.24 * a);
        this.revealG.fillRect(0, 0, WIDTH, HEIGHT);
        this.revealG.fillStyle(0xFFFFFF, 0.14 * a);
        this.revealG.fillRect(0, 0, WIDTH, HEIGHT);
        this.revealG.fillStyle(0xFFF8D8, 0.3 * a);
        this.revealG.fillCircle(fxX, fxY, 150 + (1 - a) * 90);
      }
      if (burst > 0) {
        const age = RARE_BURST_SEC - burst;
        const fade = clamp(burst / RARE_BURST_SEC, 0, 1);
        this.revealG.setVisible(true);
        for (let i = 0; i < 14; i++) {
          const a = this.clock * 0.9 + i * TAU / 14;
          const inner = 26 + age * 120;
          const outer = inner + 42 + Math.sin(this.clock * 9 + i) * 9;
          this.revealG.lineStyle(i % 2 ? 3.8 : 2.2, colors[i % colors.length], 0.42 * fade);
          this.revealG.lineBetween(fxX + Math.cos(a) * inner, fxY + Math.sin(a) * inner * 0.86, fxX + Math.cos(a) * outer, fxY + Math.sin(a) * outer * 0.86);
        }
        this.revealG.lineStyle(3.2, 0xFFFFFF, 0.5 * fade);
        this.revealG.strokeCircle(fxX, fxY, 28 + age * 150);
        this.revealG.lineStyle(2, C.gold, 0.55 * fade);
        this.revealG.strokeCircle(fxX, fxY, 20 + age * 112);
        for (let i = 0; i < 8; i++) {
          const a = this.clock * 1.3 + i * TAU / 8;
          const r = 62 + age * 96 + Math.sin(this.clock * 5 + i) * 5;
          drawStar(this.revealG, fxX + Math.cos(a) * r, fxY + Math.sin(a) * r * 0.85, 4.2 * (1 - age * 0.55), colors[(i + 2) % colors.length], 0.86 * fade);
        }
      }
      if (flash <= 0 && burst <= 0) this.revealG.setVisible(false);
      const banner = fx.banner || 0;
      if (this.bannerRoot) {
        if (banner > 0) {
          const elapsed = RARE_BANNER_SEC - banner;
          const alpha = clamp(Math.min(elapsed / 0.18, banner / 0.38), 0, 1);
          const scale = 0.9 + 0.1 * clamp(elapsed / 0.22, 0, 1);
          this.bannerRoot.setVisible(true).setAlpha(alpha).setScale(scale);
        } else {
          this.bannerRoot.setVisible(false).setAlpha(0).setScale(1);
        }
      }
    }

    drawWaterStream(g) {
      const a = this.nozzlePoint();
      const b = this.spray;
      const cx = (a.x + b.x) / 2;
      const cy = Math.min(a.y, b.y) - 46;
      let prev = a;
      for (let i = 1; i <= 23; i++) {
        const t = i / 23;
        const mt = 1 - t;
        const wave = Math.sin(t * 18 - this.clock * 13) * 2.8 * t;
        const x = mt * mt * a.x + 2 * mt * t * cx + t * t * b.x + wave * 0.4;
        const y = mt * mt * a.y + 2 * mt * t * cy + t * t * b.y;
        g.lineStyle(4.6 * (1 - t * 0.45), i % 3 === 0 ? C.waterLight : C.water, 0.72);
        g.lineBetween(prev.x, prev.y, x, y);
        if (i % 4 === 0) {
          g.fillStyle(C.waterLight, 0.8);
          g.fillCircle(x + wave, y - 1, 1.6 + Math.sin(this.clock * 12 + i) * 0.5);
        }
        prev = { x: x, y: y };
      }
      const ripple = 8 + Math.sin(this.clock * 14) * 2;
      g.lineStyle(2, C.waterLight, 0.8);
      g.strokeCircle(b.x, b.y, ripple);
      g.lineStyle(1.2, C.water, 0.55);
      g.strokeCircle(b.x, b.y, ripple + 5);
      g.fillStyle(C.waterLight, 0.86);
      g.fillCircle(b.x, b.y, 3.2);
    }

    handleVisibility() {
      if (typeof document !== 'undefined' && document.hidden && this.spray.active) this.stopSpray();
    }

    onShutdown() {
      if (typeof document !== 'undefined' && document.removeEventListener) {
        document.removeEventListener('visibilitychange', this._onVisibility);
      }
      this.stopSpray();
    }

    // -------------------------------------------------- 输入
    onPointerDown(pointer) {
      Sound.resume();
      if (this.phase === 'over') {
        if (this.clock < this.tapLockUntil) return false;
        return this.tryRestart();
      }
      if (this.spray.active) return false;
      const pid = pointer.id == null ? 1 : pointer.id;
      return this.startSpray(pointer.x, pointer.y, pid);
    }

    onPointerMove(pointer) {
      if (!this.spray.active) return;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (this.spray.pointerId !== pid) return;
      this.moveSpray(pointer.x, pointer.y);
    }

    onPointerUp(pointer) {
      if (!this.spray.active) return;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (this.spray.pointerId !== pid) return;
      this.stopSpray();
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

  window.DogWaterScene = DogWaterScene;
})();
