import { el, esc } from './dom.js';
import { ITEMS, CATEGORIES, CATEGORY_COLORS, formatVolume } from '../data/items.js';

export class InventoryUI {
  constructor(root, game) {
    this.game = game;
    this.el = el('div', 'inv-wrap hidden');
    root.appendChild(this.el);
    this.isOpen = false;
    this.cat = '全部';
    this.sel = null;
    this.qty = 1;
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) return this.close();
      const a = e.target.closest('[data-act]');
      if (a && !a.disabled) this.onAct(a.dataset.act);
    });
    this.el.addEventListener('change', (e) => {
      if (e.target.matches('.wd-input')) {
        this.qty = Math.max(1, Math.floor(Number(e.target.value) || 1));
        this.render();
      }
    });
  }
  open() {
    this.isOpen = true;
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('in'));
    this.game.audio.play('magic');
    this.render();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('in');
    this.game.audio.play('close');
    setTimeout(() => !this.isOpen && this.el.classList.add('hidden'), 220);
  }
  onAct(act) {
    const [a, b] = act.split(':');
    const g = this.game;
    if (a === 'cat') {
      this.cat = b;
      g.audio.play('click');
    } else if (a === 'sel') {
      this.sel = b;
      this.qty = 1;
      g.audio.play('click');
    } else if (a === 'q') {
      const have = g.storage.count(this.sel);
      this.qty = Math.max(1, Math.min(have, this.qty + Number(b)));
    } else if (a === 'qall') {
      this.qty = g.storage.count(this.sel);
    } else if (a === 'withdraw') {
      const id = this.sel;
      const n = Math.min(this.qty, g.storage.count(id));
      if (n > 0) {
        this.close();
        g.withdrawItem(id, n);
      }
      return;
    } else if (a === 'close') return this.close();
    this.render();
  }
  render() {
    const g = this.game, s = g.state;
    const used = g.storage.used(), cap = g.storage.capacity();
    const pct = Math.min(100, (used / cap) * 100);
    const entries = Object.entries(s.storage).filter(([id]) => ITEMS[id]);
    const counts = {};
    for (const [id, q] of entries) counts[ITEMS[id].cat] = (counts[ITEMS[id].cat] || 0) + q;
    const shown = entries.filter(([id]) => this.cat === '全部' || ITEMS[id].cat === this.cat);
    if (this.sel && !s.storage[this.sel]) this.sel = null;
    const tabs = ['全部', ...CATEGORIES]
      .map((c) => `<button class="${this.cat === c ? 'on' : ''}" data-act="cat:${c}">${c}${c === '全部' ? '' : `<i>${counts[c] || 0}</i>`}</button>`)
      .join('');
    const grid = shown.length
      ? shown
          .map(([id, q]) => {
            const it = ITEMS[id];
            return `<button class="inv-slot ${this.sel === id ? 'sel' : ''}" data-act="sel:${id}" style="--c:${CATEGORY_COLORS[it.cat]}"><span class="is-icon">${it.icon}</span><span class="is-name">${esc(it.short)}</span><span class="is-qty">×${q}</span><span class="is-vol">${formatVolume(it.vol * q)} m³</span></button>`;
          })
          .join('')
      : `<div class="inv-empty">${entries.length ? '这个分类里还没有物资' : '空间里空空如也。<br>去网购物资，然后用手镯把快递收进来吧！'}</div>`;
    let detail = `<div class="inv-detail empty"><div class="id-hint">选择一件物资查看详情</div></div>`;
    if (this.sel) {
      const it = ITEMS[this.sel], q = s.storage[this.sel];
      this.qty = Math.max(1, Math.min(q, this.qty));
      detail = `<div class="inv-detail">
        <div class="id-icon">${it.icon}</div><div class="id-name">${esc(it.name)}</div>
        <div class="id-cat" style="color:${CATEGORY_COLORS[it.cat]}">${it.cat}</div>
        <p class="id-desc">${esc(it.desc)}</p>
        <div class="id-stats"><div><span>数量</span><b>${q} ${it.unit}</b></div><div><span>单件体积</span><b>${formatVolume(it.vol)} m³</b></div><div><span>总占用</span><b>${formatVolume(it.vol * q)} m³</b></div></div>
        ${it.cat === '食物' ? '<p class="id-fresh">❄ 空间内时间静止，食物永不变质</p>' : ''}
        <div class="wd"><span>取出数量</span><div class="stepper"><button data-act="q:-1">−</button><input class="wd-input" type="number" min="1" max="${q}" value="${this.qty}"/><button data-act="q:1">+</button></div><button class="btn sm ghost" data-act="qall">全部</button></div>
        <button class="btn block" data-act="withdraw">📦 取出到现实世界</button>
      </div>`;
    }
    this.el.innerHTML = `<div class="inv">
      <div class="inv-head"><div><div class="inv-title">💠 随身空间</div><div class="inv-sub">滴血认主 · 与你心意相通</div></div>
        <div class="inv-cap"><div class="cap-row"><span>已用空间</span><b>${formatVolume(used)} / ${formatVolume(cap)} m³</b></div><div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div><small>剩余 ${formatVolume(cap - used)} m³ · 共 ${g.storage.totalCount()} 件物资</small></div>
        <button class="inv-x" data-act="close">✕</button></div>
      <div class="inv-tabs">${tabs}</div>
      <div class="inv-body"><div class="inv-grid">${grid}</div>${detail}</div>
    </div>`;
  }
}
