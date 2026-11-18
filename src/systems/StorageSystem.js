import { ITEMS } from '../data/items.js';

// 随身空间：容量以升为单位（100 m³ = 100000 L）
export class StorageSystem {
  constructor(game) {
    this.game = game;
  }
  get s() {
    return this.game.state;
  }
  get unlocked() {
    return !!this.s.bracelet;
  }
  capacity() {
    return this.s.capacity;
  }
  used() {
    let v = 0;
    for (const [id, q] of Object.entries(this.s.storage)) v += (ITEMS[id]?.vol || 0) * q;
    return v;
  }
  free() {
    return Math.max(0, this.capacity() - this.used());
  }
  totalCount() {
    let n = 0;
    for (const q of Object.values(this.s.storage)) n += q;
    return n;
  }
  count(id) {
    return this.s.storage[id] || 0;
  }
  // 按剩余容量尽量放入，返回实际放入与剩余。
  addItems(items) {
    let free = this.free();
    const added = {};
    const left = {};
    for (const [id, qRaw] of Object.entries(items)) {
      const it = ITEMS[id];
      const q = Math.floor(qRaw);
      if (!it || !(q > 0)) continue;
      const fit = it.vol > 0 ? Math.min(q, Math.floor(free / it.vol)) : q;
      if (fit > 0) {
        this.s.storage[id] = (this.s.storage[id] || 0) + fit;
        free -= fit * it.vol;
        added[id] = fit;
      }
      if (q - fit > 0) left[id] = q - fit;
    }
    if (Object.keys(added).length) this.game.bus.emit('storage:changed');
    return { added, left };
  }
  remove(id, qty) {
    const have = this.s.storage[id] || 0;
    const n = Math.min(have, Math.max(0, Math.floor(qty)));
    if (n <= 0) return 0;
    if (have - n === 0) delete this.s.storage[id];
    else this.s.storage[id] = have - n;
    this.game.bus.emit('storage:changed');
    return n;
  }
}
