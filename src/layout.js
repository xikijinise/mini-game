// 画布/布局常量：触控设备用竖屏画布 + 底部拇指摇杆区，桌面保持横屏 1024×640。
// 不依赖 Phaser，main.js 与 UI 都可直接引用，避免循环依赖。

export const LANDSCAPE = { width: 1024, height: 640 };
export const PORTRAIT = { width: 720, height: 1280 }; // 9:16
export const THUMB_ZONE_H = 280; // 竖屏底部「手指区」高度（≈22%），摇杆只在此带内生效

// 触控/粗指针设备检测：有触点或 pointer: coarse 即视为手机/平板
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const touchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return touchPoints || coarse || 'ontouchstart' in window;
}

// 启动时决定一次：触控设备 → 竖屏画布（宽 720，高按屏幕比例取 1136–1600，FIT 后接近满屏）；否则横屏
export function pickCanvasSize() {
  if (!isTouchDevice()) return LANDSCAPE;
  const w = window.innerWidth || 0;
  const h = window.innerHeight || 0;
  if (!(w > 0 && h > w)) return PORTRAIT; // 横着拿 / 取不到尺寸：仍用 9:16 竖屏画布
  const height = Math.round(Math.min(1600, Math.max(1136, (PORTRAIT.width * h) / w)));
  return { width: PORTRAIT.width, height };
}

// 当前场景是否为竖屏触控布局
export function isPortraitLayout(scene) {
  return scene.scale.height > scene.scale.width && isTouchDevice();
}

// 手指区高度（非竖屏触控布局为 0）；游戏区 = [0, height - thumbH)
export function thumbZoneHeight(scene) {
  return isPortraitLayout(scene) ? THUMB_ZONE_H : 0;
}
