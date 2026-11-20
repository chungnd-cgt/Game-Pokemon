import { blockSaves, onSaved, readSave, removeLocalSave, setSaveOwner, writeSave } from '../game/save.js';
import { sessionClaim, sessionLost } from './session.js';
import { supabase } from './supabase.js';

// Đồng bộ bản lưu với Supabase (bảng saves, supabase/schema.sql). Mỗi tài khoản 1 bản lưu.
//  - Game vẫn lưu vào máy y như cũ (game/save.js) sau mỗi lần lưu, nên tắt ngang / văng game / mất mạng vẫn còn tiến độ.
//  - Sau mỗi lần lưu: chờ UPLOAD_DELAY rồi gửi bản mới nhất lên (lưu liên tục thì gộp lại); rời tab / tắt trang / lưu lúc
//    tab đang ẩn thì gửi ngay.
//  - Thoát game (ẩn / đóng tab, đăng xuất) mà gửi lên xong thì xoá bản trên máy (trên mạng đã có đủ); gửi chưa được (mất
//    mạng) thì giữ lại, lần sau gửi tiếp.
//  - Bản lưu gửi lên mang mã phiên chơi (session.js): máy chủ chỉ nhận từ nơi đang giữ quyền chơi tài khoản.
//  - Ghi nhớ trên máy: bản lưu trên máy dựa trên version nào của bản trên mạng, và có thay đổi chưa gửi không (dirty).
//    Mở game lần sau: còn thay đổi chưa gửi thì dùng bản trên máy rồi gửi lên; không thì dùng bản trên mạng.
//  - Ghi lên mạng kèm điều kiện version = version đã biết. Không khớp nghĩa là máy / tab khác vừa lưu tài khoản này:
//    thôi lưu ở đây (không ghi đè tiến độ của nơi kia), báo cho người chơi.

const UPLOAD_DELAY = 30000; // ms sau lần lưu đầu tiên thì gửi (các lần lưu trong lúc chờ gộp làm một)
const RETRY_DELAY = 60000; // lỗi mạng: thử lại sau chừng này
const CONFLICT_MESSAGE = 'Tài khoản đang được chơi ở nơi khác, ở đây không lưu nữa. Tải lại trang để chơi tiếp.';

let uid = null;
let timer = null;
let uploading = null; // Promise lần gửi đang chạy
let stopped = false;

const META_KEY = () => `pokemon-demo-sync:${uid}`;
function readMeta() {
  try {
    return { version: null, dirty: false, ...JSON.parse(localStorage.getItem(META_KEY())) };
  } catch {
    return { version: null, dirty: false };
  }
}
function writeMeta(meta) {
  try {
    localStorage.setItem(META_KEY(), JSON.stringify(meta));
  } catch {
    // trình duyệt chặn localStorage
  }
}

// Bản lưu trên mạng { version, data } hoặc null (chưa có). Lỗi mạng thì ném lỗi
async function fetchCloud() {
  const { data, error } = await supabase.from('saves').select('version, data').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data;
}

// Bắt đầu phiên chơi của tài khoản: chọn bản lưu (trên máy hay trên mạng) và đặt làm bản lưu trên máy.
// Trả về { hasSave, offline }. offline: không lấy được bản trên mạng, đang chơi bằng bản trên máy (gửi lên sau)
export async function startCloudSave(user) {
  uid = user.id;
  stopped = false;
  setSaveOwner(uid);
  const local = readSave();
  const meta = readMeta();
  let cloud;
  try {
    cloud = await fetchCloud();
  } catch (err) {
    console.warn('Không tải được bản lưu trên mạng:', err);
    if (local) scheduleUpload(RETRY_DELAY);
    return { hasSave: Boolean(local), offline: true };
  }
  const cloudVersion = cloud?.version ?? null;
  // Bản trên máy có thay đổi chưa gửi (tắt ngang / văng game / mất mạng lần trước), hoặc chưa từng có bản trên mạng
  const localPending = local && (meta.dirty || !cloud);
  // Cả hai cùng đổi (chơi ở máy khác trong lúc máy này còn bản chưa gửi): lấy bản lưu sau cùng
  const useLocal = localPending && (cloudVersion === meta.version || !cloud || (local.savedAt ?? 0) >= (cloud.data?.savedAt ?? 0));
  if (useLocal) {
    writeMeta({ version: cloudVersion, dirty: true });
    scheduleUpload(0);
  } else if (cloud) {
    writeSave(cloud.data);
    writeMeta({ version: cloudVersion, dirty: false });
  } else {
    writeMeta({ version: null, dirty: false });
  }
  return { hasSave: Boolean(useLocal || cloud), offline: false };
}

