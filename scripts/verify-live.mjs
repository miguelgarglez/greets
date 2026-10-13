import { chromium } from 'playwright';
const base = 'https://greets-theta.vercel.app';
const b = await chromium.launch();
const errors = [];
for (const [path, tag] of [['/', 'landing'], ['/miguel', 'named'], ['/miguel', 'running']]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await p.goto(base + path);
  await p.waitForTimeout(2500);
  if (tag === 'running') { await p.keyboard.press('Space'); await p.waitForTimeout(2500); }
  await p.screenshot({ path: `docs/live-${tag}.png` });
  await p.close();
}
console.log('console errors:', errors.length ? errors : 'none');
await b.close();
