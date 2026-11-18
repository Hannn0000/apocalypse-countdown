import { ITEMS } from '../data/items.js';
import { TOTAL_MINUTES } from './TimeSystem.js';

export const SAVE_KEY = 'apocalypse-countdown-save';
export const SAVE_VERSION = 1;

export function createDefaultState() {
  return {
    version: SAVE_VERSION,
    savedAt: 0,
    player: { x: -6.0, z: -2.6, rot: Math.PI * 0.5 },
    money: 10000,
    loans: { l30: false, l50: false },
    stocksSold: false,
    transactions: [{ t: 0, desc: '账户余额', amount: 10000 }],
    time: { elapsed: 1 },
    bracelet: false,
    storage: {},
    capacity: 100000,
    orders: [],
    piles: [],
    nextId: 1,
    suspicion: 0,
    flags: {},
    choices: {},
    quest: { index: 0 },
    stats: { shopItemsBought: 0, spent: 0, collected: 0 },
    messages: [],
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);

function merge(def, val) {
  if (!isObj(def)) return val === undefined || typeof val !== typeof def || Array.isArray(def) !== Array.isArray(val) ? def : val;
  const out = {};
  const src = isObj(val) ? val : {};
  for (const k of Object.keys(def)) out[k] = merge(def[k], src[k]);
  // 保留默认结构外的键（如 flags、choices 中的条目）
  for (const k of Object.keys(src)) if (!(k in out)) out[k] = src[k];
  return out;
}

function cleanItemMap(m) {
  const out = {};
  if (!isObj(m)) return out;
  for (const [id, q] of Object.entries(m)) {
    const n = Math.floor(Number(q));
    if (ITEMS[id] && Number.isFinite(n) && n > 0) out[id] = Math.min(n, 999999);
  }
  return out;
}

export function sanitize(raw) {
  if (!isObj(raw) || raw.version !== SAVE_VERSION) return null;
  const s = merge(createDefaultState(), raw);
  s.money = Math.round(num(s.money, 10000, 0, 1e9));
  s.player.x = num(s.player.x, -6);
  s.player.z = num(s.player.z, -2.6);
  s.player.rot = num(s.player.rot, 0);
  s.time.elapsed = num(s.time.elapsed, 1, 0, TOTAL_MINUTES);
  s.capacity = num(s.capacity, 100000, 1000, 1e7);
  s.suspicion = num(s.suspicion, 0, 0, 100);
  s.quest.index = Math.floor(num(s.quest.index, 0, 0, 7));
  s.nextId = Math.floor(num(s.nextId, 1, 1));
  s.bracelet = !!s.bracelet;
  s.stocksSold = !!s.stocksSold;
  s.loans = { l30: !!s.loans.l30, l50: !!s.loans.l50 };
  s.storage = cleanItemMap(s.storage);
  s.stats.shopItemsBought = Math.floor(num(s.stats.shopItemsBought, 0, 0));
  s.stats.spent = num(s.stats.spent, 0, 0);
  s.stats.collected = num(s.stats.collected, 0, 0);
  s.flags = isObj(s.flags) ? s.flags : {};
  s.choices = isObj(s.choices) ? s.choices : {};
  s.transactions = (Array.isArray(s.transactions) ? s.transactions : [])
    .filter((t) => isObj(t) && typeof t.desc === 'string' && Number.isFinite(t.amount))
    .slice(0, 60);
  s.messages = (Array.isArray(s.messages) ? s.messages : [])
    .filter((m) => isObj(m) && typeof m.text === 'string')
    .slice(-80);
  s.orders = (Array.isArray(s.orders) ? s.orders : [])
    .filter((o) => isObj(o) && ['pending', 'arrived', 'collected'].includes(o.status) && (o.type === 'shop' || o.type === 'food'))
    .map((o) => ({ ...o, id: Math.floor(num(o.id, 0)), items: cleanItemMap(o.items), arriveAt: num(o.arriveAt, 0), placedAt: num(o.placedAt, 0), total: num(o.total, 0) }));
  const seenIds = new Set();
  s.piles = (Array.isArray(s.piles) ? s.piles : [])
    .filter((p) => isObj(p) && (p.kind === 'delivery' || p.kind === 'crate'))
    .map((p) => ({
      id: Math.floor(num(p.id, 0)),
      kind: p.kind,
      items: cleanItemMap(p.items),
      x: num(p.x, 15),
      z: num(p.z, 0),
      slot: Math.floor(num(p.slot, -1, -1, 7)),
      orderIds: Array.isArray(p.orderIds) ? p.orderIds.filter(Number.isFinite) : [],
    }))
    .filter((p) => Object.keys(p.items).length && !seenIds.has(p.id) && seenIds.add(p.id));
  // nextId 必须大于所有已有 id
  let maxId = 0;
  for (const o of s.orders) maxId = Math.max(maxId, o.id);
  for (const p of s.piles) maxId = Math.max(maxId, p.id);
  s.nextId = Math.max(s.nextId, maxId + 1);
  return s;
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSave() {
  return !!loadState();
}

export function loadState() {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(SAVE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch (e) {
    console.warn('存档损坏，已忽略', e);
    return null;
  }
}

export function saveState(state) {
  const ls = storage();
  if (!ls) return false;
  try {
    state.savedAt = Date.now();
    ls.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('保存失败', e);
    return false;
  }
}

export function resetSave() {
  const ls = storage();
  try {
    ls?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
