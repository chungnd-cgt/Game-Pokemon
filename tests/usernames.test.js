import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// supabase/usernames.sql trên Postgres thật (PGlite) với bảng auth.users giả lập giống Supabase (mật khẩu băm bcrypt)

let db;
async function setup() {
  if (db) return db;
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create schema extensions;
    create table auth.users (
      id uuid primary key default gen_random_uuid(), email text unique, encrypted_password text,
      email_confirmed_at timestamptz, created_at timestamptz not null default now(), raw_user_meta_data jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  `);
  await db.exec(readFileSync(new URL('../supabase/usernames.sql', import.meta.url), 'utf8'));
  return db;
}

// Đăng ký như Supabase: thêm dòng auth.users (mật khẩu băm bcrypt), data.username trong raw_user_meta_data
async function signUp(email, password, username, { confirmed = true } = {}) {
  const { rows } = await db.query(
    `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
     values ($1, extensions.crypt($2, extensions.gen_salt('bf', 4)), $3, $4) returning id`,
    [email, password, confirmed ? new Date() : null, username === undefined ? {} : { username }],
  );
  return rows[0].id;
}
const errorOf = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err.message;
  }
};
const one = async (sql, params) => Object.values((await db.query(sql, params)).rows[0])[0];
const available = (name) => one('select public.username_available($1) as r', [name]);
const login = (name, password) => one('select public.login_email($1, $2) as r', [name, password]);
const nameOf = (id) => one('select username from public.profiles where user_id = $1', [id]);

test('chuẩn hoá tên: bỏ khoảng trắng 2 đầu, viết hoa chữ đầu; sai quy tắc thì null', async () => {
  await setup();
  const norm = (s) => one('select public.normalize_username($1) as r', [s]);
  assert.equal(await norm('  chung  '), 'Chung');
  assert.equal(await norm('chungND99'), 'ChungND99');
  assert.equal(await norm('9lives'), '9lives');
  assert.equal(await norm('a'), 'A');
  assert.equal(await norm('a'.repeat(18)), 'A' + 'a'.repeat(17));
  for (const bad of ['', '   ', 'a'.repeat(19), 'chung nd', 'chung_nd', 'chung!', 'chữ', 'chung😀', 'a-b', 'a.b']) {
    assert.equal(await norm(bad), null, bad);
  }
});

test('đăng ký: lưu tên đã chuẩn hoá; trùng tên (không phân biệt hoa thường) thì huỷ đăng ký', async () => {
  await setup();
  const id = await signUp('a1@x.co', 'secret1', '  alpha ');
  assert.equal(await nameOf(id), 'Alpha');
  assert.equal(await available('ALPHA'), 'taken');
  assert.equal(await available('alpha2'), 'ok');
  assert.equal(await available('al pha'), 'invalid');
  assert.match(await errorOf(() => signUp('a2@x.co', 'secret1', 'ALPHA')), /đã có người dùng/);
  assert.equal(await one('select count(*)::int as n from auth.users where email = $1', ['a2@x.co']), 0);
  assert.match(await errorOf(() => signUp('a3@x.co', 'secret1', 'bad name')), /không hợp lệ/);
});

test('đăng nhập bằng tên: đúng mật khẩu trả email, sai thì null', async () => {
  await setup();
  await signUp('b1@x.co', 'pass123', 'Bravo');
  assert.equal(await login('bravo', 'pass123'), 'b1@x.co');
  assert.equal(await login('  BRAVO ', 'pass123'), 'b1@x.co');
  assert.equal(await login('bravo', 'wrong'), null);
  assert.equal(await login('nobody', 'pass123'), null);
  assert.equal(await login('bra vo', 'pass123'), null);
  assert.equal(await login('bravo', ''), null);
});

// Gọi như qua API Supabase từ IP ip (PostgREST đưa header vào setting request.headers)
const fromIp = (ip, header = 'cf-connecting-ip') =>
  db.query(`select set_config('request.headers', $1, false)`, [ip ? JSON.stringify({ [header]: ip }) : '']);

test('đăng nhập sai quá 10 lần / 15 phút thì khoá tên đó với IP đó; đúng mật khẩu thì xoá đếm', async () => {
  await setup();
  await db.query('delete from public.login_failures');
  await signUp('c1@x.co', 'pass123', 'Charlie');
  await fromIp('10.0.0.1');
  for (let i = 0; i < 9; i++) await login('charlie', 'nope');
  assert.equal(await login('charlie', 'pass123'), 'c1@x.co'); // lần 10 đúng: xoá đếm
  for (let i = 0; i < 10; i++) await login('charlie', 'nope');
  assert.match(await errorOf(() => login('charlie', 'pass123')), /LOGIN_LOCKED/);
  assert.equal(await login('bravo', 'pass123'), 'b1@x.co'); // tên khác không bị ảnh hưởng
  // Người lạ dò mật khẩu chỉ tự khoá mình: chủ tài khoản ở IP khác vẫn đăng nhập được
  await fromIp('10.0.0.2');
  assert.equal(await login('charlie', 'pass123'), 'c1@x.co');
  await fromIp('10.0.0.1');
  for (let i = 0; i < 10; i++) await login('charlie', 'nope');
  await db.query(`update public.login_failures set at = at - interval '16 minutes'`);
  assert.equal(await login('charlie', 'pass123'), 'c1@x.co');
  // IP lấy từ x-forwarded-for (IP đầu) khi không có cf-connecting-ip
  await db.query('delete from public.login_failures');
  await fromIp('10.0.0.3, 172.16.0.1', 'x-forwarded-for');
  await login('charlie', 'nope');
  assert.equal(await one('select ip from public.login_failures limit 1'), '10.0.0.3');
  await fromIp(null);
});

test('chống dò: một IP dò nhiều tên bị khoá; dò một tên từ nhiều IP (IP giả) thì khoá tên đó; không còn ngưỡng chung', async () => {
  await setup();
  await db.query('delete from public.login_failures');
  await signUp('lock-d@x.co', 'pass123', 'Lockd');
  await signUp('lock-e@x.co', 'pass123', 'Locke');
  // Một IP sai 30 lần với nhiều tên khác nhau: IP đó bị khoá với mọi tên
  await fromIp('10.1.1.1');
  for (let i = 0; i < 30; i++) await login(`ghost${i}`, 'nope');
  assert.match(await errorOf(() => login('lockd', 'pass123')), /LOGIN_LOCKED/);
  await fromIp('10.1.1.2');
  assert.equal(await login('lockd', 'pass123'), 'lock-d@x.co', 'IP khác không bị ảnh hưởng');
  // Dò một tên từ 30 IP khác nhau trong 1 giờ: khoá tên đó (lưới cuối khi IP bị giả); tên khác vẫn vào được
  await db.query('delete from public.login_failures');
  for (let i = 0; i < 30; i++) {
    await fromIp(`10.2.0.${i}`);
    await login('locke', 'nope');
  }
  await fromIp('10.9.9.9');
  assert.match(await errorOf(() => login('locke', 'pass123')), /LOGIN_LOCKED/);
  assert.equal(await login('lockd', 'pass123'), 'lock-d@x.co');
  // Bản cũ chặn cả máy chủ khi bị dò 300 lần / phút: giờ không còn (một người dò không làm mọi người kẹt)
  await db.query('delete from public.login_failures');
  await db.query(`insert into public.login_failures (name_key, ip) select 'x' || g, '10.3.' || (g % 250) || '.' || (g / 250) from generate_series(1, 400) g`);
  await fromIp('10.4.4.4');
  assert.equal(await login('lockd', 'pass123'), 'lock-d@x.co');
  await fromIp(null);
});

test('tên thật theo id (player_names): chỉ người đã đăng nhập, tối đa 50 id', async () => {
  await setup();
  const id = await signUp('names-f@x.co', 'pass123', 'Foxtrot');
  await db.query(`select set_config('test.uid', $1, false)`, [id]);
  const rows = (await db.query('select * from public.player_names($1)', [[id, '00000000-0000-4000-8000-000000000000']])).rows;
  assert.deepEqual(rows, [{ user_id: id, username: 'Foxtrot' }]);
  await db.query(`select set_config('test.uid', '', false)`);
  assert.equal((await db.query('select * from public.player_names($1)', [[id]])).rows.length, 0, 'chưa đăng nhập');
  assert.equal(await one(`select has_function_privilege('anon', 'public.player_names(uuid[])', 'execute') as r`), false);
});

test('tên của tài khoản chưa xác nhận email quá 1 ngày được nhả ra', async () => {
  await setup();
  const stale = await signUp('d1@x.co', 'pass123', 'Delta', { confirmed: false });
  assert.equal(await available('delta'), 'taken');
  await db.query(`update auth.users set created_at = now() - interval '2 days' where id = $1`, [stale]);
  assert.equal(await available('delta'), 'ok');
  const id = await signUp('d2@x.co', 'pass123', 'delta');
  assert.equal(await nameOf(id), 'Delta');
  assert.equal(await login('delta', 'pass123'), 'd2@x.co');
});

test('đăng ký lại khi chưa xác nhận email thì đổi theo tên mới; đã xác nhận thì tự sửa metadata không đổi được tên', async () => {
  await setup();
  const id = await signUp('e1@x.co', 'pass123', 'Echo', { confirmed: false });
  await db.query(`update auth.users set raw_user_meta_data = '{"username":"echo2"}' where id = $1`, [id]);
  assert.equal(await nameOf(id), 'Echo2');
  await db.query('update auth.users set email_confirmed_at = now() where id = $1', [id]);
  await db.query(`update auth.users set raw_user_meta_data = '{"username":"Hacked"}' where id = $1`, [id]);
  assert.equal(await nameOf(id), 'Echo2');
});

test('không có username (tạo trong Dashboard) thì bỏ qua; người chơi không tự ghi bảng profiles được', async () => {
  await setup();
  const id = await signUp('f1@x.co', 'pass123', undefined);
  assert.equal((await db.query('select 1 from public.profiles where user_id = $1', [id])).rows.length, 0);
  const priv = await one(`select has_table_privilege('anon', 'public.profiles', 'insert') as r`);
  assert.equal(priv, false);
  assert.equal(await one(`select has_table_privilege('anon', 'public.login_failures', 'select') as r`), false);
});

test('email rác: đăng ký bằng tên miền trong danh sách chặn (kể cả tên miền con, chữ hoa) bị từ chối; email thường vẫn được', async () => {
  await setup();
  const allowed = (email) => one('select public.email_allowed($1) as r', [email]);
  assert.equal(await allowed('nguoichoi@gmail.com'), true);
  assert.equal(await allowed('abc@mailinator.com'), false);
  assert.equal(await allowed('abc@MailInator.COM'), false, 'không phân biệt hoa thường');
  assert.equal(await allowed('abc@x.yopmail.com'), false, 'tên miền con');
  assert.equal(await allowed('abc@notmailinator.com'), true, 'chỉ chặn đúng tên miền / tên miền con, không chặn tên giống');
  assert.equal(await one(`select has_function_privilege('anon', 'public.email_allowed(text)', 'execute') as r`), true);
  // Tạo tài khoản bằng email rác: database từ chối (gọi thẳng Supabase Auth cũng không lách được)
  assert.match(await errorOf(() => signUp('rac1@10minutemail.com', 'pass123', 'Racmot')), /EMAIL_BLOCKED/);
  assert.equal(await one(`select count(*)::int as n from auth.users where email = 'rac1@10minutemail.com'`), 0);
  // Đổi email sang email rác cũng bị chặn; sửa tài khoản mà không đổi email thì không sao
  const id = await signUp('blk-ok@x.co', 'pass123', 'Blkok');
  assert.match(await errorOf(() => db.query(`update auth.users set email = 'blk@yopmail.com' where id = $1`, [id])), /EMAIL_BLOCKED/);
  // Tài khoản cũ có email thuộc tên miền vừa bị thêm vào danh sách: vẫn dùng bình thường
  await db.query(`insert into public.blocked_email_domains (domain) values ('x.co') on conflict do nothing`);
  await db.query(`update auth.users set email_confirmed_at = now() where id = $1`, [id]);
  assert.equal(await login('blkok', 'pass123'), 'blk-ok@x.co');
  await db.query(`delete from public.blocked_email_domains where domain = 'x.co'`);
  // Người chơi không đọc / sửa được danh sách
  assert.equal(await one(`select has_table_privilege('anon', 'public.blocked_email_domains', 'select') as r`), false);
  assert.equal(await one(`select has_table_privilege('authenticated', 'public.blocked_email_domains', 'insert') as r`), false);
});
