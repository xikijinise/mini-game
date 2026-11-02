// 十二生肖抄招（可欣 / 灵语对照，数值：衡岚 balance-w1.3-zodiac.md）
// 普通怪 def.zskill（狼王也挂一个 bossBite）；伤害统一 skillDamage → queueHit → 每帧结算一次取高。
import Phaser from 'phaser';
import { FONT } from '../textures.js';

const DEBUFF_ICON = { poison: '☠毒', vuln: '💢易伤', drowsy: '💤困倦', fear: '😨威慑', atkSlow: '🐌攻速↓', slow: '🐢减速' };

function mergeTiers(base, tier) {
  if (!base) return null;
  const out = { ...base };
  if (base.tiers) for (const [k, v] of Object.entries(base.tiers)) if (tier >= +k) Object.assign(out, v);
  delete out.tiers;
  return out;
}

const methods = {
  zInitScene() {
    this.debuffs = {};
    this.pendingHit = null;
    this.zProj = [];
    this.debuffText = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 1).setDepth(40);
  },

  zInitEnemy(e) {
    e.zs = mergeTiers(e.def.zskill, e.tier || 0);
    e.zState = 'idle';
    e.zNext = this.elapsed + (e.zs ? (e.zs.firstDelay ?? 0) + Math.random() * 400 : 0);
    e.untargetableUntil = 0;
    e.stolen = [];
  },

  // max(1, min(round(e.damage×mul), round(maxHp×cap)) − defense)：这里只做封顶，defense / vuln 在 hurtPlayer
  skillDamage(e, mul) {
    const cap = e.def.boss ? 0.45 : 0.4;
    return Math.max(1, Math.min(Math.round(e.damage * mul), Math.round(this.stats.maxHp * cap)));
  },

  // 同帧技能 / 接触只结算一次，取高的那个
  queueHit(dmg, opts = {}) {
    if (this.over || this.elapsed < this.invulnUntil) return false;
    if (!this.pendingHit || dmg > this.pendingHit.dmg) this.pendingHit = { dmg, ...opts };
    return true;
  },

  resolveHits() {
    const h = this.pendingHit;
    this.pendingHit = null;
    if (!h || this.over) return;
    this.hurtPlayer(h.dmg, h.x, h.y, h.knockback);
    if (h.debuff) for (const [k, v] of Object.entries(h.debuff)) this.addDebuff(k, v);
    if (h.onHit) h.onHit();
  },

  addDebuff(name, v) { // 同种只刷新时长、不叠层
    this.debuffs[name] = { ...v, until: this.elapsed + v.ms, nextTick: this.debuffs[name]?.nextTick ?? this.elapsed + (v.every || 500) };
  },

  hasDebuff(name) {
    const d = this.debuffs && this.debuffs[name];
    return d && this.elapsed < d.until ? d : null;
  },

  debuffSpeedMul() { // 取最低，不连乘
    let m = 1;
    for (const k of ['drowsy', 'fear', 'slow']) { const d = this.hasDebuff(k); if (d) m = Math.min(m, d.mul); }
    return m;
  },

  cdMul() { // 攻速 ×0.85 ⇒ 冷却 ÷0.85；取最低
    let a = 1;
    const s = this.hasDebuff('atkSlow'); if (s) a = Math.min(a, s.mul);
    const f = this.hasDebuff('fear'); if (f) a = Math.min(a, f.atk);
    return this.stats.cooldown / a;
  },

  vulnMul() { const v = this.hasDebuff('vuln'); return v ? v.mul : 1; },

  updateDebuffs() {
    const t = this.elapsed;
    const po = this.hasDebuff('poison');
    if (po && t >= po.nextTick) { // 毒：不吃 defense、不吃 i-frame，最低 1
      po.nextTick = t + (po.every || 500);
      const d = Math.max(1, po.tick || 1);
      this.stats.hp -= d;
      this.showDamage(this.player.x, this.player.y - 40, d);
      if (this.stats.hp <= 0 && !this.over) this.gameOver();
    }
    const parts = [];
    for (const [k, d] of Object.entries(this.debuffs)) {
      if (t < d.until) parts.push(`${DEBUFF_ICON[k] || k} ${((d.until - t) / 1000).toFixed(1)}`);
    }
    this.debuffText.setText(parts.join('  '));
    this.debuffText.setPosition(this.player.x, this.player.y - this.player.displayHeight / 2 - 6);
    this.updateZProj();
  },

  // ---------- 预警绘制 ----------
  warnFan(x, y, ang, r, arcDeg, color, ms) {
    const g = this.add.graphics().setDepth(2);
    const half = Phaser.Math.DegToRad(arcDeg / 2);
    g.fillStyle(color, 0.25).slice(x, y, r, ang - half, ang + half, false).fillPath();
    g.lineStyle(2, color, 0.6).slice(x, y, r, ang - half, ang + half, false).strokePath();
    this.time.delayedCall(ms, () => g.destroy());
    return g;
  },
  warnCircle(x, y, r, color, ms, fill = 0.2) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(color, fill).fillCircle(x, y, r);
    g.lineStyle(3, color, 0.65).strokeCircle(x, y, r);
    this.time.delayedCall(ms, () => g.destroy());
    return g;
  },
  warnBar(x, y, ang, len, w, color, ms) {
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(color, 0.22).fillRect(0, -w / 2, len, w);
    g.lineStyle(2, color, 0.55).strokeRect(0, -w / 2, len, w);
    g.setPosition(x, y).setRotation(ang);
    if (ms) this.time.delayedCall(ms, () => g.destroy());
    return g;
  },
  flashFx(x, y, r, color) { // 命中判定瞬间的爆闪
    const g = this.add.circle(x, y, r, color, 0.45).setDepth(2);
    this.tweens.add({ targets: g, alpha: 0, scale: 1.25, duration: 220, onComplete: () => g.destroy() });
  },

  inFan(x, y, ang, r, arcDeg) {
    const p = this.player;
    if (Phaser.Math.Distance.Between(x, y, p.x, p.y) > r + 10) return false;
    const a = Phaser.Math.Angle.Between(x, y, p.x, p.y);
    return Math.abs(Phaser.Math.Angle.Wrap(a - ang)) <= Phaser.Math.DegToRad(arcDeg / 2);
  },
  inCircle(x, y, r) { return Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= r + 12; },
  segDist(x, y, ang, len) {
    const p = this.player;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const k = Phaser.Math.Clamp((p.x - x) * dx + (p.y - y) * dy, 0, len);
    return Phaser.Math.Distance.Between(x + dx * k, y + dy * k, p.x, p.y);
  },

  // ---------- 每只怪每帧（在 runBehavior 之后，可覆盖速度） ----------
  zTick(e, p) {
    const z = e.zs;
    if (e.untargetableUntil && this.elapsed >= e.untargetableUntil) { e.untargetableUntil = 0; e.setAlpha(1); }
    if (!z) return;
    const t = this.elapsed;
    const { x, y } = e.body.center;
    const dist = Phaser.Math.Distance.Between(x, y, p.x, p.y);
    if (z.type === 'melee') return this.zMelee(e, z, t, x, y, dist, p);
    if (z.type === 'foxTease') return this.zFox(e, z, t, x, y, dist, p);
    if (z.type === 'tongue') return this.zTongue(e, z, t, x, y, dist, p);
    if (z.type === 'selfAoe') return this.zBear(e, z, t, x, y, dist);
    if (z.type === 'bossBite') return this.zBite(e, z, t, x, y, dist, p);
  },

  // 鼠·偷咬：近身扇形咬，命中偷附近经验晶，然后逃窜
  zMelee(e, z, t, x, y, dist, p) {
    if (e.zState === 'flee') {
      if (t >= e.zUntil) { e.zState = 'idle'; return; }
      const a = Phaser.Math.Angle.Between(p.x, p.y, x, y);
      e.setVelocity(Math.cos(a) * e.speed * z.fleeMul, Math.sin(a) * e.speed * z.fleeMul);
      return;
    }
    if (e.zState === 'idle') {
      if (t < e.zNext || dist > z.range) return;
      e.zState = 'windup'; e.zUntil = t + z.windup; e.zAng = Phaser.Math.Angle.Between(x, y, p.x, p.y);
      this.warnFan(x, y, e.zAng, z.radius, z.arc, 0xffeb3b, z.windup);
    }
    if (e.zState === 'windup') {
      e.setVelocity(0, 0);
      if (t < e.zUntil) return;
      e.zNext = t + z.cd;
      this.flashFx(x + Math.cos(e.zAng) * 20, y + Math.sin(e.zAng) * 20, 14, 0xffeb3b);
      e.zState = 'flee'; e.zUntil = t + z.fleeMs;
      if (this.inFan(x, y, e.zAng, z.radius, z.arc)) {
        this.queueHit(this.skillDamage(e, z.dmgMul), { onHit: () => this.stealGems(e, z.steal) });
      }
    }
  },

  stealGems(e, n) {
    if (!e.active) return;
    const p = this.player;
    const near = this.gems.getChildren().filter((g) => !g.chest && g.tier && Phaser.Math.Distance.Between(g.x, g.y, p.x, p.y) <= 60)
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, p.x, p.y) - Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y));
    for (const g of near.slice(0, n)) { e.stolen.push(g.tier); g.destroy(); }
    if (near.length) this.showDamage(e.x, e.y - e.displayHeight - 10, `偷 ${Math.min(n, near.length)} 晶`);
  },

  // 狐·戏弄爪 / 掷石
  zFox(e, z, t, x, y, dist, p) {
    if (e.zState === 'idle') {
      if (t < e.zNext || e.state === 'move') return;
      e.zAng = Phaser.Math.Angle.Between(x, y, p.x, p.y);
      if (dist <= z.clawRange) {
        e.zState = 'claw'; e.zUntil = t + z.windup;
        this.warnFan(x, y, e.zAng, z.radius, z.arc, 0xff9800, z.windup);
      } else if (dist <= z.throwRange) {
        e.zState = 'throw'; e.zUntil = t + z.throwWindup;
        this.warnBar(x, y, e.zAng, z.throwRange, z.stoneR * 2 + 6, 0xff9800, z.throwWindup);
      } else return;
    }
    e.setVelocity(0, 0);
    e.rotation = Math.sin(t / 30) * 0.15;
    if (t < e.zUntil) return;
    e.rotation = 0;
    e.zNext = t + z.cd;
    if (e.zState === 'claw') {
      this.flashFx(x + Math.cos(e.zAng) * 30, y + Math.sin(e.zAng) * 30, 22, 0xff9800);
      if (this.inFan(x, y, e.zAng, z.radius, z.arc)) {
        this.queueHit(this.skillDamage(e, z.dmgMul), { debuff: { atkSlow: { mul: z.atkSlow, ms: z.atkSlowMs } } });
      }
      e.x -= Math.cos(e.zAng) * z.backjump; e.y -= Math.sin(e.zAng) * z.backjump; // 爪后后跳
    } else {
      for (let i = 0; i < z.stones; i++) {
        const a = e.zAng + (z.stones > 1 ? (i - (z.stones - 1) / 2) * Phaser.Math.DegToRad(24) : 0);
        const s = this.add.circle(x, y, z.stoneR, 0x8d6e63).setStrokeStyle(2, 0x3e2723).setDepth(5);
        this.zProj.push({ s, vx: Math.cos(a) * z.stoneSpeed, vy: Math.sin(a) * z.stoneSpeed, left: z.throwRange, r: z.stoneR,
          dmg: this.skillDamage(e, z.throwDmgMul), debuff: { atkSlow: { mul: z.atkSlow, ms: z.atkSlowMs } } });
      }
    }
    e.zState = 'idle';
  },

  updateZProj() {
    const dt = this.game.loop.delta > 50 ? 0.05 : this.game.loop.delta / 1000;
    const p = this.player;
    this.zProj = this.zProj.filter((o) => {
      o.s.x += o.vx * dt; o.s.y += o.vy * dt; o.left -= Math.hypot(o.vx, o.vy) * dt;
      if (Phaser.Math.Distance.Between(o.s.x, o.s.y, p.x, p.y) <= o.r + 14) {
        this.queueHit(o.dmg, { debuff: o.debuff }); o.s.destroy(); return false;
      }
      if (o.left <= 0) { o.s.destroy(); return false; }
      return true;
    });
  },

  // 蛙·毒舌：舌线预警后吐毒直线，命中毒 DoT + 拉近
  zTongue(e, z, t, x, y, dist, p) {
    if (e.zState === 'idle') {
      if (t < e.zNext || dist > z.range || e.state !== 'chase') return;
      e.zState = 'windup'; e.zUntil = t + z.windup; e.zAng = Phaser.Math.Angle.Between(x, y, p.x, p.y);
      e.state = 'zbusy';
      this.warnBar(x, y, e.zAng, z.length, z.width, 0x76ff03, z.windup);
    }
    e.setVelocity(0, 0);
    if (t < e.zUntil) return;
    e.zNext = t + z.cd; e.zState = 'idle'; e.state = 'chase';
    const g = this.warnBar(x, y, e.zAng, z.length, z.width * 0.6, 0x64dd17, 0);
    this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    if (this.segDist(x, y, e.zAng, z.length) <= z.width / 2 + 12) {
      this.queueHit(this.skillDamage(e, z.dmgMul), {
        debuff: { poison: { ms: z.poisonMs, tick: z.poisonTick, every: z.poisonEvery } },
        onHit: () => { const a = e.zAng + Math.PI; this.player.x += Math.cos(a) * z.pull; this.player.y += Math.sin(a) * z.pull; },
      });
    }
  },

  // 熊·蛮横拍地：红圈预警 → 震波减速；狂暴后 CD×0.7、R 加大
  zBear(e, z, t, x, y, dist) {
    const enr = e.speedMul > 1;
    const r = enr ? Math.max(z.radius, z.enrageRadius) : z.radius;
    if (e.zState === 'idle') {
      if (t < e.zNext || dist > z.range) return;
      e.zState = 'windup'; e.zUntil = t + z.windup;
      e.zWarn = this.warnCircle(x, y, r, 0xff1744, z.windup);
    }
    e.setVelocity(0, 0);
    e.rotation = Math.sin(t / 30) * 0.2;
    if (t < e.zUntil) return;
    e.rotation = 0;
    e.zState = 'idle'; e.zNext = t + z.cd * (enr ? z.enrageCdMul : 1);
    this.cameras.main.shake(140, 0.008);
    this.flashFx(x, y, r, 0xff5722);
    if (this.inCircle(x, y, r)) this.queueHit(this.skillDamage(e, z.dmgMul), { x, y, knockback: 20, debuff: z.debuff });
  },

  // 狼王·冲咬：红条预警 → 直线冲，路径带伤 + 易伤
  zBite(e, z, t, x, y, dist, p) {
    if (e.zState === 'idle') {
      if (t < e.zNext || dist > z.range || e.state !== 'chase' || t < (e.gcdUntil || 0)) return;
      e.zState = 'windup'; e.zUntil = t + z.windup;
      e.zAng = Phaser.Math.Angle.Between(x, y, p.x, p.y);
      e.state = 'zbusy';
      e.zWarn = this.warnBar(x, y, e.zAng, z.distance, z.warnWidth, 0xff1744, z.windup);
    }
    if (e.zState === 'windup') {
      e.setVelocity(0, 0);
      e.rotation = Math.sin(t / 30) * 0.2;
      if (t < e.zUntil) return;
      e.rotation = 0;
      e.zState = 'dash'; e.zHit = false;
      e.zUntil = t + (z.distance / (e.speed * z.speedMul)) * 1000;
    }
    if (e.zState === 'dash') {
      const v = e.speed * z.speedMul;
      e.setVelocity(Math.cos(e.zAng) * v, Math.sin(e.zAng) * v);
      if (!e.zHit && Phaser.Math.Distance.Between(x, y, p.x, p.y) <= e.body.width * 0.6 + 14) {
        e.zHit = this.queueHit(this.skillDamage(e, z.dmgMul), { x, y, knockback: z.knockback, debuff: z.debuff });
      }
      if (t < e.zUntil) return;
      e.zState = 'recover'; e.zUntil = t + z.recover;
    }
    if (e.zState === 'recover') {
      e.setVelocity(0, 0);
      if (t < e.zUntil) return;
      e.zState = 'idle'; e.state = 'chase'; e.zNext = t + z.cd;
      e.gcdUntil = t + z.gcd;
      e.nextActAt = Math.max(e.nextActAt, t + z.gcd);
    }
  },
};

export function installZodiac(Scene) { Object.assign(Scene.prototype, methods); }
