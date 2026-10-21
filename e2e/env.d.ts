// The project does not depend on @types/node, so these are the only Node globals the end-to-end tests use.
declare const process: { env: Record<string, string | undefined> };
type Buffer = Uint8Array;
declare const Buffer: { from(data: string, encoding: "base64"): Buffer };
