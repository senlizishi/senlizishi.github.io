'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const D = require('./doll');

const SKIN = D.SKIN;
const SKIN_LINE = D.SKIN_LINE;
const OUTLINE = '#e9ab7e';
const HAIR = '#5b4030';

function art() {
  const out = [];
  // hair cap: strictly inside every wig fringe (dip 176 < any wig hairline)
  out.push(D.fringe(HAIR, 184));
  // ears
  out.push(L.circle(D.EAR.lx, D.EAR.cy, D.EAR.r, SKIN, { stroke: SKIN_LINE, 'stroke-width': 2.5 }));
  out.push(L.circle(D.EAR.rx, D.EAR.cy, D.EAR.r, SKIN, { stroke: SKIN_LINE, 'stroke-width': 2.5 }));
  // neck
  out.push(L.F('M284 244 L284 302 L316 302 L316 244 Z', '#f2c3a2'));
  // legs (outline + fill)
  out.push(L.S('M274 512 L266 712', OUTLINE, D.LEG.wSkin));
  out.push(L.S('M326 512 L334 712', OUTLINE, D.LEG.wSkin));
  out.push(L.S('M274 512 L266 712', SKIN, 36));
  out.push(L.S('M326 512 L334 712', SKIN, 36));
  // feet
  out.push(L.ellipse(266, 726, 25, 14, SKIN, { stroke: SKIN_LINE, 'stroke-width': 2.5 }));
  out.push(L.ellipse(334, 726, 25, 14, SKIN, { stroke: SKIN_LINE, 'stroke-width': 2.5 }));
  // arms
  [['M242 330 C228 372 222 420 224 468 C225 498 226 520 228 538'],
    ['M358 330 C372 372 378 420 376 468 C375 498 374 520 372 538']].forEach((arm) => {
    out.push(L.S(arm[0], OUTLINE, 40));
    out.push(L.S(arm[0], SKIN, 32));
  });
  // hands
  out.push(L.circle(228, 544, 17, SKIN, { stroke: SKIN_LINE, 'stroke-width': 2.5 }));
  out.push(L.circle(372, 544, 17, SKIN, { stroke: SKIN_LINE, 'stroke-width': 2.5 }));
  // torso skin
  out.push(L.F('M300 296 C272 296 250 300 242 310 C234 322 230 340 230 356 C230 374 236 386 242 398 C249 413 256 428 258 446 C260 464 258 480 256 498 C253 516 246 526 243 538 C240 546 244 556 254 556 L346 556 C356 556 360 546 357 538 C354 526 347 516 344 498 C342 480 340 464 342 446 C344 428 351 413 358 398 C364 386 370 374 370 356 C370 340 366 322 358 310 C350 300 328 296 300 296 Z', SKIN));
  // base shorts (always covered by any bottom / skirt)
  out.push(L.F(D.HIP, '#f7fafd', { stroke: '#dbe6f2', 'stroke-width': 5, 'stroke-linejoin': 'round' }));
  out.push(L.S('M254 486 C276 478 324 478 346 486', '#dbe6f2', 4, { opacity: 0.8 }));
  // base tank top (covers torso only, no sleeves, so sleeveless tops work)
  out.push(L.F(D.TORSO, '#f7fafd', { stroke: '#dbe6f2', 'stroke-width': 5, 'stroke-linejoin': 'round' }));
  out.push(L.S('M276 298 Q300 318 324 298', '#dbe6f2', 5));
  // face
  out.push(L.ellipse(D.HEAD.cx, D.HEAD.cy, D.HEAD.rx, D.HEAD.ry, SKIN));
  // eyes
  [[D.EYE.x1, 266, 277], [D.EYE.x2, 322, 333]].forEach((eye) => {
    out.push(L.ellipse(eye[0], D.EYE.cy, D.EYE.rw, D.EYE.rh, '#3c2f3a'));
    out.push(L.circle(eye[1], 216, 6, '#ffffff', { opacity: 0.95 }));
    out.push(L.circle(eye[2], 230, 3, '#ffffff', { opacity: 0.7 }));
  });
  // lashes + brows
  out.push(L.S('M256 202 Q272 192 288 202', '#8a6550', 4));
  out.push(L.S('M312 202 Q328 192 344 202', '#8a6550', 4));
  out.push(L.S('M258 182 Q272 175 286 182', '#9c7a63', 4));
  out.push(L.S('M314 182 Q328 175 342 182', '#9c7a63', 4));
  // nose + mouth + blush
  out.push(L.S('M296 240 Q300 246 304 240', '#e0a98a', 4));
  out.push(L.S('M284 256 Q300 270 316 256', '#e0597a', 6));
  out.push(L.ellipse(250, 250, 17, 10, '#ffaec4', { opacity: 0.5 }));
  out.push(L.ellipse(350, 250, 17, 10, '#ffaec4', { opacity: 0.5 }));
  return out;
}

function write() {
  const body = art().map((s) => '  ' + s).join('\n');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">\n'
    + body + '\n</svg>\n';
  fs.writeFileSync(path.join(L.ASSET_DIR, 'body.svg'), svg, 'utf8');
  return 'body.svg written (' + art().length + ' elements)';
}

module.exports = { art: art, write: write };

if (require.main === module) console.log(write());
