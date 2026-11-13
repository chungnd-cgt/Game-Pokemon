import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BREAKABLE, abilityOf, calcDamage, catchChance, effectiveSpeed, hasSecondary, moveEffect, moveHits, secondaryFactor,
  trappedBy, weatherHpChange,
} from '../src/battle/formulas.js';
import {
  attractBlocked, checkCanMove, clearBattleState, clearVolatile, stageDropReaction, stageGuarded, stageMoveUseless, statusBlocked,
} from '../src/battle/status.js';
import {
  PICKUP_COMMON, anticipates, contactAbility, downloadStat, harvestBerry, imposterTransform, pickupItem, rememberBerry, traceable,
} from '../src/battle/abilityEffects.js';
import {
  TRANSFORM_PP, baseSpeciesId, lookShiny, movePpMax, resumeBattleForm, revertBattleForm, setBattleAbility, suspendBattleForm,
  transform, transformBlocked,
} from '../src/battle/transform.js';
import { ABILITIES, abilityIdOf, speciesAbilities } from '../src/data/abilities.js';
import { ITEMS } from '../src/data/items.js';
import { MOVES } from '../src/data/moves.js';
import { SPECIES } from '../src/data/monsters.js';
import { DEX_BY_SLUG } from '../src/data/pokedex.js';
import { STAT_KEYS } from '../src/data/stats.js';
import { calcStats, createMonster, gainExp, expToReach, upgradeMonster } from '../src/game/monster.js';

const fixed = (v) => () => v;
const seq = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
// Pokémon cố định để tính toán: IV 31, không EV, tính cách trung tính
function mon(speciesId, level, extra = {}) {
  const m = createMonster(speciesId, level, { rng: fixed(0.99), shiny: false, hiddenAbility: false });
  Object.assign(m, { ivs: Object.fromEntries(STAT_KEYS.map((k) => [k, 31])), nature: 'hardy' });
  Object.assign(m, calcStats(SPECIES[speciesId], level, m.ivs, m.evs, m.nature), extra);
  m.hp = extra.hp ?? m.maxHp;
  return m;
}
// Sát thương với rng cố định (không chí mạng, hệ số ngẫu nhiên 0.925)
const dmg = (a, d, move, ctx = {}) => calcDamage(a, d, MOVES[move] ?? move, fixed(0.5), ctx).damage;

// ---------- Dữ liệu ----------

test('mọi đặc tính của 151 loài trong Pokédex đều có trong game, kèm mô tả tiếng Việt', () => {
  for (const slug of Object.keys(SPECIES)) {
    for (const a of DEX_BY_SLUG[slug].abilities) {
      const id = abilityIdOf(a.name);
      assert.ok(ABILITIES[id], `${slug}: thiếu đặc tính ${a.name}`);
      assert.equal(ABILITIES[id].name, a.name);
    }
  }
  for (const [id, a] of Object.entries(ABILITIES)) {
    assert.ok(a.desc.length > 15 && !a.desc.includes('chưa có'), `${id}: mô tả`);
  }
});

test('đặc tính thường / ẩn của mọi loài đúng như Pokédex (Gen 5), không còn đặc tính tạm thay thế', () => {
  for (const slug of Object.keys(SPECIES)) {
    const dex = DEX_BY_SLUG[slug].abilities;
    const normal = dex.filter((a) => !a.hidden).map((a) => abilityIdOf(a.name));
    const hidden = dex.find((a) => a.hidden);
    assert.deepEqual(SPECIES[slug].abilities, { normal, hidden: hidden ? abilityIdOf(hidden.name) : null }, slug);
  }
  assert.deepEqual(SPECIES.butterfree.abilities, { normal: ['compoundEyes'], hidden: 'tintedLens' });
  assert.deepEqual(SPECIES.jigglypuff.abilities, { normal: ['cuteCharm', 'competitive'], hidden: 'friendGuard' });
  assert.deepEqual(SPECIES.nidoking.abilities, { normal: ['poisonPoint', 'rivalry'], hidden: 'sheerForce' });
  assert.deepEqual(speciesAbilities('ditto'), { normal: ['limber'], hidden: 'imposter' });
  assert.deepEqual(speciesAbilities('porygon'), { normal: ['trace', 'download'], hidden: 'analytic' });
});

