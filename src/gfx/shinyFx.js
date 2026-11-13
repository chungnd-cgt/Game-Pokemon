import Phaser from 'phaser';

// Hiệu ứng lấp lánh của Pokémon shiny: ngôi sao 4 cánh trắng / vàng.
//  shinyBurst(scene, sprite)          : lúc Pokémon shiny vừa ra sân (vòng sao bung ra + vài ngôi sao chớp trên thân)
//  attachShinySparkle(scene, sprite)  : thỉnh thoảng lấp lánh quanh một sprite bất kỳ (Pokémon trong trận, Pokémon đi theo,
//                                       thú cưỡi). Trả về { setVisible(bool), destroy() }

const STAR = 'fx-twinkle';
const STAR_SIZE = 48;
export const SHINY_COLORS = [0xffffff, 0xfff2a0, 0xffe066];

// Ngôi sao 4 cánh dài mảnh (cánh dọc dài hơn cánh ngang) có quầng sáng mờ ở giữa, tạo một lần cho cả game
function ensureStar(scene) {
  if (scene.textures.exists(STAR)) return STAR;
  const s = STAR_SIZE;
  const c = s / 2;
  const tex = scene.textures.createCanvas(STAR, s, s);
  const ctx = tex.getContext();
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.55);
  glow.addColorStop(0, 'rgba(255,255,255,0.9)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  // 4 cánh: mỗi cánh là một hình thoi rất hẹp, cạnh hơi cong vào trong
  ctx.fillStyle = '#ffffff';
  const arm = (len, w) => {
    ctx.beginPath();
    ctx.moveTo(c, c - len);
    ctx.quadraticCurveTo(c + w * 0.25, c - w * 0.25, c + len * 0.8, c);
    ctx.quadraticCurveTo(c + w * 0.25, c + w * 0.25, c, c + len);
    ctx.quadraticCurveTo(c - w * 0.25, c + w * 0.25, c - len * 0.8, c);
    ctx.quadraticCurveTo(c - w * 0.25, c - w * 0.25, c, c - len);
    ctx.closePath();
  };
  // viền vàng đậm để ngôi sao vẫn nổi trên nền sáng (trời, tuyết), rồi lõi trắng
  arm(c - 2, 13);
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(214,150,20,0.95)';
  ctx.stroke();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, c, 3, 0, Math.PI * 2);
  ctx.fill();
  tex.refresh();
  return STAR;
}

// Khung bao của sprite trên màn hình / thế giới (theo gốc, tỉ lệ đang hiển thị)
function boundsOf(sprite) {
  const w = Math.abs(sprite.displayWidth);
  const h = Math.abs(sprite.displayHeight);
  return {
    x: sprite.x - w * sprite.originX + w / 2,
    y: sprite.y - h * sprite.originY + h / 2,
    w,
    h,
  };
}

// Một ngôi sao chớp: phóng to rồi thu nhỏ, xoay nhẹ. follow: bám theo sprite (Pokémon đang đi) bằng độ lệch so với sprite
function twinkle(scene, { x, y, size, delay = 0, duration = 520, color = 0xffffff, depth = 9, follow = null, trackDepth = false, scrollFactor = 1 }) {
  const key = ensureStar(scene);
  const star = scene.add.image(x, y, key).setTint(color).setScale(0).setDepth(depth).setScrollFactor(scrollFactor)
    .setAngle(Phaser.Math.Between(-20, 20));
  const peak = size / STAR_SIZE;
  const off = follow ? { x: x - follow.x, y: y - follow.y } : null;
  scene.tweens.add({
    targets: star,
    scale: { from: 0, to: peak },
    angle: star.angle + 45,
    delay,
    duration: duration / 2,
    yoyo: true,
    ease: 'Sine.out',
    onUpdate: () => {
      if (!follow?.active) return;
      star.setPosition(follow.x + off.x, follow.y + off.y);
      if (trackDepth) star.setDepth(follow.depth + 0.001);
    },
    onComplete: () => star.destroy(),
  });
  return star;
}

