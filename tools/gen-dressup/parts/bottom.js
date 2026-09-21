'use strict';
const G = require('../geom');

const HEM = { short: 600, mid: 648, capri: 664, long: 704, ankle: 712 };

function legPath(side, hemY) {
  const p = G.legPoint(side, hemY);
  return 'M' + (side === 'l' ? 276 : 324) + ' 506 L' + Math.round(p.x) + ' ' + hemY;
}

function legs(kind, fill, line, w) {
  const hemY = typeof kind === 'number' ? kind : HEM[kind];
  const width = w || 58;
  const out = [];
  ['l', 'r'].forEach((side) => {
    out.push(G.S(legPath(side, hemY), line, width + 12, { 'stroke-linecap': 'butt' }));
    out.push(G.S(legPath(side, hemY), fill, width, { 'stroke-linecap': 'butt' }));
  });
  return out;
}

function hip(fill, line) {
  return G.F(G.HIP, fill, { stroke: line, 'stroke-width': 6, 'stroke-linejoin': 'round' });
}

function hemLine(kind, line) {
  const hemY = typeof kind === 'number' ? kind : HEM[kind];
  const l = G.legPoint('l', hemY);
  const r = G.legPoint('r', hemY);
  return [G.S('M' + Math.round(l.x - 30) + ' ' + hemY + ' L' + Math.round(l.x + 30) + ' ' + hemY, line, 6),
    G.S('M' + Math.round(r.x - 30) + ' ' + hemY + ' L' + Math.round(r.x + 30) + ' ' + hemY, line, 6)];
}

function legAnchors(kind) {
  const hemY = typeof kind === 'number' ? kind : HEM[kind];
  return [G.legPoint('l', hemY), G.legPoint('r', hemY)];
}

function cuffs(kind, fill, line) {
  const a = legAnchors(kind);
  return a.map((p) => G.rect(p.x - 33, p.y - 30, 66, 32, fill, { rx: 8, stroke: line, 'stroke-width': 5 }));
}

function legStripes(kind, color, step) {
  const out = [];
  const hemY = typeof kind === 'number' ? kind : HEM[kind];
  for (let y = 530; y < hemY; y += step || 34) {
    ['l', 'r'].forEach((side) => {
      const p = G.legPoint(side, y);
      out.push(G.S('M' + Math.round(p.x - 26) + ' ' + y + ' L' + Math.round(p.x + 26) + ' ' + y, color, 12));
    });
  }
  return out;
}

function stars(List, size) {
  return List.map((p) => G.F(G.starPath(p[0], p[1], size || 12), '#ffe9a0'));
}

function pantStars() {
  const out = [];
  [[262, 560], [338, 610], [266, 660], [334, 530]].forEach((p) => out.push(G.F(G.starPath(p[0], p[1], 14), '#ffffff')));
  return out;
}

function pantHearts() {
  const out = [];
  [[262, 566], [338, 614], [266, 662], [334, 530]].forEach((p) => out.push(G.F(G.heartPath(p[0], p[1], 12), '#ff8fb3')));
  return out;
}

