import { ITEMS, formatMoney } from '../data/items.js';
import { SPECIES } from '../data/monsters.js';
import { TYPES } from '../data/types.js';
import { createMonster } from '../game/monster.js';
import { addCaught, hasFlag, itemCount, setFlag, state, useItem } from '../game/state.js';

// Nhiệm vụ phụ: nói chuyện với NPC để nhận nhiệm vụ, làm xong quay lại nhận thưởng.
// Cờ: quest:<id> (đã nhận) • quest:<id>:done (đã xong).
// need (điều kiện hoàn thành, có thể kết hợp):
//   show: { type, level }  trong đội có Pokémon hệ type, cấp >= level (chỉ cho xem, không mất)
//   items: { id: số lượng } mang tới đủ vật phẩm (bị lấy đi khi trả nhiệm vụ)
//   trainers: [id]         thắng hết các nhà huấn luyện này
//   caught: n              Pokédex đã bắt được n loài
//   badge: id              đã có huy hiệu
// Vật phẩm nhặt trên đường có quest: '<id>' chỉ hiện khi đã nhận nhiệm vụ đó (xem objectVisible).

export const questTaken = (id) => hasFlag(`quest:${id}`);
export const questDone = (id) => hasFlag(`quest:${id}:done`);

// Những phần còn thiếu, mỗi phần một câu (rỗng = đã đủ điều kiện)
export function questMissing(need) {
  const missing = [];
  if (need.badge && !state.badges.has(need.badge)) missing.push('Cần có huy hiệu của gym trong thị trấn này.');
  if (need.show) {
    const { type, level = 1 } = need.show;
    const ok = state.party.some((m) => SPECIES[m.speciesId].types.includes(type) && m.level >= level);
    if (!ok) missing.push(`Mang theo trong đội một Pokémon hệ ${TYPES[type].name}${level > 1 ? ` từ cấp ${level} trở lên` : ''}.`);
  }
  for (const [id, qty] of Object.entries(need.items ?? {})) {
    const have = itemCount(id);
    if (have < qty) missing.push(`${ITEMS[id].name}: ${have}/${qty}`);
  }
  if (need.trainers) {
    const left = need.trainers.filter((t) => !state.defeatedTrainers.has(t)).length;
    if (left) missing.push(`Còn ${left} nhà huấn luyện chưa đánh bại.`);
  }
  if (need.caught && state.dex.caught.size < need.caught) missing.push(`Pokédex đã bắt: ${state.dex.caught.size}/${need.caught} loài.`);
  return missing;
}

// NPC giao nhiệm vụ. quest: { id, ask (lời nhờ), hint (nhắc khi chưa xong), done (lời cảm ơn), after (nói sau khi xong),
//   need, reward: [id, số lượng] }
export function questNpc({ quest, ...npc }) {
  const { id, ask, hint, done, after, need, reward } = quest;
  return {
    ...npc,
    quest: id,
    reward,
    async onTalk(world) {
      if (questDone(id)) {
        await world.say(npc.name, after);
        return;
      }
      if (!questTaken(id)) {
        await world.say(npc.name, ask);
        if (!(await world.ask('Nhận lời giúp đỡ chứ?', npc.name))) {
          await world.say(npc.name, ['Vậy à... Khi nào rảnh thì quay lại nhé.']);
          return;
        }
        setFlag(`quest:${id}`);
      }
      const missing = questMissing(need);
      if (missing.length) {
        await world.say(npc.name, hint);
        await world.say(null, ['Nhiệm vụ còn thiếu:', ...missing]);
        return;
      }
      for (const [item, qty] of Object.entries(need.items ?? {})) for (let i = 0; i < qty; i++) useItem(item);
      await world.say(npc.name, done);
      await world.giveItem(...reward);
      setFlag(`quest:${id}:done`);
    },
  };
}

// Giá xe đạp ở tiệm (không ai mua nổi, phải làm nhiệm vụ của ông chủ)
export const BIKE_PRICE = 999999999;
export const BIKE_PARTS = { bikeChain: 1, bikeWheel: 1, bikeSeat: 1 };

const bikeQuest = questNpc({
  id: 'q-bike', sprite: 'npc-oldman', name: 'Ông chủ tiệm xe', map: 'bikeShop', x: 0, y: 2, facing: 'down', fixed: true,
  quest: {
    id: 'bike',
    ask: [
      'Thật ra... hôm trước bão to, ta chở hàng qua mấy tuyến đường quanh đây thì rơi mất phụ tùng.',
      'Một sợi xích ở Tuyến đường 4, một bánh xe ở Tuyến đường 5 và một cái yên ở Tuyến đường 6.',
      'Cậu nhặt về đủ cho ta, ta tặng cậu chiếc xe đạp tốt nhất tiệm!',
    ],
    hint: ['Xích ở Tuyến đường 4, bánh xe ở Tuyến đường 5, yên xe ở Tuyến đường 6. Nhờ cậu đấy!'],
    done: ['Đủ cả rồi! Cậu đúng là ân nhân của tiệm.', 'Như đã hứa, chiếc xe đạp này là của cậu. Không lấy một đồng nào!'],
    after: ['Xe chạy êm chứ? Bấm {key:bike} để lên / xuống xe nhé.'],
    need: { items: BIKE_PARTS },
    reward: ['bicycle', 1],
  },
});

