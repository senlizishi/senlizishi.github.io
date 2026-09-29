/*
 * 小兔跳跳：小兔子匀速自动向前跑，全程只有「跳」一个操作。
 * 点屏幕任意处 / 空格起跳，空中再点一次是二段跳；跳过浅浅的小土坑、
 * 从小调皮头顶踩过去；撞到小调皮就哭一下，然后继续跑；收集胡萝卜和星星。
 * 没有死亡、没有扣分、没有倒计时、没有吓人的东西。
 * 每关固定距离，跑满就结算，然后自动开下一关。
 */
(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;
  const choose = (landscape, portrait) => (IS_PORTRAIT ? portrait : landscape);
  const FONT = 'Microsoft YaHei, sans-serif';

  // ------------------------------------------------------------ 手感
  const RUN_SPEED = choose(230, 190);      // 匀速前进，全程不加速
  const GRAVITY = 2200;
  const JUMP_V = -900;
  const DOUBLE_JUMP_V = -780;
  const COYOTE_TIME = 0.12;                // 走出坑沿后仍能起跳的宽容时间
  const JUMP_BUFFER = 0.15;                // 落地前先按，落地立刻起跳

  // ------------------------------------------------------------ 关卡
  const LEVEL_LENGTH = 6000;               // 每关固定距离（世界像素）
  const START_SAFE = 700;                  // 开局安全带，不放任何障碍
  const GAP_MIN = 340;                     // 障碍之间留很宽的反应时间
  const GAP_MAX = 520;
  const CLEAR_DELAY = 2600;                // 结算面板停留多久（毫秒）
  const HINT_HOLD = 900;

  // ------------------------------------------------------------ 尺寸
  const GROUND_Y = choose(421, 748);
  const RABBIT_SCREEN_X = choose(160, 120);
  const RABBIT_W = choose(58, 64);
  const RABBIT_H = choose(74, 82);
  const RABBIT_HALF_W = RABBIT_W * 0.5;
  const PIT_W_MIN = 70;
  const PIT_W_MAX = 100;
  const PIT_FALL_DEPTH = 46;
  const STUMBLE_TIME = 0.8;
  const CRY_TIME = 0.7;
  const HUD_INSET = 84;                    // 给左上角的返回按钮让位
  const HUD_Y = choose(34, 36);
  const PILL_W = 56;
  const PILL_H = 30;
  const PILL_GAP = 6;
  const MUTE_W = 78;
  const MUTE_H = 30;
  const BAR_W = choose(300, 220);
  const BAR_H = 9;

  // ------------------------------------------------------------ 数值
  const ITEM_VALUE = { carrot: 10, star: 30, flower: 15 };
  const ITEM_WEIGHT = [['carrot', 55], ['star', 25], ['flower', 20]];
  const STOMP_SCORE = 20;
  const RAINBOW_CARROTS = 10;
  const ENEMY_HEIGHT = { ladybug: 34, mushroom: 44, hedgehog: 34 };
  const ENEMY_HALF_W = { ladybug: 22, mushroom: 24, hedgehog: 27 };
  const ENEMY_WEIGHT = [['ladybug', 40], ['mushroom', 35], ['hedgehog', 25]];

  const FLOWER_PETALS = [0xff9ecb, 0x8fb8ff, 0xffd84e, 0xb8a4ff, 0xffa8c8, 0x9be3ff];
  const SKY_TOP = 0xbfe9ff;
  const SKY_BOTTOM = 0xe8f8ff;
  const SUN = 0xfff3b0;
  const HILL_FAR = 0xb8ecc0;
  const HILL_NEAR = 0x96dfa0;
  const GRASS = 0x8ede86;
  const GRASS_EDGE = 0x6fc46a;
  const SOIL = 0xd8b98a;
  const SOIL_DARK = 0xc0a072;
  const PIT_DARK = 0x6f5741;
  const PIT_INNER = 0x8a6f52;
  const WHITE = 0xffffff;
  const SHADE = 0xe9eff6;
  const INK = 0x4a3b52;

  const TITLE_COLOR = '#3d6b4e';
  const SUB_COLOR = '#5f7f68';
  const SOFT_COLOR = '#7f9a86';

  // ------------------------------------------------------------ 基础工具
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function wrap(value, span) { return ((value % span) + span) % span; }

  function randomRange(min, max) { return min + Math.random() * (max - min); }

  function randomInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  function pickWeighted(pairs) {
    let total = 0;
    for (let i = 0; i < pairs.length; i += 1) total += pairs[i][1];
    let roll = Math.random() * total;
    for (let i = 0; i < pairs.length; i += 1) {
      roll -= pairs[i][1];
      if (roll <= 0) return pairs[i][0];
    }
    return pairs[pairs.length - 1][0];
  }

  function lerpColor(from, to, t) {
    const fr = (from >> 16) & 0xff;
    const fg = (from >> 8) & 0xff;
    const fb = from & 0xff;
    const tr = (to >> 16) & 0xff;
    const tg = (to >> 8) & 0xff;
    const tb = to & 0xff;
    const r = Math.round(fr + (tr - fr) * t);
    const g = Math.round(fg + (tg - fg) * t);
    const b = Math.round(fb + (tb - fb) * t);
    return (r << 16) | (g << 8) | b;
  }

  function hsvColor(hue, sat, val) {
    const h = wrap(hue, 360) / 60;
    const c = val * sat;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = val - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 1) { r = c; g = x; } else if (h < 2) { r = x; g = c; }
    else if (h < 3) { g = c; b = x; } else if (h < 4) { g = x; b = c; }
    else if (h < 5) { r = x; b = c; } else { r = c; b = x; }
    const ri = Math.round((r + m) * 255);
    const gi = Math.round((g + m) * 255);
    const bi = Math.round((b + m) * 255);
    return (ri << 16) | (gi << 8) | bi;
  }

  function ellipsePoints(cx, cy, rx, ry, angle, segments) {
    const count = segments || 14;
    const cos = Math.cos(angle || 0);
    const sin = Math.sin(angle || 0);
    const points = [];
    for (let i = 0; i < count; i += 1) {
      const t = (i / count) * Math.PI * 2;
      const px = Math.cos(t) * rx;
      const py = Math.sin(t) * ry;
      points.push({ x: cx + px * cos - py * sin, y: cy + px * sin + py * cos });
    }
    return points;
  }

  function halfEllipsePoints(cx, cy, rx, ry, segments) {
    const count = segments || 14;
    const points = [{ x: cx - rx, y: cy }];
    for (let i = 0; i <= count; i += 1) {
      const a = Math.PI + (i / count) * Math.PI;
      points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return points;
  }

  function starPoints(cx, cy, outer, inner, tips, rotation) {
    const points = [];
    const total = tips * 2;
    for (let i = 0; i < total; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / total) * Math.PI * 2 - Math.PI / 2 + (rotation || 0);
      points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    return points;
  }

  function fillRoundEllipse(g, cx, cy, rx, ry, angle, color, alpha) {
    g.fillStyle(color, alpha === undefined ? 1 : alpha);
    g.fillPoints(ellipsePoints(cx, cy, rx, ry, angle), true);
  }

  // ------------------------------------------------------------ 音效 / 音乐
  // 全部用 WebAudio 实时合成，不加载任何音频文件；音色只用柔和的
  // 正弦与三角波，没有鼓点、没有吓人的音效。
  const NOTE = {
    G3: 196.0, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0,
    A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
    G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.51, G6: 1567.98,
  };

  const RabbitAudio = {
    context: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    timer: null,
    nextNoteTime: 0,
    step: 0,
    muted: false,
    musicVolume: 0.3,
    sfxVolume: 0.62,
    started: false,

    start() {
      try {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return false;
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.musicGain = this.context.createGain();
          this.sfxGain = this.context.createGain();
          this.master.gain.value = 0.95;
          this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
          this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
          this.musicGain.connect(this.master);
          this.sfxGain.connect(this.master);
          this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume();
        if (!this.timer) {
          this.nextNoteTime = this.context.currentTime + 0.06;
          this.step = 0;
          this.timer = window.setInterval(() => this.scheduleMusic(), 80);
        }
        this.started = true;
        return true;
      } catch (_) {
        return false;
      }
    },

    toggleMute() {
      this.start();
      this.muted = !this.muted;
      const now = this.context ? this.context.currentTime : 0;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.muted ? 0 : this.musicVolume, now, 0.03);
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.muted ? 0 : this.sfxVolume, now, 0.03);
      return !this.muted;
    },

    tone(frequency, duration, wave, gain, when, destination) {
      if (!this.context || this.muted) return;
      const target = destination || this.sfxGain;
      if (!target) return;
      const now = when || this.context.currentTime;
      const osc = this.context.createOscillator();
      const amp = this.context.createGain();
      osc.type = wave || 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.02);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp);
      amp.connect(target);
      osc.start(now);
      osc.stop(now + duration + 0.04);
    },

    sweep(from, to, duration, wave, gain) {
      if (!this.context || this.muted || !this.sfxGain) return;
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const amp = this.context.createGain();
      osc.type = wave || 'sine';
      osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + duration);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.025);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp);
      amp.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + duration + 0.04);
    },

    // 原创轻快儿歌循环：C 大调、圆润主奏 + 柔和和弦，八分音符 32 步约 10 秒一轮
    scheduleMusic() {
      if (!this.context || !this.musicGain || this.context.state !== 'running') return;
      const lookAhead = 0.62;
      const beat = (60 / 96) / 2;
      const melody = [
        NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, 0,
        NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, 0,
        NOTE.G4, NOTE.A4, NOTE.C5, NOTE.D5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.A4,
        NOTE.G4, NOTE.A4, NOTE.C5, NOTE.E5, NOTE.D5, NOTE.C5, 0, 0,
      ];
      const chords = [
        [NOTE.C4, NOTE.E4, NOTE.G4],
        [NOTE.F4, NOTE.A4, NOTE.C5],
        [NOTE.G4, NOTE.B4, NOTE.D5],
        [NOTE.F4, NOTE.A4, NOTE.C5],
      ];
      while (this.nextNoteTime < this.context.currentTime + lookAhead) {
        const step = this.step % melody.length;
        const note = melody[step];
        if (note) {
          this.tone(note, beat * 0.8, 'triangle', 0.06, this.nextNoteTime, this.musicGain);
          this.tone(note * 2, beat * 0.26, 'sine', 0.011, this.nextNoteTime + 0.012, this.musicGain);
        }
        if (step % 8 === 0) {
          const chord = chords[Math.floor(step / 8) % chords.length];
          for (let i = 0; i < chord.length; i += 1) {
            this.tone(chord[i], beat * 7.4, i === 0 ? 'sine' : 'triangle',
              i === 0 ? 0.024 : 0.011, this.nextNoteTime, this.musicGain);
          }
        }
        if (step % 8 === 4) {
          const chord = chords[Math.floor(step / 8) % chords.length];
          this.tone(chord[2], beat * 1.3, 'sine', 0.014, this.nextNoteTime, this.musicGain);
        }
        this.nextNoteTime += beat;
        this.step += 1;
      }
    },

    tap() { this.start(); this.tone(660, 0.09, 'sine', 0.13); },
    jump() {
      this.start();
      this.sweep(420, 780, 0.16, 'sine', 0.13);
      this.tone(NOTE.C6, 0.07, 'sine', 0.045, this.context ? this.context.currentTime + 0.03 : 0);
    },
    doubleJump() { this.start(); this.sweep(620, 1120, 0.18, 'triangle', 0.11); },
    land() { this.start(); this.tone(220, 0.08, 'sine', 0.06); },
    stomp() {
      this.start();
      this.tone(300, 0.07, 'square', 0.045);
      this.tone(560, 0.13, 'triangle', 0.08, this.context ? this.context.currentTime + 0.02 : 0);
    },
    collectCarrot() {
      this.start();
      this.tone(NOTE.A5, 0.08, 'triangle', 0.08);
      this.tone(NOTE.C6, 0.1, 'sine', 0.05, this.context ? this.context.currentTime + 0.05 : 0);
    },
    collectStar() {
      this.start();
      if (!this.context || this.muted) return;
      const when = this.context.currentTime;
      [NOTE.E5, NOTE.A5, NOTE.C6].forEach((freq, index) => this.tone(freq, 0.14, 'sine', 0.07, when + index * 0.045));
    },
    collectFlower() {
      this.start();
      this.tone(NOTE.F5, 0.09, 'sine', 0.07);
      this.tone(NOTE.A5, 0.13, 'sine', 0.05, this.context ? this.context.currentTime + 0.06 : 0);
    },
    cry() {
      this.start();
      if (!this.context || this.muted) return;
      const when = this.context.currentTime;
      this.sweep(470, 330, 0.22, 'sine', 0.06);
      this.tone(NOTE.E5, 0.18, 'triangle', 0.045, when + 0.08);
    },
    pit() {
      this.start();
      if (!this.context || this.muted) return;
      this.sweep(320, 200, 0.18, 'sine', 0.08);
      this.tone(NOTE.G3, 0.24, 'sine', 0.055, this.context.currentTime + 0.16);
    },
    levelClear() {
      this.start();
      if (!this.context || this.muted) return;
      const when = this.context.currentTime;
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].forEach((freq, index) => this.tone(freq, 0.32, 'triangle', 0.09, when + index * 0.1));
    },
    rainbow() {
      this.start();
      if (!this.context || this.muted) return;
      const when = this.context.currentTime;
      [NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C6 * 2].forEach((freq, index) => this.tone(freq, 0.22, 'sine', 0.07, when + index * 0.07));
    },
  };
  window.RabbitAudio = RabbitAudio;

  // ------------------------------------------------------------ 道具 / 小怪 / 兔子
  function drawItemShape(g, kind, cx, cy, scale, spin) {
    const s = scale;
    if (kind === 'carrot') {
      fillRoundEllipse(g, cx - 4.6 * s, cy - 12 * s, 3.2 * s, 7.2 * s, -0.55, 0x6fc46a);
      fillRoundEllipse(g, cx + 4.6 * s, cy - 12 * s, 3.2 * s, 7.2 * s, 0.55, 0x6fc46a);
      fillRoundEllipse(g, cx, cy - 14.4 * s, 3 * s, 8 * s, 0, 0x7ed492);
      g.fillStyle(0xff9a3d, 1);
      g.fillPoints([
        { x: cx - 8.6 * s, y: cy - 8 * s },
        { x: cx + 8.6 * s, y: cy - 8 * s },
        { x: cx, y: cy + 13.5 * s },
      ], true);
      g.lineStyle(Math.max(1, 1.5 * s), 0xe07a20, 0.9);
      g.beginPath();
      g.moveTo(cx - 4.8 * s, cy - 3 * s);
      g.lineTo(cx + 3.4 * s, cy - 3 * s);
      g.moveTo(cx - 3 * s, cy + 2.4 * s);
      g.lineTo(cx + 1.6 * s, cy + 2.4 * s);
      g.strokePath();
      return;
    }
    if (kind === 'star') {
      const rotate = spin || 0;
      g.fillStyle(0xffd84e, 1);
      g.fillPoints(starPoints(cx, cy, 13.5 * s, 6 * s, 5, rotate), true);
      g.lineStyle(Math.max(1, 1.7 * s), 0xc78a12, 0.9);
      g.strokePoints(starPoints(cx, cy, 13.5 * s, 6 * s, 5, rotate), true, true);
      g.fillStyle(0xfff6c8, 0.92);
      g.fillCircle(cx - 3.2 * s, cy - 3.4 * s, 2.5 * s);
      return;
    }
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(0xff9ecb, 1);
      g.fillCircle(cx + Math.cos(a) * 8 * s, cy + Math.sin(a) * 8 * s, 6.4 * s);
    }
    g.fillStyle(0xfff3b0, 1);
    g.fillCircle(cx, cy, 4.6 * s);
    g.fillStyle(0xffe9a0, 1);
    g.fillCircle(cx - 1 * s, cy - 1 * s, 2 * s);
  }

  function drawEnemyShape(g, type, cx, cy, scale) {
    const s = scale;
    if (type === 'ladybug') {
      g.lineStyle(Math.max(1.4, 2.2 * s), 0x3a3340, 1);
      g.beginPath();
      for (let i = -1; i <= 1; i += 1) {
        g.moveTo(cx + i * 8 * s, cy + 8 * s);
        g.lineTo(cx + i * 12 * s, cy + 16 * s);
      }
      g.strokePath();
      fillRoundEllipse(g, cx, cy - 2 * s, 19.4 * s, 13.4 * s, 0, 0xc2474f);
      fillRoundEllipse(g, cx, cy - 3 * s, 18.4 * s, 12.4 * s, 0, 0xff6b6b);
      g.lineStyle(Math.max(1, 1.6 * s), 0x3a3340, 1);
      g.beginPath();
      g.moveTo(cx - 16 * s, cy - 3 * s);
      g.lineTo(cx + 12 * s, cy - 3 * s);
      g.strokePath();
      g.fillStyle(0x3a3340, 1);
      g.fillCircle(cx - 9 * s, cy - 7 * s, 3.4 * s);
      g.fillCircle(cx - 2 * s, cy + 4 * s, 3.2 * s);
      g.fillCircle(cx + 6 * s, cy - 6 * s, 3 * s);
      g.fillStyle(0x3a3340, 1);
      g.fillCircle(cx + 15 * s, cy + 1 * s, 8.4 * s);
      g.fillStyle(WHITE, 1);
      g.fillCircle(cx + 17.4 * s, cy - 1.4 * s, 3 * s);
      g.fillCircle(cx + 11.6 * s, cy - 1.4 * s, 2.6 * s);
      g.fillStyle(0x241c26, 1);
      g.fillCircle(cx + 17.8 * s, cy - 0.8 * s, 1.5 * s);
      g.fillCircle(cx + 12 * s, cy - 0.8 * s, 1.3 * s);
      g.lineStyle(Math.max(1, 1.8 * s), 0x3a3340, 1);
      g.beginPath();
      g.moveTo(cx + 18 * s, cy - 6 * s);
      g.lineTo(cx + 25 * s, cy - 16 * s);
      g.moveTo(cx + 13 * s, cy - 8 * s);
      g.lineTo(cx + 16 * s, cy - 17 * s);
      g.strokePath();
      return;
    }
    if (type === 'mushroom') {
      g.fillStyle(0xfff6ea, 1);
      g.fillRoundedRect(cx - 9 * s, cy - 4 * s, 18 * s, 26 * s, 7 * s);
      g.lineStyle(Math.max(1, 1.8 * s), 0xe8cbb0, 1);
      g.strokeRoundedRect(cx - 9 * s, cy - 4 * s, 18 * s, 26 * s, 7 * s);
      g.fillStyle(0xd97f57, 1);
      g.fillPoints(halfEllipsePoints(cx, cy + 2 * s, 24 * s, 23 * s), true);
      g.fillStyle(0xff9f7a, 1);
      g.fillPoints(halfEllipsePoints(cx, cy + 1 * s, 22.6 * s, 21.6 * s), true);
      g.fillStyle(0xfff3e0, 1);
      g.fillCircle(cx - 10 * s, cy - 10 * s, 4 * s);
      g.fillCircle(cx + 4 * s, cy - 16 * s, 3.4 * s);
      g.fillCircle(cx + 12 * s, cy - 6 * s, 3 * s);
      g.fillStyle(0x5a4a44, 1);
      g.fillCircle(cx - 4.4 * s, cy + 8 * s, 2.2 * s);
      g.fillCircle(cx + 4.4 * s, cy + 8 * s, 2.2 * s);
      g.fillStyle(0xff9dbb, 1);
      g.fillCircle(cx, cy + 13 * s, 2 * s);
      return;
    }
    g.fillStyle(0xa9814f, 1);
    for (let i = -3; i <= 3; i += 1) {
      const bx = cx + i * 7.2 * s;
      g.fillTriangle(bx - 3.6 * s, cy + 1 * s, bx + 3.6 * s, cy + 1 * s, bx, cy - 13 * s);
    }
    fillRoundEllipse(g, cx, cy + 2 * s, 24 * s, 13 * s, 0, 0xb98f63);
    fillRoundEllipse(g, cx, cy + 1.4 * s, 22.6 * s, 11.8 * s, 0, 0xc9a37a);
    fillRoundEllipse(g, cx - 2 * s, cy + 5 * s, 15 * s, 6.6 * s, 0, 0xffe8cf);
    fillRoundEllipse(g, cx + 19 * s, cy + 5 * s, 9 * s, 7 * s, 0, 0xfff1dd);
    g.fillStyle(INK, 1);
    g.fillCircle(cx + 26 * s, cy + 4 * s, 3 * s);
    g.fillCircle(cx + 14 * s, cy - 2 * s, 2.9 * s);
    g.fillStyle(WHITE, 1);
    g.fillCircle(cx + 15 * s, cy - 3 * s, 1.1 * s);
    g.fillStyle(0xb98f63, 1);
    g.fillEllipse(cx - 12 * s, cy + 15.6 * s, 10 * s, 5 * s);
    g.fillEllipse(cx + 6 * s, cy + 15.6 * s, 10 * s, 5 * s);
  }

  // 兔子以「四只脚踩在原点」为锚点作画，身体往负 y 方向长；
  // 这样 setScale 与压扁都绕脚下缩放，不会被拉偏。
  function drawRabbitShape(g, pose) {
    const W = RABBIT_W;
    const squash = clamp(pose.squash || 0, 0, 1);
    const sy = 1 - squash * 0.3;
    const sx = 1 + squash * 0.17;
    const X = (v) => v * sx;
    const Y = (v) => v * sy;
    const lean = pose.lean || 0;
    const shake = (pose.wiggle || 0) * 7;
    const phase = pose.legPhase || 0;
    const airborne = !!pose.airborne;
    const crying = pose.cry > 0;

    const groundLocal = pose.groundY - pose.y;
    const air = clamp(groundLocal / 220, 0, 1);
    g.fillStyle(0x4f8a5c, 0.2 * (1 - air * 0.8));
    g.fillEllipse(0, groundLocal + 5, W * 0.92 * (1 - air * 0.32), 13 * (1 - air * 0.34));

    const legLift = airborne ? 9 : 0;
    fillRoundEllipse(g, X(-8) - (airborne ? 4 : Math.sin(phase) * 3.2),
      Y(-6) - legLift - (airborne ? 0 : Math.max(0, Math.sin(phase)) * 3.4), 8.4, 5.6, -0.14, SHADE);
    g.fillStyle(SHADE, 1);
    g.fillCircle(X(-17), Y(-22), 7.4);
    g.fillStyle(WHITE, 1);
    g.fillCircle(X(-16), Y(-23), 6.2);

    fillRoundEllipse(g, X(0), Y(-24) + 1.6, 19.6, 16.4, 0, SHADE);
    fillRoundEllipse(g, X(0), Y(-24), 19, 15.8, 0, WHITE);
    fillRoundEllipse(g, X(3), Y(-21), 11.2, 9, -0.2, 0xfdfdff);

    fillRoundEllipse(g, X(10) + (airborne ? 3 : Math.sin(phase + Math.PI) * 3.2),
      Y(-5) + 1 - legLift - (airborne ? 0 : Math.max(0, -Math.sin(phase)) * 3.2), 9, 5.8, 0.16, WHITE);

    const headX = X(7) + lean * 10 + shake;
    const headY = Y(-46);
    g.fillStyle(SHADE, 1);
    g.fillCircle(headX, headY + 1.6, 17.2);
    g.fillStyle(WHITE, 1);
    g.fillCircle(headX, headY, 16.6);

    const wave = Math.sin(pose.elapsed * 3.2) * 0.1 + lean * 0.65 + shake * 0.02;
    const ears = [{ dx: -7, ry: 17, angle: -0.3 }, { dx: 6, ry: 17.8, angle: 0.17 }];
    for (let i = 0; i < ears.length; i += 1) {
      const ear = ears[i];
      const cxx = headX + X(ear.dx);
      const cyy = headY - 18 * sy;
      const angle = ear.angle + wave;
      const hue = pose.elapsed * 62 + i * 74;
      const outer = pose.rainbow ? hsvColor(hue, 0.7, 1) : WHITE;
      const inner = pose.rainbow ? hsvColor(hue + 42, 0.4, 1) : 0xffd0e0;
      fillRoundEllipse(g, cxx, cyy, 5.8, ear.ry, angle, 0xe3ebf3);
      fillRoundEllipse(g, cxx, cyy - 0.9, 5.1, ear.ry - 1.5, angle, outer);
      fillRoundEllipse(g, cxx + X(0.5), cyy - 1.8, 2.4, ear.ry - 4.6, angle, inner);
    }

    g.fillStyle(0xffd6e4, 0.95);
    g.fillCircle(headX + X(8), headY + 8, 4.6);

    const blink = pose.elapsed % 4.2 < 0.14;
    if (blink) {
      g.fillStyle(INK, 1);
      g.fillRect(headX + X(3.4), headY - 0.8, 6.4, 2);
    } else {
      fillRoundEllipse(g, headX + X(5.4), headY - 1, 3.3, 3.9, 0, INK);
      g.fillStyle(WHITE, 1);
      g.fillCircle(headX + X(6.5), headY - 2.4, 1.3);
    }
    g.fillStyle(0xff9dbb, 1);
    g.fillCircle(headX + X(12.4), headY + 2, 2.5);
    g.lineStyle(1.6, 0xd98aa6, 0.9);
    g.beginPath();
    g.moveTo(headX + X(12.4), headY + 4);
    g.lineTo(headX + X(11.6), headY + 5.8);
    g.strokePath();
    if (crying) {
      const tearWave = Math.sin(pose.elapsed * 22) * 2;
      g.fillStyle(0x79cfff, 0.92);
      g.fillEllipse(headX + X(5.4), headY + 8 + tearWave, 2.6, 5.5);
      g.fillEllipse(headX + X(11.8), headY + 8 - tearWave, 2.6, 5.5);
      g.fillStyle(0x6c91a8, 0.95);
      g.fillEllipse(headX + X(9), headY + 11, 4.2, 3.2);
    }
  }

  // ------------------------------------------------------------ 场景
  class RabbitGameScene extends Phaser.Scene {
    constructor() { super('RabbitGameScene'); }

    create() {
      this.state = 'menu';
      this.elapsed = 0;
      this.level = 1;
      this.distance = 0;
      this.runPhase = 0;
      this.rabbitX = WIDTH / 2;
      this.rabbitY = GROUND_Y;
      this.rabbitScale = choose(1.18, 1.26);
      this.vy = 0;
      this.onGround = true;
      this.jumps = 0;
      this.coyote = 0;
      this.buffer = 0;
      this.squash = 0;
      this.lean = 0;
      this.wiggle = 0;
      this.stumble = null;
      this.cryTimer = 0;
      this.rainbowEars = false;
      this.score = 0;
      this.carrotTotal = 0;
      this.starTotal = 0;
      this.flowerTotal = 0;
      this.levelCarrot = 0;
      this.levelStar = 0;
      this.levelFlower = 0;
      this.levelScore = 0;
      this.pits = [];
      this.enemies = [];
      this.items = [];
      this.decor = [];
      this.particles = [];
      this.menuItems = [];
      this.overlayItems = [];
      this.toast = null;
      this.hintText = null;
      this.clearTimer = null;
      this.celebrateTimer = 0;
      this.hudVisible = false;

      this.clouds = [];
      for (let i = 0; i < 8; i += 1) {
        this.clouds.push({
          x: randomRange(-160, WIDTH + 160),
          y: randomRange(choose(38, 116), choose(196, 382)),
          s: randomRange(0.68, 1.34),
          speed: randomRange(0.75, 1.35),
        });
      }

      this.skyGraphics = this.add.graphics().setDepth(0);
      this.cloudGraphics = this.add.graphics().setDepth(1);
      this.hillsGraphics = this.add.graphics().setDepth(2);
      this.groundGraphics = this.add.graphics().setDepth(3);
      this.rabbitGraphics = this.add.graphics().setDepth(6);
      this.fxGraphics = this.add.graphics().setDepth(7);
      this.barGraphics = this.add.graphics().setDepth(20);
      this.hudGraphics = this.add.graphics().setDepth(20);
      this.overlayGraphics = this.add.graphics().setDepth(30);

      const KeyCodes = Phaser.Input.Keyboard.KeyCodes;
      this.keys = this.input.keyboard ? this.input.keyboard.addKeys({
        space: KeyCodes.SPACE, up: KeyCodes.UP, w: KeyCodes.W,
      }) : null;

      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));

      this.drawSky();
      this.createHud();
      this.showMenu();
    }

    // -------------------------------------------------------- 背景
    drawSky() {
      const g = this.skyGraphics;
      g.clear();
      const bands = 26;
      const span = GROUND_Y + 20;
      for (let i = 0; i < bands; i += 1) {
        const t = i / (bands - 1);
        g.fillStyle(lerpColor(SKY_TOP, SKY_BOTTOM, t), 1);
        g.fillRect(0, (span / bands) * i, WIDTH, span / bands + 1);
      }
      const sunX = WIDTH * 0.82;
      const sunY = choose(HEIGHT * 0.16, HEIGHT * 0.13);
      g.fillStyle(SUN, 0.34);
      g.fillCircle(sunX, sunY, 54);
      g.fillStyle(0xffe98a, 0.5);
      g.fillCircle(sunX, sunY, 42);
      g.fillStyle(SUN, 1);
      g.fillCircle(sunX, sunY, 33);
    }

    drawClouds() {
      const g = this.cloudGraphics;
      g.clear();
      const span = WIDTH + 360;
      g.fillStyle(WHITE, 0.92);
      for (let i = 0; i < this.clouds.length; i += 1) {
        const cloud = this.clouds[i];
        const x = wrap(cloud.x - this.distance * 0.25 * cloud.speed, span) - 180;
        const y = cloud.y;
        const s = cloud.s;
        g.fillEllipse(x, y, 96 * s, 44 * s);
        g.fillEllipse(x - 38 * s, y + 8 * s, 62 * s, 32 * s);
        g.fillEllipse(x + 40 * s, y + 6 * s, 66 * s, 34 * s);
        g.fillEllipse(x + 6 * s, y - 16 * s, 54 * s, 34 * s);
      }
    }

    drawHills() {
      const g = this.hillsGraphics;
      g.clear();
      const layers = [
        { spacing: 214, radius: 104, color: HILL_FAR, factor: 0.3, jitter: 30 },
        { spacing: 152, radius: 70, color: HILL_NEAR, factor: 0.5, jitter: 20 },
      ];
      for (let l = 0; l < layers.length; l += 1) {
        const layer = layers[l];
        const shift = wrap(this.distance * layer.factor, layer.spacing);
        const count = Math.ceil(WIDTH / layer.spacing) + 3;
        for (let i = 0; i < count; i += 1) {
          const x = i * layer.spacing - shift - layer.spacing;
          const wx = x + this.distance * layer.factor;
          const radius = layer.radius + Math.sin(wx * 0.0125) * layer.jitter;
          g.fillStyle(layer.color, 1);
          g.fillCircle(x, GROUND_Y + 10, radius);
        }
      }
    }

    drawGround() {
      const g = this.groundGraphics;
      g.clear();
      g.fillStyle(GRASS, 1);
      g.fillRect(0, GROUND_Y, WIDTH, 20);
      g.fillStyle(GRASS_EDGE, 1);
      g.fillRect(0, GROUND_Y + 20, WIDTH, 6);
      g.fillStyle(SOIL, 1);
      g.fillRect(0, GROUND_Y + 26, WIDTH, HEIGHT - GROUND_Y - 26);
      g.fillStyle(SOIL_DARK, 0.55);
      g.fillRect(0, GROUND_Y + 26, WIDTH, 3);

      for (let i = 0; i < this.decor.length; i += 1) {
        const d = this.decor[i];
        const sx = d.x - this.distance + RABBIT_SCREEN_X;
        if (sx < -30 || sx > WIDTH + 30) continue;
        this.drawDecor(g, d, sx);
      }

      for (let i = 0; i < this.pits.length; i += 1) {
        const pit = this.pits[i];
        const x0 = pit.x0 - this.distance + RABBIT_SCREEN_X;
        const x1 = pit.x1 - this.distance + RABBIT_SCREEN_X;
        if (x1 < -20 || x0 > WIDTH + 20) continue;
        const w = Math.max(4, x1 - x0);
        g.fillStyle(PIT_DARK, 1);
        g.fillRect(x0, GROUND_Y, w, HEIGHT - GROUND_Y);
        g.fillStyle(PIT_INNER, 1);
        g.fillRect(x0 + 4, GROUND_Y + 8, Math.max(2, w - 8), HEIGHT - GROUND_Y - 8);
        g.fillStyle(0x5fa85c, 1);
        g.fillRect(x0, GROUND_Y, 4, 26);
        g.fillStyle(0x5fa85c, 1);
        g.fillRect(x1 - 4, GROUND_Y, 4, 26);
      }
    }

    drawDecor(g, d, sx) {
      const base = GROUND_Y + 3;
      const s = d.variant;
      if (d.kind === 'tuft') {
        g.lineStyle(Math.max(1.5, 2.4 * s), 0x5fb85c, 1);
        g.beginPath();
        g.moveTo(sx - 6 * s, base);
        g.lineTo(sx - 9 * s, base - 13 * s);
        g.moveTo(sx, base);
        g.lineTo(sx, base - 17 * s);
        g.moveTo(sx + 6 * s, base);
        g.lineTo(sx + 9 * s, base - 12 * s);
        g.strokePath();
        return;
      }
      if (d.kind === 'flower') {
        const cy = base - 12 * s;
        g.lineStyle(Math.max(1.3, 2 * s), 0x6fc46a, 1);
        g.beginPath();
        g.moveTo(sx, base);
        g.lineTo(sx, cy + 4 * s);
        g.strokePath();
        g.fillStyle(FLOWER_PETALS[d.hue % FLOWER_PETALS.length], 1);
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          g.fillCircle(sx + Math.cos(a) * 4.4 * s, cy + Math.sin(a) * 4.4 * s, 3.4 * s);
        }
        g.fillStyle(0xfff3b0, 1);
        g.fillCircle(sx, cy, 2.8 * s);
        return;
      }
      g.fillStyle(SOIL_DARK, 0.85);
      g.fillEllipse(sx, base - 3 * s, 9 * s, 5 * s);
      g.fillStyle(0xe6cda4, 1);
      g.fillEllipse(sx - 1 * s, base - 4 * s, 6 * s, 3.2 * s);
    }

    // -------------------------------------------------------- 关卡
    buildLevel() {
      this.pits = [];
      this.enemies = [];
      this.items = [];
      this.decor = [];

      let cursor = START_SAFE;
      let guard = 0;
      while (cursor < LEVEL_LENGTH - 340 && guard < 200) {
        guard += 1;
        cursor += randomRange(GAP_MIN, GAP_MAX);
        if (cursor > LEVEL_LENGTH - 340) break;
        const roll = Math.random();
        if (roll < 0.34) {
          const width = randomRange(PIT_W_MIN, PIT_W_MAX);
          this.pits.push({ x0: cursor, x1: cursor + width, falls: 0, cleared: false });
          if (Math.random() < 0.62) {
            for (let i = 0; i < 3; i += 1) {
              const t = i / 2;
              this.addItem(pickWeighted(ITEM_WEIGHT), cursor - 6 + (width + 12) * t,
                GROUND_Y - 78 - Math.sin(t * Math.PI) * 52);
            }
          }
          cursor += width;
        } else if (roll < 0.72) {
          this.addEnemy(cursor);
        } else {
          const count = randomInt(2, 4);
          for (let i = 0; i < count; i += 1) {
            this.addItem(pickWeighted(ITEM_WEIGHT), cursor + i * 56, GROUND_Y - 62);
          }
          cursor += (count - 1) * 56;
        }
      }

      // 兜底：随机偶尔会凑出一关「空跑」，这里补上至少 1 个土坑和 2 只小调皮。
      // 位置从固定槽位里挑，和已有障碍保持 GAP_MIN 以上的稀疏间距。
      const slotStart = START_SAFE + 260;
      const slotStep = (LEVEL_LENGTH - 500 - slotStart) / 7;
      const slots = [];
      for (let i = 0; i < 7; i += 1) slots.push(slotStart + i * slotStep);
      const slotFree = (x) => {
        if (x < START_SAFE + 200 || x > LEVEL_LENGTH - 460) return false;
        for (let i = 0; i < this.pits.length; i += 1) {
          if (x > this.pits[i].x0 - GAP_MIN && x < this.pits[i].x1 + GAP_MIN) return false;
        }
        for (let i = 0; i < this.enemies.length; i += 1) {
          if (Math.abs(this.enemies[i].baseX - x) < GAP_MIN) return false;
        }
        return true;
      };
      const takeSlot = () => {
        for (let i = 0; i < slots.length; i += 1) {
          if (slotFree(slots[i])) return slots.splice(i, 1)[0];
        }
        return -1;
      };
      if (this.pits.length === 0) {
        const spot = takeSlot();
        if (spot > 0) {
          this.pits.push({ x0: spot, x1: spot + randomRange(PIT_W_MIN, PIT_W_MAX), falls: 0, cleared: false });
        }
      }
      while (this.enemies.length < 2) {
        const spot = takeSlot();
        if (spot <= 0) break;
        this.addEnemy(spot);
      }

      this.buildDecor();
    }

    buildDecor() {
      const limit = LEVEL_LENGTH + WIDTH + 320;
      let x = 60;
      while (x < limit) {
        x += randomRange(64, 118);
        let insidePit = false;
        for (let i = 0; i < this.pits.length; i += 1) {
          if (x > this.pits[i].x0 - 14 && x < this.pits[i].x1 + 14) { insidePit = true; break; }
        }
        if (insidePit) continue;
        const roll = Math.random();
        if (roll < 0.4) this.decor.push({ x: x, kind: 'tuft', variant: randomRange(0.78, 1.2) });
        else if (roll < 0.72) this.decor.push({ x: x, kind: 'flower', variant: randomRange(0.8, 1.15), hue: randomInt(0, 5) });
        else this.decor.push({ x: x, kind: 'pebble', variant: randomRange(0.7, 1.1) });
      }
    }

    addItem(kind, x, y) {
      const gfx = this.add.graphics().setDepth(4);
      drawItemShape(gfx, kind, 0, 0, 1, 0);
      this.items.push({
        kind: kind, x: x, y: y, drawY: y, phase: Math.random() * Math.PI * 2,
        taken: false, gfx: gfx,
      });
    }

    addEnemy(worldX) {
      const type = pickWeighted(ENEMY_WEIGHT);
      const gfx = this.add.graphics().setDepth(5);
      drawEnemyShape(gfx, type, 0, 0, 1);
      this.enemies.push({
        type: type, baseX: worldX, offset: 0, drift: 0,
        phase: Math.random() * Math.PI * 2,
        height: ENEMY_HEIGHT[type], halfW: ENEMY_HALF_W[type],
        gone: false, gfx: gfx,
      });
    }

    clearEntities() {
      for (let i = 0; i < this.items.length; i += 1) {
        if (this.items[i].gfx) this.items[i].gfx.destroy();
      }
      for (let i = 0; i < this.enemies.length; i += 1) {
        const gfx = this.enemies[i].gfx;
        if (gfx && gfx.active) gfx.destroy();
      }
      this.items = [];
      this.enemies = [];
      this.pits = [];
      this.decor = [];
    }

    // -------------------------------------------------------- HUD
    createHud() {
      this.muteRect = { x: WIDTH - 22 - MUTE_W, y: HUD_Y - MUTE_H / 2, w: MUTE_W, h: MUTE_H };
      this.muteText = this.add.text(this.muteRect.x + MUTE_W / 2, HUD_Y, '音量', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: TITLE_COLOR,
      }).setOrigin(0.5).setDepth(21);
      this.muteHit = this.add.rectangle(this.muteRect.x + MUTE_W / 2, HUD_Y, MUTE_W, MUTE_H, WHITE, 0.001)
        .setInteractive({ useHandCursor: true }).setDepth(22);
      this.muteHit.on('pointerdown', () => {
        RabbitAudio.start();
        const on = RabbitAudio.toggleMute();
        this.muteText.setText(on ? '音量' : '已静音');
      });

      this.levelText = this.add.text(WIDTH / 2, HUD_Y + 30, '第 1 关', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: TITLE_COLOR,
        stroke: '#f2fff0', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(21);
      this.scoreText = this.add.text(WIDTH - 22, HUD_Y + 30, '分数 0', {
        fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: TITLE_COLOR,
        stroke: '#f2fff0', strokeThickness: 4,
      }).setOrigin(1, 0.5).setDepth(21);
      this.barY = HUD_Y + 56;

      this.countTexts = [];
      for (let i = 0; i < 3; i += 1) {
        const cx = HUD_INSET + PILL_W / 2 + i * (PILL_W + PILL_GAP);
        this.countTexts.push(this.add.text(cx + 11, HUD_Y, '0', {
          fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: TITLE_COLOR,
        }).setOrigin(0.5).setDepth(21));
      }

      this.playHudItems = [this.levelText, this.scoreText].concat(this.countTexts);
      this.drawHud();
    }

    drawHud() {
      const g = this.hudGraphics;
      g.clear();
      if (this.hudVisible) {
        for (let i = 0; i < 3; i += 1) {
          const cx = HUD_INSET + PILL_W / 2 + i * (PILL_W + PILL_GAP);
          g.fillStyle(WHITE, 0.72);
          g.fillRoundedRect(cx - PILL_W / 2, HUD_Y - PILL_H / 2, PILL_W, PILL_H, 15);
          g.lineStyle(2, 0xcdeedb, 0.95);
          g.strokeRoundedRect(cx - PILL_W / 2, HUD_Y - PILL_H / 2, PILL_W, PILL_H, 15);
        }
        drawItemShape(g, 'carrot', HUD_INSET + 17, HUD_Y, 0.62, 0);
        drawItemShape(g, 'star', HUD_INSET + PILL_W + PILL_GAP + 17, HUD_Y, 0.6, 0);
        drawItemShape(g, 'flower', HUD_INSET + (PILL_W + PILL_GAP) * 2 + 17, HUD_Y, 0.58, 0);
        g.fillStyle(WHITE, 0.62);
        g.fillRoundedRect(WIDTH / 2 - BAR_W / 2, this.barY - BAR_H / 2, BAR_W, BAR_H, BAR_H / 2);
      }
      g.fillStyle(WHITE, 0.72);
      g.fillRoundedRect(this.muteRect.x, this.muteRect.y, MUTE_W, MUTE_H, 15);
      g.lineStyle(2, 0xcdeedb, 0.95);
      g.strokeRoundedRect(this.muteRect.x, this.muteRect.y, MUTE_W, MUTE_H, 15);
    }

    drawBar() {
      const g = this.barGraphics;
      g.clear();
      if (!this.hudVisible) return;
      const left = WIDTH / 2 - BAR_W / 2;
      const ratio = clamp(this.distance / LEVEL_LENGTH, 0, 1);
      if (ratio > 0.012) {
        g.fillStyle(0x7ed492, 1);
        g.fillRoundedRect(left, this.barY - BAR_H / 2, Math.max(BAR_H, BAR_W * ratio), BAR_H, BAR_H / 2);
      }
      const fx = left + BAR_W + 7;
      g.lineStyle(2.4, 0x8fa88f, 1);
      g.beginPath();
      g.moveTo(fx, this.barY + 10);
      g.lineTo(fx, this.barY - 16);
      g.strokePath();
      g.fillStyle(0xff8fb3, 1);
      g.fillPoints([
        { x: fx, y: this.barY - 16 },
        { x: fx + 16, y: this.barY - 11 },
        { x: fx, y: this.barY - 6 },
      ], true);
    }

    updateHudTexts() {
      this.levelText.setText('第 ' + this.level + ' 关');
      this.scoreText.setText('分数 ' + this.score);
      this.countTexts[0].setText(String(this.carrotTotal));
      this.countTexts[1].setText(String(this.starTotal));
      this.countTexts[2].setText(String(this.flowerTotal));
    }

    setHudVisible(visible) {
      this.hudVisible = visible;
      for (let i = 0; i < this.playHudItems.length; i += 1) this.playHudItems[i].setVisible(visible);
      this.drawHud();
      this.drawBar();
    }

    pointInMute(pointer) {
      const r = this.muteRect;
      return pointer.x >= r.x && pointer.x <= r.x + r.w && pointer.y >= r.y && pointer.y <= r.y + r.h;
    }

    // -------------------------------------------------------- 标题页 / 结算面板
    showMenu() {
      this.clearMenu();
      this.clearOverlay();
      this.clearToast();
      this.clearEntities();
      this.state = 'menu';
      this.distance = 0;
      this.level = 1;
      this.rabbitX = WIDTH / 2;
      this.rabbitScale = choose(1.18, 1.26);
      this.rabbitY = GROUND_Y;
      this.onGround = true;
      this.setHudVisible(false);

      const title = this.add.text(WIDTH / 2, HEIGHT * 0.2, '小兔跳跳', {
        fontFamily: FONT, fontSize: choose('62px', '56px'), fontStyle: 'bold',
        color: TITLE_COLOR, stroke: '#f2fff0', strokeThickness: 9,
      }).setOrigin(0.5).setDepth(22);
      const subtitle = this.add.text(WIDTH / 2, HEIGHT * 0.2 + choose(58, 62),
        '小兔子一直往前跑，点一下屏幕就跳', {
          fontFamily: FONT, fontSize: choose('21px', '19px'), color: SUB_COLOR,
        }).setOrigin(0.5).setDepth(22);
      const hint = this.add.text(WIDTH / 2, HEIGHT * 0.2 + choose(96, 102),
        '空中再点一次可以跳更高 · 没有失败，慢慢玩', {
          fontFamily: FONT, fontSize: choose('16px', '15px'), color: SOFT_COLOR,
          align: 'center', wordWrap: { width: choose(620, 460) },
        }).setOrigin(0.5).setDepth(22);

      const button = this.add.rectangle(WIDTH / 2, choose(292, 560), choose(250, 270), choose(60, 68), 0x7ed492, 1)
        .setStrokeStyle(3, 0xd8f5cf, 0.95).setInteractive({ useHandCursor: true }).setDepth(22);
      const buttonText = this.add.text(button.x, button.y, '开始游戏', {
        fontFamily: FONT, fontSize: '25px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#4f9a5f', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(23);
      button.on('pointerdown', () => this.startLevel(1));

      const tapHint = this.add.text(WIDTH / 2, choose(240, 508), '也可以直接点屏幕任意位置开始', {
        fontFamily: FONT, fontSize: '15px', color: SOFT_COLOR,
      }).setOrigin(0.5).setDepth(22);

      this.menuItems.push(title, subtitle, hint, button, buttonText, tapHint);
    }

    clearMenu() {
      for (let i = 0; i < this.menuItems.length; i += 1) this.menuItems[i].destroy();
      this.menuItems = [];
    }

    startLevel(level) {
      if (this.state === 'playing') return;
      if (this.clearTimer) { this.clearTimer.remove(false); this.clearTimer = null; }
      RabbitAudio.start();
      this.clearMenu();
      this.clearOverlay();
      this.clearToast();
      if (this.hintText) { this.hintText.destroy(); this.hintText = null; }
      this.clearEntities();

      this.level = level;
      this.state = 'playing';
      this.distance = 0;
      this.runPhase = 0;
      this.rabbitX = RABBIT_SCREEN_X;
      this.rabbitScale = 1;
      this.rabbitY = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
      this.jumps = 0;
      this.coyote = COYOTE_TIME;
      this.buffer = 0;
      this.squash = 0;
      this.lean = 0;
      this.wiggle = 0;
      this.stumble = null;
      this.cryTimer = 0;
      this.levelCarrot = 0;
      this.levelStar = 0;
      this.levelFlower = 0;
      this.levelScore = 0;
      this.particles = [];

      this.buildLevel();
      this.setHudVisible(true);
      this.updateHudTexts();

      if (level === 1) {
this.hintText = this.add.text(WIDTH / 2, GROUND_Y - choose(120, 132), '点一下跳', {
          fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: TITLE_COLOR,
          stroke: '#f2fff0', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(22);
        const hint = this.hintText;
        this.tweens.add({
          targets: hint, alpha: 0, y: hint.y - 26, delay: HINT_HOLD, duration: 600,
          onComplete: () => {
            if (this.hintText === hint) this.hintText = null;
            if (hint.active) hint.destroy();
          },
        });
      }
    }

    finishLevel() {
      this.state = 'clearing';
      this.buffer = 0;
      this.stumble = null;
      RabbitAudio.levelClear();
      this.spawnStarBurst(WIDTH * 0.5, GROUND_Y - 170, 12);
      this.celebrateTimer = 0;
      this.time.delayedCall(550, () => { if (this.state === 'clearing') this.showClearOverlay(); });
      this.clearTimer = this.time.delayedCall(CLEAR_DELAY, () => this.nextLevel());
    }

    nextLevel() {
      if (this.state !== 'clearing') return;
      if (this.clearTimer) { this.clearTimer.remove(false); this.clearTimer = null; }
      this.startLevel(this.level + 1);
    }

    showClearOverlay() {
      this.clearOverlay();
      const g = this.overlayGraphics;
      const panelW = Math.min(432, WIDTH - 36);
      const panelH = choose(300, 340);
      const px = (WIDTH - panelW) / 2;
      const py = (HEIGHT - panelH) / 2;
      g.fillStyle(0x243b2c, 0.24);
      g.fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(WHITE, 0.98);
      g.fillRoundedRect(px, py, panelW, panelH, 28);
      g.lineStyle(4, 0xcdeedb, 0.95);
      g.strokeRoundedRect(px, py, panelW, panelH, 28);
      g.fillStyle(0xffd84e, 1);
      g.fillPoints(starPoints(px + 34, py + 34, 13, 5.6, 5, 0), true);
      g.fillPoints(starPoints(px + panelW - 34, py + 34, 13, 5.6, 5, 0.4), true);

      const add = (y, content, size, color, bold) => {
        const text = this.add.text(WIDTH / 2, y, content, {
          fontFamily: FONT, fontSize: size + 'px', fontStyle: bold ? 'bold' : 'normal',
          color: color, align: 'center', wordWrap: { width: panelW - 44 },
        }).setOrigin(0.5).setDepth(31);
        this.overlayItems.push(text);
      };
      add(py + 58, '闯关成功！', 34, '#3f8f5c', true);
      add(py + 98, '第 ' + this.level + ' 关跑完啦，小兔子真棒！', 18, SUB_COLOR, false);
      add(py + 136, '胡萝卜 ' + this.levelCarrot + ' · 星星 ' + this.levelStar + ' · 花朵 ' + this.levelFlower, 17, SOFT_COLOR, false);
      add(py + 168, '本关分数 ' + this.levelScore, 20, '#c98a2a', true);
      add(py + 200, '本局总分 ' + this.score, 20, TITLE_COLOR, true);

      const button = this.add.rectangle(WIDTH / 2, py + panelH - 66, 200, 52, 0x7ed492, 1)
        .setStrokeStyle(3, 0xd8f5cf, 0.95).setInteractive({ useHandCursor: true }).setDepth(31);
      const buttonText = this.add.text(WIDTH / 2, py + panelH - 66, '马上开始', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#4f9a5f', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(32);
      button.on('pointerdown', () => this.nextLevel());
      const auto = this.add.text(WIDTH / 2, py + panelH - 24, '2.6 秒后自动开始下一关', {
        fontFamily: FONT, fontSize: '14px', color: SOFT_COLOR,
      }).setOrigin(0.5).setDepth(31);
      this.overlayItems.push(button, buttonText, auto);
    }

    clearOverlay() {
      this.overlayGraphics.clear();
      for (let i = 0; i < this.overlayItems.length; i += 1) this.overlayItems[i].destroy();
      this.overlayItems = [];
    }

    showToast(message) {
      this.clearToast();
      const text = this.add.text(WIDTH / 2, HEIGHT * 0.32, message, {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#a85c74',
        align: 'center', wordWrap: { width: Math.min(WIDTH - 90, 620) },
      }).setOrigin(0.5).setDepth(29);
      const padX = 26;
      const padY = 14;
      const w = text.width + padX * 2;
      const h = text.height + padY * 2;
      const box = this.add.graphics().setDepth(28);
      box.fillStyle(WHITE, 0.94);
      box.fillRoundedRect(WIDTH / 2 - w / 2, HEIGHT * 0.32 - h / 2, w, h, 20);
      box.lineStyle(3, 0xffc9dd, 0.95);
      box.strokeRoundedRect(WIDTH / 2 - w / 2, HEIGHT * 0.32 - h / 2, w, h, 20);
      box.setAlpha(0);
      text.setAlpha(0);
      const owner = { box: box, text: text, timer: null };
      this.toast = owner;
      this.tweens.add({ targets: [box, text], alpha: 1, duration: 200, ease: 'Sine.easeOut' });
      owner.timer = this.time.delayedCall(1700, () => {
        if (this.toast !== owner) return;
        this.tweens.add({
          targets: [box, text], alpha: 0, duration: 320,
          onComplete: () => {
            if (box.active) box.destroy();
            if (text.active) text.destroy();
            if (this.toast === owner) this.toast = null;
          },
        });
      });
    }

    clearToast() {
      const toast = this.toast;
      if (!toast) return;
      this.toast = null;
      if (toast.timer) toast.timer.remove(false);
      this.tweens.killTweensOf(toast.box);
      this.tweens.killTweensOf(toast.text);
      if (toast.box && toast.box.active) toast.box.destroy();
      if (toast.text && toast.text.active) toast.text.destroy();
    }

    // -------------------------------------------------------- 输入
    onPointerDown(pointer) {
      if (this.pointInMute(pointer)) return;
      if (this.state === 'menu') { this.startLevel(1); return; }
      if (this.state !== 'playing') return;
      this.buffer = JUMP_BUFFER;
      this.applyJump();
    }

    pressedJump() {
      if (!this.keys) return false;
      const justDown = Phaser.Input.Keyboard.JustDown;
      return justDown(this.keys.space) || justDown(this.keys.up) || justDown(this.keys.w);
    }

    applyJump() {
      if (this.state !== 'playing' || this.stumble) return;
      if (this.onGround || this.coyote > 0) {
        this.vy = JUMP_V;
        this.onGround = false;
        this.coyote = 0;
        this.jumps = 1;
        this.buffer = 0;
        this.squash = 0.4;
        RabbitAudio.jump();
        this.spawnBurst(RABBIT_SCREEN_X, this.rabbitY - 4, 5, WHITE, 0.85, 44);
        return;
      }
      if (this.jumps < 2) {
        this.vy = DOUBLE_JUMP_V;
        this.jumps = 2;
        this.buffer = 0;
        this.spawnRing();
        RabbitAudio.doubleJump();
      }
    }

    // -------------------------------------------------------- 主循环
    update(time, delta) {
      const dt = Math.min(delta, 50) / 1000;
      this.elapsed += dt;

      if (this.state === 'playing') this.updatePlaying(dt);
      else if (this.state === 'clearing') this.updateClearing(dt);
      else this.updateMenu();

      this.updateParticles(dt);
      this.drawClouds();
      this.drawHills();
      this.drawGround();
      this.drawWorld();
      this.drawRabbit();
      this.drawFx();
      this.drawBar();
    }

    updateMenu() {
      this.rabbitY = GROUND_Y - Math.abs(Math.sin(this.elapsed * 2.6)) * 7;
      this.onGround = true;
      this.runPhase = this.elapsed * 5;
      this.lean = 0;
      this.wiggle = 0;
      this.squash = 0;
      if (this.pressedJump()) this.startLevel(1);
    }

    updateClearing(dt) {
      this.runPhase = this.elapsed * 9;
      this.rabbitY = GROUND_Y - Math.abs(Math.sin(this.elapsed * 5.4)) * 22;
      this.onGround = this.rabbitY >= GROUND_Y - 0.6;
      this.lean = 0;
      this.wiggle = 0;
      this.squash = 0;
      this.celebrateTimer -= dt;
      if (this.celebrateTimer <= 0) {
        this.celebrateTimer = 0.3;
        this.spawnStarBurst(randomRange(60, WIDTH - 60), GROUND_Y - randomRange(120, 300), 2);
      }
    }

    updatePlaying(dt) {
      if (this.pressedJump()) { this.buffer = JUMP_BUFFER; this.applyJump(); }

      if (this.cryTimer > 0) this.cryTimer = Math.max(0, this.cryTimer - dt);
      this.buffer = Math.max(0, this.buffer - dt);
      this.squash = Math.max(0, this.squash - dt * 3.2);

      if (this.stumble) {
        this.updateStumble(dt);
      } else {
        this.distance += RUN_SPEED * dt;
        this.runPhase += dt * (this.onGround ? 11 : 4);
        if (this.onGround) this.coyote = COYOTE_TIME;
        else this.coyote = Math.max(0, this.coyote - dt);

        const wasGround = this.onGround;
        this.vy += GRAVITY * dt;
        this.rabbitY += this.vy * dt;

        if (this.rabbitY >= GROUND_Y && this.vy >= 0) {
          const pit = this.isInPit(this.distance);
          if (pit) {
            this.startStumble(pit);
          } else {
            this.rabbitY = GROUND_Y;
            this.vy = 0;
            this.onGround = true;
            this.jumps = 0;
            this.lean = 0;
            if (!wasGround) {
              this.squash = 0.3;
              this.spawnBurst(RABBIT_SCREEN_X, GROUND_Y + 2, 5, WHITE, 0.9, 48);
              RabbitAudio.land();
            }
          }
        } else {
          this.onGround = false;
          this.lean = clamp(this.vy / 2600, -0.12, 0.16);
        }

        if (this.buffer > 0) this.applyJump();
        this.checkItems();
        this.checkEnemies();
      }

      this.updateEnemies(dt);
      this.updateItems(dt);
      if (!this.stumble && this.distance >= LEVEL_LENGTH) this.finishLevel();
    }

    isInPit(worldX) {
      for (let i = 0; i < this.pits.length; i += 1) {
        const pit = this.pits[i];
        if (pit.cleared) continue;
        if (worldX > pit.x0 + 6 && worldX < pit.x1 - 6) return pit;
      }
      return null;
    }

    startStumble(pit) {
      pit.falls += 1;
      this.stumble = { t: 0, pit: pit, assist: pit.falls > 1 };
      this.onGround = false;
      this.vy = 0;
      this.lean = 0;
      RabbitAudio.pit();
      this.spawnBurst(RABBIT_SCREEN_X, GROUND_Y + 6, 7, 0xd8b98a, 0.9, 54);
      if (!this.stumble.assist) this.showToast('小兔子摔疼啦，再来一次吧！');
    }

    updateStumble(dt) {
      const stumble = this.stumble;
      const fallEnd = 0.34;
      const wiggleEnd = STUMBLE_TIME - 0.28;
      stumble.t += dt;
      if (stumble.t < fallEnd) {
        const k = stumble.t / fallEnd;
        this.rabbitY = GROUND_Y + PIT_FALL_DEPTH * k;
        this.squash = 0.45 * k;
        this.wiggle = 0;
        return;
      }
      if (stumble.t < wiggleEnd) {
        this.rabbitY = GROUND_Y + PIT_FALL_DEPTH;
        this.squash = 0.45;
        this.wiggle = Math.sin((stumble.t - fallEnd) * 30) * 0.5;
        return;
      }
      const k = Math.min(1, (stumble.t - wiggleEnd) / (STUMBLE_TIME - wiggleEnd));
      this.rabbitY = GROUND_Y + PIT_FALL_DEPTH * (1 - k);
      this.squash = 0.45 * (1 - k);
      this.wiggle = Math.sin((stumble.t - fallEnd) * 30) * 0.5 * (1 - k);
      if (k >= 1) this.endStumble(stumble);
    }

    endStumble(stumble) {
      this.stumble = null;
      this.squash = 0.22;
      this.wiggle = 0;
      this.spawnBurst(RABBIT_SCREEN_X, GROUND_Y + 2, 5, WHITE, 0.9, 48);
      if (stumble.assist) {
        // 同一个坑掉第二次：给小兔子一个温柔的自动起跳，保证一定能过去，
        // 不会让孩子卡在同一个坑里来回摔。
        stumble.pit.cleared = true;
        this.rabbitY = GROUND_Y - 4;
        this.vy = JUMP_V * 0.9;
        this.onGround = false;
        this.jumps = 1;
        this.coyote = 0;
        RabbitAudio.doubleJump();
        return;
      }
      // 温柔地弹回坑的近沿：只丢一点点进度，站在结实的草地上重新起跳
      this.distance = stumble.pit.x0 - RABBIT_HALF_W - 2;
      this.rabbitY = GROUND_Y;
      this.vy = 0;
      this.onGround = true;
      this.jumps = 0;
      this.coyote = COYOTE_TIME;
    }

    // -------------------------------------------------------- 收集 / 小调皮
    updateItems(dt) {
      for (let i = 0; i < this.items.length; i += 1) {
        const item = this.items[i];
        if (item.taken) continue;
        item.phase += dt * 3;
        item.drawY = item.y + Math.sin(item.phase) * 4;
      }
    }

    checkItems() {
      const headY = this.rabbitY - RABBIT_H * 0.55;
      const reachX = RABBIT_HALF_W + 24;
      const reachY = RABBIT_H * 0.62 + 26;
      for (let i = 0; i < this.items.length; i += 1) {
        const item = this.items[i];
        if (item.taken) continue;
        const sx = item.x - this.distance + RABBIT_SCREEN_X;
        if (sx < -60 || sx > WIDTH + 60) continue;
        if (Math.abs(sx - RABBIT_SCREEN_X) > reachX) continue;
        if (Math.abs(item.drawY - headY) > reachY) continue;
        this.collectItem(item, sx);
      }
    }

    collectItem(item, sx) {
      item.taken = true;
      if (item.gfx) { item.gfx.destroy(); item.gfx = null; }
      const value = ITEM_VALUE[item.kind];
      this.score += value;
      this.levelScore += value;
      if (item.kind === 'carrot') {
        this.carrotTotal += 1;
        this.levelCarrot += 1;
        RabbitAudio.collectCarrot();
        this.spawnBurst(sx, item.drawY, 4, 0xffb470, 0.9, 46);
      } else if (item.kind === 'star') {
        this.starTotal += 1;
        this.levelStar += 1;
        RabbitAudio.collectStar();
        this.spawnStarBurst(sx, item.drawY, 5);
      } else {
        this.flowerTotal += 1;
        this.levelFlower += 1;
        RabbitAudio.collectFlower();
        this.spawnPetalBurst(sx, item.drawY, 6);
      }
      this.updateHudTexts();
      if (!this.rainbowEars && this.carrotTotal >= RAINBOW_CARROTS) this.unlockRainbow();
    }

    unlockRainbow() {
      this.rainbowEars = true;
      RabbitAudio.rainbow();
      this.showToast('胡萝卜满 ' + RAINBOW_CARROTS + ' 根，耳朵变彩色啦！');
      for (let i = 0; i < 4; i += 1) {
        this.spawnSparkle(RABBIT_SCREEN_X + randomRange(-26, 26),
          this.rabbitY - RABBIT_H * randomRange(0.6, 1.05), randomInt(0, 5));
      }
    }

    updateEnemies(dt) {
      for (let i = 0; i < this.enemies.length; i += 1) {
        const enemy = this.enemies[i];
        if (enemy.gone) continue;
        if (enemy.type === 'ladybug') {
          enemy.phase += dt * 2.1;
          enemy.offset = Math.sin(enemy.phase) * 40;
        } else if (enemy.type === 'hedgehog') {
          enemy.drift = Math.min(70, enemy.drift + 18 * dt);
        }
      }
    }

    enemyWorldX(enemy) {
      return enemy.baseX + (enemy.offset || 0) - (enemy.drift || 0);
    }

    checkEnemies() {
      for (let i = 0; i < this.enemies.length; i += 1) {
        const enemy = this.enemies[i];
        if (enemy.gone) continue;
        const sx = this.enemyWorldX(enemy) - this.distance + RABBIT_SCREEN_X;
        if (sx < -90 || sx > WIDTH + 90) continue;
        if (Math.abs(sx - RABBIT_SCREEN_X) > RABBIT_HALF_W + enemy.halfW - 6) continue;
        if (this.vy > 2 && this.rabbitY < GROUND_Y - 6) this.stompEnemy(enemy, sx);
        else this.cryOnEnemy(enemy);
      }
    }

    stompEnemy(enemy, sx) {
      enemy.gone = true;
      this.score += STOMP_SCORE;
      this.levelScore += STOMP_SCORE;
      RabbitAudio.stomp();
      this.spawnStarBurst(sx, GROUND_Y - enemy.height * 0.6, 4);
      // 踩上去轻轻弹一下，手感更弹、也更不容易顺势掉坑
      this.vy = Math.min(this.vy, -360);
      this.onGround = false;
      this.jumps = Math.max(1, this.jumps);
      const gfx = enemy.gfx;
      if (gfx) {
        this.tweens.add({
          targets: gfx, y: gfx.y - 48, alpha: 0, scaleX: 1.25, scaleY: 0.7,
          duration: 320, ease: 'Cubic.easeOut',
          onComplete: () => { if (gfx.active) gfx.destroy(); },
        });
      }
      this.updateHudTexts();
    }

    cryOnEnemy(enemy) {
      enemy.gone = true;
      this.cryTimer = CRY_TIME;
      RabbitAudio.cry();
      this.spawnBurst(RABBIT_SCREEN_X - 12, this.rabbitY - 12, 4, WHITE, 0.85, 40);
      const gfx = enemy.gfx;
      if (gfx) {
        this.tweens.add({
          targets: gfx, x: gfx.x + 74, alpha: 0, duration: 420, ease: 'Sine.easeOut',
          onComplete: () => { if (gfx.active) gfx.destroy(); },
        });
      }
      this.updateHudTexts();
    }

    // -------------------------------------------------------- 绘制
    drawWorld() {
      for (let i = 0; i < this.items.length; i += 1) {
        const item = this.items[i];
        const gfx = item.gfx;
        if (!gfx || item.taken) continue;
        const sx = item.x - this.distance + RABBIT_SCREEN_X;
        const visible = sx > -60 && sx < WIDTH + 60;
        gfx.setVisible(visible);
        if (!visible) continue;
        gfx.x = sx;
        gfx.y = item.drawY;
        if (item.kind === 'star') gfx.setRotation(this.elapsed * 1.5);
        else gfx.setScale(1 + Math.sin(item.phase) * 0.05);
      }
      for (let i = 0; i < this.enemies.length; i += 1) {
        const enemy = this.enemies[i];
        const gfx = enemy.gfx;
        if (!gfx || enemy.gone) continue;
        const sx = this.enemyWorldX(enemy) - this.distance + RABBIT_SCREEN_X;
        const visible = sx > -90 && sx < WIDTH + 90;
        gfx.setVisible(visible);
        if (!visible) continue;
        gfx.x = sx;
        gfx.y = GROUND_Y - enemy.height / 2;
        if (enemy.type === 'mushroom') {
          const wobble = Math.sin(this.elapsed * 3.6 + enemy.phase);
          gfx.setRotation(Math.sin(this.elapsed * 2.4 + enemy.phase) * 0.06);
          gfx.setScale(1 - wobble * 0.04, 1 + wobble * 0.05);
        } else if (enemy.type === 'ladybug') {
          gfx.setRotation(Math.sin(this.elapsed * 5 + enemy.phase) * 0.05);
        } else {
          gfx.setRotation(Math.sin(this.elapsed * 6 + enemy.phase) * 0.04);
        }
      }
    }

    drawRabbit() {
      const g = this.rabbitGraphics;
      g.clear();
      g.setPosition(this.rabbitX, this.rabbitY);
      g.setScale(this.rabbitScale);
      drawRabbitShape(g, {
        y: this.rabbitY,
        groundY: GROUND_Y,
        squash: this.squash,
        lean: this.lean,
        wiggle: this.wiggle,
        legPhase: this.runPhase,
        airborne: !this.onGround || this.rabbitY < GROUND_Y - 2,
        rainbow: this.rainbowEars,
        cry: this.cryTimer,
        elapsed: this.elapsed,
      });
    }

    drawFx() {
      const g = this.fxGraphics;
      g.clear();
      for (let i = 0; i < this.particles.length; i += 1) {
        const p = this.particles[i];
        const alpha = clamp(p.life / p.max, 0, 1) * p.alpha;
        if (alpha <= 0.01) continue;
        g.fillStyle(p.color, alpha);
        if (p.shape === 'star') {
          g.fillPoints(starPoints(p.x, p.y, p.size, p.size * 0.44, 5, p.angle), true);
        } else {
          g.fillCircle(p.x, p.y, p.size);
        }
      }
    }

    // -------------------------------------------------------- 粒子
    pushParticle(particle) {
      if (this.particles.length > 220) this.particles.shift();
      this.particles.push(particle);
    }

    spawnBurst(x, y, count, color, alpha, speed) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = randomRange(speed * 0.35, speed);
        const life = randomRange(0.3, 0.6);
        this.pushParticle({
          x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
          life: life, max: life, size: randomRange(2.4, 5), color: color,
          alpha: alpha === undefined ? 1 : alpha, shape: 'circle', gravity: 520,
          angle: 0, spin: 0,
        });
      }
    }

    spawnRing() {
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const life = 0.32;
        this.pushParticle({
          x: RABBIT_SCREEN_X, y: this.rabbitY + 6,
          vx: Math.cos(a) * 118, vy: Math.sin(a) * 50 + 8,
          life: life, max: life, size: 3.6, color: WHITE, alpha: 0.95,
          shape: 'circle', gravity: 60, angle: 0, spin: 0,
        });
      }
    }

    spawnStarBurst(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        const a = randomRange(-Math.PI * 0.95, -Math.PI * 0.05);
        const v = randomRange(70, 190);
        const life = randomRange(0.5, 0.9);
        this.pushParticle({
          x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: life, max: life, size: randomRange(4, 7), color: 0xffd84e, alpha: 1,
          shape: 'star', gravity: 320, angle: randomRange(0, 3), spin: randomRange(-6, 6),
        });
      }
    }

    spawnPetalBurst(x, y, count) {
      for (let i = 0; i < count; i += 1) {
        const a = randomRange(-Math.PI, 0);
        const v = randomRange(50, 140);
        const life = randomRange(0.45, 0.8);
        this.pushParticle({
          x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: life, max: life, size: randomRange(3, 5.4), color: 0xff9ecb, alpha: 0.95,
          shape: 'circle', gravity: 240, angle: 0, spin: 0,
        });
      }
    }

    spawnSparkle(x, y, hue) {
      const life = randomRange(0.5, 0.85);
      this.pushParticle({
        x: x, y: y, vx: randomRange(-40, 40), vy: randomRange(-70, -20),
        life: life, max: life, size: randomRange(4, 6.5), color: hsvColor(hue * 60, 0.62, 1),
        alpha: 1, shape: 'star', gravity: 30, angle: randomRange(0, 3), spin: randomRange(-5, 5),
      });
    }

    updateParticles(dt) {
      const list = this.particles;
      let write = 0;
      for (let i = 0; i < list.length; i += 1) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        list[write] = p;
        write += 1;
      }
      list.length = write;
    }
  }

  window.RabbitGameScene = RabbitGameScene;
})();
