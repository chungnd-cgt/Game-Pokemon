import Phaser from 'phaser';
import { TILE, WORLD_SCALE } from '../config.js';
import { PHASE_NAMES, gameClock, timeOfDay } from '../game/clock.js';
import { settings } from '../game/settings.js';
import { weatherOf } from '../game/weather.js';

// Ánh sáng theo buổi trong ngày (đồng hồ trong game) và thời tiết theo vùng khí hậu cho bản đồ ngoài trời

// Màu phủ (nhân màu) cho từng buổi: [màu, độ đậm]
const TINTS = {
  day: null,
  dusk: [0xff9a6a, 0.4],
  night: [0x2a3a90, 0.6],
};
const CAVE_TINT = [0x3a2e48, 0.42];
// Màu phủ thêm khi có thời tiết (cộng với màu theo buổi)
const WEATHER_TINT = {
  rain: [0x7a8aa8, 0.38],
  snow: [0xc8d4ec, 0.22],
  hail: [0x98acd0, 0.34],
  sand: [0xd0a060, 0.48],
};
// Hạt thời tiết: tuyết (chấm trắng mềm), mưa đá (hạt băng), cát (vệt ngang)
function ensureWeatherTextures(scene) {
  const make = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  make('fx-snow', 8, 8, (g) => {
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 2.4);
  });
  make('fx-hail', 6, 6, (g) => {
    g.fillStyle(0xd8ecff, 1);
    g.fillRect(1, 1, 4, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRect(1, 1, 2, 2);
  });
  make('fx-sand', 30, 5, (g) => {
    g.fillStyle(0xc89850, 0.8);
    g.fillRect(0, 2, 30, 2);
    g.fillStyle(0xf0d8a0, 1);
    g.fillRect(10, 1, 14, 3);
  });
  // bụi mù: đám bụi tròn mờ trôi theo gió
  make('fx-dust', 48, 48, (g) => {
    for (let r = 24; r > 0; r -= 4) {
      g.fillStyle(0xd8b878, 0.08);
      g.fillCircle(24, 24, r);
    }
  });
}

// Vị trí cửa sổ trên ảnh nhà (pixel 16px/ô, tính từ góc nhà) để thắp đèn ban đêm
const WINDOWS = {
  big: [[10, 34], [56, 34], [32, 42]],
  small: [[39, 34], [16, 42]],
  league: [[11, 34], [87, 34], [48, 42]],
  lab: [[8, 58], [26, 58], [72, 58], [90, 58]],
};

