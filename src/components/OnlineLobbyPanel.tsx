import React, { useState } from 'react';
import { Copy, Check, Globe, Plus, RefreshCw, Zap } from 'lucide-react';
import { OnlineRoomInfo, TimeControl } from '../chess/types';

interface OnlineLobbyPanelProps {
  connected: boolean;
  playerName: string;
  selectedTimeControl: TimeControl;
  openRooms: OnlineRoomInfo[];
  waitingRoomCode: string | null;
  errorMsg: string | null;
  onCreateRoom: () => void;
  onQuickMatch: () => void;
  onJoinRoom: (code: string) => void;
  onRefreshRooms: () => void;
  onCancelWait: () => void;
}

export const OnlineLobbyPanel: React.FC<OnlineLobbyPanelProps> = ({
  connected,
  playerName,
  selectedTimeControl,
  openRooms,
  waitingRoomCode,
  errorMsg,
  onCreateRoom,
  onQuickMatch,
  onJoinRoom,
  onRefreshRooms,
  onCancelWait,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!waitingRoomCode) return;
    navigator.clipboard?.writeText(waitingRoomCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (waitingRoomCode) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Rakip Bekleniyor
          </h3>
          <span className="font-mono-num text-xs font-semibold text-[#81B64C]">
            {selectedTimeControl.label}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-stone-400">
          Bu oda kodunu arkadaşına gönder veya başka bir sekmeden katıl:
        </p>

        <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 p-3 dark:bg-[#1D1B19]">
          <span className="font-mono-num text-xl font-extrabold tracking-widest text-slate-900 dark:text-white">
            {waitingRoomCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#81B64C] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#73A541]"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Kopyalandı' : 'Kodu Kopyala'}
          </button>
        </div>

        <button
          type="button"
          onClick={onCancelWait}
          className="w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-stone-300 dark:hover:bg-white/5"
        >
          Beklemeyi İptal Et
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#262421]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#81B64C]" />
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            Çevrimiçi Maç Lobisi
          </h3>
        </div>
        <span
          className={`text-[11px] font-semibold ${
            connected ? 'text-[#6F9F3D] dark:text-[#95C95D]' : 'text-amber-500'
          }`}
        >
          {connected ? 'Sunucu Bağlı' : 'Bağlanıyor...'}
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!connected}
          onClick={onQuickMatch}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#81B64C] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#73A541] disabled:opacity-50"
        >
          <Zap className="h-4 w-4" />
          Hızlı Eşleş
        </button>

        <button
          type="button"
          disabled={!connected}
          onClick={onCreateRoom}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-[#1D1B19] dark:text-stone-100 dark:hover:bg-white/5"
        >
          <Plus className="h-4 w-4" />
          Oda Kur ({playerName})
        </button>
      </div>

      {/* Join by room code */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode.trim().length >= 4) onJoinRoom(joinCode.trim().toUpperCase());
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Oda Kodu (örn. A7K2P9)"
          maxLength={8}
          aria-label="Oda Kodu"
          className="font-mono-num min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-[#81B64C] focus:outline-none dark:border-white/10 dark:bg-[#1D1B19] dark:text-white"
        />
        <button
          type="submit"
          disabled={!connected || joinCode.trim().length < 4}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-stone-200 dark:text-[#1D1B19]"
        >
          Katıl
        </button>
      </form>

      {/* Open rooms list */}
      <div className="pt-1">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-stone-400">
            Açık Odalar ({openRooms.length})
          </span>
          <button
            type="button"
            onClick={onRefreshRooms}
            aria-label="Açık odaları yenile"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-white"
          >
            <RefreshCw className="h-3 w-3" />
            Yenile
          </button>
        </div>

        {openRooms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 py-3 text-center text-[11px] text-slate-400 dark:border-white/10 dark:text-stone-500">
            Şu anda bekleyen oda yok. Yeni bir oda kurabilirsin.
          </p>
        ) : (
          <div className="max-h-36 space-y-1.5 overflow-y-auto">
            {openRooms.map((r) => (
              <div
                key={r.code}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-white/10 dark:bg-[#1D1B19]"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900 dark:text-white">{r.hostName}</span>
                  <span className="ml-2 font-mono-num text-[11px] text-slate-500">{r.code}</span>
                  <span className="ml-2 text-[11px] text-slate-400">· {r.timeControlLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onJoinRoom(r.code)}
                  className="rounded-md bg-[#81B64C] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#73A541]"
                >
                  Oyna
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
