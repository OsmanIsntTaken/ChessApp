import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpDown,
  BarChart2,
  Compass,
  RotateCcw,
} from 'lucide-react';

interface QuickAnalysisBarProps {
  showEvalBar: boolean;
  onToggleEvalBar: () => void;
  showBestMoveArrow: boolean;
  onToggleBestMove: () => void;
  showThreatArrow: boolean;
  onToggleThreat: () => void;
  liveMistakeEval: boolean;
  onToggleLiveMistake: () => void;
  onFlipBoard: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  showMistakeToggle?: boolean;
}

/**
 * Easily accessible in-game analysis toolbar for desktop and Android touch devices.
 */
export const QuickAnalysisBar: React.FC<QuickAnalysisBarProps> = ({
  showEvalBar,
  onToggleEvalBar,
  showBestMoveArrow,
  onToggleBestMove,
  showThreatArrow,
  onToggleThreat,
  liveMistakeEval,
  onToggleLiveMistake,
  onFlipBoard,
  onUndo,
  canUndo,
  showMistakeToggle = true,
}) => {
  const btnBase =
    'flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap shrink-0';

  return (
    <div
      data-testid="quick-analysis-bar"
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-white/10 dark:bg-[#262421]"
    >
      <button
        type="button"
        onClick={onToggleEvalBar}
        aria-pressed={showEvalBar}
        title="Değerlendirme Çubuğu"
        className={`${btnBase} ${
          showEvalBar
            ? 'bg-[#81B64C]/20 text-[#58812D] ring-1 ring-[#81B64C]/50 dark:text-[#A3D16A]'
            : 'text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5'
        }`}
      >
        <BarChart2 className="h-3.5 w-3.5" />
        <span>Çubuk</span>
      </button>

      <button
        type="button"
        onClick={onToggleBestMove}
        aria-pressed={showBestMoveArrow}
        title="En İyi Hamle İpucu"
        className={`${btnBase} ${
          showBestMoveArrow
            ? 'bg-emerald-500/20 text-emerald-700 ring-1 ring-emerald-500/50 dark:text-emerald-300'
            : 'text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5'
        }`}
      >
        <Compass className="h-3.5 w-3.5" />
        <span>En İyi Ok</span>
      </button>

      <button
        type="button"
        onClick={onToggleThreat}
        aria-pressed={showThreatArrow}
        title="Rakip Tehdidini Göster"
        className={`${btnBase} ${
          showThreatArrow
            ? 'bg-rose-500/20 text-rose-700 ring-1 ring-rose-500/50 dark:text-rose-300'
            : 'text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5'
        }`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Tehdit</span>
      </button>

      {showMistakeToggle && (
        <button
          type="button"
          onClick={onToggleLiveMistake}
          aria-pressed={liveMistakeEval}
          title="Bot ile oynarken hataları değerlendir"
          className={`${btnBase} ${
            liveMistakeEval
              ? 'bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/50 dark:text-amber-300'
              : 'text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Hata Analizi</span>
        </button>
      )}

      <button
        type="button"
        onClick={onFlipBoard}
        title="Tahtayı Çevir"
        aria-label="Tahtayı Çevir"
        className={`${btnBase} text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5`}
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span>Çevir</span>
      </button>

      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Hamleyi Geri Al"
          className={`${btnBase} text-slate-600 hover:bg-black/5 disabled:opacity-35 dark:text-stone-300 dark:hover:bg-white/5`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Geri Al</span>
        </button>
      )}
    </div>
  );
};
