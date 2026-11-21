// Nhật ký thông báo hệ thống (tab "Hệ thống" của khung góc phải dưới, ui/InfoPanel.js): thời gian còn ở Khu Safari, giao
// dịch xong / bị từ chối, lời mời giao dịch, người chơi vào / rời bản đồ, tự dùng Repel... Chỉ giữ trong phiên chơi (không
// lưu), tối đa MAX dòng gần nhất. kind: 'info' | 'good' | 'warn' | 'trade' | 'player' (màu chữ)
const MAX = 50;
const entries = [];
const listeners = new Set();

export function logSystem(text, kind = 'info', at = Date.now()) {
  const entry = { text, kind, at };
  entries.push(entry);
  if (entries.length > MAX) entries.shift();
  for (const fn of listeners) fn(entry);
  return entry;
}

export const systemLog = () => entries;
export const clearSystemLog = () => {
  entries.length = 0;
};

// Nghe dòng mới. Trả về hàm thôi nghe
export function onSystemLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// "11:07:16" theo giờ máy
export function timeLabel(at) {
  const d = new Date(at);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
