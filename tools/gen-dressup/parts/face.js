'use strict';
const G = require('../geom');

const SKIN = G.SKIN;
const EX = [272, 328];
const EY = 222;

function cover() {
  return [G.ellipse(EX[0], EY, 20, 22, SKIN), G.ellipse(EX[1], EY, 20, 22, SKIN)];
}

function roundEye(cx, iris, pupil) {
  return [
    G.ellipse(cx, EY, 17, 19, '#ffffff', { stroke: '#d8c3b4', 'stroke-width': 2 }),
    G.circle(cx, EY + 2, 13, iris),
    G.circle(cx, EY + 2, 6.5, pupil),
    G.circle(cx - 6, EY - 6, 6, '#ffffff', { opacity: 0.95 }),
    G.circle(cx + 6, EY + 8, 3, '#ffffff', { opacity: 0.7 }),
    G.S('M' + (cx - 19) + ' 208 Q' + cx + ' 197 ' + (cx + 19) + ' 208', '#5b4030', 5),
  ];
}

function lensLens(cx, rx, ry, fill, line) {
  return G.ellipse(cx, EY, rx, ry, fill, { stroke: line, 'stroke-width': 5 });
}

function bridge(color) {
  return G.S('M290 216 Q300 210 310 216', color, 5);
}

function temples(color) {
  return G.S('M212 214 L240 212 M360 212 L388 214', color, 5);
}

function lipBase() {
  return [G.ellipse(300, 262, 26, 16, SKIN)];
}

