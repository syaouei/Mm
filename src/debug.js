import * as THREE from 'three';

// 左上角 HUD（座標 + FPS）與 F3 碰撞框線框
export class Debug {
  constructor(scene, colliders) {
    this.hud = document.createElement('div');
    this.hud.id = 'hud';
    document.body.appendChild(this.hud);

    this.frames = 0;
    this.elapsed = 0;
    this.fps = 0;

    this.boxes = buildColliderLines(colliders);
    this.boxes.visible = false;
    scene.add(this.boxes);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'F3') {
        e.preventDefault(); // 避免觸發瀏覽器的「尋找」
        this.boxes.visible = !this.boxes.visible;
      }
    });
  }

  update(dt, player) {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed >= 0.5) {
      this.fps = Math.round(this.frames / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
    }
    this.hud.textContent =
      `x: ${player.x.toFixed(2)}  z: ${player.z.toFixed(2)}\n` +
      `FPS: ${this.fps}\n` +
      `F3 碰撞框: ${this.boxes.visible ? '開' : '關'}`;
  }
}

function buildColliderLines(colliders) {
  const pos = [];
  for (const b of colliders) {
    const xs = [b.minX, b.maxX], ys = [b.minY, b.maxY], zs = [b.minZ, b.maxZ];
    const v = (i, j, k) => [xs[i], ys[j], zs[k]];
    const edges = [
      [v(0,0,0), v(1,0,0)], [v(0,0,1), v(1,0,1)], [v(0,1,0), v(1,1,0)], [v(0,1,1), v(1,1,1)],
      [v(0,0,0), v(0,1,0)], [v(1,0,0), v(1,1,0)], [v(0,0,1), v(0,1,1)], [v(1,0,1), v(1,1,1)],
      [v(0,0,0), v(0,0,1)], [v(1,0,0), v(1,0,1)], [v(0,1,0), v(0,1,1)], [v(1,1,0), v(1,1,1)],
    ];
    for (const [a, c] of edges) pos.push(...a, ...c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ff2a6d', depthTest: false }));
  lines.renderOrder = 999;
  return lines;
}
