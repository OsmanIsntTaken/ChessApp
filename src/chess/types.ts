export type GameMode = 'ai' | 'online' | 'local';

export type PlayerColor = 'w' | 'b';

export type MoveClassification =
  | 'brilliant'
  | 'great_find'
  | 'best'
  | 'excellent'
  | 'correct'
  | 'book'
  | 'inaccuracy'
  | 'blunder';

export interface EngineEval {
  /** Centipawns from White's perspective (+ favors White, - favors Black) */
  cp: number;
  /** Mate in N from White's perspective (+ White mates in N, - Black mates in N) */
  mate: number | null;
  /** Best move in UCI format (e.g. e2e4, e7e8q) */
  bestMove: string | null;
  /** Principal variation line */
  pv?: string[];
  /** Search depth reached */
  depth?: number;
}

export interface MoveRecord {
  ply: number;
  moveNumber: number;
  color: PlayerColor;
  san: string;
  uci: string;
  from: string;
  to: string;
  fenBefore: string;
  fenAfter: string;
  captured?: string;
  promotion?: string;
  evalAfter?: EngineEval;
  bestMoveBefore?: string | null;
  bestMoveSan?: string | null;
  classification?: MoveClassification;
  winProbLoss?: number;
  openingName?: string;
  comment?: string;
}

export interface TimeControl {
  id: string;
  label: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'unlimited';
  initialSeconds: number;
  incrementSeconds: number;
}

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export interface GameSummary {
  id: string;
  date: string;
  mode: GameMode;
  whiteName: string;
  blackName: string;
  whiteElo: number;
  blackElo: number;
  playerColor: PlayerColor;
  result: GameResult;
  resultReason: string;
  timeControlLabel: string;
  openingName: string;
  moves: MoveRecord[];
  whiteAccuracy: number;
  blackAccuracy: number;
  isAnalyzed: boolean;
}

export type BoardThemeId = 'classic-green' | 'walnut' | 'slate' | 'ocean';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  light: string;
  dark: string;
  highlightLight: string;
  highlightDark: string;
  coordLight: string;
  coordDark: string;
}

export interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  boardTheme: BoardThemeId;
  playerName: string;
  aiName: string;
  aiElo: number;
  playerColorPref: 'w' | 'b' | 'random';
  timeControlId: string;
  liveMistakeEval: boolean;
  showEvalBar: boolean;
  showBestMoveArrow: boolean;
  showThreatArrow: boolean;
  autoQueen: boolean;
}

export interface OnlineRoomInfo {
  code: string;
  hostName: string;
  timeControlLabel: string;
  playersCount: number;
}
