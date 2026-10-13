import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'docs/video', size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
await p.goto('https://greets-theta.vercel.app/');
await p.waitForTimeout(2000);
await p.keyboard.type('miguel', { delay: 120 });
await p.waitForTimeout(800);
await p.keyboard.press('Enter');
await p.waitForTimeout(2000);
await p.keyboard.press('Space');
await p.waitForTimeout(22000); // ~2.5 section cycles
await p.close();
await ctx.close();
console.log('done');
