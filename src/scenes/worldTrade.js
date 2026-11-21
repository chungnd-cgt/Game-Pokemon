import { SPECIES } from '../data/monsters.js';
import { tradeEvolutionTarget } from '../game/evolution.js';
import { playerName, state } from '../game/state.js';
import { logSystem } from '../game/systemLog.js';
import { TRADE_MIN_BADGES, applyTrade, canTrade } from '../game/trade.js';
import { upload } from '../online/cloudSave.js';
import { supabase } from '../online/supabase.js';
import {
  INVITE_TIMEOUT, acceptTrade, cancelTrade, markApplied, openTrade, pendingTrades, waitAccepted,
} from '../online/trade.js';
import { TradePanel, TradeRequests } from '../ui/TradePanel.js';

// Giao dịch giữa người chơi trên bản đồ (luật: game/trade.js, mạng: online/trade.js + online/presence.js).
//  - Chọn người chơi khác trên bản đồ (scenes/worldPlayers.js: chuột phải / chạm đúp) -> Giao dịch: gửi lời mời.
//    Chỉ được khi cả hai có từ 4 huy hiệu và đang ở trong Pokémon Center (cùng bản đồ thì cùng một Pokémon Center).
//  - Người được mời: popup Đồng ý / Từ chối (nhiều lời mời thì xếp chồng; đồng ý lời nào trước thì giao dịch với người đó,
//    máy chủ huỷ các lời mời còn lại). Đang giao dịch / đang chờ người khác mà bấm Đồng ý thêm: báo không được.
//  - Giao dịch chốt xong: nhận đồ, lưu, gửi bản lưu lên mạng; Pokémon tiến hoá khi trao đổi thì hỏi có cho tiến hoá không

// Pokémon Center (center, centerN, vcenterN; không tính sảnh Liên minh): nơi được giao dịch
export const isPokeCenter = (map) => map?.theme === 'center';

const userId = (world) => world.registry.get('user')?.id ?? null;
const INVITE_GAP = 30000;
const BUSY_TEXT = 'Không thể thực hiện khi đang giao dịch với người chơi khác.';

export function setupTrade(world) {
  world.trade = { active: false, waiting: false, requests: supabase ? new TradeRequests() : null };
  world.events.once('shutdown', () => world.trade.requests?.destroy());
}

// Quầy giao dịch trong Pokémon Center (def: NPC trong data/npcs.js; đã ở trong runEvent): hướng dẫn cách giao dịch
export async function tradeCounter(world, def) {
  await world.say(def.name, [
    `Muốn giao dịch với người chơi khác thì cả hai cần từ ${TRADE_MIN_BADGES} huy hiệu và cùng đứng trong Pokémon Center.`,
    'Chuột phải (máy tính) hoặc chạm đúp (điện thoại) vào người chơi đó rồi chọn Giao dịch.',
    'Có thể đổi Pokémon (tối đa 5 con, phải chừa lại 1 con), vật phẩm, quả mọng và tiền. Huỷ giữa chừng thì không ai mất gì!',
    canTrade() ? 'Bạn đã đủ huy hiệu rồi, chúc giao dịch vui vẻ!' : `Bạn đang có ${state.badges.size} huy hiệu. Cố lên nhé!`,
  ]);
}

// Lý do chưa giao dịch được với other (meta người chơi trong online/presence.js), hoặc null
function tradeProblem(world, other) {
  if (!isPokeCenter(world.map)) return 'Chỉ giao dịch được trong Pokémon Center.';
  if (!canTrade()) return `Cần ít nhất ${TRADE_MIN_BADGES} huy hiệu để giao dịch (bạn có ${state.badges.size}).`;
  if (other && (other.badges ?? 0) < TRADE_MIN_BADGES) return `${other.name || 'Người chơi này'} chưa đủ ${TRADE_MIN_BADGES} huy hiệu.`;
  return null;
}

// Mời other giao dịch (đã ở trong runEvent: chọn Giao dịch trong menu người chơi)
export async function requestTrade(world, other) {
  const t = world.trade;
  const problem = tradeProblem(world, other);
  if (problem) return world.say(null, [problem]);
  if (t.active || t.waiting) return world.say(null, [BUSY_TEXT]);
  // Mỗi 30 giây chỉ 1 lời mời (máy chủ cũng chặn: supabase/trades.sql trade_open)
  const wait = Math.ceil((INVITE_GAP - (Date.now() - (t.lastInvite ?? 0))) / 1000);
  if (wait > 0) return world.say(null, [`Mỗi 30 giây chỉ gửi được 1 lời mời, chờ ${wait} giây nữa.`]);
  // Máy chủ kiểm tra giao dịch theo bản lưu trên mạng: gửi bản mới nhất lên trước
  world.save();
  await upload();
  const res = await openTrade(other.id, playerName());
  if (res.error) return world.say(null, [res.error]);
  const id = res.data;
  t.lastInvite = Date.now();
  world.presence?.sendRequest(other.id, id);
  t.waiting = true;
  let aborted = false;
  const close = t.requests.waiting(`Đang chờ ${other.name || 'người chơi'} đồng ý giao dịch…`, () => {
    aborted = true;
  });
  const outcome = await waitAccepted(id, () => aborted);
  close();
  t.waiting = false;
  if (outcome === 'accepted') await runTrade(world, id, other);
  else if (outcome === 'cancelled') await world.say(null, [`${other.name || 'Người chơi'} đã từ chối, hoặc đang giao dịch với người khác.`]);
  else if (outcome === 'timeout') await world.say(null, [`${other.name || 'Người chơi'} không trả lời.`]);
}

