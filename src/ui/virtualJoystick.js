import Phaser from 'phaser';
import { FONT } from '../textures.js';

const BASE_R = 70; // 底盘半径
const KNOB_R = 32; // 摇杆头半径
const DEAD = 0.15; // 死区（占半径比例）

// 触控/粗指针设备检测：有触点或 pointer: coarse 即视为手机/平板
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return touchPoints || coarse || 'ontouchstart' in window;
}

// 横屏浮动虚拟摇杆：只在「左半屏下部」（HUD 下方、宽 45%）按下生效，底盘跟到手指处；
// 松手回到左下默认位置、方向归零。右半屏与顶栏不抢触摸。
// 返回 { vector, destroy, setVisible, setEnabled, release }；vector 为归一化方向
export function createVirtualJoystick(scene, opts = {}) {
  const { width, height } = scene.scale;
  const top = opts.top ?? Math.round(height * 0.3); // 顶栏 / 图标条下方才算摇杆区
  const zone = new Phaser.Geom.Rectangle(0, top, Math.round(width * (opts.widthRatio ?? 0.45)), height - top);
  const home = { x: opts.x ?? BASE_R + 60, y: opts.y ?? height - BASE_R - 40 };
  const depth = opts.depth ?? 950;

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
    place(
      Phaser.Math.Clamp(pointer.x, BASE_R + 8, zone.right - 8),
      Phaser.Math.Clamp(pointer.y, zone.top + BASE_R * 0.5, height - BASE_R - 8),
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
    setVisible(v) { bg.setVisible(v); label.setVisible(v); },
  };
}
