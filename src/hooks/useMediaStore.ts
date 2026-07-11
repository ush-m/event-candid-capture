import { useState, useCallback, useEffect } from 'react';
import { LocalMediaItem } from '../types';
import * as db from '../lib/db';
import { processMediaForCapture, syncPendingMedia } from '../lib/sync';

export function useMediaStore(guestSessionId: string) {
  const [items, setItems] = useState<LocalMediaItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await db.getAllMedia();
      const sessionItems = allItems.filter(i => i.guestSessionId === guestSessionId);
      sessionItems.sort((a, b) => a.capturedAt - b.capturedAt);
      setItems(sessionItems);
      setPendingCount(sessionItems.filter(i => i.syncStatus === 'pending').length);
    } catch (err) {
      console.error('Failed to load media items:', err);
    }
  }, [guestSessionId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const capturePhoto = useCallback(async (blob: Blob): Promise<boolean> => {
    try {
      const item = await processMediaForCapture(blob, guestSessionId, 'photo');
      await db.addMedia(item);
      await loadItems();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        setStorageError('Storage full. Please wait for upload to free space.');
        return false;
      }
      throw err;
    }
  }, [guestSessionId, loadItems]);

  const captureVideo = useCallback(async (blob: Blob): Promise<boolean> => {
    try {
      const item = await processMediaForCapture(blob, guestSessionId, 'video');
      await db.addMedia(item);
      await loadItems();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        setStorageError('Storage full. Please wait for upload to free space.');
        return false;
      }
      throw err;
    }
  }, [guestSessionId, loadItems]);

  const triggerSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncPendingMedia();
      await loadItems();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, [syncing, loadItems]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingCount > 0 && !syncing) {
        triggerSync();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingCount, syncing, triggerSync]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pendingCount > 0) {
        triggerSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pendingCount, triggerSync]);

  return {
    items,
    capturePhoto,
    captureVideo,
    triggerSync,
    syncing,
    pendingCount,
    storageError,
    clearStorageError: () => setStorageError(null),
    refresh: loadItems,
  };
}
