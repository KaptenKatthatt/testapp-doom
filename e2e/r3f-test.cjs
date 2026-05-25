// Minimal R3F test
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>body{margin:0;overflow:hidden}</style>
    </head>
    <body>
    <div id="root"></div>
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@19.1.0",
        "react-dom/client": "https://esm.sh/react-dom@19.1.0/client",
        "react/jsx-runtime": "https://esm.sh/react@19.1.0/jsx-runtime",
        "three": "https://esm.sh/three@0.177.0",
        "@react-three/fiber": "https://esm.sh/@react-three/fiber@9?deps=react@19.1.0,three@0.177.0"
      }
    }
    </script>
    <script type="module">
      import React, { useRef } from 'react';
      import { createRoot } from 'react-dom/client';
      import { Canvas, useFrame } from '@react-three/fiber';
      import * as THREE from 'three';

      function Box() {
        const ref = useRef();
        useFrame((state, delta) => {
          if (ref.current) {
            ref.current.rotation.y += delta;
          }
        });
        return (
          <mesh ref={ref} position={[0, 0, 0]}>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="red" />
          </mesh>
        );
      }

      function Scene() {
        return (
          <>
            <color attach="background" args={["#884422"]} />
            <ambientLight intensity={0.5} />
            <pointLight position={[5, 5, 5]} intensity={1} />
            <Box />
          </>
        );
      }

      function App() {
        return (
          <Canvas gl={{ alpha: false, antialias: true }} camera={{ fov: 75, near: 0.1, far: 100 }}>
            <Scene />
          </Canvas>
        );
      }

      createRoot(document.getElementById('root')).render(<App />);
      console.log('R3F rendered!');
    </script>
    </body>
    </html>
  `);
  
  await sleep(5000);
  await page.screenshot({ path: 'e2e/r3f-test.png', fullPage: true });
  console.log('R3F test screenshot saved');
  
  await browser.close();
})();