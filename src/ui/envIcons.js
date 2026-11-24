// Biểu tượng nhỏ (~14px) vẽ bằng code cho dòng "Nơi xuất hiện" trong Pokédex (ui/dex/DexDetail.js):
// 'grass' bụi cỏ (cả trong hang), 'water' sóng nước (cả câu cá), 'day' mặt trời, 'dusk' mặt trời lặn, 'night' trăng.
// on = false: vẽ mờ (không xuất hiện ở đó / buổi đó)
const COLORS = { grass: 0x6cc850, water: 0x4aa0f0, day: 0xffd040, dusk: 0xff9a50, night: 0xb8c8ff };

export function drawEnvIcon(g, kind, cx, cy, on) {
  const color = on ? COLORS[kind] : 0x4a5470;
  const a = on ? 1 : 0.7;
  if (kind === 'grass') {
    g.fillStyle(color, a);
    g.fillTriangle(cx - 6, cy + 6, cx - 3, cy - 5, cx - 1, cy + 6);
    g.fillTriangle(cx - 2, cy + 6, cx + 1, cy - 7, cx + 3, cy + 6);
    g.fillTriangle(cx + 2, cy + 6, cx + 6, cy - 3, cx + 6, cy + 6);
  } else if (kind === 'water') {
    g.lineStyle(2, color, a);
    for (const dy of [-3, 3]) {
      g.beginPath();
      g.moveTo(cx - 7, cy + dy);
      for (let i = 1; i <= 8; i++) g.lineTo(cx - 7 + i * 1.75, cy + dy + Math.sin((i / 8) * Math.PI * 2) * 2);
      g.strokePath();
    }
  } else if (kind === 'day') {
    g.fillStyle(color, a);
    g.fillCircle(cx, cy, 3.6);
    g.lineStyle(1.6, color, a);
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      g.lineBetween(cx + Math.cos(t) * 5, cy + Math.sin(t) * 5, cx + Math.cos(t) * 7, cy + Math.sin(t) * 7);
    }
  } else if (kind === 'dusk') {
    g.fillStyle(color, a);
    g.slice(cx, cy + 3, 6, Math.PI, 0, false);
    g.fillPath();
    g.lineStyle(1.6, color, a);
    g.lineBetween(cx - 7, cy + 4.5, cx + 7, cy + 4.5);
  } else if (kind === 'night') {
    // Trăng lưỡi liềm: vẽ đúng hình liềm (không chồng hình tròn tối lên, kẻo thành chấm đen trên nền khác màu)
    g.fillStyle(color, a);
    g.fillPoints(crescent(cx, cy, 6, cx + 3, cy - 2, 5), true);
  }
}

// Đa giác hình liềm: phần của đường tròn (cx, cy, r1) nằm ngoài đường tròn (ox, oy, r2)
function crescent(cx, cy, r1, ox, oy, r2, n = 18) {
  const dx = ox - cx;
  const dy = oy - cy;
  const d = Math.hypot(dx, dy);
  const k = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - k * k));
  const mx = cx + (k * dx) / d;
  const my = cy + (k * dy) / d;
  const p1 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  const p2 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const away = Math.atan2(-dy, -dx); // phía xa hình tròn che
  const arc = (x0, y0, r, from, to) => {
    const a0 = Math.atan2(from.y - y0, from.x - x0);
    const a1 = Math.atan2(to.y - y0, to.x - x0);
    const norm = (v) => ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let span = norm(a1 - a0);
    let dir = 1;
    if (norm(away - a0) > span) {
      dir = -1;
      span = Math.PI * 2 - span;
    }
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = a0 + (dir * span * i) / n;
      return { x: x0 + Math.cos(t) * r, y: y0 + Math.sin(t) * r };
    });
  };
  return [...arc(cx, cy, r1, p1, p2), ...arc(ox, oy, r2, p2, p1)];
}
