// Bảng màu từng kiểu nhân vật (người chơi, NPC): vẽ pixel art theo bảng này (gfx/player.js).

const SKIN = '#f8c8a0';
// Diện mạo mặc định của người chơi (khi chưa tuỳ chỉnh). LOOKS.player / LOOKS['player-f'] là bản sao, được thay bằng
// diện mạo người chơi tự chọn khi vào game (gfx/player.js: applyPlayerLook, data/playerCustom.js)
export const PLAYER_BASE_LOOKS = Object.freeze({
  // Người chơi nam: mũ lưỡi trai đỏ logo trắng, tóc nâu đen, áo khoác xanh, ba lô vàng
  male: Object.freeze({ skin: SKIN, hair: '#3a2420', hairStyle: 'cap', hat: '#e03838', hatAccent: '#ffffff', shirt: '#3870d8', pants: '#3a4258', shoes: '#e04040', backpack: '#f0c040', belt: '#2a2a38' }),
  // Người chơi nữ: nón rộng vành trắng dải đỏ, tóc nâu dài, áo cam đỏ, váy xanh than, túi đeo chéo vàng
  female: Object.freeze({ skin: SKIN, hair: '#8a4a2a', hairStyle: 'sunhat', hat: '#f8f8f0', hatAccent: '#e84860', shirt: '#f06848', skirt: '#3a4a9a', pants: '#3a4a9a', shoes: '#e04848', dress: true, bag: '#f0c040' }),
});

