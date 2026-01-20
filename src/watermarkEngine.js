import { removeWatermark } from './blendModes.js';

export function detectWatermarkConfig(imageWidth, imageHeight) {
    if (imageWidth > 1024 && imageHeight > 1024) {
        return { logoSize: 96, marginRight: 64, marginBottom: 64 };
    } else {
        return { logoSize: 48, marginRight: 32, marginBottom: 32 };
    }
}

export function calculateWatermarkPosition(imageWidth, imageHeight, config) {
    const { logoSize, marginRight, marginBottom } = config;
    return {
        x: imageWidth - marginRight - logoSize,
        y: imageHeight - marginBottom - logoSize,
        width: logoSize,
        height: logoSize
    };
}

export class WatermarkEngine {
    constructor(map48, map96) {
        // Store the raw Uint8Arrays directly
        this.maps = {
            48: map48,
            96: map96
        };
    }

    // Accepts ArrayBuffers now
    static async create(buffer48, buffer96) {
        const map48 = new Uint8Array(buffer48);
        const map96 = new Uint8Array(buffer96);
        return new WatermarkEngine(map48, map96);
    }

    async removeWatermarkFromImage(image) {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const config = detectWatermarkConfig(canvas.width, canvas.height);
        const position = calculateWatermarkPosition(canvas.width, canvas.height, config);
        
        // Get the specific binary map for this size
        const alphaMap = this.maps[config.logoSize];

        if (alphaMap) {
            removeWatermark(imageData, alphaMap, position);
            ctx.putImageData(imageData, 0, 0);
        }

        return canvas;
    }
}