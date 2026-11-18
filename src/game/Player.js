import * as THREE from 'three';
import { buildHuman, lerpAngle } from './Character.js';
import { resolveCircle } from './Collision.js';

export const PLAYER_RADIUS = 0.3;

export class Player {
  constructor(scene) {
    this.h = buildHuman({ shirt: '#3f7fa6', pants: '#2b2e3b', hair: '#2a1a14', longHair: true, shoes: '#e9e9e9' });
    this.group = this.h.group;
    scene.add(this.group);
    this.pos = this.group.position;
    this.yaw = 0;
    this.vel = new THREE.Vector2();
    this.speed = 0;
    this._focus = new THREE.Vector3();
    // 手腕上的手镯（觉醒后显示）
    const bMat = new THREE.MeshStandardMaterial({ color: '#7ff5e6', emissive: '#2fe0d0', emissiveIntensity: 1.4, roughness: 0.3 });
    this.wristBracelet = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), bMat);
    this.wristBracelet.rotation.x = Math.PI / 2;
    this.wristBracelet.position.y = -0.5;
    this.wristBracelet.visible = false;
    this.h.armL.pivot.add(this.wristBracelet);
    this.wristMat = bMat;
    this.t = 0;
  }
  setPosition(x, z, rot = this.yaw) {
    this.pos.set(x, 0, z);
    this.yaw = rot;
    this.group.rotation.y = rot;
    this.vel.set(0, 0);
  }
  setBracelet(v) {
    this.wristBracelet.visible = v;
  }
  faceTowards(x, z) {
    this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.group.rotation.y = this.yaw;
  }
  focus() {
    return this._focus.set(this.pos.x, 1.45, this.pos.z);
  }
  wristWorld(out = new THREE.Vector3()) {
    return this.wristBracelet.getWorldPosition(out);
  }
  forward() {
    return new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw));
  }
  update(dt, move, camYaw, colliders, running) {
    this.t += dt;
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let mx = fx * move.y + rx * move.x;
    let mz = fz * move.y + rz * move.x;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const maxSpeed = running ? 5.2 : 3.1;
    const tx = mx * maxSpeed, tz = mz * maxSpeed;
    const k = 1 - Math.exp(-dt * (len > 0.05 ? 12 : 16));
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.y += (tz - this.vel.y) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    resolveCircle(this.pos, PLAYER_RADIUS, colliders);
    this.speed = this.vel.length();
    if (len > 0.08) this.yaw = lerpAngle(this.yaw, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12));
    this.group.rotation.y = this.yaw;
    this.h.animate(dt, this.speed);
    if (this.wristBracelet.visible) this.wristMat.emissiveIntensity = 1.1 + Math.sin(this.t * 3) * 0.4;
  }
}
