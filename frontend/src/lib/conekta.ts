import { CONEKTA_PUBLIC_KEY } from './constants';

/**
 * Conekta.js client-side wrapper (FR-006.4, D-003).
 *
 * The publishable key never leaves the browser; card data is tokenized by
 * Conekta.js and only the token reaches us. The backend charge is made via
 * POST /payments (server-side SDK) — this module only produces the token.
 *
 * When `VITE_CONEKTA_PUBLIC_KEY` is empty (development / demo), the
 * tokenize step runs in SIMULATED mode (matching the mockup "pago
 * simulado") and never touches a real card network.
 */

declare global {
  interface Window {
    Conekta?: {
      setPublishableKey: (key: string) => void;
      Token: {
        create: (
          card: Record<string, string>,
          callback: (response: { token?: string; id?: string; object?: string; message?: string }) => void,
        ) => void;
      };
    };
  }
}

export interface CardInput {
  cardNumber: string;
  cardName: string;
  expMonth: string;
  expYear: string;
  cvc: string;
}

export interface TokenResult {
  tokenId: string;
  simulated: boolean;
  last4: string;
}

const CARD_SOURCE =
  'https://cdn.conekta.io/js/latest/conekta.js';

let scriptPromise: Promise<void> | null = null;

/** Inject Conekta.js once; resolves when ready. */
function loadConektaScript(): Promise<void> {
  if (window.Conekta) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CARD_SOURCE;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Conekta.js'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Deterministic fake token for simulated (dev) mode. */
function simulatedToken(cardNumber: string): string {
  const last4 = cardNumber.replace(/\s+/g, '').slice(-4);
  return `tok_simulado_${last4}_${Date.now().toString(36)}`;
}

/** Basic Luhn validation for the card number. */
export function isValidCardNumber(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Tokenize a card with Conekta.js (or simulate in dev). */
export async function tokenizeCard(input: CardInput): Promise<TokenResult> {
  const cardNumber = input.cardNumber.replace(/\s+/g, '');
  const last4 = cardNumber.slice(-4);
  const expMonth = input.expMonth.replace(/\D/g, '');
  const expYear = input.expYear.replace(/\D/g, '');

  // Real tokenization requires a publishable key.
  if (!CONEKTA_PUBLIC_KEY) {
    return { tokenId: simulatedToken(cardNumber), simulated: true, last4 };
  }

  await loadConektaScript();
  if (!window.Conekta) {
    throw new Error('Conekta.js no está disponible');
  }

  window.Conekta.setPublishableKey(CONEKTA_PUBLIC_KEY);

  return new Promise<TokenResult>((resolve, reject) => {
    window.Conekta?.Token.create(
      {
        number: cardNumber,
        name: input.cardName,
        exp_month: expMonth,
        exp_year: expYear.length === 2 ? `20${expYear}` : expYear,
        cvc: input.cvc.replace(/\D/g, ''),
      },
      (response) => {
        if (response.token || response.id) {
          resolve({ tokenId: response.token ?? response.id ?? '', simulated: false, last4 });
        } else {
          reject(new Error(response.message ?? 'No se pudo tokenizar la tarjeta'));
        }
      },
    );
  });
}
