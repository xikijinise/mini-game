// 自动攻击的武器。levels[i] 是第 i+1 级的数值，desc[i] 是升到第 i+1 级时卡片上的说明。
// cd / tick 单位是毫秒，speed 单位是弧度每秒。
export const WEAPONS = {
  knife: {
    name: '飞刀',
    icon: '🔪',
    levels: [
      { dmg: 5, cd: 800, count: 1, pierce: 1 },
      { dmg: 6, cd: 750, count: 2, pierce: 1 },
      { dmg: 8, cd: 700, count: 2, pierce: 2 },
      { dmg: 10, cd: 650, count: 3, pierce: 2 },
      { dmg: 13, cd: 550, count: 4, pierce: 3 },
    ],
    desc: ['向最近的敌人投掷飞刀', '飞刀数量 +1', '伤害提升，穿透 +1', '飞刀数量 +1，伤害提升', '飞刀数量 +1，攻速大幅提升'],
  },
  orbit: {
    name: '火球',
    icon: '🔥',
    levels: [
      { dmg: 6, count: 2, radius: 70, speed: 3 },
      { dmg: 7, count: 3, radius: 75, speed: 3.2 },
      { dmg: 10, count: 3, radius: 85, speed: 3.6 },
      { dmg: 12, count: 4, radius: 90, speed: 3.8 },
      { dmg: 15, count: 5, radius: 100, speed: 4.2 },
    ],
    desc: ['火球环绕身体，烧伤靠近的敌人', '火球 +1', '伤害和转速提升', '火球 +1', '火球 +1，范围扩大'],
  },
  lightning: {
    name: '落雷',
    icon: '⚡',
    levels: [
      { dmg: 16, cd: 2200, count: 1 },
      { dmg: 18, cd: 2000, count: 2 },
      { dmg: 24, cd: 1800, count: 2 },
      { dmg: 28, cd: 1600, count: 3 },
      { dmg: 36, cd: 1300, count: 4 },
    ],
    desc: ['定时召唤闪电劈向屏幕内的敌人', '落雷 +1', '伤害提升，冷却缩短', '落雷 +1', '落雷 +1，冷却大幅缩短'],
  },
  aura: {
    name: '光环',
    icon: '🌀',
    levels: [
      { dmg: 3, radius: 70, tick: 500 },
      { dmg: 4, radius: 85, tick: 480 },
      { dmg: 5, radius: 100, tick: 450 },
      { dmg: 6, radius: 115, tick: 400 },
      { dmg: 8, radius: 135, tick: 350 },
    ],
    desc: ['持续伤害身边的敌人', '范围扩大', '伤害提升', '范围扩大，伤害提升', '范围和伤害大幅提升'],
  },
};
