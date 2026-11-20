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

test('đăng nhập sai quá 10 lần / 15 phút thì khoá tên đó; đúng mật khẩu thì xoá đếm', async () => {
  await setup();
  await signUp('c1@x.co', 'pass123', 'Charlie');
  for (let i = 0; i < 9; i++) await login('charlie', 'nope');
  assert.equal(await login('charlie', 'pass123'), 'c1@x.co'); // lần 10 đúng: xoá đếm
  for (let i = 0; i < 10; i++) await login('charlie', 'nope');
  assert.match(await errorOf(() => login('charlie', 'pass123')), /LOGIN_LOCKED/);
  assert.equal(await login('bravo', 'pass123'), 'b1@x.co'); // tên khác không bị ảnh hưởng
  await db.query(`update public.login_failures set at = at - interval '16 minutes'`);
  assert.equal(await login('charlie', 'pass123'), 'c1@x.co');
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
