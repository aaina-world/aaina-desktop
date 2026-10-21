// Usage: node tools-shot.mjs pages/home.html [out-dir] [widths] [light|dark] [mac|win|linux] [full|window]
import { chromium } from 'playwright';
import path from 'node:path'; import fs from 'node:fs';
const [,, file, out = 'shots', widths = '1280,1024', theme = 'light', os = 'mac', mode = 'window'] = process.argv;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const w of widths.split(',').map(Number)) {
  const h = w >= 1600 ? 1000 : w >= 1280 ? 800 : 700;
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: theme });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const [f, hash] = file.split('#');
  await p.goto('file://' + path.resolve(f) + `?os=${os}&theme=${theme}` + (hash ? '#' + hash : ''));
  await p.addStyleTag({ content: '.mock-bar{display:none!important}' });
  await p.waitForTimeout(600);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const name = path.basename(f, '.html') + (hash ? '-' + hash : '') + `-${w}${theme === 'dark' ? '-dark' : ''}${os !== 'mac' ? '-' + os : ''}.png`;
  await p.screenshot({ path: path.join(out, name), fullPage: mode === 'full' });
  console.log(name, 'overflow', over, errs.length ? 'ERR ' + errs.join(' | ') : '');
  await p.close();
}
await b.close();
