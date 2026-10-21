import type { Api, Connection } from "../contract";
import type { DataLayer } from "../data";
import { EngineError, MESSAGES, createChatGPT, createOpenAI, isEngineError } from "../engine";
import type { OpenAI } from "../engine";
import type { Emit } from "./events";

const REFUSED_KEY_STATUS: Record<string, Connection["key"]["status"]> = {
  KEY_REFUSED: "refused",
  VERIFY_ORGANIZATION: "verify-organization",
  OUT_OF_CREDIT: "out-of-credit",
};

/** What a person sees when a call fails: plain words, no engine names. */
export const plain = (e: unknown) => (isEngineError(e) ? e.message : MESSAGES.UNKNOWN);

type Deps = { secrets: DataLayer["secrets"]; emit: Emit };

/** The OpenAI key and the ChatGPT sign-in: what is connected, and the OpenAI client that notices when the key is refused. */
export function createConnection({ secrets, emit }: Deps) {
  let keyStatus: Connection["key"]["status"] = "unknown";
  const getKey = () => secrets.get("openai_api_key");

  function noteKeyFailure(e: unknown): void {
    const next = isEngineError(e) ? REFUSED_KEY_STATUS[e.code] : undefined;
    if (next && next !== keyStatus) {
      keyStatus = next;
      emit({ type: "connection" });
    }
  }
  const noting = <T>(call: Promise<T>) =>
    call.catch((e: unknown) => {
      noteKeyFailure(e);
      throw e;
    });

  const raw = createOpenAI({ getKey });
  // Every paid or reading call goes through here, so a refused key shows up in Settings at once.
  const openai: OpenAI = {
    ...raw,
    editImage: (input) => noting(raw.editImage(input)),
    generateImage: (input) => noting(raw.generateImage(input)),
    respondJson: <T>(input: Parameters<typeof raw.respondJson<T>>[0]) => noting(raw.respondJson<T>(input)),
    respondText: (input) => noting(raw.respondText(input)),
  };
  const chatgpt = createChatGPT({ secrets });

  async function status(): Promise<Connection> {
    const key = await getKey();
    const signIn = await chatgpt.status();
    return {
      chatgpt: { signedIn: signIn.signedIn, email: signIn.email, plan: signIn.plan },
      key: { present: !!key, last4: key ? key.slice(-4) : null, status: key ? keyStatus : "unknown" },
      canRead: signIn.signedIn || !!key,
      canMakePhotos: !!key,
    };
  }

  async function changed(): Promise<Connection> {
    emit({ type: "connection" });
    return status();
  }

  const api: Pick<Api, "connection" | "setKey" | "removeKey" | "signInWithChatGPT" | "signOutChatGPT"> = {
    connection: status,
    async setKey(key) {
      const candidate = key.trim();
      if (!/^sk-[A-Za-z0-9_-]{12,}$/.test(candidate)) throw new Error("That doesn't look like an OpenAI key. It starts with sk-.");
      const result = await raw.checkKey(candidate).catch((e: unknown) => {
        throw new Error(plain(e));
      });
      if (result === "refused") throw new Error(MESSAGES.KEY_REFUSED);
      await secrets.set("openai_api_key", candidate);
      keyStatus = result === "works" ? "works" : "unknown";
      return changed();
    },
    async removeKey() {
      await secrets.delete("openai_api_key");
      keyStatus = "unknown";
      return changed();
    },
    async signInWithChatGPT() {
      await chatgpt.signIn();
      return changed();
    },
    async signOutChatGPT() {
      await chatgpt.signOut();
      return changed();
    },
  };

  /** Paid actions need a key (reading alone also works with the ChatGPT sign-in). */
  async function requireKey(): Promise<void> {
    if (!(await getKey())) throw new EngineError("NOT_CONNECTED", MESSAGES.NOT_CONNECTED);
  }

  return { api, openai, chatgpt, getKey, requireKey };
}
export type ConnectionPart = ReturnType<typeof createConnection>;
