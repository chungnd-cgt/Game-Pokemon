// kind: 'ball' (bonus = hệ số bắt) • 'heal' (hồi HP) • 'revive' (hồi sinh 50% HP)
export const ITEMS = {
  ball: {
    name: 'Poké Ball', kind: 'ball', bonus: 1, price: 200, icon: 'ball',
    desc: 'Ném vào Pokémon hoang dã để bắt. Pokémon càng yếu càng dễ bắt.',
  },
  greatBall: {
    name: 'Great Ball', kind: 'ball', bonus: 1.5, price: 600, icon: 'ball-great',
    desc: 'Bóng chất lượng cao, dễ bắt Pokémon hơn Poké Ball.',
  },
  ultraBall: {
    name: 'Ultra Ball', kind: 'ball', bonus: 2, price: 1200, icon: 'ball-ultra',
    desc: 'Bóng hiệu suất cao, tỉ lệ bắt tốt hơn Great Ball.',
  },
  potion: {
    name: 'Potion', kind: 'heal', heal: 20, price: 300, icon: 'item-potion',
    desc: 'Hồi 20 HP cho một Pokémon.',
  },
  superPotion: {
    name: 'Super Potion', kind: 'heal', heal: 50, price: 700, icon: 'item-super-potion',
    desc: 'Hồi 50 HP cho một Pokémon.',
  },
  hyperPotion: {
    name: 'Hyper Potion', kind: 'heal', heal: 200, price: 1500, icon: 'item-hyper-potion',
    desc: 'Hồi 200 HP cho một Pokémon.',
  },
  revive: {
    name: 'Revive', kind: 'revive', price: 2000, icon: 'item-revive',
    desc: 'Hồi sinh một Pokémon đã gục với một nửa HP tối đa.',
  },
};

// Hàng bày bán trong Poké Mart, theo thứ tự
export const MART_STOCK = ['ball', 'greatBall', 'ultraBall', 'potion', 'superPotion', 'hyperPotion', 'revive'];

// Bán lại cho cửa hàng được một nửa giá
export const sellPrice = (id) => Math.floor(ITEMS[id].price / 2);

export const formatMoney = (n) => `${n.toLocaleString('vi-VN')}₽`;
