import { createCanvas, loadImage } from "canvas";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, "cache.json");

async function readCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is empty, return empty object
    return {};
  }
}

async function writeCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function generateCacheKey(maskUrl, gridWidth, gridHeight) {
  const input = `${maskUrl}-${gridWidth}-${gridHeight}`;
  return createHash("md5").update(input).digest("hex");
}

async function calculateForestCoverage(maskUrl, gridWidth = 256, gridHeight = 256) {
  try {
    // Check cache first
    const cache = await readCache();
    const cacheKey = generateCacheKey(maskUrl, gridWidth, gridHeight);

    if (cache[cacheKey]) {
      console.log("Returning cached result");
      return cache[cacheKey];
    }

    // If not in cache, calculate the result
    const maskResponse = await fetch(maskUrl);
    const maskBuffer = Buffer.from(await maskResponse.arrayBuffer());
    const img = await loadImage(maskBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    const results = {};

    // Chia ảnh thành các grid 256x256 pixel
    let y = 0;
    let gridY = 0;
    while (y < img.height) {
      let x = 0;
      let gridX = 0;
      while (x < img.width) {
        const startX = x;
        const startY = y;
        const endX = Math.min(x + gridWidth, img.width);
        const endY = Math.min(y + gridHeight, img.height);

        const actualPatchWidth = endX - startX;
        const actualPatchHeight = endY - startY;
        const patchPixels = actualPatchWidth * actualPatchHeight;

        let greenPixels = 0;

        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const pixelIndex = (py * img.width + px) * 4;
            const red = pixels[pixelIndex];
            const green = pixels[pixelIndex + 1];
            const blue = pixels[pixelIndex + 2];
            const alpha = pixels[pixelIndex + 3];

            if (green > red && green > blue && alpha > 0) {
              greenPixels++;
            }
          }
        }

        const greenPercentage = (greenPixels / patchPixels) * 100;
        const coordinate = `${gridY}_${gridX}`;
        results[coordinate] = Math.round(greenPercentage * 100) / 100;

        x += gridWidth;
        gridX++;
      }
      y += gridHeight;
      gridY++;
    }

    // Cache the results before returning
    cache[cacheKey] = results;
    await writeCache(cache);

    return results;
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
}

export { calculateForestCoverage };
