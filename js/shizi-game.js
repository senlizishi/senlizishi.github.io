/*
 * 认字描红：竖屏（540x960）识字小玩具。
 * 每个字走一遍固定流程：看图猜 -> 揭晓（字出现 + 手机念 + 拼音 + 一句话意思）
 * -> 在米字格里按笔顺一笔一笔描 -> 描完庆祝 -> 引导到纸上再写一遍 -> 下一个字。
 * 手机竖屏、孩子自己拿着玩，大人在旁边提问与把关。
 * 无分数、无计时、无失败、可无限重来；进度只记「哪些字描过」，存在本机。
 * 字不靠字体：每字每一笔是 0..1 归一化控制点，载入时用 Catmull-Rom 重采样成密集折线，
 * 渲染和判定共用这一份数据，所以淡色底字和判定目标永远对齐。
 * 画面全部 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，发音用浏览器自带中文语音合成，
 * 不加载任何图片 / 音频 / 字体文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 常量与配色
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';

  const BOX = 400;              // 米字格边长
  const STROKE_W = 24;          // 笔画粗细（看着像小孩描红的大笔）
  const DAB_STEP = 2;           // 盖章间距：折线就是沿路径盖一串圆点，天然圆头圆角

  const TOL_START = 0.22;       // 起点允许离这一笔的起点这么远（×BOX）
  const TOL_LATERAL = 0.13;     // 中途允许离笔画中心线这么远（×BOX）
  const TOL_COVER = 0.82;       // 至少要描到这一笔的这么长（0..1）
  const TOL_BACK = 0.10;        // 倒退超过这么多就记一次倒退
  const TOL_BACK_RATIO = 0.20;  // 倒退采样点占比超过这个判不过
  const TOL_STICK = 0.80;       // 贴合容差内的采样点占比要达到这个
  const NEAR_T = 0.25;          // 起笔时的进度必须还在这一笔的前 25%
  const MIN_SAMPLES = 3;        // 少于这么多采样点当作没描，不判错
  const SAMPLE_GAP = 3;         // 采样点之间的最小间距 px

  const DEMO_MS = 700;          // 描歪后自动演示这一笔
  const CELEBRATE_MS = 1500;    // 描完庆祝停留
  const REVEAL_MS = 900;        // 揭晓时字淡入
  const STORE_KEY = 'shizi-v1';

  const C = {
    paper: 0xFDF8F0,          // 纸底
    band: 0xFDF3E6,           // 顶部一条浅浅的底
    card: 0xFFFDF8,           // 卡片底
    cardOn: 0xFFF4DC,         // 当前选中的字卡
    grid: 0xEADFD2,           // 米字格线
    gridEdge: 0xE0CFC0,       // 米字格外框
    ghost: 0xE5E1DA,          // 还没描的笔画
    done: 0x3D5A80,           // 已经描好的笔画（墨蓝）
    ink: 0x3A3A3A,            // 描完庆祝时的墨色
    cur: 0xFFB020,            // 当前这一笔的高亮
    curSoft: 0xFFE1A6,        // 当前这一笔的底色
    dot: 0xFF9F1C,            // 起点圆点
    trail: 0x3D5A80,          // 孩子手指的轨迹
    trailBad: 0xE07A5F,       // 偏离太远的那几段
    text: 0x5C5A55,
    textSoft: 0x9A938A,
    chip: 0xFFF1DC,           // 组胶囊
    chipOn: 0xFFC978,         // 选中的组
    chipLine: 0xE7D6BE,
    mark: 0x7FB069,           // 打过勾的绿
    btn: 0x7FB069,            // 主按钮
    btnBlue: 0x6EC1E4,        // 「念一遍」按钮
    btnOff: 0xE2DACC,         // 按钮变灰
    btnAlt: 0xF0E6D8,         // 次按钮
    btnText: 0xFFFFFF,
    btnAltText: 0x6E6459,
    shadow: 0x000000,
    cardInk: 0x3D5A80,
  };

  // 文字用十六进制字符串（Phaser 的 text 用 CSS 颜色）
  C.textHex = '#5C5A55';
  C.subHex = '#3D5A80';
  C.softHex = '#B0A79A';
  C.meanHex = '#8A8078';
  C.markHex = '#6FA25F';

  const GROUPS = [
    { key: 'num', label: '数字方位' },
    { key: 'nature', label: '大自然' },
    { key: 'body', label: '身体' },
    { key: 'life', label: '动植物' },
  ];
  // ---------------------------------------------------------------- 字库
  // 每条：c 字 / py 拼音 / mean 一句话意思 / word 组词 / art 插图键 / g 组号 / strokes 笔顺
  // strokes 里每一笔是一串 0..1 的控制点（x 向右、y 向下），载入时会平滑重采样成密集折线；
  // 字形大致落在 0.15~0.88 之间，够大又好描。
  const CHARS = [
    // ---------- 组 0：数字方位
    { c: '一', py: 'yī', mean: '一根小棍子，就是「一」', word: '一个', art: 'one', g: 0,
      strokes: [[[0.18, 0.50], [0.82, 0.50]]] },
    { c: '二', py: 'èr', mean: '两根小棍子，就是「二」', word: '二月', art: 'two', g: 0,
      strokes: [[[0.30, 0.36], [0.70, 0.36]], [[0.18, 0.68], [0.82, 0.68]]] },
    { c: '三', py: 'sān', mean: '三根小棍子，就是「三」', word: '三个', art: 'three', g: 0,
      strokes: [[[0.30, 0.28], [0.70, 0.28]], [[0.26, 0.50], [0.74, 0.50]], [[0.18, 0.74], [0.82, 0.74]]] },
    { c: '十', py: 'shí', mean: '一横一竖，合起来是「十」', word: '十个', art: 'ten', g: 0,
      strokes: [[[0.20, 0.44], [0.80, 0.44]], [[0.50, 0.16], [0.50, 0.86]]] },
    { c: '上', py: 'shàng', mean: '在上面，往上看', word: '上面', art: 'up', g: 0,
      strokes: [[[0.50, 0.20], [0.50, 0.78]], [[0.28, 0.50], [0.72, 0.50]], [[0.16, 0.78], [0.84, 0.78]]] },
    { c: '下', py: 'xià', mean: '在下面，往下看', word: '下面', art: 'down', g: 0,
      strokes: [[[0.16, 0.24], [0.84, 0.24]], [[0.50, 0.24], [0.50, 0.82]], [[0.60, 0.44], [0.68, 0.52]]] },

    // ---------- 组 1：大自然
    { c: '日', py: 'rì', mean: '天上的太阳，也叫日', word: '日出', art: 'sun', g: 1,
      strokes: [[[0.32, 0.20], [0.32, 0.82]], [[0.32, 0.20], [0.68, 0.20], [0.68, 0.82]],
        [[0.32, 0.51], [0.68, 0.51]], [[0.32, 0.82], [0.68, 0.82]]] },
    { c: '月', py: 'yuè', mean: '晚上弯弯的月亮', word: '月亮', art: 'moon', g: 1,
      strokes: [[[0.44, 0.18], [0.38, 0.50], [0.34, 0.70], [0.30, 0.86]],
        [[0.44, 0.18], [0.72, 0.18], [0.72, 0.78], [0.66, 0.86]],
        [[0.38, 0.44], [0.72, 0.44]], [[0.36, 0.62], [0.72, 0.62]]] },
    { c: '山', py: 'shān', mean: '高高的山，爬上去看风景', word: '高山', art: 'mountain', g: 1,
      strokes: [[[0.50, 0.20], [0.50, 0.80]], [[0.26, 0.38], [0.26, 0.80], [0.74, 0.80]],
        [[0.74, 0.38], [0.74, 0.80]]] },
    { c: '水', py: 'shuǐ', mean: '喝的、洗手用的水', word: '喝水', art: 'water', g: 1,
      strokes: [[[0.50, 0.14], [0.50, 0.72], [0.42, 0.82]],
        [[0.20, 0.30], [0.44, 0.33], [0.28, 0.56], [0.17, 0.70]],
        [[0.62, 0.26], [0.68, 0.38], [0.71, 0.48]],
        [[0.60, 0.44], [0.74, 0.62], [0.88, 0.82]]] },
    { c: '火', py: 'huǒ', mean: '红红的火，热热的', word: '火苗', art: 'fire', g: 1,
      strokes: [[[0.30, 0.26], [0.25, 0.36]], [[0.36, 0.44], [0.24, 0.60], [0.16, 0.72]],
        [[0.50, 0.20], [0.50, 0.46], [0.42, 0.64], [0.34, 0.80]],
        [[0.56, 0.40], [0.70, 0.60], [0.86, 0.80]]] },
    { c: '土', py: 'tǔ', mean: '地上一堆土，能种花', word: '泥土', art: 'soil', g: 1,
      strokes: [[[0.32, 0.30], [0.68, 0.30]], [[0.50, 0.30], [0.50, 0.78]], [[0.20, 0.78], [0.80, 0.78]]] },

    // ---------- 组 2：身体
    { c: '人', py: 'rén', mean: '一个站着的你和我', word: '大人', art: 'person', g: 2,
      strokes: [[[0.50, 0.18], [0.36, 0.50], [0.20, 0.84]], [[0.52, 0.22], [0.68, 0.52], [0.84, 0.84]]] },
    { c: '口', py: 'kǒu', mean: '嘴巴，用来吃饭说话', word: '开口', art: 'mouth', g: 2,
      strokes: [[[0.30, 0.28], [0.30, 0.74]], [[0.30, 0.28], [0.70, 0.28], [0.70, 0.74]],
        [[0.30, 0.74], [0.70, 0.74]]] },
    { c: '目', py: 'mù', mean: '眼睛，用来看东西', word: '目光', art: 'eye', g: 2,
      strokes: [[[0.30, 0.16], [0.30, 0.84]], [[0.30, 0.16], [0.70, 0.16], [0.70, 0.84]],
        [[0.30, 0.39], [0.70, 0.39]], [[0.30, 0.62], [0.70, 0.62]], [[0.30, 0.84], [0.70, 0.84]]] },
    { c: '手', py: 'shǒu', mean: '小手，用来画画拿东西', word: '小手', art: 'hand', g: 2,
      strokes: [[[0.44, 0.16], [0.36, 0.26]], [[0.30, 0.32], [0.70, 0.32]],
        [[0.20, 0.50], [0.80, 0.50]], [[0.50, 0.20], [0.50, 0.80], [0.57, 0.86]]] },
    { c: '心', py: 'xīn', mean: '心里暖暖的，爱你的心', word: '开心', art: 'heart', g: 2,
      strokes: [[[0.24, 0.40], [0.32, 0.50]],
        [[0.30, 0.50], [0.42, 0.64], [0.58, 0.72], [0.72, 0.68], [0.78, 0.58]],
        [[0.50, 0.40], [0.55, 0.50]], [[0.68, 0.36], [0.74, 0.46]]] },
    { c: '大', py: 'dà', mean: '张开手，好大呀', word: '长大', art: 'big', g: 2,
      strokes: [[[0.18, 0.36], [0.82, 0.36]], [[0.52, 0.16], [0.40, 0.48], [0.22, 0.84]],
        [[0.50, 0.36], [0.68, 0.58], [0.88, 0.82]]] },

    // ---------- 组 3：动植物
    { c: '木', py: 'mù', mean: '一棵大树，就是木', word: '大树', art: 'tree', g: 3,
      strokes: [[[0.18, 0.34], [0.82, 0.34]], [[0.50, 0.16], [0.50, 0.86]],
        [[0.50, 0.40], [0.32, 0.64], [0.20, 0.82]], [[0.50, 0.40], [0.68, 0.64], [0.82, 0.82]]] },
    { c: '牛', py: 'niú', mean: '哞哞叫的牛', word: '小牛', art: 'cow', g: 3,
      strokes: [[[0.46, 0.16], [0.38, 0.26]], [[0.32, 0.32], [0.68, 0.32]],
        [[0.18, 0.50], [0.82, 0.50]], [[0.50, 0.16], [0.50, 0.88]]] },
    { c: '马', py: 'mǎ', mean: '跑得很快的马', word: '小马', art: 'horse', g: 3,
      strokes: [[[0.28, 0.22], [0.68, 0.22], [0.68, 0.52]],
        [[0.28, 0.22], [0.28, 0.52], [0.66, 0.52], [0.66, 0.74], [0.58, 0.78]],
        [[0.12, 0.70], [0.88, 0.70]]] },
    { c: '鸟', py: 'niǎo', mean: '会飞的小鸟', word: '小鸟', art: 'bird', g: 3,
      strokes: [[[0.48, 0.10], [0.42, 0.20]],
        [[0.32, 0.20], [0.64, 0.20], [0.64, 0.48], [0.58, 0.54]],
        [[0.42, 0.30], [0.48, 0.37]],
        [[0.32, 0.20], [0.32, 0.52], [0.62, 0.52], [0.62, 0.72], [0.54, 0.78]],
        [[0.14, 0.68], [0.86, 0.68]]] },
    { c: '羊', py: 'yáng', mean: '咩咩叫的羊', word: '小羊', art: 'sheep', g: 3,
      strokes: [[[0.36, 0.14], [0.42, 0.22]], [[0.64, 0.14], [0.58, 0.22]],
        [[0.30, 0.30], [0.70, 0.30]], [[0.24, 0.46], [0.76, 0.46]],
        [[0.16, 0.66], [0.84, 0.66]], [[0.50, 0.30], [0.50, 0.88]]] },
    { c: '虫', py: 'chóng', mean: '爬呀爬的小虫', word: '小虫', art: 'worm', g: 3,
      strokes: [[[0.32, 0.16], [0.32, 0.46]], [[0.32, 0.16], [0.68, 0.16], [0.68, 0.46]],
        [[0.32, 0.46], [0.68, 0.46]], [[0.50, 0.16], [0.50, 0.84]],
        [[0.26, 0.78], [0.44, 0.62]], [[0.58, 0.64], [0.66, 0.74]]] },
  ];
  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const L = {};

    // 四个组胶囊
    const gW = 118, gGap = 8, gN = GROUPS.length;
    const gTotal = gN * gW + (gN - 1) * gGap;
    L.groups = [];
    for (let i = 0; i < gN; i++) {
      const x = (WIDTH - gTotal) / 2 + i * (gW + gGap);
      L.groups.push({ x: x, y: 92, w: gW, h: 48, cx: x + gW / 2, cy: 92 + 24, hit: gW / 2 });
    }

    // 当前组的 6 个字卡 + 一个「全部重来」
    const cW = 70, cH = 48, cGap = 6, cN = 6, rW = 36;
    const cTotal = cN * cW + (cN - 1) * cGap + cGap + rW;
    const cx0 = (WIDTH - cTotal) / 2;
    L.cards = [];
    for (let i = 0; i < cN; i++) {
      const x = cx0 + i * (cW + cGap);
      L.cards.push({ x: x, y: 148, w: cW, h: cH, cx: x + cW / 2, cy: 148 + cH / 2 });
    }
    L.reset = { x: cx0 + cN * (cW + cGap), y: 154, w: rW, h: rW, cx: cx0 + cN * (cW + cGap) + rW / 2, cy: 172 };

    // 图画卡片
    L.art = { x: 120, y: 204, w: 300, h: 190 };

    // 拼音 / 家长提示这一行
    L.subY = 420;

    // 米字格
    L.box = { x: (WIDTH - BOX) / 2, y: 438, w: BOX, h: BOX };

    // 一句话意思
    L.meanY = 862;

    // 底部两个按钮
    const bW = 210, bGap = 16;
    const bX = (WIDTH - (bW * 2 + bGap)) / 2;
    L.btnDemo = { x: bX, y: 884, w: bW, h: 52, cx: bX + bW / 2, cy: 910 };
    L.btnSpeak = { x: bX + bW + bGap, y: 884, w: bW, h: 52, cx: bX + bW + bGap + bW / 2, cy: 910 };

    // 「到纸上再写一遍」的小卡片
    L.card = { x: 56, y: 286, w: 428, h: 376 };
    L.cardBtn = { x: (WIDTH - 280) / 2, y: 556, w: 280, h: 66, cx: WIDTH / 2, cy: 589 };

    return L;
  }

  // ---------------------------------------------------------------- 几何小工具
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function inCircle(c, x, y) { const dx = x - c.cx, dy = y - c.cy; return dx * dx + dy * dy <= c.hit * c.hit; }
  function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

  // Catmull-Rom：把稀疏控制点变成顺滑曲线（首尾各重复一次，保证端点也走曲线）
  function catmullRom(pts, seg) {
    if (!pts || pts.length < 2) return (pts || []).slice();
    if (pts.length === 2) return [{ x: pts[0].x, y: pts[0].y }, { x: pts[1].x, y: pts[1].y }];
    const ext = [pts[0]].concat(pts, [pts[pts.length - 1]]);
    const out = [];
    for (let i = 1; i < ext.length - 2; i++) {
      const p0 = ext[i - 1], p1 = ext[i], p2 = ext[i + 1], p3 = ext[i + 2];
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return out;
  }

  // 按 step 像素把折线重采样成一串等距点（渲染和判定共用这一份）
  function resamplePolyline(pts, step) {
    if (!pts || pts.length < 2) return (pts || []).slice();
    const out = [{ x: pts[0].x, y: pts[0].y }];
    let prev = pts[0], acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let a = prev, b = pts[i];
      let seg = dist(a.x, a.y, b.x, b.y);
      while (acc + seg >= step && seg > 1e-9) {
        const u = (step - acc) / seg;
        const np = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
        out.push(np);
        a = np;
        seg = dist(a.x, a.y, b.x, b.y);
        acc = 0;
      }
      acc += seg;
      prev = pts[i];
    }
    const last = pts[pts.length - 1], lp = out[out.length - 1];
    if (dist(last.x, last.y, lp.x, lp.y) > 0.5) out.push({ x: last.x, y: last.y });
    return out;
  }

  function polyLength(pts) {
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    return n;
  }

  // 把 0..1 的控制点换算到画布坐标，再平滑 + 重采样成密集折线
  function buildDense(norm, box) {
    if (!norm || norm.length < 2) return [];
    const abs = norm.map(function (p) { return { x: box.x + p[0] * box.w, y: box.y + p[1] * box.h }; });
    return resamplePolyline(catmullRom(abs, 14), DAB_STEP);
  }

  // 点到折线的最近投影：返回横向距离 d 和沿线进度 t（0..1）
  function projectOnPolyline(pts, x, y) {
    if (!pts || pts.length < 2) return { d: Infinity, t: 0 };
    let total = 0;
    const lens = [];
    for (let i = 1; i < pts.length; i++) {
      const l = dist(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      lens.push(l); total += l;
    }
    if (total <= 1e-9) return { d: dist(x, y, pts[0].x, pts[0].y), t: 0 };
    let best = { d: Infinity, t: 0 }, cum = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      let u = l2 <= 1e-12 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / l2;
      u = u < 0 ? 0 : (u > 1 ? 1 : u);
      const qx = a.x + dx * u, qy = a.y + dy * u;
      const d = dist(x, y, qx, qy);
      if (d < best.d) best = { d: d, t: (cum + u * lens[i - 1]) / total };
      cum += lens[i - 1];
    }
    return best;
  }

  // 判定一次描红：pts 是孩子的手指采样点，stroke 是这一笔的密集折线，box 是米字格
  function judgeStroke(pts, stroke, box) {
    if (!pts || pts.length < MIN_SAMPLES || !stroke || stroke.length < 2) return false;
    const tolLat = TOL_LATERAL * box.w + STROKE_W / 2;
    const first = pts[0];
    const start = stroke[0];
    if (dist(first.x, first.y, start.x, start.y) > TOL_START * box.w) return false;
    // 短笔画（点、提之类）整条也没多长，起笔的进度容差放宽一点，免得孩子在笔画中段按下就判错
    const nearT = polyLength(stroke) < 0.30 * box.w ? 0.60 : NEAR_T;
    if (projectOnPolyline(stroke, first.x, first.y).t > nearT) return false;
    let maxT = 0, back = 0, stick = 0;
    for (let i = 0; i < pts.length; i++) {
      const r = projectOnPolyline(stroke, pts[i].x, pts[i].y);
      if (r.t < maxT - TOL_BACK) back++;
      if (r.t > maxT) maxT = r.t;
      if (r.d <= tolLat) stick++;
    }
    if (back / pts.length > TOL_BACK_RATIO) return false;
    if (stick / pts.length < TOL_STICK) return false;
    if (maxT < TOL_COVER) return false;
    return true;
  }

  // ---------------------------------------------------------------- 盖章绘制
  // 折线笔迹 = 沿路径盖一串圆点，天然圆头圆角，跨设备一致
  function dabPath(g, pts, color, width, maxCount) {
    if (!pts || !pts.length) return;
    g.fillStyle(color, 1);
    const r = width / 2;
    const step = maxCount && pts.length > maxCount ? Math.ceil(pts.length / maxCount) : 1;
    for (let i = 0; i < pts.length; i += step) g.fillCircle(pts[i].x, pts[i].y, r);
  }

  function dashedLine(g, x1, y1, x2, y2, dash) {
    const total = dist(x1, y1, x2, y2);
    if (total <= 1e-6) return;
    const n = Math.max(1, Math.floor(total / dash));
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = Math.min(1, u0 + 0.55 / n);
      g.lineBetween(x1 + (x2 - x1) * u0, y1 + (y2 - y1) * u0, x1 + (x2 - x1) * u1, y1 + (y2 - y1) * u1);
    }
  }

  // 米字格
  function drawMiGrid(g, box, edge, line) {
    g.fillStyle(C.card, 1).fillRoundedRect(box.x, box.y, box.w, box.h, 26);
    g.lineStyle(3, edge, 1).strokeRoundedRect(box.x, box.y, box.w, box.h, 26);
    g.lineStyle(2, line, 1);
    dashedLine(g, box.x + 6, box.y + box.h / 2, box.x + box.w - 6, box.y + box.h / 2, 14);
    dashedLine(g, box.x + box.w / 2, box.y + 6, box.x + box.w / 2, box.y + box.h - 6, 14);
    g.lineStyle(2, line, 0.75);
    dashedLine(g, box.x + 8, box.y + 8, box.x + box.w - 8, box.y + box.h - 8, 16);
    dashedLine(g, box.x + box.w - 8, box.y + 8, box.x + 8, box.y + box.h - 8, 16);
  }

  // ---------------------------------------------------------------- 插图
  const ART = {
    card: 0xFFFFFF, line: 0xEFE3D2, halo: 0xFFF6E4, ink: 0x5C5A55,
    sun: 0xFFC63C, sunDeep: 0xFF9F1C,
    moon: 0xFFE08A, moonDeep: 0xF6C453,
    mount: 0x8BBF7A, mountDeep: 0x6FA25F, snow: 0xFFFFFF,
    water: 0x69C6E8, waterDeep: 0x3FA9D6,
    fire: 0xFF8A3D, fireDeep: 0xE04E2A, fireIn: 0xFFD93D,
    soil: 0xC59A6B, soilDeep: 0xA87C4F, sprout: 0x7FB069,
    skin: 0xFFD9B3, shirt: 0xE4572E, pants: 0x3D5A80, hair: 0x5C4A3A,
    mouth: 0xE0605F, tongue: 0xF08C8C, tooth: 0xFFFFFF,
    eyeWhite: 0xFFFFFF, eyeIris: 0x5C4A3A, eyeBrow: 0x8A6A4F,
    hand: 0xFFD9B3, handLine: 0xE8B48C,
    heart: 0xE4572E,
    treeTrunk: 0x9A6B4A, leaf: 0x6FA25F, leafLight: 0x8BBF7A,
    cow: 0xFFFFFF, cowSpot: 0x4A4640, cowMuzzle: 0xFFC2C2,
    horse: 0xC98A4B, horseMane: 0x8A5A2B, horseMuzzle: 0xE8C39A,
    birdBody: 0x6EC1E4, birdWing: 0x3FA9D6, birdBeak: 0xFFA23C,
    sheep: 0xFFFDF6, sheepFace: 0xF0D8C0,
    worm: 0x8FD14F, wormDeep: 0x6FB33A,
    road: 0xB9B4AC, roadLine: 0xFFFDF6, car: 0xE4572E, cloud: 0xFFFFFF,
    box: 0xD9A05B, boxDeep: 0xB87F3C, ball: 0xE4572E,
  };

  function artCircle(g, x, y, r, c) { g.fillStyle(c, 1); g.fillCircle(x, y, r); }
  function artEllipse(g, x, y, rx, ry, c) { g.fillStyle(c, 1); g.fillEllipse(x, y, rx * 2, ry * 2); }
  function artRounded(g, x, y, w, h, c, r) { g.fillStyle(c, 1); g.fillRoundedRect(x, y, w, h, r === undefined ? Math.min(w, h) * 0.22 : r); }
  function artTri(g, a, b, c, col) { g.fillStyle(col, 1); g.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1]); }
  function artPoly(g, pts, col) {
    g.fillStyle(col, 1);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }
  function artStroke(g, pts, w, col) {
    g.lineStyle(w, col, 1);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
  }
  function artArc(g, x, y, r, a0, a1, w, col) {
    g.lineStyle(w, col, 1);
    g.beginPath();
    g.arc(x, y, r, a0, a1, false);
    g.strokePath();
  }

  // 一只小鸭子（一二三用）
  function drawDuck(g, cx, cy, r) {
    artEllipse(g, cx, cy, r * 1.05, r * 0.78, 0xFFE9A8);
    artCircle(g, cx + r * 0.62, cy - r * 0.86, r * 0.58, 0xFFF3C4);
    artTri(g, [cx + r * 1.10, cy - r * 0.98], [cx + r * 1.86, cy - r * 0.84], [cx + r * 1.10, cy - r * 0.66], 0xFF9F1C);
    artCircle(g, cx + r * 0.78, cy - r * 0.98, r * 0.10, 0x4A4640);
    artEllipse(g, cx - r * 0.28, cy - r * 0.02, r * 0.52, r * 0.40, 0xFFD98A);
    g.lineStyle(Math.max(2, r * 0.09), 0xFF9F1C, 1);
    g.lineBetween(cx - r * 0.15, cy + r * 0.74, cx - r * 0.15, cy + r * 1.06);
    g.lineBetween(cx + r * 0.30, cy + r * 0.74, cx + r * 0.30, cy + r * 1.06);
  }

  // 一个张开手的小人（人 / 大 用）
  function drawKid(g, cx, cy, r, spread) {
    const ax = spread ? r * 1.05 : r * 0.62;
    const ay = spread ? -r * 0.30 : r * 0.26;
    artRounded(g, cx - r * 0.34, cy - r * 0.30, r * 0.68, r * 0.86, ART.shirt, r * 0.22);
    g.lineStyle(r * 0.20, ART.skin, 1);
    g.lineBetween(cx - r * 0.26, cy - r * 0.16, cx - ax, cy + ay);
    g.lineBetween(cx + r * 0.26, cy - r * 0.16, cx + ax, cy + ay);
    g.lineStyle(r * 0.22, ART.pants, 1);
    g.lineBetween(cx - r * 0.16, cy + r * 0.54, cx - r * 0.20, cy + r * 1.08);
    g.lineBetween(cx + r * 0.16, cy + r * 0.54, cx + r * 0.20, cy + r * 1.08);
    // 头 + 只在头顶的一撮头发 + 五官（先头后发再五官，别把脸盖住）
    artCircle(g, cx, cy - r * 0.72, r * 0.44, ART.skin);
    artCircle(g, cx, cy - r * 1.04, r * 0.27, ART.hair);
    artCircle(g, cx - r * 0.15, cy - r * 0.68, r * 0.055, 0x3A3A3A);
    artCircle(g, cx + r * 0.15, cy - r * 0.68, r * 0.055, 0x3A3A3A);
    artArc(g, cx, cy - r * 0.54, r * 0.15, 0.25, Math.PI - 0.25, Math.max(2, r * 0.05), 0x3A3A3A);
  }

  function drawArt(g, key, R) {
    const X = function (u) { return R.x + u * R.w; };
    const Y = function (v) { return R.y + v * R.h; };
    const S = function (k) { return k * Math.min(R.w, R.h); };
    artRounded(g, R.x, R.y, R.w, R.h, ART.card, 24);
    g.lineStyle(3, ART.line, 1).strokeRoundedRect(R.x, R.y, R.w, R.h, 24);
    artCircle(g, X(0.5), Y(0.52), S(0.44), ART.halo);

    switch (key) {
      case 'one': drawDuck(g, X(0.48), Y(0.56), S(0.30)); break;
      case 'two':
        drawDuck(g, X(0.32), Y(0.60), S(0.24));
        drawDuck(g, X(0.66), Y(0.48), S(0.26));
        break;
      case 'three':
        drawDuck(g, X(0.24), Y(0.66), S(0.19));
        drawDuck(g, X(0.50), Y(0.54), S(0.21));
        drawDuck(g, X(0.76), Y(0.42), S(0.23));
        break;
      case 'ten': {
        // 十字路口
        artRounded(g, X(0.06), Y(0.30), X(0.88) - X(0.06), S(0.40), ART.road, 8);
        artRounded(g, X(0.36), Y(0.06), S(0.40), Y(0.94) - Y(0.06), ART.road, 8);
        g.lineStyle(3, ART.roadLine, 1);
        for (let i = 0; i < 4; i++) {
          const x0 = X(0.10 + i * 0.21);
          g.lineBetween(x0, Y(0.50), x0 + S(0.13), Y(0.50));
        }
        g.lineBetween(X(0.50), Y(0.06) + S(0.10), X(0.50), Y(0.06) + S(0.24));
        g.lineBetween(X(0.50), Y(0.70), X(0.50), Y(0.84));
        artRounded(g, X(0.14), Y(0.34), S(0.30), S(0.18), ART.car, 6);
        artRounded(g, X(0.62), Y(0.62), S(0.30), S(0.18), 0x6EC1E4, 6);
        break;
      }
      case 'up': {
        artRounded(g, X(0.16), Y(0.52), X(0.84) - X(0.16), Y(0.86) - Y(0.52), ART.box, 12);
        g.lineStyle(3, ART.boxDeep, 1).strokeRoundedRect(X(0.16), Y(0.52), X(0.84) - X(0.16), Y(0.86) - Y(0.52), 12);
        artCircle(g, X(0.50), Y(0.24), S(0.14), ART.ball);
        artCircle(g, X(0.44), Y(0.19), S(0.045), 0xFFD9C0);
        artStroke(g, [[X(0.50), Y(0.40)], [X(0.50), Y(0.52)]], 5, ART.ink);
        break;
      }
      case 'down': {
        artRounded(g, X(0.16), Y(0.14), X(0.84) - X(0.16), Y(0.48) - Y(0.14), ART.box, 12);
        g.lineStyle(3, ART.boxDeep, 1).strokeRoundedRect(X(0.16), Y(0.14), X(0.84) - X(0.16), Y(0.48) - Y(0.14), 12);
        artCircle(g, X(0.50), Y(0.76), S(0.14), ART.ball);
        artCircle(g, X(0.44), Y(0.71), S(0.045), 0xFFD9C0);
        artStroke(g, [[X(0.50), Y(0.48)], [X(0.50), Y(0.62)]], 5, ART.ink);
        break;
      }
      case 'sun': {
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          g.lineStyle(S(0.055), ART.sunDeep, 1);
          g.lineBetween(X(0.5) + Math.cos(a) * S(0.46), Y(0.52) + Math.sin(a) * S(0.46),
            X(0.5) + Math.cos(a) * S(0.62), Y(0.52) + Math.sin(a) * S(0.62));
        }
        artCircle(g, X(0.5), Y(0.52), S(0.34), ART.sun);
        artCircle(g, X(0.5), Y(0.52), S(0.26), 0xFFD93D);
        artCircle(g, X(0.40), Y(0.44), S(0.05), 0x3A3A3A);
        artCircle(g, X(0.60), Y(0.44), S(0.05), 0x3A3A3A);
        artArc(g, X(0.5), Y(0.52), S(0.15), 0.30, Math.PI - 0.30, S(0.045), 0x3A3A3A);
        break;
      }
      case 'moon': {
        artCircle(g, X(0.52), Y(0.50), S(0.36), ART.moon);
        artCircle(g, X(0.66), Y(0.42), S(0.33), ART.halo);
        artCircle(g, X(0.52), Y(0.50), S(0.30), ART.moonDeep);
        artCircle(g, X(0.68), Y(0.40), S(0.28), ART.halo);
        for (let i = 0; i < 3; i++) {
          const sx = X(0.22 + i * 0.08), sy = Y(0.22 + (i % 2) * 0.10);
          artPoly(g, [[sx, sy - S(0.06)], [sx + S(0.02), sy - S(0.02)], [sx + S(0.07), sy], [sx + S(0.02), sy + S(0.02)],
            [sx, sy + S(0.06)], [sx - S(0.02), sy + S(0.02)], [sx - S(0.07), sy], [sx - S(0.02), sy - S(0.02)]], 0xFFD93D);
        }
        break;
      }
      case 'mountain': {
        artCircle(g, X(0.80), Y(0.22), S(0.09), ART.sun);
        artTri(g, [X(0.10), Y(0.86)], [X(0.42), Y(0.26)], [X(0.74), Y(0.86)], ART.mount);
        artTri(g, [X(0.46), Y(0.86)], [X(0.72), Y(0.40)], [X(0.98), Y(0.86)], ART.mountDeep);
        artTri(g, [X(0.33), Y(0.46)], [X(0.42), Y(0.26)], [X(0.51), Y(0.46)], ART.snow);
        artTri(g, [X(0.64), Y(0.58)], [X(0.72), Y(0.40)], [X(0.80), Y(0.58)], ART.snow);
        artEllipse(g, X(0.4), Y(0.90), X(0.5) - X(0.06), S(0.05), ART.leaf);
        break;
      }
      case 'water': {
        for (let r = 0; r < 3; r++) {
          const yy = Y(0.34 + r * 0.18);
          artStroke(g, [[X(0.10), yy], [X(0.24), yy - S(0.10)], [X(0.38), yy], [X(0.52), yy - S(0.10)],
            [X(0.66), yy], [X(0.80), yy - S(0.10)], [X(0.92), yy]], S(0.055),
            r === 1 ? ART.water : ART.waterDeep);
        }
        artEllipse(g, X(0.30), Y(0.78), S(0.10), S(0.13), 0xBFE8F7);
        artEllipse(g, X(0.66), Y(0.80), S(0.07), S(0.09), 0xBFE8F7);
        break;
      }
      case 'fire': {
        artPoly(g, [[X(0.50), Y(0.14)], [X(0.66), Y(0.42)], [X(0.74), Y(0.62)], [X(0.68), Y(0.82)],
          [X(0.50), Y(0.90)], [X(0.32), Y(0.82)], [X(0.26), Y(0.62)], [X(0.36), Y(0.44)]], ART.fire);
        artPoly(g, [[X(0.50), Y(0.36)], [X(0.60), Y(0.58)], [X(0.56), Y(0.80)], [X(0.44), Y(0.80)],
          [X(0.40), Y(0.58)]], ART.fireIn);
        artEllipse(g, X(0.50), Y(0.74), S(0.10), S(0.05), ART.fireDeep);
        break;
      }
      case 'soil': {
        artPoly(g, [[X(0.08), Y(0.84)], [X(0.22), Y(0.56)], [X(0.46), Y(0.44)], [X(0.72), Y(0.52)],
          [X(0.92), Y(0.84)]], ART.soil);
        artPoly(g, [[X(0.08), Y(0.84)], [X(0.30), Y(0.66)], [X(0.52), Y(0.86)]], ART.soilDeep);
        artStroke(g, [[X(0.62), Y(0.44)], [X(0.62), Y(0.22)]], S(0.045), ART.sprout);
        artEllipse(g, X(0.52), Y(0.20), S(0.09), S(0.06), ART.sprout);
        artEllipse(g, X(0.72), Y(0.26), S(0.09), S(0.06), ART.leaf);
        break;
      }
      case 'person': drawKid(g, X(0.50), Y(0.56), S(0.40), false); break;
      case 'big': drawKid(g, X(0.50), Y(0.54), S(0.36), true); break;
      case 'mouth': {
        // 一张张开的嘴：外唇 + 口腔 + 上排牙 + 舌头
        artEllipse(g, X(0.50), Y(0.50), S(0.44), S(0.31), ART.mouth);
        artEllipse(g, X(0.50), Y(0.53), S(0.34), S(0.22), 0x9E3B3A);
        for (let i = 0; i < 5; i++) {
          artRounded(g, X(0.32 + i * 0.075), Y(0.33), S(0.065), S(0.09), ART.tooth, 3);
        }
        artEllipse(g, X(0.50), Y(0.66), S(0.20), S(0.10), ART.tongue);
        break;
      }
      case 'eye': {
        artPoly(g, [[X(0.08), Y(0.52)], [X(0.30), Y(0.28)], [X(0.72), Y(0.28)], [X(0.92), Y(0.52)],
          [X(0.72), Y(0.76)], [X(0.30), Y(0.76)]], ART.eyeWhite);
        artCircle(g, X(0.50), Y(0.52), S(0.20), ART.eyeIris);
        artCircle(g, X(0.50), Y(0.52), S(0.10), 0x2B2622);
        artCircle(g, X(0.44), Y(0.45), S(0.055), 0xFFFFFF);
        artStroke(g, [[X(0.14), Y(0.20)], [X(0.36), Y(0.10)], [X(0.62), Y(0.10)], [X(0.86), Y(0.20)]], S(0.05), ART.eyeBrow);
        break;
      }
      case 'hand': {
        // 一只小手掌：四根手指 + 大拇指 + 掌心
        const fw = S(0.15);
        artRounded(g, X(0.27), Y(0.24), fw, S(0.32), ART.hand, fw / 2);
        artRounded(g, X(0.42), Y(0.15), fw, S(0.41), ART.hand, fw / 2);
        artRounded(g, X(0.57), Y(0.19), fw, S(0.37), ART.hand, fw / 2);
        artRounded(g, X(0.71), Y(0.29), fw, S(0.29), ART.hand, fw / 2);
        artRounded(g, X(0.08), Y(0.50), S(0.26), S(0.15), ART.hand, S(0.075));
        artRounded(g, X(0.24), Y(0.46), X(0.82) - X(0.24), S(0.42), ART.hand, S(0.17));
        g.lineStyle(S(0.03), ART.handLine, 1);
        g.lineBetween(X(0.37), Y(0.48), X(0.37), Y(0.32));
        g.lineBetween(X(0.52), Y(0.48), X(0.52), Y(0.26));
        g.lineBetween(X(0.67), Y(0.48), X(0.67), Y(0.30));
        artArc(g, X(0.53), Y(0.62), S(0.16), 0.4, Math.PI - 0.4, S(0.035), ART.handLine);
        break;
      }
      case 'heart': {
        artCircle(g, X(0.34), Y(0.38), S(0.20), ART.heart);
        artCircle(g, X(0.66), Y(0.38), S(0.20), ART.heart);
        artTri(g, [X(0.14), Y(0.44)], [X(0.86), Y(0.44)], [X(0.50), Y(0.88)], ART.heart);
        artCircle(g, X(0.36), Y(0.34), S(0.055), 0xFFD9C0);
        break;
      }
      case 'tree': {
        artRounded(g, X(0.44), Y(0.56), X(0.56) - X(0.44), Y(0.90) - Y(0.56), ART.treeTrunk, 6);
        artCircle(g, X(0.50), Y(0.34), S(0.26), ART.leaf);
        artCircle(g, X(0.28), Y(0.48), S(0.20), ART.leafLight);
        artCircle(g, X(0.72), Y(0.48), S(0.20), ART.leafLight);
        artCircle(g, X(0.38), Y(0.30), S(0.09), ART.leafLight);
        artCircle(g, X(0.30), Y(0.60), S(0.05), 0xE4572E);
        artCircle(g, X(0.70), Y(0.58), S(0.05), 0xE4572E);
        break;
      }
      case 'cow': {
        artRounded(g, X(0.22), Y(0.30), X(0.78) - X(0.22), Y(0.84) - Y(0.30), ART.cow, 26);
        artEllipse(g, X(0.36), Y(0.52), S(0.11), S(0.09), ART.cowSpot);
        artEllipse(g, X(0.70), Y(0.70), S(0.09), S(0.07), ART.cowSpot);
        artEllipse(g, X(0.50), Y(0.78), S(0.20), S(0.13), ART.cowMuzzle);
        artCircle(g, X(0.42), Y(0.78), S(0.028), 0x8A6A4F);
        artCircle(g, X(0.58), Y(0.78), S(0.028), 0x8A6A4F);
        artCircle(g, X(0.38), Y(0.50), S(0.055), 0x2B2622);
        artCircle(g, X(0.62), Y(0.50), S(0.055), 0x2B2622);
        artStroke(g, [[X(0.24), Y(0.32)], [X(0.18), Y(0.16)], [X(0.30), Y(0.20)]], S(0.05), 0xE8D6A8);
        artStroke(g, [[X(0.76), Y(0.32)], [X(0.82), Y(0.16)], [X(0.70), Y(0.20)]], S(0.05), 0xE8D6A8);
        artEllipse(g, X(0.22), Y(0.42), S(0.08), S(0.05), ART.cowMuzzle);
        artEllipse(g, X(0.78), Y(0.42), S(0.08), S(0.05), ART.cowMuzzle);
        break;
      }
      case 'horse': {
        // 马脸：两只尖耳朵 + 额发 + 长鼻子
        artTri(g, [X(0.30), Y(0.36)], [X(0.27), Y(0.08)], [X(0.45), Y(0.28)], ART.horse);
        artTri(g, [X(0.70), Y(0.36)], [X(0.73), Y(0.08)], [X(0.55), Y(0.28)], ART.horse);
        artTri(g, [X(0.32), Y(0.34)], [X(0.30), Y(0.16)], [X(0.42), Y(0.28)], ART.horseMuzzle);
        artTri(g, [X(0.68), Y(0.34)], [X(0.70), Y(0.16)], [X(0.58), Y(0.28)], ART.horseMuzzle);
        artRounded(g, X(0.30), Y(0.24), X(0.70) - X(0.30), Y(0.70) - Y(0.24), ART.horse, S(0.20));
        artRounded(g, X(0.44), Y(0.18), X(0.56) - X(0.44), Y(0.34) - Y(0.18), ART.horseMane, S(0.06));
        artEllipse(g, X(0.50), Y(0.74), S(0.17), S(0.14), ART.horseMuzzle);
        artCircle(g, X(0.41), Y(0.48), S(0.055), 0x2B2622);
        artCircle(g, X(0.59), Y(0.48), S(0.055), 0x2B2622);
        artCircle(g, X(0.43), Y(0.72), S(0.028), 0x8A5A2B);
        artCircle(g, X(0.57), Y(0.72), S(0.028), 0x8A5A2B);
        artArc(g, X(0.50), Y(0.80), S(0.07), 0.2, Math.PI - 0.2, S(0.03), 0x8A5A2B);
        break;
      }
      case 'bird': {
        artEllipse(g, X(0.48), Y(0.58), S(0.28), S(0.22), ART.birdBody);
        artCircle(g, X(0.70), Y(0.34), S(0.17), ART.birdBody);
        artTri(g, [X(0.86), Y(0.32)], [X(1.00), Y(0.38)], [X(0.86), Y(0.44)], ART.birdBeak);
        artCircle(g, X(0.74), Y(0.30), S(0.04), 0x2B2622);
        artEllipse(g, X(0.40), Y(0.56), S(0.13), S(0.10), ART.birdWing);
        artTri(g, [X(0.24), Y(0.56)], [X(0.06), Y(0.48)], [X(0.24), Y(0.70)], ART.birdWing);
        g.lineStyle(S(0.035), ART.birdBeak, 1);
        g.lineBetween(X(0.34), Y(0.78), X(0.30), Y(0.90));
        g.lineBetween(X(0.54), Y(0.78), X(0.58), Y(0.90));
        artEllipse(g, X(0.62), Y(0.78), S(0.12), S(0.05), 0xF0C56B);
        break;
      }
      case 'sheep': {
        artEllipse(g, X(0.50), Y(0.60), S(0.28), S(0.20), ART.sheepFace);
        artCircle(g, X(0.30), Y(0.44), S(0.13), ART.sheep);
        artCircle(g, X(0.44), Y(0.36), S(0.15), ART.sheep);
        artCircle(g, X(0.60), Y(0.36), S(0.15), ART.sheep);
        artCircle(g, X(0.72), Y(0.46), S(0.13), ART.sheep);
        artCircle(g, X(0.50), Y(0.48), S(0.15), ART.sheep);
        artCircle(g, X(0.36), Y(0.56), S(0.05), 0x2B2622);
        artCircle(g, X(0.64), Y(0.56), S(0.05), 0x2B2622);
        artEllipse(g, X(0.50), Y(0.64), S(0.055), S(0.04), ART.handLine);
        artEllipse(g, X(0.24), Y(0.46), S(0.07), S(0.05), ART.sheepFace);
        artEllipse(g, X(0.76), Y(0.46), S(0.07), S(0.05), ART.sheepFace);
        break;
      }
      case 'worm': {
        const segs = [[0.16, 0.62], [0.28, 0.50], [0.42, 0.44], [0.56, 0.46], [0.68, 0.56], [0.78, 0.68]];
        for (let i = 0; i < segs.length; i++) {
          artCircle(g, X(segs[i][0]), Y(segs[i][1]), S(0.11 - i * 0.006), i % 2 ? ART.wormDeep : ART.worm);
        }
        artCircle(g, X(0.10), Y(0.70), S(0.10), ART.worm);
        artCircle(g, X(0.07), Y(0.66), S(0.022), 0x2B2622);
        artStroke(g, [[X(0.10), Y(0.62)], [X(0.10), Y(0.54)]], S(0.02), 0x2B2622);
        artStroke(g, [[X(0.13), Y(0.62)], [X(0.13), Y(0.54)]], S(0.02), 0x2B2622);
        break;
      }
      default: break;
    }
  }
  // ---------------------------------------------------------------- 音效
  // 只有几个很轻的合成音：描对一笔 / 描歪 / 揭晓 / 描完 / 翻页。没有背景音乐。
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
      } catch (e) { ctx = null; }
      return ctx;
    }

    function resume() {
      const c = ensure();
      if (c && c.state === 'suspended') { try { c.resume(); } catch (e) { /* ignore */ } }
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
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.08);
    }

    function slide(f0, f1, dur, vol, type) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.08);
    }

    function noise(dur, vol, f0, f1, q) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime;
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
      src.connect(filt); filt.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }

    return {
      resume: resume,
      // 描对一笔：木头小短音，音高随笔画序号一点点往上
      ink: function (i) {
        const f = 420 * Math.pow(2, (i || 0) / 12);
        tone(f, 0.10, 0.06, 0, 'triangle');
        noise(0.03, 0.02, 2200, 0, 1.4);
      },
      // 描歪了：很轻的低音，一点不吓人
      nudge: function () { tone(300, 0.18, 0.032, 0, 'sine'); tone(248, 0.20, 0.028, 0.10, 'sine'); },
      // 揭晓：上行三音
      reveal: function () {
        [0, 4, 7].forEach(function (s, i) { tone(523 * Math.pow(2, s / 12), 0.28, 0.05, i * 0.10, 'triangle'); });
      },
      // 描完一个字：温暖的四音和弦
      done: function () {
        [0, 4, 7, 11].forEach(function (s, i) { tone(392 * Math.pow(2, s / 12), 0.55, 0.05, i * 0.09, 'triangle'); });
      },
      // 翻页换字
      page: function () { noise(0.20, 0.045, 1400, 400, 0.9); tone(660, 0.10, 0.028, 0.02, 'sine'); },
      // 点一下小反馈
      tap: function () { tone(560, 0.08, 0.04, 0, 'sine'); },
      // 全部重来
      reset: function () { slide(700, 320, 0.25, 0.05, 'sine'); },
    };
  })();
  // ---------------------------------------------------------------- 进度存档
  function loadProgress() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        if (typeof v === 'number' && v >= 0 && v < CHARS.length && out.indexOf(v) < 0) out.push(v);
      }
      return out;
    } catch (e) { return []; }
  }

  function saveProgress(arr) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch (e) { /* 隐身模式之类，忽略即可 */ }
  }

  // ---------------------------------------------------------------- 场景
  const DEPTH = { bg: 0, art: 1, grid: 2, stroke: 3, trail: 4, fx: 12, ui: 20, card: 40 };

  class ShiziScene extends Phaser.Scene {
    constructor() {
      super('ShiziScene');
    }

    create() {
      this.CONST = CONST;
      this.CHARS = CHARS;
      this.GROUPS = GROUPS;
      this.L = computeLayout();

      this.gi = 0;
      this.ci = 0;
      this.phase = 'guess';
      this.strokeIdx = 0;
      this.done = loadProgress();
      this.path = null;
      this.demo = null;
      this.demoT = 0;
      this.revealT = 0;
      this.celebT = 0;
      this.elapsed = 0;
      this.stars = [];
      this.liveProps = [];
      this.activePointerId = null;

      // 发音能力检测：没有语音合成就老老实实把喇叭画灰，绝不报错
      this.ttsSupported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
      this.ttsOk = this.ttsSupported;
      this.zhVoice = null;
      this.refreshVoices();
      if (this.ttsSupported && window.speechSynthesis.addEventListener) {
        try {
          window.speechSynthesis.addEventListener('voiceschanged', () => {
            this.refreshVoices();
            this.paintButtons();
          });
        } catch (e) { /* ignore */ }
      }

      this.dense = [];
      this.buildAllDense();
      this.buildLayers();
      this.bindInput();
      Sound.resume();
      this.goTo(0, true);
    }

    // -------------------------------------------------- 笔画数据
    buildAllDense() {
      this.allDense = [];
      for (let i = 0; i < CHARS.length; i++) {
        const box = this.L.box;
        const arr = [];
        for (let k = 0; k < CHARS[i].strokes.length; k++) arr.push(buildDense(CHARS[i].strokes[k], box));
        this.allDense.push(arr);
      }
    }

    // -------------------------------------------------- 图层
    buildLayers() {
      const L = this.L;

      this.bgG = this.add.graphics().setDepth(DEPTH.bg);
      this.bgG.fillStyle(C.paper, 1).fillRect(0, 0, WIDTH, HEIGHT);
      this.bgG.fillStyle(C.band, 1).fillRect(0, 0, WIDTH, 84);
      this.bgG.lineStyle(2, C.chipLine, 1).lineBetween(0, 84, WIDTH, 84);

      this.artG = this.add.graphics().setDepth(DEPTH.art);

      this.gridG = this.add.graphics().setDepth(DEPTH.grid);
      drawMiGrid(this.gridG, L.box, C.gridEdge, C.grid);

      this.strokeG = this.add.graphics().setDepth(DEPTH.stroke);
      this.trailG = this.add.graphics().setDepth(DEPTH.trail);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.topG = this.add.graphics().setDepth(DEPTH.ui);
      this.btnG = this.add.graphics().setDepth(DEPTH.ui);
      this.cardG = this.add.graphics().setDepth(DEPTH.card);
      this.cardGlyphG = this.add.graphics().setDepth(DEPTH.card + 1);

      this.groupTexts = [];
      for (let i = 0; i < L.groups.length; i++) {
        const g = L.groups[i];
        this.groupTexts.push(this.add.text(g.cx, g.cy, GROUPS[i].label, {
          fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: C.textHex,
        }).setOrigin(0.5).setDepth(DEPTH.ui + 1));
      }

      this.charTexts = [];
      for (let i = 0; i < L.cards.length; i++) {
        const c = L.cards[i];
        this.charTexts.push(this.add.text(c.cx, c.cy, '', {
          fontFamily: FONT, fontSize: '30px', color: C.textHex,
        }).setOrigin(0.5).setDepth(DEPTH.ui + 1));
      }

      this.subText = this.add.text(WIDTH / 2, L.subY, '', {
        fontFamily: FONT, fontSize: '26px', color: C.subHex,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.hintText = this.add.text(WIDTH / 2, L.subY, '', {
        fontFamily: FONT, fontSize: '20px', color: C.softHex,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.meanText = this.add.text(WIDTH / 2, L.meanY, '', {
        fontFamily: FONT, fontSize: '20px', color: C.meanHex,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.btnDemoText = this.add.text(L.btnDemo.cx, L.btnDemo.cy, '看它怎么写', {
        fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.btnSpeakText = this.add.text(L.btnSpeak.cx, L.btnSpeak.cy, '念一遍', {
        fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      // 「到纸上再写一遍」的小卡片（默认藏起来）
      this.cardTitle = this.add.text(WIDTH / 2, L.card.y + 60, '太棒了！', {
        fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: C.markHex,
      }).setOrigin(0.5).setDepth(DEPTH.card + 2);
      this.cardBody = this.add.text(WIDTH / 2, L.card.y + 112, '拿笔在纸上再写一遍 →', {
        fontFamily: FONT, fontSize: '22px', color: C.textHex,
      }).setOrigin(0.5).setDepth(DEPTH.card + 2);
      this.cardSmall = this.add.text(WIDTH / 2, L.card.y + 250, '纸上写完，点下面', {
        fontFamily: FONT, fontSize: '18px', color: C.softHex,
      }).setOrigin(0.5).setDepth(DEPTH.card + 2);
      this.cardBtnText = this.add.text(L.cardBtn.cx, L.cardBtn.cy, '写好啦', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5).setDepth(DEPTH.card + 2);
      this.hideCard();
    }

    // -------------------------------------------------- 顶部选字条
    paintTop() {
      const g = this.topG, L = this.L;
      g.clear();
      const live = this.canUseTop();
      const a = live ? 1 : 0.4;

      for (let i = 0; i < L.groups.length; i++) {
        const c = L.groups[i];
        const on = i === this.gi;
        g.fillStyle(on ? C.chipOn : C.chip, live ? 1 : 0.7);
        g.fillRoundedRect(c.x, c.y, c.w, c.h, 24);
        g.lineStyle(2, on ? C.mark : C.chipLine, live ? 1 : 0.5);
        g.strokeRoundedRect(c.x, c.y, c.w, c.h, 24);
        this.groupTexts[i].setAlpha(a);
      }

      for (let i = 0; i < L.cards.length; i++) {
        const c = L.cards[i];
        const idx = this.gi * 6 + i;
        const on = idx === this.ci;
        g.fillStyle(on ? C.cardOn : C.card, live ? 1 : 0.7);
        g.fillRoundedRect(c.x, c.y, c.w, c.h, 12);
        g.lineStyle(2, on ? C.mark : C.chipLine, live ? 1 : 0.5);
        g.strokeRoundedRect(c.x, c.y, c.w, c.h, 12);
        this.charTexts[i].setAlpha(a);
        // 学过的右上角打勾
        if (this.done.indexOf(idx) >= 0) {
          g.lineStyle(4, C.mark, 0.95);
          g.lineBetween(c.x + c.w - 22, c.y + 12, c.x + c.w - 16, c.y + 19);
          g.lineBetween(c.x + c.w - 16, c.y + 19, c.x + c.w - 6, c.y + 5);
        }
      }

      const r = L.reset;
      g.fillStyle(C.btnAlt, live ? 1 : 0.6).fillRoundedRect(r.x, r.y, r.w, r.h, 12);
      g.lineStyle(2, C.chipLine, live ? 1 : 0.5).strokeRoundedRect(r.x, r.y, r.w, r.h, 12);
      g.lineStyle(3, C.btnAltText, live ? 1 : 0.45);
      g.beginPath();
      g.arc(r.cx, r.cy + 2, 10, Math.PI * 0.75, Math.PI * 2.15, false);
      g.strokePath();
      g.fillStyle(C.btnAltText, live ? 1 : 0.45);
      g.fillTriangle(r.cx - 12, r.cy - 6, r.cx - 3, r.cy - 9, r.cx - 8, r.cy + 2);
    }

    paintCharTexts() {
      for (let i = 0; i < this.charTexts.length; i++) {
        this.charTexts[i].setText(CHARS[this.gi * 6 + i] ? CHARS[this.gi * 6 + i].c : '');
      }
    }

    canUseTop() {
      return this.phase === 'guess' || this.phase === 'reveal';
    }

    // -------------------------------------------------- 底部按钮
    paintButtons() {
      const g = this.btnG, L = this.L;
      g.clear();
      const trace = this.phase === 'trace';
      const demoOn = trace;
      const speakOn = trace && this.ttsOk !== false;

      g.fillStyle(demoOn ? C.btn : C.btnOff, 1);
      g.fillRoundedRect(L.btnDemo.x, L.btnDemo.y, L.btnDemo.w, L.btnDemo.h, 26);
      this.btnDemoText.setText('看它怎么写').setAlpha(demoOn ? 1 : 0.75);

      g.fillStyle(speakOn ? C.btnBlue : C.btnOff, 1);
      g.fillRoundedRect(L.btnSpeak.x, L.btnSpeak.y, L.btnSpeak.w, L.btnSpeak.h, 26);
      this.btnSpeakText.setText(this.ttsOk === false ? '让爸爸妈妈念' : '念一遍').setAlpha(speakOn ? 1 : 0.75);
    }

    // -------------------------------------------------- 换字 / 换组
    goTo(i, first) {
      if (!first && this.phase === 'trace') return;
      const n = CHARS.length;
      this.ci = ((i % n) + n) % n;
      this.gi = CHARS[this.ci].g;
      this.strokeIdx = 0;
      this.path = null;
      this.demo = null;
      this.revealT = 0;
      this.celebT = 0;
      this.phase = 'guess';
      this.dense = this.allDense[this.ci];
      this.trailG.clear();
      this.fxG.clear();
      this.strokeG.clear();
      this.strokeG.setAlpha(1);
      this.artG.clear();
      drawArt(this.artG, CHARS[this.ci].art, this.L.art);
      this.paintCharTexts();
      this.paintTop();
      this.hideCard();
      this.subText.setText('').setVisible(false);
      this.hintText.setText('先问问她：这是什么呀？').setVisible(true).setAlpha(1);
      this.meanText.setText('');
      this.paintButtons();
      Sound.resume();
    }

    setGroup(i) {
      if (!this.canUseTop()) return;
      this.gi = i;
      Sound.tap();
      this.goTo(i * 6);
    }

    // -------------------------------------------------- 四个阶段
    reveal() {
      if (this.phase !== 'guess') return;
      const ch = CHARS[this.ci];
      this.phase = 'reveal';
      this.revealT = 0;
      this.hintText.setVisible(false);
      this.subText.setText(ch.py).setVisible(true).setAlpha(1);
      this.meanText.setText(ch.mean);
      this.strokeG.setAlpha(0);
      this.paintStrokes();
      this.paintTop();
      this.paintButtons();
      Sound.reveal();
      this.speak(ch.c);
    }

    beginTrace() {
      if (this.phase !== 'reveal' && this.phase !== 'guess') return;
      this.phase = 'trace';
      this.strokeIdx = 0;
      this.strokeG.setAlpha(1);
      this.paintStrokes();
      this.paintTop();
      this.paintButtons();
    }

    // 描红：抬起手指时判一次
    submitPath(pts) {
      if (this.phase !== 'trace') return false;
      if (!pts || pts.length < MIN_SAMPLES) return false;
      const stroke = this.dense[this.strokeIdx];
      if (!stroke || stroke.length < 2) return false;
      const ok = judgeStroke(pts, stroke, this.L.box);
      if (ok) {
        this.strokeIdx += 1;
        Sound.ink(this.strokeIdx);
        this.paintStrokes();
        if (this.strokeIdx >= this.dense.length) this.celebrate();
        else this.paintButtons();
      } else {
        Sound.nudge();
        this.demo = { stroke: stroke };
        this.demoT = 0;
      }
      return ok;
    }

    demoStroke() {
      if (this.phase !== 'trace' || this.strokeIdx >= this.dense.length) return;
      this.demo = { stroke: this.dense[this.strokeIdx] };
      this.demoT = 0;
      Sound.tap();
    }

    celebrate() {
      this.phase = 'celebrate';
      this.celebT = 0;
      this.paintStrokes();
      this.spawnStars(20);
      Sound.done();
      const ch = CHARS[this.ci];
      this.speak(ch.c + '，' + ch.word + '的' + ch.c);
      this.markDone(this.ci);
      this.paintTop();
      this.paintButtons();
    }

    showPaper() {
      if (this.phase !== 'celebrate' && this.phase !== 'trace') return;
      this.phase = 'paper';
      this.showCard();
      this.paintTop();
      this.paintButtons();
    }

    nextChar() {
      if (this.phase !== 'paper') return;
      this.hideCard();
      Sound.page();
      this.goTo(this.ci + 1);
    }

    // -------------------------------------------------- 画笔画层
    paintStrokes() {
      const g = this.strokeG;
      g.clear();
      for (let i = 0; i < this.dense.length; i++) {
        let col = C.ghost;
        if (this.phase === 'celebrate' || this.phase === 'paper') col = C.ink;
        else if (i < this.strokeIdx) col = C.done;
        else if (i === this.strokeIdx) col = C.cur;
        dabPath(g, this.dense[i], col, STROKE_W, 900);
      }
    }

    drawTrail() {
      const g = this.trailG;
      g.clear();
      if (!this.path || this.path.length < 2) return;
      const stroke = this.dense[this.strokeIdx];
      if (!stroke) return;
      const tol = TOL_LATERAL * this.L.box.w + STROKE_W / 2;
      for (let i = 1; i < this.path.length; i++) {
        const p = this.path[i];
        const r = projectOnPolyline(stroke, p.x, p.y);
        g.lineStyle(STROKE_W * 0.62, r.d > tol * 1.6 ? C.trailBad : C.trail, 0.55);
        g.lineBetween(this.path[i - 1].x, this.path[i - 1].y, p.x, p.y);
      }
    }

    drawArrow(g, s, color) {
      if (!s || s.length < 3) return;
      const k = Math.max(2, Math.floor(s.length * 0.16));
      const a = s[k], b = s[Math.min(k + 4, s.length - 1)];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len, uy = dy / len;
      g.fillStyle(color, 1);
      g.fillTriangle(a.x + ux * 18, a.y + uy * 18, a.x - uy * 9 + ux * 2, a.y + ux * 9 + uy * 2,
        a.x + uy * 9 + ux * 2, a.y - ux * 9 + uy * 2);
    }

    // -------------------------------------------------- 小特效
    spawnStars(n) {
      const col = [0xFFD93D, 0xFF9F1C, 0x7FB069, 0x6EC1E4, 0xE4572E];
      for (let i = 0; i < n; i++) {
        const s = {
          x: WIDTH / 2 + (Math.random() - 0.5) * 220,
          y: this.L.box.y + 120 + Math.random() * 160,
          vx: (Math.random() - 0.5) * 260,
          vy: -220 - Math.random() * 220,
          r: 4 + Math.random() * 5,
          life: 0.9 + Math.random() * 0.7,
          color: col[i % col.length],
        };
        s.life0 = s.life;
        this.stars.push(s);
        this.trackObj(s);
      }
    }

    trackObj(o) { this.liveProps.push(o); return o; }

    untrackObj(o) {
      const i = this.liveProps.indexOf(o);
      if (i >= 0) this.liveProps.splice(i, 1);
      return o;
    }

    // -------------------------------------------------- 卡片（到纸上再写一遍）
    showCard() {
      const L = this.L, g = this.cardG;
      g.clear();
      g.fillStyle(C.paper, 0.92).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(C.card, 1).fillRoundedRect(L.card.x, L.card.y, L.card.w, L.card.h, 30);
      g.lineStyle(4, C.mark, 1).strokeRoundedRect(L.card.x, L.card.y, L.card.w, L.card.h, 30);
      g.fillStyle(C.btn, 1).fillRoundedRect(L.cardBtn.x, L.cardBtn.y, L.cardBtn.w, L.cardBtn.h, 32);
      g.setVisible(true);

      // 卡片中间淡淡再写一遍这个字，给孩子看着写
      const gg = this.cardGlyphG;
      gg.clear();
      const box = L.box;
      const k = 0.30, ox = WIDTH / 2, oy = L.card.y + 186;
      for (let i = 0; i < this.dense.length; i++) {
        const pts = this.dense[i].map(function (p) {
          return { x: ox + (p.x - (box.x + box.w / 2)) * k, y: oy + (p.y - (box.y + box.h / 2)) * k };
        });
        dabPath(gg, pts, C.ghost, STROKE_W * k, 700);
      }
      gg.setVisible(true);

      this.cardTitle.setVisible(true);
      this.cardBody.setVisible(true);
      this.cardSmall.setVisible(true);
      this.cardBtnText.setVisible(true);
    }

    hideCard() {
      this.cardG.clear();
      this.cardG.setVisible(false);
      this.cardGlyphG.clear();
      this.cardGlyphG.setVisible(false);
      if (this.cardTitle) {
        this.cardTitle.setVisible(false);
        this.cardBody.setVisible(false);
        this.cardSmall.setVisible(false);
        this.cardBtnText.setVisible(false);
      }
    }

    // -------------------------------------------------- 进度
    markDone(i) {
      if (this.done.indexOf(i) < 0) {
        this.done.push(i);
        saveProgress(this.done);
      }
    }

    resetProgress() {
      this.done = [];
      saveProgress(this.done);
      this.paintTop();
      Sound.reset();
    }

    // -------------------------------------------------- 发音
    refreshVoices() {
      if (!this.ttsSupported) { this.ttsOk = false; return; }
      try {
        const S = window.speechSynthesis;
        const vs = S && S.getVoices ? S.getVoices() : [];
        if (vs && vs.length) {
          let zh = null;
          for (let i = 0; i < vs.length; i++) {
            const tag = ((vs[i].lang || '') + ' ' + (vs[i].name || ''));
            if (/zh|chinese|中文|普通话/i.test(tag)) { zh = vs[i]; break; }
          }
          this.zhVoice = zh;
          this.ttsOk = !!zh;
        }
      } catch (e) { /* ignore */ }
    }

    speak(text) {
      if (this.ttsSupported === false) return false;
      try {
        const S = window.speechSynthesis;
        if (!S || !window.SpeechSynthesisUtterance) return false;
        const u = new window.SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN';
        u.rate = 0.75;
        u.pitch = 1.05;
        if (this.zhVoice) u.voice = this.zhVoice;
        if (S.cancel) S.cancel();
        S.speak(u);
        return true;
      } catch (e) { return false; }
    }

    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointerdown', (p) => this.onDown(p));
      this.input.on('pointermove', (p) => this.onMove(p));
      this.input.on('pointerup', (p) => this.onUp(p));
      this.input.on('pointerupoutside', (p) => this.onUp(p));
    }

    inTopBar(x, y) { return y < 202; }

    onDown(p) {
      Sound.resume();
      if (this.activePointerId !== null) return;
      this.activePointerId = p.id;
      const x = p.x, y = p.y, L = this.L;

      if (this.phase === 'paper') {
        if (inRect(L.cardBtn, x, y) || !this.inTopBar(x, y)) this.nextChar();
        return;
      }

      if (this.canUseTop()) {
        for (let i = 0; i < L.groups.length; i++) if (inRect(L.groups[i], x, y)) { this.setGroup(i); return; }
        for (let i = 0; i < L.cards.length; i++) if (inRect(L.cards[i], x, y)) { Sound.tap(); this.goTo(this.gi * 6 + i); return; }
        if (inRect(L.reset, x, y)) { this.resetProgress(); return; }
      }

      if (this.phase === 'guess') { this.reveal(); return; }
      if (this.phase === 'reveal') { return; }
      if (this.phase === 'celebrate') { this.showPaper(); return; }

      if (this.phase === 'trace') {
        if (inRect(L.btnDemo, x, y)) { this.demoStroke(); return; }
        if (inRect(L.btnSpeak, x, y)) {
          if (this.ttsOk === false) { this.nudgeTts(); return; }
          this.speak(CHARS[this.ci].c);
          return;
        }
        if (inRect(L.box, x, y)) {
          this.path = [{ x: x, y: y }];
          this.drawTrail();
        }
      }
    }

    onMove(p) {
      if (p.id !== this.activePointerId) return;
      if (this.phase === 'trace' && this.path) {
        const last = this.path[this.path.length - 1];
        if (dist(last.x, last.y, p.x, p.y) >= SAMPLE_GAP && this.path.length < 400) {
          this.path.push({ x: p.x, y: p.y });
        }
        this.drawTrail();
      }
    }

    onUp(p) {
      if (this.activePointerId === null) return;
      if (p && p.id !== undefined && p.id !== this.activePointerId) return;
      this.activePointerId = null;
      if (this.phase === 'trace' && this.path) {
        const pts = this.path;
        this.path = null;
        this.trailG.clear();
        this.submitPath(pts);
      }
    }

    nudgeTts() {
      this.meanText.setText('让爸爸妈妈念给你听');
      Sound.tap();
    }

    // -------------------------------------------------- 每帧推进（纯逻辑）
    step(dt) {
      this.elapsed += dt;

      if (this.phase === 'reveal') {
        this.revealT += dt;
        const k = REVEAL_MS / 1000;
        this.strokeG.setAlpha(Math.min(1, this.revealT / k));
        if (this.revealT >= k + 0.30) this.beginTrace();
      } else if (this.phase === 'celebrate') {
        this.celebT += dt;
        if (this.celebT >= CELEBRATE_MS / 1000) this.showPaper();
      }

      if (this.demo) {
        this.demoT += dt;
        if (this.demoT >= DEMO_MS / 1000) this.demo = null;
      }

      for (let i = this.stars.length - 1; i >= 0; i--) {
        const s = this.stars[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 420 * dt;
        s.life -= dt;
        if (s.life <= 0) {
          this.stars.splice(i, 1);
          this.untrackObj(s);
        }
      }
    }

    // -------------------------------------------------- 每帧绘制
    render() {
      const g = this.fxG;
      g.clear();

      if (this.phase === 'trace' && !this.demo && this.strokeIdx < this.dense.length) {
        const s = this.dense[this.strokeIdx];
        if (s && s.length) {
          const pulse = 1 + 0.14 * Math.sin(this.elapsed * 6);
          g.fillStyle(C.dot, 1).fillCircle(s[0].x, s[0].y, 9 * pulse);
          g.lineStyle(3, 0xFFFFFF, 0.85).strokeCircle(s[0].x, s[0].y, 9 * pulse);
          this.drawArrow(g, s, C.dot);
        }
      }

      if (this.demo && this.demo.stroke) {
        const s = this.demo.stroke;
        const u = clamp(this.demoT / (DEMO_MS / 1000), 0, 1);
        const idx = Math.max(1, Math.min(s.length - 1, Math.floor(u * (s.length - 1))));
        g.fillStyle(C.cur, 0.5);
        for (let i = 0; i <= idx; i += 2) g.fillCircle(s[i].x, s[i].y, STROKE_W * 0.32);
        g.fillStyle(C.dot, 1).fillCircle(s[idx].x, s[idx].y, 10);
        this.drawArrow(g, s, C.dot);
      }

      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        g.fillStyle(s.color, clamp(s.life / s.life0, 0, 1));
        g.fillCircle(s.x, s.y, s.r);
      }
    }

    update(time, delta) {
      const dt = Math.min(delta, 60) / 1000;
      this.step(dt);
      this.render();
    }

    // -------------------------------------------------- 测试钩子（非公共 API）
    judgeStroke(pts, stroke, box) { return judgeStroke(pts, stroke, box || this.L.box); }
  }
  const CONST = {
    WIDTH: WIDTH, HEIGHT: HEIGHT, FONT: FONT,
    BOX: BOX, STROKE_W: STROKE_W, DAB_STEP: DAB_STEP,
    TOL_START: TOL_START, TOL_LATERAL: TOL_LATERAL, TOL_COVER: TOL_COVER,
    TOL_BACK: TOL_BACK, TOL_BACK_RATIO: TOL_BACK_RATIO, TOL_STICK: TOL_STICK,
    NEAR_T: NEAR_T, MIN_SAMPLES: MIN_SAMPLES, SAMPLE_GAP: SAMPLE_GAP,
    DEMO_MS: DEMO_MS, CELEBRATE_MS: CELEBRATE_MS, REVEAL_MS: REVEAL_MS,
    STORE_KEY: STORE_KEY, GROUPS: GROUPS, CHARS: CHARS,
  };

  ShiziScene.CONST = CONST;

  window.ShiziScene = ShiziScene;
})();
