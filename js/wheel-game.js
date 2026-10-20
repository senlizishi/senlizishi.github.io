/*
 * 彩虹转盘：竖屏（540x960）的彩色转盘小玩具。
 * 打开先选 2–12 个格子，再逐格填写中文；转盘停下后高亮扇区并弹出结果卡。
 * 无计分、无失败、无存档；配置只留在当前页面，刷新即重置。
 * 画面全部 Phaser.Graphics / Text 程序化绘制，音效 WebAudio 合成，不加载素材文件。
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------- 基础常量
  const WIDTH = 540;
  const HEIGHT = 960;
  const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const TAU = Math.PI * 2;
  const MIN_SEGMENTS = 2;
  const MAX_SEGMENTS = 12;
  const MAX_LABEL_CHARS = 8;
  const POINTER_ANGLE = -Math.PI / 2;
  const WHEEL_R = 228;
  const SPIN_SEC_MIN = 3.7;
  const SPIN_SEC_MAX = 4.3;
  const SPIN_TURNS_MIN = 5;
  const SPIN_TURNS_MAX = 7;
  const TICK_GAP_SEC = 0.05;

  const SEGMENT_COLORS = [
    0xFF4D6D, 0xFF8A3D, 0xFFD93D, 0x9BE15D,
    0x3DDC97, 0x35D0BA, 0x38BDF8, 0x5B8CFF,
    0x8B5CF6, 0xC45BFF, 0xFF5CC8, 0xFF7A9A,
  ];

  const DEPTH = {
    world: 0, wheel: 5, pointer: 7, title: 10,
    ui: 20, spinFx: 30, card: 40,
  };

  const C = {
    ink: 0x2B0E4A, inkSoft: 0x4D267C,
    gold: 0xFFD35C, goldDark: 0xB66B14, goldLight: 0xFFF1A8,
    cream: 0xFFF9E8, creamSoft: 0xFFF2D1,
    purple: 0x6D2BB7, purpleDeep: 0x1B0B3B, purpleMid: 0x512A96,
    coral: 0xFF5C6C, orange: 0xFF9A3D, pink: 0xFF5EA8,
    blue: 0x5B8CFF, green: 0x3DDC97, white: 0xFFFFFF,
  };

  // ---------------------------------------------------------------- 布局
  function computeLayout() {
    const wheel = { x: WIDTH / 2, y: 492, r: WHEEL_R };
    const card = { x: 55, y: 316, w: 430, h: 318, cx: WIDTH / 2, cy: 470 };
    return {
      wheel: wheel,
      title: { x: 215, y: 72 },
      subtitle: { x: 215, y: 110 },
      pointer: { x: WIDTH / 2, y: 236, w: 24, h: 42 },
      edit: { x: 446, y: 74, w: 112, h: 44 },
      spin: { x: WIDTH / 2, y: 824, w: 240, h: 76 },
      hint: { x: WIDTH / 2, y: 900 },
      card: card,
      resultReplay: { x: 171, y: 571, w: 186, h: 58 },
      resultEdit: { x: 369, y: 571, w: 186, h: 58 },
    };
  }

  // ---------------------------------------------------------------- 小工具
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function normalizeAngle(a) {
    a = a % TAU;
    return a < 0 ? a + TAU : a;
  }
  function blend(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16)
      | (Math.round(ag + (bg - ag) * t) << 8)
      | Math.round(ab + (bb - ab) * t);
  }
  function colorToCss(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }
  function luminance(n) {
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  function labelInk(n) { return luminance(n) > 168 ? '#2B0E4A' : '#FFFFFF'; }
  function colorForSegment(i, count) {
    const idx = Math.round(i * SEGMENT_COLORS.length / count) % SEGMENT_COLORS.length;
    return SEGMENT_COLORS[idx];
  }
  function limitLabel(value) {
    return Array.from(String(value == null ? '' : value).replace(/[\r\n\t]/g, ' '))
      .slice(0, MAX_LABEL_CHARS).join('');
  }
  function cleanLabel(value) {
    return limitLabel(String(value == null ? '' : value).replace(/\s+/g, ' ').trim());
  }
  function contains(rect, x, y) {
    return x >= rect.x - rect.w / 2 && x <= rect.x + rect.w / 2
      && y >= rect.y - rect.h / 2 && y <= rect.y + rect.h / 2;
  }
  function fillPoly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillPath();
  }
  function strokePoly(g, pts, closed) {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    if (closed) g.closePath();
    g.strokePath();
  }
  function pseudo(i) {
    const v = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    return v - Math.floor(v);
  }
  function drawStar(g, x, y, r, color, alpha, points) {
    const n = points || 5;
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n;
      const rr = i % 2 === 0 ? r : r * 0.44;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    g.fillStyle(color, alpha == null ? 1 : alpha);
    fillPoly(g, pts);
  }
  function drawPill(g, rect, fill, stroke, sw, shadowColor) {
    if (shadowColor != null) {
      g.fillStyle(shadowColor, 0.92);
      g.fillRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2 + 7, rect.w, rect.h, rect.h / 2);
    }
    g.fillStyle(fill, 1);
    g.fillRoundedRect(rect.x - rect.w / 2, rect.y - rect.h / 2, rect.w, rect.h, rect.h / 2);
    if (stroke != null) {
      g.lineStyle(sw || 2, stroke, 0.9);
      g.strokeRoundedRect(rect.x - rect.w / 2 + 1, rect.y - rect.h / 2 + 1, rect.w - 2, rect.h - 2, rect.h / 2);
    }
  }

  // ---------------------------------------------------------------- 背景
  function drawCarnival(g, L) {
    const bands = 24;
    const bandH = Math.ceil(HEIGHT / bands);
    for (let i = 0; i < bands; i++) {
      g.fillStyle(blend(C.purpleDeep, C.purpleMid, i / (bands - 1)), 1);
      g.fillRect(0, i * bandH, WIDTH, bandH + 1);
    }

    for (let i = 0; i < 28; i++) {
      if (i % 2 === 1) continue;
      const a0 = i * TAU / 28;
      const a1 = (i + 1) * TAU / 28;
      const cx = L.wheel.x, cy = L.wheel.y;
      g.fillStyle(0xFFFFFF, 0.035);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0) * 620, cy + Math.sin(a0) * 620);
      g.lineTo(cx + Math.cos(a1) * 620, cy + Math.sin(a1) * 620);
      g.closePath();
      g.fillPath();
    }

    g.fillStyle(0x09021D, 0.24);
    g.fillEllipse(WIDTH / 2, 856, 470, 170);
    g.fillStyle(C.purpleMid, 0.22);
    g.fillEllipse(WIDTH / 2, 840, 390, 124);

    // 顶部彩旗
    g.lineStyle(2, 0xF7D890, 0.46);
    const buntY = 145;
    g.beginPath();
    g.moveTo(18, buntY);
    g.lineTo(522, buntY - 4);
    g.strokePath();
    for (let i = 0; i < 12; i++) {
      const x = 36 + i * 42;
      const y = buntY - 4 + (x / WIDTH) * -4;
      const col = SEGMENT_COLORS[(i + 2) % SEGMENT_COLORS.length];
      g.fillStyle(0x0E0524, 0.18);
      g.fillTriangle(x - 12, y + 3, x + 12, y + 3, x, y + 27);
      g.fillStyle(col, 0.9);
      g.fillTriangle(x - 11, y, x + 11, y, x, y + 23);
    }

    // 静态的小彩纸与星星
    const palette = SEGMENT_COLORS.concat([0xFFFFFF, 0xFFD35C]);
    for (let i = 0; i < 46; i++) {
      const x = 18 + pseudo(i + 3) * (WIDTH - 36);
      const y = 176 + pseudo(i + 71) * 730;
      if (Math.abs(x - WIDTH / 2) < 244 && Math.abs(y - 492) < 245) continue;
      const col = palette[i % palette.length];
      if (i % 3 === 0) {
        drawStar(g, x, y, 3 + pseudo(i + 8) * 4, col, 0.6, 4);
      } else {
        g.save();
        g.translateCanvas(x, y);
        g.rotateCanvas(pseudo(i + 19) * Math.PI);
        g.fillStyle(col, 0.52);
        g.fillRect(-2.5, -5, 5, 10);
        g.restore();
      }
    }

    g.fillStyle(0xFFFFFF, 0.12);
    g.fillCircle(60, 214, 4);
    g.fillCircle(486, 256, 5);
    g.fillCircle(48, 650, 3);
    g.fillCircle(500, 718, 4);
  }

  function drawPointer(g, L, lifted) {
    g.clear();
    const x = L.pointer.x;
    const y = L.pointer.y - (lifted || 0);
    g.fillStyle(0x0B0323, 0.38);
    g.fillTriangle(x - 19, y - 16 + 7, x + 19, y - 16 + 7, x, y + 41 + 7);
    g.fillStyle(C.gold, 1);
    g.fillTriangle(x - 19, y - 16, x + 19, y - 16, x, y + 41);
    g.lineStyle(3, 0x7C430D, 0.86);
    strokePoly(g, [[x - 19, y - 16], [x + 19, y - 16], [x, y + 41]], true);
    g.fillStyle(0xFFF8D9, 0.9);
    g.fillTriangle(x - 8, y - 10, x + 1, y - 10, x - 4, y + 10);
    g.fillStyle(0x7C430D, 1);
    g.fillCircle(x, y - 16, 7);
    g.fillStyle(C.goldLight, 1);
    g.fillCircle(x - 2, y - 19, 2.5);
  }
  // ---------------------------------------------------------------- 音效
  const Sound = (function () {
    let ctx = null;
    function getCtx() {
      try {
        if (!ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          ctx = new AC();
        }
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
      } catch (e) {
        return null;
      }
    }
    function tone(freq, dur, vol, delay, type) {
      const ac = getCtx();
      if (!ac) return;
      try {
        const t0 = ac.currentTime + (delay || 0);
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.03);
      } catch (e) { /* 音频不可用时保持安静 */ }
    }
    function sweep(from, to, dur, vol, delay, type) {
      const ac = getCtx();
      if (!ac) return;
      try {
        const t0 = ac.currentTime + (delay || 0);
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(from, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.03);
      } catch (e) { /* noop */ }
    }
    return {
      click: function () { tone(540, 0.06, 0.035, 0, 'triangle'); },
      spin: function () {
        sweep(180, 420, 0.34, 0.026, 0, 'sine');
        tone(660, 0.08, 0.018, 0.10, 'triangle');
      },
      tick: function () { tone(1080 + Math.random() * 180, 0.025, 0.012, 0, 'square'); },
      win: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        for (let i = 0; i < notes.length; i++) {
          tone(notes[i], 0.9, 0.052, i * 0.075, 'sine');
          tone(notes[i] * 2, 0.55, 0.012, i * 0.075, 'sine');
        }
      },
      pop: function () { sweep(300, 620, 0.16, 0.035, 0, 'sine'); },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class WheelScene extends Phaser.Scene {
    constructor() {
      super('WheelScene');
    }

    create() {
      this.L = computeLayout();
      this.CONST = {
        WIDTH: WIDTH, HEIGHT: HEIGHT,
        MIN_SEGMENTS: MIN_SEGMENTS, MAX_SEGMENTS: MAX_SEGMENTS,
        MAX_LABEL_CHARS: MAX_LABEL_CHARS,
        POINTER_ANGLE: POINTER_ANGLE, WHEEL_R: WHEEL_R,
        SPIN_SEC: SPIN_SEC_MIN, SPIN_SEC_MIN: SPIN_SEC_MIN, SPIN_SEC_MAX: SPIN_SEC_MAX,
        SPIN_TURNS: SPIN_TURNS_MIN, SPIN_TURNS_MIN: SPIN_TURNS_MIN, SPIN_TURNS_MAX: SPIN_TURNS_MAX,
        SEGMENT_COLORS: SEGMENT_COLORS.slice(),
        DEPTH: DEPTH,
      };
      this.PALETTE = C;
      this.phase = 'setup';
      this.clock = 0;
      this.segmentCount = 0;
      this.labels = [];
      this.segments = [];
      this.angle = 0;
      this.targetAngle = 0;
      this.resultIndex = -1;
      this.spinFrom = 0;
      this.spinT = 0;
      this.spinDur = SPIN_SEC_MIN;
      this.spinTurns = SPIN_TURNS_MIN;
      this.spinTickKey = 0;
      this.lastTickClock = -1;
      this.resultAt = -1;
      this.imeComposing = false;
      this.liveProps = [];
      this.fxParticles = this.liveProps;
      this.labelTexts = [];
      this.playObjects = [];

      // -------------------------------------------------- 世界与转盘
      this.worldG = this.add.graphics().setDepth(DEPTH.world);
      drawCarnival(this.worldG, this.L);

      this.wheelLayer = this.add.container(this.L.wheel.x, this.L.wheel.y).setDepth(DEPTH.wheel);
      this.wheelG = this.add.graphics();
      this.highlightG = this.add.graphics();
      this.wheelLayer.add([this.wheelG, this.highlightG]);

      this.pointerG = this.add.graphics().setDepth(DEPTH.pointer);
      drawPointer(this.pointerG, this.L, 0);

      this.titleText = this.add.text(this.L.title.x, this.L.title.y, '彩虹转盘', {
        fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: '#FFF3B0',
        stroke: '#4A197F', strokeThickness: 8,
      }).setOrigin(0.5).setDepth(DEPTH.title).setShadow(0, 4, '#0B0323', 10, true, true);
      this.subText = this.add.text(this.L.subtitle.x, this.L.subtitle.y, '今天转什么？', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#EAD9FF',
        stroke: '#3A1265', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(DEPTH.title);

      this.editG = this.add.graphics().setDepth(DEPTH.ui);
      this.editText = this.add.text(this.L.edit.x, this.L.edit.y, '编辑转盘', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#5D2790',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);

      this.spinG = this.add.graphics().setDepth(DEPTH.ui);
      this.spinText = this.add.text(this.L.spin.x, this.L.spin.y - 2, '转 一 转', {
        fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#9A344B', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.spinIconL = this.add.text(this.L.spin.x - 82, this.L.spin.y - 2, '✦', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFF2A8',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.spinIconR = this.add.text(this.L.spin.x + 82, this.L.spin.y - 2, '✦', {
        fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFF2A8',
      }).setOrigin(0.5).setDepth(DEPTH.ui + 1);
      this.hintText = this.add.text(this.L.hint.x, this.L.hint.y, '点转盘或按钮都能转', {
        fontFamily: FONT, fontSize: '14px', color: '#D9C6F7',
      }).setOrigin(0.5).setDepth(DEPTH.ui);

      this.fxG = this.add.graphics().setDepth(DEPTH.spinFx);

      this.drawEditButton();
      this.drawSpinButton();

      this.createResultCard();

      this.playObjects = [
        this.wheelLayer, this.pointerG, this.titleText, this.subText,
        this.editG, this.editText, this.spinG, this.spinText,
        this.spinIconL, this.spinIconR, this.hintText, this.fxG,
      ];

      this.initSetupDom();
      this.setGameVisible(false);
      this.showCountStep();
      this.updateStartState();

      this.input.on('pointerdown', this.onPointerDown, this);
    }

    // -------------------------------------------------- DOM 配置
    initSetupDom() {
      this.dom = {
        overlay: document.getElementById('wheel-setup'),
        countStep: document.getElementById('count-step'),
        labelStep: document.getElementById('label-step'),
        countGrid: document.getElementById('count-grid'),
        list: document.getElementById('label-list'),
        summary: document.getElementById('count-summary'),
        hint: document.getElementById('setup-hint'),
        start: document.getElementById('start-wheel'),
        change: document.getElementById('change-count'),
        inputs: [],
      };
      if (!this.dom.overlay) return;

      this.dom.countGrid.innerHTML = '';
      for (let n = MIN_SEGMENTS; n <= MAX_SEGMENTS; n++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'count-chip';
        btn.dataset.count = String(n);
        btn.textContent = String(n);
        btn.setAttribute('aria-label', n + ' 个格子');
        this.dom.countGrid.appendChild(btn);
      }
      this.dom.countGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.count-chip');
        if (!btn) return;
        const n = Number(btn.dataset.count);
        Sound.click();
        this.setSegmentCount(n);
        this.showLabelStep();
      });
      this.dom.change.addEventListener('click', () => {
        Sound.click();
        this.showCountStep();
      });
      this.dom.start.addEventListener('click', () => {
        if (this.beginPlay()) Sound.click();
      });
    }
    markCountChips() {
      if (!this.dom || !this.dom.countGrid) return;
      const chips = this.dom.countGrid.querySelectorAll('.count-chip');
      for (let i = 0; i < chips.length; i++) {
        chips[i].classList.toggle('selected', Number(chips[i].dataset.count) === this.segmentCount);
      }
    }

    showCountStep() {
      if (!this.dom || !this.dom.countStep) return;
      this.dom.countStep.hidden = false;
      this.dom.labelStep.hidden = true;
      this.markCountChips();
    }

    showLabelStep() {
      if (!this.dom || !this.dom.labelStep || this.segmentCount < MIN_SEGMENTS) return;
      this.dom.countStep.hidden = true;
      this.dom.labelStep.hidden = false;
      this.markCountChips();
      this.updateStartState();
    }

    renderLabelRows() {
      if (!this.dom || !this.dom.list) return;
      this.imeComposing = false;
      const examples = ['唱一首歌', '抱一下', '吃水果', '跳个舞', '讲个故事', '喝口水', '去公园', '玩积木'];
      this.dom.list.innerHTML = '';
      this.dom.inputs = [];
      for (let i = 0; i < this.segmentCount; i++) {
        const row = document.createElement('label');
        row.className = 'label-row';
        const num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(i + 1);
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = colorToCss(colorForSegment(i, this.segmentCount));
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = MAX_LABEL_CHARS * 3; // leave room for IME composition
        input.autocomplete = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        input.enterKeyHint = 'next';
        input.value = this.labels[i] || '';
        input.placeholder = examples[i % examples.length];
        input.setAttribute('aria-label', '第 ' + (i + 1) + ' 格内容');
        input.dataset.index = String(i);
        input.addEventListener('compositionstart', () => {
          this.imeComposing = true;
          this.updateStartState();
        });
        input.addEventListener('compositionend', () => {
          this.imeComposing = false;
          input.value = cleanLabel(input.value);
          this.labels[i] = input.value;
          this.updateStartState();
        });
        input.addEventListener('input', () => {
          const next = limitLabel(input.value);
          if (next !== input.value) input.value = next;
          this.labels[i] = next;
          this.updateStartState();
        });
        input.addEventListener('blur', () => {
          input.value = cleanLabel(input.value);
          this.labels[i] = input.value;
          this.updateStartState();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (i + 1 < this.segmentCount) {
            this.dom.inputs[i + 1].focus();
          } else if (this.labelsComplete()) {
            this.beginPlay();
            Sound.click();
          }
        });
        row.appendChild(num);
        row.appendChild(dot);
        row.appendChild(input);
        this.dom.list.appendChild(row);
        this.dom.inputs.push(input);
      }
    }

    updateStartState() {
      if (!this.dom || !this.dom.start) return;
      const n = this.segmentCount;
      let missing = 0;
      for (let i = 0; i < n; i++) {
        if (!String(this.labels[i] || '').trim()) missing++;
      }
      const complete = this.labelsComplete();
      this.dom.start.disabled = !complete;
      this.dom.hint.textContent = complete
        ? '都填好啦，开始转吧！'
        : (n ? '还差 ' + missing + ' 格没填' : '先选一个格子数量');
      this.dom.hint.classList.toggle('ready', complete);
      if (this.dom.summary) {
        this.dom.summary.textContent = n
          ? '现在是 ' + n + ' 个格子，每格最多 ' + MAX_LABEL_CHARS + ' 个字'
          : '';
      }
    }

    setSegmentCount(value) {
      let n = Math.round(Number(value));
      if (!isFinite(n)) n = MIN_SEGMENTS;
      n = clamp(n, MIN_SEGMENTS, MAX_SEGMENTS);
      if (n < this.labels.length) {
        this.labels = this.labels.slice(0, n);
      } else {
        while (this.labels.length < n) this.labels.push('');
      }
      this.segmentCount = n;
      this.segments = this.buildSegments();
      this.renderLabelRows();
      this.markCountChips();
      this.updateStartState();
      return n;
    }

    setLabel(index, text) {
      if (!Number.isInteger(index) || index < 0 || index >= this.segmentCount) return false;
      this.labels[index] = cleanLabel(text);
      if (this.dom && this.dom.inputs[index]) this.dom.inputs[index].value = this.labels[index];
      this.segments = this.buildSegments();
      this.updateStartState();
      return true;
    }

    labelsComplete() {
      if (this.segmentCount < MIN_SEGMENTS || this.segmentCount > MAX_SEGMENTS) return false;
      if (this.imeComposing) return false;
      if (this.labels.length !== this.segmentCount) return false;
      for (let i = 0; i < this.segmentCount; i++) {
        if (!String(this.labels[i] || '').trim()) return false;
      }
      return true;
    }

    // -------------------------------------------------- 转盘构建
    buildSegments() {
      const n = this.segmentCount;
      if (n < MIN_SEGMENTS) return [];
      const step = TAU / n;
      const out = [];
      for (let i = 0; i < n; i++) {
        const start = -Math.PI / 2 - step / 2 + i * step;
        out.push({
          index: i,
          label: this.labels[i] || '',
          color: colorForSegment(i, n),
          start: start,
          end: start + step,
          mid: start + step / 2,
        });
      }
      return out;
    }

    beginPlay() {
      if (!this.labelsComplete()) {
        Sound.pop();
        this.updateStartState();
        return false;
      }
      this.labels = this.labels.map(cleanLabel);
      this.segments = this.buildSegments();
      this.angle = 0;
      this.targetAngle = 0;
      this.resultIndex = -1;
      this.resultAt = -1;
      this.phase = 'play';
      this.hideResult();
      this.clearConfetti();
      this.clearHighlight();
      if (this.dom && this.dom.overlay) this.dom.overlay.hidden = true;
      this.setGameVisible(true);
      this.drawWheel();
      this.updateSpinVisual();
      return true;
    }

    editWheel() {
      if (this.phase === 'spinning') return false;
      this.phase = 'setup';
      this.hideResult();
      this.clearConfetti();
      this.clearHighlight();
      this.setGameVisible(false);
      if (this.dom && this.dom.overlay) this.dom.overlay.hidden = false;
      if (this.segmentCount >= MIN_SEGMENTS) this.showLabelStep(); else this.showCountStep();
      this.updateStartState();
      return true;
    }

    setGameVisible(v) {
      for (let i = 0; i < this.playObjects.length; i++) this.playObjects[i].setVisible(v);
      if (v) {
        if (this.segmentCount >= MIN_SEGMENTS) this.wheelLayer.setVisible(true);
        this.updateSpinVisual();
      }
    }

    drawWheel() {
      const g = this.wheelG;
      const n = this.segmentCount;
      if (!this.segments.length || n < MIN_SEGMENTS) {
        g.clear();
        return;
      }
      g.clear();
      this.highlightG.clear();

      g.fillStyle(0x09021D, 0.48);
      g.fillCircle(0, 9, WHEEL_R + 18);
      g.fillStyle(0x7A3C08, 0.62);
      g.fillCircle(0, 5, WHEEL_R + 14);
      g.fillStyle(C.gold, 1);
      g.fillCircle(0, 0, WHEEL_R + 12);
      g.fillStyle(C.goldLight, 1);
      g.fillCircle(0, -2, WHEEL_R + 6);
      g.fillStyle(0xB66B14, 1);
      g.fillCircle(0, 0, WHEEL_R + 2);

      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        g.fillStyle(s.color, 1);
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, WHEEL_R, s.start, s.end, false);
        g.closePath();
        g.fillPath();

        g.fillStyle(0xFFFFFF, i % 2 === 0 ? 0.07 : 0.025);
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, WHEEL_R, s.start, s.end, false);
        g.closePath();
        g.fillPath();
      }

      const step = TAU / n;
      g.lineStyle(2.4, 0x3D155D, 0.26);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 - step / 2 + i * step;
        g.lineBetween(Math.cos(a) * 34, Math.sin(a) * 34, Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R);
      }

      g.lineStyle(5, 0xFFF0A0, 0.25);
      g.beginPath();
      g.arc(0, 0, WHEEL_R - 7, Math.PI * 0.95, Math.PI * 1.52, false);
      g.strokePath();

      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 - step / 2 + i * step;
        const x = Math.cos(a) * (WHEEL_R + 7);
        const y = Math.sin(a) * (WHEEL_R + 7);
        g.fillStyle(0x7A3C08, 0.75);
        g.fillCircle(x, y + 1, 5);
        g.fillStyle(0xFFF3B0, 1);
        g.fillCircle(x, y, 3.2);
      }

      g.fillStyle(0x6B2E9F, 1);
      g.fillCircle(0, 0, 48);
      g.fillStyle(C.gold, 1);
      g.fillCircle(0, 0, 41);
      g.fillStyle(0xFFF6CC, 1);
      g.fillCircle(0, -2, 34);
      drawStar(g, 0, 0, 20, 0xD77B14, 1, 5);
      drawStar(g, -2, -2, 14, 0xFFD35C, 1, 5);
      g.fillStyle(0xFFFFFF, 0.55);
      g.fillCircle(-5, -6, 4);

      for (let i = 0; i < this.labelTexts.length; i++) this.labelTexts[i].destroy();
      this.labelTexts = [];

      const fontSize = n <= 4 ? 27 : n <= 6 ? 25 : n <= 8 ? 22 : n <= 10 ? 20 : 18;
      for (let i = 0; i < this.segments.length; i++) {
        const s = this.segments[i];
        const radius = WHEEL_R * 0.63;
        const x = Math.cos(s.mid) * radius;
        const y = Math.sin(s.mid) * radius;
        let rot = s.mid;
        if (Math.cos(s.mid) < 0) rot += Math.PI;
        const txt = this.add.text(x, y, s.label, {
          fontFamily: FONT,
          fontSize: fontSize + 'px',
          fontStyle: 'bold',
          color: labelInk(s.color),
          stroke: luminance(s.color) > 168 ? '#FFF8DC' : '#321043',
          strokeThickness: 3,
          align: 'center',
        }).setOrigin(0.5).setRotation(rot);
        txt.setShadow(0, 2, '#2B0E4A', 4, false, true);
        this.wheelLayer.add(txt);
        this.labelTexts.push(txt);
      }
      this.wheelLayer.rotation = this.angle;
    }
    winnerIndexAt(rotation) {
      const n = this.segmentCount;
      if (n < MIN_SEGMENTS) return -1;
      const step = TAU / n;
      const rel = normalizeAngle(-rotation);
      return Math.floor(normalizeAngle(rel + step / 2) / step) % n;
    }

    startSpin(forcedIndex) {
      if (this.phase !== 'play' || !this.labelsComplete()) return false;
      const n = this.segmentCount;
      let idx = Math.floor(Math.random() * n);
      if (Number.isInteger(forcedIndex) && forcedIndex >= 0 && forcedIndex < n) idx = forcedIndex;

      this.hideResult();
      this.clearConfetti();
      this.clearHighlight();
      this.resultIndex = -1;
      this.spinFrom = this.angle;
      this.spinT = 0;
      this.spinDur = SPIN_SEC_MIN + Math.random() * (SPIN_SEC_MAX - SPIN_SEC_MIN);
      this.spinTurns = Math.floor(SPIN_TURNS_MIN + Math.random() * (SPIN_TURNS_MAX - SPIN_TURNS_MIN + 1));
      const step = TAU / n;
      const jitter = (Math.random() * 0.56 - 0.28) * step;
      const desired = normalizeAngle(-(idx * step + jitter));
      const delta = normalizeAngle(desired - normalizeAngle(this.angle));
      this.targetAngle = this.angle + this.spinTurns * TAU + delta;
      this.spinTickKey = Math.floor(this.angle / step);
      this.lastTickClock = -1;
      this.phase = 'spinning';
      this.updateSpinVisual();
      Sound.spin();
      return true;
    }

    finishSpin() {
      if (this.phase !== 'spinning') return false;
      this.phase = 'result';
      this.angle = this.targetAngle;
      this.wheelLayer.rotation = this.angle;
      const idx = this.winnerIndexAt(this.angle);
      this.resultIndex = idx;
      this.resultAt = this.clock;
      this.highlightSegment(idx);
      this.updateSpinVisual();
      this.showResult(this.labels[idx] || '');
      this.spawnConfetti();
      Sound.win();
      return true;
    }

    tryAgain() {
      if (this.phase !== 'result') return false;
      this.hideResult();
      this.clearConfetti();
      this.clearHighlight();
      this.phase = 'play';
      this.updateSpinVisual();
      return this.startSpin();
    }

    updateSpinVisual() {
      const spinning = this.phase === 'spinning';
      if (this.spinG) this.spinG.setAlpha(spinning ? 0.56 : 1);
      if (this.spinText) this.spinText.setAlpha(spinning ? 0.62 : 1);
      if (this.spinIconL) this.spinIconL.setAlpha(spinning ? 0.45 : 1);
      if (this.spinIconR) this.spinIconR.setAlpha(spinning ? 0.45 : 1);
      if (this.editG) this.editG.setAlpha(spinning ? 0.48 : 1);
      if (this.editText) this.editText.setAlpha(spinning ? 0.48 : 1);
      if (this.hintText) {
        this.hintText.setText(spinning ? '转盘转起来啦……' : '点转盘或按钮都能转');
      }
    }

    step(dt) {
      if (!isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.12);
      this.clock += dt;

      if (this.phase === 'spinning') {
        this.spinT += dt;
        const p = clamp(this.spinT / this.spinDur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const nextAngle = this.spinFrom + (this.targetAngle - this.spinFrom) * eased;
        const step = TAU / this.segmentCount;
        const key = Math.floor(nextAngle / step);
        if (key !== this.spinTickKey) {
          if (this.clock - this.lastTickClock >= TICK_GAP_SEC) {
            Sound.tick();
            this.lastTickClock = this.clock;
          }
          this.spinTickKey = key;
        }
        this.angle = nextAngle;
        this.wheelLayer.rotation = this.angle;
        this.pointerG.y = Math.sin(this.clock * 31) * (1 - p) * 2.4;
        if (p >= 1) {
          this.pointerG.y = 0;
          this.finishSpin();
        }
      } else if (this.pointerG) {
        this.pointerG.y = 0;
      }

      this.updateConfetti(dt);
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

    // -------------------------------------------------- 扇区高亮
    highlightSegment(index) {
      this.highlightG.clear();
      if (index == null || index < 0 || index >= this.segments.length) return;
      const s = this.segments[index];
      const g = this.highlightG;
      g.fillStyle(0xFFFFFF, 0.28);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, WHEEL_R - 2, s.start, s.end, false);
      g.closePath();
      g.fillPath();
      g.lineStyle(5, 0xFFF1A0, 0.94);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(s.start) * WHEEL_R, Math.sin(s.start) * WHEEL_R);
      g.arc(0, 0, WHEEL_R, s.start, s.end, false);
      g.lineTo(0, 0);
      g.strokePath();
      for (let i = 0; i < this.labelTexts.length; i++) this.labelTexts[i].setScale(i === index ? 1.1 : 1);
      if (this.labelTexts[index]) this.labelTexts[index].setScale(1.16);
    }

    clearHighlight() {
      if (this.highlightG) this.highlightG.clear();
      for (let i = 0; i < this.labelTexts.length; i++) this.labelTexts[i].setScale(1);
    }

    // -------------------------------------------------- 结果卡
    createResultCard() {
      this.resultLayer = this.add.container(0, 0).setDepth(DEPTH.card).setVisible(false);
      this.resultDimG = this.add.graphics();
      this.resultDimG.fillStyle(0x08021A, 0.52);
      this.resultDimG.fillRect(0, 0, WIDTH, HEIGHT);
      this.resultLayer.add(this.resultDimG);

      this.resultCard = this.add.container(this.L.card.cx, this.L.card.cy);
      this.resultLayer.add(this.resultCard);

      const g = this.add.graphics();
      const w = this.L.card.w, h = this.L.card.h;
      const x = -w / 2, y = -h / 2;
      g.fillStyle(0x16072E, 0.42);
      g.fillRoundedRect(x + 8, y + 12, w, h, 30);
      g.fillStyle(0x7B3DA8, 0.36);
      g.fillRoundedRect(x - 7, y - 7, w + 14, h + 14, 35);
      g.fillStyle(C.cream, 1);
      g.fillRoundedRect(x, y, w, h, 28);
      g.lineStyle(5, C.gold, 1);
      g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 25);
      g.fillStyle(0xFFEAA0, 0.8);
      g.fillRoundedRect(x + 32, y + 13, w - 64, 8, 4);
      drawStar(g, x + 30, y + 28, 12, C.pink, 0.9, 5);
      drawStar(g, x + w - 30, y + 28, 12, C.blue, 0.9, 5);

      const btnY = 101;
      const bw = 186, bh = 58;
      const replayX = -99, editX = 99;
      g.fillStyle(0x9B2B5C, 0.42);
      g.fillRoundedRect(replayX - bw / 2, btnY - bh / 2 + 6, bw, bh, 20);
      g.fillStyle(C.coral, 1);
      g.fillRoundedRect(replayX - bw / 2, btnY - bh / 2, bw, bh, 20);
      g.fillStyle(0xFFB06A, 0.55);
      g.fillRoundedRect(replayX - bw / 2 + 5, btnY - bh / 2 + 5, bw - 10, 15, 8);

      g.fillStyle(0x4B227C, 0.42);
      g.fillRoundedRect(editX - bw / 2, btnY - bh / 2 + 6, bw, bh, 20);
      g.fillStyle(C.purple, 1);
      g.fillRoundedRect(editX - bw / 2, btnY - bh / 2, bw, bh, 20);
      g.fillStyle(0xB57CFF, 0.36);
      g.fillRoundedRect(editX - bw / 2 + 5, btnY - bh / 2 + 5, bw - 10, 15, 8);

      this.resultCard.add(g);

      this.resultTitleText = this.add.text(0, -108, '转盘说……', {
        fontFamily: FONT, fontSize: '27px', fontStyle: 'bold', color: '#8A3DC1',
      }).setOrigin(0.5);
      this.resultTitleText.setShadow(0, 2, '#FFFFFF', 3, false, true);
      this.resultLabelText = this.add.text(0, -19, '', {
        fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: '#E23F86',
        align: 'center', wordWrap: { width: 350, useAdvancedWrap: true },
      }).setOrigin(0.5);
      this.resultSubText = this.add.text(0, 47, '这是这一转的答案', {
        fontFamily: FONT, fontSize: '14px', color: '#9880A9',
      }).setOrigin(0.5);
      this.resultReplayText = this.add.text(replayX, btnY - 2, '再转一次', {
        fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5);
      this.resultEditText = this.add.text(editX, btnY - 2, '编辑转盘', {
        fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0.5);
      this.resultCard.add([
        this.resultTitleText, this.resultLabelText, this.resultSubText,
        this.resultReplayText, this.resultEditText,
      ]);
    }

    showResult(label) {
      const chars = Array.from(label || '').length;
      const size = chars <= 3 ? 50 : chars <= 5 ? 42 : chars <= 6 ? 36 : 30;
      this.resultLabelText.setText(label || '？').setFontSize(size);
      this.resultLayer.setVisible(true);
      this.resultCard.setAlpha(0);
      this.resultCard.setScale(0.86);
      this.tweens.killTweensOf(this.resultCard);
      this.tweens.add({
        targets: this.resultCard, alpha: 1, scale: 1,
        duration: 240, ease: 'Back.Out',
      });
    }

    hideResult() {
      if (!this.resultLayer) return;
      this.tweens.killTweensOf(this.resultCard);
      this.resultLayer.setVisible(false);
    }
    // -------------------------------------------------- 彩纸
    spawnConfetti() {
      this.clearConfetti();
      const palette = SEGMENT_COLORS.concat([0xFFD35C, 0xFFFFFF]);
      for (let i = 0; i < 84; i++) {
        const a = Math.random() * TAU;
        const speed = 90 + Math.random() * 320;
        this.liveProps.push({
          x: this.L.card.cx + Math.cos(a) * 32,
          y: this.L.card.cy - 10 + Math.sin(a) * 18,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - 130,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 8,
          size: 5 + Math.random() * 7,
          color: palette[i % palette.length],
          life: 1.4 + Math.random() * 1.2,
          maxLife: 2.6,
        });
      }
      for (let i = 0; i < 28; i++) {
        this.liveProps.push({
          x: 18 + Math.random() * (WIDTH - 36),
          y: -40 - Math.random() * 190,
          vx: (Math.random() * 2 - 1) * 34,
          vy: 80 + Math.random() * 150,
          rot: Math.random() * TAU,
          vr: (Math.random() * 2 - 1) * 5,
          size: 5 + Math.random() * 6,
          color: palette[(i + 3) % palette.length],
          life: 2.1 + Math.random() * 1.1,
          maxLife: 3.2,
        });
      }
    }

    clearConfetti() {
      if (!Array.isArray(this.liveProps)) this.liveProps = [];
      this.liveProps.length = 0;
      this.fxParticles = this.liveProps;
      if (this.fxG) this.fxG.clear();
    }

    updateConfetti(dt) {
      if (!this.fxG) return;
      this.fxG.clear();
      for (let i = this.liveProps.length - 1; i >= 0; i--) {
        const p = this.liveProps[i];
        p.life -= dt;
        p.vy += 510 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.life <= 0 || p.y > HEIGHT + 60) {
          this.liveProps.splice(i, 1);
          continue;
        }
        const alpha = clamp(p.life / Math.min(0.55, p.maxLife), 0, 1);
        const c = Math.cos(p.rot), s = Math.sin(p.rot), h = p.size / 2;
        this.fxG.fillStyle(p.color, alpha);
        fillPoly(this.fxG, [
          [p.x + c * -h - s * -h, p.y + s * -h + c * -h],
          [p.x + c * h - s * -h, p.y + s * h + c * -h],
          [p.x + c * h - s * h, p.y + s * h + c * h],
          [p.x + c * -h - s * h, p.y + s * -h + c * h],
        ]);
      }
    }

    // -------------------------------------------------- 指针与交互
    onPointerDown(pointer) {
      const x = pointer.x, y = pointer.y;
      if (this.phase === 'play') {
        if (contains(this.L.edit, x, y)) {
          Sound.click();
          this.editWheel();
          return;
        }
        const dx = x - this.L.wheel.x, dy = y - this.L.wheel.y;
        if (contains(this.L.spin, x, y) || dx * dx + dy * dy <= (WHEEL_R + 18) * (WHEEL_R + 18)) {
          this.startSpin();
        }
      } else if (this.phase === 'result') {
        if (contains(this.L.resultReplay, x, y)) {
          Sound.click();
          this.tryAgain();
        } else if (contains(this.L.resultEdit, x, y)) {
          Sound.click();
          this.editWheel();
        }
      }
    }

    drawEditButton() {
      const g = this.editG;
      g.clear();
      drawPill(g, this.L.edit, 0xFFF8E3, C.gold, 3, 0x5C218D);
      g.fillStyle(0xC778FF, 0.28);
      g.fillRoundedRect(this.L.edit.x - this.L.edit.w / 2 + 5, this.L.edit.y - this.L.edit.h / 2 + 5, this.L.edit.w - 10, 11, 6);
    }

    drawSpinButton() {
      const g = this.spinG;
      const r = this.L.spin;
      g.clear();
      g.fillStyle(0x5E164E, 0.55);
      g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2 + 9, r.w, r.h, r.h / 2);
      g.fillStyle(0xE84661, 1);
      g.fillRoundedRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, r.h / 2);
      g.fillStyle(0xFF9A5A, 1);
      g.fillRoundedRect(r.x - r.w / 2 + 5, r.y - r.h / 2 + 5, r.w - 10, r.h * 0.5, r.h / 2 - 5);
      g.fillStyle(0xFFD35C, 0.52);
      g.fillRoundedRect(r.x - r.w / 2 + 20, r.y - r.h / 2 + 10, r.w - 40, 13, 7);
      g.lineStyle(3, 0x9C2745, 0.55);
      g.strokeRoundedRect(r.x - r.w / 2 + 2, r.y - r.h / 2 + 2, r.w - 4, r.h - 4, r.h / 2);
      drawStar(g, r.x - 98, r.y + 2, 9, 0xFFF1A0, 0.95, 4);
      drawStar(g, r.x + 98, r.y + 2, 9, 0xFFF1A0, 0.95, 4);
    }
  }

  window.WheelScene = WheelScene;
})();