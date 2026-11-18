import * as THREE from 'three';
import { buildHuman, lerpAngle } from './Character.js';
import { bubbleTexture } from './materials.js';

export const FOV_HALF = (55 * Math.PI) / 180;
export const VIEW_RANGE = 12;

export function suspicionLevel(v) {
  if (v >= 75) return { level: 3, label: '秘密可能暴露', color: '#ff3b4a' };
  if (v >= 50) return { level: 2, label: '怀疑', color: '#ff8a3b' };
  if (v >= 25) return { level: 1, label: '好奇', color: '#f5d04a' };
  return { level: 0, label: '正常', color: '#5fe08a' };
}

// 巡逻路线：保安室 → 楼道尽头 → 返回
const ROUTE = [
  { x: 25.6, z: 4.6, wait: 20, face: Math.PI / 2 },
  { x: 23.6, z: 0.2 },
  { x: 10.3, z: 0.0, wait: 6, face: Math.PI / 2 },
  { x: 23.6, z: 0.2 },
];

export class Guard {
  constructor(scene) {
    this.h = buildHuman({ shirt: '#2f4466', pants: '#232a38', hair: '#555', cap: '#1e2c44', skin: '#e2b391', shoes: '#151515' });
    this.group = this.h.group;
    scene.add(this.group);
    this.pos = this.group.position;
    this.yaw = Math.PI / 2;
    this.wi = 0;
    this.waiting = 0;
    this.holdT = 0;
    this.holdTarget = null;
    this.speed = 0;
    this.ray = new THREE.Raycaster();
    this._eye = new THREE.Vector3();
    this._dir = new THREE.Vector3();

    // 视野扇形（经射线裁剪），让玩家能读懂保安看向哪里
    this.rays = 22;
    const geo = new THREE.BufferGeometry();
    this.conePos = new Float32Array((this.rays + 2) * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.conePos, 3));
    const idx = [];
    for (let i = 1; i <= this.rays; i++) idx.push(0, i, i + 1);
    geo.setIndex(idx);
    this.coneMat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(geo, this.coneMat);
    this.cone.frustumCulled = false;
    this.cone.renderOrder = 2;
    scene.add(this.cone);
    this.coneTick = 0;

    this.bubbleTex = { '!': bubbleTexture('!', '#e74c3c'), '?': bubbleTexture('?', '#f39c12'), '…': bubbleTexture('…', '#4a6fa5') };
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex['!'], depthTest: false }));
    this.bubble.scale.set(0.5, 0.5, 1);
    this.bubble.position.y = 2.25;
    this.bubble.visible = false;
    this.bubble.renderOrder = 10;
    this.group.add(this.bubble);
    this.bubbleT = 0;
    this.reset();
  }
  reset() {
    this.wi = 0;
    this.waiting = ROUTE[0].wait * 0.5;
    this.pos.set(ROUTE[0].x, 0, ROUTE[0].z);
    this.yaw = ROUTE[0].face;
    this.group.rotation.y = this.yaw;
    this.holdT = 0;
  }
  showBubble(sym, dur = 2) {
    this.bubble.material.map = this.bubbleTex[sym] || this.bubbleTex['!'];
    this.bubble.material.needsUpdate = true;
    this.bubble.visible = true;
    this.bubbleT = dur;
  }
  hold(target, dur) {
    this.holdTarget = target ? { x: target.x, z: target.z } : null;
    this.holdT = dur;
  }
  release() {
    this.holdT = 0;
  }
  isAtPost() {
    return this.wi === 0 && this.waiting > 0;
  }
  eye() {
    return this._eye.set(this.pos.x, 1.6, this.pos.z);
  }
  canSee(point, blockers) {
    const eye = this.eye();
    const dx = point.x - eye.x, dz = point.z - eye.z;
    const hd = Math.hypot(dx, dz);
    if (hd > VIEW_RANGE) return false;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const cos = (dx * fx + dz * fz) / (hd || 1);
    if (hd > 0.8 && cos < Math.cos(FOV_HALF)) return false;
    this._dir.set(point.x - eye.x, point.y - eye.y, point.z - eye.z);
    const dist = this._dir.length();
    this._dir.normalize();
    this.ray.set(eye, this._dir);
    this.ray.far = dist;
    const hits = this.ray.intersectObjects(blockers, false);
    return !(hits.length && hits[0].distance < dist - 0.2);
  }
  update(dt, active, blockers, susColor) {
    if (this.bubbleT > 0) {
      this.bubbleT -= dt;
      if (this.bubbleT <= 0) this.bubble.visible = false;
    }
    if (active) {
      if (this.holdT > 0) {
        this.holdT -= dt;
        if (this.holdTarget) this.yaw = lerpAngle(this.yaw, Math.atan2(this.holdTarget.x - this.pos.x, this.holdTarget.z - this.pos.z), 1 - Math.exp(-dt * 8));
        this.speed = 0;
      } else if (this.waiting > 0) {
        const wp = ROUTE[this.wi];
        this.waiting -= dt;
        if (wp.face !== undefined) this.yaw = lerpAngle(this.yaw, wp.face, 1 - Math.exp(-dt * 4));
        this.speed = 0;
        if (this.waiting <= 0) this.wi = (this.wi + 1) % ROUTE.length;
      } else {
        const wp = ROUTE[this.wi];
        const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        const sp = 1.35;
        if (d < 0.06) {
          if (wp.wait) this.waiting = wp.wait;
          else this.wi = (this.wi + 1) % ROUTE.length;
          this.speed = 0;
        } else {
          const step = Math.min(d, sp * dt);
          this.pos.x += (dx / d) * step;
          this.pos.z += (dz / d) * step;
          this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 8));
          this.speed = sp;
        }
      }
    } else {
      this.speed = 0;
    }
    this.group.rotation.y = this.yaw;
    this.h.animate(dt, this.speed);
    if (susColor) this.coneMat.color.set(susColor);
    if (++this.coneTick % 2 === 0 || !active) this.updateCone(blockers);
  }
  updateCone(blockers) {
    const o = new THREE.Vector3(this.pos.x, 1.0, this.pos.z);
    const p = this.conePos;
    p[0] = this.pos.x;
    p[1] = 0.035;
    p[2] = this.pos.z;
    for (let i = 0; i <= this.rays; i++) {
      const a = this.yaw - FOV_HALF + (2 * FOV_HALF * i) / this.rays;
      this._dir.set(Math.sin(a), 0, Math.cos(a));
      this.ray.set(o, this._dir);
      this.ray.far = VIEW_RANGE;
      const hits = this.ray.intersectObjects(blockers, false);
      const len = hits.length ? hits[0].distance : VIEW_RANGE;
      p[(i + 1) * 3] = this.pos.x + this._dir.x * len;
      p[(i + 1) * 3 + 1] = 0.035;
      p[(i + 1) * 3 + 2] = this.pos.z + this._dir.z * len;
    }
    this.cone.geometry.attributes.position.needsUpdate = true;
  }
  setVisible(v) {
    this.group.visible = v;
    this.cone.visible = v;
  }
}
