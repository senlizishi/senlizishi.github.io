(function () {
  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;
  const CENTER_X = WIDTH / 2;
  const choose = (landscape, portrait) => (IS_PORTRAIT ? portrait : landscape);
  // 窄高的容器让落点和堆叠更有决策压力，避免横向空间过大导致无脑连点。
  const BOARD = IS_PORTRAIT
    ? { left: 80, right: 460, top: 190, bottom: 610 }
    : { left: 290, right: 670, top: 66, bottom: 486 };
  const DANGER_Y = BOARD.top + 66;
  const TIMED_MODE = false;
  const ROUND_LIMIT = 120;
  const AUDIO_MASTER_VOLUME = 0.95;
  const AUDIO_MUSIC_VOLUME = 0.42;
  const AUDIO_SFX_VOLUME = 0.52;
  const MAX_TYPE = 8;
  const RADII = [18, 23, 29, 36, 44, 53, 64, 77, 92];
  const NAMES = ['微光冻', '泡泡冻', '软糖冻', '霓虹冻', '星彩冻', '宝石冻', '彩虹冻', '月光冻', '巨型冻'];
  const SHAPE_PROFILES = [
    [0.86, 0.98, 1.12, 1.09, 0.98, 0.88, 0.84, 0.94, 1.08, 1.13, 1.02, 0.91],
    [0.96, 1.10, 1.09, 0.96, 0.88, 0.90, 1.02, 1.12, 1.08, 0.94, 0.87, 0.92],
    [1.06, 1.12, 0.94, 0.86, 0.92, 1.08, 1.14, 1.03, 0.89, 0.84, 0.95, 1.08],
    [0.88, 1.04, 1.13, 1.02, 0.87, 0.92, 1.11, 1.14, 0.97, 0.84, 0.91, 1.05],
    [0.90, 1.06, 1.13, 0.94, 0.84, 1.02, 1.15, 1.05, 0.87, 0.91, 1.12, 0.98],
    [1.02, 1.14, 0.98, 0.86, 1.04, 1.16, 0.96, 0.85, 1.08, 1.12, 0.92, 0.87],
    [0.88, 1.04, 1.16, 0.92, 0.86, 1.14, 1.02, 0.84, 1.10, 1.12, 0.93, 0.89],
    [1.08, 1.14, 0.91, 0.86, 1.10, 1.06, 0.88, 0.90, 1.15, 1.03, 0.85, 0.96],
    [0.88, 1.10, 1.16, 0.90, 0.86, 1.12, 1.04, 0.87, 1.15, 1.08, 0.84, 0.96],
  ];
  const PALETTE = [
    { base: 0xff5fc8, dark: 0xc72c91, light: 0xffa9e7, rim: 0xffd3f3 },
    { base: 0xff5d8e, dark: 0xe04458, light: 0xff9fa6, rim: 0xffd3d8 },
    { base: 0xff8a48, dark: 0xe05221, light: 0xffc06a, rim: 0xffe5bb },
    { base: 0xffd84e, dark: 0xe29c1d, light: 0xfff5a4, rim: 0xfffce0 },
    { base: 0x9ee75a, dark: 0x52b64d, light: 0xd9ff9d, rim: 0xedffd7 },
    { base: 0x4de5bf, dark: 0x20a18c, light: 0x99ffe8, rim: 0xd3fff8 },
    { base: 0x55a7ff, dark: 0x3264d3, light: 0x9fd5ff, rim: 0xe0f2ff },
    { base: 0x9b72ff, dark: 0x5b3cc1, light: 0xc9b5ff, rim: 0xf0e8ff },
    { base: 0xff78ee, dark: 0xc733bd, light: 0xffc4f8, rim: 0xffe7fc },
  ];
  const JELLY_SKINS = {
    'jelly-default': PALETTE,
    'jelly-soda': [
      { base: 0x43e8ff, dark: 0x178ab5, light: 0xa8f8ff, rim: 0xe4fdff },
      { base: 0x4cbcff, dark: 0x356bd1, light: 0xa8e0ff, rim: 0xe6f6ff },
      { base: 0x6d8eff, dark: 0x4d4fc4, light: 0xbacaff, rim: 0xebefff },
      { base: 0xa675ff, dark: 0x7044c5, light: 0xd5bdff, rim: 0xf4ecff },
      { base: 0xe56cff, dark: 0xa13ab7, light: 0xf6b7ff, rim: 0xfde8ff },
      { base: 0x63f2ce, dark: 0x1d9d82, light: 0xb6ffe9, rim: 0xe7fff8 },
      { base: 0x9bf05b, dark: 0x55a83d, light: 0xd8ffac, rim: 0xf0ffdf },
      { base: 0x55e5e1, dark: 0x228f9c, light: 0xaafbf7, rim: 0xe0fffe },
      { base: 0xb780ff, dark: 0x7544c9, light: 0xddc5ff, rim: 0xf5eeff },
    ],
    'jelly-milky': [
      { base: 0xffb9cf, dark: 0xd87698, light: 0xffdce8, rim: 0xfff4f7 },
      { base: 0xffc3aa, dark: 0xd9856e, light: 0xffe2d5, rim: 0xfff6ef },
      { base: 0xffd879, dark: 0xd39b44, light: 0xffebb5, rim: 0xfffae4 },
      { base: 0xffeda3, dark: 0xd2ae64, light: 0xfff6ce, rim: 0xfffced },
      { base: 0xc9eda0, dark: 0x82b467, light: 0xe7f8ca, rim: 0xf6ffe9 },
      { base: 0xaee5d8, dark: 0x65aa9b, light: 0xd5f5ed, rim: 0xf0fffb },
      { base: 0xadd7f2, dark: 0x6b9fc5, light: 0xd7ecfa, rim: 0xf1f9ff },
      { base: 0xc9c1ef, dark: 0x8d7fc2, light: 0xe5e0fa, rim: 0xf8f6ff },
      { base: 0xe8bce4, dark: 0xad79a8, light: 0xf5dcf2, rim: 0xfff5fd },
    ],
  };
  const BACKGROUND_THEMES = {
    'theme-default': { name: '晴空糖果', sky: 0xbcecff, orbLeft: 0xe7f9ff, orbRight: 0xfff0c5, beamLeft: 0x8ed9ef, beamRight: 0xff8ecf, sparkle: 0xffffff },
    'theme-starlight': { name: '星糖夜曲', sky: 0x30294f, orbLeft: 0x5b4f91, orbRight: 0xd369a5, beamLeft: 0x6e86d9, beamRight: 0xff9dce, sparkle: 0xffedb5 },
    'theme-peach': { name: '蜜桃落日', sky: 0xffc3b6, orbLeft: 0xffe6cd, orbRight: 0xe6a9c6, beamLeft: 0xffd17e, beamRight: 0xe991ba, sparkle: 0xfff7e9 },
  };
  const STORE_PRODUCTS = [
    { sku: 'theme-starlight', category: 'background', name: '星糖夜曲', description: '紫蓝星空与粉色光晕' },
    { sku: 'theme-peach', category: 'background', name: '蜜桃落日', description: '温柔蜜桃色落日天空' },
    { sku: 'jelly-soda', category: 'jelly', name: '汽水晶冻', description: '清透汽水色与气泡高光' },
    { sku: 'jelly-milky', category: 'jelly', name: '牛奶布丁', description: '柔和奶油色布丁质感' },
  ];
  const STORE_DEFAULT_PRODUCTS = [
    { sku: 'theme-default', category: 'background', name: '晴空糖果', description: '经典明亮糖果天空' },
    { sku: 'jelly-default', category: 'jelly', name: '彩虹果冻', description: '经典鲜艳彩虹果冻' },
  ];
  const STORE_ALL_PRODUCTS = [...STORE_DEFAULT_PRODUCTS, ...STORE_PRODUCTS];

  window.JellyBestScore = window.JellyBestScore || 0;
  window.JellyScoreHistory = window.JellyScoreHistory || [];

  const CosmeticStore = {
    owned: new Set(STORE_ALL_PRODUCTS.map((product) => product.sku)),
    equippedTheme: 'theme-default',
    equippedSkin: 'jelly-default',
    init() { return Promise.resolve(this); },

    isOwned(sku) { return this.owned.has(sku); },

    isEquipped(product) {
      return product.category === 'background' ? this.equippedTheme === product.sku : this.equippedSkin === product.sku;
    },

    async equip(product) {
      if (!this.isOwned(product.sku)) return false;
      if (product.category === 'background') this.equippedTheme = product.sku;
      else this.equippedSkin = product.sku;
      analytics('shop_equip', { sku: product.sku, category: product.category });
      return true;
    },
  };
  window.CosmeticStore = CosmeticStore;

  const JellyAudio = {
    context: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    timer: null,
    nextNoteTime: 0,
    step: 0,
    musicMuted: false,
    sfxMuted: false,
    musicVolume: AUDIO_MUSIC_VOLUME,
    sfxVolume: AUDIO_SFX_VOLUME,
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
          // 整体提高一档，但保留音效相对音乐更突出的层级，避免削波。
          this.musicGain.gain.value = this.musicMuted ? 0 : this.musicVolume;
          this.sfxGain.gain.value = this.sfxMuted ? 0 : this.sfxVolume;
          this.master.gain.value = AUDIO_MASTER_VOLUME;
          this.musicGain.connect(this.master);
          this.sfxGain.connect(this.master);
          this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume();
        if (!this.timer) {
          this.nextNoteTime = this.context.currentTime + 0.05;
          this.step = 0;
          this.timer = window.setInterval(() => this.scheduleMusic(), 80);
        }
        this.started = true;
        return true;
      } catch (_) {
        return false;
      }
    },

    toggleMusic() {
      this.start();
      this.musicMuted = !this.musicMuted;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicVolume, this.context.currentTime, 0.03);
      return !this.musicMuted;
    },

    setMusicVolume(value) {
      this.musicVolume = clamp(value, 0, 1);
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0 : this.musicVolume, this.context.currentTime, 0.03);
      return this.musicVolume;
    },

    toggleSfx() {
      this.start();
      this.sfxMuted = !this.sfxMuted;
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.context.currentTime, 0.03);
      return !this.sfxMuted;
    },

    setSfxVolume(value) {
      this.sfxVolume = clamp(value, 0, 1);
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxMuted ? 0 : this.sfxVolume, this.context.currentTime, 0.03);
      return this.sfxVolume;
    },

    tone(frequency, duration, wave, gain, when, destination) {
      if (!this.context || !destination) return;
      if (destination === this.musicGain && this.musicMuted) return;
      if (destination === this.sfxGain && this.sfxMuted) return;
      const now = when || this.context.currentTime;
      const osc = this.context.createOscillator();
      const amp = this.context.createGain();
      osc.type = wave || 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.018);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp); amp.connect(destination);
      osc.start(now); osc.stop(now + duration + 0.04);
    },

    scheduleMusic() {
      if (!this.context || !this.musicGain || this.context.state !== 'running') return;
      const lookAhead = 0.62;
      // 原创童谣感 A/B 段落：圆润木琴主奏、柔和和弦与低音问答。
      // 不复刻任何现有旋律；96 个八分音符约 28 秒才完整循环一次。
      const beat = (60 / 104) / 2;
      const notes = [
        // A 段：短句像一问一答，句尾留白。
        523.25, 659.25, 783.99, 659.25, 587.33, 659.25,
        698.46, 880.0, 783.99, 659.25, 587.33, 0,
        659.25, 783.99, 1046.5, 783.99, 659.25, 587.33,
        698.46, 659.25, 587.33, 783.99, 523.25, 0,
        523.25, 587.33, 659.25, 783.99, 659.25, 587.33,
        698.46, 783.99, 880.0, 783.99, 698.46, 659.25,
        587.33, 659.25, 698.46, 880.0, 783.99, 587.33,
        659.25, 587.33, 523.25, 493.88, 523.25, 0,
        // B 段：抬高音区并改变走向，让后半段有新鲜感。
        783.99, 880.0, 1046.5, 987.77, 880.0, 783.99,
        698.46, 783.99, 880.0, 1046.5, 880.0, 0,
        659.25, 698.46, 783.99, 880.0, 1046.5, 880.0,
        783.99, 698.46, 659.25, 783.99, 587.33, 0,
        698.46, 880.0, 1046.5, 880.0, 783.99, 698.46,
        659.25, 783.99, 880.0, 783.99, 698.46, 587.33,
        523.25, 659.25, 783.99, 698.46, 659.25, 587.33,
        698.46, 659.25, 587.33, 523.25, 523.25, 0,
      ];
      const chords = [
        [130.81, 164.81, 196.0], [123.47, 146.83, 196.0],
        [110.0, 130.81, 164.81], [87.31, 130.81, 174.61],
        [98.0, 130.81, 164.81], [110.0, 146.83, 174.61],
        [98.0, 123.47, 146.83], [130.81, 164.81, 196.0],
        [110.0, 130.81, 164.81], [98.0, 130.81, 164.81],
        [87.31, 130.81, 174.61], [98.0, 123.47, 146.83],
        [110.0, 146.83, 174.61], [98.0, 130.81, 164.81],
        [123.47, 146.83, 196.0], [130.81, 164.81, 196.0],
      ];
      while (this.nextNoteTime < this.context.currentTime + lookAhead) {
        const note = notes[this.step % notes.length];
        if (note) {
          this.tone(note, beat * 0.78, 'triangle', 0.076, this.nextNoteTime, this.musicGain);
          this.tone(note * 2, beat * 0.26, 'sine', 0.014, this.nextNoteTime + 0.012, this.musicGain);
        }
        const barStep = this.step % 6;
        if (barStep === 0) {
          const chord = chords[Math.floor(this.step / 6) % chords.length];
          chord.forEach((frequency, index) => this.tone(frequency, beat * 5.55, index === 0 ? 'sine' : 'triangle', index === 0 ? 0.031 : 0.014, this.nextNoteTime, this.musicGain));
          this.tone(chord[0] * 2, beat * 1.45, 'sine', 0.027, this.nextNoteTime, this.musicGain);
        }
        if (barStep === 3) {
          const chord = chords[Math.floor(this.step / 6) % chords.length];
          this.tone(chord[2], beat * 1.25, 'sine', 0.019, this.nextNoteTime, this.musicGain);
        }
        this.nextNoteTime += beat;
        this.step += 1;
      }
    },

    drop(type) {
      this.start();
      if (!this.context || this.sfxMuted) return;
      this.tone(180 + type * 25, 0.09, 'sine', 0.16, this.context.currentTime, this.sfxGain);
      this.tone(95 + type * 12, 0.13, 'triangle', 0.09, this.context.currentTime + 0.035, this.sfxGain);
    },

    merge(type) {
      this.start();
      if (!this.context || this.sfxMuted) return;
      const when = this.context.currentTime;
      const root = 330 + type * 28;
      this.tone(root, 0.28, 'sine', 0.2, when, this.sfxGain);
      this.tone(root * 1.25, 0.32, 'triangle', 0.13, when + 0.035, this.sfxGain);
      this.tone(root * 1.5, 0.38, 'triangle', 0.11, when + 0.075, this.sfxGain);
    },

    warning() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      this.tone(132, 0.12, 'square', 0.075, this.context.currentTime, this.sfxGain);
    },

    finish() {
      this.start();
      if (!this.context || this.sfxMuted) return;
      const when = this.context.currentTime;
      this.tone(392, 0.24, 'triangle', 0.16, when, this.sfxGain);
      this.tone(261.63, 0.42, 'sine', 0.12, when + 0.11, this.sfxGain);
    },
  };
  window.JellyAudio = JellyAudio;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function radius(type) { return RADII[Math.min(type, MAX_TYPE)]; }
  function paletteFor(type, skinId) {
    const skin = JELLY_SKINS[skinId || CosmeticStore.equippedSkin] || PALETTE;
    return skin[Math.min(type, MAX_TYPE)];
  }
  function formatTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(whole / 60);
    const remaining = String(whole % 60).padStart(2, '0');
    return `${minutes}:${remaining}`;
  }
  function analytics(name, data) {
    if (window.GameAnalytics && window.GameAnalytics.available) window.GameAnalytics.track(name, data);
  }

  function addButton(scene, x, y, width, height, label, onClick, options) {
    const opts = options || {};
    const container = scene.add.container(x, y).setDepth(opts.depth || 30);
    const bg = scene.add.rectangle(0, 0, width, height, opts.color || 0x322052, 1)
      .setStrokeStyle(2, opts.stroke || 0x8d74db, 1).setInteractive({ useHandCursor: true });
    const text = scene.add.text(0, 0, label, {
      fontFamily: 'Microsoft YaHei, sans-serif', fontSize: opts.fontSize || '19px', fontStyle: 'bold',
      color: opts.textColor || '#fff8ff', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(opts.hover || 0x563d87));
    bg.on('pointerout', () => bg.setFillStyle(opts.color || 0x322052));
    bg.on('pointerdown', () => { scene.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: 55, yoyo: true }); onClick(); });
    container.add([bg, text]);
    container.buttonText = text;
    return container;
  }

  function drawThemePreview(graphics, x, y, width, height, themeId) {
    const theme = BACKGROUND_THEMES[themeId] || BACKGROUND_THEMES['theme-default'];
    graphics.fillStyle(theme.sky, 1).fillRoundedRect(x - width / 2, y - height / 2, width, height, 12);
    graphics.fillStyle(theme.orbLeft, 0.82).fillCircle(x - width * 0.34, y - height * 0.2, height * 0.24);
    graphics.fillStyle(theme.orbRight, 0.7).fillCircle(x + width * 0.36, y + height * 0.24, height * 0.24);
    graphics.fillStyle(theme.beamLeft, 0.28).fillTriangle(x, y - height * 0.55, x - width * 0.24, y + height * 0.5, x - width * 0.04, y + height * 0.5);
    graphics.fillStyle(theme.beamRight, 0.2).fillTriangle(x, y - height * 0.55, x + width * 0.27, y + height * 0.5, x + width * 0.05, y + height * 0.5);
    graphics.fillStyle(theme.sparkle, 0.72);
    for (let i = 0; i < 12; i += 1) graphics.fillCircle(x - width * 0.42 + (i % 6) * width * 0.17, y - height * 0.33 + Math.floor(i / 6) * height * 0.52, 1.3);
    graphics.lineStyle(2, 0xfff7ec, 0.75).strokeRoundedRect(x - width / 2, y - height / 2, width, height, 12);
  }

  function addAudioSlider(scene, label, y, getValue, setValue) {
    const panelCenterX = choose(815, CENTER_X);
    const left = panelCenterX - 100;
    const width = 145;
    const items = scene.audioPanelItems;
    const labelText = scene.add.text(left - 5, y - 21, label, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff7ef' }).setDepth(62);
    const valueText = scene.add.text(panelCenterX + 45, y - 21, '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#ffe8d7', align: 'right' }).setOrigin(1, 0).setDepth(62);
    const track = scene.add.rectangle(left + width / 2, y, width, 8, 0x6e5278, 1).setStrokeStyle(1, 0xc890a6, 0.8).setInteractive({ useHandCursor: true }).setDepth(62);
    const fill = scene.add.rectangle(left, y, width, 8, 0xff9b83, 1).setOrigin(0, 0.5).setDepth(63);
    const knob = scene.add.circle(left + width * getValue(), y, 9, 0xfff5e8, 1).setStrokeStyle(2, 0xffb59c, 1).setInteractive({ useHandCursor: true, draggable: true }).setDepth(64);
    const update = (pointerX) => {
      const value = clamp((pointerX - left) / width, 0, 1);
      setValue(value);
      fill.width = width * value;
      knob.x = left + width * value;
      valueText.setText(`${Math.round(value * 100)}%`);
    };
    track.on('pointerdown', (pointer) => update(pointer.x));
    const onDrag = (pointer, gameObject, dragX) => { if (gameObject === knob) update(dragX); };
    scene.input.setDraggable(knob);
    scene.input.on('drag', onDrag);
    scene.audioPanelDragHandlers.push(onDrag);
    update(left + width * getValue());
    items.push(labelText, valueText, track, fill, knob);
    return { knob, valueText, update };
  }

  function drawBackdrop(graphics, themeId) {
    const theme = BACKGROUND_THEMES[themeId || CosmeticStore.equippedTheme] || BACKGROUND_THEMES['theme-default'];
    graphics.fillStyle(theme.sky, 1).fillRect(0, 0, WIDTH, HEIGHT);
    graphics.fillStyle(theme.orbLeft, 0.9).fillCircle(WIDTH * 0.11, HEIGHT * 0.18, choose(230, 215));
    graphics.fillStyle(theme.orbRight, 0.72).fillCircle(WIDTH * 0.89, HEIGHT * 0.8, choose(250, 235));
    graphics.fillStyle(theme.beamLeft, 0.2).fillTriangle(CENTER_X, -40, WIDTH * 0.22, HEIGHT, WIDTH * 0.42, HEIGHT);
    graphics.fillStyle(theme.beamRight, 0.13).fillTriangle(CENTER_X, -40, WIDTH * 0.78, HEIGHT, WIDTH * 0.58, HEIGHT);
    graphics.fillStyle(theme.sparkle, themeId === 'theme-starlight' ? 0.82 : 0.62);
    for (let x = 16; x < WIDTH; x += 46) for (let y = 16; y < HEIGHT; y += 46) graphics.fillCircle(x, y, 0.8 + ((x * 13 + y * 7) % 9) / 10);
    if ((themeId || CosmeticStore.equippedTheme) === 'theme-starlight') {
      graphics.lineStyle(1, 0xffedb5, 0.38);
      for (let x = 36; x < WIDTH; x += 118) graphics.lineBetween(x - 4, 76 + (x % 91), x + 4, 76 + (x % 91));
    }
  }

  function smoothClosedPoints(points, iterations) {
    let current = points;
    for (let pass = 0; pass < iterations; pass += 1) {
      const next = [];
      for (let i = 0; i < current.length; i += 1) {
        const a = current[i];
        const b = current[(i + 1) % current.length];
        next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      current = next;
    }
    return current;
  }

  function blobPoints(x, y, type, scale, angle, squash, stretchX) {
    const r = radius(type) * (scale || 1);
    const points = [];
    const count = 12;
    const squish = squash || 1;
    for (let i = 0; i < count; i += 1) {
      const theta = (Math.PI * 2 * i) / count;
      const profile = SHAPE_PROFILES[Math.min(type, SHAPE_PROFILES.length - 1)];
      const wobble = profile[i] + 0.025 * Math.sin(i * 4.7 + type);
      const px = Math.cos(theta) * r * wobble;
      const py = Math.sin(theta) * r * wobble;
      const c = Math.cos(angle || 0);
      const s = Math.sin(angle || 0);
      // 先旋转不规则轮廓，再按世界坐标形变：落地时始终横向摊开、纵向压扁，
      // 不会因为刚体旋转而把“压扁”误画成向上拉长。
      points.push({
        x: x + (px * c - py * s) * (stretchX || 1),
        y: y + (px * s + py * c) * squish,
      });
    }
    return smoothClosedPoints(points, 2);
  }

  function drawJelly(graphics, x, y, type, alpha, scale, angle, squash, stretchX, skinId) {
    const activeSkin = skinId || CosmeticStore.equippedSkin;
    const palette = paletteFor(type, activeSkin);
    const r = radius(type) * (scale || 1);
    const opacity = alpha === undefined ? 1 : alpha;
    const points = blobPoints(x, y + r * 0.1, type, scale, angle, squash, stretchX);
    const wide = stretchX || 1;
    graphics.fillStyle(0x060310, 0.24 * opacity).fillEllipse(x + 3, y + r * 0.82, r * 1.72 * wide, r * 0.47);
    graphics.fillStyle(palette.dark, 0.98 * opacity).fillPoints(points, true);
    graphics.fillStyle(palette.base, 0.96 * opacity).fillPoints(blobPoints(x, y - r * 0.02, type, (scale || 1) * 0.94, angle, squash, wide), true);
    graphics.fillStyle(palette.light, 0.26 * opacity).fillEllipse(x - r * 0.08, y + r * 0.22, r * 1.38 * wide, r * 1.02 * (squash || 1));
    graphics.fillStyle(palette.rim, 0.3 * opacity).fillEllipse(x - r * 0.18, y - r * 0.32, r * 0.9 * wide, r * 0.3);
    graphics.fillStyle(0xffffff, 0.7 * opacity).fillEllipse(x - r * 0.3, y - r * 0.42, r * 0.48 * wide, r * 0.2);
    graphics.fillStyle(0xffffff, 0.42 * opacity).fillCircle(x - r * 0.44 * wide, y - r * 0.08, Math.max(2, r * 0.08));
    graphics.fillStyle(0xffffff, 0.28 * opacity).fillCircle(x + r * 0.35 * wide, y + r * 0.25, Math.max(1.5, r * 0.06));
    graphics.fillStyle(0xffffff, 0.2 * opacity).fillCircle(x + r * 0.05, y + r * 0.43, Math.max(1.5, r * 0.045));
    if (activeSkin === 'jelly-soda') {
      graphics.lineStyle(Math.max(1, r * 0.025), 0xffffff, 0.28 * opacity).strokeCircle(x + r * 0.15, y - r * 0.06, r * 0.13);
      graphics.fillStyle(0xffffff, 0.22 * opacity).fillCircle(x - r * 0.08, y + r * 0.28, Math.max(1.5, r * 0.055));
    } else if (activeSkin === 'jelly-milky') {
      graphics.fillStyle(0xfff8e8, 0.25 * opacity).fillEllipse(x, y - r * 0.12, r * 1.25 * wide, r * 0.42 * (squash || 1));
    }
    graphics.lineStyle(Math.max(1.5, r * 0.075), palette.rim, 0.72 * opacity).strokePoints(points, true);
    if (type >= 4) graphics.lineStyle(Math.max(1, r * 0.035), 0xffffff, 0.2 * opacity).strokeCircle(x, y, r * 0.72);
  }

  class JellyTitleScene extends Phaser.Scene {
    constructor() { super('JellyTitleScene'); }
    create() {
      const bg = this.add.graphics();
      const art = this.add.graphics();
      const redrawCosmetics = () => {
        bg.clear(); art.clear(); drawBackdrop(bg);
        drawJelly(art, CENTER_X, choose(248, 405), 7, 1, 1.12, -0.09, 1);
        drawJelly(art, CENTER_X - choose(73, 85), choose(306, 495), 2, 0.95, 0.56, 0.16, 1);
        drawJelly(art, CENTER_X + choose(76, 85), choose(314, 505), 4, 0.95, 0.62, -0.18, 1);
      };
      redrawCosmetics();
      CosmeticStore.init().then(redrawCosmetics);
      this.tweens.add({ targets: art, y: -8, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.text(CENTER_X, choose(88, 128), '果冻叠叠乐', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('58px', '52px'), fontStyle: 'bold', color: '#4b354d', stroke: '#fff7ea', strokeThickness: 8 }).setOrigin(0.5);
      this.add.text(CENTER_X, choose(146, 194), '让软糯果冻滑着、弹着、合在一起', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('21px', '19px'), color: '#765f68', align: 'center', wordWrap: { width: choose(900, 470) } }).setOrigin(0.5);
      addButton(this, CENTER_X, choose(438, 690), choose(220, 260), choose(54, 62), '开始游戏', () => { JellyAudio.start(); analytics('game_start', { mode: 'jelly_merge' }); this.scene.start('JellyGameScene'); }, { color: 0xff8f76, hover: 0xffa98e, stroke: 0xfff3d6, textColor: '#5f3441' });
      this.add.text(CENTER_X, choose(370, 610), IS_PORTRAIT ? '手指拖动选择落点 · 松手或轻点放下果冻' : '鼠标 / 手指选择落点 · 点击或空格放下 · A/D 微调', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '16px', color: '#765f68', align: 'center', wordWrap: { width: choose(900, 470) } }).setOrigin(0.5);
      this.add.text(CENTER_X, choose(503, 835), '不规则软胶形状 · 真实重力 · 滑动与弹性碰撞', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#8b7079', align: 'center', wordWrap: { width: choose(900, 470) } }).setOrigin(0.5);
      addButton(this, choose(74, 72), choose(34, 48), choose(92, 98), choose(32, 36), '返回入口', () => this.scene.start('GameHubScene'), { depth: 25, fontSize: '12px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
    }
  }

  class JellyGameScene extends Phaser.Scene {
    constructor() { super('JellyGameScene'); }

    create() {
      this.state = 'playing'; this.score = 0; this.combo = 0; this.mergeCount = 0; this.dropCount = 0; this.maxType = 0; this.elapsed = 0; this.dangerTimers = new Map();
      this.jellies = []; this.particles = []; this.nextId = 1; this.cursorX = CENTER_X; this.active = null;
      this.pendingMerges = new Map(); this.mergeBusy = new Set();
      this.backgroundGraphics = this.add.graphics().setDepth(0); drawBackdrop(this.backgroundGraphics);
      this.boardGraphics = this.add.graphics().setDepth(1); this.fxGraphics = this.add.graphics().setDepth(6); this.jellyGraphics = this.add.graphics().setDepth(7); this.drawBoard();
      this.add.text(choose(24, 20), choose(20, 24), '果冻叠叠乐', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('26px', '24px'), fontStyle: 'bold', color: '#4b354d' }).setDepth(20);
      this.add.text(choose(24, 20), choose(52, 57), '让同色果冻滑着相遇，越合越大', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('14px', '13px'), color: '#806770' }).setDepth(20);
      this.scoreText = this.add.text(WIDTH - choose(24, 20), choose(20, 24), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('20px', '18px'), fontStyle: 'bold', color: '#4b354d', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.bestText = this.add.text(WIDTH - choose(24, 20), choose(51, 52), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#806770', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.timeText = this.add.text(WIDTH - choose(24, 20), choose(75, 76), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#806770', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.nextLabel = this.add.text(choose(750, CENTER_X), choose(105, 116), '下一个', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#806770', align: 'center' }).setOrigin(0.5).setDepth(20);
      this.nextGraphics = this.add.graphics().setDepth(20);
      this.statusText = this.add.text(CENTER_X, choose(514, 650), IS_PORTRAIT ? '手指拖动选择落点，松手放下果冻' : '移动指针选择落点，点击放下果冻', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#6b515c', align: 'center', wordWrap: { width: choose(430, 480) } }).setOrigin(0.5).setDepth(20);
      this.helpText = this.add.text(CENTER_X, choose(536, 680), IS_PORTRAIT ? '按住左右拖动 · 轻点棋盘也可直接放下' : 'A / D 或方向键微调 · 空格放下 · R 重置', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#a1848c', align: 'center' }).setOrigin(0.5).setDepth(20);
      this.audioPanelItems = [];
      this.audioPanelDragHandlers = [];
      this.audioSettingsOpen = false;
      const utilityButtonStyle = { depth: 25, fontSize: '13px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' };
      this.audioSettingsButton = addButton(this, choose(760, 158), choose(514, 748), choose(70, 92), choose(35, 42), '音量', () => this.toggleAudioSettings(), utilityButtonStyle);
      this.shopOpen = false;
      this.shopCategory = 'background';
      this.shopBusy = false;
      this.shopItems = [];
      this.shopProductItems = [];
      this.shopButton = addButton(this, choose(840, 270), choose(514, 748), choose(70, 92), choose(35, 42), '商城', () => this.openShop(), utilityButtonStyle);
      addButton(this, choose(920, 382), choose(514, 748), choose(70, 92), choose(35, 42), '重开', () => this.restart(), utilityButtonStyle);
      this.keys = this.input.keyboard.addKeys({ left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT, a: Phaser.Input.Keyboard.KeyCodes.A, d: Phaser.Input.Keyboard.KeyCodes.D, space: Phaser.Input.Keyboard.KeyCodes.SPACE, r: Phaser.Input.Keyboard.KeyCodes.R, esc: Phaser.Input.Keyboard.KeyCodes.ESC });
      this.touchGesture = null;
      const isTouchPointer = (pointer) => pointer.pointerType === 'touch' || (pointer.event && (pointer.event.pointerType === 'touch' || pointer.event.pointerType === 2));
      const isBoardPointer = (pointer) => pointer.x >= BOARD.left && pointer.x <= BOARD.right && pointer.y >= BOARD.top && pointer.y <= BOARD.bottom;
      this.input.on('pointermove', (pointer) => {
        if (isTouchPointer(pointer)) {
          if (!this.touchGesture || this.touchGesture.id !== pointer.id) return;
          if (Math.abs(pointer.x - this.touchGesture.startX) > 8 || Math.abs(pointer.y - this.touchGesture.startY) > 8) this.touchGesture.moved = true;
          this.moveCursor(pointer.x);
          return;
        }
        this.moveCursor(pointer.x);
      });
      this.input.on('pointerdown', (pointer) => {
        JellyAudio.start();
        if (this.audioSettingsOpen || this.shopOpen || !isBoardPointer(pointer)) return;
        this.moveCursor(pointer.x);
        if (isTouchPointer(pointer)) {
          this.touchGesture = { id: pointer.id, startX: pointer.x, startY: pointer.y, moved: false };
        } else {
          this.dropActive();
        }
      });
      this.input.on('pointerup', (pointer) => {
        if (!isTouchPointer(pointer) || !this.touchGesture || this.touchGesture.id !== pointer.id) return;
        const gesture = this.touchGesture;
        this.touchGesture = null;
        if (!this.audioSettingsOpen && !this.shopOpen && (gesture.moved || isBoardPointer(pointer))) this.dropActive();
      });
      this.input.on('pointerupoutside', (pointer) => {
        if (isTouchPointer(pointer) && this.touchGesture && this.touchGesture.id === pointer.id) {
          this.touchGesture = null;
        }
      });
      this.matter.world.on('collisionstart', (event) => this.handleCollisions(event));
      this.addWalls(); this.nextType = this.pickNextType(); this.spawnActive(); analytics('level_start', { mode: 'jelly_merge' });
      CosmeticStore.init().then(() => this.redrawBackground());
    }

    redrawBackground() {
      this.backgroundGraphics.clear();
      drawBackdrop(this.backgroundGraphics);
    }

    toggleAudioSettings() {
      if (this.shopOpen) this.closeShop();
      if (this.audioSettingsOpen) this.closeAudioSettings(); else this.openAudioSettings();
    }

    openAudioSettings() {
      if (this.audioSettingsOpen) return;
      this.audioSettingsOpen = true;
      const addPanelItem = (item) => { this.audioPanelItems.push(item); return item; };
      const panelX = choose(815, CENTER_X);
      const panelY = choose(343, 480);
      addPanelItem(this.add.rectangle(panelX, panelY + 8, 278, 238, 0x160e2d, 0.2).setDepth(58));
      addPanelItem(this.add.rectangle(panelX, panelY, 270, 230, 0x34224f, 0.97).setStrokeStyle(2, 0xe6a9a1, 0.92).setDepth(60));
      addPanelItem(this.add.text(panelX, panelY - 90, '音量设置', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '22px', fontStyle: 'bold', color: '#fff7ef' }).setOrigin(0.5).setDepth(62));
      addPanelItem(this.add.text(panelX, panelY - 71, '分别调节音乐与游戏音效', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '11px', color: '#e8c8d0' }).setOrigin(0.5).setDepth(62));
      addAudioSlider(this, '背景音乐', panelY - 37, () => JellyAudio.musicVolume, (value) => JellyAudio.setMusicVolume(value));
      addAudioSlider(this, '游戏音效', panelY + 25, () => JellyAudio.sfxVolume, (value) => JellyAudio.setSfxVolume(value));
      const musicMute = addButton(this, panelX + 95, panelY - 37, 70, 27, JellyAudio.musicMuted ? '已静音' : '静音', () => {
        const enabled = JellyAudio.toggleMusic();
        musicMute.buttonText.setText(enabled ? '静音' : '已静音');
      }, { depth: 65, fontSize: '11px', color: 0x5c3e69, hover: 0x76517e, stroke: 0xd9a2ad, textColor: '#fff7ef' });
      const sfxMute = addButton(this, panelX + 95, panelY + 25, 70, 27, JellyAudio.sfxMuted ? '已静音' : '静音', () => {
        const enabled = JellyAudio.toggleSfx();
        sfxMute.buttonText.setText(enabled ? '静音' : '已静音');
      }, { depth: 65, fontSize: '11px', color: 0x5c3e69, hover: 0x76517e, stroke: 0xd9a2ad, textColor: '#fff7ef' });
      addPanelItem(musicMute); addPanelItem(sfxMute);
      addPanelItem(addButton(this, panelX, panelY + 87, 92, 30, '完成', () => this.closeAudioSettings(), { depth: 65, fontSize: '13px', color: 0xff927d, hover: 0xffb29b, stroke: 0xffd1bd, textColor: '#5f3441' }));
    }

    closeAudioSettings() {
      if (!this.audioSettingsOpen) return;
      this.audioPanelDragHandlers.forEach((handler) => this.input.off('drag', handler));
      this.audioPanelItems.forEach((item) => item.destroy());
      this.audioPanelItems = [];
      this.audioPanelDragHandlers = [];
      this.audioSettingsOpen = false;
    }

    openShop() {
      if (this.shopOpen) return;
      this.closeAudioSettings();
      this.shopOpen = true;
      analytics('shop_open', { category: this.shopCategory });
      const addShopItem = (item) => { this.shopItems.push(item); return item; };
      addShopItem(this.add.rectangle(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x20162f, 0.48).setInteractive().setDepth(69));
      addShopItem(this.add.rectangle(CENTER_X, choose(275, 485), choose(734, 510), choose(462, 890), 0x34224f, 0.28).setDepth(70));
      addShopItem(this.add.rectangle(CENTER_X, choose(265, 475), choose(724, 500), choose(452, 880), 0xfff6eb, 0.99).setStrokeStyle(3, 0x80506e, 0.92).setDepth(71));
      addShopItem(this.add.text(CENTER_X, choose(61, 55), '果冻换装屋', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('30px', '28px'), fontStyle: 'bold', color: '#56364f' }).setOrigin(0.5).setDepth(72));
      addShopItem(this.add.text(CENTER_X, choose(91, 91), '所有背景与皮肤都可以免费使用 · 点击即可切换', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('13px', '12px'), color: '#8f6b79', align: 'center', wordWrap: { width: choose(700, 390) } }).setOrigin(0.5).setDepth(72));
      addShopItem(addButton(this, choose(808, 480), choose(91, 54), 50, 28, '关闭', () => this.closeShop(), { depth: 74, fontSize: '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' }));
      this.shopStatusText = addShopItem(this.add.text(CENTER_X, choose(468, 880), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#9b5e58', align: 'center' }).setOrigin(0.5).setDepth(74));
      this.shopBackgroundTab = addShopItem(addButton(this, choose(390, 165), choose(126, 130), choose(170, 190), 36, '背景主题', () => this.setShopCategory('background'), { depth: 74, fontSize: '14px', color: 0xffb29b, hover: 0xffc7b3, stroke: 0xf09b8d, textColor: '#5f3441' }));
      this.shopJellyTab = addShopItem(addButton(this, choose(570, 375), choose(126, 130), choose(170, 190), 36, '果冻皮肤', () => this.setShopCategory('jelly'), { depth: 74, fontSize: '14px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' }));
      this.renderShopProducts();
    }

    setShopCategory(category) {
      if (this.shopBusy || this.shopCategory === category) return;
      this.shopCategory = category;
      this.shopBackgroundTab.destroy(); this.shopJellyTab.destroy();
      this.shopItems = this.shopItems.filter((item) => item !== this.shopBackgroundTab && item !== this.shopJellyTab);
      this.shopBackgroundTab = addButton(this, choose(390, 165), choose(126, 130), choose(170, 190), 36, '背景主题', () => this.setShopCategory('background'), { depth: 74, fontSize: '14px', color: category === 'background' ? 0xffb29b : 0xffffff, hover: 0xffc7b3, stroke: category === 'background' ? 0xf09b8d : 0xc87988, textColor: '#5f3441' });
      this.shopJellyTab = addButton(this, choose(570, 375), choose(126, 130), choose(170, 190), 36, '果冻皮肤', () => this.setShopCategory('jelly'), { depth: 74, fontSize: '14px', color: category === 'jelly' ? 0xffb29b : 0xffffff, hover: 0xffc7b3, stroke: category === 'jelly' ? 0xf09b8d : 0xc87988, textColor: '#5f3441' });
      this.shopItems.push(this.shopBackgroundTab, this.shopJellyTab);
      this.shopStatusText.setText('');
      this.renderShopProducts();
      analytics('shop_category', { category });
    }

    renderShopProducts() {
      this.shopProductItems.forEach((item) => item.destroy());
      this.shopProductItems = [];
      const products = STORE_ALL_PRODUCTS.filter((product) => product.category === this.shopCategory);
      const xs = [270, 480, 690];
      products.forEach((product, index) => {
        const x = IS_PORTRAIT ? CENTER_X : xs[index];
        const equipped = CosmeticStore.isEquipped(product);
        const owned = CosmeticStore.isOwned(product.sku);
        const addProductItem = (item) => { this.shopProductItems.push(item); return item; };
        if (IS_PORTRAIT) {
          const y = 248 + index * 202;
          addProductItem(this.add.rectangle(x, y, 460, 180, equipped ? 0xffeadc : 0xffffff, 0.98).setStrokeStyle(equipped ? 3 : 2, equipped ? 0xf28b78 : 0xd7afaa, 0.95).setDepth(73));
          addProductItem(this.add.text(155, y - 62, product.name, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#5f4051' }).setOrigin(0.5).setDepth(74));
          addProductItem(this.add.text(155, y - 36, product.description, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '11px', color: '#94737f', align: 'center', wordWrap: { width: 190 } }).setOrigin(0.5).setDepth(74));
          const preview = addProductItem(this.add.graphics().setDepth(74));
          if (product.category === 'background') drawThemePreview(preview, 155, y + 30, 176, 82, product.sku);
          else {
            preview.fillStyle(0x3b2955, 1).fillRoundedRect(67, y - 11, 176, 82, 12);
            drawJelly(preview, 155, y + 29, 2, 1, 0.62, -0.08, 1, 1, product.sku);
            preview.lineStyle(2, 0xe1b7bc, 0.8).strokeRoundedRect(67, y - 11, 176, 82, 12);
          }
          addProductItem(this.add.text(378, y - 28, '免费使用', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#5aa17e' }).setOrigin(0.5).setDepth(74));
          const buttonLabel = equipped ? '使用中' : '立即使用';
          const action = addProductItem(addButton(this, 378, y + 27, 128, 40, buttonLabel, () => this.handleShopProduct(product), { depth: 75, fontSize: '13px', color: equipped ? 0xd9cfce : 0xff9a83, hover: equipped ? 0xd9cfce : 0xffb29b, stroke: equipped ? 0xb9aaa9 : 0xf0a28e, textColor: equipped ? '#847778' : '#fff8ef' }));
          if (equipped) action.list[0].disableInteractive();
          return;
        }
        addProductItem(this.add.rectangle(x, 304, 188, 292, equipped ? 0xffeadc : 0xffffff, 0.98).setStrokeStyle(equipped ? 3 : 2, equipped ? 0xf28b78 : 0xd7afaa, 0.95).setDepth(73));
        addProductItem(this.add.text(x, 178, product.name, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#5f4051' }).setOrigin(0.5).setDepth(74));
        addProductItem(this.add.text(x, 202, product.description, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '11px', color: '#94737f', align: 'center', wordWrap: { width: 166 } }).setOrigin(0.5).setDepth(74));
        const preview = addProductItem(this.add.graphics().setDepth(74));
        if (product.category === 'background') drawThemePreview(preview, x, 275, 154, 86, product.sku);
        else {
          preview.fillStyle(0x3b2955, 1).fillRoundedRect(x - 77, 232, 154, 86, 12);
          drawJelly(preview, x, 274, 2, 1, 0.66, -0.08, 1, 1, product.sku);
          preview.lineStyle(2, 0xe1b7bc, 0.8).strokeRoundedRect(x - 77, 232, 154, 86, 12);
        }
        addProductItem(this.add.text(x, 342, '免费使用', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#5aa17e' }).setOrigin(0.5).setDepth(74));
        const buttonLabel = equipped ? '使用中' : '立即使用';
        const action = addProductItem(addButton(this, x, 390, 118, 36, buttonLabel, () => this.handleShopProduct(product), { depth: 75, fontSize: '13px', color: equipped ? 0xd9cfce : 0xff9a83, hover: equipped ? 0xd9cfce : 0xffb29b, stroke: equipped ? 0xb9aaa9 : 0xf0a28e, textColor: equipped ? '#847778' : '#fff8ef' }));
        if (equipped) action.list[0].disableInteractive();
      });
    }

    async handleShopProduct(product) {
      if (this.shopBusy || CosmeticStore.isEquipped(product)) return;
      this.shopBusy = true;
      this.setShopStatus('正在更换装扮…');
      try {
        await CosmeticStore.equip(product);
        if (product.category === 'background') this.redrawBackground();
        this.setShopStatus(`已换成「${product.name}」`);
      } catch (_) {
        this.setShopStatus('换装失败，请再试一次');
      } finally {
        this.shopBusy = false;
        if (this.shopOpen) {
          this.renderShopProducts();
        }
      }
    }

    setShopStatus(message) {
      if (this.shopStatusText) this.shopStatusText.setText(message);
    }

    closeShop() {
      if (!this.shopOpen) return;
      this.shopProductItems.forEach((item) => item.destroy());
      this.shopItems.forEach((item) => item.destroy());
      this.shopProductItems = [];
      this.shopItems = [];
      this.shopOpen = false;
      this.shopStatusText = null;
    }

    addWalls() {
      const common = { isStatic: true, friction: 0.72, restitution: 0.38, label: 'jelly-wall' };
      this.matter.add.rectangle((BOARD.left + BOARD.right) / 2, BOARD.bottom + 9, BOARD.right - BOARD.left + 38, 18, common);
      this.matter.add.rectangle(BOARD.left - 9, (BOARD.top + BOARD.bottom) / 2, 18, BOARD.bottom - BOARD.top + 30, common);
      this.matter.add.rectangle(BOARD.right + 9, (BOARD.top + BOARD.bottom) / 2, 18, BOARD.bottom - BOARD.top + 30, common);
    }

    pickNextType() {
      const roll = Phaser.Math.Between(0, 99);
      if (roll < 43) return 0; if (roll < 75) return 1; if (roll < 93) return 2; return 3;
    }

    moveCursor(x) {
      if (this.state !== 'playing') return;
      const type = this.active ? this.active.type : this.nextType;
      const r = radius(type);
      this.cursorX = clamp(x, BOARD.left + r + 5, BOARD.right - r - 5);
      if (this.active) this.active.x = this.cursorX;
    }

    spawnActive() {
      if (this.state !== 'playing' || this.active) return;
      this.active = { type: this.nextType, x: this.cursorX, y: BOARD.top + radius(this.nextType) + 15 };
      this.nextType = this.pickNextType();
      this.statusText.setText(`当前：${NAMES[this.active.type]} · 找到同色果冻让它们碰在一起`);
    }

    dropActive() {
      if (this.state !== 'playing' || !this.active) return;
      const piece = this.createJelly(this.active.type, this.cursorX, BOARD.top + radius(this.active.type) + 12);
      piece.body.velocity.x = Phaser.Math.FloatBetween(-0.35, 0.35);
      this.matter.body.setAngularVelocity(piece.body, Phaser.Math.FloatBetween(-0.055, 0.055));
      this.jellies.push(piece); this.active = null; this.statusText.setText('果冻落下了，看看它会滑到哪里……');
      this.dropCount += 1;
      JellyAudio.drop(piece.type);
      this.time.delayedCall(420, () => { if (this.state === 'playing' && !this.active) this.spawnActive(); });
    }

    createJelly(type, x, y) {
      const r = radius(type);
      const body = this.matter.add.polygon(x, y, 8, r * 0.95, { restitution: 0.34, friction: 0.2, frictionStatic: 0.34, frictionAir: 0.012, density: 0.00165, label: 'jelly-piece' });
      const piece = { id: this.nextId++, type, body, pulse: 1.12, born: this.time.now, grace: 0.9, deform: 0, wobblePhase: 0 };
      body.plugin = body.plugin || {}; body.plugin.jellyPiece = piece;
      return piece;
    }

    handleCollisions(event) {
      for (const pair of event.pairs) {
        const a = pair.bodyA.plugin && pair.bodyA.plugin.jellyPiece;
        const b = pair.bodyB.plugin && pair.bodyB.plugin.jellyPiece;
        this.applyImpact(a, pair.bodyA, pair.bodyB);
        this.applyImpact(b, pair.bodyB, pair.bodyA);
        if (!a || !b || a.type !== b.type || a.type >= MAX_TYPE || this.mergeBusy.has(a.id) || this.mergeBusy.has(b.id)) continue;
        const key = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
        if (this.pendingMerges.has(key)) continue;
        this.pendingMerges.set(key, this.time.delayedCall(95, () => this.mergePair(a, b, key)));
      }
    }

    applyImpact(piece, ownBody, otherBody) {
      if (!piece || !ownBody || !otherBody) return;
      const relativeX = ownBody.velocity.x - otherBody.velocity.x;
      const relativeY = ownBody.velocity.y - otherBody.velocity.y;
      const impact = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
      if (impact < 0.55) return;
      piece.deform = Math.max(piece.deform || 0, clamp(impact * 0.055, 0.08, 0.38));
      piece.wobblePhase = 0;
      piece.pulse = Math.max(piece.pulse || 1, 1.025);
    }

    mergePair(a, b, key) {
      this.pendingMerges.delete(key);
      if (this.state !== 'playing' || !this.jellies.includes(a) || !this.jellies.includes(b) || this.mergeBusy.has(a.id) || this.mergeBusy.has(b.id)) return;
      this.mergeBusy.add(a.id); this.mergeBusy.add(b.id);
      const x = (a.body.position.x + b.body.position.x) / 2;
      const y = (a.body.position.y + b.body.position.y) / 2;
      const nextType = a.type + 1;
      this.matter.world.remove(a.body); this.matter.world.remove(b.body);
      this.jellies = this.jellies.filter((piece) => piece !== a && piece !== b);
      const merged = this.createJelly(nextType, x, y);
      merged.grace = 1.35;
      merged.body.velocity.x = (a.body.velocity.x + b.body.velocity.x) * 0.16;
      merged.body.velocity.y = -Math.min(5.8, 2.5 + nextType * 0.42);
      this.jellies.push(merged);
      this.score += 12 * (nextType + 1) * (nextType + 1);
      this.combo += 1;
      this.mergeCount += 1;
      this.maxType = Math.max(this.maxType, nextType);
      JellyAudio.merge(nextType);
      this.spawnMergeParticles(x, y, a.type); this.showGain(x, y, nextType, this.combo);
      this.cameras.main.shake(100, 0.0028 + nextType * 0.00035);
      analytics('jelly_merge', { level: nextType + 1, combo: this.combo, score: this.score });
      this.time.delayedCall(180, () => { this.mergeBusy.delete(a.id); this.mergeBusy.delete(b.id); });
    }

    spawnMergeParticles(x, y, type) {
      const color = paletteFor(type).light;
      for (let i = 0; i < 18; i += 1) {
        const angle = (Math.PI * 2 * i) / 18 + Phaser.Math.FloatBetween(-0.15, 0.15);
        const speed = Phaser.Math.Between(55, 145);
        this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 52, life: 0.72, maxLife: 0.72, color, size: Phaser.Math.Between(2, 5) });
      }
    }

    update(time, delta) {
      if (this.state !== 'playing') return;
      const dt = Math.min(delta, 34) / 1000; this.elapsed += dt;
      if (TIMED_MODE) {
        if (this.elapsed >= ROUND_LIMIT) {
          this.elapsed = ROUND_LIMIT;
          this.render();
          this.timeOver();
          return;
        }
        const remaining = ROUND_LIMIT - this.elapsed;
        const warningSecond = Math.ceil(remaining);
        if (remaining <= 20 && warningSecond !== this.lastWarningSecond) {
          this.lastWarningSecond = warningSecond;
          JellyAudio.warning();
        }
      }
      const modalOpen = this.audioSettingsOpen || this.shopOpen;
      if (!modalOpen && (Phaser.Input.Keyboard.JustDown(this.keys.left) || Phaser.Input.Keyboard.JustDown(this.keys.a))) this.moveCursor(this.cursorX - 16);
      if (!modalOpen && (Phaser.Input.Keyboard.JustDown(this.keys.right) || Phaser.Input.Keyboard.JustDown(this.keys.d))) this.moveCursor(this.cursorX + 16);
      if (!modalOpen && Phaser.Input.Keyboard.JustDown(this.keys.space)) this.dropActive();
      if (!modalOpen && Phaser.Input.Keyboard.JustDown(this.keys.r)) this.restart();
      if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) {
        if (this.shopOpen) this.closeShop();
        else if (this.audioSettingsOpen) this.closeAudioSettings();
        else this.scene.start('JellyTitleScene');
      }
      for (const piece of this.jellies) {
        piece.pulse = Phaser.Math.Linear(piece.pulse || 1, 1, 0.12);
        piece.grace = Math.max(0, (piece.grace || 0) - dt);
        piece.wobblePhase = (piece.wobblePhase || 0) + dt * 19;
        piece.deform = Math.max(0, (piece.deform || 0) * Math.pow(0.055, dt));
      }
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 230 * dt; }
      this.particles = this.particles.filter((p) => p.life > 0);
      this.render(); this.checkGameOver(dt);
    }

    checkGameOver(dt) {
      if (this.elapsed < 1.8 || this.state !== 'playing') return;
      let danger = false;
      for (const piece of this.jellies) {
        const top = piece.body.position.y - radius(piece.type) * 0.9;
        const stable = piece.body.speed < 0.28 && Math.abs(piece.body.angularSpeed) < 0.025;
        if (top <= DANGER_Y && stable && piece.grace <= 0) {
          const held = (this.dangerTimers.get(piece.id) || 0) + dt;
          this.dangerTimers.set(piece.id, held);
          if (held >= 1.35) danger = true;
        } else {
          this.dangerTimers.delete(piece.id);
        }
      }
      if (danger) this.gameOver();
    }

    showGain(x, y, type, combo) {
      const gain = 12 * (type + 1) * (type + 1);
      const text = this.add.text(x, y - radius(type), `+${gain}${combo > 1 ? `  ×${combo}` : ''}`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: combo > 1 ? '20px' : '16px', fontStyle: 'bold', color: '#fff5b8', stroke: '#4b2568', strokeThickness: 4 }).setOrigin(0.5).setDepth(25);
      this.tweens.add({ targets: text, y: text.y - 42, alpha: 0, duration: 780, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    }

    gameOver() { this.finishGame('height'); }

    timeOver() { this.finishGame('time'); }

    finishGame(reason) {
      if (this.state !== 'playing') return;
      this.closeAudioSettings();
      this.closeShop();
      this.state = 'over';
      window.JellyBestScore = Math.max(window.JellyBestScore, this.score);
      const result = {
        score: this.score,
        merges: this.mergeCount,
        drops: this.dropCount,
        maxType: this.maxType,
        reason,
        duration: TIMED_MODE ? Math.min(this.elapsed, ROUND_LIMIT) : this.elapsed,
      };
      JellyAudio.finish();
      window.JellyScoreHistory.push(result);
      window.JellyScoreHistory.sort((a, b) => b.score - a.score || b.maxType - a.maxType || b.merges - a.merges);
      window.JellyScoreHistory = window.JellyScoreHistory.slice(0, 10);
      const rank = window.JellyScoreHistory.indexOf(result) + 1;
      analytics('game_over', { reason, score: this.score, best: window.JellyBestScore, rank, merges: this.mergeCount });

      this.add.rectangle(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x5b5364, 0.42).setDepth(40);
      this.add.rectangle(CENTER_X, choose(270, 480), choose(520, 500), choose(430, 720), 0xfff5e8, 0.98).setStrokeStyle(3, 0x694d5b, 0.82).setDepth(41);
      this.add.text(CENTER_X, choose(86, 178), reason === 'time' ? '时间到！' : '果冻堆太高啦', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '32px', fontStyle: 'bold', color: '#4b354d' }).setOrigin(0.5).setDepth(42);
      this.add.text(CENTER_X, choose(122, 224), reason === 'time' ? '两分钟结束，看看你的合并成果' : '危险线以上停留太久', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#806770' }).setOrigin(0.5).setDepth(42);
      this.add.text(CENTER_X, choose(158, 270), `本局 ${this.score} 分  ·  合并 ${this.mergeCount} 次  ·  最高 ${NAMES[this.maxType]}`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#6b515c', align: 'center', wordWrap: { width: choose(500, 440) } }).setOrigin(0.5).setDepth(42);

      this.add.rectangle(CENTER_X, choose(268, 475), choose(410, 440), choose(178, 300), 0xfffbf3, 0.96).setStrokeStyle(2, 0xe0b2a9, 0.9).setDepth(42);
      this.add.text(CENTER_X, choose(205, 350), `本机本回合排行榜  ·  你的排名 #${rank}`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('16px', '15px'), fontStyle: 'bold', color: '#754351', align: 'center' }).setOrigin(0.5).setDepth(43);
      const rows = window.JellyScoreHistory.slice(0, 5);
      rows.forEach((entry, index) => {
        const isCurrent = entry === result;
        const y = choose(232 + index * 27, 395 + index * 45);
        if (isCurrent) this.add.rectangle(CENTER_X, y + 1, choose(365, 400), choose(23, 34), 0xffd9c8, 0.8).setDepth(42);
        this.add.text(choose(300, 70), y, `#${index + 1}`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', fontStyle: isCurrent ? 'bold' : 'normal', color: isCurrent ? '#c9585e' : '#8a6d74' }).setOrigin(0, 0.5).setDepth(43);
        this.add.text(choose(348, 125), y, isCurrent ? '本局' : '历史记录', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', fontStyle: isCurrent ? 'bold' : 'normal', color: isCurrent ? '#c9585e' : '#8a6d74' }).setOrigin(0, 0.5).setDepth(43);
        this.add.text(choose(655, 470), y, `${entry.score} 分`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', fontStyle: 'bold', color: isCurrent ? '#c9585e' : '#6b515c', align: 'right' }).setOrigin(1, 0.5).setDepth(43);
      });
      this.add.text(CENTER_X, choose(354, 635), '排行榜只记录当前页面内的本机成绩', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#a1848c', align: 'center' }).setOrigin(0.5).setDepth(43);
      addButton(this, choose(390, 165), choose(415, 755), choose(170, 190), choose(44, 50), '再来一局', () => this.restart(), { depth: 45, color: 0xff8f76, hover: 0xffa98e, stroke: 0xffc5a6, textColor: '#5f3441' });
      addButton(this, choose(570, 375), choose(415, 755), choose(170, 190), choose(44, 50), '返回标题', () => this.scene.start('JellyTitleScene'), { depth: 45, fontSize: '15px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
    }

    restart() { this.scene.restart(); }

    drawBoard() {
      this.boardGraphics.fillStyle(0x6991a7, 0.3).fillRoundedRect(BOARD.left - 17, BOARD.top - 15, BOARD.right - BOARD.left + 34, BOARD.bottom - BOARD.top + 32, 24);
      this.boardGraphics.fillStyle(0xfff5e8, 1).fillRoundedRect(BOARD.left - 8, BOARD.top - 7, BOARD.right - BOARD.left + 16, BOARD.bottom - BOARD.top + 16, 18);
      this.boardGraphics.lineStyle(4, 0x694d5b, 0.8).strokeRoundedRect(BOARD.left - 8, BOARD.top - 7, BOARD.right - BOARD.left + 16, BOARD.bottom - BOARD.top + 16, 18);
      this.boardGraphics.fillStyle(0xfffdf3, 0.98).fillRoundedRect(BOARD.left, BOARD.top, BOARD.right - BOARD.left, BOARD.bottom - BOARD.top, 12);
      for (let x = BOARD.left + 20; x < BOARD.right; x += 40) this.boardGraphics.lineStyle(1, 0x825f69, 0.08).lineBetween(x, BOARD.top + 4, x, BOARD.bottom - 4);
      for (let y = BOARD.top + 20; y < BOARD.bottom; y += 40) this.boardGraphics.lineStyle(1, 0x825f69, 0.08).lineBetween(BOARD.left + 4, y, BOARD.right - 4, y);
      this.boardGraphics.lineStyle(2, 0xf07c7c, 0.65).lineBetween(BOARD.left + 4, DANGER_Y, BOARD.right - 4, DANGER_Y);
      this.boardGraphics.fillStyle(0xff9f91, 0.16).fillRect(BOARD.left + 4, DANGER_Y - 4, BOARD.right - BOARD.left - 8, 8);
      this.boardGraphics.fillStyle(0xffffff, 0.7).fillRoundedRect(BOARD.left + 20, BOARD.top + 14, 126, 7, 4);
    }

    render() {
      this.jellyGraphics.clear(); this.fxGraphics.clear();
      for (const piece of this.jellies) {
        const body = piece.body; const vx = body.velocity.x; const vy = body.velocity.y;
        const fallStretch = clamp(Math.abs(vy) * 0.009, 0, 0.19);
        const spring = Math.sin(piece.wobblePhase || 0) * (piece.deform || 0);
        const squash = clamp(1 + fallStretch - (piece.deform || 0) * 0.82 + spring * 0.42, 0.68, 1.3);
        const stretchX = clamp(1 - fallStretch * 0.42 + (piece.deform || 0) * 0.7 - spring * 0.35, 0.8, 1.34);
        drawJelly(this.jellyGraphics, body.position.x, body.position.y, piece.type, 1, piece.pulse || 1, body.angle, squash, stretchX);
      }
      if (this.active) {
        const r = radius(this.active.type);
        const activePalette = paletteFor(this.active.type);
        this.fxGraphics.lineStyle(2, activePalette.light, 0.25).lineBetween(this.cursorX, BOARD.top + 16, this.cursorX, BOARD.bottom - 6);
        for (let y = BOARD.top + 44; y < BOARD.bottom - 8; y += 24) this.fxGraphics.fillStyle(activePalette.light, 0.24).fillCircle(this.cursorX, y, 2);
        drawJelly(this.jellyGraphics, this.cursorX, this.active.y, this.active.type, 0.94, 1, 0, 1);
        this.fxGraphics.lineStyle(2, activePalette.rim, 0.42).strokeCircle(this.cursorX, this.active.y, r + 5);
      }
      for (const p of this.particles) { const alpha = clamp(p.life / p.maxLife, 0, 1); this.fxGraphics.fillStyle(p.color, alpha).fillCircle(p.x, p.y, p.size * alpha); }
      const remaining = ROUND_LIMIT - this.elapsed;
      this.scoreText.setText(`得分 ${this.score}`); this.bestText.setText(`最高 ${Math.max(window.JellyBestScore, this.score)}`);
      if (TIMED_MODE) {
        this.timeText.setText(`剩余 ${formatTime(remaining)}`);
        this.timeText.setColor(remaining <= 20 ? '#e66f68' : '#806770');
        if (remaining <= 20 && Math.floor(remaining * 2) % 2 === 0) this.timeText.setAlpha(0.62); else this.timeText.setAlpha(1);
      } else {
        this.timeText.setText('经典模式');
        this.timeText.setColor('#806770');
        this.timeText.setAlpha(1);
      }
      const nextPalette = paletteFor(this.nextType);
      const nextX = choose(715, CENTER_X - 35);
      const nextY = choose(116, 126);
      const nextHeight = choose(70, 56);
      this.nextGraphics.clear(); this.nextGraphics.fillStyle(0x25143e, 0.9).fillRoundedRect(nextX, nextY, 70, nextHeight, 16); this.nextGraphics.lineStyle(2, nextPalette.rim, 0.55).strokeRoundedRect(nextX, nextY, 70, nextHeight, 16); drawJelly(this.nextGraphics, nextX + 35, nextY + nextHeight / 2, this.nextType, 0.95, choose(0.43, 0.38), 0, 1);
    }
  }

  const TETRIS_COLS = 10;
  const TETRIS_ROWS = 20;
  const TETRIS_CELL = IS_PORTRAIT ? 28 : 22;
  const TETRIS_BOARD = IS_PORTRAIT
    ? { left: 130, top: 158, width: TETRIS_COLS * TETRIS_CELL, height: TETRIS_ROWS * TETRIS_CELL }
    : { left: 360, top: 50, width: TETRIS_COLS * TETRIS_CELL, height: TETRIS_ROWS * TETRIS_CELL };
  const TETRIS_COLORS = [0x52d9ee, 0xffd35c, 0xb68cff, 0x6be58c, 0xff7da7, 0x66a5ff, 0xffa263];
  const TETRIS_SPEEDS = {
    slow: { label: '慢速', gravity: 0.48 },
    normal: { label: '标准', gravity: 0.68 },
    fast: { label: '快速', gravity: 0.98 },
  };
  window.JellyTetrisSpeed = window.JellyTetrisSpeed || 'normal';
  const TETRIS_SHAPES = [
    { name: 'I', color: TETRIS_COLORS[0], matrix: [[1, 1, 1, 1]] },
    { name: 'O', color: TETRIS_COLORS[1], matrix: [[1, 1], [1, 1]] },
    { name: 'T', color: TETRIS_COLORS[2], matrix: [[0, 1, 0], [1, 1, 1]] },
    { name: 'S', color: TETRIS_COLORS[3], matrix: [[0, 1, 1], [1, 1, 0]] },
    { name: 'Z', color: TETRIS_COLORS[4], matrix: [[1, 1, 0], [0, 1, 1]] },
    { name: 'J', color: TETRIS_COLORS[5], matrix: [[1, 0, 0], [1, 1, 1]] },
    { name: 'L', color: TETRIS_COLORS[6], matrix: [[0, 0, 1], [1, 1, 1]] },
  ];

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function rotateMatrix(matrix) {
    const height = matrix.length;
    const width = matrix[0].length;
    const rotated = Array.from({ length: width }, () => Array(height).fill(0));
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) rotated[x][height - 1 - y] = matrix[y][x];
    return rotated;
  }

  function drawJellyBlock(graphics, x, y, size, color, alpha) {
    drawCandyJellyCells(graphics, [{ x: x + size / 2, y: y + size / 2, row: 0, col: 0 }], size, color, alpha, 1);
  }

  function drawCandyJellyCells(graphics, cells, size, color, alpha, seed) {
    const opacity = alpha === undefined ? 1 : alpha;
    const source = Phaser.Display.Color.IntegerToColor(color);
    const darkColor = Phaser.Display.Color.GetColor(Math.max(0, source.red - 48), Math.max(0, source.green - 48), Math.max(0, source.blue - 48));
    const lightColor = Phaser.Display.Color.GetColor(Math.min(255, source.red + 58), Math.min(255, source.green + 58), Math.min(255, source.blue + 58));
    const cellKeys = new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
    const rect = (cell, expansion, offsetX, offsetY, radiusScale) => {
      const box = size + expansion;
      graphics.fillRoundedRect(cell.x - box / 2 + (offsetX || 0), cell.y - box / 2 + (offsetY || 0), box, box, Math.max(4, size * radiusScale));
    };

    // 先画整块阴影、外沿与底色。各格略微重叠，所以内部没有独立正方形边框。
    graphics.fillStyle(0x080415, 0.25 * opacity);
    cells.forEach((cell) => rect(cell, size * 0.12, size * 0.07, size * 0.11, 0.23));
    graphics.fillStyle(lightColor, 0.36 * opacity);
    cells.forEach((cell) => rect(cell, size * 0.11, 0, 0, 0.22));
    graphics.fillStyle(darkColor, 0.98 * opacity);
    cells.forEach((cell) => rect(cell, size * 0.065, 0, size * 0.025, 0.2));
    graphics.fillStyle(color, 0.96 * opacity);
    cells.forEach((cell) => rect(cell, size * 0.02, 0, -size * 0.018, 0.18));

    cells.forEach((cell) => {
      // 恢复最初的柔和透光与湿润高光，只在外露表面出现。
      graphics.fillStyle(lightColor, 0.12 * opacity).fillEllipse(cell.x, cell.y + size * 0.13, size * 0.76, size * 0.54);
      if (!cellKeys.has(`${cell.row - 1}:${cell.col}`)) {
        graphics.fillStyle(lightColor, 0.28 * opacity).fillEllipse(cell.x - size * 0.04, cell.y - size * 0.3, size * 0.68, size * 0.19);
        graphics.fillStyle(0xffffff, 0.7 * opacity).fillEllipse(cell.x - size * 0.2, cell.y - size * 0.34, size * 0.34, size * 0.11);
        graphics.fillStyle(0xffffff, 0.38 * opacity).fillCircle(cell.x - size * 0.33, cell.y - size * 0.08, Math.max(1.1, size * 0.05));
      }
    });
  }

  function drawTetrisPiece(graphics, matrix, x, y, size, color, alpha) {
    const cells = [];
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (matrix[row][col]) cells.push({ x: x + (col + 0.5) * size, y: y + (row + 0.5) * size, row, col });
      }
    }
    drawCandyJellyCells(graphics, cells, size, color, alpha, matrix.length * 13 + matrix[0].length * 7);
  }

  function drawTetrisPieceWobble(graphics, matrix, x, y, size, color, alpha, time, intensity) {
    const wobble = intensity || 1;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) continue;
        const phase = time * 0.014 + row * 0.92 + col * 0.57;
        const offsetX = Math.sin(phase) * 1.8 * wobble + Math.sin(phase * 0.53) * 0.8 * wobble;
        const offsetY = Math.cos(phase * 0.9) * 1.35 * wobble;
        drawJellyBlock(graphics, x + col * size + offsetX, y + row * size + offsetY, size, color, alpha);
      }
    }
  }

  function drawTetrisMini(graphics, x, y, size, color, shape) {
    const matrix = shape.matrix;
    const width = matrix[0].length * size;
    const height = matrix.length * size;
    drawTetrisPiece(graphics, matrix, x - width / 2, y - height / 2, size, color, 1);
  }

  function addTetrisSpeedSelector(scene, x, y, onChange, compact) {
    const keys = ['slow', 'normal', 'fast'];
    const gap = compact ? 62 : 76;
    const width = compact ? 56 : 68;
    const items = [];
    items.push(scene.add.text(x, y - 25, '下落速度', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: compact ? '11px' : '12px', fontStyle: 'bold', color: '#806770', align: 'center' }).setOrigin(0.5).setDepth(24));
    const refresh = () => {
      keys.forEach((key, index) => {
        const selected = window.JellyTetrisSpeed === key;
        const button = items[index + 1];
        if (!button) return;
        button.buttonText.setText(`${selected ? '✓ ' : ''}${TETRIS_SPEEDS[key].label}`);
        button.buttonText.setColor(selected ? '#5f3441' : '#806770');
        button.list[0].setStrokeStyle(selected ? 3 : 2, selected ? 0xf08a78 : 0xc87988, 1);
      });
    };
    keys.forEach((key, index) => {
      const button = addButton(scene, x + (index - 1) * gap, y, width, compact ? 26 : 30, '', () => {
        window.JellyTetrisSpeed = key;
        refresh();
        if (onChange) onChange(key);
      }, { depth: 25, fontSize: compact ? '10px' : '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#806770' });
      items.push(button);
    });
    refresh();
    return items;
  }

  class GameHubScene extends Phaser.Scene {
    constructor() { super('GameHubScene'); }

    create() {
      const route = window.location.hash;
      if (route === '#jelly-merge') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        this.scene.start('JellyTitleScene');
        return;
      }
      if (route === '#jelly-tetris') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        this.scene.start('JellyTetrisTitleScene');
        return;
      }
      if (route === '#jelly-tetris-play') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        this.scene.start('JellyTetrisScene');
        return;
      }
      const bg = this.add.graphics(); drawBackdrop(bg);
      const art = this.add.graphics();
      drawJelly(art, CENTER_X, choose(175, 235), 7, 0.9, choose(0.72, 0.62), -0.08, 1);
      drawJelly(art, CENTER_X - choose(104, 86), choose(210, 310), 2, 0.9, 0.38, 0.16, 1);
      drawJelly(art, CENTER_X + choose(112, 88), choose(220, 322), 4, 0.9, 0.42, -0.18, 1);
      this.tweens.add({ targets: art, y: -6, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.text(CENTER_X, choose(56, 82), '果冻游乐园', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('48px', '42px'), fontStyle: 'bold', color: '#4b354d', stroke: '#fff7ea', strokeThickness: 7 }).setOrigin(0.5);
      this.add.text(CENTER_X, choose(111, 138), '选择一个游戏，开始你的软弹挑战', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('19px', '17px'), color: '#765f68', align: 'center' }).setOrigin(0.5);

      const card = (x, y, width, height, title, description, color, preview, onClick) => {
        const panel = this.add.rectangle(x, y, width, height, 0xfff8ed, 0.92).setStrokeStyle(3, color, 0.72);
        panel.setInteractive({ useHandCursor: true });
        panel.on('pointerover', () => panel.setFillStyle(0xffffff, 0.98));
        panel.on('pointerout', () => panel.setFillStyle(0xfff8ed, 0.92));
        const previewX = x - width * choose(0.29, 0.22);
        const copyX = x + width * choose(0.25, 0.2);
        const previewGraphics = this.add.graphics(); preview(previewGraphics, previewX, y);
        this.add.text(copyX, y - 36, title, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('21px', '19px'), fontStyle: 'bold', color: '#5f4051', align: 'center', wordWrap: { width: width * choose(0.45, 0.52) } }).setOrigin(0.5);
        this.add.text(copyX, y + 10, description, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#94737f', align: 'center', wordWrap: { width: width * choose(0.46, 0.53) } }).setOrigin(0.5);
        addButton(this, copyX, y + 52, 118, 34, '进入游戏', onClick, { depth: 25, fontSize: '13px', color: 0xff9a83, hover: 0xffb29b, stroke: 0xf0a28e, textColor: '#fff8ef' });
      };
      const cardWidth = choose(350, 430);
      const cardHeight = choose(148, 182);
      card(choose(290, CENTER_X), choose(320, 465), cardWidth, cardHeight, '果冻叠叠乐', '让果冻滑着相遇，越合越大', 0xf2a28d, (graphics, x, y) => {
        drawJelly(graphics, x, y, 5, 1, 0.52, -0.08, 1);
        drawJelly(graphics, x - 34, y + 27, 1, 0.94, 0.28, 0.08, 1);
        drawJelly(graphics, x + 35, y + 29, 2, 0.94, 0.31, -0.08, 1);
      }, () => this.scene.start('JellyTitleScene'));
      card(choose(670, CENTER_X), choose(320, 690), cardWidth, cardHeight, 'Q 弹果冻方块', '自由旋转、弹跳滑动，尽量堆得更高', 0x8f79df, (graphics, x, y) => {
        drawTetrisPiece(graphics, [[1, 1, 1], [0, 1, 0]], x - choose(40, 48), y - choose(30, 35), choose(25, 30), TETRIS_COLORS[2], 1);
        drawTetrisPiece(graphics, [[1, 1], [1, 1]], x + choose(34, 42), y - choose(24, 28), choose(24, 28), TETRIS_COLORS[1], 1);
      }, () => this.scene.start('JellyTetrisTitleScene'));
      this.add.text(CENTER_X, choose(490, 910), '统一的果冻美术 · 支持电脑与手机触屏', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#8b7079', align: 'center' }).setOrigin(0.5);
    }
  }

  class JellyTetrisTitleScene extends Phaser.Scene {
    constructor() { super('JellyTetrisTitleScene'); }

    create() {
      const bg = this.add.graphics(); drawBackdrop(bg);
      const art = this.add.graphics();
      drawTetrisPiece(art, [[1, 1, 1], [0, 1, 0]], CENTER_X - choose(115, 62), choose(228, 405), 34, TETRIS_COLORS[2], 1);
      drawTetrisPiece(art, [[1, 1], [1, 1]], CENTER_X + choose(50, 38), choose(250, 445), 34, TETRIS_COLORS[1], 1);
      drawTetrisPiece(art, [[1, 1, 0], [0, 1, 1]], CENTER_X + choose(112, 94), choose(214, 348), 31, TETRIS_COLORS[4], 1);
      this.tweens.add({ targets: art, y: -8, duration: 1150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.text(CENTER_X, choose(80, 112), 'Q 弹果冻方块', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('46px', '40px'), fontStyle: 'bold', color: '#4b354d', stroke: '#fff7ea', strokeThickness: 7 }).setOrigin(0.5);
      this.add.text(CENTER_X, choose(136, 172), '不消行、不对齐，让软弹果冻自由堆叠', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('19px', '17px'), color: '#765f68', align: 'center', wordWrap: { width: choose(850, 470) } }).setOrigin(0.5);
      this.add.text(CENTER_X, choose(358, 595), IS_PORTRAIT ? '触屏：移动、旋转、加速，让形状稳稳落下' : '键盘：← → 推动 · ↑ 旋转 · ↓ 加速 · 空格速降', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '15px', color: '#765f68', align: 'center', wordWrap: { width: choose(850, 470) } }).setOrigin(0.5);
      addTetrisSpeedSelector(this, CENTER_X, choose(400, 660), null, false);
      addButton(this, CENTER_X, choose(450, 740), choose(220, 260), choose(54, 62), '开始游戏', () => { JellyAudio.start(); analytics('tetris_start', { mode: 'jelly_tetris', speed: window.JellyTetrisSpeed }); this.scene.start('JellyTetrisScene'); }, { color: 0xff8f76, hover: 0xffa98e, stroke: 0xfff3d6, textColor: '#5f3441' });
      addButton(this, choose(74, 72), choose(34, 48), choose(92, 98), choose(32, 36), '返回入口', () => this.scene.start('GameHubScene'), { depth: 25, fontSize: '12px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
      this.add.text(CENTER_X, choose(497, 866), '每成功堆下一块得 1 分 · 越过危险线即结束', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#8b7079', align: 'center', wordWrap: { width: choose(850, 470) } }).setOrigin(0.5);
    }
  }

  class LegacyJellyTetrisScene extends Phaser.Scene {
    constructor() { super('JellyTetrisScene'); }

    create() {
      this.state = 'playing';
      this.grid = Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(null));
      this.queue = [];
      this.score = 0; this.lines = 0; this.level = 1; this.combo = 0; this.dropAt = 0;
      this.landingMotion = null;
      this.boardGraphics = this.add.graphics().setDepth(1);
      this.pieceGraphics = this.add.graphics().setDepth(5);
      this.fxGraphics = this.add.graphics().setDepth(6);
      drawBackdrop(this.add.graphics().setDepth(0));
      this.drawBoard();
      this.add.text(choose(24, 20), choose(20, 24), 'Q 弹果冻方块', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('26px', '23px'), fontStyle: 'bold', color: '#4b354d' }).setDepth(20);
      this.add.text(choose(24, 20), choose(52, 57), '软糯方块落下，排满一行就消除', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#806770' }).setDepth(20);
      this.scoreText = this.add.text(choose(930, 518), choose(20, 24), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#4b354d', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.linesText = this.add.text(choose(930, 518), choose(50, 54), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#806770', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.levelText = this.add.text(choose(930, 74), choose(76, 84), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#806770', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.nextLabel = this.add.text(choose(735, CENTER_X), choose(108, 106), '下一个', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#806770', align: 'center' }).setOrigin(0.5).setDepth(20);
      this.nextGraphics = this.add.graphics().setDepth(20);
      this.statusText = this.add.text(CENTER_X, choose(508, 748), '填满一行，果冻会闪闪发光地消失', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#6b515c', align: 'center', wordWrap: { width: choose(520, 480) } }).setOrigin(0.5).setDepth(20);
      this.helpText = this.add.text(CENTER_X, choose(528, 774), IS_PORTRAIT ? '点按按钮移动 · 旋转 · 加速 · 硬降' : '← → 移动 · ↑ 旋转 · ↓ 加速 · 空格硬降 · R 重开', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#a1848c', align: 'center' }).setOrigin(0.5).setDepth(20);
      this.add.text(choose(735, CENTER_X), choose(195, 145), '预览', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#a1848c', align: 'center' }).setOrigin(0.5).setDepth(20);
      this.addButtonControls();
      this.keys = this.input.keyboard.addKeys({ left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT, up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN, space: Phaser.Input.Keyboard.KeyCodes.SPACE, r: Phaser.Input.Keyboard.KeyCodes.R, p: Phaser.Input.Keyboard.KeyCodes.P, esc: Phaser.Input.Keyboard.KeyCodes.ESC });
      this.touchGesture = null;
      this.input.on('pointerdown', (pointer) => {
        JellyAudio.start();
        if (this.state !== 'playing' || pointer.x < TETRIS_BOARD.left || pointer.x > TETRIS_BOARD.left + TETRIS_BOARD.width || pointer.y < TETRIS_BOARD.top || pointer.y > TETRIS_BOARD.top + TETRIS_BOARD.height) return;
        this.touchGesture = { id: pointer.id, x: pointer.x, y: pointer.y };
      });
      this.input.on('pointerup', (pointer) => {
        if (!this.touchGesture || this.touchGesture.id !== pointer.id || this.state !== 'playing') return;
        const gesture = this.touchGesture; this.touchGesture = null;
        const dx = pointer.x - gesture.x; const dy = pointer.y - gesture.y;
        if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 1 : -1);
        else if (dy > 30) this.hardDrop();
        else if (dy < -30) this.rotate();
        else this.rotate();
      });
      this.fillQueue(); this.spawnPiece();
    }

    addButtonControls() {
      const y = IS_PORTRAIT ? 850 : 490;
      const controls = IS_PORTRAIT
        ? [[104, y, '左移', () => this.move(-1)], [186, y, '旋转', () => this.rotate()], [268, y, '右移', () => this.move(1)], [350, y, '加速', () => this.softDrop()], [432, y, '硬降', () => this.hardDrop()]]
        : [[730, 470, '左移', () => this.move(-1)], [810, 470, '旋转', () => this.rotate()], [890, 470, '右移', () => this.move(1)], [810, 425, '硬降', () => this.hardDrop()]];
      controls.forEach(([x, buttonY, label, callback]) => addButton(this, x, buttonY, IS_PORTRAIT ? 68 : 72, 34, label, callback, { depth: 25, fontSize: '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' }));
      addButton(this, choose(890, 460), IS_PORTRAIT ? 902 : 515, IS_PORTRAIT ? 68 : 72, 34, '重开', () => this.restart(), { depth: 25, fontSize: '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
      addButton(this, choose(730, 40), IS_PORTRAIT ? 902 : 515, IS_PORTRAIT ? 68 : 72, 34, '返回', () => this.scene.start('JellyTetrisTitleScene'), { depth: 25, fontSize: '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
    }

    fillQueue() {
      while (this.queue.length < 5) this.queue.push(Phaser.Math.Between(0, TETRIS_SHAPES.length - 1));
    }

    spawnPiece() {
      this.fillQueue();
      const index = this.queue.shift(); this.fillQueue();
      const shape = TETRIS_SHAPES[index];
      this.active = { index, matrix: cloneMatrix(shape.matrix), color: shape.color, x: Math.floor((TETRIS_COLS - shape.matrix[0].length) / 2), y: 0 };
      this.dropAt = this.time.now + this.dropInterval();
      if (!this.canPlace(this.active.matrix, this.active.x, this.active.y)) this.gameOver();
    }

    dropInterval() { return Math.max(130, 690 - (this.level - 1) * 55); }

    canPlace(matrix, x, y) {
      for (let row = 0; row < matrix.length; row += 1) for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) continue;
        const gx = x + col; const gy = y + row;
        if (gx < 0 || gx >= TETRIS_COLS || gy >= TETRIS_ROWS) return false;
        if (gy >= 0 && this.grid[gy][gx]) return false;
      }
      return true;
    }

    move(dx) {
      if (this.state !== 'playing' || !this.active) return false;
      if (this.canPlace(this.active.matrix, this.active.x + dx, this.active.y)) {
        this.active.x += dx;
        this.active.slide = clamp((this.active.slide || 0) + dx * 5.5, -10, 10);
        this.active.wobble = 1;
        JellyAudio.drop(0);
        return true;
      }
      return false;
    }

    rotate() {
      if (this.state !== 'playing' || !this.active) return;
      const rotated = rotateMatrix(this.active.matrix);
      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) if (this.canPlace(rotated, this.active.x + kick, this.active.y)) {
        this.active.matrix = rotated; this.active.x += kick; this.active.wobble = 1.35; this.active.slide = (this.active.slide || 0) + kick * 2.5; JellyAudio.merge(1); return;
      }
    }

    softDrop(manual) {
      if (this.state !== 'playing' || !this.active) return;
      const playerTriggered = manual !== false;
      if (this.canPlace(this.active.matrix, this.active.x, this.active.y + 1)) {
        this.active.y += 1;
        if (playerTriggered) this.score += 1;
        this.dropAt = this.time.now + (playerTriggered ? 120 : this.dropInterval());
      }
      else this.lockPiece();
    }

    hardDrop() {
      if (this.state !== 'playing' || !this.active) return;
      let distance = 0;
      while (this.canPlace(this.active.matrix, this.active.x, this.active.y + 1)) { this.active.y += 1; distance += 1; }
      this.score += distance * 2; this.lockPiece();
    }

    lockPiece() {
      if (!this.active) return;
      let overflow = false;
      const lockedCells = [];
      for (let row = 0; row < this.active.matrix.length; row += 1) for (let col = 0; col < this.active.matrix[row].length; col += 1) {
        if (!this.active.matrix[row][col]) continue;
        const gx = this.active.x + col; const gy = this.active.y + row;
        if (gy < 0) overflow = true; else {
          this.grid[gy][gx] = this.active.color;
          lockedCells.push({ row: gy, col: gx, color: this.active.color });
        }
      }
      if (overflow) { this.gameOver(); return; }
      const cleared = this.clearLines();
      if (cleared) {
        this.lines += cleared; this.combo += 1; this.score += [0, 100, 300, 500, 800][cleared] * this.level + Math.max(0, this.combo - 1) * 80;
        this.level = Math.floor(this.lines / 10) + 1;
        this.statusText.setText(`${cleared === 4 ? '四行全消！' : `消除 ${cleared} 行`} · 连击 ${this.combo}`);
        JellyAudio.merge(Math.min(8, cleared + 2));
      } else this.combo = 0;
      this.active = null;
      if (cleared === 0) {
        this.statusText.setText('落地！果冻弹了一下，又滑着稳住了');
        this.startLandingMotion(lockedCells);
      } else {
        this.spawnPiece();
      }
    }

    startLandingMotion(cells) {
      if (!cells.length) { this.spawnPiece(); return; }
      const boardX = TETRIS_BOARD.left; const boardY = TETRIS_BOARD.top;
      const centers = cells.map((cell) => ({ x: boardX + (cell.col + 0.5) * TETRIS_CELL, y: boardY + (cell.row + 0.5) * TETRIS_CELL }));
      const center = centers.reduce((acc, point) => ({ x: acc.x + point.x / centers.length, y: acc.y + point.y / centers.length }), { x: 0, y: 0 });
      const container = this.add.container(center.x, center.y).setDepth(7);
      cells.forEach((cell, index) => {
        const block = this.add.graphics();
        drawJellyBlock(block, centers[index].x - center.x - TETRIS_CELL / 2, centers[index].y - center.y - TETRIS_CELL / 2, TETRIS_CELL, cell.color, 1);
        container.add(block);
      });
      const keySet = new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
      this.landingMotion = {
        container,
        keySet,
        baseX: center.x,
        baseY: center.y,
        offsetX: 0,
        offsetY: -5,
        velocityX: Phaser.Math.FloatBetween(-30, 30),
        velocityY: -145,
        angle: Phaser.Math.FloatBetween(-0.12, 0.12),
        angularVelocity: Phaser.Math.FloatBetween(-1.3, 1.3),
        settleTime: 0,
        age: 0,
      };
      container.setScale(1.06, 0.9);
      JellyAudio.drop(1);
    }

    updateLandingMotion(delta) {
      const motion = this.landingMotion;
      if (!motion) return;
      const dt = Math.min(delta, 34) / 1000;
      motion.age += dt;
      motion.velocityY += 880 * dt;
      motion.offsetX += motion.velocityX * dt;
      motion.offsetY += motion.velocityY * dt;
      motion.angle += motion.angularVelocity * dt;
      if (motion.offsetY >= 0) {
        motion.offsetY = 0;
        if (Math.abs(motion.velocityY) > 34) {
          motion.velocityY *= -0.3;
          motion.velocityX *= 0.68;
          motion.angularVelocity *= 0.42;
          JellyAudio.merge(1);
        } else {
          motion.velocityY = 0;
          motion.velocityX *= Math.pow(0.06, dt);
          motion.angularVelocity *= Math.pow(0.03, dt);
          motion.settleTime += dt;
        }
      }
      const stretch = clamp(Math.abs(motion.velocityY) / 430, 0, 0.22);
      const wobble = Math.sin(motion.age * 24) * clamp(0.05 - motion.age * 0.035, 0, 0.05);
      motion.container.x = motion.baseX + motion.offsetX;
      motion.container.y = motion.baseY + motion.offsetY;
      motion.container.rotation = motion.angle;
      motion.container.scaleX = 1 + stretch * 0.34 + wobble;
      motion.container.scaleY = 1 - stretch * 0.52 - wobble * 0.7;
      if ((motion.settleTime > 0.12 && Math.abs(motion.velocityX) < 8 && Math.abs(motion.angularVelocity) < 0.08) || motion.age > 1.05) {
        motion.container.destroy();
        this.landingMotion = null;
        this.spawnPiece();
      }
    }

    clearLines() {
      let cleared = 0;
      for (let row = TETRIS_ROWS - 1; row >= 0; row -= 1) {
        if (this.grid[row].every(Boolean)) { this.grid.splice(row, 1); this.grid.unshift(Array(TETRIS_COLS).fill(null)); cleared += 1; row += 1; }
      }
      return cleared;
    }

    drawBoard() {
      const x = TETRIS_BOARD.left; const y = TETRIS_BOARD.top; const w = TETRIS_BOARD.width; const h = TETRIS_BOARD.height;
      this.boardGraphics.clear();
      this.boardGraphics.fillStyle(0x697a9e, 0.32).fillRoundedRect(x - 16, y - 15, w + 32, h + 30, 24);
      this.boardGraphics.fillStyle(0xfff5e8, 1).fillRoundedRect(x - 8, y - 7, w + 16, h + 14, 18);
      this.boardGraphics.lineStyle(4, 0x694d5b, 0.82).strokeRoundedRect(x - 8, y - 7, w + 16, h + 14, 18);
      this.boardGraphics.fillStyle(0x241b43, 0.94).fillRoundedRect(x, y, w, h, 12);
      for (let col = 0; col <= TETRIS_COLS; col += 1) this.boardGraphics.lineStyle(1, 0xffffff, 0.08).lineBetween(x + col * TETRIS_CELL, y, x + col * TETRIS_CELL, y + h);
      for (let row = 0; row <= TETRIS_ROWS; row += 1) this.boardGraphics.lineStyle(1, 0xffffff, 0.08).lineBetween(x, y + row * TETRIS_CELL, x + w, y + row * TETRIS_CELL);
    }

    render() {
      this.pieceGraphics.clear(); this.fxGraphics.clear();
      const x = TETRIS_BOARD.left; const y = TETRIS_BOARD.top;
      const landingKeys = this.landingMotion ? this.landingMotion.keySet : null;
      for (let row = 0; row < TETRIS_ROWS; row += 1) for (let col = 0; col < TETRIS_COLS; col += 1) {
        if (this.grid[row][col] && (!landingKeys || !landingKeys.has(`${row}:${col}`))) drawJellyBlock(this.pieceGraphics, x + col * TETRIS_CELL, y + row * TETRIS_CELL, TETRIS_CELL, this.grid[row][col], 1);
      }
      if (this.active) {
        let ghostY = this.active.y;
        while (this.canPlace(this.active.matrix, this.active.x, ghostY + 1)) ghostY += 1;
        drawTetrisPiece(this.fxGraphics, this.active.matrix, x + this.active.x * TETRIS_CELL, y + ghostY * TETRIS_CELL, TETRIS_CELL, this.active.color, 0.2);
        drawTetrisPieceWobble(this.pieceGraphics, this.active.matrix, x + this.active.x * TETRIS_CELL + (this.active.slide || 0), y + this.active.y * TETRIS_CELL, TETRIS_CELL, this.active.color, 1, this.time.now, this.active.wobble || 0.72);
        this.active.slide = (this.active.slide || 0) * 0.82;
        this.active.wobble = Math.max(0.72, (this.active.wobble || 0.72) * 0.94);
      }
      const nextShape = TETRIS_SHAPES[this.queue[0] || 0];
      const previewX = choose(700, CENTER_X); const previewY = choose(148, 150);
      this.nextGraphics.clear(); this.nextGraphics.fillStyle(0x25143e, 0.9).fillRoundedRect(previewX - 62, previewY - 42, 124, 84, 16).lineStyle(2, nextShape.color, 0.52).strokeRoundedRect(previewX - 62, previewY - 42, 124, 84, 16);
      drawTetrisMini(this.nextGraphics, previewX, previewY, IS_PORTRAIT ? 24 : 21, nextShape.color, nextShape);
      this.scoreText.setText(`得分 ${this.score}`); this.linesText.setText(`消行 ${this.lines}`); this.levelText.setText(`等级 ${this.level}`);
    }

    update(time, delta) {
      if (this.state !== 'playing') { this.render(); return; }
      if (this.landingMotion) {
        this.updateLandingMotion(delta || 16);
        this.render();
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.left)) this.move(-1);
      if (Phaser.Input.Keyboard.JustDown(this.keys.right)) this.move(1);
      if (Phaser.Input.Keyboard.JustDown(this.keys.up)) this.rotate();
      if (Phaser.Input.Keyboard.JustDown(this.keys.down)) this.softDrop();
      if (Phaser.Input.Keyboard.JustDown(this.keys.space)) this.hardDrop();
      if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this.restart();
      if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) this.scene.start('JellyTetrisTitleScene');
      if (this.active && time >= this.dropAt) this.softDrop(false);
      this.render();
    }

    gameOver() {
      if (this.state === 'over') return;
      this.state = 'over';
      this.add.rectangle(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x5b5364, 0.44).setDepth(40);
      this.add.rectangle(CENTER_X, choose(270, 480), choose(500, 460), choose(330, 430), 0xfff5e8, 0.98).setStrokeStyle(3, 0x694d5b, 0.82).setDepth(41);
      this.add.text(CENTER_X, choose(170, 330), '果冻堆满啦', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '32px', fontStyle: 'bold', color: '#4b354d' }).setOrigin(0.5).setDepth(42);
      this.add.text(CENTER_X, choose(212, 374), `得分 ${this.score} · 消行 ${this.lines} · 等级 ${this.level}`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '16px', color: '#6b515c', align: 'center' }).setOrigin(0.5).setDepth(42);
      addButton(this, choose(390, 165), choose(330, 650), choose(170, 180), choose(44, 50), '再来一局', () => this.restart(), { depth: 45, color: 0xff8f76, hover: 0xffa98e, stroke: 0xffc5a6, textColor: '#5f3441' });
      addButton(this, choose(570, 375), choose(330, 650), choose(170, 180), choose(44, 50), '返回标题', () => this.scene.start('JellyTetrisTitleScene'), { depth: 45, fontSize: '15px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
    }

    restart() { this.scene.restart(); }
  }

  class JellyPhysicsTetrisScene extends Phaser.Scene {
    constructor() { super('JellyTetrisScene'); }

    create() {
      this.state = 'playing';
      this.score = 0;
      this.nextId = 1;
      this.pieces = [];
      this.current = null;
      this.queue = [];
      this.spawnPending = false;
      this.playfield = IS_PORTRAIT
        ? { left: 34, right: 506, top: 142, bottom: 760, danger: 360 }
        : { left: 280, right: 680, top: 42, bottom: 486, danger: 190 };
      this.physicsCell = IS_PORTRAIT ? 42 : 34;
      this.setPhysicsSpeed(window.JellyTetrisSpeed);

      drawBackdrop(this.add.graphics().setDepth(0));
      this.boardGraphics = this.add.graphics().setDepth(1);
      this.pieceGraphics = this.add.graphics().setDepth(6);
      this.fxGraphics = this.add.graphics().setDepth(7);
      this.drawPhysicsBoard();
      this.addPhysicsWalls();

      this.add.text(choose(24, 20), choose(20, 24), 'Q 弹果冻方块', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('26px', '23px'), fontStyle: 'bold', color: '#4b354d' }).setDepth(20);
      this.add.text(choose(24, 20), choose(52, 57), '不消行 · 自由旋转与物理堆叠', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#806770' }).setDepth(20);
      this.scoreText = this.add.text(WIDTH - choose(24, 20), choose(20, 24), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#4b354d', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.bestText = this.add.text(WIDTH - choose(24, 20), choose(51, 54), '', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', color: '#806770', align: 'right' }).setOrigin(1, 0).setDepth(20);
      this.statusText = this.add.text(CENTER_X, choose(510, 792), '移动和旋转果冻，让它稳稳落在堆叠上', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '14px', color: '#6b515c', align: 'center', wordWrap: { width: choose(520, 480) } }).setOrigin(0.5).setDepth(20);
      this.helpText = this.add.text(CENTER_X, choose(530, 818), IS_PORTRAIT ? '滑动或使用按钮推动 · 点击旋转 · 向下滑动速降' : '← → 推动 · ↑ 旋转 · ↓ / 空格速降 · R 重开', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '12px', color: '#a1848c', align: 'center' }).setOrigin(0.5).setDepth(20);
      this.queueGraphics = this.add.graphics().setDepth(20);
      this.queueLabel = this.add.text(choose(785, 460), choose(96, 118), '接下来', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#806770', align: 'center' }).setOrigin(0.5).setDepth(21);
      this.speedButtons = addTetrisSpeedSelector(this, choose(150, CENTER_X), choose(130, 110), (mode) => this.setPhysicsSpeed(mode), true);

      this.addPhysicsControls();
      this.keys = this.input.keyboard.addKeys({ left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT, up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN, space: Phaser.Input.Keyboard.KeyCodes.SPACE, r: Phaser.Input.Keyboard.KeyCodes.R, esc: Phaser.Input.Keyboard.KeyCodes.ESC });
      this.touchGesture = null;
      this.input.on('pointerdown', (pointer) => {
        JellyAudio.start();
        if (this.state !== 'playing' || !this.insidePhysicsBoard(pointer.x, pointer.y)) return;
        this.touchGesture = { id: pointer.id, x: pointer.x, y: pointer.y, lastX: pointer.x, moved: false };
      });
      this.input.on('pointermove', (pointer) => {
        if (!this.touchGesture || this.touchGesture.id !== pointer.id || !pointer.isDown) return;
        const dx = pointer.x - this.touchGesture.lastX;
        if (Math.abs(dx) >= 16) {
          this.pushCurrent(dx > 0 ? 1 : -1);
          this.touchGesture.lastX = pointer.x;
          this.touchGesture.moved = true;
        }
      });
      this.input.on('pointerup', (pointer) => {
        if (!this.touchGesture || this.touchGesture.id !== pointer.id) return;
        const gesture = this.touchGesture;
        this.touchGesture = null;
        const dy = pointer.y - gesture.y;
        if (dy > 34) this.fastDrop();
        else if (!gesture.moved) this.rotateCurrent();
      });

      this.matter.world.on('collisionstart', (event) => this.handlePhysicsImpacts(event));
      this.fillPhysicsQueue();
      this.spawnPhysicsPiece();
      window.JellyTetrisBest = window.JellyTetrisBest || 0;
      analytics('physics_stack_start', { mode: 'jelly_physics_stack' });
    }

    setPhysicsSpeed(mode) {
      const key = TETRIS_SPEEDS[mode] ? mode : 'normal';
      const config = TETRIS_SPEEDS[key];
      this.speedMode = key;
      window.JellyTetrisSpeed = key;
      this.matter.world.setGravity(0, config.gravity);
      if (this.statusText) this.statusText.setText(`已切换为${config.label}下落，可随时再次调整`);
    }

    insidePhysicsBoard(x, y) {
      return x >= this.playfield.left && x <= this.playfield.right && y >= this.playfield.top && y <= this.playfield.bottom;
    }

    addPhysicsWalls() {
      const field = this.playfield;
      const options = { isStatic: true, friction: 0.72, frictionStatic: 0.9, restitution: 0.34, label: 'jelly-stack-wall' };
      this.matter.add.rectangle((field.left + field.right) / 2, field.bottom + 13, field.right - field.left + 48, 26, options);
      this.matter.add.rectangle(field.left - 13, (field.top + field.bottom) / 2, 26, field.bottom - field.top + 60, options);
      this.matter.add.rectangle(field.right + 13, (field.top + field.bottom) / 2, 26, field.bottom - field.top + 60, options);
    }

    addPhysicsControls() {
      const y = IS_PORTRAIT ? 874 : 472;
      const controls = IS_PORTRAIT
        ? [[105, y, '左推', () => this.pushCurrent(-1)], [215, y, '旋转', () => this.rotateCurrent()], [325, y, '右推', () => this.pushCurrent(1)], [435, y, '速降', () => this.fastDrop()]]
        : [[748, y, '左推', () => this.pushCurrent(-1)], [826, y, '旋转', () => this.rotateCurrent()], [904, y, '右推', () => this.pushCurrent(1)], [826, y - 43, '速降', () => this.fastDrop()]];
      controls.forEach(([x, buttonY, label, callback]) => addButton(this, x, buttonY, IS_PORTRAIT ? 88 : 68, 36, label, callback, { depth: 25, fontSize: '12px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' }));
      addButton(this, choose(904, 435), IS_PORTRAIT ? 926 : 516, IS_PORTRAIT ? 88 : 68, 34, '重开', () => this.restart(), { depth: 25, fontSize: '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
      addButton(this, choose(748, 105), IS_PORTRAIT ? 926 : 516, IS_PORTRAIT ? 88 : 68, 34, '返回', () => this.scene.start('JellyTetrisTitleScene'), { depth: 25, fontSize: '11px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
    }

    fillPhysicsQueue() {
      while (this.queue.length < 7) {
        const bag = Phaser.Utils.Array.Shuffle([0, 1, 2, 3, 4, 5, 6]);
        this.queue.push(...bag);
      }
    }

    spawnPhysicsPiece() {
      if (this.state !== 'playing' || this.current) return;
      this.fillPhysicsQueue();
      const shapeIndex = this.queue.shift();
      this.fillPhysicsQueue();
      const shape = TETRIS_SHAPES[shapeIndex];
      const matrix = shape.matrix;
      const cell = this.physicsCell;
      const centerX = (this.playfield.left + this.playfield.right) / 2;
      const spawnY = this.playfield.top + cell * 0.9;
      const MatterLib = Phaser.Physics.Matter.Matter;
      const parts = [];
      const partCells = [];
      const rows = matrix.length;
      const cols = matrix[0].length;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (!matrix[row][col]) continue;
          const px = centerX + (col - (cols - 1) / 2) * cell;
          const py = spawnY + (row - (rows - 1) / 2) * cell;
          parts.push(MatterLib.Bodies.rectangle(px, py, cell * 0.99, cell * 0.99, { chamfer: { radius: cell * 0.17 } }));
          partCells.push({ row, col });
        }
      }
      const body = MatterLib.Body.create({
        parts,
        friction: 0.2,
        frictionStatic: 0.3,
        frictionAir: 0.009,
        restitution: 0.46,
        density: 0.00145,
        label: 'jelly-tetromino',
      });
      this.matter.world.add(body);
      const piece = {
        id: this.nextId++,
        shapeIndex,
        color: shape.color,
        body,
        localCells: body.parts.slice(1).map((part, index) => ({ x: part.position.x - body.position.x, y: part.position.y - body.position.y, row: partCells[index].row, col: partCells[index].col })),
        age: 0,
        restTime: 0,
        dangerHold: 0,
        settled: false,
        deform: 0.12,
        wobblePhase: 0,
      };
      body.plugin = body.plugin || {};
      body.plugin.physicsJelly = piece;
      body.parts.forEach((part) => { part.plugin = part.plugin || {}; part.plugin.physicsJelly = piece; });
      MatterLib.Body.setAngle(body, Phaser.Math.FloatBetween(-0.06, 0.06));
      MatterLib.Body.setAngularVelocity(body, Phaser.Math.FloatBetween(-0.012, 0.012));
      this.pieces.push(piece);
      this.current = piece;
      this.spawnPending = false;
      this.statusText.setText('推动或旋转当前果冻，观察它会滑到哪里');
    }

    pushCurrent(direction) {
      if (this.state !== 'playing' || !this.current) return;
      const body = this.current.body;
      const nextX = clamp(body.velocity.x + direction * 2.25, -5.2, 5.2);
      this.matter.body.setVelocity(body, { x: nextX, y: body.velocity.y });
      this.matter.body.setAngularVelocity(body, clamp(body.angularVelocity + direction * 0.018, -0.14, 0.14));
      this.current.deform = Math.max(this.current.deform, 0.18);
      JellyAudio.drop(0);
    }

    rotateCurrent() {
      if (this.state !== 'playing' || !this.current) return;
      const body = this.current.body;
      Phaser.Physics.Matter.Matter.Body.rotate(body, Math.PI / 2);
      this.matter.body.setAngularVelocity(body, clamp(body.angularVelocity + 0.045, -0.16, 0.16));
      this.current.deform = Math.max(this.current.deform, 0.24);
      JellyAudio.merge(1);
    }

    fastDrop() {
      if (this.state !== 'playing' || !this.current) return;
      const body = this.current.body;
      this.matter.body.setVelocity(body, { x: body.velocity.x * 0.82, y: Math.max(body.velocity.y, 7.4) });
      this.current.deform = Math.max(this.current.deform, 0.28);
      JellyAudio.drop(2);
    }

    handlePhysicsImpacts(event) {
      for (const pair of event.pairs) {
        const a = pair.bodyA.plugin && pair.bodyA.plugin.physicsJelly;
        const b = pair.bodyB.plugin && pair.bodyB.plugin.physicsJelly;
        this.applyPhysicsImpact(a, pair.bodyA, pair.bodyB);
        this.applyPhysicsImpact(b, pair.bodyB, pair.bodyA);
      }
    }

    applyPhysicsImpact(piece, ownBody, otherBody) {
      if (!piece) return;
      const dx = ownBody.velocity.x - otherBody.velocity.x;
      const dy = ownBody.velocity.y - otherBody.velocity.y;
      const impact = Math.sqrt(dx * dx + dy * dy);
      if (impact < 0.45) return;
      piece.deform = Math.max(piece.deform, clamp(impact * 0.055, 0.1, 0.42));
      piece.wobblePhase = 0;
      if (impact > 2.4) JellyAudio.drop(Math.min(6, piece.shapeIndex));
    }

    settleCurrent() {
      const piece = this.current;
      if (!piece || piece.settled) return;
      piece.settled = true;
      piece.dangerHold = 0;
      this.current = null;
      this.score += 1;
      window.JellyTetrisBest = Math.max(window.JellyTetrisBest || 0, this.score);
      this.statusText.setText(`成功堆下第 ${this.score} 块 · 下一块马上来`);
      JellyAudio.merge(Math.min(8, 1 + Math.floor(this.score / 4)));
      if (!this.spawnPending) {
        this.spawnPending = true;
        this.time.delayedCall(360, () => this.spawnPhysicsPiece());
      }
    }

    drawPhysicsBoard() {
      const field = this.playfield;
      const width = field.right - field.left;
      const height = field.bottom - field.top;
      this.boardGraphics.clear();
      this.boardGraphics.fillStyle(0x697a9e, 0.26).fillRoundedRect(field.left - 15, field.top - 14, width + 30, height + 29, 24);
      this.boardGraphics.fillStyle(0xfff5e8, 0.98).fillRoundedRect(field.left - 8, field.top - 7, width + 16, height + 16, 18);
      this.boardGraphics.lineStyle(4, 0x694d5b, 0.76).strokeRoundedRect(field.left - 8, field.top - 7, width + 16, height + 16, 18);
      this.boardGraphics.fillStyle(0x241b43, 0.94).fillRoundedRect(field.left, field.top, width, height, 12);
      this.boardGraphics.fillStyle(0xffffff, 0.025);
      for (let x = field.left + 18; x < field.right; x += 34) for (let y = field.top + 18; y < field.bottom; y += 34) this.boardGraphics.fillCircle(x, y, 1.1);
      this.boardGraphics.lineStyle(3, 0xe8f15f, 0.94).lineBetween(field.left + 3, field.danger, field.right - 3, field.danger);
      this.boardGraphics.fillStyle(0xe8f15f, 0.1).fillRect(field.left + 3, field.danger - 4, width - 6, 8);
      this.add.text(field.left + 12, field.danger - 25, '危险线', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '11px', color: '#dfe966' }).setDepth(3);
    }

    drawPhysicsPiece(piece, time) {
      const body = piece.body;
      const speedStretch = clamp(Math.abs(body.velocity.y) * 0.014, 0, 0.18);
      const spring = Math.sin(piece.wobblePhase) * piece.deform;
      const scaleX = clamp(1 - speedStretch * 0.34 + piece.deform * 0.46 - spring * 0.25, 0.82, 1.28);
      const scaleY = clamp(1 + speedStretch - piece.deform * 0.58 + spring * 0.35, 0.72, 1.3);
      this.pieceGraphics.save();
      this.pieceGraphics.translateCanvas(body.position.x, body.position.y);
      this.pieceGraphics.rotateCanvas(body.angle);
      this.pieceGraphics.scaleCanvas(scaleX, scaleY);
      const renderCells = piece.localCells.map((cell, index) => {
        const phase = time * 0.013 + index * 1.4;
        const wobbleX = Math.sin(phase) * piece.deform * 3.2;
        const wobbleY = Math.cos(phase * 0.83) * piece.deform * 2.6;
        return { x: cell.x + wobbleX, y: cell.y + wobbleY, row: cell.row, col: cell.col };
      });
      drawCandyJellyCells(this.pieceGraphics, renderCells, this.physicsCell * 1.02, piece.color, 1, piece.id * 17 + piece.shapeIndex * 41);
      this.pieceGraphics.restore();
    }

    drawPhysicsQueue() {
      this.queueGraphics.clear();
      const panelX = choose(785, 460);
      const panelY = choose(160, 175);
      const panelWidth = choose(150, 72);
      const panelHeight = choose(285, 235);
      this.queueGraphics.fillStyle(0x25143e, 0.72).fillRoundedRect(panelX - panelWidth / 2, panelY - 30, panelWidth, panelHeight, 16);
      this.queue.slice(0, 5).forEach((shapeIndex, index) => {
        const shape = TETRIS_SHAPES[shapeIndex];
        drawTetrisMini(this.queueGraphics, panelX, panelY + index * choose(52, 43), choose(13, 10), shape.color, shape);
      });
    }

    update(time, delta) {
      const dt = Math.min(delta || 16, 34) / 1000;
      if (this.state !== 'playing') {
        this.renderPhysics(time);
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.left)) this.pushCurrent(-1);
      if (Phaser.Input.Keyboard.JustDown(this.keys.right)) this.pushCurrent(1);
      if (Phaser.Input.Keyboard.JustDown(this.keys.up)) this.rotateCurrent();
      if (Phaser.Input.Keyboard.JustDown(this.keys.down) || Phaser.Input.Keyboard.JustDown(this.keys.space)) this.fastDrop();
      if (Phaser.Input.Keyboard.JustDown(this.keys.r)) this.restart();
      if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) this.scene.start('JellyTetrisTitleScene');

      this.pieces.forEach((piece) => {
        piece.age += dt;
        piece.wobblePhase += dt * 20;
        piece.deform *= Math.pow(0.05, dt);
      });
      if (this.current) {
        const body = this.current.body;
        const stable = body.speed < 0.34 && Math.abs(body.angularSpeed) < 0.028 && body.position.y > this.playfield.top + this.physicsCell * 2;
        this.current.restTime = stable ? this.current.restTime + dt : 0;
        if (this.current.restTime >= 0.48 || this.current.age >= 7.5) this.settleCurrent();
        if (body.position.y > this.playfield.bottom + 120) this.gameOverPhysics();
      }

      for (const piece of this.pieces) {
        if (!piece.settled) continue;
        const bodyParts = piece.body.parts.length > 1 ? piece.body.parts.slice(1) : piece.body.parts;
        const top = Math.min(...bodyParts.map((part) => part.bounds.min.y));
        const stable = piece.body.speed < 0.42 && Math.abs(piece.body.angularSpeed) < 0.035;
        if (top <= this.playfield.danger && stable && piece.age > 0.8) piece.dangerHold += dt;
        else piece.dangerHold = Math.max(0, piece.dangerHold - dt * 1.8);
        if (piece.dangerHold >= 1.2) { this.gameOverPhysics(); break; }
      }
      this.renderPhysics(time);
    }

    renderPhysics(time) {
      this.pieceGraphics.clear();
      this.fxGraphics.clear();
      this.pieces.forEach((piece) => this.drawPhysicsPiece(piece, time || 0));
      this.drawPhysicsQueue();
      this.scoreText.setText(`分数 ${this.score}`);
      this.bestText.setText(`最高 ${Math.max(window.JellyTetrisBest || 0, this.score)}`);
    }

    gameOverPhysics() {
      if (this.state !== 'playing') return;
      this.state = 'over';
      this.current = null;
      this.matter.world.pause();
      window.JellyTetrisBest = Math.max(window.JellyTetrisBest || 0, this.score);
      JellyAudio.finish();
      analytics('physics_stack_over', { score: this.score });
      this.add.rectangle(CENTER_X, HEIGHT / 2, WIDTH, HEIGHT, 0x5b5364, 0.45).setDepth(40);
      this.add.rectangle(CENTER_X, choose(270, 480), choose(500, 460), choose(330, 420), 0xfff5e8, 0.98).setStrokeStyle(3, 0x694d5b, 0.82).setDepth(41);
      this.add.text(CENTER_X, choose(172, 340), '果冻堆过危险线啦', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: choose('30px', '27px'), fontStyle: 'bold', color: '#4b354d' }).setOrigin(0.5).setDepth(42);
      this.add.text(CENTER_X, choose(218, 394), `成功堆叠 ${this.score} 块 · 最高 ${window.JellyTetrisBest}`, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '16px', color: '#6b515c', align: 'center' }).setOrigin(0.5).setDepth(42);
      addButton(this, choose(390, 165), choose(330, 650), choose(170, 180), choose(44, 50), '再来一局', () => this.restart(), { depth: 45, color: 0xff8f76, hover: 0xffa98e, stroke: 0xffc5a6, textColor: '#5f3441' });
      addButton(this, choose(570, 375), choose(330, 650), choose(170, 180), choose(44, 50), '返回标题', () => this.scene.start('JellyTetrisTitleScene'), { depth: 45, fontSize: '15px', color: 0xffffff, hover: 0xffe0d1, stroke: 0xc87988, textColor: '#754351' });
    }

    restart() {
      if (this.matter.world.enabled === false) this.matter.world.resume();
      this.scene.restart();
    }
  }

  window.GameHubScene = GameHubScene;
  window.JellyTitleScene = JellyTitleScene;
  window.JellyGameScene = JellyGameScene;
  window.JellyTetrisTitleScene = JellyTetrisTitleScene;
  window.JellyTetrisScene = JellyPhysicsTetrisScene;
})();
