import Phaser from 'phaser';
import { STATUS_INFO } from '../battle/status.js';
import { FONT, GAME_WIDTH, MAX_WIDTH } from '../config.js';

const { Color } = Phaser.Display;

// Khung thiết kế 960x720 nằm giữa màn hình rộng: lệch sang phải chừng này px (0 khi màn hình 4:3).
// Bảng / menu vẽ theo toạ độ trong khung: đặt container ở x = uiX(scene), đổi toạ độ chuột: p.x - uiX(scene)
export const uiX = (scene) => Math.round((scene.scale.width - GAME_WIDTH) / 2);
// Toạ độ con trỏ trong khung thiết kế (dùng để so với vị trí nút / ô trong bảng). Màn có camera riêng thu nhỏ (trận đấu
// dạng cửa sổ nổi: battleStage) thì đổi qua camera đó (scene.stagePoint)
export const localX = (scene, p) => (scene.stagePoint ? scene.stagePoint(p).x : p.x - uiX(scene));
export const localY = (scene, p) => (scene.stagePoint ? scene.stagePoint(p).y : p.y);

// Cỡ giao diện trên bản đồ (game/display.js: hudScaleFor; WorldScene đặt scene.hudScale). Các phần giao diện (cột đội hình,
// thanh phím tắt...) xếp chỗ theo cỡ "ảo" hudSize = cỡ màn hình / hệ số, rồi phóng to cả cụm theo hệ số (container.setScale).
// Toạ độ chuột trên màn hình đổi sang toạ độ ảo: chia cho hệ số
export const hudScale = (scene) => scene.hudScale ?? 1;
export function hudSize(scene) {
  const s = hudScale(scene);
  return { width: scene.scale.width / s, height: scene.scale.height / s, s };
}

// Bảng đang mở trên bản đồ (cố định theo màn hình) mà màn hình đổi cỡ (xoay máy, bật toàn màn hình, kéo cửa sổ):
// dời các phần của bảng theo khung giữa màn hình. objs: mảng (có thể thêm phần tử sau). Trả về hàm thôi theo dõi;
// phần tử đầu bị huỷ thì tự thôi
export function followCenter(scene, objs) {
  let ox = uiX(scene);
  const onResize = () => {
    const nx = uiX(scene);
    const d = nx - ox;
    ox = nx;
    if (d) for (const o of objs) if (o?.active) o.x += d;
  };
  scene.scale.on('resize', onResize);
  const off = () => scene.scale.off('resize', onResize);
  objs[0]?.once?.('destroy', off);
  return off;
}

// Lề thừa tối đa mỗi bên (màn hình rộng nhất, MAX_WIDTH): nền của màn hình toàn khung vẽ tràn ra chừng này để luôn kín
export const BLEED = (MAX_WIDTH - GAME_WIDTH) / 2;

// Màn hình toàn khung (trận đấu, Pokédex, cửa hàng...): toạ độ vẽ theo khung 960x720, camera dịch để khung nằm giữa.
// Nền vẽ tràn BLEED px mỗi bên. Đổi cỡ màn hình giữa chừng thì dịch lại camera
export function centerStage(scene) {
  const cam = scene.cameras.main;
  const place = () => cam.setScroll(-uiX(scene), 0);
  place();
  scene.scale.on('resize', place);
  scene.events.once('shutdown', () => scene.scale.off('resize', place));
}

