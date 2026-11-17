import Phaser from 'phaser';
import greatBallUrl from '../assets/ui/greatball.svg?url';
import ballUrl from '../assets/ui/pokeball.svg?url';
import ultraBallUrl from '../assets/ui/ultraball.svg?url';
import { ITEMS } from '../data/items.js';
import { loadAllMonImages, loadMonImages } from '../gfx/monImages.js';
import { generateTextures } from '../gfx/textures.js';
import { hideLoading, setLoading } from '../ui/loading.js';
import { TITLE_MONS } from './TitleScene.js';

// Hình Pokémon, ưu tiên theo thứ tự:
//  1. src/assets/pokemon/<id>.png (và <id>-back.png): sprite thật do bạn thêm vào
//  2. src/assets/pokemon-svg/<id>.svg: hình vector có sẵn (gfx/monImages.js: nạp ngầm, không chặn lúc khởi động)
//  3. hình vẽ tạm bằng code (gfx/textures.js)
const PNG_SPRITES = import.meta.glob('../assets/pokemon/*.png', { eager: true, query: '?url', import: 'default' });

const keyOf = (path, ext) => `mon-${path.split('/').pop().replace(ext, '')}`;

// Hình cần có trước khi hiện màn hình chính: 3 Pokémon trên màn hình chính, loài làm icon thú cưỡi (itemIcons)
const FIRST_MONS = [...TITLE_MONS.map(([id]) => id), ...Object.values(ITEMS).filter((i) => i.mount).map((i) => i.species)];

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
    this.load.svg('ball', ballUrl, { width: 96, height: 96 });
    this.load.svg('ball-great', greatBallUrl, { width: 96, height: 96 });
    this.load.svg('ball-ultra', ultraBallUrl, { width: 96, height: 96 });
    this.load.on('progress', (v) => setLoading('Đang tải…', v * 0.3));
  }

  async create() {
    for (const key of this.pngKeys) {
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    // Sprite PNG thật thì không chuyển sang pixel nữa (xem pixelMon)
    this.registry.set('pngSprites', this.pngKeys);
    const first = FIRST_MONS.map((id) => `mon-${id}`).filter((k) => !this.pngKeys.includes(k));
    await loadMonImages(first, (done, total) => setLoading('Đang tải…', 0.3 + (0.4 * done) / total));
    setLoading('Đang chuẩn bị…', 0.75);
    // Cho trình duyệt vẽ chữ "Đang chuẩn bị" trước khi vẽ texture (mất chừng một giây trên điện thoại)
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    generateTextures(this);
    // Phần hình Pokémon còn lại nạp ngầm trong lúc người chơi ở màn hình chính
    loadAllMonImages(this.pngKeys);
    this.scene.start('Title');
    hideLoading();
  }
}
