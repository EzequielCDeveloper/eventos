import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../types/api';

/**
 * Verificamex REST client (BR-013.2, BR-010.4–BR-010.6, D-003).
 *
 * Verifies an INE credential against the Lista Nominal del INE
 * (`verificamex_integracion.md`). Contract (conceptual — exact path
 * confirmed with provider docs at integration time):
 *
 *   POST {VERIFICAMEX_API_URL}
 *   Authorization: Bearer {VERIFICAMEX_API_KEY}
 *   body: { curp, clave_elector, nombre_completo, ocr? }
 *
 *   200 → { vigente: bool, coincidencia_nombre: bool,
 *           estatus: 'activo'|'vencido'|'no_encontrado',
 *           motivo?: 'ine_vencido'|'ine_no_encontrado'|'datos_no_coinciden' }
 *
 * The request carries a hard 10-second timeout (BR-010.5): a late provider
 * never hangs the request.
 *
 * ### Stub adapter (billing guardrail)
 *
 * Verificamex bills per query and the repo `.env` carries a real
 * pre-production key. To keep the pipeline testable WITHOUT ever making a
 * real billable query, the stub is used for EVERY non-production call —
 * a real HTTP request only happens with an explicitly approved production
 * setup (`NODE_ENV=production` + non-placeholder key). The stub simulates
 * deterministic outcomes for the smoke suite:
 *
 *   - default → `{ vigente: true, coincidencia_nombre: true, estatus: 'activo' }`
 *   - `clave_elector` containing `VENCIDO`       → vencido
 *   - `clave_elector` containing `NOENCONTRADO`  → no_encontrado
 *   - `clave_elector` containing `NOMBRE`        → datos_no_coinciden
 *
 * ### Privacy (LFPDPPP — BR-010.6)
 *
 * This module only returns result metadata. It NEVER logs or persists
 * CURP / nombre / OCR; the caller (`verification.service`) stores result
 * metadata only and logs `{ user_id, result }` without PII.
 */

export interface VerificamexRequest {
  curp: string;
  clave_elector: string;
  nombre_completo: string;
  ocr?: string;
}

export type VerificamexEstatus = 'activo' | 'vencido' | 'no_encontrado';

export interface VerificamexResult {
  vigente: boolean;
  coincidencia_nombre: boolean;
  estatus: VerificamexEstatus;
  motivo: 'ine_vencido' | 'ine_no_encontrado' | 'datos_no_coinciden' | null;
}

export const VERIFICAMEX_TIMEOUT_MS = 10_000;

function isPlaceholder(value: string): boolean {
  return (
    value.length === 0 ||
    value.toLowerCase().includes('placeholder') ||
    value.toLowerCase().includes('change-me')
  );
}

/** Stub mode: any non-production environment (real keys bill per query). */
export function useVerificamexStub(): boolean {
  return env.NODE_ENV !== 'production';
}

/** Fail closed: in production, refuse to call with a placeholder key. */
function assertKeyUsable(): void {
  if (isPlaceholder(env.VERIFICAMEX_API_KEY)) {
    throw new AppError({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'VERIFICAMEX_API_KEY is not configured in production — no query was attempted',
      expose: false,
    });
  }
}

/**
 * Verify an INE credential against the Lista Nominal (BR-010.5). Stub mode
 * simulates the result locally; otherwise calls the REST API with a 10s
 * timeout. Throws `AppError` 503 SERVICE_UNAVAILABLE on timeout/5xx so the
 * caller can surface "servicio temporalmente no disponible".
 */
export async function verifyIne(input: VerificamexRequest): Promise<VerificamexResult> {
  if (useVerificamexStub()) return stubVerifyIne(input);
  assertKeyUsable();
  return realVerifyIne(input);
}

/** Deterministic in-memory outcomes (see header) — never touches network. */
function stubVerifyIne(input: VerificamexRequest): VerificamexResult {
  const marker = input.clave_elector.toUpperCase();
  if (marker.includes('VENCIDO')) {
    return { vigente: false, coincidencia_nombre: true, estatus: 'vencido', motivo: 'ine_vencido' };
  }
  if (marker.includes('NOENCONTRADO')) {
    return {
      vigente: false,
      coincidencia_nombre: false,
      estatus: 'no_encontrado',
      motivo: 'ine_no_encontrado',
    };
  }
  if (marker.includes('NOMBRE')) {
    return {
      vigente: true,
      coincidencia_nombre: false,
      estatus: 'activo',
      motivo: 'datos_no_coinciden',
    };
  }
  return { vigente: true, coincidencia_nombre: true, estatus: 'activo', motivo: null };
}

async function realVerifyIne(input: VerificamexRequest): Promise<VerificamexResult> {
  let response: Response;
  try {
    response = await fetch(env.VERIFICAMEX_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VERIFICAMEX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        curp: input.curp,
        clave_elector: input.clave_elector,
        nombre_completo: input.nombre_completo,
        ...(input.ocr ? { ocr: input.ocr } : {}),
      }),
      signal: AbortSignal.timeout(VERIFICAMEX_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AppError({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message:
        error instanceof Error && error.name === 'TimeoutError'
          ? `Verificamex did not respond within ${VERIFICAMEX_TIMEOUT_MS / 1000}s (BR-010.5)`
          : 'Verificamex service is temporarily unavailable',
      details: { timeout_ms: VERIFICAMEX_TIMEOUT_MS },
    });
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new AppError({
      statusCode: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: `Verificamex returned HTTP ${response.status} (BR-010.5)`,
      expose: false,
    });
  }
  return normalizeResult(payload);
}

/** Normalize the provider payload into the internal result shape. */
function normalizeResult(payload: Record<string, unknown>): VerificamexResult {
  const vigente = Boolean(payload.vigente);
  const coincidenciaNombre = Boolean(payload.coincidencia_nombre);
  const estatus = String(payload.estatus ?? (vigente ? 'activo' : 'no_encontrado')) as VerificamexEstatus;
  const motivoRaw = String(payload.motivo ?? '');
  const motivo = ['ine_vencido', 'ine_no_encontrado', 'datos_no_coinciden'].includes(motivoRaw)
    ? (motivoRaw as VerificamexResult['motivo'])
    : deriveMotivo(vigente, coincidenciaNombre, estatus);
  return { vigente, coincidencia_nombre: coincidenciaNombre, estatus, motivo };
}

function deriveMotivo(
  vigente: boolean,
  coincidenciaNombre: boolean,
  estatus: VerificamexEstatus,
): VerificamexResult['motivo'] {
  if (estatus === 'vencido') return 'ine_vencido';
  if (estatus === 'no_encontrado' || !vigente) return 'ine_no_encontrado';
  if (!coincidenciaNombre) return 'datos_no_coinciden';
  return null;
}

/** Stable digest marker used ONLY for metadata logs (never the raw value). */
export function metadataDigest(input: VerificamexRequest): string {
  return createHash('sha256').update(input.clave_elector).digest('hex').slice(0, 8);
}