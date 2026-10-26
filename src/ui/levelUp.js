import { EMOJI_FONT, FONT } from '../textures.js';
import { isTouchDevice, thumbZoneHeight } from '../layout.js';

const BASE_CARD_W = 168;
const CARD_H = 260;
const BASE_GAP = 14;
const NEED = 2;

const levelTag = (c) => (c.kind === 'food' ? '' : c.lv === 0 ? '新！' : `Lv ${c.lv} → ${c.lv + 1}`);

// 升级面板：5 选 2。点选或按 1–5 切换选中，满 2 项后回调 onPick(selected[])
export function showLevelUp(scene, level, choices, onPick) {
  const { width, height } = scene.scale;
  const n = Math.max(1, choices.length);
  // 竖屏触控：卡片排成 2 行（上 3 下 2），整体落在手指区上方的游戏区内；桌面横屏保持一排
  const thumbH = thumbZoneHeight(scene);
  const portrait = thumbH > 0;
  const perRow = portrait ? Math.min(3, n) : n;
  const rows = Math.ceil(n / perRow);
  const GAP = portrait ? 16 : width < 900 ? 8 : BASE_GAP;
  const maxW = portrait ? 210 : BASE_CARD_W;
  // 窄屏：缩小间距/卡宽，保证卡不溢出（左右各留 20px）
  const CARD_W = Math.min(maxW, Math.floor((width - 40 - (perRow - 1) * GAP) / perRow));
  const playH = height - thumbH;
  const gridH = rows * CARD_H + (rows - 1) * GAP;
  const gridTop = portrait ? Math.max(170, Math.round((playH - gridH) / 2) + 40) : height / 2 + 40 - CARD_H / 2;
  const titleY = portrait ? gridTop - 96 : 72;
  const hintY = portrait ? gridTop - 46 : 118;
  const fs = (px) => `${portrait ? Math.round(px * 1.2) : px}px`; // 竖屏画布缩放更小，字放大 20%
  const touch = isTouchDevice();
  const hintLabel = (k) => (touch ? `点选 ${NEED} 项 · 已选 ${k}/${NEED}` : `选 ${NEED} 项（点击或按 1–5）· 已选 ${k}/${NEED}`);
  const parts = [];
  const fixed = (obj) => {
    parts.push(obj);
    return obj.setScrollFactor(0).setDepth(1000);
  };

  fixed(scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0).setInteractive());
  fixed(scene.add.text(width / 2, titleY, `升级！Lv ${level}`, { fontFamily: FONT, fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
  const hint = fixed(scene.add.text(width / 2, hintY, hintLabel(0), {
    fontFamily: FONT, fontSize: fs(18), color: '#dddddd',
  }).setOrigin(0.5));

  const selected = []; // indices
  const cards = []; // { rect, idx, choice }

  let done = false;
  const keyboard = scene.input.keyboard;
  const finish = () => {
    if (done || selected.length < NEED) return;
    done = true;
    if (keyboard) keyboard.off('keydown', onKey);
    scene.events.off('shutdown', cleanup);
    const picked = selected.map((i) => choices[i]);
    parts.forEach((p) => p.destroy());
    scene.input.setDefaultCursor('default');
    onPick(picked);
  };
  const refreshHint = () => {
    hint.setText(hintLabel(selected.length));
  };
  const paint = (card, on) => {
    if (on) card.rect.setFillStyle(0xfff1b8).setStrokeStyle(5, 0xe65100);
    else card.rect.setFillStyle(0xfffaf0).setStrokeStyle(4, 0x222222);
  };
  const toggle = (idx) => {
    if (done) return;
    const at = selected.indexOf(idx);
    if (at >= 0) {
      selected.splice(at, 1);
      paint(cards[idx], false);
      refreshHint();
      return;
    }
    if (selected.length >= NEED) return;
    selected.push(idx);
    paint(cards[idx], true);
    refreshHint();
    if (selected.length >= NEED) {
      scene.time.delayedCall(120, finish);
    }
  };
  const onKey = (event) => {
    const idx = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (idx >= 0 && idx < choices.length) toggle(idx);
  };
  const cleanup = () => {
    done = true;
    if (keyboard) keyboard.off('keydown', onKey);
  };
  if (keyboard) keyboard.on('keydown', onKey);
  scene.events.once('shutdown', cleanup);

  choices.forEach((c, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, n - row * perRow); // 末行（如 2 张）居中
    const total = inRow * CARD_W + (inRow - 1) * GAP;
    const x = width / 2 - total / 2 + CARD_W / 2 + col * (CARD_W + GAP);
    const y = gridTop + CARD_H / 2 + row * (CARD_H + GAP);
    const rect = fixed(scene.add.rectangle(x, y, CARD_W, CARD_H, 0xfffaf0).setStrokeStyle(4, 0x222222));
    if (choices.length > 1) {
      fixed(scene.add.text(x - CARD_W / 2 + 10, y - CARD_H / 2 + 8, String(i + 1), {
        fontFamily: FONT, fontSize: '18px', color: '#999999', fontStyle: 'bold',
      }));
    }
    fixed(scene.add.text(x, y - 88, c.icon, { fontSize: '48px', fontFamily: EMOJI_FONT }).setOrigin(0.5));
    fixed(scene.add.text(x, y - 28, c.name, { fontFamily: FONT, fontSize: fs(22), color: '#222222', fontStyle: 'bold' }).setOrigin(0.5));
    fixed(scene.add.text(x, y + 8, levelTag(c), {
      fontFamily: FONT, fontSize: fs(16), color: c.lv === 0 ? '#e65100' : '#777777',
    }).setOrigin(0.5));
    fixed(scene.add.text(x, y + 70, c.desc, {
      fontFamily: FONT,
      fontSize: fs(16),
      color: '#333333',
      align: 'center',
      wordWrap: { width: CARD_W - 24, useAdvancedWrap: true },
    }).setOrigin(0.5));

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => {
      if (!selected.includes(i)) rect.setFillStyle(0xfff8e1);
    });
    rect.on('pointerout', () => paint(cards[i], selected.includes(i)));
    rect.on('pointerdown', () => toggle(i));
    cards.push({ rect, idx: i, choice: c });
  });
}
