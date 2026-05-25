// Puppeteer script to take real screenshots with GPU rendering
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  console.log('Navigating to game...');
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await sleep(1000);
  
  // Screenshot start screen
  console.log('Taking start screen screenshot...');
  await page.screenshot({ path: 'e2e/puppet-start.png', fullPage: true });
  
  // Click to start game
  console.log('Clicking to start...');
  await page.click('body');
  await sleep(3000);
  
  // Screenshot after starting
  console.log('Taking game screenshot...');
  await page.screenshot({ path: 'e2e/puppet-game.png', fullPage: true });
  
  // Check rendering stats
  const stats = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    if (!gl) return { error: 'no webgl' };
    
    // Force render
    gl.finish();
    
    let nonBlack = 0;
    let total = 0;
    const w = Math.min(canvas.width, 200);
    const h = Math.min(canvas.height, 200);
    const data = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    for (let i = 0; i < data.length; i += 4) {
      total++;
      if (data[i] > 2 || data[i+1] > 2 || data[i+2] > 2) nonBlack++;
    }
    
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      nonBlackPixels: nonBlack,
      totalPixels: total,
      percentNonBlack: (nonBlack / total * 100).toFixed(1) + '%',
      renderer: gl.getParameter(gl.RENDERER),
    };
  });
  
  console.log('Rendering stats:', JSON.stringify(stats, null, 2));
  
  // Try pressing W
  console.log('Pressing W for 2 seconds...');
  await page.keyboard.down('KeyW');
  await sleep(2000);
  await page.keyboard.up('KeyW');
  await sleep(500);
  await page.screenshot({ path: 'e2e/puppet-walking.png', fullPage: true });
  
  await browser.close();
  console.log('Done!');
})();