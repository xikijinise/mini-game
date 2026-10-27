import Phaser from 'phaser';
import { makeTextures, preloadArt, FONT, EMOJI_FONT } from '../textures.js';
import { ENEMY_HITBOX } from '../data/enemyArt.js';
import { ENEMIES, GEMS, HP_TIME_SCALE_SEC } from '../data/enemies.js';
import { BOSSES, bossAt, lapMult, BOSS_DEFER_MS, OFFSCREEN_CLEAR_RADIUS } from '../data/bosses.js';
import { killMult, killTier, unlockedTypes, UNLOCK_STAR, SPAWN_ORDER } from '../data/killScale.js';
import { WEAPONS, WEAPON_MAX_LEVEL } from '../data/weapons.js';
import { STAT_BOOSTS, WEAPON_OVER } from '../data/statBoosts.js';
import { PASSIVES } from '../data/passives.js';
import { showLevelUp } from '../ui/levelUp.js';
import { createVirtualJoystick, createPauseButton, isTouchDevice } from '../ui/virtualJoystick.js';
import { thumbZoneHeight } from '../layout.js';
import { spawnIntervalMs, spawnCount, clampSpawnCount } from '../data/waves.js';
import { preloadObstacles, placeObstacles, bushFactor, nearHardObstacle, ySortDepth } from '../systems/obstacles.js';

const MAX_ENEMIES = 300;
const SPAWN_RADIUS = 640; // 在屏幕外一圈刷怪
const DESPAWN_RADIUS = 1000; // 离太远的怪挪回玩家附近
// dash 类行为的距离 / 速度倍率字段名（衡岚 §C）
const DASH_KEYS = {
  dash: { dist: 'dashDistance', mul: 'dashSpeedMul' },
  leap: { dist: 'leapDistance', mul: 'leapSpeedMul' },
  charge: { dist: 'chargeDistance', mul: 'chargeSpeedMul' },
  pounce: { dist: 'pounceDistance', mul: 'pounceSpeedMul' },
  stampede: { dist: 'chargeDistance', mul: 'chargeSpeedMul' }, // 象王践踏冲锋（w1.2 §4.2）
};
const TIER_MSG_COOLDOWN = 3000; // 升星提示冷却，期间同时升星的物种合并成一条
const BEST_KEY = 'stickman-survivor-best-ms';
const HUD_FONT = { fontFamily: FONT, fontSize: '20px', color: '#222222', fontStyle: 'bold' };

