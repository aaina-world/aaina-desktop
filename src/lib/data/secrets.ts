import { invoke } from "@tauri-apps/api/core";

// The OpenAI key and ChatGPT sign-in tokens live only in the system keychain (Rust commands in src-tauri/src/secrets.rs).
export type SecretName = "openai_api_key" | "chatgpt_tokens" | "chatgpt_account";

/** Shown when the system keychain can't be used: on Linux, no keyring is running or it is locked. */
export const KEYCHAIN_UNAVAILABLE =
  "Your computer's keychain couldn't be used, so nothing was saved. On Linux, check that a keyring (GNOME Keyring or KWallet) is running and unlocked, then try again.";

/** The Rust side answers with a plain string; screens need an Error with words a person can act on. */
async function call<T>(command: string, args: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(detail.startsWith("KEYCHAIN_UNAVAILABLE") ? KEYCHAIN_UNAVAILABLE : detail, { cause: e });
  }
}

export const secrets = {
  get: (name: SecretName) => call<string | null>("secret_get", { name }),
  set: (name: SecretName, value: string) => call<void>("secret_set", { name, value }),
  delete: (name: SecretName) => call<void>("secret_delete", { name }),
};
export type Secrets = typeof secrets;
