import { LocalMediaItem } from '../types';
import { compressImage, generateThumbnail } from './compression';
import { updateMedia, getPendingMedia } from './db';
import { uploadMedia } from './api';
import { v4 as uuidv4 } from 'uuid';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export async function uploadSingleMedia(item: LocalMediaItem): Promise<boolean> {
  try {
    await updateMedia(item.id, { syncStatus: 'uploading' });

    let blobToUpload = item.blob;
    if (item.mediaType === 'photo') {
      blobToUpload = await compressImage(item.blob);
    }

    await uploadMedia(
      item.guestSessionId,
      item.id,
      item.mediaType,
      blobToUpload,
      new Date(item.capturedAt).toISOString()
    );

    await updateMedia(item.id, {
      syncStatus: 'staged',
      retryCount: 0,
    });

    return true;
  } catch (error) {
    const newRetryCount = item.retryCount + 1;
    const delay = BASE_DELAY * Math.pow(2, item.retryCount);
    
    await updateMedia(item.id, {
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

  for (const item of pending) {
    if (item.nextRetryAt > now) continue;

    const success = await uploadSingleMedia(item);
    if (success) uploaded++;
    else failed++;
  }

  return { uploaded, failed };
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
