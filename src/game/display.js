import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { settings } from './settings.js';

// Hiển thị: giới hạn khung hình / giây, kích thước khung game và toàn màn hình (Cài đặt → Đồ hoạ)

// Kích thước khung game so với màn hình (cửa sổ trình duyệt):
//  fit: phóng to vừa màn hình, giữ tỉ lệ 4:3 (thừa thì có viền đen) • fill: kéo giãn lấp đầy cả màn hình (hình hơi méo)
//  • original: cỡ gốc 960x720, màn hình nhỏ hơn thì thu nhỏ cho vừa
export const SCREEN_SIZES = ['fit', 'fill', 'original'];

// Game luôn chạy chế độ FIT của Phaser; chỉ đổi cách tính cỡ hiển thị (displaySize) rồi tính lại. Phaser đổi toạ độ chuột /
// chạm theo từng trục riêng nên kéo giãn vẫn bấm đúng chỗ. Đổi cỡ cửa sổ / xoay máy thì Phaser tự tính lại theo cách đã đặt
export function applyScreenSize(game, mode = settings.screenSize) {
  const scale = game?.scale;
  if (!scale?.displaySize) return;
  const size = SCREEN_SIZES.includes(mode) ? mode : 'fit';
  const { Size } = Phaser.Structs;
  scale.displaySize.setAspectMode(size === 'fill' ? Size.NONE : Size.FIT);
  if (size === 'original') scale.displaySize.setMax(GAME_WIDTH, GAME_HEIGHT);
  else scale.displaySize.setMax(Number.MAX_VALUE, Number.MAX_VALUE);
  scale.refresh();
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
