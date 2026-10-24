import { EMOJI_FONT, FONT } from '../textures.js';

const CARD_W = 230;
const CARD_H = 290;
const GAP = 30;

const levelTag = (c) => (c.kind === 'food' ? '' : c.lv === 0 ? '新！' : `Lv ${c.lv} → ${c.lv + 1}`);

// 升级时弹出的三选一面板，点中一张卡片后关闭面板并回调 onPick(choice)
export function showLevelUp(scene, level, choices, onPick) {
  const { width, height } = scene.scale;
  const parts = [];
  const fixed = (obj) => {
    parts.push(obj);
    return obj.setScrollFactor(0).setDepth(1000);
  };

  fixed(scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0).setInteractive());
  fixed(scene.add.text(width / 2, 90, `升级！Lv ${level}`, { fontFamily: FONT, fontSize: '44px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
  fixed(scene.add.text(width / 2, 140, '用鼠标选择一项强化', { fontFamily: FONT, fontSize: '20px', color: '#dddddd' }).setOrigin(0.5));

  const total = choices.length * CARD_W + (choices.length - 1) * GAP;
  choices.forEach((c, i) => {
    const x = width / 2 - total / 2 + CARD_W / 2 + i * (CARD_W + GAP);
    const y = height / 2 + 50;
    const card = fixed(scene.add.rectangle(x, y, CARD_W, CARD_H, 0xfffaf0).setStrokeStyle(4, 0x222222));
    fixed(scene.add.text(x, y - 90, c.icon, { fontSize: '56px', fontFamily: EMOJI_FONT }).setOrigin(0.5));
    fixed(scene.add.text(x, y - 22, c.name, { fontFamily: FONT, fontSize: '28px', color: '#222222', fontStyle: 'bold' }).setOrigin(0.5));
    fixed(scene.add.text(x, y + 16, levelTag(c), { fontFamily: FONT, fontSize: '18px', color: c.lv === 0 ? '#e65100' : '#777777' }).setOrigin(0.5));
    fixed(scene.add.text(x, y + 78, c.desc, {
      fontFamily: FONT,
      fontSize: '19px',
      color: '#333333',
      align: 'center',
      wordWrap: { width: CARD_W - 36, useAdvancedWrap: true },
    }).setOrigin(0.5));

    card.setInteractive({ useHandCursor: true });
    card.on('pointerover', () => card.setFillStyle(0xfff1b8).setStrokeStyle(5, 0xe65100));
    card.on('pointerout', () => card.setFillStyle(0xfffaf0).setStrokeStyle(4, 0x222222));
    card.on('pointerdown', () => {
      parts.forEach((p) => p.destroy());
      scene.input.setDefaultCursor('default');
      onPick(c);
    });
  });
}
