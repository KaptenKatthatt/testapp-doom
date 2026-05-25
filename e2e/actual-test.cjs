// Test the actual game app with Puppeteer
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  // Capture console
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${msg.type()}]`, msg.text());
    }
  });
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await sleep(1000);
  await page.screenshot({ path: 'e2e/actual-start.png', fullPage: true });
  console.log('Start screen done');
  
  // Click to start
  await page.click('body');
  await sleep(3000);
  await page.screenshot({ path: 'e2e/actual-game.png', fullPage: true });
  console.log('Game screenshot done');
  
  // Walk forward
  await page.keyboard.down('KeyW');
  await sleep(2000);
  await page.keyboard.up('KeyW');
  await sleep(500);
  await page.screenshot({ path: 'e2e/actual-walking.png', fullPage: true });
  console.log('Walking screenshot done');
  
  // Look right a bit
  // Can't easily do mouse look in headless, so just walk more
  await page.keyboard.down('KeyD');
  await sleep(1000);
  await page.keyboard.up('KeyD');
  await sleep(500);
  await page.screenshot({ path: 'e2e/actual-strafing.png', fullPage: true });
  console.log('Strafing screenshot done');
  
  await browser.close();
})();