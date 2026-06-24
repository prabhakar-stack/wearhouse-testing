document.addEventListener('DOMContentLoaded', () => {
  const valUrl = document.getElementById('valUrl');
  const valToken = document.getElementById('valToken');
  const syncBtn = document.getElementById('syncBtn');
  const statusTitle = document.getElementById('statusTitle');
  const statusMsg = document.getElementById('statusMsg');

  let activeToken = null;
  let activeUrl = null;

  // 1. Load captured token/url from bridge
  chrome.storage.local.get(['token', 'importUrl', 'lastSyncTime', 'lastSyncStatus'], (res) => {
    activeToken = res.token;
    activeUrl = res.importUrl;

    if (activeUrl) {
      try {
        const origin = new URL(activeUrl).origin;
        valUrl.textContent = origin;
        valUrl.className = 'info-value text-success';
      } catch (e) {
        valUrl.textContent = activeUrl;
        valUrl.className = 'info-value text-success';
      }
    } else {
      valUrl.textContent = 'Not Detected';
      valUrl.className = 'info-value text-warn';
    }

    if (activeToken) {
      valToken.textContent = 'Active Token';
      valToken.className = 'info-value text-success';
      syncBtn.removeAttribute('disabled');
      syncBtn.style.backgroundColor = '#FF6700'; // enable styling

      statusTitle.textContent = 'Ready';
      statusMsg.textContent = 'Ready to capture session. Make sure you are logged into smarthub.amazon.in in Chrome, then click Sync.';
    } else {
      valToken.textContent = 'None';
      valToken.className = 'info-value text-error';
      syncBtn.setAttribute('disabled', 'true');
      syncBtn.style.backgroundColor = '#334155';

      statusTitle.textContent = 'Instructions';
      statusMsg.textContent = 'No capture token found. Open your Warehouse Admin Settings tab, click "Capture Session" to generate a token, then open this popup.';
    }

    // Show last sync history if no active token is waiting
    if (!activeToken && res.lastSyncTime) {
      const timeStr = new Date(res.lastSyncTime).toLocaleTimeString();
      const isSuccess = res.lastSyncStatus === 'success';
      statusTitle.textContent = 'Last Sync Status';
      statusMsg.innerHTML = `<span class="${isSuccess ? 'text-success' : 'text-error'}">${isSuccess ? '✅ Success' : '❌ Failed'}</span> at ${timeStr}. Need to sync again? Click "Capture Session" on the dashboard first.`;
    }
  });

  // 2. Trigger session sync
  syncBtn.addEventListener('click', () => {
    statusTitle.textContent = 'Syncing...';
    statusMsg.className = 'text-loading';
    statusMsg.textContent = 'Retrieving cookies and sending to Render...';
    syncBtn.setAttribute('disabled', 'true');

    // Send a message to background service worker
    chrome.runtime.sendMessage({ action: 'sync_session' }, (response) => {
      syncBtn.removeAttribute('disabled');

      if (chrome.runtime.lastError) {
        statusTitle.textContent = 'Connection Error';
        statusMsg.className = 'text-error';
        statusMsg.textContent = `Extension script error: ${chrome.runtime.lastError.message}`;
        return;
      }

      if (response && response.success) {
        statusTitle.textContent = 'Sync Complete';
        statusMsg.className = 'text-success';
        statusMsg.innerHTML = `✅ <b>Session synced successfully!</b><br>Captured ${response.cookiesCount || 0} cookies.`;
        
        // Clear token since it's a one-time token and is now consumed
        chrome.storage.local.remove(['token'], () => {
          valToken.textContent = 'Consumed';
          valToken.className = 'info-value text-warn';
          syncBtn.setAttribute('disabled', 'true');
          syncBtn.style.backgroundColor = '#334155';
        });

        chrome.storage.local.set({
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'success'
        });
      } else {
        statusTitle.textContent = 'Sync Failed';
        statusMsg.className = 'text-error';
        statusMsg.textContent = response?.error || 'Sync failed. Are you logged in to smarthub.amazon.in?';
        
        chrome.storage.local.set({
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'error'
        });
      }
    });
  });
});
