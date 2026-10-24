// 被动强化，每项最多升 max 级。apply 直接修改玩家属性 stats。
export const PASSIVES = {
  boots: { name: '跑鞋', icon: '👟', max: 5, desc: '移动速度 +10%', apply: (s) => { s.speed *= 1.1; } },
  heart: { name: '强心', icon: '❤️', max: 5, desc: '最大生命 +20，并回复 20 生命', apply: (s, scene) => { s.maxHp += 20; scene.heal(20); } },
  magnet: { name: '磁铁', icon: '🧲', max: 5, desc: '拾取范围 +35%', apply: (s) => { s.pickup *= 1.35; } },
  power: { name: '力量', icon: '💪', max: 5, desc: '所有伤害 +15%', apply: (s) => { s.damage *= 1.15; } },
  haste: { name: '急速', icon: '⏳', max: 5, desc: '攻击冷却 -8%', apply: (s) => { s.cooldown *= 0.92; } },
  regen: { name: '再生', icon: '🌿', max: 5, desc: '每秒回复 0.5 生命', apply: (s) => { s.regen += 0.5; } },
};
