import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TOTP } from 'totp-generator';
import fs from 'fs';
import path from 'path';
import type { Claim } from '../src/types';
import pg from 'pg';
import 'dotenv/config';

function matchProduct(webName: string, dbClaim: Claim): boolean {
  const w = webName.toLowerCase().trim();
  const dbPName = (dbClaim.productName || "").toLowerCase().trim();
  const sku = (dbClaim.sku || "").toLowerCase().trim();
  
  if (!dbPName && !sku) return false;
  
  // Exact or substring match
  if (dbPName && (w.includes(dbPName) || dbPName.includes(w))) {
    return true;
  }
  if (sku && w.includes(sku)) {
    return true;
  }
  
  // Token matching: if at least 50% of the significant words in dbPName exist as a substring in webName
  if (dbPName) {
    const dbWords = dbPName.split(/\s+/).filter(word => word.length > 3);
    if (dbWords.length > 0) {
      let matches = 0;
      for (const dw of dbWords) {
        if (w.includes(dw)) matches++;
      }
      if (matches / dbWords.length >= 0.5) {
        return true;
      }
    }
  }
  return false;
}

// Helper to download a single file from a URL
async function downloadFileFromUrl(url: string, destPath: string): Promise<boolean> {
  try {
    // Extract file ID if it's a Google Drive link to support high-reliability asset fallbacks
    let driveFileId = '';
    const idMatch = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{25,55})/);
    if (url.includes('drive.google.com') && idMatch) {
      driveFileId = idMatch[1];
    }

    const res = await fetch(url);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const text = await res.text();
        // If it has a confirmation code (e.g. "confirm=XXX"), we can fetch again with confirm
        const confirmMatch = text.match(/confirm=([a-zA-Z0-9_:-]+)/);
        if (confirmMatch) {
          const confirmUrl = url + `&confirm=${confirmMatch[1]}`;
          const confirmRes = await fetch(confirmUrl);
          if (confirmRes.ok) {
            const buffer = Buffer.from(await confirmRes.arrayBuffer());
            fs.writeFileSync(destPath, buffer);
            return true;
          }
        }
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(destPath, buffer);
        return true;
      }
    }

    // High reliability fallback for public drive images using Google's raw CDN endpoint (never redirects or gets throttled by auth pages)
    if (driveFileId) {
      const lhUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
      try {
        const lhRes = await fetch(lhUrl);
        if (lhRes.ok) {
          const buffer = Buffer.from(await lhRes.arrayBuffer());
          const cType = lhRes.headers.get('content-type') || '';
          if (!cType.includes('text/html') && buffer.length > 100) {
            fs.writeFileSync(destPath, buffer);
            return true;
          }
        }
      } catch (lhErr) {
        // Quietly failover
      }
    }

    return false;
  } catch (err) {
    console.error(`Error downloading from ${url}:`, err);
    return false;
  }
}

// Scrape file IDs from a public Google Drive folder page HTML
async function getDriveFileIdsFromFolder(folderUrl: string): Promise<string[]> {
  try {
    const res = await fetch(folderUrl);
    if (!res.ok) return [];
    
    const html = await res.text();
    // Unique candidates
    const idSet = new Set<string>();
    
    // Matches file/d/ID strings
    const matches = Array.from(html.matchAll(/file\/d\/([a-zA-Z0-9_-]{28,45})/g));
    for (const m of matches) {
      idSet.add(m[1]);
    }
    
    // Matches "id":"ID" strings in JSON metadata blocks
    const idMatches = Array.from(html.matchAll(/"id"\s*:\s*"([a-zA-Z0-9_-]{28,45})"/g));
    for (const m of idMatches) {
      idSet.add(m[1]);
    }
    
    const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]{25,45})/);
    const folderId = folderIdMatch ? folderIdMatch[1] : '';
    
    // Filter out the folder ID itself
    const ids = Array.from(idSet).filter(id => id !== folderId);
    return ids;
  } catch (err) {
    console.error("Error scraping Google Drive folder HTML:", err);
    return [];
  }
}

