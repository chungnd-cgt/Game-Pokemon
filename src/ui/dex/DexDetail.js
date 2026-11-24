import { ABILITIES } from '../../data/abilities.js';
import { dexNo } from '../../data/pokedex.js';
import { STAT_NAMES } from '../../data/stats.js';
import { TYPES } from '../../data/types.js';
import { fitScale, pixelMon } from '../../gfx/textures.js';
import { cssColor, shade, textStyle } from '../helpers.js';
import { drawEnvIcon } from '../envIcons.js';
import { typeBadges } from '../TypeBadge.js';
import { RADAR_STATS, dexMoves, dexPlaces, metric, radarPoint, radarRatio } from './dexData.js';
import { ScrollList, fitText } from './ScrollList.js';
import { DEX_COLORS as C, DEX_TEXT as T } from './theme.js';

const MOVE_ROW = 22;
const SIDE_W = 190; // cột trái của nửa phải: tên, hình, hệ, chiều cao / cân nặng
const MON_SIZE = 70; // cạnh dài nhất của hình Pokémon
const R = 50; // bán kính biểu đồ lục giác

const FX_LABEL = { 0: '×0', 0.25: '×¼', 0.5: '×½', 1: '×1', 2: '×2', 4: '×4' };
const fxColor = (m) => (m === 0 ? '#8a90a0' : m < 1 ? '#6ad880' : m > 1 ? '#ff7a6a' : '#7a8aa8');

// Tên chiêu tô theo màu hệ, làm sáng đủ để đọc rõ trên nền tối (hệ màu đậm như Ma, Rồng sáng hơn nhiều)
const moveColor = (color) => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return cssColor(shade(color, lum < 0.45 ? 70 : lum < 0.6 ? 40 : 15));
};

