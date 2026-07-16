import { LocalMediaItem } from '../types';
import { compressImage, generateThumbnail } from './compression';
import { updateMedia, getPendingMedia, getMediaBatch, getMedia } from './db';
import { uploadMedia } from './api';
import { v4 as uuidv4 } from 'uuid';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

async function safeUpdateMedia(id: string, updates: Partial<LocalMediaItem>): Promise<void> {
  try {
    await updateMedia(id, updates);
  } catch (e) {
    console.warn(`[Sync] Failed to update media ${id}:`, e);
  }
}

async function reviveBlob(blob: Blob): Promise<Blob> {
  const buf = await blob.arrayBuffer();
  return new Blob([buf], { type: blob.type });
}

export async function uploadSingleMedia(item: LocalMediaItem): Promise<boolean> {
  try {
    await safeUpdateMedia(item.id, { syncStatus: 'uploading' });

    console.log(`[Sync] Uploading ${item.mediaType} ${item.id}, blob type: ${item.blob?.constructor?.name}, blob size: ${item.blob?.size}`);

    if (!item.blob || !(item.blob instanceof Blob) || item.blob.size === 0) {
      console.error(`[Sync] Blob is empty, missing, or not a Blob instance for ${item.id} (type: ${typeof item.blob}, constructor: ${item.blob?.constructor?.name})`);
      await safeUpdateMedia(item.id, { syncStatus: 'failed', retryCount: item.retryCount + 1 });
      return false;
    }

    let blobToUpload: Blob;
    try {
      blobToUpload = await reviveBlob(item.blob);
      console.log(`[Sync] Revived blob for ${item.id}: ${blobToUpload.size} bytes`);
    } catch (reviveErr) {
      console.error(`[Sync] Failed to revive blob for ${item.id}:`, reviveErr);
      await safeUpdateMedia(item.id, { syncStatus: 'failed', retryCount: item.retryCount + 1 });
      return false;
    }

    if (item.mediaType === 'photo') {
      try {
        const compressed = await compressImage(blobToUpload);
        blobToUpload = compressed;
        console.log(`[Sync] Compressed photo: ${blobToUpload.size} bytes`);
      } catch (compressErr) {
        console.warn(`[Sync] Compression failed for ${item.id}, uploading revived original:`, compressErr);
      }
    }

    console.log(`[Sync] Calling uploadMedia for ${item.id}, session: ${item.guestSessionId}, blob size: ${blobToUpload.size}`);
    await uploadMedia(
      item.guestSessionId,
      item.id,
      item.mediaType,
      blobToUpload,
      new Date(item.capturedAt).toISOString()
    );

    console.log(`[Sync] Upload success for ${item.id}`);
    await safeUpdateMedia(item.id, {
      syncStatus: 'staged',
      retryCount: 0,
    });

    return true;
  } catch (error) {
    console.error(`[Sync] Upload failed for ${item.id}:`, error);
    const newRetryCount = item.retryCount + 1;
    const delay = BASE_DELAY * Math.pow(2, item.retryCount);
    
    await safeUpdateMedia(item.id, {
      syncStatus: newRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
      retryCount: newRetryCount,
      nextRetryAt: Date.now() + delay,
    });

    return false;
  }
}

export async function syncPendingMedia(): Promise<{ uploaded: number; failed: number }> {
  const pending = await getPendingMedia();
  const now = Date.now();
  let uploaded = 0;
  let failed = 0;

  console.log(`[Sync] Found ${pending.length} pending items`);

  for (const item of pending) {
    if (item.nextRetryAt > now) {
      console.log(`[Sync] Skipping ${item.id} - retry at ${new Date(item.nextRetryAt).toLocaleTimeString()}`);
      continue;
    }

    const success = await uploadSingleMedia(item);
    if (success) uploaded++;
    else failed++;
  }

  console.log(`[Sync] Done: ${uploaded} uploaded, ${failed} failed`);
  return { uploaded, failed };
}

