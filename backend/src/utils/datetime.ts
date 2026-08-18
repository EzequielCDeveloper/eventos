/**
 * Date/time coercion helpers for the API ↔ Prisma boundary (BR-001, UR-001.3).
 *
 * Prisma maps `@db.Date` columns to JS `Date` and `@db.Time` columns to JS
 * `Date` as well. These helpers pin the wall-clock value to UTC so that
 * `YYYY-MM-DD` and `HH:MM:SS` strings survive the round-trip without
 * timezone shifts regardless of the host timezone.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Parse `YYYY-MM-DD` into a UTC-midnight `Date`; null when malformed. */
export function parseISODate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Parse `HH:MM` / `HH:MM:SS` into an epoch-day `Date`; null when malformed. */
export function parseISOTime(value: string): Date | null {
  const normalized = value.length === 5 ? `${value}:00` : value;
  if (!TIME_RE.test(normalized)) return null;
  const date = new Date(`1970-01-01T${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `Date` → `YYYY-MM-DD` using the UTC representation (DATE columns). */
export function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** `Date` → `HH:MM:SS` using the UTC representation (TIME columns). */
export function toTimeString(value: Date): string {
  return value.toISOString().slice(11, 19);
}

/** `Date` → ISO 8601 string, or null for absent values (TIMESTAMP columns). */
export function toISOStringOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Add `count` business days (Mon–Fri) to a date, skipping weekends.
 *
 * Used for the LFPDPPP ARCO response deadline: a request must be answered
 * within 20 *business* days (BR-012). Operates in UTC so the resulting
 * DATE-truncated value does not drift with the host timezone. Public
 * holidays are not modeled (MVP limitation).
 */
export function addBusinessDays(start: Date, count: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < count) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) added += 1; // skip Sunday (0) and Saturday (6)
  }
  return result;
}

/**
 * Lexicographic comparison of zero-padded `HH:MM[:SS]` strings. Valid for
 * the whole 24-hour range because every component is zero-padded.
 */
export function isTimeBefore(a: string, b: string): boolean {
  return a < b;
}