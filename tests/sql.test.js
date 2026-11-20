import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createMonster } from '../src/game/monster.js';

// Chạy các file SQL của Supabase (supabase/*.sql) trên Postgres thật (PGlite, chạy trong Node) với phần auth giả lập:
// auth.uid() đọc từ setting test.uid. Kiểm tra giao dịch giữa người chơi và chống gian lận bản lưu.

const sqlFile = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const BADGES4 = ['wind', 'grass', 'electric', 'water'];

let db;
async function setup() {
  if (db) return db;
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    insert into auth.users values ('${A}'), ('${B}');
  `);
  await db.exec(sqlFile('schema.sql'));
  await db.exec(sqlFile('trades.sql'));
  await db.exec(sqlFile('anticheat.sql'));
  await db.exec(sqlFile('errors.sql'));
  await db.exec(sqlFile('sessions.sql'));
  // Realtime giả lập: bảng tin nhắn và realtime.topic() đọc từ setting test.topic
  await db.exec(`
    create schema realtime;
    create table realtime.messages (id serial primary key, topic text, payload jsonb);
    alter table realtime.messages enable row level security; -- như Supabase: bảng có sẵn, RLS bật sẵn
    create function realtime.topic() returns text language sql stable as $$ select current_setting('test.topic', true) $$;
    grant usage on schema realtime, public, auth to authenticated;
    grant select, insert on realtime.messages to authenticated;
    grant usage on sequence realtime.messages_id_seq to authenticated;
    grant select on public.trades to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  await db.exec(sqlFile('realtime.sql'));
  return db;
}
const as = (uid) => db.query(`select set_config('test.uid', $1, false)`, [uid]);
const rpc = async (uid, sql, params = []) => {
  await as(uid);
  return db.query(sql, params);
};
const errorOf = async (fn) => {
  try {
    await fn();
    return null;
  } catch (err) {
    return err.message;
  }
};

// Bản lưu như game gửi lên (Pokémon tạo bằng code game nên chỉ số đúng công thức)
function saveData({ party = [createMonster('pikachu', 20), createMonster('rattata', 12)], money = 5000, bag = { potion: 5 }, badges = BADGES4, playTime = 3600, storage = [] } = {}) {
  return { version: 2, party, storage, bag, money, badges, playTime };
}
async function putSave(uid, data) {
  await db.query('delete from public.saves where user_id = $1', [uid]);
  await db.query('delete from public.save_flags where user_id = $1', [uid]);
  await db.query('delete from public.player_status where user_id = $1', [uid]);
  await db.query('insert into public.saves (user_id, data) values ($1, $2)', [uid, data]);
  // Lời mời giao dịch giới hạn 1 lần / 30 giây: lùi giờ các lời mời cũ để test sau không bị chặn
  await db.query(`update public.trades set created_at = created_at - interval '1 hour'`);
}
const flagsOf = async (uid) => (await db.query('select severity, reason from public.save_flags where user_id = $1 order by id', [uid])).rows;
const blocked = async (uid) => Boolean((await db.query('select trade_blocked from public.player_status where user_id = $1', [uid])).rows[0]?.trade_blocked);

test('SQL: bản lưu hợp lệ thì ghi bình thường, không bị ghi nhận', async () => {
  await setup();
  await putSave(A, saveData());
  assert.equal((await db.query('select count(*)::int as n from public.saves where user_id = $1', [A])).rows[0].n, 1);
  assert.deepEqual(await flagsOf(A), []);
  assert.equal(await blocked(A), false);
});

test('SQL chống gian lận: dữ liệu không thể có thì không ghi lên mạng (giữ bản cũ) và khoá giao dịch', async () => {
  await setup();
  // Tạo mới với Pokémon cấp 150: không tạo bản lưu
  const bad = createMonster('pikachu', 20);
  bad.level = 150;
  await putSave(A, saveData({ party: [bad] }));
  assert.equal((await db.query('select count(*)::int as n from public.saves where user_id = $1', [A])).rows[0].n, 0);
  assert.ok((await flagsOf(A)).some((f) => f.severity === 'hard' && f.reason === 'level'));
  assert.equal(await blocked(A), true);
  // Sửa bản đang có: IV 99 → bản trên mạng giữ nguyên
  await putSave(B, saveData());
  const cheat = saveData();
  cheat.party[0].ivs.atk = 99;
  await db.query('update public.saves set data = $2 where user_id = $1', [B, cheat]);
  const kept = (await db.query('select data from public.saves where user_id = $1', [B])).rows[0].data;
  assert.notEqual(kept.party[0].ivs.atk, 99);
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'iv'));
  // Đồ quá 999, đội quá 6
  await putSave(B, saveData({ bag: { rareCandy: 5000 } }));
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'bag'));
  await putSave(B, saveData({ party: Array.from({ length: 7 }, () => createMonster('rattata', 5)) }));
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'party_size'));
});

