import Phaser from 'phaser';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';

// 横屏全屏：逻辑高度固定 640（保持原设计的视野/HUD/升级卡比例），
// 逻辑宽度按视口宽高比算，FIT 后画布正好铺满视口，不再留上下/左右黑边。
const BASE_H = 640;
const MIN_W = 800;
const MAX_W = 1600;
function fitSize() {
  const el = document.getElementById('game');
  const vw = (el && el.clientWidth) || window.innerWidth || 1024;
  const vh = (el && el.clientHeight) || window.innerHeight || 640;
  const w = Math.round(Phaser.Math.Clamp(BASE_H * (vw / Math.max(1, vh)), MIN_W, MAX_W));
  return { width: w, height: BASE_H };
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
  scene: [TitleScene, GameScene], // 先开局引导页，再进游戏
});

// 视口变化（地址栏收起/展开、旋转）时按新宽高比改逻辑宽度；场景监听 scale resize 重排 HUD/摇杆
let resizeRaf = 0;
function onViewportResize() {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const { width, height } = fitSize();
    if (Math.abs(width - game.scale.width) > 1 || height !== game.scale.height) game.scale.setGameSize(width, height);
    else game.scale.refresh();
  });
}
window.addEventListener('resize', onViewportResize);
window.addEventListener('orientationchange', () => setTimeout(onViewportResize, 150));
if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);

// 开发时方便在浏览器控制台里调试，例如 game.scene.keys.GameScene.gainXp(50)
if (import.meta.env.DEV) window.game = game;
