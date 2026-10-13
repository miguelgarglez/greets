import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5311/ALESSANDRA-VOGEL');
await p.waitForTimeout(1800);
await p.screenshot({ path: 'explore/shots/longname.png' });
await p.close();
await b.close();
