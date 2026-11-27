import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PATH, cleanMeta, cleanMove } from '../src/game/remotePlayer.js';

// Dữ liệu người chơi khác gửi qua Realtime giả được: bên nhận làm sạch trước khi dùng (src/game/remotePlayer.js)

const nameOf = (id, claimed) => (id === 'u1' ? 'TenThat' : `?${claimed}`);

test('người chơi khác: tên lấy từ máy chủ, không theo tên tự gửi; giới tính / Pokémon đi theo lạ bị bỏ', () => {
  const meta = cleanMeta({ id: 'u1', name: 'Admin', gender: 'robot', follower: { s: '__proto__', sh: 1 } }, nameOf);
  assert.equal(meta.name, 'TenThat');
  assert.equal(meta.claimedName, 'Admin');
  assert.equal(meta.gender, 'male');
  assert.equal(meta.follower, null);
  assert.deepEqual(cleanMeta({ id: 'u2', name: 'x', gender: 'female', follower: { s: 'pikachu', sh: 'yes' } }, nameOf).follower,
    { s: 'pikachu', sh: true });
  assert.equal(cleanMeta({ id: 'u2', follower: { s: 'khongco' } }, nameOf).follower, null);
});

test('tin bước đi: bỏ tin sai, cắt path quá dài, giới hạn nhịp gửi', () => {
  assert.equal(cleanMove(null), null);
  assert.equal(cleanMove({ id: 'u1', x: 1.5, y: 2 }), null);
  assert.equal(cleanMove({ id: 'u1', x: 1e9, y: 2 }), null);
  assert.equal(cleanMove({ x: 1, y: 2 }), null);
  const long = Array.from({ length: 100000 }, (_, i) => [i, 0]);
  const move = cleanMove({ id: 'u1', x: 5, y: 5, path: [...long, ['a', 1], [1]], gap: 1e9, facing: 'sideways', moveAt: 'x' });
  assert.ok(move.path.length <= MAX_PATH);
  assert.ok(move.path.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)));
  assert.equal(move.gap, 3000);
  assert.equal(move.facing, undefined);
  assert.equal(move.moveAt, undefined);
  assert.equal(cleanMove({ id: 'u1', x: 5, y: 5, gap: 0 }).gap, 100);
  assert.deepEqual(cleanMove({ id: 'u1', x: 5, y: 6, path: [[5, 5]], facing: 'down', gap: 500 }).path, [[5, 5]]);
});
