import { chromium } from 'playwright';
const base = process.env.BASE || 'http://localhost:5388';
const b = await chromium.launch();
for (const [path, tag, vp, touch] of [
  ['/', '01-landing', [1440,900], false],
  ['/miguel', '02-preboot', [1440,900], false],
  ['/miguel', '03-running', [1440,900], false],
  ['/', '04-mobile-landing', [390,844], true],
  ['/miguel', '05-mobile-preboot', [390,844], true],
  ['/miguel', '06-mobile-running', [390,844], true],
  ['/avery-longname', '07-longname', [1440,900], false],
  ['/miguel', '08-deck', [1440,900], false],
  ['/miguel', '09-mobile-deck', [390,844], true],
  ['/aptiva', '10-custom', [1440,900], false],
]) {
  const ctx = await b.newContext({ viewport: { width: vp[0], height: vp[1] }, hasTouch: touch });
  const p = await ctx.newPage();
  await p.goto(base + path);
  await p.waitForTimeout(2200);
  if (tag.includes('running') || tag === '07-longname') {
    // key boots without toggling mute — a tap would draw SND OFF into the still
    await p.keyboard.press('Space');
    await p.waitForTimeout(4500);
  }
  if (tag === '01-landing') { await p.keyboard.type('miguel'); await p.waitForTimeout(500); }
  if (tag.includes('deck')) {
    await p.keyboard.press('Space');
    await p.waitForTimeout(3000);
    if (touch) await p.tap('.fab'); else await p.keyboard.press('e');
    await p.waitForTimeout(900);
  }
  if (tag === '10-custom') {
    // a deck-built cracktro, not a seeded one: ACID rig + custom words
    await p.keyboard.press('Space');
    await p.waitForTimeout(3000);
    await p.keyboard.press('e');
    await p.waitForSelector('.deck');
    await p.click('button.key:has-text("ACID")');
    await p.click('.tab:has-text("WORDS")');
    await p.fill('[aria-label="scrolltext"]', 'BUILT IN THE BROWSER +++ SHIPPED AS A GIF +++');
    // stay on WORDS — the pinned scroller proves the text reached the demo
    await p.waitForTimeout(3200);
  }
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
await p.waitForTimeout(29000);
await p.close();
await ctx.close();
await b.close();
console.log('done');
