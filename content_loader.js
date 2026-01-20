// Listen for requests from Main World
window.addEventListener('GEMINI_extension_fetch_request', async (e) => {
    const { url, id } = e.detail;
    try {
        const response = await chrome.runtime.sendMessage({ action: 'fetchBlob', url });
        window.dispatchEvent(new CustomEvent('GEMINI_extension_fetch_response', {
            detail: { id, ...response }
        }));
    } catch (err) {
        window.dispatchEvent(new CustomEvent('GEMINI_extension_fetch_response', {
            detail: { id, success: false, error: err.toString() }
        }));
    }
});

// Inject Main Script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/main.js');
script.type = 'module';

// UPDATED: Pass bin paths
script.dataset.bg48 = chrome.runtime.getURL('src/alpha/bg_48.bin');
script.dataset.bg96 = chrome.runtime.getURL('src/alpha/bg_96.bin');

(document.head || document.documentElement).appendChild(script);