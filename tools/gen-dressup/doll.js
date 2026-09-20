'use strict';

// Shared geometry for the dress-up doll (authored in a 600x900 doll space).
const L = require('./lib');

const SKIN = '#ffd9be';
const SKIN_LINE = '#f2c6a6';
const SKIN_SHADE = '#e9ab7e';

// head / face landmarks taken from body.svg
const HEAD = { cx: 300, cy: 212, rx: 70, ry: 76 };
const EYE = { x1: 272, x2: 328, cy: 222, rw: 15, rh: 17 };
const MOUTH = { cx: 300, cy: 262 };
const EAR = { lx: 233, rx: 367, cy: 218, r: 14 };
const BLUSH = { lx: 250, rx: 350, cy: 250 };

// torso silhouette (identical to body.svg so garments always cover the base layer)
const TORSO = 'M300 294 C272 294 250 298 242 308 C232 320 228 338 228 354 C228 372 234 384 240 396 C248 412 254 426 255 444 C256 464 252 486 250 500 C270 512 330 512 350 500 C348 486 344 464 345 444 C346 426 352 412 360 396 C366 384 372 372 372 354 C372 338 368 320 358 308 C350 298 328 294 300 294 Z';
// hips / pelvi silhouette (identical to body.svg base shorts)
const HIP = 'M251 478 C272 470 328 470 349 478 L353 502 L361 532 L362 548 C362 558 352 566 338 566 L320 566 C310 566 305 560 303 552 L300 544 L297 552 C295 560 290 566 280 566 L262 566 C248 566 238 558 238 548 L239 532 L247 502 Z';

const SLEEVE = {
  none: null,
  short: { l: 'M242 330 C232 360 226 392 224 424', r: 'M358 330 C368 360 374 392 376 424', w: 56 },
  mid: { l: 'M242 330 C230 366 224 402 224 452', r: 'M358 330 C370 366 376 402 376 452', w: 58 },
  long: { l: 'M242 330 C228 372 222 420 224 470 C225 496 226 516 228 534', r: 'M358 330 C372 372 378 420 376 470 C375 496 374 516 372 534', w: 58 },
  puff: { l: 'M242 332 C226 352 220 380 224 404', r: 'M358 332 C374 352 380 380 376 404', w: 74 },
};

// leg centre lines (used by trousers, socks and boots)
const LEG = {
  l: { x0: 276, y0: 512, x1: 260, y1: 688 },
  r: { x0: 324, y0: 512, x1: 340, y1: 688 },
  w: 58,
  wSkin: 44,
};

function legPoint(side, y) {
  const leg = LEG[side];
  const t = (y - leg.y0) / (leg.y1 - leg.y0);
  return { x: leg.x0 + (leg.x1 - leg.x0) * t, y: y };
}

// ------------------------------------------------------------------- shapes

function starPath(cx, cy, r, innerRatio) {
  const ir = r * (innerRatio || 0.46);
  let d = '';
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : ir;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += (i === 0 ? 'M' : 'L') + L.num(cx + Math.cos(a) * rad) + ' ' + L.num(cy + Math.sin(a) * rad);
  }
  return d + ' Z';
}

function heartPath(cx, cy, r) {
  return 'M' + L.num(cx) + ' ' + L.num(cy + r * 0.85)
    + ' C' + L.num(cx - r * 1.35) + ' ' + L.num(cy - r * 0.2) + ' ' + L.num(cx - r * 0.55) + ' ' + L.num(cy - r * 1.1) + ' ' + L.num(cx) + ' ' + L.num(cy - r * 0.32)
    + ' C' + L.num(cx + r * 0.55) + ' ' + L.num(cy - r * 1.1) + ' ' + L.num(cx + r * 1.35) + ' ' + L.num(cy - r * 0.2) + ' ' + L.num(cx) + ' ' + L.num(cy + r * 0.85)
    + ' Z';
}