export class Ambience {
  // area: { y, h } dải màn hình được phủ (mặc định cả màn hình). Phủ hết chiều ngang màn hình, đổi cỡ màn hình thì tự giãn theo
  constructor(scene, { depth = 50, rainDepth = 52, area = null } = {}) {
    this.scene = scene;
    const { width, height } = scene.scale;
    const a = { y: area?.y ?? 0, h: area?.h ?? height, full: !area };
    this.area = a;
    this.overlay = scene.add.rectangle(0, a.y, width, a.h, 0xffffff).setOrigin(0).setScrollFactor(0)
      .setDepth(depth).setBlendMode(Phaser.BlendModes.MULTIPLY).setVisible(false);
    this.lights = [];
    this.lightDepth = depth + 1;
    this.rain = scene.add.particles(0, 0, 'fx-rain', {
      x: { min: -120, max: width + 40 },
      y: -30,
      lifespan: 900,
      speedY: { min: 820, max: 1000 },
      speedX: { min: -190, max: -150 },
      rotate: 11,
      alpha: { start: 0.55, end: 0.25 },
      scaleY: { min: 0.8, max: 1.4 },
      quantity: 3,
      frequency: 16,
      emitting: false,
    }).setScrollFactor(0).setDepth(rainDepth);
    this.splash = scene.add.particles(0, 0, 'fx-ring', {
      x: { min: 0, max: width },
      y: { min: a.y + 60, max: a.y + a.h },
      lifespan: 320,
      scale: { start: 0.06, end: 0.2 },
      alpha: { start: 0.5, end: 0 },
      tint: 0xd8e8ff,
      quantity: 1,
      frequency: 45,
      emitting: false,
    }).setScrollFactor(0).setDepth(rainDepth);
    ensureWeatherTextures(scene);
    const spanX = { x: { min: -60, max: width + 60 } };
    this.snow = scene.add.particles(0, 0, 'fx-snow', {
      ...spanX, y: -10, lifespan: 4200, speedY: { min: 90, max: 150 }, speedX: { min: -40, max: 30 },
      scale: { min: 0.6, max: 1.4 }, alpha: { start: 0.95, end: 0.5 }, quantity: 1, frequency: 45, emitting: false,
    }).setScrollFactor(0).setDepth(rainDepth);
    this.hail = scene.add.particles(0, 0, 'fx-hail', {
      ...spanX, y: -10, lifespan: 800, speedY: { min: 700, max: 900 }, speedX: { min: -120, max: -60 },
      rotate: { min: 0, max: 90 }, scale: { min: 0.8, max: 1.5 }, quantity: 2, frequency: 30, emitting: false,
    }).setScrollFactor(0).setDepth(rainDepth);
    this.sand = scene.add.particles(0, 0, 'fx-sand', {
      x: width + 40, y: { min: a.y - 40, max: a.y + a.h + 20 }, lifespan: 1500, speedX: { min: -1000, max: -650 },
      speedY: { min: 60, max: 160 }, rotate: 8, scaleX: { min: 0.8, max: 2.2 }, scaleY: { min: 0.8, max: 1.6 },
      alpha: { start: 1, end: 0.6 }, quantity: 4, frequency: 16, emitting: false,
    }).setScrollFactor(0).setDepth(rainDepth);
    this.dust = scene.add.particles(0, 0, 'fx-dust', {
      x: width + 120, y: { min: a.y - 60, max: a.y + a.h + 60 }, lifespan: 3200, speedX: { min: -480, max: -320 },
      speedY: { min: 10, max: 50 }, scale: { min: 3, max: 6 }, alpha: { start: 0.9, end: 0.4 }, quantity: 1, frequency: 70, emitting: false,
    }).setScrollFactor(0).setDepth(rainDepth - 0.5);
    this.state = { tod: timeOfDay(), weather: null, rain: false, outdoor: false };
    const onResize = () => this.resize();
    scene.scale.on('resize', onResize);
    scene.events.once('shutdown', () => scene.scale.off('resize', onResize));
  }

  // Màn hình đổi cỡ (đổi độ phân giải, xoay máy, bật toàn màn hình): lớp phủ và vùng sinh hạt thời tiết giãn theo
  resize() {
    const { width, height } = this.scene.scale;
    const a = this.area;
    if (a.full) a.h = height;
    this.overlay.setSize(width, a.h);
    this.rain.updateConfig({ x: { min: -120, max: width + 40 } });
    this.splash.updateConfig({ x: { min: 0, max: width }, y: { min: a.y + 60, max: a.y + a.h } });
    for (const e of [this.snow, this.hail]) e.updateConfig({ x: { min: -60, max: width + 60 } });
    this.sand.updateConfig({ x: width + 40 });
    this.dust.updateConfig({ x: width + 120 });
  }

  // Bật đúng loại hạt thời tiết (null: tắt hết). Trận đấu cũng gọi khi thời tiết trong trận đổi
  setPrecip(kind) {
    const sets = { rain: [this.rain, this.splash], snow: [this.snow], hail: [this.hail], sand: [this.sand, this.dust] };
    for (const [k, emitters] of Object.entries(sets)) {
      for (const e of emitters) {
        if (k === kind) {
          if (!e.emitting) e.start();
        } else if (e.emitting) e.stop();
      }
    }
  }

