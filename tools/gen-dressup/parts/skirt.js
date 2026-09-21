'use strict';
const G = require('../geom');

const ARM_L = 'M242 330 C228 372 222 420 224 468 C225 498 226 520 228 538';
const ARM_R = 'M358 330 C372 372 378 420 376 468 C375 498 374 520 372 538';

function bareArms() {
  return [
    G.S(ARM_L, '#e9ab7e', 40), G.S(ARM_L, G.SKIN, 32),
    G.S(ARM_R, '#e9ab7e', 40), G.S(ARM_R, G.SKIN, 32),
  ];
}

function bodice(fill, line, kind) {
  const out = [];
  const s = kind ? G.SLEEVE[kind] : null;
  if (s) {
    out.push(G.S(s.l, line, s.w + 12), G.S(s.r, line, s.w + 12), G.S(s.l, fill, s.w), G.S(s.r, fill, s.w));
  }
  out.push(G.F(G.TORSO, fill, { stroke: line, 'stroke-width': 6, 'stroke-linejoin': 'round' }));
  return out;
}

function skirtShape(topY, botY, ht, hb, fill, line, sag) {
  const s = sag === undefined ? 18 : sag;
  return G.F('M' + (300 - ht) + ' ' + topY
    + ' C' + (300 - ht - 12) + ' ' + (topY + 30) + ' ' + (300 - hb) + ' ' + (botY - 50) + ' ' + (300 - hb) + ' ' + botY
    + ' C' + (300 - hb * 0.5) + ' ' + (botY + s) + ' ' + (300 + hb * 0.5) + ' ' + (botY + s) + ' ' + (300 + hb) + ' ' + botY
    + ' C' + (300 + hb) + ' ' + (botY - 50) + ' ' + (300 + ht + 12) + ' ' + (topY + 30) + ' ' + (300 + ht) + ' ' + topY + ' Z',
    fill, { stroke: line, 'stroke-width': 6, 'stroke-linejoin': 'round' });
}

function waistband(y, halfW, fill, line) {
  return G.F('M' + (300 - halfW) + ' ' + y + ' L' + (300 + halfW) + ' ' + y + ' L' + (300 + halfW + 2) + ' ' + (y + 26)
    + ' L' + (300 - halfW - 2) + ' ' + (y + 26) + ' Z', fill, { stroke: line, 'stroke-width': 5, 'stroke-linejoin': 'round' });
}

function flower(cx, cy, r, color, center) {
  const petals = [];
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    petals.push(G.circle(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.44, color));
  }
  petals.push(G.circle(cx, cy, r * 0.36, center));
  return G.group({}, petals);
}

function tier(y, hb, fill, line) {
  return G.F('M' + (300 - hb) + ' ' + y + ' C' + (300 - hb * 0.5) + ' ' + (y + 14) + ' ' + (300 + hb * 0.5) + ' ' + (y + 14) + ' ' + (300 + hb) + ' ' + y
    + ' L' + (300 + hb + 10) + ' ' + (y + 46) + ' C' + (300 + hb * 0.5) + ' ' + (y + 62) + ' ' + (300 - hb * 0.5) + ' ' + (y + 62) + ' ' + (300 - hb - 10) + ' ' + (y + 46) + ' Z',
    fill, { stroke: line, 'stroke-width': 5, 'stroke-linejoin': 'round' });
}

