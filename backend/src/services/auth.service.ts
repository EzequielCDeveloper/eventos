import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import type {
  arco_requests_tipo,
  identity_verifications_method,
  users_role,
  users_segment,
} from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../types/api';
import { addBusinessDays } from '../utils/datetime';
import { isTokenRevoked, revokeToken } from './tokenStore';

/**
 * Authentication service (BR-002, BR-002.7, UR-003).
 *
 * - register(): unique-email check, bcrypt hashing, account creation and
 *   token issuance; optional LFPDPPP privacy-consent capture (BR-012).
 * - login(): credential validation, soft-delete guard (BR-002.6) and token
 *   issuance.
 * - refresh(): verifies a refresh token, rotates it (revokes the old `jti`)
 *   and issues a new pair.
 * - logout(): revokes the refresh token so it cannot be reused.
 * - me / profile update / identity-verification placeholders for the user
 *   routes (UR-002.2). KYC/INE rows are created with result `pendiente`;
 *   the Verificamex integration executes them in S5 (8.1).
 *
 * Access tokens are stateless (7d); refresh tokens are rotated (30d) and
 * denylisted on use. JWT payload claims: `sub` (user id), `role`,
 * `segment`, and `typ` (`access` | `refresh`).
 */

export interface RegisterInput {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  role?: users_role;
  segment?: users_segment;
  accept_privacy_policy?: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ProfilePatch {
  full_name?: string;
  phone?: string;
  avatar_url?: string | null;
  notification_prefs?: Record<string, unknown> | null;
}

/** User projection safe for API responses — never exposes password_hash. */
export interface SafeUser {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: users_role;
  segment: users_segment;
  verified: boolean;
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: SafeUser;
  tokens: UserTokens;
}

interface AccessTokenPayload {
  sub: string;
  role: users_role;
  segment: users_segment;
  typ: 'access';
}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  typ: 'refresh';
}

const BCRYPT_ROUNDS = 10;

function toSafeUser(user: {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: users_role;
  segment: users_segment;
  verified: boolean;
}): SafeUser {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    avatar_url: user.avatar_url,
    role: user.role,
    segment: user.segment,
    verified: user.verified,
  };
}

function issueTokens(user: { id: number; role: users_role; segment: users_segment }): UserTokens {
  const signOptions: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  const accessToken = jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      segment: user.segment,
      typ: 'access',
    } satisfies AccessTokenPayload,
    env.JWT_SECRET,
    signOptions,
  );
  const refreshToken = jwt.sign(
    {
      sub: String(user.id),
      jti: randomUUID(),
      typ: 'refresh',
    } satisfies RefreshTokenPayload,
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] },
  );
  return { accessToken, refreshToken };
}

/** Epoch ms at which a signed token expires (for denylist TTL). */
function tokenExpiresAt(token: string): number {
  const payload = jwt.decode(token) as { exp?: number } | null;
  return payload?.exp ? payload.exp * 1000 : Date.now() + 60_000;
}

/**
 * Create an account and issue tokens (BR-002.7, UR-003.1–UR-003.3).
 * 409 when the email is already registered (BR-003 conflict).
 */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict('Email is already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await prisma.users.create({
      data: {
        full_name: input.full_name,
        email,
        phone: input.phone,
        role: input.role ?? 'usuario',
        segment: input.segment ?? 'particular',
        password_hash: passwordHash,
        verified: false,
      },
    });
  } catch (error) {
    // Unique-email race: two concurrent registrations with the same email.
    if ((error as { code?: string }).code === 'P2002') {
      throw AppError.conflict('Email is already registered');
    }
    throw error;
  }

  // LFPDPPP: capture explicit privacy consent at data collection (BR-012).
  if (input.accept_privacy_policy) {
    await prisma.users.update({
      where: { id: user.id },
      data: {
        privacy_consent_accepted_at: new Date(),
        privacy_policy_version: '1.0',
      },
    });
    await prisma.consent_logs.create({
      data: {
        user_id: user.id,
        consent_type: 'aviso_privacidad',
        accepted: true,
        privacy_policy_version: '1.0',
      },
    });
  }

  return { user: toSafeUser(user), tokens: issueTokens(user) };
}

/**
 * Validate credentials and issue tokens (BR-002, BR-002.6, UR-003).
 * Soft-deleted users are rejected with a generic 401 so the response does
 * not leak account state.
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }
  const passwordOk = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordOk) {
    throw AppError.unauthorized('Invalid email or password');
  }
  if (user.deleted_at) {
    throw AppError.unauthorized('Invalid email or password');
  }
  return { user: toSafeUser(user), tokens: issueTokens(user) };
}

/**
 * Rotate a refresh token (UR-003.4–UR-003.7): verifies type and expiry,
 * rejects revoked tokens, revokes the presented one and issues a new pair.
 */
