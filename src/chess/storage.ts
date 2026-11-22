import { Chess } from 'chess.js';
import { classifyMove, computeAccuracy } from './classification';
import { lookupOpening } from './openingBook';
import { AppSettings, GameSummary, MoveRecord } from './types';

const SETTINGS_KEY = 'sahmat_settings_v1';
const HISTORY_KEY = 'sahmat_history_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: true,
  soundEnabled: true,
  boardTheme: 'classic-green',
  playerName: 'Oyuncu',
  aiName: 'Kuzey',
  aiElo: 1200,
  playerColorPref: 'w',
  timeControlId: 'rapid-10',
  liveMistakeEval: true,
  showEvalBar: true,
  showBestMoveArrow: false,
  showThreatArrow: false,
  autoQueen: true,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

function buildSeedGame(
  id: string,
  date: string,
  mode: GameSummary['mode'],
  whiteName: string,
  blackName: string,
  whiteElo: number,
  blackElo: number,
  playerColor: 'w' | 'b',
  result: GameSummary['result'],
  resultReason: string,
  sanMoves: string[],
  cpSeries: number[]
): GameSummary {
  const chess = new Chess();
  const moves: MoveRecord[] = [];
  const sanHistory: string[] = [];
  let openingName = 'Başlangıç Pozisyonu';

  for (let i = 0; i < sanMoves.length; i++) {
    const fenBefore = chess.fen();
    const moveObj = chess.move(sanMoves[i]);
    if (!moveObj) break;
    const fenAfter = chess.fen();
    sanHistory.push(moveObj.san);
    const opening = lookupOpening(sanHistory);
    if (opening.name !== 'Serbest Açılış') {
      openingName = opening.name;
    }

    const cpBefore = i === 0 ? 15 : cpSeries[i - 1] ?? 0;
    const cpAfter = cpSeries[i] ?? cpBefore;
    const moverDrop = moveObj.color === 'w' ? cpBefore - cpAfter : cpAfter - cpBefore;
    const isExactBest = moverDrop <= 5 && i % 3 === 0;
    const evalBefore = {
      cp: cpBefore,
      mate: null,
      bestMove: isExactBest ? `${moveObj.from}${moveObj.to}` : 'a2a3',
    };
    const evalAfter = { cp: cpAfter, mate: null, bestMove: null };

    const isLastMate = chess.isCheckmate();
    const classified = classifyMove({
      color: moveObj.color,
      playedUci: `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`,
      evalBefore,
      evalAfter: isLastMate
        ? { cp: moveObj.color === 'w' ? 9999 : -9999, mate: moveObj.color === 'w' ? 1 : -1, bestMove: null }
        : evalAfter,
      isBookMove: opening.isBook,
      materialDeltaForMover: 0,
      secondBestCpGap: isExactBest && moverDrop < -30 ? 180 : 0,
    });

    moves.push({
      ply: i + 1,
      moveNumber: Math.floor(i / 2) + 1,
      color: moveObj.color,
      san: moveObj.san,
      uci: `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`,
      from: moveObj.from,
      to: moveObj.to,
      fenBefore,
      fenAfter,
      captured: moveObj.captured,
      promotion: moveObj.promotion,
      evalAfter: isLastMate
        ? { cp: moveObj.color === 'w' ? 9999 : -9999, mate: moveObj.color === 'w' ? 1 : -1, bestMove: null }
        : evalAfter,
      bestMoveBefore: `${moveObj.from}${moveObj.to}`,
      classification: classified.classification,
      winProbLoss: classified.winProbLoss,
      openingName,
      comment: classified.comment,
    });
  }

  const whiteLosses = moves.filter((m) => m.color === 'w').map((m) => m.winProbLoss ?? 0);
  const blackLosses = moves.filter((m) => m.color === 'b').map((m) => m.winProbLoss ?? 0);

  return {
    id,
    date,
    mode,
    whiteName,
    blackName,
    whiteElo,
    blackElo,
    playerColor,
    result,
    resultReason,
    timeControlLabel: '10 dk (Hızlı)',
    openingName,
    moves,
    whiteAccuracy: computeAccuracy(whiteLosses),
    blackAccuracy: computeAccuracy(blackLosses),
    isAnalyzed: true,
  };
}

export function getSeedGames(): GameSummary[] {
  return [
    buildSeedGame(
      'seed-1',
      new Date(Date.now() - 86400000 * 2).toISOString(),
      'ai',
      'Oyuncu',
      'Kuzey',
      1240,
      1200,
      'w',
      '1-0',
      'Şah Mat',
      ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'],
      [25, 22, 35, 30, 15, 650, 9999]
    ),
    buildSeedGame(
      'seed-2',
      new Date(Date.now() - 86400000 * 1).toISOString(),
      'ai',
      'Demir Zeka',
      'Oyuncu',
      1500,
      1265,
      'b',
      '1-0',
      'Terk',
      ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'h6', 'Bh4', 'b6', 'cxd5', 'exd5'],
      [28, 22, 32, 28, 30, 26, 35, 32, 38, 34, 42, 35, 50, 115, 130, 110]
    ),
    buildSeedGame(
      'seed-3',
      new Date(Date.now() - 3600000 * 6).toISOString(),
      'online',
      'Oyuncu',
      'Anka_TR',
      1290,
      1275,
      'w',
      '1-0',
      'Şah Mat',
      ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'e5', 'Nb5', 'd6', 'N1c3', 'a6', 'Na3', 'Be6', 'Nc4', 'Rc8', 'Ne3', 'Nf6', 'Bd3', 'Be7'],
      [24, 28, 30, 26, 35, 32, 38, 45, 55, 48, 60, 52, 65, 58, 70, 62, 85, 78, 120, 110]
    ),
    buildSeedGame(
      'seed-4',
      new Date(Date.now() - 3600000 * 2).toISOString(),
      'local',
      'Oyuncu 1',
      'Oyuncu 2',
      1290,
      1290,
      'w',
      '1/2-1/2',
      'Anlaşmalı Berabere',
      ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6'],
      [22, 20, 25, 22, 28, 24, 26, 20, 24, 18, 22, 16, 20, 15]
    ),
  ];
}

export function loadGameHistory(): GameSummary[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      const seeds = getSeedGames();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(seeds));
      return seeds;
    }
    const parsed = JSON.parse(raw) as GameSummary[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getSeedGames();
  } catch {
    return getSeedGames();
  }
}

export function saveGameToHistory(game: GameSummary): GameSummary[] {
  const existing = loadGameHistory();
  const filtered = existing.filter((g) => g.id !== game.id);
  const updated = [game, ...filtered].slice(0, 60);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function deleteGameFromHistory(id: string): GameSummary[] {
  const existing = loadGameHistory();
  const updated = existing.filter((g) => g.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}