test('SQL chống gian lận: sửa thẳng chỉ số / tiền / số Pokémon tăng vọt thì vẫn ghi nhưng khoá giao dịch', async () => {
  await setup();
  const edited = saveData();
  edited.party[0].atk = 999;
  await putSave(A, edited);
  assert.ok((await flagsOf(A)).some((f) => f.severity === 'soft' && f.reason === 'stats'));
  assert.equal(await blocked(A), true);

  await putSave(B, saveData({ playTime: 3600 }));
  await db.query('update public.saves set data = $2 where user_id = $1', [B, saveData({ money: 9000000, playTime: 3660 })]);
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'money_gain'));

  await putSave(B, saveData({ playTime: 3600 }));
  const many = Array.from({ length: 151 }, () => createMonster('pidgey', 50));
  await db.query('update public.saves set data = $2 where user_id = $1', [B, saveData({ storage: many, playTime: 3700 })]);
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'mons_gain'), 'kiểu cheat 151 Pokémon một lúc');

  // Chơi bình thường: thêm tiền / Pokémon vừa phải theo thời gian thì không sao
  await putSave(B, saveData({ playTime: 3600 }));
  await db.query('update public.saves set data = $2 where user_id = $1', [B, saveData({ money: 9000, playTime: 4200, storage: [createMonster('pidgey', 8)] })]);
  assert.deepEqual(await flagsOf(B), []);
});

test('SQL giao dịch: mời → đồng ý → Đồng ý (2 bên) → Giao dịch (2 bên) → chốt; Pokémon lấy đúng từ bản lưu', async () => {
  await setup();
  const aParty = [createMonster('pikachu', 20), createMonster('kadabra', 30)];
  const bParty = [createMonster('rattata', 12), createMonster('machoke', 30)];
  await putSave(A, saveData({ party: aParty }));
  await putSave(B, saveData({ party: bParty }));
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  // A gửi Kadabra nhưng sửa cấp 99 trong đề nghị: máy chủ thay bằng đúng con trong bản lưu
  const fake = { ...aParty[1], level: 99 };
  await rpc(A, 'select public.trade_set_offer($1, $2)', [id, { mons: [fake], items: { potion: 2 }, money: 100 }]);
  await rpc(B, 'select public.trade_set_offer($1, $2)', [id, { mons: [bParty[1]], items: {}, money: 0 }]);
  const row = async () => (await db.query('select * from public.trades where id = $1', [id])).rows[0];
  // Chưa Đồng ý thì chưa Giao dịch được
  assert.match(await errorOf(() => rpc(A, 'select public.trade_confirm($1)', [id])), /Đồng ý trước/);
  // Đồng ý với đề nghị bên kia đang thấy; bên kia đổi đề nghị thì bị từ chối
  assert.match(await errorOf(() => rpc(A, 'select public.trade_ready($1, $2)', [id, { mons: [], items: {}, money: 0 }])), /đổi đề nghị/);
  await rpc(A, 'select public.trade_ready($1, $2)', [id, (await row()).offer_b]);
  await rpc(B, 'select public.trade_ready($1, $2)', [id, (await row()).offer_a]);
  assert.equal((await rpc(A, 'select public.trade_confirm($1) as s', [id])).rows[0].s, 'open');
  assert.equal((await rpc(B, 'select public.trade_confirm($1) as s', [id])).rows[0].s, 'done');
  const done = await row();
  assert.equal(done.status, 'done');
  assert.equal(done.offer_a.mons[0].level, 30, 'Pokémon lấy đúng từ bản lưu, không phải đề nghị đã sửa');
});

