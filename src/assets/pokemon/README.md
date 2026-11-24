# Sprite Pokémon

Thả file PNG vào thư mục này, tên file trùng với id trong `src/data/monsters.js`. **Chỉ cần 1 ảnh mặt trước**
(nhìn trực diện, như ảnh Pokémon đối thủ trong game gốc: mặt hơi quay sang trái), vd `charmander.png`. Game tự làm phần còn lại:

- Pokémon đối thủ, màn chọn khởi đầu, đội hình, Pokédex...: ảnh mặt trước giữ nguyên
- Hình LƯNG tự tạo từ ảnh mặt trước (`gfx/pixel.js: autoBackView`): tô lại phần thân bằng màu thân (mất mắt, miệng, bụng),
  giữ viền và phần chìa ra khác màu (lửa đuôi, cánh...), lật ngang. Dùng cho Pokémon của mình khi đánh (quay về phía đối thủ)
  và khi Pokémon đi theo đi lên trên
- Pokémon đi theo: đi xuống mặt trước, đi lên hình lưng, đi trái mặt trước, đi phải mặt trước lật ngang

Loài có ảnh PNG thì mọi chỗ đều dùng ảnh PNG đó (không trộn với hình vẽ sẵn khác kiểu).

Hình lưng tự tạo chỉ là hình gần đúng. Nếu có ảnh vẽ riêng thì thêm `charmander-back.png` (nhìn từ phía sau) và / hoặc
`charmander-side.png` (nhìn nghiêng, mặt quay sang trái), game dùng ảnh đó thay cho hình tự tạo. Chép y nguyên ảnh mặt trước
sang hai tên này thì game bỏ qua.

Thiếu file nào thì game dùng hình vẽ sẵn cho con đó. Ảnh được tự co giãn cho vừa khung,
nên kích thước nào cũng được (sprite 96×96 hay 64×64 đều ổn). Viền trong suốt thừa quanh hình được tự cắt bỏ khi nạp
(ảnh 120×112 mà con Pokémon chỉ chiếm góc dưới vẫn hiện to đúng cỡ). Ảnh nhỏ (≤ 160 px) giữ nét pixel, ảnh lớn được làm mịn.
Sau khi thêm hoặc xoá file, khởi động lại `npm run dev`.
