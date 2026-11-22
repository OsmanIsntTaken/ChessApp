import React, { useMemo, useState } from 'react';
import { BarChart3, Bot, Globe, Trash2, Users } from 'lucide-react';
import { GameMode, GameSummary } from '../chess/types';

interface GameHistoryViewProps {
  games: GameSummary[];
  onAnalyzeGame: (game: GameSummary) => void;
  onDeleteGame: (id: string) => void;
}

export const GameHistoryView: React.FC<GameHistoryViewProps> = ({
  games,
  onAnalyzeGame,
  onDeleteGame,
}) => {
  const [filter, setFilter] = useState<'all' | GameMode>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return games;
    return games.filter((g) => g.mode === filter);
  }, [games, filter]);

  const modeBadge = (mode: GameMode) => {
    if (mode === 'ai') return { label: 'Yapay Zeka', Icon: Bot };
    if (mode === 'online') return { label: 'Çevrimiçi', Icon: Globe };
    return { label: '2 Kişilik', Icon: Users };
  };

  return (
    <div className="mx-auto w-full max-w-[1060px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Oyun Geçmişi
          </h1>
          <p className="text-xs text-slate-500 dark:text-stone-400">
            Kaydedilen tüm maçların — dilediğin oyunu seçip hamle hamle analiz et
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#262421]">
          {(
            [
              { id: 'all', label: 'Tümü' },
              { id: 'ai', label: 'Yapay Zeka' },
              { id: 'online', label: 'Çevrimiçi' },
              { id: 'local', label: 'Çevrimdışı' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-[#81B64C] text-white'
                  : 'text-slate-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-white/10 dark:bg-[#262421]">
          <p className="text-sm font-medium text-slate-600 dark:text-stone-300">
            Bu kategoride henüz kaydedilmiş oyun yok.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((g) => {
            const { label, Icon } = modeBadge(g.mode);
            const playerWon =
              (g.playerColor === 'w' && g.result === '1-0') ||
              (g.playerColor === 'b' && g.result === '0-1');
            const isDraw = g.result === '1/2-1/2';
            const playerAcc = g.playerColor === 'w' ? g.whiteAccuracy : g.blackAccuracy;

            return (
              <div
                key={g.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[#81B64C]/50 dark:border-white/10 dark:bg-[#262421] sm:flex-row sm:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-stone-400">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-stone-200">
                      <Icon className="h-3.5 w-3.5 text-[#81B64C]" />
                      {label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{g.timeControlLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(g.date).toLocaleDateString('tr-TR')}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {g.whiteName}{' '}
                      <span className="font-mono-num text-xs font-normal text-slate-500">
                        ({g.whiteElo})
                      </span>
                    </span>
                    <span className="text-xs text-slate-400">vs</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {g.blackName}{' '}
                      <span className="font-mono-num text-xs font-normal text-slate-500">
                        ({g.blackElo})
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-stone-400">
                    <span>{g.openingName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{g.moves.length} hamle</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">Doğruluk: %{playerAcc.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`font-mono-num rounded-lg px-2.5 py-1 text-xs font-bold ${
                      isDraw
                        ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-stone-200'
                        : playerWon
                        ? 'bg-[#81B64C]/20 text-[#58812D] dark:text-[#A3D16A]'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {isDraw ? 'Berabere' : playerWon ? 'Kazandın' : 'Kaybettin'} ({g.result})
                  </span>

                  <button
                    type="button"
                    onClick={() => onAnalyzeGame(g)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#81B64C] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#73A541]"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Analiz Et
                  </button>

                  <button
                    type="button"
                    aria-label={`${g.whiteName} vs ${g.blackName} oyununu sil`}
                    onClick={() => onDeleteGame(g.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
