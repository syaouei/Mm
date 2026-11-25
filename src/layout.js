import { CONFIG } from './config.js';

// 整層平面的關鍵座標（公尺）。x 向東、z 向南；-z 為北。
// 走廊南北向（x ∈ [xW, xE]）；A 為原本的主教室（走廊東側，中段）；B 在 A 北側（鏡像）；
// 方形空間在 B 北側、橫跨走廊到東牆；C 在走廊西側（鏡像），位於方形空間的西側。
export function geo() {
  const { room, corridor: K, lobby: Lb } = CONFIG;
  const W = room.width, L = room.length, T = room.wallThickness;
  const xI = -W / 2;                  // A、B 的走廊側內面
  const xE = xI - T;                  // 走廊東牆的走廊側面
  const xW = xE - K.width;            // 走廊西牆（窗戶牆）的走廊側面
  const xL1 = xI + W;                 // 方形空間東牆的內面（與 A、B 東牆對齊）
  const z0 = -L / 2 - K.frontExtend;  // B 的北牆（方形空間的南界）
  const zS = z0 - Lb.depth;           // 方形空間的北界（多功能展演廳牆）
  const zNend = zS - K.northExtend;   // 走廊北端
  const z1 = L / 2 + K.backExtend;    // 走廊南端
  const c2 = -(L + T);                // B 的中心 z（鏡像）
  const czC = zS + Lb.cRoomZ + L / 2; // C 的中心 z
  const cxC = xW - T - W / 2;         // C 的中心 x（鏡像，位於走廊西側）
  return { W, L, T, xI, xE, xW, xL1, z0, zS, zNend, z1, c2, czC, cxC };
}
