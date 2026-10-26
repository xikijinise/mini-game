// 挑战事件 Boss（衡岚 balance-w1.2 §4，结构沿用 w1.1 §4）。无尽模式：打掉不是通关，超时撤退，之后每 150s 循环、逐轮加强。
// 已按 w1.2 删除 final / enrage / hardCapMs / victory / timeout。
// 时间单位：ms；距离 px；速度 px/s。数值为 L=0（第 1 轮）；轮次倍率见 lapMult()。
// art：贴图 key（复用林绮动物 PNG）；hitbox 用 ENEMY_HITBOX[art]。
export const BOSSES = {
  boarKing: {
    name: '野猪王', emoji: '🐗', art: 'boar', size: 84, boss: true,
    hp: 1400, speed: 100, damage: 24, gem: 'boss',
    skill: { type: 'charge', firstDelay: 2000, interval: 4500, triggerRange: 420, windup: 800, warnWidth: 70,
      chargeDistance: 380, chargeSpeedMul: 3.5, chargeDamage: 30, knockback: 80, recover: 900 },
    fight: { clear: 'offscreen', pauseSpawnMs: 6000, fightSpawnMul: 0.6, retreatAfterMs: 75000 },
    reward: { chest: 1, gems: { boss: 1, large: 4 }, vacuum: true, heal: 0 },
    killMsg: '击退野猪王！', retreatMsg: '野猪王跑了…',
  },
  wolfKing: {
    name: '狼王', emoji: '🐺', art: 'wolf', size: 84, boss: true,
    hp: 5200, speed: 125, damage: 28, gem: 'boss',
    skill: { type: 'summon', firstDelay: 3000, interval: 9000, windup: 600, summonType: 'wolf',
      summonCount: 4, summonCountPhase2: 5, phase2At: 0.5, summonRadius: 220, maxSummonAlive: 8,
      summonGem: 'small', despawnOnBossDeath: true },
    fight: { clear: 'offscreen', pauseSpawnMs: 5000, fightSpawnMul: 0.5, retreatAfterMs: 75000 },
    reward: { chest: 2, gems: { boss: 1, large: 6 }, vacuum: true, heal: 30 },
    killMsg: '击退狼王！', retreatMsg: '狼王跑了…',
  },
  elephantKing: {
    name: '象王', emoji: '🐘', art: 'elephant', size: 120, boss: true,
    hp: 12000, speed: 85, damage: 40, gem: 'boss',
    skill: { type: 'stampede', firstDelay: 3000, interval: 7000, windup: 1200, warnWidth: 90,
      chargeDistance: 650, chargeSpeedMul: 4.0, chargeDamage: 50, knockback: 120,
      shockwaveRadius: 160, shockwaveDamage: 22, shockwaveWarn: 300, recover: 1000,
      phase2At: 0.5, phase2Msg: '象王怒了！', phase2: { interval: 5000, windup: 1000, recover: 800 } },
    // 象王：只清屏外（不清全场），完整怪池
    fight: { clear: 'offscreen', pauseSpawnMs: 6000, fightSpawnMul: 0.4, retreatAfterMs: 90000 },
    reward: { chest: 3, gems: { boss: 2, large: 8 }, vacuum: true, heal: 50 },
    killMsg: '击退象王！它还会回来…', retreatMsg: '象王离开了…下次更强',
  },
};

export const BOSS_CYCLE = ['boarKing', 'wolfKing', 'elephantKing'];
export const BOSS_FIRST_MS = 150000; // 2:30
export const BOSS_EVERY_MS = 150000; // 之后每 150s
export const BOSS_DEFER_MS = 10000; // 上一场未结束时，顺延到结束后 10s
export const OFFSCREEN_CLEAR_RADIUS = 560; // 登场时移除离玩家超过此距离的普通怪（不掉晶）
export const RETREAT_RUN_MS = 2000; // 撤退时向屏外跑多久后移除

/** 第 i 场挑战（0 起）：at 为 ms。 */
export function bossAt(i) {
  return { at: BOSS_FIRST_MS + BOSS_EVERY_MS * i, id: BOSS_CYCLE[i % BOSS_CYCLE.length], lap: Math.floor(i / BOSS_CYCLE.length) };
}

/** 轮次加强：hp ×1.6^L，伤害 ×1.15^L，速度 ×min(1.15, 1.05^L)。技能参数不变（技能伤害同吃伤害倍率）。 */
export function lapMult(lap) {
  return { hp: Math.pow(1.6, lap), dmg: Math.pow(1.15, lap), spd: Math.min(1.15, Math.pow(1.05, lap)) };
}
