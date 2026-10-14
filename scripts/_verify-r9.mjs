import { chromium } from 'playwright';
const base = 'https://greets-theta.vercel.app';
const b = await chromium.launch();
// 1. mobile touch preboot — the rocker under the tube
let ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
let p = await ctx.newPage();
await p.goto(base + '/miguel');
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/r9-mobile-preboot.png' });
// pressed frame: hold the rocker down
await p.touchscreen.tap(195, 700);
await p.waitForTimeout(120);
await p.screenshot({ path: '/tmp/r9-mobile-press.png' });
await ctx.close();
// 2. landing->enter slit window — should reveal typed word only
ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: '/tmp/r9vid', size: { width: 1280, height: 800 } } });
p = await ctx.newPage();
await p.goto(base + '/');
await p.waitForTimeout(1500);
await p.keyboard.type('miguel', { delay: 100 });
await p.keyboard.press('Enter');
await p.waitForTimeout(24000);
await p.close();
await ctx.close();
// 3. reduced motion
ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
p = await ctx.newPage();
await p.goto(base + '/miguel');
await p.waitForTimeout(2200);
await p.keyboard.press('Space');
await p.waitForTimeout(1500);
await p.screenshot({ path: '/tmp/r9-reduced.png' });
await ctx.close();
await b.close();
console.log('done');
