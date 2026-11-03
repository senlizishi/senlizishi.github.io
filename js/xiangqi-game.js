/*
 * 中国象棋：540x960 竖屏，人机对弈 / 同屏双人。
 * 棋盘与棋子使用本地素材，界面由 Phaser.Graphics / Text 绘制。
 * 规则包含马腿、象眼、炮架、九宫、过河兵、将帅照面、将军、将死与困毙。
 */
(function () {
  'use strict';

  const WIDTH = 540;
  const HEIGHT = 960;
  const ROWS = 10;
  const COLS = 9;
  const RED = 'red';
  const BLACK = 'black';
  const MODES = { AI: 'ai', LOCAL: 'local' };
  const SERIF = '"STKaiti", "KaiTi", "Kaiti SC", "Songti SC", "Microsoft YaHei", serif';
  const SANS = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
  const GOLD = 0xD8B56C;
  const GOLD_LIGHT = 0xF5DDA2;
  const BOARD_TEX = 'xq-board';
  const PIECE_SIZE = 44;
  const CELL_HIT = 23;
  const NO_CAPTURE_DRAW = 120;
  const AI_DELAY = 0.72;
  const OVERLAY_LOCK = 0.45;
  const TYPE_ORDER = ['king', 'advisor', 'elephant', 'horse', 'rook', 'cannon', 'soldier'];
  const TYPE_LABEL = {
    king: '将帅', advisor: '士', elephant: '象', horse: '马',
    rook: '车', cannon: '炮', soldier: '兵',
  };
  const PIECE_VALUE = {
    king: 10000, rook: 900, cannon: 450, horse: 420,
    elephant: 200, advisor: 200, soldier: 100,
  };
  const TEXTURE_KEYS = [];
  for (let si = 0; si < 2; si++) {
    const side = si === 0 ? RED : BLACK;
    for (let ti = 0; ti < TYPE_ORDER.length; ti++) {
      TEXTURE_KEYS.push('xq-' + side + '-' + TYPE_ORDER[ti]);
    }
  }

  const C = {
    nightTop: 0x0D2421,
    nightBottom: 0x1A3A31,
    felt: 0x24483D,
    feltLight: 0x3D6857,
    gold: GOLD,
    goldLight: GOLD_LIGHT,
    goldDeep: 0x8C672C,
    cream: 0xFFF5DC,
    creamSoft: 0xE9D8B3,
    ink: 0x2B2420,
    inkSoft: 0x756656,
    red: 0xB83C34,
    redDeep: 0x72221F,
    redLight: 0xF2A69E,
    black: 0x352F2A,
    blackLight: 0x9B9084,
    jade: 0x70BE9B,
    jadeDeep: 0x327A60,
    white: 0xFFFFFF,
    shadow: 0x07130F,
    coral: 0xEB7669,
    blue: 0x7DC5D8,
  };

  const SOURCE_SIZE = 1536;
  const GRID_X = [140, 295, 451, 608, 766, 924, 1080, 1238, 1394].map(function (v) { return v / SOURCE_SIZE; });
  const GRID_Y = [124, 261, 403, 542, 681, 841, 980, 1121, 1260, 1398].map(function (v) { return v / SOURCE_SIZE; });

  function computeLayout() {
    const board = { x: 16, y: 170, w: 508, h: 508 };
    return {
      title: { x: WIDTH / 2, y: 43 },
      subtitle: { x: WIDTH / 2, y: 78 },
      modeAI: { x: 207, y: 125, w: 118, h: 34 },
      modeLocal: { x: 333, y: 125, w: 118, h: 34 },
      board: board,
      status: { x: 24, y: 696, w: 492, h: 68 },
      undo: { x: 166, y: 814, w: 132, h: 48 },
      restart: { x: 386, y: 814, w: 148, h: 48 },
      hint: { x: WIDTH / 2, y: 884 },
      over: { x: WIDTH / 2, y: 470, w: 422, h: 310 },
      overButton: { x: WIDTH / 2, y: 560, w: 222, h: 54 },
    };
  }

  const L = computeLayout();
  const SCENE_CONST = {
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    ROWS: ROWS,
    COLS: COLS,
    RED: RED,
    BLACK: BLACK,
    MODES: { AI: MODES.AI, LOCAL: MODES.LOCAL },
    PIECE_SIZE: PIECE_SIZE,
    PIECE_TYPES: TYPE_ORDER.slice(),
    GRID_X: GRID_X.slice(),
    GRID_Y: GRID_Y.slice(),
    NO_CAPTURE_DRAW: NO_CAPTURE_DRAW,
    AI_DELAY: AI_DELAY,
    OVERLAY_LOCK: OVERLAY_LOCK,
  };

  function cellPoint(row, col) {
    return {
      x: L.board.x + GRID_X[col] * L.board.w,
      y: L.board.y + GRID_Y[row] * L.board.h,
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function otherSide(side) { return side === RED ? BLACK : RED; }
  function sideName(side) { return side === RED ? '红方' : '黑方'; }

  function containsPoint(rect, x, y) {
    if (!rect) return false;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    return x >= cx - rect.w / 2 && x <= cx + rect.w / 2 && y >= cy - rect.h / 2 && y <= cy + rect.h / 2;
  }

  function containsCentered(rect, x, y) {
    return !!rect && x >= rect.x - rect.w / 2 && x <= rect.x + rect.w / 2 && y >= rect.y - rect.h / 2 && y <= rect.y + rect.h / 2;
  }

  function drawPill(g, x, y, w, h, fill, stroke, alpha, lineAlpha) {
    g.fillStyle(fill, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    if (stroke != null) {
      g.lineStyle(2, stroke, lineAlpha == null ? 1 : lineAlpha);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
    }
  }

  function drawRounded(g, x, y, w, h, r, fill, stroke, alpha, lineAlpha, lineWidth) {
    g.fillStyle(fill, alpha == null ? 1 : alpha);
    g.fillRoundedRect(x, y, w, h, r);
    if (stroke != null) {
      g.lineStyle(lineWidth || 2, stroke, lineAlpha == null ? 1 : lineAlpha);
      g.strokeRoundedRect(x, y, w, h, r);
    }
  }

  // ---------------------------------------------------------------- 规则
  function makePiece(side, type, id) {
    return { side: side, type: type, id: id };
  }

  function initialBoard() {
    const board = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(null);
      board.push(row);
    }
    const back = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook'];
    let id = 0;
    for (let c = 0; c < COLS; c++) board[0][c] = makePiece(BLACK, back[c], 'b' + (id++));
    for (let c = 0; c < COLS; c++) board[9][c] = makePiece(RED, back[c], 'r' + (id++));
    board[2][1] = makePiece(BLACK, 'cannon', 'b' + (id++));
    board[2][7] = makePiece(BLACK, 'cannon', 'b' + (id++));
    board[7][1] = makePiece(RED, 'cannon', 'r' + (id++));
    board[7][7] = makePiece(RED, 'cannon', 'r' + (id++));
    for (let c = 0; c < COLS; c += 2) {
      board[3][c] = makePiece(BLACK, 'soldier', 'b' + (id++));
      board[6][c] = makePiece(RED, 'soldier', 'r' + (id++));
    }
    return board;
  }

  function cloneBoard(board) {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c];
        row.push(p ? { side: p.side, type: p.type, id: p.id } : null);
      }
      out.push(row);
    }
    return out;
  }

  function inside(r, c) {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  function inPalace(side, r, c) {
    if (c < 3 || c > 5) return false;
    return side === RED ? (r >= 7 && r <= 9) : (r >= 0 && r <= 2);
  }

  function addMove(moves, board, side, r, c) {
    if (!inside(r, c)) return;
    const target = board[r][c];
    if (!target || target.side !== side) moves.push({ r: r, c: c });
  }

  function pseudoMoves(board, r, c) {
    const piece = board[r] && board[r][c];
    if (!piece) return [];
    const side = piece.side;
    const moves = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    if (piece.type === 'king') {
      for (let i = 0; i < dirs.length; i++) {
        const nr = r + dirs[i][0];
        const nc = c + dirs[i][1];
        if (inPalace(side, nr, nc)) addMove(moves, board, side, nr, nc);
      }
      // 将帅照面：中间无子时，双方将帅可沿同一直线互相攻击。
      for (let d = 0; d < dirs.length; d++) {
        let nr = r + dirs[d][0];
        let nc = c + dirs[d][1];
        while (inside(nr, nc)) {
          const q = board[nr][nc];
          if (q) {
            if (q.side !== side && q.type === 'king') moves.push({ r: nr, c: nc });
            break;
          }
          nr += dirs[d][0];
          nc += dirs[d][1];
        }
      }
    } else if (piece.type === 'advisor') {
      const diagonal = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (let i = 0; i < diagonal.length; i++) {
        const nr = r + diagonal[i][0];
        const nc = c + diagonal[i][1];
        if (inPalace(side, nr, nc)) addMove(moves, board, side, nr, nc);
      }
    } else if (piece.type === 'elephant') {
      const diagonal = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
      for (let i = 0; i < diagonal.length; i++) {
        const nr = r + diagonal[i][0];
        const nc = c + diagonal[i][1];
        const er = r + diagonal[i][0] / 2;
        const ec = c + diagonal[i][1] / 2;
        if (!inside(nr, nc) || board[er][ec]) continue;
        if (side === RED && nr < 5) continue;
        if (side === BLACK && nr > 4) continue;
        addMove(moves, board, side, nr, nc);
      }
    } else if (piece.type === 'horse') {
      const jumps = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]];
      for (let i = 0; i < jumps.length; i++) {
        const dr = jumps[i][0];
        const dc = jumps[i][1];
        const nr = r + dr;
        const nc = c + dc;
        if (!inside(nr, nc)) continue;
        const legR = r + (Math.abs(dr) === 2 ? dr / 2 : 0);
        const legC = c + (Math.abs(dc) === 2 ? dc / 2 : 0);
        if (board[legR][legC]) continue;
        addMove(moves, board, side, nr, nc);
      }
    } else if (piece.type === 'rook') {
      for (let i = 0; i < dirs.length; i++) {
        let nr = r + dirs[i][0];
        let nc = c + dirs[i][1];
        while (inside(nr, nc)) {
          const q = board[nr][nc];
          if (!q) moves.push({ r: nr, c: nc });
          else {
            if (q.side !== side) moves.push({ r: nr, c: nc });
            break;
          }
          nr += dirs[i][0];
          nc += dirs[i][1];
        }
      }
    } else if (piece.type === 'cannon') {
      for (let i = 0; i < dirs.length; i++) {
        let nr = r + dirs[i][0];
        let nc = c + dirs[i][1];
        let screen = false;
        while (inside(nr, nc)) {
          const q = board[nr][nc];
          if (!screen) {
            if (!q) moves.push({ r: nr, c: nc });
            else screen = true;
          } else if (q) {
            if (q.side !== side) moves.push({ r: nr, c: nc });
            break;
          }
          nr += dirs[i][0];
          nc += dirs[i][1];
        }
      }
    } else if (piece.type === 'soldier') {
      const forward = side === RED ? -1 : 1;
      addMove(moves, board, side, r + forward, c);
      const crossed = side === RED ? r <= 4 : r >= 5;
      if (crossed) {
        addMove(moves, board, side, r, c - 1);
        addMove(moves, board, side, r, c + 1);
      }
    }
    return moves;
  }

  function findKing(board, side) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c];
        if (p && p.side === side && p.type === 'king') return { r: r, c: c };
      }
    }
    return null;
  }

  function isSquareAttacked(board, r, c, bySide) {
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        const p = board[rr][cc];
        if (!p || p.side !== bySide) continue;
        const moves = pseudoMoves(board, rr, cc);
        for (let i = 0; i < moves.length; i++) {
          if (moves[i].r === r && moves[i].c === c) return true;
        }
      }
    }
    return false;
  }

  function inCheck(board, side) {
    const king = findKing(board, side);
    if (!king) return true;
    return isSquareAttacked(board, king.r, king.c, otherSide(side));
  }

  function simulateMove(board, from, to) {
    const next = cloneBoard(board);
    const piece = next[from.r][from.c];
    next[to.r][to.c] = piece;
    next[from.r][from.c] = null;
    return next;
  }

  function legalMovesFrom(board, r, c) {
    const piece = board[r] && board[r][c];
    if (!piece) return [];
    const raw = pseudoMoves(board, r, c);
    const legal = [];
    for (let i = 0; i < raw.length; i++) {
      const to = raw[i];
      const target = board[to.r][to.c];
      // 永远不把“吃将”作为普通着法暴露；胜负由将死/困毙判定。
      if (target && target.type === 'king') continue;
      const next = simulateMove(board, { r: r, c: c }, to);
      if (!inCheck(next, piece.side)) legal.push(to);
    }
    return legal;
  }

  function allLegalMoves(board, side) {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c];
        if (!p || p.side !== side) continue;
        const moves = legalMovesFrom(board, r, c);
        for (let i = 0; i < moves.length; i++) out.push({ from: { r: r, c: c }, to: moves[i] });
      }
    }
    return out;
  }

  function hasLegalMove(board, side) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c];
        if (p && p.side === side && legalMovesFrom(board, r, c).length > 0) return true;
      }
    }
    return false;
  }

  function statusFor(board, side) {
    const check = inCheck(board, side);
    const canMove = hasLegalMove(board, side);
    return {
      check: check,
      over: !canMove,
      winner: !canMove ? otherSide(side) : null,
      reason: !canMove ? (check ? 'checkmate' : 'stalemate') : null,
    };
  }

  function evaluateBoard(board, side) {
    let score = 0;
    let ownKing = null;
    let enemyKing = null;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c];
        if (!p) continue;
        const sign = p.side === side ? 1 : -1;
        let value = PIECE_VALUE[p.type] || 0;
        if (p.type === 'soldier') {
          const advanced = p.side === RED ? (6 - r) : (r - 3);
          value += Math.max(0, advanced) * 22;
          if (c >= 2 && c <= 6) value += 8;
        }
        if (p.type === 'horse' || p.type === 'cannon' || p.type === 'rook') {
          value += 12 - Math.abs(c - 4) * 3;
        }
        score += sign * value;
        if (p.type === 'king') {
          if (p.side === side) ownKing = { r: r, c: c };
          else enemyKing = { r: r, c: c };
        }
      }
    }
    if (ownKing && isSquareAttacked(board, ownKing.r, ownKing.c, otherSide(side))) score -= 60;
    if (enemyKing && isSquareAttacked(board, enemyKing.r, enemyKing.c, side)) score += 55;
    return score;
  }

  function replyThreat(board, move, side) {
    const target = board[move.to.r][move.to.c];
    let score = target ? (PIECE_VALUE[target.type] || 0) : 0;
    if (board[move.from.r][move.from.c] && board[move.from.r][move.from.c].type === 'king') score += 200;
    return score;
  }

  function chooseAIMove(board, side) {
    const moves = allLegalMoves(board, side);
    if (!moves.length) return null;
    const enemy = otherSide(side);
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const captured = board[move.to.r][move.to.c];
      const next = simulateMove(board, move.from, move.to);
      let score;
      if (!hasLegalMove(next, enemy)) {
        score = 1000000;
      } else {
        const replies = allLegalMoves(next, enemy);
        replies.sort(function (a, b) { return replyThreat(next, b, enemy) - replyThreat(next, a, enemy); });
        let worst = evaluateBoard(next, side);
        const limit = Math.min(14, replies.length);
        for (let j = 0; j < limit; j++) {
          const reply = replies[j];
          const after = simulateMove(next, reply.from, reply.to);
          const value = hasLegalMove(after, side) ? evaluateBoard(after, side) : -900000;
          if (value < worst) worst = value;
        }
        score = evaluateBoard(next, side) * 0.18 + worst * 0.82;
        if (inCheck(next, enemy)) score += 34;
      }
      if (captured) score += (PIECE_VALUE[captured.type] || 0) * 0.12;
      score += (move.to.r - move.from.r) * (side === RED ? 1.2 : -1.2);
      score += 12 - Math.abs(move.to.c - 4) * 1.6;
      score += Math.random() * 4;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- 绘制
  function drawBackground(g) {
    g.fillGradientStyle(C.nightTop, C.nightTop, C.nightBottom, C.nightBottom, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    g.fillStyle(0x285C4B, 0.18);
    g.fillCircle(104, 240, 190);
    g.fillStyle(0x265045, 0.18);
    g.fillCircle(470, 640, 235);
    g.fillStyle(0xD8B56C, 0.035);
    g.fillCircle(270, 440, 300);

    // 两侧藤蔓与金色光点，让竖屏留白不空。
    const dust = [
      [31, 193, 1.5], [58, 286, 1], [25, 452, 1.3], [48, 620, 1],
      [512, 222, 1.2], [486, 384, 1.4], [518, 560, 1], [497, 730, 1.3],
      [68, 760, 1.2], [466, 646, 1.1], [80, 895, 1.4], [458, 879, 1.2],
    ];
    for (let i = 0; i < dust.length; i++) {
      g.fillStyle(i % 3 === 0 ? C.goldLight : C.jade, 0.25);
      g.fillCircle(dust[i][0], dust[i][1], dust[i][2]);
    }

    g.lineStyle(1, C.gold, 0.12);
    g.strokeCircle(270, 426, 286);
    g.lineStyle(1, C.gold, 0.08);
    g.strokeCircle(270, 426, 301);
  }

  function drawFrame(g) {
    drawRounded(g, L.board.x - 8, L.board.y - 8, L.board.w + 16, L.board.h + 16, 18, C.shadow, 0x000000, 0.45);
    drawRounded(g, L.board.x - 3, L.board.y - 3, L.board.w + 6, L.board.h + 6, 14, 0x19624A, C.goldDeep, 0.34, 0.8, 2);
    g.lineStyle(2, C.gold, 0.7);
    g.strokeRoundedRect(L.board.x - 3, L.board.y - 3, L.board.w + 6, L.board.h + 6, 14);
    g.lineStyle(1, C.goldLight, 0.34);
    g.strokeRoundedRect(L.board.x + 1, L.board.y + 1, L.board.w - 2, L.board.h - 2, 10);
  }

  function drawCorner(g, x, y, r, color, lw, len) {
    const q = len || 7;
    g.lineStyle(lw || 2, color, 0.95);
    g.lineBetween(x - r, y - r, x - r + q, y - r);
    g.lineBetween(x - r, y - r, x - r, y - r + q);
    g.lineBetween(x + r, y - r, x + r - q, y - r);
    g.lineBetween(x + r, y - r, x + r, y - r + q);
    g.lineBetween(x - r, y + r, x - r + q, y + r);
    g.lineBetween(x - r, y + r, x - r, y + r - q);
    g.lineBetween(x + r, y + r, x + r - q, y + r);
    g.lineBetween(x + r, y + r, x + r, y + r - q);
  }

  const Sound = (function () {
    let ctx = null;
    let master = null;
    let muted = false;

    function ensure() {
      if (muted) return null;
      if (ctx) {
        if (ctx.state === 'suspended') {
          try { ctx.resume().catch(function () {}); } catch (e) {}
        }
        return ctx;
      }
      try {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) { muted = true; return null; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.45;
        master.connect(ctx.destination);
        return ctx;
      } catch (e) {
        muted = true;
        return null;
      }
    }

    function tone(freq, duration, volume, delay, type, endFreq) {
      const ac = ensure();
      if (!ac) return;
      const t0 = ac.currentTime + (delay || 0);
      const dur = duration || 0.2;
      try {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(Math.max(30, freq), t0);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume || 0.05), t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.04);
      } catch (e) {}
    }

    function noise(duration, volume, delay, freq) {
      const ac = ensure();
      if (!ac) return;
      try {
        const t0 = ac.currentTime + (delay || 0);
        const len = Math.max(1, Math.floor(ac.sampleRate * duration));
        const buf = ac.createBuffer(1, len, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource();
        src.buffer = buf;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq || 950;
        filter.Q.value = 0.7;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(t0);
        src.stop(t0 + duration + 0.02);
      } catch (e) {}
    }

    return {
      resume: function () { ensure(); },
      select: function () {
        tone(620, 0.045, 0.028, 0, 'triangle');
        tone(880, 0.07, 0.02, 0.018, 'sine');
      },
      move: function () {
        tone(250, 0.07, 0.04, 0, 'triangle', 190);
        noise(0.07, 0.018, 0, 720);
      },
      capture: function () {
        tone(190, 0.12, 0.045, 0, 'square', 120);
        noise(0.14, 0.035, 0, 940);
        tone(470, 0.09, 0.026, 0.035, 'triangle');
      },
      check: function () {
        tone(660, 0.18, 0.035, 0, 'triangle');
        tone(830, 0.22, 0.028, 0.11, 'triangle');
      },
      undo: function () {
        tone(430, 0.12, 0.03, 0, 'sine', 310);
      },
      click: function () {
        tone(540, 0.055, 0.023, 0, 'sine');
      },
      mode: function () {
        tone(523, 0.1, 0.028, 0, 'sine');
        tone(659, 0.12, 0.024, 0.06, 'sine');
      },
      win: function () {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        for (let i = 0; i < notes.length; i++) {
          tone(notes[i], 0.65, 0.038, i * 0.09, 'triangle');
          tone(notes[i] * 2, 0.3, 0.008, i * 0.09, 'sine');
        }
      },
      softEnd: function () {
        tone(392, 0.3, 0.026, 0, 'sine');
        tone(329.63, 0.38, 0.022, 0.14, 'sine');
        tone(261.63, 0.5, 0.018, 0.28, 'sine');
      },
      draw: function () {
        tone(440, 0.24, 0.026, 0, 'sine');
        tone(440, 0.24, 0.02, 0.18, 'sine');
      },
    };
  })();

  // ---------------------------------------------------------------- 场景
  class XiangqiScene extends Phaser.Scene {
    constructor() {
      super('XiangqiScene');
      this.CONST = SCENE_CONST;
      this.board = initialBoard();
      this.mode = MODES.AI;
      this.turn = RED;
      this.phase = 'play';
      this.selected = null;
      this.legalMoves = [];
      this.winner = null;
      this.resultReason = null;
      this.overlayLock = 0;
      this.history = [];
      this.lastMove = null;
      this.noCapture = 0;
      this.moveCount = 0;
      this.aiThinking = false;
      this.aiWait = 0;
      this.checkSide = null;
      this.liveProps = 0;
      this.pieceViews = new Map();
      this.overlayVisible = false;
    }

    preload() {
      this.load.image(BOARD_TEX, 'assets/xiangqi/board.jpg');
      for (let i = 0; i < TYPE_ORDER.length; i++) {
        this.load.image('xq-' + RED + '-' + TYPE_ORDER[i], 'assets/xiangqi/red-' + TYPE_ORDER[i] + '.png');
        this.load.image('xq-' + BLACK + '-' + TYPE_ORDER[i], 'assets/xiangqi/black-' + TYPE_ORDER[i] + '.png');
      }
    }

    create() {
      this.CONST = SCENE_CONST;
      this.board = initialBoard();
      this.mode = MODES.AI;
      this.turn = RED;
      this.phase = 'play';
      this.selected = null;
      this.legalMoves = [];
      this.winner = null;
      this.resultReason = null;
      this.overlayLock = 0;
      this.history = [];
      this.lastMove = null;
      this.noCapture = 0;
      this.moveCount = 0;
      this.aiThinking = false;
      this.aiWait = 0;
      this.checkSide = null;
      this.liveProps = 0;
      this.pieceViews = new Map();
      this.overlayVisible = false;

      this.bgG = this.add.graphics().setDepth(0);
      drawBackground(this.bgG);

      this.frameG = this.add.graphics().setDepth(2);
      drawFrame(this.frameG);

      this.boardImg = this.add.image(
        L.board.x + L.board.w / 2,
        L.board.y + L.board.h / 2,
        BOARD_TEX
      ).setDisplaySize(L.board.w, L.board.h).setDepth(3);

      this.markerG = this.add.graphics().setDepth(8);
      this.turnGlowG = this.add.graphics().setDepth(9);

      this.uiG = this.add.graphics().setDepth(20);
      this.statusG = this.add.graphics().setDepth(20);
      this.controlG = this.add.graphics().setDepth(20);
      this.modeG = this.add.graphics().setDepth(20);

      this.titleText = this.add.text(L.title.x, L.title.y, '中国象棋', {
        fontFamily: SERIF,
        fontSize: '38px',
        fontStyle: 'bold',
        color: '#F3D69A',
        stroke: '#16352C',
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(21);
      this.titleText.setShadow(0, 4, '#081811', 4, true, true);

      this.subtitleText = this.add.text(L.subtitle.x, L.subtitle.y, '楚河汉界 · 红方先行', {
        fontFamily: SANS,
        fontSize: '14px',
        color: '#CFBEA0',
      }).setOrigin(0.5).setDepth(21);

      this.modeAIText = this.add.text(L.modeAI.x, L.modeAI.y, '人机对弈', {
        fontFamily: SANS, fontSize: '14px', fontStyle: 'bold', color: '#2E271E',
      }).setOrigin(0.5).setDepth(22);
      this.modeLocalText = this.add.text(L.modeLocal.x, L.modeLocal.y, '同屏双人', {
        fontFamily: SANS, fontSize: '14px', fontStyle: 'bold', color: '#D9CCB2',
      }).setOrigin(0.5).setDepth(22);

      this.statusTokenText = this.add.text(L.status.x + 34, L.status.y + 34, '帅', {
        fontFamily: SERIF, fontSize: '19px', fontStyle: 'bold', color: '#FFF2D4',
      }).setOrigin(0.5).setDepth(22);
      this.statusText = this.add.text(L.status.x + 66, L.status.y + 23, '轮到你啦 · 红方', {
        fontFamily: SANS, fontSize: '19px', fontStyle: 'bold', color: '#FFF0CC',
      }).setOrigin(0, 0.5).setDepth(22);
      this.statusSubText = this.add.text(L.status.x + 66, L.status.y + 47, '点一枚棋子，查看它能去哪里', {
        fontFamily: SANS, fontSize: '12px', color: '#BCAF94',
      }).setOrigin(0, 0.5).setDepth(22);
      this.moveCountText = this.add.text(L.status.x + L.status.w - 16, L.status.y + 34, '第 0 手', {
        fontFamily: SANS, fontSize: '12px', color: '#B8AA8D',
      }).setOrigin(1, 0.5).setDepth(22);

      this.undoText = this.add.text(L.undo.x, L.undo.y, '悔棋', {
        fontFamily: SANS, fontSize: '18px', fontStyle: 'bold', color: '#F7EACB',
      }).setOrigin(0.5).setDepth(22);
      this.restartText = this.add.text(L.restart.x, L.restart.y, '重新开局', {
        fontFamily: SANS, fontSize: '18px', fontStyle: 'bold', color: '#352A20',
      }).setOrigin(0.5).setDepth(22);
      this.hintText = this.add.text(L.hint.x, L.hint.y, '点棋子 → 点发光落点 · 炮要隔一子吃', {
        fontFamily: SANS, fontSize: '13px', color: '#BFB194',
      }).setOrigin(0.5).setDepth(21);

      this.createOverlay();
      this.rebuildPieces();
      this.renderMode();
      this.renderControls();
      this.updateStatus();
      this.drawMarkers();

      this.input.on('pointerdown', this.onPointerDown, this);
      this._visibilityHandler = this.onVisibilityChange.bind(this);
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', this._visibilityHandler);
      }
    }

    onVisibilityChange() {
      if (typeof document !== 'undefined' && document.hidden) {
        this.aiWait = Math.max(this.aiWait, AI_DELAY);
      }
    }

    texKey(piece) {
      return 'xq-' + piece.side + '-' + piece.type;
    }

    trackTween(config) {
      this.liveProps++;
      const oldComplete = config.onComplete;
      config.onComplete = function () {
        this.liveProps = Math.max(0, this.liveProps - 1);
        if (oldComplete) oldComplete.call(this);
      }.bind(this);
      this.tweens.add(config);
    }

    createPieceView(piece, r, c) {
      const p = cellPoint(r, c);
      const shadow = this.add.ellipse(1.5, 5, PIECE_SIZE - 3, PIECE_SIZE - 8, C.shadow, 0.3);
      const img = this.add.image(0, 0, this.texKey(piece)).setDisplaySize(PIECE_SIZE, PIECE_SIZE);
      const view = this.add.container(p.x, p.y, [shadow, img]);
      view.setDepth(10 + r);
      view.pieceId = piece.id;
      view.baseScale = 1;
      this.pieceViews.set(piece.id, view);
      return view;
    }

    rebuildPieces() {
      const self = this;
      this.pieceViews.forEach(function (view) {
        if (view && view.destroy) view.destroy();
      });
      this.pieceViews.clear();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (this.board[r][c]) self.createPieceView(this.board[r][c], r, c);
        }
      }
    }

    syncPieces() {
      const alive = new Set();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const piece = this.board[r][c];
          if (!piece) continue;
          alive.add(piece.id);
          let view = this.pieceViews.get(piece.id);
          if (!view) view = this.createPieceView(piece, r, c);
          const p = cellPoint(r, c);
          view.x = p.x;
          view.y = p.y;
          view.setDepth(10 + r);
        }
      }
      const stale = [];
      this.pieceViews.forEach(function (view, id) {
        if (!alive.has(id)) stale.push(id);
      });
      for (let i = 0; i < stale.length; i++) {
        const view = this.pieceViews.get(stale[i]);
        if (view && view.destroy) view.destroy();
        this.pieceViews.delete(stale[i]);
      }
    }

    animateMoveView(piece, from, to, captured) {
      const p = cellPoint(to.r, to.c);
      const view = this.pieceViews.get(piece.id);
      if (captured) {
        const capturedView = this.pieceViews.get(captured.id);
        this.pieceViews.delete(captured.id);
        if (capturedView) {
          this.trackTween({
            targets: capturedView,
            alpha: 0,
            scaleX: 0.62,
            scaleY: 0.62,
            y: capturedView.y - 8,
            duration: 190,
            ease: 'Cubic.easeOut',
            onComplete: function () { if (capturedView.destroy) capturedView.destroy(); },
          });
        }
      }
      if (view) {
        this.trackTween({
          targets: view,
          x: p.x,
          y: p.y,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 190,
          ease: 'Cubic.easeOut',
          onComplete: function () {
            view.setScale(1);
            view.setDepth(10 + to.r);
          },
        });
      }
    }

    setSelected(row, col) {
      if (this.selected) {
        const oldPiece = this.board[this.selected.r] && this.board[this.selected.r][this.selected.c];
        if (oldPiece) {
          const oldView = this.pieceViews.get(oldPiece.id);
          if (oldView) oldView.setScale(1);
        }
      }
      this.selected = { r: row, c: col };
      this.legalMoves = legalMovesFrom(this.board, row, col);
      const piece = this.board[row][col];
      if (piece) {
        const view = this.pieceViews.get(piece.id);
        if (view) view.setScale(1.1);
      }
      this.drawMarkers();
      this.updateStatus();
    }

    clearSelection() {
      if (this.selected) {
        const piece = this.board[this.selected.r] && this.board[this.selected.r][this.selected.c];
        if (piece) {
          const view = this.pieceViews.get(piece.id);
          if (view) view.setScale(1);
        }
      }
      this.selected = null;
      this.legalMoves = [];
      this.drawMarkers();
      this.updateStatus();
    }

    selectAt(row, col) {
      if (this.phase !== 'play' || this.aiThinking) return false;
      if (!inside(row, col) || !this.board[row][col]) return false;
      if (this.mode === MODES.AI && this.turn !== RED) return false;
      const piece = this.board[row][col];
      if (piece.side !== this.turn) return false;
      Sound.resume();
      Sound.select();
      this.setSelected(row, col);
      return true;
    }

    getLegalMoves(row, col) {
      if (!inside(row, col)) return [];
      return legalMovesFrom(this.board, row, col).map(function (m) { return { r: m.r, c: m.c }; });
    }

    move(from, to) {
      if (!from || !to || this.phase !== 'play') return false;
      if (!inside(from.r, from.c) || !inside(to.r, to.c)) return false;
      const piece = this.board[from.r][from.c];
      if (!piece || piece.side !== this.turn) return false;
      if (this.mode === MODES.AI && this.aiThinking) return false;
      if (this.mode === MODES.AI && this.turn !== RED) return false;
      const legal = legalMovesFrom(this.board, from.r, from.c);
      let found = false;
      for (let i = 0; i < legal.length; i++) {
        if (legal[i].r === to.r && legal[i].c === to.c) { found = true; break; }
      }
      if (!found) return false;
      return this.applyMove(from, to, false);
    }

    applyMove(from, to, byAI) {
      const moving = this.board[from.r][from.c];
      if (!moving) return false;
      const captured = this.board[to.r][to.c];
      const snapshot = {
        board: cloneBoard(this.board),
        turn: this.turn,
        lastMove: this.lastMove ? {
          from: { r: this.lastMove.from.r, c: this.lastMove.from.c },
          to: { r: this.lastMove.to.r, c: this.lastMove.to.c },
        } : null,
        noCapture: this.noCapture,
        moveCount: this.moveCount,
        phase: this.phase,
        checkSide: this.checkSide,
      };
      this.history.push(snapshot);

      this.board[from.r][from.c] = null;
      this.board[to.r][to.c] = moving;
      this.lastMove = {
        from: { r: from.r, c: from.c },
        to: { r: to.r, c: to.c },
      };
      this.noCapture = captured ? 0 : this.noCapture + 1;
      this.moveCount++;
      this.selected = null;
      this.legalMoves = [];
      this.animateMoveView(moving, from, to, captured);

      const next = otherSide(moving.side);
      const status = statusFor(this.board, next);
      this.turn = next;
      this.checkSide = status.check && !status.over ? next : null;
      this.phase = 'play';
      this.winner = null;
      this.resultReason = null;

      if (status.over) {
        this.phase = 'over';
        this.winner = status.winner;
        this.resultReason = status.reason;
        this.aiThinking = false;
        this.aiWait = 0;
      } else if (this.noCapture >= NO_CAPTURE_DRAW) {
        this.phase = 'over';
        this.winner = 'draw';
        this.resultReason = 'draw';
        this.aiThinking = false;
        this.aiWait = 0;
      } else if (this.mode === MODES.AI && this.turn === BLACK) {
        this.aiThinking = true;
        this.aiWait = AI_DELAY;
      } else {
        this.aiThinking = false;
        this.aiWait = 0;
      }

      if (captured) Sound.capture(); else Sound.move();
      if (status.check && !status.over) Sound.check();

      this.drawMarkers();
      this.updateStatus();
      this.renderControls();

      if (this.phase === 'over') {
        this.showOverlay();
      }
      return true;
    }

    onPointerDown(pointer) {
      Sound.resume();
      const x = Number(pointer && pointer.x);
      const y = Number(pointer && pointer.y);
      if (!isFinite(x) || !isFinite(y)) return;

      if (this.phase === 'over') {
        if (this.overlayLock <= 0) this.resetGame();
        return;
      }

      if (containsCentered(L.modeAI, x, y)) {
        if (this.mode !== MODES.AI) {
          this.mode = MODES.AI;
          Sound.mode();
          this.resetGame();
        }
        return;
      }
      if (containsCentered(L.modeLocal, x, y)) {
        if (this.mode !== MODES.LOCAL) {
          this.mode = MODES.LOCAL;
          Sound.mode();
          this.resetGame();
        }
        return;
      }
      if (containsCentered(L.undo, x, y)) {
        this.undo();
        return;
      }
      if (containsCentered(L.restart, x, y)) {
        Sound.click();
        this.resetGame();
        return;
      }

      const cell = this.pointCell(x, y);
      if (!cell) {
        if (this.selected) this.clearSelection();
        return;
      }
      if (this.mode === MODES.AI && (this.aiThinking || this.turn !== RED)) return;

      if (this.selected) {
        const canMove = this.legalMoves.some(function (m) { return m.r === cell.r && m.c === cell.c; });
        if (canMove) {
          const from = { r: this.selected.r, c: this.selected.c };
          this.applyMove(from, { r: cell.r, c: cell.c }, false);
          return;
        }
      }

      const piece = this.board[cell.r][cell.c];
      if (piece && piece.side === this.turn) {
        if (this.selected && this.selected.r === cell.r && this.selected.c === cell.c) {
          this.clearSelection();
        } else {
          Sound.select();
          this.setSelected(cell.r, cell.c);
        }
      } else if (this.selected) {
        this.clearSelection();
      }
    }

    pointCell(x, y) {
      let best = null;
      let bestD = Infinity;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const p = cellPoint(r, c);
          const dx = x - p.x;
          const dy = y - p.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = { r: r, c: c };
          }
        }
      }
      return best && Math.sqrt(bestD) <= CELL_HIT ? best : null;
    }

    drawMarkers() {
      const g = this.markerG;
      g.clear();

      if (this.lastMove) {
        const fromP = cellPoint(this.lastMove.from.r, this.lastMove.from.c);
        const toP = cellPoint(this.lastMove.to.r, this.lastMove.to.c);
        drawCorner(g, fromP.x, fromP.y, 20, C.gold, 2, 7);
        drawCorner(g, toP.x, toP.y, 20, C.coral, 2.5, 8);
      }

      if (!this.selected || this.phase !== 'play') return;
      const center = cellPoint(this.selected.r, this.selected.c);
      g.lineStyle(3, C.goldLight, 0.95);
      g.strokeCircle(center.x, center.y, 23);
      g.lineStyle(1, C.white, 0.5);
      g.strokeCircle(center.x, center.y, 26);

      for (let i = 0; i < this.legalMoves.length; i++) {
        const m = this.legalMoves[i];
        const p = cellPoint(m.r, m.c);
        const target = this.board[m.r][m.c];
        if (target) {
          g.lineStyle(3, C.coral, 0.95);
          g.strokeCircle(p.x, p.y, 21);
          g.fillStyle(C.coral, 0.35);
          g.fillCircle(p.x, p.y, 12);
        } else {
          g.fillStyle(0x081811, 0.35);
          g.fillCircle(p.x, p.y + 1, 8.5);
          g.fillStyle(C.goldLight, 0.95);
          g.fillCircle(p.x, p.y, 6.5);
          g.fillStyle(C.white, 0.75);
          g.fillCircle(p.x - 1.5, p.y - 1.5, 2);
        }
      }
    }

    renderMode() {
      const g = this.modeG;
      g.clear();
      const aiActive = this.mode === MODES.AI;
      drawRounded(
        g, L.modeAI.x - L.modeAI.w / 2, L.modeAI.y - L.modeAI.h / 2,
        L.modeAI.w, L.modeAI.h, L.modeAI.h / 2,
        aiActive ? C.goldLight : 0x203C34,
        aiActive ? C.goldDeep : C.goldDeep,
        aiActive ? 1 : 0.75,
        0.9,
        1.5
      );
      drawRounded(
        g, L.modeLocal.x - L.modeLocal.w / 2, L.modeLocal.y - L.modeLocal.h / 2,
        L.modeLocal.w, L.modeLocal.h, L.modeLocal.h / 2,
        !aiActive ? C.goldLight : 0x203C34,
        C.goldDeep,
        !aiActive ? 1 : 0.75,
        0.9,
        1.5
      );
      this.modeAIText.setColor(aiActive ? '#2D251B' : '#D8CBB1');
      this.modeLocalText.setColor(!aiActive ? '#2D251B' : '#D8CBB1');
    }

    renderControls() {
      const g = this.controlG;
      g.clear();
      const canUndo = this.history.length > 0;
      drawRounded(
        g, L.undo.x - L.undo.w / 2, L.undo.y - L.undo.h / 2,
        L.undo.w, L.undo.h, 14,
        0x203F35, C.goldDeep, canUndo ? 0.95 : 0.45, canUndo ? 0.85 : 0.35, 1.5
      );
      drawRounded(
        g, L.restart.x - L.restart.w / 2, L.restart.y - L.restart.h / 2,
        L.restart.w, L.restart.h, 14,
        C.goldLight, C.goldDeep, 0.96, 0.95, 1.5
      );
      this.undoText.setAlpha(canUndo ? 1 : 0.42);
      this.restartText.setAlpha(1);
    }

    renderStatusPanel() {
      const g = this.statusG;
      const s = L.status;
      g.clear();
      drawRounded(g, s.x, s.y, s.w, s.h, 17, 0x102A24, C.goldDeep, 0.92, 0.8, 1.5);
      g.fillStyle(this.turn === RED ? C.red : C.black, 0.95);
      g.fillCircle(s.x + 34, s.y + 34, 18);
      g.lineStyle(2, this.turn === RED ? C.redLight : C.blackLight, 0.8);
      g.strokeCircle(s.x + 34, s.y + 34, 21);
      g.fillStyle(C.cream, 0.08);
      g.fillRoundedRect(s.x + 58, s.y + 10, s.w - 74, 48, 11);
      this.statusTokenText.setText(this.turn === RED ? '帅' : '将');
    }

    updateStatus() {
      this.renderStatusPanel();
      const s = L.status;
      if (this.phase === 'over') {
        this.statusText.setText(this.winner === 'draw' ? '本局和棋' : sideName(this.winner) + '胜');
        this.statusText.setColor('#F4D58E');
        this.statusSubText.setText(this.resultReason === 'checkmate' ? '将死！可以悔棋或重新开局' : '无子可走，点击重新开局');
        this.statusSubText.setColor('#C6B693');
        this.moveCountText.setText('共 ' + this.moveCount + ' 手');
        return;
      }

      const checked = inCheck(this.board, this.turn);
      this.checkSide = checked ? this.turn : null;
      let main;
      let sub;
      if (this.aiThinking) {
        main = '电脑思考中…';
        sub = '红方先行，请稍候片刻';
      } else if (checked) {
        main = '将军！' + sideName(this.turn) + '应将';
        sub = '必须解除将军，才能继续走棋';
      } else if (this.mode === MODES.AI) {
        main = '轮到你啦 · 红方';
        sub = this.selected ? '已选棋子，点金色落点' : '点一枚棋子，查看它能去哪里';
      } else {
        main = sideName(this.turn) + '走棋';
        sub = this.selected ? '已选棋子，点金色落点' : '同屏轮流，红方先行';
      }
      this.statusText.setText(main);
      this.statusText.setColor(checked ? '#FFB6A8' : (this.aiThinking ? '#D7E7DD' : '#FFF0CC'));
      this.statusSubText.setText(sub);
      this.statusSubText.setColor(checked ? '#F0B8A8' : '#BCAF94');
      this.moveCountText.setText('第 ' + this.moveCount + ' 手');
      this.statusText.setPosition(s.x + 66, s.y + 23);
    }

    createOverlay() {
      const self = this;
      this.overlayObj = this.add.container(0, 0).setDepth(40).setVisible(false);
      const dim = this.add.graphics();
      dim.fillStyle(0x06120E, 0.64);
      dim.fillRect(0, 0, WIDTH, HEIGHT);
      this.overlayObj.add(dim);

      const o = L.over;
      const card = this.add.graphics();
      drawRounded(card, o.x - o.w / 2 + 7, o.y - o.h / 2 + 9, o.w, o.h, 26, 0x000000, null, 0.35);
      drawRounded(card, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 26, 0xFFF4DB, C.goldDeep, 0.98, 1, 2);
      card.fillStyle(0x1C4538, 0.1);
      card.fillCircle(o.x, o.y - 50, 74);
      this.overlayObj.add(card);

      this.overlayIcon = this.add.image(o.x, o.y - 113, 'xq-red-king').setDisplaySize(72, 72);
      this.overlayObj.add(this.overlayIcon);

      this.overlayTitle = this.add.text(o.x, o.y - 50, '红方胜', {
        fontFamily: SERIF, fontSize: '34px', fontStyle: 'bold', color: '#6C2E27',
      }).setOrigin(0.5);
      this.overlayObj.add(this.overlayTitle);

      this.overlayReason = this.add.text(o.x, o.y - 9, '将死黑方 · 共 0 手', {
        fontFamily: SANS, fontSize: '15px', color: '#765E48',
      }).setOrigin(0.5);
      this.overlayObj.add(this.overlayReason);

      const buttonG = this.add.graphics();
      drawPill(buttonG, L.overButton.x, L.overButton.y, L.overButton.w, L.overButton.h, C.jadeDeep, C.goldDeep, 1, 0.75);
      this.overlayObj.add(buttonG);

      this.overlayButton = this.add.text(L.overButton.x, L.overButton.y, '再来一局', {
        fontFamily: SANS, fontSize: '21px', fontStyle: 'bold', color: '#FFF4D8',
      }).setOrigin(0.5);
      this.overlayObj.add(this.overlayButton);

      const tapHint = this.add.text(o.x, o.y + 132, '点屏幕也可以再来一局', {
        fontFamily: SANS, fontSize: '12px', color: '#8F7A60',
      }).setOrigin(0.5);
      this.overlayObj.add(tapHint);

      this.overlayObj.setAlpha(0);
      this.overlayObj.setVisible(false);
      return this.overlayObj;
    }

    showOverlay() {
      if (this.overlayVisible) return;
      this.overlayVisible = true;
      this.overlayLock = OVERLAY_LOCK;
      const isDraw = this.winner === 'draw';
      const redWon = this.winner === RED;
      this.overlayIcon.setTexture(isDraw ? BOARD_TEX : (redWon ? 'xq-red-king' : 'xq-black-king'));
      this.overlayIcon.setDisplaySize(isDraw ? 72 : 72, isDraw ? 72 : 72);
      this.overlayTitle.setText(isDraw ? '和棋' : sideName(this.winner) + '胜');
      this.overlayTitle.setColor(redWon ? '#7A3028' : '#322B25');
      const reason = this.resultReason === 'checkmate'
        ? '将死' + (redWon ? '黑方' : '红方')
        : (isDraw ? '长时间没有吃子，握手言和' : '无子可走，' + sideName(this.winner) + '获胜');
      this.overlayReason.setText(reason + ' · 共 ' + this.moveCount + ' 手');
      this.overlayObj.setVisible(true);
      this.overlayObj.setAlpha(0);
      this.trackTween({
        targets: this.overlayObj,
        alpha: 1,
        duration: 180,
        ease: 'Sine.easeOut',
      });
      if (isDraw) Sound.draw();
      else if (this.winner === BLACK && this.mode === MODES.AI) Sound.softEnd();
      else Sound.win();
    }

    hideOverlay() {
      this.overlayVisible = false;
      if (this.overlayObj) this.overlayObj.setVisible(false);
      this.overlayLock = 0;
    }

    undo() {
      if (!this.history.length) {
        Sound.click();
        return false;
      }
      let count = 1;
      if (this.mode === MODES.AI && this.history.length >= 2) {
        const last = this.history[this.history.length - 1];
        if (!this.aiThinking && last.turn === BLACK) count = 2;
      }
      count = Math.min(count, this.history.length);
      let snapshot = null;
      for (let i = 0; i < count; i++) snapshot = this.history.pop();
      this.board = cloneBoard(snapshot.board);
      this.turn = snapshot.turn;
      this.lastMove = snapshot.lastMove ? {
        from: { r: snapshot.lastMove.from.r, c: snapshot.lastMove.from.c },
        to: { r: snapshot.lastMove.to.r, c: snapshot.lastMove.to.c },
      } : null;
      this.noCapture = snapshot.noCapture;
      this.moveCount = snapshot.moveCount;
      this.checkSide = snapshot.checkSide;
      this.phase = 'play';
      this.winner = null;
      this.resultReason = null;
      this.selected = null;
      this.legalMoves = [];
      this.aiThinking = false;
      this.aiWait = 0;
      this.hideOverlay();
      this.rebuildPieces();
      this.renderMode();
      this.renderControls();
      this.updateStatus();
      this.drawMarkers();
      Sound.undo();
      return true;
    }

    resetGame() {
      this.board = initialBoard();
      this.turn = RED;
      this.phase = 'play';
      this.selected = null;
      this.legalMoves = [];
      this.winner = null;
      this.resultReason = null;
      this.history = [];
      this.lastMove = null;
      this.noCapture = 0;
      this.moveCount = 0;
      this.aiThinking = false;
      this.aiWait = 0;
      this.checkSide = null;
      this.hideOverlay();
      this.rebuildPieces();
      this.renderMode();
      this.renderControls();
      this.updateStatus();
      this.drawMarkers();
    }

    tryRestart() {
      if (this.phase === 'over' && this.overlayLock > 0) return false;
      this.resetGame();
      return true;
    }

    step(dt) {
      const d = isFinite(dt) ? Math.max(0, Math.min(0.2, dt)) : 0;
      if (this.phase === 'over') {
        this.overlayLock = Math.max(0, this.overlayLock - d);
        return;
      }
      if (this.mode !== MODES.AI || this.turn !== BLACK || !this.aiThinking) return;
      this.aiWait -= d;
      if (this.aiWait > 0) return;
      this.aiThinking = false;
      this.aiWait = 0;
      const best = chooseAIMove(this.board, BLACK);
      if (!best) {
        this.phase = 'over';
        this.winner = RED;
        this.resultReason = 'stalemate';
        this.updateStatus();
        this.showOverlay();
        return;
      }
      this.applyMove(best.from, best.to, true);
    }

    update(time, delta) {
      this.step((delta || 16) / 1000);
    }

    simulate(seconds) {
      let left = Math.max(0, Number(seconds) || 0);
      let guard = 0;
      while (left > 0 && guard < 600) {
        const dt = Math.min(0.05, left);
        this.step(dt);
        left -= dt;
        guard++;
      }
      return true;
    }
  }

  window.XiangqiScene = XiangqiScene;
  window.XiangqiRules = {
    initialBoard: initialBoard,
    cloneBoard: cloneBoard,
    pseudoMoves: pseudoMoves,
    legalMovesFrom: legalMovesFrom,
    allLegalMoves: allLegalMoves,
    hasLegalMove: hasLegalMove,
    inCheck: inCheck,
    isSquareAttacked: isSquareAttacked,
    statusFor: statusFor,
    simulateMove: simulateMove,
    evaluateBoard: evaluateBoard,
    chooseAIMove: chooseAIMove,
    cellPoint: cellPoint,
    inPalace: inPalace,
    layout: L,
    CONST: SCENE_CONST,
  };
})();
