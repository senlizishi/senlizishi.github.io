/*
 * 广东麻将玩法场景：一人（下方）对三家电脑。
 * 规则：不能吃，只能碰 / 杠 / 胡；自摸或胡别人打出的牌。
 * 打完一局自动开下一局，不记分、不统计。
 */
(function () {
  'use strict';

  const RULES = window.MahjongRules;
  const ART = window.MahjongArt;
  const SFX = window.MahjongAudio;
  const TILE = ART.TILE;

  // 画布尺寸由 mahjong.html 按屏幕比例算好放进 window.MahjongView，
  // 下面的值只是兜底，真正的尺寸在 create() 里落地。
  let IS_PORTRAIT = window.innerHeight >= window.innerWidth;
  let WIDTH = IS_PORTRAIT ? 540 : 960;
  let HEIGHT = IS_PORTRAIT ? 960 : 540;
  let HUD_INSET = 78;                                    // 左上角返回按钮让出的宽度
  let SAFE = { top: 0, right: 0, bottom: 0, left: 0 };    // 刘海 / 圆角安全区（画布坐标）
  const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const TAU = Math.PI * 2;

  const SEAT_NAME = ['你', '下家', '对家', '上家'];
  const WIND_NAME = ['东', '南', '西', '北'];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function roundRectPath(g, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + radius, y);
    g.lineTo(x + w - radius, y);
    g.arc(x + w - radius, y + radius, radius, -Math.PI / 2, 0);
    g.lineTo(x + w, y + h - radius);
    g.arc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2);
    g.lineTo(x + radius, y + h);
    g.arc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI);
    g.lineTo(x, y + radius);
    g.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
    g.closePath();
  }

  // 以 (x, y) 为中心的圆角面板：内部按中心点作画，整体缩放时不会跑偏
  function addPanel(scene, x, y, w, h, color, alpha, radius) {
    const r = radius || 14;
    const g = scene.add.graphics({ x: x, y: y });
    g.fillStyle(0x0d0716, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, r);
    g.fillStyle(color, alpha === undefined ? 0.92 : alpha).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    return g;
  }

  // 立体感按钮：投影 + 厚度底座 + 圆角亮面 + 金色描边
  function addButton(scene, x, y, w, h, label, onClick, options) {
    const opts = options || {};
    const container = scene.add.container(x, y).setDepth(opts.depth || 60);
    const radius = Math.min(opts.radius === undefined ? 12 : opts.radius, h / 2);
    const color = opts.color === undefined ? 0x7b53ad : opts.color;
    const base = opts.base === undefined ? 0x5c3a86 : opts.base;
    const lift = 3;                     // 立面厚度
    const face = scene.add.graphics();
    // 贴地投影
    face.fillStyle(0x070410, 0.42).fillRoundedRect(-w / 2 + 1, -h / 2 + lift + 3, w, h - lift, radius);
    // 底座（比面低一点，形成厚度）
    face.fillStyle(base, 1).fillRoundedRect(-w / 2, -h / 2 + lift, w, h - lift, radius);
    // 按钮面
    face.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h - lift, radius);
    // 顶面反光
    face.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, (h - lift) * 0.44, Math.max(3, radius - 3));
    // 金色描边
    face.lineStyle(1.4, 0xffd89a, 0.4).strokeRoundedRect(-w / 2 + 0.7, -h / 2 + 0.7, w - 1.4, h - lift - 1.4, radius);
    const text = scene.add.text(0, -lift / 2, label, {
      fontFamily: FONT,
      fontSize: (opts.fontSize || 19) + 'px',
      fontStyle: 'bold',
      color: opts.textColor || '#fff6e6',
    }).setOrigin(0.5);
    if (text.setShadow) text.setShadow(0, 1, 'rgba(0,0,0,0.45)', 2, false, true);
    const hit = scene.add.rectangle(0, 0, w, h, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      scene.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: 60, yoyo: true });
      onClick();
    });
    container.add([face, hit, text]);
    container.buttonText = text;
    container.buttonFace = face;
    return container;
  }

  function text(scene, x, y, content, size, color, options) {
    const opts = options || {};
    return scene.add.text(x, y, content, {
      fontFamily: FONT,
      fontSize: size + 'px',
      fontStyle: opts.bold ? 'bold' : 'normal',
      color: color,
      align: opts.align || 'left',
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
      stroke: opts.stroke,
      strokeThickness: opts.strokeThickness || 0,
    }).setOrigin(opts.originX === undefined ? 0 : opts.originX, opts.originY === undefined ? 0 : opts.originY);
  }

  function hashRand(seed) {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  // 一整张牌的「占位尺寸」：牌面 + 描边留白 + 厚度（含投影，见 art.js 的 footW / footH）。
  // 排版必须按占位尺寸算，只按牌面宽度排，相邻两张的贴图会互相压住（看起来就是牌叠在一起）。
  // 手牌自适应：给定可用宽高，反算一张牌能画多大。
  // 宽度按「相邻锚点步进 advanceW + 一整张贴图宽」算，高度按「行距 + 一整张贴图高」算，
  // 所以 gapX = 0 时牌正好首尾相接（排内没有缝），gapY 则保证两排之间留出缝。
  function fitHand(boxW, boxH, options) {
    const opts = options || {};
    const count = Math.max(1, opts.count || 14);
    const gapX = opts.gapX === undefined ? 0 : opts.gapX;
    const gapY = opts.gapY === undefined ? 20 : opts.gapY;
    const maxRows = Math.max(1, opts.maxRows || 2);
    const maxScale = opts.maxScale === undefined ? 0.62 : opts.maxScale;
    const advanceW = (opts.advanceW === undefined ? TILE.footW : opts.advanceW) + gapX;
    const rowStepUnits = TILE.faceH + TILE.thickness;
    let best = null;
    for (let rows = 1; rows <= Math.min(maxRows, count); rows += 1) {
      const cols = Math.ceil(count / rows);
      const boardW = (cols - 1) * advanceW + TILE.footW;
      const boardH = (rows - 1) * rowStepUnits + TILE.footH;
      const scaleW = boxW / boardW;
      const scaleH = (boxH - gapY * (rows - 1)) / boardH;
      const scale = Math.min(scaleW, scaleH, maxScale);
      if (scale <= 0.1) continue;
      if (!best || scale > best.scale + 1e-6) {
        best = {
          rows: rows, cols: cols, scale: scale,
          gapX: cols > 1 ? gapX : 0, gapY: rows > 1 ? gapY : 0,
        };
      }
    }
    if (!best) best = { rows: 1, cols: count, scale: 0.1, gapX: 0, gapY: 0 };
    return best;
  }

  // 自适应布局：画布比例等于屏幕比例，所以按画布尺寸算出的坐标天然适配任何机型。
  // 所有尺寸都从 WIDTH / HEIGHT / SAFE / HUD_INSET 推出来，不写死像素，
  // 这样竖屏、横屏、平板、桌面窗口都不会出现压边或留黑边。
  function computeLayout() {
    const safe = SAFE;
    const cols = 6;
    const inset = Math.max(safe.left, HUD_INSET);   // 左上角要躲开返回按钮

    if (IS_PORTRAIT) {
      const hud = {
        titleX: inset,
        titleY: safe.top + 26,
        subY: safe.top + 60,
        pillY: safe.top + 24,
        pillRight: WIDTH - safe.right - 10,
        pillW: 68,
        pillH: 30,
      };

      const side = clamp(Math.round(WIDTH * 0.034), 12, 26);
      // 底部至少留 3%：有些内置浏览器底部工具条会盖住画布，safe-area 却报 0，
      // 不留这一条手牌下排就会被工具条吃掉。
      const bottomInset = Math.max(safe.bottom, Math.round(HEIGHT * 0.03));
      // 牌桌上沿要让开标题 + 牌墙/局数那一行，否则牌匾会压到桌面上
      const chipRowBottom = hud.pillY + hud.pillH + 72;
      const tableTop = Math.max(hud.pillY + hud.pillH + 22, chipRowBottom);

      // 底部区块自下而上排：手牌 -> 状态 -> 操作按钮 -> 牌桌
      const handAvail = WIDTH - side * 2;
      // 画布偏矮（平板竖屏）时把底部几条间距按比例收一收，省下的高度让给牌桌和手牌；
      // 高瘦的手机画布 HEIGHT >= 900，系数为 1，间距与原来完全一致。
      const shortFall = Math.min(1, HEIGHT / 900);
      const handBottomGap = Math.round(12 * shortFall);    // 手牌下沿到屏幕底
      const handToStatus = Math.round(26 * shortFall);     // 手牌上沿到状态文字
      const statusToActions = Math.round(40 * shortFall);  // 状态文字到操作按钮
      const actionsToTable = Math.round(34 * shortFall);   // 按钮到牌桌下沿
      const handGapY = 22;        // 两行手牌之间的缝（也够选中抬起 18px）
      // 牌桌保留高度的下限：竖屏短屏（如平板竖屏）时让牌桌让出空间给两行手牌
      const tableMin = Math.min(handAvail, Math.max(220, Math.round(HEIGHT * 0.36)));

      // 竖屏一行 13 张太挤：铺成两行、每行 7 张，牌与牌之间留出缝，谁也不压谁。
      // 牌不做满屏那么大（小一点更好认），但也别小到手指点不准。
      const roomForHand = HEIGHT - bottomInset - tableTop - tableMin
        - (handBottomGap + handToStatus + statusToActions + actionsToTable);
      // 手牌自适应：竖屏铺两行、每行最多 7 张。缩放由 fitHand() 按「整块贴图」反算，
      // 牌宽、牌高一起约束，任何屏宽 / 屏高的手机都只会把牌缩小，绝不会互相压住。
      // gapX = 0：同一排里相邻两张首尾相接，看着是一整排牌；
      // gapY 只留在两排之间，所以上下排仍然互不遮挡。
      const handFit = fitHand(handAvail, roomForHand, {
        count: 14, gapX: 0, gapY: handGapY, maxRows: 2, maxScale: 0.56,
        advanceW: TILE.faceW,
      });
      const handRows = handFit.rows;
      const handCols = handFit.cols;
      const handGapX = handFit.gapX;
      const handScale = handFit.scale;
      // 贴图锚点在牌面中心（art.js 的 originY），手牌块要按贴图的上下沿对齐才算得准。
      const handUp = TILE.originY * TILE.texH * handScale;
      const handDown = (TILE.texH - TILE.originY * TILE.texH) * handScale;
      const handRowStep = (TILE.faceH + TILE.thickness) * handScale + handGapY;
      const handBlockBottom = HEIGHT - bottomInset - handBottomGap;
      const handBlockH = handUp + (handRows - 1) * handRowStep + handDown;
      const handBlockTop = handBlockBottom - handBlockH;
      const handY = handBlockTop + handUp;                   // 第一排锚点，其余按 handRowStep 往下排
      const statusY = handBlockTop - handToStatus;
      const actionsY = statusY - statusToActions;

      const tableBottom = actionsY - actionsToTable;
      const room = Math.max(180, tableBottom - tableTop);
      const table = {
        cx: WIDTH / 2,
        cy: tableTop + room / 2,
        size: Math.max(200, Math.min(handAvail, room)),
      };

      const rim = table.size * 0.085;
      const felt = {
        x: table.cx - table.size / 2 + rim,
        y: table.cy - table.size / 2 + rim,
        w: table.size - rim * 2,
        h: table.size - rim * 2,
      };
      const band = 34;                              // 对手手牌靠边的一条
      const inner = { x: felt.x + band, y: felt.y + band, w: felt.w - band * 2, h: felt.h - band * 2 };
      // 副露不再挤在牌桌下方那一条里，改成每家摆在自己那一侧的桌沿（木框）上，
      // 谁碰 / 杠就出现在谁面前，和真打麻将一样；原来那条副露带的地盘还给弃牌区，
      // 四家的「河」跟着变大，后期牌再多也看得清。
      const region = { x: inner.x, y: inner.y, w: inner.w, h: inner.h };

      // 弃牌区：四家各占一条互不相压的「河」，按主流麻将 App 的风车形咬合排布，
      // 中间留出牌墙的位置。四条河各自是一个矩形、彼此不重叠，所以后期弃牌再多
      // 也只会缩在自己那条河里，不会压到隔壁。
      // 下 / 右 / 上 / 左 依次首尾相接，读牌方向顺着出牌顺序转一圈（你 → 下家 →
      // 对家 → 上家）；一张牌具体多大、一行几张由 discardPlan() 按各家当前弃牌
      // 数现算（牌多就整体缩小，始终画在自己那条河里）。
      const dh = Math.round(region.w * 0.42);
      const dv = Math.round(region.h * 0.42);
      // 牌贴图在牌面外还留了一圈「厚度」，四条河的外沿要按这一圈往回收，
      // 免得贴图压到圈外的手牌 / 副露。
      const edge = 6;
      const dead = {
        x: region.x, y: region.y, w: region.w, h: region.h,
        maxScale: 0.27, minScale: 0.02, maxCols: 10, pad: 3,
        // 你（下）：横条，占下边靠右 58%
        bottom: { x0: region.x + dh, x1: region.x + region.w, y0: region.y + region.h - dv, y1: region.y + region.h - edge, rotation: 0 },
        // 下家（右）：竖条，占右边靠上 58%
        right: { x0: region.x + region.w - dh, x1: region.x + region.w - edge, y0: region.y, y1: region.y + region.h - dv, rotation: -Math.PI / 2 },
        // 对家（上）：横条，占上边靠左 58%
        top: { x0: region.x, x1: region.x + region.w - dh, y0: region.y + edge, y1: region.y + dv, rotation: Math.PI },
        // 上家（左）：竖条，占左边靠下 58%
        left: { x0: region.x + edge, x1: region.x + dh, y0: region.y + dv, y1: region.y + region.h, rotation: Math.PI / 2 },
      };

      // 对手整条手牌要放得进内圈：牌桌越小画得越小，牌多时自动收紧间距
      const innerMin = Math.min(inner.w, inner.h);
      const oppScale = Math.round(clamp((innerMin - 8) / 1185.6, 0.15, 0.26) * 100) / 100;
      const oppPitch = clamp(Math.floor((innerMin - TILE.faceW * oppScale - 6) / 13), 8, 26);

      // 四家副露各自的落点：谁那一侧的桌沿（木框）就归谁，谁碰 / 杠就出现在谁面前。
      // 横边（对家 / 你）横着排一排；竖边（上家 / 下家）一张一张往下叠，牌一律正着摆
      // —— 转 90° 虽然更像真桌子，但歪着就看不出是什么牌了。
      // 每条都按自己那块木框的厚度定尺寸，永远待在自己家里，压不到弃牌也压不到别人。
      // 木框本身就这么厚，副露牌能被它卡住；留一点点边就行，贴图外侧只是透明留白，
      // 真压出框 1~2 px 也看不出来，换来的是副露更大更好认。
      const meldPad = Math.max(2, Math.round(rim * 0.06));
      const meldMaxScale = clamp((rim - meldPad * 2 - 2) / (TILE.faceH + TILE.thickness), 0.1, 0.26);
      const meldZone = (left, top, right, bottom, dir) => ({
        left: left, top: top, right: right, bottom: bottom, dir: dir, maxScale: meldMaxScale,
      });
      const meldZones = {
        2: meldZone(felt.x, table.cy - table.size / 2 + meldPad, felt.x + felt.w, felt.y - meldPad, 'h'),
        3: meldZone(table.cx - table.size / 2 + meldPad, table.cy - table.size / 2 + meldPad, felt.x - meldPad, table.cy + table.size / 2 - meldPad, 'v'),
        1: meldZone(felt.x + felt.w + meldPad, table.cy - table.size / 2 + meldPad, table.cx + table.size / 2 - meldPad, table.cy + table.size / 2 - meldPad, 'v'),
        0: meldZone(felt.x, felt.y + felt.h + meldPad, felt.x + felt.w, table.cy + table.size / 2 - meldPad, 'h'),
      };

      return {
        table: table,
        felt: felt,
        inner: inner,
        region: region,
        hud: hud,
        hand: {
          y: handY, scale: handScale, avail: handAvail, left: side,
          rows: handRows, cols: handCols, gapX: handGapX, gapY: handGapY,
          rowStep: handRowStep, footPitch: true, up: handUp, pitchW: TILE.faceW,
          footW: TILE.footW, footH: TILE.footH, blockH: handBlockH,
        },
        meldZones: meldZones,
        oppScale: oppScale,
        oppPitch: oppPitch,
        dead: dead,
        cols: cols,
        opp: {
          2: { from: 'x', y: inner.y - band / 2, pitch: oppPitch, center: table.cx },
          3: { from: 'y', x: inner.x - band / 2, pitch: oppPitch, center: table.cy },
          1: { from: 'y', x: inner.x + inner.w + band / 2, pitch: oppPitch, center: table.cy },
        },
        actions: { mode: 'row', x: WIDTH / 2, y: actionsY, w: 94, h: 52, gap: 12 },
        status: { x: WIDTH / 2, y: statusY },
        wallChip: { x: inset + 82, y: safe.top + 94 },
        roundChip: { x: WIDTH - safe.right - 168, y: safe.top + 94 },
      };
    }

    // ---------------- 横屏 ----------------
    // 横屏高度基本被牌桌吃满，顶部留不出横带，所以标题写在牌桌正上方，
    // 音量/重开、牌墙、局数、操作按钮全部收进右侧操作栏。
    const rightCol = clamp(Math.round(WIDTH * 0.2), 158, 224);
    const controlsX = WIDTH - safe.right - Math.round(rightCol * 0.5);
    const controlsLeft = WIDTH - safe.right - rightCol;

    const hudBand = Math.round(clamp(WIDTH * 0.055, 46, 58));
    const pillH = 30;
    const hud = {
      titleX: 0,                                   // 下面按牌桌中线补
      titleY: safe.top + hudBand * 0.40,
      subY: safe.top + hudBand * 0.80,
      pillY: safe.top + 20,
      pillRight: WIDTH - safe.right - 10,
      pillW: 68,
      pillH: pillH,
    };


    const vmargin = clamp(Math.round(HEIGHT * 0.024), 8, 16);
    const tableTop = safe.top + hudBand;
    const tableBottom = HEIGHT - safe.bottom - vmargin;
    const band = Math.max(180, tableBottom - tableTop);
    // 牌桌可用横向区间：左沿躲开返回按钮，右沿让开操作栏
    const leftEdge = inset;
    const rightEdge = controlsLeft - 6;
    const span = Math.max(180, rightEdge - leftEdge);
    const size = Math.max(180, Math.min(span, band));
    const cx = leftEdge + Math.max(0, span - size) / 2 + size / 2;
    const table = { cx: cx, cy: tableTop + band / 2, size: size };
    hud.titleX = cx;

    // 手牌：横屏高度不够铺两行，用一行 14 张，同样按「整块贴图」自适应算尺寸；
    // 铺不下就整体缩小，牌与牌之间永远留着 gapX 的缝，不会互相压住。
    const handAvail = Math.max(180, rightEdge - leftEdge);
    const handLeft = leftEdge;
    // 横屏同理：一排 14 张首尾相接，铺不下就整体缩小。
    const handFit = fitHand(handAvail, band * 0.5, {
      count: 14, gapX: 0, gapY: 14, maxRows: 1, maxScale: 0.56,
      advanceW: TILE.faceW,
    });
    const handRows = handFit.rows;
    const handCols = handFit.cols;
    const handGapX = handFit.gapX;
    const handScale = handFit.scale;
    const handUp = TILE.originY * TILE.texH * handScale;
    const handRowStep = (TILE.faceH + TILE.thickness) * handScale;
    const handBlockH = TILE.footH * handScale;
    const handBlockBottom = tableBottom;
    const handBlockTop = handBlockBottom - handBlockH;
    const handY = handBlockTop + handUp;                   // 唯一一排的锚点
    const halfH = (TILE.faceH + TILE.thickness) * handScale / 2;

    const rim = size * 0.085;
    const felt = {
      x: cx - size / 2 + rim,
      y: table.cy - size / 2 + rim,
      w: size - rim * 2,
      h: size - rim * 2,
    };
    const band2 = 30;
    const inner = { x: felt.x + band2, y: felt.y + band2, w: felt.w - band2 * 2, h: felt.h - band2 * 2 };
    const upDeadDrop = 30;
    const meldBand = 0;
    const region = { x: inner.x, y: inner.y, w: inner.w, h: inner.h };

    const dead = {
      w: clamp(Math.floor(region.w / cols), 22, 34),
      h: clamp(Math.floor(region.h / 5), 26, 44),
    };
    const deadScale = clamp((dead.h - 6) / TILE.faceH, 0.15, 0.27);
    const gapX = (region.w - cols * dead.w) / 2;
    const left = region.x + gapX;
    const centerY = region.y + region.h / 2;
    const sideTop = centerY - ((cols - 1) * dead.w) / 2;

    const innerMin = Math.min(inner.w, inner.h);
    const oppScale = Math.round(clamp((innerMin - 8) / 1185.6, 0.15, 0.26) * 100) / 100;
    const oppPitch = clamp(Math.floor((innerMin - TILE.faceW * oppScale - 6) / 13), 8, 26);

    return {
      table: table,
      felt: felt,
      inner: inner,
      region: region,
      hud: hud,
      hand: {
        y: handY, scale: handScale, avail: handAvail, left: handLeft,
        rows: handRows, cols: handCols, gapX: handGapX, gapY: 0,
        rowStep: handRowStep, footPitch: true, up: handUp, pitchW: TILE.faceW,
        footW: TILE.footW, footH: TILE.footH, blockH: handBlockH,
      },
      meldBand: meldBand,
      // 自己的副露靠在操作栏左边、手牌上方
      playerMeld: {
        y: handY - halfH - 26,
        scale: 0.22,
        right: rightEdge,
        maxWidth: Math.max(150, Math.round((controlsLeft - safe.left) * 0.34)),
      },
      oppScale: oppScale,
      oppPitch: oppPitch,
      deadScale: deadScale,
      corner: {
        1: { x: inner.x + inner.w, y: inner.y + 18, align: 'right' },
        2: { x: inner.x, y: inner.y + 18, align: 'left' },
        3: { x: inner.x, y: inner.y + inner.h - 18, align: 'left', growUp: true },
      },
      oppMeld: {
        1: { scale: 0.17, maxWidth: 200 },
        2: { scale: 0.17, maxWidth: 180 },
        3: { scale: 0.17, maxWidth: 120 },
      },
      seats: {
        0: { originX: table.cx - (cols - 1) * dead.w / 2, originY: region.y + region.h - dead.h / 2, stepX: dead.w, stepY: -dead.h, rotation: 0 },
        2: { originX: left + (cols - 1) * dead.w, originY: region.y + dead.h / 2 + upDeadDrop, stepX: -dead.w, stepY: dead.h, rotation: Math.PI },
        3: { originX: region.x + (dead.h + 4) / 2, originY: sideTop, stepX: dead.h + 4, stepY: dead.w, rotation: Math.PI / 2 },
        1: { originX: region.x + region.w - (dead.h + 4) / 2, originY: sideTop, stepX: -(dead.h + 4), stepY: dead.w, rotation: -Math.PI / 2 },
      },
      cols: cols,
      opp: {
        2: { from: 'x', y: inner.y - band2 / 2, pitch: oppPitch, center: table.cx },
        3: { from: 'y', x: inner.x - band2 / 2, pitch: oppPitch, center: table.cy },
        1: { from: 'y', x: inner.x + inner.w + band2 / 2, pitch: oppPitch, center: table.cy },
      },
      actions: { mode: 'col', x: controlsX, y: safe.top + 146, w: 104, h: 52, gap: 12 },
      status: { x: controlsX, y: HEIGHT * 0.7, wrap: rightCol - 14 },
      wallChip: { x: controlsX - 16, y: safe.top + 72 },
      roundChip: { x: controlsX, y: safe.top + 104 },
    };
  }

  class MahjongScene extends Phaser.Scene {
    constructor() { super('MahjongScene'); }

    create() {
      const view = window.MahjongView;
      WIDTH = Math.round(view && view.w ? view.w : this.scale.width);
      HEIGHT = Math.round(view && view.h ? view.h : this.scale.height);
      IS_PORTRAIT = HEIGHT >= WIDTH;
      SAFE = (view && view.safe) || { top: 0, right: 0, bottom: 0, left: 0 };
      HUD_INSET = (view && view.hudInset) || 78;
      ART.build(this, WIDTH, HEIGHT);
      this.L = computeLayout();
      this.random = Math.random;
      this.timers = [];
      this.tileSprites = [];
      this.marks = [];
      this.oppMeldSprites = [];
      this.meldDecor = [];
      this.uiObjects = [];
      this.lastDiscardSeat = -1;
      this.actionButtons = [];
      this.bannerObjects = [];
      this.selected = -1;
      this.actions = [];
      this.pendingClaim = null;
      this.revealAll = false;
      this.state = 'idle';
      this.handIndex = 0;
      this.turn = 0;

      this.drawBackdrop();
      this.add.image(this.L.table.cx, this.L.table.cy, 'mj-table')
        .setDisplaySize(this.L.table.size, this.L.table.size).setDepth(2);
      this.drawTableDecor();
      this.tileLayer = this.add.container(0, 0).setDepth(10);
      this.uiLayer = this.add.container(0, 0).setDepth(40);
      this.buildHud();
      this.bindInput();
      this.startHand();
    }

    drawBackdrop() {
      // 背景贴图按画布尺寸烘焙，顶部/底部的渐隐在贴图里，不会出现硬边
      this.add.image(WIDTH / 2, HEIGHT / 2, 'mj-room').setDisplaySize(WIDTH, HEIGHT).setDepth(0);
    }

    drawTableDecor() {
      const g = this.add.graphics().setDepth(3);
      const t = this.L.table;
      const x = t.cx - t.size / 2;
      const y = t.cy - t.size / 2;
      g.lineStyle(2, 0xffe6b0, 0.16).strokeRoundedRect(x + 3, y + 3, t.size - 6, t.size - 6, t.size * 0.045);
      g.lineStyle(1, 0xffcf85, 0.12).strokeRoundedRect(x + t.size * 0.028, y + t.size * 0.028, t.size * 0.944, t.size * 0.944, t.size * 0.042);
    }

    buildHud() {
      const hud = this.L.hud;
      // 竖屏标题贴左上角，横屏没有左侧余量，标题居中压在手牌上方的横带上
      const hudOriginX = IS_PORTRAIT ? 0 : 0.5;
      this.uiLayer.add(text(this, hud.titleX, hud.titleY, '广东麻将', IS_PORTRAIT ? 26 : 24, '#f7e6c4', {
        bold: true, originX: hudOriginX, stroke: '#2a1408', strokeThickness: 4,
      }));
      this.uiLayer.add(text(this, hud.titleX, hud.subY, '不吃 · 只能碰杠 · 自摸或胡别人', IS_PORTRAIT ? 12 : 11, '#c8b494', {
        originX: hudOriginX,
      }));
      const btnW = hud.pillW;
      const btnH = hud.pillH;
      const gap = 8;
      const mkPill = (label, index, onClick) => {
        const x = hud.pillRight - btnW / 2 - index * (btnW + gap);
        return addButton(this, x, hud.pillY + btnH / 2, btnW, btnH, label, onClick, {
          color: 0x4a3568, base: 0x2c1f42, fontSize: 13, depth: 70, textColor: '#f0e2ff',
        });
      };
      this.soundPill = mkPill('音量', 0, () => this.toggleSound());
      this.uiLayer.add(this.soundPill);
      this.uiLayer.add(mkPill('重开', 1, () => { this.startHand(); }));

      this.wallText = text(this, this.L.wallChip.x + (IS_PORTRAIT ? 16 : 0), this.L.wallChip.y, '', IS_PORTRAIT ? 15 : 14, '#f3e3bf', {
        bold: true, originX: IS_PORTRAIT ? 0 : 0.5, originY: 0.5, stroke: '#1b1024', strokeThickness: 3,
      });
      this.roundText = text(this, this.L.roundChip.x, this.L.roundChip.y, '', 11, '#c9b696', { originX: 0.5, originY: 0.5 });
      // 局数/风向那行小字垫一块牌匾，细字也看得清
      this.roundBadge = this.add.graphics();
      this.uiLayer.addAt(this.roundBadge, 0);
      this.uiLayer.add(this.wallText);
      this.uiLayer.add(this.roundText);

      this.statusText = text(this, this.L.status.x, this.L.status.y, '', IS_PORTRAIT ? 17 : 14, '#f6e8cc', {
        bold: true, originX: 0.5, originY: 0.5, wrap: this.L.status.wrap, stroke: '#1b1024', strokeThickness: 4,
      });
      this.uiLayer.add(this.statusText);
      this.drawRoundBadge();
    }

    // 牌匾按文字实际宽度绘制，换局后文字变长也不会溢出
    drawRoundBadge() {
      if (!this.roundBadge || !this.roundText) return;
      const w = Math.max(112, this.roundText.width + 22);
      const h = 21;
      // 文字变长时把牌匾夹在屏幕内，别贴到边上
      const x = clamp(this.L.roundChip.x, w / 2 + 8 + SAFE.left, WIDTH - w / 2 - 8 - SAFE.right);
      const y = this.L.roundChip.y;
      this.roundText.setPosition(x, y);
      this.roundBadge.clear();
      this.roundBadge.fillStyle(0x140c24, 0.4).fillRoundedRect(x - w / 2, y - h / 2, w, h, 11);
      this.roundBadge.lineStyle(1, 0xffd89a, 0.14).strokeRoundedRect(x - w / 2 + 0.5, y - h / 2 + 0.5, w - 1, h - 1, 11);
    }

    toggleSound() {
      const enabled = SFX.toggle();
      this.soundPill.buttonText.setText(enabled ? '音量' : '静音');
      if (enabled) SFX.pass();
    }

    bindInput() {
      this.input.on('pointerdown', (pointer) => {
        SFX.start();
        this.handleTap(pointer.x, pointer.y);
      });
    }

    // ---------------- 一局流程 ----------------
    later(delay, fn) {
      const timer = this.time.delayedCall(delay, () => {
        const at = this.timers.indexOf(timer);
        if (at >= 0) this.timers.splice(at, 1);
        fn();
      });
      this.timers.push(timer);
      return timer;
    }

    clearTimers() {
      this.timers.forEach((timer) => timer.remove());
      this.timers = [];
    }

    startHand() {
      this.clearTimers();
      this.handIndex += 1;
      this.state = 'playing';
      this.revealAll = false;
      this.selected = -1;
      this.pendingClaim = null;
      this.actions = [];
      this.result = null;
      this.drawnThisTurn = false;
      this.lastDiscardSeat = -1;
      this.bannerObjects.forEach((item) => item.destroy());
      this.bannerObjects = [];

      this.wall = RULES.createWall(this.random);
      this.seats = [0, 1, 2, 3].map((seat) => ({
        seat: seat, hand: [], melds: [], discards: [], drawnIndex: -1,
      }));
      const dealer = (this.handIndex - 1) % 4;
      this.dealer = dealer;
      for (let round = 0; round < 3; round += 1) {
        for (let step = 0; step < 4; step += 1) {
          const seat = (dealer + step) % 4;
          for (let k = 0; k < 4; k += 1) this.seats[seat].hand.push(this.wall.pop());
        }
      }
      for (let step = 0; step < 4; step += 1) {
        const seat = (dealer + step) % 4;
        this.seats[seat].hand.push(this.wall.pop());
      }
      this.sortHand(0);
      this.turn = dealer;
      SFX.deal();
      this.renderAll();
      this.later(520, () => this.beginTurn());
    }

    sortHand(seat) {
      const hand = this.seats[seat].hand;
      hand.sort((a, b) => a - b);
      return hand;
    }

    beginTurn() {
      if (this.state !== 'playing') return;
      const seat = this.turn;
      if (!this.wall.length) return this.finishHand({ type: 'liuju' });
      this.drawTile(seat);
      this.renderAll();
      if (seat === 0) {
        SFX.turn();
        this.playerPhase(true);
      } else {
        this.later(IS_PORTRAIT ? 520 : 440, () => this.botPhase(seat, true));
      }
    }

    drawTile(seat) {
      const tile = this.wall.pop();
      const state = this.seats[seat];
      state.hand.push(tile);
      if (seat === 0) {
        this.sortHand(0);
        let drawn = -1;
        for (let i = 0; i < state.hand.length; i += 1) if (state.hand[i] === tile) drawn = i;
        state.drawnIndex = drawn;
        this.drawnThisTurn = true;
        SFX.draw();
      } else {
        state.drawnIndex = -1;
      }
      return tile;
    }

    // ---------------- 玩家操作 ----------------
    playerPhase(canWin) {
      if (this.state !== 'playing' || this.turn !== 0) return;
      const state = this.seats[0];
      const counts = RULES.countsOf(state.hand);
      const melds = state.melds.length;
      const list = [];
      if (canWin && this.drawnThisTurn && RULES.isWinning(counts, melds)) list.push({ id: 'tsumo', label: '自摸' });
      RULES.concealedKongs(counts).forEach((tile) => list.push({ id: 'ankong', label: '暗杠', tile: tile }));
      RULES.addedKongs(counts, state.melds).forEach((tile) => list.push({ id: 'addkong', label: '补杠', tile: tile }));
      this.actions = list;
      this.renderAll();
    }

    handleTap(x, y) {
      if (this.state !== 'playing') return;
      if (this.pendingClaim) return;
      if (this.turn !== 0) return;
      const state = this.seats[0];
      const count = state.hand.length;
      if (!count) return;
      const metrics = this.handMetrics();
      // 手牌可能是两行，按最近的一张判定，行与行之间也能点中
      const slopX = metrics.w / 2 + 5;
      const slopY = metrics.h / 2 + 12;
      let hit = -1;
      let bestDist = Infinity;
      for (let i = 0; i < count; i += 1) {
        const dx = x - metrics.slotX(i);
        const dy = y - metrics.slotY(i);
        if (Math.abs(dx) > slopX || Math.abs(dy) > slopY) continue;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) { bestDist = dist; hit = i; }
      }
      if (hit < 0) {
        if (this.selected >= 0) { this.selected = -1; this.renderAll(); }
        return;
      }
      if (this.selected === hit) this.playerDiscard(hit);
      else { this.selected = hit; this.renderAll(); }
    }

    // 手牌可能铺成两行：这里给出每张牌的位置，以及整块手牌的外接矩形
    handMetrics() {
      const count = this.seats[0].hand.length;
      const cfg = this.L.hand;
      const scale = cfg.scale;
      const w = TILE.faceW * scale;
      const h = TILE.faceH * scale;
      const rows = Math.max(1, cfg.rows || 1);
      const gapY = Math.max(0, cfg.gapY || 0);
      // 一行时按实际张数铺开（自动居中）；多行时按整副 14 张分排，牌不会跳位
      const perRow = rows === 1
        ? Math.max(1, count)
        : Math.max(1, cfg.cols || Math.ceil(14 / rows));
      const avail = cfg.avail;
      // 一整块贴图的占位尺寸：含描边留白、厚度与投影（见 art.js 的 footW / footH）
      const footW = (cfg.footW || TILE.footW) * scale;
      const footH = (cfg.footH || TILE.footH) * scale;
      // 贴图锚点在牌面中心，锚点上下各占多少要按 originY 算，手牌块才对得上
      const up = TILE.originY * TILE.texH * scale;
      const down = (TILE.texH - TILE.originY * TILE.texH) * scale;
      // 行距按「可见牌体」（牌面 + 厚度）算，两排之间正好留出 cfg.gapY 的缝，不会互相压住
      const bodyH = (TILE.faceH + TILE.thickness) * scale;
      const rowStep = rows > 1 ? (cfg.rowStep || bodyH + gapY) : 0;
      let pitch = 0;
      if (perRow > 1) {
        // 排内步进：pitchW 是相邻两张锚点的距离（贴图单位）。
        // 取 faceW 时两张牌正好首尾相接，取 footW 时会留出贴图的透明留白。
        pitch = cfg.footPitch
          ? (cfg.pitchW || cfg.footW || TILE.footW) * scale + (cfg.gapX || 0)
          : Math.min(cfg.maxPitch, Math.max(w * 0.62, (avail - w) / (perRow - 1)));
      }
      const total = footW + pitch * (perRow - 1);
      const startX = cfg.left + (avail - total) / 2 + footW / 2;
      const topY = cfg.y;                       // cfg.y 是第一排的锚点
      const slotX = (index) => startX + (index % perRow) * pitch;
      const slotY = (index) => topY + Math.floor(index / perRow) * rowStep;
      return {
        w: w, h: h, pitch: pitch, startX: startX, total: total, count: count,
        rows: rows, perRow: perRow, gapY: gapY, rowStep: rowStep, topY: topY,
        slotX: slotX, slotY: slotY,
        blockH: up + (rows - 1) * rowStep + down,
        footW: footW, footH: footH,
        left: startX - footW / 2,
        right: startX + pitch * (perRow - 1) + footW / 2,
        top: topY - up,
        bottom: topY + (rows - 1) * rowStep + down,
      };
    }

    playerDiscard(index) {
      if (this.state !== 'playing' || this.turn !== 0 || this.pendingClaim) return;
      const state = this.seats[0];
      if (index < 0 || index >= state.hand.length) return;
      const tile = state.hand.splice(index, 1)[0];
      state.drawnIndex = -1;
      state.discards.push(tile);
      this.lastDiscardSeat = 0;
      this.selected = -1;
      this.actions = [];
      this.drawnThisTurn = false;
      SFX.discard();
      this.renderAll();
      this.afterDiscard(0, tile);
    }

    playerKong(tile, kind) {
      const state = this.seats[0];
      if (kind === 'ankong') {
        for (let i = 0; i < 4; i += 1) state.hand.splice(state.hand.indexOf(tile), 1);
        state.melds.push({ type: 'kong', tile: tile, from: 0, concealed: true });
      } else {
        state.hand.splice(state.hand.indexOf(tile), 1);
        const meld = state.melds.find((item) => item.type === 'pong' && item.tile === tile);
        if (meld) meld.type = 'kong';
      }
      this.actions = [];
      this.selected = -1;
      SFX.kong();
      this.showBanner('杠', 0, '#ffc24d');
      this.sortHand(0);
      if (!this.wall.length) return this.finishHand({ type: 'liuju' });
      this.drawTile(0);
      state.drawnIndex = -1;
      this.renderAll();
      this.later(380, () => this.playerPhase(true));
    }

    resolveClaim(id) {
      const claim = this.pendingClaim;
      if (!claim) return;
      this.pendingClaim = null;
      this.actions = [];
      if (id === 'pass') {
        SFX.pass();
        this.renderAll();
        this.advanceTurn(claim.from);
        return;
      }
      if (id === 'hu') {
        return this.finishHand({ type: 'win', winner: 0, tile: claim.tile, from: claim.from, tsumo: false });
      }
      this.executeMeld(0, id, claim.tile, claim.from);
    }

    // ---------------- 电脑回合 ----------------
    botPhase(seat, canWin) {
      if (this.state !== 'playing') return;
      const state = this.seats[seat];
      const counts = RULES.countsOf(state.hand);
      const melds = state.melds.length;
      if (canWin && RULES.isWinning(counts, melds)) {
        return this.finishHand({ type: 'win', winner: seat, tsumo: true, tile: state.hand[state.hand.length - 1] });
      }
      const an = RULES.concealedKongs(counts);
      const add = RULES.addedKongs(counts, state.melds);
      if (an.length && this.random() < 0.85) return this.botKong(seat, an[0], 'ankong');
      if (add.length && this.random() < 0.9) return this.botKong(seat, add[0], 'addkong');
      const pick = RULES.chooseDiscard(counts.slice(), melds, this.random);
      if (pick < 0) return this.advanceTurn(seat);
      state.hand.splice(state.hand.indexOf(pick), 1);
      state.discards.push(pick);
      this.lastDiscardSeat = seat;
      state.drawnIndex = -1;
      SFX.discard();
      this.renderAll();
      this.later(IS_PORTRAIT ? 240 : 200, () => this.afterDiscard(seat, pick));
    }

    botKong(seat, tile, kind) {
      const state = this.seats[seat];
      if (kind === 'ankong') {
        for (let i = 0; i < 4; i += 1) state.hand.splice(state.hand.indexOf(tile), 1);
        state.melds.push({ type: 'kong', tile: tile, from: seat, concealed: true });
      } else {
        state.hand.splice(state.hand.indexOf(tile), 1);
        const meld = state.melds.find((item) => item.type === 'pong' && item.tile === tile);
        if (meld) meld.type = 'kong';
      }
      SFX.kong();
      this.showBanner('杠', seat, '#ffc24d');
      this.renderAll();
      this.later(480, () => {
        if (this.state !== 'playing') return;
        if (!this.wall.length) return this.finishHand({ type: 'liuju' });
        this.drawTile(seat);
        this.renderAll();
        this.later(420, () => this.botPhase(seat, true));
      });
    }

    // ---------------- 出牌后的响应 ----------------
    afterDiscard(from, tile) {
      if (this.state !== 'playing') return;
      const winners = [];
      let meldSeat = -1;
      let meldType = null;
      for (let offset = 1; offset <= 3; offset += 1) {
        const seat = (from + offset) % 4;
        const state = this.seats[seat];
        const counts = RULES.countsOf(state.hand);
        const melds = state.melds.length;
        const probe = counts.slice();
        probe[tile] += 1;
        if (RULES.isWinning(probe, melds)) winners.push(seat);
        if (meldSeat < 0) {
          if (counts[tile] >= 3 && RULES.shouldKong(counts.slice(), melds, tile, this.random)) {
            meldSeat = seat; meldType = 'kong';
          } else if (counts[tile] >= 2 && RULES.shouldPong(counts.slice(), melds, tile, this.random)) {
            meldSeat = seat; meldType = 'pong';
          }
        }
      }

      if (winners.length) {
        const winner = winners[0];
        if (winner === 0) {
          this.pendingClaim = { kind: 'win', tile: tile, from: from, options: [{ id: 'hu', label: '胡' }, { id: 'pass', label: '过' }] };
          this.renderAll();
          return;
        }
        return this.finishHand({ type: 'win', winner: winner, tile: tile, from: from, tsumo: false });
      }

      if (meldSeat === 0) {
        const counts = RULES.countsOf(this.seats[0].hand);
        const options = [];
        if (counts[tile] >= 3) options.push({ id: 'kong', label: '杠' });
        if (counts[tile] >= 2) options.push({ id: 'pong', label: '碰' });
        if (options.length) {
          this.pendingClaim = { kind: 'meld', tile: tile, from: from, options: options.concat([{ id: 'pass', label: '过' }]) };
          this.renderAll();
          return;
        }
      }

      if (meldSeat > 0) return this.executeMeld(meldSeat, meldType, tile, from);

      this.advanceTurn(from);
    }


    executeMeld(seat, type, tile, from) {
      const state = this.seats[seat];
      const need = type === 'kong' ? 3 : 2;
      for (let i = 0; i < need; i += 1) {
        const at = state.hand.indexOf(tile);
        if (at >= 0) state.hand.splice(at, 1);
      }
      state.melds.push({ type: type, tile: tile, from: from });
      this.removeDiscard(from, tile);
      this.lastDiscardSeat = -1;
      SFX[type === 'kong' ? 'kong' : 'pong']();
      this.showBanner(type === 'kong' ? '杠' : '碰', seat, type === 'kong' ? '#ffc24d' : '#a8dcff');
      this.turn = seat;
      if (seat === 0) this.sortHand(0);
      this.renderAll();
      if (type === 'kong') {
        this.later(460, () => {
          if (this.state !== 'playing') return;
          if (!this.wall.length) return this.finishHand({ type: 'liuju' });
          this.drawTile(seat);
          this.renderAll();
          this.later(400, () => this.afterMeldTurn(seat, true));
        });
      } else {
        this.later(IS_PORTRAIT ? 520 : 460, () => this.afterMeldTurn(seat, false));
      }
    }

    afterMeldTurn(seat, canWin) {
      if (this.state !== 'playing') return;
      if (seat === 0) this.playerPhase(canWin);
      else this.botPhase(seat, canWin);
    }

    removeDiscard(seat, tile) {
      const list = this.seats[seat].discards;
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (list[i] === tile) { list.splice(i, 1); return; }
      }
    }

    advanceTurn(from) {
      if (this.state !== 'playing') return;
      this.turn = (from + 1) % 4;
      this.renderAll();
      this.later(IS_PORTRAIT ? 280 : 240, () => this.beginTurn());
    }

    // ---------------- 结算 ----------------
    finishHand(result) {
      if (this.state !== 'playing') return;
      this.state = 'over';
      if (result.type === 'win' && !result.tsumo) {
        // 胡别人打出的牌：把这张牌并入赢家手牌，并从弃牌堆移除，保证亮牌完整、牌数守恒。
        this.removeDiscard(result.from, result.tile);
        const winner = this.seats[result.winner];
        winner.hand.push(result.tile);
        winner.drawnIndex = -1;
        this.sortHand(result.winner);
      }
      this.result = result;
      this.revealAll = true;
      this.actions = [];
      this.pendingClaim = null;
      this.selected = -1;
      if (result.type === 'win') SFX.win(); else SFX.lose();
      this.renderAll();
      const isWin = result.type === 'win';
      const title = isWin ? (result.tsumo ? '自摸' : '胡牌') : '流局';
      let detail = '牌墙摸完了，马上开下一局';
      if (isWin) {
        const winnerName = SEAT_NAME[result.winner];
        if (result.tsumo) detail = winnerName + '自摸 · ' + RULES.tileName(result.tile);
        else detail = winnerName + '胡了' + SEAT_NAME[result.from] + '打出的 ' + RULES.tileName(result.tile);
        if (result.winner === 0) detail = result.tsumo ? '你自摸胡了！' : '你胡了 ' + SEAT_NAME[result.from] + ' 打出的 ' + RULES.tileName(result.tile) + '！';
      }
      this.showResultPanel(title, detail, result);
      this.later(6500, () => { if (this.state === 'over') this.startHand(); });
    }

    showResultPanel(title, detail, result) {
      const cx = WIDTH / 2;
      const cy = HEIGHT / 2;
      const w = IS_PORTRAIT ? 340 : 420;
      const h = IS_PORTRAIT ? 210 : 180;
      const shade = this.add.rectangle(cx, cy, WIDTH, HEIGHT, 0x08040f, 0.5).setDepth(90).setInteractive();
      shade.setAlpha(0);

      const panel = addPanel(this, cx, cy, w, h, 0x2b1d40, 0.985, 20).setDepth(92);
      // 顶部反光 + 双层金线 + 标题下的分隔线
      panel.fillStyle(0xffffff, 0.05).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.42, 16);
      panel.lineStyle(2.4, 0xd9a441, 0.72).strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 17);
      panel.lineStyle(1, 0xffe6b0, 0.26).strokeRoundedRect(-w / 2 + 8.5, -h / 2 + 8.5, w - 17, h - 17, 13);
      panel.lineStyle(1, 0xffd98a, 0.32).lineBetween(-w * 0.3, -h / 2 + 58, w * 0.3, -h / 2 + 58);

      const titleText = text(this, cx, cy - h / 2 + 34, title, IS_PORTRAIT ? 30 : 28, '#ffd98a', {
        bold: true, originX: 0.5, originY: 0.5, stroke: '#3a1c07', strokeThickness: 4,
      }).setDepth(94);
      const detailText = text(this, cx, cy - 6, detail, IS_PORTRAIT ? 14 : 13, '#f0e2c8', {
        originX: 0.5, originY: 0.5, align: 'center', wrap: w - 44,
      }).setDepth(94);
      const button = addButton(this, cx, cy + h / 2 - 40, 150, 44, '下一局', () => this.startHand(), {
        color: 0xd08a3c, base: 0x7d4d1c, fontSize: 17, depth: 96, textColor: '#fff6e4',
      });
      shade.on('pointerdown', () => this.startHand());

      // 弹出：面板从略小放大到原尺寸
      panel.setScale(0.88);
      button.setScale(0.88);
      titleText.setAlpha(0);
      detailText.setAlpha(0);
      this.tweens.add({ targets: shade, alpha: 0.5, duration: 200 });
      this.tweens.add({ targets: [panel, button], scaleX: 1, scaleY: 1, duration: 300, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [titleText, detailText], alpha: 1, duration: 260, delay: 90 });
      this.bannerObjects.push(shade, panel, titleText, detailText, button);
    }

    showBanner(label, seat, tint) {
      const position = this.bannerPosition(seat);
      const item = text(this, position.x, position.y, label, IS_PORTRAIT ? 40 : 34, tint || '#ffd479', {
        bold: true, originX: 0.5, originY: 0.5, stroke: '#3f1c0a', strokeThickness: 7,
      }).setDepth(80);
      item.setScale(0.5);
      this.bannerObjects.push(item);
      this.tweens.add({ targets: item, scale: 1.05, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: item, alpha: 0, y: position.y - 30, delay: 560, duration: 420, onComplete: () => item.destroy() });
    }

    bannerPosition(seat) {
      const table = this.L.table;
      if (seat === 0) return { x: table.cx, y: this.L.hand.y - (this.L.hand.up || 0) - 30 };
      if (seat === 1) return { x: this.L.inner.x + this.L.inner.w - 62, y: table.cy - 70 };
      if (seat === 2) return { x: table.cx, y: this.L.inner.y + 76 };
      return { x: this.L.inner.x + 62, y: table.cy - 70 };
    }

    // ---------------- 渲染 ----------------
    clearTiles() {
      this.tileSprites.forEach((sprite) => sprite.destroy());
      this.tileSprites = [];
      this.marks.forEach((mark) => mark.destroy());
      this.marks = [];
      this.oppMeldSprites.forEach((sprite) => sprite.destroy());
      this.oppMeldSprites = [];
      this.meldDecor.forEach((item) => item.destroy());
      this.meldDecor = [];
    }

    makeTile(code, x, y, scale, rotation, layer) {
      return this.makeTileKey(code < 0 ? ART.backKey : ART.faceKey(code), x, y, scale, rotation, layer);
    }

    makeTileKey(key, x, y, scale, rotation, layer) {
      // 注意：Phaser 的 Container 没有 create()，牌必须由工厂创建后再 add 进去。
      const target = layer || this.tileLayer;
      const sprite = this.add.image(0, 0, key);
      if (target && typeof target.add === 'function') target.add(sprite);
      ART.place(sprite, x, y, scale);
      if (rotation) sprite.setRotation(rotation);
      this.tileSprites.push(sprite);
      return sprite;
    }

    // 弃牌「河」的排布：四家各一条互不相压的矩形（风车形）。
    // 先按各家弃牌数求「塞进自己这条河需要的最大牌面缩放」，四家取最小值 ——
    // 四家牌一样大；只有某家多到放不下时才会整体缩小，永远压不到隔壁。
    discardPlan() {
      const dead = this.L.dead;
      if (!dead) return null;
      const rectOf = (seat) => (seat === 0 ? dead.bottom : (seat === 1 ? dead.right : (seat === 2 ? dead.top : dead.left)));
      // 下家（右）/ 上家（左）的牌转了 90°，行方向落在纵轴上
      const sideways = (seat) => (seat === 1 || seat === 3);
      const extents = (seat) => {
        const r = rectOf(seat);
        return sideways(seat)
          ? { along: r.y1 - r.y0 - dead.pad * 2, deep: r.x1 - r.x0 - dead.pad * 2 }
          : { along: r.x1 - r.x0 - dead.pad * 2, deep: r.y1 - r.y0 - dead.pad * 2 };
      };
      const colsFor = (seat, scale) => {
        const along = extents(seat).along;
        return Math.min(dead.maxCols, Math.max(1, Math.floor(along / (TILE.faceW * scale))));
      };
      // 一家能用的最大缩放：枚举「一行放几张」，取放得进自己那条河的最大值。
      // 小屏 / 牌特别多时缩放会一直变小，但只会在自己那条河里变小，不会压到隔壁。
      const bestScale = (count, along, deep) => {
        let top = 0;
        const cap = Math.max(1, Math.min(dead.maxCols, count));
        for (let cols = 1; cols <= cap; cols += 1) {
          const rows = Math.ceil(count / cols);
          const s = Math.min(dead.maxScale, along / (cols * TILE.faceW), deep / (rows * TILE.faceH));
          if (s > top) top = s;
        }
        return top;
      };
      let scale = dead.maxScale;
      for (let seat = 0; seat < 4; seat += 1) {
        const count = this.seats[seat].discards.length;
        if (count <= 0) continue;
        const e = extents(seat);
        scale = Math.min(scale, bestScale(count, e.along, e.deep) * 0.998);
      }
      // 缩放往下取整（取整后行数可能翻一行），再退到四条河都真的放得下为止
      scale = Math.max(dead.minScale, Math.floor(scale * 1000) / 1000);
      for (let guard = 0; guard < 300; guard += 1) {
        const allFit = [0, 1, 2, 3].every((seat) => {
          const count = this.seats[seat].discards.length;
          if (count <= 0) return true;
          const rows = Math.ceil(count / colsFor(seat, scale));
          return rows * TILE.faceH * scale <= extents(seat).deep + 0.01;
        });
        if (allFit) break;
        if (scale <= dead.minScale + 0.002) { scale = dead.minScale; break; }
        scale = Math.round((scale - 0.002) * 1000) / 1000;
      }

      const seats = {};
      for (let seat = 0; seat < 4; seat += 1) {
        const r = rectOf(seat);
        const tileW = TILE.faceW * scale;
        const tileH = TILE.faceH * scale;
        let ox; let oy; let scx; let scy; let srx; let sry;
        if (seat === 0) {            // 下：第一行贴着自己，往上（桌心）叠
          ox = r.x0 + dead.pad + tileW / 2; oy = r.y1 - dead.pad - tileH / 2;
          scx = tileW; scy = 0; srx = 0; sry = -tileH;
        } else if (seat === 2) {     // 上：牌面转 180°，第一行贴着对家，往下叠
          ox = r.x1 - dead.pad - tileW / 2; oy = r.y0 + dead.pad + tileH / 2;
          scx = -tileW; scy = 0; srx = 0; sry = tileH;
        } else if (seat === 1) {     // 右：牌面转 -90°，第一行贴着下家，往左叠
          ox = r.x1 - dead.pad - tileH / 2; oy = r.y1 - dead.pad - tileW / 2;
          scx = 0; scy = -tileW; srx = -tileH; sry = 0;
        } else {                     // 左：牌面转 +90°，第一行贴着上家，往右叠
          ox = r.x0 + dead.pad + tileH / 2; oy = r.y0 + dead.pad + tileW / 2;
          scx = 0; scy = tileW; srx = tileH; sry = 0;
        }
        seats[seat] = { ox: ox, oy: oy, scx: scx, scy: scy, srx: srx, sry: sry, cols: colsFor(seat, scale), rotation: r.rotation };
      }
      return { scale: scale, seats: seats };
    }

    // 弃牌落位：竖屏走 discardPlan() 的风车形，横屏沿用旧布局（L.seats）
    discardSlot(seat, index, plan) {
      if (plan) {
        const g = plan.seats[seat];
        const col = index % g.cols;
        const row = Math.floor(index / g.cols);
        return {
          x: g.ox + g.scx * col + g.srx * row,
          y: g.oy + g.scy * col + g.sry * row,
          rotation: g.rotation,
        };
      }
      const layout = this.L.seats[seat];
      const row = Math.floor(index / this.L.cols);
      const col = index % this.L.cols;
      return {
        x: layout.originX + layout.stepX * (seat === 0 || seat === 2 ? col : row),
        y: layout.originY + layout.stepY * (seat === 0 || seat === 2 ? row : col),
        rotation: layout.rotation,
      };
    }

    renderAll() {
      if (!this.tileSprites) return;
      this.clearTiles();
      this.renderOpponents();
      this.renderMelds();
      this.renderDiscards();
      this.renderPlayerHand();
      this.renderActions();
      this.renderStatus();
      this.renderWallChip();
    }
    renderOpponents() {
      const scale = this.L.oppScale;
      for (const seat of [1, 2, 3]) {
        const state = this.seats[seat];
        const layout = this.L.opp[seat];
        const count = state.hand.length;
        const pitch = layout.pitch;
        const total = pitch * (count - 1);
        const rotation = seat === 1 ? -Math.PI / 2 : (seat === 2 ? Math.PI : Math.PI / 2);
        for (let i = 0; i < count; i += 1) {
          const offset = i * pitch - total / 2;
          const x = layout.from === 'x' ? layout.center + offset : layout.x;
          const y = layout.from === 'x' ? layout.y : layout.center + offset;
          const key = this.revealAll ? ART.faceKey(state.hand[i]) : ART.backKey;
          this.makeTileKey(key, x, y, scale, rotation);
        }
      }
    }

    // 副露（吃碰杠）按行排布，超出宽度自动折行。
    // 传入 bandTop / bandBottom 时，整块副露会被限制在这条水平带里，
    // 放不下就整体缩小，绝不越界压到弃牌或别人的副露上。
    drawMeldRow(melds, anchorX, anchorY, scale, align, maxWidth, growUp, bandTop, bandBottom) {
      const gap = 7;
      const plan = (s) => {
        const step = TILE.faceW * s + 1;
        const rows = [];
        let row = [];
        let rowWidth = 0;
        melds.forEach((meld) => {
          const width = (meld.type === 'kong' ? 4 : 3) * step;
          if (row.length && rowWidth + width > maxWidth) {
            rows.push({ melds: row, width: rowWidth });
            row = []; rowWidth = 0;
          }
          row.push(meld);
          rowWidth += width + gap;
        });
        if (row.length) rows.push({ melds: row, width: rowWidth });
        const rowStep = TILE.faceH * s + 8;
        return {
          rows: rows, step: step, rowStep: rowStep,
          blockH: (rows.length - 1) * rowStep + TILE.faceH * s,
        };
      };
      const hasBand = bandTop !== undefined && bandBottom !== undefined;
      let s = scale;
      let fitted = plan(s);
      if (hasBand) {
        const bandH = Math.max(TILE.faceH * 0.2, bandBottom - bandTop);
        let guard = 0;
        while (fitted.blockH > bandH && s > 0.06 && guard < 12) {
          s *= Math.max(0.72, Math.min(0.98, Math.sqrt(bandH / fitted.blockH)));
          fitted = plan(s);
          guard += 1;
        }
      }
      const rows = fitted.rows;
      const step = fitted.step;
      const rowStep = fitted.rowStep;
      const baseY = hasBand
        ? (growUp ? bandBottom - TILE.faceH * s / 2 : bandTop + TILE.faceH * s / 2)
        : anchorY;
      rows.forEach((entry, rowIndex) => {
        const y = growUp ? baseY - (rows.length - 1 - rowIndex) * rowStep : baseY + rowIndex * rowStep;
        let x = align === 'right' ? anchorX - entry.width + gap : anchorX;
        entry.melds.forEach((meld) => {
          const count = meld.type === 'kong' ? 4 : 3;
          for (let i = 0; i < count; i += 1) {
            const concealed = meld.concealed && (i === 1 || i === 2);
            const key = concealed ? ART.backKey : ART.faceKey(meld.tile);
            this.makeTileKey(key, x + i * step + step / 2, y, s, 0);
          }
          x += count * step + gap;
        });
      });
    }

    renderMelds() {
      const zones = this.L.meldZones;
      if (!zones) {
        // 横屏：桌面下沿没有整条空带，沿用原来分角落的摆法
        const playerMelds = this.seats[0].melds;
        if (playerMelds.length) {
          const cfg = this.L.playerMeld;
          // 副露多时往上叠，别顶到手牌或掉出牌桌
          this.drawMeldRow(playerMelds, cfg.right, cfg.y, cfg.scale, 'right', cfg.maxWidth || 400, true, cfg.bandTop, cfg.bandBottom);
        }
        for (const seat of [1, 2, 3]) {
          const melds = this.seats[seat].melds;
          if (!melds.length) continue;
          const anchor = this.L.corner[seat];
          const cfg = this.L.oppMeld[seat];
          this.drawMeldRow(melds, anchor.x, anchor.y, cfg.scale, anchor.align, cfg.maxWidth, anchor.growUp, anchor.bandTop, anchor.bandBottom);
        }
        return;
      }
      // 竖屏：谁碰的牌就摆在谁那一侧的桌沿上，位置固定、不随副露多少跳动，
      // 一眼就能看出是哪一家碰 / 杠了什么。
      [0, 1, 2, 3].forEach((seat) => {
        const melds = this.seats[seat].melds;
        if (!melds.length) return;
        this.drawMeldZone(melds, seat, zones[seat]);
      });
    }

    // 一家的副露画在它自己那一侧的桌沿（木框）上，整块居中：
    //  横边（对家 / 你）：牌正着排成一排，同一副 3 张（杠 4 张）首尾相接；
    //  竖边（上家 / 下家）：牌仍然正着看，一张一张往下叠，纵向留出牌厚度，
    //    免得上面那张的厚度压住下面那张的牌面。
    // 每组垫一块底板、杠再描一圈金边，一眼能看出哪几张是一副、哪副是杠。
    // 整块按木框厚度自动缩放，永远待在自己这条木框里，压不到弃牌也压不到别人。
    drawMeldZone(melds, seat, zone) {
      const vertical = zone.dir === 'v';
      const countOf = (meld) => (meld.type === 'kong' ? 4 : 3);
      // 垂直于排列方向的可用厚度；排列方向的可用长度 = 那一条木框有多长
      const thick = vertical ? zone.right - zone.left : zone.bottom - zone.top;
      const along = vertical ? zone.bottom - zone.top : zone.right - zone.left;
      // 一张牌沿「厚度」方向要占牌面 + 立体厚度，沿「排列」方向只算牌面（首尾相接）
      const across = vertical ? TILE.faceW : TILE.faceH + TILE.thickness;
      const stepUnit = vertical ? TILE.faceH + TILE.thickness : TILE.faceW;
      const gap = clamp(Math.round(thick * 0.22), 4, 12);
      const labelSize = clamp(Math.round(thick * 0.34), 8, 13);
      const labelExtent = labelSize + 6;
      const count = melds.reduce((n, meld) => n + countOf(meld), 0);
      const gaps = (melds.length - 1) * gap;
      const extentAt = (s) => count * (stepUnit * s + 1) + gaps;
      // 目标尺寸放不下就整块等比缩小，保证只占这一条木框、绝不叠到别的东西上
      let scale = Math.min(zone.maxScale, (thick - 2) / across);
      const avail = along - 10 - labelExtent;
      if (extentAt(scale) > avail) scale = (avail - gaps - count) / (count * stepUnit);
      scale = Math.max(0, Math.min(scale, zone.maxScale));
      // 木框太窄（小屏平板竖屏）时宁可不画，也别糊成一团看不清
      if (scale < 0.08 || count <= 0) return;
      const extent = extentAt(scale);
      const centerAlong = vertical ? (zone.top + zone.bottom) / 2 : (zone.left + zone.right) / 2;
      const centerThick = vertical ? (zone.left + zone.right) / 2 : (zone.top + zone.bottom) / 2;
      let cursor = centerAlong - (extent + labelExtent + 5) / 2;
      const label = text(this, vertical ? centerThick : cursor, vertical ? cursor + 3 : centerThick,
        SEAT_NAME[seat], labelSize, seat === 0 ? '#ffd479' : '#e9d8b7', {
          originX: vertical ? 0.5 : 0, originY: vertical ? 0 : 0.5, stroke: '#1b1024', strokeThickness: 3,
        });
      this.tileLayer.add(label);
      this.meldDecor.push(label);
      cursor += labelExtent + 5;
      const halfThick = across * scale / 2;
      // 贴图在牌面外还留着立体厚度，锚点往上挪半个厚度，牌面才正好落在木框中间
      const anchorThick = centerThick - (vertical ? 0 : TILE.thickness / 2 * scale);
      melds.forEach((meld) => {
        const n = countOf(meld);
        const groupLen = n * (stepUnit * scale + 1);
        const plate = this.add.graphics();
        this.tileLayer.add(plate);
        this.meldDecor.push(plate);
        const r = Math.max(3, stepUnit * scale * 0.24);
        if (vertical) {
          plate.fillStyle(0x0d0817, 0.4).fillRoundedRect(centerThick - halfThick - 2.5, cursor - 2, halfThick * 2 + 5, groupLen + 4, r);
        } else {
          plate.fillStyle(0x0d0817, 0.4).fillRoundedRect(cursor - 2, centerThick - halfThick - 2.5, groupLen + 4, halfThick * 2 + 5, r);
        }
        if (meld.type === 'kong') {
          plate.lineStyle(1.4, 0xffd479, 0.55);
          if (vertical) plate.strokeRoundedRect(centerThick - halfThick - 2.5, cursor - 2, halfThick * 2 + 5, groupLen + 4, r);
          else plate.strokeRoundedRect(cursor - 2, centerThick - halfThick - 2.5, groupLen + 4, halfThick * 2 + 5, r);
        }
        for (let i = 0; i < n; i += 1) {
          const at = cursor + (i + 0.5) * (stepUnit * scale + 1);
          const concealed = meld.concealed && (i === 1 || i === 2);
          this.makeTileKey(concealed ? ART.backKey : ART.faceKey(meld.tile),
            vertical ? centerThick : at, vertical ? at : anchorThick, scale, 0);
        }
        cursor += groupLen + gap;
      });
    }

    renderDiscards() {
      // 风车形：四家共用一个牌面缩放，格子对齐（跟主流麻将 App 一样不抖不歪），
      // 所以同一排的牌只是首尾相接，绝不会互相压住。
      const plan = this.discardPlan();
      for (let seat = 0; seat < 4; seat += 1) {
        const list = this.seats[seat].discards;
        if (plan) {
          for (let i = 0; i < list.length; i += 1) {
            const slot = this.discardSlot(seat, i, plan);
            this.makeTile(list[i], slot.x, slot.y, plan.scale, slot.rotation);
          }
          continue;
        }
        // 横屏：沿用原来的散摆 + 轻微错位
        const base = this.L.deadScale;
        const scale = list.length > 24 ? base * Math.sqrt(24 / list.length) : base;
        for (let i = 0; i < list.length; i += 1) {
          const slot = this.discardSlot(seat, i);
          const jitter = (hashRand(seat * 131 + i * 17) - 0.5) * 0.12;
          const dx = (hashRand(seat * 977 + i * 7.3) - 0.5) * 2.6;
          const dy = (hashRand(seat * 313 + i * 3.1) - 0.5) * 2.6;
          this.makeTile(list[i], slot.x + dx, slot.y + dy, scale, slot.rotation + jitter);
        }
      }
    }

    renderPlayerHand() {
      const state = this.seats[0];
      const metrics = this.handMetrics();
      const scale = this.L.hand.scale;
      const half = TILE.faceH * scale / 2;
      for (let i = 0; i < state.hand.length; i += 1) {
        const lifted = i === this.selected;
        const x = metrics.slotX(i);
        const y = metrics.slotY(i) - (lifted ? 18 : 0);
        if (lifted) {
          // 选中的牌下面托一层金光，抬起来更明显
          const glow = this.add.graphics().setDepth(6);
          glow.fillStyle(0xffd479, 0.26).fillRoundedRect(x - TILE.faceW * scale / 2 - 3, y - half - 3, TILE.faceW * scale + 6, TILE.faceH * scale + 6, 7);
          this.marks.push(glow);
        }
        this.makeTile(state.hand[i], x, y, scale, 0);
      }
    }

    renderActions() {
      this.actionButtons.forEach((button) => button.destroy());
      this.actionButtons = [];
      const options = this.pendingClaim ? this.pendingClaim.options : this.actions;
      if (!options.length) return;
      const layout = this.L.actions;
      const total = options.length * layout.w + (options.length - 1) * layout.gap;
      options.forEach((option, index) => {
        const style = this.actionStyle(option.id);
        const x = layout.mode === 'row'
          ? layout.x - total / 2 + layout.w / 2 + index * (layout.w + layout.gap)
          : layout.x;
        const y = layout.mode === 'row'
          ? layout.y
          : layout.y + index * (layout.h + layout.gap) + layout.h / 2;
        const button = addButton(this, x, y, layout.w, layout.h, option.label, () => this.onAction(option), {
          color: style.color, base: style.base, textColor: style.textColor,
          fontSize: option.label.length > 1 ? 15 : 19, depth: 62,
        });
        this.actionButtons.push(button);
      });
    }

    actionStyle(id) {
      if (id === 'hu' || id === 'tsumo') return { color: 0xe0a13a, base: 0x8a5a12, textColor: '#fff8e6' };
      if (id === 'kong') return { color: 0x8a5ec4, base: 0x53317e, textColor: '#f6ecff' };
      if (id === 'pong') return { color: 0x3f8cc9, base: 0x235579, textColor: '#eef8ff' };
      return { color: 0x5a4a68, base: 0x33283e, textColor: '#e2d6ee' };
    }

    onAction(option) {
      if (this.pendingClaim) return this.resolveClaim(option.id);
      const hand = this.seats[0].hand;
      if (option.id === 'tsumo') {
        return this.finishHand({ type: 'win', winner: 0, tsumo: true, tile: hand[hand.length - 1] });
      }
      if (option.id === 'ankong') return this.playerKong(option.tile, 'ankong');
      if (option.id === 'addkong') return this.playerKong(option.tile, 'addkong');
    }

    renderStatus() {
      let status = '';
      if (this.state === 'playing') {
        if (this.pendingClaim) status = this.pendingClaim.kind === 'win' ? '这张牌可以胡' : '可以碰 / 杠这张牌';
        else if (this.turn === 0) status = '轮到你出牌';
        else status = SEAT_NAME[this.turn] + ' 出牌中…';
      } else if (this.result) {
        status = '';
      }
      this.statusText.setText(status);
    }

    renderWallChip() {
      const chip = this.L.wallChip;
      this.wallText.setText('牌墙 ' + this.wall.length);
      const windOfSeat = WIND_NAME[((0 - this.dealer) + 4) % 4];
      const windNow = WIND_NAME[((this.turn - this.dealer) + 4) % 4];
      this.roundText.setText('第 ' + this.handIndex + ' 局 · 你坐' + windOfSeat + ' · 轮到' + windNow);
      this.drawRoundBadge();
      this.makeTile(-1, chip.x - 68, chip.y, 0.2, Math.PI / 2);
      this.makeTile(-1, chip.x - 40, chip.y, 0.2, Math.PI / 2);
    }
  }

  window.MahjongScene = MahjongScene;
})();