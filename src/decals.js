import * as THREE from 'three';

// 貼皮（decal）：全部用 canvas 畫出來，不載入外部圖片。
// 貼在牆面、門、櫃體表面上，只增加一片薄平面，不增加幾何複雜度。

const cache = new Map();
function texOf(key, w, h, draw, repeat = false) {
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    cache.set(key, t);
  }
  return cache.get(key);
}

const FONT = '"Noto Sans TC","Microsoft JhengHei",sans-serif';
export function txt(g, s, x, y, px, color, { bold = false, align = 'center' } = {}) {
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.font = `${bold ? 'bold ' : ''}${px}px ${FONT}`;
  g.fillText(s, x, y);
}
const circle = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function arrow(g, x, y, dir, len, color) {
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(x - (dir * len) / 2, y);
  g.lineTo(x + (dir * len) / 2, y);
  g.stroke();
  g.beginPath();
  g.moveTo(x + dir * len * 0.5, y);
  g.lineTo(x + dir * len * 0.15, y - len * 0.25);
  g.lineTo(x + dir * len * 0.15, y + len * 0.25);
  g.closePath();
  g.fill();
}

// 紅磚（照片）：1.2 m 一個循環，每排 4 塊、20 排；紅磚為主，約三成灰褐磚；有立體感與表面細紋
export const brickTex = () => texOf('brick2', 1024, 1024, (g, w, h) => {
  const r = rng(11);
  const cols = 4, rows = 20;
  const bw = w / cols, rh = h / rows;
  g.fillStyle = '#d6d1c6';   // 灰白勾縫
  g.fillRect(0, 0, w, h);
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bw / 2;
    for (let i = -1; i <= cols; i++) {
      const grey = r() < 0.3;
      const base = grey
        ? ['#5f5e5a', '#6d6c67', '#55544f'][Math.floor(r() * 3)]
        : ['#a84c38', '#b65a43', '#9b4433', '#c26a4e'][Math.floor(r() * 4)];
      const x = off + i * bw + 3, y = row * rh + 3, bwd = bw - 6, bht = rh - 6;
      g.fillStyle = base;
      g.fillRect(x, y, bwd, bht);
      const grd = g.createLinearGradient(0, y, 0, y + bht);
      grd.addColorStop(0, 'rgba(255,255,255,0.16)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0)');
      grd.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = grd;
      g.fillRect(x, y, bwd, bht);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`;
        g.fillRect(x + r() * bwd, y + r() * bht, 2 + r() * 10, 1);
      }
    }
  }
}, true);

// 門號牌「4」（深灰底、淺色數字）
export const numTex = () => texOf('num', 128, 256, (g, w, h) => {
  g.fillStyle = '#9ea4aa';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a3f44';
  g.fillRect(14, 14, w - 28, h - 28);
  txt(g, '4', w / 2, h / 2, 170, '#e6e9ec');
});

// 木紋門板（縱向紋理）
export const woodTex = () => texOf('wood', 256, 512, (g, w, h) => {
  const r = rng(5);
  g.fillStyle = '#b57a46';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x0 = r() * w, a = r() * 0.4 + 0.1;
    g.strokeStyle = r() < 0.5 ? `rgba(90,50,20,${a * 0.35})` : `rgba(230,180,120,${a * 0.25})`;
    g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath();
    g.moveTo(x0, 0);
    for (let y = 0; y <= h; y += 32) g.lineTo(x0 + Math.sin(y * 0.01 + i) * 6 + (r() - 0.5) * 2, y);
    g.stroke();
  }
}, true);

// 不鏽鋼電梯門（拉絲紋）
export const steelTex = () => texOf('steel', 256, 512, (g, w, h) => {
  const r = rng(3);
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, '#aeb3b8');
  grd.addColorStop(0.35, '#e6e9eb');
  grd.addColorStop(0.6, '#bfc4c8');
  grd.addColorStop(1, '#d7dadd');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(60,64,70,0.08)';
    g.fillRect(0, r() * h, w, 0.6 + r());
  }
  // 雙扇門的中縫
  g.fillStyle = 'rgba(40,44,50,0.85)';
  g.fillRect(w / 2 - 2, 0, 4, h);
});

// 電梯呼叫面板（照片）：不鏽鋼面板，上方樓層顯示窗，中段無障礙標誌，上下箭頭鈕
export const callTex = () => texOf('call2', 280, 1000, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, '#8f969c');
  grd.addColorStop(0.45, '#e8ebed');
  grd.addColorStop(1, '#9ea5ab');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#6b7278';
  g.lineWidth = 4;
  g.strokeRect(4, 4, w - 8, h - 8);
  // 樓層顯示（兩個暗窗、紅字）
  g.fillStyle = '#121416';
  g.fillRect(56, 60, 80, 130);
  g.fillRect(144, 60, 80, 130);
  txt(g, '4', 96, 125, 110, '#ff3b30', { bold: true });
  txt(g, '4', 184, 125, 110, '#ff3b30', { bold: true });
  const btn = (y, dir) => {
    g.fillStyle = '#c7ced4';
    circle(g, 140, y, 36);
    g.strokeStyle = '#5c6268';
    g.lineWidth = 3;
    g.beginPath(); g.arc(140, y, 36, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#3c4247';
    g.beginPath();
    g.moveTo(140 - 16, y - dir * 8); g.lineTo(140 + 16, y - dir * 8); g.lineTo(140, y + dir * 12); g.closePath();
    g.fill();
  };
  btn(330, -1);
  // 無障礙標誌（藍底白圈）
  g.fillStyle = '#1f6fb5';
  g.fillRect(96, 520, 88, 88);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.beginPath(); g.arc(140, 548, 16, 0, Math.PI * 2); g.stroke();
  btn(780, 1);
});

// 消防栓櫃正面（左：滅火器；右：消防栓與警報燈，紅字）
export const hydrantTex = () => texOf('hydrant', 360, 480, (g, w, h) => {
  const RED = '#c0281d';
  g.fillStyle = '#ebebe7';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b5b5ae';
  g.lineWidth = 6;
  g.strokeRect(6, 6, w - 12, h - 12);
  // 左：滅火器櫃
  g.lineWidth = 3;
  g.strokeRect(20, 20, 100, h - 40);
  [...'滅火器'].forEach((ch, i) => txt(g, ch, 70, 90 + i * 60, 46, RED, { bold: true }));
  g.fillStyle = '#5a2620';
  circle(g, 70, 380, 40);
  g.fillStyle = '#7b4a42';
  circle(g, 70, 380, 26);
  // 右：消防栓櫃
  g.strokeRect(130, 20, 210, h - 40);
  g.fillStyle = '#ff5a3c';
  circle(g, 190, 70, 22);
  g.fillStyle = '#7a1510';
  for (let i = 0; i < 4; i++) g.fillRect(230, 56 + i * 9, 40, 3);
  g.fillStyle = RED;
  circle(g, 300, 70, 26);
  g.fillStyle = '#7a1510';
  circle(g, 300, 70, 12);
  g.strokeStyle = '#b5b5ae';
  g.beginPath(); g.moveTo(130, 118); g.lineTo(340, 118); g.stroke();
  txt(g, '消防栓', 235, 185, 60, RED, { bold: true });
  txt(g, 'FIRE HYDRANT', 235, 240, 26, RED, { bold: true });
  txt(g, '操作說明', 235, 290, 22, RED);
  ['1.按下警鈴', '2.拉出水帶', '3.打開閥門'].forEach((s, i) => txt(g, s, 235, 335 + i * 36, 20, RED));
});

// 4F 樓層平面圖看板（青色外框，白色平面，下方方向與目的地）
export const planTex = () => texOf('plan', 520, 740, (g, w, h) => {
  g.fillStyle = '#1f6b73';
  g.fillRect(0, 0, w, h);
  txt(g, '4F', 40, 62, 70, '#ffffff', { bold: true, align: 'left' });
  txt(g, '樓層平面圖', 300, 58, 42, '#ffffff', { bold: true });
  txt(g, 'Floor Plan', 300, 102, 24, '#ffffff');
  g.fillStyle = '#ffffff';
  g.fillRect(24, 140, w - 48, 430);
  // 空調機房與大空間（X 線）
  g.strokeStyle = '#555';
  g.lineWidth = 2;
  g.strokeRect(60, 170, 280, 330);
  g.beginPath(); g.moveTo(60, 170); g.lineTo(340, 500); g.moveTo(340, 170); g.lineTo(60, 500); g.stroke();
  g.fillStyle = '#c9ccd0';
  g.fillRect(40, 180, 16, 300);
  // 教室與廁所（綠色為教室）
  g.fillStyle = '#cfe6d6';
  g.fillRect(360, 180, 120, 110); txt(g, '普通教室', 420, 235, 16, '#333');
  g.fillRect(360, 300, 120, 110); txt(g, '普通教室', 420, 355, 16, '#333');
  g.fillStyle = '#2f5fa8'; g.fillRect(350, 420, 40, 40);
  g.fillStyle = '#c0392b'; g.fillRect(400, 420, 40, 40);
  g.fillStyle = '#8b2c4a'; g.fillRect(450, 420, 30, 40);
  g.fillStyle = '#e0ddd2'; g.fillRect(340, 470, 150, 40);
  g.fillStyle = '#c0392b';
  g.beginPath(); g.ellipse(410, 540, 56, 28, 0, 0, Math.PI * 2); g.fill();
  txt(g, '現在位置', 410, 540, 18, '#ffffff', { bold: true });
  // 底部
  txt(g, '←', 60, 620, 44, '#ffffff', { bold: true });
  ['普通教室 4-1', '教師休息室', '多功能展演廳', 'K410電腦教室'].forEach((s, i) => txt(g, s, 160, 610 + i * 40, 30, '#ffffff', { bold: true, align: 'left' }));
});

// 方向指示牌（青色底）：左：教師休息室；中：K410電腦教室；右：多功能展演廳
export const signTex = () => texOf('sign', 1024, 172, (g, w, h) => {
  g.fillStyle = '#1f7f7f';
  g.fillRect(0, 0, w, h);
  const cy = h / 2;
  arrow(g, 70, cy, -1, 90, '#ffffff');
  txt(g, '教師休息室', 250, cy - 20, 44, '#ffffff', { bold: true });
  txt(g, 'Faculty Lounge', 250, cy + 28, 22, '#ffffff');
  txt(g, 'K410電腦教室', 512, cy - 20, 46, '#ffffff', { bold: true });
  txt(g, 'K410 Computer Classroom', 512, cy + 28, 22, '#ffffff');
  txt(g, '多功能展演廳', 780, cy - 20, 44, '#ffffff', { bold: true });
  txt(g, 'Auditorium', 780, cy + 28, 22, '#ffffff');
  arrow(g, w - 70, cy, 1, 90, '#ffffff');
});

// 垃圾桶正面（資源回收／般垃圾）
export const binTex = () => texOf('bin', 360, 400, (g, w, h) => {
  g.fillStyle = '#c2c8cd';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#9aa2a8';
  g.fillRect(0, 0, w, 90);
  g.fillStyle = '#1e2226';
  g.fillRect(60, 25, 90, 45);
  g.fillRect(210, 25, 90, 45);
  g.fillStyle = '#7f878d';
  g.fillRect(178, 90, 4, h - 90);
  txt(g, '資源回收', 90, 230, 44, '#1d2a2a', { bold: true });
  txt(g, '般垃圾', 270, 230, 44, '#1d2a2a', { bold: true });
});

// 門牌（青色）
export const plateTex = (label) => texOf('plate:' + label, 420, 200, (g, w, h) => {
  g.fillStyle = '#1f6f7a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e8f2f2';
  g.lineWidth = 6;
  g.strokeRect(10, 10, w - 20, h - 20);
  txt(g, label, w / 2, h / 2, 62, '#ffffff', { bold: true });
});

// 貼皮平面：tex 貼在 (x, y, z)，ry 決定面向。repeat 用於磚紋等需要平鋪的貼圖
export function decal(parent, texture, w, h, x, y, z, ry, opts = {}) {
  let t = texture;
  if (opts.repeat) {
    t = texture.clone();
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
    t.needsUpdate = true;
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: t, roughness: opts.rough ?? 0.6, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

// 門板用的木紋材質（共用）
let woodMat = null;
export function woodMaterial() {
  if (!woodMat) woodMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.6 });
  return woodMat;
}

// 下行樓梯踏面（地面開口）：踏面為橫向條紋，由北牆（貼牆、高處）往南逐階變暗
export const stairsDownTex = () => texOf('stairsDown2', 256, 512, (g, w, h) => {
  g.fillStyle = '#2b2e32';
  g.fillRect(0, 0, w, h);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const c = Math.round(132 - 72 * t);
    g.fillStyle = `rgb(${c},${c + 3},${c + 7})`;
    g.fillRect(6, i * h / n + 3, w - 12, h / n - 6);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(6, i * h / n + h / n - 5, w - 12, 3);
  }
});

// 茶水間標示（照片）：青色方塊＋金色咖啡杯圖示，下方灰色底板寫 Pantry
export const pantrySignTex = () => texOf('pantrySign', 256, 320, (g, w, h) => {
  g.fillStyle = '#e4e6e8';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f6f8b';
  g.fillRect(12, 12, w - 24, 200);
  g.fillStyle = '#d9b26a';
  g.beginPath(); g.roundRect(78, 70, 84, 80, 6); g.fill();
  g.beginPath(); g.arc(170, 110, 20, -Math.PI / 2, Math.PI / 2); g.lineWidth = 9; g.strokeStyle = '#d9b26a'; g.stroke();
  g.fillRect(40, 150, 170, 10);
  g.fillStyle = '#2b2f33';
  txt(g, 'Pantry', w / 2, 262, 40, '#2b2f33', { bold: false });
});

// 茶水間牆面瓷磚（米灰色，60 cm 方格）與地面深灰方磚
export const pantryWallTex = () => texOf('pantryWall', 256, 256, (g, w, h) => {
  g.fillStyle = '#cfc7b6';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#b3ab99';
  g.lineWidth = 3;
  g.strokeRect(0, 0, w, h);
}, true);
export const pantryFloorTex = () => texOf('pantryFloor', 256, 256, (g, w, h) => {
  g.fillStyle = '#5f6367';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a8f94';
  g.lineWidth = 3;
  g.strokeRect(0, 0, w, h);
}, true);

// 飲水機正面（照片）：黑色機身、左側圖示欄、上方黑色觸控顯示窗（紅字）、三顆按鈕、
// 中段不鏽鋼出水口與拉絲出水盤、底部黑色櫃體，右上角標示貼紙
export const dispenserTex = () => texOf('dispenser', 250, 600, (g, w, h) => {
  g.fillStyle = '#1d1f22';
  g.fillRect(0, 0, w, h);
  // 左側圖示欄
  g.fillStyle = '#e9e9e6';
  for (let i = 0; i < 4; i++) {
    g.fillRect(18, 150 + i * 36, 22, 4);
    g.beginPath(); g.arc(50, 152 + i * 36, 6, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#e9e9e6';
  txt(g, '防瀑非接觸', 46, 100, 16, '#e9e9e6', { bold: false, align: 'left' });
  // 右上角貼紙
  g.fillStyle = '#f2f2f0';
  g.fillRect(186, 50, 52, 46);
  g.fillStyle = '#5a6066';
  g.fillRect(192, 58, 40, 4); g.fillRect(192, 68, 34, 3); g.fillRect(192, 77, 40, 3);
  // 觸控顯示窗
  g.fillStyle = '#07090c';
  g.fillRect(70, 40, 150, 200);
  g.strokeStyle = '#2d3642';
  g.lineWidth = 2;
  g.strokeRect(70, 40, 150, 200);
  txt(g, '飲水機', 145, 78, 26, '#dfe9f5', { bold: true });
  txt(g, '101', 145, 128, 36, '#ff3b30', { bold: true });
  // 三顆按鈕（熱 / 溫 / 冷）
  const btn = (x, y, color, label) => {
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill();
    txt(g, label, x, y, 16, '#ffffff', { bold: true });
  };
  btn(108, 180, '#c0392b', '熱');
  btn(148, 180, '#d98b26', '溫');
  btn(190, 180, '#2a7fb8', '冷');
  // 出水口與不鏽鋼盤
  g.fillStyle = '#9ea4aa';
  g.fillRect(20, 268, 210, 90);
  const grd = g.createLinearGradient(0, 268, 0, 358);
  grd.addColorStop(0, '#d9dde1'); grd.addColorStop(0.5, '#aeb4ba'); grd.addColorStop(1, '#7d848b');
  g.fillStyle = grd;
  g.fillRect(24, 272, 202, 84);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let y = 276; y < 356; y += 3) { g.beginPath(); g.moveTo(24, y); g.lineTo(226, y); g.stroke(); }
  // 紅色水滴（熱水標誌）
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.moveTo(125, 300); g.bezierCurveTo(108, 322, 108, 336, 125, 344); g.bezierCurveTo(142, 336, 142, 322, 125, 300);
  g.fill();
  // 底部櫃體（黑色）
  g.fillStyle = '#17191c';
  g.fillRect(0, 380, w, h - 380);
});
