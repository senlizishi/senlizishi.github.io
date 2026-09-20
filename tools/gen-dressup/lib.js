'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ASSET_DIR = path.join(ROOT, 'assets', 'dressup');
const GAME_FILE = path.join(ROOT, 'js', 'dressup-game.js');

const DOLL_W = 600;
const DOLL_H = 900;
const PAD = 12;

// ---------------------------------------------------------------- primitives

function num(n) {
  return Math.round(n * 100) / 100;
}

function attrs(map) {
  return Object.keys(map)
    .filter((k) => map[k] !== undefined && map[k] !== null)
    .map((k) => ' ' + k + '="' + map[k] + '"')
    .join('');
}

function el(tag, map, children) {
  const a = attrs(map || {});
  if (!children || !children.length) return '<' + tag + a + '/>';
  return '<' + tag + a + '>' + children.join('') + '</' + tag + '>';
}

function P(d, map) {
  return el('path', Object.assign({ d: d }, map || {}));
}

function F(d, color, map) {
  return P(d, Object.assign({ fill: color }, map || {}));
}

function S(d, color, width, map) {
  return P(d, Object.assign({
    fill: 'none', stroke: color, 'stroke-width': width,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }, map || {}));
}

function circle(cx, cy, r, color, map) {
  return el('circle', Object.assign({ cx: num(cx), cy: num(cy), r: num(r), fill: color }, map || {}));
}

function ellipse(cx, cy, rx, ry, color, map) {
  return el('ellipse', Object.assign({
    cx: num(cx), cy: num(cy), rx: num(rx), ry: num(ry), fill: color,
  }, map || {}));
}

function rect(x, y, w, h, color, map) {
  return el('rect', Object.assign({
    x: num(x), y: num(y), width: num(w), height: num(h), fill: color,
  }, map || {}));
}

function group(map, children) {
  return el('g', map || {}, children);
}

// ------------------------------------------------------------------- bounds

const SHAPE_TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline'];

function parseAttrs(raw) {
  const out = {};
  const re = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
  let m = re.exec(raw);
  while (m) {
    out[m[1]] = m[2];
    m = re.exec(raw);
  }
  return out;
}

function samplePath(d, put) {
  const tokens = d.match(/[MmLlHhVvCcQqZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  function read() {
    return parseFloat(tokens[i++]);
  }
  function cubic(x1, y1, x2, y2, x, y) {
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const mt = 1 - t;
      const px = mt * mt * mt * cx + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x;
      const py = mt * mt * mt * cy + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y;
      put(px, py);
    }
    cx = x;
    cy = y;
  }
  function quad(x1, y1, x, y) {
    for (let t = 0; t <= 1.0001; t += 1 / 24) {
      const mt = 1 - t;
      const px = mt * mt * cx + 2 * mt * t * x1 + t * t * x;
      const py = mt * mt * cy + 2 * mt * t * y1 + t * t * y;
      put(px, py);
    }
    cx = x;
    cy = y;
  }
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === 'M' || cmd === 'm') {
      const x = read();
      const y = read();
      cx = cmd === 'm' ? cx + x : x;
      cy = cmd === 'm' ? cy + y : y;
      sx = cx;
      sy = cy;
      put(cx, cy);
    } else if (cmd === 'L' || cmd === 'l') {
      const x = read();
      const y = read();
      cx = cmd === 'l' ? cx + x : x;
      cy = cmd === 'l' ? cy + y : y;
      put(cx, cy);
    } else if (cmd === 'H' || cmd === 'h') {
      const x = read();
      cx = cmd === 'h' ? cx + x : x;
      put(cx, cy);
    } else if (cmd === 'V' || cmd === 'v') {
      const y = read();
      cy = cmd === 'v' ? cy + y : y;
      put(cx, cy);
    } else if (cmd === 'C' || cmd === 'c') {
      const x1 = read();
      const y1 = read();
      const x2 = read();
      const y2 = read();
      const x = read();
      const y = read();
      if (cmd === 'c') cubic(cx + x1, cy + y1, cx + x2, cy + y2, cx + x, cy + y);
      else cubic(x1, y1, x2, y2, x, y);
    } else if (cmd === 'Q' || cmd === 'q') {
      const x1 = read();
      const y1 = read();
      const x = read();
      const y = read();
      if (cmd === 'q') quad(cx + x1, cy + y1, cx + x, cy + y);
      else quad(x1, y1, x, y);
    } else if (cmd === 'Z' || cmd === 'z') {
      put(sx, sy);
      cx = sx;
      cy = sy;
    }
  }
}

