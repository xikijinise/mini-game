// 刷怪节奏（衡岚 balance-w1 §2 基础上，可欣 10-26 要求「频率加快」）
// t 单位：秒（elapsed / 1000）

export const SPAWN_INTERVAL_START_MS = 750; // 开局刷怪间隔（原 1100）
export const SPAWN_INTERVAL_DECAY_MS = 6; // 每秒缩短的毫秒数（原 4）
export const SPAWN_INTERVAL_MIN_MS = 320; // 间隔下限（衡岚回拧 280→320）
export const SINGLE_SPAWN_UNTIL_SEC = 45; // 此前每次只刷 1 只（原 60）
export const COUNT_STEP_SEC = 45; // 之后每 45 秒每次多刷 1 只（原 60）
export const MAX_SPAWN_PER_SEC = 24; // 整体刷怪速率封顶（原 20）

// TODO(balance-w1 §2)：蛙潮「小波次」尚未接入，后续随 EnemySpawner 拆分一起做。

/** 本次刷怪后到下次刷怪的间隔（ms）。 */
export function spawnIntervalMs(tSec) {
  return Math.max(SPAWN_INTERVAL_MIN_MS, SPAWN_INTERVAL_START_MS - tSec * SPAWN_INTERVAL_DECAY_MS);
}

/** 每次刷怪的数量（未封顶）。 */
export function spawnCount(tSec) {
  if (tSec < SINGLE_SPAWN_UNTIL_SEC) return 1;
  return 1 + Math.floor((tSec - SINGLE_SPAWN_UNTIL_SEC) / COUNT_STEP_SEC);
}

/** 把数量压到 maxPerSec 速率以内（至少 1）。 */
export function clampSpawnCount(count, intervalMs, maxPerSec = MAX_SPAWN_PER_SEC) {
  const perSec = count / (intervalMs / 1000);
  if (perSec <= maxPerSec) return count;
  return Math.max(1, Math.floor(maxPerSec * intervalMs / 1000));
}
