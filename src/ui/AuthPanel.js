import {
  onSignedIn, PASSWORD_MIN, resendConfirmation, sendPasswordReset, setNewPassword, signInWithUsername, signUp, usernameAvailable,
} from '../online/account.js';
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
// Đăng ký và Quên mật khẩu dùng LINK trong email: bấm link thì game mở ở tab mới (tự đăng nhập / hỏi mật khẩu mới).
//  Tab cũ ở màn 'sent' / 'resetSent' (báo đã gửi email, nút Gửi lại email); tab mới đăng nhập xong thì tab cũ chỉ báo
//  "đã đăng nhập ở tab khác" chứ không vào game theo (phiên nằm trong tab mới, mỗi tài khoản chỉ chơi ở một nơi).

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
#auth .page { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 40px 16px 70px; }
#auth .ver { position: fixed; top: 8px; left: 12px; font-size: 13px; font-weight: 800; color: #c8d8ff; text-shadow: 0 1px 3px #000a; }
#auth .hero { display: flex; align-items: center; justify-content: center; width: 100%; margin-bottom: 14px;
  pointer-events: none; }
#auth .hero img { display: block; filter: drop-shadow(0 8px 16px rgba(0,0,0,.35)); }
#auth .logo { position: relative; z-index: 1; max-width: min(420px, 46vw); max-height: 230px; }
#auth .logo-text { margin-bottom: 26px; text-align: center; }
#auth .logo-text .t { font-size: 76px; font-weight: 800; line-height: 1; color: #ffe066; -webkit-text-stroke: 10px #2a4a9a;
  paint-order: stroke fill; filter: drop-shadow(0 6px 10px rgba(0,0,0,.45)); }
#auth .logo-text .s { margin-top: 8px; font-size: 20px; font-weight: 700; color: #fff; text-shadow: 0 2px 4px #0009; }
#auth form { position: relative; z-index: 2; width: min(360px, 100%); }
#auth .card { box-sizing: border-box; padding: 18px 20px 14px; background: rgba(20, 30, 56, .22); border: 2px solid rgba(120, 170, 240, .5);
  border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,.3); -webkit-backdrop-filter: blur(10px) saturate(1.2);
  backdrop-filter: blur(10px) saturate(1.2); }
#auth .card h3 { margin: 0 0 12px; font-size: 19px; font-weight: 800; color: #ffe066; text-align: center; }
#auth .field + .field { margin-top: 10px; }
#auth input { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 2px solid #3a4a6c; border-radius: 10px;
  background: #f6f8fc; color: #1e2a44; font: 700 17px Nunito, sans-serif; outline: none; }
#auth input::placeholder { color: #8a96b0; font-weight: 700; }
#auth input:focus { border-color: #ffd860; }
#auth .actions { display: flex; justify-content: center; gap: 10px; margin-top: 14px; }
#auth .btn { flex: 1; max-width: 172px; padding: 11px 10px; border: 0; border-radius: 10px; color: #fff; cursor: pointer;
  font: 800 18px Nunito, sans-serif; }
#auth .btn.primary { background: #40b060; box-shadow: 0 3px 0 #2a7a40; }
#auth .btn.second { background: #4a88e0; box-shadow: 0 3px 0 #2a5aa8; }
#auth .btn:hover { filter: brightness(1.08); }
#auth .btn:disabled { opacity: .6; cursor: wait; }
#auth .link { display: inline; padding: 0; border: 0; background: none; color: #8fb4ff; font: 700 14px Nunito, sans-serif;
  cursor: pointer; text-decoration: underline; }
