import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createMonster } from '../src/game/monster.js';
import { TRADE_MIN_BADGES } from '../src/game/trade.js';

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
    create table auth.users (id uuid primary key, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    -- JWT của phiên (session_id, amr) như Supabase: đọc từ setting test.jwt
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
    insert into auth.users (id) values ('${A}'), ('${B}');
    -- Như Supabase: bảng mới trong public tự có quyền cho anon / authenticated (RLS và revoke trong file SQL mới chặn)
    alter default privileges in schema public grant all on tables to anon, authenticated;
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
// Đặt bản lưu như sửa tay trong Dashboard (không có auth.uid): làm mốc cho test, xoá nhật ký / giao dịch cũ của người đó
async function putSave(uid, data) {
  await as('');
  await db.query('delete from public.saves where user_id = $1', [uid]);
  await db.query('delete from public.save_flags where user_id = $1', [uid]);
  await db.query('delete from public.player_status where user_id = $1', [uid]);
  await db.query('delete from public.save_baseline where user_id = $1', [uid]);
  await db.query('delete from public.trades where $1 in (a, b)', [uid]);
  await db.query('insert into public.saves (user_id, data) values ($1, $2)', [uid, data]);
  // Lời mời giao dịch giới hạn 1 lần / 30 giây: lùi giờ các lời mời cũ để test sau không bị chặn
  await db.query(`update public.trades set created_at = created_at - interval '1 hour'`);
}
// Người chơi uid gửi bản lưu lên (như game: auth.uid() = uid)
const play = (uid, data) => rpc(uid, 'update public.saves set data = $2 where user_id = $1', [uid, data]);
// A và B giao dịch trọn vẹn với hai đề nghị. Trả về { id, err } (err: lỗi lúc chốt, null nếu chốt được)
async function trade(offerA, offerB = { mons: [], items: {}, money: 0 }) {
  await db.query(`update public.trades set created_at = created_at - interval '1 hour'`);
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  await rpc(A, 'select public.trade_set_offer($1, $2)', [id, offerA]);
  await rpc(B, 'select public.trade_set_offer($1, $2)', [id, offerB]);
  const offers = (await db.query('select offer_a, offer_b from public.trades where id = $1', [id])).rows[0];
  await rpc(A, 'select public.trade_ready($1, $2)', [id, offers.offer_b]);
  await rpc(B, 'select public.trade_ready($1, $2)', [id, offers.offer_a]);
  await rpc(A, 'select public.trade_confirm($1)', [id]);
  return { id, err: await errorOf(() => rpc(B, 'select public.trade_confirm($1)', [id])) };
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
  await play(B, saveData({ money: 9000000, playTime: 3660 }));
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'wealth_gain'));

  await putSave(B, saveData({ playTime: 3600 }));
  const many = Array.from({ length: 151 }, () => createMonster('pidgey', 50));
  await play(B, saveData({ storage: many, playTime: 3700 }));
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'mons_gain'), 'kiểu cheat 151 Pokémon một lúc');

  // Chơi bình thường: thêm tiền / Pokémon vừa phải theo thời gian thì không sao
  await putSave(B, saveData({ playTime: 3600 }));
  await play(B, saveData({ money: 9000, playTime: 4200, storage: [createMonster('pidgey', 8)] }));
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
  assert.equal(TRADE_MIN_BADGES, 4, 'game và máy chủ cùng đòi 4 huy hiệu');
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

test('SQL chống gian lận: tiền / Pokémon nhận qua giao dịch (đã ghi nhận trong tradesDone) không bị tính là tăng vọt', async () => {
  await setup();
  const aParty = [createMonster('pikachu', 20), createMonster('kadabra', 30)];
  await putSave(A, saveData({ money: 500000, party: aParty }));
  await putSave(B, saveData({ money: 1000, playTime: 3600 }));
  const { id, err } = await trade({ mons: [aParty[1]], items: {}, money: 400000 });
  assert.equal(err, null);
  const got = { ...aParty[1], uid: 999 }; // game cấp uid mới cho Pokémon nhận được
  await play(B, { ...saveData({ money: 401000, playTime: 3660 }), party: [...saveData().party, got], tradesDone: [id] });
  assert.deepEqual(await flagsOf(B), []);
  // A ghi nhận giao dịch đúng cách (bỏ Kadabra, trừ tiền): không sao
  await play(A, { ...saveData({ money: 100000, party: [aParty[0]], playTime: 3660 }), tradesDone: [id] });
  assert.deepEqual(await flagsOf(A), []);
});

