import { ABILITIES } from '../../data/abilities.js';
import { dexNo } from '../../data/pokedex.js';
import { STAT_NAMES } from '../../data/stats.js';
import { TYPES } from '../../data/types.js';
import { PHASE_ICONS } from '../../game/clock.js';
import { fitScale, pixelMon } from '../../gfx/textures.js';
import { cssColor, shade, textStyle } from '../helpers.js';
import { typeBadges } from '../TypeBadge.js';
import { RADAR_STATS, dexLocations, dexMoves, levelText, metric, radarPoint, radarRatio } from './dexData.js';
import { ScrollList, fitText } from './ScrollList.js';

const INK = '#30343c';
const MUTED = '#8a92a6';
const LINE = 0xd2dbea;
const MOVE_ROW = 24;
const PHASE_SHORT = { day: 'Ngày', dusk: 'Chiều', night: 'Đêm' };

const FX_LABEL = { 0: '×0', 0.25: '×¼', 0.5: '×½', 1: '×1', 2: '×2', 4: '×4' };
const fxColor = (m) => (m === 0 ? '#555b6a' : m < 1 ? '#2f9a50' : m > 1 ? '#d04040' : '#b4bac8');

// Tên chiêu tô theo màu hệ, làm tối đủ để đọc rõ trên nền sáng (hệ màu nhạt như Băng, Điện tối hơn nhiều)
const moveColor = (color) => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return cssColor(shade(color, lum > 0.6 ? -55 : -35));
};

const METHOD_COLORS = {
  grass: '#3f9b2f', deep: '#2b6e22', cave: '#8a6040', surf: '#2f78d0', oldRod: '#a07848', goodRod: '#4a7ad8', superRod: '#c04a8a',
};

