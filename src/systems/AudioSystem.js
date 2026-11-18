// 全部音效由 WebAudio 实时合成，不依赖外部音频文件。
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ringTimer = null;
  }
  ensure() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, when = 0, slide = null, attack = 0.01 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  noiseBurst(dur, { vol = 0.2, when = 0, freq = 1200, q = 1, type = 'bandpass' } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
  play(name) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'click':
        this.tone(660, 0.06, { type: 'triangle', vol: 0.06 });
        break;
      case 'open':
        this.tone(520, 0.08, { vol: 0.08 });
        this.tone(780, 0.1, { vol: 0.08, when: 0.06 });
        break;
      case 'close':
        this.tone(700, 0.08, { vol: 0.07 });
        this.tone(460, 0.1, { vol: 0.07, when: 0.05 });
        break;
      case 'notify':
        this.tone(880, 0.14, { vol: 0.12 });
        this.tone(1320, 0.22, { vol: 0.1, when: 0.1 });
        break;
      case 'system':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.1, when: i * 0.09 }));
        break;
      case 'coin':
        this.tone(1175, 0.08, { type: 'square', vol: 0.05 });
        this.tone(1568, 0.25, { type: 'square', vol: 0.05, when: 0.07 });
        break;
      case 'error':
        this.tone(220, 0.18, { type: 'sawtooth', vol: 0.06 });
        this.tone(180, 0.22, { type: 'sawtooth', vol: 0.06, when: 0.12 });
        break;
      case 'magic':
        [660, 880, 1100, 1320, 1760].forEach((f, i) => this.tone(f, 0.5, { vol: 0.07, when: i * 0.06 }));
        this.noiseBurst(0.9, { vol: 0.05, freq: 5000, q: 0.7, type: 'highpass' });
        break;
      case 'awaken':
        this.tone(110, 2.4, { type: 'sawtooth', vol: 0.05, slide: 440, attack: 0.4 });
        [523, 784, 1046, 1568, 2093].forEach((f, i) => this.tone(f, 1.2, { vol: 0.06, when: 0.6 + i * 0.12 }));
        this.noiseBurst(2, { vol: 0.06, freq: 6000, q: 0.5, type: 'highpass', when: 0.4 });
        break;
      case 'alert':
        this.tone(440, 0.12, { type: 'triangle', vol: 0.14 });
        this.tone(660, 0.18, { type: 'triangle', vol: 0.14, when: 0.13 });
        break;
      case 'hit':
        this.noiseBurst(0.35, { vol: 0.35, freq: 300, q: 0.8, type: 'lowpass' });
        this.tone(90, 0.4, { vol: 0.2, slide: 40 });
        break;
      case 'heartbeat':
        this.tone(60, 0.18, { vol: 0.3, slide: 40 });
        this.tone(55, 0.2, { vol: 0.25, slide: 38, when: 0.25 });
        break;
      case 'flatline':
        this.tone(1000, 2.4, { type: 'sine', vol: 0.06, attack: 0.02 });
        break;
      case 'drone':
        this.tone(55, 6, { type: 'sawtooth', vol: 0.025, attack: 1.5 });
        this.tone(82, 6, { type: 'sine', vol: 0.04, attack: 1.5 });
        break;
      case 'whoosh':
        this.noiseBurst(0.6, { vol: 0.12, freq: 800, q: 0.6 });
        break;
      case 'cut':
        this.noiseBurst(0.12, { vol: 0.15, freq: 4000, q: 2 });
        break;
      case 'glass':
        this.noiseBurst(0.5, { vol: 0.3, freq: 5000, q: 0.6, type: 'highpass' });
        [2600, 3400, 4100].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.05, when: i * 0.05 }));
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) this.tone(i % 2 ? 620 : 880, 0.32, { type: 'square', vol: 0.06, when: i * 0.34 });
        break;
      case 'explode':
        this.noiseBurst(2.6, { vol: 0.6, freq: 260, q: 0.5, type: 'lowpass' });
        this.tone(70, 2.2, { type: 'sawtooth', vol: 0.25, slide: 28 });
        this.noiseBurst(1.2, { vol: 0.25, freq: 1800, q: 0.5, when: 0.05 });
        break;
      case 'ring':
        [0, 0.2].forEach((w) => {
          this.tone(988, 0.15, { vol: 0.08, when: w });
          this.tone(1318, 0.15, { vol: 0.06, when: w + 0.08 });
        });
        break;
      default:
        break;
    }
  }
  startRing() {
    this.stopRing();
    this.play('ring');
    this.ringTimer = setInterval(() => this.play('ring'), 1600);
  }
  stopRing() {
    if (this.ringTimer) clearInterval(this.ringTimer);
    this.ringTimer = null;
  }
}
