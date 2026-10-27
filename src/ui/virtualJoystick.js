import Phaser from 'phaser';
import { FONT } from '../textures.js';
import { isTouchDevice, THUMB_ZONE_H } from '../layout.js';

// isTouchDevice 统一放在 layout.js（main.js 也要用），这里转出保持旧引用可用
export { isTouchDevice };

const DEAD = 0.15; // 死区（占半径比例）
// 竖屏：底盘大一点（画布缩放更小）；横屏：沿用横屏包尺寸
const SIZES = { portrait: { base: 80, knob: 36 }, landscape: { base: 70, knob: 32 } };

// 浮动虚拟摇杆，按当前画布方向两套布局，relayout(w,h) 时自动切换：
// - 竖屏（h>w）：下半屏任意处按下生效（无色块），默认位置底部水平居中
// - 横屏：左半屏下部（HUD 下方、宽 45%）按下生效，默认左下
// 底盘跟到手指处；松手回默认位置、方向归零。返回 { vector, destroy, setVisible, setEnabled, release, relayout }
export function createVirtualJoystick(scene, opts = {}) {
  let { width, height } = scene.scale;
  let portrait = height > width;
  let BASE_R = SIZES.landscape.base;
  const zone = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  const home = { x: 0, y: 0 };
  const depth = opts.depth ?? 950;

  const base = scene.add.circle(0, 0, BASE_R, 0x000000, 0.18)
    .setStrokeStyle(3, 0xffffff, 0.55).setScrollFactor(0).setDepth(depth);
  const knob = scene.add.circle(0, 0, SIZES.landscape.knob, 0xffffff, 0.55)
    .setStrokeStyle(3, 0x222222, 0.4).setScrollFactor(0).setDepth(depth + 1);

  const layout = (w, h) => {
    width = w;
    height = h;
    portrait = height > width;
    const s = portrait ? SIZES.portrait : SIZES.landscape;
    BASE_R = s.base;
    base.setRadius(s.base);
    knob.setRadius(s.knob);
    if (portrait) {
      const zoneH = Math.round(height / 2); // 可触范围 = 下半屏
      zone.setTo(0, height - zoneH, width, zoneH);
      home.x = Math.round(width / 2);
      home.y = Math.round(height - Math.min(THUMB_ZONE_H / 2 - 10, zoneH / 2));
    } else {
      const top = Math.round(height * 0.3); // 顶栏 / 图标条下方才算摇杆区
      zone.setTo(0, top, Math.round(width * 0.45), height - top);
      home.x = BASE_R + 60;
      home.y = height - BASE_R - 40;
    }
  };
  layout(width, height);
  base.setPosition(home.x, home.y);
  knob.setPosition(home.x, home.y);

  const vector = new Phaser.Math.Vector2(0, 0);
  let pointerId = null;
  let enabled = true;
  let visible = true;
  const center = { x: home.x, y: home.y };

  const place = (x, y) => {
    center.x = x;
    center.y = y;
    base.setPosition(x, y);
    knob.setPosition(x, y);
  };
  const release = () => {
    pointerId = null;
    vector.set(0, 0);
    place(home.x, home.y);
  };
  const track = (pointer) => {
    const dx = pointer.x - center.x;
    const dy = pointer.y - center.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) {
      knob.setPosition(center.x, center.y);
      vector.set(0, 0);
      return;
    }
    const clamped = Math.min(len, BASE_R);
    const nx = dx / len;
    const ny = dy / len;
    knob.setPosition(center.x + nx * clamped, center.y + ny * clamped);
    if (clamped / BASE_R < DEAD) vector.set(0, 0);
    else vector.set(nx, ny); // 满速移动（与键盘一致）
  };

  const onDown = (pointer, currentlyOver) => {
    if (!enabled || !visible || pointerId !== null) return;
    if (currentlyOver && currentlyOver.length) return; // 点到暂停钮 / 升级卡等不抢
    if (!zone.contains(pointer.x, pointer.y)) return;
    pointerId = pointer.id;
    if (portrait) {
      place(
        Phaser.Math.Clamp(pointer.x, zone.left + BASE_R + 8, zone.right - BASE_R - 8),
        Phaser.Math.Clamp(pointer.y, zone.top + BASE_R + 8, zone.bottom - BASE_R - 8),
      );
    } else {
      place(
        Phaser.Math.Clamp(pointer.x, BASE_R + 8, zone.right - 8),
        Phaser.Math.Clamp(pointer.y, zone.top + BASE_R * 0.5, height - BASE_R - 8),
      );
    }
    track(pointer);
  };
  const onMove = (pointer) => {
    if (pointer.id !== pointerId) return;
    if (!enabled) return release();
    track(pointer);
  };
  const onUp = (pointer) => {
    if (pointer.id === pointerId) release();
  };

  scene.input.on('pointerdown', onDown);
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.input.on('pointerupoutside', onUp);
  const onBlur = () => release(); // 切后台 / 失焦时归零，避免一直走
  scene.game.events.on(Phaser.Core.Events.BLUR, onBlur);
  scene.game.events.on(Phaser.Core.Events.HIDDEN, onBlur);

  const destroy = () => {
    scene.input.off('pointerdown', onDown);
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
    scene.input.off('pointerupoutside', onUp);
    scene.game.events.off(Phaser.Core.Events.BLUR, onBlur);
    scene.game.events.off(Phaser.Core.Events.HIDDEN, onBlur);
    base.destroy();
    knob.destroy();
  };
  scene.events.once('shutdown', destroy);

  return {
    vector,
    release,
    destroy,
    zone,
    // 视口尺寸变化时重算摇杆区与默认位置
    relayout(w, h) {
      layout(w, h);
      release();
    },
    isActive: () => pointerId !== null,
    setVisible(v) {
      visible = v;
      base.setVisible(v);
      knob.setVisible(v);
      if (!v) release();
    },
    setEnabled(v) {
      enabled = v;
      base.setAlpha(v ? 1 : 0.35);
      knob.setAlpha(v ? 1 : 0.35);
      if (!v) release();
    },
  };
}

// 右上角触控暂停按钮（击杀数/星级小字下方）
export function createPauseButton(scene, onPress, opts = {}) {
  const { width } = scene.scale;
  const R = 28;
  const x = opts.x ?? width - 46;
  const y = opts.y ?? 118;
  const depth = opts.depth ?? 950;
  const bg = scene.add.circle(x, y, R, 0x000000, 0.35)
    .setStrokeStyle(3, 0xffffff, 0.7).setScrollFactor(0).setDepth(depth)
    .setInteractive(new Phaser.Geom.Circle(R, R, 44), Phaser.Geom.Circle.Contains); // 命中圈比外观大，方便点
  const label = scene.add.text(x, y, 'II', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
  bg.on('pointerdown', (pointer, lx, ly, event) => {
    if (event && event.stopPropagation) event.stopPropagation();
    onPress();
  });
  return {
    destroy() { bg.destroy(); label.destroy(); },
    setPosition(nx, ny) { bg.setPosition(nx, ny); label.setPosition(nx, ny); },
    setVisible(v) { bg.setVisible(v); label.setVisible(v); },
  };
}