// Ông chủ tiệm xe đạp (Thành phố Đèn Lồng): rao bán trước, không đủ tiền thì nhờ làm nhiệm vụ
const bikeOwner = {
  ...bikeQuest,
  async onTalk(world) {
    if (itemCount('bicycle')) {
      await world.say(this.name, ['Xe chạy êm chứ? Bấm {key:bike} để lên / xuống xe nhé.']);
      return;
    }
    if (!questTaken('bike')) {
      await world.say(this.name, ['Chào mừng tới tiệm xe đạp Đèn Lồng!', `Xe đạp hàng xịn, giá chỉ ${formatMoney(BIKE_PRICE)} thôi!`]);
      if (await world.ask(`Mua xe đạp với giá ${formatMoney(BIKE_PRICE)}?`, this.name)) {
        if (state.money >= BIKE_PRICE) {
          state.money -= BIKE_PRICE;
          await world.say(this.name, ['Trời... cậu có đủ tiền thật à?! Xe của cậu đây!']);
          await world.giveItem('bicycle');
          setFlag('quest:bike:done');
          return;
        }
        await world.say(this.name, ['Ha ha, không đủ tiền phải không? Ai mà mua nổi chứ!']);
      }
    }
    await bikeQuest.onTalk.call(this, world);
  },
};

// Trung tâm thương mại: tặng một Eevee để thử đá tiến hoá (Water / Thunder / Fire Stone)
const eeveeGift = {
  id: 'store-eevee', sprite: 'npc-girl', name: 'Cô gái', map: 'store5', x: 13, y: 7, facing: 'left', fixed: true,
  async onTalk(world) {
    if (hasFlag('gift:eevee')) {
      await world.say(this.name, ['Eevee lớn nhanh không? Thử cho nó dùng đá tiến hoá xem, mỗi loại đá một dạng khác nhau đó!']);
      return;
    }
    await world.say(this.name, [
      'Nhà mình có một bé Eevee mà không có thời gian chăm.',
      'Eevee tiến hoá theo đá: Water Stone thành Vaporeon, Thunder Stone thành Jolteon, Fire Stone thành Flareon.',
      'Bạn nhận nuôi bé giúp mình nhé?',
    ]);
    if (!(await world.ask('Nhận nuôi Eevee?', this.name))) return;
    const where = addCaught(createMonster('eevee', 20));
    setFlag('gift:eevee');
    await world.say(null, [where === 'party' ? 'Bạn nhận được Eevee!' : 'Bạn nhận được Eevee! Đội hình đã đủ nên Eevee được gửi vào hộp PC.']);
    world.refreshFollower();
  },
};

