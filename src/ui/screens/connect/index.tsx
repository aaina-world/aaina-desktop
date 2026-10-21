import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { FieldError, formatUsd, Icon, Logo, Notice, OPENAI_BILLING_URL, OPENAI_KEYS_URL, OPENAI_ORG_URL } from "../../components";
import { useLoad, useOs, useSettings } from "../../hooks";
import { ESTIMATE_USD } from "../../../lib/contract";

export function OnboardingTop({ step }: { step: 1 | 2 | 3 }) {
  return (
    <header className="ob-top">
      <Logo />
      <span className="brand-stack">
        <span className="brand-word">AAINA</span>
        <span className="brand-sub">Desktop</span>
      </span>
      <div className="prog">
        <span className="t-caption">Step {step} of 3</span>
        <div className="progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
          <i style={{ "--p": `${Math.round((step / 3) * 100)}%` } as React.CSSProperties} />
        </div>
      </div>
    </header>
  );
}

const KEY_REFUSED_TEXT = "OpenAI didn't accept this key. Check it was copied in full.";

/** The two ways to connect OpenAI. Used on this screen and, with the same behaviour, in Settings. */
export function ConnectCards() {
  const { os } = useOs();
  const conn = useLoad((a) => a.connection(), [], ["connection"]);
  const c = conn.data;
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  async function check() {
    const typed = key.trim();
    if (!typed && !c?.key.present) {
      setKeyError("Paste your OpenAI key first.");
      return;
    }
    setChecking(true);
    setKeyError(null);
    try {
      // An empty field with a saved key checks the saved key again.
      const a = await api();
      const next = typed ? await a.setKey(typed) : await a.checkKey();
      if (next.key.status === "works") setKey("");
      else if (next.key.status === "refused") setKeyError(KEY_REFUSED_TEXT);
      conn.reload();
    } catch (error) {
      setKeyError(error instanceof Error && error.message ? error.message : "We couldn't reach OpenAI. Check your internet and try again.");
    } finally {
      setChecking(false);
    }
  }
  async function signIn() {
    setChatBusy(true);
    setChatError(null);
    try {
      await (await api()).signInWithChatGPT();
      conn.reload();
    } catch {
      setChatError("We couldn't sign you in. Nothing was changed. Try again.");
    } finally {
      setChatBusy(false);
    }
  }

  const status = c?.key.present ? c.key.status : "unknown";
  const store = os === "mac" ? "your Mac's Keychain" : os === "win" ? "Windows Credential Manager" : "your system keyring";

  return (
    <>
      <section className="card opt">
        <div className="opt-head">
          <span className="ic">
            <Icon name="chatgpt" />
          </span>
          <div className="grow">
            <h2>Sign in with ChatGPT</h2>
            <p className="t-small muted mt-1" style={{ maxWidth: "50ch" }}>
              Reads your products and photos with your ChatGPT plan, at no cost to your key. OpenAI doesn't let ChatGPT plans make photos in
              other apps yet, so photos need the key below; we'll switch them over when it does.
            </p>
          </div>
        </div>
        {c?.chatgpt.signedIn ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
            <span className="badge success dot">Connected</span>
            <span className="t-small grow">
              Signed in as <b>{c.chatgpt.email}</b>
              {c.chatgpt.plan ? ` · ${c.chatgpt.plan} plan` : ""}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await (await api()).signOutChatGPT();
                conn.reload();
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <div>
              <button className={"btn btn-primary"} onClick={signIn} disabled={chatBusy}>
                {chatBusy ? <span className="spinner" /> : <Icon name="chatgpt" size="sm" />}
                {chatBusy ? "Waiting for ChatGPT" : "Sign in with ChatGPT"}
              </button>
            </div>
            {chatError && <FieldError>{chatError}</FieldError>}
          </div>
        )}
      </section>

      <section className="card opt">
        <div className="opt-head">
          <span className="ic">
            <Icon name="key" />
          </span>
          <div className="grow">
            <h2>Your OpenAI key</h2>
            <p className="t-small muted mt-1">Makes the photos. Also reads your products when you're not signed in to ChatGPT.</p>
          </div>
          {c?.key.present && (
            <button
              className="btn btn-danger-ghost btn-sm"
              onClick={async () => {
                await (await api()).removeKey();
                setKeyError(null);
                conn.reload();
              }}
            >
              Remove
            </button>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="key">
            API key
          </label>
          <div className="keyrow">
            <div className={"input-wrap" + (keyError ? " field invalid" : "")}>
              <input
                className="input"
                id="key"
                type={show ? "text" : "password"}
                placeholder={c?.key.present ? `Saved: sk-…${c.key.last4 ?? ""}` : "sk-…"}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setKeyError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && check()}
              />
              <button
                className="btn btn-ghost btn-icon btn-sm eye"
                aria-label={show ? "Hide key" : "Show key"}
                onClick={() => setShow((v) => !v)}
              >
                <Icon name="eye" size="sm" />
              </button>
            </div>
            <button className="btn btn-secondary" style={{ height: "var(--h,40px)" }} onClick={check} disabled={checking}>
              {checking ? (
                <>
                  <span className="spinner" />
                  Checking
                </>
              ) : (
                "Check key"
              )}
            </button>
          </div>
          {keyError && <FieldError>{keyError}</FieldError>}
          {!keyError && status === "works" && !key && (
            <div className="ok-line">
              <Icon name="check" size="sm" />
              Key works. You can make photos.
            </div>
          )}
          <button
            className="btn btn-link t-small"
            style={{ alignSelf: "flex-start", marginLeft: 1 }}
            onClick={async () => (await api()).openUrl(OPENAI_KEYS_URL)}
          >
            Where do I get a key?
          </button>
        </div>
        {!keyError && status === "refused" && !key && (
          <Notice tone="danger">OpenAI no longer accepts the saved key. Paste a new one above.</Notice>
        )}
        {status === "verify-organization" && (
          <Notice tone="warning" action={{ label: "Open OpenAI settings", onClick: async () => (await api()).openUrl(OPENAI_ORG_URL) }}>
            OpenAI asks new accounts to verify the organisation before making photos. Verify on platform.openai.com, then come back.
          </Notice>
        )}
        {status === "out-of-credit" && (
          <Notice tone="warning" action={{ label: "Open OpenAI billing", onClick: async () => (await api()).openUrl(OPENAI_BILLING_URL) }}>
            This OpenAI account is out of credit. Add some, then check the key again.
          </Notice>
        )}
        <div className="facts">
          <span className="local-note">
            <Icon name="lock" />
            Kept in {store} and sent only to OpenAI.
          </span>
          <span className="local-note">
            <Icon name="coin" />
            About {formatUsd(ESTIMATE_USD.photo.standard)} a photo, billed by OpenAI.
          </span>
        </div>
      </section>
    </>
  );
}

export function ConnectScreen() {
  const navigate = useNavigate();
  const { update } = useSettings();
  return (
    <div className="ob">
      <OnboardingTop step={2} />
      <div className="ob-body">
        <div>
          <h1 className="t-page">
            Connect <em className="italic">OpenAI</em>
          </h1>
          <p className="muted" style={{ maxWidth: "52ch", marginTop: 10 }}>
            Aaina Desktop uses OpenAI to read your products and make the photos. You pay OpenAI directly; Aaina never sees your key.
          </p>
        </div>
        <ConnectCards />
      </div>
      <footer className="ob-foot">
        <Link className="btn btn-ghost" to="/welcome">
          <Icon name="left" size="sm" />
          Back
        </Link>
        <div className="grow" />
        <button
          className="btn btn-link"
          onClick={async () => {
            await update({ onboarded: true });
            void navigate("/");
          }}
        >
          Skip for now
        </button>
        <Link className="btn btn-primary" to="/setup">
          Continue
        </Link>
      </footer>
    </div>
  );
}
