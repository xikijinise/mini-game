// 画布/布局：同一构建按「当前视口方向」自适应，旋转时由 main.js 调 setGameSize 切换，场景监听 scale resize 重排。
// - 手机竖握：竖屏画布（宽 720，高按视口比 1136–1600），底部拇指区 + 下半屏摇杆
// - 手机横握：逻辑高 640，逻辑宽按视口比（800–1600），FIT 后铺满视口 + 左下摇杆
// - 电脑：铺满窗口（同 main@1b63525）——逻辑画布按窗口比例（锁高 640 / 窄窗锁宽 800）+ FIT，键鼠操作，无摇杆/触控暂停钮
// 不依赖 Phaser，main.js 与 UI 都可直接引用，避免循环依赖。

export const PORTRAIT_W = 720;
export const LANDSCAPE_H = 640;
export const DESKTOP_W = 1024;
export const DESKTOP_H = 640;
export const THUMB_ZONE_H = 280; // 竖屏底部「手指区」高度：镜头偏移/HUD 留位/摇杆默认位置；摇杆可触范围为下半屏

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 设备判定：规则唯一来源在 index.html 头部脚本（尽早决定外框/元信息/手势拦截），这里只读结果。
// 默认电脑；仅 ?device=mobile、明确移动 UA（含 iPadOS 伪装 Mac+多触点）、或主指针 coarse 且无任何 fine 指针 → 手机。
let cachedMobile = null;
function detectMobile() {
  if (typeof window === 'undefined') return false;
  return window.__MG_DEVICE__ === 'mobile';
}
export function isMobileDevice() {
  if (cachedMobile === null) cachedMobile = detectMobile();
  return cachedMobile;
}
// 旧名保留：现在语义 = 「按手机方案处理」（触控摇杆/手机 HUD/旋转自适应），桌面触控笔记本返回 false
export const isTouchDevice = isMobileDevice;

export function viewportSize() {
  const el = typeof document !== 'undefined' && document.getElementById('game');
  const w = (el && el.clientWidth) || window.innerWidth || 1024;
  const h = (el && el.clientHeight) || window.innerHeight || 640;
  return { w, h };
}

// 按当前视口算逻辑画布尺寸
// - 电脑：铺满窗口（main@1b63525 desktop-fill）：常规横向窗口锁逻辑高 640、宽 = 640×宽高比（上限 1920）；
//   偏方/竖长窗口（宽高比 < 1.25）锁逻辑宽 800、高 = 800÷宽高比（上限 1200）。同比例 → FIT 后四边无留边
// - 手机竖握：720×(1136–1600)；手机横握：高 640、宽按视口比 800–1600，铺满
const DESKTOP_MIN_W = 800;
const DESKTOP_MAX_W = 1920;
const DESKTOP_MAX_H = 1200;
function desktopFitSize(w, h) {
  const aspect = w / Math.max(1, h);
  if (aspect >= DESKTOP_MIN_W / DESKTOP_H) {
    return { width: Math.round(Math.min(DESKTOP_MAX_W, DESKTOP_H * aspect)), height: DESKTOP_H };
  }
  return { width: DESKTOP_MIN_W, height: Math.round(Math.min(DESKTOP_MAX_H, DESKTOP_MIN_W / aspect)) };
}
export function pickCanvasSize() {
  const { w, h } = viewportSize();
  if (!isMobileDevice()) return desktopFitSize(w, h);
  if (h > w) {
    return { width: PORTRAIT_W, height: Math.round(clamp((PORTRAIT_W * h) / w, 1136, 1600)) };
  }
  return { width: Math.round(clamp(LANDSCAPE_H * (w / Math.max(1, h)), 800, 1600)), height: LANDSCAPE_H };
}

// 当前场景是否为竖屏触控布局（以逻辑画布为准，旋转后随 setGameSize 变化）
export function isPortraitLayout(scene) {
  return isMobileDevice() && scene.scale.height > scene.scale.width;
}

// 手指区高度（非竖屏触控布局为 0）；游戏区 = [0, height - thumbH)
export function thumbZoneHeight(scene) {
  return isPortraitLayout(scene) ? THUMB_ZONE_H : 0;
}
