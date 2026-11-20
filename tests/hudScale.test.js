import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUD_MIN_WIDTH, hudScaleFor } from '../src/game/display.js';

// Cỡ giao diện trên bản đồ (Cài đặt → Chung): game cao 720 rồi thu cho vừa màn hình
test('cỡ giao diện Tự động: màn hình càng thấp giao diện càng to, tối đa 150%', () => {
  assert.equal(hudScaleFor(1600, 900, 0), 1, 'máy tính: giữ nguyên');
  assert.equal(hudScaleFor(1600, 720, 0), 1);
  assert.equal(hudScaleFor(1558, 390, 0), 1.3, 'điện thoại ngang ~390px');
  assert.equal(hudScaleFor(1680, 300, 0), 1.5, 'màn hình rất thấp: tối đa 150%');
});

test('cỡ giao diện chọn tay; bề ngang hẹp thì giảm cho thanh phím tắt và khung nhiệm vụ không chồng nhau', () => {
  assert.equal(hudScaleFor(1600, 900, 1.3), 1.3);
  assert.equal(hudScaleFor(1600, 390, 1), 1, 'chọn 100% thì giữ 100% dù màn hình thấp');
  assert.equal(hudScaleFor(960, 400, 1.5), 960 / HUD_MIN_WIDTH, 'khung 4:3 / điện thoại dọc');
  assert.equal(hudScaleFor(1600, 900, 7), 1, 'giá trị lạ: 100%');
});
