import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeCollider } from './room.js';

// 羊 NPC（依使用者的角色設計圖）：
//   奶油色的頭、往兩側斜上伸出的長耳朵（內側粉紅）、紅色貝雷帽、額頭深棕色的毛與粉紅點、
//   半睜的眼睛、藍色毛衣與黃色「mmu」字樣、雙手交握在胸前。
// 設計圖沒有畫到腿，這裡補上短腿與深色的蹄。
// 全部以 Three.js 幾何體與 canvas 貼圖組成，不載入外部模型或圖片。
// 座標：角色原點在兩腳中間的地面，正面朝本地 +z。

const COL = {
  wool: '#fbf7ee',
  earInner: '#f4c9d3',
  beret: '#a3221b',
  beretCrease: '#73140f',
  tuft: '#2b170d',
  spot: '#f7d3dc',
  sweater: '#2d4fb8',
  rib: '#243f98',
  letters: '#f5cd38',
  hoof: '#3b2a20',
  ink: '#151515',
};

// 頭（橢球）半徑，以及臉部貼圖覆蓋的球面範圍（經度 ±PH、緯度 T0~T1）
const HEAD = { rx: 0.31, ry: 0.27, rz: 0.28, y: 1.13 };
const FACE = { PH: 1.15, T0: 0.35, T1: 2.55, N: 1024 };

// ---------- 材質：卡通光影（3 階）或一般材質，依 CONFIG.npc.toon ----------
let gradientMap = null;
function npcMat(color, extra = {}) {
  if (CONFIG.npc.toon) {
    if (!gradientMap) {
      const data = new Uint8Array([190, 228, 255]);
      gradientMap = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
      gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
      gradientMap.needsUpdate = true;
    }
    return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  }
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
}

function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// 公尺（以頭中心為原點，x 向右、y 向上）→ 臉部貼圖上的像素座標
function faceXY(xm, ym) {
  const theta = Math.acos(THREE.MathUtils.clamp(ym / HEAD.ry, -1, 1));
  const s = Math.max(1e-3, Math.sin(theta));
  const d = Math.asin(THREE.MathUtils.clamp(xm / (HEAD.rx * s), -1, 1));
  return [((d + FACE.PH) / (2 * FACE.PH)) * FACE.N, ((theta - FACE.T0) / (FACE.T1 - FACE.T0)) * FACE.N];
}

