import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';
import { geo } from './layout.js';
import { buildRoom } from './room.js';
import { buildFurniture } from './furniture.js';
import { buildCorridor } from './corridor.js';
import { buildLobby } from './lobby.js';
import { buildRestrooms } from './restroom.js';
import { buildDoors } from './door.js';
import { Player } from './player.js';
import { Debug } from './debug.js';
import { TouchControls } from './touch.js';

const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({ antialias: true });
const maxRatio = isTouchDevice ? CONFIG.render.touchMaxPixelRatio : CONFIG.render.maxPixelRatio;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// 寫實化：電影感色調映射（高光不過曝、色彩較自然）
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = CONFIG.render.exposure;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#202326');
// 寫實化：環境反射（Three.js 內建的室內環境，程式產生），讓金屬、瓷器、亮面地磚有反光
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = CONFIG.render.envIntensity;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(CONFIG.render.fov, window.innerWidth / window.innerHeight, 0.05, 80);

// 教室 A（原本的主教室，位置不動）
const g = geo();
const roomA = buildRoom(scene);
const furnA = buildFurniture(scene);
// 教室 B：A 北側，沿 z 鏡像（格局相反，共用前牆）
const placeB = { cz: g.c2, sz: -1 };
const roomB = buildRoom(scene, { secondary: true, place: placeB });
const furnB = buildFurniture(scene, { place: placeB });
// 教室 C：走廊西側，正方形，旋轉使白板與門都在朝走廊的東牆
const placeC = { cx: g.cxC, cz: g.czC, rot: -Math.PI / 2 };
const roomC = buildRoom(scene, { secondary: true, minimal: true, noFrontWall: true, size: CONFIG.roomC, wb: CONFIG.wallC, boards: true, lecX: 0.4, place: placeC });
const furnC = buildFurniture(scene, { place: placeC, size: CONFIG.roomC, layout: { ...CONFIG.layout, ...CONFIG.layoutC } });

const colliders = [
  ...roomA.colliders, ...furnA.colliders,
  ...roomB.colliders, ...furnB.colliders,
  ...roomC.colliders, ...furnC.colliders,
];
buildCorridor(scene, colliders);
buildLobby(scene, colliders);
buildRestrooms(scene, colliders);
const doors = buildDoors(scene, colliders);

// 靜態場景：陰影預設只算一次，門在動的時候才重算
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const player = new Player(camera, renderer.domElement, colliders);
const debug = new Debug(scene, colliders);

// ---------- 開關門：走到門附近，按 E 或觸控的「門」鈕 ----------
const prompt = document.getElementById('prompt');
const nearestDoor = () => {
  let best = null, bestDist = Infinity;
  for (const d of doors) {
    const dist = Math.hypot(player.x - d.center.x, player.z - d.center.z);
    if (dist < bestDist) { best = d; bestDist = dist; }
  }
  return bestDist < CONFIG.interaction.doorReach ? best : null;
};
const useDoor = () => {
  const d = nearestDoor();
  if (d) d.toggle(player.x, player.z);
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && !e.repeat && player.active) {
    e.preventDefault();
    useDoor();
  }
});
const touch = new TouchControls(player, renderer.domElement, debug, useDoor);

// 電腦版全螢幕按鈕（手機有另外的 ⛶ 鈕）
const fsDesk = document.getElementById('fsDesk');
fsDesk.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
if (!document.fullscreenEnabled) fsDesk.classList.add('hidden');

let lastMsg = null;
function updatePrompt() {
  let msg = '';
  const d = nearestDoor();
  if (d) {
    const act = d.open ? '關' : '開';
    if (d.open && d.occupied(player.x, player.z)) msg = '門板擺動範圍內，請退後一點再關門';
    else msg = touch.enabled ? `點「門」鈕${act}${d.name}` : `按 E ${act}${d.name}`;
  }
  if (msg !== lastMsg) {
    lastMsg = msg;
    prompt.textContent = msg;
    prompt.classList.toggle('show', msg !== '');
  }
}

const overlay = document.getElementById('overlay');
player.onLockChange = (locked) => {
  if (!touch.enabled) overlay.classList.toggle('hidden', locked);
};
// 用手指點 → 進入觸控模式；用滑鼠點 → 鎖定游標
overlay.addEventListener('pointerup', (e) => {
  if (e.pointerType === 'mouse') {
    player.active = true;
    overlay.classList.add('hidden');
    player.requestLock();
  } else {
    touch.enable();
    overlay.classList.add('hidden');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
renderer.setAnimationLoop((t) => {
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 0.1); // 分頁切回來時避免一次跳太遠
  player.update(dt);
  let moving = false;
  for (const d of doors) if (d.update(dt)) moving = true;
  if (moving) renderer.shadowMap.needsUpdate = true; // 門在動時才重算陰影
  updatePrompt();
  debug.update(dt, player);
  renderer.render(scene, camera);
});

// 方便在 console 除錯
window.__app = { scene, camera, player, colliders, CONFIG, doors };
