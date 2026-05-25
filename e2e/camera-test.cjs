// Test: minimal version of our game scene
const puppeteer = require('puppeteer');
const { setTimeout: sleep } = require('timers/promises');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', err => console.log('[ERROR]', err.message));
  page.on('console', msg => console.log(`[${msg.type()}]`, msg.text().substring(0, 200)));
  
  // Create a test page that uses our ACTUAL built app but with a simple scene
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>body{margin:0;overflow:hidden;background:#000}#root{width:100vw;height:100vh}</style>
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
    </head>
    <body>
    <div id="root"></div>
    <script type="module">
      import React, { useRef } from 'react';
      import { createRoot } from 'react-dom/client';
      import { Canvas, useFrame, useThree } from '@react-three/fiber';
      import * as THREE from 'three';

      function CameraController() {
        const { camera } = useThree();
        useFrame(() => {
          camera.position.set(3, 1.7, 4);
          const lookTarget = new THREE.Vector3(3, 1.7, -6);
          camera.lookAt(lookTarget);
          camera.updateMatrixWorld(true);
        });
        return null;
      }

      function Scene() {
        return (
          <>
            <color attach="background" args={["#884422"]} />
            <fog attach="fog" args={["#884422", 8, 50]} />
            <ambientLight intensity={0.4} color="#ffffff" />
            <pointLight position={[5, 3, 5]} intensity={2} distance={25} color="#ff8844" />
            
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, 0, 10]}>
              <planeGeometry args={[30, 30]} />
              <meshStandardMaterial color={0x554433} />
            </mesh>
            
            {/* Wall in front */}
            <mesh position={[3, 2, -2]}>
              <boxGeometry args={[8, 4, 1]} />
              <meshStandardMaterial color={0x665544} />
            </mesh>
            
            {/* Box enemy */}
            <mesh position={[5, 1, 3]}>
              <boxGeometry args={[1, 2, 1]} />
              <meshStandardMaterial color={0x886622} emissive={0x221100} emissiveIntensity={0.3} />
            </mesh>
            
            <CameraController />
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
      console.log('Test scene rendered!');
    </script>
    </body>
    </html>
  `);
  
  await sleep(4000);
  await page.screenshot({ path: 'e2e/camera-test.png', fullPage: true });
  console.log('Camera test screenshot saved');
  
  await browser.close();
})();