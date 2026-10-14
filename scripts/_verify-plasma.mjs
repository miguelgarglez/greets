import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
await p.goto('https://greets-theta.vercel.app/miguel');
await p.waitForTimeout(2200);
await p.keyboard.press('Space');
await p.waitForTimeout(16000); // land inside the plasma section
await p.screenshot({ path: '/tmp/r9-plasma3.png' });
await p.waitForTimeout(3000);
await p.screenshot({ path: '/tmp/r9-plasma4.png' });
await b.close();
console.log('done');