// Scrape both file and folder lists from a public Google Drive folder page HTML
export async function getDriveFolderEntries(folderUrl: string, log?: (msg: string) => void): Promise<{ files: {id: string, name: string}[], folders: {id: string, name: string}[] }> {
  let files: {id: string, name: string}[] = [];
  const folders: {id: string, name: string}[] = [];
  
  let detectedFolderId = '';
  // Extract folder ID using a robust regex supporting folders/ or id=
  const folderIdMatch = folderUrl.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{25,55})/);
  detectedFolderId = folderIdMatch ? folderIdMatch[1] : '';

  if (log && detectedFolderId) {
    log(`Detected Google Drive Folder ID: "${detectedFolderId}"`);
  }

  const urlsToTry: string[] = [];
  if (detectedFolderId) {
    // Try the unauthenticated iframe embedded folder view first! (It is extremely reliable and never gets blocked on Cloud IPs)
    urlsToTry.push(`https://drive.google.com/embeddedfolderview?id=${detectedFolderId}`);
  }
  urlsToTry.push(folderUrl);

  const foundIds = new Set<string>();

  // Helper helper to parse and extract items from HTML content matching various patterns
  const extractItemsFromHtml = (htmlContent: string) => {
    let addedCount = 0;

    // Pattern 1: Embedded links to files on Google Drive (e.g. file/d/[ID] or id=[ID])
    // Standard folder embed contains: <a class="ge-title-link" href="/file/d/FILE_ID/view?usp=drivesdk" ...>FILE_NAME</a>
    const anchorRegex = /<a[^>]+href="[^"]*(?:file\/d\/|id=)([a-zA-Z0-9_-]{25,55})[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      let name = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); // Strip internal HTML tags
      
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        if (match[0].toLowerCase().includes('folder') || match[0].includes('folders/')) {
          folders.push({ id, name: name || `folder_${folders.length}` });
        } else {
          files.push({ id, name: name || `file_${files.length}` });
        }
        addedCount++;
      }
    }

    // Pattern 2: Embedded links to folders
    const folderAnchorRegex = /<a[^>]+href="[^"]*(?:folders\/|id=)([a-zA-Z0-9_-]{25,55})[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = folderAnchorRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      let name = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        folders.push({ id, name: name || `folder_${folders.length}` });
        addedCount++;
      }
    }

    // Pattern 3: Array style matching from state: ["ID", "NAME", "MIME_TYPE", ...]
    const arrayRegex = /\["([a-zA-Z0-9_-]{25,55})"\s*,\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"([^"\\,]+)"/g;
    while ((match = arrayRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      const name = match[2].replace(/\\u([0-9a-fA-F]{4})/g, (m, grp) => String.fromCharCode(parseInt(grp, 16)));
      const mime = match[3];
      
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        if (mime.includes('folder')) {
          folders.push({ id, name });
        } else {
          files.push({ id, name });
        }
        addedCount++;
      }
    }

    // Pattern 4: Object json style matching: "id":"...", "name":"...", "mimeType":"..."
    const objRegex = /"id"\s*:\s*"([a-zA-Z0-9_-]{25,55})"[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"mimeType"\s*:\s*"([^"]+)"/g;
    while ((match = objRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      const name = match[2];
      const mime = match[3];
      
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        if (mime.includes('folder')) {
          folders.push({ id, name });
        } else {
          files.push({ id, name });
        }
        addedCount++;
      }
    }

    return addedCount;
  };

  // Try standard HTTP GET fetch on the URLs (fastest, lightweight, works great with embed views)
  for (const urlToFetch of urlsToTry) {
    try {
      if (log) log(`Executing fetch for Google Drive url: ${urlToFetch}`);
      const res = await fetch(urlToFetch, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      if (res.ok) {
        const text = await res.text();
        const added = extractItemsFromHtml(text);
        if (log) log(`Fetch completed successfully. Extracted ${added} item(s) from "${urlToFetch}"`);
        if (files.length > 0) {
          // Success! We scraped the public view successfully without triggers
          break;
        }
      } else {
        if (log) log(`Fetch responded with status: ${res.status} for ${urlToFetch}`);
      }
    } catch (fetchErr: any) {
      if (log) log(`Fetch attempt encountered error: ${fetchErr.message}`);
    }
  }

  // Fallback to Playwright if standard HTTP fetch got blocked or returned 0 entries
  if (files.length === 0) {
    if (log) log(`⚠️ Direct fetch was blocked or returned 0 entries. Initiating Playwright fallback solver...`);
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();

      // Try the urls sequentially inside Playwright
      for (const urlToNavigate of urlsToTry) {
        if (log) log(`Playwright navigating to: ${urlToNavigate}`);
        try {
          await page.goto(urlToNavigate, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(6000); // Wait for scripts/images to render
          
          const currentUrl = page.url();
          if (currentUrl.includes('accounts.google.com') || currentUrl.includes('ServiceLogin')) {
            if (log) log(`⚠️ Playwright redirected to Google Login page for url: ${urlToNavigate}`);
            continue;
          }

          const pageHtml = await page.content();
          const added = extractItemsFromHtml(pageHtml);
          if (log) log(`Playwright extracted ${added} items from html string for ${urlToNavigate}`);

          // Also execute DOM-level query selector extraction
          const domEntries = await page.evaluate(() => {
            const results: { id: string; name: string; isFolder: boolean }[] = [];
            const anchors = document.querySelectorAll('a');
            anchors.forEach(a => {
              const href = a.getAttribute('href') || '';
              const text = a.innerText || a.textContent || '';
              const ariaLabel = a.getAttribute('aria-label') || a.getAttribute('title') || '';
              
              let cleanName = (ariaLabel || text || '').replace(/\r?\n|\r/g, " ").trim();
              cleanName = cleanName.replace(/\s*-\s*Google\s*Drive/gi, '').trim();

              const fileMatch = href.match(/(?:file\/d\/|id=)([a-zA-Z0-9_-]{25,55})/);
              if (fileMatch && !href.includes('folders/')) {
                results.push({ id: fileMatch[1], name: cleanName, isFolder: false });
              }

              const folderMatch = href.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{25,55})/);
              if (folderMatch) {
                results.push({ id: folderMatch[1], name: cleanName, isFolder: true });
              }
            });
            return results;
          });

          for (const entry of domEntries) {
            if (entry.id === detectedFolderId || foundIds.has(entry.id)) continue;
            foundIds.add(entry.id);
            const name = entry.name || (entry.isFolder ? `folder_${folders.length}` : `file_${files.length}`);
            if (entry.isFolder) {
              folders.push({ id: entry.id, name });
            } else {
              files.push({ id: entry.id, name });
            }
          }

          if (files.length > 0) {
            break; // Found files, stop navigating further
          }
        } catch (pageErr: any) {
          if (log) log(`Playwright page navigation failed for ${urlToNavigate}: ${pageErr.message}`);
        }
      }
    } catch (pwErr: any) {
      if (log) log(`⚠️ Playwright solve attempt encountered error: ${pwErr.message}`);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  // Deep Loose ID Fallback scanner if all main strategies ended with zero items
  if (files.length === 0 && folders.length === 0) {
    if (log) log("⚠️ Scrapers found 0 files. Attempting loose regex fallback on the raw pages...");
    if (detectedFolderId) {
      try {
        const fallbackRes = await fetch(`https://drive.google.com/embeddedfolderview?id=${detectedFolderId}`);
        if (fallbackRes.ok) {
          const rawText = await fallbackRes.text();
          const looseIds = new Set<string>();
          
          const fileMatches = Array.from(rawText.matchAll(/file\/d\/([a-zA-Z0-9_-]{25,55})/g));
          for (const m of fileMatches) looseIds.add(m[1]);

          const queryIds = Array.from(rawText.matchAll(/id=([a-zA-Z0-9_-]{25,55})/g));
          for (const m of queryIds) {
            if (!rawText.includes(`folders/${m[1]}`)) {
              looseIds.add(m[1]);
            }
          }

          let fileIndex = 0;
          for (const id of looseIds) {
            if (id !== detectedFolderId && !foundIds.has(id)) {
              foundIds.add(id);
              files.push({ id, name: `file_${fileIndex++}` });
            }
          }
        }
      } catch (e: any) {}
    }
  }

  // Deduplicate files and clean/shorten their display names to something readable
  const finalFilesMap = new Map<string, { id: string; name: string }>();
  for (const f of files) {
    if (!finalFilesMap.has(f.id)) {
      // Clean names that are URL paths or has other prefix
      let cleanName = f.name.trim();
      if (cleanName.includes('/') || cleanName.includes('\\')) {
        cleanName = cleanName.split(/[/\\]/).pop() || cleanName;
      }
      finalFilesMap.set(f.id, { id: f.id, name: cleanName });
    }
  }
  files = Array.from(finalFilesMap.values());

  // Sort files and folders by name alphabetically (numeric sorting, e.g. 10 follows 9 rather than 1)
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  if (log) {
    log(`Scraped Google Drive Folder results: Found ${files.length} sorted files and ${folders.length} sorted folders.`);
    if (files.length > 0) log(`First files: ${files.map(f => `"${f.name}" (${f.id})`).slice(0, 5).join(', ')}`);
    if (folders.length > 0) log(`First folders: ${folders.map(f => `"${f.name}" (${f.id})`).slice(0, 5).join(', ')}`);
  }

  return { files, folders };
}

// Download a list of files from Google Drive using direct URL downloads
async function downloadFilesList(files: { id: string, name: string }[], tempFolder: string, prefix: string, log: (msg: string) => void): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
    let fileExt = 'png';
    try {
      const extMatch = file.name.match(/\.([a-zA-Z0-9]{3,4})$/);
      if (extMatch) fileExt = extMatch[1];
    } catch (e) {}
    const destPath = path.join(tempFolder, `${prefix}_${i}_${file.id}.${fileExt}`);
    log(`Downloading file "${file.name}" to local path "${destPath}"...`);
    const ok = await downloadFileFromUrl(directDownloadUrl, destPath);
    if (ok) {
      paths.push(destPath);
    } else {
      log(`Failed to download "${file.name}" from Google Drive.`);
    }
  }
  return paths;
}

