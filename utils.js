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

function generateCacheKey(maskUrl, x_split, y_split) {
  const input = `${maskUrl}-${x_split}-${y_split}`;
  return createHash("md5").update(input).digest("hex");
}

async function calculateForestCoverage(maskUrl, x_split = 1, y_split = 1) {
  try {
    // Check cache first
    const cache = await readCache();
    const cacheKey = generateCacheKey(maskUrl, x_split, y_split);

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

    // Calculate patch dimensions
    const patchWidth = Math.floor(img.width / x_split);
    const patchHeight = Math.floor(img.height / y_split);

    const results = {};

    // Process each patch
    for (let y = 0; y < y_split; y++) {
      for (let x = 0; x < x_split; x++) {
        const startX = x * patchWidth;
        const startY = y * patchHeight;

        // For the last patch in each dimension, extend to image edge
        const endX = x === x_split - 1 ? img.width : (x + 1) * patchWidth;
        const endY = y === y_split - 1 ? img.height : (y + 1) * patchHeight;

        const actualPatchWidth = endX - startX;
        const actualPatchHeight = endY - startY;
        const patchPixels = actualPatchWidth * actualPatchHeight;

        let greenPixels = 0;

        // Count green pixels in this patch
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
        const coordinate = `${x},${y}`;
        results[coordinate] = Math.round(greenPercentage * 100) / 100; // Round to 2 decimal places
      }
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
