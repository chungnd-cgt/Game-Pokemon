import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USERNAME_RULE, capitalizeFirst, checkUsername, stripPictographs } from '../src/online/username.js';

test('tên hợp lệ: bỏ khoảng trắng 2 đầu, viết hoa chữ đầu, cho cả số', () => {
  assert.deepEqual(checkUsername('  chung  '), { name: 'Chung' });
  assert.deepEqual(checkUsername('chungND99'), { name: 'ChungND99' });
  assert.deepEqual(checkUsername('9lives'), { name: '9lives' });
  assert.deepEqual(checkUsername('123456'), { name: '123456' });
  assert.deepEqual(checkUsername('a'), { name: 'A' });
  assert.deepEqual(checkUsername('a'.repeat(18)), { name: 'A' + 'a'.repeat(17) });
});

test('tên sai quy tắc: cùng một câu báo "1-18 ký tự (không ký tự đặc biệt)"', () => {
  assert.equal(USERNAME_RULE, 'Tên đăng nhập chứa 1-18 ký tự (không ký tự đặc biệt).');
  assert.match(checkUsername('').error, /Hãy nhập/);
  assert.match(checkUsername('   ').error, /Hãy nhập/);
  for (const bad of ['chung nd', 'chung\tnd', 'chung_nd', 'chung!', 'chữ', 'chung😀', 'a-b', 'a.b', 'a@b', 'a'.repeat(19)]) {
    assert.equal(checkUsername(bad).error, USERNAME_RULE, bad);
  }
});

test('biểu tượng gõ / dán vào ô bị bỏ, không hiện', () => {
  assert.equal(stripPictographs('chung😀'), 'chung');
  assert.equal(stripPictographs('👍🏽ab❤️c'), 'abc');
  assert.equal(stripPictographs('a👨‍👩‍👧b'), 'ab');
  assert.equal(stripPictographs('1️⃣2'), '12');
  assert.equal(stripPictographs('Chung99'), 'Chung99');
});

test('viết hoa chữ đầu khi đang gõ', () => {
  assert.equal(capitalizeFirst('chung'), 'Chung');
  assert.equal(capitalizeFirst('  chung'), '  Chung');
  assert.equal(capitalizeFirst('9abc'), '9abc');
  assert.equal(capitalizeFirst(''), '');
});