export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET) as RefreshTokenPayload;
  } catch {
    throw AppError.unauthorized('Invalid refresh token');
  }
  if (payload.typ !== 'refresh' || !payload.jti) {
    throw AppError.unauthorized('Invalid refresh token');
  }
  if (isTokenRevoked(payload.jti)) {
    throw AppError.unauthorized('Refresh token has been revoked');
  }

  const userId = Number(payload.sub);
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user || user.deleted_at) {
    throw AppError.unauthorized('Account is inactive');
  }

  // Rotate: the presented refresh token is single-use from now on.
  revokeToken(payload.jti, tokenExpiresAt(refreshToken));

  return { user: toSafeUser(user), tokens: issueTokens(user) };
}

/** Revoke a refresh token on logout. Invalid tokens are ignored. */
export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = jwt.verify(refreshToken, env.JWT_SECRET) as RefreshTokenPayload;
    if (payload.jti && payload.typ === 'refresh') {
      revokeToken(payload.jti, tokenExpiresAt(refreshToken));
    }
  } catch {
    // Already invalid or expired — nothing to revoke.
  }
}

/** Current user profile (GET /auth/me, GET /users/me). */
export async function getMe(userId: number): Promise<SafeUser> {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user || user.deleted_at) {
    throw AppError.notFound('User not found');
  }
  return toSafeUser(user);
}

/** Update the current user's public profile (PUT /users/me). */
export async function updateProfile(userId: number, patch: ProfilePatch): Promise<SafeUser> {
  const user = await prisma.users.update({
    where: { id: userId },
    data: {
      ...(patch.full_name !== undefined ? { full_name: patch.full_name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.avatar_url !== undefined ? { avatar_url: patch.avatar_url } : {}),
      ...(patch.notification_prefs !== undefined
        ? {
            notification_prefs:
              patch.notification_prefs === null
                ? Prisma.JsonNull
                : (patch.notification_prefs as Prisma.InputJsonValue),
          }
        : {}),
      updated_at: new Date(),
    },
  });
  return toSafeUser(user);
}

/**
 * Record an identity-verification request (UR-002.2, BR-010).
 *
 * The row is created with result `pendiente` — the actual INE/KYC check
 * runs in a later slice (Verificamex, 8.1). Explicit consent of type
 * `verificacion_identidad` is REQUIRED first (BR-010.4): a 409 is returned
 * while no accepted consent_logs entry exists.
 */
export async function requestIdentityVerification(
  userId: number,
  method: Extract<identity_verifications_method, 'ine_presencial' | 'kyc'>,
): Promise<{ id: number; method: string; kyc_provider: string | null; result: string; created_at: Date }> {
  const consent = await prisma.consent_logs.findFirst({
    where: { user_id: userId, consent_type: 'verificacion_identidad', accepted: true },
  });
  if (!consent) {
    throw new AppError({
      statusCode: 409,
      code: 'CONFLICT',
      message:
        'Explicit identity-verification consent (consent_logs, tipo verificacion_identidad) is required before verification (BR-010.4)',
    });
  }
  const verification = await prisma.identity_verifications.create({
    data: {
      user_id: userId,
      method,
      kyc_provider: method === 'kyc' ? 'verificamex' : undefined,
      result: 'pendiente',
    },
  });
  return {
    id: verification.id,
    method: verification.method,
    kyc_provider: verification.kyc_provider ?? null,
    result: verification.result,
    created_at: verification.created_at,
  };
}

/** LFPDPPP ARCO response deadline: 20 business days from today (BR-012). */
const ARCO_DEADLINE_BUSINESS_DAYS = 20;

/**
 * Record an ARCO data-rights request (acceso/rectificacion/cancelacion/
 * oposicion) for the current user (BR-012, FR-016.2). The row is born
 * `pendiente`; resolution is an offline/admin action. The legal deadline is
 * now + 20 *business* days, stored on the row via `deadline_at`.
 */
export async function createArcoRequest(
  userId: number,
  tipo: arco_requests_tipo,
): Promise<{
  id: number;
  tipo: arco_requests_tipo;
  status: string;
  requested_at: Date;
  deadline_at: Date | null;
}> {
  const deadline = addBusinessDays(new Date(), ARCO_DEADLINE_BUSINESS_DAYS);
  const request = await prisma.arco_requests.create({
    data: { user_id: userId, tipo, deadline_at: deadline },
  });
  return {
    id: request.id,
    tipo: request.tipo,
    status: request.status,
    requested_at: request.requested_at,
    deadline_at: request.deadline_at,
  };
}

/** The current user's ARCO requests, newest first (BR-012, FR-016.2). */
export async function listArcoRequests(
  userId: number,
): Promise<
  Array<{
    id: number;
    tipo: arco_requests_tipo;
    status: string;
    requested_at: Date;
    deadline_at: Date | null;
    resolved_at: Date | null;
    response_notes: string | null;
  }>
> {
  return prisma.arco_requests.findMany({
    where: { user_id: userId },
    orderBy: { requested_at: 'desc' },
  });
}