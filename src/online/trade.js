import { upload } from './cloudSave.js';
import { supabase } from './supabase.js';

// Giao dịch giữa người chơi qua Supabase (bảng / hàm: supabase/trades.sql; luật: game/trade.js; giao diện: ui/TradePanel.js;
// trên bản đồ: scenes/worldTrade.js). Lời mời gửi qua kênh bản đồ (online/presence.js); dòng trong bảng trades là nguồn sự
// thật: người mời đọc lại dòng để biết được đồng ý / từ chối, hai bên đọc lại dòng trong lúc giao dịch (kèm 'ping' qua kênh
// riêng của giao dịch để bên kia đọc ngay).

const POLL_MS = 1200;
export const INVITE_TIMEOUT = 30000; // ms chờ người được mời trả lời

// Lỗi từ hàm SQL: 'TRADE: <câu báo>' -> câu báo; lỗi mạng -> câu chung
function errorText(error) {
  const msg = error?.message ?? String(error ?? '');
  const m = /TRADE:\s*(.+)$/.exec(msg);
  if (m) return m[1];
  if (!error?.code || /fetch|network/i.test(msg)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return `Có lỗi xảy ra: ${msg}`;
}

async function rpc(name, args) {
  try {
    const { data, error } = await supabase.rpc(name, args);
    return error ? { error: errorText(error) } : { data };
  } catch (err) {
    return { error: errorText(err) };
  }
}

async function readRow(id) {
  const { data, error } = await supabase.from('trades').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Mời / nhận lời ----------

// Tạo giao dịch mời partnerId. Trả về { data: id } hoặc { error }
export const openTrade = (partnerId, myName) => rpc('trade_open', { p_partner: partnerId, p_name: myName });

// Người được mời đồng ý. Lời mời khác đang chờ mình (và giao dịch đang mở khác của mình) bị huỷ
export const acceptTrade = (id, myName) => rpc('trade_accept', { p_id: id, p_name: myName });

// reason: lý do hiện cho bên kia (vd túi không chứa hết đồ), hoặc bỏ trống
export const cancelTrade = (id, reason = null) => rpc('trade_cancel', { p_id: id, p_reason: reason });

// Lời mời đến qua Realtime do máy người mời tự gửi (giả được). Đối chiếu với dòng trades trên máy chủ (chỉ hai người trong
// cuộc đọc được): hợp lệ khi mình là người được mời, người mời đúng là fromId, giao dịch còn mở và chưa ai nhận.
// Trả về { name } (tên người mời do máy chủ ghi: supabase/trades.sql trade_player_name), hoặc null
export async function verifyInvite(id, fromId, meId) {
  if (!id || !fromId || !meId) return null;
  try {
    const row = await readRow(id);
    if (!row || row.a !== fromId || row.b !== meId || row.status !== 'open' || row.accepted) return null;
    return { name: row.a_name || 'Người chơi' };
  } catch {
    return null;
  }
}

// Người mời chờ trả lời: 'accepted' | 'cancelled' (bị từ chối / người kia đã nhận lời người khác) | 'timeout' | 'aborted'.
// aborted(): người mời tự huỷ (bấm Huỷ lời mời)
export async function waitAccepted(id, aborted = () => false) {
  const until = Date.now() + INVITE_TIMEOUT;
  for (;;) {
    if (aborted()) {
      await cancelTrade(id);
      return 'aborted';
    }
    try {
      const row = await readRow(id);
      if (row?.status === 'cancelled') return 'cancelled';
      if (row?.accepted && row.status === 'open') return 'accepted';
    } catch {
      // mất mạng chốc lát: thử lại
    }
    if (Date.now() > until) {
      await cancelTrade(id);
      return 'timeout';
    }
    await new Promise((r) => setTimeout(r, 800));
  }
}

// ---------- Phiên giao dịch ----------

// Nhìn dòng giao dịch từ phía mình
export function sideOf(row, meId) {
  const isA = row.a === meId;
  return {
    id: row.id,
    status: row.status,
    cancelReason: row.cancel_reason ?? null, // lý do huỷ (máy chủ hoặc bên huỷ ghi), hiện cho cả hai bên
    partnerName: (isA ? row.b_name : row.a_name) || 'Người chơi',
    mine: isA ? row.offer_a : row.offer_b,
    theirs: isA ? row.offer_b : row.offer_a,
    myReady: isA ? row.ready_a : row.ready_b,
    theirReady: isA ? row.ready_b : row.ready_a,
    myConfirm: isA ? row.confirm_a : row.confirm_b,
    theirConfirm: isA ? row.confirm_b : row.confirm_a,
  };
}

// onUpdate(view): mỗi lần đọc được dòng giao dịch (view = sideOf(...)); onError(text): mất kết nối...
export class TradeSession {
  constructor(id, meId, { onUpdate = () => {}, onError = () => {} } = {}) {
    this.id = id;
    this.meId = meId;
    this.onUpdate = onUpdate;
    this.onError = onError;
    // Kênh riêng tư: chỉ hai người trong giao dịch vào được (supabase/realtime.sql)
    this.channel = supabase.channel(`trade-${id}`, { config: { private: true, broadcast: { self: false } } });
    this.channel.on('broadcast', { event: 'ping' }, () => this.refresh()).subscribe();
    this.timer = setInterval(() => this.refresh(), POLL_MS);
    this.refresh();
  }

  async refresh() {
    if (this.closed) return;
    try {
      const row = await readRow(this.id);
      if (!this.closed && row) this.onUpdate(sideOf(row, this.meId));
    } catch (err) {
      if (!this.closed) this.onError(errorText(err));
    }
  }

  ping() {
    this.channel.send({ type: 'broadcast', event: 'ping', payload: {} }).catch(() => {});
    this.refresh();
  }

  async call(name, args) {
    const res = await rpc(name, { p_id: this.id, ...args });
    this.ping();
    return res;
  }

  setOffer(offer) {
    return this.call('trade_set_offer', { p_offer: offer });
  }

  // Bước 1: Đồng ý với đề nghị của bên kia đúng như đang thấy. data: 'ok', hoặc 'cancelled' (máy chủ huỷ vì mình không
  // nhận hết được đồ của bên kia, lý do trong cancelReason)
  ready(seen) {
    return this.call('trade_ready', { p_seen: seen });
  }

  // Bước 2: Giao dịch. Gửi bản lưu mới nhất lên trước: máy chủ kiểm tra theo bản lưu trên mạng
  async confirm() {
    await upload();
    return this.call('trade_confirm', {});
  }

  cancel(reason = null) {
    return this.call('trade_cancel', { p_reason: reason });
  }

  close() {
    this.closed = true;
    clearInterval(this.timer);
    supabase.removeChannel(this.channel);
  }
}

// ---------- Nhận đồ của giao dịch đã chốt ----------

// Giao dịch đã chốt mà mình chưa nhận đồ (văng game giữa chừng...): [view] (xem sideOf)
export async function pendingTrades(meId) {
  try {
    const { data, error } = await supabase.from('trades').select('*').eq('status', 'done')
      .or(`and(a.eq.${meId},applied_a.eq.false),and(b.eq.${meId},applied_b.eq.false)`);
    if (error) throw error;
    return data.map((row) => sideOf(row, meId));
  } catch (err) {
    console.warn('Không tải được giao dịch đang chờ nhận:', err);
    return [];
  }
}

export const markApplied = (id) => rpc('trade_mark_applied', { p_id: id });