// Pokémon shiny vừa ra sân: chớp sáng, vòng 8 ngôi sao bung ra xoay tròn, rồi 4 ngôi sao chớp lần lượt trên thân.
// Trả về Promise xong khi hiệu ứng chính kết thúc
export function shinyBurst(scene, sprite, { depth = 9 } = {}) {
  const key = ensureStar(scene);
  const b = boundsOf(sprite);
  const r = Math.max(40, Math.min(b.w, b.h) * 0.42);
  const flash = scene.add.image(b.x, b.y, key).setScale(0).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: flash, scale: (r * 2.4) / STAR_SIZE, alpha: { from: 1, to: 0 }, duration: 420, ease: 'Quad.out', onComplete: () => flash.destroy() });
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const s = scene.add.image(b.x + Math.cos(a) * r * 0.3, b.y + Math.sin(a) * r * 0.3, key)
      .setTint(SHINY_COLORS[i % 3]).setScale(0).setDepth(depth);
    // xoay vòng theo chiều kim đồng hồ khi bung ra
    const p = { t: 0 };
    scene.tweens.add({
      targets: p,
      t: 1,
      delay: (i % 2) * 60,
      duration: 900,
      ease: 'Cubic.out',
      onUpdate: () => {
        const ang = a + p.t * 0.9;
        const dist = r * (0.3 + p.t * 1.05);
        // to nhanh, giữ một lúc rồi nhỏ dần
        const k = p.t < 0.15 ? p.t / 0.15 : 1 - ((p.t - 0.15) / 0.85) * 0.55;
        s.setPosition(b.x + Math.cos(ang) * dist, b.y + Math.sin(ang) * dist).setScale(((i % 2 ? 52 : 68) / STAR_SIZE) * k).setAngle(p.t * 180);
        s.setAlpha(1 - p.t * 0.5);
      },
      onComplete: () => s.destroy(),
    });
  }
  // ngôi sao chớp trên thân (lấp lánh kiểu game gốc)
  const spots = [[-0.28, -0.22], [0.26, -0.05], [-0.08, 0.2], [0.18, 0.28]];
  spots.forEach(([dx, dy], i) => {
    twinkle(scene, { x: b.x + dx * b.w, y: b.y + dy * b.h, size: 46 - i * 3, delay: 380 + i * 130, duration: 520, color: SHINY_COLORS[i % 3], depth });
  });
  return new Promise((resolve) => scene.time.delayedCall(1150, resolve));
}

// Lấp lánh định kỳ quanh sprite: cứ khoảng `interval` ms hiện 1-2 ngôi sao nhỏ ở mép hình, bám theo sprite khi nó di chuyển.
// Sprite đang ẩn / mờ / thu nhỏ (bị thu vào bóng, ngã gục) thì không hiện. size: cỡ ngôi sao (px)
export function attachShinySparkle(scene, sprite, { interval = 1400, size = null, depth = null } = {}) {
  let visible = true;
  let alive = true;
  const spawn = () => {
    if (!alive || !visible || !sprite.active || !sprite.visible || sprite.alpha < 0.5) return;
    if (sprite.parentContainer && !sprite.parentContainer.visible) return;
    const b = boundsOf(sprite);
    if (b.h < 8 || b.w < 8) return;
    const n = Math.random() < 0.35 ? 2 : 1;
    const base = size ?? Phaser.Math.Clamp(Math.min(b.w, b.h) * 0.3, 18, 44);
    for (let i = 0; i < n; i++) {
      // vị trí: gần mép trên / hai bên thân (tránh giữa mặt)
      const ang = Phaser.Math.FloatBetween(-Math.PI, 0.2 * Math.PI);
      const rx = b.w * Phaser.Math.FloatBetween(0.25, 0.45);
      const ry = b.h * Phaser.Math.FloatBetween(0.25, 0.45);
      twinkle(scene, {
        x: b.x + Math.cos(ang) * rx,
        y: b.y + Math.sin(ang) * ry,
        size: base * Phaser.Math.FloatBetween(0.8, 1.2),
        delay: i * 160,
        duration: 560,
        color: SHINY_COLORS[Phaser.Math.Between(0, 2)],
        depth: depth ?? sprite.depth + 0.001,
        follow: sprite,
        trackDepth: depth === null,
        scrollFactor: sprite.scrollFactorX,
      });
    }
  };
  const timer = scene.time.addEvent({ delay: interval, loop: true, callback: spawn, startAt: interval * 0.6 });
  const handle = {
    setVisible(v) {
      visible = Boolean(v);
      return handle;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      timer.remove();
      scene.events.off('shutdown', handle.destroy);
    },
  };
  scene.events.once('shutdown', handle.destroy);
  return handle;
}
