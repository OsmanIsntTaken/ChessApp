import React, { useEffect, useRef } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react';
import { CLASSIFICATION_META } from '../chess/classification';
import { MoveRecord } from '../chess/types';

interface MoveHistoryPanelProps {
  moves: MoveRecord[];
  activePly: number;
  onSelectPly: (ply: number) => void;
  maxHeightClass?: string;
}

export const MoveHistoryPanel: React.FC<MoveHistoryPanelProps> = ({
  moves,
  activePly,
  onSelectPly,
  maxHeightClass = 'max-h-[260px] lg:max-h-[320px]',
}) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activePly]);

  // Group into pairs: [whiteMove, blackMove?]
  const pairs: Array<{ moveNumber: number; white: MoveRecord; black?: MoveRecord }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const renderMoveBtn = (m: MoveRecord) => {
    const isActive = activePly === m.ply;
    const meta = m.classification ? CLASSIFICATION_META[m.classification] : null;
    return (
      <button
        key={m.ply}
        ref={isActive ? activeRef : undefined}
        type="button"
        onClick={() => onSelectPly(m.ply)}
        className={`flex items-center justify-between gap-1.5 rounded px-2 py-1 text-left text-xs font-medium transition-colors sm:text-[13px] ${
          isActive
            ? 'bg-[#81B64C]/25 text-slate-900 ring-1 ring-[#81B64C]/60 dark:text-white'
            : 'text-slate-700 hover:bg-black/5 dark:text-stone-200 dark:hover:bg-white/5'
        }`}
      >
        <span className="font-mono-num truncate">{m.san}</span>
        {meta && (
          <img
            src={meta.iconPath}
            alt={meta.label}
            title={meta.label}
            className="h-3.5 w-3.5 shrink-0 object-contain"
            referrerPolicy="no-referrer"
          />
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#262421]">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-white/10">
        <span className="text-xs font-semibold text-slate-700 dark:text-stone-200">
          Hamle Geçmişi
        </span>
        <span className="font-mono-num text-[11px] text-slate-500 dark:text-stone-400">
          {moves.length} hamle
        </span>
      </div>

      <div className={`overflow-y-auto px-2 py-1.5 ${maxHeightClass}`} data-testid="move-history-list">
        {pairs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 dark:text-stone-500">
            Henüz hamle yapılmadı. Beyaz ile oyuna başla.
          </div>
        ) : (
          <div className="space-y-0.5">
            {pairs.map((pair) => (
              <div
                key={pair.moveNumber}
                className="grid grid-cols-[28px_1fr_1fr] items-center gap-1 rounded px-1 py-0.5 odd:bg-slate-50/70 dark:odd:bg-white/[0.02]"
              >
                <span className="font-mono-num text-[11px] text-slate-400 dark:text-stone-500">
                  {pair.moveNumber}.
                </span>
                {renderMoveBtn(pair.white)}
                {pair.black ? renderMoveBtn(pair.black) : <div />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation controls */}
      <div className="grid grid-cols-4 gap-1 border-t border-slate-200 bg-slate-50 p-1.5 dark:border-white/10 dark:bg-[#21201D]">
        <button
          type="button"
          aria-label="İlk pozisyona git"
          disabled={activePly <= 0}
          onClick={() => onSelectPly(0)}
          className="flex h-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-black/5 disabled:opacity-35 dark:text-stone-300 dark:hover:bg-white/10"
        >
          <ChevronFirst className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Önceki hamle"
          disabled={activePly <= 0}
          onClick={() => onSelectPly(Math.max(0, activePly - 1))}
          className="flex h-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-black/5 disabled:opacity-35 dark:text-stone-300 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Sonraki hamle"
          disabled={activePly >= moves.length}
          onClick={() => onSelectPly(Math.min(moves.length, activePly + 1))}
          className="flex h-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-black/5 disabled:opacity-35 dark:text-stone-300 dark:hover:bg-white/10"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Son hamleye git"
          disabled={activePly >= moves.length}
          onClick={() => onSelectPly(moves.length)}
          className="flex h-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-black/5 disabled:opacity-35 dark:text-stone-300 dark:hover:bg-white/10"
        >
          <ChevronLast className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
