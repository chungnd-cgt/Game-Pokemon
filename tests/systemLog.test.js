import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearSystemLog, logSystem, onSystemLog, systemLog, timeLabel } from '../src/game/systemLog.js';

test('nhật ký hệ thống: thêm dòng, báo người nghe, giữ tối đa 50 dòng mới nhất', () => {
  clearSystemLog();
  const heard = [];
  const stop = onSystemLog((e) => heard.push(e.text));
  logSystem('Giao dịch với Lan thành công.', 'good');
  assert.equal(systemLog().length, 1);
  assert.deepEqual(heard, ['Giao dịch với Lan thành công.']);
  stop();
  for (let i = 0; i < 60; i++) logSystem(`dòng ${i}`);
  assert.equal(systemLog().length, 50);
  assert.equal(systemLog().at(-1).text, 'dòng 59');
  assert.equal(heard.length, 1, 'thôi nghe thì không báo nữa');
  assert.equal(systemLog()[0].kind, 'info');
});

test('giờ hiện dạng HH:MM:SS', () => {
  assert.equal(timeLabel(new Date(2026, 0, 1, 9, 5, 7).getTime()), '09:05:07');
});