// Đánh dấu bản trên máy có thay đổi chưa gửi (vd vừa chuyển bản lưu cũ vào tài khoản) và gửi ngay
export function markDirty() {
  if (!uid) return;
  writeMeta({ ...readMeta(), dirty: true });
  scheduleUpload(0);
}

function scheduleUpload(delay = UPLOAD_DELAY) {
  if (stopped || timer) return;
  timer = setTimeout(() => {
    timer = null;
    upload();
  }, delay);
}

// Gửi bản lưu trên máy lên mạng (nếu còn thay đổi chưa gửi). Trả về Promise xong khi gửi xong / thất bại
export function upload() {
  if (!uid || stopped) return Promise.resolve();
  if (uploading) return uploading.then(() => upload());
  clearTimeout(timer);
  timer = null;
  const meta = readMeta();
  const data = readSave();
  if (!meta.dirty || !data) return Promise.resolve();
  uploading = send(meta, data).finally(() => {
    uploading = null;
  });
  return uploading;
}

const hidden = () => document.visibilityState === 'hidden';

async function send(meta, data) {
  const claim = sessionClaim();
  const row = { data: claim ? { ...data, claim } : data, play_time: Math.floor(data.playTime ?? 0) };
  let result;
  try {
    result = meta.version === null
      ? await supabase.from('saves').insert({ user_id: uid, ...row }).select('version')
      : await supabase.from('saves').update(row).eq('user_id', uid).eq('version', meta.version).select('version');
  } catch (err) {
    result = { error: err };
  }
  const { data: rows, error } = result;
  // Nơi khác đã giành quyền chơi tài khoản (supabase/sessions.sql): dừng game ở đây
  if (/SESSION/.test(error?.message ?? '')) {
    sessionLost('device');
    return;
  }
  // 23505: trùng khoá chính, nơi khác vừa tạo bản lưu trước
  const conflict = error?.code === '23505' || (!error && rows.length === 0);
  if (conflict) {
    conflicted();
    return;
  }
  if (error) {
    console.warn('Chưa gửi được bản lưu lên mạng, sẽ thử lại:', error);
    scheduleUpload(RETRY_DELAY);
    return;
  }
  // Trong lúc gửi mà game lưu thêm thì bản trên máy đã khác bản vừa gửi: vẫn còn thay đổi chưa gửi
  const changed = readSave()?.savedAt !== data.savedAt;
  writeMeta({ version: rows[0].version, dirty: changed });
  if (changed) scheduleUpload(hidden() ? 0 : UPLOAD_DELAY);
  // Đang thoát game (tab ẩn / đóng) và trên mạng đã có bản mới nhất: xoá bản trên máy
  else if (hidden()) removeLocalSave();
}

function conflicted() {
  stopped = true;
  clearTimeout(timer);
  timer = null;
  blockSaves(CONFLICT_MESSAGE);
}

// Đăng xuất: gửi nốt bản lưu rồi thôi đồng bộ; gửi xong thì xoá bản trên máy
export async function stopCloudSave() {
  await upload();
  if (uid && !readMeta().dirty) removeLocalSave();
  stopped = true;
  uid = null;
}

// Nơi khác đã giành quyền chơi (session.js): thôi đồng bộ, bỏ bản trên máy (cũ hơn bản ở nơi kia, không gửi lên nữa)
export function abandonCloudSave() {
  if (!uid) return;
  stopped = true;
  clearTimeout(timer);
  timer = null;
  removeLocalSave();
  try {
    localStorage.removeItem(META_KEY());
  } catch {
    // trình duyệt chặn localStorage
  }
  uid = null;
}

// Game lưu xong vào máy -> đánh dấu chưa gửi, hẹn gửi. Lưu lúc tab đang ẩn (game lưu khi rời tab, sau phần gửi ở dưới):
// gửi ngay, vì tab ẩn thì trình duyệt (nhất là điện thoại) thường dừng hẳn bộ hẹn giờ
onSaved(() => {
  if (!uid || stopped) return;
  const meta = readMeta();
  if (!meta.dirty) writeMeta({ ...meta, dirty: true });
  if (hidden()) upload();
  else scheduleUpload();
});

// Rời tab / thu nhỏ / tắt trang: gửi ngay (trình duyệt có thể không chờ xong; bản trên máy vẫn còn, lần sau gửi tiếp)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') upload();
});
window.addEventListener('pagehide', () => upload());
