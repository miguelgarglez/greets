import { chromium } from 'playwright';
const base = 'http://localhost:5311/explore/index.html';
const b = await chromium.launch();
for (const [v, name] of [['a','MIGUEL'],['b','MIGUEL'],['c','MIGUEL']]) {
  for (const [w,h,tag] of [[1440,900,'d'],[390,844,'m']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto(`${base}?v=${v}&n=${name}`);
    await p.waitForTimeout(2600);
    await p.screenshot({ path: `explore/shots/${v}-${tag}.png` });
    await p.close();
  }
}
await b.close();