// 眼睛與眉毛（依使用者提供的表情參考）：粗眉外高內低往鼻樑壓、很粗的上眼瞼線、
// 黑色瞳孔掛在眼瞼下、左上一點反光、下半部是白色的倒三角。
// 形狀以公尺描述，每個點經 faceXY 換到貼圖上，畫在曲面上才不會變形。
// side：-1 為畫面左邊那隻眼，+1 為右邊；u 往鼻樑方向為正，v 往上為正。
const EYE = { cx: 0.16, cy: 0.0 };
function drawEye(g, side, closed) {
  const E = (u, v) => faceXY(side * EYE.cx - side * u, EYE.cy + v);
  const mv = (t, u, v) => t.moveTo(...E(u, v));
  const ln = (t, u, v) => t.lineTo(...E(u, v));
  const qd = (t, cu, cv, u, v) => t.quadraticCurveTo(...E(cu, cv), ...E(u, v));
  const px = (du, dv) => { const a = E(0, 0), b = E(du, dv); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = COL.ink;
  if (!closed) {
    const eye = new Path2D();
    mv(eye, -0.07, 0.058);
    qd(eye, 0.0, 0.066, 0.066, 0.034);
    qd(eye, 0.082, -0.045, 0.004, -0.088);
    qd(eye, -0.086, -0.04, -0.07, 0.058);
    eye.closePath();
    g.fillStyle = '#ffffff';
    g.fill(eye);
    g.save();
    g.clip(eye);
    // 瞳孔與反光
    const [ex, ey] = E(0.006, 0.004);
    g.fillStyle = COL.ink;
    g.beginPath(); g.ellipse(ex, ey, px(0.036, 0), px(0, 0.04), 0, 0, Math.PI * 2); g.fill();
    const [hx, hy] = E(-0.03, -0.006);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(hx, hy, px(0.008, 0), 0, Math.PI * 2); g.fill();
    // 上眼瞼（與臉同色）蓋住上半部
    g.fillStyle = COL.wool;
    g.beginPath();
    mv(g, -0.13, 0.14); ln(g, 0.13, 0.14); ln(g, 0.13, -0.004);
    qd(g, 0.0, 0.026, -0.13, 0.018);
    g.closePath(); g.fill();
    g.restore();
    // 很粗的上眼瞼線
    g.lineWidth = 24;
    g.beginPath(); mv(g, -0.086, 0.017); qd(g, 0.0, 0.026, 0.08, -0.002); g.stroke();
    // 眼睛輪廓
    g.lineWidth = 11;
    g.stroke(eye);
  } else {
    g.lineWidth = 20;
    g.beginPath(); mv(g, -0.084, 0.006); qd(g, 0.0, -0.018, 0.078, -0.006); g.stroke();
  }
  // 粗眉：外高內低，往鼻樑壓
  g.fillStyle = COL.ink;
  g.beginPath();
  mv(g, -0.096, 0.112);
  qd(g, 0.0, 0.094, 0.08, 0.05);
  ln(g, 0.082, 0.036);
  qd(g, 0.0, 0.071, -0.09, 0.086);
  g.closePath(); g.fill();
  g.lineWidth = 9;
  g.beginPath(); mv(g, -0.09, 0.102); qd(g, -0.108, 0.099, -0.102, 0.079); g.stroke();
  g.beginPath(); mv(g, -0.058, 0.112); ln(g, -0.084, 0.126); g.stroke();
  g.restore();
}

// 臉部貼圖（透明底）：額頭的毛、粉紅點、眉心皺紋、眼睛與眉毛、鼻子、嘴巴
function faceTexture(closed) {
  const c = document.createElement('canvas');
  c.width = c.height = FACE.N;
  const g = c.getContext('2d');
  const P = faceXY;
  // 額頭深棕色的毛（從貝雷帽下往下收成尖角）
  g.fillStyle = COL.tuft;
  g.beginPath();
  g.moveTo(...P(-0.08, 0.26));
  g.lineTo(...P(0.1, 0.26));
  g.quadraticCurveTo(...P(0.03, 0.12), ...P(0.0, 0.045));
  g.quadraticCurveTo(...P(-0.03, 0.12), ...P(-0.08, 0.26));
  g.closePath();
  g.fill();
  // 粉紅點
  const [sx, sy] = P(0, 0.035);
  g.fillStyle = COL.spot;
  g.beginPath(); g.arc(sx, sy, 35, 0, Math.PI * 2); g.fill();
  // 眉心的兩道短皺紋
  g.strokeStyle = COL.ink;
  g.lineCap = 'round';
  g.lineWidth = 8;
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(...P(0.062 * s, 0.064)); g.lineTo(...P(0.049 * s, 0.053)); g.stroke();
  }
  // 眼睛與眉毛
  drawEye(g, -1, closed);
  drawEye(g, 1, closed);
  // 鼻子（小黑點）與嘴巴（短而平的線）
  g.fillStyle = COL.ink;
  const [nx, ny] = P(0, -0.12);
  g.beginPath(); g.arc(nx, ny, 8, 0, Math.PI * 2); g.fill();
  g.lineWidth = 10;
  g.beginPath(); g.moveTo(...P(-0.045, -0.163)); g.lineTo(...P(0.045, -0.163)); g.stroke();
  return canvasTex(c);
}

