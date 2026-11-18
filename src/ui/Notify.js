import { el, esc } from './dom.js';

export class Notify {
  constructor(root, audio) {
    this.audio = audio;
    this.box = el('div', 'toasts');
    root.appendChild(this.box);
  }
  // type: info | system | success | warn
  toast(lines, { type = 'info', duration = 3600, sound = true } = {}) {
    if (!Array.isArray(lines)) lines = [lines];
    const t = el('div', `toast toast-${type}`);
    t.innerHTML = lines.map((l, i) => `<div class="${i === 0 ? 'toast-head' : 'toast-line'}">${esc(l)}</div>`).join('');
    this.box.appendChild(t);
    while (this.box.children.length > 4) this.box.firstChild.remove();
    requestAnimationFrame(() => t.classList.add('in'));
    if (sound) this.audio.play(type === 'warn' ? 'alert' : type === 'system' ? 'notify' : 'click');
    setTimeout(() => {
      t.classList.remove('in');
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, duration);
  }
}
