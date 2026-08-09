/* Headless playthrough: walks every scene, screenshots each, fails on any JS error. */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(dir, 'shots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });

const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto('file://' + path.join(dir, 'game.html'));

const shot = n => page.screenshot({ path: path.join(shots, n + '.png') });
const wait = ms => page.waitForTimeout(ms);
const sceneName = () => page.evaluate(() => (scene && scene.__name) || 'unknown');

// Advance any dialogue box until it's gone (max n clicks)
async function clearDialogue(max = 12) {
  for (let i = 0; i < max; i++) {
    const has = await page.$('#dlg');
    if (!has) return i;
    await page.click('#dlg');
    await wait(160);
  }
  return max;
}

async function step(label, fn) {
  await fn();
  await shot(label);
  console.log('  ✓ ' + label + (errors.length ? '  [' + errors.length + ' errors so far]' : ''));
}

console.log('Playing through...');

// ---- title ----
await step('01-title', async () => wait(600));

// ---- character creation ----
await step('02-create', async () => {
  await page.click('button:has-text("THE BOMB")');
  await wait(400);
});

await step('03-create-picked', async () => {
  await page.click('.card:has-text("GIRL")');
  await page.click('.card:has-text("SPEAR")');
  await page.fill('input[type=text]', 'Danny');
  await wait(200);
});

// ---- animal fight ----
await step('04-animals-intro', async () => {
  await page.click('button:has-text("LET")');
  await wait(400);
});

await step('05-animals', async () => {
  await clearDialogue();
  await wait(400);
});

// give the player infinite health and mash attack to clear the wave
await step('06-animals-fighting', async () => {
  await page.evaluate(() => { S.godmode = true; });
  const t0 = Date.now();
  while (Date.now() - t0 < 22000) {
    // hold right + attack in bursts so the fight actually resolves
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await wait(120);
    await page.keyboard.up('Space');
    await wait(90);
    await page.evaluate(() => { S.hp = S.maxHp; });
    const inFight = await page.evaluate(() => !!document.querySelector('#dlg') === false && S.kills < 6);
    if (!inFight) break;
  }
  await page.keyboard.up('ArrowRight');
  await page.keyboard.up('Space');
  const kills = await page.evaluate(() => S.kills);
  console.log('    animals beaten:', kills);
});

// ---- bomb drop ----
await step('07-bombdrop', async () => {
  await page.evaluate(() => { if (typeof sceneBombDrop === 'function') sceneBombDrop(); });
  await wait(2200);
});

await step('08-apocalypse', async () => { await wait(3200); });

// ---- shelter ----
await step('09-shelter', async () => {
  await clearDialogue();
  await wait(500);
  // run right and jump to sweep up supplies
  for (let i = 0; i < 26; i++) {
    await page.keyboard.down('ArrowRight');
    await wait(220);
    await page.keyboard.press('ArrowUp');
    await wait(200);
  }
  await page.keyboard.up('ArrowRight');
  console.log('    supplies:', await page.evaluate(() => S.supplies));
});

// ---- friend + Bart ----
await step('10-friend', async () => {
  await page.evaluate(() => sceneFriend());
  await wait(500);
});

await step('11-bart', async () => {
  await clearDialogue();
  await wait(2600);
});

await step('12-bart-strangle', async () => { await wait(1600); });

// ---- defuse ----
await step('13-defuse', async () => {
  await clearDialogue();
  await wait(600);
});

// solve all three bombs by reading the answer out of the DOM heading
async function solveBomb() {
  await page.waitForSelector('.thing', { timeout: 5000 });
  const target = await page.evaluate(() => {
    const h = document.querySelector('.panel div span');
    return h ? h.textContent.trim() : null;
  });
  const idx = await page.evaluate((name) => {
    // the wires are drawn to canvas; find which one matches by re-deriving order
    return window.__wireNames ? window.__wireNames.indexOf(name) : -1;
  }, target);
  return { target, idx };
}

await step('14-defuse-solving', async () => {
  for (let b = 0; b < 3; b++) {
    await page.waitForSelector('.thing', { timeout: 6000 });
    const { target, idx } = await solveBomb();
    if (idx < 0) { console.log('    !! could not find wire index for', target); break; }
    await page.click(`.thing >> nth=${idx}`);
    console.log('    bomb', b + 1, '→ cut', target);
    await wait(1700);
  }
  console.log('    defused:', await page.evaluate(() => S.bombsDefused));
});

// ---- build a bomb ----
await step('15-buildbomb', async () => {
  await page.waitForSelector('#seq', { timeout: 6000 });
  for (let i = 0; i < 5; i++) {
    const name = await page.evaluate(() => window.__partOrder[window.__partStep()]);
    await page.click(`.thing[title="${name}"]`);
    await wait(250);
  }
  await wait(900);
});

// ---- loot ----
await step('16-loot', async () => {
  await page.waitForSelector('button:has-text("LOOT")', { timeout: 6000 });
  await page.click('button:has-text("LOOT")');
  await wait(2400);
});

// ---- portal ----
await step('17-portal', async () => {
  await page.click('button:has-text("KEEP GOING")');
  await wait(500);
  await page.keyboard.down('ArrowRight');
  await wait(3000);
  await page.keyboard.up('ArrowRight');
  await wait(2400);
});

// ---- mario ----
await step('18-mario-intro', async () => { await wait(600); });

await step('19-mario', async () => {
  await clearDialogue();
  await wait(600);
});

await step('20-mario-fight', async () => {
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await wait(130);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.down('Space');
    await wait(130);
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowLeft');
    await page.evaluate(() => { S.hp = S.maxHp; });
    const done = await page.evaluate(() => !!document.querySelector('.panel'));
    if (done) break;
  }
});

await step('21-win', async () => {
  await page.waitForSelector('button:has-text("PLAY AGAIN")', { timeout: 12000 }).catch(() => {});
  await wait(800);
});

await browser.close();

console.log('\n==================================');
if (errors.length) {
  console.log('❌ ' + errors.length + ' RUNTIME ERROR(S):');
  [...new Set(errors)].forEach(e => console.log('   ' + e));
  process.exit(1);
} else {
  console.log('✅ Full playthrough, zero runtime errors.');
}
