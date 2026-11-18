import { ITEMS, DELIVERY_MINUTES } from '../data/items.js';

// 楼道快递暂存区的摆放位置
export const SLOTS = [
  { x: 12.9, z: -1.7 }, { x: 14.7, z: -1.7 }, { x: 16.5, z: -1.7 }, { x: 18.3, z: -1.7 },
  { x: 12.9, z: 1.7 }, { x: 14.7, z: 1.7 }, { x: 16.5, z: 1.7 }, { x: 18.3, z: 1.7 },
];

function cleanItems(cart, allowed) {
  const out = {};
  for (const [id, q] of Object.entries(cart || {})) {
    const n = Math.floor(Number(q));
    if (ITEMS[id] && n > 0 && (!allowed || allowed.includes(id))) out[id] = Math.min(n, 9999);
  }
  return out;
}

export function cartTotal(cart) {
  let t = 0;
  for (const [id, q] of Object.entries(cart)) t += (ITEMS[id]?.price || 0) * q;
  return t;
}

export class DeliverySystem {
  constructor(game) {
    this.game = game;
  }
  get s() {
    return this.game.state;
  }

  placeOrder(type, cart, allowed) {
    const items = cleanItems(cart, allowed);
    if (!Object.keys(items).length) return { ok: false, msg: '购物车是空的' };
    const total = cartTotal(items);
    if (!this.game.economy.spend(total, type === 'food' ? '外卖订单支付' : '购物订单支付')) {
      return { ok: false, msg: '余额不足，无法支付' };
    }
    const now = this.s.time.elapsed;
    const order = {
      id: this.s.nextId++,
      type,
      items,
      total,
      placedAt: now,
      arriveAt: now + DELIVERY_MINUTES[type],
      status: 'pending',
    };
    this.s.orders.push(order);
    if (type === 'shop') {
      let n = 0;
      for (const q of Object.values(items)) n += q;
      this.s.stats.shopItemsBought += n;
    }
    this.game.bus.emit('order:placed', order);
    return { ok: true, order };
  }

  pending() {
    return this.s.orders.filter((o) => o.status === 'pending');
  }

  nextArrival() {
    let best = null;
    for (const o of this.pending()) if (!best || o.arriveAt < best.arriveAt) best = o;
    return best;
  }

  update() {
    const now = this.s.time.elapsed;
    for (const o of this.s.orders) {
      if (o.status === 'pending' && now >= o.arriveAt) this.arrive(o);
    }
  }

  arrive(order) {
    order.status = 'arrived';
    const pile = this.createPile('delivery', order.items, null, order.id);
    this.s.flags.deliveryArrived = true;
    this.game.bus.emit('delivery:arrived', { order, pile });
  }

  createPile(kind, items, pos, orderId = null) {
    const s = this.s;
    if (kind === 'delivery') {
      const used = new Set(s.piles.filter((p) => p.kind === 'delivery').map((p) => p.slot));
      const slot = SLOTS.findIndex((_, i) => !used.has(i));
      if (slot < 0) {
        // 暂存区满了：合并进最早的一堆，避免生成大量模型
        const target = s.piles.find((p) => p.kind === 'delivery');
        for (const [id, q] of Object.entries(items)) target.items[id] = (target.items[id] || 0) + q;
        if (orderId != null) target.orderIds.push(orderId);
        this.game.bus.emit('pile:changed', target);
        return target;
      }
      const pile = { id: s.nextId++, kind, items: { ...items }, x: SLOTS[slot].x, z: SLOTS[slot].z, slot, orderIds: orderId != null ? [orderId] : [] };
      s.piles.push(pile);
      this.game.bus.emit('pile:added', pile);
      return pile;
    }
    const pile = { id: s.nextId++, kind: 'crate', items: { ...items }, x: pos.x, z: pos.z, slot: -1, orderIds: [] };
    s.piles.push(pile);
    this.game.bus.emit('pile:added', pile);
    return pile;
  }

  // 同步、原子地收取：先改状态再播动画，杜绝重复收取。
  collectPile(id) {
    const s = this.s;
    const idx = s.piles.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const pile = s.piles[idx];
    const res = this.game.storage.addItems(pile.items);
    const addedCount = Object.values(res.added).reduce((a, b) => a + b, 0);
    if (!addedCount) return { pile, added: {}, left: pile.items, removed: false };
    const removed = Object.keys(res.left).length === 0;
    if (removed) {
      s.piles.splice(idx, 1);
      for (const o of s.orders) if (pile.orderIds.includes(o.id)) o.status = 'collected';
    } else {
      pile.items = res.left;
    }
    s.stats.collected += addedCount;
    return { pile, added: res.added, left: res.left, removed };
  }

  withdraw(id, qty, pos) {
    const n = this.game.storage.remove(id, qty);
    if (n <= 0) return null;
    return this.createPile('crate', { [id]: n }, pos);
  }
}
