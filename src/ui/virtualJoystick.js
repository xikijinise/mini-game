import Phaser from 'phaser';
import { FONT } from '../textures.js';
import { isTouchDevice, THUMB_ZONE_H } from '../layout.js';

// isTouchDevice 统一放在 layout.js（main.js 也要用），这里转出保持旧引用可用
export { isTouchDevice };

const BASE_R = 80; // 底盘半径
const KNOB_R = 36; // 摇杆头半径
const DEAD = 0.15; // 死区（占半径比例）

// 竖屏底部「手指区」虚拟摇杆（浮动式）：只在底部整宽手指带内按下才生效，底盘移到手指处；
// 松手回到默认位置（带内水平居中）、方向归零。上方游戏区点击不触发。
// 返回 { vector, destroy, setVisible, setEnabled, release }；vector 为归一化方向 × 力度(0..1)
export function createVirtualJoystick(scene, opts = {}) {
  const { width, height } = scene.scale;
  const zoneH = opts.zoneH ?? THUMB_ZONE_H;
  const zone = new Phaser.Geom.Rectangle(0, height - zoneH, width, zoneH);
  const home = { x: opts.x ?? Math.round(width / 2), y: opts.y ?? Math.round(zone.centerY + 10) };
  const depth = opts.depth ?? 950;

  // 手指区不画底板/分隔线/提示字：范围仍可触（zone 命中），视觉上不突出，只显示摇杆本身

  const base = scene.add.circle(home.x, home.y, BASE_R, 0x000000, 0.18)
    .setStrokeStyle(3, 0xffffff, 0.55).setScrollFactor(0).setDepth(depth);
  const knob = scene.add.circle(home.x, home.y, KNOB_R, 0xffffff, 0.55)
    .setStrokeStyle(3, 0x222222, 0.4).setScrollFactor(0).setDepth(depth + 1);

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
    base.setAlpha(1);
  };
  const track = (pointer) => {
    const dx = pointer.x - center.x;
    const dy = pointer.y - center.y;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, BASE_R);
    if (len < 1e-3) {
      knob.setPosition(center.x, center.y);
      vector.set(0, 0);
      return;
    }
    const nx = dx / len;
    const ny = dy / len;
    knob.setPosition(center.x + nx * clamped, center.y + ny * clamped);
    const strength = clamped / BASE_R;
    if (strength < DEAD) vector.set(0, 0);
    else vector.set(nx, ny); // 满速移动（与键盘一致），方向归一化
  };

  const onDown = (pointer, currentlyOver) => {
    if (!enabled || !visible || pointerId !== null) return;
    // 点到了其它可交互对象（暂停钮、升级卡等）就不抢
    if (currentlyOver && currentlyOver.length) return;
    if (!zone.contains(pointer.x, pointer.y)) return;
    pointerId = pointer.id;
    place(
      Phaser.Math.Clamp(pointer.x, zone.left + BASE_R + 8, zone.right - BASE_R - 8),
      Phaser.Math.Clamp(pointer.y, zone.top + BASE_R + 8, zone.bottom - BASE_R - 8),
    );
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
  // 页面失焦/切后台时归零，避免松手事件丢失后一直走
  const onBlur = () => release();
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
    isActive: () => pointerId !== null,
    zone,
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

// 右上角触控暂停按钮（HUD 下方、远离底部手指区）
export function createPauseButton(scene, onPress, opts = {}) {
  const { width } = scene.scale;
  const R = 32;
  const x = opts.x ?? width - 52;
  const y = opts.y ?? 132;
  const depth = opts.depth ?? 950;
  const bg = scene.add.circle(x, y, R, 0x000000, 0.35)
    .setStrokeStyle(3, 0xffffff, 0.7).setScrollFactor(0).setDepth(depth)
    .setInteractive(new Phaser.Geom.Circle(R, R, 48), Phaser.Geom.Circle.Contains); // 命中圈 r48 比外观大，方便拇指
  const label = scene.add.text(x, y, 'II', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', fontStyle: 'bold' })
    .setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
  bg.on('pointerdown', (pointer, lx, ly, event) => {
    if (event && event.stopPropagation) event.stopPropagation();
    onPress();
  });
  return {
    destroy() { bg.destroy(); label.destroy(); },
    setVisible(v) { bg.setVisible(v); label.setVisible(v); },
  };
}
