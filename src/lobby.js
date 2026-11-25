import * as THREE from 'three';
import { CONFIG } from './config.js';
import { box, mat, gridTexture, makeCollider } from './room.js';
import { geo } from './layout.js';
import { decal, brickTex, steelTex, callTex, hydrantTex, planTex, binTex } from './decals.js';

// 方形空間（草圖）：在走廊東側、B 北側；東牆有樓梯、一段牆、電梯 1、電梯 2；北牆是多功能展演廳；
// 南側（B 的北牆）旁有兩個垃圾桶。西側是走廊與教室 C 的窗戶牆。
export function buildLobby(scene, colliders) {
  const { room, colors: C, lighting } = CONFIG;
  const g = geo();
  const H = room.height, T = room.wallThickness;
  const sd = room.skirtingDepth, sh = room.skirtingHeight;
  const { xW, xE, zS, z0, xL1 } = { ...g, xL1: g.xI + g.W };
  const Wd = xL1 - xW, D = z0 - zS;
  const xc = (xW + xL1) / 2, zc = (zS + z0) / 2;
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
    for (let z = zS + 0.9; z < z0; z += 1.8) {
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
    for (let z = zS + 1.5; z < z0; z += 3) {
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
  box(group, null, xL1 + T - xE, H, T, (xE + xL1 + T) / 2, H / 2, zS - T / 2, { material: wallMat });
  colliders.push(makeCollider(xE, xL1 + T, zS - T, zS, 0, H, '展演廳北牆'));
  text(['多功能展演廳', 'Auditorium'], 3.2, 1.4, (xE + xL1) / 2, 2.0, zS + 0.02, 0, C.signBlue);
  // 消防栓櫃與 4F 平面圖看板（照片：在電梯旁的牆上）
  // 電梯左手邊：東牆在電梯 1 北側的那段（z 約 zS+7.55 ~ zS+9.85），面向大廳（朝西，-x）
  const zHyd = zS + 8.0, zPlan = zS + 9.3, xFace = xL1;
  box(group, C.hydrant, 0.2, 1.2, 0.9, xFace - 0.1, 1.2, zHyd);
  decal(group, hydrantTex(), 0.9, 1.2, xFace - 0.205, 1.2, zHyd, -Math.PI / 2);
  decal(group, planTex(), 0.9, 1.3, xFace - 0.005, 1.55, zPlan, -Math.PI / 2);
  colliders.push(makeCollider(xFace - 0.2, xFace, zHyd - 0.45, zHyd + 0.45, 0, 1.65, '消防栓箱'));

  // ---------- 東牆：一段牆、樓梯、電梯 1、電梯 2 ----------
  box(group, null, T, H, D, xL1 + T / 2, H / 2, zc, { material: wallMat });
  colliders.push(makeCollider(xL1, xL1 + T, zS, z0, 0, H, '大廳東牆'));
  box(group, C.corridorSkirting, Wd, sh, sd, xc, sh / 2, zS + sd / 2);
  box(group, C.corridorSkirting, sd, sh, D, xL1 - sd / 2, sh / 2, zc);

  // 樓梯（草圖：東牆北段，沿東牆方向寬 2.4 m，往牆面升高）
  const zSt = zS + 3.6;
  for (let i = 0; i < 8; i++) {
    const hgt = (8 - i) * 0.18;
    box(group, C.corridorWall, 0.3, hgt, 2.4, xL1 - 0.15 - i * 0.3, hgt / 2, zSt, { cast: true });
  }
  colliders.push(makeCollider(xL1 - 2.4, xL1, zSt - 1.2, zSt + 1.2, 0, 1.44, '樓梯'));

  // 突出的牆（草圖：東牆中段，深 3.4 m、寬 1.7 m）
  box(group, null, 3.4, H, 1.7, xL1 - 1.7, H / 2, zS + 6.6, { material: wallMat });
  colliders.push(makeCollider(xL1 - 3.4, xL1, zS + 5.75, zS + 7.45, 0, H, '突出牆'));

  // 電梯 1、電梯 2（紅磚柱夾著兩部電梯門）
  const zBr = zS + 12.15;
  box(group, C.brick, 0.04, H, 4.4, xL1 - 0.02, H / 2, zBr);
  decal(group, brickTex(), 4.4, H, xL1 - 0.043, H / 2, zBr, -Math.PI / 2, { repeat: [4.4 / 1.2, H / 1.2] });
  for (const ze of [zS + 10.4, zS + 13.9]) {
    box(group, C.stainless, 0.02, 2.1, 1.0, xL1 - 0.05, 1.05, ze);
    decal(group, steelTex(), 1.0, 2.1, xL1 - 0.063, 1.05, ze, -Math.PI / 2);
  }
  text(['4F'], 0.6, 0.3, xL1 - 0.07, 2.3, zBr, -Math.PI / 2, C.signBlue);
  box(group, C.stainless, 0.02, 0.9, 0.14, xL1 - 0.05, 1.2, zBr);
  decal(group, callTex(), 0.14, 0.9, xL1 - 0.063, 1.2, zBr, -Math.PI / 2);

  // ---------- 南側（B 的北牆旁）：兩個垃圾桶 ----------
  for (const tx of [g.xI + 2.0, g.xI + 3.1]) {
    box(group, C.trash, 0.9, 1.0, 0.8, tx, 0.5, z0 - 0.6);
    decal(group, binTex(), 0.9, 1.0, tx, 0.5, z0 - 1.005, Math.PI);
    colliders.push(makeCollider(tx - 0.45, tx + 0.45, z0 - 1.0, z0 - 0.2, 0, 1.0, '垃圾桶'));
  }
}