test('bản lưu cũ: đặc tính tạm thay thế được đổi sang đặc tính thật, đặc tính ẩn mang ở ô thường được đánh dấu ẩn', () => {
  const butterfree = upgradeMonster(Object.assign(createMonster('butterfree', 20), { ability: 'keenEye', hiddenAbility: false }));
  assert.equal(butterfree.ability, 'compoundEyes');
  assert.equal(butterfree.hiddenAbility, false);
  const wiggly = upgradeMonster(Object.assign(createMonster('wigglytuff', 30), { ability: 'oblivious', hiddenAbility: false }));
  assert.ok(['cuteCharm', 'competitive'].includes(wiggly.ability));
  // Trước đây Caterpie chưa có Shield Dust nên mang Run Away (đặc tính ẩn) ở ô thường: giữ, đánh dấu là ẩn
  const caterpie = upgradeMonster(Object.assign(createMonster('caterpie', 5), { ability: 'runAway', hiddenAbility: false }));
  assert.equal(caterpie.ability, 'runAway');
  assert.equal(caterpie.hiddenAbility, true);
  // Pokémon bình thường không bị đổi
  const pika = createMonster('pikachu', 5, { hiddenAbility: false });
  assert.equal(upgradeMonster({ ...pika }).ability, 'static');
});

test('bản lưu cũ qua save / load: Nidoking mang Poison Touch (tạm thay) tải lại thành Poison Point / Rivalry', async () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const { saveGame, loadGame } = await import('../src/game/save.js');
  const { resetState, state } = await import('../src/game/state.js');
  resetState();
  state.party = [Object.assign(createMonster('nidoking', 40), { ability: 'poisonTouch', hiddenAbility: false })];
  saveGame({ map: 'route1', x: 5, y: 10, facing: 'down' });
  resetState();
  loadGame();
  assert.ok(['poisonPoint', 'rivalry'].includes(state.party[0].ability));
  delete globalThis.localStorage;
});

// ---------- Transform ----------

test('Ditto có chiêu gốc Transform (không còn Pound), Mew học Transform ở cấp 10', () => {
  assert.deepEqual(createMonster('ditto', 30).moves, ['transform']);
  assert.ok(!SPECIES.ditto.learnset.some(([, m]) => m === 'pound'));
  assert.ok(SPECIES.mew.learnset.some(([lv, m]) => lv === 10 && m === 'transform'));
  assert.equal(MOVES.transform.accuracy, null);
  assert.equal(MOVES.transform.category, 'status');
});

test('Transform: chép loài (hệ), chỉ số trừ HP, bậc chỉ số, đặc tính, chiêu 5 PP; HP / cấp / giới tính giữ nguyên', () => {
  const ditto = mon('ditto', 30, { gender: null });
  const pidgey = mon('pidgeot', 40, { gender: 'male', stages: { atk: 2, speed: -1 } });
  const before = JSON.parse(JSON.stringify(ditto));
  assert.equal(transform(ditto, pidgey), true);
  assert.equal(ditto.speciesId, 'pidgeot');
  assert.deepEqual(SPECIES[ditto.speciesId].types, ['normal', 'flying']);
  for (const k of ['atk', 'def', 'spAtk', 'spDef', 'speed']) assert.equal(ditto[k], pidgey[k], k);
  assert.equal(ditto.maxHp, before.maxHp);
  assert.equal(ditto.hp, before.hp);
  assert.equal(ditto.level, 30);
  assert.equal(ditto.name, 'Ditto');
  assert.equal(ditto.ability, pidgey.ability);
  assert.deepEqual(ditto.moves, pidgey.moves);
  assert.notEqual(ditto.moves, pidgey.moves, 'bộ chiêu là bản sao');
  for (const m of ditto.moves) assert.equal(ditto.pp[m], Math.min(TRANSFORM_PP, MOVES[m].pp));
  for (const m of ditto.moves) assert.equal(movePpMax(ditto, m), Math.min(5, MOVES[m].pp));
  assert.deepEqual(ditto.stages, { atk: 2, speed: -1 });
  ditto.stages.atk = 6;
  assert.equal(pidgey.stages.atk, 2, 'bậc chỉ số là bản sao');
  assert.equal(baseSpeciesId(ditto), 'ditto');
  // Sát thương tính theo hệ mới (cùng hệ Thường / Bay), loài gốc dùng cho tỉ lệ bắt
  assert.equal(catchChance(ditto), catchChance(mon('ditto', 30)));
});

