import Phaser from 'phaser';
import { SPECIES } from '../data/monsters.js';
import { CHIP_STAGE_KEYS, STAT_NAMES } from '../data/stats.js';
import { expProgress } from '../game/monster.js';
import { state } from '../game/state.js';
import { GENDER, drawHpBar, fitText, statusTag, textStyle, tweenAsync } from './helpers.js';
import { shinyGap, shinyMark } from './shinyMark.js';

const WIDTH = 410;
const OUTLINE = '#1e2a44'; // viền chữ tối để đọc rõ trên nền trời / cỏ
const CHIP_H = 24;
export const CHIP_ROW = CHIP_H + 5; // khoảng cách giữa hai hàng thẻ chỉ số
const ENEMY_CHIP_X = 30; // thẻ chỉ số đối thủ: thẳng hàng với thanh HP
const ENEMY_CHIP_W = WIDTH - 82; // chừa chỗ Poké Ball "đã bắt" ở góc phải
const BAR = { x: 30, y: 52, w: WIDTH - 52, h: 22 }; // thanh HP
const PIN_MS = 2500; // bấm vào thanh HP: hiện % trong chừng này ms

// % máu còn lại để hiện trên thanh HP (còn chút máu thì ít nhất 1%, chưa đầy thì nhiều nhất 99%)
export function hpPercent(hp, maxHp) {
  if (hp <= 0) return 0;
  if (hp >= maxHp) return 100;
  return Phaser.Math.Clamp(Math.round((hp / maxHp) * 100), 1, 99);
}