// Có người mời mình (online/presence.js): popup Đồng ý / Từ chối
export function onTradeRequest(world, req) {
  const t = world.trade;
  if (!t?.requests) return;
  t.requests.add(req.from, {
    timeout: INVITE_TIMEOUT,
    onDecline: () => cancelTrade(req.id),
    onAccept: async () => {
      if (t.active || t.waiting) {
        t.requests.note(BUSY_TEXT);
        return false;
      }
      if (!world.scene.isActive() || !world.freeForInput() || world.moving) {
        t.requests.note('Hãy đứng yên trên bản đồ (không trong trận, hội thoại hay menu) rồi bấm Đồng ý.');
        return false;
      }
      const problem = tradeProblem(world, req.from);
      if (problem) {
        t.requests.note(problem);
        return false;
      }
      t.active = true; // giữ chỗ ngay: bấm Đồng ý lời mời khác lúc này thì báo đang giao dịch
      world.runEvent(async () => {
        world.save();
        await upload();
        const res = await acceptTrade(req.id, playerName());
        if (res.error) {
          t.active = false;
          await world.say(null, [res.error === 'Lời mời không còn hiệu lực' ? 'Lời mời đã hết hiệu lực.' : res.error]);
          return;
        }
        await runTrade(world, req.id, req.from);
      });
      return true;
    },
  });
}

// Mở bảng giao dịch với partner ({ id, name }) cho giao dịch id
async function runTrade(world, id, partner) {
  const t = world.trade;
  t.active = true;
  try {
    const result = await new TradePanel(world, { id, meId: userId(world), partner }).open();
    if (result.status !== 'done') {
      logSystem(`Giao dịch với ${partner?.name || 'người chơi'} không thành: ${result.reason}`, 'warn');
      await world.say(null, [result.reason]);
      return;
    }
    await finishTrade(world, result.view);
  } finally {
    t.active = false;
  }
}

// Nhận đồ của giao dịch đã chốt (view: online/trade.js sideOf). Không bao giờ nhận hai lần (state.tradesDone nằm trong bản lưu)
async function finishTrade(world, view, resumed = false) {
  if (state.tradesDone.has(view.id)) {
    await markApplied(view.id);
    return;
  }
  const received = applyTrade(view.mine, view.theirs);
  state.tradesDone.add(view.id);
  world.refreshFollower();
  world.save();
  await upload();
  await markApplied(view.id);

  const got = [
    ...received.map((m) => m.name),
    ...Object.keys(view.theirs.items ?? {}).length ? ['vật phẩm'] : [],
    ...view.theirs.money ? ['tiền'] : [],
  ];
  logSystem(`Giao dịch với ${view.partnerName} thành công.${got.length ? ` Nhận: ${got.join(', ')}.` : ''}`, 'good');
  await world.say(null, [
    resumed ? `Nhận nốt giao dịch với ${view.partnerName}.` : `Giao dịch với ${view.partnerName} thành công!`,
    got.length ? `Bạn nhận được: ${got.join(', ')}.` : 'Bạn không nhận thêm gì.',
  ]);
  // Tiến hoá khi trao đổi (Kadabra -> Alakazam...): hỏi có cho tiến hoá không
  for (const mon of received) {
    const to = tradeEvolutionTarget(mon);
    if (to && SPECIES[to]) await world.evolutionScene(mon, to, true);
  }
  world.save();
}

// Vào bản đồ sau khi tải game: giao dịch đã chốt mà chưa nhận (văng game giữa chừng) thì nhận nốt
export async function resumePendingTrades(world) {
  const id = userId(world);
  if (!supabase || !id) return;
  const list = await pendingTrades(id);
  if (!list.length) return;
  // Chờ người chơi rảnh (đang có cảnh cốt truyện lúc vào game thì để xong đã)
  const run = () => {
    if (!world.scene.isActive() || world.busy || world.moving) return world.time.delayedCall(500, run);
    world.runEvent(async () => {
      for (const view of list) await finishTrade(world, view, true);
    });
  };
  run();
}