const xpForLevel = (lv) => Math.max(1, Math.floor((5 + (lv - 1) * 5 + Math.pow(lv - 1, 1.6)) / 2));
const formatTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// 割草肉鸽主场景：上下左右移动，武器自动攻击，捡晶体升级，五选二强化。
// elapsed 是游戏内时间（毫秒），升级面板打开时停止累加，所有冷却和计时都基于它。
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    preloadArt(this); // 林绮动物 + 回旋镖/剑气 PNG
    preloadObstacles(this); // 林绮障碍 PNG（public/assets/obstacles，base=/survivor/ 下相对路径）
  }

  create() {
    makeTextures(this);
    this.physics.resume();

    this.elapsed = 0;
    this.paused = false;
    this.levelUpOpen = false;
    this.pauseLayer = null;
    this.overLayer = null;
    this.levelUpUi = null;
    this.over = false;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = xpForLevel(1);
    this.pendingLevels = 0;
    this.spawnCooldown = 0;
    // 无尽模式（w1.2）：物种击杀成长 + 常驻 Boss
    this.killCount = {};
    this.bossKills = 0;
    this.bossIndex = 0;
    this.nextBossAt = bossAt(0).at;
    this.boss = null; // 当前在场的常驻 Boss
    this.spawnPauseUntil = 0;
    this.fightSpawnMul = 1;
    this.tierQueue = {}; // type → 新星级，等冷却后合并提示
    this.tierMsgReadyAt = 0;
    this.invulnUntil = 0;
    this.hurtUntil = 0;
    this.damageTexts = 0;
    this.facing = new Phaser.Math.Vector2(1, 0);

    this.stats = { speed: 170, maxHp: 100, hp: 100, regen: 0, pickup: 100, damage: 1, cooldown: 1, atkFlat: 0, defense: 0 };
    this.statLv = Object.fromEntries(Object.keys(STAT_BOOSTS).map((id) => [id, 0]));
    this.weaponLv = Object.fromEntries(Object.keys(WEAPONS).map((id) => [id, 0]));
    this.weaponLv.knife = 1;
    this.passiveLv = Object.fromEntries(Object.keys(PASSIVES).map((id) => [id, 0]));
    this.cooldowns = Object.fromEntries(Object.keys(WEAPONS).map((id) => [id, 0]));
    this.boomerangs = []; // { img, x, y, dir, dist, returning, outSpeed, returnSpeed, maxRange, dieAt, hitOut, hitBack }
    this.orbAngle = 0;
    this.orbs = [];
    this.flailAngle = 0;
    this.flails = []; // 链球图片（绕身慢转）
    this.flailChain = this.add.graphics().setDepth(8);
    this.spikes = []; // { x, y, r, dmg, hitAt, dieAt, warn, img, hit:Set }

    const { width, height } = this.scale;
    this.bg = this.add.tileSprite(0, 0, width + 128, height + 128, 'grid').setDepth(-10);
    this.aura = this.add.image(0, 0, 'aura').setDepth(1).setVisible(false);
    this.player = this.physics.add.sprite(0, 0, 'stick0').setDepth(10);
    this.player.body.setSize(16, 40);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    // 竖屏触控：底部 thumbH 为手指区，镜头下移半个手指区；刷怪半径覆盖整块可见画面。旋转时 onScaleResize 重算
    this.applyViewMetrics(width, height);
    this.hpBar = this.add.graphics().setDepth(11);
    this.pickupRing = this.add.graphics().setDepth(2); // 拾取范围淡圈：低于晶体(3)和玩家(10)

    this.enemies = this.physics.add.group();
    this.knives = this.physics.add.group();
    this.frostBolts = this.physics.add.group();
    this.arrows = this.physics.add.group();
    this.gems = this.add.group();

    this.physics.add.collider(this.enemies, this.enemies);

    // 开局障碍：树/石硬碰（static group），灌木减速，草纯装饰
    placeObstacles(this, 0, 0);
    this.physics.add.collider(this.player, this.obstaclesHard);
    this.physics.add.collider(this.enemies, this.obstaclesHard);
    this.physics.add.overlap(this.knives, this.enemies, this.onKnifeHit, null, this);
    this.physics.add.overlap(this.frostBolts, this.enemies, this.onFrostHit, null, this);
    this.physics.add.overlap(this.arrows, this.enemies, this.onArrowHit, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);

    // 部分移动浏览器 keyboard 插件可能不可用，判空
    const kb = this.input.keyboard;
    this.cursors = kb ? kb.createCursorKeys() : null;
    this.wasd = kb ? kb.addKeys('W,A,S,D') : null;
    if (kb) {
      kb.on('keydown-ESC', this.onEsc, this);
      this.events.once('shutdown', () => kb.off('keydown-ESC', this.onEsc, this));
    }

    this.createHud();
    this.scale.on('resize', this.onScaleResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onScaleResize, this));

    // 手机/平板横屏：左半屏下部浮动摇杆 + 右上暂停按钮；桌面无触控时不显示
    this.isTouch = isTouchDevice();
    this.joystick = null;
    this.pauseBtn = null;
    if (this.isTouch) {
      this.input.addPointer(2); // 多点触控：按住摇杆时还能点暂停/升级卡
      this.joystick = createVirtualJoystick(this, { depth: 950 });
      this.pauseBtn = createPauseButton(this, () => this.onEsc(), { depth: 950 });
      this.placePauseBtn();
    }

    const hintText = this.isTouch ? (this.thumbH ? '下半屏摇杆移动 · 自动攻击 · 捡晶体升级' : '左下摇杆移动 · 自动攻击 · 捡晶体升级') : 'WASD / 方向键移动 · 自动攻击 · 捡晶体升级';
    const hint = this.add.text(width / 2, this.playH - 60, hintText, { ...HUD_FONT, fontSize: '22px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 800, onComplete: () => hint.destroy() });

    // 手验辅助：URL 带 ?cheat=1 时直接送冰锥+连射箭，并且几乎不死
    if (typeof location !== 'undefined' && location.search.includes('cheat')) {
      this.weaponLv.frost = 1;
      this.weaponLv.arrow = 1;
      this.weaponLv.boomerang = 1;
      this.weaponLv.slash = 1;
      this.weaponLv.spike = 1;
      this.weaponLv.flail = 1;
      this.stats.hp = this.stats.maxHp = 9999;
      this.refreshOwnedBar();
      this.flashMessage('作弊开启：冰锥/连射箭/回旋镖/剑气/地刺/链球 · HP 9999');
    }
    // 手验辅助：?t=145 从第 145 秒开局（配合 cheat 测 Boss）
    const tm = typeof location !== 'undefined' && location.search.match(/[?&]t=(\d+)/);
    if (tm) {
      this.elapsed = Number(tm[1]) * 1000;
      while (bossAt(this.bossIndex).at < this.elapsed) this.bossIndex++; // 跳过已过去的 Boss 场次
      this.nextBossAt = bossAt(this.bossIndex).at;
    }
  }

  update(_, delta) {
    if (this.paused || this.over) return;
    const dt = Math.min(delta, 50);
    this.elapsed += dt;

    this.movePlayer();
    this.spawnEnemies(dt);
    this.moveEnemies();
    this.updateKnife(dt);
    this.updateOrbit(dt);
    this.updateLightning(dt);
    this.updateAura(dt);
    this.updateFrost(dt);
    this.updateArrow(dt);
    this.updateBoomerang(dt);
    this.updateSlash(dt);
    this.updateSpike(dt);
    this.updateFlail(dt);
    this.updateKnives();
    this.updateFrostBolts();
    this.updateArrows();
    this.updateGems(dt);
    this.updateBossFight();
    this.flushTierMessages();
    if (this.stats.regen > 0) this.heal(this.stats.regen * dt / 1000);
    if (this.hurtUntil && this.elapsed > this.hurtUntil) {
      this.player.clearTint();
      this.hurtUntil = 0;
    }

    this.bg.setPosition(Math.round(this.player.x / 64) * 64, Math.round(this.player.y / 64) * 64);
    this.updateHud();
  }

  // ---------- 玩家 ----------

  movePlayer() {
    const c = this.cursors;
    const k = this.wasd;
    const down = (key) => !!(key && key.isDown);
    let x = 0;
    let y = 0;
    if (c && k) {
      x = (down(c.right) || down(k.D) ? 1 : 0) - (down(c.left) || down(k.A) ? 1 : 0);
      y = (down(c.down) || down(k.S) ? 1 : 0) - (down(c.up) || down(k.W) ? 1 : 0);
    }
    // 键盘 + 摇杆矢量相加后归一化，任一非零即移动
    if (this.joystick) {
      x += this.joystick.vector.x;
      y += this.joystick.vector.y;
      if (Math.abs(x) < 1e-3) x = 0;
      if (Math.abs(y) < 1e-3) y = 0;
    }
    const dir = new Phaser.Math.Vector2(x, y).normalize();
    const p = this.player;
    const footY = p.y + p.displayHeight / 2;
    const bush = bushFactor(this, p.x, footY);
    this.inBush = bush < 1;
    const spd = this.stats.speed * bush; // 灌木内临时减速 ×0.6，不改 stats.speed
    p.setVelocity(dir.x * spd, dir.y * spd);
    p.setDepth(ySortDepth(footY)); // 按脚底 y 排序，可走到树冠后

    if (x || y) {
      this.facing.copy(dir);
      this.player.setTexture(Math.floor(this.elapsed / 140) % 2 ? 'stick1' : 'stick0');
      if (x) this.player.setFlipX(x < 0);
    } else {
      this.player.setTexture('stick0');
    }
  }

  onPlayerHit(_, enemy) {
    if (this.over || this.elapsed < this.invulnUntil) return;
    // Boss 冲撞/践踏途中命中：用技能伤害替代接触伤害，并击退玩家
    const sk = enemy.def.boss && enemy.state === 'move' ? enemy.bh : null;
    if (sk && sk.chargeDamage) {
      this.hurtPlayer(Math.round(sk.chargeDamage * enemy.dmgMul), enemy.body.center.x, enemy.body.center.y, sk.knockback);
    } else {
      this.hurtPlayer(enemy.damage);
    }
  }

  // 统一受伤入口：接触伤害 / Boss 技能伤害；fromX/fromY + knockback 时把玩家推开
  hurtPlayer(dmg, fromX, fromY, knockback) {
    if (this.over || this.elapsed < this.invulnUntil) return;
    dmg = Math.max(1, Math.round(dmg - (this.stats.defense || 0)));
    this.stats.hp -= dmg;
    if (knockback && fromX !== undefined) {
      const a = Phaser.Math.Angle.Between(fromX, fromY, this.player.x, this.player.y);
      this.player.x += Math.cos(a) * knockback;
      this.player.y += Math.sin(a) * knockback;
    }
    this.invulnUntil = this.elapsed + 700; // balance-w1：500→700
    this.hurtUntil = this.elapsed + 150;
    this.player.setTintFill(0xff3333);
    this.cameras.main.shake(150, 0.008);
    this.hurtFlash.setAlpha(0.28);
    this.tweens.killTweensOf(this.hurtFlash);
    this.tweens.add({ targets: this.hurtFlash, alpha: 0, duration: 260 });
    if (this.stats.hp <= 0) this.gameOver();
  }

  heal(amount) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  // ---------- 怪物 ----------

  spawnEnemies(dt) {
    // 常驻 Boss：同一时刻只有一个；上一场未结束则在 endBossFight 里顺延
    if (!this.boss && this.elapsed >= this.nextBossAt) this.startBossFight(bossAt(this.bossIndex++));

    const t = this.elapsed / 1000;
    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0) return;
    // 节奏公式见 src/data/waves.js（balance-w1 §2）
    const interval = spawnIntervalMs(t);
    this.spawnCooldown = interval;
    if (this.elapsed < this.spawnPauseUntil) return; // Boss 登场后暂停刷怪
    let count = clampSpawnCount(spawnCount(t), interval);
    if (this.fightSpawnMul < 1) count = Math.max(1, Math.floor(count * this.fightSpawnMul)); // 战斗中刷怪倍率
    for (let i = 0; i < count && this.enemies.countActive() < MAX_ENEMIES; i++) {
      this.spawnEnemy(this.pickEnemyType(t));
    }
  }

  pickEnemyType(t) {
    const ids = unlockedTypes(t, this.killCount, ENEMIES);
    const pool = ids.map((id) => [id, ENEMIES[id]]);
    let r = Math.random() * pool.reduce((sum, [, e]) => sum + e.weight, 0);
    for (const [type, e] of pool) {
      r -= e.weight;
      if (r <= 0) return type;
    }
    return pool[0][0];
  }

  // opts：{ lap }（Boss 轮次）、{ x, y, radius }（指定落点中心/半径，召唤用）
  spawnEnemy(type, opts = {}) {
    const def = ENEMIES[type] || BOSSES[type];
    const art = def.art || type;
    // 落点避开硬碰锚点，最多重抽 6 次，失败也照刷（不死循环）
    const cx = opts.x ?? this.player.x;
    const cy = opts.y ?? this.player.y;
    const r = opts.radius ?? this.spawnRadius;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      sx = cx + Math.cos(a) * r;
      sy = cy + Math.sin(a) * r;
      if (!nearHardObstacle(this, sx, sy)) break;
    }
    // 实例数值：普通怪 = 基础 × 时间成长(t/200) × 物种星级；常驻 Boss = 基础 × 时间成长(同公式) × 轮次倍率
    const m = def.boss ? { hp: 1, dmg: 1, spd: 1, tier: 0 } : killMult(type, this.killCount[type] || 0);
    const lm = def.boss ? lapMult(opts.lap || 0) : { hp: 1, dmg: 1, spd: 1 };
    const timeMul = 1 + this.elapsed / (HP_TIME_SCALE_SEC * 1000); // 可欣：Boss 也吃时间成长

    // PNG 贴图：脚底锚点；只按高度缩放（宽度随物种），碰撞盒按 enemies/README.md
    const e = this.enemies.create(sx, sy, art).setOrigin(0.5, 1);
    e.baseScale = (def.size / e.height) * (1 + Math.min(0.35, m.tier * 0.04)); // 每星体型 +4%，上限 +35%
    e.setScale(e.baseScale);
    e.hitbox = ENEMY_HITBOX[art] || [0, 0, e.width, e.height];
    e.body.setSize(e.hitbox[2], e.hitbox[3], false);
    this.setEnemyFlip(e, false);
    e.setDepth(ySortDepth(sy));
    e.def = def;
    e.type = type;
    e.tier = m.tier;
    e.lap = opts.lap || 0;
    e.dmgMul = lm.dmg; // Boss 技能伤害同吃轮次倍率
    e.hp = def.hp * timeMul * m.hp * lm.hp;
    e.damage = Math.round(def.damage * m.dmg * lm.dmg);
    e.speed = def.speed * m.spd * lm.spd;
    e.baseTint = m.tier >= 2 ? 0xffcdd2 : 0; // ★2+ 淡红
    if (e.baseTint) e.setTint(e.baseTint);
    e.knockUntil = 0;
    e.flashUntil = 0;
    e.orbitHitAt = 0;
    e.flailHitAt = 0;
    e.seed = Math.random() * 10;
    // 行为钩子（衡岚 §C）：def.behavior.type，没有则 chase。初始相位随机 0～interval，避免整群同步
    e.maxHp = e.hp;
    this.initBehavior(e, def.skill ? { ...def.skill } : def.behavior); // Boss 技能拷一份，二阶段会改写
    if (def.boss) e.body.pushable = false;
    return e;
  }

  // 恢复常驻色：狂暴 / 二阶段红 > 星级淡红 > 无
  restoreTint(e) {
    if (e.angryTint) e.setTint(e.angryTint);
    else if (e.baseTint) e.setTint(e.baseTint);
    else e.clearTint();
  }

  moveEnemies() {
    const p = this.player;
    for (const e of this.enemies.getChildren()) {
      if (e.flashUntil && this.elapsed > e.flashUntil) {
        this.restoreTint(e);
        e.flashUntil = 0;
      }
      e.rotation = Math.sin(this.elapsed / 110 + e.seed) * 0.12; // 走路时左右晃
      if (this.elapsed < e.knockUntil) continue;
      const busy = e.def.boss && (e.state === 'windup' || e.state === 'move'); // Boss 技能中不瞬移
      if (!busy && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) > this.despawnRadius) {
        const a = Math.random() * Math.PI * 2;
        e.setPosition(p.x + Math.cos(a) * this.spawnRadius, p.y + Math.sin(a) * this.spawnRadius);
      }
      const footY = e.y; // origin(0.5,1)：y 即脚底
      e.setDepth(ySortDepth(footY));
      let spd = (e.slowUntil && this.elapsed < e.slowUntil) ? e.speed * (e.slowFactor || 0.5) : e.speed;
      if (!e.def.boss) spd *= bushFactor(this, e.x, footY); // 怪进灌木同样减速
      this.runBehavior(e, p, spd);
      if (Math.abs(e.body.velocity.x) > 5) this.setEnemyFlip(e, e.body.velocity.x < 0); // 贴图默认朝右
    }
  }

  // ---------- 怪物行为（balance-w1-weapons-behaviors.md §C） ----------

  initBehavior(e, b) {
    e.bh = b || null;
    e.bhType = b ? b.type : 'chase';
    e.speedMul = 1;
    e.state = 'chase';
    if (!b) return;
    const cd = b.hopInterval || b.interval || 0;
    e.nextActAt = this.elapsed + (b.firstDelay ?? Math.random() * cd); // Boss 用 firstDelay
    e.moveDir = new Phaser.Math.Vector2();
    e.zigPhase = Math.random() * Math.PI * 2;
    e.burstUntil = 0;
    e.circleSide = 1;
    if (!DASH_KEYS[e.bhType] && !['hop', 'zigzag', 'enrage', 'sidestep', 'summon'].includes(e.bhType)) e.bhType = 'chase';
  }

  runBehavior(e, p, spd) {
    spd *= e.speedMul;
    if (e.def.boss) this.checkBossPhase2(e);
    switch (e.bhType) {
      case 'summon': return this.summonEnemy(e, p, spd);
      case 'hop': return this.hopEnemy(e, p, spd);
      case 'zigzag': return this.zigzagEnemy(e, p, spd);
      case 'sidestep': return this.sidestepEnemy(e, p, spd);
      case 'enrage':
        if (e.speedMul === 1 && e.hp < e.maxHp * e.bh.hpThreshold) { // 只触发一次
          e.speedMul = e.bh.speedMul;
          e.setScale(e.baseScale * e.bh.scale);
          e.angryTint = 0xff8a80;
          e.setTint(e.angryTint);
          spd *= e.speedMul;
        }
        return this.physics.moveToObject(e, p, spd);
      case 'chase': return this.physics.moveToObject(e, p, spd);
      default: return this.dashEnemy(e, p, spd);
    }
  }

  // hop：平时直追；每 hopInterval 朝玩家锁定方向蹦 hopDistance（速度 ×hopSpeedMul），空中抬高 + scaleY 拉伸
  hopEnemy(e, p, spd) {
    const b = e.bh;
    if (e.state === 'chase' && this.elapsed >= e.nextActAt) {
      e.state = 'move';
      e.moveDir.set(p.x - e.body.center.x, p.y - e.body.center.y).normalize();
      e.moveStart = this.elapsed;
      e.moveDur = (b.hopDistance / Math.max(1, spd * b.hopSpeedMul)) * 1000; // 减速时蹦得慢但距离不变
    }
    if (e.state === 'move') {
      const k = (this.elapsed - e.moveStart) / e.moveDur;
      if (k >= 1) {
        e.state = 'chase';
        e.nextActAt = this.elapsed + b.hopInterval;
        e.setScale(e.baseScale);
        this.setEnemyLift(e, 0);
      } else {
        const v = spd * b.hopSpeedMul;
        e.setVelocity(e.moveDir.x * v, e.moveDir.y * v);
        const arc = Math.sin(Math.PI * k);
        e.rotation = 0;
        e.setScale(e.baseScale * (1 - 0.08 * arc), e.baseScale * (1 + 0.22 * arc));
        this.setEnemyLift(e, Math.round(arc * 14));
        return;
      }
    }
    this.physics.moveToObject(e, p, spd);
  }

  // zigzag：追击方向 + 垂直方向正弦摆动（横向位移幅度 ≈ amplitude，周期 period）
  zigzagEnemy(e, p, spd) {
    const { amplitude, period } = e.bh;
    const dir = new Phaser.Math.Vector2(p.x - e.body.center.x, p.y - e.body.center.y).normalize();
    const w = (Math.PI * 2) / period; // rad/ms
    const lat = amplitude * w * 1000 * Math.cos(w * this.elapsed + e.zigPhase) * (spd / e.speed); // px/s，减速同比
    e.setVelocity(dir.x * spd - dir.y * lat, dir.y * spd + dir.x * lat);
  }

  // sidestep：平时直追；每 interval 垂直于追击方向（随机左右）横跳 dodgeDistance（速度 ×dodgeSpeedMul），
  // 落地后 burstMs 内追击速度 ×burstMul
  sidestepEnemy(e, p, spd) {
    const b = e.bh;
    const t = this.elapsed;
    if (e.state === 'chase' && t >= e.nextActAt) {
      const dx = p.x - e.body.center.x;
      const dy = p.y - e.body.center.y;
      const side = Math.random() < 0.5 ? 1 : -1;
      e.moveDir.set(-dy * side, dx * side).normalize(); // 追击方向的法向
      e.state = 'move';
      e.moveStart = t;
      e.moveDur = (b.dodgeDistance / Math.max(1, spd * b.dodgeSpeedMul)) * 1000; // 减速时闪得慢但距离不变
    }
    if (e.state === 'move') {
      if (t - e.moveStart < e.moveDur) {
        const v = spd * b.dodgeSpeedMul;
        e.setVelocity(e.moveDir.x * v, e.moveDir.y * v);
        e.rotation = e.moveDir.x >= 0 ? 0.25 : -0.25; // 侧身倾斜，读得出是在闪
        return;
      }
      e.state = 'chase';
      e.burstUntil = t + b.burstMs;
      e.nextActAt = t + b.interval;
    }
    this.physics.moveToObject(e, p, t < e.burstUntil ? spd * b.burstMul : spd);
  }

  // dash / leap / charge / pounce 共用：chase → windup（停住 + 抖动变色）→ move（锁方向直线）→ recover → chase
  dashEnemy(e, p, spd) {
    const b = e.bh;
    const K = DASH_KEYS[e.bhType];
    const t = this.elapsed;
    if (e.state === 'chase') {
      if (t >= e.nextActAt && Phaser.Math.Distance.Between(e.body.center.x, e.body.center.y, p.x, p.y) <= (b.triggerRange ?? Infinity)) {
        e.state = 'windup';
        e.stateUntil = t + (b.windup || 0);
        e.circleSide = Math.random() < 0.5 ? 1 : -1; // pounce：预警时绕玩家的方向
        if (b.warnWidth) { // Boss：预警时就锁方向，并画全长红色预警带
          e.moveDir.set(p.x - e.body.center.x, p.y - e.body.center.y).normalize();
          this.drawChargeWarn(e, b);
        }
      } else {
        return this.physics.moveToObject(e, p, spd);
      }
    }
    if (e.state === 'windup') {
      if (e.bhType === 'pounce') {
        // 预警期间沿玩家切线绕到侧面（速度 ×circleSpeedMul），而不是原地停住
        const dx = p.x - e.body.center.x;
        const dy = p.y - e.body.center.y;
        const len = Math.hypot(dx, dy) || 1;
        const v = spd * (b.circleSpeedMul || 0);
        e.setVelocity((-dy / len) * e.circleSide * v, (dx / len) * e.circleSide * v);
      } else {
        e.setVelocity(0, 0);
      }
      e.rotation = Math.sin(t / 30) * 0.2;
      if (!e.flashUntil) e.setTint(0xffa726);
      if (t < e.stateUntil) return;
      if (!e.flashUntil) this.restoreTint(e);
      this.clearWarn(e);
      e.rotation = 0;
      e.state = 'move';
      if (!b.warnWidth) e.moveDir.set(p.x - e.body.center.x, p.y - e.body.center.y).normalize(); // 起冲时锁定方向，途中不转向
      e.moveStart = t;
      e.moveDur = (b[K.dist] / Math.max(1, spd * b[K.mul])) * 1000;
      if (b.shockwaveRadius) this.drawShockWarn(e, b, e.moveDur);
    }
    if (e.state === 'move') {
      const k = (t - e.moveStart) / e.moveDur;
      const blocked = e.bhType === 'charge' && (e.body.blocked.none === false || e.body.touching.none === false) && k > 0.1;
      if (k < 1 && !blocked) {
        const v = spd * b[K.mul];
        e.setVelocity(e.moveDir.x * v, e.moveDir.y * v);
        e.rotation = 0;
        if (e.bhType === 'leap') this.setEnemyLift(e, Math.round(Math.sin(Math.PI * k) * 18));
        return;
      }
      if (e.bhType === 'leap') this.setEnemyLift(e, 0);
      if (b.shockwaveRadius) this.stampedeShock(e, b);
      e.state = 'recover';
      e.stateUntil = t + (b.recover || 0);
    }
    if (e.state === 'recover') {
      e.setVelocity(0, 0);
      if (t < e.stateUntil) return;
      e.state = 'chase';
      e.nextActAt = t + b.interval;
    }
  }

  // 只抬贴图不动碰撞体：origin 上移 lift 像素，同时把 body.offset 反向补偿
  setEnemyLift(e, lift) {
    if (e.lift === lift) return;
    e.lift = lift;
    e.setOrigin(0.5, 1 + lift / e.height);
    e.body.offset.y = e.hitbox[1] + lift;
  }

  // 朝左 flipX；碰撞盒 x 同步镜像（README 盒按朝右给出）
  setEnemyFlip(e, left) {
    e.setFlipX(left);
    const [x, y, w] = e.hitbox;
    e.body.setOffset(left ? e.width - x - w : x, y + (e.lift || 0));
  }

  nearestEnemy(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies.getChildren()) {
      const d = Phaser.Math.Distance.Squared(e.body.center.x, e.body.center.y, this.player.x, this.player.y);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  // fromX / fromY 传了就把怪往反方向击退（Boss 不吃击退）
  damageEnemy(e, amount, fromX, fromY) {
    if (!e.active) return;
    const dmg = amount * this.stats.damage + (this.stats.atkFlat || 0);
    e.hp -= dmg;
    e.setTintFill(0xffffff);
    e.flashUntil = this.elapsed + 70;
    const cx = e.body.center.x;
    const cy = e.body.center.y;
    this.showDamage(e.x, e.y - e.displayHeight, dmg);
    if (fromX !== undefined && !e.def.boss) {
      const a = Phaser.Math.Angle.Between(fromX, fromY, cx, cy);
      e.setVelocity(Math.cos(a) * 200, Math.sin(a) * 200);
      e.knockUntil = this.elapsed + 80;
    }
    if (e.hp <= 0) {
      this.kills++;
      if (e.def.boss) {
        this.onBossKilled(e, cx, cy);
      } else {
        this.dropGem(cx, cy, e.gemOverride || e.def.gem);
        if (!e.summoned) this.countKill(e.type);
      }
      this.clearWarn(e);
      e.destroy();
    }
  }

  // ---------- 物种击杀成长（balance-w1.2 §3） ----------

  countKill(type) {
        const before = killTier(type, this.killCount[type] || 0);
    const unlockedBefore = new Set(unlockedTypes(this.elapsed / 1000, this.killCount, ENEMIES));
    this.killCount[type] = (this.killCount[type] || 0) + 1;
    const after = killTier(type, this.killCount[type]);
    if (after > before) this.tierQueue[type] = after;
    if (after >= UNLOCK_STAR && before < UNLOCK_STAR) {
      const unlockedAfter = unlockedTypes(this.elapsed / 1000, this.killCount, ENEMIES);
      const fresh = unlockedAfter.filter((id) => !unlockedBefore.has(id));
      if (fresh.length) {
        const names = fresh.map((id) => `${ENEMIES[id].emoji}${ENEMIES[id].name}`).join('、');
        this.flashMessage(`${ENEMIES[type].emoji}★${after} → 解锁 ${names}`);
      }
    }
  }

  // 升星提示：冷却 3s，冷却内的多个物种合并成一条
  flushTierMessages() {
    const types = Object.keys(this.tierQueue);
    if (!types.length || this.elapsed < this.tierMsgReadyAt) return;
    const parts = types.map((type) => {
      const tier = this.tierQueue[type];
      const def = ENEMIES[type];
      const hpPct = Math.round((killMult(type, this.killCount[type] || 0).hp - 1) * 100);
      return `${def.emoji} ${def.name} ★${tier}（血 +${hpPct}%）`;
    });
    this.tierQueue = {};
    this.tierMsgReadyAt = this.elapsed + TIER_MSG_COOLDOWN;
    this.flashMessage(parts.join('  '), { y: 0.36, size: 26, color: '#e65100' });
  }

  speciesTiers() {
    return Object.keys(ENEMIES)
      .map((type) => ({ type, tier: killTier(type, this.killCount[type] || 0) }))
      .filter((x) => x.tier > 0);
  }

  // ---------- 常驻 Boss（按 bossAt 时间表登场，打到死才走，不撤退） ----------

  startBossFight({ id, lap }) {
    const def = BOSSES[id];
    const f = def.fight;
    const p = this.player;
    if (f.clear === 'offscreen') { // 清屏外普通怪：不掉晶、不计击杀
      for (const e of this.enemies.getChildren().slice()) {
        if (!e.def.boss && Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) > OFFSCREEN_CLEAR_RADIUS) e.destroy();
      }
    }
    const b = this.spawnEnemy(id, { lap, radius: 520 });
    b.spawnAt = this.elapsed;
    this.boss = b;
    this.spawnPauseUntil = this.elapsed + f.pauseSpawnMs;
    this.fightSpawnMul = f.fightSpawnMul;
    this.flashMessage(`⚠ Boss 来袭：${def.emoji} ${def.name}${lap ? ` · 第 ${lap + 1} 轮` : ''}`);
  }

  // Boss 被击杀后：恢复刷怪；下一场若时间已过，顺延到 10s 后
  endBossFight() {
    const b = this.boss;
    if (b && b.def.skill.despawnOnBossDeath) {
      for (const e of this.enemies.getChildren().slice()) if (e.summoned) e.destroy();
    }
    this.boss = null;
    this.fightSpawnMul = 1;
    this.nextBossAt = Math.max(bossAt(this.bossIndex).at, this.elapsed + BOSS_DEFER_MS);
  }

  updateBossFight() {
    const b = this.boss;
    if (!b) return;
    if (!b.active) this.endBossFight(); // 兜底：Boss 已不在场（正常击杀走 onBossKilled）
  }

  onBossKilled(e, x, y) {
    const r = e.def.reward;
    this.bossKills++;
    for (let i = 0; i < r.chest; i++) this.dropChest(x + (i - (r.chest - 1) / 2) * 34, y);
    for (const [tier, n] of Object.entries(r.gems)) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 24 + Math.random() * 46;
        this.dropGem(x + Math.cos(a) * d, y + Math.sin(a) * d, tier);
      }
    }
    if (r.vacuum) for (const g of this.gems.getChildren()) this.magnetize(g);
    if (r.heal) this.heal(r.heal);
    this.flashMessage(e.def.killMsg, { color: '#2e7d32' });
    this.boss = e; // 让 endBossFight 处理召唤物
    this.endBossFight();
  }

  magnetize(g) {
    if (g.magnet) return;
    g.magnet = true;
    g.speed = 120;
  }

  dropChest(x, y) {
    const c = this.add.image(x, y, 'chest').setDepth(3);
    c.chest = true;
    c.xp = 0;
    c.magnet = false;
    this.gems.add(c);
  }

  // 宝箱 = 一次升级三选一；卡池抽空时回 20 血 + 1 颗金晶兜底
  openChest() {
    if (this.hasUpgradeChoices()) {
      this.pendingLevels++;
      if (!this.paused) this.openLevelUp();
    } else {
      this.heal(20);
      this.dropGem(this.player.x + 30, this.player.y, 'boss');
    }
  }

  hasUpgradeChoices() {
    return true; // 数值卡与被动/武器超限始终可选
  }

  // 二阶段（hp < phase2At）：改写技能参数、常驻红色、提示
  checkBossPhase2(e) {
    const sk = e.def.skill;
    if (e.phase2 || !sk.phase2At || e.hp >= e.maxHp * sk.phase2At) return;
    e.phase2 = true;
    if (sk.phase2) Object.assign(e.bh, sk.phase2);
    e.angryTint = 0xff6e6e;
    if (!e.flashUntil) e.setTint(e.angryTint);
    if (sk.phase2Msg) this.flashMessage(sk.phase2Msg);
  }

  // 狼王 summon：chase → windup（停住嚎叫）→ 在身边召唤狼（不计击杀成长，只掉小晶）
  summonEnemy(e, p, spd) {
    const b = e.bh;
    const t = this.elapsed;
    if (e.state === 'chase' && t >= e.nextActAt) {
      e.state = 'windup';
      e.stateUntil = t + b.windup;
    }
    if (e.state === 'windup') {
      e.setVelocity(0, 0);
      e.rotation = Math.sin(t / 30) * 0.2;
      if (!e.flashUntil) e.setTint(0xffa726);
      if (t < e.stateUntil) return;
      if (!e.flashUntil) this.restoreTint(e);
      e.rotation = 0;
      e.state = 'chase';
      e.nextActAt = t + b.interval;
      const alive = this.enemies.getChildren().filter((x) => x.summoned).length;
      const n = Math.min(e.phase2 ? b.summonCountPhase2 : b.summonCount, b.maxSummonAlive - alive);
      for (let i = 0; i < n && this.enemies.countActive() < MAX_ENEMIES; i++) {
        const w = this.spawnEnemy(b.summonType, { x: e.body.center.x, y: e.body.center.y, radius: b.summonRadius });
        w.summoned = true;
        w.gemOverride = b.summonGem;
      }
      return;
    }
    this.physics.moveToObject(e, p, spd);
  }

  // 冲撞/践踏预警带：从 Boss 沿锁定方向画 chargeDistance 长、warnWidth 宽的红带
  drawChargeWarn(e, b) {
    this.clearWarn(e);
    const g = this.add.graphics().setDepth(2);
    const { x, y } = e.body.center;
    g.fillStyle(0xff1744, 0.22).fillRect(0, -b.warnWidth / 2, b.chargeDistance, b.warnWidth);
    g.lineStyle(2, 0xff1744, 0.5).strokeRect(0, -b.warnWidth / 2, b.chargeDistance, b.warnWidth);
    g.setPosition(x, y).setRotation(e.moveDir.angle());
    e.warnGfx = g;
  }

  clearWarn(e) {
    if (e.warnGfx) {
      e.warnGfx.destroy();
      e.warnGfx = null;
    }
  }

  // 落地震波预警圈：在冲锋终点提前 shockwaveWarn 画圈
  drawShockWarn(e, b, moveDur) {
    const { x, y } = e.body.center;
    const ex = x + e.moveDir.x * b.chargeDistance;
    const ey = y + e.moveDir.y * b.chargeDistance;
    const delay = Math.max(0, moveDur - (b.shockwaveWarn || 300));
    this.time.delayedCall(delay, () => {
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0xff6d00, 0.18).fillCircle(ex, ey, b.shockwaveRadius);
      g.lineStyle(3, 0xff6d00, 0.6).strokeCircle(ex, ey, b.shockwaveRadius);
      this.tweens.add({ targets: g, alpha: 0, delay: b.shockwaveWarn || 300, duration: 250, onComplete: () => g.destroy() });
    });
  }

  stampedeShock(e, b) {
    const { x, y } = e.body.center;
    this.cameras.main.shake(180, 0.01);
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= b.shockwaveRadius) {
      this.hurtPlayer(Math.round(b.shockwaveDamage * e.dmgMul), x, y, 40);
    }
  }

  // ---------- 武器 ----------

  updateKnife(dt) {
    const lv = this.weaponLv.knife;
    if (!lv || (this.cooldowns.knife -= dt) > 0) return;
    const s = this.weaponRuntime('knife');
    this.cooldowns.knife = s.cd * this.stats.cooldown;

    const p = this.player;
    const target = this.nearestEnemy(520);
    const base = target ? Phaser.Math.Angle.Between(p.x, p.y, target.body.center.x, target.body.center.y) : this.facing.angle();
    for (let i = 0; i < s.count; i++) {
      const a = base + (i - (s.count - 1) / 2) * 0.2;
      const k = this.knives.create(p.x, p.y - 6, 'knife').setRotation(a).setDepth(8).setScale(s._sizeMul || 1);
      k.body.setCircle(5, 5, 0);
      k.setVelocity(Math.cos(a) * 480, Math.sin(a) * 480);
      Object.assign(k, { damage: s.dmg, pierce: s.pierce, hits: new Set(), dieAt: this.elapsed + 1300 });
    }
  }

  onKnifeHit(knife, enemy) {
    if (!knife.active || knife.hits.has(enemy)) return;
    knife.hits.add(enemy);
    this.damageEnemy(enemy, knife.damage, knife.x, knife.y);
    if (--knife.pierce <= 0) knife.destroy();
  }

  updateKnives() {
    for (const k of this.knives.getChildren().slice()) {
      if (this.elapsed > k.dieAt) k.destroy();
    }
  }

  updateOrbit(dt) {
    const lv = this.weaponLv.orbit;
    if (!lv) return;
    const s = this.weaponRuntime('orbit');
    while (this.orbs.length < s.count) this.orbs.push(this.add.image(0, 0, 'fireball').setDepth(9));
    this.orbs.forEach((orb) => orb.setScale(s._sizeMul || 1));

    const p = this.player;
    this.orbAngle += s.speed * dt / 1000;
    this.orbs.forEach((orb, i) => {
      const a = this.orbAngle + (i / s.count) * Math.PI * 2;
      orb.setPosition(p.x + Math.cos(a) * s.radius, p.y + Math.sin(a) * s.radius);
    });

    for (const e of this.enemies.getChildren().slice()) {
      if (this.elapsed < e.orbitHitAt) continue;
      const { x: ex, y: ey } = e.body.center;
      if (Math.abs(ex - p.x) > s.radius + 60 || Math.abs(ey - p.y) > s.radius + 60) continue;
      const reach = 10 + e.def.size * 0.35;
      const orb = this.orbs.find((o) => Phaser.Math.Distance.Between(o.x, o.y, ex, ey) < reach);
      if (orb) {
        e.orbitHitAt = this.elapsed + 350;
        this.damageEnemy(e, s.dmg, orb.x, orb.y);
      }
    }
  }

  // 链球：比火球更远、更慢、更重，数量少；每怪命中冷却 450ms
  updateFlail(dt) {
    const lv = this.weaponLv.flail;
    if (!lv) return;
    const s = this.weaponRuntime('flail');
    const sm = s._sizeMul || 1;
    while (this.flails.length < s.count) this.flails.push(this.add.image(0, 0, 'flail').setOrigin(30 / 46, 0.5).setDepth(9));
    const p = this.player;
    this.flailAngle += s.speed * dt / 1000;
    this.flailChain.clear().lineStyle(2, 0x757575, 0.55);
    this.flails.forEach((f, i) => {
      const a = this.flailAngle + (i / s.count) * Math.PI * 2;
      const fx = p.x + Math.cos(a) * s.radius;
      const fy = p.y + Math.sin(a) * s.radius;
      f.setPosition(fx, fy).setRotation(a).setScale(1.15 * sm);
      this.flailChain.lineBetween(p.x, p.y, fx, fy);
    });

    const ballR = 14 * sm;
    for (const e of this.enemies.getChildren().slice()) {
      if (this.elapsed < e.flailHitAt) continue;
      const { x: ex, y: ey } = e.body.center;
      if (Math.abs(ex - p.x) > s.radius + 80 || Math.abs(ey - p.y) > s.radius + 80) continue;
      const reach = ballR + e.def.size * 0.35;
      const f = this.flails.find((o) => Phaser.Math.Distance.Between(o.x, o.y, ex, ey) < reach);
      if (f) {
        e.flailHitAt = this.elapsed + 450;
        this.damageEnemy(e, s.dmg, f.x, f.y);
      }
    }
  }

  // 地刺：冷却到了在脚下（多根则绕身一圈）预警 → 冒刺结算一次 → durationMs 后消失
  updateSpike(dt) {
    if (this.spikes.length) this.tickSpikes();
    const lv = this.weaponLv.spike;
    if (!lv || (this.cooldowns.spike -= dt) > 0) return;
    const s = this.weaponRuntime('spike');
    this.cooldowns.spike = s.cd * this.stats.cooldown;
    const p = this.player;
    const n = s.count || 1;
    const pts = [];
    if (n === 1) {
      pts.push({ x: p.x + this.facing.x * 12, y: p.y + 10 + this.facing.y * 12 });
    } else {
      const ring = s.radius * 1.15;
      const a0 = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2;
        pts.push({ x: p.x + Math.cos(a) * ring, y: p.y + 10 + Math.sin(a) * ring });
      }
    }
    for (const pt of pts) {
      const warn = this.add.graphics().setDepth(2);
      warn.fillStyle(0xb71c1c, 0.18).fillCircle(0, 0, s.radius);
      warn.lineStyle(2, 0xb71c1c, 0.55).strokeCircle(0, 0, s.radius);
      warn.setPosition(pt.x, pt.y).setScale(0.6);
      this.tweens.add({ targets: warn, scale: 1, duration: s.warnMs });
      this.spikes.push({ x: pt.x, y: pt.y, r: s.radius, dmg: s.dmg, hitAt: this.elapsed + s.warnMs, dieAt: this.elapsed + s.warnMs + s.durationMs, warn, img: null, hit: new Set() });
    }
  }

  tickSpikes() {
    for (const sp of this.spikes) {
      if (!sp.img && this.elapsed >= sp.hitAt) {
        sp.warn.destroy();
        sp.warn = null;
        const sc = sp.r / 40;
        sp.img = this.add.image(sp.x, sp.y + sp.r * 0.25, 'spike').setOrigin(0.5, 1).setDepth(7).setScale(sc, 0.2);
        this.tweens.add({ targets: sp.img, scaleY: sc, duration: 90, ease: 'Back.Out' });
        for (const e of this.enemies.getChildren().slice()) {
          if (sp.hit.has(e)) continue;
          const { x: ex, y: ey } = e.body.center;
          if (Phaser.Math.Distance.Between(sp.x, sp.y, ex, ey) > sp.r + e.def.size * 0.3) continue;
          sp.hit.add(e);
          this.damageEnemy(e, sp.dmg, sp.x, sp.y);
        }
      }
      if (this.elapsed >= sp.dieAt) {
        if (sp.warn) sp.warn.destroy();
        if (sp.img) {
          const img = sp.img;
          this.tweens.add({ targets: img, alpha: 0, scaleY: img.scaleY * 0.3, duration: 120, onComplete: () => img.destroy() });
        }
        sp.dead = true;
      }
    }
    this.spikes = this.spikes.filter((sp) => !sp.dead);
  }

  updateLightning(dt) {
    const lv = this.weaponLv.lightning;
    if (!lv || (this.cooldowns.lightning -= dt) > 0) return;
    const s = this.weaponRuntime('lightning');
    this.cooldowns.lightning = s.cd * this.stats.cooldown;

    const view = this.cameras.main.worldView;
    const onScreen = this.enemies.getChildren().filter((e) => view.contains(e.body.center.x, e.body.center.y));
    for (const e of Phaser.Utils.Array.Shuffle(onScreen).slice(0, s.count)) {
      this.drawBolt(e.body.center.x, e.body.center.y, view.y);
      this.damageEnemy(e, s.dmg);
    }
  }

  drawBolt(x, y, top) {
    const g = this.add.graphics().setDepth(20);
    g.lineStyle(4, 0xfbc02d);
    g.beginPath();
    g.moveTo(x + Phaser.Math.Between(-40, 40), top);
    for (let i = 1; i < 6; i++) g.lineTo(x + Phaser.Math.Between(-18, 18), top + (y - top) * i / 6);
    g.lineTo(x, y);
    g.strokePath();
    g.fillStyle(0xfff59d, 0.8).fillCircle(x, y, 18);
    this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
  }

  updateAura(dt) {
    const lv = this.weaponLv.aura;
    if (!lv) return;
    const s = this.weaponRuntime('aura');
    const p = this.player;
    this.aura.setVisible(true).setPosition(p.x, p.y).setScale(s.radius / 64);
    if ((this.cooldowns.aura -= dt) > 0) return;
    this.cooldowns.aura = s.tick;
    for (const e of this.enemies.getChildren().slice()) {
      if (Phaser.Math.Distance.Between(e.body.center.x, e.body.center.y, p.x, p.y) < s.radius + e.def.size * 0.3) this.damageEnemy(e, s.dmg);
    }
  }


  // 冰锥：朝最近敌人射出，命中减速并造成伤害
  updateFrost(dt) {
    const lv = this.weaponLv.frost;
    if (!lv || (this.cooldowns.frost -= dt) > 0) return;
    const s = this.weaponRuntime('frost');
    this.cooldowns.frost = s.cd * this.stats.cooldown;

    const p = this.player;
    const target = this.nearestEnemy(560);
    const a = target ? Phaser.Math.Angle.Between(p.x, p.y, target.body.center.x, target.body.center.y) : this.facing.angle();
    for (let i = 0; i < s.count; i++) {
      const ang = a + (i - (s.count - 1) / 2) * 0.18;
      const b = this.frostBolts.create(p.x, p.y - 4, 'frost').setRotation(ang).setDepth(8).setScale(s._sizeMul || 1);
      b.body.setCircle(6, 4, 2);
      b.setVelocity(Math.cos(ang) * 420, Math.sin(ang) * 420);
      Object.assign(b, { damage: s.dmg, slow: s.slow, hits: new Set(), dieAt: this.elapsed + 1400 });
    }
  }

  onFrostHit(bolt, enemy) {
    if (!bolt.active || bolt.hits.has(enemy)) return;
    bolt.hits.add(enemy);
    this.damageEnemy(enemy, bolt.damage, bolt.x, bolt.y);
    if (!enemy.def.boss) {
      enemy.slowUntil = this.elapsed + 900;
      enemy.slowFactor = bolt.slow;
    }
    bolt.destroy();
  }

  updateFrostBolts() {
    for (const b of this.frostBolts.getChildren().slice()) {
      if (this.elapsed > b.dieAt) b.destroy();
    }
  }

  // 连射箭：扇形齐射，穿透较弱但数量多
  updateArrow(dt) {
    const lv = this.weaponLv.arrow;
    if (!lv || (this.cooldowns.arrow -= dt) > 0) return;
    const s = this.weaponRuntime('arrow');
    this.cooldowns.arrow = s.cd * this.stats.cooldown;

    const p = this.player;
    const target = this.nearestEnemy(600);
    const base = target ? Phaser.Math.Angle.Between(p.x, p.y, target.body.center.x, target.body.center.y) : this.facing.angle();
    for (let i = 0; i < s.count; i++) {
      const a = base + (i - (s.count - 1) / 2) * 0.14;
      const ar = this.arrows.create(p.x, p.y - 4, 'arrow').setRotation(a).setDepth(8).setScale(s._sizeMul || 1);
      ar.body.setCircle(4, 8, 1);
      ar.setVelocity(Math.cos(a) * 520, Math.sin(a) * 520);
      Object.assign(ar, { damage: s.dmg, pierce: s.pierce, hits: new Set(), dieAt: this.elapsed + 1200 });
    }
  }

  onArrowHit(arrow, enemy) {
    if (!arrow.active || arrow.hits.has(enemy)) return;
    arrow.hits.add(enemy);
    this.damageEnemy(enemy, arrow.damage, arrow.x, arrow.y);
    if (--arrow.pierce <= 0) arrow.destroy();
  }

  updateArrows() {
    for (const a of this.arrows.getChildren().slice()) {
      if (this.elapsed > a.dieAt) a.destroy();
    }
  }

  // 回旋镖（衡岚 B1）：朝最近敌人掷出，以 outSpeed 飞到 maxRange 折返，以 returnSpeed 追玩家当前位置，
  // 碰到玩家或超过 lifetime 销毁。无限穿透；hitOut / hitBack 两个 Set，hitBothWays 时去回各打一次。
  // 字段兼容：表字段缺失时退回旧字段（range→maxRange）
  updateBoomerang(dt) {
    const p = this.player;
    const px = p.x;
    const py = p.y - 4;
    for (const b of this.boomerangs.slice()) {
      const step = (b.returning ? b.returnSpeed : b.outSpeed) * dt / 1000;
      let kill = this.elapsed >= b.dieAt;
      if (!b.returning) {
        b.x += b.dir.x * step;
        b.y += b.dir.y * step;
        b.dist += step;
        if (b.dist >= b.maxRange) b.returning = true;
      } else {
        const d = Phaser.Math.Distance.Between(b.x, b.y, px, py);
        if (d <= step + 14) kill = true;
        else {
          b.x += (px - b.x) / d * step;
          b.y += (py - b.y) / d * step;
        }
      }
      if (kill) {
        b.img.destroy();
        this.boomerangs.splice(this.boomerangs.indexOf(b), 1);
        continue;
      }
      b.img.setPosition(b.x, b.y);
      b.img.rotation += dt * Math.PI * 4 / 1000; // 自转 720°/s（weapons/README：boomerang.png + 代码旋转）
      const hits = b.returning && b.hitBothWays ? b.hitBack : b.hitOut;
      for (const e of this.enemies.getChildren().slice()) {
        if (hits.has(e)) continue;
        const { x: ex, y: ey } = e.body.center;
        if (Math.abs(ex - b.x) > 80 || Math.abs(ey - b.y) > 80) continue;
        if (Phaser.Math.Distance.Between(b.x, b.y, ex, ey) < 10 + e.def.size * 0.34) { // 镖碰撞 r≈10（weapons/README）
          hits.add(e);
          this.damageEnemy(e, b.dmg, b.x, b.y);
        }
      }
    }

    const lv = this.weaponLv.boomerang;
    if (!lv || (this.cooldowns.boomerang -= dt) > 0) return;
    const s = this.weaponRuntime('boomerang');
    this.cooldowns.boomerang = s.cd * this.stats.cooldown;
    const maxRange = s.maxRange ?? s.range ?? 200;
    const outSpeed = s.outSpeed ?? 400;
    const target = this.nearestEnemy(maxRange + 80);
    const base = target ? Phaser.Math.Angle.Between(px, py, target.body.center.x, target.body.center.y) : this.facing.angle();
    const spread = Phaser.Math.DegToRad(s.spreadDeg || 0);
    for (let i = 0; i < s.count; i++) {
      const a = base + (i - (s.count - 1) / 2) * spread; // 以目标方向为中心扇形
      this.boomerangs.push({
        img: this.add.image(px, py, 'boomerang').setDepth(8).setScale(s._sizeMul || 1),
        x: px, y: py, dist: 0, returning: false,
        dir: new Phaser.Math.Vector2(Math.cos(a), Math.sin(a)),
        outSpeed, returnSpeed: s.returnSpeed ?? outSpeed * 1.2, maxRange,
        dieAt: this.elapsed + (s.lifetime ?? 2200), dmg: s.dmg,
        hitBothWays: s.hitBothWays ?? true, hitOut: new Set(), hitBack: new Set(),
      });
    }
  }

  // 剑气：朝最近敌人方向挥出扇形，瞬时伤害扇内所有敌人
  updateSlash(dt) {
    const lv = this.weaponLv.slash;
    if (!lv || (this.cooldowns.slash -= dt) > 0) return;
    const s = this.weaponRuntime('slash');
    const radius = s.range ?? s.radius; // 兼容表字段 range/arcDeg 与旧字段 radius/arc
    const arcDeg = s.arcDeg ?? s.arc;
    const p = this.player;
    const target = this.nearestEnemy(radius * 1.5);
    if (!target) {
      this.cooldowns.slash = 120; // 附近没怪就别空挥，稍后再看
      return;
    }
    this.cooldowns.slash = s.cd * this.stats.cooldown;
    const baseDir = Phaser.Math.Angle.Between(p.x, p.y, target.body.center.x, target.body.center.y);
    const dirs = [baseDir];
    if ((s.count || 1) >= 2) dirs.push(baseDir + Math.PI); // 背后再斩
    const half = Phaser.Math.DegToRad(arcDeg) / 2;
    const hit = new Set();
    for (const dir of dirs) {
      this.playSlashFx(p, dir, radius, half);
      for (const e of this.enemies.getChildren().slice()) {
        if (hit.has(e)) continue;
        const reach = radius + e.def.size * 0.3;
        const { x: ex, y: ey } = e.body.center;
        if (Phaser.Math.Distance.Between(p.x, p.y, ex, ey) > reach) continue;
        const da = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(p.x, p.y, ex, ey) - dir));
        if (da > half) continue;
        hit.add(e);
        this.damageEnemy(e, s.dmg, p.x, p.y);
        if (s.knockback && !e.def.boss && e.active) {
          const a = Phaser.Math.Angle.Between(p.x, p.y, ex, ey);
          e.x += Math.cos(a) * s.knockback;
          e.y += Math.sin(a) * s.knockback;
        }
      }
    }
  }

  // 剑气表现（weapons/README）：slash_01 ~60ms → slash → slash_02 ~100ms 后销毁；弧头朝外（origin(1,0.5)）。
  // 底下垫一层很淡的扇形，标出实际判定 arc/range
  playSlashFx(p, dir, radius, half) {
    const fan = this.add.graphics().setDepth(9);
    fan.fillStyle(0xcdeef0, 0.22).slice(p.x, p.y, radius, dir - half, dir + half, false).fillPath();
    this.tweens.add({ targets: fan, alpha: 0, duration: 200, onComplete: () => fan.destroy() });
    const sc = radius / 136;
    const fx = this.add.image(p.x + Math.cos(dir) * radius * 0.55, p.y + Math.sin(dir) * radius * 0.55, 'slash_01')
      .setOrigin(1, 0.5).setRotation(dir).setDepth(9).setScale(sc, Math.max(1, sc * 1.6));
    this.tweens.add({
      targets: fx, x: p.x + Math.cos(dir) * radius, y: p.y + Math.sin(dir) * radius, duration: 160,
      onUpdate: (tw) => {
        const k = tw.progress;
        const key = k < 0.35 ? 'slash_01' : k < 0.7 ? 'slash' : 'slash_02';
        if (fx.texture.key !== key) fx.setTexture(key);
      },
      onComplete: () => this.tweens.add({ targets: fx, alpha: 0, duration: 100, onComplete: () => fx.destroy() }),
    });
  }

  // ---------- 经验与升级 ----------

  dropGem(x, y, tier) {
    const gem = this.add.image(x, y, `gem-${tier}`).setDepth(3);
    gem.xp = GEMS[tier].xp;
    gem.magnet = false;
    this.gems.add(gem);
  }

  // 进入拾取范围的晶体会加速飞向玩家
  updateGems(dt) {
    const p = this.player;
    for (const gem of this.gems.getChildren().slice()) {
      const d = Phaser.Math.Distance.Between(gem.x, gem.y, p.x, p.y);
      if (!gem.magnet) {
        if (d > this.stats.pickup) continue;
        gem.magnet = true;
        gem.speed = 120;
      }
      gem.speed += dt * 1.2;
      const step = gem.speed * dt / 1000;
      if (d <= step + 10) {
        gem.destroy();
        if (gem.chest) this.openChest();
        else this.gainXp(gem.xp);
        continue;
      }
      gem.x += (p.x - gem.x) / d * step;
      gem.y += (p.y - gem.y) / d * step;
    }
  }

  gainXp(xp) {
    this.xp += xp;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = xpForLevel(this.level);
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0 && !this.paused) this.openLevelUp();
  }

  // 一次升了好几级时，面板会连续弹几次
  openLevelUp() {
    this.pendingLevels--;
    this.levelUpOpen = true;
    this.setPaused(true);
    this.levelUpUi = showLevelUp(this, this.level - this.pendingLevels, this.buildChoices(), (picked) => {
      this.levelUpUi = null;
      for (const choice of picked) this.applyChoice(choice);
      if (this.pendingLevels > 0) {
        this.openLevelUp();
      } else {
        this.levelUpOpen = false;
        this.setPaused(false);
      }
    });
  }


  /** 取武器当前战斗数值：≤10 用 levels 表；超过 10 只叠伤害/体积倍率。 */
  weaponRuntime(id) {
    const lv = this.weaponLv[id];
    if (!lv) return null;
    const tableLv = Math.min(lv, WEAPON_MAX_LEVEL);
    const s = { ...WEAPONS[id].levels[tableLv - 1] };
    const over = Math.max(0, lv - WEAPON_MAX_LEVEL);
    if (over > 0) {
      const dmul = 1 + over * WEAPON_OVER.dmgMul;
      const smul = 1 + over * WEAPON_OVER.sizeMul;
      if (s.dmg != null) s.dmg = Math.round(s.dmg * dmul);
      for (const k of ['radius', 'range', 'maxRange']) {
        if (s[k] != null) s[k] = Math.round(s[k] * smul);
      }
      if (s.knockback != null) s.knockback = Math.round(s.knockback * (1 + over * 0.05));
      s._sizeMul = smul;
    } else {
      s._sizeMul = 1;
    }
    return s;
  }

  buildChoices() {
    const pool = [];
    for (const [id, w] of Object.entries(WEAPONS)) {
      const lv = this.weaponLv[id];
      if (lv <= 0) {
        pool.push({ kind: 'weapon', id, name: w.name, icon: w.icon, lv: 0, desc: w.desc[0] });
      } else if (lv < WEAPON_MAX_LEVEL) {
        const desc = w.desc[Math.min(lv, w.desc.length - 1)] || '数值继续提升';
        pool.push({ kind: 'weapon', id, name: w.name, icon: w.icon, lv, desc });
      } else {
        // 10 级后仍可选：只加数值 + 变大/范围
        const pctD = Math.round(WEAPON_OVER.dmgMul * 100);
        const pctS = Math.round(WEAPON_OVER.sizeMul * 100);
        pool.push({
          kind: 'weapon',
          id,
          name: w.name,
          icon: w.icon,
          lv,
          desc: `变大强化：伤害 +${pctD}%，体积/范围 +${pctS}%`,
        });
      }
    }
    for (const [id, p] of Object.entries(PASSIVES)) {
      const lv = this.passiveLv[id];
      pool.push({ kind: 'passive', id, name: p.name, icon: p.icon, lv, desc: p.desc });
    }
    for (const [id, b] of Object.entries(STAT_BOOSTS)) {
      const lv = this.statLv[id] || 0;
      pool.push({ kind: 'stat', id, name: b.name, icon: b.icon, lv, desc: b.desc });
    }
    // 保证 5 选里至少有 1 张数值卡（有则优先塞进池再洗）
    const stats = pool.filter((c) => c.kind === 'stat');
    const rest = pool.filter((c) => c.kind !== 'stat');
    Phaser.Utils.Array.Shuffle(rest);
    Phaser.Utils.Array.Shuffle(stats);
    const guaranteed = stats.slice(0, 1);
    const fill = Phaser.Utils.Array.Shuffle(rest.concat(stats.slice(1))).slice(0, 5 - guaranteed.length);
    const picks = Phaser.Utils.Array.Shuffle(guaranteed.concat(fill));
    return picks.length ? picks : [{ kind: 'food', name: '鸡腿', icon: '🍗', desc: '回复 30 生命' }];
  }

  applyChoice(c) {
    if (c.kind === 'weapon') {
      this.weaponLv[c.id]++;
    } else if (c.kind === 'passive') {
      this.passiveLv[c.id]++;
      PASSIVES[c.id].apply(this.stats, this);
    } else if (c.kind === 'stat') {
      this.statLv[c.id] = (this.statLv[c.id] || 0) + 1;
      STAT_BOOSTS[c.id].apply(this.stats, this);
    } else {
      this.heal(30);
    }
    this.refreshOwnedBar();
  }

  // Esc：游戏中切换暂停；升级面板打开或已结束时不处理
  onEsc() {
    if (this.over || this.levelUpOpen) return;
    if (this.pauseLayer) {
      this.pauseLayer.forEach((o) => o.destroy());
      this.pauseLayer = null;
      this.setPaused(false);
    } else {
      if (this.paused) return;
      const { width, height } = this.scale;
      const fixed = (obj) => obj.setScrollFactor(0).setDepth(1500);
      const mask = fixed(this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0));
      this.pauseLayer = [
        mask,
        fixed(this.add.text(width / 2, this.playH / 2 - 30, '暂停', { fontFamily: FONT, fontSize: '56px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)),
        fixed(this.add.text(width / 2, this.playH / 2 + 40, this.isTouch ? '点屏幕继续' : 'Esc 继续', { fontFamily: FONT, fontSize: '24px', color: '#ffd54f' }).setOrigin(0.5)),
      ];
      if (this.isTouch) {
        // 点遮罩继续；忽略打开后 200ms 内的点击，避免同一下触摸立刻关掉
        const openedAt = this.time.now;
        mask.setInteractive().on('pointerdown', () => {
          if (this.time.now - openedAt < 200) return;
          if (this.pauseLayer) this.onEsc();
        });
      }
      this.setPaused(true);
    }
  }

  setPaused(paused) {
    this.paused = paused;
    if (this.joystick) this.joystick.setEnabled(!paused); // 暂停/升级时禁用摇杆并归零
    if (paused) {
      this.physics.pause();
      this.tweens.pauseAll();
    } else {
      this.physics.resume();
      this.tweens.resumeAll();
    }
  }

  // ---------- 界面 ----------

  createHud() {
    const { width } = this.scale;
    const fixed = (obj) => obj.setScrollFactor(0).setDepth(100);
    const { height } = this.scale;
    this.xpBg = fixed(this.add.rectangle(0, 0, width, 24, 0x1c1c1c).setOrigin(0));
    this.xpFill = fixed(this.add.rectangle(0, 0, width, 24, 0x2196f3).setOrigin(0));
    this.xpFill.scaleX = 0;
    this.xpShade = fixed(this.add.rectangle(0, 21, width, 3, 0x000000, 0.35).setOrigin(0)); // 底边阴影，让蓝条更立体
    this.levelText = fixed(this.add.text(14, 30, '', HUD_FONT));
    this.timeText = fixed(this.add.text(width / 2, 30, '', { ...HUD_FONT, fontSize: '26px' }).setOrigin(0.5, 0));
    this.killText = fixed(this.add.text(width - 14, 30, '', HUD_FONT).setOrigin(1, 0));
    // 右上角小字：星级最高的两个物种（w1.2 §6.7 可选）
    this.tierText = fixed(this.add.text(width - 14, 58, '', { ...HUD_FONT, fontSize: '16px', color: '#e65100' }).setOrigin(1, 0));
    // Boss 血条（顶部居中，计时下方）
    this.bossBar = fixed(this.add.graphics());
    this.bossName = fixed(this.add.text(width / 2, 64, '', { ...HUD_FONT, fontSize: '18px' }).setOrigin(0.5, 0));

    // 已拥有武器/被动图标条（顶栏下方左侧）
    this.ownedBar = fixed(this.add.container(14, this.thumbH ? 110 : 62)); // 竖屏窄宽：挪到 Boss 条下方
    this.refreshOwnedBar();

    // 受伤全屏淡红
    this.hurtFlash = this.add.rectangle(0, 0, width, height, 0xff1744, 1).setOrigin(0).setScrollFactor(0).setDepth(900).setAlpha(0);

    // 低血屏幕边缘泛红（持续状态，与 hurtFlash 短闪分开）
    this.lowHpVignette = this.add.graphics().setScrollFactor(0).setDepth(899).setAlpha(0);
    this.drawVignette(width, height);
  }

  drawVignette(width, height) {
    this.lowHpVignette.clear();
    const bands = 14;
    const band = Math.round(Math.min(width, height) * 0.012);
    for (let i = 0; i < bands; i++) {
      const a = 1 - i / bands; // 外沿最浓，向内渐淡
      const inset = i * band;
      this.lowHpVignette.lineStyle(band, 0xd50000, a * a)
        .strokeRect(inset + band / 2, inset + band / 2, width - 2 * inset - band, height - 2 * inset - band);
    }
  }

  // 视口变化（手机地址栏收起、旋转）后按新逻辑宽高重排固定在屏幕上的 HUD / 摇杆 / 暂停钮
  onScaleResize(gameSize) {
    const width = gameSize.width;
    const height = gameSize.height;
    this.applyViewMetrics(width, height);
    if (this.ownedBar) this.ownedBar.setY(this.thumbH ? 110 : 62);
    if (this.xpBg) this.xpBg.setSize(width, 24);
    if (this.xpFill) this.xpFill.setSize(width, 24);
    if (this.xpShade) this.xpShade.setSize(width, 3);
    if (this.timeText) this.timeText.setX(width / 2);
    if (this.killText) this.killText.setX(width - 14);
    if (this.tierText) this.tierText.setX(width - 14);
    if (this.bossName) this.bossName.setX(width / 2);
    if (this.hurtFlash) this.hurtFlash.setSize(width, height);
    if (this.lowHpVignette) this.drawVignette(width, height);
    if (this.joystick) this.joystick.relayout(width, height);
    this.placePauseBtn();
    if (this.pauseLayer && this.pauseLayer[0]) {
      this.pauseLayer[0].setSize(width, height);
      if (this.pauseLayer[0].input) this.pauseLayer[0].input.hitArea.setTo(0, 0, width, height);
      if (this.pauseLayer[1]) this.pauseLayer[1].setPosition(width / 2, this.playH / 2 - 30);
      if (this.pauseLayer[2]) this.pauseLayer[2].setPosition(width / 2, this.playH / 2 + 40);
    }
    if (this.levelUpUi) this.levelUpUi.relayout();
    if (this.overLayer) this.drawGameOver();
  }

  // 按当前画布方向算手指区 / 游戏区 / 镜头偏移 / 刷怪半径（开局与旋转时调用）
  applyViewMetrics(width, height) {
    this.thumbH = thumbZoneHeight(this);
    this.playH = height - this.thumbH;
    const halfDiag = Math.hypot(width / 2, this.playH / 2 + this.thumbH);
    this.spawnRadius = Math.max(SPAWN_RADIUS, Math.ceil(halfDiag + 60));
    this.despawnRadius = Math.max(DESPAWN_RADIUS, this.spawnRadius + 360);
    // 镜头下移 thumbH/2 后，背景格需多盖一个手指区高度，否则竖屏底部露底色
    if (this.bg) this.bg.setSize(width + 128, height + 128 + this.thumbH * 2);
    this.cameras.main.setFollowOffset(0, this.thumbH ? -this.thumbH / 2 : 0);
  }

  placePauseBtn() {
    if (!this.pauseBtn) return;
    const { width } = this.scale;
    if (this.thumbH) this.pauseBtn.setPosition(width - 52, 132);
    else this.pauseBtn.setPosition(width - 46, 118);
  }

  refreshOwnedBar() {
    if (!this.ownedBar) return;
    this.ownedBar.removeAll(true);
    const items = [
      ...Object.entries(WEAPONS).filter(([id]) => this.weaponLv[id] > 0).map(([id, w]) => ({ icon: w.icon, lv: this.weaponLv[id], weapon: true })),
      ...Object.entries(PASSIVES).filter(([id]) => this.passiveLv[id] > 0).map(([id, p]) => ({ icon: p.icon, lv: this.passiveLv[id], weapon: false })),
    ];
    let x = 0;
    let lastWeapon = true;
    for (const it of items) {
      if (lastWeapon && !it.weapon && x > 0) x += 10; // 武器和被动之间留个缝
      lastWeapon = it.weapon;
      const bg = this.add.rectangle(x, 0, 40, 40, it.weapon ? 0xfff8e1 : 0xe8f5e9, 0.85).setOrigin(0).setStrokeStyle(2, 0x333333);
      const icon = this.add.text(x + 20, 18, it.icon, { fontFamily: EMOJI_FONT, fontSize: '22px' }).setOrigin(0.5);
      const lv = this.add.text(x + 38, 39, String(it.lv), {
        fontFamily: FONT, fontSize: '13px', color: '#222222', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 3,
      }).setOrigin(1, 1);
      this.ownedBar.add([bg, icon, lv]);
      x += 44;
    }
  }

  updateHud() {
    const p = this.player;
    const s = this.stats;
    this.xpFill.scaleX = this.xp / this.xpNeed;
    this.levelText.setText(`Lv ${this.level}`);
    this.timeText.setText(formatTime(this.elapsed));
    this.killText.setText(`击杀 ${this.kills}`);
    const top = this.speciesTiers().sort((a, b) => b.tier - a.tier).slice(0, 2);
    this.tierText.setText(top.map(({ type, tier }) => `${ENEMIES[type].emoji}★${tier}`).join(' '));
    this.updateBossBar();
    this.hpBar.clear()
      .fillStyle(0x000000, 0.55).fillRect(p.x - 27, p.y + 27, 54, 10)
      .fillStyle(0x333333).fillRect(p.x - 26, p.y + 28, 52, 8)
      .fillStyle(0xe53935).fillRect(p.x - 26, p.y + 28, 52 * Math.max(0, s.hp) / s.maxHp, 8);
    this.updateLowHpVignette();
    this.pickupRing.clear()
      .fillStyle(0x42a5f5, 0.05).fillCircle(p.x, p.y, s.pickup)
      .lineStyle(2, 0x42a5f5, 0.22).strokeCircle(p.x, p.y, s.pickup);
  }

  updateBossBar() {
    const b = this.boss;
    this.bossBar.clear();
    if (!b || !b.active) {
      this.bossName.setText('');
      return;
    }
    const { width } = this.scale;
    const w = Math.min(420, width * 0.5);
    const x = (width - w) / 2;
    this.bossName.setText(`${b.def.emoji} ${b.def.name}${b.lap ? ` · 第 ${b.lap + 1} 轮` : ''}`);
    this.bossBar
      .fillStyle(0x000000, 0.6).fillRect(x - 2, 88, w + 4, 14)
      .fillStyle(0x333333).fillRect(x, 90, w, 10)
      .fillStyle(b.phase2 ? 0xd50000 : 0xff8f00).fillRect(x, 90, w * Math.max(0, b.hp) / b.maxHp, 10);
  }

  updateLowHpVignette() {
    if (!this.lowHpVignette) return;
    const s = this.stats;
    const ratio = s.hp / s.maxHp;
    let target = 0;
    if (!this.over && s.hp > 0 && ratio < 0.3) {
      // 30% → 0.12，0% → 0.28，再加一点心跳脉动
      const k = 1 - ratio / 0.3;
      const pulse = 0.03 * Math.sin(this.elapsed / 180);
      target = 0.12 + 0.16 * k + pulse * k;
    }
    // 平滑过渡，回血后渐隐
    const cur = this.lowHpVignette.alpha;
    this.lowHpVignette.setAlpha(target === 0 && cur < 0.01 ? 0 : cur + (target - cur) * 0.15);
  }

  showDamage(x, y, dmg) {
    if (this.damageTexts >= 40) return;
    this.damageTexts++;
    const t = this.add.text(x, y, String(Math.round(dmg)), {
      fontFamily: FONT, fontSize: '15px', color: '#d32f2f', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({
      targets: t, y: y - 26, alpha: 0, duration: 550,
      onComplete: () => {
        t.destroy();
        this.damageTexts--;
      },
    });
  }

  // opts：{ y（占屏高比例）, size, color }
  flashMessage(msg, opts = {}) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height * (opts.y ?? 0.28), msg, {
      fontFamily: FONT, fontSize: `${opts.size ?? 34}px`, color: opts.color ?? '#c62828', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 600, onComplete: () => t.destroy() });
  }

  // 死亡结算面板（可重绘：旋转时按新画布重排）
  drawGameOver() {
    if (this.overLayer) this.overLayer.forEach((o) => o.destroy());
    this.overLayer = [];
    const { best, newBest, tierLine } = this.overInfo;
    const { width, height } = this.scale;
    const fixed = (obj) => {
      this.overLayer.push(obj);
      return obj.setScrollFactor(0).setDepth(1000);
    };
    const cy = this.playH / 2; // 竖屏时居于游戏区中央，不压进手指区
    const line = (y, text, size, color = '#ffffff', bold = false) => fixed(this.add.text(width / 2, cy + y, text, {
      fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal',
      align: 'center', wordWrap: { width: width - 40, useAdvancedWrap: true },
    }).setOrigin(0.5));
    fixed(this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0));
    line(-140, '你倒下了', 56, '#ffffff', true);
    line(-70, `存活 ${formatTime(this.elapsed)}`, 40, '#ffffff', true);
    line(-28, `最佳存活 ${formatTime(best)}${newBest ? '（新纪录！）' : ''}`, 20, newBest ? '#ffd54f' : '#cccccc');
    line(14, `等级 ${this.level}    击杀 ${this.kills}    Boss 击杀 ${this.bossKills}`, 24);
    line(54, `物种最高星：${tierLine}`, 22, '#ffcc80');
    line(this.thumbH ? 140 : 110, this.isTouch ? '点屏幕重新开始' : '点击或按空格重新开始', 22, '#ffd54f');
  }

  gameOver() {
    this.over = true;
    this.stats.hp = 0;
    if (this.lowHpVignette) this.lowHpVignette.setAlpha(0);
    this.updateHud();
    this.physics.pause();

    // 死亡结算（无尽模式，w1.2 §6.8）：存活时长为主指标；无胜利面板
    let best = 0;
    let newBest = false;
    try {
      best = Number(localStorage.getItem(BEST_KEY)) || 0;
      if (this.elapsed > best) {
        newBest = best > 0;
        best = this.elapsed;
        localStorage.setItem(BEST_KEY, String(Math.floor(best)));
      }
    } catch { /* 无 localStorage 时忽略 */ }
    const tiers = this.speciesTiers();
    const tierLine = tiers.length ? tiers.map(({ type, tier }) => `${ENEMIES[type].emoji}★${tier}`).join('  ') : '暂无（还没有物种升星）';

    this.overInfo = { best, newBest, tierLine };
    this.overLayer = [];
    this.drawGameOver();
    if (this.joystick) this.joystick.setVisible(false);
    if (this.pauseBtn) this.pauseBtn.setVisible(false);
    const kb = this.input.keyboard;
    const restart = () => {
      this.input.off('pointerdown', restart);
      if (kb) {
        kb.off('keydown-SPACE', restart);
        kb.off('keydown-ENTER', restart);
      }
      this.scene.restart();
    };
    this.input.once('pointerdown', restart);
    if (kb) {
      kb.once('keydown-SPACE', restart);
      kb.once('keydown-ENTER', restart);
    }
  }
}
