// review film — same tour as the launch video, against the local build
import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: '/tmp/greets-vid2', size: { width: 1280, height: 800 } } });
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
await p.waitForTimeout(1600);
await p.click('.tab:has-text("WORDS")');
await p.waitForTimeout(400);
await p.click('input[aria-label="scrolltext"]');
await p.keyboard.type('ROUND TWO +++ MAKE IT YOURS +++', { delay: 45 });
await p.waitForTimeout(2600);
await p.click('button.key:has-text("◉ GIF")');
await p.waitForSelector('.resthumb', { timeout: 60000 });
await p.waitForTimeout(1500);
await p.click('button.key[title="dismiss"]');
await p.waitForTimeout(400);
await p.keyboard.press('Escape');       // the deck really does close
await p.waitForTimeout(3000);
await p.close();
await ctx.close();
await b.close();
console.log('done');
