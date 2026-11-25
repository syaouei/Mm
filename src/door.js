import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, makeCollider } from './room.js';

// 教室後方那扇可以開的門：樞軸在 z0，門板向走廊方向開（約 90°）
export function backDoorSpan() {
  const { room, doors } = CONFIG;
  const z0 = room.length / 2 - doors.back.distFromBackWall - doors.back.width;
  return { z0, z1: z0 + doors.back.width };
}

export function buildBackDoor(scene, colliders) {
  const { room, doors, colors: C, interaction } = CONFIG;
  const T = room.wallThickness, W = room.width;
  const xI = -W / 2; // 教室內側牆面
  const xE = xI - T; // 走廊側牆面（門板在這一面）
  const xMid = (xE + xI) / 2;
  const { z0, z1 } = backDoorSpan();
  const f = doors.frame, h = doors.height;

  const group = new THREE.Group();
  group.name = 'backDoor';
  scene.add(group);

  // 門框：左、右、上。門框本身會擋路
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z0 - f / 2);
  box(group, C.doorFrame, T, h + f, f, xMid, (h + f) / 2, z1 + f / 2);
  box(group, C.doorFrame, T, f, z1 - z0 + 2 * f, xMid, h + f / 2, (z0 + z1) / 2);
  colliders.push(makeCollider(xE, xI, z0 - f, z0, 0, h + f, '門框'));
  colliders.push(makeCollider(xE, xI, z1, z1 + f, 0, h + f, '門框'));

  // 門板：樞軸在 z0 的門鉸鏈側
  const pivot = new THREE.Group();
  pivot.position.set(xE - 0.02, 0, z0);
  group.add(pivot);
  const leaf = z1 - z0;
  box(pivot, C.door, 0.035, h, leaf - 0.006, 0, h / 2, leaf / 2, { cast: true });
  box(pivot, C.metal, 0.05, 0.02, 0.12, -0.03, 1.0, leaf - 0.08); // 門把

  // 關著時擋住門口；開啟後 disabled 為 true，不擋路
  const panel = makeCollider(xE - 0.05, xI, z0, z1, 0, h, '教室後門');
  colliders.push(panel);

  let open = false;
  let t = 0; // 0 = 關，1 = 開

  return {
    center: { x: xE, z: (z0 + z1) / 2 },
    get open() {
      return open;
    },
    // 站在門口範圍內時不能關門（避免門板夾到人）
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
      pivot.rotation.y = (-t * Math.PI) / 2;
      panel.disabled = t > 0.3;
      return t !== before;
    },
  };
}
