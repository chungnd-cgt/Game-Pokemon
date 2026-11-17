// Cheat riêng cho người chơi tên "Chung" (không phân biệt hoa thường).
// Tự gắn vào game bằng cách bọc vài hàm của WorldScene, KHÔNG sửa file nào của luồng chính.
// Gỡ ra: xoá file này và dòng `import './cheats/chung.js';` trong src/startGame.js. Bản lưu cũ vẫn chơi bình thường
// (chỉ còn sót vài cờ 'cheat:chung:*' vô hại trong state.flags).
//
//  1. Pokémon khởi đầu luôn shiny, IV full 31, tính cách: Bulbasaur Bold, Charmander Timid, Squirtle Modest, Pikachu Timid
//  2. Pokémon hoang dã (bụi cỏ, hang, lướt nước, câu cá) luôn shiny
//  3. Đánh đuổi Team Rocket lần đầu (Thị trấn Lục Bình): tặng Xe đạp, Thú cưỡi Arcanine + Lapras, cả 3 cần câu, 999 Rare Candy,
//     full dex: đủ 151 Pokémon cấp 50 gửi vào hộp PC (kể cả huyền thoại, nên huyền thoại không còn xuất hiện trên bản đồ)
import { ITEMS } from '../data/items.js';
import { DEX } from '../data/pokedex.js';
import { IV_MAX, emptyStats } from '../data/stats.js';
import { createMonster, recalcStats } from '../game/monster.js';
import { addItem, hasFlag, setFlag, state } from '../game/state.js';
import WorldScene from '../scenes/WorldScene.js';

const CHEAT_NAME = 'chung';
// Cờ cốt truyện có sẵn (story/chapter1.js: F.STARTER, F.GRUNTS)
const STORY_STARTER = 'gotStarter';
const STORY_ROCKET = 'gruntsDefeated';
// Cờ riêng của cheat: mỗi phần thưởng chỉ trao một lần (lưu cùng bản lưu)
const DONE_STARTER = 'cheat:chung:starter';
const DONE_ROCKET = 'cheat:chung:rocketGift';
// Đổi tên cờ (bản trước chỉ ghi Pokédex, chưa có Pokémon): bản lưu cũ vẫn nhận đủ 151 con vào hộp PC
const DONE_DEX = 'cheat:chung:boxAll151';
const BOX_LEVEL = 50; // cấp của 151 Pokémon gửi vào hộp PC

const ROCKET_GIFTS = [
  ['bicycle', 1],
  ['arcanineMount', 1], // cưỡi trên cạn (phím R)
  ['laprasMount', 1], // cưỡi dưới nước (Enter ở bờ nước)
  ['oldRod', 1],
  ['goodRod', 1],
  ['superRod', 1],
  ['rareCandy', 999],
];

const isChung = () => (state.player?.name ?? '').trim().toLowerCase() === CHEAT_NAME;

// Tính cách ép cho từng Pokémon khởi đầu (kèm IV full 31)
const STARTER_NATURES = { bulbasaur: 'bold', charmander: 'timid', squirtle: 'modest', pikachu: 'timid' };

// Pokémon khởi đầu: vừa nhận (cờ gotStarter, đội chỉ có đúng 1 con) thì đổi sang shiny, IV full, tính cách đẹp
function shinyStarter(world) {
  if (hasFlag(DONE_STARTER) || !hasFlag(STORY_STARTER) || state.party.length !== 1) return;
  const mon = state.party[0];
  mon.shiny = true;
  const nature = STARTER_NATURES[mon.speciesId];
  if (nature) {
    mon.nature = nature;
    mon.ivs = emptyStats(IV_MAX);
    recalcStats(mon);
    mon.hp = mon.maxHp;
  }
  setFlag(DONE_STARTER);
  world.refreshFollower(); // Pokémon đi theo đổi sang màu shiny ngay
}

// Đánh Rocket xong: đợi cảnh cắt kết thúc (người chơi rảnh tay) rồi mới trao quà
function rocketGift(world) {
  const giveItems = !hasFlag(DONE_ROCKET);
  const giveDex = !hasFlag(DONE_DEX); // cờ riêng: bản lưu đã nhận quà trước khi có full dex vẫn được bổ sung
  if ((!giveItems && !giveDex) || !hasFlag(STORY_ROCKET)) return;
  const idle = !world.busy && !world.moving && !world.partyMenu && !world.settingsMenu && !world.overlay && !world.msg?.container.visible;
  if (!idle) return;
  setFlag(DONE_ROCKET);
  setFlag(DONE_DEX);
  world.runEvent(async () => {
    const got = giveItems ? ROCKET_GIFTS.map(([id, qty]) => [id, addItem(id, qty)]).filter(([, n]) => n > 0) : [];
    const dex = giveDex ? fillDex() : null;
    await world.say(null, [
      'Có ai đó để lại một chiếc hộp lớn đề tên "Chung"...',
      ...got.map(([id, n]) => `Bạn nhận được ${n > 1 ? `${n} ` : ''}${ITEMS[id].name}!`),
      ...(dex !== null ? [`${dex} Pokémon (đủ cả Pokédex, cấp ${BOX_LEVEL}) đã được gửi vào hộp PC!`] : []),
    ]);
  });
}

// Full dex: mỗi loài trong 151 loài một con, gửi thẳng vào hộp PC (không đụng đội hình), Pokédex ghi đã bắt đủ.
// Lưu ý: game coi huyền thoại "đã bắt" theo Pokédex (story/postgame.js: legendCaught) nên 5 con huyền thoại
// sẽ không còn xuất hiện trên bản đồ. Hộp PC tự mở thêm hộp khi đầy (game/storage.js)
function fillDex() {
  for (const { slug, id } of DEX) {
    const free = state.storage.indexOf(null);
    const mon = createMonster(slug, BOX_LEVEL);
    if (free >= 0) state.storage[free] = mon;
    else state.storage.push(mon);
    state.dex.seen.add(id);
    state.dex.caught.add(id);
  }
  return DEX.length;
}

const { startBattle, update } = WorldScene.prototype;

// Trận gặp Pokémon hoang dã (có enemy, không có trainer): Pokémon đối thủ luôn shiny
WorldScene.prototype.startBattle = function (data) {
  if (isChung() && data?.enemy && !data.trainer) data.enemy.shiny = true;
  return startBattle.call(this, data);
};

WorldScene.prototype.update = function (time, delta) {
  update.call(this, time, delta);
  if (!isChung()) return;
  shinyStarter(this);
  rocketGift(this);
};
