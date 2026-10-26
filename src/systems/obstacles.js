import Phaser from 'phaser';
import {
  OBSTACLE_DEFS, OBSTACLE_COUNT, OBSTACLE_RING, HARD_MIN_GAP, ANY_MIN_GAP, SPAWN_AVOID, BUSH_SLOW,
} from '../data/obstacles.js';

// 世界坐标 y → 深度。把无界的 y 单调压进 (5, 7.9)：
// 保持“脚底越靠下越在前”，又不越过晶体(3)/拾取圈(2)之上、飞行物(8+)/血条(11)/HUD(100+)之下的既有层级。
export const ySortDepth = (y) => 5 + 2.9 * (0.5 + Math.atan(y / 2000) / Math.PI);

export function preloadObstacles(scene) {
  for (const key of Object.keys(OBSTACLE_DEFS)) scene.load.image(key, `assets/obstacles/${key}.png`);
}

function pickKey() {
  const entries = Object.entries(OBSTACLE_DEFS);
  let r = Math.random() * entries.reduce((s, [, d]) => s + d.weight, 0);
  for (const [key, d] of entries) {
    r -= d.weight;
    if (r <= 0) return key;
  }
  return entries[0][0];
}

// 开局在出生点 (0,0) 周围散布障碍。写入：
//   scene.obstaclesHard（static group）、scene.bushZones（世界坐标减速矩形）、scene.hardAnchors（硬碰锚点）
export function placeObstacles(scene, cx = 0, cy = 0) {
  scene.obstaclesHard = scene.physics.add.staticGroup();
  scene.bushZones = [];
  scene.hardAnchors = [];
  scene.obstacleSprites = [];

  const target = Phaser.Math.Between(OBSTACLE_COUNT[0], OBSTACLE_COUNT[1]);
  const placed = [];
  let tries = 0;
  while (placed.length < target && tries++ < target * 40) {
    const key = pickKey();
    const def = OBSTACLE_DEFS[key];
    const a = Math.random() * Math.PI * 2;
    // sqrt 让环内面积均匀分布
    const r = Math.sqrt(Phaser.Math.FloatBetween(OBSTACLE_RING.min ** 2, OBSTACLE_RING.max ** 2));
    const x = Math.round(cx + Math.cos(a) * r);
    const y = Math.round(cy + Math.sin(a) * r);
    const tooClose = placed.some((p) => {
      const d = Phaser.Math.Distance.Between(p.x, p.y, x, y);
      if (def.kind === 'hard' && p.kind === 'hard') return d < HARD_MIN_GAP;
      return d < ANY_MIN_GAP;
    });
    if (tooClose) continue;
    placed.push({ key, kind: def.kind, x, y });
    addObstacle(scene, key, x, y);
  }
  return placed.length;
}

function addObstacle(scene, key, x, y) {
  const def = OBSTACLE_DEFS[key];
  // 图片左上角（origin 0.5,1）
  const left = x - def.w / 2;
  const top = y - def.h;

  if (def.kind === 'hard') {
    const img = scene.physics.add.staticImage(x, y, key).setOrigin(0.5, 1);
    const b = def.body;
    // 静态体不跟随 setOrigin，手动：尺寸 → 偏移 → reset 让 position = 左上角 + offset
    img.body.setSize(b.w, b.h, false);
    img.body.offset.set(b.x, b.y);
    img.body.reset(x, y);
    scene.obstaclesHard.add(img);
    scene.hardAnchors.push({ x, y });
    img.setDepth(ySortDepth(y));
    scene.obstacleSprites.push(img);
    return img;
  }

  const img = scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(ySortDepth(y));
  scene.obstacleSprites.push(img);
  if (def.kind === 'slow') {
    const b = def.body;
    scene.bushZones.push(new Phaser.Geom.Rectangle(left + b.x, top + b.y, b.w, b.h));
  }
  return img;
}

// 脚底点 (x, footY) 是否在任一灌木减速区内 → 返回速度系数
export function bushFactor(scene, x, footY) {
  const zones = scene.bushZones;
  if (!zones) return 1;
  for (const z of zones) if (z.contains(x, footY)) return BUSH_SLOW;
  return 1;
}

// 刷怪落点是否离任一硬碰锚点太近
export function nearHardObstacle(scene, x, y, minDist = SPAWN_AVOID) {
  const anchors = scene.hardAnchors;
  if (!anchors) return false;
  const m2 = minDist * minDist;
  return anchors.some((p) => Phaser.Math.Distance.Squared(p.x, p.y, x, y) < m2);
}
