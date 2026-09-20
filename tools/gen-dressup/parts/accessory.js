'use strict';
const G = require('../geom');

const HAND = [372, 544];

function chain(color) {
  return G.S('M268 300 C282 340 318 340 332 300', color, 5);
}

module.exports = [
  {
    key: 'neck-pearl', slot: 'neck', cat: 'accessory', label: '珍珠项链',
    art: () => [
      G.S('M268 300 C282 344 318 344 332 300', '#ffe9c9', 4),
      G.circle(272, 308, 6, '#fffaf0', { stroke: '#e0c9a0', 'stroke-width': 3 }),
      G.circle(280, 326, 6.5, '#fffaf0', { stroke: '#e0c9a0', 'stroke-width': 3 }),
      G.circle(292, 338, 7, '#fffaf0', { stroke: '#e0c9a0', 'stroke-width': 3 }),
      G.circle(308, 338, 7, '#fffaf0', { stroke: '#e0c9a0', 'stroke-width': 3 }),
      G.circle(320, 326, 6.5, '#fffaf0', { stroke: '#e0c9a0', 'stroke-width': 3 }),
      G.circle(328, 308, 6, '#fffaf0', { stroke: '#e0c9a0', 'stroke-width': 3 }),
    ],
  },
  {
    key: 'neck-heart', slot: 'neck', cat: 'accessory', label: '爱心项链',
    art: () => [chain('#ffd75e'), G.F(G.heartPath(300, 352, 15), '#ff6b8a', { stroke: '#d84a6b', 'stroke-width': 4 })],
  },
  {
    key: 'neck-flower', slot: 'neck', cat: 'accessory', label: '花朵项链',
    art: () => [chain('#9be0c4'), G.circle(288, 344, 11, '#ff9ecb'), G.circle(312, 344, 11, '#ffb84e'),
      G.circle(300, 356, 11, '#c9a8f0'), G.circle(300, 348, 7, '#ffd75e')],
  },
  {
    key: 'neck-bow', slot: 'neck', cat: 'accessory', label: '蝴蝶结项圈',
    art: () => [
      G.rect(266, 300, 68, 12, '#4a3f52', { rx: 6, stroke: '#2f2a33', 'stroke-width': 4 }),
      G.F('M300 320 L276 306 L276 334 Z', '#ff8fb3', { stroke: '#d0689f', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      G.F('M300 320 L324 306 L324 334 Z', '#ff8fb3', { stroke: '#d0689f', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      G.circle(300, 320, 7, '#ffd75e'),
    ],
  },
  {
    key: 'ear-star', slot: 'ear', cat: 'accessory', label: '星星耳钉',
    art: () => [G.F(G.starPath(233, 222, 12), '#ffd75e'), G.F(G.starPath(367, 222, 12), '#ffd75e')],
  },
  {
    key: 'ear-hoop', slot: 'ear', cat: 'accessory', label: '圆环耳环',
    art: () => [
      G.circle(233, 232, 14, 'none', { fill: 'none', stroke: '#ffd75e', 'stroke-width': 6 }),
      G.circle(367, 232, 14, 'none', { fill: 'none', stroke: '#ffd75e', 'stroke-width': 6 }),
      G.circle(240, 246, 6, '#ff8fb3'), G.circle(360, 246, 6, '#ff8fb3'),
    ],
  },
  {
    key: 'ear-flower', slot: 'ear', cat: 'accessory', label: '花朵耳夹',
    art: () => [
      G.circle(228, 226, 10, '#ff9ecb'), G.circle(240, 220, 10, '#ff9ecb'), G.circle(234, 234, 10, '#ff9ecb'), G.circle(234, 227, 7, '#ffd75e'),
      G.circle(372, 226, 10, '#c9a8f0'), G.circle(360, 220, 10, '#c9a8f0'), G.circle(366, 234, 10, '#c9a8f0'), G.circle(366, 227, 7, '#ffd75e'),
    ],
  },
  {
    key: 'hand-balloon', slot: 'hand', cat: 'accessory', label: '小气球',
    art: () => [
      G.S('M' + HAND[0] + ' ' + (HAND[1] - 10) + ' C386 470 396 440 400 424', '#e0a8c8', 4),
      G.ellipse(400, 386, 40, 48, '#ff6b8a', { stroke: '#d84a6b', 'stroke-width': 5 }),
      G.F(G.poly([[392, 432], [408, 432], [400, 444]]), '#d84a6b'),
      G.ellipse(386, 368, 10, 14, '#ffd0d8', { opacity: 0.8 }),
    ],
  },
  {
    key: 'hand-umbrella', slot: 'hand', cat: 'accessory', label: '小雨伞',
    art: () => [
      G.S('M' + HAND[0] + ' ' + (HAND[1] - 6) + ' L' + HAND[0] + ' 412', '#8a5a2b', 6),
      G.S('M' + HAND[0] + ' 412 C376 396 348 400 336 418 C364 412 388 414 400 424 C412 414 436 412 464 418 C452 400 424 396 408 412 Z', '#ff8fb3', 0),
      G.F('M336 418 C348 398 376 392 400 392 C424 392 452 398 464 418 C436 410 412 408 400 424 C388 408 364 410 336 418 Z', '#ff8fb3', { stroke: '#d0689f', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M' + HAND[0] + ' 412 L' + HAND[0] + ' 428', '#e0689f', 5),
      G.S('M' + HAND[0] + ' 426 C' + HAND[0] + ' 436 ' + (HAND[0] - 12) + ' 438 ' + (HAND[0] - 12) + ' 430', '#8a5a2b', 6),
    ],
  },
  {
    key: 'hand-bag', slot: 'hand', cat: 'accessory', label: '小手提包',
    art: () => [
      G.S('M' + HAND[0] + ' 544 C' + (HAND[0] + 2) + ' 574 ' + (HAND[0] + 8) + ' 588 ' + (HAND[0] + 16) + ' 596', '#8a5a2b', 5),
      G.rect(370, 594, 78, 60, '#ff9ecb', { rx: 12, stroke: '#d0689f', 'stroke-width': 6 }),
      G.F('M382 596 C386 574 424 574 428 596 L418 596 C414 582 396 582 392 596 Z', '#d0689f'),
      G.F(G.heartPath(409, 622, 14), '#ffd75e'),
    ],
  },
  {
    key: 'hand-teddy', slot: 'hand', cat: 'accessory', label: '泰迪熊',
    art: () => [
      G.S('M' + HAND[0] + ' 552 L' + (HAND[0] + 14) + ' 588', '#c99a6a', 5),
      G.ellipse(396, 646, 40, 42, '#c99a6a', { stroke: '#a87a4e', 'stroke-width': 5 }),
      G.circle(396, 592, 30, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 5 }),
      G.circle(376, 572, 12, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 4 }),
      G.circle(416, 572, 12, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 4 }),
      G.circle(386, 588, 4, '#3c2f3a'), G.circle(406, 588, 4, '#3c2f3a'),
      G.ellipse(396, 600, 8, 6, '#f0dcc4', { stroke: '#a87a4e', 'stroke-width': 3 }),
      G.ellipse(372, 650, 12, 16, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 4 }),
      G.ellipse(420, 650, 12, 16, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 4 }),
      G.F(G.heartPath(396, 640, 12), '#ff8fb3'),
    ],
  },
  {
    key: 'hand-bouquet', slot: 'hand', cat: 'accessory', label: '花束',
    art: () => [
      G.S('M' + HAND[0] + ' 546 L400 592', '#5fb99a', 10),
      G.S('M392 566 L372 552 M400 566 L420 550 M396 576 L380 580', '#5fb99a', 7),
      G.circle(376, 542, 15, '#ff9ecb'), G.circle(400, 528, 16, '#ffb84e'),
      G.circle(424, 544, 15, '#c9a8f0'), G.circle(400, 556, 14, '#ff6b8a'),
      G.circle(400, 543, 9, '#ffd75e'),
      G.F(G.heartPath(400, 632, 13), '#ff8fb3'),
    ],
  },
  {
    key: 'pet-cat', slot: 'pet', cat: 'accessory', label: '小猫咪',
    art: () => [
      G.S('M470 700 C500 690 512 660 500 640', '#e08e4e', 18),
      G.ellipse(462, 690, 40, 44, '#f0a860', { stroke: '#c07838', 'stroke-width': 5 }),
      G.circle(462, 622, 36, '#f5b673', { stroke: '#c07838', 'stroke-width': 5 }),
      G.F(G.poly([[436, 598], [430, 560], [462, 584]]), '#f5b673', { stroke: '#c07838', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[488, 598], [494, 560], [462, 584]]), '#f5b673', { stroke: '#c07838', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.circle(448, 620, 5, '#3c2f3a'), G.circle(476, 620, 5, '#3c2f3a'),
      G.F(G.poly([[462, 630], [456, 638], [468, 638]]), '#e08e8e'),
      G.S('M436 632 L416 628 M436 640 L416 644 M488 632 L508 628 M488 640 L508 644', '#c07838', 4),
      G.ellipse(462, 712, 30, 12, '#f0a860', { stroke: '#c07838', 'stroke-width': 4 }),
    ],
  },
  {
    key: 'pet-puppy', slot: 'pet', cat: 'accessory', label: '小狗',
    art: () => [
      G.S('M500 690 C520 676 520 650 506 638', '#c99a6a', 16),
      G.ellipse(464, 690, 42, 42, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 5 }),
      G.circle(458, 624, 36, '#e6c096', { stroke: '#a87a4e', 'stroke-width': 5 }),
      G.ellipse(424, 620, 14, 26, '#c99a6a', { stroke: '#a87a4e', 'stroke-width': 5 }),
      G.ellipse(492, 620, 14, 26, '#c99a6a', { stroke: '#a87a4e', 'stroke-width': 5 }),
      G.circle(444, 622, 5, '#3c2f3a'), G.circle(472, 622, 5, '#3c2f3a'),
      G.ellipse(458, 640, 12, 9, '#ffffff', { stroke: '#a87a4e', 'stroke-width': 3 }),
      G.circle(458, 636, 5, '#3c2f3a'),
      G.S('M458 645 L458 652 M458 652 L450 656 M458 652 L466 656', '#a87a4e', 4),
      G.ellipse(464, 712, 30, 12, '#d9ae80', { stroke: '#a87a4e', 'stroke-width': 4 }),
      G.ellipse(428, 700, 12, 16, '#e6c096', { stroke: '#a87a4e', 'stroke-width': 4 }),
    ],
  },
  {
    key: 'pet-duck', slot: 'pet', cat: 'accessory', label: '小鸭子',
    art: () => [
      G.ellipse(462, 686, 42, 38, '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 5 }),
      G.ellipse(430, 660, 20, 32, '#ffe08a', { stroke: '#dfae3c', 'stroke-width': 5 }),
      G.circle(462, 618, 32, '#ffe08a', { stroke: '#dfae3c', 'stroke-width': 5 }),
      G.F('M492 618 C512 612 516 630 494 634 Z', '#ff9ecb', { stroke: '#e0689f', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      G.circle(468, 610, 5, '#3c2f3a'),
      G.circle(462, 606, 4, '#ffffff'),
      G.S('M444 692 L436 706 M462 694 L458 710 M480 692 L488 706', '#dfae3c', 5),
      G.F(G.heartPath(430, 660, 10), '#ff9ecb'),
    ],
  },
  {
    key: 'pet-bunny', slot: 'pet', cat: 'accessory', label: '小兔子',
    art: () => [
      G.ellipse(462, 698, 40, 36, '#ffffff', { stroke: '#d8d0c4', 'stroke-width': 5 }),
      G.circle(462, 636, 32, '#ffffff', { stroke: '#d8d0c4', 'stroke-width': 5 }),
      G.ellipse(446, 588, 12, 34, '#ffffff', { stroke: '#d8d0c4', 'stroke-width': 5 }),
      G.ellipse(478, 588, 12, 34, '#ffffff', { stroke: '#d8d0c4', 'stroke-width': 5 }),
      G.ellipse(446, 590, 6, 22, '#ffb8d4'), G.ellipse(478, 590, 6, 22, '#ffb8d4'),
      G.circle(450, 634, 5, '#3c2f3a'), G.circle(474, 634, 5, '#3c2f3a'),
      G.F(G.heartPath(462, 646, 8), '#ff8fb3'),
      G.circle(500, 690, 14, '#ffffff', { stroke: '#d8d0c4', 'stroke-width': 4 }),
      G.S('M446 656 L430 652 M446 664 L430 668 M478 656 L494 652 M478 664 L494 668', '#d8d0c4', 3),
    ],
  },
  {
    key: 'back-wings', slot: 'back', cat: 'accessory', label: '天使翅膀',
    art: () => [
      G.F('M250 330 C204 306 156 306 132 344 C104 388 122 446 168 466 C196 478 232 466 250 442 Z', '#eaf5ff', { stroke: '#b3d4ee', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F('M350 330 C396 306 444 306 468 344 C496 388 478 446 432 466 C404 478 368 466 350 442 Z', '#eaf5ff', { stroke: '#b3d4ee', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M226 344 C196 350 174 372 166 400 M236 372 C208 380 188 400 180 426', '#b3d4ee', 5),
      G.S('M374 344 C404 350 426 372 434 400 M364 372 C392 380 412 400 420 426', '#b3d4ee', 5),
    ],
  },
  {
    key: 'back-cape', slot: 'back', cat: 'accessory', label: '红披风',
    art: () => [
      G.F('M240 300 C270 286 330 286 360 300 C388 360 400 480 396 596 C360 616 240 616 204 596 C200 480 212 360 240 300 Z', '#e0455f', { stroke: '#b32e46', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M240 340 C280 356 320 356 360 340', '#b32e46', 5, { opacity: 0.6 }),
      G.F('M236 296 C266 282 334 282 364 296 L360 320 C330 306 270 306 240 320 Z', '#f2f4f8', { stroke: '#d8d0c4', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F(G.starPath(300, 470, 22), '#ffd75e'),
    ],
  },
  {
    key: 'back-bag', slot: 'back', cat: 'accessory', label: '双肩包',
    art: () => [
      G.S('M252 330 C240 356 238 386 240 410', '#a8763f', 12),
      G.S('M348 330 C360 356 362 386 360 410', '#a8763f', 12),
      G.rect(220, 330, 160, 140, '#c58a52', { rx: 26, stroke: '#8a5a2b', 'stroke-width': 6 }),
      G.rect(240, 396, 120, 60, '#d99a5e', { rx: 16, stroke: '#8a5a2b', 'stroke-width': 5 }),
      G.F('M300 402 C290 392 276 396 276 408 C276 418 292 426 300 434 C308 426 324 418 324 408 C324 396 310 392 300 402 Z', '#ff8fb3'),
      G.S('M220 366 L380 366', '#8a5a2b', 5),
      G.F(G.starPath(300, 348, 14), '#ffd75e'),
    ],
  },
  {
    key: 'waist-sash', slot: 'waist', cat: 'accessory', label: '丝带腰带',
    art: () => [
      G.rect(238, 472, 124, 16, '#9fc9e8', { rx: 8, stroke: '#6f9fe0', 'stroke-width': 4 }),
      G.F('M318 480 C348 470 366 486 362 508 C358 528 338 532 324 520 C334 508 336 496 326 488 Z', '#b8ddf4', { stroke: '#6f9fe0', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.circle(300, 480, 10, '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 4 }),
    ],
  },
  {
    key: 'waist-bow', slot: 'waist', cat: 'accessory', label: '蝴蝶结腰饰',
    art: () => [
      G.F('M300 480 L262 456 L262 508 Z', '#c9a8f0', { stroke: '#8f6bd8', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F('M300 480 L338 456 L338 508 Z', '#c9a8f0', { stroke: '#8f6bd8', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.circle(300, 480, 12, '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 4 }),
      G.S('M292 492 C280 510 268 518 254 522 M308 492 C320 510 332 518 346 522', '#8f6bd8', 7),
    ],
  },
];