#auth .link:disabled { color: #6a7896; cursor: default; text-decoration: none; }
#auth .row { margin-top: 10px; text-align: center; font-size: 14px; color: #a8b4d0; font-weight: 700; }
#auth .msg { margin-top: 12px; padding: 9px 11px; border-radius: 10px; font-size: 14px; font-weight: 700; line-height: 1.45; }
#auth .msg.err { background: #4a1e26; color: #ffb4b4; }
#auth .msg.ok { background: #1e4a32; color: #b4f0c8; }
#auth .msg:empty { display: none; }
#auth .info { margin: 0 0 6px; font-size: 14px; font-weight: 700; line-height: 1.45; color: #c8d2ea; text-align: center; }
#auth .info b { color: #ffe066; word-break: break-all; }
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
// second: nút thứ hai cạnh nút chính [màn, chữ] • info: màn báo đã gửi email (không có ô nhập)
const VIEWS = {
  login: { button: 'Đăng nhập', second: ['register', 'Đăng ký'] },
  register: { title: 'Tạo tài khoản', button: 'Tạo tài khoản', second: ['login', 'Quay lại'] },
  forgot: { title: 'Quên mật khẩu', button: 'Gửi link', second: ['login', 'Quay lại'] },
  sent: { title: 'Xác nhận email', info: 'Đã gửi link xác nhận tới', second: ['login', 'Về đăng nhập'] },
  resetSent: { title: 'Quên mật khẩu', info: 'Nếu email này đã đăng ký, link đặt lại mật khẩu đã được gửi tới', second: ['login', 'Về đăng nhập'] },
  newPassword: { title: 'Đặt mật khẩu mới', button: 'Lưu mật khẩu' },
};
// Các màn có ô tên đăng nhập / email / mật khẩu / nhập lại mật khẩu / nút Gửi lại email
const HAS_USER = ['login', 'register'];
const HAS_EMAIL = ['register', 'forgot'];
const HAS_PASS = ['login', 'register', 'newPassword'];
const HAS_PASS2 = ['register', 'newPassword'];
const HAS_RESEND = ['sent', 'resetSent'];
const RESEND_GAP = 60; // giây: Supabase chỉ cho gửi lại email cho cùng địa chỉ sau chừng này

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

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
        <div class="s">Hành trình vùng Sơn Thủy</div></div>`);
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
          <p class="info">Mở email và bấm link: game sẽ mở ở tab mới, tab này đóng được. Không thấy email thì xem thư mục
            Spam / Quảng cáo.</p>` : ''}
        ${HAS_USER.includes(view) ? `<div class="field">
          <input id="auth-user" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off"
            spellcheck="false" placeholder="Tên đăng nhập" aria-label="Tên đăng nhập">
        </div>` : ''}
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
    }
    const to = $('.to');
    if (to) to.textContent = this.email; // email người chơi gõ: gán bằng textContent, không chèn HTML
    // Chuyển màn (Đăng nhập <-> Đăng ký, Quên mật khẩu, Quay lại...): làm mới form, không giữ chữ đã gõ ở màn trước.
    // Màn đăng nhập điền sẵn tên đăng nhập lần trước như lúc mới mở
    for (const b of this.form.querySelectorAll('[data-go]')) {
      b.addEventListener('click', () => {
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
    const resend = $('.resend');
    if (resend) {
      resend.addEventListener('click', () => this.resend());
      this.updateResend();
      this.tick = setInterval(() => this.updateResend(), 1000);
    }
    if (msg) this.say(msg.text, msg.err, msg.action);
    const first = this.userInput && !this.username ? this.userInput
      : this.emailInput && !this.email ? this.emailInput : $('#auth-pass') ?? this.emailInput;
    first?.focus();
  }

  // Nút Gửi lại email: chờ RESEND_GAP giây giữa hai lần gửi
  updateResend() {
    const btn = this.root?.querySelector('.resend');
    if (!btn) return;
    const wait = Math.ceil((this.resendAt - Date.now()) / 1000);
    btn.disabled = wait > 0;
    btn.textContent = wait > 0 ? `Gửi lại email (${wait} giây)` : 'Gửi lại email';
  }

  // Vừa gửi email (đăng ký / gửi lại / quên mật khẩu): đếm ngược trước khi cho gửi lại
  sent() {
    this.resendAt = Date.now() + RESEND_GAP * 1000;
    this.updateResend();
  }

  async resend() {
    const email = this.email;
    const res = this.view === 'resetSent' ? await sendPasswordReset(email) : await resendConfirmation(email);
    if (!this.root) return;
    if (res.error) return this.say(res.error);
    this.sent();
    this.say('Đã gửi lại email. Hãy bấm link trong email mới nhất.', false);
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
  }

  async submit() {
    const view = this.view;
    if (!VIEWS[view].button) return;
    const $ = (sel) => this.form.querySelector(sel);
    const email = HAS_EMAIL.includes(view) ? this.emailInput.value.trim() : this.email;
    const password = $('#auth-pass')?.value ?? '';
    const again = $('#auth-pass2')?.value ?? '';
    this.email = email || this.email;
    let username = null;
    if (HAS_USER.includes(view)) {
      const check = checkUsername(this.userInput.value);
      if (check.error) return this.say(check.error);
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
      const res = await signInWithUsername(username, password);
      this.pending = false;
      if (!this.root) return;
      this.busy(false);
      // Đã đăng ký mà chưa bấm link xác nhận
      if (res.code === 'email_not_confirmed') {
        return this.say('Email chưa được xác nhận: hãy bấm link trong email.', true,
          { label: 'Gửi lại email xác nhận', run: () => this.confirmLater(res.email) });
      }
      if (res.error) return this.say(res.error);
      setLastLogin(username);
      this.finish(res.data.user);
    } else if (view === 'register') {
      // Kiểm tra tên trước (máy chủ cũng chặn trùng khi tạo tài khoản, nhưng khi đó Supabase chỉ báo lỗi chung chung)
      const free = await usernameAvailable(username);
      if (free.data === 'taken') free.error = `Tên đăng nhập "${username}" đã có người dùng. Hãy chọn tên khác.`;
      else if (free.data === 'invalid') free.error = 'Tên đăng nhập không hợp lệ.';
      if (!done(free)) return;
      this.busy(true);
      this.pending = true;
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

  // Đăng nhập mà email chưa xác nhận: gửi lại email xác nhận rồi sang màn 'sent' (gửi lỗi, vd vừa gửi xong: vẫn sang,
  // dùng link trong email đã có)
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