// 毛衣胸前的黃色「mmu」（手寫風的圓弧筆畫）
function lettersTexture() {
  const W = 1024, H = 300;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.strokeStyle = COL.letters;
  g.lineWidth = 26;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const top = 60, base = 255, r = 45;
  const m = (x) => {
    g.beginPath();
    g.moveTo(x, base); g.lineTo(x, top + r);
    g.arc(x + r, top + r, r, Math.PI, 0);
    g.lineTo(x + 2 * r, base);
    g.moveTo(x + 2 * r, top + r);
    g.arc(x + 3 * r, top + r, r, Math.PI, 0);
    g.lineTo(x + 4 * r, base);
    g.stroke();
  };
  const u = (x) => {
    g.beginPath();
    g.moveTo(x, top); g.lineTo(x, base - r);
    g.arc(x + r, base - r, r, Math.PI, 0, true);
    g.lineTo(x + 2 * r, top);
    g.moveTo(x + 2 * r, top + 10); g.lineTo(x + 2 * r, base);
    g.stroke();
  };
  const total = 4 * r + 40 + 4 * r + 40 + 2 * r;
  let x = (W - total) / 2;
  m(x); x += 4 * r + 40;
  m(x); x += 4 * r + 40;
  u(x);
  return canvasTex(c);
}

// 兩點之間的膠囊（手臂、腿）
function limb(parent, a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, 14), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

function ellipsoid(parent, material, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// 頭的豆子形：下半部（臉頰）略寬。頭與臉部貼圖套用同一個變形，貼圖才會貼合
function beanShape(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = 1 + 0.12 * THREE.MathUtils.clamp(-p.getY(i) / 0.55, 0, 1);
    p.setX(i, p.getX(i) * f);
  }
  p.needsUpdate = true;
  return geo;
}

