// Cài đặt người chơi, lưu riêng với bản lưu game
const KEY = 'pokemon-demo-settings-v1';

// Game luôn tự động lưu (không còn tuỳ chọn lưu tay); buổi trong ngày luôn theo đồng hồ trong game (game/clock.js)
const VERSION = 4;
const DEFAULTS = {
  version: VERSION,
  lighting: true, // ánh sáng theo buổi (ngày / chiều / đêm, đèn cửa sổ, hang tối)
  weather: true, // hình ảnh thời tiết (mưa, tuyết, mưa đá, bão cát); tắt thì thời tiết vẫn có tác dụng trong trận
  sharp: true, // vẽ theo số điểm ảnh thật của màn hình (game/hires.js): sắc nét hơn, tốn card đồ hoạ hơn
  fpsLimit: 0, // giới hạn khung hình / giây: 30 / 60, 0 = theo màn hình (game/display.js)
  uiScale: 0, // cỡ giao diện trên bản đồ (game/display.js: UI_SCALES): 0 = tự động theo cỡ màn hình, 1.15 = 115%...
  resolution: 'screen', // độ phân giải (game/display.js: RESOLUTIONS): 'screen' theo màn hình | 'WxH' vd '1920x1080'
  areaNavOpen: true, // bảng Pokémon trong khu đang mở hay thu vào cạnh phải
  questOpen: true, // khung góc phải dưới (Hệ thống / Nhiệm vụ) đang mở hay thu gọn chỉ còn hàng tab
  hudTab: 'quest', // tab đang chọn của khung đó: 'quest' (Nhiệm vụ) | 'system' (Hệ thống, ui/InfoPanel.js)
  hudMenuOpen: true, // cột nút menu bên trái (Đội hình, Túi đồ...) đang hiện hay thu lại vào nút ≡
  catchPreview: true, // đội đã đủ 6, bắt thêm thì Pokémon vào PC: về bản đồ hiện bảng xem nhanh (IV, tính cách, đặc tính)
  repelAuto: true, // Repel hết hiệu lực: tự dùng thêm một cái cùng loại nếu túi còn (túi hết thì thôi)
  repelAsk: false, // Repel hết hiệu lực: dừng lại hỏi có dùng tiếp không (bật thì hỏi thay cho tự dùng)
  npcNames: true, // tên trên đầu NPC
  playerNames: true, // tên trên đầu người chơi khác
  showDpad: false, // phím chữ thập cảm ứng cố định trên màn hình (ui/DPad.js)
  touchRelative: false, // cần gạt cảm ứng tương đối: kéo quá vòng thì tâm cần gạt dời theo ngón tay (ui/Joystick.js)
  keybinds: null, // phím người chơi tự đặt { hànhĐộng: [phím chính, phím phụ] } (game/keybinds.js); null / thiếu: phím mặc định
};

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
    // Cài đặt bản cũ: bỏ tuỳ chọn tự lưu và chọn buổi cố định
    delete saved.autosave;
    delete saved.timeMode;
    // Bản 3: một tuỳ chọn chung "Ánh sáng & thời tiết", nay tách làm hai
    if (typeof saved.ambience === 'boolean') {
      saved.lighting ??= saved.ambience;
      saved.weather ??= saved.ambience;
    }
    delete saved.ambience;
    // Bản cũ: kích thước khung "Vừa màn hình / Kéo giãn / Gốc", nay là độ phân giải
    delete saved.screenSize;
    // Bản cũ: phím chữ thập + nút A / B cảm ứng, nay là cần gạt chạm-kéo trên bản đồ (không cần cài đặt)
    for (const k of ['touchControls', 'touchSize', 'touchOpacity', 'vibrate']) delete saved[k];
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
