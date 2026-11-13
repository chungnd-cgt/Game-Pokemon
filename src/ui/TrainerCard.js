import { BADGES, BADGE_COUNT } from '../data/badges.js';
import { formatMoney } from '../data/items.js';
import { DEX } from '../data/pokedex.js';
import { playerName, state } from '../game/state.js';
import { closeButton, textStyle } from './helpers.js';
import { isCancel } from './input.js';

const W = 640;
const H = 380;
const PANEL = 0x262c3e;
const INNER = 0x1c2131;
const LINE = 0x3e4660;
const LABEL = '#c8d0e8';
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

// Thẻ Huấn luyện viên (phím T / nút Thẻ HLV): tên, thời gian chơi, ngày bắt đầu, tổng số Pokémon, Pokédex, số lần vô địch,
// hình nhân vật trên bục, 8 ô huy hiệu (chưa có thì bóng đen, rê chuột xem tên), tiền. Đóng: Esc / X / T / bấm ✕ hoặc ra ngoài.
// playerKey: texture nhân vật đang dùng (WorldScene.playerTexture)
export function showTrainerCard(scene, router, playerKey) {
  const { width, height } = scene.scale;
  const x0 = Math.round(width / 2 - W / 2);
  const y0 = Math.round(height / 2 - H / 2) - 20;
  const c = scene.add.container(0, 0).setDepth(130);
  const add = (o) => {
    c.add(o);
    return o;
  };
  // nền mờ phía sau
  add(scene.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0).setInteractive());
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
  const rows = [
    ['Tên', playerName()],
    ['Thời gian chơi', playTime(state.playTime ?? 0)],
    ['Ngày bắt đầu', dateText(state.startedAt)],
    ['Tổng Pokémon', `${party + boxed}  (đội ${party}, PC ${boxed})`],
    ['Pokédex', `đã bắt ${state.dex.caught.size} / đã gặp ${state.dex.seen.size} / ${DEX.length}`],
    ['Vô địch Liên minh', state.hallOfFame.length ? `${state.hallOfFame.length} lần` : 'Chưa'],
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

  // cột tiền bên phải
  const rx = x0 + W - 124;
  g.fillStyle(INNER);
  g.fillRoundedRect(rx, y0 + 64, 108, 150, 10);
  add(scene.add.text(rx + 12, y0 + 76, 'Tiền', textStyle(15, LABEL, { fontStyle: 'bold' })));
  add(scene.add.text(rx + 12, y0 + 98, formatMoney(state.money), textStyle(17, '#ffd860', { fontStyle: 'bold' })));
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
    const icon = add(scene.add.image(cx, cy, `badge-${badge.id}`).setScale(1.5));
    if (!owned) icon.setTintFill(0x080a12).setAlpha(0.75);
    const zone = add(scene.add.zone(cx, cy, 54, 54).setInteractive());
    zone.on('pointerover', () => tip.setText(owned ? `${badge.name} • ${badge.town}` : '???').setPosition(cx, cy - 30).setVisible(true));
    zone.on('pointerout', () => tip.setVisible(false));
  });
  add(tip);
  c.setScrollFactor(0);
  c.list.forEach((o) => o.setScrollFactor?.(0));

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
      (e) => e.timeStamp >= openedAt && (isCancel(e) || e.code === 'KeyT') && close(),
      (p) => {
        if (p.downTime < openedAt) return;
        const inside = p.x >= x0 && p.x <= x0 + W && p.y >= y0 && p.y <= y0 + H;
        if (!inside) close();
      },
    );
  });
}
