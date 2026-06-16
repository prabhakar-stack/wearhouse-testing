/**
 * lib/indexedDb.ts
 *
 * Client-side IndexedDB wrapper for storing failed/pending uploads on the user's device.
 */

export interface PendingUpload {
  id: string; // unique identifier: `${type}_${orderId}_${key}`
  orderId: string;
  manifestId?: string;
  orderPlatformId?: string;
  type: 'RECEIVER_REJECTION' | 'INSPECTION_VIDEO';
  key: string;
  name: string;
  mimeType: string;
  blob: Blob;
  lpn?: string;
  uploadedById?: string;
  reason?: string;
  lpnConditions?: Record<string, string>;
  lpnRecoveryTypes?: Record<string, string>;
  timestamp: number;
  status: 'failed' | 'uploading';
  error?: string;
}

const DB_NAME = 'WearhouseTestingClientDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingUploads';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported on this platform/environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function savePendingUpload(upload: PendingUpload): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(upload);

    request.onerror = () => reject(request.error || new Error('Failed to save pending upload.'));
    request.onsuccess = () => resolve();
  });
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error || new Error('Failed to fetch pending uploads.'));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deletePendingUpload(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error || new Error('Failed to delete pending upload.'));
    request.onsuccess = () => resolve();
  });
}

export async function updatePendingUploadStatus(
  id: string,
  status: 'failed' | 'uploading',
  error?: string
): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onerror = () => reject(getReq.error || new Error('Failed to fetch upload for update.'));
    getReq.onsuccess = () => {
      const record = getReq.result as PendingUpload | undefined;
      if (!record) {
        reject(new Error(`Upload record not found: ${id}`));
        return;
      }

      record.status = status;
      if (error !== undefined) {
        record.error = error;
      }

      const putReq = store.put(record);
      putReq.onerror = () => reject(putReq.error || new Error('Failed to save updated upload record.'));
      putReq.onsuccess = () => resolve();
    };
  });
}
