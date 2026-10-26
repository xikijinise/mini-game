// 怪物掉落的经验晶体，颜色区分怪物大小：蓝 = 小怪，绿 = 中怪，紫 = 大怪，金 = Boss
export const GEMS = {
  small: { color: 0x42a5f5, xp: 1, w: 10, h: 14 },
  medium: { color: 0x43a047, xp: 4, w: 12, h: 17 },
  large: { color: 0x8e24aa, xp: 12, w: 15, h: 21 },
  boss: { color: 0xffb300, xp: 60, w: 20, h: 28 },
};

// 普通怪时间成长：hp × (1 + t / HP_TIME_SCALE_SEC)（衡岚 balance-w1.2 §3.4，t/150 → t/200）。Boss 也吃同一时间成长（可欣）。
export const HP_TIME_SCALE_SEC = 200;

// from：开局第几秒开始出现；weight：出现概率权重；size：贴图像素大小
// behavior（可选）：衡岚 balance-w1-weapons-behaviors.md §C 的移动行为；没有则默认直线追玩家。
// 基础 hp/speed/damage：balance-w1.2 §2。常驻 Boss（野猪王/狼王/象王）在 src/data/bosses.js。
export const ENEMIES = {
  mouse: { name: '老鼠', emoji: '🐭', size: 30, hp: 4, speed: 70, damage: 5, gem: 'small', from: 0, weight: 5,
    behavior: { type: 'zigzag', amplitude: 18, period: 600 } },
  rabbit: { name: '兔子', emoji: '🐰', size: 32, hp: 7, speed: 95, damage: 5, gem: 'small', from: 0, weight: 4,
    behavior: { type: 'hop', hopInterval: 1800, hopDistance: 70, hopSpeedMul: 2.6, windup: 0 } },
  frog: { name: '青蛙', emoji: '🐸', size: 32, hp: 11, speed: 80, damage: 6, gem: 'small', from: 75, weight: 3,
    behavior: { type: 'leap', triggerRange: 180, windup: 400, leapDistance: 140, leapSpeedMul: 3.2, interval: 3000, recover: 300 } },
  fox: { name: '狐狸', emoji: '🦊', size: 38, hp: 20, speed: 100, damage: 10, gem: 'medium', from: 100, weight: 2,
    behavior: { type: 'sidestep', interval: 2200, dodgeDistance: 60, dodgeSpeedMul: 2.2, burstMul: 1.3, burstMs: 600 } },
  wolf: { name: '狼', emoji: '🐺', size: 40, hp: 28, speed: 110, damage: 12, gem: 'medium', from: 130, weight: 2,
    behavior: { type: 'dash', triggerRange: 260, windup: 500, dashDistance: 180, dashSpeedMul: 3.0, interval: 3500 } },
  boar: { name: '野猪', emoji: '🐗', size: 46, hp: 52, speed: 80, damage: 16, gem: 'large', from: 150, weight: 2,
    behavior: { type: 'charge', triggerRange: 320, windup: 700, chargeDistance: 260, chargeSpeedMul: 3.5, interval: 5000, recover: 600 } },
  bear: { name: '熊', emoji: '🐻', size: 56, hp: 104, speed: 65, damage: 21, gem: 'large', from: 210, weight: 2,
    behavior: { type: 'enrage', hpThreshold: 0.5, speedMul: 1.5, scale: 1.15 } },
  tiger: { name: '老虎', emoji: '🐯', size: 54, hp: 90, speed: 115, damage: 23, gem: 'large', from: 270, weight: 2,
    behavior: { type: 'pounce', triggerRange: 220, windup: 350, pounceDistance: 200, pounceSpeedMul: 3.4, interval: 3000, circleSpeedMul: 0.8 } },
};
