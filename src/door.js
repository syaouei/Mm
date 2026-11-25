import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, makeCollider } from './room.js';
import { geo } from './layout.js';
import { decal, plateTex, woodMaterial } from './decals.js';

// 所有可以開關的門。xOuter = 走廊側的牆面；roomDir = 教室內側相對於牆面的方向（+1 = 東、-1 = 西）
// inward：true = 門向教室內開（後門），門扇打開後貼在後牆上；false = 門向走廊開（前門，雙門）
export function doorSpans() {
  const { room, doors } = CONFIG;
  const g = geo();
  const L = room.length;
  const fz0 = -L / 2 + doors.front.distFromFrontWall, fw = doors.front.width;
  const bz0 = L / 2 - doors.back.distFromBackWall - doors.back.width, bw = doors.back.width;
  const mirror = (a, b) => ({ z0: g.c2 - b, z1: g.c2 - a }); // B（沿 z 鏡像）
  const bm = mirror(bz0, bz0 + bw), fm = mirror(fz0, fz0 + fw);
  const cz = g.czC; // C 為正方形、旋轉後門在朝走廊的東牆上（白板也在這面）
  return [
    { name: '教室A前門', z0: fz0, z1: fz0 + fw, double: true, inward: false, xOuter: g.xE, roomDir: 1, plate: 'K416 教室' },
    { name: '教室A後門', z0: bz0, z1: bz0 + bw, double: false, inward: true, hinge: 'z1', xOuter: g.xE, roomDir: 1 },
    { name: '教室B前門', ...fm, double: true, inward: false, xOuter: g.xE, roomDir: 1 },
    { name: '教室B後門', ...bm, double: false, inward: true, hinge: 'z0', xOuter: g.xE, roomDir: 1 },
    { name: '教室C前門（K413）', z0: cz - 3.6, z1: cz - 2.1, double: true, inward: false, xOuter: g.xW, roomDir: -1, plate: 'K413 教室' },
    { name: '教室C後門', z0: cz + 3.0, z1: cz + 3.9, double: false, inward: true, hinge: 'z1', xOuter: g.xW, roomDir: -1 },
  ];
}

export function buildDoors(scene, colliders) {
  return doorSpans().map((s) => buildDoor(scene, colliders, s));
}

const within = (p, a, b) => p >= Math.min(a, b) && p <= Math.max(a, b);

function buildDoor(scene, colliders, { name, z0, z1, double, inward, hinge, xOuter, roomDir, plate }) {
  const { room, doors, colors: C, interaction } = CONFIG;
  const T = room.wallThickness;
  const xI = xOuter + roomDir * T;          // 教室側的牆面
  const xMid = (xOuter + xI) / 2;
  const zm = (z0 + z1) / 2;
  const f = doors.frame, h = doors.height;
  const dx = inward ? roomDir : -roomDir;   // 門扇擺向（+1 = 教室內，-1 = 走廊）
  const faceX = inward ? xI + 0.02 * roomDir : xOuter - 0.02 * roomDir;

  const group = new THREE.Group();
  group.name = name;
  scene.add(group);

  // 門框：左、右、上。門框本身會擋路
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z0 - f / 2);
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z1 + f / 2);
  box(group, C.doorFrame, T, f, z1 - z0 + 2 * f, xMid, h + f / 2, zm);
  colliders.push(makeCollider(Math.min(xOuter, xI), Math.max(xOuter, xI), z0 - f, z0, 0, h + f, name + '門框'));
  colliders.push(makeCollider(Math.min(xOuter, xI), Math.max(xOuter, xI), z1, z1 + f, 0, h + f, name + '門框'));

  // 走廊側的門牌（白底、青色邊框）
  if (!inward) {
    if (plate) decal(group, plateTex(plate), 0.42, 0.2, xOuter - roomDir * 0.012, 2.4, zm, (-roomDir * Math.PI) / 2);
    // 刷卡機（照片：門旁的黑色讀卡機）
    box(group, '#222427', 0.02, 0.14, 0.09, xOuter - roomDir * 0.02, 1.25, zm + 0.35);
  }

  // 門扇
  const leafSpecs = double
    ? [{ a: z0, b: zm, hinge: 'z0' }, { a: zm, b: z1, hinge: 'z1' }]
    : [{ a: z0, b: z1, hinge: hinge || (inward ? 'z1' : 'z0') }];
  const pivots = [];
  const panels = [];
  for (const L of leafSpecs) {
    const pivotZ = L.hinge === 'z0' ? L.a : L.b;
    const pivot = new THREE.Group();
    pivot.position.set(faceX, 0, pivotZ);
    group.add(pivot);
    const len = L.b - L.a;
    const d = L.hinge === 'z0' ? 1 : -1;    // 門扇從鉸鏈往哪個 z 方向延伸
    box(pivot, null, 0.035, h, len - 0.006, 0, h / 2, (d * len) / 2, { cast: true, material: woodMaterial() });
    box(pivot, C.metal, 0.05, 0.02, 0.12, -0.03 * dx, 1.0, d * (len - 0.08)); // 門把
    box(pivot, C.glassDark, 0.008, 0.4, 0.14, dx * 0.0185, 1.45, (d * len) / 2); // 小玻璃窗
    pivots.push({ pivot, sign: dx * d });
    // 關著時擋住門口；開啟後 disabled 為 true，不擋路
    const pa = inward ? Math.min(xOuter, xI + 0.05 * roomDir) : Math.min(xOuter - 0.05 * roomDir, xI);
    const pb = inward ? Math.max(xOuter, xI + 0.05 * roomDir) : Math.max(xOuter - 0.05 * roomDir, xI);
    const panel = makeCollider(pa, pb, L.a, L.b, 0, h, name);
    colliders.push(panel);
    panels.push(panel);
  }

  let open = false;
  let t = 0; // 0 = 關，1 = 開

  return {
    name,
    center: { x: xOuter, z: zm },
    get open() {
      return open;
    },
    // 門扇擺動範圍內有人時不能關門（避免門板夾到人）
    occupied(px, pz) {
      const inSwing = inward
        ? within(px, xI - 0.3 * roomDir, xI + 1.0 * roomDir)
        : within(px, xOuter - 1.0 * roomDir, xI + 0.3 * roomDir);
      return inSwing && pz > z0 - 0.4 && pz < z1 + 0.4;
    },
    toggle(px, pz) {
      if (!open) open = true;
      else if (!this.occupied(px, pz)) open = false;
      return open;
    },
    // 回傳這一幀門是否還在動（用來決定要不要重算陰影）
    update(dt) {
      const target = open ? 1 : 0;
      const step = dt / interaction.doorDuration;
      const before = t;
      t = t < target ? Math.min(target, t + step) : Math.max(target, t - step);
      for (const p of pivots) p.pivot.rotation.y = (p.sign * t * Math.PI) / 2;
      for (const c of panels) c.disabled = t > 0.3;
      return t !== before;
    },
  };
}