test('SQL chống nhân bản qua giao dịch: chưa ghi nhận thì không đem đồ đã đưa đi giao dịch lại; ghi nhận mà vẫn giữ thì bị khoá', async () => {
  await setup();
  const aParty = [createMonster('pikachu', 20), createMonster('kadabra', 30), createMonster('rattata', 10)];
  await putSave(A, saveData({ money: 500000, party: aParty, bag: { potion: 5 } }));
  await putSave(B, saveData({ money: 1000 }));
  const first = await trade({ mons: [aParty[1]], items: { potion: 4 }, money: 400000 });
  assert.equal(first.err, null);
  // A chưa gửi bản lưu đã trừ đồ (hoặc cố không bao giờ gửi): bản trên mạng vẫn còn Kadabra, 500000, 5 Potion
  assert.match((await trade({ mons: [aParty[1]], items: {}, money: 0 })).err, /không còn trong đội/, 'Pokémon đã đưa đi');
  assert.match((await trade({ mons: [], items: {}, money: 200000 })).err, /Không đủ tiền/, 'chỉ còn 100000');
  assert.match((await trade({ mons: [], items: { potion: 2 }, money: 0 })).err, /Không đủ vật phẩm/, 'chỉ còn 1 Potion');
  assert.equal((await trade({ mons: [], items: { potion: 1 }, money: 100000 })).err, null, 'phần còn lại vẫn giao dịch được');
  // A ghi nhận giao dịch đầu (tradesDone) mà vẫn giữ Kadabra và tiền: bị ghi nhận, khoá giao dịch
  await play(A, { ...saveData({ money: 500000, party: aParty, playTime: 3660 }), tradesDone: [first.id] });
  const reasons = (await flagsOf(A)).map((f) => f.reason);
  assert.ok(reasons.includes('traded_mon_kept'), reasons.join());
  assert.ok(reasons.includes('wealth_gain'), reasons.join());
  assert.equal(await blocked(A), true);
});

test('SQL chống gian lận: không xoá bản lưu để làm lại; bản lưu tạo mới cũng bị so (tính từ lúc tạo tài khoản)', async () => {
  await setup();
  await putSave(A, saveData());
  // Người chơi không xoá được bản lưu (không có quyền / policy xoá)
  await as(A);
  await db.exec('set role authenticated');
  try {
    await db.query('delete from public.saves where user_id = $1', [A]);
  } catch {
    // bị từ chối hẳn cũng được
  } finally {
    await db.exec('reset role');
  }
  assert.equal((await db.query('select count(*)::int as n from public.saves where user_id = $1', [A])).rows[0].n, 1);
  // Tài khoản mới tinh mà bản lưu đầu tiên đã có 9 triệu và 151 Pokémon: vẫn tạo nhưng khoá giao dịch
  await putSave(B, saveData());
  await db.query('delete from public.saves where user_id = $1', [B]);
  await db.query('delete from public.save_baseline where user_id = $1', [B]);
  const many = Array.from({ length: 151 }, () => createMonster('pidgey', 50));
  await rpc(B, 'insert into public.saves (user_id, data) values ($1, $2)', [B, saveData({ money: 9000000, storage: many, playTime: 999999 })]);
  const reasons = (await flagsOf(B)).map((f) => f.reason);
  assert.ok(reasons.includes('wealth_gain') && reasons.includes('mons_gain'), reasons.join());
  // Bản lưu đầu tiên bình thường của người chơi mới: không sao
  await db.query('delete from public.saves where user_id = $1', [B]);
  await db.query('delete from public.save_flags where user_id = $1', [B]);
  await db.query('delete from public.save_baseline where user_id = $1', [B]);
  await rpc(B, 'insert into public.saves (user_id, data) values ($1, $2)', [B, saveData({ money: 10000, playTime: 120 })]);
  assert.deepEqual(await flagsOf(B), []);
  // Game không tự đặt version / updated_at khi tạo
  await db.query('delete from public.saves where user_id = $1', [B]);
  await rpc(B, `insert into public.saves (user_id, data, version, updated_at) values ($1, $2, 77, '2000-01-01')`, [B, saveData()]);
  const row = (await db.query('select version, updated_at from public.saves where user_id = $1', [B])).rows[0];
  assert.equal(row.version, 1);
  assert.ok(row.updated_at > new Date(Date.now() - 60000));
});