module.exports = [
  { key: 'bottom-shorts', slot: 'bottom', label: '短裤', legacy: true },
  { key: 'bottom-pants', slot: 'bottom', label: '长裤', legacy: true },
  {
    key: 'bottom-jeans', slot: 'bottom', label: '牛仔裤',
    art: () => legs('long', '#6f9fe0', '#3f6fbd').concat(hip('#6f9fe0', '#3f6fbd'), hemLine('long', '#3f6fbd'), [
      G.S('M256 496 C272 504 286 504 298 496', '#ffe9a0', 5, { opacity: 0.9 }),
      G.S('M344 496 C328 504 314 504 302 496', '#ffe9a0', 5, { opacity: 0.9 }),
      G.S('M282 520 C290 560 288 640 284 700', '#ffe9a0', 4, { opacity: 0.8 }),
      G.S('M318 520 C310 560 312 640 316 700', '#ffe9a0', 4, { opacity: 0.8 }),
    ]),
  },
  {
    key: 'bottom-leggings', slot: 'bottom', label: '打底裤',
    art: () => legs('ankle', '#4a3f52', '#332b3a', 46).concat(hip('#4a3f52', '#332b3a'), [
      G.S('M244 500 L356 500', '#332b3a', 6, { opacity: 0.6 }),
    ]),
  },
  {
    key: 'bottom-cargo', slot: 'bottom', label: '工装裤',
    art: () => legs('long', '#9aa87f', '#6d7a56').concat(hip('#9aa87f', '#6d7a56'), hemLine('long', '#6d7a56'), [
      G.rect(242, 560, 34, 40, '#87956c', { rx: 5, stroke: '#6d7a56', 'stroke-width': 5 }),
      G.rect(324, 560, 34, 40, '#87956c', { rx: 5, stroke: '#6d7a56', 'stroke-width': 5 }),
      G.S('M252 566 L266 566', '#6d7a56', 4),
      G.S('M250 496 L350 496', '#6d7a56', 6),
    ]),
  },
  {
    key: 'bottom-overall', slot: 'bottom', depth: 3.2, label: '背带裤',
    art: () => legs('long', '#5b8fdc', '#3f6fbd').concat(hip('#5b8fdc', '#3f6fbd'), [
      G.F('M268 462 L332 462 L334 502 L266 502 Z', '#5b8fdc', { stroke: '#3f6fbd', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M274 466 L266 402 M326 466 L334 402', '#3f6fbd', 11),
      G.circle(270, 470, 6, '#ffd75e'), G.circle(330, 470, 6, '#ffd75e'),
      G.F(G.heartPath(300, 484, 13), '#ffd75e'),
      G.S('M280 494 L320 494', '#3f6fbd', 5),
    ]),
  },
  {
    key: 'bottom-capri', slot: 'bottom', label: '七分裤',
    art: () => legs('capri', '#ff9ecb', '#d0689f').concat(hip('#ff9ecb', '#d0689f'), hemLine('capri', '#d0689f'), [
      legStripes(648, '#ffffff', 40),
    ]),
  },
  {
    key: 'bottom-flare', slot: 'bottom', label: '喇叭裤',
    art: () => [
      hip('#8f6bd8', '#6b4bb0'),
      G.F('M258 470 L282 470 C286 540 276 620 250 704 C240 712 214 706 206 694 C224 616 240 540 258 470 Z', '#8f6bd8', { stroke: '#6b4bb0', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F('M342 470 L318 470 C314 540 324 620 350 704 C360 712 386 706 394 694 C376 616 360 540 342 470 Z', '#8f6bd8', { stroke: '#6b4bb0', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M212 690 L252 690', '#6b4bb0', 6), G.S('M348 690 L388 690', '#6b4bb0', 6),
      G.S('M300 486 L300 520', '#6b4bb0', 5),
    ],
  },
  {
    key: 'bottom-jogger', slot: 'bottom', label: '运动裤',
    art: () => legs('ankle', '#7fb8d8', '#4f8fb8').concat(hip('#7fb8d8', '#4f8fb8'), cuffs('ankle', '#ffffff', '#4f8fb8'), [
      G.S('M244 500 L356 500', '#4f8fb8', 5, { opacity: 0.6 }),
      G.S('M262 512 C258 580 254 650 252 706', '#ffffff', 6, { opacity: 0.8 }),
      G.S('M338 512 C342 580 346 650 348 706', '#ffffff', 6, { opacity: 0.8 }),
      G.S('M286 470 Q300 484 314 470', '#4f8fb8', 6),
    ]),
  },
  {
    key: 'bottom-bloomer', slot: 'bottom', label: '灯笼裤',
    art: () => [
      hip('#ffd75e', '#dfae3c'),
      G.F('M252 480 C240 540 236 588 244 616 C252 640 286 644 298 622 L300 540 L302 622 C314 644 348 640 356 616 C364 588 360 540 348 480 Z', '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M244 612 L300 612 M300 612 L356 612', '#dfae3c', 6),
      G.F(G.starPath(300, 556, 14), '#ff9ecb'),
    ],
  },
  {
    key: 'bottom-pj', slot: 'bottom', label: '睡裤',
    art: () => legs('long', '#c9a8f0', '#9b7ad1').concat(hip('#c9a8f0', '#9b7ad1'), legStripes(704, '#ffffff', 46), [
      G.S('M250 496 L350 496', '#9b7ad1', 5, { opacity: 0.6 }),
    ]),
  },
  {
    key: 'bottom-snow', slot: 'bottom', label: '雪地裤',
    art: () => legs('ankle', '#e05a72', '#b23a52', 70).concat(hip('#e05a72', '#b23a52'), cuffs('ankle', '#f2f4f8', '#b23a52'), [
      G.S('M246 520 L354 520', '#b23a52', 5, { opacity: 0.6 }),
      G.S('M246 600 L354 600', '#ffffff', 5, { opacity: 0.5 }),
      G.F(G.starPath(300, 486, 12), '#ffffff'),
    ]),
  },
  {
    key: 'bottom-sweat', slot: 'bottom', label: '卫裤',
    art: () => legs('long', '#6b7280', '#4b5158').concat(hip('#6b7280', '#4b5158'), hemLine('long', '#4b5158'), [
      G.S('M256 512 C252 580 250 640 248 700', '#ffffff', 8, { opacity: 0.85 }),
      G.S('M344 512 C348 580 350 640 352 700', '#ffffff', 8, { opacity: 0.85 }),
      G.S('M244 498 L356 498', '#4b5158', 6),
    ]),
  },
  {
    key: 'bottom-plaid', slot: 'bottom', label: '格子裤',
    art: () => legs('long', '#e0a06a', '#b87a45').concat([
      G.clipTo('hipClip', G.HIP, [hip('#e0a06a', 'none')].concat((function () {
        const out = [];
        for (let y = 470; y < 566; y += 30) out.push(G.rect(230, y, 140, 12, '#c98a52'));
        for (let x = 250; x < 360; x += 30) out.push(G.rect(x, 466, 12, 104, '#c98a52'));
        return out;
      })())),
      G.F(G.HIP, 'none', { stroke: '#b87a45', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
    ], legStripes(704, '#c98a52', 30), hemLine('long', '#b87a45')),
  },
  {
    key: 'bottom-shorts-sport', slot: 'bottom', label: '运动短裤',
    art: () => legs(600, '#5fd0b8', '#33a891').concat(hip('#5fd0b8', '#33a891'), hemLine(600, '#33a891'), [
      G.S('M252 486 C248 520 246 560 246 596', '#ffffff', 8),
      G.S('M348 486 C352 520 354 560 354 596', '#ffffff', 8),
      G.S('M244 480 L356 480', '#33a891', 10),
      G.F(G.starPath(300, 478, 12), '#ffd75e'),
    ]),
  },
  {
    key: 'bottom-shorts-lace', slot: 'bottom', label: '蕾丝短裤',
    art: () => legs(596, '#fff2f9', '#e0a8c8').concat(hip('#fff2f9', '#e0a8c8'), (function () {
      const out = [];
      ['l', 'r'].forEach((side) => {
        const p = G.legPoint(side, 596);
        for (let i = -2; i <= 2; i += 1) out.push(G.circle(p.x + i * 15, 596, 9, '#fff2f9', { stroke: '#e0a8c8', 'stroke-width': 4 }));
      });
      return G.group({}, out);
    })(), [G.F(G.heartPath(300, 486, 12), '#ff9ecb')]),
  },
  {
    key: 'bottom-culottes', slot: 'bottom', label: '阔腿裤',
    art: () => [
      hip('#e8d6f2', '#b89ad0'),
      G.F('M254 476 L282 476 C286 540 300 600 314 660 C320 672 300 682 282 682 C258 682 234 668 226 640 C222 578 236 520 254 476 Z', '#e8d6f2', { stroke: '#b89ad0', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F('M346 476 L318 476 C314 540 300 600 286 660 C280 672 300 682 318 682 C342 682 366 668 374 640 C378 578 364 520 346 476 Z', '#e8d6f2', { stroke: '#b89ad0', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M226 640 L282 674', '#b89ad0', 5, { opacity: 0.5 }),
      G.S('M374 640 L318 674', '#b89ad0', 5, { opacity: 0.5 }),
      G.S('M248 490 L352 490', '#ff9ecb', 8),
    ],
  },
  {
    key: 'bottom-heart', slot: 'bottom', label: '爱心裤',
    art: () => legs('long', '#ffb8d4', '#d0689f').concat(hip('#ffb8d4', '#d0689f'), hemLine('long', '#d0689f'), pantHearts()),
  },
  {
    key: 'bottom-shorts-denim', slot: 'bottom', label: '牛仔短裤',
    art: () => legs(590, '#6f9fe0', '#3f6fbd').concat(hip('#6f9fe0', '#3f6fbd'), hemLine(590, '#3f6fbd'), [
      G.S('M266 496 L298 496 M334 496 L302 496', '#ffe9a0', 5),
      G.S('M250 502 L352 502', '#3f6fbd', 5, { opacity: 0.5 }),
      G.S('M254 578 L286 578 M346 578 L314 578', '#ffe9a0', 5, { opacity: 0.8 }),
    ]),
  },
  {
    key: 'bottom-pants-star', slot: 'bottom', label: '星星长裤',
    art: () => legs('long', '#3f6fbd', '#2d539a').concat(hip('#3f6fbd', '#2d539a'), hemLine('long', '#2d539a'), pantStars()),
  },
];
