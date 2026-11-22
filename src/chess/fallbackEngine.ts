import { Chess, Move, PieceSymbol } from 'chess.js';
import { EngineEval } from './types';

const PIECE_SCORE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White's perspective (rank 8 at index 0 -> rank 1 at index 7)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -22, -22, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

const PST_MAP: Record<PieceSymbol, number[][]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_PST,
};

/**
 * Static board evaluation in centipawns from White's perspective (+ favors White).
 */
export function evaluateStaticBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -99000 : 99000;
  }
  if (chess.isDraw()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const base = PIECE_SCORE[piece.type];
      const pstRow = piece.color === 'w' ? r : 7 - r;
      const positional = PST_MAP[piece.type][pstRow][c];
      if (piece.color === 'w') {
        score += base + positional;
      } else {
        score -= base + positional;
      }
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves.sort((a, b) => {
    const scoreA =
      (a.captured ? PIECE_SCORE[a.captured] * 10 - PIECE_SCORE[a.piece] : 0) +
      (a.promotion ? 800 : 0) +
      (a.san.includes('+') ? 40 : 0);
    const scoreB =
      (b.captured ? PIECE_SCORE[b.captured] * 10 - PIECE_SCORE[b.piece] : 0) +
      (b.promotion ? 800 : 0) +
      (b.san.includes('+') ? 40 : 0);
    return scoreB - scoreA;
  });
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maximizingWhite: boolean
): number {
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -90000 - depth : 90000 + depth;
    }
    return 0;
  }
  if (depth <= 0) {
    return evaluateStaticBoard(chess);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));
  if (maximizingWhite) {
    let best = -Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = alphaBeta(chess, depth - 1, alpha, beta, false);
      chess.undo();
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      chess.move(move);
      const score = alphaBeta(chess, depth - 1, alpha, beta, true);
      chess.undo();
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function fallbackEvaluate(fen: string, depth = 2): EngineEval {
  const chess = new Chess(fen);
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      return {
        cp: chess.turn() === 'w' ? -10000 : 10000,
        mate: chess.turn() === 'w' ? -1 : 1,
        bestMove: null,
        depth,
      };
    }
    return { cp: 0, mate: null, bestMove: null, depth };
  }

  const maximizingWhite = chess.turn() === 'w';
  const moves = orderMoves(chess.moves({ verbose: true }));
  let bestMove: Move | null = null;
  let bestScore = maximizingWhite ? -Infinity : Infinity;

  for (const move of moves) {
    chess.move(move);
    const score = alphaBeta(chess, Math.max(0, depth - 1), -Infinity, Infinity, !maximizingWhite);
    chess.undo();
    if (maximizingWhite ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  let mate: number | null = null;
  if (Math.abs(bestScore) >= 85000) {
    mate = bestScore > 0 ? 1 : -1;
  }

  return {
    cp: Math.round(bestScore),
    mate,
    bestMove: bestMove ? `${bestMove.from}${bestMove.to}${bestMove.promotion || ''}` : null,
    depth,
  };
}