test('Transform thất bại khi một bên đang biến hình hoặc đối thủ đã gục', () => {
  const a = mon('ditto', 30);
  const b = mon('ditto', 30);
  const target = mon('pidgey', 20);
  assert.equal(transform(a, target), true);
  assert.equal(transformBlocked(b, a), 'transformed');
  assert.equal(transform(b, a), false, 'không biến hình được thành Pokémon đang biến hình');
  assert.equal(transform(a, mon('rattata', 10)), false, 'đang biến hình thì không biến hình lần nữa');
  assert.equal(transform(b, mon('rattata', 10, { hp: 0 })), false);
  assert.equal(b.speciesId, 'ditto');
});

test('Transform: hết trận / rời sân trả lại nguyên trạng, lưu game giữa trận chỉ ghi dạng gốc (dữ liệu đội không đổi)', () => {
  const ditto = createMonster('ditto', 35, { shiny: true });
  ditto.stages = {};
  const saved = JSON.stringify(ditto);
  const foe = createMonster('charizard', 50, { shiny: false });
  transform(ditto, foe);
  assert.equal(lookShiny(ditto), false, 'hình biến thành giống đối thủ (không shiny)');
  assert.equal(ditto.shiny, true, 'dữ liệu shiny của Ditto giữ nguyên');
  ditto.pp[ditto.moves[0]] -= 3;
  ditto.stages.atk = 3;
  // Lưu giữa trận (saveGame dùng JSON.stringify): luôn là dạng gốc
  assert.equal(JSON.stringify(ditto), saved);
  assert.ok(!('transformed' in JSON.parse(JSON.stringify(ditto))));
  // Rời sân (clearVolatile) / hết trận (clearBattleState): về dạng gốc
  clearVolatile(ditto);
  assert.equal(ditto.speciesId, 'ditto');
  assert.deepEqual(ditto.moves, ['transform']);
  assert.equal(ditto.pp.transform, MOVES.transform.pp);
  assert.equal(lookShiny(ditto), true);
  transform(ditto, foe);
  clearBattleState(ditto);
  const after = JSON.parse(JSON.stringify(ditto));
  delete after.stages;
  const orig = JSON.parse(saved);
  delete orig.stages;
  assert.deepEqual(after, orig);
  assert.equal(revertBattleForm(ditto), false, 'không còn gì để trả lại');
  assert.equal(ditto.toJSON, undefined);
});

test('Transform: lên cấp giữa trận tính trên dạng gốc rồi khoác lại dạng biến hình', () => {
  const ditto = mon('ditto', 30);
  const foe = mon('arcanine', 50);
  transform(ditto, foe);
  const form = suspendBattleForm(ditto);
  assert.equal(ditto.speciesId, 'ditto');
  const events = gainExp(ditto, expToReach(ditto, 31) - ditto.exp);
  assert.equal(events[0].type, 'levelUp');
  assert.equal(ditto.level, 31);
  const baseAtk = ditto.atk;
  resumeBattleForm(ditto, form);
  assert.equal(ditto.speciesId, 'arcanine');
  assert.equal(ditto.atk, foe.atk);
  revertBattleForm(ditto);
  assert.equal(ditto.atk, baseAtk, 'chỉ số gốc đã tính lại theo cấp 31');
  assert.deepEqual(ditto.moves, ['transform']);
});

test('Imposter: vừa ra sân là biến hình thành đối thủ; Neutralizing Gas chặn', () => {
  const ditto = mon('ditto', 40, { ability: 'imposter' });
  const pika = mon('pikachu', 30);
  assert.equal(imposterTransform(ditto, pika), true);
  assert.equal(ditto.speciesId, 'pikachu');
  assert.equal(ditto.ability, 'static');
  assert.deepEqual(ditto.moves, pika.moves);
  const limber = mon('ditto', 40, { ability: 'limber' });
  assert.equal(imposterTransform(limber, pika), false);
  const gassed = mon('ditto', 40, { ability: 'imposter' });
  assert.equal(imposterTransform(gassed, pika, { gas: true }), false);
});

