import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment configuration, Zod-validated at boot (UR-005, D-010).
 *
 * External-service keys (Conekta, Verificamex, FCM, Resend, Agora) are
 * collected later in the payments/realtime slices. In development the
 * placeholders from `.env.example` are accepted so the rest of the API can
 * be built and booted before real keys arrive. Fail-fast (rejecting
 * placeholder values) only applies when NODE_ENV=production.
 */

const PLACEHOLDER_MARKERS: ReadonlyArray<string> = [
  'placeholder',
  'dev-secret-change-me',
  'change-me',
];

/** True when a value looks like a dev placeholder that must not ship to prod. */
function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker));
}

/** JSON string that must parse (e.g. FCM_SERVICE_ACCOUNT key blob). */
const jsonString = (field: string) =>
  z
    .string()
    .refine((value) => {
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    }, `${field} must be a valid JSON string`);

/** String that may not be blank; in production it must also not be a placeholder. */
function secret(field: string) {
  return z
    .string()
    .min(1, `${field} is required`)
    .superRefine((value, ctx) => {
      if (process.env.NODE_ENV === 'production' && isPlaceholder(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be set to a real value in production (placeholders are rejected)`,
        });
      }
    });
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database (D-001)
  DATABASE_URL: secret('DATABASE_URL'),

  // Auth (BR-002)
  JWT_SECRET: secret('JWT_SECRET'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Job queue (D-011)
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // External services (UR-005). Placeholders allowed outside production.
  CONEKTA_API_KEY: secret('CONEKTA_API_KEY'),
  VERIFICAMEX_API_KEY: secret('VERIFICAMEX_API_KEY'),
  FCM_SERVICE_ACCOUNT: jsonString('FCM_SERVICE_ACCOUNT'),
  RESEND_API_KEY: secret('RESEND_API_KEY'),
  AGORA_APP_ID: secret('AGORA_APP_ID'),
  AGORA_APP_CERTIFICATE: secret('AGORA_APP_CERTIFICATE'),

  // Uploads (D-004, D-012)
  UPLOAD_DIR: z.string().default('/data/uploads'),
  SIGNED_URL_SECRET: secret('SIGNED_URL_SECRET'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`[config] Invalid environment variables:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;