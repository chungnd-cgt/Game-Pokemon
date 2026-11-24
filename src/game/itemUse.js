import { STATUS_INFO, cureStatus } from '../battle/status.js';
import { EV_BERRY_AMOUNT, ITEMS } from '../data/items.js';
import { MOVES } from '../data/moves.js';
import { STAT_NAMES } from '../data/stats.js';
import { evolutionTarget } from './evolution.js';
import { MAX_LEVEL, expToReach, gainExp, maxPp, reduceEv, restorePp } from './monster.js';

// Dùng vật phẩm lên một Pokémon (thuốc, quả mọng). Dùng chung cho túi đồ trên bản đồ và trong trận.

// Vật phẩm này cần chọn thêm một chiêu (Leppa Berry)
export const needsMove = (id) => ITEMS[id].kind === 'pp';

// Thuốc / quả chữa trạng thái mà Pokémon không bị trạng thái đó: nói rõ (vd "Pikachu hiện không bị tê liệt.")
function cureMiss(mon, item) {
  const names = item.cure.map((s) => STATUS_INFO[s]?.name).filter(Boolean);
  if (item.confusion) names.push('rối loạn');
  if (!names.length) return 'Không có tác dụng.';
  if (names.length >= 4) return `${mon.name} hiện không bị trạng thái xấu nào.`;
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} hay ${names[names.length - 1]}` : names[0];
  return `${mon.name} hiện không bị ${list}.`;
}

// Vì sao không dùng được (câu thông báo), hoặc null nếu dùng được. moveId: chiêu đã chọn (với Leppa)
export function itemProblem(id, mon, { inBattle = false, moveId = null } = {}) {
  const item = ITEMS[id];
  if (item.kind === 'ball') return inBattle ? null : 'Chỉ dùng được trong trận đấu.';
  if (item.kind === 'held') return 'Món này để Pokémon cầm: chọn "Cho cầm" trong túi đồ, hoặc kéo vào ô Đồ cầm ở màn chi tiết Pokémon.';
  if ((item.fieldOnly || ['evolution', 'key', 'repel', 'escape'].includes(item.kind)) && inBattle) return 'Không dùng được trong trận đấu.';
  if (!mon) return null;
  if (item.kind === 'evolution') return evolutionTarget(mon, id) ? null : 'Không có tác dụng.';
  if (item.kind === 'revive') return mon.hp > 0 ? `${mon.name} vẫn còn chiến đấu được, không cần hồi sinh.` : null;
  if (item.kind === 'level') return mon.level >= MAX_LEVEL ? `${mon.name} đã đạt cấp tối đa.` : null;
  if (mon.hp <= 0 && item.kind !== 'ev') return `${mon.name} đã gục, cần dùng Revive.`;
  switch (item.kind) {
    case 'heal':
      return mon.hp >= mon.maxHp ? `HP của ${mon.name} đang đầy.` : null;
    case 'cure':
      return item.cure.includes(mon.status) || (item.confusion && mon.confused) ? null : cureMiss(mon, item);
    case 'pp':
      if (moveId) return mon.pp[moveId] >= maxPp(moveId) ? `PP của ${MOVES[moveId].name} đang đầy.` : null;
      return mon.moves.every((m) => mon.pp[m] >= maxPp(m)) ? `PP các chiêu của ${mon.name} đều đầy.` : null;
    case 'ev':
      return mon.evs[item.ev] <= 0 ? `EV ${STAT_NAMES[item.ev]} của ${mon.name} đã bằng 0.` : null;
    default:
      return null;
  }
}

// Áp dụng vật phẩm (chưa trừ trong túi). Trả về các câu thông báo kết quả.
// Rare Candy: mảng câu còn có thuộc tính cantLearn = [id chiêu muốn học nhưng đã đủ 4 chiêu] (không có câu báo riêng cho
// các chiêu này: bên gọi hỏi người chơi có quên chiêu cũ để học không)
export function applyItem(id, mon, moveId = null) {
  const item = ITEMS[id];
  switch (item.kind) {
    case 'heal': {
      const before = mon.hp;
      const amount = item.healPct ? Math.max(1, Math.floor(mon.maxHp * item.healPct)) : item.heal;
      mon.hp = Math.min(mon.maxHp, mon.hp + amount);
      return [`${mon.name} hồi phục ${mon.hp - before} HP!`];
    }
    case 'revive':
      mon.hp = Math.max(1, Math.floor(mon.maxHp * item.revivePct));
      cureStatus(mon); // Pokémon gục không mang trạng thái (bản lưu cũ có thể còn)
      return [`${mon.name} đã hồi sinh${item.revivePct >= 1 ? ' với toàn bộ HP' : ''}!`];
    case 'cure': {
      const lines = [];
      if (item.cure.includes(mon.status)) {
        lines.push(`${mon.name} ${STATUS_INFO[mon.status].cured}`);
        cureStatus(mon);
      }
      if (item.confusion && mon.confused) {
        delete mon.confused;
        lines.push(`${mon.name} đã hết rối loạn!`);
      }
      return lines;
    }
    case 'pp': {
      const n = restorePp(mon, moveId, item.pp);
      return [`PP của ${MOVES[moveId].name} được hồi ${n}!`];
    }
    case 'ev': {
      const n = reduceEv(mon, item.ev, EV_BERRY_AMOUNT);
      return [`${mon.name} ăn ${item.name}.`, `EV ${STAT_NAMES[item.ev]} giảm ${n}, còn ${mon.evs[item.ev]}.`];
    }
    // Rare Candy: cộng vừa đủ EXP lên cấp sau (học chiêu như lên cấp thường; tiến hoá do bên gọi xử lý)
    case 'level': {
      const events = gainExp(mon, expToReach(mon, mon.level + 1) - mon.exp);
      const lines = [];
      for (const ev of events) {
        if (ev.type === 'levelUp') lines.push(`${mon.name} lên cấp ${ev.level}!`);
        else if (ev.type === 'learn') lines.push(`${mon.name} đã học được chiêu ${MOVES[ev.move].name}!`);
      }
      lines.cantLearn = events.filter((ev) => ev.type === 'cantLearn').map((ev) => ev.move);
      return lines;
    }
    default:
      return [];
  }
}

// Escape Rope: vì sao không dùng được ở bản đồ map (câu thông báo), hoặc null nếu dùng được.
// spot: nơi sẽ về (Pokémon Center đã vào gần nhất, chưa vào thì nhà), maps: bảng bản đồ (data/map.js: MAPS).
// Đã vào các phòng Tứ Thiên Vương thì không quay ra được (sảnh Liên minh: "một khi đã bước vào thì không quay lại được");
// đang ở chính nơi hồi phục (kể cả tầng trên cùng toà nhà, nối bằng cầu thang) thì không cần dùng
export function escapeProblem(map, spot, maps) {
  if (map.place === 'league' && map.indoor) return 'Cửa phong ấn phía sau đã đóng lại. Không thể rời Liên minh giữa chừng!';
  const sameBuilding = map.indoor && maps[spot.map].indoor && Boolean(map.warps?.some((w) => w.to === spot.map));
  if (map.id === spot.map || sameBuilding) return 'Bạn đang ở nơi hồi phục rồi, không cần dùng Escape Rope.';
  return null;
}
