// 所有尺寸（公尺）、顏色、速度、排列數量都集中在這裡。
// 標註「估計」者是從 reference/ 照片目測推算的數值，請以實際量測修正。
//
// 座標系統（俯視）：
//   x 軸：左右。-x = 門那面側牆（有時鐘、單門、雙門），+x = 窗戶側牆（捲簾）
//   z 軸：前後。-z = 前牆（白板、講桌、投影布幕），+z = 後牆（PTZ 攝影機、柱子）
//   y 軸：高度，地板 y = 0
//   學生面向 -z（前牆）。

export const CONFIG = {
  room: {
    width: 9.6,   // x 方向（前牆長度）— 估計
    length: 11.5, // z 方向（前牆到後牆）— 估計
    height: 2.9,  // 地板到天花板 — 估計（用門高 2.1m 的比例推算約 2.7~2.9m）
    wallThickness: 0.2,
    skirtingHeight: 0.1,
    skirtingDepth: 0.015,
    floorTile: 0.6,   // 地磚尺寸
    ceilingTile: 0.6, // 天花板格板尺寸
  },

  // 後牆上的柱子（照片：面向後牆時位於中央偏右，也就是靠門側）
  pillar: {
    centerX: -1.0, // 估計
    width: 0.8,
    depth: 0.4,    // 凸出牆面
  },

  doors: {
    width: 0.9,
    height: 2.1,
    frame: 0.06,
    // 門都在 -x 側牆；用「距後牆 / 距前牆」描述位置
    back: { distFromBackWall: 0.3, width: 0.9 },     // 靠後牆的單扇門 — 估計
    front: { distFromFrontWall: 0.2, width: 1.5 },   // 靠前牆的雙扇門（一大一小）— 估計
  },

  // 課桌椅排列
  layout: {
    rows: 7,            // 前後排數 — 估計（照片看起來比 6 排多）
    colsPerSide: 4,     // 走道左右各幾組（每排共 colsPerSide*2 組）— 估計
    centerAisle: 1.2,   // 中央走道寬
    sideAisle: 0.8,     // 兩側靠牆通道寬
    frontGap: 2.2,      // 前牆到第一排桌子前緣（講台區）— 估計
    rowPitch: 1.2,      // 相鄰兩排同位置的前後間距 — 估計
    greyDeskRatio: 0.3, // 灰白桌面比例
    seed: 7,            // 桌面顏色隨機種子（固定以免每次重整都不同）
  },

  desk: {
    width: 0.6,   // x
    depth: 0.45,  // z
    height: 0.75, // 桌面高
    topThickness: 0.03,
    boxHeight: 0.12, // 桌面下的收納格
    panelHeight: 0.28, // 前方灰色擋板
    legSize: 0.025,
  },

  chair: {
    seatWidth: 0.42,
    seatDepth: 0.4,
    seatHeight: 0.45,
    seatThickness: 0.03,
    backTop: 0.9,       // 椅背頂端離地
    backHeight: 0.32,
    backThickness: 0.03,
    offsetBehindDesk: 0.12, // 椅面前緣塞在桌子底下的距離（負重疊）
    legSize: 0.022,
  },

  colors: {
    floor: '#b9bab6',
    grout: '#9c9d99',
    wall: '#ece9e1',
    skirting: '#5a3b26',
    ceiling: '#f2f2f0',
    ceilingGrid: '#d9d9d5',
    chair: '#2b7480',
    deskBeige: '#e3d7ae',
    deskGrey: '#d6d6d6',
    metal: '#8a8f94',
    deskBox: '#7d8186',
    door: '#9a6a3f',
    doorFrame: '#3a2a20',
    lightPanel: '#ffffff',
    fixture: '#e6e6e6',
    projector: '#f4f4f4',
    camera: '#1d1d1f',
    speaker: '#e8e5dc',
    whiteboard: '#f7f8f8',
    whiteboardFrame: '#b8bcc0',
    lectern: '#7a4a2c',
    blind: '#d4cfc3',
    vent: '#cfcfcb',
    clock: '#ffffff',
    corridorWall: '#ecebe6',
    corridorFloor: '#5a5d61',
    corridorGrout: '#4a4d51',
    corridorStrip: '#b8babb',
    corridorSkirting: '#3c4045',
    frame: '#2b2e33',
    glass: '#b7d0d4',
    blind: '#8d9096',
    outdoor: '#7d9473',
    extinguisher: '#b8322a',
    acrylic: '#eef3f5',
  },

  lighting: {
    ambient: 1.15,       // HemisphereLight 強度
    sun: 0.9,            // 投影陰影用的方向光（模擬頭頂整體照明）
    pointIntensity: 1.2, // 燈管下方的 PointLight
    pointDistance: 5,
    pointLightCount: 4,  // 最多幾盞 PointLight（效能考量）
    shadowMapSize: 2048,
    // 燈管格狀排列：沿 z 方向擺放的長條燈
    fixtureCols: 3,
    fixtureRows: 4,
    fixtureLength: 1.2,
    fixtureWidth: 0.3,
  },

  player: {
    eyeHeight: 1.6,
    radius: 0.2,         // 碰撞半徑（以正方形處理）
    walkSpeed: 2.0,
    sprintSpeed: 4.0,
    mouseSensitivity: 0.0022,
    pitchLimitDeg: 85,
    // 起始位置：後排、靠門側通道，面向前牆
    start: { fromDoorWall: 0.4, fromBackWall: 0.8 },
  },

  // 教室外的走廊（照片：窗戶在一側、其他教室門在另一側）
  corridor: {
    width: 2.6,        // 走廊寬（教室外牆到窗戶牆）— 估計
    extend: 5,         // 教室前後各延伸多少 m — 估計
    windowBay: 1.6,    // 每格窗戶寬 — 估計
    windowSill: 0.8,   // 窗台高 — 估計
    windowTop: 2.6,    // 窗戶上緣 — 估計
    lightSpacing: 3.0, // 天花板燈的間距 — 估計
    stripSpacing: 2.4, // 地板導引線的間距 — 估計
  },

  // 互動
  interaction: {
    doorReach: 1.4,    // 離門多近才能開關（m）
    doorDuration: 1.2, // 門開或關所需秒數
  },

  // 手機 / 平板觸控操作
  touch: {
    joystickRadius: 56,     // 虛擬搖桿半徑（px）
    deadZone: 0.12,         // 搖桿中心的無效區（比例）
    moveZone: 0.45,         // 螢幕左側多少比例用來開啟搖桿
    lookSensitivity: 0.005, // 拖曳轉頭靈敏度（弧度 / px）
  },

  render: {
    maxPixelRatio: 1.5,
    touchMaxPixelRatio: 1.25, // 觸控裝置降低解析度以維持流暢
    fov: 70,
  },
};
