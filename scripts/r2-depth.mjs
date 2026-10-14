// depth check — three distinct cracktros end-to-end: deck edits → export → evidence
import { chromium } from 'playwright';
import { mkdirSync, statSync } from 'fs';
const BASE = 'http://localhost:5388';
const out = process.env.OUT + '/depth';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('CON', m.text().slice(0, 160)); });

const fill = (ph, val) => p.fill(`input[placeholder="${ph}"]`, val);
const boot = async (name) => { await p.goto(`${BASE}/${name}`); await p.waitForTimeout(800); await p.keyboard.press(' '); await p.waitForTimeout(2600); };
const deck = async () => { await p.keyboard.press('e'); await p.waitForTimeout(500); };
async function saveExport(tag, ext) {
  await p.click(`button.key:has-text("${ext === 'gif' ? '◉ GIF' : '▶ FILM'}")`);
  await p.waitForSelector('button.key:has-text("SAVE")', { timeout: 120000 });
  const dl = p.waitForEvent('download', { timeout: 30000 });
  await p.click('button.key:has-text("SAVE")');
  const f = `${out}/${tag}.${ext}`;
  await (await dl).saveAs(f);
  await p.click('button.key[title="dismiss"]').catch(() => {});
  return statSync(f).size;
}

// A — 1994 rig, custom scrolltext + credits → GIF
await boot('aptiva'); await deck();
await p.click('button.key:has-text("1994")');
await fill('SCROLLTEXT · AUTO', 'APTIVA WARES DIVISION IS BACK ON THE BBS +++ UPLOADED FROM A 486 IN THE BASEMENT +++');
await fill('CREDITS · GREETS DEV', 'BASEMENT DIVISION 94');
await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/a-1994.png` });
console.log('A 1994 gif', await saveExport('a-1994', 'gif'), 'B', p.url());

// B — rename via deck (aptiva→nocturne), DEEP rig, greetz + scrolltext → video
await fill('APTIVA', 'nocturne');
await p.keyboard.press('Enter');
await p.waitForTimeout(1200);
console.log('rename url', p.url());
await p.keyboard.press(' ');
await p.waitForTimeout(2600);
await deck();
await p.click('button.key:has-text("DEEP")');
await fill('GREETZ · AUTO', 'MOON UNIT, SIGNAL, VHS GHOST');
await fill('SCROLLTEXT · AUTO', 'SIGNAL LOST SOMEWHERE BETWEEN TAPES +++ REWIND +++ PLAY +++');
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/b-deep.png` });
console.log('B deep mp4', await saveExport('b-deep', 'mp4'), 'B', p.url());

// C — fresh name, ACID rig, all three texts → GIF
await boot('zapdash'); await deck();
await p.click('button.key:has-text("ACID")');
await fill('SCROLLTEXT · AUTO', 'ZAPDASH ACID CREW SLIDES SIDEWAYS +++ NO BRAKES +++');
await fill('GREETZ · AUTO', 'ZAP, DASH, HYPERDRIVE');
await fill('CREDITS · GREETS DEV', 'ACID HOUSE 93');
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/c-acid.png` });
console.log('C acid gif', await saveExport('c-acid', 'gif'), 'B', p.url());
await b.close();
console.log('DONE');
