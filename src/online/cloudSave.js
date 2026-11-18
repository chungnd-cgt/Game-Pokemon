import { blockSaves, onSaved, readSave, setSaveOwner, writeSave } from '../game/save.js';
import { supabase } from './supabase.js';

// Đồng bộ bản lưu với Supabase (bảng saves, supabase/schema.sql). Mỗi tài khoản 1 bản lưu.
//  - Game vẫn lưu vào máy y như cũ (game/save.js) sau mỗi lần lưu, nên tắt ngang / văng game / mất mạng vẫn còn tiến độ.
//  - Sau mỗi lần lưu: chờ vài giây rồi gửi bản mới nhất lên (lưu liên tục thì gộp lại); rời tab / tắt trang thì gửi ngay.
//  - Ghi nhớ trên máy: bản lưu trên máy dựa trên version nào của bản trên mạng, và có thay đổi chưa gửi không (dirty).
//    Mở game lần sau: còn thay đổi chưa gửi thì dùng bản trên máy rồi gửi lên; không thì dùng bản trên mạng.
//  - Ghi lên mạng kèm điều kiện version = version đã biết. Không khớp nghĩa là máy / tab khác vừa lưu tài khoản này:
//    thôi lưu ở đây (không ghi đè tiến độ của nơi kia), báo cho người chơi.

const UPLOAD_DELAY = 8000; // ms sau lần lưu đầu tiên thì gửi (các lần lưu trong lúc chờ gộp làm một)
const RETRY_DELAY = 30000; // lỗi mạng: thử lại sau chừng này
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

async function send(meta, data) {
  const row = { data, play_time: Math.floor(data.playTime ?? 0) };
  let result;
  try {
    result = meta.version === null
      ? await supabase.from('saves').insert({ user_id: uid, ...row }).select('version')
      : await supabase.from('saves').update(row).eq('user_id', uid).eq('version', meta.version).select('version');
  } catch (err) {
    result = { error: err };
  }
  const { data: rows, error } = result;
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
  if (changed) scheduleUpload();
}

function conflicted() {
  stopped = true;
  clearTimeout(timer);
  timer = null;
  blockSaves(CONFLICT_MESSAGE);
}

// Đăng xuất: gửi nốt bản lưu rồi thôi đồng bộ
export async function stopCloudSave() {
  await upload();
  stopped = true;
  uid = null;
}

// Game lưu xong vào máy -> đánh dấu chưa gửi, hẹn gửi
onSaved(() => {
  if (!uid || stopped) return;
  const meta = readMeta();
  if (!meta.dirty) writeMeta({ ...meta, dirty: true });
  scheduleUpload();
});

// Rời tab / thu nhỏ / tắt trang: gửi ngay (trình duyệt có thể không chờ xong; bản trên máy vẫn còn, lần sau gửi tiếp)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') upload();
});
window.addEventListener('pagehide', () => upload());
