// Nới rộng một bản đồ trong nhà cho kín màn hình (game cao 15 ô, rộng tới 35 ô ở màn 21:9) mà giữ nguyên phần chơi bên
// trong (gym, phòng Liên minh): thêm `left` cột bên trái, `right` cột bên phải, `bottom` hàng phía dưới.
//  - Hàng toàn tường (tường sau) thì nối dài tường; hàng khác lấy ô từ side(x, y, edge): x tính trong phần thêm
//    (0 = cột ngoài cùng, edge 'left' | 'right'), y là hàng của bản đồ. Hàng thêm phía dưới: bottomRow(y) trả cả hàng.
//  - Mọi toạ độ của chính bản đồ dịch sang phải `left` ô: đồ vật, ô dịch chuyển, tảng đá, chỗ vào, chỗ hồi phục, cửa
//    chuyển bản đồ (vị trí trên bản đồ này), biển báo, thảm, đồ treo tường.
//  - def.shiftX = left: data/map.js dịch đích (tx) của cửa chuyển bản đồ từ nơi khác dẫn vào đây; NPC trong bản đồ khai
//    báo toạ độ cộng thêm phần dịch này (vd GYM_DX, LEAGUE_DX)
//  - exitDown: thêm hàng phía dưới thì thảm cửa ra (E) dời xuống hàng cuối cùng (cùng cột), chỗ vào ngay trên thảm
export function widen(def, { left, right = left, bottom = 0, side, bottomRow, exitDown = false }) {
  const wall = (row) => /^[#Dm]+$/.test(row); // tường sau (có thể có cửa lớn D, máy hồi phục m)
  const width = def.rows[0].length + left + right;
  const pad = (n, y, edge) => Array.from({ length: n }, (_, x) => side(x, y, edge)).join('');
  let rows = def.rows.map((row, y) => (wall(row) ? '#'.repeat(left) + row + '#'.repeat(right) : pad(left, y, 'left') + row + pad(right, y, 'right')));
  for (let i = 0; i < bottom; i++) rows.push(bottomRow(def.rows.length + i, width));
  if (rows.some((r) => r.length !== width)) throw new Error(`widen: hàng lệch độ rộng (${def.name})`);
  const sx = (o) => (o ? { ...o, x: o.x + left } : o);
  const out = { ...def, rows, shiftX: left };
  if (exitDown && bottom) {
    const last = rows.length - 1;
    const exits = rows.flatMap((r, y) => (y < last ? [...r].flatMap((ch, x) => (ch === 'E' ? [x] : [])) : []));
    rows = rows.map((r, y) => (y === last ? [...r].map((ch, x) => (exits.includes(x) ? 'E' : ch)).join('') : r.replaceAll('E', '.')));
    out.rows = rows;
    if (exits.length) out.entry = { x: exits[0], y: last - 1 };
  }
  if (def.objects) out.objects = def.objects.map(sx);
  for (const key of ['pads', 'clearedPads']) if (def[key]) out[key] = def[key].map((p) => ({ ...p, x: p.x + left, tx: p.tx + left }));
  if (def.boulders) out.boulders = def.boulders.map(([x, y]) => [x + left, y]);
  if (def.entry && !(exitDown && bottom && out.entry !== def.entry)) out.entry = sx(def.entry);
  if (def.heal) out.heal = sx(def.heal);
  if (def.warps) out.warps = def.warps.map(sx);
  if (def.signs) out.signs = Object.fromEntries(Object.entries(def.signs).map(([k, v]) => {
    const [x, y] = k.split(',').map(Number);
    return [`${x + left},${y}`, v];
  }));
  if (def.rugs) out.rugs = def.rugs.map(([x1, y1, x2, y2, ...rest]) => [x1 + left, y1, x2 + left, y2, ...rest]);
  if (def.wallDecor) out.wallDecor = Object.fromEntries(Object.entries(def.wallDecor).map(([k, v]) => [Number(k) + left, v]));
  return out;
}
