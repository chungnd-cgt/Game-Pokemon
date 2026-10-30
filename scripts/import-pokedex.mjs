// Tải dữ liệu 151 Pokémon thế hệ 1 từ pokemondb.net vào src/data/pokedex.json
//
//   node scripts/import-pokedex.mjs
//
// - Danh sách + chỉ số gốc: https://pokemondb.net/pokedex/stats/gen1
// - Pokédex data, Training, Breeding, Type defenses, Pokédex entries: trang riêng của từng con
// Trang tải về được lưu ở .cache/pokemondb/ nên chạy lại không phải tải lại.
// Muốn tải mới hoàn toàn thì xoá thư mục đó.

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'pokemondb');
const OUT = path.join(ROOT, 'src', 'data', 'pokedex.json');
const BASE = 'https://pokemondb.net';
const DELAY_MS = 400; // nghỉ giữa các lần tải để không làm phiền server
const USER_AGENT = 'Mozilla/5.0 (personal Pokedex demo; polite crawler)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(urlPath, cacheName) {
  const file = path.join(CACHE, `${cacheName}.html`);
  try {
    return await fs.readFile(file, 'utf8');
  } catch {
    // chưa có trong cache
  }
  const res = await fetch(BASE + urlPath, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${urlPath}: HTTP ${res.status}`);
  const html = await res.text();
  await fs.writeFile(file, html);
  await sleep(DELAY_MS);
  return html;
}

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', eacute: 'é', frac12: '½', frac14: '¼', mdash: '—', ndash: '–' };

// Bỏ thẻ HTML, giải mã ký tự đặc biệt, gộp khoảng trắng
function text(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function parseList(html) {
  return html.split('<td class="cell-num cell-fixed"').slice(1).map((row) => {
    const id = Number(row.match(/data-sort-value="(\d+)"/)[1]);
    const [, slug, name] = row.match(/<a class="ent-name" href="\/pokedex\/([^"]+)"[^>]*>([^<]+)<\/a>/);
    const types = [...row.matchAll(/type-icon type-(\w+)/g)].map((m) => m[1]);
    const [total, hp, atk, def, spAtk, spDef, speed] = [...row.matchAll(/<td class="cell-num(?: cell-total)?">(\d+)<\/td>/g)].map((m) => Number(m[1]));
    return { id, slug, name: text(name), types, stats: { hp, atk, def, spAtk, spDef, speed, total } };
  });
}

// Ô dữ liệu đầu tiên có tiêu đề khớp (trang có nhiều dạng thì dạng gốc đứng đầu)
function vital(html, label) {
  const m = html.match(new RegExp(`<th>${label}</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`));
  if (!m) throw new Error(`Không tìm thấy mục "${label}"`);
  return m[1];
}

function parseDetail(html) {
  const abilities = [...vital(html, 'Abilities').matchAll(/<a href="\/ability\/[^"]+" title="([^"]*)">([^<]+)<\/a>(\s*\(hidden ability\))?/g)]
    .map(([, desc, name, hidden]) => ({ name: text(name), desc: text(desc), hidden: Boolean(hidden) }));

  const typeDefenses = {};
  for (const [, type, fx] of [...html.matchAll(/<td title="(\w+) &#8594; [^"]*" class="type-fx-cell type-fx-(\d+)"/g)].slice(0, 18)) {
    typeDefenses[type.toLowerCase()] = Number(fx) / 100;
  }

  const flavor = html.slice(html.indexOf('id="dex-flavor"'));
  const entry = flavor.match(/<th>([\s\S]*?)<\/th>\s*<td class="cell-med-text">([\s\S]*?)<\/td>/);

  return {
    species: text(vital(html, 'Species')),
    height: text(vital(html, 'Height')),
    weight: text(vital(html, 'Weight')),
    abilities,
    evYield: text(vital(html, 'EV yield')),
    catchRate: parseInt(text(vital(html, 'Catch rate')), 10),
    baseFriendship: parseInt(text(vital(html, 'Base <a[^>]*>Friendship</a>')), 10),
    baseExp: parseInt(text(vital(html, 'Base Exp.')), 10),
    growthRate: text(vital(html, 'Growth Rate')),
    eggGroups: text(vital(html, 'Egg Groups')),
    gender: text(vital(html, 'Gender')),
    typeDefenses,
    entry: entry ? { game: text(entry[1].replace(/<br>/g, '/')), text: text(entry[2]) } : null,
  };
}

function check(p) {
  const problems = [];
  if (p.types.length < 1 || p.types.length > 2) problems.push('types');
  if (Object.values(p.stats).some((v) => !Number.isFinite(v))) problems.push('stats');
  if (Object.keys(p.typeDefenses).length !== 18) problems.push('typeDefenses');
  if (!p.abilities.length) problems.push('abilities');
  if (!Number.isFinite(p.catchRate) || !Number.isFinite(p.baseExp)) problems.push('training');
  if (!p.entry?.text) problems.push('entry');
  if (problems.length) throw new Error(`#${p.id} ${p.name}: thiếu/sai ${problems.join(', ')}`);
}

await fs.mkdir(CACHE, { recursive: true });
const list = parseList(await fetchPage('/pokedex/stats/gen1', 'stats-gen1'));
if (list.length !== 151) throw new Error(`Bảng chỉ số có ${list.length} dòng, cần 151`);

const pokedex = [];
for (const base of list) {
  process.stdout.write(`\r#${String(base.id).padStart(3, '0')} ${base.name.padEnd(12)}`);
  const entry = { ...base, ...parseDetail(await fetchPage(`/pokedex/${base.slug}`, base.slug)) };
  check(entry);
  pokedex.push(entry);
}

await fs.writeFile(OUT, `${JSON.stringify(pokedex, null, 1)}\n`);
console.log(`\nĐã ghi ${pokedex.length} Pokémon vào ${path.relative(ROOT, OUT)}`);
