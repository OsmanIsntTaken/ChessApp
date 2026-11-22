import { Chess } from 'chess.js';
import { classifyMove, computeAccuracy } from '../chess/classification';
import { getEloTier } from '../chess/eloTiers';
import { fallbackEvaluate } from '../chess/fallbackEngine';
import { lookupOpening } from '../chess/openingBook';
import { EngineEval, MoveRecord } from '../chess/types';

interface PvCandidate {
  move: string;
  cp: number;
  mate: number | null;
  pv: string[];
}

class LocalChessAIService {
  private worker: Worker | null = null;
  private isReady = false;
  private initFailed = false;
  private initPromise: Promise<boolean> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private async ensureWorker(): Promise<boolean> {
    if (this.initFailed || typeof Worker === 'undefined') return false;
    if (this.isReady && this.worker) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<boolean>((resolve) => {
      try {
        const worker = new Worker('/engine/chess-ai.js');
        const timeout = window.setTimeout(() => {
          this.initFailed = true;
          try {
            worker.terminate();
          } catch {
            // ignore
          }
          resolve(false);
        }, 5000);

        const onInitMsg = (e: MessageEvent) => {
          const line = String(e.data || '');
          if (line === 'uciok') {
            worker.postMessage('isready');
          } else if (line === 'readyok') {
            window.clearTimeout(timeout);
            worker.removeEventListener('message', onInitMsg);
            this.worker = worker;
            this.isReady = true;
            resolve(true);
          }
        };

        worker.addEventListener('message', onInitMsg);
        worker.addEventListener('error', () => {
          window.clearTimeout(timeout);
          this.initFailed = true;
          resolve(false);
        });

        worker.postMessage('uci');
      } catch {
        this.initFailed = true;
        resolve(false);
      }
    });

    return this.initPromise;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => {});
    return next;
  }

  private runUciSearch(
    fen: string,
    options: {
      depth?: number;
      moveTimeMs?: number;
      multiPv?: number;
      limitElo?: number | null;
    }
  ): Promise<{ bestMove: string | null; candidates: PvCandidate[] }> {
    return new Promise((resolve) => {
      if (!this.worker || !this.isReady) {
        const fb = fallbackEvaluate(fen, 2);
        resolve({
          bestMove: fb.bestMove,
          candidates: fb.bestMove
            ? [{ move: fb.bestMove, cp: fb.cp, mate: fb.mate, pv: [fb.bestMove] }]
            : [],
        });
        return;
      }

      const worker = this.worker;
      const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
      const sign = turn === 'w' ? 1 : -1;
      const candidates = new Map<number, PvCandidate>();
      let settled = false;

      const finish = (bestMove: string | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(safetyTimer);
        worker.removeEventListener('message', onMessage);
        const sorted = Array.from(candidates.entries())
          .sort((a, b) => a[0] - b[0])
          .map((e) => e[1]);
        resolve({ bestMove, candidates: sorted });
      };

      const safetyTimer = window.setTimeout(() => {
        try {
          worker.postMessage('stop');
        } catch {
          // ignore
        }
        const first = candidates.get(1);
        finish(first?.move || null);
      }, (options.moveTimeMs || 700) + 1500);

      const onMessage = (e: MessageEvent) => {
        const line = String(e.data || '').trim();
        if (line.startsWith('info ') && line.includes(' pv ')) {
          const multipvMatch = line.match(/\bmultipv (\d+)/);
          const pvIdx = multipvMatch ? Number(multipvMatch[1]) : 1;
          const cpMatch = line.match(/\bscore cp (-?\d+)/);
          const mateMatch = line.match(/\bscore mate (-?\d+)/);
          const pvMatch = line.match(/\bpv (.+)$/);

          if (pvMatch) {
            const pvMoves = pvMatch[1].trim().split(/\s+/);
            const rawCp = cpMatch ? Number(cpMatch[1]) : 0;
            const rawMate = mateMatch ? Number(mateMatch[1]) : null;
            candidates.set(pvIdx, {
              move: pvMoves[0],
              cp: rawMate !== null ? (rawMate > 0 ? 9500 : -9500) * sign : rawCp * sign,
              mate: rawMate !== null ? rawMate * sign : null,
              pv: pvMoves,
            });
          }
        } else if (line.startsWith('bestmove ')) {
          const parts = line.split(/\s+/);
          const best = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
          finish(best);
        }
      };

      worker.addEventListener('message', onMessage);

      const multiPv = options.multiPv ?? 1;
      worker.postMessage(`setoption name MultiPV value ${multiPv}`);
      if (options.limitElo && options.limitElo >= 1320 && options.limitElo < 3190) {
        worker.postMessage('setoption name UCI_LimitStrength value true');
        worker.postMessage(`setoption name UCI_Elo value ${Math.round(options.limitElo)}`);
      } else {
        worker.postMessage('setoption name UCI_LimitStrength value false');
      }

      worker.postMessage(`position fen ${fen}`);
      if (options.depth) {
        worker.postMessage(`go depth ${options.depth}`);
      } else {
        worker.postMessage(`go movetime ${options.moveTimeMs ?? 350}`);
      }
    });
  }

  /**
   * Evaluates a single board position from White's perspective.
   */
  public evaluatePosition(fen: string, depth = 10, multiPv = 2): Promise<EngineEval & { secondBestCpGap: number }> {
    return this.enqueue(async () => {
      const chess = new Chess(fen);
      if (chess.isGameOver()) {
        if (chess.isCheckmate()) {
          const whiteWins = chess.turn() === 'b';
          return {
            cp: whiteWins ? 10000 : -10000,
            mate: whiteWins ? 1 : -1,
            bestMove: null,
            secondBestCpGap: 0,
            depth,
          };
        }
        return { cp: 0, mate: null, bestMove: null, secondBestCpGap: 0, depth };
      }

      const ready = await this.ensureWorker();
      if (!ready) {
        const fb = fallbackEvaluate(fen, 2);
        return { ...fb, secondBestCpGap: 0 };
      }

      const { bestMove, candidates } = await this.runUciSearch(fen, {
        depth,
        multiPv,
        limitElo: null,
      });

      const top = candidates[0];
      const second = candidates[1];
      const gap = top && second ? Math.abs(top.cp - second.cp) : 0;

      return {
        cp: top?.cp ?? 0,
        mate: top?.mate ?? null,
        bestMove: bestMove || top?.move || null,
        pv: top?.pv,
        depth,
        secondBestCpGap: gap,
      };
    });
  }

  /**
   * Generates a calibrated AI bot move for any ELO from 100 to 3200.
   */
  public getBotMove(fen: string, elo: number): Promise<string | null> {
    return this.enqueue(async () => {
      const chess = new Chess(fen);
      const legalMoves = chess.moves({ verbose: true });
      if (legalMoves.length === 0) return null;

      const tier = getEloTier(elo);
      const ready = await this.ensureWorker();

      // Below 1320 ELO: calibrate realistic human-like beginner/intermediate mistakes
      if (elo < 1320) {
        if (!ready) {
          if (Math.random() < tier.noiseRate) {
            const rnd = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            return `${rnd.from}${rnd.to}${rnd.promotion || ''}`;
          }
          return fallbackEvaluate(fen, Math.min(2, tier.depth)).bestMove;
        }

        const { bestMove, candidates } = await this.runUciSearch(fen, {
          depth: Math.max(2, tier.depth),
          multiPv: tier.multiPv,
          limitElo: null,
        });

        if (elo <= 250 && Math.random() < 0.65) {
          const rnd = legalMoves[Math.floor(Math.random() * legalMoves.length)];
          return `${rnd.from}${rnd.to}${rnd.promotion || ''}`;
        }

        if (candidates.length > 1 && Math.random() < tier.noiseRate) {
          const pool = candidates.slice(1);
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick?.move) return pick.move;
        }
        return bestMove || candidates[0]?.move || `${legalMoves[0].from}${legalMoves[0].to}`;
      }

      // 1320 - 3200 ELO: native UCI_LimitStrength or full strength at 3200
      if (!ready) {
        return fallbackEvaluate(fen, 3).bestMove;
      }

      const { bestMove, candidates } = await this.runUciSearch(fen, {
        depth: elo >= 2800 ? tier.depth : undefined,
        moveTimeMs: tier.moveTimeMs,
        multiPv: 1,
        limitElo: elo >= 3150 ? null : elo,
      });

      return bestMove || candidates[0]?.move || `${legalMoves[0].from}${legalMoves[0].to}`;
    });
  }

  /**
   * Analyzes an entire game ply-by-ply for the Chess.com-style Game Review screen.
   */
  public async analyzeFullGame(
    moves: MoveRecord[],
    onProgress?: (pct: number) => void
  ): Promise<{
    analyzedMoves: MoveRecord[];
    whiteAccuracy: number;
    blackAccuracy: number;
  }> {
    if (moves.length === 0) {
      return { analyzedMoves: [], whiteAccuracy: 100, blackAccuracy: 100 };
    }

    const evals: Array<EngineEval & { secondBestCpGap: number }> = [];
    const totalSteps = moves.length + 1;

    // Initial position eval
    evals.push(await this.evaluatePosition(moves[0].fenBefore, 8, 2));
    onProgress?.(Math.round((1 / totalSteps) * 100));

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      // Evaluate resulting position (MultiPV=2 so we know next best move & gap)
      const ev = await this.evaluatePosition(m.fenAfter, 8, 2);
      evals.push(ev);
      onProgress?.(Math.round(((i + 2) / totalSteps) * 100));
    }

    const sanHistory: string[] = [];
    const analyzedMoves: MoveRecord[] = [];
    const whiteLosses: number[] = [];
    const blackLosses: number[] = [];

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      sanHistory.push(m.san);
      const opening = lookupOpening(sanHistory);
      const evalBefore = evals[i];
      const evalAfter = evals[i + 1];

      // Convert bestMove UCI into readable SAN
      let bestMoveSan: string | null = null;
      if (evalBefore.bestMove) {
        try {
          const temp = new Chess(m.fenBefore);
          const uci = evalBefore.bestMove;
          const mv = temp.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined,
          });
          if (mv) bestMoveSan = mv.san;
        } catch {
          bestMoveSan = evalBefore.bestMove;
        }
      }

      const classified = classifyMove({
        color: m.color,
        playedUci: m.uci,
        evalBefore,
        evalAfter,
        isBookMove: opening.isBook,
        secondBestCpGap: evalBefore.secondBestCpGap,
      });

      if (m.color === 'w') whiteLosses.push(classified.winProbLoss);
      else blackLosses.push(classified.winProbLoss);

      analyzedMoves.push({
        ...m,
        evalAfter,
        bestMoveBefore: evalBefore.bestMove,
        bestMoveSan,
        classification: classified.classification,
        winProbLoss: classified.winProbLoss,
        openingName: opening.name !== 'Serbest Açılış' ? opening.name : m.openingName,
        comment: classified.comment,
      });
    }

    return {
      analyzedMoves,
      whiteAccuracy: computeAccuracy(whiteLosses),
      blackAccuracy: computeAccuracy(blackLosses),
    };
  }
}

export const aiEngine = new LocalChessAIService();
