import { chromium } from 'playwright';
const base = 'https://greets-theta.vercel.app';
const b = await chromium.launch();
for (const [path, tag, vp, touch] of [
  ['/', '01-landing', [1440,900], false],
  ['/miguel', '02-preboot', [1440,900], false],
  ['/miguel', '03-running', [1440,900], false],
  ['/', '04-mobile-landing', [390,844], true],
  ['/miguel', '05-mobile-preboot', [390,844], true],
  ['/miguel', '06-mobile-running', [390,844], true],
  ['/avery-longname', '07-longname', [1440,900], false],
]) {
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: touch });
  const p = await ctx.newPage();
  await p.goto(base + path);
  await p.waitForTimeout(2200);
  if (tag.includes('running')) {
    await p.mouse.click(vp[0] / 2, vp[1] / 2);
    await p.waitForTimeout(4500);
  }
  if (tag === '01-landing') { await p.keyboard.type('miguel'); await p.waitForTimeout(500); }
  await p.screenshot({ path: `docs/design-${tag}.png` });
  await ctx.close();
}
// video: landing -> type -> enter -> boot -> 2+ section cycles
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'docs/video', size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
await p.goto(base + '/');
await p.waitForTimeout(1500);
await p.keyboard.type('miguel', { delay: 120 });
await p.waitForTimeout(600);
await p.keyboard.press('Enter');
await p.waitForTimeout(2600);
await p.keyboard.press('Space');
await p.waitForTimeout(20000);
await p.close();
await ctx.close();
await b.close();
console.log('done');
