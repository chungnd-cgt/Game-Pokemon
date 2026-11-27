import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMonster } from '../src/game/monster.js';
import { evolutionTarget, tradeEvolutionTarget } from '../src/game/evolution.js';
import { ITEM_MAX, resetState, state } from '../src/game/state.js';
import {
  MONEY_MAX, TRADE_MAX_MONS, TRADE_MAX_ROWS, TRADE_ROWS_FULL, offerRows, TRADE_MIN_BADGES, applyTrade, itemTradeProblem, canTrade, emptyOffer, maxOfferMons, monTradeProblem, offerProblem, receiveProblem,
} from '../src/game/trade.js';
import { rematchDef } from '../src/game/trainers.js';

function setup(partySpecies = ['pikachu', 'abra', 'geodude']) {
  resetState();
  state.party = partySpecies.map((id) => createMonster(id, 30));
  state.bag = { potion: 5, oranBerry: 3, bicycle: 1 };
  state.money = 1000;
}

test('giao dịch: cần đủ 4 huy hiệu', () => {
  assert.equal(TRADE_MIN_BADGES, 4);
  setup();
  assert.equal(canTrade(), false);
  for (const b of ['rock', 'water', 'electric', 'grass']) state.badges.add(b);
  assert.equal(canTrade(), true);
});

test('giao dịch: tối đa 5 Pokémon và phải chừa 1 con trong đội', () => {
  setup(['pikachu', 'abra', 'geodude', 'machop', 'gastly', 'rattata']);
  assert.equal(maxOfferMons(), TRADE_MAX_MONS);
  const offer = { ...emptyOffer(), mons: state.party.slice(0, 5) };
  assert.equal(offerProblem(offer), null);
  assert.match(offerProblem({ ...emptyOffer(), mons: state.party.slice() }), /tối đa|chừa/);
  setup(['pikachu', 'abra']);
  assert.equal(maxOfferMons(), 1);
  assert.match(offerProblem({ ...emptyOffer(), mons: state.party.slice() }), /chừa lại/);
});

test('giao dịch: không đưa được huyền thoại, vật phẩm quan trọng, quá số đang có', () => {
  setup(['pikachu', 'mewtwo']);
  assert.ok(monTradeProblem(state.party[1]));
  assert.ok(offerProblem({ ...emptyOffer(), mons: [state.party[1]] }));
  // Đồ đang cầm không hợp lệ (vật phẩm quan trọng / TM / mã lạ): không đưa được, câu báo giống máy chủ
  const holder = state.party[0];
  for (const bad of ['bicycle', 'tmBodySlam', 'fakeItem']) {
    holder.heldItem = bad;
    assert.equal(monTradeProblem(holder), `${holder.name}: đồ đang cầm không được phép giao dịch.`);
  }
  holder.heldItem = 'leftovers';
  assert.equal(monTradeProblem(holder), null);
  holder.heldItem = null;
  // Vật phẩm quan trọng / game không có: báo "không được phép giao dịch" (giống câu máy chủ báo)
  assert.equal(offerProblem({ ...emptyOffer(), items: { bicycle: 1 } }), 'Xe đạp: vật phẩm không được phép giao dịch.');
  assert.equal(itemTradeProblem('bicycle'), 'Xe đạp: vật phẩm không được phép giao dịch.');
  assert.equal(itemTradeProblem('khongCo'), 'khongCo: vật phẩm không được phép giao dịch.');
  assert.equal(itemTradeProblem('potion'), null);
  for (const id of ['laprasMount', 'arcanineMount', 'oldRod', 'hmSurf']) assert.ok(itemTradeProblem(id), id);
  assert.ok(offerProblem({ ...emptyOffer(), items: { potion: 6 } }));
  assert.equal(offerProblem({ ...emptyOffer(), items: { potion: 5, oranBerry: 3 } }), null);
  assert.ok(offerProblem({ ...emptyOffer(), money: 1001 }));
});

test('giao dịch: nhận đồ không vượt quá 999 mỗi loại', () => {
  setup();
  state.bag.potion = ITEM_MAX - 2;
  assert.ok(receiveProblem(emptyOffer(), { ...emptyOffer(), items: { potion: 5 } }));
  assert.equal(receiveProblem({ ...emptyOffer(), items: { potion: 3 } }, { ...emptyOffer(), items: { potion: 5 } }), null);
  // Có 999 Oran Berry, nhận thêm 20: không nhận được, câu báo khớp với máy chủ (trades.sql: trade_receive_problem)
  state.bag.oranBerry = ITEM_MAX;
  assert.equal(receiveProblem(emptyOffer(), { ...emptyOffer(), items: { oranBerry: 20 } }, 'An'),
    'An không nhận thêm được 20 Oran Berry: túi chỉ chứa tối đa 999 mỗi loại (đang có 999).');
  // Tiền quá tối đa
  state.money = MONEY_MAX - 10;
  assert.match(receiveProblem(emptyOffer(), { ...emptyOffer(), money: 11 }), /không nhận thêm được tiền/);
  assert.equal(receiveProblem(emptyOffer(), { ...emptyOffer(), money: 10 }), null);
});