// Trận đấu là cửa sổ nổi (bản đồ tạm dừng, mờ tối phía sau). Toạ độ trong trận: sân 960x548 + hộp thoại ở x 0..960,
// y 0..712; cột lệnh bên phải x 972..1272 (ui/BattlePanel.js); thanh tiêu đề phía trên (y -50..-6). BATTLE_FRAME bao cả
// khung, thu nhỏ tối đa BATTLE_ZOOM lần cho vừa màn hình. Kéo thanh tiêu đề để dời cửa sổ (nhớ chỗ trong lúc chơi)
export const BATTLE_ZOOM = 0.62;
export const BATTLE_FRAME = { x: -12, y: -50, w: 1296, h: 774 };
// Khoảng trống trong suốt phía trên khung: biểu tượng góc trái (2 quả cầu va nhau) nổi lên trên thanh tiêu đề
export const BATTLE_BLEED = 24;
const battleOffset = { x: 0, y: 0 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Chỗ camera trận đấu trên màn hình { x, y, w, h, z, top } (gồm cả khoảng trống phía trên khung: top px màn hình).
// WorldScene vẽ khung lúc mở ra quanh phần khung (bỏ phần top)
export function battleRect(scene) {
  const { width, height } = scene.scale;
  // Màn hình thấp (điện thoại nằm ngang): cửa sổ to hết cỡ cho chữ đọc được
  const small = (scene.scale.displaySize?.height ?? 720) < 600;
  const fullH = BATTLE_FRAME.h + BATTLE_BLEED;
  const z = Math.min(small ? 1 : BATTLE_ZOOM, (width - 24) / BATTLE_FRAME.w, (height - 8) / fullH);
  const w = Math.round(BATTLE_FRAME.w * z);
  const h = Math.round(fullH * z);
  const x = Math.round(clamp((width - w) / 2 + battleOffset.x, 0, Math.max(0, width - w)));
  const y = Math.round(clamp((height - h) / 2 + battleOffset.y, 0, Math.max(0, height - h)));
  return { x, y, w, h, z, top: Math.round(BATTLE_BLEED * z) };
}

// Kéo cửa sổ trận đấu (px màn hình), giữ trong màn hình
export function moveBattle(scene, dx, dy) {
  const r = battleRect(scene);
  const { width, height } = scene.scale;
  battleOffset.x = clamp(r.x + dx, 0, Math.max(0, width - r.w)) - (width - r.w) / 2;
  battleOffset.y = clamp(r.y + dy, 0, Math.max(0, height - r.h)) - (height - r.h) / 2;
}

// Camera của trận đấu: chỉ vẽ trong battleRect, thu nhỏ cả khung cho vừa. Chuột đổi qua camera (stagePoint).
// scene.placeStage(): đặt lại (sau khi kéo cửa sổ)
// Camera phụ scene.overlayCam phủ cả màn hình, cùng phép biến đổi với camera chính (cùng chỗ, cùng tỉ lệ): chỉ vẽ những
// đối tượng được phép tràn ra ngoài khung trận đấu (showOverlay, vd ô chi tiết chiêu ui/BattlePanel.js); mọi đối tượng
// khác thêm vào scene đều bị camera này bỏ qua
export function battleStage(scene) {
  const cam = scene.cameras.main;
  const over = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height);
  over.inputEnabled = false;
  const hide = (go) => {
    go.cameraFilter |= over.id;
  };
  scene.events.on('addedtoscene', hide);
  scene.events.once('shutdown', () => scene.events.off('addedtoscene', hide));
  scene.overlayCam = over;
  const place = () => {
    const r = battleRect(scene);
    const F = BATTLE_FRAME;
    const cx = F.x + F.w / 2;
    const cy = F.y - BATTLE_BLEED + (F.h + BATTLE_BLEED) / 2;
    cam.setViewport(r.x, r.y, r.w, r.h).setZoom(r.z).centerOn(cx, cy);
    const { width, height } = scene.scale;
    over.setViewport(0, 0, width, height).setZoom(r.z)
      .centerOn(cx - (r.x + r.w / 2 - width / 2) / r.z, cy - (r.y + r.h / 2 - height / 2) / r.z);
  };
  place();
  // Nền trong suốt: khoảng trống phía trên khung để lộ bản đồ phía sau (khung tự vẽ nền, ui/BattlePanel.js)
  cam.setBackgroundColor('rgba(0,0,0,0)');
  scene.placeStage = place;
  scene.stagePoint = (p) => cam.getWorldPoint(p.x, p.y);
  // Toạ độ trên màn hình của điểm (x, y) trong trận
  scene.stageToScreen = (x, y) => ({
    x: cam.x + cam.width / 2 + (x - cam.scrollX - cam.width / 2) * cam.zoom,
    y: cam.y + cam.height / 2 + (y - cam.scrollY - cam.height / 2) * cam.zoom,
  });
  scene.scale.on('resize', place);
  scene.events.once('shutdown', () => scene.scale.off('resize', place));
}

