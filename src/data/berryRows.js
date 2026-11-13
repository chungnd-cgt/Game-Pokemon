// Cây quả mọng trồng thành dãy 2-3 cây liền nhau trên một luống đất (hàng ngang, đứng ở hàng dưới hoặc trên để hái),
// rải đều dọc hành trình; vườn quả lớn (đủ quả hồi phục và quả giảm EV) ở Thành phố Lò Gốm.
// tier: cây chỉ mọc khi đủ tiến độ (story/chapter1.js: progressTier): quả tốt (Sitrus, Figy, Lum) có muộn hơn ở đầu game.
const TIER = { sitrus: 1, figy: 1, lum: 2 };

// prefix: mã bản đồ (vd 'r2'); x, y: ô của cây đầu dãy; berries: tên quả từ trái sang phải (vd ['oran', 'pecha'])
export function berryRow(prefix, x, y, berries) {
  return berries.map((b, i) => ({
    x: x + i, y, kind: 'berry', id: `${prefix}-tree-${x + i}-${y}-${b}`, berry: `${b}Berry`, tier: TIER[b] ?? 0,
  }));
}
