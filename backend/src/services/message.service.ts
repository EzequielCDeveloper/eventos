import type { messages_type } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError, type AuthUser, buildPaginationMeta, parsePagination } from '../types/api';
import { toISOStringOrNull } from '../utils/datetime';

/**
 * Messaging service (BR-008, D-006, UR-009.1/UR-009.4, UR-002.10).
 *
 * - Persists every text message and voice note with sender/timestamp and
 *   `read_at = NULL` until the recipient reads the thread (BR-008.1).
 * - Voice notes carry `audio_url` + `duration_seconds`; duration is capped
 *   at 120 seconds (BR-008.2, UR-009.4) — the DB enforces the same via the
 *   `chk_messages_voice_note_duration` CHECK constraint and the service
 *   enforces it up front with a clear 400.
 * - Conversations are UNIQUE on (client_id, provider_id, service_id)
 *   (BR-008.3, enforced by `uk_conversations_thread`).
 * - Quick replies for providers (BR-008.4) and message search (BR-008.6).
 *
 * Membership rule: only the client or the provider of a conversation may
 * read/write it — every operation re-checks `req.user` against the
 * conversation participants (UR-009.1 authorization).
 */

export const MAX_VOICE_NOTE_SECONDS = 120; // BR-008.2 / UR-009.4

export interface SendMessageInput {
  conversationId: number;
  sender: AuthUser;
  type: messages_type;
  content?: string | null;
  audioUrl?: string | null;
  durationSeconds?: number | null;
}

export interface MessagePayload {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: messages_type;
  content: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  read_at: string | null;
  sender: { id: number; full_name: string; avatar_url: string | null; role: string };
}

interface ConversationRow {
  id: number;
  client_id: number;
  provider_id: number;
  service_id: number | null;
}

function toMessage(row: {
  id: number;
  conversation_id: number;
  sender_id: number;
  type: messages_type;
  content: string | null;
  audio_url: string | null;
  duration_seconds: number | null;
  created_at: Date;
  read_at: Date | null;
  users: { id: number; full_name: string; avatar_url: string | null; role: string };
}): MessagePayload {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    type: row.type,
    content: row.content,
    audio_url: row.audio_url,
    duration_seconds: row.duration_seconds,
    created_at: row.created_at.toISOString(),
    read_at: toISOStringOrNull(row.read_at),
    sender: {
      id: row.users.id,
      full_name: row.users.full_name,
      avatar_url: row.users.avatar_url,
      role: row.users.role,
    },
  };
}

/** Load the conversation and require `userId` to be a participant (403). */
async function assertParticipant(conversationId: number, userId: number): Promise<ConversationRow> {
  const conversation = await prisma.conversations.findUnique({
    where: { id: conversationId },
    select: { id: true, client_id: true, provider_id: true, service_id: true },
  });
  if (!conversation) {
    throw AppError.notFound('Conversation not found');
  }
  if (conversation.client_id !== userId && conversation.provider_id !== userId) {
    throw AppError.forbidden('You are not a participant of this conversation');
  }
  return conversation;
}

/**
 * Get (or create) the unique conversation thread for a client+provider
 * (optionally scoped to a service) (BR-008.3). Any of the two participants
 * may open the thread; dedupe via the composite unique key with a
 * find-then-create race guard.
 */
