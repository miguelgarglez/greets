import { chromium } from 'playwright';
const out = process.env.OUT;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto('http://localhost:5387/miguel');
await p.waitForTimeout(1000);
await p.keyboard.press('Space');
await p.waitForTimeout(2600);
await p.keyboard.press('e');
await p.waitForTimeout(500);
// make a wild config: jungle + copper only + silk font + bounce + tune c + turbo
await p.click('button.key:has-text("JUNGLE")');
await p.click('button.key:has-text("PLASMA")'); // toggle off
await p.click('button.key:has-text("BLITTER")'); // toggle off
await p.click('button.key:has-text("COPPER")'); // toggle on
await p.click('button.key:has-text("SILK")');
await p.click('button.key:has-text("TURBO")');
await p.click('button.key:has-text("♪C")');
await p.fill('input[aria-label="greets list"]', 'MUM, COGNITION, THE DRIVE');
await p.waitForTimeout(500);
const url = p.url();
console.log('URL:', url);
await p.screenshot({ path: out + '/drive-deck.png' });
// close deck, watch the demo with new settings
await p.keyboard.press('Escape');
await p.waitForTimeout(1400);
await p.screenshot({ path: out + '/drive-live.png' });
// permalink roundtrip: fresh page from the hash must reproduce it
const p2 = await b.newPage({ viewport: { width: 1440, height: 900 } });
p2.on('pageerror', (e) => console.log('P2ERR', e.message));
await p2.goto(url);
await p2.waitForTimeout(1200);
await p2.keyboard.press('Space');
await p2.waitForTimeout(6000);
await p2.screenshot({ path: out + '/drive-permalink.png' });
await b.close();
console.log('DONE');
