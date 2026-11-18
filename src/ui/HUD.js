import { el, esc } from './dom.js';
import { formatCountdown } from '../systems/TimeSystem.js';
import { formatMoney, formatVolume } from '../data/items.js';
import { suspicionLevel } from '../game/NPC.js';

export class HUD {
  constructor(root, game) {
    this.game = game;
    this.el = el('div', 'hud hidden');
    this.el.innerHTML = `
      <div class="hud-quest">
        <div class="q-label">当前任务</div>
        <div class="q-title"></div>
        <ul class="q-obj"></ul>
        <div class="q-hint"></div>
      </div>
      <div class="hud-right">
        <div class="hud-time">
          <div class="cd-label">距离末日降临</div>
          <div class="cd-value"></div>
          <div class="cd-clock"></div>
        </div>
        <div class="hud-money"><span class="m-icon">¥</span><span class="m-val"></span></div>
        <div class="hud-cap hidden">
          <div class="cap-row"><span>💠 随身空间</span><span class="cap-val"></span></div>
          <div class="bar"><div class="bar-fill cap-fill"></div></div>
        </div>
        <div class="hud-sus hidden">
          <div class="cap-row"><span>👮 老周的怀疑</span><span class="sus-lvl"></span></div>
          <div class="bar"><div class="bar-fill sus-fill"></div></div>
        </div>
      </div>
      <div class="prompt hidden"><span class="key">E</span><span class="prompt-text"></span></div>
      <div class="hud-keys">
        <button data-a="phone"><b>Tab</b>手机</button>
        <button data-a="storage"><b>I</b>空间</button>
        <button data-a="escape"><b>Esc</b>菜单</button>
      </div>`;
    root.appendChild(this.el);
    this.q = {
      title: this.el.querySelector('.q-title'),
      obj: this.el.querySelector('.q-obj'),
      hint: this.el.querySelector('.q-hint'),
      box: this.el.querySelector('.hud-quest'),
    };
    this.cd = this.el.querySelector('.cd-value');
    this.clock = this.el.querySelector('.cd-clock');
    this.money = this.el.querySelector('.m-val');
    this.moneyBox = this.el.querySelector('.hud-money');
    this.cap = this.el.querySelector('.hud-cap');
    this.capVal = this.el.querySelector('.cap-val');
    this.capFill = this.el.querySelector('.cap-fill');
    this.sus = this.el.querySelector('.hud-sus');
    this.susLvl = this.el.querySelector('.sus-lvl');
    this.susFill = this.el.querySelector('.sus-fill');
    this.promptEl = this.el.querySelector('.prompt');
    this.promptText = this.el.querySelector('.prompt-text');
    this.promptEl.addEventListener('click', () => game.onAction('interact'));
    this.el.querySelectorAll('.hud-keys button').forEach((b) => b.addEventListener('click', () => game.onAction(b.dataset.a)));
    this.acc = 1;
    this.lastQuestKey = '';
    game.bus.on('money:changed', (d) => {
      this.moneyBox.classList.remove('up', 'down');
      void this.moneyBox.offsetWidth;
      this.moneyBox.classList.add(d > 0 ? 'up' : 'down');
    });
  }
  setVisible(v) {
    this.el.classList.toggle('hidden', !v);
  }
  prompt(text) {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    this.promptText.textContent = text;
    this.promptEl.classList.remove('hidden');
  }
  update(dt, force = false) {
    this.acc += dt;
    if (this.acc < 0.12 && !force) return;
    this.acc = 0;
    const g = this.game, s = g.state;
    const rem = g.time.remaining();
    this.cd.textContent = formatCountdown(rem);
    this.cd.classList.toggle('urgent', rem < 12 * 60);
    this.clock.textContent = g.time.dateLabel();
    this.money.textContent = formatMoney(s.money).slice(1);
    if (s.bracelet) {
      this.cap.classList.remove('hidden');
      const used = g.storage.used(), cap = g.storage.capacity();
      this.capVal.textContent = `${formatVolume(used)} / ${formatVolume(cap)} m³`;
      this.capFill.style.width = Math.min(100, (used / cap) * 100) + '%';
    } else this.cap.classList.add('hidden');
    const showSus = s.suspicion > 0 || g.playerInCorridor();
    this.sus.classList.toggle('hidden', !showSus);
    if (showSus) {
      const lv = suspicionLevel(s.suspicion);
      this.susLvl.textContent = `${Math.round(s.suspicion)} · ${lv.label}`;
      this.susLvl.style.color = lv.color;
      this.susFill.style.width = s.suspicion + '%';
      this.susFill.style.background = lv.color;
    }
    // 任务
    const q = g.quests.current();
    const key = q ? q.id + q.objectives.map((o) => (o.done(s) ? 1 : 0) + (o.progress ? o.progress(s) : '')).join('') : 'done' + (s.flags.chapterDone ? 1 : 0);
    if (key !== this.lastQuestKey) {
      const changed = this.lastQuestKey !== '';
      this.lastQuestKey = key;
      if (!q) {
        this.q.title.textContent = s.flags.chapterDone ? '第一章 完成' : '……';
        this.q.obj.innerHTML = `<li class="done">继续囤货，迎接末日</li>`;
        this.q.hint.textContent = '自由准备：继续购买、收取物资';
      } else {
        this.q.title.textContent = q.title;
        this.q.obj.innerHTML = q.objectives
          .map((o) => `<li class="${o.done(s) ? 'done' : ''}">${esc(o.text)}${o.progress && !o.done(s) ? ` <em>${o.progress(s)}</em>` : ''}</li>`)
          .join('');
        this.q.hint.textContent = q.hint;
      }
      if (changed) {
        this.q.box.classList.remove('pulse');
        void this.q.box.offsetWidth;
        this.q.box.classList.add('pulse');
      }
    }
  }
}
