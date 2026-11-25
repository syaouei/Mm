import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';
import { doorSpans } from './door.js';

// 教室外的走廊（照片：窗戶在一側，教室與其他房間的門在另一側，天花板是格板）
// 座標：走廊側牆面 x = xE（教室外牆）；窗戶牆內面 x = xW；走廊沿 z 方向延伸
// 左手（+z，後門的另一側）為電梯端；右手（-z）是教室前門，再往前是隔壁教室
export function buildCorridor(scene, colliders) {
  const { room, doors, corridor: K, colors: C, lighting } = CONFIG;
  const W = room.width, L = room.length, H = room.height, T = room.wallThickness;
  const xI = -W / 2;        // 教室內側牆面
  const xE = xI - T;        // 走廊側牆面（門、告示板、滅火器箱都裝在這一面）
  const xW = xE - K.width;  // 窗戶牆內面
  const z0 = -L / 2 - K.frontExtend, z1 = L / 2 + K.backExtend;
  const len = z1 - z0, zc = (z0 + z1) / 2, xc = (xE + xW) / 2, xMid = (xE + xI) / 2;
  const f = doors.frame, h = doors.height;

  const group = new THREE.Group();
  group.name = 'corridor';
  scene.add(group);
  const wallMat = mat(C.corridorWall, { roughness: 0.95 });
  // 小零件（螺絲、按鈕）用的圓球
  const dot = (x, y, z, r = 0.018) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(C.metal));
    m.position.set(x, y, z);
    group.add(m);
  };

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
  for (let z = z0 + 1.5; z < z1 - 1; z += K.lightSpacing) {
    // 平板燈（方形，照片的格板燈）
    box(group, C.fixture, 0.66, 0.02, 0.66, xc, H - 0.011, z);
    box(group, null, 0.58, 0.02, 0.58, xc, H - 0.024, z, { material: lampMat });
    // 崁燈：照片中有圓形白色的崁燈
    const dl = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), mat(C.downlight));
    dl.position.set(xc, H - 0.01, z + K.lightSpacing / 2);
    group.add(dl);
    // 出風口（方格柵）
    box(group, null, 0.42, 0.02, 0.42, xW + 0.9, H - 0.011, z + 1.4, { material: ventMat });
    // 煙霧偵測器
    const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), mat(C.fixture));
    smoke.position.set(xE - 0.6, H - 0.02, z + 0.8);
    group.add(smoke);
  }
  // 走廊補光（不投影陰影）
  for (const k of [0.2, 0.5, 0.8]) {
    const p = new THREE.PointLight('#fff4e4', lighting.pointIntensity * 0.7, 4.5, 1.5);
    p.position.set(xc, H - 0.7, z0 + len * k);
    scene.add(p);
  }

  // ---------- 教室側牆（走廊側）：門的位置留開口，上方為過樑 ----------
  const holes = doorSpans().map((s) => [s.z0 - f, s.z1 + f]).sort((p, q) => p[0] - q[0]);
  const segs = [];
  let cur = z0;
  for (const [a, b] of holes) {
    segs.push([cur, a]);
    cur = b;
  }
  segs.push([cur, z1]);
  for (const [a, b] of segs) {
    box(group, null, T, H, b - a, xMid, H / 2, (a + b) / 2, { material: wallMat });
    colliders.push(makeCollider(xE, xI, a, b, 0, H, '走廊東牆'));
  }
  for (const [a, b] of holes) {
    box(group, null, T, H - (h + f), b - a, xMid, (h + f + H) / 2, (a + b) / 2, { material: wallMat });
  }

  // ---------- 窗戶牆：窗台以下、窗上以上是實牆，中間是玻璃、捲簾與窗台 ----------
  const sill = K.windowSill, top = K.windowTop;
  box(group, null, T, sill, len, xW - T / 2, sill / 2, zc, { material: wallMat });
  box(group, null, T, H - top, len, xW - T / 2, (top + H) / 2, zc, { material: wallMat });
  colliders.push(makeCollider(xW - T, xW, z0, z1, 0, H, '窗戶牆'));
  // 窗台（淺灰石材）
  box(group, C.sill, 0.2, 0.03, len, xW + 0.1, sill + 0.015, zc, { cast: true });
  const bays = Math.max(1, Math.round(len / K.windowBay));
  const bay = len / bays;
  const glassMat = mat(C.glass, { roughness: 0.15, transparent: true, opacity: 0.45 });
  const blindMat = mat(C.blind, { roughness: 0.9 });
  const cordMat = mat(C.cord, { roughness: 0.6 });
  for (let i = 0; i <= bays; i++) {
    box(group, C.frame, 0.08, top - sill, 0.07, xW + 0.04, (top + sill) / 2, z0 + i * bay);
  }
  for (let i = 0; i < bays; i++) {
    const bz = z0 + (i + 0.5) * bay;
    box(group, null, 0.02, top - sill, bay - 0.07, xW + 0.01, (top + sill) / 2, bz, { material: glassMat });
    if (i % 2 === 0) {
      // 捲簾：放下一半，附白色拉繩
      const lowY = 1.25;
      box(group, null, 0.02, top + 0.05 - lowY, bay - 0.1, xW + 0.03, (top + 0.05 + lowY) / 2, bz, { material: blindMat });
      box(group, null, 0.012, top + 0.05 - 0.6, 0.012, xW + 0.045, (top + 0.05 + 0.6) / 2, bz + bay * 0.38, { material: cordMat });
    }
    // 捲筒盒（金屬）
    box(group, C.blind, 0.1, 0.12, bay - 0.1, xW + 0.05, top + 0.07, bz);
  }
  // 避難器具標示（金色）與逃生窗標示（紅）
  box(group, C.brass, 0.02, 0.22, 0.9, xW + 0.15, top + 0.22, z0 + 4.0);
  box(group, '#c0392b', 0.02, 0.5, 0.12, xW + 0.12, 1.5, z0 + 9.0);
  // 窗外景色（樹林，用單色平面代替）
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(len + 20, 14), mat(C.outdoor, { roughness: 1 }));
  outside.rotation.y = Math.PI / 2;
  outside.position.set(xW - 3, 5, zc);
  group.add(outside);

  // ---------- 柱子（窗側，照片中靠近窗戶的 RC 柱）與柱上的監視器 ----------
  const colZ = -1.5, colW = 0.6, colD = 0.6;
  box(group, null, colD, H, colW, xW + colD / 2, H / 2, colZ, { material: wallMat });
  colliders.push(makeCollider(xW, xW + colD, colZ - colW / 2, colZ + colW / 2, 0, H, '柱子'));
  box(group, C.cctv, 0.22, 0.12, 0.12, xW + colD + 0.1, 2.5, colZ);
  const ir = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), mat(C.irPink, { emissive: C.irPink, emissiveIntensity: 1 }));
  ir.rotation.z = Math.PI / 2;
  ir.position.set(xW + colD + 0.22, 2.5, colZ);
  group.add(ir);
  box(group, C.exitGreen, 0.02, 0.2, 0.36, xW + colD + 0.01, 2.25, colZ - 0.5); // 出口指示

  // ---------- 踢腳板（避開門口） ----------
  const sd = room.skirtingDepth, sh = room.skirtingHeight;
  for (const [a, b] of segs) {
    box(group, C.corridorSkirting, sd, sh, b - a, xE - sd / 2, sh / 2, (a + b) / 2);
  }
  box(group, C.corridorSkirting, sd, sh, len, xW + sd / 2, sh / 2, zc);

  // ---------- 走廊兩端的牆 ----------
  // 前端（-z）沒有牆：開口通往方形大廳（lobby.js）

  // ---------- 後端（+z 盡頭）：窗戶加捲簾（照片：後門左手邊） ----------
  const zB = z1 + T / 2;
  box(group, null, K.width, sill, T, xc, sill / 2, zB, { material: wallMat });
  box(group, null, K.width, H - top, T, xc, (top + H) / 2, zB, { material: wallMat });
  colliders.push(makeCollider(xW, xE, z1, z1 + T, 0, H, '走廊端窗牆'));
  const endGlass = mat(C.glass, { roughness: 0.15, transparent: true, opacity: 0.45 });
  box(group, null, K.width - 0.1, top - sill, 0.02, xc, (top + sill) / 2, z1 - 0.01, { material: endGlass });
  const nMull = 3;
  for (let i = 0; i <= nMull; i++) {
    box(group, C.frame, 0.07, top - sill, 0.08, xW + (i * K.width) / nMull, (top + sill) / 2, z1 - 0.03);
  }
  for (let j = 0; j < 2; j++) {
    const bx = xW + K.width / 4 + (j * K.width) / 2;
    box(group, null, K.width / 2 - 0.12, top + 0.05 - 1.25, 0.02, bx, (top + 0.05 + 1.25) / 2, z1 - 0.05, { material: mat(C.blind, { roughness: 0.9 }) });
    box(group, C.blind, K.width / 2 - 0.1, 0.12, 0.1, bx, top + 0.07, z1 - 0.06);
  }
  const endOutside = new THREE.Mesh(new THREE.PlaneGeometry(K.width + 20, 14), mat(C.outdoor, { roughness: 1 }));
  endOutside.rotation.y = Math.PI;
  endOutside.position.set(xc, 5, z1 + 4);
  group.add(endOutside);

  // ---------- 牆面：告示板（四角螺絲）、消防栓箱、警報鈴、開關 ----------
  for (const z of [0.0, 0.9]) {
    box(group, C.acrylic, 0.012, 0.7, 0.6, xE - 0.006, 1.35, z);
    for (const dy of [-0.35, 0.35]) for (const dz of [-0.3, 0.3]) dot(xE - 0.014, 1.35 + dy, z + dz);
  }
  // 消防栓箱（白色，紅字條與紅色警示燈）
  const cabZ = 6.0;
  box(group, C.hydrant, 0.2, 0.9, 0.9, xE - 0.1, 1.2, cabZ);
  box(group, C.hydrantRed, 0.21, 0.08, 0.6, xE - 0.1, 1.5, cabZ);
  const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(C.hydrantRed, { emissive: C.hydrantRed, emissiveIntensity: 1 }));
  redLight.position.set(xE - 0.21, 1.7, cabZ - 0.25);
  group.add(redLight);
  colliders.push(makeCollider(xE - 0.2, xE, cabZ - 0.45, cabZ + 0.45, 0, 1.65, '消防栓箱'));
  // 火災警報鈴（紅色）
  box(group, C.hydrantRed, 0.08, 0.14, 0.1, xE - 0.04, 1.9, -3.0);
  // 電燈開關面板
  for (const z of [-3.6, 2.2]) box(group, C.switchPlate, 0.02, 0.1, 0.08, xE - 0.01, 1.2, z);

  // ---------- 天花板吊掛的指示牌（綠色，橫跨走廊） ----------
  const signZ = 1.0;
  box(group, C.sign, K.width * 0.8, 0.35, 0.05, xc, 2.45, signZ);
  box(group, C.metal, 0.02, 0.2, 0.02, xc - 0.8, 2.7, signZ);
  box(group, C.metal, 0.02, 0.2, 0.02, xc + 0.8, 2.7, signZ);
}
