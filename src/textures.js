import { ENEMIES, GEMS } from './data/enemies.js';

export const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
export const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';

// 所有贴图都用代码生成：火柴人、武器、晶体用线条画，动物用 emoji 画到画布上。
export function makeTextures(scene) {
  if (scene.textures.exists('stick0')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  for (const frame of [0, 1]) {
    drawStickman(g, frame);
    g.generateTexture(`stick${frame}`, 32, 48);
    g.clear();
  }

  g.fillStyle(0xf4f1e8).fillRect(0, 0, 64, 64);
  g.lineStyle(1, 0xe2dccd).lineBetween(0, 0.5, 64, 0.5).lineBetween(0.5, 0, 0.5, 64);
  g.generateTexture('grid', 64, 64);
  g.clear();

  g.fillStyle(0x666666).fillRect(0, 4, 7, 2);
  g.fillStyle(0x1f1f1f).fillTriangle(7, 1, 20, 5, 7, 9);
  g.generateTexture('knife', 20, 10);
  g.clear();

  g.fillStyle(0xff7043).fillCircle(9, 9, 9);
  g.fillStyle(0xffd54f).fillCircle(9, 9, 5);
  g.generateTexture('fireball', 18, 18);
  g.clear();

  g.fillStyle(0x7e57c2, 0.15).fillCircle(64, 64, 64);
  g.lineStyle(2, 0x7e57c2, 0.45).strokeCircle(64, 64, 63);
  g.generateTexture('aura', 128, 128);
  g.clear();

  for (const [tier, { color, w, h }] of Object.entries(GEMS)) {
    const pts = [{ x: w / 2, y: 0 }, { x: w, y: h * 0.45 }, { x: w / 2, y: h }, { x: 0, y: h * 0.45 }];
    g.fillStyle(color).fillPoints(pts, true);
    g.fillStyle(0xffffff, 0.55).fillTriangle(w / 2, 2, w - 2, h * 0.45, w / 2, h * 0.45);
    g.lineStyle(1.5, 0x000000, 0.35).strokePoints(pts, true);
    g.generateTexture(`gem-${tier}`, w, h);
    g.clear();
  }
  g.destroy();

  for (const [key, { emoji, size }] of Object.entries(ENEMIES)) {
    const tex = scene.textures.createCanvas(key, size, size);
    const ctx = tex.getContext();
    ctx.font = `${Math.floor(size * 0.82)}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.06);
    tex.refresh();
  }
}

// frame 0 / 1 是走路的两帧，默认面朝右
function drawStickman(g, frame) {
  const swing = frame ? 5 : -5;
  g.lineStyle(3, 0x1f1f1f);
  g.strokeCircle(16, 9, 6);
  g.lineBetween(16, 15, 16, 31);
  g.lineBetween(16, 20, 7, 27 + swing);
  g.lineBetween(16, 20, 25, 27 - swing);
  g.lineBetween(16, 31, frame ? 10 : 13, 46);
  g.lineBetween(16, 31, frame ? 22 : 19, 46);
  g.lineStyle(3, 0xe53935).lineBetween(12, 16, 20, 16).lineBetween(12, 16, 5, 20); // 红围巾
}
