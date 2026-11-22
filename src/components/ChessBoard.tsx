import React, { useMemo, useRef, useState } from 'react';
import { Chess, Color, PieceSymbol, Square } from 'chess.js';
import { CLASSIFICATION_META } from '../chess/classification';
import { BOARD_THEMES } from '../chess/constants';
import { BoardThemeId, MoveClassification } from '../chess/types';
import { ChessPiece } from './ChessPiece';

interface ChessBoardProps {
  fen: string;
  orientation: Color;
  themeId: BoardThemeId;
  interactive: boolean;
  allowedColor?: Color | 'both';
  lastMove?: { from: string; to: string } | null;
  bestMoveArrow?: string | null;
  threatArrow?: string | null;
  moveBadge?: { square: string; classification: MoveClassification } | null;
  autoQueen?: boolean;
  onMove: (from: string, to: string, promotion?: string) => boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function squareToCoords(sq: string, orientation: Color): { x: number; y: number } {
  const fileIdx = FILES.indexOf(sq[0]);
  const rankIdx = RANKS.indexOf(sq[1]);
  if (orientation === 'w') {
    return { x: fileIdx + 0.5, y: rankIdx + 0.5 };
  }
  return { x: 7 - fileIdx + 0.5, y: 7 - rankIdx + 0.5 };
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  fen,
  orientation,
  themeId,
  interactive,
  allowedColor = 'both',
  lastMove,
  bestMoveArrow,
  threatArrow,
  moveBadge,
  autoQueen = false,
  onMove,
}) => {
  const theme = BOARD_THEMES[themeId] || BOARD_THEMES['classic-green'];
  const boardRef = useRef<HTMLDivElement | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: Color } | null>(null);
  const [dragState, setDragState] = useState<{
    from: Square;
    piece: { type: PieceSymbol; color: Color };
    x: number;
    y: number;
  } | null>(null);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<string, boolean>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    const map = new Map<string, boolean>();
    for (const m of moves) {
      map.set(m.to, !!m.captured);
    }
    return map;
  }, [chess, selectedSquare]);

  const kingInCheckSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.type === 'k' && p.color === turn) {
          return `${FILES[c]}${RANKS[r]}`;
        }
      }
    }
    return null;
  }, [chess]);

  const displayFiles = orientation === 'w' ? FILES : [...FILES].reverse();
  const displayRanks = orientation === 'w' ? RANKS : [...RANKS].reverse();

  const canControlPiece = (pieceColor: Color) => {
    if (!interactive) return false;
    if (chess.turn() !== pieceColor) return false;
    if (allowedColor === 'both') return true;
    return allowedColor === pieceColor;
  };

  const attemptMove = (from: Square, to: Square) => {
    const piece = chess.get(from);
    if (!piece) return false;

    const moves = chess.moves({ square: from, verbose: true });
    const matching = moves.filter((m) => m.to === to);
    if (matching.length === 0) return false;

    const isPromotion = matching.some((m) => !!m.promotion);
    if (isPromotion && !autoQueen) {
      setPendingPromotion({ from, to, color: piece.color });
      setSelectedSquare(null);
      return true;
    }

    const ok = onMove(from, to, isPromotion ? 'q' : undefined);
    if (ok) {
      setSelectedSquare(null);
    }
    return ok;
  };

  const handleSquareClick = (sq: Square) => {
    if (!interactive) return;
    const pieceOnSq = chess.get(sq);

    if (selectedSquare) {
      if (selectedSquare === sq) {
        setSelectedSquare(null);
        return;
      }
      if (legalTargets.has(sq)) {
        attemptMove(selectedSquare, sq);
        return;
      }
      if (pieceOnSq && canControlPiece(pieceOnSq.color)) {
        setSelectedSquare(sq);
        return;
      }
      setSelectedSquare(null);
      return;
    }

    if (pieceOnSq && canControlPiece(pieceOnSq.color)) {
      setSelectedSquare(sq);
    }
  };

  const getSquareFromClientPoint = (clientX: number, clientY: number): Square | null => {
    const el = boardRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;
    const colIdx = Math.min(7, Math.max(0, Math.floor((relX / rect.width) * 8)));
    const rowIdx = Math.min(7, Math.max(0, Math.floor((relY / rect.height) * 8)));
    return `${displayFiles[colIdx]}${displayRanks[rowIdx]}` as Square;
  };

  const handlePointerDown = (e: React.PointerEvent, sq: Square) => {
    if (!interactive || e.button !== 0) return;
    const piece = chess.get(sq);
    if (!piece || !canControlPiece(piece.color)) return;

    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setSelectedSquare(sq);
    setDragState({
      from: sq,
      piece: { type: piece.type, color: piece.color },
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    setDragState((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;
    const targetSq = getSquareFromClientPoint(e.clientX, e.clientY);
    if (targetSq && targetSq !== dragState.from) {
      attemptMove(dragState.from, targetSq);
    }
    setDragState(null);
  };

  const renderArrow = (uci: string | null | undefined, color: string, markerId: string) => {
    if (!uci || uci.length < 4) return null;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    if (!FILES.includes(from[0]) || !RANKS.includes(from[1]) || !FILES.includes(to[0]) || !RANKS.includes(to[1])) {
      return null;
    }
    const p1 = squareToCoords(from, orientation);
    const p2 = squareToCoords(to, orientation);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return null;
    const endX = p2.x - (dx / len) * 0.22;
    const endY = p2.y - (dy / len) * 0.22;

    return (
      <g key={markerId}>
        <defs>
          <marker id={markerId} markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <path d="M0,0.5 L3.2,2 L0,3.5 Z" fill={color} />
          </marker>
        </defs>
        <line
          x1={p1.x}
          y1={p1.y}
          x2={endX}
          y2={endY}
          stroke={color}
          strokeWidth="0.16"
          strokeLinecap="round"
          opacity="0.88"
          markerEnd={`url(#${markerId})`}
        />
      </g>
    );
  };

  return (
    <div
      ref={boardRef}
      data-testid="chessboard"
      className="relative aspect-square w-full select-none overflow-hidden rounded-lg shadow-lg ring-1 ring-black/15 dark:ring-white/10 touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setDragState(null)}
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {displayRanks.map((rank, rIdx) =>
          displayFiles.map((file, fIdx) => {
            const sq = `${file}${rank}` as Square;
            const fileOriginalIdx = FILES.indexOf(file);
            const rankOriginalIdx = RANKS.indexOf(rank);
            const isLightSquare = (fileOriginalIdx + rankOriginalIdx) % 2 === 0;
            const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isSelected = selectedSquare === sq;
            const isLegal = legalTargets.has(sq);
            const isCapture = legalTargets.get(sq) === true;
            const isCheck = kingInCheckSquare === sq;
            const piece = chess.get(sq);
            const isBeingDragged = dragState?.from === sq;

            let bgColor = isLightSquare ? theme.light : theme.dark;
            if (isSelected || isLastMove) {
              bgColor = isLightSquare ? theme.highlightLight : theme.highlightDark;
            }

            const badgeMeta =
              moveBadge && moveBadge.square === sq
                ? CLASSIFICATION_META[moveBadge.classification]
                : null;

            return (
              <button
                key={sq}
                type="button"
                data-square={sq}
                aria-label={`Kare ${sq}${piece ? ` (${piece.color === 'w' ? 'Beyaz' : 'Siyah'} ${piece.type})` : ''}`}
                onClick={() => handleSquareClick(sq)}
                onPointerDown={(e) => handlePointerDown(e, sq)}
                style={{ backgroundColor: bgColor }}
                className="relative flex items-center justify-center p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
              >
                {isCheck && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(239,68,68,0.85) 0%, rgba(220,38,38,0.45) 55%, transparent 80%)',
                    }}
                  />
                )}

                {/* Rank coordinate on leftmost file */}
                {fIdx === 0 && (
                  <span
                    className="pointer-events-none absolute left-1 top-0.5 text-[10px] font-bold leading-none sm:text-[11px]"
                    style={{ color: isLightSquare ? theme.coordLight : theme.coordDark }}
                  >
                    {rank}
                  </span>
                )}

                {/* File coordinate on bottom rank */}
                {rIdx === 7 && (
                  <span
                    className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] font-bold leading-none sm:text-[11px]"
                    style={{ color: isLightSquare ? theme.coordLight : theme.coordDark }}
                  >
                    {file}
                  </span>
                )}

                {/* Piece */}
                {piece && !isBeingDragged && (
                  <div className="relative z-10 h-[86%] w-[86%] transition-transform duration-100">
                    <ChessPiece type={piece.type} color={piece.color} />
                  </div>
                )}

                {/* Legal move dot / capture ring */}
                {isLegal && !isCapture && (
                  <span className="pointer-events-none z-20 h-[30%] w-[30%] rounded-full bg-black/22" />
                )}
                {isLegal && isCapture && (
                  <span className="pointer-events-none absolute inset-[6%] z-20 rounded-full border-[5px] border-black/22" />
                )}

                {/* Classification badge icon on destination square */}
                {badgeMeta && (
                  <div
                    title={badgeMeta.label}
                    className="pointer-events-none absolute -right-0.5 -top-0.5 z-30 h-5 w-5 rounded-full bg-white/95 p-0.5 shadow-md sm:h-6 sm:w-6"
                  >
                    <img
                      src={badgeMeta.iconPath}
                      alt={badgeMeta.label}
                      className="h-full w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* SVG Arrow Layer (Best Move / Threat) */}
      <svg
        viewBox="0 0 8 8"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      >
        {renderArrow(threatArrow, '#E11D48', 'arrow-threat')}
        {renderArrow(bestMoveArrow, '#22C55E', 'arrow-best')}
      </svg>

      {/* Dragged floating piece */}
      {dragState && (
        <div
          className="pointer-events-none fixed z-50 h-14 w-14 -translate-x-1/2 -translate-y-1/2 sm:h-16 sm:w-16"
          style={{ left: dragState.x, top: dragState.y }}
        >
          <ChessPiece type={dragState.piece.type} color={dragState.piece.color} />
        </div>
      )}

      {/* Pawn Promotion Picker Modal */}
      {pendingPromotion && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div className="rounded-xl bg-[#312E2B] p-3 shadow-2xl ring-1 ring-white/15">
            <p className="mb-2 text-center text-xs font-semibold text-stone-200">Terfi Taşı Seç</p>
            <div className="flex items-center gap-2">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((pType) => (
                <button
                  key={pType}
                  type="button"
                  aria-label={`Terfi: ${pType}`}
                  onClick={() => {
                    onMove(pendingPromotion.from, pendingPromotion.to, pType);
                    setPendingPromotion(null);
                  }}
                  className="h-12 w-12 rounded-lg bg-[#262421] p-1.5 transition hover:bg-[#81B64C]/30"
                >
                  <ChessPiece type={pType} color={pendingPromotion.color} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
