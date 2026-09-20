'use strict';
const G = require('../geom');

function pair(fn) {
  return [fn(266, 726), fn(334, 726)];
}

function sole(cx, cy, fill, line, w, h, y) {
  return G.rect(cx - (w || 32), (y === undefined ? cy + 8 : y), (w || 32) * 2, h || 18, fill, { rx: (h || 18) / 2, stroke: line, 'stroke-width': 5 });
}

function sockLeg(side, topY, fill, line, w) {
  const a = G.legPoint(side, topY);
  const b = G.legPoint(side, 716);
  return [
    G.S('M' + Math.round(a.x) + ' ' + topY + ' L' + Math.round(b.x) + ' 716', line, (w || 46) + 10, { 'stroke-linecap': 'butt' }),
    G.S('M' + Math.round(a.x) + ' ' + topY + ' L' + Math.round(b.x) + ' 716', fill, w || 46, { 'stroke-linecap': 'butt' }),
  ];
}

function sockPair(topY, fill, line, w) {
  return sockLeg('l', topY, fill, line, w).concat(sockLeg('r', topY, fill, line, w));
}

module.exports = [
  { key: 'shoes-sneaker', slot: 'shoes', label: '运动鞋', legacy: true },
  { key: 'shoes-sandal', slot: 'shoes', label: '凉鞋', legacy: true },
  {
    key: 'shoes-mary', slot: 'shoes', label: '玛丽珍鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 30) + ' ' + (cy + 14) + ' C' + (cx - 30) + ' ' + (cy - 16) + ' ' + (cx + 14) + ' ' + (cy - 24) + ' ' + (cx + 30) + ' ' + (cy - 6) + ' L' + (cx + 30) + ' ' + (cy + 14) + ' Z', '#3a3f4a', { stroke: '#22262e', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.S('M' + (cx - 22) + ' ' + (cy - 4) + ' L' + (cx + 24) + ' ' + (cy - 4), '#ff8fb3', 9)),
      pair((cx, cy) => G.circle(cx + 20, cy - 6, 8, '#ff8fb3', { stroke: '#e0689f', 'stroke-width': 4 })),
      pair((cx, cy) => sole(cx, cy, '#22262e', '#22262e', 32, 16))
    ),
  },
  {
    key: 'shoes-boot', slot: 'shoes', label: '小皮靴',
    art: () => pair((cx, cy) => G.F('M' + (cx - 30) + ' ' + (cy + 16) + ' L' + (cx - 30) + ' ' + (cy - 76) + ' C' + (cx - 30) + ' ' + (cy - 84) + ' ' + (cx + 16) + ' ' + (cy - 84) + ' ' + (cx + 16) + ' ' + (cy - 76) + ' L' + (cx + 18) + ' ' + (cy + 2) + ' C' + (cx + 34) + ' ' + (cy + 6) + ' ' + (cx + 34) + ' ' + (cy + 16) + ' ' + (cx + 18) + ' ' + (cy + 16) + ' Z', '#8a5a2b', { stroke: '#6f4620', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.rect(cx - 32, cy - 78, 50, 14, '#a8763f', { rx: 6, stroke: '#6f4620', 'stroke-width': 4 })),
      pair((cx, cy) => sole(cx, cy, '#4a3a2a', '#4a3a2a', 30, 14)),
      pair((cx, cy) => G.S('M' + (cx - 24) + ' ' + (cy - 30) + ' L' + (cx + 12) + ' ' + (cy - 30), '#ffd75e', 5))
    ),
  },
  {
    key: 'shoes-rain', slot: 'shoes', label: '雨靴',
    art: () => pair((cx, cy) => G.F('M' + (cx - 28) + ' ' + (cy + 18) + ' L' + (cx - 28) + ' ' + (cy - 60) + ' C' + (cx - 28) + ' ' + (cy - 68) + ' ' + (cx + 16) + ' ' + (cy - 68) + ' ' + (cx + 16) + ' ' + (cy - 60) + ' L' + (cx + 18) + ' ' + (cy) + ' C' + (cx + 34) + ' ' + (cy + 4) + ' ' + (cx + 34) + ' ' + (cy + 18) + ' ' + (cx + 16) + ' ' + (cy + 18) + ' Z', '#ffe08a', { stroke: '#dfae3c', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.rect(cx - 30, cy - 64, 48, 16, '#ff9ecb', { rx: 8, stroke: '#d0689f', 'stroke-width': 4 })),
      pair((cx, cy) => sole(cx, cy, '#dfae3c', '#dfae3c', 30, 16)),
      pair((cx, cy) => G.F(G.heartPath(cx - 6, cy - 30, 9), '#ff9ecb'))
    ),
  },
  {
    key: 'shoes-ballet', slot: 'shoes', label: '芭蕾舞鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 28) + ' ' + (cy + 12) + ' C' + (cx - 28) + ' ' + (cy - 10) + ' ' + (cx + 6) + ' ' + (cy - 18) + ' ' + (cx + 26) + ' ' + (cy - 4) + ' C' + (cx + 34) + ' ' + (cy + 6) + ' ' + (cx + 26) + ' ' + (cy + 14) + ' ' + (cx + 10) + ' ' + (cy + 14) + ' Z', '#ffd6ef', { stroke: '#e0a8c8', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.S('M' + (cx - 14) + ' ' + (cy - 12) + ' L' + (cx + 20) + ' ' + (cy + 4), '#ff9ecb', 7)),
      pair((cx, cy) => G.S('M' + (cx - 14) + ' ' + (cy - 14) + ' L' + (cx + 22) + ' ' + (cy - 2), '#e0a8c8', 4)),
      pair((cx, cy) => sole(cx, cy, '#e0a8c8', '#e0a8c8', 27, 10))
    ),
  },
  {
    key: 'shoes-slipper', slot: 'shoes', label: '小兔拖鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 30) + ' ' + (cy + 16) + ' C' + (cx - 36) + ' ' + (cy - 14) + ' ' + (cx + 34) + ' ' + (cy - 22) + ' ' + (cx + 32) + ' ' + (cy + 8) + ' C' + (cx + 32) + ' ' + (cy + 18) + ' ' + (cx - 26) + ' ' + (cy + 20) + ' ' + (cx - 30) + ' ' + (cy + 16) + ' Z', '#ffffff', { stroke: '#e0c9e8', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.ellipse(cx - 10, cy - 30, 9, 22, '#ffffff', { stroke: '#e0c9e8', 'stroke-width': 4 })),
      pair((cx, cy) => G.ellipse(cx + 6, cy - 32, 9, 22, '#ffffff', { stroke: '#e0c9e8', 'stroke-width': 4 })),
      pair((cx, cy) => G.circle(cx - 12, cy - 4, 4, '#3c2f3a')),
      pair((cx, cy) => G.circle(cx + 8, cy - 6, 4, '#3c2f3a')),
      pair((cx, cy) => G.F(G.heartPath(cx - 2, cy + 6, 7), '#ff9ecb'))
    ),
  },
  {
    key: 'shoes-jelly', slot: 'shoes', label: '果冻凉鞋',
    art: () => pair((cx, cy) => G.ellipse(cx, cy + 6, 32, 16, '#ffb8d4', { opacity: 0.85 })).concat(
      pair((cx, cy) => G.ellipse(cx, cy + 6, 32, 16, 'none', { fill: 'none', stroke: '#e0689f', 'stroke-width': 5 })),
      pair((cx, cy) => G.S('M' + (cx - 22) + ' ' + (cy - 2) + ' C' + (cx - 10) + ' ' + (cy - 16) + ' ' + (cx + 10) + ' ' + (cy - 16) + ' ' + (cx + 22) + ' ' + (cy - 2), '#ff8fb3', 8)),
      pair((cx, cy) => G.F(G.starPath(cx, cy + 2, 10), '#ffffff', { opacity: 0.9 }))
    ),
  },
  {
    key: 'shoes-glass', slot: 'shoes', label: '水晶鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 26) + ' ' + (cy + 10) + ' C' + (cx - 26) + ' ' + (cy - 12) + ' ' + (cx + 4) + ' ' + (cy - 20) + ' ' + (cx + 26) + ' ' + (cy - 6) + ' C' + (cx + 34) + ' ' + (cy + 2) + ' ' + (cx + 26) + ' ' + (cy + 12) + ' ' + (cx + 8) + ' ' + (cy + 12) + ' Z', '#cfeaff', { opacity: 0.9 })).concat(
      pair((cx, cy) => G.S('M' + (cx + 26) + ' ' + (cy + 6) + ' C' + (cx + 26) + ' ' + (cy - 6) + ' ' + (cx + 6) + ' ' + (cy - 20) + ' ' + (cx - 26) + ' ' + (cy + 10), '#9fc9e8', 4)),
      pair((cx, cy) => G.F(G.starPath(cx - 6, cy - 2, 9), '#ffffff')),
      pair((cx, cy) => sole(cx, cy, '#9fc9e8', '#9fc9e8', 26, 8))
    ),
  },
  {
    key: 'shoes-cowboy', slot: 'shoes', label: '牛仔靴',
    art: () => pair((cx, cy) => G.F('M' + (cx - 32) + ' ' + (cy + 14) + ' L' + (cx - 30) + ' ' + (cy - 70) + ' C' + (cx - 30) + ' ' + (cy - 80) + ' ' + (cx + 18) + ' ' + (cy - 80) + ' ' + (cx + 18) + ' ' + (cy - 70) + ' L' + (cx + 20) + ' ' + (cy + 4) + ' C' + (cx + 44) + ' ' + (cy + 8) + ' ' + (cx + 40) + ' ' + (cy + 18) + ' ' + (cx + 16) + ' ' + (cy + 16) + ' Z', '#c58a52', { stroke: '#96612f', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.S('M' + (cx - 26) + ' ' + (cy - 30) + ' L' + (cx + 16) + ' ' + (cy - 26), '#96612f', 5)),
      pair((cx, cy) => G.F(G.starPath(cx - 6, cy - 8, 12), '#ffd75e')),
      pair((cx, cy) => G.rect(cx - 32, cy - 74, 52, 14, '#8a5a2b', { rx: 6, stroke: '#6f4620', 'stroke-width': 4 }))
    ),
  },
  {
    key: 'shoes-snow', slot: 'shoes', label: '雪地靴',
    art: () => pair((cx, cy) => G.F('M' + (cx - 34) + ' ' + (cy + 18) + ' L' + (cx - 32) + ' ' + (cy - 54) + ' C' + (cx - 32) + ' ' + (cy - 64) + ' ' + (cx + 20) + ' ' + (cy - 64) + ' ' + (cx + 20) + ' ' + (cy - 54) + ' L' + (cx + 22) + ' ' + (cy + 4) + ' C' + (cx + 38) + ' ' + (cy + 8) + ' ' + (cx + 38) + ' ' + (cy + 18) + ' ' + (cx + 18) + ' ' + (cy + 18) + ' Z', '#c9a8f0', { stroke: '#8f6bd8', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.rect(cx - 36, cy - 62, 60, 20, '#f7f4ee', { rx: 10, stroke: '#d8d0c4', 'stroke-width': 4 })),
      pair((cx, cy) => sole(cx, cy, '#8f6bd8', '#8f6bd8', 32, 16)),
      pair((cx, cy) => G.S('M' + (cx - 26) + ' ' + (cy - 20) + ' L' + (cx + 14) + ' ' + (cy - 20), '#f7f4ee', 5))
    ),
  },
  {
    key: 'shoes-flip', slot: 'shoes', label: '人字拖',
    art: () => pair((cx, cy) => G.ellipse(cx, cy + 8, 30, 14, '#5fd0b8', { stroke: '#33a891', 'stroke-width': 5 })).concat(
      pair((cx, cy) => G.S('M' + (cx - 16) + ' ' + (cy - 4) + ' L' + (cx + 2) + ' ' + (cy + 8) + ' L' + (cx + 18) + ' ' + (cy - 6), '#33a891', 6)),
      pair((cx, cy) => G.circle(cx - 16, cy - 4, 5, '#ffffff')),
      pair((cx, cy) => G.circle(cx + 18, cy - 6, 5, '#ffffff'))
    ),
  },
  {
    key: 'shoes-sport', slot: 'shoes', label: '跑鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 32) + ' ' + (cy + 14) + ' C' + (cx - 34) + ' ' + (cy - 12) + ' ' + (cx + 12) + ' ' + (cy - 28) + ' ' + (cx + 30) + ' ' + (cy - 8) + ' C' + (cx + 36) + ' ' + (cy - 2) + ' ' + (cx + 34) + ' ' + (cy + 16) + ' ' + (cx + 14) + ' ' + (cy + 16) + ' Z', '#ff6b8a', { stroke: '#d84a6b', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.S('M' + (cx - 24) + ' ' + (cy - 10) + ' L' + (cx + 22) + ' ' + (cy - 12), '#ffffff', 6)),
      pair((cx, cy) => G.S('M' + (cx - 22) + ' ' + (cy - 1) + ' L' + (cx + 26) + ' ' + (cy - 3), '#ffffff', 6)),
      pair((cx, cy) => sole(cx, cy, '#ffffff', '#d84a6b', 32, 16)),
      pair((cx, cy) => G.S('M' + (cx - 14) + ' ' + (cy + 10) + ' L' + (cx + 20) + ' ' + (cy + 8), '#d84a6b', 4))
    ),
  },
  {
    key: 'shoes-platform', slot: 'shoes', label: '厚底鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 30) + ' ' + (cy + 4) + ' C' + (cx - 30) + ' ' + (cy - 14) + ' ' + (cx + 8) + ' ' + (cy - 22) + ' ' + (cx + 28) + ' ' + (cy - 6) + ' L' + (cx + 28) + ' ' + (cy + 4) + ' Z', '#3a3f4a', { stroke: '#22262e', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.rect(cx - 32, cy + 4, 64, 26, '#f2f4f8', { rx: 10, stroke: '#9aa2ae', 'stroke-width': 5 })),
      pair((cx, cy) => G.S('M' + (cx - 24) + ' ' + (cy - 6) + ' L' + (cx + 22) + ' ' + (cy - 6), '#ffd75e', 6)),
      pair((cx, cy) => G.F(G.starPath(cx + 2, cy - 12, 10), '#ff9ecb'))
    ),
  },
  {
    key: 'shoes-ice', slot: 'shoes', label: '滑冰鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 28) + ' ' + (cy - 2) + ' L' + (cx - 28) + ' ' + (cy - 66) + ' C' + (cx - 28) + ' ' + (cy - 76) + ' ' + (cx + 16) + ' ' + (cy - 76) + ' ' + (cx + 16) + ' ' + (cy - 66) + ' L' + (cx + 16) + ' ' + (cy - 2) + ' Z', '#ffffff', { stroke: '#9fc9e8', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.S('M' + (cx - 24) + ' ' + (cy - 40) + ' L' + (cx + 12) + ' ' + (cy - 40), '#9fc9e8', 5)),
      pair((cx, cy) => G.S('M' + (cx - 34) + ' ' + (cy + 20) + ' L' + (cx + 34) + ' ' + (cy + 20), '#8fa6b8', 6)),
      pair((cx, cy) => G.S('M' + (cx - 34) + ' ' + (cy + 20) + ' L' + (cx - 34) + ' ' + (cy + 10), '#8fa6b8', 5)),
      pair((cx, cy) => G.S('M' + (cx + 34) + ' ' + (cy + 20) + ' L' + (cx + 34) + ' ' + (cy + 10), '#8fa6b8', 5)),
      pair((cx, cy) => G.S('M' + (cx - 2) + ' ' + (cy + 4) + ' L' + (cx - 2) + ' ' + (cy + 14), '#8fa6b8', 6))
    ),
  },
  {
    key: 'shoes-roller', slot: 'shoes', label: '轮滑鞋',
    art: () => pair((cx, cy) => G.F('M' + (cx - 28) + ' ' + (cy - 4) + ' L' + (cx - 28) + ' ' + (cy - 60) + ' C' + (cx - 28) + ' ' + (cy - 70) + ' ' + (cx + 16) + ' ' + (cy - 70) + ' ' + (cx + 16) + ' ' + (cy - 60) + ' L' + (cx + 16) + ' ' + (cy - 4) + ' Z', '#ff9ecb', { stroke: '#d0689f', 'stroke-width': 5, 'stroke-linejoin': 'round' })).concat(
      pair((cx, cy) => G.S('M' + (cx - 24) + ' ' + (cy - 36) + ' L' + (cx + 12) + ' ' + (cy - 36), '#ffffff', 5)),
      pair((cx, cy) => G.circle(cx - 18, cy + 16, 10, '#4a5261', { stroke: '#2f3640', 'stroke-width': 4 })),
      pair((cx, cy) => G.circle(cx + 14, cy + 16, 10, '#4a5261', { stroke: '#2f3640', 'stroke-width': 4 })),
      pair((cx, cy) => G.S('M' + (cx - 22) + ' ' + (cy + 4) + ' L' + (cx + 18) + ' ' + (cy + 4), '#4a5261', 6))
    ),
  },
  {
    key: 'socks-white', slot: 'leg', cat: 'shoes', label: '白色长袜',
    art: () => sockPair(618, '#ffffff', '#d8d0c4', 44).concat([G.S('M256 620 L272 620 M338 620 L354 620', '#d8d0c4', 5)]),
  },
  {
    key: 'socks-stripe', slot: 'leg', cat: 'shoes', label: '条纹长袜',
    art: () => sockPair(614, '#ffffff', '#ff8fb3', 46).concat((function () {
      const out = [];
      for (let y = 636; y < 716; y += 26) {
        ['l', 'r'].forEach((side) => {
          const p = G.legPoint(side, y);
          out.push(G.S('M' + Math.round(p.x - 24) + ' ' + y + ' L' + Math.round(p.x + 24) + ' ' + y, '#ff8fb3', 10));
        });
      }
      return out;
    })()),
  },
  {
    key: 'socks-knee', slot: 'leg', cat: 'shoes', label: '薄荷长袜',
    art: () => sockPair(600, '#9be0c4', '#5fb99a', 46).concat([
      G.S('M244 602 L286 602 M314 602 L356 602', '#5fb99a', 8),
      G.F(G.heartPath(258, 606, 10), '#ff9ecb'), G.F(G.heartPath(342, 606, 10), '#ff9ecb'),
    ]),
  },
  {
    key: 'socks-star', slot: 'leg', cat: 'shoes', label: '星星长袜',
    art: () => sockPair(610, '#c9a8f0', '#8f6bd8', 46).concat([
      G.F(G.starPath(258, 660, 12), '#ffe9a0'), G.F(G.starPath(342, 700, 12), '#ffe9a0'),
      G.F(G.starPath(342, 650, 9), '#ffffff'), G.F(G.starPath(258, 700, 9), '#ffffff'),
    ]),
  },
];
