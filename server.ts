import http from 'http';
import path from 'path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Chess } from 'chess.js';
import { createServer as createViteServer } from 'vite';

interface RoomPlayer {
  ws: WebSocket;
  name: string;
  color: 'w' | 'b';
}

interface OnlineRoom {
  code: string;
  chess: Chess;
  hostName: string;
  timeControlLabel: string;
  initialSeconds: number;
  incrementSeconds: number;
  whiteTime: number;
  blackTime: number;
  lastMoveAt: number | null;
  players: RoomPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  result?: '1-0' | '0-1' | '1/2-1/2';
  resultReason?: string;
  drawOfferBy?: 'w' | 'b' | null;
  moves: Array<{
    ply: number;
    moveNumber: number;
    color: 'w' | 'b';
    san: string;
    uci: string;
    from: string;
    to: string;
    fenBefore: string;
    fenAfter: string;
    captured?: string;
    promotion?: string;
  }>;
}

const rooms = new Map<string, OnlineRoom>();
const clientRoomMap = new Map<WebSocket, string>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getEffectiveClocks(room: OnlineRoom): { w: number; b: number } {
  let w = room.whiteTime;
  let b = room.blackTime;
  if (room.status === 'playing' && room.initialSeconds > 0 && room.lastMoveAt !== null) {
    const elapsedSec = Math.floor((Date.now() - room.lastMoveAt) / 1000);
    if (room.chess.turn() === 'w') {
      w = Math.max(0, w - elapsedSec);
    } else {
      b = Math.max(0, b - elapsedSec);
    }
  }
  return { w, b };
}

function broadcastRoomState(room: OnlineRoom) {
  const clocks = getEffectiveClocks(room);
  const whitePlayer = room.players.find((p) => p.color === 'w');
  const blackPlayer = room.players.find((p) => p.color === 'b');
  const payload = {
    type: 'room_state',
    room: {
      code: room.code,
      status: room.status,
      fen: room.chess.fen(),
      turn: room.chess.turn(),
      whiteName: whitePlayer?.name || 'Beyaz Bekleniyor...',
      blackName: blackPlayer?.name || 'Siyah Bekleniyor...',
      timeControlLabel: room.timeControlLabel,
      initialSeconds: room.initialSeconds,
      incrementSeconds: room.incrementSeconds,
      whiteTime: clocks.w,
      blackTime: clocks.b,
      result: room.result,
      resultReason: room.resultReason,
      drawOfferBy: room.drawOfferBy || null,
      moves: room.moves,
    },
  };
  const serialized = JSON.stringify(payload);
  for (const player of room.players) {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(serialized);
    }
  }
}

