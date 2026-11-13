import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config.js';
import { state } from './game/state.js';
import BattleScene from './scenes/BattleScene.js';
import BootScene from './scenes/BootScene.js';
import MartScene from './scenes/MartScene.js';
import PokedexScene from './scenes/PokedexScene.js';
import RegionMapScene from './scenes/RegionMapScene.js';
import SummaryScene from './scenes/SummaryScene.js';
import TitleScene from './scenes/TitleScene.js';
import WorldScene from './scenes/WorldScene.js';
import './cheats/chung.js'; // cheat tên "Chung" (gỡ: xoá dòng này + file src/cheats/chung.js)

// Khởi động game Phaser. Bản 2D (main.js) và bản 3D (three/main3d.js) dùng chung;
// transparent: nền trong suốt để thế giới 3D vẽ phía sau hiện ra.
export async function startGame({ transparent = false } = {}) {
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
    transparent,
    // Chuột phải = huỷ / đóng menu (Menu, Summary, bản đồ vùng): không hiện menu chuột phải của trình duyệt
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, TitleScene, WorldScene, BattleScene, PokedexScene, MartScene, SummaryScene, RegionMapScene],
  });

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
