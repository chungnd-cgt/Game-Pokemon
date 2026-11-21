# Ảnh màn đăng nhập

Thả ảnh vào thư mục này (đuôi `.png`, `.jpg`, `.webp`, `.gif` hoặc `.svg`), đặt đúng tên:

- `logo.png`: logo game, ở giữa phía trên khung đăng nhập. Nên dùng PNG nền trong suốt, rộng khoảng 600–800 px.
- `art.png`: ảnh minh hoạ lớn bên phải logo. Nên dùng PNG nền trong suốt.
- `background.jpg`: ảnh nền phủ kín màn hình. Ảnh được cắt cho vừa màn hình, nên dùng ảnh ngang, khoảng 1920×1080.

Thiếu ảnh nào thì màn đăng nhập dùng mặc định cho phần đó:

- không có `logo`: hiện chữ "Pokémon / Hành trình vùng Sơn Thủy";
- không có `art`: chỉ có logo;
- không có `background`: nền xanh như màn hình chính.

Ảnh tự co cho vừa: logo cao tối đa 230 px, ảnh minh hoạ cao tối đa 360 px. Màn hình thấp (điện thoại nằm ngang) thì nhỏ
hơn, và ảnh minh hoạ được ẩn đi để khung đăng nhập vẫn vừa. Ảnh nhỏ (≤ 256 px, ảnh pixel) được phóng to mà vẫn giữ nét vuông.

Sau khi thêm hoặc xoá ảnh, khởi động lại `npm run dev`.
Chỉ dùng ảnh bạn có quyền dùng (tự vẽ, mua, hoặc giấy phép cho phép).