test('Trace: chép đặc tính đối thủ tới khi rời sân; không chép Trace / Imposter', () => {
  const porygon = mon('porygon', 30, { ability: 'trace' });
  assert.equal(traceable('intimidate'), true);
  assert.equal(traceable('trace'), false);
  assert.equal(traceable('imposter'), false);
  setBattleAbility(porygon, 'levitate');
  assert.equal(porygon.ability, 'levitate');
  assert.equal(JSON.parse(JSON.stringify(porygon)).ability, 'trace');
  clearVolatile(porygon);
  assert.equal(porygon.ability, 'trace');
});

// ---------- Đặc tính khi bị chạm ----------

test('Poison Point / Cute Charm: đòn tiếp xúc 30% gây độc / say mê (Cute Charm chỉ khác giới)', () => {
  const nido = mon('nidoking', 40, { ability: 'poisonPoint' });
  const attacker = mon('machop', 30);
  assert.deepEqual(contactAbility(attacker, nido, MOVES.tackle, {}, fixed(0.1)), { ability: 'poisonPoint', status: 'psn' });
  assert.equal(contactAbility(attacker, nido, MOVES.tackle, {}, fixed(0.5)), null, '70% không kích hoạt');
  assert.equal(contactAbility(attacker, nido, MOVES.thunderbolt, {}, fixed(0.1)), null, 'không tiếp xúc');
  assert.equal(statusBlocked(mon('ekans', 20), 'psn'), 'immune', 'hệ Độc không bị');

  const clefairy = mon('clefairy', 30, { ability: 'cuteCharm', gender: 'female' });
  const male = mon('machop', 30, { gender: 'male' });
  assert.deepEqual(contactAbility(male, clefairy, MOVES.scratch, {}, fixed(0.1)), { ability: 'cuteCharm', attract: true });
  assert.equal(attractBlocked(male, clefairy), null);
  assert.equal(attractBlocked(mon('machop', 30, { gender: 'female' }), clefairy), 'gender');
  assert.equal(attractBlocked(mon('magnemite', 30, { gender: null }), clefairy), 'gender');
  assert.equal(attractBlocked(mon('slowpoke', 30, { gender: 'male', ability: 'oblivious' }), clefairy), 'immune');
});

// ---------- Đặc tính đổi sát thương ----------

test('Adaptability: chiêu cùng hệ x2 thay vì x1.5', () => {
  const target = mon('rattata', 30);
  const plain = dmg(mon('eevee', 30, { ability: 'runAway' }), target, 'tackle');
  const adapt = dmg(mon('eevee', 30, { ability: 'adaptability' }), target, 'tackle');
  assert.ok(adapt > plain * 1.25 && adapt < plain * 1.4, `${plain} -> ${adapt}`);
});

test('Sniper: đòn chí mạng x2.25; Battle Armor / Shell Armor không bị chí mạng', () => {
  const target = mon('rattata', 30);
  const crit = (a, d) => calcDamage(a, d, MOVES.peck, seq(0, 0.5), {});
  const plain = crit(mon('spearow', 30, { ability: 'keenEye' }), target);
  const sniper = crit(mon('spearow', 30, { ability: 'sniper' }), target);
  assert.equal(plain.crit, true);
  assert.ok(sniper.damage / plain.damage > 1.4 && sniper.damage / plain.damage < 1.6, `${plain.damage} -> ${sniper.damage}`);
  for (const ability of ['battleArmor', 'shellArmor']) {
    assert.equal(crit(mon('spearow', 30), mon('cubone', 30, { ability })).crit, false, ability);
  }
  assert.equal(crit(mon('spearow', 30), mon('cubone', 30, { ability: 'rockHead' })).crit, true);
});

test('Tinted Lens / Filter: chiêu không hiệu quả x2, chiêu rất hiệu quả x0.75', () => {
  const geodude = mon('geodude', 30);
  const plain = dmg(mon('venonat', 30, { ability: 'compoundEyes' }), geodude, 'confusion'); // Siêu linh vào Đá: thường
  assert.ok(plain > 0);
  const bug = (ability) => dmg(mon('venomoth', 30, { ability }), mon('charmander', 30), 'signalBeam'); // Bọ vào Lửa: x0.5
  assert.ok(bug('tintedLens') / bug('shieldDust') > 1.85, 'Tinted Lens gấp đôi');
  const hit = (ability) => dmg(mon('pikachu', 30), mon('mr-mime', 30, { ability }), 'shadowBall'); // Ma vào Siêu linh: x2
  const ratio = hit('filter') / hit('soundproof');
  assert.ok(ratio > 0.7 && ratio < 0.8, `Filter ${ratio}`);
  // Mold Breaker bỏ qua Filter
  const breaker = mon('pinsir', 30, { ability: 'moldBreaker' });
  const mime = mon('mr-mime', 30, { ability: 'filter' });
  const broken = dmg(breaker, mime, 'shadowBall', { breaker });
  const blocked = dmg(breaker, mime, 'shadowBall');
  assert.ok(broken > blocked, 'Mold Breaker phá Filter');
});

