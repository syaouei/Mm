import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, makeCollider } from './room.js';

// 可以開的門（教室後門、教室前門）。
// inward：true = 門向教室內開（後門），門扇打開後貼在後牆上，樞軸在後牆端；
//         false = 門向走廊開（前門，雙門），各自從外側鉸鏈開。

// 所有可以開關的門的位置（z 範圍）
export function doorSpans() {
  const { room, doors } = CONFIG;
  const back0 = room.length / 2 - doors.back.distFromBackWall - doors.back.width;
  const front0 = -room.length / 2 + doors.front.distFromFrontWall;
  // 隔壁教室（鏡像）的前門在走廊的另一側，位置 = 鏡像後的前門
  const c2 = -(room.length + room.wallThickness);
  const w = doors.front.width;
  return [
    { name: '教室後門', z0: back0, z1: back0 + doors.back.width, double: false, inward: true },
    { name: '教室前門', z0: front0, z1: front0 + w, double: true, inward: false },
    { name: '隔壁教室前門', z0: c2 - (front0 + w), z1: c2 - front0, double: true, inward: false },
  ];
}

export function buildDoors(scene, colliders) {
  return doorSpans().map((s) => buildDoor(scene, colliders, s));
}

function buildDoor(scene, colliders, { name, z0, z1, double, inward }) {
  const { room, doors, colors: C, interaction } = CONFIG;
  const T = room.wallThickness, W = room.width;
  const xI = -W / 2; // 教室內側牆面
  const xE = xI - T; // 走廊側牆面
  const xMid = (xE + xI) / 2;
  const zm = (z0 + z1) / 2;
  const f = doors.frame, h = doors.height;
  // 門扇的擺動方向（+1 = 往教室內，-1 = 往走廊）與門板所在面
  const dx = inward ? 1 : -1;
  const faceX = inward ? xI + 0.02 : xE - 0.02;

  const group = new THREE.Group();
  group.name = name;
  scene.add(group);

  // 門框：左、右、上。門框本身會擋路
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z0 - f / 2);
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z1 + f / 2);
  box(group, C.doorFrame, T, f, z1 - z0 + 2 * f, xMid, h + f / 2, zm);
  colliders.push(makeCollider(xE, xI, z0 - f, z0, 0, h + f, name + '門框'));
  colliders.push(makeCollider(xE, xI, z1, z1 + f, 0, h + f, name + '門框'));

  // 走廊側的門牌（白底、青色邊框）
  if (!inward) {
    box(group, C.nameTeal, 0.012, 0.2, 0.42, xE - 0.008, 2.4, zm);
    box(group, C.switchPlate, 0.01, 0.14, 0.36, xE - 0.014, 2.4, zm);
  }

  // 門扇
  const leafSpecs = double
    ? [{ a: z0, b: zm, hinge: 'z0' }, { a: zm, b: z1, hinge: 'z1' }]
    : [{ a: z0, b: z1, hinge: inward ? 'z1' : 'z0' }];
  const pivots = [];
  const panels = [];
  for (const L of leafSpecs) {
    const pivotZ = L.hinge === 'z0' ? L.a : L.b;
    const pivot = new THREE.Group();
    pivot.position.set(faceX, 0, pivotZ);
    group.add(pivot);
    const len = L.b - L.a;
    const d = L.hinge === 'z0' ? 1 : -1; // 門扇從鉸鏈往哪個 z 方向延伸
    box(pivot, C.door, 0.035, h, len - 0.006, 0, h / 2, (d * len) / 2, { cast: true });
    // 門把在門扇的自由端，朝向門的「外側」（教室內門在教室側）
    box(pivot, C.metal, 0.05, 0.02, 0.12, -0.03 * dx, 1.0, d * (len - 0.08));
    box(pivot, C.glassDark, 0.008, 0.4, 0.14, dx * 0.0185, 1.45, (d * len) / 2); // 門上的小玻璃窗
    // 旋轉方向：讓門扇的自由端往 dx 方向擺開
    pivots.push({ pivot, sign: dx * d });
    // 關著時擋住門口；開啟後 disabled 為 true，不擋路
    const panel = makeCollider(inward ? xE : xE - 0.05, inward ? xI + 0.05 : xI, L.a, L.b, 0, h, name);
    colliders.push(panel);
    panels.push(panel);
  }

  let open = false;
  let t = 0; // 0 = 關，1 = 開

  return {
    name,
    center: { x: xE, z: zm },
    get open() {
      return open;
    },
    // 門扇擺動範圍內有人時不能關門（避免門板夾到人）
    occupied(px, pz) {
      const inSwing = inward ? px > xI - 0.3 && px < xI + 1.0 : px > xE - 1.0 && px < xI + 0.3;
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
