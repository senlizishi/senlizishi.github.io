/*
 * Tug-of-war arithmetic game for ages 5+: 540x960 portrait, Phaser.Graphics only.
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TITLE_FONT = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "Microsoft YaHei", serif';

  const WIN_STEPS = 3;
  const ANSWER_MIN = 1;
  const ANSWER_MAX = 10;
  const CAP_MIN = 5;
  const CAP_MAX = 10;
  const CAP_CURVE = [5, 5, 6, 6, 7, 7, 8, 8, 9, 10];
  const SUB_MAX = 4;
  const CARD_COLS = 5;
  const CARD_ROWS = 2;
  const CARD_W = 82;
  const CARD_H = 86;
  const CARD_GAP_X = 11;
  const CARD_GAP_Y = 24;
  const OPTION_COUNT = 10;
  const PULL_SEC = 0.56;
  const REVEAL_SEC = 0.92;
  const WRONG_REVEAL_SEC = 1.6;
  const START_BANNER_SEC = 0.8;
  const TAP_LOCK = 0.45;
  const TEAM_MOVE = 18;
  const ROPE_STEP = 47;

  const TEXT = Object.freeze({
    title: '拔河算一算',
    redTeam: '红队',
    blueTeam: '蓝队',
    goalHint: '答对拉一格 · 先到 3 格获胜',
    readyTitle: '红队和蓝队要拔河啦',
    readyLine1: '答对一题：红队拉一格',
    readyLine2: '答错一题：蓝队拉一格',
    readyLine3: '先把绳子拉到 3 格的一队获胜',
    start: '开始拔河',
    startBanner: '开始！',
    instruction: '点一张数字卡，选出答案',
    correct: '答对啦！红队拉一格',
    wrongPrefix: '正确答案是 ',
    redWin: '红队赢啦！',
    blueWin: '蓝队先拉过去啦',
    redWinSub: '红队三格全满，太棒啦！',
    blueWinSub: '这次差一点点，再来一局吧',
    retry: '再来一局',
    tapRetry: '点屏幕也可以重新开始',
  });

  const C = {
    skyTop: 0x9FDDF5,
    skyBottom: 0xEAF9FF,
    sun: 0xFFD76A,
    cloud: 0xFFFFFF,
    hillFar: 0x9FD2B0,
    hillNear: 0x78B96C,
    field: 0xA8D98A,
    fieldLight: 0xBFE7A2,
    fieldDark: 0x84C16C,
    dirt: 0xE5C79A,
    dirtLight: 0xF3DDBA,
    cream: 0xFFF8EA,
    paper: 0xFFFDF8,
    panel: 0xFFF1D9,
    ink: 0x563B2D,
    inkSoft: 0x816852,
    red: 0xE95F63,
    redDark: 0xA93C48,
    redLight: 0xFFB2AE,
    blue: 0x4D8CE4,
    blueDark: 0x2F5EAA,
    blueLight: 0xAED2FF,
    gold: 0xF0C04E,
    goldDark: 0xB77A21,
    goldLight: 0xFFE9A7,
    rope: 0xB9783F,
    ropeDark: 0x7B4A2A,
    ropeLight: 0xE2B77E,
    green: 0x75BC6E,
    greenDark: 0x4F8F4D,
    greenLight: 0xD9F1D0,
    coral: 0xEB766C,
    coralDark: 0xB54D4E,
    shadow: 0x3D2A24,
    dust: 0xEAD2A6,
    white: 0xFFFFFF,
  };

  const DEPTH = {
    background: 0,
    field: 2,
    panel: 3,
    fx: 12,
    hud: 20,
    text: 21,
    overlay: 40,
    overlayText: 41,
  };

  function computeLayout() {
    const cardXs = [];
    for (let col = 0; col < CARD_COLS; col++) {
      cardXs.push(84 + col * (CARD_W + CARD_GAP_X));
    }
    const cardYs = [700, 700 + CARD_H + CARD_GAP_Y];
    const cards = [];
    for (let row = 0; row < CARD_ROWS; row++) {
      for (let col = 0; col < CARD_COLS; col++) {
        cards.push({
          value: row * CARD_COLS + col + 1,
          x: cardXs[col],
          y: cardYs[row],
          w: CARD_W,
          h: CARD_H,
        });
      }
    }
    return {
      title: { x: 270, y: 42 },
      redHud: { x: 16, y: 76, w: 154, h: 42 },
      blueHud: { x: 370, y: 76, w: 154, h: 42 },
      goalHint: { x: 270, y: 97 },
      field: { x: 14, y: 132, w: 512, h: 376, ropeY: 300, groundY: 407 },
      rope: { centerX: 270, left: 44, right: 496, step: ROPE_STEP },
      teamShift: TEAM_MOVE,
      targets: { red: 270 - ROPE_STEP * WIN_STEPS, blue: 270 + ROPE_STEP * WIN_STEPS },
      lower: { y: 500, top: 510 },
      equation: { x: 40, y: 530, w: 460, h: 90, cy: 575, ansX: 380 },
      feedback: { x: 270, y: 638 },
      instruction: { x: 270, y: 514 },
      cards: cards,
      cardTextYOffset: 5,
      readyCard: { x: 270, y: 706, w: 436, h: 388 },
      readyButton: { x: 270, y: 808, w: 236, h: 64 },
      resultCard: { x: 270, y: 480, w: 430, h: 380 },
      resultButton: { x: 270, y: 594, w: 226, h: 56 },
      footer: { x: 270, y: 900 },
    };
  }

  const L = computeLayout();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function pointInRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function capFor(correct) {
    const n = Math.max(0, Math.floor(Number(correct) || 0));
    return n >= CAP_CURVE.length ? CAP_MAX : CAP_CURVE[n];
  }

  function operationFor(qi) {
    const n = Math.max(0, Math.floor(Number(qi) || 0));
    if (n < 2) return 'add';
    return n % 2 === 0 ? 'sub' : 'add';
  }

  function questionKey(q) { return q.op + ':' + q.a + ':' + q.b; }

  function usedHas(used, key) {
    if (!used) return false;
    for (let i = 0; i < used.length; i++) {
      const item = used[i];
      if (typeof item === 'string' ? item === key : item && questionKey(item) === key) return true;
    }
    return false;
  }

  function makeQuestion(qi, cap, used) {
    const lim = clamp(Number(cap) || CAP_MIN, CAP_MIN, CAP_MAX);
    const op = operationFor(qi);
    const candidates = [];
    if (op === 'add') {
      for (let a = 1; a <= lim - 1; a++) {
        for (let b = 1; b <= lim - a; b++) {
          if (a + b >= 2) candidates.push({ op: 'add', a: a, b: b, answer: a + b });
        }
      }
    } else {
      for (let a = 3; a <= lim; a++) {
        const maxB = Math.min(SUB_MAX, a - 1);
        for (let b = 1; b <= maxB; b++) {
          candidates.push({ op: 'sub', a: a, b: b, answer: a - b });
        }
      }
    }
    if (!candidates.length) {
      const fallback = op === 'add' ? { op: 'add', a: 1, b: 2, answer: 3 } : { op: 'sub', a: 4, b: 1, answer: 3 };
      fallback.key = questionKey(fallback);
      fallback.cap = lim;
      return fallback;
    }
    const fresh = candidates.filter(function (q) { return !usedHas(used, questionKey(q)); });
    const pool = fresh.length ? fresh : candidates;
    const picked = pool[Math.floor(Math.random() * pool.length)] || pool[0];
    return {
      op: picked.op,
      a: picked.a,
      b: picked.b,
      answer: picked.answer,
      key: questionKey(picked),
      cap: lim,
    };
  }

  const Sound = (function () {
    let ctx = null;
    let master = null;

    function ensure() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) {
          ctx = new AC();
          master = ctx.createGain();
          master.gain.value = 0.42;
          master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      } catch (e) { return null; }
    }

    function tone(freq, dur, vol, delay, type) {
      const c = ensure();
      if (!c || !master) return;
      try {
        const t = c.currentTime + (delay || 0);
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.025), t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.18));
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + (dur || 0.18) + 0.04);
      } catch (e) { /* ignore */ }
    }

    function sweep(from, to, dur, vol, type) {
      const c = ensure();
      if (!c || !master) return;
      try {
        const t = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(from, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + (dur || 0.2));
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.025), t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + (dur || 0.2) + 0.04);
      } catch (e) { /* ignore */ }
    }

    return {
      resume: function () { ensure(); },
      tap: function () { tone(720, 0.06, 0.018, 0, 'sine'); tone(920, 0.05, 0.01, 0.025, 'sine'); },
      pullRed: function () { sweep(210, 330, 0.22, 0.025, 'triangle'); tone(392, 0.12, 0.018, 0.06, 'sine'); },
      pullBlue: function () { sweep(220, 145, 0.24, 0.022, 'triangle'); tone(196, 0.13, 0.014, 0.05, 'sine'); },
      correct: function () {
        tone(523.25, 0.18, 0.025, 0, 'triangle');
        tone(659.25, 0.2, 0.025, 0.075, 'triangle');
        tone(783.99, 0.3, 0.028, 0.15, 'sine');
      },
      wrong: function () {
        tone(246.94, 0.16, 0.015, 0, 'sine');
        tone(196.0, 0.2, 0.013, 0.09, 'sine');
      },
      next: function () { tone(540, 0.07, 0.012, 0, 'triangle'); },
      win: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.55, 0.025, i * 0.08, i < 3 ? 'triangle' : 'sine');
      },
      softLose: function () {
        const notes = [392, 349.23, 293.66, 261.63];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.55, 0.016, i * 0.1, 'sine');
      },
    };
  })();

  function drawCloud(g, x, y, scale, alpha) {
    g.fillStyle(C.cloud, alpha == null ? 0.8 : alpha);
    g.fillEllipse(x, y, 64 * scale, 19 * scale);
    g.fillEllipse(x - 21 * scale, y - 8 * scale, 36 * scale, 23 * scale);
    g.fillEllipse(x + 18 * scale, y - 5 * scale, 42 * scale, 25 * scale);
  }

  function drawStar(g, x, y, r, color, alpha) {
    g.fillStyle(color, alpha == null ? 1 : alpha);
    g.fillTriangle(x, y - r, x + r * 0.74, y + r * 0.44, x - r * 0.74, y + r * 0.44);
    g.fillTriangle(x, y + r, x - r * 0.62, y - r * 0.35, x + r * 0.62, y - r * 0.35);
  }

  function drawFlag(g, x, y, color) {
    g.lineStyle(3, C.ropeDark, 0.9);
    g.lineBetween(x, y + 20, x, y - 40);
    g.fillStyle(color, 1);
    g.fillTriangle(x + 2, y - 39, x + 37, y - 28, x + 2, y - 14);
    g.fillStyle(0xFFFFFF, 0.34);
    g.fillCircle(x + 2, y - 39, 3);
  }

  function drawBackground(g) {
    g.clear();
    g.fillGradientStyle(C.skyTop, C.skyTop, C.skyBottom, C.skyBottom, 1);
    g.fillRect(0, 0, WIDTH, 520);
    g.fillStyle(0xFFF4BF, 0.18);
    g.fillCircle(463, 69, 59);
    g.fillStyle(C.sun, 1);
    g.fillCircle(463, 69, 35);
    g.fillStyle(0xFFFFFF, 0.48);
    g.fillCircle(451, 57, 10);
    drawCloud(g, 95, 71, 0.9, 0.68);
    drawCloud(g, 337, 110, 0.58, 0.5);
    drawCloud(g, 215, 166, 0.45, 0.38);

    g.fillStyle(C.hillFar, 0.92);
    g.fillEllipse(72, 276, 290, 122);
    g.fillEllipse(480, 272, 300, 135);
    g.fillStyle(C.hillNear, 0.94);
    g.fillEllipse(268, 296, 470, 105);

    g.fillStyle(C.field, 1);
    g.fillRoundedRect(0, 292, WIDTH, 238, 24);
    g.fillStyle(C.fieldLight, 0.34);
    for (let i = 0; i < 7; i++) g.fillRect(24 + i * 92, 298, 46, 225);
    g.fillStyle(C.fieldDark, 0.36);
    g.fillRect(0, 459, WIDTH, 17);
    g.fillStyle(C.dirt, 0.82);
    g.fillEllipse(270, 407, 342, 76);
    g.fillStyle(C.dirtLight, 0.46);
    g.fillEllipse(270, 398, 270, 50);

    g.lineStyle(4, 0xFFFFFF, 0.32);
    g.lineBetween(64, 407, 476, 407);
    g.lineStyle(2, 0xFFFFFF, 0.24);
    g.lineBetween(270, 360, 270, 455);

    for (let i = 0; i < 8; i++) {
      const x = 34 + i * 68;
      g.fillStyle(C.ropeLight, 0.86);
      g.fillRect(x, 224, 5, 45);
      g.fillTriangle(x - 2, 224, x + 7, 224, x + 2, 214);
    }
    g.lineStyle(1.4, 0x8A6847, 0.32);
    g.lineBetween(18, 230, 522, 230);

    for (let i = 0; i < 12; i++) {
      const x = 20 + i * 46;
      g.lineStyle(1.6, C.greenDark, 0.32);
      g.lineBetween(x, 475, x + 3, 451 - (i % 3) * 4);
    }

    g.fillGradientStyle(0xFFF6E5, 0xFFF6E5, 0xFFEBD0, 0xFFEBD0, 1);
    g.fillRect(0, 500, WIDTH, 460);
    g.fillStyle(0xE7C99E, 0.32);
    g.fillRect(0, 500, WIDTH, 8);
    for (let i = 0; i < 34; i++) {
      const x = 22 + ((i * 83) % 500);
      const y = 524 + ((i * 57) % 392);
      g.fillStyle(i % 2 ? C.white : C.goldLight, 0.16);
      g.fillCircle(x, y, 2 + (i % 3));
    }
  }

  function drawKid(g, x, y, team, index, lean, hop) {
    const isRed = team === 'red';
    const dir = isRed ? 1 : -1;
    const jersey = isRed ? C.red : C.blue;
    const jerseyDark = isRed ? C.redDark : C.blueDark;
    const shorts = isRed ? 0x6E3140 : 0x284D8A;
    const skinColors = [0xFFD6B5, 0xEAB58D, 0xFFE0C3];
    const hairColors = [0x593A30, 0x2F2727, 0x7A4C31];
    const skin = skinColors[index % skinColors.length];
    const hair = hairColors[(index + (isRed ? 0 : 1)) % hairColors.length];
    const h = hop || 0;
    const headX = x + (lean || 0);
    const headY = y - 61 - h;
    const bodyX = x + (lean || 0) * 0.36;
    const bodyY = y - 31 - h;
    const handX = x + dir * (23 + index * 2) + (lean || 0) * 0.2;
    const handY = 300 + (index - 1) * 5 - h * 0.25;

    g.fillStyle(C.shadow, 0.17);
    g.fillEllipse(x, y + 9, 42, 11);
    g.lineStyle(6, skin, 1);
    g.lineBetween(x - 7, y - 8 - h, x - 10, y + 3 - h);
    g.lineBetween(x + 7, y - 8 - h, x + 10, y + 3 - h);
    g.fillStyle(0xF7F2E9, 1);
    g.fillEllipse(x - 11, y + 5 - h, 17, 8);
    g.fillEllipse(x + 11, y + 5 - h, 17, 8);
    g.fillStyle(jerseyDark, 1);
    g.fillEllipse(x - 10, y + 6 - h, 15, 6);
    g.fillEllipse(x + 10, y + 6 - h, 15, 6);

    g.lineStyle(7, skin, 1);
    g.lineBetween(bodyX - dir * 9, bodyY - 18, handX - dir * 5, handY + 4);
    g.lineStyle(5.5, skin, 1);
    g.lineBetween(bodyX + dir * 7, bodyY - 17, handX + dir * 3, handY + 2);

    g.fillStyle(jersey, 1);
    g.fillRoundedRect(bodyX - 15, bodyY - 18, 30, 32, 11);
    g.fillStyle(jerseyDark, 0.36);
    g.fillRoundedRect(bodyX - 15, bodyY + 2, 30, 12, 7);
    g.fillStyle(shorts, 1);
    g.fillRoundedRect(bodyX - 15, bodyY + 10, 30, 17, 7);
    g.fillStyle(0xFFFFFF, 0.88);
    g.fillCircle(bodyX + index * 2 - 2, bodyY - 5, 5.2);

    g.fillStyle(skin, 1);
    g.fillCircle(headX, headY, 16);
    g.fillStyle(hair, 1);
    g.fillEllipse(headX - (isRed ? 1 : -1), headY - 11, 29, 15);
    if ((index + (isRed ? 0 : 1)) % 3 === 0) {
      g.fillCircle(headX - dir * 12, headY - 17, 6);
    }
    g.fillStyle(0x3E2A24, 1);
    g.fillCircle(headX + dir * 5, headY - 2, 2.1);
    g.fillCircle(headX + dir * 11, headY - 2, 1.9);
    g.fillStyle(0xE78A91, 0.65);
    g.fillCircle(headX + dir * 2, headY + 7, 2.5);
    g.lineStyle(1.3, 0x835046, 0.55);
    g.lineBetween(headX + dir * 4, headY + 9, headX + dir * 9, headY + 8);

    g.fillStyle(skin, 1);
    g.fillCircle(handX, handY, 5);
    g.fillStyle(0xFFFFFF, 0.28);
    g.fillCircle(handX - 1, handY - 2, 1.5);
  }

  function drawRopeAndTargets(g, visualPosition, strain, feedbackKind) {
    const center = L.rope.centerX;
    const ropeY = L.field.ropeY;
    const knotX = center - visualPosition * L.rope.step;

    for (let side = -1; side <= 1; side += 2) {
      for (let step = 1; step <= WIN_STEPS; step++) {
        const x = center + side * step * L.rope.step;
        const target = step === WIN_STEPS;
        g.lineStyle(target ? 3 : 1.7, target ? (side < 0 ? C.red : C.blue) : C.ropeDark, target ? 0.8 : 0.34);
        g.lineBetween(x, ropeY - 17, x, ropeY + 20);
        g.fillStyle(target ? C.goldLight : C.ropeLight, target ? 0.9 : 0.6);
        g.fillCircle(x, ropeY - 18, target ? 4.5 : 2.5);
      }
    }
    drawFlag(g, L.targets.red, 218, C.red);
    drawFlag(g, L.targets.blue, 218, C.blue);

    g.lineStyle(10, C.ropeDark, 0.9);
    g.lineBetween(L.rope.left, ropeY, L.rope.right, ropeY);
    g.lineStyle(6, C.rope, 1);
    g.lineBetween(L.rope.left, ropeY, L.rope.right, ropeY);
    for (let i = 0; i < 25; i++) {
      const x = 57 + i * 18;
      g.lineStyle(2.2, i % 2 ? 0xFFF3D7 : C.ropeLight, 0.86);
      g.lineBetween(x, ropeY - 3, x + 4, ropeY + 3);
    }

    const pull = Math.max(0, strain || 0);
    const ribbonOffset = feedbackKind === 'correct' ? -3 : feedbackKind === 'wrong' ? 3 : 0;
    g.fillStyle(C.red, 0.95);
    g.fillTriangle(knotX + ribbonOffset, ropeY - 30 + pull * 2, knotX - 17, ropeY - 17, knotX + 17, ropeY - 17);
    g.fillStyle(C.blue, 0.95);
    g.fillTriangle(knotX + ribbonOffset, ropeY + 30 - pull * 2, knotX - 17, ropeY + 17, knotX + 17, ropeY + 17);
    g.fillStyle(C.goldLight, 1);
    g.fillCircle(knotX + ribbonOffset, ropeY, 8);
    g.fillStyle(C.goldDark, 1);
    g.fillCircle(knotX + ribbonOffset, ropeY, 3.2);
  }

  class TugMathScene extends Phaser.Scene {
    constructor() { super('TugMathScene'); }

    create() {
      this.CONST = {
        WIDTH: WIDTH,
        HEIGHT: HEIGHT,
        WIN_STEPS: WIN_STEPS,
        ANSWER_MIN: ANSWER_MIN,
        ANSWER_MAX: ANSWER_MAX,
        CAP_MIN: CAP_MIN,
        CAP_MAX: CAP_MAX,
        CARD_COLS: CARD_COLS,
        CARD_ROWS: CARD_ROWS,
        REVEAL_SEC: REVEAL_SEC,
        WRONG_REVEAL_SEC: WRONG_REVEAL_SEC,
        TAP_LOCK: TAP_LOCK,
        LAYOUT: JSON.parse(JSON.stringify(L)),
        TEXT: Object.assign({}, TEXT),
      };
      this.PALETTE = C;
      this.L = L;

      this.clock = 0;
      this.stage = 'ready';
      this.qi = 0;
      this.cap = capFor(0);
      this.position = 0;
      this.prevPosition = 0;
      this.correct = 0;
      this.wrong = 0;
      this.questions = 0;
      this.winner = null;
      this.question = makeQuestion(0, this.cap, []);
      this.usedKeys = [];
      this.feedback = null;
      this.pendingWinner = null;
      this.busy = false;
      this.actionT = 0;
      this.startBannerT = 0;
      this.tapLockUntil = 0;
      this.cardSelected = -1;
      this.liveProps = [];
      this.fxParticles = [];
      this.textObjs = [];
      this.renderReady = false;

      this.bgG = this.add.graphics().setDepth(DEPTH.background);
      this.fieldG = this.add.graphics().setDepth(DEPTH.field);
      this.panelG = this.add.graphics().setDepth(DEPTH.panel);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.overlayG = this.add.graphics().setDepth(DEPTH.overlay);
      drawBackground(this.bgG);
      this.buildTexts();

      this.renderReady = true;
      this.render();
      this.input.on('pointerdown', this.onPointerDown, this);
      this.events.once('shutdown', this.onShutdown.bind(this));
      Sound.resume();
    }

    buildTexts() {
      const add = function (scene, x, y, text, size, color, opts) {
        const o = opts || {};
        const style = {
          fontFamily: o.title ? TITLE_FONT : FONT,
          fontSize: size + 'px',
          fontStyle: o.weight || 'normal',
          color: color,
          align: o.align || 'center',
        };
        if (o.stroke) {
          style.stroke = o.stroke;
          style.strokeThickness = o.strokeThickness || 3;
        }
        const t = scene.add.text(x, y, text, style).setOrigin(0.5).setDepth(o.depth == null ? DEPTH.text : o.depth);
        scene.textObjs.push(t);
        return t;
      };

      this.titleText = add(this, L.title.x, L.title.y, TEXT.title, 34, '#A33B42', {
        title: true, weight: 'bold', stroke: '#FFF8E8', strokeThickness: 5,
      });
      this.redHudText = add(this, 68, L.redHud.y + 21, TEXT.redTeam + '  0 / 3', 18, '#FFF8E8', { weight: 'bold' });
      this.blueHudText = add(this, 462, L.blueHud.y + 21, TEXT.blueTeam + '  0 / 3', 18, '#FFF8E8', { weight: 'bold' });
      this.goalHintText = add(this, L.goalHint.x, L.goalHint.y, TEXT.goalHint, 14, '#70543E', { weight: 'bold' });

      this.eqA = add(this, 142, L.equation.cy, '', 54, '#563B2D', { weight: 'bold' });
      this.eqOp = add(this, 205, L.equation.cy, '+', 54, '#E88934', { weight: 'bold' });
      this.eqB = add(this, 264, L.equation.cy, '', 54, '#563B2D', { weight: 'bold' });
      this.eqEq = add(this, 318, L.equation.cy, '=', 54, '#563B2D', { weight: 'bold' });
      this.eqAns = add(this, L.equation.ansX, L.equation.cy, '?', 52, '#8A6548', { weight: 'bold' });
      this.feedbackText = add(this, L.feedback.x, L.feedback.y, '', 17, '#6C533E', { weight: 'bold' });
      this.instructionText = add(this, L.instruction.x, L.instruction.y, TEXT.instruction, 15, '#7D624C', {});

      this.cardTexts = [];
      for (let i = 0; i < L.cards.length; i++) {
        this.cardTexts.push(add(this, L.cards[i].x, L.cards[i].y + L.cardTextYOffset, String(i + 1), 40, '#5B4231', { weight: 'bold' }));
      }

      this.readyTitleText = add(this, 270, 552, TEXT.readyTitle, 28, '#A23B43', { title: true, weight: 'bold', depth: DEPTH.overlayText });
      this.readyLine1Text = add(this, 270, 614, TEXT.readyLine1, 18, '#5F4735', { depth: DEPTH.overlayText });
      this.readyLine2Text = add(this, 270, 652, TEXT.readyLine2, 18, '#5F4735', { depth: DEPTH.overlayText });
      this.readyLine3Text = add(this, 270, 690, TEXT.readyLine3, 16, '#87654A', { depth: DEPTH.overlayText });
      this.startText = add(this, L.readyButton.x, L.readyButton.y, TEXT.start, 24, '#FFF8E8', { weight: 'bold', depth: DEPTH.overlayText });
      this.startBannerText = add(this, 270, 468, TEXT.startBanner, 54, '#A43D43', {
        title: true, weight: 'bold', stroke: '#FFF8E8', strokeThickness: 6, depth: DEPTH.overlayText,
      });

      this.overTitleText = add(this, 270, 344, '', 30, '#A43D43', { title: true, weight: 'bold', depth: DEPTH.overlayText });
      this.overSubText = add(this, 270, 452, '', 17, '#6A513C', { depth: DEPTH.overlayText });
      this.overStatsText = add(this, 270, 492, '', 17, '#8A6548', { weight: 'bold', depth: DEPTH.overlayText });
      this.retryText = add(this, L.resultButton.x, L.resultButton.y, TEXT.retry, 21, '#FFF8E8', { weight: 'bold', depth: DEPTH.overlayText });
      this.overHintText = add(this, 270, 642, TEXT.tapRetry, 13, '#92765C', { depth: DEPTH.overlayText });
    }

    resetRound() {
      this.stage = 'ready';
      this.qi = 0;
      this.cap = capFor(0);
      this.position = 0;
      this.prevPosition = 0;
      this.correct = 0;
      this.wrong = 0;
      this.questions = 0;
      this.winner = null;
      this.usedKeys = [];
      this.question = makeQuestion(0, this.cap, this.usedKeys);
      this.feedback = null;
      this.pendingWinner = null;
      this.busy = false;
      this.actionT = 0;
      this.startBannerT = 0;
      this.tapLockUntil = 0;
      this.cardSelected = -1;
      this.fxParticles.length = 0;
      this.clearLiveProps();
    }

    startGame() {
      if (this.stage !== 'ready') return false;
      this.position = 0;
      this.prevPosition = 0;
      this.correct = 0;
      this.wrong = 0;
      this.questions = 0;
      this.qi = 0;
      this.cap = capFor(0);
      this.winner = null;
      this.feedback = null;
      this.pendingWinner = null;
      this.cardSelected = -1;
      this.usedKeys = [];
      this.question = this.makeQuestion(0, this.cap, this.usedKeys);
      this.usedKeys.push(this.question.key);
      this.fxParticles.length = 0;
      this.clearLiveProps();
      this.stage = 'play';
      this.busy = true;
      this.startBannerT = START_BANNER_SEC;
      this.actionT = 0;
      this.tapLockUntil = 0;
      Sound.resume();
      Sound.tap();
      this.render();
      return true;
    }

    makeQuestion(qi, cap, used) {
      return makeQuestion(qi, cap, used);
    }

    holdTime() {
      if (!this.feedback) return 0;
      return this.feedback.kind === 'correct' ? REVEAL_SEC : WRONG_REVEAL_SEC;
    }

    answer(value) {
      if (this.stage === 'ready' || this.stage === 'over') return 'invalid';
      if (this.stage !== 'play' || this.busy) return 'busy';
      const number = Number(value);
      if (!Number.isInteger(number) || number < ANSWER_MIN || number > ANSWER_MAX) return 'invalid';

      const isCorrect = number === this.question.answer;
      Sound.tap();
      this.prevPosition = this.position;
      this.position += isCorrect ? 1 : -1;
      this.position = clamp(this.position, -WIN_STEPS, WIN_STEPS);
      this.questions += 1;
      if (isCorrect) this.correct += 1;
      else this.wrong += 1;
      this.cardSelected = number;
      this.feedback = {
        kind: isCorrect ? 'correct' : 'wrong',
        selected: number,
        answer: this.question.answer,
        a: this.question.a,
        b: this.question.b,
        op: this.question.op,
      };
      this.pendingWinner = this.position >= WIN_STEPS ? 'red' : this.position <= -WIN_STEPS ? 'blue' : null;
      this.stage = 'pulling';
      this.busy = true;
      this.actionT = 0;

      const direction = isCorrect ? -1 : 1;
      this.spawnDust(270 + direction * 62, 415, isCorrect ? 9 : 7);
      if (isCorrect) {
        this.spawnStars(270, 196, 12, false);
        Sound.correct();
        Sound.pullRed();
      } else {
        this.spawnStars(270, 202, 5, true);
        Sound.wrong();
        Sound.pullBlue();
      }
      this.render();
      return isCorrect ? 'correct' : 'wrong';
    }

    nextQuestion() {
      if (this.stage !== 'pulling') return false;
      this.qi += 1;
      this.cap = capFor(this.correct);
      this.question = this.makeQuestion(this.qi, this.cap, this.usedKeys);
      this.usedKeys.push(this.question.key);
      this.prevPosition = this.position;
      this.feedback = null;
      this.pendingWinner = null;
      this.cardSelected = -1;
      this.actionT = 0;
      this.busy = false;
      this.stage = 'play';
      Sound.next();
      this.render();
      return true;
    }

    finish(winner) {
      if (this.stage === 'over') return false;
      this.winner = winner === 'blue' ? 'blue' : 'red';
      this.position = this.winner === 'red' ? WIN_STEPS : -WIN_STEPS;
      this.prevPosition = this.position;
      this.stage = 'over';
      this.busy = false;
      this.pendingWinner = null;
      this.tapLockUntil = this.clock + TAP_LOCK;
      if (this.winner === 'red') {
        this.spawnConfetti(76, 'red');
        Sound.win();
      } else {
        this.spawnConfetti(34, 'blue');
        Sound.softLose();
      }
      this.render();
      return true;
    }

    tryRestart() {
      if (this.stage !== 'over' || this.clock < this.tapLockUntil) return false;
      this.resetRound();
      this.startGame();
      return true;
    }

    cardAt(x, y) {
      for (let i = 0; i < L.cards.length; i++) {
        const c = L.cards[i];
        if (pointInRect(x, y, c.x - c.w / 2, c.y - c.h / 2, c.w, c.h)) return c.value;
      }
      return -1;
    }

    onPointerDown(pointer) {
      Sound.resume();
      const x = Number(pointer && pointer.x) || 0;
      const y = Number(pointer && pointer.y) || 0;
      if (this.stage === 'ready') {
        const b = L.readyButton;
        if (pointInRect(x, y, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h)) return this.startGame();
        return false;
      }
      if (this.stage === 'over') {
        if (this.clock < this.tapLockUntil) return false;
        return this.tryRestart();
      }
      if (this.stage !== 'play' || this.busy) return false;
      const value = this.cardAt(x, y);
      if (value < 0) return false;
      const result = this.answer(value);
      return result === 'correct' || result === 'wrong';
    }

    update(time, delta) {
      this.step((Number(delta) || 16.7) / 1000);
    }

    step(dt, skipRender) {
      const delta = Math.max(0, Math.min(0.05, Number(dt) || 0));
      this.clock += delta;
      if (this.startBannerT > 0) {
        this.startBannerT = Math.max(0, this.startBannerT - delta);
        if (this.startBannerT === 0) this.busy = false;
      }
      if (this.stage === 'pulling') {
        this.actionT += delta;
        if (this.actionT >= this.holdTime()) {
          if (this.pendingWinner) this.finish(this.pendingWinner);
          else this.nextQuestion();
        }
      }
      this.updateFx(delta);
      if (!skipRender) this.render();
    }

    simulate(seconds) {
      let remaining = Math.max(0, Number(seconds) || 0);
      let guard = 0;
      while (remaining > 0 && guard < 4000) {
        const delta = Math.min(0.033, remaining);
        this.step(delta, true);
        remaining -= delta;
        guard += 1;
      }
      this.render();
      return true;
    }

    spawnDust(x, y, count) {
      const n = Math.max(1, count || 6);
      for (let i = 0; i < n; i++) {
        this.fxParticles.push({
          x: x + (Math.random() - 0.5) * 30,
          y: y + Math.random() * 7,
          vx: (Math.random() - 0.5) * 42,
          vy: -18 - Math.random() * 24,
          gravity: 38,
          life: 0.35 + Math.random() * 0.3,
          maxLife: 0.65,
          color: i % 3 === 0 ? C.dust : C.dirtLight,
          size: 3 + Math.random() * 5,
          shape: 'circle',
        });
      }
    }

    spawnStars(x, y, count, quiet) {
      const n = Math.max(1, count || 10);
      const colors = quiet ? [C.blueLight, 0xDDEBFF, C.white, C.goldLight] : [C.gold, C.goldLight, C.redLight, C.white, C.greenLight];
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + Math.random() * 0.45;
        const speed = 38 + Math.random() * 64;
        this.fxParticles.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 32,
          gravity: 78,
          life: 0.55 + Math.random() * 0.55,
          maxLife: 1.1,
          color: colors[i % colors.length],
          size: 2.5 + Math.random() * 3.4,
          shape: i % 3 === 0 ? 'star' : 'circle',
        });
      }
    }

    spawnConfetti(count, team) {
      const n = Math.max(1, count || 48);
      const colors = team === 'blue'
        ? [C.blueLight, 0xDCEEFF, C.white, C.goldLight, 0xC4D5F5]
        : [C.red, C.redLight, C.gold, C.goldLight, C.greenLight, C.white, 0xFFD4A8];
      for (let i = 0; i < n; i++) {
        this.fxParticles.push({
          x: 24 + Math.random() * (WIDTH - 48),
          y: -20 - Math.random() * 160,
          vx: (Math.random() - 0.5) * 44,
          vy: 64 + Math.random() * 76,
          gravity: 24,
          life: 2.1 + Math.random() * 1.5,
          maxLife: 3.6,
          color: colors[i % colors.length],
          size: 3 + Math.random() * 4,
          shape: i % 4 === 0 ? 'star' : i % 3 === 0 ? 'circle' : 'rect',
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 4.5,
        });
      }
    }

    updateFx(dt) {
      for (let i = this.fxParticles.length - 1; i >= 0; i--) {
        const p = this.fxParticles[i];
        p.life -= dt;
        if (p.life <= 0) { this.fxParticles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.rot != null) p.rot += p.vr * dt;
        if (p.x < -30 || p.x > WIDTH + 30 || p.y > HEIGHT + 40) this.fxParticles.splice(i, 1);
      }
    }

    trackObj(obj) { if (obj) this.liveProps.push(obj); return obj; }
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

    onShutdown() {
      this.clearLiveProps();
      for (let i = 0; i < this.textObjs.length; i++) {
        if (this.textObjs[i] && this.textObjs[i].destroy) this.textObjs[i].destroy();
      }
      this.textObjs.length = 0;
      this.fxParticles.length = 0;
      if (this.input && this.input.off) this.input.off('pointerdown', this.onPointerDown, this);
    }
    setText(obj, value) {
      if (obj && obj.text !== value) obj.setText(value);
    }

    setTextColor(obj, color) {
      if (obj && obj.setColor) obj.setColor(color);
    }

    visualPosition() {
      if (this.stage === 'pulling' && this.feedback) {
        const p = clamp(this.actionT / PULL_SEC, 0, 1);
        let value = lerp(this.prevPosition, this.position, easeOutCubic(p));
        if (p < 1) {
          const dir = this.feedback.kind === 'correct' ? -1 : 1;
          value += dir * 0.12 * Math.sin(p * Math.PI * 3) * (1 - p);
        }
        return value;
      }
      return this.position;
    }

    pullStrain() {
      if (this.stage !== 'pulling') return 0;
      const p = clamp(this.actionT / PULL_SEC, 0, 1);
      return Math.sin(p * Math.PI);
    }

    render() {
      if (!this.renderReady) return;
      this.fieldG.clear();
      this.panelG.clear();
      this.fxG.clear();
      this.overlayG.clear();
      const visual = this.visualPosition();
      this.drawFieldScene(this.fieldG, visual);
      if (this.stage !== 'ready') this.drawLowerPanel(this.panelG);
      this.drawFx();
      this.updateTexts(visual);
      if (this.stage === 'ready') this.drawReadyOverlay(this.overlayG);
      if (this.stage === 'over') this.drawResultOverlay(this.overlayG);
      if (this.startBannerT > 0 && this.stage === 'play') this.drawStartBanner(this.overlayG);
    }

    drawFieldScene(g, visual) {
      const strain = this.pullStrain();
      drawRopeAndTargets(g, visual, strain, this.feedback ? this.feedback.kind : null);

      const slide = -visual * L.teamShift;
      const lean = -visual * 3.4 + (this.feedback ? (this.feedback.kind === 'correct' ? -6.5 : 6.5) * strain : 0);
      const redXs = [76, 116, 156];
      const blueXs = [464, 424, 384];
      const redYs = [373, 366, 374];
      const blueYs = [374, 367, 373];
      const redWon = this.stage === 'over' && this.winner === 'red';
      const blueWon = this.stage === 'over' && this.winner === 'blue';

      for (let i = 0; i < 3; i++) {
        const hop = redWon ? Math.abs(Math.sin(this.clock * 7 + i * 0.75)) * 12 : Math.sin(this.clock * 2.1 + i) * 0.9;
        drawKid(g, blueXs[i] + slide, blueYs[i], 'blue', i, lean + (strain ? 2.5 : 0), hop);
      }
      for (let i = 0; i < 3; i++) {
        const hop = redWon ? Math.abs(Math.sin(this.clock * 7 + i * 0.75)) * 12 : Math.sin(this.clock * 2.1 + i + 1) * 0.9;
        drawKid(g, redXs[i] + slide, redYs[i], 'red', i, lean - (strain ? 2.5 : 0), hop);
      }

      this.drawTeamHud(g);
    }

    drawTeamHud(g) {
      const red = L.redHud;
      const blue = L.blueHud;
      g.fillStyle(C.shadow, 0.16);
      g.fillRoundedRect(red.x + 1, red.y + 4, red.w, red.h, red.h / 2);
      g.fillRoundedRect(blue.x + 1, blue.y + 4, blue.w, blue.h, blue.h / 2);
      g.fillStyle(C.red, 1);
      g.fillRoundedRect(red.x, red.y, red.w, red.h, red.h / 2);
      g.fillStyle(C.blue, 1);
      g.fillRoundedRect(blue.x, blue.y, blue.w, blue.h, blue.h / 2);
      g.fillStyle(0xFFFFFF, 0.16);
      g.fillRoundedRect(red.x + 8, red.y + 5, red.w - 16, 9, 5);
      g.fillRoundedRect(blue.x + 8, blue.y + 5, blue.w - 16, 9, 5);

      const redDotsX = red.x + red.w - 38;
      const blueDotsX = blue.x + 18;
      const redWon = Math.max(0, this.position);
      const blueWon = Math.max(0, -this.position);
      for (let i = 0; i < WIN_STEPS; i++) {
        g.fillStyle(i < redWon ? C.goldLight : 0xFFFFFF, i < redWon ? 1 : 0.3);
        g.fillCircle(redDotsX + i * 12, red.y + red.h / 2, 3.6);
        g.fillStyle(i < blueWon ? C.goldLight : 0xFFFFFF, i < blueWon ? 1 : 0.3);
        g.fillCircle(blueDotsX + i * 12, blue.y + blue.h / 2, 3.6);
      }
    }

    drawLowerPanel(g) {
      g.fillStyle(C.cream, 0.82);
      g.fillRoundedRect(118, 498, 304, 31, 16);
      g.fillStyle(C.shadow, 0.14);
      g.fillRoundedRect(L.equation.x + 3, L.equation.y + 6, L.equation.w, L.equation.h, 22);
      g.fillStyle(C.cream, 0.98);
      g.fillRoundedRect(L.equation.x, L.equation.y, L.equation.w, L.equation.h, 22);
      g.lineStyle(2, 0xE5C493, 0.8);
      g.strokeRoundedRect(L.equation.x, L.equation.y, L.equation.w, L.equation.h, 22);
      g.fillStyle(0xFFFFFF, 0.54);
      g.fillRoundedRect(L.equation.x + 13, L.equation.y + 11, L.equation.w - 26, 8, 4);

      const ax = L.equation.ansX;
      const ay = L.equation.cy;
      g.fillStyle(0xFFF3D6, 1);
      g.fillRoundedRect(ax - 38, ay - 35, 76, 70, 16);
      g.lineStyle(2.4, this.feedback ? C.green : 0xD8B77B, 0.95);
      g.strokeRoundedRect(ax - 38, ay - 35, 76, 70, 16);

      for (let i = 0; i < L.cards.length; i++) this.drawOptionCard(g, i);
    }

    drawOptionCard(g, index) {
      const card = L.cards[index];
      const value = card.value;
      const answer = this.question ? this.question.answer : -1;
      const feedback = this.feedback;
      const busy = this.stage === 'pulling';
      let fill = C.paper;
      let border = 0xDEC7A4;
      let shadow = C.shadow;
      let textColor = '#5B4231';
      let glow = 0;
      let shake = 0;

      if (busy && feedback) {
        if (feedback.kind === 'correct' && value === feedback.selected) {
          fill = 0xE5F6DF;
          border = C.green;
          textColor = '#3E7A40';
          glow = 0.34;
        } else if (feedback.kind === 'wrong' && value === feedback.selected) {
          fill = 0xFFE1DB;
          border = C.coral;
          textColor = '#B34445';
          const q = clamp(this.actionT / 0.42, 0, 1);
          shake = Math.sin(q * 38) * 6 * (1 - q);
          glow = 0.2;
        } else if (feedback.kind === 'wrong' && value === answer) {
          const pulse = 0.45 + Math.sin(this.clock * 9) * 0.15;
          fill = 0xDFF5D8;
          border = C.green;
          textColor = '#3E7A40';
          glow = pulse;
        }
      }

      const x = card.x + shake;
      const y = card.y;
      const left = x - card.w / 2;
      const top = y - card.h / 2;
      if (glow > 0) {
        g.fillStyle(border, glow * 0.45);
        g.fillRoundedRect(left - 5, top - 5, card.w + 10, card.h + 10, 20);
      }
      g.fillStyle(shadow, 0.16);
      g.fillRoundedRect(left + 2, top + 5, card.w, card.h, 17);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(left, top, card.w, card.h, 17);
      g.lineStyle(2.3, border, 0.95);
      g.strokeRoundedRect(left, top, card.w, card.h, 17);
      g.fillStyle(0xFFFFFF, 0.48);
      g.fillRoundedRect(left + 8, top + 7, card.w - 16, 7, 4);

      if (busy && feedback) {
        const correctCard = (feedback.kind === 'correct' && value === feedback.selected)
          || (feedback.kind === 'wrong' && value === answer);
        const wrongCard = feedback.kind === 'wrong' && value === feedback.selected;
        if (correctCard || wrongCard) {
          const sx = left + card.w - 13;
          const sy = top + 13;
          g.fillStyle(correctCard ? C.green : C.coral, 0.96);
          g.fillCircle(sx, sy, 9.2);
          g.lineStyle(2.3, 0xFFFFFF, 1);
          if (correctCard) {
            g.beginPath();
            g.moveTo(sx - 4, sy);
            g.lineTo(sx - 1, sy + 3);
            g.lineTo(sx + 4.5, sy - 3.5);
            g.strokePath();
          } else {
            g.lineBetween(sx - 3, sy - 3, sx + 3, sy + 3);
            g.lineBetween(sx + 3, sy - 3, sx - 3, sy + 3);
          }
        }
      }

      const text = this.cardTexts[index];
      if (text) {
        text.setPosition(x, y + L.cardTextYOffset);
        this.setTextColor(text, textColor);
      }
    }

    drawReadyOverlay(g) {
      g.fillStyle(0x2B2634, 0.24);
      g.fillRect(0, 492, WIDTH, 468);
      const c = L.readyCard;
      g.fillStyle(C.shadow, 0.2);
      g.fillRoundedRect(c.x - c.w / 2 + 3, c.y - c.h / 2 + 8, c.w, c.h, 28);
      g.fillStyle(C.cream, 0.99);
      g.fillRoundedRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 28);
      g.lineStyle(3, C.gold, 0.9);
      g.strokeRoundedRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 28);
      g.fillStyle(0xFFF0C5, 0.52);
      g.fillRoundedRect(c.x - c.w / 2 + 16, c.y - c.h / 2 + 16, c.w - 32, 11, 6);

      g.lineStyle(4.5, C.rope, 0.82);
      g.lineBetween(140, 734, 400, 734);
      g.fillStyle(C.red, 0.14);
      g.fillCircle(178, 734, 38);
      g.fillStyle(C.blue, 0.14);
      g.fillCircle(362, 734, 38);
      for (let i = 0; i < 3; i++) {
        g.fillStyle(C.red, 1);
        g.fillCircle(154 + i * 24, 734, 7);
        g.fillStyle(C.blue, 1);
        g.fillCircle(338 + i * 24, 734, 7);
      }

      const b = L.readyButton;
      g.fillStyle(C.shadow, 0.18);
      g.fillRoundedRect(b.x - b.w / 2 + 2, b.y - b.h / 2 + 5, b.w, b.h, b.h / 2);
      g.fillStyle(C.red, 1);
      g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h / 2);
      g.lineStyle(2.5, C.goldLight, 0.85);
      g.strokeRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h / 2);
    }

    drawStartBanner(g) {
      const alpha = clamp(this.startBannerT / 0.18, 0, 1);
      g.fillStyle(C.cream, 0.92 * alpha);
      g.fillRoundedRect(158, 408, 224, 113, 26);
      g.lineStyle(2.4, C.gold, 0.88 * alpha);
      g.strokeRoundedRect(158, 408, 224, 113, 26);
    }

    drawResultOverlay(g) {
      g.fillStyle(0x241F2B, 0.48);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      const c = L.resultCard;
      g.fillStyle(C.shadow, 0.24);
      g.fillRoundedRect(c.x - c.w / 2 + 3, c.y - c.h / 2 + 9, c.w, c.h, 28);
      g.fillStyle(C.cream, 1);
      g.fillRoundedRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 28);
      g.lineStyle(3, this.winner === 'red' ? C.red : C.blue, 0.86);
      g.strokeRoundedRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 28);
      g.fillStyle(0xFFF0C7, 0.55);
      g.fillRoundedRect(c.x - c.w / 2 + 16, c.y - c.h / 2 + 16, c.w - 32, 12, 6);

      if (this.winner === 'red') {
        g.fillStyle(C.gold, 1);
        g.fillTriangle(242, 398, 250, 374, 261, 394);
        g.fillTriangle(262, 394, 271, 370, 281, 392);
        g.fillTriangle(281, 392, 291, 374, 299, 398);
        g.fillRoundedRect(242, 395, 57, 13, 5);
        g.fillStyle(C.goldLight, 0.5);
        g.fillCircle(270, 405, 48);
        for (let i = 0; i < 7; i++) {
          const x = 236 + i * 12;
          drawStar(g, x, 410 - (i % 2) * 8, 4.5, C.goldLight, 0.75);
        }
      } else {
        g.fillStyle(C.blueLight, 0.38);
        g.fillCircle(270, 405, 50);
        g.fillStyle(C.blue, 0.92);
        g.fillCircle(250, 405, 17);
        g.fillCircle(270, 396, 21);
        g.fillCircle(291, 406, 16);
        g.fillStyle(C.white, 0.75);
        g.fillCircle(263, 391, 6);
      }

      const b = L.resultButton;
      g.fillStyle(C.shadow, 0.18);
      g.fillRoundedRect(b.x - b.w / 2 + 2, b.y - b.h / 2 + 5, b.w, b.h, b.h / 2);
      g.fillStyle(C.red, 1);
      g.fillRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h / 2);
      g.lineStyle(2.4, C.goldLight, 0.88);
      g.strokeRoundedRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.h / 2);
    }

    drawFx() {
      const g = this.fxG;
      for (let i = 0; i < this.fxParticles.length; i++) {
        const p = this.fxParticles[i];
        const alpha = clamp(p.life / Math.max(0.001, p.maxLife), 0, 1);
        if (p.shape === 'star') {
          drawStar(g, p.x, p.y, p.size, p.color, alpha);
        } else if (p.shape === 'circle') {
          g.fillStyle(p.color, alpha);
          g.fillCircle(p.x, p.y, p.size);
        } else {
          const rot = p.rot || 0;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const w = p.size;
          const h = p.size * 1.7;
          const points = [
            { x: p.x - w * c + h * s, y: p.y - w * s - h * c },
            { x: p.x + w * c + h * s, y: p.y + w * s - h * c },
            { x: p.x + w * c - h * s, y: p.y + w * s + h * c },
            { x: p.x - w * c - h * s, y: p.y - w * s + h * c },
          ];
          g.fillStyle(p.color, alpha);
          g.fillPoints(points, true);
        }
      }
    }

    updateTexts(visual) {
      this.redHudText.setVisible(true);
      this.blueHudText.setVisible(true);
      this.goalHintText.setVisible(true);
      this.setText(this.redHudText, TEXT.redTeam + '  ' + Math.max(0, this.position) + ' / 3');
      this.setText(this.blueHudText, TEXT.blueTeam + '  ' + Math.max(0, -this.position) + ' / 3');
      this.redHudText.setPosition(68, L.redHud.y + 21);
      this.blueHudText.setPosition(462, L.blueHud.y + 21);

      const showGame = this.stage !== 'ready';
      const showEquation = showGame;
      this.eqA.setVisible(showEquation);
      this.eqOp.setVisible(showEquation);
      this.eqB.setVisible(showEquation);
      this.eqEq.setVisible(showEquation);
      this.eqAns.setVisible(showEquation);
      const banner = this.startBannerT > 0 && this.stage === 'play';
      this.feedbackText.setVisible(showEquation && !!this.feedback && this.stage !== 'over' && !banner);
      this.instructionText.setVisible(showEquation && this.stage !== 'over' && !banner);
      for (let i = 0; i < this.cardTexts.length; i++) this.cardTexts[i].setVisible(showGame);

      if (showEquation && this.question) {
        this.setText(this.eqA, String(this.question.a));
        this.setText(this.eqB, String(this.question.b));
        this.setText(this.eqOp, this.question.op === 'add' ? '+' : '\u2212');
        this.setTextColor(this.eqOp, this.question.op === 'add' ? '#E88934' : '#D8708A');
        const answered = !!this.feedback;
        this.setText(this.eqAns, answered ? String(this.question.answer) : '?');
        this.setTextColor(this.eqAns, answered ? '#4F8F4D' : '#8A6548');
        if (this.feedback && this.stage !== 'over') {
          this.setText(this.feedbackText, this.feedback.kind === 'correct'
            ? TEXT.correct
            : TEXT.wrongPrefix + this.feedback.answer);
          this.setTextColor(this.feedbackText, this.feedback.kind === 'correct' ? '#4F8F4D' : '#B44E50');
        }
      }

      const ready = this.stage === 'ready';
      this.readyTitleText.setVisible(ready);
      this.readyLine1Text.setVisible(ready);
      this.readyLine2Text.setVisible(ready);
      this.readyLine3Text.setVisible(ready);
      this.startText.setVisible(ready);

      const over = this.stage === 'over';
      this.overTitleText.setVisible(over);
      this.overSubText.setVisible(over);
      this.overStatsText.setVisible(over);
      this.retryText.setVisible(over);
      this.overHintText.setVisible(over);
      if (over) {
        const red = this.winner === 'red';
        this.setText(this.overTitleText, red ? TEXT.redWin : TEXT.blueWin);
        this.setTextColor(this.overTitleText, red ? '#A43D43' : '#3B68B3');
        this.setText(this.overSubText, red ? TEXT.redWinSub : TEXT.blueWinSub);
        this.setText(this.overStatsText, '答对 ' + this.correct + ' 题 · 答错 ' + this.wrong + ' 题');
      }

      this.startBannerText.setVisible(banner);
      if (banner) this.startBannerText.setAlpha(clamp(this.startBannerT / 0.2, 0, 1));
    }

  }

  window.TugMathScene = TugMathScene;
})();
