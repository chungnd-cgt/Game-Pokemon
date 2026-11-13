import { syncUid, upgradeMonster } from './monster.js';
import { ITEMS } from '../data/items.js';
import { normalizeCustom } from '../data/playerCustom.js';
import { MOVES } from '../data/moves.js';
import { restUntil } from './trainers.js';
import { addItem, resetState, state } from './state.js';

// Lưu game vào localStorage của trình duyệt (mỗi trình duyệt / máy một bản lưu)
const KEY = 'pokemon-demo-save-v1';
// Phiên bản bản lưu: 2 = có quà của mẹ / HM Surf trong cốt truyện (bản lưu cũ hơn được bổ sung khi tải)
const VERSION = 2;
// Mỗi tab một phiên: tab khác đã lưu mới hơn thì tab này thôi lưu (không ghi đè tiến độ của tab kia)
const SESSION = Math.random().toString(36).slice(2);
let lastWrite = 0;
let blocked = false;
export const saveBlocked = () => blocked;

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export const hasSave = () => Boolean(read());

// Vị trí lần lưu gần nhất: trong trận đấu lưu lại (sau mỗi lượt) mà không cần biết người chơi đứng đâu
let lastPosition = null;

// position: { map, x, y, facing } của người chơi
export function saveGame(position = lastPosition) {
  if (!position || blocked) return false;
  const current = read();
  if (current?.session && current.session !== SESSION && current.savedAt > lastWrite) {
    blocked = true;
    return false;
  }
  lastPosition = position;
  const data = {
    version: VERSION,
    session: SESSION,
    savedAt: Date.now(),
    position,
    player: state.player,
    party: state.party,
    storage: state.storage,
    bag: state.bag,
    money: state.money,
    dex: { seen: [...state.dex.seen], caught: [...state.dex.caught] },
    defeatedTrainers: [...state.defeatedTrainers],
    trainerRest: state.trainerRest,
    pendingBattle: state.pendingBattle,
    itemRespawn: state.itemRespawn,
    hotbar: state.hotbar,
    flags: [...state.flags],
    berryTrees: state.berryTrees,
    repel: state.repel,
    lastCenter: state.lastCenter,
    badges: [...state.badges],
    visited: [...state.visited],
    hallOfFame: state.hallOfFame,
    playTime: state.playTime,
    startedAt: state.startedAt,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    lastWrite = data.savedAt;
    return true;
  } catch {
    return false;
  }
}

// Nạp bản lưu vào state, trả về vị trí người chơi (hoặc null nếu không có bản lưu)
export function loadGame() {
  const data = read();
  if (!data) return null;
  resetState();
  Object.assign(state, {
    player: { name: '', gender: 'male', ...data.player },
    party: data.party ?? [],
    storage: data.storage ?? [],
    bag: data.bag ?? {},
    money: data.money ?? state.money,
    dex: { seen: new Set(data.dex?.seen), caught: new Set(data.dex?.caught) },
    defeatedTrainers: new Set(data.defeatedTrainers),
    trainerRest: data.trainerRest ?? {},
    pendingBattle: data.pendingBattle ?? null,
    itemRespawn: data.itemRespawn ?? {},
    hotbar: data.hotbar ?? state.hotbar,
    flags: new Set(data.flags),
    berryTrees: data.berryTrees ?? {},
    repel: data.repel ?? null,
    lastCenter: data.lastCenter ?? null,
    badges: new Set(data.badges),
    visited: new Set(data.visited),
    hallOfFame: data.hallOfFame ?? [],
    playTime: data.playTime ?? 0,
    startedAt: data.startedAt ?? null,
  });
  // Diện mạo tự chọn: mã không còn trong game thì thay bằng mặc định. Bản lưu cũ chưa có diện mạo thì để trống
  // (gfx/player.js: applyPlayerLook vẽ diện mạo mặc định của giới tính)
  if (data.player?.look) state.player.look = normalizeCustom(state.player.gender, data.player.look);
  // Vật phẩm / chiêu không còn trong game (đổi tên, bỏ đi): bỏ khỏi túi, ô phím tắt, đồ cầm, bộ chiêu.
  // Phải bỏ chiêu lạ trước khi bổ sung dữ liệu cho bản lưu cũ (upgradeMonster tính PP theo bộ chiêu)
  for (const id of Object.keys(state.bag)) if (!ITEMS[id]) delete state.bag[id];
  state.hotbar = state.hotbar.map((id) => (id && ITEMS[id] ? id : null));
  const mons = [...state.party, ...state.storage].filter(Boolean); // hộp PC có ô trống (null) xen giữa
  for (const m of mons) {
    if (m.heldItem && !ITEMS[m.heldItem]) m.heldItem = null;
    const moves = m.moves.filter((id) => MOVES[id]);
    m.moves = moves.length ? moves : ['tackle'];
  }
  // Bản lưu cũ chưa có IV / EV / tính cách / PP...: bổ sung
  mons.forEach((m) => upgradeMonster(m));
  for (const m of mons) m.pp = Object.fromEntries(m.moves.map((id) => [id, Math.min(m.pp?.[id] ?? MOVES[id].pp, MOVES[id].pp)]));
  syncUid(mons);
  // Bản lưu cũ chưa có huy hiệu: thắng thủ lĩnh nào thì có huy hiệu đó
  for (const id of state.defeatedTrainers) if (id.startsWith('leader-')) state.badges.add(id.slice('leader-'.length));
  // Bản lưu cũ chưa có lịch đấu lại: trainer đã thua thì nghỉ 3-4 ngày kể từ lúc tải (chỉ một lần, khi bản lưu chưa có trainerRest)
  if (data.trainerRest === undefined) for (const id of state.defeatedTrainers) state.trainerRest[id] = restUntil();
  if ((data.version ?? 1) < 2) {
    // Bản lưu cũ đã có huy hiệu Nước nhưng chưa có HM Surf (bản trước Surf học theo cấp): bổ sung
    if (state.badges.has('water') && !state.bag.hmSurf) addItem('hmSurf');
    // Bản lưu cũ đã qua đoạn nhận Pokédex nhưng chưa có quà của mẹ (Bản đồ vùng, Hộp huy hiệu): bổ sung
    if (state.flags.has('gotPokedex') && !state.flags.has('momGift')) {
      addItem('townMap');
      addItem('badgeCase');
      state.flags.add('momGift');
    }
  }
  lastPosition = data.position;
  lastWrite = data.savedAt ?? 0;
  blocked = false;
  return data.position;
}

export function deleteSave() {
  lastPosition = null;
  lastWrite = 0;
  blocked = false;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // trình duyệt chặn localStorage: không có gì để xoá
  }
}

// Thông tin ngắn để hiện ở màn hình chính
export function saveSummary() {
  const data = read();
  if (!data) return null;
  return {
    name: data.player?.name ?? '',
    gender: data.player?.gender ?? 'male',
    look: data.player?.look ? normalizeCustom(data.player.gender, data.player.look) : null,
    lead: data.party?.[0] ?? null,
    partySize: data.party?.length ?? 0,
    caught: data.dex?.caught?.length ?? 0,
    money: data.money ?? 0,
    playTime: data.playTime ?? 0,
    savedAt: data.savedAt,
  };
}
