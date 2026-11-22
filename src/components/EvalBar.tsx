import React from 'react';
import { Color } from 'chess.js';
import { evalToBarPercent, formatEval } from '../chess/classification';
import { EngineEval } from '../chess/types';

interface EvalBarProps {
  evalData?: EngineEval;
  orientation: Color;
  horizontal?: boolean;
}

export const EvalBar: React.FC<EvalBarProps> = ({ evalData, orientation, horizontal = false }) => {
  const whitePct = evalToBarPercent(evalData);
  const label = formatEval(evalData);
  const whiteAhead = evalData ? (evalData.mate !== null ? evalData.mate > 0 : evalData.cp >= 0) : true;

  if (horizontal) {
    const fillPct = orientation === 'w' ? whitePct : 100 - whitePct;
    return (
      <div
        data-testid="eval-bar-horizontal"
        className="relative flex h-6 w-full items-center overflow-hidden rounded-md bg-[#1C1B19] ring-1 ring-black/15 dark:ring-white/10"
        aria-label={`Değerlendirme çubuğu: ${label}`}
      >
        <div
          className="h-full bg-[#F3F3EE] transition-all duration-300 ease-out"
          style={{ width: `${fillPct}%` }}
        />
        <span
          className={`font-mono-num absolute left-2 text-[11px] font-bold ${
            fillPct > 25 ? 'text-[#1E1D1B]' : 'text-[#F3F3EE]'
          }`}
        >
          {label}
        </span>
      </div>
    );
  }

  // Vertical bar: if orientation is White, White fill is at the bottom
  return (
    <div
      data-testid="eval-bar"
      className="relative flex h-full w-7 shrink-0 flex-col overflow-hidden rounded-md bg-[#1C1B19] shadow-inner ring-1 ring-black/15 dark:ring-white/10"
      aria-label={`Değerlendirme çubuğu: ${label}`}
    >
      {orientation === 'w' ? (
        <>
          <div
            className="w-full bg-[#1C1B19] transition-all duration-300 ease-out"
            style={{ height: `${100 - whitePct}%` }}
          />
          <div
            className="w-full bg-[#F3F3EE] transition-all duration-300 ease-out"
            style={{ height: `${whitePct}%` }}
          />
        </>
      ) : (
        <>
          <div
            className="w-full bg-[#F3F3EE] transition-all duration-300 ease-out"
            style={{ height: `${whitePct}%` }}
          />
          <div
            className="w-full bg-[#1C1B19] transition-all duration-300 ease-out"
            style={{ height: `${100 - whitePct}%` }}
          />
        </>
      )}

      {/* Advantage score readout anchored to the winning side */}
      <span
        className={`font-mono-num pointer-events-none absolute left-0 right-0 text-center text-[10px] font-bold tracking-tighter ${
          whiteAhead
            ? orientation === 'w'
              ? 'bottom-1.5 text-[#1E1D1B]'
              : 'top-1.5 text-[#1E1D1B]'
            : orientation === 'w'
            ? 'top-1.5 text-[#F3F3EE]'
            : 'bottom-1.5 text-[#F3F3EE]'
        }`}
      >
        {label}
      </span>
    </div>
  );
};
