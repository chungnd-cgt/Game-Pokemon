import { ITEMS, formatMoney } from '../data/items.js';
import { NATURES } from '../data/natures.js';
import { SPECIES } from '../data/monsters.js';
import { tradeEvolutionTarget } from '../game/evolution.js';
import { itemCount, state } from '../game/state.js';
import {
  TRADE_MAX_MONS, emptyOffer, itemTradeable, maxOfferMons, monTradeProblem, offerProblem, receiveProblem,
} from '../game/trade.js';
import { GBA_MON, pixelMon } from '../gfx/textures.js';
import { TradeSession } from '../online/trade.js';

// Giao diện giao dịch (HTML đè lên game như bảng đăng nhập: gõ số lượng / số tiền được, dùng tốt trên điện thoại).
// Mọi chữ đến từ người chơi khác (tên, tên Pokémon) gán bằng textContent, không chèn HTML.
//  TradeRequests: popup lời mời giao dịch (Đồng ý / Từ chối), câu báo ngắn, "Đang chờ ... đồng ý"
//  TradePanel: bảng giao dịch hai cột (bạn đưa / bên kia đưa): cả hai Đồng ý rồi cả hai Giao dịch thì máy chủ chốt

const CSS = `
.tp-root { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 12px;
  background: transparent; pointer-events: none; font-family: Nunito, 'Segoe UI', sans-serif; color: #e6e9f2; }
/* Bảng nổi lên trên, không phủ tối cả màn hình: giao diện bản đồ (đội hình, cột nút, đồng hồ...) vẫn thấy xung quanh */
.tp-card { pointer-events: auto; width: min(860px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; padding: 18px 20px;
  background: #1e2a44; border: 3px solid #4a88e0; border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.5); }
.tp-card.small { width: min(520px, 100%); }
.tp-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.tp-head h2 { flex: 1; margin: 0; font-size: 24px; font-weight: 800; color: #ffe066; }
.tp-x { border: 0; background: #3a4a6c; color: #fff; width: 34px; height: 34px; border-radius: 50%; font: 800 18px Nunito, sans-serif; cursor: pointer; }
.tp-sub { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #a8b4d0; }
.tp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 720px) { .tp-cols { grid-template-columns: 1fr; } }
.tp-col { background: #141c30; border-radius: 14px; padding: 12px; min-width: 0; }
.tp-col h3 { margin: 0 0 8px; font-size: 18px; font-weight: 800; display: flex; justify-content: space-between; gap: 8px; }
.tp-col h3 .ok { color: #7ee08e; font-size: 14px; }
.tp-col h3 .wait { color: #a8b4d0; font-size: 14px; }
.tp-label { margin: 12px 0 6px; font-size: 13px; font-weight: 800; color: #c8d2ea; text-transform: uppercase; letter-spacing: .03em; }
.tp-mons { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.tp-mon { position: relative; display: flex; flex-direction: column; align-items: center; padding: 6px 4px; border-radius: 10px;
  background: #22304e; border: 2px solid transparent; cursor: pointer; text-align: center; min-width: 0; }
.tp-mon.static { cursor: default; }
.tp-mon.on { border-color: #ffd860; background: #3a3a22; }
.tp-mon.off { opacity: .4; cursor: not-allowed; }
.tp-mon img { width: 56px; height: 56px; image-rendering: pixelated; }
.tp-mon .n { font-size: 13px; font-weight: 800; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-mon .d { font-size: 11px; font-weight: 700; color: #a8b4d0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-mon .evo { font-size: 11px; font-weight: 800; color: #ffd860; }
.tp-mon .star { position: absolute; top: 3px; left: 6px; color: #ffd860; font-size: 13px; }
.tp-empty { font-size: 14px; color: #6a7896; font-weight: 700; padding: 4px 0; }
.tp-items { display: flex; flex-direction: column; gap: 4px; }
.tp-item { display: flex; align-items: center; gap: 6px; background: #22304e; border-radius: 8px; padding: 4px 8px; font-size: 14px; font-weight: 700; }
.tp-item img { width: 24px; height: 24px; image-rendering: pixelated; }
.tp-item .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-item button, .tp-add button { border: 0; border-radius: 6px; background: #3a4a6c; color: #fff; font: 800 14px Nunito, sans-serif;
  min-width: 26px; height: 26px; cursor: pointer; }
.tp-add { display: flex; gap: 6px; margin-top: 6px; }
.tp-add select, .tp-add input, .tp-money input { min-width: 0; box-sizing: border-box; border: 2px solid #3a4a6c; border-radius: 8px;
  background: #f6f8fc; color: #1e2a44; font: 700 14px Nunito, sans-serif; padding: 4px 6px; }
.tp-add select { flex: 1; }
.tp-add input { width: 64px; }
.tp-money { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #a8b4d0; }
.tp-money input { width: 140px; }
.tp-foot { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.tp-msg { flex: 1; min-width: 200px; font-size: 14px; font-weight: 700; color: #ffb4b4; }
.tp-msg.info { color: #b4c8f0; }
.tp-btn { border: 0; border-radius: 12px; padding: 11px 18px; font: 800 17px Nunito, sans-serif; color: #fff; cursor: pointer; }
.tp-btn.go { background: #40b060; box-shadow: 0 3px 0 #2a7a40; }
.tp-btn.no { background: #c84848; box-shadow: 0 3px 0 #8a2a2a; }
.tp-btn.gray { background: #3a4a6c; }
.tp-btn:disabled { opacity: .5; cursor: default; }
.tp-col { transition: background .2s, box-shadow .2s; }
.tp-col.ready { background: #17402a; box-shadow: inset 0 0 0 2px #5fd068; }
.tp-col.ready h3 .ok { color: #9ff0aa; }
.tp-btn.trade { background: #e8a020; box-shadow: 0 3px 0 #9a6410; }
.tp-reqs { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 45; width: min(440px, calc(100vw - 24px));
  display: flex; flex-direction: column; gap: 8px; font-family: Nunito, 'Segoe UI', sans-serif; pointer-events: none; }
.tp-req { pointer-events: auto; background: #1e2a44; color: #e6e9f2; border: 2px solid #ffd860; border-radius: 12px;
  padding: 10px 12px; box-shadow: 0 6px 18px rgba(0,0,0,.45); font-size: 15px; font-weight: 700; }
.tp-req.note { border-color: #e86060; }
.tp-req.wait { border-color: #4a88e0; }
.tp-req .row { display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end; }
.tp-req .tp-btn { padding: 7px 14px; font-size: 15px; }
`;

