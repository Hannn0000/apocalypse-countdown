import * as THREE from 'three';
import { mat } from './materials.js';
import { ITEMS, CATEGORY_COLORS } from '../data/items.js';

const BOX = new THREE.BoxGeometry(0.5, 0.36, 0.46);
const TAPE = new THREE.BoxGeometry(0.1, 0.012, 0.47);
const CRATE = new THREE.BoxGeometry(0.46, 0.4, 0.46);
const cardboard = () => mat('#c79a62', { roughness: 0.95 });
const crateMat = () => mat('#8a6a46', { roughness: 0.9 });

// 快递堆 / 取出的物资箱：同类物品合并为几个箱子，而不是成百上千个模型
export class PileManager {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.meshes = new Map();
    this.glowMat = new THREE.MeshStandardMaterial({ color: '#c8fff8', emissive: '#3ff5e0', emissiveIntensity: 0, roughness: 0.6 });
  }
  clear() {
    for (const g of this.meshes.values()) this.root.remove(g);
    this.meshes.clear();
  }
  build(pile) {
    const g = new THREE.Group();
    g.position.set(pile.x, 0, pile.z);
    const entries = Object.entries(pile.items).slice(0, 4);
    const crate = pile.kind === 'crate';
    entries.forEach(([id, q], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const stack = Math.min(crate ? 3 : 4, Math.max(1, Math.ceil(Math.log2(q + 1))));
      const ox = entries.length > 1 ? (col - 0.5) * 0.55 : 0;
      const oz = entries.length > 2 ? (row - 0.5) * 0.52 : 0;
      for (let k = 0; k < stack; k++) {
        const m = new THREE.Mesh(crate ? CRATE : BOX, crate ? crateMat() : cardboard());
        const h = crate ? 0.4 : 0.36;
        m.position.set(ox + (k % 2 ? 0.03 : -0.02), h / 2 + k * h, oz + (k % 3) * 0.015);
        m.rotation.y = ((i * 7 + k * 13) % 10) * 0.025 - 0.12;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        if (k === stack - 1) {
          const tape = new THREE.Mesh(TAPE, mat(crate ? '#3ff5e0' : CATEGORY_COLORS[ITEMS[id]?.cat] || '#ddd'));
          tape.position.set(m.position.x, m.position.y + h / 2 + 0.006, m.position.z);
          tape.rotation.y = m.rotation.y;
          g.add(tape);
        }
      }
    });
    g.userData.pileId = pile.id;
    return g;
  }
  add(pile, { animate = false } = {}) {
    if (this.meshes.has(pile.id)) this.root.remove(this.meshes.get(pile.id));
    const g = this.build(pile);
    this.meshes.set(pile.id, g);
    this.root.add(g);
    if (animate) {
      g.scale.setScalar(0.01);
      const fx = this.game.effects;
      fx.emit(new THREE.Vector3(pile.x, 0.5, pile.z), 40, { color: '#5ff5e8', speed: 1.2, up: 1.2, life: 1, spread: 0.4 });
      fx.tween(0.6, (k) => g.scale.setScalar(0.01 + 0.99 * (1 - (1 - k) ** 3)));
    }
  }
  rebuild(pile) {
    this.add(pile);
  }
  colliders() {
    const out = [];
    for (const p of this.game.state.piles) {
      const r = p.kind === 'crate' ? 0.28 : 0.55;
      out.push({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r });
    }
    return out;
  }
  // 收取动画：发光 → 粒子飞向手腕 → 缩小消失
  async playCollect(pile, removed) {
    const g = this.meshes.get(pile.id);
    if (!g) return;
    const fx = this.game.effects;
    const target = this.game.player.wristWorld();
    const center = new THREE.Vector3(pile.x, 0.6, pile.z);
    const glow = this.glowMat.clone();
    const originals = [];
    g.traverse((m) => {
      if (m.isMesh) {
        originals.push([m, m.material]);
        m.material = glow;
      }
    });
    fx.emit(center, 50, { color: '#7ffff0', speed: 0.8, up: 0.8, life: 0.9, spread: 0.6 });
    await fx.tween(0.45, (k) => {
      glow.emissiveIntensity = k * 2.2;
    });
    fx.emit(center, 90, { color: '#3ff5e0', speed: 1.5, up: 1.4, life: 1.4, spread: 0.5, target, attract: 9 });
    await fx.tween(0.75, (k) => {
      const e = 1 - (1 - k) ** 2;
      g.scale.setScalar(Math.max(0.001, 1 - e));
      g.position.y = e * 0.6;
      g.rotation.y = e * 2.5;
      glow.emissiveIntensity = 2.2 + e * 2;
    });
    fx.emit(target, 30, { color: '#ffffff', speed: 0.6, up: 0.3, life: 0.5, spread: 0.1 });
    this.root.remove(g);
    this.meshes.delete(pile.id);
    glow.dispose();
    if (!removed) {
      const still = this.game.state.piles.find((p) => p.id === pile.id);
      if (still) this.add(still, { animate: true });
    }
  }
  update() {}
}
