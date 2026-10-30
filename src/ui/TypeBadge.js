import { TYPES } from '../data/types.js';
import { shade, textStyle } from './helpers.js';

// Huy hiệu hệ bo tròn. Trả về container, gốc toạ độ ở mép trái - giữa.
export function typeBadge(scene, x, y, type, { size = 20, label = TYPES[type].name } = {}) {
  const color = TYPES[type].color;
  const text = scene.add.text(0, 0, label, textStyle(size, '#ffffff', {
    fontStyle: 'bold',
    stroke: `#${shade(color, -45).toString(16).padStart(6, '0')}`,
    strokeThickness: 4,
  })).setOrigin(0.5);
  const w = text.width + size * 1.1;
  const h = size * 1.6;
  const g = scene.add.graphics();
  g.fillStyle(shade(color, -30));
  g.fillRoundedRect(-w / 2, -h / 2 + 2, w, h, h / 2);
  g.fillStyle(color);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const badge = scene.add.container(x + w / 2, y, [g, text]);
  badge.badgeWidth = w;
  return badge;
}

// Một hàng huy hiệu cho 1-2 hệ. align 'left' tính từ x, 'center' canh giữa tại x.
export function typeBadges(scene, x, y, types, { size = 20, gap = 8, align = 'left' } = {}) {
  const badges = types.map((t) => typeBadge(scene, 0, y, t, { size }));
  const total = badges.reduce((s, b) => s + b.badgeWidth, 0) + gap * (badges.length - 1);
  let cursor = align === 'center' ? x - total / 2 : x;
  for (const b of badges) {
    b.x = cursor + b.badgeWidth / 2;
    cursor += b.badgeWidth + gap;
  }
  return badges;
}
