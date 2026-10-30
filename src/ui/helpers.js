import Phaser from 'phaser';
import { FONT } from '../config.js';

const { Color } = Phaser.Display;

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
export function drawPanel(scene, x, y, w, h, radius = 16, flat = false) {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.22);
  g.fillRoundedRect(x + 4, y + 6, w, h, radius);
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

// Thanh máu kiểu viên thuốc có nhãn "HP"
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
