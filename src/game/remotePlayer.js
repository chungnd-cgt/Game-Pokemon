import { SPECIES } from '../data/monsters.js';

// Dữ liệu người chơi khác gửi qua Realtime (online/presence.js) do máy người đó tự gửi, nên giả được / sai được. Supabase
// Realtime không cho máy chủ kiểm tra từng tin, nên bên nhận làm sạch trước khi dùng (không phụ thuộc Phaser / mạng, để test).

export const MAX_PATH = 24; // giữ khớp online/presence.js MAX_TRAIL
const GAP_MIN = 100;
const GAP_MAX = 3000;
const FACINGS = new Set(['up', 'down', 'left', 'right']);

const isInt = (v) => Number.isInteger(v) && Math.abs(v) < 100000;

// Thông tin presence: tên lấy từ nameOf(id, tên tự gửi) (máy chủ, online/playerNames.js), giới tính / Pokémon đi theo
// chỉ nhận giá trị game có (loài lạ thì không vẽ Pokémon đi theo)
export function cleanMeta(meta, nameOf) {
  const f = meta.follower;
  return {
    ...meta,
    claimedName: meta.name, // tên tự gửi: chỉ dùng khi máy chủ chưa có bảng tên
    name: nameOf(meta.id, meta.name),
    gender: meta.gender === 'female' ? 'female' : 'male',
    follower: f && typeof f.s === 'string' && Object.hasOwn(SPECIES, f.s) ? { s: f.s, sh: Boolean(f.sh) } : null,
  };
}

// Tin bước đi: toạ độ phải là số nguyên, path tối đa MAX_PATH ô (chỉ giữ các ô cuối), nhịp gửi trong khoảng hợp lý.
// Sai hẳn (không có chỗ đứng) thì null: bỏ qua tin
export function cleanMove(p) {
  if (!p || typeof p.id !== 'string' || !isInt(p.x) || !isInt(p.y)) return null;
  const path = Array.isArray(p.path)
    ? p.path.slice(-MAX_PATH).filter((c) => Array.isArray(c) && isInt(c[0]) && isInt(c[1])).map((c) => [c[0], c[1]])
    : undefined;
  return {
    ...p,
    path,
    facing: FACINGS.has(p.facing) ? p.facing : undefined,
    gap: Number.isFinite(p.gap) ? Math.min(GAP_MAX, Math.max(GAP_MIN, p.gap)) : undefined,
    moveAt: Number.isFinite(p.moveAt) ? p.moveAt : undefined,
  };
}
