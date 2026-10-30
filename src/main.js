import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config.js';
import BattleScene from './scenes/BattleScene.js';
import BootScene from './scenes/BootScene.js';
import MartScene from './scenes/MartScene.js';
import PokedexScene from './scenes/PokedexScene.js';
import StarterScene from './scenes/StarterScene.js';
import WorldScene from './scenes/WorldScene.js';

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
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, StarterScene, WorldScene, BattleScene, PokedexScene, MartScene],
});

// Chỉ để debug khi chạy dev
if (import.meta.env.DEV) window.__game = game;
