import { supabase } from './supabase.js';

// Thấy người chơi khác trên bản đồ: mỗi bản đồ một kênh Realtime 'map-<id>'.
//  - presence: ai đang ở bản đồ này (tên, giới tính, diện mạo, số huy hiệu, thời gian chơi, ngày bắt đầu, chỗ đứng)
//  - broadcast 'move': mỗi bước đi / quay mặt (nhanh, không đợi presence); đứng yên một lúc thì cập nhật chỗ đứng vào presence
//    để người vào sau thấy đúng chỗ
//  - broadcast 'trade-request': lời mời giao dịch gửi tới một người trong bản đồ (online/trade.js, scenes/worldTrade.js)
// me: { id, name, gender, look, badges, playTime, startedAt }

// Tiết kiệm tin nhắn Realtime (gói miễn phí giới hạn số tin mỗi tháng / mỗi giây):
//  - đứng một mình trên bản đồ: không gửi tin bước đi; chỗ đứng chỉ cập nhật vào presence khi đứng yên lâu hơn
//  - có người khác: gom bước đi, mỗi MOVE_GAP ms gửi tối đa một tin (chỗ đứng mới nhất); bên nhận tự đi mượt qua các ô
const TRACK_DELAY = 800; // ms đứng yên rồi mới cập nhật chỗ đứng vào presence (có người khác)
const TRACK_DELAY_ALONE = 2500; // ... (một mình trên bản đồ)
const MOVE_GAP = 160;

export class MapPresence {
  // handlers: onPlayers([meta]) danh sách người khác trong bản đồ đổi; onMove(id, { x, y, facing }); onRequest({ id, from })
  constructor(me, handlers) {
    this.me = me;
    this.handlers = handlers;
    this.channel = null;
    this.mapId = null;
    this.pos = null;
    this.lastMove = 0;
    this.moveTimer = null;
  }

  meta() {
    const { id, name, gender, look, badges, playTime, startedAt } = this.me;
    return { id, name, gender, look, badges, playTime, startedAt, ...this.pos };
  }

  // Vào bản đồ mapId ở chỗ pos ({ x, y, facing }). Rời kênh bản đồ cũ.
  // supabase-js trả lại kênh cũ nếu trùng tên (A -> B -> A thật nhanh): chờ kênh cũ đóng hẳn rồi mới mở kênh mới
  async enter(mapId, pos) {
    this.pos = { ...pos };
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
    if (alone) return;
    // Gom bước đi: đã gửi trong MOVE_GAP ms vừa rồi thì hẹn gửi chỗ đứng mới nhất ở cuối khoảng đó
    const wait = this.lastMove + MOVE_GAP - performance.now();
    if (wait > 0) {
      this.moveTimer ??= setTimeout(() => {
        this.moveTimer = null;
        this.sendMove();
      }, wait);
      return;
    }
    this.sendMove();
  }

  sendMove() {
    if (!this.channel) return;
    this.lastMove = performance.now();
    this.channel.send({ type: 'broadcast', event: 'move', payload: { id: this.me.id, ...this.pos } }).catch(() => {});
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
    const ch = this.channel;
    this.channel = null;
    this.mapId = null;
    this.handlers.onPlayers([]);
    if (ch) this.closing = Promise.resolve(this.closing).then(() => supabase.removeChannel(ch)).catch(() => {});
  }
}
