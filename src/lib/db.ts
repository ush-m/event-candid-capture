import { LocalMediaItem } from '../types';

const DB_NAME = 'event-candid-capture';
const DB_VERSION = 2;
const MEDIA_STORE = 'media';
const SESSION_STORE = 'sessions';

interface StoredMediaItem {
  id: string;
  guestSessionId: string;
  mediaType: string;
  blob?: ArrayBuffer;
  blobType?: string;
  thumbnail?: ArrayBuffer;
  thumbnailType?: string;
  capturedAt: number;
  syncStatus: string;
  remotePath?: string;
  retryCount: number;
  nextRetryAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        const store = db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
        store.createIndex('guestSessionId', 'guestSessionId', { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE, { keyPath: 'id' });
      }
    };
  });
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

function arrayBufferToBlob(buf: ArrayBuffer, type: string): Blob {
  return new Blob([buf], { type });
}

async function serializeItem(item: LocalMediaItem): Promise<StoredMediaItem> {
  const stored: StoredMediaItem = {
    id: item.id,
    guestSessionId: item.guestSessionId,
    mediaType: item.mediaType,
    capturedAt: item.capturedAt,
    syncStatus: item.syncStatus,
    remotePath: item.remotePath,
    retryCount: item.retryCount,
    nextRetryAt: item.nextRetryAt,
  };

  if (item.blob && item.blob instanceof Blob && item.blob.size > 0) {
    try {
      stored.blob = await blobToArrayBuffer(item.blob);
      stored.blobType = item.blob.type;
    } catch (e) {
      console.warn(`[DB] Failed to serialize blob for ${item.id}:`, e);
    }
  }

  if (item.thumbnail && item.thumbnail instanceof Blob && item.thumbnail.size > 0) {
    try {
      stored.thumbnail = await blobToArrayBuffer(item.thumbnail);
      stored.thumbnailType = item.thumbnail.type;
    } catch (e) {
      console.warn(`[DB] Failed to serialize thumbnail for ${item.id}:`, e);
    }
  }

  return stored;
}

function deserializeItem(stored: StoredMediaItem): LocalMediaItem {
  const item: LocalMediaItem = {
    id: stored.id,
    guestSessionId: stored.guestSessionId,
    mediaType: stored.mediaType as 'photo' | 'video',
    blob: stored.blob
      ? arrayBufferToBlob(stored.blob, stored.blobType || 'application/octet-stream')
      : new Blob([]),
    capturedAt: stored.capturedAt,
    syncStatus: stored.syncStatus as LocalMediaItem['syncStatus'],
    remotePath: stored.remotePath,
    retryCount: stored.retryCount,
    nextRetryAt: stored.nextRetryAt,
  };

  if (stored.thumbnail) {
    item.thumbnail = arrayBufferToBlob(stored.thumbnail, stored.thumbnailType || 'image/jpeg');
  }

  return item;
}

function isStoredItem(val: unknown): val is StoredMediaItem {
  return val !== null && typeof val === 'object' && 'id' in (val as Record<string, unknown>);
}

function normalizeItem(data: unknown): LocalMediaItem {
  if (!data) throw new Error('No data');
  if (isStoredItem(data) && data.blob instanceof ArrayBuffer) {
    return deserializeItem(data);
  }
  return data as LocalMediaItem;
}

export async function addMedia(item: LocalMediaItem): Promise<void> {
  const stored = await serializeItem(item);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).put(stored);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function updateMedia(id: string, updates: Partial<LocalMediaItem>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = async () => {
      const existing = getReq.result;
      if (existing) {
        const merged: Record<string, unknown> = { ...existing };
        for (const [key, val] of Object.entries(updates)) {
          if (val !== undefined) {
            if (key === 'blob' && val instanceof Blob) {
              try {
                merged.blob = await blobToArrayBuffer(val);
                merged.blobType = val.type;
              } catch (e) {
                console.warn(`[DB] Failed to serialize updated blob for ${id}:`, e);
                merged.blob = existing.blob;
                merged.blobType = existing.blobType;
              }
            } else if (key === 'thumbnail' && val instanceof Blob) {
              try {
                merged.thumbnail = await blobToArrayBuffer(val);
                merged.thumbnailType = val.type;
              } catch (e) {
                merged.thumbnail = existing.thumbnail;
                merged.thumbnailType = existing.thumbnailType;
              }
            } else {
              merged[key] = val;
            }
          }
        }
        store.put(merged);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getMedia(id: string): Promise<LocalMediaItem | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const req = tx.objectStore(MEDIA_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      if (req.result) {
        try { resolve(normalizeItem(req.result)); }
        catch { resolve(undefined); }
      } else {
        resolve(undefined);
      }
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getMediaBatch(ids: string[]): Promise<LocalMediaItem[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_STORE);
    const results: LocalMediaItem[] = [];
    let pending = ids.length;
    if (pending === 0) { db.close(); resolve([]); return; }
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          try { results.push(normalizeItem(req.result)); } catch { /* skip */ }
        }
        pending--;
        if (pending === 0) { db.close(); resolve(results); }
      };
      req.onerror = () => {
        pending--;
        if (pending === 0) { db.close(); resolve(results); }
      };
    }
  });
}

export async function getAllMedia(): Promise<LocalMediaItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const req = tx.objectStore(MEDIA_STORE).getAll();
    req.onsuccess = () => {
      db.close();
      const items: LocalMediaItem[] = [];
      for (const raw of req.result || []) {
        try { items.push(normalizeItem(raw)); } catch { /* skip */ }
      }
      resolve(items);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getMediaBySession(sessionId: string): Promise<LocalMediaItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const index = tx.objectStore(MEDIA_STORE).index('guestSessionId');
    const req = index.getAll(sessionId);
    req.onsuccess = () => {
      db.close();
      const items: LocalMediaItem[] = [];
      for (const raw of req.result || []) {
        try { items.push(normalizeItem(raw)); } catch { /* skip */ }
      }
      resolve(items);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function getPendingMedia(): Promise<LocalMediaItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const index = tx.objectStore(MEDIA_STORE).index('syncStatus');
    const req = index.getAll('pending');
    req.onsuccess = () => {
      db.close();
      const items: LocalMediaItem[] = [];
      for (const raw of req.result || []) {
        try { items.push(normalizeItem(raw)); } catch { /* skip */ }
      }
      resolve(items);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function deleteMedia(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getMediaCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const req = tx.objectStore(MEDIA_STORE).count();
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function saveSession(session: { id: string; eventId: string; contactMethod: string; contactValue: string }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).put(session);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getSession(eventId: string): Promise<{ id: string; eventId: string; contactMethod: string; contactValue: string } | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, 'readonly');
    const index = tx.objectStore(SESSION_STORE).index('eventId');
    const req = index.get(eventId);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
