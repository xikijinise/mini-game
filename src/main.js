import Phaser from 'phaser';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import { pickCanvasSize } from './layout.js';

// 同一构建：竖握 → 720×(1136–1600) 竖屏画布；横握/桌面 → 逻辑高 640、宽按视口比，FIT 铺满。
// 旋转/地址栏伸缩时不刷新页面，只 setGameSize；各场景监听 scale 'resize' 重排 HUD/摇杆/面板。
const initial = pickCanvasSize();

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

let resizeRaf = 0;
function onViewportResize() {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const { width, height } = pickCanvasSize();
    if (Math.abs(width - game.scale.width) > 1 || Math.abs(height - game.scale.height) > 1) game.scale.setGameSize(width, height);
    else game.scale.refresh();
  });
}
window.addEventListener('resize', onViewportResize);
// 部分 iOS 旋转后 innerWidth/innerHeight 延迟更新：多补两次
window.addEventListener('orientationchange', () => {
  setTimeout(onViewportResize, 150);
  setTimeout(onViewportResize, 500);
});
if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);

// 开发时方便在浏览器控制台里调试，例如 game.scene.keys.GameScene.gainXp(50)
if (import.meta.env.DEV) window.game = game;
