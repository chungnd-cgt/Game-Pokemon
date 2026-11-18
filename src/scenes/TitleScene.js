import Phaser from 'phaser';
import { formatMoney } from '../data/items.js';
import { MAPS, SPAWN, resumePosition } from '../data/map.js';
import { deleteSave, loadGame, saveSummary } from '../game/save.js';
import { DEFAULT_NAMES, resetState, state } from '../game/state.js';
import { monImagesReady } from '../gfx/monImages.js';
import { applyPlayerLook } from '../gfx/player.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { COLORS, closeButton, drawPanel, gradientRect, textStyle } from '../ui/helpers.js';
import { InputRouter } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';

// Màn hình chính: Tiếp tục (nếu có bản lưu) / Chơi mới (chọn giới tính + tuỳ chỉnh diện mạo, đặt tên) / Xoá dữ liệu
const NAME_MAX = 12;
// Bản đồ trong nhà trước kia thuộc Pallet, giờ thuộc Thị trấn Lục Bình (xem bước tải bản lưu)
const OLD_PALLET_SHOPS = ['center', 'mart'];
// 3 Pokémon trên màn hình chính [loài, x, lật ngang]. BootScene nạp hình các loài này trước khi hiện màn hình chính
export const TITLE_MONS = [['charmander', 210, false], ['pikachu', 480, false], ['squirtle', 750, true]];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    gradientRect(bg, 0, 0, width, height, 0x1d2b53, 0x3b6ea5);
    bg.lineStyle(14, 0xffffff, 0.05);
    for (const [cx, cy, r] of [[110, 600, 170], [870, 140, 130]]) {
      bg.strokeCircle(cx, cy, r);
      bg.lineBetween(cx - r, cy, cx + r, cy);
      bg.strokeCircle(cx, cy, r * 0.28);
    }

    this.add.text(width / 2, 70, 'Pokémon', textStyle(84, '#ffe066', { fontStyle: 'bold', stroke: '#2a4a9a', strokeThickness: 14 })).setOrigin(0.5);
    this.add.text(width / 2, 140, 'PHIÊN BẢN DEMO', textStyle(24, '#c8d8ff', { fontStyle: 'bold' })).setOrigin(0.5);
    this.add.text(width / 2, 176, 'Hành trình vùng Sơn Thủy', textStyle(22, '#ffffff')).setOrigin(0.5);

    for (const [id, x, flip] of TITLE_MONS) {
      const key = pixelMon(this, id);
      const sprite = this.add.image(x, 400, key).setOrigin(0.5, 1).setScale(fitScale(this, key, 192)).setFlipX(flip);
      this.add.ellipse(x, 404, 140, 22, 0x000000, 0.2);
      this.tweens.add({ targets: sprite, y: 388, duration: 900 + x, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    this.router = new InputRouter(this);
    this.cameras.main.fadeIn(400);
    this.run().catch((err) => console.error('Lỗi màn hình chính:', err));
  }

  async run() {
    for (;;) {
      const summary = saveSummary();
      const items = [];
      if (summary) items.push({ label: 'Tiếp tục', value: 'continue', color: 0x40b060 });
      items.push({ label: 'Chơi mới', value: 'new', color: 0x4a88e0 });
      if (summary) items.push({ label: 'Xoá dữ liệu', value: 'delete', color: 0xc84848 });

      const info = summary ? this.showSummary(summary) : null;
      const choice = await new Menu(this, this.router, {
        x: 330, y: 420, width: 300, height: 30 + items.length * 64, variant: 'buttons', items, cancelable: false,
      }).open();
      info?.destroy();

      if (choice === 'delete') {
        if (await this.confirm('Xoá vĩnh viễn bản lưu hiện tại? Không thể khôi phục.')) deleteSave();
        continue;
      }

      if (choice === 'continue') {
        let position = null;
        try {
          position = loadGame();
        } catch (err) {
          console.error('Bản lưu bị lỗi:', err);
        }
        // Nơi hồi phục trong bản lưu không còn (bản đồ cũ đã đổi tên): về nhà khi thua / dùng Escape Rope
        if (state.lastCenter && !MAPS[state.lastCenter.map]) state.lastCenter = null;
        // Bản lưu cũ: Pokémon Center / Poké Mart trước kia ở Pallet, giờ thuộc Thị trấn Lục Bình. Chưa tới Lục Bình thì
        // không tỉnh dậy / đứng ở đó (đi tắt qua cổng Pallet): thua thì về nhà, đang đứng trong cửa hàng thì ra Pallet
        if (!state.visited.has('town1')) {
          if (OLD_PALLET_SHOPS.includes(state.lastCenter?.map)) state.lastCenter = null;
          if (OLD_PALLET_SHOPS.includes(position?.map)) position = { map: 'route1', x: 13, y: 11, facing: 'down' };
        }
        if (position) {
          applyPlayerLook(this, state.player);
          const start = resumePosition(position);
          this.go({ position: start });
          return;
        }
        const warn = this.add.text(480, 412, 'Bản lưu bị lỗi, không tải được. Hãy chọn Chơi mới.', textStyle(18, '#ffb0b0')).setOrigin(0.5);
        this.time.delayedCall(3000, () => warn.destroy());
        continue;
      }
      if (!summary || (await this.confirm('Bản lưu cũ sẽ bị xoá. Chơi lại từ đầu?'))) {
        const player = await this.createCharacter();
        if (!player) continue;
        deleteSave();
        resetState();
        state.player = player;
        applyPlayerLook(this, state.player);
        this.go({ position: SPAWN, newGame: true });
        return;
      }
    }
  }

  // Khung thông tin bản lưu bên cạnh nút Tiếp tục
  showSummary(s) {
    const c = this.add.container(0, 0);
    c.add(drawPanel(this, 660, 420, 270, 150, 16, true));
    const minutes = Math.floor(s.playTime / 60);
    const lead = s.lead ? `${s.lead.name} Lv${s.lead.level}` : 'Chưa có Pokémon';
    c.add(this.add.text(684, 440, s.name ? `Bản lưu của ${s.name}` : 'Bản lưu', textStyle(18, '#8a92a6', { fontStyle: 'bold' })));
    c.add(this.add.text(684, 468, [
      lead,
      `Pokédex: ${s.caught}   •   ${formatMoney(s.money)}`,
      `Đã chơi: ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`,
    ].join('\n'), textStyle(17, COLORS.text, { lineSpacing: 6 })));
    return c;
  }

  // Chơi mới: bảng tuỳ chỉnh nhân vật (giới tính + diện mạo, ui/CharacterCreator.js) rồi đặt tên.
  // Trả về { name, gender, look }, hoặc null nếu huỷ. Quay lại từ ô đặt tên thì về bảng tuỳ chỉnh (lựa chọn vẫn giữ)
  async createCharacter() {
    let current = { gender: 'male' };
    for (;;) {
      const { gender, ...look } = current;
      const creator = new CharacterCreator(this, this.router, { gender, look: current.hairStyle ? look : undefined });
      const picked = await creator.open();
      if (!picked) return null;
      current = picked;
      const { gender: chosen, ...chosenLook } = picked;
      const name = await this.enterName(chosen);
      if (name !== null) return { name, gender: chosen, look: chosenLook };
    }
  }

  // Ô nhập tên (ô chữ HTML đặt đè lên canvas để gõ được tiếng Việt). Để trống thì dùng tên mặc định.
  // Trả về tên, hoặc null nếu quay lại bảng tuỳ chỉnh nhân vật
  enterName(gender) {
    const c = this.add.container(0, 0).setDepth(30);
    c.add(this.add.rectangle(480, 360, 960, 720, 0x0a1430, 0.75));
    c.add(drawPanel(this, 230, 210, 500, 280, 18, true));
    c.add(this.add.text(480, 240, 'Tên của bạn là gì?', textStyle(28, COLORS.text, { fontStyle: 'bold' })).setOrigin(0.5, 0));

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.placeholder = DEFAULT_NAMES[gender];
    input.autocomplete = 'off';
    const place = () => {
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.width / this.scale.width;
      Object.assign(input.style, {
        position: 'fixed', left: `${r.left + 300 * k}px`, top: `${r.top + 300 * k}px`, width: `${360 * k}px`, height: `${54 * k}px`,
        fontSize: `${26 * k}px`, fontFamily: 'Nunito, sans-serif', fontWeight: '700', textAlign: 'center', boxSizing: 'border-box',
        border: `${3 * k}px solid #4a88e0`, borderRadius: `${12 * k}px`, outline: 'none', color: '#2a3248', background: '#ffffff', zIndex: 10,
      });
    };
    place();
    // Phaser căn lại canvas sau sự kiện resize của cửa sổ: đặt lại ô nhập tên theo vị trí mới của canvas
    const replace = () => requestAnimationFrame(place);
    window.addEventListener('resize', replace);
    this.scale.on('resize', replace);
    document.body.appendChild(input);
    input.focus();
    this.router.clear();

    let done;
    const result = new Promise((resolve) => {
      done = (value) => {
        window.removeEventListener('resize', replace);
        this.scale.off('resize', replace);
        input.remove();
        c.destroy();
        resolve(value);
      };
    });
    const ok = () => done(input.value.trim().slice(0, NAME_MAX) || DEFAULT_NAMES[gender]);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.isComposing) return;
      if (e.key === 'Enter') ok();
      else if (e.key === 'Escape' || (e.key === 'Backspace' && !input.value && !e.repeat)) done(null);
    });
    // Nút OK và nút quay lại (✕) bấm bằng chuột
    const button = (x, label, color, onClick) => {
      const g = this.add.graphics();
      g.fillStyle(color);
      g.fillRoundedRect(x - 80, 420, 160, 50, 14);
      const t = this.add.text(x, 445, label, textStyle(22, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
      const z = this.add.zone(x, 445, 160, 50).setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
      c.add([g, t, z]);
    };
    button(390, 'Quay lại', 0x8a92a6, () => done(null));
    button(570, 'Xong', 0x40b060, ok);
    c.add(closeButton(this, 700, 240, () => done(null)));
    return result;
  }

  // Hỏi lại trước khi xoá bản lưu (mặc định chọn Không)
  async confirm(question) {
    const c = this.add.container(0, 0).setDepth(30);
    c.add(this.add.rectangle(480, 360, 960, 720, 0x000000, 0.5));
    c.add(drawPanel(this, 210, 250, 540, 110, 16, true));
    c.add(this.add.text(480, 280, question, textStyle(22, COLORS.text, { wordWrap: { width: 500 }, align: 'center' })).setOrigin(0.5, 0));
    const ok = await new Menu(this, this.router, {
      x: 380, y: 370, width: 200, height: 140, depth: 40,
      items: [{ label: 'Có', value: true }, { label: 'Không', value: false }], index: 1,
    }).open();
    c.destroy();
    return ok === true;
  }

  async go(data) {
    this.router.clear();
    await this.waitForMons();
    this.cameras.main.fadeOut(400);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', data));
  }

  // Hình Pokémon nạp ngầm từ lúc mở game (gfx/monImages.js). Bấm vào game sớm quá thì chờ nốt, có hiện %
  async waitForMons() {
    let box = null;
    let label = null;
    await monImagesReady((ratio) => {
      if (ratio >= 1) return;
      if (!box) {
        box = this.add.container(0, 0).setDepth(50);
        box.add(this.add.rectangle(0, 0, 960, 720, 0x0a1430, 0.7).setOrigin(0));
        label = this.add.text(480, 360, '', textStyle(26, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
        box.add(label);
      }
      label.setText(`Đang tải hình Pokémon… ${Math.floor(ratio * 100)}%`);
    });
    box?.destroy();
  }
}
