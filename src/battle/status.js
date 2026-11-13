import { MOVES } from '../data/moves.js';
import { SPECIES } from '../data/monsters.js';
import { STAGE_MAX, STAGE_SHORT } from '../data/stats.js';
import { revertBattleForm } from './transform.js';

// Trạng thái xấu (giữ nguyên sau trận, hết khi hồi phục ở Pokémon Center hoặc dùng thuốc / quả mọng)
export const STATUS_INFO = {
  brn: { name: 'bỏng', label: 'BỎNG', color: 0xe8703a, inflicted: 'bị bỏng!', cured: 'đã khỏi bỏng!' },
  psn: { name: 'trúng độc', label: 'ĐỘC', color: 0xa048b0, inflicted: 'bị trúng độc!', cured: 'đã hết độc!' },
  par: { name: 'tê liệt', label: 'TÊ', color: 0xd0a820, inflicted: 'bị tê liệt! Có thể không cử động được!', cured: 'đã hết tê liệt!' },
  slp: { name: 'ngủ', label: 'NGỦ', color: 0x8a8ea0, inflicted: 'đã ngủ thiếp đi!', cured: 'đã tỉnh dậy!' },
  frz: { name: 'đóng băng', label: 'BĂNG', color: 0x58b0e0, inflicted: 'bị đóng băng!', cured: 'đã tan băng!' },
};

const typesOf = (mon) => SPECIES[mon.speciesId].types;

// Lý do không gây được trạng thái (null = gây được): 'already' đang có trạng thái • 'immune' miễn nhiễm theo hệ
// weather: thời tiết trận đấu (trời nắng thì không bị đóng băng) • ability: đặc tính đang có tác dụng (Neutralizing Gas thì null)
export function statusBlocked(mon, status, move = null, weather = null, ability = mon.ability) {
  if (mon.hp <= 0) return 'fainted';
  if (mon.status) return 'already';
  const types = typesOf(mon);
  if (status === 'brn' && (types.includes('fire') || ability === 'waterVeil')) return 'immune';
  if (status === 'psn' && (types.includes('poison') || types.includes('steel'))) return 'immune';
  if (status === 'par' && types.includes('electric')) return 'immune';
  if (status === 'frz' && (types.includes('ice') || weather === 'sun')) return 'immune';
  if (status === 'slp' && ['insomnia', 'vitalSpirit'].includes(ability)) return 'immune';
  if (status === 'par' && ability === 'limber') return 'immune';
  if (status === 'psn' && ability === 'immunity') return 'immune';
  // Leaf Guard: trời nắng thì không bị trạng thái xấu nào
  if (ability === 'leafGuard' && weather === 'sun') return 'immune';
  // Bột (Stun Spore, Sleep Powder...) không ăn thua với hệ Cỏ và Overcoat; Thunder Wave không ăn thua với hệ Đất
  if (move?.powder && (types.includes('grass') || ability === 'overcoat')) return 'immune';
  if (move?.type === 'electric' && move.category === 'status' && types.includes('ground')) return 'immune';
  return null;
}

// Chiêu dùng được: còn PP, không bị phong ấn (Cursed Body), đang bị khiêu khích (Taunt) thì không dùng được chiêu trạng thái
export const canUseMove = (mon, id) => mon.pp[id] > 0 && mon.disabled?.move !== id && !(mon.taunted && MOVES[id].category === 'status');

export function inflictStatus(mon, status, rng = Math.random) {
  mon.status = status;
  // Ngủ 1-3 lượt
  mon.sleepTurns = status === 'slp' ? 1 + Math.floor(rng() * 3) : 0;
}

export function cureStatus(mon) {
  mon.status = null;
  mon.sleepTurns = 0;
}

// Trước khi ra đòn: { canMove, message } (message: câu nói sau tên Pokémon, hoặc null)
// ability: đặc tính đang có tác dụng (Early Bird: bộ đếm ngủ giảm 2 mỗi lượt, ngủ chỉ bằng nửa thời gian)
export function checkCanMove(mon, rng = Math.random, ability = mon.ability) {
  switch (mon.status) {
    case 'slp':
      if (mon.sleepTurns > 0) {
        mon.sleepTurns = Math.max(0, mon.sleepTurns - (ability === 'earlyBird' ? 2 : 1));
        return { canMove: false, message: 'đang ngủ say.' };
      }
      cureStatus(mon);
      return { canMove: true, message: STATUS_INFO.slp.cured };
    case 'frz':
      // Mỗi lượt 20% tự tan băng
      if (rng() < 0.2) {
        cureStatus(mon);
        return { canMove: true, message: STATUS_INFO.frz.cured };
      }
      return { canMove: false, message: 'bị đóng băng cứng!' };
    case 'par':
      if (rng() < 0.25) return { canMove: false, message: 'bị tê liệt, không cử động được!' };
      return { canMove: true, message: null };
    default:
      return { canMove: true, message: null };
  }
}

