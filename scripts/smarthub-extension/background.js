// 1. Listen for manual sync requests from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sync_session') {
    performSync()
      .then(res => sendResponse({ success: true, cookiesCount: res.cookiesCount }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});

// 2. Core function to retrieve session cookies + local storage and send to Render
async function performSync() {
  // Load captured bridge configuration
  const config = await new Promise((resolve) => {
    chrome.storage.local.get(['token', 'importUrl'], resolve);
  });

  if (!config.token || !config.importUrl) {
    throw new Error('No active capture session token. Open your Warehouse Admin Settings, click "Capture Session", then try again.');
  }

  // Find a logged in Amazon SmartHub tab
  const tabs = await chrome.tabs.query({ url: '*://smarthub.amazon.in/*' });
  if (tabs.length === 0) {
    throw new Error('Please open a tab with https://smarthub.amazon.in and make sure you are logged in.');
  }

  const targetTab = tabs[0];

  // Retrieve cookies matching the URL
  const cookies = await chrome.cookies.getAll({ url: 'https://smarthub.amazon.in' });
  if (cookies.length === 0) {
    throw new Error('No cookies found for smarthub.amazon.in. Are you logged in?');
  }

  // Retrieve localStorage and sessionStorage via script injection
  let storageData = { localStorage: {}, sessionStorage: {}, pageUrl: 'https://smarthub.amazon.in/returns' };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: () => {
        const ls = {};
        const ss = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            ls[k] = localStorage.getItem(k);
          }
        } catch (e) {}
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            ss[k] = sessionStorage.getItem(k);
          }
        } catch (e) {}
        return { localStorage: ls, sessionStorage: ss, pageUrl: window.location.href };
      }
    });

    if (results && results[0] && results[0].result) {
      storageData = results[0].result;
    }
  } catch (err) {
    console.warn('[SmartHub Ext] Storage extraction failed (scripting permission issue or tab unloaded):', err);
    // Fallback to empty storage data, continue with cookies
  }

  // Prepare payload
  const payload = {
    cookies: cookies, // array of cookie objects
    localStorage: storageData.localStorage,
    sessionStorage: storageData.sessionStorage,
    pageUrl: storageData.pageUrl
  };

  // Make POST request to backend
  const response = await fetch(config.importUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Capture-Token': config.token
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Server returned status ${response.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = errJson.error || errMsg;
    } catch (e) {}
    throw new Error(`Server Error: ${errMsg}`);
  }

  return { cookiesCount: cookies.length };
}