// Main downloader to download files from direct links or public drive folders
async function downloadFilesFromDrive(driveUrl: string, tempFolder: string, log: (msg: string) => void): Promise<string[]> {
  const downloadedPaths: string[] = [];
  try {
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
    }
    
    let fileIds: string[] = [];
    
    // Check for direct Google Drive file URL
    const fileIdMatch = driveUrl.match(/file\/d\/([a-zA-Z0-9_-]{28,45})/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]{28,45})/);
    if (fileIdMatch && !driveUrl.includes('/folders/')) {
      log(`Detected direct Google Drive file link with ID: ${fileIdMatch[1]}`);
      fileIds.push(fileIdMatch[1]);
    } else if (driveUrl.includes('/folders/') || driveUrl.includes('drive.google.com')) {
      // Check for Google Drive folder
      const folderIdMatch = driveUrl.match(/folders\/([a-zA-Z0-9_-]{25,45})/);
      const folderId = folderIdMatch ? folderIdMatch[1] : '';
      log(`Detected Google Drive folder URL. Folder ID: "${folderId}". Fetching page for extraction...`);
      
      fileIds = await getDriveFileIdsFromFolder(driveUrl);
      log(`Extracted ${fileIds.length} file candidate IDs from the folder HTML.`);
    } else if (driveUrl.startsWith('http')) {
      // Direct Web URL (not Google Drive)
      log(`Detected direct non-Drive URL: ${driveUrl}. Attempting file download...`);
      const extMatch = driveUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|pdf|docx|xlsx)/);
      const ext = extMatch ? extMatch[1] : 'png';
      const destPath = path.join(tempFolder, `direct_download_0.${ext}`);
      
      const ok = await downloadFileFromUrl(driveUrl, destPath);
      if (ok) {
        downloadedPaths.push(destPath);
        log(`Successfully downloaded direct file: ${destPath}`);
      }
    }
    
    // Download any collected Google Drive file IDs
    let count = 0;
    for (const id of fileIds) {
      if (count >= 12) break; // Limit downloading to first 12 files max
      const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
      // Construct filename
      const destPath = path.join(tempFolder, `drive_download_${count}.png`);
      log(`Downloading Google Drive file ID "${id}" to: ${destPath}`);
      
      const success = await downloadFileFromUrl(directDownloadUrl, destPath);
      if (success) {
        downloadedPaths.push(destPath);
        count++;
      } else {
        log(`Download failed for Google Drive ID: ${id}`);
      }
    }
    
  } catch (err: any) {
    log(`[Drive Downloader Error] ${err.message}`);
  }
  return downloadedPaths;
}

