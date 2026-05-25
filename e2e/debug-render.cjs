// Debug: check if Three.js scene renders anything
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  // Capture console logs
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}]`, msg.text()));
  page.on('pageerror', err => console.log(`[ERROR]`, err.message));
  
  await page.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await sleep(500);
  
  console.log('Start screen visible');
  await page.click('body');
  await sleep(3000);
  
  // Deep inspection of Three.js
  const debug = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    
    // Check React root
    const root = document.getElementById('root');
    const rootHTML = root?.innerHTML?.substring(0, 300);
    
    // Check canvas dimensions
    const rect = canvas.getBoundingClientRect();
    
    // Try to access Three.js internal state via __reactFiber or similar
    const fiberKey = Object.keys(canvas).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    
    // Check WebGL context
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'no webgl', rect, rootHTML };
    
    // Check viewport
    const viewport = gl.getParameter(gl.VIEWPORT);
    const clearColor = gl.getParameter(gl.COLOR_CLEAR_VALUE);
    const depthRange = gl.getParameter(gl.DEPTH_RANGE);
    
    // Check if any rendering actually happened
    gl.finish();
    
    // Read some pixels at different positions
    const positions = [
      { name: 'center', x: Math.floor(canvas.width/2), y: Math.floor(canvas.height/2) },
      { name: 'topLeft', x: 10, y: 10 },
      { name: 'bottomCenter', x: Math.floor(canvas.width/2), y: Math.floor(canvas.height*0.8) },
    ];
    
    const pixels = {};
    for (const pos of positions) {
      const data = new Uint8Array(4);
      gl.readPixels(pos.x, pos.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
      pixels[pos.name] = { r: data[0], g: data[1], b: data[2], a: data[3] };
    }
    
    // Check if depth buffer has been written to
    const depthData = new Float32Array(1);
    // Can't easily read depth buffer in WebGL
    
    return {
      rect: { w: rect.width, h: rect.height },
      canvasSize: { w: canvas.width, h: canvas.height },
      fiberKey,
      viewport,
      clearColor: Array.from(clearColor),
      depthRange: Array.from(depthRange),
      pixels,
      rendererInfo: gl.getParameter(gl.RENDERER),
      vendorInfo: gl.getParameter(gl.VENDOR),
      rootHTMLLength: root?.innerHTML?.length,
    };
  });
  
  console.log('Debug info:', JSON.stringify(debug, null, 2));
  
  await browser.close();
})();