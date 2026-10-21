# Security

**Reporting a problem.** Please do not open a public issue. Use GitHub's private advisories: open the Security tab of this repository and choose Report a vulnerability. We will answer as soon as we can.

**Keys.** The OpenAI key and any sign-in tokens are stored only in the system keychain. They must never appear in the database, files, logs, error messages, screenshots or pull requests. If you ever paste a key somewhere by accident, revoke it at platform.openai.com and make a new one.

**Network.** The app talks only to the hosts listed in `ARCHITECTURE.md`. The Content-Security-Policy and http plugin scope enforce this.

**Supported versions.** The latest release.
