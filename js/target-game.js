/*
 * 弹珠打靶：竖屏打靶机（540x960）。靶场里一排纸片小动物坐在传送带从左往右匀速走，
 * 底部六个洞里挂着分数；点一下屏幕，固定在正中间的炮台就竖直向上射一颗弹珠，
 * 打中小动物得分，弹珠会被纸片顶回来、掉进底下的洞里再得一次分；
 * 打空了弹珠就直接从机器顶上飞出去，这一发没有分。
 * 一轮固定 15 发，打完给结算卡；没有失败、没有惩罚，只有分数。
 * 只做竖屏，横屏时由 Phaser 的 FIT 缩放居中。
 * 美术全部 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，不加载任何素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;                 // 只做竖屏，横屏时用 FIT 缩放居中
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const ROUND_BALLS = 15;            // 一轮 15 发
  const BALL_R = 12;

  const GRAVITY = 850;               // px/s^2
  const LAUNCH_SPEED = 1250;         // 固定的出膛速度，永远竖直向上（够冲到靶场上沿再弹回来）
  const SUBSTEP = 1 / 240;           // 固定子步推进，高速也不会穿墙穿纸片
  const STALL_PUSH = 70;             // 慢吞吞卡住时推一把
  const STALL_TIME = 0.35;
  const WALL_REST = 0.62;            // 两侧导轨的反弹（纸片把球打歪才会碰到）
  const FIG_REST = 0.45;             // 撞到纸片后，沿法线方向保留多少速度（纸片轻，弹回来的速度只有一半不到）
  const FIG_TILT = 0.17;             // 撞击点越偏，接触法线歪得越多（0.17 约等于最多歪 10 度）
  const FIG_JITTER = 90;             // 回弹上撒一点随机，免得每一发都一模一样
  const FIG_SIDE_MAX = 300;          // 横向回弹速度上限，别一弹就贴着墙根走
  const SPEED_CAP = 1600;
  const ESCAPE_Y = 96;               // 打空的球淡出到这里就算飞出机器（不再回弹）
  const MAX_FLIGHT = 8;              // 兜底：飞太久直接判给正下方的洞
  const STALL_SPEED = 26;            // 慢到这个速度以下
  const STALL_SEC = 0.6;             // 持续这么久就推一把
  const CAPTURE_Y = 790;             // 中心越过这条线就算进洞
  const SETTLE_SEC = 0.3;            // 落洞后缩小淡出的时长

  const FIG_COUNT = 8;               // 传送带上一共 8 只纸片小动物（少一点、疏一点才不容易蒙中）
  const FIG_SPEED = 100;             // 匀速从左往右 px/s，走得快才要盯紧了打
  const FIG_W = 54;                  // 命中框
  const FIG_H = 62;
  const FIG_RESPAWN = 1.1;           // 被打掉之后隔多久从传送带那头再出来
  // 传送带是一条闭合的环：纸片从左往右匀速走，出了靶场窗口就从左边再转回来。
  // 环长 1200、8 只之间正好隔 150，两只之间空出 96 像素的缝 —— 打偏了就飞出去。
  const BELT_LOOP = 1200;
  const FIG_SPACING = BELT_LOOP / FIG_COUNT;
  const BELT_X0 = -14;               // 环上最左边的位置（窗口外，看不见）

  // 六个洞的分数：正中间最便宜，越靠边越贵 —— 直着打上去保底只有 5 分，
  // 想拿 20 分得靠撞纸片之后的乱弹，这样才有得玩。
  const POCKET_VALUES = [20, 10, 5, 5, 10, 20];
  const POCKET_COLORS = [0xFFC93D, 0x4BB8FF, 0x9AA7B4, 0x9AA7B4, 0x4BB8FF, 0xFFC93D];

  const CARD_DELAY_SEC = 0.8;        // 最后一发落定后隔多久弹结算卡
  const CARD_LOCK_MS = 400;          // 结算卡弹出后的防误触时间

  const RECOIL_DECAY = 4;            // 炮身回弹衰减速度
  const RECOIL_DY = 5;               // 炮身下沉的最大像素

  // ---------------------------------------------------------------- 纸片小动物
  // 每一只都是「白边纸片 + 彩色本体」，分值直接写在肚子上
  const FIGURES = [
    { key: 'duck', kind: 'duck', name: '小鸭', value: 10, body: 0xFFD93D, accent: 0xFF9A3D, dark: 0xC98F1E },
    { key: 'frog', kind: 'frog', name: '青蛙', value: 10, body: 0x74D26C, accent: 0x3E9E52, dark: 0x2E7A44 },
    { key: 'pig', kind: 'pig', name: '小猪', value: 10, body: 0xFFA8C8, accent: 0xF07AA8, dark: 0xC25A85 },
    { key: 'panda', kind: 'panda', name: '熊猫', value: 20, body: 0xFFFFFF, accent: 0x3A3A46, dark: 0xB9BFC8 },
    { key: 'cat', kind: 'cat', name: '小猫', value: 20, body: 0xFFB368, accent: 0xE07A3A, dark: 0xB35F27 },
    { key: 'bunny', kind: 'bunny', name: '小兔', value: 20, body: 0xFFF1DC, accent: 0xF3C9A0, dark: 0xB98A63 },
    { key: 'unicorn', kind: 'uni', name: '独角兽', value: 30, body: 0xE8B6FF, accent: 0xA06BFF, dark: 0x8A5AD8 },
    { key: 'fox', kind: 'fox', name: '小狐狸', value: 30, body: 0xFF9A5C, accent: 0xFFF1E0, dark: 0xB35A20 },
  ];
  const FIGURES_BY_KEY = {};
  for (let i = 0; i < FIGURES.length; i++) FIGURES_BY_KEY[FIGURES[i].key] = FIGURES[i];

  // 传送带上 8 只的排布：相邻两只不重样（首尾也算相邻），高分（30 分）只有一只。
  // 10 分 4 只 / 20 分 3 只 / 30 分 1 只。
  const FIG_ORDER = ['duck', 'panda', 'frog', 'cat', 'pig', 'unicorn', 'bunny', 'frog'];

  // ---------------------------------------------------------------- 配色（嘉年华）
  const C = {
    skyTop: 0xBFE9FF,
    skyBottom: 0xFFF8E6,
    cloud: 0xFFFFFF,
    sun: 0xFFE9A8,
    awningA: 0xE8503A,
    awningB: 0xFFF6EA,
    wood: 0xD3A063,
    woodMid: 0xB9834A,
    woodDark: 0x8A5C2E,
    panel: 0xF6EAD2,
    panelLine: 0xDCC49A,
    metal: 0x6B7A8C,
    metalDark: 0x3C4A5A,
    turf: 0x7FCB6A,
    ballBody: 0xFFF6C8,
    ballCore: 0xFFB43D,
    ballEdge: 0xE07A1E,
    aim: 0xE8503A,
    aimSoft: 0xFFB3A0,
    hudBg: 0x33404F,
    hudLine: 0xFFC93D,
    hudText: '#FFE9A8',
    hudText2: '#FFFFFF',
    holeDark: 0x3B3145,
    holeLine: 0x6E6280,
    paper: 0xFFFFFF,
  };

  const DEPTH = {
    sky: 0, decor: 1, figure: 2, rangeFront: 3, belt: 3.2, pocket: 4,
    turret: 6, aim: 7, ball: 8, fx: 12, hud: 20, overlay: 40,
  };

  // ---------------------------------------------------------------- 布局（竖屏）
  function computeLayout() {
    const field = { x0: 52, x1: 488, yTop: 200, yBottom: CAPTURE_Y };
    const span = field.x1 - field.x0;         // 436
    const midX = (field.x0 + field.x1) / 2;   // 270
    // 正中间留一条 56 宽的发射道，炮台就塞在里面；六个洞分成左边三个、右边三个，
    // 从中间往两边依次是 5 / 10 / 20 分 —— 想拿高分就得让弹珠弹到边上去。
    const laneW = 56;
    const lane = { x0: midX - laneW / 2, x1: midX + laneW / 2 };
    const per = (span - laneW) / 6;           // 每个洞 63.3 宽
    const mouthY = 800, bottomY = 866;
    const pockets = [];
    for (let i = 0; i < 3; i++) {
      const x0 = field.x0 + per * i;
      pockets.push({
        i: i, x0: x0, x1: x0 + per, cx: x0 + per / 2,
        mouthY: mouthY, bottomY: bottomY, value: POCKET_VALUES[i], color: POCKET_COLORS[i],
      });
    }
    for (let i = 0; i < 3; i++) {
      const x0 = lane.x1 + per * i;
      pockets.push({
        i: i + 3, x0: x0, x1: x0 + per, cx: x0 + per / 2,
        mouthY: mouthY, bottomY: bottomY, value: POCKET_VALUES[i + 3], color: POCKET_COLORS[i + 3],
      });
    }
    return {
      field: field,
      lane: lane,
      pockets: pockets,
      pw: per,
      sky: { y0: 96, y1: 800 },
      awning: { y0: 96, h: 50, n: 12 },
      rail: { y: 310, x0: field.x0, x1: field.x1 },
      window: { x: field.x0, y: 208, w: span, h: 116 },
      turret: { x: midX, y: 880, len: 38, base: 24 },
      deck: { y: 888, h: HEIGHT - 888 },
      hud: {
        left: { x: 62, y: 24, w: 156, h: 44 },
        right: { x: WIDTH - 20, y: 24, w: 156, h: 44 },
      },
      card: { x: (WIDTH - 430) / 2, y: 250, w: 430, h: 440 },
    };
  }

  // ---------------------------------------------------------------- 小工具
  function wrap(v, m) {
    const r = v % m;
    return r < 0 ? r + m : r;
  }

  function fillPts(g, pts) {
    if (!pts || pts.length < 3) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
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

  // ---------------------------------------------------------------- 背景（嘉年华）
  // 天空 + 太阳 + 云，颜色分段近似渐变（WebGL 没有线性渐变）
  function drawSky(g, L) {
    const bands = 40;
    const topY = L.sky.y0, bottomY = L.sky.y1;
    const bh = (bottomY - topY) / bands;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const r = Math.round(((C.skyTop >> 16) & 0xff) * (1 - t) + ((C.skyBottom >> 16) & 0xff) * t);
      const gg = Math.round(((C.skyTop >> 8) & 0xff) * (1 - t) + ((C.skyBottom >> 8) & 0xff) * t);
      const b = Math.round((C.skyTop & 0xff) * (1 - t) + (C.skyBottom & 0xff) * t);
      g.fillStyle((r << 16) | (gg << 8) | b, 1);
      g.fillRect(0, topY + i * bh, WIDTH, bh + 1);
    }
    // 太阳
    g.fillStyle(C.sun, 0.55);
    g.fillCircle(430, 176, 40);
    g.fillStyle(0xFFF3C4, 0.95);
    g.fillCircle(430, 176, 26);
    // 云
    const clouds = [[96, 174, 1], [268, 150, 0.8], [474, 172, 0.7]];
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const k = c[2];
      g.fillStyle(C.cloud, 0.9);
      g.fillCircle(c[0], c[1], 22 * k);
      g.fillCircle(c[0] + 26 * k, c[1] + 6 * k, 17 * k);
      g.fillCircle(c[0] - 24 * k, c[1] + 7 * k, 15 * k);
      g.fillRect(c[0] - 24 * k, c[1], 52 * k, 16 * k);
    }
  }

  // 顶部红白条纹的帐篷檐（扇形边）
  function drawAwning(g, L) {
    const y0 = L.awning.y0, h = L.awning.h, n = L.awning.n;
    const w = WIDTH / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle(i % 2 === 0 ? C.awningA : C.awningB, 1);
      g.fillRect(i * w, y0, w + 1, h - 16);
      g.fillCircle(i * w + w / 2, y0 + h - 16, w / 2 + 0.5);
    }
    g.fillStyle(C.woodDark, 0.35);
    g.fillRect(0, y0 + h - 20, WIDTH, 4);
  }

  // 靶场窗口只铺一层淡淡的玻璃色，纸片站在上面更跳
  function drawRangeBack(g, L) {
    const f = L.field, wdw = L.window;
    g.fillStyle(0xFFFFFF, 0.20);
    g.fillRect(f.x0, wdw.y - 6, f.x1 - f.x0, wdw.h + 16);
  }

  // 靶场前面的木框：两侧立柱 + 上下横梁 + 传送带横梁。
  // 画在纸片之上，纸片进出窗口时就像从框后面转出来。
  function drawRangeFront(g, L) {
    const f = L.field, wdw = L.window, rail = L.rail;
    const span = f.x1 - f.x0;
    g.fillStyle(C.woodMid, 1);
    g.fillRect(f.x0 - 16, wdw.y - 10, 16, rail.y - wdw.y + 26);
    g.fillRect(f.x1, wdw.y - 10, 16, rail.y - wdw.y + 26);
    g.fillStyle(C.woodDark, 0.5);
    g.fillRect(f.x1 - 3, wdw.y - 10, 3, rail.y - wdw.y + 26);
    g.fillStyle(C.wood, 1);
    g.fillRect(f.x0 - 10, wdw.y - 14, span + 20, 12);
    g.fillStyle(C.woodDark, 0.4);
    g.fillRect(f.x0 - 10, wdw.y - 4, span + 20, 3);
    g.fillStyle(C.wood, 1);
    g.fillRect(f.x0 - 10, rail.y - 2, span + 20, 16);
    g.fillStyle(C.woodDark, 0.45);
    g.fillRect(f.x0 - 10, rail.y + 9, span + 20, 4);
  }

  // 传送带上会跑的小格子：每帧重画，一眼看得出带子在往右走
  function drawBeltStripes(g, L, phase) {
    const f = L.field, rail = L.rail, step = 26;
    g.clear();
    g.fillStyle(C.woodDark, 0.3);
    const off = wrap(phase, step);
    for (let x = f.x0 - 10 + off - step; x < f.x1 + 10; x += step) {
      g.fillRect(x, rail.y + 2, 3, 7);
    }
  }

  // 靶场里空着的地方别太素：传送带梁下面一条彩旗 + 背板上一圈画上去的靶环 + 几颗小星星
  function drawFieldDecor(g, L) {
    const f = L.field;
    const cx = (f.x0 + f.x1) / 2;
    const x0 = f.x0 - 18, x1 = f.x1 + 18, y0 = 152, sag = 26;
    g.lineStyle(2.5, C.woodDark, 0.45);
    g.beginPath();
    g.moveTo(x0, y0);
    for (let i = 1; i <= 16; i++) {
      const u = i / 16;
      g.lineTo(x0 + (x1 - x0) * u, y0 + Math.sin(u * Math.PI) * sag);
    }
    g.strokePath();
    const cols = [C.awningA, C.hudLine, 0x4BB8FF, 0x74D26C, 0xE8B6FF];
    for (let i = 0; i < 16; i++) {
      const u = (i + 0.5) / 16;
      const px = x0 + (x1 - x0) * u;
      const py = y0 + Math.sin(u * Math.PI) * sag;
      g.fillStyle(cols[i % cols.length], 0.92);
      g.fillTriangle(px - 9, py, px + 9, py, px, py + 18);
    }
    g.lineStyle(13, 0xFFFFFF, 0.13);
    g.strokeCircle(cx, 540, 154);
    g.lineStyle(13, C.awningA, 0.09);
    g.strokeCircle(cx, 540, 110);
    g.lineStyle(13, 0x4BB8FF, 0.07);
    g.strokeCircle(cx, 540, 66);
    const stars = [[104, 412, 11], [430, 372, 9], [150, 648, 8], [392, 630, 12], [268, 466, 7],
      [212, 726, 9], [330, 700, 8], [118, 536, 7], [424, 520, 8]];
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      g.fillStyle(i % 2 === 0 ? 0xFFFFFF : C.hudLine, 0.20);
      fillPts(g, starPoints(s[0], s[1], s[2], s[2] * 0.44, 5, 0));
    }
    // 内侧两条导轨：弹珠就是被它们弹回来的，也让场子看着有个边界
    const railTop = f.yTop, railH = CAPTURE_Y - f.yTop;
    g.fillStyle(C.metal, 0.92);
    g.fillRect(f.x0, railTop, 12, railH);
    g.fillRect(f.x1 - 12, railTop, 12, railH);
    g.fillStyle(C.metalDark, 0.45);
    g.fillRect(f.x0 + 9, railTop, 3, railH);
    g.fillRect(f.x1 - 12, railTop, 3, railH);
    g.fillStyle(0xFFFFFF, 0.45);
    for (let y = railTop + 26; y < railTop + railH - 10; y += 44) {
      g.fillCircle(f.x0 + 6, y, 2.2);
      g.fillCircle(f.x1 - 6, y, 2.2);
    }
  }

  // 机器最下面那块木头台面（放提示文字用）
  function drawCounter(g, L) {
    const y = L.deck.y;
    g.fillStyle(C.woodMid, 1);
    g.fillRect(0, y, WIDTH, HEIGHT - y);
    g.fillStyle(C.wood, 1);
    g.fillRect(0, y, WIDTH, 10);
    g.fillStyle(0xFFFFFF, 0.18);
    g.fillRect(0, y + 10, WIDTH, 3);
    g.fillStyle(C.woodDark, 0.3);
    g.fillRect(0, HEIGHT - 12, WIDTH, 12);
  }

  // 底部的六个洞（暗态）
  function drawPocketBase(g, L) {
    for (let i = 0; i < L.pockets.length; i++) {
      const p = L.pockets[i];
      const w = p.x1 - p.x0;
      const rc = Math.min(14, (w - 14) / 2);
      g.fillStyle(C.holeDark, 1);
      g.fillRoundedRect(p.x0 + 7, p.mouthY, w - 14, p.bottomY - p.mouthY, rc);
      g.lineStyle(2.5, C.holeLine, 0.9);
      g.strokeRoundedRect(p.x0 + 7, p.mouthY, w - 14, p.bottomY - p.mouthY, rc);
      // 洞口那圈亮色
      g.fillStyle(p.color, 0.18);
      g.fillCircle(p.cx, p.mouthY + 26, Math.max(11, w * 0.3));
    }
    // 接珠盘：洞里掉下来的珠子最后都堆在这里
    g.fillStyle(0x2A2233, 1);
    g.fillRect(L.field.x0, L.pockets[0].bottomY, L.field.x1 - L.field.x0, 12);
    g.fillStyle(C.hudLine, 0.22);
    g.fillRect(L.field.x0, L.pockets[0].bottomY, L.field.x1 - L.field.x0, 3);
  }

  // 炮台：固定的底座 + 永远竖直向上的炮管（发射时会往下沉一下再弹回来）
  function drawTurret(g, L, ang, dy) {
    const t = L.turret;
    const off = dy || 0;
    g.fillStyle(C.metalDark, 1);
    g.fillCircle(t.x, t.y, t.base);
    g.fillStyle(C.metal, 1);
    g.fillCircle(t.x, t.y, t.base - 6);
    g.fillStyle(0xFFFFFF, 0.35);
    g.fillCircle(t.x - 5, t.y - 6, 5);
    const ex = t.x + Math.sin(ang) * t.len;
    const ey = t.y + off - Math.cos(ang) * t.len;
    g.lineStyle(21, C.metalDark, 1);
    g.beginPath(); g.moveTo(t.x, t.y + off); g.lineTo(ex, ey); g.strokePath();
    g.lineStyle(15, C.metal, 1);
    g.beginPath(); g.moveTo(t.x, t.y + off); g.lineTo(ex, ey); g.strokePath();
    g.fillStyle(C.hudLine, 1);
    g.fillCircle(ex, ey, 8);
    g.fillStyle(0xFFFFFF, 0.55);
    g.fillCircle(ex - 2, ey - 2.2, 3);
  }

  // 一只纸片小动物：脚踩在 y=0，头顶大约 y=-66
  // sil = true 时整只画成白色，用来在后面垫一层「白边纸片」
  function drawCritter(g, kind, body, accent, dark, sil) {
    const col = (c) => (sil ? 0xFFFFFF : c);
    const B = col(body), A = col(accent), D = col(dark);
    // 身体
    g.fillStyle(B, 1);
    g.fillEllipse(0, -18, 46, 36);
    // 头
    g.fillCircle(0, -44, 15);
    if (kind === 'duck') {
      g.fillStyle(A, 1);
      g.fillEllipse(-8, -18, 22, 14);
      g.fillTriangle(13, -48, 26, -43, 13, -38);
      g.fillStyle(D, 1);
      g.fillCircle(6, -47, 2.8);
      g.fillCircle(-1, -52, 1.6);
      g.fillCircle(3, -54, 1.6);
    } else if (kind === 'frog') {
      g.fillStyle(B, 1);
      g.fillCircle(-9, -56, 8.5);
      g.fillCircle(9, -56, 8.5);
      g.fillStyle(0xFFFFFF, 1);
      g.fillCircle(-9, -57, 5.4);
      g.fillCircle(9, -57, 5.4);
      g.fillStyle(D, 1);
      g.fillCircle(-9, -57, 2.8);
      g.fillCircle(9, -57, 2.8);
      g.fillStyle(A, 1);
      g.fillEllipse(0, -14, 26, 20);
      g.lineStyle(2.6, D, 0.9);
      g.beginPath(); g.moveTo(-8, -30); g.lineTo(8, -30); g.strokePath();
    } else if (kind === 'pig') {
      g.fillStyle(B, 1);
      g.fillTriangle(-16, -50, -5, -64, -1, -48);
      g.fillTriangle(16, -50, 5, -64, 1, -48);
      g.fillEllipse(0, -18, 48, 36);
      g.fillCircle(0, -44, 15);
      g.fillStyle(A, 1);
      g.fillEllipse(1, -42, 21, 14);
      g.fillCircle(-25, -21, 6);
      g.fillStyle(D, 1);
      g.fillCircle(-25, -21, 3);
      g.fillCircle(-3.2, -42, 2.1);
      g.fillCircle(5.2, -42, 2.1);
      g.fillCircle(-6, -49, 2.3);
      g.fillCircle(6, -49, 2.3);
    } else if (kind === 'panda') {
      g.fillStyle(A, 1);
      g.fillCircle(-12, -55, 7.5);
      g.fillCircle(12, -55, 7.5);
      g.fillEllipse(-7, -46, 13, 16);
      g.fillEllipse(7, -46, 13, 16);
      g.fillStyle(0xFFFFFF, 1);
      g.fillCircle(-7, -45, 3.2);
      g.fillCircle(7, -45, 3.2);
      g.fillStyle(A, 1);
      g.fillEllipse(0, -36, 9, 6);
      g.fillStyle(D, 1);
      g.fillEllipse(-11, -16, 12, 15);
      g.fillEllipse(11, -16, 12, 15);
    } else if (kind === 'cat') {
      g.fillStyle(B, 1);
      g.fillTriangle(-16, -50, -6, -68, -1, -48);
      g.fillTriangle(16, -50, 6, -68, 1, -48);
      g.fillStyle(A, 1);
      g.fillTriangle(-13, -52, -7, -63, -3, -51);
      g.fillTriangle(13, -52, 7, -63, 3, -51);
      g.fillStyle(D, 1);
      g.fillCircle(-6, -47, 3);
      g.fillCircle(6, -47, 3);
      g.fillStyle(A, 1);
      g.fillEllipse(0, -38, 18, 12);
      g.fillStyle(D, 1);
      g.fillTriangle(-3, -41, 3, -41, 0, -37);
      g.lineStyle(1.6, D, 0.8);
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(-19, -42 + i * 4); g.lineTo(-30, -45 + i * 6); g.strokePath();
        g.beginPath(); g.moveTo(19, -42 + i * 4); g.lineTo(30, -45 + i * 6); g.strokePath();
      }
    } else if (kind === 'bunny') {
      g.fillStyle(B, 1);
      g.fillEllipse(-7, -60, 12, 30);
      g.fillEllipse(7, -60, 12, 30);
      g.fillEllipse(0, -18, 44, 34);
      g.fillCircle(0, -44, 15);
      g.fillStyle(A, 1);
      g.fillEllipse(-7, -60, 6, 20);
      g.fillEllipse(7, -60, 6, 20);
      g.fillEllipse(0, -40, 8, 6);
      g.fillStyle(D, 1);
      g.fillCircle(-6, -47, 2.6);
      g.fillCircle(6, -47, 2.6);
      g.lineStyle(1.4, D, 0.7);
      g.beginPath(); g.moveTo(-16, -42); g.lineTo(-27, -45); g.strokePath();
      g.beginPath(); g.moveTo(-16, -38); g.lineTo(-27, -37); g.strokePath();
      g.beginPath(); g.moveTo(16, -42); g.lineTo(27, -45); g.strokePath();
      g.beginPath(); g.moveTo(16, -38); g.lineTo(27, -37); g.strokePath();
      g.fillStyle(0xFFFFFF, 1);
      g.fillCircle(-22, -16, 6);
    } else if (kind === 'fox') {
      g.fillStyle(B, 1);
      g.fillTriangle(-18, -50, -6, -68, -1, -46);
      g.fillTriangle(18, -50, 6, -68, 1, -46);
      g.fillStyle(D, 1);
      g.fillTriangle(-15, -52, -7, -64, -3, -48);
      g.fillTriangle(15, -52, 7, -64, 3, -48);
      g.fillStyle(B, 1);
      g.fillEllipse(0, -18, 46, 36);
      g.fillCircle(0, -44, 15);
      g.fillEllipse(-26, -23, 26, 22);
      g.fillStyle(A, 1);
      g.fillCircle(-33, -23, 8);
      g.fillEllipse(0, -38, 20, 14);
      g.fillStyle(D, 1);
      g.fillCircle(-6, -47, 2.6);
      g.fillCircle(6, -47, 2.6);
      g.fillCircle(0, -39, 2.6);
    } else {
      // uni：独角兽
      g.fillStyle(0xFFE066, 1);
      g.fillTriangle(-5, -54, 5, -54, 0, -72);
      g.fillStyle(A, 1);
      g.fillCircle(-6, -56, 6);
      g.fillCircle(-10, -46, 6);
      g.fillCircle(-12, -36, 5);
      g.fillStyle(B, 1);
      g.fillEllipse(0, -14, 24, 18);
      g.fillStyle(D, 1);
      g.fillCircle(-6, -47, 3);
      g.fillCircle(6, -47, 3);
      g.fillStyle(A, 1);
      g.fillEllipse(0, -38, 14, 10);
      g.fillStyle(0xFFFFFF, 0.8);
      g.fillCircle(-10, -22, 3);
    }
  }

  // 弹珠：暖黄小球 + 高光
  function drawBall(g) {
    g.fillStyle(C.ballEdge, 1);
    g.fillCircle(0, 0, BALL_R + 1.5);
    g.fillStyle(C.ballBody, 1);
    g.fillCircle(0, 0, BALL_R);
    g.fillStyle(C.ballCore, 1);
    g.fillCircle(1.5, 1.5, BALL_R - 5);
    g.fillStyle(0xFFFFFF, 0.9);
    g.fillCircle(-4.5, -5, 3.4);
  }

  // ---------------------------------------------------------------- 音效
  // 全部 WebAudio 合成：出膛是气声、打中纸片是清脆一声、进洞按分数高低给不同音高
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

    function noise(dur, vol, when, f0, f1, q) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + (when || 0);
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.Q.value = q || 1.1;
      filt.frequency.setValueAtTime(f0, t0);
      if (f1) filt.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.35));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    }

    return {
      resume: resume,
      // 出膛：一口气 + 一点低音
      launch: function () { noise(0.16, 0.10, 0, 900, 2400, 1.3); tone(280, 0.12, 0.05, 0, 'triangle'); },
      // 飞行中还点了一下：弹珠没落定，给一声轻轻的「咔」（表示还在装弹）
      reload: function () { tone(300, 0.05, 0.03, 0, 'square'); noise(0.04, 0.02, 0, 1200, 0, 2.0); },
      // 打中纸片：分值越高越清脆
      hit: function (value) {
        const f = value >= 30 ? 880 : (value >= 20 ? 680 : 540);
        tone(f, 0.17, 0.09, 0, 'triangle');
        tone(f * 1.5, 0.13, 0.04, 0.02, 'sine');
        noise(0.07, 0.05, 0, 1700, 0, 1.5);
      },
      // 撞墙：闷闷一小下
      wall: function () { tone(170, 0.08, 0.035, 0, 'sine'); },
      // 打空了：弹珠从头顶飞走的一声「咻」（不吓人，也不像失败）
      miss: function () { noise(0.26, 0.045, 0, 1900, 460, 1.4); tone(420, 0.20, 0.025, 0.02, 'sine'); },
      // 掉进洞口
      drop: function () { tone(430, 0.10, 0.05, 0, 'sine'); },
      // 洞口得分：按分数高低给不同音高
      pocket: function (value) {
        const base = value >= 20 ? 784 : (value >= 10 ? 660 : 560);
        tone(base, 0.16, 0.075, 0, 'sine');
        tone(base * 1.5, 0.22, 0.045, 0.05, 'sine');
        if (value >= 20) tone(base * 2, 0.26, 0.035, 0.10, 'sine');
      },
      // 结算
      end: function () {
        [0, 4, 7].forEach(function (semi, i) {
          tone(392 * Math.pow(2, semi / 12), 1.1, 0.075, i * 0.1, 'sine');
        });
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class TargetScene extends Phaser.Scene {
    constructor() { super('TargetScene'); }

    create() {
      this.L = computeLayout();
      this.pockets = this.L.pockets;
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT,
        ROUND_BALLS: ROUND_BALLS, BALL_R: BALL_R, GRAVITY: GRAVITY,
        LAUNCH_SPEED: LAUNCH_SPEED,
        WALL_REST: WALL_REST,
        FIG_REST: FIG_REST, FIG_TILT: FIG_TILT, FIG_JITTER: FIG_JITTER,
        FIG_SIDE_MAX: FIG_SIDE_MAX, SPEED_CAP: SPEED_CAP,
        ESCAPE_Y: ESCAPE_Y, MAX_FLIGHT: MAX_FLIGHT, SUBSTEP: SUBSTEP, CAPTURE_Y: CAPTURE_Y,
        SETTLE_SEC: SETTLE_SEC, STALL_SPEED: STALL_SPEED, STALL_PUSH: STALL_PUSH,
        FIG_COUNT: FIG_COUNT, FIG_SPEED: FIG_SPEED, FIG_W: FIG_W, FIG_H: FIG_H,
        FIG_RESPAWN: FIG_RESPAWN, BELT_X0: BELT_X0, BELT_LOOP: BELT_LOOP,
        FIG_SPACING: FIG_SPACING, FIG_ORDER: FIG_ORDER.slice(),
        POCKET_VALUES: POCKET_VALUES.slice(),
        POCKET_COUNT: POCKET_VALUES.length,
        CARD_DELAY_SEC: CARD_DELAY_SEC, CARD_LOCK_MS: CARD_LOCK_MS,
      };

      // 状态
      this.phase = 'ready';          // ready / flight / over
      this.recoil = 0;               // 发射时置 1，按 RECOIL_DECAY 衰减，给炮身一个下沉回弹
      this.ballsLeft = ROUND_BALLS;
      this.shots = 0;                // 这一轮已经打出去几发
      this.hits = 0;                 // 打中几只纸片
      this.score = 0;
      this.hitScore = 0;             // 打纸片得来的分
      this.pocketScore = 0;          // 落洞得来的分
      this.belt = 0;                 // 传送带相位
      this.figures = [];
      this.ball = null;              // { x, y, vx, vy, settling, fromX.. }
      this.settle = null;            // { idx, t, dur }
      this.flightT = 0;
      this.stallT = 0;
      this.deepY = 0;                // 这一发到过的最深位置（防卡死）
      this.deepAt = -1;              // -1 = 还没开始下落
      this.elapsed = 0;
      this.lastDt = 1 / 60;
      this.endT = 0;
      this.cardShown = false;
      this.cardShownAt = 0;
      this.cardG = null;
      this.cardItems = [];
      this.liveProps = [];
      this.flash = [];               // 洞口闪光
      this.spin = 0;

      Sound.resume();

      // 靶场遮罩的形状没有加进显示列表，场景重开时要自己收掉
      if (this.events && this.events.once) {
        this.events.once('shutdown', () => {
          if (this.figureMaskShape) { this.figureMaskShape.destroy(); this.figureMaskShape = null; }
        });
      }

      this.buildSky();
      this.buildDecor();
      this.buildRange();
      this.buildFigures();
      this.buildPockets();
      this.buildTurret();
      this.buildHud();
      this.buildCounter();
      this.buildBall();
      this.bindInput();

      this.updateFigures(0);
      this.loadBall();
    }

    // -------------------------------------------------- 搭场景
    buildSky() {
      const g = this.add.graphics().setDepth(DEPTH.sky);
      drawSky(g, this.L);
      drawAwning(g, this.L);
    }

    buildDecor() {
      const g = this.add.graphics().setDepth(DEPTH.decor);
      drawFieldDecor(g, this.L);
      drawRangeBack(g, this.L);
    }

    buildRange() {
      const g = this.add.graphics().setDepth(DEPTH.rangeFront);
      drawRangeFront(g, this.L);
      this.beltG = this.add.graphics().setDepth(DEPTH.belt);
      drawBeltStripes(this.beltG, this.L, this.belt);
    }

    // 八只纸片小动物：白边纸片 + 彩色本体，预先画好，之后只改位置
    // 用一块几何遮罩把她们裁在靶场窗口里，进出窗口就像从框后面转出来
    buildFigures() {
      const wdw = this.L.window;
      const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillRect(wdw.x - 1, wdw.y - 4, wdw.w + 2, wdw.h + 12);
      this.figureMaskShape = maskShape;
      this.figureMask = maskShape.createGeometryMask();

      this.figureConts = [];
      for (let i = 0; i < FIG_COUNT; i++) {
        const spec = FIGURES_BY_KEY[FIG_ORDER[i % FIG_ORDER.length]];
        const cont = this.add.container(0, 0).setDepth(DEPTH.figure);
        const sil = this.add.graphics();
        drawCritter(sil, spec.kind, spec.body, spec.accent, spec.dark, true);
        sil.setScale(1.13);
        sil.setY(4.4);
        const body = this.add.graphics();
        drawCritter(body, spec.kind, spec.body, spec.accent, spec.dark, false);
        cont.add([sil, body]);
        cont.setMask(this.figureMask);
        this.figureConts.push(cont);
        this.figures.push({
          i: i, key: spec.key, kind: spec.kind, name: spec.name, value: spec.value,
          spec: spec, offset: i * FIG_SPACING,
          x: 0, dead: false, respawnAt: 0, frozen: false, cont: cont,
        });
      }
    }

    buildPockets() {
      const g = this.add.graphics().setDepth(DEPTH.pocket);
      drawPocketBase(g, this.L);
      this.pocketTexts = [];
      for (let i = 0; i < this.L.pockets.length; i++) {
        const p = this.L.pockets[i];
        const t = this.add.text(p.cx, p.mouthY + 30, String(p.value), {
          fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#FFFFFF',
          stroke: '#' + ('000000' + p.color.toString(16)).slice(-6), strokeThickness: 5,
        }).setOrigin(0.5).setDepth(DEPTH.pocket + 0.6);
        this.pocketTexts.push(t);
      }
      this.flashG = this.add.graphics().setDepth(DEPTH.pocket + 0.8);
    }

    buildTurret() {
      this.turretG = this.add.graphics().setDepth(DEPTH.turret);
      drawTurret(this.turretG, this.L, 0, 0);
    }

    buildHud() {
      const g = this.add.graphics().setDepth(DEPTH.hud);
      this.hudG = g;
      const l = this.L.hud.left, r = this.L.hud.right;
      // 左：还剩几发
      g.fillStyle(C.hudBg, 0.82);
      g.fillRoundedRect(l.x, l.y, l.w, l.h, l.h / 2);
      g.lineStyle(3, C.hudLine, 0.85);
      g.strokeRoundedRect(l.x, l.y, l.w, l.h, l.h / 2);
      const lcx = l.x + 26, lcy = l.y + l.h / 2;
      g.fillStyle(C.ballEdge, 1); g.fillCircle(lcx, lcy, 13);
      g.fillStyle(C.ballBody, 1); g.fillCircle(lcx, lcy, 11.5);
      g.fillStyle(C.ballCore, 1); g.fillCircle(lcx, lcy, 7);
      g.fillStyle(0xFFFFFF, 0.9); g.fillCircle(lcx - 3.6, lcy - 4, 3.2);
      this.leftText = this.add.text(lcx + 21, lcy, '', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: C.hudText,
        stroke: '#26313D', strokeThickness: 4,
      }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);
      // 右：总分
      g.fillStyle(C.hudBg, 0.82);
      g.fillRoundedRect(r.x - r.w, r.y, r.w, r.h, r.h / 2);
      g.lineStyle(3, C.hudLine, 0.85);
      g.strokeRoundedRect(r.x - r.w, r.y, r.w, r.h, r.h / 2);
      const rcx = r.x - r.w + 26, rcy = r.y + r.h / 2;
      g.fillStyle(0xFFC93D, 1);
      fillPts(g, starPoints(rcx, rcy, 13, 5.6, 5, 0));
      this.scoreText = this.add.text(rcx + 21, rcy, '0', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: C.hudText2,
        stroke: '#26313D', strokeThickness: 4,
      }).setOrigin(0, 0.5).setDepth(DEPTH.hud + 1);
      this.paintHud();
    }

    buildCounter() {
      const g = this.add.graphics().setDepth(DEPTH.decor + 0.5);
      drawCounter(g, this.L);
      this.hintText = this.add.text(WIDTH / 2, 928, '点一下屏幕，就发射一颗弹珠', {
        fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFF3D6',
        stroke: '#5A3A1E', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.decor + 0.6);
    }

    buildBall() {
      const g = this.add.graphics();
      drawBall(g);
      this.ballCont = this.add.container(0, 0, [g]).setDepth(DEPTH.ball).setVisible(false);
    }

    // -------------------------------------------------- 输入
    // 只有一种操作：点一下屏幕 = 打一发。飞出去的那颗没落定之前点不动。
    bindInput() {
      this.input.on('pointerdown', () => this.onPointerDown());
      if (this.input.keyboard) {
        const KC = Phaser.Input.Keyboard.KeyCodes;
        this.input.keyboard.addKeys({ space: KC.SPACE });
        this.input.keyboard.on('keydown-SPACE', () => this.onPointerDown());
      }
    }

    onPointerDown() {
      Sound.resume();
      if (this.phase === 'over') { this.tryRestart(); return false; }
      if (this.phase === 'ready') return this.fire();
      // 飞行中：弹珠还没落定，给一声轻轻的「还在装弹」，免得孩子以为点了没反应
      Sound.reload();
      return false;
    }

    tryRestart() {
      if (this.phase !== 'over') return false;
      if (this.time.now - this.cardShownAt < CARD_LOCK_MS) return false;
      this.restart();
      return true;
    }

    // -------------------------------------------------- 上膛 / 发射
    loadBall() {
      this.phase = 'ready';
      this.ball = null;
      this.settle = null;
      if (this.ballCont) this.ballCont.setVisible(false);
    }

    // 点一下 = 打一发：炮口永远在正中间，弹珠竖直向上，没有蓄力也没有左右瞄准
    fire() {
      if (this.phase === 'over' || this.shots >= ROUND_BALLS) return false;
      if (this.phase !== 'ready') return false;
      const t = this.L.turret;
      const mx = t.x;
      const my = t.y - t.len;
      this.ball = {
        x: mx, y: my, vx: 0, vy: -LAUNCH_SPEED,
        settling: false, fromX: mx, fromY: my, tx: mx, ty: my,
      };
      this.phase = 'flight';
      this.shots += 1;
      this.ballsLeft = Math.max(0, ROUND_BALLS - this.shots);
      this.flightT = 0;
      this.stallT = 0;
      // 「最深位置」从天花板算起：弹珠刚出膛的那段上升不算「卡住」，
      // 只有真的悬在半空不再往下走才会被兜底判进洞。
      this.deepY = this.L.field.yTop + BALL_R;
      this.deepAt = -1;              // -1 = 还没开始下落，卡死计时先不计
      this.recoil = 1;
      this.paintHud();
      Sound.launch();
      this.spawnPuff(mx, my);
      return true;
    }

    // -------------------------------------------------- 每帧
    update(time, delta) {
      const dt = Math.min(delta, 60) / 1000;
      this.step(dt);
      this.render();
    }

    // 纯逻辑推进（不碰画面），测试里用 simulate() 反复调用它
    step(dt) {
      this.elapsed += dt;
      this.lastDt = dt;

      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * RECOIL_DECAY);

      for (let i = 0; i < this.flash.length; i++) {
        if (this.flash[i].t > 0) this.flash[i].t = Math.max(0, this.flash[i].t - dt);
      }

      // 传送带永远在走：就算在结算，看着也不呆
      this.updateFigures(dt);

      if (this.settle) {
        this.settle.t += dt;
        if (this.settle.t >= this.settle.dur) this.finishSettle();
        return;
      }

      if (this.phase === 'flight' && this.ball) {
        this.stepFlight(dt);
        return;
      }

      if (this.phase === 'over' && !this.cardShown) {
        this.endT += dt;
        if (this.endT >= CARD_DELAY_SEC) this.showCard();
      }
    }

    // 传送带：纸片沿环往右走，出窗口就从左边再转回来；被打了就躲 1.1 秒
    updateFigures(dt) {
      this.belt = wrap(this.belt + FIG_SPEED * dt, BELT_LOOP);
      for (let i = 0; i < this.figures.length; i++) {
        const fig = this.figures[i];
        if (fig.dead) {
          if (this.elapsed >= fig.respawnAt) {
            fig.dead = false;
            this.popIn(fig);
          } else {
            fig.cont.setVisible(false);
            continue;
          }
        }
        if (!fig.frozen) fig.x = BELT_X0 + wrap(this.belt + fig.offset, BELT_LOOP);
        fig.cont.setVisible(true);
        fig.cont.setPosition(fig.x, this.L.rail.y);
      }
    }

    // 被打掉的那一只爬回自己的位置：噗地一下从半大弹回原大小，队形不乱
    popIn(fig) {
      if (!fig.cont) return;
      this.tweens.add({
        targets: fig.cont,
        scaleX: { from: 0.45, to: 1 }, scaleY: { from: 0.45, to: 1 },
        duration: 260, ease: 'Back.Out',
      });
    }

    // 飞行段：固定子步推进，再快也不会穿墙、穿纸片
    stepFlight(dt) {
      this.flightT += dt;
      if (this.flightT > MAX_FLIGHT) {
        this.enterPocket(this.pocketForX(this.ball.x));
        return;
      }
      let remain = dt;
      while (remain > 1e-9) {
        const h = Math.min(SUBSTEP, remain);
        remain -= h;
        this.physicsStep(h);
        if (!this.ball || this.ball.settling) break;
      }
    }

    physicsStep(h) {
      const m = this.ball;
      const f = this.L.field;

      m.vy += GRAVITY * h;
      const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (sp > SPEED_CAP) { const k = SPEED_CAP / sp; m.vx *= k; m.vy *= k; }
      m.x += m.vx * h;
      m.y += m.vy * h;

      // 纸片：撞上就打飞一只，弹珠被弹回来（往下走），再带一点横向乱飘
      const railY = this.L.rail.y;
      const figs = this.figures;
      for (let i = 0; i < figs.length; i++) {
        const fig = figs[i];
        if (fig.dead) continue;
        const rx0 = fig.x - FIG_W * 0.5, rx1 = fig.x + FIG_W * 0.5;
        const ry0 = railY - FIG_H, ry1 = railY;
        const nx = m.x < rx0 ? rx0 : (m.x > rx1 ? rx1 : m.x);
        const ny = m.y < ry0 ? ry0 : (m.y > ry1 ? ry1 : m.y);
        const dx = m.x - nx, dy = m.y - ny;
        if (dx * dx + dy * dy <= BALL_R * BALL_R) {
          this.hitFigure(fig);
          this.bounceOffFigure(m, fig);
          break;
        }
      }

      // 左右墙 + 天花板
      if (m.x < f.x0 + BALL_R) {
        m.x = f.x0 + BALL_R;
        if (m.vx < 0) { m.vx = -m.vx * WALL_REST; Sound.wall(); }
      }
      if (m.x > f.x1 - BALL_R) {
        m.x = f.x1 - BALL_R;
        if (m.vx > 0) { m.vx = -m.vx * WALL_REST; Sound.wall(); }
      }
      // 打空了就飞出去：球冲出靶场上沿之后不再碰木框弹回来，
      // 继续往上飞、一边淡出，飞出机器这一发就算落空。
      if (m.y < this.L.window.y - BALL_R) {
        m.escaped = true;
        if (m.y < ESCAPE_Y) { this.escapeShot(); return; }
      }

      // 落洞：只在往下走的时候算，免得刚出膛就被判进洞
      if (m.vy > 0 && m.y > CAPTURE_Y) {
        this.enterPocket(this.pocketForX(m.x));
        return;
      }

      // 防卡死：只在「连续往下走」的这段时间里计时。
      // 往上飞（含刚弹离天花板那一下）不计时，否则弹珠还在半空就会被判进洞。
      if (m.vy > 0) {
        if (this.deepAt < 0) this.deepAt = this.flightT;   // 刚转为下落，计时从这一刻开始
        if (m.y > this.deepY + 6) {
          this.deepY = m.y;
          this.deepAt = this.flightT;
        } else if (this.flightT - this.deepAt > STALL_SEC) {
          this.enterPocket(this.pocketForX(m.x));
          return;
        }
      } else {
        // 往上飞：把「最深位置」抬到当前高度，等下开始下落时重新计时
        this.deepAt = -1;
        if (m.y < this.deepY) this.deepY = m.y;
      }

      // 慢吞吞卡在角落里也推一把
      const sp2 = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      if (sp2 < STALL_SPEED) {
        this.stallT += h;
        if (this.stallT > STALL_TIME) {
          this.stallT = 0;
          m.vx += (Math.random() < 0.5 ? -1 : 1) * STALL_PUSH;
          m.vy += 120;
        }
      } else {
        this.stallT = 0;
      }
    }

    hitFigure(fig) {
      const spec = fig.spec;
      fig.dead = true;
      fig.respawnAt = this.elapsed + FIG_RESPAWN;
      this.hits += 1;
      this.hitScore += fig.value;
      this.score += fig.value;
      Sound.hit(fig.value);
      this.spawnStars(fig.x, this.L.rail.y - FIG_H * 0.55, spec.body);
      this.popText(fig.x, this.L.rail.y - FIG_H - 14, '+' + fig.value, 0xFFC93D);
      this.knockOut(fig, spec);
      this.paintHud();
    }

    // 弹珠撞到纸片之后的反弹：沿着「接触法线」把弹珠顶回去。
    // 法线从纸片指向弹珠（从下面撞上来就朝下、从上面砸下来就朝上），
    // 再按撞击位置往左右歪一点 —— 撞在正中间就直直弹回来，撞在左半边就往左下走，
    // 越靠边歪得越多，幅度跟着撞上来的速度走，所以看着像真被纸片顶了一下。
    bounceOffFigure(m, fig) {
      const half = FIG_W * 0.5;
      let off = (m.x - fig.x) / half;                 // -1 左边缘 .. +1 右边缘
      if (off > 1) off = 1; else if (off < -1) off = -1;
      const nY = m.y < this.L.rail.y - FIG_H * 0.5 ? -1 : 1;
      const nX = off * FIG_TILT;
      const nl = Math.sqrt(nX * nX + 1);
      const ux = nX / nl, uy = nY / nl;
      const vn = m.vx * ux + m.vy * uy;               // 负 = 还在往纸片里钻
      if (vn < 0) {
        const k = (1 + FIG_REST) * vn;
        m.vx -= k * ux;
        m.vy -= k * uy;
      }
      m.vx += (Math.random() * 2 - 1) * FIG_JITTER;
      if (m.vx > FIG_SIDE_MAX) m.vx = FIG_SIDE_MAX;
      else if (m.vx < -FIG_SIDE_MAX) m.vx = -FIG_SIDE_MAX;
    }

    // 落在哪个洞：先看有没有洞正好接住，没有就挑离得最近的那个
    // （正中间那条发射道没有洞，弹珠直上直下会算给旁边最近的洞）
    pocketForX(x) {
      const ps = this.L.pockets;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const d = x < p.x0 ? p.x0 - x : (x > p.x1 ? x - p.x1 : 0);
        if (d < bestD) { bestD = d; best = i; }
        if (d === 0) break;
      }
      return best;
    }

    // -------------------------------------------------- 落洞 / 算分
    enterPocket(idx) {
      const m = this.ball;
      if (!m) return;
      const p = this.L.pockets[idx];
      m.settling = true;
      m.fromX = m.x;
      m.fromY = m.y;
      m.tx = p.cx;
      m.ty = p.bottomY - 30;
      this.settle = { idx: idx, t: 0, dur: SETTLE_SEC };
      Sound.drop();
    }

    finishSettle() {
      const idx = this.settle.idx;
      this.settle = null;
      this.ball = null;
      if (this.ballCont) this.ballCont.setVisible(false);
      this.resolvePocket(idx);
    }

    resolvePocket(idx) {
      const p = this.L.pockets[idx];
      this.pocketScore += p.value;
      this.score += p.value;
      Sound.pocket(p.value);
      this.spawnStars(p.cx, p.mouthY - 4, p.color);
      this.popText(p.cx, p.mouthY - 32, '+' + p.value, p.color);
      this.flash.push({ i: idx, t: 0.45 });
      this.paintHud();
      this.nextShot();
    }

    // 打空了：弹珠从机器顶上飞出去，不给分，直接换下一发
    escapeShot() {
      const m = this.ball;
      const x = m ? m.x : this.L.turret.x;
      this.spawnPuff(x, this.L.window.y - 10);
      Sound.miss();
      this.ball = null;
      this.settle = null;
      if (this.ballCont) this.ballCont.setVisible(false);
      this.nextShot();
    }

    nextShot() {
      if (this.shots >= ROUND_BALLS) { this.endRound(); return; }
      this.loadBall();
    }

    endRound() {
      this.phase = 'over';
      this.endT = 0;
      this.cardShown = false;
      this.ball = null;
      this.settle = null;
      if (this.ballCont) this.ballCont.setVisible(false);
      Sound.end();
    }

    paintHud() {
      if (this.leftText) this.leftText.setText('剩 ' + this.ballsLeft + ' 发');
      if (this.scoreText) this.scoreText.setText(String(this.score));
    }

    // -------------------------------------------------- 每帧绘制
    render() {
      // 弹珠
      if (this.ballCont) {
        const m = this.ball;
        if (!m) {
          this.ballCont.setVisible(false);
        } else if (m.settling) {
          const u = this.settle ? Math.min(1, this.settle.t / this.settle.dur) : 1;
          this.ballCont.setVisible(true);
          this.ballCont.setPosition(m.fromX + (m.tx - m.fromX) * u, m.fromY + (m.ty - m.fromY) * u);
          this.ballCont.setScale(1 - 0.5 * u);
          this.ballCont.setAlpha(1 - 0.4 * u);
        } else {
          // 飞出去的球：从靶场上沿开始淡，到 ESCAPE_Y 完全淡掉
          const top = this.L.window.y - BALL_R;
          const fade = m.escaped ? Math.max(0, Math.min(1, (m.y - ESCAPE_Y) / (top - ESCAPE_Y))) : 1;
          this.ballCont.setVisible(true).setScale(1).setAlpha(fade);
          this.ballCont.setPosition(m.x, m.y);
          const sp = Math.sqrt(m.vx * m.vx + m.vy * m.vy);
          this.spin += (0.05 + Math.min(0.5, sp / 3000)) * (this.lastDt * 60);
          this.ballCont.setRotation(this.spin);
        }
      }

      // 炮台永远竖直向上；发射时下沉一下再弹回来，飞行中整台压暗表示「在装弹」
      if (this.turretG) {
        drawTurret(this.turretG, this.L, 0, this.recoil * RECOIL_DY);
        this.turretG.setAlpha(this.phase === 'flight' ? 0.55 : 1);
      }

      // 传送带上的小格子
      if (this.beltG) drawBeltStripes(this.beltG, this.L, this.belt);

      // 洞口被砸中的余晖
      if (this.flashG) {
        const g = this.flashG;
        g.clear();
        for (let i = 0; i < this.flash.length; i++) {
          const fl = this.flash[i];
          if (fl.t <= 0) continue;
          const p = this.L.pockets[fl.i];
          const k = fl.t / 0.45;
          g.lineStyle(3 + 4 * k, p.color, 0.7 * k);
          g.strokeCircle(p.cx, p.mouthY + 28, 16 + 22 * (1 - k));
        }
      }
    }

    // -------------------------------------------------- 特效
    trackObj(o) { this.liveProps.push(o); return o; }

    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
    }

    spawnStars(x, y, color) {
      for (let i = 0; i < 8; i++) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        if (i % 2 === 0) {
          g.fillStyle(0xFFE066, 1);
          fillPts(g, starPoints(0, 0, 9, 4, 5, 0));
        } else {
          g.fillStyle(color, 1);
          g.fillCircle(0, 0, 5);
        }
        const a = -Math.PI / 2 + (i - 3.5) * 0.52;
        g.setPosition(x, y).setScale(0.4).setAlpha(0);
        this.trackObj(g);
        this.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 120, delay: i * 28 });
        this.tweens.add({
          targets: g, x: x + Math.cos(a) * 84, y: y + Math.sin(a) * 78 - 18,
          scale: 0.5, alpha: 0, duration: 520, delay: 120 + i * 28, ease: 'Quad.Out',
          onComplete: () => { this.untrackObj(g); g.destroy(); },
        });
      }
    }

    // 炮口的一小团白色气流
    spawnPuff(x, y) {
      const g = this.add.graphics().setDepth(DEPTH.fx);
      g.fillStyle(0xFFFFFF, 0.75);
      g.fillCircle(0, 0, 8);
      g.setPosition(x, y);
      this.trackObj(g);
      this.tweens.add({
        targets: g, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 260, ease: 'Sine.Out',
        onComplete: () => { this.untrackObj(g); g.destroy(); },
      });
    }

    // 被打飞的那一只：翻着跟头往斜上方飞出去再淡掉
    knockOut(fig, spec) {
      const cont = this.add.container(fig.x, this.L.rail.y).setDepth(DEPTH.fx);
      const sil = this.add.graphics();
      drawCritter(sil, spec.kind, spec.body, spec.accent, spec.dark, true);
      sil.setScale(1.13);
      sil.setY(4.4);
      const body = this.add.graphics();
      drawCritter(body, spec.kind, spec.body, spec.accent, spec.dark, false);
      cont.add([sil, body]);
      this.trackObj(cont);
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.tweens.add({
        targets: cont,
        x: fig.x + dir * (60 + Math.random() * 70),
        y: this.L.rail.y - 190 - Math.random() * 40,
        angle: dir * 240,
        scale: 0.78,
        alpha: 0,
        duration: 700,
        ease: 'Quad.Out',
        onComplete: () => { this.untrackObj(cont); cont.destroy(); },
      });
    }

    popText(x, y, text, color) {
      const t = this.add.text(x, y, text, {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#' + ('000000' + color.toString(16)).slice(-6), strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.fx);
      this.trackObj(t);
      this.tweens.add({
        targets: t, y: y - 46, alpha: 0, scale: 1.3, duration: 720, ease: 'Quad.Out',
        onComplete: () => { this.untrackObj(t); t.destroy(); },
      });
    }

    // -------------------------------------------------- 结算卡
    showCard() {
      if (this.cardShown) return;
      this.cardShown = true;
      this.cardShownAt = this.time.now;

      const L = this.L.card;
      const g = this.add.graphics().setDepth(DEPTH.overlay);
      g.fillStyle(0x0B0820, 0.55);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xFFFFFF, 0.98);
      g.fillRoundedRect(L.x, L.y, L.w, L.h, 28);
      g.lineStyle(5, C.awningA, 1);
      g.strokeRoundedRect(L.x, L.y, L.w, L.h, 28);

      const items = [g];
      const mk = (ty, text, size, color, bold) => {
        const t = this.add.text(WIDTH / 2, ty, text, {
          fontFamily: FONT, fontSize: size + 'px', fontStyle: bold ? 'bold' : 'normal',
          color: color, align: 'center',
        }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);
        items.push(t);
        return t;
      };

      mk(L.y + 52, '本轮结束', 26, '#4A3A6B', true);
      mk(L.y + 100, '打中 ' + this.hits + ' 只小动物', 24, '#E2643A', true);

      const num = mk(L.y + 172, String(this.score), 52, '#E0A32A', true);
      const tw = 44 + 14 + num.width;
      const left = WIDTH / 2 - tw / 2;
      const ig = this.add.graphics().setDepth(DEPTH.overlay + 1);
      ig.fillStyle(0xFFC93D, 1);
      fillPts(ig, starPoints(left + 22, L.y + 172, 22, 9.4, 5, 0));
      items.push(ig);
      num.setX(left + 44 + 14 + num.width / 2);

      mk(L.y + 224, '打中小动物 +' + this.hitScore + '　掉进洞里 +' + this.pocketScore, 16, '#6E5F8C');
      mk(L.y + 254, '小猪 · 小鸭 · 小青蛙　10 分', 13, '#A79BC4');
      mk(L.y + 274, '熊猫 · 小兔 · 小猫　20 分', 13, '#A79BC4');
      mk(L.y + 294, '独角兽 · 小狐狸　30 分', 13, '#A79BC4');

      const btnY = L.y + L.h - 76;
      const btn = this.add.rectangle(WIDTH / 2, btnY, 232, 62, C.awningA, 1)
        .setStrokeStyle(3, 0xFFC0A0, 0.95).setDepth(DEPTH.overlay + 1);
      const btnText = this.add.text(WIDTH / 2, btnY, '再玩一次', {
        fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.overlay + 2);
      items.push(btn, btnText);
      mk(L.y + L.h - 26, '点屏幕也可以', 15, '#A8BCC9');

      this.cardG = g;
      this.cardItems = items;
    }

    clearCard() {
      if (this.cardG) { this.cardG.destroy(); this.cardG = null; }
      if (this.cardItems) {
        for (let i = 0; i < this.cardItems.length; i++) {
          const it = this.cardItems[i];
          if (it && it.active) it.destroy();
        }
        this.cardItems = [];
      }
      this.cardShown = false;
    }

    restart() {
      this.clearCard();
      this.scene.restart();
    }

    // -------------------------------------------------- 测试用钩子（非公共 API）
    simulate(seconds, step) {
      const h = step || 1 / 60;
      let t = 0;
      while (t < seconds - 1e-9) {
        const dt = Math.min(h, seconds - t);
        this.step(dt);
        t += dt;
      }
      return this.phase;
    }

    // 把某只纸片钉在指定的 x 上（测试用），releaseFigures() 放开
    forceFigure(index, x) {
      const fig = this.figures[Math.max(0, Math.min(this.figures.length - 1, index | 0))];
      if (!fig) return null;
      fig.frozen = true;
      fig.dead = false;
      fig.x = x === undefined ? (this.L.field.x0 + this.L.field.x1) / 2 : x;
      if (fig.cont) { fig.cont.setVisible(true); fig.cont.setPosition(fig.x, this.L.rail.y); }
      return fig.x;
    }

    releaseFigures() {
      for (let i = 0; i < this.figures.length; i++) this.figures[i].frozen = false;
    }

    // 现在这个瞬间，有没有纸片正好压在炮口那条竖直线上（没有就 -1）
    figureOverCannon() {
      const t = this.L.turret;
      for (let i = 0; i < this.figures.length; i++) {
        const f = this.figures[i];
        if (f.dead) continue;
        if (Math.abs(f.x - t.x) <= FIG_W * 0.5 + BALL_R) return i;
      }
      return -1;
    }

    // 强制投一颗弹珠进第 index 个洞（测试用，不扣发数）
    dropInto(index) {
      const idx = Math.max(0, Math.min(this.L.pockets.length - 1, index | 0));
      if (this.settle) this.settle = null;
      const p = this.L.pockets[idx];
      this.ball = {
        x: p.cx, y: p.mouthY - 6, vx: 0, vy: 120,
        settling: false, fromX: p.cx, fromY: p.mouthY - 6, tx: p.cx, ty: p.mouthY - 6,
      };
      this.enterPocket(idx);
      return idx;
    }
  }

  window.TargetScene = TargetScene;
})();