test('SQL giao dịch: chưa đủ 4 huy hiệu / tài khoản bị khoá thì không giao dịch được; đổi đề nghị thì phải Đồng ý lại', async () => {
  await setup();
  await putSave(A, saveData({ badges: ['wind'] }));
  await putSave(B, saveData());
  assert.match(await errorOf(() => rpc(A, 'select public.trade_open($1, $2)', [B, 'An'])), /4 huy hiệu/);

  await putSave(A, saveData());
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  const seen = async (col) => (await db.query(`select ${col} from public.trades where id = $1`, [id])).rows[0][col];
  await rpc(A, 'select public.trade_ready($1, $2)', [id, await seen('offer_b')]);
  await rpc(B, 'select public.trade_set_offer($1, $2)', [id, { mons: [], items: { potion: 1 }, money: 0 }]);
  assert.equal(await seen('ready_a'), false, 'đổi đề nghị thì bỏ Đồng ý của cả hai');

  // Tài khoản B bị khoá giao dịch (bản lưu đáng ngờ): chốt bị từ chối
  await db.query('insert into public.player_status (user_id, trade_blocked) values ($1, true) on conflict (user_id) do update set trade_blocked = true', [B]);
  await rpc(A, 'select public.trade_ready($1, $2)', [id, await seen('offer_b')]);
  await rpc(B, 'select public.trade_ready($1, $2)', [id, await seen('offer_a')]);
  await rpc(A, 'select public.trade_confirm($1)', [id]);
  assert.match(await errorOf(() => rpc(B, 'select public.trade_confirm($1)', [id])), /khoá giao dịch/);
});

test('SQL giao dịch: mỗi người tối đa 1 lời mời / 30 giây', async () => {
  await setup();
  await putSave(A, saveData());
  await putSave(B, saveData());
  await rpc(A, 'select public.trade_open($1, $2)', [B, 'An']);
  assert.match(await errorOf(() => rpc(A, 'select public.trade_open($1, $2)', [B, 'An'])), /30 giây.*chờ \d+ giây/);
  // B vẫn mời được (giới hạn tính riêng từng người)
  await rpc(B, 'select public.trade_open($1, $2)', [A, 'Bình']);
  // Hết 30 giây thì A mời lại được
  await db.query(`update public.trades set created_at = created_at - interval '31 seconds' where a = $1`, [A]);
  await rpc(A, 'select public.trade_open($1, $2)', [B, 'An']);
});

test('SQL chống gian lận: tiền / Pokémon nhận qua giao dịch không bị tính là tăng vọt', async () => {
  await setup();
  await putSave(A, saveData({ money: 500000 }));
  await putSave(B, saveData({ money: 1000, playTime: 3600 }));
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  await rpc(A, 'select public.trade_set_offer($1, $2)', [id, { mons: [], items: {}, money: 400000 }]);
  const offers = (await db.query('select offer_a, offer_b from public.trades where id = $1', [id])).rows[0];
  await rpc(A, 'select public.trade_ready($1, $2)', [id, offers.offer_b]);
  await rpc(B, 'select public.trade_ready($1, $2)', [id, offers.offer_a]);
  await rpc(A, 'select public.trade_confirm($1)', [id]);
  await rpc(B, 'select public.trade_confirm($1)', [id]);
  await db.query('update public.saves set data = $2 where user_id = $1', [B, saveData({ money: 401000, playTime: 3660 })]);
  assert.deepEqual(await flagsOf(B), []);
});

test('SQL Realtime riêng tư: kênh bản đồ cho người đã đăng nhập, kênh giao dịch chỉ cho hai người trong cuộc', async () => {
  await setup();
  await putSave(A, saveData());
  await putSave(B, saveData());
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  const C = '33333333-3333-3333-3333-333333333333';
  const canSend = async (uid, topic) => {
    await db.query(`select set_config('test.uid', $1, false), set_config('test.topic', $2, false)`, [uid, topic]);
    await db.exec('set role authenticated');
    try {
      await db.query('insert into realtime.messages (topic, payload) values ($1, $2)', [topic, {}]);
      return true;
    } catch {
      return false;
    } finally {
      await db.exec('reset role');
    }
  };
  assert.equal(await canSend(A, 'map-town1'), true);
  assert.equal(await canSend(A, `trade-${id}`), true);
  assert.equal(await canSend(B, `trade-${id}`), true);
  assert.equal(await canSend(C, `trade-${id}`), false, 'người ngoài không vào được kênh giao dịch');
  assert.equal(await canSend(A, 'lobby-khac'), false, 'kênh lạ bị chặn');
});