test('SQL chống gian lận: sửa playTime hay gửi nhiều lần mỗi lần một chút không né được kiểm tra tăng vọt', async () => {
  await setup();
  // playTime tăng 1 tỷ giây nhưng đồng hồ máy chủ mới qua vài giây: không được tính thêm
  await putSave(A, saveData({ playTime: 3600 }));
  await play(A, saveData({ money: 9000000, playTime: 1e9 }));
  assert.ok((await flagsOf(A)).some((f) => f.reason === 'wealth_gain'));
  // Mỗi lần +60000 (dưới ngưỡng 100000) nhưng so với mốc nên cộng dồn bị phát hiện
  await putSave(B, saveData({ money: 5000, playTime: 3600 }));
  await play(B, saveData({ money: 65000, playTime: 3630 }));
  assert.deepEqual(await flagsOf(B), []);
  await play(B, saveData({ money: 125000, playTime: 3660 }));
  assert.ok((await flagsOf(B)).some((f) => f.reason === 'wealth_gain'), 'lần thứ hai cộng dồn vượt ngưỡng');
  // Mốc cũ hơn 10 phút (đã chơi thật 11 phút): được thêm theo thời gian, rồi mốc dời lên bản mới
  await putSave(B, saveData({ money: 5000, playTime: 3600 }));
  await db.query(`update public.save_baseline set at = at - interval '11 minutes' where user_id = $1`, [B]);
  await play(B, saveData({ money: 150000, playTime: 4260 }));
  await play(B, saveData({ money: 210000, playTime: 4290 }));
  assert.deepEqual(await flagsOf(B), []);
});

test('SQL chống gian lận: thiếu IV / thiếu chỉ số / thêm cờ transformed không né được kiểm tra chỉ số', async () => {
  await setup();
  await putSave(A, saveData());
  const reasonsAfter = async (edit) => {
    await putSave(A, saveData());
    const data = saveData();
    edit(data.party[0]);
    await play(A, data);
    return (await flagsOf(A)).map((f) => `${f.severity}:${f.reason}`);
  };
  // Bỏ IV rồi sửa chỉ số: chặn hẳn (bản trên mạng giữ nguyên)
  const noIvs = await reasonsAfter((m) => {
    delete m.ivs;
    m.atk = 999;
  });
  assert.ok(noIvs.includes('hard:iv'), noIvs.join());
  assert.notEqual((await db.query('select data from public.saves where user_id = $1', [A])).rows[0].data.party[0].atk, 999);
  // Thêm cờ transformed (biến hình) để được bỏ qua: vẫn bị kiểm tra
  assert.ok((await reasonsAfter((m) => {
    m.transformed = { speciesId: 'mewtwo' };
    m.atk = 999;
  })).includes('soft:stats'));
  // Bỏ chỉ số / HP tối đa: tính là không khớp
  assert.ok((await reasonsAfter((m) => delete m.atk)).includes('soft:stats'));
  assert.ok((await reasonsAfter((m) => delete m.maxHp)).includes('soft:stats'));
  // Bỏ HP: chặn hẳn
  assert.ok((await reasonsAfter((m) => delete m.hp)).includes('hard:hp'));
});

test('SQL chống gian lận: tự thêm vật phẩm bị tính vào tài sản; mua / bán đồ bình thường thì không sao', async () => {
  await setup();
  // 999 Rare Candy (giá 15000): tài sản tăng vọt
  await putSave(A, saveData({ bag: { potion: 5 } }));
  await play(A, saveData({ bag: { potion: 5, rareCandy: 999 } }));
  assert.ok((await flagsOf(A)).some((f) => f.reason === 'wealth_gain'));
  // Master Ball (không có giá): thêm quá 1 cái trong một mốc thì bị ghi nhận
  await putSave(A, saveData({ bag: { potion: 5 } }));
  await play(A, saveData({ bag: { potion: 5, masterBall: 1 } }));
  assert.deepEqual(await flagsOf(A), [], 'quà Master Ball của Giáo sư Oak');
  await putSave(A, saveData({ bag: { potion: 5 } }));
  await play(A, saveData({ bag: { potion: 5, masterBall: 99 } }));
  assert.ok((await flagsOf(A)).some((f) => f.reason === 'item_gain'));
  // Mua 80 Ultra Ball (96000₽) rồi bán 5 Potion: tiền đổi ra đồ, không tăng tài sản
  await putSave(B, saveData({ money: 100000, bag: { potion: 5 } }));
  await play(B, saveData({ money: 4000, bag: { potion: 5, ultraBall: 80 } }));
  await play(B, saveData({ money: 4750, bag: { ultraBall: 80 } }));
  assert.deepEqual(await flagsOf(B), []);
});

