import { BADGES, BADGE_COUNT } from '../data/badges.js';
import { formatMoney } from '../data/items.js';
import { itemCount, playerName, state } from '../game/state.js';
import { closeButton, followCenter, textStyle } from './helpers.js';
import { FloatWindow } from './Windows.js';
import { iconUnit } from '../gfx/textures.js';
import { isCancel } from './input.js';
import { matches } from '../game/keybinds.js';

const W = 640;
const FULL_H = 380;
const PANEL = 0x262c3e;
const INNER = 0x1c2131;
const LINE = 0x3e4660;
const LABEL = '#c8d0e8';
// Ô phụ kiện trên thẻ (trái trên, phải trên, trái dưới, phải dưới)
const COSMETIC_SLOTS = ['Nón', 'Cánh', 'Áo', 'Quần'];
const SLOT = 36;
const VALUE = '#ffffff';

// Thời gian chơi "143 giờ 33 phút"
const playTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  return h ? `${h} giờ ${m % 60} phút` : `${m} phút`;
};
const dateText = (ms) => {
  if (!ms) return '—';
  const d = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getDate())}-${two(d.getMonth() + 1)}-${d.getFullYear()}`;
};

// Biểu tượng thẻ xanh (nút Thẻ HLV và tiêu đề)
export function drawCardIcon(g, cx, cy, s = 1) {
  g.fillStyle(0x2e9a58);
  g.fillRoundedRect(cx - 13 * s, cy - 9 * s, 26 * s, 18 * s, 4 * s);
  g.fillStyle(0x58d68a);
  g.fillRoundedRect(cx - 13 * s, cy - 9 * s, 26 * s, 5 * s, { tl: 4 * s, tr: 4 * s, bl: 0, br: 0 });
  g.fillStyle(0xffffff);
  g.fillRect(cx - 9 * s, cy - 1 * s, 9 * s, 2 * s);
  g.fillRect(cx - 9 * s, cy + 3 * s, 7 * s, 2 * s);
  g.fillStyle(0xe8f8ee);
  g.fillCircle(cx + 6 * s, cy + 2 * s, 3.5 * s);
}

// Thẻ Huấn luyện viên (phím T / nút Thẻ HLV): tên, thời gian chơi, ngày bắt đầu, tổng số Pokémon, số lần vô địch, xếp hạng
// (chưa có: "-"), hình nhân vật trên bục giữa 4 ô phụ kiện (nón, áo, quần, cánh: để gán sau, xem COSMETIC_SLOTS), tiền; đã nhận Hộp huy hiệu (quà của mẹ) thì thêm số huy hiệu và 8 ô huy hiệu (chưa có thì bóng
// đen, rê chuột xem tên). Đóng: Esc / X / T / bấm ✕ hoặc ra ngoài.
// playerKey: texture nhân vật đang dùng (WorldScene.playerTexture).
// other: thẻ của người chơi khác (meta trong online/presence.js): chỉ tên, thời gian chơi, ngày bắt đầu và hình nhân vật;
// không có huy hiệu, tiền, Pokédex, số Pokémon (người khác xem thẻ của mình cũng vậy)
export function showTrainerCard(scene, router, playerKey, { other = null } = {}) {
  const { width, height } = scene.scale;
  // Chưa nhận Hộp huy hiệu: thẻ không có phần huy hiệu (thấp như thẻ người khác)
  const badges = !other && itemCount('badgeCase') > 0;
  const H = badges ? FULL_H : 230;
  const x0 = Math.round(width / 2 - W / 2);
  const y0 = Math.round(height / 2 - H / 2) - 20;
  const c = scene.add.container(0, 0).setDepth(130);
  const add = (o) => {
    c.add(o);
    return o;
  };
  // nền mờ phía sau
  add(scene.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0).setInteractive());
  drawCard(scene, add, x0, y0, H, playerKey, { other, badges });
  c.setScrollFactor(0);
  c.list.forEach((o) => o.setScrollFactor?.(0));
  followCenter(scene, [c]); // màn hình đổi cỡ lúc đang xem: dời theo giữa màn hình

  return new Promise((resolve) => {
    const openedAt = performance.now();
    const close = () => {
      router.clear();
      c.destroy();
      resolve();
    };
    const [btn, zone] = closeButton(scene, x0 + W - 28, y0 + 26, close, 30);
    for (const o of [btn, zone]) c.add(o.setScrollFactor(0));
    router.set(
      (e) => e.timeStamp >= openedAt && (isCancel(e) || matches(e, 'trainer')) && close(),
      (p) => {
        if (p.downTime < openedAt) return;
        const inside = p.x >= x0 && p.x <= x0 + W && p.y >= y0 && p.y <= y0 + H;
        if (!inside) close();
      },
    );
  });
}

// Vẽ nội dung thẻ (khung, tiêu đề, thông tin, nhân vật, tiền, huy hiệu) với mép trên trái ở (x0, y0), cao H.
// add(o): thêm vào container của thẻ
function drawCard(scene, add, x0, y0, H, playerKey, { other, badges }) {
  const g = add(scene.add.graphics());
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x0 + 4, y0 + 6, W, H, 14);
  g.fillStyle(PANEL, 0.98);
  g.fillRoundedRect(x0, y0, W, H, 14);
  g.lineStyle(2, LINE);
  g.strokeRoundedRect(x0 + 1, y0 + 1, W - 2, H - 2, 13);
  // tiêu đề
  g.fillStyle(0x1a1f2e);
  g.fillRoundedRect(x0, y0, W, 52, { tl: 14, tr: 14, bl: 0, br: 0 });
  drawCardIcon(g, x0 + 34, y0 + 26, 1.15);
  add(scene.add.text(x0 + 62, y0 + 26, 'Thẻ Huấn luyện viên', textStyle(22, '#e8ecf6', { fontStyle: 'bold' })).setOrigin(0, 0.5));

  // cột thông tin bên trái
  const infoW = 300;
  g.fillStyle(INNER);
  g.fillRoundedRect(x0 + 16, y0 + 64, infoW, 150, 10);
  const party = state.party.length;
  const boxed = state.storage.filter(Boolean).length;
  const rows = other ? [
    ['Tên', other.name || 'Người chơi'],
    ['Thời gian chơi', playTime(other.playTime ?? 0)],
    ['Ngày bắt đầu', dateText(other.startedAt)],
  ] : [
    ['Tên', playerName()],
    ['Thời gian chơi', playTime(state.playTime ?? 0)],
    ['Ngày bắt đầu', dateText(state.startedAt)],
    ['Tổng Pokémon', String(party + boxed)],
    ['Vô địch Liên minh', state.hallOfFame.length ? `${state.hallOfFame.length} lần` : 'Chưa'],
    ['Xếp hạng', '-'],
  ];
  rows.forEach(([k, v], i) => {
    const y = y0 + 78 + i * 22;
    add(scene.add.text(x0 + 28, y, k, textStyle(15, LABEL, { fontStyle: 'bold' })));
    add(scene.add.text(x0 + 16 + infoW - 12, y, v, textStyle(15, VALUE, { fontStyle: 'bold' })).setOrigin(1, 0));
  });

  // nhân vật đứng trên bục
  const px = x0 + 16 + infoW + 96;
  g.fillStyle(0x3a6ab0, 0.5);
  g.fillEllipse(px, y0 + 196, 120, 28);
  g.fillStyle(0xbfe0ff, 0.85);
  g.fillEllipse(px, y0 + 192, 104, 20);
  if (playerKey && scene.textures.exists(playerKey)) add(scene.add.image(px, y0 + 194, playerKey, 'down-stand').setOrigin(0.5, 1).setScale(1.7));
  // 4 ô phụ kiện hai bên nhân vật (ô trống, không chữ). Sau này gán đồ trong ngăn Phụ kiện vào đây
  COSMETIC_SLOTS.forEach((_slot, i) => {
    const sx = px + (i % 2 ? 50 : -50 - SLOT);
    const sy = y0 + 70 + Math.floor(i / 2) * (SLOT + 10);
    g.fillStyle(INNER);
    g.fillRoundedRect(sx, sy, SLOT, SLOT, 8);
    g.lineStyle(1.5, LINE);
    g.strokeRoundedRect(sx + 0.5, sy + 0.5, SLOT - 1, SLOT - 1, 8);
  });

  // Thẻ của mình: thêm tiền; có Hộp huy hiệu thì thêm số huy hiệu và khung huy hiệu
  if (!other) {
    // cột tiền bên phải
    const rx = x0 + W - 124;
    g.fillStyle(INNER);
    g.fillRoundedRect(rx, y0 + 64, 108, 150, 10);
    add(scene.add.text(rx + 12, y0 + 76, 'Tiền', textStyle(15, LABEL, { fontStyle: 'bold' })));
    add(scene.add.text(rx + 12, y0 + 98, formatMoney(state.money), textStyle(17, '#ffd860', { fontStyle: 'bold' })));
  }
  if (badges) {
    const rx = x0 + W - 124;
    add(scene.add.text(rx + 12, y0 + 132, 'Huy hiệu', textStyle(15, LABEL, { fontStyle: 'bold' })));
    add(scene.add.text(rx + 12, y0 + 154, `${state.badges.size} / ${BADGE_COUNT}`, textStyle(17, VALUE, { fontStyle: 'bold' })));

    // khung huy hiệu
    const by = y0 + 226;
    g.fillStyle(INNER);
    g.fillRoundedRect(x0 + 16, by, W - 32, 138, 10);
    add(scene.add.text(x0 + 30, by + 10, 'HUY HIỆU', textStyle(15, '#8a94b0', { fontStyle: 'bold' })));
    const tip = scene.add.text(0, 0, '', textStyle(14, '#ffffff', { fontStyle: 'bold', backgroundColor: 'rgba(10,14,26,0.95)', padding: { x: 8, y: 4 } }))
      .setOrigin(0.5, 1).setVisible(false);
    const step = (W - 32 - 40) / BADGE_COUNT;
    BADGES.forEach((badge, i) => {
      const cx = x0 + 16 + 20 + step * i + step / 2;
      const cy = by + 82;
      const owned = state.badges.has(badge.id);
      g.fillStyle(0xffffff, owned ? 0.12 : 0.05);
      g.fillCircle(cx, cy, 26);
      const icon = add(scene.add.image(cx, cy, `badge-${badge.id}`).setScale(1.5 * iconUnit(scene, `badge-${badge.id}`)));
      if (!owned) icon.setTintFill(0x080a12).setAlpha(0.75);
      const zone = add(scene.add.zone(cx, cy, 54, 54).setInteractive());
      zone.on('pointerover', () => tip.setText(owned ? `${badge.name} • ${badge.town}` : '???').setPosition(cx, cy - 30).setVisible(true));
      zone.on('pointerout', () => tip.setVisible(false));
    });
    add(tip);
  }
}

// Thẻ Huấn luyện viên của mình dạng cửa sổ nổi trên bản đồ (ui/Windows.js): kéo dải tiêu đề để dời, ✕ / phím quay lại /
// phím Thẻ HLV để đóng, mở song song với túi đồ / cửa sổ khác
export function openTrainerCardWindow(manager, playerKey) {
  const { scene } = manager;
  const badges = itemCount('badgeCase') > 0;
  const H = badges ? FULL_H : 230;
  const x0 = 480 - W / 2;
  const y0 = Math.round(360 - H / 2) - 20;
  const win = new FloatWindow(manager, {
    id: 'trainer', rect: { x: x0, y: y0, w: W, h: H }, dragRect: { x: x0, y: y0, w: W - 56, h: 52 },
    // Phím Thẻ HLV do bản đồ bật / tắt (WorldScene.openTrainerCard); ở đây chỉ nhận phím quay lại
    onKey: (e) => isCancel(e) && win.close(),
  });
  const add = (o) => win.add(o);
  drawCard(scene, add, x0, y0, H, playerKey, { other: null, badges });
  closeButton(scene, x0 + W - 28, y0 + 26, () => win.close(), 30).forEach(add);
  return manager.open(win);
}
