import { PLAYER_BASE_LOOKS } from './characterLooks.js';

// Tuỳ chỉnh diện mạo người chơi khi chơi mới (ui/CharacterCreator.js): giới tính, kiểu tóc, màu tóc, màu da, trang phục, màu mắt.
// Bản lưu chỉ giữ mã (id) của từng lựa chọn: state.player.look = { hairStyle, hair, skin, outfit, eyes };
// resolveLook đổi các mã đó thành bảng màu nhân vật (như LOOKS trong data/characterLooks.js) để gfx/player.js vẽ.

// Kiểu tóc: mỗi giới tính một danh sách riêng (nam và nữ trông khác hẳn nhau), kiểu mặc định đứng đầu.
// Kiểu có đội mũ (mũ lưỡi trai, mũ len, nón rộng vành) không còn chọn ở đây: sau này mũ là vật phẩm mua ở cửa hàng, đội ở
// ô trang bị trong Thẻ Huấn luyện viên (hình mũ vẫn giữ trong gfx/playerArt.js, NPC đang dùng)
export const HAIR_STYLES = {
  short: { label: 'Tóc ngắn' },
  spiky: { label: 'Tóc xù' },
  buzz: { label: 'Đầu đinh' },
  ponytail: { label: 'Đuôi ngựa' },
  long: { label: 'Tóc dài' },
  bun: { label: 'Búi tóc' },
  twintails: { label: 'Tóc hai bên' },
};
const HAIR_ORDER = {
  male: ['short', 'spiky', 'buzz'],
  female: ['ponytail', 'long', 'bun', 'twintails'],
};

export const HAIR_COLORS = {
  darkbrown: { label: 'Nâu đen', color: '#3a2420' },
  black: { label: 'Đen', color: '#22202c' },
  chestnut: { label: 'Nâu hạt dẻ', color: '#8a4a2a' },
  blonde: { label: 'Vàng', color: '#e0b448' },
  red: { label: 'Đỏ', color: '#c0402c' },
  silver: { label: 'Bạc', color: '#c4c4cc' },
  blue: { label: 'Xanh dương', color: '#3a5ad0' },
  pink: { label: 'Hồng', color: '#e070a0' },
};

// blush: màu má hồng hợp với màu da (không có thì dùng màu mặc định của gfx/playerArt.js)
export const SKIN_TONES = {
  fair: { label: 'Trắng hồng', color: '#fcdcc0', blush: '#f8a0a0' },
  light: { label: 'Sáng', color: '#f8c8a0' },
  tan: { label: 'Bánh mật', color: '#e0a878', blush: '#e88068' },
  brown: { label: 'Nâu', color: '#b87850', blush: '#c86450' },
  deep: { label: 'Nâu sẫm', color: '#82502e', blush: '#9a4a38' },
};

export const EYE_COLORS = {
  dark: { label: 'Đen', color: '#202030' },
  brown: { label: 'Nâu', color: '#7a4424' },
  blue: { label: 'Xanh dương', color: '#2a64d0' },
  green: { label: 'Xanh lá', color: '#2a9050' },
  violet: { label: 'Tím', color: '#8040c0' },
};