// Tạo phần tử: el('div', { class: 'x', text: '...', onclick }, [con...])
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'text') node.textContent = v;
    else if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c) node.appendChild(c);
  return node;
}

function ensureCss() {
  if (document.getElementById('trade-css')) return;
  document.head.appendChild(el('style', { id: 'trade-css', text: CSS }));
}

// Lớp phủ toàn màn hình; phím gõ trong bảng không lọt xuống game
function overlay() {
  ensureCss();
  const root = el('div', { class: 'tp-root' });
  for (const type of ['keydown', 'keyup', 'keypress']) root.addEventListener(type, (e) => e.stopPropagation());
  document.body.appendChild(root);
  return root;
}

// Ảnh Pokémon / vật phẩm từ texture của game (data URL), nhớ lại để không vẽ lại mỗi lần
const imageCache = new Map();
function textureUrl(scene, key) {
  if (!key || key === '__DEFAULT' || !scene.textures.exists(key)) return '';
  if (!imageCache.has(key)) imageCache.set(key, scene.textures.getBase64(key));
  return imageCache.get(key);
}
const monUrl = (scene, mon) => textureUrl(scene, pixelMon(scene, mon.speciesId, '', GBA_MON, Boolean(mon.shiny)));
const itemUrl = (scene, id) => textureUrl(scene, ITEMS[id]?.icon);

