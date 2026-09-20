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

function body(fill, line, w) {
  return G.F(G.TORSO, fill, { stroke: line, 'stroke-width': w || 6, 'stroke-linejoin': 'round' });
}

function sleeves(kind, fill, line, extra) {
  const s = G.SLEEVE[kind];
  if (!s) return [];
  const out = [
    G.S(s.l, line, s.w + 12), G.S(s.r, line, s.w + 12),
    G.S(s.l, fill, s.w), G.S(s.r, fill, s.w),
  ];
  if (extra) out.push(extra);
  return out;
}

function cuff(kind, line) {
  const y = kind === 'long' ? 520 : 420;
  return [G.S('M204 ' + y + ' L248 ' + y, line, 8), G.S('M352 ' + y + ' L396 ' + y, line, 8)];
}

function patterned(fill, line, cells) {
  return [G.clipTo('torsoClip', G.TORSO, [body(fill, 'none', 0)].concat(cells))];
}

function neckline(color) {
  return G.S('M276 298 Q300 318 324 298', color, 6);
}

function hem(color, y) {
  return G.S('M262 ' + (y || 486) + ' Q300 ' + ((y || 486) + 12) + ' 338 ' + (y || 486), color, 5, { opacity: 0.45 });
}

function plaidCells(base, a, b) {
  const out = [];
  for (let y = 300; y < 520; y += 44) out.push(G.rect(200, y, 200, 16, a));
  for (let x = 214; x < 390; x += 44) out.push(G.rect(x, 280, 16, 250, a));
  for (let y = 322; y < 520; y += 88) out.push(G.rect(200, y, 200, 6, b));
  for (let x = 236; x < 390; x += 88) out.push(G.rect(x, 280, 6, 250, b));
  return out;
}