// Bộ trang phục: mũ (+ logo / dải mũ, để dành cho mũ đội sau này), áo, quần (váy với nhân vật nữ), giày, ba lô / túi đeo.
// style 'tank': áo ba lỗ, tay chân để trần, không mang ba lô / túi (nam quần short, nữ váy ngắn).
// skirt: màu váy của nhân vật nữ (không có thì cùng màu quần)
export const OUTFITS = {
  tank: { label: 'Áo ba lỗ', style: 'tank', hat: '#e03838', hatAccent: '#ffffff', shirt: '#f4f4f0', pants: '#3a5a9a', skirt: '#d04868', shoes: '#d84838', pack: null },
  classic: { label: 'Đỏ lam', hat: '#e03838', hatAccent: '#ffffff', shirt: '#3870d8', pants: '#3a4258', shoes: '#e04040', pack: '#f0c040' },
  sunny: { label: 'Cam nắng', hat: '#f8f8f0', hatAccent: '#e84860', shirt: '#f06848', pants: '#3a4a9a', shoes: '#e04848', pack: '#f0c040' },
  forest: { label: 'Rừng xanh', hat: '#3a8a48', hatAccent: '#f0e8b0', shirt: '#5ab060', pants: '#6a5238', shoes: '#5a3a20', pack: '#c08040' },
  ocean: { label: 'Biển cả', hat: '#2a9ac8', hatAccent: '#ffffff', shirt: '#48c0d8', pants: '#2a4a7a', shoes: '#2a6ab0', pack: '#f08848' },
  night: { label: 'Bóng đêm', hat: '#2a2a38', hatAccent: '#e03850', shirt: '#3a3a50', pants: '#24242e', shoes: '#e03850', pack: '#8a50c8' },
  blossom: { label: 'Hoa đào', hat: '#f8a8c8', hatAccent: '#ffffff', shirt: '#f8c0d8', pants: '#8a58b8', shoes: '#f070a0', pack: '#f8f0e8' },
  golden: { label: 'Nắng vàng', hat: '#f0c030', hatAccent: '#3a3a48', shirt: '#f0d050', pants: '#4a5878', shoes: '#3a3a48', pack: '#e05050' },
};
const OUTFIT_ORDER = {
  male: ['tank', 'classic', 'sunny', 'forest', 'ocean', 'night', 'blossom', 'golden'],
  female: ['tank', 'sunny', 'classic', 'forest', 'ocean', 'night', 'blossom', 'golden'],
};

export const GENDERS = { male: { label: 'Nam' }, female: { label: 'Nữ' } };

// Diện mạo mặc định khi chơi mới: đơn giản, áo ba lỗ trắng, không đội mũ, không ba lô / túi
// (nam tóc ngắn + quần short, nữ tóc đuôi ngựa + váy ngắn)
export const DEFAULT_CUSTOM = Object.freeze({
  male: Object.freeze({ hairStyle: 'short', hair: 'darkbrown', skin: 'light', outfit: 'tank', eyes: 'dark' }),
  female: Object.freeze({ hairStyle: 'ponytail', hair: 'chestnut', skin: 'light', outfit: 'tank', eyes: 'dark' }),
});

// Diện mạo cũ (trước khi có tuỳ chỉnh) = nhân vật nam / nữ có sẵn (PLAYER_BASE_LOOKS: áo khoác xanh + ba lô / áo cam + váy
// + túi đeo), bỏ mũ: bản lưu cũ chưa có diện mạo giữ bộ đồ đã quen, nam tóc ngắn, nữ tóc dài (tóc vốn có dưới nón)
export const LEGACY_CUSTOM = Object.freeze({
  male: Object.freeze({ hairStyle: 'short', hair: 'darkbrown', skin: 'light', outfit: 'classic', eyes: 'dark' }),
  female: Object.freeze({ hairStyle: 'long', hair: 'chestnut', skin: 'light', outfit: 'sunny', eyes: 'dark' }),
});

// Các dòng trong bảng tuỳ chỉnh, theo thứ tự hiển thị
export const CUSTOM_ROWS = [
  { key: 'hairStyle', label: 'Kiểu tóc' },
  { key: 'hair', label: 'Màu tóc' },
  { key: 'skin', label: 'Màu da' },
  { key: 'outfit', label: 'Trang phục' },
  { key: 'eyes', label: 'Mắt' },
];

const TABLES = { hairStyle: HAIR_STYLES, hair: HAIR_COLORS, skin: SKIN_TONES, outfit: OUTFITS, eyes: EYE_COLORS };
const genderOf = (gender) => (gender === 'female' ? 'female' : 'male');

// Danh sách mã lựa chọn của một dòng theo giới tính
export function optionIds(key, gender) {
  const g = genderOf(gender);
  if (key === 'hairStyle') return HAIR_ORDER[g];
  if (key === 'outfit') return OUTFIT_ORDER[g];
  return Object.keys(TABLES[key]);
}

// Thông tin một lựa chọn: { label, color? }
export const optionInfo = (key, id) => TABLES[key]?.[id] ?? null;