// Tên (chữ "S" nếu shiny, giới tính, trạng thái) + cấp + thanh HP (và thanh EXP cho Pokémon của người chơi), không có khung nền.
// Không hiện số HP: rê chuột lên thanh HP thì hiện % máu còn lại, bấm vào thanh thì ghim % một lúc.
// Chữ trắng viền tối nổi trên nền trận. Đối thủ là loài đã bắt được thì có Poké Ball nhỏ dưới góc phải thanh HP.
// Kèm thẻ chỉ số đang tăng / giảm trong trận (Atk -1, Spe +2...; Accuracy / Evasion không hiện thẻ), xuống hàng khi quá bề ngang khung
// (đối thủ: ngay dưới thanh HP, thêm hàng thì xuống dưới; người chơi: ngay trên khung, thêm hàng thì lên trên).
// onStageRows(số hàng): báo cho trận đấu để đẩy hàng bóng đội hình đối thủ xuống, không bị thẻ đè
export class MonsterInfo {
  constructor(scene, x, y, isPlayer) {
    this.scene = scene;
    this.isPlayer = isPlayer;
    const h = isPlayer ? 128 : 96;
    this.container = scene.add.container(x, y).setDepth(5);

    const outline = { stroke: OUTLINE, strokeThickness: 6 };
    this.nameText = scene.add.text(30, 10, '', textStyle(28, '#ffffff', { fontStyle: 'bold', ...outline }));
    this.levelText = scene.add.text(WIDTH - 22, 12, '', textStyle(24, '#ffffff', { fontStyle: 'bold', ...outline })).setOrigin(1, 0);
    this.genderText = scene.add.text(0, 12, '', textStyle(24, '#ffffff', { fontStyle: 'bold', ...outline }));
    // Pokémon shiny: chữ "S" vàng trước tên (ui/shinyMark.js)
    this.shinyText = shinyMark(scene, 30, 11, 28).setVisible(false);
    this.bars = scene.add.graphics();
    this.container.add([this.nameText, this.levelText, this.genderText, this.shinyText, this.bars]);
    this.hpLabel = scene.add.text(42, 54, 'HP', textStyle(16, '#ffcc33', { fontStyle: 'bold' }));
    this.container.add(this.hpLabel);
    // Không hiện số HP: rê chuột lên thanh HP thì hiện % máu còn lại, bấm vào thì ghim % một lúc (màn hình cảm ứng)
    this.pctText = scene.add.text(BAR.x + 44 + (BAR.w - 50) / 2, BAR.y + BAR.h / 2, '', textStyle(16, '#ffffff', {
      fontStyle: 'bold', stroke: OUTLINE, strokeThickness: 4,
    })).setOrigin(0.5).setVisible(false);
    this.container.add(this.pctText);
    this.hpHover = false;
    this.hpPinned = false;
    const zone = scene.add.zone(BAR.x + BAR.w / 2, BAR.y + BAR.h / 2, BAR.w, BAR.h + 12).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      this.hpHover = true;
      this.updatePct();
    });
    zone.on('pointerout', () => {
      this.hpHover = false;
      this.updatePct();
    });
    zone.on('pointerdown', (p, lx, ly, e) => {
      if (!this.container.visible) return;
      // bấm vào thanh HP không tính là bấm qua lời thoại / đóng menu
      e?.stopPropagation();
      this.pinTimer?.remove();
      this.hpPinned = !this.hpPinned;
      if (this.hpPinned) this.pinTimer = scene.time.delayedCall(PIN_MS, () => {
        this.hpPinned = false;
        this.updatePct();
      });
      this.updatePct();
    });
    this.container.add(zone);
    if (!isPlayer) {
      // Loài đã bắt được (Pokédex): Poké Ball nhỏ dưới góc phải thanh HP
      this.ownedBall = scene.add.image(WIDTH - 34, 92, 'ball').setScale(0.24).setVisible(false);
      this.container.add(this.ownedBall);
    }
    this.stageRow = scene.add.container(isPlayer ? 0 : ENEMY_CHIP_X, isPlayer ? -34 : 80);
    this.container.add(this.stageRow);
  }

  // Thẻ chỉ số đang bị đổi: tăng màu cam (+), giảm màu xanh (-), kèm số bậc (-6 tới +6).
  // Hết bề ngang khung thì xuống hàng: người chơi xếp hàng mới lên trên (không đè khung), đối thủ xếp xuống dưới
  drawStages() {
    const { scene, mon } = this;
    this.stageRow.removeAll(true);
    const maxW = this.isPlayer ? WIDTH : ENEMY_CHIP_W;
    let x = 0;
    let row = 0;
    let any = false;
    for (const stat of CHIP_STAGE_KEYS) {
      const n = mon.stages?.[stat] ?? 0;
      if (!n) continue;
      const up = n > 0;
      any = true;
      const text = scene.add.text(0, 0, `${STAT_NAMES[stat]} ${up ? '+' : '-'}${Math.abs(n)}`, textStyle(15, '#ffffff', { fontStyle: 'bold' }));
      const w = text.width + 18;
      if (x > 0 && x + w > maxW) {
        x = 0;
        row++;
      }
      const y = (this.isPlayer ? -row : row) * CHIP_ROW;
      text.setPosition(x + 9, y + 3);
      const chip = scene.add.graphics();
      chip.fillStyle(0x000000, 0.25);
      chip.fillRoundedRect(x + 2, y + 3, w, CHIP_H, 9);
      chip.fillStyle(up ? 0xe8702a : 0x3a78e0);
      chip.fillRoundedRect(x, y, w, CHIP_H, 9);
      this.stageRow.add([chip, text]);
      x += w + 6;
    }
    this.onStageRows?.(any ? row + 1 : 0);
  }

  setMonster(mon) {
    this.mon = mon;
    this.view = null;
    this.displayHp = mon.hp;
    this.displayExp = expProgress(mon);
    this.refresh();
  }

  // Cập nhật tên, cấp, HP theo dữ liệu hiện tại (giữ nguyên thanh EXP).
  // view: { level, maxHp, hp } hiện cấp / HP của một lần lên cấp giữa chừng (lên nhiều cấp một lúc thì hiện từng cấp)
  refresh(view = null) {
    const { mon } = this;
    this.view = view;
    this.displayHp = view?.hp ?? mon.hp;
    this.shinyText.setVisible(Boolean(mon.shiny));
    this.levelText.setText(`Lv${view?.level ?? mon.level}`);
    const gender = GENDER[mon.gender];
    this.genderText.setText(gender?.symbol ?? '').setColor(gender?.color ?? '#ffffff');
    this.statusBadge?.destroy();
    this.statusBadge = statusTag(this.scene, 0, 18, mon.status, 15);
    // Biệt danh dài: thu nhỏ / cắt bớt để tên, giới tính, trạng thái không đè lên cấp
    const nameX = mon.shiny ? this.shinyText.x + this.shinyText.width + shinyGap(28) : 30;
    const extra = (gender ? this.genderText.width + 6 : 0) + (this.statusBadge ? this.statusBadge.width + 6 : 0);
    this.nameText.setText(mon.name).setPosition(nameX, 10);
    fitText(this.nameText, WIDTH - 22 - this.levelText.width - 12 - nameX - extra, 0.75);
    let x = nameX + this.nameText.displayWidth + 6;
    this.genderText.setX(x);
    if (gender) x += this.genderText.width + 6;
    this.ownedBall?.setVisible(state.dex.caught.has(SPECIES[mon.speciesId]?.dexId));
    if (this.statusBadge) this.container.add(this.statusBadge.setX(x));
    this.drawStages();
    this.draw();
  }

  draw() {
    const g = this.bars;
    const maxHp = this.view?.maxHp ?? this.mon.maxHp;
    g.clear();
    drawHpBar(g, BAR.x, BAR.y, BAR.w, this.displayHp / maxHp);
    this.container.bringToTop(this.hpLabel);
    this.updatePct();

    if (this.isPlayer) {
      // thanh EXP ngay dưới thanh HP
      g.fillStyle(0x3a4250);
      g.fillRoundedRect(30, 84, WIDTH - 52, 8, 4);
      const w = Math.round((WIDTH - 56) * Phaser.Math.Clamp(this.displayExp, 0, 1));
      if (w > 0) {
        g.fillStyle(0x48b0f8);
        g.fillRoundedRect(32, 85, Math.max(6, w), 6, 3);
      }
    }
  }

  // % máu còn lại (làm tròn; còn chút máu thì ít nhất 1%, chưa đầy thì nhiều nhất 99%), hiện khi rê chuột / ghim
  updatePct() {
    if (!this.mon) return;
    const show = this.hpHover || this.hpPinned;
    this.pctText.setVisible(show);
    if (!show) return;
    this.pctText.setText(`${hpPercent(this.displayHp, this.view?.maxHp ?? this.mon.maxHp)}%`);
    this.container.bringToTop(this.pctText);
  }

  animateHp() {
    const diff = Math.abs(this.mon.hp - this.displayHp);
    if (diff === 0) return Promise.resolve();
    const duration = Phaser.Math.Clamp((diff / this.mon.maxHp) * 1200, 250, 900);
    return tweenAsync(this.scene, {
      targets: this,
      displayHp: this.mon.hp,
      duration,
      onUpdate: () => this.draw(),
    });
  }

  animateExp(target) {
    return tweenAsync(this.scene, {
      targets: this,
      displayExp: target,
      duration: 600,
      onUpdate: () => this.draw(),
    });
  }

  setExp(ratio) {
    this.displayExp = ratio;
    this.draw();
  }

  setVisible(visible) {
    this.container.setVisible(visible);
  }
}
