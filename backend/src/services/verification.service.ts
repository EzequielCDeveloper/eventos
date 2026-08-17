import type {
  identity_verifications_estatus_lista_nominal,
  identity_verifications_motivo,
  identity_verifications_result,
} from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types/api';
import { verifyIne, type VerificamexRequest, type VerificamexResult } from '../integrations/verificamex';

/**
 * Identity verification service (BR-010, UR-002.2).
 *
 * Runs the remote KYC flow against Verificamex (BR-010.4/BR-010.5):
 *
 *   1. REQUIRES explicit consent — an accepted `consent_logs` row of type
 *      `verificacion_identidad` MUST exist BEFORE any verification call
 *      (BR-010.7). No consent → 409, nothing is sent to the provider.
 *   2. Calls the Verificamex integration (stub outside production, 10s
 *      timeout; a timeout/5xx is stored as `error_api` and surfaced as
 *      503 SERVICE_UNAVAILABLE — "servicio temporalmente no disponible").
 *   3. Persists ONLY result metadata (result, estatus, motivo, vigencia,
 *      coincidencia, error_code) into `identity_verifications` — the INE
 *      inputs (CURP, clave de elector, nombre, OCR) are never stored and
 *      never logged (BR-010.6, LFPDPPP).
 *   4. On `verificado` the user is marked `verified = true`; the publish
 *      gate (BR-002.5) already blocks unverified providers from publishing.
 *
 * The route `POST /users/verify-kyc` previously only created a `pendiente`
 * row (S2 placeholder); it now runs this full flow synchronously.
 */

export interface KycVerificationInput {
  curp: string;
  clave_elector: string;
  nombre_completo: string;
  ocr?: string;
}

export interface KycVerificationOutcome {
  id: number;
  user_id: number;
  method: 'kyc';
  kyc_provider: 'verificamex';
  result: identity_verifications_result;
  estatus_lista_nominal: identity_verifications_estatus_lista_nominal | null;
  motivo: identity_verifications_motivo | null;
  vigente: boolean | null;
  coincidencia_nombre: boolean | null;
  created_at: string;
  user_verified: boolean;
}

/** Map the provider result into the closed enum sets (BR-010). */
function mapResult(result: VerificamexResult): {
  result: identity_verifications_result;
  estatus: identity_verifications_estatus_lista_nominal;
  motivo: identity_verifications_motivo | null;
  vigente: boolean;
  coincidencia: boolean;
} {
  if (result.vigente && result.coincidencia_nombre) {
    return { result: 'verificado', estatus: 'activo', motivo: null, vigente: true, coincidencia: true };
  }
  if (result.motivo === 'ine_vencido' || result.estatus === 'vencido') {
    return { result: 'ine_vencido', estatus: 'vencido', motivo: 'ine_vencido', vigente: false, coincidencia: Boolean(result.coincidencia_nombre) };
  }
  if (result.motivo === 'ine_no_encontrado' || result.estatus === 'no_encontrado') {
    return { result: 'ine_no_encontrado', estatus: 'no_encontrado', motivo: 'ine_no_encontrado', vigente: false, coincidencia: false };
  }
  return { result: 'datos_no_coinciden', estatus: 'activo', motivo: 'datos_no_coinciden', vigente: Boolean(result.vigente), coincidencia: false };
}

/** Normalize free-form user input before sending it to the provider. */
function normalizeInput(input: KycVerificationInput): VerificamexRequest {
  return {
    curp: input.curp.trim().toUpperCase(),
    clave_elector: input.clave_elector.trim().toUpperCase(),
    nombre_completo: input.nombre_completo.trim(),
    ocr: input.ocr?.trim().toUpperCase() || undefined,
  };
}

/** No-PII audit line: only ids, outcome, method and timestamp (BR-010.6). */
function logVerificationMeta(userId: number, outcome: { result: string; estatus: string | null; motivo: string | null }): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'identity_verification',
      user_id: userId,
      method: 'kyc',
      provider: 'verificamex',
      result: outcome.result,
      estatus: outcome.estatus,
      motivo: outcome.motivo,
    }),
  );
}

/**
 * Run the full KYC verification (consent → Verificamex → metadata row →
 * verified flag). Throws 409 when consent is missing, 503 when the
 * provider is temporarily unavailable, and always records a metadata-only
 * result row.
 */
export async function runKycVerification(
  userId: number,
  input: KycVerificationInput,
): Promise<KycVerificationOutcome> {
  // BR-010.7: explicit consent must exist BEFORE any verification call.
  const consent = await prisma.consent_logs.findFirst({
    where: { user_id: userId, consent_type: 'verificacion_identidad', accepted: true },
  });
  if (!consent) {
    throw new AppError({
      statusCode: 409,
      code: 'CONFLICT',
      message:
        'Explicit identity-verification consent (consent_logs, tipo verificacion_identidad) is required before verification (BR-010.7)',
    });
  }

  let providerResult: VerificamexResult;
  try {
    providerResult = await verifyIne(normalizeInput(input));
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 503) {
      await prisma.identity_verifications.create({
        data: {
          user_id: userId,
          method: 'kyc',
          kyc_provider: 'verificamex',
          result: 'error_api',
          error_code: 'timeout_or_5xx',
        },
      });
      logVerificationMeta(userId, { result: 'error_api', estatus: null, motivo: null });
      throw error; // surfaced as 503 — "servicio temporalmente no disponible"
    }
    throw error;
  }

  const mapped = mapResult(providerResult);
  const verification = await prisma.identity_verifications.create({
    data: {
      user_id: userId,
      method: 'kyc',
      kyc_provider: 'verificamex',
      result: mapped.result,
      estatus_lista_nominal: mapped.estatus,
      motivo: mapped.motivo,
      vigente: mapped.vigente,
      coincidencia_nombre: mapped.coincidencia,
    },
  });

  if (mapped.result === 'verificado') {
    await prisma.users.update({
      where: { id: userId },
      data: { verified: true, updated_at: new Date() },
    });
  }

  logVerificationMeta(userId, {
    result: mapped.result,
    estatus: mapped.estatus,
    motivo: mapped.motivo,
  });

  return {
    id: verification.id,
    user_id: userId,
    method: 'kyc',
    kyc_provider: 'verificamex',
    result: verification.result,
    estatus_lista_nominal: verification.estatus_lista_nominal,
    motivo: verification.motivo,
    vigente: verification.vigente,
    coincidencia_nombre: verification.coincidencia_nombre,
    created_at: verification.created_at.toISOString(),
    user_verified: mapped.result === 'verificado',
  };
}