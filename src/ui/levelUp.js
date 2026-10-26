import { EMOJI_FONT, FONT } from '../textures.js';
import { isTouchDevice } from './virtualJoystick.js';

const BASE_CARD_W = 168;
const CARD_H = 260;
const BASE_GAP = 14;
const NEED = 2;

const levelTag = (c) => (c.kind === 'food' ? '' : c.lv === 0 ? '新！' : `Lv ${c.lv} → ${c.lv + 1}`);

// 升级面板：5 选 2。点选或按 1–5 切换选中，满 2 项后回调 onPick(selected[])
export function showLevelUp(scene, level, choices, onPick) {
  const { width, height } = scene.scale;
  const n = Math.max(1, choices.length);
  // 横屏保持一排；窄屏缩小间距与卡宽，保证不溢出（左右各留 20px）
  const GAP = width < 900 ? 8 : BASE_GAP;
  const CARD_W = Math.min(BASE_CARD_W, Math.floor((width - 40 - (n - 1) * GAP) / n));
  const touch = isTouchDevice();
  const hintLabel = (k) => (touch ? `点选 ${NEED} 项 · 已选 ${k}/${NEED}` : `选 ${NEED} 项（点击或按 1–5）· 已选 ${k}/${NEED}`);
  const parts = [];
  const fixed = (obj) => {
    parts.push(obj);
    return obj.setScrollFactor(0).setDepth(1000);
  };

  fixed(scene.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0).setInteractive());
  fixed(scene.add.text(width / 2, 72, `升级！Lv ${level}`, { fontFamily: FONT, fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5));
  const hint = fixed(scene.add.text(width / 2, 118, hintLabel(0), {
    fontFamily: FONT, fontSize: '18px', color: '#dddddd',
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

  const total = choices.length * CARD_W + (choices.length - 1) * GAP;
  choices.forEach((c, i) => {
    const x = width / 2 - total / 2 + CARD_W / 2 + i * (CARD_W + GAP);
    const y = height / 2 + 40;
    const rect = fixed(scene.add.rectangle(x, y, CARD_W, CARD_H, 0xfffaf0).setStrokeStyle(4, 0x222222));
    if (choices.length > 1) {
      fixed(scene.add.text(x - CARD_W / 2 + 10, y - CARD_H / 2 + 8, String(i + 1), {
        fontFamily: FONT, fontSize: '18px', color: '#999999', fontStyle: 'bold',
      }));
    }
    fixed(scene.add.text(x, y - 88, c.icon, { fontSize: '48px', fontFamily: EMOJI_FONT }).setOrigin(0.5));
    fixed(scene.add.text(x, y - 28, c.name, { fontFamily: FONT, fontSize: '22px', color: '#222222', fontStyle: 'bold' }).setOrigin(0.5));
    fixed(scene.add.text(x, y + 8, levelTag(c), {
      fontFamily: FONT, fontSize: '16px', color: c.lv === 0 ? '#e65100' : '#777777',
    }).setOrigin(0.5));
    fixed(scene.add.text(x, y + 70, c.desc, {
      fontFamily: FONT,
      fontSize: '16px',
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
