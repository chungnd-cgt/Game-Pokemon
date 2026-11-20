import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alphaBounds } from '../src/gfx/pixel.js';

// Ảnh PNG Pokémon có viền trong suốt rộng: tìm đúng khung có hình để cắt sát (gfx/pixel.js: trimTransparent)
test('ảnh PNG: khung chứa phần có hình (bỏ viền trong suốt)', () => {
  const w = 12;
  const h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  const paint = (x, y, a = 255) => (data[(y * w + x) * 4 + 3] = a);
  paint(4, 6);
  paint(8, 9);
  paint(1, 1, 5); // gần như trong suốt (bóng mờ, nhiễu): bỏ qua
  assert.deepEqual(alphaBounds(data, w, h), { x: 4, y: 6, w: 5, h: 4 });
  assert.equal(alphaBounds(new Uint8ClampedArray(w * h * 4), w, h), null, 'ảnh trống');
});
