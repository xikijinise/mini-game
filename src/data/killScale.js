// 物种击杀成长（衡岚 balance-w1.2 §3.2）：同物种本局每被击杀 K 只，新刷出的同种怪升 1 星。
// 线性叠加，SOFT_TIER 后 hp/伤害每星收益 ×POST_SOFT_RATIO，速度不再涨。只在刷怪时取值。
export const KILL_SCALE = {
  K: { mouse: 160, rabbit: 160, frog: 120, fox: 70, wolf: 70, boar: 50, bear: 50, tiger: 50 },
  A_HP: 0.18, A_DMG: 0.10, B_SPD: 0.035, // 可欣：每星收益加大（原 0.12 / 0.06 / 0.02）
  SOFT_TIER: 8, POST_SOFT_RATIO: 1 / 3,
};

// 可欣：分物种每星额外加成（加算到 killMult 倍率上）。物种额外项全额、不受软顶打折；软顶只作用于上面全局 A_HP/A_DMG/B_SPD。
export const SPECIES_STAR_BONUS = {
  mouse:  { hp: 0.00, dmg: 0.00, spd: 0.04 },  // 鼠：偏速度
  rabbit: { hp: 0.02, dmg: 0.00, spd: 0.04 },  // 兔：偏速度
  frog:   { hp: 0.05, dmg: 0.02, spd: 0.03 },  // 蛙：跳扑 → 速度 + 一点血
  fox:    { hp: 0.00, dmg: 0.06, spd: 0.03 },  // 狐：伤害 + 速度
  wolf:   { hp: 0.02, dmg: 0.06, spd: 0.03 },  // 狼：伤害 + 速度
  boar:   { hp: 0.12, dmg: 0.03, spd: 0.00 },  // 野猪：偏血
  bear:   { hp: 0.15, dmg: 0.02, spd: 0.00 },  // 熊：偏血
  tiger:  { hp: 0.02, dmg: 0.08, spd: 0.03 },  // 虎：伤害 + 速度
};

export function killTier(type, kills) {
  const k = KILL_SCALE.K[type];
  return k ? Math.floor(kills / k) : 0;
}

export function killMult(type, kills) {
  const { A_HP, A_DMG, B_SPD, SOFT_TIER, POST_SOFT_RATIO: r } = KILL_SCALE;
  const tier = killTier(type, kills);
  const a = Math.min(tier, SOFT_TIER), o = Math.max(0, tier - SOFT_TIER);
  const sb = SPECIES_STAR_BONUS[type] || { hp: 0, dmg: 0, spd: 0 };
  return {
    tier,
    hp: 1 + A_HP * a + A_HP * r * o + sb.hp * tier,
    dmg: 1 + A_DMG * a + A_DMG * r * o + sb.dmg * tier,
    spd: 1 + B_SPD * a + sb.spd * tier,
  };
}

// 可欣：某物种到 UNLOCK_STAR 星时，按出场顺序再解锁后面 UNLOCK_NEXT 种（与 from 时间取并集，谁先到谁放行）
export const SPAWN_ORDER = ['mouse', 'rabbit', 'frog', 'fox', 'wolf', 'boar', 'bear', 'tiger'];
export const UNLOCK_STAR = 1;
export const UNLOCK_NEXT = 2;

/** 当前应出现在刷怪池里的物种（时间 or 星级解锁）。 */
export function unlockedTypes(elapsedSec, killCount, enemies) {
  let max = 1; // 开局鼠+兔
  for (let i = 0; i < SPAWN_ORDER.length; i++) {
    const id = SPAWN_ORDER[i];
    if (elapsedSec >= (enemies[id]?.from ?? 9999)) max = Math.max(max, i);
    if (killTier(id, killCount[id] || 0) >= UNLOCK_STAR) {
      max = Math.max(max, Math.min(SPAWN_ORDER.length - 1, i + UNLOCK_NEXT));
    }
  }
  return SPAWN_ORDER.slice(0, max + 1);
}