test('SQL giao dịch: không nhận hết được đồ (túi tối đa 999 mỗi loại) thì giao dịch tự huỷ, không ai mất gì', async () => {
  await setup();
  await putSave(A, saveData({ bag: { oranBerry: 999 } }));
  await putSave(B, saveData({ bag: { oranBerry: 50 } }));
  await db.query(`update public.trades set created_at = created_at - interval '1 hour'`);
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  await rpc(B, 'select public.trade_set_offer($1, $2)', [id, { mons: [], items: { oranBerry: 20 }, money: 0 }]);
  const row = async () => (await db.query('select * from public.trades where id = $1', [id])).rows[0];
  // B đồng ý trước (B không nhận gì nên được). A đồng ý: máy chủ thấy A không nhận thêm được 20 Oran Berry -> huỷ
  await rpc(B, 'select public.trade_ready($1, $2)', [id, (await row()).offer_a]);
  assert.equal((await rpc(A, 'select public.trade_ready($1, $2) as r', [id, (await row()).offer_b])).rows[0].r, 'cancelled');
  const done = await row();
  assert.equal(done.status, 'cancelled');
  assert.match(done.cancel_reason, /An không nhận thêm được 20 Oran Berry: túi chỉ chứa tối đa 999 mỗi loại \(đang có 999\)\. Giao dịch đã huỷ\./);
  // Không ai mất gì: bản lưu hai bên giữ nguyên, không có gì chờ nhận
  const bag = async (uid) => (await db.query('select data from public.saves where user_id = $1', [uid])).rows[0].data.bag;
  assert.deepEqual(await bag(A), { oranBerry: 999 });
  assert.deepEqual(await bag(B), { oranBerry: 50 });
  assert.equal((await db.query(`select count(*)::int as n from public.trades where status = 'done' and $1 in (a, b)`, [A])).rows[0].n, 0);
  // Đưa đi 20 rồi nhận 20 thì vẫn vừa
  const ok = await trade({ mons: [], items: { oranBerry: 20 }, money: 0 }, { mons: [], items: { oranBerry: 20 }, money: 0 });
  assert.equal(ok.err, null);
  assert.equal((await db.query('select status from public.trades where id = $1', [ok.id])).rows[0].status, 'done');
});

test('SQL giao dịch: kiểm tra lại lúc chốt (túi đã đầy sau khi đồng ý) và huỷ có lý do; vật phẩm quan trọng không giao dịch được', async () => {
  await setup();
  await putSave(A, saveData({ bag: { oranBerry: 900 } }));
  await putSave(B, saveData({ bag: { oranBerry: 50, bicycle: 1 } }));
  await db.query(`update public.trades set created_at = created_at - interval '1 hour'`);
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  await rpc(B, 'select public.trade_set_offer($1, $2)', [id, { mons: [], items: { oranBerry: 50 }, money: 0 }]);
  const row = async () => (await db.query('select * from public.trades where id = $1', [id])).rows[0];
  await rpc(A, 'select public.trade_ready($1, $2)', [id, (await row()).offer_b]);
  await rpc(B, 'select public.trade_ready($1, $2)', [id, (await row()).offer_a]);
  // Trong lúc đó bản lưu của A lên 999 Oran Berry: lúc chốt máy chủ huỷ
  await as('');
  await db.query(`update public.saves set data = jsonb_set(data, '{bag,oranBerry}', '999') where user_id = $1`, [A]);
  await rpc(A, 'select public.trade_confirm($1)', [id]);
  assert.equal((await rpc(B, 'select public.trade_confirm($1) as r', [id])).rows[0].r, 'cancelled');
  assert.match((await row()).cancel_reason, /An không nhận thêm được 50 Oran Berry/);
  // Bên huỷ ghi lý do: bên kia đọc được
  await putSave(A, saveData());
  const { id: id2 } = await trade({ mons: [], items: {}, money: 0 });
  await db.query(`update public.trades set status = 'open' where id = $1`, [id2]);
  await rpc(A, 'select public.trade_cancel($1, $2)', [id2, 'An không nhận thêm được tiền.']);
  assert.equal((await db.query('select cancel_reason from public.trades where id = $1', [id2])).rows[0].cancel_reason, 'An không nhận thêm được tiền.');
  // Xe đạp (vật phẩm quan trọng) không đưa được
  assert.match((await trade({ mons: [], items: {}, money: 0 }, { mons: [], items: { bicycle: 1 }, money: 0 })).err, /Xe đạp: vật phẩm không được phép giao dịch./);
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

test('SQL giao dịch: tên hiện trong giao dịch lấy từ bảng tên đăng nhập, không theo tên game gửi lên (chống mạo danh)', async () => {
  await setup();
  // Bảng tên như supabase/usernames.sql (chỉ phần cần cho test này); xoá sau khi xong để các test khác dùng tên gửi lên
  await db.exec('create table public.profiles (user_id uuid primary key, username text not null)');
  try {
    await db.query('insert into public.profiles values ($1, $2), ($3, $4)', [A, 'An', B, 'Binh']);
    await putSave(A, saveData());
    await putSave(B, saveData());
    const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'Admin'])).rows[0].id;
    await rpc(B, 'select public.trade_accept($1, $2)', [id, 'An']);
    const row = (await db.query('select a_name, b_name from public.trades where id = $1', [id])).rows[0];
    assert.deepEqual(row, { a_name: 'An', b_name: 'Binh' });
  } finally {
    await db.exec('drop table public.profiles');
  }
});

