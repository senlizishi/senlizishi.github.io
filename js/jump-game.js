/*
 * 跳绳小公主：小女孩原地跳绳，绳子扫到脚边时点屏幕跳一下。
 * 每成功跳 CLEARS_PER_TIER 下升一档，绳子越转越快，脚被绳子绊到就结束本局。
 *
 * 绳子的画法（关键）：绳子是「从左手到右手、中间从头顶甩到脚下」的一段弧，
 * 它绕两手的连线（左右轴）旋转。投影到屏幕上：
 *   x = cx + handHalf * cos(a)
 *   y = handY + R * sin(a) * cos(ψ)      a ∈ [0, π]，t=a/π 就是绳上位置
 *   z = R * sin(a) * sin(ψ)              z>0 在身前，z<0 在身后
 * ψ 是旋转角，ψ ≡ 0 时弧的中点正好落在脚边地面（也就是该起跳的瞬间）。
 * ψ 随时间递减 → 绳子「从身后上来、在身前落下」，跟真跳绳一个方向。
 *
 * 竖直方向：手（绳把）永远固定在 handY 不动，只有身体随跳跃上移，
 * 所以手臂是从肩膀画到手（固定点）的曲线，绳子两端永远咬在手上。
 */
(function () {
  'use strict';

  // 只做竖屏：横屏时由 FIT 缩放居中显示同一版竖屏画面
  const WIDTH = 540;
  const HEIGHT = 960;
  const STORE_KEY = 'jump-rope-v1';

  // 每一档 = 绳子转一圈要多少毫秒（越往后越快）
  const TIERS = [1500, 1340, 1190, 1060, 940, 830, 730, 640, 560, 490];
  const CLEARS_PER_TIER = 6;   // 连跳成功这么多下就升一档
  const JUMP_MS = 620;         // 一次起跳的滞空时间
  const JUMP_H = 118;          // 起跳最高离地多少像素
  const CLEAR_MIN = 18;        // 绳子过脚那一瞬至少要离地这么高才算跳过
  const GRACE_MS = 55;         // 判定宽容：取过绳前后这一小段里的最高点
  const LEAD_RATIO = 1.0;      // 开局到第一次过绳的间隔（1 个整节拍，正好接上准备姿势）
  const RESTART_MS = 7000;     // 结算面板显示多久后自动重开

  const C = {
    sky1: 0xEAF6FF, sky2: 0xCDE6FF, sun: 0xFFF0B8, cloud: 0xFFFFFF,
    ground: 0xF6E4C8, groundEdge: 0xE2CBA6, grass: 0x9BD98A, grassDark: 0x7CBF6C,
    rope: 0xFFB347, ropeLight: 0xFFDCA8, handle: 0x4DBFA8, handleDark: 0x2E9C86,
    skin: 0xFFE0C4, hair: 0x6B4A35, hairLight: 0x9A7358,
    dress: 0xFF9ECB, dressDark: 0xE0689F, dressLight: 0xFFC7E1,
    shoe: 0x5FB8E8, shoeDark: 0x3E93C4, sock: 0xFFFFFF,
    eye: 0x4A3B52, mouth: 0xB35A6A, blush: 0xF2A69E,
    shadow: 0x6C5A44, spark: 0xFFE9A8,
    ui: 0xFFFFFF, uiLine: 0xEBD8BC,
    accent: 0xFF8A48, accentSoft: 0xFFD8A8, card: 0x2F1F3A,
  };

  const DEPTH = {
    sky: 0, ground: 1, shadow: 2, ropeBack: 6,
    girl: 10, ropeFront: 20, fx: 24, ui: 30, overlay: 40,
  };

  // 准备姿势：绳子从手上垂到脚前地面上（ψ=0 与开局第一次过绳的相位正好接上，不会跳一下）
  const READY_PSI = 0;

  // ---------------------------------------------------------------- 小工具
  function lerp(a, b, t) { return a + (b - a) * t; }

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

  // 两个颜色之间插值（天空色带用）
  function blend(c1, c2, t) {
    const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
    const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
    return (Math.round(lerp(r1, r2, t)) << 16) |
           (Math.round(lerp(g1, g2, t)) << 8) |
           Math.round(lerp(b1, b2, t));
  }

  function cubicPts(p0, c1, c2, p3, steps) {
    const n = steps || 18;
    const out = [];
    for (let i = 0; i <= n; i += 1) {
      const t = i / n, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      out.push({
        x: a * p0.x + b * c1.x + c * c2.x + d * p3.x,
        y: a * p0.y + b * c1.y + c * c2.y + d * p3.y,
      });
    }
    return out;
  }

  function arcPts(cx, cy, r, a0, a1, steps) {
    const n = steps || 12;
    const out = [];
    for (let i = 0; i <= n; i += 1) {
      const a = a0 + (a1 - a0) * (i / n);
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return out;
  }

  function fillPts(g, pts) {
    if (!pts || pts.length < 3) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
  }

  function strokePts(g, pts, close) {
    if (!pts || pts.length < 2) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
    if (close) g.closePath();
    g.strokePath();
  }

  // 粗线条：Phaser 的线段没有圆头，两端各补一个圆点当圆头
  function limb(g, pts, w, color) {
    if (!pts || pts.length < 2) return;
    g.lineStyle(w, color, 1);
    strokePts(g, pts, false);
    g.fillStyle(color, 1);
    g.fillCircle(pts[0].x, pts[0].y, w / 2);
    g.fillCircle(pts[pts.length - 1].x, pts[pts.length - 1].y, w / 2);
  }

  // 八角小星星（跳成功的碎光）
  function starPts(r) {
    const out = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.42 : r;
      out.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }
    return out;
  }

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const cx = WIDTH / 2;
    const groundY = 742;
    const handY = groundY - 212;
    return {
      cx: cx,
      groundY: groundY,
      handHalf: 62,        // 两只手（绳把）离中线的距离
      handY: handY,        // 手的高度：跳跃时也不动
      ropeR: groundY - handY,
      // 小女孩的骨架（以「脚踩地面」为原点的局部坐标，y 向上为负）
      girl: {
        hipY: -150, shoulderY: -252, headCY: -306, headR: 52,
        shoulderHalf: 36, legHalf: 20, handY: handY - groundY,
      },
      hud: { pad: 28, row1Y: 48, pillW: 122, pillH: 40, countY: 126, dotsY: 190 },
      tipY: 884,
      card: { w: 448, h: 436 },
    };
  }

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
        master.gain.value = 0.32;
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

    function tone(freq, endFreq, dur, vol, when, type) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime + (when || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.06);
    }

    function chime(freq, dur, vol, when) {
      tone(freq, freq, dur, vol, when, 'sine');
      tone(freq * 2, freq * 2, dur * 0.7, vol * 0.26, when, 'sine');
      tone(freq * 3, freq * 3, dur * 0.42, vol * 0.1, when, 'sine');
    }

    // 五声音阶：第 n 下取第 n 个音，跳得越多调子越高
    const SCALE = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

    return {
      resume: resume,
      start: function () {
        [0, 4, 7].forEach(function (s, i) { chime(523.25 * Math.pow(2, s / 12), 0.5, 0.10, i * 0.08); });
      },
      jump: function () { tone(430, 780, 0.13, 0.075, 0, 'triangle'); },
      land: function () { tone(190, 150, 0.10, 0.04, 0, 'sine'); },
      whoosh: function () {
        tone(1100, 260, 0.17, 0.045, 0, 'triangle');
        tone(700, 200, 0.15, 0.028, 0.01, 'sine');
      },
      clear: function (n) {
        chime(SCALE[n % SCALE.length], 0.7, 0.085, 0);
      },
      tierUp: function () {
        [0, 4, 7, 12].forEach(function (s, i) { chime(659.25 * Math.pow(2, s / 12), 0.85, 0.105, i * 0.085); });
      },
      fail: function () {
        tone(340, 300, 0.16, 0.085, 0, 'sawtooth');
        tone(280, 200, 0.30, 0.085, 0.15, 'sine');
        tone(210, 130, 0.50, 0.075, 0.34, 'sine');
      },
      record: function () {
        [0, 4, 7, 12, 16].forEach(function (s, i) { chime(523.25 * Math.pow(2, s / 12), 1.0, 0.095, i * 0.10); });
      },
    };
  })();

  // ---------------------------------------------------------------- 小女孩
  // 局部坐标：(0,0) = 双脚站的地面，向上为负；s.height 是起跳离地高度
  function drawGirlFigure(g, L, s) {
    const G = L.girl;
    const lift = s.height;
    const tuck = s.tuck;
    const hipY = G.hipY - lift;
    const shY = G.shoulderY - lift;
    const headY = G.headCY - lift;
    const handY = G.handY;
    const skinLine = darken(C.skin, 0.20);

    // ---- 腿 + 袜子 + 鞋（空中收腿：脚抬得比身体快）
    [-1, 1].forEach(function (side) {
      const hip = { x: side * G.legHalf, y: hipY };
      const kneeG = { x: side * G.legHalf * 1.10, y: G.hipY + 76 - lift };
      const kneeT = { x: side * G.legHalf * 1.95, y: G.hipY + 44 - lift };
      const footG = { x: side * G.legHalf * 1.20, y: -2 };
      const footT = { x: side * G.legHalf * 1.50, y: G.hipY + 26 - lift };
      const knee = { x: lerp(kneeG.x, kneeT.x, tuck), y: lerp(kneeG.y, kneeT.y, tuck) };
      const foot = { x: lerp(footG.x, footT.x, tuck), y: lerp(footG.y, footT.y, tuck) };
      const ankle = { x: lerp(knee.x, foot.x, 0.74), y: lerp(knee.y, foot.y, 0.74) };

      limb(g, [hip, knee, ankle], 19, C.skin);
      // 袜子到脚踝上方就收住（再往下会被鞋盖住），鞋底正好落在地面线上
      limb(g, [ankle, { x: foot.x, y: foot.y - 6 }], 16, C.sock);
      g.fillStyle(C.shoe, 1);
      g.fillEllipse(foot.x + side * 3, foot.y - 10.5, 42, 25);
      g.lineStyle(2, C.shoeDark, 0.9);
      g.strokeEllipse(foot.x + side * 3, foot.y - 10.5, 42, 25);
      g.fillStyle(C.sock, 0.9);
      g.fillEllipse(foot.x + side * 3 - side * 8, foot.y - 13, 16, 9);
    });

    // ---- 裙子
    const hemY = hipY + 54;
    const hemL = { x: -72, y: hemY };
    const hemR = { x: 72, y: hemY };
    const hem = cubicPts(hemL, { x: -40, y: hemY + 18 }, { x: 40, y: hemY + 18 }, hemR, 14);
    const bodyPts = [{ x: -G.shoulderHalf - 5, y: shY + 2 }]
      .concat(hem, [{ x: G.shoulderHalf + 5, y: shY + 2 }]);
    g.fillStyle(C.dress, 1);
    fillPts(g, bodyPts);
    g.lineStyle(2.5, C.dressDark, 1);
    strokePts(g, bodyPts, true);

    g.fillStyle(C.dressLight, 0.55);
    fillPts(g, [
      { x: -G.shoulderHalf - 1, y: shY + 7 },
      { x: -30, y: hemY - 4 },
      { x: 30, y: hemY - 4 },
      { x: G.shoulderHalf + 1, y: shY + 7 },
    ]);

    // 白领口
    g.fillStyle(0xFFFFFF, 0.95);
    g.fillTriangle(-17, shY + 1, 0, shY + 17, 17, shY + 1);

    // 腰带 + 腰上的小蝴蝶结
    g.fillStyle(C.dressDark, 0.95);
    g.fillRoundedRect(-52, hipY + 2, 104, 9, 4);
    g.fillStyle(C.accent, 1);
    g.fillTriangle(-4, hipY + 7, -20, hipY - 2, -20, hipY + 16);
    g.fillTriangle(4, hipY + 7, 20, hipY - 2, 20, hipY + 16);
    g.fillStyle(darken(C.accent, 0.15), 1);
    g.fillCircle(0, hipY + 7, 6);

    // 裙上小波点
    g.fillStyle(0xFFFFFF, 0.55);
    g.fillCircle(-28, hemY - 18, 5);
    g.fillCircle(16, hemY - 9, 5.5);
    g.fillCircle(46, hemY - 22, 4.5);

    // ---- 手臂：肩膀随身体走，手（绳把）固定不动
    [-1, 1].forEach(function (side) {
      const shoulder = { x: side * G.shoulderHalf, y: shY + 12 };
      const hand = s.armsDown
        ? { x: side * (G.shoulderHalf + 12), y: hipY + 30 }
        : { x: side * L.handHalf, y: handY };
      const c1 = { x: side * (G.shoulderHalf + 18), y: shY + 46 };
      const c2 = s.armsDown
        ? { x: side * (G.shoulderHalf + 30), y: hipY - 4 }
        : { x: side * (L.handHalf + 16), y: handY - 36 };
      limb(g, cubicPts(shoulder, c1, c2, hand, 14), 13.5, C.skin);
      g.fillStyle(C.dress, 1);
      g.fillCircle(shoulder.x, shoulder.y, 11);
      g.fillStyle(darken(C.skin, 0.07), 1);
      g.fillCircle(hand.x, hand.y, 9.5);
      g.lineStyle(1.5, skinLine, 0.75);
      g.strokeCircle(hand.x, hand.y, 9.5);
    });

    // ---- 头
    g.fillStyle(darken(C.hair, 0.08), 1);
    g.fillCircle(0, headY - 2, G.headR + 7);

    // 鬓角头发
    [-1, 1].forEach(function (side) {
      g.fillStyle(C.hair, 1);
      g.fillEllipse(side * (G.headR - 3), headY + 18, 34, 68);
      g.fillEllipse(side * (G.headR + 4), headY + 48, 26, 42);
    });

    // 马尾（右侧，随起落甩动）
    const swing = s.swing || 0;
    const base = { x: G.headR + 4, y: headY - 6 };
    const tail = cubicPts(
      base,
      { x: base.x + 40, y: base.y + 8 + swing * 10 },
      { x: base.x + 54 + swing * 26, y: base.y + 54 },
      { x: base.x + 22 + swing * 44, y: base.y + 88 },
      14,
    );
    limb(g, tail, 26, C.hair);
    limb(g, tail.slice(5), 9, C.hairLight);

    // 脸
    g.fillStyle(C.skin, 1);
    g.fillCircle(0, headY, G.headR);
    g.lineStyle(2, skinLine, 0.65);
    g.strokeCircle(0, headY, G.headR);

    // 刘海
    g.fillStyle(C.hair, 1);
    g.fillCircle(-24, headY - 30, 16);
    g.fillCircle(0, headY - 39, 17);
    g.fillCircle(24, headY - 30, 16);
    g.fillCircle(-40, headY - 12, 12);
    g.fillCircle(40, headY - 12, 12);

    // 马尾上的蝴蝶结
    g.fillStyle(C.dress, 1);
    g.fillTriangle(base.x - 5, base.y - 3, base.x - 25, base.y - 15, base.x - 25, base.y + 11);
    g.fillTriangle(base.x + 5, base.y - 3, base.x + 25, base.y - 15, base.x + 25, base.y + 11);
    g.fillStyle(C.dressDark, 1);
    g.fillCircle(base.x, base.y, 6);

    // 眼睛
    const eyeY = headY + 2;
    const ex = 19;
    if (s.face === 'sad') {
      g.lineStyle(3.4, C.eye, 1);
      strokePts(g, arcPts(-ex, eyeY + 5, 8, Math.PI * 1.15, Math.PI * 1.85, 10), false);
      strokePts(g, arcPts(ex, eyeY + 5, 8, Math.PI * 1.15, Math.PI * 1.85, 10), false);
    } else if (s.blink) {
      g.lineStyle(3.4, C.eye, 1);
      strokePts(g, [{ x: -ex - 7, y: eyeY }, { x: -ex + 7, y: eyeY }], false);
      strokePts(g, [{ x: ex - 7, y: eyeY }, { x: ex + 7, y: eyeY }], false);
    } else {
      g.fillStyle(C.eye, 1);
      g.fillEllipse(-ex, eyeY, 12, 15);
      g.fillEllipse(ex, eyeY, 12, 15);
      g.fillStyle(0xFFFFFF, 0.9);
      g.fillCircle(-ex + 2.6, eyeY - 3, 2.6);
      g.fillCircle(ex + 2.6, eyeY - 3, 2.6);
    }

    // 腮红
    g.fillStyle(C.blush, 0.5);
    g.fillEllipse(-34, headY + 17, 20, 12);
    g.fillEllipse(34, headY + 17, 20, 12);

    // 嘴
    g.lineStyle(3, C.mouth, 1);
    if (s.face === 'sad') {
      strokePts(g, arcPts(0, headY + 38, 9, Math.PI * 1.15, Math.PI * 1.85, 10), false);
    } else {
      strokePts(g, arcPts(0, headY + 19, 10, Math.PI * 0.18, Math.PI * 0.82, 12), false);
    }
  }

  // ---------------------------------------------------------------- 场景
  class JumpRopeScene extends Phaser.Scene {
    constructor() {
      super('JumpRopeScene');
    }

    create() {
      this.L = computeLayout();
      this.best = this.loadBest();

      this.buildBackdrop();
      this.buildGirl();
      this.buildRope();
      this.buildFx();
      this.buildHud();
      this.bindInput();
      this.scheduleBlink();

      this.keys = this.input.keyboard
        ? this.input.keyboard.addKeys({ space: Phaser.Input.Keyboard.KeyCodes.SPACE })
        : null;

      this.reset();
    }

    // -------------------------------------------------- 背景
    buildBackdrop() {
      const L = this.L;
      const g = this.add.graphics().setDepth(DEPTH.sky);

      // 天空（横向色带，不用渐变）
      const bands = 30;
      for (let i = 0; i < bands; i += 1) {
        const t = i / (bands - 1);
        g.fillStyle(blend(C.sky1, C.sky2, t), 1);
        const y0 = Math.floor((L.groundY * i) / bands);
        const y1 = Math.ceil((L.groundY * (i + 1)) / bands);
        g.fillRect(0, y0, WIDTH, y1 - y0 + 1);
      }

      // 太阳
      g.fillStyle(C.sun, 0.45);
      g.fillCircle(438, 132, 76);
      g.fillStyle(C.sun, 0.75);
      g.fillCircle(438, 132, 52);

      // 云（慢慢飘）
      const cloud = (x, y, s) => {
        const c = this.add.graphics().setDepth(DEPTH.sky + 0.1);
        c.fillStyle(C.cloud, 0.92);
        c.fillEllipse(0, 0, 132 * s, 56 * s);
        c.fillEllipse(-36 * s, 7 * s, 86 * s, 42 * s);
        c.fillEllipse(40 * s, 5 * s, 76 * s, 38 * s);
        c.setPosition(x, y);
        return c;
      };
      const c1 = cloud(112, 246, 1);
      const c2 = cloud(408, 330, 0.72);
      this.tweens.add({ targets: c1, x: 182, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: c2, x: 340, duration: 12000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

      // 地面
      g.fillStyle(C.ground, 1);
      g.fillRect(0, L.groundY, WIDTH, HEIGHT - L.groundY);
      g.fillStyle(C.grass, 1);
      g.fillRect(0, L.groundY - 11, WIDTH, 17);
      g.fillStyle(C.grassDark, 0.85);
      g.fillRect(0, L.groundY + 6, WIDTH, 5);
      g.fillStyle(C.groundEdge, 0.5);
      g.fillRect(0, L.groundY + 11, WIDTH, 2);

      // 草簇
      for (let i = 0; i < 14; i += 1) {
        const bx = 14 + i * 40 + (i % 3) * 7;
        const h = 9 + (i % 3) * 4;
        g.fillStyle(C.grassDark, 0.9);
        g.fillTriangle(bx, L.groundY - 8, bx + 5, L.groundY - 8 - h, bx + 10, L.groundY - 8);
      }

      // 两朵小花点缀
      [[74, 806], [468, 838]].forEach((p) => {
        const [fx, fy] = p;
        g.lineStyle(4, C.grassDark, 1);
        strokePts(g, [{ x: fx, y: fy + 26 }, { x: fx, y: fy }], false);
        g.fillStyle(0xFFFFFF, 1);
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          g.fillCircle(fx + Math.cos(a) * 9, fy + Math.sin(a) * 9, 7);
        }
        g.fillStyle(C.accent, 1);
        g.fillCircle(fx, fy, 5);
      });
    }

    // -------------------------------------------------- 女孩 / 绳子 / 特效
    buildGirl() {
      this.girlG = this.add.graphics();
      this.girlRoot = this.add.container(this.L.cx, this.L.groundY, [this.girlG]).setDepth(DEPTH.girl);
      this.girlKey = '';
    }

    buildRope() {
      this.ropeBackG = this.add.graphics().setDepth(DEPTH.ropeBack);
      this.ropeFrontG = this.add.graphics().setDepth(DEPTH.ropeFront);
    }

    buildFx() {
      this.shadowG = this.add.graphics().setDepth(DEPTH.shadow);
      this.ringG = this.add.graphics().setDepth(DEPTH.fx);
    }

    // -------------------------------------------------- 顶部信息
    buildHud() {
      const L = this.L;
      this.pillG = this.add.graphics().setDepth(DEPTH.ui - 0.5);
      this.dotsG = this.add.graphics().setDepth(DEPTH.ui - 0.5);

      this.tierText = this.add.text(L.hud.pad + L.hud.pillW / 2, L.hud.row1Y, '', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '22px', fontStyle: 'bold',
        color: '#6E5680',
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.bestText = this.add.text(WIDTH - L.hud.pad, L.hud.row1Y, '', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '19px',
        color: '#8A76A0',
      }).setOrigin(1, 0.5).setDepth(DEPTH.ui);

      this.countText = this.add.text(WIDTH / 2, L.hud.countY, '', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '58px', fontStyle: 'bold',
        color: '#FF8A48', stroke: '#FFFFFF', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.tipText = this.add.text(WIDTH / 2, L.tipY, '', {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '21px', fontStyle: 'bold',
        color: '#9A7B5E',
      }).setOrigin(0.5).setDepth(DEPTH.ui);
    }

    // -------------------------------------------------- 输入
    bindInput() {
      this.input.on('pointerdown', () => this.onTap());
    }

    onTap() {
      Sound.resume();
      if (this.state === 'ready') {
        this.startRun();
        return;
      }
      if (this.state === 'over') {
        if (this.cardShown) this.restart();
        return;
      }
      // 刚重启的这几百毫秒内不再接受起跳，免得结算那次点按漏进来白送一跳
      if (this.time.now < this.tapLockUntil) return;
      if (this.airborne) return;
      this.jumpStart = this.elapsed;
      this.airborne = true;
      Sound.jump();
    }

    scheduleBlink() {
      this.time.delayedCall(1800 + Math.random() * 2600, () => {
        if (!this.scene.isActive()) return;
        this.blinkUntil = this.time.now + 140;
        this.scheduleBlink();
      });
    }

    // -------------------------------------------------- 局流程
    reset() {
      const L = this.L;
      this.state = 'ready';
      this.tier = 0;
      this.jumps = 0;
      this.jumpsInTier = 0;
      this.T = TIERS[0];
      this.elapsed = 0;
      this.nextCrossAt = 0;
      this.psi = READY_PSI;
      this.height = 0;
      this.tuck = 0;
      this.swing = 0;
      this.airborne = false;
      this.jumpStart = -1e9;
      this.face = 'happy';
      this.ringT = 0;
      this.blinkUntil = 0;
      this.cardShown = false;
      this.tapLockUntil = 0;
      this.girlKey = '';
      this.girlRoot.setPosition(L.cx, L.groundY);
      this.girlRoot.setRotation(0);
      this.updateHud();
      this.updateTip();
      this.render(0);
    }

    startRun() {
      Sound.resume();
      Sound.start();
      this.state = 'playing';
      this.tier = 0;
      this.jumps = 0;
      this.jumpsInTier = 0;
      this.T = TIERS[0];
      this.elapsed = 0;
      this.nextCrossAt = this.T * LEAD_RATIO;
      this.psi = READY_PSI;
      this.height = 0;
      this.tuck = 0;
      this.airborne = false;
      this.jumpStart = -1e9;
      this.face = 'happy';
      this.girlKey = '';
      this.updateHud();
      this.updateTip();
    }

    restart() {
      if (this.state !== 'over') return;
      this.clearCard();
      this.reset();
      this.startRun();
      this.tapLockUntil = this.time.now + 400;
    }

    // 某一时刻小女孩离地多高（解析式，跟帧率无关，判定才准）
    heightAt(t) {
      if (this.jumpStart < 0) return 0;
      const u = (t - this.jumpStart) / JUMP_MS;
      if (u <= 0 || u >= 1) return 0;
      return JUMP_H * 4 * u * (1 - u);
    }

    judge(t) {
      const h = Math.max(
        this.heightAt(t - GRACE_MS),
        this.heightAt(t),
        this.heightAt(t + GRACE_MS),
      );
      return h >= CLEAR_MIN;
    }

    success() {
      this.jumps += 1;
      this.jumpsInTier += 1;
      this.ringT = 1;
      Sound.clear(this.jumps);
      this.sparkle();
      this.tweens.killTweensOf(this.countText);
      this.countText.setScale(1);
      this.tweens.add({
        targets: this.countText, scaleX: 1.14, scaleY: 1.14,
        duration: 90, yoyo: true, ease: 'Sine.Out',
      });
      if (this.jumpsInTier >= CLEARS_PER_TIER && this.tier < TIERS.length - 1) this.nextTier();
      this.updateHud();
      this.updateTip();
    }

    nextTier() {
      const oldT = this.T;
      this.tier += 1;
      this.jumpsInTier = 0;
      this.T = TIERS[this.tier];
      // 按新速度缩放「距下次过绳还有多久」，绳子的相位就不会跳一下
      this.nextCrossAt = this.elapsed + (this.nextCrossAt - this.elapsed) * (this.T / oldT);
      Sound.tierUp();
      this.showBanner('第 ' + (this.tier + 1) + ' 档 · 快一点啦！');
    }

    fail() {
      if (this.state !== 'playing') return;
      this.state = 'over';
      this.face = 'sad';
      this.airborne = false;
      this.height = 0;
      this.tuck = 0;
      this.swing = 0;
      this.girlKey = '';
      Sound.fail();
      this.updateTip();

      // 绊到脚：抖两下
      this.tweens.add({
        targets: this.girlRoot,
        x: this.L.cx + 6,
        duration: 70,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.InOut',
        onComplete: () => {
          if (this.girlRoot && this.girlRoot.active) this.girlRoot.x = this.L.cx;
        },
      });

      this.time.delayedCall(1000, () => {
        if (this.state === 'over') this.showCard();
      });
    }

    // -------------------------------------------------- 结算
    showCard() {
      if (this.cardShown) return;
      this.cardShown = true;

      const L = this.L;
      const w = L.card.w;
      const h = L.card.h;
      const x = (WIDTH - w) / 2;
      const y = (HEIGHT - h) / 2 - 30;
      const prevBest = this.best;
      const isRecord = this.jumps > prevBest;
      if (isRecord && this.jumps > 0) {
        this.best = this.jumps;
        this.saveBest(this.jumps);
        Sound.record();
      }

      this.cardG = this.add.graphics().setDepth(DEPTH.overlay);
      const g = this.cardG;
      g.fillStyle(C.card, 0.42);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xFFFFFF, 0.98);
      g.fillRoundedRect(x, y, w, h, 30);
      g.lineStyle(3, C.accentSoft, 1);
      g.strokeRoundedRect(x, y, w, h, 30);

      const mk = (ty, text, size, color, bold) => this.add.text(WIDTH / 2, ty, text, {
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: size + 'px',
        fontStyle: bold ? 'bold' : 'normal',
        color: color,
        align: 'center',
      }).setOrigin(0.5).setDepth(DEPTH.overlay + 1);

      const items = [];
      items.push(mk(y + 52, '本轮结束', 26, '#8A76A0', true));
      items.push(mk(y + 128, '跳了 ' + this.jumps + ' 下', 46, '#FF8A48', true));
      items.push(mk(y + 190, '到达第 ' + (this.tier + 1) + ' 档（共 ' + TIERS.length + ' 档）', 19, '#6E5680'));

      if (isRecord && this.jumps > 0) {
        items.push(mk(y + 246, '🎉 新纪录！', 26, '#E0689F', true));
        items.push(mk(y + 292, prevBest > 0 ? '上次最好 ' + prevBest + ' 下' : '第一次就这么棒！', 16, '#A48AB8'));
      } else {
        items.push(mk(y + 246, '最高纪录 ' + this.best + ' 下', 22, '#6E5680', true));
        items.push(mk(y + 292, this.jumps > 0 ? '再快一点就能破纪录啦' : '绳子扫到脚边就点屏幕', 16, '#A48AB8'));
      }

      const btnY = y + h - 78;
      // 按钮只做视觉提示：重启统一走场景级的点击（if 里已经 return），
      // 不给它单独绑 pointerdown，否则会和场景点击重复触发、开局白送一次起跳
      const btn = this.add.rectangle(WIDTH / 2, btnY, 232, 62, C.accent, 1)
        .setStrokeStyle(3, C.accentSoft, 0.95)
        .setDepth(DEPTH.overlay + 1);
      const btnText = mk(btnY, '再跳一次', 24, '#FFFFFF', true);
      btnText.setDepth(DEPTH.overlay + 2);
      items.push(btn, btnText);
      items.push(mk(y + h - 26, '点屏幕也可以', 15, '#B6A6C6'));

      this.cardItems = items;
      this.autoTimer = this.time.delayedCall(RESTART_MS, () => this.restart());
    }

    clearCard() {
      if (this.autoTimer) {
        this.autoTimer.remove(false);
        this.autoTimer = null;
      }
      if (this.cardG) {
        this.cardG.destroy();
        this.cardG = null;
      }
      if (this.cardItems) {
        this.cardItems.forEach((it) => { if (it && it.active) it.destroy(); });
        this.cardItems = null;
      }
      this.cardShown = false;
    }

    showBanner(text) {
      const t = this.add.text(WIDTH / 2, 320, text, {
        fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '30px', fontStyle: 'bold',
        color: '#FF8A48', stroke: '#FFFFFF', strokeThickness: 7,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1).setScale(0.7);
      this.tweens.add({
        targets: t, y: 272, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out',
      });
      this.tweens.add({
        targets: t, alpha: 0, delay: 900, duration: 520,
        onComplete: () => { if (t.active) t.destroy(); },
      });
    }

    sparkle() {
      const L = this.L;
      for (let i = 0; i < 4; i += 1) {
        const g = this.add.graphics().setDepth(DEPTH.fx);
        g.fillStyle(C.spark, 0.95);
        fillPts(g, starPts(7 + Math.random() * 3));
        g.setPosition(L.cx + (Math.random() - 0.5) * 110, L.groundY - 26 - Math.random() * 46);
        this.tweens.add({
          targets: g,
          x: g.x + (Math.random() - 0.5) * 70,
          y: g.y - 42 - Math.random() * 34,
          alpha: 0,
          scaleX: 0.4,
          scaleY: 0.4,
          duration: 480 + Math.random() * 240,
          ease: 'Sine.Out',
          onComplete: () => { if (g.active) g.destroy(); },
        });
      }
    }

    // -------------------------------------------------- 顶部刷新
    updateHud() {
      const L = this.L;
      this.tierText.setText('第 ' + (this.tier + 1) + ' 档');
      this.bestText.setText('最高 ' + Math.max(this.best, this.jumps) + ' 下');
      this.countText.setText(this.jumps + ' 下');

      const g = this.pillG;
      g.clear();
      g.fillStyle(C.ui, 0.72);
      g.fillRoundedRect(L.hud.pad, L.hud.row1Y - L.hud.pillH / 2, L.hud.pillW, L.hud.pillH, 14);
      g.lineStyle(2, C.uiLine, 1);
      g.strokeRoundedRect(L.hud.pad, L.hud.row1Y - L.hud.pillH / 2, L.hud.pillW, L.hud.pillH, 14);

      const d = this.dotsG;
      d.clear();
      const gap = 24;
      const startX = WIDTH / 2 - (gap * (CLEARS_PER_TIER - 1)) / 2;
      const done = Math.min(this.jumpsInTier, CLEARS_PER_TIER);
      for (let i = 0; i < CLEARS_PER_TIER; i += 1) {
        const dcx = startX + i * gap;
        if (i < done) {
          d.fillStyle(C.accent, 1);
          d.fillCircle(dcx, L.hud.dotsY, 8.5);
        } else {
          d.fillStyle(C.ui, 0.75);
          d.fillCircle(dcx, L.hud.dotsY, 7);
          d.lineStyle(2, C.uiLine, 1);
          d.strokeCircle(dcx, L.hud.dotsY, 7);
        }
      }
    }

    updateTip() {
      if (this.state === 'ready') {
        this.tipText.setText('点一下屏幕开始').setAlpha(1);
        return;
      }
      if (this.state === 'over') {
        this.tipText.setAlpha(0);
        return;
      }
      if (this.tier === 0) {
        this.tipText.setText('绳子扫到脚边就点屏幕！').setAlpha(this.jumps < 4 ? 1 : 0.5);
      } else {
        this.tipText.setText('跟着节奏跳！').setAlpha(0.38);
      }
    }

    // -------------------------------------------------- 存档
    loadBest() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return 0;
        const data = JSON.parse(raw);
        const v = Number(data && data.best);
        return isFinite(v) && v > 0 ? Math.floor(v) : 0;
      } catch (e) {
        return 0;
      }
    }

    saveBest(v) {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ best: v, v: 1 }));
      } catch (e) { /* 存不了就算了 */ }
    }

    // -------------------------------------------------- 每帧
    update(time, delta) {
      const dt = Math.min(delta || 16, 60);

      if (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.space)) this.onTap();

      this.blinkOn = time < this.blinkUntil;

      if (this.state === 'playing') {
        this.elapsed += dt;

        while (this.state === 'playing' && this.elapsed >= this.nextCrossAt) {
          const crossAt = this.nextCrossAt;
          const ok = this.judge(crossAt);
          this.nextCrossAt += this.T;
          if (ok) {
            this.success();
            Sound.whoosh();
          } else {
            this.fail();
          }
        }

        if (this.state === 'playing') {
          // ψ 随时间递减：绳子从身后升起、在身前落下，ψ≡0 时正好扫到脚下
          this.psi = (Math.PI * 2 * (this.nextCrossAt - this.elapsed)) / this.T;
        }
      }

      if (this.airborne) {
        const u = (this.elapsed - this.jumpStart) / JUMP_MS;
        if (u >= 1) {
          this.airborne = false;
          this.height = 0;
          this.tuck = 0;
          this.swing = 0;
          Sound.land();
        } else {
          this.height = JUMP_H * 4 * u * (1 - u);
          this.tuck = this.height / JUMP_H;
          this.swing = (u - 0.5) * 1.1;
        }
      }

      this.render(dt);
    }

    render(dt) {
      this.drawShadow();
      this.drawGirl();
      this.drawRope();
      this.drawRing(dt);
    }

    drawShadow() {
      const g = this.shadowG;
      const L = this.L;
      g.clear();
      const k = 1 - Math.min(0.5, (this.height / JUMP_H) * 0.5);
      g.fillStyle(C.shadow, 0.2 * k);
      g.fillEllipse(L.cx, L.groundY + 7, 124 * k, 27 * k);
    }

    drawGirl() {
      const key = [
        Math.round(this.height), this.face, this.blinkOn ? 1 : 0, this.state,
      ].join('|');
      if (key === this.girlKey) return;
      this.girlKey = key;

      const g = this.girlG;
      g.clear();
      drawGirlFigure(g, this.L, {
        height: this.height,
        tuck: this.tuck,
        swing: this.swing,
        face: this.face,
        blink: this.blinkOn,
        armsDown: this.state === 'over',
      });
    }

    // 绳子弧：t=0 右手 → t=0.5 弧的最低/最高点 → t=1 左手
    ropeArc(psi, n) {
      const L = this.L;
      const cosP = Math.cos(psi);
      const pts = [];
      for (let i = 0; i <= n; i += 1) {
        const t = i / n;
        const a = Math.PI * t;
        pts.push({
          x: L.cx + L.handHalf * Math.cos(a),
          y: L.handY + L.ropeR * Math.sin(a) * cosP,
        });
      }
      return pts;
    }

    drawRope() {
      const L = this.L;
      this.ropeBackG.clear();
      this.ropeFrontG.clear();

      if (this.state === 'over') {
        this.drawTangled(this.ropeFrontG);
        return;
      }

      const psi = this.psi;
      const inFront = Math.sin(psi) >= 0;
      const g = inFront ? this.ropeFrontG : this.ropeBackG;

      // 拖影（比本体慢一点点，看出在转）
      g.lineStyle(6, darken(C.rope, 0.10), 0.16);
      strokePts(g, this.ropeArc(psi + 0.20, 26), false);
      // 绳子本体：外描边 + 主色 + 高光
      g.lineStyle(7.4, darken(C.rope, 0.34), 1);
      strokePts(g, this.ropeArc(psi, 34), false);
      g.lineStyle(5.2, C.rope, 1);
      strokePts(g, this.ropeArc(psi, 34), false);
      g.lineStyle(2, C.ropeLight, 0.8);
      strokePts(g, this.ropeArc(psi, 34), false);

      // 两头的绳把（永远咬在手上）
      [-1, 1].forEach((side) => {
        const hx = L.cx + side * L.handHalf;
        const hy = L.handY;
        g.fillStyle(C.handle, 1);
        g.fillCircle(hx, hy, 9);
        g.lineStyle(2, C.handleDark, 1);
        g.strokeCircle(hx, hy, 9);
        g.fillStyle(C.ropeLight, 0.9);
        g.fillCircle(hx, hy, 3.4);
      });
    }

    // 绊到之后：绳子瘫在脚前
    drawTangled(g) {
      const L = this.L;
      const pts = [];
      for (let i = 0; i <= 24; i += 1) {
        const t = i / 24;
        pts.push({
          x: L.cx - 142 + 284 * t,
          y: L.groundY - 5 - 34 * Math.sin(Math.PI * t),
        });
      }
      g.lineStyle(7.4, darken(C.rope, 0.34), 1);
      strokePts(g, pts, false);
      g.lineStyle(5.2, C.rope, 1);
      strokePts(g, pts, false);
      g.lineStyle(2, C.ropeLight, 0.75);
      strokePts(g, pts, false);
    }

    drawRing(dt) {
      const g = this.ringG;
      const L = this.L;
      g.clear();
      if (this.ringT <= 0) return;
      this.ringT = Math.max(0, this.ringT - dt / 420);
      const k = 1 - this.ringT;
      const rx = 108 + 96 * k;
      const ry = 26 + 24 * k;
      g.lineStyle(7, 0xFFFFFF, 0.34 * this.ringT);
      g.strokeEllipse(L.cx, L.groundY + 5, rx, ry);
      g.lineStyle(4, C.accent, 0.5 * this.ringT);
      g.strokeEllipse(L.cx, L.groundY + 5, rx, ry);
    }
  }

  window.JumpRopeScene = JumpRopeScene;
})();
