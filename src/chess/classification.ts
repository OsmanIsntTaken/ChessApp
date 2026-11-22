import { EngineEval, MoveClassification, PlayerColor } from './types';

export interface ClassificationMeta {
  id: MoveClassification;
  label: string;
  symbol: string;
  color: string;
  bgTint: string;
  iconPath: string;
  description: string;
}

export const CLASSIFICATION_META: Record<MoveClassification, ClassificationMeta> = {
  brilliant: {
    id: 'brilliant',
    label: 'Harika Hamle',
    symbol: '!!',
    color: '#1BACA6',
    bgTint: 'rgba(27, 172, 166, 0.16)',
    iconPath: '/assets/aistudio/brilliant_1024x_857412c9.png',
    description: 'Zor bulunan, fedalı veya oyunu çeviren parlak hamle',
  },
  great_find: {
    id: 'great_find',
    label: 'Çok İyi Hamle',
    symbol: '!',
    color: '#1BACA6',
    bgTint: 'rgba(27, 172, 166, 0.14)',
    iconPath: '/assets/aistudio/great_find_1024x_02cfc4b8.png',
    description: 'Kritik anda avantajı koruyan veya kazandıran tek hamle',
  },
  best: {
    id: 'best',
    label: 'En İyi Hamle',
    symbol: '★',
    color: '#81B64C',
    bgTint: 'rgba(129, 182, 76, 0.16)',
    iconPath: '/assets/aistudio/best_1024x_efcaaa12.png',
    description: 'Motorun bulduğu en güçlü devam yolu',
  },
  excellent: {
    id: 'excellent',
    label: 'Mükemmel',
    symbol: '✓+',
    color: '#81B64C',
    bgTint: 'rgba(129, 182, 76, 0.14)',
    iconPath: '/assets/aistudio/excellent_1024x_5d4c3f85.png',
    description: 'En iyi hamleye neredeyse eşdeğer çok güçlü hamle',
  },
  correct: {
    id: 'correct',
    label: 'İyi Hamle',
    symbol: '✓',
    color: '#95BB4A',
    bgTint: 'rgba(149, 187, 74, 0.12)',
    iconPath: '/assets/aistudio/correct_1024x_043e8979.png',
    description: 'Sağlam ve pozisyonu bozmayan doğru hamle',
  },
  book: {
    id: 'book',
    label: 'Kitap Hamlesi',
    symbol: '📖',
    color: '#A88865',
    bgTint: 'rgba(168, 136, 101, 0.16)',
    iconPath: '/assets/aistudio/book_1024x_ea31cde2.png',
    description: 'Bilinen açılış teorisine uygun hamle',
  },
  inaccuracy: {
    id: 'inaccuracy',
    label: 'Hatalı Hamle',
    symbol: '?!',
    color: '#F0C15C',
    bgTint: 'rgba(240, 193, 92, 0.16)',
    iconPath: '/assets/aistudio/inaccuracy_1024x_4f490747.png',
    description: 'Pozisyon üstünlüğünü hafifçe azaltan hamle',
  },
  blunder: {
    id: 'blunder',
    label: 'Büyük Hata',
    symbol: '??',
    color: '#CA3431',
    bgTint: 'rgba(202, 52, 49, 0.18)',
    iconPath: '/assets/aistudio/blunder_1024x_de20f8a5.png',
    description: 'Ciddi materyal veya oyun kaybına yol açan hata',
  },
};

export const CLASSIFICATION_ORDER: MoveClassification[] = [
  'brilliant',
  'great_find',
  'best',
  'excellent',
  'correct',
  'book',
  'inaccuracy',
  'blunder',
];

/**
 * Converts centipawn evaluation (from White's perspective) to White's win probability [0..100].
 * Standard sigmoid model calibrated for Chess.com/Lichess win expectancy.
 */
