import { BAG_POCKETS, ITEMS, pocketOf } from '../data/items.js';

// Phần logic thuần của túi đồ (không dùng Phaser, chạy được trong test): lọc vật phẩm theo ngăn và theo chữ tìm kiếm

// Bỏ dấu tiếng Việt, chữ thường: gõ "thuoc" vẫn tìm ra "Thuốc", "xe dap" ra "Xe đạp"
export function searchKey(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Tên vật phẩm khớp chữ tìm: mọi từ gõ vào đều có trong tên (không phân biệt dấu, hoa / thường)
export function matchesQuery(name, query) {
  const q = searchKey(query);
  if (!q) return true;
  const key = searchKey(name);
  return q.split(' ').every((word) => key.includes(word));
}

// Vật phẩm hiện trong túi: có trong túi (count(id) > 0), qua bộ lọc `allow` (vd trong trận chỉ đồ dùng được khi đấu).
// Có chữ tìm thì tìm trên mọi ngăn, không thì chỉ ngăn `pocket` (chỉ số trong BAG_POCKETS). Giữ thứ tự như data/items.js
export function bagItems({ count, pocket = 0, query = '', allow = null, pockets = BAG_POCKETS }) {
  const owned = Object.keys(ITEMS).filter((id) => count(id) > 0 && (!allow || allow(id)));
  if (searchKey(query)) return owned.filter((id) => matchesQuery(ITEMS[id].name, query));
  const pid = pockets[pocket]?.id;
  return owned.filter((id) => pocketOf(id) === pid);
}

// Số vật phẩm (qua bộ lọc) trong từng ngăn: ngăn trống thì tab mờ đi
export function pocketCounts({ count, allow = null, pockets = BAG_POCKETS }) {
  const owned = Object.keys(ITEMS).filter((id) => count(id) > 0 && (!allow || allow(id)));
  return pockets.map((p) => owned.filter((id) => pocketOf(id) === p.id).length);
}
