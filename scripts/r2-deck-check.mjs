// quick visual check of the tabbed deck: desktop + mobile, each tab,
// preview pinning, and an export result chip
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5388';
const OUT = new URL('../docs/check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/miguel`);
await page.waitForSelector('.demoscreen');
await page.waitForTimeout(700);
await page.keyboard.press('Space'); // boot
await page.waitForTimeout(2600);    // poweron + intro
await page.keyboard.press('e');
await page.waitForSelector('.deck');
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + 'd1-rigs.png' });

// WORDS tab: scroller should pin
await page.click('.tab:has-text("WORDS")');
await page.waitForTimeout(400);
await page.fill('[aria-label="scrolltext"]', 'DECK TWO LOOKS SHARPER +++ ');
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + 'd2-words.png' });

// greetz field → greetz roll pinned
await page.click('[aria-label="greets list"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT + 'd3-greetz.png' });

// LOOK tab
await page.click('.tab:has-text("LOOK")');
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + 'd4-look.png' });

// MOTION
await page.click('.tab:has-text("MOTION")');
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + 'd5-motion.png' });

// export → result chip with thumb
await page.click('button:has-text("GIF")');
await page.waitForSelector('.resthumb', { timeout: 30000 });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + 'd6-result.png' });
console.log('desktop done');

// desktop geometry at 1440x900: the bay must not eat the tube
const geo = await page.evaluate(() => {
  const tube = document.querySelector('.tube').getBoundingClientRect();
  const deck = document.querySelector('.deck').getBoundingClientRect();
  const tab = document.querySelector('.tab').getBoundingClientRect();
  const deckx = document.querySelector('.deckx').getBoundingClientRect();
  const dnote = getComputedStyle(document.querySelector('.dnote'));
  return { tubeBottom: tube.bottom, deckTop: deck.top, tabH: tab.height, deckxH: deckx.height, dnotePx: dnote.fontSize };
});
console.log('desktop geo', geo);
if (geo.deckTop <= geo.tubeBottom) throw new Error(`deck overlaps tube: ${JSON.stringify(geo)}`);

// mobile
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await mob.goto(`${BASE}/zapdash`);
await mob.waitForSelector('.demoscreen');
await mob.tap('.demoscreen'); // boot via touch
await mob.waitForTimeout(3000);
await mob.tap('.fab');
await mob.waitForSelector('.deck');
await mob.waitForTimeout(600);
await mob.screenshot({ path: OUT + 'm1-rigs.png' });
await mob.tap('.tab:has-text("WORDS")');
await mob.waitForTimeout(500);
await mob.screenshot({ path: OUT + 'm2-words.png' });
await mob.tap('.tab:has-text("MOTION")');
await mob.waitForTimeout(500);
await mob.screenshot({ path: OUT + 'm3-motion.png' });
// measure key heights + tube rect
const dims = await mob.evaluate(() => {
  const key = document.querySelector('.deckbody .key').getBoundingClientRect();
  const tube = document.querySelector('.tube').getBoundingClientRect();
  const deck = document.querySelector('.deck').getBoundingClientRect();
  const tab = document.querySelector('.tab').getBoundingClientRect();
  return { keyH: key.height, tabH: tab.height, tubeTop: tube.top, tubeH: tube.height, deckTop: deck.top, gap: deck.top - tube.bottom, deckBottom: deck.bottom, vh: innerHeight };
});
console.log('mobile dims', dims);
if (dims.keyH < 44 || dims.tabH < 44) throw new Error(`touch target under 44px: ${JSON.stringify(dims)}`);
if (dims.deckTop <= dims.tubeTop + dims.tubeH - 4) throw new Error(`deck overlaps tube: ${JSON.stringify(dims)}`);
if (dims.gap > 40) throw new Error(`dead band under tube: ${JSON.stringify(dims)}`);
if (dims.deckBottom < dims.vh - 8) throw new Error(`deck does not reach bottom: ${JSON.stringify(dims)}`);
await browser.close();
