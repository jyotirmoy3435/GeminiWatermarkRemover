// Handles fetching images to bypass CORS, replacing GM_xmlhttpRequest
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchBlob') {
    fetch(request.url)
      .then(response => response.blob())
      .then(blob => {
        // Convert blob to base64 to send back to content script
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, data: reader.result });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.toString() });
      });
    return true; // Keep channel open for async response
  }
});