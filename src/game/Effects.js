import * as THREE from 'three';
import { glowTexture } from './materials.js';

// 统一的粒子池 + 补间动画
export class Effects {
  constructor(scene, mobile = false) {
    this.cap = mobile ? 360 : 600;
    this.pos = new Float32Array(this.cap * 3).fill(-999);
    this.col = new Float32Array(this.cap * 3);
    this.vel = new Float32Array(this.cap * 3);
    this.life = new Float32Array(this.cap);
    this.max = new Float32Array(this.cap);
    this.base = new Float32Array(this.cap * 3);
    this.attract = new Float32Array(this.cap);
    this.grav = new Float32Array(this.cap);
    this.targets = new Array(this.cap).fill(null);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.13, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.tweens = [];
    this._c = new THREE.Color();
  }
  emit(origin, count, o = {}) {
    const { color = '#6ff', speed = 1.5, life = 1, gravity = 0, spread = 0.2, up = 0.4, target = null, attract = 0 } = o;
    this._c.set(color);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.cap;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.pos[i * 3] = origin.x + Math.cos(a) * r;
      this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = origin.z + Math.sin(a) * r;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = Math.cos(a) * v;
      this.vel[i * 3 + 1] = up * (0.5 + Math.random());
      this.vel[i * 3 + 2] = Math.sin(a) * v;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.6);
      this.base[i * 3] = this._c.r;
      this.base[i * 3 + 1] = this._c.g;
      this.base[i * 3 + 2] = this._c.b;
      this.attract[i] = attract;
      this.grav[i] = gravity;
      this.targets[i] = target;
    }
  }
  tween(dur, fn) {
    return new Promise((resolve) => this.tweens.push({ t: 0, dur, fn, resolve }));
  }
  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3;
      if (this.life[i] <= 0) {
        this.pos[j + 1] = -999;
        this.col[j] = this.col[j + 1] = this.col[j + 2] = 0;
        continue;
      }
      const tg = this.targets[i];
      if (tg) {
        const k = this.attract[i];
        this.vel[j] += (tg.x - this.pos[j]) * k * dt;
        this.vel[j + 1] += (tg.y - this.pos[j + 1]) * k * dt;
        this.vel[j + 2] += (tg.z - this.pos[j + 2]) * k * dt;
        const damp = Math.exp(-dt * 2.5);
        this.vel[j] *= damp;
        this.vel[j + 1] *= damp;
        this.vel[j + 2] *= damp;
      }
      this.vel[j + 1] -= this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const f = Math.min(1, (this.life[i] / this.max[i]) * 2.2);
      this.col[j] = this.base[j] * f;
      this.col[j + 1] = this.base[j + 1] * f;
      this.col[j + 2] = this.base[j + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      try {
        tw.fn(k);
      } catch (e) {
        console.error(e);
      }
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
  }
}
