import {
  PASSWORD_MIN, onSignedIn, resendConfirmation, sendPasswordReset, setNewPassword, signIn, signUp,
} from '../online/account.js';
import { lastEmail, setLastEmail } from '../online/supabase.js';

// Bảng đăng nhập / đăng ký / quên mật khẩu / đặt mật khẩu mới. Là HTML đặt đè lên game (không vẽ trong Phaser) để gõ
// được tiếng Việt, trình duyệt gợi ý lưu mật khẩu và bàn phím điện thoại hiện đúng kiểu (email / mật khẩu).
// Phím gõ trong bảng không lọt xuống game (Phaser nghe phím trên window).
//  open(): mở bảng, trả về user khi đã đăng nhập xong (kể cả đăng nhập ở tab khác, vd bấm link xác nhận trong email)
//  openNewPassword(): sau khi bấm link "đặt lại mật khẩu" trong email; trả về khi đã đặt xong

const CSS = `
#auth { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: rgba(10, 20, 48, .55); font-family: Nunito, 'Segoe UI', sans-serif; -webkit-user-select: text; user-select: text; }
#auth .card { width: min(380px, 100%); max-height: 100%; overflow: auto; box-sizing: border-box; padding: 22px 22px 18px;
  background: #1e2a44; border: 3px solid #4a88e0; border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,.5); color: #e6e9f2; }
#auth h2 { margin: 0 0 4px; font-size: 26px; font-weight: 800; color: #ffe066; text-align: center; }
#auth .sub { margin: 0 0 16px; font-size: 14px; color: #a8b4d0; text-align: center; font-weight: 700; }
#auth .tabs { display: flex; gap: 6px; margin-bottom: 16px; background: #141c30; border-radius: 12px; padding: 4px; }
#auth .tabs button { flex: 1; padding: 9px 0; border: 0; border-radius: 9px; background: transparent; color: #a8b4d0;
  font: 800 16px Nunito, sans-serif; cursor: pointer; }
#auth .tabs button.on { background: #4a88e0; color: #fff; }
#auth label { display: block; margin: 10px 0 5px; font-size: 14px; font-weight: 800; color: #c8d2ea; }
#auth input { width: 100%; box-sizing: border-box; padding: 11px 12px; border: 2px solid #3a4a6c; border-radius: 10px;
  background: #f6f8fc; color: #1e2a44; font: 700 17px Nunito, sans-serif; outline: none; }
#auth input:focus { border-color: #ffd860; }
#auth .main { width: 100%; margin-top: 18px; padding: 12px 0; border: 0; border-radius: 12px; background: #40b060; color: #fff;
  font: 800 19px Nunito, sans-serif; cursor: pointer; box-shadow: 0 3px 0 #2a7a40; }
#auth .main:disabled { opacity: .6; cursor: wait; }
#auth .link { display: inline; padding: 0; border: 0; background: none; color: #8fb4ff; font: 700 14px Nunito, sans-serif;
  cursor: pointer; text-decoration: underline; }
#auth .row { margin-top: 12px; text-align: center; font-size: 14px; color: #a8b4d0; font-weight: 700; }
#auth .msg { margin-top: 12px; padding: 9px 11px; border-radius: 10px; font-size: 14px; font-weight: 700; line-height: 1.45; }
#auth .msg.err { background: #4a1e26; color: #ffb4b4; }
#auth .msg.ok { background: #1e4a32; color: #b4f0c8; }
#auth .msg:empty { display: none; }
#auth .pw { position: relative; }
#auth .pw input { padding-right: 46px; }
#auth .pw input::-ms-reveal, #auth .pw input::-ms-clear { display: none; }
#auth .eye { position: absolute; top: 50%; right: 6px; transform: translateY(-50%); width: 36px; height: 36px; padding: 0;
  display: flex; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent;
  color: #6a7896; cursor: pointer; }
#auth .eye:hover, #auth .eye:focus-visible { color: #1e2a44; background: #e2e8f4; outline: none; }
#auth .eye svg { width: 22px; height: 22px; }
`;

// Biểu tượng con mắt (hiện mật khẩu) / con mắt gạch chéo (ẩn mật khẩu) ở cuối ô mật khẩu
const EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
  aria-hidden="true"><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5"/>
  <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>
  <path d="M2 2l20 20"/></svg>`;
// Ô mật khẩu kèm nút con mắt bật / tắt xem mật khẩu
const passwordField = (id, attrs) => `<div class="pw">
  <input id="${id}" type="password" maxlength="72" ${attrs}>
  <button type="button" class="eye" data-eye="${id}" aria-label="Hiện mật khẩu" aria-pressed="false" title="Hiện mật khẩu">${EYE}</button>