  // indoor: trong nhà thì không phủ màu, không mưa. buildings: nhà trên bản đồ (để thắp đèn cửa sổ)
  // cave: trong hang luôn tối, không mưa
  // climate: vùng khí hậu ('normal' | 'snow' | 'sand') để chọn thời tiết
  // weather: ép thời tiết cố định (trận đấu dùng đúng thời tiết ngoài bản đồ lúc vào trận); bỏ trống thì theo vùng khí hậu
  apply({ indoor = false, buildings = [], cave = false, lanterns = [], climate = 'normal', weather } = {}) {
    this.indoor = indoor || cave;
    this.cave = cave;
    this.climate = climate;
    this.forcedWeather = weather;
    this.buildings = buildings;
    this.lanterns = lanterns;
    this.refresh(true);
  }

  refresh(force = false) {
    // Cài đặt → Đồ hoạ: ánh sáng theo buổi và hình ảnh thời tiết bật / tắt riêng (chỉ là hình ảnh, không đổi luật trận đấu)
    const light = settings.lighting !== false;
    const showWeather = settings.weather !== false;
    const outdoor = (light || showWeather) && !this.indoor;
    const tod = timeOfDay();
    const weather = !outdoor || !showWeather ? null : this.forcedWeather !== undefined ? this.forcedWeather : weatherOf(this.climate);
    if (!force && tod === this.state.tod && weather === this.state.weather && outdoor === this.state.outdoor) return;
    this.state = { tod, weather, rain: weather === 'rain', outdoor };

    let tint = outdoor && light ? TINTS[tod] : null;
    if (this.cave && light) tint = CAVE_TINT;
    const wt = WEATHER_TINT[weather];
    if (wt) tint = tint ? [weather === 'rain' ? tint[0] : wt[0], Math.min(0.75, tint[1] + 0.12)] : wt;
    this.overlay.setVisible(Boolean(tint));
    if (tint) this.overlay.setFillStyle(tint[0], tint[1]);

    this.lights.forEach((l) => l.destroy());
    this.lights = [];
    if (outdoor && light && (tod === 'night' || tod === 'dusk')) this.lightWindows();
    this.setPrecip(weather);
  }

  // Ban đêm: cửa sổ và cửa ra vào sáng đèn vàng ấm, có quầng sáng
  lightWindows() {
    const { scene } = this;
    for (const b of this.buildings) {
      const spots = WINDOWS[b.type] ?? (b.w >= 5 ? WINDOWS.big : WINDOWS.small);
      for (const [dx, dy] of spots) {
        const x = (b.x * TILE + dx) * WORLD_SCALE;
        const y = (b.y * TILE + dy) * WORLD_SCALE;
        const pane = scene.add.rectangle(x, y, 14 * WORLD_SCALE, 12 * WORLD_SCALE, 0xffd878, 0.55).setOrigin(0).setDepth(this.lightDepth);
        const glow = scene.add.image(x + 7 * WORLD_SCALE, y + 6 * WORLD_SCALE, 'fx-glow').setScale(0.65 * WORLD_SCALE).setTint(0xffc860)
          .setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.lightDepth);
        this.lights.push(pane, glow);
      }
    }
    // Cột đèn lồng / đèn đường: quầng sáng đỏ cam; đèn lồng nhỏ trên dây (small) quầng nhỏ, mờ hơn
    for (const { x, y, small } of this.lanterns) {
      const glow = scene.add.image((x * TILE + 8) * WORLD_SCALE, (y * TILE + 7) * WORLD_SCALE, 'fx-glow').setScale((small ? 0.22 : 0.5) * WORLD_SCALE)
        .setTint(small ? 0xff7848 : 0xff9040).setAlpha(small ? 0.6 : 0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.lightDepth);
      this.lights.push(glow);
    }
  }

  // Thông tin hiện ở góc màn hình: buổi + giờ trong game (thời tiết đã thấy trên màn hình nên không ghi)
  label(date = new Date()) {
    // Icon buổi trong ngày (có màu) do HUD vẽ riêng cạnh dòng chữ này (ui/WorldHud.js)
    return `${PHASE_NAMES[this.state.tod]}  ${gameClock(date).time}`;
  }
}
