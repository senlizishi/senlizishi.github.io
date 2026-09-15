(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const CX = 270;
  const CY = 480;
  const ARENA = { left: 46, right: 494, top: 132, bottom: 828, cx: CX, cy: CY };
  const GOAL_HALF = 80;
  const PUCK_R = 22;
  const MALLET_R = 34;
  const WIN_SCORE = 5;
  const HUMAN_SPEED = 1900;
  const MAX_PUCK_SPEED = 950;
  const AI_CONFIG = {
    easy: { speed: 180, lag: 220, error: 90 },
    normal: { speed: 300, lag: 120, error: 40 },
    hard: { speed: 420, lag: 40, error: 12 },
  };
  const COLORS = {
    bg: 0x120d27,
    board: 0x1b1830,
    field: 0x211c3a,
    wall: 0x6a5f9e,
    line: 0x3a3358,
    goal: 0x35c98a,
    puck: 0xffd84e,
    puckCore: 0xfff5c2,
    top: 0x4de5bf,
    bottom: 0xff5fc8,
  };

  const PuckAudio = {
    ctx: null,
    muted: false,
    ensure() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return !!this.ctx;
    },
    toggleMute() {
      this.muted = !this.muted;
      return !this.muted;
    },
    tone(frequency, duration, type, gain) {
      if (this.muted || !this.ensure()) return;
      const ctx = this.ctx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain || 0.08), now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    },
    menu() { this.tone(520, 0.09, 'sine', 0.08); },
    hit() { this.tone(150, 0.08, 'square', 0.14); this.tone(340, 0.05, 'triangle', 0.06); },
    wall() { this.tone(220, 0.05, 'triangle', 0.05); },
    goal() { this.tone(660, 0.12, 'triangle', 0.12); this.tone(880, 0.16, 'sine', 0.09); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.11)); },
  };
  window.PuckAudio = PuckAudio;

  function setBodyPosition(body, x, y) {
    body.position.x = x;
    body.position.y = y;
    if (body.positionPrev) {
      body.positionPrev.x = x;
      body.positionPrev.y = y;
    }
  }

  class PuckGameScene extends Phaser.Scene {
    constructor() { super('PuckGameScene'); }

    create() {
      this.state = 'menu';
      this.mode = null;
      this.aiDifficulty = 'normal';
      this.scores = { top: 0, bottom: 0 };
      this.menuItems = [];
      this.overlayItems = [];
      this.wallBodies = [];
      this.puck = null;
      this.mallets = null;
      this.pointerTargets = { top: null, bottom: null };
      this.pointerSlots = { top: null, bottom: null };
      this.aiTarget = null;
      this.aiLastDecision = 0;
      this.aiErrorX = 0;
      this.aiErrorY = 0;
      this.lastWallSound = 0;
      this.lastHitSound = 0;

      this.bgGraphics = this.add.graphics().setDepth(0);
      this.arenaGraphics = this.add.graphics().setDepth(1);
      this.puckGraphics = this.add.graphics().setDepth(2);
      this.uiGraphics = this.add.graphics().setDepth(3);

      this.input.on('pointerdown', (pointer) => this.onPointerDown(pointer));
      this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
      this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
      this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));

      this.matter.world.on('collisionstart', (event) => this.handleCollisions(event));

      this.drawBackground();
      this.drawArena();
      this.drawMenu();
    }

    drawBackground() {
      const g = this.bgGraphics;
      g.clear();
      g.fillStyle(COLORS.bg, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0x2a2145, 0.5).fillCircle(40, 130, 150);
      g.fillStyle(0x1d3550, 0.45).fillCircle(WIDTH - 30, HEIGHT - 60, 180);
    }

    drawArena() {
      const g = this.arenaGraphics;
      g.clear();
      const left = ARENA.left;
      const right = ARENA.right;
      const top = ARENA.top;
      const bottom = ARENA.bottom;
      g.fillStyle(COLORS.board, 1).fillRoundedRect(left - 18, top - 18, right - left + 36, bottom - top + 36, 26);
      g.fillStyle(COLORS.field, 1).fillRect(left, top, right - left, bottom - top);
      g.lineStyle(3, COLORS.line, 0.95).lineBetween(left, CY, right, CY);
      g.lineStyle(2, COLORS.line, 0.7).strokeCircle(CX, CY, 84);
      g.fillStyle(COLORS.wall, 1);
      g.fillRect(left - 8, top - 8, (CX - GOAL_HALF) - left + 8, 16);
      g.fillRect(CX + GOAL_HALF, top - 8, right + 8 - (CX + GOAL_HALF), 16);
      g.fillRect(left - 8, bottom - 8, (CX - GOAL_HALF) - left + 8, 16);
      g.fillRect(CX + GOAL_HALF, bottom - 8, right + 8 - (CX + GOAL_HALF), 16);
      g.fillRect(left - 8, top - 8, 16, bottom - top + 16);
      g.fillRect(right - 8, top - 8, 16, bottom - top + 16);
      g.fillStyle(COLORS.goal, 0.95).fillRect(CX - GOAL_HALF, top - 8, GOAL_HALF * 2, 16);
      g.fillStyle(COLORS.goal, 0.95).fillRect(CX - GOAL_HALF, bottom - 8, GOAL_HALF * 2, 16);
    }

    drawMenu() {
      this.clearMenu();
      this.state = 'menu';
      const title = this.add.text(CX, CY - 330, '\u5706\u7247\u5bf9\u6218', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '52px', fontStyle: 'bold', color: '#ffe9f6', stroke: '#3d2a3a', strokeThickness: 6 }).setOrigin(0.5).setDepth(11);
      const subtitle = this.add.text(CX, CY - 262, '\u628a\u5706\u7247\u649e\u8fdb\u5bf9\u65b9\u7403\u95e8\uff0c\u5148\u5f97 5 \u5206\u80dc\u51fa', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '20px', color: '#cbb8f2' }).setOrigin(0.5).setDepth(11);
      this.menuItems.push(title, subtitle);
      this.addMenuButton(CX, CY - 120, 320, 62, 0xff8a48, '\u53cc\u4eba\u5bf9\u6218', () => this.startMatch('pvp', 'normal'));
      const aiLabel = this.add.text(CX, CY - 12, '\u4eba\u673a\u5bf9\u6218 \u00b7 \u7535\u8111\u96be\u5ea6', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#d9c9f5' }).setOrigin(0.5).setDepth(11);
      this.menuItems.push(aiLabel);
      this.addMenuButton(CX, CY + 70, 260, 54, 0x35c98a, '\u7b80\u5355', () => this.startMatch('ai', 'easy'));
      this.addMenuButton(CX, CY + 150, 260, 54, 0x4de5bf, '\u666e\u901a', () => this.startMatch('ai', 'normal'));
      this.addMenuButton(CX, CY + 230, 260, 54, 0x9b72ff, '\u56f0\u96be', () => this.startMatch('ai', 'hard'));
    }

    addMenuButton(x, y, w, h, color, label, onClick) {
      const button = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(3, 0xffffff, 0.35).setInteractive({ useHandCursor: true }).setDepth(11);
      const text = this.add.text(x, y, label, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff', stroke: '#3d2a3a', strokeThickness: 3 }).setOrigin(0.5).setDepth(12);
      button.on('pointerdown', () => { PuckAudio.menu(); onClick(); });
      this.menuItems.push(button, text);
    }

    clearMenu() {
      this.menuItems.forEach((item) => item.destroy());
      this.menuItems = [];
    }

    startMatch(mode, difficulty) {
      this.clearMenu();
      this.clearOverlay();
      this.mode = mode;
      this.aiDifficulty = difficulty;
      this.scores = { top: 0, bottom: 0 };
      this.finishAfterGoal = false;
      this.pointerTargets = { top: null, bottom: null };
      this.pointerSlots = { top: null, bottom: null };
      this.aiTarget = null;
      this.aiLastDecision = 0;
      this.createMatchBodies();
      this.createScoreTexts();
      this.resetRound();
      this.state = 'playing';
      this.updateScore();
    }

    createMatchBodies() {
      this.clearMatch();
      this.wallBodies = [];
      const wallOptions = { isStatic: true, label: 'wall', restitution: 0.92, friction: 0 };
      const left = ARENA.left;
      const right = ARENA.right;
      const top = ARENA.top;
      const bottom = ARENA.bottom;
      const addWall = (x, y, w, h) => { this.wallBodies.push(this.matter.add.rectangle(x, y, w, h, wallOptions)); };
      addWall((left + (CX - GOAL_HALF)) / 2, top - 8, (CX - GOAL_HALF) - left, 16);
      addWall((right + (CX + GOAL_HALF)) / 2, top - 8, right - (CX + GOAL_HALF), 16);
      addWall((left + (CX - GOAL_HALF)) / 2, bottom + 8, (CX - GOAL_HALF) - left, 16);
      addWall((right + (CX + GOAL_HALF)) / 2, bottom + 8, right - (CX + GOAL_HALF), 16);
      addWall(left - 8, CY, 16, bottom - top + 16);
      addWall(right + 8, CY, 16, bottom - top + 16);

      this.puck = {
        body: this.matter.add.circle(CX, CY, PUCK_R, { label: 'puck', restitution: 0.95, friction: 0.01, frictionStatic: 0.05, frictionAir: 0.006, density: 0.001 }),
      };
      const malletOptions = { label: 'mallet', restitution: 1, friction: 0, frictionStatic: 0, frictionAir: 0.03, density: 0.02 };
      this.mallets = {
        top: { body: this.matter.add.circle(CX, CY - 190, MALLET_R, malletOptions), player: 'top' },
        bottom: { body: this.matter.add.circle(CX, CY + 190, MALLET_R, malletOptions), player: 'bottom' },
      };
      this.topMallet = this.mallets.top;
      this.bottomMallet = this.mallets.bottom;
    }

    clearMatch() {
      if (this.puck) { try { this.matter.world.remove(this.puck.body); } catch (e) {} this.puck = null; }
      if (this.mallets) {
        try { this.matter.world.remove(this.mallets.top.body); } catch (e) {}
        try { this.matter.world.remove(this.mallets.bottom.body); } catch (e) {}
        this.mallets = null;
      }
      this.wallBodies.forEach((body) => { try { this.matter.world.remove(body); } catch (e) {} });
      this.wallBodies = [];
    }

    createScoreTexts() {
      if (this.scoreTopText) this.scoreTopText.destroy();
      if (this.scoreBottomText) this.scoreBottomText.destroy();
      this.scoreTopText = this.add.text(CX, 58, '0', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#4de5bf' }).setOrigin(0.5).setDepth(4);
      this.scoreBottomText = this.add.text(CX, HEIGHT - 58, '0', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#ff5fc8' }).setOrigin(0.5).setDepth(4);
    }

    resetRound() {
      setBodyPosition(this.puck.body, CX, CY);
      this.matter.body.setVelocity(this.puck.body, 0, 0);
      this.puck.body.angularVelocity = 0;
      setBodyPosition(this.mallets.top.body, CX, CY - 190);
      this.matter.body.setVelocity(this.mallets.top.body, 0, 0);
      setBodyPosition(this.mallets.bottom.body, CX, CY + 190);
      this.matter.body.setVelocity(this.mallets.bottom.body, 0, 0);
      this.state = 'playing';
    }

    onPointerDown(pointer) {
      if (this.state !== 'playing' || !this.mallets) return;
      const player = this.mode === 'ai' ? 'bottom' : (pointer.y < CY ? 'top' : 'bottom');
      if (this.pointerSlots[player] === null) {
        this.pointerSlots[player] = pointer.id;
        this.pointerTargets[player] = { x: pointer.x, y: pointer.y };
      }
    }

    onPointerMove(pointer) {
      const player = this.pointerPlayerFor(pointer.id);
      if (player) this.pointerTargets[player] = { x: pointer.x, y: pointer.y };
    }

    onPointerUp(pointer) {
      const player = this.pointerPlayerFor(pointer.id);
      if (player) {
        this.pointerSlots[player] = null;
        this.pointerTargets[player] = null;
      }
    }

    pointerPlayerFor(pointerId) {
      if (this.pointerSlots.top === pointerId) return 'top';
      if (this.pointerSlots.bottom === pointerId) return 'bottom';
      return null;
    }

    update(time, delta) {
      if (this.state === 'menu' || this.state === 'over') return;
      const dt = Math.min(delta, 50);
      if (this.state === 'playing') {
        this.updateControls(dt);
        this.checkGoal();
      } else if (this.state === 'goal') {
        this.freezeBodies();
        if (time >= this.goalEndTime) {
          if (this.scores.top >= WIN_SCORE || this.scores.bottom >= WIN_SCORE) this.showResult();
          else this.resetRound();
        }
      }
      this.drawDynamic();
    }

    freezeBodies() {
      this.matter.body.setVelocity(this.puck.body, 0, 0);
      this.matter.body.setVelocity(this.mallets.top.body, 0, 0);
      this.matter.body.setVelocity(this.mallets.bottom.body, 0, 0);
    }

    updateControls(dt) {
      if (this.mode === 'ai') {
        const aiTarget = this.updateAi();
        const target = this.clampTarget('top', aiTarget);
        this.moveMallet(this.mallets.top.body, target, AI_CONFIG[this.aiDifficulty].speed, dt);
      } else {
        this.moveMallet(this.mallets.top.body, this.clampTarget('top', this.pointerTargets.top), HUMAN_SPEED, dt);
      }
      this.moveMallet(this.mallets.bottom.body, this.clampTarget('bottom', this.pointerTargets.bottom), HUMAN_SPEED, dt);
      this.clampMalletBody(this.mallets.top.body, 'top');
      this.clampMalletBody(this.mallets.bottom.body, 'bottom');
      this.clampPuckSpeed();
    }

    clampTarget(player, target) {
      if (!target) return null;
      const x = Phaser.Math.Clamp(target.x, ARENA.left + MALLET_R, ARENA.right - MALLET_R);
      const y = player === 'top'
        ? Phaser.Math.Clamp(target.y, ARENA.top + MALLET_R, CY - MALLET_R)
        : Phaser.Math.Clamp(target.y, CY + MALLET_R, ARENA.bottom - MALLET_R);
      return { x: x, y: y };
    }

    moveMallet(body, target, maxSpeed, dt) {
      if (!target) { this.matter.body.setVelocity(body, 0, 0); return; }
      const dx = target.x - body.position.x;
      const dy = target.y - body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) { this.matter.body.setVelocity(body, 0, 0); return; }
      const dtSec = Math.max(dt, 1) / 1000;
      const speed = Math.min(maxSpeed, dist / dtSec);
      this.matter.body.setVelocity(body, dx / dist * speed, dy / dist * speed);
    }

    clampMalletBody(body, player) {
      const x = Phaser.Math.Clamp(body.position.x, ARENA.left + MALLET_R, ARENA.right - MALLET_R);
      const y = player === 'top'
        ? Phaser.Math.Clamp(body.position.y, ARENA.top + MALLET_R, CY - MALLET_R)
        : Phaser.Math.Clamp(body.position.y, CY + MALLET_R, ARENA.bottom - MALLET_R);
      if (x !== body.position.x || y !== body.position.y) setBodyPosition(body, x, y);
    }

    clampPuckSpeed() {
      const v = this.puck.body.velocity;
      const speed = Math.sqrt(v.x * v.x + v.y * v.y);
      if (speed > MAX_PUCK_SPEED) {
        const k = MAX_PUCK_SPEED / speed;
        this.matter.body.setVelocity(this.puck.body, v.x * k, v.y * k);
      }
    }

    updateAi() {
      const cfg = AI_CONFIG[this.aiDifficulty];
      if (!this.aiTarget || this.time.now - this.aiLastDecision >= cfg.lag) {
        this.aiLastDecision = this.time.now;
        this.aiErrorX = (Math.random() * 2 - 1) * cfg.error;
        this.aiErrorY = (Math.random() * 2 - 1) * cfg.error * 0.5;
        this.aiTarget = this.computeAiTarget();
      }
      return { x: this.aiTarget.x + this.aiErrorX, y: this.aiTarget.y + this.aiErrorY };
    }

    computeAiTarget() {
      const p = this.puck.body.position;
      if (p.y < CY) {
        return { x: p.x, y: Math.max(ARENA.top + MALLET_R, p.y - MALLET_R * 0.9) };
      }
      const x = Phaser.Math.Clamp(p.x, ARENA.left + MALLET_R + 10, ARENA.right - MALLET_R - 10);
      return { x: x, y: ARENA.top + MALLET_R + 16 };
    }

    checkGoal() {
      const p = this.puck.body.position;
      if (p.y < ARENA.top - 6 && Math.abs(p.x - CX) <= GOAL_HALF) this.scoreGoal('top');
      else if (p.y > ARENA.bottom + 6 && Math.abs(p.x - CX) <= GOAL_HALF) this.scoreGoal('bottom');
    }

    scoreGoal(side) {
      if (this.state !== 'playing') return;
      if (side === 'top') this.scores.bottom += 1;
      else this.scores.top += 1;
      PuckAudio.goal();
      this.updateScore();
      this.state = 'goal';
      this.goalEndTime = this.time.now + 900;
      this.showGoalBanner(side);
    }

    showGoalBanner(side) {
      if (this.bannerText) this.bannerText.destroy();
      const label = side === 'top' ? '\u4e0b\u65b9\u5f97\u5206\uff01' : '\u4e0a\u65b9\u5f97\u5206\uff01';
      this.bannerText = this.add.text(CX, CY, label, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#fff4d9', stroke: '#6a3b62', strokeThickness: 8 }).setOrigin(0.5).setDepth(8);
      this.time.delayedCall(700, () => { if (this.bannerText) { this.bannerText.destroy(); this.bannerText = null; } });
    }

    updateScore() {
      if (this.scoreTopText) this.scoreTopText.setText(String(this.scores.top));
      if (this.scoreBottomText) this.scoreBottomText.setText(String(this.scores.bottom));
    }

    showResult() {
      this.state = 'over';
      this.freezeBodies();
      this.clearOverlay();
      const g = this.uiGraphics;
      g.clear();
      g.fillStyle(0x05040c, 0.66).fillRect(0, 0, WIDTH, HEIGHT);
      const winner = this.scores.top >= WIN_SCORE ? 'top' : 'bottom';
      let title = winner === 'top' ? '\u4e0a\u65b9\u73a9\u5bb6\u80dc\u5229' : '\u4e0b\u65b9\u73a9\u5bb6\u80dc\u5229';
      let subtitle = '\u5148\u5f97 5 \u5206\uff0c\u8d62\u5f97\u6bd4\u8d5b';
      if (this.mode === 'ai') {
        title = winner === 'bottom' ? '\u4f60\u8d62\u4e86\uff01' : '\u7535\u8111\u8d62\u4e86';
        subtitle = winner === 'bottom' ? '\u4f60\u5148\u62ff\u4e0b 5 \u5206' : '\u518d\u6765\u4e00\u5c40\u6311\u6218\u5427';
      }
      const titleText = this.add.text(CX, CY - 70, title, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#ffe9f6', stroke: '#3d2a3a', strokeThickness: 7 }).setOrigin(0.5).setDepth(11);
      const subtitleText = this.add.text(CX, CY - 14, subtitle, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '20px', color: '#d9c9f5' }).setOrigin(0.5).setDepth(11);
      this.overlayItems.push(titleText, subtitleText);
      this.addOverlayButton(CX, CY + 70, 260, 56, 0xff8a48, '\u518d\u6765\u4e00\u5c40', () => this.startMatch(this.mode, this.aiDifficulty));
      this.addOverlayButton(CX, CY + 150, 260, 56, 0x6a5f9e, '\u8fd4\u56de\u83dc\u5355', () => this.returnToMenu());
      PuckAudio.win();
    }

    addOverlayButton(x, y, w, h, color, label, onClick) {
      const button = this.add.rectangle(x, y, w, h, color, 1).setStrokeStyle(3, 0xffffff, 0.35).setInteractive({ useHandCursor: true }).setDepth(11);
      const text = this.add.text(x, y, label, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#ffffff', stroke: '#3d2a3a', strokeThickness: 3 }).setOrigin(0.5).setDepth(12);
      button.on('pointerdown', () => { PuckAudio.menu(); onClick(); });
      this.overlayItems.push(button, text);
    }

    clearOverlay() {
      this.uiGraphics.clear();
      this.overlayItems.forEach((item) => item.destroy());
      this.overlayItems = [];
      if (this.bannerText) { this.bannerText.destroy(); this.bannerText = null; }
    }

    returnToMenu() {
      this.clearOverlay();
      this.clearMatch();
      if (this.scoreTopText) { this.scoreTopText.destroy(); this.scoreTopText = null; }
      if (this.scoreBottomText) { this.scoreBottomText.destroy(); this.scoreBottomText = null; }
      this.drawMenu();
    }

    drawDynamic() {
      if (!this.puck || !this.mallets) return;
      const g = this.puckGraphics;
      g.clear();
      this.drawMallet(g, this.mallets.top.body, COLORS.top);
      this.drawMallet(g, this.mallets.bottom.body, COLORS.bottom);
      this.drawPuck(g, this.puck.body);
    }

    drawMallet(g, body, color) {
      const x = body.position.x;
      const y = body.position.y;
      g.fillStyle(0x0a0812, 0.3).fillCircle(x + 3, y + 4, MALLET_R);
      g.fillStyle(color, 1).fillCircle(x, y, MALLET_R);
      g.lineStyle(3, 0xffffff, 0.85).strokeCircle(x, y, MALLET_R - 4);
      g.fillStyle(0x120d27, 1).fillCircle(x, y, MALLET_R * 0.42);
      g.fillStyle(color, 1).fillCircle(x, y, MALLET_R * 0.24);
    }

    drawPuck(g, body) {
      const x = body.position.x;
      const y = body.position.y;
      g.fillStyle(COLORS.puck, 0.25).fillCircle(x, y, PUCK_R + 9);
      g.fillStyle(COLORS.puck, 1).fillCircle(x, y, PUCK_R);
      g.lineStyle(3, 0xffffff, 0.9).strokeCircle(x, y, PUCK_R - 4);
      g.fillStyle(COLORS.puckCore, 1).fillCircle(x, y, PUCK_R * 0.42);
    }

    handleCollisions(event) {
      for (const pair of event.pairs) {
        const a = pair.bodyA.label || '';
        const b = pair.bodyB.label || '';
        const labels = a + '|' + b;
        if (labels.indexOf('puck') >= 0 && labels.indexOf('mallet') >= 0) {
          if (this.time.now - this.lastHitSound > 70) { this.lastHitSound = this.time.now; PuckAudio.hit(); }
        } else if (labels.indexOf('puck') >= 0 && labels.indexOf('wall') >= 0) {
          if (this.time.now - this.lastWallSound > 70) { this.lastWallSound = this.time.now; PuckAudio.wall(); }
        }
      }
    }
  }

  window.PuckGameScene = PuckGameScene;
})();