test('SQL nhật ký lỗi: ai cũng gửi được, không ai đọc được qua API; lỗi lặp lại được gộp; chống spam', async () => {
  await setup();
  const log = (uid, msg) => rpc(uid, 'select public.log_client_error($1, $2, $3, $4)', ['error', msg, 'at x.js:1', { map: 'town1' }]);
  const asRole = async (role, uid, fn) => {
    await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  };
  // Gửi qua hàm (người đã đăng nhập và chưa đăng nhập)
  await asRole('authenticated', A, () => db.query('select public.log_client_error($1, $2, $3, $4)', ['error', 'Lỗi A', null, {}]));
  await asRole('anon', null, () => db.query('select public.log_client_error($1, $2, $3, $4)', ['rejection', 'Lỗi khách', null, {}]));
  // Không đọc / ghi thẳng bảng được
  assert.ok(await errorOf(() => asRole('authenticated', A, () => db.query('select * from public.client_errors'))));
  assert.ok(await errorOf(() => asRole('anon', null, () => db.query(`insert into public.client_errors (message) values ('x')`))));
  assert.ok(await errorOf(() => asRole('authenticated', A, () => db.query('select * from public.client_errors_summary'))));
  // Lặp lại cùng lỗi: gộp thành 1 dòng, tăng số lần
  for (let i = 0; i < 5; i++) await log(B, 'Lỗi lặp');
  const row = (await db.query(`select count, context from public.client_errors where message = 'Lỗi lặp'`)).rows;
  assert.equal(row.length, 1);
  assert.equal(row[0].count, 5);
  assert.equal(row[0].context.map, 'town1');
  // Mỗi người tối đa 30 lỗi khác nhau / giờ
  for (let i = 0; i < 40; i++) await log(B, `Lỗi ${i}`);
  assert.equal((await db.query('select count(*)::int as n from public.client_errors where user_id = $1', [B])).rows[0].n, 30);
  // Nội dung quá dài bị cắt
  await log(A, 'x'.repeat(5000));
  assert.equal((await db.query(`select max(length(message))::int as n from public.client_errors`)).rows[0].n, 500);
});

test('SQL một nơi chơi: đăng nhập sau giành quyền; nơi cũ không gửi được bản lưu, tải lại trang không giành lại được', async () => {
  await setup();
  await putSave(A, saveData());
  const S1 = 'aaaaaaaa-0000-4000-8000-000000000001';
  const S2 = 'aaaaaaaa-0000-4000-8000-000000000002';
  const S3 = 'aaaaaaaa-0000-4000-8000-000000000003';
  const claim = async (id, previous) => (await rpc(A, 'select public.claim_session($1, $2, $3) as r', [id, previous, 'test'])).rows[0].r;
  const upload = (claimId) => rpc(A, 'update public.saves set data = $2 where user_id = $1', [A, { ...saveData(), claim: claimId }]);
  // Máy 1 đăng nhập: gửi bản lưu được
  assert.equal(await claim(S1, null), 'ok');
  await upload(S1);
  // Máy 2 đăng nhập (mật khẩu): giành quyền; máy 1 gửi bản lưu bị từ chối
  assert.equal(await claim(S2, null), 'ok');
  assert.match(await errorOf(() => upload(S1)), /SESSION/);
  await upload(S2);
  // Máy 1 tải lại trang (còn phiên đăng nhập, mã phiên cũ S1): không giành lại được, phải đăng nhập lại
  assert.equal(await claim(S3, S1), 'taken');
  // Máy 2 tải lại trang / nhân bản tab (mã cũ S2 đang giữ quyền): đổi sang mã mới được
  assert.equal(await claim(S3, S2), 'ok');
  assert.match(await errorOf(() => upload(S2)), /SESSION/);
  await upload(S3);
  // Sửa tay trong Dashboard / SQL Editor (không có auth.uid) thì không bị chặn
  await db.query(`select set_config('test.uid', '', false)`);
  await db.query('update public.saves set data = $2 where user_id = $1', [A, saveData()]);
  await db.query('delete from public.player_sessions');
});