function boundsOf(markup) {
  const acc = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  function put(x, y) {
    if (x < acc.x0) acc.x0 = x;
    if (y < acc.y0) acc.y0 = y;
    if (x > acc.x1) acc.x1 = x;
    if (y > acc.y1) acc.y1 = y;
  }
  function grow(n) {
    if (!isFinite(acc.x0)) return;
    acc.x0 -= n;
    acc.y0 -= n;
    acc.x1 += n;
    acc.y1 += n;
  }
  const re = /<(\/?)([a-zA-Z]+)([^>]*)>/g;
  let m = re.exec(markup);
  let defsDepth = 0;
  while (m) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'defs') {
      defsDepth += closing ? -1 : 1;
    } else if (!closing && defsDepth <= 0 && SHAPE_TAGS.indexOf(tag) >= 0) {
      const at = parseAttrs(m[3]);
      const sw = at.stroke && at.stroke !== 'none' ? (parseFloat(at['stroke-width']) || 0) / 2 : 0;
      const n = (v) => parseFloat(v) || 0;
      if (tag === 'path') samplePath(at.d || '', put);
      else if (tag === 'circle') { put(n(at.cx) - n(at.r), n(at.cy) - n(at.r)); put(n(at.cx) + n(at.r), n(at.cy) + n(at.r)); }
      else if (tag === 'ellipse') { put(n(at.cx) - n(at.rx), n(at.cy) - n(at.ry)); put(n(at.cx) + n(at.rx), n(at.cy) + n(at.ry)); }
      else if (tag === 'rect') { put(n(at.x), n(at.y)); put(n(at.x) + n(at.width), n(at.y) + n(at.height)); }
      else if (tag === 'line') { put(n(at.x1), n(at.y1)); put(n(at.x2), n(at.y2)); }
      else if (tag === 'polygon' || tag === 'polyline') {
        const pts = (at.points || '').split(/[\s,]+/).map(parseFloat);
        for (let k = 0; k + 1 < pts.length; k += 2) put(pts[k], pts[k + 1]);
      }
      grow(sw);
    }
    m = re.exec(markup);
  }
  return acc;
}

function boxOf(markup, override) {
  if (override) return Object.assign({}, override);
  const b = boundsOf(markup);
  if (!isFinite(b.x0)) throw new Error('empty art');
  const x = Math.floor(b.x0) - PAD;
  const y = Math.floor(b.y0) - PAD;
  const w = Math.ceil(b.x1) + PAD - x;
  const h = Math.ceil(b.y1) + PAD - y;
  return { x: x, y: y, w: w, h: h };
}

// ---------------------------------------------------------------- file i/o

function writeSvg(key, art, box) {
  const body = art.map((line) => '  ' + line).join('\n');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + box.w + '" height="' + box.h
    + '" viewBox="' + box.x + ' ' + box.y + ' ' + box.w + ' ' + box.h + '">\n'
    + body + '\n</svg>\n';
  fs.writeFileSync(path.join(ASSET_DIR, key + '.svg'), svg, 'utf8');
}

function readInner(key) {
  const raw = fs.readFileSync(path.join(ASSET_DIR, key + '.svg'), 'utf8');
  const start = raw.indexOf('>', raw.indexOf('<svg'));
  const end = raw.lastIndexOf('</svg>');
  return raw.slice(start + 1, end).trim();
}

function innerLines(key) {
  return readInner(key).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function boxLine(box) {
  return 'box: { x: ' + box.x + ', y: ' + box.y + ', w: ' + box.w + ', h: ' + box.h + ' }';
}

module.exports = {
  ROOT: ROOT,
  ASSET_DIR: ASSET_DIR,
  GAME_FILE: GAME_FILE,
  DOLL_W: DOLL_W,
  DOLL_H: DOLL_H,
  PAD: PAD,
  num: num,
  el: el,
  P: P,
  F: F,
  S: S,
  circle: circle,
  ellipse: ellipse,
  rect: rect,
  group: group,
  boundsOf: boundsOf,
  boxOf: boxOf,
  writeSvg: writeSvg,
  readInner: readInner,
  innerLines: innerLines,
  boxLine: boxLine,
};
