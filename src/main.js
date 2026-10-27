import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';

// 桌面铺满窗口：Scale.RESIZE —— 逻辑画布 = #game 容器像素尺寸，canvas 贴顶贴底贴左右，
// 不做等比 FIT/居中，因此任何窗口比例都不会出现上下/左右留边（letterbox）。
// 窗口缩放 / 全屏切换由 Phaser 自动跟随，GameScene 监听 scale 'resize' 重排 HUD/浮层。
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: '100%',
  height: '100%',
  backgroundColor: '#f4f1e8',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: '100%',
    height: '100%',
  },
  scene: [GameScene],
});

// 开发时方便在浏览器控制台里调试，例如 game.scene.keys.GameScene.gainXp(50)
if (import.meta.env.DEV) window.game = game;