test('SQL nhật ký lỗi: khách spam (chưa đăng nhập) chỉ làm đầy phần của khách, lỗi của người đang chơi vẫn ghi được', async () => {
  await setup();
  await db.query('delete from public.client_errors');
  const send = async (uid, ip, msg) => {
    await db.query(`select set_config('test.uid', $1, false), set_config('request.headers', $2, false)`,
      [uid ?? '', JSON.stringify({ 'x-forwarded-for': ip })]);
    await db.query('select public.log_client_error($1, $2, $3, $4)', ['error', msg, null, {}]);
  };
  const count = async (where) => (await db.query(`select count(*)::int as n from public.client_errors where ${where}`)).rows[0].n;
  // Một IP chỉ gửi được 10 lỗi khác nhau / giờ
  for (let i = 0; i < 15; i++) await send(null, '10.0.0.1', `khách ${i}`);
  assert.equal(await count(`user_id is null`), 10);
  assert.equal(await count(`ip_hash = md5('10.0.0.1')`), 10, 'chỉ giữ IP dạng băm');
  // Đổi IP liên tục (giả x-forwarded-for) thì vẫn dừng ở 200 dòng của khách
  for (let i = 0; i < 300; i++) await send(null, `10.1.${i % 250}.${Math.floor(i / 250)}`, `spam ${i}`);
  assert.equal(await count(`user_id is null`), 200);
  // Người đã đăng nhập vẫn gửi lỗi được (bản cũ: ngưỡng chung cả bảng nên khách spam là chặn luôn)
  await send(A, '10.9.9.9', 'Lỗi thật khi đang chơi');
  assert.equal(await count(`user_id = '${A}'`), 1);
  assert.equal(await count(`user_id is not null and ip_hash is not null`), 0, 'không lưu IP của người đã đăng nhập');
  await db.query(`select set_config('test.uid', '', false), set_config('request.headers', '', false)`);
});