export const COLORS = {
  ink: 0x2c3550, // viền khung
  text: '#30343c',
  textShadow: '#c8ccd6',
};

// fontStyle mặc định đậm 700, 'bold' = 800
export const textStyle = (size, color = COLORS.text, extra = {}) => {
  const { fontStyle, ...rest } = extra;
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: fontStyle === 'bold' ? '800' : (fontStyle ?? '700'),
    ...rest,
  };
};

// flat = true: nền trắng trơn, không có dải màu nửa dưới
export function drawPanel(scene, x, y, w, h, radius = 16, flat = false, shadow = true) {
  const g = scene.add.graphics();
  if (shadow) {
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(x + 4, y + 6, w, h, radius);
  }
  g.fillStyle(COLORS.ink);
  g.fillRoundedRect(x, y, w, h, radius);
  g.fillStyle(0xffffff);
  g.fillRoundedRect(x + 5, y + 5, w - 10, h - 10, radius - 4);
  if (!flat) {
    g.fillStyle(0xeef2f8);
    g.fillRoundedRect(x + 5, y + h / 2, w - 10, h / 2 - 5, { tl: 0, tr: 0, bl: radius - 4, br: radius - 4 });
  }
  g.lineStyle(2, 0xc8d4e8);
  g.strokeRoundedRect(x + 10, y + 10, w - 20, h - 20, radius - 7);
  return g;
}

export function shade(color, amount) {
  const c = Color.IntegerToColor(color);
  if (amount > 0) c.lighten(amount);
  else c.darken(-amount);
  return c.color;
}

// Màn hình phụ chạy chồng lên bản đồ (World tạm dừng, vd Pokédex mở bằng phím P): ẩn giao diện bản đồ phía sau cho đỡ rối.
// World chạy lại thì update() tự hiện lại
export function hideWorldHud(scene) {
  const world = scene.scene.get('World');
  if (!world?.hud) return;
  for (const part of [world.hud, world.partyPanel, world.areaNav, world.hotbar]) part?.setVisible(false);
}

// Đóng màn hình phụ (Poké Mart, Pokédex, thông tin Pokémon, bản đồ vùng) và quay lại bản đồ
export function backToWorld(scene) {
  scene.router.clear();
  scene.scene.stop();
  scene.scene.resume('World');
}

export function cssColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function gradientRect(g, x, y, w, h, top, bottom, steps = 32) {
  const a = Color.IntegerToColor(top);
  const b = Color.IntegerToColor(bottom);
  const band = h / steps;
  for (let i = 0; i < steps; i++) {
    const c = Color.Interpolate.ColorWithColor(a, b, steps - 1, i);
    g.fillStyle(Color.GetColor(c.r, c.g, c.b));
    g.fillRect(x, Math.floor(y + i * band), w, Math.ceil(band) + 1);
  }
}

export const hpColor = (ratio) => (ratio > 0.5 ? 0x38d068 : ratio > 0.2 ? 0xf8c030 : 0xf04838);

// Thanh máu kiểu viên thuốc: 44px đầu chừa cho nhãn "HP" (hpLabel), phần còn lại là rãnh máu
export function drawHpBar(g, x, y, w, ratio) {
  const r = Phaser.Math.Clamp(ratio, 0, 1);
  g.fillStyle(0x3a4250);
  g.fillRoundedRect(x, y, w, 22, 11);
  const tx = x + 44;
  const tw = w - 50;
  g.fillStyle(0x1e242c);
  g.fillRoundedRect(tx, y + 5, tw, 12, 6);
  if (r > 0) {
    const fw = Math.max(12, tw * r);
    const color = hpColor(r);
    g.fillStyle(color);
    g.fillRoundedRect(tx, y + 5, fw, 12, 6);
    g.fillStyle(shade(color, 25));
    g.fillRoundedRect(tx + 3, y + 6, fw - 6, 4, 2);
  }
}

