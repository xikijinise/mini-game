// 怪物掉落的经验晶体，颜色区分怪物大小：蓝 = 小怪，绿 = 中怪，紫 = 大怪，金 = Boss
export const GEMS = {
  small: { color: 0x42a5f5, xp: 1, w: 10, h: 14 },
  medium: { color: 0x43a047, xp: 4, w: 12, h: 17 },
  large: { color: 0x8e24aa, xp: 12, w: 15, h: 21 },
  boss: { color: 0xffb300, xp: 60, w: 20, h: 28 },
};

// from：开局第几秒开始出现；weight：出现概率权重；size：贴图像素大小
export const ENEMIES = {
  mouse: { name: '老鼠', emoji: '🐭', size: 30, hp: 4, speed: 70, damage: 5, gem: 'small', from: 0, weight: 5 },
  rabbit: { name: '兔子', emoji: '🐰', size: 32, hp: 6, speed: 95, damage: 6, gem: 'small', from: 0, weight: 4 },
  frog: { name: '青蛙', emoji: '🐸', size: 32, hp: 9, speed: 80, damage: 7, gem: 'small', from: 30, weight: 4 },
  fox: { name: '狐狸', emoji: '🦊', size: 38, hp: 16, speed: 95, damage: 9, gem: 'medium', from: 60, weight: 3 },
  wolf: { name: '狼', emoji: '🐺', size: 40, hp: 22, speed: 105, damage: 10, gem: 'medium', from: 90, weight: 3 },
  boar: { name: '野猪', emoji: '🐗', size: 46, hp: 40, speed: 75, damage: 14, gem: 'large', from: 150, weight: 2 },
  bear: { name: '熊', emoji: '🐻', size: 56, hp: 80, speed: 60, damage: 18, gem: 'large', from: 210, weight: 2 },
  tiger: { name: '老虎', emoji: '🐯', size: 54, hp: 70, speed: 110, damage: 20, gem: 'large', from: 270, weight: 2 },
  elephant: { name: '大象', emoji: '🐘', size: 100, hp: 700, speed: 50, damage: 30, gem: 'boss', boss: true },
};

export const BOSS_TYPE = 'elephant';
export const BOSS_EVERY = 180000; // 每 3 分钟来一只 Boss
