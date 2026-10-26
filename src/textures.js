import { ENEMIES, GEMS } from './data/enemies.js';
import { BOSSES } from './data/bosses.js';

export const WEAPON_ART = ['boomerang', 'slash', 'slash_01', 'slash_02'];

// 林绮 PNG：动物（key = ENEMIES 的 key）+ 武器。路径相对 base（/survivor/）
export function preloadArt(scene) {
  const keys = new Set([...Object.keys(ENEMIES), ...Object.values(BOSSES).map((b) => b.art)]);
  for (const key of keys) scene.load.image(key, `assets/enemies/${key}.png`);
  scene.load.image('elephant_icon', 'assets/enemies/elephant_icon.png');
  for (const key of WEAPON_ART) scene.load.image(key, `assets/weapons/${key}.png`);
}

export const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
export const FONT = '"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif';

// 代码生成的贴图：火柴人、飞刀/火球/冰锥/箭、晶体。动物和回旋镖/剑气用 PNG（preloadArt）。
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

  g.fillStyle(0x81d4fa).fillTriangle(0, 6, 16, 0, 16, 12);
  g.fillStyle(0xe1f5fe).fillTriangle(4, 6, 16, 2, 16, 10);
  g.generateTexture('frost', 16, 12);
  g.clear();

  g.fillStyle(0x8d6e63).fillRect(0, 4, 10, 2);
  g.fillStyle(0xfff8e1).fillTriangle(10, 1, 22, 5, 10, 9);
  g.generateTexture('arrow', 22, 10);
  g.clear();

  // 回旋镖 / 剑气 / 动物：改用林绮 PNG（见 preloadArt，public/assets/weapons、enemies）

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

  // Boss 宝箱（w1.2：捡到 = pendingLevels += n）
  g.fillStyle(0x8d5524).fillRoundedRect(0, 6, 28, 18, 3);
  g.fillStyle(0xa1662f).fillRoundedRect(0, 0, 28, 10, 4);
  g.fillStyle(0xffca28).fillRect(0, 9, 28, 3).fillRect(11, 6, 6, 9);
  g.lineStyle(1.5, 0x3e2723, 0.8).strokeRoundedRect(0.5, 0.5, 27, 23, 3);
  g.generateTexture('chest', 28, 24);
  g.clear();
  g.destroy();

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
