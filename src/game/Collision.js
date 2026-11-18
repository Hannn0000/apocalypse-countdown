// 圆形（角色）与轴对齐矩形（墙体/家具）的 XZ 平面碰撞
export function resolveCircle(p, r, boxes) {
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    for (const b of boxes) {
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      const dx = p.x - cx;
      const dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      any = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        p.x += dx * push;
        p.z += dz * push;
      } else {
        const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bo = b.maxZ - p.z;
        const m = Math.min(l, rr, t, bo);
        if (m === l) p.x = b.minX - r;
        else if (m === rr) p.x = b.maxX + r;
        else if (m === t) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
    }
    if (!any) break;
  }
}

export function pointBlocked(x, z, r, boxes) {
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}
