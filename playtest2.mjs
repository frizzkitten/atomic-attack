/* Headless playthrough of LEVEL 2. Screenshots each beat, fails on any JS error. */
import { chromium } from 'playwright';
const dir = '/Users/frizzkitten/code/danny-game';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1000,height:640} });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type()==='error') errors.push('CONSOLE: ' + m.text()); });
await page.goto('file://' + dir + '/game.html');

const shot = n => page.screenshot({ path: `${dir}/shots/L2-${n}.png` });
const wait = ms => page.waitForTimeout(ms);
async function clearDialogue(max=14){
  for (let i=0;i<max;i++){ if(!(await page.$('#dlg'))) return; await page.click('#dlg'); await wait(150); }
}
async function step(l, fn){ await fn(); await shot(l); console.log('  ✓ '+l + (errors.length?`  [${errors.length} err]`:'')); }

console.log('LEVEL 2 playthrough...');

await step('01-title', async()=>wait(500));
await step('02-create', async()=>{ await page.click('button:has-text("THE SPACECRAFT")'); await wait(400); });
await step('03-intro', async()=>{
  await page.fill('input[type=text]','Danny');
  await page.click('button:has-text("LET")'); await wait(500);
});
await step('04-runaway', async()=>{ await clearDialogue(); await wait(600); });
await step('05-dodging', async()=>{
  // actually try to dodge: jump around, keep moving
  const t0=Date.now();
  while(Date.now()-t0 < 22000){
    const d = Math.random()<0.5?'ArrowLeft':'ArrowRight';
    await page.keyboard.down(d); await wait(400); await page.keyboard.up(d);
    if(!(await page.$('canvas'))) break;
    const st = await page.evaluate(()=>({hp:S.hp, dodged:S.beamsDodged, dlg:!!document.querySelector('#dlg'), panel:document.querySelector('.panel')?.textContent||''}));
    if(st.dlg||st.panel) break;
  }
  console.log('    beams dodged:', await page.evaluate(()=>S.beamsDodged), 'hp:', await page.evaluate(()=>S.hp));
});
await step('06-firsttry', async()=>{
  await page.evaluate(()=>{ S.hp=S.maxHp; sceneFirstTry(); }); await wait(400);
  await clearDialogue(); await wait(500);
});
await step('07-firstshot-fired', async()=>{
  await page.click('button:has-text("FIRE")'); await wait(2600);
});
await step('08-school', async()=>{ await clearDialogue(); await wait(600); });
await step('09-school-wrong', async()=>{
  await page.click('button:has-text("Dinosaurs")'); await wait(500);
});
await step('10-school-right', async()=>{
  await page.click('button:has-text("ATTACKING")'); await wait(600);
});
await step('11-gather', async()=>{ await clearDialogue(); await wait(600); });
await step('12-gathering', async()=>{
  // walk right collecting in order, jumping for the high one
  for(let i=0;i<40;i++){
    await page.keyboard.down('ArrowRight'); await wait(230);
    await page.keyboard.press('ArrowUp'); await wait(200);
    const got = await page.evaluate(()=>S.partsFound);
    if(got>=3) break;
  }
  await page.keyboard.up('ArrowRight');
  console.log('    parts found:', await page.evaluate(()=>S.partsFound));
});
await step('13-slingshot', async()=>{
  await wait(1600);                 // gather -> intro dialogue has a delay
  await clearDialogue();
  await page.waitForFunction(()=>typeof window.__sling==='function', {timeout:8000});
  await wait(400);
});
await step('14-aiming', async()=>{
  // aim deliberately, the way a player using the dotted preview would
  const TARGET=1.10;
  for(let shot=0; shot<20; shot++){
    for(let i=0;i<40;i++){
      const a = await page.evaluate(()=>window.__sling().angle);
      if(Math.abs(a-TARGET)<0.04) break;
      const k = a<TARGET?'ArrowUp':'ArrowDown';
      await page.keyboard.down(k); await wait(45); await page.keyboard.up(k);
    }
    await page.keyboard.down('Space'); await wait(1050); await page.keyboard.up('Space');
    await wait(1400);
    if(await page.evaluate(()=>S.shipHits)>=3) break;
  }
  console.log('    ship hits:', await page.evaluate(()=>S.shipHits), 'shots:', await page.evaluate(()=>S.shotsFired));
});
await step('15-crash', async()=>{ await wait(3200); });
await step('16-homeless', async()=>{ await wait(1500); await clearDialogue(); await wait(500); });
await step('17-rage', async()=>{ await clearDialogue(); await wait(1200); });
await step('18-surviving', async()=>{
  const t0=Date.now();
  while(Date.now()-t0<26000){
    const d = Math.random()<0.5?'ArrowLeft':'ArrowRight';
    await page.keyboard.down(d); await wait(350); await page.keyboard.up(d);
    const st = await page.evaluate(()=>({hp:S.hp, txt:document.querySelector('.panel')?.textContent||''}));
    if(st.txt) break;
  }
  console.log('    survived? hp:', await page.evaluate(()=>S.hp));
});
await step('19-win', async()=>{ await wait(1200); });

await browser.close();
console.log('\n==================================');
if(errors.length){ console.log('❌ '+errors.length+' ERROR(S):'); [...new Set(errors)].forEach(e=>console.log('   '+e)); process.exit(1); }
else console.log('✅ Level 2 playthrough, zero runtime errors.');