test('Sheer Force: chiêu có hiệu ứng phụ x1.3 và mất hiệu ứng phụ; Shield Dust chặn hiệu ứng phụ; Serene Grace x2', () => {
  assert.equal(hasSecondary(MOVES.bodySlam), true);
  assert.equal(hasSecondary(MOVES.metalClaw), true);
  assert.equal(hasSecondary(MOVES.rapidSpin), false, 'tự tăng chỉ số chắc chắn không phải hiệu ứng phụ');
  assert.equal(hasSecondary(MOVES.tackle), false);
  const target = mon('rattata', 30);
  const plain = dmg(mon('tauros', 30, { ability: 'intimidate' }), target, 'bodySlam');
  const sheer = dmg(mon('tauros', 30, { ability: 'sheerForce' }), target, 'bodySlam');
  assert.ok(sheer / plain > 1.25 && sheer / plain < 1.35, `${plain} -> ${sheer}`);
  assert.equal(dmg(mon('tauros', 30, { ability: 'sheerForce' }), target, 'tackle'), dmg(mon('tauros', 30, { ability: 'intimidate' }), target, 'tackle'));
  assert.equal(secondaryFactor(mon('tauros', 30, { ability: 'sheerForce' }), target, MOVES.bodySlam), 0);
  assert.equal(secondaryFactor(mon('tauros', 30, { ability: 'sheerForce' }), target, MOVES.metalClaw, {}, true), 0);
  const dusty = mon('caterpie', 10, { ability: 'shieldDust' });
  assert.equal(secondaryFactor(mon('pikachu', 30), dusty, MOVES.thunderShock), 0);
  assert.equal(secondaryFactor(mon('pikachu', 30), dusty, MOVES.metalClaw, {}, true), 1, 'hiệu ứng lên bên đánh vẫn có');
  assert.equal(secondaryFactor(mon('chansey', 30, { ability: 'sereneGrace' }), target, MOVES.bodySlam), 2);
  assert.equal(secondaryFactor(mon('pikachu', 30), target, MOVES.thunderShock), 1);
});

test('Rivalry / Swarm / Sand Force / Scrappy', () => {
  const rival = (g1, g2) => dmg(mon('nidoking', 40, { ability: 'rivalry', gender: g1 }), mon('nidoqueen', 40, { gender: g2 }), 'hornAttack');
  const none = dmg(mon('nidoking', 40, { ability: 'poisonPoint', gender: 'male' }), mon('nidoqueen', 40, { gender: 'male' }), 'hornAttack');
  assert.ok(rival('male', 'male') > none && rival('male', 'female') < none);
  assert.equal(dmg(mon('nidoking', 40, { ability: 'rivalry', gender: 'male' }), mon('magnemite', 40, { gender: null }), 'hornAttack'),
    dmg(mon('nidoking', 40, { ability: 'poisonPoint', gender: 'male' }), mon('magnemite', 40, { gender: null }), 'hornAttack'));

  const scyther = (hp) => dmg(mon('scyther', 40, { ability: 'swarm', hp }), mon('rattata', 40), 'pinMissile');
  assert.ok(scyther(10) > scyther(100) * 1.4, 'Swarm khi HP thấp');

  const dug = (weather) => dmg(mon('dugtrio', 40, { ability: 'sandForce' }), mon('rattata', 40), 'earthquake', { weather });
  assert.ok(dug('sand') / dug(null) > 1.25);

  const gastly = mon('gastly', 30);
  assert.equal(dmg(mon('kangaskhan', 30, { ability: 'earlyBird' }), gastly, 'tackle'), 0);
  assert.ok(dmg(mon('kangaskhan', 30, { ability: 'scrappy' }), gastly, 'tackle') > 0);
  assert.equal(moveEffect(MOVES.tackle, gastly, {}, mon('kangaskhan', 30, { ability: 'scrappy' })).effectiveness, 1);
  assert.equal(moveEffect(MOVES.lowKick, gastly, {}, mon('kangaskhan', 30, { ability: 'scrappy' })).effectiveness, 0.5, 'Ma / Độc: còn hệ Độc');
});

