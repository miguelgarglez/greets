// the launch film is a tour, not a timelapse: land, name, boot, reveal,
// a full section cycle, then the deck — a rig swap, a custom scrolltext,
// the export finishing — and the deck closing back onto the running demo
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://greets-theta.vercel.app';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'docs/video', size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
await p.goto(BASE + '/');
await p.waitForTimeout(1800);
await p.keyboard.type('miguel', { delay: 130 });
await p.waitForTimeout(700);
await p.keyboard.press('Enter');
await p.waitForTimeout(2200);
await p.keyboard.press('Space');
await p.waitForTimeout(11500); // boot, reveal, a full first section

// the deck: rig first, then words — the two moves that change everything
await p.keyboard.press('e');
await p.waitForTimeout(1200);
await p.click('button.key:has-text("RAGE")');
await p.waitForTimeout(2200);
await p.click('.tab:has-text("WORDS")');
await p.waitForTimeout(400);
await p.click('input[aria-label="scrolltext"]');
await p.keyboard.type('ROUND TWO +++ MAKE IT YOURS +++', { delay: 45 });
await p.waitForTimeout(2600); // the pinned scroller shows the new line

// export lands as an artifact — thumb + filename in the MAKE rail
await p.click('button.key:has-text("◉ GIF")');
await p.waitForSelector('.resthumb', { timeout: 60000 });
await p.waitForTimeout(1600);
await p.click('button.key[title="dismiss"]');
await p.waitForTimeout(400);

// and the deck closes back onto the running demo — nothing lost
await p.keyboard.press('Escape');
await p.waitForTimeout(4000);
await p.close();
await ctx.close();
await b.close();
console.log('done');
