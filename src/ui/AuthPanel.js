import {
  EMAIL_BLOCKED, emailAllowed, onSignedIn, PASSWORD_MIN, resendConfirmation, sendPasswordReset, setNewPassword,
  signInWithEmail, signInWithUsername, signOut, signUp, usernameAvailable, verifyEmailCode,
} from '../online/account.js';
import { maskEmail, sendDeviceCode, verifyDeviceCode } from '../online/device.js';
import PKG from '../../package.json' with { type: 'json' };
import { lastLogin, setLastLogin } from '../online/supabase.js';
import { capitalizeFirst, checkUsername, stripPictographs } from '../online/username.js';

// Màn đăng nhập / đăng ký / quên mật khẩu / đặt mật khẩu mới: một màn riêng che kín game (HTML, không vẽ trong Phaser, để
// gõ được tiếng Việt, trình duyệt gợi ý lưu mật khẩu và bàn phím điện thoại hiện đúng kiểu). Phím gõ không lọt xuống game.
//  Góc trên trái: phiên bản (package.json) • giữa: logo canh giữa (ảnh riêng trong src/assets/login/, xem README ở đó) •
//  khung nhập (nền mờ kính, thấy ảnh nền phía sau) •
//  hai nút ngay dưới khung • góc dưới phải: nút Cài đặt (mở đúng bảng Cài đặt trong game: opts.onSettings, TitleScene).
//  open(): trả về user khi đã đăng nhập xong • openNewPassword(): tab mở ra từ link "đặt lại mật khẩu" trong email
// Đăng ký: tên đăng nhập + email + mật khẩu (2 lần). Đăng nhập: tên đăng nhập + mật khẩu. Quên mật khẩu: email.
// Quy tắc tên đăng nhập: online/username.js (máy chủ kiểm tra lại và chống trùng: supabase/usernames.sql)
// Đăng ký, Quên mật khẩu và thiết bị lạ dùng MÃ 6 số trong email (mẫu email: supabase/email-templates/), nhập ngay trong
//  tab đang chơi: 'sent' (xác nhận đăng ký, đúng mã thì vào game), 'resetSent' (đúng mã thì sang 'newPassword'), 'device'.
//  Link trong email kiểu cũ (email gửi trước khi đổi mẫu) vẫn chạy: mở game ở tab mới, tab cũ chỉ báo "đã đăng nhập ở tab
//  khác" (openNewPassword: tab mở ra từ link đặt lại mật khẩu).

// Ảnh riêng cho màn này: src/assets/login/logo.*, background.* (png / jpg / webp / gif / svg). Thiếu ảnh nào thì
// dùng mặc định: logo chữ, nền xanh như màn hình chính
const FILES = import.meta.glob('../assets/login/{logo,background}.{png,jpg,jpeg,webp,gif,svg}', { eager: true, query: '?url', import: 'default' });
const imageNamed = (name) => Object.entries(FILES).find(([path]) => new RegExp(`/${name}\\.[a-z]+$`, 'i').test(path))?.[1] ?? null;
const IMAGES = { logo: imageNamed('logo'), background: imageNamed('background') };
const PIXEL_MAX = 256; // ảnh nhỏ hơn chừng này (ảnh pixel) thì phóng to giữ nét vuông, không nhoè

