import { blockSaves } from '../game/save.js';
import { abandonCloudSave } from './cloudSave.js';
import { supabase } from './supabase.js';

// Mỗi tài khoản chỉ chơi ở MỘT nơi cùng lúc (một thiết bị, một tab). Máy chủ: supabase/sessions.sql.
//  - Vào game: tab nhận một mã phiên mới (claim_session). Vừa đăng nhập bằng mật khẩu thì giành quyền khỏi mọi nơi khác
//    (và thu hồi phiên đăng nhập ở thiết bị khác). Tải lại trang / nhân bản tab (phiên đăng nhập còn trong sessionStorage,
//    nhân bản tab thì trình duyệt chép cả sessionStorage) thì chỉ giành được nếu tab này vẫn đang giữ quyền; không thì
//    phải đăng nhập lại.
//  - Tab khác trong cùng trình duyệt vừa nhận quyền: báo ngay qua BroadcastChannel. Thiết bị khác: kiểm tra mỗi POLL_MS,
//    mỗi khi quay lại tab, và máy chủ từ chối bản lưu gửi lên (cloudSave.js gọi sessionLost).
//  - Bị giành quyền: dừng game, bỏ bản lưu trên máy (đã cũ), xoá phiên đăng nhập của tab này, hiện bảng "Đăng nhập lại".

const CLAIM_KEY = 'pokemon-demo-claim'; // sessionStorage: mã phiên của tab này
const POLL_MS = 20000;
const MESSAGES = {
  tab: 'Game vừa được mở ở một tab khác. Tab này đã dừng để không ghi đè tiến độ.',
  device: 'Tài khoản vừa đăng nhập trên thiết bị khác. Mỗi tài khoản chỉ chơi được ở một nơi cùng lúc.',
};

let uid = null;
let claimId = null; // null: chưa nhận quyền / máy chủ chưa chạy sessions.sql (không kiểm tra)
let pollTimer = null;
let channel = null;
let lost = false;
let onLost = null;

const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};
const newId = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
const device = () => navigator.userAgent.slice(0, 120);

// Mã phiên gắn vào bản lưu gửi lên (cloudSave.js), hoặc null
export const sessionClaim = () => claimId;

// Nhận quyền chơi tài khoản ở tab này. fresh: vừa đăng nhập bằng mật khẩu. handlers.onLost(lý do) khi bị nơi khác giành.
// Trả về 'ok' | 'taken' (nơi khác đã đăng nhập sau: phải đăng nhập lại) | 'offline' (lỗi mạng: chơi tiếp, máy chủ chặn sau)
export async function claimSession(user, fresh, handlers = {}) {
  uid = user.id;
  onLost = handlers.onLost ?? null;
  const previous = fresh ? null : safe(() => sessionStorage.getItem(CLAIM_KEY));
  const id = newId();
  let res;
  try {
    res = await supabase.rpc('claim_session', { p_session: id, p_previous: previous, p_device: device() });
  } catch (err) {
    res = { error: err };
  }
  if (res.error) {
    // Chưa chạy supabase/sessions.sql trên máy chủ: bỏ qua tính năng này
    if (res.error.code === 'PGRST202' || res.error.code === '42883') return 'ok';
    console.warn('Không nhận được phiên chơi:', res.error);
    return 'offline';
  }
  if (res.data === 'taken') {
    forgetLogin();
    return 'taken';
  }
  claimId = id;
  lost = false;
  safe(() => sessionStorage.setItem(CLAIM_KEY, id));
  // Lần nhận trước bị từ chối (forgetLogin đã tắt tự gia hạn phiên) rồi vừa đăng nhập lại: bật lại
  safe(() => supabase.auth.startAutoRefresh().catch(() => {}));
  // Vừa đăng nhập bằng mật khẩu: thu hồi phiên đăng nhập ở các thiết bị khác (tab nhân bản dùng chung phiên với tab này
  // nên không bị ảnh hưởng; tab đó bị dừng qua BroadcastChannel)
  if (fresh) supabase.auth.signOut({ scope: 'others' }).catch(() => {});
  watch();
  return 'ok';
}

function watch() {
  channel?.close();
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('pokemon-demo-session') : null;
  if (channel) {
    channel.onmessage = (e) => {
      if (e.data?.uid === uid && e.data.id !== claimId) sessionLost('tab');
    };
    channel.postMessage({ uid, id: claimId });
  }
  clearInterval(pollTimer);
  pollTimer = setInterval(check, POLL_MS);
}

// Hỏi máy chủ mã phiên đang giữ quyền (lỗi mạng: thôi, lần sau hỏi lại)
async function check() {
  if (!claimId || lost) return;
  const { data, error } = await supabase.from('player_sessions').select('session_id').eq('user_id', uid).maybeSingle()
    .then((r) => r, (err) => ({ error: err }));
  if (!error && data && data.session_id !== claimId) sessionLost('device');
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') check();
});

// Xoá phiên đăng nhập của riêng tab này (không gọi máy chủ: tab nhân bản dùng chung phiên, thu hồi sẽ đăng xuất cả tab kia)
function forgetLogin() {
  safe(() => supabase.auth.stopAutoRefresh().catch(() => {}));
  safe(() => {
    sessionStorage.removeItem(CLAIM_KEY);
    for (const k of Object.keys(sessionStorage)) if (/^sb-.*-auth-token/.test(k)) sessionStorage.removeItem(k);
  });
}

// Nơi khác đã giành quyền chơi (reason: 'tab' | 'device')
export function sessionLost(reason = 'device') {
  if (lost || !uid) return;
  lost = true;
  clearInterval(pollTimer);
  channel?.close();
  channel = null;
  blockSaves(MESSAGES[reason]);
  abandonCloudSave(); // bản lưu trên máy đã cũ hơn nơi kia: bỏ, không gửi lên
  forgetLogin();
  onLost?.(reason);
  showLostPanel(MESSAGES[reason] ?? MESSAGES.device);
}

// Bảng che kín màn hình (HTML, nằm trên game): chỉ còn nút Đăng nhập lại (tải lại trang)
function showLostPanel(text) {
  const root = document.createElement('div');
  root.id = 'session-lost';
  root.setAttribute('role', 'alertdialog');
  root.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(8,12,24,0.82);font-family:Nunito,sans-serif;padding:16px;';
  const card = document.createElement('div');
  card.style.cssText = 'max-width:420px;width:100%;background:#1e2a44;border:2px solid #4a88e0;border-radius:16px;'
    + 'padding:22px;color:#e6e9f2;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.5);';
  const title = document.createElement('div');
  title.textContent = 'Đã dừng game';
  title.style.cssText = 'font-size:22px;font-weight:800;color:#ffe066;margin-bottom:10px;';
  const msg = document.createElement('div');
  msg.textContent = text;
  msg.style.cssText = 'font-size:16px;font-weight:700;line-height:1.45;margin-bottom:18px;';
  const btn = document.createElement('button');
  btn.textContent = 'Đăng nhập lại';
  btn.style.cssText = 'font:800 17px Nunito,sans-serif;padding:11px 26px;border:0;border-radius:10px;background:#40b060;'
    + 'color:#fff;cursor:pointer;';
  btn.onclick = () => location.reload();
  card.append(title, msg, btn);
  root.append(card);
  // Không cho phím / chuột lọt xuống game
  for (const type of ['keydown', 'keyup']) root.addEventListener(type, (e) => e.stopPropagation());
  document.body.append(root);
  btn.focus();
}