module.exports = [
  { key: 'eyes-star', slot: 'face', label: '星星眼', legacy: true },
  { key: 'eyes-heart', slot: 'face', label: '爱心眼', legacy: true },
  { key: 'glasses-round', slot: 'face', label: '圆框眼镜', legacy: true },
  { key: 'glasses-heart', slot: 'face', label: '爱心眼镜', legacy: true },
  {
    key: 'eyes-round', slot: 'face', label: '圆亮大眼',
    art: () => cover().concat(roundEye(EX[0], '#4a3a2f', '#2a2024'), roundEye(EX[1], '#4a3a2f', '#2a2024')),
  },
  {
    key: 'eyes-blue', slot: 'face', label: '蓝色大眼',
    art: () => cover().concat(roundEye(EX[0], '#5fb0ea', '#2f6fa8'), roundEye(EX[1], '#5fb0ea', '#2f6fa8')),
  },
  {
    key: 'eyes-green', slot: 'face', label: '绿色大眼',
    art: () => cover().concat(roundEye(EX[0], '#5fbf8f', '#2f8a63'), roundEye(EX[1], '#5fbf8f', '#2f8a63')),
  },
  {
    key: 'eyes-closed', slot: 'face', label: '弯弯笑眼',
    art: () => cover().concat([
      G.S('M254 232 Q272 206 290 232', '#7a5a45', 6),
      G.S('M310 232 Q328 206 346 232', '#7a5a45', 6),
      G.S('M250 224 Q256 220 262 222', '#7a5a45', 4),
      G.S('M350 224 Q344 220 338 222', '#7a5a45', 4),
    ]),
  },
  {
    key: 'eyes-wink', slot: 'face', label: '俏皮眨眼',
    art: () => cover().concat([
      G.S('M252 230 Q272 204 292 230', '#7a5a45', 6),
    ], roundEye(EX[1], '#4a3a2f', '#2a2024')),
  },
  {
    key: 'eyes-lashes', slot: 'face', label: '长睫毛',
    art: () => cover().concat(roundEye(EX[0], '#5a4436', '#2a2024'), roundEye(EX[1], '#5a4436', '#2a2024'), [
      G.S('M252 206 L242 190 M264 200 L258 182 M278 198 L276 180', '#3f2f26', 5),
      G.S('M348 206 L358 190 M336 200 L342 182 M322 198 L324 180', '#3f2f26', 5),
    ]),
  },
  {
    key: 'glasses-cat', slot: 'face', label: '猫眼墨镜',
    art: () => [
      G.F('M242 198 C266 188 294 194 300 208 C306 224 292 242 272 246 C250 250 236 236 238 216 C239 208 240 202 242 198 Z', '#3a3f4a', { stroke: '#22262e', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F('M358 198 C334 188 306 194 300 208 C294 224 308 242 328 246 C350 250 364 236 362 216 C361 208 360 202 358 198 Z', '#3a3f4a', { stroke: '#22262e', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.S('M218 210 L240 206 M382 210 L360 206', '#22262e', 5),
      G.S('M296 208 Q300 202 304 208', '#22262e', 5),
      G.circle(258, 212, 5, '#ffffff', { opacity: 0.35 }), G.circle(342, 212, 5, '#ffffff', { opacity: 0.35 }),
    ],
  },
  {
    key: 'glasses-star', slot: 'face', label: '星星墨镜',
    art: () => [
      G.F(G.starPath(EX[0], EY, 27, 0.55), '#4a3f6b', { stroke: '#33285a', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      G.F(G.starPath(EX[1], EY, 27, 0.55), '#4a3f6b', { stroke: '#33285a', 'stroke-width': 5, 'stroke-linejoin': 'round' }),
      bridge('#33285a'), temples('#33285a'),
      G.F(G.starPath(EX[0] - 6, EY - 6, 8), '#ffffff', { opacity: 0.5 }),
    ],
  },
  {
    key: 'glasses-oval', slot: 'face', label: '金丝眼镜',
    art: () => [
      G.ellipse(EX[0], EY, 27, 19, 'none', { stroke: '#e0a93c', 'stroke-width': 4 }),
      G.ellipse(EX[1], EY, 27, 19, 'none', { stroke: '#e0a93c', 'stroke-width': 4 }),
      bridge('#e0a93c'), temples('#e0a93c'),
      G.S('M248 204 Q272 190 296 204', '#ffffff', 4, { opacity: 0.7 }),
    ],
  },
  {
    key: 'glasses-mask', slot: 'face', label: '舞会面具',
    art: () => [
      G.F('M216 214 C216 190 240 176 272 178 C286 179 294 186 300 194 C306 186 314 179 328 178 C360 176 384 190 384 214 C384 244 356 262 322 258 C308 256 302 246 300 240 C298 246 292 256 278 258 C244 262 216 244 216 214 Z', '#7d5cc4', { stroke: '#5b3f9c', 'stroke-width': 6, 'stroke-linejoin': 'round' }),
      G.F(G.starPath(248, 202, 14), '#ffd75e'), G.F(G.starPath(352, 202, 14), '#ffd75e'),
      G.S('M216 200 C248 186 280 194 300 206', '#ffd75e', 4, { opacity: 0.8 }),
      G.S('M384 200 C352 186 320 194 300 206', '#ffd75e', 4, { opacity: 0.8 }),
    ],
  },
  {
    key: 'lips-pink', slot: 'lip', cat: 'face', label: '粉粉唇',
    art: () => lipBase().concat([
      G.F('M282 258 C290 250 296 254 300 258 C304 254 310 250 318 258 C314 272 306 278 300 278 C294 278 286 272 282 258 Z', '#ff8fb3', { stroke: '#e0689f', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      G.S('M300 258 L300 262', '#e0689f', 3),
      G.ellipse(292, 264, 5, 3, '#ffffff', { opacity: 0.7 }),
    ]),
  },
  {
    key: 'lips-red', slot: 'lip', cat: 'face', label: '红唇',
    art: () => lipBase().concat([
      G.F('M280 256 C290 246 296 252 300 257 C304 252 310 246 320 256 C316 274 306 280 300 280 C294 280 284 274 280 256 Z', '#e0455f', { stroke: '#b32e46', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      G.S('M285 258 Q300 266 315 258', '#b32e46', 3),
    ]),
  },
  {
    key: 'lips-gloss', slot: 'lip', cat: 'face', label: '闪亮唇彩',
    art: () => lipBase().concat([
      G.F('M282 258 C290 250 296 254 300 258 C304 254 310 250 318 258 C314 272 306 278 300 278 C294 278 286 272 282 258 Z', '#c76ad8', { stroke: '#9a45ad', 'stroke-width': 4, 'stroke-linejoin': 'round' }),
      G.F(G.starPath(288, 266, 5), '#ffffff'), G.F(G.starPath(312, 268, 4), '#ffffff'),
    ]),
  },
  {
    key: 'cheek-blush', slot: 'lip', cat: 'face', label: '红脸蛋',
    art: () => [
      G.ellipse(248, 250, 20, 13, '#ff8fb3', { opacity: 0.55 }),
      G.ellipse(352, 250, 20, 13, '#ff8fb3', { opacity: 0.55 }),
      G.S('M232 250 L240 250 M360 250 L368 250', '#ff8fb3', 3, { opacity: 0.6 }),
    ],
  },
  {
    key: 'cheek-freckles', slot: 'lip', cat: 'face', label: '小雀斑',
    art: () => [
      G.ellipse(250, 250, 19, 12, '#ffb08f', { opacity: 0.45 }),
      G.ellipse(350, 250, 19, 12, '#ffb08f', { opacity: 0.45 }),
      G.circle(240, 246, 3, '#c98a6a'), G.circle(250, 254, 3, '#c98a6a'), G.circle(260, 246, 3, '#c98a6a'), G.circle(246, 240, 2.6, '#c98a6a'),
      G.circle(360, 246, 3, '#c98a6a'), G.circle(350, 254, 3, '#c98a6a'), G.circle(340, 246, 3, '#c98a6a'), G.circle(354, 240, 2.6, '#c98a6a'),
    ],
  },
];
