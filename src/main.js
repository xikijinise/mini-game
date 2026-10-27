import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';

// 桌面铺满窗口：逻辑画布按窗口宽高比算（同比例 → FIT 后正好铺满，四边无留边）。
// 常规横向窗口锁逻辑高 640（与原 1024×640 设计同视野/HUD 比例），宽 = 640×宽高比，上限 1920；
// 偏方/竖长窗口（宽高比 < 1.25）锁逻辑宽 800，高 = 800÷宽高比，上限 1200。
// 只有超出上述区间的极端窗口才会出现少量留边（与画布同色米黄，不露黑边）。
const BASE_H = 640;
const MIN_W = 800;
const MAX_W = 1920;
const MAX_H = 1200;
function fitSize() {
  const el = document.getElementById('game');
  const vw = (el && el.clientWidth) || window.innerWidth || 1024;
  const vh = (el && el.clientHeight) || window.innerHeight || 640;
  const aspect = vw / Math.max(1, vh);
  if (aspect >= MIN_W / BASE_H) {
    return { width: Math.round(Math.min(MAX_W, BASE_H * aspect)), height: BASE_H };
  }
  return { width: MIN_W, height: Math.round(Math.min(MAX_H, MIN_W / aspect)) };
}
const initial = fitSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: initial.width,
  height: initial.height,
  backgroundColor: '#f4f1e8',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});

// 窗口缩放 / 全屏切换时按新宽高比改逻辑尺寸；GameScene 监听 scale 'resize' 重排 HUD
let resizeRaf = 0;
function onWindowResize() {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const { width, height } = fitSize();
    if (width !== game.scale.width || height !== game.scale.height) game.scale.setGameSize(width, height);
    else game.scale.refresh();
  });
}
window.addEventListener('resize', onWindowResize);

// 开发时方便在浏览器控制台里调试，例如 game.scene.keys.GameScene.gainXp(50)
if (import.meta.env.DEV) window.game = game;
