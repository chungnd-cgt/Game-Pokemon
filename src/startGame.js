import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { applyFpsLimit, applyScreenSize } from './game/display.js';
import { state } from './game/state.js';
import BattleScene from './scenes/BattleScene.js';
import BootScene from './scenes/BootScene.js';
import MartScene from './scenes/MartScene.js';
import PokedexScene from './scenes/PokedexScene.js';
import RegionMapScene from './scenes/RegionMapScene.js';
import SummaryScene from './scenes/SummaryScene.js';
import TitleScene from './scenes/TitleScene.js';
import WorldScene from './scenes/WorldScene.js';
import { initTouchControls } from './ui/TouchControls.js';
import './cheats/chung.js'; // cheat tên "Chung" (gỡ: xoá dòng này + file src/cheats/chung.js)

// Khởi động game Phaser (gọi từ main.js)
export async function startGame() {
  // Chờ font tải xong để chữ trong game không bị vẽ bằng font dự phòng
  await Promise.all([
    document.fonts.load('700 20px Nunito', 'Tiếng Việt'),
    document.fonts.load('800 20px Nunito', 'Tiếng Việt'),
  ]).catch(() => {});

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    // Chuột phải = huỷ / đóng menu (Menu, Summary, bản đồ vùng): không hiện menu chuột phải của trình duyệt
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, TitleScene, WorldScene, BattleScene, PokedexScene, MartScene, SummaryScene, RegionMapScene],
  });

  // Giới hạn FPS và kích thước khung game đã chọn trong Cài đặt → Đồ hoạ; nút cảm ứng cho điện thoại (Cài đặt → Điều khiển)
  game.events.once(Phaser.Core.Events.READY, () => {
    applyFpsLimit(game);
    applyScreenSize(game);
  });
  initTouchControls();

  // Đếm thời gian chơi theo đồng hồ thật (cả lúc đánh trận, mua sắm), trừ lúc ở màn hình chính
  let lastTick = performance.now();
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    const now = performance.now();
    const seconds = Math.min(1, (now - lastTick) / 1000);
    lastTick = now;
    if (!game.scene.isActive('Title') && !game.scene.isActive('Boot')) state.playTime += seconds;
  });

  // Chỉ để debug khi chạy dev
  if (import.meta.env.DEV) window.__game = game;
  return game;
}
