import * as THREE from 'three';

const cache = new Map();

// 材质缓存：同色同参数的材质只创建一次
export function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
    cache.set(key, m);
  }
  return m;
}

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cone: new THREE.ConeGeometry(0.5, 1, 14),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  plane: new THREE.PlaneGeometry(1, 1),
};

export function canvasTexture(size, draw, { repeat = true, w, h } = {}) {
  const c = document.createElement('canvas');
  c.width = w || size;
  c.height = h || size;
  const ctx = c.getContext('2d');
  draw(ctx, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function textTexture(text, { w = 512, h = 128, bg = '#1d2b38', fg = '#ffffff', font = 'bold 60px "PingFang SC","Microsoft YaHei",sans-serif', border = null } = {}) {
  return canvasTexture(0, (ctx, W, H) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (border) {
      ctx.strokeStyle = border;
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, W - 12, H - 12);
    }
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, H / 2 + 4);
  }, { repeat: false, w, h });
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  glowTex = canvasTexture(64, (ctx, S) => {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }, { repeat: false });
  return glowTex;
}

export function bubbleTexture(symbol, color) {
  return canvasTexture(128, (ctx, S) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2 - 6, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(S / 2 - 12, S / 2 + 36);
    ctx.lineTo(S / 2, S - 6);
    ctx.lineTo(S / 2 + 12, S / 2 + 36);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, S / 2, S / 2 - 2);
  }, { repeat: false });
}
