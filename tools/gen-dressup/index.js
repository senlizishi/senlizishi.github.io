'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const PARTS = ['hair', 'hat', 'face', 'top', 'skirt', 'bottom', 'shoes', 'accessory', 'scene'];

function catalog() {
  const out = [];
  PARTS.forEach((name) => {
    let mod = null;
    try {
      mod = require('./parts/' + name);
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND') throw e;
    }
    if (mod) mod.forEach((it) => out.push(it));
  });
  return out;
}

function measure(items) {
  const boxes = {};
  const art = {};
  items.forEach((it) => {
    const markup = it.legacy ? L.innerLines(it.key).join('\n') : it.art().join('\n');
    art[it.key] = markup;
    boxes[it.key] = it.box ? Object.assign({}, it.box) : L.boxOf(markup);
  });
  return { boxes: boxes, art: art };
}

// raw path data outside a d="..." attribute renders as nothing: catch it at emit time
function assertShapes(m) {
  const bad = [];
  Object.keys(m.art).forEach((key) => {
    const stripped = m.art[key].replace(/="[^"]*"/g, '=""');
    if (/[MLCZAHVmlczahv]\s*-?\d/.test(stripped)) bad.push(key);
  });
  if (bad.length) throw new Error('raw path text (missing <path d="...">) in: ' + bad.join(', '));
}

function emit() {
  const items = catalog();
  const m = measure(items);
  assertShapes(m);
  let px = 0;
  items.forEach((it) => {
    const box = m.boxes[it.key];
    L.writeSvg(it.key, m.art[it.key].split('\n'), box);
    px += box.w * box.h;
  });
  fs.writeFileSync(path.join(L.ASSET_DIR, 'boxes.json'), JSON.stringify(m.boxes, null, 1), 'utf8');
  const cats = {};
  items.forEach((it) => {
    const c = it.cat || it.slot;
    cats[c] = (cats[c] || 0) + 1;
  });
  console.log('items: ' + items.length + '  texture px: ' + (px / 1e6).toFixed(2) + 'M (' + (px * 4 / 1048576).toFixed(1) + ' MB @1x)');
  console.log('per slot: ' + JSON.stringify(cats));
  const perTab = {};
  items.forEach((it) => {
    const c = it.cat || it.slot;
    perTab[c] = perTab[c] || { all: 0, beach: 0, palace: 0, forest: 0 };
    perTab[c].all += 1;
    ['beach', 'palace', 'forest'].forEach((s) => {
      if (!it.scene || it.scene === s) perTab[c][s] += 1;
    });
  });
  console.log('per tab: ' + JSON.stringify(perTab));
  return m;
}

function dataBlock() {
  const items = catalog();
  const m = measure(items);
  const lines = items.map((it) => {
    const parts = [];
    parts.push("key: '" + it.key + "'");
    if (it.slot !== (it.cat || it.slot)) parts.push("slot: '" + it.slot + "'");
    else parts.push("slot: '" + it.slot + "'");
    if (it.cat) parts.push("cat: '" + it.cat + "'");
    if (it.scene) parts.push("scene: '" + it.scene + "'");
    if (it.piece) parts.push("piece: '" + it.piece + "'");
    if (it.depth !== undefined) parts.push('depth: ' + it.depth);
    parts.push("label: '" + it.label + "'");
    parts.push(L.boxLine(m.boxes[it.key]));
    if (it.hit) {
      const b = m.boxes[it.key];
      const rects = it.hit.map((r) => {
        const x0 = Math.max(r.x, b.x);
        const y0 = Math.max(r.y, b.y);
        const x1 = Math.min(r.x + r.w, b.x + b.w);
        const y1 = Math.min(r.y + r.h, b.y + b.h);
        return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
      }).filter((r) => r.w > 2 && r.h > 2);
      if (rects.length) {
        parts.push('hit: [' + rects.map((r) => '{ x: ' + r.x + ', y: ' + r.y + ', w: ' + r.w + ', h: ' + r.h + ' }').join(', ') + ']');
      }
    }
    return '    { ' + parts.join(', ') + ' },';
  });
  return lines.join('\n');
}

function writeData() {
  const file = L.GAME_FILE;
  let src = fs.readFileSync(file, 'utf8');
  const begin = '  // >>> GEN:ITEMS >>>';
  const end = '  // <<< GEN:ITEMS <<<';
  const i = src.indexOf(begin);
  const j = src.indexOf(end);
  if (i < 0 || j < 0) throw new Error('markers missing in ' + file);
  const block = begin + '\n  const ITEMS = [\n' + dataBlock() + '\n  ];\n' + end;
  src = src.slice(0, i) + block + src.slice(j + end.length);
  // the marker range must never swallow neighbouring declarations
  const mustExist = ['SCENES_DATA', 'CATEGORIES', 'SLOT_DEPTH', 'SLOT_BEHIND', 'LAYOUT', 'textStyle'];
  const lost = mustExist.filter((name) => src.indexOf('const ' + name) < 0 && src.indexOf('function ' + name) < 0);
  if (lost.length) throw new Error('refusing to write, declarations lost: ' + lost.join(', '));
  fs.writeFileSync(file, src, 'utf8');
  return 'items written into ' + path.relative(L.ROOT, file);
}

module.exports = { catalog: catalog, emit: emit, assertShapes: assertShapes, dataBlock: dataBlock, writeData: writeData };

if (require.main === module) {
  const cmd = process.argv[2] || 'emit';
  if (cmd === 'emit') emit();
  else if (cmd === 'data') console.log(writeData());
  else if (cmd === 'dump') console.log(dataBlock());
  else console.log('unknown command: ' + cmd);
}
