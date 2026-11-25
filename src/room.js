import * as THREE from 'three';
import { CONFIG } from './config.js';

// 碰撞框格式：{ minX, maxX, minY, maxY, minZ, maxZ, label }
export function makeCollider(minX, maxX, minZ, maxZ, minY, maxY, label) {
  return { minX, maxX, minZ, maxZ, minY, maxY, label };
}

// 放置房間：先沿 z 鏡像（sz = -1 表示格局相反），再繞 y 軸旋轉 rot，最後平移到 (cx, cz)。
// 碰撞框（AABB）同步轉換；rot 只用 0 或 ±π/2，轉完仍是軸對齊的 AABB
export function placeRoom(group, colliders, { cx = 0, cz = 0, rot = 0, sz = 1 }) {
  group.position.set(cx, 0, cz);
  group.rotation.y = rot;
  group.scale.set(1, 1, sz);
  const c = Math.cos(rot), s = Math.sin(rot);
  const tr = (x, z) => { const zz = sz * z; return [cx + x * c + zz * s, cz - x * s + zz * c]; };
  for (const k of colliders) {
    const pts = [tr(k.minX, k.minZ), tr(k.minX, k.maxZ), tr(k.maxX, k.minZ), tr(k.maxX, k.maxZ)];
    k.minX = Math.min(...pts.map((p) => p[0])); k.maxX = Math.max(...pts.map((p) => p[0]));
    k.minZ = Math.min(...pts.map((p) => p[1])); k.maxZ = Math.max(...pts.map((p) => p[1]));
  }
}

// ---------- 寫實化：表面顆粒貼圖（程式產生，1 張貼圖 = 1 公尺） ----------
// 用在所有一般材質的 map 與 roughnessMap：顏色有 ±4% 的斑駁、粗糙度有細微變化，
// 看起來像漆面／灰泥，而不是純色塑膠。透明、發光材質不套用。
let grainTex = null;
export function grainTexture() {
  if (grainTex) return grainTex;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  // 低頻斑駁：小張雜訊放大（平滑插值）
  const s = document.createElement('canvas');
  s.width = s.height = 16;
  const sg = s.getContext('2d');
  const sd = sg.createImageData(16, 16);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < sd.data.length; i += 4) {
    const v = 244 + rnd() * 11;
    sd.data[i] = sd.data[i + 1] = sd.data[i + 2] = v; sd.data[i + 3] = 255;
  }
  sg.putImageData(sd, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(s, 0, 0, N, N);
  // 高頻顆粒
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (rnd() - 0.5) * 8;
    d.data[i] = Math.min(255, d.data[i] + n);
    d.data[i + 1] = Math.min(255, d.data[i + 1] + n);
    d.data[i + 2] = Math.min(255, d.data[i + 2] + n);
  }
  g.putImageData(d, 0, 0);
  grainTex = new THREE.CanvasTexture(c);
  grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  grainTex.colorSpace = THREE.SRGBColorSpace;
  grainTex.anisotropy = 8;
  return grainTex;
}

const matCache = new Map();
export function mat(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    const plain = !extra.map && !extra.transparent && !extra.emissive;
    const detail = plain ? { map: grainTexture(), roughnessMap: grainTexture() } : {};
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...detail, ...extra }));
  }
  return matCache.get(key);
}

// 方塊幾何：UV 依實際尺寸（公尺）計算，貼圖在長牆上不會被拉長。依尺寸快取。
const boxGeoCache = new Map();
function sizedBox(sx, sy, sz) {
  const key = `${sx.toFixed(2)},${sy.toFixed(2)},${sz.toFixed(2)}`;
  let geo = boxGeoCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(1, 1, 1);
    const uv = geo.attributes.uv;
    // BoxGeometry 面順序：+x, -x, +y, -y, +z, -z，每面 4 個頂點
    const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
      }
    }
    boxGeoCache.set(key, geo);
  }
  return geo;
}

// 以中心點與尺寸建立方塊
export function box(parent, color, sx, sy, sz, x, y, z, opts = {}) {
  const m = new THREE.Mesh(sizedBox(Math.abs(sx), Math.abs(sy), Math.abs(sz)), opts.material || mat(color));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = !!opts.cast;
  m.receiveShadow = opts.receive !== false;
  parent.add(m);
  return m;
}

