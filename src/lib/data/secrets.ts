import { invoke } from "@tauri-apps/api/core";

// The OpenAI key and ChatGPT sign-in tokens live only in the system keychain (Rust commands in src-tauri/src/secrets.rs).
export type SecretName = "openai_api_key" | "chatgpt_tokens" | "chatgpt_account";

export const secrets = {
  get: (name: SecretName) => invoke<string | null>("secret_get", { name }),
  set: (name: SecretName, value: string) => invoke<void>("secret_set", { name, value }),
  delete: (name: SecretName) => invoke<void>("secret_delete", { name }),
};
export type Secrets = typeof secrets;
