import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';
import { backDoorSpan } from './door.js';

// 教室外的走廊（照片：窗戶在一側，其他教室門在另一側，天花板是格板燈）
// 座標：走廊側牆面 x = xE（教室外牆）；窗戶牆內面 x = xW；走廊沿 z 方向延伸
export function buildCorridor(scene, colliders) {
  const { room, doors, corridor: K, colors: C, lighting } = CONFIG;
  const W = room.width, L = room.length, H = room.height, T = room.wallThickness;
  const xI = -W / 2;        // 教室內側牆面
  const xE = xI - T;        // 走廊側牆面（門、告示板、滅火器箱都裝在這一面）
  const xW = xE - K.width;  // 窗戶牆內面
  const z0 = -L / 2 - K.extend, z1 = L / 2 + K.extend;
  const len = z1 - z0, zc = (z0 + z1) / 2, xc = (xE + xW) / 2, xMid = (xE + xI) / 2;
  const f = doors.frame, h = doors.height;
  const { z0: dz0, z1: dz1 } = backDoorSpan();

  const group = new THREE.Group();
  group.name = 'corridor';
  scene.add(group);
  const wallMat = mat(C.corridorWall, { roughness: 0.95 });

  // ---------- 地板：深灰磚 + 淺色導引線 ----------
  const floorTex = gridTexture(C.corridorFloor, C.corridorGrout, 128, 3);
  floorTex.repeat.set(K.width / room.floorTile, len / room.floorTile);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(K.width, len),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(xc, 0, zc);
  floor.receiveShadow = true;
  group.add(floor);
  for (let z = z0 + 1.0; z < z1; z += K.stripSpacing) {
    box(group, C.corridorStrip, K.width - 0.2, 0.004, 0.08, xc, 0.002, z);
  }

  // ---------- 天花板：格板 + 燈管 + 煙霧偵測器 ----------
  const ceilTex = gridTexture(C.ceiling, C.ceilingGrid, 128, 4);
  ceilTex.repeat.set(K.width / room.ceilingTile, len / room.ceilingTile);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(K.width, len),
    new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(xc, H, zc);
  group.add(ceil);
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.4,
  });
  for (let z = z0 + 1.5; z < z1 - 1; z += K.lightSpacing) {
    box(group, C.fixture, 0.5, 0.03, 1.3, xc, H - 0.012, z);
    box(group, null, 0.3, 0.03, 1.1, xc, H - 0.03, z, { material: lampMat });
    const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), mat(C.fixture));
    smoke.position.set(xc + 0.6, H - 0.02, z + 0.6);
    group.add(smoke);
  }
  // 走廊補光（不投影陰影）
  for (const k of [0.3, 0.7]) {
    const p = new THREE.PointLight('#fff4e4', lighting.pointIntensity * 0.8, 4.5, 1.5);
    p.position.set(xc, H - 0.7, z0 + len * k);
    scene.add(p);
  }

  // ---------- 教室側牆（走廊側）：後門開口留空，上方為過樑 ----------
  for (const [a, b] of [[z0, dz0 - f], [dz1 + f, z1]]) {
    box(group, null, T, H, b - a, xMid, H / 2, (a + b) / 2, { material: wallMat });
    colliders.push(makeCollider(xE, xI, a, b, 0, H, '走廊東牆'));
  }
  box(group, null, T, H - (h + f), dz1 + f - (dz0 - f), xMid, (h + f + H) / 2, (dz0 + dz1) / 2, { material: wallMat });

  // ---------- 窗戶牆：窗台以下、窗上以上是實牆，中間是玻璃與捲簾 ----------
  const sill = K.windowSill, top = K.windowTop;
  box(group, null, T, sill, len, xW - T / 2, sill / 2, zc, { material: wallMat });
  box(group, null, T, H - top, len, xW - T / 2, (top + H) / 2, zc, { material: wallMat });
  colliders.push(makeCollider(xW - T, xW, z0, z1, 0, H, '窗戶牆'));
  const bays = Math.max(1, Math.round(len / K.windowBay));
  const bay = len / bays;
  const glassMat = mat(C.glass, { roughness: 0.15, transparent: true, opacity: 0.45 });
  const blindMat = mat(C.blind, { roughness: 0.9 });
  for (let i = 0; i <= bays; i++) {
    box(group, C.frame, 0.08, top - sill, 0.07, xW + 0.04, (top + sill) / 2, z0 + i * bay);
  }
  for (let i = 0; i < bays; i++) {
    const bz = z0 + (i + 0.5) * bay;
    box(group, null, 0.02, top - sill, bay - 0.07, xW + 0.01, (top + sill) / 2, bz, { material: glassMat });
    if (i % 2 === 0) {
      // 捲簾：有些放下一半，有些收在上方
      const lowY = 1.25;
      box(group, null, 0.02, top + 0.05 - lowY, bay - 0.1, xW + 0.03, (top + 0.05 + lowY) / 2, bz, { material: blindMat });
    }
    box(group, C.blind, 0.1, 0.12, bay - 0.1, xW + 0.05, top + 0.07, bz);
  }
  // 窗外景色（樹林，用單色平面代替）
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(len + 20, 14), mat(C.outdoor, { roughness: 1 }));
  outside.rotation.y = Math.PI / 2;
  outside.position.set(xW - 3, 5, zc);
  group.add(outside);

  // ---------- 踢腳板 ----------
  const sd = room.skirtingDepth, sh = room.skirtingHeight;
  for (const [a, b] of [[z0, dz0 - f], [dz1 + f, z1]]) {
    box(group, C.corridorSkirting, sd, sh, b - a, xE - sd / 2, sh / 2, (a + b) / 2);
  }
  box(group, C.corridorSkirting, sd, sh, len, xW + sd / 2, sh / 2, zc);

  // ---------- 走廊兩端的牆 ----------
  for (const zz of [z0 - T / 2, z1 + T / 2]) {
    box(group, null, K.width, H, T, xc, H / 2, zz, { material: wallMat });
    colliders.push(makeCollider(xW, xE, zz - T / 2, zz + T / 2, 0, H, '走廊端牆'));
  }

  // ---------- 牆面裝飾：其他教室的門、告示板、滅火器箱 ----------
  for (const d of [{ z: -7.8, w: 1.5 }, { z: -2.0, w: 0.9 }, { z: 8.2, w: 0.9 }]) {
    const a = d.z - d.w / 2, b = d.z + d.w / 2, x = xE - 0.015;
    box(group, C.doorFrame, 0.03, h + f, f, x, (h + f) / 2, a - f / 2);
    box(group, C.doorFrame, 0.03, h + f, f, x, (h + f) / 2, b + f / 2);
    box(group, C.doorFrame, 0.03, f, d.w + 2 * f, x, h + f / 2, d.z);
    const leaves = d.w > 1.2 ? [0.5, 0.5] : [1]; // 寬的是雙門
    let zz = a;
    for (const fr of leaves) {
      const lw = d.w * fr;
      box(group, C.door, 0.025, h, lw - 0.008, xE - 0.03, h / 2, zz + lw / 2);
      zz += lw;
    }
    box(group, C.metal, 0.05, 0.02, 0.12, xE - 0.05, 1.0, b - 0.1);
  }
  for (const z of [2.6, 3.5]) {
    box(group, C.acrylic, 0.012, 0.7, 0.6, xE - 0.006, 1.35, z);
  }
  const cabZ = 7.0;
  box(group, C.extinguisher, 0.18, 0.6, 0.42, xE - 0.09, 0.95, cabZ);
  colliders.push(makeCollider(xE - 0.18, xE, cabZ - 0.21, cabZ + 0.21, 0, 1.25, '滅火器箱'));
}
