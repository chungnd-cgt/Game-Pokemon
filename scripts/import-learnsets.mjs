// Tạo src/data/learnsets.json: chiêu học khi lên cấp và khi tiến hoá của 151 Pokémon, lấy từ pokemondb.net
//
//   node scripts/import-learnsets.mjs
//
// Quy tắc (một quy tắc cho mọi loài), game là bản làm lại vùng Kanto kiểu GBA nên:
//  - Chiêu học khi lên cấp: FireRed/LeafGreen (Gen 3), trang /pokedex/<slug>/moves/3, tab FireRed/LeafGreen
//    (không lấy Ruby/Sapphire/Emerald: vài loài khác nhau)
//  - Chiêu học khi tiến hoá: Gen 3 chưa có cơ chế này nên lấy từ game chính đánh theo lượt mới nhất có loài đó:
//    Scarlet/Violet, không có thì Brilliant Diamond/Shining Pearl (trang /pokedex/<slug>/moves/8).
//    Bỏ qua Legends: Z-A / Legends: Arceus (hệ thống chiêu khác hẳn).
// Chỉ lấy dạng gốc (vùng Kanto), bỏ dạng Alola / Galar / Hisui.
//
// Trang tải về lưu ở .cache/pokemondb/ (<slug>.html do scripts/import-pokedex.mjs tải, <slug>-moves-3.html,
// <slug>-moves-8.html do script này tải) nên chạy lại không phải tải lại.
//
// Kết quả: { slug: { levelUp: [[cấp, id chiêu], ...], evolution: [id chiêu học khi tiến hoá], evolutionGame } }
// id chiêu = tên trên pokemondb viết kiểu camelCase ('air-slash' -> 'airSlash'), khớp id trong src/data/moves.js.
// Chiêu chưa có trong moves.js vẫn được ghi ở đây; src/data/monsters.js tự bỏ qua cho tới khi thêm chiêu đó.

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'pokemondb');
const OUT = path.join(ROOT, 'src', 'data', 'learnsets.json');
const POKEDEX = path.join(ROOT, 'src', 'data', 'pokedex.json');
const BASE = 'https://pokemondb.net';
const DELAY_MS = 400;
const USER_AGENT = 'Mozilla/5.0 (personal Pokedex demo; polite crawler)';

// Bộ chiêu lên cấp: [tên tab trên pokemondb, trang chứa tab đó]
const LEVEL_UP_GAME = { tab: 'FireRed/LeafGreen', page: (slug) => [`/pokedex/${slug}/moves/3`, `${slug}-moves-3`] };
// Chiêu tiến hoá, theo thứ tự ưu tiên: [tên tab, mã game ghi vào json, trang chứa tab đó]
const EVOLUTION_GAMES = [
  { tab: 'Scarlet/Violet', id: 'scarlet-violet', page: (slug) => [`/pokedex/${slug}`, slug] },
  { tab: 'Brilliant Diamond/Shining Pearl', id: 'bdsp', page: (slug) => [`/pokedex/${slug}/moves/8`, `${slug}-moves-8`] },
];

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

const moveId = (slug) => slug.replace(/-(\w)/g, (_, c) => c.toUpperCase());

// Phần trang của một tab game (từ id="tab-moves-N" tới tab game kế tiếp), hoặc null nếu trang không có game đó
function gameSection(html, tabName) {
  const link = html.match(new RegExp(`href="#(tab-moves-\\d+)">${tabName.replace('/', '\\/')}<`));
  if (!link) return null;
  const start = html.indexOf(`id="${link[1]}"`);
  const rest = html.slice(start + 1);
  const next = rest.search(/id="tab-moves-\d+"/);
  return next < 0 ? rest : rest.slice(0, next);
}

// Bảng ngay sau tiêu đề, [] nếu không có mục đó. Mục có nhiều dạng (Alola, Galar...) chia thành tab con,
// id tab con kết thúc bằng số Pokédex của dạng đó: lấy đúng tab của dạng gốc (không có tab của dạng gốc = không có chiêu)
function formTable(section, heading, dexId) {
  const at = section.indexOf(`<h3>${heading}</h3>`);
  if (at < 0) return [];
  let part = section.slice(at + heading.length);
  const nextHeading = part.indexOf('<h3>');
  if (nextHeading >= 0) part = part.slice(0, nextHeading);
  if (/id="tab-moves-\d+-\w+-\d+"/.test(part)) {
    const tab = part.search(new RegExp(`id="tab-moves-\\d+-\\w+-${dexId}"`));
    if (tab < 0) return [];
    part = part.slice(tab);
  }
  const body = part.match(/<tbody>([\s\S]*?)<\/tbody>/);
  return body ? body[1].split('<tr>').slice(1) : [];
}

function parseSection(section, dexId) {
  const levelUp = formTable(section, 'Moves learnt by level up', dexId).map((row) => {
    const lv = row.match(/<td class="cell-num">(\d+)<\/td>/);
    const move = row.match(/href="\/move\/([^"]+)"/);
    if (!lv || !move) throw new Error(`Không đọc được dòng: ${row.slice(0, 120)}`);
    return [Number(lv[1]), moveId(move[1])];
  });
  const evolution = formTable(section, 'Moves learnt on evolution', dexId).map((row) => moveId(row.match(/href="\/move\/([^"]+)"/)[1]));
  return { levelUp, evolution };
}

async function learnsetOf(slug, dexId) {
  const frlg = gameSection(await fetchPage(...LEVEL_UP_GAME.page(slug)), LEVEL_UP_GAME.tab);
  if (!frlg) throw new Error(`${slug}: không có ở ${LEVEL_UP_GAME.tab}`);
  const { levelUp } = parseSection(frlg, dexId);
  if (!levelUp.length) throw new Error(`${slug}: bảng chiêu lên cấp ở ${LEVEL_UP_GAME.tab} trống`);
  for (const game of EVOLUTION_GAMES) {
    const section = gameSection(await fetchPage(...game.page(slug)), game.tab);
    if (!section) continue;
    return { levelUp, evolution: parseSection(section, dexId).evolution, evolutionGame: game.id };
  }
  throw new Error(`${slug}: không có ở ${EVOLUTION_GAMES.map((g) => g.tab).join(' / ')}`);
}

await fs.mkdir(CACHE, { recursive: true });
const pokedex = JSON.parse(await fs.readFile(POKEDEX, 'utf8'));
const out = {};
for (const { id, slug, name } of pokedex) {
  process.stdout.write(`\r#${String(id).padStart(3, '0')} ${name.padEnd(12)}`);
  out[slug] = await learnsetOf(slug, id);
}

// Mỗi loài một dòng cho dễ xem diff
const lines = Object.entries(out).map(([slug, data]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(data)}`);
await fs.writeFile(OUT, `{\n${lines.join(',\n')}\n}\n`);
const byGame = {};
for (const { evolutionGame } of Object.values(out)) byGame[evolutionGame] = (byGame[evolutionGame] ?? 0) + 1;
const evoSources = Object.entries(byGame).map(([g, n]) => `${g}: ${n}`).join(', ');
console.log(`\nĐã ghi ${lines.length} loài vào ${path.relative(ROOT, OUT)} (lên cấp: FireRed/LeafGreen; tiến hoá: ${evoSources})`);