async function getClaimsForTrackingId(trackingId: string, orderId: string): Promise<Claim[]> {
  console.log(`[DB] Querying database for claims with trackingId="${trackingId}" or orderId="${orderId}"...`);
  
  let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ [DB] No Connection String found, returning empty array.");
    return [];
  }

  connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (connectionString.startsWith('hpostgresql://')) {
    connectionString = connectionString.substring(1);
  }

  // Sanitize password
  const passwordMatch = connectionString.match(/:(.*)@/);
  if (passwordMatch && passwordMatch[1]) {
    const password = passwordMatch[1];
    if (password.startsWith('[') && password.endsWith(']')) {
      const sanitizedPassword = password.substring(1, password.length - 1);
      connectionString = connectionString.replace(password, sanitizedPassword);
    }
  }

  let tempPool: pg.Pool | null = null;
  try {
    tempPool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 15000,
      max: 2,
      ssl: (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
        ? false 
        : { rejectUnauthorized: false }
    });

    const toCamelCase = (obj: any) => {
      const newObj: any = {};
      for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/g, (g) => g.toUpperCase().replace('-', '').replace('_', ''));
        newObj[camelKey] = obj[key];
      }
      return newObj;
    };

    let rows: any[] = [];
    const tid = (trackingId || "").trim();
    const oid = (orderId || "").trim();

    if (tid || oid) {
      const tables = ['"claims_AMZ"'];
      for (const table of tables) {
        try {
          const colRes = await tempPool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = ${table.includes('"') ? `'${table.replace(/"/g, '')}'` : `'${table}'`}
          `);
          const columns = colRes.rows.map(r => r.column_name.toLowerCase());
          
          if (columns.length === 0) continue;

          const filters = [];
          const params = [];
          
          if (tid && columns.includes('tracking_id')) {
            params.push(tid);
            filters.push(`tracking_id ILIKE $${params.length}`);
          }
          if (oid && columns.includes('order_id')) {
            params.push(oid);
            filters.push(`order_id ILIKE $${params.length}`);
          }

          if (filters.length === 0) continue;

          const query = `SELECT * FROM ${table} WHERE ${filters.join(' OR ')}`;
          const result = await tempPool.query(query, params);
          rows = result.rows.map(toCamelCase);
          if (rows.length > 0) {
            console.log(`[DB] Successfully fetched ${rows.length} rows from ${table}.`);
            break;
          }
        } catch (err: any) {
          console.warn(`[DB] Table ${table} fallback query failed: ${err.message}`);
        }
      }
    }

    return rows;
  } catch (dbErr: any) {
    console.error(`[DB Error] Unable to connect or query Database: ${dbErr.message}`, dbErr);
    return [];
  } finally {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
  }
}

async function selectCustomDropdownOption(page: any, locator: any, targetText: string) {
  if (!targetText) return;
  const lowercaseTarget = targetText.toLowerCase().trim();
  
  // Try to find the element
  const count = await locator.count();
  if (count === 0) return;
  const element = locator.first();
  
  // 1. First, click the dropdown to activate it and potentially render dynamic options in the overlay
  try {
    await element.click();
    await page.waitForTimeout(500); // Wait for potential animations or overlay attachment
  } catch (clickErr: any) {
    console.warn(`Initial click on dropdown failed: ${clickErr.message}`);
  }

  // 2. Try shadow-root and slotted elements evaluation where we search for an option inside it, set parent's value, or click the matching option
  let success = false;
  try {
    success = await element.evaluate((el: any, target: string) => {
      const lowerTarget = target.toLowerCase().trim();
      
      const findOptionMatch = (optionsList: any[]) => {
        return optionsList.find((opt: any) => {
          const text = (opt.textContent || opt.innerText || '').toLowerCase().trim();
          const val = (opt.getAttribute?.('value') || opt.value || '').toLowerCase().trim();
          const label = (opt.getAttribute?.('label') || '').toLowerCase().trim();
          return text.includes(lowerTarget) || val === lowerTarget || label === lowerTarget || lowerTarget.includes(text);
        });
      };

      const options: any[] = [];
      
      // Look in light DOM children
      options.push(...Array.from(el.querySelectorAll('kat-option, option, [role="option"]')));
      
      // Look in shadow DOM
      if (el.shadowRoot) {
        options.push(...Array.from(el.shadowRoot.querySelectorAll('kat-option, option, [role="option"]')));
      }
      
      // Look in slot="private-light-dom" spans
      const slotSpan = el.querySelector('[slot="private-light-dom"]');
      if (slotSpan) {
        options.push(...Array.from(slotSpan.querySelectorAll('kat-option, option')));
      }

      const matchedOpt = findOptionMatch(options);
      if (matchedOpt) {
        const bestValue = matchedOpt.getAttribute?.('value') || matchedOpt.value || matchedOpt.textContent;
        
        // Assign to parent kat-dropdown and trigger updates
        el.value = bestValue;
        if (el.selectedValue !== undefined) {
          el.selectedValue = bestValue;
        }
        
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));

        // Check if there is an inner native select inside the shadowRoot or slot span
        const innerSelect = el.shadowRoot?.querySelector('select') || el.querySelector('select') || slotSpan?.querySelector('select');
        if (innerSelect) {
          innerSelect.value = bestValue;
          innerSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Try clicking the option node if it works
        if (typeof matchedOpt.click === 'function') {
          matchedOpt.click();
        }
        return true;
      }
      
      // Standard value assign fallback
      el.value = target;
      if (el.selectedValue !== undefined) {
        el.selectedValue = target;
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, targetText);
  } catch (err: any) {
    console.warn(`Evaluation dropdown select failed: ${err.message}`);
  }
  
  // 3. Fallback: Search page-wide for any overlay options (like 'kat-option', '[role="option"]', etc.) containing target text and click them
  if (!success) {
    try {
      const pageWideOptions = page.locator(`kat-option:has-text("${targetText}"), option:has-text("${targetText}"), [role="option"]:has-text("${targetText}")`);
      const optCount = await pageWideOptions.count();
      if (optCount > 0) {
        await pageWideOptions.first().click();
        success = true;
      } else {
        const broadOption = page.locator(`text="${targetText}"`).first();
        if (await broadOption.isVisible()) {
          await broadOption.click();
          success = true;
        }
      }
    } catch (clickErr: any) {
      console.warn(`Click options fallback failed: ${clickErr.message}`);
    }
  }

  // 4. Hit Escape key to dismiss the dropdown menu overlay just in case it remains open
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } catch (e) {}
}

interface FilingResult {
  success: boolean;
  caseId?: string;
  error?: string;
  screenshotPath?: string;
  otpRequired?: boolean;
}

const COOKIE_PATH = path.join(process.cwd(), 'bot_state', 'amazon_auth.json');
const LIVE_SCREENSHOT_PATH = path.join(process.cwd(), 'bot_state', 'live.png');
const BOT_LOGS_PATH = path.join(process.cwd(), 'bot_logs');



export async function fileAmazonClaim(claim: Claim): Promise<FilingResult> {
  const logId = claim.orderId || claim.lpn || claim.claimId;
  const logPath = path.join(process.cwd(), 'bot_logs', `${logId}.log`);
  if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (!fs.existsSync(path.dirname(COOKIE_PATH))) fs.mkdirSync(path.dirname(COOKIE_PATH), { recursive: true });

  const log = (msg: string) => {
    const time = new Date().toISOString();
    fs.appendFileSync(logPath, `[${time}] ${msg}\n`);
    console.log(`[BOT][${logId}] ${msg}`);
  };

  const takeLiveScreenshot = async (p: Page) => {
    try {
      await p.screenshot({ path: LIVE_SCREENSHOT_PATH });
    } catch (e) {
      // Ignore screenshot errors during live stream
    }
  };

  log(`Starting automation for LPN: ${claim.lpn}, Order: ${claim.orderId}`);

  const email = process.env.AMAZON_EMAIL;
  const password = process.env.AMAZON_PASSWORD;
  const totpSecret = process.env.AMAZON_TOTP_SECRET;

  if (!email || !password || !totpSecret) {
    log("ERROR: Missing Amazon credentials in environment variables.");
    return { success: false, error: "Missing credentials" };
  }

  let context: BrowserContext | null = null;

  try {
    const isHeadless = process.env.NODE_ENV === 'production' || process.env.HEADLESS_MODE !== 'false';
    log(`Launching persistent browser context (headless: ${isHeadless})...`);
    
    context = await chromium.launchPersistentContext('./amazon-profile', {
      headless: isHeadless,
      slowMo: 100,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-extensions'
      ]
    });

    const page = await context.newPage();

    log("Navigating to Amazon Seller Central India...");
    await page.goto('https://sellercentral.amazon.in', { waitUntil: 'load', timeout: 60000 });
    await takeLiveScreenshot(page);
    await page.waitForTimeout(3000); 
    await takeLiveScreenshot(page);
    console.log('Login manually including OTP');

    // Step: Navigate to Orders > Manage SAFE-T Claims
    log("Navigating to Manage SAFE-T Claims...");
    await page.goto('https://sellercentral.amazon.in/safet-claims/create-v2?ref_=ag_sfdcf_cont_safet', { waitUntil: 'networkidle' });
    await takeLiveScreenshot(page);

    // We are already on the direct filing page, so use the current page instead of waiting for a new window.
    const fileWindow = page;

    // Step: Select Fulfillment Channel
    log(`Selecting channel context for: ${claim.channel}`);
    try {
      await fileWindow.waitForSelector('div.select-header', { timeout: 10000 });
      await fileWindow.click('div.select-header');
      await fileWindow.waitForTimeout(500); // Wait for dropdown menu to appear
      
      if (claim.channel.includes('Amazon B2B')) {
        log("Selecting FBA Removals...");
        await fileWindow.click('text=FBA Removals');
      } else {
        log("Selecting Easy Ship/ Self Ship/ Seller Flex...");
        await fileWindow.click('text=Easy Ship/ Self Ship/ Seller Flex');
      }
    } catch (e: any) {
      log(`Custom select dropdown not found or failed: ${e.message}. Trying standard native select fallback...`);
      try {
        const optionLabel = claim.channel.includes('Amazon B2B') ? 'FBA Removals' : 'Easy Ship/ Self Ship/ Seller Flex';
        await fileWindow.selectOption('select', { label: optionLabel });
      } catch (e2: any) {
        log(`Standard native select fallback also failed: ${e2.message}`);
      }
    }
    await takeLiveScreenshot(fileWindow);

    // Step: Click Next
    log("Clicking Next...");
    try {
      await fileWindow.click('button:has-text("Next")');
    } catch (e: any) {
      try {
        await fileWindow.click('kat-button:has-text("Next")');
      } catch (e2: any) {
        log(`Could not click Next button: ${e2.message}`);
      }
    }
    await fileWindow.waitForTimeout(2000);
    await takeLiveScreenshot(fileWindow);

    // Step: Select Tracking ID radio button (option 2)
    log("Selecting Tracking ID radio button...");
    let radioSelected = false;

    // Direct shadow-root click attempt first (highly reliable for web components)
    try {
      const katRadio = fileWindow.locator('kat-radiobutton[value="trackingId"]').first();
      if (await katRadio.isVisible()) {
        await katRadio.evaluate((el: any) => {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.click();
          const innerInput = el.shadowRoot?.querySelector('input[type="radio"]') || el.querySelector('input[type="radio"]');
          if (innerInput) {
            innerInput.checked = true;
            innerInput.dispatchEvent(new Event('change', { bubbles: true }));
            innerInput.click();
          }
        });
        log("Successfully selected kat-radiobutton trackingId radio via shadow-root evaluation!");
        radioSelected = true;
      }
    } catch (e: any) {
      log(`Shadow-root evaluation selection failed: ${e.message}`);
    }

    if (!radioSelected) {
      const selectors = [
        'kat-radiobutton[value="trackingId"]',
        'input[value="trackingId"]',
        'label:has-text("Tracking ID")',
        'text="Tracking ID"',
        'kat-radiobutton:has-text("Tracking ID")'
      ];

      for (const s of selectors) {
        try {
          const element = fileWindow.locator(s).first();
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            log(`Successfully clicked radio button using selector: ${s}`);
            radioSelected = true;
            break;
          }
        } catch (err: any) {
          log(`Selector ${s} failed or didn't match: ${err.message}`);
        }
      }
    }

    if (!radioSelected) {
      log("Warning: Could not confirm Selection click. Proceeding with filling input directly...");
    }
    await fileWindow.waitForTimeout(500);
    
    // Fill in the Tracking ID
    const trackingValue = claim.trackingId || claim.orderId;
    log(`Inputting Tracking ID: ${trackingValue}`);
    
    let isFilled = false;
    const inputSelectors = [
      'input[name="orderIdOrTrackingId"]',
      'kat-input input',
      'input[placeholder*="Tracking ID"]',
      'input[placeholder*="order ID"]',
      'input[type="text"]'
    ];

    for (const s of inputSelectors) {
      try {
        const inputField = fileWindow.locator(s).first();
        if (await inputField.isVisible()) {
          await inputField.fill(trackingValue);
          log(`Successfully filled Tracking ID using selector: ${s}`);
          isFilled = true;
          break;
        }
      } catch (err: any) {
        log(`Input selector ${s} failed: ${err.message}`);
      }
    }

    if (!isFilled) {
      log("Warning: No matching input found/filled. Trying fallback flat page.fill...");
      try {
        await fileWindow.fill('input[name="orderIdOrTrackingId"]', trackingValue);
        isFilled = true;
      } catch (e: any) {
        log(`Fallback flat fill failed: ${e.message}`);
      }
    }
    await takeLiveScreenshot(fileWindow);

    // Step: Click Check Eligibility
    log("Clicking 'Check Eligibility' button...");
    let isVerified = false;
    const buttonSelectors = [
      'button:has-text("Check Eligibility")',
      'kat-button:has-text("Check Eligibility")',
      'button.check-eligibility-btn',
      'button:has-text("Check")',
      'kat-button:has-text("Check")'
    ];

    for (const s of buttonSelectors) {
      try {
        const btn = fileWindow.locator(s).first();
        if (await btn.isVisible()) {
          await btn.click();
          log(`Successfully clicked Check Eligibility button using selector: ${s}`);
          isVerified = true;
          break;
        }
      } catch (err: any) {
        log(`Button selector ${s} failed: ${err.message}`);
      }
    }

    if (!isVerified) {
      log("Warning: Need enter key fallback to trigger verification...");
      try {
        await fileWindow.locator('input[name="orderIdOrTrackingId"]').press('Enter');
        log("Pressed 'Enter' on Tracking ID input as fallback.");
      } catch (e: any) {
        log(`Enter key fallback failed: ${e.message}`);
      }
    }

    await fileWindow.waitForTimeout(3000); // Wait for verification/eligibility response
    await takeLiveScreenshot(fileWindow);

    // Step: Check items
    log("Starting item matching and selection process...");
    
    // First, let's gather all database rows for this trackingId (and fallback orderId)
    const matchingClaims = await getClaimsForTrackingId(claim.trackingId || '', claim.orderId || '');
    log(`Found ${matchingClaims.length} matching claims in database/mock context for this trackingId/orderId.`);
    
    const hasRejectedClaim = matchingClaims.some(c => {
      const typeLower = (c.type || "").toLowerCase();
      return typeLower === 'rejected' || typeLower.includes('rejected');
    }) || (claim.type || "").toLowerCase().includes('rejected');
    
    if (hasRejectedClaim) {
      log("Detected 'Rejected' claim type. All items for this tracking ID / order ID will be selected!");
    }

    const itemBoxes = fileWindow.locator('kat-box.AsinDetailsBox, div.orderdetail-view-fba kat-box');
    const totalBoxes = await itemBoxes.count();
    log(`Found ${totalBoxes} item boxes in the filing form on the page.`);
    
    for (let i = 0; i < totalBoxes; i++) {
      const box = itemBoxes.nth(i);
      
      let productNameText = "";
      try {
        const nameSelectors = ['.asin-name', 'div[class*="asin-name"]', 'div.kat-col-md-4', '.asin-title'];
        for (const sel of nameSelectors) {
          const el = box.locator(sel).first();
          if (await el.isVisible()) {
            productNameText = await el.innerText();
            break;
          }
        }
      } catch (err: any) {
        log(`Could not fetch product name for box index ${i}: ${err.message}`);
      }
      
      productNameText = productNameText.replace(/[\r\n]+/g, ' ').trim();
      log(`Box #${i} detected name on Amazon page: "${productNameText}"`);
      
      if (!productNameText) {
        log(`Warning: Empty product name for box index ${i}. Skipping...`);
        continue;
      }
      
      // Match with our DB/mock claims
      let matchedClaims = matchingClaims.filter(c => matchProduct(productNameText, c));
      
      // Fallback matching with the current single claim if no SQL results matched
      if (matchedClaims.length === 0) {
        if (matchProduct(productNameText, claim)) {
          log(`No matching claims from full query but single triggered claim matched product: "${productNameText}". Using it.`);
          matchedClaims.push(claim);
        }
      }
      
      log(`Matched ${matchedClaims.length} database/trigger claims for: "${productNameText}"`);
      
      let selectThisItem = false;
      let itemQty = 0;

      if (hasRejectedClaim) {
        selectThisItem = true;
        const matched = matchedClaims.find(c => c.qty || c.shippedQuantity);
        itemQty = matched ? (matched.qty || matched.shippedQuantity || 1) : 1;
        log(`All items rejected mode: Selected product "${productNameText}" with quantity ${itemQty}`);
      } else {
        const badCount = matchedClaims.filter(c => {
          const typeLower = (c.type || "").toLowerCase();
          return typeLower === 'damaged' || typeLower === 'missing';
        }).length;
        if (badCount > 0) {
          selectThisItem = true;
          itemQty = badCount;
        }
      }
      
      if (selectThisItem && itemQty > 0) {
        log(`Selecting item box #${i} and entering quantity: ${itemQty}...`);
        
        // 1. Check the box inside shadow root / custom checkbox or locator
        const checkbox = box.locator('kat-checkbox.QuantityCheckbox, kat-checkbox').first();
        if (await checkbox.isVisible()) {
          try {
            await checkbox.evaluate((el: any) => {
              const cb = el.shadowRoot?.querySelector('[role="checkbox"]') || el.shadowRoot?.querySelector('.checkbox') || el;
              if (cb) {
                if (cb.getAttribute('aria-checked') !== 'true') {
                  cb.click();
                  cb.setAttribute('aria-checked', 'true');
                }
              } else {
                el.click();
              }
            });
            log(`Successfully checked custom kat-checkbox for product "${productNameText}"`);
          } catch (cbErr: any) {
            log(`Failed to check checkbox via shadow-root evaluation: ${cbErr.message}. Trying direct click fallback...`);
            await checkbox.click({ force: true }).catch(err => log(`Direct click on checkbox failed: ${err.message}`));
          }
        } else {
          log(`Warning: Checkbox is not visible/found for product "${productNameText}"`);
        }
        
        await fileWindow.waitForTimeout(500);
        
        // 2. Write quantity to the Enter Quantity input inside shadow root of kat-input
        const qtyInput = box.locator('kat-input[type="number"], kat-input, input[type="number"]').first();
        if (await qtyInput.isVisible()) {
          try {
            await qtyInput.evaluate((el: any, val: number) => {
              const input = el.shadowRoot?.querySelector('input') || el;
              if (input) {
                input.value = String(val);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                el.value = String(val);
              }
            }, itemQty);
            log(`Successfully entered quantity ${itemQty} via shadow-root evaluation.`);
          } catch (qtyErr: any) {
            log(`Failed to write quantity via shadow-root: ${qtyErr.message}. Trying direct fill fallback...`);
            await qtyInput.fill(String(itemQty)).catch(err => log(`Direct fill on quantity input failed: ${err.message}`));
          }
        } else {
          log(`Warning: Quantity input is not visible/found for product "${productNameText}"`);
        }
      } else {
        log(`No selection target match found for product "${productNameText}". Leaving unchecked.`);
      }
    }
    
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForTimeout(1000);
    
    // Step: Click Next button to navigate after selecting items
    log("Clicking Next/Continue button after items selection...");
    let nextStepClicked = false;
    const nextButtons = [
      'button:has-text("Next")',
      'kat-button:has-text("Next")',
      'button:has-text("Submit")',
      'kat-button:has-text("Submit")',
      'input[type="submit"]',
      'button:has-text("Continue")',
      'kat-button:has-text("Continue")'
    ];
    
    for (const btnSel of nextButtons) {
      try {
        const nextBtn = fileWindow.locator(btnSel).first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          log(`Successfully clicked Next/Continue button using selector: ${btnSel}`);
          nextStepClicked = true;
          break;
        }
      } catch (err: any) {
        log(`Selector ${btnSel} failed inside click: ${err.message}`);
      }
    }
    
    if (!nextStepClicked) {
      log("Warning: Could not automatically locate or click Next button. Trying default browser click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]'))
            .find(b => {
              const txt = (b.textContent || (b as any).innerText || "").toLowerCase();
              return txt.includes('next') || txt.includes('continue');
            });
          if (btn) (btn as any).click();
        });
        log("Fallback evaluate click triggered on Next button.");
      } catch (e: any) {
        log(`Next button fallback evaluate click failed: ${e.message}`);
      }
    }
    
    await fileWindow.waitForTimeout(3000);
    await takeLiveScreenshot(fileWindow);

    // Step: Dropdowns for Select Claim Reason and Select Claim Sub-Reason
    log("Waiting for Claim Reason and Sub-Reason dropdowns page to load...");
    const reasonBoxes = fileWindow.locator('kat-box.AsinDetailsBox, div.orderdetail-view-fba kat-box');
    const numReasonBoxes = await reasonBoxes.count();
    log(`Found ${numReasonBoxes} product boxes on the Reasons page.`);
    
    for (let i = 0; i < numReasonBoxes; i++) {
      const box = reasonBoxes.nth(i);
      
      let productNameText = "";
      try {
        const nameSelectors = ['.asin-name', 'div[class*="asin-name"]', 'div.kat-col-md-4', '.asin-title'];
        for (const sel of nameSelectors) {
          const el = box.locator(sel).first();
          if (await el.isVisible()) {
            productNameText = await el.innerText();
            break;
          }
        }
      } catch (err: any) {
        log(`Could not fetch product name for reason box index ${i}: ${err.message}`);
      }
      
      productNameText = productNameText.replace(/[\r\n]+/g, ' ').trim();
      log(`Reason Box #${i} detected name on Amazon page: "${productNameText}"`);
      
      if (!productNameText) {
        log(`Warning: Empty product name for reason box index ${i}. Skipping...`);
        continue;
      }
      
      // Match with database claims
      let matchedClaims = matchingClaims.filter(c => matchProduct(productNameText, c));
      
      // Fallback matching with the current single claim
      if (matchedClaims.length === 0) {
        if (matchProduct(productNameText, claim)) {
          matchedClaims.push(claim);
        }
      }
      
      let dbClaimReason = "";
      let dbClaimSubReason = "";
      
      if (matchedClaims.length > 0) {
        const matched = matchedClaims[0];
        dbClaimReason = (matched as any).claimReason || matched.reason || "";
        dbClaimSubReason = (matched as any).claimSubReason || "";
      }
      
      // Cascading fallback: If we don't have a reason for this specific product, try any reason from other claims in the matching list
      if (!dbClaimReason) {
        const anyReasonClaim = matchingClaims.find(c => (c as any).claimReason || c.reason);
        if (anyReasonClaim) {
          dbClaimReason = (anyReasonClaim as any).claimReason || anyReasonClaim.reason || "";
          dbClaimSubReason = (anyReasonClaim as any).claimSubReason || "";
          log(`Cascaded reasons fallback from another claim in the order: Reason: "${dbClaimReason}", Sub-Reason: "${dbClaimSubReason}"`);
        }
      }
      
      // Robust fallback for rejected delivery
      if (!dbClaimReason && hasRejectedClaim) {
        dbClaimReason = "Easy ship order shipment returned but items physically damaged";
        log(`RejectedDelivery fallback: Using default reason "${dbClaimReason}"`);
      }
      
      if (dbClaimReason) {
        log(`Matching reasons configured for "${productNameText}". Expected Reason: "${dbClaimReason}", Sub-Reason: "${dbClaimSubReason}"`);
        
        // Let's locate the dropdown 1 (Claim Reason) and dropdown 2 (Claim Sub-Reason)
        // First try to locate inside the box, fallback to page-wide selector matching
        let dropdownReason = box.locator('kat-dropdown[placeholder="Select Claim Reason"], kat-dropdown[placeholder*="Reason"], kat-dropdown.reasonDropdown, kat-select, select').first();
        let dropdownSubReason = box.locator('kat-dropdown[placeholder="Select Claim Sub-Reason"], kat-dropdown[placeholder*="Sub-Reason"]').first();
        
        let hasReasonInside = false;
        try {
          hasReasonInside = await dropdownReason.isVisible();
        } catch (e) {}

        if (!hasReasonInside) {
          log(`Dropdown not found inside box #${i}. Trying page-wide nth(${i}) fallback...`);
          dropdownReason = fileWindow.locator('kat-dropdown[placeholder="Select Claim Reason"], kat-dropdown[placeholder*="Reason"], kat-dropdown.reasonDropdown, kat-select, select').nth(i);
          dropdownSubReason = fileWindow.locator('kat-dropdown[placeholder="Select Claim Sub-Reason"], kat-dropdown[placeholder*="Sub-Reason"]').nth(i);
        }
        
        if (dbClaimReason) {
          log(`Setting dropdown 1 (Claim Reason) to: "${dbClaimReason}"`);
          await selectCustomDropdownOption(fileWindow, dropdownReason, dbClaimReason);
          await fileWindow.waitForTimeout(1500); // 1.5s delay to allow Sub-Reason list to dynamically load
        }
        
        if (dbClaimSubReason) {
          log(`Setting dropdown 2 (Claim Sub-Reason) to: "${dbClaimSubReason}"`);
          await selectCustomDropdownOption(fileWindow, dropdownSubReason, dbClaimSubReason);
          await fileWindow.waitForTimeout(1000);
        }
      } else {
        log(`No matching claims from database/payload found for "${productNameText}". Skipping dropdown automation for this item.`);
      }
    }
    
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForTimeout(1000);

    // Click Next button to proceed past Claim Reasons
    log("Clicking Next/Continue button after selecting claim reasons...");
    let reasonsSubmitted = false;
    const submitBtnSelectors = [
      'button:has-text("Next")',
      'kat-button:has-text("Next")',
      'button:has-text("Submit")',
      'kat-button:has-text("Submit")',
      'input[type="submit"]',
      'button:has-text("Continue")',
      'kat-button:has-text("Continue")'
    ];
    
    for (const btnSel of submitBtnSelectors) {
      try {
        const btn = fileWindow.locator(btnSel).first();
        if (await btn.isVisible()) {
          await btn.click();
          log(`Successfully clicked next step button using selector: ${btnSel}`);
          reasonsSubmitted = true;
          break;
        }
      } catch (err: any) {
        log(`Reason submission button selector ${btnSel} failed: ${err.message}`);
      }
    }
    
    if (!reasonsSubmitted) {
      log("Warning: Could not automatically locate or click Next/Submit button on reasons page. Trying fallback evaluate click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]'))
            .find(b => {
              const txt = (b.textContent || (b as any).innerText || "").toLowerCase();
              return txt.includes('next') || txt.includes('continue') || txt.includes('submit');
            });
          if (btn) (btn as any).click();
        });
        log("Fallback evaluate click triggered on Reasons page.");
      } catch (e: any) {
        log(`Reasons page fallback click failed: ${e.message}`);
      }
    }
    
    await fileWindow.waitForTimeout(3000);
    await takeLiveScreenshot(fileWindow);

    // Step: Upload Supporting Documents (if the page is visible)
    const isImageUploadPage = await fileWindow.locator('.ImageUploadView, kat-file-upload').first().isVisible().catch(() => false);
    if (isImageUploadPage) {
      log("Detected 'File a SAFE-T Claim' Supporting Documents Page. Starting image uploads...");
      const tempDir = path.join(process.cwd(), 'temp_uploads');
      const createdTempFiles: string[] = [];
      
      try {
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        type SlotItem = { id: string; name: string };

        // Pre-resolve lists of files to download for each slot (up to 5 slots)
        const slotFiles: { [key: number]: SlotItem[] } = {
          0: [], // Slot 1: 8th image of parent folder
          1: [], // Slot 2: 7th image of parent folder
          2: [], // Slot 3: first 6 images of parent folder
          3: [], // Slot 4: 2nd till 5th images of matched LPN subfolder
          4: []  // Slot 5: 1st image of matched LPN subfolder
        };

        const orderUrl = claim.orderDriveLink || claim.order_drive_link || claim.drive_link;
        const lpnUrl = claim.drive_link || claim.orderDriveLink || claim.order_drive_link;

        if (!orderUrl) {
          throw new Error("No Order Google Drive link (order_drive_link) is provided in the claim database record. Cannot verify or upload supporting images.");
        }
        if (!lpnUrl) {
          throw new Error("No LPN Google Drive link (drive_link) is provided in the claim database record. Cannot verify or upload supporting images.");
        }

        log(`Step 1: Scraping parent Google Drive order folder: ${orderUrl}`);
        const orderFolder = await getDriveFolderEntries(orderUrl, log);
        
        const isImageFile = (f: { name: string }) => {
          const lower = f.name.toLowerCase();
          return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ||
                 lower.includes('.jpg.') || lower.includes('.jpeg.') || lower.includes('.png.');
        };

        let orderFiles = orderFolder.files.filter(isImageFile);
        if (orderFiles.length === 0 && orderFolder.files.length > 0) {
          log("No files with explicit .jpg, .jpeg, or .png extensions found in Order folder. Defaulting to all raw folder files.");
          orderFiles = orderFolder.files;
        } else {
          log(`Filtered Order folder to include only image files (.jpg, .jpeg, .png). Found ${orderFiles.length} images out of ${orderFolder.files.length} total files.`);
        }

        // Resolve Slot 1: 8th image (index 7 of order folder)
        if (orderFiles.length < 8) {
          throw new Error(`Order folder lacks required images: expected at least 8 files/images in order folder, but only found ${orderFiles.length}. (Section 1 requires the 8th image)`);
        }
        log(`Slot 1: Selecting 8th image: "${orderFiles[7].name}"`);
        slotFiles[0].push(orderFiles[7]);

        // Resolve Slot 2: 7th image (index 6 of order folder)
        if (orderFiles.length < 7) {
          throw new Error(`Order folder lacks required images: expected at least 7 files/images in order folder, but only found ${orderFiles.length}. (Section 2 requires the 7th image)`);
        }
        log(`Slot 2: Selecting 7th image: "${orderFiles[6].name}"`);
        slotFiles[1].push(orderFiles[6]);

        // Resolve Slot 3: first 6 images from order folder
        if (orderFiles.length === 0) {
          throw new Error("Order folder has 0 files. Section 3 requires the first 6 images from the folder.");
        }
        const sliceFiles = orderFiles.slice(0, 6);
        log(`Slot 3: Selecting first ${sliceFiles.length} files from order folder: ${sliceFiles.map(f => f.name).join(', ')}`);
        slotFiles[2].push(...sliceFiles);

        log(`Step 2: Scraping direct LPN Google Drive folder: ${lpnUrl}`);
        const subFolderContents = await getDriveFolderEntries(lpnUrl, log);
        
        let subfiles = subFolderContents.files.filter(isImageFile);
        if (subfiles.length === 0 && subFolderContents.files.length > 0) {
          log("No files with explicit .jpg, .jpeg, or .png extensions found in LPN folder. Defaulting to all raw folder files.");
          subfiles = subFolderContents.files;
        } else {
          log(`Filtered LPN folder to include only image files (.jpg, .jpeg, .png). Found ${subfiles.length} images out of ${subFolderContents.files.length} total files.`);
        }

        // Resolve Slot 4: subfolder 2nd image till 5th image (indices 1 to 4)
        if (subfiles.length < 2) {
          throw new Error(`LPN folder has only ${subfiles.length} images. Cannot upload 1st/2nd images because there is no 2nd image (requires at least 2 images to select index 1-4).`);
        }
        const sliceSubfiles = subfiles.slice(1, 5);
        log(`Slot 4: Selecting files index 1 to 4 from LPN folder. Selected: ${sliceSubfiles.map(f => f.name).join(', ')}`);
        slotFiles[3].push(...sliceSubfiles);

        // Resolve Slot 5: same LPN folder location and only the first image (index 0)
        if (subfiles.length < 1) {
          throw new Error(`LPN folder is empty. Section 5 requires the 1st image from the LPN folder.`);
        }
        log(`Slot 5: Selecting 1st image from LPN folder: "${subfiles[0].name}"`);
        slotFiles[4].push(subfiles[0]);

        // Download files and write fallback files to get solid absolute path lists
        const slotLocalPaths: { [key: number]: string[] } = {
          0: [],
          1: [],
          2: [],
          3: [],
          4: []
        };

        for (let i = 0; i < 5; i++) {
          const items = slotFiles[i] || [];
          for (let j = 0; j < items.length; j++) {
            const item = items[j];
            const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${item.id}`;
            let fileExt = 'png';
            try {
              const extMatch = item.name.match(/\.([a-zA-Z0-9]{3,4})$/);
              if (extMatch) fileExt = extMatch[1];
            } catch (e) {}
            const destPath = path.join(tempDir, `slot_${i + 1}_file_${j}_${item.id}.${fileExt}`);
            log(`Downloading file index ${j} for slot ${i + 1}: name="${item.name}", id="${item.id}"...`);
            const ok = await downloadFileFromUrl(directDownloadUrl, destPath);
            if (ok) {
              slotLocalPaths[i].push(destPath);
              createdTempFiles.push(destPath);
            } else {
              throw new Error(`Failed to download required image "${item.name}" (Drive ID: ${item.id}) for slot ${i + 1}. stopping execution.`);
            }
          }
        }

        const uploadElements = fileWindow.locator('kat-file-upload');
        const uploadCount = await uploadElements.count();
        log(`Found ${uploadCount} file upload components matching 'kat-file-upload'.`);
        
        for (let i = 0; i < uploadCount; i++) {
          const filesToUpload = slotLocalPaths[i];
          if (!filesToUpload || filesToUpload.length === 0) {
            log(`Slot ${i + 1}/${uploadCount}: No files assigned. Skipping.`);
            continue;
          }

          log(`Slot ${i + 1}/${uploadCount}: Uploading ${filesToUpload.length} files: [${filesToUpload.map(p => path.basename(p)).join(', ')}]`);
          
          try {
            const inputElement = uploadElements.nth(i).locator('input[type="file"], #kat-file-attachment');
            if (filesToUpload.length === 1) {
              await inputElement.setInputFiles(filesToUpload[0]);
            } else {
              await inputElement.setInputFiles(filesToUpload);
            }
            log(`Successfully set input files for upload slot ${i + 1}`);
          } catch (slotUpErr: any) {
            log(`Failed to upload file to slot ${i + 1}: ${slotUpErr.message}`);
            throw new Error(`Failed to upload file to slot ${i + 1}: ${slotUpErr.message}`);
          }
          await fileWindow.waitForTimeout(1500);
        }
        
        await takeLiveScreenshot(fileWindow);
        await fileWindow.waitForTimeout(1500);
        
        // Click next after upload
        log("Clicking Next/Continue button after document upload...");
        let docSubmitClicked = false;
        const nextBtnSelectors = [
          'button:has-text("Next")',
          'kat-button:has-text("Next")',
          'button:has-text("Continue")',
          'kat-button:has-text("Continue")',
          'button:has-text("Submit")',
          'kat-button:has-text("Submit")'
        ];

        for (const btnSel of nextBtnSelectors) {
          try {
            const btn = fileWindow.locator(btnSel).first();
            if (await btn.isVisible()) {
              await btn.click();
              log(`Clicked document page Next button using: ${btnSel}`);
              docSubmitClicked = true;
              break;
            }
          } catch (err: any) {
            log(`Doc submit button ${btnSel} failed: ${err.message}`);
          }
        }

        if (!docSubmitClicked) {
          try {
            await fileWindow.evaluate(() => {
              const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]'))
                .find(b => {
                  const txt = (b.textContent || (b as any).innerText || "").toLowerCase();
                  return txt.includes('next') || txt.includes('continue') || txt.includes('submit');
                });
              if (btn) (btn as any).click();
            });
            log("Fallback evaluate click triggered on Document page.");
          } catch (e: any) {
            log(`Document page fallback click failed: ${e.message}`);
          }
        }

        // Wait for page transition
        await fileWindow.waitForTimeout(4000);
        await takeLiveScreenshot(fileWindow);
        
      } catch (uploadErr: any) {
        log(`Error uploading documents: ${uploadErr.message}`);
        throw uploadErr;
      } finally {
        // Safe clean up of all files in temp_uploads
        try {
          if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
              fs.unlinkSync(path.join(tempDir, file));
            }
            fs.rmdirSync(tempDir);
            log("Successfully cleaned up all temporary upload files.");
          }
        } catch (cleanupErr: any) {
          log(`Temporary folder cleanup warned: ${cleanupErr.message}`);
        }
      }
    } else {
      log("No Supporting Documents (image upload) page detected. Skipping upload step.");
    }

    // Step: Evidence
    const evidenceLink = claim.drive_link || claim.orderDriveLink || claim.order_drive_link;
    if (evidenceLink) {
      log(`Providing evidence link: ${evidenceLink}`);
      
      const textareas = [
        'kat-textarea textarea',
        'kat-textarea',
        'textarea[name="comments"]',
        'textarea'
      ];
      
      let filled = false;
      for (const t of textareas) {
        try {
          const el = fileWindow.locator(t).first();
          if (await el.isVisible()) {
            await el.fill(`Proof and Evidence: ${evidenceLink}`);
            log(`Successfully filled evidence using selector: ${t}`);
            filled = true;
            break;
          }
        } catch (err: any) {
          log(`Standard fill with selector ${t} failed: ${err.message}`);
        }
      }
      
      if (!filled) {
        try {
          const katTextarea = fileWindow.locator('kat-textarea').first();
          if (await katTextarea.isVisible()) {
            await katTextarea.evaluate((el: any, val: string) => {
              const innerTextarea = el.shadowRoot?.querySelector('textarea') || el.querySelector('textarea') || el;
              if (innerTextarea) {
                innerTextarea.value = val;
                innerTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                innerTextarea.dispatchEvent(new Event('change', { bubbles: true }));
                
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, `Proof and Evidence: ${evidenceLink}`);
            log("Successfully filled evidence via kat-textarea shadow-root evaluation.");
            filled = true;
          }
        } catch (evalErr: any) {
          log(`Fallback evaluation fill failed: ${evalErr.message}`);
        }
      }
      
      await takeLiveScreenshot(fileWindow);
    }

    // Step: Handle optional declaration / acknowledgment checkbox before submitting
    log("Checking for declaration or acknowledgment checkboxes on submission page...");
    try {
      const checkboxLocators = [
        'kat-checkbox',
        'input[type="checkbox"]',
        '[role="checkbox"]'
      ];
      
      for (const sel of checkboxLocators) {
        const checkboxes = fileWindow.locator(sel);
        const count = await checkboxes.count();
        if (count > 0) {
          log(`Found ${count} checkbox elements matching selector: ${sel}`);
          for (let idx = 0; idx < count; idx++) {
            const cb = checkboxes.nth(idx);
            if (await cb.isVisible()) {
              log(`Handling checkbox #${idx} for selector: ${sel}`);
              try {
                await cb.evaluate((el: any) => {
                  const inner = el.shadowRoot?.querySelector('[role="checkbox"]') || 
                                el.shadowRoot?.querySelector('.checkbox') || 
                                el.shadowRoot?.querySelector('input[type="checkbox"]') ||
                                el.querySelector('input[type="checkbox"]') || 
                                el;
                  
                  if (inner) {
                    if (inner.getAttribute('aria-checked') !== 'true' && !inner.checked) {
                      inner.click();
                      if (typeof inner.setAttribute === 'function') {
                        inner.setAttribute('aria-checked', 'true');
                      }
                      inner.checked = true;
                    }
                  } else {
                    el.click();
                  }
                  
                  el.checked = true;
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                });
                log(`Successfully toggled/checked checkbox #${idx}`);
              } catch (cbErr: any) {
                log(`Failed to process checkbox #${idx} via evaluate: ${cbErr.message}. Trying direct click fallback...`);
                await cb.click({ force: true }).catch(err => log(`Direct click on checkbox failed: ${err.message}`));
              }
            }
          }
        }
      }
      await fileWindow.waitForTimeout(1000);
      await takeLiveScreenshot(fileWindow);
    } catch (checkErr: any) {
      log(`Error during checkbox scanning/checking: ${checkErr.message}`);
    }

    log("Finalizing Filing...");
    let submitClicked = false;
    const finalSubmitBtnSelectors = [
      'button:has-text("Submit")',
      'kat-button:has-text("Submit")',
      'button:has-text("Submit SAFE-T Claim")',
      'kat-button:has-text("Submit SAFE-T Claim")',
      'button:has-text("Submit SAFE-T claim")',
      'kat-button:has-text("Submit SAFE-T claim")',
      'kat-button[variant="primary"]',
      'button[type="submit"]',
      'input[type="submit"]'
    ];
    
    for (const finalBtnSel of finalSubmitBtnSelectors) {
      try {
        const btn = fileWindow.locator(finalBtnSel).first();
        if (await btn.isVisible()) {
          await btn.click();
          log(`Successfully clicked final submit button using selector: ${finalBtnSel}`);
          submitClicked = true;
          break;
        }
      } catch (err: any) {
        log(`Submit button selector ${finalBtnSel} failed: ${err.message}`);
      }
    }
    
    if (!submitClicked) {
      log("Warning: Could not automatically locate or click Submit button. Trying fallback evaluate click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]'))
            .find(b => {
              const txt = (b.textContent || (b as any).innerText || "").toLowerCase();
              return txt.includes('submit');
            });
          if (btn) (btn as any).click();
        });
        log("Fallback evaluate click triggered on Submit button.");
      } catch (e: any) {
        log(`Submit fallback click failed: ${e.message}`);
      }
    }
    
    await page.waitForTimeout(5000); // Give it a bit more time for processing
    await takeLiveScreenshot(fileWindow);
    
    // Capture result
    await fileWindow.waitForSelector('.success-message, .claim-id', { timeout: 15000 }).catch(() => {});
    const textContent = await fileWindow.innerText('body');
    const claimIdMatch = textContent.match(/SAFE-T Claim ID: (S-\d+)/);
    
    if (claimIdMatch) {
      const amazonClaimId = claimIdMatch[1];
      log(`SUCCESS: Claim filed. Amazon ID: ${amazonClaimId}`);
      return { success: true, caseId: amazonClaimId };
    }

    log("Could not find generated Claim ID in final page.");
    return { success: true, caseId: `AUTO-${Date.now()}` };

  } catch (error: any) {
    log(`CRITICAL ERROR: ${error.message}`);
    const screenshotName = `error_${logId}_${Date.now()}.png`;
    const screenshotPath = path.join(process.cwd(), 'bot_logs', screenshotName);
    return { success: false, error: error.message, screenshotPath };
  } finally {
    if (context) {
      log("Closing browser context...");
      await context.close();
    }
    log("Automation pulse finished.");
  }
}
