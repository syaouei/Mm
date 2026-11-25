import * as THREE from 'three';
import { CONFIG } from './config.js';

// 碰撞框格式：{ minX, maxX, minY, maxY, minZ, maxZ, label }
export function makeCollider(minX, maxX, minZ, maxZ, minY, maxY, label) {
  return { minX, maxX, minZ, maxZ, minY, maxY, label };
}

const matCache = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra }));
  }
  return matCache.get(key);
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);

// 以中心點與尺寸建立方塊
export function box(parent, color, sx, sy, sz, x, y, z, opts = {}) {
  const m = new THREE.Mesh(unitBox, opts.material || mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  parent.add(m);
  return m;
}

// 程式產生的格線貼圖（不使用外部圖片）：一格磚 + 邊緣磚縫
export function gridTexture(fill, line, px = 128, lineWidth = 3) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = fill;
  g.fillRect(0, 0, px, px);
  g.fillStyle = line;
  g.fillRect(0, 0, px, lineWidth);
  g.fillRect(0, 0, lineWidth, px);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildRoom(scene) {
  const { room, pillar, doors, colors: C, lighting } = CONFIG;
  const W = room.width, L = room.length, H = room.height, T = room.wallThickness;
  const xMin = -W / 2, xMax = W / 2, zMin = -L / 2, zMax = L / 2;
  const group = new THREE.Group();
  group.name = 'room';
  scene.add(group);
  const colliders = [];

  // ---------- 地板 ----------
  const floorTex = gridTexture(C.floor, C.grout, 128, 3);
  floorTex.repeat.set(W / room.floorTile, L / room.floorTile);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, L),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // ---------- 天花板（輕鋼架格板） ----------
  const ceilTex = gridTexture(C.ceiling, C.ceilingGrid, 128, 4);
  ceilTex.repeat.set(W / room.ceilingTile, L / room.ceilingTile);
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(W, L),
    new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  group.add(ceiling);

  // ---------- 四面牆（方塊在房間外側，內面貼齊邊界） ----------
  const wallMat = mat(C.wall, { roughness: 0.95 });
  const walls = [
    // [sx, sz, cx, cz, label]
    [W + 2 * T, T, 0, zMin - T / 2, '前牆'],
    [W + 2 * T, T, 0, zMax + T / 2, '後牆'],
    [T, L, xMax + T / 2, 0, '窗側牆'],
  ];
  for (const [sx, sz, cx, cz, label] of walls) {
    box(group, null, sx, H, sz, cx, H / 2, cz, { material: wallMat });
    colliders.push(makeCollider(cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2, 0, H, label));
  }

  // ---------- 後牆柱子（貫穿到天花板） ----------
  const pMinX = pillar.centerX - pillar.width / 2, pMaxX = pillar.centerX + pillar.width / 2;
  const pMinZ = zMax - pillar.depth;
  box(group, null, pillar.width, H, pillar.depth, pillar.centerX, H / 2, zMax - pillar.depth / 2, { material: wallMat });
  colliders.push(makeCollider(pMinX, pMaxX, pMinZ, zMax, 0, H, '柱子'));

  // ---------- 門（教室內側的雙門為裝飾；後門在 door.js，走廊側牆在 corridor.js） ----------
  const doorX = xMin;
  const backDoor = {
    z0: zMax - doors.back.distFromBackWall - doors.back.width,
    z1: zMax - doors.back.distFromBackWall,
  };
  const frontDoor = {
    z0: zMin + doors.front.distFromFrontWall,
    z1: zMin + doors.front.distFromFrontWall + doors.front.width,
  };
  function buildDoor({ z0, z1 }, leaves) {
    const f = doors.frame, h = doors.height;
    // 門框
    box(group, C.doorFrame, 0.04, h + f, f, doorX + 0.02, (h + f) / 2, z0 - f / 2);
    box(group, C.doorFrame, 0.04, h + f, f, doorX + 0.02, (h + f) / 2, z1 + f / 2);
    box(group, C.doorFrame, 0.04, f, z1 - z0 + 2 * f, doorX + 0.02, h + f / 2, (z0 + z1) / 2);
    // 門板
    let z = z0;
    for (const frac of leaves) {
      const w = (z1 - z0) * frac;
      box(group, C.door, 0.035, h, w - 0.006, doorX + 0.02, h / 2, z + w / 2);
      // 門把
      const handleZ = frac === leaves[0] && leaves.length > 1 ? z + w - 0.08 : z + 0.08;
      box(group, C.metal, 0.05, 0.02, 0.12, doorX + 0.06, 1.0, handleZ + (handleZ < z + w / 2 ? 0.04 : -0.04));
      if (leaves.length > 1 && frac === leaves[0]) {
        // 雙門大片門上的小玻璃窗
        box(group, '#d8e4e6', 0.04, 0.45, 0.14, doorX + 0.022, 1.45, z + w / 2, {
          material: mat('#cfdcdf', { roughness: 0.2 }),
        });
      }
      z += w;
    }
  }

  // 時鐘（門側牆，雙門旁）
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), mat(C.clock));
  clock.rotation.z = Math.PI / 2;
  clock.position.set(xMin + 0.03, 2.35, frontDoor.z1 + 0.35);
  group.add(clock);
  box(group, '#222', 0.01, 0.1, 0.012, xMin + 0.052, 2.38, frontDoor.z1 + 0.35);
  box(group, '#222', 0.01, 0.012, 0.08, xMin + 0.052, 2.35, frontDoor.z1 + 0.38);
  // 電燈開關面板
  box(group, '#f4f4f0', 0.02, 0.12, 0.08, xMin + 0.01, 1.25, backDoor.z0 - 0.35);
  box(group, '#f4f4f0', 0.02, 0.12, 0.08, xMin + 0.01, 1.25, frontDoor.z1 + 0.25);

  // ---------- 踢腳板（避開門與柱子） ----------
  const sh = room.skirtingHeight, sd = room.skirtingDepth;
  const skirt = (sx, sz, cx, cz) => box(group, C.skirting, sx, sh, sz, cx, sh / 2, cz);
  skirt(W, sd, 0, zMin + sd / 2); // 前牆
  // 後牆（柱子左右兩段 + 柱子三面）
  skirt(pMinX - xMin, sd, (xMin + pMinX) / 2, zMax - sd / 2);
  skirt(xMax - pMaxX, sd, (pMaxX + xMax) / 2, zMax - sd / 2);
  skirt(pillar.width + 2 * sd, sd, pillar.centerX, pMinZ - sd / 2);
  skirt(sd, pillar.depth, pMinX - sd / 2, zMax - pillar.depth / 2);
  skirt(sd, pillar.depth, pMaxX + sd / 2, zMax - pillar.depth / 2);
  skirt(sd, L, xMax - sd / 2, 0); // 窗側牆
  // 門側牆：分段避開兩扇門
  const segs = [
    [zMin, frontDoor.z0 - doors.frame],
    [frontDoor.z1 + doors.frame, backDoor.z0 - doors.frame],
    [backDoor.z1 + doors.frame, zMax],
  ];
  for (const [a, b] of segs) if (b > a) skirt(sd, b - a, xMin + sd / 2, (a + b) / 2);

  // ---------- 前牆：白板、布幕捲筒、白板燈、講桌、喇叭 ----------
  const wbX0 = -3.2, wbX1 = 1.0; // 白板左右範圍 — 估計
  const wbW = wbX1 - wbX0, wbCx = (wbX0 + wbX1) / 2;
  box(group, C.whiteboardFrame, wbW + 0.06, 1.26, 0.03, wbCx, 1.53, zMin + 0.015);
  box(group, null, wbW, 1.2, 0.035, wbCx, 1.53, zMin + 0.02, { material: mat(C.whiteboard, { roughness: 0.3 }) });
  box(group, C.whiteboardFrame, wbW, 0.03, 0.07, wbCx, 0.9, zMin + 0.04); // 筆槽
  // 投影布幕捲筒（收起狀態）
  box(group, '#f0f0ee', 3.0, 0.08, 0.08, -2.0, H - 0.18, zMin + 0.05);
  box(group, '#f0f0ee', 3.0, 0.08, 0.08, 2.4, H - 0.18, zMin + 0.05);
  // 白板照明燈（吊在前方）
  for (const x of [-2.6, 0.2]) {
    box(group, C.fixture, 1.2, 0.08, 0.14, x, H - 0.45, zMin + 0.5);
    box(group, C.metal, 0.015, 0.37, 0.015, x - 0.45, H - 0.22, zMin + 0.5);
    box(group, C.metal, 0.015, 0.37, 0.015, x + 0.45, H - 0.22, zMin + 0.5);
  }
  // 講桌（木紋色正面 + 灰色桌面 + 側邊小桌）
  const lecX = 0.6, lecZ = zMin + 0.75;
  box(group, C.lectern, 0.9, 1.0, 0.55, lecX, 0.5, lecZ, { cast: true });
  box(group, '#5c5f63', 0.92, 0.04, 0.58, lecX, 1.02, lecZ, { cast: true });
  box(group, '#e9e9e6', 0.6, 0.03, 0.35, lecX + 0.75, 0.95, lecZ - 0.05, { cast: true });
  box(group, C.metal, 0.03, 0.95, 0.03, lecX + 0.95, 0.475, lecZ - 0.05);
  colliders.push(makeCollider(lecX - 0.45, lecX + 1.05, lecZ - 0.29, lecZ + 0.29, 0, 1.05, '講桌'));
  // 前牆喇叭
  buildSpeaker(group, -4.0, 2.4, zMin + 0.08, 0, '#202022');
  buildSpeaker(group, 1.3, 2.45, zMin + 0.08, 0, C.speaker);

  // ---------- 後牆：PTZ 攝影機、左右喇叭 ----------
  const camX = 0.0; // 柱子左側（面向後牆時）
  box(group, C.camera, 0.06, 0.03, 0.22, camX, 2.18, zMax - 0.11); // 支架
  box(group, C.camera, 0.16, 0.06, 0.16, camX, 2.22, zMax - 0.14); // 底座
  box(group, C.camera, 0.12, 0.12, 0.12, camX, 2.31, zMax - 0.14); // 鏡頭罩
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 16), mat('#000'));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(camX, 2.31, zMax - 0.21);
  group.add(lens);
  box(group, '#f5f5f5', 0.03, 2.1, 0.03, camX, 1.05, zMax - 0.015); // 白色線槽
  buildSpeaker(group, 2.8, 2.45, zMax - 0.08, Math.PI, C.speaker);
  buildSpeaker(group, -3.3, 2.45, zMax - 0.08, Math.PI, C.speaker);

  // ---------- 窗側牆：捲簾 ----------
  const blindTop = H - 0.12, blindBottom = 0.95;
  const bz0 = zMin + 2.2, bz1 = zMax - 1.2, nBlinds = 4;
  const bw = (bz1 - bz0) / nBlinds;
  box(group, '#f2f2f0', 0.08, 0.04, bz1 - bz0 + 0.1, xMax - 0.04, blindBottom - 0.04, (bz0 + bz1) / 2); // 窗台
  for (let i = 0; i < nBlinds; i++) {
    const cz = bz0 + bw * (i + 0.5);
    box(group, C.blind, 0.02, blindTop - blindBottom, bw - 0.04, xMax - 0.05, (blindTop + blindBottom) / 2, cz);
    box(group, '#ececea', 0.07, 0.07, bw - 0.02, xMax - 0.05, blindTop + 0.035, cz); // 捲筒盒
    box(group, '#2d3338', 0.015, blindTop - blindBottom, 0.012, xMax - 0.04, (blindTop + blindBottom) / 2, bz0 + bw * i + 0.01); // 拉繩軌
  }

  // ---------- 天花板設備 ----------
  const lights = buildCeiling(group, W, L, H);

  // ---------- 光源 ----------
  const hemi = new THREE.HemisphereLight('#ffffff', '#c9c6bd', lighting.ambient);
  scene.add(hemi);

  // 一盞方向光負責陰影（只算一次 shadow pass，效能最好）
  const sun = new THREE.DirectionalLight('#ffffff', lighting.sun);
  sun.position.set(1.2, H + 4, 1.5);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lighting.shadowMapSize, lighting.shadowMapSize);
  const half = Math.max(W / 2 + T + CONFIG.corridor.width, L / 2 + Math.max(CONFIG.corridor.frontExtend, CONFIG.corridor.backExtend)) + 1;
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: H + 25 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  // 少量 PointLight（不投影陰影），平均挑幾盞燈管
  const n = Math.min(lighting.pointLightCount, lights.length);
  for (let i = 0; i < n; i++) {
    const src = lights[Math.floor(((i + 0.5) * lights.length) / n)];
    const p = new THREE.PointLight('#fffaf0', lighting.pointIntensity, lighting.pointDistance, 1.5);
    p.position.set(src.x, H - 0.7, src.z); // 稍微往下，避免天花板出現亮斑
    scene.add(p);
  }

  return { group, colliders };
}

