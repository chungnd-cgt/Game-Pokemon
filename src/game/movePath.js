// Người chơi khác đi lại (scenes/worldPlayers.js): tin 'move' (online/presence.js) gồm chỗ đứng mới + path (các ô đã đi
// qua). Đổi thành danh sách bước để đi từng ô một: { x, y } là bước sang ô kề bên, { x, y, jump: true } là hiện luôn ở ô
// đó (vào cửa, dịch chuyển, lỡ mất tin nên hụt đoạn giữa).

const FILL_MAX = 4; // tin không có path (bản cũ / chỗ đứng trong presence): xa tới chừng này ô thì tự đi thẳng tới

const isCell = (c) => c && Number.isInteger(c.x) && Number.isInteger(c.y);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Đi từ a tới b theo hàng ngang trước rồi dọc (không gồm a)
function fill(a, b) {
  const out = [];
  let { x, y } = a;
  while (x !== b.x) out.push({ x: (x += Math.sign(b.x - x)), y });
  while (y !== b.y) out.push({ x, y: (y += Math.sign(b.y - y)) });
  return out;
}

// from: ô đã biết lần cuối của người đó. msg: { x, y, path?: [[x, y], ...] }. Trả về các bước tiếp theo
export function planSteps(from, msg) {
  const hasPath = Array.isArray(msg.path);
  const cells = [...(hasPath ? msg.path : []).map((p) => ({ x: p?.[0], y: p?.[1] })), { x: msg.x, y: msg.y }].filter(isCell);
  const steps = [];
  let last = from;
  for (const c of cells) {
    if (!isCell(last)) steps.push({ ...c, jump: true });
    else {
      const d = dist(last, c);
      if (d === 0) continue;
      if (d === 1) steps.push({ x: c.x, y: c.y });
      else if (!hasPath && d <= FILL_MAX) steps.push(...fill(last, c));
      else steps.push({ x: c.x, y: c.y, jump: true });
    }
    last = c;
  }
  return steps;
}

// Hàng đợi bước quá dài (mạng chập chờn, tin đến dồn): bỏ bớt, hiện luôn ở gần cuối rồi đi nốt vài bước
export function trimQueue(queue, max = 10, keep = 3) {
  if (queue.length <= max) return queue;
  const rest = queue.slice(-keep);
  return [{ ...rest[0], jump: true }, ...rest.slice(1)];
}

// Hướng mặt khi bước từ a sang b
export function stepFacing(a, b, fallback = 'down') {
  if (b.x > a.x) return 'right';
  if (b.x < a.x) return 'left';
  if (b.y > a.y) return 'down';
  if (b.y < a.y) return 'up';
  return fallback;
}
