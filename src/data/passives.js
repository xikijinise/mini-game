// 被动强化：无升级上限（可欣 10-26）。apply 每次选中都执行，直接叠在 stats 上。
export const PASSIVES = {
  boots: { name: '跑鞋', icon: '👟', desc: '移动速度 +10%', apply: (s) => { s.speed *= 1.1; } },
  heart: { name: '强心', icon: '❤️', desc: '最大生命 +20，并回复 20 生命', apply: (s, scene) => { s.maxHp += 20; scene.heal(20); } },
  magnet: { name: '磁铁', icon: '🧲', desc: '拾取范围 +28%', apply: (s) => { s.pickup *= 1.28; } },
  power: { name: '力量', icon: '💪', desc: '所有伤害 +15%', apply: (s) => { s.damage *= 1.15; } },
  haste: { name: '急速', icon: '⏳', desc: '攻击冷却 -8%', apply: (s) => { s.cooldown *= 0.92; } },
  regen: { name: '再生', icon: '🌿', desc: '每秒回复 0.5 生命', apply: (s) => { s.regen += 0.5; } },
};
