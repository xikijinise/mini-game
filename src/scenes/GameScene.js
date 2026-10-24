import Phaser from 'phaser';
import { makeTextures, FONT } from '../textures.js';
import { ENEMIES, GEMS, BOSS_TYPE, BOSS_EVERY } from '../data/enemies.js';
import { WEAPONS } from '../data/weapons.js';
import { PASSIVES } from '../data/passives.js';
import { showLevelUp } from '../ui/levelUp.js';

const MAX_ENEMIES = 300;
const SPAWN_RADIUS = 640; // 在屏幕外一圈刷怪
const DESPAWN_RADIUS = 1000; // 离太远的怪挪回玩家附近
const HUD_FONT = { fontFamily: FONT, fontSize: '20px', color: '#222222', fontStyle: 'bold' };

const xpForLevel = (lv) => Math.floor(5 + (lv - 1) * 5 + Math.pow(lv - 1, 1.6));
const formatTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// 割草肉鸽主场景：上下左右移动，武器自动攻击，捡晶体升级，三选一强化。
// elapsed 是游戏内时间（毫秒），升级面板打开时停止累加，所有冷却和计时都基于它。
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    makeTextures(this);
    this.physics.resume();

    this.elapsed = 0;
    this.paused = false;
    this.over = false;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = xpForLevel(1);
    this.pendingLevels = 0;
    this.spawnCooldown = 0;
    this.nextBossAt = BOSS_EVERY;
    this.invulnUntil = 0;
    this.hurtUntil = 0;
    this.damageTexts = 0;
    this.facing = new Phaser.Math.Vector2(1, 0);

    this.stats = { speed: 170, maxHp: 100, hp: 100, regen: 0, pickup: 80, damage: 1, cooldown: 1 };
    this.weaponLv = Object.fromEntries(Object.keys(WEAPONS).map((id) => [id, 0]));
    this.weaponLv.knife = 1;
    this.passiveLv = Object.fromEntries(Object.keys(PASSIVES).map((id) => [id, 0]));
    this.cooldowns = { knife: 0, lightning: 0, aura: 0 };
    this.orbAngle = 0;
    this.orbs = [];

    const { width, height } = this.scale;
    this.bg = this.add.tileSprite(0, 0, width + 128, height + 128, 'grid').setDepth(-10);
    this.aura = this.add.image(0, 0, 'aura').setDepth(1).setVisible(false);
    this.player = this.physics.add.sprite(0, 0, 'stick0').setDepth(10);
    this.player.body.setSize(16, 40);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.hpBar = this.add.graphics().setDepth(11);

    this.enemies = this.physics.add.group();
    this.knives = this.physics.add.group();
    this.gems = this.add.group();

    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.knives, this.enemies, this.onKnifeHit, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHit, null, this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    this.createHud();
    const hint = this.add.text(width / 2, height - 60, 'WASD / 方向键移动 · 自动攻击 · 捡晶体升级', { ...HUD_FONT, fontSize: '22px' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 800, onComplete: () => hint.destroy() });
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
    this.updateKnives();
    this.updateGems(dt);
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
    const x = (c.right.isDown || k.D.isDown ? 1 : 0) - (c.left.isDown || k.A.isDown ? 1 : 0);
    const y = (c.down.isDown || k.S.isDown ? 1 : 0) - (c.up.isDown || k.W.isDown ? 1 : 0);
    const dir = new Phaser.Math.Vector2(x, y).normalize();
    this.player.setVelocity(dir.x * this.stats.speed, dir.y * this.stats.speed);

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
    this.stats.hp -= enemy.def.damage;
    this.invulnUntil = this.elapsed + 500;
    this.hurtUntil = this.elapsed + 150;
    this.player.setTintFill(0xff3333);
    this.cameras.main.shake(120, 0.005);
    if (this.stats.hp <= 0) this.gameOver();
  }

  heal(amount) {
    this.stats.hp = Math.min(this.stats.maxHp, this.stats.hp + amount);
  }

  // ---------- 怪物 ----------

  spawnEnemies(dt) {
    if (this.elapsed >= this.nextBossAt) {
      this.nextBossAt += BOSS_EVERY;
      this.spawnEnemy(BOSS_TYPE);
      this.flashMessage(`⚠ ${ENEMIES[BOSS_TYPE].name}来了！`);
    }

    const t = this.elapsed / 1000;
    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0) return;
    this.spawnCooldown = Math.max(150, 900 - t * 4);
    const count = 1 + Math.floor(t / 45);
    for (let i = 0; i < count && this.enemies.countActive() < MAX_ENEMIES; i++) {
      this.spawnEnemy(this.pickEnemyType(t));
    }
  }

  pickEnemyType(t) {
    const pool = Object.entries(ENEMIES).filter(([, e]) => !e.boss && t >= e.from);
    let r = Math.random() * pool.reduce((sum, [, e]) => sum + e.weight, 0);
    for (const [type, e] of pool) {
      r -= e.weight;
      if (r <= 0) return type;
    }
    return pool[0][0];
  }

  spawnEnemy(type) {
    const def = ENEMIES[type];
    const a = Math.random() * Math.PI * 2;
    const e = this.enemies.create(this.player.x + Math.cos(a) * SPAWN_RADIUS, this.player.y + Math.sin(a) * SPAWN_RADIUS, type);
    const r = def.size * 0.34;
    e.body.setCircle(r, def.size / 2 - r, def.size / 2 - r);
    e.setDepth(def.boss ? 6 : 5);
    e.def = def;
    e.hp = def.hp * (1 + this.elapsed / (def.boss ? 300000 : 150000)); // 越往后怪越肉
    e.knockUntil = 0;
    e.flashUntil = 0;
    e.orbitHitAt = 0;
    e.seed = Math.random() * 10;
    if (def.boss) e.body.pushable = false;
  }

  moveEnemies() {
    const p = this.player;
    for (const e of this.enemies.getChildren()) {
      if (e.flashUntil && this.elapsed > e.flashUntil) {
        e.clearTint();
        e.flashUntil = 0;
      }
      e.rotation = Math.sin(this.elapsed / 110 + e.seed) * 0.12; // 走路时左右晃
      if (this.elapsed < e.knockUntil) continue;
      if (Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) > DESPAWN_RADIUS) {
        const a = Math.random() * Math.PI * 2;
        e.setPosition(p.x + Math.cos(a) * SPAWN_RADIUS, p.y + Math.sin(a) * SPAWN_RADIUS);
      }
      this.physics.moveToObject(e, p, e.def.speed);
    }
  }

  nearestEnemy(maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const e of this.enemies.getChildren()) {
      const d = Phaser.Math.Distance.Squared(e.x, e.y, this.player.x, this.player.y);
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
    const dmg = amount * this.stats.damage;
    e.hp -= dmg;
    e.setTintFill(0xffffff);
    e.flashUntil = this.elapsed + 70;
    this.showDamage(e.x, e.y - e.def.size / 2, dmg);
    if (fromX !== undefined && !e.def.boss) {
      const a = Phaser.Math.Angle.Between(fromX, fromY, e.x, e.y);
      e.setVelocity(Math.cos(a) * 200, Math.sin(a) * 200);
      e.knockUntil = this.elapsed + 80;
    }
    if (e.hp <= 0) {
      this.kills++;
      this.dropGem(e.x, e.y, e.def.gem);
      e.destroy();
    }
  }

  // ---------- 武器 ----------

  updateKnife(dt) {
    const lv = this.weaponLv.knife;
    if (!lv || (this.cooldowns.knife -= dt) > 0) return;
    const s = WEAPONS.knife.levels[lv - 1];
    this.cooldowns.knife = s.cd * this.stats.cooldown;

    const p = this.player;
    const target = this.nearestEnemy(520);
    const base = target ? Phaser.Math.Angle.Between(p.x, p.y, target.x, target.y) : this.facing.angle();
    for (let i = 0; i < s.count; i++) {
      const a = base + (i - (s.count - 1) / 2) * 0.2;
      const k = this.knives.create(p.x, p.y - 6, 'knife').setRotation(a).setDepth(8);
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
    const s = WEAPONS.orbit.levels[lv - 1];
    while (this.orbs.length < s.count) this.orbs.push(this.add.image(0, 0, 'fireball').setDepth(9));

    const p = this.player;
    this.orbAngle += s.speed * dt / 1000;
    this.orbs.forEach((orb, i) => {
      const a = this.orbAngle + (i / s.count) * Math.PI * 2;
      orb.setPosition(p.x + Math.cos(a) * s.radius, p.y + Math.sin(a) * s.radius);
    });

    for (const e of this.enemies.getChildren().slice()) {
      if (this.elapsed < e.orbitHitAt) continue;
      if (Math.abs(e.x - p.x) > s.radius + 60 || Math.abs(e.y - p.y) > s.radius + 60) continue;
      const reach = 10 + e.def.size * 0.35;
      const orb = this.orbs.find((o) => Phaser.Math.Distance.Between(o.x, o.y, e.x, e.y) < reach);
      if (orb) {
        e.orbitHitAt = this.elapsed + 350;
        this.damageEnemy(e, s.dmg, orb.x, orb.y);
      }
    }
  }

  updateLightning(dt) {
    const lv = this.weaponLv.lightning;
    if (!lv || (this.cooldowns.lightning -= dt) > 0) return;
    const s = WEAPONS.lightning.levels[lv - 1];
    this.cooldowns.lightning = s.cd * this.stats.cooldown;

    const view = this.cameras.main.worldView;
    const onScreen = this.enemies.getChildren().filter((e) => view.contains(e.x, e.y));
    for (const e of Phaser.Utils.Array.Shuffle(onScreen).slice(0, s.count)) {
      this.drawBolt(e.x, e.y, view.y);
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
    const s = WEAPONS.aura.levels[lv - 1];
    const p = this.player;
    this.aura.setVisible(true).setPosition(p.x, p.y).setScale(s.radius / 64);
    if ((this.cooldowns.aura -= dt) > 0) return;
    this.cooldowns.aura = s.tick;
    for (const e of this.enemies.getChildren().slice()) {
      if (Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) < s.radius + e.def.size * 0.3) this.damageEnemy(e, s.dmg);
    }
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
        this.gainXp(gem.xp);
        gem.destroy();
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
    this.setPaused(true);
    showLevelUp(this, this.level - this.pendingLevels, this.buildChoices(), (choice) => {
      this.applyChoice(choice);
      if (this.pendingLevels > 0) this.openLevelUp();
      else this.setPaused(false);
    });
  }

  buildChoices() {
    const pool = [];
    for (const [id, w] of Object.entries(WEAPONS)) {
      const lv = this.weaponLv[id];
      if (lv < w.levels.length) pool.push({ kind: 'weapon', id, name: w.name, icon: w.icon, lv, desc: w.desc[lv] });
    }
    for (const [id, p] of Object.entries(PASSIVES)) {
      const lv = this.passiveLv[id];
      if (lv < p.max) pool.push({ kind: 'passive', id, name: p.name, icon: p.icon, lv, desc: p.desc });
    }
    const picks = Phaser.Utils.Array.Shuffle(pool).slice(0, 3);
    return picks.length ? picks : [{ kind: 'food', name: '鸡腿', icon: '🍗', desc: '回复 30 生命' }];
  }

  applyChoice(c) {
    if (c.kind === 'weapon') {
      this.weaponLv[c.id]++;
    } else if (c.kind === 'passive') {
      this.passiveLv[c.id]++;
      PASSIVES[c.id].apply(this.stats, this);
    } else {
      this.heal(30);
    }
  }

  setPaused(paused) {
    this.paused = paused;
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
    fixed(this.add.rectangle(0, 0, width, 14, 0x333333).setOrigin(0));
    this.xpFill = fixed(this.add.rectangle(0, 0, width, 14, 0x42a5f5).setOrigin(0));
    this.levelText = fixed(this.add.text(14, 22, '', HUD_FONT));
    this.timeText = fixed(this.add.text(width / 2, 22, '', { ...HUD_FONT, fontSize: '26px' }).setOrigin(0.5, 0));
    this.killText = fixed(this.add.text(width - 14, 22, '', HUD_FONT).setOrigin(1, 0));
  }

  updateHud() {
    const p = this.player;
    const s = this.stats;
    this.xpFill.scaleX = this.xp / this.xpNeed;
    this.levelText.setText(`Lv ${this.level}`);
    this.timeText.setText(formatTime(this.elapsed));
    this.killText.setText(`击杀 ${this.kills}`);
    this.hpBar.clear()
      .fillStyle(0x333333).fillRect(p.x - 20, p.y + 28, 40, 5)
      .fillStyle(0xe53935).fillRect(p.x - 20, p.y + 28, 40 * Math.max(0, s.hp) / s.maxHp, 5);
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

  flashMessage(msg) {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height * 0.28, msg, {
      fontFamily: FONT, fontSize: '34px', color: '#c62828', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 600, onComplete: () => t.destroy() });
  }

  gameOver() {
    this.over = true;
    this.stats.hp = 0;
    this.updateHud();
    this.physics.pause();

    const { width, height } = this.scale;
    const fixed = (obj) => obj.setScrollFactor(0).setDepth(1000);
    fixed(this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0));
    fixed(this.add.text(width / 2, height / 2 - 70, '你倒下了', { fontFamily: FONT, fontSize: '56px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
    fixed(this.add.text(width / 2, height / 2 + 10, `存活 ${formatTime(this.elapsed)}    等级 ${this.level}    击杀 ${this.kills}`, {
      fontFamily: FONT, fontSize: '26px', color: '#ffffff',
    }).setOrigin(0.5));
    fixed(this.add.text(width / 2, height / 2 + 70, '点击重新开始', { fontFamily: FONT, fontSize: '22px', color: '#ffd54f' }).setOrigin(0.5));
    this.input.once('pointerdown', () => this.scene.restart());
  }
}