// Thẻ Pokémon: hình, tên, cấp, loài (nếu đặt biệt danh), đồ cầm, tính cách; báo sẽ tiến hoá khi trao đổi
function monCard(scene, mon, { onclick, on = false, off = false, title = null, showEvo = false } = {}) {
  const species = SPECIES[mon.speciesId];
  const detail = [species && mon.name !== species.name ? species.name : null, NATURES[mon.nature]?.name, ITEMS[mon.heldItem]?.name]
    .filter(Boolean).join(' • ');
  const evo = showEvo ? tradeEvolutionTarget(mon) : null;
  return el('div', { class: `tp-mon${on ? ' on' : ''}${off ? ' off' : ''}${onclick ? '' : ' static'}`, title, onclick }, [
    mon.shiny ? el('span', { class: 'star', text: '★' }) : null,
    el('img', { src: monUrl(scene, mon), alt: '' }),
    el('div', { class: 'n', text: `${mon.name} Lv${mon.level}` }),
    detail ? el('div', { class: 'd', text: detail }) : null,
    evo ? el('div', { class: 'evo', text: `Sẽ tiến hoá thành ${SPECIES[evo]?.name ?? evo}!` }) : null,
  ]);
}

// ---------- Lời mời giao dịch (popup nhỏ trên cùng màn hình) ----------

// Nhiều lời mời cùng lúc thì xếp chồng; mỗi lời mời tự biến mất sau timeout. Cũng hiện câu báo ngắn và "Đang chờ ... đồng ý".
export class TradeRequests {
  constructor() {
    ensureCss();
    this.root = el('div', { class: 'tp-reqs' });
    for (const type of ['keydown', 'keyup', 'keypress']) this.root.addEventListener(type, (e) => e.stopPropagation());
    document.body.appendChild(this.root);
  }

  // Lời mời từ from ({ name, badges }). onAccept() trả về true thì đóng popup (false: giữ lại, vd đang bận); onDecline()
  add(from, { onAccept, onDecline, timeout }) {
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      box.remove();
    };
    const box = el('div', { class: 'tp-req' }, [
      el('div', { text: `${from.name || 'Một người chơi'} muốn giao dịch với bạn.` }),
      el('div', { class: 'row' }, [
        el('button', { class: 'tp-btn no', text: 'Từ chối', onclick: () => { close(); onDecline(); } }),
        el('button', { class: 'tp-btn go', text: 'Đồng ý', onclick: async () => { if (await onAccept()) close(); } }),
      ]),
    ]);
    const timer = setTimeout(() => {
      close();
      onDecline(true);
    }, timeout);
    this.root.appendChild(box);
    return close;
  }

  // Câu báo ngắn (tự tắt)
  note(text, ms = 3500) {
    const box = el('div', { class: 'tp-req note', text });
    this.root.appendChild(box);
    setTimeout(() => box.remove(), ms);
  }

  // "Đang chờ X đồng ý…" kèm nút Huỷ lời mời. Trả về hàm đóng
  waiting(text, onCancel) {
    const box = el('div', { class: 'tp-req wait' }, [
      el('div', { text }),
      el('div', { class: 'row' }, [el('button', { class: 'tp-btn gray', text: 'Huỷ lời mời', onclick: () => onCancel() })]),
    ]);
    this.root.appendChild(box);
    return () => box.remove();
  }

  destroy() {
    this.root.remove();
  }
}

// ---------- Bảng giao dịch ----------

// Hai bước: mỗi bên bấm Đồng ý (cột của bên đó chuyển xanh lá); cả hai đã Đồng ý thì nút đổi thành Giao dịch, cả hai bấm
// Giao dịch thì chốt. Ai đổi đề nghị thì cả hai phải Đồng ý lại. Huỷ giữa chừng không ai mất gì.
// open() trả về { status: 'done', view } (đã chốt, view: đề nghị hai bên do máy chủ trả về) hoặc { status: 'cancelled', reason }
export class TradePanel {
  constructor(scene, { id, meId, partner }) {
    this.scene = scene;
    this.id = id;
    this.meId = meId;
    this.partner = partner;
    this.offer = emptyOffer();
    this.view = null;
    this.message = '';
    this.sending = false; // đề nghị của mình đang chờ gửi lên máy chủ
    this.theirsKey = '';
  }