test('Unaware: phớt lờ bậc chỉ số của đối thủ', () => {
  const target = mon('clefable', 40, { ability: 'unaware' });
  const boosted = mon('machamp', 40, { stages: { atk: 6 } });
  const plain = mon('machamp', 40);
  assert.equal(dmg(boosted, target, 'karateChop'), dmg(plain, target, 'karateChop'));
  const wall = mon('cloyster', 40, { stages: { def: 6 } });
  assert.equal(dmg(mon('clefable', 40, { ability: 'unaware' }), wall, 'pound'), dmg(mon('clefable', 40, { ability: 'unaware' }), mon('cloyster', 40), 'pound'));
  // Unaware cũng bị Mold Breaker phá
  const breaker = mon('pinsir', 40, { ability: 'moldBreaker', stages: { atk: 2 } });
  assert.ok(dmg(breaker, target, 'megahorn', { breaker }) > dmg(breaker, target, 'megahorn'));
});

test('Mold Breaker: bỏ qua Levitate, Water Absorb...; không bỏ qua đặc tính của chính mình', () => {
  const breaker = mon('pinsir', 40, { ability: 'moldBreaker' });
  const gengar = mon('gengar', 40, { ability: 'levitate' });
  assert.equal(moveEffect(MOVES.earthquake, gengar, {}).absorbedBy, 'levitate');
  assert.equal(moveEffect(MOVES.earthquake, gengar, { breaker }).absorbedBy, null);
  assert.equal(abilityOf(breaker, { breaker }), 'moldBreaker');
  assert.equal(abilityOf(mon('pikachu', 30, { ability: 'static' }), { breaker }), 'static', 'đặc tính khi bị chạm vẫn còn');
  for (const id of BREAKABLE) assert.ok(ABILITIES[id], id);
});

// ---------- Bảo vệ chỉ số ----------

test('Hyper Cutter chặn giảm Atk; Defiant / Competitive tăng 2 bậc khi bị đối thủ giảm chỉ số', () => {
  assert.equal(stageGuarded('atk', -1, 'hyperCutter'), 'hyperCutter');
  assert.equal(stageGuarded('def', -1, 'hyperCutter'), null);
  assert.equal(stageGuarded('atk', -1, 'hyperCutter', false), null, 'tự giảm thì không chặn');
  assert.equal(stageMoveUseless(MOVES.growl, mon('krabby', 20), 'hyperCutter'), true);
  assert.deepEqual(stageDropReaction('defiant', -1), { stat: 'atk', delta: 2 });
  assert.deepEqual(stageDropReaction('competitive', -2), { stat: 'spAtk', delta: 2 });
  assert.equal(stageDropReaction('defiant', 0), null, 'chỉ số không giảm được thì không kích hoạt');
  assert.equal(stageDropReaction('defiant', -1, false), null, 'tự giảm chỉ số thì không kích hoạt');
  assert.equal(stageDropReaction('intimidate', -1), null);
});

// ---------- Tốc độ, thời tiết, trạng thái ----------

test('Sand Rush / Sand Force / Snow Cloak: thời tiết tăng tốc / né tránh và không mất máu', () => {
  const sandslash = mon('sandslash', 40, { ability: 'sandRush' });
  assert.equal(effectiveSpeed(sandslash, { weather: 'sand' }), effectiveSpeed(sandslash) * 2);
  assert.equal(effectiveSpeed(sandslash, { weather: 'sand', cloudNine: true }), effectiveSpeed(sandslash));
  const pidgey = (ability) => mon('pidgey', 30, { ability });
  assert.ok(weatherHpChange(pidgey('keenEye'), { weather: 'sand' }) < 0);
  assert.equal(weatherHpChange(pidgey('sandRush'), { weather: 'sand' }), 0);
  assert.equal(weatherHpChange(pidgey('sandForce'), { weather: 'sand' }), 0);
  assert.ok(weatherHpChange(pidgey('keenEye'), { weather: 'hail' }) < 0);
  assert.equal(weatherHpChange(pidgey('snowCloak'), { weather: 'hail' }), 0);
  // Snow Cloak: khi mưa đá chiêu nhắm vào nó chỉ còn 80% độ chính xác
  const articuno = mon('articuno', 50, { ability: 'snowCloak' });
  const hits = (ctx) => moveHits(MOVES.tackle, mon('rattata', 50), articuno, fixed(0.85), ctx);
  assert.equal(hits({}), true);
  assert.equal(hits({ weather: 'hail' }), false);
});

