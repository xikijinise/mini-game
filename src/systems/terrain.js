import Phaser from 'phaser';
import * as T from '../data/terrain.js';

const D_BASE = -8;
const D_DECO = -6;

export function preloadTerrain(scene) {
  if (!T.TERRAIN_TEX_ENABLED) return;
  for (const k of T.TERRAIN_TEX) scene.load.image(`t_${k}`, `assets/terrain/${k}.png`);
}

const has = (scene, k) => scene.textures.exists(`t_${k}`);
const rect = (r) => new Phaser.Geom.Rectangle(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h);

function fill(scene, r, keys, color) {
  const k = keys[Phaser.Math.Between(0, keys.length - 1)];
  if (has(scene, k)) return scene.add.tileSprite(r.x, r.y, r.w, r.h, `t_${k}`).setDepth(D_BASE);
  return scene.add.rectangle(r.x, r.y, r.w, r.h, color, 0.9).setDepth(D_BASE);
}
function deco(scene, k, x, y) {
  if (has(scene, k)) scene.add.image(x, y, `t_${k}`).setOrigin(0.5, 1).setDepth(D_DECO);
}
const safe = (r) => Math.hypot(r.x, r.y) - Math.max(r.w, r.h) / 2 >= T.SAFE_SPAWN_R;

// 写入 scene.magmaZones / swampZones / riverZones / fordZones；悬崖并入 obstaclesHard + hardAnchors
export function placeTerrain(scene) {
  scene.magmaZones = []; scene.swampZones = []; scene.riverZones = []; scene.fordZones = [];
  for (const r of T.MAGMA_RECTS) {
    if (!safe(r)) continue;
    fill(scene, r, ['lava_01', 'lava_02', 'lava_03'], 0xff5722);
    scene.magmaZones.push(rect(r));
    if (has(scene, 'lava_edge')) scene.add.tileSprite(r.x, r.y - r.h / 2, r.w, 22, 't_lava_edge').setDepth(D_DECO);
    for (let i = 0; i < 3; i++) deco(scene, 'lava_bubble', r.x + Phaser.Math.Between(-r.w / 3, r.w / 3), r.y + Phaser.Math.Between(-r.h / 3, r.h / 3));
  }
  for (const r of T.SWAMP_RECTS) {
    if (!safe(r)) continue;
    fill(scene, r, ['swamp_01', 'swamp_02', 'swamp_03'], 0x2e5d32);
    scene.swampZones.push(rect(r));
    deco(scene, 'swamp_puddle', r.x - r.w / 4, r.y + 10);
    deco(scene, 'swamp_reed', r.x + r.w / 3, r.y - r.h / 2 + 30);
    deco(scene, 'swamp_reed', r.x - r.w / 3, r.y + r.h / 2);
  }
  const R = T.RIVER;
  const riverY = (x) => R.yBase + Math.sin(x / 260) * R.amp;
  for (let x = R.x0; x < R.x1; x += R.seg) {
    const cx = x + R.seg / 2;
    const r = { x: cx, y: riverY(cx), w: R.seg, h: R.h };
    if (has(scene, 'river')) scene.add.tileSprite(r.x, r.y, r.w, r.h, 't_river').setDepth(D_BASE);
    else scene.add.rectangle(r.x, r.y, r.w, r.h, 0x2196f3, 0.85).setDepth(D_BASE);
    scene.riverZones.push(rect(r));
  }
  for (const f of T.FORDS) {
    const y = riverY(f.x);
    if (f.kind === 'bridge') {
      const k = has(scene, 'river_bridge') ? 't_river_bridge' : null;
      if (k) scene.add.image(f.x, y, k).setDepth(D_BASE + 1);
      else scene.add.rectangle(f.x, y, 88, 96, 0x8d6e63).setDepth(D_BASE + 1);
      scene.fordZones.push(rect({ x: f.x, y, w: 88, h: 96 }));
    } else {
      if (has(scene, 'river_shallow')) scene.add.tileSprite(f.x, y, 128, R.h, 't_river_shallow').setDepth(D_BASE + 1);
      else scene.add.rectangle(f.x, y, 128, R.h, 0x90caf9).setDepth(D_BASE + 1);
      scene.fordZones.push(rect({ x: f.x, y, w: 128, h: R.h + 8 }));
    }
  }
  if (!scene.obstaclesHard) scene.obstaclesHard = scene.physics.add.staticGroup();
  scene.hardAnchors = scene.hardAnchors || [];
  for (const c of T.CLIFFS) {
    for (let x = c.x0; x < c.x1; x += 128) {
      const w = Math.min(128, c.x1 - x);
      const cx = x + w / 2;
      const face = has(scene, 'cliff_face')
        ? scene.add.tileSprite(cx, c.y, w, 80, 't_cliff_face')
        : scene.add.rectangle(cx, c.y, w, 80, 0x6d4c41);
      face.setDepth(4.9);
      if (has(scene, 'cliff_edge')) scene.add.tileSprite(cx, c.y - 56, w, 40, 't_cliff_edge').setDepth(4.9);
      scene.physics.add.existing(face, true);
      face.body.setSize(w, 80); face.body.position.set(cx - w / 2, c.y - 40);
      scene.obstaclesHard.add(face);
      scene.hardAnchors.push({ x: cx, y: c.y });
    }
    deco(scene, 'cliff_rubble', c.x0 + 30, c.y + 54);
    deco(scene, 'cliff_rubble', c.x1 - 30, c.y + 54);
  }
}

const inAny = (zs, x, y) => !!zs && zs.some((z) => z.contains(x, y));

// 脚底点 → { slowMul, magma }。boss：沼泽免疫，河流 ×0.85
export function terrainFactor(scene, x, footY, boss = false) {
  let m = 1;
  if (!boss && inAny(scene.swampZones, x, footY)) m = Math.min(m, T.SWAMP_SLOW);
  if (inAny(scene.riverZones, x, footY) && !inAny(scene.fordZones, x, footY)) m = Math.min(m, boss ? T.RIVER_BOSS_SLOW : T.RIVER_SLOW);
  return { slowMul: m, magma: inAny(scene.magmaZones, x, footY) };
}

// 熔浆 tick（独立计时，出区清零）。obj.magmaT 存累计；返回本帧应扣血（0 或 tick 倍数）
export function magmaTick(obj, inMagma, dt, dmgPerTick) {
  if (!inMagma) { obj.magmaT = 0; return 0; }
  obj.magmaT = (obj.magmaT || 0) + dt;
  let d = 0;
  while (obj.magmaT >= T.MAGMA_TICK_MS) { obj.magmaT -= T.MAGMA_TICK_MS; d += dmgPerTick; }
  return d;
}

export function magmaDmg(scene) {
  const bossAlive = scene.enemies && scene.enemies.getChildren().some((e) => e.active && e.def && e.def.boss);
  return T.MAGMA_TICK_DMG * (bossAlive ? T.MAGMA_BOSS_FIGHT_MUL : 1);
}
export { MAGMA_TICK_DMG, MAGMA_HURTS_ENEMIES } from '../data/terrain.js';
