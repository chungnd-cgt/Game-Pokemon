# Ảnh màn đăng nhập

Thả ảnh vào thư mục này (đuôi `.png`, `.jpg`, `.webp`, `.gif` hoặc `.svg`), đặt đúng tên:

- `logo.svg` (hoặc `logo.png`): logo game "Pokémon Aurora Online", ở giữa phía trên khung đăng nhập. PNG thì nên nền trong suốt, rộng khoảng 600–800 px.
  Chỉ để một file tên `logo` (logo cũ "Sơn Thủy" giữ lại ở `logo-son-thuy.png`, game không dùng).
- `background.svg`: ảnh nền phủ kín màn hình (vẽ vector: mịn ở mọi độ phân giải). Ảnh được cắt cho vừa màn hình, nên dùng ảnh ngang, khoảng 1920×1080.

Thiếu ảnh nào thì màn đăng nhập dùng mặc định cho phần đó:

- không có `logo`: hiện chữ "Pokémon / Aurora Online";
- không có `background`: nền xanh như màn hình chính.

Ảnh tự co cho vừa: logo cao tối đa 230 px (canh giữa phía trên khung đăng nhập). Màn hình thấp (điện thoại nằm ngang)
thì nhỏ hơn để khung đăng nhập vẫn vừa. Ảnh nhỏ (≤ 256 px, ảnh pixel) được phóng to mà vẫn giữ nét vuông.

Sau khi thêm hoặc xoá ảnh, khởi động lại `npm run dev`.
Chỉ dùng ảnh bạn có quyền dùng (tự vẽ, mua, hoặc giấy phép cho phép).
