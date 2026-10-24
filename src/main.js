import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 900 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
