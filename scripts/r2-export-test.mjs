import { chromium } from 'playwright';
const out = process.env.OUT;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto('http://localhost:5387/miguel');
await p.waitForTimeout(1200);
await p.keyboard.press('Space');
await p.waitForTimeout(3000);
await p.keyboard.press('e');
await p.waitForTimeout(600);
// flip a few controls and check the URL picks them up
await p.click('button.key:has-text("FIRE")');
await p.click('button.key:has-text("W·WILD")');
await p.click('button.key:has-text("BOUNCE")');
await p.waitForTimeout(400);
console.log('URL after patches:', p.url());
// custom scrolltext
await p.fill('input[aria-label="scrolltext"]', 'HAPPY LAUNCH DAY MIGUEL +++ THE FUTURE IS RASTER');
await p.waitForTimeout(400);
// export a GIF
const dl = p.waitForEvent('download', { timeout: 120000 });
await p.click('button.key:has-text("◉ GIF")');
await p.waitForSelector('.prog.done', { timeout: 120000 });
await p.click('button.key:has-text("SAVE")');
const d = await dl;
await d.saveAs(out + '/test-greets.gif');
console.log('gif saved:', await d.suggestedFilename());
await p.screenshot({ path: out + '/after-edits.png' });
// export video
const dl2 = p.waitForEvent('download', { timeout: 180000 });
await p.click('button.key:has-text("▶ FILM")');
await p.waitForSelector('.prog.done', { timeout: 180000 });
await p.click('button.key:has-text("SAVE")');
const d2 = await dl2;
await d2.saveAs(out + '/test-greets.' + (await d2.suggestedFilename()).split('.').pop());
console.log('video saved:', await d2.suggestedFilename());
await b.close();
console.log('DONE');
