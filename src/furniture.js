import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeCollider } from './room.js';

// 簡單可重現的亂數（決定每張桌面是米黃或灰白）
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 收集同材質的方塊，最後合成一個 InstancedMesh（降低 draw call）
class Batch {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.matrices = [];
  }
  add(sx, sy, sz, x, y, z, rotX = 0) {
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, 0, 0)),
      new THREE.Vector3(sx, sy, sz),
    );
    this.matrices.push(m);
  }
  build(parent) {
    if (!this.matrices.length) return;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.matrices.length);
    this.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }
}

// 椅背：矩形下半 + 橢圓弧頂，擠出成薄板（尺寸為 1，之後用 scale 調整）
function chairBackGeometry(width, height, thickness) {
  const s = new THREE.Shape();
  const hw = width / 2, arcH = Math.min(0.12, height * 0.4);
  s.moveTo(-hw, 0);
  s.lineTo(hw, 0);
  s.lineTo(hw, height - arcH);
  s.absellipse(0, height - arcH, hw, arcH, 0, Math.PI, false);
  s.lineTo(-hw, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -thickness / 2);
  return g;
}

// 計算每組課桌椅的中心位置（桌子中心）
export function computeLayout() {
  const { room, layout, desk } = CONFIG;
  const W = room.width, L = room.length;
  const n = layout.colsPerSide;
  const inner = W - 2 * layout.sideAisle - layout.centerAisle;
  let colGap = n > 1 ? (inner - 2 * n * desk.width) / (2 * (n - 1)) : 0;
  if (colGap < 0.05 && n > 1) {
    console.warn(`[layout] 房間寬度 ${W}m 放不下每側 ${n} 組課桌，桌距已被壓到 0.05m`);
    colGap = 0.05;
  }
  const pitch = desk.width + colGap;
  const xs = [];
  const leftStart = -W / 2 + layout.sideAisle + desk.width / 2;
  const rightStart = W / 2 - layout.sideAisle - desk.width / 2;
  for (let i = 0; i < n; i++) xs.push(leftStart + i * pitch);
  for (let i = n - 1; i >= 0; i--) xs.push(rightStart - i * pitch);

  const zs = [];
  for (let r = 0; r < layout.rows; r++) {
    zs.push(-L / 2 + layout.frontGap + r * layout.rowPitch + desk.depth / 2);
  }
  return { xs, zs, colGap };
}

export function buildFurniture(scene) {
  const { desk: D, chair: Ch, colors: C, layout } = CONFIG;
  const group = new THREE.Group();
  group.name = 'furniture';
  scene.add(group);

  const unit = new THREE.BoxGeometry(1, 1, 1);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
  const batches = {
    beige: new Batch(unit, std(C.deskBeige, { roughness: 0.6 })),
    grey: new Batch(unit, std(C.deskGrey, { roughness: 0.6 })),
    deskBox: new Batch(unit, std(C.deskBox, { metalness: 0.2, roughness: 0.6 })),
    metal: new Batch(unit, std(C.metal, { metalness: 0.5, roughness: 0.45 })),
    seat: new Batch(unit, std(C.chair, { roughness: 0.5 })),
    back: new Batch(chairBackGeometry(1, 1, 1), std(C.chair, { roughness: 0.5 })),
  };

  const { xs, zs } = computeLayout();
  const rand = mulberry32(layout.seed);
  const colliders = [];
  const legH = D.height - D.topThickness;
  const backBottom = Ch.backTop - Ch.backHeight;
  const backTilt = 0.12;  // 椅背略往後仰（弧度）

  for (const cz of zs) {
    for (const cx of xs) {
      // ---- 桌子（學生坐在 +z 側，面向 -z）----
      const top = rand() < layout.greyDeskRatio ? batches.grey : batches.beige;
      top.add(D.width, D.topThickness, D.depth, cx, D.height - D.topThickness / 2, cz);
      // 收納格
      batches.deskBox.add(D.width - 0.06, D.boxHeight, D.depth - 0.08, cx, legH - D.boxHeight / 2, cz - 0.02);
      // 前方擋板
      batches.deskBox.add(D.width - 0.06, D.panelHeight, 0.012, cx, legH - D.panelHeight / 2, cz - D.depth / 2 + 0.035);
      // 桌腳 + 底部橫桿
      const lx = D.width / 2 - 0.035, lz = D.depth / 2 - 0.04;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          batches.metal.add(D.legSize, legH, D.legSize, cx + sx * lx, legH / 2, cz + sz * lz);
        }
        batches.metal.add(D.legSize, D.legSize, D.depth - 0.04, cx + sx * lx, 0.03, cz);
      }

      // ---- 椅子 ----
      const seatZ = cz + D.depth / 2 - Ch.offsetBehindDesk + Ch.seatDepth / 2;
      const seatTopY = Ch.seatHeight;
      batches.seat.add(Ch.seatWidth, Ch.seatThickness, Ch.seatDepth, cx, seatTopY - Ch.seatThickness / 2, seatZ);
      const backZ = seatZ + Ch.seatDepth / 2 + 0.01;
      batches.back.add(Ch.seatWidth, Ch.backHeight, Ch.backThickness, cx, backBottom, backZ, backTilt);
      // 椅腳（灰色金屬）
      const clx = Ch.seatWidth / 2 - 0.03, clz = Ch.seatDepth / 2 - 0.03;
      const chairLegH = seatTopY - Ch.seatThickness;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          batches.metal.add(Ch.legSize, chairLegH, Ch.legSize, cx + sx * clx, chairLegH / 2, seatZ + sz * clz);
        }
        // 座椅到椅背的支撐
        batches.metal.add(Ch.legSize, backBottom - seatTopY + 0.06, Ch.legSize,
          cx + sx * (Ch.seatWidth / 2 - 0.05), (seatTopY + backBottom) / 2, backZ - 0.01);
        batches.metal.add(Ch.legSize, Ch.legSize, Ch.seatDepth, cx + sx * clx, 0.03, seatZ);
      }

      // ---- 碰撞框 ----
      colliders.push(makeCollider(cx - D.width / 2, cx + D.width / 2, cz - D.depth / 2, cz + D.depth / 2, 0, D.height, '桌'));
      colliders.push(makeCollider(
        cx - Ch.seatWidth / 2, cx + Ch.seatWidth / 2,
        cz + D.depth / 2, backZ + 0.06, 0, Ch.backTop, '椅',
      ));
    }
  }

  for (const b of Object.values(batches)) b.build(group);
  return { group, colliders };
}
