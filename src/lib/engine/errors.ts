import type { PhotoErrorCode } from "../contract";

/** What went wrong with a call to OpenAI, in the contract's words. Messages are plain and never hold a key. */
export class EngineError extends Error {
  readonly code: PhotoErrorCode;
  /** "no": OpenAI refused before doing work. "maybe": the request may have been charged; never sent again automatically. */
  readonly charged: "no" | "maybe";
  constructor(code: PhotoErrorCode, message: string, charged: "no" | "maybe" = "no") {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.charged = charged;
  }
}

export const isEngineError = (e: unknown): e is EngineError => e instanceof EngineError;

export const MESSAGES: Record<PhotoErrorCode, string> = {
  NOT_CONNECTED: "Add your OpenAI key in Settings first.",
  KEY_REFUSED: "OpenAI did not accept your key. Check it in Settings.",
  VERIFY_ORGANIZATION:
    "OpenAI asks you to verify your organisation before it makes photos. Do that in your OpenAI account, then try again.",
  OUT_OF_CREDIT: "Your OpenAI account is out of credit. Add credit in your OpenAI account, then try again.",
  RATE_LIMITED: "OpenAI is busy right now. Nothing was charged. Try again in a minute.",
  CONTENT_REFUSED: "OpenAI would not make this photo. Nothing was charged. Try different words or photos.",
  NETWORK: "No internet connection. Nothing was sent.",
  INTERRUPTED: "The connection dropped while the photo was being made. OpenAI may have charged for it.",
  BAD_ANSWER: "OpenAI answered, but not with a usable photo. It may have charged for it.",
  UNKNOWN: "Something went wrong. Try again.",
};

export const engineError = (code: PhotoErrorCode, charged: "no" | "maybe" = "no", detail?: string) =>
  new EngineError(code, detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code], charged);

/** Maps an OpenAI error reply (status + parsed JSON body) to an EngineError. Pure, for tests. */
export function errorFromReply(status: number, body: unknown): EngineError {
  const err = (body as { error?: { code?: unknown; type?: unknown; message?: unknown } } | null)?.error ?? {};
  const word = (v: unknown) => (typeof v === "string" ? v : "");
  const text = `${word(err.code)} ${word(err.type)} ${word(err.message)}`.toLowerCase();
  if (status === 401) return engineError("KEY_REFUSED");
  if (status === 403 && /organization|verif/.test(text)) return engineError("VERIFY_ORGANIZATION");
  if (status === 403) return engineError("KEY_REFUSED");
  if (/insufficient_quota|billing_hard_limit|billing|exceeded your current quota/.test(text)) return engineError("OUT_OF_CREDIT");
  if (/must be verified|verify.*organization/.test(text)) return engineError("VERIFY_ORGANIZATION");
  if (/moderation|content_policy|safety|content_filter/.test(text)) return engineError("CONTENT_REFUSED");
  if (status === 429 || status === 503) return engineError("RATE_LIMITED");
  if (status >= 500) return engineError("UNKNOWN", "maybe");
  return engineError("UNKNOWN", "no", `HTTP ${status}`);
}

/** A reply that was refused before any work: asking again later costs nothing. */
export const isBusyReply = (status: number, body: unknown) =>
  (status === 429 || status === 503) && errorFromReply(status, body).code === "RATE_LIMITED";