export const QUEST_NPCS = [
  eeveeGift,
  questNpc({
    id: 'q-poison', sprite: 'npc-boy', name: 'Nhóc Bin', map: 'town2', x: 12, y: 14, facing: 'down', wander: 1,
    quest: {
      id: 'poison',
      ask: ['Anh ơi, em đang viết bài về Pokémon hệ Độc mà chưa được thấy con nào tận mắt cả.', 'Anh cho em xem một con được không?'],
      hint: ['Em vẫn đang chờ xem Pokémon hệ Độc đó! Ekans hay Koffing đều được.'],
      done: ['Oa, ngầu quá! Em vẽ xong bài rồi.', 'Cảm ơn anh, cái gai độc này em nhặt được, tặng anh nè!'],
      after: ['Pokémon cầm Poison Barb thì chiêu hệ Độc mạnh hơn đó!'],
      need: { show: { type: 'poison' } },
      reward: ['poisonBarb', 1],
    },
  }),
  questNpc({
    id: 'q-farmer', sprite: 'npc-oldman', name: 'Bác nông dân', map: 'town3', x: 24, y: 12, facing: 'down', wander: 1,
    quest: {
      id: 'farmer',
      ask: ['Năm nay lúa trúng mùa nhưng bọn Pokémon trong ruộng đói quá, cứ phá lúa.', 'Cháu kiếm giúp bác 3 quả Oran cho chúng ăn được không?'],
      hint: ['Quả Oran hái ở Tuyến đường 2, Làng Chân Đồi hoặc dãy cây ngay trong thành phố này. Bác cần 3 quả.'],
      done: ['Tốt quá, bọn chúng no rồi, không phá lúa nữa!', 'Bác có món đồ ăn mãi không hết này, cháu cầm lấy.'],
      after: ['Pokémon cầm Leftovers thì mỗi lượt đấu tự hồi chút máu đấy.'],
      need: { items: { oranBerry: 3 } },
      reward: ['leftovers', 1],
    },
  }),
  questNpc({
    id: 'q-weaver', sprite: 'npc-woman', name: 'Cô thợ dệt', map: 'town3', x: 7, y: 14, facing: 'right', wander: 0,
    quest: {
      id: 'weaver',
      ask: ['Cô đang dệt một tấm khăn lụa họa hình Pokémon hệ Thường.', 'Cháu cho cô xem một con hệ Thường đã luyện tới cấp 20 để cô vẽ mẫu nhé?'],
      hint: ['Pokémon hệ Thường từ cấp 20 trở lên: Raticate, Pidgeotto... con nào cũng được.'],
      done: ['Đẹp quá! Mẫu khăn xong rồi.', 'Đây là tấm khăn lụa đầu tiên, cô tặng cháu.'],
      after: ['Silk Scarf làm chiêu hệ Thường mạnh hơn đó.'],
      need: { show: { type: 'normal', level: 20 } },
      reward: ['silkScarf', 1],
    },
  }),
  questNpc({
    id: 't4-oldman', sprite: 'npc-oldman', name: 'Ông đồ', map: 'town4', x: 13, y: 12, facing: 'down', wander: 1,
    quest: {
      id: 'lantern',
      ask: ['Hai kẻ trên Tuyến đường 5 cứ đấu Pokémon làm hỏng đèn lồng của phố.', 'Cháu đánh bại cả hai, bảo họ đi chỗ khác chơi giùm ông nhé.'],
      hint: ['Kỹ sư Minh và anh Long ở Tuyến đường 5 đó cháu.'],
      done: ['Đèn lồng sáng trở lại rồi! Cảm ơn cháu.', 'Ông có cặp kính đen này, trời nắng đeo đỡ chói. Cháu cầm lấy.'],
      after: ['Pokémon hệ Đất miễn nhiễm hoàn toàn với chiêu hệ Điện đấy!'],
      need: { trainers: ['r5-engineer', 'r5-birdkeeper'] },
      reward: ['blackGlasses', 1],
    },
  }),
  questNpc({
    id: 'q-research', sprite: 'npc-aide', name: 'Nhà nghiên cứu', map: 'town5', x: 18, y: 6, facing: 'down', wander: 0,
    quest: {
      id: 'research',
      ask: ['Tôi là học trò của Giáo sư Oak, đang thu thập dữ liệu Pokédex vùng Sơn Thủy.', 'Khi nào Pokédex của bạn bắt được 15 loài, quay lại gặp tôi nhé!'],
      hint: ['Bắt càng nhiều loài càng tốt, câu cá cũng là một cách hay đấy.'],
      done: ['15 loài rồi! Dữ liệu này quý lắm.', 'Giáo sư Oak gửi bạn quả trứng may mắn này.'],
      after: ['Pokémon cầm Lucky Egg nhận thêm 50% EXP. Luyện Pokémon mới nhanh lắm!'],
      need: { caught: 15 },
      reward: ['luckyEgg', 1],
    },
  }),
  bikeOwner,
  questNpc({
    id: 'q-arcanine', sprite: 'npc-hiker', name: 'Người nuôi Arcanine', map: 'town6', x: 26, y: 12, facing: 'down', wander: 0,
    quest: {
      id: 'arcanine',
      ask: [
        'Ta nuôi Arcanine để chở hàng gốm qua núi. Con Arcanine khoẻ nhất của ta cần một người chủ xứng đáng.',
        'Hãy thắng thầy Nung ở Gym Lò Gốm, rồi cho ta xem một Pokémon hệ Lửa cấp 35 của cậu.',
      ],
      hint: ['Thắng gym Lò Gốm và mang theo một Pokémon hệ Lửa từ cấp 35 trở lên.'],
      done: ['Ánh mắt của Pokémon kia cho ta biết cậu chăm nó rất tốt.', 'Arcanine, từ giờ hãy theo cậu ấy nhé!'],
      after: ['Bấm {key:ride} để cưỡi Arcanine. Nó chạy nhanh như gió đấy!'],
      need: { badge: 'fire', show: { type: 'fire', level: 35 } },
      reward: ['arcanineMount', 1],
    },
  }),
  questNpc({
    id: 'q-lapras', sprite: 'npc-girl', name: 'Cô gái chăm Lapras', map: 'town9', x: 26, y: 12, facing: 'left', wander: 0,
    quest: {
      id: 'lapras',
      ask: ['Lapras trong hồ này mùa đông kén ăn lắm, chỉ thích quả Aspear mát lạnh.', 'Bạn mang giúp mình 3 quả Aspear được không?'],
      hint: ['Quả Aspear hái ở Tuyến đường 10, Làng Đèo Tuyết hoặc dãy cây ngay trong thành phố này. Mình cần 3 quả.'],
      done: ['Lapras ăn ngon lành rồi! Nó quý bạn lắm đó.', 'Nó muốn đi theo bạn ngắm biển. Bạn chở nó... à không, nó chở bạn nhé!'],
      after: ['Đứng ở bờ nước bấm {key:confirm}, chọn cưỡi Lapras để lướt thật nhanh.'],
      need: { items: { aspearBerry: 3 } },
      reward: ['laprasMount', 1],
    },
  }),
];