test('Quick Feet / Unburden / Early Bird / Leaf Guard', () => {
  const jolteon = mon('jolteon', 40, { ability: 'quickFeet' });
  const base = effectiveSpeed(jolteon);
  assert.equal(effectiveSpeed({ ...jolteon, status: 'par' }), Math.floor(jolteon.speed * 1.5), 'tê liệt không làm chậm');
  assert.equal(effectiveSpeed({ ...jolteon, ability: 'voltAbsorb', status: 'par' }), Math.floor(base / 2));

  const lee = mon('hitmonlee', 40, { ability: 'unburden', heldItem: 'sitrusBerry' });
  const leeBase = effectiveSpeed(lee);
  assert.equal(effectiveSpeed({ ...lee, unburdened: true }), leeBase, 'còn cầm đồ');
  assert.equal(effectiveSpeed({ ...lee, heldItem: null, unburdened: true }), leeBase * 2);
  const gone = { ...lee, heldItem: null, unburdened: true };
  clearVolatile(gone);
  assert.equal(effectiveSpeed(gone), leeBase, 'rời sân là hết');

  const doduo = mon('doduo', 20, { ability: 'earlyBird', status: 'slp', sleepTurns: 3 });
  let asleep = 0;
  while (!checkCanMove(doduo, fixed(0.9)).canMove) asleep++;
  assert.equal(asleep, 2, 'ngủ 3 lượt còn 2');
  const rest = mon('doduo', 20, { ability: 'earlyBird', status: 'slp', sleepTurns: 2 });
  assert.equal(checkCanMove(rest, fixed(0.9)).canMove, false);
  assert.equal(checkCanMove(rest, fixed(0.9)).canMove, true, 'Rest chỉ ngủ 1 lượt');

  const tangela = mon('tangela', 30, { ability: 'leafGuard' });
  assert.equal(statusBlocked(tangela, 'psn', null, 'sun'), 'immune');
  assert.equal(statusBlocked(tangela, 'slp', null, 'sun'), 'immune');
  assert.equal(statusBlocked(tangela, 'psn', null, null), null);
});

test('Compound Eyes / Wonder Skin: độ chính xác', () => {
  const sing = { ...MOVES.hypnosis }; // 60%
  const target = mon('rattata', 30);
  assert.equal(moveHits(sing, mon('butterfree', 30, { ability: 'shieldDust' }), target, fixed(0.7)), false);
  assert.equal(moveHits(sing, mon('butterfree', 30, { ability: 'compoundEyes' }), target, fixed(0.7)), true, '60 x 1.3 = 78%');
  const venomoth = mon('venomoth', 30, { ability: 'wonderSkin' });
  assert.equal(moveHits(MOVES.thunderWave, mon('pikachu', 30), venomoth, fixed(0.55)), false, 'chiêu trạng thái còn 50%');
  assert.equal(moveHits(MOVES.thunderWave, mon('pikachu', 30), venomoth, fixed(0.45)), true);
  assert.equal(moveHits(MOVES.thunderbolt, mon('pikachu', 30), venomoth, fixed(0.9)), true, 'chiêu gây sát thương không bị ảnh hưởng');
});

// ---------- Chạy trốn ----------

test('Arena Trap: Pokémon đứng trên mặt đất không chạy / rút về được; hệ Bay, Levitate, hệ Ma thì thoát', () => {
  const diglett = mon('diglett', 20, { ability: 'arenaTrap' });
  assert.equal(trappedBy(mon('rattata', 20), diglett), 'arenaTrap');
  assert.equal(trappedBy(mon('pidgey', 20), diglett), null, 'hệ Bay');
  assert.equal(trappedBy(mon('koffing', 20, { ability: 'levitate' }), diglett), null, 'Levitate');
  assert.equal(trappedBy(mon('gastly', 20), diglett), null, 'hệ Ma');
  assert.equal(trappedBy(mon('rattata', 20), { ...diglett, hp: 0 }), null, 'Diglett đã gục');
  assert.equal(trappedBy(mon('rattata', 20), diglett, { gas: true }), null, 'Neutralizing Gas');
});

