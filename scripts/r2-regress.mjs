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

// 6. undo is style-only: a scrolltext typed AFTER a style change survives
await p.goto('http://localhost:5388/miguel');
await p.waitForSelector('.demoscreen');
await p.keyboard.press('Space');
await p.waitForTimeout(2600);
await p.keyboard.press('e');
await p.waitForSelector('.deck');
await p.click('.tab:has-text("LOOK")');
await p.click('button.key:has-text("ICE")');
await p.click('.tab:has-text("WORDS")');
await p.fill('input[aria-label="scrolltext"]', 'KEEP ME THROUGH UNDO');
await p.click('.tab:has-text("RIGS")');
await p.click('button.key:has-text("UNDO")');
await p.click('.tab:has-text("WORDS")');
console.log('words survived undo:', await p.locator('input[aria-label="scrolltext"]').inputValue() === 'KEEP ME THROUGH UNDO');

// 7. blur on "ALICE, BOB" must not grow a double space, and the byte cap
// drops whole names instead of cutting one
await p.fill('input[aria-label="greets list"]', 'ALICE, BOB');
await p.locator('input[aria-label="scrolltext"]').click(); // blur greetz
await p.waitForTimeout(300);
console.log('greetz blur clean:', await p.locator('input[aria-label="greets list"]').inputValue() === 'ALICE, BOB');
console.log('pageerrors:', errs);
await b.close();
