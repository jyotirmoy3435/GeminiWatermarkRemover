import { WatermarkEngine } from './watermarkEngine.js';

let engine = null;
const processingQueue = new Set();

// Get Asset URLs
const currentScript = document.querySelector('script[src*="main.js"]');
const ASSETS = {
  bg48: currentScript?.dataset.bg48,
  bg96: currentScript?.dataset.bg96
};

// Helper: Fetch binary data and decompress it on the fly
const fetchBinary = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);

  // Create a decompression stream for gzip
  const ds = new DecompressionStream('gzip');

  // Pipe the download stream through the decompressor
  const decompressedStream = response.body.pipeThrough(ds);

  // Convert the stream into a Blob -> ArrayBuffer
  // (This works in all modern browsers supporting DecompressionStream)
  const newResponse = new Response(decompressedStream);
  return await newResponse.arrayBuffer();
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

const canvasToBlob = (canvas, type = 'image/png') =>
  new Promise(resolve => canvas.toBlob(resolve, type));

const isValidGeminiImage = (img) => img.closest('generated-image,.generated-image-container') !== null;

const findGeminiImages = () =>
  [...document.querySelectorAll('img[src*="googleusercontent.com"]')].filter(isValidGeminiImage);

// Fetch Blob via background
const fetchBlob = (url) => new Promise((resolve, reject) => {
  const requestId = Math.random().toString(36).substring(7);
  const handler = (e) => {
    if (e.detail.id === requestId) {
      window.removeEventListener('GEMINI_extension_fetch_response', handler);
      if (e.detail.success) {
        fetch(e.detail.data).then(r => r.blob()).then(resolve).catch(reject);
      } else {
        reject(e.detail.error);
      }
    }
  };
  window.addEventListener('GEMINI_extension_fetch_response', handler);
  window.dispatchEvent(new CustomEvent('GEMINI_extension_fetch_request', {
    detail: { url, id: requestId }
  }));
});

const replaceWithNormalSize = (src) => src.replace(/=s\d+(?=[-?#]|$)/, '=s0');

async function processImage(imgElement) {
  if (!engine || processingQueue.has(imgElement)) return;
  processingQueue.add(imgElement);
  imgElement.dataset.watermarkProcessed = 'processing';
  const originalSrc = imgElement.src;

  try {
    const fullResUrl = replaceWithNormalSize(originalSrc);
    const normalSizeBlob = await fetchBlob(fullResUrl);
    const normalSizeBlobUrl = URL.createObjectURL(normalSizeBlob);
    const normalSizeImg = await loadImage(normalSizeBlobUrl);

    const processedCanvas = await engine.removeWatermarkFromImage(normalSizeImg);
    const processedBlob = await canvasToBlob(processedCanvas);

    URL.revokeObjectURL(normalSizeBlobUrl);
    imgElement.src = URL.createObjectURL(processedBlob);
    imgElement.dataset.watermarkProcessed = 'true';
    console.log('[Gemini Watermark Remover] Processed image');
  } catch (error) {
    console.warn('[Gemini Watermark Remover] Failed:', error);
    imgElement.dataset.watermarkProcessed = 'failed';
    if (!imgElement.src) imgElement.src = originalSrc;
  } finally {
    processingQueue.delete(imgElement);
  }
}

const processAllImages = () => {
  const images = findGeminiImages();
  if (images.length === 0) return;
  images.forEach(processImage);
};

const setupMutationObserver = () => {
  new MutationObserver(debounce(processAllImages, 100))
    .observe(document.body, { childList: true, subtree: true });
  console.log('[Gemini Watermark Remover] MutationObserver active');
};

async function processImageBlob(blob) {
  const blobUrl = URL.createObjectURL(blob);
  const img = await loadImage(blobUrl);
  const canvas = await engine.removeWatermarkFromImage(img);
  URL.revokeObjectURL(blobUrl);
  return canvasToBlob(canvas);
}

// Intercept fetch
const GEMINI_URL_PATTERN = /^https:\/\/lh3\.googleusercontent\.com\/rd-gg(?:-dl)?\/.+=s(?!0-d\?).*/;
const { fetch: origFetch } = window;
window.fetch = async (...args) => {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
  if (url && GEMINI_URL_PATTERN.test(url)) {
    console.log('[Gemini Watermark Remover] Intercepting Download:', url);
    const origUrl = replaceWithNormalSize(url);
    if (typeof args[0] === 'string') args[0] = origUrl;
    else if (args[0]?.url) args[0].url = origUrl;

    const response = await origFetch(...args);
    if (!engine || !response.ok) return response;

    try {
      const blob = await response.blob();
      const processedBlob = await processImageBlob(blob);
      return new Response(processedBlob, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch (error) {
      return response;
    }
  }
  return origFetch(...args);
};

(async function init() {
  try {
    console.log('[Gemini Watermark Remover] Initializing...');

    // Fetch binaries
    const [buf48, buf96] = await Promise.all([
      fetchBinary(ASSETS.bg48),
      fetchBinary(ASSETS.bg96)
    ]);

    engine = await WatermarkEngine.create(buf48, buf96);

    processAllImages();
    setupMutationObserver();
    console.log('[Gemini Watermark Remover] Ready');
  } catch (error) {
    console.error('[Gemini Watermark Remover] Initialization failed:', error);
  }
})();