// 程式產生的磚格貼圖（不使用外部圖片）。寫實化：一張貼圖含 4×4 塊磚（重複次數相應縮為 1/4），
// 每塊磚有輕微色差、表面斑點與邊緣亮暗（立體感），磚縫顏色由 line 決定。
export function gridTexture(fill, line, px = 128, lineWidth = 3) {
  const TILES = 4, P = 128, N = P * TILES;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = fill.length * 131 + line.length * 7 + 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const lw = Math.max(2, Math.round((lineWidth * P) / px));
  for (let ty = 0; ty < TILES; ty++) {
    for (let tx = 0; tx < TILES; tx++) {
      const x0 = tx * P, y0 = ty * P;
      g.fillStyle = fill;
      g.fillRect(x0, y0, P, P);
      // 每塊磚的色差
      const shade = (rnd() - 0.5) * 0.08;
      g.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`;
      g.fillRect(x0, y0, P, P);
      // 斑點（磁磚／礦纖板的顆粒）
      for (let i = 0; i < 160; i++) {
        const a = 0.03 + rnd() * 0.07;
        g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
        g.fillRect(x0 + rnd() * P, y0 + rnd() * P, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      // 邊緣：上、左稍亮；下、右稍暗（立體感）
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(x0 + lw, y0 + lw, P - lw, 2);
      g.fillRect(x0 + lw, y0 + lw, 2, P - lw);
      g.fillStyle = 'rgba(0,0,0,0.10)';
      g.fillRect(x0 + lw, y0 + P - 2, P - lw, 2);
      g.fillRect(x0 + P - 2, y0 + lw, 2, P - lw);
      // 磚縫
      g.fillStyle = line;
      g.fillRect(x0, y0, P, lw);
      g.fillRect(x0, y0, lw, P);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  // 呼叫端以「一格一次」設定 repeat；此貼圖含 4×4 格，因此把 repeat 自動除以 4
  const origSet = tex.repeat.set.bind(tex.repeat);
  tex.repeat.set = (rx, ry) => origSet(rx / TILES, ry / TILES);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildRoom(scene, opts = {}) {
  const { room, pillar, doors, colors: C, lighting } = CONFIG;
  const W = opts.size?.width ?? room.width, L = opts.size?.length ?? room.length, H = room.height, T = room.wallThickness;
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
  // C 旋轉後，本地 -x 側是北牆（A、B 的這面由走廊那段負責，所以只有 C 需要）
  if (opts.minimal) walls.push([T, L, xMin - T / 2, 0, '北牆']);
  for (const [sx, sz, cx, cz, label] of walls) {
    if (opts.noFrontWall && label === '前牆') continue; // C 的牆由走廊那段負責（有門洞）
    box(group, null, sx, H, sz, cx, H / 2, cz, { material: wallMat });
    colliders.push(makeCollider(cx - sx / 2, cx + sx / 2, cz - sz / 2, cz + sz / 2, 0, H, label));
  }

  // ---------- 後牆柱子（貫穿到天花板） ----------
  const pMinX = pillar.centerX - pillar.width / 2, pMaxX = pillar.centerX + pillar.width / 2;
  const pMinZ = zMax - pillar.depth;
  if (!opts.minimal) {
  box(group, null, pillar.width, H, pillar.depth, pillar.centerX, H / 2, zMax - pillar.depth / 2, { material: wallMat });
  colliders.push(makeCollider(pMinX, pMaxX, pMinZ, zMax, 0, H, '柱子'));
  }

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

  if (!opts.minimal) {
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
  }

  // ---------- 踢腳板（避開門與柱子） ----------
  const sh = room.skirtingHeight, sd = room.skirtingDepth;
  const skirt = (sx, sz, cx, cz) => box(group, C.skirting, sx, sh, sz, cx, sh / 2, cz);
  if (!opts.noFrontWall) skirt(W, sd, 0, zMin + sd / 2); // 前牆
  if (opts.minimal) skirt(W, sd, 0, zMax - sd / 2); // 後牆（C：沒有柱子）
  else {
  skirt(pMinX - xMin, sd, (xMin + pMinX) / 2, zMax - sd / 2);
  skirt(xMax - pMaxX, sd, (pMaxX + xMax) / 2, zMax - sd / 2);
  skirt(pillar.width + 2 * sd, sd, pillar.centerX, pMinZ - sd / 2);
  skirt(sd, pillar.depth, pMinX - sd / 2, zMax - pillar.depth / 2);
  skirt(sd, pillar.depth, pMaxX + sd / 2, zMax - pillar.depth / 2);
  }
  skirt(sd, L, xMax - sd / 2, 0); // 窗側牆
  // 門側牆：分段避開兩扇門
  const segs = [
    [zMin, frontDoor.z0 - doors.frame],
    [frontDoor.z1 + doors.frame, backDoor.z0 - doors.frame],
    [backDoor.z1 + doors.frame, zMax],
  ];
  for (const [a, b] of (opts.minimal ? [[zMin, zMax]] : segs)) if (b > a) skirt(sd, b - a, xMin + sd / 2, (a + b) / 2);

  // ---------- 前牆：白板、布幕捲筒、白板燈、講桌、喇叭 ----------
  const [wbX0, wbX1] = opts.wb ?? [-5.0, 3.0]; // 白板左右範圍 — 估計
  const wbW = wbX1 - wbX0, wbCx = (wbX0 + wbX1) / 2;
  box(group, C.whiteboardFrame, wbW + 0.06, 1.26, 0.03, wbCx, 1.53, zMin + 0.015);
  box(group, null, wbW, 1.2, 0.035, wbCx, 1.53, zMin + 0.02, { material: mat(C.whiteboard, { roughness: 0.3 }) });
  box(group, C.whiteboardFrame, wbW, 0.03, 0.07, wbCx, 0.9, zMin + 0.04); // 筆槽
  if (opts.boards) {
    // 五片玻璃白板（照片）：沿牆一字排開
    for (let k = 0; k < 5; k++) {
      const bx = wbX0 + 0.35 + k * 0.8;
      box(group, C.acrylic, 0.7, 0.8, 0.02, bx, 1.5, zMin + 0.03);
      box(group, C.whiteboardFrame, 0.72, 0.82, 0.01, bx, 1.5, zMin + 0.025);
    }
  }
  // 投影布幕捲筒（收起狀態）
  if (!opts.minimal) {
  box(group, '#f0f0ee', 3.0, 0.08, 0.08, -2.0, H - 0.18, zMin + 0.05);
  box(group, '#f0f0ee', 3.0, 0.08, 0.08, 2.4, H - 0.18, zMin + 0.05);
  }
  // 白板照明燈（吊在前方）
  for (const x of [-2.6, 0.2]) {
    box(group, C.fixture, 1.2, 0.08, 0.14, x, H - 0.45, zMin + 0.5);
    box(group, C.metal, 0.015, 0.37, 0.015, x - 0.45, H - 0.22, zMin + 0.5);
    box(group, C.metal, 0.015, 0.37, 0.015, x + 0.45, H - 0.22, zMin + 0.5);
  }
  // 講桌（木紋色正面 + 灰色桌面 + 側邊小桌）
  const lecX = opts.lecX ?? 0.6, lecZ = zMin + 0.75;
  box(group, C.lectern, 0.9, 1.0, 0.55, lecX, 0.5, lecZ, { cast: true });
  box(group, '#5c5f63', 0.92, 0.04, 0.58, lecX, 1.02, lecZ, { cast: true });
  box(group, '#e9e9e6', 0.6, 0.03, 0.35, lecX + 0.75, 0.95, lecZ - 0.05, { cast: true });
  box(group, C.metal, 0.03, 0.95, 0.03, lecX + 0.95, 0.475, lecZ - 0.05);
  colliders.push(makeCollider(lecX - 0.45, lecX + 1.05, lecZ - 0.29, lecZ + 0.29, 0, 1.05, '講桌'));
  // 前牆喇叭
  if (!opts.minimal) {
  buildSpeaker(group, -4.0, 2.4, zMin + 0.08, 0, '#202022');
  buildSpeaker(group, 1.3, 2.45, zMin + 0.08, 0, C.speaker);
  }

  if (!opts.minimal) {
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

  }

  // ---------- 天花板設備 ----------
  const lights = buildCeiling(group, W, L, H, !opts.minimal);

  // ---------- 光源（只有主教室建立；隔壁教室共用光源） ----------
  if (!opts.secondary) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#c9c6bd', lighting.ambient);
  scene.add(hemi);

  // 一盞方向光負責陰影（只算一次 shadow pass，效能最好）
  const sun = new THREE.DirectionalLight('#ffffff', lighting.sun);
  // 陰影範圍以整棟建築中心為準（原本以原點為中心，北側延伸段超出範圍會變成全黑）
  const SC = { x: -6, z: -15 };
  sun.position.set(SC.x + 1.2, H + 4, SC.z + 1.5);
  sun.target.position.set(SC.x, 0, SC.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lighting.shadowMapSize, lighting.shadowMapSize);
  const half = 60;
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

  }
  if (opts.place) placeRoom(group, colliders, opts.place);
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
function buildCeiling(group, W, L, H, withProjectors = true) {
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
  for (const x of withProjectors ? [-2.0, 2.4] : []) {
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