// ---------- Hiệu ứng tạm thời trong trận (mất khi rút về / hết trận) ----------

// Rối loạn: không gây được nếu đã gục, đang rối loạn, hoặc có Own Tempo
export function confuseBlocked(mon, ability = mon.ability) {
  if (mon.hp <= 0) return 'fainted';
  if (mon.confused) return 'already';
  if (ability === 'ownTempo') return 'immune';
  return null;
}

// Bộ đếm 2-5: bị rối loạn 1-4 lượt rồi tự hết
export function inflictConfusion(mon, rng = Math.random) {
  mon.confused = 2 + Math.floor(rng() * 4);
}

// Trước khi ra đòn: null (không rối loạn) • 'snapped' vừa hết rối loạn • 'confused' vẫn ra đòn được • 'hitSelf' tự đánh mình (1/3)
export function checkConfusion(mon, rng = Math.random) {
  if (!mon.confused) return null;
  if (--mon.confused <= 0) {
    delete mon.confused;
    return 'snapped';
  }
  return rng() < 1 / 3 ? 'hitSelf' : 'confused';
}

// Say mê (Attract): chỉ khác giới mới được, không có giới tính hoặc có Oblivious thì không bị
export function attractBlocked(mon, source, ability = mon.ability) {
  if (mon.hp <= 0) return 'fainted';
  if (mon.infatuated) return 'already';
  if (!mon.gender || !source.gender || mon.gender === source.gender) return 'gender';
  if (ability === 'oblivious') return 'immune';
  return null;
}

// Khiêu khích (Taunt): Oblivious không bị
export function tauntBlocked(mon, ability = mon.ability) {
  if (mon.hp <= 0) return 'fainted';
  if (mon.taunted) return 'already';
  if (ability === 'oblivious') return 'immune';
  return null;
}

// Xoá mọi hiệu ứng chỉ có khi đang trên sân (khi vừa ra sân / rút về): bậc chỉ số, Flash Fire, chiêu bị phong ấn, chùn bước,
// rối loạn, say mê, khiêu khích, bị trói (Wrap), đang cuồng nộ (Outrage), Unburden; hết biến hình (Transform / Imposter) và
// trả lại đặc tính gốc (Trace). Không đụng tới trạng thái xấu, HP, PP của bộ chiêu gốc và đồ đang cầm.
export function clearVolatile(mon) {
  revertBattleForm(mon);
  for (const key of ['stages', 'flashFire', 'disabled', 'flinched', 'confused', 'infatuated', 'taunted', 'bound', 'rampage', 'unburdened']) {
    delete mon[key];
  }
}

// Trói chân (Wrap) như từ Gen 6: bên trúng đòn không rút về / chạy trốn được (hệ Ma thì được, xem trappedBy),
// cuối mỗi lượt mất 1/8 HP tối đa, 4-5 lượt rồi thoát; hết sớm khi bên trói rời sân hoặc gục.
// Đang bị trói thì trúng thêm cũng không tính lại. Trả về true nếu bắt đầu trói được
export function startBind(target, source, moveId, rng = Math.random) {
  if (target.hp <= 0 || target.bound) return false;
  // Không đếm khi lưu (JSON): tham chiếu tới Pokémon của bên kia
  Object.defineProperty(target, 'bound', {
    value: { source, move: moveId, turns: rng() < 0.5 ? 4 : 5 }, enumerable: false, configurable: true, writable: true,
  });
  return true;
}

// Số HP mất cuối lượt vì bị trói
export const bindDamage = (mon) => Math.min(mon.hp, Math.max(1, Math.floor(mon.maxHp / 8)));

// Cuồng nộ (Outrage) như từ Gen 5: bị khoá vào chiêu trong 2-3 lượt (chỉ lượt đầu tốn PP), hết thì bị rối loạn vì mệt
export function startRampage(mon, moveId, rng = Math.random) {
  mon.rampage = { move: moveId, turns: rng() < 0.5 ? 2 : 3 };
}

