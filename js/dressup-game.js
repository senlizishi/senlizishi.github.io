(function () {
  'use strict';

  const IS_PORTRAIT = window.innerHeight > window.innerWidth;
  const WIDTH = IS_PORTRAIT ? 540 : 960;
  const HEIGHT = IS_PORTRAIT ? 960 : 540;

  const DOLL_W = 600;
  const DOLL_H = 900;
  const DOLL_FEET = 762;
  const DIR = 'assets/dressup/';
  const TEX_SCALE = 1;

  const LAYOUT = IS_PORTRAIT
    ? {
      trayH: 172,
      tabH: 44,
      tabGap: 6,
      slotW: 96,
      slotH: 100,
      gap: 10,
      dollScale: 0.62,
      dollFeetY: 748,
      dropPad: 40,
      lift: 58,
      pickThreshold: 24,
      arrowR: 20,
    }
    : {
      trayH: 150,
      tabH: 38,
      tabGap: 10,
      slotW: 78,
      slotH: 92,
      gap: 8,
      dollScale: 0.44,
      dollFeetY: 372,
      dropPad: 36,
      lift: 46,
      pickThreshold: 22,
      arrowR: 17,
    };

  const TRAY_TOP = HEIGHT - LAYOUT.trayH;

  // 从里到外的层级：袜子 → 小宠物 → 裤子 → 鞋子 → 裙子/连衣裙 → 上衣 → 腰带
  // → 头发 → 项链 → 围巾 → 耳饰 → 唇 → 脸 → 帽子 → 手上拿的东西
  // 裙摆要盖住鞋口、鞋子要盖住袜子、上衣要盖住裤腰；披风/翅膀/书包穿在身后（backLayer）
  // 某一件想单独调层，在 ITEMS 里给 depth 覆盖它所在部位的默认层即可
  const SLOT_DEPTH = {
    leg: 1.6, pet: 1.7, bottom: 2, shoes: 2.2, skirt: 2.5, top: 3, waist: 3.5,
    hair: 5, neck: 6, scarf: 6.2, ear: 6.5, lip: 6.8, face: 7, hat: 8, hand: 9,
    back: 1,
  };
  const SLOT_BEHIND = { back: true };
  // 连衣裙是一整套：穿上它要把上衣收起来，反过来穿上衣也要把连衣裙收起来
  const PIECE_COVERS = { one: ['top'] };

  function itemCat(def) {
    return def.cat || def.slot;
  }

  const CATEGORIES = [
    { key: 'hat', label: '帽子' },
    { key: 'hair', label: '发型' },
    { key: 'face', label: '脸部' },
    { key: 'top', label: '上衣' },
    { key: 'skirt', label: '裙子' },
    { key: 'bottom', label: '裤子' },
    { key: 'shoes', label: '鞋子' },
    { key: 'accessory', label: '配饰' },
  ];

  // >>> GEN:ITEMS >>>
  const ITEMS = [
    { key: 'hair-long', slot: 'hair', label: '长直发', box: { x: 158, y: 67, w: 284, h: 511 }, hit: [{ x: 220, y: 94, w: 160, h: 214 }, { x: 180, y: 236, w: 76, h: 324 }, { x: 344, y: 236, w: 76, h: 324 }] },
    { key: 'hair-twin', slot: 'hair', label: '双马尾', box: { x: 150, y: 77, w: 300, h: 399 }, hit: [{ x: 220, y: 96, w: 160, h: 216 }, { x: 166, y: 228, w: 72, h: 236 }, { x: 362, y: 228, w: 72, h: 236 }] },
    { key: 'hair-curly', slot: 'hair', label: '公主卷', box: { x: 146, y: 78, w: 308, h: 493 }, hit: [{ x: 220, y: 96, w: 160, h: 212 }, { x: 164, y: 228, w: 84, h: 336 }, { x: 352, y: 228, w: 84, h: 336 }] },
    { key: 'hair-bob', slot: 'hair', label: '波波头', box: { x: 170, y: 70, w: 260, h: 295 }, hit: [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 160 }, { x: 320, y: 200, w: 104, h: 160 }] },
    { key: 'hair-bob-ginger', slot: 'hair', label: '姜糖波波', box: { x: 170, y: 70, w: 260, h: 311 }, hit: [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 160 }, { x: 320, y: 200, w: 104, h: 160 }] },
    { key: 'hair-wavy', slot: 'hair', label: '波浪长发', box: { x: 165, y: 70, w: 270, h: 478 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 200, w: 96, h: 340 }, { x: 336, y: 200, w: 96, h: 340 }] },
    { key: 'hair-wavy-black', slot: 'hair', label: '乌黑波浪', box: { x: 169, y: 66, w: 262, h: 498 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 169, y: 200, w: 95, h: 340 }, { x: 336, y: 200, w: 95, h: 340 }] },
    { key: 'hair-pixie', slot: 'hair', label: '俏皮短发', box: { x: 174, y: 70, w: 252, h: 268 }, hit: [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 138 }, { x: 320, y: 200, w: 104, h: 138 }] },
    { key: 'hair-pixie-blonde', slot: 'hair', label: '金色短发', box: { x: 172, y: 74, w: 256, h: 266 }, hit: [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 140 }, { x: 320, y: 200, w: 104, h: 140 }] },
    { key: 'hair-twin-star', slot: 'hair', label: '星星双马尾', box: { x: 92, y: 70, w: 436, h: 456 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 100, y: 250, w: 108, h: 276 }, { x: 392, y: 250, w: 108, h: 276 }] },
    { key: 'hair-pony', slot: 'hair', label: '高马尾', box: { x: 166, y: 66, w: 308, h: 490 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 166, y: 250, w: 42, h: 290 }, { x: 392, y: 250, w: 82, h: 290 }] },
    { key: 'hair-pony-brown', slot: 'hair', label: '棕色马尾', box: { x: 126, y: 66, w: 308, h: 496 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 126, y: 250, w: 82, h: 290 }, { x: 392, y: 250, w: 42, h: 290 }] },
    { key: 'hair-braid', slot: 'hair', label: '双麻花辫', box: { x: 154, y: 63, w: 292, h: 517 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 270, w: 84, h: 280 }, { x: 348, y: 270, w: 84, h: 280 }] },
    { key: 'hair-braid-plum', slot: 'hair', label: '紫麻花辫', box: { x: 159, y: 66, w: 282, h: 523 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 270, w: 84, h: 280 }, { x: 348, y: 270, w: 84, h: 280 }] },
    { key: 'hair-bun', slot: 'hair', label: '丸子头', box: { x: 164, y: 8, w: 272, h: 338 }, hit: [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 146 }, { x: 320, y: 200, w: 104, h: 146 }] },
    { key: 'hair-bun-silver', slot: 'hair', label: '银灰丸子', box: { x: 166, y: 6, w: 268, h: 347 }, hit: [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 153 }, { x: 320, y: 200, w: 104, h: 153 }] },
    { key: 'hair-spacebun-pink', slot: 'hair', label: '粉色双丸子', box: { x: 154, y: 54, w: 292, h: 289 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 154, y: 250, w: 54, h: 93 }, { x: 392, y: 250, w: 54, h: 93 }] },
    { key: 'hair-spacebun-mint', slot: 'hair', label: '薄荷双丸子', box: { x: 158, y: 52, w: 284, h: 288 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 158, y: 250, w: 50, h: 90 }, { x: 392, y: 250, w: 50, h: 90 }] },
    { key: 'hair-halfup', slot: 'hair', label: '公主半扎发', box: { x: 167, y: 44, w: 266, h: 484 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 200, w: 96, h: 328 }, { x: 336, y: 200, w: 96, h: 328 }] },
    { key: 'hair-curls-honey', slot: 'hair', label: '蜂蜜卷', box: { x: 133, y: 63, w: 334, h: 506 }, hit: [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 200, w: 96, h: 340 }, { x: 336, y: 200, w: 96, h: 340 }] },
    { key: 'hat-straw', slot: 'hat', label: '草帽', box: { x: 148, y: 84, w: 304, h: 124 } },
    { key: 'hat-bucket', slot: 'hat', label: '渔夫帽', box: { x: 158, y: 102, w: 284, h: 124 } },
    { key: 'hat-crown', slot: 'hat', label: '皇冠', box: { x: 208, y: 43, w: 183, h: 147 } },
    { key: 'hat-bow', slot: 'hat', label: '蝴蝶结发箍', box: { x: 180, y: 80, w: 213, h: 109 } },
    { key: 'hat-beanie', slot: 'hat', label: '针织帽', box: { x: 194, y: 7, w: 212, h: 214 } },
    { key: 'hat-beret', slot: 'hat', label: '贝雷帽', box: { x: 172, y: 70, w: 240, h: 150 } },
    { key: 'hat-cap', slot: 'hat', label: '棒球帽', box: { x: 195, y: 69, w: 241, h: 184 } },
    { key: 'hat-visor', slot: 'hat', label: '遮阳空顶帽', box: { x: 192, y: 150, w: 241, h: 100 } },
    { key: 'hat-wizard', slot: 'hat', label: '巫师帽', box: { x: 163, y: 2, w: 274, h: 229 } },
    { key: 'hat-party', slot: 'hat', label: '派对帽', box: { x: 223, y: 24, w: 154, h: 185 } },
    { key: 'hat-cat', slot: 'hat', label: '猫耳发箍', box: { x: 181, y: 60, w: 238, h: 157 } },
    { key: 'hat-bunny', slot: 'hat', label: '兔耳发箍', box: { x: 187, y: -7, w: 226, h: 222 } },
    { key: 'hat-santa', slot: 'hat', label: '圣诞帽', box: { x: 191, y: 71, w: 281, h: 145 } },
    { key: 'hat-flower', slot: 'hat', label: '花朵发箍', box: { x: 190, y: 80, w: 220, h: 128 } },
    { key: 'hat-pirate', slot: 'hat', label: '海盗帽', box: { x: 175, y: 87, w: 250, h: 133 } },
    { key: 'hat-chef', slot: 'hat', label: '厨师帽', box: { x: 187, y: 25, w: 226, h: 184 } },
    { key: 'hat-cowboy', slot: 'hat', label: '牛仔帽', box: { x: 143, y: 84, w: 314, h: 153 } },
    { key: 'hat-tiara', slot: 'hat', label: '小皇冠', box: { x: 215, y: 87, w: 170, h: 114 } },
    { key: 'hat-lace-band', slot: 'hat', label: '蕾丝发带', box: { x: 181, y: 87, w: 238, h: 132 } },
    { key: 'hat-veil', slot: 'hat', label: '新娘头纱', box: { x: 176, y: 116, w: 248, h: 306 } },
    { key: 'eyes-star', slot: 'face', label: '星星眼', box: { x: 233, y: 172, w: 132, h: 89 } },
    { key: 'eyes-heart', slot: 'face', label: '爱心眼', box: { x: 220, y: 164, w: 158, h: 102 } },
    { key: 'glasses-round', slot: 'face', label: '圆框眼镜', box: { x: 180, y: 164, w: 237, h: 112 } },
    { key: 'glasses-heart', slot: 'face', label: '爱心眼镜', box: { x: 177, y: 149, w: 242, h: 117 } },
    { key: 'eyes-round', slot: 'face', label: '圆亮大眼', box: { x: 233, y: 181, w: 134, h: 82 } },
    { key: 'eyes-blue', slot: 'face', label: '蓝色大眼', box: { x: 233, y: 181, w: 134, h: 82 } },
    { key: 'eyes-green', slot: 'face', label: '绿色大眼', box: { x: 233, y: 181, w: 134, h: 82 } },
    { key: 'eyes-closed', slot: 'face', label: '弯弯笑眼', box: { x: 230, y: 178, w: 140, h: 88 } },
    { key: 'eyes-wink', slot: 'face', label: '俏皮眨眼', box: { x: 233, y: 181, w: 134, h: 82 } },
    { key: 'eyes-lashes', slot: 'face', label: '长睫毛', box: { x: 225, y: 163, w: 148, h: 105 } },
    { key: 'glasses-cat', slot: 'face', label: '猫眼墨镜', box: { x: 201, y: 171, w: 198, h: 98 } },
    { key: 'glasses-star', slot: 'face', label: '星星墨镜', box: { x: 197, y: 173, w: 206, h: 93 } },
    { key: 'glasses-oval', slot: 'face', label: '金丝眼镜', box: { x: 195, y: 180, w: 210, h: 84 } },
    { key: 'glasses-mask', slot: 'face', label: '舞会面具', box: { x: 197, y: 158, w: 206, h: 120 } },
    { key: 'lips-pink', slot: 'lip', cat: 'face', label: '粉粉唇', box: { x: 258, y: 230, w: 84, h: 64 } },
    { key: 'lips-red', slot: 'lip', cat: 'face', label: '红唇', box: { x: 258, y: 230, w: 84, h: 66 } },
    { key: 'lips-gloss', slot: 'lip', cat: 'face', label: '闪亮唇彩', box: { x: 260, y: 232, w: 80, h: 60 } },
    { key: 'cheek-blush', slot: 'lip', cat: 'face', label: '红脸蛋', box: { x: 214, y: 223, w: 172, h: 54 } },
    { key: 'cheek-freckles', slot: 'lip', cat: 'face', label: '小雀斑', box: { x: 219, y: 225, w: 162, h: 49 } },
    { key: 'top-tee', slot: 'top', label: 'T恤', box: { x: 99, y: 205, w: 374, h: 344 } },
    { key: 'top-stripe', slot: 'top', label: '条纹衫', box: { x: 40, y: 164, w: 530, h: 480 } },
    { key: 'top-hoodie', slot: 'top', label: '连帽卫衣', box: { x: 96, y: 176, w: 400, h: 376 } },
    { key: 'top-tank', slot: 'top', label: '小背心', box: { x: 134, y: 201, w: 331, h: 427 } },
    { key: 'top-blouse', slot: 'top', label: '泡泡袖衬衫', box: { x: 37, y: 147, w: 483, h: 442 } },
    { key: 'top-sailor', slot: 'top', label: '水手服', box: { x: 74, y: 180, w: 418, h: 394 } },
    { key: 'top-plaid', slot: 'top', label: '格子衬衫', box: { x: 72, y: 179, w: 421, h: 506 } },
    { key: 'top-sweater', slot: 'top', label: '针织毛衣', box: { x: 71, y: 177, w: 423, h: 510 } },
    { key: 'top-turtle', slot: 'top', label: '高领毛衣', box: { x: 69, y: 176, w: 427, h: 512 } },
    { key: 'top-puffer', slot: 'top', label: '羽绒服', box: { x: 24, y: 134, w: 509, h: 468 } },
    { key: 'top-denim', slot: 'top', label: '牛仔外套', box: { x: 58, y: 165, w: 449, h: 534 } },
    { key: 'top-lace', slot: 'top', label: '蕾丝上衣', box: { x: 67, y: 173, w: 432, h: 408 } },
    { key: 'top-dot', slot: 'top', label: '波点衫', box: { x: 85, y: 191, w: 396, h: 372 } },
    { key: 'top-heart', slot: 'top', label: '爱心衫', box: { x: 82, y: 188, w: 402, h: 378 } },
    { key: 'top-kimono', slot: 'top', label: '和服上衣', box: { x: 40, y: 149, w: 477, h: 438 } },
    { key: 'top-sport', slot: 'top', label: '运动衫', box: { x: 71, y: 177, w: 424, h: 400 } },
    { key: 'top-rainbow', slot: 'top', label: '彩虹衫', box: { x: 85, y: 191, w: 396, h: 372 } },
    { key: 'scarf-knit', slot: 'scarf', cat: 'top', label: '针织围巾', box: { x: 233, y: 266, w: 148, h: 133 } },
    { key: 'scarf-silk', slot: 'scarf', cat: 'top', label: '小丝巾', box: { x: 240, y: 272, w: 120, h: 117 } },
    { key: 'scarf-collar', slot: 'scarf', cat: 'top', label: '毛领', box: { x: 209, y: 279, w: 182, h: 90 } },
    { key: 'bottom-skirt', slot: 'skirt', label: '短裙', box: { x: 177, y: 437, w: 246, h: 175 } },
    { key: 'dress-princess', slot: 'skirt', label: '公主裙', box: { x: 176, y: 422, w: 248, h: 255 } },
    { key: 'dress-tutu', slot: 'skirt', label: '芭蕾蓬蓬裙', box: { x: 198, y: 425, w: 204, h: 243 } },
    { key: 'skirt-pleated', slot: 'skirt', label: '百褶裙', box: { x: 148, y: 425, w: 304, h: 214 } },
    { key: 'skirt-denim', slot: 'skirt', label: '牛仔裙', box: { x: 175, y: 438, w: 250, h: 173 } },
    { key: 'skirt-layered', slot: 'skirt', label: '蛋糕裙', box: { x: 167, y: 443, w: 266, h: 192 } },
    { key: 'skirt-long', slot: 'skirt', label: '长裙', box: { x: 160, y: 445, w: 280, h: 256 } },
    { key: 'dress-sundress', slot: 'skirt', piece: 'one', label: '吊带连衣裙', box: { x: 118, y: 225, w: 330, h: 418 } },
    { key: 'dress-mermaid', slot: 'skirt', piece: 'one', label: '美人鱼裙', box: { x: 72, y: 178, w: 422, h: 518 } },
    { key: 'dress-pinafore', slot: 'skirt', depth: 3.2, label: '背带裙', box: { x: 166, y: 384, w: 268, h: 235 } },
    { key: 'dress-party', slot: 'skirt', piece: 'one', label: '亮片礼服', box: { x: 42, y: 151, w: 473, h: 532 } },
    { key: 'dress-lace', slot: 'skirt', piece: 'one', label: '蕾丝长裙', box: { x: 56, y: 162, w: 454, h: 560 } },
    { key: 'dress-rainbow', slot: 'skirt', piece: 'one', label: '彩虹裙', box: { x: 77, y: 183, w: 412, h: 451 } },
    { key: 'skirt-tulip', slot: 'skirt', label: '郁金香裙', box: { x: 225, y: 438, w: 150, h: 164 } },
    { key: 'dress-flower', slot: 'skirt', piece: 'one', label: '碎花裙', box: { x: 42, y: 151, w: 473, h: 470 } },
    { key: 'dress-snow', slot: 'skirt', piece: 'one', label: '冰雪裙', box: { x: 68, y: 174, w: 429, h: 525 } },
    { key: 'skirt-star', slot: 'skirt', label: '星星纱裙', box: { x: 158, y: 445, w: 284, h: 189 } },
    { key: 'belt-bow', slot: 'waist', cat: 'skirt', label: '蝴蝶结腰带', box: { x: 219, y: 429, w: 162, h: 82 } },
    { key: 'belt-gold', slot: 'waist', cat: 'skirt', label: '金腰带', box: { x: 219, y: 428, w: 162, h: 85 } },
    { key: 'belt-flower', slot: 'waist', cat: 'skirt', label: '花朵腰带', box: { x: 226, y: 453, w: 148, h: 57 } },
    { key: 'bottom-shorts', slot: 'bottom', label: '短裤', box: { x: 211, y: 445, w: 178, h: 148 } },
    { key: 'bottom-pants', slot: 'bottom', label: '长裤', box: { x: 124, y: 376, w: 323, h: 448 } },
    { key: 'bottom-jeans', slot: 'bottom', label: '牛仔裤', box: { x: 101, y: 348, w: 334, h: 514 } },
    { key: 'bottom-leggings', slot: 'bottom', label: '打底裤', box: { x: 136, y: 384, w: 276, h: 450 } },
    { key: 'bottom-cargo', slot: 'bottom', label: '工装裤', box: { x: 100, y: 347, w: 336, h: 516 } },
    { key: 'bottom-overall', slot: 'bottom', depth: 3.2, label: '背带裤', box: { x: 105, y: 352, w: 326, h: 506 } },
    { key: 'bottom-capri', slot: 'bottom', label: '七分裤', box: { x: 77, y: 321, w: 384, h: 528 } },
    { key: 'bottom-flare', slot: 'bottom', label: '喇叭裤', box: { x: 179, y: 442, w: 239, h: 293 } },
    { key: 'bottom-jogger', slot: 'bottom', label: '运动裤', box: { x: 98, y: 346, w: 340, h: 526 } },
    { key: 'bottom-bloomer', slot: 'bottom', label: '灯笼裤', box: { x: 217, y: 451, w: 166, h: 204 } },
    { key: 'bottom-pj', slot: 'bottom', label: '睡裤', box: { x: 65, y: 312, w: 406, h: 586 } },
    { key: 'bottom-snow', slot: 'bottom', label: '雪地裤', box: { x: 81, y: 329, w: 372, h: 560 } },
    { key: 'bottom-sweat', slot: 'bottom', label: '卫裤', box: { x: 99, y: 346, w: 338, h: 518 } },
    { key: 'bottom-plaid', slot: 'bottom', label: '格子裤', box: { x: 38, y: 285, w: 460, h: 640 } },
    { key: 'bottom-shorts-sport', slot: 'bottom', label: '运动短裤', box: { x: 106, y: 344, w: 332, h: 418 } },
    { key: 'bottom-shorts-lace', slot: 'bottom', label: '蕾丝短裤', box: { x: 105, y: 343, w: 334, h: 416 } },
    { key: 'bottom-culottes', slot: 'bottom', label: '阔腿裤', box: { x: 198, y: 442, w: 201, h: 267 } },
    { key: 'bottom-heart', slot: 'bottom', label: '爱心裤', box: { x: 110, y: 357, w: 316, h: 496 } },
    { key: 'bottom-shorts-denim', slot: 'bottom', label: '牛仔短裤', box: { x: 112, y: 349, w: 321, h: 398 } },
    { key: 'bottom-pants-star', slot: 'bottom', label: '星星长裤', box: { x: 110, y: 357, w: 316, h: 496 } },
    { key: 'shoes-sneaker', slot: 'shoes', label: '运动鞋', box: { x: 203, y: 673, w: 186, h: 104 } },
    { key: 'shoes-sandal', slot: 'shoes', label: '凉鞋', box: { x: 211, y: 699, w: 173, h: 66 } },
    { key: 'shoes-mary', slot: 'shoes', label: '玛丽珍鞋', box: { x: 201, y: 675, w: 196, h: 100 } },
    { key: 'shoes-boot', slot: 'shoes', label: '小皮靴', box: { x: 205, y: 613, w: 188, h: 160 } },
    { key: 'shoes-rain', slot: 'shoes', label: '雨靴', box: { x: 212, y: 634, w: 176, h: 136 } },
    { key: 'shoes-ballet', slot: 'shoes', label: '芭蕾舞鞋', box: { x: 205, y: 682, w: 189, h: 91 } },
    { key: 'shoes-slipper', slot: 'shoes', label: '小兔拖鞋', box: { x: 210, y: 654, w: 179, h: 115 } },
    { key: 'shoes-jelly', slot: 'shoes', label: '果冻凉鞋', box: { x: 209, y: 691, w: 182, h: 82 } },
    { key: 'shoes-glass', slot: 'shoes', label: '水晶鞋', box: { x: 219, y: 692, w: 166, h: 67 } },
    { key: 'shoes-cowboy', slot: 'shoes', label: '牛仔靴', box: { x: 208, y: 622, w: 186, h: 147 } },
    { key: 'shoes-snow', slot: 'shoes', label: '雪地靴', box: { x: 201, y: 633, w: 196, h: 142 } },
    { key: 'shoes-flip', slot: 'shoes', label: '人字拖', box: { x: 213, y: 697, w: 172, h: 74 } },
    { key: 'shoes-sport', slot: 'shoes', label: '跑鞋', box: { x: 195, y: 671, w: 208, h: 109 } },
    { key: 'shoes-platform', slot: 'shoes', label: '厚底鞋', box: { x: 208, y: 683, w: 180, h: 96 } },
    { key: 'shoes-ice', slot: 'shoes', label: '滑冰鞋', box: { x: 194, y: 608, w: 205, h: 172 } },
    { key: 'shoes-roller', slot: 'shoes', label: '轮滑鞋', box: { x: 202, y: 622, w: 182, h: 156 } },
    { key: 'socks-white', slot: 'leg', cat: 'shoes', label: '白色长袜', box: { x: 144, y: 505, w: 263, h: 324 } },
    { key: 'socks-stripe', slot: 'leg', cat: 'shoes', label: '条纹长袜', box: { x: 103, y: 460, w: 343, h: 410 } },
    { key: 'socks-knee', slot: 'leg', cat: 'shoes', label: '薄荷长袜', box: { x: 139, y: 482, w: 271, h: 352 } },
    { key: 'socks-star', slot: 'leg', cat: 'shoes', label: '星星长袜', box: { x: 143, y: 496, w: 263, h: 334 } },
    { key: 'neck-pearl', slot: 'neck', cat: 'accessory', label: '珍珠项链', box: { x: 245, y: 277, w: 110, h: 86 } },
    { key: 'neck-heart', slot: 'neck', cat: 'accessory', label: '爱心项链', box: { x: 251, y: 283, w: 98, h: 96 } },
    { key: 'neck-flower', slot: 'neck', cat: 'accessory', label: '花朵项链', box: { x: 253, y: 285, w: 94, h: 94 } },
    { key: 'neck-bow', slot: 'neck', cat: 'accessory', label: '蝴蝶结项圈', box: { x: 248, y: 282, w: 104, h: 68 } },
    { key: 'ear-star', slot: 'ear', cat: 'accessory', label: '星星耳钉', box: { x: 209, y: 198, w: 182, h: 46 } },
    { key: 'ear-hoop', slot: 'ear', cat: 'accessory', label: '圆环耳环', box: { x: 201, y: 200, w: 195, h: 64 } },
    { key: 'ear-flower', slot: 'ear', cat: 'accessory', label: '花朵耳夹', box: { x: 206, y: 198, w: 188, h: 58 } },
    { key: 'hand-balloon', slot: 'hand', cat: 'accessory', label: '小气球', box: { x: 345, y: 323, w: 110, h: 228 } },
    { key: 'hand-umbrella', slot: 'hand', cat: 'accessory', label: '小雨伞', box: { x: 316, y: 372, w: 168, h: 189 } },
    { key: 'hand-bag', slot: 'hand', cat: 'accessory', label: '小手提包', box: { x: 354, y: 526, w: 109, h: 143 } },
    { key: 'hand-teddy', slot: 'hand', cat: 'accessory', label: '泰迪熊', box: { x: 329, y: 523, w: 134, h: 192 } },
    { key: 'hand-bouquet', slot: 'hand', cat: 'accessory', label: '花束', box: { x: 349, y: 500, w: 102, h: 156 } },
    { key: 'pet-cat', slot: 'pet', cat: 'accessory', label: '小猫咪', box: { x: 396, y: 539, w: 144, h: 221 } },
    { key: 'pet-puppy', slot: 'pet', cat: 'accessory', label: '小狗', box: { x: 385, y: 561, w: 169, h: 201 } },
    { key: 'pet-duck', slot: 'pet', cat: 'accessory', label: '小鸭子', box: { x: 388, y: 567, w: 140, h: 181 } },
    { key: 'pet-bunny', slot: 'pet', cat: 'accessory', label: '小兔子', box: { x: 396, y: 533, w: 134, h: 227 } },
    { key: 'back-wings', slot: 'back', cat: 'accessory', label: '天使翅膀', box: { x: 96, y: 291, w: 405, h: 202 } },
    { key: 'back-cape', slot: 'back', cat: 'accessory', label: '红披风', box: { x: 183, y: 269, w: 234, h: 362 } },
    { key: 'back-bag', slot: 'back', cat: 'accessory', label: '双肩包', box: { x: 200, y: 298, w: 200, h: 192 } },
    { key: 'waist-sash', slot: 'waist', cat: 'accessory', label: '丝带腰带', box: { x: 219, y: 453, w: 162, h: 91 } },
    { key: 'waist-bow', slot: 'waist', cat: 'accessory', label: '蝴蝶结腰饰', box: { x: 238, y: 432, w: 124, h: 106 } },
    { key: 'beach-sunnies', slot: 'face', scene: 'beach', label: '沙滩太阳镜', box: { x: 177, y: 161, w: 243, h: 118 } },
    { key: 'beach-necklace', slot: 'neck', cat: 'accessory', scene: 'beach', label: '贝壳项链', box: { x: 237, y: 269, w: 126, h: 146 } },
    { key: 'beach-ring', slot: 'waist', cat: 'accessory', scene: 'beach', label: '泳圈', box: { x: 207, y: 409, w: 186, h: 204 } },
    { key: 'palace-cape', slot: 'back', cat: 'accessory', scene: 'palace', label: '公主披风', box: { x: 153, y: 263, w: 294, h: 464 } },
    { key: 'palace-wand', slot: 'hand', cat: 'accessory', scene: 'palace', label: '魔法权杖', box: { x: 353, y: 385, w: 129, h: 196 } },
    { key: 'palace-earrings', slot: 'ear', cat: 'accessory', scene: 'palace', label: '珍珠耳环', box: { x: 207, y: 203, w: 183, h: 73 } },
    { key: 'palace-necklace', slot: 'neck', cat: 'accessory', scene: 'palace', label: '宝石项链', box: { x: 248, y: 280, w: 104, h: 133 } },
    { key: 'forest-flowercrown', slot: 'hat', scene: 'forest', label: '花环', box: { x: 195, y: 87, w: 210, h: 84 } },
    { key: 'forest-backpack', slot: 'back', cat: 'accessory', scene: 'forest', label: '小背包', box: { x: 171, y: 295, w: 255, h: 282 } },
    { key: 'forest-squirrel', slot: 'pet', cat: 'accessory', scene: 'forest', label: '小松鼠', box: { x: 361, y: 506, w: 199, h: 240 } },
    { key: 'forest-basket', slot: 'hand', cat: 'accessory', scene: 'forest', label: '小篮子', box: { x: 163, y: 526, w: 132, h: 161 } },
  ];
  // <<< GEN:ITEMS <<<

  const SCENES_DATA = [
    {
      key: 'beach', name: '海边', playable: true, cardColor: 0x9fe4ff, accent: 0x2f9dd0,
      ink: '#3f6b86', inkSoft: '#5c7c92', shadow: 0xd0a566,
      spots: [
        { key: 'swim', label: '去游泳', icon: 'swim', action: 'swim', fx: 0.30, fy: 0.78 },
        { key: 'castle', label: '堆沙堡', icon: 'castle', action: 'castle', fx: 0.80, fy: 0.92 },
        { key: 'shells', label: '捡贝壳', icon: 'shells', action: 'shells', fx: 0.55, fy: 0.98 },
      ],
    },
    {
      key: 'palace', name: '宫廷', playable: true, cardColor: 0xe3d3f5, accent: 0x7a5bb0,
      ink: '#7a4f9c', inkSoft: '#8f6fb0', shadow: 0xb49ac9,
      spots: [
        { key: 'tea', label: '下午茶', icon: 'tea', action: 'tea', fx: 0.26, fy: 0.94 },
        { key: 'dance', label: '跳舞', icon: 'dance', action: 'dance', fx: 0.50, fy: 0.94 },
        { key: 'throne', label: '坐王座', icon: 'throne', action: 'throne', fx: 0.74, fy: 0.94 },
      ],
    },
    {
      key: 'forest', name: '森林', playable: true, cardColor: 0xd2f0d6, accent: 0x3f9d6b,
      ink: '#2f6b4a', inkSoft: '#4d8265', shadow: 0x7fae87,
      spots: [
        { key: 'mushroom', label: '采蘑菇', icon: 'mushroom', action: 'mushroom', fx: 0.22, fy: 0.93 },
        { key: 'deer', label: '喂小鹿', icon: 'deer', action: 'deer', fx: 0.78, fy: 0.93 },
        { key: 'butterfly', label: '追蝴蝶', icon: 'butterfly', action: 'butterfly', fx: 0.50, fy: 0.99 },
      ],
    },
  ];

  function textStyle(size, color, bold, lineSpacing) {
    const style = {
      fontFamily: '"Microsoft YaHei", "PingFang SC", system-ui, sans-serif',
      fontSize: size + 'px',
      color: color,
      align: 'center',
    };
    if (bold) style.fontStyle = 'bold';
    if (lineSpacing) style.lineSpacing = lineSpacing;
    return style;
  }

  const SoundFX = (function () {
    let ctx = null;

    function getCtx() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!ctx) ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, endFreq, duration, type, volume, delay) {
      const audio = getCtx();
      if (!audio) return;
      const startAt = audio.currentTime + (delay || 0);
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(1, freq), startAt);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), startAt + duration);
      }
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume || 0.16, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.04);
    }

    return {
      enter: function () {
        tone(587.33, 587.33, 0.12, 'sine', 0.13, 0);
        tone(783.99, 783.99, 0.16, 'sine', 0.12, 0.10);
      },
      pick: function () {
        tone(520, 700, 0.07, 'triangle', 0.12, 0);
      },
      wear: function () {
        tone(659.25, 659.25, 0.10, 'sine', 0.16, 0);
        tone(880, 987.77, 0.14, 'sine', 0.13, 0.08);
      },
      swap: function () {
        tone(740, 740, 0.12, 'triangle', 0.14, 0);
      },
      remove: function () {
        tone(520, 330, 0.14, 'sine', 0.13, 0);
      },
      clearAll: function () {
        [700, 560, 440, 330].forEach(function (freq, index) {
          tone(freq, freq * 0.85, 0.12, 'triangle', 0.12, index * 0.07);
        });
      },
      denied: function () {
        tone(220, 150, 0.20, 'sawtooth', 0.08, 0);
      },
      step: function () {
        tone(420, 380, 0.08, 'triangle', 0.09, 0);
        tone(500, 460, 0.08, 'triangle', 0.08, 0.12);
      },
      splash: function () {
        tone(900, 180, 0.34, 'sine', 0.13, 0);
        tone(380, 900, 0.16, 'triangle', 0.07, 0.05);
      },
      pop: function () {
        tone(400, 880, 0.10, 'triangle', 0.12, 0);
      },
      chime: function () {
        tone(880, 880, 0.14, 'sine', 0.11, 0);
        tone(1174.66, 1174.66, 0.20, 'sine', 0.10, 0.11);
      },
      fanfare: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, index) {
          tone(freq, freq, 0.16, 'triangle', 0.11, index * 0.10);
        });
      },
      twinkle: function () {
        [1046.5, 1318.5, 1568, 2093].forEach(function (freq, index) {
          tone(freq, freq * 1.02, 0.12, 'sine', 0.07, index * 0.09);
        });
      },
    };
  })();

  function drawCloud(g, x, y, r) {
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(x, y, r);
    g.fillCircle(x + r * 0.92, y + r * 0.18, r * 0.76);
    g.fillCircle(x - r * 0.95, y + r * 0.22, r * 0.68);
    g.fillRect(x - r * 1.5, y + r * 0.3, r * 3, r * 0.8);
  }

  function drawShell(g, x, y, r, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.arc(x, y, r, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xfff6df, 1).fillRect(x - r * 0.9, y, r * 1.8, r * 0.3);
  }

  function drawStarfish(g, x, y, r, color) {
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? r : r * 0.46;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push(new Phaser.Geom.Point(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
    }
    g.fillStyle(color, 1).fillPoints(points, true);
  }

  function drawBeachBall(g, x, y, r) {
    g.fillStyle(0xffffff, 1).fillCircle(x, y, r);
    const wedges = [
      { color: 0xff6b8a, from: -Math.PI / 2, to: -Math.PI / 6 },
      { color: 0x4fa8dc, from: -Math.PI / 6, to: Math.PI / 2 },
      { color: 0xffd84e, from: Math.PI / 2, to: (Math.PI * 7) / 6 },
    ];
    wedges.forEach(function (wedge) {
      g.fillStyle(wedge.color, 1);
      g.beginPath();
      g.moveTo(x, y);
      g.arc(x, y, r, wedge.from, wedge.to, false);
      g.closePath();
      g.fillPath();
    });
    g.fillStyle(0xffffff, 0.55).fillCircle(x - r * 0.3, y - r * 0.35, r * 0.22);
  }

  function drawPalm(g, baseX, baseY, h) {
    g.fillStyle(0xa8763f, 1);
    g.beginPath();
    g.moveTo(baseX - h * 0.055, baseY);
    g.lineTo(baseX - h * 0.022, baseY - h * 0.52);
    g.lineTo(baseX - h * 0.03, baseY - h);
    g.lineTo(baseX + h * 0.03, baseY - h);
    g.lineTo(baseX + h * 0.038, baseY - h * 0.52);
    g.lineTo(baseX + h * 0.055, baseY);
    g.closePath();
    g.fillPath();
    const topY = baseY - h;
    for (let i = 0; i < 5; i += 1) {
      const angle = Phaser.Math.DegToRad(-165 + i * 38);
      g.save();
      g.translateCanvas(baseX - h * 0.02, topY);
      g.rotateCanvas(angle);
      g.fillStyle(i % 2 === 0 ? 0x4fbf7a : 0x3fa768, 1);
      g.fillEllipse(h * 0.32, 0, h * 0.66, h * 0.22);
      g.restore();
    }
    g.fillStyle(0x8a5a2b, 1).fillCircle(baseX - h * 0.03, topY + h * 0.02, h * 0.045);
  }

  function drawBeach(g) {
    const short = Math.min(WIDTH, HEIGHT);
    const horizon = IS_PORTRAIT ? 300 : 216;
    const sandTop = IS_PORTRAIT ? 410 : 302;
    const sandH = HEIGHT - sandTop;

    g.fillStyle(0x9fe4ff, 1).fillRect(0, 0, WIDTH, horizon);
    g.fillStyle(0xd9f4ff, 1).fillRect(0, 0, WIDTH, horizon * 0.58);
    g.fillStyle(0xfff3c9, 1).fillRect(0, horizon * 0.74, WIDTH, horizon * 0.26);

    const sunX = WIDTH * 0.17;
    const sunY = horizon * 0.36;
    const sunR = short * 0.082;
    g.lineStyle(6, 0xffd75e, 0.7);
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      g.lineBetween(
        sunX + Math.cos(angle) * sunR * 1.32,
        sunY + Math.sin(angle) * sunR * 1.32,
        sunX + Math.cos(angle) * sunR * 1.9,
        sunY + Math.sin(angle) * sunR * 1.9
      );
    }
    g.fillStyle(0xfff0a0, 1).fillCircle(sunX, sunY, sunR);
    g.fillStyle(0xffe066, 1).fillCircle(sunX, sunY, sunR * 0.82);

    drawCloud(g, WIDTH * 0.74, horizon * 0.26, short * 0.055);
    drawCloud(g, WIDTH * 0.44, horizon * 0.52, short * 0.042);

    g.fillStyle(0x63c8f0, 1).fillRect(0, horizon, WIDTH, sandTop - horizon);
    g.fillStyle(0x8adcf7, 1).fillRect(0, horizon, WIDTH, (sandTop - horizon) * 0.42);
    g.lineStyle(5, 0xffffff, 0.65);
    for (let i = 0; i < 4; i += 1) {
      const y = horizon + 16 + (i * (sandTop - horizon - 24)) / 4;
      const offset = i % 2 === 0 ? 0 : 30;
      for (let x = -28 + offset; x < WIDTH; x += 78) {
        g.beginPath();
        g.arc(x + 22, y, 22, Math.PI, Math.PI * 2, false);
        g.strokePath();
      }
    }

    g.fillStyle(0xf3d49c, 1).fillRect(0, sandTop, WIDTH, sandH);
    g.fillStyle(0xffe6bb, 1).fillRect(0, sandTop, WIDTH, sandH * 0.3);

    const dollCenterX = WIDTH / 2;
    drawPalm(g, Math.max(40, dollCenterX - short * 0.44), sandTop + sandH * 0.36, Math.min(sandH * 0.85, IS_PORTRAIT ? 190 : 150));
    drawBeachBall(g, Math.min(WIDTH - 52, dollCenterX + short * 0.42), sandTop + sandH * 0.3, short * 0.058);
    drawShell(g, WIDTH * 0.13, sandTop + sandH * 0.35, short * 0.032, 0xffb3d1);
    drawShell(g, WIDTH * 0.88, sandTop + sandH * 0.52, short * 0.028, 0xffe08a);
    drawStarfish(g, WIDTH * 0.2, sandTop + sandH * 0.68, short * 0.036, 0xff9f5f);
  }
  function drawPineSimple(g, cx, baseY, h, color) {
    g.fillStyle(0x9a6f47, 1).fillRect(cx - h * 0.05, baseY - h * 0.26, h * 0.1, h * 0.26);
    g.fillStyle(color, 1);
    for (let i = 0; i < 3; i += 1) {
      const topY = baseY - h + h * 0.22 * i;
      const half = h * (0.2 + i * 0.09);
      g.fillPoints([
        new Phaser.Geom.Point(cx, topY),
        new Phaser.Geom.Point(cx + half, topY + h * 0.4),
        new Phaser.Geom.Point(cx - half, topY + h * 0.4),
      ], true);
    }
  }

  function drawPalace(g) {
    const short = Math.min(WIDTH, HEIGHT);
    const floorY = IS_PORTRAIT ? 468 : 292;

    g.fillStyle(0xf8ecf6, 1).fillRect(0, 0, WIDTH, floorY);
    g.fillStyle(0xf0d9ef, 1).fillRect(0, 0, WIDTH, floorY * 0.44);

    const stripeW = short * 0.1;
    g.fillStyle(0xe6c3e4, 0.45);
    for (let x = stripeW * 0.1; x < WIDTH + stripeW; x += stripeW * 1.45) {
      g.fillRoundedRect(x, floorY * 0.08, stripeW * 0.28, floorY * 0.84, stripeW * 0.14);
    }

    const winW = short * 0.19;
    const winH = floorY * 0.5;
    const winTop = floorY * 0.2;
    [0.16, 0.84].forEach(function (fx) {
      const wx = WIDTH * fx;
      g.fillStyle(0xd9f2ff, 1);
      g.beginPath();
      g.moveTo(wx - winW / 2, winTop + winH);
      g.lineTo(wx - winW / 2, winTop + winW / 2);
      g.arc(wx, winTop + winW / 2, winW / 2, Math.PI, Math.PI * 2, false);
      g.lineTo(wx + winW / 2, winTop + winH);
      g.closePath();
      g.fillPath();
      g.lineStyle(Math.max(6, short * 0.016), 0xf3d383, 1);
      g.strokePath();
      g.lineStyle(Math.max(3, short * 0.007), 0xf8e9bd, 0.95);
      g.lineBetween(wx, winTop + winW * 0.62, wx, winTop + winH);
      g.lineBetween(wx - winW / 2, winTop + winH * 0.66, wx + winW / 2, winTop + winH * 0.66);
    });

    g.fillStyle(0xf7d98a, 1).fillRect(0, floorY - short * 0.036, WIDTH, short * 0.036);
    g.fillStyle(0xdfb95f, 1).fillRect(0, floorY - short * 0.009, WIDTH, short * 0.009);

    const floorH = HEIGHT - floorY;
    g.fillStyle(0xf1e2d6, 1).fillRect(0, floorY, WIDTH, floorH);
    let rowY = floorY;
    let rowH = floorH * 0.1;
    let rowIndex = 0;
    while (rowY < HEIGHT - 1) {
      const h = Math.min(rowH, HEIGHT - rowY);
      const cols = 6;
      const cw = WIDTH / cols;
      for (let c = 0; c < cols; c += 1) {
        if ((c + rowIndex) % 2 === 0) {
          g.fillStyle(0xe3d0c1, 1).fillRect(c * cw, rowY, cw, h);
        }
      }
      rowY += h;
      rowH *= 1.36;
      rowIndex += 1;
    }

    const carpetTop = floorY + short * 0.02;
    const carpetW = short * 0.46;
    const cxm = WIDTH / 2;
    g.fillStyle(0xc23a63, 1).fillPoints([
      new Phaser.Geom.Point(cxm - carpetW * 0.36, carpetTop),
      new Phaser.Geom.Point(cxm + carpetW * 0.36, carpetTop),
      new Phaser.Geom.Point(cxm + carpetW * 0.62, HEIGHT),
      new Phaser.Geom.Point(cxm - carpetW * 0.62, HEIGHT),
    ], true);
    g.fillStyle(0xd8567c, 1).fillPoints([
      new Phaser.Geom.Point(cxm - carpetW * 0.26, carpetTop),
      new Phaser.Geom.Point(cxm + carpetW * 0.26, carpetTop),
      new Phaser.Geom.Point(cxm + carpetW * 0.44, HEIGHT),
      new Phaser.Geom.Point(cxm - carpetW * 0.44, HEIGHT),
    ], true);

    const colW = short * 0.12;
    [-1, 1].forEach(function (side) {
      const ccx = side < 0 ? colW * 0.6 : WIDTH - colW * 0.6;
      const baseY = floorY + short * 0.06;
      g.fillStyle(0xfdf7ff, 1).fillRect(ccx - colW / 2, 0, colW, baseY);
      g.fillStyle(0xeadff2, 1).fillRect(ccx + colW * 0.06, 0, colW * 0.3, baseY);
      g.fillStyle(0xf7d98a, 1).fillRect(ccx - colW * 0.72, 0, colW * 1.44, short * 0.03);
      g.fillRect(ccx - colW * 0.72, baseY - short * 0.034, colW * 1.44, short * 0.034);
      g.fillStyle(0xdfb95f, 1).fillRect(ccx - colW * 0.72, short * 0.03, colW * 1.44, short * 0.008);
    });

    if (IS_PORTRAIT) {
      const chX = WIDTH / 2;
      g.lineStyle(4, 0xdfb95f, 1).lineBetween(chX, 0, chX, short * 0.1);
      for (let i = 0; i < 5; i += 1) {
        const bx = chX - short * 0.1 + (i * short * 0.2) / 4;
        g.fillStyle(0xfff8dd, 1).fillRect(bx - short * 0.008, short * 0.11, short * 0.016, short * 0.05);
        g.fillStyle(0xffd75e, 1).fillCircle(bx, short * 0.105, short * 0.016);
      }
      g.fillStyle(0xfff3c9, 1).fillRect(chX - short * 0.014, short * 0.1, short * 0.028, short * 0.05);
      g.fillStyle(0xf7d98a, 1).fillCircle(chX, short * 0.165, short * 0.044);
      g.fillStyle(0xdfb95f, 1).fillCircle(chX, short * 0.182, short * 0.022);
    }
  }

  function drawForest(g) {
    const short = Math.min(WIDTH, HEIGHT);
    const groundY = IS_PORTRAIT ? 424 : 258;

    g.fillStyle(0xdff3e0, 1).fillRect(0, 0, WIDTH, groundY);
    g.fillStyle(0xf0fbea, 1).fillRect(0, 0, WIDTH, groundY * 0.5);
    g.fillStyle(0xc9ebcd, 1).fillRect(0, groundY * 0.7, WIDTH, groundY * 0.3);

    g.fillStyle(0xffffff, 0.26);
    for (let i = 0; i < 4; i += 1) {
      const x0 = WIDTH * 0.08 + i * WIDTH * 0.27;
      g.fillPoints([
        new Phaser.Geom.Point(x0, 0),
        new Phaser.Geom.Point(x0 + short * 0.05, 0),
        new Phaser.Geom.Point(x0 - short * 0.26, groundY),
        new Phaser.Geom.Point(x0 - short * 0.4, groundY),
      ], true);
    }

    const treeBase = groundY + short * 0.03;
    for (let i = 0; i * short * 0.13 < WIDTH + short * 0.2; i += 1) {
      drawPineSimple(g, i * short * 0.13 - short * 0.03, treeBase, short * (0.2 + (i % 3) * 0.04), 0xa6dfb4);
    }
    for (let i = 0; i * short * 0.19 < WIDTH + short * 0.2; i += 1) {
      drawPineSimple(g, i * short * 0.19 + short * 0.05, treeBase, short * (0.3 + (i % 2) * 0.07), 0x6ec48c);
    }

    const grassTop = groundY - short * 0.01;
    g.fillStyle(0x7fc98f, 1).fillRect(0, grassTop, WIDTH, HEIGHT - grassTop);
    g.fillStyle(0x9bddaa, 1).fillRect(0, grassTop, WIDTH, short * 0.08);
    g.fillStyle(0x6fbd82, 1).fillRect(0, grassTop + short * 0.08, WIDTH, short * 0.012);

    const cxm = WIDTH / 2;
    g.fillStyle(0xdcd6c2, 0.7);
    for (let i = 0; i < 4; i += 1) {
      g.fillEllipse(cxm, grassTop + short * (0.13 + i * 0.13), short * (0.17 + i * 0.05), short * 0.045);
    }

    [-1, 1].forEach(function (side) {
      const tx = side < 0 ? short * 0.04 : WIDTH - short * 0.04;
      const trunkTop = grassTop - short * 0.42;
      const trunkH = HEIGHT - trunkTop;
      g.fillStyle(0xa8763f, 1).fillRoundedRect(tx - short * 0.04, trunkTop, short * 0.08, trunkH, short * 0.03);
      g.fillStyle(0x8d5f33, 1).fillRoundedRect(tx + short * 0.01, trunkTop, short * 0.028, trunkH, short * 0.02);
      [0, 1, 2].forEach(function (k) {
        g.fillStyle(k === 1 ? 0x4fa877 : 0x5fb987, 1);
        g.fillCircle(tx + (k - 1) * short * 0.08, trunkTop - short * 0.02 + Math.abs(k - 1) * short * 0.05, short * 0.112);
      });
    });

    function mushroom(mx, my, r) {
      g.fillStyle(0xfff4e4, 1).fillRoundedRect(mx - r * 0.2, my - r * 0.08, r * 0.4, r * 0.85, r * 0.16);
      g.fillStyle(0xe4576f, 1);
      g.beginPath();
      g.arc(mx, my - r * 0.05, r * 0.6, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xfff4e4, 1).fillCircle(mx - r * 0.24, my - r * 0.33, r * 0.11);
      g.fillCircle(mx + r * 0.22, my - r * 0.27, r * 0.09);
    }

    function flower(fx, fy, r) {
      g.fillStyle(0xff9ecb, 1);
      for (let i = 0; i < 5; i += 1) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        g.fillCircle(fx + Math.cos(a) * r * 0.62, fy + Math.sin(a) * r * 0.62, r * 0.42);
      }
      g.fillStyle(0xffd75e, 1).fillCircle(fx, fy, r * 0.36);
    }

    mushroom(WIDTH * 0.1, grassTop + short * 0.26, short * 0.062);
    mushroom(WIDTH * 0.18, grassTop + short * 0.36, short * 0.046);
    mushroom(WIDTH * 0.9, grassTop + short * 0.3, short * 0.056);
    flower(WIDTH * 0.06, grassTop + short * 0.12, short * 0.032);
    flower(WIDTH * 0.24, grassTop + short * 0.19, short * 0.026);
    flower(WIDTH * 0.8, grassTop + short * 0.14, short * 0.03);
    flower(WIDTH * 0.94, grassTop + short * 0.22, short * 0.025);

    g.fillStyle(0x5fb37a, 1);
    for (let i = 0; i <= 15; i += 1) {
      const tx2 = (i * WIDTH) / 15 + short * 0.02;
      const ty2 = grassTop + short * 0.05 + (i % 3) * short * 0.045;
      g.fillPoints([
        new Phaser.Geom.Point(tx2, ty2),
        new Phaser.Geom.Point(tx2 + short * 0.012, ty2 - short * 0.05),
        new Phaser.Geom.Point(tx2 + short * 0.024, ty2),
      ], true);
    }
  }

  const SCENE_PAINTERS = {
    beach: drawBeach,
    palace: drawPalace,
    forest: drawForest,
  };

  // ======================================================================
  // 过家家：点地上的光圈，小人会连着身上所有穿戴一起去做那件事
  //   - 小人整体 = dollLayer 里的 dollPivot（身体 + 发型 + 帽子 + 衣裤裙 + 鞋 + 配饰）
  //   - 旋转/缩放作用在 dollPivot 上，转轴在小人腰胯，所以看起来是“整个人在动”
  //   - 互动点写在 SCENES_DATA[].spots：fx 是横向位置，fy 是落脚高度（都是比例）
  // ======================================================================

  const PU = IS_PORTRAIT ? 1 : 0.7; // 横屏时道具跟着小人一起缩小

  // 每个场景的背景基准线（和上面背景画法一致），道具贴着它摆
  const SCENE_ANCHORS = {
    beach: function () { return { ground: IS_PORTRAIT ? 410 : 302 }; },
    palace: function () { return { ground: IS_PORTRAIT ? 468 : 292 }; },
    forest: function () { return { ground: IS_PORTRAIT ? 424 : 258 }; },
  };

  function tri(x, y, w, h) {
    return [
      new Phaser.Geom.Point(x, y),
      new Phaser.Geom.Point(x + w * 0.5, y - h),
      new Phaser.Geom.Point(x + w, y),
    ];
  }

  function drawSpotIcon(g, key, cx, cy, s, color) {
    g.fillStyle(color, 1);
    if (key === 'swim') {
      g.lineStyle(Math.max(2, s * 0.34), color, 1);
      g.beginPath();
      g.arc(cx - s * 0.44, cy + s * 0.26, s * 0.44, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.beginPath();
      g.arc(cx + s * 0.46, cy + s * 0.26, s * 0.44, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.fillCircle(cx + s * 0.04, cy - s * 0.36, s * 0.3);
      g.fillRect(cx - s * 0.42, cy + s * 0.22, s * 0.88, s * 0.3);
      return;
    }
    if (key === 'castle') {
      g.fillRect(cx - s * 0.92, cy - s * 0.3, s * 1.84, s * 1.2);
      g.fillRect(cx - s * 0.76, cy - s * 0.98, s * 0.6, s * 0.72);
      g.fillRect(cx + s * 0.16, cy - s * 0.98, s * 0.6, s * 0.72);
      g.fillStyle(0xffffff, 0.95).fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.4, s * 0.8);
      return;
    }
    if (key === 'shells') {
      g.beginPath();
      g.arc(cx, cy + s * 0.44, s * 0.92, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.lineStyle(Math.max(2, s * 0.18), 0xffffff, 0.85);
      [-1, 0, 1].forEach(function (dx) {
        g.lineBetween(cx, cy + s * 0.44, cx + dx * s * 0.76, cy - s * 0.34);
      });
      return;
    }
    if (key === 'dance') {
      g.fillEllipse(cx - s * 0.4, cy + s * 0.6, s * 0.76, s * 0.58);
      g.fillEllipse(cx + s * 0.56, cy + s * 0.3, s * 0.76, s * 0.58);
      g.fillRect(cx - s * 0.1, cy - s * 0.92, s * 0.24, s * 1.62);
      g.fillRect(cx + s * 0.86, cy - s * 1.22, s * 0.24, s * 1.62);
      g.fillRect(cx - s * 0.1, cy - s * 0.92, s * 0.72, s * 0.32);
      g.fillRect(cx + s * 0.86, cy - s * 1.22, s * 0.72, s * 0.32);
      return;
    }
    if (key === 'tea') {
      g.fillRoundedRect(cx - s * 0.84, cy - s * 0.2, s * 1.68, s * 0.94, s * 0.24);
      g.lineStyle(Math.max(2, s * 0.22), color, 1);
      g.beginPath();
      g.arc(cx + s * 0.92, cy + s * 0.2, s * 0.34, -Math.PI * 0.5, Math.PI * 0.5, false);
      g.strokePath();
      g.fillStyle(color, 1).fillRect(cx - s * 1.06, cy + s * 0.62, s * 2.12, s * 0.22);
      g.fillStyle(0xffffff, 0.9);
      for (let i = -1; i <= 1; i += 1) g.fillCircle(cx + i * s * 0.36, cy - s * 0.58, s * 0.18);
      return;
    }
    if (key === 'throne') {
      g.fillRoundedRect(cx - s * 0.72, cy - s * 1.0, s * 1.44, s * 1.6, s * 0.2);
      g.fillStyle(0xffffff, 0.9).fillRoundedRect(cx - s * 0.44, cy - s * 0.66, s * 0.88, s * 1.2, s * 0.14);
      g.fillStyle(color, 1);
      g.fillRect(cx - s * 0.96, cy + s * 0.58, s * 0.3, s * 0.56);
      g.fillRect(cx + s * 0.66, cy + s * 0.58, s * 0.3, s * 0.56);
      return;
    }
    if (key === 'mushroom') {
      g.beginPath();
      g.arc(cx, cy + s * 0.08, s * 0.86, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.fillRoundedRect(cx - s * 0.3, cy + s * 0.04, s * 0.6, s * 0.9, s * 0.2);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(cx - s * 0.34, cy - s * 0.32, s * 0.17);
      g.fillCircle(cx + s * 0.32, cy - s * 0.26, s * 0.14);
      return;
    }
    if (key === 'deer') {
      g.fillCircle(cx, cy + s * 0.36, s * 0.62);
      g.fillPoints([new Phaser.Geom.Point(cx - s * 0.62, cy + s * 0.12), new Phaser.Geom.Point(cx - s * 0.68, cy - s * 0.66), new Phaser.Geom.Point(cx - s * 0.16, cy - s * 0.14)], true);
      g.fillPoints([new Phaser.Geom.Point(cx + s * 0.62, cy + s * 0.12), new Phaser.Geom.Point(cx + s * 0.68, cy - s * 0.66), new Phaser.Geom.Point(cx + s * 0.16, cy - s * 0.14)], true);
      g.lineStyle(Math.max(2, s * 0.15), color, 1);
      g.lineBetween(cx - s * 0.34, cy - s * 0.54, cx - s * 0.52, cy - s * 1.06);
      g.lineBetween(cx + s * 0.34, cy - s * 0.54, cx + s * 0.52, cy - s * 1.06);
      return;
    }
    g.fillEllipse(cx - s * 0.46, cy - s * 0.32, s * 0.8, s * 0.92);
    g.fillEllipse(cx + s * 0.46, cy - s * 0.32, s * 0.8, s * 0.92);
    g.fillEllipse(cx - s * 0.34, cy + s * 0.46, s * 0.58, s * 0.72);
    g.fillEllipse(cx + s * 0.34, cy + s * 0.46, s * 0.58, s * 0.72);
    g.fillRoundedRect(cx - s * 0.08, cy - s * 0.62, s * 0.16, s * 1.36, s * 0.08);
  }

  // 一汪海水：上缘接着海面，下缘是波浪，小人站进去就是半身入水的样子
  function drawLagoon(g, cx, topY, botY, w) {
    const h = botY - topY;
    const cy = (topY + botY) / 2;
    g.fillStyle(0x4fb8e8, 1).fillEllipse(cx, cy, w, h);
    g.fillStyle(0x63c8f0, 1).fillEllipse(cx, cy + h * 0.06, w * 0.93, h * 0.84);
    g.fillStyle(0x8adcf7, 1).fillEllipse(cx, cy - h * 0.16, w * 0.88, h * 0.54);
    g.lineStyle(6, 0xffffff, 0.8).strokeEllipse(cx, cy, w, h);
    g.lineStyle(5, 0xffffff, 0.6);
    for (let i = 0; i < 3; i += 1) {
      g.beginPath();
      g.arc(cx - w * 0.22 + i * w * 0.22, cy - h * 0.12 + i * h * 0.16, w * 0.09, Math.PI, Math.PI * 2, false);
      g.strokePath();
    }
  }

  function drawSandcastle(g, cx, by, s) {
    g.fillStyle(0xe0b979, 1).fillRoundedRect(cx - s * 1.0, by - s * 0.92, s * 2.0, s * 0.92, s * 0.1);
    g.fillStyle(0xefc98d, 1).fillRoundedRect(cx - s * 0.96, by - s * 1.06, s * 1.92, s * 0.3, s * 0.08);
    g.fillStyle(0xe8c184, 1);
    g.fillRoundedRect(cx - s * 0.74, by - s * 1.62, s * 0.6, s * 0.7, s * 0.1);
    g.fillRoundedRect(cx + s * 0.14, by - s * 1.5, s * 0.6, s * 0.6, s * 0.1);
    g.fillStyle(0xd9ab68, 1);
    g.fillPoints(tri(cx - s * 0.86, by - s * 1.6, s * 0.84, s * 0.44), true);
    g.fillPoints(tri(cx + s * 0.02, by - s * 1.48, s * 0.84, s * 0.42), true);
    g.fillStyle(0xc08f52, 1).fillRoundedRect(cx - s * 0.24, by - s * 0.56, s * 0.48, s * 0.56, s * 0.1);
    g.fillStyle(0xe0b979, 1);
    for (let i = 0; i < 4; i += 1) {
      g.fillRect(cx - s * 0.86 + i * s * 0.52, by - s * 1.24, s * 0.26, s * 0.22);
    }
    g.lineStyle(Math.max(2, s * 0.06), 0xffffff, 0.5).lineBetween(cx - s * 0.9, by - s * 1.18, cx + s * 0.9, by - s * 1.18);
    g.lineStyle(Math.max(2, s * 0.07), 0x8a6a3a, 1).lineBetween(cx + s * 0.44, by - s * 1.5, cx + s * 0.44, by - s * 2.3);
    g.fillStyle(0xff8fb3, 1).fillPoints([
      new Phaser.Geom.Point(cx + s * 0.44, by - s * 2.3),
      new Phaser.Geom.Point(cx + s * 0.44 + s * 0.5, by - s * 2.12),
      new Phaser.Geom.Point(cx + s * 0.44, by - s * 1.94),
    ], true);
  }

  function drawBucket(g, cx, by, s, fill) {
    g.fillStyle(0xff9ecb, 1).fillPoints([
      new Phaser.Geom.Point(cx - s * 0.6, by - s * 0.9),
      new Phaser.Geom.Point(cx + s * 0.6, by - s * 0.9),
      new Phaser.Geom.Point(cx + s * 0.42, by),
      new Phaser.Geom.Point(cx - s * 0.42, by),
    ], true);
    g.fillStyle(fill, 1).fillRect(cx - s * 0.62, by - s * 1.0, s * 1.24, s * 0.22);
    g.lineStyle(Math.max(2, s * 0.1), 0xff8fb3, 1);
    g.beginPath();
    g.arc(cx, by - s * 0.9, s * 0.5, Math.PI, Math.PI * 2, false);
    g.strokePath();
  }

  function drawShellShape(g, cx, cy, r, color) {
    g.fillStyle(color, 1);
    g.beginPath();
    g.arc(cx, cy + r * 0.5, r, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(Math.max(2, r * 0.18), 0xffffff, 0.8);
    for (let i = -2; i <= 2; i += 1) g.lineBetween(cx, cy + r * 0.5, cx + i * r * 0.36, cy - r * 0.4);
  }

  // 小圆茶桌：桌面大约齐小人腰，她站在桌子后面
  function drawTeaSet(g, cx, by, s) {
    const topY = by - s * 1.0;
    g.fillStyle(0xd8a0b8, 1).fillEllipse(cx, topY + s * 0.1, s * 1.84, s * 0.3);
    g.fillStyle(0xfff2f9, 1).fillEllipse(cx, topY, s * 1.84, s * 0.3);
    g.fillStyle(0xf7d98a, 1).fillRect(cx - s * 0.1, topY, s * 0.2, by - topY);
    g.fillStyle(0xdfae3c, 1).fillEllipse(cx, by, s * 0.58, s * 0.16);
    // teapot on the right rim, cups on the left rim: her hands stay clear in the middle
    g.fillStyle(0xffffff, 1).fillRoundedRect(cx + s * 0.36, topY - s * 0.52, s * 0.46, s * 0.44, s * 0.16);
    g.fillRoundedRect(cx + s * 0.34, topY - s * 0.58, s * 0.5, s * 0.12, s * 0.06);
    g.lineStyle(Math.max(2, s * 0.07), 0xe0a8c8, 1);
    g.beginPath();
    g.arc(cx + s * 0.82, topY - s * 0.3, s * 0.13, -Math.PI * 0.5, Math.PI * 0.5, false);
    g.strokePath();
    g.fillStyle(0xffd6ef, 1);
    g.fillRoundedRect(cx - s * 0.78, topY - s * 0.34, s * 0.34, s * 0.3, s * 0.1);
    g.lineStyle(Math.max(2, s * 0.06), 0xffd6ef, 1);
    g.beginPath();
    g.arc(cx - s * 0.44, topY - s * 0.19, s * 0.11, -Math.PI * 0.5, Math.PI * 0.5, false);
    g.strokePath();
    g.fillStyle(0xffffff, 1).fillRoundedRect(cx - s * 0.62, topY - s * 0.6, s * 0.26, s * 0.24, s * 0.08);
  }

  // 高背王座：s 是整体高度，坐面大约在小人蹲坐后的屁股高度
  function drawThrone(g, cx, by, s) {
    const hw = s * 0.33;
    const seatY = by - s * 0.36;
    g.fillStyle(0xf0c94e, 1).fillRoundedRect(cx - hw, by - s * 0.96, hw * 2, s * 0.96, s * 0.09);
    g.fillStyle(0xc23a63, 1).fillRoundedRect(cx - hw * 0.72, by - s * 0.9, hw * 1.44, s * 0.6, s * 0.08);
    g.fillStyle(0xf7d98a, 1);
    g.fillRoundedRect(cx - hw * 1.18, seatY - s * 0.08, hw * 2.36, s * 0.13, s * 0.05);
    g.fillRoundedRect(cx - hw * 1.06, seatY, hw * 0.24, by - seatY, s * 0.03);
    g.fillRoundedRect(cx + hw * 0.82, seatY, hw * 0.24, by - seatY, s * 0.03);
    g.fillStyle(0xfff0a0, 1).fillCircle(cx, by - s * 1.02, s * 0.055);
  }

  function drawMushroom(g, cx, by, r, cap) {
    g.fillStyle(0xfff4e4, 1).fillRoundedRect(cx - r * 0.22, by - r * 0.9, r * 0.44, r * 0.9, r * 0.18);
    g.fillStyle(cap, 1);
    g.beginPath();
    g.arc(cx, by - r * 0.82, r * 0.72, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xfff4e4, 1).fillCircle(cx - r * 0.28, by - r * 1.16, r * 0.13);
    g.fillCircle(cx + r * 0.26, by - r * 1.04, r * 0.1);
  }

  function drawDeer(g, cx, by, s) {
    g.fillStyle(0xc98d5f, 1).fillRoundedRect(cx - s * 0.78, by - s * 1.1, s * 1.56, s * 0.8, s * 0.28);
    g.fillRoundedRect(cx - s * 0.62, by - s * 0.4, s * 0.22, s * 0.44, s * 0.08);
    g.fillRoundedRect(cx + s * 0.4, by - s * 0.4, s * 0.22, s * 0.44, s * 0.08);
    g.fillStyle(0xe0a878, 1).fillCircle(cx + s * 0.86, by - s * 1.34, s * 0.5);
    g.fillStyle(0xc98d5f, 1);
    g.fillEllipse(cx + s * 0.52, by - s * 1.74, s * 0.26, s * 0.46);
    g.fillEllipse(cx + s * 1.2, by - s * 1.74, s * 0.26, s * 0.46);
    g.lineStyle(Math.max(2, s * 0.09), 0x8a6038, 1);
    g.lineBetween(cx + s * 0.68, by - s * 1.78, cx + s * 0.54, by - s * 2.34);
    g.lineBetween(cx + s * 1.04, by - s * 1.78, cx + s * 1.18, by - s * 2.34);
    g.lineBetween(cx + s * 0.54, by - s * 2.34, cx + s * 0.36, by - s * 2.2);
    g.lineBetween(cx + s * 1.18, by - s * 2.34, cx + s * 1.36, by - s * 2.2);
    g.fillStyle(0x3c2f3a, 1);
    g.fillCircle(cx + s * 1.02, by - s * 1.42, s * 0.09);
    g.fillCircle(cx + s * 0.7, by - s * 1.42, s * 0.09);
    g.fillStyle(0xfff4e4, 1).fillCircle(cx + s * 0.86, by - s * 1.14, s * 0.11);
  }

  function makeButterfly(color) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillEllipse(-11, -7, 22, 24);
    g.fillEllipse(11, -7, 22, 24);
    g.fillEllipse(-9, 10, 16, 18);
    g.fillEllipse(9, 10, 16, 18);
    g.fillStyle(0x5b4152, 1).fillRoundedRect(-2, -13, 4, 28, 2);
    c.add(g);
    return c;
  }

  function makeNote(color) {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillEllipse(0, 0, 16, 12);
    g.fillRect(7, -22, 3.6, 22);
    g.fillRect(7, -22, 14, 8);
    c.add(g);
    return c;
  }

  // ------------------------------------------------------------------ 9 个动作
  // 每个动作只做三件事：小人整体摆姿态（整体位移/旋转/压扁）、摆道具、音效+星星
  const SPOT_ACTIONS = {
    // ---------------------------------------------------------------- 海边
    swim: function (scene, spot) {
      const waist = spot.feetY - 292 * scene.scaleDoll;
      const top = Math.min(scene.anchor.ground + 2, waist - 6);
      const w = 300 * PU;
      drawLagoon(scene.propFront, spot.x, top, spot.feetY + 56 * PU, w);
      SoundFX.splash();
      scene.burst(spot.x, top + 10, 9, [0xffffff, 0xdff4ff, 0x8adcf7], w * 0.4, 7 * PU, -30 * PU);
      scene.tw({ targets: scene.dollPivot, rotation: 0.055, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      scene.tw({
        targets: scene.dollLayer,
        y: spot.feetY - DOLL_FEET * scene.scaleDoll + 46 * PU,
        duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
      for (let i = 0; i < 5; i += 1) {
        const b = scene.addProp(scene.add.circle(spot.x + (i - 2) * 26 * PU, top + 40 * PU, 5 * PU + (i % 3) * 2, 0xffffff, 0.7), true);
        scene.tw({
          targets: b, y: top - 40 * PU - i * 16 * PU, alpha: 0, scaleX: 1.5, scaleY: 1.5,
          duration: 2400 + i * 260, repeat: -1, delay: i * 320, ease: 'Sine.Out',
        });
      }
    },
    castle: function (scene, spot) {
      const s = 62 * PU;
      const baseY = spot.feetY + 6;
      // keep her torso clear: the castle sits on the ground next to her, on the roomier side
      const dir = spot.x > WIDTH * 0.5 ? -1 : 1;
      const cx = spot.x + dir * 96 * PU;
      const castle = scene.addProp(scene.add.graphics(), true);
      drawSandcastle(castle, cx, baseY, s);
      castle.setScale(0.25, 0.25);
      scene.tw({ targets: castle, scaleX: 1, scaleY: 1, duration: 900, ease: 'Back.Out' });
      scene.tw({ targets: scene.dollPivot, scaleY: 0.955, duration: 280, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
      scene.tw({
        targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll + 18 * PU,
        duration: 280, yoyo: true, repeat: 3, ease: 'Sine.InOut',
      });
      SoundFX.pop();
      for (let i = 0; i < 3; i += 1) {
        scene.after(300 + i * 280, function () {
          scene.burst(cx + (i - 1) * s * 0.7, baseY - s * 0.9, 6, [0xf3d49c, 0xe8c184, 0xffffff], s * 0.8, 6 * PU, 20 * PU);
          SoundFX.pop();
        });
      }
      drawBucket(scene.propFront, spot.x - dir * s * 1.6, baseY + 2, s * 0.42, 0x8adcf7);
    },
    shells: function (scene, spot) {
      const r = 17 * PU;
      SoundFX.chime();
      scene.tw({ targets: scene.dollPivot, scaleY: 0.96, duration: 320, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll + 20 * PU, duration: 320, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      const colors = [0xffb3d1, 0xffe08a, 0xd8bff8, 0x9fe4ff];
      for (let i = 0; i < 4; i += 1) {
        const bx = spot.x + (i - 1.5) * 54 * PU;
        const by = spot.feetY - 8 * PU + (i % 2) * 12 * PU;
        const sh = scene.addProp(scene.add.graphics(), true);
        drawShellShape(sh, 0, 0, r, colors[i]);
        sh.setPosition(bx, by).setScale(0.2).setAlpha(0);
        scene.tw({ targets: sh, scaleX: 1, scaleY: 1, alpha: 1, duration: 300, delay: 200 * i, ease: 'Back.Out' });
        scene.tw({
          targets: sh, x: spot.x - 66 * PU, y: spot.feetY - 100 * PU, scaleX: 0.3, scaleY: 0.3, alpha: 0,
          duration: 520, delay: 940 + 200 * i, ease: 'Cubic.In',
        });
        scene.after(200 * i, function () { SoundFX.pick(); });
      }
      drawBucket(scene.propFront, spot.x - 70 * PU, spot.feetY + 6 * PU, 26 * PU, 0xfff0a0);
      scene.after(1900, function () { scene.burst(spot.x - 66 * PU, spot.feetY - 110 * PU, 8, [0xffffff, 0xffe08a], 55 * PU, 5 * PU, 0); });
    },
    // ---------------------------------------------------------------- 宫廷
    dance: function (scene, spot) {
      SoundFX.fanfare();
      scene.tw({ targets: scene.dollPivot, rotation: Math.PI * 2, duration: 1500, ease: 'Cubic.InOut' });
      scene.tw({ targets: scene.dollPivot, rotation: Math.PI * 4, duration: 1500, delay: 1700, ease: 'Cubic.InOut' });
      scene.tw({ targets: scene.dollPivot, scaleY: 1.04, duration: 420, yoyo: true, repeat: 4, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll - 24 * PU, duration: 420, yoyo: true, repeat: 4, ease: 'Sine.Out' });
      const colors = [0xff8fb3, 0xffd75e, 0xc9a8f0, 0x8fd8ff];
      for (let i = 0; i < 6; i += 1) {
        const n = scene.addProp(makeNote.call(scene, colors[i % 4]), true);
        n.setPosition(spot.x + (i % 2 === 0 ? -1 : 1) * (60 + i * 8) * PU, spot.feetY - 150 * PU - i * 18 * PU);
        n.setScale(PU);
        scene.tw({ targets: n, y: n.y - 140 * PU, alpha: 0, duration: 1500, delay: i * 220, repeat: 1, ease: 'Sine.In' });
      }
      for (let i = 0; i < 3; i += 1) {
        scene.after(i * 620, function () { scene.burst(spot.x + (i - 1) * 70 * PU, spot.feetY - 150 * PU, 7, [0xfff0a0, 0xffffff, 0xffb8d4], 70 * PU, 6 * PU, 0); });
      }
      scene.burst(spot.x, spot.feetY - 30 * PU, 12, [0xff8fb3, 0xffd75e], 120 * PU, 6 * PU, -12 * PU);
    },
    tea: function (scene, spot) {
      const s = 116 * PU;
      drawTeaSet(scene.propFront, spot.x, spot.feetY + 16 * PU, s);
      SoundFX.chime();
      scene.tw({ targets: scene.dollPivot, rotation: -0.04, duration: 1100, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollPivot, scaleY: 0.98, duration: 1100, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      for (let i = 0; i < 3; i += 1) {
        const st = scene.addProp(scene.add.circle(spot.x + (i - 1) * s * 0.4, spot.feetY - s * 1.1, 4 * PU, 0xffffff, 0.6), true);
        scene.tw({
          targets: st, y: st.y - 80 * PU, x: st.x + (i - 1) * 12 * PU, alpha: 0, scaleX: 1.9, scaleY: 1.9,
          duration: 1800, repeat: -1, delay: i * 380, ease: 'Sine.Out',
        });
      }
      scene.after(700, function () { SoundFX.pick(); scene.burst(spot.x, spot.feetY - 40 * PU, 6, [0xffd6ef, 0xffffff], 50 * PU, 5 * PU, 0); });
    },
    throne: function (scene, spot) {
      const s = 330 * PU;
      drawThrone(scene.propBack, spot.x, spot.feetY + 8 * PU, s);
      scene.tw({ targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll + 60 * PU, duration: 760, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollPivot, scaleX: 0.9, scaleY: 0.86, duration: 760, ease: 'Sine.InOut' });
      SoundFX.fanfare();
      scene.after(800, function () {
        scene.burst(spot.x, spot.feetY - 250 * PU, 12, [0xfff0a0, 0xffd75e, 0xffffff], 110 * PU, 7 * PU, 0);
        SoundFX.wear();
      });
      scene.after(1200, function () {
        const n = scene.addProp(makeNote.call(scene, 0xfff0a0), true);
        n.setPosition(spot.x + 78 * PU, spot.feetY - 210 * PU).setScale(PU);
        scene.tw({ targets: n, y: n.y - 90 * PU, alpha: 0, duration: 1400, ease: 'Sine.In' });
      });
    },
    // ---------------------------------------------------------------- 森林
    mushroom: function (scene, spot) {
      SoundFX.pop();
      scene.tw({ targets: scene.dollPivot, scaleY: 0.955, duration: 300, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll + 18 * PU, duration: 300, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
      const caps = [0xe4576f, 0xe4576f, 0xd88f28, 0xc9a8f0];
      for (let i = 0; i < 4; i += 1) {
        const r = 38 * PU * (i % 2 === 0 ? 1 : 0.76);
        const bx = spot.x + (i - 1.5) * 62 * PU;
        const by = spot.feetY + 4 * PU + (i % 2) * 12 * PU;
        const m = scene.addProp(scene.add.graphics(), true);
        drawMushroom(m, 0, 0, r, caps[i % 4]);
        m.setPosition(bx, by).setScale(0.15).setAlpha(0);
        scene.tw({ targets: m, scaleX: 1, scaleY: 1, alpha: 1, duration: 420, delay: 200 * i, ease: 'Back.Out' });
        scene.after(200 * i, function () { SoundFX.pick(); });
      }
      scene.after(1200, function () { scene.burst(spot.x, spot.feetY - 90 * PU, 8, [0xa6dfb4, 0xffffff], 80 * PU, 5 * PU, 0); });
    },
    deer: function (scene, spot) {
      const s = 92 * PU;
      const deer = scene.addProp(scene.add.graphics(), false);
      drawDeer(deer, 0, 0, s);
      deer.setPosition(spot.x - 430 * PU, spot.feetY + 4 * PU);
      scene.tw({ targets: deer, x: spot.x - 176 * PU, duration: 1300, ease: 'Sine.Out' });
      scene.tw({ targets: scene.dollPivot, rotation: 0.05, duration: 900, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll + 12 * PU, duration: 900, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
      scene.after(1300, function () { SoundFX.chime(); });
      for (let i = 0; i < 5; i += 1) {
        const h = scene.addProp(scene.add.circle(spot.x - 96 * PU + (i % 3) * 16 * PU, spot.feetY - 150 * PU - i * 24 * PU, 6 * PU, 0xff8fb3, 0.9), true);
        h.setScale(0.4);
        scene.tw({ targets: h, y: h.y - 90 * PU, alpha: 0, scaleX: 1.2, scaleY: 1.2, duration: 1600, delay: 1250 + i * 200, ease: 'Sine.Out' });
      }
      for (let i = 0; i < 4; i += 1) {
        const l = scene.addProp(scene.add.ellipse(spot.x - 40 * PU - i * 30 * PU, spot.feetY - 250 * PU, 14 * PU, 9 * PU, 0x8fd8a0, 0.9), true);
        scene.tw({ targets: l, y: l.y + 220 * PU, x: l.x + 46 * PU, rotation: 3, duration: 2200, delay: i * 320, repeat: 1, ease: 'Sine.In' });
      }
    },
    butterfly: function (scene, spot) {
      SoundFX.twinkle();
      const colors = [0xff8fb3, 0xffd75e, 0x8fd8ff, 0xc9a8f0];
      const cy = spot.feetY - 190 * PU;
      const orbitX = WIDTH / 2;
      for (let i = 0; i < 4; i += 1) {
        // wide enough to fly around her instead of sitting on her body
        const rx = (0.36 + i * 0.05) * WIDTH;
        const ry = rx * 0.42;
        const b = scene.addProp(makeButterfly.call(scene, colors[i]), true);
        // start every butterfly on its own corner of the circle, then orbit her with flapping wings
        const p = { a: i * (Math.PI / 2) + 0.5 };
        const place = function () {
          if (!b.active) return;
          b.x = orbitX + Math.cos(p.a) * rx;
          b.y = cy + Math.sin(p.a) * ry;
          b.scaleX = PU * 1.3 * (0.7 + 0.3 * Math.abs(Math.sin(p.a * 4)));
          b.scaleY = PU * 1.3;
        };
        place();
        scene.tw({ targets: p, a: p.a + Math.PI * 2, duration: 4200 + i * 520, repeat: -1, ease: 'Linear', onUpdate: place });
      }
      scene.tw({ targets: scene.dollPivot, rotation: 0.05, duration: 520, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
      scene.tw({ targets: scene.dollLayer, y: spot.feetY - DOLL_FEET * scene.scaleDoll - 28 * PU, duration: 520, yoyo: true, repeat: 3, ease: 'Sine.InOut' });
      for (let i = 0; i < 3; i += 1) {
        scene.after(420 + i * 720, function () { scene.burst(spot.x, cy - 30 * PU, 7, [0xfff0a0, 0xffffff], 90 * PU, 5 * PU, 0); });
      }
    },
  };

  const ICON_SHAPES = {
    top: [[-0.34, -0.5], [0.34, -0.5], [0.8, -0.16], [0.58, 0.1], [0.46, -0.02], [0.46, 0.56], [-0.46, 0.56], [-0.46, -0.02], [-0.58, 0.1], [-0.8, -0.16]],
    bottom: [[-0.42, -0.52], [0.42, -0.52], [0.56, 0.56], [0.16, 0.56], [0, 0.06], [-0.16, 0.56], [-0.56, 0.56]],
    shoes: [[-0.6, 0.34], [-0.52, -0.16], [-0.08, -0.34], [0.26, 0.0], [0.62, 0.14], [0.62, 0.34]],
    skirt: [[-0.42, -0.52], [0.42, -0.52], [0.9, 0.54], [-0.9, 0.54]],
  };

  function drawSlotIcon(g, slot, cx, cy, s, color) {
    if (slot === 'hat') {
      g.fillStyle(color, 1).fillEllipse(cx, cy + s * 0.42, s * 2.1, s * 0.52);
      g.fillEllipse(cx, cy - s * 0.12, s * 1.16, s * 1);
      return;
    }
    if (slot === 'hair') {
      g.fillStyle(color, 1);
      g.beginPath();
      g.arc(cx, cy - s * 0.08, s * 0.84, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.fillRoundedRect(cx - s * 0.86, cy - s * 0.14, s * 0.32, s * 1.02, s * 0.16);
      g.fillRoundedRect(cx + s * 0.54, cy - s * 0.14, s * 0.32, s * 1.02, s * 0.16);
      return;
    }
    if (slot === 'face') {
      g.fillStyle(color, 1);
      g.fillEllipse(cx - s * 0.46, cy + s * 0.14, s * 0.66, s * 0.86);
      g.fillEllipse(cx + s * 0.46, cy + s * 0.14, s * 0.66, s * 0.86);
      g.lineStyle(Math.max(2, s * 0.22), color, 1);
      g.beginPath();
      g.arc(cx - s * 0.46, cy - s * 0.16, s * 0.44, Math.PI * 1.18, Math.PI * 1.82, false);
      g.strokePath();
      g.beginPath();
      g.arc(cx + s * 0.46, cy - s * 0.16, s * 0.44, Math.PI * 1.18, Math.PI * 1.82, false);
      g.strokePath();
      return;
    }
    if (slot === 'accessory') {
      g.lineStyle(Math.max(2, s * 0.22), color, 1);
      g.beginPath();
      g.arc(cx, cy - s * 0.5, s * 0.72, Math.PI * 0.12, Math.PI * 0.88, false);
      g.strokePath();
      g.fillStyle(color, 1).fillCircle(cx, cy + s * 0.5, s * 0.3);
      return;
    }
    if (slot === 'glasses') {
      g.lineStyle(Math.max(2, s * 0.26), color, 1);
      g.strokeCircle(cx - s * 0.48, cy, s * 0.44);
      g.strokeCircle(cx + s * 0.48, cy, s * 0.44);
      g.lineBetween(cx - s * 0.12, cy - s * 0.06, cx + s * 0.12, cy - s * 0.06);
      return;
    }
    const shape = ICON_SHAPES[slot];
    if (!shape) return;
    g.fillStyle(color, 1);
    g.fillPoints(shape.map(function (pt) {
      return new Phaser.Geom.Point(cx + pt[0] * s, cy + pt[1] * s);
    }), true);
  }

  function drawSceneIcon(g, key, cx, cy, r) {
    if (key === 'beach') {
      g.fillStyle(0xffe08a, 1).fillCircle(cx + r * 0.4, cy - r * 0.44, r * 0.3);
      g.fillStyle(0x63c8f0, 1).fillRoundedRect(cx - r, cy - r * 0.06, r * 2, r * 0.52, r * 0.14);
      g.lineStyle(Math.max(2, r * 0.1), 0xffffff, 0.85);
      g.beginPath();
      g.arc(cx - r * 0.44, cy + r * 0.16, r * 0.2, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.beginPath();
      g.arc(cx + r * 0.4, cy + r * 0.16, r * 0.2, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.fillStyle(0xf3d49c, 1).fillRoundedRect(cx - r, cy + r * 0.42, r * 2, r * 0.44, r * 0.16);
      return;
    }
    if (key === 'palace') {
      g.fillStyle(0xf0d9f2, 1).fillRoundedRect(cx - r, cy + r * 0.52, r * 2, r * 0.34, r * 0.1);
      g.fillStyle(0xfdf7ff, 1).fillRect(cx - r * 0.9, cy - r * 0.34, r * 0.38, r * 0.86);
      g.fillRect(cx + r * 0.52, cy - r * 0.34, r * 0.38, r * 0.86);
      g.fillStyle(0xf7d98a, 1).fillRect(cx - r, cy - r * 0.46, r * 0.58, r * 0.18);
      g.fillRect(cx + r * 0.42, cy - r * 0.46, r * 0.58, r * 0.18);
      g.fillStyle(0xf7d98a, 1);
      g.beginPath();
      g.arc(cx, cy - r * 0.44, r * 0.52, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xffd75e, 1).fillCircle(cx, cy - r * 0.98, r * 0.13);
      return;
    }
    g.fillStyle(0x9bddaa, 1).fillRoundedRect(cx - r, cy + r * 0.36, r * 2, r * 0.5, r * 0.16);
    drawPineSimple(g, cx - r * 0.66, cy + r * 0.5, r * 1.55, 0x4fa877);
    drawPineSimple(g, cx + r * 0.64, cy + r * 0.5, r * 1.35, 0x5fb987);
    drawPineSimple(g, cx, cy + r * 0.68, r * 2.1, 0x3f9d6b);
  }

  class DressupSceneSelectScene extends Phaser.Scene {
    constructor() {
      super('DressupSceneSelectScene');
    }

    create() {
      this.shaking = false;
      const short = Math.min(WIDTH, HEIGHT);
      const g = this.add.graphics();
      g.fillStyle(0xfff0f7, 1).fillRect(0, 0, WIDTH, HEIGHT);
      g.fillStyle(0xffd9ec, 0.7).fillCircle(WIDTH * 0.08, HEIGHT * 0.06, short * 0.28);
      g.fillStyle(0xd8efff, 0.75).fillCircle(WIDTH * 0.96, HEIGHT * 0.96, short * 0.32);
      g.fillStyle(0xfff6c9, 0.7).fillCircle(WIDTH * 0.92, HEIGHT * 0.05, short * 0.2);

      this.add.text(WIDTH / 2, IS_PORTRAIT ? 104 : 64, '换装小公主', textStyle(IS_PORTRAIT ? 40 : 32, '#d0498f', true)).setOrigin(0.5);
      this.add.text(WIDTH / 2, IS_PORTRAIT ? 150 : 104, '先挑一个场景吧', textStyle(IS_PORTRAIT ? 18 : 16, '#a0708c')).setOrigin(0.5);

      const cards = IS_PORTRAIT
        ? { w: 440, h: 180, xs: [WIDTH / 2, WIDTH / 2, WIDTH / 2], ys: [300, 512, 724] }
        : { w: 268, h: 326, xs: [172, 480, 788], ys: [330, 330, 330] };
      SCENES_DATA.forEach((data, index) => {
        this.buildCard(data, cards.xs[index], cards.ys[index], cards.w, cards.h);
      });
    }

    buildCard(data, cx, cy, w, h) {
      const card = this.add.container(cx, cy);
      const g = this.add.graphics();
      g.fillStyle(0xfffdfe, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
      g.fillStyle(data.cardColor, 1).fillRoundedRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 22);
      g.lineStyle(5, data.accent, 0.55).strokeRoundedRect(-w / 2, -h / 2, w, h, 28);
      card.add(g);

      const icon = this.add.graphics();
      drawSceneIcon(icon, data.key, 0, IS_PORTRAIT ? -h * 0.245 : -h * 0.235, IS_PORTRAIT ? 46 : 42);
      if (!data.playable) icon.setAlpha(0.42);
      card.add(icon);

      const nameY = IS_PORTRAIT ? h * 0.14 : h * 0.13;
      const name = this.add.text(0, nameY, data.name, textStyle(IS_PORTRAIT ? 28 : 24, data.playable ? '#5b4152' : '#8d8296', true)).setOrigin(0.5);
      card.add(name);

      const pillW = IS_PORTRAIT ? 112 : 96;
      const pillH = IS_PORTRAIT ? 34 : 30;
      const pillTop = nameY + (IS_PORTRAIT ? 30 : 26);
      const pillG = this.add.graphics();
      pillG.fillStyle(data.playable ? 0x4de5bf : 0xc9bfd0, 1).fillRoundedRect(-pillW / 2, pillTop, pillW, pillH, pillH / 2);
      card.add(pillG);
      card.add(this.add.text(0, pillTop + pillH / 2, data.playable ? '可以玩' : '敬请期待', textStyle(IS_PORTRAIT ? 17 : 15, data.playable ? '#0f6b52' : '#6e6478', true)).setOrigin(0.5));

      const hit = this.add.rectangle(0, 0, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.tapCard(data, card));
      card.add(hit);
    }

    tapCard(data, card) {
      if (!data.playable) {
        SoundFX.denied();
        if (this.shaking) return;
        this.shaking = true;
        const baseX = card.x;
        this.tweens.add({
          targets: card,
          x: baseX - 9,
          duration: 55,
          yoyo: true,
          repeat: 3,
          ease: 'Sine.InOut',
          onComplete: () => {
            card.x = baseX;
            this.shaking = false;
          },
        });
        return;
      }
      SoundFX.pick();
      card.setScale(0.97);
      this.time.delayedCall(110, () => this.scene.start('DressupGameScene', { sceneKey: data.key }));
    }
  }

  class DressupGameScene extends Phaser.Scene {
    constructor() {
      super('DressupGameScene');
    }

    init(data) {
      this.sceneKey = (data && data.sceneKey) || 'beach';
      this.sceneInfo = SCENES_DATA.filter((item) => item.key === this.sceneKey)[0] || SCENES_DATA[0];
      this.equipped = {};
      this.thumbByKey = {};
      this.drag = null;
      this.trayOffset = 0;
      this.trayOffsetMax = 0;
      this.category = null;
      this.itemLayer = null;
      this.tabs = null;
      this.arrowLeft = null;
      this.arrowRight = null;
      this.loadQueue = [];
      this.loadBusy = false;
      this.pendingCategory = null;
      this.loadingTween = null;
    }

    preload() {
      const bodyMissing = !this.textures.exists('doll-body');
      const items = this.itemsFor(CATEGORIES[0].key);
      const missing = items.filter((item) => !this.textures.exists(item.key));
      if (!bodyMissing && !missing.length) return;
      const tip = this.add.text(WIDTH / 2, HEIGHT / 2, '加载中…', textStyle(IS_PORTRAIT ? 24 : 20, '#a0708c', true)).setOrigin(0.5);
      const barW = Math.min(WIDTH * 0.62, 460);
      const bar = this.add.graphics().setDepth(4);
      const drawBar = (progress) => {
        bar.clear();
        bar.fillStyle(0xffffff, 0.95).fillRoundedRect((WIDTH - barW) / 2, HEIGHT / 2 + 14, barW, 22, 11);
        bar.fillStyle(0xff8fb3, 1).fillRoundedRect((WIDTH - barW) / 2 + 3, HEIGHT / 2 + 17, Math.max(8, (barW - 6) * progress), 16, 8);
      };
      drawBar(0);
      this.load.on('progress', drawBar);
      this.load.once('complete', function () {
        tip.destroy();
        bar.destroy();
      });
      if (bodyMissing) this.load.svg('doll-body', DIR + 'body.svg', { width: DOLL_W, height: DOLL_H });
      missing.forEach((item) => this.queueSvg(item));
    }

    create() {
      const scaleDoll = LAYOUT.dollScale;
      this.scaleDoll = scaleDoll;
      this.dollLeft = Math.round((WIDTH - DOLL_W * scaleDoll) / 2);
      this.dollTop = Math.round(LAYOUT.dollFeetY - DOLL_FEET * scaleDoll);
      this.dollRect = {
        x: this.dollLeft,
        y: this.dollTop,
        w: DOLL_W * scaleDoll,
        h: DOLL_H * scaleDoll,
      };

      this.buildBackground();
      this.buildDoll();
      this.buildSpots();
      this.buildTray();
      this.buildTopButtons();
      this.bindInput();
      this.idleStart();
      SoundFX.enter();
    }

    buildBackground() {
      const g = this.add.graphics().setDepth(0);
      const painter = SCENE_PAINTERS[this.sceneKey] || drawBeach;
      painter(g);
      const info = this.sceneInfo;
      const titleStyle = textStyle(IS_PORTRAIT ? 22 : 19, info.ink, true);
      titleStyle.stroke = '#ffffff';
      titleStyle.strokeThickness = IS_PORTRAIT ? 5 : 4;
      const subStyle = textStyle(IS_PORTRAIT ? 14 : 13, info.inkSoft);
      subStyle.stroke = '#ffffff';
      subStyle.strokeThickness = 4;
      this.add.text(22, IS_PORTRAIT ? 68 : 60, info.name + '换装', titleStyle).setDepth(12).setOrigin(0, 0.5);
      this.add.text(22, IS_PORTRAIT ? 96 : 86, '点分类挑配件，拖到小姐姐身上', subStyle).setDepth(12).setOrigin(0, 0.5);
      this.add.text(22, IS_PORTRAIT ? 118 : 108, '点地上的光圈，她就去做那件事', subStyle).setDepth(12).setOrigin(0, 0.5);
    }

    buildDoll() {
      this.dollLayer = this.add.container(this.dollLeft, this.dollTop).setDepth(5).setScale(this.scaleDoll);
      // 脚下的小影子跟着小人一起走
      this.dollLayer.add(this.add.ellipse(300, 772, 190, 44, this.sceneInfo.shadow, 0.38));
      // dollPivot 的转轴在小人腰胯（600x900 坐标里的 300,470）：旋转、压扁都绕这里，
      // 所以做动作时头发/帽子/裙子/鞋都是跟着整个人一起动的
      this.dollPivot = this.add.container(300, 470);
      this.dollLayer.add(this.dollPivot);
      const inner = this.add.container(-300, -470);
      this.dollPivot.add(inner);
      this.backLayer = this.add.container(0, 0);
      inner.add(this.backLayer);
      // 整只小人可以被抱着走：按在她身上任何没穿配件的地方
      const grab = this.add.rectangle(300, 430, 320, 800, 0xffffff, 0);
      grab.setInteractive();
      grab.on('pointerdown', (pointer) => this.onGrabDoll(pointer));
      inner.add(grab);
      inner.add(this.add.image(0, 0, 'doll-body').setOrigin(0, 0));
      this.wornLayer = this.add.container(0, 0);
      inner.add(this.wornLayer);
    }

    // ================================================================ 过家家互动
    buildSpots() {
      this.anchor = (SCENE_ANCHORS[this.sceneKey] || SCENE_ANCHORS.beach)();
      this.propBack = this.add.graphics().setDepth(4);
      this.propFront = this.add.graphics().setDepth(6);
      this.propObjs = [];
      this.actionTweens = [];
      this.actionTimers = [];
      this.spotAt = null;
      this.actionAt = null;
      this.idleTween = null;
      this.walkMove = null;
      this.walkBob = null;
      this.dollHomeX = this.dollLeft;
      this.dollHomeY = this.dollTop;
      this.spots = (this.sceneInfo.spots || []).map((def) => {
        // keep every circle inside the band where the whole doll still fits on screen
        const halfDoll = (DOLL_W * this.scaleDoll) / 2;
        const spot = {
          def: def,
          x: Phaser.Math.Clamp(def.fx * WIDTH, halfDoll + 6, WIDTH - halfDoll - 6),
          feetY: this.fitFeetY(def.fy * TRAY_TOP),
        };
        spot.markerY = Math.min(spot.feetY, TRAY_TOP - 50 * PU);
        spot.container = this.buildSpotMarker(spot);
        return spot;
      });
      this.refreshSpotMarkers();
    }

    // 让小人始终完整留在画面里：脚不能高过头顶，也不能钻进配件栏
    fitFeetY(y) {
      const min = 12 + (DOLL_FEET - 62) * this.scaleDoll;
      return Phaser.Math.Clamp(y, min, TRAY_TOP - 48 * PU);
    }

    spotRadius() {
      return IS_PORTRAIT ? 40 : 30;
    }

    // tight hit test for the ground circles (looser nearestSpot is for dropping the doll)
    spotUnder(x, y) {
      const r = this.spotRadius() * 1.12;
      let best = null;
      let bestDist = 1e9;
      this.spots.forEach((spot) => {
        const d = Phaser.Math.Distance.Between(x, y, spot.x, spot.markerY);
        if (d <= r && d < bestDist) { best = spot; bestDist = d; }
      });
      return best;
    }

    buildSpotMarker(spot) {
      const r = this.spotRadius();
      const c = this.add.container(spot.x, spot.markerY).setDepth(4.6);
      const halo = this.add.graphics();
      halo.fillStyle(0xfff0f7, 0.42).fillCircle(0, 0, r * 1.24);
      halo.fillStyle(0xffffff, 0.72).fillCircle(0, 0, r);
      halo.lineStyle(5, 0xffb8d6, 0.95).strokeCircle(0, 0, r);
      c.add(halo);
      const icon = this.add.graphics();
      drawSpotIcon(icon, spot.def.icon, 0, -r * 0.2, r * 0.44, 0xff7fb8);
      c.add(icon);
      const label = this.add.text(0, r * 0.44, spot.def.label, textStyle(IS_PORTRAIT ? 14 : 11, '#9a4a74', true)).setOrigin(0.5);
      label.setStroke('#ffffff', 5);
      c.add(label);
      const hit = this.add.circle(0, 0, r, 0xffffff, 0);
      hit.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      hit.on('pointerdown', () => this.goSpot(spot));
      c.add(hit);
      this.tweens.add({ targets: c, scaleX: 1.08, scaleY: 1.08, duration: 950, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return c;
    }

    refreshSpotMarkers() {
      this.spots.forEach((spot) => spot.container.setAlpha(this.spotAt === spot ? 0.34 : 1));
    }

    dollPosFor(spot) {
      return {
        x: spot.x - 300 * this.scaleDoll,
        y: spot.feetY - DOLL_FEET * this.scaleDoll,
      };
    }

    clampDollX(x) {
      return Phaser.Math.Clamp(x, -110, WIDTH - DOLL_W * this.scaleDoll + 110);
    }

    clampDollY(y) {
      const minY = 12 + (DOLL_FEET - 62) * this.scaleDoll - DOLL_FEET * this.scaleDoll;
      return Phaser.Math.Clamp(y, minY, TRAY_TOP - 48 * PU - DOLL_FEET * this.scaleDoll);
    }

    nearestSpot(x, y) {
      let best = null;
      let bestDist = 1e9;
      this.spots.forEach((spot) => {
        const d = Math.min(
          Phaser.Math.Distance.Between(x, y, spot.x, spot.markerY),
          Phaser.Math.Distance.Between(x, y, spot.x, spot.feetY - 120 * PU)
        );
        if (d < 150 * PU && d < bestDist) {
          best = spot;
          bestDist = d;
        }
      });
      return best;
    }

    // 点光圈：小人整体走过去，到了就开始做那件事
    goSpot(spot) {
      if (this.drag) return;
      this.idleStop();
      this.walkStop();
      this.stopAction();
      this.spotAt = spot;
      this.refreshSpotMarkers();
      const to = this.dollPosFor(spot);
      const dist = Phaser.Math.Distance.Between(this.dollLayer.x, this.dollLayer.y, to.x, to.y);
      SoundFX.step();
      this.walkBob = this.tweens.add({ targets: this.dollPivot, scaleY: 0.985, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.walkMove = this.tweens.add({
        targets: this.dollLayer,
        x: to.x,
        y: to.y,
        duration: Phaser.Math.Clamp(dist * 1.3, 420, 1100),
        ease: 'Sine.InOut',
        onComplete: () => {
          this.walkStop();
          if (this.spotAt === spot) this.playAction(spot);
        },
      });
    }

    walkStop() {
      if (this.walkBob) { this.walkBob.stop(); this.walkBob = null; }
      if (this.walkMove) { this.walkMove.stop(); this.walkMove = null; }
    }

    playAction(spot) {
      this.clearProps();
      this.actionBaseX = this.dollLayer.x;
      this.actionBaseY = this.dollLayer.y;
      this.actionAt = spot;
      const fn = SPOT_ACTIONS[spot.def.action];
      if (fn) fn(this, spot);
    }

    // 点小人：她回到中间（换装的位置）
    homeDoll() {
      this.walkStop();
      this.stopAction();
      this.spotAt = null;
      this.refreshSpotMarkers();
      const dist = Phaser.Math.Distance.Between(this.dollLayer.x, this.dollLayer.y, this.dollHomeX, this.dollHomeY);
      if (dist < 4) {
        this.idleStart();
        return;
      }
      SoundFX.step();
      this.walkBob = this.tweens.add({ targets: this.dollPivot, scaleY: 0.985, duration: 130, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.walkMove = this.tweens.add({
        targets: this.dollLayer,
        x: this.dollHomeX,
        y: this.dollHomeY,
        duration: Phaser.Math.Clamp(dist * 1.1, 320, 900),
        ease: 'Sine.InOut',
        onComplete: () => {
          this.walkStop();
          this.idleStart();
        },
      });
    }

    // 抱起来：整只小人跟着手指走
    onGrabDoll(pointer) {
      if (this.drag) return;
      // the doll can stand on a circle and hide it: the circle wins the tap
      const onSpot = this.spotUnder(pointer.x, pointer.y);
      if (onSpot) {
        this.goSpot(onSpot);
        return;
      }
      this.idleStop();
      this.walkStop();
      this.stopAction();
      this.spotAt = null;
      this.refreshSpotMarkers();
      this.drag = {
        def: null,
        doll: true,
        moved: false,
        pointerId: pointer.id,
        mode: 'doll',
        startX: pointer.x,
        startY: pointer.y,
        baseX: this.dollLayer.x,
        baseY: this.dollLayer.y,
      };
      SoundFX.pick();
    }

    stopAction() {
      if (this.actionTimers) {
        this.actionTimers.forEach((timer) => timer.remove(false));
        this.actionTimers = [];
      }
      this.actionTweens.forEach((t) => t.stop());
      this.actionTweens = [];
      this.clearProps();
      this.dollPivot.setRotation(0);
      this.dollPivot.setScale(1);
      this.dollLayer.setScale(this.scaleDoll);
      this.actionAt = null;
    }

    clearProps() {
      if (!this.propObjs) return;
      this.propBack.clear();
      this.propBack.setPosition(0, 0);
      this.propFront.clear();
      this.propFront.setPosition(0, 0);
      this.propObjs.forEach((obj) => {
        this.tweens.killTweensOf(obj);
        obj.destroy();
      });
      this.propObjs = [];
    }

    addProp(obj, front) {
      obj.setDepth(front ? 6.4 : 4.4);
      this.propObjs.push(obj);
      return obj;
    }

    tw(cfg) {
      const tween = this.tweens.add(cfg);
      this.actionTweens.push(tween);
      return tween;
    }

    // 动作里的延时事件：动作一旦结束就不再执行（避免结束后又冒出一堆道具）
    after(ms, fn) {
      const spot = this.actionAt;
      const timer = this.time.delayedCall(ms, () => {
        if (spot && this.actionAt === spot) fn();
      });
      this.actionTimers.push(timer);
      return timer;
    }

    burst(x, y, count, colors, spread, size, drift) {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
        const dist = spread * (0.45 + Math.random() * 0.6);
        const dot = this.addProp(this.add.circle(x, y, size * (0.6 + Math.random() * 0.8), colors[i % colors.length], 0.95), true);
        this.tw({
          targets: dot,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist + (drift || 0),
          alpha: 0,
          scaleX: 0.3,
          scaleY: 0.3,
          duration: 700 + Math.random() * 450,
          ease: 'Cubic.Out',
        });
      }
    }

    idleStart() {
      this.idleStop();
      this.idleTween = this.tweens.add({
        targets: this.dollLayer,
        y: this.dollHomeY - 5,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    idleStop() {
      if (this.idleTween) {
        this.idleTween.stop();
        this.idleTween = null;
      }
    }

    buildTray() {
      const g = this.add.graphics().setDepth(20);
      g.fillStyle(0xffe6f2, 0.97).fillRoundedRect(0, TRAY_TOP - 10, WIDTH, LAYOUT.trayH + 10, { tl: 28, tr: 28, bl: 0, br: 0 });
      g.lineStyle(5, 0xffc0dd, 1).strokeRoundedRect(-2, TRAY_TOP - 10, WIDTH + 4, LAYOUT.trayH + 12, { tl: 28, tr: 28, bl: 0, br: 0 });

      this.itemTop = TRAY_TOP + (IS_PORTRAIT ? 58 : 50);
      const panTop = this.itemTop - 6;
      const panH = Math.max(28, HEIGHT - panTop);

      const panArea = this.add.rectangle(WIDTH / 2, panTop + panH / 2, WIDTH, panH, 0xffffff, 0).setDepth(20.5);
      panArea.setInteractive();
      panArea.on('pointerdown', (pointer) => this.onGrab(null, pointer, false));

      this.trayContent = this.add.container(0, 0).setDepth(21);
      const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
      maskShape.fillStyle(0xffffff, 1).fillRect(0, panTop, WIDTH, panH);
      this.trayContent.setMask(maskShape.createGeometryMask());

      this.buildTabs();
      this.buildArrows();
      this.setCategory(CATEGORIES[0].key);
    }

    buildTabs() {
      const tabH = LAYOUT.tabH;
      const gap = LAYOUT.tabGap;
      const count = CATEGORIES.length;
      const tabW = Math.min(IS_PORTRAIT ? 70 : 112, Math.floor((WIDTH - 20 - (count - 1) * gap) / count));
      const totalW = count * tabW + (count - 1) * gap;
      const startX = Math.round((WIDTH - totalW) / 2);
      const top = TRAY_TOP + (IS_PORTRAIT ? 8 : 6);
      const tight = count >= 8;
      const iconSize = tabH * (tight ? 0.26 : 0.3);
      const iconGap = tight ? 3 : 4;
      this.tabs = {};
      CATEGORIES.forEach((cat, index) => {
        const cx = startX + index * (tabW + gap) + tabW / 2;
        const cy = top + tabH / 2;
        const btn = this.add.container(cx, cy).setDepth(22);
        const bg = this.add.graphics();
        btn.add(bg);
        const icon = this.add.graphics();
        btn.add(icon);
        const label = this.add.text(0, 0, cat.label, textStyle(tight ? 11.5 : 13, '#9a6b84', true)).setOrigin(0, 0.5);
        btn.add(label);
        const dot = this.add.graphics();
        btn.add(dot);
        const contentW = iconSize * 2 + iconGap + label.width;
        const iconX = -contentW / 2 + iconSize;
        label.x = iconX + iconSize + iconGap;
        const hit = this.add.rectangle(0, 0, tabW, tabH, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.setCategory(cat.key));
        btn.add(hit);
        this.tabs[cat.key] = { bg: bg, icon: icon, label: label, dot: dot, iconX: iconX, w: tabW, h: tabH, iconS: iconSize };
      });
    }

    setCategory(key) {
      if (this.category === key && !this.pendingCategory) return;
      const items = this.itemsFor(key);
      if (!this.texturesReady(items)) {
        this.pendingCategory = key;
        this.showTrayLoading(key);
        this.queueItems(items, () => {
          if (this.pendingCategory !== key || !this.scene.isActive()) return;
          this.pendingCategory = null;
          this.category = null;
          this.setCategory(key);
        });
        return;
      }
      this.pendingCategory = null;
      if (this.loadingTween) {
        this.loadingTween.stop();
        this.loadingTween = null;
      }
      this.category = key;
      this.trayOffset = 0;
      this.trayOffsetMax = 0;
      if (this.trayContent) this.trayContent.x = 0;
      if (this.itemLayer) this.itemLayer.destroy(true);
      this.itemLayer = this.add.container(0, 0);
      this.trayContent.add(this.itemLayer);
      this.thumbByKey = {};
      const step = LAYOUT.slotW + LAYOUT.gap;
      const totalW = items.length * step - LAYOUT.gap;
      const pad = IS_PORTRAIT ? 16 : 24;
      const startX = totalW + pad * 2 <= WIDTH ? Math.round((WIDTH - totalW) / 2) : pad;
      const slotY = this.itemTop;
      items.forEach((def, index) => {
        def.slotX = startX + index * step;
        def.slotCenterX = def.slotX + LAYOUT.slotW / 2;
        def.slotCenterY = slotY + LAYOUT.slotH / 2;
        const plate = this.add.graphics();
        plate.fillStyle(0xffffff, 0.9).fillRoundedRect(def.slotX, slotY, LAYOUT.slotW, LAYOUT.slotH, 18);
        plate.lineStyle(3, 0xffc9e0, 1).strokeRoundedRect(def.slotX, slotY, LAYOUT.slotW, LAYOUT.slotH, 18);
        this.itemLayer.add(plate);

        const fit = Math.min((LAYOUT.slotW - 14) / def.box.w, (LAYOUT.slotH - 18) / def.box.h) / TEX_SCALE;
        def.thumbScale = fit;
        const img = this.add.image(def.slotCenterX, def.slotCenterY, def.key).setOrigin(0.5).setScale(fit);
        this.makeGrabbable(img, def, false);
        this.itemLayer.add(img);
        this.thumbByKey[def.key] = img;
      });

      this.currentItems = items;
      this.trayOffsetMax = Math.max(0, totalW + pad * 2 - WIDTH);
      this.refreshTabs();
      this.refreshArrows();
      this.refreshWornMarks();
      this.prefetchNext(key);
    }

    itemsFor(catKey) {
      return ITEMS.filter((item) => itemCat(item) === catKey && (!item.scene || item.scene === this.sceneKey));
    }

    texturesReady(items) {
      return items.every((item) => this.textures.exists(item.key));
    }

    queueSvg(item) {
      this.load.svg(item.key, DIR + item.key + '.svg', {
        width: Math.round(item.box.w * TEX_SCALE),
        height: Math.round(item.box.h * TEX_SCALE),
      });
    }

    // one category at a time: a slow decoration never blocks the next tap
    queueItems(items, onDone) {
      this.loadQueue.push({ items: items, onDone: onDone });
      this.runLoadQueue();
    }

    runLoadQueue() {
      if (this.loadBusy || !this.loadQueue.length) return;
      const job = this.loadQueue[0];
      const missing = job.items.filter((item) => !this.textures.exists(item.key));
      this.loadBusy = true;
      const finish = () => {
        this.loadBusy = false;
        this.loadQueue.shift();
        if (job.onDone) job.onDone();
        this.runLoadQueue();
      };
      if (!missing.length) {
        finish();
        return;
      }
      missing.forEach((item) => this.queueSvg(item));
      this.load.once('complete', finish);
      this.load.start();
    }

    showTrayLoading(key) {
      if (this.loadingTween) {
        this.loadingTween.stop();
        this.loadingTween = null;
      }
      this.category = key;
      this.trayOffset = 0;
      this.trayOffsetMax = 0;
      if (this.trayContent) this.trayContent.x = 0;
      if (this.itemLayer) this.itemLayer.destroy(true);
      this.itemLayer = this.add.container(0, 0);
      this.trayContent.add(this.itemLayer);
      this.thumbByKey = {};
      this.currentItems = [];
      const label = this.add.text(WIDTH / 2, this.itemTop + LAYOUT.slotH / 2, '加载中…', textStyle(IS_PORTRAIT ? 17 : 15, '#b07b98', true)).setOrigin(0.5);
      this.itemLayer.add(label);
      this.loadingTween = this.tweens.add({ targets: label, alpha: 0.3, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.refreshTabs();
      this.refreshArrows();
    }

    // warm up the next category so the next tap feels instant
    prefetchNext(key) {
      const index = CATEGORIES.map((cat) => cat.key).indexOf(key);
      if (index < 0) return;
      const next = CATEGORIES[(index + 1) % CATEGORIES.length];
      const items = this.itemsFor(next.key);
      if (this.texturesReady(items)) return;
      this.time.delayedCall(1800, () => {
        if (this.drag || !this.scene.isActive()) return;
        this.queueItems(items, null);
      });
    }

    refreshWornMarks() {
      Object.keys(this.thumbByKey).forEach((key) => {
        const worn = Object.keys(this.equipped).some((slot) => this.equipped[slot].key === key);
        this.thumbByKey[key].setAlpha(worn ? 0.32 : 1);
      });
      this.refreshTabDots();
    }

    refreshTabDots() {
      if (!this.tabs) return;
      CATEGORIES.forEach((cat) => {
        const tab = this.tabs[cat.key];
        if (!tab) return;
        tab.dot.clear();
        const worn = Object.keys(this.equipped).some((slot) => itemCat(this.equipped[slot].def) === cat.key);
        if (worn) {
          tab.dot.fillStyle(0xffd75e, 1).fillCircle(tab.w / 2 - 9, -tab.h / 2 + 8, 5);
          tab.dot.lineStyle(2, 0xffffff, 1).strokeCircle(tab.w / 2 - 9, -tab.h / 2 + 8, 5);
        }
      });
    }

    refreshTabs() {
      if (!this.tabs) return;
      CATEGORIES.forEach((cat) => {
        const tab = this.tabs[cat.key];
        if (!tab) return;
        const active = cat.key === this.category;
        tab.bg.clear();
        tab.bg.fillStyle(active ? 0xff8fb3 : 0xffffff, active ? 1 : 0.92);
        tab.bg.fillRoundedRect(-tab.w / 2, -tab.h / 2, tab.w, tab.h, tab.h / 2);
        if (!active) {
          tab.bg.lineStyle(3, 0xffc9e0, 1);
          tab.bg.strokeRoundedRect(-tab.w / 2, -tab.h / 2, tab.w, tab.h, tab.h / 2);
        }
        tab.label.setColor(active ? '#ffffff' : '#9a6b84');
        tab.icon.clear();
        drawSlotIcon(tab.icon, cat.key, tab.iconX, 0, tab.iconS, active ? 0xffffff : 0xff9ecb);
      });
    }

    buildArrows() {
      this.arrowLeft = this.buildArrow(-1, LAYOUT.arrowR + 6);
      this.arrowRight = this.buildArrow(1, WIDTH - LAYOUT.arrowR - 6);
      this.refreshArrows();
    }

    refreshArrows() {
      const show = this.trayOffsetMax > 0.5;
      [this.arrowLeft, this.arrowRight].forEach((arrow) => {
        if (!arrow) return;
        arrow.container.setVisible(show);
        if (show) arrow.hit.setInteractive(new Phaser.Geom.Circle(LAYOUT.arrowR, LAYOUT.arrowR, LAYOUT.arrowR), Phaser.Geom.Circle.Contains);
        else arrow.hit.disableInteractive();
      });
    }

    buildArrow(dir, cx) {
      const cy = TRAY_TOP + LAYOUT.trayH / 2;
      const r = LAYOUT.arrowR;
      const btn = this.add.container(cx, cy).setDepth(22);
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 0.95).fillCircle(0, 0, r);
      g.lineStyle(3, 0xffb8d6, 1).strokeCircle(0, 0, r);
      btn.add(g);
      btn.add(this.add.triangle(
        0, 0,
        dir < 0 ? r * 0.42 : -r * 0.42, -r * 0.46,
        dir < 0 ? -r * 0.36 : r * 0.36, 0,
        dir < 0 ? r * 0.42 : -r * 0.42, r * 0.46,
        0xff7fb8
      ));
      const hit = this.add.circle(0, 0, r, 0xffffff, 0);
      hit.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      btn.add(hit);

      const stepScroll = () => this.scrollBy((LAYOUT.slotW + LAYOUT.gap) * dir);
      let timer = null;
      const stop = () => {
        if (timer) {
          timer.remove();
          timer = null;
        }
      };
      hit.on('pointerdown', () => {
        stepScroll();
        stop();
        timer = this.time.addEvent({ delay: 320, loop: true, callback: stepScroll });
      });
      hit.on('pointerup', stop);
      hit.on('pointerout', stop);
      hit.on('pointerupoutside', stop);
      return { container: btn, hit: hit };
    }

    makeGrabbable(img, def, fromWorn) {
      const box = def.box;
      const area = new Phaser.Geom.Rectangle(0, 0, box.w * TEX_SCALE, box.h * TEX_SCALE);
      let callback = Phaser.Geom.Rectangle.Contains;
      if (fromWorn && def.hit) {
        const rects = def.hit.map((r) => new Phaser.Geom.Rectangle(
          (r.x - box.x) * TEX_SCALE, (r.y - box.y) * TEX_SCALE, r.w * TEX_SCALE, r.h * TEX_SCALE
        ));
        callback = function (hitArea, x, y) {
          return rects.some((r) => Phaser.Geom.Rectangle.Contains(r, x, y));
        };
      }
      img.setInteractive(area, callback);
      img.on('pointerdown', (pointer) => this.onGrab(def, pointer, fromWorn));
      return img;
    }

    buildTopButtons() {
      const r = IS_PORTRAIT ? 32 : 28;
      const margin = IS_PORTRAIT ? 48 : 42;
      this.buildRoundButton(WIDTH - margin, margin, r, 0xff8fb3, '#ffffff', '全部\n脱下', () => this.clearAll());
      this.buildRoundButton(WIDTH - margin, margin + r * 2 + 16, r * 0.84, 0xbfe6ff, '#2f6f9d', '换\n场景', () => this.scene.start('DressupSceneSelectScene'));
    }

    buildRoundButton(cx, cy, r, fillColor, textColor, label, onClick) {
      const btn = this.add.container(cx, cy).setDepth(22);
      const g = this.add.graphics();
      g.fillStyle(fillColor, 1).fillCircle(0, 0, r);
      g.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, r);
      btn.add(g);
      btn.add(this.add.text(0, 0, label, textStyle(Math.round(r * 0.46), textColor, true, 0)).setOrigin(0.5));
      const hit = this.add.circle(0, 0, r, 0xffffff, 0);
      hit.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      hit.on('pointerdown', () => onClick());
      btn.add(hit);
    }

    bindInput() {
      this.input.on('pointermove', (pointer) => this.onPointerMove(pointer));
      this.input.on('pointerup', (pointer) => this.onPointerUp(pointer));
      this.input.on('pointerupoutside', (pointer) => this.onPointerUp(pointer));
    }

    onGrab(def, pointer, fromWorn) {
      if (this.drag) return;
      const worn = fromWorn && def ? this.equipped[def.slot] : null;
      if (fromWorn && !worn) return;
      this.drag = {
        def: def,
        pointerId: pointer.id,
        mode: 'decide',
        fromWorn: !!fromWorn,
        wornImage: worn ? worn.image : null,
        startX: pointer.x,
        startY: pointer.y,
        startTrayOffset: this.trayOffset,
        ghost: null,
      };
    }

    onPointerMove(pointer) {
      const d = this.drag;
      if (!d || pointer.id !== d.pointerId) return;
      if (d.doll) {
        if (Math.abs(pointer.x - d.startX) > 7 || Math.abs(pointer.y - d.startY) > 7) d.moved = true;
        this.dollLayer.setPosition(
          this.clampDollX(d.baseX + pointer.x - d.startX),
          this.clampDollY(d.baseY + pointer.y - d.startY)
        );
        return;
      }
      const dx = pointer.x - d.startX;
      const dy = pointer.y - d.startY;
      if (d.mode === 'decide') {
        if (!d.def) {
          if (Math.abs(dx) > 3) d.mode = 'scroll';
        } else if (d.fromWorn) {
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) this.beginPickup(d, pointer);
        } else if (dy < -LAYOUT.pickThreshold) {
          this.beginPickup(d, pointer);
        } else if (dy < -8 && Math.abs(dy) > Math.abs(dx) * 0.5) {
          d.mode = 'decide';
        } else if (Math.abs(dx) > 6) {
          d.mode = 'scroll';
        }
      }
      if (d.mode === 'pickup') this.moveGhost(d, pointer);
      else if (d.mode === 'scroll') this.setTrayOffset(d.startTrayOffset - dx);
    }

    beginPickup(d, pointer) {
      d.mode = 'pickup';
      const scale = (this.scaleDoll * 1.15) / TEX_SCALE;
      const ghost = this.add.image(0, 0, d.def.key).setOrigin(0.5).setScale(scale).setDepth(30);
      d.ghost = { image: ghost, scale: scale };
      if (d.wornImage) d.wornImage.setVisible(false);
      else this.setThumbDim(d.def.key, true);
      SoundFX.pick();
      this.moveGhost(d, pointer);
    }

    moveGhost(d, pointer) {
      const g = d.ghost;
      if (!g) return;
      g.image.x = pointer.x;
      g.image.y = pointer.y - LAYOUT.lift;
    }

    onPointerUp(pointer) {
      const d = this.drag;
      if (!d || pointer.id !== d.pointerId) return;
      this.drag = null;
      if (d.doll) {
        if (!d.moved) {
          this.homeDoll();
        } else {
          const spot = this.nearestSpot(pointer.x, pointer.y);
          if (spot) this.goSpot(spot);
        }
        return;
      }
      if (d.mode === 'scroll') {
        this.setTrayOffset(Math.round(this.trayOffset));
        return;
      }
      if (d.mode !== 'pickup') return;
      const overDoll = this.isOverDoll(pointer.x, pointer.y);
      const ghost = d.ghost;
      if (ghost) ghost.image.destroy();
      if (overDoll) {
        if (d.fromWorn) {
          d.wornImage.setVisible(true);
          this.popImage(d.wornImage);
          SoundFX.wear();
        } else {
          this.equip(d.def);
        }
      } else if (d.fromWorn) {
        this.destroyWorn(d.def.slot);
        SoundFX.remove();
      } else {
        this.flyBackToTray(d, ghost);
      }
    }

    isOverDoll(x, y) {
      const r = this.dollRect;
      const pad = LAYOUT.dropPad;
      // also accept a drop where she is standing right now, not only at her home spot
      const ox = this.dollLayer ? this.dollLayer.x - this.dollLeft : 0;
      const oy = this.dollLayer ? this.dollLayer.y - this.dollTop : 0;
      if (this.inDollRect(x, y, r.x + ox, r.y + oy, r.w, r.h, pad)) return true;
      return this.inDollRect(x, y, r.x, r.y, r.w, r.h, pad);
    }

    inDollRect(x, y, rx, ry, rw, rh, pad) {
      const left = Math.max(0, rx - pad);
      const right = Math.min(WIDTH, rx + rw + pad);
      const top = Math.max(0, ry - pad);
      const bottom = Math.min(TRAY_TOP - 6, ry + rh + pad);
      return x >= left && x <= right && y >= top && y <= bottom;
    }

    // 连衣裙是一整套：穿上它就把上衣收起来，反过来穿上衣也会把连衣裙收起来
    coveredSlots(def) {
      const out = [];
      (PIECE_COVERS[def.piece] || []).forEach((slot) => {
        if (slot !== def.slot && this.equipped[slot]) out.push(slot);
      });
      Object.keys(this.equipped).forEach((slot) => {
        if (slot === def.slot) return;
        const other = this.equipped[slot].def;
        if (other && (PIECE_COVERS[other.piece] || []).indexOf(def.slot) >= 0) out.push(slot);
      });
      return out;
    }

    equip(def) {
      const slot = def.slot;
      const prev = this.equipped[slot];
      if (prev && prev.key === def.key) {
        this.popImage(prev.image);
        SoundFX.wear();
        return;
      }
      let replaced = false;
      if (prev) {
        this.destroyWorn(slot);
        replaced = true;
      }
      this.coveredSlots(def).forEach((covered) => {
        this.destroyWorn(covered);
        replaced = true;
      });
      const box = def.box;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const base = 1 / TEX_SCALE;
      const img = this.add.image(cx, cy, def.key).setOrigin(0.5);
      img.setDepth(def.depth === undefined ? SLOT_DEPTH[slot] : def.depth);
      img.setScale(base * 0.9).setAlpha(0.7);
      this.makeGrabbable(img, def, true);
      const layer = SLOT_BEHIND[slot] ? this.backLayer : this.wornLayer;
      layer.add(img);
      layer.sort('depth');
      this.equipped[slot] = { key: def.key, def: def, image: img };
      this.tweens.add({ targets: img, scaleX: base, scaleY: base, alpha: 1, duration: 280, ease: 'Back.Out' });
      this.setThumbDim(def.key, true);
      this.sparkle(cx, cy);
      SoundFX[replaced ? 'swap' : 'wear']();
    }

    destroyWorn(slot) {
      const cur = this.equipped[slot];
      if (!cur) return;
      delete this.equipped[slot];
      this.setThumbDim(cur.key, false);
      const img = cur.image;
      img.disableInteractive();
      this.tweens.add({
        targets: img,
        alpha: 0,
        scaleX: img.scaleX * 0.78,
        scaleY: img.scaleY * 0.78,
        duration: 190,
        ease: 'Sine.In',
        onComplete: () => img.destroy(),
      });
    }

    popImage(img) {
      const base = 1 / TEX_SCALE;
      this.tweens.add({ targets: img, scaleX: base * 1.08, scaleY: base * 1.08, duration: 110, yoyo: true, ease: 'Sine.InOut' });
    }

    setThumbDim(key, dim) {
      const thumb = this.thumbByKey[key];
      if (thumb) thumb.setAlpha(dim ? 0.32 : 1);
      this.refreshTabDots();
    }

    sparkle(dollX, dollY) {
      const cx = this.dollLayer.x + dollX * this.scaleDoll;
      const cy = this.dollLayer.y + dollY * this.scaleDoll;
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
        const dist = 42 + Math.random() * 26;
        const star = this.add.circle(cx, cy, 5 + Math.random() * 3, i % 2 === 0 ? 0xfff08a : 0xffffff, 0.95).setDepth(31);
        this.tweens.add({
          targets: star,
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          alpha: 0,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 440,
          ease: 'Cubic.Out',
          onComplete: () => star.destroy(),
        });
      }
    }

    flyBackToTray(d, ghost) {
      const def = d.def;
      const fit = def.thumbScale;
      const targetCenterX = def.slotCenterX - this.trayOffset;
      const targetCenterY = def.slotCenterY;
      const img = this.add.image(0, 0, def.key).setOrigin(0.5).setDepth(31);
      img.setScale(ghost ? ghost.scale : fit);
      img.setPosition(ghost ? ghost.image.x : targetCenterX, ghost ? ghost.image.y : targetCenterY);
      this.tweens.add({
        targets: img,
        scaleX: fit,
        scaleY: fit,
        x: targetCenterX,
        y: targetCenterY,
        duration: 260,
        ease: 'Cubic.In',
        onComplete: () => {
          img.destroy();
          this.setThumbDim(def.key, false);
        },
      });
      SoundFX.remove();
    }

    clearAll() {
      const slots = Object.keys(this.equipped);
      if (!slots.length) {
        SoundFX.denied();
        return;
      }
      SoundFX.clearAll();
      slots.forEach((slot, index) => {
        this.time.delayedCall(index * 70, () => this.destroyWorn(slot));
      });
    }

    scrollBy(delta) {
      this.setTrayOffset(this.trayOffset + delta);
    }

    setTrayOffset(value) {
      this.trayOffset = Phaser.Math.Clamp(value, 0, this.trayOffsetMax);
      this.trayContent.x = -this.trayOffset;
    }
  }

  window.DressupSceneSelectScene = DressupSceneSelectScene;
  window.DressupGameScene = DressupGameScene;
})();