const CSS = `
#auth { position: fixed; inset: 0; z-index: 40; overflow: auto; color: #e6e9f2; font-family: Nunito, 'Segoe UI', sans-serif;
  background: radial-gradient(circle at 12% 85%, rgba(255,255,255,.07) 0 14%, transparent 14.5%),
    radial-gradient(circle at 90% 18%, rgba(255,255,255,.06) 0 11%, transparent 11.5%), linear-gradient(180deg, #1d2b53, #3b6ea5);
  -webkit-user-select: text; user-select: text; }
#auth.has-bg { background: #1d2b53 var(--bg) center / cover no-repeat; }
#auth .page { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center;
  padding: clamp(14px, 4vh, 40px) 16px clamp(52px, 8vh, 70px); }
/* Vừa một màn hình, không cuộn: thiếu chỗ (màn Đăng ký nhiều ô, màn hình thấp) thì logo tự thu nhỏ lại (hero co, ảnh cao
   tối đa bằng hero). Margin auto: canh giữa theo chiều dọc, nhưng màn quá thấp thì vẫn cuộn được từ trên cùng */
#auth .page > .hero { margin-top: auto; }
#auth .page > form { margin-bottom: auto; flex: 0 0 auto; }
#auth .ver { position: fixed; top: 8px; left: 12px; font-size: 13px; font-weight: 800; color: #c8d8ff; text-shadow: 0 1px 3px #000a; }
#auth .hero { display: flex; align-items: center; justify-content: center; width: 100%; margin-bottom: 14px;
  flex: 0 1 auto; min-height: 64px; pointer-events: none; }
#auth .hero img { display: block; filter: drop-shadow(0 8px 16px rgba(0,0,0,.35)); }
#auth .logo { position: relative; z-index: 1; max-width: min(420px, 46vw); max-height: min(230px, 100%); object-fit: contain; }
#auth .logo-text { margin-bottom: 26px; text-align: center; }
#auth .logo-text .t { font-size: 76px; font-weight: 800; line-height: 1; color: #ffe066; -webkit-text-stroke: 10px #2a4a9a;
  paint-order: stroke fill; filter: drop-shadow(0 6px 10px rgba(0,0,0,.45)); }
#auth .logo-text .s { margin-top: 8px; font-size: 20px; font-weight: 700; color: #fff; text-shadow: 0 2px 4px #0009; }
#auth form { position: relative; z-index: 2; width: min(360px, 100%); }
#auth .card { box-sizing: border-box; padding: 18px 20px 14px; background: rgba(14, 22, 44, .84); border: 2px solid rgba(120, 170, 240, .6);
  border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.3); -webkit-backdrop-filter: blur(10px) saturate(1.2);
  backdrop-filter: blur(10px) saturate(1.2); }
#auth .card h3 { margin: 0 0 12px; font-size: 19px; font-weight: 800; color: #ffe066; text-align: center; }
#auth .field + .field { margin-top: 10px; }
#auth input { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 2px solid #3a4a6c; border-radius: 10px;
  background: #f6f8fc; color: #1e2a44; font: 700 17px Nunito, sans-serif; outline: none; }
#auth input::placeholder { color: #8a96b0; font-weight: 700; }
#auth input:focus { border-color: #ffd860; }
#auth input.bad { border-color: #e05a5a; }
#auth input.good { border-color: #40b060; }
#auth .hint { margin: 5px 4px 0; font-size: 13px; font-weight: 700; line-height: 1.4; }
#auth .hint:empty { display: none; }
#auth .hint.wait { color: #dfe6f4; }
#auth .hint.ok { color: #9af0b8; }
#auth .hint.err { color: #ffb4b4; }
#auth .actions { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
#auth .btn { flex: 1; max-width: 172px; padding: 11px 10px; border: 0; border-radius: 10px; color: #fff; cursor: pointer;
  font: 800 18px Nunito, sans-serif; }
#auth .btn.primary { background: #40b060; box-shadow: 0 3px 0 #2a7a40; }
#auth .btn.second { background: #4a88e0; box-shadow: 0 3px 0 #2a5aa8; }
#auth .btn:hover { filter: brightness(1.08); }
#auth .btn:disabled { opacity: .6; cursor: wait; }
#auth .link { display: inline; padding: 0; border: 0; background: none; color: #ffffff; font: 800 14px Nunito, sans-serif;
  cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
#auth .link:hover, #auth .link:focus-visible { color: #ffe066; outline: none; }
#auth .link:disabled { color: #b8c4dc; cursor: default; text-decoration: none; }
#auth .row { margin-top: 10px; text-align: center; font-size: 14px; color: #dfe6f4; font-weight: 700; }
#auth .msg { margin-top: 12px; padding: 9px 11px; border-radius: 10px; font-size: 14px; font-weight: 700; line-height: 1.45; }
#auth .msg.err { background: #4a1e26; color: #ffb4b4; }
#auth .msg.ok { background: #1e4a32; color: #b4f0c8; }
#auth .msg:empty { display: none; }
#auth .info { margin: 0 0 6px; font-size: 14px; font-weight: 700; line-height: 1.45; color: #eef2fa; text-align: center; }
#auth .info b { color: #ffe066; word-break: break-all; }
#auth .otp { display: flex; justify-content: center; gap: 8px; margin-top: 10px; }
#auth .otp input { width: 44px; height: 54px; padding: 0; flex: 0 0 auto; text-align: center; font: 800 26px Nunito, sans-serif;
  border: 2px solid #5a6a90; border-radius: 10px; background: #f6f8fc; color: #1e2a44; caret-color: #2a5aa8;
  transition: border-color .12s, box-shadow .12s; }
#auth .otp input.filled { border-color: #4a88e0; }
#auth .otp input:focus { border-color: #ffd860; box-shadow: 0 0 0 3px rgba(255, 216, 96, .45); }
#auth .otp input:disabled { opacity: .7; }
#auth .otp.bad input { border-color: #e05a5a; }
@media (max-width: 380px) { #auth .otp { gap: 6px; } #auth .otp input { width: 38px; height: 48px; font-size: 22px; } }
#auth .pw { position: relative; }
#auth .pw input { padding-right: 46px; }
#auth .pw input::-ms-reveal, #auth .pw input::-ms-clear { display: none; }
#auth .eye { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); width: 36px; height: 36px; padding: 0;
  display: flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent;
  color: #6a7896; cursor: pointer; }
#auth .eye:hover, #auth .eye:focus-visible { color: #1e2a44; background: #e2e8f4; outline: none; }
#auth .eye svg { width: 22px; height: 22px; }
#auth .opts { position: fixed; right: 12px; bottom: 12px; z-index: 3; display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: 2px solid #4a88e0; border-radius: 10px; background: rgba(20, 30, 56, .9); color: #fff;
  font: 800 15px Nunito, sans-serif; cursor: pointer; }
#auth .opts:hover { border-color: #ffd860; }
#auth .opts svg { width: 18px; height: 18px; }
@media (max-height: 640px) {
  #auth .page { padding-top: 30px; }
  #auth .logo { max-height: 130px; }
  #auth .logo-text { margin-bottom: 18px; }
  #auth .logo-text .t { font-size: 54px; -webkit-text-stroke-width: 8px; }
}
@media (max-height: 470px) {
  #auth .page { padding: 26px 16px 16px; }
  #auth .hero { margin-bottom: 10px; }
  #auth .logo { max-height: 70px; }
  #auth .logo-text { margin-bottom: 0; }
  #auth .logo-text .t { font-size: 38px; -webkit-text-stroke-width: 6px; }
  #auth .logo-text .s { display: none; }
}
@media (max-width: 560px) {
  #auth .logo { max-width: 80vw; }
}
`;