test('SQL thiết bị tin cậy: phiên chưa xác nhận thiết bị không dùng được dữ liệu; nhập mã email thì nhớ thiết bị', async () => {
  await setup();
  await putSave(A, saveData());
  await putSave(B, saveData());
  const T1 = 'a'.repeat(64);
  const T2 = 'b'.repeat(64);
  const now = Math.floor(Date.now() / 1000);
  // Phiên đăng nhập của A: session_id + cách đăng nhập (amr) như JWT của Supabase
  const session = (sid, method, at = now) => db.query(`select set_config('test.uid', $1, false), set_config('test.jwt', $2, false)`,
    [A, JSON.stringify({ sub: A, session_id: sid, amr: [{ method, timestamp: at }] })]);
  const check = async (token) => (await db.query('select public.device_check($1, $2) as r', [token, 'test'])).rows[0].r;
  const asPlayer = async (sql, params) => {
    await db.exec('set role authenticated');
    try {
      return (await db.query(sql, params)).rows;
    } finally {
      await db.exec('reset role');
    }
  };
  const canReadSave = async () => (await asPlayer('select user_id from public.saves where user_id = $1', [A])).length === 1;
  const S = (n) => `cccccccc-0000-4000-8000-00000000000${n}`;

  // Công tắc tắt (mặc định): không hỏi gì
  await session(S(1), 'password');
  assert.equal(await check(T1), 'ok');
  assert.equal(await canReadSave(), true);

  await db.query(`update public.app_settings set value = 'true' where key = 'require_device_verification'`);
  try {
    // Đăng nhập bằng mật khẩu trên thiết bị lạ: phải xác nhận, chưa xác nhận thì không đọc / ghi bản lưu, giao dịch, giành quyền
    await session(S(2), 'password');
    assert.equal(await check(T1), 'verify');
    assert.equal(await canReadSave(), false, 'RLS chặn đọc bản lưu');
    assert.equal((await asPlayer(`update public.saves set play_time = 1 where user_id = $1 returning user_id`, [A])).length, 0, 'RLS chặn ghi');
    assert.match(await errorOf(() => db.query('select public.trade_open($1, $2)', [B, 'An'])), /chưa được xác nhận/);
    assert.match(await errorOf(() => db.query(`select public.claim_session($1, null, 'x')`, [S(9)])), /SESSION: DEVICE/);
    // Nhập đúng mã email (phiên mới, amr otp): nhớ thiết bị, dùng được dữ liệu
    await session(S(3), 'otp');
    assert.equal(await check(T1), 'ok');
    assert.equal(await canReadSave(), true);
    // Máy chủ chỉ giữ SHA-256 của mã thiết bị
    const stored = (await db.query('select token_hash from public.trusted_devices where user_id = $1', [A])).rows.map((r) => r.token_hash);
    assert.ok(!stored.includes(T1));
    assert.ok(stored.includes((await db.query(`select encode(sha256(convert_to($1, 'UTF8')), 'hex') as h`, [T1])).rows[0].h));
    // Lần sau đăng nhập bằng mật khẩu trên thiết bị đã nhớ: không hỏi nữa
    await session(S(4), 'password');
    assert.equal(await check(T1), 'ok');
    assert.equal(await canReadSave(), true);
    // Thiết bị khác (mã khác / không có mã): vẫn phải xác nhận
    await session(S(5), 'password');
    assert.equal(await check(T2), 'verify');
    assert.equal(await check(null), 'verify');
    // Mã email đã quá 15 phút: không tính
    await session(S(6), 'otp', now - 20 * 60);
    assert.equal(await check(T2), 'verify');
    // Bấm link đặt lại mật khẩu / xác nhận đăng ký cũng là đã có email
    await session(S(7), 'recovery');
    assert.equal(await check(T2), 'ok');
  } finally {
    await db.query(`update public.app_settings set value = 'false' where key = 'require_device_verification'`);
    await db.exec('delete from public.trusted_devices; delete from public.trusted_sessions');
    await db.query(`select set_config('test.uid', '', false), set_config('test.jwt', '', false)`);
  }
  // Tắt công tắc: phiên chưa xác nhận lại dùng được như cũ
  await session(S(8), 'password');
  assert.equal(await canReadSave(), true);
  await db.query(`select set_config('test.uid', '', false), set_config('test.jwt', '', false)`);
});

test('SQL chống gian lận: đồ Pokémon đang cầm phải là vật phẩm có trong game và cầm được; đồ cầm tính vào tài sản', async () => {
  await setup();
  const holding = (item) => {
    const mon = createMonster('pikachu', 20);
    mon.heldItem = item;
    return saveData({ party: [mon, createMonster('rattata', 12)] });
  };
  // Hợp lệ: không cầm gì / cầm Leftovers (vd Snorlax hoang dã cầm sẵn)
  await putSave(A, saveData());
  await play(A, holding('leftovers'));
  assert.deepEqual(await flagsOf(A), []);
  // Không hợp lệ: vật phẩm quan trọng, TM, mã lạ, không phải chuỗi → không ghi, khoá giao dịch
  for (const bad of ['bicycle', 'tmBodySlam', 'fakeItem', 42]) {
    await putSave(B, saveData());
    await play(B, holding(bad));
    const kept = (await db.query('select data from public.saves where user_id = $1', [B])).rows[0].data;
    assert.equal(kept.party[0].heldItem ?? null, null, `đồ cầm ${bad}: bản trên mạng giữ nguyên`);
    assert.ok((await flagsOf(B)).some((f) => f.severity === 'hard' && f.reason === 'held_item'), `đồ cầm ${bad}`);
    assert.equal(await blocked(B), true);
  }
  // Cho Pokémon cầm Master Ball đang có trong túi / tháo ra: tài sản không đổi, không bị ghi nhận
  const withBall = holding('masterBall');
  await putSave(A, saveData({ bag: { potion: 5, masterBall: 1 } }));
  await play(A, { ...withBall, bag: { potion: 5 } });
  await play(A, saveData({ bag: { potion: 5, masterBall: 1 } }));
  assert.deepEqual(await flagsOf(A), []);
  // Không giấu được đồ thêm bằng cách cho Pokémon cầm: 2 Master Ball mới trên tay Pokémon vẫn bị tính
  const two = [createMonster('pikachu', 20), createMonster('rattata', 12)];
  for (const m of two) m.heldItem = 'masterBall';
  await putSave(A, saveData());
  await play(A, saveData({ party: two }));
  assert.ok((await flagsOf(A)).some((f) => f.reason === 'item_gain'));
});

