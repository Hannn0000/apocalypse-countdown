import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 第三人称跟随相机，带墙体遮挡检测
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI * 0.5;
    this.pitch = 0.62;
    this.dist = 5.0;
    this.curDist = 5.0;
    this.override = null;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
    this._dir = new THREE.Vector3();
    this._des = new THREE.Vector3();
    this.initialized = false;
  }
  rotate(dx, dy) {
    this.yaw -= dx * 0.0048;
    this.pitch = clamp(this.pitch + dy * 0.0036, 0.12, 1.25);
  }
  zoom(d) {
    this.dist = clamp(this.dist + d, 2.4, 8);
  }
  snap() {
    this.initialized = false;
  }
  update(dt, focus, blockers) {
    let desPos, desLook;
    if (this.override) {
      desPos = this.override.pos;
      desLook = this.override.look;
    } else {
      const cp = Math.cos(this.pitch);
      this._dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
      this.ray.set(focus, this._dir);
      this.ray.far = this.dist + 0.3;
      const hits = this.ray.intersectObjects(blockers, false);
      let d = this.dist;
      if (hits.length && hits[0].distance < this.dist + 0.3) d = Math.max(0.7, hits[0].distance - 0.3);
      this.curDist = d < this.curDist ? d : this.curDist + (d - this.curDist) * (1 - Math.exp(-dt * 3));
      desPos = this._des.copy(focus).addScaledVector(this._dir, this.curDist);
      desLook = focus;
    }
    if (!this.initialized) {
      this.pos.copy(desPos);
      this.look.copy(desLook);
      this.initialized = true;
    } else {
      const speed = this.override ? this.override.speed || 3 : 16;
      const k = 1 - Math.exp(-dt * speed);
      this.pos.lerp(desPos, k);
      this.look.lerp(desLook, k);
    }
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
