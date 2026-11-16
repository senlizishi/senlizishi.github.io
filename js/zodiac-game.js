/*
 * 生肖渡河赛：540x960 竖屏低龄向十二生肖认知小游戏。
 * 三段故事，每段帮四只生肖按顺序坐上木筏过河，最后围成一圈认识生肖循环。
 * 全部画面 Phaser.Graphics 程序化绘制，音效 WebAudio 合成，名称用浏览器中文语音朗读。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const TAU = Math.PI * 2;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TITLE_FONT = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "Microsoft YaHei", serif';

  const CHAPTER_SIZE = 4;
  const CHAPTER_COUNT = 3;
  const TOTAL = 12;
  const DRAG_SCALE = 1.12;
  const TAP_LOCK = 0.5;
  const RAFT_SEC = 0.85;
  const SPEECH_RATE = 0.85;

  const DEPTH = {
    world: 0,
    scene: 2,
    fx: 14,
    hud: 20,
    text: 21,
    drag: 22,
    overlay: 40,
    cardText: 41,
  };

  const ZODIAC = [
    { key: 'rat', name: '鼠', label: '老鼠', order: 1, color: 0xB9C7D2, light: 0xEEF4F7, dark: 0x6D7D89, face: 0xEADBD4, feature: '机灵' },
    { key: 'ox', name: '牛', label: '小牛', order: 2, color: 0xB97C4A, light: 0xE7BD8C, dark: 0x7A4A2A, face: 0xF1D4B0, feature: '勤快' },
    { key: 'tiger', name: '虎', label: '老虎', order: 3, color: 0xE8934A, light: 0xFFC878, dark: 0x9A5528, face: 0xFFE0B0, feature: '勇敢' },
    { key: 'rabbit', name: '兔', label: '小兔', order: 4, color: 0xF2B8C6, light: 0xFFE4EA, dark: 0xC76E84, face: 0xFFF4F6, feature: '温柔' },
    { key: 'dragon', name: '龙', label: '神龙', order: 5, color: 0x5CB7A8, light: 0xA9E3D3, dark: 0x2F786F, face: 0xFFE9AF, feature: '神气' },
    { key: 'snake', name: '蛇', label: '小蛇', order: 6, color: 0x72A95A, light: 0xB8D98E, dark: 0x436B36, face: 0xD9E9B2, feature: '安静' },
    { key: 'horse', name: '马', label: '小马', order: 7, color: 0xB7744D, light: 0xE6B080, dark: 0x76442D, face: 0xF4D1AA, feature: '跑得快' },
    { key: 'goat', name: '羊', label: '小羊', order: 8, color: 0xE6D3A8, light: 0xFFF2CC, dark: 0xA38B5A, face: 0xFFF8E6, feature: '爱吃草' },
    { key: 'monkey', name: '猴', label: '小猴', order: 9, color: 0xA56D4A, light: 0xD9A576, dark: 0x69402E, face: 0xF6C99A, feature: '爱玩耍' },
    { key: 'rooster', name: '鸡', label: '小鸡', order: 10, color: 0xD85A4A, light: 0xFFB15C, dark: 0x92352F, face: 0xFFF0D2, feature: '起得早' },
    { key: 'dog', name: '狗', label: '小狗', order: 11, color: 0xD79D58, light: 0xF5CF8E, dark: 0x8F5D2E, face: 0xFFEAC7, feature: '忠诚' },
    { key: 'pig', name: '猪', label: '小猪', order: 12, color: 0xE89AA8, light: 0xFFCBD3, dark: 0xAD6476, face: 0xFFE2E6, feature: '爱睡觉' },
  ];

  const CHAPTERS = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
  ];

  const THEMES = [
    {
      name: '清晨河岸',
      skyTop: 0xFFE3C7, skyBottom: 0xFFF9E9,
      sun: 0xFFD36A, hillFar: 0xA4CF92, hillNear: 0x7FB77A,
      farBank: 0xC7D99A, farBankDark: 0x94B477,
      nearBank: 0x9BC66F, nearBankDark: 0x6E9D55,
      waterTop: 0x7FD5D4, waterBottom: 0x48A7B4,
      waterLight: 0xC8F5EC, cloud: 0xFFFFFF,
    },
    {
      name: '薄雾河湾',
      skyTop: 0xC9E5EC, skyBottom: 0xF4F9F0,
      sun: 0xFFF0B0, hillFar: 0x9FC9B1, hillNear: 0x72AD93,
      farBank: 0xBDD8A6, farBankDark: 0x88AA7A,
      nearBank: 0x91BE72, nearBankDark: 0x639450,
      waterTop: 0x93CED7, waterBottom: 0x5E9FB7,
      waterLight: 0xE2F7F2, cloud: 0xF8FCFF,
    },
    {
      name: '金色渡口',
      skyTop: 0xFFD088, skyBottom: 0xFFF2CC,
      sun: 0xFFB94E, hillFar: 0xC1B274, hillNear: 0x959F5C,
      farBank: 0xD6C17D, farBankDark: 0xA58D55,
      nearBank: 0xAABE64, nearBankDark: 0x768C45,
      waterTop: 0x7FC9C8, waterBottom: 0x429CA4,
      waterLight: 0xFFF2B2, cloud: 0xFFF7DB,
    },
  ];

  const C = {
    cream: 0xFFF8EA,
    paper: 0xFFFDF5,
    ink: 0x4C4031,
    inkSoft: 0x7C6B55,
    gold: 0xE7B84C,
    goldLight: 0xFFF1B8,
    goldDeep: 0xB77D22,
    red: 0xD9574E,
    redDark: 0x9E3532,
    jade: 0x5DAF91,
    jadeDark: 0x357963,
    blue: 0x5C9FD6,
    shadow: 0x2F2A20,
    waterFoam: 0xD9FFFF,
    silhouette: 0x95A19A,
    silhouetteLight: 0xC5CEC6,
    silhouetteDark: 0x6E7A73,
    silhouetteFace: 0xADB7B0,
    white: 0xFFFFFF,
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pseudo(n) { return (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function pointInRect(x, y, rx, ry, rw, rh) { return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh; }

  function shuffle(list, randomFn) {
    const out = list.slice();
    const rng = typeof randomFn === 'function' ? randomFn : Math.random;
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)) % (i + 1);
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function drawRounded(g, x, y, w, h, r, fill, stroke, fillAlpha, strokeAlpha, lineWidth) {
    g.fillStyle(fill, fillAlpha == null ? 1 : fillAlpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke != null) {
      g.lineStyle(lineWidth == null ? 2 : lineWidth, stroke, strokeAlpha == null ? 1 : strokeAlpha);
      g.strokeRoundedRect(x, y, w, h, r);
    }
  }

  function drawPill(g, x, y, w, h, fill, stroke, fillAlpha, strokeAlpha, lineWidth) {
    drawRounded(g, x - w / 2, y - h / 2, w, h, h / 2, fill, stroke, fillAlpha, strokeAlpha, lineWidth);
  }

  function drawStar(g, x, y, r, color, alpha) {
    const a = alpha == null ? 1 : alpha;
    g.fillStyle(color, a);
    g.fillTriangle(x, y - r, x + r * 0.78, y, x, y + r);
    g.fillTriangle(x, y - r, x - r * 0.78, y, x, y + r);
  }

  function computeLayout() {
    return {
      title: { x: 270, y: 50 },
      subtitle: { x: 270, y: 90 },
      progressText: { x: 270, y: 114 },
      ribbon: { y: 140, startX: 60, step: 38.2, r: 9 },
      chapterPill: { x: 270, y: 184, w: 286, h: 38 },
      target: { xs: [78, 206, 334, 462], y: 248, w: 104, h: 88 },
      gate: { y: 326 },
      water: { top: 380, bottom: 700 },
      raft: { x: 270, y: 560, w: 136, h: 70 },
      bank: { xs: [78, 206, 334, 462], y: 802, w: 104, h: 132 },
      notice: { x: 270, y: 710 },
      introCard: { x: 270, y: 500, w: 430, h: 480 },
      introButton: { x: 270, y: 668, w: 230, h: 60 },
      doneCard: { x: 270, y: 480, w: 400, h: 300 },
      doneButton: { x: 270, y: 580, w: 220, h: 54 },
      celebrate: { cx: 270, cy: 470, radius: 190 },
      restart: { x: 270, y: 868, w: 220, h: 56 },
    };
  }
  const L = computeLayout();

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
          master.gain.value = 0.55;
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
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol == null ? 0.03 : vol), t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.2));
        osc.connect(gain); gain.connect(master);
        osc.start(t); osc.stop(t + (dur || 0.2) + 0.03);
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
        osc.connect(gain); gain.connect(master);
        osc.start(t); osc.stop(t + (dur || 0.2) + 0.03);
      } catch (e) { /* ignore */ }
    }

    return {
      resume: function () { ensure(); },
      pick: function () { tone(620, 0.08, 0.018, 0, 'sine'); tone(840, 0.06, 0.01, 0.03, 'sine'); },
      drop: function () { tone(300, 0.1, 0.028, 0, 'triangle'); tone(450, 0.08, 0.014, 0.035, 'sine'); },
      water: function () { sweep(240, 90, 0.2, 0.018, 'sine'); tone(520, 0.08, 0.009, 0.03, 'sine'); },
      correct: function () {
        tone(523.25, 0.2, 0.025, 0, 'triangle');
        tone(659.25, 0.22, 0.025, 0.08, 'triangle');
        tone(783.99, 0.3, 0.028, 0.16, 'sine');
      },
      wrong: function () { tone(220, 0.12, 0.014, 0, 'sine'); tone(180, 0.14, 0.012, 0.07, 'sine'); },
      chapter: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.32, 0.026, i * 0.09, 'triangle');
      },
      end: function () {
        const notes = [392, 523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) tone(notes[i], 0.7, 0.027, i * 0.085, 'sine');
      },
    };
  })();

  const Speech = (function () {
    function speak(text) {
      try {
        if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') return false;
        window.speechSynthesis.cancel();
        const utter = new window.SpeechSynthesisUtterance(text);
        utter.lang = 'zh-CN';
        utter.rate = SPEECH_RATE;
        utter.pitch = 1.12;
        utter.volume = 1;
        window.speechSynthesis.speak(utter);
        return true;
      } catch (e) { return false; }
    }
    function cancel() {
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
    return { speak: speak, cancel: cancel };
  })();

  // ---------------------------------------------------------------- 生肖头像
  function drawZodiacHead(g, item, x, y, s, alpha, sil) {
    const a = alpha == null ? 1 : alpha;
    const base = sil ? C.silhouette : item.color;
    const light = sil ? C.silhouetteLight : item.light;
    const dark = sil ? C.silhouetteDark : item.dark;
    const face = sil ? C.silhouetteFace : item.face;
    const k = item.key;
    const eye = sil ? dark : 0x3D2D26;

    if (k === 'rat') {
      g.fillStyle(dark, a); g.fillCircle(x - 19 * s, y - 20 * s, 16 * s); g.fillCircle(x + 19 * s, y - 20 * s, 16 * s);
      g.fillStyle(light, 0.82 * a); g.fillCircle(x - 19 * s, y - 20 * s, 10 * s); g.fillCircle(x + 19 * s, y - 20 * s, 10 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 57 * s, 51 * s);
      g.fillStyle(face, 0.92 * a); g.fillEllipse(x, y + 11 * s, 38 * s, 26 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 10 * s, y - 3 * s, 2.8 * s); g.fillCircle(x + 10 * s, y - 3 * s, 2.8 * s);
        g.fillStyle(0xE88B96, a); g.fillCircle(x, y + 8 * s, 4 * s);
        g.lineStyle(1.2 * s, dark, 0.8 * a);
        g.lineBetween(x - 6 * s, y + 12 * s, x - 28 * s, y + 8 * s);
        g.lineBetween(x + 6 * s, y + 12 * s, x + 28 * s, y + 8 * s);
        g.lineBetween(x - 8 * s, y + 15 * s, x - 30 * s, y + 19 * s);
        g.lineBetween(x + 8 * s, y + 15 * s, x + 30 * s, y + 19 * s);
        g.fillStyle(0xFFFFFF, a); g.fillRoundedRect(x - 5 * s, y + 19 * s, 10 * s, 6 * s, 2 * s);
      }
    } else if (k === 'ox') {
      g.lineStyle(6 * s, sil ? C.silhouetteDark : 0xFFF0C7, a);
      g.lineBetween(x - 27 * s, y - 26 * s, x - 40 * s, y - 37 * s);
      g.lineBetween(x - 40 * s, y - 37 * s, x - 34 * s, y - 45 * s);
      g.lineBetween(x + 27 * s, y - 26 * s, x + 40 * s, y - 37 * s);
      g.lineBetween(x + 40 * s, y - 37 * s, x + 34 * s, y - 45 * s);
      g.fillStyle(dark, a); g.fillEllipse(x - 29 * s, y - 3 * s, 23 * s, 15 * s); g.fillEllipse(x + 29 * s, y - 3 * s, 23 * s, 15 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 63 * s, 55 * s);
      g.fillStyle(face, 0.9 * a); g.fillEllipse(x, y + 15 * s, 42 * s, 26 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 12 * s, y - 7 * s, 2.7 * s); g.fillCircle(x + 12 * s, y - 7 * s, 2.7 * s);
        g.fillStyle(dark, a); g.fillCircle(x - 8 * s, y + 16 * s, 2.2 * s); g.fillCircle(x + 8 * s, y + 16 * s, 2.2 * s);
        g.fillStyle(0xE88B96, 0.48 * a); g.fillEllipse(x - 23 * s, y + 6 * s, 9 * s, 5 * s); g.fillEllipse(x + 23 * s, y + 6 * s, 9 * s, 5 * s);
      }
    } else if (k === 'tiger') {
      g.fillStyle(dark, a); g.fillCircle(x - 22 * s, y - 24 * s, 13 * s); g.fillCircle(x + 22 * s, y - 24 * s, 13 * s);
      g.fillStyle(light, 0.8 * a); g.fillCircle(x - 22 * s, y - 24 * s, 7 * s); g.fillCircle(x + 22 * s, y - 24 * s, 7 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 60 * s, 55 * s);
      g.fillStyle(face, 0.92 * a); g.fillEllipse(x, y + 13 * s, 39 * s, 25 * s);
      if (!sil) {
        g.fillStyle(dark, a);
        g.fillTriangle(x - 27 * s, y - 18 * s, x - 16 * s, y - 24 * s, x - 19 * s, y - 8 * s);
        g.fillTriangle(x + 27 * s, y - 18 * s, x + 16 * s, y - 24 * s, x + 19 * s, y - 8 * s);
        g.fillRect(x - 4 * s, y - 27 * s, 8 * s, 13 * s);
        g.fillRect(x - 25 * s, y + 10 * s, 11 * s, 3 * s); g.fillRect(x + 14 * s, y + 10 * s, 11 * s, 3 * s);
        g.fillStyle(eye, a); g.fillCircle(x - 12 * s, y - 4 * s, 2.8 * s); g.fillCircle(x + 12 * s, y - 4 * s, 2.8 * s);
        g.fillStyle(dark, a); g.fillTriangle(x, y + 5 * s, x - 4 * s, y + 10 * s, x + 4 * s, y + 10 * s);
        g.lineStyle(1.2 * s, dark, 0.7 * a); g.lineBetween(x, y + 10 * s, x, y + 14 * s);
        g.lineBetween(x, y + 14 * s, x - 7 * s, y + 18 * s); g.lineBetween(x, y + 14 * s, x + 7 * s, y + 18 * s);
      }
    } else if (k === 'rabbit') {
      g.fillStyle(dark, a); g.fillEllipse(x - 13 * s, y - 37 * s, 17 * s, 49 * s); g.fillEllipse(x + 13 * s, y - 37 * s, 17 * s, 49 * s);
      g.fillStyle(light, 0.95 * a); g.fillEllipse(x - 13 * s, y - 37 * s, 9 * s, 35 * s); g.fillEllipse(x + 13 * s, y - 37 * s, 9 * s, 35 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 5 * s, 54 * s, 48 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 10 * s, y - 2 * s, 2.6 * s); g.fillCircle(x + 10 * s, y - 2 * s, 2.6 * s);
        g.fillStyle(0xE9859A, a); g.fillEllipse(x, y + 9 * s, 7 * s, 5 * s);
        g.fillStyle(0xFFFFFF, a); g.fillRoundedRect(x - 6 * s, y + 17 * s, 12 * s, 7 * s, 2 * s);
        g.fillStyle(0xF4B5C1, 0.55 * a); g.fillCircle(x - 20 * s, y + 9 * s, 4 * s); g.fillCircle(x + 20 * s, y + 9 * s, 4 * s);
      }
    } else if (k === 'dragon') {
      g.lineStyle(3.2 * s, sil ? C.silhouetteDark : C.gold, a);
      g.lineBetween(x - 13 * s, y - 26 * s, x - 19 * s, y - 42 * s); g.lineBetween(x - 19 * s, y - 42 * s, x - 28 * s, y - 45 * s);
      g.lineBetween(x + 13 * s, y - 26 * s, x + 19 * s, y - 42 * s); g.lineBetween(x + 19 * s, y - 42 * s, x + 28 * s, y - 45 * s);
      g.fillStyle(light, 0.9 * a); g.fillTriangle(x - 25 * s, y - 18 * s, x - 12 * s, y - 30 * s, x - 10 * s, y - 8 * s);
      g.fillTriangle(x + 25 * s, y - 18 * s, x + 12 * s, y - 30 * s, x + 10 * s, y - 8 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 60 * s, 52 * s);
      g.fillStyle(face, 0.92 * a); g.fillEllipse(x, y + 16 * s, 37 * s, 23 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 12 * s, y - 4 * s, 2.8 * s); g.fillCircle(x + 12 * s, y - 4 * s, 2.8 * s);
        g.lineStyle(1.5 * s, C.goldDeep, 0.85 * a);
        g.lineBetween(x - 5 * s, y + 16 * s, x - 29 * s, y + 10 * s); g.lineBetween(x + 5 * s, y + 16 * s, x + 29 * s, y + 10 * s);
        g.fillStyle(C.gold, 0.9 * a); g.fillCircle(x, y + 15 * s, 3 * s);
        g.fillStyle(C.red, 0.8 * a); g.fillTriangle(x - 6 * s, y + 24 * s, x + 6 * s, y + 24 * s, x, y + 32 * s);
      }
    } else if (k === 'snake') {
      g.lineStyle(11 * s, dark, a);
      g.lineBetween(x - 16 * s, y + 30 * s, x - 27 * s, y + 16 * s);
      g.lineBetween(x - 27 * s, y + 16 * s, x - 13 * s, y + 2 * s);
      g.fillStyle(light, 0.76 * a); g.fillEllipse(x - 24 * s, y + 18 * s, 22 * s, 7 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y - 4 * s, 49 * s, 42 * s);
      g.fillStyle(face, 0.75 * a); g.fillEllipse(x, y + 9 * s, 27 * s, 16 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 10 * s, y - 7 * s, 2.6 * s); g.fillCircle(x + 10 * s, y - 7 * s, 2.6 * s);
        g.lineStyle(1.4 * s, C.red, 0.9 * a); g.lineBetween(x, y + 18 * s, x, y + 28 * s);
        g.lineBetween(x, y + 28 * s, x - 5 * s, y + 34 * s); g.lineBetween(x, y + 28 * s, x + 5 * s, y + 34 * s);
        g.fillStyle(dark, 0.6 * a); g.fillEllipse(x + 10 * s, y + 3 * s, 5 * s, 3 * s); g.fillEllipse(x - 8 * s, y + 5 * s, 5 * s, 3 * s);
      }
    } else if (k === 'horse') {
      g.fillStyle(dark, a); g.fillTriangle(x - 21 * s, y - 32 * s, x - 8 * s, y - 24 * s, x - 23 * s, y - 16 * s); g.fillTriangle(x + 21 * s, y - 32 * s, x + 8 * s, y - 24 * s, x + 23 * s, y - 16 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 47 * s, 62 * s);
      g.fillStyle(face, 0.9 * a); g.fillEllipse(x, y + 16 * s, 35 * s, 30 * s);
      g.fillStyle(dark, a);
      for (let i = 0; i < 4; i++) g.fillTriangle(x - 18 * s + i * 9 * s, y - 26 * s, x - 24 * s + i * 10 * s, y - 10 * s, x - 12 * s + i * 10 * s, y - 12 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 10 * s, y - 6 * s, 2.6 * s); g.fillCircle(x + 10 * s, y - 6 * s, 2.6 * s);
        g.fillStyle(dark, a); g.fillCircle(x - 6 * s, y + 23 * s, 2 * s); g.fillCircle(x + 6 * s, y + 23 * s, 2 * s);
        g.fillStyle(0xE88B96, 0.45 * a); g.fillCircle(x - 20 * s, y + 5 * s, 4 * s); g.fillCircle(x + 20 * s, y + 5 * s, 4 * s);
      }
    } else if (k === 'goat') {
      g.lineStyle(5 * s, sil ? C.silhouetteDark : 0xFFF7DC, a);
      g.lineBetween(x - 23 * s, y - 24 * s, x - 35 * s, y - 31 * s); g.lineBetween(x - 35 * s, y - 31 * s, x - 31 * s, y - 40 * s); g.lineBetween(x - 31 * s, y - 40 * s, x - 23 * s, y - 38 * s);
      g.lineBetween(x + 23 * s, y - 24 * s, x + 35 * s, y - 31 * s); g.lineBetween(x + 35 * s, y - 31 * s, x + 31 * s, y - 40 * s); g.lineBetween(x + 31 * s, y - 40 * s, x + 23 * s, y - 38 * s);
      g.fillStyle(dark, a); g.fillEllipse(x - 29 * s, y - 2 * s, 24 * s, 12 * s); g.fillEllipse(x + 29 * s, y - 2 * s, 24 * s, 12 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 56 * s, 52 * s);
      g.fillStyle(face, 0.9 * a); g.fillEllipse(x, y + 14 * s, 35 * s, 22 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 11 * s, y - 6 * s, 2.6 * s); g.fillCircle(x + 11 * s, y - 6 * s, 2.6 * s);
        g.fillStyle(dark, a); g.fillTriangle(x - 7 * s, y + 24 * s, x + 7 * s, y + 24 * s, x, y + 37 * s);
        g.fillStyle(0xE88B96, 0.45 * a); g.fillCircle(x - 20 * s, y + 7 * s, 4 * s); g.fillCircle(x + 20 * s, y + 7 * s, 4 * s);
      }
    } else if (k === 'monkey') {
      g.fillStyle(dark, a); g.fillCircle(x - 27 * s, y - 2 * s, 13 * s); g.fillCircle(x + 27 * s, y - 2 * s, 13 * s);
      g.fillStyle(light, 0.85 * a); g.fillCircle(x - 27 * s, y - 2 * s, 8 * s); g.fillCircle(x + 27 * s, y - 2 * s, 8 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 52 * s, 55 * s);
      g.fillStyle(face, 0.96 * a); g.fillEllipse(x, y - 1 * s, 39 * s, 37 * s);
      g.fillStyle(light, 0.72 * a); g.fillEllipse(x, y + 16 * s, 27 * s, 18 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 10 * s, y - 7 * s, 2.7 * s); g.fillCircle(x + 10 * s, y - 7 * s, 2.7 * s);
        g.fillStyle(dark, a); g.fillEllipse(x, y + 7 * s, 8 * s, 5 * s);
        g.lineStyle(1.4 * s, dark, 0.72 * a); g.lineBetween(x - 8 * s, y + 17 * s, x + 8 * s, y + 17 * s);
      }
    } else if (k === 'rooster') {
      g.fillStyle(sil ? C.silhouetteDark : C.red, a);
      g.fillCircle(x - 10 * s, y - 33 * s, 8 * s); g.fillCircle(x, y - 38 * s, 9 * s); g.fillCircle(x + 10 * s, y - 33 * s, 8 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y - 1 * s, 51 * s, 52 * s);
      g.fillStyle(face, 0.92 * a); g.fillEllipse(x, y + 11 * s, 32 * s, 25 * s);
      g.fillStyle(sil ? C.silhouetteDark : C.gold, a); g.fillTriangle(x + 18 * s, y + 6 * s, x + 39 * s, y + 13 * s, x + 18 * s, y + 18 * s);
      g.fillStyle(sil ? C.silhouetteDark : C.redDark, a); g.fillEllipse(x - 2 * s, y + 23 * s, 9 * s, 13 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 9 * s, y - 2 * s, 2.7 * s); g.fillCircle(x + 8 * s, y - 2 * s, 2.7 * s);
        g.lineStyle(1.2 * s, C.goldDeep, 0.6 * a); g.lineBetween(x + 9 * s, y + 20 * s, x + 18 * s, y + 27 * s);
      }
    } else if (k === 'dog') {
      g.fillStyle(dark, a); g.fillEllipse(x - 26 * s, y + 2 * s, 20 * s, 39 * s); g.fillEllipse(x + 26 * s, y + 2 * s, 20 * s, 39 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 1 * s, 57 * s, 53 * s);
      g.fillStyle(face, 0.95 * a); g.fillEllipse(x, y + 13 * s, 37 * s, 27 * s);
      if (!sil) {
        g.fillStyle(eye, a); g.fillCircle(x - 11 * s, y - 5 * s, 2.7 * s); g.fillCircle(x + 11 * s, y - 5 * s, 2.7 * s);
        g.fillStyle(0x3D2D26, a); g.fillEllipse(x, y + 9 * s, 10 * s, 7 * s);
        g.fillStyle(0xE9859A, a); g.fillRoundedRect(x - 4 * s, y + 17 * s, 8 * s, 10 * s, 4 * s);
        g.lineStyle(1.3 * s, dark, 0.7 * a); g.lineBetween(x, y + 16 * s, x, y + 22 * s);
      }
    } else {
      g.fillStyle(dark, a); g.fillTriangle(x - 25 * s, y - 22 * s, x - 8 * s, y - 31 * s, x - 6 * s, y - 7 * s); g.fillTriangle(x + 25 * s, y - 22 * s, x + 8 * s, y - 31 * s, x + 6 * s, y - 7 * s);
      g.fillStyle(base, a); g.fillEllipse(x, y + 2 * s, 58 * s, 53 * s);
      g.fillStyle(face, 0.9 * a); g.fillEllipse(x, y + 8 * s, 38 * s, 30 * s);
      g.fillStyle(sil ? C.silhouetteDark : 0xD97086, a); g.fillEllipse(x, y + 16 * s, 27 * s, 19 * s);
      if (!sil) {
        g.fillStyle(0xC2546A, a); g.fillEllipse(x - 6 * s, y + 16 * s, 4 * s, 6 * s); g.fillEllipse(x + 6 * s, y + 16 * s, 4 * s, 6 * s);
        g.fillStyle(eye, a); g.fillCircle(x - 12 * s, y - 3 * s, 2.6 * s); g.fillCircle(x + 12 * s, y - 3 * s, 2.6 * s);
        g.fillStyle(0xF3A7B4, 0.65 * a); g.fillCircle(x - 22 * s, y + 7 * s, 4 * s); g.fillCircle(x + 22 * s, y + 7 * s, 4 * s);
      }
    }
  }

  function drawMedallion(g, index, x, y, scale, opts) {
    const o = opts || {};
    const item = ZODIAC[index];
    const s = scale == null ? 1 : scale;
    const a = o.alpha == null ? 1 : o.alpha;
    const sil = !!o.silhouette;
    if (!sil) {
      g.fillStyle(C.shadow, 0.16 * a);
      g.fillEllipse(x + 2 * s, y + 38 * s, 74 * s, 18 * s);
    }
    if (o.selected) {
      g.fillStyle(C.goldLight, 0.34 * a);
      g.fillCircle(x, y, 48 * s);
      g.lineStyle(3 * s, C.gold, 0.95 * a);
      g.strokeCircle(x, y, 45 * s);
    }
    g.fillStyle(sil ? 0xE9E1D1 : C.cream, 0.96 * a);
    g.fillCircle(x, y, 42 * s);
    g.fillStyle(sil ? C.silhouetteLight : item.light, a);
    g.fillCircle(x, y, 37 * s);
    g.fillStyle(sil ? C.silhouette : item.color, 0.2 * a);
    g.fillCircle(x, y + 4 * s, 30 * s);
    drawZodiacHead(g, item, x, y, s * 0.82, a, sil);
    g.lineStyle(2.2 * s, sil ? 0xB2AA99 : C.gold, 0.88 * a);
    g.strokeCircle(x, y, 41 * s);
  }

  // ---------------------------------------------------------------- 场景绘制
  function drawCloud(g, x, y, scale, color, alpha) {
    g.fillStyle(color, alpha == null ? 0.7 : alpha);
    g.fillEllipse(x, y, 66 * scale, 20 * scale);
    g.fillEllipse(x - 22 * scale, y - 8 * scale, 40 * scale, 24 * scale);
    g.fillEllipse(x + 20 * scale, y - 4 * scale, 46 * scale, 26 * scale);
  }

  function drawLantern(g, x, y, scale, alpha) {
    const a = alpha == null ? 1 : alpha;
    const s = scale == null ? 1 : scale;
    g.lineStyle(1.5 * s, C.goldDeep, 0.8 * a);
    g.lineBetween(x, y - 18 * s, x, y - 9 * s);
    g.fillStyle(C.red, 0.95 * a); g.fillEllipse(x, y, 22 * s, 28 * s);
    g.fillStyle(C.goldLight, 0.85 * a); g.fillEllipse(x - 3 * s, y - 4 * s, 7 * s, 12 * s);
    g.fillStyle(C.gold, a); g.fillRect(x - 12 * s, y - 15 * s, 24 * s, 4 * s); g.fillRect(x - 12 * s, y + 11 * s, 24 * s, 4 * s);
    g.lineStyle(1.2 * s, C.gold, 0.8 * a); g.lineBetween(x, y + 15 * s, x - 4 * s, y + 23 * s); g.lineBetween(x, y + 15 * s, x + 4 * s, y + 23 * s);
  }

  function drawRiverBackground(g, chapter) {
    const th = THEMES[chapter] || THEMES[0];
    g.clear();
    g.fillGradientStyle(th.skyTop, th.skyTop, th.skyBottom, th.skyBottom, 1);
    g.fillRect(0, 0, WIDTH, 390);

    g.fillStyle(0xFFF4CF, 0.18); g.fillCircle(450, 128, 70);
    g.fillStyle(0xFFF2A0, 0.38); g.fillCircle(450, 128, 48);
    g.fillStyle(th.sun, 1); g.fillCircle(450, 128, 28);
    g.fillStyle(0xFFFFFF, 0.5); g.fillCircle(440, 119, 9);

    drawCloud(g, 92, 112, 0.9, th.cloud, 0.72);
    drawCloud(g, 342, 92, 0.6, th.cloud, 0.58);
    drawCloud(g, 232, 170, 0.52, th.cloud, 0.48);

    g.fillStyle(th.hillFar, 0.95);
    g.fillEllipse(50, 332, 260, 130);
    g.fillEllipse(485, 326, 285, 145);
    g.fillStyle(th.hillNear, 0.96);
    g.fillEllipse(272, 348, 400, 96);
    g.fillStyle(th.farBank, 1);
    g.fillRoundedRect(0, 342, WIDTH, 44, 18);
    g.fillStyle(th.farBankDark, 0.42);
    g.fillRect(0, 376, WIDTH, 10);

    // 终点门
    const gateY = L.gate.y;
    g.fillStyle(C.wood || 0x8A5A32, 0.2); g.fillEllipse(270, gateY + 63, 265, 18);
    g.fillStyle(0x9B4B38, 1); g.fillRoundedRect(112, gateY - 22, 20, 86, 6); g.fillRoundedRect(408, gateY - 22, 20, 86, 6);
    g.fillStyle(C.gold, 0.9); g.fillRoundedRect(116, gateY - 18, 5, 78, 3); g.fillRoundedRect(412, gateY - 18, 5, 78, 3);
    g.fillStyle(0xC64F40, 1); g.fillTriangle(74, gateY - 22, 466, gateY - 22, 270, gateY - 70);
    g.fillStyle(0xE87554, 1); g.fillTriangle(104, gateY - 28, 436, gateY - 28, 270, gateY - 62);
    g.fillStyle(C.goldLight, 0.9); g.fillRoundedRect(92, gateY - 25, 356, 8, 4);
    drawLantern(g, 160, gateY - 4, 0.72, 0.95);
    drawLantern(g, 380, gateY - 4, 0.72, 0.95);
    drawLantern(g, 270, gateY - 24, 0.6, 0.95);

    g.fillGradientStyle(th.waterTop, th.waterTop, th.waterBottom, th.waterBottom, 1);
    g.fillRect(0, 380, WIDTH, 322);
    g.fillStyle(th.waterLight, 0.24);
    for (let i = 0; i < 11; i++) {
      const y = 402 + i * 26;
      const wobble = Math.sin(i * 1.7) * 18;
      g.fillEllipse(90 + wobble + (i % 3) * 130, y, 85 + (i % 4) * 18, 4);
    }
    for (let i = 0; i < 7; i++) {
      const x = 35 + i * 84;
      g.fillStyle(0x4D8F4D, 0.72);
      g.fillEllipse(x, 696 - (i % 2) * 8, 32, 9);
      g.fillStyle(0x76B75B, 0.8);
      g.fillEllipse(x - 6, 692 - (i % 2) * 8, 17, 7);
      if (i % 2 === 0) { g.fillStyle(0xF6B8C4, 0.9); g.fillCircle(x + 8, 687 - (i % 2) * 8, 3); }
    }

    g.fillStyle(th.nearBank, 1);
    g.fillRoundedRect(-10, 694, 560, 280, 26);
    g.fillStyle(th.nearBankDark, 0.44);
    g.fillRect(0, 698, WIDTH, 15);
    g.fillStyle(0x99C77A, 0.35);
    g.fillEllipse(120, 742, 260, 44);
    g.fillEllipse(430, 760, 230, 50);
    for (let i = 0; i < 12; i++) {
      const x = 22 + i * 46;
      const h = 16 + Math.abs(pseudo(i + 8)) * 20;
      g.lineStyle(1.4, 0x5D8A46, 0.42);
      g.lineBetween(x, 716, x + 2, 716 - h);
      g.lineBetween(x + 2, 716 - h * 0.6, x + 8, 716 - h * 0.8);
    }
  }

  function drawCelebrateBackground(g) {
    g.clear();
    g.fillGradientStyle(0x4A1F2F, 0x5A2433, 0x8D3C35, 0xC56A45, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.fillStyle(0xFFE7A6, 0.12); g.fillCircle(270, 470, 270);
    g.fillStyle(0xFFE7A6, 0.1); g.fillCircle(270, 470, 215);
    drawCloud(g, 105, 114, 0.65, 0xFFE8B8, 0.22);
    drawCloud(g, 435, 153, 0.52, 0xFFE8B8, 0.2);
    drawLantern(g, 62, 275, 0.8, 0.8);
    drawLantern(g, 478, 270, 0.8, 0.8);
    drawLantern(g, 70, 520, 0.6, 0.6);
    drawLantern(g, 470, 522, 0.6, 0.6);
    for (let i = 0; i < 26; i++) {
      const x = 28 + Math.abs(pseudo(i + 3)) * 484;
      const y = 50 + Math.abs(pseudo(i + 41)) * 760;
      g.fillStyle(i % 3 === 0 ? C.goldLight : 0xFFCF9A, 0.28);
      g.fillCircle(x, y, 1.5 + (i % 3));
    }
    g.fillStyle(0xFFE1A0, 0.16); g.fillEllipse(270, 930, 520, 100);
  }

  function drawRaft(g, x, y, scale, alpha, bob) {
    const s = scale == null ? 1 : scale;
    const a = alpha == null ? 1 : alpha;
    const b = bob == null ? 0 : bob;
    g.fillStyle(C.shadow, 0.2 * a);
    g.fillEllipse(x + 2 * s, y + 25 * s + b, 130 * s, 22 * s);
    g.fillStyle(0x7D4F2C, a);
    g.fillRoundedRect(x - 67 * s, y + 3 * s + b, 134 * s, 23 * s, 10 * s);
    g.fillStyle(0xB8753C, a);
    for (let i = 0; i < 5; i++) g.fillRoundedRect(x - 59 * s + i * 26 * s, y - 1 * s + b, 20 * s, 14 * s, 6 * s);
    g.fillStyle(0xE0A55F, 0.75 * a); g.fillRoundedRect(x - 61 * s, y + 3 * s + b, 122 * s, 4 * s, 2 * s);
    g.lineStyle(2.4 * s, 0x754426, 0.85 * a); g.lineBetween(x + 43 * s, y + 2 * s + b, x + 48 * s, y - 51 * s + b);
    g.fillStyle(C.red, a); g.fillTriangle(x + 48 * s, y - 51 * s + b, x + 82 * s, y - 44 * s + b, x + 48 * s, y - 33 * s + b);
    g.fillStyle(C.goldLight, 0.9 * a); g.fillCircle(x + 54 * s, y - 44 * s + b, 3 * s);
    g.fillStyle(0xFFFFFF, 0.2 * a);
    g.fillEllipse(x - 25 * s, y + 18 * s + b, 35 * s, 4 * s);
  }

  // ---------------------------------------------------------------- Game scene
  class ZodiacScene extends Phaser.Scene {
    constructor() { super('ZodiacScene'); }

    create() {
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT,
        ZODIAC: ZODIAC.map(function (item) { return Object.assign({}, item); }),
        CHAPTERS: CHAPTERS.map(function (chapter) { return chapter.slice(); }),
        CHAPTER_SIZE: CHAPTER_SIZE, CHAPTER_COUNT: CHAPTER_COUNT, TOTAL: TOTAL,
        DRAG_SCALE: DRAG_SCALE, TAP_LOCK: TAP_LOCK, SPEECH_RATE: SPEECH_RATE,
        RAFT_SEC: RAFT_SEC, LAYOUT: JSON.parse(JSON.stringify(L)),
      };
      this.PALETTE = C;
      this.L = L;
      this.clock = 0;
      this.renderReady = false;
      this.stage = 'intro';
      this.chapter = 0;
      this.chapterProgress = 0;
      this.crossed = 0;
      this.bank = [];
      this.chapterDone = false;
      this.selected = null;
      this.wrongTries = 0;
      this.hintOn = false;
      this.raftTrip = null;
      this.drag = null;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = 0;
      this.noticeValue = '';
      this.noticeTimer = 0;
      this.bankShake = null;
      this.speechT = 0;
      this.speechIndex = -1;
      this.fxParticles = [];
      this.liveProps = [];
      this.textObjs = [];
      this.textCursor = 0;
      this.pointerId = null;

      this.bgG = this.add.graphics().setDepth(DEPTH.world);
      this.sceneG = this.add.graphics().setDepth(DEPTH.scene);
      this.fxG = this.add.graphics().setDepth(DEPTH.fx);
      this.overlayG = this.add.graphics().setDepth(DEPTH.overlay);
      this.dragG = this.add.graphics().setDepth(DEPTH.drag);

      this.renderReady = true;
      this.render();

      this.input.on('pointerdown', this.onPointerDown, this);
      this.input.on('pointermove', this.onPointerMove, this);
      this.input.on('pointerup', this.onPointerUp, this);
      this.input.on('pointerupoutside', this.onPointerUp, this);
      this.events.once('shutdown', this.onShutdown.bind(this));
      Sound.resume();
    }

    startGame() {
      if (this.stage !== 'intro') return false;
      Sound.resume();
      this.stage = 'river';
      this.chapter = 0;
      this.chapterProgress = 0;
      this.crossed = 0;
      this.startChapter(0);
      this.tapLockUntil = this.clock + TAP_LOCK;
      Sound.drop();
      return true;
    }

    startChapter(index) {
      const ci = clamp(Math.floor(Number(index) || 0), 0, CHAPTER_COUNT - 1);
      this.stage = 'river';
      this.chapter = ci;
      this.chapterProgress = 0;
      this.crossed = ci * CHAPTER_SIZE;
      this.bank = shuffle(CHAPTERS[ci].slice());
      this.chapterDone = false;
      this.selected = null;
      this.wrongTries = 0;
      this.hintOn = false;
      this.raftTrip = null;
      this.drag = null;
      this.pointerId = null;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = this.clock + TAP_LOCK;
      this.noticeValue = '';
      this.noticeTimer = 0;
      this.bankShake = null;
      this.speechT = 0;
      this.speechIndex = -1;
      this.fxParticles.length = 0;
      this.clearLiveProps();
      this.render();
      return true;
    }

    currentChapterAnimals() { return CHAPTERS[this.chapter] || []; }

    currentTarget() {
      const animals = this.currentChapterAnimals();
      if (this.chapterDone || this.chapterProgress >= animals.length) return -1;
      return animals[this.chapterProgress];
    }

    isCrossedAnimal(animalIndex) {
      const animals = this.currentChapterAnimals();
      const p = animals.indexOf(animalIndex);
      return p >= 0 && p < this.chapterProgress;
    }

    bankPositionOf(animalIndex) {
      for (let i = 0; i < this.bank.length; i++) if (this.bank[i] === animalIndex) return i;
      return -1;
    }

    getCelebratePosition(index) {
      const angle = -Math.PI / 2 + (index / TOTAL) * TAU;
      return {
        x: L.celebrate.cx + Math.cos(angle) * L.celebrate.radius,
        y: L.celebrate.cy + Math.sin(angle) * L.celebrate.radius,
      };
    }

    animalAt(x, y) {
      if (this.stage === 'river' && !this.chapterDone) {
        for (let i = 0; i < this.bank.length; i++) {
          const index = this.bank[i];
          if (this.isCrossedAnimal(index)) continue;
          if (this.raftTrip && this.raftTrip.index === index) continue;
          const cx = L.bank.xs[i];
          const cy = L.bank.y;
          if (pointInRect(x, y, cx - L.bank.w / 2, cy - L.bank.h / 2, L.bank.w, L.bank.h)) return index;
        }
      }
      if (this.stage === 'celebrate') {
        for (let i = 0; i < TOTAL; i++) {
          const p = this.getCelebratePosition(i);
          if (dist(x, y, p.x, p.y) <= 34) return i;
        }
      }
      return -1;
    }

    raftAt(x, y) {
      if (this.stage !== 'river' || this.chapterDone) return false;
      return pointInRect(x, y, L.raft.x - 86, L.raft.y - 70, 172, 138);
    }

    placeAnimal(animalIndex) {
      if (this.stage !== 'river') return 'invalid';
      if (this.chapterDone || this.busy || this.raftTrip) return 'busy';
      const index = Number(animalIndex);
      if (!Number.isInteger(index)) return 'invalid';
      const animals = this.currentChapterAnimals();
      if (animals.indexOf(index) < 0 || this.isCrossedAnimal(index)) return 'invalid';
      const target = this.currentTarget();
      if (index !== target) {
        this.selected = index;
        this.wrongTries += 1;
        if (this.wrongTries >= 2) this.hintOn = true;
        this.bankShake = { index: index, t: 0.38, max: 0.38 };
        this.busy = true;
        this.busyTimer = 0.42;
        this.noticeValue = '这一只还不到时候';
        this.noticeTimer = 2.1;
        Sound.wrong();
        Sound.water();
        this.render();
        return 'wrong';
      }

      const bankPos = this.bankPositionOf(index);
      const from = { x: L.bank.xs[clamp(bankPos, 0, 3)], y: L.bank.y - 10 };
      this.selected = index;
      this.chapterProgress += 1;
      this.crossed = this.chapter * CHAPTER_SIZE + this.chapterProgress;
      this.wrongTries = 0;
      this.hintOn = false;
      this.bankShake = null;
      this.raftTrip = {
        index: index, t: 0, duration: RAFT_SEC,
        fromX: from.x, fromY: from.y,
        startRaftX: L.raft.x, startRaftY: L.raft.y,
      };
      this.busy = true;
      this.busyTimer = 0;
      this.noticeValue = '';
      this.noticeTimer = 0;
      Sound.correct();
      Sound.water();
      this.spawnStars(L.raft.x, L.raft.y - 32, 12, false);
      this.render();
      return 'placed';
    }

    nextChapter() {
      if (this.stage !== 'river' || !this.chapterDone) return false;
      Sound.resume();
      if (this.chapter >= CHAPTER_COUNT - 1) return this.finishRace();
      this.chapterDone = false;
      this.startChapter(this.chapter + 1);
      Sound.chapter();
      return true;
    }

    finishRace() {
      this.stage = 'celebrate';
      this.chapter = CHAPTER_COUNT - 1;
      this.chapterProgress = CHAPTER_SIZE;
      this.crossed = TOTAL;
      this.chapterDone = false;
      this.selected = null;
      this.wrongTries = 0;
      this.hintOn = false;
      this.raftTrip = null;
      this.drag = null;
      this.pointerId = null;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = this.clock + TAP_LOCK;
      this.noticeValue = '';
      this.noticeTimer = 0;
      this.bankShake = null;
      this.spawnConfetti(88);
      Sound.end();
      this.render();
      return true;
    }

    speakAnimal(index) {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0 || i >= TOTAL) return false;
      this.selected = i;
      this.speechIndex = i;
      this.speechT = 1.15;
      const spoken = Speech.speak(ZODIAC[i].name);
      this.render();
      return spoken;
    }

    resetTransientState() {
      this.drag = null;
      this.pointerId = null;
      this.raftTrip = null;
      this.bankShake = null;
      this.busy = false;
      this.busyTimer = 0;
      this.tapLockUntil = 0;
      this.noticeValue = '';
      this.noticeTimer = 0;
      this.speechT = 0;
      this.speechIndex = -1;
      this.fxParticles.length = 0;
      this.clearLiveProps();
      Speech.cancel();
    }

    tryRestart() {
      this.resetTransientState();
      this.selected = null;
      this.wrongTries = 0;
      this.hintOn = false;
      this.chapterDone = false;
      this.crossed = 0;
      this.chapterProgress = 0;
      this.chapter = 0;
      this.bank = [];
      this.stage = 'river';
      this.startChapter(0);
      this.tapLockUntil = this.clock + TAP_LOCK;
      Sound.resume();
      return true;
    }

    step(dt, skipRender) {
      const delta = Math.max(0, Math.min(0.05, Number(dt) || 0));
      this.clock += delta;

      if (this.noticeTimer > 0) this.noticeTimer = Math.max(0, this.noticeTimer - delta);
      if (this.speechT > 0) {
        this.speechT = Math.max(0, this.speechT - delta);
        if (this.speechT === 0) this.speechIndex = -1;
      }
      if (this.bankShake) {
        this.bankShake.t = Math.max(0, this.bankShake.t - delta);
        if (this.bankShake.t === 0) this.bankShake = null;
      }
      if (this.busyTimer > 0) {
        this.busyTimer = Math.max(0, this.busyTimer - delta);
        if (this.busyTimer === 0 && !this.raftTrip) this.busy = false;
      }

      if (this.raftTrip) {
        this.raftTrip.t += delta;
        if (this.raftTrip.t >= this.raftTrip.duration) {
          const trip = this.raftTrip;
          this.raftTrip = null;
          this.busy = false;
          this.spawnStars(trip.startRaftX + 102, trip.startRaftY - 88, 8, false);
          if (this.chapterProgress >= CHAPTER_SIZE) {
            this.chapterDone = true;
            this.tapLockUntil = this.clock + TAP_LOCK;
            this.spawnConfetti(this.chapter === CHAPTER_COUNT - 1 ? 42 : 26);
            Sound.chapter();
          }
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

    update(time, delta) {
      this.step((delta || 0) / 1000, false);
    }

    addText(x, y, text, size, color, opts) {
      const o = opts || {};
      const style = {
        fontFamily: o.title ? TITLE_FONT : FONT,
        fontSize: (size || 16) + 'px',
        color: color || '#4C4031',
        align: o.align || 'center',
        fontStyle: o.weight || 'normal',
      };
      if (o.stroke) { style.stroke = o.stroke; style.strokeThickness = o.strokeThickness || 2; }
      let t = this.textObjs[this.textCursor];
      if (!t) {
        t = this.add.text(x, y, text, style);
        this.textObjs.push(t);
      } else {
        t.setText(text);
        t.setStyle(style);
      }
      t.setPosition(x, y);
      t.setOrigin(o.originX == null ? 0.5 : o.originX, o.originY == null ? 0.5 : o.originY);
      t.setDepth(o.depth == null ? DEPTH.text : o.depth);
      t.setAlpha(o.alpha == null ? 1 : o.alpha);
      t.setVisible(true);
      this.textCursor += 1;
      return t;
    }

    beginTexts() {
      this.textCursor = 0;
      for (let i = 0; i < this.textObjs.length; i++) {
        if (this.textObjs[i] && typeof this.textObjs[i].setVisible === 'function') this.textObjs[i].setVisible(false);
      }
    }

    clearTexts() {
      for (let i = 0; i < this.textObjs.length; i++) {
        const t = this.textObjs[i];
        if (t && typeof t.destroy === 'function') t.destroy();
      }
      this.textObjs.length = 0;
      this.textCursor = 0;
    }

    colorCss(n) { return '#' + ('000000' + (n >>> 0).toString(16)).slice(-6); }

    inStartButton(x, y) {
      const b = L.introButton;
      return pointInRect(x, y, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }

    inDoneButton(x, y) {
      const b = L.doneButton;
      return pointInRect(x, y, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }

    inRestartButton(x, y) {
      const b = L.restart;
      return pointInRect(x, y, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }

    onPointerDown(pointer) {
      Sound.resume();
      const x = Number(pointer.x) || 0;
      const y = Number(pointer.y) || 0;
      if (this.clock < this.tapLockUntil) return false;

      if (this.stage === 'intro') {
        if (this.inStartButton(x, y)) return this.startGame();
        return false;
      }

      if (this.stage === 'celebrate') {
        if (this.inRestartButton(x, y)) return this.tryRestart();
        const index = this.animalAt(x, y);
        if (index >= 0) {
          Sound.pick();
          this.speakAnimal(index);
          const p = this.getCelebratePosition(index);
          this.spawnStars(p.x, p.y - 8, 7, false);
          return true;
        }
        return false;
      }

      if (this.chapterDone) {
        if (this.inDoneButton(x, y)) return this.nextChapter();
        return false;
      }
      if (this.busy || this.raftTrip || this.drag) return false;

      const animal = this.animalAt(x, y);
      if (animal < 0) return false;
      this.selected = animal;
      this.speakAnimal(animal);
      this.pointerId = pointer.id == null ? 1 : pointer.id;
      this.drag = {
        pointerId: this.pointerId,
        index: animal,
        startX: x, startY: y, x: x, y: y,
        moved: false,
      };
      Sound.pick();
      this.render();
      return true;
    }

    onPointerMove(pointer) {
      if (!this.drag) return false;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (pid !== this.pointerId) return false;
      this.drag.x = Number(pointer.x) || 0;
      this.drag.y = Number(pointer.y) || 0;
      if (dist(this.drag.startX, this.drag.startY, this.drag.x, this.drag.y) > 8) this.drag.moved = true;
      this.render();
      return true;
    }

    onPointerUp(pointer) {
      if (!this.drag) return false;
      const pid = pointer.id == null ? 1 : pointer.id;
      if (pid !== this.pointerId) return false;
      const drag = this.drag;
      const x = Number(pointer.x) || 0;
      const y = Number(pointer.y) || 0;
      this.drag = null;
      this.pointerId = null;
      if (this.raftAt(x, y)) {
        this.placeAnimal(drag.index);
      } else {
        if (drag.moved) {
          this.noticeValue = '把动物拖到木筏上';
          this.noticeTimer = 1.4;
        }
        this.render();
      }
      return true;
    }

    spawnStars(x, y, count, burst) {
      const n = Math.max(1, count || 10);
      const colors = [C.gold, C.goldLight, C.red, 0xFFE6A6, C.jade, 0xFFFFFF];
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * TAU + Math.random() * 0.45;
        const speed = burst === false ? 30 + Math.random() * 46 : 58 + Math.random() * 92;
        this.fxParticles.push({
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 34,
          gravity: 68,
          life: 0.65 + Math.random() * 0.65,
          maxLife: 1.3,
          color: colors[i % colors.length],
          size: 2.8 + Math.random() * 3.8,
          shape: i % 3 === 0 ? 'star' : 'circle',
        });
      }
    }

    spawnConfetti(count) {
      const colors = [C.gold, C.goldLight, C.red, C.jade, 0x79B8E8, 0xFFD08A, 0xF7A9B8, C.cream];
      const n = Math.max(1, count || 48);
      for (let i = 0; i < n; i++) {
        this.fxParticles.push({
          x: 28 + Math.random() * (WIDTH - 56),
          y: -18 - Math.random() * 210,
          vx: (Math.random() - 0.5) * 48,
          vy: 72 + Math.random() * 82,
          gravity: 25,
          life: 2.2 + Math.random() * 1.7,
          maxLife: 3.9,
          color: colors[i % colors.length],
          size: 3 + Math.random() * 4.5,
          shape: i % 4 === 0 ? 'star' : i % 3 === 0 ? 'circle' : 'rect',
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 5,
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

    drawFx() {
      const g = this.fxG;
      for (let i = 0; i < this.fxParticles.length; i++) {
        const p = this.fxParticles[i];
        const a = clamp(p.life / Math.max(0.001, p.maxLife), 0, 1);
        if (p.shape === 'star') {
          drawStar(g, p.x, p.y, p.size, p.color, a);
        } else if (p.shape === 'circle') {
          g.fillStyle(p.color, a);
          g.fillCircle(p.x, p.y, p.size * 0.75);
        } else {
          const rot = p.rot || 0;
          const c = Math.cos(rot);
          const s = Math.sin(rot);
          const w = p.size;
          const h = p.size * 1.7;
          const pts = [
            { x: p.x + (-w * c + h * s), y: p.y + (-w * s - h * c) },
            { x: p.x + (w * c + h * s), y: p.y + (w * s - h * c) },
            { x: p.x + (w * c - h * s), y: p.y + (w * s + h * c) },
            { x: p.x + (-w * c - h * s), y: p.y + (-w * s + h * c) },
          ];
          g.fillStyle(p.color, a);
          g.fillPoints(pts, true);
        }
      }
    }

    drawDragGhost() {
      const g = this.dragG;
      if (!this.drag) return;
      const x = this.drag.x;
      const y = this.drag.y - 34;
      g.fillStyle(C.shadow, 0.2);
      g.fillEllipse(x, y + 34, 52, 13);
      drawMedallion(g, this.drag.index, x, y, 0.9, { selected: false, alpha: 1 });
      g.fillStyle(C.goldLight, 0.24);
      g.fillCircle(x, y, 42);
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

    render() {
      if (!this.renderReady) return;
      this.bgG.clear();
      this.sceneG.clear();
      this.fxG.clear();
      this.dragG.clear();
      this.overlayG.clear();
      this.beginTexts();

      if (this.stage === 'intro') this.renderIntro();
      else if (this.stage === 'celebrate') this.renderCelebrate();
      else this.renderRiver();

      this.drawFx();
      this.drawDragGhost();
      this.drawOverlay();
    }

    renderIntro() {
      drawRiverBackground(this.bgG, 0);
      const g = this.sceneG;
      const card = L.introCard;
      g.fillStyle(C.shadow, 0.17);
      g.fillRoundedRect(card.x - card.w / 2 + 3, card.y - card.h / 2 + 8, card.w, card.h, 30);
      drawRounded(g, card.x - card.w / 2, card.y - card.h / 2, card.w, card.h, 30, C.cream, C.gold, 0.98, 0.92, 3);
      g.fillStyle(0xFFF2C9, 0.54);
      g.fillRoundedRect(card.x - card.w / 2 + 15, card.y - card.h / 2 + 15, card.w - 30, 13, 7);

      this.addText(270, 50, '生肖渡河赛', 34, '#8F3028', { title: true, stroke: '#FFF0BF', strokeThickness: 4 });
      this.addText(270, 91, '十二只小动物的渡河故事', 16, '#795E45');
      this.addText(270, 284, '传说里的渡河比赛', 27, '#9A3A2F', { title: true });
      this.addText(270, 337, '传说里，小动物们要按顺序过河。\n帮下一只坐上木筏吧。', 18, '#5C4B3A');

      const preview = [0, 4, 8, 11];
      for (let i = 0; i < preview.length; i++) {
        const px = 118 + i * 101;
        g.fillStyle(0xFFFFFF, 0.55);
        g.fillCircle(px, 425, 42);
        drawMedallion(g, preview[i], px, 425, 0.64, {});
        this.addText(px, 472, ZODIAC[preview[i]].name, 14, '#8A6A4A');
      }

      const rows = [
        { n: '第一段', text: '清晨 · 鼠 牛 虎 兔', y: 514 },
        { n: '第二段', text: '薄雾 · 龙 蛇 马 羊', y: 560 },
        { n: '第三段', text: '午后 · 猴 鸡 狗 猪', y: 606 },
      ];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        drawPill(g, 270, row.y, 344, 36, i === 0 ? 0xFFF0D0 : 0xFFF9EC, C.gold, 0.92, 0.58, 1.4);
        this.addText(151, row.y, row.n, 15, '#A86A2B', { weight: 'bold' });
        this.addText(296, row.y, row.text, 15, '#5E4B38');
      }

      const b = L.introButton;
      g.fillStyle(0x9B5930, 0.25);
      g.fillRoundedRect(b.x - b.w / 2 + 2, b.y - b.h / 2 + 5, b.w, b.h, b.h / 2);
      drawPill(g, b.x, b.y, b.w, b.h, C.red, C.goldDeep, 1, 1, 2.5);
      this.addText(b.x, b.y - 1, '开始渡河  ›', 22, '#FFF8E8', { weight: 'bold' });
      this.addText(270, 720, '点一点动物，还会读出它的名字', 13, '#8A7258');
    }

    drawProgressRibbon(g) {
      const ribbon = L.ribbon;
      g.lineStyle(3, 0xE7C878, 0.55);
      g.lineBetween(ribbon.startX, ribbon.y, ribbon.startX + ribbon.step * 11, ribbon.y);
      for (let i = 0; i < TOTAL; i++) {
        const x = ribbon.startX + i * ribbon.step;
        const done = i < this.crossed;
        const current = i === this.crossed && this.stage === 'river';
        if (current) {
          const pulse = 1.2 + Math.sin(this.clock * 4.2) * 0.6;
          g.fillStyle(C.goldLight, 0.32);
          g.fillCircle(x, ribbon.y, ribbon.r + pulse + 5);
        }
        g.fillStyle(done ? C.gold : 0xFFF8E7, 0.98);
        g.fillCircle(x, ribbon.y, ribbon.r);
        g.lineStyle(done ? 2.3 : 1.7, done ? C.goldDeep : 0xCDAF72, 0.92);
        g.strokeCircle(x, ribbon.y, ribbon.r);
        if (done) {
          g.fillStyle(0xFFFFFF, 0.68);
          g.fillCircle(x - 2.5, ribbon.y - 2.5, 2.5);
        } else if (current) {
          g.fillStyle(C.red, 0.9);
          g.fillCircle(x, ribbon.y, 3.2);
        }
      }
    }

    raftPosition() {
      if (!this.raftTrip) return { x: L.raft.x, y: L.raft.y, bob: Math.sin(this.clock * 2.1) * 1.7 };
      const p = clamp(this.raftTrip.t / Math.max(0.001, this.raftTrip.duration), 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      return {
        x: lerp(L.raft.x, 382, eased),
        y: lerp(L.raft.y, 438, eased),
        bob: Math.sin(this.clock * 10) * 2.1,
        p: p,
      };
    }

    renderRiver() {
      drawRiverBackground(this.bgG, this.chapter);
      const g = this.sceneG;
      this.drawProgressRibbon(g);

      const animals = this.currentChapterAnimals();
      const target = this.currentTarget();

      // Chapter banner
      drawPill(g, L.chapterPill.x, L.chapterPill.y, L.chapterPill.w, L.chapterPill.h, C.cream, C.gold, 0.96, 0.9, 2);
      g.fillStyle(C.red, 0.92);
      g.fillCircle(L.chapterPill.x - 111, L.chapterPill.y, 14);
      g.fillStyle(C.goldLight, 0.3);
      g.fillCircle(L.chapterPill.x - 111, L.chapterPill.y, 9);

      // Layout block
      for (let i = 0; i < CHAPTER_SIZE; i++) {
        const index = animals[i];
        const x = L.target.xs[i];
        const y = L.target.y;
        const done = i < this.chapterProgress;
        const active = i === this.chapterProgress && !this.chapterDone;
        if (active) {
          const glow = 0.22 + Math.sin(this.clock * 4.4) * 0.08;
          g.fillStyle(C.goldLight, glow);
          g.fillRoundedRect(x - 54, y - 49, 108, 98, 22);
          g.lineStyle(2.5, C.gold, 0.76);
          g.strokeRoundedRect(x - 52, y - 47, 104, 94, 20);
        }
        drawRounded(g, x - 49, y - 42, 98, 84, 18, done ? 0xFFF7E2 : 0xF4EFE1, done ? C.gold : 0xCDBB96, 0.9, done ? 0.9 : 0.52, 1.7);
        drawMedallion(g, index, x, y - 2, 0.63, { silhouette: !done, alpha: done ? 1 : 0.72 });
        g.fillStyle(done ? C.gold : 0xEAE2D1, 1);
        g.fillCircle(x - 38, y + 30, 12);
        this.addText(x - 38, y + 30, String(i + 1), 12, done ? '#FFF9E9' : '#8D7B61', { weight: 'bold' });
        if (done) this.addText(x, y + 32, ZODIAC[index].name, 14, '#8A4A29', { weight: 'bold' });
      }

      // Target hint
      if (this.hintOn && target >= 0) {
        const hintX = L.target.xs[this.chapterProgress];
        drawPill(g, hintX, 309, 118, 30, 0xFFF6D9, C.gold, 0.98, 0.9, 1.5);
      }

      // Raft and ripples
      const raft = this.raftPosition();
      for (let i = 0; i < 3; i++) {
        const a = 0.18 - i * 0.045;
        g.lineStyle(2, C.waterFoam, a);
        g.strokeEllipse(raft.x, raft.y + 28 + i * 7, 142 + i * 22, 29 + i * 8);
      }
      const hoverRaft = this.drag && this.raftAt(this.drag.x, this.drag.y);
      if (hoverRaft) {
        g.lineStyle(3, C.goldLight, 0.9);
        g.strokeEllipse(L.raft.x, L.raft.y + 14, 172, 72);
        g.lineStyle(1.4, C.goldLight, 0.52);
        g.strokeEllipse(L.raft.x, L.raft.y + 14, 190, 84);
      }
      drawRaft(g, raft.x, raft.y, 1, 1, raft.bob);
      if (this.raftTrip) {
        const ap = clamp(raft.p * 5, 0, 1);
        drawMedallion(g, this.raftTrip.index, raft.x, raft.y - 30 + raft.bob, 0.72, { alpha: ap });
      } else if (!this.chapterDone) {
        g.fillStyle(0xE8B968, 0.32);
        g.fillEllipse(raft.x, raft.y + 1 + raft.bob, 46, 13);
      }

      // Status and cards
      for (let i = 0; i < this.bank.length; i++) {
        const index = this.bank[i];
        const x = L.bank.xs[i];
        const y = L.bank.y;
        const done = this.isCrossedAnimal(index);
        const onRaft = this.raftTrip && this.raftTrip.index === index;
        let shakeX = 0;
        if (this.bankShake && this.bankShake.index === index) {
          const q = this.bankShake.t / Math.max(0.001, this.bankShake.max);
          shakeX = Math.sin((1 - q) * 47) * 6 * q;
        }
        if (done || onRaft) {
          g.lineStyle(2, 0x9BB88A, 0.38);
          g.strokeRoundedRect(x - 48, y - 60, 96, 120, 18);
          if (done) {
            g.fillStyle(0xEAF4D8, 0.66);
            g.fillCircle(x, y - 9, 27);
            g.lineStyle(4, 0x78A86A, 0.78);
            g.lineBetween(x - 14, y - 9, x - 3, y + 4);
            g.lineBetween(x - 3, y + 4, x + 17, y - 21);
          }
          continue;
        }
        const selected = this.selected === index;
        const isTarget = index === target;
        g.fillStyle(C.shadow, 0.18);
        g.fillRoundedRect(x - 48 + shakeX + 2, y - 60 + 6, 96, 120, 20);
        drawRounded(g, x - 48 + shakeX, y - 60, 96, 120, 20, selected ? 0xFFF7DD : C.cream, selected ? C.goldDeep : C.gold, 1, selected ? 1 : 0.72, selected ? 3 : 1.8);
        if (selected) {
          g.fillStyle(C.goldLight, 0.36);
          g.fillCircle(x + shakeX, y - 13, 48);
        }
        if (isTarget && !this.chapterDone) {
          const pulse = 0.62 + Math.sin(this.clock * 4.4) * 0.18;
          g.fillStyle(C.gold, pulse);
          drawStar(g, x + 34 + shakeX, y - 48, 8, C.gold, pulse);
        }
        drawMedallion(g, index, x + shakeX, y - 13, 0.78, { selected: selected });
        this.addText(x + shakeX, y + 40, ZODIAC[index].name, 20, selected ? '#8E372B' : '#5D4733', { weight: 'bold' });
      }

      // Top status text
      this.addText(270, 50, '生肖渡河赛', 32, '#8F3028', { title: true, stroke: '#FFF0BF', strokeThickness: 4 });
      this.addText(270, 89, '按顺序帮下一只坐上木筏', 15, '#6E5A43');
      this.addText(270, 113, '已过河  ' + this.crossed + ' / 12', 13, '#8A6C47');
      this.addText(L.chapterPill.x - 111, L.chapterPill.y, String(this.chapter + 1), 15, '#FFF7E8', { weight: 'bold' });
      this.addText(L.chapterPill.x + 14, L.chapterPill.y, '第' + (this.chapter + 1) + '段 · ' + THEMES[this.chapter].name, 17, '#7A4E31', { weight: 'bold' });

      if (this.hintOn && target >= 0) {
        this.addText(L.target.xs[this.chapterProgress], 309, '下一只是' + ZODIAC[target].name, 14, '#8D4A2C', { weight: 'bold' });
      }

      if (this.noticeTimer > 0 && this.noticeValue) {
        const w = Math.min(390, 112 + this.noticeValue.length * 15);
        drawPill(g, L.notice.x, L.notice.y, w, 36, C.cream, C.gold, 0.97, 0.84, 1.7);
        this.addText(L.notice.x, L.notice.y, this.noticeValue, 15, '#7D4C39');
      }

      if (this.speechT > 0 && this.speechIndex >= 0) {
        const x = this.bank.length ? L.bank.xs[clamp(this.bankPositionOf(this.speechIndex), 0, 3)] : 270;
        const a = clamp(this.speechT / 1.15, 0, 1);
        drawPill(g, x, 722, 80, 28, 0xFFFFFF, C.gold, 0.94 * a, 0.72 * a, 1.3);
        this.addText(x, 722, ZODIAC[this.speechIndex].name, 14, '#8A4A2E', { alpha: a, weight: 'bold' });
      }
    }

    renderCelebrate() {
      drawCelebrateBackground(this.bgG);
      const g = this.sceneG;
      const cx = L.celebrate.cx;
      const cy = L.celebrate.cy;
      g.lineStyle(3, C.gold, 0.28);
      g.strokeCircle(cx, cy, L.celebrate.radius);
      g.lineStyle(1.4, C.goldLight, 0.2);
      g.strokeCircle(cx, cy, L.celebrate.radius - 12);

      for (let i = 0; i < TOTAL; i++) {
        const p = this.getCelebratePosition(i);
        const next = this.getCelebratePosition((i + 1) % TOTAL);
        const mx = (p.x + next.x) / 2;
        const my = (p.y + next.y) / 2;
        g.fillStyle(C.gold, 0.35);
        g.fillCircle(mx, my, 2.2);
      }

      g.fillStyle(C.goldLight, 0.12);
      g.fillCircle(cx, cy, 124);
      g.fillStyle(C.goldDeep, 0.24);
      g.fillCircle(cx, cy, 76);
      g.fillStyle(C.gold, 1);
      g.fillCircle(cx, cy, 60);
      g.fillStyle(0xFFF2B0, 0.82);
      g.fillCircle(cx - 8, cy - 8, 41);
      drawStar(g, cx, cy - 4, 27, C.goldDeep, 0.92);
      g.fillStyle(C.red, 0.95);
      g.fillCircle(cx, cy - 4, 9);

      for (let i = 0; i < TOTAL; i++) {
        const p = this.getCelebratePosition(i);
        const selected = this.selected === i;
        if (selected) {
          const pulse = 0.34 + Math.sin(this.clock * 4.5) * 0.12;
          g.fillStyle(C.goldLight, pulse);
          g.fillCircle(p.x, p.y, 43);
        }
        g.fillStyle(C.shadow, 0.18);
        g.fillEllipse(p.x + 2, p.y + 33, 54, 13);
        drawMedallion(g, i, p.x, p.y, 0.63, { selected: selected });
        g.fillStyle(C.gold, 0.95);
        g.fillCircle(p.x + 25, p.y - 24, 11);
        this.addText(p.x, p.y + 35, ZODIAC[i].name, 16, '#FFF4C9', { weight: 'bold', stroke: '#6B2724', strokeThickness: 3 });
        this.addText(p.x + 25, p.y - 24, String(i + 1), 10, '#FFF9E7', { weight: 'bold' });
      }

      this.addText(270, 50, '十二生肖大团圆', 32, '#FFE8A3', { title: true, stroke: '#6B2526', strokeThickness: 4 });
      this.addText(270, 91, '鼠、牛、虎、兔……转一圈，又回到小老鼠', 15, '#FFE7BE');
      this.addText(cx, cy - 1, '十二生肖\n大团圆', 18, '#8B3928', { weight: 'bold', title: true });

      if (this.speechT > 0 && this.speechIndex >= 0) {
        const p = this.getCelebratePosition(this.speechIndex);
        const a = clamp(this.speechT / 1.15, 0, 1);
        drawPill(g, p.x, p.y - 58, 86, 30, 0xFFF8E8, C.gold, 0.97 * a, 0.9 * a, 1.5);
        this.addText(p.x, p.y - 58, ZODIAC[this.speechIndex].name, 15, '#8D3A2D', { alpha: a, weight: 'bold' });
      }

      drawPill(g, L.restart.x, L.restart.y, L.restart.w, L.restart.h, C.red, C.goldDeep, 1, 1, 2.4);
      this.addText(L.restart.x, L.restart.y - 1, '再玩一次', 21, '#FFF8E8', { weight: 'bold' });
      this.addText(270, 824, '点一只动物，再听一遍它的名字', 14, '#FFE8C1');
    }

    drawOverlay() {
      if (this.stage !== 'river' || !this.chapterDone) return;
      const g = this.overlayG;
      g.fillStyle(0x2F1D24, 0.42);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      const card = L.doneCard;
      g.fillStyle(C.shadow, 0.2);
      g.fillRoundedRect(card.x - card.w / 2 + 3, card.y - card.h / 2 + 8, card.w, card.h, 26);
      drawRounded(g, card.x - card.w / 2, card.y - card.h / 2, card.w, card.h, 26, C.cream, C.gold, 0.99, 1, 3);
      g.fillStyle(0xFFF2C9, 0.52);
      g.fillRoundedRect(card.x - card.w / 2 + 15, card.y - card.h / 2 + 15, card.w - 30, 12, 6);

      const animals = this.currentChapterAnimals();
      for (let i = 0; i < animals.length; i++) {
        drawMedallion(g, animals[i], 159 + i * 74, card.y - 22, 0.55, {});
      }

      const b = L.doneButton;
      drawPill(g, b.x, b.y, b.w, b.h, C.red, C.goldDeep, 1, 1, 2.4);
      this.addText(card.x, card.y - 101, '这一段过河啦！', 29, '#96382D', { title: true, depth: DEPTH.cardText });
      this.addText(card.x, card.y + 45, '四只小动物都按顺序到了对岸', 16, '#6A533C', { depth: DEPTH.cardText });
      this.addText(card.x, card.y + 77, '它们排好队，等着下一段故事', 14, '#937557', { depth: DEPTH.cardText });
      this.addText(b.x, b.y - 1, this.chapter >= CHAPTER_COUNT - 1 ? '看看大团圆  ›' : '继续渡河  ›', 20, '#FFF8E8', { depth: DEPTH.cardText, weight: 'bold' });
    }

    onShutdown() {
      this.clearLiveProps();
      this.clearTexts();
      this.fxParticles.length = 0;
      Speech.cancel();
      if (this.input && this.input.off) {
        this.input.off('pointerdown', this.onPointerDown, this);
        this.input.off('pointermove', this.onPointerMove, this);
        this.input.off('pointerup', this.onPointerUp, this);
        this.input.off('pointerupoutside', this.onPointerUp, this);
      }
    }
  }

  window.ZodiacScene = ZodiacScene;
})();