// Nửa phải của Pokédex: thông tin loài đang chọn (bố cục như Pokédex kiểu MMO: tên + nhóm loài, hình trên bệ, hệ, chiều cao
// / cân nặng; biểu đồ lục giác chỉ số gốc; mô tả; hàng đặc tính; dưới cùng 2 hộp cuộn "Chiêu thức" (tab "Khắc hệ" dùng
// chung hộp) và "Nơi xuất hiện"). Khung tĩnh dựng một lần, show(p, status) vẽ lại phần nội dung.
export class DexDetail {
  constructor(scene, x, y, w, h) {
    Object.assign(this, { scene, x, y, w, h, tab: 'moves' });
    this.rows = { desc: y + 192, abil: y + 268, box: y + 324 };
    const boxH = h - (this.rows.box - y);
    const leftW = 212;
    this.boxes = {
      left: { x, y: this.rows.box, w: leftW, h: boxH },
      right: { x: x + leftW + 8, y: this.rows.box, w: w - leftW - 8, h: boxH },
    };
    const g = scene.add.graphics();
    for (const b of Object.values(this.boxes)) this.panel(g, b.x, b.y, b.w, b.h);
    this.strip(g, x + SIDE_W + 6, this.rows.desc, w - SIDE_W - 6);
    this.strip(g, x, this.rows.abil, w);
    scene.add.text(x + SIDE_W + 16, this.rows.desc + 10, 'Mô tả', textStyle(12, T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    scene.add.text(x + 10, this.rows.abil + 10, 'Đặc tính', textStyle(12, T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    this.frame = g;
    const { left, right } = this.boxes;
    this.tabs = [['moves', 'Chiêu thức'], ['fx', 'Khắc hệ']].map(([id, label], i) => {
      const t = scene.add.text(left.x + 10 + i * 82, left.y + 13, label, textStyle(12, T.muted, { fontStyle: 'bold' })).setOrigin(0, 0.5);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.setTab(id));
      return [id, t];
    });
    this.tabLine = scene.add.graphics();
    scene.add.text(right.x + 10, right.y + 13, 'Nơi xuất hiện', textStyle(12, T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5);
    const bar = { track: C.track, thumb: C.thumb };
    this.moveList = new ScrollList(scene, left.x + 5, left.y + 30, left.w - 8, left.h - 35, bar);
    this.fxLayer = scene.add.container(0, 0);
    this.areaList = new ScrollList(scene, right.x + 5, right.y + 30, right.w - 8, right.h - 35, bar);
    this.layer = scene.add.container(0, 0);
    this.drawTabs();
  }

  // Hộp nền tối viền mảnh
  panel(g, x, y, w, h) {
    g.fillStyle(C.panel, C.panelAlpha);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, C.line);
    g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 8);
    g.lineBetween(x + 6, y + 25, x + w - 6, y + 25);
  }

  // Dải tiêu đề mục (Mô tả, Đặc tính): nền tối, vạch xanh ngọc bên trái
  strip(g, x, y, w) {
    g.fillStyle(C.panel, 0.85);
    g.fillRoundedRect(x, y, w, 20, 4);
    g.fillStyle(C.accent);
    g.fillRect(x, y + 3, 3, 14);
  }

  // Con lăn chuột trên hộp chiêu thức / nơi xuất hiện: trả về true nếu đã cuộn
  wheel(px, py, dy) {
    const list = [this.tab === 'moves' ? this.moveList : null, this.areaList].find((l) => l?.contains(px, py));
    if (!list) return false;
    list.scrollBy(Math.sign(dy) * MOVE_ROW * 2);
    this.areaHover(px, py);
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
      t.setColor(on ? T.main : T.muted);
      if (on) {
        this.tabLine.fillStyle(C.accent);
        this.tabLine.fillRoundedRect(t.x, left.y + 22, t.width, 2, 1);
      }
    }
    this.moveList.setVisible(this.tab === 'moves' && this.known);
    this.fxLayer.setVisible(this.tab === 'fx' && this.known);
  }

  // Con trỏ ở (px, py) (toạ độ trong cửa sổ): đang trên dòng "Nơi xuất hiện" có tên bị cắt thì hiện tên đầy đủ ngay dưới
  // dòng đó; ra khỏi dòng thì ẩn
  areaHover(px, py) {
    const list = this.areaList;
    let row = null;
    if (list.content.visible && list.contains(px, py)) {
      const cy = py - list.y + list.offset;
      row = this.areaRows?.find((r) => cy >= r.y && cy < r.y + r.h) ?? null;
    }
    if (row === this.tipRow && (row === null || this.areaTip?.active)) return;
    this.tipRow = row;
    this.areaTip?.destroy();
    this.areaTip = null;
    if (!row?.cut) return;
    const t = this.scene.add.text(list.x + this.areaNameX - 6, list.y - list.offset + row.y + row.h - 2, row.full, textStyle(12, '#ffffff', {
      fontStyle: 'bold', backgroundColor: 'rgba(10,14,26,0.96)', padding: { x: 6, y: 4 },
    }));
    t.setX(Math.min(t.x, list.x + list.w - t.width));
    this.layer.add(t);
    this.areaTip = t;
  }

  show(p, status) {
    const { scene, x, y, w } = this;
    this.areaTip = null;
    this.tipRow = null;
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

    // Tiêu đề: số (+ Poké Ball nếu đã bắt), tên, nhóm loài
    const no = add(scene.add.text(x + 2, y + 2, `No.${dexNo(p.id)}`, textStyle(12, T.muted, { fontStyle: 'bold' })));
    if (status === 'caught') add(scene.add.image(no.x + no.width + 9, no.y + 8, 'ball').setDisplaySize(13, 13));
    add(fitText(scene.add.text(x + 2, y + 16, known ? p.name : '???', textStyle(20, T.main, { fontStyle: 'bold' })), SIDE_W - 4));
    add(fitText(scene.add.text(x + 2, y + 42, known ? p.species : 'Chưa gặp', textStyle(12, T.species, { fontStyle: 'bold' })), SIDE_W - 4));

    // Hình trên bệ sáng (như bệ đứng trong trận), hệ ngay dưới
    const cx = x + SIDE_W / 2;
    const base = y + 146;
    const g = add(scene.add.graphics());
    g.fillStyle(0x58a8e8, 0.25);
    g.fillEllipse(cx, base - 2, 108, 24);
    g.fillStyle(0xd8ecff, 0.55);
    g.fillEllipse(cx, base - 4, 88, 15);
    const key = pixelMon(scene, p.slug);
    const img = add(scene.add.image(cx, base, key).setOrigin(0.5, 1).setScale(fitScale(scene, key, MON_SIZE)));
    if (!known) {
      img.setTintFill(0x070b16).setAlpha(0.85);
      this.renderUnknown(add);
      this.drawTabs();
      return;
    }
    typeBadges(scene, cx, base + 18, p.types, { size: 11, align: 'center' }).forEach(add);

    // Chiều cao / cân nặng
    [['Chiều cao', metric(p.height)], ['Cân nặng', metric(p.weight)]].forEach(([label, value], i) => {
      const ry = base + 36 + i * 17;
      add(scene.add.text(x + 14, ry, label, textStyle(12, T.muted, { fontStyle: 'bold' })));
      add(scene.add.text(x + SIDE_W - 14, ry, value, textStyle(12, T.main, { fontStyle: 'bold' })).setOrigin(1, 0));
    });

    this.renderRadar(add, p, x + SIDE_W + (w - SIDE_W) / 2, y + 88);

    // Mô tả
    add(scene.add.text(x + SIDE_W + 10, this.rows.desc + 26, p.entry.text, textStyle(12, T.main, {
      wordWrap: { width: w - SIDE_W - 14, useAdvancedWrap: true }, maxLines: 3, lineSpacing: 1,
    })));

    // Hàng đặc tính: mỗi đặc tính một ô (đặc tính ẩn màu cam); đặc tính game đã có: rê chuột xem mô tả tiếng Việt
    const n = Math.max(3, p.abilities.length);
    const cw = (w - (n - 1) * 6) / n;
    p.abilities.forEach((a, i) => {
      const ax = x + i * (cw + 6);
      const ay = this.rows.abil + 25;
      const bg = add(scene.add.graphics());
      bg.fillStyle(C.panel, C.panelAlpha);
      bg.fillRoundedRect(ax, ay, cw, 24, 5);
      bg.lineStyle(1, a.hidden ? 0x8a6030 : C.line);
      bg.strokeRoundedRect(ax + 0.5, ay + 0.5, cw - 1, 23, 5);
      const t = add(scene.add.text(ax + 8, ay + 12, `${a.name}${a.hidden ? ' (ẩn)' : ''}`,
        textStyle(12, a.hidden ? T.hidden : T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5));
      fitText(t, cw - 14);
      const info = Object.values(ABILITIES).find((v) => v.name === a.name);
      if (info) this.tooltip(t, info.desc);
    });

    this.renderMoves(p);
    this.renderFx(p);
    this.renderAreas(p);
    this.drawTabs();
  }

  renderUnknown(add) {
    const { scene, x, y, w } = this;
    const cx = x + SIDE_W + (w - SIDE_W) / 2;
    add(scene.add.text(cx, y + 88, 'Chưa gặp', textStyle(24, '#4e6088', { fontStyle: 'bold' })).setOrigin(0.5));
    for (const b of Object.values(this.boxes)) {
      add(scene.add.text(b.x + b.w / 2, b.y + 25 + (b.h - 25) / 2, '???', textStyle(22, '#4e6088', { fontStyle: 'bold' })).setOrigin(0.5));
    }
  }

  tooltip(target, text) {
    const { scene } = this;
    target.setInteractive();
    target.on('pointerover', () => {
      this.tip?.destroy();
      const t = scene.add.text(0, 0, text, textStyle(12, '#ffffff', {
        backgroundColor: '#0d1830', padding: { x: 8, y: 5 }, wordWrap: { width: 250 },
      })).setDepth(50);
      const tx = Math.min(target.x, this.x + this.w - t.width - 4);
      t.setPosition(tx, target.y - target.height / 2 - t.height - 4);
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
    const g = add(scene.add.graphics());
    const ring = (ratio) => RADAR_STATS.map((_, i) => radarPoint(cx, cy, R, i, ratio));
    g.fillStyle(C.panel, 0.55);
    g.fillPoints(ring(1), true);
    g.lineStyle(1, C.line);
    for (const r of [1 / 3, 2 / 3, 1]) g.strokePoints(ring(r), true);
    for (const pt of ring(1)) g.lineBetween(cx, cy, pt.x, pt.y);
    g.lineStyle(1.5, C.accent, 0.9);
    g.strokePoints(ring(1), true);
    const color = TYPES[p.types[0]].color;
    const pts = RADAR_STATS.map((k, i) => radarPoint(cx, cy, R, i, radarRatio(p.stats[k])));
    g.fillStyle(color, 0.6);
    g.fillPoints(pts, true);
    g.lineStyle(2, shade(color, 30));
    g.strokePoints(pts, true);
    g.fillStyle(shade(color, 45));
    for (const pt of pts) g.fillCircle(pt.x, pt.y, 2.2);

    RADAR_STATS.forEach((k, i) => {
      const at = radarPoint(cx, cy, R + 9, i);
      const dx = at.x - cx;
      const ox = Math.abs(dx) < 1 ? 0.5 : dx > 0 ? 0 : 1;
      const oy = i === 0 ? 1 : i === 3 ? 0 : 0.5;
      const label = k === 'hp' ? 'HP' : STAT_NAMES[k];
      add(scene.add.text(at.x, at.y, `${label}\n${p.stats[k]}`, textStyle(11, T.main, { fontStyle: 'bold', align: ox === 0 ? 'left' : ox === 1 ? 'right' : 'center', lineSpacing: -3 }))
        .setOrigin(ox, oy));
    });
    add(scene.add.text(this.x + this.w - 4, cy + R + 20, `Tổng ${p.stats.total}`, textStyle(11, T.muted, { fontStyle: 'bold' })).setOrigin(1, 0.5));
  }

  renderMoves(p) {
    const { scene, moveList } = this;
    const moves = dexMoves(p.slug);
    const w = moveList.w - 10;
    moves.forEach(({ level, move }, i) => {
      const ry = i * MOVE_ROW;
      const type = TYPES[move.type];
      if (i % 2 === 0) {
        const bg = scene.add.graphics();
        bg.fillStyle(0x22355a, 0.55);
        bg.fillRoundedRect(0, ry, w, MOVE_ROW, 5);
        moveList.add(bg);
      }
      moveList.add(scene.add.text(28, ry + MOVE_ROW / 2, level === 'TH' ? 'TH' : `Lv${level}`, textStyle(11, T.muted, { fontStyle: 'bold' })).setOrigin(1, 0.5));
      const pill = scene.add.graphics();
      pill.fillStyle(type?.color ?? 0x8890a0);
      pill.fillRoundedRect(32, ry + 4, 32, MOVE_ROW - 8, 7);
      moveList.add(pill);
      moveList.add(scene.add.text(48, ry + MOVE_ROW / 2, type?.short ?? '?', textStyle(9, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      const name = scene.add.text(69, ry + MOVE_ROW / 2, move.name, textStyle(12, moveColor(type?.color ?? 0x8890a0), { fontStyle: 'bold' })).setOrigin(0, 0.5);
      moveList.add(fitText(name, w - 71));
    });
    if (!moves.length) moveList.add(scene.add.text(6, 6, 'Chưa có dữ liệu.', textStyle(12, T.muted)));
    moveList.setContentHeight(moves.length * MOVE_ROW);
  }

  renderFx(p) {
    const { scene, fxLayer } = this;
    const { left } = this.boxes;
    const colW = (left.w - 12) / 3;
    Object.entries(p.typeDefenses).forEach(([type, mult], i) => {
      const cx = left.x + 7 + (i % 3) * colW;
      const cy = left.y + 32 + Math.floor(i / 3) * 21;
      const g = scene.add.graphics();
      g.fillStyle(TYPES[type].color);
      g.fillRoundedRect(cx, cy, 32, 15, 7);
      fxLayer.add(g);
      fxLayer.add(scene.add.text(cx + 16, cy + 7.5, TYPES[type].short, textStyle(9, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5));
      fxLayer.add(scene.add.text(cx + 35, cy + 7.5, FX_LABEL[mult] ?? `×${mult}`, textStyle(12, fxColor(mult), { fontStyle: 'bold' })).setOrigin(0, 0.5));
    });
  }

  // Nơi xuất hiện, mỗi bản đồ một dòng: [cỏ][nước] [ngày][chiều][đêm] tên nơi. Icon sáng = có xuất hiện (hang tính
  // là cỏ, câu cá tính là nước; buổi nào xuất hiện thì icon buổi đó sáng), mờ = không (ui/envIcons.js)
  renderAreas(p) {
    const { scene, areaList } = this;
    const w = areaList.w - 12;
    const places = dexPlaces(p.slug);
    // Ba nhóm cách nhau, có vạch ngăn mờ: [cỏ nước] | [ngày chiều đêm] | tên nơi
    const ROW = 26;
    const GRASS = 12;
    const WATER = 34;
    const TIMES = [60, 82, 104];
    const NAME = 124;
    this.areaRows = [];
    this.areaNameX = NAME;
    places.forEach((place, i) => {
      const y = 2 + i * ROW;
      const cy = y + ROW / 2 - 1;
      const g = scene.add.graphics();
      g.fillStyle(0xffffff, i % 2 === 0 ? 0.05 : 0.025);
      g.fillRoundedRect(0, y + 1, w + 4, ROW - 3, 5);
      g.lineStyle(1, 0xffffff, 0.12);
      for (const x of [(WATER + TIMES[0]) / 2, (TIMES[2] + NAME) / 2 - 1]) g.lineBetween(x, y + 6, x, y + ROW - 8);
      drawEnvIcon(g, 'grass', GRASS, cy, place.land);
      drawEnvIcon(g, 'water', WATER, cy, place.water);
      ['day', 'dusk', 'night'].forEach((t, k) => drawEnvIcon(g, t, TIMES[k], cy, place.times.has(t)));
      areaList.add(g);
      // Tên dài: giữ cỡ chữ, cắt bớt kèm "…"; rê chuột / bấm vào dòng thì hiện tên đầy đủ (areaHover)
      const name = fitText(scene.add.text(NAME, cy, place.mapName, textStyle(12, T.main, { fontStyle: 'bold' })).setOrigin(0, 0.5), w - NAME + 2);
      areaList.add(name);
      this.areaRows.push({ y, h: ROW, full: place.mapName, cut: name.text !== place.mapName });
    });
    if (!places.length) {
      areaList.add(scene.add.text(4, 4, 'Không gặp ngoài tự nhiên.', textStyle(12, T.muted, { wordWrap: { width: w } })));
    }
    areaList.setContentHeight(places.length ? places.length * ROW + 4 : 0);
  }
}
