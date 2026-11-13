// Cài đặt người chơi, lưu riêng với bản lưu game
const KEY = 'pokemon-demo-settings-v1';

// Game luôn tự động lưu (không còn tuỳ chọn lưu tay); buổi trong ngày luôn theo đồng hồ trong game (game/clock.js)
const VERSION = 3;
const DEFAULTS = {
  version: VERSION,
  ambience: true, // ánh sáng theo buổi và thời tiết
  areaNavOpen: true, // bảng Pokémon trong khu đang mở hay thu vào cạnh phải
  questOpen: true, // khung nhiệm vụ góc phải dưới đang mở hay thu gọn chỉ còn tiêu đề
  hudMenuOpen: true, // cột nút menu bên trái (Đội hình, Túi đồ...) đang hiện hay thu lại vào nút ≡
  catchPreview: true, // đội đã đủ 6, bắt thêm thì Pokémon vào PC: hiện bảng xem nhanh (IV, tính cách, đặc tính)
  keybinds: null, // phím người chơi tự đặt { hànhĐộng: [phím chính, phím phụ] } (game/keybinds.js); null / thiếu: phím mặc định
};

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
    // Cài đặt bản cũ: bỏ tuỳ chọn tự lưu và chọn buổi cố định
    delete saved.autosave;
    delete saved.timeMode;
    return { ...DEFAULTS, ...saved, version: VERSION };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = read();

export function setSetting(key, value) {
  settings[key] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // trình duyệt chặn localStorage: cài đặt chỉ có tác dụng tới khi tải lại trang
  }
}
