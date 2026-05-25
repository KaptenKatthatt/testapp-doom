// Test our ACTUAL app with better logging
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warning' || text.includes('Three') || text.includes('render') || text.includes('frame')) {
      console.log(`[${msg.type()}]`, text.substring(0, 300));
    }
  });
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await sleep(1000);
  await page.screenshot({ path: 'e2e/real-start.png', fullPage: true });
  
  // Click to start
  await page.click('body');
  await sleep(4000);
  await page.screenshot({ path: 'e2e/real-game.png', fullPage: true });
  
  // Check if canvas has content
  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const rect = canvas.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      rectWidth: rect.width,
      rectHeight: rect.height,
      style: canvas.style.cssText,
      parentTag: canvas.parentElement?.tagName,
      dataEngine: canvas.getAttribute('data-engine'),
    };
  });
  console.log('Canvas info:', JSON.stringify(canvasInfo, null, 2));
  
  // Walk forward
  await page.keyboard.down('KeyW');
  await sleep(2000);
  await page.keyboard.up('KeyW');
  await sleep(500);
  await page.screenshot({ path: 'e2e/real-walking.png', fullPage: true });
  
  await browser.close();
})();