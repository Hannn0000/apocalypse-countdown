import { el, esc } from './dom.js';
import { ITEMS, formatVolume, formatMoney, CATEGORIES } from '../data/items.js';
import { formatCountdown } from '../systems/TimeSystem.js';
import { suspicionLevel } from '../game/NPC.js';

// 全屏界面：主菜单、暂停、确认框、快递面板、总结、来电、转场
export class Screens {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.stack = [];
    this.fadeEl = el('div', 'fade-overlay');
    this.flashEl = el('div', 'flash-overlay');
    this.bigEl = el('div', 'big-text');
    this.lbTop = el('div', 'letterbox top');
    this.lbBot = el('div', 'letterbox bottom');
    this.skipBtn = el('button', 'skip-btn hidden', '跳过 ⏭');
    this.modalLayer = el('div', 'modal-layer');
    this.menuEl = el('div', 'main-menu hidden');
    this.pauseEl = el('div', 'pause-menu hidden');
    this.countdownEl = el('div', 'big-countdown hidden');
    this.timeEl = el('div', 'time-pass hidden');
    root.append(this.lbTop, this.lbBot, this.bigEl, this.countdownEl, this.timeEl, this.modalLayer, this.pauseEl, this.menuEl, this.flashEl, this.fadeEl, this.skipBtn);
    this.skipBtn.addEventListener('click', () => this.onSkip?.());
  }
  get modalOpen() {
    return this.stack.length > 0;
  }

  // ---------- 转场 ----------
  fade(toBlack, ms = 600) {
    return new Promise((res) => {
      this.fadeEl.style.transition = ms ? `opacity ${ms}ms ease` : 'none';
      this.fadeEl.style.pointerEvents = toBlack ? 'auto' : 'none';
      setTimeout(() => {
        this.fadeEl.style.opacity = toBlack ? '1' : '0';
        setTimeout(res, ms + 30);
      }, 20);
    });
  }
  flash(color = 'rgba(80,255,240,0.6)', ms = 700) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = '1';
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.flashEl.style.transition = `opacity ${ms}ms ease-out`;
        this.flashEl.style.opacity = '0';
      }),
    );
  }
  bigText(text, color = 'white') {
    this.bigEl.className = `big-text show c-${color}`;
    this.bigEl.textContent = text;
  }
  hideBigText() {
    this.bigEl.className = 'big-text';
  }
  letterbox(on) {
    this.lbTop.classList.toggle('on', on);
    this.lbBot.classList.toggle('on', on);
  }
  showSkip(fn) {
    this.onSkip = fn;
    this.skipBtn.classList.remove('hidden');
  }
  hideSkip() {
    this.onSkip = null;
    this.skipBtn.classList.add('hidden');
  }
  async bigCountdown(text) {
    const c = this.countdownEl;
    c.innerHTML = `<div class="bc-label">距离末日降临还有</div><div class="bc-value">${esc(text)}</div>`;
    c.className = 'big-countdown';
    this.game.audio.play('heartbeat');
    await new Promise((r) => setTimeout(r, 2300));
    c.classList.add('fly');
    await new Promise((r) => setTimeout(r, 900));
    c.className = 'big-countdown hidden';
  }
  async timePass(text) {
    this.timeEl.textContent = text;
    this.timeEl.classList.remove('hidden');
    await this.fade(true, 450);
    this.timeEl.classList.add('show');
    await new Promise((r) => setTimeout(r, 1100));
    this.timeEl.classList.remove('show');
    await this.fade(false, 450);
    this.timeEl.classList.add('hidden');
  }

  // ---------- 模态框基础 ----------
  modal(cls, html, { onEscape = null, onEnter = null } = {}) {
    const wrap = el('div', 'modal-wrap');
    const card = el('div', `modal-card ${cls}`, html);
    wrap.appendChild(card);
    this.modalLayer.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('in'));
    const entry = { wrap, card, onEscape, onEnter };
    this.stack.push(entry);
    this.game.audio.play('open');
    entry.close = () => {
      const i = this.stack.indexOf(entry);
      if (i >= 0) this.stack.splice(i, 1);
      wrap.classList.remove('in');
      setTimeout(() => wrap.remove(), 200);
    };
    return entry;
  }
  handleKey(a) {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    if (a === 'escape' && top.onEscape) top.onEscape();
    if ((a === 'interact' || a === 'advance') && top.onEnter) top.onEnter();
  }
  closeAll() {
    for (const m of [...this.stack]) (m.onEscape || m.close)();
  }

  confirm(title, text, ok = '确定', cancel = '取消') {
    return new Promise((resolve) => {
      let m;
      const done = (v) => {
        m.close();
        resolve(v);
      };
      m = this.modal('confirm', `<h3>${esc(title)}</h3><p>${text}</p><div class="btn-row"><button class="btn ghost" data-v="0">${esc(cancel)}</button><button class="btn primary" data-v="1">${esc(ok)}</button></div>`, {
        onEscape: () => done(false),
        onEnter: () => done(true),
      });
      m.card.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.dataset.v === '1')));
    });
  }

  // 快递 / 物资箱内容面板
  pilePanel(pile, { locked, free, cap }) {
    const rows = Object.entries(pile.items)
      .map(([id, q]) => {
        const it = ITEMS[id];
        return `<div class="pp-row"><span class="pp-icon">${it.icon}</span><span class="pp-name">${esc(it.name)}</span><span class="pp-qty">× ${q}</span><span class="pp-vol">${formatVolume(it.vol * q)} m³</span></div>`;
      })
      .join('');
    let total = 0;
    for (const [id, q] of Object.entries(pile.items)) total += ITEMS[id].vol * q;
    const title = pile.kind === 'crate' ? '📦 物资箱' : '📦 快递包裹';
    const foot = locked
      ? `<p class="pp-note warn">东西太多了，一箱箱搬回家会引人注意……</p><div class="btn-row"><button class="btn primary" data-v="0">关闭</button></div>`
      : `<p class="pp-note">总体积 <b>${formatVolume(total)} m³</b> · 空间剩余 <b>${formatVolume(free)} / ${formatVolume(cap)} m³</b>${total > free ? '<br><span class="warn">空间不足，只能收取一部分</span>' : ''}</p>
         <p class="pp-tip">注意：保安老周巡逻时如果看到箱子凭空消失，会起疑心。</p>
         <div class="btn-row"><button class="btn ghost" data-v="0">取消</button><button class="btn magic" data-v="1">💠 收入空间</button></div>`;
    return new Promise((resolve) => {
      let m;
      const done = (v) => {
        m.close();
        resolve(v);
      };
      m = this.modal('pile-panel', `<h3>${title}</h3><div class="pp-list">${rows}</div>${foot}`, {
        onEscape: () => done(false),
        onEnter: () => done(!locked),
      });
      m.card.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.dataset.v === '1')));
    });
  }

  incomingCall(name, sub) {
    return new Promise((resolve) => {
      this.game.audio.startRing();
      let m;
      const answer = () => {
        this.game.audio.stopRing();
        m.close();
        resolve();
      };
      m = this.modal('call', `<div class="call-avatar">${esc(name[0])}</div><div class="call-name">${esc(name)}</div><div class="call-sub">${esc(sub)}</div><div class="call-status">来电中……</div><button class="btn answer">📞 接听</button>`, { onEnter: answer });
      m.card.querySelector('.answer').addEventListener('click', answer);
    });
  }

  summary(stats, timeout) {
    const g = this.game;
    const s = g.state;
    const lv = suspicionLevel(s.suspicion);
    const catRows = CATEGORIES.map((c) => `<div class="sum-cat"><span>${c}</span><b>${stats.byCat[c] || 0}</b></div>`).join('');
    const lend = { money: '给爸妈转了 ¥20,000 囤货', gather: '劝爸妈来城里会合', hint: '叮嘱爸妈多备些吃的' }[s.choices.call] || '——';
    const guard = { lie: '用“朋友搬走了”搪塞了老周', panic: '在老周面前慌张逃开', bribe: '用一包好烟稳住了老周' }[s.choices.guard] || (s.flags.avoidedGuard ? '没有被老周发现' : '——');
    return new Promise((resolve) => {
      let m;
      const done = () => {
        m.close();
        resolve();
      };
      m = this.modal(
        'summary',
        `<div class="sum-kicker">${timeout ? '【末日降临】' : '任务 7 · 未雨绸缪'}</div><h3>准备总结</h3>
        <div class="sum-grid">
          <div class="sum-stat"><span>剩余资金</span><b>${formatMoney(s.money)}</b></div>
          <div class="sum-stat"><span>已收集物资</span><b>${g.storage.totalCount()} 件</b></div>
          <div class="sum-stat"><span>空间使用</span><b>${formatVolume(g.storage.used())} / ${formatVolume(g.storage.capacity())} m³</b></div>
          <div class="sum-stat"><span>老周的怀疑度</span><b style="color:${lv.color}">${Math.round(s.suspicion)} · ${lv.label}</b></div>
        </div>
        <div class="sum-cats">${catRows}</div>
        <div class="sum-choices"><div>📞 妈妈的电话：<b>${esc(lend)}</b></div><div>👮 楼道风波：<b>${esc(guard)}</b></div><div>⏳ 剩余时间：<b>${formatCountdown(g.time.remaining())}</b></div></div>
        <div class="btn-row"><button class="btn primary">继续</button></div>`,
        { onEnter: done },
      );
      m.card.querySelector('button').addEventListener('click', done);
    });
  }

  endingChoice() {
    return new Promise((resolve) => {
      let m;
      const done = (v) => {
        m.close();
        resolve(v);
      };
      m = this.modal('ending', `<h3>第一章 · 重生之日</h3><p>感谢游玩 Version 0.1。你可以继续囤货，直到倒计时结束。</p><div class="btn-row"><button class="btn ghost" data-v="menu">返回主菜单</button><button class="btn primary" data-v="continue">继续囤货</button></div>`, {
        onEnter: () => done('continue'),
      });
      m.card.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.dataset.v)));
    });
  }

  help() {
    return new Promise((resolve) => {
      let m;
      const done = () => {
        m.close();
        resolve();
      };
      m = this.modal(
        'help',
        `<h3>操作说明</h3>
        <div class="help-grid">
          <div><b>W A S D</b><span>移动（Shift 奔跑）</span></div>
          <div><b>鼠标</b><span>点击画面后移动鼠标 / 按住拖动 旋转视角，滚轮缩放</span></div>
          <div><b>E</b><span>互动</span></div>
          <div><b>Tab</b><span>打开 / 关闭手机</span></div>
          <div><b>I</b><span>打开随身空间</span></div>
          <div><b>Esc</b><span>关闭界面 / 暂停</span></div>
          <div><b>空格 / 回车</b><span>继续对话；数字键选择选项</span></div>
          <div><b>手机触屏</b><span>左侧摇杆移动，右侧滑动转视角，按钮互动</span></div>
        </div>
        <p class="help-tip">提示：打开手机和对话时时间暂停；下单、等待和睡觉会消耗时间。保安老周的视野会显示在地面上——别让他看见箱子凭空消失。</p>
        <div class="btn-row"><button class="btn primary">知道了</button></div>`,
        { onEscape: done, onEnter: done },
      );
      m.card.querySelector('button').addEventListener('click', done);
    });
  }

  // ---------- 主菜单 ----------
  showMainMenu({ hasSave, onNew, onContinue, onReset }) {
    const m = this.menuEl;
    m.innerHTML = `
      <div class="menu-inner">
        <div class="menu-kicker">APOCALYPSE COUNTDOWN · v0.1</div>
        <h1 class="menu-title">末日倒计时<span>重生囤货</span></h1>
        <p class="menu-sub">前世，你被神秘组织抓去当实验体，<br>最终启动基地自毁程序，与它同归于尽。<br>这一次，你回到了末日降临的三天前。</p>
        <div class="menu-btns">
          <button class="btn primary big" data-a="new">新游戏</button>
          <button class="btn big" data-a="continue" ${hasSave ? '' : 'disabled'}>继续游戏</button>
          <button class="btn ghost" data-a="help">操作说明</button>
          <button class="btn ghost danger" data-a="reset" ${hasSave ? '' : 'disabled'}>重置存档</button>
        </div>
        <div class="menu-foot">支持键盘鼠标与手机触屏 · 进度自动保存在本机浏览器</div>
      </div>`;
    m.classList.remove('hidden');
    m.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', async () => {
        this.game.audio.ensure();
        this.game.audio.play('click');
        const a = b.dataset.a;
        if (a === 'new') {
          if (hasSave && !(await this.confirm('开始新游戏？', '当前存档将被覆盖。', '开始', '取消'))) return;
          onNew();
        } else if (a === 'continue') onContinue();
        else if (a === 'help') this.help();
        else if (a === 'reset') {
          if (await this.confirm('重置存档？', '所有进度都将被删除，且无法恢复。', '删除', '取消')) onReset();
        }
      }),
    );
  }
  hideMainMenu() {
    this.menuEl.classList.add('hidden');
  }

  showPause({ onResume, onSave, onMenu }) {
    const p = this.pauseEl;
    p.innerHTML = `<div class="pause-card"><h2>暂停</h2>
      <button class="btn primary" data-a="resume">继续游戏</button>
      <button class="btn" data-a="save">保存游戏</button>
      <button class="btn" data-a="help">操作说明</button>
      <button class="btn" data-a="mute">${this.game.audio.muted ? '🔇 开启声音' : '🔊 关闭声音'}</button>
      <button class="btn ghost" data-a="menu">保存并返回主菜单</button></div>`;
    p.classList.remove('hidden');
    p.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        this.game.audio.play('click');
        if (a === 'resume') onResume();
        else if (a === 'save') onSave();
        else if (a === 'help') this.help();
        else if (a === 'mute') {
          this.game.audio.muted = !this.game.audio.muted;
          b.textContent = this.game.audio.muted ? '🔇 开启声音' : '🔊 关闭声音';
        } else if (a === 'menu') onMenu();
      }),
    );
  }
  hidePause() {
    this.pauseEl.classList.add('hidden');
  }
}
