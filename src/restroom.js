import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';
import { plateTex, decal, pantryWallTex, pantryFloorTex } from './decals.js';
import { geo } from './layout.js';

// 西延走廊北側的男廁（西）與女廁（東）。
// 座標：z 向北為負；房間南牆即西延段北牆（z = zBN - T）。門洞開在該牆上。
// 男廁依照片：洗手台與鏡面在西牆、小便斗與隔板在東牆、蓝色隔間在北側、窗在北牆、黑色花岗岩地面。
// 女廁照片尚未提供：暫以相同格局，但小便斗改為隔間。
export function buildRestrooms(scene, colliders) {
  const { room, colors: C, lighting } = CONFIG;
  const H = room.height, T = room.wallThickness;
  const g = geo();
  const zBN = g.zNend - T - CONFIG.corridor.width;  // 西延段北邊（與 corridor.js 相同）
  const zS = zBN - T;                      // 房間南界（西延段北牆外側）
  const zN = zS - 7.6;                     // 房間北界（內側）
  const group = new THREE.Group();
  group.name = 'restrooms';
  scene.add(group);

  const wallMat = new THREE.MeshStandardMaterial({ map: tileTex(3, 2), roughness: 0.35 });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex(), roughness: 0.5 });
  const ceilMat = mat(C.ceiling, { roughness: 0.95 });
  const blue = mat('#2b6fb5', { roughness: 0.6 });
  const stallWhite = mat('#eceee9', { roughness: 0.6 });
  const steel = mat(C.metal, { metalness: 0.5, roughness: 0.4 });
  const porcelain = mat('#f5f5f2', { roughness: 0.25 });
  const granite = mat('#17191c', { roughness: 0.25, metalness: 0.1 });
  const mirror = mat('#8d9aa2', { roughness: 0.15, metalness: 0.6 });

  function room4(x0, x1, kind, depth) {
    const zN = zS - depth;                 // 本房間北界（男廁較深、女廁維持原深度）
    const W = x1 - x0, D = zS - zN, zc = (zS + zN) / 2, xc = (x0 + x1) / 2;
    // 地面（男廁黑色花岗岩踢腳與地面深色帶）、天花板
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(xc, 0.002, zc); floor.receiveShadow = true; group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.set(xc, H - 0.01, zc); group.add(ceil);
    for (const z of [zS - 1.8, zS - 3.8, zS - 5.8]) {
      box(group, C.ceilingGrid, 0.6, 0.02, 0.6, xc, H - 0.02, z);
      box(group, null, 0.5, 0.03, 0.5, xc, H - 0.03, z, { material: mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1 }) });
    }
    const pl = new THREE.PointLight('#fff8ea', lighting.pointIntensity * 0.7, 5, 1.5);
    pl.position.set(xc, H - 0.7, zc); scene.add(pl);

    // 牆：西、東、北（南為西延段北牆，門洞已在走廊建造）
    box(group, null, T, H, D, x0 - T / 2, H / 2, zc, { material: wallMat });
    colliders.push(makeCollider(x0 - T, x0, zN, zS, 0, H, kind + '西牆'));
    box(group, null, T, H, D, x1 + T / 2, H / 2, zc, { material: wallMat });
    colliders.push(makeCollider(x1, x1 + T, zN, zS, 0, H, kind + '東牆'));
    box(group, null, W + 2 * T, H, T, xc, H / 2, zN - T / 2, { material: wallMat });
    colliders.push(makeCollider(x0 - T, x1 + T, zN - T, zN, 0, H, kind + '北牆'));
    // 北牆窗戶（有窗框與玻璃；照片中窗在北側）
    const wx = x0 + 1.0;
    box(group, C.frame, 1.0, 1.2, 0.06, wx, 1.65, zN + 0.03);
    box(group, '#9fc3c9', 0.9, 1.1, 0.02, wx, 1.65, zN + 0.01, { material: mat('#9fc3c9', { roughness: 0.15, transparent: true, opacity: 0.5 }) });
    // 門牌（門在南牆，朝北的一面）
    decal(group, plateTex(kind === '男' ? '男廁 Men' : '女廁 Women'), 0.42, 0.2, x0 + 2.2, 1.9, zS - 0.02, Math.PI);
    // 垃圾桶與衛生紙架（照片：門旁）
    box(group, C.trash, 0.45, 0.7, 0.45, x1 - 0.5, 0.35, zS - 0.3, { material: mat('#eceee9', { roughness: 0.4 }) });
    colliders.push(makeCollider(x1 - 0.73, x1 - 0.27, zS - 0.53, zS - 0.07, 0, 0.7, kind + '垃圾桶'));
    box(group, '#f1ead2', 0.3, 0.3, 0.12, x1 - 0.12, 1.3, zS - 1.0, { material: porcelain });

    return { x0, x1, zS, zN, W };
  }

  function menRoom(R) {
    const { x0, x1, zS: s, zN: n } = R;
    const beige = mat('#d8d2c4', { roughness: 0.6 });
    const granite2 = mat('#17191c', { roughness: 0.25, metalness: 0.1 });
    // ---- 西側：洗手台（南段）與 7 個小便斗（北段），同在西牆 ----
    const cz0 = s - 0.6, cz1 = s - 3.0;   // 洗手台
    box(group, '#f4f4f1', 0.55, 0.06, cz0 - cz1, x0 + 0.3, 0.88, (cz0 + cz1) / 2, { material: porcelain });
    box(group, '#f4f4f1', 0.55, 0.85, cz0 - cz1, x0 + 0.3, 0.44, (cz0 + cz1) / 2, { material: porcelain });
    colliders.push(makeCollider(x0, x0 + 0.55, cz1, cz0, 0, 0.9, '男廁洗手台'));
    for (const z of [cz0 - 0.4, (cz0 + cz1) / 2, cz1 + 0.4]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.04, 24), porcelain);
      bowl.scale.set(1, 1, 1.4); bowl.position.set(x0 + 0.3, 0.92, z); group.add(bowl);
      box(group, C.metal, 0.05, 0.22, 0.05, x0 + 0.1, 1.02, z, { material: steel });
    }
    box(group, null, 0.02, 0.8, cz0 - cz1, x0 + 0.02, 1.5, (cz0 + cz1) / 2, { material: mirror });

    const uZ = [];
    for (let i = 0; i < 7; i++) uZ.push(s - 3.4 - i * 0.8);
    const uTop = uZ[0] + 0.4, uBot = uZ[6] - 0.4;
    box(group, null, 0.8, 0.01, uTop - uBot, x0 + 0.4, 0.004, (uTop + uBot) / 2, { material: granite2 });
    box(group, '#f1f1ee', 0.14, 0.03, uTop - uBot, x0 + 0.07, 1.5, (uTop + uBot) / 2, { material: porcelain });
    box(group, C.fixture, 0.12, 0.12, uTop - uBot, x0 + 0.05, H - 0.2, (uTop + uBot) / 2, { material: mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }) });
    for (const z of uZ) {
      box(group, '#f5f5f2', 0.34, 0.5, 0.36, x0 + 0.17, 0.72, z, { material: porcelain });
      box(group, '#b7bcc0', 0.08, 0.1, 0.02, x0 + 0.01, 1.22, z, { material: steel });   // 感應冲水盒
    }
    colliders.push(makeCollider(x0, x0 + 0.36, uBot, uTop, 0, 1.0, '男廁小便斗'));
    for (let i = 0; i < 6; i++) {
      const pz = (uZ[i] + uZ[i + 1]) / 2;
      box(group, beige, 0.5, 1.2, 0.02, x0 + 0.25, 0.9, pz, { material: beige });
      colliders.push(makeCollider(x0, x0 + 0.5, pz - 0.01, pz + 0.01, 0, 1.5, '男廁小便隔板'));
    }
    // ---- 東側北端：兩間有門的隔間（照片：蓝色門、白色隔板、不鏽鋼軌） ----
    const stallDepth = 1.4;
    const zStalls = [[n + 0.05, n + 1.05], [n + 1.05, n + 2.05]];
    for (const z of [n + 0.05, n + 1.05, n + 2.05]) {
      box(group, '#ecebe7', stallDepth, 1.9, 0.03, x1 - stallDepth / 2, 0.95, z, { material: stallWhite });
      colliders.push(makeCollider(x1 - stallDepth, x1, z - 0.015, z + 0.015, 0, 1.9, '男廁隔間隔板'));
    }
    for (const [za, zb] of zStalls) {
      const zc = (za + zb) / 2;
      box(group, null, 0.03, 1.6, zb - za - 0.06, x1 - stallDepth, 0.95, zc, { material: blue });
      colliders.push(makeCollider(x1 - stallDepth - 0.02, x1 - stallDepth + 0.02, za, zb, 0, 1.9, '男廁隔間門'));
      box(group, '#f5f5f2', 0.55, 0.42, 0.42, x1 - 0.35, 0.42, zc, { material: porcelain });
    }
    box(group, C.metal, stallDepth, 0.03, 2.0, x1 - stallDepth / 2, 1.97, n + 1.05, { material: steel });
  }

  function womenRoom(R) {
    const { x0, x1, zS: s, zN: n } = R;
    // 洗手台（西牆，與男廁相同位置）
    const cz0 = s - 0.6, cz1 = s - 3.4;
    box(group, '#f4f4f1', 0.55, 0.06, cz0 - cz1, x0 + 0.3, 0.88, (cz0 + cz1) / 2, { material: porcelain });
    box(group, '#f4f4f1', 0.55, 0.85, cz0 - cz1, x0 + 0.3, 0.44, (cz0 + cz1) / 2, { material: porcelain });
    colliders.push(makeCollider(x0, x0 + 0.55, cz1, cz0, 0, 0.9, '女廁洗手台'));
    for (const z of [cz0 - 0.5, (cz0 + cz1) / 2, cz1 + 0.5]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.04, 24), porcelain);
      bowl.scale.set(1, 1, 1.4); bowl.position.set(x0 + 0.3, 0.92, z); group.add(bowl);
    }
    box(group, null, 0.02, 0.8, cz0 - cz1, x0 + 0.02, 1.5, (cz0 + cz1) / 2, { material: mirror });
    // 隔間（東側）：3 間，門朝西
    for (let i = 0; i < 3; i++) {
      const z0c = s - 1.0 - i * 1.0;
      box(group, '#ecebe7', 1.4, 1.9, 0.03, x1 - 0.7, 0.95, z0c + 0.5, { material: stallWhite });
      colliders.push(makeCollider(x1 - 1.4, x1, z0c, z0c + 0.03, 0, 1.9, '女廁隔板'));
      box(group, null, 0.03, 1.6, 0.85, x1 - 1.4, 0.95, z0c - 0.45, { material: blue });
      colliders.push(makeCollider(x1 - 1.45, x1 - 1.35, z0c - 0.9, z0c, 0, 1.9, '女廁隔間門'));
    }
  }

  // 男廁（西）：x -21.8 ~ -16.6；女廁（東）：x -16.4 ~ -11.0
  const men = room4(-21.8, -16.6, '男', 10.0);
  const women = room4(-16.4, -11.0, '女', 7.6);
  menRoom(men);
  womenRoom(women);
}

function tileTex(rx, ry) {
  const t = pantryWallTex().clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}
function floorTex() {
  const t = pantryFloorTex().clone();
  t.repeat.set(2, 3);
  t.needsUpdate = true;
  return t;
}
