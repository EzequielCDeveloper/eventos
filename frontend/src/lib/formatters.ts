/**
 * Formatting helpers (MXN money, dates, durations).
 * Money is always a two-decimal string from the backend; we format with
 * Intl — never float math for display.
 */

const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
});

/** "$8,000.00" (es-MX). Accepts numeric strings and numbers. */
export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? MXN.format(n) : MXN.format(0);
}

/** "$8,000" int-less variant for prominent prices. */
export function moneyCompact(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "15 de diciembre, 2026" from an ISO date (YYYY-MM-DD) or ISO datetime. */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = new Date(typeof iso === 'string' ? `${iso.slice(0, 10)}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}, ${d.getFullYear()}`;
}

/** "15/12/2026" short ISO-friendly form. */
export function formatDateShort(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(`${iso.slice(0, 10)}T12:00:00`) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "18:00" from an ISO datetime or "18:00:00" time string. */
export function formatTime(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) return '';
  if (/^\d{2}:\d{2}/.test(isoOrTime)) return isoOrTime.slice(0, 5);
  const d = new Date(isoOrTime);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "15 dic 2026 · 18:00" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = iso.slice(0, 10);
  const t = formatTime(iso);
  const date = formatDateShort(d);
  return `${date}${t ? ` · ${t}` : ''}`;
}

/** Relative label: "hace 5 min", "hace 2 h", "ayer", or short date. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return formatDateShort(iso);
}

/** "1:30" from seconds (voice notes). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** "0:00" → seconds. */
export function parseDurationSeconds(mmss: string): number {
  const parts = mmss.split(':');
  const m = Number(parts[0]) || 0;
  const s = Number(parts[1]) || 0;
  return m * 60 + s;
}

/** Today as YYYY-MM-DD (local), for <input type="date"> min/max. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
