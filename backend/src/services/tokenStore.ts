/**
 * JWT token denylist (BR-002.7 / UR-003 token rotation).
 *
 * Refresh tokens are rotated: the previous `jti` is revoked here so a
 * used or logged-out refresh token cannot be replayed after rotation.
 *
 * Scope note: revocation lives in an in-process store. This is sufficient
 * for the single-VPS MVP topology (D-010). Multi-instance deployments must
 * move this to a shared store (Redis) — that bridge lands with the
 * realtime/jobs slice (S5), whose Redis connection is deliberately lazy.
 */
const revoked = new Map<string, number>(); // jti → expiry epoch ms

/** Drop entries whose TTL elapsed. */
function sweep(): void {
  const now = Date.now();
  for (const [jti, expiresAt] of revoked) {
    if (expiresAt <= now) revoked.delete(jti);
  }
}

/**
 * Mark a token as revoked until its natural expiry.
 *
 * @param jti       token id from the refresh token payload
 * @param expiresAt epoch ms when the token would expire anyway
 */
export function revokeToken(jti: string, expiresAt: number): void {
  revoked.set(jti, expiresAt);
}

/** True when the token id has been revoked and has not expired. */
export function isTokenRevoked(jti: string): boolean {
  sweep();
  return revoked.has(jti);
}