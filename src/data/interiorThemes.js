// Bảng màu nội thất theo từng loại nhà / gym (gfx/interior.js).

export const THEMES = {
  // Pokémon Center: sàn gạch vàng đất có ô sáng giữa viên, tường trên ốp gỗ cam, quầy chữ U đỏ (gfx/props.js)
  center: {
    inset: true, uCounter: true, floor: '#dcb878', floorAlt: '#e8c890', grout: '#c09c5c',
    wall: '#f0e2c4', stripe: '#e4d2ae', trim: '#c8783a', trimDark: '#a05a28', base: '#8a4a20',
    counterTop: '#d83a2c', counterLight: '#f06a50', counterFront: '#ece8e2', counterDark: '#c4beb6', ink: '#4a2a14',
    counterInk: '#5a1810',
  },
  // Poké Mart: sàn gạch xám nhạt, giữa phòng trải thảm xanh mòng két hoạ tiết hình thoi (map.carpet), tường kem có viền xanh
  // phía trên và chân tường vàng đất, quầy thu ngân chữ L mặt xanh thép ốp trắng, ghế đẩu đệm xanh
  pokeMart: {
    floor: '#dde1e8', floorAlt: '#d4d9e2', grout: '#b8bfcc',
    wall: '#f2ecd2', stripe: '#e8dfc0', trim: '#4a78c8', trimDark: '#3a62a8', base: '#d0a058', ink: '#3a4a6a',
    uCounter: true, counterTop: '#4a6a98', counterLight: '#7a98c8', counterFront: '#eef0f4', counterDark: '#c0c6d0', counterInk: '#1e2a44',
    carpet: '#3a8c9c', carpetAlt: '#4a9cac', carpetLine: '#2e7280', carpetEdge: '#c8a060',
    stool: ['#2a3a6a', '#4a68b0', '#7a98d8'],
  },
  mart: {
    floor: '#eef2f8', floorAlt: '#e2e8f2', grout: '#c8d2e2',
    wall: '#f2f6fb', stripe: '#e2eaf4', trim: '#a8b8d0', trimDark: '#8898b4', base: '#6a7a98',
    counterTop: '#c8daf8', counterLight: '#e4eeff', counterFront: '#4a7ad8', counterDark: '#2f5cb8', ink: '#1e2a4a',
  },
  home: {
    wood: true, floor: '#d8a868', floorAlt: '#cc9c5c', grout: '#a87840',
    wall: '#f4e8d0', stripe: '#ead8b8', trim: '#c8a070', trimDark: '#a88050', base: '#8a6040',
    counterTop: '#c08850', counterLight: '#d8a868', counterFront: '#8a5a30', counterDark: '#6a4020', ink: '#4a3020',
  },
  gym: {
    floor: '#d8f0fa', floorAlt: '#c8e6f4', grout: '#a8d0e4',
    wall: '#e8f6fc', stripe: '#d0ecf8', trim: '#58a8c8', trimDark: '#3a88a8', base: '#2a6a88',
    counterTop: '#e8f6fc', counterLight: '#ffffff', counterFront: '#58a8c8', counterDark: '#3a88a8', ink: '#1a3a50',
  },
  gymGrass: {
    floor: '#e8e0b8', floorAlt: '#ddd4a8', grout: '#c4b888',
    wall: '#eef0d8', stripe: '#dce4b8', trim: '#7aa850', trimDark: '#5a8838', base: '#3a6a28',
    counterTop: '#eef0d8', counterLight: '#ffffff', counterFront: '#7aa850', counterDark: '#5a8838', ink: '#2a4a1a',
  },
  gymElectric: {
    floor: '#9a9eb0', floorAlt: '#9095a8', grout: '#7a7f94',
    wall: '#3a3e4c', stripe: '#4a4e60', trim: '#f0c030', trimDark: '#c09020', base: '#2a2e3c',
    counterTop: '#3a3e4c', counterLight: '#5a5e70', counterFront: '#f0c030', counterDark: '#c09020', ink: '#1a1c28',
  },
  gymWater: {
    floor: '#c8a878', floorAlt: '#bc9c6c', grout: '#8a6a40',
    wall: '#d8eef8', stripe: '#c0e0f0', trim: '#3a8ae8', trimDark: '#2a6ac8', base: '#1a4a98',
    counterTop: '#d8eef8', counterLight: '#ffffff', counterFront: '#3a8ae8', counterDark: '#2a6ac8', ink: '#102a58',
  },
  gymFire: {
    floor: '#c8a888', floorAlt: '#bc9c7c', grout: '#8a6a50',
    wall: '#f0d8c0', stripe: '#e4c4a8', trim: '#c85a28', trimDark: '#a03a18', base: '#6a2a10',
    counterTop: '#f0d8c0', counterLight: '#ffffff', counterFront: '#c85a28', counterDark: '#a03a18', ink: '#3a1408',
  },
  gymRock: {
    floor: '#8a7c6a', floorAlt: '#82745f', grout: '#5e5040',
    wall: '#a89880', stripe: '#9a8a72', trim: '#6a5a48', trimDark: '#4a3e30', base: '#3a3028',
    counterTop: '#a89880', counterLight: '#c8b8a0', counterFront: '#6a5a48', counterDark: '#4a3e30', ink: '#2a2420',
  },
  gymPsychic: {
    floor: '#e8d8f0', floorAlt: '#dccbe8', grout: '#b89ad0',
    wall: '#f4ecf8', stripe: '#e8d8f0', trim: '#a858d8', trimDark: '#7a38a8', base: '#4a1a6a',
    counterTop: '#f4ecf8', counterLight: '#ffffff', counterFront: '#a858d8', counterDark: '#7a38a8', ink: '#2a1040',
  },
  gymIce: {
    floor: '#e8f0f8', floorAlt: '#dce8f4', grout: '#b0c8e0',
    wall: '#f4faff', stripe: '#e0f0fc', trim: '#78b8e0', trimDark: '#5898c0', base: '#2a5a88',
    counterTop: '#f4faff', counterLight: '#ffffff', counterFront: '#78b8e0', counterDark: '#5898c0', ink: '#14304a',
  },
  // Liên minh: sảnh đá cẩm thạch viền vàng, mỗi phòng Thiên Vương một màu theo hệ
  league: {
    floor: '#f0ece4', floorAlt: '#e6e0d4', grout: '#c8bca0',
    wall: '#f8f4ec', stripe: '#ece4d4', trim: '#d8a830', trimDark: '#a87818', base: '#5a3a88',
    counterTop: '#f8f0d8', counterLight: '#ffffff', counterFront: '#7a48b8', counterDark: '#5a3088', ink: '#2a1840',
  },
  elitePoison: {
    floor: '#5a4878', floorAlt: '#524070', grout: '#3a2a58',
    wall: '#6a5a88', stripe: '#5e4e7c', trim: '#58b048', trimDark: '#3a8830', base: '#2a1a40',
    counterTop: '#6a5a88', counterLight: '#8a7aa8', counterFront: '#58b048', counterDark: '#3a8830', ink: '#1a1028',
  },
  eliteFighting: {
    wood: true, floor: '#c89858', floorAlt: '#bc8c4c', grout: '#8a6030',
    wall: '#f0e0c0', stripe: '#e4d0a8', trim: '#a83a2a', trimDark: '#7a2418', base: '#4a2a18',
    counterTop: '#c08850', counterLight: '#d8a868', counterFront: '#a83a2a', counterDark: '#7a2418', ink: '#3a1a10',
  },
  eliteGhost: {
    floor: '#3a3448', floorAlt: '#342e42', grout: '#241e30',
    wall: '#4a4060', stripe: '#423858', trim: '#8a68c8', trimDark: '#5a4498', base: '#18121f',
    counterTop: '#4a4060', counterLight: '#6a6080', counterFront: '#8a68c8', counterDark: '#5a4498', ink: '#100c18',
  },
  eliteDragon: {
    floor: '#8a8478', floorAlt: '#827c70', grout: '#5e584e',
    wall: '#a8a090', stripe: '#9a9282', trim: '#4a68c8', trimDark: '#2a48a0', base: '#1a2448',
    counterTop: '#a8a090', counterLight: '#c8c0b0', counterFront: '#4a68c8', counterDark: '#2a48a0', ink: '#141c38',
  },
  champion: {
    floor: '#f8f0d8', floorAlt: '#f0e4c4', grout: '#d8c08a',
    wall: '#fff8e8', stripe: '#f4ead0', trim: '#e8b828', trimDark: '#b88a10', base: '#8a2a2a',
    counterTop: '#fff8e8', counterLight: '#ffffff', counterFront: '#e8b828', counterDark: '#b88a10', ink: '#3a2408',
  },
  // Phòng thí nghiệm Giáo sư Oak: tường xanh mòng két, sàn gỗ ván chéo
  oakLab: {
    diagonal: true, floor: '#e4bc84', floorAlt: '#dab078', grout: '#c09460',
    wall: '#1e7c92', stripe: '#1a7086', trim: '#145a6e', trimDark: '#0e4858', base: '#0c3a48',
    counterTop: '#e8ecf0', counterLight: '#ffffff', counterFront: '#9aa4b4', counterDark: '#7a8494', ink: '#0a2a34',
  },
  lab: {
    floor: '#f0f2f4', floorAlt: '#e6e9ee', grout: '#c8ccd4',
    wall: '#f8f8fa', stripe: '#eaecf0', trim: '#b8c0cc', trimDark: '#98a0b0', base: '#6a7280',
    counterTop: '#e8ecf0', counterLight: '#ffffff', counterFront: '#9aa4b4', counterDark: '#7a8494', ink: '#2a3040',
  },
};
