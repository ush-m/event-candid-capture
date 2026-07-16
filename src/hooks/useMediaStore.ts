import { useState, useCallback, useEffect, useRef } from 'react';
import { LocalMediaItem } from '../types';
import * as db from '../lib/db';
import { processMediaForCapture, syncSelectedMedia } from '../lib/sync';

export interface ConfirmState {
  message: string;
  resolve: (value: boolean) => void;
}

export function useMediaStore(guestSessionId: string) {
  const [items, setItems] = useState<LocalMediaItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ message, resolve });
    });
  }, []);

  const resolveConfirm = useCallback((value: boolean) => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(value);
      confirmResolveRef.current = null;
    }
    setConfirmState(null);
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const allItems = await db.getAllMedia();
      const sessionItems = allItems.filter(i => i.guestSessionId === guestSessionId);

      // Reset any items stuck in 'uploading' state (e.g. after page refresh mid-upload)
      for (const item of sessionItems) {
        if (item.syncStatus === 'uploading') {
          await db.updateMedia(item.id, { syncStatus: 'pending' });
          item.syncStatus = 'pending';
        }
      }

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
      setSelectedIds(prev => new Set(prev).add(item.id));
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        setStorageError('Storage full. Please free some space.');
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
      setSelectedIds(prev => new Set(prev).add(item.id));
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        setStorageError('Storage full. Please free some space.');
        return false;
      }
      throw err;
    }
  }, [guestSessionId, loadItems]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.filter(i => i.syncStatus === 'pending').map(i => i.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;

  const uploadSelected = useCallback(async () => {
    if (syncing) {
      console.log('[Sync] uploadSelected early return: syncing');
      return;
    }
    if (selectedIds.size === 0) {
      console.log('[Sync] uploadSelected early return: no selection');
      setSyncMessage('No photos selected');
      setTimeout(() => setSyncMessage(null), 2000);
      return;
    }

    const ids = Array.from(selectedIds);
    console.log('[Sync] uploadSelected ids:', ids);

    // Always read fresh from IndexedDB — avoids stale closure blobs on mobile
    let freshItems: import('../types').LocalMediaItem[] = [];
    try {
      freshItems = await db.getMediaBatch(ids);
      console.log('[Sync] Fresh items from IndexedDB:', freshItems.length, 'for', ids.length, 'ids');
    } catch (e) {
      console.error('[Sync] Failed to read fresh items from IndexedDB:', e);
    }

    if (freshItems.length === 0) {
      // Try getAll and filter
      try {
        const all = await db.getAllMedia();
        freshItems = all.filter(i => ids.includes(i.id));
        console.log('[Sync] Fallback getAllMedia found:', freshItems.length, 'items');
      } catch (e2) {
        console.error('[Sync] Fallback getAllMedia also failed:', e2);
      }
    }

    const alreadyUploaded = freshItems.filter(i => i.syncStatus === 'staged');
    if (alreadyUploaded.length > 0) {
      const total = ids.length;
      const reupload = alreadyUploaded.length;
      const fresh = total - reupload;
      const msg = reupload === total
        ? `All ${reupload} photo${reupload > 1 ? 's' : ''} already uploaded. Upload again?`
        : `${reupload} of ${total} photo${total > 1 ? 's' : ''} already uploaded (${fresh} new). Upload all?`;
      try {
        const confirmed = await showConfirm(msg);
        if (!confirmed) return;
      } catch (e) {
        console.error('[Sync] showConfirm error:', e);
        return;
      }
    }

    setSyncing(true);
    setSyncMessage('Uploading...');
    try {
      // Pass undefined as sourceItems so syncSelectedMedia always reads fresh from IndexedDB
      const result = await syncSelectedMedia(ids);
      console.log('[Sync] syncSelectedMedia result:', result);
      setSelectedIds(new Set());
      await loadItems();
      if (result.uploaded > 0 && result.failed === 0) {
        setSyncMessage(`Uploaded ${result.uploaded} file${result.uploaded > 1 ? 's' : ''}`);
        setTimeout(() => setSyncMessage(null), 3000);
      } else if (result.uploaded > 0 && result.failed > 0) {
        setSyncMessage(`${result.uploaded} uploaded, ${result.failed} failed`);
        setTimeout(() => setSyncMessage(null), 5000);
      } else if (result.failed > 0) {
        const detail = result.errors.length > 0 ? ` — ${result.errors[0]}` : '';
        setSyncMessage(`Upload failed${detail}`);
        setTimeout(() => setSyncMessage(null), 8000);
      } else {
        const detail = result.errors.length > 0 ? `: ${result.errors.join('; ')}` : '';
        setSyncMessage(`Nothing to upload${detail}`);
        console.warn('[Sync] Nothing to upload result:', result);
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (err: unknown) {
      console.error('[Sync] uploadSelected error:', err);
      let errMsg = 'Unknown error';
      if (err instanceof Error) {
        errMsg = err.message;
      } else if (typeof err === 'string') {
        errMsg = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errMsg = String((err as { message: unknown }).message);
      } else if (err !== null && err !== undefined) {
        errMsg = String(err);
      }
      setSyncMessage(`Upload error: ${errMsg}`);
      setTimeout(() => setSyncMessage(null), 8000);
    } finally {
      setSyncing(false);
    }
  }, [syncing, selectedIds, loadItems, showConfirm]);

  return {
    items,
    capturePhoto,
    captureVideo,
    uploadSelected,
    syncing,
    pendingCount,
    storageError,
    clearStorageError: () => setStorageError(null),
    syncMessage,
    refresh: loadItems,
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    confirmState,
    resolveConfirm,
  };
}