test('SQL giao dịch: Pokémon cầm đồ không hợp lệ (bản lưu lọt qua khi chưa chạy anticheat) thì không đưa được', async () => {
  await setup();
  const bad = createMonster('kadabra', 30);
  bad.heldItem = 'bicycle';
  await putSave(A, saveData());
  await putSave(B, saveData());
  // Ghi thẳng như lúc chưa có trigger chống gian lận
  await db.query(`set session_replication_role = replica`);
  await db.query('update public.saves set data = $2 where user_id = $1', [B, saveData({ party: [createMonster('rattata', 12), bad] })]);
  await db.query(`set session_replication_role = origin`);
  const { err } = await trade({ mons: [], items: {}, money: 0 }, { mons: [bad], items: {}, money: 0 });
  assert.match(err, /Kadabra: đồ đang cầm không được phép giao dịch./);
  // Cầm đồ hợp lệ thì đưa được bình thường
  const ok = createMonster('kadabra', 30);
  ok.heldItem = 'twistedSpoon';
  await putSave(B, saveData({ party: [createMonster('rattata', 12), ok] }));
  assert.equal((await trade({ mons: [], items: {}, money: 0 }, { mons: [ok], items: {}, money: 0 })).err, null);
});

test('SQL giao dịch: tối đa 6 dòng (Pokémon + loại vật phẩm), 999 mỗi loại; chỉ tiền hợp lệ; hai bên không đưa gì thì không có giao dịch', async () => {
  await setup();
  const party = ['pikachu', 'abra', 'geodude', 'rattata', 'pidgey', 'oddish'].map((id) => createMonster(id, 20));
  const bag = { potion: 999, oranBerry: 50, antidote: 9, superPotion: 9, ultraBall: 9, greatBall: 9, repel: 9 };
  const none = { mons: [], items: {}, money: 0 };
  // 5 Pokémon + 2 loại vật phẩm (7 dòng): máy chủ từ chối ngay khi gửi đề nghị
  await putSave(A, saveData({ party, bag }));
  await putSave(B, saveData({ money: 100000, bag: {} }));
  const id = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id, 'Bình']);
  const seven = { mons: party.slice(0, 5), items: { potion: 1, oranBerry: 1 }, money: 0 };
  assert.match(await errorOf(() => rpc(A, 'select public.trade_set_offer($1, $2)', [id, seven])), /tối đa 6 dòng/);
  const sevenItems = { mons: [], items: { potion: 1, oranBerry: 1, antidote: 1, superPotion: 1, ultraBall: 1, greatBall: 1, repel: 1 }, money: 0 };
  assert.match(await errorOf(() => rpc(A, 'select public.trade_set_offer($1, $2)', [id, sevenItems])), /tối đa 6 dòng/);
  // Đề nghị lọt qua lúc gửi (ghi thẳng vào bảng) vẫn bị chặn lúc chốt
  await as('');
  await db.query('update public.trades set offer_a = $2 where id = $1', [id, seven]);
  await db.query(`update public.trades set status = 'cancelled' where id = $1`, [id]);
  // 5 Pokémon + 1 loại vật phẩm, đổi lấy tiền: được
  await putSave(A, saveData({ party, bag }));
  assert.equal((await trade({ mons: party.slice(0, 5), items: { potion: 999 }, money: 0 }, { mons: [], items: {}, money: 50000 })).err, null);
  // Quá 999 mỗi loại: từ chối ngay khi gửi đề nghị
  await putSave(A, saveData({ party, bag }));
  const id2 = (await rpc(A, 'select public.trade_open($1, $2) as id', [B, 'An'])).rows[0].id;
  await rpc(B, 'select public.trade_accept($1, $2)', [id2, 'Bình']);
  assert.match(await errorOf(() => rpc(A, 'select public.trade_set_offer($1, $2)', [id2, { mons: [], items: { potion: 1000 }, money: 0 }])), /tối đa 999/);
  // Chỉ một bên đưa (bên kia không đưa gì) / cả hai cùng đưa tiền: hợp lệ
  await putSave(A, saveData({ party, bag }));
  await putSave(B, saveData({ money: 100000, bag: {} }));
  assert.equal((await trade(none, { mons: [], items: {}, money: 1000 })).err, null);
  await putSave(A, saveData({ party, bag }));
  await putSave(B, saveData({ money: 100000, bag: {} }));
  assert.equal((await trade({ mons: [], items: {}, money: 300 }, { mons: [], items: {}, money: 1000 })).err, null);
  // Cả hai không đưa gì mà bấm Giao dịch: không có giao dịch (không ghi thành đã chốt), báo lý do cho cả hai
  await putSave(A, saveData({ party, bag }));
  const empty = await trade(none, none);
  assert.equal(empty.err, null);
  const row = (await db.query('select status, cancel_reason from public.trades where id = $1', [empty.id])).rows[0];
  assert.equal(row.status, 'cancelled');
  assert.equal(row.cancel_reason, 'Hai bên đều không đưa gì nên không có giao dịch.');
});

