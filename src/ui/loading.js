// Màn hình "Đang tải" bằng HTML (#loading trong index.html): hiện ngay khi mở trang, kể cả lúc file JS của game còn
// đang tải về. BootScene cập nhật chữ / thanh tiến độ rồi ẩn đi khi màn hình chính đã sẵn sàng.
const el = (id) => document.getElementById(id);

// ratio: 0..1 (bỏ trống thì giữ thanh như cũ)
export function setLoading(text, ratio) {
  const label = el('loading-text');
  if (label && text) label.textContent = text;
  const bar = el('loading-bar');
  if (bar && ratio !== undefined) bar.style.width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
}

export function hideLoading() {
  const box = el('loading');
  if (!box) return;
  box.classList.add('done');
  setTimeout(() => box.remove(), 400);
}
