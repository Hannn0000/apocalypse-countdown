import * as THREE from 'three';
import { mat } from './materials.js';

const G = {
  torso: new THREE.CapsuleGeometry(0.2, 0.32, 4, 10),
  head: new THREE.SphereGeometry(0.17, 16, 12),
  limb: new THREE.CapsuleGeometry(0.068, 0.46, 3, 8),
  leg: new THREE.CapsuleGeometry(0.085, 0.6, 3, 8),
  hand: new THREE.SphereGeometry(0.065, 8, 6),
  shoe: new THREE.BoxGeometry(0.15, 0.1, 0.27),
  hair: new THREE.SphereGeometry(0.185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
  eye: new THREE.SphereGeometry(0.022, 6, 4),
  cap: new THREE.CylinderGeometry(0.19, 0.2, 0.12, 14),
  brim: new THREE.BoxGeometry(0.3, 0.03, 0.18),
  box: new THREE.BoxGeometry(1, 1, 1),
};

// 低多边形风格的人物，面向 +Z
export function buildHuman(o = {}) {
  const c = {
    skin: '#f1c7a5', shirt: '#3d6e8f', pants: '#2e3140', shoes: '#2a2a2a', hair: '#2a1d17',
    longHair: false, cap: null, silhouette: false, ...o,
  };
  const M = (col) => (c.silhouette ? mat('#050505', { roughness: 1 }) : mat(col));
  const group = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  group.add(hips);

  const torso = new THREE.Mesh(G.torso, M(c.shirt));
  torso.scale.set(1.12, 1, 0.78);
  torso.position.y = 0.34;
  hips.add(torso);

  const neck = new THREE.Mesh(G.hand, M(c.skin));
  neck.position.y = 0.72;
  hips.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.86;
  hips.add(head);
  const headMesh = new THREE.Mesh(G.head, M(c.skin));
  head.add(headMesh);
  const hair = new THREE.Mesh(G.hair, M(c.hair));
  hair.position.set(0, 0.02, -0.015);
  hair.rotation.x = -0.25;
  head.add(hair);
  if (c.longHair) {
    const back = new THREE.Mesh(G.box, M(c.hair));
    back.scale.set(0.32, 0.36, 0.1);
    back.position.set(0, -0.12, -0.13);
    head.add(back);
  }
  if (c.cap) {
    const cap = new THREE.Mesh(G.cap, M(c.cap));
    cap.position.y = 0.14;
    head.add(cap);
    const brim = new THREE.Mesh(G.brim, M(c.cap));
    brim.position.set(0, 0.1, 0.15);
    head.add(brim);
  }
  if (!c.silhouette) {
    for (const x of [-0.06, 0.06]) {
      const e = new THREE.Mesh(G.eye, mat('#1a1a1a'));
      e.position.set(x, 0.01, 0.155);
      head.add(e);
    }
  }

  const mkArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.27 * side, 0.6, 0);
    pivot.rotation.z = 0.09 * side;
    const upper = new THREE.Mesh(G.limb, M(c.shirt));
    upper.position.y = -0.29;
    pivot.add(upper);
    const hand = new THREE.Mesh(G.hand, M(c.skin));
    hand.position.y = -0.6;
    pivot.add(hand);
    hips.add(pivot);
    return { pivot, hand };
  };
  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.11 * side, 0.02, 0);
    const leg = new THREE.Mesh(G.leg, M(c.pants));
    leg.position.y = -0.4;
    pivot.add(leg);
    const shoe = new THREE.Mesh(G.shoe, M(c.shoes));
    shoe.position.set(0, -0.86, 0.04);
    pivot.add(shoe);
    hips.add(pivot);
    return pivot;
  };
  const armL = mkArm(1);
  const armR = mkArm(-1);
  const legL = mkLeg(1);
  const legR = mkLeg(-1);

  group.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
    }
  });

  let phase = 0;
  let t = Math.random() * 10;
  const animate = (dt, speed) => {
    const amt = Math.min(1, speed / 3);
    t += dt;
    phase += dt * (3 + speed * 2.4);
    const sw = Math.sin(phase) * 0.7 * amt;
    legL.rotation.x = sw;
    legR.rotation.x = -sw;
    armL.pivot.rotation.x = -sw * 0.85;
    armR.pivot.rotation.x = sw * 0.85;
    hips.position.y = 0.92 + Math.abs(Math.cos(phase)) * 0.045 * amt;
    const breathe = Math.sin(t * 2.1) * (1 - amt);
    torso.scale.y = 1 + breathe * 0.015;
    head.position.y = 0.86 + breathe * 0.006;
    armL.pivot.rotation.z = 0.09 + breathe * 0.03;
    armR.pivot.rotation.z = -0.09 - breathe * 0.03;
  };

  return { group, hips, head, torso, armL, armR, legL, legR, animate };
}

export function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
