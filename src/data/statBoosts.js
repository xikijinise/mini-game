// 升级可选的纯数值强化（可欣 10-26）：无上限，每次选中叠加。
export const STAT_BOOSTS = {
  atk: {
    name: '攻击 +1',
    icon: '🗡️',
    desc: '所有伤害固定 +1',
    apply: (s) => { s.atkFlat = (s.atkFlat || 0) + 1; },
  },
  def: {
    name: '防御 +1',
    icon: '🛡️',
    desc: '受到伤害固定 -1（至少留 1 点）',
    apply: (s) => { s.defense = (s.defense || 0) + 1; },
  },
  speed: {
    name: '移速 +10',
    icon: '💨',
    desc: '移动速度 +10',
    apply: (s) => { s.speed += 10; },
  },
  maxHp: {
    name: '生命 +15',
    icon: '💖',
    desc: '最大生命 +15，并回复 15',
    apply: (s, scene) => { s.maxHp += 15; scene.heal(15); },
  },
  pickup: {
    name: '拾取 +15',
    icon: '📡',
    desc: '拾取范围 +15',
    apply: (s) => { s.pickup += 15; },
  },
  cooldown: {
    name: '冷却 -4%',
    icon: '⏱️',
    desc: '攻击冷却 ×0.96',
    apply: (s) => { s.cooldown *= 0.96; },
  },
};

// 武器满 10 级后再选：只加数值 + 变大/范围（每叠一层）
export const WEAPON_OVER = {
  dmgMul: 0.12, // 伤害 ×(1 + stacks*0.12)
  sizeMul: 0.08, // 体积/射程/半径 ×(1 + stacks*0.08)
};
