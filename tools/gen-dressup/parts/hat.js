'use strict';
const G = require('../geom');

function dome(color, dark, o) {
  const opt = o || {};
  const top = opt.top || 94;
  const half = opt.half || 84;
  const x0 = 300 - half;
  const x1 = 300 + half;
  const bot = opt.bot || 190;
  return G.F('M' + x0 + ' ' + bot + ' C' + x0 + ' ' + (top + 34) + ' ' + (300 - half * 0.62) + ' ' + top + ' 300 ' + top
    + ' C' + (300 + half * 0.62) + ' ' + top + ' ' + x1 + ' ' + (top + 34) + ' ' + x1 + ' ' + bot + ' Z', color,
    { stroke: dark, 'stroke-width': 6, 'stroke-linejoin': 'round' });
}

function band(x, y, w, h, color, dark, r) {
  return G.rect(x, y, w, h, color, { rx: r === undefined ? h / 2 : r, stroke: dark, 'stroke-width': 5 });
}

function brimRight(color, dark) {
  return G.F('M300 180 C356 180 400 190 414 208 C426 224 406 238 376 234 C344 230 312 216 298 204 Z', color,
    { stroke: dark, 'stroke-width': 6, 'stroke-linejoin': 'round' });
}

module.exports = [
  { key: 'hat-straw', slot: 'hat', label: '草帽', legacy: true },
  { key: 'hat-bucket', slot: 'hat', label: '渔夫帽', legacy: true },
  { key: 'hat-crown', slot: 'hat', label: '皇冠', legacy: true },
  { key: 'hat-bow', slot: 'hat', label: '蝴蝶结发箍', legacy: true },
  {
    key: 'hat-beanie', slot: 'hat', label: '针织帽',
    art: () => [
      G.circle(300, 62, 33, '#ffb3d1'), G.circle(300, 62, 33, 'none', { fill: '#ffb3d1', stroke: '#e07ba6', 'stroke-width': 5 }),
      dome('#f9a8c8', '#e07ba6', { top: 92, bot: 178, half: 86 }),
      band(212, 168, 176, 36, '#ffd0e4', '#e07ba6'),
      G.S('M232 174 L232 200 M256 174 L256 200 M280 174 L280 200 M304 174 L304 200 M328 174 L328 200 M352 174 L352 200 M372 174 L372 200', '#e07ba6', 4),
    ],
  },
  {
    key: 'hat-beret', slot: 'hat', label: '贝雷帽',
    art: () => [
      G.ellipse(292, 146, 102, 56, '#8f6bd8', { stroke: '#6b4bb0', 'stroke-width': 6 }),
      G.ellipse(292, 146, 70, 30, '#a487e4', { opacity: 0.7 }),
      G.circle(292, 96, 11, '#6b4bb0'),
      G.S('M208 168 C240 192 348 192 380 162', '#6b4bb0', 6),
    ],
  },
  {
    key: 'hat-cap', slot: 'hat', label: '棒球帽',
    art: () => [
      dome('#5fb0ea', '#2f7fbd', { top: 96, bot: 186, half: 84 }),
      brimRight('#3f97d8', '#2f7fbd'),
      G.circle(300, 94, 10, '#2f7fbd'),
      G.S('M300 118 L300 186', '#2f7fbd', 5, { opacity: 0.8 }),
    ],
  },
  {
    key: 'hat-visor', slot: 'hat', label: '遮阳空顶帽',
    art: () => [
      band(210, 168, 180, 30, '#ffd75e', '#dfae3c'),
      brimRight('#ffe9a0', '#dfae3c'),
      G.F(G.starPath(300, 183, 14), '#ff8fb3'),
    ],
  },
  {
    key: 'hat-wizard', slot: 'hat', label: '巫师帽',
    art: () => [
      G.F(G.poly([[300, 20], [228, 178], [372, 178]]), '#6b4bb0', { stroke: '#4d3389', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.ellipse(300, 184, 122, 32, '#7d5cc4', { stroke: '#4d3389', 'stroke-width': 6 }),
      G.F(G.starPath(300, 96, 20), '#ffd75e'),
      G.F(G.starPath(268, 140, 12), '#ffe9a0'),
      G.F(G.starPath(332, 132, 12), '#ffe9a0'),
    ],
  },
  {
    key: 'hat-party', slot: 'hat', label: '派对帽',
    art: () => [
      G.F(G.poly([[300, 56], [238, 194], [362, 194]]), '#5fd0b8', { stroke: '#33a891', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[284, 116], [316, 116], [322, 134], [278, 134]]), '#ffe9a0'),
      G.F(G.poly([[266, 160], [334, 160], [340, 178], [260, 178]]), '#ffe9a0'),
      G.circle(300, 52, 16, '#ff8fb3'),
    ],
  },
  {
    key: 'hat-cat', slot: 'hat', label: '猫耳发箍',
    art: () => [
      G.S('M206 192 C226 146 258 122 300 118 C342 122 374 146 394 192', '#4a3a52', 14),
      G.F(G.poly([[232, 132], [214, 78], [278, 104]]), '#5c4a66', { stroke: '#4a3a52', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[368, 132], [386, 78], [322, 104]]), '#5c4a66', { stroke: '#4a3a52', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[244, 124], [232, 94], [268, 108]]), '#ffb3d1'),
      G.F(G.poly([[356, 124], [368, 94], [332, 108]]), '#ffb3d1'),
    ],
  },
  {
    key: 'hat-bunny', slot: 'hat', label: '兔耳发箍',
    art: () => [
      G.S('M212 190 C230 148 260 124 300 120 C340 124 370 148 388 190', '#e07ba6', 14),
      G.ellipse(258, 82, 26, 66, '#ffffff', { stroke: '#e07ba6', 'stroke-width': 6 }),
      G.ellipse(342, 78, 26, 70, '#ffffff', { stroke: '#e07ba6', 'stroke-width': 6 }),
      G.ellipse(258, 84, 13, 44, '#ffb3d1'),
      G.ellipse(342, 80, 13, 48, '#ffb3d1'),
    ],
  },
  {
    key: 'hat-santa', slot: 'hat', label: '圣诞帽',
    art: () => [
      dome('#e8455f', '#b8324a', { top: 92, bot: 176, half: 84 }),
      G.F('M382 120 C432 112 456 150 438 178 C428 194 404 192 394 178 C384 164 384 138 382 120 Z', '#e8455f', { stroke: '#b8324a', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      band(206, 166, 188, 34, '#ffffff', '#dcdce4'),
      G.circle(438, 182, 22, '#ffffff'),
    ],
  },
  {
    key: 'hat-flower', slot: 'hat', label: '花朵发箍',
    art: () => [
      G.S('M208 190 C228 148 258 124 300 120 C342 124 372 148 392 190', '#8ac96f', 12),
      G.circle(244, 128, 20, '#ff9ecb'), G.circle(268, 112, 20, '#ff9ecb'),
      G.circle(268, 146, 20, '#ff9ecb'), G.circle(222, 150, 20, '#ff9ecb'),
      G.circle(246, 132, 15, '#ffd75e'),
      G.circle(356, 132, 14, '#ffffff'), G.circle(340, 152, 12, '#ffffff'), G.circle(366, 156, 12, '#ffffff'),
    ],
  },
  {
    key: 'hat-pirate', slot: 'hat', label: '海盗帽',
    art: () => [
      dome('#3a4150', '#252a36', { top: 108, bot: 168, half: 76 }),
      G.F('M198 168 C238 126 362 126 402 168 C416 186 396 206 356 200 C320 194 280 194 244 200 C204 206 184 186 198 168 Z', '#4a5261', { stroke: '#252a36', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.S('M204 172 C244 140 356 140 396 172', '#f0c34a', 6),
      G.F(G.starPath(300, 138, 16), '#f0c34a'),
    ],
  },
  {
    key: 'hat-chef', slot: 'hat', label: '厨师帽',
    art: () => [
      G.circle(248, 116, 44, '#ffffff'), G.circle(300, 92, 50, '#ffffff'),
      G.circle(352, 116, 44, '#ffffff'), G.circle(300, 132, 44, '#ffffff'),
      band(236, 148, 128, 44, '#f2f4f8', '#d2d8e0', 10),
      G.S('M258 156 L258 186 M300 152 L300 186 M342 156 L342 186', '#d2d8e0', 5),
    ],
  },
  {
    key: 'hat-cowboy', slot: 'hat', label: '牛仔帽',
    art: () => [
      G.F('M256 178 C256 132 272 108 300 108 C328 108 344 132 344 178 Z', '#c58a52', { stroke: '#96612f', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.ellipse(300, 182, 136, 34, '#d99a5e', { stroke: '#96612f', 'stroke-width': 6 }),
      G.S('M270 128 C282 140 318 140 330 128', '#96612f', 6),
      band(252, 158, 96, 20, '#8a5a2b', '#6f4620', 8),
    ],
  },
  {
    key: 'hat-tiara', slot: 'hat', label: '小皇冠',
    art: () => [
      G.S('M240 176 C258 140 342 140 360 176', '#f0c34a', 10),
      G.F(G.poly([[258, 160], [266, 118], [282, 152]]), '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[286, 152], [300, 104], [314, 152]]), '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F(G.poly([[318, 152], [334, 118], [342, 160]]), '#ffd75e', { stroke: '#dfae3c', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.circle(300, 112, 9, '#ff8fb3'), G.circle(266, 126, 7, '#8fd8ff'), G.circle(334, 126, 7, '#8fd8ff'),
    ],
  },
  {
    key: 'hat-lace-band', slot: 'hat', label: '蕾丝发带',
    art: () => [
      G.S('M212 188 C230 146 260 122 300 118 C340 122 370 146 388 188', '#ffffff', 16),
      G.S('M212 188 C230 146 260 122 300 118 C340 122 370 146 388 188', '#e8d6f2', 22, { opacity: 0.55 }),
      G.circle(232, 162, 11, '#ffffff'), G.circle(254, 136, 11, '#ffffff'), G.circle(284, 122, 11, '#ffffff'),
      G.circle(316, 122, 11, '#ffffff'), G.circle(346, 136, 11, '#ffffff'), G.circle(368, 162, 11, '#ffffff'),
      G.F(G.heartPath(300, 118, 16), '#ff9ecb'),
    ],
  },
  {
    key: 'hat-veil', slot: 'hat', label: '新娘头纱',
    art: () => [
      G.F('M236 138 C196 200 190 300 208 400 L266 400 C248 300 252 202 272 148 Z', '#ffffff', { opacity: 0.6 }),
      G.F('M364 138 C404 200 410 300 392 400 L334 400 C352 300 348 202 328 148 Z', '#ffffff', { opacity: 0.6 }),
      G.S('M236 140 C206 210 202 320 216 398', '#ffffff', 7, { opacity: 0.9 }),
      G.S('M364 140 C394 210 398 320 384 398', '#ffffff', 7, { opacity: 0.9 }),
      G.F('M258 150 C272 128 328 128 342 150 C330 168 270 168 258 150 Z', '#ffffff', { stroke: '#e0c9f0', 'stroke-width': 5 }),
      G.circle(300, 140, 12, '#ff9ecb'), G.circle(266, 148, 8, '#ffd75e'), G.circle(334, 148, 8, '#ffd75e'),
    ],
  },
];
