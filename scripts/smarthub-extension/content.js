function checkBridge() {
  const bridge = document.getElementById('smarthub-extension-bridge');
  if (bridge) {
    const token = bridge.getAttribute('data-token');
    const importUrl = bridge.getAttribute('data-url');
    
    if (token && importUrl) {
      chrome.storage.local.get(['token', 'importUrl'], (res) => {
        if (res.token !== token || res.importUrl !== importUrl) {
          chrome.storage.local.set({ token, importUrl }, () => {
            console.log('[SmartHub Ext] Bridge captured token:', token.substring(0, 8) + '...', 'and URL:', importUrl);
          });
        }
      });
    }
  }
}

// Check immediately on load
checkBridge();

// Setup mutation observer to watch for dynamic updates (React renders)
const observer = new MutationObserver(() => {
  checkBridge();
});
observer.observe(document.body, { childList: true, subtree: true });
