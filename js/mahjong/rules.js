/*
 * 广东麻将规则核心：牌型定义、胡牌判定、向听数、听牌与电脑出牌决策。
 * 广东玩法：不能吃，只能碰 / 杠 / 胡，自摸或胡别人的弃牌。
 * 不依赖 Phaser，浏览器与 Node 都能直接加载（方便离线校验算法）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MahjongRules = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KIND = 34;               // 0-8 万1-9、9-17 筒1-9、18-26 条1-9、27-33 东南西北中发白
  const HONOR_BASE = 27;
  const MAX_BLOCKS = 4;          // 四组面子 + 一对将
  const MAX_SHANTEN = 8;
  const ORPHAN_KINDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

  const NUMBER_TEXT = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const SUIT_TEXT = ['万', '筒', '条'];
  const HONOR_TEXT = ['东', '南', '西', '北', '中', '发', '白'];
  const SUIT_CODE = { m: 0, p: 1, s: 2, z: 3 };

  function isHonor(code) { return code >= HONOR_BASE; }
  function suitOf(code) { return code >= HONOR_BASE ? 3 : Math.floor(code / 9); }
  function rankOf(code) { return code >= HONOR_BASE ? code - HONOR_BASE : code % 9; }
  function isTerminal(code) { return !isHonor(code) && (code % 9 === 0 || code % 9 === 8); }
  function isOrphan(code) { return ORPHAN_KINDS.indexOf(code) >= 0; }

  function tileName(code) {
    if (isHonor(code)) return HONOR_TEXT[code - HONOR_BASE];
    return NUMBER_TEXT[code % 9] + SUIT_TEXT[Math.floor(code / 9)];
  }

  // 手牌数组 -> 34 长度计数数组
  function countsOf(tiles) {
    const counts = new Array(KIND).fill(0);
    for (let i = 0; i < tiles.length; i += 1) counts[tiles[i]] += 1;
    return counts;
  }

  // 一副完整牌墙：万筒条各 1-9 各四张 + 东南西北中发白各四张，共 136 张
  function createWall(random) {
    const rnd = random || Math.random;
    const wall = [];
    for (let code = 0; code < KIND; code += 1) {
      for (let copy = 0; copy < 4; copy += 1) wall.push(code);
    }
    for (let i = wall.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = wall[i]; wall[i] = wall[j]; wall[j] = tmp;
    }
    return wall;
  }

  // 七对：七组对子（四张相同算两对，简化处理）
  function chiitoiShanten(counts) {
    let pairs = 0;
    let kinds = 0;
    for (let i = 0; i < KIND; i += 1) {
      if (counts[i] > 0) kinds += 1;
      if (counts[i] >= 2) pairs += 1;
    }
    return 6 - pairs + Math.max(0, 7 - kinds);
  }

  // 十三幺
  function kokushiShanten(counts) {
    let kinds = 0;
    let hasPair = 0;
    for (let i = 0; i < ORPHAN_KINDS.length; i += 1) {
      const code = ORPHAN_KINDS[i];
      if (counts[code] > 0) kinds += 1;
      if (counts[code] >= 2) hasPair = 1;
    }
    return 13 - kinds - hasPair;
  }

  // 递归拆解：最大化 2*面子 + 搭子 + 将牌，向听数 = 8 - 该值
  function standardShanten(counts, meldCount) {
    let bestValue = -1;
    const c = counts.slice();
    const seen = new Set();

    function walk(start, sets, partials, pair) {
      let i = start;
      while (i < KIND && c[i] === 0) i += 1;
      if (i >= KIND) {
        const value = 2 * (meldCount + sets) + partials + pair;
        if (value > bestValue) bestValue = value;
        return;
      }
      const key = i + '|' + sets + '|' + partials + '|' + pair + '|' + c.slice(i).join('');
      if (seen.has(key)) return;
      seen.add(key);

      const blocks = meldCount + sets + partials;
      const rank = i < HONOR_BASE ? i % 9 : 9;

      if (c[i] >= 3 && blocks < MAX_BLOCKS) {
        c[i] -= 3; walk(i, sets + 1, partials, pair); c[i] += 3;
      }
      if (rank <= 6 && c[i + 1] > 0 && c[i + 2] > 0 && blocks < MAX_BLOCKS) {
        c[i] -= 1; c[i + 1] -= 1; c[i + 2] -= 1;
        walk(i, sets + 1, partials, pair);
        c[i] += 1; c[i + 1] += 1; c[i + 2] += 1;
      }
      if (c[i] >= 2) {
        if (!pair) { c[i] -= 2; walk(i, sets, partials, 1); c[i] += 2; }
        if (blocks < MAX_BLOCKS) { c[i] -= 2; walk(i, sets, partials + 1, pair); c[i] += 2; }
      }
      if (rank <= 7 && c[i + 1] > 0 && blocks < MAX_BLOCKS) {
        c[i] -= 1; c[i + 1] -= 1; walk(i, sets, partials + 1, pair); c[i] += 1; c[i + 1] += 1;
      }
      if (rank <= 6 && c[i + 2] > 0 && blocks < MAX_BLOCKS) {
        c[i] -= 1; c[i + 2] -= 1; walk(i, sets, partials + 1, pair); c[i] += 1; c[i + 2] += 1;
      }
      c[i] -= 1;
      walk(i, sets, partials, pair);
      c[i] += 1;
    }

    walk(0, 0, 0, 0);
    return MAX_SHANTEN - bestValue;
  }

  function shanten(counts, meldCount) {
    const melds = meldCount || 0;
    let best = standardShanten(counts, melds);
    if (melds === 0) {
      best = Math.min(best, chiitoiShanten(counts), kokushiShanten(counts));
    }
    return best;
  }

  function removeAllSets(c, start, need) {
    if (need === 0) {
      for (let i = start; i < KIND; i += 1) if (c[i] !== 0) return false;
      return true;
    }
    let i = start;
    while (i < KIND && c[i] === 0) i += 1;
    if (i >= KIND) return false;
    if (c[i] >= 3) {
      c[i] -= 3;
      if (removeAllSets(c, i, need - 1)) { c[i] += 3; return true; }
      c[i] += 3;
    }
    if (i < HONOR_BASE && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i] -= 1; c[i + 1] -= 1; c[i + 2] -= 1;
      if (removeAllSets(c, i, need - 1)) { c[i] += 1; c[i + 1] += 1; c[i + 2] += 1; return true; }
      c[i] += 1; c[i + 1] += 1; c[i + 2] += 1;
    }
    return false;
  }

  // counts 为暗手牌，meldCount 为已亮出的面子数（碰/杠都算一组）
  function isWinning(counts, meldCount) {
    const melds = meldCount || 0;
    let total = 0;
    for (let i = 0; i < KIND; i += 1) total += counts[i];
    if (total + melds * 3 !== 14) return false;
    if (melds === 0 && (chiitoiShanten(counts) === -1 || kokushiShanten(counts) === -1)) return true;
    for (let i = 0; i < KIND; i += 1) {
      if (counts[i] < 2) continue;
      counts[i] -= 2;
      const ok = removeAllSets(counts, 0, 4 - melds);
      counts[i] += 2;
      if (ok) return true;
    }
    return false;
  }

  function waitingTiles(counts, meldCount) {
    const result = [];
    const c = counts.slice();
    for (let i = 0; i < KIND; i += 1) {
      if (c[i] >= 4) continue;
      c[i] += 1;
      if (isWinning(c, meldCount || 0)) result.push(i);
      c[i] -= 1;
    }
    return result;
  }

  // 摸到哪些牌能让向听数下降（用于提示，调用较重，按需使用）
  function improvingTiles(counts, meldCount) {
    const melds = meldCount || 0;
    const base = shanten(counts, melds);
    const result = [];
    const c = counts.slice();
    for (let i = 0; i < KIND; i += 1) {
      if (c[i] >= 4) continue;
      c[i] += 1;
      if (shanten(c, melds) < base) result.push(i);
      c[i] -= 1;
    }
    return result;
  }

  // 打完一张之后能达到的最好向听（手牌多一张时使用）
  function shantenAfterBestDiscard(counts, meldCount) {
    let best = MAX_SHANTEN + 1;
    for (let i = 0; i < KIND; i += 1) {
      if (!counts[i]) continue;
      counts[i] -= 1;
      const value = shanten(counts, meldCount || 0);
      counts[i] += 1;
      if (value < best) best = value;
    }
    return best;
  }

  function discardRank(code, counts) {
    let rank = 0;
    if (counts[code] === 1) rank += 1.6;          // 孤张优先打掉
    if (isHonor(code)) rank += 1.1;
    else if (isTerminal(code)) rank += 0.5;
    else rank -= (4 - Math.abs((code % 9) - 4)) * 0.06;   // 中张更愿意留
    return rank;
  }

  function chooseDiscard(counts, meldCount, random) {
    const rnd = random || Math.random;
    let best = MAX_SHANTEN + 1;
    const picks = [];
    for (let i = 0; i < KIND; i += 1) {
      if (!counts[i]) continue;
      counts[i] -= 1;
      const value = shanten(counts, meldCount || 0);
      counts[i] += 1;
      if (value < best) { best = value; picks.length = 0; picks.push(i); }
      else if (value === best) picks.push(i);
    }
    if (!picks.length) return -1;
    let pick = picks[0];
    let pickRank = -Infinity;
    for (let i = 0; i < picks.length; i += 1) {
      const rank = discardRank(picks[i], counts) + rnd() * 0.08;
      if (rank > pickRank) { pickRank = rank; pick = picks[i]; }
    }
    return pick;
  }

  function shouldPong(counts, meldCount, tile, random) {
    const melds = meldCount || 0;
    const rnd = random || Math.random;
    if (counts[tile] < 2) return false;
    const before = shanten(counts, melds);
    counts[tile] -= 2;
    const after = shantenAfterBestDiscard(counts, melds + 1);
    counts[tile] += 2;
    if (after < before) return true;
    if (after === before && before <= 3 && rnd() < 0.4) return true;
    return false;
  }

  function shouldKong(counts, meldCount, tile, random) {
    const melds = meldCount || 0;
    const rnd = random || Math.random;
    if (counts[tile] < 3) return false;
    const before = shanten(counts, melds);
    counts[tile] -= 3;
    const after = shantenAfterBestDiscard(counts, melds + 1);
    counts[tile] += 3;
    if (after <= before) return true;
    return after === before + 1 && before <= 3 && rnd() < 0.3;
  }

  function concealedKongs(counts) {
    const result = [];
    for (let i = 0; i < KIND; i += 1) if (counts[i] === 4) result.push(i);
    return result;
  }

  // melds 形如 [{ type: 'pong' | 'kong', tile }]
  function addedKongs(counts, melds) {
    const result = [];
    for (let i = 0; i < (melds || []).length; i += 1) {
      const meld = melds[i];
      if (meld.type === 'pong' && counts[meld.tile] >= 1) result.push(meld.tile);
    }
    return result;
  }

  return {
    KIND,
    HONOR_BASE,
    MAX_SHANTEN,
    ORPHAN_KINDS,
    NUMBER_TEXT,
    HONOR_TEXT,
    SUIT_TEXT,
    SUIT_CODE,
    isHonor,
    isTerminal,
    isOrphan,
    suitOf,
    rankOf,
    tileName,
    countsOf,
    createWall,
    shanten,
    isWinning,
    waitingTiles,
    improvingTiles,
    shantenAfterBestDiscard,
    chooseDiscard,
    shouldPong,
    shouldKong,
    concealedKongs,
    addedKongs,
  };
});