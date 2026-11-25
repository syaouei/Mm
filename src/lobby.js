import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';
import { geo } from './layout.js';
import { decal, brickTex, steelTex, callTex, numTex, hydrantTex, planTex, binTex, stairsDownTex } from './decals.js';

// 方形空間（草圖）：在走廊東側、B 北側；東牆有樓梯、一段牆、電梯 1、電梯 2；北牆是多功能展演廳；
// 南側（B 的北牆）旁有兩個垃圾桶。西側是走廊與教室 C 的窗戶牆。
export function buildLobby(scene, colliders) {
  const { room, colors: C, lighting } = CONFIG;
  const g = geo();
  const H = room.height, T = room.wallThickness;
  const sd = room.skirtingDepth, sh = room.skirtingHeight;
  const { xW, xE, zS, z0, xL1 } = { ...g, xL1: g.xI + g.W };
  // 多功能展演廳北牆：移到下行樓梯北緣（zN = zS + 4.7）；樓梯、電梯、消防栓仍以 zS 為參考，位置不動
  const zN = zS + CONFIG.lobby.northOffset;  // 北牆貼齊下行樓梯的北緣；樓梯不動
  const Wd = xL1 - xW, D = z0 - zN;
  const xc = (xW + xL1) / 2, zc = (zN + z0) / 2;
  const group = new THREE.Group();
  group.name = 'lobby';
  scene.add(group);
  const wallMat = mat(C.corridorWall, { roughness: 0.95 });

  // 文字貼圖（透明底，用 canvas 畫字）
  const text = (lines, w, hgt, x, y, z, rotY, color) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round((512 * hgt) / w);
    const cg = c.getContext('2d');
    cg.fillStyle = color;
    cg.textAlign = 'center';
    cg.textBaseline = 'middle';
    const base = c.height / (lines.length * 1.5);
    lines.forEach((t, i) => {
      const fam = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
      let px = Math.floor(i === 0 ? base : base * 0.55);
      cg.font = `${i === 0 ? 'bold ' : ''}${px}px ${fam}`;
      while (cg.measureText(t).width > c.width * 0.92 && px > 8) {
        px -= 2;
        cg.font = `${i === 0 ? 'bold ' : ''}${px}px ${fam}`;
      }
      cg.fillText(t, 256, (c.height / lines.length) * (i + 0.5));
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, hgt),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
  };

  // ---------- 地板：深灰磚 + 白色菱形點綴 ----------
  const floorTex = gridTexture(C.lobbyFloor, C.lobbyGrout, 128, 3);
  floorTex.repeat.set(Wd / room.floorTile, D / room.floorTile);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(Wd, D),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(xc, 0, zc);
  floor.receiveShadow = true;
  group.add(floor);
  for (let x = xW + 0.9; x < xL1; x += 1.8) {
    for (let z = zN + 0.9; z < z0; z += 1.8) {
      box(group, C.diamond, 0.22, 0.004, 0.22, x, 0.002, z).rotation.y = Math.PI / 4;
    }
  }

  // ---------- 天花板：格板 + 崁燈 + 煙霧偵測器 + 喇叭 ----------
  const ceilTex = gridTexture(C.ceiling, C.ceilingGrid, 128, 4);
  ceilTex.repeat.set(Wd / room.ceilingTile, D / room.ceilingTile);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(Wd, D),
    new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(xc, H, zc);
  group.add(ceil);
  for (let x = xW + 1.5; x < xL1; x += 3) {
    for (let z = zN + 1.5; z < z0; z += 3) {
      const dl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), mat(C.downlight));
      dl.position.set(x, H - 0.012, z);
      group.add(dl);
    }
  }
  const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), mat(C.fixture));
  smoke.position.set(xc + 2, H - 0.02, zS + 4);
  group.add(smoke);
  for (const [x, z] of [[xc - 3, zc], [xc + 3, zc + 2]]) {
    const p = new THREE.PointLight('#fff4e4', lighting.pointIntensity * 0.8, 6, 1.5);
    p.position.set(x, H - 0.7, z);
    group.add(p);
  }

  // ---------- 北牆：多功能展演廳（與走廊相接處留開口） ----------
  box(group, null, xL1 + T - xE, H, T, (xE + xL1 + T) / 2, H / 2, zN - T / 2, { material: wallMat });
  colliders.push(makeCollider(xE, xL1 + T, zN - T, zN, 0, H, '展演廳北牆'));
  text(['多功能展演廳', 'Auditorium'], 3.2, 1.4, (xE + xL1) / 2, 2.0, zN + 0.02, 0, C.signBlue);
  // 消防栓與 4F 平面圖：貼在 B 教室北牆的北面（大廳內側），消防栓在西、平面圖在東
  const wallN = z0;                  // B 北牆的北面（大廳側）：牆在 z0 ~ z0+0.2
  const xHyd = 7.1, xPlan = 8.2;     // 依玩家視線中心（x ≈ 7.7）對稱排列
  box(group, C.hydrant, 0.9, 1.2, 0.2, xHyd, 1.2, wallN - 0.1);             // 櫃體貼齊牆面北側
  decal(group, hydrantTex(), 0.9, 1.2, xHyd, 1.2, wallN - 0.205, Math.PI);   // 櫃體北面
  decal(group, planTex(), 0.9, 1.3, xPlan, 1.55, wallN - 0.01, Math.PI);    // 牆面北面
  colliders.push(makeCollider(xHyd - 0.45, xHyd + 0.45, wallN - 0.2, wallN, 0, 1.65, '消防栓箱'));

  // ---------- 東牆：一段牆、樓梯、電梯 1、電梯 2 ----------
  box(group, null, T, H, D, xL1 + T / 2, H / 2, zc, { material: wallMat });
  colliders.push(makeCollider(xL1, xL1 + T, zN, z0, 0, H, '大廳東牆'));
  box(group, C.corridorSkirting, Wd, sh, sd, xc, sh / 2, zN + sd / 2);
  box(group, C.corridorSkirting, sd, sh, D, xL1 - sd / 2, sh / 2, zc);

  // 樓梯（照片）：北側（左）往下、南側（右）往上
  // 上行段（照片）：直梯逐階升高，靠東牆為最高；北側與下行段相接，開放的南側裝銅色扶手
  const zUp0 = zS + 6.1, zUp1 = zS + 7.5, zUpC = (zUp0 + zUp1) / 2;
  const treadMat = mat('#cdc4b2', { roughness: 0.8 });
  const nosingMat = mat('#8c8373', { roughness: 0.7 });
  const RISE = 0.18, RUN = 0.3, NSTEP = 8;
  for (let i = 0; i < NSTEP; i++) {
    const hgt = (NSTEP - i) * RISE;
    const xc2 = xL1 - 0.15 - i * RUN;
    box(group, null, RUN, hgt, zUp1 - zUp0, xc2, hgt / 2, zUpC, { cast: true, material: treadMat });
    box(group, null, 0.03, 0.012, zUp1 - zUp0, xc2 + RUN / 2 - 0.02, hgt + 0.006, zUpC, { material: nosingMat });
  }
  colliders.push(makeCollider(xL1 - 2.4, xL1, zUp0, zUp1, 0, 1.44, '上行樓梯'));
  // 銅色扶手：斜向、沿開放側，低端在 0.9 m、高端在樓梯頂的 0.9 m 之上；立柱每階一根
  const copper = mat('#b87333', { roughness: 0.35, metalness: 0.6 });
  const xLo = xL1 - 2.4, xHi = xL1 - 0.15;
  const yLo = 0.9, yHi = NSTEP * RISE + 0.9;
  const rLen = Math.hypot(xHi - xLo, yHi - yLo), rAng = Math.atan2(yHi - yLo, xHi - xLo);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(rLen, 0.05, 0.05), copper);
  rail.position.set((xLo + xHi) / 2, (yLo + yHi) / 2, zUp1 - 0.05);
  rail.rotation.z = rAng;
  rail.castShadow = true;
  group.add(rail);
  for (let i = 0; i <= NSTEP; i += 2) {
    const px = xL1 - 0.15 - (i >= NSTEP ? NSTEP - 1 : i) * RUN - (i >= NSTEP ? 0 : 0.15);
    const topY = Math.min(NSTEP, i) * RISE + 0.9;
    const base = Math.max(0, topY - 0.9);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, topY - base, 0.03), copper);
    post.position.set(Math.max(xLo, Math.min(xHi, px)), (topY + base) / 2, zUp1 - 0.05);
    group.add(post);
  }
  // 下行段（照片）：與上行段併在一起，位於上行段北側，兩段共用邊界、寬度相同（沿東牆 x 方向 2.4 m）
  const dnW = 2.4, dnD = zUp0 - (zS + 4.7);
  const dnMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(dnW, dnD),
    new THREE.MeshStandardMaterial({ map: stairsDownTex(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  dnMesh.rotation.x = -Math.PI / 2;
  dnMesh.position.set(xL1 - dnW / 2, 0.006, zS + 4.7 + dnD / 2);
  group.add(dnMesh);

  // 突出牆：深度與樓梯切齊（2.4 m），厚 1.4 m，南面緊貼紅磚牆
  box(group, null, 2.4, H, 1.95, xL1 - 1.2, H / 2, zS + 8.575, { material: wallMat });
  colliders.push(makeCollider(xL1 - 2.4, xL1, zS + 7.6, zS + 9.55, 0, H, '突出牆'));

  // 電梯牆（照片）：整面都是紅磚，只有兩台電梯、門框、門上不鏽鋼罩、呼叫面板與 4F 字樣
  const zE1 = zS + 10.6, zE2 = zS + 13.85;       // 兩台電梯中心（照片：中心距約 3.25 m）
  const dW = 1.3;                                 // 每台電梯的門開口寬
  // 紅磚只包住電梯區：左側砖柱約 0.4 m、右側約 0.8 m（照片比例）
  const zWallN = zE1 - dW / 2 - 0.4, zWallS = zE2 + dW / 2 + 0.8;
  const lenBrick = zWallS - zWallN, zBrick = (zWallN + zWallS) / 2;
  box(group, C.brick, 0.04, H, lenBrick, xL1 - 0.02, H / 2, zBrick);
  decal(group, brickTex(), lenBrick, H, xL1 - 0.043, H / 2, zBrick, -Math.PI / 2, { repeat: [lenBrick / 1.2, H / 1.2] });
  for (const ze of [zE1, zE2]) {
    // 門框（左右不鏽鋼 jamb）
    for (const dz of [-dW / 2 - 0.04, dW / 2 + 0.04]) {
      box(group, C.stainless, 0.05, 2.15, 0.08, xL1 - 0.07, 1.08, ze + dz);
      decal(group, numTex(), 0.12, 0.24, xL1 - 0.098, 1.5, ze + dz, -Math.PI / 2);
    }
    // 雙扇門板（中縫由貼皮畫出）
    box(group, C.stainless, 0.02, 2.1, dW, xL1 - 0.065, 1.05, ze);
    decal(group, steelTex(), dW, 2.1, xL1 - 0.078, 1.05, ze, -Math.PI / 2);
    // 門上不鏽鋼罩
    box(group, C.stainless, 0.3, 0.6, dW + 0.3, xL1 - 0.15, 2.6, ze);
    decal(group, steelTex(), dW + 0.3, 0.6, xL1 - 0.302, 2.6, ze, -Math.PI / 2);
  }
  // 呼叫面板（兩台電梯之間）與 4F 字樣
  const zBtn = (zE1 + zE2) / 2;
  box(group, C.stainless, 0.02, 0.9, 0.2, xL1 - 0.05, 1.2, zBtn);
  decal(group, callTex(), 0.2, 0.9, xL1 - 0.063, 1.2, zBtn, -Math.PI / 2);
  text(['4F'], 0.6, 0.3, xL1 - 0.07, 2.3, zBtn, -Math.PI / 2, '#2b8ea6');

  // ---------- 白色柱子（照片：B 教室出來會看到的柱子，柱子後方是教室 C） ----------
  const colX = g.xE + 0.9, colZ = z0 - 0.75, colW = 0.7;
  box(group, null, colW, H, colW, colX, H / 2, colZ, { material: wallMat });
  colliders.push(makeCollider(colX - colW / 2, colX + colW / 2, colZ - colW / 2, colZ + colW / 2, 0, H, '白色柱子'));
  box(group, C.cctv, 0.22, 0.12, 0.12, colX, 2.5, colZ - colW / 2 - 0.1);

  // ---------- 南側（B 的北牆旁）：兩個垃圾桶 ----------
  for (const tx of [g.xI + 2.0, g.xI + 3.1]) {
    box(group, C.trash, 0.9, 1.0, 0.8, tx, 0.5, z0 - 0.6);
    decal(group, binTex(), 0.9, 1.0, tx, 0.5, z0 - 1.005, Math.PI);
    colliders.push(makeCollider(tx - 0.45, tx + 0.45, z0 - 1.0, z0 - 0.2, 0, 1.0, '垃圾桶'));
  }
}
