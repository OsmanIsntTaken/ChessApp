import React, { useMemo } from 'react';
import { Award, Flame, Target, TrendingUp } from 'lucide-react';
import { CLASSIFICATION_META, CLASSIFICATION_ORDER } from '../chess/classification';
import { GameSummary, MoveClassification } from '../chess/types';

interface ProfileViewProps {
  playerName: string;
  games: GameSummary[];
  onOpenAnalysis: (game: GameSummary) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  playerName,
  games,
  onOpenAnalysis,
}) => {
  const stats = useMemo(() => {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    const accuracies: number[] = [];
    const eloPoints: Array<{ label: string; elo: number }> = [];
    const moveCounts: Record<MoveClassification, number> = {
      brilliant: 0,
      great_find: 0,
      best: 0,
      excellent: 0,
      correct: 0,
      book: 0,
      inaccuracy: 0,
      blunder: 0,
    };

    const chrono = [...games].reverse();
    let runningElo = 1200;

    for (let i = 0; i < chrono.length; i++) {
      const g = chrono[i];
      const playerWon =
        (g.playerColor === 'w' && g.result === '1-0') ||
        (g.playerColor === 'b' && g.result === '0-1');
      const isDraw = g.result === '1/2-1/2';

      if (playerWon) {
        wins += 1;
        runningElo += 14;
      } else if (isDraw) {
        draws += 1;
        runningElo += 1;
      } else {
        losses += 1;
        runningElo = Math.max(100, runningElo - 11);
      }

      const playerAcc = g.playerColor === 'w' ? g.whiteAccuracy : g.blackAccuracy;
      accuracies.push(playerAcc);
      eloPoints.push({ label: `#${i + 1}`, elo: runningElo });

      for (const m of g.moves) {
        if (m.color === g.playerColor && m.classification) {
          moveCounts[m.classification] += 1;
        }
      }
    }

    const total = games.length;
    const avgAccuracy =
      accuracies.length > 0
        ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
        : 0;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const totalClassifiedMoves = Object.values(moveCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      wins,
      draws,
      losses,
      winRate,
      avgAccuracy,
      currentElo: eloPoints.length > 0 ? eloPoints[eloPoints.length - 1].elo : 1200,
      eloPoints,
      accuracies,
      moveCounts,
      totalClassifiedMoves,
    };
  }, [games]);

  // SVG ELO line chart coordinates
  const eloChart = useMemo(() => {
    const w = 440;
    const h = 150;
    const padX = 24;
    const padY = 18;
    const pts = stats.eloPoints.length > 0 ? stats.eloPoints : [{ label: '#1', elo: 1200 }];
    const minElo = Math.min(...pts.map((p) => p.elo)) - 25;
    const maxElo = Math.max(...pts.map((p) => p.elo)) + 25;
    const range = Math.max(40, maxElo - minElo);

    const coords = pts.map((p, idx) => {
      const x =
        pts.length === 1
          ? w / 2
          : padX + (idx / (pts.length - 1)) * (w - padX * 2);
      const y = h - padY - ((p.elo - minElo) / range) * (h - padY * 2);
      return { x, y, elo: p.elo, label: p.label };
    });

    const line = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)},${c.y.toFixed(1)}`)
      .join(' ');
    const area =
      coords.length > 1
        ? `M ${coords[0].x.toFixed(1)},${h - padY} L ${coords
            .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
            .join(' L ')} L ${coords[coords.length - 1].x.toFixed(1)},${h - padY} Z`
        : '';

    return { w, h, coords, line, area, minElo, maxElo };
  }, [stats.eloPoints]);

  // Donut stroke math for Win/Draw/Loss
  const donut = useMemo(() => {
    const r = 42;
    const c = 2 * Math.PI * r;
    const total = Math.max(1, stats.total);
    const winLen = (stats.wins / total) * c;
    const drawLen = (stats.draws / total) * c;
    const lossLen = (stats.losses / total) * c;
    return { r, c, winLen, drawLen, lossLen };
  }, [stats.total, stats.wins, stats.draws, stats.losses]);

  return (
    <div className="mx-auto w-full max-w-[1160px] space-y-5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#262421]">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#81B64C] text-2xl font-extrabold text-white shadow-sm">
            {playerName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {playerName}
            </h1>
            <p className="text-xs text-slate-500 dark:text-stone-400">
              Oyuncu Profili · Kişisel Performans ve Hamle İstatistikleri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-stone-400">
              Tahmini Puan
            </div>
            <div className="font-mono-num text-2xl font-extrabold text-[#6F9F3D] dark:text-[#95C95D]">
              {stats.currentElo}
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
            <span>Toplam Oyun</span>
            <Award className="h-4 w-4 text-[#81B64C]" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.total}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
            <span>Kazanma Oranı</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            %{stats.winRate}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
            <span>Ortalama Doğruluk</span>
            <Target className="h-4 w-4 text-teal-500" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            %{stats.avgAccuracy.toFixed(1)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-stone-400">
            <span>Analiz Edilen Hamle</span>
            <TrendingUp className="h-4 w-4 text-sky-500" />
          </div>
          <div className="font-mono-num mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {stats.totalClassifiedMoves}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ELO Progression Line Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421] lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                ELO Gelişim Grafiği
              </h2>
              <p className="text-xs text-slate-500 dark:text-stone-400">
                Oynanan son {stats.eloPoints.length} oyundaki puan değişimi
              </p>
            </div>
            <span className="font-mono-num text-xs font-semibold text-[#6F9F3D] dark:text-[#95C95D]">
              Güncel: {stats.currentElo}
            </span>
          </div>

          <svg viewBox={`0 0 ${eloChart.w} ${eloChart.h}`} className="h-44 w-full">
            <defs>
              <linearGradient id="eloAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#81B64C" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#81B64C" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {eloChart.area && <path d={eloChart.area} fill="url(#eloAreaGrad)" />}
            {eloChart.line && (
              <path
                d={eloChart.line}
                fill="none"
                stroke="#81B64C"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {eloChart.coords.map((pt, i) => (
              <g key={i}>
                <circle cx={pt.x} cy={pt.y} r="4.5" fill="#81B64C" stroke="#262421" strokeWidth="1.5" />
                <text
                  x={pt.x}
                  y={pt.y - 10}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-semibold dark:fill-stone-400"
                >
                  {pt.elo}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Win/Draw/Loss Donut Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Maç Sonuç Dağılımı
          </h2>
          <p className="text-xs text-slate-500 dark:text-stone-400">
            Galibiyet, beraberlik ve mağlubiyet oranı
          </p>

          <div className="mt-4 flex items-center justify-center gap-6">
            <svg viewBox="0 0 110 110" className="h-32 w-32 -rotate-90">
              <circle
                cx="55"
                cy="55"
                r={donut.r}
                fill="none"
                stroke="rgba(148,163,184,0.2)"
                strokeWidth="12"
              />
              {/* Wins */}
              <circle
                cx="55"
                cy="55"
                r={donut.r}
                fill="none"
                stroke="#81B64C"
                strokeWidth="12"
                strokeDasharray={`${donut.winLen} ${donut.c}`}
                strokeDashoffset={0}
              />
              {/* Draws */}
              <circle
                cx="55"
                cy="55"
                r={donut.r}
                fill="none"
                stroke="#94A3B8"
                strokeWidth="12"
                strokeDasharray={`${donut.drawLen} ${donut.c}`}
                strokeDashoffset={-donut.winLen}
              />
              {/* Losses */}
              <circle
                cx="55"
                cy="55"
                r={donut.r}
                fill="none"
                stroke="#CA3431"
                strokeWidth="12"
                strokeDasharray={`${donut.lossLen} ${donut.c}`}
                strokeDashoffset={-(donut.winLen + donut.drawLen)}
              />
            </svg>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#81B64C]" />
                <span className="text-slate-600 dark:text-stone-300">Galibiyet:</span>
                <span className="font-mono-num font-bold text-slate-900 dark:text-white">{stats.wins}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-slate-400" />
                <span className="text-slate-600 dark:text-stone-300">Berabere:</span>
                <span className="font-mono-num font-bold text-slate-900 dark:text-white">{stats.draws}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#CA3431]" />
                <span className="text-slate-600 dark:text-stone-300">Mağlubiyet:</span>
                <span className="font-mono-num font-bold text-slate-900 dark:text-white">{stats.losses}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Move Quality Distribution + Recent Accuracy */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Hamle Kalitesi Dağılımı
          </h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-stone-400">
            Tüm oyunlarınızdaki hamle sınıflandırmaları
          </p>
          <div className="space-y-2">
            {CLASSIFICATION_ORDER.map((cls) => {
              const meta = CLASSIFICATION_META[cls];
              const count = stats.moveCounts[cls];
              const pct =
                stats.totalClassifiedMoves > 0
                  ? Math.round((count / stats.totalClassifiedMoves) * 100)
                  : 0;
              return (
                <div key={cls} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <img
                        src={meta.iconPath}
                        alt={meta.label}
                        className="h-4 w-4 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <span className="font-medium text-slate-700 dark:text-stone-200">
                        {meta.label}
                      </span>
                    </div>
                    <span className="font-mono-num text-slate-500 dark:text-stone-400">
                      {count} (%{pct})
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accuracy Trend Bar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Oyun Doğruluk Trendi (%)
          </h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-stone-400">
            Analiz etmek için herhangi bir maç çubuğuna tıkla
          </p>
          <div className="flex h-52 items-end gap-2 border-b border-slate-200 pb-2 dark:border-white/10">
            {games.slice(0, 10).reverse().map((g) => {
              const acc = g.playerColor === 'w' ? g.whiteAccuracy : g.blackAccuracy;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onOpenAnalysis(g)}
                  title={`${g.whiteName} vs ${g.blackName} — %${acc.toFixed(1)}`}
                  className="group flex flex-1 flex-col items-center justify-end gap-1.5 h-full"
                >
                  <span className="font-mono-num text-[10px] font-semibold text-slate-500 group-hover:text-slate-900 dark:text-stone-400 dark:group-hover:text-white">
                    {Math.round(acc)}
                  </span>
                  <div
                    className="w-full max-w-[34px] rounded-t-md bg-[#81B64C] transition-opacity group-hover:opacity-85"
                    style={{ height: `${Math.max(12, acc)}%` }}
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-stone-500">
            <span>Eski Maçlar</span>
            <span>En Güncel Maç</span>
          </div>
        </div>
      </div>
    </div>
  );
};
