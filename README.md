# Pokémon Demo

Bản demo game Pokémon 2D chạy trên trình duyệt (chạy local), lấy cảm hứng từ Pokémon Revolution Online.
Viết bằng [Phaser 3](https://phaser.io) + [Vite](https://vite.dev).

## Chạy game

Cần cài [Node.js](https://nodejs.org) 18 trở lên.

```bash
npm install      # chỉ cần chạy lần đầu
npm run dev      # mở http://localhost:5173 trên trình duyệt
```

Sửa code xong, trình duyệt tự tải lại.

## Build ra web

```bash
npm run build
```

Toàn bộ game nằm trong thư mục `dist/`, upload lên hosting tĩnh nào cũng chạy được.

## Cách chơi

| Phím | Tác dụng |
| --- | --- |
| Mũi tên / WASD | Di chuyển, chọn trong menu |
| Enter / Space / Z | Nói chuyện, đọc biển báo, xác nhận, đọc tiếp hội thoại |
| Esc / X | Quay lại |
| M | Xem đội hình và túi đồ |
| P | Mở Pokédex |

- Đi vào **bụi cỏ cao** sẽ gặp Pokémon hoang dã: Rattata, Pidgey, Oddish, Poliwag.
- Bụi cỏ **sẫm màu** ở phía đông có Pokémon mạnh hơn, và có cả Pikachu, Growlithe.
- Đi vào cửa **Pokémon Center** để hồi đầy máu cho cả đội.
- Đi vào cửa **Poké Mart** (mái xanh) để mua Poké Ball, Great Ball, Ultra Ball, các loại thuốc, Revive.
  Bắt đầu với 3.000₽.
- **Nhà huấn luyện** đứng gác đường: đi vào tầm nhìn của họ là bị thách đấu.
  Đấu với nhà huấn luyện thì không chạy được, không bắt được Pokémon của họ.
  Thắng thì được tiền thưởng và thêm 50% EXP. Nói chuyện lại với họ để đấu lại.
- Thua trận thì mất một nửa số tiền và được đưa về Pokémon Center.
- Nói chuyện với dân làng và đọc biển báo để nghe mẹo chơi.
- Đánh cho Pokémon hoang dã yếu đi rồi mới ném Poké Ball thì dễ bắt hơn.

## Pokédex

Pokédex có đủ 151 Pokémon thế hệ 1, hoạt động như game gốc:

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

- **Bản đồ và nhân vật:** pixel art 16×16 kiểu GBA, vẽ bằng code trong `src/gfx/world.js` và `src/gfx/player.js`.
- **Pokémon:** hình vector SVG trong `src/assets/pokemon-svg/`, sửa được bằng Inkscape hoặc Figma.

### Dùng sprite thật

Thả file PNG vào `src/assets/pokemon/`, tên file trùng với id của Pokémon:

- `pikachu.png`: mặt trước
- `pikachu-back.png`: mặt sau, dùng khi là Pokémon của mình (không bắt buộc)

PNG được ưu tiên hơn SVG. Ảnh tự co giãn cho vừa khung.
Thêm file xong thì khởi động lại `npm run dev`.

## Cấu trúc code

```
src/
  main.js              Khởi tạo game
  config.js            Kích thước màn hình, ô bản đồ, font
  data/                Dữ liệu game, sửa ở đây để cân bằng
    pokedex.json       Dữ liệu 151 Pokémon (tạo bởi scripts/import-pokedex.mjs)
    monsters.js        Pokémon chơi được trong game: chiêu học theo cấp, hình tạm
    moves.js           Chiêu thức
    types.js           Hệ và bảng tương khắc
    encounters.js      Pokémon xuất hiện ở từng loại bụi cỏ
    map.js             Bản đồ (vẽ bằng ký tự), vị trí nhà, nội dung biển báo
    npcs.js            Dân làng, nhà huấn luyện (đội hình, tiền thưởng, câu thoại)
    items.js           Vật phẩm, giá bán, hàng trong Poké Mart
  assets/
    pokemon-svg/       Hình Pokémon (SVG)
    pokemon/           Sprite PNG thật (tuỳ chọn, ưu tiên hơn SVG)
    ui/                Poké Ball
  game/                Pokémon (tạo, lên cấp) và trạng thái người chơi
  battle/formulas.js   Công thức sát thương, bắt Pokémon, EXP, bỏ chạy
  gfx/                 Pixel art bản đồ, nhân vật, hiệu ứng
  ui/                  Hộp thoại, menu, thanh máu
  scenes/              Các màn: Boot → chọn Pokémon → bản đồ ⇄ trận đấu
tests/                 Test cho phần logic (npm test)
```

### Thêm Pokémon mới

1. Thêm vào `PLAYABLE` trong `src/data/monsters.js` với id trùng tên trong Pokédex (vd: `caterpie`)
   và bộ chiêu học theo cấp. Tên, hệ, chỉ số, tỉ lệ bắt được tự lấy từ Pokédex.
2. Nếu cần chiêu mới thì thêm vào `src/data/moves.js`.
3. Thêm vào bảng gặp Pokémon trong `src/data/encounters.js`.
4. Thêm hình `src/assets/pokemon-svg/<id>.svg` hoặc `src/assets/pokemon/<id>.png`.
   Nếu chưa có hình, game vẽ tạm theo `color` và `features`.
# Game-Pokemon