// Nhãn "HP" vàng nằm ở đầu thanh máu drawHpBar(g, x, y, ...) (cùng kiểu với khung trong trận đấu)
export function hpLabel(scene, x, y) {
  return scene.add.text(x + 12, y + 2, 'HP', textStyle(16, '#ffcc33', { fontStyle: 'bold' }));
}

// Chữ dài quá maxW (tên Pokémon đặt biệt danh dài, tên vật phẩm...): thu nhỏ chữ tới minScale (giữ nguyên tâm theo chiều
// dọc), vẫn dài thì cắt bớt và thêm "…". Trả về chính object chữ (độ rộng hiển thị text.displayWidth <= maxW).
// Gọi một lần cho mỗi lần đặt chữ (chữ đã thu nhỏ thì đặt lại toạ độ trước khi gọi lại)
export function fitText(text, maxW, minScale = 1) {
  text.setScale(1);
  if (text.width <= maxW) return text;
  const scale = Math.max(minScale, maxW / text.width);
  if (scale < 1) {
    text.setScale(scale);
    text.y += text.height * (1 - scale) * (0.5 - text.originY);
  }
  const room = maxW / text.scaleX;
  let s = text.text;
  while (s.length > 1 && text.width > room) {
    s = s.slice(0, -1);
    text.setText(`${s.trimEnd()}…`);
  }
  return text;
}


// Ghim object (và mọi con của nó) vào màn hình, không trôi theo camera
export function fixToCamera(obj) {
  obj.setScrollFactor(0);
  obj.list?.forEach(fixToCamera);
  return obj;
}

export function tweenAsync(scene, config) {
  return new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });
}

export function wait(scene, ms) {
  return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
}

export const GENDER = {
  male: { symbol: '♂', color: '#3a7ae0' },
  female: { symbol: '♀', color: '#e8508a' },
};

// Nhãn trạng thái xấu (BỎNG, ĐỘC, TÊ, NGỦ, BĂNG) dạng viên màu, hoặc null nếu không có trạng thái
export function statusTag(scene, x, y, status, size = 15) {
  const info = STATUS_INFO[status];
  if (!info) return null;
  return scene.add.text(x, y, info.label, textStyle(size, '#ffffff', {
    fontStyle: 'bold', backgroundColor: cssColor(info.color), padding: { x: 7, y: 2 },
  }));
}

// Nhãn trạng thái xấu của Pokémon (hoặc null). Pokémon đã gục không có nhãn: chỉ làm mờ hình / thanh HP trống
export const monTag = (scene, x, y, mon, size = 15) => (mon.hp > 0 ? statusTag(scene, x, y, mon.status, size) : null);

// Nút ✕ tròn để đóng màn hình / menu bằng chuột (Esc có thể bị trình duyệt nhúng giữ lại)
export function closeButton(scene, x, y, onClick, size = 30) {
  const r = size / 2;
  const g = scene.add.graphics();
  const draw = (hover) => {
    g.clear();
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(x + 2, y + 3, r);
    g.fillStyle(hover ? 0xe04848 : COLORS.ink);
    g.fillCircle(x, y, r);
    g.lineStyle(3, 0xffffff);
    const d = r * 0.42;
    g.lineBetween(x - d, y - d, x + d, y + d);
    g.lineBetween(x - d, y + d, x + d, y - d);
  };
  draw(false);
  const zone = scene.add.zone(x, y, size + 6, size + 6).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => draw(true));
  zone.on('pointerout', () => draw(false));
  zone.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    onClick();
  });
  return [g, zone];
}