test('giao dịch: áp dụng đổi Pokémon, đồ, tiền; Pokémon nhận được có uid mới', () => {
  setup(['pikachu', 'abra', 'geodude']);
  const abra = state.party[1];
  const theirMon = structuredClone(createMonster('kadabra', 35));
  theirMon.uid = state.party[0].uid; // trùng uid với Pokémon của mình
  const mine = { mons: [abra], items: { potion: 2 }, money: 300 };
  const theirs = { mons: [theirMon], items: { oranBerry: 4, rareCandy: 1 }, money: 50 };
  const received = applyTrade(mine, theirs);
  assert.equal(state.party.some((m) => m.uid === abra.uid), false);
  assert.equal(received.length, 1);
  assert.equal(received[0].speciesId, 'kadabra');
  assert.notEqual(received[0].uid, state.party[0].uid);
  assert.equal(state.party.length, 3);
  assert.equal(state.bag.potion, 3);
  assert.equal(state.bag.oranBerry, 7);
  assert.equal(state.bag.rareCandy, 1);
  assert.equal(state.money, 1000 - 300 + 50);
  assert.ok(state.dex.caught.size > 0);
});

test('giao dịch: đội đầy thì Pokémon nhận được vào hộp PC', () => {
  setup(['pikachu', 'abra', 'geodude', 'machop', 'gastly', 'rattata']);
  applyTrade(emptyOffer(), { ...emptyOffer(), mons: [createMonster('pidgey', 10)] });
  assert.equal(state.party.length, 6);
  assert.equal(state.storage.filter(Boolean).length, 1);
});

test('tiến hoá khi trao đổi: Kadabra, Machoke, Graveler, Haunter; Everstone chặn; không tiến hoá theo cấp nữa', () => {
  const pairs = { kadabra: 'alakazam', machoke: 'machamp', graveler: 'golem', haunter: 'gengar' };
  for (const [from, to] of Object.entries(pairs)) {
    const mon = createMonster(from, 60);
    assert.equal(tradeEvolutionTarget(mon), to);
    assert.equal(evolutionTarget(mon), null);
  }
  const held = createMonster('kadabra', 30);
  held.heldItem = 'everstone';
  assert.equal(tradeEvolutionTarget(held), null);
  assert.equal(tradeEvolutionTarget(createMonster('pikachu', 30)), null);
});

test('nhà huấn luyện đấu lại vẫn có dạng tiến hoá khi trao đổi ở cấp cao', () => {
  resetState();
  state.party = [createMonster('pikachu', 60)];
  const def = rematchDef({ id: 'x', team: [['kadabra', 30]] });
  assert.equal(def.team[0][0], 'alakazam');
  assert.equal(rematchDef({ id: 'y', team: [['kadabra', 30]] }, [createMonster('pikachu', 20)]).team[0][0], 'kadabra');
});

test('độ thân thiết: Pokémon mới 70, +1 khi hạ gục, -5 khi bị gục, giữ trong 0..255', async () => {
  const { HAPPINESS_START, changeHappiness, upgradeMonster } = await import('../src/game/monster.js');
  const mon = createMonster('pikachu', 10);
  assert.equal(mon.happiness, HAPPINESS_START);
  changeHappiness(mon, 1);
  assert.equal(mon.happiness, 71);
  changeHappiness(mon, -5);
  assert.equal(mon.happiness, 66);
  changeHappiness(mon, -500);
  assert.equal(mon.happiness, 0);
  changeHappiness(mon, 999);
  assert.equal(mon.happiness, 255);
  const old = createMonster('rattata', 5);
  delete old.happiness;
  upgradeMonster(old);
  assert.equal(old.happiness, HAPPINESS_START);
});

test('giao dịch: tối đa 6 dòng mỗi lượt (Pokémon + loại vật phẩm), 999 mỗi loại; chỉ tiền / không đưa gì vẫn hợp lệ', () => {
  setup(['pikachu', 'abra', 'geodude', 'rattata', 'pidgey', 'oddish']);
  state.bag = { potion: 999, oranBerry: 50, antidote: 9, superPotion: 9, ultraBall: 9, greatBall: 9, repel: 9 };
  assert.equal(TRADE_MAX_ROWS, 6);
  const five = state.party.slice(0, 5);
  // 5 Pokémon + 1 loại vật phẩm = 6 dòng: được
  assert.equal(offerProblem({ ...emptyOffer(), mons: five, items: { potion: 1 } }), null);
  assert.equal(offerRows({ ...emptyOffer(), mons: five, items: { potion: 1 } }), 6);
  // 5 Pokémon + 2 loại = 7 dòng; 7 loại vật phẩm: không được
  assert.equal(offerProblem({ ...emptyOffer(), mons: five, items: { potion: 1, oranBerry: 1 } }), TRADE_ROWS_FULL);
  const seven = { potion: 1, oranBerry: 1, antidote: 1, superPotion: 1, ultraBall: 1, greatBall: 1, repel: 1 };
  assert.equal(offerProblem({ ...emptyOffer(), items: seven }), TRADE_ROWS_FULL);
  const { repel, ...six } = seven;
  assert.equal(offerProblem({ ...emptyOffer(), items: six }), null);
  // 999 mỗi loại
  assert.equal(offerProblem({ ...emptyOffer(), items: { potion: 999 } }), null);
  assert.match(offerProblem({ ...emptyOffer(), items: { potion: 1000 } }), /tối đa 999/);
  // Chỉ tiền / không đưa gì: hợp lệ (tiền không tính dòng)
  assert.equal(offerProblem({ ...emptyOffer(), money: 500 }), null);
  assert.equal(offerProblem(emptyOffer()), null);
  assert.equal(offerProblem({ ...emptyOffer(), mons: five, items: { potion: 1 }, money: 500 }), null);
});
