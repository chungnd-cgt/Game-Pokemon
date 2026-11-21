import { supabase } from './supabase.js';

// Thấy người chơi khác trên bản đồ: mỗi bản đồ một kênh Realtime 'map-<id>'.
//  - presence: ai đang ở bản đồ này (tên, giới tính, diện mạo, số huy hiệu, thời gian chơi, ngày bắt đầu, chỗ đứng)
//  - broadcast 'move': mỗi bước đi / quay mặt (nhanh, không đợi presence); đứng yên một lúc thì cập nhật chỗ đứng vào presence
//    để người vào sau thấy đúng chỗ
//  - broadcast 'trade-request': lời mời giao dịch gửi tới một người trong bản đồ (online/trade.js, scenes/worldTrade.js)
// me: { id, name, gender, look, badges, playTime, startedAt, status ('battle' | 'afk' | null), follower ({ s, sh } | null) }

// Tiết kiệm tin nhắn Realtime (gói miễn phí giới hạn số tin mỗi tháng / mỗi giây):
//  - đứng một mình trên bản đồ: không gửi tin bước đi; chỗ đứng chỉ cập nhật vào presence khi đứng yên lâu hơn
//  - có người khác: gom bước đi, mỗi MOVE_GAP ms gửi tối đa một tin gồm chỗ đứng mới nhất + path (các ô đã đi qua từ tin
//    trước); bên nhận đi lại đúng đường đó từng ô một (scenes/worldPlayers.js). Tin đầu tiên sau khi đứng yên cũng đợi
//    MOVE_GAP: các tin đến đều nhịp nên bên nhận đi liền mạch, không đi một bước rồi đứng chờ
const TRACK_DELAY = 800; // ms đứng yên rồi mới cập nhật chỗ đứng vào presence (có người khác)
const TRACK_DELAY_ALONE = 2500; // ... (một mình trên bản đồ)
const MOVE_GAP = 500; // ~2 tin/giây mỗi người đang đi (đi bộ ~2 ô, xe đạp / thú cưỡi ~5 ô mỗi tin)
const MAX_TRAIL = 16; // tối đa số ô trong path của một tin

export class MapPresence {
  // handlers: onPlayers([meta]) danh sách người khác trong bản đồ đổi; onMove(id, { x, y, facing }); onRequest({ id, from })
  constructor(me, handlers) {
    this.me = me;
    this.handlers = handlers;
    this.channel = null;
    this.mapId = null;
    this.pos = null;
    this.lastMove = -Infinity;
    this.moveTimer = null;
    this.trail = []; // các ô đã đi qua chưa gửi
    this.sentCell = null; // ô đã báo cho người khác lần cuối
  }

  meta() {
    const { id, name, gender, look, badges, playTime, startedAt, status, follower } = this.me;
    return { id, name, gender, look, badges, playTime, startedAt, status: status ?? null, follower: follower ?? null, ...this.pos };
  }

  // Vào bản đồ mapId ở chỗ pos ({ x, y, facing }). Rời kênh bản đồ cũ.
  // supabase-js trả lại kênh cũ nếu trùng tên (A -> B -> A thật nhanh): chờ kênh cũ đóng hẳn rồi mới mở kênh mới
  async enter(mapId, pos) {
    this.pos = { ...pos };
    this.trail = [];
    this.sentCell = { x: pos.x, y: pos.y };
    if (mapId === this.mapId && this.channel) {
      this.track();
      return;
    }
    this.leave();
    this.mapId = mapId;
    const token = (this.token ?? 0) + 1;
    this.token = token;
    await this.closing;
    if (this.token !== token || this.mapId !== mapId) return;
    // Kênh riêng tư: chỉ người đã đăng nhập vào được (supabase/realtime.sql)
    const ch = supabase.channel(`map-${mapId}`, { config: { private: true, presence: { key: this.me.id }, broadcast: { self: false } } });
    this.channel = ch;
    ch.on('presence', { event: 'sync' }, () => this.channel === ch && this.handlers.onPlayers(this.players()))
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        if (this.channel === ch && payload?.id && payload.id !== this.me.id) this.handlers.onMove(payload.id, payload);
      })
      .on('broadcast', { event: 'trade-request' }, ({ payload }) => {
        if (this.channel === ch && payload?.to === this.me.id && payload.id && payload.from?.id) this.handlers.onRequest(payload);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && this.channel === ch) ch.track(this.meta()).catch(() => {});
      });
  }

  // Người khác đang ở bản đồ này: [meta]
  players() {
    if (!this.channel) return [];
    return Object.entries(this.channel.presenceState())
      .filter(([key]) => key !== this.me.id)
      .map(([, metas]) => metas[metas.length - 1])
      .filter((m) => m?.id);
  }

  // Mình vừa bước / quay mặt / lên xuống xe, thú cưỡi. pos: { x, y, facing, vehicle, rideArt }
  move(pos) {
    this.pos = { ...pos };
    if (!this.channel) return;
    const alone = this.players().length === 0;
    clearTimeout(this.trackTimer);
    this.trackTimer = setTimeout(() => this.track(), alone ? TRACK_DELAY_ALONE : TRACK_DELAY);
    if (alone) {
      this.trail = [];
      this.sentCell = { x: pos.x, y: pos.y };
      return;
    }
    const last = this.trail.at(-1) ?? this.sentCell;
    if (!last || last.x !== pos.x || last.y !== pos.y) {
      this.trail.push({ x: pos.x, y: pos.y });
      if (this.trail.length > MAX_TRAIL) this.trail.shift();
    }
    // Gom bước đi: gửi ở cuối khoảng MOVE_GAP kể từ tin trước (đứng yên lâu rồi thì đợi trọn MOVE_GAP)
    const wait = this.lastMove + MOVE_GAP - performance.now();
    this.moveTimer ??= setTimeout(() => {
      this.moveTimer = null;
      this.sendMove();
    }, wait > 0 ? wait : MOVE_GAP);
  }

  sendMove() {
    if (!this.channel) return;
    this.lastMove = performance.now();
    // path: các ô đã đi qua trước chỗ đứng hiện tại ([[x, y], ...], không gồm chỗ đứng hiện tại)
    const path = this.trail.map((c) => [c.x, c.y]);
    const end = path.at(-1);
    if (end && end[0] === this.pos.x && end[1] === this.pos.y) path.pop();
    this.trail = [];
    this.sentCell = { x: this.pos.x, y: this.pos.y };
    this.channel.send({ type: 'broadcast', event: 'move', payload: { id: this.me.id, ...this.pos, path } }).catch(() => {});
  }

  // Đổi thông tin của mình (tên, diện mạo, số huy hiệu...)
  update(fields) {
    Object.assign(this.me, fields);
    this.track();
  }

  track() {
    this.channel?.track(this.meta()).catch(() => {});
  }

  sendRequest(to, id) {
    this.channel?.send({ type: 'broadcast', event: 'trade-request', payload: { to, id, from: this.meta() } }).catch(() => {});
  }

  // Rời bản đồ: đóng kênh (máy chủ tự báo mình rời đi cho người khác)
  leave() {
    clearTimeout(this.trackTimer);
    clearTimeout(this.moveTimer);
    this.moveTimer = null;
    this.trail = [];
    const ch = this.channel;
    this.channel = null;
    this.mapId = null;
    this.handlers.onPlayers([]);
    if (ch) this.closing = Promise.resolve(this.closing).then(() => supabase.removeChannel(ch)).catch(() => {});
  }
}