</div>`;

const VIEWS = {
  login: { title: 'Đăng nhập', button: 'Đăng nhập' },
  register: { title: 'Tạo tài khoản', button: 'Đăng ký' },
  forgot: { title: 'Quên mật khẩu', button: 'Gửi email đặt lại' },
  newPassword: { title: 'Đặt mật khẩu mới', button: 'Lưu mật khẩu' },
};

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export class AuthPanel {
  // opts: { error } câu báo lỗi hiện sẵn (vd link trong email đã hết hạn)
  constructor(opts = {}) {
    if (!document.getElementById('auth-css')) {
      const style = document.createElement('style');
      style.id = 'auth-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.firstError = opts.error ?? null;
    this.email = lastEmail();
  }

  open() {
    return this.show('login', (resolve) => {
      // Bấm link xác nhận trong email (mở tab mới) / đăng nhập ở tab khác: tab này cũng vào game luôn
      this.stopListening = onSignedIn((user) => this.finish(user));
      this.resolve = resolve;
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
    // Phím gõ trong bảng không lọt xuống game
    for (const type of ['keydown', 'keyup', 'keypress']) this.root.addEventListener(type, (e) => e.stopPropagation());
    document.body.appendChild(this.root);
    return new Promise((resolve) => {
      setup(resolve);
      this.render(view, this.firstError ? { text: this.firstError, err: true } : null);
      this.firstError = null;
    });
  }

  finish(value) {
    if (!this.root) return;
    this.stopListening?.();
    this.root.remove();
    this.root = null;
    this.resolve(value);
  }

  // Vẽ lại bảng theo màn: login | register | forgot | newPassword. msg: { text, err } câu báo dưới nút
  render(view, msg = null) {
    this.view = view;
    const v = VIEWS[view];
    const tabs = view === 'login' || view === 'register';
    this.root.innerHTML = `
      <form class="card" novalidate>
        <h2>Pokémon</h2>
        <p class="sub">${tabs ? 'Hành trình vùng Sơn Thủy' : v.title}</p>
        ${tabs ? `<div class="tabs">
          <button type="button" data-go="login" class="${view === 'login' ? 'on' : ''}">Đăng nhập</button>
          <button type="button" data-go="register" class="${view === 'register' ? 'on' : ''}">Đăng ký</button>
        </div>` : ''}
        ${view !== 'newPassword' ? `<label for="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254">` : ''}
        ${view !== 'forgot' ? `<label for="auth-pass">${view === 'newPassword' ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
          ${passwordField('auth-pass', `name="password" autocomplete="${view === 'login' ? 'current-password' : 'new-password'}"`)}` : ''}
        ${view === 'register' || view === 'newPassword' ? `<label for="auth-pass2">Nhập lại mật khẩu</label>
          ${passwordField('auth-pass2', 'autocomplete="new-password"')}` : ''}
        <button class="main" type="submit">${v.button}</button>
        <div class="msg"></div>
        ${view === 'login' ? '<div class="row"><button type="button" class="link" data-go="forgot">Quên mật khẩu?</button></div>' : ''}
        ${view === 'forgot' ? '<div class="row"><button type="button" class="link" data-go="login">← Quay lại đăng nhập</button></div>' : ''}
      </form>`;
    const $ = (sel) => this.root.querySelector(sel);
    this.form = $('form');
    this.emailInput = $('#auth-email');
    if (this.emailInput) this.emailInput.value = this.email;
    for (const b of this.root.querySelectorAll('[data-go]')) {
      b.addEventListener('click', () => {
        this.email = this.emailInput?.value.trim() ?? this.email;
        this.render(b.dataset.go);
      });
    }
    // Nút con mắt: bật / tắt xem mật khẩu của ô đó, con trỏ vẫn ở trong ô (không mất chỗ đang gõ)
    for (const eye of this.root.querySelectorAll('[data-eye]')) {
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
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    if (msg) this.say(msg.text, msg.err, msg.action);
    (this.emailInput && !this.email ? this.emailInput : $('#auth-pass') ?? this.emailInput)?.focus();
  }

  // Câu báo dưới nút. action: { label, run } thêm một link bấm được (vd Gửi lại email xác nhận)
  say(text, err = true, action = null) {
    const box = this.root.querySelector('.msg');
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
    const button = this.root?.querySelector('.main');
    if (!button) return;
    button.disabled = on;
    button.textContent = on ? 'Đang xử lý…' : VIEWS[this.view].button;
  }

  async submit() {
    const view = this.view;
    const email = this.emailInput?.value.trim() ?? '';
    const password = this.root.querySelector('#auth-pass')?.value ?? '';
    const again = this.root.querySelector('#auth-pass2')?.value ?? '';
    this.email = email || this.email;
    if (view !== 'newPassword' && !validEmail(email)) return this.say('Hãy nhập email hợp lệ.');
    if (view !== 'forgot' && password.length < PASSWORD_MIN) return this.say(`Mật khẩu cần ít nhất ${PASSWORD_MIN} ký tự.`);
    if ((view === 'register' || view === 'newPassword') && password !== again) return this.say('Hai lần nhập mật khẩu không khớp.');

    this.busy(true);
    this.say('');
    if (view === 'login') {
      const res = await signIn(email, password);
      if (!this.root) return; // tab khác vừa đăng nhập xong
      this.busy(false);
      if (res.code === 'email_not_confirmed') return this.say(res.error, true, this.resendAction(email));
      if (res.error) return this.say(res.error);
      setLastEmail(email);
      this.finish(res.data.user);
    } else if (view === 'register') {
      const res = await signUp(email, password);
      if (!this.root) return;
      this.busy(false);
      if (res.error) return this.say(res.error);
      // "Confirm email" đang tắt thì có phiên ngay: vào game luôn
      if (res.data.session) return this.finish(res.data.user);
      this.render('login', {
        text: `Đã gửi email xác nhận tới ${email}. Bấm link trong email, game sẽ tự đăng nhập (hoặc quay lại đây đăng nhập).`,
        err: false,
        action: this.resendAction(email),
      });
    } else if (view === 'forgot') {
      const res = await sendPasswordReset(email);
      this.busy(false);
      if (res.error) return this.say(res.error);
      this.say(`Nếu ${email} đã đăng ký, bạn sẽ nhận được email có link đặt lại mật khẩu.`, false);
    } else {
      const res = await setNewPassword(password);
      this.busy(false);
      if (res.error) return this.say(res.error);
      this.finish(res.data.user);
    }
  }

  resendAction(email) {
    return {
      label: 'Gửi lại email xác nhận',
      run: async () => {
        const res = await resendConfirmation(email);
        this.say(res.error ?? `Đã gửi lại email xác nhận tới ${email}.`, Boolean(res.error));
      },
    };
  }
}
