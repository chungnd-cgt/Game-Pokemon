// Dữ liệu cho màn Pokédex (ui/dex/DexWindow.js), không phụ thuộc Phaser nên kiểm thử được bằng node:test:
// lọc danh sách (ẩn loài chưa gặp, tìm theo tên / số), bộ chiêu học khi lên cấp, nơi xuất hiện, toạ độ biểu đồ lục giác.
import { ENCOUNTERS } from '../../data/encounters.js';
import LEARNSETS from '../../data/learnsets.json' with { type: 'json' };
import { MAPS } from '../../data/map.js';
import { SPECIES } from '../../data/monsters.js';
import { MOVES } from '../../data/moves.js';
import { dexNo } from '../../data/pokedex.js';

// Thứ tự các trục của biểu đồ lục giác, theo chiều kim đồng hồ từ đỉnh trên
export const RADAR_STATS = ['hp', 'atk', 'def', 'speed', 'spDef', 'spAtk'];
export const RADAR_MAX = 180; // chỉ số gốc >= 180 chạm mép biểu đồ

// Điểm trên trục i (0 = đỉnh trên) ở tỉ lệ ratio (0..1) của bán kính r
export function radarPoint(cx, cy, r, i, ratio = 1) {
  const angle = -Math.PI / 2 + (i * Math.PI * 2) / RADAR_STATS.length;
  return { x: cx + Math.cos(angle) * r * ratio, y: cy + Math.sin(angle) * r * ratio };
}

export const radarRatio = (value) => Math.max(0.04, Math.min(1, value / RADAR_MAX));

// Lọc danh sách Pokédex. statusOf(id): 'caught' | 'seen' | 'unknown'.
// query: số (khớp đầu số thứ tự, "25" hay "025") hoặc một phần tên (chỉ tìm trong loài đã gặp để không lộ tên)
export function filterDex(dex, { hideUnseen = false, query = '' } = {}, statusOf) {
  const q = query.trim().toLowerCase();
  const digits = /^\d+$/.test(q);
  return dex.filter((p) => {
    const known = statusOf(p.id) !== 'unknown';
    if (hideUnseen && !known) return false;
    if (!q) return true;
    if (digits) return String(p.id).startsWith(q) || dexNo(p.id).startsWith(q);
    return known && p.name.toLowerCase().includes(q);
  });
}

// Chiêu học khi lên cấp: [{ level, move }] ('TH' = học khi tiến hoá). Chỉ những chiêu game đã có (data/moves.js)
export function dexMoves(slug) {
  const sp = SPECIES[slug];
  const levelUp = sp?.learnset ?? (LEARNSETS[slug]?.levelUp ?? []).filter(([, m]) => MOVES[m]).sort((a, b) => a[0] - b[0]);
  const evo = sp?.evolutionMoves ?? (LEARNSETS[slug]?.evolution ?? []).filter((m) => MOVES[m]);
  // Chiêu có ở nhiều cấp (vd Charizard: Ember ở Lv1 và Lv7) chỉ ghi một lần, ở cấp sớm nhất (TH trước)
  const seen = new Set();
  return [
    ...evo.map((m) => ({ level: 'TH', move: MOVES[m] })),
    ...levelUp.map(([level, m]) => ({ level, move: MOVES[m] })),
  ].filter(({ move }) => !seen.has(move.id) && seen.add(move.id));
}

export const METHOD_LABELS = {
  grass: 'Bụi cỏ',
  deep: 'Bụi cỏ rậm',
  cave: 'Trong hang',
  surf: 'Lướt nước',
  oldRod: 'Cần câu cũ',
  goodRod: 'Cần câu tốt',
  superRod: 'Cần câu siêu',
};
const WATER_METHODS = ['surf', 'oldRod', 'goodRod', 'superRod'];
const METHOD_ORDER = Object.keys(METHOD_LABELS);

const areaMethod = (map, area) => {
  if (map.cave) return 'cave';
  return /-deep$/.test(area.table) || /rậm/i.test(area.name) ? 'deep' : 'grass';
};

// Các nguồn bảng Pokémon hoang dã của mọi bản đồ: [{ map, method, table }], theo thứ tự bản đồ
let sources = null;
function encounterSources() {
  if (sources) return sources;
  sources = [];
  for (const map of Object.values(MAPS)) {
    if (map.indoor) continue;
    for (const area of map.areas) sources.push({ map, method: areaMethod(map, area), table: area.table });
    if (map.water) for (const m of WATER_METHODS) if (map.water[m]) sources.push({ map, method: m, table: map.water[m] });
  }
  return sources;
}

// Nơi xuất hiện của một loài: [{ mapId, mapName, method, label, min, max, times }]
// times: [] = cả ngày, ngược lại các buổi ('day' | 'dusk' | 'night') loài này xuất hiện
export function dexLocations(slug) {
  const found = new Map();
  for (const { map, method, table } of encounterSources()) {
    const entries = (ENCOUNTERS[table] ?? []).filter((e) => e.species === slug);
    if (!entries.length) continue;
    const key = `${map.id}|${method}`;
    const loc = found.get(key) ?? { mapId: map.id, mapName: map.name, method, label: METHOD_LABELS[method], min: Infinity, max: -Infinity, times: new Set(), allDay: false };
    for (const e of entries) {
      loc.min = Math.min(loc.min, e.min);
      loc.max = Math.max(loc.max, e.max);
      if (e.time) loc.times.add(e.time);
      else loc.allDay = true;
    }
    found.set(key, loc);
  }
  const order = [...new Set(encounterSources().map((s) => s.map.id))];
  return [...found.values()]
    .map(({ allDay, times, ...loc }) => ({ ...loc, times: allDay ? [] : [...times] }))
    .sort((a, b) => order.indexOf(a.mapId) - order.indexOf(b.mapId) || METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
}

// Nơi xuất hiện gom một dòng mỗi bản đồ: [{ mapId, mapName, land, water, times, min, max }]
// land: bụi cỏ / cỏ rậm / trong hang • water: lướt nước / câu cá • times: các buổi xuất hiện (đủ 3 buổi nếu có cả ngày)
export function dexPlaces(slug) {
  const places = new Map();
  for (const loc of dexLocations(slug)) {
    const p = places.get(loc.mapId) ?? { mapId: loc.mapId, mapName: loc.mapName, land: false, water: false, times: new Set(), min: Infinity, max: -Infinity };
    if (WATER_METHODS.includes(loc.method)) p.water = true;
    else p.land = true;
    for (const t of loc.times.length ? loc.times : ['day', 'dusk', 'night']) p.times.add(t);
    p.min = Math.min(p.min, loc.min);
    p.max = Math.max(p.max, loc.max);
    places.set(loc.mapId, p);
  }
  return [...places.values()];
}

export const levelText = ({ min, max }) => (min === max ? `Lv ${min}` : `Lv ${min}-${max}`);

// "1.7 m (5′07″)" -> "1.7 m"
export const metric = (s) => (s ?? '').split(' (')[0];
