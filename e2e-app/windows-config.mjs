// Writes the extra config for the Windows test build: the same window, with WebView2's DevTools port open on 9222 so the
// test can drive it. Shipped builds never have this. (WebView2 ignores the environment variable once Tauri sets its own
// browser arguments, so the port has to be one of them.)
import { readFileSync, writeFileSync } from "node:fs";

const conf = JSON.parse(readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const windows = conf.app.windows.map((w) => ({
  ...w,
  additionalBrowserArgs: "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --remote-debugging-port=9222",
}));
writeFileSync(new URL("./windows.conf.json", import.meta.url), JSON.stringify({ app: { windows } }, null, 2));