export async function getOrCreateConversation(input: {
  actor: AuthUser;
  clientId: number;
  providerId: number;
  serviceId?: number | null;
}): Promise<ConversationRow> {
  if (input.actor.id !== input.clientId && input.actor.id !== input.providerId) {
    throw AppError.forbidden('Only the client or the provider may open this conversation');
  }
  const where = {
    client_id: input.clientId,
    provider_id: input.providerId,
    service_id: input.serviceId ?? null,
  };
  const existing = await prisma.conversations.findFirst({ where });
  if (existing) return existing;

  try {
    return await prisma.conversations.create({ data: where });
  } catch (error) {
    // Concurrent creation race: another request won the insert.
    if ((error as { code?: string }).code === 'P2002') {
      const raced = await prisma.conversations.findFirst({ where });
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Persist a message and return it for broadcast (UR-009.1). Voice notes
 * require an audio URL and a duration within [1..120]s (BR-008.2).
 */
export async function sendMessage(input: SendMessageInput): Promise<MessagePayload> {
  const conversation = await assertParticipant(input.conversationId, input.sender.id);

  if (input.type === 'nota_voz') {
    const duration = input.durationSeconds;
    if (
      !Number.isInteger(duration) ||
      duration === null ||
      duration === undefined ||
      duration < 1 ||
      duration > MAX_VOICE_NOTE_SECONDS
    ) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: `Voice notes must be between 1 and ${MAX_VOICE_NOTE_SECONDS} seconds (BR-008.2)`,
        details: { max_seconds: MAX_VOICE_NOTE_SECONDS, received: duration },
      });
    }
    if (!input.audioUrl) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Voice notes require an audio_url',
      });
    }
  } else {
    const content = (input.content ?? '').trim();
    if (!content) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Text messages require non-empty content',
      });
    }
  }

  const row = await prisma.messages.create({
    data: {
      conversation_id: conversation.id,
      sender_id: input.sender.id,
      type: input.type,
      content:
        input.type === 'texto' ? (input.content ?? '').trim() : (input.content ?? null),
      audio_url: input.type === 'nota_voz' ? (input.audioUrl ?? null) : null,
      duration_seconds: input.type === 'nota_voz' ? (input.durationSeconds ?? null) : null,
    },
    include: {
      users: { select: { id: true, full_name: true, avatar_url: true, role: true } },
    },
  });
  return toMessage(row);
}

/** Mark all incoming messages of a conversation as read (read receipts). */
export async function markConversationRead(
  conversationId: number,
  user: AuthUser,
): Promise<{ updated: number }> {
  await assertParticipant(conversationId, user.id);
  const result = await prisma.messages.updateMany({
    where: { conversation_id: conversationId, sender_id: { not: user.id }, read_at: null },
    data: { read_at: new Date() },
  });
  return { updated: result.count };
}

export interface ConversationSummary {
  id: number;
  client_id: number;
  provider_id: number;
  service_id: number | null;
  other_participant: { id: number; full_name: string; avatar_url: string | null; role: string };
  last_message: MessagePayload | null;
  unread_count: number;
  created_at: string;
}

/** List the user's conversations with the other participant, last message
 *  and unread count (GET /conversations, UR-002.10). */
export async function listConversations(
  user: AuthUser,
  options: { page?: number; limit?: number } = {},
): Promise<{ items: ConversationSummary[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const pagination = parsePagination({ page: options.page, limit: options.limit });
  const where = { OR: [{ client_id: user.id }, { provider_id: user.id }] };
  const [rows, total] = await prisma.$transaction([
    prisma.conversations.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      include: {
        users_conversations_client_idTousers: {
          select: { id: true, full_name: true, avatar_url: true, role: true },
        },
        users_conversations_provider_idTousers: {
          select: { id: true, full_name: true, avatar_url: true, role: true },
        },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            users: { select: { id: true, full_name: true, avatar_url: true, role: true } },
          },
        },
      },
    }),
    prisma.conversations.count({ where }),
  ]);

  // Unread counts per conversation (incoming, not yet read).
  const conversationIds = rows.map((row) => row.id);
  const unreadRows = await prisma.messages.groupBy({
    by: ['conversation_id'],
    where: { conversation_id: { in: conversationIds }, sender_id: { not: user.id }, read_at: null },
    _count: { _all: true },
  });
  const unreadByConversation = new Map(
    unreadRows.map((row) => [row.conversation_id, row._count._all]),
  );

  const items = rows.map((row) => {
    const other =
      row.client_id === user.id
        ? row.users_conversations_provider_idTousers
        : row.users_conversations_client_idTousers;
    const last = row.messages[0] ?? null;
    return {
      id: row.id,
      client_id: row.client_id,
      provider_id: row.provider_id,
      service_id: row.service_id,
      other_participant: { id: other.id, full_name: other.full_name, avatar_url: other.avatar_url, role: other.role },
      last_message: last ? toMessage(last) : null,
      unread_count: unreadByConversation.get(row.id) ?? 0,
      created_at: row.created_at.toISOString(),
    };
  });

  return { items, meta: buildPaginationMeta(total, pagination) };
}