// Hết trận (hoặc tải bản lưu giữa trận): xoá hiệu ứng tạm thời và trả lại đồ cầm bị lấy / hất mất trong trận.
// itemBeforeBattle: món đang cầm trước khi bị Thief / Covet / Knock Off lấy đi (hoặc null nếu món đang cầm là đồ lấy của
// nhà huấn luyện) — như game gốc từ Gen 5, đồ bị mất trong trận được trả lại, chỉ giữ được đồ lấy của Pokémon hoang dã.
export function clearBattleState(mon) {
  clearVolatile(mon);
  delete mon.lastBerry; // quả mọng đã ăn trong trận (Harvest)
  if ('itemBeforeBattle' in mon) {
    mon.heldItem = mon.itemBeforeBattle;
    delete mon.itemBeforeBattle;
  }
}

// Mất máu cuối lượt vì bỏng (1/16) hoặc trúng độc (1/8). Trả về số HP mất.
export function statusDamage(mon) {
  if (mon.hp <= 0) return 0;
  const part = { brn: 16, psn: 8 }[mon.status];
  if (!part) return 0;
  const dmg = Math.min(mon.hp, Math.max(1, Math.floor(mon.maxHp / part)));
  mon.hp -= dmg;
  return dmg;
}

// ---------- Bậc chỉ số trong trận (-6..+6) ----------

export const stageOf = (mon, stat) => mon.stages?.[stat] ?? 0;

// Đổi bậc chỉ số, trả về số bậc thực đổi (0 = đã chạm giới hạn)
export function changeStage(mon, stat, delta) {
  mon.stages ??= {};
  const cur = stageOf(mon, stat);
  const next = Math.max(-STAGE_MAX, Math.min(STAGE_MAX, cur + delta));
  mon.stages[stat] = next;
  return next - cur;
}

// Đặc tính chặn đối thủ giảm chỉ số: Clear Body (mọi chỉ số), Keen Eye (độ chính xác), Big Pecks (Phòng thủ), Hyper Cutter (Tấn công).
// Trả về id đặc tính đã chặn, hoặc null. Tự giảm chỉ số của mình (byFoe = false) thì không chặn
const GUARDED_STAT = { keenEye: 'accuracy', bigPecks: 'def', hyperCutter: 'atk' };
export function stageGuarded(stat, delta, ability, byFoe = true) {
  if (!byFoe || delta >= 0) return null;
  if (ability === 'clearBody' || GUARDED_STAT[ability] === stat) return ability;
  return null;
}

// Bị đối thủ làm giảm chỉ số (giảm được thật) thì nổi máu: Defiant tăng 2 bậc Tấn công, Competitive tăng 2 bậc Tấn công ĐB.
// Trả về { stat, delta } hoặc null
const DROP_REACTION = { defiant: 'atk', competitive: 'spAtk' };
export function stageDropReaction(ability, changed, byFoe = true) {
  if (!byFoe || changed >= 0 || !DROP_REACTION[ability]) return null;
  return { stat: DROP_REACTION[ability], delta: 2 };
}

// Chiêu trạng thái chỉ để đổi chỉ số (Swords Dance, Growl...) mà mọi chỉ số đều đã chạm giới hạn (+6 khi tăng, -6 khi giảm)
// hoặc bị đặc tính chặn: dùng cũng vô ích. target: Pokémon bị đổi chỉ số (chính mình nếu move.self), ability: đặc tính của nó
export function stageMoveUseless(move, target, ability = target.ability) {
  if (!move.stages || move.category !== 'status') return false;
  if (['status', 'confuse', 'attract', 'taunt', 'weather', 'screen'].some((k) => move[k])) return false;
  return Object.entries(move.stages).every(([stat, delta]) => {
    if (stageGuarded(stat, delta, ability, !move.self)) return true;
    const cur = stageOf(target, stat);
    return delta > 0 ? cur >= STAGE_MAX : cur <= -STAGE_MAX;
  });
}

// "Squirtle của đối thủ bị giảm Atk!" (tên chỉ số viết tắt tiếng Anh; đặt tên Pokémon trước để không lặp "của ... của đối thủ")
export function stageMessage(name, stat, changed, wanted) {
  const s = STAGE_SHORT[stat];
  if (changed === 0) return `${name} không thể ${wanted > 0 ? 'tăng' : 'giảm'} ${s} thêm nữa!`;
  const how = changed > 0 ? (changed >= 2 ? 'được tăng mạnh' : 'được tăng') : changed <= -2 ? 'bị giảm mạnh' : 'bị giảm';
  return `${name} ${how} ${s}!`;
}

// Hệ số nhân chỉ số theo bậc: +1 = x1.5, +2 = x2 ... -1 = x2/3
export const stageMultiplier = (stage) => (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage));
// Độ chính xác / né tránh: +1 = x4/3 ... -1 = x3/4
export const accuracyMultiplier = (stage) => (stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage));
