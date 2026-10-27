import Phaser from 'phaser';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import { pickCanvasSize, isMobileDevice } from './layout.js';

// 同一构建：电脑 → 按窗口比例算逻辑画布 + FIT 铺满（同 main@1b63525）；手机竖握 → 720×(1136–1600)；手机横握 → 逻辑高 640、宽按视口比，FIT 铺满。
// 旋转/地址栏伸缩时不刷新页面，只 setGameSize；各场景监听 scale 'resize' 重排 HUD/摇杆/面板。
const initial = pickCanvasSize();
const mobile = isMobileDevice();

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
  // 手机：先浅色开局引导页（全屏钮/触控提示）再进游戏；电脑：同 main 直接进游戏（键鼠，无手机引导/全屏钮）
  scene: mobile ? [TitleScene, GameScene] : [GameScene],
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
// 电脑：窗口缩放/全屏时按新宽高比改逻辑尺寸；手机：旋转/地址栏变化时重算逻辑画布
window.addEventListener('resize', onViewportResize);
if (mobile) {
  // 部分 iOS 旋转后 innerWidth/innerHeight 延迟更新：多补两次
  window.addEventListener('orientationchange', () => {
    setTimeout(onViewportResize, 150);
    setTimeout(onViewportResize, 500);
  });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportResize);
}

// 开发时方便在浏览器控制台里调试，例如 game.scene.keys.GameScene.gainXp(50)
if (import.meta.env.DEV) window.game = game;