/** List messages of a conversation, optionally after a message id
 *  (GET /conversations/:id/messages?after=<id>, UR-002.10 / D-006). */
export async function listMessages(
  conversationId: number,
  user: AuthUser,
  options: { after?: number; page?: number; limit?: number } = {},
): Promise<{ items: MessagePayload[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  await assertParticipant(conversationId, user.id);
  const pagination = parsePagination({ page: options.page, limit: options.limit });
  const where = {
    conversation_id: conversationId,
    ...(options.after ? { id: { gt: options.after } } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.messages.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      include: { users: { select: { id: true, full_name: true, avatar_url: true, role: true } } },
    }),
    prisma.messages.count({ where }),
  ]);
  return { items: rows.map(toMessage), meta: buildPaginationMeta(total, pagination) };
}

/** Full-text search of messages inside the user's own conversations (BR-008.6). */
export async function searchMessages(
  user: AuthUser,
  options: { q: string; page?: number; limit?: number },
): Promise<{ items: MessagePayload[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const query = options.q.trim();
  if (!query) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'A search query is required',
    });
  }
  const pagination = parsePagination({ page: options.page, limit: options.limit });
  const conversations = await prisma.conversations.findMany({
    where: { OR: [{ client_id: user.id }, { provider_id: user.id }] },
    select: { id: true },
  });
  const conversationIds = conversations.map((c) => c.id);
  const where = {
    conversation_id: { in: conversationIds },
    type: 'texto' as const,
    content: { contains: query },
  };
  const [rows, total] = await prisma.$transaction([
    prisma.messages.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      include: { users: { select: { id: true, full_name: true, avatar_url: true, role: true } } },
    }),
    prisma.messages.count({ where }),
  ]);
  return { items: rows.map(toMessage), meta: buildPaginationMeta(total, pagination) };
}

// ---- Quick replies (BR-008.4) ----------------------------------------------

export interface QuickReplyPayload {
  id: number;
  provider_id: number;
  name: string;
  content: string;
}

function toQuickReply(row: {
  id: number;
  provider_id: number;
  name: string;
  content: string;
}): QuickReplyPayload {
  return { id: row.id, provider_id: row.provider_id, name: row.name, content: row.content };
}

export async function listQuickReplies(providerId: number): Promise<QuickReplyPayload[]> {
  const rows = await prisma.quick_replies.findMany({
    where: { provider_id: providerId },
    orderBy: { id: 'asc' },
  });
  return rows.map(toQuickReply);
}

export async function createQuickReply(
  providerId: number,
  input: { name: string; content: string },
): Promise<QuickReplyPayload> {
  const row = await prisma.quick_replies.create({
    data: { provider_id: providerId, name: input.name.trim(), content: input.content.trim() },
  });
  return toQuickReply(row);
}

export async function updateQuickReply(
  providerId: number,
  id: number,
  patch: { name?: string; content?: string },
): Promise<QuickReplyPayload> {
  const owned = await prisma.quick_replies.findFirst({ where: { id, provider_id: providerId } });
  if (!owned) throw AppError.notFound('Quick reply not found');
  const row = await prisma.quick_replies.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.content !== undefined ? { content: patch.content.trim() } : {}),
    },
  });
  return toQuickReply(row);
}

export async function deleteQuickReply(providerId: number, id: number): Promise<void> {
  const owned = await prisma.quick_replies.findFirst({ where: { id, provider_id: providerId } });
  if (!owned) throw AppError.notFound('Quick reply not found');
  await prisma.quick_replies.delete({ where: { id } });
}