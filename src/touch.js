import { CONFIG } from './config.js';

// 手機 / 平板觸控操作：
//   左半邊：浮動虛擬搖桿（按下的位置就是搖桿中心）→ 移動，推越多走越快
//   右半邊：拖曳 → 轉動視角
//   右下按鈕：「跑」切換衝刺；右上：「框」碰撞框、「⛶」全螢幕
export class TouchControls {
  constructor(player, canvas, debug, onDoor) {
    this.player = player;
    this.canvas = canvas;
    this.enabled = false;
    this.move = null; // { id, ox, oy }
    this.lookPtr = null; // { id, x, y }
    this.radius = CONFIG.touch.joystickRadius;

    // ---- DOM ----
    this.ui = el('div', 'touch-ui');
    this.base = el('div', 'joy-base');
    this.knob = el('div', 'joy-knob');
    this.base.appendChild(this.knob);
    this.ui.appendChild(this.base);
    this.hint = el('div', 'joy-hint', '左邊拖曳移動　右邊拖曳轉頭');
    this.ui.appendChild(this.hint);

    this.sprintBtn = button('btn-sprint', '跑', () => {
      player.analogSprint = !player.analogSprint;
      this.sprintBtn.classList.toggle('on', player.analogSprint);
    });
    const boxBtn = button('btn-box', '框', () => {
      debug.toggleColliders();
      boxBtn.classList.toggle('on', debug.boxes.visible);
    });
    this.ui.append(this.sprintBtn, boxBtn);
    this.ui.appendChild(button('btn-door', '門', () => onDoor?.()));
    this.ui.appendChild(button('btn-jump', '跳', () => player.requestJump()));

    if (document.fullscreenEnabled) {
      const fsBtn = button('btn-fs', '⛶', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      });
      this.ui.appendChild(fsBtn);
    }
    document.body.appendChild(this.ui);

    // ---- 事件 ----
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    // iOS Safari：擋掉雙指縮放
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  enable() {
    this.enabled = true;
    this.ui.classList.add('active');
  }

  onDown(e) {
    if (!this.enabled || e.pointerType === 'mouse') return;
    e.preventDefault();
    if (e.clientX < window.innerWidth * CONFIG.touch.moveZone && !this.move) {
      this.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.base.classList.add('show');
      this.setKnob(0, 0);
      this.hint.classList.add('gone');
    } else if (!this.lookPtr) {
      this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.hint.classList.add('gone');
    }
  }

  onMove(e) {
    if (!this.enabled) return;
    if (this.move && e.pointerId === this.move.id) {
      e.preventDefault();
      let dx = e.clientX - this.move.ox, dy = e.clientY - this.move.oy;
      const len = Math.hypot(dx, dy);
      if (len > this.radius) { dx *= this.radius / len; dy *= this.radius / len; }
      this.setKnob(dx, dy);
      let right = dx / this.radius, forward = -dy / this.radius;
      if (Math.hypot(right, forward) < CONFIG.touch.deadZone) right = forward = 0;
      this.player.analog.right = right;
      this.player.analog.forward = forward;
    } else if (this.lookPtr && e.pointerId === this.lookPtr.id) {
      e.preventDefault();
      this.player.look(e.clientX - this.lookPtr.x, e.clientY - this.lookPtr.y, CONFIG.touch.lookSensitivity);
      this.lookPtr.x = e.clientX;
      this.lookPtr.y = e.clientY;
    }
  }

  onUp(e) {
    if (this.move && e.pointerId === this.move.id) {
      this.move = null;
      this.player.analog.right = this.player.analog.forward = 0;
      this.base.classList.remove('show');
    }
    if (this.lookPtr && e.pointerId === this.lookPtr.id) this.lookPtr = null;
  }

  setKnob(dx, dy) {
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }
}

function el(tag, cls, text) {
  const d = document.createElement(tag);
  d.className = cls;
  if (text) d.textContent = text;
  return d;
}

function button(cls, text, onTap) {
  const b = el('button', `touch-btn ${cls}`, text);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onTap(); });
  return b;
}
