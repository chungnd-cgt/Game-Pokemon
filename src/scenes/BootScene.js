import Phaser from 'phaser';
import greatBallUrl from '../assets/ui/greatball.svg?url';
import ballUrl from '../assets/ui/pokeball.svg?url';
import ultraBallUrl from '../assets/ui/ultraball.svg?url';
import { generateTextures } from '../gfx/textures.js';

// Hình Pokémon, ưu tiên theo thứ tự:
//  1. src/assets/pokemon/<id>.png (và <id>-back.png): sprite thật do bạn thêm vào
//  2. src/assets/pokemon-svg/<id>.svg: hình vector có sẵn
//  3. hình vẽ tạm bằng code (gfx/textures.js)
const PNG_SPRITES = import.meta.glob('../assets/pokemon/*.png', { eager: true, query: '?url', import: 'default' });
const SVG_SPRITES = import.meta.glob('../assets/pokemon-svg/*.svg', { eager: true, query: '?url', import: 'default' });
const SVG_SIZE = 256;

const keyOf = (path, ext) => `mon-${path.split('/').pop().replace(ext, '')}`;

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.pngKeys = [];
    for (const [path, url] of Object.entries(PNG_SPRITES)) {
      const key = keyOf(path, '.png');
      this.load.image(key, url);
      this.pngKeys.push(key);
    }
    for (const [path, url] of Object.entries(SVG_SPRITES)) {
      const key = keyOf(path, '.svg');
      if (!this.pngKeys.includes(key)) this.load.svg(key, url, { width: SVG_SIZE, height: SVG_SIZE });
    }
    this.load.svg('ball', ballUrl, { width: 96, height: 96 });
    this.load.svg('ball-great', greatBallUrl, { width: 96, height: 96 });
    this.load.svg('ball-ultra', ultraBallUrl, { width: 96, height: 96 });
  }

  create() {
    for (const key of this.pngKeys) {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    generateTextures(this);
    this.scene.start('Starter');
  }
}
