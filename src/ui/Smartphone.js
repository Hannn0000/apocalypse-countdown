import { el, esc } from './dom.js';
import { ITEMS, SHOP_ITEMS, FOOD_ITEMS, formatMoney, formatVolume } from '../data/items.js';
import { STOCKS, stockPrice } from '../systems/EconomySystem.js';
import { QUESTS } from '../systems/QuestSystem.js';
import { formatCountdown, formatDuration } from '../systems/TimeSystem.js';
import { cartTotal } from '../systems/DeliverySystem.js';

const APPS = [
  { id: 'bank', name: '银行', icon: '🏦', bg: 'linear-gradient(140deg,#ff6b5b,#c0392b)' },
  { id: 'stock', name: '股票', icon: '📈', bg: 'linear-gradient(140deg,#ff9f43,#ee5a24)' },
  { id: 'food', name: '外卖', icon: '🍱', bg: 'linear-gradient(140deg,#feca57,#f39c12)' },
  { id: 'shop', name: '购物', icon: '🛒', bg: 'linear-gradient(140deg,#ff6fb5,#d63384)' },
  { id: 'tasks', name: '任务', icon: '📋', bg: 'linear-gradient(140deg,#48dbfb,#0abde3)' },
  { id: 'messages', name: '消息', icon: '💬', bg: 'linear-gradient(140deg,#1dd1a1,#10ac84)' },
  { id: 'clock', name: '时钟', icon: '⏰', bg: 'linear-gradient(140deg,#8e9bff,#5f6bd8)' },
];

