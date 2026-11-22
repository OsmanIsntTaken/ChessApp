import test from 'node:test';
import assert from 'node:assert/strict';
import { getEloTier, clampElo } from './eloTiers';
import {
  cpToWinProbability,
  evalToBarPercent,
  formatEval,
  classifyMove,
  computeAccuracy,
  getMaterialFromFen,
} from './classification';
import { lookupOpening } from './openingBook';
import { fallbackEvaluate } from './fallbackEngine';

test('ELO tiers map 100 to 3200 with Turkish rank titles including Dahi at 3200', () => {
  assert.equal(getEloTier(100).title, 'Acemi Çaylak');
  assert.equal(getEloTier(1600).title, 'Kulüp Ustası');
  assert.equal(getEloTier(2800).title, 'Büyükusta (GM)');
  assert.equal(getEloTier(3200).title, 'Dahi');
  assert.equal(clampElo(50), 100);
  assert.equal(clampElo(3500), 3200);
});

test('Win probability and eval bar math behave symmetrically', () => {
  assert.equal(Math.round(cpToWinProbability(0, null)), 50);
  assert.equal(cpToWinProbability(0, 2), 100);
  assert.equal(cpToWinProbability(0, -3), 0);
  assert.equal(evalToBarPercent({ cp: 0, mate: null }), 50);
  assert.equal(evalToBarPercent({ cp: 0, mate: 1 }), 100);
  assert.equal(evalToBarPercent({ cp: 0, mate: -1 }), 0);
  assert.equal(formatEval({ cp: 146, mate: null }), '+1.5');
  assert.equal(formatEval({ cp: 140, mate: null }), '+1.4');
  assert.equal(formatEval({ cp: -230, mate: null }), '-2.3');
  assert.equal(formatEval({ cp: 0, mate: 3 }), 'M3');
});

test('Move classification distinguishes book, best, inaccuracy, blunder, and brilliant', () => {
  const book = classifyMove({
    color: 'w',
    playedUci: 'e2e4',
    evalBefore: { cp: 20, mate: null, bestMove: 'e2e4' },
    evalAfter: { cp: 25, mate: null, bestMove: null },
    isBookMove: true,
  });
  assert.equal(book.classification, 'book');

  const best = classifyMove({
    color: 'w',
    playedUci: 'd2d4',
    evalBefore: { cp: 40, mate: null, bestMove: 'd2d4' },
    evalAfter: { cp: 40, mate: null, bestMove: null },
    isBookMove: false,
  });
  assert.equal(best.classification, 'best');

  const blunder = classifyMove({
    color: 'w',
    playedUci: 'g2g4',
    evalBefore: { cp: 50, mate: null, bestMove: 'e2e4' },
    evalAfter: { cp: -550, mate: null, bestMove: null },
    isBookMove: false,
  });
  assert.equal(blunder.classification, 'blunder');

  const brilliant = classifyMove({
    color: 'w',
    playedUci: 'b5f7',
    evalBefore: { cp: 150, mate: null, bestMove: 'b5f7' },
    evalAfter: { cp: 210, mate: null, bestMove: null },
    isBookMove: false,
    materialDeltaForMover: -3,
  });
  assert.equal(brilliant.classification, 'brilliant');
});

test('Accuracy calculation rewards zero loss with 100% and penalizes blunders', () => {
  assert.equal(computeAccuracy([0, 0, 0]), 100);
  const badAcc = computeAccuracy([20, 35, 40]);
  assert.ok(badAcc < 60 && badAcc >= 0);
});

test('Opening book recognizes Sicilian and Italian openings', () => {
  const italian = lookupOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
  assert.equal(italian.isBook, true);
  assert.ok(italian.name.includes('İtalyan'));

  const sicilian = lookupOpening(['e4', 'c5']);
  assert.equal(sicilian.isBook, true);
  assert.ok(sicilian.name.includes('Sicilya'));
});

test('Material calculation detects captured pieces and advantage', () => {
  // Position after 1. e4 d5 2. exd5 Qxd5
  const mat = getMaterialFromFen('rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3');
  assert.equal(mat.whiteAdvantage, 0);
  assert.deepEqual(mat.whiteCaptured, ['p']);
  assert.deepEqual(mat.blackCaptured, ['P']);
});

test('Fallback alpha-beta engine finds legal best move and detects mate', () => {
  // White has mate in 1: Qxf7#
  const mateInOneFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
  const result = fallbackEvaluate(mateInOneFen, 1);
  assert.equal(result.bestMove, 'h5f7');
  assert.equal(result.mate, 1);
});
