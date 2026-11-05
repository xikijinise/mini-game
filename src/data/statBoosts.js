// 升级可选的纯数值强化（可欣 10-26）：无上限，每次选中叠加。可欣 11-05：单次 ≈ 旧两次。
export const STAT_BOOSTS = {
  atk: {
    name: '攻击 +2',
    icon: '🗡️',
    desc: '所有伤害固定 +2',
    apply: (s) => { s.atkFlat = (s.atkFlat || 0) + 2; },
  },
  def: {
    name: '防御 +2',
    icon: '🛡️',
    desc: '受到伤害固定 -2（至少留 1 点）',
    apply: (s) => { s.defense = (s.defense || 0) + 2; },
  },
  speed: {
    name: '移速 +20',
    icon: '💨',
    desc: '移动速度 +20',
    apply: (s) => { s.speed += 20; },
  },
  maxHp: {
    name: '生命 +30',
    icon: '💖',
    desc: '最大生命 +30，并回复 30',
    apply: (s, scene) => { s.maxHp += 30; scene.heal(30); },
  },
  pickup: {
    name: '拾取 +30',
    icon: '📡',
    desc: '拾取范围 +30',
    apply: (s) => { s.pickup += 30; },
  },
  cooldown: {
    name: '冷却 -8%',
    icon: '⏱️',
    desc: '攻击冷却 ×0.92',
    apply: (s) => { s.cooldown *= 0.92; },
  },
};

// 武器满 10 级后再选：只加数值 + 变大/范围（每叠一层）
export const WEAPON_OVER = {
  dmgMul: 0.12, // 伤害 ×(1 + stacks*0.12)
  sizeMul: 0.08, // 体积/射程/半径 ×(1 + stacks*0.08)
};