export const LOOKS = {
  player: { ...PLAYER_BASE_LOOKS.male },
  'player-f': { ...PLAYER_BASE_LOOKS.female },
  'npc-youngster': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#3a70d8', hatAccent: '#ffffff', shirt: '#f0c040', pants: '#4a5878', shoes: '#3a3a48' },
  'npc-lass': { skin: SKIN, hair: '#c06030', hairStyle: 'long', shirt: '#f080a8', pants: '#f080a8', shoes: '#c04060', dress: true },
  'npc-camper': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#3a9a4a', hatAccent: '#f0e0a0', shirt: '#c8a860', pants: '#6a5a3a', shoes: '#5a3a20', backpack: '#8a5a30' },
  'npc-oldman': { skin: SKIN, hair: '#d8d8dc', hairStyle: 'old', shirt: '#8a6040', pants: '#505868', shoes: '#3a3030', belt: '#5a3a20' },
  'npc-girl': { skin: SKIN, hair: '#4a2a20', hairStyle: 'long', shirt: '#50b070', pants: '#3a4a7a', shoes: '#c04040' },
  'npc-boy': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#f08030', hatAccent: '#ffffff', shirt: '#e04848', pants: '#3a4a7a', shoes: '#3a3a48' },
  'npc-fisher': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#e8e8e8', hatAccent: '#3a70d8', shirt: '#5a7a90', pants: '#3a4050', shoes: '#5a3a20' },
  'npc-woman': { skin: SKIN, hair: '#8a4a2a', hairStyle: 'bun', shirt: '#9a60c8', pants: '#9a60c8', shoes: '#5a3a5a', dress: true },
  'npc-oak': { skin: SKIN, hair: '#b0b0b8', hairStyle: 'short', shirt: '#c04040', coat: '#f4f4f4', pants: '#8a6040', shoes: '#5a3a20' },
  'npc-gary': { skin: SKIN, hair: '#8a5a2a', hairStyle: 'spiky', shirt: '#7a50b0', pants: '#3a3a50', shoes: '#4a4a58' },
  'npc-mom': { skin: SKIN, hair: '#6a3a20', hairStyle: 'long', shirt: '#e07050', pants: '#4a5a8a', shoes: '#c04040', dress: true },
  'npc-aide': { skin: SKIN, hair: '#3a2a20', hairStyle: 'short', shirt: '#4a7ad8', coat: '#f4f4f4', pants: '#4a5a8a', shoes: '#3a3a48' },
  'npc-rocket': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#2a2a30', hatAccent: '#e03030', shirt: '#2a2a30', pants: '#2a2a30', shoes: '#1a1a20', gloves: '#e8e8f0', belt: '#4a4a58' },
  'npc-rocket-f': { skin: SKIN, hair: '#c83a6a', hairStyle: 'long', shirt: '#2a2a30', pants: '#2a2a30', shoes: '#1a1a20', gloves: '#e8e8f0', belt: '#e03030', dress: true },
  'npc-joy': { skin: SKIN, hair: '#f890b0', hairStyle: 'nurse', shirt: '#f8c0d0', pants: '#f8c0d0', shoes: '#f8f8f8', dress: true },
  'npc-hiker': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#8a6a3a', hatAccent: '#e8d8a0', shirt: '#7a8a3a', pants: '#5a4a3a', shoes: '#3a2a20', backpack: '#c08040' },
  'npc-birdkeeper': { skin: SKIN, hair: '#2a2a3a', hairStyle: 'short', shirt: '#58b0e8', pants: '#3a4a7a', shoes: '#2a3a5a', coat: '#e8f0f8' },
  'npc-leader-wind': { skin: SKIN, hair: '#48b8c8', hairStyle: 'long', shirt: '#f0f8ff', pants: '#3a6ad0', shoes: '#2a3a6a', coat: '#5aa8e8', dress: true },
  'npc-guide': { skin: SKIN, hair: '#3a2a20', hairStyle: 'short', shirt: '#e8e8e8', pants: '#3a3a48', shoes: '#2a2a30', belt: '#e04040' },
  'npc-leader-grass': { skin: SKIN, hair: '#3a7a2a', hairStyle: 'bun', shirt: '#f0e8c0', pants: '#5a8a3a', shoes: '#4a3a20', coat: '#7ac050', dress: true },
  'npc-leader-electric': { skin: SKIN, hair: '#f0c030', hairStyle: 'spiky', shirt: '#3a3a48', pants: '#2a2a38', shoes: '#f0c030', coat: '#e8b020' },
  'npc-leader-water': { skin: SKIN, hair: '#3a5ad0', hairStyle: 'long', shirt: '#e8f4ff', pants: '#3a8ae8', shoes: '#2a4a8a', dress: true },
  'npc-leader-fire': { skin: SKIN, hair: '#2a1a10', hairStyle: 'short', shirt: '#e85020', pants: '#5a3a2a', shoes: '#3a2010', coat: '#8a4a28', belt: '#f0a030' },
  'npc-leader-rock': { skin: SKIN, hair: '#5a4a3a', hairStyle: 'spiky', shirt: '#8a7a60', pants: '#5a4a3a', shoes: '#3a3028', coat: '#6a5a48', belt: '#3a3028' },
  'npc-leader-psychic': { skin: SKIN, hair: '#7a3aa8', hairStyle: 'long', shirt: '#f0d8f8', pants: '#b060d0', shoes: '#5a2a7a', coat: '#e8a040', dress: true },
  'npc-leader-ice': { skin: SKIN, hair: '#e8f4ff', hairStyle: 'long', shirt: '#ffffff', pants: '#88c8f0', shoes: '#3a6a9a', coat: '#a8e0f8', dress: true },
  'npc-elite-poison': { skin: SKIN, hair: '#58b048', hairStyle: 'long', shirt: '#6a3a98', pants: '#3a2a58', shoes: '#2a1a40', coat: '#58b048', dress: true },
  'npc-elite-fighting': { skin: SKIN, hair: '#1a1a1a', hairStyle: 'short', shirt: '#f4f0e8', pants: '#f4f0e8', shoes: '#3a2a20', belt: '#1a1a1a' },
  'npc-elite-ghost': { skin: SKIN, hair: '#2a1a3a', hairStyle: 'long', shirt: '#3a2a4a', pants: '#2a1a3a', shoes: '#18121f', coat: '#8a68c8', dress: true },
  'npc-elite-dragon': { skin: SKIN, hair: '#c03030', hairStyle: 'spiky', shirt: '#2a3a6a', pants: '#1a2448', shoes: '#1a1a20', coat: '#4a68c8' },
  'npc-champion': { skin: SKIN, hair: '#3a2a20', hairStyle: 'short', shirt: '#ffffff', pants: '#2a2a38', shoes: '#1a1a20', coat: '#d8a830', belt: '#8a2a2a' },
  'npc-ace': { skin: SKIN, hair: '#3a2a20', hairStyle: 'cap', hat: '#2a3a6a', hatAccent: '#f8e088', shirt: '#2a3a6a', pants: '#1a1a28', shoes: '#1a1a20', gloves: '#f0f0f0' },
  'npc-ace-f': { skin: SKIN, hair: '#8a3a20', hairStyle: 'long', shirt: '#2a3a6a', pants: '#2a3a6a', shoes: '#1a1a20', gloves: '#f0f0f0', dress: true },
  'npc-clerk': { skin: SKIN, hair: '#3a2a20', hairStyle: 'short', shirt: '#4a7ad8', pants: '#404860', shoes: '#3a3a48', belt: '#f8f8f8' },
};
