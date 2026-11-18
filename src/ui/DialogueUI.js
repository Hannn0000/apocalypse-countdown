import { el, esc } from './dom.js';

const SPEAKER_COLORS = { 苏然: '#7fe7ff', 老周: '#ffd166', 妈妈: '#ffb38a', 研究员: '#b8c7d6', 广播: '#ff6b6b', 新闻主播: '#9ecbff', 系统: '#3ff5e0' };

export class DialogueUI {
  constructor(root, audio) {
    this.audio = audio;
    this.el = el('div', 'dialogue hidden');
    this.el.innerHTML = `<div class="dlg-speaker"></div><div class="dlg-text"></div><div class="dlg-choices"></div><div class="dlg-next">▼</div>`;
    root.appendChild(this.el);
    this.speaker = this.el.querySelector('.dlg-speaker');
    this.text = this.el.querySelector('.dlg-text');
    this.choices = this.el.querySelector('.dlg-choices');
    this.nextEl = this.el.querySelector('.dlg-next');
    this.el.addEventListener('click', (e) => {
      if (e.target.closest('.dlg-choice')) return;
      this.advance();
    });
    this.sys = el('div', 'system-panel hidden');
    root.appendChild(this.sys);
    this.busy = false;
    this.pending = null; // { type, resolve }
    this.typing = null;
  }

  _typewrite(text) {
    clearInterval(this.typing);
    this.full = text;
    let i = 0;
    this.text.textContent = '';
    this.isTyping = true;
    this.typing = setInterval(() => {
      i += 1;
      this.text.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(this.typing);
        this.isTyping = false;
      }
    }, 28);
  }

  async say(lines, { auto = 0 } = {}) {
    this.busy = true;
    this.el.classList.remove('hidden');
    this.choices.innerHTML = '';
    for (const line of lines) {
      if (this.cancelled) break;
      const sp = line.speaker || '';
      this.speaker.textContent = sp;
      this.speaker.style.display = sp ? '' : 'none';
      this.speaker.style.color = SPEAKER_COLORS[sp] || '#fff';
      this.el.classList.toggle('narration', !sp);
      this.nextEl.style.display = '';
      this._typewrite(line.text);
      await new Promise((resolve) => {
        this.pending = { type: 'line', resolve };
        if (auto) {
          const wait = Math.max(auto, line.text.length * 90 + 1200);
          this.autoTimer = setTimeout(() => this._finishLine(), wait);
        }
      });
    }
    this._hide();
  }

  _finishLine() {
    clearTimeout(this.autoTimer);
    if (this.pending?.type === 'line') {
      const r = this.pending.resolve;
      this.pending = null;
      clearInterval(this.typing);
      this.isTyping = false;
      r();
    }
  }

  advance() {
    if (!this.pending) return;
    if (this.pending.type === 'line') {
      if (this.isTyping) {
        clearInterval(this.typing);
        this.isTyping = false;
        this.text.textContent = this.full;
        return;
      }
      this.audio.play('click');
      this._finishLine();
    } else if (this.pending.type === 'system') {
      this._closeSystem();
    }
  }

  pick(n) {
    if (this.pending?.type !== 'choice') return;
    const btn = this.choices.querySelectorAll('.dlg-choice')[n];
    if (btn && !btn.disabled) btn.click();
  }

  async choose(speaker, text, options) {
    this.busy = true;
    this.el.classList.remove('hidden');
    this.el.classList.remove('narration');
    this.speaker.textContent = speaker;
    this.speaker.style.display = speaker ? '' : 'none';
    this.speaker.style.color = SPEAKER_COLORS[speaker] || '#fff';
    clearInterval(this.typing);
    this.isTyping = false;
    this.text.textContent = text;
    this.nextEl.style.display = 'none';
    this.choices.innerHTML = options
      .map(
        (o, i) =>
          `<button class="dlg-choice" data-i="${i}" ${o.disabled ? 'disabled' : ''}><span class="num">${i + 1}</span>${esc(o.text)}${o.note ? `<em>${esc(o.note)}</em>` : ''}</button>`,
      )
      .join('');
    const idx = await new Promise((resolve) => {
      this.pending = { type: 'choice', resolve };
      this.choices.querySelectorAll('.dlg-choice').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (b.disabled || !this.pending) return;
          this.audio.play('click');
          this.pending = null;
          resolve(Number(b.dataset.i));
        }),
      );
    });
    this.choices.innerHTML = '';
    this._hide();
    return idx;
  }

  // 系统面板：【】样式的大号提示
  async system(lines, { title = 'SYSTEM', accent = 'cyan' } = {}) {
    this.busy = true;
    this.sys.className = `system-panel accent-${accent}`;
    this.sys.innerHTML = `<div class="sys-title">${esc(title)}</div>${lines
      .map((l, i) => `<div class="sys-line" style="animation-delay:${0.25 + i * 0.35}s">${esc(l)}</div>`)
      .join('')}<button class="sys-ok" style="animation-delay:${0.3 + lines.length * 0.35}s">确定</button>`;
    this.audio.play('system');
    await new Promise((resolve) => {
      this.pending = { type: 'system', resolve };
      this.sys.querySelector('.sys-ok').addEventListener('click', () => this._closeSystem());
    });
    this.sys.classList.add('hidden');
    this.busy = false;
  }
  _closeSystem() {
    if (this.pending?.type !== 'system') return;
    const r = this.pending.resolve;
    this.pending = null;
    this.audio.play('close');
    r();
  }

  _hide() {
    this.el.classList.add('hidden');
    this.busy = false;
    this.pending = null;
  }

  cancelAll() {
    this.cancelled = true;
    clearTimeout(this.autoTimer);
    clearInterval(this.typing);
    const p = this.pending;
    this.pending = null;
    if (p) p.resolve(p.type === 'choice' ? -1 : undefined);
    this._hide();
    this.sys.classList.add('hidden');
    setTimeout(() => (this.cancelled = false), 0);
  }
}
