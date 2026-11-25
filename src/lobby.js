import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';

// 走廊前端（-z）外的方形大廳（照片）：中間電梯與紅磚柱，左側樓梯與消防栓，
// 右側有告示板與 K413 雙門，地板是深灰磚加白色菱形點綴，天花板是格板加崁燈。
export function buildLobby(scene, colliders) {
  const { room, corridor: K, lobby: Lb, colors: C } = CONFIG;
  const W = room.width, L = room.length, H = room.height, T = room.wallThickness;
  const xI = -W / 2, xE = xI - T, xW = xE - K.width;
  const xc = (xE + xW) / 2;
  const z0 = -L / 2 - K.frontExtend;     // 走廊前端的位置
  const zS = z0 - Lb.depth;              // 大廳最外側的牆
  const zN = z0 - T;                     // 大廳與走廊之間的牆（內側）
  const xL0 = xc - Lb.width / 2, xL1 = xc + Lb.width / 2;
  const zc = (zS + zN) / 2, D = zN - zS;

  const group = new THREE.Group();
  group.name = 'lobby';
  scene.add(group);
  const wallMat = mat(C.corridorWall, { roughness: 0.95 });

  // 文字貼圖（透明底，用 canvas 畫字，不需外部圖片）
  const text = (lines, w, h, x, y, z, rotY, color) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = Math.round((512 * h) / w);
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const base = c.height / (lines.length * 1.5);
    lines.forEach((t, i) => {
      g.font = `${i === 0 ? 'bold ' : ''}${Math.floor(i === 0 ? base : base * 0.55)}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
      g.fillText(t, 256, (c.height / lines.length) * (i + 0.5));
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
  };
  const dot = (x, y, z, r = 0.018) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(C.metal));
    m.position.set(x, y, z);
    group.add(m);
  };

  // ---------- 地板：深灰磚 + 白色菱形點綴 ----------
  const floorTex = gridTexture(C.lobbyFloor, C.lobbyGrout, 128, 3);
  floorTex.repeat.set(Lb.width / room.floorTile, D / room.floorTile);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(Lb.width, D),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.4 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(xc, 0, zc);
  floor.receiveShadow = true;
  group.add(floor);
  for (let x = xL0 + 0.9; x < xL1; x += 1.8) {
    for (let z = zS + 0.9; z < zN; z += 1.8) {
      const d = box(group, C.diamond, 0.22, 0.004, 0.22, x, 0.002, z);
      d.rotation.y = Math.PI / 4;
    }
  }

  // ---------- 天花板：格板 + 崁燈 + 煙霧偵測器 + 喇叭 ----------
  const ceilTex = gridTexture(C.ceiling, C.ceilingGrid, 128, 4);
  ceilTex.repeat.set(Lb.width / room.ceilingTile, D / room.ceilingTile);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(Lb.width, D),
    new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(xc, H, zc);
  group.add(ceil);
  for (let x = xL0 + 1.5; x < xL1; x += 3) {
    for (let z = zS + 1.5; z < zN; z += 3) {
      const dl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), mat(C.downlight));
      dl.position.set(x, H - 0.012, z);
      group.add(dl);
    }
  }
  const smoke = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), mat(C.fixture));
  smoke.position.set(xc + 2.5, H - 0.02, zS + 4);
  group.add(smoke);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 20), mat(C.speaker));
  horn.rotation.z = Math.PI / 2;
  horn.position.set(xL0 + 0.35, 2.5, zS + 0.35);
  group.add(horn);
  // 大廳補光（不投影陰影）
  for (const [x, z] of [[xc - 2.5, zc], [xc + 2.5, zc + 2]]) {
    const p = new THREE.PointLight('#fff4e4', CONFIG.lighting.pointIntensity * 0.9, 6, 1.5);
    p.position.set(x, H - 0.7, z);
    group.add(p);
  }

  // ---------- 外牆：南牆（大廳最外側）、西牆、東牆 ----------
  box(group, null, Lb.width + 2 * T, H, T, xc, H / 2, zS - T / 2, { material: wallMat });
  colliders.push(makeCollider(xL0 - T, xL1 + T, zS - T, zS, 0, H, '大廳南牆'));
  box(group, null, T, H, D, xL0 - T / 2, H / 2, zc, { material: wallMat });
  colliders.push(makeCollider(xL0 - T, xL0, zS, zN, 0, H, '大廳西牆'));
  box(group, null, T, H, D, xL1 + T / 2, H / 2, zc, { material: wallMat });
  colliders.push(makeCollider(xL1, xL1 + T, zS, zN, 0, H, '大廳東牆'));
  // 北牆：走廊寬度的開口留空，兩側是實牆（與走廊的交界）
  const zNw = z0 - T / 2;
  box(group, null, xW - (xL0 - T), H, T, (xL0 - T + xW) / 2, H / 2, zNw, { material: wallMat });
  colliders.push(makeCollider(xL0 - T, xW, z0 - T, z0, 0, H, '大廳北牆'));
  box(group, null, xL1 + T - xE, H, T, (xE + xL1 + T) / 2, H / 2, zNw, { material: wallMat });
  colliders.push(makeCollider(xE, xL1 + T, z0 - T, z0, 0, H, '大廳北牆'));

  // 踢腳板
  const sd = room.skirtingDepth, sh = room.skirtingHeight;
  box(group, C.corridorSkirting, Lb.width, sh, sd, xc, sh / 2, zS + sd / 2);
  box(group, C.corridorSkirting, sd, sh, D, xL0 + sd / 2, sh / 2, zc);
  box(group, C.corridorSkirting, sd, sh, D, xL1 - sd / 2, sh / 2, zc);

  // ---------- 南牆：電梯（兩部）、紅磚柱、4F 字樣、呼叫鈕、大廳名稱 ----------
  const doorW = 1.0, doorH = 2.1;
  box(group, C.brick, 4.2, H, 0.04, xc, H / 2, zS + 0.02);
  for (const dx of [-1.9, 1.9]) {
    box(group, C.stainless, doorW + 0.1, doorH + 0.08, 0.02, xc + dx, doorH / 2 + 0.02, zS + 0.05);
    box(group, C.stainless, doorW, doorH, 0.01, xc + dx, doorH / 2, zS + 0.065);
  }
  text(['4F'], 0.6, 0.3, xc, 2.3, zS + 0.07, 0, C.signBlue);
  box(group, C.stainless, 0.14, 0.9, 0.02, xc, 1.2, zS + 0.07);
  text(['多功能展演廳', 'Auditorium'], 2.2, 1.1, xc + 3.4, 2.0, zS + 0.02, 0, C.signBlue);

  // ---------- 西牆：樓梯（往西牆升高）、消防栓箱、4F 平面圖 ----------
  const zSt = zN - 2.5;
  for (let i = 0; i < 8; i++) {
    const hgt = (8 - i) * 0.18;
    box(group, C.corridorWall, 0.3, hgt, 1.4, xL0 + i * 0.3 + 0.15, hgt / 2, zSt, { cast: true });
  }
  colliders.push(makeCollider(xL0, xL0 + 2.4, zSt - 0.7, zSt + 0.7, 0, 1.44, '樓梯'));
  const zHyd = zN - 0.9;
  box(group, C.hydrant, 0.2, 0.9, 0.9, xL0 + 0.1, 1.2, zHyd);
  box(group, C.hydrantRed, 0.08, 0.08, 0.6, xL0 + 0.21, 1.5, zHyd);
  const alarm = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(C.hydrantRed, { emissive: C.hydrantRed, emissiveIntensity: 1 }));
  alarm.position.set(xL0 + 0.21, 1.7, zHyd - 0.25);
  group.add(alarm);
  colliders.push(makeCollider(xL0, xL0 + 0.2, zHyd - 0.45, zHyd + 0.45, 0, 1.65, '消防栓箱'));
  const zPl = zS + 4.5;
  box(group, C.signBlue, 0.03, 1.3, 0.9, xL0 + 0.02, 1.5, zPl);
  text(['4F', '樓層平面圖'], 0.85, 1.25, xL0 + 0.04, 1.5, zPl, Math.PI / 2, '#ffffff');

  // ---------- 東牆：五片告示板、K413 雙門（裝飾）、柱子與出口指示、垃圾桶 ----------
  for (let k = 0; k < 5; k++) {
    const bz = zS + 2.6 + k * 0.9;
    box(group, C.acrylic, 0.012, 0.8, 0.7, xL1 - 0.006, 1.45, bz);
    for (const dy of [-0.37, 0.37]) for (const dz of [-0.31, 0.31]) dot(xL1 - 0.014, 1.45 + dy, bz + dz);
  }
  const dz0 = zS + 8.2 - 0.75, dz1 = zS + 8.2 + 0.75, fr = 0.06, dh = 2.1;
  const dxF = xL1 - 0.015;
  box(group, C.doorFrame, 0.03, dh + fr, fr, dxF, (dh + fr) / 2, dz0 - fr / 2);
  box(group, C.doorFrame, 0.03, dh + fr, fr, dxF, (dh + fr) / 2, dz1 + fr / 2);
  box(group, C.doorFrame, 0.03, fr, dz1 - dz0 + 2 * fr, dxF, dh + fr / 2, (dz0 + dz1) / 2);
  box(group, C.door, 0.025, dh, (dz1 - dz0) / 2 - 0.005, xL1 - 0.03, dh / 2, dz0 + (dz1 - dz0) / 4);
  box(group, C.door, 0.025, dh, (dz1 - dz0) / 2 - 0.005, xL1 - 0.03, dh / 2, dz0 + (3 * (dz1 - dz0)) / 4);
  box(group, C.glassDark, 0.008, 0.4, 0.14, xL1 - 0.045, 1.45, (dz0 + dz1) / 2);
  box(group, C.switchPlate, 0.012, 0.14, 0.36, xL1 - 0.014, 2.4, (dz0 + dz1) / 2);
  const colX = xL1 - 0.9, colZ = zS + 6.5;
  box(group, null, 0.8, H, 0.8, colX, H / 2, colZ, { material: wallMat });
  colliders.push(makeCollider(colX - 0.4, colX + 0.4, colZ - 0.4, colZ + 0.4, 0, H, '大廳柱子'));
  box(group, C.cctv, 0.12, 0.12, 0.22, colX - 0.25, 2.5, colZ - 0.42);
  box(group, C.exitGreen, 0.02, 0.2, 0.36, colX, 0.5, colZ - 0.42);
  const trashZ = zS + 1.5;
  box(group, C.trash, 0.7, 1.0, 0.7, xL1 - 0.6, 0.5, trashZ);
  colliders.push(makeCollider(xL1 - 0.95, xL1 - 0.25, trashZ - 0.35, trashZ + 0.35, 0, 1.0, '垃圾桶'));

  // ---------- 南牆西側：木頭長椅（鐵腳） ----------
  const bx = xL0 + 2.0, bz = zS + 0.7;
  box(group, C.benchWood, 1.6, 0.06, 0.5, bx, 0.46, bz);
  box(group, C.benchWood, 1.6, 0.4, 0.05, bx, 0.7, bz - 0.22);
  for (const sx of [-0.7, 0.7]) {
    box(group, C.benchIron, 0.05, 0.46, 0.5, bx + sx, 0.23, bz);
  }
  colliders.push(makeCollider(bx - 0.8, bx + 0.8, bz - 0.25, bz + 0.25, 0, 0.5, '長椅'));

  // ---------- 北牆前的teal 指示牌（掛在走廊口上方） ----------
  box(group, C.sign, K.width * 0.9, 0.35, 0.05, xc, 2.45, z0 - T / 2 + 0.02);
  text(['教師休息室  K410電腦教室  多功能展演廳'], K.width * 0.9, 0.35, xc, 2.45, z0 - T / 2 - 0.05, Math.PI, '#ffffff');
}
