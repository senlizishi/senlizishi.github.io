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

  window.JellyTitleScene = JellyTitleScene;
  window.JellyGameScene = JellyGameScene;
})();
