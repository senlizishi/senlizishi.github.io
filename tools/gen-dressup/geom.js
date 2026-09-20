'use strict';
const L = require('./lib');
const D = require('./doll');

// cubic path from a start point plus segments of 3 control/end points each
function curve(p0, segs) {
  let d = 'M' + p0[0] + ' ' + p0[1];
  segs.forEach((s) => {
    d += ' C' + s.map((p) => p[0] + ' ' + p[1]).join(' ');
  });
  return d;
}

function curveZ(p0, segs) {
  return curve(p0, segs) + ' Z';
}

function mirrorPoint(p) {
  return [600 - p[0], p[1]];
}

function mirrorSegs(segs) {
  return segs.map((s) => s.map(mirrorPoint));
}

// filled left+right mirrored shapes from one authored half
function bothSides(p0, segs) {
  return [curveZ(p0, segs), curveZ(mirrorPoint(p0), mirrorSegs(segs))];
}

function poly(points, closed) {
  return 'M' + points.map((p) => p[0] + ' ' + p[1]).join(' L') + (closed === false ? '' : ' Z');
}

module.exports = Object.assign({}, L, D, {
  curve: curve,
  curveZ: curveZ,
  mirrorPoint: mirrorPoint,
  mirrorSegs: mirrorSegs,
  bothSides: bothSides,
  poly: poly,
});
