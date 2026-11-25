import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';
import { doorSpans } from './door.js';
import { geo } from './layout.js';

// 把 [a, b] 扣掉門洞 holes（已排序），回傳剩下的實牆區段
function solidWithHoles(a, b, holes) {
  const segs = [];
  let cur = a;
  for (const [ha, hb] of holes) {
    if (ha > cur) segs.push([cur, ha]);
    cur = Math.max(cur, hb);
  }
  if (b > cur) segs.push([cur, b]);
  return segs;
}

// 走廊：東牆（A、B 的門）、西牆（窗戶；C 的牆與 K413 等門）、北端與南端
export function buildCorridor(scene, colliders) {
  const { room, doors, corridor: K, colors: C, lighting, lobby: Lb } = CONFIG;
  const g = geo();
  const H = room.height, T = room.wallThickness, L = room.length;
  const { xI, xE, xW, z0, zS, zNend, z1 } = g;
  const f = doors.frame, h = doors.height;
  const len = z1 - zNend, zc = (zNend + z1) / 2, xc = (xE + xW) / 2, xMid = (xE + xI) / 2;
  const group = new THREE.Group();
  group.name = 'corridor';
  scene.add(group);
  const wallMat = mat(C.corridorWall, { roughness: 0.95 });
  const glassMat = mat(C.glass, { roughness: 0.15, transparent: true, opacity: 0.45 });
  const blindMat = mat(C.blind, { roughness: 0.9 });
  const cordMat = mat(C.cord, { roughness: 0.6 });
  const spans = doorSpans();
  const eastHoles = spans.filter((s) => s.xOuter === xE).map((s) => [s.z0 - f, s.z1 + f]).sort((p, q) => p[0] - q[0]);
  const winHoles = spans.filter((s) => s.xOuter === xW).map((s) => [s.z0 - f, s.z1 + f]).sort((p, q) => p[0] - q[0]);
  const cA = zS + Lb.cRoomZ, cB = cA + L; // 教室 C 的 z 範圍

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
  for (let z = zNend + 1; z < z1; z += K.stripSpacing) {
    box(group, C.corridorStrip, K.width - 0.2, 0.004, 0.08, xc, 0.002, z);
  }

  // ---------- 天花板：格板 + 平板燈 + 崁燈 + 出風口 + 煙霧偵測器 ----------
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
  const ventMat = mat(C.vent);
  for (let z = zNend + 1.5; z < z1 - 1; z += K.lightSpacing) {
    box(group, C.fixture, 0.66, 0.02, 0.66, xc, H - 0.011, z);
    box(group, null, 0.58, 0.02, 0.58, xc, H - 0.024, z, { material: lampMat });
    const dl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), mat(C.downlight));
    dl.position.set(xc, H - 0.01, z + K.lightSpacing / 2);
    group.add(dl);
    box(group, null, 0.42, 0.02, 0.42, xW + 0.9, H - 0.011, z + 1.4, { material: ventMat });
    const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), mat(C.fixture));
    smoke.position.set(xE - 0.6, H - 0.02, z + 0.8);
    group.add(smoke);
  }
  for (const k of [0.25, 0.75]) {
    const p = new THREE.PointLight('#fff4e4', lighting.pointIntensity * 0.7, 4.5, 1.5);
    p.position.set(xc, H - 0.7, zNend + len * k);
    scene.add(p);
  }

  // ---------- 東牆（A、B 的走廊側）：北段實牆；A、B 之間的門洞；方形空間那段沒有牆 ----------
  const eastSegs = [...solidWithHoles(zNend, zS, []), ...solidWithHoles(z0, z1, eastHoles)];
  for (const [a, b] of eastSegs) {
    box(group, null, T, H, b - a, xMid, H / 2, (a + b) / 2, { material: wallMat });
    colliders.push(makeCollider(xE, xI, a, b, 0, H, '走廊東牆'));
  }
  for (const [ha, hb] of eastHoles) {
    box(group, null, T, H - (h + f), hb - ha, xMid, (h + f + H) / 2, (ha + hb) / 2, { material: wallMat });
  }

  // ---------- 西牆（窗戶牆）：教室 C 的範圍是實牆＋門洞；其餘是窗戶 ----------
  for (const [a, b] of solidWithHoles(cA, cB, winHoles)) {
    box(group, null, T, H, b - a, xW - T / 2, H / 2, (a + b) / 2, { material: wallMat });
  }
  for (const [ha, hb] of winHoles) {
    box(group, null, T, H - (h + f), hb - ha, xW - T / 2, (h + f + H) / 2, (ha + hb) / 2, { material: wallMat });
  }
  const sill = K.windowSill, top = K.windowTop;
  const glassRun = (a, b) => {
    const runLen = b - a;
    if (runLen <= 0.01) return;
    const zc2 = (a + b) / 2;
    box(group, null, T, sill, runLen, xW - T / 2, sill / 2, zc2, { material: wallMat });
    box(group, null, T, H - top, runLen, xW - T / 2, (top + H) / 2, zc2, { material: wallMat });
    box(group, C.sill, 0.2, 0.03, runLen, xW + 0.1, sill + 0.015, zc2, { cast: true });
    const n = Math.max(1, Math.round(runLen / K.windowBay));
    const bay = runLen / n;
    for (let i = 0; i <= n; i++) {
      box(group, C.frame, 0.08, top - sill, 0.07, xW + 0.04, (top + sill) / 2, a + i * bay);
    }
    for (let i = 0; i < n; i++) {
      const bz = a + (i + 0.5) * bay;
      box(group, null, 0.02, top - sill, bay - 0.07, xW + 0.01, (top + sill) / 2, bz, { material: glassMat });
      if (i % 2 === 0) {
        const lowY = 1.25;
        box(group, null, 0.02, top + 0.05 - lowY, bay - 0.1, xW + 0.03, (top + 0.05 + lowY) / 2, bz, { material: blindMat });
        box(group, null, 0.012, top + 0.05 - 0.6, 0.012, xW + 0.045, (top + 0.05 + 0.6) / 2, bz + bay * 0.38, { material: cordMat });
      }
      box(group, C.blind, 0.1, 0.12, bay - 0.1, xW + 0.05, top + 0.07, bz);
    }
  };
  glassRun(zNend, cA);
  glassRun(cB, z1);
  // 窗戶牆的碰撞：玻璃段與 C 的實牆段各自一個；C 的門洞留空（門開時可以進出）
  colliders.push(makeCollider(xW - T, xW, zNend, cA, 0, H, '窗戶牆'));
  colliders.push(makeCollider(xW - T, xW, cB, z1, 0, H, '窗戶牆'));
  for (const [a, b] of solidWithHoles(cA, cB, winHoles)) colliders.push(makeCollider(xW - T, xW, a, b, 0, H, 'C 的牆'));

  // 窗外景色（樹林，用單色平面代替）
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(len + 20, 14), mat(C.outdoor, { roughness: 1 }));
  outside.rotation.y = Math.PI / 2;
  outside.position.set(xW - 3, 5, zc);
  group.add(outside);

  // ---------- 踢腳板 ----------
  const sd = room.skirtingDepth, sh = room.skirtingHeight;
  for (const [a, b] of eastSegs) {
    box(group, C.corridorSkirting, sd, sh, b - a, xE - sd / 2, sh / 2, (a + b) / 2);
  }
  box(group, C.corridorSkirting, sd, sh, len, xW + sd / 2, sh / 2, zc);

  // ---------- 北端牆 ----------
  box(group, null, K.width, H, T, xc, H / 2, zNend - T / 2, { material: wallMat });
  colliders.push(makeCollider(xW, xE, zNend - T, zNend, 0, H, '走廊北端牆'));

  // ---------- 南端：窗戶加捲簾（照片：後門左手邊） ----------
  const zB = z1 + T / 2;
  box(group, null, K.width, sill, T, xc, sill / 2, zB, { material: wallMat });
  box(group, null, K.width, H - top, T, xc, (top + H) / 2, zB, { material: wallMat });
  colliders.push(makeCollider(xW, xE, z1, z1 + T, 0, H, '走廊南端窗牆'));
  box(group, null, K.width - 0.1, top - sill, 0.02, xc, (top + sill) / 2, z1 - 0.01, { material: glassMat });
  const nMull = 3;
  for (let i = 0; i <= nMull; i++) {
    box(group, C.frame, 0.07, top - sill, 0.08, xW + (i * K.width) / nMull, (top + sill) / 2, z1 - 0.03);
  }
  for (let j = 0; j < 2; j++) {
    const bx = xW + K.width / 4 + (j * K.width) / 2;
    box(group, null, K.width / 2 - 0.12, top + 0.05 - 1.25, 0.02, bx, (top + 0.05 + 1.25) / 2, z1 - 0.05, { material: blindMat });
    box(group, C.blind, K.width / 2 - 0.1, 0.12, 0.1, bx, top + 0.07, z1 - 0.06);
  }
  const endOutside = new THREE.Mesh(new THREE.PlaneGeometry(K.width + 20, 14), mat(C.outdoor, { roughness: 1 }));
  endOutside.rotation.y = Math.PI;
  endOutside.position.set(xc, 5, z1 + 4);
  group.add(endOutside);

  // ---------- 教室外牆的告示牌（A、B 的走廊面；C 的窗戶牆面） ----------
  const board = (x, z) => {
    box(group, C.acrylic, 0.012, 0.7, 0.6, x, 1.35, z);
    for (const dy of [-0.3, 0.3]) for (const dz of [-0.26, 0.26]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), mat(C.metal));
      m.position.set(x + (x > xc ? -0.012 : 0.012), 1.35 + dy, z + dz);
      group.add(m);
    }
  };
  for (const z of [-1.0, 1.5, -8.0, -10.0]) board(xE - 0.006, z);
  for (const z of [cA + 3.5, cA + 5.5]) board(xW + 0.006, z);

  // ---------- 滅火器箱（白色，紅色警示燈）與天花板指示牌 ----------
  const cabZ = 6.0;
  box(group, C.hydrant, 0.2, 0.9, 0.9, xE - 0.1, 1.2, cabZ);
  box(group, C.hydrantRed, 0.21, 0.08, 0.6, xE - 0.1, 1.5, cabZ);
  colliders.push(makeCollider(xE - 0.2, xE, cabZ - 0.45, cabZ + 0.45, 0, 1.65, '消防栓箱'));
  box(group, C.sign, K.width * 0.8, 0.35, 0.05, xc, 2.45, 1.0);
  box(group, C.metal, 0.02, 0.2, 0.02, xc - 0.8, 2.7, 1.0);
  box(group, C.metal, 0.02, 0.2, 0.02, xc + 0.8, 2.7, 1.0);
}
