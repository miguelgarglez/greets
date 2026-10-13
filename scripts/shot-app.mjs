import { chromium } from 'playwright';
const b = await chromium.launch();
for (const [w,h,tag] of [[1440,900,'d'],[390,844,'m']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('http://localhost:5311/miguel');
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `explore/shots/app-preboot-${tag}.png` });
  await p.keyboard.press('Space');
  await p.waitForTimeout(3200);
  await p.screenshot({ path: `explore/shots/app-running-${tag}.png` });
  await p.close();
}
// landing
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5311/');
await p.waitForTimeout(1800);
await p.keyboard.type('miguel');
await p.waitForTimeout(600);
await p.screenshot({ path: 'explore/shots/app-landing.png' });
await b.close();
