import { test } from 'node:test';
import assert from 'node:assert/strict';

// errorPayload.js dùng location / navigator / innerWidth của trình duyệt: giả lập tối thiểu
globalThis.location = { pathname: '/game/' };
globalThis.navigator ??= { userAgent: 'node-test' };
globalThis.innerWidth = 844;
globalThis.innerHeight = 390;
globalThis.devicePixelRatio = 3;
const { errorPayload, scrub } = await import('../src/online/errorPayload.js');

test('nhật ký lỗi: bỏ email, token và tham số đường dẫn khỏi nội dung gửi lên', () => {
  assert.equal(scrub('Không gửi được cho an.nguyen+1@mail.com'), 'Không gửi được cho <email>');
  assert.equal(scrub('jwt eyJhbGci.eyJzdWIi.c2lnbmF0dXJl hết hạn'), 'jwt <token> hết hạn');
  assert.equal(scrub('fetch https://x.supabase.co/auth/v1/verify?token=abc&type=signup lỗi'), 'fetch https://x.supabase.co/auth/v1/verify?… lỗi');
});

test('nhật ký lỗi: nội dung gồm câu báo, stack của Error và bối cảnh', () => {
  const err = new TypeError('cannot read hp');
  const p = errorPayload('console', ['Lỗi trận đấu:', err], { map: 'town1', scenes: 'World,Battle' });
  assert.equal(p.p_kind, 'console');
  assert.equal(p.p_message, 'Lỗi trận đấu: TypeError: cannot read hp');
  assert.match(p.p_stack, /TypeError: cannot read hp/);
  assert.equal(p.p_context.map, 'town1');
  assert.equal(p.p_context.screen, '844x390@3');
  assert.equal(p.p_context.path, '/game/');
  assert.ok(errorPayload('error', 'x'.repeat(900)).p_message.length <= 500);
});
