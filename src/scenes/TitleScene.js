import Phaser from 'phaser';
import { MAPS, SPAWN, resumePosition } from '../data/map.js';
import { clearLegacySave, deleteSave, loadGame, setSaveOwner } from '../game/save.js';
import { createMonster } from '../game/monster.js';
import { currentUser, fetchUsername } from '../online/account.js';
import { markDirty, startCloudSave } from '../online/cloudSave.js';
import { checkDevice } from '../online/device.js';
import { claimSession } from '../online/session.js';
import { clearLinkError, emailLink, supabase } from '../online/supabase.js';
import { AuthPanel } from '../ui/AuthPanel.js';
import { DEFAULT_NAMES, resetState, setFlag, state } from '../game/state.js';
import { monImagesReady } from '../gfx/monImages.js';
import { applyPlayerLook } from '../gfx/player.js';
import { fitScale, pixelMon } from '../gfx/textures.js';
import { CharacterCreator } from '../ui/CharacterCreator.js';
import { SettingsPanel } from '../ui/SettingsPanel.js';
import { BLEED, COLORS, centerStage, drawPanel, gradientRect, textStyle } from '../ui/helpers.js';
import { InputRouter } from '../ui/input.js';
import { Menu } from '../ui/Menu.js';

// Màn hình chính: đăng nhập / đăng ký rồi vào game luôn (có bản lưu thì chơi tiếp, chưa có thì tạo nhân vật).
// Tên nhân vật = tên đăng nhập (không có màn đặt tên; bản lưu có tên khác thì đổi theo tên đăng nhập)
// Bản đồ trong nhà trước kia thuộc Pallet, giờ thuộc Thị trấn Lục Bình (xem bước tải bản lưu)
const OLD_PALLET_SHOPS = ['center', 'mart'];
// 3 Pokémon trên màn hình chính [loài, x, lật ngang]. BootScene nạp hình các loài này trước khi hiện màn hình chính
export const TITLE_MONS = [['charmander', 210, false], ['pikachu', 480, false], ['squirtle', 750, true]];
// Nền khi tạo nhân vật: ảnh nền màn đăng nhập (src/assets/login/background.*, như ui/AuthPanel.js), làm tối đi.
// Không có ảnh thì giữ nền xanh của màn hình chính
const LOGIN_BG = Object.values(import.meta.glob('../assets/login/background.{png,jpg,jpeg,webp,gif,svg}', {
  eager: true, query: '?url', import: 'default',
}))[0] ?? null;

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

    // Chữ tiêu đề + 3 Pokémon (ẩn tạm khi mở Cài đặt từ màn đăng nhập: nền gọn như trong game)
    this.titleParts = [
      this.add.text(width / 2, 70, 'Pokémon', textStyle(84, '#ffe066', { fontStyle: 'bold', stroke: '#2a4a9a', strokeThickness: 14 })).setOrigin(0.5),
      this.add.text(width / 2, 140, 'AURORA ONLINE', textStyle(26, '#ffffff', { fontStyle: 'bold', stroke: '#2a4a9a', strokeThickness: 6 })).setOrigin(0.5),
      this.add.text(width / 2, 176, 'Phiên bản demo', textStyle(20, '#c8d8ff', { fontStyle: 'bold' })).setOrigin(0.5),
    ];
    for (const [id, x, flip] of TITLE_MONS) {
      const key = pixelMon(this, id);
      const sprite = this.add.image(x, 400, key).setOrigin(0.5, 1).setScale(fitScale(this, key, 192)).setFlipX(flip);
      this.titleParts.push(sprite, this.add.ellipse(x, 404, 140, 22, 0x000000, 0.2));
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
      user = await this.authPanel().openNewPassword();
      fresh = true;
    }
    if (!user) {
      const linkError = emailLink.errorCode
        ? 'Link trong email đã hết hạn hoặc đã dùng rồi. Hãy đăng nhập, hoặc gửi lại email.' : null;
      clearLinkError();
      user = await this.authPanel({ error: linkError }).open();
      fresh = true;
    }

    // Thiết bị lạ (online/device.js): nhập mã gửi tới email rồi mới được dùng dữ liệu (máy chủ chặn bản lưu, giao dịch...)
    const trusted = await this.trustDevice(user);
    if (trusted.user !== user) fresh = true;
    user = trusted.user;

    // Mỗi tài khoản chỉ chơi ở một nơi (online/session.js): nơi khác đã vào sau thì phải đăng nhập lại để giành quyền.
    // Bị nơi khác giành quyền giữa chừng: dừng hẳn game (bảng "Đăng nhập lại" che lên trên)
    const onLost = () => this.game.pause();
    if (await claimSession(user, fresh, { onLost }) === 'taken') {
      user = await this.authPanel({ error: 'Tài khoản đã được mở ở tab hoặc thiết bị khác. Đăng nhập lại để chơi ở đây.' }).open();
      user = (await this.trustDevice(user)).user;
      await claimSession(user, true, { onLost });
    }

    this.username = await fetchUsername(user);
    this.registry.set('user', { id: user.id, email: user.email, username: this.username });
    // Bản lưu cũ từ trước khi có tài khoản (khoá chung trên máy): không dùng nữa, xoá đi
    clearLegacySave();
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
      await this.newGame();
      return;
    }
  }

  // Phiên đăng nhập của user đã được máy chủ cho dùng chưa (thiết bị tin cậy). Thiết bị lạ: màn nhập mã gửi tới email;
  // bấm Đăng xuất thì về màn đăng nhập. Trả về { user } (user mới nếu đã nhập mã / đăng nhập lại)
  async trustDevice(user) {
    for (;;) {
      const state = await checkDevice(user);
      if (state === 'ok') return { user };
      if (state === 'error') {
        this.status('Không kết nối được máy chủ.', true);
        await this.confirm('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.', [{ label: 'Thử lại', value: true }]);
        this.status('');
        continue;
      }
      user = (await this.authPanel().openDevice(user)) ?? (await this.authPanel().open());
    }
  }

  // Màn đăng nhập (ui/AuthPanel.js); nút Cài đặt ở góc mở đúng bảng Cài đặt trong game
  authPanel(opts = {}) {
    return new AuthPanel({ ...opts, onSettings: () => this.openSettings() });
  }

  // Bảng Cài đặt trong game (ui/SettingsPanel.js), mở từ màn đăng nhập (màn đăng nhập tạm ẩn trong lúc này). Bỏ các nút cần
  // đang ở trong game (Đổi diện mạo...)
  async openSettings() {
    for (const part of this.titleParts) part.setVisible(false);
    await new SettingsPanel(this, this.router, { depth: 60, lobby: true }).open();
    this.router.clear();
    for (const part of this.titleParts) part.setVisible(true);
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
    // Chỗ đứng hồi phục lấy lại theo bản đồ hiện tại (Pokémon Center từng nới rộng rồi thu nhỏ lại: toạ độ cũ lệch ra ngoài)
    else if (state.lastCenter && MAPS[state.lastCenter.map].heal) state.lastCenter = { ...state.lastCenter, ...MAPS[state.lastCenter.map].heal };
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

  // Chơi mới: bảng tuỳ chỉnh nhân vật (giới tính + diện mạo, ui/CharacterCreator.js). Tên = tên đăng nhập (không có thì
  // tên mặc định theo giới tính). Trả về { name, gender, look }, hoặc null nếu huỷ.
  // Ẩn chữ tiêu đề + Pokémon của màn hình chính, nền là ảnh phong cảnh màn đăng nhập làm tối (không có nút ✕: bắt buộc chọn)
  async createCharacter() {
    for (const part of this.titleParts) part.setVisible(false);
    await this.creatorBackdrop();
    const picked = await new CharacterCreator(this, this.router, { gender: 'male', dim: 0.4 }).open();
    if (!picked) return null;
    const { gender, ...look } = picked;
    return { name: this.username || DEFAULT_NAMES[gender], gender, look };
  }

  // Ảnh nền phủ kín màn hình (giữ tỉ lệ, cắt bớt mép) phía sau bảng tạo nhân vật. Tải ảnh lỗi thì thôi (giữ nền xanh)
  async creatorBackdrop() {
    if (!LOGIN_BG || this.backdrop) return;
    const key = 'title-creator-bg';
    if (!this.textures.exists(key)) {
      try {
        const img = new Image();
        img.src = LOGIN_BG;
        await img.decode();
        if (!this.textures.exists(key)) this.textures.addImage(key, img);
      } catch (err) {
        console.warn('Không tải được ảnh nền:', err);
        return;
      }
    }
    if (!this.sys.isActive()) return;
    const bg = this.add.image(480, 360, key).setDepth(1);
    const fit = () => bg.setScale(Math.max(this.scale.width / bg.width, 720 / bg.height));
    fit();
    this.scale.on('resize', fit);
    this.events.once('shutdown', () => this.scale.off('resize', fit));
    this.backdrop = bg;
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