function stripes(x0, y0, x1, step, h, color) {
  const out = [];
  for (let y = y0; y < x1; y += step) out.push(L.rect(x0, y, 400, h, color));
  return out;
}

function dots(x0, y0, x1, y1, step, r, color) {
  const out = [];
  let row = 0;
  for (let y = y0; y <= y1; y += step * 0.85) {
    const shift = row % 2 ? step / 2 : 0;
    for (let x = x0 + shift; x <= x1; x += step) out.push(L.circle(x, y, r, color));
    row += 1;
  }
  return out;
}

function clipTo(id, d, children) {
  return L.el('defs', {}, [L.el('clipPath', { id: id }, [L.P(d, {})])])
    + L.group({ 'clip-path': 'url(#' + id + ')' }, children);
}

// ----------------------------------------------------------------- hair bits

function hairMask(showEars) {
  const cuts = [
      L.ellipse(HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, '#000000'),
      L.ellipse(300, 300, 52, 50, '#000000'),
    ];
    if (showEars) {
      cuts.push(L.circle(EAR.lx, EAR.cy, 15, '#000000'));
      cuts.push(L.circle(EAR.rx, EAR.cy, 15, '#000000'));
    }
  return L.el('defs', {}, [
    L.el('mask', { id: 'faceMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 600, height: 900 }, [
      L.rect(0, 0, 600, 900, '#ffffff'),
    ].concat(cuts)),
  ]);
}

// bangs: covers the whole top of the skull down to the hairline
function fringe(color, dip, opts) {
  const o = opts || {};
  const x0 = o.x0 || 224;
  const x1 = o.x1 || 376;
  const top = o.top || 88;
  const side = o.sideY || 210;
  const mid = dip;
  return L.F('M' + x0 + ' ' + side
    + ' C' + (x0 - 6) + ' ' + (top + 44) + ' ' + (x0 + 24) + ' ' + top + ' 300 ' + top
    + ' C' + (x1 - 24) + ' ' + top + ' ' + (x1 + 6) + ' ' + (top + 44) + ' ' + x1 + ' ' + side
    + ' C' + (x1 - 6) + ' ' + mid + ' ' + (x1 - 30) + ' ' + (mid - 26) + ' ' + (x1 - 58) + ' ' + (mid - 30)
    + ' C330 ' + (mid + 6) + ' 270 ' + (mid + 6) + ' ' + (x0 + 58) + ' ' + (mid - 30)
    + ' C' + (x0 + 30) + ' ' + (mid - 26) + ' ' + (x0 + 6) + ' ' + mid + ' ' + x0 + ' ' + side + ' Z', color);
}

// hair cap that always hides the base skull cap
function hairCap(color, o) {
  const opt = o || {};
  const ry = opt.ry || 118;
  const rx = opt.rx || 116;
  return L.ellipse(300, opt.cy || 204, rx, ry, color);
}

function hairLock(side, color, botY, w, bulge) {
  const dir = side === 'l' ? -1 : 1;
  const x = 300 + dir * 102;
  const xm = 300 + dir * ((bulge || 0) + 110);
  const xe = 300 + dir * ((bulge || 0) + 96);
  return L.S('M' + x + ' 236 C' + xm + ' 320 ' + xm + ' ' + (botY - 90) + ' ' + xe + ' ' + botY, color, w);
}

module.exports = {
  SKIN: SKIN,
  SKIN_LINE: SKIN_LINE,
  SKIN_SHADE: SKIN_SHADE,
  HEAD: HEAD,
  EYE: EYE,
  MOUTH: MOUTH,
  EAR: EAR,
  BLUSH: BLUSH,
  TORSO: TORSO,
  HIP: HIP,
  SLEEVE: SLEEVE,
  LEG: LEG,
  legPoint: legPoint,
  starPath: starPath,
  heartPath: heartPath,
  stripes: stripes,
  dots: dots,
  clipTo: clipTo,
  hairMask: hairMask,
  fringe: fringe,
  hairCap: hairCap,
  hairLock: hairLock,
};
