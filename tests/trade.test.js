import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMonster } from '../src/game/monster.js';
import { evolutionTarget, tradeEvolutionTarget } from '../src/game/evolution.js';
import { ITEM_MAX, resetState, state } from '../src/game/state.js';
import {
  TRADE_MAX_MONS, applyTrade, canTrade, emptyOffer, maxOfferMons, monTradeProblem, offerProblem, receiveProblem,
} from '../src/game/trade.js';
import { rematchDef } from '../src/game/trainers.js';

function setup(partySpecies = ['pikachu', 'abra', 'geodude']) {
  resetState();
  state.party = partySpecies.map((id) => createMonster(id, 30));
  state.bag = { potion: 5, oranBerry: 3, bicycle: 1 };
  state.money = 1000;
}

test('giao dịch: cần đủ 4 huy hiệu', () => {
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
  assert.ok(offerProblem({ ...emptyOffer(), items: { bicycle: 1 } }));
  assert.ok(offerProblem({ ...emptyOffer(), items: { potion: 6 } }));
  assert.equal(offerProblem({ ...emptyOffer(), items: { potion: 5, oranBerry: 3 } }), null);
  assert.ok(offerProblem({ ...emptyOffer(), money: 1001 }));
});

test('giao dịch: nhận đồ không vượt quá 999 mỗi loại', () => {
  setup();
  state.bag.potion = ITEM_MAX - 2;
  assert.ok(receiveProblem(emptyOffer(), { ...emptyOffer(), items: { potion: 5 } }));
  assert.equal(receiveProblem({ ...emptyOffer(), items: { potion: 3 } }, { ...emptyOffer(), items: { potion: 5 } }), null);
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
