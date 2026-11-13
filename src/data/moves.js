// Mỗi chiêu tự mang loại riêng như từ Gen 4: 'physical' (dùng Atk/Def), 'special' (SpA/SpD), 'status' (không gây sát thương).
// [id, tên, hệ, loại, sức mạnh, độ chính xác % (null = không bao giờ trượt), PP, thêm]
// thêm: contact (đòn tiếp xúc) • priority • status: [trạng thái, % cơ hội] gây cho đối thủ
//       stages: { chỉ số: số bậc }, self: đổi chỉ số của chính mình, chance: % cơ hội đổi chỉ số
//       drain: hồi máu theo tỉ lệ sát thương • flinch: % làm đối thủ chùn bước • highCrit: dễ chí mạng
//       weather: đổi thời tiết trận đấu trong 5 lượt ('sun' nắng gắt, 'rain' mưa) • sound: chiêu âm thanh (Soundproof chặn)
//       punch: đòn đấm (Iron Fist tăng sức mạnh) • recoil: mất máu phản đòn theo tỉ lệ sát thương gây ra (Struggle: theo HP tối đa)
//       weather còn có 'sand' (bão cát) và 'hail' (mưa đá) • confuse: % làm đối thủ rối loạn
//       hits: số đòn (2 = luôn 2 lần, [2, 5] = 2-5 lần) • explode: người dùng gục sau khi ra đòn (Damp chặn được)
//       screen: dựng lớp chắn 5 lượt cho phe mình ('reflect' chặn đòn vật lý, 'lightScreen' chặn đòn đặc biệt)
//       breaksScreens: phá Reflect / Light Screen của đối thủ • attract: làm say mê • taunt: khiêu khích 3 lượt
//       steal: lấy đồ đối thủ đang cầm (khi mình không cầm gì) • knockOff: hất văng đồ đối thủ đang cầm
//       weatherAccuracy: độ chính xác theo thời tiết, vd { rain: null } luôn trúng khi mưa (Thunder, Hurricane, Blizzard)
//       fixedDamage: sát thương cố định (số HP, hoặc 'level' = bằng cấp người dùng), không tính chỉ số / hệ / chí mạng
//       bind: trói đối thủ 4-5 lượt (không rút về / chạy trốn được trừ hệ Ma, cuối lượt mất 1/8 HP; hết sớm khi người trói rời sân)
//       freesBind: người dùng thoát khỏi bị trói (Rapid Spin)
//       rampage: cuồng nộ 2-3 lượt, bị khoá vào chiêu (chỉ lượt đầu tốn PP), hết thì bị rối loạn vì mệt (Own Tempo thì không)
//       crash: trượt hoặc không có tác dụng thì người dùng mất tỉ lệ này HP tối đa (High Jump Kick: 1/2; Magic Guard chặn)
//       weightPower: sức mạnh theo cân nặng bên đỡ (Low Kick: dưới 10kg 20 ... từ 200kg 120), power ghi null
//       rest: hồi đầy HP, chữa trạng thái xấu rồi ngủ đúng 2 lượt (đầy máu hoặc có Insomnia / Vital Spirit thì thất bại)
//       transform: biến hình thành đối thủ (battle/transform.js)
const C = { contact: true };
const LIST = [
  ['tackle', 'Tackle', 'normal', 'physical', 40, 100, 35, C],
  ['scratch', 'Scratch', 'normal', 'physical', 40, 100, 35, C],
  ['quickAttack', 'Quick Attack', 'normal', 'physical', 40, 100, 30, { ...C, priority: 1 }],
  ['hyperFang', 'Hyper Fang', 'normal', 'physical', 80, 90, 15, { ...C, flinch: 10 }],
  ['wrap', 'Wrap', 'normal', 'physical', 15, 90, 20, { ...C, bind: true }],
  ['ember', 'Ember', 'fire', 'special', 40, 100, 25, { status: ['brn', 10] }],
  ['fireFang', 'Fire Fang', 'fire', 'physical', 65, 95, 15, { ...C, status: ['brn', 10], flinch: 10 }],
  ['flameWheel', 'Flame Wheel', 'fire', 'physical', 60, 100, 25, { ...C, status: ['brn', 10] }],
  ['waterGun', 'Water Gun', 'water', 'special', 40, 100, 25],
  ['waterPulse', 'Water Pulse', 'water', 'special', 60, 100, 20, { confuse: 20 }],
  ['bubbleBeam', 'Bubble Beam', 'water', 'special', 65, 100, 20, { stages: { speed: -1 }, chance: 10 }],
  ['absorb', 'Absorb', 'grass', 'special', 20, 100, 25, { drain: 0.5 }],
  ['megaDrain', 'Mega Drain', 'grass', 'special', 40, 100, 15, { drain: 0.5 }],
  ['vineWhip', 'Vine Whip', 'grass', 'physical', 45, 100, 25, C],
  ['razorLeaf', 'Razor Leaf', 'grass', 'physical', 55, 95, 25, { highCrit: true }],
  ['thunderShock', 'Thunder Shock', 'electric', 'special', 40, 100, 30, { status: ['par', 10] }],
  ['spark', 'Spark', 'electric', 'physical', 65, 100, 20, { ...C, status: ['par', 30] }],
  ['gust', 'Gust', 'flying', 'special', 40, 100, 35],
  ['wingAttack', 'Wing Attack', 'flying', 'physical', 60, 100, 35, C],
  ['poisonSting', 'Poison Sting', 'poison', 'physical', 15, 100, 35, { status: ['psn', 30] }],
  ['acid', 'Acid', 'poison', 'special', 40, 100, 30, { stages: { spDef: -1 }, chance: 10 }],
  ['smog', 'Smog', 'poison', 'special', 30, 70, 20, { status: ['psn', 40] }],
  ['sludge', 'Sludge', 'poison', 'special', 65, 100, 20, { status: ['psn', 30] }],
  ['bite', 'Bite', 'dark', 'physical', 60, 100, 25, { ...C, flinch: 30 }],
  // Chiêu mạnh hơn, học sau khi tiến hoá
  ['slash', 'Slash', 'normal', 'physical', 70, 100, 20, { ...C, highCrit: true }],
  ['bodySlam', 'Body Slam', 'normal', 'physical', 85, 100, 15, { ...C, status: ['par', 30] }],
  ['flamethrower', 'Flamethrower', 'fire', 'special', 90, 100, 15, { status: ['brn', 10] }],
  ['surf', 'Surf', 'water', 'special', 90, 100, 15],
  ['gigaDrain', 'Giga Drain', 'grass', 'special', 75, 100, 10, { drain: 0.5 }],
  ['energyBall', 'Energy Ball', 'grass', 'special', 90, 100, 10, { stages: { spDef: -1 }, chance: 10 }],
  ['thunderbolt', 'Thunderbolt', 'electric', 'special', 90, 100, 15, { status: ['par', 10] }],
  ['airSlash', 'Air Slash', 'flying', 'special', 75, 95, 15, { flinch: 30 }],
  ['sludgeBomb', 'Sludge Bomb', 'poison', 'special', 90, 100, 10, { status: ['psn', 30] }],
  ['crunch', 'Crunch', 'dark', 'physical', 80, 100, 15, { ...C, stages: { def: -1 }, chance: 20 }],
  ['brickBreak', 'Brick Break', 'fighting', 'physical', 75, 100, 15, { ...C, breaksScreens: true }],
  // Pokémon dưới nước
  ['hornAttack', 'Horn Attack', 'normal', 'physical', 65, 100, 25, C],
  ['confusion', 'Confusion', 'psychic', 'special', 50, 100, 25, { confuse: 10 }],
  ['waterfall', 'Waterfall', 'water', 'physical', 80, 100, 15, { ...C, flinch: 20 }],
  // Pokémon trong hang
  ['leechLife', 'Leech Life', 'bug', 'physical', 80, 100, 10, { ...C, drain: 0.5 }], // số liệu từ Gen 7
  ['astonish', 'Astonish', 'ghost', 'physical', 30, 100, 15, { ...C, flinch: 30 }],
  ['rockThrow', 'Rock Throw', 'rock', 'physical', 50, 90, 15],
  ['rockSlide', 'Rock Slide', 'rock', 'physical', 75, 90, 10, { flinch: 30 }],
  ['mudSlap', 'Mud-Slap', 'ground', 'special', 20, 100, 10, { stages: { accuracy: -1 }, chance: 100 }],
  // Pokémon ở các gym 2-4
  ['swift', 'Swift', 'normal', 'special', 60, null, 20],
  // Đòn đánh kèm tăng chỉ số của chính mình
  ['metalClaw', 'Metal Claw', 'steel', 'physical', 50, 95, 35, { ...C, stages: { atk: 1 }, self: true, chance: 10 }],
  ['ancientPower', 'Ancient Power', 'rock', 'special', 60, 100, 5, { stages: { atk: 1, def: 1, spAtk: 1, spDef: 1, speed: 1 }, self: true, chance: 10 }],
  ['rapidSpin', 'Rapid Spin', 'normal', 'physical', 50, 100, 40, { ...C, stages: { speed: 1 }, self: true, freesBind: true }],
  ['psybeam', 'Psybeam', 'psychic', 'special', 65, 100, 20, { confuse: 10 }],
  ['flashCannon', 'Flash Cannon', 'steel', 'special', 80, 100, 10, { stages: { spDef: -1 }, chance: 10 }],
  // Gym 5-8: Lửa, Đá, Siêu linh, Băng
  ['fireBlast', 'Fire Blast', 'fire', 'special', 110, 85, 5, { status: ['brn', 10] }],
  ['stomp', 'Stomp', 'normal', 'physical', 65, 100, 20, { ...C, flinch: 30 }],
  ['headbutt', 'Headbutt', 'normal', 'physical', 70, 100, 15, { ...C, flinch: 30 }],
  ['earthquake', 'Earthquake', 'ground', 'physical', 100, 100, 10],
  ['psychic', 'Psychic', 'psychic', 'special', 90, 100, 10, { stages: { spDef: -1 }, chance: 10 }],
  ['powderSnow', 'Powder Snow', 'ice', 'special', 40, 100, 25, { status: ['frz', 10] }],
  ['auroraBeam', 'Aurora Beam', 'ice', 'special', 65, 100, 20, { stages: { atk: -1 }, chance: 10 }],
  ['iceBeam', 'Ice Beam', 'ice', 'special', 90, 100, 10, { status: ['frz', 10] }],
  ['iceShard', 'Ice Shard', 'ice', 'physical', 40, 100, 30, { priority: 1 }],
  // Liên minh: Ma, Giác đấu, Rồng, Độc
  ['lick', 'Lick', 'ghost', 'physical', 30, 100, 30, { ...C, status: ['par', 30] }],
  ['shadowPunch', 'Shadow Punch', 'ghost', 'physical', 60, null, 20, { ...C, punch: true }],
  ['shadowBall', 'Shadow Ball', 'ghost', 'special', 80, 100, 15, { stages: { spDef: -1 }, chance: 20 }],
  ['lowKick', 'Low Kick', 'fighting', 'physical', null, 100, 20, { ...C, weightPower: true }],
  ['karateChop', 'Karate Chop', 'fighting', 'physical', 50, 100, 25, { ...C, highCrit: true }],
  ['machPunch', 'Mach Punch', 'fighting', 'physical', 40, 100, 30, { ...C, punch: true, priority: 1 }],
  ['crossChop', 'Cross Chop', 'fighting', 'physical', 100, 80, 5, { ...C, highCrit: true }],
  ['highJumpKick', 'High Jump Kick', 'fighting', 'physical', 130, 90, 10, { ...C, crash: 0.5 }],
  ['firePunch', 'Fire Punch', 'fire', 'physical', 75, 100, 15, { ...C, punch: true, status: ['brn', 10] }],
  ['icePunch', 'Ice Punch', 'ice', 'physical', 75, 100, 15, { ...C, punch: true, status: ['frz', 10] }],
  ['thunderPunch', 'Thunder Punch', 'electric', 'physical', 75, 100, 15, { ...C, punch: true, status: ['par', 10] }],
  ['twister', 'Twister', 'dragon', 'special', 40, 100, 20, { flinch: 20 }],
  ['dragonBreath', 'Dragon Breath', 'dragon', 'special', 60, 100, 20, { status: ['par', 30] }],
  ['dragonClaw', 'Dragon Claw', 'dragon', 'physical', 80, 100, 15, C],
  ['dragonPulse', 'Dragon Pulse', 'dragon', 'special', 85, 100, 10],
  ['outrage', 'Outrage', 'dragon', 'physical', 120, 100, 10, { ...C, rampage: true }],
  ['poisonJab', 'Poison Jab', 'poison', 'physical', 80, 100, 20, { ...C, status: ['psn', 30] }],
  ['stoneEdge', 'Stone Edge', 'rock', 'physical', 100, 80, 5, { highCrit: true }],
  ['doubleEdge', 'Double-Edge', 'normal', 'physical', 120, 100, 15, { ...C, recoil: 1 / 3 }],
  // Chiêu đánh nhiều lần
  ['doubleSlap', 'Double Slap', 'normal', 'physical', 15, 85, 10, { ...C, hits: [2, 5] }],
  ['cometPunch', 'Comet Punch', 'normal', 'physical', 18, 85, 15, { ...C, punch: true, hits: [2, 5] }],
  ['furyAttack', 'Fury Attack', 'normal', 'physical', 15, 85, 20, { ...C, hits: [2, 5] }],
  ['furySwipes', 'Fury Swipes', 'normal', 'physical', 18, 80, 15, { ...C, hits: [2, 5] }],
  ['spikeCannon', 'Spike Cannon', 'normal', 'physical', 20, 100, 15, { hits: [2, 5] }],
  ['barrage', 'Barrage', 'normal', 'physical', 15, 85, 20, { hits: [2, 5] }],
  ['pinMissile', 'Pin Missile', 'bug', 'physical', 25, 95, 20, { hits: [2, 5] }],
  ['icicleSpear', 'Icicle Spear', 'ice', 'physical', 25, 100, 30, { hits: [2, 5] }],
  ['rockBlast', 'Rock Blast', 'rock', 'physical', 25, 90, 10, { hits: [2, 5] }],
  ['doubleKick', 'Double Kick', 'fighting', 'physical', 30, 100, 30, { ...C, hits: 2 }],
  ['bonemerang', 'Bonemerang', 'ground', 'physical', 50, 90, 10, { hits: 2 }],
  // Tự nổ: người dùng gục dù đánh trúng hay trượt
  ['selfDestruct', 'Self-Destruct', 'normal', 'physical', 200, 100, 5, { explode: true }],
  ['explosion', 'Explosion', 'normal', 'physical', 250, 100, 5, { explode: true }],
  // Lấy / hất đồ đang cầm
  ['thief', 'Thief', 'dark', 'physical', 60, 100, 25, { ...C, steal: true }],
  ['covet', 'Covet', 'normal', 'physical', 60, 100, 25, { ...C, steal: true }],
  ['knockOff', 'Knock Off', 'dark', 'physical', 65, 100, 20, { ...C, knockOff: true }],
  // Chiêu gây sát thương trong bộ chiêu gốc (src/data/learnsets.json), số liệu theo Gen 9.
  // Chiêu cần cơ chế game chưa có (nạp lượt, bay lên / đào đất, đòn phản lại...) chưa thêm
  ['pound', 'Pound', 'normal', 'physical', 40, 100, 35, C],
  ['doubleHit', 'Double Hit', 'normal', 'physical', 35, 90, 10, { ...C, hits: 2 }],
  ['slam', 'Slam', 'normal', 'physical', 80, 75, 20, C],
  ['megaPunch', 'Mega Punch', 'normal', 'physical', 80, 85, 20, { ...C, punch: true }],
  ['megaKick', 'Mega Kick', 'normal', 'physical', 120, 75, 5, C],
  ['takeDown', 'Take Down', 'normal', 'physical', 90, 85, 20, { ...C, recoil: 1 / 4 }],
  ['extremeSpeed', 'Extreme Speed', 'normal', 'physical', 80, 100, 5, { ...C, priority: 2 }],
  ['peck', 'Peck', 'flying', 'physical', 35, 100, 35, C],
  ['airCutter', 'Air Cutter', 'flying', 'special', 60, 95, 25, { highCrit: true }],
  ['hurricane', 'Hurricane', 'flying', 'special', 110, 70, 10, { confuse: 30, weatherAccuracy: { rain: null, sun: 50 } }],
  ['petalBlizzard', 'Petal Blizzard', 'grass', 'physical', 90, 100, 15],
  ['heatWave', 'Heat Wave', 'fire', 'special', 95, 90, 10, { status: ['brn', 10] }],
  ['hydroPump', 'Hydro Pump', 'water', 'special', 110, 80, 5],
  ['thunder', 'Thunder', 'electric', 'special', 110, 70, 10, { status: ['par', 30], weatherAccuracy: { rain: null, sun: 50 } }],
  ['zapCannon', 'Zap Cannon', 'electric', 'special', 120, 50, 5, { status: ['par', 100] }],
  ['icyWind', 'Icy Wind', 'ice', 'special', 55, 95, 15, { stages: { speed: -1 }, chance: 100 }],
  ['blizzard', 'Blizzard', 'ice', 'special', 110, 70, 5, { status: ['frz', 10], weatherAccuracy: { hail: null } }],
  ['vitalThrow', 'Vital Throw', 'fighting', 'physical', 70, null, 10, { ...C, priority: -1 }],
  ['drainPunch', 'Drain Punch', 'fighting', 'physical', 75, 100, 10, { ...C, punch: true, drain: 0.5 }],
  ['dynamicPunch', 'Dynamic Punch', 'fighting', 'physical', 100, 50, 5, { ...C, punch: true, confuse: 100 }],
  ['powerGem', 'Power Gem', 'rock', 'special', 80, 100, 20],
  ['smartStrike', 'Smart Strike', 'steel', 'physical', 70, null, 10, C],
  ['ironTail', 'Iron Tail', 'steel', 'physical', 100, 75, 15, { ...C, stages: { def: -1 }, chance: 30 }],
  ['megahorn', 'Megahorn', 'bug', 'physical', 120, 85, 10, C],
  // Chiêu trong bộ chiêu FireRed/LeafGreen đã bị bỏ ở game mới: số liệu theo lần cuối có mặt (Gen 7)
  ['bubble', 'Bubble', 'water', 'special', 40, 100, 30, { stages: { speed: -1 }, chance: 10 }],
  ['constrict', 'Constrict', 'normal', 'physical', 10, 100, 35, { ...C, stages: { speed: -1 }, chance: 10 }],
  ['feintAttack', 'Feint Attack', 'dark', 'physical', 60, null, 20, C],
  ['rollingKick', 'Rolling Kick', 'fighting', 'physical', 60, 85, 15, { ...C, flinch: 30 }],
  ['submission', 'Submission', 'fighting', 'physical', 80, 80, 20, { ...C, recoil: 1 / 4 }],
  ['signalBeam', 'Signal Beam', 'bug', 'special', 75, 100, 15, { confuse: 10 }],
  // Đánh trúng cả Pokémon đang bay (Fly / Bounce): game chưa có chiêu bay lên nên chỉ là đòn đấm thường
  ['skyUppercut', 'Sky Uppercut', 'fighting', 'physical', 85, 90, 15, { ...C, punch: true }],
  // Sát thương cố định: vẫn không có tác dụng với hệ miễn nhiễm (Sonic Boom / Seismic Toss vào hệ Ma, Night Shade vào hệ Thường)
  ['sonicBoom', 'Sonic Boom', 'normal', 'special', null, 90, 20, { fixedDamage: 20 }],
  ['dragonRage', 'Dragon Rage', 'dragon', 'special', null, 100, 10, { fixedDamage: 40 }],
  ['seismicToss', 'Seismic Toss', 'fighting', 'physical', null, 100, 20, { ...C, fixedDamage: 'level' }],
  ['nightShade', 'Night Shade', 'ghost', 'special', null, 100, 15, { fixedDamage: 'level' }],
  // Chiêu trạng thái
  ['growl', 'Growl', 'normal', 'status', 0, 100, 40, { stages: { atk: -1 }, sound: true }],
  ['tailWhip', 'Tail Whip', 'normal', 'status', 0, 100, 30, { stages: { def: -1 } }],
  ['leer', 'Leer', 'normal', 'status', 0, 100, 30, { stages: { def: -1 } }],
  ['smokescreen', 'Smokescreen', 'normal', 'status', 0, 100, 20, { stages: { accuracy: -1 } }],
  ['sandAttack', 'Sand Attack', 'ground', 'status', 0, 100, 15, { stages: { accuracy: -1 } }],
  ['withdraw', 'Withdraw', 'water', 'status', 0, null, 40, { stages: { def: 1 }, self: true }],
  ['defenseCurl', 'Defense Curl', 'normal', 'status', 0, null, 40, { stages: { def: 1 }, self: true }],
  ['harden', 'Harden', 'normal', 'status', 0, null, 30, { stages: { def: 1 }, self: true }],
  ['calmMind', 'Calm Mind', 'psychic', 'status', 0, null, 20, { stages: { spAtk: 1, spDef: 1 }, self: true }],
  ['willOWisp', 'Will-O-Wisp', 'fire', 'status', 0, 85, 15, { status: ['brn', 100] }],
  ['bulkUp', 'Bulk Up', 'fighting', 'status', 0, null, 20, { stages: { atk: 1, def: 1 }, self: true }],
  ['dragonDance', 'Dragon Dance', 'dragon', 'status', 0, null, 20, { stages: { atk: 1, speed: 1 }, self: true }],
  ['amnesia', 'Amnesia', 'psychic', 'status', 0, null, 20, { stages: { spDef: 2 }, self: true }],
  ['thunderWave', 'Thunder Wave', 'electric', 'status', 0, 90, 20, { status: ['par', 100] }],
  ['poisonPowder', 'Poison Powder', 'poison', 'status', 0, 75, 35, { status: ['psn', 100], powder: true }],
  ['poisonGas', 'Poison Gas', 'poison', 'status', 0, 90, 40, { status: ['psn', 100] }],
  ['stunSpore', 'Stun Spore', 'grass', 'status', 0, 75, 30, { status: ['par', 100], powder: true }],
  ['sleepPowder', 'Sleep Powder', 'grass', 'status', 0, 75, 15, { status: ['slp', 100], powder: true }],
  ['hypnosis', 'Hypnosis', 'psychic', 'status', 0, 60, 20, { status: ['slp', 100] }],
  ['splash', 'Splash', 'normal', 'status', 0, null, 40, { self: true }], // nhảy lách tách, chẳng có gì xảy ra
  ['rest', 'Rest', 'psychic', 'status', 0, null, 5, { self: true, rest: true }],
  ['sunnyDay', 'Sunny Day', 'fire', 'status', 0, null, 5, { weather: 'sun' }],
  ['rainDance', 'Rain Dance', 'water', 'status', 0, null, 5, { weather: 'rain' }],
  ['sandstorm', 'Sandstorm', 'rock', 'status', 0, null, 10, { weather: 'sand' }],
  ['hail', 'Hail', 'ice', 'status', 0, null, 10, { weather: 'hail' }],
  ['supersonic', 'Supersonic', 'normal', 'status', 0, 55, 20, { confuse: 100, sound: true }],
  ['confuseRay', 'Confuse Ray', 'ghost', 'status', 0, 100, 10, { confuse: 100 }],
  ['attract', 'Attract', 'normal', 'status', 0, 100, 15, { attract: true }],
  ['taunt', 'Taunt', 'dark', 'status', 0, 100, 20, { taunt: true }],
  ['reflect', 'Reflect', 'psychic', 'status', 0, null, 20, { screen: 'reflect', self: true }],
  ['lightScreen', 'Light Screen', 'psychic', 'status', 0, null, 30, { screen: 'lightScreen', self: true }],
  // Chiêu trạng thái trong bộ chiêu gốc: tự tăng chỉ số
  ['meditate', 'Meditate', 'psychic', 'status', 0, null, 40, { stages: { atk: 1 }, self: true }],
  ['barrier', 'Barrier', 'psychic', 'status', 0, null, 20, { stages: { def: 2 }, self: true }],
  ['acidArmor', 'Acid Armor', 'poison', 'status', 0, null, 20, { stages: { def: 2 }, self: true }],
  ['agility', 'Agility', 'psychic', 'status', 0, null, 30, { stages: { speed: 2 }, self: true }],
  ['cosmicPower', 'Cosmic Power', 'psychic', 'status', 0, null, 20, { stages: { def: 1, spDef: 1 }, self: true }],
  ['doubleTeam', 'Double Team', 'normal', 'status', 0, null, 15, { stages: { evasion: 1 }, self: true }],
  // Giảm chỉ số đối thủ
  ['featherDance', 'Feather Dance', 'flying', 'status', 0, 100, 15, { stages: { atk: -2 } }],
  ['screech', 'Screech', 'normal', 'status', 0, 85, 40, { stages: { def: -2 }, sound: true }],
  ['scaryFace', 'Scary Face', 'normal', 'status', 0, 100, 10, { stages: { speed: -2 } }],
  ['fakeTears', 'Fake Tears', 'dark', 'status', 0, 100, 20, { stages: { spDef: -2 } }],
  ['metalSound', 'Metal Sound', 'steel', 'status', 0, 85, 40, { stages: { spDef: -2 }, sound: true }],
  ['kinesis', 'Kinesis', 'psychic', 'status', 0, 80, 15, { stages: { accuracy: -1 } }],
  ['sweetScent', 'Sweet Scent', 'normal', 'status', 0, 100, 20, { stages: { evasion: -2 } }],
  // Gây trạng thái / rối loạn
  ['glare', 'Glare', 'normal', 'status', 0, 100, 30, { status: ['par', 100] }],
  ['sing', 'Sing', 'normal', 'status', 0, 55, 15, { status: ['slp', 100], sound: true }],
  ['lovelyKiss', 'Lovely Kiss', 'normal', 'status', 0, 75, 10, { status: ['slp', 100] }],
  ['swagger', 'Swagger', 'normal', 'status', 0, 85, 15, { confuse: 100, stages: { atk: 2 } }], // làm rối loạn và tăng 2 bậc Atk của đối thủ
  // Biến hình (Ditto, Mew): chép loài, hệ, chỉ số (trừ HP), bậc chỉ số, đặc tính và chiêu (mỗi chiêu 5 PP) của đối thủ tới khi rời sân
  ['transform', 'Transform', 'normal', 'status', 0, null, 10, { transform: true }],
];

export const MOVES = Object.fromEntries(
  LIST.map(([id, name, type, category, power, accuracy, pp, extra = {}]) => [
    id,
    { id, name, type, category, power, accuracy, pp, priority: 0, ...extra },
  ]),
);

// Dùng khi mọi chiêu đều hết PP: không bao giờ trượt, không theo hệ nào, mất 1/4 HP tối đa
export const STRUGGLE = {
  id: 'struggle', name: 'Struggle', type: 'typeless', category: 'physical', power: 50, accuracy: null, pp: 0, priority: 0,
  contact: true, recoil: 0.25,
};

export const CATEGORY_NAMES = { physical: 'Vật lý', special: 'Đặc biệt', status: 'Trạng thái' };
