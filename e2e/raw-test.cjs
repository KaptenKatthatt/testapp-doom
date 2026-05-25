// Minimal Three.js test - does R3F render at all?
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Create a minimal HTML with a basic Three.js scene (no R3F)
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><style>body{margin:0;overflow:hidden;background:#000}</style></head>
    <body>
    <script type="module">
      import * as THREE from 'https://esm.sh/three@0.177.0';
      
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x884422);
      
      const camera = new THREE.PerspectiveCamera(75, 1280/720, 0.1, 100);
      camera.position.set(0, 2, 5);
      camera.lookAt(0, 0, 0);
      
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(1280, 720);
      document.body.appendChild(renderer.domElement);
      
      // Add a box
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);
      
      // Add light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const pointLight = new THREE.PointLight(0xffffff, 1, 100);
      pointLight.position.set(5, 5, 5);
      scene.add(pointLight);
      
      renderer.render(scene, camera);
      console.log('Rendered!');
    </script>
    </body>
    </html>
  `);
  
  await sleep(3000);
  
  // Check pixels
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { error: 'no gl' };
    
    const data = new Uint8Array(4);
    gl.readPixels(Math.floor(canvas.width/2), Math.floor(canvas.height/2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return { center: { r: data[0], g: data[1], b: data[2], a: data[3] } };
  });
  
  console.log('Raw Three.js center pixel:', JSON.stringify(result));
  await page.screenshot({ path: 'e2e/raw-threejs.png' });
  
  await browser.close();
})();