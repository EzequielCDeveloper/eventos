import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { AuthUser } from '../types/api';
import { prisma } from '../config/database';
import * as messageService from '../services/message.service';
import { sendPushFallback } from '../services/notification.service';

/**
 * Socket.IO event handlers (D-006, UR-009.1).
 *
 * - `join-conversation` / `leave-conversation`: join/leave the room
 *   `conv:{id}`; membership is verified against the conversation rows.
 * - `message`: persist to the DB FIRST (write-confirm), then broadcast to
 *   the room; if the recipient has no socket in the room, the D-006
 *   offline fallback fires a raw push notification.
 * - `message:read`: mark incoming messages read and notify the room.
 * - `typing:start` / `typing:stop`: presence broadcast to the room.
 *
 * Room names follow `conv:{conversationId}` (D-006). Errors are delivered
 * to the emitting socket as `error` events with a human message — never
 * thrown (uncaught exceptions would crash the connection handler).
 */

function roomName(conversationId: number): string {
  return `conv:${conversationId}`;
}

/** Attach the user id from the handshake auth middleware (socket/index.ts). */
function socketUser(socket: Socket): AuthUser {
  return socket.data.user as AuthUser;
}

/** Verify the user participates in the conversation; respond on failure. */
async function requireMembership(
  socket: Socket,
  conversationId: number,
): Promise<{ id: number; client_id: number; provider_id: number; service_id: number | null } | null> {
  const user = socketUser(socket);
  const conversation = await prisma.conversations.findUnique({
    where: { id: conversationId },
    select: { id: true, client_id: true, provider_id: true, service_id: true },
  });
  if (!conversation) {
    socket.emit('error', { message: 'Conversation not found' });
    return null;
  }
  if (conversation.client_id !== user.id && conversation.provider_id !== user.id) {
    socket.emit('error', { message: 'You are not a participant of this conversation' });
    return null;
  }
  return conversation;
}

/** True when the recipient has at least one connected socket inside the room. */
function recipientInRoom(io: SocketIOServer, conversationId: number, recipientId: number): boolean {
  const sockets = io.sockets.adapter.rooms.get(roomName(conversationId));
  if (!sockets) return false;
  for (const socketId of sockets) {
    const peer = io.sockets.sockets.get(socketId);
    if (peer?.data?.user?.id === recipientId) return true;
  }
  return false;
}

export function registerSocketHandlers(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    const user = socketUser(socket);

    // D-006: join the rooms for every conversation the user participates in.
    void (async () => {
      try {
        const conversations = await prisma.conversations.findMany({
          where: { OR: [{ client_id: user.id }, { provider_id: user.id }] },
          select: { id: true },
        });
        for (const conversation of conversations) {
          socket.join(roomName(conversation.id));
        }
        socket.emit('conversations:joined', {
          conversationIds: conversations.map((c) => c.id),
        });
      } catch (error) {
        socket.emit('error', {
          message: 'Failed to load your conversations',
          error: error instanceof Error ? error.message : 'unknown',
        });
      }
    })();

    socket.on('join-conversation', async (payload: unknown) => {
      const conversationId = Number((payload as { conversationId?: unknown })?.conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        socket.emit('error', { message: 'A valid conversationId is required' });
        return;
      }
      const conversation = await requireMembership(socket, conversationId);
      if (!conversation) return;
      socket.join(roomName(conversation.id));
      socket.emit('conversation:joined', { conversationId: conversation.id });
    });

    socket.on('leave-conversation', (payload: unknown) => {
      const conversationId = Number((payload as { conversationId?: unknown })?.conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        socket.emit('error', { message: 'A valid conversationId is required' });
        return;
      }
      socket.leave(roomName(conversationId));
      socket.emit('conversation:left', { conversationId });
    });

    // message { conversationId, type: 'texto'|'nota_voz', content?, audioUrl?, durationSeconds? }
    socket.on('message', async (payload: unknown) => {
      const body = (payload ?? {}) as Record<string, unknown>;
      const conversationId = Number(body.conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        socket.emit('error', { message: 'A valid conversationId is required' });
        return;
      }
      const type = body.type === 'nota_voz' ? 'nota_voz' : 'texto';
      const conversation = await requireMembership(socket, conversationId);
      if (!conversation) return;

      try {
        const message = await messageService.sendMessage({
          conversationId,
          sender: user,
          type,
          content: typeof body.content === 'string' ? body.content : null,
          audioUrl: typeof body.audioUrl === 'string' ? body.audioUrl : null,
          durationSeconds:
            body.durationSeconds === undefined || body.durationSeconds === null
              ? null
              : Number(body.durationSeconds),
        });

        // Persist-before-broadcast (D-006): the DB write above confirmed.
        const room = roomName(conversationId);
        io.to(room).emit('message:new', message);
        socket.emit('message:sent', { id: message.id, message });

        // Offline delivery (D-006): push the recipient when they are not
        // reachable inside the room (no socket joined it).
        const recipientId =
          user.id === conversation.client_id ? conversation.provider_id : conversation.client_id;
        if (!recipientInRoom(io, conversationId, recipientId)) {
          await sendPushFallback(recipientId, {
            title: 'Nuevo mensaje',
            body:
              message.type === 'texto' && message.content
                ? message.content.slice(0, 120)
                : 'Nota de voz (max 120s)',
            data: { conversation_id: String(conversationId) },
          });
        }
      } catch (error) {
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Failed to persist message',
        });
      }
    });

    // message:read { conversationId }
    socket.on('message:read', async (payload: unknown) => {
      const conversationId = Number((payload as { conversationId?: unknown })?.conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        socket.emit('error', { message: 'A valid conversationId is required' });
        return;
      }
      const conversation = await requireMembership(socket, conversationId);
      if (!conversation) return;
      try {
        const result = await messageService.markConversationRead(conversationId, user);
        io.to(roomName(conversationId)).emit('message:read', {
          conversationId,
          readerId: user.id,
          read_at: new Date().toISOString(),
          updated: result.updated,
        });
      } catch (error) {
        socket.emit('error', {
          message: error instanceof Error ? error.message : 'Failed to mark read',
        });
      }
    });

    // typing:start / typing:stop { conversationId } — presence only (D-014).
    for (const event of ['typing:start', 'typing:stop'] as const) {
      socket.on(event, async (payload: unknown) => {
        const conversationId = Number((payload as { conversationId?: unknown })?.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) {
          socket.emit('error', { message: 'A valid conversationId is required' });
          return;
        }
        const conversation = await requireMembership(socket, conversationId);
        if (!conversation) return;
        socket.to(roomName(conversationId)).emit('typing', {
          conversationId,
          userId: user.id,
          isTyping: event === 'typing:start',
        });
      });
    }
  });
}