// Bổ sung / sửa diện mạo (bản lưu cũ chưa có, mã không còn trong game, kiểu tóc có mũ ngày trước, kiểu tóc của giới tính
// kia): dòng nào không có trong danh sách của giới tính thì lấy mặc định của giới tính
export function normalizeCustom(gender, custom) {
  const def = DEFAULT_CUSTOM[genderOf(gender)];
  const out = {};
  for (const { key } of CUSTOM_ROWS) {
    const id = custom?.[key];
    out[key] = typeof id === 'string' && optionIds(key, gender).includes(id) ? id : def[key];
  }
  return out;
}

// Diện mạo hiện tại của người chơi (state.player): chưa có (bản lưu cũ) thì là diện mạo cũ. Trả về { gender, ...diện mạo }
export function currentLook(player) {
  const gender = genderOf(player?.gender);
  return { gender, ...normalizeCustom(gender, player?.look ?? LEGACY_CUSTOM[gender]) };
}

// Đổi giới tính trong bảng tuỳ chỉnh: dòng nào đang là mặc định của giới tính cũ thì đổi sang mặc định của giới tính mới,
// dòng đã tự chọn (màu tóc, màu da, mắt, trang phục) thì giữ nguyên. Kiểu tóc mỗi giới tính một danh sách riêng: luôn về
// kiểu mặc định của giới tính mới
export function switchGender(from, to, custom) {
  const c = normalizeCustom(from, custom);
  const a = DEFAULT_CUSTOM[genderOf(from)];
  const b = DEFAULT_CUSTOM[genderOf(to)];
  return normalizeCustom(to, Object.fromEntries(CUSTOM_ROWS.map(({ key }) => [key, c[key] === a[key] ? b[key] : c[key]])));
}

// Mã lựa chọn kế tiếp (delta = +1 / -1, vòng tròn)
export function stepOption(gender, custom, key, delta) {
  const c = normalizeCustom(gender, custom);
  const ids = optionIds(key, gender);
  const i = Math.max(0, ids.indexOf(c[key]));
  return { ...c, [key]: ids[(i + delta + ids.length * 4) % ids.length] };
}

// Diện mạo ngẫu nhiên (rng: hàm trả về số trong [0, 1))
export function randomCustom(gender, rng = Math.random) {
  const out = {};
  for (const { key } of CUSTOM_ROWS) {
    const ids = optionIds(key, gender);
    out[key] = ids[Math.min(ids.length - 1, Math.floor(rng() * ids.length))];
  }
  return out;
}

// Bảng màu nhân vật để vẽ (cùng dạng với LOOKS['player'] / LOOKS['player-f']).
// Nam / nữ khác nhau dù chọn giống nhau: nữ có lông mi (lashes) + má hồng, mặc váy (cả với áo ba lỗ: váy ngắn), đeo túi chéo;
// nam không má hồng, quần dài (áo ba lỗ: quần short), đeo ba lô
export function resolveLook(gender, custom) {
  const g = genderOf(gender);
  const c = normalizeCustom(g, custom);
  const base = PLAYER_BASE_LOOKS[g];
  const o = OUTFITS[c.outfit];
  const look = {
    ...base,
    hairStyle: c.hairStyle,
    hair: HAIR_COLORS[c.hair].color,
    skin: SKIN_TONES[c.skin].color,
    eyes: EYE_COLORS[c.eyes].color,
    hat: o.hat,
    hatAccent: o.hatAccent,
    shirt: o.shirt,
    pants: o.pants,
    shoes: o.shoes,
  };
  if (g === 'male') look.blush = look.skin; // má không hồng
  else if (SKIN_TONES[c.skin].blush) look.blush = SKIN_TONES[c.skin].blush;
  if (base.skirt) look.skirt = o.skirt ?? o.pants;
  if (o.style === 'tank') {
    // áo ba lỗ: bỏ ba lô / túi, thắt lưng. Nam quần short, nữ giữ váy (váy ngắn, chân để trần)
    for (const k of ['backpack', 'bag', 'belt']) delete look[k];
    look.tank = true;
    if (!base.dress) look.shorts = true;
    return look;
  }
  if (base.backpack) look.backpack = o.pack;
  if (base.bag) look.bag = o.pack;
  return look;
}
