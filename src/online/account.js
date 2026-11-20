import { supabase } from './supabase.js';

// Tài khoản (Supabase Auth): đăng ký bằng tên đăng nhập + email + mật khẩu, đăng nhập bằng tên đăng nhập + mật khẩu
// (supabase/usernames.sql), quên mật khẩu bằng email. Mọi hàm trả về { error } với câu báo tiếng Việt,
// hoặc dữ liệu khi thành công

export const PASSWORD_MIN = 6; // Supabase mặc định yêu cầu ít nhất 6 ký tự

// Link trong email (xác nhận, đặt lại mật khẩu) mở lại đúng trang game này
const backHere = () => `${location.origin}${location.pathname}`;

const MESSAGES = {
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  email_not_confirmed: 'Email chưa được xác nhận. Hãy bấm link trong email Supabase gửi cho bạn.',
  user_already_exists: 'Email này đã đăng ký. Hãy đăng nhập.',
  email_exists: 'Email này đã đăng ký. Hãy đăng nhập.',
  weak_password: `Mật khẩu quá yếu (ít nhất ${PASSWORD_MIN} ký tự).`,
  same_password: 'Mật khẩu mới phải khác mật khẩu cũ.',
  email_address_invalid: 'Email không hợp lệ.',
  validation_failed: 'Email hoặc mật khẩu không hợp lệ.',
  over_email_send_rate_limit: 'Đã gửi quá nhiều email. Hãy đợi một lúc rồi thử lại.',
  // Chưa cài SMTP riêng: Supabase chỉ gửi tới email thành viên của dự án
  email_address_not_authorized: 'Máy chủ chưa gửi được email tới địa chỉ này. Hãy báo người quản lý game.',
  over_request_rate_limit: 'Thao tác quá nhanh. Hãy đợi một lúc rồi thử lại.',
  otp_expired: 'Link trong email đã hết hạn hoặc đã dùng rồi.',
};

export function messageOf(error) {
  if (!error) return null;
  if (MESSAGES[error.code]) return MESSAGES[error.code];
  // Lỗi mạng thật (mất kết nối, không gọi được máy chủ): supabase-js báo status 0 / không có status
  if (!error.status) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  // Máy chủ trả lời nhưng báo lỗi (5xx, kể cả 504 khi gửi email quá lâu do SMTP cài sai): ghi kèm mã để dễ tra
  // trong Supabase → Logs → Auth
  if (error.status >= 500) return `Máy chủ đang gặp lỗi (mã ${error.status}). Thử lại sau ít phút.`;
  return `Có lỗi xảy ra: ${error.message ?? error}`;
}

// Kết quả của supabase-js -> { data } hoặc { error: câu báo }
async function call(promise) {
  try {
    const { data, error } = await promise;
    return error ? { error: messageOf(error), code: error.code, status: error.status } : { data };
  } catch (err) {
    return { error: messageOf(err) };
  }
}

// Người chơi đang đăng nhập (phiên lưu trên máy, tự gia hạn), hoặc null
export async function currentUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export const signIn = (email, password) => call(supabase.auth.signInWithPassword({ email, password }));

// Gọi hàm SQL (supabase/usernames.sql) -> { data } hoặc { error: câu báo }
async function rpc(fn, args) {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (!error) return { data };
    const msg = error.message ?? '';
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { error: 'Máy chủ chưa cài tên đăng nhập (người làm game chạy supabase/usernames.sql).' };
    }
    if (/^LOGIN_LOCKED/.test(msg)) return { error: 'Sai quá nhiều lần. Hãy thử lại sau 15 phút, hoặc bấm Quên mật khẩu.' };
    if (/^LOGIN_BUSY/.test(msg)) return { error: 'Máy chủ đang bận. Hãy thử lại sau ít phút.' };
    if (!error.code || /fetch|network/i.test(msg)) return { error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' };
    return { error: `Có lỗi xảy ra: ${msg}` };
  } catch {
    return { error: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.' };
  }
}

// Tên đăng nhập của người đang đăng nhập (cũng là tên nhân vật trong game), hoặc null. Đọc từ bảng profiles (máy chủ ghi
// khi đăng ký, người chơi không sửa được); không đọc được (mất mạng) thì dùng tên trong user_metadata
export async function fetchUsername(user) {
  try {
    const { data } = await supabase.from('profiles').select('username').eq('user_id', user.id).maybeSingle();
    if (data?.username) return data.username;
  } catch {
    // mất mạng: dùng tên dự phòng bên dưới
  }
  return user.user_metadata?.username ?? null;
}

// Tên đăng nhập còn trống không: { data: 'ok' | 'taken' | 'invalid' }
export const usernameAvailable = (name) => rpc('username_available', { p_name: name });

// Đăng nhập bằng tên đăng nhập: máy chủ kiểm tra tên + mật khẩu, đúng thì trả về email để đăng nhập Supabase bằng email.
// Trả thêm email (vd để gửi lại email xác nhận khi chưa xác nhận)
export async function signInWithUsername(name, password) {
  const found = await rpc('login_email', { p_name: name, p_password: password });
  if (found.error) return found;
  if (!found.data) return { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  return { ...(await signIn(found.data, password)), email: found.data };
}

// Đăng ký (kèm tên đăng nhập, máy chủ lưu vào bảng profiles). Bật "Confirm email" thì chưa có phiên: người chơi phải bấm
// link trong email. Email đã đăng ký và xác nhận rồi thì Supabase không báo lỗi (để người lạ không dò được email nào có
// tài khoản) mà trả về user không có identities
export async function signUp(email, password, username) {
  const res = await emailCall(supabase.auth.signUp({
    email, password, options: { emailRedirectTo: backHere(), data: { username } },
  }));
  if (res.data?.user && res.data.user.identities?.length === 0) return { error: MESSAGES.user_already_exists };
  // Lỗi 500: supabase-js không cho biết lý do. Có thể người khác vừa lấy mất tên (kiểm tra lại), hoặc lỗi gửi email
  if (res.status >= 500 && (await usernameAvailable(username)).data === 'taken') {
    return { error: 'Tên đăng nhập vừa có người dùng. Hãy chọn tên khác.' };
  }
  return res;
}

// Gửi email lỗi phía máy chủ (5xx): thường do SMTP (sai host / port / mật khẩu, hoặc chưa cài SMTP riêng)
const emailCall = async (promise) => {
  const res = await call(promise);
  if (res.status >= 500) res.error = `Chưa gửi được email (máy chủ báo lỗi ${res.status}). Thử lại sau ít phút.`;
  return res;
};

export const resendConfirmation = (email) => emailCall(supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: backHere() } }));

export const sendPasswordReset = (email) => emailCall(supabase.auth.resetPasswordForEmail(email, { redirectTo: backHere() }));

export const setNewPassword = (password) => call(supabase.auth.updateUser({ password }));

export const signOut = () => call(supabase.auth.signOut());

// Tab khác vừa đăng nhập (vd tab mở ra từ link xác nhận trong email): supabase-js báo qua BroadcastChannel, nhưng phiên
// đăng nhập thì không chép sang (nằm trong sessionStorage của tab kia), nên tab này chỉ báo chứ không vào game theo.
// Trả về hàm huỷ nghe
export function onSignedIn(fn) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) setTimeout(fn); // không gọi supabase ngay trong callback
  });
  return () => data.subscription.unsubscribe();
}
