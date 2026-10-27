// 画布/布局：同一构建按「当前视口方向」自适应，旋转时由 main.js 调 setGameSize 切换，场景监听 scale resize 重排。
// - 触控 + 竖握：竖屏画布（宽 720，高按视口比 1136–1600），底部拇指区 + 下半屏摇杆
// - 横握 / 桌面：逻辑高 640，逻辑宽按视口比（800–1600），FIT 后铺满视口
// 不依赖 Phaser，main.js 与 UI 都可直接引用，避免循环依赖。

export const PORTRAIT_W = 720;
export const LANDSCAPE_H = 640;
export const THUMB_ZONE_H = 280; // 竖屏底部「手指区」高度：镜头偏移/HUD 留位/摇杆默认位置；摇杆可触范围为下半屏

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 触控/粗指针设备检测：有触点或 pointer: coarse 即视为手机/平板
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return touchPoints || coarse || 'ontouchstart' in window;
}

export function viewportSize() {
  const el = typeof document !== 'undefined' && document.getElementById('game');
  const w = (el && el.clientWidth) || window.innerWidth || 1024;
  const h = (el && el.clientHeight) || window.innerHeight || 640;
  return { w, h };
}

// 按当前视口算逻辑画布尺寸
export function pickCanvasSize() {
  const { w, h } = viewportSize();
  if (isTouchDevice() && h > w) {
    return { width: PORTRAIT_W, height: Math.round(clamp((PORTRAIT_W * h) / w, 1136, 1600)) };
  }
  return { width: Math.round(clamp(LANDSCAPE_H * (w / Math.max(1, h)), 800, 1600)), height: LANDSCAPE_H };
}

// 当前场景是否为竖屏触控布局（以逻辑画布为准，旋转后随 setGameSize 变化）
export function isPortraitLayout(scene) {
  return scene.scale.height > scene.scale.width && isTouchDevice();
}

// 手指区高度（非竖屏触控布局为 0）；游戏区 = [0, height - thumbH)
export function thumbZoneHeight(scene) {
  return isPortraitLayout(scene) ? THUMB_ZONE_H : 0;
}
