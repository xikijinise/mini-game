// 林绮障碍素材（public/assets/obstacles/README.md）。
// body: 相对图片左上角的碰撞盒 / 减速区 {x,y,w,h}；锚点统一 setOrigin(0.5, 1)。
// kind: hard = 静态硬碰；slow = 无碰撞、进入减速；deco = 纯装饰。
// weight: 开局散布的抽取权重（草/灌木多，大石头少）。
export const OBSTACLE_DEFS = {
  tree_pine:   { kind: 'hard', w: 50, h: 96, body: { x: 21, y: 80, w: 8,  h: 16 }, weight: 4 },
  tree_round:  { kind: 'hard', w: 59, h: 80, body: { x: 24, y: 66, w: 11, h: 14 }, weight: 4 },
  tree_dead:   { kind: 'hard', w: 42, h: 72, body: { x: 17, y: 58, w: 9,  h: 14 }, weight: 2 },
  rock_small:  { kind: 'hard', w: 45, h: 36, body: { x: 4,  y: 10, w: 37, h: 25 }, weight: 3 },
  rock_large:  { kind: 'hard', w: 84, h: 52, body: { x: 4,  y: 8,  w: 77, h: 43 }, weight: 1 },
  bush:        { kind: 'slow', w: 60, h: 32, body: { x: 6,  y: 14, w: 48, h: 16 }, weight: 5 },
  grass_clump: { kind: 'deco', w: 19, h: 20, body: null, weight: 7 },
};

export const OBSTACLE_COUNT = [18, 28]; // 开局散布数量区间
export const OBSTACLE_RING = { min: 120, max: 1000 }; // 离出生点 (0,0) 的距离
export const HARD_MIN_GAP = 70; // 硬碰锚点之间最小距离
export const ANY_MIN_GAP = 40; // 任意两个障碍锚点最小距离（避免贴图严重重叠）
export const SPAWN_AVOID = 50; // 刷怪落点离硬碰锚点的最小距离
export const BUSH_SLOW = 0.6; // 灌木内速度系数（减速 40%）
