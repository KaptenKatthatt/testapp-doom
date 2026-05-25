// Check if Three.js has rendered ANY geometry
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await sleep(500);
  await page.click('body');
  await sleep(3000);
  
  // Walk forward a bit
  await page.keyboard.down('KeyW');
  await sleep(500);
  await page.keyboard.up('KeyW');
  await sleep(500);
  
  const result = await page.evaluate(() => {
    // Check if React Three Fiber has mounted
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'no gl' };
    
    // Check drawing buffer
    const drawingBufferWidth = gl.drawingBufferWidth;
    const drawingBufferHeight = gl.drawingBufferHeight;
    
    // Read ALL pixels
    const data = new Uint8Array(drawingBufferWidth * drawingBufferHeight * 4);
    gl.readPixels(0, 0, drawingBufferWidth, drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data);
    
    let nonBlack = 0;
    let totalPixels = drawingBufferWidth * drawingBufferHeight;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 2 || data[i+1] > 2 || data[i+2] > 2) nonBlack++;
    }
    
    // Check specific regions
    // Bottom strip (should have HUD)
    const hudStart = Math.floor(drawingBufferHeight * 0.85) * drawingBufferWidth * 4;
    let hudNonBlack = 0;
    for (let i = hudStart; i < data.length; i += 4) {
      if (data[i] > 2 || data[i+1] > 2 || data[i+2] > 2) hudNonBlack++;
    }
    const hudTotalPixels = drawingBufferWidth * Math.floor(drawingBufferHeight * 0.15);
    
    return {
      drawingBufferWidth,
      drawingBufferHeight,
      totalNonBlack: nonBlack,
      totalPixels,
      percentNonBlack: (nonBlack / totalPixels * 100).toFixed(2) + '%',
      hudNonBlack,
      hudTotalPixels,
      hudPercent: (hudNonBlack / hudTotalPixels * 100).toFixed(2) + '%',
    };
  });
  
  console.log('Full screen check:', JSON.stringify(result, null, 2));
  
  await page.screenshot({ path: 'e2e/puppet-swiftshader.png', fullPage: true });
  console.log('Screenshot saved');
  
  await browser.close();
})();