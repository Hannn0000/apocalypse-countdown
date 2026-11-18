import * as THREE from 'three';

// 将大量静态网格按材质合并，显著减少 draw call
export class Batcher {
  constructor() {
    this.groups = new Map();
  }
  add(geo, matrix, material, flags) {
    const key = `${material.uuid}|${flags.cast ? 1 : 0}${flags.receive ? 1 : 0}${flags.block ? 1 : 0}`;
    let g = this.groups.get(key);
    if (!g) {
      g = { material, flags: { ...flags }, items: [] };
      this.groups.set(key, g);
    }
    g.items.push({ geo, matrix: matrix.clone() });
  }
  build(parent) {
    const out = [];
    for (const g of this.groups.values()) {
      const mesh = new THREE.Mesh(merge(g.items), g.material);
      mesh.castShadow = !!g.flags.cast;
      mesh.receiveShadow = !!g.flags.receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      out.push({ mesh, flags: g.flags });
    }
    this.groups.clear();
    return out;
  }
}

function merge(items) {
  const parts = items.map(({ geo, matrix }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    return g;
  });
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
    o += p.attributes.position.count;
    p.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
