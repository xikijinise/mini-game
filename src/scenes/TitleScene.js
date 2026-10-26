import Phaser from 'phaser';
import { FONT } from '../textures.js';
import { isTouchDevice } from '../ui/virtualJoystick.js';

// 开局引导页（浅色背景）：标题 + 操作提示 + 「开始游戏」+ 右上全屏按钮。
// 横屏全屏逻辑沿用 main.js 的 FIT + 按视口改逻辑宽；这里监听 scale resize 重排。
const BG = 0xf4f1e8;

const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const fsSupported = () => {
  const el = document.documentElement;
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled)
    && !!(el.requestFullscreen || el.webkitRequestFullscreen);
};
function toggleFullscreen() {
  try {
    if (fsElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      const p = exit && exit.call(document);
      if (p && p.catch) p.catch(() => {});
      return true;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return false;
    const p = req.call(el, { navigationUI: 'hide' });
    const lock = () => {
      const o = screen.orientation;
      if (o && o.lock) o.lock('landscape').catch(() => {});
    };
    if (p && p.then) p.then(lock).catch(() => {});
    else lock();
    return true;
  } catch (e) {
    return false;
  }
}

function makeButton(scene, { w, h, fill, stroke, label, size, color, onPress }) {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const draw = (hover) => {
    g.clear();
    g.fillStyle(hover ? Phaser.Display.Color.IntegerToColor(fill).darken(8).color : fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(18, h / 2));
    g.lineStyle(3, stroke, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(18, h / 2));
  };
  draw(false);
  const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold' }).setOrigin(0.5);
  c.add([g, t]);
  // 命中区比外观略大，方便拇指
  c.setSize(w + 16, h + 16).setInteractive({ useHandCursor: true });
  c.on('pointerover', () => draw(true));
  c.on('pointerout', () => draw(false));
  // 全屏 API 需要用户手势：在 pointerup 里触发（Phaser 推荐）
  c.on('pointerup', () => onPress());
  c.label = t;
  return c;
}

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(BG);
    const touch = isTouchDevice();

    this.bg = this.add.graphics();
    this.title = this.add.text(0, 0, '火柴人幸存者', {
      fontFamily: FONT, fontSize: '64px', color: '#222222', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.sub = this.add.text(0, 0, '自动攻击 · 捡晶体升级 · 活下去', {
      fontFamily: FONT, fontSize: '22px', color: '#6b6457',
    }).setOrigin(0.5);
    this.hint = this.add.text(0, 0, touch ? '触控：左侧摇杆移动' : '桌面：WASD / 方向键移动', {
      fontFamily: FONT, fontSize: '24px', color: '#3a362e', align: 'center',
    }).setOrigin(0.5);

    const start = () => {
      if (this.started) return;
      this.started = true;
      this.scene.start('GameScene');
    };
    this.startBtn = makeButton(this, {
      w: 280, h: 84, fill: 0x2f7d4f, stroke: 0x1d5234, label: '开始游戏', size: 34, color: '#ffffff', onPress: start,
    });
    const kb = this.input.keyboard;
    if (kb) {
      kb.once('keydown-SPACE', start);
      kb.once('keydown-ENTER', start);
    }

    // 全屏按钮：无 Fullscreen API（常见 iOS Safari）时隐藏，并在页面下方给一行降级提示
    this.fsOk = fsSupported();
    this.fsBtn = null;
    this.fsNote = null;
    if (this.fsOk) {
      this.fsBtn = makeButton(this, {
        w: 150, h: 60, fill: 0xffffff, stroke: 0x3a362e, label: '⛶ 全屏', size: 24, color: '#222222',
        onPress: () => {
          if (!toggleFullscreen()) this.showToast('当前浏览器不支持全屏，可用系统横屏/添加到主屏幕');
        },
      });
      this.onFsChange = () => this.refreshFsLabel();
      document.addEventListener('fullscreenchange', this.onFsChange);
      document.addEventListener('webkitfullscreenchange', this.onFsChange);
      this.refreshFsLabel();
    } else if (touch) {
      this.fsNote = this.add.text(0, 0, '提示：当前浏览器不支持全屏，可用系统横屏或「添加到主屏幕」获得全屏体验', {
        fontFamily: FONT, fontSize: '18px', color: '#8a8273', align: 'center',
      }).setOrigin(0.5);
    }

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      if (this.onFsChange) {
        document.removeEventListener('fullscreenchange', this.onFsChange);
        document.removeEventListener('webkitfullscreenchange', this.onFsChange);
      }
    });
  }

  refreshFsLabel() {
    if (this.fsBtn) this.fsBtn.label.setText(fsElement() ? '退出全屏' : '⛶ 全屏');
  }

  showToast(msg) {
    if (this.toast) this.toast.destroy();
    const { width, height } = this.scale;
    this.toast = this.add.text(width / 2, height - 60, msg, {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', backgroundColor: '#3a362ecc', padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(10);
    this.time.delayedCall(2600, () => { if (this.toast) { this.toast.destroy(); this.toast = null; } });
  }

  layout() {
    const { width, height } = this.scale;
    const cx = width / 2;
    this.cameras.main.setSize(width, height);
    this.bg.clear();
    this.bg.fillStyle(BG, 1).fillRect(0, 0, width, height);
    // 简单装饰：浅色描边卡片
    const cw = Math.min(width - 80, 720);
    const ch = 420;
    this.bg.fillStyle(0xfffdf7, 1).fillRoundedRect(cx - cw / 2, height / 2 - ch / 2 - 10, cw, ch, 24);
    this.bg.lineStyle(3, 0xd9d2c2, 1).strokeRoundedRect(cx - cw / 2, height / 2 - ch / 2 - 10, cw, ch, 24);

    this.title.setPosition(cx, height / 2 - 150);
    this.sub.setPosition(cx, height / 2 - 88);
    this.hint.setPosition(cx, height / 2 - 30);
    this.startBtn.setPosition(cx, height / 2 + 80);
    if (this.fsBtn) this.fsBtn.setPosition(width - 100, 56);
    if (this.fsNote) this.fsNote.setPosition(cx, height - 36);
  }
}
