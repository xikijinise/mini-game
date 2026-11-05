// 四地形数值 · 依衡岚短表 /workspace/mini-game-notes/terrain-hazards.md（2026-11-05）
// 调手感只改这里。与 URL / cheat 无关。
export const SAFE_SPAWN_R = 280;      // 出生点 r<280 禁危险地形
export const MAGMA_TICK_MS = 250;
export const MAGMA_TICK_DMG = 2;      // 8 DPS；破 i-frame、不给 i-frame、不吃 defense
export const MAGMA_BOSS_FIGHT_MUL = 0.5; // 场上有 Boss 时对玩家 ×0.5
export const MAGMA_HURTS_ENEMIES = true; // 普通怪同吃；Boss 本体不掉血
export const SWAMP_SLOW = 0.5;        // Boss 免疫
export const RIVER_SLOW = 0.7;
export const RIVER_BOSS_SLOW = 0.85;
export const FORD_SLOW = 1.0;         // 浅滩/桥
// 林绮 v2 贴图预留 key（public/assets/terrain/<key>.png）。v2 到前 TERRAIN_TEX_ENABLED=false → 程序色块
export const TERRAIN_TEX_ENABLED = false;
export const TERRAIN_TEX = [
  'lava_01', 'lava_02', 'lava_03', 'lava_bubble', 'lava_edge',
  'swamp_01', 'swamp_02', 'swamp_03', 'swamp_reed', 'swamp_puddle',
  'river', 'river_shallow', 'river_bridge', 'river_bridge_02',
  'cliff_edge', 'cliff_face', 'cliff_rubble',
];
// 布局（世界坐标，出生 0,0）：东熔浆 / 南沼泽 / 西河流（含桥+浅滩）/ 北悬崖
export const MAGMA_RECTS = [ // x,y 为中心
  { x: 430, y: -60, w: 128, h: 128 }, { x: 620, y: 170, w: 128, h: 96 }, { x: 800, y: -220, w: 96, h: 128 },
];
export const SWAMP_RECTS = [
  { x: -80, y: 420, w: 160, h: 96 }, { x: 170, y: 560, w: 128, h: 96 },
  { x: -260, y: 640, w: 128, h: 96 }, { x: 60, y: 790, w: 160, h: 96 },
];
export const RIVER = { x0: -1536, x1: -320, yBase: 40, amp: 50, seg: 128, h: 64 }; // 西侧横向弯河
export const FORDS = [ // 中心 x；桥/浅滩
  { x: -640, kind: 'bridge' }, { x: -1088, kind: 'ford' },
];
export const CLIFFS = [ // 北侧墙段（中心 y，左右端 x），中间留豁口
  { y: -480, x0: -512, x1: -64 }, { y: -480, x0: 64, x1: 512 }, { y: -760, x0: -256, x1: 256 },
];
