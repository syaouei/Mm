import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, makeCollider } from './room.js';

// 走廊側可以開的門（教室後門、教室前門）。
// 每扇門的鉸鏈在門扇的一端（樞軸），門扇向走廊方向（-x）開約 90°。
// 前門是雙門：兩扇各自從外側鉸鏈開，一起開關。

// 所有可以開關的門的位置（z 範圍）
export function doorSpans() {
  const { room, doors } = CONFIG;
  const back0 = room.length / 2 - doors.back.distFromBackWall - doors.back.width;
  const front0 = -room.length / 2 + doors.front.distFromFrontWall;
  return [
    { name: '教室後門', z0: back0, z1: back0 + doors.back.width, double: false },
    { name: '教室前門', z0: front0, z1: front0 + doors.front.width, double: true },
  ];
}

export function buildDoors(scene, colliders) {
  return doorSpans().map((s) => buildDoor(scene, colliders, s));
}

function buildDoor(scene, colliders, { name, z0, z1, double }) {
  const { room, doors, colors: C, interaction } = CONFIG;
  const T = room.wallThickness, W = room.width;
  const xI = -W / 2; // 教室內側牆面
  const xE = xI - T; // 走廊側牆面（門板在這一面）
  const xMid = (xE + xI) / 2;
  const zm = (z0 + z1) / 2;
  const f = doors.frame, h = doors.height;

  const group = new THREE.Group();
  group.name = name;
  scene.add(group);

  // 門框：左、右、上。門框本身會擋路
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z0 - f / 2);
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z1 + f / 2);
  box(group, C.doorFrame, T, f, z1 - z0 + 2 * f, xMid, h + f / 2, zm);
  colliders.push(makeCollider(xE, xI, z0 - f, z0, 0, h + f, name + '門框'));
  colliders.push(makeCollider(xE, xI, z1, z1 + f, 0, h + f, name + '門框'));

  // 門扇
  const leafSpecs = double
    ? [{ a: z0, b: zm, hinge: 'z0' }, { a: zm, b: z1, hinge: 'z1' }]
    : [{ a: z0, b: z1, hinge: 'z0' }];
  const pivots = [];
  const panels = [];
  for (const L of leafSpecs) {
    const pivotZ = L.hinge === 'z0' ? L.a : L.b;
    const pivot = new THREE.Group();
    pivot.position.set(xE - 0.02, 0, pivotZ);
    group.add(pivot);
    const len = L.b - L.a;
    const dir = L.hinge === 'z0' ? 1 : -1; // 門扇從鉸鏈往哪邊延伸
    box(pivot, C.door, 0.035, h, len - 0.006, 0, h / 2, (dir * len) / 2, { cast: true });
    box(pivot, C.metal, 0.05, 0.02, 0.12, -0.03, 1.0, dir * (len - 0.08)); // 門把
    pivots.push({ pivot, sign: L.hinge === 'z0' ? -1 : 1 });
    // 關著時擋住門口；開啟後 disabled 為 true，不擋路
    const panel = makeCollider(xE - 0.05, xI, L.a, L.b, 0, h, name);
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
    // 站在門板擺動範圍內時不能關門（避免門板夾到人）
    occupied(px, pz) {
      return px > xE - 1.0 && px < xI + 0.3 && pz > z0 - 0.4 && pz < z1 + 0.4;
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
