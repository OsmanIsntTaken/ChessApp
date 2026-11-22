import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, Color } from 'chess.js';
import {
  Award,
  BarChart3,
  Bot,
  Crown,
  Flag,
  Globe,
  Handshake,
  History,
  Moon,
  Play,
  PlusCircle,
  Smartphone,
  Sun,
  User,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import {
  CLASSIFICATION_META,
  classifyMove,
  computeAccuracy,
  getMaterialFromFen,
} from './chess/classification';
import { AI_NAME_PRESETS, BOARD_THEMES, TIME_CONTROLS } from './chess/constants';
import { ELO_PRESETS, getEloTier } from './chess/eloTiers';
import { lookupOpening } from './chess/openingBook';
import {
  deleteGameFromHistory,
  loadGameHistory,
  loadSettings,
  saveGameToHistory,
  saveSettings,
} from './chess/storage';
import {
  AppSettings,
  BoardThemeId,
  EngineEval,
  GameMode,
  GameResult,
  GameSummary,
  MoveRecord,
  OnlineRoomInfo,
  PlayerColor,
} from './chess/types';
import { ChessBoard } from './components/ChessBoard';
import { EvalBar } from './components/EvalBar';
import { GameAnalysisView } from './components/GameAnalysisView';
import { GameHistoryView } from './components/GameHistoryView';
import { MobileApkModal } from './components/MobileApkModal';
import { MoveHistoryPanel } from './components/MoveHistoryPanel';
import { OnlineLobbyPanel } from './components/OnlineLobbyPanel';
import { PlayerBar } from './components/PlayerBar';
import { ProfileView } from './components/ProfileView';
import { QuickAnalysisBar } from './components/QuickAnalysisBar';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { aiEngine } from './services/aiEngine';
import { chessAudio } from './utils/sound';

type NavTab = 'play' | 'analysis' | 'history' | 'profile';
type MatchPhase = 'setup' | 'playing' | 'finished';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [history, setHistory] = useState<GameSummary[]>(() => loadGameHistory());
  const [activeTab, setActiveTab] = useState<NavTab>('play');
  const [selectedAnalysisGameId, setSelectedAnalysisGameId] = useState<string | null>(null);
  const [showApkModal, setShowApkModal] = useState(false);

  // Match setup & active game state
  const [setupMode, setSetupMode] = useState<GameMode>('ai');
  const [matchMode, setMatchMode] = useState<GameMode>('ai');
  const [matchPhase, setMatchPhase] = useState<MatchPhase>('setup');
  const [player2Name, setPlayer2Name] = useState('Arkadaş');

  const chessRef = useRef<Chess>(new Chess());
  const [fen, setFen] = useState<string>(START_FEN);
  const [moves, setMoves] = useState<MoveRecord[]>([]);
  const [viewPly, setViewPly] = useState<number>(0);
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w');
  const [orientation, setOrientation] = useState<Color>('w');
  const [matchResult, setMatchResult] = useState<{
    result: GameResult;
    reason: string;
    savedGameId?: string;
  } | null>(null);

  // Clocks
  const [whiteTime, setWhiteTime] = useState<number>(600);
  const [blackTime, setBlackTime] = useState<number>(600);
  const [unlimitedTime, setUnlimitedTime] = useState<boolean>(false);

  // Live Engine Evaluation & In-Game Analysis state
  const [currentEval, setCurrentEval] = useState<EngineEval>({ cp: 18, mate: null, bestMove: 'e2e4' });
  const [threatMove, setThreatMove] = useState<string | null>(null);
  const [botThinking, setBotThinking] = useState<boolean>(false);
  const [lastMistakeFeedback, setLastMistakeFeedback] = useState<MoveRecord | null>(null);

  // Online WebSocket multiplayer state
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [openRooms, setOpenRooms] = useState<OnlineRoomInfo[]>([]);
  const [onlineRoomCode, setOnlineRoomCode] = useState<string | null>(null);
  const [onlineWaitingCode, setOnlineWaitingCode] = useState<string | null>(null);
  const [onlineNames, setOnlineNames] = useState<{ w: string; b: string }>({
    w: 'Beyaz',
    b: 'Siyah',
  });
  const [onlineDrawOfferBy, setOnlineDrawOfferBy] = useState<PlayerColor | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveSettings(settings);
  }, [settings]);

  // Expose state attribute for accessibility/verification
  useEffect(() => {
    document.body.dataset.state = matchPhase;
  }, [matchPhase]);

  const activeTimeControl = useMemo(
    () => TIME_CONTROLS.find((t) => t.id === settings.timeControlId) || TIME_CONTROLS[3],
    [settings.timeControlId]
  );

  const botTier = useMemo(() => getEloTier(settings.aiElo), [settings.aiElo]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Save finished game into Game History
  const finalizeAndSaveGame = useCallback(
    (
      finalMoves: MoveRecord[],
      result: GameResult,
      reason: string,
      mode: GameMode,
      pColor: PlayerColor,
      wName: string,
      bName: string,
      wElo: number,
      bElo: number
    ) => {
      const whiteLosses = finalMoves.filter((m) => m.color === 'w').map((m) => m.winProbLoss ?? 0);
      const blackLosses = finalMoves.filter((m) => m.color === 'b').map((m) => m.winProbLoss ?? 0);
      const opening = lookupOpening(finalMoves.map((m) => m.san));
      const newId = `game-${Date.now()}`;

      const summary: GameSummary = {
        id: newId,
        date: new Date().toISOString(),
        mode,
        whiteName: wName,
        blackName: bName,
        whiteElo: wElo,
        blackElo: bElo,
        playerColor: pColor,
        result,
        resultReason: reason,
        timeControlLabel: activeTimeControl.label,
        openingName: opening.name,
        moves: finalMoves,
        whiteAccuracy: computeAccuracy(whiteLosses),
        blackAccuracy: computeAccuracy(blackLosses),
        isAnalyzed: finalMoves.every((m) => m.classification !== undefined),
      };

      const updated = saveGameToHistory(summary);
      setHistory(updated);
      setMatchPhase('finished');
      setMatchResult({ result, reason, savedGameId: newId });
      chessAudio.playMove(settings.soundEnabled, 'gameover');
    },
    [activeTimeControl.label, settings.soundEnabled]
  );

  // Start a new AI or Local 2-Player match
  const startOfflineMatch = useCallback(
    (mode: 'ai' | 'local') => {
      const fresh = new Chess();
      chessRef.current = fresh;
      setMatchMode(mode);
      setSetupMode(mode);
      setMatchPhase('playing');
      setMatchResult(null);
      setMoves([]);
      setViewPly(0);
      setFen(fresh.fen());
      setLastMistakeFeedback(null);
      setCurrentEval({ cp: 18, mate: null, bestMove: 'e2e4' });
      setThreatMove(null);
      setOnlineRoomCode(null);
      setOnlineWaitingCode(null);

      let chosenColor: PlayerColor = 'w';
      if (mode === 'ai') {
        if (settings.playerColorPref === 'b') chosenColor = 'b';
        else if (settings.playerColorPref === 'random') {
          chosenColor = Math.random() < 0.5 ? 'w' : 'b';
        }
      }
      setPlayerColor(chosenColor);
      setOrientation(chosenColor);

      const isUnlim = activeTimeControl.initialSeconds === 0;
      setUnlimitedTime(isUnlim);
      setWhiteTime(activeTimeControl.initialSeconds);
      setBlackTime(activeTimeControl.initialSeconds);
      setActiveTab('play');
    },
    [activeTimeControl.initialSeconds, settings.playerColorPref]
  );

  // Support ?autostart=1 query param for instant start
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      startOfflineMatch('ai');
    }
  }, []);

  // Clock countdown for offline games
  useEffect(() => {
    if (matchPhase !== 'playing' || matchMode === 'online' || unlimitedTime) return;

    const timer = window.setInterval(() => {
      const turn = chessRef.current.turn();
      if (turn === 'w') {
        setWhiteTime((prev) => {
          if (prev <= 1) {
            window.clearInterval(timer);
            const wName =
              matchMode === 'ai'
                ? playerColor === 'w'
                  ? settings.playerName
                  : settings.aiName
                : settings.playerName;
            const bName =
              matchMode === 'ai'
                ? playerColor === 'b'
                  ? settings.playerName
                  : settings.aiName
                : player2Name;
            finalizeAndSaveGame(
              moves,
              '0-1',
              'Süre Bitti',
              matchMode,
              playerColor,
              wName,
              bName,
              playerColor === 'w' ? 1250 : settings.aiElo,
              playerColor === 'b' ? 1250 : settings.aiElo
            );
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime((prev) => {
          if (prev <= 1) {
            window.clearInterval(timer);
            const wName =
              matchMode === 'ai'
                ? playerColor === 'w'
                  ? settings.playerName
                  : settings.aiName
                : settings.playerName;
            const bName =
              matchMode === 'ai'
                ? playerColor === 'b'
                  ? settings.playerName
                  : settings.aiName
                : player2Name;
            finalizeAndSaveGame(
              moves,
              '1-0',
              'Süre Bitti',
              matchMode,
              playerColor,
              wName,
              bName,
              playerColor === 'w' ? 1250 : settings.aiElo,
              playerColor === 'b' ? 1250 : settings.aiElo
            );
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    matchPhase,
    matchMode,
    unlimitedTime,
    moves,
    playerColor,
    settings.playerName,
    settings.aiName,
    settings.aiElo,
    player2Name,
    finalizeAndSaveGame,
  ]);

  // Connect WebSocket when Online mode is selected or active
  useEffect(() => {
    if (setupMode !== 'online' && matchMode !== 'online') return;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setOnlineError(null);
      ws.send(JSON.stringify({ type: 'list_rooms' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'rooms_list') {
          setOpenRooms(data.rooms || []);
        } else if (data.type === 'error_msg') {
          setOnlineError(data.message || 'Sunucu hatası');
        } else if (data.type === 'joined_room') {
          setOnlineWaitingCode(data.code);
          setOnlineRoomCode(data.code);
          setPlayerColor(data.assignedColor);
          setOrientation(data.assignedColor);
          setOnlineError(null);
        } else if (data.type === 'room_state' && data.room) {
          const rm = data.room;
          setOnlineNames({ w: rm.whiteName, b: rm.blackName });
          setOnlineDrawOfferBy(rm.drawOfferBy || null);
          setWhiteTime(rm.whiteTime);
          setBlackTime(rm.blackTime);
          setUnlimitedTime(rm.initialSeconds === 0);

          if (rm.status === 'waiting') {
            setOnlineWaitingCode(rm.code);
          } else if (rm.status === 'playing' || rm.status === 'finished') {
            setOnlineWaitingCode(null);
            setMatchMode('online');
            setActiveTab('play');
            const syncedChess = new Chess(rm.fen);
            chessRef.current = syncedChess;
            setFen(rm.fen);
            const serverMoves: MoveRecord[] = rm.moves || [];
            setMoves(serverMoves);
            setViewPly(serverMoves.length);

            if (rm.status === 'playing') {
              setMatchPhase('playing');
              setMatchResult(null);
            } else if (rm.status === 'finished' && rm.result) {
              setMatchPhase('finished');
              setMatchResult({
                result: rm.result,
                reason: rm.resultReason || 'Oyun Bitti',
              });
            }
          }
        }
      } catch {
        // ignore malformed packets
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      // Keep socket alive while online match is active
    };
  }, [setupMode, matchMode]);

  // Evaluate current board position in background whenever fen changes during play
  useEffect(() => {
    if (matchPhase !== 'playing') return;
    let cancelled = false;

    const runEval = async () => {
      const ev = await aiEngine.evaluatePosition(fen, 8, 2);
      if (cancelled) return;
      setCurrentEval(ev);

      if (settings.showThreatArrow) {
        // Flip turn to see what opponent threatens if they moved right now
        const parts = fen.split(' ');
        if (parts.length >= 2) {
          const flippedTurn = parts[1] === 'w' ? 'b' : 'w';
          const threatFen = `${parts[0]} ${flippedTurn} ${parts[2]} - 0 1`;
          try {
            const threatEv = await aiEngine.evaluatePosition(threatFen, 5, 1);
            if (!cancelled) setThreatMove(threatEv.bestMove);
          } catch {
            if (!cancelled) setThreatMove(null);
          }
        }
      } else {
        setThreatMove(null);
      }
    };

    runEval();
    return () => {
      cancelled = true;
    };
  }, [fen, matchPhase, settings.showThreatArrow]);

  // Apply a move locally (for AI or 2-Player modes) and evaluate mistake if enabled
  const applyLocalMove = useCallback(
    async (from: string, to: string, promotion?: string, isBotTurnMove = false) => {
      const chess = chessRef.current;
      const fenBefore = chess.fen();
      const evalBeforeSnapshot = currentEval;

      let moveResult;
      try {
        moveResult = chess.move({ from, to, promotion });
      } catch {
        return false;
      }
      if (!moveResult) return false;

      const fenAfter = chess.fen();
      setFen(fenAfter);

      // Increment clock if applicable
      if (!unlimitedTime && activeTimeControl.incrementSeconds > 0) {
        if (moveResult.color === 'w') {
          setWhiteTime((t) => t + activeTimeControl.incrementSeconds);
        } else {
          setBlackTime((t) => t + activeTimeControl.incrementSeconds);
        }
      }

      // Audio feedback
      if (chess.inCheck()) {
        chessAudio.playMove(settings.soundEnabled, 'check');
      } else if (moveResult.san === 'O-O' || moveResult.san === 'O-O-O') {
        chessAudio.playMove(settings.soundEnabled, 'castle');
      } else if (moveResult.captured) {
        chessAudio.playMove(settings.soundEnabled, 'capture');
      } else {
        chessAudio.playMove(settings.soundEnabled, 'move');
      }

      const sanList = [...moves.map((m) => m.san), moveResult.san];
      const opening = lookupOpening(sanList);

      const newMove: MoveRecord = {
        ply: moves.length + 1,
        moveNumber: Math.floor(moves.length / 2) + 1,
        color: moveResult.color,
        san: moveResult.san,
        uci: `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`,
        from: moveResult.from,
        to: moveResult.to,
        fenBefore,
        fenAfter,
        captured: moveResult.captured,
        promotion: moveResult.promotion,
        bestMoveBefore: evalBeforeSnapshot.bestMove,
        openingName: opening.name,
      };

      const nextMoves = [...moves, newMove];
      setMoves(nextMoves);
      setViewPly(nextMoves.length);

      // Live In-Game Mistake Evaluation (when enabled and human just moved)
      if (settings.liveMistakeEval && !isBotTurnMove) {
        const evalAfter = await aiEngine.evaluatePosition(fenAfter, 7, 1);
        const classified = classifyMove({
          color: moveResult.color,
          playedUci: newMove.uci,
          evalBefore: evalBeforeSnapshot,
          evalAfter,
          isBookMove: opening.isBook,
        });

        let bestMoveSan: string | null = null;
        if (evalBeforeSnapshot.bestMove) {
          try {
            const tmp = new Chess(fenBefore);
            const u = evalBeforeSnapshot.bestMove;
            const bm = tmp.move({
              from: u.slice(0, 2),
              to: u.slice(2, 4),
              promotion: u.length > 4 ? u[4] : undefined,
            });
            if (bm) bestMoveSan = bm.san;
          } catch {
            // ignore
          }
        }

        const enrichedMove: MoveRecord = {
          ...newMove,
          evalAfter,
          bestMoveSan,
          classification: classified.classification,
          winProbLoss: classified.winProbLoss,
          comment: classified.comment,
        };

        setLastMistakeFeedback(enrichedMove);
        setMoves((prev) => prev.map((pm) => (pm.ply === enrichedMove.ply ? enrichedMove : pm)));
      }

      // Check game over
      if (chess.isGameOver()) {
        let res: GameResult = '1/2-1/2';
        let reason = 'Beraberlik';
        if (chess.isCheckmate()) {
          res = moveResult.color === 'w' ? '1-0' : '0-1';
          reason = 'Şah Mat';
        } else if (chess.isStalemate()) {
          reason = 'Pat';
        } else if (chess.isThreefoldRepetition()) {
          reason = 'Üçlü Tekrar';
        } else if (chess.isInsufficientMaterial()) {
          reason = 'Yetersiz Materyal';
        }

        const wName =
          matchMode === 'ai'
            ? playerColor === 'w'
              ? settings.playerName
              : settings.aiName
            : settings.playerName;
        const bName =
          matchMode === 'ai'
            ? playerColor === 'b'
              ? settings.playerName
              : settings.aiName
            : player2Name;

        finalizeAndSaveGame(
          nextMoves,
          res,
          reason,
          matchMode,
          playerColor,
          wName,
          bName,
          playerColor === 'w' ? 1250 : settings.aiElo,
          playerColor === 'b' ? 1250 : settings.aiElo
        );
      }

      return true;
    },
    [
      currentEval,
      unlimitedTime,
      activeTimeControl.incrementSeconds,
      settings.soundEnabled,
      settings.liveMistakeEval,
      settings.playerName,
      settings.aiName,
      settings.aiElo,
      moves,
      matchMode,
      playerColor,
      player2Name,
      finalizeAndSaveGame,
    ]
  );

  // Trigger AI bot move when it is the bot's turn
  useEffect(() => {
    if (matchPhase !== 'playing' || matchMode !== 'ai') return;
    const chess = chessRef.current;
    if (chess.isGameOver()) return;
    if (chess.turn() === playerColor) return;

    let cancelled = false;
    setBotThinking(true);

    const thinkTimer = window.setTimeout(async () => {
      const botUci = await aiEngine.getBotMove(chess.fen(), settings.aiElo);
      if (cancelled || !botUci) {
        setBotThinking(false);
        return;
      }
      const from = botUci.slice(0, 2);
      const to = botUci.slice(2, 4);
      const promo = botUci.length > 4 ? botUci[4] : undefined;
      await applyLocalMove(from, to, promo, true);
      if (!cancelled) setBotThinking(false);
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(thinkTimer);
    };
  }, [fen, matchPhase, matchMode, playerColor, settings.aiElo, applyLocalMove]);

  // Handle user board move
  const handleUserMove = (from: string, to: string, promotion?: string): boolean => {
    if (matchPhase !== 'playing') return false;
    if (viewPly !== moves.length) {
      // Snap back to live position before accepting move
      setViewPly(moves.length);
      return false;
    }

    if (matchMode === 'online') {
      if (chessRef.current.turn() !== playerColor) return false;
      wsRef.current?.send(
        JSON.stringify({
          type: 'make_move',
          from,
          to,
          promotion,
        })
      );
      return true;
    }

    if (matchMode === 'ai' && (botThinking || chessRef.current.turn() !== playerColor)) {
      return false;
    }

    void applyLocalMove(from, to, promotion, false);
    return true;
  };

  // Undo last move (AI mode undoes 2 plies if it's player's turn so player can replay)
  const handleUndo = () => {
    if (matchPhase !== 'playing' || matchMode === 'online' || moves.length === 0) return;
    const undoCount = matchMode === 'ai' && chessRef.current.turn() === playerColor && moves.length >= 2 ? 2 : 1;
    for (let i = 0; i < undoCount; i++) {
      chessRef.current.undo();
    }
    const remaining = moves.slice(0, moves.length - undoCount);
    setMoves(remaining);
    setViewPly(remaining.length);
    setFen(chessRef.current.fen());
    setLastMistakeFeedback(null);
  };

  const handleResign = () => {
    if (matchPhase !== 'playing') return;
    if (matchMode === 'online') {
      wsRef.current?.send(JSON.stringify({ type: 'resign' }));
      return;
    }
    const turn = chessRef.current.turn();
    const res: GameResult =
      matchMode === 'ai'
        ? playerColor === 'w'
          ? '0-1'
          : '1-0'
        : turn === 'w'
        ? '0-1'
        : '1-0';

    const wName =
      matchMode === 'ai'
        ? playerColor === 'w'
          ? settings.playerName
          : settings.aiName
        : settings.playerName;
    const bName =
      matchMode === 'ai'
        ? playerColor === 'b'
          ? settings.playerName
          : settings.aiName
        : player2Name;

    finalizeAndSaveGame(
      moves,
      res,
      'Terk',
      matchMode,
      playerColor,
      wName,
      bName,
      playerColor === 'w' ? 1250 : settings.aiElo,
      playerColor === 'b' ? 1250 : settings.aiElo
    );
  };

  const openGameAnalysis = (game: GameSummary) => {
    setSelectedAnalysisGameId(game.id);
    setActiveTab('analysis');
  };

  const handleAnalyzeCurrentMatch = () => {
    if (matchResult?.savedGameId) {
      const found = history.find((g) => g.id === matchResult.savedGameId);
      if (found) {
        openGameAnalysis(found);
        return;
      }
    }
    if (moves.length > 0) {
      const tempId = `game-${Date.now()}`;
      const wName =
        matchMode === 'online'
          ? onlineNames.w
          : matchMode === 'ai'
          ? playerColor === 'w'
            ? settings.playerName
            : settings.aiName
          : settings.playerName;
      const bName =
        matchMode === 'online'
          ? onlineNames.b
          : matchMode === 'ai'
          ? playerColor === 'b'
            ? settings.playerName
            : settings.aiName
          : player2Name;
      const summary: GameSummary = {
        id: tempId,
        date: new Date().toISOString(),
        mode: matchMode,
        whiteName: wName,
        blackName: bName,
        whiteElo: 1250,
        blackElo: matchMode === 'ai' ? settings.aiElo : 1250,
        playerColor,
        result: matchResult?.result || '1/2-1/2',
        resultReason: matchResult?.reason || 'Analiz',
        timeControlLabel: activeTimeControl.label,
        openingName: lookupOpening(moves.map((m) => m.san)).name,
        moves,
        whiteAccuracy: 85,
        blackAccuracy: 85,
        isAnalyzed: false,
      };
      const updated = saveGameToHistory(summary);
      setHistory(updated);
      openGameAnalysis(summary);
    }
  };

  // Board display FEN (supports time-traveling move history)
  const displayedFen = useMemo(() => {
    if (viewPly === 0 && moves.length === 0) return fen;
    if (viewPly === 0) return START_FEN;
    const mv = moves[viewPly - 1];
    return mv ? mv.fenAfter : fen;
  }, [viewPly, moves, fen]);

  const displayedLastMove = useMemo(() => {
    if (viewPly <= 0) return null;
    const mv = moves[viewPly - 1];
    return mv ? { from: mv.from, to: mv.to } : null;
  }, [viewPly, moves]);

  const displayedBadge = useMemo(() => {
    if (!settings.liveMistakeEval || viewPly <= 0) return null;
    const mv = moves[viewPly - 1];
    if (mv && mv.classification && mv.color === playerColor) {
      return { square: mv.to, classification: mv.classification };
    }
    return null;
  }, [settings.liveMistakeEval, viewPly, moves, playerColor]);

  const material = useMemo(() => getMaterialFromFen(displayedFen), [displayedFen]);

  const topColor: PlayerColor = orientation === 'w' ? 'b' : 'w';
  const bottomColor: PlayerColor = orientation;

  const getPlayerLabel = (c: PlayerColor) => {
    if (matchMode === 'online') {
      return { name: c === 'w' ? onlineNames.w : onlineNames.b, elo: 1250, isBot: false };
    }
    if (matchMode === 'local') {
      return {
        name: c === 'w' ? settings.playerName : player2Name,
        elo: 1250,
        isBot: false,
      };
    }
    if (c === playerColor) {
      return { name: settings.playerName, elo: 1250, isBot: false };
    }
    return { name: settings.aiName, elo: settings.aiElo, isBot: true };
  };

  const topPlayer = getPlayerLabel(topColor);
  const bottomPlayer = getPlayerLabel(bottomColor);
  const currentTurn = chessRef.current.turn();

  const analysisGame = useMemo(() => {
    if (selectedAnalysisGameId) {
      const found = history.find((g) => g.id === selectedAnalysisGameId);
      if (found) return found;
    }
    return history[0] || null;
  }, [selectedAnalysisGameId, history]);

  const navItems: Array<{ id: NavTab; label: string; Icon: React.FC<{ className?: string }> }> = [
    { id: 'play', label: 'Oyna', Icon: Play },
    { id: 'analysis', label: 'Analiz', Icon: BarChart3 },
    { id: 'history', label: 'Geçmiş', Icon: History },
    { id: 'profile', label: 'Profil', Icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1A1A] dark:bg-[#262421] dark:text-[#F0F0EC] flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar (PDF-inspired Chess.com navigation rail) */}
      <aside className="hidden lg:flex lg:w-[200px] lg:shrink-0 lg:flex-col lg:justify-between border-r border-slate-200 bg-white dark:border-white/10 dark:bg-[#21201D] p-3">
        <div className="space-y-4">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('play')}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#81B64C] text-white shadow-sm">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display block text-lg font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                ŞahMat
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-stone-400">
                Satranç Stüdyosu
              </span>
            </div>
          </button>

          <nav className="space-y-1" aria-label="Ana Menü">
            {navItems.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-[#81B64C]/18 text-[#58812D] dark:bg-[#81B64C]/22 dark:text-[#A3D16A]'
                      : 'text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Utility Actions */}
        <div className="space-y-1.5 border-t border-slate-200 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => (isInstallable && !isInstalled ? install() : setShowApkModal(true))}
            className="flex w-full items-center gap-2.5 rounded-xl bg-[#81B64C] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#73A541]"
          >
            <Smartphone className="h-4 w-4 shrink-0" />
            <span>{isInstallable && !isInstalled ? 'Uygulamayı Yükle' : 'Android / APK'}</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ darkMode: !settings.darkMode })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5"
          >
            {settings.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{settings.darkMode ? 'Aydınlık Mod' : 'Karanlık Mod'}</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5"
          >
            {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>{settings.soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top App Bar (compact <= 52px) */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-slate-200 bg-white/95 px-3 backdrop-blur-md dark:border-white/10 dark:bg-[#21201D]/95 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#81B64C] text-white">
            <Crown className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-extrabold text-slate-900 dark:text-white">
            ŞahMat
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!isOnline && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
              <WifiOff className="h-3 w-3" />
              Çevrimdışı
            </span>
          )}
          <button
            type="button"
            aria-label="Ses Aç Kapat"
            onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 dark:text-stone-300"
          >
            {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Tema Değiştir"
            onClick={() => updateSettings({ darkMode: !settings.darkMode })}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 dark:text-stone-300"
          >
            {settings.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Android APK Kurulumu"
            onClick={() => setShowApkModal(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#81B64C]"
          >
            <Smartphone className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-3 py-3 pb-20 sm:px-6 sm:py-5 lg:pb-6">
        {!isOnline && (
          <div className="mx-auto mb-3 flex max-w-[1280px] items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <span className="inline-flex items-center gap-2">
              <WifiOff className="h-4 w-4" />
              Çevrimdışı Mod Aktif — Yapay Zeka Botu ve 2 Kişilik Oyun sorunsuz çalışır.
            </span>
          </div>
        )}

        {activeTab === 'play' && (
          <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
            {/* Center Stage: Player Top + Eval Bar + Chessboard + Player Bottom */}
            <div className="flex flex-col items-center gap-2.5">
              <div className="w-full max-w-[600px]">
                <PlayerBar
                  name={topPlayer.name}
                  elo={topPlayer.elo}
                  color={topColor}
                  isBot={topPlayer.isBot}
                  isTurn={matchPhase === 'playing' && currentTurn === topColor}
                  timeSeconds={topColor === 'w' ? whiteTime : blackTime}
                  unlimitedTime={unlimitedTime || matchPhase === 'setup'}
                  capturedPieces={topColor === 'w' ? material.whiteCaptured : material.blackCaptured}
                  materialAdvantage={
                    topColor === 'w'
                      ? Math.max(0, material.whiteAdvantage)
                      : Math.max(0, -material.whiteAdvantage)
                  }
                  subtitle={
                    topPlayer.isBot && botThinking
                      ? `${topPlayer.name} düşünüyor...`
                      : undefined
                  }
                />
              </div>

              {/* Eval Bar + Chessboard */}
              <div className="flex w-full max-w-[600px] items-stretch gap-2.5">
                {settings.showEvalBar && (
                  <div className="hidden sm:block">
                    <EvalBar evalData={currentEval} orientation={orientation} />
                  </div>
                )}

                <div className="flex-1">
                  {settings.showEvalBar && (
                    <div className="mb-2 sm:hidden">
                      <EvalBar evalData={currentEval} orientation={orientation} horizontal />
                    </div>
                  )}

                  <ChessBoard
                    fen={displayedFen}
                    orientation={orientation}
                    themeId={settings.boardTheme}
                    interactive={matchPhase === 'playing' && viewPly === moves.length}
                    allowedColor={
                      matchMode === 'local'
                        ? 'both'
                        : matchMode === 'ai' || matchMode === 'online'
                        ? playerColor
                        : 'both'
                    }
                    lastMove={displayedLastMove}
                    bestMoveArrow={settings.showBestMoveArrow ? currentEval.bestMove : null}
                    threatArrow={settings.showThreatArrow ? threatMove : null}
                    moveBadge={displayedBadge}
                    autoQueen={settings.autoQueen}
                    onMove={handleUserMove}
                  />
                </div>
              </div>

              <div className="w-full max-w-[600px]">
                <PlayerBar
                  name={bottomPlayer.name}
                  elo={bottomPlayer.elo}
                  color={bottomColor}
                  isBot={bottomPlayer.isBot}
                  isTurn={matchPhase === 'playing' && currentTurn === bottomColor}
                  timeSeconds={bottomColor === 'w' ? whiteTime : blackTime}
                  unlimitedTime={unlimitedTime || matchPhase === 'setup'}
                  capturedPieces={
                    bottomColor === 'w' ? material.whiteCaptured : material.blackCaptured
                  }
                  materialAdvantage={
                    bottomColor === 'w'
                      ? Math.max(0, material.whiteAdvantage)
                      : Math.max(0, -material.whiteAdvantage)
                  }
                />
              </div>
            </div>

            {/* Right Panel: Setup Menu OR Active Match + Quick Analysis + Move History */}
            <div className="flex flex-col gap-3">
              {matchPhase === 'setup' ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#21201D]">
                  <div className="mb-3 flex items-center justify-between">
                    <h1 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">
                      Satranç Oynayın
                    </h1>
                    <span className="text-xs font-medium text-slate-500 dark:text-stone-400">
                      {botTier.title}
                    </span>
                  </div>

                  {/* PDF-matched 3 Mode Selector Cards */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setSetupMode('ai')}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        setupMode === 'ai'
                          ? 'border-[#81B64C] bg-[#81B64C]/12'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-[#2A2825] dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#81B64C]/20 text-[#6F9F3D] dark:text-[#A3D16A]">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          Yapay Zeka ile Oyna
                        </div>
                        <div className="text-xs text-slate-500 dark:text-stone-400">
                          100–3200 ELO arası özelleştirilebilir yerel zeka (Çevrimdışı)
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSetupMode('online')}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        setupMode === 'online'
                          ? 'border-[#81B64C] bg-[#81B64C]/12'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-[#2A2825] dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          Çevrimiçi Oyna
                        </div>
                        <div className="text-xs text-slate-500 dark:text-stone-400">
                          Oda kodu kur veya gerçek oyuncularla anlık eşleş
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSetupMode('local')}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        setupMode === 'local'
                          ? 'border-[#81B64C] bg-[#81B64C]/12'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-white/10 dark:bg-[#2A2825] dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        <Users className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          Çevrimdışı 2 Kişilik
                        </div>
                        <div className="text-xs text-slate-500 dark:text-stone-400">
                          Aynı cihazda arkadaşına karşı internet olmadan oyna
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Shared Player Name + Time Control + Board Theme */}
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-3.5 dark:border-white/10">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="player-name-input"
                          className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-stone-400"
                        >
                          Oyuncu Adın
                        </label>
                        <input
                          id="player-name-input"
                          type="text"
                          value={settings.playerName}
                          onChange={(e) => updateSettings({ playerName: e.target.value })}
                          maxLength={20}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#81B64C] focus:outline-none dark:border-white/10 dark:bg-[#1D1B19] dark:text-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="time-control-select"
                          className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-stone-400"
                        >
                          Süre Kontrolü
                        </label>
                        <select
                          id="time-control-select"
                          value={settings.timeControlId}
                          onChange={(e) => updateSettings({ timeControlId: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#81B64C] focus:outline-none dark:border-white/10 dark:bg-[#1D1B19] dark:text-white"
                        >
                          {TIME_CONTROLS.map((tc) => (
                            <option key={tc.id} value={tc.id}>
                              {tc.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Board Theme Chips */}
                    <div>
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-500 dark:text-stone-400">
                        Tahta Teması
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((tid) => {
                          const bt = BOARD_THEMES[tid];
                          const active = settings.boardTheme === tid;
                          return (
                            <button
                              key={tid}
                              type="button"
                              onClick={() => updateSettings({ boardTheme: tid })}
                              className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                                active
                                  ? 'border-[#81B64C] bg-[#81B64C]/15 text-slate-900 dark:text-white'
                                  : 'border-slate-200 text-slate-600 hover:bg-black/5 dark:border-white/10 dark:text-stone-300'
                              }`}
                            >
                              <span
                                className="h-3 w-3 rounded-sm shrink-0"
                                style={{ backgroundColor: bt.dark }}
                              />
                              <span className="truncate">{bt.name.split(' ')[0]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mode-Specific Controls */}
                    {setupMode === 'ai' && (
                      <div className="space-y-3 pt-1">
                        {/* Customizable AI Name */}
                        <div>
                          <label
                            htmlFor="ai-name-input"
                            className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-stone-400"
                          >
                            Yapay Zeka İsmi (Özelleştirilebilir)
                          </label>
                          <input
                            id="ai-name-input"
                            type="text"
                            value={settings.aiName}
                            onChange={(e) => updateSettings({ aiName: e.target.value })}
                            placeholder="Örn: Kuzey"
                            maxLength={22}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#81B64C] focus:outline-none dark:border-white/10 dark:bg-[#1D1B19] dark:text-white"
                          />
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {AI_NAME_PRESETS.map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => updateSettings({ aiName: preset })}
                                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                                  settings.aiName === preset
                                    ? 'bg-[#81B64C] text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-stone-300'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 100 - 3200 ELO Slider with Dynamic Turkish Tier Name */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#1D1B19]">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                Zorluk: <span style={{ color: botTier.badgeColor }}>{botTier.title}</span>
                              </span>
                              <p className="text-[11px] text-slate-500 dark:text-stone-400">
                                {botTier.subtitle}
                              </p>
                            </div>
                            <span className="font-mono-num rounded-lg bg-[#262421] px-2.5 py-1 text-sm font-extrabold text-[#A3D16A]">
                              {settings.aiElo}
                            </span>
                          </div>

                          <input
                            type="range"
                            min={100}
                            max={3200}
                            step={50}
                            aria-label="Bot ELO Seviyesi"
                            value={settings.aiElo}
                            onChange={(e) => updateSettings({ aiElo: Number(e.target.value) })}
                            className="mt-2.5 h-2 w-full cursor-pointer accent-[#81B64C]"
                          />

                          <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
                            <span>100 · Çaylak</span>
                            <span>1600 · Usta</span>
                            <span>2700 · GM</span>
                            <span>3200 · Dahi</span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1">
                            {ELO_PRESETS.filter((_, idx) => idx % 2 === 0 || idx === ELO_PRESETS.length - 1).map(
                              (p) => (
                                <button
                                  key={p.elo}
                                  type="button"
                                  onClick={() => updateSettings({ aiElo: p.elo })}
                                  className={`font-mono-num rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                                    settings.aiElo === p.elo
                                      ? 'bg-[#81B64C] text-white'
                                      : 'bg-white text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-stone-300'
                                  }`}
                                >
                                  {p.elo}
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Color Choice */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: 'w', label: 'Beyaz' },
                              { id: 'random', label: 'Rastgele' },
                              { id: 'b', label: 'Siyah' },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => updateSettings({ playerColorPref: opt.id })}
                              className={`rounded-lg border py-1.5 text-xs font-semibold transition ${
                                settings.playerColorPref === opt.id
                                  ? 'border-[#81B64C] bg-[#81B64C]/18 text-[#58812D] dark:text-[#A3D16A]'
                                  : 'border-slate-200 text-slate-600 hover:bg-black/5 dark:border-white/10 dark:text-stone-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Extra Setting: Live In-Game Mistake Evaluation */}
                        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-white/10 dark:bg-[#1D1B19]">
                          <div>
                            <div className="text-xs font-semibold text-slate-900 dark:text-white">
                              Oyun İçi Hata Değerlendirmesi
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-stone-400">
                              Botla oynarken her hamleni anında sınıflandır ve hataları göster
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={settings.liveMistakeEval}
                            onChange={(e) => updateSettings({ liveMistakeEval: e.target.checked })}
                            className="h-4 w-4 accent-[#81B64C]"
                          />
                        </label>

                        <button
                          type="button"
                          data-start="true"
                          onClick={() => startOfflineMatch('ai')}
                          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#81B64C] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#73A541] active:scale-[0.99]"
                        >
                          <Play className="h-4 w-4 fill-current" />
                          Oyunu Başlat ({settings.aiName || 'Yapay Zeka'})
                        </button>
                      </div>
                    )}

                    {setupMode === 'online' && (
                      <OnlineLobbyPanel
                        connected={wsConnected}
                        playerName={settings.playerName || 'Oyuncu'}
                        selectedTimeControl={activeTimeControl}
                        openRooms={openRooms}
                        waitingRoomCode={onlineWaitingCode}
                        errorMsg={onlineError}
                        onCreateRoom={() => {
                          wsRef.current?.send(
                            JSON.stringify({
                              type: 'create_room',
                              playerName: settings.playerName || 'Oyuncu',
                              timeControlLabel: activeTimeControl.label,
                              initialSeconds: activeTimeControl.initialSeconds,
                              incrementSeconds: activeTimeControl.incrementSeconds,
                              color: settings.playerColorPref === 'b' ? 'b' : 'w',
                            })
                          );
                        }}
                        onQuickMatch={() => {
                          wsRef.current?.send(
                            JSON.stringify({
                              type: 'quick_match',
                              playerName: settings.playerName || 'Oyuncu',
                              timeControlLabel: activeTimeControl.label,
                              initialSeconds: activeTimeControl.initialSeconds,
                              incrementSeconds: activeTimeControl.incrementSeconds,
                            })
                          );
                        }}
                        onJoinRoom={(code) => {
                          wsRef.current?.send(
                            JSON.stringify({
                              type: 'join_room',
                              code,
                              playerName: settings.playerName || 'Oyuncu',
                            })
                          );
                        }}
                        onRefreshRooms={() => {
                          wsRef.current?.send(JSON.stringify({ type: 'list_rooms' }));
                        }}
                        onCancelWait={() => {
                          setOnlineWaitingCode(null);
                          setOnlineRoomCode(null);
                        }}
                      />
                    )}

                    {setupMode === 'local' && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label
                            htmlFor="player2-name-input"
                            className="mb-1 block text-[11px] font-semibold text-slate-500 dark:text-stone-400"
                          >
                            2. Oyuncu Adı (Siyah)
                          </label>
                          <input
                            id="player2-name-input"
                            type="text"
                            value={player2Name}
                            onChange={(e) => setPlayer2Name(e.target.value)}
                            maxLength={20}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#81B64C] focus:outline-none dark:border-white/10 dark:bg-[#1D1B19] dark:text-white"
                          />
                        </div>

                        <button
                          type="button"
                          data-start="true"
                          onClick={() => startOfflineMatch('local')}
                          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#81B64C] px-4 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#73A541] active:scale-[0.99]"
                        >
                          <Users className="h-4 w-4" />
                          2 Kişilik Maçı Başlat
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Always-Accessible In-Game Analysis Toolbar */}
                  <QuickAnalysisBar
                    showEvalBar={settings.showEvalBar}
                    onToggleEvalBar={() => updateSettings({ showEvalBar: !settings.showEvalBar })}
                    showBestMoveArrow={settings.showBestMoveArrow}
                    onToggleBestMove={() =>
                      updateSettings({ showBestMoveArrow: !settings.showBestMoveArrow })
                    }
                    showThreatArrow={settings.showThreatArrow}
                    onToggleThreat={() =>
                      updateSettings({ showThreatArrow: !settings.showThreatArrow })
                    }
                    liveMistakeEval={settings.liveMistakeEval}
                    onToggleLiveMistake={() =>
                      updateSettings({ liveMistakeEval: !settings.liveMistakeEval })
                    }
                    onFlipBoard={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
                    onUndo={matchMode !== 'online' ? handleUndo : undefined}
                    canUndo={matchPhase === 'playing' && matchMode !== 'online' && moves.length > 0}
                    showMistakeToggle={matchMode === 'ai'}
                  />

                  {/* Live Mistake Evaluation Card (when active in bot mode) */}
                  {settings.liveMistakeEval && lastMistakeFeedback && lastMistakeFeedback.classification && (
                    <div
                      data-testid="live-mistake-card"
                      className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#262421]"
                    >
                      <img
                        src={CLASSIFICATION_META[lastMistakeFeedback.classification].iconPath}
                        alt={CLASSIFICATION_META[lastMistakeFeedback.classification].label}
                        className="h-7 w-7 shrink-0 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {lastMistakeFeedback.san} ·{' '}
                            <span
                              style={{
                                color: CLASSIFICATION_META[lastMistakeFeedback.classification].color,
                              }}
                            >
                              {CLASSIFICATION_META[lastMistakeFeedback.classification].label}
                            </span>
                          </span>
                          {lastMistakeFeedback.bestMoveSan &&
                            (lastMistakeFeedback.classification === 'inaccuracy' ||
                              lastMistakeFeedback.classification === 'blunder') && (
                              <span className="font-mono-num text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                En iyi: {lastMistakeFeedback.bestMoveSan}
                              </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-stone-400">
                          {lastMistakeFeedback.comment}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Online Draw Offer Banner */}
                  {matchMode === 'online' && onlineDrawOfferBy && onlineDrawOfferBy !== playerColor && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                      <span className="font-semibold text-amber-800 dark:text-amber-200">
                        Rakibin beraberlik teklif etti.
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => wsRef.current?.send(JSON.stringify({ type: 'accept_draw' }))}
                          className="rounded-lg bg-[#81B64C] px-2.5 py-1 font-bold text-white"
                        >
                          Kabul Et
                        </button>
                        <button
                          type="button"
                          onClick={() => wsRef.current?.send(JSON.stringify({ type: 'decline_draw' }))}
                          className="rounded-lg bg-slate-200 px-2.5 py-1 font-bold text-slate-700 dark:bg-white/10 dark:text-stone-200"
                        >
                          Reddet
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Match Result Card when Finished */}
                  {matchPhase === 'finished' && matchResult && (
                    <div
                      data-testid="match-result-card"
                      className="rounded-xl border border-[#81B64C]/50 bg-white p-4 shadow-sm dark:bg-[#262421]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                            {matchResult.result === '1/2-1/2'
                              ? 'Berabere'
                              : (matchResult.result === '1-0' && playerColor === 'w') ||
                                (matchResult.result === '0-1' && playerColor === 'b')
                              ? 'Tebrikler, Kazandın!'
                              : 'Maç Sona Erdi'}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-stone-400">
                            {matchResult.reason} ·{' '}
                            <span className="font-mono-num">{matchResult.result}</span>
                          </p>
                        </div>
                        <Award className="h-7 w-7 text-[#81B64C]" />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleAnalyzeCurrentMatch}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#81B64C] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#73A541]"
                        >
                          <BarChart3 className="h-4 w-4" />
                          Oyunu Analiz Et
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchPhase('setup')}
                          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100 dark:border-white/10 dark:bg-[#1D1B19] dark:text-stone-100"
                        >
                          <PlusCircle className="h-4 w-4" />
                          Yeni Maç
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Move History List Panel */}
                  <MoveHistoryPanel
                    moves={moves}
                    activePly={viewPly}
                    onSelectPly={setViewPly}
                  />

                  {/* Active Match Bottom Controls */}
                  {matchPhase === 'playing' && (
                    <div className="grid grid-cols-2 gap-2">
                      {matchMode === 'online' ? (
                        <button
                          type="button"
                          onClick={() => wsRef.current?.send(JSON.stringify({ type: 'offer_draw' }))}
                          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#262421] dark:text-stone-200"
                        >
                          <Handshake className="h-4 w-4" />
                          Beraberlik Teklif Et
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMatchPhase('setup')}
                          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#262421] dark:text-stone-200"
                        >
                          <PlusCircle className="h-4 w-4" />
                          Kuruluma Dön
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleResign}
                        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
                      >
                        <Flag className="h-4 w-4" />
                        Terk Et
                      </button>
                    </div>
                  )}

                  {onlineRoomCode && matchMode === 'online' && (
                    <div className="text-center text-[11px] text-slate-500 dark:text-stone-400">
                      Oda Kodu: <span className="font-mono-num font-bold">{onlineRoomCode}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && analysisGame && (
          <GameAnalysisView
            game={analysisGame}
            boardTheme={settings.boardTheme}
            onUpdateGame={(updated) => {
              const next = saveGameToHistory(updated);
              setHistory(next);
            }}
            onBackToPlay={() => setActiveTab('play')}
          />
        )}

        {activeTab === 'history' && (
          <GameHistoryView
            games={history}
            onAnalyzeGame={openGameAnalysis}
            onDeleteGame={(id) => setHistory(deleteGameFromHistory(id))}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            playerName={settings.playerName || 'Oyuncu'}
            games={history}
            onOpenAnalysis={openGameAnalysis}
          />
        )}
      </main>

      {/* Mobile Bottom Thumb Navigation Bar (Android / Touch Ergonomics <= 15% viewport height) */}
      <nav
        aria-label="Mobil Alt Menü"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-4 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur-md dark:border-white/10 dark:bg-[#21201D]/95 lg:hidden"
      >
        {navItems.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                active
                  ? 'text-[#6F9F3D] dark:text-[#A3D16A]'
                  : 'text-slate-500 dark:text-stone-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <MobileApkModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
}
