import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import { pickCanvasSize } from './layout.js';

// 触控设备（手机/平板）用竖屏 720×1280，底部留拇指摇杆区；桌面 1024×640
const size = pickCanvasSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: size.width,
  height: size.height,
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

// 开发时方便在浏览器控制台里调试，例如 game.scene.keys.GameScene.gainXp(50)
if (import.meta.env.DEV) window.game = game;
