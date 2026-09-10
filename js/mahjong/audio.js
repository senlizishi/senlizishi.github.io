/*
 * 麻将音效：全部用 WebAudio 实时合成，不加载任何音频文件。
 */
(function (root) {
  'use strict';

  const Audio = {
    context: null,
    master: null,
    noise: null,
    enabled: true,
    started: false,

    start: function () {
      try {
        if (!this.context) {
          const Ctor = window.AudioContext || window.webkitAudioContext;
          if (!Ctor) return false;
          this.context = new Ctor();
          this.master = this.context.createGain();
          this.master.gain.value = this.enabled ? 0.9 : 0;
          this.master.connect(this.context.destination);
          const seconds = 0.8;
          const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
          this.noise = buffer;
        }
        if (this.context.state === 'suspended') this.context.resume();
        this.started = true;
        return true;
      } catch (error) {
        return false;
      }
    },

    setEnabled: function (value) {
      this.enabled = !!value;
      this.start();
      if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, this.context.currentTime, 0.03);
      return this.enabled;
    },

    toggle: function () {
      return this.setEnabled(!this.enabled);
    },

    // 骨牌互撞的“啪”：噪声脉冲 + 低频木质共鸣
    clack: function (strength) {
      if (!this.started || !this.enabled || !this.context) return;
      const ctx = this.context;
      const now = ctx.currentTime;
      const power = Math.max(0.15, Math.min(1, strength === undefined ? 0.6 : strength));
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1500 + power * 1800;
      band.Q.value = 1.1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.5 * power, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06 + power * 0.05);
      source.connect(band); band.connect(gain); gain.connect(this.master);
      source.start(now, Math.random() * 0.4, 0.16);
      source.stop(now + 0.18);

      const body = ctx.createOscillator();
      body.type = 'triangle';
      body.frequency.setValueAtTime(200 + power * 90, now);
      body.frequency.exponentialRampToValueAtTime(90, now + 0.09);
      const bodyGain = ctx.createGain();
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.linearRampToValueAtTime(0.16 * power, now + 0.005);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      body.connect(bodyGain); bodyGain.connect(this.master);
      body.start(now); body.stop(now + 0.14);
    },

    tone: function (frequency, duration, type, gainValue, delay) {
      if (!this.started || !this.enabled || !this.context) return;
      const ctx = this.context;
      const at = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(gainValue || 0.12, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(gain); gain.connect(this.master);
      osc.start(at); osc.stop(at + duration + 0.05);
    },

    draw: function () { this.clack(0.34); },
    discard: function () { this.clack(0.72); },
    deal: function () { this.clack(0.26); },
    pong: function () {
      this.clack(0.8);
      this.tone(660, 0.16, 'triangle', 0.1, 0.02);
      this.tone(880, 0.22, 'triangle', 0.09, 0.09);
    },
    kong: function () {
      this.clack(0.95);
      this.tone(523.25, 0.2, 'square', 0.07, 0.02);
      this.tone(659.25, 0.24, 'square', 0.07, 0.1);
      this.tone(783.99, 0.34, 'triangle', 0.09, 0.18);
    },
    win: function () {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      for (let i = 0; i < notes.length; i += 1) this.tone(notes[i], 0.34, 'triangle', 0.11, i * 0.09);
      this.tone(261.63, 0.7, 'sine', 0.08, 0.1);
    },
    lose: function () {
      this.tone(392, 0.3, 'triangle', 0.1, 0);
      this.tone(311.13, 0.36, 'triangle', 0.1, 0.16);
      this.tone(233.08, 0.6, 'sine', 0.1, 0.34);
    },
    pass: function () { this.clack(0.3); },
    turn: function () { this.tone(880, 0.1, 'sine', 0.06, 0); },
  };

  root.MahjongAudio = Audio;
})(typeof window !== 'undefined' ? window : this);