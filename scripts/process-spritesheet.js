import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

function printHelp() {
  console.log(`
Usage:
  node scripts/process-spritesheet.js <input-path> <output-path> [options]

Arguments:
  input-path    Path to the raw input spritesheet (e.g. monster-images/horned-demon.png)
  output-path   Path to save the processed transparent PNG (e.g. public/horneddemon.png)

Options:
  --bg-type     "white" or "checkerboard" (default: "white")
  --min-size    Minimum size of isolated background pockets to clear (default: 10)
  --bg-pct      Minimum fraction of background colors in isolated component to clear (default: 0.80)
  --no-unblend  Disable edge color un-blending (halos removal)

Example:
  node scripts/process-spritesheet.js monster-images/horned-demon.png public/horneddemon.png --bg-type white --min-size 10
  node scripts/process-spritesheet.js monster-images/imp-sprite.png public/bloodimp.png --bg-type checkerboard --min-size 4 --bg-pct 0.60
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h') || args.length < 2) {
    printHelp();
    process.exit(0);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1]);

  // Parse options
  let bgType = 'white';
  let minSize = 10;
  let bgPct = 0.80;
  let unblend = true;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--bg-type' && args[i + 1]) {
      bgType = args[i + 1];
      i++;
    } else if (args[i] === '--min-size' && args[i + 1]) {
      minSize = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--bg-pct' && args[i + 1]) {
      bgPct = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--no-unblend') {
      unblend = false;
    }
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found at ${inputPath}`);
    process.exit(1);
  }

  console.log(`Loading input: ${inputPath}`);
  const data = fs.readFileSync(inputPath);
  const base64 = data.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;

  console.log(`Processing with options:`);
  console.log(`  Background Type: ${bgType}`);
  console.log(`  Min Pocket Size: ${minSize}`);
  console.log(`  Background Pct : ${bgPct}`);
  console.log(`  Edge Un-blending: ${unblend ? 'Enabled' : 'Disabled'}`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const outputDataUri = await page.evaluate(async ({ uri, bgType, minSize, bgPct, unblend }) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.width;
        const h = img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, w, h);
        const pixels = imgData.data;
        const origPixels = new Uint8ClampedArray(pixels);
        
        // Border-fill visited state
        const visited = new Uint8Array(w * h);
        const queue = [];
        
        const isBgColor = (r, g, b) => {
          if (bgType === 'white') {
            // White background + bottom black padding
            return (r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15);
          } else {
            // Checkerboard background (white/light-gray)
            return (r > 220 && g > 220 && b > 220);
          }
        };

        const pushPixel = (x, y) => {
          const idx = y * w + x;
          if (visited[idx]) return;
          visited[idx] = 1;
          
          const pIdx = idx * 4;
          if (isBgColor(origPixels[pIdx], origPixels[pIdx+1], origPixels[pIdx+2])) {
            queue.push(idx);
          }
        };

        // Initialize from borders
        for (let x = 0; x < w; x++) {
          pushPixel(x, 0);
          pushPixel(x, h - 1);
        }
        for (let y = 1; y < h - 1; y++) {
          pushPixel(0, y);
          pushPixel(w - 1, y);
        }

        // Run flood fill for main background
        const bgSet = new Uint8Array(w * h);
        while (queue.length > 0) {
          const idx = queue.shift();
          bgSet[idx] = 1;
          
          const x = idx % w;
          const y = Math.floor(idx / w);
          if (x > 0) pushPixel(x - 1, y);
          if (x < w - 1) pushPixel(x + 1, y);
          if (y > 0) pushPixel(x, y - 1);
          if (y < h - 1) pushPixel(x, y + 1);
        }

        // Find remaining isolated background-like components
        const unvisitedBg = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          if (bgSet[i] === 0) {
            const pIdx = i * 4;
            if (isBgColor(origPixels[pIdx], origPixels[pIdx+1], origPixels[pIdx+2])) {
              unvisitedBg[i] = 1;
            }
          }
        }

        const componentVisited = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          if (unvisitedBg[i] === 1 && componentVisited[i] === 0) {
            const compQueue = [i];
            componentVisited[i] = 1;
            const compPixels = [];
            
            let whiteCount = 0;
            let exactBgCount = 0;

            while (compQueue.length > 0) {
              const idx = compQueue.shift();
              compPixels.push(idx);
              
              const pIdx = idx * 4;
              const r = origPixels[pIdx];
              const g = origPixels[pIdx+1];
              const b = origPixels[pIdx+2];

              if (bgType === 'white') {
                if (r > 240 && g > 240 && b > 240) whiteCount++;
                if ((r === 255 && g === 255 && b === 255) || (r === 0 && g === 0 && b === 0)) {
                  exactBgCount++;
                }
              } else {
                if (r > 250 && g > 250 && b > 250) whiteCount++;
                if ((r === 255 && g === 255 && b === 255) || 
                    (r === 254 && g === 254 && b === 254) ||
                    (r === 238 && g === 238 && b === 238) ||
                    (r === 237 && g === 237 && b === 237)) {
                  exactBgCount++;
                }
              }

              const cx = idx % w;
              const cy = Math.floor(idx / w);

              const checkNeighbor = (nx, ny) => {
                const nidx = ny * w + nx;
                if (unvisitedBg[nidx] === 1 && componentVisited[nidx] === 0) {
                  componentVisited[nidx] = 1;
                  compQueue.push(nidx);
                }
              };

              if (cx > 0) checkNeighbor(cx - 1, cy);
              if (cx < w - 1) checkNeighbor(cx + 1, cy);
              if (cy > 0) checkNeighbor(cx, cy - 1);
              if (cy < h - 1) checkNeighbor(cx, cy + 1);
            }

            // Decide if the isolated component is a background pocket
            let isPocket = false;
            if (bgType === 'white') {
              if (whiteCount > compPixels.length * 0.85 && compPixels.length >= minSize) {
                isPocket = true;
              }
            } else {
              const currentBgPct = exactBgCount / compPixels.length;
              if (currentBgPct >= bgPct && compPixels.length >= minSize) {
                isPocket = true;
              }
            }

            if (isPocket) {
              for (const idx of compPixels) {
                bgSet[idx] = 1;
              }
            }
          }
        }

        // Apply background clearing and edge un-blending
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const pIdx = idx * 4;
            
            if (bgSet[idx] === 1) {
              pixels[pIdx] = 0;
              pixels[pIdx+1] = 0;
              pixels[pIdx+2] = 0;
              pixels[pIdx+3] = 0;
            } else if (unblend) {
              const neighbors = [];
              if (x > 0) neighbors.push({ x: x - 1, y });
              if (x < w - 1) neighbors.push({ x: x + 1, y });
              if (y > 0) neighbors.push({ x, y: y - 1 });
              if (y < h - 1) neighbors.push({ x, y: y + 1 });
              
              const bgNeighbor = neighbors.find(n => bgSet[n.y * w + n.x] === 1);
              if (bgNeighbor) {
                const nIdx = (bgNeighbor.y * w + bgNeighbor.x) * 4;
                const bgR = origPixels[nIdx];
                const bgG = origPixels[nIdx+1];
                const bgB = origPixels[nIdx+2];
                
                if (bgR > 200 && bgG > 200 && bgB > 200) {
                  const r = origPixels[pIdx];
                  const g = origPixels[pIdx+1];
                  const b = origPixels[pIdx+2];
                  
                  const ratioR = r / bgR;
                  const ratioG = g / bgG;
                  const ratioB = b / bgB;
                  const minRatio = Math.min(ratioR, ratioG, ratioB);
                  
                  let alpha = 1 - minRatio;
                  
                  if (alpha < 0.08) {
                    pixels[pIdx] = 0;
                    pixels[pIdx+1] = 0;
                    pixels[pIdx+2] = 0;
                    pixels[pIdx+3] = 0;
                  } else if (alpha >= 0.92) {
                    pixels[pIdx] = r;
                    pixels[pIdx+1] = g;
                    pixels[pIdx+2] = b;
                    pixels[pIdx+3] = 255;
                  } else {
                    const ur = Math.max(0, Math.min(255, Math.round((r - (1 - alpha) * bgR) / alpha)));
                    const ug = Math.max(0, Math.min(255, Math.round((g - (1 - alpha) * bgG) / alpha)));
                    const ub = Math.max(0, Math.min(255, Math.round((b - (1 - alpha) * bgB) / alpha)));
                    
                    pixels[pIdx] = ur;
                    pixels[pIdx+1] = ug;
                    pixels[pIdx+2] = ub;
                    pixels[pIdx+3] = Math.round(alpha * 255);
                  }
                }
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = uri;
    });
  }, { uri: dataUri, bgType, minSize, bgPct, unblend });

  await browser.close();

  const matches = outputDataUri.match(/^data:image\/png;base64,(.+)$/);
  if (matches) {
    const buffer = Buffer.from(matches[1], 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Success! Saved processed transparent PNG to ${outputPath}`);
  } else {
    console.error('Error: Failed to process canvas image data');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