// Nửa phải của Pokédex: thông tin loài đang chọn. Khung tĩnh dựng một lần, show(p, status) vẽ lại phần nội dung.
// Phía dưới có 2 hộp cuộn được: "Chiêu thức" (tab "Khắc hệ" dùng chung hộp) và "Nơi xuất hiện".
export class DexDetail {
  constructor(scene, x, y, w, h) {
    Object.assign(this, { scene, x, y, w, h, tab: 'moves' });
    // Hộp dưới: trái (chiêu thức / khắc hệ), phải (nơi xuất hiện)
    const boxY = y + 362;
    const boxH = h - 362 - 12;
    const leftW = 196;
    this.boxes = {
      left: { x: x + 14, y: boxY, w: leftW, h: boxH },
      right: { x: x + 14 + leftW + 10, y: boxY, w: w - 28 - leftW - 10, h: boxH },
    };
    const g = scene.add.graphics();
    for (const b of Object.values(this.boxes)) {
      g.fillStyle(0xf3f6fb);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, 10);
      g.lineStyle(2, LINE);
      g.strokeRoundedRect(b.x, b.y, b.w, b.h, 10);
      g.lineStyle(1, LINE);
      g.lineBetween(b.x + 8, b.y + 30, b.x + b.w - 8, b.y + 30);
    }
    this.frame = g;
    const { left, right } = this.boxes;
    this.tabs = [['moves', 'Chiêu thức'], ['fx', 'Khắc hệ']].map(([id, label], i) => {
      const t = scene.add.text(left.x + 12 + i * 98, left.y + 15, label, textStyle(15, MUTED, { fontStyle: 'bold' })).setOrigin(0, 0.5);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(id));
      return [id, t];
    });
    this.tabLine = scene.add.graphics();
    scene.add.text(right.x + 12, right.y + 15, 'Nơi xuất hiện', textStyle(15, INK, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    this.moveList = new ScrollList(scene, left.x + 6, left.y + 34, left.w - 10, left.h - 40);
    this.fxLayer = scene.add.container(0, 0);
    this.areaList = new ScrollList(scene, right.x + 6, right.y + 34, right.w - 10, right.h - 40);
    this.layer = scene.add.container(0, 0);
    this.drawTabs();
  }

  // Con lăn chuột trên hộp chiêu thức / nơi xuất hiện: trả về true nếu đã cuộn
  wheel(px, py, dy) {
    const list = [this.tab === 'moves' ? this.moveList : null, this.areaList].find((l) => l?.contains(px, py));
    if (!list) return false;
    list.scrollBy(Math.sign(dy) * MOVE_ROW * 2);
    return true;
  }

  setTab(tab) {
    if (tab === this.tab) return;
    this.tab = tab;
    this.drawTabs();
  }

  toggleTab() {
    this.setTab(this.tab === 'moves' ? 'fx' : 'moves');
  }

  drawTabs() {
    const { left } = this.boxes;
    this.tabLine.clear();
    for (const [id, t] of this.tabs) {
      const on = id === this.tab;
      t.setColor(on ? INK : MUTED);
      if (on) {
        this.tabLine.fillStyle(0xe04848);
        this.tabLine.fillRoundedRect(t.x, left.y + 26, t.width, 3, 1.5);
      }
    }
    this.moveList.setVisible(this.tab === 'moves' && this.known);
    this.fxLayer.setVisible(this.tab === 'fx' && this.known);
  }

  show(p, status) {
    const { scene, x, y, w } = this;
    this.layer.removeAll(true);
    this.moveList.clear();
    this.areaList.clear();
    this.fxLayer.removeAll(true);
    const add = (obj) => {
      this.layer.add(obj);
      return obj;
    };
    const known = status !== 'unknown';
    this.known = known;

    // Tiêu đề: số, tên, nhóm loài; hệ ở góc phải
    add(scene.add.text(x + 18, y + 14, `No.${dexNo(p.id)}`, textStyle(16, MUTED, { fontStyle: 'bold' })));
    if (status === 'caught') add(scene.add.image(x + 88, y + 24, 'ball').setDisplaySize(18, 18));
    add(fitText(scene.add.text(x + 18, y + 32, known ? p.name : '???', textStyle(28, INK, { fontStyle: 'bold' })), 250));
    add(fitText(scene.add.text(x + 18, y + 68, known ? p.species : 'Chưa gặp', textStyle(15, '#6a7286')), 250));
    if (known) {
      const badges = typeBadges(scene, 0, y + 30, p.types, { size: 16 });
      const right = x + w - 18;
      const shift = right - (badges.at(-1).x + badges.at(-1).badgeWidth / 2);
      badges.forEach((b) => add(b).setX(b.x + shift));
    }

    // Hình
    const sx = x + 14;
    const sy = y + 92;
    const g = add(scene.add.graphics());
    g.fillStyle(0xf3f6fb);
    g.fillRoundedRect(sx, sy, 170, 140, 12);
    g.lineStyle(2, LINE);
    g.strokeRoundedRect(sx, sy, 170, 140, 12);
    g.fillStyle(known ? TYPES[p.types[0]].color : 0x8890a0, 0.22);
    g.fillCircle(sx + 85, sy + 66, 56);
    g.fillStyle(0x000000, 0.1);
    g.fillEllipse(sx + 85, sy + 122, 110, 16);
    const key = pixelMon(scene, p.slug);
    const img = add(scene.add.image(sx + 85, sy + 126, key).setOrigin(0.5, 1).setScale(fitScale(scene, key, 124)));
    if (!known) {
      img.setTintFill(0x14161c).setAlpha(0.85);
      this.renderUnknown(add);
      this.drawTabs();
      return;
    }

    // Chiều cao / cân nặng
    [['Chiều cao', metric(p.height)], ['Cân nặng', metric(p.weight)]].forEach(([label, value], i) => {
      add(scene.add.text(sx + 4, sy + 148 + i * 20, label, textStyle(14, MUTED)));
      add(scene.add.text(sx + 166, sy + 148 + i * 20, value, textStyle(14, INK, { fontStyle: 'bold' })).setOrigin(1, 0));
    });

    this.renderRadar(add, p, x + 196 + (w - 196 - 14) / 2, y + 176);

    // Mô tả + đặc tính
    add(scene.add.text(x + 18, y + 284, p.entry.text, textStyle(14, INK, { wordWrap: { width: w - 36, useAdvancedWrap: true }, maxLines: 2, lineSpacing: 1 })));
    const ab = add(scene.add.text(x + 18, y + 330, 'Đặc tính:', textStyle(14, MUTED, { fontStyle: 'bold' })));
    let ax = ab.x + ab.width + 8;
    p.abilities.forEach((a, i) => {
      const t = add(scene.add.text(ax, y + 330, `${a.name}${a.hidden ? ' (ẩn)' : ''}${i < p.abilities.length - 1 ? ',' : ''}`,
        textStyle(14, a.hidden ? '#8a50b8' : INK, { fontStyle: 'bold' })));
      fitText(t, x + w - 16 - ax);
      // Đặc tính game đã có: rê chuột xem mô tả tiếng Việt
      const info = Object.values(ABILITIES).find((v) => v.name === a.name);
      if (info) this.tooltip(t, info.desc);
      ax += t.width + 6;
    });

    this.renderMoves(p);
    this.renderFx(p);
    this.renderAreas(p);
    this.drawTabs();
  }

  renderUnknown(add) {
    const { scene, x, y, w } = this;
    const cx = x + 196 + (w - 196 - 14) / 2;
    add(scene.add.text(cx, y + 150, 'Chưa gặp', textStyle(30, '#b4bac8', { fontStyle: 'bold' })).setOrigin(0.5));
    add(scene.add.text(cx, y + 196, 'Gặp Pokémon này ngoài tự nhiên hoặc\ntrong trận đấu để ghi vào Pokédex.',
      textStyle(14, MUTED, { align: 'center', lineSpacing: 2 })).setOrigin(0.5));
    for (const b of Object.values(this.boxes)) {
      add(scene.add.text(b.x + b.w / 2, b.y + 30 + (b.h - 30) / 2, '???', textStyle(28, '#c8ccd6', { fontStyle: 'bold' })).setOrigin(0.5));
    }
  }

  tooltip(target, text) {
    const { scene } = this;
    target.setInteractive();
    target.on('pointerover', () => {
      this.tip?.destroy();
      const t = scene.add.text(0, 0, text, textStyle(13, '#ffffff', {
        backgroundColor: '#2c3550', padding: { x: 8, y: 5 }, wordWrap: { width: 260 },
      })).setDepth(50);
      const tx = Math.min(target.x, this.x + this.w - t.width - 8);
      t.setPosition(tx, target.y - t.height - 4);
      this.tip = t;
    });
    target.on('pointerout', () => {
      this.tip?.destroy();
      this.tip = null;
    });
    target.once('destroy', () => {
      this.tip?.destroy();
      this.tip = null;
    });
  }

  // Biểu đồ lục giác 6 chỉ số gốc
  renderRadar(add, p, cx, cy) {
    const { scene } = this;
    const R = 62;
    const g = add(scene.add.graphics());
    const ring = (ratio) => RADAR_STATS.map((_, i) => radarPoint(cx, cy, R, i, ratio));
    g.fillStyle(0xf3f6fb);
    g.fillPoints(ring(1), true);
    g.lineStyle(1, LINE);
    for (const r of [1 / 3, 2 / 3, 1]) g.strokePoints(ring(r), true);
    for (const pt of ring(1)) g.lineBetween(cx, cy, pt.x, pt.y);
    const color = TYPES[p.types[0]].color;
    const pts = RADAR_STATS.map((k, i) => radarPoint(cx, cy, R, i, radarRatio(p.stats[k])));
    g.fillStyle(color, 0.5);
    g.fillPoints(pts, true);
    g.lineStyle(2, shade(color, -25));
    g.strokePoints(pts, true);
    g.fillStyle(shade(color, -35));
    for (const pt of pts) g.fillCircle(pt.x, pt.y, 2.5);

    RADAR_STATS.forEach((k, i) => {
      const at = radarPoint(cx, cy, R + 12, i);
      const dx = at.x - cx;
      const ox = Math.abs(dx) < 1 ? 0.5 : dx > 0 ? 0 : 1;
      const oy = i === 0 ? 1 : i === 3 ? 0 : 0.5;
      const label = k === 'hp' ? 'HP' : STAT_NAMES[k];
      add(scene.add.text(at.x, at.y, `${label}\n${p.stats[k]}`, textStyle(13, INK, { fontStyle: 'bold', align: ox === 0 ? 'left' : ox === 1 ? 'right' : 'center', lineSpacing: -2 }))
        .setOrigin(ox, oy));
    });
    add(scene.add.text(cx + R + 30, cy + R + 22, `Tổng ${p.stats.total}`, textStyle(13, MUTED, { fontStyle: 'bold' })).setOrigin(1, 0.5));
  }

  renderMoves(p) {
    const { scene, moveList } = this;
    const moves = dexMoves(p.slug);
    const w = moveList.w - 12;
    moves.forEach(({ level, move }, i) => {
      const ry = i * MOVE_ROW;
      const type = TYPES[move.type];
      if (i % 2 === 0) {
        const bg = scene.add.graphics();
        bg.fillStyle(0xe8edf5, 0.7);
        bg.fillRoundedRect(0, ry, w, MOVE_ROW, 6);
        moveList.add(bg);
      }
      moveList.add(scene.add.text(28, ry + MOVE_ROW / 2, level === 'TH' ? 'TH' : `Lv${level}`, textStyle(12, MUTED, { fontStyle: 'bold' })).setOrigin(1, 0.5));
      const pill = scene.add.graphics();
      pill.fillStyle(type?.color ?? 0x8890a0);
      pill.fillRoundedRect(32, ry + 4, 36, MOVE_ROW - 8, 8);
      moveList.add(pill);
      moveList.add(scene.add.text(50, ry + MOVE_ROW / 2, type?.short ?? '?', textStyle(10, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      const name = scene.add.text(73, ry + MOVE_ROW / 2, move.name, textStyle(13, moveColor(type?.color ?? 0x606878), { fontStyle: 'bold' })).setOrigin(0, 0.5);
      moveList.add(fitText(name, w - 73));
    });
    if (!moves.length) moveList.add(scene.add.text(6, 6, 'Chưa có dữ liệu.', textStyle(14, MUTED)));
    moveList.setContentHeight(moves.length * MOVE_ROW);
  }

  renderFx(p) {
    const { scene, fxLayer } = this;
    const { left } = this.boxes;
    const colW = (left.w - 16) / 3;
    Object.entries(p.typeDefenses).forEach(([type, mult], i) => {
      const cx = left.x + 8 + (i % 3) * colW;
      const cy = left.y + 40 + Math.floor(i / 3) * 26;
      const g = scene.add.graphics();
      g.fillStyle(TYPES[type].color);
      g.fillRoundedRect(cx, cy, 38, 18, 8);
      fxLayer.add(g);
      fxLayer.add(scene.add.text(cx + 19, cy + 9, TYPES[type].short, textStyle(10, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      fxLayer.add(scene.add.text(cx + 42, cy + 9, FX_LABEL[mult] ?? `×${mult}`, textStyle(14, fxColor(mult), { fontStyle: 'bold' })).setOrigin(0, 0.5));
    });
  }

  // Nơi xuất hiện, gom theo bản đồ: tên bản đồ rồi từng cách gặp (bụi cỏ, lướt nước, cần câu...) + cấp + buổi
  renderAreas(p) {
    const { scene, areaList } = this;
    const w = areaList.w - 14;
    const locs = dexLocations(p.slug);
    let y = 2;
    let mapId = null;
    for (const loc of locs) {
      if (loc.mapId !== mapId) {
        if (mapId) {
          const sep = scene.add.graphics();
          sep.lineStyle(1, LINE);
          sep.lineBetween(4, y + 3, w, y + 3);
          areaList.add(sep);
          y += 7;
        }
        mapId = loc.mapId;
        areaList.add(fitText(scene.add.text(6, y, loc.mapName, textStyle(14, INK, { fontStyle: 'bold' })), w - 6));
        y += 20;
      }
      const method = scene.add.text(14, y, loc.label, textStyle(12, METHOD_COLORS[loc.method] ?? MUTED, { fontStyle: 'bold' }));
      areaList.add(method);
      let tail = ` • ${levelText(loc)}`;
      if (loc.times.length) tail += ` • ${loc.times.map((t) => `${PHASE_ICONS[t]} ${PHASE_SHORT[t]}`).join(', ')}`;
      areaList.add(fitText(scene.add.text(14 + method.width, y, tail, textStyle(12, MUTED, { fontStyle: 'bold' })), w - 14 - method.width));
      y += 18;
    }
    if (!locs.length) {
      areaList.add(scene.add.text(6, 6, 'Không gặp ngoài tự nhiên.', textStyle(14, MUTED, { wordWrap: { width: w } })));
    }
    areaList.setContentHeight(locs.length ? y + 2 : 0);
  }

}