export function buildSheepNpc(scene, colliders, { x, z, rotY, scale = 1 }) {
  const root = new THREE.Group();
  root.name = 'sheepNpc';
  root.position.set(x, 0, z);
  root.rotation.y = rotY;
  root.scale.setScalar(scale);
  scene.add(root);

  const wool = npcMat(COL.wool);
  const sweater = npcMat(COL.sweater);
  const rib = npcMat(COL.rib);

  // ---------- 腿與蹄 ----------
  const hoof = npcMat(COL.hoof);
  for (const sx of [-0.12, 0.12]) {
    limb(root, new THREE.Vector3(sx, 0.1, 0), new THREE.Vector3(sx, 0.3, 0), 0.065, wool);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.07, 20), hoof);
    h.position.set(sx, 0.035, 0.01);
    h.castShadow = true;
    root.add(h);
  }

  // ---------- 身體（毛衣）：上窄下寬的鐘形 ----------
  const body = new THREE.Group();
  root.add(body);
  const ctrl = [
    [0.001, 0.22], [0.16, 0.235], [0.28, 0.27], [0.34, 0.34], [0.36, 0.45], [0.355, 0.56],
    [0.33, 0.67], [0.29, 0.76], [0.235, 0.83], [0.17, 0.875], [0.11, 0.9], [0.001, 0.915],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const profile = new THREE.SplineCurve(ctrl).getPoints(48);
  const rAt = (y) => {
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1], b = profile[i];
      if (y >= a.y && y <= b.y) return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
    }
    return 0;
  };
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), sweater);
  torso.castShadow = true;
  body.add(torso);
  // 領口與下襬的羅紋
  for (const [y, tube] of [[0.885, 0.03], [0.285, 0.028]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rAt(y), tube, 12, 48), rib);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    body.add(ring);
  }
  // 胸前「mmu」：沿身體曲面的薄片（比身體大 6 mm）
  const ty0 = 0.61, ty1 = 0.79, steps = 14;
  const tPts = [];
  for (let i = 0; i <= steps; i++) {
    const y = ty0 + ((ty1 - ty0) * i) / steps;
    tPts.push(new THREE.Vector2(rAt(y) + 0.006, y));
  }
  const arc = 0.6 / rAt((ty0 + ty1) / 2);
  const letters = new THREE.Mesh(
    new THREE.LatheGeometry(tPts, 40, -arc / 2, arc),
    npcMat('#ffffff', { map: lettersTexture(), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  body.add(letters);

  // ---------- 手臂（毛衣袖子）與交握的雙手 ----------
  const hands = [];
  for (const s of [-1, 1]) {
    const S = new THREE.Vector3(0.25 * s, 0.76, 0.0);
    const E = new THREE.Vector3(0.38 * s, 0.52, 0.1);
    const Wr = new THREE.Vector3(0.11 * s, 0.56, 0.4);
    limb(body, S, E, 0.065, sweater);
    limb(body, E, Wr, 0.062, sweater);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 10, 24), rib);
    cuff.position.copy(Wr);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().subVectors(Wr, E).normalize());
    body.add(cuff);
    hands.push(ellipsoid(body, wool, 0.075, 0.068, 0.06, 0.045 * s, 0.57, 0.43));
  }
  // 交錯的手指
  for (let i = 0; i < 4; i++) {
    const fx = -0.054 + i * 0.036;
    const f = limb(body, new THREE.Vector3(fx, 0.615, 0.4), new THREE.Vector3(fx + 0.004, 0.6, 0.475), 0.019, wool);
    f.castShadow = false;
  }

  // ---------- 頭 ----------
  const head = new THREE.Group();
  head.position.y = HEAD.y;
  root.add(head);
  const skull = ellipsoid(head, wool, HEAD.rx, HEAD.ry, HEAD.rz, 0, 0, 0);
  skull.geometry = beanShape(new THREE.SphereGeometry(1, 48, 32));
  // 臉部貼圖：與頭同一個橢球、略大一點的球面片
  const openTex = faceTexture(false);
  const closedTex = faceTexture(true);
  const faceMat = npcMat('#ffffff', { map: openTex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  const face = new THREE.Mesh(
    beanShape(new THREE.SphereGeometry(1.004, 64, 48, Math.PI / 2 - FACE.PH, 2 * FACE.PH, FACE.T0, FACE.T1 - FACE.T0)),
    faceMat,
  );
  skull.add(face);

  // 耳朵：從頭的兩側斜上往外伸，稍微往後；內側粉紅
  const earInner = npcMat(COL.earInner);
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.25 * s, 0.11, -0.03);
    ear.rotation.set(0, 0.25 * s, 0.5 * s);
    head.add(ear);
    ellipsoid(ear, wool, 0.17, 0.062, 0.026, 0.15 * s, 0, 0);
    ellipsoid(ear, earInner, 0.13, 0.04, 0.017, 0.16 * s, 0, 0.014).castShadow = false;
  }

  // 貝雷帽：扁圓、略往前傾，上面一道深紅色的摺痕
  const beretMat = npcMat(COL.beret);
  const beret = new THREE.Group();
  beret.position.set(0.025, 0.25, 0.015);
  beret.rotation.set(0.14, 0, -0.12);
  head.add(beret);
  const BR = { x: 0.2, y: 0.075, z: 0.19 };
  ellipsoid(beret, beretMat, BR.x, BR.y, BR.z, 0, 0, 0);
  const crease = [];
  for (let i = 0; i <= 8; i++) {
    const px = -0.08 + (0.16 * i) / 8;
    const pz = 0.025 * Math.sin(i * 1.3);
    const py = BR.y * Math.sqrt(Math.max(0, 1 - (px / BR.x) ** 2 - (pz / BR.z) ** 2)) + 0.002;
    crease.push(new THREE.Vector3(px, py, pz));
  }
  beret.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crease), 24, 0.005, 6, false),
    npcMat(COL.beretCrease),
  ));

  // ---------- 碰撞：不讓玩家穿過 ----------
  const hw = 0.45 * scale;
  colliders.push(makeCollider(x - hw, x + hw, z - hw, z + hw, 0, 1.5 * scale, '羊 NPC'));

  // ---------- 待機動作：輕微呼吸與眨眼 ----------
  let t = Math.random() * 10;
  let nextBlink = 1.5 + Math.random() * 2;
  let blinkLeft = 0;
  return {
    root,
    debug: { faceMat, openTex, closedTex },
    update(dt) {
      t += dt;
      const br = Math.sin((t * 2 * Math.PI) / 3.4);
      body.scale.set(1 + br * 0.006, 1 + br * 0.012, 1 + br * 0.006);
      head.position.y = HEAD.y + br * 0.009;
      nextBlink -= dt;
      if (nextBlink <= 0) {
        faceMat.map = closedTex;
        blinkLeft = 0.14;
        nextBlink = 2.5 + Math.random() * 3.5;
      }
      if (blinkLeft > 0) {
        blinkLeft -= dt;
        if (blinkLeft <= 0) faceMat.map = openTex;
      }
    },
  };
}
