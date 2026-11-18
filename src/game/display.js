import { GAME_HEIGHT, GAME_WIDTH, MAX_WIDTH } from '../config.js';
import { settings } from './settings.js';

// Hiển thị: độ phân giải, giới hạn khung hình / giây và toàn màn hình (Cài đặt → Đồ hoạ)

// Độ phân giải (Cài đặt → Đồ hoạ, danh sách xổ xuống):
//  'screen' (Theo màn hình, mặc định): game lấp kín cửa sổ trình duyệt / màn hình, không viền đen
//  'WxH': khung game đúng cỡ đó (tỉ lệ theo cỡ đó); cửa sổ nhỏ hơn thì thu nhỏ cho vừa, lớn hơn thì có viền đen
// Game luôn cao 720 (chữ, nút giữ đúng cỡ), rộng theo tỉ lệ: 4:3 -> 960 ... 21:9 -> 1680 (rộng hơn nữa thì có viền đen)
export const RESOLUTIONS = [
  'screen',
  '1280x720', '1366x768', '1600x900', '1920x1080', '2560x1440', '3840x2160', // 16:9
  '1280x800', '1440x900', '1680x1050', '1920x1200', // 16:10
  '2560x1080', '3440x1440', // 21:9
  '1024x768', // 4:3
];
const ASPECT_NAMES = { '16:9': [16, 9], '16:10': [16, 10], '21:9': [21, 9], '4:3': [4, 3] };

const parse = (res) => {
  const m = /^(\d+)x(\d+)$/.exec(res ?? '');
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
};

// Nhãn trong danh sách, vd "1920 × 1080 (16:9)"
export function resolutionLabel(res) {
  const size = parse(res);
  if (!size) return 'Theo màn hình';
  const ratio = size.w / size.h;
  const name = Object.keys(ASPECT_NAMES).find((k) => Math.abs(ASPECT_NAMES[k][0] / ASPECT_NAMES[k][1] - ratio) < 0.04);
  return `${size.w} × ${size.h}${name ? `  ${name}` : ''}`;
}

const MIN_ASPECT = GAME_WIDTH / GAME_HEIGHT;
const MAX_ASPECT = MAX_WIDTH / GAME_HEIGHT;

// Cỡ game (toạ độ trong game) cho độ phân giải đang chọn
export function gameSizeFor(res = settings.resolution) {
  const size = parse(res);
  const aspect = size ? size.w / size.h : window.innerWidth / Math.max(1, window.innerHeight);
  const clamped = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
  // Rộng chẵn: khung thiết kế 960 nằm giữa đúng pixel
  return { width: Math.round((GAME_HEIGHT * clamped) / 2) * 2, height: GAME_HEIGHT };
}

// Áp độ phân giải: đổi cỡ game (Phaser báo sự kiện resize, các màn hình tự bố trí lại) và cỡ hiển thị tối đa
export function applyResolution(game, res = settings.resolution) {
  const scale = game?.scale;
  if (!scale?.displaySize) return;
  const size = parse(res);
  scale.displaySize.setMax(size?.w ?? Number.MAX_VALUE, size?.h ?? Number.MAX_VALUE);
  const { width, height } = gameSizeFor(res);
  if (scale.width !== width || scale.height !== height) scale.setGameSize(width, height);
  else scale.refresh();
}

// Theo màn hình: đổi cỡ cửa sổ, xoay điện thoại, bật / tắt toàn màn hình thì tính lại cỡ game (chờ cửa sổ thôi đổi cỡ)
export function watchResolution(game) {
  let timer = null;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(() => applyResolution(game), 120);
  };
  window.addEventListener('resize', later);
  window.visualViewport?.addEventListener('resize', later);
  document.addEventListener('fullscreenchange', later);
}

export const FPS_STOPS = [30, 60, 0]; // 0 = theo tần số quét màn hình (không giới hạn)

// Đổi giới hạn FPS lúc game đang chạy. Phaser chỉ đọc giới hạn khi vòng lặp khởi động (TimeStep.wake), nên đặt lại các
// trường rồi cho vòng lặp ngủ / thức lại. Chừa 2ms dung sai: khung hình 60Hz dài 16,6ms lúc ngắn lúc dài, đặt đúng
// 1000/60 thì cứ vài khung lại bị bỏ (tụt xuống 30)
export function applyFpsLimit(game, fps = settings.fpsLimit) {
  const loop = game?.loop;
  if (!loop) return;
  const limit = FPS_STOPS.includes(fps) ? fps : 0;
  loop.fpsLimit = limit;
  loop.hasFpsLimit = limit > 0;
  loop._limitRate = limit > 0 ? 1000 / limit - 2 : 0;
  if (loop.running) {
    loop.sleep();
    loop.wake(true);
  }
}

// Toàn màn hình cho cả trang (không chỉ canvas) để nút cảm ứng (nằm ngoài khung game) vẫn hiện.
// iPhone (Safari) không cho trang web toàn màn hình: available = false
const root = () => document.documentElement;
export const fullscreen = {
  get available() {
    return Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  },
  get active() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  },
  // Phải gọi trong lúc người chơi vừa bấm (trình duyệt chặn nếu không)
  async set(on) {
    if (!this.available || on === this.active) return;
    try {
      if (on) {
        const el = root();
        await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.());
        // Điện thoại: khoá màn hình nằm ngang khi toàn màn hình (máy không hỗ trợ thì thôi)
        await screen.orientation?.lock?.('landscape').catch(() => {});
      } else {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      }
    } catch {
      // trình duyệt từ chối (không phải do người chơi bấm, hoặc bị chặn): giữ nguyên
    }
  },
};
