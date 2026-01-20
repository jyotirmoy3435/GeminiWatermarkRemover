/**
 * Reverse alpha blending module
 * Updated for Integer Math (0-255)
 */

// Ignore very small alpha values to avoid noise amplification
const ALPHA_THRESHOLD = 2; // Roughly corresponds to 0.008
// Cap alpha to prevent division by zero or negative clipping.
// Formula is /(255-a). If a=255, div by 0. 
const MAX_ALPHA = 254;

export function removeWatermark(imageData, alphaMap, position) {
    const { x, y, width, height } = position;

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            // Index in original image (RGBA)
            const imgIdx = ((y + row) * imageData.width + (x + col)) * 4;

            // Index in alpha map (Binary, 1 byte per pixel)
            const alphaIdx = row * width + col;

            // Get alpha value (0-255) directly from bin
            let a = alphaMap[alphaIdx];

            // Skip noise
            if (a < ALPHA_THRESHOLD) continue;

            // Cap alpha to avoid division by zero or extreme artifacts
            if (a > MAX_ALPHA) a = MAX_ALPHA;

            // Pre-calculate denominator
            const denom = 255 - a;

            // Formula: new_c = (255 * (c - a)) / (255 - a)

            // Red
            let r = imageData.data[imgIdx];
            let new_r = (255 * (r - a)) / denom;
            imageData.data[imgIdx] = Math.max(0, Math.min(255, new_r));

            // Green
            let g = imageData.data[imgIdx + 1];
            let new_g = (255 * (g - a)) / denom;
            imageData.data[imgIdx + 1] = Math.max(0, Math.min(255, new_g));

            // Blue
            let b = imageData.data[imgIdx + 2];
            let new_b = (255 * (b - a)) / denom;
            imageData.data[imgIdx + 2] = Math.max(0, Math.min(255, new_b));

            // Alpha channel (imgIdx + 3) remains untouched
        }
    }
}