export async function syncSelectedMedia(ids: string[], sourceItems?: LocalMediaItem[]): Promise<{ uploaded: number; failed: number; errors: string[] }> {
  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];

  console.log(`[Sync] Uploading ${ids.length} selected items, sourceItems count: ${sourceItems?.length ?? 'none'}`);

  let itemMap: Map<string, LocalMediaItem>;
  if (sourceItems && sourceItems.length > 0) {
    itemMap = new Map(sourceItems.map(i => [i.id, i]));
    console.log(`[Sync] Using ${sourceItems.length} in-memory items, ids in map: [${[...itemMap.keys()].join(', ')}]`);
  } else {
    itemMap = new Map();
    console.log(`[Sync] No sourceItems provided`);
  }

  const missingIds = ids.filter(id => !itemMap.has(id));
  if (missingIds.length > 0) {
    console.log(`[Sync] ${missingIds.length} items not in sourceItems, fetching from IndexedDB: [${missingIds.join(', ')}]`);
    const fetched = await getMediaBatch(missingIds);
    for (const item of fetched) {
      itemMap.set(item.id, item);
    }
    console.log(`[Sync] Fetched ${fetched.length} items from IndexedDB, map now has ${itemMap.size} items`);
  }

  for (const id of ids) {
    const item = itemMap.get(id);
    if (!item) {
      const msg = `Item ${id} not found in source or IndexedDB`;
      console.warn(`[Sync] ${msg}`);
      errors.push(msg);
      failed++;
      continue;
    }
    if (item.syncStatus === 'uploading') {
      console.log(`[Sync] Skipping ${id} - currently uploading`);
      continue;
    }

    let freshItem = item;
    try {
      const reloaded = await getMedia(id);
      if (reloaded && reloaded.blob && reloaded.blob instanceof Blob && reloaded.blob.size > 0) {
        console.log(`[Sync] Re-read ${id} from IndexedDB, blob size: ${reloaded.blob.size} (was ${item.blob?.size ?? 'MISSING'})`);
        freshItem = reloaded;
      } else {
        console.warn(`[Sync] Re-read ${id} from IndexedDB but blob invalid, using original`);
      }
    } catch (e) {
      console.warn(`[Sync] Failed to re-read ${id} from IndexedDB, using original:`, e);
    }

    if (freshItem.syncStatus === 'staged') {
      console.log(`[Sync] Re-uploading ${id} (was already staged)`);
      await safeUpdateMedia(id, { syncStatus: 'pending', retryCount: 0 });
      freshItem.syncStatus = 'pending';
    }

    console.log(`[Sync] Processing ${id}: status=${freshItem.syncStatus}, blob=${freshItem.blob ? `${freshItem.blob.constructor.name}(${freshItem.blob.size}b)` : 'MISSING'}, type=${freshItem.mediaType}`);
    const success = await uploadSingleMedia(freshItem);
    if (success) {
      uploaded++;
    } else {
      failed++;
      const blobInfo = !freshItem.blob ? 'no blob' : !(freshItem.blob instanceof Blob) ? `invalid blob (${typeof freshItem.blob})` : `blob size ${freshItem.blob.size}`;
      errors.push(`${freshItem.mediaType} failed (${blobInfo})`);
    }
  }

  console.log(`[Sync] Done: ${uploaded} uploaded, ${failed} failed, ${errors.length} errors`);
  return { uploaded, failed, errors };
}

export async function processMediaForCapture(
  blob: Blob,
  guestSessionId: string,
  mediaType: 'photo' | 'video'
): Promise<LocalMediaItem> {
  const id = uuidv4();
  let thumbnail: Blob | undefined;

  if (mediaType === 'photo') {
    thumbnail = await generateThumbnail(blob);
  }

  const item: LocalMediaItem = {
    id,
    guestSessionId,
    mediaType,
    blob,
    thumbnail,
    capturedAt: Date.now(),
    syncStatus: 'pending',
    retryCount: 0,
    nextRetryAt: 0,
  };

  return item;
}
