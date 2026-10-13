import { chromium } from 'playwright';
const base = 'https://greets-theta.vercel.app';
const b = await chromium.launch();
// stills
for (const [path, tag, vp] of [
  ['/', '01-landing', [1440,900]],
  ['/miguel', '02-preboot', [1440,900]],
  ['/miguel', '03-running', [1440,900]],
  ['/', '04-mobile-landing', [390,844]],
  ['/miguel', '05-mobile-preboot', [390,844]],
  ['/miguel', '06-mobile-running', [390,844]],
  ['/avery-longname', '07-longname', [1440,900]],
]) {
  const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
  await p.goto(base + path);
  await p.waitForTimeout(2200);
  if (tag.includes('running')) {
    await p.mouse.click(vp[0] / 2, vp[1] / 2);
    await p.waitForTimeout(4500);
  }
  if (tag === '01-landing') { await p.keyboard.type('miguel'); await p.waitForTimeout(700); }
  await p.screenshot({ path: `docs/design-${tag}.png` });
  await p.close();
}
// video: landing -> type -> enter -> boot -> 10s of demo
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'docs/video', size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
await p.goto(base + '/');
await p.waitForTimeout(1500);
await p.keyboard.type('miguel');
await p.waitForTimeout(600);
await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
await p.keyboard.press('Space');
await p.waitForTimeout(11000);
await p.close();
await ctx.close();
console.log('done');
