'use strict';
const G = require('../geom');

const CAP = { cy: 204, rx: 118, ry: 122 };

const HIT_LONG = [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 200, w: 96, h: 340 }, { x: 336, y: 200, w: 96, h: 340 }];
const HIT_TAIL = [{ x: 190, y: 88, w: 220, h: 130 }, { x: 100, y: 250, w: 108, h: 290 }, { x: 392, y: 250, w: 108, h: 290 }];
const HIT_BRAID = [{ x: 190, y: 88, w: 220, h: 130 }, { x: 168, y: 270, w: 84, h: 280 }, { x: 348, y: 270, w: 84, h: 280 }];
const HIT_SHORT = [{ x: 186, y: 86, w: 228, h: 140 }, { x: 176, y: 200, w: 104, h: 160 }, { x: 320, y: 200, w: 104, h: 160 }];

function cap(color, o) {
  const opt = o || {};
  return G.ellipse(300, opt.cy || CAP.cy, opt.rx || CAP.rx, opt.ry || CAP.ry, color);
}

// chin / shoulder length side mass, authored once and mirrored
function sideMass(botY, out, color) {
  const p0 = [238, 198];
  const segs = [
    [[202, 228], [out, 300], [out + 2, (botY + 300) / 2 + 22]],
    [[out + 4, botY - 26], [206, botY + 6], [226, botY]],
    [[240, botY + 2], [248, botY - 30], [248, botY - 74]],
    [[246, botY - 170], [242, 300], [250, 240]],
    [[252, 218], [246, 202], [238, 198]],
  ];
  return G.bothSides(p0, segs).map((d) => G.F(d, color));
}

function wavyLock(botY, out, color) {
  const p0 = [238, 198];
  const segs = [
    [[200, 228], [out, 296], [out + 16, 360]],
    [[out + 34, 416], [out - 14, 452], [out + 10, botY - 30]],
    [[out + 26, botY + 6], [232, botY + 4], [246, botY - 40]],
    [[254, botY - 130], [238, 430], [248, 330]],
    [[252, 252], [246, 206], [238, 198]],
  ];
  return G.bothSides(p0, segs).map((d) => G.F(d, color));
}

function tuft(botY, out, color) {
  const p0 = [240, 194];
  const segs = [
    [[206, 220], [out, 262], [out + 6, 300]],
    [[out + 12, botY - 6], [216, botY + 8], [236, botY - 4]],
    [[248, botY - 16], [246, 240], [252, 216]],
    [[254, 204], [248, 194], [240, 194]],
  ];
  return G.bothSides(p0, segs).map((d) => G.F(d, color));
}

function assemble(color, shapes, opts) {
  const o = opts || {};
  const out = [G.hairMask(!!o.ears)];
  out.push(G.group({ mask: 'url(#faceMask)' }, shapes));
  out.push(G.fringe(color, o.dip || 192));
  if (o.extra) o.extra.forEach((e) => out.push(e));
  return out;
}

function tailBlob(color, out, y, rx, ry) {
  return G.ellipse(300 - out, y, rx, ry, color);
}

function tieMark(color, cx, cy, r) {
  return G.circle(cx, cy, r, color);
}

const C = {
  brown: '#6b4c39', darkBrown: '#563b2b', chestnut: '#8a5a3c', ginger: '#c86a3c',
  jet: '#3a2f3a', jetDark: '#2b2230', blonde: '#e8c67a', blondeDark: '#cfa84f',
  plum: '#8a5a9a', silver: '#c9ced8', pink: '#ff9ecb', mint: '#5fd0b8',
  honey: '#d99a4e', ribbon: '#ff8fb3', star: '#ffd75e', tie: '#ff7fb8',
};