// Biểu tượng con mắt (hiện mật khẩu) / con mắt gạch chéo (ẩn mật khẩu) ở cuối ô mật khẩu; bánh răng (Cài đặt)
const SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const EYE = `<svg ${SVG}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg ${SVG}><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5"/>
  <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
  <path d="M2 2l20 20"/></svg>`;
const GEAR = `<svg ${SVG}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3
  1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0
  .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0
  1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0
  0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;

// Ô mật khẩu kèm nút con mắt bật / tắt xem mật khẩu
const passwordField = (id, attrs) => `<div class="field pw">
  <input id="${id}" type="password" maxlength="72" ${attrs}>
  <button type="button" class="eye" data-eye="${id}" aria-label="Hiện mật khẩu" aria-pressed="false" title="Hiện mật khẩu">${EYE}</button>
</div>`;

// Các màn của khung nhập. title: tiêu đề trong khung (màn đăng nhập không có) • button: nút chính (gửi form) •
// second: nút thứ hai cạnh nút chính [màn, chữ] • info: màn báo đã gửi mã qua email (kèm ô nhập mã)
const VIEWS = {
  login: { button: 'Đăng nhập', second: ['register', 'Đăng ký'] },
  register: { title: 'Tạo tài khoản', button: 'Tạo tài khoản', second: ['login', 'Quay lại'] },
  forgot: { title: 'Quên mật khẩu', button: 'Gửi mã', second: ['login', 'Quay lại'] },
  // Đăng ký xong: nhập mã trong email để xác nhận (đúng mã thì vào game luôn)
  sent: { title: 'Xác nhận email', info: 'Đã gửi mã xác nhận tới', button: 'Xác nhận', second: ['login', 'Về đăng nhập'] },
  // Quên mật khẩu: nhập mã trong email, đúng thì sang màn đặt mật khẩu mới
  resetSent: {
    title: 'Quên mật khẩu', info: 'Nếu email này đã đăng ký, mã đặt lại mật khẩu đã được gửi tới', button: 'Tiếp tục',
    second: ['login', 'Về đăng nhập'],
  },
  newPassword: { title: 'Đặt mật khẩu mới', button: 'Lưu mật khẩu' },
  // Thiết bị lạ (online/device.js): nhập mã gửi tới email. Nút thứ hai đăng xuất (không phải chuyển màn)
  device: { title: 'Xác nhận thiết bị', button: 'Xác nhận', second: ['logout', 'Đăng xuất'] },
};
// Các màn có ô tên đăng nhập / email / mật khẩu / nhập lại mật khẩu / nút Gửi lại email
const HAS_USER = ['login', 'register'];
const HAS_EMAIL = ['register', 'forgot'];
const HAS_PASS = ['login', 'register', 'newPassword'];
const HAS_PASS2 = ['register', 'newPassword'];
const HAS_RESEND = ['sent', 'resetSent', 'device'];
// Các màn nhập mã 6 số trong email, và loại mã (account.js verifyEmailCode)
const HAS_CODE = { sent: 'signup', resetSent: 'recovery', device: 'device' };
const RESEND_GAP = 60; // giây: Supabase chỉ cho gửi lại email cho cùng địa chỉ sau chừng này

// Mã xác nhận thiết bị: CODE_LEN ô vuông, mỗi ô một chữ số. Ô nào cũng nhận được cả mã (dán / điện thoại tự điền), số dư
// tràn sang các ô sau; ô đầu có autocomplete="one-time-code" để điện thoại gợi ý mã từ email / tin nhắn
const CODE_LEN = 6;
const otpBoxes = () => Array.from({ length: CODE_LEN }, (_, i) => `<input data-otp="${i}" type="text" inputmode="numeric"
  pattern="[0-9]*" maxlength="${CODE_LEN}" aria-label="Chữ số ${i + 1}"
  ${i === 0 ? 'id="auth-code" name="code" autocomplete="one-time-code"' : 'autocomplete="off"'}>`).join('');

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const NAME_CHECK_DELAY = 600; // ms: ngừng gõ chừng này thì kiểm tra trùng tên (màn Đăng ký)
const takenText = (name) => `Tên đăng nhập đã tồn tại.`;

export class AuthPanel {
  // opts: { error } câu báo lỗi hiện sẵn (vd link trong email đã hết hạn); onSettings: mở bảng Cài đặt, trả về khi đóng
  // (không có thì không hiện nút Cài đặt)
  constructor(opts = {}) {
    if (!document.getElementById('auth-css')) {
      const style = document.createElement('style');
      style.id = 'auth-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.firstError = opts.error ?? null;
    this.onSettings = opts.onSettings ?? null;
    this.username = lastLogin(); // tên đăng nhập lần trước: điền sẵn
    this.email = '';
    this.resendAt = 0; // lúc (ms) được bấm Gửi lại email
    this.pending = false; // đang chờ máy chủ (tab này tự đăng nhập: không coi là tab khác)
    this.nameStatus = new Map(); // tên (chữ thường) -> 'ok' | 'taken' | 'invalid': kết quả kiểm tra trùng đã hỏi máy chủ
    this.nameSeq = 0; // lần kiểm tra mới nhất (kết quả về muộn của lần cũ thì bỏ)
  }

  open() {
    return this.show('login', (resolve) => {
      this.resolve = resolve;
      this.stopListening = onSignedIn(() => this.otherTabSignedIn());
    });
  }

  openNewPassword() {
    return this.show('newPassword', (resolve) => {
      this.resolve = resolve;
    });
  }

  // Thiết bị lạ: gửi mã tới email của user rồi chờ nhập. Trả về user (phiên mới đã xác nhận email) hoặc null (bấm Đăng xuất)
  openDevice(user) {
    return this.show('device', (resolve) => {
      this.resolve = resolve;
      this.email = user.email ?? '';
      queueMicrotask(() => this.sendCode()); // sau khi vẽ xong màn (để hiện được câu báo)
    });
  }

  async sendCode() {
    if (!this.root) return;
    this.say('Đang gửi mã…', false);
    const res = await sendDeviceCode(this.email);
    if (!this.root) return;
    if (res.error) return this.say(res.error);
    this.sent();
    this.say('Đã gửi mã. Hãy xem email (cả thư mục Spam).', false);
  }

  show(view, setup) {
    this.root = document.createElement('div');
    this.root.id = 'auth';
    this.root.innerHTML = `
      <div class="page"><div class="hero"></div><form novalidate></form></div>
      <div class="ver">v${PKG.version}</div>
      ${this.onSettings ? `<button type="button" class="opts" aria-label="Cài đặt">${GEAR}<span>Cài đặt</span></button>` : ''}`;
    this.buildHero();
    this.form = this.root.querySelector('form');
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    this.root.querySelector('.opts')?.addEventListener('click', () => this.openSettings());
    // Phím gõ không lọt xuống game
    for (const type of ['keydown', 'keyup', 'keypress']) this.root.addEventListener(type, (e) => e.stopPropagation());
    document.body.appendChild(this.root);
    return new Promise((resolve) => {
      setup(resolve);
      this.render(view, this.firstError ? { text: this.firstError, err: true } : null);
      this.firstError = null;
    });
  }

  // Logo (ảnh riêng nếu có) canh giữa, nền
  buildHero() {
    const hero = this.root.querySelector('.hero');
    const img = (src, cls) => {
      const el = document.createElement('img');
      el.className = cls;
      el.alt = '';
      el.decoding = 'async';
      // Ảnh pixel nhỏ: phóng to giữ nét
      el.addEventListener('load', () => {
        if (Math.max(el.naturalWidth, el.naturalHeight) <= PIXEL_MAX) el.style.imageRendering = 'pixelated';
      });
      el.src = src;
      hero.appendChild(el);
    };
    if (IMAGES.logo) img(IMAGES.logo, 'logo');
    else {
      hero.insertAdjacentHTML('beforeend', `<div class="logo-text"><div class="t">Pokémon</div>
        <div class="s">Aurora Online</div></div>`);
    }
    if (IMAGES.background) {
      this.root.classList.add('has-bg');
      this.root.style.setProperty('--bg', `url("${IMAGES.background}")`);
    }
  }

  // Tab khác vừa đăng nhập (thường là tab mở ra từ link xác nhận trong email): báo ở đây, không vào game theo
  otherTabSignedIn() {
    if (!this.root || this.pending) return;
    this.render('login', {
      text: 'Tài khoản đã đăng nhập ở tab mới (tab mở ra từ link trong email), game đang chạy ở đó. Bạn có thể đóng tab này.',
      err: false,
    });
  }

  finish(value) {
    if (!this.root) return;
    clearInterval(this.tick);
    clearTimeout(this.nameTimer);
    this.stopListening?.();
    this.root.remove();
    this.root = null;
    this.resolve(value);
  }

  // Vẽ lại khung nhập theo màn (VIEWS). msg: { text, err, action } câu báo trong khung
  render(view, msg = null) {
    this.view = view;
    clearInterval(this.tick);
    const v = VIEWS[view];
    this.form.innerHTML = `
      <div class="card">
        ${v.title ? `<h3>${v.title}</h3>` : ''}
        ${v.info ? `<p class="info">${v.info} <b class="to"></b>.</p>
          <p class="info">Nhập mã ${CODE_LEN} chữ số trong email vào ô dưới. Không thấy email thì xem thư mục Spam / Quảng cáo.</p>` : ''}
        ${HAS_USER.includes(view) ? `<div class="field">
          <input id="auth-user" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off"
            spellcheck="false" placeholder="${view === 'login' ? 'Tên đăng nhập hoặc email' : 'Tên đăng nhập'}" aria-label="Tên đăng nhập">
          ${view === 'register' ? '<div class="hint" aria-live="polite"></div>' : ''}
        </div>` : ''}
        ${view === 'device' ? `<p class="info">Lần đầu đăng nhập trên thiết bị này. Mã xác nhận đã gửi tới <b class="to"></b>:
            nhập mã để tiếp tục. Lần sau trên thiết bị này không phải nhập nữa.</p>
          <p class="info">Bạn không đăng nhập mà vẫn nhận được mã? Có người đã biết mật khẩu của bạn: hãy đổi mật khẩu.</p>` : ''}
        ${HAS_CODE[view] ? `<div class="field otp" role="group" aria-label="Mã xác nhận ${CODE_LEN} chữ số">${otpBoxes()}</div>` : ''}
        ${HAS_EMAIL.includes(view) ? `<div class="field">
          <input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254"
            placeholder="Email" aria-label="Email"></div>` : ''}
        ${HAS_PASS.includes(view) ? passwordField('auth-pass', `name="password"
          autocomplete="${view === 'login' ? 'current-password' : 'new-password'}"
          placeholder="${view === 'newPassword' ? 'Mật khẩu mới' : 'Mật khẩu'}" aria-label="${view === 'newPassword' ? 'Mật khẩu mới' : 'Mật khẩu'}"`) : ''}
        ${HAS_PASS2.includes(view) ? passwordField('auth-pass2', 'autocomplete="new-password" placeholder="Nhập lại mật khẩu" aria-label="Nhập lại mật khẩu"') : ''}
        <div class="msg"></div>
        ${view === 'login' ? '<div class="row"><button type="button" class="link" data-go="forgot">Quên mật khẩu?</button></div>' : ''}
        ${HAS_RESEND.includes(view) ? '<div class="row"><button type="button" class="link resend">Gửi lại email</button></div>' : ''}
        ${view === 'sent' ? '<div class="row"><button type="button" class="link" data-go="register">Đổi email</button></div>' : ''}
      </div>
      <div class="actions">
        ${v.button ? `<button class="btn primary" type="submit">${v.button}</button>` : ''}
        ${v.second ? `<button type="button" class="btn second" data-go="${v.second[0]}">${v.second[1]}</button>` : ''}
      </div>`;
    const $ = (sel) => this.form.querySelector(sel);
    this.emailInput = $('#auth-email');
    if (this.emailInput) this.emailInput.value = this.email;
    this.userInput = $('#auth-user');
    if (this.userInput) {
      this.userInput.value = this.username;
      // Chữ cái đầu tự viết hoa ngay khi gõ; biểu tượng (emoji) gõ / dán vào thì bỏ đi, không hiện (giữ chỗ con trỏ)
      this.userInput.addEventListener('input', () => {
        const input = this.userInput;
        const before = input.value;
        const fixed = capitalizeFirst(stripPictographs(before));
        if (fixed === before) return;
        const at = Math.max(0, (input.selectionStart ?? fixed.length) - (before.length - fixed.length));
        input.value = fixed;
        input.setSelectionRange(at, at);
      });
      // Màn Đăng ký: gõ xong (ngừng gõ một lúc / rời ô) thì kiểm tra quy tắc và trùng tên ngay, báo dưới ô
      if (view === 'register') {
        this.userInput.addEventListener('input', () => this.queueNameCheck());
        this.userInput.addEventListener('blur', () => this.checkName());
        if (this.userInput.value) this.checkName();
      }
    }
    const to = $('.to');
    // email: luôn che bớt (người đứng cạnh / người biết mật khẩu mà không phải chủ tài khoản không đọc được email), gán
    // bằng textContent, không chèn HTML
    if (to) to.textContent = maskEmail(this.email);
    // Chuyển màn (Đăng nhập <-> Đăng ký, Quên mật khẩu, Quay lại...): làm mới form, không giữ chữ đã gõ ở màn trước.
    // Màn đăng nhập điền sẵn tên đăng nhập lần trước như lúc mới mở
    for (const b of this.form.querySelectorAll('[data-go]')) {
      b.addEventListener('click', async () => {
        // Màn xác nhận thiết bị: Đăng xuất (về màn đăng nhập, TitleScene mở lại)
        if (b.dataset.go === 'logout') {
          b.disabled = true;
          await signOut();
          this.finish(null);
          return;
        }
        this.email = '';
        this.username = b.dataset.go === 'login' ? lastLogin() : '';
        this.render(b.dataset.go);
      });
    }
    // Nút con mắt: bật / tắt xem mật khẩu của ô đó, con trỏ vẫn ở trong ô (không mất chỗ đang gõ)
    for (const eye of this.form.querySelectorAll('[data-eye]')) {
      const input = $(`#${eye.dataset.eye}`);
      eye.addEventListener('mousedown', (e) => e.preventDefault());
      eye.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        eye.innerHTML = show ? EYE_OFF : EYE;
        const label = show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu';
        eye.setAttribute('aria-label', label);
        eye.setAttribute('aria-pressed', String(show));
        eye.title = label;
        if (document.activeElement !== input) input.focus();
      });
    }
    if (HAS_CODE[view]) this.setupOtp();
    const resend = $('.resend');
    if (resend) {
      resend.addEventListener('click', () => this.resend());
      this.updateResend();
      this.tick = setInterval(() => this.updateResend(), 1000);
    }
    if (msg) this.say(msg.text, msg.err, msg.action);
    const first = this.userInput && !this.username ? this.userInput
      : this.emailInput && !this.email ? this.emailInput : $('#auth-pass') ?? this.emailInput ?? $('#auth-code');
    first?.focus();
  }

  // ---------- Ô nhập mã xác nhận thiết bị ----------

  otpInputs() {
    return [...(this.form?.querySelectorAll('[data-otp]') ?? [])];
  }

  otpCode() {
    return this.otpInputs().map((b) => b.value).join('');
  }

  // Điền các chữ số từ ô thứ `from` trở đi (gõ, dán, điện thoại tự điền mã); đủ CODE_LEN số thì tự gửi như bấm Xác nhận
  fillOtp(from, digits) {
    const boxes = this.otpInputs();
    let i = from;
    for (const d of digits) {
      if (i >= boxes.length) break;
      boxes[i].value = d;
      i++;
    }
    for (const b of boxes) b.classList.toggle('filled', Boolean(b.value));
    this.form.querySelector('.otp')?.classList.remove('bad');
    boxes[Math.min(i, boxes.length - 1)].focus();
    if (/^\d+$/.test(this.otpCode()) && this.otpCode().length === CODE_LEN) this.submit();
  }

  clearOtp() {
    const boxes = this.otpInputs();
    for (const b of boxes) {
      b.value = '';
      b.classList.remove('filled');
    }
    boxes[0]?.focus();
  }

  // Chỉ nhận chữ số, gõ xong tự sang ô sau, Backspace ở ô trống thì lùi về ô trước, ← → để di chuyển, dán mã thì điền hết
  setupOtp() {
    const boxes = this.otpInputs();
    boxes.forEach((box, i) => {
      box.addEventListener('focus', () => box.select());
      box.addEventListener('input', () => {
        const digits = box.value.replace(/\D/g, '');
        box.value = '';
        if (digits) this.fillOtp(i, digits);
        else box.classList.remove('filled');
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
        if (digits) this.fillOtp(digits.length >= CODE_LEN ? 0 : i, digits);
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          e.preventDefault();
          boxes[i - 1].value = '';
          boxes[i - 1].classList.remove('filled');
          boxes[i - 1].focus();
        } else if (e.key === 'ArrowLeft' && i > 0) {
          e.preventDefault();
          boxes[i - 1].focus();
        } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
          e.preventDefault();
          boxes[i + 1].focus();
        }
      });
    });
  }

  // ---------- Kiểm tra tên đăng nhập lúc gõ (màn Đăng ký) ----------

  // Dòng báo dưới ô tên đăng nhập. kind: 'wait' | 'ok' | 'err' | null (xoá)
  nameHint(text, kind) {
    const hint = this.form?.querySelector('.hint');
    if (!hint || !this.userInput) return;
    hint.className = `hint${kind ? ` ${kind}` : ''}`;
    hint.textContent = text ?? '';
    this.userInput.classList.toggle('bad', kind === 'err');
    this.userInput.classList.toggle('good', kind === 'ok');
  }

  // Đang gõ: xoá báo cũ, chờ ngừng gõ rồi kiểm tra
  queueNameCheck() {
    clearTimeout(this.nameTimer);
    this.nameSeq++;
    this.nameHint('', null);
    this.nameTimer = setTimeout(() => this.checkName(), NAME_CHECK_DELAY);
  }

  // Kiểm tra tên đang gõ: sai quy tắc báo ngay; đúng thì hỏi máy chủ có trùng không (nhớ kết quả từng tên)
  async checkName() {
    clearTimeout(this.nameTimer);
    if (this.view !== 'register' || !this.userInput) return;
    const raw = this.userInput.value;
    if (!raw.trim()) return this.nameHint('', null);
    const check = checkUsername(raw);
    if (check.error) return this.nameHint(check.error, 'err');
    const name = check.name;
    const key = name.toLowerCase();
    const seq = ++this.nameSeq;
    let status = this.nameStatus.get(key);
    if (!status) {
      this.nameHint('Đang kiểm tra tên…', 'wait');
      const res = await usernameAvailable(name);
      if (!this.root || seq !== this.nameSeq || this.view !== 'register') return; // đã gõ tiếp / đổi màn
      if (res.error) return this.nameHint(res.error, 'err');
      status = res.data;
      this.nameStatus.set(key, status);
    }
    if (seq !== this.nameSeq) return;
    if (status === 'taken') this.nameHint(takenText(name), 'err');
    else if (status === 'invalid') this.nameHint('Tên đăng nhập không hợp lệ.', 'err');
    else this.nameHint(`Tên "${name}" hợp lệ.`, 'ok');
  }

  // Nút Gửi lại email: chờ RESEND_GAP giây giữa hai lần gửi
  updateResend() {
    const btn = this.root?.querySelector('.resend');
    if (!btn) return;
    const wait = Math.ceil((this.resendAt - Date.now()) / 1000);
    btn.disabled = wait > 0;
    const label = HAS_CODE[this.view] ? 'Gửi lại mã' : 'Gửi lại email';
    btn.textContent = wait > 0 ? `${label} (${wait} giây)` : label;
  }

  // Vừa gửi email (đăng ký / gửi lại / quên mật khẩu): đếm ngược trước khi cho gửi lại
  sent() {
    this.resendAt = Date.now() + RESEND_GAP * 1000;
    this.updateResend();
  }

  async resend() {
    if (this.view === 'device') return this.sendCode();
    const email = this.email;
    const res = this.view === 'resetSent' ? await sendPasswordReset(email) : await resendConfirmation(email);
    if (!this.root) return;
    if (res.error) return this.say(res.error);
    this.sent();
    this.clearOtp();
    this.say('Đã gửi lại mã. Hãy dùng mã trong email mới nhất.', false);
  }

  // Câu báo trong khung. action: { label, run } thêm một link bấm được (vd Gửi lại email xác nhận)
  say(text, err = true, action = null) {
    const box = this.form.querySelector('.msg');
    box.className = `msg ${err ? 'err' : 'ok'}`;
    box.textContent = text ?? '';
    if (action) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'link';
      link.textContent = action.label;
      link.style.marginLeft = '6px';
      link.addEventListener('click', action.run);
      box.appendChild(link);
    }
  }

  busy(on) {
    if (!this.root) return;
    const button = this.form.querySelector('.btn.primary');
    if (button) {
      button.disabled = on;
      button.textContent = on ? 'Đang xử lý…' : VIEWS[this.view].button;
    }
    const second = this.form.querySelector('.btn.second');
    if (second) second.disabled = on;
    for (const box of this.otpInputs()) box.disabled = on;
    this.working = on;
  }

  async submit() {
    const view = this.view;
    if (!VIEWS[view].button) return;
    const $ = (sel) => this.form.querySelector(sel);
    const email = HAS_EMAIL.includes(view) ? this.emailInput.value.trim() : this.email;
    const password = $('#auth-pass')?.value ?? '';
    const again = $('#auth-pass2')?.value ?? '';
    this.email = email || this.email;
    // Mã 6 số trong email (xác nhận đăng ký / quên mật khẩu / thiết bị lạ). Đúng mã thì Supabase đăng nhập luôn (phiên đã
    // xác nhận email, máy chủ cũng nhớ luôn thiết bị này: schema.sql device_check)
    if (HAS_CODE[view]) {
      if (this.working) return; // đang kiểm tra (vừa tự gửi khi điền đủ số)
      const code = this.otpCode();
      if (code.length !== CODE_LEN || !/^\d+$/.test(code)) {
        this.form.querySelector('.otp')?.classList.add('bad');
        this.otpInputs().find((b) => !b.value)?.focus();
        return this.say(`Hãy nhập đủ ${CODE_LEN} chữ số trong email.`);
      }
      this.busy(true);
      this.say('');
      // Đúng mã thì tab này đăng nhập: supabase-js báo SIGNED_IN, không được coi là "tab khác vừa đăng nhập" (pending giữ
      // nguyên tới khi xong, kể cả lúc đang ở màn đặt mật khẩu mới)
      this.pending = true;
      const res = view === 'device' ? await verifyDeviceCode(this.email, code) : await verifyEmailCode(this.email, code, HAS_CODE[view]);
      if (!this.root) return;
      this.busy(false);
      if (res.error) {
        this.pending = false;
        // Sai / hết hạn: xoá các ô, viền đỏ, con trỏ về ô đầu để nhập lại
        this.clearOtp();
        this.form.querySelector('.otp')?.classList.add('bad');
        return this.say(res.error);
      }
      // Quên mật khẩu: mã đúng (đã có phiên tạm) -> đặt mật khẩu mới rồi mới vào game
      if (view === 'resetSent') return this.render('newPassword', { text: 'Mã đúng. Hãy đặt mật khẩu mới.', err: false });
      const name = res.user?.user_metadata?.username;
      if (view === 'sent' && name) setLastLogin(name);
      return this.finish(res.user);
    }
    let username = null;
    // Màn đăng nhập: gõ email thay cho tên đăng nhập cũng được (tên đang bị khoá vì người khác dò mật khẩu...)
    const loginEmail = view === 'login' && this.userInput.value.includes('@') ? this.userInput.value.trim() : null;
    if (loginEmail && !validEmail(loginEmail)) return this.say('Hãy nhập tên đăng nhập, hoặc email hợp lệ.');
    if (HAS_USER.includes(view) && !loginEmail) {
      const check = checkUsername(this.userInput.value);
      if (check.error) {
        if (view === 'register') this.nameHint(check.error, 'err');
        return this.say(check.error);
      }
      username = check.name;
      this.username = username;
      this.userInput.value = username; // hiện đúng tên sẽ dùng (đã bỏ khoảng trắng 2 đầu, viết hoa chữ đầu)
    }
    if (HAS_EMAIL.includes(view) && !validEmail(email)) return this.say('Hãy nhập email hợp lệ.');
    if (HAS_PASS.includes(view) && password.length < PASSWORD_MIN) return this.say(`Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự.`);
    if (HAS_PASS2.includes(view) && password !== again) return this.say('Hai lần nhập mật khẩu không khớp.');

    this.busy(true);
    this.say('');
    this.pending = true;
    const done = (res) => {
      this.pending = false;
      if (!this.root) return false;
      this.busy(false);
      if (res.error) this.say(res.error);
      return !res.error;
    };

    if (view === 'login') {
      const res = loginEmail ? await signInWithEmail(loginEmail, password) : await signInWithUsername(username, password);
      this.pending = false;
      if (!this.root) return;
      this.busy(false);
      // Đã đăng ký mà chưa nhập mã xác nhận email
      if (res.code === 'email_not_confirmed') {
        return this.say('Email chưa được xác nhận.', true,
          { label: 'Gửi mã xác nhận', run: () => this.confirmLater(res.email) });
      }
      if (res.error) return this.say(res.error);
      // Đăng nhập bằng email: lần sau vẫn điền sẵn tên đăng nhập (không nhớ email trên máy)
      setLastLogin(username ?? res.data.user?.user_metadata?.username ?? null);
      this.finish(res.data.user);
    } else if (view === 'register') {
      // Kiểm tra tên lại lúc gửi (có thể vừa có người lấy mất; máy chủ cũng chặn trùng khi tạo tài khoản, nhưng khi đó
      // Supabase chỉ báo lỗi chung chung)
      clearTimeout(this.nameTimer);
      this.nameSeq++; // bỏ kết quả kiểm tra lúc gõ còn đang chờ
      const free = await usernameAvailable(username);
      if (free.data) this.nameStatus.set(username.toLowerCase(), free.data);
      if (free.data === 'taken') free.error = takenText(username);
      else if (free.data === 'invalid') free.error = 'Tên đăng nhập không hợp lệ.';
      if (this.root && free.data) this.nameHint(free.error ?? `Tên "${username}" dùng được.`, free.error ? 'err' : 'ok');
      if (!done(free)) return;
      // Email rác (tên miền trong danh sách chặn trên máy chủ): báo ngay, không tạo tài khoản
      this.busy(true);
      this.pending = true;
      if (!(await emailAllowed(email))) return done({ error: EMAIL_BLOCKED });
      const res = await signUp(email, password, username);
      if (!done(res)) return;
      setLastLogin(username);
      // "Confirm email" đang tắt thì có phiên ngay: vào game luôn
      if (res.data.session) return this.finish(res.data.user);
      this.sent();
      this.render('sent');
    } else if (view === 'forgot') {
      const res = await sendPasswordReset(email);
      if (!done(res)) return;
      this.sent();
      // Không cho biết email có đăng ký hay không (người lạ không dò được)
      this.render('resetSent');
    } else {
      const res = await setNewPassword(password);
      if (!done(res)) return;
      const name = res.data.user?.user_metadata?.username;
      if (name) setLastLogin(name);
      this.finish(res.data.user);
    }
  }

  // Đăng nhập mà email chưa xác nhận: gửi lại mã xác nhận rồi sang màn 'sent' nhập mã (gửi lỗi, vd vừa gửi xong: vẫn sang,
  // dùng mã trong email đã có)
  async confirmLater(email) {
    const res = await resendConfirmation(email);
    if (!this.root) return;
    this.email = email;
    if (!res.error) this.sent();
    this.render('sent', res.error ? { text: res.error, err: true } : null);
  }

  // Nút Cài đặt: ẩn màn đăng nhập (bảng Cài đặt vẽ trong game, nằm dưới lớp HTML này), mở bảng, đóng thì hiện lại
  async openSettings() {
    if (this.settingsOpen || !this.root) return;
    this.settingsOpen = true;
    const focused = document.activeElement;
    focused?.blur?.(); // phím bấm trong bảng Cài đặt không gõ vào ô đang chọn
    this.root.style.display = 'none';
    try {
      await this.onSettings();
    } finally {
      this.settingsOpen = false;
      if (this.root) {
        this.root.style.display = '';
        if (focused?.isConnected) focused.focus();
      }
    }
  }
}
