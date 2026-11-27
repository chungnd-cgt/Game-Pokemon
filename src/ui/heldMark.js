// Dấu "đang cầm vật phẩm": thẻ vuông nhỏ màu vàng, viền nâu sẫm, một vạch đỏ nằm ngang chính giữa (như thẻ hàng).
// Dùng chung cho cột đội hình (ui/PartyPanel.js: Pokémon đang cầm đồ) và bảng Pokémon khu vực (ui/AreaNav.js: loài có thể
// cầm sẵn vật phẩm khi gặp ngoài tự nhiên). Vẽ vào Graphics g, tâm (cx, cy), cạnh size px (mặc định 9)
export const HELD_MARK = { fill: 0xffd23a, light: 0xfff0a0, stripe: 0xe03a2a, ink: 0x5a3200 };

export function drawHeldMark(g, cx, cy, size = 9) {
  const s = Math.max(5, Math.round(size));
  const x = Math.round(cx - s / 2);
  const y = Math.round(cy - s / 2);
  const band = Math.max(2, Math.round(s / 4));
  g.fillStyle(0x000000, 0.35);
  g.fillRect(x + 1, y + 1, s + 2, s + 2);
  g.fillStyle(HELD_MARK.ink, 1);
  g.fillRect(x - 1, y - 1, s + 2, s + 2);
  g.fillStyle(HELD_MARK.fill, 1);
  g.fillRect(x, y, s, s);
  g.fillStyle(HELD_MARK.light, 1);
  g.fillRect(x, y, s, 1);
  g.fillStyle(HELD_MARK.stripe, 1);
  g.fillRect(x, Math.round(y + (s - band) / 2), s, band);
  return g;
}

// Tiện dụng: tạo Graphics có dấu ở (cx, cy)
export const heldMark = (scene, cx, cy, size = 9) => drawHeldMark(scene.add.graphics(), cx, cy, size);
