import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildRoom } from './room.js';
import { buildFurniture } from './furniture.js';
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
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#202326');

const camera = new THREE.PerspectiveCamera(CONFIG.render.fov, window.innerWidth / window.innerHeight, 0.05, 50);

const room = buildRoom(scene);
const furniture = buildFurniture(scene);
const colliders = [...room.colliders, ...furniture.colliders];

// 靜態場景：只需計算一次陰影
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const player = new Player(camera, renderer.domElement, colliders);
const debug = new Debug(scene, colliders);

const touch = new TouchControls(player, renderer.domElement, debug);

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
  debug.update(dt, player);
  renderer.render(scene, camera);
});

// 方便在 console 除錯
window.__app = { scene, camera, player, colliders, CONFIG };