module.exports = [
  { key: 'top-tee', slot: 'top', label: 'T恤', legacy: true },
  { key: 'top-stripe', slot: 'top', label: '条纹衫', legacy: true },
  { key: 'top-hoodie', slot: 'top', label: '连帽卫衣', legacy: true },
  {
    key: 'top-tank', slot: 'top', label: '小背心',
    art: () => [body('#ffe08a', '#dfae3c')].concat(bareArms(), [
      G.S('M266 300 Q300 330 334 300', '#dfae3c', 6),
      G.F(G.starPath(300, 380, 20), '#ff9ecb'),
      hem('#dfae3c', 480),
    ]),
  },
  {
    key: 'top-blouse', slot: 'top', label: '泡泡袖衬衫',
    art: () => sleeves('puff', '#ffffff', '#c9b3d8').concat([
      body('#ffffff', '#c9b3d8'),
      G.S('M276 300 Q300 322 324 300', '#c9b3d8', 6),
      G.F('M282 296 L300 316 L318 296 L326 306 L306 328 L294 328 L274 306 Z', '#ffffff', { stroke: '#c9b3d8', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M300 330 L300 486', '#c9b3d8', 4, { opacity: 0.8 }),
      G.circle(300, 356, 5, '#c9b3d8'), G.circle(300, 396, 5, '#c9b3d8'), G.circle(300, 436, 5, '#c9b3d8'),
      G.S('M296 318 Q300 312 304 318', '#ff8fb3', 5),
    ]),
  },
  {
    key: 'top-sailor', slot: 'top', label: '水手服',
    art: () => sleeves('short', '#ffffff', '#3f6fbd').concat([
      body('#ffffff', '#3f6fbd'),
      G.F('M280 298 L300 322 L320 298 L352 296 L358 344 C338 356 262 356 242 344 L248 296 Z', '#5b8fdc', { stroke: '#3f6fbd', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M252 322 L348 322', '#ffffff', 5), G.S('M248 336 L352 336', '#ffffff', 5),
      G.F(G.starPath(300, 320, 12), '#ffd75e'),
      hem('#3f6fbd', 478),
    ]),
  },
  {
    key: 'top-plaid', slot: 'top', label: '格子衬衫',
    art: () => sleeves('long', '#e05a72', '#b23a52').concat(cuff('long', '#b23a52'),
      patterned('#e05a72', '#b23a52', plaidCells('#e05a72', '#f2809a', '#ffe9a0')),
      [G.S('M276 298 Q300 316 324 298', '#b23a52', 6),
        G.F(G.poly([[276, 298], [300, 320], [292, 336], [268, 314]]), '#b23a52'),
        G.F(G.poly([[324, 298], [300, 320], [308, 336], [332, 314]]), '#b23a52'),
        G.circle(300, 370, 5, '#ffe9a0'), G.circle(300, 410, 5, '#ffe9a0'), G.circle(300, 450, 5, '#ffe9a0')]),
  },
  {
    key: 'top-sweater', slot: 'top', label: '针织毛衣',
    art: () => sleeves('long', '#f0b3d6', '#cf86b0').concat([
      body('#f0b3d6', '#cf86b0'),
      G.clipTo('torsoClip', G.TORSO, (function () {
        const rows = [];
        for (let x = 240; x < 366; x += 16) rows.push(G.rect(x, 292, 7, 220, '#e39cc6'));
        return rows;
      })()),
      neckline('#cf86b0'),
      G.S('M234 344 C240 336 246 336 250 344 M350 344 C354 336 360 336 366 344', '#cf86b0', 5),
      G.S('M208 512 L244 512 M356 512 L392 512', '#cf86b0', 8),
    ]),
  },
  {
    key: 'top-turtle', slot: 'top', label: '高领毛衣',
    art: () => sleeves('long', '#9b7ad1', '#7457ad').concat([
      body('#9b7ad1', '#7457ad'),
      G.F('M276 292 C280 286 320 286 324 292 L334 334 C310 344 290 344 266 334 Z', '#a98ae0', { stroke: '#7457ad', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M274 304 C292 312 308 312 326 304', '#7457ad', 5),
      body('none', '#7457ad', 0),
      hem('#7457ad', 484),
    ]),
  },
  {
    key: 'top-puffer', slot: 'top', label: '羽绒服',
    art: () => sleeves('puff', '#8fd8ff', '#4fa8dc').concat([
      body('#8fd8ff', '#4fa8dc'),
      G.clipTo('torsoClip', G.TORSO, (function () {
        const rows = [];
        for (let y = 316; y < 500; y += 34) rows.push(G.S('M214 ' + y + ' L386 ' + y, '#4fa8dc', 6, { opacity: 0.75 }));
        return rows;
      })()),
      G.S('M300 300 L300 494', '#4fa8dc', 6),
      G.rect(292, 296, 16, 200, '#cbe9ff', { rx: 8, stroke: '#4fa8dc', 'stroke-width': 4 }),
      G.circle(300, 316, 6, '#ffd75e'),
    ]),
  },
  {
    key: 'top-denim', slot: 'top', label: '牛仔外套',
    art: () => sleeves('long', '#6f9fe0', '#3f6fbd').concat(cuff('long', '#3f6fbd'), [
      body('#6f9fe0', '#3f6fbd'),
      G.F(G.poly([[276, 298], [300, 322], [292, 342], [266, 316]]), '#5b8fdc', { stroke: '#3f6fbd', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[324, 298], [300, 322], [308, 342], [334, 316]]), '#5b8fdc', { stroke: '#3f6fbd', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M300 340 L300 496', '#3f6fbd', 5),
      G.rect(252, 356, 36, 30, '#5b8fdc', { rx: 5, stroke: '#3f6fbd', 'stroke-width': 4 }),
      G.rect(312, 356, 36, 30, '#5b8fdc', { rx: 5, stroke: '#3f6fbd', 'stroke-width': 4 }),
      G.circle(300, 366, 5, '#ffd75e'), G.circle(300, 404, 5, '#ffd75e'),
      G.S('M232 470 L256 470 M344 470 L368 470', '#3f6fbd', 5),
    ]),
  },
  {
    key: 'top-lace', slot: 'top', label: '蕾丝上衣',
    art: () => sleeves('short', '#fff2f9', '#e0a8c8').concat([
      body('#fff2f9', '#e0a8c8'),
      G.S('M276 298 Q300 318 324 298', '#e0a8c8', 6),
      G.S('M262 452 Q300 466 338 452', '#e0a8c8', 5),
      (function () {
        const sc = [];
        for (let x = 246; x <= 354; x += 22) sc.push(G.circle(x, 466, 11, '#fff2f9', { stroke: '#e0a8c8', 'stroke-width': 4 }));
        return G.group({}, sc);
      })(),
      G.S('M300 320 L300 440', '#f0c9dd', 4),
      G.F(G.heartPath(300, 350, 12), '#ff9ecb'),
    ]),
  },
  {
    key: 'top-dot', slot: 'top', label: '波点衫',
    art: () => sleeves('short', '#ff9ecb', '#e0689f').concat(
      patterned('#ff9ecb', '#e0689f', G.dots(248, 316, 356, 496, 40, 7, '#ffffff')),
      [neckline('#e0689f'), G.F(G.heartPath(300, 466, 13), '#ffffff')]
    ),
  },
  {
    key: 'top-heart', slot: 'top', label: '爱心衫',
    art: () => sleeves('short', '#ffffff', '#e05a72').concat(
      [body('#ffffff', '#e05a72'), neckline('#e05a72')],
      (function () {
        const hs = [];
        [[262, 350], [300, 336], [338, 350], [282, 400], [318, 400], [300, 452]].forEach((p) => hs.push(G.F(G.heartPath(p[0], p[1], 16), '#ff8fb3')));
        return hs;
      })()
    ),
  },
  {
    key: 'top-kimono', slot: 'top', label: '和服上衣',
    art: () => sleeves('puff', '#ff8fb3', '#d0689f').concat([
      body('#ff8fb3', '#d0689f'),
      G.F(G.poly([[300, 296], [352, 300], [348, 420], [300, 420]]), '#ffb8d4'),
      G.F('M262 296 L300 300 L300 420 L252 420 Z', '#ffb8d4'),
      G.S('M300 300 L262 420', '#d0689f', 6),
      G.rect(240, 408, 120, 44, '#ffd75e', { rx: 8, stroke: '#dfae3c', 'stroke-width': 5 }),
      G.S('M240 430 L360 430', '#dfae3c', 4, { opacity: 0.7 }),
      G.F(G.starPath(300, 430, 14), '#ff8fb3'),
    ]),
  },
  {
    key: 'top-sport', slot: 'top', label: '运动衫',
    art: () => sleeves('short', '#5fd0b8', '#33a891').concat([
      body('#5fd0b8', '#33a891'),
      G.S('M242 320 C236 360 232 400 232 440', '#ffffff', 8),
      G.S('M358 320 C364 360 368 400 368 440', '#ffffff', 8),
      G.S('M276 298 Q300 318 324 298', '#33a891', 6),
      G.F(G.starPath(300, 390, 34, 0.5), '#ffffff'),
      hem('#33a891', 480),
    ]),
  },
  {
    key: 'top-rainbow', slot: 'top', label: '彩虹衫',
    art: () => sleeves('short', '#ffd75e', '#dfae3c').concat([
      patterned('#ffffff', '#dfae3c', (function () {
        const cols = ['#ff8fb3', '#ffd75e', '#8fd8ff', '#9fe8c8', '#c9a8f0'];
        return cols.map((c, i) => G.rect(200, 306 + i * 34, 200, 34, c));
      })()),
      [G.S('M262 292 C240 320 236 360 238 400', '#ffffff', 0), neckline('#dfae3c'),
        G.F(G.starPath(300, 430, 16), '#ffffff')],
    ]),
  },
  {
    key: 'scarf-knit', slot: 'scarf', cat: 'top', label: '针织围巾',
    art: () => [
      G.F('M266 292 C286 306 314 306 334 292 C342 306 344 322 336 336 C316 348 284 348 264 336 C256 322 258 306 266 292 Z', '#ff6b8a', { stroke: '#d84a6b', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F('M330 330 C352 340 360 356 358 376 L338 372 C340 356 334 344 322 338 Z', '#ff8fa5', { stroke: '#d84a6b', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M266 312 L332 312', '#d84a6b', 5, { opacity: 0.6 }),
      G.S('M280 336 L280 372 M300 340 L300 380 M320 338 L320 374', '#d84a6b', 5, { opacity: 0.5 }),
      G.S('M340 366 L358 370', '#d84a6b', 5),
    ],
  },
  {
    key: 'scarf-silk', slot: 'scarf', cat: 'top', label: '小丝巾',
    art: () => [
      G.F('M268 292 C288 308 312 308 332 292 L340 306 C320 324 280 324 260 306 Z', '#8fd8ff', { stroke: '#4fa8dc', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[292, 318], [308, 318], [312, 372], [288, 372]]), '#b8e6ff', { stroke: '#4fa8dc', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M292 330 L310 352 M308 330 L290 352', '#4fa8dc', 4),
      G.circle(300, 320, 8, '#ffd75e'),
    ],
  },
  {
    key: 'scarf-collar', slot: 'scarf', cat: 'top', label: '毛领',
    art: () => [
      (function () {
        const out = [];
        for (let i = 0; i <= 10; i += 1) {
          const a = Math.PI * (0.12 + (i / 10) * 0.76);
          out.push(G.circle(300 - Math.cos(a) * 58, 306 + Math.sin(a) * 26, 22, '#f7f4ee'));
        }
        return G.group({}, out);
      })(),
      G.S('M252 298 C280 322 320 322 348 298', '#e0d8cc', 5),
    ],
  },
];