module.exports = [
  { key: 'bottom-skirt', slot: 'skirt', label: '短裙', legacy: true },
  { key: 'dress-princess', slot: 'skirt', label: '公主裙', legacy: true },
  { key: 'dress-tutu', slot: 'skirt', label: '芭蕾蓬蓬裙', legacy: true },
  {
    key: 'skirt-pleated', slot: 'skirt', label: '百褶裙',
    art: () => [
      skirtShape(470, 584, 52, 112, '#5b8fdc', '#3f6fbd', 20),
      waistband(462, 54, '#3f6fbd', '#2f5aa0'),
      (function () {
        const out = [];
        for (let i = -4; i <= 4; i += 1) out.push(G.S('M' + (300 + i * 13) + ' 478 L' + (300 + i * 26) + ' 590', '#3f6fbd', 5, { opacity: 0.55 }));
        return G.group({}, out);
      })(),
    ],
  },
  {
    key: 'skirt-denim', slot: 'skirt', label: '牛仔裙',
    art: () => [
      skirtShape(468, 570, 50, 100, '#6f9fe0', '#3f6fbd', 22),
      waistband(460, 52, '#5b8fdc', '#3f6fbd'),
      G.S('M240 484 L266 484 M334 484 L360 484', '#ffe9a0', 5),
      G.S('M228 512 L250 552 M372 512 L350 552', '#ffe9a0', 5, { opacity: 0.8 }),
      G.rect(258, 494, 30, 26, '#5b8fdc', { rx: 4, stroke: '#3f6fbd', 'stroke-width': 4 }),
    ],
  },
  {
    key: 'skirt-layered', slot: 'skirt', label: '蛋糕裙',
    art: () => [
      skirtShape(466, 528, 52, 86, '#ffd6ef', '#e0a8c8', 16),
      tier(520, 94, '#ffe3f2', '#e0a8c8'),
      tier(560, 106, '#ffd6ef', '#e0a8c8'),
      waistband(458, 54, '#ffc2de', '#e0689f'),
    ],
  },
  {
    key: 'skirt-long', slot: 'skirt', label: '长裙',
    art: () => [
      skirtShape(468, 664, 50, 122, '#9be0c4', '#5fb99a', 26),
      waistband(460, 52, '#7fd0b0', '#4fa88a'),
      flower(268, 560, 16, '#ffffff', '#ffd75e'), flower(332, 600, 14, '#ffffff', '#ffd75e'),
      flower(300, 640, 16, '#ffffff', '#ffd75e'), flower(250, 626, 12, '#ffffff', '#ffd75e'),
    ],
  },
  {
    key: 'dress-sundress', slot: 'skirt', piece: 'one', label: '吊带连衣裙',
    art: () => bareArms().concat(bodice('#fff2a8', '#dfae3c', null), [
      skirtShape(466, 592, 52, 118, '#ffe08a', '#dfae3c', 22),
      G.S('M266 300 Q300 326 334 300', '#dfae3c', 6),
      G.S('M268 302 L262 470 M332 302 L338 470', '#ffe08a', 14),
      G.S('M268 302 L262 470 M332 302 L338 470', '#dfae3c', 5),
      waistband(458, 54, '#ff9ecb', '#e0689f'),
      G.F(G.heartPath(300, 520, 12), '#ff9ecb'), G.F(G.heartPath(268, 556, 10), '#ff9ecb'), G.F(G.heartPath(334, 548, 10), '#ff9ecb'),
    ]),
  },
  {
    key: 'dress-mermaid', slot: 'skirt', piece: 'one', label: '美人鱼裙',
    art: () => bodice('#7fd8e0', '#3fa8b8', 'short').concat([
      G.F('M256 490 C256 520 254 546 250 566 C246 600 220 630 204 654 C240 676 360 676 396 654 C380 630 354 600 350 566 C346 546 344 520 344 490 Z', '#9fe8ee', { stroke: '#3fa8b8', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M262 540 C280 552 320 552 338 540', '#3fa8b8', 5, { opacity: 0.6 }),
      G.S('M250 590 C280 604 320 604 350 590', '#3fa8b8', 5, { opacity: 0.6 }),
      G.S('M230 636 C270 650 330 650 370 636', '#3fa8b8', 5, { opacity: 0.6 }),
      G.F(G.starPath(300, 620, 16), '#ffffff'), G.F(G.starPath(258, 600, 11), '#ffffff'),
      G.S('M264 476 C286 466 314 466 336 476', '#3fa8b8', 5),
    ]),
  },
  {
    key: 'dress-pinafore', slot: 'skirt', depth: 3.2, label: '背带裙',
    art: () => [
      skirtShape(472, 578, 56, 108, '#ff8fb3', '#d0689f', 20),
      G.F('M266 462 L334 462 L334 500 L266 500 Z', '#ffb8d4', { stroke: '#d0689f', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M272 466 L262 404 M328 466 L338 404', '#d0689f', 10),
      G.circle(268, 470, 6, '#ffd75e'), G.circle(332, 470, 6, '#ffd75e'),
      G.F(G.heartPath(300, 482, 12), '#ffd75e'),
      G.S('M246 520 L354 520', '#d0689f', 5, { opacity: 0.5 }),
    ],
  },
  {
    key: 'dress-party', slot: 'skirt', piece: 'one', label: '亮片礼服',
    art: () => bodice('#c9a8f0', '#8f6bd8', 'puff').concat([
      skirtShape(468, 646, 52, 128, '#d8bff8', '#8f6bd8', 26),
      (function () {
        const s = [];
        for (let y = 500; y < 640; y += 34) {
          for (let x = 230; x < 372; x += 30) s.push(G.circle(x + ((y / 34) % 2) * 14, y, 4, '#ffffff', { opacity: 0.85 }));
        }
        return G.group({}, s);
      })(),
      waistband(458, 54, '#ffd75e', '#dfae3c'),
      G.F(G.starPath(300, 400, 20), '#ffffff'),
    ]),
  },
  {
    key: 'dress-lace', slot: 'skirt', piece: 'one', label: '蕾丝长裙',
    art: () => bodice('#ffffff', '#e0c9e8', 'short').concat([
      skirtShape(468, 660, 52, 120, '#fff2f9', '#e0a8c8', 24),
      (function () {
        const s = [];
        for (let i = 0; i <= 8; i += 1) s.push(G.circle(300 - 120 + i * 30, 668, 16, '#fff2f9', { stroke: '#e0a8c8', 'stroke-width': 4 }));
        return G.group({}, s);
      })(),
      G.S('M262 500 C282 512 320 512 340 500', '#e0a8c8', 5, { opacity: 0.6 }),
      G.S('M254 572 C280 586 322 586 348 572', '#e0a8c8', 5, { opacity: 0.6 }),
      G.S('M300 470 L300 490', '#e0a8c8', 5),
      G.F(G.heartPath(300, 486, 14), '#ff9ecb'),
    ]),
  },
  {
    key: 'dress-rainbow', slot: 'skirt', piece: 'one', label: '彩虹裙',
    art: () => bodice('#ffffff', '#d8c9e0', 'short').concat([
      skirtShape(468, 600, 52, 118, '#ffd6ef', '#e0a8c8', 18),
      G.F('M248 516 C280 528 320 528 352 516 L356 552 C320 566 280 566 244 552 Z', '#ffe3a0', { stroke: '#e0a8c8', 'stroke-width': 0 }),
      G.F('M244 552 C280 566 320 566 356 552 L362 588 C320 604 280 604 238 588 Z', '#a8e0ff', { stroke: '#e0a8c8', 'stroke-width': 0 }),
      G.F('M252 500 C280 512 320 512 348 500 L352 522 L248 522 Z', '#ffb8d4', { stroke: '#e0a8c8', 'stroke-width': 0 }),
      waistband(458, 54, '#ff9ecb', '#e0689f'),
      G.S('M264 486 C286 476 314 476 336 486', '#d8c9e0', 5),
      G.F(G.starPath(300, 486, 14), '#ffffff'),
    ]),
  },
  {
    key: 'skirt-tulip', slot: 'skirt', label: '郁金香裙',
    art: () => [
      G.F('M250 468 C280 458 320 458 350 468 C356 512 344 552 320 570 C306 582 294 582 280 570 C256 552 244 512 250 468 Z', '#ffb84e', { stroke: '#d88f28', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      waistband(460, 52, '#ffd75e', '#d88f28'),
      G.F('M276 464 C288 456 300 464 300 476 C300 464 312 456 324 464 C332 470 330 486 318 492 C308 496 300 496 300 496 C300 496 292 496 282 492 C270 486 268 470 276 464 Z', '#ff8fb3', { stroke: '#d0689f', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M272 520 C290 512 310 512 328 520', '#d88f28', 5, { opacity: 0.6 }),
    ],
  },
  {
    key: 'dress-flower', slot: 'skirt', piece: 'one', label: '碎花裙',
    art: () => bodice('#fff6d8', '#e0c98c', 'puff').concat([
      skirtShape(468, 588, 52, 116, '#fff6d8', '#e0c98c', 20),
      flower(258, 520, 15, '#ff9ecb', '#ffd75e'), flower(300, 552, 16, '#ffb84e', '#ffffff'),
      flower(342, 518, 14, '#c9a8f0', '#ffd75e'), flower(276, 586, 14, '#ff9ecb', '#ffffff'),
      flower(324, 584, 13, '#8fd8ff', '#ffd75e'),
      waistband(458, 54, '#ffd75e', '#e0c98c'),
    ]),
  },
  {
    key: 'dress-snow', slot: 'skirt', piece: 'one', label: '冰雪裙',
    art: () => bodice('#eaf6ff', '#9fc9e8', 'long').concat([
      skirtShape(468, 656, 52, 126, '#dceeff', '#9fc9e8', 24),
      G.F('M240 620 C280 640 320 640 360 620 L366 646 C320 666 280 666 234 646 Z', '#ffffff', { stroke: '#9fc9e8', 'stroke-width': 5 }),
      G.F(G.starPath(300, 540, 26, 0.42), '#ffffff', { stroke: '#9fc9e8', 'stroke-width': 4 }),
      G.F(G.starPath(262, 596, 16, 0.42), '#ffffff'), G.F(G.starPath(340, 590, 16, 0.42), '#ffffff'),
      waistband(458, 54, '#ffffff', '#9fc9e8'),
      G.S('M264 486 C286 476 314 476 336 486', '#9fc9e8', 5),
    ]),
  },
  {
    key: 'skirt-star', slot: 'skirt', label: '星星纱裙',
    art: () => [
      skirtShape(468, 600, 50, 124, '#d8cff8', '#8f6bd8', 22),
      G.F('M244 560 C280 580 320 580 356 560 L362 596 C320 616 280 616 238 596 Z', '#e8e2ff', { opacity: 0.75 }),
      waistband(460, 52, '#8f6bd8', '#6b4bb0'),
      G.F(G.starPath(272, 528, 16), '#ffe9a0'), G.F(G.starPath(330, 548, 14), '#ffe9a0'),
      G.F(G.starPath(300, 580, 16), '#ffe9a0'), G.F(G.starPath(252, 592, 11), '#ffe9a0'),
    ],
  },
  {
    key: 'belt-bow', slot: 'waist', cat: 'skirt', label: '蝴蝶结腰带',
    art: () => [
      G.rect(240, 470, 120, 18, '#ff9ecb', { rx: 9, stroke: '#e0689f', 'stroke-width': 4 }),
      G.F('M300 470 L272 448 L272 492 Z', '#ffb8d4', { stroke: '#e0689f', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F('M300 470 L328 448 L328 492 Z', '#ffb8d4', { stroke: '#e0689f', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.circle(300, 470, 9, '#ffd75e', { stroke: '#e0a93c', 'stroke-width': 4 }),
    ],
  },
  {
    key: 'belt-gold', slot: 'waist', cat: 'skirt', label: '金腰带',
    art: () => [
      G.rect(238, 468, 124, 22, '#ffd75e', { rx: 11, stroke: '#dfae3c', 'stroke-width': 5 }),
      G.rect(286, 462, 28, 34, '#ffe9a0', { rx: 6, stroke: '#dfae3c', 'stroke-width': 5 }),
      G.S('M294 472 L306 472', '#dfae3c', 4),
      G.F(G.starPath(300, 452, 12), '#ff8fb3'),
    ],
  },
  {
    key: 'belt-flower', slot: 'waist', cat: 'skirt', label: '花朵腰带',
    art: () => [
      G.rect(240, 470, 120, 16, '#9be0c4', { rx: 8, stroke: '#5fb99a', 'stroke-width': 4 }),
      flower(252, 478, 12, '#ff9ecb', '#ffd75e'), flower(280, 484, 12, '#ffb84e', '#ffffff'),
      flower(300, 486, 12, '#c9a8f0', '#ffd75e'), flower(322, 484, 12, '#ff9ecb', '#ffffff'),
      flower(348, 478, 12, '#ffb84e', '#ffd75e'),
    ],
  },
];