  open() {
    this.root = overlay();
    this.card = el('div', { class: 'tp-card' });
    this.root.appendChild(this.card);
    this.build();
    this.session = new TradeSession(this.id, this.meId, {
      onUpdate: (view) => this.update(view),
      onError: (text) => this.say(text),
    });
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  finish(result) {
    if (this.done) return;
    this.done = true;
    clearTimeout(this.sendTimer);
    this.session.close();
    this.root.remove();
    this.resolve(result);
  }

  async cancel() {
    if (this.done) return;
    this.cancelling = true;
    await this.session.cancel();
    this.finish({ status: 'cancelled', reason: 'Đã huỷ giao dịch.' });
  }

  say(text, info = false) {
    this.message = text ?? '';
    this.msgEl.textContent = this.message;
    this.msgEl.className = `tp-msg${info ? ' info' : ''}`;
  }

  build() {
    this.mineCol = el('div', { class: 'tp-col' });
    this.theirsCol = el('div', { class: 'tp-col' });
    this.msgEl = el('div', { class: 'tp-msg' });
    this.confirmBtn = el('button', { class: 'tp-btn go', text: 'Đồng ý', onclick: () => this.confirm() });
    this.card.replaceChildren(
      el('div', { class: 'tp-head' }, [
        el('h2', { text: `Giao dịch với ${this.partner.name || 'người chơi'}` }),
        el('button', { class: 'tp-x', text: '✕', title: 'Huỷ giao dịch', onclick: () => this.cancel() }),
      ]),
      el('p', { class: 'tp-sub', text: `Chọn Pokémon (tối đa ${TRADE_MAX_MONS}, chừa lại ít nhất 1 con), vật phẩm và tiền muốn đưa. `
        + 'Xong thì bấm Đồng ý; cả hai đã Đồng ý thì bấm Giao dịch để chốt. Đổi gì thì cả hai phải Đồng ý lại. '
        + 'Pokémon huyền thoại và vật phẩm quan trọng không giao dịch được.' }),
      el('div', { class: 'tp-cols' }, [this.mineCol, this.theirsCol]),
      el('div', { class: 'tp-foot' }, [
        this.msgEl,
        el('button', { class: 'tp-btn no', text: 'Huỷ giao dịch', onclick: () => this.cancel() }),
        this.confirmBtn,
      ]),
    );
    this.renderMine();
    this.renderTheirs();
  }

  // ---------- Đề nghị của mình ----------

  changed() {
    this.sending = true;
    this.renderMine();
    this.renderButtons();
    clearTimeout(this.sendTimer);
    this.sendTimer = setTimeout(() => this.send(), 350);
  }

  async send() {
    const offer = { mons: this.offer.mons, items: this.offer.items, money: this.offer.money };
    const res = await this.session.setOffer(offer);
    if (this.done) return;
    this.sending = false;
    if (res.error) this.say(res.error);
    this.renderButtons();
  }

  toggleMon(mon) {
    const i = this.offer.mons.findIndex((m) => m.uid === mon.uid);
    if (i >= 0) this.offer.mons.splice(i, 1);
    else if (this.offer.mons.length >= maxOfferMons()) {
      return this.say(state.party.length <= 1 ? 'Phải chừa lại ít nhất 1 Pokémon trong đội.'
        : `Đưa tối đa ${maxOfferMons()} Pokémon (chừa lại ít nhất 1 con trong đội).`);
    } else this.offer.mons.push(structuredClone(mon));
    this.say('');
    this.changed();
  }

  setItem(id, qty) {
    const n = Math.max(0, Math.min(itemCount(id), Math.floor(qty)));
    if (n > 0) this.offer.items[id] = n;
    else delete this.offer.items[id];
    this.changed();
  }

  renderMine() {
    const chosen = new Set(this.offer.mons.map((m) => m.uid));
    const full = this.offer.mons.length >= maxOfferMons();
    const mons = state.party.map((mon) => {
      const problem = monTradeProblem(mon);
      const on = chosen.has(mon.uid);
      return monCard(this.scene, mon, {
        on, off: Boolean(problem) || (!on && full), title: problem ?? (on ? 'Bấm để bỏ' : 'Bấm để đưa'),
        onclick: problem ? null : () => this.toggleMon(mon),
      });
    });

    const items = Object.entries(this.offer.items).map(([id, qty]) => el('div', { class: 'tp-item' }, [
      el('img', { src: itemUrl(this.scene, id), alt: '' }),
      el('span', { class: 'nm', text: `${ITEMS[id].name} ×${qty}` }),
      el('button', { text: '−', title: 'Bớt 1', onclick: () => this.setItem(id, qty - 1) }),
      el('button', { text: '+', title: 'Thêm 1', onclick: () => this.setItem(id, qty + 1) }),
      el('button', { text: '✕', title: 'Bỏ', onclick: () => this.setItem(id, 0) }),
    ]));
    const choices = Object.keys(state.bag)
      .filter((id) => itemTradeable(id) && itemCount(id) > (this.offer.items[id] ?? 0))
      .sort((a, b) => ITEMS[a].name.localeCompare(ITEMS[b].name, 'vi'));
    const select = el('select', { 'aria-label': 'Vật phẩm' }, choices.map((id) => el('option', {
      value: id, text: `${ITEMS[id].name} (có ${itemCount(id) - (this.offer.items[id] ?? 0)})`,
    })));
    const qty = el('input', { type: 'number', min: 1, value: 1, 'aria-label': 'Số lượng' });
    const add = el('div', { class: 'tp-add' }, choices.length ? [
      select, qty,
      el('button', {
        text: 'Thêm', style: 'padding: 0 10px',
        onclick: () => this.setItem(select.value, (this.offer.items[select.value] ?? 0) + (Number(qty.value) || 1)),
      }),
    ] : [el('div', { class: 'tp-empty', text: 'Không còn vật phẩm nào đưa được.' })]);

    const money = el('input', { type: 'number', min: 0, max: state.money, step: 100, value: this.offer.money, 'aria-label': 'Số tiền' });
    money.addEventListener('change', () => {
      const v = Math.max(0, Math.min(state.money, Math.floor(Number(money.value) || 0)));
      money.value = v;
      if (v !== this.offer.money) {
        this.offer.money = v;
        this.changed();
      }
    });

    const status = statusChip(this.view?.myReady, this.view?.myConfirm);
    this.mineCol.classList.toggle('ready', Boolean(this.view?.myReady));
    this.mineCol.replaceChildren(
      el('h3', {}, [el('span', { text: 'Bạn đưa' }), status]),
      el('div', { class: 'tp-label', text: `Pokémon trong đội (${this.offer.mons.length}/${maxOfferMons()})` }),
      el('div', { class: 'tp-mons' }, mons),
      el('div', { class: 'tp-label', text: 'Vật phẩm' }),
      el('div', { class: 'tp-items' }, items.length ? items : [el('div', { class: 'tp-empty', text: 'Chưa có' })]),
      add,
      el('div', { class: 'tp-label', text: 'Tiền' }),
      el('div', { class: 'tp-money' }, [money, el('span', { text: `₽ (có ${formatMoney(state.money)})` })]),
    );
  }

  // ---------- Đề nghị của bên kia ----------

  renderTheirs() {
    const theirs = this.view?.theirs ?? emptyOffer();
    const name = this.view?.partnerName ?? this.partner.name ?? 'Người chơi';
    const status = statusChip(this.view?.theirReady, this.view?.theirConfirm);
    this.theirsCol.classList.toggle('ready', Boolean(this.view?.theirReady));
    const items = Object.entries(theirs.items ?? {}).filter(([id]) => ITEMS[id]).map(([id, qty]) => el('div', { class: 'tp-item' }, [
      el('img', { src: itemUrl(this.scene, id), alt: '' }),
      el('span', { class: 'nm', text: `${ITEMS[id].name} ×${qty}` }),
    ]));
    const mons = (theirs.mons ?? []).filter((m) => SPECIES[m.speciesId]).map((m) => monCard(this.scene, m, { showEvo: true }));
    this.theirsCol.replaceChildren(
      el('h3', {}, [el('span', { text: `${name} đưa` }), status]),
      el('div', { class: 'tp-label', text: `Pokémon (${mons.length})` }),
      el('div', { class: 'tp-mons' }, mons.length ? mons : [el('div', { class: 'tp-empty', text: 'Chưa có' })]),
      el('div', { class: 'tp-label', text: 'Vật phẩm' }),
      el('div', { class: 'tp-items' }, items.length ? items : [el('div', { class: 'tp-empty', text: 'Chưa có' })]),
      el('div', { class: 'tp-label', text: 'Tiền' }),
      el('div', { class: 'tp-money', text: formatMoney(theirs.money ?? 0) }),
    );
  }

  // Nút chính: Đồng ý (bước 1) -> chờ bên kia Đồng ý -> Giao dịch (bước 2) -> chờ bên kia Giao dịch
  renderButtons() {
    const v = this.view;
    const btn = this.confirmBtn;
    const both = v?.myReady && v?.theirReady;
    btn.className = `tp-btn ${both ? 'trade' : 'go'}`;
    let text = both ? 'Giao dịch' : 'Đồng ý';
    let enabled = Boolean(v && v.status === 'open' && !this.sending && !this.busyCall);
    if (this.busyCall) text = 'Đang gửi…';
    else if (v?.myReady && !v.theirReady) {
      text = `Chờ ${v.partnerName} đồng ý…`;
      enabled = false;
    } else if (both && v.myConfirm) {
      text = `Chờ ${v.partnerName} giao dịch…`;
      enabled = false;
    }
    btn.textContent = text;
    btn.disabled = !enabled;
  }

  update(view) {
    if (this.done) return;
    if (view.status === 'done') return this.finish({ status: 'done', view });
    if (view.status === 'cancelled') {
      return this.finish({ status: 'cancelled', reason: this.cancelling ? 'Đã huỷ giao dịch.' : `${view.partnerName} đã huỷ giao dịch.` });
    }
    const flags = `${view.myReady}|${view.theirReady}|${view.myConfirm}|${view.theirConfirm}`;
    const flagsChanged = flags !== this.flags;
    this.flags = flags;
    this.view = view;
    const key = JSON.stringify(view.theirs);
    if (key !== this.theirsKey || flagsChanged) {
      // Bên kia đổi đề nghị: báo để người chơi xem lại trước khi đồng ý
      if (this.theirsKey && key !== this.theirsKey) this.say(`${view.partnerName} vừa đổi đề nghị, hãy xem lại.`, true);
      this.theirsKey = key;
      this.renderTheirs();
      if (flagsChanged) this.renderMine();
    }
    this.renderButtons();
  }

  async confirm() {
    const v = this.view;
    if (!v) return;
    const both = v.myReady && v.theirReady;
    if (!both) {
      // Bước 1: Đồng ý với đề nghị bên kia đang thấy
      const problem = offerProblem(this.offer) ?? receiveProblem(this.offer, v.theirs);
      if (problem) return this.say(problem);
    }
    this.busyCall = true;
    this.renderButtons();
    const res = both ? await this.session.confirm() : await this.session.ready(v.theirs);
    this.busyCall = false;
    if (this.done) return;
    if (res.error) this.say(res.error);
    else if (!both) this.say(`Đã đồng ý. Chờ ${v.partnerName} đồng ý…`, true);
    else if (res.data !== 'done') this.say(`Chờ ${v.partnerName} bấm Giao dịch…`, true);
    this.renderButtons();
  }
}

// Nhãn trạng thái trên đầu mỗi cột
function statusChip(ready, confirmed) {
  if (confirmed) return el('span', { class: 'ok', text: '✓ Đã bấm Giao dịch' });
  if (ready) return el('span', { class: 'ok', text: '✓ Đã đồng ý' });
  return el('span', { class: 'wait', text: 'Đang chọn…' });
}
