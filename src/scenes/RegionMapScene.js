import Phaser from 'phaser';
import { PLACES, REGION_NAME, placeOf, placePoint } from '../data/region.js';
import { state } from '../game/state.js';
import { BLEED, backToWorld, centerStage, closeButton, gradientRect, textStyle } from '../ui/helpers.js';
import { InputRouter } from '../ui/input.js';
import { matches } from '../game/keybinds.js';

const LAND = 0x8cc870;
const LAND_DARK = 0x6aa858;
const ROUTE = 0xf0dca0;
const ROUTE_EDGE = 0x8a6a3a;
const FUTURE = 0x6a8a68;

// Bản đồ vùng Sơn Thủy: thị trấn, tuyến đường, hang động; nơi đã tới hiện tên, chưa tới hiện "???".
// Chấm đỏ nhấp nháy là vị trí hiện tại. Hàng dưới cùng là 8 huy hiệu gym.
export default class RegionMapScene extends Phaser.Scene {
  constructor() {
    super('RegionMap');
  }

  init(data) {
    this.here = placeOf(data?.mapId);
  }

  create() {
    // Màn hình rộng: khung 960x720 nằm giữa, biển tràn ra hai bên
    centerStage(this);
    const width = 960;
    const height = 720;
    const g = this.add.graphics();
    gradientRect(g, -BLEED, 0, width + BLEED * 2, height, 0x3a88c8, 0x1e5a98);
    this.drawLand(g);
    this.drawRoutes(g);
    // Chú thích khi rê chuột: đặt dưới tiêu đề để không che các thị trấn phía nam
    this.label = this.add.text(width / 2, 112, '', textStyle(20, '#ffffff', {
      fontStyle: 'bold', backgroundColor: 'rgba(20,26,44,0.82)', padding: { x: 14, y: 6 },
    })).setOrigin(0.5).setVisible(false);
    this.drawPlaces();
    this.drawHeader();
    // Huy hiệu xem ở Thẻ Huấn luyện viên (ui/TrainerCard.js), bản đồ vùng chỉ còn bản đồ

    this.router = new InputRouter(this);
    // Đóng bằng nút ✕ hoặc phím Bản đồ vùng; Esc / phím quay lại / chuột phải không đóng
    this.router.set((e) => matches(e, 'map') && !e.repeat && this.close());
    closeButton(this, width - 34, 34, () => this.close(), 36);
    this.cameras.main.fadeIn(200);
  }

  close() {
    backToWorld(this);
  }

  // Đất liền: vài khối tròn chồng lên nhau, núi rải rác
  drawLand(g) {
    g.fillStyle(LAND_DARK);
    for (const [x, y, rx, ry] of [[470, 370, 380, 270], [220, 300, 150, 220], [760, 420, 160, 230], [600, 150, 260, 110]]) g.fillEllipse(x, y + 8, rx * 2, ry * 2);
    g.fillStyle(LAND);
    for (const [x, y, rx, ry] of [[470, 370, 380, 270], [220, 300, 150, 220], [760, 420, 160, 230], [600, 150, 260, 110]]) g.fillEllipse(x, y, rx * 2, ry * 2);
    g.fillStyle(0x5a7a4a);
    for (const [x, y] of [[400, 470], [440, 455], [520, 260], [560, 280], [330, 400], [700, 300]]) g.fillTriangle(x - 22, y + 16, x, y - 22, x + 22, y + 16);
    g.fillStyle(0xe8f0f0);
    for (const [x, y] of [[400, 470], [440, 455], [520, 260], [560, 280], [330, 400], [700, 300]]) g.fillTriangle(x - 7, y - 11, x, y - 22, x + 7, y - 11);
  }

