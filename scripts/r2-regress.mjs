import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5388/');
await p.waitForTimeout(1000);
await p.keyboard.type('miguel');
await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
await p.keyboard.press('Space');
await p.waitForTimeout(2800);
await p.keyboard.press('e');
await p.waitForTimeout(500);
// 1. greetz typing keeps commas
await p.click('.tab:has-text("WORDS")');
const g = p.locator('input[aria-label="greets list"]');
await g.click();
await g.pressSequentially('ALICE,BOB', { delay: 30 });
await p.waitForTimeout(300);
console.log('greetz draft:', await g.inputValue());
// 2. tune OFF -> A round trip
await p.click('.tab:has-text("TUNE")');
await p.click('button.key:has-text("OFF")');
await p.waitForTimeout(400);
await p.click('button.key:has-text("♪B")');
await p.waitForTimeout(400);
console.log('tune ok, no err so far:', errs.length === 0);
// 3. Escape while input focused closes the deck
await p.click('.tab:has-text("WORDS")');
await p.locator('input[aria-label="scrolltext"]').click();
await p.keyboard.press('Escape');
await p.waitForTimeout(400);
console.log('deck closed:', await p.locator('.deck').count() === 0);
// 4. rename round trips and doesn't leak audio contexts
await p.keyboard.press('e');
await p.waitForTimeout(400);
await p.click('.tab:has-text("WORDS")');
await p.fill('input[aria-label="name"]', 'zelda');
await p.keyboard.press('Enter');
await p.waitForTimeout(1500);
console.log('url after rename:', p.url());
await p.keyboard.press('Space');
await p.waitForTimeout(2000);
// 5. back to landing
await p.goBack(); // /miguel
await p.waitForTimeout(600);
console.log('back to /miguel phase preboot visible:', await p.locator('canvas.demoscreen').count() === 1);
await p.goBack(); // /
await p.waitForTimeout(600);
console.log('landing input back:', await p.locator('.nameinput').count() === 1);
console.log('pageerrors:', errs);
await b.close();
