# Pokémon Demo

Bản demo game Pokémon 2D chạy trên trình duyệt (chạy local), lấy cảm hứng từ Pokémon Revolution Online.
Viết bằng [Phaser 3](https://phaser.io) + [Vite](https://vite.dev).

## Chạy game

Cần cài [Node.js](https://nodejs.org) 20.19 trở lên (hoặc 22.12 trở lên).

```bash
npm install      # chỉ cần chạy lần đầu
npm run dev      # mở http://localhost:5173 trên trình duyệt
```

Sửa code xong, trình duyệt tự tải lại.

## Tài khoản & bản lưu trên mạng (Supabase)

Phải đăng nhập mới chơi được. Mỗi tài khoản đúng **1 bản lưu**, nằm trên [Supabase](https://supabase.com) nên đổi máy /
trình duyệt vẫn chơi tiếp được.

**Cài đặt lần đầu** (người làm game, một lần cho mỗi project Supabase):

1. Tạo project Supabase. Authentication → Sign In / Providers → **Email**: bật. "Confirm email" bật thì người chơi phải bấm
   link trong email mới đăng nhập được. Dịch vụ gửi mail có sẵn của Supabase chỉ gửi được rất ít mail; cho người khác chơi thì
   cấu hình SMTP riêng (Authentication → Emails → SMTP Settings).
2. Authentication → URL Configuration: **Site URL** = địa chỉ game (chạy dev: `http://localhost:5173`); thêm địa chỉ thật vào
   **Redirect URLs** khi deploy. Link trong email (xác nhận, đặt lại mật khẩu) mở lại đúng địa chỉ này.
3. SQL Editor → dán toàn bộ [`supabase/schema.sql`](supabase/schema.sql) → **Run** (tạo bảng `saves`, bật RLS: mỗi người chỉ
   đọc / ghi được bản lưu của mình).
4. Chép `.env.example` thành `.env.local`, điền **Project URL** và khoá **anon / publishable** (Project Settings → API Keys).
   Không bao giờ dùng khoá secret / service_role trong game. `.env.local` không được đưa lên git.

**Luồng chơi:** mở game → bảng **Đăng nhập / Đăng ký / Quên mật khẩu** (`src/ui/AuthPanel.js`, HTML đè lên game). Đăng nhập
xong vào game luôn: tài khoản có bản lưu thì chơi tiếp, chưa có thì tạo nhân vật rồi chơi mới (không còn menu Tiếp tục / Chơi
mới / Xoá dữ liệu). Đăng ký khi bật "Confirm email": bấm link trong email là game tự đăng nhập. Đăng nhập lần đầu mà máy này
còn bản lưu từ trước khi có tài khoản thì game hỏi có dùng bản đó cho tài khoản không. **Đăng xuất**: Cài đặt → Chung.
Ô **Ghi nhớ đăng nhập** (mặc định bật): mở lại game là vào thẳng, email điền sẵn; bỏ tích thì đóng tab / trình duyệt là phải
đăng nhập lại (phiên đăng nhập cất trong sessionStorage thay vì localStorage, `src/online/supabase.js`).

**Lưu game** vẫn như cũ (tự lưu vào máy sau mỗi sự kiện, mỗi lượt đánh...), rồi `src/online/cloudSave.js` gửi bản mới nhất
lên Supabase vài giây sau lần lưu và ngay khi ẩn / đóng tab. Tắt ngang, văng game, mất mạng: bản trên máy vẫn còn, lần mở game
sau thấy còn thay đổi chưa gửi thì dùng bản trên máy và gửi lên. Mở cùng tài khoản ở hai nơi: nơi lưu trước được giữ, nơi
còn lại thôi lưu và báo đỏ ở góc màn hình (bảng `saves` có cột `version` tự tăng, ghi lên kèm điều kiện đúng version).

## Build ra web

```bash
npm run build
```

Toàn bộ game nằm trong thư mục `dist/`, upload lên hosting tĩnh nào cũng chạy được.

## Cốt truyện – Chương 1: Khởi hành

**Thị trấn Pallet** là thị trấn nhỏ chỉ có 4 ngôi nhà: nhà bạn (2 tầng), nhà Gary (2 tầng: chị Đào ở tầng 1, Gary ở phòng
mình trên tầng 2), nhà bà Tư hàng xóm (Pidgey của bà lang thang quanh luống hoa giữa thị trấn)
và phòng thí nghiệm của Giáo sư Oak. Pallet **không có Pokémon Center hay Poké Mart**: Pokémon mệt thì về nhà nói chuyện với mẹ
để hồi phục. Phía bắc là **bụi cỏ duy nhất** chắn lối ra sang Tuyến đường 2; phía nam là hồ nước (câu cá; nước hồ chảy ra
Sông Lục Bình). Bãi cỏ không có vật phẩm; hai góc dưới thị trấn có 2 thuốc giải độc (trái) và 2 thuốc giải tê liệt (phải).
Không có cây quả mọng.

0. Đăng nhập tài khoản chưa có bản lưu: tạo nhân vật (giới tính, kiểu tóc, màu tóc, màu da, trang phục, màu mắt), rồi gõ tên (tối đa 12 ký tự, gõ được tiếng Việt;
   để trống thì tên là Khang / Linh). Tên xuất hiện trong lời chào, lời Gary và Nhà vô địch.
1. Thức dậy ở **phòng ngủ tầng 2**, đi cầu thang (góc trên bên phải) xuống phòng khách tầng 1 nói chuyện với **mẹ**
   (mẹ ngồi trên bộ sofa đặt đối xứng hai bên bàn nước): mẹ cho **2 Potion**.
2. Định đi vào bụi cỏ phía bắc thì **Giáo sư Oak** chặn lại và dẫn về phòng thí nghiệm.
3. Chọn **Bulbasaur, Charmander hoặc Squirtle** (từ chối cả ba thì được chọn quả bóng bí mật: **Pikachu**).
   **Gary** (cháu của Giáo sư) lúc này vẫn ở trên phòng mình (tầng 2 nhà mái đỏ). Chọn xong thì Gary mới chạy vào phòng thí nghiệm,
   thấy bạn đã chọn thì lấy con khắc hệ rồi về đứng cạnh bạn.
   Giáo sư dặn dò cả hai, sau đó Gary thách đấu (Lv 5). Lúc chia tay, Gary **hẹn đấu lại** ở Thị trấn Lục Bình trước khi lên đường.
4. Đấu xong với Gary, Giáo sư Oak tặng **Pokédex** (biểu tượng Pokédex hiện trên đầu nhân vật) và **5 Poké Ball**.
   Nhiệm vụ: **bắt Pokémon hoang dã đầu tiên** rồi báo cho Giáo sư Oak (Pokémon khởi đầu không tính; bắt ở bụi cỏ phía bắc).
   Chưa xong nhiệm vụ thì chưa ra khỏi thị trấn được.
5. Báo cho Giáo sư Oak: nhận **3 Potion**, nghe tin Team Rocket gây rối ở **Thị trấn Lục Bình**.
   Còn một ô nữa là bước sang Tuyến đường 2 thì **tiếng mẹ gọi với theo**: mẹ chạy ra tặng **Bản đồ vùng** (có nó mới bấm N xem bản đồ được)
   và **Hộp huy hiệu** rồi mới đi tiếp.
6. Băng qua bụi cỏ phía bắc, theo **Tuyến đường 2** (tuyến làm quen: 1 dãy cây quả mọng, chỉ 2 nhà huấn luyện, mọi Pokémon tối đa Lv 7, chủ yếu là sâu bọ: dòng Caterpie, dòng Weedle, Oddish, Pikachu hiếm) tới **Thị trấn Lục Bình**:
   thị trấn đầu tiên có Pokémon Center, Poké Mart (phía nam đường chính, cạnh ao; góc tây bắc ngay lối vào là hai nhà dân).
   Trước cửa hang là **gò đất 2 tầng viền gờ đá** (màu đá như vách núi) như game gốc: tầng dưới viền gờ chữ L,
   tầng trên viền gờ chữ L ngược. Lên tầng dưới từ phía đông (cạnh lối vào hang), men theo gờ sang tây rồi qua khe lên tầng trên
   (dãy 3 cây quả mọng Oran / Pecha / Cheri dời từ Tuyến đường 2 sang, 2 Repel). Nhảy gờ xuống phía tây / nam / đông là về thẳng
   Pokémon Center; gờ chỉ nhảy xuống được, không leo ngược lên. Gò nằm sát vách núi, chừa đúng một ô làm lối đi bên cạnh.
   Nhảy gờ thì người nhảy trước, Pokémon đi theo bước tới mép gờ rồi mới nhảy theo sau.
   Bộ đôi **Team Rocket** (Hùng, Mai và Meowth) đứng hàng ngang chặn cửa Poké Mart. Bước tới trước mặt hoặc nói chuyện là bị gây sự.
   Hùng và Mai mỗi người một trận: thắng người này thì người kia ra đấu tiếp. Thua thì về chỗ hồi phục, quay lại đấu tiếp người còn lại.
   Thắng cả hai thì cả bọn bỏ lại gói hàng, chuồn bằng khinh khí cầu Meowth.
7. Nhặt **gói hàng**, mang vào trả nhân viên Poké Mart.
8. Chuẩn bị lên đường tới **Hang Thạch Nhũ** (dưới vách đá phía đông bắc Lục Bình) thì **Gary** bước ra từ Pokémon Center,
   đấu lại như đã hẹn (Pidgey và Pokémon khởi đầu, **Lv 8**). Thua thì về Pokémon Center, lần sau tới cửa hang lại gặp;
   thắng thì Gary vào hang trước, hết chương 1, cửa hang mở.

Mục tiêu hiện tại luôn hiện ở góc phải dưới màn hình (bấm vào khung để thu gọn / mở ra).
Cốt truyện viết trong `src/story/chapter1.js` (nhân vật, hội thoại, cảnh cắt, mục tiêu).
Bản lưu cũ đang dở chương 1 vẫn chơi tiếp được: Team Rocket và gói hàng giờ ở Lục Bình (giữ nguyên cờ tiến độ);
đã đấu Gary ở cổng Pallet (bản trước) thì trả gói hàng là hết chương, đã trả gói hàng mà chưa đấu Gary thì thắng Gary ở Lục Bình
là hết chương; chỗ đứng cũ ngoài Pallet mới được dời về ô đi được gần nhất.

## Chương 2: Hành trình 8 gym vùng Sơn Thủy

Xong chương 1 thì từ Lục Bình vào Hang Thạch Nhũ và lần lượt thách đấu 8 gym. **Gym nằm trong 8 thành phố**; ngay trước mỗi thành phố
là **một làng nhỏ**. Ở làng bạn hồi phục, mua đồ, nghe mẹo về gym sắp tới và làm **nhiệm vụ cốt truyện của làng**.
Làm xong nhiệm vụ thì đường từ làng vào thành phố mới mở. Lối ra phía bên kia thành phố chỉ mở khi đã có huy hiệu của gym đó.

**Team Rocket** (Hùng, Mai và Meowth, biểu tượng của cả bọn) còn quay lại gây chuyện, mỗi lần một mạnh hơn,
Pokémon trong đội tiến hoá theo khu vực. Cách đấu như ở Lục Bình: Hùng và Mai mỗi người một trận, thắng cả hai thì cả bọn chuồn
và đánh rơi đồ. Viết trong `src/story/rocket.js`.

| Nơi | Khi nào | Chuyện | Đội Hùng / Đội Mai | Đánh rơi |
| --- | --- | --- | --- | --- |
| Thị trấn Lục Bình (chương 1) | Xong nhiệm vụ của Oak | Cướp gói hàng, chặn cửa Poké Mart | Koffing / Ekans (Lv 7) | Gói hàng |
| Hang Thạch Nhũ | Sau chương 1 | Đào trộm đá quý, chặn lối hẹp (chuồn bằng bom khói) | Koffing, Bellsprout / Ekans, Zubat (Lv 12-13) | Thunder Stone |
| Thành phố Đèn Lồng | Sau huy hiệu 2 | Định trộm điện, chặn cửa gym | Koffing, Weepinbell / Arbok, Golbat (Lv 24-25) | 3 Ultra Ball |
| Thành phố Lò Gốm | Sau huy hiệu 4 | Cướp gốm quý, chặn cửa Poké Mart | Weezing, Victreebel / Arbok, Golbat (Lv 35-36) | Fire Stone |
| Thành phố Sương Mù | Sau huy hiệu 7 | Định bắt trộm Pokémon băng, chặn cửa gym | Weezing, Victreebel, Arcanine / Arbok, Golbat, Lickitung (Lv 46-47) | Max Revive |

Bấm **N** để xem bản đồ vùng (thành phố là ô vuông lớn, làng là ô vuông nhỏ; thành phố đã thắng gym có chấm vàng). Huy hiệu đã có
xem ở **Thẻ Huấn luyện viên** (phím **T**).

| # | Làng trước thành phố | Thành phố | Thủ lĩnh | Hệ | Câu đố trong gym |
|---|----------------------|-----------|----------|----|------------------|
| 1 | Làng Chân Đồi | Đồi Gió | Phong | Bay | Sân thượng lộng gió nhiều tầng: hàng gió thổi rơi xuống tầng dưới, chỉ vài ô gió ngược đưa lên, luồng gió ngang cuốn đi; phải chọn đúng luồng gió |
| 2 | Xóm Cối Xay | Lúa Vàng | Thảo | Cỏ | Mê cung hàng rào tre 3 phòng, **cổng liên kết**: mỗi công tắc mở cổng này nhưng đóng cổng kia, phải dẫm đúng thứ tự |
| 3 | Xóm Trạm Điện | Đèn Lồng | Quang | Điện | **Gym tối om**: thắp đèn lồng (bấm vào cột đèn) để soi sáng cả vùng; hàng rào điện đổi chỗ khi bật / tắt điện ở từng phòng. Tường điện là khối thép đen viền xanh, viền và hàng rào điện phát sáng xuyên bóng tối nên vẫn nhìn ra lối đi |
| 4 | Làng Bến Đò | Sông Nước | Thủy | Nước | Các đảo đá giữa hồ sâu: dòng nước cuốn từ đảo này sang đảo khác, **xoáy nước** cuốn về lối vào, 2 **cửa cống** có công tắc ở 2 đảo khác nhau; dòng nước sát mép tây chảy thẳng từ chỗ thủ lĩnh về lối vào |
| 5 | Làng Đất Sét | Lò Gốm | Nung | Lửa | 4 hàng **miệng lò phun lửa thay phiên theo nhịp**, than hồng hai bên: đi zíc zắc và canh lúc lửa tắt |
| 6 | Bản Vách Đá | Núi Đá | Sơn | Đá | **Đẩy tảng đá** (khối đá màu cát) lăn xuống lấp hố để làm đường; đẩy hỏng thì ra ngoài vào lại |
| 7 | Xóm Hương Khói | Chùa Cổ | Tâm | Siêu linh | 7 phòng chỉ nối nhau bằng ô dịch chuyển, có ô dẫn vào ngõ cụt hoặc về phòng đầu; phải đi đúng 4 lần dịch chuyển; phòng thủ lĩnh có ô đưa về phòng đầu |
| 8 | Làng Đèo Tuyết | Sương Mù | Tuyết | Băng | Hai sân băng: trượt tới khi đụng tảng băng, tìm điểm dừng ngay dưới khe để lên bục giữa rồi qua sân trên |

Mỗi gym rộng 17 ô, cao 17-20 ô (cuộn theo người chơi), thủ lĩnh đứng giữa phía trên, hướng dẫn viên ở cạnh lối vào giải thích
câu đố, 2-3 học trò đứng ở chỗ không chắn lối duy nhất. Bố cục gym ở `src/data/mapsGyms.js`, người trong gym ở `src/data/gymPeople.js`;
test (`tests/region.test.js`) giải từng gym bằng tìm đường và kiểm tra bỏ cơ chế của gym đi thì không tới được thủ lĩnh,
và từ chỗ thủ lĩnh luôn có đường về lối vào (chưa đấu mà muốn ra hồi máu cũng không bị kẹt).

**Thắng thủ lĩnh rồi thì câu đố trong gym ngừng hoạt động** (ngay sau trận và mỗi lần vào lại): cổng tre / hàng rào điện / cửa
cống biến mất, Gym Đèn Lồng sáng đèn, Gym Đồi Gió tắt gió, miệng lò tắt lửa, hố ở Gym Núi Đá đã lấp, sân băng hết trơn,
than hồng / xoáy nước chỉ còn là ô cản, ô dịch chuyển ở phòng đầu Gym Chùa Cổ đưa thẳng lên phòng thủ lĩnh. Gym Sông Nước giữ
dòng nước (đường duy nhất giữa các đảo). Sàn cũng vẽ lại theo (mũi tên gió, sàn băng, miệng lò thành sàn thường: bản vẽ
`<gym>-ground-cleared` dựng sẵn trong `src/gfx/world.js`). Hướng dẫn viên thôi giảng giải câu đố, chuyển sang chúc mừng.
Cài đặt ở cuối `src/data/mapsGyms.js` (AFTER_BADGE), xử lý ô ở `GameMap.calmTiles`.

8 huy hiệu mỗi cái một hình riêng (`src/gfx/badges.js`): Cánh Gió là đôi cánh quanh vòng xoáy gió, Lá Mạ là chồi lúa trên giọt
sương, Đèn Lồng là đèn lồng đỏ có tia sét, Sóng Bạc là ngọn sóng cuộn trong vòng bạc, Lò Gốm là chum gốm có ngọn lửa,
Thạch Sơn là núi đá khảm trong viên đá bát giác, Liên Hoa là hoa sen, Băng Tuyết là bông tuyết sáu cánh.

### Lộ trình

Hành trình vẫn là **một đường thẳng, không rẽ nhánh**, nhưng mỗi chặng giờ có 3 bước:
**tuyến đường → làng nhỏ (nhiệm vụ cốt truyện) → thành phố có gym**. Đoạn Pallet → Đồi Gió có thêm Thị trấn Lục Bình
(thị trấn đầu tiên, có Pokémon Center / Poké Mart) và Hang Thạch Nhũ,
đoạn Núi Đá → Chùa Cổ đi xuyên Hang Sơn Động (ra khỏi hang là tới Xóm Hương Khói).

```
Pallet ─ Tuyến 2 ─ Lục Bình ─ Hang Thạch Nhũ ─ Tuyến 3 ─ Làng Chân Đồi ─ Đồi Gió [1]
  └─ (lướt nước, từ hồ phía nam Pallet) Sông Lục Bình ─ ao Lục Bình
  ─ Tuyến 4 ─ Xóm Cối Xay ─ Lúa Vàng [2] ─ Tuyến 5 ─ Xóm Trạm Điện ─ Đèn Lồng [3]
  ─ Tuyến 6 ─ Làng Bến Đò ─ Sông Nước [4] ─ Tuyến 7 ─ Làng Đất Sét ─ Lò Gốm [5]
  ─ Tuyến 8 ─ Bản Vách Đá ─ Núi Đá [6] ─ Tuyến 9 ─ Hang Sơn Động ─ Xóm Hương Khói ─ Chùa Cổ [7]
  ─ Tuyến 10 ─ Làng Đèo Tuyết ─ Sương Mù [8] ─ Đường Chiến Thắng ─ Hang Vân Sơn ─ Cao nguyên Liên Minh
```

| Đoạn đường | Hướng đi | Có gì | Cần để đi tiếp |
|------------|----------|-------|----------------|
| Pallet → Tuyến đường 2 → Thị trấn Lục Bình | Bắc rồi đông | Tuyến làm quen 40×32 quanh co: bụi cỏ, ao có cồn cát, dốc phía tây, ngách cụt có đồ, gờ đất trước lối ra là đường tắt về Pallet; 2 nhà huấn luyện + người đi đường chỉ dẫn, Pokémon tối đa Lv 7 (Caterpie, Metapod, Weedle, Kakuna, Oddish; Pikachu hiếm), dãy cây quả mọng, bụi cỏ rậm; Lục Bình có Pokémon Center, Poké Mart, Team Rocket, ao đầy lục bình tím, gò đất 2 tầng có dãy quả mọng | Xong nhiệm vụ của Oak (bắt Pokémon đầu tiên) để ra khỏi Pallet |
| Sông Lục Bình | Từ hồ phía nam Pallet, xuôi về ao phía tây nam Lục Bình | Bãi bồi có Rare Candy, Mystic Water, Water Stone, 2 Revive, 3 Ultra Ball; ông câu cá; Pokémon nước Lv 30-37, câu được Dratini (cần câu siêu) | Pokémon biết Surf (sau Gym Sông Nước) hoặc cưỡi Lapras |
| Hang Thạch Nhũ (2 tầng) | Vào cửa hang dưới vách đá phía đông bắc Lục Bình, ra phía bắc | Tầng 1 bị vách đá chia đôi: xuống tầng hầm bằng thang phía đông nam, băng qua tầng hầm (đá chắn lối, Onix, Machop) rồi leo thang tây bắc lên nửa bắc. 4 nhà huấn luyện, 10 vật phẩm ở các ngách, Team Rocket chặn ngay trước lối ra | Xong chương 1 (trả gói hàng cho Poké Mart Lục Bình, thắng Gary trước cửa hang) |
| Tuyến đường 3 → Làng Chân Đồi → Đồi Gió | Đông | Tuyến núi 44×32 từ cửa hang: thung lũng, đường mòn giữa các mỏm đá, hồ trên núi (lướt nước, câu cá, Water Stone trên cồn), sườn đông có gờ tắt xuống làng; 4 nhà huấn luyện (1 kình ngư dưới hồ) | Nhiệm vụ làng để vào thành phố; huy hiệu Bay để ra lối đông |
| Tuyến đường 4 "Đồng Gió Lúa" → Xóm Cối Xay → Lúa Vàng | Đông | 48×28, các dải đồng hình chữ S, bờ ruộng bậc thang ngoằn ngoèo, bãi chăn Ponyta có rào; 4 nhà huấn luyện, 3 ngách cụt có đồ | Nhiệm vụ làng; huy hiệu Cỏ để ra lối bắc |
| Tuyến đường 5 "Bãi Đá Trạm Điện" → Xóm Trạm Điện → Đèn Lồng | Bắc rồi tây | 40×30, ba bậc đá viền gờ (nhảy gờ về nhanh), trạm biến áp có rào, bãi đá cao có Geodude / Onix; 4 nhà huấn luyện | Nhiệm vụ làng (có trận với Gary); huy hiệu Điện để ra lối tây |
| Tuyến đường 6 "Ven Hồ Gương" → Làng Bến Đò → Sông Nước | Tây | 48×28, vòng quanh hồ lớn và vịnh nhỏ, cầu gỗ qua suối, bến câu nhô ra hồ, cồn cát giữa hồ chỉ lướt nước tới được; 4 nhà huấn luyện | Nhiệm vụ làng; huy hiệu Nước để ra lối tây nam |
| Tuyến đường 7 "Đồi Đất Sét" → Làng Đất Sét → Lò Gốm | Tây | 44×28, vách đất sét buộc xuống chân đồi rồi leo 4 bậc ruộng bậc thang (gờ so le), sân lò gốm, hố đất sét cỏ rậm; 4 nhà huấn luyện | Nhiệm vụ làng; huy hiệu Lửa để ra lối tây |
| Tuyến đường 8 "Hẻm Núi Đá" → Bản Vách Đá → Núi Đá | Tây | 40×32, khe đông xuống đáy hẻm (người leo núi chặn), leo khe giữa lên hành lang đá, cao nguyên nhiều bậc gờ là đường tắt về; bão cát; 4 nhà huấn luyện | Nhiệm vụ làng; huy hiệu Đá để ra lối nam |
| Tuyến đường 9 "Rừng Tre ven suối" → Hang Sơn Động → Xóm Hương Khói → Chùa Cổ | Nam, vào hang ở bờ suối phía đông | 40×32, đường mòn rừng tre, 2 cầu gỗ qua suối (câu cá được), cồn cát giữa suối; 4 nhà huấn luyện. Hang Sơn Động 2 tầng (tầng 1 bị vách chia đôi, xuống hầm rồi leo lên mới tới cửa ra), thang thứ 3 lên phòng kín có Golem, Ditto và **Old Amber** (hoá thạch Aerodactyl) | Nhiệm vụ làng (có trận với Gary); huy hiệu Siêu linh để ra lối đông |
| Tuyến đường 10 → Làng Đèo Tuyết → Sương Mù | Đông | 44×30 đường núi tuyết dần: sườn cỏ cao, xuống vách đá theo bậc gờ, leo dọc bờ Hồ Lạnh lên đỉnh đèo (gờ một chiều về Chùa Cổ); 4 nhà huấn luyện | Nhiệm vụ làng; huy hiệu Băng để ra lối đông |
| Đường Chiến Thắng → Hang Vân Sơn → Liên Minh | Đông rồi bắc | 36×34: lính gác 8 huy hiệu, thung lũng, sườn núi 3 bậc viền gờ lối lên so le, 4 tinh anh Lv 47-52 chặn từng chặng, Leftovers / Rare Candy trong ngách. Hang Vân Sơn hang băng 3 tầng (tầng 1 bị chia đôi), hầm băng sâu nhất có Lapras, Dragonair, Never-Melt Ice, Lucky Egg | Đủ 8 huy hiệu (lính gác) |

- Tuyến đường rộng 40-48 ô, cao 28-34 ô, mỗi tuyến một kiểu địa hình riêng, đường chính quanh co (60-130 bước), có nhánh và
  ngách cụt giấu vật phẩm, gờ đất một chiều làm đường tắt khi quay về, 3-4 nhà huấn luyện, nhiều khu bụi cỏ (có khu cỏ rậm).
  Hang có 2-3 tầng nối bằng thang (ô `L` hố có thang xuống, ô `U` thang lên).
- Làng rộng 26×20 ô: Pokémon Center, Poké Mart (bán như thành phố ngay sau nó nhưng không có Max Revive), vài nhà dân,
  dân làng chỉ cách khắc chế gym sắp tới. **Thị trấn, thành phố, làng không có bụi cỏ có Pokémon hoang dã** (trừ Pallet);
  nhiệm vụ của làng diễn ra ở một **khu phụ** bên cạnh làng (rừng, mỏ đá, nghĩa trang, đèo tuyết...).
- Thành phố rộng 32×22 ô, có Pokémon Center, Poké Mart (Sông Nước là Trung tâm thương mại) và gym.
- Đường đi đã qua thì luôn quay lại được (trừ các phòng Tứ Thiên Vương), nên muốn luyện cấp thì quay về tuyến đường cũ
  hoặc đấu lại nhà huấn luyện sau 3-4 ngày.
- Trong code, Thị trấn Pallet có id bản đồ là `route1`, Thị trấn Lục Bình là `town1`, Sông Lục Bình là `river1`,
  thành phố có gym là `town2`-`town9`, làng là `village1`-`village8`. Pokémon Center / Poké Mart của Lục Bình là `center` / `mart`.
  Dòng sông nối hai bản đồ bằng `warps` trên ô nước: đang lướt nước đi qua thì sang bên kia vẫn ở dưới nước.
  Các bản đồ nối nhau bằng `warps` (lối đi ở mép bản đồ), lối bị chặn bằng `gates`:
  `{ badge }` cần huy hiệu, `{ badges }` cần đủ số huy hiệu, `{ village }` cần xong nhiệm vụ làng (kiểm tra ở `badgeGate` trong `src/story/chapter2.js`).
  Bản đồ vùng (phím N) vẽ theo `src/data/region.js`.

### Nhiệm vụ cốt truyện ở các làng

Tới làng mà đường vào thành phố bị chặn: đi tới cổng hoặc hỏi dân làng để biết chuyện, rồi nói chuyện với người nhờ để nhận nhiệm vụ.
Mục tiêu ở góc phải dưới màn hình đổi theo từng bước. Pokémon hoang dã trong nhiệm vụ hạ gục hay bắt được đều tính là xong.

| Làng | Chuyện | Việc cần làm | Phần thưởng |
|------|--------|--------------|-------------|
| Làng Chân Đồi | Bé Tí đi lạc trong **Rừng Thông sau làng**; bố bé là người dẫn đường lên dốc gió bỏ đi tìm con nên trưởng làng đóng đường | Hỏi mẹ bé Tí, theo lối mòn sau bụi cỏ phía bắc làng vào rừng. Bố bé Tí ở bãi đầu rừng chỉ hướng; bé ở bãi hoa góc tây bắc, phải vòng qua bãi đông bắc và hành lang phía bắc (2 nhà huấn luyện) mới tới. Đánh con Pidgeotto (Lv 16) đang dồn bé, dắt bé về làng: bé chạy ùa tới mẹ, mẹ cảm ơn rồi hai mẹ con vào nhà. Từ bãi hoa nhảy gờ đất xuống là đường tắt về | 3 Super Potion |
| Xóm Cối Xay | Gloom đầu đàn rải phấn ngủ, anh Cốm (con bác thợ xay) ngủ mê ngoài đồng; dân xóm rào đường sang Lúa Vàng | Lối mòn phía bắc xóm ra **Đồng Cối Xay**: bờ ruộng ngoằn ngoèo, suối có 2 cầu gỗ (cầu tây là đường cụt). Oddish chắn cầu đông, Bellsprout chắn lối xuống sân kho thóc cũ, Gloom (Lv 21) ở góc tây bắc. Anh Cốm tỉnh dậy, bầy Pokémon cỏ vào sống ở kho thóc cũ; về xóm bác thợ xay dỡ rào. Gờ đất ở sân kho là đường tắt về | 3 Awakening, 3 Antidote |
| Xóm Trạm Điện | Trạm biến áp cháy cầu chì, cổng điện tử sang Đèn Lồng tắt; cậu học việc Tín đi tìm cầu chì chưa về | Góc tây nam xóm lên **Đồi Cột Điện**: 4 bậc đồi ngăn bằng vách đá, khe xuống ở đầu bên kia. Nhặt 3 cầu chì (cái cuối trong hõm trạm phát cũ, Magneton chắn), tìm cậu Tín ở bậc cuối; Tín dẫn về xóm, kỹ sư lắp cầu chì. Có điện thì **Gary** chặn ở cổng phía tây | 3 Paralyze Heal |
| Làng Bến Đò | Cầu gỗ trong làng hỏng, chú thợ mộc chờ bè gỗ; Gyarados (Lv 30) chặn bè gỗ trên đầm | Lối phía bắc làng ra **Đầm Lau**: sông chia hai bờ, lối lau sậy ngoằn ngoèo, một cầu ván qua sông, vòng mé tây qua lau sậy rậm lên bờ đầm. Đuổi / bắt Gyarados trên cầu ván, theo bè gỗ về làng: sửa xong cầu, thợ mộc về nhà, ông lái đò tặng quà | 2 Hyper Potion |
| Làng Đất Sét | Hai tay buôn đất lậu bắt giữ chú Sét trong mỏ, xe chở đất chắn cổng làng | Cửa mỏ ở vách đá tây bắc làng vào **Mỏ Đất Sét** (hang): sảnh, hầm dưới, hầm đông (tay buôn Lực canh, không lén qua được), hầm trên rồi xuống hầm chính (Tài giữ chú Sét). Thắng cả hai, chú Sét dẫn về làng; người đánh xe đánh xe ra lối sang Lò Gốm. Đường hầm buôn lậu là lối leo thẳng lên làng | 3 Burn Heal |
| Bản Vách Đá | Đá lở chắn đường sang Núi Đá; Machoke của võ sư Hổ hoảng sợ chạy lên mỏ, võ sư đi tìm chưa về | Lối phía bắc bản lên **Mỏ Đá Vách Núi**: đá lở chặn lối giữa, vòng hành lang vách núi phía đông lên hố mỏ cũ. Đuổi Golbat đầu đàn (Lv 40) đang dồn Machoke, rồi thắng võ sư Hổ (Machop, Machoke, Hitmonchan Lv 37-39); thầy trò xuống bản, Machoke dọn đá. Gờ đá từ hố mỏ là đường tắt về | 2 Revive |
| Xóm Hương Khói | Haunter cuỗm chuông đồng của miếu, chú tiểu Minh đuổi theo mất tích; không có chuông thì cổng Chùa Cổ không mở | Lối đông nam xóm xuống **Nghĩa Trang Rừng Trúc**: rừng trúc mê cung, nghĩa trang cổ (Haunter trêu rồi bay đi), cầu gỗ qua suối, miếu hoang góc tây nam. Đánh Haunter (Lv 41) chặn cửa miếu, đưa chú tiểu về; sư thầy gióng chuông, chú tiểu vào miếu. Chuông ngân thì **Gary** chặn ở cổng phía đông | 2 Full Heal |
| Làng Đèo Tuyết | Anh Đông, người dẫn đường qua đèo, mắc kẹt trên đèo | Lối đông bắc làng lên **Đèo Tuyết**: đường đèo 4 tầng, lối lên so le hai đầu, hồ băng. Anh Đông trú trong hốc đá trên đỉnh, đánh Jynx (Lv 44) chặn cửa; về làng anh chạy tới mẹ rồi ra cổng đèo đứng chờ dẫn đường. 2 gờ tuyết là đường tắt xuống | 3 Ice Heal |

Mỗi khu phụ (`src/data/mapsVillageAreasA.js`, `mapsVillageAreasB.js`) có bảng Pokémon hoang dã riêng, 2 nhà huấn luyện chắn lối,
người chỉ đường và vật phẩm ở các ngách cụt. Xong nhiệm vụ thì người trong cảnh đi về đúng chỗ của mình (vào nhà, ra lối,
về chỗ làm việc); Pokémon phá hoại bay đi hoặc bỏ chạy, không biến mất giữa đường.

### Gary: đối thủ suốt hành trình

Gary dùng Pokémon khởi đầu khắc hệ với bạn và gặp lại **7 lần**. Đội hình mạnh dần, Pokémon khởi đầu tiến hoá theo hành trình
(như Team Rocket), cấp ngang gym sắp tới. Viết trong `src/story/rival.js` (`RIVAL_TEAMS`, `RIVAL_EVENTS`).

| # | Nơi | Khi nào | Đội hình |
|---|-----|---------|----------|
| 1 | Phòng thí nghiệm | Vừa chọn Pokémon | Pokémon khởi đầu Lv 5 |
| 2 | Thị trấn Lục Bình, trước cửa Hang Thạch Nhũ (Gary bước ra từ Pokémon Center) | Trả gói hàng xong, lên đường (lời hẹn lúc chia tay) | Pidgey, Pokémon khởi đầu (Lv 8) |
| 3 | Thành phố Đồi Gió, lối ra phía đông | Sau huy hiệu 1 | Pidgeotto, Rattata, Abra, dạng giữa (Lv 15-18) |
| 4 | Xóm Trạm Điện, cổng sang Đèn Lồng | Nhiệm vụ làng | Pidgeotto, Raticate, Kadabra, dạng giữa (Lv 24-27) |
| 5 | Thành phố Sông Nước, lối ra phía tây | Sau huy hiệu 4 | Pidgeotto, Raticate, Kadabra, Growlithe, dạng cuối (Lv 33-36) |
| 6 | Xóm Hương Khói, cổng sang Chùa Cổ | Nhiệm vụ làng | Pidgeot, Alakazam, Rhydon, Arcanine, dạng cuối (Lv 41-45) |
| 7 | Thành phố Sương Mù, lối ra Đường Chiến Thắng | Sau huy hiệu 8 | Pidgeot, Alakazam, Rhydon, Arcanine, Gyarados, dạng cuối (Lv 50-53) |

Ở thành phố, Gary đứng đợi cạnh lối ra; bước tới lối ra (hoặc nói chuyện) là Gary chạy tới thách đấu.
Thua thì tỉnh dậy ở chỗ hồi phục, Gary vẫn đứng chờ; quay lại là đấu tiếp. Thắng thì Gary đi trước: đi ra đúng lối ra
thành phố sang tuyến đường kế tiếp (ở làng thì đi qua cổng sang thành phố), không biến mất giữa đường.
Gary ở thành phố chỉ xuất hiện từ khi có huy hiệu của thành phố đó tới khi có huy hiệu tiếp theo (bản lưu cũ đã đi quá thì không gặp nữa).
Chị Đào ở nhà Gary kể Gary đang ở đâu, gặp lần đầu sau khi thắng Gary ở Lục Bình thì tặng 3 Repel.

Bản lưu cũ đã từng tới một thành phố từ trước khi có làng thì nhiệm vụ của làng trước thành phố đó được tính là xong.

Bản đồ ở `src/data/mapsChapter2.js`-`mapsChapter5.js` (tuyến đường, thành phố, hang), `src/data/mapsGyms.js` (8 gym),
`src/data/mapsVillages.js` (8 làng, Rừng Thông) và `mapsVillageAreasA.js` / `mapsVillageAreasB.js` (khu phụ của các làng);
nhà huấn luyện / NPC / bảng Pokémon của các khu mở rộng ở `src/data/extra/`;
thủ lĩnh và mục tiêu ở `src/story/chapter2.js`, nhiệm vụ các làng ở `src/story/villages.js`, Gary ở `src/story/rival.js`.

## Cửa hàng, nhiệm vụ phụ, máy tính PC

- **Poké Mart** mở hàng dần theo thành phố: Revive từ bậc 1, Max Revive chỉ có ở Thành phố Chùa Cổ, Thành phố Sương Mù và sảnh Liên minh.
  Poké Mart ở làng bán như thành phố ngay sau nó, trừ Max Revive.
  Trên đường: Revive rải từ Tuyến đường 3, Max Revive chỉ có ở Tuyến đường 10 và Hang Vân Sơn.
- **Trung tâm thương mại** (Thành phố Sông Nước, thay Poké Mart): quầy tạp hoá và quầy đá tiến hoá, mua lại mọi vật phẩm.
- **Rare Candy**: mỗi viên lên 1 cấp (học chiêu, tiến hoá như lên cấp thường; Pokémon đã gục cũng ăn được, chỉ dùng ngoài trận).
  Chỉ bán ở quầy tạp hoá trung tâm thương mại, 15.000₽/viên. Có 5 chỗ nhặt ở góc khuất Tuyến đường 3, 5, 6, 8, 10:
  nhặt xong 3 ngày thật sau quay lại lại có.
  Cô gái trong tiệm tặng một Eevee: Water Stone thành Vaporeon, Thunder Stone thành Jolteon, Fire Stone thành Flareon.
- **Đồ cầm trong trận** (tăng sức mạnh theo hệ, Leftovers, Lucky Egg) không bán ở đâu, chỉ nhận từ thủ lĩnh gym và nhiệm vụ phụ (cửa hàng vẫn mua lại):

| Nơi | Người nhờ | Việc cần làm | Phần thưởng |
|-----|-----------|--------------|-------------|
| Đồi Gió | Nhóc Bin | Cho xem Pokémon hệ Độc | Poison Barb |
| Lúa Vàng | Bác nông dân | Mang 3 quả Oran | Leftovers |
| Lúa Vàng | Cô thợ dệt | Cho xem Pokémon hệ Thường cấp 20+ | Silk Scarf |
| Đèn Lồng | Ông đồ | Thắng 2 nhà huấn luyện ở Tuyến đường 5 | Black Glasses |
| Sông Nước | Nhà nghiên cứu | Pokédex bắt được 15 loài | Lucky Egg |
| Đèn Lồng | Ông chủ tiệm xe đạp | Nhặt xích (Tuyến 4), bánh xe (Tuyến 5), yên (Tuyến 6) | Xe đạp (bán giá 999.999.999₽) |
| Lò Gốm | Người nuôi Arcanine | Có huy hiệu Lò Gốm, cho xem Pokémon hệ Lửa cấp 35+ | Thú cưỡi Arcanine (phím R) |
| Sương Mù | Cô gái chăm Lapras | Mang 3 quả Aspear | Thú cưỡi Lapras (Enter ở bờ nước) |

- **Thú cưỡi** là vật phẩm quan trọng, không cần Pokémon đó trong đội. Trên bản đồ có hình cưỡi riêng (`src/gfx/mounts.js`):
  dài khoảng 2 ô (to hơn nhân vật một chút, vẽ trên lưới 56×44 rồi thu nhỏ còn ~34×27 điểm ảnh giữ nét pixel), 3 hướng, Arcanine phi nước đại / Lapras quạt vây khi di chuyển; nhân vật **ngồi trên lưng**
  (giấu chân, đầu và bờm Arcanine / cổ Lapras che phía trước khi quay xuống, mông và đuôi / mai che khi quay lưng; nhìn ngang thì
  thấy cả nửa người trên). Khi cưỡi nhân vật ngồi yên (không vung tay như lúc đi bộ). Pokémon biết chiêu Surf vẫn đưa bạn xuống nước
  được: bạn ngồi trên một khối nước pixel art có mắt, vây và bọt sóng (3 hướng, 2 nhịp), bơi chậm hơn cưỡi Lapras.
  - **Lên / xuống nước:** thú cưỡi trồi lên giữa mặt nước rồi nhân vật nhảy lên; lên bờ thì nhân vật nhảy lên bờ, thú cưỡi lặn xuống
    kèm bọt nước. Đang cưỡi Arcanine / đạp xe mà đi ra nước thì tự xuống trước. Đổi Surf ⇄ Lapras bằng R có bọt nước.
  - **Arcanine:** phi nước đại tung bụi, nhảy gờ đất thì bóng vẫn nằm dưới đất, đáp xuống tung bụi; lên / xuống cũng có bụi.
    Bụi cỏ cao che chân Arcanine và chân Pokémon đi theo (loài bay / lơ lửng thì không). Lapras và khối nước vẫn nhấp nhô khi đứng yên.
  - Thoát game rồi vào lại lúc đang đạp xe / cưỡi Arcanine thì vào lại là **đi bộ**; vị trí lưu nằm trên mặt nước thì luôn vào lại
    trên thú cưỡi nước (không bị kẹt giữa nước).
  Như FireRed/LeafGreen, Surf không học theo cấp mà qua **HM03 Surf** (thủ lĩnh Gym Nước tặng): dùng trong túi đồ để dạy cho
  Pokémon hệ Nước (và Snorlax, Rhydon, dòng Dratini), không mất khi dùng; đã đủ 4 chiêu thì chọn chiêu để quên.
- **Máy tính PC** trong Pokémon Center: bật máy là vào thẳng **Hộp Pokémon** dạng lưới như game gốc. Bên trái là thông tin con đang
  chọn (hình to, cấp, hệ, máu, đồ cầm), giữa là lưới hộp 6 x 5 ô (đầy thì có thêm hộp, đổi bằng ◀ ▶, con lăn chuột hoặc Q / E;
  đang kéo mà giữ trên ◀ ▶ một lúc cũng lật hộp), bên phải là cột đội hình 6 ô và **thùng rác**.
  - **Kéo thả** giữa hộp và đội: thả lên con khác là đổi chỗ, thả vào ô trống là gửi vào hộp / rút về đội (đội tối đa 6, luôn phải
    còn ít nhất một con chiến đấu được). Đổi chỗ trong hộp / trong đội cũng kéo thả như vậy.
  - **Kéo vào thùng rác** là thả Pokémon: hỏi lại một lần, con trỏ mặc định ở "Không" (mất vĩnh viễn, đồ đang cầm được cất vào túi).
  - Bàn phím: phím hướng di con trỏ, phím xác nhận nhấc / đặt Pokémon, phím quay lại huỷ nhấc hoặc tắt máy.
  - Có sẵn **5 hộp** (150 ô), đầy thì tự mở thêm hộp. Pokémon nằm đúng ô đã thả (giữa các con có thể để ô trống).
  - Pokémon đang cầm đồ có icon nhỏ ở góc trên phải ô. Khung thông tin bên trái có hình, cấp, hệ, máu, đồ cầm,
    **tính cách, đặc tính và 4 chiêu thức** (kèm PP).
  Bắt Pokémon khi đội đã đủ 6 con thì Pokémon tự vào ô trống đầu tiên của hộp.
  Nhiệm vụ phụ viết trong `src/story/quests.js` (nhiệm vụ cốt truyện ở các làng: xem mục Chương 2).

## Liên minh Sơn Thủy

Đủ 8 huy hiệu thì từ Thành phố Sương Mù đi về phía đông: **Đường Chiến Thắng** (lính gác kiểm tra 8 huy hiệu) → **Hang Vân Sơn** → **Cao nguyên Liên Minh**.
Trong sảnh Liên minh có Y tá Joy và cửa hàng. Qua cánh cửa lớn là 5 trận liên tiếp, không quay lại được
(Escape Rope cũng không dùng được trong các phòng Tứ Thiên Vương / Nhà vô địch):

| Phòng | Đối thủ | Hệ |
|-------|---------|----|
| 1 | Thiên Vương Lan | Độc |
| 2 | Thiên Vương Võ | Giác đấu |
| 3 | Thiên Vương Huyền | Ma (phòng tối) |
| 4 | Thiên Vương Long | Rồng |
| 5 | Nhà vô địch Khôi | Nhiều hệ, 6 Pokémon |

Thắng mỗi trận thì cửa phong ấn phía sau mở ra. Thua là tỉnh dậy ở sảnh và phải đấu lại từ phòng đầu.
Thắng Nhà vô địch thì đội hình được ghi vào **Điện vinh danh**; sau đó vẫn thách đấu lại được.
Bản đồ ở `src/data/mapsChapter5.js`, nhân vật và mục tiêu ở `src/story/league.js`.

## Hậu truyện: sau khi thành Nhà vô địch

1. Về nhà nói chuyện với **mẹ**: mẹ chúc mừng, dặn sang phòng thí nghiệm vì Giáo sư Oak muốn xem Pokédex.
2. **Giáo sư Oak** xem Pokédex (số loài đã gặp / đã bắt, nhận xét), tặng các Pokémon khởi đầu bạn chưa có,
   tặng **Master Ball** (bắt chắc chắn mọi Pokémon hoang dã, chỉ có một quả, không bán được) rồi kể tin đồn về Pokémon huyền thoại.
3. **Pokémon huyền thoại / huyền ảo** (chỉ có sau bước 2, vẫn có thể là shiny). Nói chuyện với Pokémon trên bản đồ để đấu. Bắt được
   thì mất hẳn; hạ gục thì nó bay đi, ra khỏi bản đồ rồi quay lại là nó lại ở chỗ cũ; thua / bỏ chạy thì nó vẫn đứng đó.

| Pokémon | Nơi | Điều kiện | Cấp |
|---------|-----|-----------|-----|
| Zapdos | Trạm phát cũ góc tây nam Đồi Cột Điện (Xóm Trạm Điện); thợ điện ở đầu đồi kể chuyện | Gọi mưa giông, đấu dưới mưa | 50 |
| Articuno | Hốc đá trên đỉnh Đèo Tuyết; người leo núi ở chân đèo kể chuyện | | 50 |
| Moltres | Cạnh lò nung bỏ hoang ở sân lò gốm, Tuyến đường 7; cụ thợ lò kể chuyện | | 50 |
| Mewtwo | Cuối Hầm băng, Hang Vân Sơn; nhà nghiên cứu ở chân thang kể chuyện | Pokédex đã gặp cả ba chim huyền thoại | 70 |
| Mew | Bãi hoa góc tây bắc Rừng Thông | Nghe cô bé hái hoa ở bãi đầu rừng kể chuyện, mang theo quả Pecha (mỗi lần ló ra ăn một quả) | 40 |

Mục tiêu ở góc màn hình dẫn lần lượt tới từng con (Huyền thoại x/5), xong thì về hoàn thành Pokédex.

### Hoá thạch

Pokémon hoá thạch chỉ có được bằng cách hồi sinh (không cần vô địch, vẫn có thể là shiny):
- **Helix Fossil / Dome Fossil**: trong hốc đá Machoke từng trốn ở hố mỏ cũ, Mỏ Đá Vách Núi (xong nhiệm vụ Bản Vách Đá mới vào được).
  Chỉ lấy được một, cái còn lại bị đá vụn vùi mất.
- **Old Amber**: phòng kín Hang Sơn Động (thang thứ 3 từ tầng hầm).
- **Viện Hoá thạch Núi Đá** (nhà phía đông nam Thành phố Núi Đá, có biển tên): Tiến sĩ Thạch hồi sinh Helix Fossil → Omanyte,
  Dome Fossil → Kabuto, Old Amber → Aerodactyl, Lv 30, vào đội hoặc hộp PC.

Viết trong `src/story/postgame.js`; Viện Hoá thạch ở `src/data/mapsChapter4.js` (`fossilLab`).

### Đủ 151 loài

Cả 151 loài thế hệ 1 đều có trong game và đều có cách có được: bắt ngoài tự nhiên, Pokémon khởi đầu, quà, hồi sinh hoá thạch,
nhiệm vụ huyền thoại hoặc tiến hoá (`tests/species-151.test.js` kiểm tra). Các loài mới thêm ngoài tự nhiên, ví dụ:
Caterpie / Metapod / Weedle / Kakuna ở Tuyến đường 2 và Rừng Thông, Nidoran ở Tuyến đường 3, Clefairy / Paras / Diglett trong Hang Thạch Nhũ,
Sandshrew / Jigglypuff ở Tuyến 3, Doduo / Exeggcute ở Tuyến 4, Farfetch'd ở Đồng Cối Xay, Electabuzz / Porygon ở Đồi Cột Điện,
Krabby / Horsea dưới Hồ Gương, Tauros / Kangaskhan / Chansey / Cubone / Magmar ở Tuyến 7, Scyther / Pinsir / Mr. Mime ở Tuyến 9,
Ditto ở Đường Chiến Thắng và Hang Vân Sơn (bảng đầy đủ: `src/data/encounters.js`, `src/data/extra/`).
- **Moon Stone** (Đá Mặt Trăng): tiến hoá Nidorina → Nidoqueen, Nidorino → Nidoking, Clefairy → Clefable, Jigglypuff → Wigglytuff;
  có một viên trong tầng hầm Hang Thạch Nhũ và bán ở quầy đá tiến hoá. Exeggcute tiến hoá bằng Leaf Stone.
- **Transform / Ditto:** Ditto dùng chiêu gốc **Transform**: biến thành bản sao của đối thủ tới khi rời sân hoặc hết trận, mang loài
  và hình của đối thủ (kể cả màu shiny), chép hệ, các chỉ số trừ HP, bậc chỉ số, đặc tính và bộ chiêu (mỗi chiêu 5 PP); HP, cấp,
  trạng thái, đồ cầm giữ nguyên. Ditto có đặc tính ẩn **Imposter** thì vừa ra sân đã tự biến hình. Hết biến hình là trở lại nguyên
  trạng, lưu game giữa trận luôn ghi dạng gốc (`src/battle/transform.js`). Mew học Transform ở Lv 10.
- **Đủ mọi đặc tính của 151 loài** theo Gen 5, không loài nào dùng đặc tính tạm thay, ví dụ: Defiant, Competitive, Sniper,
  Tinted Lens, Filter, Sheer Force, Adaptability, Mold Breaker, Unaware, Trace, Download, Frisk, Anticipation, Arena Trap,
  Sand Rush, Sand Force, Snow Cloak, Cute Charm, Poison Point, Early Bird, Harvest, Pickup (hết trận 10% nhặt được đồ theo cấp)
  (`src/battle/abilityEffects.js`). Friend Guard và Healer chỉ có tác dụng trong trận đấu đôi (game chỉ có trận đơn); các tác dụng
  ngoài trận của Arena Trap / Compound Eyes / Cute Charm (đổi tỉ lệ gặp Pokémon hoang dã) chưa làm. Bản lưu cũ có Pokémon mang
  đặc tính tạm thay được tự đổi sang đặc tính thật của loài khi tải.

## Lưu game

Game **luôn tự động lưu** (âm thầm, không hiện chữ "Đã lưu game"): sau mỗi sự kiện (hội thoại, vào/ra nhà...), mỗi 30 giây và khi ẩn / đóng tab lúc đang đứng yên,
sau mỗi lần mua / bán ở cửa hàng, dùng đồ trong túi, đổi Pokémon ở PC, sau mỗi lượt và ngay khi có kết quả trong trận đấu.
Tắt game giữa một cảnh cốt truyện thì tải lại sẽ xem lại cảnh đó từ đầu.
Mở game ở hai tab cùng lúc: tab nào lưu sau thì tab còn lại thôi lưu (có báo đỏ ở góc màn hình) để không ghi đè tiến độ của nhau.

**Tắt game giữa trận** (đóng tab, mất điện, lỗi...) rồi vào lại: Pokémon giữ nguyên máu, PP, trạng thái lúc đó, bạn đứng tại chỗ cũ.
- Đang đánh Pokémon hoang dã: coi như đã chạy thoát.
- Đang đánh nhà huấn luyện thường: tính là thua, 3-4 ngày sau họ mới chịu đấu lại.
- Thủ lĩnh gym, Tứ Thiên Vương, Nhà vô địch, trận trong cốt truyện: thách đấu lại được ngay (trận cốt truyện thì xem lại cảnh từ đầu).
- Nếu lúc tắt cả đội đã gục thì như thua trận bình thường.

Mở **Cài đặt** bằng phím **Esc** / **X**, nút tròn bánh răng ở cột nút bên trái, hoặc nút **B** cảm ứng trên bản đồ
(`src/ui/SettingsPanel.js`). Bảng kiểu game PC: cột thẻ bên trái, nội dung bên phải, đáy là **Huỷ / Áp dụng / OK**. Đổi gì cũng
chỉ là nháp, bấm Áp dụng / OK mới có tác dụng; Huỷ, phím quay lại hoặc bấm ra ngoài khung là bỏ nháp. Chuột / cảm ứng: bấm thẻ,
bấm nút, kéo thanh trượt; bàn phím: ↑ / ↓ chọn dòng, ← / → đổi giá trị, xác nhận để bật / tắt, Tab đổi thẻ.

- **Đồ hoạ**: **Chế độ hiển thị** Cửa sổ / Toàn màn hình (điện thoại: khoá màn hình ngang; iPhone Safari không hỗ trợ, dùng
  "Thêm vào Màn hình chính"), **Độ phân giải** (danh sách xổ xuống): **Theo màn hình** (mặc định, game lấp kín màn hình, không viền đen) hoặc
  một cỡ cố định 16:9 / 16:10 / 21:9 / 4:3 (1280×720 … 3840×2160, cửa sổ nhỏ hơn thì thu nhỏ cho vừa). Game luôn cao 720 (chữ,
  nút giữ nguyên cỡ), rộng theo tỉ lệ màn hình từ 960 (4:3) tới 1680 (21:9): bản đồ thấy rộng hơn, nút trên bản đồ bám mép màn
  hình, còn trận đấu / menu / Pokédex vẽ theo khung 960×720 đặt giữa với nền tràn ra hai bên (`uiX`, `centerStage` trong
  `src/ui/helpers.js`). Đổi cỡ cửa sổ, xoay máy, bật / tắt toàn màn hình thì game tự bố trí lại,
  **Giới hạn FPS** 30 / 60 / Theo màn hình (30 đỡ tốn pin, `src/game/display.js`),
  **Ánh sáng ngày đêm** và **Hiệu ứng thời tiết** (mưa, tuyết, mưa đá, bão cát) bật / tắt riêng.
- **Chung**: **Xem nhanh Pokémon gửi vào PC** (mặc định bật): đội đã đủ 6 mà bắt thêm thì Pokémon tự vào hộp PC; khi bật, ngay
  sau khi bắt hiện bảng nhỏ cho biết cấp, giới tính, hệ, tính cách, đặc tính (đặc tính ẩn tô tím) và IV từng chỉ số; bấm phím
  xác nhận / quay lại hoặc bấm chuột để đóng. **Bản đồ vùng** (khi đã có bản đồ), **Đổi diện mạo** (mở lại bảng tạo nhân vật,
  đổi xong nhân vật trên bản đồ đổi ngay), email tài khoản đang đăng nhập và **Đăng xuất**.
- **Điều khiển**: **Nút cảm ứng** Tự động (máy cảm ứng thì hiện) / Bật / Tắt, **cỡ nút**, **độ đậm nút**, **rung khi bấm**,
  **Phím tắt bàn phím** (xem mục Phím tắt bên dưới).

### Chơi trên điện thoại

Mở game bằng trình duyệt điện thoại (chạy dev cho máy khác trong mạng LAN: `npm run dev -- --host`). Nên xoay ngang: khung
game nằm giữa, **phím hướng** ở dải đen bên trái, **A** (xác nhận / nói chuyện) và **B** (quay lại; trên bản đồ là mở Cài đặt)
bên phải (`src/ui/TouchControls.js`). Nút cảm ứng giả lập đúng phím đang gán trong Phím tắt nên dùng được ở mọi màn hình: giữ
phím hướng là đi liên tục, trượt ngón tay sang hướng khác là đổi hướng ngay, giữ lâu trong menu thì con trỏ tự chạy. Các nút
khác trên màn hình (cột Pokémon, Túi đồ, ô phím tắt, menu trận đấu...) chạm trực tiếp. Trang không cuộn / phóng to khi chạm.

Bản lưu gắn với tài khoản (xem mục Tài khoản & bản lưu trên mạng), đổi máy / trình duyệt chỉ cần đăng nhập lại.

### Tải game nhanh

Mở link là có ngay màn hình **Đang tải** (Poké Ball quay + thanh tiến độ, `#loading` trong `index.html`) thay vì màn đen.
Màn hình chính hiện sau khi nạp đúng vài hình nó cần (3 Pokémon trên màn hình chính, loài làm icon thú cưỡi); 453 hình SVG
Pokémon còn lại nạp ngầm trong lúc người chơi ở màn hình chính (`src/gfx/monImages.js`, mặt trước trước, rồi lưng, rồi
nghiêng). Hình chỉ giữ dạng ảnh trong bộ nhớ, không đẩy lên GPU, tới lúc cần mới thu thành sprite GBA. Vào game khi chưa
nạp xong thì hiện "Đang tải hình Pokémon… %" chờ nốt. Bản đồ chỉ được vẽ khi bước vào (`ensureMapTextures` trong
`src/gfx/world.js`), giữ 6 bản đồ gần nhất, bản đồ cũ hơn được giải phóng (trước kia vẽ sẵn cả 101 bản đồ lúc khởi động,
~300MB bộ nhớ).

## Cách chơi

Phím mặc định (mỗi hành động có **phím chính** và **phím phụ**, đổi được trong **Cài đặt → Phím tắt**):

| Phím mặc định | Tác dụng |
| --- | --- |
| Mũi tên / WASD | Di chuyển (chạm nhẹ để xoay người, giữ để đi), chọn trong menu |
| Enter / Space | Nói chuyện, đọc biển báo, xác nhận, đọc tiếp hội thoại (Enter ở bàn phím số cũng như Enter) |
| Esc / X | Quay lại / huỷ; trên bản đồ: mở Cài đặt |
| M | Đội hình (Shift + ↑/↓ trong bảng đội hình: đổi chỗ Pokémon) |
| B | Túi đồ |
| P | Pokédex |
| T | Thẻ Huấn luyện viên |
| N | Bản đồ vùng |
| C | Lên / xuống xe đạp |
| R | Cưỡi Arcanine / đổi cách bơi (cần thú cưỡi) |
| 1 - 6 (cả bàn phím số) | Dùng vật phẩm ở ô phím tắt (trong túi đồ: bấm phím của ô để gán vật phẩm đang chọn) |

Đi tới gờ đất theo chiều dốc xuống là tự nhảy qua (chỉ một chiều).

### Phím tắt (Cài đặt → Phím tắt)

Màn `src/ui/KeyBindings.js` liệt kê mọi hành động: Đi lên / xuống / sang trái / sang phải, Xác nhận / nói chuyện,
Quay lại / huỷ, Đội hình, Túi đồ, Pokédex, Thẻ HLV, Bản đồ vùng, Cài đặt, Xe đạp, Cưỡi thú, Ô phím tắt 1-6. Mỗi dòng có hai ô
**Phím chính** / **Phím phụ** ghi tên phím ("M", "Enter", "Space", "↑", "Esc", "1", "Numpad 1"...).
- Bấm vào ô (hoặc chọn ô bằng phím hướng rồi bấm phím xác nhận): ô nhấp nháy vàng "…", phím bấm tiếp theo được gán cho ô đó
  (Esc, Enter, Backspace... đều gán được; Tab không gán được). Bấm lại đúng phím cũ hoặc bấm chuột ra chỗ khác là thôi.
- Ô đang chọn có nút ✕ nhỏ để bỏ phím (bàn phím: Delete). Không bỏ được phím cuối cùng của di chuyển / xác nhận / quay lại
  (dòng sáng đỏ), nên không bao giờ bị kẹt trong menu.
- Phím mới đang thuộc hành động khác thì **hai bên đổi phím cho nhau** (dòng bị đổi sáng vàng một lúc). Riêng **Quay lại** và
  **Cài đặt** được dùng chung phím (mặc định cùng Esc / X).
- Nút **Khôi phục mặc định**. Danh sách dài thì cuộn bằng con lăn chuột / phím hướng. Đóng bằng ✕, phím quay lại hiện tại hoặc
  bấm ra ngoài khung.
- Phím nhận theo vị trí trên bàn phím (`KeyboardEvent.code`) nên vẫn dùng được khi đang bật bộ gõ tiếng Việt. Bảng phím lưu trong
  cài đặt của trình duyệt (`src/game/settings.js`, mục `keybinds`), thiếu / hỏng thì dùng phím mặc định. Code: `src/game/keybinds.js`
  (bảng hành động, đổi phím, tên phím), `src/ui/input.js` (xác nhận / quay lại / hướng theo bảng phím).
- Lời thoại nhắc phím (vd cậu bé "Bấm P để mở Pokédex") luôn ghi đúng phím đang dùng. Số ở góc ô phím tắt dưới đáy màn hình là
  phím của ô đó.
- Giao diện không có dòng chữ hướng dẫn phím: mọi màn hình (tạo nhân vật, màn hình chính, túi đồ, Pokédex, thông tin Pokémon,
  hộp PC, cửa hàng, bản đồ vùng, trận đấu) chỉ còn nội dung, đóng bằng ✕ / phím quay lại.

Bố cục màn hình trên bản đồ:
- **Góc trái trên:** **cột đội hình** kiểu game MMO: mỗi Pokémon một hàng dạng viên thuốc tối, chân dung tròn bên trái có **vòng HP
  bọc quanh** (xanh / vàng / đỏ, tụt dần theo máu), ký hiệu giới tính + cấp dưới chân dung; bên phải là tên (chữ **S** vàng nếu
  shiny), thanh HP và thanh EXP mảnh, icon đồ đang cầm ở góc, viên trạng thái xấu cạnh tên; kiệt sức thì cả hàng xám. Rê chuột hiện
  % HP và đồ đang cầm; **bấm vào là mở thẳng màn chi tiết** Pokémon đó; **kéo thả** một hàng lên hàng khác để đổi chỗ trong đội
  (`src/ui/PartyPanel.js`).
- **Góc phải trên:** giờ, buổi trong ngày, tên bản đồ; ngay dưới là bảng **mọi Pokémon hoang dã của bản đồ**, chia hai nhóm
  **Trên cạn** (mọi bãi cỏ; trong hang là Pokémon của hang đó, chỉ hiện khi đã vào hang) và **Dưới nước** (lướt nước + mọi loại
  cần câu). Chưa gặp thì bóng đen "?", đã gặp thì hiện hình, đã bắt thì hiện hình kèm Poké Ball nhỏ ở góc dưới phải. Rê chuột
  vào một Pokémon thì hiện tên, khoảng cấp và buổi xuất hiện ("???" nếu chưa gặp). Thu gọn được (▶).
- **Bên trái, trên thanh phím tắt:** cột nút tròn có nhãn Túi đồ / Pokédex / **Thẻ HLV** / Cài đặt (Đội hình mở bằng cột
  Pokémon góc trái trên hoặc phím M; Bản đồ vùng và Phím tắt nằm trong Cài đặt). Nút **≡** ở góc dưới trái ẩn / hiện cột nút
  (nhớ cho lần sau).
- **Đáy màn hình:** nút ≡, **ô tiền** (đồng ₽ + số tiền), rồi **6 ô phím tắt**, góc mỗi ô ghi phím của ô (mặc định 1-6).
  **Góc phải dưới:** khung nhiệm vụ, bấm để thu gọn chỉ còn tiêu đề.
- **Thẻ Huấn luyện viên** (phím **T** hoặc nút Thẻ HLV, `src/ui/TrainerCard.js`): tên, thời gian chơi, ngày bắt đầu (bản lưu cũ không
  có thì "—"), tổng số Pokémon (đội + PC), Pokédex đã bắt / đã gặp, số lần vô địch Liên minh, hình nhân vật trên bục, tiền,
  **khung 8 huy hiệu** (chưa có thì bóng đen; rê chuột xem tên huy hiệu và thành phố). Đóng: phím quay lại / phím Thẻ HLV / ✕
  hoặc bấm ra ngoài.
- Rê chuột vào ô phím tắt thì hiện tên vật phẩm. Báo "Đã gán..." (gán phím tắt) nằm giữa đáy màn hình (giữa thanh phím tắt và khung
  nhiệm vụ), dài thì xuống dòng. Mở Pokédex / cửa hàng thì giao diện bản đồ ẩn đi.
- Tên Pokémon dài ở mọi màn hình (đội hình, thông tin, PC, trận đấu, xem nhanh khi bắt) tự thu nhỏ rồi cắt bằng "…", không đè lên
  cấp / thanh HP. Pokémon kiệt sức không có nhãn, chỉ mờ đi và thanh HP trống. Màn thông tin Pokémon có nút ◀ 1/6 ▶ để đổi con bằng chuột.
  Lên cấp trong trận thì hiện chỉ số mới kèm mức tăng (+2 Atk...).

Túi đồ (B) là khung bên phải, một khung lớn bọc cả dải tab các ngăn (ở **bên trái**) lẫn danh sách vật phẩm, ô tìm kiếm (gõ là lọc, không cần dấu: "xe dap" ra "Xe đạp",
tìm cả mọi ngăn), vật phẩm xếp lưới 2 cột, mô tả hiện cạnh khung. Trong trận đấu túi đồ cũng dùng khung này. Mở túi đồ (B) thì thanh phím tắt vẫn hiện ở đáy màn hình; gán vật phẩm
(xe đạp, thú cưỡi, cần câu, thuốc, quả mọng, bóng...) bằng một trong các cách:
- **Kéo thả**: nhấn giữ vật phẩm trong túi, kéo icon thả vào ô dưới đáy (ô dưới con trỏ sáng viền vàng).
- **Chọn rồi gán**: bấm vào vật phẩm → **Gán phím tắt** → chọn ô (bảng thao tác vật phẩm có Dùng / Cho cầm / Gán phím tắt như game gốc).
- **Phím của ô**: chọn vật phẩm rồi bấm phím của ô (mặc định 1-6).

**Kéo icon từ ô này thả sang ô khác** trên thanh phím tắt là đổi chỗ hai ô (thả vào ô trống thì chuyển sang). Bấm vào ô còn trống
thì không có gì xảy ra.

Mỗi vật phẩm chỉ nằm một ô (gán sang ô khác thì ô cũ trống), gán lại đúng ô đang có là bỏ gán.
Trên bản đồ bấm phím của ô hoặc bấm chuột vào ô để dùng. Xe / thú cưỡi đang dùng thì ô sáng viền.
Thanh phím tắt ẩn khi đang đánh trận, hội thoại hay mở menu.
Khung nhiệm vụ hẹp, nhiệm vụ dài thì xuống dòng. Đồng hồ góc phải trên hiện buổi trong ngày (Ban ngày / Chiều / Ban đêm),
giờ trong game (00:00-23:59) và **tên bản đồ đang đứng**.

**Câu cá:** không có phím riêng. Đứng quay mặt ra mặt nước rồi **bấm vào cần câu trong túi đồ** (bấm là dùng ngay, không hỏi
Dùng / Gán phím tắt; xe đạp và thú cưỡi cũng vậy) hoặc dùng **ô phím tắt** đã gán cần câu. Không quay mặt ra mặt nước thì báo
"Hãy đến nơi có hồ nước hoặc đứng quay mặt về phía mặt nước để sử dụng". Cần câu tặng dọc đường để Pokémon câu được không mạnh
vượt đội:
| Cần | Ai tặng | Câu chuyện |
|-----|---------|------------|
| Cần câu cũ | Ông lão bến câu Hồ Gương (Tuyến đường 6) | Tặng nhà huấn luyện trẻ đi ngang (ngư dân hồ Pallet chỉ đường tới ông) |
| Cần câu tốt | Ông Câu Suối, bờ suối Tuyến đường 9 | Tặng người đi được tới rừng tre |
| Cần câu siêu | Lão Ngư Hồ Lạnh, bờ tây Hồ Lạnh (Tuyến đường 10) | Có cần câu tốt thì lão kể chuyện Gyarados chúa giật đứt dây, kéo lão ngã xuống hồ băng; nhờ hạ nó (Gyarados Lv 46, bắt được). Thắng hoặc bắt được thì lão tặng cần câu siêu; thua / bỏ chạy thì thử lại sau |

- **Túi đồ** (B) chia 5 ngăn như game gốc: **Hồi phục / Bóng / Quả mọng / Vật phẩm / Quan trọng** (tab phía trên, bấm tab hoặc ← →
  để đổi ngăn), danh sách dài thì **cuộn bằng con lăn chuột**. Mô tả vật phẩm chỉ hiện khi rê chuột (hoặc di phím) tới vật phẩm,
  trong khung nhỏ bên phải túi.

- **Pokémon đầu đội đi theo bạn** trên bản đồ, quay mặt trước / lưng / nghiêng theo hướng đi.
- **Đội hình** (M): bấm (hoặc Enter) vào một Pokémon là mở thẳng **màn chi tiết**. **Kéo thả** một Pokémon lên Pokémon khác
  (chuột / cảm ứng; con được kéo nổi theo con trỏ, con sắp bị đổi sáng viền xanh) là đổi chỗ. Con đứng đầu là con đi theo bạn
  và ra trận trước (nếu đã gục thì con còn đứng đầu tiên ra trận). Đóng màn chi tiết / đổi chỗ xong thì bảng mở lại ở đúng con đó.
- **Cho Pokémon cầm đồ**: màn chi tiết có ô **Đồ cầm** ở góc trên trái. Bấm vào ô (hoặc phím B) mở túi đồ ngay bên cạnh
  (đè lên cột chỉ số, chỉ có đồ cầm được, cuộn chuột, rê chuột xem mô tả). Kéo icon vật phẩm thả vào ô là cho cầm (món đang cầm
  tự cất vào túi); kéo món đang cầm thả vào túi là cất đi. Túi vẫn mở khi bấm ← → sang Pokémon khác, tiện cho cả đội cầm đồ.
  Trong túi đồ ngoài bản đồ vẫn chọn vật phẩm → **Cho cầm** → chọn Pokémon được.
  Loài đi bộ thì bước mượt, hơi lắc lư; loài không có chân (cá, Poliwag, Geodude, Voltorb...) thì nhảy;
  loài có cánh (Pidgey, Zubat, Charizard...) bay lơ lửng và vỗ cánh; Gastly, Koffing, Magnemite... thì bồng bềnh (`src/data/followStyle.js`).
  Quay mặt vào nó và bấm Enter thì nó nhảy lên và kêu tiếng của loài mình (vd: "Pika pika!"). Đã gục vẫn đi theo như bình thường.
- **Ngày đêm**: 1 ngày thật = 3 ngày trong game (1 giờ game = 20 phút thật). Mỗi ngày game chia đều 3 buổi
  **ban ngày 06:00-14:00 → chạng vạng 14:00-22:00 → ban đêm 22:00-06:00**, mỗi buổi 2 giờ 40 phút thật (0 giờ thật là 06:00 giờ game),
  nên buổi nào cũng gặp được vào nhiều khung giờ thật khác nhau. Buổi chiều và ban đêm thì cửa sổ nhà sáng đèn.
  Không chỉnh buổi được trong Cài đặt, vì **có Pokémon chỉ xuất hiện vào một buổi** (vd: Oddish, Meowth, Drowzee ban đêm;
  Pikachu, Ponyta, Slowpoke ban ngày; Growlithe chạng vạng). Cùng một loài có thể khu này cả ngày, khu khác chỉ một buổi. Bảng khu vực góc phải đánh dấu ☀ / ◐ / ☾ cho các loài này,
  ngoài buổi đó thì hình mờ đi. Loài không có dấu xuất hiện cả ngày. Bụi cỏ và lướt nước chia theo buổi; trong hang và khi câu cá thì loài nào cũng có cả ngày.
  **Thời tiết theo vùng** (`src/game/weather.js`, 3-7 phút đổi một lần): vùng thường 15% **mưa**; vùng tuyết (Làng Đèo Tuyết, Thành phố Sương Mù)
  80% **tuyết rơi**, 20% **mưa đá**; vùng núi đá (Tuyến đường 8, Bản Vách Đá, Thành phố Núi Đá) 80% **bão cát**.
  Gặp trận đấu ngoài trời thì thời tiết theo vào trận và kéo dài suốt trận: mưa (tăng chiêu hệ Nước, giảm hệ Lửa),
  mưa đá và bão cát (cuối mỗi lượt gây sát thương Pokémon không chịu được). Tuyết rơi chỉ là cảnh, không ảnh hưởng trận đấu.
  Tắt "Ánh sáng ngày đêm" / "Hiệu ứng thời tiết" trong Cài đặt chỉ tắt phần hình ảnh, thời tiết vẫn có tác dụng trong trận.
- **Vật phẩm rơi** (quả Poké Ball nằm trên đất): đứng cạnh, quay mặt vào và bấm Enter để nhặt. Mỗi món chỉ nhặt được một lần
  (Rare Candy thì 3 ngày sau có lại). Vật phẩm giấu ở chỗ khuất để đi khám phá: **sau ngọn cây thông** (chỉ ló ra một nửa),
  trong hốc giữa các hàng cây / vách đá, cuối ngõ cụt, xa đường chính; có món nằm **giữa bụi cỏ** (Pallet, tuyến 2, 4, 7, 9)
  và có món **trên cồn cát giữa hồ / sông** (hồ Tuyến 3, Hồ Gương Tuyến 6, Hồ Lạnh Tuyến 10, bãi bồi Sông Lục Bình): phải lướt nước tới
  mới nhặt được.
- **Sông, hồ** (lướt nước, sau Gym Sông Nước): có **cồn cát** (ô cát `d`) để lên bờ nhặt đồ, **kình ngư bơi dưới nước** (thấy bạn là
  bơi tới thách đấu, như nhà huấn luyện trên bờ) và ngư dân thách đấu trên cồn cát Sông Lục Bình. Cấp ngang Pokémon lướt nước của khu.
- **Nước trong hang:** như game gốc, một số hang có hồ / suối ngầm (ô `w` trong `CAVE_TILES`). Đi bộ thì nước chắn đường, đường chính
  qua hang vẫn đi bộ được; có Pokémon biết Surf (HM03, sau Gym Sông Nước) hoặc thú cưỡi Lapras thì xuống nước, gặp Pokémon khi lướt
  nước, câu cá bằng cả 3 loại cần (nhóm "Dưới nước" ở bảng góc phải). Trận dưới nước trong hang có nền trần đá, mặt nước ngầm tối
  gợn sóng (trận dưới nước ngoài trời cũng vẽ gợn sóng thay cho khóm cỏ).
  | Hang | Nước | Đồ chỉ lướt nước mới tới |
  |------|------|--------------------------|
  | Hang Thạch Nhũ – Tầng hầm | Hồ ngầm giữa hai hành lang | Leftovers trên cồn đá giữa hồ |
  | Hang Sơn Động – Tầng hầm | Suối ngầm chảy ngang | Black Glasses, 3 Ultra Ball trong hang nhỏ bờ nam |
  | Hang Vân Sơn – Tầng hầm | Hồ băng ngầm | 2 Max Revive trên cồn băng, 5 Ultra Ball trong hốc đá |
  | Hang Vân Sơn – Hầm băng | Vũng nước băng (lướt nước, câu Seel / Dewgong / Cloyster) | (chỗ Mewtwo vẫn đi bộ tới được) |
  | Mỏ Đất Sét | Hố ngập nước | Water Stone trên mỏm đá cuối hố |

  Pokémon dưới nước trong hang: Psyduck / Golduck, Slowpoke / Slowbro, Krabby / Kingler, Golbat; câu: Magikarp (cần cũ), Goldeen /
  Poliwag / Krabby / Shellder (cần tốt), Kingler / Seaking / Seadra / Gyarados / Cloyster / Dewgong (cần siêu); hang băng có Seel,
  Dewgong, Lapras. Cấp cao hơn Pokémon trên cạn của hang một chút vì phải có Surf mới tới. Mặt nước xanh lục thẫm gợn sóng, bờ đá lởm
  chởm (hang băng: nước xanh lạnh, viền băng trắng, mảnh băng trôi). Test: `tests/cave-water.test.js`.
- **Hàng rào gỗ** (ô `H`, cản đường, tự nối với ô hàng rào bên cạnh): rào ngăn Pallet với bụi cỏ phía bắc, rào quanh vườn
  quả mọng Lò Gốm, ruộng lúa Xóm Cối Xay và Thành phố Lúa Vàng (luôn chừa lối đi).
- **Nói chuyện với NPC**: đứng phía nào bắt chuyện thì NPC quay về phía đó (kể cả người đứng yên, nói qua quầy, nhà huấn luyện),
  người đang ngồi (mẹ trên sofa) cũng quay người nhưng vẫn ngồi, nói xong quay lại nhìn vào bàn; NPC đang đi thì bước nốt rồi mới quay lại nói.
- **Hoa lá**: ngoài hoa và bụi lá vẽ tay, mỗi bản đồ ngoài trời được rải thêm lác đác hoa (`f`) và bụi lá (`h`, đi qua được) trên ô cỏ
  thường, cố định theo toạ độ, chừa đường đi, cửa, lối ra và đồ vật (`decorate` trong `src/data/map.js`; bản đồ nào không muốn thì
  `noDecor: true`).
- **Đồ trang trí ngoài trời** (vẽ trong `src/gfx/decor.js`, ký tự ô trong `src/data/tiles.js`): sân đất nện `a` (đi được, mép lượn
  mềm vào cỏ, liền mạch với đường; đồ đặt giữa sân tự có nền đất) trước Pokémon Center / Poké Mart / gym và quanh nhà,
  ghế công viên `EE` (2 ô), thùng rác `u`, đèn đường đôi `Q` (thắp sáng ban đêm như cột đèn lồng), bồn hoa `P` (các ô liền nhau
  nối thành một bồn dài, đặt hai bên cửa gym), bờ cây xén thấp `e`, gốc cây `k`, khúc gỗ đổ `XX`, cây tán tròn `OO/OO`
  (khối 2x2, có cây lá thu cam) và **cây hoa anh đào lớn** `Y` (ký tự đặt ở gốc, chỉ gốc là ô cản; tán hồng rộng 3x3 phủ các ô
  phía trên, đi bên dưới tán được). Mọi thị trấn, thành phố, làng và tuyến đường đều có; phần nhô cao (lưng ghế, đầu đèn, tán cây)
  vẽ đè lên nhân vật đứng phía sau. Không đặt đồ cản ngay trên khối cây thông (ngọn thông che mất), trên lối đi, trước cửa,
  trước biển báo, chỗ hái quả, chỗ đứng / tầm nhìn NPC; `tests/decor.test.js` kiểm tra đủ khối và bản đồ vẫn liền mạch như cũ.
- **Cột đèn lồng** `l`: cột gỗ sơn son cao ~2.5 ô trên đế đá, xà mái cong vểnh hai đầu, hai đèn lồng đỏ treo hai bên (chóp và tua
  vàng); ban đêm hai chiếc đèn sáng đỏ cam. **Thành phố Đèn Lồng** (`lanternGarlands: true`) có dây đèn lồng nhỏ đỏ / vàng giăng
  võng giữa các cột cùng hàng (cách nhau 2-8 ô) như phố đèn lồng ngày hội, ban đêm đèn trên dây cũng sáng (`src/gfx/decor.js`,
  `lanternGarlands` trong `src/data/tiles.js`).
- **Cây quả mọng** trồng thành **dãy 2-3 cây liền nhau trên một luống đất cày**, rải đều dọc hành trình (tuyến đường, làng,
  thành phố; vài nơi có 2 dãy), từ Tuyến đường 2 trở đi. Đứng trước cây bấm Enter để hái 1-3 quả, 2-3 ngày sau cây ra quả lại.
  Đang đạp xe hay cưỡi Arcanine vẫn hái thẳng được, không phải xuống.
  **Vườn quả mọng Lò Gốm** (phía nam Thành phố Lò Gốm, giữa / cuối hành trình) có 8 dãy x 3 cây: đủ mọi loại quả hồi phục
  và mỗi loại quả giảm EV (Pomeg, Kelpsy, Qualot, Hondew, Grepa, Tamato) 2 cây. Sitrus / Figy chỉ mọc sau khi trả gói hàng
  cho Poké Mart Lục Bình, Lum sau khi xong chương 1. Vị trí các dãy khai báo bằng `berryRow` (`src/data/berryRows.js`).
- Đi vào **bụi cỏ cao** ở Pallet sẽ gặp Pokémon hoang dã: Rattata, Pidgey, thỉnh thoảng mới gặp Poliwag (hiếm).
- Bụi cỏ **sẫm màu** (từ Tuyến đường 2 trở đi) có Pokémon mạnh hơn, và có cả Pikachu, Growlithe.
- **Pokémon Center** (mái đỏ, cái đầu tiên ở Thị trấn Lục Bình): vào trong, nói chuyện với **Y tá Joy** qua quầy để hồi đầy máu cho cả đội (Chansey đứng phụ bên cạnh Joy ở mọi Pokémon Center).
  Ở Pallet thì về nhà nói chuyện với mẹ để hồi phục.
- **Poké Mart** (mái xanh): vào trong, nói chuyện với **nhân viên** qua quầy để **mua** bóng, thuốc, Repel...
  hoặc **bán** đồ với giá bằng nửa giá mua. Hàng mở dần: Lục Bình lúc đầu chỉ có đồ cơ bản, càng về sau càng nhiều hàng tốt.
  Bắt đầu với 10.000₽.
- Trong nhà, đi xuống thảm ở cửa để ra ngoài.
- **Nhà huấn luyện** đứng gác đường: đi vào tầm nhìn của họ là bị thách đấu.
  Đấu với nhà huấn luyện thì không chạy được, không bắt được Pokémon của họ.
  Thắng thì được tiền thưởng và thêm 50% EXP. Nhà huấn luyện dọc đường và trong hang đấu lại được sau 3-4 ngày thật
  (tiện luyện cấp và kiếm tiền): đã thua thì không chặn đường nữa, nói chuyện với họ để được hỏi đấu lại. Đội hình lúc đấu lại
  mạnh lên theo Pokémon mạnh nhất của bạn (kém 3 cấp) và tiến hoá đúng cấp.
  Người trong gym, thủ lĩnh, Tứ Thiên Vương và nhân vật cốt truyện thì không đấu lại.
  Vừa gặp Pokémon hoang dã vừa bị nhà huấn luyện nhìn thấy cùng lúc thì đánh Pokémon hoang dã trước, xong họ mới tới.
- Thua trận thì mất 5% số tiền (tối đa 25.000₽) và tỉnh dậy ở Pokémon Center đã vào gần nhất (chưa vào thì ở nhà).
- Nói chuyện với dân làng và đọc biển báo để nghe mẹo chơi.
- Đánh cho Pokémon hoang dã yếu đi rồi mới ném Poké Ball thì dễ bắt hơn.
- Hạ gục hay **bắt được** Pokémon hoang dã đều nhận EXP và EV như nhau (như từ Gen 5), chia cho các Pokémon đã ra sân và còn đứng.
- **EXP theo chuẩn Gen 5**: EXP nhận = (EXP gốc × cấp đối thủ) / (5 × số Pokémon chia nhau) × ((2 × cấp đối thủ + 10) / (cấp đối thủ + cấp mình + 10))^2.5 + 1,
  Pokémon của nhà huấn luyện x1.5, cầm Lucky Egg x1.5. Hạ Pokémon cấp cao hơn mình được nhiều EXP hơn, hạ Pokémon yếu hơn hẳn thì được ít đi.
  **EXP cần để lên cấp theo nhóm tăng trưởng của loài** (Fast / Medium Fast / Medium Slow / Slow, như game gốc): vd Charmander, Pidgey
  thuộc Medium Slow, Snorlax thuộc Slow. Bản lưu cũ tự đổi sang đường cong mới, giữ nguyên cấp và phần trăm thanh EXP.
- Tên chỉ số dùng tiếng Anh viết tắt ở mọi nơi: **HP, Atk, Def, Sp.Atk, SpD, Spe** (Accuracy / Evasion cho độ chính xác / né tránh).
  Bậc chỉ số trong trận hiện bằng thẻ (Atk, Def, Sp.Atk, SpD, Spe; Accuracy / Evasion không hiện thẻ): của đối thủ nằm ngay dưới thanh HP,
  của mình nằm trên khung tên; thông báo dạng "Squirtle của đối thủ bị giảm Atk!".
- Ném Poké Ball: nắp bóng bật lên theo bản lề (vẫn dính với thân), luồng sáng đỏ hút Pokémon vào, đóng nắp rồi lắc.

## Pokédex

Pokédex có đủ 151 Pokémon thế hệ 1, mở dạng cửa sổ nổi trên bản đồ (phím P, hoặc bấm vào Pokémon trong bảng Pokémon hoang dã):

- **Bên trái:** lưới Pokémon 5 cột (số, hình nhỏ, dấu Poké Ball nếu đã bắt, bóng đen nếu chưa gặp), ô **Ẩn chưa gặp**, số đã
  bắt / đã gặp, ô **tìm kiếm** theo tên hoặc số (tên chỉ tìm ra loài đã gặp).
- **Bên phải:** số, tên, loài, hệ, hình, chiều cao, cân nặng, **biểu đồ lục giác chỉ số gốc**, mô tả, đặc tính (đặc tính ẩn ghi
  "(ẩn)"), danh sách **chiêu thức** học theo cấp (tab **Khắc hệ** bên cạnh), danh sách **nơi xuất hiện** (bản đồ, cách gặp: bụi
  cỏ / hang / lướt nước / từng loại cần câu, khoảng cấp, buổi trong ngày).
- Phím: phím hướng chọn, PgUp / PgDn sang trang, F hoặc / để tìm, H ẩn chưa gặp, Tab đổi Chiêu thức / Khắc hệ, phím quay lại /
  phím Pokédex đóng. Ô tìm kiếm chỉ ghi "Tên hoặc số", không có dòng hướng dẫn phím.
- Code: `src/scenes/PokedexScene.js`, các phần trong `src/ui/dex/`.

Thông tin hiện theo mức độ:

- **Chưa gặp:** bóng đen, không có thông tin.
- **Đã gặp** (vào trận với nó): hiện ảnh, tên, loài, hệ.
- **Đã bắt:** hiện đầy đủ chiều cao, cân nặng, đặc tính, chỉ số gốc, khắc chế hệ, mô tả Pokédex, tỉ lệ bắt…

Dữ liệu nằm trong `src/data/pokedex.json`, được lấy từ [pokemondb.net](https://pokemondb.net/pokedex/stats/gen1) bằng script:

```bash
node scripts/import-pokedex.mjs
```

Trang đã tải được lưu ở `.cache/pokemondb/`. Muốn tải lại từ đầu thì xoá thư mục đó.
Phần "khắc chế hệ" lấy theo pokemondb nên đã tính cả đặc tính (ví dụ Levitate miễn hệ Đất).

## Hình ảnh

Phong cách pixel art kiểu Gen 5 (giống PRO), toàn bộ vẽ bằng code:

- **Bản đồ** (`src/gfx/world.js`): ô 16×16, bụi cỏ cao dạng khóm lá, cây thông cao 3 ô (ngọn cây che nhân vật đi phía sau),
  nhà mái ngói, cửa sổ có rèm, biển báo gỗ, hồ nước có sóng. Sông chảy ra tận mép bản đồ và luồn dưới cầu; cầu ngang (đông - tây)
  có ván dọc và lan can hai bên mặt nước; góc ao bo tròn; cồn cát tự vẽ mép bờ, cồn 2×2 trông như đảo tròn; cụm đá nhỏ là tảng đá
  tròn (bản đồ tuyết có tuyết phủ, nghĩa trang giữ bia mộ vuông); trong hang vách đá có mép sáng và bóng đổ. Cửa hàng xe đạp bày
  xe trên giá; sảnh Liên minh và các phòng Tứ Thiên Vương có thảm theo màu từng phòng. Mặt nước nông không có cá (câu thì báo nước
  nông). Test `tests/map-polish.test.js` giữ các quy tắc: nhà đứng trên nền trống, ngọn thông không che đồ / biển báo, ghế quay ra
  chỗ trống, gờ đất không đáp lên đồ trang trí, cầu nối đất hai đầu.
- **Nhân vật** (`src/gfx/player.js`): dáng chibi đầu to, viền tối theo màu kề bên.
- **Pokémon:** vẽ từ hình SVG trong `src/assets/pokemon-svg/` (mặt trước, lưng `-back`, nghiêng `-side`; **cả 151 loài của Pokédex
  đều có đủ 3 hướng**, kể cả các loài chỉ xuất hiện trong Pokédex như dòng Caterpie / Weedle / Nidoran, Clefairy, Scyther, ba chim
  huyền thoại, Mewtwo, Mew; mỗi dòng tiến hoá chung bảng màu, bóng đen "chưa gặp" của mỗi loài đều nhận ra được; hình tạm vẽ bằng
  code chỉ còn là dự phòng khi thiếu file) rồi tự chuyển thành sprite kiểu GBA (`spriteFromImage` trong
  `src/gfx/pixel.js`): tối đa 15 màu như bảng màu 16 ô của GBA, màu 15-bit, viền tối theo màu kề bên.
  Trận đấu / Pokédex / thông tin Pokémon dùng sprite 64×64, Pokémon đi theo 20×20 (Pokémon đứng cạnh NPC như Meowth của
  Team Rocket 16×16), thu nhỏ kiểu lấy màu đa số cho mảng màu sạch, không đục; tất cả phóng to ×3
  để mỗi pixel to bằng pixel của bản đồ và nhân vật. Sửa SVG bằng Inkscape hoặc Figma.
  Toàn bộ 151 loài đã được rà soát lại bằng cách so với hình tham khảo (artwork + sprite trước / sau / shiny) ở cỡ 64px: phần lớn
  vẽ lại cho đúng dáng (Nidoran / Nidorina / Nidorino đi bốn chân, Growlithe / Arcanine / Persian / Ponyta / Rhyhorn bốn chân,
  Machamp đủ 4 tay, Graveler 4 tay, Kabutops mũ nhọn, Magmar, Golduck, Gloom, Victreebel, Sandshrew, Geodude xám...),
  Chansey có thêm mặt sau và mặt nghiêng; màu shiny cập nhật theo bảng màu mới. Hình là vector tự vẽ, không dùng ảnh gốc.
  **Aerodactyl** dùng sprite pixel vẽ tay 64×64 (`src/assets/pokemon/aerodactyl.png`, `aerodactyl-back.png`): tư thế như sprite
  Gen 5 (đầu cúi há miệng, cánh giơ cao, đuôi cong qua lưng), viền 1px, dải 3–5 sắc độ mỗi phần, không bị nhoè như hình vector
  thu nhỏ; mặt nghiêng (Pokémon đi theo) vẫn dùng SVG cùng bảng màu. Shiny đổi thân hồng, cánh xanh.
- **Pokémon shiny** (`src/data/shiny.js`): mỗi loài có bảng màu shiny riêng theo game gốc (Charizard đen cánh đỏ,
  Gyarados đỏ, Pikachu vàng cam, Magikarp vàng kim, Ponyta lửa xanh...), chỉ đổi phần thân / bụng / cánh / mai / hoa,
  mắt và lửa đuôi giữ nguyên. Hình vẽ bằng code thì vẽ lại bằng màu shiny; hình SVG / PNG thì đổi màu theo vùng sắc độ
  (`recolorHues` trong `src/gfx/pixel.js`; thân xám như Onix, Geodude, Rhyhorn thì đổi theo độ sáng). Áp dụng cho trận đấu, Pokémon đi theo, menu đội hình, thông tin Pokémon.
  Tên Pokémon shiny có chữ **S** vàng đứng trước ở mọi nơi (trận đấu, cột đội hình, menu đội hình, thông tin, PC;
  `src/ui/shinyMark.js`). Vào trận thì bùng một vòng
  sao lấp lánh rồi thỉnh thoảng lấp lánh lại; Pokémon đi theo / thú cưỡi là shiny thì lấp lánh trên bản đồ (`src/gfx/shinyFx.js`).
- **Màn trận đấu:** 4 nút lớn có biểu tượng (Chiến đấu, Pokémon, Túi, Chạy) ở góc phải dưới; chiêu là nút màu theo hệ kèm PP.
  Thanh HP không hiện số: rê chuột vào thanh HP (của mình hay đối thủ) thì hiện % HP còn lại, bấm vào thì ghim % một lúc.
  Code: `src/ui/BattleMenus.js`, `src/ui/MonsterInfo.js`.
- **Tạo nhân vật** (Chơi mới): giới tính (Nam / Nữ), kiểu tóc (8), màu tóc (8), màu da (5), trang phục (8), màu mắt (5),
  nút Ngẫu nhiên, xem trước nhân vật đi vòng quanh cạnh Giáo sư Oak. Mặc định là **áo ba lỗ trắng, quần short**, không mũ,
  không ba lô. Lưu trong bản lưu (bản lưu cũ giữ diện mạo cũ); `src/ui/CharacterCreator.js`, lựa chọn ở `src/data/playerCustom.js`.
- **Trong nhà:** giường đơn có đầu giường gỗ, gối, chăn kẻ ô; chậu cây cảnh lá (2 loại: cây lá rộng chậu đất nung, cây lưỡi hổ
  chậu sứ); tủ sách, bàn học, tủ lạnh, tủ bếp dựng sát tường; TV, bàn, thảm xếp thẳng hàng; tranh, đồng hồ, lịch treo tường.
- **Cây quả mọng** mọc trên luống đất cày (nâu sẫm, bo tròn, các cây cạnh nhau chung một luống); bụi cây có quả / hoa rõ màu.
- **Thú cưỡi** (Arcanine trên cạn, Lapras dưới nước) dài khoảng 2 ô, đủ hướng xuống / lên / ngang với 2 nhịp bước;
  người ngồi kẹp giữa thân và đầu / mông thú (`src/gfx/mounts.js`).
- **Hiệu ứng chiêu** (`src/gfx/moveFx.js`): pixel art kiểu GBA, mỗi chiêu một kiểu: cào (Scratch, Slash), cắn (Bite, Crunch),
  đấm / đá / tát (Mega Punch, Fire Punch, Mega Kick, Pound), roi mây (Vine Whip), lá dao, tia nước (Water Gun, Hydro Pump),
  bong bóng, lướt sóng, thác nước, lửa phun, Fire Blast hình sao, sét (Thunderbolt, Thunder từ trời), tia băng / tia siêu linh,
  sóng siêu linh, đá ném / đá lở / mũi đá, động đất, lốc xoáy, kim độc, khói độc, hút máu, tự nổ...
  Chiêu trạng thái cũng có hiệu ứng riêng (sóng âm, phấn, ánh mắt, tim, lửa ma, sóng điện). Bảng gán chiêu ở `MOVE_FX`;
  chiêu chưa gán tự chọn kiểu theo hệ và loại chiêu.
- **Chọn chiêu trong trận**: khung thông tin hiện hệ, loại chiêu (vật lý / đặc biệt / trạng thái), sức mạnh, độ chính xác,
  hiệu ứng phụ (vd "10% gây bỏng", "Luôn ra đòn trước"), thanh PP đổi màu khi sắp hết và gợi ý khắc chế đối thủ
  (`src/battle/moveInfo.js`).

### Dùng sprite thật

Thả file PNG vào `src/assets/pokemon/`, tên file trùng với id của Pokémon:

- `pikachu.png`: mặt trước
- `pikachu-back.png`: mặt sau (không bắt buộc), dùng khi là Pokémon của mình trong trận và khi đi theo

PNG được ưu tiên hơn SVG. Ảnh tự co giãn cho vừa khung.
Thêm file xong thì khởi động lại `npm run dev`.

## Cấu trúc code

```
src/
  main.js              Khởi tạo game
  config.js            Kích thước màn hình, ô bản đồ, font
  data/                Dữ liệu game, sửa ở đây để cân bằng
    pokedex.json       Dữ liệu 151 Pokémon (tạo bởi scripts/import-pokedex.mjs)
    monsters.js        Pokémon chơi được trong game: tiến hoá, hình tạm (chiêu học lấy từ learnsets.json)
    learnsets.json     Chiêu học theo cấp (FireRed/LeafGreen) và khi tiến hoá (tạo bởi scripts/import-learnsets.mjs)
    moves.js           Chiêu thức
    types.js           Hệ và bảng tương khắc
    encounters.js      Pokémon xuất hiện ở từng khu bụi cỏ, mặt nước, hang
    map.js             Bản đồ Pallet (4 ngôi nhà), trong nhà, lớp GameMap
    mapsChapter2.js    Tuyến đường 2, Thị trấn Lục Bình, Sông Lục Bình, Hang Thạch Nhũ, Đồi Gió...
    berryRows.js       Dãy cây quả mọng (berryRow) dùng chung cho mọi bản đồ
    mapsChapter3-5.js  Bản đồ hành trình các gym còn lại và Liên minh
    mapsVillages.js    8 làng nhỏ trước các thành phố có gym
    tiles.js           Ký tự ô trên bản đồ, đồ trang trí ngoài trời (ghế, đèn đường, cây hoa...)
    region.js          Bản đồ vùng Sơn Thủy (phím N)
    badges.js          8 huy hiệu
    abilities.js       Đặc tính
    npcs.js            Dân làng, nhà huấn luyện (đội hình, tiền thưởng, câu thoại)
    items.js           Vật phẩm, giá bán, hàng trong Poké Mart
    natures.js         Tính cách
    shiny.js           Màu shiny của từng loài
    stats.js           Tên chỉ số
    pokedex.js         Tra cứu Pokédex (đọc pokedex.json)
    followStyle.js     Pokémon đi theo: kiểu di chuyển, tiếng kêu
  assets/
    pokemon-svg/       Hình Pokémon (SVG)
    pokemon/           Sprite PNG thật (tuỳ chọn, ưu tiên hơn SVG)
    ui/                Poké Ball
  game/                Pokémon (tạo, lên cấp, tiến hoá), trạng thái người chơi, lưu game, cài đặt, đồng hồ trong game,
                       dùng vật phẩm, đồ cầm, quả mọng, Repel, lịch đấu lại của nhà huấn luyện
  battle/formulas.js   Công thức sát thương, bắt Pokémon, EXP, bỏ chạy
  battle/status.js     Trạng thái (độc, bỏng...), hiệu ứng tạm thời trong trận
  gfx/                 Pixel art bản đồ (đồ trang trí ngoài trời: decor.js), nhân vật, hiệu ứng
  ui/                  Hộp thoại, menu, thanh máu, màn Phím tắt (KeyBindings.js), input.js (phím theo bảng phím)
  story/chapter1.js    Cốt truyện chương 1
  story/chapter2.js    Thủ lĩnh gym, mục tiêu hành trình, cổng huy hiệu
  story/league.js      Tứ Thiên Vương, Nhà vô địch, Điện vinh danh
  story/quests.js      Nhiệm vụ phụ (đồ cầm, xe đạp, thú cưỡi)
  story/villages.js    Nhiệm vụ cốt truyện ở 8 làng
  story/rival.js       Gary: đội hình 7 lần gặp, Gary đợi ở lối ra 3 thành phố
  story/rocket.js      Team Rocket xuất hiện theo hành trình
  scenes/              Các màn: Boot → màn hình chính → bản đồ ⇄ trận đấu / Pokédex / Poké Mart / thông tin Pokémon / bản đồ vùng
tests/                 Test cho phần logic (npm test)
scripts/               Script tải dữ liệu từ pokemondb.net: Pokédex (import-pokedex.mjs), chiêu học (import-learnsets.mjs)
```

### Thêm Pokémon mới

1. Thêm vào `PLAYABLE` trong `src/data/monsters.js` với id trùng tên trong Pokédex (vd: `caterpie`).
   Tên, hệ, chỉ số, tỉ lệ bắt được tự lấy từ Pokédex.
2. Chiêu học được lấy tự động từ bộ chiêu gốc trong `src/data/learnsets.json` (đủ 151 loài, không khai báo tay).
   File này tạo bằng `node scripts/import-learnsets.mjs` từ trang pokemondb.net lưu ở `.cache/pokemondb/`
   (thiếu trang thì script tự tải). Game là bản làm lại vùng Kanto kiểu GBA nên dùng quy tắc kết hợp, chỉ lấy dạng Kanto:
   - Chiêu học khi lên cấp (`learnset`): **FireRed/LeafGreen** (không lấy Ruby/Sapphire/Emerald).
   - Chiêu học ngay khi tiến hoá (`evolutionMoves`): Gen 3 chưa có cơ chế này nên lấy từ **Scarlet/Violet**,
     loài không có ở đó thì **Brilliant Diamond/Shining Pearl** (bỏ qua Legends: Z-A / Legends: Arceus).
   - Pokémon mới tạo (hoang dã, nhà huấn luyện, quà) biết 4 chiêu học gần nhất ở cấp hiện tại trở xuống, như game gốc.
     Chiêu cùng cấp xếp chiêu trạng thái trước; 4 chiêu đó toàn chiêu trạng thái thì thay chiêu cũ nhất bằng chiêu
     gây sát thương gần nhất (Oddish / Gloom cấp 18-23).
   - Tiến hoá (lên cấp hoặc đá): học chiêu tiến hoá của loài mới và chiêu loài mới học đúng ở cấp đó (như từ Gen 7).
   - Chiêu chưa có trong `src/data/moves.js` (cơ chế game chưa có: Protect, Leech Seed, chiêu nạp lượt...)
     được bỏ qua; thêm chiêu đó vào `moves.js` là các loài tự học được. Riêng Abra (gốc chỉ biết Teleport) tạm học
     Confusion, xem `EXTRA_LEARNSET` trong `monsters.js`.
3. Nếu cần chiêu mới thì thêm vào `src/data/moves.js` với số liệu gốc (Gen 9; chiêu đã bị bỏ thì theo Gen 7),
   chỉ khi các trường hiệu ứng có sẵn diễn tả đúng chiêu đó.
4. Thêm vào bảng gặp Pokémon trong `src/data/encounters.js`.
5. Thêm hình `src/assets/pokemon-svg/<id>.svg` hoặc `src/assets/pokemon/<id>.png`.
   Nếu chưa có hình, game vẽ tạm theo `color` và `features`.
6. Thêm màu shiny vào `src/data/shiny.js` (test báo thiếu nếu quên): loài vẽ bằng code khai báo `color` / `belly`...,
   loài có hình SVG / PNG khai báo `rules` (màu trong hình → màu shiny).
