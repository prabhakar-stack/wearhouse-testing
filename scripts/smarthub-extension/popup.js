document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const secretKeyInput = document.getElementById('secretKey');
  const saveBtn = document.getElementById('saveBtn');
  const syncBtn = document.getElementById('syncBtn');
  const statusTitle = document.getElementById('statusTitle');
  const statusMsg = document.getElementById('statusMsg');

  // 1. Load saved settings
  chrome.storage.local.get(['serverUrl', 'secretKey', 'lastSyncTime', 'lastSyncStatus'], (res) => {
    if (res.serverUrl) {
      serverUrlInput.value = res.serverUrl;
    }
    if (res.secretKey) {
      secretKeyInput.value = res.secretKey;
    }

    if (res.serverUrl && res.secretKey) {
      syncBtn.removeAttribute('disabled');
      syncBtn.style.backgroundColor = '#FF6700'; // enable styling
      
      if (res.lastSyncTime) {
        const timeStr = new Date(res.lastSyncTime).toLocaleTimeString();
        const dateStr = new Date(res.lastSyncTime).toLocaleDateString();
        const isSuccess = res.lastSyncStatus === 'success';
        
        statusTitle.textContent = 'Last Sync Status';
        statusMsg.innerHTML = `<span class="${isSuccess ? 'text-success' : 'text-error'}">${isSuccess ? '✅ Success' : '❌ Failed'}</span> at ${dateStr} ${timeStr}`;
      } else {
        statusTitle.textContent = 'System Status';
        statusMsg.textContent = 'Ready to sync session. Make sure you are logged into smarthub.amazon.in.';
      }
    }
  });

  // 2. Save settings
  saveBtn.addEventListener('click', () => {
    const rawUrl = serverUrlInput.value.trim();
    const secretKey = secretKeyInput.value.trim();

    if (!rawUrl || !secretKey) {
      statusTitle.textContent = 'Config Error';
      statusMsg.className = 'text-error';
      statusMsg.textContent = 'Please fill out both Server URL and Secret Key.';
      return;
    }

    // Clean URL: remove trailing slash
    const serverUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;

    chrome.storage.local.set({ serverUrl, secretKey }, () => {
      syncBtn.removeAttribute('disabled');
      syncBtn.style.backgroundColor = '#FF6700';
      statusTitle.textContent = 'Config Saved';
      statusMsg.className = 'text-success';
      statusMsg.textContent = 'Configuration saved! You can now trigger manual sync or browse SmartHub.';
      
      // Flash save button green momentarily
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      saveBtn.style.backgroundColor = '#10b981';
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.style.backgroundColor = '#FF6700';
      }, 1500);
    });
  });

  // 3. Trigger manual sync
  syncBtn.addEventListener('click', () => {
    statusTitle.textContent = 'Syncing...';
    statusMsg.className = 'text-loading';
    statusMsg.textContent = 'Retrieving cookies and sending to server...';
    syncBtn.setAttribute('disabled', 'true');
    saveBtn.setAttribute('disabled', 'true');

    // Send a message to background service worker
    chrome.runtime.sendMessage({ action: 'sync_session' }, (response) => {
      syncBtn.removeAttribute('disabled');
      saveBtn.removeAttribute('disabled');

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
        
        chrome.storage.local.set({
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'success'
        });
      } else {
        statusTitle.textContent = 'Sync Failed';
        statusMsg.className = 'text-error';
        statusMsg.textContent = response?.error || 'Unknown error occurred. Are you logged in to smarthub.amazon.in?';
        
        chrome.storage.local.set({
          lastSyncTime: new Date().toISOString(),
          lastSyncStatus: 'error'
        });
      }
    });
  });
});