module.exports = [
  // ------------------------------------------------------------------ legacy
  {
    key: 'hair-long', slot: 'hair', label: '长直发', legacy: true,
    hit: [{ x: 220, y: 94, w: 160, h: 214 }, { x: 180, y: 236, w: 76, h: 324 }, { x: 344, y: 236, w: 76, h: 324 }],
  },
  {
    key: 'hair-twin', slot: 'hair', label: '双马尾', legacy: true,
    hit: [{ x: 220, y: 96, w: 160, h: 216 }, { x: 166, y: 228, w: 72, h: 236 }, { x: 362, y: 228, w: 72, h: 236 }],
  },
  {
    key: 'hair-curly', slot: 'hair', label: '公主卷', legacy: true,
    hit: [{ x: 220, y: 96, w: 160, h: 212 }, { x: 164, y: 228, w: 84, h: 336 }, { x: 352, y: 228, w: 84, h: 336 }],
  },
  // -------------------------------------------------------------------- new
  {
    key: 'hair-bob', slot: 'hair', label: '波波头', hit: HIT_SHORT,
    art: () => assemble(C.brown, [cap(C.brown)].concat(sideMass(352, 182, C.brown)), {}),
  },
  {
    key: 'hair-bob-ginger', slot: 'hair', label: '姜糖波波', hit: HIT_SHORT,
    art: () => assemble(C.ginger, [cap(C.ginger)].concat(sideMass(368, 186, C.ginger)), {
      ears: true,
      extra: [G.F('M240 124 C240 100 268 90 300 90 C332 90 360 100 360 124 L360 206 C360 210 356 212 352 212 L248 212 C244 212 240 210 240 206 Z', C.ginger)],
    }),
  },
  {
    key: 'hair-wavy', slot: 'hair', label: '波浪长发', hit: HIT_LONG,
    art: () => assemble(C.chestnut, [cap(C.chestnut)].concat(wavyLock(540, 174, C.chestnut)), {}),
  },
  {
    key: 'hair-wavy-black', slot: 'hair', label: '乌黑波浪', hit: HIT_LONG,
    art: () => assemble(C.jet, [cap(C.jet, { cy: 200 })].concat(wavyLock(556, 178, C.jet)), {
      extra: [],
    }),
  },
  {
    key: 'hair-pixie', slot: 'hair', label: '俏皮短发', hit: HIT_SHORT,
    art: () => assemble(C.jetDark, [cap(C.jetDark, { cy: 208, rx: 114, ry: 118 })].concat(tuft(302, 186, C.jetDark)), {
      ears: true,
      extra: [G.F(G.poly([[270, 100], [258, 82], [282, 92]]), C.jetDark), G.F(G.poly([[332, 104], [344, 86], [320, 94]]), C.jetDark)],
    }),
  },
  {
    key: 'hair-pixie-blonde', slot: 'hair', label: '金色短发', hit: HIT_SHORT,
    art: () => assemble(C.blonde, [cap(C.blonde, { cy: 208, rx: 114, ry: 118 })].concat(tuft(296, 184, C.blonde)), {
      ears: true,
      extra: [G.F(G.starPath(236, 168, 20), C.star), G.S(G.curveZ([236, 168], [[[236, 150], [236, 186], [236, 190]]]), '#e0a93c', 3)],
    }),
  },
  {
    key: 'hair-twin-star', slot: 'hair', label: '星星双马尾', hit: HIT_TAIL,
    art: () => assemble(C.brown, [cap(C.brown)].concat(sideMass(340, 176, C.brown), [
      tailBlob(C.brown, 140, 392, 56, 122), tailBlob(C.brown, -160, 392, 56, 122),
    ]), {
      extra: [
        G.ellipse(160, 296, 30, 18, C.tie), G.ellipse(440, 296, 30, 18, C.tie),
        G.F(G.starPath(160, 262, 22), C.star), G.F(G.starPath(440, 262, 22), C.star),
      ],
    }),
  },
  {
    key: 'hair-pony', slot: 'hair', label: '高马尾', hit: HIT_TAIL,
    art: () => assemble(C.blonde, [cap(C.blonde), G.ellipse(406, 356, 52, 152, C.blonde)], {
      extra: [G.ellipse(384, 214, 26, 34, C.tie), G.S('M406 250 C424 350 420 460 402 540', C.blondeDark, 8, { opacity: 0.5 })],
    }),
  },
  {
    key: 'hair-pony-brown', slot: 'hair', label: '棕色马尾', hit: HIT_TAIL,
    art: () => assemble(C.brown, [cap(C.brown), G.ellipse(194, 360, 52, 152, C.brown)], {
      extra: [G.ellipse(216, 214, 26, 34, C.ribbon), G.S('M194 254 C176 350 180 460 198 546', C.darkBrown, 8, { opacity: 0.5 })],
    }),
  },
  {
    key: 'hair-braid', slot: 'hair', label: '双麻花辫', hit: HIT_BRAID,
    art: () => {
      const beads = [];
      for (let i = 0; i < 6; i += 1) {
        const y = 300 + i * 42;
        const r = 34 - i * 2.4;
        const x = 208 - i * 2;
        beads.push(G.ellipse(x, y, r, r * 0.82, C.brown));
        beads.push(G.ellipse(600 - x, y, r, r * 0.82, C.brown));
      }
      return assemble(C.brown, [cap(C.brown)].concat(sideMass(320, 172, C.brown), beads), {
        extra: [
          G.S('M186 548 C200 560 216 558 226 546', C.darkBrown, 7),
          G.S('M414 548 C400 560 384 558 374 546', C.darkBrown, 7),
          G.circle(206, 556, 12, C.tie), G.circle(394, 556, 12, C.tie),
        ],
      });
    },
  },
  {
    key: 'hair-braid-plum', slot: 'hair', label: '紫麻花辫', hit: HIT_BRAID,
    art: () => {
      const beads = [];
      for (let i = 0; i < 6; i += 1) {
        const y = 296 + i * 42;
        const r = 34 - i * 2.4;
        const x = 206 - i * 2;
        beads.push(G.ellipse(x, y, r, r * 0.82, C.plum));
        beads.push(G.ellipse(600 - x, y, r, r * 0.82, C.plum));
      }
      return assemble(C.plum, [cap(C.plum, { cy: 200 })].concat(sideMass(318, 170, C.plum), beads), {
        extra: [
          G.ellipse(204, 544, 16, 12, C.ribbon), G.ellipse(396, 544, 16, 12, C.ribbon),
          G.F(G.heartPath(204, 566, 12), C.ribbon), G.F(G.heartPath(396, 566, 12), C.ribbon),
        ],
      });
    },
  },
  {
    key: 'hair-bun', slot: 'hair', label: '丸子头', hit: HIT_SHORT,
    art: () => assemble(C.jet, [cap(C.jet, { cy: 206 })].concat(sideMass(316, 178, C.jet)), {
      extra: [
        G.circle(300, 74, 50, C.jet), G.S('M262 92 C284 76 316 76 338 92', C.jetDark, 7),
        G.ellipse(300, 120, 40, 14, C.ribbon), G.F(G.starPath(300, 120, 10), '#ffffff'),
      ],
    }),
  },
  {
    key: 'hair-bun-silver', slot: 'hair', label: '银灰丸子', hit: HIT_SHORT,
    art: () => assemble(C.silver, [cap(C.silver, { cy: 206 })].concat(sideMass(330, 180, C.silver)), {
      extra: [
        G.circle(300, 70, 48, C.silver), G.S('M264 88 C286 72 314 72 336 88', '#a8aeb9', 7),
        G.F(G.starPath(300, 62, 16), '#ffffff'),
      ],
    }),
  },
  {
    key: 'hair-spacebun-pink', slot: 'hair', label: '粉色双丸子', hit: HIT_TAIL,
    art: () => assemble(C.pink, [cap(C.pink, { cy: 206 })].concat(sideMass(318, 176, C.pink)), {
      extra: [G.circle(212, 112, 46, C.pink), G.circle(388, 112, 46, C.pink), G.ellipse(212, 150, 22, 12, C.ribbon), G.ellipse(388, 150, 22, 12, C.ribbon)],
    }),
  },
  {
    key: 'hair-spacebun-mint', slot: 'hair', label: '薄荷双丸子', hit: HIT_TAIL,
    art: () => assemble(C.mint, [cap(C.mint, { cy: 206 })].concat(sideMass(306, 176, C.mint)), {
      extra: [G.circle(214, 108, 44, C.mint), G.circle(386, 108, 44, C.mint), G.F(G.starPath(214, 108, 20), '#ffffff'), G.F(G.starPath(386, 108, 20), '#ffffff')],
    }),
  },
  {
    key: 'hair-halfup', slot: 'hair', label: '公主半扎发', hit: HIT_LONG,
    art: () => assemble(C.blonde, [cap(C.blonde)].concat(wavyLock(520, 176, C.blonde)), {
      extra: [
        G.ellipse(300, 96, 54, 40, C.blonde), G.ellipse(300, 122, 34, 16, C.ribbon),
        G.F(G.starPath(268, 122, 12), '#ffffff'), G.F(G.starPath(332, 122, 12), '#ffffff'),
      ],
    }),
  },
  {
    key: 'hair-curls-honey', slot: 'hair', label: '蜂蜜卷', hit: HIT_LONG,
    art: () => {
      const rolls = [];
      for (let i = 0; i < 7; i += 1) {
        const y = 246 + i * 46;
        const r = 36 - i * 1.4;
        const x = 194 + (i % 2 ? 6 : -6);
        rolls.push(G.circle(x, y, r, C.honey));
        rolls.push(G.circle(600 - x, y, r, C.honey));
      }
      return assemble(C.honey, [cap(C.honey)].concat(rolls), {
        extra: [G.S('M186 210 C168 300 172 420 190 500', '#c07f36', 7, { opacity: 0.45 }), G.S('M414 210 C432 300 428 420 410 500', '#c07f36', 7, { opacity: 0.45 })],
      });
    },
  },
];
