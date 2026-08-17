import { apiPost, apiPut } from '@/lib/api';
import type {
  CreatePaymentBody,
  CreateReservationBody,
  PaymentDetail,
  ReservationDetail,
} from '@/types/api';
import type { ReservationStatus } from '@/types/models';

/**
 * Booking API helpers across the 6-step flow (FR-006):
 *   POST /reservations            → open the booking (status 'creado')
 *   PUT /reservations/:id/status  → drive the state machine
 *   POST /payments                → charge the advance via (server-side)
 */
export function createReservation(body: CreateReservationBody): Promise<ReservationDetail> {
  return apiPost<ReservationDetail>('/reservations', body);
}

export function transitionReservation(
  reservationId: number,
  status: ReservationStatus,
  extra: { alcohol_resolution?: 'continuar_sin_alcohol' | 'cancelar' } = {},
): Promise<ReservationDetail> {
  return apiPut<ReservationDetail>(`/reservations/${reservationId}/status`, {
    status,
    ...extra,
  });
}

export function createPayment(body: CreatePaymentBody): Promise<PaymentDetail> {
  return apiPost<PaymentDetail>('/payments', body);
}

/** Draft carried from the service detail screen (FR-006.9). */
export interface BookingDraft {
  serviceId: number;
  slot_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
}

const DRAFT_KEY = 'fiestaexpert-booking-draft';

export function readBookingDraft(): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as BookingDraft) : null;
  } catch {
    return null;
  }
}

export function clearBookingDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

/** Client-visible price: rent + extras + taxes; commission is hidden (FR-006.3). */
export function computeClientPrices(input: {
  base: number;
  extrasTotal: number;
  ivaRate: number;
}) {
  const base = input.base;
  const extras = input.extrasTotal;
  const taxes = Math.round((base + extras) * input.ivaRate * 100) / 100;
  const total = base + extras + taxes;
  return { base, extras, taxes, total };
}