test('SQL chống gian lận: mốc ngày — cộng lén từng chút mỗi 10 phút vẫn không quá 1.000.000₽ / 24 giờ', async () => {
  await setup();
  let playTime = 3600;
  // Gửi bản lưu như đã chơi thêm 11 phút (lùi mốc 10 phút về trước 11 phút cho "thời gian thật" trôi qua)
  const step = async (uid, money) => {
    await as('');
    await db.query(`update public.save_baseline set at = at - interval '11 minutes' where user_id = $1`, [uid]);
    playTime += 11 * 60;
    await play(uid, saveData({ money, playTime }));
  };
  const reasons = async (uid) => (await flagsOf(uid)).map((f) => f.reason);
  // Người chơi thật: tăng 100.000₽ mỗi 11 phút, 9 lần (900.000₽ trong ngày): không sao
  await putSave(A, saveData({ money: 0, playTime }));
  for (let i = 1; i <= 9; i++) await step(A, i * 100000);
  assert.deepEqual(await reasons(A), []);
  // Gian lận: 140.000₽ mỗi 11 phút (dưới ngưỡng mốc ngắn 155.000₽) — tới lần thứ 8 (1.120.000₽) thì bị ghi nhận, khoá giao dịch
  playTime = 3600;
  await putSave(B, saveData({ money: 0, playTime }));
  for (let i = 1; i <= 7; i++) await step(B, i * 140000);
  assert.deepEqual(await reasons(B), [], 'chưa quá 1.000.000₽');
  await step(B, 8 * 140000);
  assert.deepEqual(await reasons(B), ['wealth_day']);
  assert.equal(await blocked(B), true);
  // Qua 24 giờ thì mốc ngày dời lên: tính lại từ đầu
  playTime = 3600;
  await putSave(A, saveData({ money: 0, playTime }));
  for (let i = 1; i <= 9; i++) await step(A, i * 100000);
  await db.query(`update public.save_baseline set day_at = day_at - interval '25 hours' where user_id = $1`, [A]);
  await step(A, 1000000); // dời mốc ngày lên bản này
  for (let i = 1; i <= 9; i++) await step(A, 1000000 + i * 100000);
  assert.deepEqual(await reasons(A), []);
  // Tài khoản có từ trước (mốc chưa có cột ngày): lấy theo mốc ngắn, không bị khoá nhầm
  playTime = 3600;
  await putSave(A, saveData({ money: 0, playTime }));
  await db.query('update public.save_baseline set day_summary = null, day_at = null where user_id = $1', [A]);
  await step(A, 100000);
  assert.deepEqual(await reasons(A), []);
  assert.ok((await db.query('select day_summary from public.save_baseline where user_id = $1', [A])).rows[0].day_summary);
});

test('SQL chống gian lận: nhận 2.000.000₽ qua giao dịch không bị tính vào mốc ngày', async () => {
  await setup();
  const aParty = [createMonster('pikachu', 20), createMonster('kadabra', 30)];
  await putSave(A, saveData({ money: 5000, party: aParty, playTime: 3600 }));
  await putSave(B, saveData({ money: 2500000, playTime: 3600 }));
  const { id, err } = await trade({ mons: [aParty[1]], items: {}, money: 0 }, { mons: [], items: {}, money: 2000000 });
  assert.equal(err, null);
  await play(A, { ...saveData({ money: 2005000, party: [aParty[0]], playTime: 3660 }), tradesDone: [id] });
  assert.deepEqual(await flagsOf(A), []);
  const got = { ...aParty[1], uid: 999 };
  await play(B, { ...saveData({ money: 500000, playTime: 3660 }), party: [...saveData().party, got], tradesDone: [id] });
  assert.deepEqual(await flagsOf(B), []);
});
