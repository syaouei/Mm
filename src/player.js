import { CONFIG } from './config.js';

const EPS = 1e-4;

// 第一人稱玩家：Pointer Lock 視角 + WASD 移動 + AABB 碰撞（X、Z 兩軸分開處理以沿邊滑動）
export class Player {
  constructor(camera, domElement, colliders) {
    this.camera = camera;
    this.dom = domElement;
    this.colliders = colliders;
    const P = CONFIG.player, R = CONFIG.room;

    this.x = -R.width / 2 + P.start.fromDoorWall;
    this.z = R.length / 2 - P.start.fromBackWall;
    this.yaw = 0;   // 0 = 面向 -z（前牆）
    this.pitch = 0;
    this.keys = new Set();
    this.locked = false;
    // active：鍵盤可操作。滑鼠鎖定成功時為 true；鎖定不被允許（例如嵌在 iframe 裡）時也由 main.js 設為 true，改用拖曳轉頭
    this.active = false;
    // 觸控搖桿的類比輸入（-1~1），由 touch.js 寫入
    this.analog = { right: 0, forward: 0 };
    this.analogSprint = false;
    this.pitchLimit = (P.pitchLimitDeg * Math.PI) / 180;

    camera.rotation.order = 'YXZ';
    this.resolveStartOverlap();
    this.syncCamera();

    this.onMouseMove = this.onMouseMove.bind(this);
    // 只有滑鼠點擊才鎖定游標；觸控裝置沒有 Pointer Lock
    domElement.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && !this.locked) this.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === domElement;
      this.active = this.locked;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.keys.add(e.code);
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  requestLock() {
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* 不支援 Pointer Lock 的瀏覽器 */ }
  }

  onMouseMove(e) {
    // 已鎖定：直接轉頭；未鎖定：按住左鍵拖曳才轉頭
    if (!this.locked && !(this.active && (e.buttons & 1))) return;
    // 部分瀏覽器在鎖定瞬間會送出異常大的位移，略過
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    this.look(e.movementX, e.movementY, CONFIG.player.mouseSensitivity);
  }

  // 依螢幕位移（像素）轉動視角，滑鼠與觸控共用
  look(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-this.pitchLimit, Math.min(this.pitchLimit, this.pitch));
  }

  update(dt) {
    const P = CONFIG.player;
    let f = 0, r = 0;
    if (this.keys.has('KeyW')) f += 1;
    if (this.keys.has('KeyS')) f -= 1;
    if (this.keys.has('KeyD')) r += 1;
    if (this.keys.has('KeyA')) r -= 1;
    let amount = 1; // 鍵盤固定全速；搖桿依推的幅度
    let sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (f === 0 && r === 0) {
      f = this.analog.forward;
      r = this.analog.right;
      amount = Math.min(1, Math.hypot(f, r));
      sprint = this.analogSprint;
    }

    if (f !== 0 || r !== 0) {
      const speed = (sprint ? P.sprintSpeed : P.walkSpeed) * amount;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      // 前方 = (-sin, -cos)，右方 = (cos, -sin)
      let dx = -sin * f + cos * r;
      let dz = -cos * f - sin * r;
      const len = Math.hypot(dx, dz);
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;

      // 分段移動，避免一幀走太遠穿過薄物件
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (P.radius * 0.5)));
      for (let i = 0; i < steps; i++) {
        this.moveAxis('x', dx / steps);
        this.moveAxis('z', dz / steps);
      }
    }
    this.syncCamera();
  }

  // 單軸移動：撞到就貼齊碰撞框邊緣，另一軸的移動不受影響 → 自然沿邊滑動
  moveAxis(axis, d) {
    if (d === 0) return;
    const r = CONFIG.player.radius;
    let x = this.x, z = this.z;
    if (axis === 'x') x += d; else z += d;
    for (const b of this.colliders) {
      if (b.disabled) continue; // 已開啟的門不擋路
      if (b.minY > CONFIG.player.eyeHeight) continue; // 頭頂以上的物件不擋路
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) {
        if (axis === 'x') x = d > 0 ? b.minX - r - EPS : b.maxX + r + EPS;
        else z = d > 0 ? b.minZ - r - EPS : b.maxZ + r + EPS;
      }
    }
    this.x = x;
    this.z = z;
  }

  // 若起始點（或修改 config 後）落在碰撞框內，往外推開
  resolveStartOverlap() {
    const r = CONFIG.player.radius;
    for (let iter = 0; iter < 10; iter++) {
      let moved = false;
      for (const b of this.colliders) {
        if (this.x + r > b.minX && this.x - r < b.maxX && this.z + r > b.minZ && this.z - r < b.maxZ) {
          const pushes = [
            [b.minX - r - EPS - this.x, 0], [b.maxX + r + EPS - this.x, 0],
            [0, b.minZ - r - EPS - this.z], [0, b.maxZ + r + EPS - this.z],
          ].sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
          this.x += pushes[0][0];
          this.z += pushes[0][1];
          moved = true;
        }
      }
      if (!moved) return;
    }
    console.warn('[player] 起始位置仍與碰撞框重疊，請調整 CONFIG.player.start');
  }

  syncCamera() {
    this.camera.position.set(this.x, CONFIG.player.eyeHeight, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
