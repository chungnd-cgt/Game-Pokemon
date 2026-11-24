import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GYM_TMS, ITEMS, STORE_STOCK, canHold } from '../src/data/items.js';
import { SPECIES } from '../src/data/monsters.js';
import { BADGES } from '../src/data/badges.js';
import { createMonster, gainExp, expToReach } from '../src/game/monster.js';
import { evolutionTarget } from '../src/game/evolution.js';
import { canLearnDisc, relearnableMoves } from '../src/game/tms.js';
import { addCaught, resetState, state } from '../src/game/state.js';
import { GYM_RELEARNERS } from '../src/data/gymPeople.js';
import { MAPS } from '../src/data/map.js';

// Đĩa kỹ năng (TM), người dạy lại chiêu, độ thân thiết, OT

test('đĩa kỹ năng: có quầy bán ở trung tâm thương mại, mỗi gym tặng một đĩa, không cho Pokémon cầm', () => {
  const tms = Object.keys(ITEMS).filter((id) => ITEMS[id].kind === 'tm');
  assert.ok(tms.length >= 20);
  assert.ok(STORE_STOCK.tms.length >= 8 && STORE_STOCK.tms.every((id) => ITEMS[id].kind === 'tm' && ITEMS[id].price > 0));
  for (const b of BADGES) assert.equal(ITEMS[GYM_TMS[b.id]]?.kind, 'tm', `gym ${b.id}: thiếu đĩa sở trường`);
  assert.ok(tms.every((id) => !canHold(id)));
  assert.match(ITEMS.tmThunderbolt.name, /^TM\d\d Thunderbolt$/);
});

test('đĩa kỹ năng: học được theo hệ / bộ chiêu / chiêu thông dụng, vài loài không học được đĩa nào', () => {
  assert.ok(canLearnDisc('pikachu', 'tmThunderbolt'), 'cùng hệ');
  assert.ok(!canLearnDisc('charmander', 'tmThunderbolt'), 'khác hệ, không có trong bộ chiêu');
  assert.ok(canLearnDisc('charmander', 'tmDoubleTeam'), 'chiêu thông dụng');
  assert.ok(!canLearnDisc('magikarp', 'tmDoubleTeam'), 'Magikarp không học được đĩa');
  assert.ok(canLearnDisc('snorlax', 'hmSurf'), 'HM: loài trong learners');
  const viaLearnset = Object.keys(SPECIES).find((id) => SPECIES[id].learnset.some(([, m]) => m === 'psychic') && !SPECIES[id].types.includes('psychic'));
  if (viaLearnset) assert.ok(canLearnDisc(viaLearnset, 'tmPsychic'), `${viaLearnset}: có Psychic trong bộ chiêu`);
});

test('người dạy lại chiêu: ở gym 2 và gym 6, đứng trên ô đi được; dạy lại chiêu đã quên tới cấp hiện tại', () => {
  assert.deepEqual(GYM_RELEARNERS.map((n) => n.map), ['gym2', 'gym6']);
  for (const n of GYM_RELEARNERS) assert.equal(MAPS[n.map].isSolid(n.x, n.y), false, n.id);
  const mon = createMonster('charmander', 20);
  const forgotten = mon.moves.shift();
  assert.ok(relearnableMoves(mon).includes(forgotten));
  assert.ok(relearnableMoves(mon).every((m) => !mon.moves.includes(m)));
  const later = SPECIES.charmander.learnset.find(([lv]) => lv > 20)?.[1];
  if (later) assert.ok(!relearnableMoves(mon).includes(later), 'chưa tới cấp thì chưa học lại được');
});

test('độ thân thiết: lên cấp tăng; tiến hoá theo độ thân thiết khi đủ (evo.happiness)', () => {
  const mon = createMonster('rattata', 5);
  const before = mon.happiness;
  gainExp(mon, expToReach(mon, 6) - mon.exp);
  assert.ok(mon.happiness > before);
  const sp = SPECIES.rattata;
  const saved = sp.evolution;
  try {
    sp.evolution = [{ to: 'raticate', happiness: 220 }];
    assert.equal(evolutionTarget(mon), null);
    mon.happiness = 230;
    assert.equal(evolutionTarget(mon), 'raticate');
  } finally {
    sp.evolution = saved;
  }
});

test('OT: gắn tên người chơi khi bắt được, Pokémon đổi từ người khác giữ OT cũ', () => {
  resetState();
  state.player = { name: 'Chung' };
  const caught = createMonster('pidgey', 3);
  addCaught(caught);
  assert.equal(caught.ot, 'Chung');
  const traded = { ...createMonster('abra', 10), ot: 'Lan' };
  addCaught(traded);
  assert.equal(traded.ot, 'Lan');
});
