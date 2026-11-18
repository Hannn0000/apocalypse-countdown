// 键盘 / 鼠标 / 触屏输入
export class Input {
  constructor(canvas, uiRoot, game) {
    this.canvas = canvas;
    this.game = game;
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };
    this.joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.lookTouch = null;
    this.dragging = false;
    this.running = false;
    this.pointerLocked = false;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.running = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.running = false;
    });

    // 鼠标：点击画面锁定指针，或按住拖动旋转相机
    canvas.addEventListener('mousedown', (e) => {
      game.audio.ensure();
      if (!game.canControl()) return;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (!this.pointerLocked && e.button === 0 && !game.isTouch) {
        try {
          const p = canvas.requestPointerLock?.();
          if (p && p.catch) p.catch(() => {});
        } catch {
          /* 不支持时使用拖动 */
        }
      }
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.look.dx += e.movementX || 0;
        this.look.dy += e.movementY || 0;
      } else if (this.dragging) {
        this.look.dx += e.clientX - this.lastX;
        this.look.dy += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('wheel', (e) => {
      if (game.canControl()) game.rig.zoom(Math.sign(e.deltaY) * 0.5);
    }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // 触屏：左半屏虚拟摇杆，右半屏滑动转视角
    this.buildMobile(uiRoot);
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e));
  }

  exitPointerLock() {
    if (this.pointerLocked) {
      try {
        document.exitPointerLock?.();
      } catch {
        /* ignore */
      }
    }
  }

  onKeyDown(e) {
    const tag = e.target?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if (e.code === 'Tab') e.preventDefault();
    if (typing && e.code !== 'Escape' && e.code !== 'Tab') return;
    this.game.audio.ensure();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.running = true;
    if (e.repeat) return;
    this.keys.add(e.code);
    const map = {
      KeyE: 'interact', KeyF: 'interact', Space: 'advance', Enter: 'advance', NumpadEnter: 'advance',
      Tab: 'phone', KeyI: 'storage', Escape: 'escape',
      Digit1: 'choice1', Digit2: 'choice2', Digit3: 'choice3', Digit4: 'choice4',
    };
    const a = map[e.code];
    if (a) {
      if (e.code === 'Space') e.preventDefault();
      this.game.onAction(a);
    }
  }

  getMove() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (this.joy.id !== null) {
      x += this.joy.x;
      y += this.joy.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  }
  get isRunning() {
    return this.running || (this.joy.id !== null && Math.hypot(this.joy.x, this.joy.y) > 0.95);
  }
  consumeLook() {
    const l = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = this.look.dy = 0;
    return l;
  }

  buildMobile(uiRoot) {
    const el = document.createElement('div');
    el.className = 'mobile-controls';
    el.innerHTML = `
      <div class="joy-base"><div class="joy-knob"></div></div>
      <div class="mbtns">
        <button class="mbtn mbtn-interact" data-a="interact">互动</button>
        <button class="mbtn" data-a="phone">📱<span>手机</span></button>
        <button class="mbtn" data-a="storage">💠<span>空间</span></button>
        <button class="mbtn mbtn-small" data-a="escape">☰</button>
      </div>`;
    uiRoot.appendChild(el);
    this.mobileEl = el;
    this.joyBase = el.querySelector('.joy-base');
    this.joyKnob = el.querySelector('.joy-knob');
    el.querySelectorAll('.mbtn').forEach((b) => {
      const fire = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.game.audio.ensure();
        this.game.onAction(b.dataset.a);
      };
      b.addEventListener('touchstart', fire, { passive: false });
      b.addEventListener('click', fire);
    });
  }
  setMobileVisible(v) {
    this.mobileEl.classList.toggle('show', v && this.game.isTouch);
  }

  onTouchStart(e) {
    e.preventDefault();
    this.game.audio.ensure();
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth * 0.45 && this.joy.id === null) {
        this.joy.id = t.identifier;
        this.joy.ox = t.clientX;
        this.joy.oy = t.clientY;
        this.joy.x = this.joy.y = 0;
        this.joyBase.style.left = t.clientX - 60 + 'px';
        this.joyBase.style.top = t.clientY - 60 + 'px';
        this.joyBase.classList.add('active');
        this.joyKnob.style.transform = 'translate(0px,0px)';
      } else if (this.lookTouch === null) {
        this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  }
  onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.ox, dy = t.clientY - this.joy.oy;
        const l = Math.hypot(dx, dy), R = 55;
        if (l > R) {
          dx = (dx / l) * R;
          dy = (dy / l) * R;
        }
        this.joy.x = dx / R;
        this.joy.y = -dy / R;
        this.joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
      } else if (this.lookTouch && t.identifier === this.lookTouch.id) {
        this.look.dx += (t.clientX - this.lookTouch.x) * 1.4;
        this.look.dy += (t.clientY - this.lookTouch.y) * 1.4;
        this.lookTouch.x = t.clientX;
        this.lookTouch.y = t.clientY;
      }
    }
  }
  onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joy.id) {
        this.joy.id = null;
        this.joy.x = this.joy.y = 0;
        this.joyBase.classList.remove('active');
      } else if (this.lookTouch && t.identifier === this.lookTouch.id) {
        this.lookTouch = null;
      }
    }
  }
}
