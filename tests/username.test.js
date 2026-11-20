import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capitalizeFirst, checkUsername } from '../src/online/username.js';

test('tên hợp lệ: bỏ khoảng trắng 2 đầu, viết hoa chữ đầu', () => {
  assert.deepEqual(checkUsername('  chung  '), { name: 'Chung' });
  assert.deepEqual(checkUsername('chungND99'), { name: 'ChungND99' });
  assert.deepEqual(checkUsername('9lives'), { name: '9lives' });
  assert.deepEqual(checkUsername('a'), { name: 'A' });
  assert.deepEqual(checkUsername('a'.repeat(18)), { name: 'A' + 'a'.repeat(17) });
});

test('tên sai quy tắc: báo đúng lý do', () => {
  assert.match(checkUsername('').error, /Hãy nhập/);
  assert.match(checkUsername('   ').error, /Hãy nhập/);
  assert.match(checkUsername('chung nd').error, /khoảng trắng/);
  assert.match(checkUsername('chung\tnd').error, /khoảng trắng/);
  for (const bad of ['chung_nd', 'chung!', 'chữ', 'chung😀', 'a-b', 'a.b', 'a@b']) {
    assert.match(checkUsername(bad).error, /không dấu/, bad);
  }
  assert.match(checkUsername('a'.repeat(19)).error, /tối đa 18/);
});

test('viết hoa chữ đầu khi đang gõ', () => {
  assert.equal(capitalizeFirst('chung'), 'Chung');
  assert.equal(capitalizeFirst('  chung'), '  Chung');
  assert.equal(capitalizeFirst('9abc'), '9abc');
  assert.equal(capitalizeFirst(''), '');
});