export class Smartphone {
  constructor(root, game) {
    this.game = game;
    this.el = el('div', 'phone-wrap hidden');
    this.el.innerHTML = `<div class="phone"><div class="phone-notch"></div><div class="phone-status"><span class="ps-time"></span><span class="ps-icons">📶 🔋</span></div><div class="phone-screen"></div><div class="phone-home-bar" data-act="home"></div></div>`;
    root.appendChild(this.el);
    this.screen = this.el.querySelector('.phone-screen');
    this.statusTime = this.el.querySelector('.ps-time');
    this.isOpen = false;
    this.app = null;
    this.carts = { shop: {}, food: {} };
    this.tabs = { shop: 'store', food: 'store' };
    this.modal = null;
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) return this.close();
      const a = e.target.closest('[data-act]');
      if (a && !a.disabled) this.onAct(a.dataset.act, a);
    });
    this.el.addEventListener('change', (e) => {
      const inp = e.target.closest('input[data-qty]');
      if (!inp) return;
      const [cart, id] = inp.dataset.qty.split(':');
      this.setQty(cart, id, Number(inp.value));
    });
    game.bus.on('time:advanced', () => this.isOpen && this.app === 'clock' && this.render());
  }

  open(app = null) {
    if (this.isOpen) return;
    this.isOpen = true;
    this.app = app;
    this.modal = null;
    this.el.classList.remove('hidden');
    requestAnimationFrame(() => this.el.classList.add('in'));
    this.game.audio.play('open');
    this.game.onPhoneOpened();
    if (app) this.onAppOpened(app);
    this.render();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('in');
    this.game.audio.play('close');
    setTimeout(() => !this.isOpen && this.el.classList.add('hidden'), 220);
  }
  onAppOpened(id) {
    const f = this.game.state.flags;
    if (id === 'bank') f.bankChecked = true;
    if (id === 'shop') f.shopOpened = true;
    if (id === 'messages') this.game.state.messages.forEach((m) => (m.read = true));
  }

  onAct(act, node) {
    const [a, b, c, d] = act.split(':');
    const g = this.game;
    switch (a) {
      case 'app':
        this.app = b;
        this.modal = null;
        g.audio.play('click');
        this.onAppOpened(b);
        break;
      case 'home':
        this.app = null;
        this.modal = null;
        g.audio.play('click');
        break;
      case 'tab':
        this.tabs[b] = c;
        g.audio.play('click');
        break;
      case 'loan':
        this.modal = { type: 'loan', kind: Number(b) };
        break;
      case 'loan-ok': {
        const r = g.economy.claimLoan(Number(b));
        this.modal = null;
        if (r.ok) {
          g.time.advance(15);
          g.audio.play('coin');
          g.notify.toast([`【到账】${formatMoney(r.amount)}`, Number(b) === 30 ? '个人消费贷款已发放' : '极速闪电贷已发放'], { type: 'success' });
          g.saveNow();
        } else g.notify.toast(r.msg, { type: 'warn' });
        break;
      }
      case 'sell':
        this.modal = { type: 'sell' };
        break;
      case 'sell-ok': {
        const r = g.economy.sellStocks();
        this.modal = null;
        if (r.ok) {
          g.time.advance(5);
          g.audio.play('coin');
          g.notify.toast(['【股票已清仓】', `${formatMoney(r.value)} 已转入银行账户`], { type: 'success' });
          g.saveNow();
        } else g.notify.toast(r.msg, { type: 'warn' });
        break;
      }
      case 'qty':
        this.setQty(b, c, (this.carts[b][c] || 0) + Number(d), false);
        break;
      case 'clear':
        this.carts[b] = {};
        break;
      case 'checkout':
        if (!Object.keys(this.carts[b]).length) {
          g.notify.toast('购物车是空的', { type: 'warn' });
          return;
        }
        this.modal = { type: 'pay', cart: b };
        break;
      case 'pay': {
        const r = g.placeOrder(b, this.carts[b], b === 'food' ? FOOD_ITEMS : SHOP_ITEMS);
        this.modal = null;
        if (r.ok) {
          this.carts[b] = {};
          this.tabs[b] = 'orders';
        }
        break;
      }
      case 'modal-close':
        this.modal = null;
        break;
      case 'wait':
        g.waitMinutes(Number(b)).then(() => this.render());
        return;
      case 'wait-next':
        g.waitForNextDelivery().then(() => this.render());
        return;
      case 'wait-morning':
        g.waitMinutes(g.time.minutesUntil(7)).then(() => this.render());
        return;
      case 'close':
        this.close();
        return;
      default:
        return;
    }
    this.render();
  }

  setQty(cart, id, q, rerender = true) {
    q = Math.max(0, Math.min(9999, Math.floor(Number(q) || 0)));
    if (q) this.carts[cart][id] = q;
    else delete this.carts[cart][id];
    if (rerender) this.render();
  }

  render() {
    if (!this.isOpen) return;
    const g = this.game;
    this.statusTime.textContent = g.time.clock();
    const scrollEl = this.screen.querySelector('.app-body');
    const scroll = scrollEl ? scrollEl.scrollTop : 0;
    let html = this.app ? this[`render_${this.app}`]() : this.renderHome();
    if (this.modal) html += this.renderModal();
    this.screen.innerHTML = html;
    const nb = this.screen.querySelector('.app-body');
    if (nb && this.lastApp === this.app) nb.scrollTop = scroll;
    this.lastApp = this.app;
  }

  header(title, color = '#1b2533') {
    return `<div class="app-head" style="background:${color}"><button class="app-back" data-act="home">‹</button><span>${title}</span><button class="app-x" data-act="close">✕</button></div>`;
  }

  renderHome() {
    const g = this.game, s = g.state;
    const unread = s.messages.filter((m) => !m.read).length;
    const pending = g.delivery.pending().length;
    const arrived = s.piles.filter((p) => p.kind === 'delivery').length;
    return `<div class="home">
      <div class="home-widget">
        <div class="hw-label">距离末日降临</div>
        <div class="hw-cd">${formatCountdown(g.time.remaining())}</div>
        <div class="hw-row"><span>${g.time.dateLabel()}</span><span>${formatMoney(s.money)}</span></div>
        ${pending || arrived ? `<div class="hw-deliv">🚚 配送中 ${pending} 单 · 待领取 ${arrived} 处</div>` : ''}
      </div>
      <div class="app-grid">${APPS.map(
        (a) => `<button class="app-icon" data-act="app:${a.id}"><span class="ai-img" style="background:${a.bg}">${a.icon}${a.id === 'messages' && unread ? `<i class="badge">${unread}</i>` : ''}</span><span class="ai-name">${a.name}</span></button>`,
      ).join('')}</div>
      <div class="home-tip">Tab / Esc 关闭手机 · 手机打开时时间暂停</div>
    </div>`;
  }

  render_bank() {
    const s = this.game.state;
    const loanCard = (kind, key, name, desc) => {
      const done = s.loans[key];
      return `<div class="card loan"><div><b>${name}</b><small>${desc}</small></div><button class="btn sm ${done ? 'ghost' : 'primary'}" data-act="loan:${kind}" ${done ? 'disabled' : ''}>${done ? '已领取' : '立即申请'}</button></div>`;
    };
    return `${this.header('招财银行', 'linear-gradient(90deg,#c0392b,#e74c3c)')}<div class="app-body">
      <div class="balance-card"><small>账户余额（元）</small><div class="bal">${formatMoney(s.money)}</div><small>尾号 6618 · 储蓄卡</small></div>
      <div class="sec-title">贷款服务</div>
      ${loanCard(30, 'l30', '个人消费贷 ¥30,000', '年化 12% · 分 12 期')}
      ${loanCard(50, 'l50', '极速闪电贷 ¥50,000', '秒到账 · 年化 18%')}
      <div class="sec-title">交易记录</div>
      <div class="tx-list">${s.transactions
        .map((t) => `<div class="tx"><span>${esc(t.desc)}<small>${this.game.timeLabel(t.t)}</small></span><b class="${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount >= 0 ? '+' : '−'}${formatMoney(Math.abs(t.amount))}</b></div>`)
        .join('') || '<div class="empty">暂无记录</div>'}</div>
    </div>`;
  }

  render_stock() {
    const g = this.game, s = g.state, t = s.time.elapsed;
    const rows = STOCKS.map((st, i) => {
      const p = stockPrice(i, t);
      const ch = ((p - st.base) / st.base) * 100;
      const pts = [];
      for (let k = 0; k < 16; k++) pts.push(stockPrice(i, Math.max(0, t - (15 - k) * 20)));
      const mn = Math.min(...pts), mx = Math.max(...pts);
      const poly = pts.map((v, k) => `${k * 6},${22 - ((v - mn) / (mx - mn || 1)) * 20}`).join(' ');
      const col = ch >= 0 ? '#ff5d5d' : '#2ecc71';
      return `<div class="stock-row"><div><b>${st.name}</b><small>${st.code} · ${s.stocksSold ? '0' : st.shares} 股</small></div>
        <svg viewBox="0 0 90 24" class="spark"><polyline points="${poly}" fill="none" stroke="${col}" stroke-width="1.6"/></svg>
        <div class="sp"><b>${p.toFixed(2)}</b><small style="color:${col}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</small></div></div>`;
    }).join('');
    return `${this.header('涨乐财富', 'linear-gradient(90deg,#ee5a24,#ff9f43)')}<div class="app-body">
      <div class="balance-card orange"><small>持仓总市值（元）</small><div class="bal">${formatMoney(g.economy.portfolioValue())}</div><small>${s.stocksSold ? '已全部清仓，资金已转入银行卡' : '末日之后，股票只是一串数字。'}</small></div>
      <div class="sec-title">我的持仓</div>${rows}
      <button class="btn block ${s.stocksSold ? 'ghost' : 'primary'}" data-act="sell" ${s.stocksSold ? 'disabled' : ''}>${s.stocksSold ? '已清仓' : '一键清仓卖出'}</button>
    </div>`;
  }

  renderStore(cart, ids, title, color) {
    const g = this.game, c = this.carts[cart];
    const tab = this.tabs[cart];
    const tabs = `<div class="tabs"><button class="${tab === 'store' ? 'on' : ''}" data-act="tab:${cart}:store">商品</button><button class="${tab === 'orders' ? 'on' : ''}" data-act="tab:${cart}:orders">我的订单 ${g.state.orders.filter((o) => o.type === cart && o.status !== 'collected').length || ''}</button></div>`;
    if (tab === 'orders') return `${this.header(title, color)}${tabs}<div class="app-body">${this.renderOrders(cart)}</div>`;
    const total = cartTotal(c);
    let vol = 0;
    let count = 0;
    for (const [id, q] of Object.entries(c)) {
      vol += ITEMS[id].vol * q;
      count += q;
    }
    const items = ids
      .map((id) => {
        const it = ITEMS[id];
        const q = c[id] || 0;
        return `<div class="item-row ${q ? 'sel' : ''}"><span class="ir-icon">${it.icon}</span><div class="ir-info"><b>${esc(it.name)}</b><small>${formatMoney(it.price)} · 占用 ${formatVolume(it.vol)} m³</small></div>
          <div class="stepper"><button data-act="qty:${cart}:${id}:-1">−</button><input type="number" min="0" max="9999" value="${q}" data-qty="${cart}:${id}"/><button data-act="qty:${cart}:${id}:1">+</button></div>
          <div class="quick"><button data-act="qty:${cart}:${id}:10">+10</button><button data-act="qty:${cart}:${id}:50">+50</button></div></div>`;
      })
      .join('');
    return `${this.header(title, color)}${tabs}<div class="app-body has-foot">${items}
      <p class="store-note">${cart === 'shop' ? '🚚 次日达升级为「当日急送」：约 1.5 小时送达楼道暂存区' : '🛵 外卖约 50 分钟送达楼道暂存区'}</p></div>
      <div class="cart-foot"><div><small>${count} 件 · 约 ${formatVolume(vol)} m³</small><b>${formatMoney(total)}</b></div>
      <button class="btn sm ghost" data-act="clear:${cart}" ${count ? '' : 'disabled'}>清空</button>
      <button class="btn primary" data-act="checkout:${cart}" ${count ? '' : 'disabled'}>去结算</button></div>`;
  }
  render_shop() {
    return this.renderStore('shop', SHOP_ITEMS, '速达优选', 'linear-gradient(90deg,#d63384,#ff6fb5)');
  }
  render_food() {
    return this.renderStore('food', FOOD_ITEMS, '饱了么外卖', 'linear-gradient(90deg,#f39c12,#feca57)');
  }
  renderOrders(type) {
    const g = this.game, now = g.state.time.elapsed;
    const list = g.state.orders.filter((o) => o.type === type).slice().reverse();
    if (!list.length) return '<div class="empty">还没有订单</div>';
    return list
      .map((o) => {
        const names = Object.entries(o.items).map(([id, q]) => `${ITEMS[id].icon}${ITEMS[id].short}×${q}`).join('  ');
        let st = '';
        if (o.status === 'pending') st = `<span class="st pend">配送中 · 约 ${formatDuration(o.arriveAt - now)}后送达</span><button class="btn sm" data-act="wait-next">⏩ 等待送达</button>`;
        else if (o.status === 'arrived') st = `<span class="st ok">已送达 · 请到楼道快递暂存区领取</span>`;
        else st = `<span class="st done">已领取</span>`;
        return `<div class="order"><div class="o-head"><b>订单 #${o.id}</b><span>${formatMoney(o.total)}</span></div><div class="o-items">${names}</div><div class="o-foot">${st}</div></div>`;
      })
      .join('');
  }

  render_tasks() {
    const s = this.game.state;
    const idx = s.quest.index;
    const row = (q, i) => {
      const state = i < idx ? 'done' : i === idx ? 'active' : 'locked';
      const objs = state === 'locked' ? '' : `<ul>${q.objectives.map((o) => `<li class="${o.done(s) ? 'ok' : ''}">${esc(o.text)}</li>`).join('')}</ul>`;
      return `<div class="quest ${state}"><div class="qh"><span>任务 ${i + 1}</span><b>${state === 'locked' ? '？？？' : esc(q.title)}</b><i>${state === 'done' ? '✔ 完成' : state === 'active' ? '进行中' : '未解锁'}</i></div>${objs}${state === 'active' && q.hint ? `<p class="qhint">💡 ${esc(q.hint)}</p>` : ''}</div>`;
    };
    const active = QUESTS.map((q, i) => (i >= idx ? row(q, i) : '')).join('');
    const done = QUESTS.map((q, i) => (i < idx ? row(q, i) : '')).join('');
    return `${this.header('任务', 'linear-gradient(90deg,#0abde3,#48dbfb)')}<div class="app-body"><div class="sec-title">当前任务</div>${active || '<div class="empty">第一章全部完成！</div>'}<div class="sec-title">已完成</div>${done || '<div class="empty">暂无</div>'}</div>`;
  }

  render_messages() {
    const s = this.game.state;
    const list = s.messages.slice().reverse();
    return `${this.header('消息', 'linear-gradient(90deg,#10ac84,#1dd1a1)')}<div class="app-body">${
      list
        .map((m) => `<div class="msg ${m.from === '末日生存系统' ? 'sys' : ''}"><div class="mh"><b>${esc(m.from)}</b><small>${this.game.timeLabel(m.t)}</small></div><div class="mt">${esc(m.text).replace(/\n/g, '<br>')}</div></div>`)
        .join('') || '<div class="empty">没有消息</div>'
    }</div>`;
  }

  render_clock() {
    const g = this.game;
    const next = g.delivery.nextArrival();
    return `${this.header('时钟', 'linear-gradient(90deg,#5f6bd8,#8e9bff)')}<div class="app-body">
      <div class="clock-big">${g.time.clock()}</div><div class="clock-date">${g.time.dateLabel()}</div>
      <div class="clock-cd">距离末日降临 <b>${formatCountdown(g.time.remaining())}</b></div>
      <div class="sec-title">等待</div>
      <button class="btn block" data-act="wait:30">⏳ 等待 30 分钟</button>
      <button class="btn block" data-act="wait:120">⏳ 等待 2 小时</button>
      <button class="btn block" data-act="wait-next" ${next ? '' : 'disabled'}>🚚 等到下一个快递送达${next ? `（约 ${formatDuration(next.arriveAt - g.state.time.elapsed)}）` : '（暂无配送）'}</button>
      <p class="store-note">时间是最宝贵的资源。等待会推进末日倒计时。</p>
    </div>`;
  }

  renderModal() {
    const g = this.game, m = this.modal;
    let body = '';
    if (m.type === 'loan') {
      const amt = m.kind * 1000;
      body = `<h4>确认申请贷款</h4><p>申请金额：<b>${formatMoney(amt)}</b></p><p class="muted">${m.kind === 30 ? '年化利率 12%，分 12 期偿还。' : '极速审批，年化利率 18%。'}<br>（末日之后，还有谁会来催贷款呢？）</p>
        <div class="btn-row"><button class="btn ghost" data-act="modal-close">取消</button><button class="btn primary" data-act="loan-ok:${m.kind}">确认申请</button></div>`;
    } else if (m.type === 'sell') {
      body = `<h4>一键清仓</h4><p>以当前价格卖出全部持仓，约 <b>${formatMoney(g.economy.portfolioValue())}</b> 将转入银行卡。</p><p class="muted">卖出后无法撤销。</p>
        <div class="btn-row"><button class="btn ghost" data-act="modal-close">取消</button><button class="btn primary" data-act="sell-ok">确认卖出</button></div>`;
    } else if (m.type === 'pay') {
      const c = this.carts[m.cart];
      const total = cartTotal(c);
      const lines = Object.entries(c).map(([id, q]) => `<div class="pay-line"><span>${ITEMS[id].icon} ${esc(ITEMS[id].name)} × ${q}</span><span>${formatMoney(ITEMS[id].price * q)}</span></div>`).join('');
      const enough = g.state.money >= total;
      body = `<h4>确认支付</h4><div class="pay-lines">${lines}</div><div class="pay-total"><span>合计</span><b>${formatMoney(total)}</b></div>
        <p class="muted">账户余额 ${formatMoney(g.state.money)}${enough ? '' : ' · <span class="warn">余额不足</span>'}</p>
        <div class="btn-row"><button class="btn ghost" data-act="modal-close">返回</button><button class="btn primary" data-act="pay:${m.cart}" ${enough ? '' : 'disabled'}>确认支付</button></div>`;
    }
    return `<div class="p-modal"><div class="p-modal-card">${body}</div></div>`;
  }
}
