import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { registerSocketHandlers } from './handlers';

/**
 * Socket.IO server initialization (D-006, D-014).
 *
 * Attaches to the same HTTP server as Express. Authentication happens on
 * the handshake: the client sends `auth: { token }`, the token is
 * verified, the user is loaded (soft-delete checked) and attached to
 * `socket.data.user`. On every connection the user's conversation rooms
 * are joined and the chat/typing/read handlers are registered (Phase 7).
 */
export function initSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: false }, // same-origin via Nginx (D-006)
    pingInterval: 25_000,
    pingTimeout: 20_000, // heartbeat per D-014
  });

  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length === 0) {
        return next(new Error('Authentication required'));
      }
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
      const userId = Number(payload.sub);
      if (!Number.isInteger(userId) || userId <= 0) {
        return next(new Error('Invalid token'));
      }
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, role: true, segment: true, deleted_at: true },
      });
      if (!user || user.deleted_at) {
        return next(new Error('Invalid user'));
      }
      socket.data.user = { id: user.id, role: user.role, segment: user.segment };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  registerSocketHandlers(io);

  return io;
}