import { supabase } from './supabase.js';

// Tài khoản: đăng ký / đăng nhập bằng email + mật khẩu (Supabase Auth). Mọi hàm trả về { error } với câu báo tiếng Việt,
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
  over_request_rate_limit: 'Thao tác quá nhanh. Hãy đợi một lúc rồi thử lại.',
  otp_expired: 'Link trong email đã hết hạn hoặc đã dùng rồi.',
};

export function messageOf(error) {
  if (!error) return null;
  if (MESSAGES[error.code]) return MESSAGES[error.code];
  // Lỗi mạng (mất kết nối, máy chủ không trả lời): supabase-js báo status 0 hoặc lỗi fetch
  if (!error.status || error.name === 'AuthRetryableFetchError' || /fetch|network/i.test(error.message ?? '')) {
    return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  }
  return `Có lỗi xảy ra: ${error.message ?? error}`;
}

// Kết quả của supabase-js -> { data } hoặc { error: câu báo }
async function call(promise) {
  try {
    const { data, error } = await promise;
    return error ? { error: messageOf(error), code: error.code } : { data };
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

// Đăng ký. Bật "Confirm email" thì chưa có phiên: người chơi phải bấm link trong email. Email đã đăng ký và xác nhận rồi
// thì Supabase không báo lỗi (để người lạ không dò được email nào có tài khoản) mà trả về user không có identities
export async function signUp(email, password) {
  const res = await call(supabase.auth.signUp({ email, password, options: { emailRedirectTo: backHere() } }));
  if (res.data?.user && res.data.user.identities?.length === 0) return { error: MESSAGES.user_already_exists };
  return res;
}

export const resendConfirmation = (email) => call(supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: backHere() } }));

export const sendPasswordReset = (email) => call(supabase.auth.resetPasswordForEmail(email, { redirectTo: backHere() }));

export const setNewPassword = (password) => call(supabase.auth.updateUser({ password }));

export const signOut = () => call(supabase.auth.signOut());

// Đăng nhập xong ở tab khác (vd bấm link xác nhận trong email mở ra tab mới): báo cho tab này. Trả về hàm huỷ nghe
export function onSignedIn(fn) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) setTimeout(() => fn(session.user)); // không gọi supabase ngay trong callback
  });
  return () => data.subscription.unsubscribe();
}
