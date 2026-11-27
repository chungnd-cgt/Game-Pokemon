import { ENCOUNTERS } from '../data/encounters.js';
import { PHASE_ICONS, PHASE_NAMES } from '../game/clock.js';

// Phần logic thuần của bảng Pokémon hoang dã (ui/AreaNav.js), không dùng Phaser (chạy được trong test)

// Gộp các bảng gặp: loài -> { time: buổi xuất hiện (null nếu có ở bảng nào đó cả ngày), min, max: cấp gặp }.
// Giữ thứ tự xuất hiện đầu tiên trong các bảng
export function areaSpecies(tables) {
  const found = new Map();
  for (const id of tables) {
    for (const e of ENCOUNTERS[id] ?? []) {
      const time = e.time ?? null;
      const cur = found.get(e.species);
      if (!cur) found.set(e.species, { time, min: e.min, max: e.max });
      else {
        if (cur.time !== time) cur.time = null;
        cur.min = Math.min(cur.min, e.min);
        cur.max = Math.max(cur.max, e.max);
      }
    }
  }
  return found;
}

// Nhãn khi rê chuột vào hình Pokémon: "Pidgey  Lv3-5", loài chỉ ra vào một buổi thì thêm "•  ☾ Ban đêm".
// name: tên loài (chưa gặp thì "???")
export function areaLabel(name, { time, min, max }) {
  const lv = min === max ? `Lv${min}` : `Lv${min}-${max}`;
  return `${name}  ${lv}${time ? `  •  ${PHASE_ICONS[time]} ${PHASE_NAMES[time]}` : ''}`;
}

// Cần câu tốt trước (bảng câu cá gộp theo thứ tự Super Rod → Good Rod → Old Rod như trước đây: Old Rod đứng đầu)
const RODS = ['oldRod', 'goodRod', 'superRod'];

// Thông tin bảng Pokémon hoang dã của một bản đồ: { title, sections: [{ kind, tables }] } hoặc null (trong nhà / không có
// Pokémon hoang dã). kind: 'grass' bãi cỏ, 'cave' trong hang, 'surf' lướt nước, 'fish' cần câu
export function mapAreaInfo(map) {
  if (!map || map.indoor || (!map.areas?.length && !map.water)) return null;
  const land = [...new Set((map.areas ?? []).map((a) => a.table))];
  const water = map.water;
  const rods = water ? RODS.map((r) => water[r]).filter(Boolean) : [];
  const sections = [];
  if (land.length) sections.push({ kind: map.cave ? 'cave' : 'grass', tables: land });
  if (water?.surf) sections.push({ kind: 'surf', tables: [water.surf] });
  if (rods.length) sections.push({ kind: 'fish', tables: [...new Set(rods)] });
  return { title: map.name, sections };
}
