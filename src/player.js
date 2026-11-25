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
    this.pitchLimit = (P.pitchLimitDeg * Math.PI) / 180;

    camera.rotation.order = 'YXZ';
    this.resolveStartOverlap();
    this.syncCamera();

    this.onMouseMove = this.onMouseMove.bind(this);
    domElement.addEventListener('click', () => {
      if (!this.locked) domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === domElement;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', (e) => {
      if (!this.locked) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.keys.add(e.code);
        e.preventDefault();
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  onMouseMove(e) {
    if (!this.locked) return;
    // 部分瀏覽器在鎖定瞬間會送出異常大的位移，略過
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    const s = CONFIG.player.mouseSensitivity;
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s;
    this.pitch = Math.max(-this.pitchLimit, Math.min(this.pitchLimit, this.pitch));
  }

  update(dt) {
    const P = CONFIG.player;
    let f = 0, r = 0;
    if (this.keys.has('KeyW')) f += 1;
    if (this.keys.has('KeyS')) f -= 1;
    if (this.keys.has('KeyD')) r += 1;
    if (this.keys.has('KeyA')) r -= 1;

    if (f !== 0 || r !== 0) {
      const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const speed = sprint ? P.sprintSpeed : P.walkSpeed;
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