function listOpenRooms() {
  const open: Array<{
    code: string;
    hostName: string;
    timeControlLabel: string;
    playersCount: number;
  }> = [];
  for (const room of rooms.values()) {
    if (room.status === 'waiting' && room.players.length === 1) {
      open.push({
        code: room.code,
        hostName: room.hostName,
        timeControlLabel: room.timeControlLabel,
        playersCount: room.players.length,
      });
    }
  }
  return open;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: listOpenRooms() });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Periodic timeout check for active timed games
  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.status === 'playing' && room.initialSeconds > 0) {
        const clocks = getEffectiveClocks(room);
        if (clocks.w <= 0) {
          room.status = 'finished';
          room.whiteTime = 0;
          room.result = '0-1';
          room.resultReason = 'Süre Bitti';
          broadcastRoomState(room);
        } else if (clocks.b <= 0) {
          room.status = 'finished';
          room.blackTime = 0;
          room.result = '1-0';
          room.resultReason = 'Süre Bitti';
          broadcastRoomState(room);
        }
      }
    }
  }, 1000);

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'rooms_list', rooms: listOpenRooms() }));

    ws.on('message', (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'list_rooms') {
        ws.send(JSON.stringify({ type: 'rooms_list', rooms: listOpenRooms() }));
        return;
      }

      if (type === 'create_room') {
        const prevCode = clientRoomMap.get(ws);
        if (prevCode) {
          const prevRoom = rooms.get(prevCode);
          if (prevRoom) {
            prevRoom.players = prevRoom.players.filter((p) => p.ws !== ws);
            if (prevRoom.players.length === 0) rooms.delete(prevCode);
          }
        }

        const playerName = String(msg.playerName || 'Oyuncu').slice(0, 24);
        const timeControlLabel = String(msg.timeControlLabel || '10 dk (Hızlı)');
        const initialSeconds = Math.max(0, Number(msg.initialSeconds ?? 600));
        const incrementSeconds = Math.max(0, Number(msg.incrementSeconds ?? 0));
        const preferredColor = msg.color === 'b' ? 'b' : 'w';

        const code = generateRoomCode();
        const room: OnlineRoom = {
          code,
          chess: new Chess(),
          hostName: playerName,
          timeControlLabel,
          initialSeconds,
          incrementSeconds,
          whiteTime: initialSeconds,
          blackTime: initialSeconds,
          lastMoveAt: null,
          players: [{ ws, name: playerName, color: preferredColor }],
          status: 'waiting',
          moves: [],
        };
        rooms.set(code, room);
        clientRoomMap.set(ws, code);

        ws.send(JSON.stringify({ type: 'joined_room', code, assignedColor: preferredColor }));
        broadcastRoomState(room);
        return;
      }

      if (type === 'join_room' || type === 'quick_match') {
        let targetRoom: OnlineRoom | undefined;

        if (type === 'quick_match') {
          for (const candidate of rooms.values()) {
            if (candidate.status === 'waiting' && candidate.players.length === 1) {
              targetRoom = candidate;
              break;
            }
          }
          if (!targetRoom) {
            // Auto-create a waiting room
            const playerName = String(msg.playerName || 'Oyuncu').slice(0, 24);
            const code = generateRoomCode();
            targetRoom = {
              code,
              chess: new Chess(),
              hostName: playerName,
              timeControlLabel: String(msg.timeControlLabel || '10 dk (Hızlı)'),
              initialSeconds: Math.max(0, Number(msg.initialSeconds ?? 600)),
              incrementSeconds: Math.max(0, Number(msg.incrementSeconds ?? 0)),
              whiteTime: Math.max(0, Number(msg.initialSeconds ?? 600)),
              blackTime: Math.max(0, Number(msg.initialSeconds ?? 600)),
              lastMoveAt: null,
              players: [{ ws, name: playerName, color: 'w' }],
              status: 'waiting',
              moves: [],
            };
            rooms.set(code, targetRoom);
            clientRoomMap.set(ws, code);
            ws.send(JSON.stringify({ type: 'joined_room', code, assignedColor: 'w' }));
            broadcastRoomState(targetRoom);
            return;
          }
        } else {
          const code = String(msg.code || '').trim().toUpperCase();
          targetRoom = rooms.get(code);
        }

        if (!targetRoom) {
          ws.send(JSON.stringify({ type: 'error_msg', message: 'Oda bulunamadı. Oda kodunu kontrol edin.' }));
          return;
        }
        if (targetRoom.players.length >= 2) {
          ws.send(JSON.stringify({ type: 'error_msg', message: 'Bu oda dolu.' }));
          return;
        }

        const existingColor = targetRoom.players[0].color;
        const assignedColor: 'w' | 'b' = existingColor === 'w' ? 'b' : 'w';
        const playerName = String(msg.playerName || 'Rakip').slice(0, 24);

        targetRoom.players.push({ ws, name: playerName, color: assignedColor });
        targetRoom.status = 'playing';
        targetRoom.lastMoveAt = Date.now();
        clientRoomMap.set(ws, targetRoom.code);

        ws.send(JSON.stringify({ type: 'joined_room', code: targetRoom.code, assignedColor }));
        broadcastRoomState(targetRoom);
        return;
      }

      const code = clientRoomMap.get(ws);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      const player = room.players.find((p) => p.ws === ws);
      if (!player) return;

      if (type === 'make_move') {
        if (room.status !== 'playing') return;
        if (room.chess.turn() !== player.color) {
          ws.send(JSON.stringify({ type: 'error_msg', message: 'Sıra sizde değil.' }));
          return;
        }

        const from = String(msg.from || '');
        const to = String(msg.to || '');
        const promotion = msg.promotion ? String(msg.promotion) : undefined;
        const fenBefore = room.chess.fen();

        try {
          const clocks = getEffectiveClocks(room);
          const move = room.chess.move({ from, to, promotion });
          if (!move) return;

          if (room.initialSeconds > 0) {
            if (player.color === 'w') {
              room.whiteTime = clocks.w + room.incrementSeconds;
              room.blackTime = clocks.b;
            } else {
              room.blackTime = clocks.b + room.incrementSeconds;
              room.whiteTime = clocks.w;
            }
            room.lastMoveAt = Date.now();
          }

          room.drawOfferBy = null;
          room.moves.push({
            ply: room.moves.length + 1,
            moveNumber: Math.floor(room.moves.length / 2) + 1,
            color: move.color,
            san: move.san,
            uci: `${move.from}${move.to}${move.promotion || ''}`,
            from: move.from,
            to: move.to,
            fenBefore,
            fenAfter: room.chess.fen(),
            captured: move.captured,
            promotion: move.promotion,
          });

          if (room.chess.isGameOver()) {
            room.status = 'finished';
            if (room.chess.isCheckmate()) {
              room.result = move.color === 'w' ? '1-0' : '0-1';
              room.resultReason = 'Şah Mat';
            } else if (room.chess.isStalemate()) {
              room.result = '1/2-1/2';
              room.resultReason = 'Pat';
            } else {
              room.result = '1/2-1/2';
              room.resultReason = 'Beraberlik';
            }
          }

          broadcastRoomState(room);
        } catch {
          ws.send(JSON.stringify({ type: 'error_msg', message: 'Geçersiz hamle.' }));
        }
        return;
      }

      if (type === 'resign' && room.status === 'playing') {
        room.status = 'finished';
        room.result = player.color === 'w' ? '0-1' : '1-0';
        room.resultReason = 'Terk';
        broadcastRoomState(room);
        return;
      }

      if (type === 'offer_draw' && room.status === 'playing') {
        room.drawOfferBy = player.color;
        broadcastRoomState(room);
        return;
      }

      if (type === 'accept_draw' && room.status === 'playing' && room.drawOfferBy && room.drawOfferBy !== player.color) {
        room.status = 'finished';
        room.result = '1/2-1/2';
        room.resultReason = 'Anlaşmalı Berabere';
        room.drawOfferBy = null;
        broadcastRoomState(room);
        return;
      }

      if (type === 'decline_draw' && room.status === 'playing') {
        room.drawOfferBy = null;
        broadcastRoomState(room);
      }
    });

    ws.on('close', () => {
      const code = clientRoomMap.get(ws);
      clientRoomMap.delete(ws);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) return;
      const leaving = room.players.find((p) => p.ws === ws);
      room.players = room.players.filter((p) => p.ws !== ws);
      if (room.players.length === 0) {
        rooms.delete(code);
      } else if (room.status === 'playing' && leaving) {
        room.status = 'finished';
        room.result = leaving.color === 'w' ? '0-1' : '1-0';
        room.resultReason = 'Bağlantı Koptu';
        broadcastRoomState(room);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