export function cpToWinProbability(cp: number, mate: number | null = null): number {
  if (mate !== null) {
    return mate > 0 ? 100 : 0;
  }
  const clamped = Math.max(-2000, Math.min(2000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/**
 * Converts evaluation to White's percentage height [4..96] on the visual Eval Bar.
 */
export function evalToBarPercent(evalData: Pick<EngineEval, 'cp' | 'mate'> | undefined): number {
  if (!evalData) return 50;
  if (evalData.mate !== null) {
    return evalData.mate > 0 ? 100 : 0;
  }
  const winProb = cpToWinProbability(evalData.cp, null);
  return Math.max(4, Math.min(96, winProb));
}

export function formatEval(evalData: Pick<EngineEval, 'cp' | 'mate'> | undefined): string {
  if (!evalData) return '0.0';
  if (evalData.mate !== null) {
    return evalData.mate > 0 ? `M${evalData.mate}` : `-M${Math.abs(evalData.mate)}`;
  }
  const pawns = evalData.cp / 100;
  if (Math.abs(pawns) < 0.05) return '0.0';
  return pawns > 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1);
}

export interface ClassifyMoveInput {
  color: PlayerColor;
  playedUci: string;
  evalBefore: EngineEval;
  evalAfter: EngineEval;
  isBookMove: boolean;
  materialDeltaForMover?: number;
  secondBestCpGap?: number;
}

export interface ClassifyMoveResult {
  classification: MoveClassification;
  winProbLoss: number;
  comment: string;
}

/**
 * Classifies a chess move into one of the 8 icon categories using win-probability delta.
 */
export function classifyMove(input: ClassifyMoveInput): ClassifyMoveResult {
  const {
    color,
    playedUci,
    evalBefore,
    evalAfter,
    isBookMove,
    materialDeltaForMover = 0,
    secondBestCpGap = 0,
  } = input;

  if (isBookMove) {
    return {
      classification: 'book',
      winProbLoss: 0,
      comment: 'Teorik açılış hamlesi.',
    };
  }

  const winBeforeWhite = cpToWinProbability(evalBefore.cp, evalBefore.mate);
  const winAfterWhite = cpToWinProbability(evalAfter.cp, evalAfter.mate);

  const winBeforeMover = color === 'w' ? winBeforeWhite : 100 - winBeforeWhite;
  const winAfterMover = color === 'w' ? winAfterWhite : 100 - winAfterWhite;

  const winProbLoss = Math.max(0, winBeforeMover - winAfterMover);
  const isEngineBest =
    evalBefore.bestMove !== null &&
    evalBefore.bestMove.toLowerCase() === playedUci.toLowerCase();

  // Brilliant: played best/near-best move that sacrifices material while maintaining >= 55% win prob
  if (
    (isEngineBest || winProbLoss <= 1.2) &&
    materialDeltaForMover <= -2 &&
    winAfterMover >= 55
  ) {
    return {
      classification: 'brilliant',
      winProbLoss,
      comment: 'Harika bir feda! Materyal vererek güçlü bir üstünlük kurdun.',
    };
  }

  // Great find: played the only move that keeps or flips a critical advantage
  if (isEngineBest && secondBestCpGap >= 150 && winAfterMover >= 48) {
    return {
      classification: 'great_find',
      winProbLoss,
      comment: 'Kritik pozisyondaki tek kazanan hamleyi buldun!',
    };
  }

  if (isEngineBest || winProbLoss <= 0.8) {
    return {
      classification: 'best',
      winProbLoss,
      comment: 'Motorun önerdiği en güçlü hamle.',
    };
  }

  if (winProbLoss <= 2.8) {
    return {
      classification: 'excellent',
      winProbLoss,
      comment: 'Çok güçlü ve tutarlı bir devam hamlesi.',
    };
  }

  if (winProbLoss <= 6.5) {
    return {
      classification: 'correct',
      winProbLoss,
      comment: 'Sağlam hamle, pozisyon dengesi korunuyor.',
    };
  }

  if (winProbLoss <= 14.5) {
    return {
      classification: 'inaccuracy',
      winProbLoss,
      comment: 'Hatalı hamle — rakibe daha iyi karşı şans tanıdı.',
    };
  }

  return {
    classification: 'blunder',
    winProbLoss,
    comment: 'Büyük hata! Önemli avantaj veya taş kaybedildi.',
  };
}

/**
 * Computes Chess.com-style accuracy percentage [0..100] from per-move win probability losses.
 */
export function computeAccuracy(winProbLosses: number[]): number {
  if (winProbLosses.length === 0) return 100;
  const avgLoss =
    winProbLosses.reduce((sum, val) => sum + Math.max(0, val), 0) / winProbLosses.length;
  const raw = 103.1668 * Math.exp(-0.04354 * avgLoss) - 3.1669;
  return Math.round(Math.max(0, Math.min(100, raw)) * 10) / 10;
}

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/**
 * Computes captured pieces and net material score from a FEN string.
 */
export function getMaterialFromFen(fen: string): {
  whiteCaptured: string[];
  blackCaptured: string[];
  whiteAdvantage: number;
} {
  const startCounts: Record<string, number> = {
    P: 8, N: 2, B: 2, R: 2, Q: 1,
    p: 8, n: 2, b: 2, r: 2, q: 1,
  };
  const boardPart = fen.split(' ')[0] || '';
  const current: Record<string, number> = {};
  for (const ch of boardPart) {
    if (startCounts[ch] !== undefined) {
      current[ch] = (current[ch] || 0) + 1;
    }
  }

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];
  const order = ['q', 'r', 'b', 'n', 'p'];

  let whiteMaterial = 0;
  let blackMaterial = 0;

  for (const p of order) {
    const upper = p.toUpperCase();
    const whiteCount = current[upper] || 0;
    const blackCount = current[p] || 0;
    whiteMaterial += whiteCount * PIECE_VALUES[p];
    blackMaterial += blackCount * PIECE_VALUES[p];

    const missingBlack = Math.max(0, startCounts[p] - blackCount);
    for (let i = 0; i < missingBlack; i++) whiteCaptured.push(p);

    const missingWhite = Math.max(0, startCounts[upper] - whiteCount);
    for (let i = 0; i < missingWhite; i++) blackCaptured.push(upper);
  }

  return {
    whiteCaptured,
    blackCaptured,
    whiteAdvantage: whiteMaterial - blackMaterial,
  };
}
