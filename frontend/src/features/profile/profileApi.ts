import { apiGet, apiPost } from '@/lib/api';
import type { ArcoRequest } from '@/types/api';
import type { ArcoRequestStatus, ArcoRequestTipo } from '@/types/models';

/**
 * ARCO data-rights helpers (BR-012, FR-016.2). The backend persists each
 * request with `status=pendiente` and a 20-business-day LFPDPPP deadline —
 * the UI is now server-backed, not client-side only.
 */

export const arcoKeys = {
  list: ['users', 'arco-requests'] as const,
};

export function fetchArcoRequests(): Promise<ArcoRequest[]> {
  return apiGet<ArcoRequest[]>('/users/arco-requests');
}

export function createArcoRequest(tipo: ArcoRequestTipo): Promise<ArcoRequest> {
  return apiPost<ArcoRequest>('/users/arco-requests', { tipo });
}

export const ARCO_TIPO_LABELS: Record<ArcoRequestTipo, string> = {
  acceso: 'Acceso',
  rectificacion: 'Rectificación',
  cancelacion: 'Cancelación',
  oposicion: 'Oposición',
};

export const ARCO_STATUS_LABELS: Record<ArcoRequestStatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
  rechazado: 'Rechazado',
};
