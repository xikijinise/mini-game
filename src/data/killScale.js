// 物种击杀成长（衡岚 balance-w1.2 §3.2）：同物种本局每被击杀 K 只，新刷出的同种怪升 1 星。
// 线性叠加，SOFT_TIER 后 hp/伤害每星收益 ×POST_SOFT_RATIO，速度不再涨。只在刷怪时取值。
export const KILL_SCALE = {
  K: { mouse: 160, rabbit: 160, frog: 120, fox: 70, wolf: 70, boar: 50, bear: 50, tiger: 50 },
  A_HP: 0.12, A_DMG: 0.06, B_SPD: 0.02,
  SOFT_TIER: 8, POST_SOFT_RATIO: 1 / 3,
};

export function killTier(type, kills) {
  const k = KILL_SCALE.K[type];
  return k ? Math.floor(kills / k) : 0;
}

export function killMult(type, kills) {
  const { A_HP, A_DMG, B_SPD, SOFT_TIER, POST_SOFT_RATIO: r } = KILL_SCALE;
  const tier = killTier(type, kills);
  const a = Math.min(tier, SOFT_TIER), o = Math.max(0, tier - SOFT_TIER);
  return {
    tier,
    hp: 1 + A_HP * a + A_HP * r * o,
    dmg: 1 + A_DMG * a + A_DMG * r * o,
    spd: 1 + B_SPD * a,
  };
}
