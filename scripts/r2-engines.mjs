// smoke: boot → deck → link → gif export → save, on each engine
import { chromium, firefox, webkit } from 'playwright';
const BASE = 'http://localhost:5388';
const out = process.env.OUT;
for (const [name, eng] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  try {
    const b = await eng.launch();
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', (e) => console.log(`[${name}] PAGEERR`, e.message));
    p.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] CONSOLE`, m.text().slice(0, 200)); });
    await p.goto(BASE + '/miguel');
    await p.waitForTimeout(800);
    await p.keyboard.press(' ');
    await p.waitForTimeout(2500);
    await p.keyboard.press('e');
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/eng-${name}-deck.png` });
    await p.click('button.key:has-text("⧉ LINK")');
    await p.waitForTimeout(300);
    const linkNote = await p.locator('.dnote').last().textContent();
    const url = p.url();
    await p.click('button.key:has-text("◉ GIF")');
    await p.waitForSelector('button.key:has-text("SAVE")', { timeout: 60000 });
    const dl = p.waitForEvent('download', { timeout: 30000 });
    await p.click('button.key:has-text("SAVE")');
    const d = await dl;
    const f = `${out}/eng-${name}.gif`;
    await d.saveAs(f);
    const { statSync } = await import('fs');
    console.log(`[${name}] OK hash=${url.includes('#g2.')} note="${linkNote}" gif=${statSync(f).size}B`);
    await b.close();
  } catch (e) {
    console.log(`[${name}] FAIL ${e.message.split('\n')[0]}`);
  }
}
console.log('DONE');