  drawRoutes(g) {
    for (const p of PLACES.filter((pl) => pl.path)) {
      const known = !p.future && state.visited.has(p.id);
      g.lineStyle(14, p.future ? 0x4a6a48 : ROUTE_EDGE, p.future ? 0.6 : 1);
      g.strokePoints(p.path.map(([x, y]) => ({ x, y })));
      // Đường sông (chỉ lướt nước): màu nước
      const color = p.water ? (known ? 0x58a8e8 : 0x8ab8d0) : known ? ROUTE : 0xc8b888;
      g.lineStyle(9, p.future ? FUTURE : color, p.future ? 0.7 : 1);
      g.strokePoints(p.path.map(([x, y]) => ({ x, y })));
      if (!p.future) this.hotspot(p, ...placePoint(p), 28);
    }
  }

  drawPlaces() {
    for (const p of PLACES.filter((pl) => !pl.path)) {
      const g = this.add.graphics();
      const known = !p.future && state.visited.has(p.id);
      if (p.kind === 'cave') {
        g.fillStyle(0x3a2e28);
        g.fillTriangle(p.x - 20, p.y + 14, p.x, p.y - 18, p.x + 20, p.y + 14);
        g.fillStyle(known ? 0x18120e : 0x5a4a40);
        g.fillEllipse(p.x, p.y + 8, 14, 12);
      } else {
        const s = p.kind === 'league' ? 30 : p.kind === 'village' ? 16 : 24;
        g.fillStyle(0x1e2a44);
        g.fillRoundedRect(p.x - s / 2 - 3, p.y - s / 2 - 3, s + 6, s + 6, 6);
        g.fillStyle(p.future ? 0x8a9488 : known ? (p.kind === 'league' ? 0xf0c040 : 0xe85448) : 0xb8b8b8);
        g.fillRoundedRect(p.x - s / 2, p.y - s / 2, s, s, 5);
        if (p.gym && state.badges.has(p.gym)) {
          g.fillStyle(0xffe066);
          g.fillCircle(p.x + s / 2, p.y - s / 2, 6);
        }
      }
      if (!p.future) {
        // Làng nhỏ nằm sát thành phố: tên làng đặt phía trên / bên phải để không đè lên tên thành phố
        const [lx, ly, ox, oy] = p.label === 'above' ? [p.x, p.y - 14, 0.5, 1] : p.label === 'right' ? [p.x + 14, p.y, 0, 0.5] : [p.x, p.y + 22, 0.5, 0];
        this.add.text(lx, ly, known ? p.name : '???', textStyle(p.kind === 'village' ? 13 : 15, '#ffffff', { fontStyle: 'bold', stroke: '#1e2a44', strokeThickness: 4 })).setOrigin(ox, oy);
        this.hotspot(p, p.x, p.y, 34);
      } else {
        this.add.text(p.x, p.y, '?', textStyle(16, '#e8f0e8', { fontStyle: 'bold' })).setOrigin(0.5);
      }
    }
    // Vị trí hiện tại
    const here = PLACES.find((p) => p.id === this.here);
    if (here) {
      const [x, y] = placePoint(here);
      const ring = this.add.circle(x, y, 14).setStrokeStyle(4, 0xff3a3a);
      const dot = this.add.circle(x, y, 7, 0xff3a3a).setStrokeStyle(2, 0xffffff);
      this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 900, repeat: -1 });
      this.tweens.add({ targets: dot, scale: 1.25, duration: 450, yoyo: true, repeat: -1 });
    }
  }

  // Rê chuột vào nơi đã biết thì hiện tên
  hotspot(place, x, y, size) {
    const zone = this.add.zone(x, y, size, size).setInteractive();
    zone.on('pointerover', () => this.label.setText(state.visited.has(place.id) ? place.name : '???').setVisible(true));
    zone.on('pointerout', () => this.label.setVisible(false));
  }

  drawHeader() {
    const here = PLACES.find((p) => p.id === this.here);
    this.add.text(28, 18, REGION_NAME.toUpperCase(), textStyle(30, '#ffffff', { fontStyle: 'bold', stroke: '#1e3a68', strokeThickness: 6 }));
    this.add.text(30, 60, `Bạn đang ở: ${here ? here.name : '—'}`, textStyle(18, '#ffe9a0', { fontStyle: 'bold' }));
  }
}