// ---------- Vào sân ----------

test('Anticipation / Download / Frisk (dữ liệu dùng khi vào sân)', () => {
  const eevee = mon('eevee', 30, { ability: 'anticipation' });
  assert.equal(anticipates(eevee, mon('machop', 30, { moves: ['karateChop'] })), true, 'chiêu Giác đấu khắc hệ Thường');
  assert.equal(anticipates(eevee, mon('rattata', 30, { moves: ['tackle'] })), false);
  assert.equal(anticipates(eevee, mon('voltorb', 30, { moves: ['selfDestruct'] })), true, 'chiêu tự nổ');
  assert.equal(downloadStat({ def: 50, spDef: 80 }), 'atk');
  assert.equal(downloadStat({ def: 80, spDef: 50 }), 'spAtk');
  assert.equal(downloadStat({ def: 60, spDef: 60 }), 'spAtk');
  assert.equal(downloadStat({ def: 60, spDef: 60, stages: { def: -1 } }), 'atk', 'tính cả bậc chỉ số');
});

// ---------- Sau trận / cuối lượt ----------

test('Pickup: 10% nhặt đồ sau trận khi không cầm gì, đồ theo cấp', () => {
  const meowth = mon('meowth', 5, { ability: 'pickup' });
  assert.equal(pickupItem(meowth, fixed(0.5)), null, '90% không nhặt được');
  assert.equal(pickupItem(meowth, seq(0.05, 0)), 'potion', 'cấp 1-10: hay nhặt Potion');
  assert.equal(pickupItem({ ...meowth, heldItem: 'oranBerry' }, fixed(0)), null, 'đang cầm đồ');
  assert.equal(pickupItem({ ...meowth, ability: 'technician' }, fixed(0)), null);
  assert.equal(pickupItem({ ...meowth, hp: 0 }, fixed(0)), null);
  const high = mon('persian', 100, { ability: 'pickup' });
  assert.equal(pickupItem(high, seq(0.05, 0)), PICKUP_COMMON[9], 'cấp 91-100: bậc cao nhất');
  for (let i = 0; i < 200; i++) {
    const id = pickupItem(mon('meowth', 1 + (i % 100), { ability: 'pickup' }), seq(0, Math.random()));
    assert.ok(ITEMS[id], `vật phẩm ${id}`);
  }
});

test('Harvest: mọc lại quả mọng đã ăn trong trận (50%, nắng gắt thì chắc chắn)', () => {
  const exeggutor = mon('exeggutor', 40, { ability: 'harvest', heldItem: null });
  assert.equal(harvestBerry(exeggutor, null, 'harvest', fixed(0)), null, 'chưa ăn quả nào');
  rememberBerry(exeggutor, 'sitrusBerry');
  assert.equal(JSON.parse(JSON.stringify(exeggutor)).lastBerry, undefined, 'không lưu');
  assert.equal(harvestBerry(exeggutor, null, 'harvest', fixed(0.3)), 'sitrusBerry');
  assert.equal(harvestBerry(exeggutor, null, 'harvest', fixed(0.7)), null);
  assert.equal(harvestBerry(exeggutor, 'sun', 'harvest', fixed(0.99)), 'sitrusBerry', 'nắng gắt');
  assert.equal(harvestBerry(exeggutor, 'sun', null, fixed(0)), null, 'Neutralizing Gas');
  assert.equal(harvestBerry({ ...exeggutor, heldItem: 'leftovers', lastBerry: 'sitrusBerry' }, 'sun', 'harvest'), null, 'đang cầm đồ');
  clearBattleState(exeggutor);
  assert.equal(exeggutor.lastBerry, undefined, 'hết trận thì quên');
});

test('Friend Guard / Healer: đặc tính thật, ghi rõ chỉ có tác dụng trong trận đấu đôi', () => {
  for (const id of ['friendGuard', 'healer']) assert.match(ABILITIES[id].desc, /trận đấu đôi/);
});
