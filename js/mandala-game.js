/*
 * 曼陀罗涂色：竖屏成人解压小玩具。每张都是程序生成的对称曼陀罗，
 * 指尖点一下或拖过去就把那一格填上色，涂满整张会有一次柔和和弦 + 小闪光；
 * 点「换一张」是一张全新的花纹，「清空」只擦掉颜色、保留花纹。
 * 没有分数、没有计时、没有对错、没有存档，进去就是放空。
 * 画面全部 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，不加载任何素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  // 静心低饱和 8 色：顺序永不变化，默认选第 2 个「雾蓝」
  const PALETTE = [0xEFE9DE, 0xA8BFD4, 0xA9BFA6, 0x6E8E7F, 0xD8C3A5, 0xC08A6E, 0xE3B7B7, 0xB3A6C9];
  const PALETTE_NAMES = ['米白', '雾蓝', '灰绿', '松绿', '奶茶', '赭石', '柔粉', '烟紫'];
  const DEFAULT_COLOR = 1;

  const C = {
    paper: 0xF4F0E8,        // 暖白纸底
    shade: 0x9A9184,        // 曼陀罗底下的柔光
    grain: 0x8A8378,        // 纸纹小点
    line: 0x7A7570,         // 格子描边
    lineSoft: 0xB9B2A6,     // 装饰线
    ink: 0x5B6472,          // 悬停高亮 / 选中环
    btnLine: 0xADA69C,
    btnText: '#5C5A55',
    hintText: '#8C877D',
  };

  const PAPER_DOTS = 140;         // 纸纹小点数量
  const OUTER_DOT_COUNT = 28;     // 外圈装饰点
  const ARC_SEG = 11;             // 弧折线分段
  const EDGE_SEG = 14;            // 花瓣边缘分段
  const RING_SEG = 48;            // 实心圆环分段
  const DISC_SEG = 26;            // 中心圆盘分段
  const BAND_MIN = 4;
  const BAND_MAX = 6;
  const SECTOR_CHOICES = [6, 8, 10, 12];
  const SECTOR_CAP = 16;
  const CELL_MIN = 24;
  const CELL_MAX = 96;
  const INNER_RATIO = 0.16;       // 中心圆盘占外半径的比例
  const PAINT_SOUND_MS = 45;      // 涂抹音的节流
  const RIPPLE_GAP_MS = 90;       // 墨点涟漪的节流
  const FADE_OUT_MS = 250;
  const FADE_IN_MS = 300;
  const CLEAR_MS = 260;
  const CELL_FADE_MS = 170;
  const HINT_DELAY_MS = 4000;
  const SWATCH = 50;
  const SWATCH_GAP = 10;
  const SWATCH_R = 14;
  const BTN_W = 152;
  const BTN_H = 54;

  // 纸底(0) -> 装饰(1) -> 描边(2) -> 填色(3) -> 悬停(4) -> 涟漪(12) -> 调色板(20) -> 完成闪光(30)
  const DEPTH = { paper: 0, decor: 1, fill: 2, stroke: 3, hover: 4, ripple: 12, ui: 20, flash: 30 };

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const cx = WIDTH / 2;
    const cy = 420;
    const R = 224;
    const count = PALETTE.length;
    const total = count * SWATCH + (count - 1) * SWATCH_GAP;
    const x0 = (WIDTH - total) / 2;
    const swatches = [];
    for (let i = 0; i < count; i++) {
      const x = x0 + i * (SWATCH + SWATCH_GAP);
      swatches.push({ i: i, x: x, y: 806 - SWATCH / 2, w: SWATCH, h: SWATCH, cx: x + SWATCH / 2, cy: 806 });
    }
    return {
      mandala: { cx: cx, cy: cy, R: R },
      swatches: swatches,
      clear: { x: 188, y: 892, w: BTN_W, h: BTN_H },
      fresh: { x: 352, y: 892, w: BTN_W, h: BTN_H },
      hint: { x: cx, y: 76 },
    };
  }

  // ---------------------------------------------------------------- 几何小工具
  // 射线法：点是否在多边形内
  function ptInPoly(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  function bboxOf(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    }
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  function pathPts(g, pts) {
    if (!pts || pts.length < 3) return false;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    return true;
  }

  function inRect(r, x, y) {
    return x >= r.x - r.w / 2 && x <= r.x + r.w / 2 && y >= r.y - r.h / 2 && y <= r.y + r.h / 2;
  }

  // 中心圆盘（首尾不重复）
  function circlePts(cx, cy, r, n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return pts;
  }

  // 实心圆环：外弧逆时针 + 内弧顺时针，接缝留在 12 点方向
  function annulusPts(cx, cy, rIn, rOut) {
    const pts = [];
    for (let i = 0; i < RING_SEG; i++) {
      const a = -Math.PI / 2 + (i / RING_SEG) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rOut, y: cy + Math.sin(a) * rOut });
    }
    for (let i = 0; i < RING_SEG; i++) {
      const a = -Math.PI / 2 - (i / RING_SEG) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * rIn, y: cy + Math.sin(a) * rIn });
    }
    return pts;
  }

  // 环形扇区：外弧 + 内弧，两条直边由首尾相接自然形成
  function annularSectorPts(cx, cy, rIn, rOut, a0, a1) {
    const pts = [];
    for (let i = 0; i <= ARC_SEG; i++) {
      const a = a0 + (a1 - a0) * (i / ARC_SEG);
      pts.push({ x: cx + Math.cos(a) * rOut, y: cy + Math.sin(a) * rOut });
    }
    for (let i = ARC_SEG; i >= 0; i--) {
      const a = a0 + (a1 - a0) * (i / ARC_SEG);
      pts.push({ x: cx + Math.cos(a) * rIn, y: cy + Math.sin(a) * rIn });
    }
    return pts;
  }

  // 花瓣：两条极坐标椭圆弧（半径 rMid ± dr/2），在扇区分界处收成一点，
  // 相邻花瓣正好碰在同一个尖上；整片花瓣必定落在自己的扇区与环带内。
  function petalPts(cx, cy, rIn, rOut, a0, a1, mid) {
    const half = (a1 - a0) / 2;
    const rMid = (rIn + rOut) / 2;
    const dr = (rOut - rIn) / 2;
    const right = [];
    for (let i = 0; i <= EDGE_SEG; i++) {
      const phi = -Math.PI / 2 + Math.PI * (i / EDGE_SEG);
      const a = mid + half * Math.cos(phi);
      const r = rMid + dr * Math.sin(phi);
      right.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    const left = [];
    for (let i = EDGE_SEG; i >= 0; i--) {
      const phi = -Math.PI / 2 + Math.PI * (i / EDGE_SEG);
      const a = mid - half * Math.cos(phi);
      const r = rMid + dr * Math.sin(phi);
      left.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return right.concat(left.slice(1, -1));
  }

  // 每张的花纹结构：环带数量 + 每带扇区数 / 形状
  // shape: 'flat' 环形扇区 | 'petal' 花瓣 | 'ring' 实心圆环（1 格，极坐标判定）
  function randomSpec() {
    const n = BAND_MIN + Math.floor(Math.random() * (BAND_MAX - BAND_MIN + 1));
    const spec = [];
    let sectors = SECTOR_CHOICES[Math.floor(Math.random() * SECTOR_CHOICES.length)];
    for (let i = 0; i < n; i++) {
      if (i > 0 && i < n - 1 && Math.random() < 0.2) {
        spec.push({ sectors: 1, shape: 'ring' });
        continue;
      }
      if (i > 0 && Math.random() < 0.35 && sectors * 2 <= SECTOR_CAP) sectors *= 2;
      spec.push({ sectors: sectors, shape: Math.random() < 0.42 ? 'flat' : 'petal' });
    }
    return spec;
  }

  function cellCountOf(spec) {
    let total = 1;
    for (let i = 0; i < spec.length; i++) total += spec[i].sectors;
    return total;
  }

  // 保证有一个一定合法的兜底结构（6 + 12x4 + 中心 = 55 格）
  const FALLBACK_SPEC = [
    { sectors: 6, shape: 'petal' },
    { sectors: 12, shape: 'ring' },
    { sectors: 12, shape: 'petal' },
    { sectors: 12, shape: 'flat' },
    { sectors: 12, shape: 'petal' },
  ];

  // 格子内部的一个点（用于测试取样，也保证命中判定一定能找到它）
  function interiorPoint(cell) {
    if (cell.polar) {
      const r = (cell.polar.r0 + cell.polar.r1) / 2;
      return { x: cell.cx + Math.cos(cell.mid) * r, y: cell.cy + Math.sin(cell.mid) * r };
    }
    let sx = 0, sy = 0;
    for (let i = 0; i < cell.pts.length; i++) { sx += cell.pts[i].x; sy += cell.pts[i].y; }
    const m = { x: sx / cell.pts.length, y: sy / cell.pts.length };
    if (ptInPoly(m.x, m.y, cell.pts)) return m;
    for (let i = 0; i < cell.pts.length; i++) {
      const a = cell.pts[i], b = cell.pts[(i + 1) % cell.pts.length];
      const q = { x: (m.x + a.x + b.x) / 3, y: (m.y + a.y + b.y) / 3 };
      if (ptInPoly(q.x, q.y, cell.pts)) return q;
    }
    return m;
  }

  function makeCell(cx, cy, band, sector, shape, pts, extra) {
    const cell = {
      band: band,
      sector: sector,
      shape: shape,
      pts: pts,
      bbox: bboxOf(pts),
      cx: cx,
      cy: cy,
      mid: extra.mid || 0,
      rIn: extra.rIn,
      rOut: extra.rOut,
      color: null,
    };
    if (extra.polar) cell.polar = extra.polar;
    cell.hitPt = interiorPoint(cell);
    return cell;
  }

  // 造一张曼陀罗（不碰画面）：先摇结构，再按半径分层切格
  function buildCells(L) {
    const cx = L.mandala.cx, cy = L.mandala.cy, R = L.mandala.R;
    let spec = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const cand = randomSpec();
      const total = cellCountOf(cand);
      if (total >= CELL_MIN && total <= CELL_MAX) { spec = cand; break; }
    }
    if (!spec) spec = FALLBACK_SPEC;
    const n = spec.length;
    const radii = [];
    for (let i = 0; i <= n; i++) radii.push(R * (INNER_RATIO + (1 - INNER_RATIO) * (i / n)));

    const cells = [];
    cells.push(makeCell(cx, cy, -1, 0, 'disc', circlePts(cx, cy, radii[0], DISC_SEG),
      { mid: -Math.PI / 2, rIn: 0, rOut: radii[0], polar: { r0: 0, r1: radii[0] } }));

    for (let i = 0; i < n; i++) {
      const s = spec[i];
      const rIn = radii[i], rOut = radii[i + 1];
      if (s.shape === 'ring') {
        cells.push(makeCell(cx, cy, i, 0, 'ring', annulusPts(cx, cy, rIn, rOut),
          { mid: -Math.PI / 2, rIn: rIn, rOut: rOut, polar: { r0: rIn, r1: rOut } }));
        continue;
      }
      const step = Math.PI * 2 / s.sectors;
      for (let k = 0; k < s.sectors; k++) {
        const a0 = -Math.PI / 2 + k * step;
        const a1 = a0 + step;
        const mid = (a0 + a1) / 2;
        const pts = s.shape === 'petal'
          ? petalPts(cx, cy, rIn, rOut, a0, a1, mid)
          : annularSectorPts(cx, cy, rIn, rOut, a0, a1);
        cells.push(makeCell(cx, cy, i, k, s.shape, pts, { mid: mid, rIn: rIn, rOut: rOut }));
      }
    }
    return { cells: cells, bands: spec, radii: radii, n: n };
  }

  // ---------------------------------------------------------------- 绘制
  // 暖白纸面 + 纸纹小点（只在开局画一次，不逐帧重画）
  function drawPaper(g) {
    g.fillStyle(C.paper, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < PAPER_DOTS; i++) {
      const x = Math.random() * WIDTH;
      const y = Math.random() * HEIGHT;
      const r = 0.6 + Math.random() * 1.4;
      g.fillStyle(C.grain, 0.03 + Math.random() * 0.05);
      g.fillCircle(x, y, r);
    }
  }

  // 不可点的装饰：柔光底 + 外圈小点环 + 中心点簇
  function drawDecor(g, L) {
    const cx = L.mandala.cx, cy = L.mandala.cy, R = L.mandala.R;
    g.fillStyle(C.shade, 0.05);
    g.fillCircle(cx, cy, R + 10);
    for (let i = 0; i < OUTER_DOT_COUNT; i++) {
      const a = (i / OUTER_DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * (R + 14);
      const y = cy + Math.sin(a) * (R + 14);
      const big = i % 2 === 0;
      g.fillStyle(C.lineSoft, big ? 0.95 : 0.55);
      g.fillCircle(x, y, big ? 3.4 : 2.1);
    }
    const rd = R * INNER_RATIO;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(C.lineSoft, 0.7);
      g.fillCircle(cx + Math.cos(a) * rd * 0.52, cy + Math.sin(a) * rd * 0.52, 2.4);
    }
    g.fillStyle(C.lineSoft, 0.85);
    g.fillCircle(cx, cy, 1.8);
  }

  // 一格的上色：圆盘与圆环直接用圆（两边渲染器都稳），其余走多边形
  function fillCell(g, c, color, alpha) {
    const a = alpha === undefined ? 1 : alpha;
    if (c.shape === 'disc') { g.fillStyle(color, a); g.fillCircle(c.cx, c.cy, c.rOut); return; }
    if (c.shape === 'ring') { g.lineStyle(c.rOut - c.rIn, color, a); g.strokeCircle(c.cx, c.cy, (c.rIn + c.rOut) / 2); return; }
    g.fillStyle(color, a);
    if (pathPts(g, c.pts)) g.fillPath();
  }

  // 描边层：整张画一次；画在填色层上面，涂色不会吃掉线条
  function drawStrokes(g, cells) {
    g.lineStyle(1.5, C.line, 1);
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.shape === 'disc') { g.strokeCircle(c.cx, c.cy, c.rOut); continue; }
      if (c.shape === 'ring') { g.strokeCircle(c.cx, c.cy, c.rIn); g.strokeCircle(c.cx, c.cy, c.rOut); continue; }
      if (pathPts(g, c.pts)) g.strokePath();
    }
  }

  // 填色层：只画已经有颜色的格子
  function paintCells(g, cells) {
    g.clear();
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (c.color === null || c.color === undefined) continue;
      fillCell(g, c, PALETTE[c.color], 1);
    }
  }

  // ---------------------------------------------------------------- 音效
  // 全部用 WebAudio 合成：涂抹是一声极短的纸笔沙沙，涂满是一次柔和和弦
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

    // 白噪声 + 带通，用来做纸笔与翻页的沙沙声
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
      // 涂抹：一声很短的纸笔沙沙（音高随机 ±8%，免得听腻）
      paint: function () { noise(0.045, 0.09, 0, 1800 * (0.92 + Math.random() * 0.16), 0, 1.6); },
      // 换色：一声轻脆的选定音
      select: function () { tone(420, 0.10, 0.05, 0, 'sine'); tone(840, 0.07, 0.02, 0, 'sine'); },
      // 换一张：翻纸
      newSheet: function () { noise(0.26, 0.07, 0, 1200, 300, 0.9); },
      // 清空：短促下行
      clear: function () { for (let i = 0; i < 5; i++) tone(760 - i * 110, 0.12, 0.035, i * 0.03, 'sine'); },
      // 涂满：C-E-G-B 四音柔和和弦，错开 90ms
      done: function () {
        [0, 4, 7, 11].forEach(function (semi, i) {
          const f = 261.63 * Math.pow(2, semi / 12);
          tone(f, 1.5, 0.075, i * 0.09, 'sine');
          tone(f * 2, 1.0, 0.022, i * 0.09, 'sine');
        });
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class MandalaScene extends Phaser.Scene {
    constructor() {
      super('MandalaScene');
    }

    create() {
      this.L = computeLayout();
      this.PALETTE = PALETTE.slice();
      this.PALETTE_NAMES = PALETTE_NAMES.slice();
      this.CONST = {
        PALETTE_SIZE: PALETTE.length,
        DEFAULT_COLOR: DEFAULT_COLOR,
        CELL_MIN: CELL_MIN,
        CELL_MAX: CELL_MAX,
        PAPER_DOTS: PAPER_DOTS,
        OUTER_DOT_COUNT: OUTER_DOT_COUNT,
        PAINT_SOUND_MS: PAINT_SOUND_MS,
        RIPPLE_GAP_MS: RIPPLE_GAP_MS,
        FADE_OUT_MS: FADE_OUT_MS,
        FADE_IN_MS: FADE_IN_MS,
        R: this.L.mandala.R,
      };

      this.cells = [];
      this.bands = [];
      this.radii = [];
      this.seed = 0;
      this.colorIdx = DEFAULT_COLOR;
      this.busy = false;
      this.doneFired = false;
      this.doneCount = 0;
      this.hoverIdx = -1;
      this.activePointerId = null;
      this.lastPt = null;
      this.lastCell = -1;
      this.lastPaintAt = -1e9;
      this.lastRippleAt = -1e9;
      this.liveProps = [];

      Sound.resume();

      this.buildPaper();
      this.buildLayers();
      this.buildHint();
      this.buildUi();
      this.bindInput();
      this.newSheet();
    }

    // -------------------------------------------------- 背景与图层
    buildPaper() {
      const g = this.add.graphics().setDepth(DEPTH.paper);
      drawPaper(g);
    }

    buildLayers() {
      this.decorG = this.add.graphics().setDepth(DEPTH.decor);
      this.fillG = this.add.graphics().setDepth(DEPTH.fill);
      this.strokeG = this.add.graphics().setDepth(DEPTH.stroke);
      this.hoverG = this.add.graphics().setDepth(DEPTH.hover);
    }

    buildHint() {
      const t = this.add.text(this.L.hint.x, this.L.hint.y, '点一下或拖过去就上色', {
        fontFamily: FONT, fontSize: '19px', color: C.hintText,
      }).setOrigin(0.5).setDepth(DEPTH.ui);
      this.trackObj(t);
      this.tweens.add({
        targets: t, alpha: 0, delay: HINT_DELAY_MS, duration: 700,
        onComplete: () => { this.untrackObj(t); t.destroy(); },
      });
    }

    // -------------------------------------------------- 调色板与按钮
    buildUi() {
      this.swatchGs = [];
      for (let i = 0; i < this.L.swatches.length; i++) {
        const g = this.add.graphics().setDepth(DEPTH.ui);
        g.setPosition(this.L.swatches[i].cx, this.L.swatches[i].cy);
        this.swatchGs.push(g);
      }
      this.paintSwatches();
      this.buildButton(this.L.clear, '清空');
      this.buildButton(this.L.fresh, '换一张');
    }

    buildButton(r, label) {
      const g = this.add.graphics().setDepth(DEPTH.ui);
      g.fillStyle(0xFFFFFF, 0.5);
      g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 16);
      g.lineStyle(2.5, C.btnLine, 1);
      g.strokeRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 16);
      const t = this.add.text(r.x, r.y, label, {
        fontFamily: FONT, fontSize: '24px', color: C.btnText,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
    }

    paintSwatches() {
      for (let i = 0; i < this.swatchGs.length; i++) {
        const g = this.swatchGs[i];
        g.clear();
        g.fillStyle(PALETTE[i], 1);
        g.fillRoundedRect(-SWATCH / 2, -SWATCH / 2, SWATCH, SWATCH, SWATCH_R);
        if (i === this.colorIdx) {
          g.lineStyle(2.6, C.ink, 0.9);
          g.strokeRoundedRect(-SWATCH / 2 - 4, -SWATCH / 2 - 4, SWATCH + 8, SWATCH + 8, SWATCH_R + 4);
        } else {
          g.lineStyle(1.5, C.btnLine, 0.85);
          g.strokeRoundedRect(-SWATCH / 2, -SWATCH / 2, SWATCH, SWATCH, SWATCH_R);
        }
      }
    }

    // -------------------------------------------------- 换一张 / 清空
    newSheet(animate) {
      if (this.busy) return false;
      const apply = () => {
        const data = buildCells(this.L);
        this.cells = data.cells;
        this.bands = data.bands;
        this.radii = data.radii;
        this.seed = Math.floor(Math.random() * 1e9);
        this.doneFired = false;
        this.doneCount = 0;
        this.hoverIdx = -1;
        this.lastCell = -1;
        this.paintDecor();
        this.paintStrokes();
        this.paintFills();
        this.hoverG.clear();
      };
      if (!animate) { apply(); return true; }

      this.busy = true;
      Sound.newSheet();
      const layers = [this.decorG, this.strokeG, this.fillG, this.hoverG];
      this.tweens.add({
        targets: layers, alpha: 0, duration: FADE_OUT_MS,
        onComplete: () => {
          apply();
          this.tweens.add({
            targets: layers, alpha: 1, duration: FADE_IN_MS,
            onComplete: () => { this.busy = false; },
          });
        },
      });
      return true;
    }

    clearFills() {
      let any = false;
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        if (c.color !== null && c.color !== undefined) { c.color = null; any = true; }
      }
      if (any) { this.paintFills(); Sound.clear(); }
      this.doneFired = false;
      this.doneCount = 0;
      return any;
    }

    paintDecor() { this.decorG.clear(); drawDecor(this.decorG, this.L); }
    paintStrokes() { this.strokeG.clear(); drawStrokes(this.strokeG, this.cells); }
    paintFills() { paintCells(this.fillG, this.cells); }

    // -------------------------------------------------- 上色
    paintCell(i, colorIdx, px, py) {
      const cell = this.cells[i];
      if (!cell) return false;
      const want = Math.max(0, Math.min(PALETTE.length - 1, colorIdx === undefined || colorIdx === null ? this.colorIdx : (colorIdx | 0)));
      if (cell.color === want) return false;
      cell.color = want;
      this.paintFills();
      const now = this.time.now;
      if (now - this.lastPaintAt >= PAINT_SOUND_MS) { this.lastPaintAt = now; Sound.paint(); }
      if (px !== undefined && now - this.lastRippleAt >= RIPPLE_GAP_MS) {
        this.lastRippleAt = now;
        this.spawnRipple(px, py);
      }
      this.checkComplete();
      return true;
    }

    selectColor(i) {
      const idx = Math.max(0, Math.min(PALETTE.length - 1, i | 0));
      if (idx !== this.colorIdx) Sound.select();
      this.colorIdx = idx;
      this.paintSwatches();
      const g = this.swatchGs[idx];
      if (g) this.tweens.add({ targets: g, scale: { from: 1.16, to: 1 }, duration: 180, ease: 'Back.Out' });
      return idx;
    }

    checkComplete() {
      if (this.doneFired || !this.isComplete()) return false;
      this.doneFired = true;
      this.doneCount += 1;
      Sound.done();
      this.flash();
      return true;
    }

    isComplete() {
      if (this.cells.length === 0) return false;
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        if (c.color === null || c.color === undefined) return false;
      }
      return true;
    }

    // -------------------------------------------------- 命中判定
    cellAt(x, y) {
      for (let i = 0; i < this.cells.length; i++) {
        const c = this.cells[i];
        const b = c.bbox;
        if (x < b.x0 - 0.5 || x > b.x1 + 0.5 || y < b.y0 - 0.5 || y > b.y1 + 0.5) continue;
        if (c.polar) {
          const dx = x - c.cx, dy = y - c.cy;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < c.polar.r0 || r > c.polar.r1) continue;
          return i;
        }
        if (ptInPoly(x, y, c.pts)) return i;
      }
      return -1;
    }

    swatchAt(x, y) {
      const list = this.L.swatches;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return i;
      }
      return -1;
    }

    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
      this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
      this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
      this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
    }

    onPointerDown(p) {
      Sound.resume();
      if (this.busy) return;
      if (this.activePointerId !== null) return;
      const x = p.x, y = p.y;
      this.activePointerId = p.id;
      this.lastPt = { x: x, y: y };
      this.lastCell = -1;

      const si = this.swatchAt(x, y);
      if (si >= 0) { this.selectColor(si); return; }
      if (inRect(this.L.clear, x, y)) { this.clearFills(); return; }
      if (inRect(this.L.fresh, x, y)) { this.newSheet(true); return; }

      const i = this.cellAt(x, y);
      if (i >= 0) { this.paintCell(i, this.colorIdx, x, y); this.lastCell = i; }
    }

    onPointerMove(p) {
      if (p.id !== this.activePointerId) {
        if (!p.isDown) this.updateHover(p.x, p.y);
        return;
      }
      if (this.busy) return;
      const x = p.x, y = p.y;
      if (this.lastPt) {
        const dx = x - this.lastPt.x;
        const dy = y - this.lastPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.min(6, Math.round(dist / 12)));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          this.tryPaint(this.lastPt.x + dx * t, this.lastPt.y + dy * t);
        }
      } else {
        this.tryPaint(x, y);
      }
      this.lastPt = { x: x, y: y };
    }

    onPointerUp(p) {
      if (this.activePointerId === null) return;
      if (p && p.id !== undefined && p.id !== this.activePointerId) return;
      this.activePointerId = null;
      this.lastPt = null;
      this.lastCell = -1;
    }

    // 拖着走的时候连续涂抹：同一格不重复、同色不重复
    tryPaint(x, y) {
      const i = this.cellAt(x, y);
      if (i < 0) { this.lastCell = -1; return false; }
      if (i === this.lastCell) return false;
      const changed = this.paintCell(i, this.colorIdx, x, y);
      this.lastCell = i;
      return changed;
    }

    // -------------------------------------------------- 悬停高亮（鼠标）
    updateHover(x, y) {
      const i = this.cellAt(x, y);
      if (i === this.hoverIdx) return;
      this.hoverIdx = i;
      const g = this.hoverG;
      g.clear();
      if (i < 0) return;
      fillCell(g, this.cells[i], C.ink, 0.06);
    }

    // -------------------------------------------------- 小特效
    spawnRipple(x, y) {
      const g = this.add.graphics().setDepth(DEPTH.ripple);
      g.setPosition(x, y);
      g.lineStyle(2.4, C.ink, 0.5);
      g.strokeCircle(0, 0, 6);
      this.trackObj(g);
      this.tweens.add({
        targets: g, scale: { from: 0.6, to: 2.6 }, alpha: 0, duration: 420, ease: 'Quad.Out',
        onComplete: () => { this.untrackObj(g); g.destroy(); },
      });
    }

    flash() {
      const g = this.add.graphics().setDepth(DEPTH.flash);
      g.fillStyle(0xFFFFFF, 1);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.setAlpha(0.12);
      this.trackObj(g);
      this.tweens.add({
        targets: g, alpha: 0, duration: 600, ease: 'Quad.Out',
        onComplete: () => { this.untrackObj(g); g.destroy(); },
      });
    }

    // -------------------------------------------------- 特效清理
    trackObj(o) { this.liveProps.push(o); return o; }
    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
      return o;
    }

    // -------------------------------------------------- 测试钩子（非公共 API）
    simulate(seconds, step) {
      const h = step || 1 / 60;
      const n = Math.max(0, Math.round(seconds / h));
      for (let i = 0; i < n; i++) this.time.now += h * 1000;
      return n;
    }
  }

  window.MandalaScene = MandalaScene;
})();
