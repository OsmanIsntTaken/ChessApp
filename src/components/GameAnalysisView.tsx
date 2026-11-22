import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import {
  CLASSIFICATION_META,
  CLASSIFICATION_ORDER,
  cpToWinProbability,
  formatEval,
  getMaterialFromFen,
} from '../chess/classification';
import { BoardThemeId, GameSummary, MoveClassification } from '../chess/types';
import { aiEngine } from '../services/aiEngine';
import { ChessBoard } from './ChessBoard';
import { EvalBar } from './EvalBar';
import { MoveHistoryPanel } from './MoveHistoryPanel';
import { PlayerBar } from './PlayerBar';

interface GameAnalysisViewProps {
  game: GameSummary;
  boardTheme: BoardThemeId;
  onUpdateGame: (updated: GameSummary) => void;
  onBackToPlay: () => void;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const GameAnalysisView: React.FC<GameAnalysisViewProps> = ({
  game,
  boardTheme,
  onUpdateGame,
  onBackToPlay,
}) => {
  const [activePly, setActivePly] = useState<number>(game.moves.length);
  const [orientation, setOrientation] = useState<'w' | 'b'>(game.playerColor);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    setActivePly(game.moves.length);
    setOrientation(game.playerColor);
  }, [game.id]);

  // Keyboard navigation for moves
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActivePly((p) => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActivePly((p) => Math.min(game.moves.length, p + 1));
      } else if (e.key === 'Home') {
        setActivePly(0);
      } else if (e.key === 'End') {
        setActivePly(game.moves.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.moves.length]);

  const runDeepAnalysis = async () => {
    if (isAnalyzing || game.moves.length === 0) return;
    setIsAnalyzing(true);
    setProgress(5);
    try {
      const result = await aiEngine.analyzeFullGame(game.moves, (pct) => setProgress(pct));
      const updated: GameSummary = {
        ...game,
        moves: result.analyzedMoves,
        whiteAccuracy: result.whiteAccuracy,
        blackAccuracy: result.blackAccuracy,
        isAnalyzed: true,
      };
      onUpdateGame(updated);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger automatic full analysis if game hasn't been analyzed yet
  useEffect(() => {
    if (!game.isAnalyzed && game.moves.length > 0 && !isAnalyzing) {
      runDeepAnalysis();
    }
  }, [game.id, game.isAnalyzed]);

  const activeMove = activePly > 0 ? game.moves[activePly - 1] : null;
  const currentFen = activeMove ? activeMove.fenAfter : START_FEN;
  const material = useMemo(() => getMaterialFromFen(currentFen), [currentFen]);

  // Counts per classification for White & Black
  const tally = useMemo(() => {
    const counts: Record<MoveClassification, { w: number; b: number }> = {
      brilliant: { w: 0, b: 0 },
      great_find: { w: 0, b: 0 },
      best: { w: 0, b: 0 },
      excellent: { w: 0, b: 0 },
      correct: { w: 0, b: 0 },
      book: { w: 0, b: 0 },
      inaccuracy: { w: 0, b: 0 },
      blunder: { w: 0, b: 0 },
    };
    for (const m of game.moves) {
      const cls = m.classification || 'correct';
      counts[cls][m.color] += 1;
    }
    return counts;
  }, [game.moves]);

  // Evaluation Advantage Graph points [0..100]
  const chartPoints = useMemo(() => {
    const pts = [{ ply: 0, winW: 50 }];
    for (const m of game.moves) {
      const w = m.evalAfter ? cpToWinProbability(m.evalAfter.cp, m.evalAfter.mate) : 50;
      pts.push({ ply: m.ply, winW: w });
    }
    return pts;
  }, [game.moves]);

  const svgWidth = 360;
  const svgHeight = 96;
  const areaPath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    const coords = chartPoints.map((pt, idx) => {
      const x = (idx / (chartPoints.length - 1)) * svgWidth;
      const y = svgHeight - (pt.winW / 100) * svgHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M 0,${svgHeight} L ${coords.join(' L ')} L ${svgWidth},${svgHeight} Z`;
  }, [chartPoints]);

  const linePath = useMemo(() => {
    if (chartPoints.length < 2) return '';
    return chartPoints
      .map((pt, idx) => {
        const x = (idx / (chartPoints.length - 1)) * svgWidth;
        const y = svgHeight - (pt.winW / 100) * svgHeight;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [chartPoints]);

  const activeMarkerX =
    chartPoints.length > 1 ? (activePly / (chartPoints.length - 1)) * svgWidth : 0;

  const activeMeta = activeMove?.classification
    ? CLASSIFICATION_META[activeMove.classification]
    : null;

  const topPlayerIsBlack = orientation === 'w';

  return (
    <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
      {/* Left: Eval bar + Board + Player bars */}
      <div className="flex flex-col items-center gap-2.5">
        <div className="flex w-full max-w-[620px] items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBackToPlay}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#312E2B] dark:text-stone-200 dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Oyuna Dön
          </button>

          <div className="truncate text-xs font-medium text-slate-500 dark:text-stone-400">
            {game.openingName} · <span className="font-mono-num">{game.result}</span>
          </div>

          <button
            type="button"
            onClick={() => setOrientation((o) => (o === 'w' ? 'b' : 'w'))}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-[#312E2B] dark:text-stone-200 dark:hover:bg-white/10"
          >
            Tahtayı Çevir
          </button>
        </div>

        <div className="w-full max-w-[620px]">
          <PlayerBar
            name={topPlayerIsBlack ? game.blackName : game.whiteName}
            elo={topPlayerIsBlack ? game.blackElo : game.whiteElo}
            color={topPlayerIsBlack ? 'b' : 'w'}
            isBot={game.mode === 'ai' && game.playerColor !== (topPlayerIsBlack ? 'b' : 'w')}
            isTurn={false}
            timeSeconds={0}
            unlimitedTime
            capturedPieces={topPlayerIsBlack ? material.blackCaptured : material.whiteCaptured}
            materialAdvantage={
              topPlayerIsBlack
                ? Math.max(0, -material.whiteAdvantage)
                : Math.max(0, material.whiteAdvantage)
            }
          />
        </div>

        {/* Eval Bar + Board */}
        <div className="flex w-full max-w-[620px] items-stretch gap-2.5">
          <div className="hidden sm:block">
            <EvalBar evalData={activeMove?.evalAfter} orientation={orientation} />
          </div>
          <div className="flex-1">
            <div className="mb-2 sm:hidden">
              <EvalBar evalData={activeMove?.evalAfter} orientation={orientation} horizontal />
            </div>
            <ChessBoard
              fen={currentFen}
              orientation={orientation}
              themeId={boardTheme}
              interactive={false}
              lastMove={activeMove ? { from: activeMove.from, to: activeMove.to } : null}
              bestMoveArrow={activeMove?.bestMoveBefore || null}
              moveBadge={
                activeMove && activeMove.classification
                  ? { square: activeMove.to, classification: activeMove.classification }
                  : null
              }
              onMove={() => false}
            />
          </div>
        </div>

        <div className="w-full max-w-[620px]">
          <PlayerBar
            name={topPlayerIsBlack ? game.whiteName : game.blackName}
            elo={topPlayerIsBlack ? game.whiteElo : game.blackElo}
            color={topPlayerIsBlack ? 'w' : 'b'}
            isBot={game.mode === 'ai' && game.playerColor !== (topPlayerIsBlack ? 'w' : 'b')}
            isTurn={false}
            timeSeconds={0}
            unlimitedTime
            capturedPieces={topPlayerIsBlack ? material.whiteCaptured : material.blackCaptured}
            materialAdvantage={
              topPlayerIsBlack
                ? Math.max(0, material.whiteAdvantage)
                : Math.max(0, -material.whiteAdvantage)
            }
          />
        </div>
      </div>

      {/* Right: Chess.com-style Review Panel */}
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Oyun İncelemesi
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                {game.resultReason} · {game.moves.length} hamle
              </p>
            </div>
            <button
              type="button"
              onClick={runDeepAnalysis}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#81B64C] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#73A541] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? `%${progress}` : 'Derin Analiz'}
            </button>
          </div>

          {/* Accuracy Cards */}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-[#1D1B19]">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
                <span className="truncate font-medium">{game.whiteName}</span>
                <span className="text-[10px]">Beyaz</span>
              </div>
              <div className="font-mono-num mt-1 text-xl font-bold text-slate-900 dark:text-white">
                %{game.whiteAccuracy.toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-[#1D1B19]">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
                <span className="truncate font-medium">{game.blackName}</span>
                <span className="text-[10px]">Siyah</span>
              </div>
              <div className="font-mono-num mt-1 text-xl font-bold text-slate-900 dark:text-white">
                %{game.blackAccuracy.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Evaluation Advantage Graph */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-stone-400">
              <span>Avantaj Grafiği</span>
              <span className="font-mono-num">
                {activeMove ? formatEval(activeMove.evalAfter) : '0.0'}
              </span>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-[#1D1B19] ring-1 ring-black/15 dark:ring-white/10">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="h-24 w-full cursor-pointer"
                onClick={(e) => {
                  if (chartPoints.length <= 1) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                  const ply = Math.round(ratio * (chartPoints.length - 1));
                  setActivePly(ply);
                }}
              >
                {/* Midline 50% */}
                <line
                  x1="0"
                  y1={svgHeight / 2}
                  x2={svgWidth}
                  y2={svgHeight / 2}
                  stroke="rgba(255,255,255,0.16)"
                  strokeDasharray="3 3"
                />
                {areaPath && <path d={areaPath} fill="rgba(243, 243, 238, 0.85)" />}
                {linePath && <path d={linePath} fill="none" stroke="#81B64C" strokeWidth="1.8" />}
                <line
                  x1={activeMarkerX}
                  y1="0"
                  x2={activeMarkerX}
                  y2={svgHeight}
                  stroke="#F59E0B"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>

          {/* Active Move Coach Box */}
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-[#1D1B19]">
            {activeMove && activeMeta ? (
              <div className="flex items-start gap-2.5">
                <img
                  src={activeMeta.iconPath}
                  alt={activeMeta.label}
                  className="mt-0.5 h-8 w-8 shrink-0 object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {activeMove.moveNumber}.
                      {activeMove.color === 'b' ? '..' : ''} {activeMove.san} ·{' '}
                      <span style={{ color: activeMeta.color }}>{activeMeta.label}</span>
                    </span>
                    <span className="font-mono-num text-xs font-semibold text-slate-600 dark:text-stone-300">
                      {formatEval(activeMove.evalAfter)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-stone-300">
                    {activeMove.comment || activeMeta.description}
                  </p>
                  {activeMove.bestMoveSan &&
                    (activeMove.classification === 'inaccuracy' ||
                      activeMove.classification === 'blunder') && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Sparkles className="h-3.5 w-3.5" />
                        Önerilen en iyi hamle: <span className="font-mono-num">{activeMove.bestMoveSan}</span>
                      </p>
                    )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-stone-400">
                Herhangi bir hamleye tıklayarak motor değerlendirmesini ve en iyi devam yolunu incele.
              </p>
            )}
          </div>
        </div>

        {/* 8-Icon Classification Breakdown Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-[#262421]">
          <div className="mb-2 grid grid-cols-[1fr_44px_44px] items-center text-[11px] font-semibold text-slate-500 dark:text-stone-400">
            <span>Hamle Kalitesi</span>
            <span className="text-center">Beyaz</span>
            <span className="text-center">Siyah</span>
          </div>
          <div className="space-y-1">
            {CLASSIFICATION_ORDER.map((cls) => {
              const meta = CLASSIFICATION_META[cls];
              return (
                <div
                  key={cls}
                  className="grid grid-cols-[1fr_44px_44px] items-center rounded-md px-1.5 py-1 text-xs odd:bg-slate-50 dark:odd:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={meta.iconPath}
                      alt={meta.label}
                      className="h-4 w-4 shrink-0 object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <span className="font-medium text-slate-700 dark:text-stone-200">
                      {meta.label}
                    </span>
                  </div>
                  <span className="font-mono-num text-center font-bold text-slate-900 dark:text-white">
                    {tally[cls].w}
                  </span>
                  <span className="font-mono-num text-center font-bold text-slate-900 dark:text-white">
                    {tally[cls].b}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Move History Panel */}
        <MoveHistoryPanel
          moves={game.moves}
          activePly={activePly}
          onSelectPly={setActivePly}
          maxHeightClass="max-h-[210px]"
        />
      </div>
    </div>
  );
};
