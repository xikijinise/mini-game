// 画布/布局：同一构建按「当前视口方向」自适应，旋转时由 main.js 调 setGameSize 切换，场景监听 scale resize 重排。
// - 手机竖握：竖屏画布（宽 720，高按视口比 1136–1600），底部拇指区 + 下半屏摇杆
// - 手机横握：逻辑高 640，逻辑宽按视口比（800–1600），FIT 后铺满视口 + 左下摇杆
// - 电脑：固定 1024×640 FIT，键鼠操作，无摇杆/触控暂停钮
// 不依赖 Phaser，main.js 与 UI 都可直接引用，避免循环依赖。

export const PORTRAIT_W = 720;
export const LANDSCAPE_H = 640;
export const DESKTOP_W = 1024;
export const DESKTOP_H = 640;
export const THUMB_ZONE_H = 280; // 竖屏底部「手指区」高度：镜头偏移/HUD 留位/摇杆默认位置；摇杆可触范围为下半屏

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 设备判定（页面加载时算一次并缓存，避免触控笔记本/外接键盘中途切换布局）：
// 1) URL ?device=desktop|mobile 强制（手验用）
// 2) 主指针为精确指针 (pointer: fine)，或接有精确指针且 UA 非移动端 → 电脑（含触控笔记本、带触屏的一体机）
// 3) 主指针为粗指针 (pointer: coarse) / 有触点 / 移动 UA → 手机/平板
// 4) 都判不出（老浏览器无 matchMedia 或 pointer: none）→ 仅按 UA 兜底，默认电脑
const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile|HarmonyOS/i;
let cachedMobile = null;
function detectMobile() {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('device');
    if (q === 'desktop' || q === 'pc') return false;
    if (q === 'mobile' || q === 'phone') return true;
  } catch (e) { /* ignore */ }
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = nav.userAgent || '';
  // iPadOS 13+ 桌面版 UA 伪装成 Mac：Macintosh + 多触点视为平板
  const uaMobile = MOBILE_UA.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  const mm = typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q).matches : null;
  if (mm) {
    if (mm('(pointer: fine)')) return false;
    // 主指针粗、但同时接着精确指针且 UA 不是移动端（Windows 平板模式的触控本等）→ 仍当电脑
    if (mm('(any-pointer: fine)') && !uaMobile) return false;
    if (mm('(pointer: coarse)')) return true;
  }
  if (nav.maxTouchPoints > 0 && uaMobile) return true;
  return uaMobile;
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
// - 电脑：固定 1024×640 + FIT（与 main 桌面体验一致），窗口缩放只等比缩放、不改逻辑尺寸
// - 手机竖握：720×(1136–1600)；手机横握：高 640、宽按视口比 800–1600，铺满
export function pickCanvasSize() {
  if (!isMobileDevice()) return { width: DESKTOP_W, height: DESKTOP_H };
  const { w, h } = viewportSize();
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