function buildSpeaker(parent, x, y, z, rotY, color) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  box(g, color, 0.2, 0.28, 0.14, 0, 0, 0);
  box(g, '#3b3b3d', 0.16, 0.2, 0.01, 0, -0.01, 0.07); // 網罩
  parent.add(g);
}

// 天花板：燈管、冷氣出風口、吊扇格柵、圓形喇叭、煙霧偵測器、投影機
function buildCeiling(group, W, L, H) {
  const { lighting, colors: C } = CONFIG;
  const lightMat = new THREE.MeshStandardMaterial({
    color: C.lightPanel, emissive: '#ffffff', emissiveIntensity: 1.0, roughness: 0.4,
  });
  const housingMat = mat(C.fixture);
  const positions = [];
  const cols = lighting.fixtureCols, rows = lighting.fixtureRows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols - 0.5) * W;
      const z = ((r + 0.5) / rows - 0.5) * L;
      positions.push({ x, z });
      // 燈具外框 + 兩支發光燈管
      box(group, null, lighting.fixtureWidth + 0.04, 0.03, lighting.fixtureLength + 0.04, x, H - 0.012, z, { material: housingMat });
      for (const dx of [-0.07, 0.07]) {
        box(group, null, 0.035, 0.03, lighting.fixtureLength - 0.06, x + dx, H - 0.03, z, { material: lightMat });
      }
    }
  }

  // 冷氣出風口（方形）與吊扇格柵，放在燈與燈之間
  const ventMat = mat(C.vent);
  const slotMat = mat('#9da1a3');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = positions[r * cols + c], b = positions[r * cols + c + 1];
      const x = (a.x + b.x) / 2, z = a.z + ((r + c) % 2 === 0 ? 0.9 : -0.9);
      box(group, null, 0.58, 0.02, 0.58, x, H - 0.01, z, { material: ventMat });
      if ((r + c) % 2 === 0) {
        // 方形擴散出風口：同心方框
        box(group, null, 0.36, 0.025, 0.36, x, H - 0.015, z, { material: slotMat });
        box(group, null, 0.22, 0.03, 0.22, x, H - 0.02, z, { material: ventMat });
      } else {
        // 吊扇（嵌入式循環扇）：圓形格柵
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24), slotMat);
        fan.position.set(x, H - 0.02, z);
        group.add(fan);
      }
    }
  }

  // 圓形吸頂喇叭、煙霧偵測器
  const round = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), mat('#f6f6f4'));
  round.position.set(0.9, H - 0.01, -L / 2 + 3.2);
  group.add(round);
  const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 16), mat('#fafafa'));
  smoke.position.set(-1.2, H - 0.025, 0.8);
  group.add(smoke);

  // 投影機（兩台，對著前牆布幕）
  for (const x of [-2.0, 2.4]) {
    const z = -L / 2 + 4.3;
    box(group, C.metal, 0.04, 0.3, 0.04, x, H - 0.15, z); // 吊桿
    box(group, '#2a2a2a', 0.12, 0.04, 0.12, x, H - 0.31, z);
    box(group, C.projector, 0.38, 0.13, 0.32, x, H - 0.39, z, { cast: false });
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16), mat('#111'));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x + 0.1, H - 0.39, z - 0.17);
    group.add(lens);
  }

  return positions;
}
