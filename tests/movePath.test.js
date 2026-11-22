import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_ALONE, batchSteps, crowdPace, planSteps, stepFacing, trimQueue } from '../src/game/movePath.js';

test('đi theo path từng ô, rẽ góc không đi chéo', () => {
  const steps = planSteps({ x: 0, y: 0 }, { x: 1, y: 1, path: [[1, 0]] });
  assert.deepEqual(steps, [{ x: 1, y: 0 }, { x: 1, y: 1 }]);
});

test('xe đạp: 5 ô một tin vẫn đi từng ô, không nhảy', () => {
  const path = [[1, 0], [2, 0], [3, 0], [4, 0]];
  const steps = planSteps({ x: 0, y: 0 }, { x: 5, y: 0, path });
  assert.equal(steps.length, 5);
  assert.ok(steps.every((s) => !s.jump));
});

test('path hụt đoạn (vào cửa / mất tin): nhảy tới ô đó rồi đi tiếp', () => {
  const steps = planSteps({ x: 0, y: 0 }, { x: 11, y: 10, path: [[10, 10]] });
  assert.deepEqual(steps, [{ x: 10, y: 10, jump: true }, { x: 11, y: 10 }]);
});

test('chỉ quay mặt: không có bước nào', () => {
  assert.deepEqual(planSteps({ x: 3, y: 3 }, { x: 3, y: 3, path: [] }), []);
});

test('tin không có path (bản cũ / presence): gần thì tự đi thẳng, xa thì nhảy', () => {
  assert.deepEqual(planSteps({ x: 0, y: 0 }, { x: 2, y: 1 }), [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }]);
  assert.deepEqual(planSteps({ x: 0, y: 0 }, { x: 9, y: 0 }), [{ x: 9, y: 0, jump: true }]);
});

test('dữ liệu lạ trong path bị bỏ qua', () => {
  const steps = planSteps({ x: 0, y: 0 }, { x: 1, y: 0, path: [null, ['a', 1], [0, 0]] });
  assert.deepEqual(steps, [{ x: 1, y: 0 }]);
});

test('hàng đợi quá dài: nhảy tới gần cuối', () => {
  const q = Array.from({ length: 12 }, (_, i) => ({ x: i + 1, y: 0 }));
  assert.deepEqual(trimQueue(q), [{ x: 10, y: 0, jump: true }, { x: 11, y: 0 }, { x: 12, y: 0 }]);
  assert.equal(trimQueue(q.slice(0, 5)).length, 5);
});

test('đông người thì gửi thưa hơn, presence luôn cập nhật sau tin bước đi cuối', () => {
  assert.equal(crowdPace(0).track, TRACK_ALONE);
  assert.equal(crowdPace(1).gap, 500);
  assert.equal(crowdPace(2).gap, 500);
  assert.equal(crowdPace(3).gap, 750);
  assert.equal(crowdPace(5).gap, 750);
  assert.equal(crowdPace(6).gap, 1000);
  assert.equal(crowdPace(30).gap, 1000);
  for (let n = 0; n <= 10; n++) assert.ok(crowdPace(n).track > crowdPace(n).gap);
  // Gửi thưa nhất, đi nhanh nhất (thú cưỡi ~90ms/ô): một tin vẫn vừa MAX_TRAIL (24 ô) trong online/presence.js
  assert.ok(batchSteps(crowdPace(99).gap, 90) <= 24);
});

test('số bước mỗi tin: đi bộ gửi mỗi 500ms giữ đúng ngưỡng cũ (cắt ở 10, đi nhanh khi còn > 4)', () => {
  const b = batchSteps(500, 230);
  assert.equal(b * 2 + 4, 10);
  assert.equal(b + 1, 4);
  assert.equal(batchSteps(1000, 100), 10);
  assert.equal(batchSteps(0, 230), 1);
});

test('hướng mặt theo bước', () => {
  assert.equal(stepFacing({ x: 0, y: 0 }, { x: 1, y: 0 }), 'right');
  assert.equal(stepFacing({ x: 0, y: 0 }, { x: 0, y: -1 }), 'up');
});
