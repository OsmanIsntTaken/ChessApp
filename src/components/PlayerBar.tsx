import React from 'react';
import { Bot, Cpu, User } from 'lucide-react';
import { getEloTier } from '../chess/eloTiers';
import { PlayerColor } from '../chess/types';

interface PlayerBarProps {
  name: string;
  elo: number;
  color: PlayerColor;
  isBot?: boolean;
  isTurn: boolean;
  timeSeconds: number;
  unlimitedTime: boolean;
  capturedPieces: string[];
  materialAdvantage: number;
  subtitle?: string;
}

const PIECE_UNICODE: Record<string, string> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
};

function formatClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  name,
  elo,
  color,
  isBot = false,
  isTurn,
  timeSeconds,
  unlimitedTime,
  capturedPieces,
  materialAdvantage,
  subtitle,
}) => {
  const tier = isBot ? getEloTier(elo) : null;
  const lowTime = !unlimitedTime && timeSeconds <= 20 && isTurn;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-[#262421]">
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold shadow-sm ${
            color === 'w'
              ? 'bg-[#F0F0EC] text-[#262421] ring-1 ring-black/15'
              : 'bg-[#1D1B19] text-[#F0F0EC] ring-1 ring-white/15'
          }`}
        >
          {isBot ? <Bot className="h-5 w-5 text-[#81B64C]" /> : <User className="h-5 w-5" />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-stone-100">
              {name}
            </span>
            <span className="font-mono-num shrink-0 text-xs font-medium text-slate-500 dark:text-stone-400">
              ({elo})
            </span>
            {tier && (
              <span
                className="hidden truncate text-[11px] font-medium sm:inline"
                style={{ color: tier.badgeColor }}
              >
                · {tier.title}
              </span>
            )}
          </div>

          <div className="flex min-h-[16px] items-center gap-1.5 text-xs text-slate-500 dark:text-stone-400">
            {capturedPieces.length > 0 ? (
              <span className="tracking-tighter text-slate-700 dark:text-stone-300">
                {capturedPieces.map((p, idx) => (
                  <span key={`${p}-${idx}`}>{PIECE_UNICODE[p] || ''}</span>
                ))}
              </span>
            ) : (
              subtitle && <span className="truncate text-[11px]">{subtitle}</span>
            )}
            {materialAdvantage > 0 && (
              <span className="font-mono-num text-[11px] font-semibold text-[#6F9F3D] dark:text-[#95C95D]">
                +{materialAdvantage}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Clock / Turn indicator */}
      <div className="flex items-center gap-2 shrink-0">
        {isTurn && (
          <Cpu className="hidden h-3.5 w-3.5 text-[#81B64C] sm:block" aria-hidden="true" />
        )}
        <div
          className={`font-mono-num min-w-[68px] rounded-lg px-2.5 py-1.5 text-center text-sm font-bold transition-colors ${
            unlimitedTime
              ? isTurn
                ? 'bg-[#81B64C]/20 text-[#58812D] ring-1 ring-[#81B64C]/50 dark:text-[#A3D16A]'
                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-stone-400'
              : lowTime
              ? 'bg-rose-600 text-white'
              : isTurn
              ? 'bg-slate-900 text-white dark:bg-[#F3F3EE] dark:text-[#1E1D1B]'
              : 'bg-slate-100 text-slate-500 dark:bg-[#1D1B19] dark:text-stone-400'
          }`}
        >
          {unlimitedTime ? (isTurn ? 'Sıra' : 'Bekle') : formatClock(timeSeconds)}
        </div>
      </div>
    </div>
  );
};
