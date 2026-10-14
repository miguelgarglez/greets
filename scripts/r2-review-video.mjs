import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: '/tmp/greets-vid', size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
await p.goto('http://localhost:5388/');
await p.waitForTimeout(1500);
await p.keyboard.type('miguel', { delay: 130 });
await p.waitForTimeout(500);
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);
await p.keyboard.press('Space');
await p.waitForTimeout(7000);          // demo running
await p.keyboard.press('e');            // deck slides up
await p.waitForTimeout(1200);
await p.click('button.key:has-text("RAGE")');
await p.waitForTimeout(1400);
await p.fill('input[placeholder="SCROLLTEXT · AUTO"]', 'ROUND TWO +++ MAKE IT YOURS +++');
await p.waitForTimeout(2600);
await p.keyboard.press('Escape');
await p.waitForTimeout(2500);
await p.close();
await ctx.close();
await b.close();
console.log('done');
