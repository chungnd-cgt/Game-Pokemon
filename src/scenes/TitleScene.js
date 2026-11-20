import Phaser from 'phaser';
import { formatMoney } from '../data/items.js';
import { MAPS, SPAWN, resumePosition } from '../data/map.js';
import { clearLegacySave, deleteSave, legacySave, loadGame, setSaveOwner, summarize, writeSave } from '../game/save.js';
import { createMonster } from '../game/monster.js';
import { currentUser, fetchUsername } from '../online/account.js';
import { markDirty, startCloudSave } from '../online/cloudSave.js';
import { claimSession } from '../online/session.js';
import { clearLinkError, emailLink, supabase } from '../online/supabase.js';
import { AuthPanel } from '../ui/AuthPanel.js';
import { DEFAULT_NAMES, resetState, setFlag, state } from '../game/state.js';
import { monImagesReady } from '../gfx/monImages.js';
import { applyPlayerLook } from '../gfx/player.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { BLEED, COLORS, centerStage, drawPanel, gradientRect, textStyle } from '../ui/helpers.js';
import { InputRouter } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';

// Màn hình chính: đăng nhập / đăng ký rồi vào game luôn (có bản lưu thì chơi tiếp, chưa có thì tạo nhân vật).
// Tên nhân vật = tên đăng nhập (không có màn đặt tên; bản lưu có tên khác thì đổi theo tên đăng nhập)
// Bản đồ trong nhà trước kia thuộc Pallet, giờ thuộc Thị trấn Lục Bình (xem bước tải bản lưu)
const OLD_PALLET_SHOPS = ['center', 'mart'];
// 3 Pokémon trên màn hình chính [loài, x, lật ngang]. BootScene nạp hình các loài này trước khi hiện màn hình chính
export const TITLE_MONS = [['charmander', 210, false], ['pikachu', 480, false], ['squirtle', 750, true]];

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    // Màn hình rộng: khung 960x720 nằm giữa, nền tràn ra hai bên (ui/helpers.js: centerStage)
    centerStage(this);
    const width = 960;
    const height = 720;
    const bg = this.add.graphics();
    gradientRect(bg, -BLEED, 0, width + BLEED * 2, height, 0x1d2b53, 0x3b6ea5);
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

  // Đăng nhập (ui/AuthPanel.js) rồi vào game luôn: có bản lưu thì chơi tiếp, chưa có thì tạo nhân vật và chơi mới.
  // Không còn menu Tiếp tục / Chơi mới / Xoá dữ liệu: mỗi tài khoản đúng 1 bản lưu (online/cloudSave.js)
  async run() {
    // Chỉ khi chạy dev: ?e2e=<bản đồ> vào thẳng bản đồ với đội hình mẫu, không đăng nhập / không mạng (test Playwright: e2e/)
    const e2e = import.meta.env.DEV ? new URLSearchParams(location.search).get('e2e') : null;
    if (e2e !== null) {
      this.e2eStart(e2e || 'town1');
      return;
    }
    if (!supabase) {
      this.status('Chưa cấu hình Supabase: tạo file .env.local theo .env.example rồi chạy lại.', true);
      return;
    }
    let user = await currentUser();
    // fresh: vừa đăng nhập bằng mật khẩu (không phải phiên còn lại trong tab khi tải lại trang / nhân bản tab)
    let fresh = false;
    // Link "đặt lại mật khẩu" trong email: đã có phiên tạm, đặt mật khẩu mới rồi vào game
    if (user && emailLink.recovery) {
      user = await new AuthPanel().openNewPassword();
      fresh = true;
    }
    if (!user) {
      const linkError = emailLink.errorCode
        ? 'Link trong email đã hết hạn hoặc đã dùng rồi. Hãy đăng nhập, hoặc gửi lại email.' : null;
      clearLinkError();
      user = await new AuthPanel({ error: linkError }).open();
      fresh = true;
    }

    // Mỗi tài khoản chỉ chơi ở một nơi (online/session.js): nơi khác đã vào sau thì phải đăng nhập lại để giành quyền.
    // Bị nơi khác giành quyền giữa chừng: dừng hẳn game (bảng "Đăng nhập lại" che lên trên)
    const onLost = () => this.game.pause();
    if (await claimSession(user, fresh, { onLost }) === 'taken') {
      user = await new AuthPanel({ error: 'Tài khoản đã được mở ở tab hoặc thiết bị khác. Đăng nhập lại để chơi ở đây.' }).open();
      await claimSession(user, true, { onLost });
    }

    this.username = await fetchUsername(user);
    this.registry.set('user', { id: user.id, email: user.email, username: this.username });
    for (;;) {
      this.status('Đang tải bản lưu…');
      const { hasSave, offline } = await startCloudSave(user);
      this.status(offline && hasSave ? 'Không kết nối được máy chủ: chơi bằng bản lưu trên máy, có mạng sẽ tự gửi lên.' : '');
      if (offline && !hasSave) {
        // Chưa có gì trên máy mà cũng không tải được bản trên mạng: không được chơi mới (sẽ ghi đè bản lưu trên mạng)
        this.status('Không kết nối được máy chủ để tải bản lưu.', true);
        await this.confirm('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', [{ label: 'Thử lại', value: true }]);
        continue;
      }
      if (hasSave) {
        if (this.continueGame()) return;
        // Bản lưu hỏng không tải được: không tự xoá, để người chơi báo lỗi (bản trên mạng vẫn còn nguyên)
        this.status('Bản lưu bị lỗi, không tải được. Hãy liên hệ người làm game.', true);
        return;
      }
      if (await this.adoptLegacySave()) {
        markDirty();
        if (this.continueGame()) return;
      }
      await this.newGame();
      return;
    }
  }

  // Test Playwright (chỉ dev): bản lưu riêng trên máy, đã qua chương 1, 4 huy hiệu, đội 3 con, túi có đồ; không mạng
  e2eStart(mapId) {
    this.registry.set('user', null);
    setSaveOwner('e2e');
    deleteSave();
    resetState();
    state.player = { name: 'Test', gender: 'male', look: null };
    for (const f of ['talkedMom', 'metOak', 'gotStarter', 'rival1', 'gotPokedex', 'questDone', 'gruntsDefeated', 'rocketDefeated',
      'martReward', 'martClerkBack', 'rival2', 'chapter1Done', 'momGift']) setFlag(f);
    state.party = [createMonster('charmander', 16), createMonster('pikachu', 20), createMonster('kadabra', 30)];
    state.badges = new Set(['wind', 'grass', 'electric', 'water']);
    state.bag = { potion: 5, superPotion: 2, pokeBall: 10, oranBerry: 3, leftovers: 1, bicycle: 1, rareCandy: 3 };
    state.money = 50000;
    state.visited.add('town1');
    applyPlayerLook(this, state.player);
    window.__dev = { state, createMonster };
    this.go({ position: { map: mapId, ...(MAPS[mapId].entry ?? { x: 14, y: 9 }), facing: 'down' } });
  }

  // Dòng trạng thái dưới màn hình chính (đang tải, lỗi kết nối...)
  status(text, error = false) {
    this.statusText ??= this.add.text(480, 560, '', textStyle(20, '#ffffff', {
      fontStyle: 'bold', align: 'center', wordWrap: { width: 820 }, stroke: '#0a1430', strokeThickness: 4,
    })).setOrigin(0.5, 0);
    this.statusText.setText(text).setColor(error ? '#ffb0b0' : '#ffffff');
  }

  // Tải bản lưu trên máy (đã đồng bộ với bản trên mạng) rồi vào game. false nếu bản lưu hỏng
  continueGame() {
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
    if (!position) return false;
    // Tên nhân vật luôn là tên đăng nhập
    if (this.username && state.player && state.player.name !== this.username) {
      state.player.name = this.username;
      markDirty();
    }
    applyPlayerLook(this, state.player);
    this.go({ position: resumePosition(position) });
    return true;
  }

  // Tài khoản chưa có bản lưu mà máy này còn bản lưu từ trước khi có tài khoản: hỏi có dùng bản đó không (chỉ hỏi
  // khi tài khoản chưa có gì). Đồng ý thì chép vào tài khoản và xoá bản cũ khỏi máy
  async adoptLegacySave() {
    const old = summarize(legacySave());
    if (!old) return false;
    const info = this.showSummary(old);
    const yes = await this.confirm('Máy này có bản lưu từ trước khi có tài khoản. Dùng bản lưu đó cho tài khoản này?');
    info.destroy();
    if (!yes) return false;
    writeSave(legacySave());
    clearLegacySave();
    return true;
  }

  // Chơi mới: tạo nhân vật (bấm quay lại thì mở lại bảng tạo nhân vật, không có màn nào khác để về)
  async newGame() {
    this.status('');
    let player = null;
    while (!player) player = await this.createCharacter();
    deleteSave();
    resetState();
    state.player = player;
    applyPlayerLook(this, state.player);
    this.go({ position: SPAWN, newGame: true });
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

  // Chơi mới: bảng tuỳ chỉnh nhân vật (giới tính + diện mạo, ui/CharacterCreator.js). Tên = tên đăng nhập (không có thì
  // tên mặc định theo giới tính). Trả về { name, gender, look }, hoặc null nếu huỷ
  async createCharacter() {
    const picked = await new CharacterCreator(this, this.router, { gender: 'male' }).open();
    if (!picked) return null;
    const { gender, ...look } = picked;
    return { name: this.username || DEFAULT_NAMES[gender], gender, look };
  }

  // Hỏi Có / Không (mặc định chọn Không). items: thay hai lựa chọn mặc định
  async confirm(question, items = [{ label: 'Có', value: true }, { label: 'Không', value: false }]) {
    const c = this.add.container(0, 0).setDepth(30);
    c.add(this.add.rectangle(480, 360, 960 + BLEED * 2, 720, 0x000000, 0.5));
    c.add(drawPanel(this, 210, 250, 540, 110, 16, true));
    c.add(this.add.text(480, 280, question, textStyle(22, COLORS.text, { wordWrap: { width: 500 }, align: 'center' })).setOrigin(0.5, 0));
    const ok = await new Menu(this, this.router, {
      x: 380, y: 370, width: 200, height: 30 + items.length * 55, depth: 40, items, index: items.length - 1,
      cancelable: items.length > 1,
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
        box.add(this.add.rectangle(-BLEED, 0, 960 + BLEED * 2, 720, 0x0a1430, 0.7).setOrigin(0));
        label = this.add.text(480, 360, '', textStyle(26, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
        box.add(label);
      }
      label.setText(`Đang tải hình Pokémon… ${Math.floor(ratio * 100)}%`);
    });
    box?.destroy();
  }
}
